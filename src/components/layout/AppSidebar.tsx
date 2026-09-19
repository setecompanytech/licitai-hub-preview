import { useEffect, useState, type ElementType } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ChevronDown,
  LayoutDashboard,
  LayoutGrid,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import BrandLogo from '@/components/shared/BrandLogo';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { useMembroPermissoes } from '@/hooks/useMembroPermissoes';
import { usePreferenciasDeNavegacao } from '@/hooks/usePreferenciasDeNavegacao';
import { navGroups, type NavGroup, type NavItem } from '@/lib/navegacao/menu';
import { funcoesDoSistema } from '@/lib/navegacao/registro';
import {
  chaveDosGrupos,
  gravarGrupos,
  grupoContem,
  itemAtivo,
  lerGrupos,
  ROTA_PAINEL,
} from '@/lib/navegacao/sidebar';

/**
 * AppSidebar — a navegação principal do Praefectus (Design System v3, 19/09/2026).
 *
 * Coluna navy de 248px, recolhível a um trilho de 72px. No topo a marca; abaixo
 * o Painel, os favoritos da pessoa e os grupos do menu — que são os de
 * `lib/navegacao/menu.ts`, a autoridade única. Nada aqui tem lista própria:
 * grupo novo no menu aparece aqui sozinho.
 *
 * Os grupos se recolhem. O da tela atual abre sozinho ao navegar para ela; o
 * resto lembra o que a pessoa escolheu (por usuário, no navegador — é
 * preferência de leitura, não dado de negócio).
 *
 * No trilho, cada grupo vira um botão com o ícone da categoria que abre um
 * menu com os itens; Painel e favoritos ganham dica ao passar o mouse. No
 * celular a mesma coluna vive numa gaveta (`movel`), sempre expandida, e
 * navegar a fecha.
 *
 * O que NÃO mudou de lugar: a busca única continua no topo (Ctrl+K) e o
 * diretório inteiro continua sendo "Todas as ferramentas" (Ctrl+Shift+K).
 */
export interface AppSidebarProps {
  /** Trilho de 72px, só ícones. Ignorado dentro da gaveta do celular. */
  recolhida?: boolean;
  aoAlternarRecolhida?: () => void;
  aoAbrirFerramentas: () => void;
  aoAbrirBusca?: () => void;
  /** Dentro da gaveta do celular: sempre expandida, e navegar fecha. */
  movel?: boolean;
  aoNavegar?: () => void;
  className?: string;
}

const FOCO = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-inset';

/** Item da lista expandida: 36px, ícone de 18px, tarja verde à esquerda quando ativo. */
function ItemDeMenu({
  para,
  icone: Icone,
  rotulo,
  ativo,
  aoNavegar,
}: {
  para: string;
  icone: ElementType;
  rotulo: string;
  ativo: boolean;
  aoNavegar?: () => void;
}) {
  return (
    <Link
      to={para}
      onClick={aoNavegar}
      aria-current={ativo ? 'page' : undefined}
      className={cn(
        'group relative flex h-9 items-center gap-3 rounded-md px-3 text-[13px] font-medium transition-colors duration-150',
        FOCO,
        ativo
          ? 'bg-white/10 font-semibold text-white'
          : 'text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-white',
      )}
    >
      {ativo && (
        <span aria-hidden="true" className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-sidebar-primary" />
      )}
      <Icone
        aria-hidden="true"
        strokeWidth={1.9}
        className={cn(
          'h-[18px] w-[18px] shrink-0 transition-colors',
          ativo ? 'text-sidebar-primary' : 'text-sidebar-foreground/70 group-hover:text-white',
        )}
      />
      <span className="truncate">{rotulo}</span>
    </Link>
  );
}

/** Botão quadrado do trilho (e do rodapé): 40px, com dica ao lado. */
function BotaoDoTrilho({
  rotulo,
  icone: Icone,
  ativo = false,
  para,
  onClick,
  ariaProps,
}: {
  rotulo: string;
  icone: ElementType;
  ativo?: boolean;
  para?: string;
  onClick?: () => void;
  ariaProps?: Record<string, unknown>;
}) {
  const classe = cn(
    'relative flex h-10 w-10 items-center justify-center rounded-md transition-colors duration-150',
    FOCO,
    ativo ? 'bg-white/10 text-sidebar-primary' : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-white',
  );
  const conteudo = (
    <>
      {ativo && (
        <span aria-hidden="true" className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-sidebar-primary" />
      )}
      <Icone aria-hidden="true" strokeWidth={1.9} className="h-[19px] w-[19px]" />
    </>
  );
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {para ? (
          <Link to={para} aria-label={rotulo} aria-current={ativo ? 'page' : undefined} className={classe} {...ariaProps}>
            {conteudo}
          </Link>
        ) : (
          <button type="button" aria-label={rotulo} onClick={onClick} className={classe} {...ariaProps}>
            {conteudo}
          </button>
        )}
      </TooltipTrigger>
      <TooltipContent side="right">{rotulo}</TooltipContent>
    </Tooltip>
  );
}

