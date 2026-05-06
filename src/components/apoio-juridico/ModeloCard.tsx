import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, FileText, Sparkles } from 'lucide-react';
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

export default function ModeloCard({ modelo: m, pedidosCount = 0, onAbrir }: Props) {
  const Icon = m.icon;
  const handleCopy = () => {
    navigator.clipboard.writeText(`${m.titulo}\n${m.descricao}\nFundamentação: ${m.fundamentacao}`);
    toast.success('Modelo copiado!');
  };
  return (
    <div
      className="group bg-card rounded-xl border border-border/50 p-4 shadow-sm hover:shadow-lg hover:border-accent/40 transition-all cursor-pointer flex flex-col"
      onClick={onAbrir}
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0 group-hover:bg-accent/20 transition-colors">
          <Icon className="w-4 h-4 text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm">{m.titulo}</p>
            {pedidosCount > 0 && (
              <Badge variant="default" className="text-[10px] gap-1 bg-accent/15 text-accent border-accent/30 hover:bg-accent/20 shrink-0">
                <FileText className="w-2.5 h-2.5" /> {pedidosCount} {pedidosCount === 1 ? 'doc' : 'docs'}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{m.descricao}</p>
          <div className="flex flex-wrap gap-1 mt-2">
            <Badge variant="outline" className="text-[10px]">{m.fundamentacao}</Badge>
            {m.requisitosFiltro.includes('indices') && <Badge variant="secondary" className="text-[10px]">📊 Índices</Badge>}
            {m.requisitosFiltro.includes('ccts') && <Badge variant="secondary" className="text-[10px]">👷 CCTs</Badge>}
            {m.requisitosFiltro.includes('base_juridica') && <Badge variant="secondary" className="text-[10px]">📚 Base</Badge>}
          </div>
        </div>
      </div>
      <div className="flex gap-2 mt-3 pt-3 border-t border-border/30">
        <Button size="sm" variant="outline" className="shrink-0" onClick={(e) => { e.stopPropagation(); handleCopy(); }}>
          <Copy className="w-3 h-3 mr-1" /> Copiar
        </Button>
        <Button
          size="sm"
          className="bg-accent hover:bg-accent/90 text-accent-foreground flex-1"
          onClick={(e) => { e.stopPropagation(); onAbrir(); }}
        >
          <Sparkles className="w-3 h-3 mr-1" />
          Gerar com IA
        </Button>
      </div>
    </div>
  );
}
