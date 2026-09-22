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

/**
 * O número da NOTA escrito no nome do arquivo — só quando o nome diz que é
 * nota: "NFe N° 000.000.725 - SEDUC.pdf", "NF-e_725", "DANFE 725", "nfe725",
 * "Nota Fiscal 725", a chave de acesso de 44 dígitos (o número está nas
 * posições 26 a 34) ou um nome que é só o número ("000000725.pdf").
 *
 * "comprovante-27-05.pdf" NÃO tem número de nota: o primeiro número que
 * aparece num nome qualquer virava número gravado, e a aba Pedidos — que acha
 * a DANFE pelo número — ligaria o comprovante da TED ao pedido 27.
 */
export function numeroDaNotaNoNome(nome: string | null | undefined): number | null {
  // Só extensão de verdade (começa por letra): "NFe 000.000.728" sem extensão não perde o ".728".
  const semExtensao = String(nome ?? '').replace(/\.[a-z][a-z0-9]{0,4}$/i, '');
  if (!semExtensao) return null;
  const chave = semExtensao.match(/(?<!\d)\d{44}(?!\d)/);
  if (chave) return Number(chave[0].slice(25, 34)) || null;
  const rotulo = semExtensao.match(/(?:^|[^a-z])(?:danfe|nfs-?e|nf-?e|nf|nota(?:[\s_-]*fiscal)?)[\s_-]*(?:n[º°o.]?|n[uú]mero)?[\s_\-:.#]*(\d[\d.]*)/i);
  if (rotulo) {
    const digitos = rotulo[1].replace(/\D/g, '').replace(/^0+/, '');
    return digitos ? Number(digitos) : null;
  }
  if (/^[\d._\s-]+$/.test(semExtensao)) {
    const digitos = semExtensao.replace(/\D/g, '').replace(/^0+/, '');
    // Até nove dígitos (o nNF da NF-e) e nada com cara de data ("20260527").
    if (digitos && digitos.length <= 9 && !/^(19|20)\d{6}$/.test(digitos)) return Number(digitos);
  }
  return null;
}

/** O número da nota do anexo: o gravado; senão, o que o nome do arquivo diz ("NFe N° 000.000.725 …" → 725). */
export function numeroDoAnexo(a: Pick<AnexoOrdenavel, 'numero' | 'arquivo_nome'>): number | null {
  const gravado = numeroDaNota(a.numero);
  if (gravado) return Number(gravado);
  return numeroDaNotaNoNome(a.arquivo_nome);
}

/**
 * O número a GRAVAR num documento que se anexa a um lançamento (22/09):
 *
 * 1. o nome do arquivo diz qual nota é → esse número, sempre. A TED de 27/05
 *    tinha "727" como número do título e carimbou três DANFEs 728 como 727 —
 *    e o PDF único, que junta um anexo por número, mostrava cinco notas;
 * 2. o nome não diz → o número do lançamento, quando ele é de UMA nota;
 * 3. lançamento rateado (várias notas) sem número no nome → sem número. O
 *    comprovante da TED não é a nota 727.
 */
export function numeroParaGuardar(dados: {
  nomeDoArquivo: string | null | undefined;
  numeroDoLancamento?: string | null;
  rateado?: boolean;
}): string | null {
  const daNota = numeroDaNotaNoNome(dados.nomeDoArquivo);
  if (daNota !== null) return String(daNota);
  if (dados.rateado) return null;
  const doLancamento = String(dados.numeroDoLancamento ?? '').trim();
  return doLancamento || null;
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
