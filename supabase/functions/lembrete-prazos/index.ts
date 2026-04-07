import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface LicitacaoComPrazo {
  numero_processo: string;
  orgao: string;
  objeto: string;
  municipio: string | null;
  uf: string | null;
  valor_estimado: number | null;
  data_abertura: string;
  codigo_uasg: string | null;
  modalidade: string | null;
  portal: string | null;
  horas_restantes: number;
  urgencia: 'critica' | 'alta';
  fonte: string;
  url_edital: string | null;
  url_portal: string | null;
}

// Parse various date formats from data_abertura fields
function parseDataAbertura(raw: string | null): Date | null {
  if (!raw) return null;
  
  // ISO format: 2026-04-07T09:00:00
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (isoMatch) {
    const [, y, m, d, h = '09', min = '00'] = isoMatch;
    return new Date(`${y}-${m}-${d}T${h}:${min}:00-03:00`);
  }

  // BR format: 07/04/2026 or em 07/04/2026 às 09:00
  const brMatch = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (brMatch) {
    const [, d, m, y] = brMatch;
    const timeMatch = raw.match(/(\d{2}):(\d{2})/);
    const h = timeMatch ? timeMatch[1] : '09';
    const min = timeMatch ? timeMatch[2] : '00';
    return new Date(`${y}-${m}-${d}T${h}:${min}:00-03:00`);
  }

  return null;
}

