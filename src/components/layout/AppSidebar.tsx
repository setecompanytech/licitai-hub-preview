import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, PanelLeftClose, PanelLeftOpen, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMembroPermissoes } from '@/hooks/useMembroPermissoes';
import { navGroups, type NavGroup } from '@/lib/navegacao/menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/**
 * Barra lateral do app — a navegação persistente do protótipo.
 *
 * Consome `navGroups` do AppTopNav, que é a autoridade do menu: as duas
 * navegações mostram a mesma coisa porque leem a mesma lista.
 *
 * ─── DOIS ESTADOS, NUNCA ZERO ──────────────────────────────────────────────
 *
 * Até 10/09/2026 "recolhida" era largura zero: a navegação sumia atrás de um
 * hambúrguer na barra do topo. Num sistema de dez seções que a pessoa
 * atravessa o dia inteiro, isso é um clique a mais em toda troca de tela.
 *
 * Agora a barra tem dois estados e o menor deles ainda navega:
 *
 *  - **trilho** (56px): só ícones, rótulo no tooltip, e o botão de expandir no
 *    topo. Grupo com várias páginas abre um flyout à direita com elas — sem
 *    isso o trilho só serviria para os grupos de um destino só.
 *  - **coluna** (264px): busca, grupos em sanfona, rótulos. Como sempre foi.
 *
 * O botão que alterna mora AQUI, no topo da própria barra, nos dois estados.
 * A barra do topo perdeu o hambúrguer: quem controla a barra lateral é a
 * barra lateral. Abaixo de 768px nada disto existe — lá quem navega é a
 * gaveta do AppTopNav, porque não há hover nem largura para trilho.
 *
 * ─── O TRILHO SE ESCONDE, E APARECE NA BORDA ───────────────────────────────
 *
 * Decisão do Ian em 10/09/2026, reafirmada depois das ressalvas: com mouse, o
 * trilho fica FORA da tela e desliza para dentro quando o cursor encosta na
 * borda esquerda — o conteúdo ganha a largura toda. Ao aparecer, é o mesmo
 * trilho: tooltip, flyout, botão de expandir. As ressalvas viraram regras:
 *
 *  - há um PUXADOR: faixa fina na borda, sempre visível, que acende no hover.
 *    Sem ele, ninguém saberia que existe menu ali.
 *  - abre só com o cursor NA borda (10px), e fecha com 300ms de atraso ao
 *    sair — não pisca quando o mouse passa raspando.
 *  - o trilho SOBREPÕE o conteúdo em vez de empurrá-lo; a tela não pula.
 *  - o flyout de um grupo segura o trilho aberto enquanto estiver em uso,
 *    porque o Popover é portalado para fora da <aside> e o mouseleave dispara.
 *  - teclado: o puxador é um botão focável, e foco dentro do trilho o mantém.
 *  - SEM MOUSE (tablet, `hover: none`), nada disso existe: o trilho fica
 *    fixo, em fluxo, como qualquer barra lateral. Hover não existe no toque.
 *
 * Três formas de item, como no protótipo:
 *  - grupo com vários destinos: rótulo em caixa alta e seta, abre e fecha;
 *  - grupo com um destino só: vira link direto, sem seta e sem caixa alta;
 *  - item ativo: fundo tingido, texto na cor de ação e marcador na borda esquerda.
 */
interface Props {
  /** true = coluna de 264px com rótulos; false = trilho de 56px só com ícones. */
  aberta?: boolean;
  /** Alterna entre trilho e coluna. Chamado pelos botões no topo da barra. */
  onAlternar?: () => void;
}

/** Marcador de item ativo: barra de 3px encostada na borda esquerda. */
const MARCADOR_ATIVO =
  'before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-r before:bg-accent';

