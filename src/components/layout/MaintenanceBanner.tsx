import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface Manutencao {
  id: string;
  titulo: string;
  mensagem: string;
  data_inicio: string;
  data_fim: string;
}

export default function MaintenanceBanner({ showModal = false }: { showModal?: boolean }) {
  const [items, setItems] = useState<Manutencao[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [modalShown, setModalShown] = useState(false);

  useEffect(() => {
    supabase
      .from('manutencao_agendada')
      .select('*')
      .eq('ativo', true)
      .gt('data_fim', new Date().toISOString())
      .order('data_inicio', { ascending: true })
      .then(({ data }) => {
        if (data && data.length > 0) {
          setItems(data as Manutencao[]);
        }
      });
  }, []);

  // Show modal once on login
  useEffect(() => {
    if (showModal && items.length > 0 && !modalShown) {
      const key = `maint_modal_${items[0].id}`;
      if (!sessionStorage.getItem(key)) {
        setModalOpen(true);
        setModalShown(true);
        sessionStorage.setItem(key, '1');
      }
    }
  }, [showModal, items, modalShown]);

  const visibleItems = items.filter((i) => !dismissed.has(i.id));
  if (visibleItems.length === 0 && !modalOpen) return null;

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <>
      {visibleItems.map((m) => (
        <div
          key={m.id}
          className="relative flex items-center gap-3 rounded-lg border border-yellow-500/30 bg-yellow-50 dark:bg-yellow-950/20 px-4 py-2.5 text-sm text-yellow-800 dark:text-yellow-200 mb-3"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 text-yellow-600 dark:text-yellow-400" />
          <div className="flex-1 min-w-0">
            <span className="font-semibold">{m.titulo}</span>
            <span className="mx-1.5">—</span>
            <span>{m.mensagem}</span>
            <span className="ml-2 text-xs opacity-70">
              ({fmt(m.data_inicio)} até {fmt(m.data_fim)})
            </span>
          </div>
          <button
            onClick={() => setDismissed((s) => new Set(s).add(m.id))}
            className="p-1 rounded hover:bg-yellow-200/50 dark:hover:bg-yellow-800/30 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
              <AlertTriangle className="w-5 h-5" />
              Manutenção Programada
            </DialogTitle>
            <DialogDescription>
              As seguintes manutenções estão agendadas. Seus dados estão seguros e você pode continuar usando o sistema normalmente até o início da manutenção.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {items.map((m) => (
              <div key={m.id} className="p-3 rounded-lg bg-muted text-sm">
                <p className="font-semibold text-foreground">{m.titulo}</p>
                <p className="text-muted-foreground mt-1">{m.mensagem}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  📅 {fmt(m.data_inicio)} → {fmt(m.data_fim)}
                </p>
              </div>
            ))}
          </div>
          <Button onClick={() => setModalOpen(false)} className="mt-2 w-full">
            Entendi
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
