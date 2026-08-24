/**
 * Qual das datas de uma certidão é a validade.
 *
 * Um documento fiscal traz várias datas juntas — emissão, hora, validade,
 * número com ano embutido — e a errada custa caro nos dois sentidos: uma
 * validade curta demais manda renovar o que está bom; longa demais deixa a
 * empresa ir à sessão com certidão vencida.
 *
 * O caso que expôs o defeito foi a CND estadual do Pará:
 *
 *     Emitida às: 14:41:42 do dia 10/07/2026
 *     Válida até: 06/01/2027
 *
 * O sistema gravou 10/07/2026 — a emissão. Duas causas somadas:
 *
 * 1. "EMITIDA" não estava entre as palavras de emissão (só "EMISSÃO" e
 *    "EXPEDIÇÃO"), então a data não levava penalidade nenhuma;
 * 2. a janela de contexto olhava 64 caracteres para os DOIS lados, e o
 *    "Válida até" da linha seguinte caía dentro dela — a data de emissão
 *    recebia o bônus de validade da data que vinha depois dela.
 *
 * Daí a regra central aqui: o rótulo que qualifica uma data é o que vem ANTES
 * dela, e só até a data anterior mais próxima. É assim que se lê um documento.
 */

export const normalizarEspacos = (valor: string) => valor.replace(/\s+/g, ' ').trim();

/** Recusa 31/02: `new Date` a converteria para 03/03 sem reclamar. */
export const montarData = (ano: number, mes: number, dia: number): Date | null => {
  const d = new Date(ano, mes - 1, dia);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getFullYear() !== ano || d.getMonth() !== mes - 1 || d.getDate() !== dia) return null;
  return d;
};

/** Diz que a data é o fim de um prazo. */
const ROTULO_DE_VALIDADE =
  /(V[ÁA]LID[OA]|VALIDADE|VENC(?:IMENTO|E)?|EXPIRA(?:[ÇC][ÃA]O)?|VIG[ÊE]NCIA|EFIC[ÁA]CIA|AT[ÉE])/;

/**
 * Diz que a data é o começo de alguma coisa, ou não é prazo nenhum.
 * "EMITIDA" e "GERADA" faltavam, e eram justamente as usadas pela SEFA/PA.
 */
const ROTULO_DE_ORIGEM =
  /(EMISS[ÃA]O|EMITID[OA]|EXPEDI[ÇC][ÃA]O|EXPEDID[OA]|GERAD[OA]|IMPRESS[OA]|NASC(?:IMENTO)?|REFER[ÊE]NCIA|APURA[ÇC][ÃA]O|PROTOCOLO|REGISTRO|1.?\s*HABILITA[ÇC][ÃA]O|IDENTIDADE|RG\b|CPF\b|RENACH)/;

type Candidata = { data: Date; indice: number; pontos: number };

/**
 * O rótulo de uma data é o texto que a antecede, e nada além da data anterior:
 * ler adiante faz a emissão herdar o "Válida até" da linha seguinte.
 */
function contextoAnterior(texto: string, indice: number, inicioAnterior: number): string {
  const piso = Math.max(inicioAnterior, indice - 80);
  return texto.slice(piso, indice).toUpperCase();
}

function pontuar(contexto: string, data: Date, agora: Date): number {
  let pontos = 0;
  if (ROTULO_DE_VALIDADE.test(contexto)) pontos += 12;
  if (ROTULO_DE_ORIGEM.test(contexto)) pontos -= 14;

  const ano = data.getFullYear();
  if (ano >= 2000 && ano <= 2100) pontos += 1;

  const dias = (data.getTime() - agora.getTime()) / 86400000;
  if (dias > -3650 && dias < 3650 * 15) pontos += 1;
  // Validade costuma estar à frente; empate entre duas datas rotuladas se
  // resolve pela que ainda faz sentido como prazo.
  if (dias >= 0) pontos += 1;

  return pontos;
}

const PADROES = [
  {
    regex: /(\d{2})\s*[/\-.]\s*(\d{2})\s*[/\-.]\s*(\d{4})/g,
    montar: (m: RegExpMatchArray) => montarData(Number(m[3]), Number(m[2]), Number(m[1])),
  },
  {
    regex: /(\d{4})\s*[/\-.]\s*(\d{2})\s*[/\-.]\s*(\d{2})/g,
    montar: (m: RegExpMatchArray) => montarData(Number(m[1]), Number(m[2]), Number(m[3])),
  },
];

export function extrairValidadeDoTexto(textoCru: string, agora = new Date()): Date | null {
  if (!textoCru?.trim()) return null;
  const texto = normalizarEspacos(textoCru);

  const brutas: Array<{ data: Date; indice: number }> = [];
  for (const padrao of PADROES) {
    for (const m of texto.matchAll(padrao.regex)) {
      if (typeof m.index !== 'number') continue;
      const data = padrao.montar(m);
      if (data) brutas.push({ data, indice: m.index });
    }
  }
  if (!brutas.length) return null;

  brutas.sort((a, b) => a.indice - b.indice);

  const candidatas: Candidata[] = brutas.map((c, i) => ({
    ...c,
    pontos: pontuar(contextoAnterior(texto, c.indice, i === 0 ? 0 : brutas[i - 1].indice), c.data, agora),
  }));

  const boas = candidatas
    .filter((c) => c.pontos > 0)
    .sort((a, b) => b.pontos - a.pontos || b.data.getTime() - a.data.getTime());
  if (boas.length) return boas[0].data;

  // Sem nenhum rótulo reconhecido, a data mais distante é o palpite menos ruim
  // — e o diálogo mostra a sugestão para a pessoa confirmar antes de gravar.
  return [...candidatas].sort((a, b) => b.data.getTime() - a.data.getTime())[0]?.data ?? null;
}
