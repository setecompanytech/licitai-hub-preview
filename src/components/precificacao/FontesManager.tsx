import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Globe, Search, ExternalLink, CheckCircle, XCircle, Loader2, Filter,
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
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total de Fontes', value: stats.total, color: 'text-foreground' },
          { label: 'Fontes Ativas', value: stats.ativos, color: 'text-success' },
          { label: 'Categorias', value: stats.categorias, color: 'text-foreground' },
          { label: 'Tipos', value: stats.tipos, color: 'text-info' },
        ].map(s => (
          <div key={s.label} className="bg-muted/30 border border-border/30 rounded-lg p-3 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar fonte..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="w-[160px] h-9">
            <Filter className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
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
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas categorias</SelectItem>
            {Object.entries(CATEGORIA_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="outline" className="text-xs">
          {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="border border-border/50 rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-xs">Fonte</TableHead>
                <TableHead className="text-xs">Tipo</TableHead>
                <TableHead className="text-xs">Categoria</TableHead>
                <TableHead className="text-xs">Método</TableHead>
                <TableHead className="text-xs text-center">Status</TableHead>
                <TableHead className="text-xs text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(s => (
                <TableRow key={s.id} className="hover:bg-muted/20">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium">{s.nome}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">{s.url_base}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {TIPO_LABELS[s.tipo] || s.tipo}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {CATEGORIA_LABELS[s.categoria] || s.categoria}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {METODO_LABELS[s.metodo_ingestao] || s.metodo_ingestao}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {s.ativo ? (
                      <CheckCircle className="w-4 h-4 text-success inline-block" />
                    ) : (
                      <XCircle className="w-4 h-4 text-destructive inline-block" />
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => window.open(s.url_base, '_blank')}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
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
