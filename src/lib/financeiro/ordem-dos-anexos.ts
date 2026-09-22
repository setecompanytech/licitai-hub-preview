/**
 * A ordem dos anexos de um lançamento: pelo número da nota.
 *
 * Um recebimento que pagou várias notas (a TED de 27/05: seis DANFEs) tem
 * vários anexos. O clipe da linha abria UM deles — o que o mapa guardou por
 * último, o 729 — e quem conferia a TED via uma nota só. Os anexos saem em
 * ordem numérica (725, 726, …), um por número, para virarem um PDF só.
 */
import { numeroDaNota } from './recebimento-da-nota';

export type AnexoOrdenavel = {
  id: string;
  numero: string | null;
  arquivo_nome: string | null;
  storage_path: string;
  created_at?: string | null;
};

/** O número da nota do anexo: o gravado; senão, o primeiro número do nome do arquivo ("NFe N° 000.000.725 …" → 725). */
export function numeroDoAnexo(a: Pick<AnexoOrdenavel, 'numero' | 'arquivo_nome'>): number | null {
  const gravado = numeroDaNota(a.numero);
  if (gravado) return Number(gravado);
  const m = (a.arquivo_nome ?? '').match(/\d[\d.]*\d|\d/);
  if (!m) return null;
  const digitos = m[0].replace(/\D/g, '').replace(/^0+/, '');
  return digitos ? Number(digitos) : null;
}

export function ordenarAnexos<T extends AnexoOrdenavel>(anexos: T[]): T[] {
  return [...anexos].sort((a, b) => {
    const na = numeroDoAnexo(a);
    const nb = numeroDoAnexo(b);
    if (na !== null && nb !== null && na !== nb) return na - nb;
    if (na === null && nb !== null) return 1;
    if (na !== null && nb === null) return -1;
    // Mesmo número: o que tem o número GRAVADO vem antes do inferido pelo nome
    // (é o que a aba Pedidos usa; a cópia sem número é a que sobra).
    const ga = numeroDaNota(a.numero) ? 0 : 1;
    const gb = numeroDaNota(b.numero) ? 0 : 1;
    if (ga !== gb) return ga - gb;
    const porNome = String(a.arquivo_nome ?? '').localeCompare(String(b.arquivo_nome ?? ''), 'pt-BR', { numeric: true });
    if (porNome !== 0) return porNome;
    return String(a.created_at ?? '').localeCompare(String(b.created_at ?? ''));
  });
}

/** Um anexo por número de nota (o primeiro na ordem); os sem número ficam, um por nome de arquivo. */
export function deduplicarAnexos<T extends AnexoOrdenavel>(anexos: T[]): T[] {
  const vistos = new Set<string>();
  const saida: T[] = [];
  for (const a of ordenarAnexos(anexos)) {
    const n = numeroDoAnexo(a);
    const chave = n !== null ? `n:${n}` : `f:${a.arquivo_nome ?? a.id}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    saida.push(a);
  }
  return saida;
}

/** "725, 726, 727" — ou os nomes, quando não há número. */
export function descricaoDaOrdem(anexos: AnexoOrdenavel[]): string {
  return anexos.map((a) => {
    const n = numeroDoAnexo(a);
    return n !== null ? String(n) : (a.arquivo_nome ?? 'documento');
  }).join(', ');
}
