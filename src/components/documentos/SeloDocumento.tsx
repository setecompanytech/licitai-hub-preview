import { HelpCircle } from 'lucide-react';
import SeloSituacao from '@/components/gestao/SeloSituacao';
import {
  ROTULO_DO_DOCUMENTO,
  diaDaValidade,
  frasePrazo,
  type SituacaoDocumento,
} from '@/lib/documentos/situacao';
import { APRESENTACAO_DA_SITUACAO } from './item-do-cofre';

/**
 * O selo de situação do cofre — texto, ícone e cor, nesta ordem de importância.
 *
 * O par (tom, ícone) vem de `APRESENTACAO_DA_SITUACAO`, em `item-do-cofre.ts`,
 * porque três lugares o consomem: esta célula, o painel e a faixa de
 * indicadores. O TEXTO é o que informa — o ícone e a cor só aceleram a
 * varredura, e quem enxerga verde e vermelho iguais continua lendo "Vencido".
 */
export default function SeloDocumento({
  situacao,
  className,
}: {
  situacao: SituacaoDocumento;
  className?: string;
}) {
  const { tom, icone, explicacao } = APRESENTACAO_DA_SITUACAO[situacao];
  return (
    <SeloSituacao tom={tom} icone={icone} explicacao={explicacao} className={className}>
      {ROTULO_DO_DOCUMENTO[situacao]}
    </SeloSituacao>
  );
}

/**
 * A validade como o comando pede: três ausências DIFERENTES, ditas por extenso.
 *
 *   "Não informada"   há arquivo, o documento vence e falta a data (pendência);
 *   "Não se aplica"   o documento não tem prazo (nada a fazer);
 *   "Sem arquivo"     a vaga está vazia — não há o que datar ainda.
 *
 * Célula vazia diria as três coisas ao mesmo tempo, e foi assim que documento
 * sem data passou a parecer em dia.
 *
 * A data usa `diaDaValidade`, NUNCA `new Date(validade)`: a coluna é `date` e
 * chega como `2026-09-13`, que o construtor lê como meia-noite UTC — em Belém
 * (UTC−3) isso imprime 12/09, o dia anterior ao cadastrado.
 */
export function ValidadeDoDocumento({
  validade,
  situacao,
  comPrazo = true,
}: {
  validade?: string | null;
  situacao: SituacaoDocumento;
  /** Segunda linha com "vence em 12 dias". Desligada em espaços apertados. */
  comPrazo?: boolean;
}) {
  if (validade) {
    const vencido = situacao === 'vencido';
    return (
      <span className="flex flex-col">
        <span className="tabular-nums">{diaDaValidade(validade).toLocaleDateString('pt-BR')}</span>
        {comPrazo && (
          <span className={`g-meta ${vencido ? 'text-destructive-ink' : 'text-muted-foreground'}`}>
            {frasePrazo(validade)}
          </span>
        )}
      </span>
    );
  }

  if (situacao === 'nao_se_aplica') {
    return <span className="g-corpo text-muted-foreground">Não se aplica</span>;
  }
  if (situacao === 'ausente') {
    return <span className="g-corpo text-muted-foreground">Sem arquivo</span>;
  }
  return (
    <span className="g-corpo inline-flex items-center gap-1.5 text-warning-ink">
      <HelpCircle aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      Não informada
    </span>
  );
}
