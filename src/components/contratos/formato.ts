import { CheckCircle2, Clock, AlertTriangle, Ban } from 'lucide-react';
import type { ElementType } from 'react';
import type { TomSituacao } from '@/components/gestao/SeloSituacao';
import { statusEfetivo } from '@/lib/contratos/vigencia';

/**
 * Como um valor e uma situação se escrevem na tela de contratos.
 *
 * Módulo, e não constante repetida em cada arquivo, pelo mesmo motivo que o
 * repo tem uma régua única de percentual e uma autoridade única de status
 * (CLAUDE.md, princípio 1): duas funções com o mesmo papel e opções levemente
 * diferentes produzem duas verdades sobre o mesmo número na mesma página, e a
 * diferença só aparece quando alguém confere com o extrato.
 */
export function formatarBRL(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

/**
 * O valor foi apurado?
 *
 * `null`/`undefined` é ausência de apuração; `0` é uma afirmação sobre o
 * registro ("não houve valor"). O comando de 13/09 proíbe confundir as duas, e
 * quem chama usa isto para decidir entre `formatarBRL(0)` e `ValorIndisponivel`.
 * `NaN` entra aqui também: número que não é número nunca foi apurado.
 */
export function foiApurado(valor: number | null | undefined): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor);
}

/**
 * O vocabulário de situação do documento contratual, em um lugar só.
 *
 * A chave é o que `lib/contratos/vigencia.ts::statusEfetivo` devolve — e é ele
 * que manda, não a coluna `status` gravada, que envelhece sozinha. Aqui só se
 * decide como cada situação se APRESENTA: rótulo, tom e ícone do
 * `SeloSituacao` (texto + ícone + cor, nunca só cor).
 */
export const SITUACAO_DO_DOCUMENTO: Record<
  string,
  { rotulo: string; tom: TomSituacao; icone: ElementType }
> = {
  vigente: { rotulo: 'Vigente', tom: 'sucesso', icone: CheckCircle2 },
  vencendo: { rotulo: 'Vencendo', tom: 'atencao', icone: Clock },
  /** O calendário passou e ninguém decidiu — pendente de aditivo de prazo ou de encerramento. */
  vencido: { rotulo: 'Vencido', tom: 'critico', icone: AlertTriangle },
  encerrado: { rotulo: 'Encerrado', tom: 'neutro', icone: Clock },
  suspenso: { rotulo: 'Suspenso', tom: 'critico', icone: Ban },
};

export function situacaoDoDocumento(chave: string) {
  return SITUACAO_DO_DOCUMENTO[chave] ?? SITUACAO_DO_DOCUMENTO.vigente;
}

/**
 * A chave que a TELA mostra — separa o vencido pelo calendário do encerrado
 * por decisão (21/09). `statusEfetivo` devolve 'encerrado' para os dois, e
 * para a ATA isso está certo: a vigência acabou e ela não admite nova
 * contratação ("Vigência encerrada", art. 84). Para o contrato, "Encerrado"
 * no selo de um contrato que ninguém encerrou negava a decisão do dono: o
 * sistema sugere, quem opera declara. Vencido sem declaração é "Vencido" —
 * e continua "em andamento" na lista, porque a decisão está pendente.
 */
export function chaveDeExibicao(
  statusGravado: string | null | undefined,
  dataFim: string | null | undefined,
  ehAta: boolean,
): string {
  const chave = statusEfetivo(statusGravado, dataFim);
  if (!ehAta && chave === 'encerrado' && statusGravado !== 'encerrado') return 'vencido';
  return chave;
}

/**
 * Ata "encerrada" NÃO significa operação encerrada: contrato derivado firmado
 * na vigência da ata permanece válido depois dela (Lei 14.133/2021, art. 84 —
 * a vigência da ata limita NOVAS contratações; o contrato tem vigência
 * própria, arts. 105-107). O selo "Encerrado" seco induzia ao erro (12/09):
 * a ata da SEDUC expirou com um derivado ainda vigente. Por isso a ata ganha
 * o rótulo específico "Vigência encerrada" e a execução dos derivados sai em
 * um selo SEPARADO — são dois fatos distintos, e juntá-los num selo só foi o
 * que produziu a leitura errada.
 */
export const EXPLICA_ATA_ENCERRADA =
  'A VIGÊNCIA da ata terminou: ela não admite novas contratações nem adesões. ' +
  'Os contratos derivados firmados durante a vigência continuam valendo até o fim ' +
  'da vigência própria de cada um (Lei 14.133/2021, art. 84 c/c arts. 105-107).';

/**
 * A frase que o comando de 13/09 manda reproduzir, palavra por palavra, onde
 * as duas bases aparecem na mesma tela.
 *
 * O valor registrado na ata é um TETO estimado de fornecimento; o valor dos
 * contratos derivados é o que desse teto já virou obrigação. Somar os dois
 * conta o mesmo dinheiro duas vezes — e foi assim que a carteira já apareceu
 * com o dobro do que existe.
 */
export const AVISO_BASES_DISTINTAS = {
  titulo: 'Bases de cálculo distintas',
  texto:
    'Os valores da ATA e dos contratos derivados possuem bases de cálculo diferentes '
    + 'e não devem ser somados.',
} as const;
