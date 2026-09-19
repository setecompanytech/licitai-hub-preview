import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, LayoutGrid, LogOut, Menu, Search, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import BrandLogo from '@/components/shared/BrandLogo';
import EmpresaSelector from '@/components/empresa/EmpresaSelector';
import ThemeToggle from '@/components/theme/ThemeToggle';
import ExportarDados from '@/components/export/ExportarDados';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useAvatarUrl } from '@/hooks/useAvatarPerfil';
import { useMembroPermissoes } from '@/hooks/useMembroPermissoes';
import { menuDaConta, type ItemDaConta } from '@/lib/navegacao/menu';
import { funcaoDaRota } from '@/lib/navegacao/registro';

/**
 * AppHeader — a topbar branca do Design System v3 (19/09/2026).
 *
 * 60px no desktop, 56px no celular. A NAVEGAÇÃO mora na `AppSidebar`; a barra
 * responde ao resto: onde estou (o nome do módulo), o que procuro (a busca
 * única, Ctrl+K), e quem sou (avisos, tema, empresa ativa, conta).
 *
 * No celular a barra ganha o acionador da gaveta de navegação e a marca; no
 * desktop a marca fica na coluna. A busca é UMA só no sistema: este botão é o
 * MESMO diálogo do Ctrl+K, chamado pelo evento `praefectus:abrir-busca`.
 */
interface AppHeaderProps {
  /** Quantas notificações não lidas — a contagem realtime mora no AppLayout. */
  naoLidas: number;
  /** Abre o painel de notificações (o `NotificationCenter` é do AppLayout). */
  aoAbrirNotificacoes: () => void;
  /** Aviso novo do robô desde a última abertura do painel: o sininho treme. */
  sininhoChamando?: boolean;
  /** Abre o modal do perfil (também montado pelo AppLayout). */
  aoAbrirMeuPerfil: () => void;
  /** Abre o diretório "Todas as ferramentas" (montado pelo AppLayout). */
  aoAbrirFerramentas: () => void;
  /** Com o diretório aberto, o botão anuncia `expanded`. */
  ferramentasAberto?: boolean;
  /** Abre a gaveta de navegação do celular. */
  aoAbrirMenuMovel?: () => void;
}

