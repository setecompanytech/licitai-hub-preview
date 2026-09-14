import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, LayoutGrid, Search, Star, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMembroPermissoes } from '@/hooks/useMembroPermissoes';
import { usePreferenciasDeNavegacao } from '@/hooks/usePreferenciasDeNavegacao';
import {
  buscarFuncoes,
  categoriasDoSistema,
  funcaoDaRota,
  funcoesDoSistema,
  type FuncaoDoSistema,
} from '@/lib/navegacao/registro';

/**
 * "Todas as ferramentas" — o mapa inteiro do sistema numa sobreposição.
 *
 * A coluna da esquerda responde "para onde eu vou AGORA": abre um grupo por vez
 * e esconde os outros, o que é certo para o trabalho do dia e errado para quem
 * ainda não sabe o que o sistema tem. Este painel responde a outra pergunta —
 * "o que existe aqui?" — e por isso mostra tudo de uma vez, em quatro colunas,
 * com busca, recentes e favoritos.
 *
 * Nada aqui tem lista própria: nome, ícone, categoria e rota vêm de
 * `lib/navegacao/registro`, que compõe `menu.ts` e `paginas.ts`. Seria a quinta
 * lista paralela, e o registro existe justamente para não deixá-la nascer.
 *
 * ── SOBRE O ATALHO, porque a decisão tem consequência ─────────────────────
 *
 * O comando pedia Ctrl+K. Ctrl+K já é de `GlobalSearch`, que está montado em
 * TODA tela interna (`AppLayout`), tem placa visível na coluna ("⌘K"), é o
 * destino do evento `praefectus:abrir-busca` — com teste travando isso em
 * `AppHeader.test.tsx` — e indexa coisas que este painel não tem nem deve ter:
 * treze ações rápidas com parâmetro de URL (`?new=1`, `/financeiro/importar_ofx`),
 * o catálogo de identidade visual vindo do banco e os módulos internos do
 * Financeiro. Tomar a tecla exigiria ou apagar aquela busca — perdendo três
 * índices que este registro não cobre — ou deixar duas sobreposições
 * disputando o mesmo gesto, que é exatamente o conflito a evitar.
 *
 * Então Ctrl+K continua sendo a BUSCA (achar UMA coisa) e este painel abre em
 * Ctrl/⌘ + Shift + K (ver TODAS as coisas). Com Shift pressionado o navegador
 * entrega `e.key === 'K'` maiúsculo e a comparação de `GlobalSearch` é contra o
 * 'k' minúsculo — os dois não disparam juntos. Se algum dia aquele arquivo
 * passar a normalizar a caixa, precisará excluir `shiftKey` explicitamente.
 *
 * O painel também atende ao evento `praefectus:abrir-ferramentas`, no mesmo
 * molde do `praefectus:abrir-busca` que a coluna já usa: assim qualquer ponto
 * do app o abre sem precisar de referência ao componente.
 */

/**
 * A distribuição de colunas que o comando pediu, escrita contra as categorias
 * REAIS do registro — as oito que saem de `menu.ts` mais "Configuração", que é
 * o menu da conta colapsado num grupo só.
 *
 * "Admin" não constava da lista do comando (que o trata como grupo à parte, e
 * de fato só o operador do SaaS o enxerga). Fica no fim da quarta coluna: para
 * todo o resto das pessoas as colunas ficam equilibradas, e o desequilíbrio só
 * existe na tela de quem administra a plataforma.
 */
const COLUNAS: string[][] = [
  ['Inteligência', 'Monitoramento'],
  ['Gestão de Processos'],
  ['Jurídico & Contábil', 'Ferramentas'],
  ['Configuração', 'Financeiro', 'Comunicação', 'Admin'],
];

/**
 * Categoria nova em `menu.ts` não pode sumir do diretório só porque ninguém
 * lembrou de voltar aqui — é o defeito silencioso que o registro único combate.
 * O que não estiver distribuído acima entra na última coluna.
 */
function colunasCompletas(): string[][] {
  const distribuidas = new Set(COLUNAS.flat());
  const orfas = categoriasDoSistema.filter((c) => !distribuidas.has(c));
  if (orfas.length === 0) return COLUNAS;
  return COLUNAS.map((col, i) => (i === COLUNAS.length - 1 ? [...col, ...orfas] : col));
}

const FOCAVEIS =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

interface ItemProps {
  f: FuncaoDoSistema;
  ativo: boolean;
  favorito: boolean;
  /** Sob busca, o nome sozinho não diz de onde a ferramenta veio. */
  mostrarCategoria?: boolean;
  aoEscolher: (f: FuncaoDoSistema) => void;
  aoFavoritar: (id: string) => void;
}

