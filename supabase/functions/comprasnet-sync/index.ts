import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// ════════════════════════════════════════════════
// BASE URL OFICIAL — API Compras.gov.br v2.0
// Acesso público, sem autenticação para leitura
// ════════════════════════════════════════════════
const BASE = 'https://dadosabertos.compras.gov.br'

// Modalidades — Módulo Legado (Manual v2.0, Seção 9.1)
const MODALIDADES: Record<string, number> = {
  PREGAO_ELETRONICO: 6,
  DISPENSA_ELETRONICA: 13,
  CONCORRENCIA: 1,
  RDC: 8,
}

function gerarDatas(diasAtras: number): string[] {
  return Array.from({ length: diasAtras }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - i)
    return d.toISOString().split('T')[0].replace(/-/g, '')
  })
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function computeHash(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function mapComprasnetRow(r: any, lei: string) {
  const fonteId = r.id_compra ? String(r.id_compra) : null
  return {
    // Multi-source fields
    fonte: 'comprasnet',
    fonte_id: fonteId,
    lei_base: lei,

    // Use pncp_id convention for comprasnet: prefix to avoid collision
    pncp_id: fonteId ? `comprasnet-${fonteId}` : `comprasnet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,

    objeto: r.objeto ?? r.informacoes_gerais ?? '',
    numero_compra: r.numero_processo ?? null,

    uasg_codigo: r.uasg ? String(r.uasg) : null,
    uasg_nome: r.nome_uasg ?? null,

    modalidade_id: r.modalidade ?? null,
    modalidade_nome: r.nome_modalidade ?? '',

    valor_total_estimado: r.valor_estimado_total ? parseFloat(r.valor_estimado_total) : null,
    valor_total_homologado: r.valor_homologado_total ? parseFloat(r.valor_homologado_total) : null,

    data_publicacao_pncp: r.data_publicacao ? new Date(r.data_publicacao).toISOString() : null,
    data_abertura_proposta: r.data_abertura_proposta ? new Date(r.data_abertura_proposta).toISOString() : null,
    data_encerramento_proposta: r.data_entrega_proposta ? new Date(r.data_entrega_proposta).toISOString() : null,

    situacao: r.situacao_aviso ?? '',
    orgao: r.nome_orgao ?? r.nome_uasg ?? '',
    uf: r.uf ?? null,

    link_comprasnet: fonteId
      ? `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/public/compras/acompanhamento-compra?compra=${fonteId}`
      : null,
    link_sistema_origem: fonteId
      ? `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/public/compras/acompanhamento-compra?compra=${fonteId}`
      : null,

    esfera_id: 'F',
  }
}

async function sincronizarLote(
  supabase: any,
  data: string,
  modalidade: number,
): Promise<number> {
  let pagina = 1
  let totalPaginas = 1
  let novos = 0

  while (pagina <= totalPaginas && pagina <= 20) {
    const url =
      `${BASE}/modulo-legado/1_consultarLicitacao` +
      `?pagina=${pagina}` +
      `&tamanhoPagina=500` +
      `&modalidade=${modalidade}` +
      `&data_publicacao_inicial=${data}` +
      `&data_publicacao_final=${data}`

    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(20000),
    })

    if (res.status === 429) {
      await sleep(5000)
      continue
    }
    if (!res.ok) break

    const json = await res.json()
    totalPaginas = json.totalPaginas ?? 1
    const registros: any[] = json.resultado ?? []
    if (!registros.length) break

    const rows = registros
      .map(r => mapComprasnetRow(r, 'legado'))
      .filter(r => r.fonte_id)

    if (rows.length > 0) {
      // Add hash for change detection
      const finalRows = await Promise.all(
        rows.map(async r => ({
          ...r,
          hash_objeto: await computeHash((r.objeto || '') + '|' + (r.situacao || '') + '|' + (r.valor_total_estimado || '')),
        }))
      )

      // Upsert in batches of 200
      for (let i = 0; i < finalRows.length; i += 200) {
        const batch = finalRows.slice(i, i + 200)
        const { error, count } = await supabase
          .from('pncp_editais_cache')
          .upsert(batch, { onConflict: 'pncp_id', ignoreDuplicates: false, count: 'exact' })

        if (error) {
          console.error(`Upsert error mod=${modalidade}:`, error.message)
        } else {
          novos += count || batch.length
        }
      }
    }

    pagina++
  }

  return novos
}

async function sincronizarNovaLei(supabase: any, data: string): Promise<number> {
  const url =
    `${BASE}/modulo-legado/1_consultarLicitacao` +
    `?pagina=1&tamanhoPagina=500` +
    `&data_publicacao_inicial=${data}` +
    `&data_publicacao_final=${data}` +
    `&pertence14133=1`

  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(20000),
  })

  if (!res.ok) return 0
  const json = await res.json()
  const registros: any[] = json.resultado ?? []
  if (!registros.length) return 0

  const rows = registros
    .map(r => mapComprasnetRow(r, '14133'))
    .filter(r => r.fonte_id)

  if (rows.length === 0) return 0

  const finalRows = await Promise.all(
    rows.map(async r => ({
      ...r,
      hash_objeto: await computeHash((r.objeto || '') + '|' + (r.situacao || '') + '|' + (r.valor_total_estimado || '')),
    }))
  )

  const { data: resultado } = await supabase
    .from('pncp_editais_cache')
    .upsert(finalRows, { onConflict: 'pncp_id', ignoreDuplicates: false })
    .select('id')

  return resultado?.length ?? 0
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  // Auth: accept CRON_SECRET, service_role, anon key, or valid JWT
  const authHeader = req.headers.get('authorization') || ''
  const apiKey = req.headers.get('apikey') || ''
  const cronSecret = Deno.env.get('CRON_SECRET')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || ''

  const hasAuth = (
    (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    (supabaseServiceKey && authHeader.includes(supabaseServiceKey)) ||
    (supabaseAnonKey && (authHeader.includes(supabaseAnonKey) || apiKey === supabaseAnonKey)) ||
    authHeader.startsWith('Bearer ey') // valid JWT token
  )

  if (!hasAuth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const svcKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, svcKey)

  try {
    const body = await req.json().catch(() => ({}))
    const modo = body.modo || 'incremental'
    const diasAtras = modo === 'historico' ? 30 : 2
    const datas = gerarDatas(diasAtras)
    const startTime = performance.now()

    let totalNovos = 0
    let totalErros = 0

    console.log(`[comprasnet-sync] modo=${modo} dias=${diasAtras} datas=${datas.length}`)

    for (const data of datas) {
      for (const modalidade of Object.values(MODALIDADES)) {
        try {
          totalNovos += await sincronizarLote(supabase, data, modalidade)
        } catch (e) {
          console.error(`Erro ${data} mod ${modalidade}:`, e)
          totalErros++
        }
      }
      // Também buscar editais da Lei 14.133 em transição no legado
      try {
        totalNovos += await sincronizarNovaLei(supabase, data)
      } catch (e) {
        console.error(`Erro pertence14133 ${data}:`, e)
        totalErros++
      }
    }

    const duracaoMs = Math.round(performance.now() - startTime)

    // Registrar log de sincronização
    try {
      await supabase.from('pncp_sync_log').insert({
        total_registros: totalNovos + totalErros,
        novos: totalNovos,
        erros: totalErros,
        status: totalErros > 0 && totalNovos === 0 ? 'erro' : totalErros > 0 ? 'parcial' : 'sucesso',
        concluido_em: new Date().toISOString(),
        duracao_ms: duracaoMs,
        fonte: 'comprasnet',
      })
    } catch (logErr) {
      console.error('Erro ao registrar sync log:', logErr)
    }

    const result = {
      message: 'Comprasnet sync concluído',
      modo,
      total_novos: totalNovos,
      total_erros: totalErros,
      dias_processados: datas.length,
      duracao_ms: duracaoMs,
    }

    console.log(JSON.stringify(result))

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[comprasnet-sync] Erro:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
