import { Link, useLocation } from 'react-router-dom';
import { BarChart3, FolderOpen, LayoutGrid, Plus, Search, Settings, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePreferenciasDeNavegacao } from '@/hooks/usePreferenciasDeNavegacao';
import { funcoesDoSistema } from '@/lib/navegacao/registro';
import { useMembroPermissoes } from '@/hooks/useMembroPermissoes';

const Divisor = () => (
  <div
    aria-hidden="true"
    style={{ height: 1, margin: '6px 5px', borderTop: '1px solid rgba(255,255,255,.11)' }}
  />
);

export default function CompactSidebar({
  aoAbrirFerramentas,
  aoAbrirBusca,
}: {
  aoAbrirFerramentas: () => void;
  aoAbrirBusca: () => void;
}) {
  const { pathname } = useLocation();
  const { favoritos } = usePreferenciasDeNavegacao();
  const { canAccessRoute, isAdmin } = useMembroPermissoes();

  const isActive = (to: string) =>
    to === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(to);

  const porId = new Map(funcoesDoSistema.map((f) => [f.id, f]));
  const itensFavoritos = favoritos
    .map((id) => porId.get(id))
    .filter((f): f is NonNullable<typeof f> => {
      if (!f) return false;
      if (f.adminOnly && !isAdmin) return false;
      try { return canAccessRoute(f.rota.split('?')[0]); } catch { return true; }
    });

  return (
    <aside
      className="nao-imprime fixed left-0 z-[35] flex flex-col"
      style={{
        top: 'var(--g-topo)',
        bottom: 0,
        width: 62,
        background: 'hsl(var(--navy))',
        borderRight: '1px solid hsl(var(--navy-hover))',
      }}
      aria-label="Navegação lateral"
    >
      <nav className="flex-1 overflow-y-auto overflow-x-hidden" style={{ padding: '10px 8px' }}>

        {/* Dashboard */}
        <Link
          to="/dashboard"
          aria-label="Painel da empresa"
          className={cn('sidebar-nav-item', isActive('/dashboard') && 'sidebar-nav-item--active')}
        >
          <BarChart3 className="h-[17px] w-[17px]" strokeWidth={1.8} aria-hidden="true" />
        </Link>

        <Divisor />

        {/* Favoritos dinâmicos */}
        {itensFavoritos.length > 0 && (
          <>
            <div
              aria-label="Favoritos"
              style={{ display: 'flex', justifyContent: 'center', marginBottom: 2 }}
            >
              <Star aria-hidden="true" style={{ width: 9, height: 9, color: 'rgba(255,255,255,.3)', fill: 'rgba(255,255,255,.3)' }} />
            </div>
            {itensFavoritos.map((f) => {
              const Icon = f.icone;
              return (
                <Link
                  key={f.id}
                  to={f.rota}
                  aria-label={f.nome}
                  className={cn('sidebar-nav-item', isActive(f.rota.split('?')[0]) && 'sidebar-nav-item--active')}
                >
                  <Icon className="h-[17px] w-[17px]" strokeWidth={1.8} aria-hidden="true" />
                </Link>
              );
            })}
          </>
        )}

        {/* Ver todas as ferramentas — fica logo acima do "+" porque, sem
            favoritos ainda salvos (o caso mais comum na primeira carga), essa
            é a única porta para o resto do sistema nesta coluna. */}
        <button
          type="button"
          onClick={aoAbrirFerramentas}
          aria-label="Todas as ferramentas"
          className="sidebar-nav-item"
          style={{ width: '100%' }}
        >
          <LayoutGrid className="h-[17px] w-[17px]" strokeWidth={1.8} aria-hidden="true" />
        </button>

        {/* Botão para adicionar favorito (abre todas as ferramentas) */}
        <button
          type="button"
          onClick={aoAbrirFerramentas}
          aria-label="Adicionar favorito"
          className="sidebar-nav-item"
          style={{ width: '100%' }}
        >
          <Plus className="h-[17px] w-[17px]" strokeWidth={1.8} aria-hidden="true" />
        </button>

        <Divisor />

        {/* Fixos: Documentos e Configurações */}
        <Link
          to="/documentos"
          aria-label="Documentos e certidões"
          className={cn('sidebar-nav-item', isActive('/documentos') && 'sidebar-nav-item--active')}
        >
          <FolderOpen className="h-[17px] w-[17px]" strokeWidth={1.8} aria-hidden="true" />
        </Link>

        <Link
          to="/configuracoes"
          aria-label="Configurações"
          className={cn('sidebar-nav-item', isActive('/configuracoes') && 'sidebar-nav-item--active')}
        >
          <Settings className="h-[17px] w-[17px]" strokeWidth={1.8} aria-hidden="true" />
        </Link>
      </nav>

      {/* Atalho inferior */}
      <div
        style={{
          padding: 8,
          borderTop: '1px solid rgba(255,255,255,.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          background: 'hsl(var(--navy))',
        }}
      >
        <button
          type="button"
          aria-label="Busca global"
          onClick={aoAbrirBusca}
          className="sidebar-shortcut"
        >
          <Search className="h-[17px] w-[17px]" strokeWidth={1.8} aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
