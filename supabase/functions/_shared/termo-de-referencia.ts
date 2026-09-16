/**
 * Marca e modelo indicados no termo de referência — Fase 6 do robô ("coluna de
 * marca e modelo SE HOUVER no anexo, do termo de referência", checklist do
 * grupo, 14/09/2026).
 *
 * O QUE FOI CONFERIDO ANTES DE ESCREVER (16/09, pregão 7/2026 SEDUC/PA):
 * - o PNCP publicou um arquivo só, "Edital e anexos", compactado em RAR, com o
 *   termo de referência dentro ("3. ANEXO B - TR", 112 páginas);
 * - o termo NÃO indica marca nem modelo por item — fala em "marca ofertada"
 *   (a do fornecedor) e "ou similar". Na Lei 14.133 indicar marca é exceção
 *   (art. 41), então o normal é não haver o que preencher;
 * - 112 páginas passam do limite de leitura nativa de PDF da IA (100).
 *
 * Por isso a leitura é SOB DEMANDA e em duas etapas: o texto do PDF é recortado
 * só nos trechos que falam de marca, modelo ou fabricante (`trechosDeMarcaEModelo`,
 * grátis); sem trecho, a resposta é "o termo não indica" sem chamar a IA. Com
 * trecho, a IA recebe só os recortes e a lista de itens — e cada marca que ela
 * devolve precisa vir com o trecho que a sustenta, conferido aqui contra o
 * texto (`respostaDaMarcaEModelo`): marca sem prova não entra.
 *
 * Funções puras: o teste do front importa este arquivo direto.
 */

export type TipoDeArquivo = "pdf" | "zip" | "rar" | "outro";

/** Pelos primeiros bytes — o nome e o Content-Type do PNCP não são confiáveis. */
export function tipoDoArquivo(bytes: Uint8Array): TipoDeArquivo {
  const b = (i: number) => bytes[i];
  if (b(0) === 0x25 && b(1) === 0x50 && b(2) === 0x44 && b(3) === 0x46) return "pdf"; // %PDF
  if (b(0) === 0x50 && b(1) === 0x4b && b(2) === 0x03 && b(3) === 0x04) return "zip"; // PK..
  if (b(0) === 0x52 && b(1) === 0x61 && b(2) === 0x72 && b(3) === 0x21) return "rar"; // Rar!
  return "outro";
}

const sem = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/**
 * Qual arquivo ler primeiro: termo de referência, depois o edital (que costuma
 * trazer o termo anexo), depois o resto. Minutas e estudo preliminar por último.
 */
export function prioridadeDoArquivo(nome: string): number {
  const n = sem(nome);
  if (/termo de referencia|\btr\b/.test(n)) return 0;
  if (/edital/.test(n)) return 2;
  if (/relacao de itens|especificac|planilha/.test(n)) return 3;
  if (/minuta|\betp\b|estudo tecnico|contrato|ata de registro/.test(n)) return 9;
  return 5;
}

const PALAVRAS = /\b(marcas?|modelos?|fabricantes?|part\s*number|p\/n)\b/gi;

/**
 * Os pedaços do texto em volta de "marca", "modelo" e "fabricante", já juntos
 * quando se sobrepõem. O limite de caracteres segura o custo da leitura.
 */
export function trechosDeMarcaEModelo(texto: string, janela = 350, limite = 30000): string[] {
  const limpo = texto.replace(/\s+/g, " ");
  const intervalos: Array<[number, number]> = [];
  for (const m of limpo.matchAll(PALAVRAS)) {
    const ini = Math.max(0, (m.index ?? 0) - janela);
    const fim = Math.min(limpo.length, (m.index ?? 0) + m[0].length + janela);
    const ultimo = intervalos[intervalos.length - 1];
    if (ultimo && ini <= ultimo[1]) ultimo[1] = Math.max(ultimo[1], fim);
    else intervalos.push([ini, fim]);
  }
  const trechos: string[] = [];
  let total = 0;
  for (const [ini, fim] of intervalos) {
    const t = limpo.slice(ini, fim).trim();
    if (total + t.length > limite) break;
    trechos.push(t);
    total += t.length;
  }
  return trechos;
}

export function instrucaoDaMarcaEModelo(itens: ReadonlyArray<{ numero: number; descricao: string }>): string {
  const lista = itens.map((i) => `${i.numero}: ${i.descricao.slice(0, 120)}`).join("\n");
  return `Os trechos abaixo foram recortados do termo de referência de uma licitação, nas partes que citam marca, modelo ou fabricante.

Itens da licitação (número: descrição):
${lista}

Para cada item, diga a MARCA e o MODELO que o órgão INDICA no documento (marca de referência, marca exigida, modelo especificado). NÃO conta: "marca ofertada", "marca do fabricante", "ou similar" sem nome, exigência genérica de informar marca na proposta, nome de tecnologia/padrão (ex.: USB, HDMI, Wi-Fi).

Só inclua um item se houver uma marca ou modelo NOMEADO no texto. Para cada um, copie em "trecho" as palavras exatas do texto que mostram a indicação (até 200 caracteres).

Retorne SOMENTE JSON: {"itens": [{"numero": 1, "marca": "Nome" ou null, "modelo": "Nome" ou null, "trecho": "palavras exatas do texto"}]}
Se nenhum item tiver indicação, retorne {"itens": []}.`;
}

export interface MarcaModeloDoTermo {
  numero: number;
  marca: string | null;
  modelo: string | null;
  trecho: string;
}

/**
 * A resposta da IA, conferida: só itens da lista, com marca ou modelo, e com o
 * trecho de prova achado de verdade nos recortes (comparação sem acento, sem
 * caixa e sem espaço). O que não se prova é descartado.
 */
export function respostaDaMarcaEModelo(
  resposta: unknown,
  numerosValidos: ReadonlySet<number>,
  trechos: ReadonlyArray<string>,
): MarcaModeloDoTermo[] {
  const lista = (resposta as { itens?: unknown })?.itens;
  if (!Array.isArray(lista)) return [];
  // Sem espaço nenhum na comparação: o texto do PDF sai com letras soltas
  // ("Educa ç ã o"), e a IA cita a palavra inteira.
  const junto = (t: string) => sem(t).replace(/\s+/g, "");
  const base = junto(trechos.join(" "));
  const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 120) : null);
  const saida: MarcaModeloDoTermo[] = [];
  const vistos = new Set<number>();
  for (const bruto of lista as Array<Record<string, unknown>>) {
    const numero = Number(bruto?.numero);
    if (!numerosValidos.has(numero) || vistos.has(numero)) continue;
    const marca = texto(bruto.marca);
    const modelo = texto(bruto.modelo);
    const trecho = texto(bruto.trecho) ? String(bruto.trecho).trim().slice(0, 200) : null;
    if ((!marca && !modelo) || !trecho) continue;
    if (!base.includes(junto(trecho))) continue;
    // A marca/modelo precisa aparecer no próprio trecho — senão a prova não prova.
    if (marca && !junto(trecho).includes(junto(marca))) continue;
    if (modelo && !junto(trecho).includes(junto(modelo))) continue;
    vistos.add(numero);
    saida.push({ numero, marca, modelo, trecho });
  }
  return saida;
}
