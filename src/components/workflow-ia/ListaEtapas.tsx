import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import SeloSituacao from '@/components/gestao/SeloSituacao';
import { cn } from '@/lib/utils';
import {
  ROTULO_SITUACAO,
  TOM_SITUACAO,
  WORKFLOW_STEPS,
  type SituacaoEtapa,
} from './etapas';

/**
 * ListaEtapas — a coluna da esquerda da composição de três colunas.
 *
 * Substitui os oito cartões empilhados que a tela tinha: com o resultado de
 * cada etapa aberto dentro do próprio cartão, oito respostas de IA formavam
 * uma página de rolagem infinita em que era impossível ver a etapa 1 e a 8 ao
 * mesmo tempo. Aqui a lista inteira cabe numa olhada e o conteúdo vai para o
 * centro.
 *
 * Cada item é um BOTÃO de verdade, não uma `div` com `onClick`: a lista é
 * navegável por teclado, e `aria-current="step"` conta a quem usa leitor de
 * tela qual etapa está aberta.
 */
interface ListaEtapasProps {
  /** Situação de cada etapa, resolvida pela página (que é quem tem o estado). */
  situacaoDaEtapa: (key: string) => SituacaoEtapa;
  /** Etapa aberta na coluna do meio. */
  selecionada: string;
  aoSelecionar: (key: string) => void;
}

/** Ícone do círculo: o da situação quando há uma, o da etapa quando não há. */
function circuloDaSituacao(situacao: SituacaoEtapa) {
  switch (situacao) {
    case 'analisada':
      return { classe: 'bg-success-tint text-success-ink', Icone: CheckCircle2, girando: false };
    case 'analisando':
      return { classe: 'bg-warning-tint text-warning-ink', Icone: Loader2, girando: true };
    case 'falhou':
      return { classe: 'bg-destructive-tint text-destructive-ink', Icone: AlertTriangle, girando: false };
    default:
      return { classe: 'bg-muted text-muted-foreground', Icone: null, girando: false };
  }
}

export default function ListaEtapas({
  situacaoDaEtapa,
  selecionada,
  aoSelecionar,
}: ListaEtapasProps) {
  return (
    <nav aria-label="Etapas da análise" className="g-cartao overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <h2 className="g-titulo-secao text-foreground">
          Etapas
          <span className="ml-1.5 font-normal text-muted-foreground tabular-nums">
            ({WORKFLOW_STEPS.length})
          </span>
        </h2>
        {/* A honestidade repetida onde a pessoa escolhe: nenhum item desta
            lista dispara operação no sistema. */}
        <p className="g-meta mt-0.5 text-muted-foreground">Cada etapa é uma análise da IA</p>
      </div>

      <ol className="flex flex-col py-1">
        {WORKFLOW_STEPS.map((etapa, idx) => {
          const situacao = situacaoDaEtapa(etapa.key);
          const aberta = etapa.key === selecionada;
          const { classe, Icone, girando } = circuloDaSituacao(situacao);
          const IconeEtapa = etapa.icon;

          return (
            <li key={etapa.key}>
              <button
                type="button"
                onClick={() => aoSelecionar(etapa.key)}
                aria-current={aberta ? 'step' : undefined}
                className={cn(
                  // `items-start` + `min-w-0` para o rótulo quebrar em duas
                  // linhas na coluna estreita em vez de ser cortado.
                  'flex w-full items-start gap-3 border-l-2 px-3 py-2.5 text-left transition-colors',
                  'min-h-[var(--g-linha)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  aberta
                    ? 'border-primary bg-primary-tint'
                    : 'border-transparent hover:bg-muted',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                    classe,
                  )}
                >
                  {Icone ? (
                    <Icone className={cn('h-4 w-4', girando && 'animate-spin')} />
                  ) : (
                    <IconeEtapa className="h-4 w-4" />
                  )}
                </span>

                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="g-corpo font-medium text-foreground">
                    <span aria-hidden="true" className="mr-1 tabular-nums text-muted-foreground">
                      {idx + 1}.
                    </span>
                    {etapa.label}
                  </span>
                  <SeloSituacao tom={TOM_SITUACAO[situacao]} className="self-start">
                    {ROTULO_SITUACAO[situacao]}
                  </SeloSituacao>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
