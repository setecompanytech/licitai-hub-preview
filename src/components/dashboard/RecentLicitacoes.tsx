import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Calendar, MapPin } from 'lucide-react';

const statusConfig: Record<string, { label: string; className: string }> = {
  monitorando: { label: 'Monitorando', className: 'bg-info/10 text-info border-info/20' },
  analisando: { label: 'Analisando', className: 'bg-warning/10 text-warning border-warning/20' },
  proposta: { label: 'Proposta', className: 'bg-primary/10 text-primary border-primary/20' },
  enviada: { label: 'Enviada', className: 'bg-accent/10 text-accent border-accent/20' },
  vencida: { label: 'Vencida', className: 'bg-success/10 text-success border-success/20' },
  perdida: { label: 'Perdida', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  'Publicado': { label: 'Publicado', className: 'bg-info/10 text-info border-info/20' },
  'Proposta Enviada': { label: 'Proposta Enviada', className: 'bg-accent/10 text-accent border-accent/20' },
  'Vencida': { label: 'Vencida', className: 'bg-success/10 text-success border-success/20' },
  'Homologada': { label: 'Homologada', className: 'bg-success/10 text-success border-success/20' },
  'Perdida': { label: 'Perdida', className: 'bg-destructive/10 text-destructive border-destructive/20' },
};

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

type LicitacaoRecente = {
  id: string;
  numero: string;
  orgao: string;
  objeto: string;
  status: string;
  valor_estimado: number | null;
  uf: string | null;
  municipio: string | null;
  data_encerramento: string | null;
};

type Props = {
  data: LicitacaoRecente[];
  loading?: boolean;
};

export default function RecentLicitacoes({ data, loading }: Props) {
  if (loading) {
    return (
      <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
        <h3 className="text-sm font-semibold mb-4">Licitações Recentes</h3>
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
        <h3 className="text-sm font-semibold mb-4">Licitações Recentes</h3>
        <p className="text-sm text-muted-foreground">Nenhuma licitação cadastrada ainda.</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">Licitações Recentes</h3>
        <span className="text-xs text-muted-foreground">Últimas {data.length}</span>
      </div>
      <div className="space-y-3">
        {data.map((lic, i) => {
          const st = statusConfig[lic.status] || { label: lic.status, className: 'bg-muted text-muted-foreground' };
          return (
            <div
              key={lic.id}
              className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer animate-fade-in"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-muted-foreground">{lic.numero}</span>
                  <Badge variant="outline" className={cn('text-xs px-1.5 py-0', st.className)}>
                    {st.label}
                  </Badge>
                </div>
                <p className="text-sm font-medium truncate">{lic.objeto}</p>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                  {lic.municipio && lic.uf && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {lic.municipio}/{lic.uf}
                    </span>
                  )}
                  {lic.data_encerramento && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(lic.data_encerramento).toLocaleDateString('pt-BR')}
                    </span>
                  )}
                  {lic.valor_estimado && (
                    <span className="font-semibold text-foreground">{formatCurrency(lic.valor_estimado)}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
