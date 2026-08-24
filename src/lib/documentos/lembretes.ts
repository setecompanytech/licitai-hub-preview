/**
 * Lembrete de vencimento de documento — a regra, separada da tela.
 *
 * O selo do documento diz o que ele É: regular, vencido ou ausente. Uma certidão
 * válida por mais 26 dias é regular, e marcá-la como "pendente" fazia a pessoa
 * procurar um problema que não existia. O que vence em breve não é um estado do
 * documento: é um aviso, e aviso tem lugar próprio.
 *
 * O lembrete tem duas exigências que se contradizem só na aparência: pode ser
 * fechado, e tem de voltar. Fechar não resolve o vencimento — some da tela quem
 * atrapalha agora, não o que precisa ser feito. Por isso o × ADIA, não apaga.
 *
 * Duas propriedades sustentam isso:
 *
 * 1. A chave do adiamento inclui a VALIDADE do documento. Renovar a certidão
 *    muda a validade, muda a chave, e o adiamento antigo deixa de valer — que é
 *    literalmente "até o documento ser atualizado", sem precisar detectar
 *    atualização nenhuma.
 *
 * 2. O adiamento ENCURTA conforme o prazo aperta. Sete dias de silêncio fazem
 *    sentido a um mês do vencimento e são negligência a três dias dele.
 */

export type DocumentoComValidade = {
  id: string;
  nome: string;
  validade: string;
};

export type Lembrete = {
  chave: string;
  id: string;
  nome: string;
  validade: string;
  /** Negativo = já venceu. */
  dias: number;
  gravidade: 'vencido' | 'critico' | 'atencao';
};

/** Janela em que o vencimento passa a ser assunto. */
export const DIAS_DE_ANTECEDENCIA = 30;

/** Dias até a validade, contados por DATA — hora não entra, fuso não desloca. */
export function diasAteVencer(validade: string, hoje = new Date()): number | null {
  const m = String(validade).match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const alvo = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const base = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((alvo - base) / 86400000);
}

/**
 * Quanto tempo o × compra de silêncio.
 *
 * Vencido não some por uma semana: documento vencido impede habilitação, e
 * esquecer disso custa o certame.
 */
export function diasDeAdiamento(dias: number): number {
  if (dias < 0) return 1;
  if (dias <= 7) return 1;
  if (dias <= 15) return 3;
  return 7;
}

/** A chave morre quando a validade muda — renovar o documento silencia sozinho. */
export const chaveDoLembrete = (doc: { id: string; validade: string }) =>
  `${doc.id}:${String(doc.validade).slice(0, 10)}`;

export function lembretesDe(
  documentos: DocumentoComValidade[],
  hoje = new Date(),
): Lembrete[] {
  return documentos
    .map((d) => {
      const dias = diasAteVencer(d.validade, hoje);
      if (dias === null || dias > DIAS_DE_ANTECEDENCIA) return null;
      const gravidade: Lembrete['gravidade'] =
        dias < 0 ? 'vencido' : dias <= 7 ? 'critico' : 'atencao';
      return { chave: chaveDoLembrete(d), id: d.id, nome: d.nome, validade: d.validade, dias, gravidade };
    })
    .filter((l): l is Lembrete => l !== null)
    // O mais urgente primeiro: quem abre o sistema vê o que impede antes do que avisa.
    .sort((a, b) => a.dias - b.dias);
}

export type Adiamentos = Record<string, string>;

/** Continua adiado? Chave desconhecida (documento renovado) nunca está. */
export function estaAdiado(adiamentos: Adiamentos, chave: string, agora = new Date()): boolean {
  const ate = adiamentos[chave];
  if (!ate) return false;
  const t = Date.parse(ate);
  return Number.isFinite(t) && t > agora.getTime();
}

export function adiar(
  adiamentos: Adiamentos,
  lembrete: Pick<Lembrete, 'chave' | 'dias'>,
  agora = new Date(),
): Adiamentos {
  const ate = new Date(agora.getTime() + diasDeAdiamento(lembrete.dias) * 86400000);
  return { ...adiamentos, [lembrete.chave]: ate.toISOString() };
}

/**
 * Adiamento de documento que não está mais na lista (renovado, ou removido) é
 * lixo: sem a limpeza, o registro cresceria para sempre no navegador.
 */
export function semOsObsoletos(adiamentos: Adiamentos, lembretes: Lembrete[]): Adiamentos {
  const vivas = new Set(lembretes.map((l) => l.chave));
  return Object.fromEntries(Object.entries(adiamentos).filter(([k]) => vivas.has(k)));
}

const chaveDoArmazem = (userId: string) => `praefectus:lembrete-vencimento:${userId}`;

export function lerAdiamentos(userId: string): Adiamentos {
  try {
    const cru = localStorage.getItem(chaveDoArmazem(userId));
    const obj = cru ? JSON.parse(cru) : null;
    return obj && typeof obj === 'object' ? (obj as Adiamentos) : {};
  } catch {
    // Navegador sem localStorage (aba privada, política corporativa) não pode
    // derrubar a tela: sem memória, o lembrete simplesmente sempre aparece.
    return {};
  }
}

export function gravarAdiamentos(userId: string, adiamentos: Adiamentos): void {
  try {
    localStorage.setItem(chaveDoArmazem(userId), JSON.stringify(adiamentos));
  } catch {
    /* ver acima */
  }
}

/** O prazo dito por extenso, para ninguém ter de calcular de cabeça. */
export function prazoPorExtenso(dias: number): string {
  if (dias < 0) return dias === -1 ? 'venceu ontem' : `venceu há ${Math.abs(dias)} dias`;
  if (dias === 0) return 'vence hoje';
  if (dias === 1) return 'vence amanhã';
  return `vence em ${dias} dias`;
}
