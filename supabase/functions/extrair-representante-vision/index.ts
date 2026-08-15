/** Valida CPF pelos dígitos verificadores — leitura visual de número pode
 * alucinar; o que não fecha a conta não entra no cadastro. */
function cpfValido(cpf: string): boolean {
  const d = (cpf || '').replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (n: number) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += parseInt(d[i]) * (n + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === parseInt(d[9]) && dv(10) === parseInt(d[10]);
}

const formatarCpf = (d: string) => `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SYSTEM_PROMPT = `Você é um extrator técnico de dados cadastrais brasileiros. Analise o documento enviado (imagens e, quando disponível, texto OCR de apoio) e extraia os dados do representante legal.

DOCUMENTOS POSSÍVEIS:
- CNH, RG, CPF, procuração, contrato social, ato constitutivo.

FORMATO DE SAÍDA — retorne APENAS este JSON puro (sem markdown, sem crases, sem texto extra):
{
  "repNome": "",
  "repCpf": "",
  "repRg": "",
  "repOrgaoExp": "",
  "repCargo": "",
  "repNaturalidade": "",
  "repNacionalidade": ""
}

MAPA DE CAMPOS DA CNH (siga à risca — os rótulos numerados são padronizados):
- Campo "2e1 NOME E SOBRENOME" → repNome.
- Campo "4d CPF" → repCpf (normalize para 000.000.000-00). Copie DÍGITO A
  DÍGITO o que está impresso; se qualquer dígito estiver ilegível, retorne ""
  — NUNCA reconstrua ou aproxime números.
- Campo "4c DOC IDENTIDADE / ÓRG EMISSOR / UF" (ex: "6142740 MTE PA") → a parte
  numérica é o repRg ("6142740") e o órgão + UF é o repOrgaoExp no formato
  ÓRGÃO/UF ("MTE/PA").
- Campo "3 DATA, LOCAL E UF DE NASCIMENTO" (ex: "20/12/1993, BELEM, PA") → a
  cidade e UF são a repNaturalidade no formato Cidade/UF ("Belém/PA").
- Campo "NACIONALIDADE" (ex: "BRASILEIRO(A)") → repNacionalidade ("Brasileira").
- NUNCA use como RG: "5 Nº REGISTRO", RENACH, número do espelho, código de
  segurança ou o número vertical da lateral.

REGRAS CRÍTICAS:
- Campo não identificado com segurança = "".
- Preserve a grafia original, incluindo acentos.
- CPF: normalize para 000.000.000-00 se visível.
- Em RG (cédula de identidade): o número do registro geral → repRg; órgão
  expedidor/UF → repOrgaoExp; naturalidade → repNaturalidade.
- repCargo: preencha SOMENTE se indicar vínculo societário ou função empresarial; em documento pessoal isolado, deixe "".
- repNaturalidade e repNacionalidade: preencha SOMENTE se visíveis no documento.
- Se houver múltiplas pessoas, escolha o representante legal, sócio-administrador ou titular principal.
- Valores genéricos de formulário como "000.000.000-00", "Número do RG", "SSP/XX", "Cidade/UF" e "Nome completo do representante" NÃO são dados válidos; se houver apenas esse tipo de exemplo/placeholder, retorne "".
- Se houver imagem e texto OCR, use o texto apenas como apoio e priorize o que estiver consistente com o documento.
- NUNCA invente dados. NUNCA transfira valores de um campo para outro. NUNCA complete por contexto.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY não configurada.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { fileName = 'documento', images = [], text = '' } = await req.json();

    // Build message content parts
    const contentParts: any[] = [];

    // If we have images, send them directly for vision analysis
    const sanitizedImages = (Array.isArray(images) ? images : [])
      .filter((img: any) => typeof img?.dataUrl === 'string' && img.dataUrl.startsWith('data:image/'))
      .slice(0, 5);

    const validImages = sanitizedImages.filter((img: any) => (img.dataUrl?.length || 0) <= 5_500_000);
    const hasSupportText = typeof text === 'string' && text.trim().length > 10;

    if (validImages.length > 0) {
      contentParts.push({
        type: 'text',
        text: `Arquivo: ${fileName}. Analise a(s) imagem(ns) do documento e extraia os dados do representante legal. Retorne APENAS o JSON.`,
      });

      for (const img of validImages) {
        contentParts.push({
          type: 'image_url',
          // detail high: documento de identidade tem campos pequenos (órgão
          // expedidor, RG) que somem na resolução automática.
          image_url: { url: img.dataUrl, detail: 'high' },
        });
      }
    }

    if (hasSupportText) {
      contentParts.push({
        type: 'text',
        text: `Arquivo: ${fileName}\n\nTEXTO OCR DE APOIO (pode conter ruído; confirme nas imagens sempre que possível):\n${text.slice(0, 12000)}\n\nExtraia os dados do representante legal. Retorne APENAS o JSON.`,
      });
    }

    // Falha silenciosa é proibida: se chegaram imagens mas TODAS estouraram o
    // limite, dizer isso — antes a extração seguia só com texto de apoio e
    // devolvia campos vazios sem explicar o porquê.
    if (sanitizedImages.length > 0 && validImages.length === 0 && !hasSupportText) {
      return new Response(JSON.stringify({ error: 'Imagem grande demais para leitura. Envie uma foto menor (ou o app recomprime automaticamente na próxima tentativa).' }), {
        status: 413,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (contentParts.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhuma imagem ou texto válido enviado.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // DUAS leituras independentes (autoconsistência): dígito alucinado não se
    // repete igual duas vezes — só entra no cadastro o campo em que as duas
    // passadas concordam. Checksum não basta: um CPF inventado pode fechar a
    // conta por acaso.
    const chamarVisao = async (): Promise<Record<string, string> | null> => {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o',
          temperature: 0.2,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: contentParts },
          ],
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        const status = r.status;
        console.error('extrair-representante-vision error:', status, d);
        throw Object.assign(new Error('vision_error'), { status });
      }
      const raw = d?.choices?.[0]?.message?.content || '';
      const txt = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw.map((p: any) => p?.text || '').join('') : '';
      try { return JSON.parse(txt.replace(/```json|```/g, '').trim()); } catch { return null; }
    };

    let passadas: Array<Record<string, string> | null>;
    try {
      passadas = await Promise.all([chamarVisao(), chamarVisao()]);
    } catch (e: any) {
      if (e?.status === 429) {
        return new Response(JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns instantes.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (e?.status === 402) {
        return new Response(JSON.stringify({ error: 'Créditos de IA insuficientes.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'Falha ao processar documento.' }), {
        status: e?.status || 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const [a, b] = passadas;
    const CAMPOS = ['repNome', 'repCpf', 'repRg', 'repOrgaoExp', 'repCargo', 'repNaturalidade', 'repNacionalidade'];
    const NUMERICOS = new Set(['repCpf', 'repRg']);
    const consenso: Record<string, string> = {};
    for (const campo of CAMPOS) {
      const va = String(a?.[campo] ?? '').trim();
      const vb = String(b?.[campo] ?? '').trim();
      const na = NUMERICOS.has(campo) ? va.replace(/\D/g, '') : va.toLowerCase().replace(/\s+/g, ' ');
      const nb = NUMERICOS.has(campo) ? vb.replace(/\D/g, '') : vb.toLowerCase().replace(/\s+/g, ' ');
      if (va && vb && na === nb) {
        consenso[campo] = va;
      } else if (va && !vb) {
        // uma passada leu, a outra absteve: em campo de TEXTO aceita; em campo
        // NUMÉRICO (CPF/RG) a divergência é suspeita — fica vazio.
        consenso[campo] = NUMERICOS.has(campo) ? '' : va;
      } else if (vb && !va) {
        consenso[campo] = NUMERICOS.has(campo) ? '' : vb;
      } else {
        if (va && vb) console.log(`[representante-vision] divergência em ${campo}: "${va}" x "${vb}" — descartado`);
        consenso[campo] = '';
      }
    }
    let textContent = JSON.stringify(consenso);

    // Pós-validação do CPF: a visão pode alucinar dígitos. Duas defesas:
    // 1) a camada de texto do PDF (CNH-e tem o CPF real como texto) é fonte
    //    determinística — havendo exatamente UM CPF válido nela, ele manda;
    // 2) CPF lido que não fecha os dígitos verificadores vira "" — o sistema
    //    não afirma número que não passa na conta.
    try {
      const parsed = JSON.parse(textContent.replace(/```json|```/g, '').trim());
      if (parsed && typeof parsed === 'object') {
        const candidatos = [...new Set(
          (String(text || '').match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g) || [])
            .map((c: string) => c.replace(/\D/g, ''))
            .filter(cpfValido),
        )];
        const lido = String(parsed.repCpf || '').replace(/\D/g, '');
        if (candidatos.length === 1 && lido !== candidatos[0]) {
          console.log(`[representante-vision] CPF corrigido pela camada de texto: visão="${lido}" texto="${candidatos[0]}"`);
          parsed.repCpf = formatarCpf(candidatos[0]);
        } else if (lido && !cpfValido(lido)) {
          console.log(`[representante-vision] CPF lido inválido (dígitos verificadores): "${lido}" — descartado`);
          parsed.repCpf = '';
        }
        textContent = JSON.stringify(parsed);
      }
    } catch { /* resposta fora do formato — segue como veio */ }

    return new Response(JSON.stringify({ result: textContent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('extrair-representante-vision fatal:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno.' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});