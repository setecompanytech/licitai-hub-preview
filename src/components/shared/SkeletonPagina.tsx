import PraefectusLogo from '@/components/shared/PraefectusLogo';
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
 * @param moldura  Tela cheia de espera, sem casca do app (`ProtectedRoute`,
 *                 o `Suspense` das rotas, as guardas de plano/manutenção
 *                 chamam com o padrão). Fundo desfocado, marca centralizada
 *                 e um spinner — não finge navbar nem cartões que ainda não
 *                 existem.
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
    <div
      role="status"
      aria-busy="true"
      className="fixed inset-0 z-50 flex min-h-screen flex-col items-center justify-center gap-5 bg-background/80 backdrop-blur-md"
    >
      <span className="sr-only">Carregando</span>
      <PraefectusLogo size="lg" />
      <div
        aria-hidden="true"
        className="h-8 w-8 animate-spin rounded-full border-[3px] border-muted border-t-primary"
      />
      <p className="text-sm font-medium text-muted-foreground">Carregando...</p>
    </div>
  );
}
