import AppLayout from '@/components/layout/AppLayout';
import AgenteDashboard from '@/components/agente/AgenteDashboard';

export default function AgentePage() {
  return (
    <AppLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">AURÉLIA Agent</h1>
          <p className="text-muted-foreground">Agente autônomo 24/7 — monitorando e participando de licitações</p>
        </div>
        <AgenteDashboard />
      </div>
    </AppLayout>
  );
}
