import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, ArrowDownCircle, ArrowUpCircle, Landmark,
  FolderTree, Users, RefreshCw, BarChart3, Kanban, Barcode,
  Receipt, ChevronLeft, ChevronRight, TrendingUp, Percent,
} from 'lucide-react';
import FinHubDashboard from '@/components/financeiro/FinHubDashboard';
import FinKanbanPagamentos from '@/components/financeiro/FinKanbanPagamentos';
import FinContasPagar from '@/components/financeiro/FinContasPagar';
import FinContasReceber from '@/components/financeiro/FinContasReceber';
import FinContasBancarias from '@/components/financeiro/FinContasBancarias';
import FinCategorias from '@/components/financeiro/FinCategorias';
import FinPessoas from '@/components/financeiro/FinPessoas';
import FinExtrato from '@/components/financeiro/FinExtrato';
import FinRelatorios from '@/components/financeiro/FinRelatorios';
import FinNotasFiscais from '@/components/financeiro/FinNotasFiscais';
import FinFluxoCaixa from '@/components/financeiro/FinFluxoCaixa';
import FinComissoes from '@/components/financeiro/FinComissoes';
import Boletos from '@/components/financeiro/Boletos';

interface FinMenuItem {
  id: string;
  label: string;
  icon: React.ElementType;
  group: string;
}

const menuItems: FinMenuItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'Visão Geral' },
  { id: 'kanban', label: 'Kanban Pagamentos', icon: Kanban, group: 'Visão Geral' },
  { id: 'fluxo', label: 'Fluxo de Caixa', icon: TrendingUp, group: 'Visão Geral' },
  { id: 'pagar', label: 'Contas a Pagar', icon: ArrowDownCircle, group: 'Operacional' },
  { id: 'receber', label: 'Contas a Receber', icon: ArrowUpCircle, group: 'Operacional' },
  { id: 'contas', label: 'Contas Bancárias', icon: Landmark, group: 'Operacional' },
  { id: 'categorias', label: 'Categorias', icon: FolderTree, group: 'Cadastros' },
  { id: 'pessoas', label: 'Clientes / Fornecedores', icon: Users, group: 'Cadastros' },
  { id: 'extrato', label: 'Extrato / Conciliação', icon: RefreshCw, group: 'Movimentação' },
  { id: 'nf', label: 'Notas Fiscais', icon: Receipt, group: 'Movimentação' },
  { id: 'boletos', label: 'Boletos', icon: Barcode, group: 'Movimentação' },
  { id: 'comissoes', label: 'Comissões', icon: Percent, group: 'Movimentação' },
  { id: 'relatorios', label: 'Relatórios', icon: BarChart3, group: 'Relatórios' },
];

const groups = ['Visão Geral', 'Operacional', 'Cadastros', 'Movimentação', 'Relatórios'];

export default function Financeiro() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'dashboard';
  const [collapsed, setCollapsed] = useState(false);

  const setActiveTab = (tab: string) => setSearchParams({ tab });

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <FinHubDashboard />;
      case 'kanban': return <FinKanbanPagamentos />;
      case 'fluxo': return <FinFluxoCaixa />;
      case 'pagar': return <FinContasPagar />;
      case 'receber': return <FinContasReceber />;
      case 'contas': return <FinContasBancarias />;
      case 'categorias': return <FinCategorias />;
      case 'pessoas': return <FinPessoas />;
      case 'extrato': return <FinExtrato />;
      case 'nf': return <FinNotasFiscais />;
      case 'boletos': return <Boletos />;
      case 'comissoes': return <FinComissoes />;
      case 'relatorios': return <FinRelatorios />;
      default: return <FinHubDashboard />;
    }
  };

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-4rem)] -mt-2 -mx-2 sm:-mx-4">
        <aside
          className={cn(
            'border-r bg-muted/30 flex flex-col shrink-0 transition-all duration-200 overflow-y-auto',
            collapsed ? 'w-14' : 'w-56'
          )}
        >
          <div className="flex items-center justify-between px-3 py-3 border-b">
            {!collapsed && <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Financeiro</span>}
            <button onClick={() => setCollapsed(!collapsed)} className="p-1 rounded hover:bg-muted">
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          <nav className="flex-1 py-2 px-1.5 space-y-1">
            {groups.map((group) => {
              const items = menuItems.filter((i) => i.group === group);
              return (
                <div key={group}>
                  {!collapsed && (
                    <p className="px-2 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {group}
                    </p>
                  )}
                  {collapsed && <div className="my-1.5 mx-2 border-t" />}
                  {items.map((item) => {
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm transition-colors',
                          isActive
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        )}
                      >
                        <item.icon className="w-4 h-4 shrink-0" />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {renderContent()}
        </main>
      </div>
    </AppLayout>
  );
}
