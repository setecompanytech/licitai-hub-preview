import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, FileText, Sparkles, Calculator, AlertTriangle, ScrollText, ArrowRight, Package, FileSignature } from 'lucide-react';

const CAMPO_LABELS: Record<string, string> = {
  saldo_item_ata: 'Saldo de Item da ATA',
  valor_consumido_ata: 'Consumo da ATA',
  alerta_aditivo_valor: 'Alerta — Aditivo de Valor',
  alerta_aditivo_quantidade: 'Alerta — Aditivo de Quantidade',
};

const ORIGEM_META: Record<string, { label: string; icon: any; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  ia_extracao: { label: 'IA — Extração', icon: Sparkles, variant: 'secondary' },
  recalculo_saldo: { label: 'Recálculo automático', icon: Calculator, variant: 'outline' },
  recalculo_consumo_ata: { label: 'Consumo da ATA', icon: Calculator, variant: 'outline' },
  alerta_limite_legal: { label: 'Alerta legal (Lei 14.133/21)', icon: AlertTriangle, variant: 'destructive' },
};

const fmtBRL = (v: any) =>
  v == null || v === '' || isNaN(Number(v))
    ? '—'
    : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v));

const fmtNum = (v: any) =>
  v == null || v === '' || isNaN(Number(v)) ? '—' : new Intl.NumberFormat('pt-BR').format(Number(v));

const fmtDate = (v: any) => {
  if (!v) return '—';
  try { return new Date(v).toLocaleString('pt-BR'); } catch { return String(v); }
};

interface AuditoriaRow {
  id: string;
  contrato_id: string;
  arquivo_id: string | null;
  arquivo_nome: string | null;
  campo: string;
  valor_anterior: string | null;
  valor_novo: string | null;
  origem: string;
  created_at: string;
}

interface ContextoEvento {
  ataAtual: { numero_contrato: string | null; valor_global: number | null; valor_consumido: number | null; valor_global_original: number | null } | null;
  itemAtual: { descricao: string | null; codigo_item: string | null; quantidade_contratada: number | null; quantidade_ata_consumida: number | null; valor_total: number | null; saldo_financeiro: number | null; valor_unitario: number | null } | null;
  contratosDerivados: Array<{ id: string; numero_contrato: string | null; objeto: string | null; valor_global: number | null; status: string | null; data_inicio: string | null; data_fim: string | null }>;
  aditivos: Array<{ id: string; numero_aditivo: string | null; tipo: string | null; valor_acrescimo: number | null; valor_supressao: number | null; quantidade_acrescimo: number | null; nova_data_fim: string | null; created_at: string }>;
  eventoAnterior: AuditoriaRow | null;
}

