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

    if (!configs || configs.length === 0) {
      return new Response(JSON.stringify({ message: 'Nenhuma configuração de pesquisa ativa', resultados: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let totalNotificacoes = 0
    let totalEmails = 0
    let totalWhatsapp = 0

    for (const config of configs) {
      const palavrasChave = config.palavras_chave as string[] || []
      const cnaes = config.cnaes_monitorados as string[] || []
      const ufs = config.ufs_interesse as string[] || []
      const alertaEmail = config.alerta_email ?? true
      const alertaWhatsapp = config.alerta_whatsapp ?? false
      const alertaSistema = config.alerta_sistema ?? true
      const valorMinimo = config.valor_minimo ? Number(config.valor_minimo) : null
      const valorMaximo = config.valor_maximo ? Number(config.valor_maximo) : null

      // Skip if no keywords and no CNAEs configured
      if (palavrasChave.length === 0 && cnaes.length === 0) continue

      // ── Strategy: Query pncp_editais_cache for new bids ──
      // Find editais inserted/updated in the last 2 hours (covers cron intervals)
      const since = new Date(Date.now() - 2 * 3600000).toISOString()

      // Build search conditions from keywords
      const novosEditais: Array<{
        titulo: string; orgao: string; uf: string; municipio: string;
        valor: string | null; url: string | null; modalidade: string | null;
        dataAbertura: string | null;
      }> = []

      // Build OR conditions for keyword matching in objeto field
      const keywordConditions = palavrasChave.map(kw => `objeto.ilike.%${kw}%`)
      
      // Fetch recent cache items matching ANY keyword
      if (palavrasChave.length > 0) {
        for (const termo of palavrasChave) {
          let query = supabase
            .from('pncp_editais_cache')
            .select('*')
            .gte('updated_at', since)
            .ilike('objeto', `%${termo}%`)

          // Apply UF filter
          if (ufs.length > 0 && ufs.length <= 10) {
            query = query.in('uf', ufs)
          }

          query = query.order('data_publicacao_pncp', { ascending: false }).limit(50)

          const { data: matchingItems, error } = await query
          if (error) {
            console.error(`Erro buscando cache por "${termo}":`, error.message)
            continue
          }

          if (!matchingItems || matchingItems.length === 0) continue

          for (const item of matchingItems) {
            const titulo = item.objeto || termo
            const orgao = item.orgao || 'Órgão não informado'
            const ufItem = item.uf || ''
            const municipio = item.municipio || ''
            const valorEst = item.valor_total_estimado

            // Filter by value range
            if (valorMinimo && valorEst && Number(valorEst) < valorMinimo) continue
            if (valorMaximo && valorEst && Number(valorEst) > valorMaximo) continue

            // Check if already notified (use pncp_id as unique identifier)
            const identificador = `pncp-cache-${item.pncp_id}`

            const { data: existente } = await supabase
              .from('notificacoes')
              .select('id')
              .eq('user_id', config.user_id)
              .ilike('mensagem', `%${identificador}%`)
              .limit(1)

            if (existente && existente.length > 0) continue

            // Also check monitoramento_editais
            const { data: existeEdital } = await supabase
              .from('monitoramento_editais')
              .select('id')
              .eq('user_id', config.user_id)
              .eq('url', item.url_pncp || '')
              .limit(1)

            if (existeEdital && existeEdital.length > 0) continue

            const valorFormatado = valorEst
              ? `R$ ${Number(valorEst).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
              : null

            // Create system notification
            if (alertaSistema) {
              await supabase.from('notificacoes').insert({
                user_id: config.user_id,
                titulo: `Nova licitação: ${titulo.slice(0, 100)}`,
                mensagem: `${orgao}${ufItem ? ` (${ufItem})` : ''}${municipio ? ` — ${municipio}` : ''} — Termo: "${termo}" [${identificador}]`,
                tipo: 'monitoramento',
                link: '/monitoramento-editais',
              })
            }

            // Save to monitoramento_editais
            await supabase.from('monitoramento_editais').insert({
              user_id: config.user_id,
              titulo: titulo.slice(0, 200),
              orgao,
              uf: ufItem || null,
              municipio: municipio || null,
              portal: 'PNCP',
              url: item.url_pncp || null,
              data_publicacao: item.data_publicacao_pncp || new Date().toISOString(),
              data_abertura: item.data_abertura_proposta || null,
              valor_estimado: valorEst,
              palavras_chave: [termo],
              status: 'novo',
              lido: false,
            })

            novosEditais.push({
              titulo: titulo.slice(0, 150),
              orgao,
              uf: ufItem,
              municipio,
              valor: valorFormatado,
              url: item.url_pncp || null,
              modalidade: item.modalidade_nome,
              dataAbertura: item.data_abertura_proposta || null,
            })

            totalNotificacoes++
          }
        }
      }

      // ── Also search by UFs without keywords (catch-all for configured UFs) ──
      if (palavrasChave.length === 0 && ufs.length > 0) {
        let query = supabase
          .from('pncp_editais_cache')
          .select('*')
          .gte('updated_at', since)
          .in('uf', ufs.slice(0, 10))
          .order('data_publicacao_pncp', { ascending: false })
          .limit(100)

        const { data: ufItems } = await query
        if (ufItems) {
          for (const item of ufItems) {
            const titulo = item.objeto || 'Edital sem objeto'
            const orgao = item.orgao || 'Órgão não informado'
            const identificador = `pncp-cache-${item.pncp_id}`

            const { data: existente } = await supabase
              .from('notificacoes')
              .select('id')
              .eq('user_id', config.user_id)
              .ilike('mensagem', `%${identificador}%`)
              .limit(1)

            if (existente && existente.length > 0) continue

            const valorEst = item.valor_total_estimado
            if (valorMinimo && valorEst && Number(valorEst) < valorMinimo) continue
            if (valorMaximo && valorEst && Number(valorEst) > valorMaximo) continue

            const valorFormatado = valorEst
              ? `R$ ${Number(valorEst).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
              : null

            if (alertaSistema) {
              await supabase.from('notificacoes').insert({
                user_id: config.user_id,
                titulo: `Nova licitação: ${titulo.slice(0, 100)}`,
                mensagem: `${orgao}${item.uf ? ` (${item.uf})` : ''}${item.municipio ? ` — ${item.municipio}` : ''} [${identificador}]`,
                tipo: 'monitoramento',
                link: '/monitoramento-editais',
              })
            }

            await supabase.from('monitoramento_editais').insert({
              user_id: config.user_id,
              titulo: titulo.slice(0, 200),
              orgao,
              uf: item.uf || null,
              municipio: item.municipio || null,
              portal: 'PNCP',
              url: item.url_pncp || null,
              data_publicacao: item.data_publicacao_pncp || new Date().toISOString(),
              data_abertura: item.data_abertura_proposta || null,
              valor_estimado: valorEst,
              palavras_chave: [],
              status: 'novo',
              lido: false,
            })

            novosEditais.push({
              titulo: titulo.slice(0, 150),
              orgao,
              uf: item.uf || '',
              municipio: item.municipio || '',
              valor: valorFormatado,
              url: item.url_pncp || null,
              modalidade: item.modalidade_nome,
              dataAbertura: item.data_abertura_proposta || null,
            })

            totalNotificacoes++
          }
        }
      }

      // ── Send email alert if there are new items ──
      if (novosEditais.length > 0 && alertaEmail) {
        try {
          const { data: authUser } = await supabase.auth.admin.getUserById(config.user_id)
          const email = authUser?.user?.email
          const { data: profile } = await supabase
            .from('profiles')
            .select('nome_completo')
            .eq('user_id', config.user_id)
            .single()

          if (email) {
            await supabase.functions.invoke('send-transactional-email', {
              body: {
                template: 'alerta-licitacao-nova',
                to: email,
                subject: `🎯 ${novosEditais.length} nova(s) licitação(ões) encontrada(s) — PRAEFECTUS`,
                label: 'alerta-monitoramento',
                data: {
                  nome: profile?.nome_completo || '',
                  total: novosEditais.length,
                  editais: novosEditais.slice(0, 10).map(e => ({
                    titulo: e.titulo,
                    orgao: e.orgao,
                    municipio: e.municipio,
                    uf: e.uf,
                    valor: e.valor || '–',
                    modalidade: e.modalidade || '–',
                    dataAbertura: e.dataAbertura || '–',
                    url: e.url || '',
                  })),
                  link: 'https://praefectus.com.br/monitoramento-editais',
                },
              },
            })
            totalEmails++
          }
        } catch (emailErr) {
          console.error(`Erro ao enviar e-mail para user ${config.user_id}:`, emailErr)
        }
      }

      // ── Send WhatsApp alert if there are new items ──
      if (novosEditais.length > 0 && alertaWhatsapp) {
        try {
          const { data: whatsConfig } = await supabase
            .from('whatsapp_routing')
            .select('numero_whatsapp')
            .eq('user_id', config.user_id)
            .eq('setor', 'licitações')
            .maybeSingle()

          const telefone = whatsConfig?.numero_whatsapp
          if (telefone) {
            const linhas = novosEditais.slice(0, 5).map((e, i) =>
              `${i + 1}. *${e.orgao}*${e.uf ? ` (${e.uf})` : ''}\n   ${e.titulo.slice(0, 80)}${e.valor ? `\n   💰 ${e.valor}` : ''}${e.modalidade ? `\n   📋 ${e.modalidade}` : ''}`
            ).join('\n\n')

            const mensagem = `🔔 *PRAEFECTUS — Novas Licitações*\n\n${novosEditais.length} processo(s) encontrado(s):\n\n${linhas}${novosEditais.length > 5 ? `\n\n... e mais ${novosEditais.length - 5} processo(s)` : ''}\n\n📲 Acesse: https://praefectus.com.br/monitoramento-editais`

            await supabase.functions.invoke('whatsapp-envio', {
              body: {
                telefone,
                setor: 'licitações',
                tipo: 'alerta',
                mensagem_custom: mensagem,
              },
              headers: {
                Authorization: `Bearer ${supabaseServiceKey}`,
              },
            })
            totalWhatsapp++
          }
        } catch (whatsErr) {
          console.error(`Erro ao enviar WhatsApp para user ${config.user_id}:`, whatsErr)
        }
      }
    }

    return new Response(
      JSON.stringify({
        message: `Pesquisa concluída. ${totalNotificacoes} novas licitações encontradas.`,
        resultados: totalNotificacoes,
        emails_enviados: totalEmails,
        whatsapp_enviados: totalWhatsapp,
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
