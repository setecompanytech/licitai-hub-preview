import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Calculator, ExternalLink, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useProcessoAutoPrepare } from '@/hooks/useProcessoAutoPrepare';
import { aoAlterarAnexos, temEditalAnexado } from '@/lib/processo/edital-anexado';

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
 *
 * Processo fora do PNCP (criado à mão): a única fonte é o edital anexado à
 * pasta. Sem ele, a preparação não tem o que ler — o card pede o envio em vez
 * de disparar o pipeline a cada abertura só para falhar de novo.
 */
export default function EditalOriginalCard({ licitacaoId, urlEdital, onVerItens, itensProntos, pncpDisponivel }: Props) {
  const temItens = (itensProntos ?? 0) > 0;
  const [, setSearchParams] = useSearchParams();

  // null = ainda não se sabe (carregando ou a consulta falhou)
  const [anexado, setAnexado] = useState<boolean | null>(null);
  const [erroVerificacao, setErroVerificacao] = useState<string | null>(null);

  const verificarAnexo = useCallback(async (): Promise<boolean | null> => {
    try {
      const tem = await temEditalAnexado(licitacaoId);
      setAnexado(tem);
      setErroVerificacao(null);
      return tem;
    } catch (e) {
      setErroVerificacao(e instanceof Error ? e.message : 'Não foi possível verificar o edital anexado.');
      return null;
    }
  }, [licitacaoId]);

  useEffect(() => {
    setAnexado(null);
    verificarAnexo();
    // O edital enviado em Anexos, na mesma página, atualiza o card.
    return aoAlterarAnexos(licitacaoId, () => { verificarAnexo(); });
  }, [licitacaoId, verificarAnexo]);

  const { prepared, running, totalItens, trigger } = useProcessoAutoPrepare(
    licitacaoId,
    // Fallback, não protagonista: só auto-dispara quando o processo não tem
    // fonte PNCP (fora do portal) — com fonte, o espelho materializa os itens.
    // E só com edital anexado: sem nenhuma fonte, cada abertura da pasta
    // disparava o pipeline para gravar mais uma falha.
    { autoRun: !pncpDisponivel && !temItens && anexado === true },
  );

  const semEdital = !pncpDisponivel && anexado === false;

  const irParaAnexos = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('aba', 'documentos');
      next.set('pasta', 'edital');
      return next;
    }, { replace: true });
  };

  const handleReprocess = async () => {
    if (!pncpDisponivel) {
      const tem = await verificarAnexo();
      if (tem === false) {
        toast.warning('Não há edital para preparar: envie o edital em Anexos › Edital.');
        return;
      }
    }
    toast.info('Refazendo preparação automática…');
    const ok = await trigger(true);
    if (ok) toast.success('Preparação concluída.');
    else if (pncpDisponivel) toast.warning('Não foi possível concluir a preparação automática. O edital continua acessível no card "Edital em tela".');
    else toast.warning('Não foi possível concluir a preparação automática com o edital anexado. O arquivo continua em Anexos › Edital.');
  };

  const unavailable = !prepared && !running && !temItens;

  return (
    // Uma linha só (18/09): o cartão de 86px gastava título de seção e respiro
    // de parágrafo para dizer um selo e um botão. A faixa diz o mesmo na
    // altura de um controle e sai da frente do que a aba existe para mostrar —
    // a pasta do processo.
    <Card className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2">
      <h2 className="g-corpo font-semibold">Preparação automática</h2>

      {temItens && (
        <Badge variant="success">{itensProntos} itens prontos{pncpDisponivel ? ' · espelho PNCP' : ''}</Badge>
      )}
      {!pncpDisponivel && anexado === true && (
        <Badge variant="outline">Edital anexado</Badge>
      )}
      {semEdital && (
        <Badge variant="warning">Sem edital: envie o edital em Anexos</Badge>
      )}
      {!pncpDisponivel && erroVerificacao && (
        <Badge variant="warning" title={erroVerificacao}>Não foi possível verificar o edital anexado</Badge>
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
      {unavailable && !semEdital && (
        <Badge variant="warning">Itens não extraídos</Badge>
      )}

      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        {(temItens || (prepared && totalItens != null && totalItens > 0)) && onVerItens && (
          <Button size="sm" variant="outline" onClick={onVerItens}>
            <Calculator className="w-4 h-4" aria-hidden="true" /> Ver na Precificação
          </Button>
        )}
        {semEdital && (
          <Button size="sm" variant="outline" onClick={irParaAnexos}>
            <Upload className="w-4 h-4" aria-hidden="true" /> Enviar o edital
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
    </Card>
  );
}
