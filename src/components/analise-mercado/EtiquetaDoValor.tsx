import { Badge } from '@/components/ui/badge';
import { etiquetaDoValor, explicacaoDoValor, type Estagio, type Natureza } from '@/lib/mercado/preco-observado';

/**
 * A etiqueta que acompanha todo valor de mercado (22/09): o que ele mede
 * (global do processo ou unitário do item) e em que estágio (estimado,
 * homologado, registrado em ata, contratado, empenhado, faturado). Neutra de
 * propósito: natureza não é estado, não ganha cor semântica.
 */
export default function EtiquetaDoValor({ natureza, estagio, className }: { natureza: Natureza; estagio: Estagio; className?: string }) {
  return (
    <Badge variant="muted" className={className} title={explicacaoDoValor(natureza, estagio)}>
      {etiquetaDoValor(natureza, estagio)}
    </Badge>
  );
}
