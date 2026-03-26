const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

type IbgeSubclasse = {
  id: string;
  descricao: string;
};

type CnaeItem = {
  codigo: string;
  descricao: string;
};

let cachePromise: Promise<CnaeItem[]> | null = null;

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function normalizeDigits(value: string) {
  return value.replace(/\D/g, '');
}

function formatCnaeCode(value: string) {
  const digits = normalizeDigits(value);

  if (digits.length === 7) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 4)}-${digits.slice(4, 5)}-${digits.slice(5)}`;
  }

  if (digits.length === 5) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 4)}-${digits.slice(4, 5)}`;
  }

  return value;
}

async function loadCnaes() {
  if (!cachePromise) {
    cachePromise = fetch('https://servicodados.ibge.gov.br/api/v2/cnae/subclasses')
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`IBGE respondeu com ${response.status}`);
        }

        const payload = await response.json() as IbgeSubclasse[];
        return payload.map((item) => ({
          codigo: formatCnaeCode(item.id),
          descricao: item.descricao,
        }));
      })
      .catch((error) => {
        cachePromise = null;
        throw error;
      });
  }

  return cachePromise;
}

function scoreResult(item: CnaeItem, query: string) {
  const queryDigits = normalizeDigits(query);
  const itemDigits = normalizeDigits(item.codigo);
  const itemText = normalizeText(`${item.codigo} ${item.descricao}`);
  const queryText = normalizeText(query);

  if (queryDigits && itemDigits === queryDigits) return 100;
  if (queryDigits && itemDigits.startsWith(queryDigits)) return 80;
  if (queryDigits && itemDigits.includes(queryDigits)) return 60;
  if (itemText.startsWith(queryText)) return 40;
  if (normalizeText(item.descricao).includes(queryText)) return 20;
  return 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query = '', limit = 20 } = await req.json().catch(() => ({}));
    const trimmedQuery = String(query).trim();

    if (trimmedQuery.length < 2) {
      return new Response(JSON.stringify({ results: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cnaes = await loadCnaes();
    const maxResults = Math.min(Math.max(Number(limit) || 20, 1), 30);
    const queryDigits = normalizeDigits(trimmedQuery);
    const queryText = normalizeText(trimmedQuery);

    const results = cnaes
      .filter((item) => {
        const itemDigits = normalizeDigits(item.codigo);
        const itemDescription = normalizeText(item.descricao);

        if (queryDigits && itemDigits.includes(queryDigits)) return true;
        return itemDescription.includes(queryText);
      })
      .map((item) => ({ item, score: scoreResult(item, trimmedQuery) }))
      .sort((a, b) => b.score - a.score || a.item.codigo.localeCompare(b.item.codigo))
      .slice(0, maxResults)
      .map(({ item }) => item);

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('buscar-cnae-ibge error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});