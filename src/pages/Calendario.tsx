import AppLayout from '@/components/layout/AppLayout';
import CalendarioLicitacoes from '@/components/calendario/CalendarioLicitacoes';
import { CalendarDays } from 'lucide-react';

export default function Calendario() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-accent" />
            Calendário de Licitações
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Acompanhamento em tempo real de abertura, encerramento e validade de documentos
          </p>
        </div>
        <CalendarioLicitacoes />
      </div>
    </AppLayout>
  );
}
