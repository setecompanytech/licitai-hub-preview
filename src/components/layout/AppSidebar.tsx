import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMembroPermissoes } from '@/hooks/useMembroPermissoes';
import { navGroups, type NavGroup } from '@/lib/navegacao/menu';

/**
 * Barra lateral do app — a navegação persistente do protótipo.
 *
 * Consome `navGroups` do AppTopNav, que é a autoridade do menu: as duas
 * navegações mostram a mesma coisa porque leem a mesma lista.
 *
 * Três formas de item, como no protótipo:
 *  - grupo com vários destinos: rótulo em caixa alta e seta, abre e fecha;
 *  - grupo com um destino só: vira link direto, sem seta e sem caixa alta;
 *  - item ativo: fundo tingido, texto na cor de ação e marcador na borda esquerda.
 */
interface Props {
  /** Recolhida pelo botão ao lado da marca, na barra do topo. */
  aberta?: boolean;
}

export default function AppSidebar({ aberta = true }: Props) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { canAccessRoute, isAdmin } = useMembroPermissoes();
  const [busca, setBusca] = useState('');
  const [fechados, setFechados] = useState<Record<string, boolean>>({});

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

  return (
    // A coluna aparece a partir de 768px. O protótipo a esconde abaixo de
    // 900px, mas ali ela some junto com o logo e a busca; aqui a barra do topo
    // já carrega esses dois, então ela cabe mais cedo. Abaixo disso, 264px
    // comeriam um terço da tela e a gaveta do topo é o caminho.
    //
    // Recolhida, a largura vai a zero em vez de a coluna sumir do documento:
    // assim o conteúdo desliza no lugar dela, em vez de dar um salto.
    <aside
      aria-hidden={!aberta}
      className={cn(
        'nao-imprime hidden md:flex flex-shrink-0 flex-col sticky top-14 h-[calc(100vh-3.5rem)] bg-card z-30 overflow-hidden transition-[width,border-width] duration-200 ease-out',
        aberta ? 'w-[264px] border-r border-border' : 'w-0 border-r-0',
      )}
    >
      <div className="px-4 pt-4 pb-2.5">
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border focus-within:border-accent transition-colors">
          <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" aria-hidden="true" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar módulo..."
            aria-label="Buscar módulo"
            className="flex-1 min-w-0 bg-transparent border-0 outline-none text-sm placeholder:text-muted-foreground"
          />
        </div>
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
                onClick={() => navigate(unico.path)}
                className={cn(
                  'relative flex items-center gap-3 w-full px-2.5 py-2 rounded-lg text-sm text-left transition-colors',
                  ativo
                    ? 'bg-primary-tint text-accent font-semibold before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-r before:bg-accent'
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
              <button
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
                            ? 'bg-primary-tint text-accent font-semibold before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-r before:bg-accent'
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
    </aside>
  );
}