export default function EventoAuditoriaDetalheDialog({
  evento,
  open,
  onOpenChange,
}: {
  evento: AuditoriaRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [ctx, setCtx] = useState<ContextoEvento | null>(null);

  useEffect(() => {
    if (!open || !evento) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setCtx(null);
      try {
        // 1. ATA pai (snapshot atual)
        const { data: ata } = await supabase
          .from('contratos')
          .select('numero_contrato, valor_global, valor_consumido, valor_global_original')
          .eq('id', evento.contrato_id)
          .maybeSingle();

        // 2. Item específico se for evento de saldo de item (extrai descrição do valor_anterior)
        let itemAtual = null;
        if (evento.campo === 'saldo_item_ata' && evento.valor_anterior) {
          const desc = evento.valor_anterior.split('—')[0].trim();
          const { data: item } = await supabase
            .from('contrato_itens')
            .select('descricao, codigo_item, quantidade_contratada, quantidade_ata_consumida, valor_total, saldo_financeiro, valor_unitario')
            .eq('contrato_id', evento.contrato_id)
            .ilike('descricao', `${desc}%`)
            .limit(1)
            .maybeSingle();
          itemAtual = item;
        }

        // 3. Contratos derivados desta ATA
        const { data: derivados } = await supabase
          .from('contratos')
          .select('id, numero_contrato, objeto, valor_global, status, data_inicio, data_fim')
          .eq('ata_srp_id', evento.contrato_id)
          .order('created_at', { ascending: false })
          .limit(20);

        // 4. Aditivos relacionados (do contrato no evento OU dos derivados)
        const idsParaAditivos = [evento.contrato_id, ...(derivados || []).map((d) => d.id)];
        const { data: aditivos } = await supabase
          .from('contrato_aditivos')
          .select('id, numero_aditivo, tipo, valor_acrescimo, valor_supressao, quantidade_acrescimo, nova_data_fim, created_at, contrato_id')
          .in('contrato_id', idsParaAditivos)
          .order('created_at', { ascending: false })
          .limit(10);

        // 5. Evento imediatamente anterior do mesmo campo (para mostrar "antes")
        const { data: anterior } = await supabase
          .from('contrato_ia_auditoria')
          .select('*')
          .eq('contrato_id', evento.contrato_id)
          .eq('campo', evento.campo)
          .lt('created_at', evento.created_at)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!cancelled) {
          setCtx({
            ataAtual: ata as any,
            itemAtual: itemAtual as any,
            contratosDerivados: (derivados as any) || [],
            aditivos: (aditivos as any) || [],
            eventoAnterior: (anterior as any) || null,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, evento]);

  if (!evento) return null;
  const meta = ORIGEM_META[evento.origem] || { label: evento.origem, icon: ScrollText, variant: 'outline' as const };
  const Icon = meta.icon;
  const isAlerta = evento.origem === 'alerta_limite_legal';
  const pctConsumo =
    ctx?.ataAtual && ctx.ataAtual.valor_global && Number(ctx.ataAtual.valor_global) > 0
      ? ((Number(ctx.ataAtual.valor_consumido || 0) / Number(ctx.ataAtual.valor_global)) * 100).toFixed(2)
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
            Detalhes do Evento — {CAMPO_LABELS[evento.campo] || evento.campo}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 flex-wrap">
            <Badge variant={meta.variant} className="text-xs">{meta.label}</Badge>
            <span className="text-xs text-muted-foreground">{fmtDate(evento.created_at)}</span>
            {evento.arquivo_nome && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <FileText className="h-3 w-3" /> {evento.arquivo_nome}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-3">
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Carregando contexto…
            </div>
          ) : (
            <div className="space-y-5 pb-2">
              {/* Antes / Depois */}
              <section>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  {isAlerta ? 'Detecção legal' : 'Antes → Depois'}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-stretch">
                  <div className="border rounded-md p-3 bg-muted/30">
                    <div className="text-xs text-muted-foreground mb-1">
                      {isAlerta ? 'Limite legal' : ctx?.eventoAnterior ? `Estado anterior (${fmtDate(ctx.eventoAnterior.created_at)})` : 'Valor anterior'}
                    </div>
                    <div className="font-mono text-sm break-words">
                      {ctx?.eventoAnterior?.valor_novo || evento.valor_anterior || '—'}
                    </div>
                  </div>
                  <div className="hidden md:flex items-center justify-center text-muted-foreground">
                    <ArrowRight className="h-5 w-5" />
                  </div>
                  <div className={`border rounded-md p-3 ${isAlerta ? 'bg-destructive/10 border-destructive/40' : 'bg-muted/50 border-border'}`}>
                    <div className="text-xs text-muted-foreground mb-1">
                      {isAlerta ? 'Situação detectada' : 'Estado atual'}
                    </div>
                    <div className={`font-mono text-sm break-words ${isAlerta ? 'text-destructive font-semibold' : 'text-foreground font-medium'}`}>
                      {evento.valor_novo || '—'}
                    </div>
                  </div>
                </div>
              </section>

              <Separator />

              {/* Snapshot da ATA */}
              {ctx?.ataAtual && (
                <section>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
                    <FileSignature className="h-3.5 w-3.5" /> Snapshot atual da ATA
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div className="border rounded-md p-2">
                      <div className="text-muted-foreground">Nº ATA</div>
                      <div className="font-medium">{ctx.ataAtual.numero_contrato || '—'}</div>
                    </div>
                    <div className="border rounded-md p-2">
                      <div className="text-muted-foreground">Valor original</div>
                      <div className="font-mono">{fmtBRL(ctx.ataAtual.valor_global_original)}</div>
                    </div>
                    <div className="border rounded-md p-2">
                      <div className="text-muted-foreground">Valor global</div>
                      <div className="font-mono">{fmtBRL(ctx.ataAtual.valor_global)}</div>
                    </div>
                    <div className="border rounded-md p-2">
                      <div className="text-muted-foreground">Consumido {pctConsumo ? `(${pctConsumo}%)` : ''}</div>
                      <div className="font-mono font-semibold text-foreground">{fmtBRL(ctx.ataAtual.valor_consumido)}</div>
                    </div>
                  </div>
                </section>
              )}

              {/* Snapshot do item afetado */}
              {ctx?.itemAtual && (
                <section>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
                    <Package className="h-3.5 w-3.5" /> Item afetado
                  </h4>
                  <div className="border rounded-md p-3 space-y-2 bg-muted/30">
                    <div className="text-sm font-medium">
                      {ctx.itemAtual.codigo_item ? `[${ctx.itemAtual.codigo_item}] ` : ''}{ctx.itemAtual.descricao || '—'}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                      <div><div className="text-muted-foreground">Qtd contratada</div><div className="font-mono">{fmtNum(ctx.itemAtual.quantidade_contratada)}</div></div>
                      <div><div className="text-muted-foreground">Qtd consumida</div><div className="font-mono font-semibold text-foreground">{fmtNum(ctx.itemAtual.quantidade_ata_consumida)}</div></div>
                      <div><div className="text-muted-foreground">Valor unit.</div><div className="font-mono">{fmtBRL(ctx.itemAtual.valor_unitario)}</div></div>
                      <div><div className="text-muted-foreground">Saldo financ.</div><div className="font-mono font-semibold text-foreground">{fmtBRL(ctx.itemAtual.saldo_financeiro)}</div></div>
                    </div>
                  </div>
                </section>
              )}

              {/* Contratos derivados que disparam recálculo */}
              {ctx && ctx.contratosDerivados.length > 0 && (
                <section>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Contratos derivados ({ctx.contratosDerivados.length})
                  </h4>
                  <ul className="space-y-1.5">
                    {ctx.contratosDerivados.map((c) => (
                      <li key={c.id} className="border rounded-md p-2 text-xs flex items-start justify-between gap-2 bg-muted/20">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">{c.numero_contrato || '(sem número)'}</div>
                          <div className="text-muted-foreground truncate">{c.objeto || '—'}</div>
                          <div className="text-muted-foreground text-xs mt-0.5">
                            {c.data_inicio ? new Date(c.data_inicio).toLocaleDateString('pt-BR') : '—'} →{' '}
                            {c.data_fim ? new Date(c.data_fim).toLocaleDateString('pt-BR') : '—'}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-mono">{fmtBRL(c.valor_global)}</div>
                          {c.status && <Badge variant="outline" className="text-xs mt-0.5">{c.status}</Badge>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Aditivos relacionados */}
              {ctx && ctx.aditivos.length > 0 && (
                <section>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Aditivos recentes ({ctx.aditivos.length})
                  </h4>
                  <ul className="space-y-1.5">
                    {ctx.aditivos.map((a) => (
                      <li key={a.id} className="border rounded-md p-2 text-xs bg-muted/20">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="font-medium">
                            Aditivo nº {a.numero_aditivo || '?'}
                            {a.tipo && <Badge variant="outline" className="text-xs ml-2">{a.tipo}</Badge>}
                          </div>
                          <span className="text-muted-foreground text-xs">{fmtDate(a.created_at)}</span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                          {Number(a.valor_acrescimo) > 0 && <div><span className="text-muted-foreground">+ Valor: </span><span className="font-mono text-success">{fmtBRL(a.valor_acrescimo)}</span></div>}
                          {Number(a.valor_supressao) > 0 && <div><span className="text-muted-foreground">− Valor: </span><span className="font-mono text-destructive">{fmtBRL(a.valor_supressao)}</span></div>}
                          {Number(a.quantidade_acrescimo) > 0 && <div><span className="text-muted-foreground">+ Qtd: </span><span className="font-mono">{fmtNum(a.quantidade_acrescimo)}</span></div>}
                          {a.nova_data_fim && <div><span className="text-muted-foreground">Nova vigência: </span><span className="font-mono">{new Date(a.nova_data_fim).toLocaleDateString('pt-BR')}</span></div>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {(!ctx?.contratosDerivados.length && !ctx?.aditivos.length && !ctx?.itemAtual) && !loading && (
                <div className="text-xs text-muted-foreground text-center py-4">
                  Nenhum contrato derivado ou aditivo relacionado encontrado para este evento.
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
