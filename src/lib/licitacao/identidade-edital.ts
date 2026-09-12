/**
 * Identidade padronizada de um edital — a autoridade única de nomeação.
 *
 * Cada portal publica o número do jeito que quer: "011/2026",
 * "PE nº 9/2026-0025 PMPD", "007 SRP", "90008/2025". A lista de
 * monitoramento exibia esses crus, lado a lado, sem padrão nenhum.
 *
 * Aqui a identidade é DERIVADA dos dados reais — número e ano extraídos do
 * texto publicado (ou do ano_compra do PNCP quando o texto não traz ano),
 * modalidade normalizada — e NUNCA inventada: o que não se consegue extrair
 * fica como o portal publicou, e a forma bruta permanece acessível sempre
 * (é ela que aparece no diário oficial e na sala de disputa).
 */

export type DadosIdentidade = {
  numeroCompra?: string | null;
  modalidade?: string | null;
  /** ano_compra do PNCP — socorre número publicado sem ano ("007 SRP"). */
  anoCompra?: string | number | null;
};

export type IdentidadeEdital = {
  /** "Pregão Eletrônico nº 9/2026" — pronto para exibir. */
  rotulo: string;
  /** "nº 9/2026" (ou "nº 9" quando nenhuma fonte traz o ano), ou null. */
  numeroPadronizado: string | null;
  /** Exatamente como o portal publicou. */
  bruto: string;
  /** true quando o padronizado difere do bruto — é quando vale mostrar a origem. */
  reescrito: boolean;
  /** O texto publicado carrega "SRP" — vira chip, não some na padronização. */
  srpNoTexto: boolean;
};

/** "Pregão - Eletrônico" → "Pregão Eletrônico"; espaços duplicados caem. */
export function normalizarModalidade(modalidade?: string | null): string {
  return String(modalidade || '')
    .replace(/\s*[-–]\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extrai {numero, ano} do texto publicado. Ordem dos padrões importa. */
function extrairNumeroAno(texto: string, anoCompra?: string | number | null): { numero: number; ano: string | null } | null {
  // "9/2026", "011/2026", "90008/2025", "9/2026-0025" (sufixo interno ignorado)
  let m = texto.match(/(\d{1,6})\s*[/.-]\s*(20\d{2})/);
  if (m) return { numero: parseInt(m[1], 10), ano: m[2] };

  // Ano na frente: "2026/007"
  m = texto.match(/(20\d{2})\s*[/.-]\s*(\d{1,6})/);
  if (m) return { numero: parseInt(m[2], 10), ano: m[1] };

  // Só um número ("P.E. 044", "6", "007 SRP"): o ano vem do PNCP quando
  // existe; sem nenhuma fonte de ano, padroniza o número e NÃO inventa ano.
  const ano = String(anoCompra ?? '').trim();
  m = texto.match(/(\d{1,6})/);
  if (m) return { numero: parseInt(m[1], 10), ano: /^20\d{2}$/.test(ano) ? ano : null };

  return null;
}

export function identidadeDoEdital(dados: DadosIdentidade): IdentidadeEdital {
  const bruto = String(dados.numeroCompra || '').trim();
  const modalidade = normalizarModalidade(dados.modalidade);

  const extraido = bruto ? extrairNumeroAno(bruto, dados.anoCompra) : null;
  const numeroPadronizado = extraido
    ? (extraido.ano ? `nº ${extraido.numero}/${extraido.ano}` : `nº ${extraido.numero}`)
    : null;

  let rotulo: string;
  if (modalidade && numeroPadronizado) rotulo = `${modalidade} ${numeroPadronizado}`;
  else if (numeroPadronizado) rotulo = `Edital ${numeroPadronizado}`;
  else if (modalidade && bruto) rotulo = `${modalidade} ${bruto}`;
  else if (modalidade) rotulo = modalidade;
  else if (bruto) rotulo = bruto;
  else rotulo = 'Edital sem número';

  return {
    rotulo,
    numeroPadronizado,
    bruto,
    reescrito: numeroPadronizado !== null && numeroPadronizado.replace(/^nº\s*/, '') !== bruto,
    srpNoTexto: /\bSRP\b/i.test(bruto),
  };
}
