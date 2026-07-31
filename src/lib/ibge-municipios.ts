import { REGIOES_ESTADOS } from '@/data/regioes-brasil';

export interface IBGEMunicipio {
  id: number;
  nome: string;
  uf: string;
}

type IBGEApiMunicipio = { id: number; nome: string };
type BrasilApiMunicipio = { nome: string; codigo_ibge: string };

/** UFs do Brasil (sigla + nome), ordenadas por nome. */
export const UFS_BRASIL: { uf: string; nome: string }[] = Object.values(REGIOES_ESTADOS)
  .flatMap((r) => r.estados.map((e) => ({ uf: e.uf, nome: e.nome })))
  .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

// Cache em memória durante a sessão
const cache = new Map<string, IBGEMunicipio[]>();

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

/**
 * Municípios de uma UF, com cache de sessão e três fontes em cascata:
 * Edge Function (proxy resiliente com cache) → IBGE direto → BrasilAPI.
 */
export async function fetchMunicipiosUF(uf: string): Promise<IBGEMunicipio[]> {
  if (cache.has(uf)) return cache.get(uf)!;

  // 1) Proxy via Edge Function (resiliente: IBGE → BrasilAPI no servidor + cache)
  try {
    const r = await fetch(
      `${SUPABASE_URL}/functions/v1/ibge-municipios?uf=${uf}`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } },
    );
    if (r.ok) {
      const json = await r.json();
      if (Array.isArray(json?.municipios) && json.municipios.length) {
        cache.set(uf, json.municipios);
        return json.municipios;
      }
    }
  } catch (_) {
    /* segue fallback */
  }

  // 2) Fallback direto IBGE
  try {
    const r = await fetch(
      `https://servicosdados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`,
    );
    if (r.ok) {
      const data: IBGEApiMunicipio[] = await r.json();
      const list = data.map((m) => ({ id: m.id, nome: m.nome, uf }));
      list.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      cache.set(uf, list);
      return list;
    }
  } catch (_) {
    /* segue fallback */
  }

  // 3) Fallback BrasilAPI direto
  const r2 = await fetch(`https://brasilapi.com.br/api/ibge/municipios/v1/${uf}`);
  if (!r2.ok) throw new Error(`Não foi possível carregar municípios de ${uf}`);
  const data2: BrasilApiMunicipio[] = await r2.json();
  const list = data2.map((m) => ({ id: Number(m.codigo_ibge), nome: m.nome, uf }));
  list.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  cache.set(uf, list);
  return list;
}
