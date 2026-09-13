import { useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Check, X, Sparkles, TrendingUp, Building2, Package, Loader2, RefreshCw, Info } from 'lucide-react';
import { useSugestaoMarcas, type SugestaoMarca } from '@/hooks/useSugestaoMarcas';
import EstadoVazio from '@/components/shared/EstadoVazio';

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
      'border-border bg-card hover:border-primary'
    }`}>
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-bold tabular-nums ${scoreTint[variante]}`}>
        {sugestao.ranking}º
      </div>

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-foreground">{sugestao.marca_sugerida}</span>
          {sugestao.fabricante_sugerido && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Building2 className="h-3 w-3" /> {sugestao.fabricante_sugerido}
            </span>
          )}
          {sugestao.modelo_sugerido && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Package className="h-3 w-3" /> {sugestao.modelo_sugerido}
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
                <p className="text-xs text-muted-foreground line-clamp-2 cursor-help flex items-start gap-1">
                  <Info className="h-3 w-3 mt-0.5 shrink-0" />
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
        <div className="flex gap-1 shrink-0">
          <Button
            size="sm"
            variant="ghost"
            className="h-9 w-9 p-0 text-success-ink hover:bg-success-tint hover:text-success-ink"
            onClick={onAplicar}
            title="Aplicar na proposta"
            aria-label="Aplicar na proposta"
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-9 w-9 p-0 text-destructive hover:bg-destructive-tint hover:text-destructive"
            onClick={onRejeitar}
            title="Rejeitar"
            aria-label="Rejeitar sugestão"
          >
            <X className="h-4 w-4" />
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
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            Sugestão de marcas e modelos
          </CardTitle>
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
              className="gap-1.5"
            >
              {isGenerating ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Analisando...</>
              ) : sugestoes.length > 0 ? (
                <><RefreshCw className="h-4 w-4" /> Reanalisar</>
              ) : (
                <><Sparkles className="h-4 w-4" /> Gerar Sugestões</>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isGenerating && (
          <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Analisando histórico de processos e cruzando com o TR...</span>
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