function calcHorasRestantes(dataAbertura: Date): number {
  const agora = new Date();
  return Math.max(0, Math.round((dataAbertura.getTime() - agora.getTime()) / (1000 * 60 * 60)));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch all tenders with upcoming deadlines from pncp_editais_cache
    const agora = new Date();
    const em72h = new Date(agora.getTime() + 72 * 60 * 60 * 1000);

    const { data: editaisPncp } = await supabase
      .from("pncp_editais_cache")
      .select("objeto, orgao, valor_total_estimado, uf, municipio, data_abertura_proposta, numero_compra, modalidade_nome, uasg_codigo, fonte, link_comprasnet, link_sistema_origem, situacao, cnpj_orgao")
      .gte("data_abertura_proposta", agora.toISOString())
      .lte("data_abertura_proposta", em72h.toISOString())
      .in("situacao", ["Divulgada no PNCP", "Aberta", "Publicada", "divulgada", "Em andamento", "Suspensa e Reaberta"])
      .limit(500);

    // 2. Fetch from monitoramento_editais with upcoming dates
    const { data: editaisMonit } = await supabase
      .from("monitoramento_editais")
      .select("titulo, orgao, valor_estimado, uf, municipio, data_abertura, numero_processo, modalidade, objeto, codigo_uasg, portal, url_edital")
      .eq("status", "novo")
      .limit(500);

    // 3. Build unified list with urgency classification
    const licitacoesUrgentes: LicitacaoComPrazo[] = [];

    for (const r of (editaisPncp || [])) {
      const dataAb = parseDataAbertura(r.data_abertura_proposta);
      if (!dataAb) continue;
      const horas = calcHorasRestantes(dataAb);
      if (horas > 72) continue;

      const modalidade = r.modalidade_nome || '';
      const numero = r.numero_compra || '';
      
      const urlEdital = r.link_sistema_origem || null;
      const urlPortal = r.link_comprasnet ||
        (r.cnpj_orgao && numero ? `https://pncp.gov.br/app/editais/${r.cnpj_orgao}/${new Date().getFullYear()}/${numero}` : null) ||
        (numero ? `https://pncp.gov.br/app/editais?q=${encodeURIComponent(numero)}` : null);

      licitacoesUrgentes.push({
        numero_processo: modalidade && numero ? `${modalidade} Nº ${numero}` : numero || modalidade,
        orgao: r.orgao || '',
        objeto: r.objeto || '',
        municipio: r.municipio,
        uf: r.uf,
        valor_estimado: r.valor_total_estimado,
        data_abertura: r.data_abertura_proposta || '',
        codigo_uasg: r.uasg_codigo,
        modalidade: modalidade,
        portal: r.link_comprasnet ? 'Compras.gov.br' : 'PNCP',
        horas_restantes: horas,
        urgencia: horas <= 24 ? 'critica' : 'alta',
        fonte: r.fonte || 'pncp',
        url_edital: urlEdital,
        url_portal: urlPortal,
      });
    }

    for (const r of (editaisMonit || [])) {
      const dataAb = parseDataAbertura(r.data_abertura);
      if (!dataAb) continue;
      const horas = calcHorasRestantes(dataAb);
      if (horas > 72 || horas < 0) continue;

      licitacoesUrgentes.push({
        numero_processo: r.numero_processo || r.titulo || '',
        orgao: r.orgao || '',
        objeto: r.objeto || r.titulo || '',
        municipio: r.municipio,
        uf: r.uf,
        valor_estimado: r.valor_estimado,
        data_abertura: r.data_abertura || '',
        codigo_uasg: r.codigo_uasg,
        modalidade: r.modalidade,
        portal: r.portal,
        horas_restantes: horas,
        urgencia: horas <= 24 ? 'critica' : 'alta',
        fonte: 'monitoramento',
        url_edital: r.url_edital || null,
        url_portal: null,
      });
    }

    // Sort: critica first, then by horas_restantes ascending
    licitacoesUrgentes.sort((a, b) => {
      if (a.urgencia !== b.urgencia) return a.urgencia === 'critica' ? -1 : 1;
      return a.horas_restantes - b.horas_restantes;
    });

    if (licitacoesUrgentes.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nenhuma licitação com prazo iminente (72h)", total: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Get all subscribers with boletim_manha enabled (they want to be notified)
    const { data: subscribers } = await supabase
      .from("boletim_preferencias")
      .select("user_id, email, segmentos, ufs_interesse, notificacao_push")
      .eq("boletim_manha", true);

    if (!subscribers || subscribers.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nenhum assinante ativo", total: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = [];

    for (const sub of subscribers) {
      try {
        const ufs = (sub as any).ufs_interesse || [];
        const segmentos = (sub as any).segmentos || [];

        // Filter by subscriber preferences
        let filtered = licitacoesUrgentes.filter(lic => {
          if (ufs.length > 0 && lic.uf && !ufs.includes(lic.uf)) return false;
          if (segmentos.length > 0) {
            const texto = `${lic.objeto} ${lic.numero_processo}`.toLowerCase();
            const SEGMENTO_KEYWORDS: Record<string, string[]> = {
              generos_alimenticios: ['aliment', 'merenda', 'cesta', 'hortifruti', 'refeição', 'refeicao'],
              informatica: ['informática', 'informatica', 'computador', 'notebook', 'software', 'impressora'],
              medicamentos: ['medicament', 'hospitalar', 'saúde', 'saude', 'laboratorial'],
              construcao: ['construção', 'construcao', 'obra', 'engenharia', 'cimento', 'reforma'],
              veiculos: ['veículo', 'veiculo', 'combustível', 'combustivel', 'pneu'],
              higiene_limpeza: ['limpeza', 'higiene', 'desinfetante', 'detergente'],
              material_escritorio: ['escritório', 'escritorio', 'papelaria', 'papel a4'],
              servicos_gerais: ['vigilância', 'vigilancia', 'manutenção predial', 'portaria'],
              servicos_ti: ['serviço de ti', 'suporte técnico', 'cloud', 'consultoria em ti'],
            };
            const match = segmentos.some((seg: string) => {
              const kws = SEGMENTO_KEYWORDS[seg] || [];
              return kws.some(kw => texto.includes(kw));
            });
            if (!match) return false;
          }
          return true;
        });

        // Limit to 10 reminders per subscriber
        filtered = filtered.slice(0, 10);

        if (filtered.length === 0) {
          results.push({ email: sub.email, sent: 0 });
          continue;
        }

        let emailsSent = 0;

        // Get WhatsApp number
        let whatsappNumber: string | null = null;
        if ((sub as any).notificacao_push) {
          const { data: whatsConfig } = await supabase
            .from("whatsapp_config").select("numero_principal").eq("user_id", sub.user_id).single();
          whatsappNumber = whatsConfig?.numero_principal || null;
          if (!whatsappNumber) {
            const { data: profile } = await supabase
              .from("profiles").select("telefone").eq("user_id", sub.user_id).single();
            whatsappNumber = profile?.telefone || null;
          }
        }

        for (const lic of filtered) {
          // Send email
          const templateData = {
            tipo: 'lembrete',
            data: new Date().toLocaleDateString("pt-BR"),
            numero_pregao: lic.numero_processo,
            orgao: lic.orgao,
            codigo_uasg: lic.codigo_uasg || '',
            objeto: lic.objeto,
            municipio: lic.municipio || '',
            uf: lic.uf || '',
            valor_estimado: lic.valor_estimado ? `R$ ${Number(lic.valor_estimado).toLocaleString("pt-BR")}` : '',
            data_abertura: lic.data_abertura,
            modalidade: lic.modalidade || '',
            portal: lic.portal || '',
            url_edital: lic.url_edital || '',
            url_portal: lic.url_portal || '',
            urgencia: lic.urgencia,
            horas_restantes: lic.horas_restantes,
          };

          const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'apikey': supabaseServiceKey,
            },
            body: JSON.stringify({
              templateName: 'boletim-diario',
              recipientEmail: sub.email,
              templateData,
            }),
          });

          if (emailRes.ok) emailsSent++;

          // Send WhatsApp
          if (whatsappNumber) {
            const local = [lic.municipio, lic.uf].filter(Boolean).join('/');
            const urgLabel = lic.urgencia === 'critica'
              ? `URGENTE — Abertura em ${lic.horas_restantes}h`
              : `PRAZO — Abertura em ${lic.horas_restantes}h`;

            const linkEdital = lic.url_edital || lic.url_portal || '';
            const msg = [
              `PRAEFECTUS — LEMBRETE`,
              ``,
              urgLabel,
              ``,
              lic.numero_processo,
              lic.orgao ? `Orgao: ${lic.orgao}` : '',
              lic.objeto ? `Objeto: ${lic.objeto.slice(0, 200)}` : '',
              local ? `Local: ${local}` : '',
              lic.data_abertura ? `Abertura: ${lic.data_abertura}` : '',
              linkEdital ? `Edital: ${linkEdital}` : '',
              ``,
              `Acesse: https://app.praefectus.com.br/monitoramento-editais`,
            ].filter(Boolean).join('\n');

            try {
              await fetch(`${supabaseUrl}/functions/v1/whatsapp-envio`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${supabaseServiceKey}`,
                  'apikey': supabaseServiceKey,
                },
                body: JSON.stringify({
                  telefone: whatsappNumber,
                  setor: 'licitações',
                  user_id: sub.user_id,
                  tipo: 'alerta',
                  mensagem_custom: msg,
                }),
              });
            } catch (e) {
              console.error(`WhatsApp lembrete erro:`, e);
            }
          }
        }

        // Log
        await supabase.from("boletim_envios").insert({
          user_id: sub.user_id,
          tipo: 'lembrete',
          email: sub.email,
          status: emailsSent > 0 ? "enviado" : "erro",
          erro: emailsSent === 0 ? "Nenhum email enviado" : null,
        });

        results.push({ email: sub.email, sent: emailsSent, total: filtered.length });
      } catch (err: any) {
        results.push({ email: sub.email, sent: 0, error: err.message });
      }
    }

    return new Response(
      JSON.stringify({
        message: "Lembretes processados",
        licitacoes_urgentes: licitacoesUrgentes.length,
        criticas: licitacoesUrgentes.filter(l => l.urgencia === 'critica').length,
        altas: licitacoesUrgentes.filter(l => l.urgencia === 'alta').length,
        subscribers: results.length,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Erro no lembrete de prazos:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
