import { useState, useEffect, useRef, useCallback } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { MapPin, Calendar, GripVertical, Plus, Pencil, LayoutDashboard, ListChecks, History, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLicitacaoIntegration } from '@/hooks/useLicitacaoIntegration';
import EditLicitacaoDialog from '@/components/kanban/EditLicitacaoDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CompromissosResumo from '@/components/gestao/CompromissosResumo';
import HistoricoExtracoes from '@/components/gestao/HistoricoExtracoes';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

type LicitacaoKanban = {
  id: string;
  numero: string;
  orgao: string;
  objeto: string;
  status: string;
  valor_estimado: number | null;
  uf: string | null;
  municipio: string | null;
  data_encerramento: string | null;
};

type Column = {
  id: string;
  title: string;
  color: string;
  description: string;
};

const columns: Column[] = [
  { id: 'Monitorando', title: 'Monitorando', color: 'hsl(var(--info))', description: 'Editais sendo acompanhados' },
  { id: 'Em Análise', title: 'Analisando', color: 'hsl(var(--warning))', description: 'Análise de viabilidade' },
  { id: 'Proposta Enviada', title: 'Proposta', color: 'hsl(var(--primary))', description: 'Proposta elaborada e enviada' },
  { id: 'Em Disputa', title: 'Em Disputa', color: 'hsl(var(--accent))', description: 'Disputa/pregão em andamento' },
  { id: 'Vencida', title: 'Vencida', color: 'hsl(var(--success))', description: 'Licitação arrematada' },
  { id: 'Homologada', title: 'Homologada', color: 'hsl(210, 80%, 45%)', description: 'Resultado homologado' },
  { id: 'Perdida', title: 'Perdida', color: 'hsl(var(--destructive))', description: 'Não arrematada' },
  { id: 'Arquivada', title: 'Arquivada', color: 'hsl(var(--muted-foreground))', description: 'Processos encerrados' },
];

const normalizeStatus = (s: string): string => {
  const lower = s.toLowerCase();
  if (lower === 'publicado' || lower === 'monitorando' || lower === 'novo') return 'Monitorando';
  if (lower.includes('analis') || lower.includes('análise')) return 'Em Análise';
  if (lower.includes('proposta')) return 'Proposta Enviada';
  if (lower.includes('disputa') || lower === 'em disputa') return 'Em Disputa';
  if (lower.includes('homolog')) return 'Homologada';
  if (lower.includes('vencid') || lower.includes('adjudic') || lower === 'vencedor') return 'Vencida';
  if (lower.includes('perdid') || lower.includes('cancel') || lower.includes('revog') || lower === 'perdedor') return 'Perdida';
  if (lower.includes('arquiv')) return 'Arquivada';
  return 'Monitorando';
};

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(v);

type DragState = { id: string; offsetX: number; offsetY: number } | null;

