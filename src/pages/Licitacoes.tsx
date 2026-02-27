import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Search, Filter, MapPin, Calendar as CalendarIcon2, Building2, ArrowUpDown, CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import CountdownTimer from '@/components/licitacoes/CountdownTimer';
import { useAuth } from '@/contexts/AuthContext';

type Licitacao = {
  id: string;
  numero: string;
  orgao: string;
  objeto: string;
  modalidade: string;
  status: string;
  valor_estimado: number | null;
  uf: string | null;
  municipio: string | null;
  data_encerramento: string | null;
};

const regioes: Record<string, string[]> = {
  'Norte': ['AC', 'AM', 'AP', 'PA', 'RO', 'RR', 'TO'],
  'Nordeste': ['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE'],
  'Centro-Oeste': ['DF', 'GO', 'MS', 'MT'],
  'Sudeste': ['ES', 'MG', 'RJ', 'SP'],
  'Sul': ['PR', 'RS', 'SC'],
};

const statusConfig: Record<string, { label: string; className: string }> = {
  'Publicado': { label: 'Publicado', className: 'bg-info/10 text-info border-info/20' },
  'Em Disputa': { label: 'Em Disputa', className: 'bg-warning/10 text-warning border-warning/20' },
  'Homologado': { label: 'Homologado', className: 'bg-success/10 text-success border-success/20' },
  'Contrato Assinado': { label: 'Contrato Assinado', className: 'bg-accent/10 text-accent border-accent/20' },
  'Deserto': { label: 'Deserto', className: 'bg-muted text-muted-foreground border-border' },
  'Fracassado': { label: 'Fracassado', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  'Revogado': { label: 'Revogado', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  'Anulado': { label: 'Anulado', className: 'bg-destructive/10 text-destructive border-destructive/20' },
};

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export default function Licitacoes() {
  const { user } = useAuth();
  const [licitacoes, setLicitacoes] = useState<Licitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [modalidadeFilter, setModalidadeFilter] = useState<string>('all');
  const [regiaoFilter, setRegiaoFilter] = useState<string>('all');
  const [ufFilter, setUfFilter] = useState<string>('all');
  const [dataInicio, setDataInicio] = useState<Date | undefined>();
  const [dataFim, setDataFim] = useState<Date | undefined>();

  useEffect(() => {
    if (!user) return;
    supabase
      .from('licitacoes')
      .select('id, numero, orgao, objeto, modalidade, status, valor_estimado, uf, municipio, data_encerramento')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setLicitacoes(data || []);
        setLoading(false);
      });
  }, [user]);

  const ufsDisponiveis = regiaoFilter === 'all'
    ? Object.values(regioes).flat()
    : regioes[regiaoFilter] || [];

  const handleRegiaoChange = (v: string) => { setRegiaoFilter(v); setUfFilter('all'); };

  const filtered = licitacoes.filter((l) => {
    const matchSearch =
      l.objeto.toLowerCase().includes(search.toLowerCase()) ||
      l.orgao.toLowerCase().includes(search.toLowerCase()) ||
      l.numero.toLowerCase().includes(search.toLowerCase()) ||
      (l.municipio || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || l.status === statusFilter;
    const matchModalidade = modalidadeFilter === 'all' || l.modalidade === modalidadeFilter;
    const matchDataInicio = !dataInicio || (l.data_encerramento && new Date(l.data_encerramento) >= dataInicio);
    const matchDataFim = !dataFim || (l.data_encerramento && new Date(l.data_encerramento) <= new Date(dataFim.getTime() + 86400000));
    const matchUf = ufFilter === 'all'
      ? (regiaoFilter === 'all' || ufsDisponiveis.includes(l.uf || ''))
      : l.uf === ufFilter;
    return matchSearch && matchStatus && matchModalidade && matchUf && matchDataInicio && matchDataFim;
  });

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Licitações</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {loading ? 'Carregando...' : `${filtered.length} licitações encontradas`}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="relative flex-1 min-w-[250px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por CNPJ, objeto, órgão, número, município..." className="pl-9 bg-card border-border/50" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("h-10 text-xs gap-1.5", dataInicio && "text-foreground")}>
              <CalendarDays className="w-3.5 h-3.5" />
              {dataInicio ? format(dataInicio, "dd/MM/yyyy") : "Data início"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dataInicio} onSelect={setDataInicio} locale={ptBR} className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("h-10 text-xs gap-1.5", dataFim && "text-foreground")}>
              <CalendarDays className="w-3.5 h-3.5" />
              {dataFim ? format(dataFim, "dd/MM/yyyy") : "Data fim"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dataFim} onSelect={setDataFim} locale={ptBR} className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
        {(dataInicio || dataFim) && (
          <Button variant="ghost" size="sm" className="h-10 text-xs" onClick={() => { setDataInicio(undefined); setDataFim(undefined); }}>
            Limpar datas
          </Button>
        )}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] bg-card border-border/50"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(statusConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={modalidadeFilter} onValueChange={setModalidadeFilter}>
          <SelectTrigger className="w-[180px] bg-card border-border/50"><SelectValue placeholder="Modalidade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas modalidades</SelectItem>
            <SelectItem value="Pregão Eletrônico">Pregão Eletrônico</SelectItem>
            <SelectItem value="Concorrência">Concorrência</SelectItem>
            <SelectItem value="Tomada de Preços">Tomada de Preços</SelectItem>
            <SelectItem value="Dispensa">Dispensa</SelectItem>
          </SelectContent>
        </Select>
        <Select value={regiaoFilter} onValueChange={handleRegiaoChange}>
          <SelectTrigger className="w-[160px] bg-card border-border/50">
            <MapPin className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" /><SelectValue placeholder="Região" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas regiões</SelectItem>
            {Object.keys(regioes).map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={ufFilter} onValueChange={setUfFilter}>
          <SelectTrigger className="w-[120px] bg-card border-border/50"><SelectValue placeholder="UF" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos UFs</SelectItem>
            {ufsDisponiveis.sort().map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
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
                <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Valor</th>
                <th className="text-center text-xs font-semibold text-muted-foreground px-4 py-3">Encerramento</th>
                <th className="text-center text-xs font-semibold text-muted-foreground px-4 py-3">Contagem</th>
                <th className="text-center text-xs font-semibold text-muted-foreground px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && !loading && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhuma licitação encontrada.</td></tr>
              )}
              {filtered.map((lic, i) => {
                const st = statusConfig[lic.status] || { label: lic.status, className: 'bg-muted text-muted-foreground' };
                return (
                  <tr key={lic.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors cursor-pointer animate-fade-in" style={{ animationDelay: `${i * 40}ms` }}>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-muted-foreground block">{lic.numero}</span>
                      <span className="text-sm font-medium line-clamp-1">{lic.objeto}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-sm">
                        <Building2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="line-clamp-1">{lic.orgao}</span>
                      </div>
                      {lic.municipio && lic.uf && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" />{lic.municipio}/{lic.uf}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold">{lic.valor_estimado ? formatCurrency(lic.valor_estimado) : '-'}</td>
                    <td className="px-4 py-3 text-center">
                      {lic.data_encerramento ? (
                        <span className="text-sm flex items-center justify-center gap-1">
                          <CalendarIcon2 className="w-3.5 h-3.5 text-muted-foreground" />
                          {new Date(lic.data_encerramento).toLocaleDateString('pt-BR')}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {lic.data_encerramento ? (
                        <CountdownTimer targetDate={lic.data_encerramento} compact />
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="outline" className={cn('text-[10px] px-2 py-0.5', st.className)}>{st.label}</Badge>
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
