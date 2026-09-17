import { useQuery } from '@tanstack/react-query';
import type { LanceConfig } from '@/components/robo-lances/ConfigurarLanceDialog';
import { buscarCompraDoComprasGov, podeBuscarCompra } from '@/lib/robo/compra-comprasgov';
import { idDoPortal } from '@/lib/robo/portais';

/**
 * A compra da disputa nos dados abertos, com cache compartilhado: o cartão da
 * página e o diálogo "Detalhes da licitação" leem a mesma consulta.
 * `ativa` = disputa do Compras.gov com UASG e número/ano válidos.
 */
export function useCompraDaDisputa(lance: LanceConfig, habilitada = true) {
  const uasg = lance.uasg ?? '';
  const ativa = idDoPortal(lance.portal) === 'compras-gov' && podeBuscarCompra(uasg, lance.edital);

  const consulta = useQuery({
    queryKey: ['compra-comprasgov', uasg, lance.edital],
    enabled: ativa && habilitada,
    staleTime: 10 * 60_000,
    retry: false,
    queryFn: async () => {
      const r = await buscarCompraDoComprasGov(uasg, lance.edital);
      if (!r.ok) throw new Error(r.motivo ?? 'O Compras.gov não devolveu a compra.');
      return r.compras ?? [];
    },
  });
  return { ativa, consulta };
}
