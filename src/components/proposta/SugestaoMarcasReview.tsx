import { useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Check, X, Sparkles, TrendingUp, Building2, Package, Loader2, RefreshCw, Info } from 'lucide-react';
import { useSugestaoMarcas, type SugestaoMarca } from '@/hooks/useSugestaoMarcas';
import EstadoVazio from '@/components/shared/EstadoVazio';
import SeloPraefectusIA from '@/components/shared/SeloPraefectusIA';

interface SugestaoMarcasReviewProps {
  licitacaoId: string;
  itens?: Array<{
    id?: string;
    numero?: number;
    descricao: string;
    quantidade?: number;
    unidade?: string;
    valor_unitario?: number;
  }>;
  onMarcaAplicada?: (itemId: string, marca: string) => void;
}

const fonteLabel: Record<string, string> = {
  historico_precos: 'Histórico de Preços',
  itens_anteriores: 'Itens Anteriores',
  agente_ia: 'Agente IA',
  pncp: 'Portal PNCP',
  historico: 'Histórico',
};

/** Faixa de confiança → família semântica em tinta (fundo/tinta/contorno). */
const scoreVariant = (score: number): 'success' | 'info' | 'warning' | 'danger' => {
  if (score >= 90) return 'success';
  if (score >= 70) return 'info';
  if (score >= 50) return 'warning';
  return 'danger';
};

const scoreTint: Record<'success' | 'info' | 'warning' | 'danger', string> = {
  success: 'border-success-line bg-success-tint text-success-ink',
  info: 'border-border bg-muted text-foreground',
  warning: 'border-warning-line bg-warning-tint text-warning-ink',
  danger: 'border-destructive-line bg-destructive-tint text-destructive-ink',
};