export default function KanbanPage() {
  const { user } = useAuth();
  const { atualizarStatus } = useLicitacaoIntegration();
  const [items, setItems] = useState<LicitacaoKanban[]>([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<LicitacaoKanban | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  // Drag state — refs para leitura síncrona nos event handlers
  const dragStateRef = useRef<DragState>(null);
  const overColRef = useRef<string | null>(null);
  const itemsRef = useRef<LicitacaoKanban[]>([]);
  const columnRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Estado React apenas para re-render visual
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [ghostPos, setGhostPos] = useState({ x: 0, y: 0 });
  const [overColId, setOverColId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => { itemsRef.current = items; }, [items]);

  const handleEdit = (lic: LicitacaoKanban) => { setEditItem(lic); setEditOpen(true); };
  const handleSaved = (updated: LicitacaoKanban) => setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
  const handleDeleted = (id: string) => setItems(prev => prev.filter(i => i.id !== id));

  // Move card (usado pelo drag e pelo dropdown)
  const moverCard = useCallback(async (id: string, toColId: string) => {
    const item = itemsRef.current.find(i => i.id === id);
    if (!item || item.status === toColId) return;
    setItems(prev => prev.map(i => i.id === id ? { ...i, status: toColId } : i));
    await atualizarStatus(id, toColId, `Status alterado de "${item.status}" para "${toColId}" via Kanban.`);
  }, [atualizarStatus]);

  // Pointer Events — funciona em Chrome, Firefox, Safari, mobile
  const handlePointerDown = useCallback((e: React.PointerEvent, id: string) => {
    // Ignora cliques secundários e elementos interativos filhos
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, [role="menuitem"]')) return;

    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    dragStateRef.current = { id, offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top };
    setDraggedId(id);
    setGhostPos({ x: e.clientX, y: e.clientY });
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const onMove = (e: PointerEvent) => {
      if (!dragStateRef.current) return;
      e.preventDefault();
      setGhostPos({ x: e.clientX, y: e.clientY });

      // Detecta coluna sob o cursor
      const el = document.elementFromPoint(e.clientX, e.clientY);
      let found: string | null = null;
      for (const [colId, ref] of Object.entries(columnRefs.current)) {
        if (ref && el && (ref === el || ref.contains(el as Node))) {
          found = colId;
          break;
        }
      }
      if (found !== overColRef.current) {
        overColRef.current = found;
        setOverColId(found);
      }
    };

    const onUp = async () => {
      if (!dragStateRef.current) return;
      const { id } = dragStateRef.current;
      const targetCol = overColRef.current;

      dragStateRef.current = null;
      overColRef.current = null;
      setDraggedId(null);
      setOverColId(null);
      setIsDragging(false);

      if (targetCol) await moverCard(id, targetCol);
    };

    document.addEventListener('pointermove', onMove, { passive: false });
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);

    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
    };
  }, [isDragging, moverCard]);

  useEffect(() => {
    if (!user) return;
    const loadData = async () => {
      const { data } = await supabase
        .from('licitacoes')
        .select('id, numero, orgao, objeto, status, valor_estimado, uf, municipio, data_encerramento')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setItems((data || []).map(item => ({ ...item, status: normalizeStatus(item.status) })));
      setLoading(false);
    };
    loadData();

    const channel = supabase
      .channel(`kanban-licitacoes-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'licitacoes', filter: `user_id=eq.${user.id}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setItems(prev => [{ ...(payload.new as LicitacaoKanban), status: normalizeStatus((payload.new as LicitacaoKanban).status) }, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          const updated = payload.new as LicitacaoKanban;
          setItems(prev => prev.map(i => i.id === updated.id ? { ...updated, status: normalizeStatus(updated.status) } : i));
        } else if (payload.eventType === 'DELETE') {
          setItems(prev => prev.filter(i => i.id !== (payload.old as { id: string }).id));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const totalValor = items.reduce((sum, i) => sum + (i.valor_estimado || 0), 0);

  // Ghost card (segue o cursor durante o drag)
  const draggedItem = draggedId ? items.find(i => i.id === draggedId) : null;
  const ds = dragStateRef.current;

  return (
    <AppLayout>
      <div className="mb-4">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Gestão de Licitações</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Kanban e Compromissos sincronizados com o Monitoramento de Editais • {items.length} processos • {formatCurrency(totalValor)} estimados
        </p>
      </div>

      <Tabs defaultValue="kanban" className="space-y-4">
        <TabsList>
          <TabsTrigger value="kanban" className="gap-1.5"><LayoutDashboard className="w-3.5 h-3.5" /> Kanban</TabsTrigger>
          <TabsTrigger value="compromissos" className="gap-1.5"><ListChecks className="w-3.5 h-3.5" /> Compromissos</TabsTrigger>
          <TabsTrigger value="historico" className="gap-1.5"><History className="w-3.5 h-3.5" /> Histórico de Extrações</TabsTrigger>
        </TabsList>

        <TabsContent value="kanban">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Plus className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-semibold mb-1">Nenhum processo no Kanban</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Vá até o <strong>Monitoramento de Editais</strong> → aba <strong>Licitações</strong> e clique em <strong>"Iniciar"</strong> para converter um edital em processo gerenciado.
              </p>
            </div>
          ) : (
            <div className={cn('flex gap-3 overflow-x-auto pb-4', isDragging && 'select-none')}>
              {columns.map((col) => {
                const colItems = items.filter((i) => i.status === col.id);
                const isOver = overColId === col.id;
                return (
                  <div
                    key={col.id}
                    ref={(el) => { columnRefs.current[col.id] = el; }}
                    className={cn(
                      'min-w-[240px] w-[240px] flex-shrink-0 rounded-xl bg-muted/20 border border-border/40 p-3 transition-colors',
                      isOver && isDragging && 'ring-2 ring-accent/60 bg-accent/5'
                    )}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: col.color }} />
                      <h3 className="text-xs font-semibold truncate">{col.title}</h3>
                      <Badge variant="outline" className="text-[10px] ml-auto px-1.5 py-0">{colItems.length}</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mb-3 leading-tight">{col.description}</p>

                    <div className="space-y-2 min-h-[120px]">
                      {colItems.length === 0 && (
                        <div className={cn(
                          'border-2 border-dashed border-border/30 rounded-lg py-8 text-center transition-colors',
                          isOver && isDragging && 'border-accent/40 bg-accent/5'
                        )}>
                          <p className="text-[10px] text-muted-foreground/60">
                            {isOver && isDragging ? 'Solte aqui' : 'Vazio'}
                          </p>
                        </div>
                      )}
                      {colItems.map((lic) => (
                        <div
                          key={lic.id}
                          className={cn(
                            'bg-card rounded-lg border border-border/50 p-3 shadow-sm transition-[box-shadow,opacity] hover:shadow-md select-none touch-none',
                            draggedId === lic.id ? 'opacity-30 cursor-grabbing' : 'cursor-grab'
                          )}
                          onPointerDown={(e) => handlePointerDown(e, lic.id)}
                        >
                          <div className="flex items-start gap-1.5">
                            <GripVertical className="w-3.5 h-3.5 text-muted-foreground/30 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1 min-w-0">
                                <span className="text-[10px] font-mono text-muted-foreground truncate">{lic.numero}</span>
                                <div className="flex items-center gap-0.5 shrink-0">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button
                                        onPointerDown={(e) => e.stopPropagation()}
                                        className="p-1 rounded-md hover:bg-accent/10 text-muted-foreground/40 hover:text-accent transition-colors"
                                        title="Mover para etapa"
                                      >
                                        <ChevronRight className="w-3 h-3" />
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-44">
                                      {columns.filter(c => c.id !== lic.status).map(c => (
                                        <DropdownMenuItem key={c.id} onClick={() => moverCard(lic.id, c.id)}>
                                          <div className="w-2 h-2 rounded-full mr-2 shrink-0" style={{ background: c.color }} />
                                          {c.title}
                                        </DropdownMenuItem>
                                      ))}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                  <button
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={(e) => { e.stopPropagation(); handleEdit(lic); }}
                                    className="p-1 rounded-md hover:bg-accent/10 text-muted-foreground/40 hover:text-accent transition-colors"
                                    title="Editar processo"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                              <p className="text-sm font-medium mt-0.5 leading-tight line-clamp-2 break-words [overflow-wrap:anywhere]" title={lic.objeto}>
                                {lic.objeto}
                              </p>
                              <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground flex-wrap">
                                {lic.municipio && lic.uf && (
                                  <span className="flex items-center gap-0.5">
                                    <MapPin className="w-2.5 h-2.5" />
                                    {lic.municipio}/{lic.uf}
                                  </span>
                                )}
                                {lic.data_encerramento && (
                                  <span className="flex items-center gap-0.5">
                                    <Calendar className="w-2.5 h-2.5" />
                                    {new Date(lic.data_encerramento).toLocaleDateString('pt-BR')}
                                  </span>
                                )}
                              </div>
                              {lic.valor_estimado && (
                                <p className="text-xs font-semibold text-accent mt-1.5">{formatCurrency(lic.valor_estimado)}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="compromissos"><CompromissosResumo /></TabsContent>
        <TabsContent value="historico"><HistoricoExtracoes /></TabsContent>
      </Tabs>

      {/* Ghost card que segue o cursor durante o drag */}
      {isDragging && draggedItem && ds && (
        <div
          className="fixed pointer-events-none z-[9999] rotate-1 opacity-95"
          style={{ left: ghostPos.x - ds.offsetX, top: ghostPos.y - ds.offsetY, width: 240 }}
        >
          <div className="bg-card rounded-lg border-2 border-accent/60 p-3 shadow-2xl">
            <p className="text-[10px] font-mono text-muted-foreground truncate">{draggedItem.numero}</p>
            <p className="text-sm font-medium mt-0.5 line-clamp-2 break-words [overflow-wrap:anywhere]">{draggedItem.objeto}</p>
            {draggedItem.municipio && draggedItem.uf && (
              <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-0.5">
                <MapPin className="w-2.5 h-2.5" />{draggedItem.municipio}/{draggedItem.uf}
              </p>
            )}
            {draggedItem.valor_estimado && (
              <p className="text-xs font-semibold text-accent mt-1">{formatCurrency(draggedItem.valor_estimado)}</p>
            )}
          </div>
        </div>
      )}

      <EditLicitacaoDialog
        licitacao={editItem}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={handleSaved}
        onDeleted={handleDeleted}
      />
    </AppLayout>
  );
}
