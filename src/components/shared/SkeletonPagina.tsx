import BrandLogo from '@/components/shared/BrandLogo';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Esqueleto de página inteira — o `#skeletonTemplate` do protótipo
 * (index.html:3320-3332): título, uma fileira de cartões e o bloco grande.
 *
 * Serve de espera para rota que ainda está baixando o pedaço de código dela.
 * Antes era um spinner centralizado com "Carregando módulo...": um ponto
 * girando no meio do vazio não diz o que vem, e a página dava um salto quando
 * o conteúdo real aparecia. O esqueleto reserva o espaço na forma certa, então
 * a chegada do conteúdo é uma troca, não um pulo.
 *
 * `role="status"` + `aria-busy` no contêiner, e cada bloco com `aria-hidden`
 * (padrão do `Skeleton`): quem usa leitor de tela ouve "Carregando" uma vez,
 * em vez de uma lista de retângulos.
 */

/** O corpo do esqueleto, sem moldura. Usado dentro de telas que JÁ estão
 *  desenhadas pelo `AppLayout` — repetir a barra ali daria duas barras. */
export function SkeletonCorpo({ cartoes = 4 }: { cartoes?: number }) {
  return (
    <>
      <Skeleton className="h-[26px] w-[210px] mb-[22px]" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
        {Array.from({ length: cartoes }, (_, i) => (
          <div key={i} className="rounded-2xl bg-card shadow-sm p-5">
            <Skeleton className="h-[13px] w-[45%] mb-[9px]" />
            <Skeleton className="h-[13px] w-[80%] mb-[9px]" />
            <Skeleton className="h-[13px] w-[60%]" />
          </div>
        ))}
      </div>

      <Skeleton className="h-[300px] rounded-2xl" />
    </>
  );
}

/**
 * @param moldura  Desenha a barra navy e a coluna lateral em volta do
 *                 esqueleto. Ligado por padrão: quem chama de fora do
 *                 `AppLayout` (`ProtectedRoute`, o `Suspense` das rotas,
 *                 a guarda de manutenção) precisa dela, senão a tela fica
 *                 branca de ponta a ponta.
 *
 * A moldura é a resposta ao "splash ou esqueleto": os dois, um de cada vez.
 * O splash cobre o vão entre o HTML chegar e o React montar — depois disso ele
 * sai e não volta, porque reexibi-lo a cada troca de rota faria o app parecer
 * que reinicia. Daí em diante quem espera é o esqueleto, e ele herda a
 * identidade do splash: mesma barra navy, mesma logo, mesmo dourado. A pessoa
 * vê o app montado desde o primeiro instante; o que falta é só o conteúdo.
 */
export default function SkeletonPagina({
  cartoes = 4,
  moldura = true,
}: { cartoes?: number; moldura?: boolean }) {
  if (!moldura) {
    return (
      <div role="status" aria-busy="true">
        <span className="sr-only">Carregando</span>
        <SkeletonCorpo cartoes={cartoes} />
      </div>
    );
  }

  return (
    <div role="status" aria-busy="true" className="min-h-screen bg-background flex items-start">
      <span className="sr-only">Carregando</span>

      {/* Coluna lateral navy — 248px e marca de 72px, como a real; some no
          mobile, como a real. As medidas andam junto com AppLayout/AppSidebar:
          esqueleto de outro tamanho faz a moldura "corrigir" ao montar. */}
      <div
        aria-hidden="true"
        className="hidden md:flex w-[248px] shrink-0 flex-col bg-sidebar border-r border-sidebar-border sticky top-0 h-screen"
      >
        <div className="flex items-center h-[72px] px-4 border-b border-sidebar-border">
          <BrandLogo variant="dark" className="w-[150px]" />
        </div>
        <div className="flex flex-col gap-1 p-3">
          <div className="h-9 w-full rounded-lg bg-sidebar-accent/60 mb-2" />
          {Array.from({ length: 9 }, (_, i) => (
            <div key={i} className="flex items-center gap-2.5 px-2 py-2">
              <div className="h-4 w-4 rounded bg-sidebar-accent" />
              <div className="h-3 rounded bg-sidebar-accent" style={{ width: `${52 + ((i * 13) % 34)}%` }} />
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Barra do topo branca — a mesma ordem do cabeçalho de verdade: lupa,
            sino, sol, engrenagem, divisória, empresa, avatar. */}
        <div
          aria-hidden="true"
          className="sticky top-0 z-30 h-16 md:h-[72px] bg-card border-b border-border flex items-center gap-3 px-4 md:px-8"
        >
          <BrandLogo className="w-[150px] md:hidden" />
          <div className="ml-auto flex items-center gap-1.5">
            <div className="w-8 h-8 rounded-lg bg-muted" />
            <div className="w-8 h-8 rounded-lg bg-muted" />
            <div className="hidden sm:block w-8 h-8 rounded-lg bg-muted" />
            <div className="hidden sm:block w-8 h-8 rounded-lg bg-muted" />
            <span className="hidden lg:block w-px h-6 bg-border mx-1.5" />
            <div className="hidden lg:block w-[168px] h-9 rounded-lg bg-muted" />
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-muted ring-1 ring-border" />
          </div>
        </div>

        <div className="flex-1 min-w-0 p-4 md:p-8">
          <SkeletonCorpo cartoes={cartoes} />
        </div>
      </div>
    </div>
  );
}
