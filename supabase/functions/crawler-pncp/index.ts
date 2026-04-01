import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PNCP_PAGE_SIZE = 50
const MAX_PAGES_PER_SEGMENT = 80   // More pages per segment since each handles only 3 UFs
const TIMEOUT_MS = 25000
const RETRY_COUNT = 3
const RETRY_DELAY_MS = 600
const CONCURRENCY = 4
const MODALIDADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]

// 9 segments of 3 UFs each — each segment runs independently via its own cron job
const UF_SEGMENTS: string[][] = [
  ['AC', 'AL', 'AM'],
  ['AP', 'BA', 'CE'],
  ['DF', 'ES', 'GO'],
  ['MA', 'MG', 'MS'],
  ['MT', 'PA', 'PB'],
  ['PE', 'PI', 'PR'],
  ['RJ', 'RN', 'RO'],
  ['RR', 'RS', 'SC'],
  ['SE', 'SP', 'TO'],
]

const ALL_UFS = UF_SEGMENTS.flat()

function formatDatePNCP(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchPage(url: string, attempt = 1): Promise<{ items: any[]; total: number }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const resp = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!resp.ok) {
      await resp.text()
      if (attempt < RETRY_COUNT) {
        await wait(RETRY_DELAY_MS * attempt)
        return fetchPage(url, attempt + 1)
      }
      return { items: [], total: 0 }
    }
    const data = await resp.json()
    return { items: data.data || [], total: data.totalRegistros || 0 }
  } catch {
    clearTimeout(timeout)
    if (attempt < RETRY_COUNT) {
      await wait(RETRY_DELAY_MS * attempt)
      return fetchPage(url, attempt + 1)
    }
    return { items: [], total: 0 }
  }
}

async function runParallel<T>(tasks: Array<() => Promise<T>>, limit: number): Promise<T[]> {
  const results: T[] = []
  for (let i = 0; i < tasks.length; i += limit) {
    const batch = tasks.slice(i, i + limit)
    const batchResults = await Promise.all(batch.map(t => t()))
    results.push(...batchResults)
  }
  return results
}

