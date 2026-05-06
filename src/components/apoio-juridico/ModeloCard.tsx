import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, FileText, ChevronRight } from 'lucide-react';
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
  index: number;
  onAbrir: () => void;
}

/**
 * Linha forense estilo Vade Mecum / Diário Oficial.
 * Tipografia do sistema (Plus Jakarta Sans) em todos os textos.
 * Numeração arábica à esquerda, fundamentação centralizada, ações à direita.
 */
export default function ModeloCard({ modelo: m, pedidosCount = 0, index, onAbrir }: Props) {
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`${m.titulo}\n${m.descricao}\nFundamentação: ${m.fundamentacao}`);
    toast.success('Modelo copiado!');
  };

  const numero = String(index + 1).padStart(2, '0');

  // Deep-link para abrir o modelo (suporta nova aba via Cmd/Ctrl+click ou botão do meio)
  const href = `/apoio-juridico?modelo=${encodeURIComponent(m.id)}`;

  const abrirNovaAba = () => {
    // Abre nova aba/janela completa (top-level). Fallback: navega na própria aba.
    const win = window.open(href, '_blank', 'noopener,noreferrer');
    if (!win) {
      window.location.href = href;
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (e.defaultPrevented) return;
    e.preventDefault();
    abrirNovaAba();
  };

  const handleAuxClick = (e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault();
      abrirNovaAba();
    }
  };

  return (
    <article
      onClick={handleCardClick}
      onAuxClick={handleAuxClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirNovaAba(); } }}
      className="group relative grid grid-cols-[2.25rem_1fr_auto] items-start gap-3 px-3 py-2.5 border-b border-border/40 last:border-b-0 hover:bg-accent/5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:bg-accent/10 focus-visible:ring-1 focus-visible:ring-accent/40"
    >
      {/* Numeração forense */}
      <div className="flex flex-col items-center pt-0.5 shrink-0">
        <span className="text-[14px] font-semibold text-muted-foreground tabular-nums leading-none">
          {numero}
        </span>
        <span className="block w-4 h-px bg-border/60 mt-1" />
        {pedidosCount > 0 && (
          <Badge className="mt-1 text-[9px] gap-0.5 bg-accent/15 text-accent border-accent/30 h-4 px-1 leading-none shrink-0">
            <FileText className="w-2.5 h-2.5" /> {pedidosCount}
          </Badge>
        )}
      </div>

      {/* Caput + descrição + fundamentação */}
      <div className="min-w-0">
        <h4 className="text-[15px] font-semibold text-foreground leading-snug tracking-tight">
          {m.titulo}
        </h4>
        <p className="text-[13px] text-muted-foreground mt-1 leading-snug line-clamp-2">
          {m.descricao}
        </p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5">
          <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-primary/90 tabular-nums whitespace-nowrap">
            <span className="text-muted-foreground/70">§</span> {m.fundamentacao}
          </span>
          {m.requisitosFiltro.includes('indices') && (
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/80 border-l border-border/60 pl-2 whitespace-nowrap">Índices</span>
          )}
          {m.requisitosFiltro.includes('ccts') && (
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/80 border-l border-border/60 pl-2 whitespace-nowrap">CCT</span>
          )}
          {m.requisitosFiltro.includes('base_juridica') && (
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/80 border-l border-border/60 pl-2 whitespace-nowrap">Base Jurídica</span>
          )}
          {m.requisitosFiltro.includes('contrato') && (
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/80 border-l border-border/60 pl-2 whitespace-nowrap">Contrato</span>
          )}
        </div>
      </div>

      {/* Ações */}
      <div className="flex items-center gap-1 shrink-0 self-center">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
          onClick={handleCopy}
          title="Copiar"
        >
          <Copy className="w-3.5 h-3.5" />
        </Button>
        <Button
          asChild
          size="sm"
          variant="ghost"
          className="h-8 px-2.5 text-[11.5px] uppercase tracking-wider font-semibold text-accent hover:text-accent hover:bg-accent/10 gap-1 shrink-0"
        >
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            title="Redigir (abre em nova aba)"
            onClick={(e) => {
              e.stopPropagation();
              // Sempre abre em nova aba/janela COMPLETA (top-level), independente de modificadores
              e.preventDefault();
              abrirNovaAba();
            }}
            onAuxClick={(e) => {
              e.stopPropagation();
            }}
          >
            Redigir <ChevronRight className="w-3 h-3" />
          </a>
        </Button>
      </div>
    </article>
  );
}
