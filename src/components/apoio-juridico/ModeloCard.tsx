import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, FileText, Sparkles, ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { toast } from 'sonner';

export type ModeloCardData = {
  id: string;
  titulo: string;
  categoria: string;
  descricao: string;
  icon: LucideIcon;
  fundamentacao: string;
  requisitosFiltro: ('indices' | 'ccts' | 'base_juridica' | 'contrato')[];
};

interface Props {
  modelo: ModeloCardData;
  pedidosCount?: number;
  onAbrir: () => void;
}

/**
 * Compact, equilibrium-balanced model card.
 * - Single-row action: small icon button + ghost copy
 * - Hover reveals primary CTA accent border
 * - Badge for generated documents on top-right
 */
export default function ModeloCard({ modelo: m, pedidosCount = 0, onAbrir }: Props) {
  const Icon = m.icon;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`${m.titulo}\n${m.descricao}\nFundamentação: ${m.fundamentacao}`);
    toast.success('Modelo copiado!');
  };

  return (
    <button
      type="button"
      onClick={onAbrir}
      className="group relative bg-card text-left rounded-lg border border-border/60 p-3 hover:border-accent/60 hover:shadow-md transition-all flex flex-col gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
    >
      {pedidosCount > 0 && (
        <Badge className="absolute top-2 right-2 text-[9px] gap-0.5 bg-accent/15 text-accent border-accent/30 h-4 px-1.5 shrink-0">
          <FileText className="w-2 h-2" /> {pedidosCount}
        </Badge>
      )}

      <div className="flex items-start gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-md bg-accent/10 flex items-center justify-center flex-shrink-0 group-hover:bg-accent/20 transition-colors">
          <Icon className="w-3.5 h-3.5 text-accent" />
        </div>
        <div className="flex-1 min-w-0 pr-6">
          <p className="font-semibold text-[13px] leading-tight line-clamp-2">{m.titulo}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-snug">{m.descricao}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 mt-auto">
        <Badge variant="outline" className="text-[9px] py-0 px-1.5 h-4 font-normal whitespace-nowrap">
          {m.fundamentacao}
        </Badge>
        {m.requisitosFiltro.includes('indices') && <Badge variant="secondary" className="text-[9px] py-0 px-1.5 h-4 whitespace-nowrap">Índices</Badge>}
        {m.requisitosFiltro.includes('ccts') && <Badge variant="secondary" className="text-[9px] py-0 px-1.5 h-4 whitespace-nowrap">CCTs</Badge>}
        {m.requisitosFiltro.includes('base_juridica') && <Badge variant="secondary" className="text-[9px] py-0 px-1.5 h-4 whitespace-nowrap">Base</Badge>}
      </div>

      <div className="flex items-center justify-between gap-1 pt-2 mt-1 border-t border-border/30">
        <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground" onClick={handleCopy}>
          <Copy className="w-3 h-3 mr-1" /> Copiar
        </Button>
        <span className="text-[11px] font-medium text-accent flex items-center gap-0.5 shrink-0 group-hover:translate-x-0.5 transition-transform">
          <Sparkles className="w-3 h-3" /> Gerar com IA <ChevronRight className="w-3 h-3" />
        </span>
      </div>
    </button>
  );
}
