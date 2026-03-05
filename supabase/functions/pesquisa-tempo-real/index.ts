import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    // Fetch all users' search configurations
    const { data: configs } = await supabase
      .from('configuracoes')
      .select('*')
      .not('palavras_chave', 'is', null)

    if (!configs || configs.length === 0) {
      return new Response(JSON.stringify({ message: 'Nenhuma configuração de pesquisa ativa', resultados: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let totalNotificacoes = 0

    for (const config of configs) {
      const palavrasChave = config.palavras_chave as string[] || []
      const ufs = config.ufs_interesse as string[] || []

      if (palavrasChave.length === 0) continue

      // Search PNCP API for each keyword
      for (const termo of palavrasChave.slice(0, 5)) {
        try {
          const params = new URLSearchParams({
            termo,
            pagina: '1',
            tamanhoPagina: '10',
          })

          const response = await fetch(
            `https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?${params}`,
            { headers: { Accept: 'application/json' } }
          )

          if (!response.ok) {
            await response.text()
            continue
          }

          const data = await response.json()
          const itens = data?.data || data || []

          if (!Array.isArray(itens)) continue

          for (const item of itens.slice(0, 5)) {
            const titulo = item.objetoCompra || item.objeto || termo
            const orgao = item.nomeUnidadeCompradora || item.orgaoEntidade?.razaoSocial || 'Órgão não informado'
            const ufItem = item.ufSigla || item.unidadeOrgao?.ufSigla || ''

            // Filter by UF if configured
            if (ufs.length > 0 && ufItem && !ufs.includes(ufItem)) continue

            // Check if already notified (avoid duplicates)
            const identificador = `pncp-${item.codigoCompra || item.sequencialCompra || titulo.slice(0, 50)}`
            
            const { data: existente } = await supabase
              .from('notificacoes')
              .select('id')
              .eq('user_id', config.user_id)
              .ilike('titulo', `%${identificador}%`)
              .limit(1)

            if (existente && existente.length > 0) continue

            // Create notification
            await supabase.from('notificacoes').insert({
              user_id: config.user_id,
              titulo: `Nova licitação: ${titulo.slice(0, 100)}`,
              mensagem: `${orgao}${ufItem ? ` (${ufItem})` : ''} — Termo: "${termo}" [${identificador}]`,
              tipo: 'monitoramento',
              link: '/monitoramento',
            })

            // Also save to monitoramento_editais
            await supabase.from('monitoramento_editais').insert({
              user_id: config.user_id,
              titulo: titulo.slice(0, 200),
              orgao,
              uf: ufItem || null,
              portal: 'PNCP',
              url: item.linkSistemaOrigem || null,
              data_publicacao: item.dataPublicacao || new Date().toISOString(),
              data_abertura: item.dataAbertura || null,
              valor_estimado: item.valorTotalEstimado || null,
              palavras_chave: [termo],
              status: 'novo',
              lido: false,
            })

            totalNotificacoes++
          }
        } catch (err) {
          console.error(`Erro ao buscar termo "${termo}":`, err)
        }
      }
    }

    return new Response(
      JSON.stringify({
        message: `Pesquisa concluída. ${totalNotificacoes} novas licitações encontradas.`,
        resultados: totalNotificacoes,
        configs_processadas: configs.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Erro na pesquisa em tempo real:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
