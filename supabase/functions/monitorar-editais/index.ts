import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Get all active preferences with receber_editais = true
    const { data: prefs, error: prefsErr } = await supabase
      .from("preferencias_alertas")
      .select("*")
      .eq("ativo", true)
      .eq("receber_editais", true);

    if (prefsErr) throw prefsErr;
    if (!prefs || prefs.length === 0) {
      return new Response(JSON.stringify({ message: "No active preferences", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. Collect unique UFs from all preferences
    const allUfs = [...new Set(prefs.flatMap(p => p.ufs || []))];
    const ufsToQuery = allUfs.length > 0 ? allUfs : ['PA']; // Default to PA if none set

    const hoje = new Date();
    const ontem = new Date(hoje);
    ontem.setDate(ontem.getDate() - 1);
    const dataInicial = ontem.toISOString().split('T')[0];
    const dataFinal = hoje.toISOString().split('T')[0];

    let totalProcessed = 0;
    let totalAlertas = 0;

    // 3. Query PNCP API for each UF
    for (const uf of ufsToQuery) {
      try {
        const url = `https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?dataInicial=${dataInicial}&dataFinal=${dataFinal}&pagina=1&tamanhoPagina=50&uf=${uf}`;
        const res = await fetch(url, {
          headers: { 'Accept': 'application/json' },
        });

        if (!res.ok) {
          console.warn(`PNCP API error for UF ${uf}: ${res.status}`);
          continue;
        }

        const data = await res.json();
        const editais = data?.data || data || [];
        if (!Array.isArray(editais)) continue;

        for (const edital of editais.slice(0, 50)) {
          const titulo = edital.objetoCompra || edital.objeto || edital.description || '';
          const orgao = edital.orgaoEntidade?.razaoSocial || edital.nomeOrgao || edital.orgao || '';
          const numero = edital.numeroCompra || edital.numero || '';
          const processo = edital.processo || edital.numeroProcesso || '';
          const valor = edital.valorTotalEstimado || edital.valorEstimado || null;
          const dataAbertura = edital.dataAberturaProposta || edital.dataAberturaEdital || null;
          const urlEdital = edital.linkSistemaOrigem || (numero ? `https://pncp.gov.br/app/editais/${numero}` : null);
          const tituloLower = titulo.toLowerCase();

          // Check if already processed
          const idUnico = `pncp-${numero || processo}-${uf}`;
          const { data: existing } = await supabase
            .from("publicacoes_dou_processadas")
            .select("id")
            .eq("identificador", idUnico)
            .maybeSingle();

          if (existing) continue;

          // Match against each user's preferences
          for (const pref of prefs) {
            const prefUfs = pref.ufs || [];
            const prefSegmentos = pref.segmentos || [];

            // UF filter
            if (prefUfs.length > 0 && !prefUfs.includes(uf)) continue;

            // Segment filter using keyword matching
            if (prefSegmentos.length > 0) {
              const matched = prefSegmentos.some((seg: string) => {
                return matchSegment(seg, tituloLower);
              });
              if (!matched) continue;
            }

            // Create alert
            await supabase.from("alertas_gerados").insert({
              user_id: pref.user_id,
              tipo: 'novo_edital',
              titulo: titulo.slice(0, 200),
              descricao: `${orgao} — ${titulo}`,
              orgao,
              uf,
              segmento: prefSegmentos.find((s: string) => matchSegment(s, tituloLower)) || null,
              numero_processo: processo || null,
              numero_pregao: numero || null,
              valor_estimado: valor,
              data_abertura: dataAbertura,
              url_edital: urlEdital,
              fonte: 'PNCP',
              urgente: false,
            });
            totalAlertas++;
          }

          // Mark as processed
          await supabase.from("publicacoes_dou_processadas").insert({
            identificador: idUnico,
            tipo_publicacao: 'edital',
            data_publicacao: dataFinal,
            orgao,
          });

          totalProcessed++;
        }
      } catch (err) {
        console.error(`Error processing UF ${uf}:`, err);
      }
    }

    return new Response(
      JSON.stringify({ processed: totalProcessed, alerts_created: totalAlertas }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

// Segment matching keywords
const SEGMENT_KEYWORDS: Record<string, string[]> = {
  'ALI-001': ['perecív', 'carne', 'laticínio', 'fruta', 'verdura', 'legume', 'hortifruti', 'frio'],
  'ALI-002': ['não perecív', 'enlatado', 'grão', 'farinha', 'conserva', 'tempero', 'aliment'],
  'ALI-003': ['cesta básica', 'cesta basica', 'kit aliment'],
  'ALI-004': ['merenda', 'pnae', 'alimentação escolar'],
  'ALI-005': ['água mineral', 'agua mineral', 'bebida', 'suco', 'café'],
  'ALI-006': ['refeição', 'refeicao', 'restaurante', 'buffet', 'fornecimento de alimentação'],
  'TI-001': ['computador', 'notebook', 'servidor', 'monitor', 'equipamento de informática'],
  'TI-002': ['cartucho', 'toner', 'suprimento de informática', 'periférico'],
  'TI-003': ['software', 'licença', 'sistema operacional', 'erp'],
  'TI-004': ['serviço de ti', 'desenvolvimento de sistema', 'suporte técnico'],
  'TI-005': ['switch', 'roteador', 'cabeamento', 'rede', 'infraestrutura de rede'],
  'LIM-001': ['limpeza', 'detergente', 'desinfetante', 'álcool', 'material de limpeza'],
  'LIM-002': ['higiene pessoal', 'sabonete', 'papel higiênico', 'toalha'],
  'LIM-003': ['descartáv', 'copo descart', 'prato descart'],
  'LIM-004': ['serviço de limpeza', 'conservação', 'terceirização de limpeza'],
  'ESC-001': ['escritório', 'papelaria', 'papel a4', 'caneta', 'envelope'],
  'ESC-002': ['mobiliário', 'cadeira', 'mesa', 'armário', 'estante'],
  'MED-001': ['medicament', 'farmac', 'seringa', 'soro', 'curativo', 'insumo hospitalar'],
  'MED-002': ['equipamento médico', 'equipamento hospitalar', 'aparelho médico'],
  'MED-003': ['serviço de saúde', 'exame', 'consulta', 'terceirização hospitalar'],
  'OBR-001': ['obra', 'reforma', 'construção', 'adequação'],
  'OBR-002': ['cimento', 'tinta', 'tijolo', 'material de construção', 'elétric', 'hidráulic'],
  'OBR-003': ['serviço de engenharia', 'projeto', 'fiscalização de obra'],
  'VEI-001': ['veículo', 'veiculo', 'locação de veículo', 'automóvel', 'ônibus', 'van'],
  'VEI-002': ['autopeça', 'pneu', 'manutenção veicular', 'mecânic'],
  'COM-001': ['combustível', 'combustivel', 'gasolina', 'diesel', 'lubrificante'],
  'UNI-001': ['uniforme', 'fardamento', 'epi', 'equipamento de proteção', 'calçado'],
  'GRA-001': ['gráfica', 'grafica', 'impressão', 'impressao', 'banner'],
  'EVE-001': ['evento', 'auditório', 'tenda', 'audiovisual', 'locação de espaço'],
  'SEG-001': ['vigilância', 'vigilancia', 'segurança', 'monitoramento eletrônico'],
};

function matchSegment(segCodigo: string, texto: string): boolean {
  const keywords = SEGMENT_KEYWORDS[segCodigo] || [];
  return keywords.some(kw => texto.includes(kw.toLowerCase()));
}
