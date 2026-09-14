import { DIAS_DE_ANTECEDENCIA, diasAteVencer, prazoPorExtenso } from './lembretes';

/**
 * Em que situação a validade coloca um documento — a régua que o painel e o
 * calendário compartilham.
 *
 * NÃO reimplementa a conta de dias: ela já existe em `./lembretes`
 * (`diasAteVencer`), contada por DATA, sem hora e sem deslocamento de fuso. É
 * exatamente a conta que faltava no calendário, e ter uma segunda cópia aqui
 * seria repetir o erro que o vocabulário de status já pagou.
 *
 * O que este arquivo acrescenta é a CLASSIFICAÇÃO, que não existia:
 *
 *   1. "VENCE HOJE" não era uma categoria. A `calcDocStatus` do calendário
 *      tinha três estados ('ok' | 'vencendo' | 'vencido') e o documento que
 *      vence hoje caía em 'vencendo', no mesmo balde dos 30 dias seguintes —
 *      o único dia em que ainda dá para protocolar recebia o aviso de um
 *      prazo de um mês.
 *
 *   2. A comparação era com hora. `new Date(validade) < new Date()` põe a
 *      validade na meia-noite e o "agora" na hora corrente: às 9h da manhã,
 *      um documento válido o dia inteiro já aparecia VENCIDO.
 *
 * `validade` sem data reconhecível devolve `null` em `situacaoDaValidade` —
 * "não sei" não pode virar "vencido" nem "regular".
 */

export type SituacaoValidade = 'ok' | 'vencendo' | 'vence_hoje' | 'vencido';

export { DIAS_DE_ANTECEDENCIA, diasAteVencer };

const SO_DATA = /(\d{4})-(\d{2})-(\d{2})/;

/**
 * A validade como DIA no fuso de quem lê — meia-noite local.
 *
 * Use sempre isto para FORMATAR a data: `new Date('2026-09-13')` é meia-noite
 * UTC e, em Belém (UTC-3), imprime 12/09 — o dia anterior ao cadastrado.
 * `documentos.validade` é coluna `date` e chega exatamente nesse formato.
 */
