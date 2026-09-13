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
    <div role="status" aria-busy="true" className="min-h-screen bg-background flex flex-col">
      <span className="sr-only">Carregando</span>

      {/* A mesma faixa navy do AppLayout: marca, navegação no centro e as
          ações à direita. Esqueleto de outra forma faz a moldura "corrigir"
          a posição ao montar, e o olho lê isso como defeito. */}
      <div
        aria-hidden="true"
        className="sticky top-0 z-40 h-16 md:h-[72px] bg-sidebar border-b border-sidebar-border flex items-center gap-2 px-5 md:px-8 xl:px-12 2xl:px-16"
      >
        <BrandLogo variant="dark" className="w-[164px] lg:w-[200px]" />
        <div className="hidden md:flex flex-1 items-center justify-center gap-1">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-8 rounded-md bg-sidebar-accent/60" style={{ width: `${74 + ((i * 17) % 38)}px` }} />
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1.5 md:ml-0">
          <div className="w-8 h-8 rounded-lg bg-sidebar-accent/60" />
          <div className="w-8 h-8 rounded-lg bg-sidebar-accent/60" />
          <div className="hidden sm:block w-8 h-8 rounded-lg bg-sidebar-accent/60" />
          <span className="hidden lg:block w-px h-6 bg-sidebar-border mx-1.5" />
          <div className="hidden lg:block w-[168px] h-10 rounded-lg bg-sidebar-accent/60" />
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-sidebar-accent ring-1 ring-sidebar-border" />
        </div>
      </div>

      <div className="flex-1 min-w-0 px-5 py-5 md:px-8 md:py-8 xl:px-12 2xl:px-16">
        <SkeletonCorpo cartoes={cartoes} />
      </div>
    </div>
  );
}
