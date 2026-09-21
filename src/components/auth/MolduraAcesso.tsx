import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import BrandLogo from '@/components/shared/BrandLogo';

/**
 * MolduraAcesso — a moldura das telas de autenticação (Design System v3,
 * 19/09/2026): a partir de 1024px, duas colunas — o painel institucional em
 * navy (~44%) com a marca clara, a frase e as promessas, e a coluna de acesso
 * sobre o fundo da página, com o conteúdo num cartão branco de 12px
 * (`max-w-md`, `p-6 sm:p-8`). Abaixo disso, uma coluna só: marca no topo e o
 * cartão logo em seguida. Sem gradiente nem ilustração: o navy é a estrutura,
 * e o verde fica para a ação, dentro do cartão.
 *
 * Altura mínima de 100dvh (100vh de reserva) e rolagem livre — nada é fixo
 * nem cortado em tela baixa; o rodapé fica no fluxo.
 */
export default function MolduraAcesso({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen min-h-[100dvh] bg-background">
      {/* Painel institucional — só no desktop */}
      <aside className="hidden w-[44%] max-w-[600px] flex-col bg-navy px-10 py-10 text-navy-foreground lg:flex xl:px-16 xl:py-14">
        <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col">
          <Link
            to="/"
            aria-label="Praefectus — página inicial"
            className="inline-flex w-fit rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          >
            <BrandLogo variant="dark" width={200} />
          </Link>

          <p className="mt-12 text-xs font-semibold uppercase tracking-wider text-navy-foreground/60">
            Gestão pública, mais oportunidades
          </p>
          {/* O teal é o degrau vivo do verde sobre o navy — o mesmo do item
              ativo da barra lateral; sobre branco ele nunca vira texto. */}
          <h2 className="mt-4 text-5xl font-semibold tracking-tight text-navy-foreground [hyphens:none] [overflow-wrap:normal] [word-break:normal]">
            Sua próxima<br />
            oportunidade<br />
            começa com<br />
            <span className="text-teal">um acesso.</span>
          </h2>
          <p className="mt-5 max-w-[36ch] text-base leading-6 text-navy-foreground/75">
            Organize editais, propostas e resultados em um só lugar.
          </p>

          <ul className="mt-auto space-y-1 pt-10 text-xs font-semibold uppercase tracking-wider text-navy-foreground/55">
            <li>Mais</li>
            <li>transparência</li>
            <li>mais resultados</li>
            <li>mais oportunidades</li>
          </ul>
        </div>
      </aside>

      {/* Coluna de acesso */}
      <main className="flex min-h-screen min-h-[100dvh] flex-1 flex-col px-4 sm:px-6 lg:px-12">
        <div className="flex justify-center pt-8 lg:hidden">
          <Link
            to="/"
            aria-label="Praefectus — página inicial"
            className="inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <BrandLogo width={160} />
          </Link>
        </div>

        <div className="flex flex-1 flex-col">
          <div className="mx-auto my-auto w-full max-w-md py-8 lg:py-12">
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">{children}</div>
          </div>
        </div>

        <footer className="pb-6 text-center text-xs leading-4 text-muted-foreground">© Praefectus</footer>
      </main>
    </div>
  );
}