/**
 * Um item do diretório. Mora fora do componente de propósito: declarado dentro,
 * seria um TIPO novo a cada tecla digitada na busca, e o React desmontaria e
 * remontaria a lista inteira em vez de atualizá-la.
 */
function ItemDeFerramenta({
  f,
  ativo,
  favorito,
  mostrarCategoria = false,
  aoEscolher,
  aoFavoritar,
}: ItemProps) {
  return (
    <li className="relative">
      <Link
        to={f.rota}
        onClick={() => aoEscolher(f)}
        aria-current={ativo ? 'page' : undefined}
        className={cn(
          'flex min-h-[var(--g-linha)] items-center gap-2.5 rounded-lg py-2 pl-3 pr-10 transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
          ativo ? 'bg-muted font-semibold text-foreground' : 'text-foreground/90 hover:bg-muted/60',
        )}
      >
        {/* O marcador verde da função atual. Fundo cinza sozinho é fraco demais
            para distinguir uma linha num diretório de quarenta e poucas. */}
        {ativo && (
          <span
            aria-hidden="true"
            className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r bg-primary"
          />
        )}
        <f.icone aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1">
          <span className="g-corpo block truncate">{f.nome}</span>
          {mostrarCategoria && (
            <span className="g-meta block truncate text-muted-foreground">{f.categoria}</span>
          )}
        </span>
      </Link>

      {/* Fora do `Link`, não dentro: âncora dentro de âncora é HTML inválido, e
          um `stopPropagation` resolveria o clique mas não o leitor de tela, que
          anunciaria um link só. */}
      <button
        type="button"
        onClick={() => aoFavoritar(f.id)}
        aria-pressed={favorito}
        aria-label={
          favorito ? `Remover ${f.nome} dos favoritos` : `Adicionar ${f.nome} aos favoritos`
        }
        className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Star aria-hidden="true" className={cn('h-4 w-4', favorito && 'fill-primary text-primary')} />
      </button>
    </li>
  );
}

interface FaixaProps {
  titulo: string;
  funcoes: FuncaoDoSistema[];
  vazio: string;
  aoEscolher: (f: FuncaoDoSistema) => void;
}

