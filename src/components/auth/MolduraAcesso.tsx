import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import BrandLogo from '@/components/shared/BrandLogo';
import IlustracaoDocumentos from '@/components/shared/IlustracaoDocumentos';

/**
 * MolduraAcesso — a moldura das telas de autenticação (prancha 12/09):
 * a partir de 1024px, duas colunas — painel institucional claro (~55%) com a
 * marca, o título e a ilustração, e a coluna de acesso branca (~45%) com o
 * conteúdo centrado a 420px. Abaixo disso, uma coluna só: marca horizontal
 * no topo e a área de acesso logo em seguida.
 *
 * Altura mínima de 100dvh (100vh de reserva) e rolagem livre — nada é fixo
 * nem cortado em tela baixa; o rodapé fica no fluxo.
 */
export default function MolduraAcesso({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen min-h-[100dvh] bg-background">
      {/* Painel institucional — só no desktop */}
      <aside className="relative hidden w-[55%] flex-col overflow-hidden bg-background px-10 py-10 lg:flex xl:px-16 xl:py-14 bg-[radial-gradient(ellipse_at_85%_10%,hsl(var(--primary)/0.14),transparent_55%),radial-gradient(ellipse_at_10%_95%,hsl(var(--primary)/0.10),transparent_50%)]">
        <div className="mx-auto flex w-full max-w-[520px] flex-1 flex-col">
          <Link to="/" aria-label="Praefectus — página inicial" className="inline-flex w-fit">
            <BrandLogo width={220} />
          </Link>

          <p className="mt-10 font-heading text-xs font-bold uppercase leading-4 tracking-[0.14em] text-muted-foreground">
            Gestão pública, mais oportunidades
          </p>
          <h2 className="mt-4 font-heading text-[2.75rem] font-bold leading-[3.25rem] tracking-[-0.02em] text-foreground [hyphens:none] [overflow-wrap:normal] [word-break:normal]">
            Sua próxima<br />
            oportunidade<br />
            começa com<br />
            <span className="text-primary">um acesso.</span>
          </h2>
          <p className="mt-4 max-w-[36ch] text-base leading-6 text-muted-foreground">
            Organize editais, propostas e resultados em um só lugar.
          </p>

          <div className="mt-auto flex items-end gap-6 pt-10">
            <ul className="mb-4 hidden shrink-0 space-y-1 font-heading text-[11px] font-bold uppercase leading-4 tracking-[0.14em] text-muted-foreground xl:block">
              <li>Mais</li>
              <li>transparência</li>
              <li>mais resultados</li>
              <li>mais oportunidades</li>
            </ul>
            <IlustracaoDocumentos className="ml-auto mr-0 max-w-[340px] xl:max-w-[420px]" />
          </div>
        </div>
      </aside>

      {/* Coluna de acesso */}
      <main className="flex min-h-screen min-h-[100dvh] flex-1 flex-col bg-card px-5 sm:px-6 lg:px-12">
        <div className="flex justify-center pt-8 lg:hidden">
          <Link to="/" aria-label="Praefectus — página inicial" className="inline-flex">
            <BrandLogo width={180} />
          </Link>
        </div>

        <div className="flex flex-1 flex-col">
          <div className="mx-auto my-auto w-full max-w-[440px] py-8 lg:max-w-[420px] lg:py-12">{children}</div>
        </div>

        <footer className="pb-6 text-center text-xs leading-4 text-muted-foreground">© Praefectus</footer>
      </main>
    </div>
  );
}
