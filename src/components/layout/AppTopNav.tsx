import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, Menu, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import BrandLogo from '@/components/shared/BrandLogo';
import { useAuth } from '@/contexts/AuthContext';
import { useMembroPermissoes } from '@/hooks/useMembroPermissoes';
import { navGroups, type NavGroup } from '@/lib/navegacao/menu';

/**
 * AppTopNav — a navegação do app, na faixa superior (13/09/2026).
 *
 * Era a coluna da esquerda; o dono do produto pediu a navegação no centro do
 * topo. A faixa herdou os tokens `sidebar-*` (navy nos dois temas) porque a
 * massa escura era a assinatura da identidade: ela mudou de lugar, não sumiu.
 *
 * Como os nove grupos cabem numa linha — a conta, não o chute: rótulo sem
 * ícone + seta custa ~100px; a marca leva 176 e as ações (lupa, sino, tema,
 * engrenagem, empresa, avatar) até ~420. Nove soltos pedem ~900px e só cabem
 * a partir de 1536. Então:
 *  - até 1535px, QUATRO grupos soltos e o resto dentro de "Mais";
 *  - de 1536px em diante, os nove soltos e "Mais" desaparece.
 * A divisão é por CSS (`hidden min-[1536px]:inline-flex` nos extras e o
 * inverso no botão), sem medir largura em JavaScript — medida erra no
 * primeiro quadro e a barra pula ao carregar. Abaixo de 768px, gaveta.
 *
 * O ícone do grupo saiu da barra (ficou no menu de cada um): ele custava
 * ~22px por item e era justamente o que fazia os nove estourarem em 1440.
 *
 * A lista vem de `menu.ts`, como antes: a barra e a gaveta nunca divergem.
 */

/** Quantos grupos ficam soltos na barra abaixo de 1536px. */
const GRUPOS_SEMPRE_VISIVEIS = 4;

interface AppTopNavProps {
  onNavigate?: () => void;
}

