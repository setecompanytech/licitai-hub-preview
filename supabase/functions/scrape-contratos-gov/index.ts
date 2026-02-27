const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ano, tipo } = await req.json();
    const lovableKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Chave de IA não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const targetYear = ano || new Date().getFullYear();
    const targetType = tipo || 'arp';
    console.log(`Extraindo dados de Contratos.gov.br via IA - tipo: ${targetType}, ano: ${targetYear}`);

    const typeLabel = targetType === 'arp' ? 'Atas de Registro de Preços' : targetType === 'contrato' ? 'Contratos' : 'Compras';

    const prompt = `Com base em dados públicos do portal Contratos.gov.br (https://contratos.sistema.gov.br/transparencia), forneça os principais órgãos do Governo Federal que mais possuem ${typeLabel} registrados/vigentes no ano de ${targetYear}.

Inclua os principais órgãos federais como:
- Ministério da Saúde
- Ministério da Educação
- Ministério da Defesa (Exército, Marinha, Aeronáutica)
- Ministério da Justiça e Segurança Pública
- Ministério da Infraestrutura / Transportes
- Ministério da Economia / Fazenda / Gestão
- INSS - Instituto Nacional do Seguro Social
- IBGE - Instituto Brasileiro de Geografia e Estatística
- FUNAI - Fundação Nacional dos Povos Indígenas
- ICMBio - Instituto Chico Mendes
- IBAMA
- Polícia Federal
- Polícia Rodoviária Federal
- DNIT - Departamento Nacional de Infraestrutura de Transportes
- INPE - Instituto Nacional de Pesquisas Espaciais
- FIOCRUZ
- Universidades Federais (UFPA, UFMG, UFRJ, UnB, UFPR, etc.)
- Institutos Federais de Educação
- Hospitais Universitários
- CAIXA Econômica Federal
- Banco do Brasil
- Correios
- ANATEL, ANVISA, ANS, ANEEL, ANP

REGRAS:
- Retorne APENAS um JSON válido, sem markdown code blocks, sem texto adicional
- Formato: [{"orgao": "Nome do Órgão (SIGLA)", "valor": 1234567890.00, "quantidade": 150, "modalidade": "Pregão Eletrônico", "descricao": "Breve descrição dos principais objetos contratados", "situacao": "vigente"}]
- "valor" = valor total estimado em reais das ${typeLabel} no ano ${targetYear}
- "quantidade" = número estimado de ${typeLabel}
- "modalidade" = modalidade predominante (Pregão Eletrônico, Concorrência, Dispensa, etc.)
- "descricao" = principais objetos contratados pelo órgão
- "situacao" = vigente, encerrado ou cancelado (maioria vigente)
- Valores realistas baseados no orçamento federal (LOA ${targetYear})
- Ordene do maior para o menor valor
- Inclua pelo menos 25 órgãos
- Valores numéricos, sem formatação`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'Você é um especialista em compras públicas e contratos do Governo Federal brasileiro. Responda APENAS com JSON válido. Sem markdown, sem explicações, apenas o array JSON.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 6000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('AI gateway error:', response.status, errText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Limite de requisições excedido. Tente novamente em alguns minutos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'Créditos insuficientes. Adicione créditos ao workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: false, error: 'Erro no serviço de IA' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || '';

    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('No JSON found in AI response:', content.substring(0, 200));
      return new Response(
        JSON.stringify({ success: false, error: 'IA não retornou dados estruturados' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const contratos = parsed
      .filter((item: any) => item.orgao && Number(item.valor) > 0)
      .map((item: any) => ({
        orgao: String(item.orgao).trim(),
        valor: Number(item.valor),
        quantidade: Number(item.quantidade) || 1,
        modalidade: String(item.modalidade || 'Pregão Eletrônico').trim(),
        descricao: String(item.descricao || '').trim(),
        situacao: String(item.situacao || 'vigente').trim(),
      }))
      .sort((a: any, b: any) => b.valor - a.valor);

    console.log(`IA extraiu ${contratos.length} órgãos (${targetType}) para ${targetYear}`);

    return new Response(
      JSON.stringify({ success: true, data: contratos, source: 'ai-knowledge' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao processar',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
