import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Calculator, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useProcessoAutoPrepare } from '@/hooks/useProcessoAutoPrepare';

interface Props {
  licitacaoId: string;
  urlEdital: string | null;
  /** Navega para a aba/tela de precificação do processo (opcional). */
  onVerItens?: () => void;
  /** Itens já materializados em licitacao_itens (pelo espelho PNCP ou pipeline). */
  itensProntos?: number;
  /** O processo tem coordenadas PNCP? Se sim, quem materializa é o ESPELHO da
   *  Visão Geral (dado estruturado, sem IA); o pipeline do servidor só roda
   *  como fallback para processos fora do PNCP. */
  pncpDisponivel?: boolean;
}

/**
 * Linha de status da PREPARAÇÃO AUTOMÁTICA do processo.
 *
 * Este card já foi um "Edital Original" com botões de abrir/baixar PDF — mas a
 * exibição do edital é papel do "Edital em tela" (EditalViewer), logo abaixo,
 * que lista todos os arquivos e renderiza inline. Ter os dois criava a cena de
 * um "Indisponível" laranja em cima de um visualizador funcionando.
 *
 * O que restou aqui é o valor que o viewer NÃO cobre: o pipeline de preparação
 * (baixar edital na fonte + extrair itens para a Precificação) — com status
 * honesto e retry.
 */
export default function EditalOriginalCard({ licitacaoId, urlEdital, onVerItens, itensProntos, pncpDisponivel }: Props) {
  const temItens = (itensProntos ?? 0) > 0;
  const { prepared, running, totalItens, trigger } = useProcessoAutoPrepare(
    licitacaoId,
    // Fallback, não protagonista: só auto-dispara quando o processo não tem
    // fonte PNCP (fora do portal) — com fonte, o espelho materializa os itens.
    { autoRun: !pncpDisponivel && !temItens },
  );

  const handleReprocess = async () => {
    toast.info('Refazendo preparação automática…');
    const ok = await trigger(true);
    if (ok) toast.success('Preparação concluída.');
    else toast.warning('Não foi possível concluir a preparação automática. O edital continua acessível no card "Edital em tela".');
  };

  const unavailable = !prepared && !running && !temItens;

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">Preparação automática</h2>

        {temItens && (
          <Badge variant="success">{itensProntos} itens prontos · espelho PNCP</Badge>
        )}
        {!temItens && running && (
          <Badge variant="info" className="gap-1">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Extraindo itens do edital…
          </Badge>
        )}
        {!temItens && prepared && (
          <Badge variant="success">
            {totalItens != null && totalItens > 0 ? `${totalItens} itens extraídos` : 'Pronto'}
          </Badge>
        )}
        {unavailable && (
          <Badge variant="warning">Itens não extraídos</Badge>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {(temItens || (prepared && totalItens != null && totalItens > 0)) && onVerItens && (
            <Button size="sm" variant="outline" onClick={onVerItens}>
              <Calculator className="w-4 h-4" aria-hidden="true" /> Ver na Precificação
            </Button>
          )}
          {unavailable && urlEdital && (
            <Button asChild size="sm" variant="ghost">
              <a href={urlEdital} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4" aria-hidden="true" /> Portal de origem
              </a>
            </Button>
          )}
          {!temItens && (
            <Button size="sm" variant="ghost" onClick={handleReprocess} disabled={running}>
              <RefreshCw className={`w-4 h-4 ${running ? 'animate-spin' : ''}`} aria-hidden="true" />
              {prepared ? 'Reprocessar' : 'Tentar novamente'}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
