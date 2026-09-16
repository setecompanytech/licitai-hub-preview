import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { Bell, LogOut, Menu, Search, User } from 'lucide-react';
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
 * AppHeader — o cabeçalho horizontal fixo do sistema (13/09/2026, fim do dia).
 *
 * A navegação mudou de lugar três vezes hoje (topo → coluna → topo). Este é o
 * pedido mais recente do dono do produto e o que vale: uma faixa branca única,
 * 64px no desktop e 56px no celular, com marca à esquerda, dois destinos ao
 * lado dela e a identidade à direita. A coluna navy de 240px saiu junto com o
 * `AppSidebar`, que deixou de ter consumidor.
 *
 * POR QUE só DOIS itens de navegação, e não os oito grupos do menu:
 *
 *   "Painel" é o único destino que merece um clique dedicado — é a raiz, o
 *   lugar para onde se volta. Todo o resto (os oito grupos de `navGroups`, as
 *   56 telas) mora atrás de "Ferramentas", que abre o diretório inteiro.
 *
 *   "Módulos" foi AVALIADO e DESCARTADO. O comando o admitia "somente se
 *   houver navegação distinta e útil já existente", e não há: com Ferramentas
 *   abrindo o diretório completo — que é exatamente a lista de módulos —, um
 *   terceiro item seria um segundo caminho para a MESMA lista. É a navegação
 *   duplicada que o próprio comando proíbe, e a que custou o dia de hoje (duas
 *   trilhas empilhadas, duas lupas). Se um dia existir uma visão de módulo que
 *   o diretório não dá, o item nasce com ela — não antes.
 *
 * Espaço, a lição de `docs/pendencias.md`: a barra do topo anterior tinha OITO
 * rótulos e em 1280px se sobrepunha (a wordmark cobrindo "Painel", "Ferramentas"
 * colidindo com o seletor de empresa). Com dois rótulos o aperto some, mas a
 * disciplina fica: marca e ações com `shrink-0`, rótulos com `whitespace-nowrap`
 * e o miolo com `min-w-0` — nada aqui conta com quebra de texto para caber.
 *
 * A busca é ÚNICA no sistema. Este botão é o MESMO diálogo do Ctrl+K, chamado
 * de outro lugar (evento `praefectus:abrir-busca`), não um segundo índice.
 */

interface AppHeaderProps {
  /** Quantas notificações não lidas — a contagem realtime mora no AppLayout. */
  naoLidas: number;
  /** Abre o painel de notificações (o `NotificationCenter` é do AppLayout). */
  aoAbrirNotificacoes: () => void;
  /**
   * Aviso novo do robô desde a última abertura do painel: o sininho treme e
   * brilha até ser aberto. Quem decide é o AppLayout (`sininhoDeveChamar`).
   */
  sininhoChamando?: boolean;
  /** Abre o modal do perfil (também montado pelo AppLayout). */
  aoAbrirMeuPerfil: () => void;
  /**
   * Abre o menu global de ferramentas.
   *
   * Quem monta o `MenuDeFerramentas` é o AppLayout: o cabeçalho só pede a
   * abertura. Assim este componente não depende do menu para renderizar — e
   * ele pôde ser testado enquanto o menu ainda estava sendo escrito.
   */
  aoAbrirFerramentas: () => void;
  /** Com o menu aberto, o item "Ferramentas" fica aceso e anuncia `expanded`. */
  ferramentasAberto?: boolean;
}