export function diaDaValidade(valor: string): Date {
  const m = String(valor).match(SO_DATA);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(valor);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function situacaoDaValidade(
  valor: string,
  opcoes?: { diasDeAlerta?: number; hoje?: Date },
): SituacaoValidade | null {
  const dias = diasAteVencer(valor, opcoes?.hoje ?? new Date());
  if (dias === null) return null;
  if (dias < 0) return 'vencido';
  if (dias === 0) return 'vence_hoje';
  return dias <= (opcoes?.diasDeAlerta ?? DIAS_DE_ANTECEDENCIA) ? 'vencendo' : 'ok';
}

/** Ordem de urgência — o que já venceu primeiro, o que está em dia por último. */
export const ORDEM_DE_URGENCIA: Record<SituacaoValidade, number> = {
  vencido: 0,
  vence_hoje: 1,
  vencendo: 2,
  ok: 3,
};

/** Quem precisa de atenção agora. */
export function exigeAtencao(situacao: SituacaoValidade): boolean {
  return situacao !== 'ok';
}

/** O selo curto de cada situação — o mesmo texto no painel e no calendário. */
export const ROTULO_DA_SITUACAO: Record<SituacaoValidade, string> = {
  vencido: 'Vencido',
  vence_hoje: 'Vence hoje',
  vencendo: 'Vencendo',
  ok: 'Regular',
};

/**
 * A frase do prazo, já diferenciando atraso, dia e futuro. O texto vem de
 * `prazoPorExtenso` (a mesma frase do lembrete de vencimento), com a primeira
 * letra em caixa alta para servir de linha própria.
 */
export function frasePrazo(valor: string, hoje = new Date()): string {
  const dias = diasAteVencer(valor, hoje);
  if (dias === null) return 'Validade não reconhecida';
  const frase = prazoPorExtenso(dias);
  return frase.charAt(0).toUpperCase() + frase.slice(1);
}

/* ───────────────────────────────────────────────────────────────────────────
   A situação do DOCUMENTO, que é mais do que a situação da validade.

   `SituacaoValidade` responde "o prazo está bom?". A tela de Documentos
   precisa de uma pergunta maior — "posso contar com este documento?" —, e ela
   soma três casos que a validade sozinha não cobre:

     ausente        a vaga existe no checklist e não há arquivo nenhum;
     sem_validade   há arquivo, o documento VENCE por natureza, e ninguém
                    informou até quando;
     nao_se_aplica  há arquivo e o documento não tem prazo (contrato social,
                    cartão CNPJ, declaração).

   Os dois últimos chegavam ao banco como o mesmo `validade = NULL` e, na tela,
   viravam os dois "Regular" — o cofre parecia completo com seis certidões sem
   data. Quem distingue é `VAGAS_PREVISTAS.vence`, que declara a natureza do
   documento; o banco não tem como saber.

   ⚠️ Esta régua NÃO muda o vocabulário de `SituacaoValidade`, que o Calendário
   e o Painel já consomem. Ela o ENVOLVE.
   ─────────────────────────────────────────────────────────────────────────── */

export type SituacaoDocumento =
  | SituacaoValidade
  | 'ausente'
  | 'sem_validade'
  | 'nao_se_aplica';

export interface EntradaParaSituacao {
  /** Caminho do arquivo no storage. Vazio/nulo = nada anexado. */
  arquivoPath?: string | null;
  /** `documentos.validade` — coluna `date`, ou nulo. */
  validade?: string | null;
  /** O documento vence por natureza? Vem de `VAGAS_PREVISTAS.vence`. */
  vencePorNatureza?: boolean;
}

/**
 * A situação de um documento do cofre.
 *
 * A ordem das perguntas importa e não é arbitrária: sem arquivo, nada mais
 * interessa; com arquivo e sem prazo por natureza, a validade não é cobrada;
 * só então o prazo decide.
 */
export function situacaoDoDocumento(
  entrada: EntradaParaSituacao,
  opcoes?: { diasDeAlerta?: number; hoje?: Date },
): SituacaoDocumento {
  const temArquivo = !!entrada.arquivoPath && String(entrada.arquivoPath).trim() !== '';
  if (!temArquivo) return 'ausente';

  if (entrada.vencePorNatureza === false) return 'nao_se_aplica';

  if (!entrada.validade) return 'sem_validade';

  // `null` aqui significa data ilegível — e "não sei ler" não pode virar
  // "regular", que é o que a tela fazia.
  return situacaoDaValidade(entrada.validade, opcoes) ?? 'sem_validade';
}

export const ROTULO_DO_DOCUMENTO: Record<SituacaoDocumento, string> = {
  ...ROTULO_DA_SITUACAO,
  ausente: 'Ausente',
  sem_validade: 'Validade não informada',
  nao_se_aplica: 'Sem vencimento',
};

/**
 * O que conta como REGULAR nos indicadores.
 *
 * `vencendo` e `vence_hoje` entram, e isso é decisão de produto preservada da
 * tela anterior, escrita lá por extenso: "o selo diz o que o documento É, não
 * o que vai acontecer com ele. Certidão válida por mais 26 dias é REGULAR".
 * O vencimento que se aproxima é AVISO, e tem lugar próprio.
 *
 * A consequência precisa estar na tela, e é por isso que esta função existe
 * separada em vez de embutida: quem lê "Regulares: 9" tem de poder descobrir
 * que 2 daqueles 9 vencem este mês. Somar o subconjunto de novo no total seria
 * contar o mesmo documento duas vezes.
 */
export function contaComoRegular(situacao: SituacaoDocumento): boolean {
  return situacao === 'ok' || situacao === 'vencendo' || situacao === 'vence_hoje' || situacao === 'nao_se_aplica';
}

/** Quantos dos regulares vencem dentro da janela de alerta. */
export function ehRegularMasVencendo(situacao: SituacaoDocumento): boolean {
  return situacao === 'vencendo' || situacao === 'vence_hoje';
}
