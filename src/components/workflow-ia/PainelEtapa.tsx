import ReactMarkdown from 'react-markdown';
import { AlertTriangle, Lightbulb, Loader2, RotateCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import EstadoVazio from '@/components/shared/EstadoVazio';
import SeloSituacao from '@/components/gestao/SeloSituacao';
import {
  MARKDOWN_ETAPA,
  ROTULO_SITUACAO,
  TOM_SITUACAO,
  WORKFLOW_STEPS,
  type EtapaWorkflow,
  type SituacaoEtapa,
} from './etapas';

/**
 * PainelEtapa — a coluna do meio: o que a etapa aberta produziu.
 *
 * Três responsabilidades, e a primeira é a que a tela antiga não tinha:
 *
 *  1. Dizer o que aquele texto É. O modelo escreve "Ações executadas nesta
 *     etapa" porque o prompt pede isso, mas nada foi executado — a chamada é
 *     de texto puro. O carimbo acima do conteúdo desfaz a ambiguidade antes
 *     de a pessoa começar a ler.
 *  2. Mostrar FALHA como falha, com a mensagem real que `ai-stream.ts`
 *     devolve (401, 402, 429, 504…). A tela antiga gravava a string genérica
 *     "Erro ao executar esta etapa." e ainda marcava a etapa como concluída.
 *  3. Oferecer a recuperação no lugar onde a falha aparece — refazer só
 *     aquela etapa, sem repetir as outras sete.
 */
interface PainelEtapaProps {
  etapa: EtapaWorkflow;
  situacao: SituacaoEtapa;
  /** Markdown que a IA devolveu; string vazia enquanto não chegou nada. */
  resultado: string;
  /** Mensagem real do erro, quando a etapa falhou. */
  erro?: string;
  /** Há alguma chamada de IA em curso — trava a retentativa. */
  ocupado: boolean;
  aoRetentar: () => void;
  /** Sem empresa escolhida não há o que analisar. */
  podeIniciar: boolean;
}

export default function PainelEtapa({
  etapa,
  situacao,
  resultado,
  erro,
  ocupado,
  aoRetentar,
  podeIniciar,
}: PainelEtapaProps) {
  const ordem = WORKFLOW_STEPS.findIndex((e) => e.key === etapa.key) + 1;
  const Icone = etapa.icon;
  const temTexto = resultado.trim().length > 0;

  return (
    <section aria-labelledby="workflow-etapa-titulo" className="g-cartao flex min-w-0 flex-col">
      <header className="flex flex-col gap-2 border-b border-border p-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary"
          >
            <Icone className="h-4 w-4" />
          </span>
          <h2 id="workflow-etapa-titulo" className="g-titulo-secao min-w-0 text-foreground">
            <span className="text-muted-foreground tabular-nums">
              Etapa {ordem} de {WORKFLOW_STEPS.length} ·{' '}
            </span>
            {etapa.label}
          </h2>
          <SeloSituacao tom={TOM_SITUACAO[situacao]}>{ROTULO_SITUACAO[situacao]}</SeloSituacao>
        </div>
        <p className="g-corpo text-muted-foreground">{etapa.desc}</p>
      </header>

      <div className="flex min-w-0 flex-col gap-4 p-4">
        {situacao === 'falhou' && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>Esta etapa falhou</AlertTitle>
            <AlertDescription className="flex flex-col gap-3">
              {/* A mensagem REAL, não um texto genérico: é ela que diferencia
                  "faça login de novo" (401) de "acabaram os créditos" (402) de
                  "espere alguns segundos" (429). */}
              <p className="g-corpo">{erro || 'Falha sem mensagem do servidor.'}</p>
              <div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={aoRetentar}
                  disabled={ocupado || !podeIniciar}
                  className="g-controle"
                >
                  <RotateCw aria-hidden="true" className="h-4 w-4" /> Tentar novamente esta etapa
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {temTexto && (
          <>
            {/* O carimbo fica COLADO no conteúdo, não no topo da página: é
                aqui que a pessoa lê "Ações executadas" escrito pelo modelo. */}
            <p className="g-meta flex items-center gap-1.5 text-muted-foreground">
              <Lightbulb aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              Sugestão da IA. Nada foi agendado, enviado, precificado ou lançado por esta tela.
            </p>
            <div className="rounded-[var(--g-raio)] border border-border bg-muted p-4">
              <div className={MARKDOWN_ETAPA}>
                <ReactMarkdown>{resultado}</ReactMarkdown>
              </div>
            </div>
          </>
        )}

        {situacao === 'analisando' && !temTexto && (
          <p role="status" className="g-corpo flex items-center gap-2 text-muted-foreground">
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            Gerando a análise desta etapa...
          </p>
        )}

        {situacao === 'pendente' && !temTexto && (
          <EstadoVazio
            tamanho="compacto"
            icone={<Icone />}
            titulo="Etapa ainda não analisada"
            // Sem botão aqui: a ação principal da tela é uma só, a do
            // cabeçalho. Repeti-la no vazio de cada etapa daria oito botões
            // idênticos disputando a mesma atenção — e a análise roda nas oito
            // em fila, nunca só nesta.
            descricao={
              podeIniciar
                ? 'Use "Gerar análise das 8 etapas", no alto da tela, para ver o que a IA sugere aqui.'
                : 'Escolha uma empresa no alto da tela para gerar a análise das oito etapas.'
            }
          />
        )}
      </div>
    </section>
  );
}
