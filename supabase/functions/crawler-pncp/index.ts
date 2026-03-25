import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PNCP_PAGE_SIZE = 50
const MAX_PAGES_PER_MODALIDADE = 30
const TIMEOUT_MS = 30000
const MODALIDADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]

function formatDatePNCP(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

async function fetchPage(url: string): Promise<{ items: any[]; total: number }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const resp = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!resp.ok) { await resp.text(); return { items: [], total: 0 } }
    const data = await resp.json()
    return { items: data.data || [], total: data.totalRegistros || 0 }
  } catch {
    clearTimeout(timeout)
    return { items: [], total: 0 }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  // Verify CRON_SECRET
  const authHeader = req.headers.get('authorization') || ''
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    let body: any = {}
    try { body = await req.json() } catch { /* empty body OK for cron */ }

    const ufs: string[] = body.ufs || [
      'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
      'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'
    ]
    const modalidades: number[] = body.modalidades || MODALIDADES
    const diasAtras = body.dias_atras || 7
    const diasFuturos = body.dias_futuros || 30

    const now = new Date()
    const dataInicial = new Date(now.getTime() - diasAtras * 86400000)
    const dataFinal = new Date(now.getTime() + diasFuturos * 86400000)
    const dataInicialStr = formatDatePNCP(dataInicial)
    const dataFinalStr = formatDatePNCP(dataFinal)

    let totalInseridos = 0
    let totalDuplicados = 0
    let totalErros = 0

    for (const uf of ufs) {
      for (const mod of modalidades) {
        const baseUrl = `https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?dataInicial=${dataInicialStr}&dataFinal=${dataFinalStr}&tamanhoPagina=${PNCP_PAGE_SIZE}&codigoModalidadeContratacao=${mod}&uf=${uf}`

        // Fetch first page to get total
        const firstPage = await fetchPage(`${baseUrl}&pagina=1`)
        if (firstPage.items.length === 0) continue

        const totalPages = Math.min(MAX_PAGES_PER_MODALIDADE, Math.ceil(firstPage.total / PNCP_PAGE_SIZE))
        const allItems = [...firstPage.items]

        // Fetch remaining pages sequentially (to not overwhelm PNCP)
        for (let page = 2; page <= totalPages; page++) {
          const result = await fetchPage(`${baseUrl}&pagina=${page}`)
          if (result.items.length === 0) break
          allItems.push(...result.items)
        }

        console.log(`UF=${uf} mod=${mod}: ${allItems.length}/${firstPage.total} items fetched`)

        // Batch insert into cache table
        const rows = allItems.map((item: any) => {
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
        }).filter((r: any) => r.pncp_id)

        if (rows.length === 0) continue

        // Upsert in batches of 100
        for (let i = 0; i < rows.length; i += 100) {
          const batch = rows.slice(i, i + 100)
          const { error, count } = await supabase
            .from('pncp_editais_cache')
            .upsert(batch, { onConflict: 'pncp_id', ignoreDuplicates: false, count: 'exact' })

          if (error) {
            console.error(`Upsert error UF=${uf} mod=${mod}:`, error.message)
            totalErros += batch.length
          } else {
            totalInseridos += (count || batch.length)
          }
        }
      }
    }

    const result = {
      message: 'Crawler PNCP concluído',
      total_inseridos: totalInseridos,
      total_duplicados: totalDuplicados,
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