export default function AppSidebar({ aberta = true, onAlternar }: Props) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { canAccessRoute, isAdmin } = useMembroPermissoes();
  const [busca, setBusca] = useState('');
  const [fechados, setFechados] = useState<Record<string, boolean>>({});

  // A lupa do trilho expande a coluna E leva o cursor para a busca. Como o
  // campo só existe na coluna, o foco tem que esperar ela montar.
  const inputBusca = useRef<HTMLInputElement>(null);
  const focarBuscaAoAbrir = useRef(false);
  useEffect(() => {
    if (aberta && focarBuscaAoAbrir.current) {
      focarBuscaAoAbrir.current = false;
      inputBusca.current?.focus();
    }
  }, [aberta]);

  const grupos: NavGroup[] = useMemo(
    () =>
      navGroups
        .map((g) => ({
          ...g,
          items: g.items.filter((it) => {
            if (it.adminOnly && !isAdmin) return false;
            return canAccessRoute(it.path.split('?')[0]);
          }),
        }))
        .filter((g) => g.items.length > 0),
    [canAccessRoute, isAdmin],
  );

  const termo = busca.trim().toLowerCase();
  const filtrados = useMemo(() => {
    if (!termo) return grupos;
    return grupos
      .map((g) => ({ ...g, items: g.items.filter((it) => it.label.toLowerCase().includes(termo)) }))
      .filter((g) => g.items.length > 0);
  }, [grupos, termo]);

  const ehAtivo = (path: string) => {
    const base = path.split('?')[0];
    return pathname === base || pathname.startsWith(base + '/');
  };

  // ── Esconde-aparece do trilho ──────────────────────────────────────────
  const temMouse = useTemMouse();
  const autoEsconde = !aberta && temMouse;
  const [trilhoChamado, setTrilhoChamado] = useState(false);
  const [flyoutsAbertos, setFlyoutsAbertos] = useState(0);
  const cursorDentro = useRef(false);
  const timerEsconder = useRef<number | null>(null);

  const cancelarEsconder = () => {
    if (timerEsconder.current !== null) {
      window.clearTimeout(timerEsconder.current);
      timerEsconder.current = null;
    }
  };
  const mostrarTrilho = () => {
    cancelarEsconder();
    setTrilhoChamado(true);
  };
  const esconderComAtraso = () => {
    cancelarEsconder();
    timerEsconder.current = window.setTimeout(() => setTrilhoChamado(false), 300);
  };
  useEffect(() => cancelarEsconder, []);
  // Ao virar coluna, o "chamado" perde sentido; ao voltar a trilho, começa
  // escondido — a pessoa acabou de pedir para recolher.
  useEffect(() => {
    setTrilhoChamado(false);
  }, [aberta]);
  // Flyout fechou com o cursor fora do trilho: some, sem esperar mouseleave
  // (que não vai vir, porque o cursor já saiu enquanto o flyout segurava).
  useEffect(() => {
    if (flyoutsAbertos === 0 && !cursorDentro.current) esconderComAtraso();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyoutsAbertos]);

  const trilhoVisivel = !autoEsconde || trilhoChamado || flyoutsAbertos > 0;

  return (
    <>
      {/* O puxador: só existe no modo esconde-aparece. É botão para o teclado
          alcançar o menu — Tab até ele e Enter mostram o trilho. */}
      {autoEsconde && (
        <button
          type="button"
          aria-label="Mostrar menu"
          onMouseEnter={mostrarTrilho}
          onFocus={mostrarTrilho}
          onClick={mostrarTrilho}
          className="nao-imprime hidden md:block fixed left-0 top-16 bottom-0 w-2.5 z-30 group cursor-pointer outline-none"
        >
          <span
            aria-hidden="true"
            className="absolute left-0 top-0 bottom-0 w-[3px] bg-border transition-colors group-hover:bg-accent group-focus-visible:bg-accent"
          />
        </button>
      )}

      {/* A coluna aparece a partir de 768px. O protótipo a esconde abaixo de
          900px, mas ali ela some junto com o logo e a busca; aqui a barra do
          topo já carrega esses dois, então ela cabe mais cedo. Abaixo disso,
          264px comeriam um terço da tela e a gaveta do topo é o caminho.

          Em fluxo (coluna, ou trilho sem mouse), a largura anima e o
          `overflow-hidden` recorta: cada estado desenha o seu conteúdo com
          largura FIXA por dentro, então rótulo não reflui durante os 200ms.
          No esconde-aparece a <aside> sai do fluxo (fixed) e anima o
          translate, sobrepondo o conteúdo em vez de empurrá-lo. */}
      <aside
        onMouseEnter={() => {
          cursorDentro.current = true;
          if (autoEsconde) mostrarTrilho();
        }}
        onMouseLeave={() => {
          cursorDentro.current = false;
          if (autoEsconde) esconderComAtraso();
        }}
        onFocusCapture={() => {
          if (autoEsconde) mostrarTrilho();
        }}
        onBlurCapture={(e) => {
          if (autoEsconde && !e.currentTarget.contains(e.relatedTarget as Node | null)) esconderComAtraso();
        }}
        className={cn(
          'nao-imprime hidden md:flex flex-shrink-0 flex-col bg-card border-r border-border z-30 overflow-hidden ease-out',
          autoEsconde
            ? cn(
                'fixed left-0 top-16 bottom-0 w-14 transition-transform duration-200',
                trilhoVisivel ? 'translate-x-0 shadow-lg' : '-translate-x-full',
              )
            : cn(
                'sticky top-16 h-[calc(100vh-4rem)] transition-[width] duration-200',
                aberta ? 'w-[264px]' : 'w-14',
              ),
        )}
      >
      {aberta ? (
        <div className="flex flex-col w-[264px] h-full">
          <div className="flex items-center gap-1.5 pl-4 pr-2 pt-4 pb-2.5">
            <div className="flex-1 min-w-0 flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border focus-within:border-accent transition-colors">
              <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" aria-hidden="true" />
              <input
                ref={inputBusca}
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar módulo..."
                aria-label="Buscar módulo"
                className="flex-1 min-w-0 bg-transparent border-0 outline-none text-sm placeholder:text-muted-foreground"
              />
            </div>
            <BotaoComDica rotulo="Recolher menu" onClick={onAlternar}>
              <PanelLeftClose className="w-5 h-5" aria-hidden="true" />
            </BotaoComDica>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 pb-6 scrollbar-thin">
            {filtrados.length === 0 && (
              <p className="px-2 py-5 text-center text-sm text-muted-foreground">
                Nenhum módulo encontrado.
              </p>
            )}

            {filtrados.map((grupo) => {
              const Icone = grupo.icone ?? grupo.items[0].icon;
              const temAtivo = grupo.items.some((it) => ehAtivo(it.path));
              // Buscando, tudo abre; fora da busca, abre o grupo da tela atual e
              // qualquer um que a pessoa tenha aberto na mão.
              const aberto = Boolean(termo) || (!fechados[grupo.title] && temAtivo) || fechados[grupo.title] === false;

              // Grupo de um destino só não vira sanfona: seria uma seta que abre
              // para revelar um item só, que é o próprio grupo.
              if (grupo.items.length === 1) {
                const unico = grupo.items[0];
                const ativo = ehAtivo(unico.path);
                return (
                  <button
                    key={grupo.title}
                    data-grupo={grupo.title}
                    onClick={() => navigate(unico.path)}
                    className={cn(
                      'relative flex items-center gap-3 w-full px-2.5 py-2 rounded-lg text-sm text-left transition-colors',
                      ativo
                        ? cn('bg-primary-tint text-accent font-semibold', MARCADOR_ATIVO)
                        : 'text-foreground hover:bg-muted',
                    )}
                  >
                    <Icone className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                    <span className="truncate">{grupo.title}</span>
                  </button>
                );
              }

              return (
                <div key={grupo.title}>
                  {/* `data-grupo` é âncora de medição, não estilo: o holofote de
                      boas-vindas (MascoteBoasVindas) precisa de um alvo estável
                      para recortar o véu em cima do grupo certo. */}
                  <button
                    data-grupo={grupo.title}
                    onClick={() => setFechados((f) => ({ ...f, [grupo.title]: !aberto ? false : true }))}
                    aria-expanded={aberto}
                    className={cn(
                      'flex items-center gap-3 w-full px-2.5 py-2.5 rounded-lg text-left transition-colors hover:bg-muted',
                      temAtivo ? 'text-accent' : 'text-foreground',
                    )}
                  >
                    <Icone className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                    <span className="flex-1 min-w-0 truncate text-xs font-bold uppercase tracking-wider">
                      {grupo.curto ?? grupo.title}
                    </span>
                    <ChevronDown
                      className={cn(
                        'w-4 h-4 flex-shrink-0 text-muted-foreground transition-transform',
                        aberto && 'rotate-180',
                      )}
                      aria-hidden="true"
                    />
                  </button>

                  {aberto && (
                    <div className="pb-1">
                      {grupo.items.map((item) => {
                        const ativo = ehAtivo(item.path);
                        return (
                          <button
                            key={item.path + item.label}
                            onClick={() => navigate(item.path)}
                            className={cn(
                              'relative flex items-center w-full pl-9 pr-2.5 py-2 rounded-lg text-sm text-left leading-snug transition-colors',
                              ativo
                                ? cn('bg-primary-tint text-accent font-semibold', MARCADOR_ATIVO)
                                : 'text-foreground hover:bg-muted',
                            )}
                          >
                            <span className="truncate">{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>
      ) : (
        <div className="flex flex-col items-center w-14 h-full pt-3 pb-4">
          <BotaoComDica rotulo="Expandir menu" onClick={onAlternar}>
            <PanelLeftOpen className="w-5 h-5" aria-hidden="true" />
          </BotaoComDica>
          <BotaoComDica
            rotulo="Buscar módulo"
            onClick={() => {
              focarBuscaAoAbrir.current = true;
              onAlternar?.();
            }}
          >
            <Search className="w-5 h-5" aria-hidden="true" />
          </BotaoComDica>

          <div className="w-7 h-px bg-border my-2" aria-hidden="true" />

          {/* A busca por texto não existe no trilho: sem rótulo não há o que
              filtrar. A lupa acima expande a coluna e já foca o campo. */}
          <nav className="flex-1 w-full flex flex-col items-center gap-1 overflow-y-auto overflow-x-hidden scrollbar-thin px-2">
            {grupos.map((grupo) => {
              const Icone = grupo.icone ?? grupo.items[0].icon;
              const temAtivo = grupo.items.some((it) => ehAtivo(it.path));

              if (grupo.items.length === 1) {
                return (
                  <BotaoComDica
                    key={grupo.title}
                    rotulo={grupo.title}
                    ativo={temAtivo}
                    onClick={() => navigate(grupo.items[0].path)}
                    data-grupo={grupo.title}
                  >
                    <Icone className="w-5 h-5" aria-hidden="true" />
                  </BotaoComDica>
                );
              }

              return (
                <GrupoNoTrilho
                  key={grupo.title}
                  grupo={grupo}
                  temAtivo={temAtivo}
                  ehAtivo={ehAtivo}
                  aoNavegar={navigate}
                  aoMudarFlyout={(aberto) => setFlyoutsAbertos((n) => Math.max(0, n + (aberto ? 1 : -1)))}
                >
                  <Icone className="w-5 h-5" aria-hidden="true" />
                </GrupoNoTrilho>
              );
            })}
          </nav>
        </div>
      )}
      </aside>
    </>
  );
}

/**
 * Há um mouse de verdade? `hover: hover` sozinho mente em alguns Android;
 * junto com `pointer: fine` separa mouse/trackpad de dedo/caneta.
 */
function useTemMouse() {
  const consulta = '(hover: hover) and (pointer: fine)';
  const [tem, setTem] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(consulta).matches
      : false,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(consulta);
    const aoMudar = (e: MediaQueryListEvent) => setTem(e.matches);
    mq.addEventListener('change', aoMudar);
    return () => mq.removeEventListener('change', aoMudar);
  }, []);
  return tem;
}

/**
 * Botão quadrado do trilho, com o rótulo no tooltip à direita.
 *
 * O `aria-label` carrega o mesmo texto do tooltip: leitor de tela não faz
 * hover, e um botão só com ícone seria mudo para ele.
 */
function BotaoComDica({
  rotulo,
  ativo = false,
  onClick,
  children,
  ...resto
}: {
  rotulo: string;
  ativo?: boolean;
  onClick?: () => void;
  children: ReactNode;
  'data-grupo'?: string;
}) {
  return (
    <Tooltip delayDuration={80}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={rotulo}
          className={cn(
            'relative flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0 transition-colors',
            ativo
              ? cn('bg-primary-tint text-accent', MARCADOR_ATIVO, 'before:-left-2')
              : 'text-foreground hover:bg-muted',
          )}
          {...resto}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={10}>
        {rotulo}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Grupo com várias páginas, no trilho: o ícone abre um flyout à direita com
 * as páginas. Tooltip e flyout no mesmo botão — enquanto o flyout está
 * aberto o tooltip fica calado, senão os dois disputam o mesmo canto.
 */
function GrupoNoTrilho({
  grupo,
  temAtivo,
  ehAtivo,
  aoNavegar,
  aoMudarFlyout,
  children,
}: {
  grupo: NavGroup;
  temAtivo: boolean;
  ehAtivo: (path: string) => boolean;
  aoNavegar: (path: string) => void;
  /** Avisa o pai quando o flyout abre/fecha — ele segura o trilho visível. */
  aoMudarFlyout?: (aberto: boolean) => void;
  children: ReactNode;
}) {
  const [flyoutAberto, setFlyoutAberto] = useState(false);
  const [dicaVisivel, setDicaVisivel] = useState(false);
  const mudarFlyout = (aberto: boolean) => {
    if (aberto !== flyoutAberto) aoMudarFlyout?.(aberto);
    setFlyoutAberto(aberto);
  };

  return (
    <Popover open={flyoutAberto} onOpenChange={mudarFlyout}>
      <Tooltip delayDuration={80} open={dicaVisivel && !flyoutAberto} onOpenChange={setDicaVisivel}>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              data-grupo={grupo.title}
              aria-label={grupo.title}
              aria-haspopup="menu"
              className={cn(
                'relative flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0 transition-colors',
                temAtivo
                  ? cn('bg-primary-tint text-accent', MARCADOR_ATIVO, 'before:-left-2')
                  : 'text-foreground hover:bg-muted',
                flyoutAberto && !temAtivo && 'bg-muted',
              )}
            >
              {children}
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={10}>
          {grupo.title}
        </TooltipContent>
      </Tooltip>

      <PopoverContent side="right" align="start" sideOffset={10} className="w-60 p-1.5">
        <p className="px-2.5 pt-1.5 pb-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {grupo.title}
        </p>
        {grupo.items.map((item) => {
          const ativo = ehAtivo(item.path);
          return (
            <button
              key={item.path + item.label}
              type="button"
              onClick={() => {
                mudarFlyout(false);
                aoNavegar(item.path);
              }}
              className={cn(
                'relative flex items-center w-full px-2.5 py-2 rounded-md text-sm text-left leading-snug transition-colors',
                ativo
                  ? cn('bg-primary-tint text-accent font-semibold', MARCADOR_ATIVO)
                  : 'text-foreground hover:bg-muted',
              )}
            >
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
