import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableKey = Deno.env.get('LOVABLE_API_KEY');
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Validate JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { edital_texto, licitacao_id } = await req.json();

    if (!edital_texto || edital_texto.trim().length < 50) {
      return new Response(JSON.stringify({ error: 'Texto do edital insuficiente para análise' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!lovableKey) {
      return new Response(JSON.stringify({ error: 'Chave de IA não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 1. Ask AI to extract required documents from the edital
    const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
            content: `Você é um especialista em licitações brasileiras (Lei 14.133/2021). Analise o texto do edital e extraia TODOS os documentos exigidos para habilitação e participação. Classifique cada um.`,
          },
          {
            role: 'user',
            content: `Analise o edital abaixo e extraia todos os documentos exigidos para habilitação. Retorne um JSON com a estrutura:
{
  "documentos_exigidos": [
    {
      "nome": "Nome do documento",
      "categoria": "Habilitação Jurídica|Regularidade Fiscal|Qualificação Técnica|Qualif. Econômico-Financeira|Declarações|Proposta|Outros",
      "artigo_referencia": "Artigo da lei ou item do edital",
      "obrigatorio": true,
      "observacao": "Detalhes específicos se houver"
    }
  ],
  "prazo_entrega_docs": "Data ou prazo mencionado no edital, se houver",
  "forma_apresentacao": "Eletrônica, física, ou ambas"
}

EDITAL:
${edital_texto.slice(0, 30000)}`,
          },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extrair_documentos_edital',
              description: 'Retorna lista de documentos exigidos pelo edital',
              parameters: {
                type: 'object',
                properties: {
                  documentos_exigidos: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        nome: { type: 'string' },
                        categoria: { type: 'string', enum: ['Habilitação Jurídica', 'Regularidade Fiscal', 'Qualificação Técnica', 'Qualif. Econômico-Financeira', 'Declarações', 'Proposta', 'Outros'] },
                        artigo_referencia: { type: 'string' },
                        obrigatorio: { type: 'boolean' },
                        observacao: { type: 'string' },
                      },
                      required: ['nome', 'categoria', 'obrigatorio'],
                    },
                  },
                  prazo_entrega_docs: { type: 'string' },
                  forma_apresentacao: { type: 'string' },
                },
                required: ['documentos_exigidos'],
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'extrair_documentos_edital' } },
      }),
    });

    if (!aiResp.ok) {
      const status = aiResp.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns minutos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: 'Créditos de IA insuficientes.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await aiResp.json();
    let exigidos: any = { documentos_exigidos: [] };

    // Parse tool call response
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        exigidos = JSON.parse(toolCall.function.arguments);
      } catch {
        // Fallback: try content
        const content = aiData.choices?.[0]?.message?.content || '';
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) exigidos = JSON.parse(jsonMatch[0]);
      }
    } else {
      // Fallback: parse content
      const content = aiData.choices?.[0]?.message?.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) exigidos = JSON.parse(jsonMatch[0]);
    }

    // 2. Fetch user's existing documents from both sources
    const [docsProcesso, docsHabilitacao] = await Promise.all([
      // Documents attached to the licitacao process
      licitacao_id
        ? supabase
            .from('documentos')
            .select('id, nome, categoria, arquivo_path, created_at')
            .eq('licitacao_id', licitacao_id)
            .eq('user_id', user.id)
        : Promise.resolve({ data: [], error: null }),
      // Company habilitação documents (agent_documentos)
      supabase
        .from('agent_documentos')
        .select('id, tipo, status, arquivo_url, validade')
        .not('status', 'eq', 'faltante'),
    ]);

    const existingDocs = [
      ...(docsProcesso.data || []).map((d: any) => ({
        id: d.id,
        nome: d.nome,
        categoria: d.categoria || 'Geral',
        arquivo_path: d.arquivo_path,
        source: 'documentos' as const,
        status: 'ok',
      })),
      ...(docsHabilitacao.data || []).map((d: any) => ({
        id: d.id,
        nome: d.tipo,
        categoria: 'Habilitação',
        arquivo_path: d.arquivo_url,
        source: 'agent_documentos' as const,
        status: d.status,
        validade: d.validade,
      })),
    ];

    // 3. Cross-reference: match required docs with existing docs
    const resultados = (exigidos.documentos_exigidos || []).map((exigido: any) => {
      const nomeNorm = (exigido.nome || '').toLowerCase().trim();

      // Fuzzy match: check if any existing doc name is similar
      const match = existingDocs.find((doc) => {
        const docNorm = (doc.nome || '').toLowerCase().trim();
        // Direct substring match
        if (docNorm.includes(nomeNorm.slice(0, 15)) || nomeNorm.includes(docNorm.slice(0, 15))) return true;
        // Keyword match
        const keywords = nomeNorm.split(/\s+/).filter((w: string) => w.length > 3);
        const matchCount = keywords.filter((kw: string) => docNorm.includes(kw)).length;
        return keywords.length > 0 && matchCount >= Math.ceil(keywords.length * 0.5);
      });

      return {
        ...exigido,
        encontrado: !!match,
        documento_match: match || null,
      };
    });

    const encontrados = resultados.filter((r: any) => r.encontrado);
    const faltantes = resultados.filter((r: any) => !r.encontrado);

    // 4. Build list of downloadable files (storage paths)
    const arquivosParaZip = encontrados
      .filter((r: any) => r.documento_match?.arquivo_path)
      .map((r: any) => ({
        nome_exigido: r.nome,
        arquivo_path: r.documento_match.arquivo_path,
        source: r.documento_match.source,
        doc_id: r.documento_match.id,
      }));

    // 5. Generate signed URLs for found files
    const signedUrls: any[] = [];
    for (const arq of arquivosParaZip) {
      const bucket = arq.source === 'documentos' ? 'documentos' : 'documentos-habilitacao';
      if (arq.arquivo_path) {
        const { data: signedData } = await supabase.storage
          .from(bucket)
          .createSignedUrl(arq.arquivo_path, 3600); // 1 hour
        if (signedData?.signedUrl) {
          signedUrls.push({
            nome: arq.nome_exigido,
            url: signedData.signedUrl,
            path: arq.arquivo_path,
          });
        }
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      total_exigidos: resultados.length,
      total_encontrados: encontrados.length,
      total_faltantes: faltantes.length,
      prazo_entrega: exigidos.prazo_entrega_docs || null,
      forma_apresentacao: exigidos.forma_apresentacao || null,
      documentos: resultados,
      arquivos_download: signedUrls,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('verificar-documentos-edital error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
