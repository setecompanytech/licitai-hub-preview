import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { MapPin, Calendar, GripVertical } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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
};

const columns: Column[] = [
  { id: 'Publicado', title: 'Monitorando', color: 'hsl(var(--info))' },
  { id: 'Em Análise', title: 'Analisando', color: 'hsl(var(--warning))' },
  { id: 'Proposta Enviada', title: 'Proposta', color: 'hsl(var(--primary))' },
  { id: 'Vencida', title: 'Vencida', color: 'hsl(var(--success))' },
  { id: 'Perdida', title: 'Perdida', color: 'hsl(var(--destructive))' },
];

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(v);

export default function KanbanPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<LicitacaoKanban[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragItem, setDragItem] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('licitacoes')
      .select('id, numero, orgao, objeto, status, valor_estimado, uf, municipio, data_encerramento')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setItems(data || []);
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
      setItems((prev) =>
        prev.map((item) =>
          item.id === dragItem ? { ...item, status: colId } : item
        )
      );
      await supabase.from('licitacoes').update({ status: colId }).eq('id', dragItem);
    }
    setDragItem(null);
    setDragOverCol(null);
  };

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Kanban</h1>
        <p className="text-sm text-muted-foreground mt-1">Arraste e solte para atualizar o status</p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((col) => {
            const colItems = items.filter((i) => i.status === col.id);
            return (
              <div
                key={col.id}
                className={cn(
                  'kanban-column min-w-[280px] flex-1 transition-colors',
                  dragOverCol === col.id && 'ring-2 ring-accent/40'
                )}
                onDragOver={(e) => handleDragOver(e, col.id)}
                onDragLeave={() => setDragOverCol(null)}
                onDrop={() => handleDrop(col.id)}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: col.color }} />
                  <h3 className="text-sm font-semibold">{col.title}</h3>
                  <span className="text-xs text-muted-foreground ml-auto">{colItems.length}</span>
                </div>
                <div className="space-y-3">
                  {colItems.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">Nenhuma licitação</p>
                  )}
                  {colItems.map((lic) => (
                    <div
                      key={lic.id}
                      className={cn('kanban-card animate-fade-in', dragItem === lic.id && 'opacity-50')}
                      draggable
                      onDragStart={() => handleDragStart(lic.id)}
                      onDragEnd={() => { setDragItem(null); setDragOverCol(null); }}
                    >
                      <div className="flex items-start gap-2">
                        <GripVertical className="w-4 h-4 text-muted-foreground/40 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] font-mono text-muted-foreground">{lic.numero}</span>
                          <p className="text-sm font-medium mt-0.5 line-clamp-2">{lic.objeto}</p>
                          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                            {lic.municipio && lic.uf && (
                              <span className="flex items-center gap-0.5">
                                <MapPin className="w-3 h-3" />
                                {lic.municipio}/{lic.uf}
                              </span>
                            )}
                            {lic.data_encerramento && (
                              <span className="flex items-center gap-0.5">
                                <Calendar className="w-3 h-3" />
                                {new Date(lic.data_encerramento).toLocaleDateString('pt-BR')}
                              </span>
                            )}
                          </div>
                          {lic.valor_estimado && (
                            <p className="text-sm font-semibold text-accent mt-2">{formatCurrency(lic.valor_estimado)}</p>
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
    </AppLayout>
  );
}
