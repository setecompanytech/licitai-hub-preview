import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import type { LanceConfig } from '@/components/robo-lances/ConfigurarLanceDialog';
import { AvisoDeFalha } from '@/components/gestao/SeloSituacao';
import { Skeleton } from '@/components/ui/skeleton';
import {
  buscarCompraDoComprasGov,
  divergenciaDaSessao,
  podeBuscarCompra,
  resumoDaCompra,
} from '@/lib/robo/compra-comprasgov';
import { idDoPortal } from '@/lib/robo/portais';

/**
 * Os dados da licitação na página da disputa — Fase 6 do robô ("retornar dados
 * da licitação para complementar as informações", checklist do grupo, 14/09).
 *
 * Só no Compras.gov, com UASG e número/ano: lê a compra ao vivo dos dados
 * abertos (função `compra-comprasgov`), sem gravar cópia — a data publicada
 * muda quando o pregão é remarcado, e uma cópia envelheceria calada. Diz quando
 * a data da disputa não confere com a publicada. Falha de leitura aparece com
 * "Tentar novamente"; não bloqueia nada da página.
 */
export default function CompraDaDisputa({ lance }: { lance: LanceConfig }) {
  const uasg = lance.uasg ?? '';
  const ativa = idDoPortal(lance.portal) === 'compras-gov' && podeBuscarCompra(uasg, lance.edital);

  const consulta = useQuery({
    queryKey: ['compra-comprasgov', uasg, lance.edital],
    enabled: ativa,
    staleTime: 10 * 60_000,
    retry: false,
    queryFn: async () => {
      const r = await buscarCompraDoComprasGov(uasg, lance.edital);
      if (!r.ok) throw new Error(r.motivo ?? 'O Compras.gov não devolveu a compra.');
      return r.compras ?? [];
    },
  });

  if (!ativa) return null;

  if (consulta.isLoading) {
    return (
      <div className="flex flex-col gap-1.5 rounded-[var(--g-raio)] border border-border bg-card px-4 py-3" aria-busy="true">
        <span className="sr-only">Lendo a compra no Compras.gov</span>
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    );
  }

  if (consulta.isError) {
    return (
      <AvisoDeFalha aoTentarNovamente={() => void consulta.refetch()}>
        Dados da compra no Compras.gov: {(consulta.error as Error).message}
      </AvisoDeFalha>
    );
  }

  const compras = consulta.data ?? [];
  if (compras.length === 0) return null;
  // Mais de uma modalidade com o mesmo número: mostra todas, sem escolher por ela.
  const inicioSessaoMs =
    lance.dataSessao && lance.horario
      ? new Date(`${lance.dataSessao}T${lance.horario.slice(0, 5)}:00`).getTime()
      : null;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {compras.map((compra) => {
        const resumo = resumoDaCompra(compra);
        const divergencia = compras.length === 1
          ? divergenciaDaSessao(compra, Number.isNaN(inicioSessaoMs) ? null : inicioSessaoMs)
          : null;
        return (
          <section
            key={compra.idCompra}
            aria-label={`Compra ${compra.numero}/${compra.ano} no Compras.gov`}
            className="flex min-w-0 flex-col gap-0.5 rounded-[var(--g-raio)] border border-border bg-card px-4 py-3"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h2 className="g-corpo font-semibold text-foreground">{resumo.titulo} no Compras.gov</h2>
              {compra.urlPncp && (
                <a
                  href={compra.urlPncp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="g-meta inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Ver no PNCP <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              )}
            </div>
            {resumo.linhas.map((linha, idx) => (
              <p key={idx} className="g-meta min-w-0 text-muted-foreground">{linha}</p>
            ))}
            {divergencia && (
              <p className="g-meta mt-1 inline-flex items-start gap-1.5 text-warning-ink" role="status">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{divergencia}</span>
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}
