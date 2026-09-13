import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import {
  Globe, Search, ExternalLink, Filter,
} from 'lucide-react';
import { toast } from 'sonner';

type Source = {
  id: string;
  nome: string;
  tipo: string;
  url_base: string;
  metodo_ingestao: string;
  categoria: string;
  ativo: boolean;
};

const TIPO_LABELS: Record<string, string> = {
  marketplace: 'Marketplace',
  distribuidor: 'Distribuidor',
  fornecedor_especializado: 'Especializado',
  comparador: 'Comparador',
  hub: 'Hub/Integração',
};

const CATEGORIA_LABELS: Record<string, string> = {
  generalista: 'Generalista',
  atacado: 'Atacado/Distribuição',
  tecnologia: 'Tecnologia',
  expediente: 'Material de Expediente',
  limpeza: 'Limpeza/Higiene',
  descartaveis: 'Descartáveis',
  alimentos: 'Alimentos',
  construcao: 'Construção/Elétrica',
  hospitalar: 'Hospitalar',
  comparador: 'Comparador/Busca',
  hub: 'Hub/Integração',
};

const METODO_LABELS: Record<string, string> = {
  api: 'API Oficial',
  manual_link: 'Link Manual',
  upload_csv_xlsx: 'Upload CSV/XLSX',
  feed_rss: 'Feed RSS',
  scrape_respeitoso: 'Scraping',
};

export default function FontesManager() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState('todos');
  const [filterCategoria, setFilterCategoria] = useState('todos');

  useEffect(() => {
    loadSources();
  }, []);

  const loadSources = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('search_sources')
      .select('*')
      .order('categoria', { ascending: true })
      .order('nome', { ascending: true });
    if (error) {
      toast.error('Erro ao carregar fontes.');
    } else {
      setSources((data || []) as Source[]);
    }
    setLoading(false);
  };

  const filtered = sources.filter(s => {
    if (searchTerm && !s.nome.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (filterTipo !== 'todos' && s.tipo !== filterTipo) return false;
    if (filterCategoria !== 'todos' && s.categoria !== filterCategoria) return false;
    return true;
  });

  const stats = {
    total: sources.length,
    ativos: sources.filter(s => s.ativo).length,
    categorias: new Set(sources.map(s => s.categoria)).size,
    tipos: new Set(sources.map(s => s.tipo)).size,
  };

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total de Fontes', value: stats.total, color: 'text-foreground' },
          { label: 'Fontes Ativas', value: stats.ativos, color: 'text-success' },
          { label: 'Categorias', value: stats.categorias, color: 'text-foreground' },
          { label: 'Tipos', value: stats.tipos, color: 'text-foreground' },
        ].map(s => (
          <div key={s.label} className="rounded-lg border border-border bg-card p-4 text-center shadow-sm">
            <p className={`text-[2rem] leading-10 font-bold tabular-nums ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-72">
          <Label htmlFor="fontes-busca" className="sr-only">Buscar fonte</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="fontes-busca"
              placeholder="Buscar fonte..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger aria-label="Tipo de fonte" className="w-full sm:w-[180px]">
            <Filter className="w-4 h-4 mr-1 text-muted-foreground" aria-hidden="true" />
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {Object.entries(TIPO_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterCategoria} onValueChange={setFilterCategoria}>
          <SelectTrigger aria-label="Categoria da fonte" className="w-full sm:w-[200px]">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas categorias</SelectItem>
            {Object.entries(CATEGORIA_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="outline" className="h-11">
          {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2" role="status" aria-label="Carregando fontes">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted">
                <TableHead className="text-sm font-semibold">Fonte</TableHead>
                <TableHead className="text-sm font-semibold">Tipo</TableHead>
                <TableHead className="text-sm font-semibold">Categoria</TableHead>
                <TableHead className="text-sm font-semibold">Método</TableHead>
                <TableHead className="text-sm font-semibold text-center">Status</TableHead>
                <TableHead className="text-sm font-semibold text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(s => (
                <TableRow key={s.id} className="hover:bg-muted">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-muted-foreground flex-shrink-0" aria-hidden="true" />
                      <div>
                        <p className="text-sm font-medium">{s.nome}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">{s.url_base}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {TIPO_LABELS[s.tipo] || s.tipo}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {CATEGORIA_LABELS[s.categoria] || s.categoria}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="muted">
                      {METODO_LABELS[s.metodo_ingestao] || s.metodo_ingestao}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={s.ativo ? 'success' : 'danger'}>{s.ativo ? 'Ativa' : 'Inativa'}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Abrir ${s.nome} em nova aba`}
                      onClick={() => window.open(s.url_base, '_blank')}
                    >
                      <ExternalLink className="w-4 h-4" aria-hidden="true" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