function SugestaoCard({ sugestao, onAceitar, onRejeitar, onAplicar }: {
  sugestao: SugestaoMarca;
  onAceitar: () => void;
  onRejeitar: () => void;
  onAplicar: () => void;
}) {
  const isAceito = sugestao.status === 'aceito';
  const isRejeitado = sugestao.status === 'rejeitado';
  const variante = scoreVariant(sugestao.score_confianca);

  return (
    <div className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
      isAceito ? 'border-success-line bg-success-tint' :
      isRejeitado ? 'border-border bg-muted opacity-60' :
      'border-border bg-card hover:border-primary/40'
    }`}>
      {/* Posição no ranking num ladrilho `rounded-md` tingido pela confiança. */}
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-sm font-semibold tabular-nums ${scoreTint[variante]}`}>
        {sugestao.ranking}º
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-foreground">{sugestao.marca_sugerida}</span>
          {sugestao.fabricante_sugerido && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Building2 className="h-3 w-3" aria-hidden="true" /> {sugestao.fabricante_sugerido}
            </span>
          )}
          {sugestao.modelo_sugerido && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Package className="h-3 w-3" aria-hidden="true" /> {sugestao.modelo_sugerido}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="muted">
            {fonteLabel[sugestao.fonte] || sugestao.fonte}
          </Badge>
          <Badge variant={variante}>
            {sugestao.score_confianca}% confiança
          </Badge>
          {sugestao.preco_historico && (
            <span className="flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
              <TrendingUp className="h-3 w-3" aria-hidden="true" />
              R$ {sugestao.preco_historico.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          )}
          {isAceito && <Badge variant="success">Aceito</Badge>}
        </div>

        {sugestao.justificativa_ia && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="flex cursor-help items-start gap-1 text-xs text-muted-foreground line-clamp-2">
                  <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                  {sugestao.justificativa_ia}
                </p>
              </TooltipTrigger>
              <TooltipContent className="max-w-sm">
                <p className="text-sm">{sugestao.justificativa_ia}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {sugestao.orgao_origem && (
          <p className="text-xs text-muted-foreground">
            Órgão: {sugestao.orgao_origem}
            {sugestao.numero_processo_origem && ` — Proc. ${sugestao.numero_processo_origem}`}
          </p>
        )}
      </div>

      {!isAceito && !isRejeitado && (
        <div className="flex shrink-0 gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            className="text-success-ink hover:bg-success-tint hover:text-success-ink"
            onClick={onAplicar}
            title="Aplicar na proposta"
            aria-label="Aplicar na proposta"
          >
            <Check aria-hidden="true" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost-destructive"
            onClick={onRejeitar}
            title="Rejeitar"
            aria-label="Rejeitar sugestão"
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default function SugestaoMarcasReview({ licitacaoId, itens, onMarcaAplicada }: SugestaoMarcasReviewProps) {
  const {
    sugestoesPorItem,
    isGenerating,
    fetchSugestoes,
    gerarSugestoes,
    aceitarSugestao,
    rejeitarSugestao,
    aplicarNaProposta,
    sugestoes,
  } = useSugestaoMarcas();

  useEffect(() => {
    if (licitacaoId) fetchSugestoes(licitacaoId);
  }, [licitacaoId, fetchSugestoes]);

  const handleGerar = () => {
    if (!itens?.length) return;
    gerarSugestoes(licitacaoId, itens);
  };

  const handleAplicar = async (sugestao: SugestaoMarca) => {
    if (!sugestao.licitacao_item_id) {
      // If no item linked, just accept
      await aceitarSugestao(sugestao.id);
      onMarcaAplicada?.('', sugestao.marca_sugerida);
      return;
    }
    const ok = await aplicarNaProposta(sugestao.id, sugestao.licitacao_item_id);
    if (ok) onMarcaAplicada?.(sugestao.licitacao_item_id, sugestao.marca_sugerida);
  };

  const totalPendentes = sugestoes.filter(s => s.status === 'pendente').length;
  const totalAceitas = sugestoes.filter(s => s.status === 'aceito').length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Recurso de IA: o selo "Praefectus IA" identifica a sugestão. */}
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              Sugestão de marcas e modelos
            </CardTitle>
            <SeloPraefectusIA />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {sugestoes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <Badge variant="muted">{totalPendentes} pendentes</Badge>
                <Badge variant="success">{totalAceitas} aceitas</Badge>
              </div>
            )}
            <Button
              size="sm"
              onClick={handleGerar}
              disabled={isGenerating || !itens?.length}
            >
              {isGenerating ? (
                <><Loader2 className="animate-spin" aria-hidden="true" /> Analisando...</>
              ) : sugestoes.length > 0 ? (
                <><RefreshCw aria-hidden="true" /> Reanalisar</>
              ) : (
                <><Sparkles aria-hidden="true" /> Gerar Sugestões</>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isGenerating && (
          /* Espera da IA na forma das sugestões que vão chegar (linhas), no
             bloco tingido da ação — em vez do spinner no centro. */
          <div role="status" className="space-y-2 rounded-lg border border-primary-line bg-primary-tint p-4">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <p className="pt-1 text-sm text-muted-foreground">Analisando histórico de processos e cruzando com o TR...</p>
          </div>
        )}

        {!isGenerating && sugestoes.length === 0 && (
          <EstadoVazio
            tamanho="compacto"
            icone={<Sparkles />}
            titulo="Nenhuma sugestão gerada ainda"
            descricao={'Clique em "Gerar Sugestões" para analisar o histórico de processos anteriores e sugerir marcas/modelos compatíveis com o TR.'}
          />
        )}

        {!isGenerating && Object.entries(sugestoesPorItem).map(([descricao, sugs]) => (
          <div key={descricao} className="space-y-2">
            <h4 className="truncate text-sm font-semibold text-foreground" title={descricao}>
              {descricao}
            </h4>
            <div className="space-y-2 border-l-2 border-border pl-3">
              {sugs.map(sug => (
                <SugestaoCard
                  key={sug.id}
                  sugestao={sug}
                  onAceitar={() => aceitarSugestao(sug.id)}
                  onRejeitar={() => rejeitarSugestao(sug.id)}
                  onAplicar={() => handleAplicar(sug)}
                />
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
