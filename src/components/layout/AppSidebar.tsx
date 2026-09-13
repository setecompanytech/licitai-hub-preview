import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, PanelLeftClose, PanelLeftOpen, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import BrandLogo from '@/components/shared/BrandLogo';
import { useMembroPermissoes } from '@/hooks/useMembroPermissoes';
import { navGroups, type NavGroup } from '@/lib/navegacao/menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * AppSidebar — a coluna de navegação, de volta ao lado esquerdo (13/09/2026).
 *
 * Contexto, porque a história importa para quem vier depois: em 13/09 a
 * navegação foi movida para o centro do topo a pedido do dono do produto, e a
 * coluna foi removida. No mesmo dia, o comando de reestruturação do módulo
 * Gestão chegou com 22 referências aprovadas, todas com a coluna à esquerda, e
 * um requisito escrito — "sidebar azul-marinho de 240px, recolhível". O pedido
 * mais recente venceu. O que a barra do topo tinha resolvido não se perdeu: a
 * lupa continua ÚNICA, e agora mora aqui, abaixo da marca.
 *
 * Anatomia, conforme as referências:
 *   marca (≤180px)  ·  botão de recolher
 *   campo de busca do sistema (⌘K)
 *   grupos recolhíveis; item ativo com fundo verde e texto branco
 *
 * Recolhida (68px), sobram os ícones e cada um ganha tooltip com o nome — sem
 * isso, a barra recolhida vira uma coluna de charadas. O estado dura entre
 * sessões porque é preferência de quem trabalha o dia inteiro na tela, não
 * escolha de momento.
 *
 * A lista vem de `menu.ts`, como sempre: é a autoridade única, e é o que
 * impede a coluna e a gaveta do celular de divergirem.
 */

const CHAVE_RECOLHIDA = 'praefectus:barra-recolhida';

/** Qual grupo está aberto ao abrir a tela: o que contém a rota atual. */
function grupoDaRota(pathname: string): string | null {
  const contem = (path: string) =>
    pathname === path.split('?')[0] || pathname.startsWith(path.split('?')[0] + '/');
  return navGroups.find((g) => g.items.some((i) => contem(i.path)))?.title ?? null;
}

interface AppSidebarProps {
  /** Na gaveta do celular, fechar após navegar. */
  aoNavegar?: () => void;
  /** A gaveta nunca recolhe: lá a largura já é a da tela. */
  permiteRecolher?: boolean;
}