export default function AppHeader({
  naoLidas,
  aoAbrirNotificacoes,
  aoAbrirMeuPerfil,
  aoAbrirFerramentas,
  ferramentasAberto = false,
  sininhoChamando = false,
  aoAbrirMenuMovel,
}: AppHeaderProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const { isAdmin: isEmpresaAdmin } = useMembroPermissoes();
  const avatarUrl = useAvatarUrl();
  const [perfilAberto, setPerfilAberto] = useState(false);
  const perfilRef = useRef<HTMLDivElement>(null);

  // O menu da conta vem de menu.ts (mesma fonte do diretório) e chega agrupado
  // por seção: "Conta", "Empresa", "Preferências", "Plataforma".
  const secoesDaConta = menuDaConta
    .filter((i) => !i.adminOnly || isEmpresaAdmin)
    .reduce<{ secao: ItemDaConta['secao']; itens: ItemDaConta[] }[]>((acc, item) => {
      const atual = acc[acc.length - 1];
      if (atual && atual.secao === item.secao) atual.itens.push(item);
      else acc.push({ secao: item.secao, itens: [item] });
      return acc;
    }, []);

  const nomeDaPessoa =
    user?.user_metadata?.nome_completo || empresaAtiva?.razao_social || user?.email || '';
  const emailDaPessoa = user?.email || '';
  const iniciais = nomeDaPessoa
    ? nomeDaPessoa.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
    : emailDaPessoa.slice(0, 2).toUpperCase();

  useEffect(() => {
    const fora = (e: MouseEvent) => {
      if (perfilRef.current && !perfilRef.current.contains(e.target as Node)) {
        setPerfilAberto(false);
      }
    };
    if (perfilAberto) document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [perfilAberto]);

  const painelAtivo = pathname === '/dashboard' || pathname.startsWith('/dashboard/');
  const funcao = funcaoDaRota(pathname);
  const nomeDoModulo = painelAtivo ? 'Painel da empresa' : funcao?.nomeCompleto ?? 'Praefectus';

  const irParaConta = (path: string, hash: string) => {
    setPerfilAberto(false);
    navigate(path + hash);
  };

  const abrirBusca = () => {
    window.dispatchEvent(new CustomEvent('praefectus:abrir-busca'));
  };

  /** Botão de ícone da barra: 36px, foco visível, hover na superfície rebaixada. */
  const classeDoIcone =
    'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    /**
     * `sticky` e não `fixed`: o elemento reserva a própria altura e o conteúdo
     * nunca nasce embaixo dele.
     */
    <header className="nao-imprime sticky top-0 z-40 shrink-0 border-b border-border bg-card">
      <div className="flex h-[var(--g-topo-celular)] w-full items-center gap-2 px-3 md:h-[var(--g-topo)] md:px-6">
        {/* Celular: a gaveta de navegação e a marca. */}
        <button
          type="button"
          onClick={aoAbrirMenuMovel}
          aria-label="Abrir menu"
          title="Menu"
          className={cn(classeDoIcone, 'md:hidden')}
        >
          <Menu aria-hidden="true" className="h-5 w-5" />
        </button>
        <Link
          to="/dashboard"
          aria-label="Praefectus — página inicial"
          className="flex shrink-0 items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
        >
          <BrandLogo variant="light" mode="full" className="w-[120px]" />
        </Link>

        {/* Desktop: onde a pessoa está. */}
        <div className="hidden min-w-0 flex-1 items-center gap-3 md:flex">
          <p className="truncate text-sm font-semibold text-foreground">{nomeDoModulo}</p>
          {!painelAtivo && funcao?.descricao && (
            <p className="hidden min-w-0 truncate text-xs text-muted-foreground xl:block">{funcao.descricao}</p>
          )}
        </div>

        {/* Identidade e ações, à direita */}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {/* A busca única: campo no desktop largo, ícone abaixo disso. */}
          <button
            type="button"
            onClick={abrirBusca}
            aria-label="Buscar no sistema"
            title="Buscar no sistema (Ctrl+K)"
            className={cn(
              classeDoIcone,
              'lg:w-[280px] lg:justify-start lg:gap-2 lg:border lg:border-border lg:bg-background lg:px-3 lg:hover:border-foreground-tertiary lg:hover:bg-muted/60',
            )}
          >
            <Search aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span className="hidden min-w-0 flex-1 truncate text-left text-sm lg:inline">Buscar no sistema…</span>
            <kbd className="hidden rounded border border-border bg-card px-1.5 py-0.5 font-sans text-[10px] font-medium leading-none text-muted-foreground lg:inline">
              Ctrl K
            </kbd>
          </button>

          <button
            type="button"
            onClick={aoAbrirFerramentas}
            title="Todas as ferramentas (Ctrl+Shift+K)"
            aria-label="Todas as ferramentas"
            aria-haspopup="dialog"
            aria-expanded={ferramentasAberto}
            className={cn(classeDoIcone, 'hidden md:flex', ferramentasAberto && 'bg-muted text-foreground')}
          >
            <LayoutGrid aria-hidden="true" className="h-[18px] w-[18px]" />
          </button>

          <button
            type="button"
            onClick={aoAbrirNotificacoes}
            aria-label={
              (naoLidas > 0 ? `Notificações — ${naoLidas} não lidas` : 'Notificações') +
              (sininhoChamando ? ' — aviso novo do robô' : '')
            }
            title={sininhoChamando ? 'Aviso novo do robô' : 'Notificações'}
            data-chamando={sininhoChamando || undefined}
            className={cn(classeDoIcone, sininhoChamando && 'motion-safe:animate-pulse-glow')}
          >
            <Bell
              aria-hidden="true"
              className={cn('h-[18px] w-[18px]', sininhoChamando && 'origin-top motion-safe:animate-sininho-tremer')}
            />
            {naoLidas > 0 && (
              <b
                aria-hidden="true"
                className="pointer-events-none absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground"
              >
                {naoLidas > 99 ? '99+' : naoLidas}
              </b>
            )}
          </button>

          <div className="hidden sm:block">
            <ThemeToggle />
          </div>

          <span aria-hidden="true" className="mx-1.5 hidden h-6 w-px bg-border md:block" />

          {/* Empresa ativa: contexto, não ação — por isso depois da divisória. */}
          <div className="hidden md:block">
            <EmpresaSelector />
          </div>

          {/* Conta */}
          <div className="relative ml-1 shrink-0" ref={perfilRef}>
            <button
              type="button"
              onClick={() => setPerfilAberto((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={perfilAberto}
              aria-label="Minha conta"
              title="Minha conta"
              className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-border bg-navy-tint text-xs font-semibold text-navy transition-shadow hover:ring-2 hover:ring-ring/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                iniciais
              )}
            </button>

            {perfilAberto && (
              <div
                role="menu"
                aria-label="Menu da conta"
                className="animate-fade-in absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[288px] overflow-hidden rounded-xl border border-border bg-card shadow-xl"
              >
                <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-navy-tint text-sm font-semibold text-navy">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      iniciais
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{nomeDaPessoa}</p>
                    <p className="truncate text-xs text-muted-foreground">{emailDaPessoa}</p>
                    {empresaAtiva && (
                      <p className="truncate text-xs font-medium text-primary">
                        {empresaAtiva.nome_fantasia || empresaAtiva.razao_social}
                      </p>
                    )}
                  </div>
                </div>

                <div className="max-h-[min(60vh,420px)] overflow-y-auto py-1.5">
                  <button
                    type="button"
                    role="menuitem"
                    className="flex min-h-9 w-full items-center gap-3 px-4 py-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted"
                    onClick={() => {
                      setPerfilAberto(false);
                      aoAbrirMeuPerfil();
                    }}
                  >
                    <User className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    <span>Meu Perfil</span>
                  </button>
                  <div className="mx-4 my-1 border-t border-border" />
                  {secoesDaConta.map(({ secao, itens }) => (
                    <div key={secao}>
                      <p className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {secao}
                      </p>
                      {itens.map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          role="menuitem"
                          className="flex min-h-9 w-full items-center gap-3 px-4 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
                          onClick={() => irParaConta(item.path, item.hash ?? '')}
                        >
                          <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  ))}
                  <ExportarDados variant="menu-item" />
                </div>

                <div className="border-t border-border p-1.5">
                  <button
                    type="button"
                    role="menuitem"
                    className="flex min-h-9 w-full items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium text-destructive-ink transition-colors hover:bg-destructive-tint"
                    onClick={() => {
                      setPerfilAberto(false);
                      signOut();
                    }}
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    <span>Sair da conta</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