export default function AppSidebar({
  recolhida = false,
  aoAlternarRecolhida,
  aoAbrirFerramentas,
  aoAbrirBusca,
  movel = false,
  aoNavegar,
  className,
}: AppSidebarProps) {
  const { pathname, search } = useLocation();
  const { user } = useAuth();
  const { canAccessRoute, isAdmin } = useMembroPermissoes();
  const { favoritos } = usePreferenciasDeNavegacao();

  const expandida = movel || !recolhida;

  /**
   * Item de menu que a pessoa não pode abrir não aparece. `canAccessRoute`
   * nasce de novo a cada render do hook de permissões; filtrar aqui, sem
   * memo, custa quarenta e poucas comparações.
   */
  const permitido = (item: Pick<NavItem, 'path' | 'adminOnly'>) => {
    if (item.adminOnly && !isAdmin) return false;
    try {
      return canAccessRoute(item.path.split('?')[0]);
    } catch {
      return true;
    }
  };

  const grupos: NavGroup[] = navGroups
    .map((g) => ({ ...g, items: g.items.filter((i) => i.path !== ROTA_PAINEL && permitido(i)) }))
    .filter((g) => g.items.length > 0);

  const porId = new Map(funcoesDoSistema.map((f) => [f.id, f]));
  const favoritas = favoritos
    .map((id) => porId.get(id))
    .filter((f): f is NonNullable<typeof f> => !!f && f.rota !== ROTA_PAINEL && permitido({ path: f.rota, adminOnly: f.adminOnly }));

  // O grupo da tela atual abre sozinho; os outros lembram a escolha da pessoa.
  const grupoAtual = navGroups.find((g) => grupoContem(g, pathname))?.title;
  const chave = chaveDosGrupos(user?.id);
  const [abertos, setAbertos] = useState<Record<string, boolean>>(() => lerGrupos(chave));

  useEffect(() => {
    setAbertos(lerGrupos(chave));
  }, [chave]);

  useEffect(() => {
    if (!grupoAtual) return;
    setAbertos((atual) => (atual[grupoAtual] ? atual : { ...atual, [grupoAtual]: true }));
  }, [grupoAtual]);

  const estaAberto = (g: NavGroup) => abertos[g.title] ?? g.title === grupoAtual;
  const alternarGrupo = (titulo: string, aberto: boolean) =>
    setAbertos((atual) => {
      const proximo = { ...atual, [titulo]: !aberto };
      gravarGrupos(chave, proximo);
      return proximo;
    });

  const painelAtivo = pathname === ROTA_PAINEL;

  return (
    <aside
      aria-label="Navegação principal"
      data-recolhida={!expandida || undefined}
      className={cn('nao-imprime flex h-full min-h-0 flex-col bg-sidebar text-sidebar-foreground', className)}
    >
      {/* Marca — e o recolher, que fica ao lado dela quando há espaço. */}
      <div
        className={cn(
          'flex h-[var(--g-topo)] shrink-0 items-center border-b border-sidebar-border',
          expandida ? 'gap-2 px-4' : 'justify-center px-2',
        )}
      >
        <Link
          to={ROTA_PAINEL}
          onClick={aoNavegar}
          aria-label="Praefectus — página inicial"
          className={cn('flex min-w-0 items-center rounded-md', FOCO)}
        >
          {expandida ? (
            <BrandLogo variant="dark" mode="full" className="w-[136px]" />
          ) : (
            <BrandLogo variant="dark" mode="symbol" width={30} />
          )}
        </Link>
        {expandida && !movel && aoAlternarRecolhida && (
          <button
            type="button"
            onClick={aoAlternarRecolhida}
            aria-label="Recolher menu"
            title="Recolher menu"
            className={cn(
              'ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-white',
              FOCO,
            )}
          >
            <PanelLeftClose aria-hidden="true" className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav className="scrollbar-thin min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-3">
        {expandida ? (
          <>
            <ItemDeMenu para={ROTA_PAINEL} icone={LayoutDashboard} rotulo="Painel" ativo={painelAtivo} aoNavegar={aoNavegar} />

            {favoritas.length > 0 && (
              <section aria-label="Favoritos" className="mt-3">
                <h2 className="flex h-8 items-center gap-2 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-sidebar-foreground/55">
                  <Star aria-hidden="true" className="h-3 w-3" />
                  Favoritos
                </h2>
                <ul className="mt-0.5 flex flex-col gap-0.5">
                  {favoritas.map((f) => (
                    <li key={f.id}>
                      <ItemDeMenu
                        para={f.rota}
                        icone={f.icone}
                        rotulo={f.nome}
                        ativo={itemAtivo(f.rota, pathname, search)}
                        aoNavegar={aoNavegar}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {grupos.map((g) => {
              const aberto = estaAberto(g);
              const Icone = g.icone;
              return (
                <section key={g.title} className="mt-3" data-grupo={g.title}>
                  <h2>
                    <button
                      type="button"
                      onClick={() => alternarGrupo(g.title, aberto)}
                      aria-expanded={aberto}
                      className={cn(
                        'flex h-8 w-full items-center gap-2 rounded-md px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-sidebar-foreground/55 transition-colors hover:text-sidebar-foreground',
                        FOCO,
                      )}
                    >
                      {Icone && <Icone aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />}
                      <span className="min-w-0 flex-1 truncate text-left">{g.curto ?? g.title}</span>
                      <ChevronDown
                        aria-hidden="true"
                        className={cn('h-3.5 w-3.5 shrink-0 transition-transform duration-150', !aberto && '-rotate-90')}
                      />
                    </button>
                  </h2>
                  {aberto && (
                    <ul className="mt-0.5 flex flex-col gap-0.5">
                      {g.items.map((item) => (
                        <li key={item.path}>
                          <ItemDeMenu
                            para={item.path}
                            icone={item.icon}
                            rotulo={item.label}
                            ativo={itemAtivo(item.path, pathname, search)}
                            aoNavegar={aoNavegar}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </>
        ) : (
          <ul className="flex flex-col items-center gap-1">
            <li>
              <BotaoDoTrilho rotulo="Painel" icone={LayoutDashboard} para={ROTA_PAINEL} ativo={painelAtivo} />
            </li>
            {favoritas.map((f) => (
              <li key={f.id}>
                <BotaoDoTrilho rotulo={f.nome} icone={f.icone} para={f.rota} ativo={itemAtivo(f.rota, pathname, search)} />
              </li>
            ))}
            <li aria-hidden="true" className="my-1 h-px w-8 bg-sidebar-border" />
            {grupos.map((g) => {
              const Icone = g.icone ?? g.items[0].icon;
              const contem = grupoContem(g, pathname);
              return (
                <li key={g.title}>
                  <DropdownMenu>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label={g.title}
                            className={cn(
                              'relative flex h-10 w-10 items-center justify-center rounded-md transition-colors duration-150',
                              FOCO,
                              contem
                                ? 'bg-white/10 text-sidebar-primary'
                                : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-white',
                            )}
                          >
                            {contem && (
                              <span aria-hidden="true" className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-sidebar-primary" />
                            )}
                            <Icone aria-hidden="true" strokeWidth={1.9} className="h-[19px] w-[19px]" />
                          </button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="right">{g.title}</TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent side="right" align="start" sideOffset={10} className="w-60">
                      <DropdownMenuLabel>{g.title}</DropdownMenuLabel>
                      {g.items.map((item) => {
                        const ativo = itemAtivo(item.path, pathname, search);
                        return (
                          <DropdownMenuItem key={item.path} asChild>
                            <Link to={item.path} aria-current={ativo ? 'page' : undefined} className={cn(ativo && 'bg-primary-tint font-semibold text-primary')}>
                              <item.icon aria-hidden="true" />
                              <span className="truncate">{item.label}</span>
                            </Link>
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      {/* Rodapé: o diretório inteiro, a busca (no trilho e na gaveta) e o expandir. */}
      <div className={cn('shrink-0 border-t border-sidebar-border p-2', !expandida && 'flex flex-col items-center gap-1')}>
        {expandida ? (
          <>
            <button
              type="button"
              onClick={aoAbrirFerramentas}
              aria-haspopup="dialog"
              title="Todas as ferramentas (Ctrl+Shift+K)"
              className={cn(
                'flex h-9 w-full items-center gap-3 rounded-md px-3 text-[13px] font-medium text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent hover:text-white',
                FOCO,
              )}
            >
              <LayoutGrid aria-hidden="true" strokeWidth={1.9} className="h-[18px] w-[18px] shrink-0 text-sidebar-foreground/70" />
              <span className="min-w-0 flex-1 truncate text-left">Todas as ferramentas</span>
              <kbd className="hidden rounded border border-sidebar-border px-1 font-sans text-[10px] text-sidebar-foreground/55 lg:inline">
                ⇧⌘K
              </kbd>
            </button>
            {movel && aoAbrirBusca && (
              <button
                type="button"
                onClick={aoAbrirBusca}
                aria-label="Buscar no sistema"
                className={cn(
                  'mt-0.5 flex h-9 w-full items-center gap-3 rounded-md px-3 text-[13px] font-medium text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent hover:text-white',
                  FOCO,
                )}
              >
                <Search aria-hidden="true" strokeWidth={1.9} className="h-[18px] w-[18px] shrink-0 text-sidebar-foreground/70" />
                <span className="min-w-0 flex-1 truncate text-left">Buscar no sistema</span>
              </button>
            )}
          </>
        ) : (
          <>
            <BotaoDoTrilho rotulo="Todas as ferramentas" icone={LayoutGrid} onClick={aoAbrirFerramentas} ariaProps={{ 'aria-haspopup': 'dialog' }} />
            {aoAbrirBusca && <BotaoDoTrilho rotulo="Buscar no sistema" icone={Search} onClick={aoAbrirBusca} />}
            {aoAlternarRecolhida && (
              <BotaoDoTrilho rotulo="Expandir menu" icone={PanelLeftOpen} onClick={aoAlternarRecolhida} />
            )}
          </>
        )}
      </div>
    </aside>
  );
}