function mapRow(item: any, uf: string, mod: number) {
  const cnpj = item.orgaoEntidade?.cnpj || ''
  const ano = item.anoCompra || ''
  const seq = item.sequencialCompra || ''
  const pncpId = cnpj && ano && seq ? `${cnpj}-${ano}-${seq}` : null

  return {
    pncp_id: pncpId,
    numero_controle_pncp: item.numeroControlePNCP || null,
    cnpj_orgao: cnpj || null,
    ano_compra: ano ? String(ano) : null,
    sequencial_compra: seq ? String(seq) : null,
    numero_compra: item.numeroCompra || null,
    orgao: item.orgaoEntidade?.razaoSocial || null,
    unidade_orgao: item.unidadeOrgao?.nomeUnidade || null,
    objeto: item.objetoCompra || null,
    modalidade_id: item.modalidadeId || mod,
    modalidade_nome: item.modalidadeNome || null,
    situacao: item.situacaoCompraNome || null,
    valor_total_estimado: item.valorTotalEstimado || null,
    valor_total_homologado: item.valorTotalHomologado || null,
    uf: item.unidadeOrgao?.ufSigla || uf,
    municipio: item.unidadeOrgao?.municipioNome || null,
    municipio_ibge: item.unidadeOrgao?.codigoIbge || null,
    esfera_id: item.orgaoEntidade?.esferaId || null,
    data_publicacao_pncp: item.dataPublicacaoPncp || null,
    data_abertura_proposta: item.dataAberturaProposta || null,
    data_encerramento_proposta: item.dataEncerramentoProposta || null,
    link_sistema_origem: item.linkSistemaOrigem || null,
    url_pncp: cnpj && ano && seq ? `https://pncp.gov.br/app/editais/${cnpj}/${ano}/${seq}` : null,
    tipo_instrumento: item.tipoInstrumentoConvocatorioNome || null,
    srp: item.srp ?? null,
    codigo_unidade: item.unidadeOrgao?.codigoUnidade || null,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  // Auth: accept CRON_SECRET or service_role JWT
  const authHeader = req.headers.get('authorization') || ''
  const cronSecret = Deno.env.get('CRON_SECRET')
  const isCronAuth = cronSecret && authHeader === `Bearer ${cronSecret}`

  if (!isCronAuth) {
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    if (!authHeader.includes(supabaseServiceKey) && authHeader !== `Bearer ${supabaseServiceKey}`) {
      const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
      if (!authHeader.includes(supabaseAnonKey)) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    let body: any = {}
    try { body = await req.json() } catch { /* empty body OK for cron */ }

    // Segment-based execution: each cron job sends its segment index (0-8)
    const segment: number | null = typeof body.segment === 'number' ? body.segment : null
    const ufs: string[] = body.ufs || (segment !== null && segment >= 0 && segment < UF_SEGMENTS.length
      ? UF_SEGMENTS[segment]
      : ALL_UFS)
    const modalidades: number[] = body.modalidades || MODALIDADES
    const diasAtras = body.dias_atras || 15
    const diasFuturos = body.dias_futuros || 45

    const now = new Date()
    const dataInicial = new Date(now.getTime() - diasAtras * 86400000)
    const dataFinal = new Date(now.getTime() + diasFuturos * 86400000)
    const dataInicialStr = formatDatePNCP(dataInicial)
    const dataFinalStr = formatDatePNCP(dataFinal)

    let totalInseridos = 0
    let totalErros = 0

    console.log(`Crawler PNCP iniciando | segment=${segment} | UFs=${ufs.join(',')} | modalidades=${modalidades.length} | período=${dataInicialStr}-${dataFinalStr}`)

    // Build all segment tasks (UF x Modalidade)
    const segmentTasks = ufs.flatMap(uf =>
      modalidades.map(mod => async () => {
        const baseUrl = `https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?dataInicial=${dataInicialStr}&dataFinal=${dataFinalStr}&tamanhoPagina=${PNCP_PAGE_SIZE}&codigoModalidadeContratacao=${mod}&uf=${uf}`

        const firstPage = await fetchPage(`${baseUrl}&pagina=1`)
        if (firstPage.items.length === 0) return { inserted: 0, errors: 0 }

        const totalPages = Math.min(MAX_PAGES_PER_SEGMENT, Math.ceil(firstPage.total / PNCP_PAGE_SIZE))
        const allItems = [...firstPage.items]

        // Fetch remaining pages with concurrency
        if (totalPages > 1) {
          const pageTasks = Array.from({ length: totalPages - 1 }, (_, i) => i + 2)
            .map(page => async () => {
              const result = await fetchPage(`${baseUrl}&pagina=${page}`)
              return result.items
            })

          const pageResults = await runParallel(pageTasks, 3)
          for (const items of pageResults) {
            if (items.length > 0) allItems.push(...items)
          }
        }

        console.log(`UF=${uf} mod=${mod}: ${allItems.length}/${firstPage.total} items`)

        const rows = allItems.map(item => mapRow(item, uf, mod)).filter(r => r.pncp_id)
        if (rows.length === 0) return { inserted: 0, errors: 0 }

        let segInserted = 0
        let segErrors = 0

        // Upsert in batches of 200
        for (let i = 0; i < rows.length; i += 200) {
          const batch = rows.slice(i, i + 200)
          const { error, count } = await supabase
            .from('pncp_editais_cache')
            .upsert(batch, { onConflict: 'pncp_id', ignoreDuplicates: false, count: 'exact' })

          if (error) {
            console.error(`Upsert error UF=${uf} mod=${mod}:`, error.message)
            segErrors += batch.length
          } else {
            segInserted += (count || batch.length)
          }
        }

        return { inserted: segInserted, errors: segErrors }
      })
    )

    // Run segments with controlled concurrency
    const segmentResults = await runParallel(segmentTasks, CONCURRENCY)
    for (const r of segmentResults) {
      totalInseridos += r.inserted
      totalErros += r.errors
    }

    // After crawling, trigger pesquisa-tempo-real to send alerts for new matches
    // Only trigger on the last segment (8) to avoid duplicate alerts
    if (segment === null || segment === UF_SEGMENTS.length - 1) {
      try {
        await supabase.functions.invoke('pesquisa-tempo-real', {
          body: { source: 'crawler' },
          headers: { Authorization: `Bearer ${supabaseServiceKey}` },
        })
        console.log('pesquisa-tempo-real invocado após crawler')
      } catch (alertErr) {
        console.error('Erro ao invocar pesquisa-tempo-real:', alertErr)
      }
    }

    const result = {
      message: 'Crawler PNCP concluído',
      segment,
      total_inseridos: totalInseridos,
      total_erros: totalErros,
      ufs_processadas: ufs.length,
      modalidades_processadas: modalidades.length,
      periodo: `${dataInicialStr} a ${dataFinalStr}`,
    }

    console.log(JSON.stringify(result))

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Crawler PNCP error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
