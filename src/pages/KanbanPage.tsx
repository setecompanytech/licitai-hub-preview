import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { MapPin, Calendar, GripVertical, Plus, Pencil } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLicitacaoIntegration } from '@/hooks/useLicitacaoIntegration';
import EditLicitacaoDialog from '@/components/kanban/EditLicitacaoDialog';

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

/** Map legacy/variant status values to canonical column IDs */
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

export default function KanbanPage() {
  const { user } = useAuth();
  const { atualizarStatus } = useLicitacaoIntegration();
  const [items, setItems] = useState<LicitacaoKanban[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragItem, setDragItem] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<LicitacaoKanban | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const handleEdit = (lic: LicitacaoKanban) => {
    setEditItem(lic);
    setEditOpen(true);
  };

  const handleSaved = (updated: LicitacaoKanban) => {
    setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
  };

  const handleDeleted = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  useEffect(() => {
    if (!user) return;
    supabase
      .from('licitacoes')
      .select('id, numero, orgao, objeto, status, valor_estimado, uf, municipio, data_encerramento')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const normalized = (data || []).map(item => ({
          ...item,
          status: normalizeStatus(item.status),
        }));
        setItems(normalized);
        setLoading(false);
      });
  }, [user]);

  const handleDragStart = (id: string) => setDragItem(id);
  const handleDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    setDragOverCol(colId);
  };
  const handleDrop = async (colId: string) => {
    if (dragItem) {
      const item = items.find(i => i.id === dragItem);
      if (item && item.status !== colId) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === dragItem ? { ...i, status: colId } : i
          )
        );
        await atualizarStatus(dragItem, colId, `Status alterado de "${item.status}" para "${colId}" via Kanban.`);
      }
    }
    setDragItem(null);
    setDragOverCol(null);
  };

  const totalValor = items.reduce((sum, i) => sum + (i.valor_estimado || 0), 0);

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Kanban — Gestão de Licitações</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Arraste e solte para atualizar o status • {items.length} processos • {formatCurrency(totalValor)} em valor estimado
        </p>
      </div>

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
        <div className="flex gap-3 overflow-x-auto pb-4">
          {columns.map((col) => {
            const colItems = items.filter((i) => i.status === col.id);
            return (
              <div
                key={col.id}
                className={cn(
                  'kanban-column min-w-[240px] w-[240px] flex-shrink-0 transition-colors rounded-xl bg-muted/20 border border-border/40 p-3',
                  dragOverCol === col.id && 'ring-2 ring-accent/40 bg-accent/5'
                )}
                onDragOver={(e) => handleDragOver(e, col.id)}
                onDragLeave={() => setDragOverCol(null)}
                onDrop={() => handleDrop(col.id)}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: col.color }} />
                  <h3 className="text-xs font-semibold truncate">{col.title}</h3>
                  <Badge variant="outline" className="text-[10px] ml-auto px-1.5 py-0">{colItems.length}</Badge>
                </div>
                <p className="text-[10px] text-muted-foreground mb-3 leading-tight">{col.description}</p>
                <div className="space-y-2 min-h-[60px]">
                  {colItems.length === 0 && (
                    <p className="text-[10px] text-muted-foreground/50 text-center py-4">Solte aqui</p>
                  )}
                  {colItems.map((lic) => (
                    <div
                      key={lic.id}
                      className={cn(
                        'bg-card rounded-lg border border-border/50 p-3 shadow-sm cursor-grab active:cursor-grabbing transition-all hover:shadow-md',
                        dragItem === lic.id && 'opacity-40 scale-95'
                      )}
                      draggable
                      onDragStart={() => handleDragStart(lic.id)}
                      onDragEnd={() => { setDragItem(null); setDragOverCol(null); }}
                    >
                      <div className="flex items-start gap-1.5">
                        <GripVertical className="w-3.5 h-3.5 text-muted-foreground/30 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono text-muted-foreground">{lic.numero}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleEdit(lic); }}
                              className="p-1 rounded-md hover:bg-accent/10 text-muted-foreground/40 hover:text-accent transition-colors"
                              title="Editar processo"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          </div>
                          <p className="text-xs font-medium mt-0.5 line-clamp-2 leading-tight">{lic.objeto}</p>
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