/** Recentes e Favoritos — atalhos em pastilha, sem estrela e sem hierarquia. */
function Faixa({ titulo, funcoes, vazio, aoEscolher }: FaixaProps) {
  return (
    <section aria-label={titulo} className="min-w-0">
      <h3 className="g-meta mb-2 font-bold uppercase tracking-wider text-muted-foreground">
        {titulo}
      </h3>
      {funcoes.length === 0 ? (
        <p className="g-corpo text-muted-foreground">{vazio}</p>
      ) : (
        // `flex-wrap` e não uma linha rolável: no celular a lista quebra em duas
        // ou três linhas e continua inteira na tela, sem gesto escondido.
        <ul className="flex flex-wrap gap-2">
          {funcoes.map((f) => (
            <li key={f.id}>
              <Link
                to={f.rota}
                onClick={() => aoEscolher(f)}
                className="flex min-h-[var(--g-linha)] items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 transition-colors hover:border-primary/40 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <f.icone aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="g-corpo truncate">{f.nome}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface MenuDeFerramentasProps {
  /**
   * Controle externo. O `AppHeader` tem o item "Ferramentas" da faixa e manda
   * abrir daqui; quando esta prop vem, o componente NÃO desenha acionador
   * próprio — dois botões para o mesmo painel na mesma tela foi a duplicidade
   * que o dono do produto mandou remover da lupa.
   */
  aberto?: boolean;
  aoFechar?: () => void;
  /** Só vale sem controle externo, no acionador que o componente traz. */
  className?: string;
}

export default function MenuDeFerramentas({
  aberto: abertoExterno,
  aoFechar,
  className,
}: MenuDeFerramentasProps) {
  const location = useLocation();
  const { canAccessRoute, isAdmin } = useMembroPermissoes();
  const { recentes, favoritos, alternarFavorito, registrarAcesso, ehFavorito } =
    usePreferenciasDeNavegacao();

  /**
   * Duas origens de abertura, somadas em vez de uma sobrepor a outra: o botão
   * do cabeçalho (estado do pai) e o atalho de teclado / evento global (estado
   * daqui). Se o controle externo simplesmente vencesse, o Ctrl+Shift+K não
   * conseguiria abrir nada — o componente não tem como escrever no estado do
   * pai, e o atalho ficaria morto justamente onde o painel está montado.
   */
  const [abertoInterno, setAbertoInterno] = useState(false);
  const controlado = abertoExterno !== undefined;
  const aberto = !!abertoExterno || abertoInterno;

  const [termo, setTermo] = useState('');
  const [soFavoritos, setSoFavoritos] = useState(false);
  const [recolhidas, setRecolhidas] = useState<Record<string, boolean>>({});

  const painelRef = useRef<HTMLDivElement>(null);
  const buscaRef = useRef<HTMLInputElement>(null);
  const gatilhoRef = useRef<HTMLButtonElement>(null);
  /**
   * Quem tinha o foco quando o painel abriu. Não basta guardar o botão desta
   * instância: o painel também abre por atalho e por evento, e nesses casos o
   * foco estava em outro lugar — devolvê-lo ao botão teleportaria a pessoa.
   */
  const acionadorRef = useRef<HTMLElement | null>(null);

  const abrir = () => {
    acionadorRef.current = (document.activeElement as HTMLElement) ?? gatilhoRef.current;
    setAbertoInterno(true);
  };

  /**
   * `devolverFoco` é falso quando o fechamento veio de uma navegação: dali em
   * diante quem manda no foco é a tela de destino, e puxá-lo de volta para o
   * cabeçalho faria o leitor de tela anunciar o botão em vez da página aberta.
   */
  const fechar = (devolverFoco = true) => {
    setAbertoInterno(false);
    aoFechar?.();
    setTermo('');
    if (devolverFoco) acionadorRef.current?.focus();
    acionadorRef.current = null;
  };

  // Abertura por atalho e por evento — ver a nota sobre Ctrl+K no topo.
  useEffect(() => {
    const registrarAcionador = () => {
      acionadorRef.current = (document.activeElement as HTMLElement) ?? null;
      setAbertoInterno(true);
    };
    const porTecla = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && e.shiftKey && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        registrarAcionador();
      }
    };
    document.addEventListener('keydown', porTecla);
    window.addEventListener('praefectus:abrir-ferramentas', registrarAcionador);
    return () => {
      document.removeEventListener('keydown', porTecla);
      window.removeEventListener('praefectus:abrir-ferramentas', registrarAcionador);
    };
  }, []);

  // Escape fecha, e o Tab não escapa da sobreposição. Painel que cobre a tela
  // sem prender o foco manda o teclado passear pela página de baixo, que está
  // visualmente escondida — a pessoa perde o cursor e não sabe onde ele foi.
  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        fechar();
        return;
      }
      if (e.key !== 'Tab') return;
      const alvos = painelRef.current?.querySelectorAll<HTMLElement>(FOCAVEIS);
      if (!alvos || alvos.length === 0) return;
      const primeiro = alvos[0];
      const ultimo = alvos[alvos.length - 1];
      const ativo = document.activeElement;
      const dentro = !!ativo && !!painelRef.current?.contains(ativo);
      if (e.shiftKey && (ativo === primeiro || !dentro)) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && (ativo === ultimo || !dentro)) {
        e.preventDefault();
        primeiro.focus();
      }
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
    // `fechar` nasce de novo a cada render e não guarda estado; incluí-la aqui
    // só religaria o ouvinte à toa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  // A página não rola atrás do painel: com altura máxima e rolagem interna, duas
  // barras de rolagem competem e a roda do mouse move a errada.
  useEffect(() => {
    if (!aberto) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = anterior;
    };
  }, [aberto]);

  // Abrir e já poder digitar — é o que o comando pede do atalho, e vale também
  // para quem chegou pelo botão.
  //
  // O acionador é anotado AQUI quando o painel foi aberto pelo pai (o item
  // "Ferramentas" do cabeçalho): naquele caminho nenhuma função deste arquivo
  // roda antes, e o efeito ainda encontra o botão com o foco, porque o React o
  // executa logo depois do commit e antes de o navegador mover coisa alguma.
  useEffect(() => {
    if (!aberto) return;
    if (!acionadorRef.current) acionadorRef.current = document.activeElement as HTMLElement;
    buscaRef.current?.focus();
  }, [aberto]);

  // No celular o diretório inteiro aberto são quarenta e poucas linhas numa
  // coluna só; ali as categorias começam fechadas, menos a da tela atual.
  useEffect(() => {
    if (!aberto) return;
    const estreito =
      typeof window !== 'undefined' && !!window.matchMedia?.('(max-width: 767px)').matches;
    if (!estreito) {
      setRecolhidas({});
      return;
    }
    const atual = funcaoDaRota(location.pathname)?.categoria;
    setRecolhidas(Object.fromEntries(categoriasDoSistema.map((c) => [c, c !== atual])));
  }, [aberto, location.pathname]);

  /**
   * O filtro de autorização roda a cada render de propósito: `canAccessRoute`
   * nasce de novo a cada render do hook de permissões, então memorizá-lo exigiria
   * uma dependência que muda sempre — o custo do memo sem o benefício. São
   * quarenta e poucos itens.
   */
  const permitida = (f: FuncaoDoSistema) =>
    (!f.adminOnly || isAdmin) && canAccessRoute(f.rota.split('?')[0]);

  const autorizadas = funcoesDoSistema.filter(permitida);
  const buscando = termo.trim().length > 0;
  const resultados = buscarFuncoes(autorizadas, termo);

  const porId = new Map(autorizadas.map((f) => [f.id, f]));
  // Os recentes já chegam do hook sem repetição e no limite de cinco; aqui só se
  // descarta o que a pessoa deixou de poder abrir (mudou de setor, trocou de
  // empresa) — senão a lista ofereceria porta fechada.
  const funcoesRecentes = recentes
    .map((id) => porId.get(id))
    .filter((f): f is FuncaoDoSistema => !!f);
  const funcoesFavoritas = favoritos
    .map((id) => porId.get(id))
    .filter((f): f is FuncaoDoSistema => !!f);

  const atual = funcaoDaRota(location.pathname);

  const escolher = (f: FuncaoDoSistema) => {
    registrarAcesso(f.id);
    fechar(false);
  };

  return (
    <>
      {/* Sem controle externo o componente traz o próprio acionador — é o que
          o mantém utilizável fora do `AppLayout` e testável sem um cabeçalho
          inteiro em volta. Com `aberto` vindo do pai, quem desenha o botão é o
          `AppHeader`, e desenhar outro aqui duplicaria o gesto na mesma faixa. */}
      {!controlado && (
        <button
          ref={gatilhoRef}
          type="button"
          onClick={abrir}
          aria-haspopup="dialog"
          aria-expanded={aberto}
          aria-label="Todas as ferramentas"
          title="Todas as ferramentas (Ctrl+Shift+K)"
          className={cn(
            'flex min-h-[var(--g-linha)] items-center gap-2 rounded-lg px-2.5 text-muted-foreground transition-colors',
            'hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            className,
          )}
        >
          <LayoutGrid aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
          <span className="g-corpo hidden xl:inline">Todas as ferramentas</span>
        </button>
      )}

      {aberto && (
        <>
          {/* Escurecimento discreto. Fica abaixo do painel no empilhamento e
              acima de todo o resto — inclusive do cabeçalho, que é z-40. */}
          <div
            data-testid="menu-ferramentas-fundo"
            aria-hidden="true"
            onClick={() => fechar()}
            className="nao-imprime fixed inset-0 z-50 bg-foreground/20"
          />

          <div
            ref={painelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Todas as ferramentas"
            className={cn(
              'nao-imprime fixed inset-x-0 top-0 z-50 flex h-[100dvh] flex-col overflow-hidden bg-card',
              // Acima de 768px o painel desce para debaixo do cabeçalho de 64px,
              // ganha 16px de margem lateral e deixa de ocupar a tela toda. A
              // altura máxima só vale aqui: no celular ele é a tela inteira.
              'md:inset-x-4 md:top-[var(--g-topo)] md:h-auto md:max-h-[calc(100dvh_-_80px)] md:rounded-xl md:border md:border-border md:shadow-xl',
            )}
          >
            {/* Cabeçalho do painel — fixo no topo, que é o que mantém a busca
                alcançável no celular enquanto o diretório rola por baixo. */}
            <div className="sticky top-0 z-10 shrink-0 border-b border-border bg-card px-4 py-3 md:px-6 md:py-4">
              <div className="flex items-center gap-3">
                <h2 className="g-titulo-secao min-w-0 flex-1 truncate text-foreground">
                  Todas as ferramentas
                </h2>
                <button
                  type="button"
                  onClick={() => fechar()}
                  aria-label="Fechar todas as ferramentas"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X aria-hidden="true" className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative min-w-0 flex-1">
                  <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  />
                  <input
                    ref={buscaRef}
                    type="search"
                    value={termo}
                    onChange={(e) => setTermo(e.target.value)}
                    aria-label="Buscar ferramenta"
                    placeholder="Buscar ferramenta por nome ou categoria..."
                    className="g-controle w-full rounded-lg border border-input bg-background pl-9 pr-3 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setSoFavoritos((v) => !v)}
                  aria-pressed={soFavoritos}
                  className={cn(
                    'flex min-h-[var(--g-linha)] shrink-0 items-center justify-center gap-2 rounded-lg border px-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    soFavoritos
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted',
                  )}
                >
                  <Star aria-hidden="true" className={cn('h-4 w-4', soFavoritos && 'fill-primary')} />
                  <span className="g-corpo">Só favoritos</span>
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5">
              {buscando ? (
                /* Buscando, o diretório dá lugar a uma lista única — categoria
                   recolhida não esconde resultado: o recolhimento organiza o
                   diretório, não o que a busca achou. */
                resultados.length === 0 ? (
                  <div className="py-10 text-center">
                    <p className="g-corpo text-muted-foreground">Nenhuma ferramenta encontrada.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setTermo('');
                        buscaRef.current?.focus();
                      }}
                      className="g-corpo mt-3 inline-flex min-h-[var(--g-linha)] items-center rounded-lg border border-border px-4 text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Limpar busca
                    </button>
                  </div>
                ) : (
                  <section aria-label="Resultados da busca">
                    <h3 className="g-meta mb-2 font-bold uppercase tracking-wider text-muted-foreground">
                      {resultados.length} resultado{resultados.length > 1 ? 's' : ''}
                    </h3>
                    <ul className="grid gap-1 md:grid-cols-2 min-[1200px]:grid-cols-4">
                      {resultados.map((f) => (
                        <ItemDeFerramenta
                          key={f.id}
                          f={f}
                          ativo={atual?.id === f.id}
                          favorito={ehFavorito(f.id)}
                          mostrarCategoria
                          aoEscolher={escolher}
                          aoFavoritar={alternarFavorito}
                        />
                      ))}
                    </ul>
                  </section>
                )
              ) : (
                <>
                  <div className="mb-5 grid gap-5 md:grid-cols-2">
                    <Faixa
                      titulo="Recentes"
                      funcoes={funcoesRecentes}
                      vazio="Nada aberto ainda — o que você usar aparece aqui."
                      aoEscolher={escolher}
                    />
                    <Faixa
                      titulo="Favoritos"
                      funcoes={funcoesFavoritas}
                      vazio="Nenhum favorito. Use a estrela ao lado de uma ferramenta."
                      aoEscolher={escolher}
                    />
                  </div>

                  <div className="grid gap-x-6 gap-y-5 border-t border-border pt-5 md:grid-cols-2 min-[1200px]:grid-cols-4">
                    {colunasCompletas().map((categorias, i) => (
                      <div key={i} className="min-w-0">
                        {categorias.map((categoria) => {
                          const itens = autorizadas.filter(
                            (f) => f.categoria === categoria && (!soFavoritos || ehFavorito(f.id)),
                          );
                          // Categoria cujas rotas a pessoa não pode abrir some
                          // inteira — o comando proíbe reservar espaço para o
                          // que está indisponível.
                          if (itens.length === 0) return null;
                          const recolhida = recolhidas[categoria] ?? false;
                          return (
                            <section key={categoria} className="mb-5 last:mb-0">
                              <h3>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setRecolhidas((r) => ({ ...r, [categoria]: !recolhida }))
                                  }
                                  aria-expanded={!recolhida}
                                  className="flex min-h-[var(--g-linha)] w-full items-center gap-2 rounded-lg px-1 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                  <span className="g-meta min-w-0 flex-1 truncate font-bold uppercase tracking-wider text-muted-foreground">
                                    {categoria}
                                  </span>
                                  <ChevronDown
                                    aria-hidden="true"
                                    className={cn(
                                      'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                                      recolhida && '-rotate-90',
                                    )}
                                  />
                                </button>
                              </h3>
                              <ul className={cn('mt-1 flex flex-col', recolhida && 'hidden')}>
                                {itens.map((f) => (
                                  <ItemDeFerramenta
                                    key={f.id}
                                    f={f}
                                    ativo={atual?.id === f.id}
                                    favorito={ehFavorito(f.id)}
                                    aoEscolher={escolher}
                                    aoFavoritar={alternarFavorito}
                                  />
                                ))}
                              </ul>
                            </section>
                          );
                        })}
                      </div>
                    ))}
                  </div>

                  {soFavoritos && funcoesFavoritas.length === 0 && (
                    <p className="g-corpo py-8 text-center text-muted-foreground">
                      Nenhum favorito ainda. Desligue &ldquo;Só favoritos&rdquo; para ver o
                      diretório completo.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
