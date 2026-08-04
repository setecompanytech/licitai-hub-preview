/**
 * Piloto da auditoria de tipografia e cor — SOMENTE DEV.
 *
 * Espelha os blocos do Painel de Gestão que concentram os problemas
 * auditados (grade de módulos e KPIs da Visão Geral) numa rota sem
 * autenticação, para capturar antes/depois nos DOIS temas com o
 * Chromium headless. Montada em App.tsx apenas quando import.meta.env.DEV.
 *
 * Mostra as DUAS opções de rótulo de categoria em disputa:
 *   A) 12px caixa alta com tracking 0.05em (o que está no componente)
 *   B) 14px sem caixa alta (simulada por override de CSS abaixo)
 *
 * Não é parte do produto: remover quando a migração do painel for aprovada.
 */
import { Eye, Trophy, DollarSign, XCircle, Clock, Database } from 'lucide-react';
import StatCard from '@/components/dashboard/StatCard';
import QuickAccessGrid from '@/components/dashboard/QuickAccessGrid';

export default function PilotoPainel() {
  return (
    <div className="min-h-screen bg-background text-foreground p-6 space-y-10" data-piloto>
      <section data-bloco="ferramentas">
        <h2 className="text-lg font-bold tracking-tight mb-4">Nossas Ferramentas</h2>
        <QuickAccessGrid />
      </section>

      <section data-bloco="visao-geral">
        <h2 className="text-lg font-bold tracking-tight mb-4">Visão Geral</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4">
          {/* Mesmos props do Index.tsx — manter em sincronia com ele durante o piloto */}
          <StatCard label="Monitoradas" value="12" icon={Eye} tone="neutral" />
          <StatCard label="Em Andamento" value="4" icon={Clock} accentColor="var(--warning)" />
          <StatCard label="Ganhas" value="7" icon={Trophy} accentColor="var(--success)" />
          <StatCard label="Perdidas" value="2" icon={XCircle} accentColor="var(--destructive)" />
          <StatCard label="Valor Ganho" value="R$ 1,2 mi" icon={DollarSign} tone="neutral" />
          <StatCard label="Editais PNCP" value="823" icon={Database} tone="neutral" change="Sync: 21:40" changeType="neutral" />
        </div>
      </section>
    </div>
  );
}
