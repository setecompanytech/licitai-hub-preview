import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ success: false, error: 'Chaves não configuradas' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'atualizar_indices';

    // Só o simulador usa IA; os índices agora vêm do SGS e não dependem dela.
    if (action !== 'atualizar_indices' && !openaiKey) {
      return new Response(JSON.stringify({ success: false, error: 'OPENAI_API_KEY não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'atualizar_indices') {
      // ── Fonte OFICIAL: SGS do Banco Central (08/09/2026) ──────────────────
      //
      // Antes os números vinham de IA generativa "com acesso aos dados" — que
      // não tem acesso a dado nenhum e estima. Para painel informativo já era
      // frágil; como base de REQUERIMENTO DE REAJUSTE protocolado no órgão,
      // inaceitável. O SGS é a série oficial, gratuita, sem chave, e cada
      // linha gravada diz a fonte. O acumulado de 12 meses é CALCULADO da
      // série mensal (produto dos fatores), não estimado.
      const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
      const SERIES: Array<{
        sigla: string; nome: string; fonte: string; serie: number;
        categoria: string; tipo: 'variacao' | 'nivel';
      }> = [
        { sigla: 'IPCA', nome: 'Índice Nacional de Preços ao Consumidor Amplo', fonte: 'IBGE · BCB/SGS 433', serie: 433, categoria: 'inflacao', tipo: 'variacao' },
        { sigla: 'INPC', nome: 'Índice Nacional de Preços ao Consumidor', fonte: 'IBGE · BCB/SGS 188', serie: 188, categoria: 'inflacao', tipo: 'variacao' },
        { sigla: 'IGP-M', nome: 'Índice Geral de Preços — Mercado', fonte: 'FGV · BCB/SGS 189', serie: 189, categoria: 'inflacao', tipo: 'variacao' },
        { sigla: 'IGP-DI', nome: 'Índice Geral de Preços — Disponibilidade Interna', fonte: 'FGV · BCB/SGS 190', serie: 190, categoria: 'inflacao', tipo: 'variacao' },
        { sigla: 'INCC-DI', nome: 'Índice Nacional de Custo da Construção — DI', fonte: 'FGV · BCB/SGS 192', serie: 192, categoria: 'construcao', tipo: 'variacao' },
        { sigla: 'IPCA-15', nome: 'IPCA-15 (prévia da inflação)', fonte: 'IBGE · BCB/SGS 7478', serie: 7478, categoria: 'inflacao', tipo: 'variacao' },
        { sigla: 'SELIC', nome: 'Taxa Selic — meta definida pelo Copom (% a.a.)', fonte: 'BCB/SGS 432', serie: 432, categoria: 'juros', tipo: 'nivel' },
        { sigla: 'SALARIO-MINIMO', nome: 'Salário mínimo nacional vigente (R$)', fonte: 'BCB/SGS 1619', serie: 1619, categoria: 'salario', tipo: 'nivel' },
      ];

      const numeroBr = (v: unknown): number | null => {
        // O SGS em JSON usa PONTO decimal ("0.26"); com vírgula só se a fonte
        // mudar o formato. Tratar os dois evita o clássico 0.26 → 26: ponto
        // removido só quando a vírgula é o separador decimal de verdade.
        const s = String(v ?? '').trim();
        const n = s.includes(',')
          ? parseFloat(s.replace(/\./g, '').replace(',', '.'))
          : parseFloat(s);
        return Number.isFinite(n) ? n : null;
      };
      const periodoDe = (dataBr: string): string => {
        const [, m, a] = dataBr.split('/');
        return `${MES[Number(m) - 1]}/${a}`;
      };

      let inserted = 0;
      const erros: string[] = [];
      for (const s of SERIES) {
        try {
          const qtd = s.tipo === 'variacao' ? 14 : 1;
          const r = await fetch(
            `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${s.serie}/dados/ultimos/${qtd}?formato=json`,
            { headers: { Accept: 'application/json' } },
          );
          if (!r.ok) { erros.push(`${s.sigla}: SGS ${r.status}`); continue; }
          const linhas = (await r.json()) as Array<{ data: string; valor: string }>;
          if (!Array.isArray(linhas) || linhas.length === 0) { erros.push(`${s.sigla}: série vazia`); continue; }

          const ultima = linhas[linhas.length - 1];
          const periodo = periodoDe(ultima.data);
          let valor: number | null;
          let variacaoMensal: number | null = null;
          let variacaoAnual: number | null = null;
          let acumulado12m: number | null = null;

          if (s.tipo === 'variacao') {
            const vs = linhas.map((l) => ({ data: l.data, v: numeroBr(l.valor) }))
              .filter((l): l is { data: string; v: number } => l.v != null);
            const doze = vs.slice(-12);
            variacaoMensal = doze[doze.length - 1]?.v ?? null;
            if (doze.length === 12) {
              acumulado12m = (doze.reduce((f, l) => f * (1 + l.v / 100), 1) - 1) * 100;
              acumulado12m = Math.round(acumulado12m * 100) / 100;
            }
            const anoAtual = ultima.data.split('/')[2];
            const noAno = vs.filter((l) => l.data.endsWith(`/${anoAtual}`));
            if (noAno.length > 0) {
              variacaoAnual = (noAno.reduce((f, l) => f * (1 + l.v / 100), 1) - 1) * 100;
              variacaoAnual = Math.round(variacaoAnual * 100) / 100;
            }
            valor = variacaoMensal;
          } else {
            valor = numeroBr(ultima.valor);
          }
          if (valor == null) { erros.push(`${s.sigla}: valor ilegível`); continue; }

          await supabase.from('indices_economicos')
            .delete().eq('sigla', s.sigla).eq('periodo', periodo);
          const { error } = await supabase.from('indices_economicos').insert({
            nome: s.nome,
            sigla: s.sigla,
            fonte: s.fonte,
            periodo,
            valor,
            variacao_mensal: variacaoMensal,
            variacao_anual: variacaoAnual,
            acumulado_12m: acumulado12m,
            categoria: s.categoria,
          });
          if (error) erros.push(`${s.sigla}: ${error.message}`);
          else inserted++;
        } catch (e) {
          erros.push(`${s.sigla}: ${e instanceof Error ? e.message : 'falha'}`);
        }
      }

      // Erros viajam na resposta: cron "succeeded" não prova entrega, e uma
      // série fora do ar não pode sumir em silêncio.
      return new Response(JSON.stringify({ success: inserted > 0, indices_atualizados: inserted, erros }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── Cálculo EXATO do reajuste por números-índices (12/09) ─────────────
    // A fórmula do reajustamento em sentido estrito: fator = produto dos
    // fatores mensais do índice entre o mês seguinte à data-base e o mês da
    // data-alvo (equivale à razão dos números-índices I_alvo / I_base).
    // 100% determinístico, série oficial do SGS — IA NENHUMA nos números:
    // este é o cálculo que embasa requerimento protocolado no órgão.
    if (action === 'calculo_reajuste') {
      const SERIES_CALC: Record<string, { serie: number; fonte: string }> = {
        'IPCA': { serie: 433, fonte: 'IBGE · BCB/SGS 433' },
        'INPC': { serie: 188, fonte: 'IBGE · BCB/SGS 188' },
        'IGP-M': { serie: 189, fonte: 'FGV · BCB/SGS 189' },
        'IGPM': { serie: 189, fonte: 'FGV · BCB/SGS 189' },
        'IGP-DI': { serie: 190, fonte: 'FGV · BCB/SGS 190' },
        'INCC-DI': { serie: 192, fonte: 'FGV · BCB/SGS 192' },
        'INCC': { serie: 192, fonte: 'FGV · BCB/SGS 192' },
      };
      const sigla = String(body.indice || '').trim().toUpperCase();
      const info = SERIES_CALC[sigla];
      if (!info) {
        return new Response(JSON.stringify({
          success: false,
          error: `Índice "${sigla}" sem série mensal mapeada. Disponíveis: ${Object.keys(SERIES_CALC).join(', ')}.`,
        }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const dataBase = String(body.data_base || '').slice(0, 10);
      const dataAlvo = String(body.data_alvo || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dataBase) || !/^\d{4}-\d{2}-\d{2}$/.test(dataAlvo) || dataAlvo <= dataBase) {
        return new Response(JSON.stringify({ success: false, error: 'Datas inválidas: data_base e data_alvo em YYYY-MM-DD, alvo depois da base.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Janela: mês seguinte ao da data-base até o mês da data-alvo.
      const [ab, mb] = dataBase.split('-').map(Number);
      const [aa, ma] = dataAlvo.split('-').map(Number);
      const iniAno = mb === 12 ? ab + 1 : ab;
      const iniMes = mb === 12 ? 1 : mb + 1;
      const p2 = (n: number) => String(n).padStart(2, '0');
      const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${info.serie}/dados?formato=json` +
        `&dataInicial=01/${p2(iniMes)}/${iniAno}&dataFinal=28/${p2(ma)}/${aa}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!res.ok) {
        return new Response(JSON.stringify({ success: false, error: `SGS/BCB indisponível (HTTP ${res.status}) — tente novamente.` }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const serie = await res.json() as Array<{ data: string; valor: string }>;
      const meses: Array<{ competencia: string; variacao: number; fator: number }> = [];
      let fator = 1;
      for (const linha of serie) {
        const v = parseFloat(String(linha.valor).replace(',', '.'));
        if (!Number.isFinite(v)) continue;
        const f = 1 + v / 100;
        fator *= f;
        meses.push({ competencia: linha.data.slice(3), variacao: v, fator: f });
      }
      const mesesEsperados = (aa - iniAno) * 12 + (ma - iniMes) + 1;
      const completo = meses.length >= mesesEsperados;
      return new Response(JSON.stringify({
        success: true,
        indice: sigla,
        fonte: info.fonte,
        data_base: dataBase,
        data_alvo: dataAlvo,
        meses,
        meses_esperados: mesesEsperados,
        completo,
        serie_ate: meses.length ? meses[meses.length - 1].competencia : null,
        fator,
        percentual: (fator - 1) * 100,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'simular_repactuacao') {
      const { valor_original, indice, percentual, data_base_original, data_base_reajuste, tipo_servico } = body;

      const prompt = `Você é um consultor jurídico-financeiro especializado em repactuação de contratos administrativos (Lei 14.133/2021).

Dados do contrato:
- Valor original: R$ ${valor_original}
- Índice de reajuste: ${indice}
- Percentual de reajuste solicitado: ${percentual}%
- Data-base original: ${data_base_original}
- Data-base reajuste: ${data_base_reajuste}
- Tipo de serviço: ${tipo_servico}

Calcule:
1. O valor reajustado aplicando o percentual
2. Verifique se o índice e percentual são compatíveis com os dados oficiais
3. Fundamente juridicamente com base na Lei 14.133/2021 e jurisprudência do TCU

Retorne JSON com:
- valor_reajustado (numeric)
- diferenca (numeric)
- fundamentacao (texto jurídico completo com artigos de lei e acórdãos)
- parecer (texto de parecer técnico sobre a viabilidade do reajuste)
- alertas (array de strings com pontos de atenção)
- indice_oficial_periodo (valor oficial do índice no período se disponível)`;

      const aiResp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'Retorne apenas JSON válido.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.2,
          max_tokens: 4000,
        }),
      });

      if (!aiResp.ok) throw new Error(`AI error ${aiResp.status}`);
      const aiData = await aiResp.json();
      let content = aiData.choices?.[0]?.message?.content || '';
      content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('JSON não encontrado');

      return new Response(JSON.stringify({ success: true, data: JSON.parse(jsonMatch[0]) }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: false, error: 'Ação não reconhecida' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
