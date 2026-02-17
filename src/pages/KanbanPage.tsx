import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { licitacoesMock, Licitacao } from '@/data/mockData';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { MapPin, Calendar, GripVertical } from 'lucide-react';

type Column = {
  id: string;
  title: string;
  color: string;
};

const columns: Column[] = [
  { id: 'monitorando', title: 'Monitorando', color: 'hsl(var(--info))' },
  { id: 'analisando', title: 'Analisando', color: 'hsl(var(--warning))' },
  { id: 'proposta', title: 'Proposta', color: 'hsl(var(--primary))' },
  { id: 'enviada', title: 'Enviada', color: 'hsl(var(--accent))' },
  { id: 'vencida', title: 'Vencida', color: 'hsl(var(--success))' },
];

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(v);

export default function KanbanPage() {
  const [items, setItems] = useState<Licitacao[]>(licitacoesMock);
  const [dragItem, setDragItem] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const handleDragStart = (id: string) => setDragItem(id);
  const handleDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    setDragOverCol(colId);
  };
  const handleDrop = (colId: string) => {
    if (dragItem) {
      setItems((prev) =>
        prev.map((item) =>
          item.id === dragItem ? { ...item, status: colId as Licitacao['status'] } : item
        )
      );
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
                          <span className="flex items-center gap-0.5">
                            <MapPin className="w-3 h-3" />
                            {lic.cidade}/{lic.uf}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <Calendar className="w-3 h-3" />
                            {new Date(lic.dataEncerramento).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-accent mt-2">{formatCurrency(lic.valor)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </AppLayout>
  );
}
