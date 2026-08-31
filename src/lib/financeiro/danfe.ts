/**
 * Ler o DANFE quando não há XML.
 *
 * O XML é o documento fiscal, mas quem emite fora do sistema muitas vezes tem
 * só o PDF em mãos — foi ele que chegou no anexo do 000.000.125. Guardá-lo sem
 * ler devolve a pessoa à digitação que o arquivo dispensa.
 *
 * ── Por que a CHAVE, e não o resto do papel ─────────────────────────────────
 *
 * Tentar entender o layout do DANFE é frágil: cada emissor imprime de um
 * jeito, os rótulos mudam, e OCR de nota escaneada erra acento e coluna. Mas a
 * chave de acesso é 44 dígitos com dígito verificador — ou está certa, ou não
 * é chave. E ela CONTÉM o que a aba Documento pede:
 *
 *   pos  1– 2   UF do emitente
 *   pos  3– 6   ano e mês da emissão
 *   pos  7–20   CNPJ do emitente
 *   pos 21–22   modelo (55 = NF-e, 65 = NFC-e)
 *   pos 23–25   série
 *   pos 26–34   número da nota
 *   pos 35      tipo de emissão
 *   pos 36–43   código numérico
 *   pos 44      dígito verificador
 *
 * Achar um número e conferir seu DV é mais seguro do que interpretar um
 * layout — e devolve número, série e mês de uma vez só.
 */

/** Dígito verificador da chave, módulo 11 com pesos 2..9 da direita. */
export function digitoVerificadorDaChave(primeiros43: string): number | null {
  const d = String(primeiros43 ?? '').replace(/\D/g, '');
  if (d.length !== 43) return null;
  let soma = 0;
  let peso = 2;
  for (let i = d.length - 1; i >= 0; i--) {
    soma += Number(d[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  // Regra do manual: resto 0 ou 1 produz DV zero.
  return resto < 2 ? 0 : 11 - resto;
}

/** 44 dígitos E o DV conferindo. Sem o DV, qualquer número longo passaria. */
export function chaveDeAcessoValida(valor: unknown): string | null {
  const d = String(valor ?? '').replace(/\D/g, '');
  if (d.length !== 44) return null;
  if (/^0+$/.test(d)) return null;
  const esperado = digitoVerificadorDaChave(d.slice(0, 43));
  return esperado !== null && esperado === Number(d[43]) ? d : null;
}

/**
 * Acha a chave no texto do DANFE.
 *
 * ── Por que não basta juntar todos os dígitos da página ────────────────────
 *
 * Foi o que eu fiz primeiro, e o teste derrubou: colando CNPJ, protocolo e
 * datas numa tira só, uma janela QUALQUER de 44 dígitos fecha o dígito
 * verificador por acaso — uma em onze. Numa página com centenas de dígitos, o
 * falso positivo é quase certo. E ele é pior que não achar nada: escreveria
 * número, série e competência inventados num campo fiscal, com a autoridade
 * de quem leu o documento.
 *
 * Então a busca é por TRECHOS: sequências de dígitos separadas apenas por
 * espaço, ponto, hífen ou barra, sem letra no meio. É assim que o papel
 * imprime a chave — "1526 0412 3456 …" — e é o que separa a chave do CNPJ ao
 * lado dela.
 *
 * Trecho de exatamente 44 dígitos ganha de um trecho maior onde a janela
 * deslizou: o primeiro é a chave impressa, o segundo é coincidência que
 * passou no DV.
 *
 * Quebra de linha NÃO é separador. Uma chave partida em duas linhas deixa de
 * ser encontrada — e isso é deliberado: juntar linhas emendaria a chave com o
 * número da linha seguinte, que é como o falso positivo nasce.
 */
export function acharChaveNoTexto(texto: string): string | null {
  const trechos = String(texto ?? '').split(/[^\d .\-/]+/);
  let porDeslize: string | null = null;

  for (const trecho of trechos) {
    const d = trecho.replace(/\D/g, '');
    if (d.length < 44) continue;
    if (d.length === 44) {
      const exata = chaveDeAcessoValida(d);
      if (exata) return exata;
      continue;
    }
    if (porDeslize) continue;
    for (let i = 0; i + 44 <= d.length; i++) {
      const c = chaveDeAcessoValida(d.slice(i, i + 44));
      if (c) { porDeslize = c; break; }
    }
  }
  return porDeslize;
}

export type DadosDaChave = {
  uf: string;
  /** AAAA-MM da emissão. O dia não cabe na chave. */
  competencia: string;
  cnpj_emitente: string;
  modelo: string;
  serie: string;
  numero: string;
};

/**
 * O que a chave diz.
 *
 * O ano vem com dois dígitos. `20${aa}` é seguro até 2099 e não tem
 * alternativa: a chave não guarda o século.
 */
export function dadosDaChave(chave: string): DadosDaChave | null {
  const d = chaveDeAcessoValida(chave);
  if (!d) return null;
  return {
    uf: d.slice(0, 2),
    competencia: `20${d.slice(2, 4)}-${d.slice(4, 6)}`,
    cnpj_emitente: d.slice(6, 20),
    modelo: d.slice(20, 22),
    // Sem zeros à esquerda: "001" é a série 1, e é assim que o papel a
    // apresenta e que a pessoa a digitaria.
    serie: String(Number(d.slice(22, 25))),
    numero: String(Number(d.slice(25, 34))),
  };
}

/** Só os modelos que este campo comporta; outro modelo não é NF-e nem NFC-e. */
export const ROTULO_DO_MODELO: Record<string, string> = {
  '55': 'nfe',
  '65': 'nfce',
};
