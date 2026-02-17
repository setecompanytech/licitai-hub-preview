import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Search,
  Kanban,
  Users,
  Bot,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
  Crosshair,
  Shield,
  Scale,
  DollarSign,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Search, label: 'Licitações', path: '/licitacoes' },
  { icon: Kanban, label: 'Kanban', path: '/kanban' },
  { icon: Crosshair, label: 'Robô de Lances', path: '/robo-lances' },
  { icon: Users, label: 'Concorrentes', path: '/concorrentes' },
  { icon: Shield, label: 'Documentos', path: '/documentos' },
  { icon: Scale, label: 'Apoio Jurídico', path: '/apoio-juridico' },
  { icon: DollarSign, label: 'Precificação', path: '/precificacao' },
  { icon: Bot, label: 'Assistente IA', path: '/assistente' },
  { icon: BarChart3, label: 'Analytics', path: '/analytics' },
  { icon: Settings, label: 'Configurações', path: '/configuracoes' },
];

export default function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen flex flex-col border-r transition-all duration-300',
        collapsed ? 'w-[72px]' : 'w-[240px]'
      )}
      style={{ background: `hsl(var(--sidebar-bg))`, borderColor: `hsl(var(--sidebar-border))` }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-16 border-b" style={{ borderColor: `hsl(var(--sidebar-border))` }}>
        <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
          <Zap className="w-4.5 h-4.5 text-accent-foreground" />
        </div>
        {!collapsed && (
          <span className="text-lg font-bold tracking-tight text-primary-foreground whitespace-nowrap">
            Licit<span className="text-accent">IA</span>
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                'sidebar-item w-full',
                isActive ? 'sidebar-item-active' : 'sidebar-item-idle'
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="p-3 border-t" style={{ borderColor: `hsl(var(--sidebar-border))` }}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="sidebar-item sidebar-item-idle w-full justify-center"
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          {!collapsed && <span>Recolher</span>}
        </button>
      </div>
    </aside>
  );
}