export default function AppTopNav({ onNavigate }: AppTopNavProps) {
  const [gavetaAberta, setGavetaAberta] = useState(false);
  const [gruposAbertos, setGruposAbertos] = useState<Record<string, boolean>>({});
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { canAccessRoute, isAdmin: isEmpresaAdmin } = useMembroPermissoes();

  // Grupos filtrados pela permissão do membro — grupo que esvazia desaparece.
  const grupos: NavGroup[] = navGroups
    .map((g) => ({
      ...g,
      items: g.items.filter((it) => {
        if (it.adminOnly && !isEmpresaAdmin) return false;
        return canAccessRoute(it.path.split('?')[0]);
      }),
    }))
    .filter((g) => g.items.length > 0);

  const visiveis = grupos.slice(0, GRUPOS_SEMPRE_VISIVEIS);
  const extras = grupos.slice(GRUPOS_SEMPRE_VISIVEIS);

  const ehAtivo = (path: string) => {
    const base = path.split('?')[0];
    return location.pathname === base || location.pathname.startsWith(base + '/');
  };
  const grupoAtivo = (g: NavGroup) => g.items.some((i) => ehAtivo(i.path));

  const irPara = (path: string) => {
    navigate(path);
    setGavetaAberta(false);
    onNavigate?.();
  };

  const classeDoGrupo = (ativo: boolean, className?: string) =>
    cn(
      'inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-sm font-medium transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar',
      ativo
        ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
        : 'text-sidebar-foreground/85 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
      className,
    );

  /** Um grupo da barra: rótulo que abre o menu com as telas do grupo. */
  const GrupoDaBarra = ({ grupo, className }: { grupo: NavGroup; className?: string }) => {
    const ativo = grupoAtivo(grupo);

    // Grupo de um destino só não vira menu: abrir uma lista para mostrar um
    // item — que ainda por cima repete o nome do grupo, como "Financeiro" —
    // é um clique a mais para chegar ao mesmo lugar.
    if (grupo.items.length === 1) {
      const unico = grupo.items[0];
      return (
        <button type="button" onClick={() => irPara(unico.path)} className={classeDoGrupo(ativo, className)}>
          {grupo.curto ?? grupo.title}
        </button>
      );
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={classeDoGrupo(ativo, className)}>
            {grupo.curto ?? grupo.title}
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60">
          {grupo.items.map((item) => (
            <DropdownMenuItem
              key={item.path}
              onSelect={() => irPara(item.path)}
              className={cn('gap-2.5', ehAtivo(item.path) && 'bg-primary-tint text-primary font-semibold')}
            >
              <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{item.label}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <>
      {/* Barra — some abaixo de 768px, onde manda a gaveta. */}
      <nav aria-label="Navegação principal" className="hidden md:flex min-w-0 items-center gap-0.5 overflow-hidden">
        {visiveis.map((g) => (
          <GrupoDaBarra key={g.title} grupo={g} />
        ))}
        {extras.map((g) => (
          <GrupoDaBarra key={g.title} grupo={g} className="hidden min-[1536px]:inline-flex" />
        ))}

        {extras.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Mais seções"
                className={cn(
                  'inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-sm font-medium transition-colors min-[1536px]:hidden',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar',
                  extras.some(grupoAtivo)
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
                    : 'text-sidebar-foreground/85 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
                )}
              >
                <MoreHorizontal className="h-4 w-4 shrink-0" aria-hidden="true" />
                Mais
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              {extras.map((g) => (
                <div key={g.title} className="py-1">
                  {g.items.length > 1 && (
                    <p className="px-2 pb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {g.curto ?? g.title}
                    </p>
                  )}
                  {g.items.map((item) => (
                    <DropdownMenuItem
                      key={item.path}
                      onSelect={() => irPara(item.path)}
                      className={cn('gap-2.5', ehAtivo(item.path) && 'bg-primary-tint text-primary font-semibold')}
                    >
                      <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">{item.label}</span>
                    </DropdownMenuItem>
                  ))}
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </nav>

      {/* Hambúrguer — só abaixo de 768px. */}
      <button
        type="button"
        aria-label="Abrir menu"
        aria-expanded={gavetaAberta}
        className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-md text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        onClick={() => setGavetaAberta(true)}
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      <Sheet open={gavetaAberta} onOpenChange={setGavetaAberta}>
        <SheetContent
          side="left"
          className="flex w-[280px] flex-col bg-sidebar p-0 text-sidebar-foreground border-sidebar-border [&>button]:text-sidebar-foreground"
        >
          <div className="flex h-16 shrink-0 items-center border-b border-sidebar-border px-4">
            <Link
              to="/dashboard"
              aria-label="Praefectus — página inicial"
              onClick={() => setGavetaAberta(false)}
              className="flex items-center"
            >
              <BrandLogo variant="dark" className="w-[150px]" />
            </Link>
          </div>

          <nav aria-label="Navegação" className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            {grupos.map((grupo) => {
              const aberto = gruposAbertos[grupo.title] ?? grupoAtivo(grupo);
              return (
                <div key={grupo.title} className="mb-1">
                  <button
                    type="button"
                    aria-expanded={aberto}
                    onClick={() => setGruposAbertos((p) => ({ ...p, [grupo.title]: !aberto }))}
                    className="flex w-full items-center justify-between rounded-md px-3 py-2 text-xs font-bold uppercase tracking-wider text-sidebar-foreground/60 transition-colors hover:text-sidebar-foreground"
                  >
                    <span>{grupo.title}</span>
                    <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', !aberto && '-rotate-90')} aria-hidden="true" />
                  </button>
                  {aberto && (
                    <div className="mb-2 space-y-0.5">
                      {grupo.items.map((item) => (
                        <button
                          key={item.path}
                          type="button"
                          onClick={() => irPara(item.path)}
                          className={cn(
                            'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                            ehAtivo(item.path)
                              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                              : 'text-sidebar-foreground hover:bg-sidebar-accent/60',
                          )}
                        >
                          <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span className="truncate">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          <div className="border-t border-sidebar-border p-3">
            <button
              type="button"
              onClick={async () => { await signOut(); navigate('/'); setGavetaAberta(false); }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
            >
              <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Sair da conta</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
