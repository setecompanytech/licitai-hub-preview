import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import AgenteDashboard from '@/components/agente/AgenteDashboard';
import { Bot } from 'lucide-react';

export default function AgentePage() {
  return (
    <AppLayout>
      <CabecalhoPagina
        icone={<Bot />}
        titulo="AURÉLIA Agent"
        descricao="Agente autônomo 24/7 — monitorando e participando de licitações"
      />
      <AgenteDashboard />
    </AppLayout>
  );
}
