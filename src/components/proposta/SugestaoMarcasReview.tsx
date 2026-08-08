import { useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Check, X, Sparkles, TrendingUp, Building2, Package, Loader2, RefreshCw, Info } from 'lucide-react';
import { useSugestaoMarcas, type SugestaoMarca } from '@/hooks/useSugestaoMarcas';

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

const scoreColor = (score: number) => {
  if (score >= 90) return 'text-success bg-success/10';
  if (score >= 70) return 'text-info bg-info/10';
  if (score >= 50) return 'text-warning bg-warning/10';
  return 'text-destructive bg-destructive/10';
};

function SugestaoCard({ sugestao, onAceitar, onRejeitar, onAplicar }: {
  sugestao: SugestaoMarca;
  onAceitar: () => void;
  onRejeitar: () => void;
  onAplicar: () => void;
}) {
  const isAceito = sugestao.status === 'aceito';
  const isRejeitado = sugestao.status === 'rejeitado';

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
      isAceito ? 'bg-success/10 border-success/30' :
      isRejeitado ? 'bg-muted/50 border-muted opacity-60' :
      'bg-card border-border hover:border-primary/30'
    }`}>
      <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${scoreColor(sugestao.score_confianca)}`}>
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
          <Badge variant="outline" className="text-xs">
            {fonteLabel[sugestao.fonte] || sugestao.fonte}
          </Badge>
          <Badge className={`text-xs ${scoreColor(sugestao.score_confianca)}`}>
            {sugestao.score_confianca}% confiança
          </Badge>
          {sugestao.preco_historico && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              R$ {sugestao.preco_historico.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          )}
          {isAceito && <Badge className="bg-success text-success-foreground text-xs">Aceito ✓</Badge>}
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
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-success hover:bg-success/10" onClick={onAplicar} title="Aplicar na proposta">
            <Check className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10" onClick={onRejeitar} title="Rejeitar">
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
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-muted-foreground" />
            Sugestão de Marcas & Modelos
          </CardTitle>
          <div className="flex items-center gap-2">
            {sugestoes.length > 0 && (
              <div className="flex gap-1.5 text-xs">
                <Badge variant="outline">{totalPendentes} pendentes</Badge>
                <Badge className="bg-success text-success-foreground">{totalAceitas} aceitas</Badge>
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
          <div className="text-center py-6 text-muted-foreground">
            <Sparkles className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhuma sugestão gerada ainda.</p>
            <p className="text-xs mt-1">Clique em "Gerar Sugestões" para analisar o histórico de processos anteriores e sugerir marcas/modelos compatíveis com o TR.</p>
          </div>
        )}

        {!isGenerating && Object.entries(sugestoesPorItem).map(([descricao, sugs]) => (
          <div key={descricao} className="space-y-2">
            <h4 className="text-sm font-medium text-foreground truncate" title={descricao}>
              📦 {descricao}
            </h4>
            <div className="space-y-1.5 pl-2 border-l-2 border-primary/20">
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
