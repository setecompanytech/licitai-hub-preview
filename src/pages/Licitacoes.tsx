import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { licitacoesMock, Licitacao } from '@/data/mockData';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Search, Filter, MapPin, Calendar, Building2, ArrowUpDown } from 'lucide-react';

const statusConfig: Record<string, { label: string; className: string }> = {
  monitorando: { label: 'Monitorando', className: 'bg-info/10 text-info border-info/20' },
  analisando: { label: 'Analisando', className: 'bg-warning/10 text-warning border-warning/20' },
  proposta: { label: 'Proposta', className: 'bg-primary/10 text-primary border-primary/20' },
  enviada: { label: 'Enviada', className: 'bg-accent/10 text-accent border-accent/20' },
  vencida: { label: 'Vencida', className: 'bg-success/10 text-success border-success/20' },
  perdida: { label: 'Perdida', className: 'bg-destructive/10 text-destructive border-destructive/20' },
};

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export default function Licitacoes() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [modalidadeFilter, setModalidadeFilter] = useState<string>('all');

  const filtered = licitacoesMock.filter((l) => {
    const matchSearch =
      l.objeto.toLowerCase().includes(search.toLowerCase()) ||
      l.orgao.toLowerCase().includes(search.toLowerCase()) ||
      l.numero.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || l.status === statusFilter;
    const matchModalidade = modalidadeFilter === 'all' || l.modalidade === modalidadeFilter;
    return matchSearch && matchStatus && matchModalidade;
  });

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Licitações</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {filtered.length} licitações encontradas
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[250px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por objeto, órgão ou número..."
            className="pl-9 bg-card border-border/50"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] bg-card border-border/50">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="monitorando">Monitorando</SelectItem>
            <SelectItem value="analisando">Analisando</SelectItem>
            <SelectItem value="proposta">Proposta</SelectItem>
            <SelectItem value="enviada">Enviada</SelectItem>
            <SelectItem value="vencida">Vencida</SelectItem>
            <SelectItem value="perdida">Perdida</SelectItem>
          </SelectContent>
        </Select>
        <Select value={modalidadeFilter} onValueChange={setModalidadeFilter}>
          <SelectTrigger className="w-[180px] bg-card border-border/50">
            <SelectValue placeholder="Modalidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas modalidades</SelectItem>
            <SelectItem value="Pregão Eletrônico">Pregão Eletrônico</SelectItem>
            <SelectItem value="Concorrência">Concorrência</SelectItem>
            <SelectItem value="Tomada de Preços">Tomada de Preços</SelectItem>
            <SelectItem value="Dispensa">Dispensa</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Nº / Objeto</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Órgão</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Modalidade</th>
                <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Valor</th>
                <th className="text-center text-xs font-semibold text-muted-foreground px-4 py-3">Encerramento</th>
                <th className="text-center text-xs font-semibold text-muted-foreground px-4 py-3">Status</th>
                <th className="text-center text-xs font-semibold text-muted-foreground px-4 py-3">Relevância</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lic, i) => {
                const st = statusConfig[lic.status];
                return (
                  <tr
                    key={lic.id}
                    className="border-b border-border/30 hover:bg-muted/30 transition-colors cursor-pointer animate-fade-in"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-muted-foreground block">{lic.numero}</span>
                      <span className="text-sm font-medium line-clamp-1">{lic.objeto}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-sm">
                        <Building2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="line-clamp-1">{lic.orgao}</span>
                      </div>
                      <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" />
                        {lic.cidade}/{lic.uf}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">{lic.modalidade}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold">{formatCurrency(lic.valor)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm flex items-center justify-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                        {new Date(lic.dataEncerramento).toLocaleDateString('pt-BR')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="outline" className={cn('text-[10px] px-2 py-0.5', st.className)}>
                        {st.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${lic.relevancia}%`,
                              background:
                                lic.relevancia > 80
                                  ? 'hsl(var(--success))'
                                  : lic.relevancia > 60
                                  ? 'hsl(var(--warning))'
                                  : 'hsl(var(--muted-foreground))',
                            }}
                          />
                        </div>
                        <span className="text-xs font-mono text-muted-foreground">{lic.relevancia}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