export default function AppSidebar({ aoNavegar, permiteRecolher = true }: AppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { canAccessRoute, isAdmin: isEmpresaAdmin } = useMembroPermissoes();

  const [recolhida, setRecolhida] = useState(() => {
    if (!permiteRecolher || typeof window === 'undefined') return false;
    return window.localStorage.getItem(CHAVE_RECOLHIDA) === '1';
  });
  const [abertos, setAbertos] = useState<Record<string, boolean>>(() => {
    const atual = grupoDaRota(location.pathname);
    return atual ? { [atual]: true } : {};
  });

  // Navegar para outro grupo abre o grupo de destino, sem fechar o que a
  // pessoa tiver aberto à mão: quem está comparando duas áreas não perde uma
  // ao visitar a outra.
  useEffect(() => {
    const atual = grupoDaRota(location.pathname);
    if (atual) setAbertos((a) => (a[atual] ? a : { ...a, [atual]: true }));
  }, [location.pathname]);

  useEffect(() => {
    if (permiteRecolher) window.localStorage.setItem(CHAVE_RECOLHIDA, recolhida ? '1' : '0');
  }, [recolhida, permiteRecolher]);

  const grupos: NavGroup[] = navGroups
    .map((g) => ({
      ...g,
      items: g.items.filter((it) => {
        if (it.adminOnly && !isEmpresaAdmin) return false;
        return canAccessRoute(it.path.split('?')[0]);
      }),
    }))
    .filter((g) => g.items.length > 0);

  /**
   * O item aceso é o que descreve ONDE a pessoa está — e desde que o
   * Financeiro passou a listar suas cinco pastas, cinco itens compartilham a
   * mesma rota e se distinguem só pela busca (`/financeiro?pasta=bancos`).
   * Comparar apenas o caminho acenderia os cinco de uma vez, que é pior do que
   * não acender nenhum: a barra afirmaria que a pessoa está em cinco lugares.
   */
  const ehAtivo = (path: string) => {
    const [base, busca] = path.split('?');
    const mesmoCaminho =
      location.pathname === base || location.pathname.startsWith(base + '/');
    if (!mesmoCaminho) return false;
    if (!busca) return true;
    const esperado = new URLSearchParams(busca);
    const atual = new URLSearchParams(location.search);
    for (const [chave, valor] of esperado) {
      if (atual.get(chave) !== valor) return false;
    }
    return true;
  };

  const irPara = (path: string) => {
    navigate(path);
    aoNavegar?.();
  };

  const abrirBusca = () => {
    window.dispatchEvent(new CustomEvent('praefectus:abrir-busca'));
    aoNavegar?.();
  };

  return (
    <TooltipProvider delayDuration={200}>
      <nav
        aria-label="Navegação principal"
        className={cn(
          'flex h-full flex-col bg-sidebar text-sidebar-foreground',
          recolhida ? 'w-[var(--g-barra-lateral-fechada)]' : 'w-[var(--g-barra-lateral)]',
        )}
      >
        {/* Marca + recolher */}
        <div
          className={cn(
            'flex shrink-0 items-center gap-2 px-4 pb-3 pt-5',
            recolhida && 'flex-col px-2',
          )}
        >
          <Link
            to="/dashboard"
            onClick={aoNavegar}
            aria-label="Praefectus — página inicial"
            className="flex min-w-0 flex-1 items-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          >
            <BrandLogo
              variant="dark"
              mode={recolhida ? 'symbol' : 'full'}
              className={recolhida ? 'w-8' : 'w-[176px]'}
            />
          </Link>

          {permiteRecolher && (
            <button
              type="button"
              onClick={() => setRecolhida((v) => !v)}
              aria-label={recolhida ? 'Expandir navegação' : 'Recolher navegação'}
              aria-expanded={!recolhida}
              // 36px de alvo: o ícone tem 16, e `p-1.5` deixava o botão em 24 —
              // abaixo do que um dedo acerta, e este é um controle que se usa
              // com a tela em uso, não uma vez por sessão.
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            >
              {recolhida ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>
          )}
        </div>

        {/* Busca — a MESMA do Ctrl+K. Não é um segundo índice: é o mesmo
            diálogo, chamado de outro lugar. */}
        <div className={cn('shrink-0 px-4 pb-3', recolhida && 'px-2')}>
          <button
            type="button"
            onClick={abrirBusca}
            className={cn(
              'flex w-full items-center gap-2 rounded-[var(--g-raio)] border border-sidebar-border bg-sidebar-accent/40 text-sidebar-foreground/70 transition-colors hover:border-sidebar-ring/50 hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
              recolhida ? 'justify-center p-2.5' : 'px-3 py-2.5',
            )}
            aria-label="Buscar no sistema"
            title="Buscar no sistema (Ctrl+K)"
          >
            <Search aria-hidden="true" className="h-4 w-4 shrink-0" />
            {!recolhida && (
              <>
                <span className="g-corpo min-w-0 flex-1 truncate text-left">Buscar no sistema...</span>
                <kbd className="g-meta shrink-0 rounded border border-sidebar-border px-1.5 py-0.5 font-sans">
                  ⌘K
                </kbd>
              </>
            )}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pb-4">
          {grupos.map((grupo) => {
            const aberto = abertos[grupo.title] ?? false;
            const temAtivo = grupo.items.some((i) => ehAtivo(i.path));

            if (recolhida) {
              // Recolhida, o cabeçalho de grupo não cabe: os itens vêm todos,
              // separados por um filete, cada um com o nome no tooltip.
              return (
                <div
                  key={grupo.title}
                  className="border-b border-sidebar-border/60 py-2 last:border-0"
                >
                  {grupo.items.map((item) => (
                    <Tooltip key={item.path}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => irPara(item.path)}
                          aria-current={ehAtivo(item.path) ? 'page' : undefined}
                          className={cn(
                            'mb-0.5 flex w-full items-center justify-center rounded-[var(--g-raio)] p-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                            ehAtivo(item.path)
                              ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                              : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                          )}
                        >
                          <item.icon aria-hidden="true" className="h-[18px] w-[18px]" />
                          <span className="sr-only">{item.label}</span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right">{item.label}</TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              );
            }

            return (
              <div key={grupo.title} className="mb-1">
                <button
                  type="button"
                  onClick={() => setAbertos((a) => ({ ...a, [grupo.title]: !aberto }))}
                  aria-expanded={aberto}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-[var(--g-raio)] px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                    temAtivo
                      ? 'text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/85 hover:bg-sidebar-accent/50',
                  )}
                >
                  {grupo.icone && (
                    <grupo.icone aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
                  )}
                  <span className="g-corpo min-w-0 flex-1 truncate font-semibold">
                    {grupo.curto ?? grupo.title}
                  </span>
                  <ChevronDown
                    aria-hidden="true"
                    className={cn(
                      'h-4 w-4 shrink-0 transition-transform',
                      aberto ? 'rotate-180' : '',
                    )}
                  />
                </button>

                {aberto && (
                  <ul className="mt-0.5 flex flex-col gap-0.5">
                    {grupo.items.map((item) => {
                      const ativo = ehAtivo(item.path);
                      return (
                        <li key={item.path}>
                          <button
                            type="button"
                            onClick={() => irPara(item.path)}
                            aria-current={ativo ? 'page' : undefined}
                            className={cn(
                              'flex w-full items-center gap-2.5 rounded-[var(--g-raio)] py-2 pl-4 pr-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                              'min-h-[var(--g-linha)]',
                              ativo
                                ? 'bg-sidebar-primary font-semibold text-sidebar-primary-foreground'
                                : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                            )}
                          >
                            <item.icon aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
                            <span className="g-corpo min-w-0 flex-1 truncate">{item.label}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </nav>
    </TooltipProvider>
  );
}
