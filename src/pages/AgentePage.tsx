import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import SeloPraefectusIA from '@/components/shared/SeloPraefectusIA';
import AgenteDashboard from '@/components/agente/AgenteDashboard';
import { Bot } from 'lucide-react';

export default function AgentePage() {
  return (
    <AppLayout>
      <CabecalhoPagina
        icone={<Bot />}
        titulo="AURÉLIA Agent"
        descricao="Agente autônomo 24/7 — monitorando e participando de licitações"
      >
        {/* O selo dos módulos de IA (Design System v3, §5 "IA"). */}
        <div>
          <SeloPraefectusIA />
        </div>
      </CabecalhoPagina>
      <AgenteDashboard />
    </AppLayout>
  );
}
