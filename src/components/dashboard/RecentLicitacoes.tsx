import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { Calendar, FileSearch, MapPin } from 'lucide-react';

type Variante = NonNullable<BadgeProps['variant']>;

const statusConfig: Record<string, { label: string; variant: Variante }> = {
  monitorando: { label: 'Monitorando', variant: 'info' },
  analisando: { label: 'Analisando', variant: 'warning' },
  proposta: { label: 'Proposta', variant: 'info' },
  enviada: { label: 'Enviada', variant: 'info' },
  vencida: { label: 'Vencida', variant: 'success' },
  perdida: { label: 'Perdida', variant: 'danger' },
  'Publicado': { label: 'Publicado', variant: 'info' },
  'Proposta Enviada': { label: 'Proposta Enviada', variant: 'info' },
  'Vencida': { label: 'Vencida', variant: 'success' },
  'Homologada': { label: 'Homologada', variant: 'success' },
  'Perdida': { label: 'Perdida', variant: 'danger' },
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
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm" role="status" aria-label="Carregando licitações recentes">
        <h3 className="text-lg font-semibold mb-4">Licitações Recentes</h3>
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h3 className="text-lg font-semibold mb-4">Licitações Recentes</h3>
        <EstadoVazio
          tamanho="compacto"
          icone={<FileSearch />}
          titulo="Nenhuma licitação cadastrada ainda"
          descricao="As últimas licitações da empresa aparecem aqui."
        />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Licitações Recentes</h3>
        <span className="text-xs text-muted-foreground">Últimas {data.length}</span>
      </div>
      <div className="space-y-3">
        {data.map((lic, i) => {
          const st = statusConfig[lic.status] || { label: lic.status, variant: 'muted' as Variante };
          return (
            <div
              key={lic.id}
              className="flex items-start gap-3 p-3 rounded-md hover:bg-muted transition-colors animate-fade-in"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-xs tabular-nums text-muted-foreground">{lic.numero}</span>
                  <Badge variant={st.variant}>{st.label}</Badge>
                </div>
                <p className="text-sm font-medium truncate">{lic.objeto}</p>
                <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                  {lic.municipio && lic.uf && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" aria-hidden="true" />
                      {lic.municipio}/{lic.uf}
                    </span>
                  )}
                  {lic.data_encerramento && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" aria-hidden="true" />
                      {new Date(lic.data_encerramento).toLocaleDateString('pt-BR')}
                    </span>
                  )}
                  {lic.valor_estimado && (
                    <span className="font-semibold text-foreground tabular-nums">{formatCurrency(lic.valor_estimado)}</span>
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
