import AppLayout from '@/components/layout/AppLayout';
import { concorrentesMock } from '@/data/mockData';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Shield, AlertTriangle, CheckCircle, Trophy, XCircle, DollarSign } from 'lucide-react';

const riscoConfig: Record<string, { label: string; className: string; icon: typeof Shield }> = {
  baixo: { label: 'Baixo', className: 'bg-success/10 text-success border-success/20', icon: CheckCircle },
  medio: { label: 'Médio', className: 'bg-warning/10 text-warning border-warning/20', icon: AlertTriangle },
  alto: { label: 'Alto', className: 'bg-destructive/10 text-destructive border-destructive/20', icon: Shield },
};

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(v);

export default function Concorrentes() {
  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Análise de Concorrentes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Inteligência competitiva baseada em dados do SICAF e portais públicos
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {concorrentesMock.map((c, i) => {
          const risco = riscoConfig[c.risco];
          const taxa = ((c.vitorias / (c.vitorias + c.derrotas)) * 100).toFixed(1);
          return (
            <div
              key={c.id}
              className="bg-card rounded-xl border border-border/50 p-5 shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer animate-fade-in"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold">{c.razaoSocial}</h3>
                  <p className="text-xs font-mono text-muted-foreground mt-0.5">{c.cnpj}</p>
                </div>
                <Badge variant="outline" className={cn('text-[10px] px-2 py-0.5', risco.className)}>
                  <risco.icon className="w-3 h-3 mr-1" />
                  Risco {risco.label}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-3 mt-4">
                <div className="text-center p-2 rounded-lg bg-muted/50">
                  <Trophy className="w-4 h-4 mx-auto text-success mb-1" />
                  <p className="text-lg font-bold">{c.vitorias}</p>
                  <p className="text-[10px] text-muted-foreground">Vitórias</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-muted/50">
                  <XCircle className="w-4 h-4 mx-auto text-destructive mb-1" />
                  <p className="text-lg font-bold">{c.derrotas}</p>
                  <p className="text-[10px] text-muted-foreground">Derrotas</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-muted/50">
                  <DollarSign className="w-4 h-4 mx-auto text-accent mb-1" />
                  <p className="text-lg font-bold">{formatCurrency(c.lanceMedio)}</p>
                  <p className="text-[10px] text-muted-foreground">Lance Médio</p>
                </div>
              </div>

              <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/30">
                <div className="text-xs text-muted-foreground">
                  Taxa de vitória: <span className="font-semibold text-foreground">{taxa}%</span>
                </div>
                {c.sancoes > 0 && (
                  <span className="text-xs text-destructive font-medium flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {c.sancoes} sanção(ões)
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </AppLayout>
  );
}
