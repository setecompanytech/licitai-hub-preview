import { RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { horaDeBrasilia } from './robo-do-cliente';
import { useSituacaoDoRobo } from './useSituacaoDoRobo';

/**
 * Uma linha: o robô está disponível para esta empresa?
 *
 * É o "ponto de conexão" da referência de mercado — e é SÓ isso. Nada de
 * healthcheck, versão, slots ou RAM: o cliente não decide sobre eles. A resposta
 * vem da ação `situacao-do-robo`, que traduz a infraestrutura num sim, num não
 * com motivo de negócio, ou em "não sei agora".
 *
 * O ponto colorido é reforço, nunca a informação: o texto ao lado diz sempre o
 * mesmo que a cor, para quem não distingue verde de âmbar e para leitor de tela.
 */
export default function SituacaoDoRoboEmLinha({
  empresaId,
  acompanhar = false,
  className,
}: {
  empresaId: string | null | undefined;
  /**
   * Reperguntar sozinho a cada 60 s. Só UMA linha na tela deve acompanhar (o
   * cabeçalho): a ação grava registro quando o robô está indisponível — ver
   * `useSituacaoDoRobo`. As demais leem o cache e oferecem "Atualizar".
   */
  acompanhar?: boolean;
  className?: string;
}) {
  const { situacao, carregando, indisponivel, recarregar } = useSituacaoDoRobo(empresaId, { acompanhar });
  const verificado = horaDeBrasilia(situacao?.verificado_em);

  let ponto = 'bg-muted-foreground';
  let texto: string;
  if (carregando) {
    texto = 'Verificando a situação do robô…';
  } else if (situacao?.disponivel) {
    ponto = 'bg-success';
    texto = 'Disponível';
  } else if (situacao) {
    ponto = 'bg-warning';
    texto = situacao.motivo || 'Indisponível no momento';
  } else {
    texto = 'Situação do robô indisponível no momento';
  }

  return (
    <p role="status" className={cn('g-meta inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground', className)}>
      <span className={cn('h-2 w-2 shrink-0 rounded-full', ponto)} aria-hidden="true" />
      <span className="font-medium text-foreground">{texto}</span>
      {verificado && !carregando && <span>· verificado em {verificado} (Brasília)</span>}
      {/* Pergunta manual: sempre que a linha não acompanha sozinha, e na que
          acompanha só quando a última pergunta ficou sem resposta. */}
      {!!empresaId && !carregando && (indisponivel || !acompanhar) && (
        <button
          type="button"
          onClick={() => recarregar()}
          className="inline-flex items-center gap-1 rounded-sm text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <RotateCw className="h-3 w-3" aria-hidden="true" />
          Atualizar
        </button>
      )}
    </p>
  );
}
