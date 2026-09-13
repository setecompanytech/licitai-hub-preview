import { Link } from 'react-router-dom';
import { ArrowRight, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import ListaDeCampos, { BlocoDoPainel } from '@/components/gestao/ListaDeCampos';
import { AvisoDeContexto, ValorIndisponivel } from '@/components/gestao/SeloSituacao';
import { WORKFLOW_STEPS } from './etapas';

/**
 * ResumoExecucao — a coluna da direita: o placar da análise.
 *
 * Todo número aqui é contado do estado real da tela (o `Set` de etapas
 * concluídas e o mapa de falhas), nunca estimado. E o campo mais importante é
 * o que NÃO tem número: "Registros criados: nenhum". Ele existe porque a
 * leitura natural de uma barra em 100% é "pronto, o sistema fez" — e o
 * sistema não fez nada. A linha desfaz essa leitura no mesmo lugar onde ela
 * nasce.
 *
 * O caminho para Compromissos fica aqui, permanente, porque é lá que a
 * sugestão vira decisão de alguém.
 */
interface ResumoExecucaoProps {
  /** Etapas com análise pronta — `completed.size`. */
  prontas: number;
  /** Etapas que falharam, com mensagem real guardada. */
  falhas: number;
  /** Nome da empresa usada na análise; `null` quando nenhuma foi escolhida. */
  empresaNome: string | null;
  /** Há chamada de IA em curso — trava a retentativa em lote. */
  ocupado: boolean;
  aoRetentarFalhas: () => void;
}

export default function ResumoExecucao({
  prontas,
  falhas,
  empresaNome,
  ocupado,
  aoRetentarFalhas,
}: ResumoExecucaoProps) {
  const total = WORKFLOW_STEPS.length;
  // Mesma conta da barra de progresso da página: etapas concluídas sobre oito.
  const percentual = total > 0 ? (prontas / total) * 100 : 0;
  const naoAnalisadas = Math.max(0, total - prontas - falhas);

  return (
    <aside aria-label="Resumo da análise" className="g-cartao flex flex-col gap-4 p-4">
      <BlocoDoPainel titulo="Resumo da análise">
        <div className="flex items-center justify-between gap-3">
          <span className="g-corpo text-muted-foreground">Etapas analisadas</span>
          <span className="g-corpo font-medium tabular-nums text-foreground">
            {prontas} de {total}
          </span>
        </div>
        <Progress value={percentual} className="h-2" aria-label="Progresso da análise" />

        <ListaDeCampos
          className="mt-1"
          campos={[
            { rotulo: 'Análises prontas', valor: prontas, numerico: true },
            { rotulo: 'Falhas', valor: falhas, numerico: true },
            { rotulo: 'Ainda não analisadas', valor: naoAnalisadas, numerico: true },
            {
              rotulo: 'Empresa analisada',
              valor: empresaNome ?? <ValorIndisponivel razao="Nenhuma empresa escolhida" />,
              largo: true,
            },
            {
              rotulo: 'Registros criados no sistema',
              valor: 'Nenhum',
            },
          ]}
        />
      </BlocoDoPainel>

      {falhas > 0 && (
        <AvisoDeContexto
          titulo={falhas === 1 ? '1 etapa falhou' : `${falhas} etapas falharam`}
          acao={
            <Button
              type="button"
              variant="outline"
              onClick={aoRetentarFalhas}
              disabled={ocupado}
              className="g-controle"
            >
              <RotateCw aria-hidden="true" className="h-4 w-4" /> Tentar de novo
            </Button>
          }
        >
          Abra a etapa na lista à esquerda para ler a mensagem do erro.
        </AvisoDeContexto>
      )}

      <BlocoDoPainel titulo="O que acontece depois">
        <p className="g-corpo text-muted-foreground">
          Esta tela não cria processo, compromisso, alerta, proposta nem lance. O texto das oito
          etapas é gerado pela IA, fica só nesta sessão e some ao recarregar a página.
        </p>
        <p className="g-corpo text-muted-foreground">
          Aprovar, agendar e executar continua sendo decisão de alguém, em{' '}
          <Link
            to="/meus-compromissos"
            className="font-medium text-primary underline underline-offset-2"
          >
            Meus compromissos
            <ArrowRight aria-hidden="true" className="ml-1 inline h-3.5 w-3.5" />
          </Link>
          .
        </p>
      </BlocoDoPainel>
    </aside>
  );
}
