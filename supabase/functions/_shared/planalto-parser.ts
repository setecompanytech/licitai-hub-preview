/**
 * Leitor do texto compilado do Planalto (27/09/2026).
 *
 * As páginas de lei do Planalto (windows-1252) trazem uma âncora por
 * artigo, parágrafo e inciso (`<a name="art92">`, `art92§3`, `art92i`) e
 * marcam o texto revogado com `<strike>`. O leitor:
 *   1) apaga o revogado (texto vigente é o que vale);
 *   2) trata quebra de linha do HTML como espaço ("Art. \r\n\t92." é
 *      "Art. 92.") e `</p>` como parágrafo;
 *   3) reconhece artigo pela âncora E pelo conteúdo ("Art. N"): âncora de
 *      inciso (`art92i`) não é artigo.
 * Puro (sem Deno): o front o testa com o vitest.
 * Conferido em 27/09 na Lei 14.133/2021: 195 artigos (1 a 194 + 44-A e
 * 184-A), art. 92, § 3º, e art. 136, I, literais.
 */
export type ArtigoDoPlanalto = { numero: string; texto: string };

const ENTIDADES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ordm: 'º', ordf: 'ª', sect: '§', ndash: '–', mdash: '—', ldquo: '“', rdquo: '”',
  aacute: 'á', agrave: 'à', atilde: 'ã', acirc: 'â', eacute: 'é', ecirc: 'ê', iacute: 'í', oacute: 'ó', otilde: 'õ', ocirc: 'ô', uacute: 'ú', uuml: 'ü', ccedil: 'ç',
  Aacute: 'Á', Agrave: 'À', Atilde: 'Ã', Acirc: 'Â', Eacute: 'É', Ecirc: 'Ê', Iacute: 'Í', Oacute: 'Ó', Otilde: 'Õ', Ocirc: 'Ô', Uacute: 'Ú', Ccedil: 'Ç',
};

export function desescaparHtml(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-zA-Z]+);/g, (m, n: string) => ENTIDADES[n] ?? ENTIDADES[n.toLowerCase()] ?? m);
}

/** HTML → texto: revogado fora, parágrafo vira quebra de linha, espaços normalizados. */
export function textoLimpo(html: string): string {
  let h = html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<strike[^>]*>[\s\S]*?<\/strike>/gi, ' ')
    .replace(/[\r\n\t]+/g, ' ');
  h = h.replace(/<br\s*\/?>|<\/p>|<\/div>|<\/tr>|<\/li>/gi, '\n').replace(/<[^>]+>/g, '');
  h = desescaparHtml(h).replace(/ /g, ' ');
  return h.replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/\n{2,}/g, '\n').trim();
}

/** Os artigos da lei, na ordem do texto, cada um com parágrafos e incisos. */
export function artigosDoPlanalto(html: string): ArtigoDoPlanalto[] {
  const semRevogado = html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<strike[^>]*>[\s\S]*?<\/strike>/gi, ' ')
    .replace(/[\r\n\t]+/g, ' ');
  const ancoras = [...semRevogado.matchAll(/<a name="art(\d+[a-z]*)"><\/a>/gi)]
    .map((m) => ({ numero: m[1].toLowerCase(), inicio: m.index ?? 0 }))
    .filter((a) => /^Art\.\s*\d/.test(textoLimpo(semRevogado.slice(a.inicio, a.inicio + 400))));
  return ancoras.map((a, i) => {
    const fim = i + 1 < ancoras.length ? ancoras[i + 1].inicio : semRevogado.length;
    return { numero: a.numero.replace(/(\d+)([a-z])$/, '$1-$2').toUpperCase().replace('ART', ''), texto: textoLimpo(semRevogado.slice(a.inicio, fim)) };
  });
}

/** "art. 92" a partir do número da âncora ("92", "44-A"). */
export const rotuloDoArtigo = (numero: string) => `art. ${numero}`;

/**
 * Artigos de uma norma publicada como texto corrido (gov.br, in.gov.br): sem
 * âncoras, o corte é pelo "Art. N" no começo da linha. Serve para as INs da
 * SEGES; o Planalto continua com `artigosDoPlanalto` (âncoras, revogado em
 * <strike>). Anexos ficam depois do último artigo — ver `trechoEntre`.
 */
export function artigosPorTexto(html: string): ArtigoDoPlanalto[] {
  const texto = textoLimpo(html);
  const re = /(?:^|\n)\s*Art\.\s*(\d+(?:-[A-Z])?)\s*[ºo°]?\s*[-–.]?\s*/g;
  const cortes: Array<{ numero: string; inicio: number; fimDoTitulo: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto)) !== null) cortes.push({ numero: m[1], inicio: m.index, fimDoTitulo: m.index + m[0].length });
  const artigos: ArtigoDoPlanalto[] = [];
  for (let i = 0; i < cortes.length; i++) {
    // Um "Art. 5º" citado dentro de outro artigo não é um artigo novo: o número tem de crescer.
    if (artigos.length > 0 && parseInt(cortes[i].numero, 10) <= parseInt(artigos[artigos.length - 1].numero, 10)) continue;
    const fim = i + 1 < cortes.length ? cortes[i + 1].inicio : texto.search(/\n\s*ANEXO\s+[IVXL]+/) > cortes[i].inicio ? texto.search(/\n\s*ANEXO\s+[IVXL]+/) : texto.length;
    const corpo = texto.slice(cortes[i].fimDoTitulo, fim).replace(/\s+/g, ' ').trim();
    if (corpo.length > 0) artigos.push({ numero: cortes[i].numero, texto: `Art. ${cortes[i].numero}º ${corpo}`.replace(/^Art\. (\d+)º/, (_m, n: string) => (parseInt(n, 10) >= 10 ? `Art. ${n}.` : `Art. ${n}º`)) });
  }
  return artigos;
}

/** O texto entre dois títulos (ex.: "ANEXO VII-D" até "ANEXO VII-E"), em texto corrido; vazio se não achar o início. */
export function trechoEntre(html: string, inicio: RegExp, fim: RegExp): string {
  const texto = textoLimpo(html);
  const a = texto.search(inicio);
  if (a < 0) return '';
  const resto = texto.slice(a);
  const b = resto.slice(1).search(fim);
  return (b >= 0 ? resto.slice(0, b + 1) : resto).replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}