export default function AppHeader({
  naoLidas,
  aoAbrirNotificacoes,
  aoAbrirMeuPerfil,
  aoAbrirFerramentas,
  ferramentasAberto = false,
  sininhoChamando = false,
}: AppHeaderProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { empresaAtiva } = useEmpresa();
  // Só o papel importa aqui: quem filtra rota é o diretório, e o Painel é
  // aberto a toda sessão autenticada (ver a nota adiante).
  const { isAdmin: isEmpresaAdmin } = useMembroPermissoes();
  const avatarUrl = useAvatarUrl();
  const [perfilAberto, setPerfilAberto] = useState(false);
  const perfilRef = useRef<HTMLDivElement>(null);

  /**
   * A marca tem DUAS versões e a escolha é do fundo, não do gosto: a principal
   * (navy + verde) para fundo claro, a de fundo escuro (branca + verde) para o
   * navy. A faixa deixou de ser navy e passou a ser `--card`, que é branco no
   * tema claro e escuro no tema escuro — então a variante acompanha o tema.
   * Fixar "light" apagaria o nome da marca no tema escuro, onde ele ficaria
   * navy sobre navy. `resolvedTheme` chega indefinido no primeiro render; o
   * padrão é a versão principal, que é a do tema padrão do app.
   */
  const { resolvedTheme } = useTheme();
  const varianteDaMarca = resolvedTheme === 'dark' ? 'dark' : 'light';

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

  /**
   * Item de menu que a pessoa não pode abrir não aparece — a mesma regra que a
   * coluna aplicava a todos os seus itens. Aqui só há uma rota no cabeçalho, e
   * ela obedece à mesma autoridade; o diretório filtra o resto por conta dele.
   *
   */
  /**
   * O Painel aparece para TODA sessão autenticada, e não por descuido.
   *
   * `canAccessRoute` nega quando não há linha em `empresa_membros` — o caso de
   * quem acabou de aceitar um convite, de quem ainda não tem empresa ativa, e
   * de qualquer falha transitória na carga do membro. Para as telas de módulo
   * isso é o correto: não anunciar porta que se sabe fechada. Para o Painel,
   * não: ele é a RAIZ, o destino do "voltar ao início", e a rota já o trata
   * como aberto a todos os oito setores (`route-permissions.ts`).
   *
   * Escondê-lo deixaria o cabeçalho com um item só — "Ferramentas" — e sem
   * caminho de volta visível, exatamente para quem está mais perdido. Quem de
   * fato barra a entrada continua sendo o guard da rota; o cabeçalho não é
   * camada de segurança e nunca foi.
   */
  const podeVerPainel = true;
  const painelAtivo = pathname === '/dashboard' || pathname.startsWith('/dashboard/');
  /**
   * "Ferramentas" acende quando a pessoa está DENTRO de alguma função do
   * diretório — sem isso o cabeçalho ficaria sem nenhum item aceso em 55 das
   * 56 telas, o que se lê como navegação quebrada, não como "nada selecionado".
   * Com o menu aberto ele também acende, porque é o que está em foco.
   */
  const ferramentasAtivo = ferramentasAberto || (!painelAtivo && !!funcaoDaRota(pathname));

  const irParaConta = (path: string, hash: string) => {
    setPerfilAberto(false);
    navigate(path + hash);
  };

  const abrirBusca = () => {
    window.dispatchEvent(new CustomEvent('praefectus:abrir-busca'));
  };

  /** Alvo de 44px, foco visível e rótulo que não quebra — vale para os dois. */
  const classeDoItem = (ativo: boolean) =>
    cn(
      'relative flex min-h-[var(--g-linha)] shrink-0 items-center whitespace-nowrap rounded-[var(--g-raio)] px-3 g-corpo font-semibold transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      ativo ? 'text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
    );

  /** O sublinhado verde: discreto, 2px, sempre no DOM para não saltar. */
  const Sublinhado = ({ ativo }: { ativo: boolean }) => (
    <span
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-x-3 bottom-0 h-[2px] rounded-full bg-primary transition-opacity',
        ativo ? 'opacity-100' : 'opacity-0',
      )}
    />
  );

  /** Botão de ícone da direita — 44px de alvo, como manda a régua. */
  const classeDoIcone =
    'flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--g-raio)] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    /**
     * `sticky` e não `fixed` de propósito: o elemento continua no fluxo, então
     * ele RESERVA a própria altura e o conteúdo nunca nasce embaixo dele. Com
     * `fixed` seria preciso repetir a altura como padding no `main` — duas
     * medidas para manter iguais, e a sobreposição volta na primeira que
     * esquecerem de mudar. O comportamento visto é o mesmo: gruda no topo.
     */
    <header className="nao-imprime sticky top-0 z-40 shrink-0 border-b border-border bg-card">
      <div className="mx-auto flex h-[var(--g-topo-celular)] w-full max-w-[var(--g-conteudo)] items-center gap-1 px-4 md:h-[var(--g-topo)] md:gap-2 md:px-8">
        {/* Marca — leva ao painel. Proporção original preservada: só a largura
            é declarada, a altura acompanha (o BrandLogo é `h-auto`). */}
        <Link
          to="/dashboard"
          aria-label="Praefectus — página inicial"
          className="flex shrink-0 items-center rounded-[var(--g-raio)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <BrandLogo variant={varianteDaMarca} mode="full" className="w-[132px] md:w-[152px]" />
        </Link>

        {/* Navegação — só no desktop. No celular ela vira o acionador de menu
            lá na ponta direita: são a MESMA porta em duas larguras, nunca as
            duas na tela ao mesmo tempo. */}
        <nav
          aria-label="Navegação principal"
          className="ml-2 hidden min-w-0 items-center gap-1 md:flex"
        >
          {podeVerPainel && (
            <Link
              to="/dashboard"
              aria-current={painelAtivo ? 'page' : undefined}
              className={classeDoItem(painelAtivo)}
            >
              Painel
              <Sublinhado ativo={painelAtivo} />
            </Link>
          )}

          <button
            type="button"
            onClick={aoAbrirFerramentas}
            // O atalho só existe para quem souber dele; o `title` é onde se sabe.
            title="Todas as ferramentas (Ctrl+Shift+K)"
            aria-haspopup="dialog"
            aria-expanded={ferramentasAberto}
            className={classeDoItem(ferramentasAtivo)}
          >
            Ferramentas
            <Sublinhado ativo={ferramentasAtivo} />
          </button>
        </nav>

        {/* Identidade e ações, à direita. `ml-auto` em vez de `flex-1` no meio:
            o espaço sobrando fica entre a navegação e as ações, não dentro de
            um item que poderia esticar e empurrar a marca. */}
        <div className="ml-auto flex shrink-0 items-center gap-0.5 md:gap-1">
          {/* A ÚNICA busca do sistema. Mesmo diálogo do Ctrl+K. */}
          <button
            type="button"
            onClick={abrirBusca}
            aria-label="Buscar no sistema"
            title="Buscar no sistema (Ctrl+K)"
            className={cn(
              classeDoIcone,
              // A partir de lg vira campo com rótulo: em monitor grande sobra
              // espaço, e a lupa sozinha esconde que existe busca no sistema.
              'lg:w-auto lg:gap-2 lg:border lg:border-border lg:bg-muted/40 lg:px-3',
            )}
          >
            <Search aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
            <span className="g-corpo hidden whitespace-nowrap lg:inline">Buscar no sistema...</span>
            <kbd className="g-meta hidden shrink-0 rounded border border-border px-1.5 py-0.5 font-sans lg:inline">
              ⌘K
            </kbd>
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
            // Só com movimento permitido (motion-safe): quem desliga animação
            // no sistema continua vendo o contador, sem o balanço.
            className={cn(classeDoIcone, 'relative', sininhoChamando && 'motion-safe:animate-pulse-glow')}
          >
            <Bell
              aria-hidden="true"
              className={cn('h-[18px] w-[18px]', sininhoChamando && 'origin-top motion-safe:animate-sininho-tremer')}
            />
            {naoLidas > 0 && (
              <span
                aria-hidden="true"
                className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground"
              >
                {naoLidas > 99 ? '99+' : naoLidas}
              </span>
            )}
          </button>

          <div className="hidden sm:block">
            <ThemeToggle />
          </div>

          <span aria-hidden="true" className="mx-1 hidden h-6 w-px bg-border lg:block" />

          {/* Seletor de empresa — a troca e a atualização contextual são dele. */}
          <div className="hidden lg:block">
            <EmpresaSelector />
          </div>

          {/* Perfil */}
          <div className="relative shrink-0" ref={perfilRef}>
            <button
              type="button"
              onClick={() => setPerfilAberto((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={perfilAberto}
              aria-label="Minha conta"
              title="Minha conta"
              className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-bold text-foreground ring-1 ring-border transition-all hover:ring-2 hover:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                className="animate-fade-in absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[300px] overflow-hidden rounded-xl border border-border bg-card shadow-xl"
              >
                <div className="border-b border-border px-5 pb-3 pt-5 text-center">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-muted text-xl font-bold text-foreground">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      iniciais
                    )}
                  </div>
                  <p className="truncate text-sm font-semibold text-foreground">{nomeDaPessoa}</p>
                  <p className="truncate text-xs text-muted-foreground">{emailDaPessoa}</p>
                  {empresaAtiva && (
                    <p className="mt-1 truncate text-xs text-accent">
                      {empresaAtiva.nome_fantasia || empresaAtiva.razao_social}
                    </p>
                  )}
                </div>

                <div className="max-h-[min(60vh,420px)] overflow-y-auto py-1.5">
                  {/* Meu Perfil — acima de tudo */}
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-3 px-5 py-2 text-left text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
                    onClick={() => {
                      setPerfilAberto(false);
                      aoAbrirMeuPerfil();
                    }}
                  >
                    <User className="h-4 w-4 shrink-0 text-primary" />
                    <span>Meu Perfil</span>
                  </button>
                  <div className="mx-4 my-1 border-t border-border" />
                  {secoesDaConta.map(({ secao, itens }) => (
                    <div key={secao}>
                      <p className="px-5 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        {secao}
                      </p>
                      {itens.map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          role="menuitem"
                          className="flex w-full items-center gap-3 px-5 py-2 text-left text-[13px] text-foreground transition-colors hover:bg-muted"
                          onClick={() => irParaConta(item.path, item.hash ?? '')}
                        >
                          <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  ))}
                  <ExportarDados variant="menu-item" />
                </div>

                <div className="flex justify-center border-t border-border p-2.5">
                  <button
                    type="button"
                    role="menuitem"
                    className="flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] text-destructive transition-colors hover:bg-destructive/5"
                    onClick={() => {
                      setPerfilAberto(false);
                      signOut();
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Sair da conta</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Acionador do menu no celular — abre o MESMO diretório que o item
              "Ferramentas" abre no desktop. Um por largura, nunca os dois. */}
          <button
            type="button"
            onClick={aoAbrirFerramentas}
            // O atalho só existe para quem souber dele; o `title` é onde se sabe.
            title="Todas as ferramentas (Ctrl+Shift+K)"
            aria-haspopup="dialog"
            aria-expanded={ferramentasAberto}
            aria-label="Abrir menu"
            className={cn(classeDoIcone, 'md:hidden')}
          >
            <Menu aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
