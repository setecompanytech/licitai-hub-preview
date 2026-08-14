import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, AlertTriangle, CheckCircle2, Calculator, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useProcessoAutoPrepare } from '@/hooks/useProcessoAutoPrepare';

interface Props {
  licitacaoId: string;
  urlEdital: string | null;
  /** Navega para a aba/tela de precificação do processo (opcional). */
  onVerItens?: () => void;
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
export default function EditalOriginalCard({ licitacaoId, urlEdital, onVerItens }: Props) {
  const { prepared, running, totalItens, trigger } = useProcessoAutoPrepare(
    licitacaoId,
    { autoRun: true },
  );

  const handleReprocess = async () => {
    toast.info('Refazendo preparação automática…');
    const ok = await trigger(true);
    if (ok) toast.success('Preparação concluída.');
    else toast.warning('Não foi possível concluir a preparação automática. O edital continua acessível no card "Edital em tela".');
  };

  const unavailable = !prepared && !running;

  return (
    <Card className="px-4 py-3">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-semibold">Preparação automática</span>

        {running && (
          <Badge variant="outline" className="gap-1 text-xs">
            <Loader2 className="w-3 h-3 animate-spin" /> Extraindo itens do edital…
          </Badge>
        )}
        {prepared && (
          <Badge variant="outline" className="gap-1 text-xs">
            <CheckCircle2 className="w-3 h-3 text-success" />
            {totalItens != null && totalItens > 0 ? `${totalItens} itens extraídos` : 'Pronto'}
          </Badge>
        )}
        {unavailable && (
          <Badge variant="outline" className="gap-1 text-xs">
            <AlertTriangle className="w-3 h-3 text-warning" /> Itens não extraídos
          </Badge>
        )}

        <div className="flex items-center gap-1.5 ml-auto">
          {prepared && totalItens != null && totalItens > 0 && onVerItens && (
            <Button size="sm" variant="outline" className="h-7" onClick={onVerItens}>
              <Calculator className="w-3.5 h-3.5 mr-1.5" /> Ver na Precificação
            </Button>
          )}
          {unavailable && urlEdital && (
            <Button asChild size="sm" variant="ghost" className="h-7">
              <a href={urlEdital} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Portal de origem
              </a>
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-7" onClick={handleReprocess} disabled={running}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${running ? 'animate-spin' : ''}`} />
            {prepared ? 'Reprocessar' : 'Tentar novamente'}
          </Button>
        </div>
      </div>
    </Card>
  );
}
