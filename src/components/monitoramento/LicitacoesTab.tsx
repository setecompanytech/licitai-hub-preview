import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { Search, MapPin, Calendar as CalendarIcon2, Building2, CalendarDays, RefreshCw, Sparkles, ExternalLink, Globe, Download, FileText, FileSpreadsheet, FileJson, FileArchive, FileDown, Loader2 } from 'lucide-react';
import { downloadCSV, downloadPDF, downloadJSON } from '@/lib/download-utils';
import JSZip from 'jszip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

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
  portal?: string | null;
};

type ResultadoBusca = {
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
  portal: string;
  url?: string;
};

const PORTAIS = [
  { id: 'pncp', nome: 'PNCP', url: 'https://pncp.gov.br/app/editais?pagina=1' },
  { id: 'comprasnet', nome: 'Compras Governamentais', url: 'https://www.gov.br/compras/pt-br' },
  { id: 'licitacoes-e', nome: 'Licitações-e (BB)', url: 'https://licitacoes-e2.bb.com.br/aop-inter-estatico/' },
  { id: 'bnc', nome: 'BNC', url: 'https://bnc.org.br/' },
  { id: 'banparanet', nome: 'Banparanet PA', url: 'https://cotacao.banpara.b.br/portal/Mural.aspx' },
  { id: 'becsp', nome: 'BEC/SP', url: 'https://www.bec.sp.gov.br/BECSP/Home/Home.aspx' },
  { id: 'comprasrj', nome: 'Compras Públicas RJ', url: 'https://www.compras.rj.gov.br/' },
];

const regioes: Record<string, string[]> = {
  'Norte': ['AC', 'AM', 'AP', 'PA', 'RO', 'RR', 'TO'],
  'Nordeste': ['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE'],
  'Centro-Oeste': ['DF', 'GO', 'MS', 'MT'],
  'Sudeste': ['ES', 'MG', 'RJ', 'SP'],
  'Sul': ['PR', 'RS', 'SC'],
};

const statusConfig: Record<string, { label: string; className: string }> = {
  'Publicado': { label: 'Publicado', className: 'bg-info/10 text-info border-info/20' },
  'Em Análise': { label: 'Em Análise', className: 'bg-warning/10 text-warning border-warning/20' },
  'Proposta Enviada': { label: 'Proposta Enviada', className: 'bg-accent/10 text-accent border-accent/20' },
  'Vencida': { label: 'Vencida', className: 'bg-success/10 text-success border-success/20' },
  'Homologada': { label: 'Homologada', className: 'bg-success/10 text-success border-success/20' },
  'Perdida': { label: 'Perdida', className: 'bg-destructive/10 text-destructive border-destructive/20' },
};

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export default function LicitacoesTab() {
  const { user } = useAuth();
  const [licitacoes, setLicitacoes] = useState<Licitacao[]>([]);
  const [resultadosBusca, setResultadosBusca] = useState<ResultadoBusca[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [modalidadeFilter, setModalidadeFilter] = useState<string>('all');
  const [portalFilter, setPortalFilter] = useState<string>('all');
  const [regiaoFilter, setRegiaoFilter] = useState<string>('all');
  const [ufFilter, setUfFilter] = useState<string>('all');
  const [dataInicio, setDataInicio] = useState<Date | undefined>();
  const [dataFim, setDataFim] = useState<Date | undefined>();
  const [buscando, setBuscando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [buscaAvancada, setBuscaAvancada] = useState('');
  const [buscandoIA, setBuscandoIA] = useState(false);
  const [modoResultados, setModoResultados] = useState<'local' | 'busca'>('local');

  useEffect(() => {
    if (!user) return;
    supabase
      .from('licitacoes')
      .select('id, numero, orgao, objeto, modalidade, status, valor_estimado, uf, municipio, data_encerramento, portal')
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

  const handleBuscarLicitacoes = async (queryOverride?: string) => {
    if (!user) return;
    setBuscando(true);
    setProgresso(0);

    const interval = setInterval(() => {
      setProgresso(p => Math.min(90, p + Math.random() * 12));
    }, 500);

    try {
      const queryText = queryOverride || search || 'licitação';

      const portalMap: Record<string, string> = {
        'PNCP': 'pncp',
        'Compras Governamentais': 'comprasnet',
        'Licitações-e (BB)': 'licitacoes-e',
        'BNC': 'bnc',
        'Banparanet PA': 'banparanet',
        'BEC/SP': 'becsp',
        'Compras Públicas RJ': 'comprasrj',
      };

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/busca-licitacoes`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({
            query: queryText,
            uf: ufFilter !== 'all' ? ufFilter : undefined,
            modalidade: modalidadeFilter !== 'all' ? modalidadeFilter : undefined,
            portal: portalFilter !== 'all' ? (portalMap[portalFilter] || portalFilter) : 'all',
            dataInicio: dataInicio ? dataInicio.toISOString().split('T')[0] : undefined,
            dataFim: dataFim ? dataFim.toISOString().split('T')[0] : undefined,
            pagina: 1,
          }),
        }
      );

      if (!response.ok) {
        toast.error('Erro na busca. Tente novamente.');
        return;
      }

      const data = await response.json();
      const items = (data.items || []).map((item: any, idx: number) => ({
        id: item.id || `busca-${idx}`,
        numero: item.numero || item.numeroControlePNCP || '-',
        orgao: item.orgao || item.nomeOrgao || item.orgaoEntidade?.razaoSocial || '-',
        objeto: item.objeto || item.objetoCompra || item.description || '-',
        modalidade: item.modalidade || item.modalidadeNome || 'Não informada',
        status: item.status || 'Publicado',
        valor_estimado: item.valor_estimado || item.valorTotalEstimado || null,
        uf: item.uf || item.unidadeOrgao?.ufSigla || null,
        municipio: item.municipio || item.unidadeOrgao?.municipioNome || null,
        data_encerramento: item.data_encerramento || item.data_abertura || item.dataEncerramentoProposta || null,
        portal: item.portal || data.fonte || 'PNCP',
        url: item.url || item.linkSistemaOrigem || null,
      }));

      setResultadosBusca(items);
      setModoResultados('busca');

      const portaisMsg = data.portais_consultados
        ? data.portais_consultados.join(', ')
        : data.fonte || 'portais';
      toast.success(`${items.length} licitações encontradas em ${portaisMsg}`);
    } catch (err) {
      toast.error('Erro ao conectar com o serviço de busca');
      console.error(err);
    } finally {
      clearInterval(interval);
      setProgresso(100);
      setTimeout(() => { setBuscando(false); setProgresso(0); }, 500);
    }
  };

  const handleBuscaIA = async () => {
    if (!buscaAvancada.trim()) {
      toast.error('Digite termos para a pesquisa avançada');
      return;
    }
    setBuscandoIA(true);
    await handleBuscarLicitacoes(buscaAvancada);
    setBuscandoIA(false);
  };

  const handleVoltarLocal = () => {
    setModoResultados('local');
    setResultadosBusca([]);
  };

  const getExportData = () => {
    const headers = ['Número', 'Objeto', 'Órgão', 'Modalidade', 'Portal', 'UF', 'Município', 'Valor Estimado', 'Encerramento', 'Status'];
    const rows = filtered.map(l => [
      l.numero,
      l.objeto,
      l.orgao,
      l.modalidade,
      l.portal || '-',
      l.uf || '-',
      l.municipio || '-',
      l.valor_estimado ? formatCurrency(l.valor_estimado) : '-',
      l.data_encerramento ? new Date(l.data_encerramento).toLocaleDateString('pt-BR') : '-',
      l.status,
    ]);
    const ts = new Date().toISOString().slice(0, 10);
    return { headers, rows, ts };
  };

  const handleDownload = (tipo: 'csv' | 'pdf' | 'json') => {
    if (filtered.length === 0) { toast.error('Nenhum registro para exportar'); return; }
    const { headers, rows, ts } = getExportData();
    if (tipo === 'csv') downloadCSV(`licitacoes-${ts}`, headers, rows);
    else if (tipo === 'pdf') downloadPDF(`licitacoes-${ts}`, 'Licitações Filtradas', headers, rows);
    else downloadJSON(`licitacoes-${ts}`, filtered);
    toast.success(`Download ${tipo.toUpperCase()} realizado`);
  };

  const handleDownloadZip = async () => {
    if (filtered.length === 0) { toast.error('Nenhum registro para exportar'); return; }
    const { headers, rows, ts } = getExportData();
    const bom = '\uFEFF';
    const csvContent = [headers.join(';'), ...rows.map(r => r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(';'))].join('\n');
    const jsonContent = JSON.stringify(filtered, null, 2);

    const zip = new JSZip();
    zip.file(`licitacoes-${ts}.csv`, bom + csvContent);
    zip.file(`licitacoes-${ts}.json`, jsonContent);
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `licitacoes-${ts}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Download ZIP realizado');
  };

  const getLicRow = (l: Licitacao | ResultadoBusca) => [
    l.numero, l.objeto, l.orgao, l.modalidade, l.portal || '-',
    l.uf || '-', l.municipio || '-',
    l.valor_estimado ? formatCurrency(l.valor_estimado) : '-',
    l.data_encerramento ? new Date(l.data_encerramento).toLocaleDateString('pt-BR') : '-',
    l.status,
  ];

  const [downloadingEdital, setDownloadingEdital] = useState<string | null>(null);

  const handleDownloadItem = (lic: Licitacao | ResultadoBusca, tipo: 'csv' | 'pdf' | 'json' | 'zip') => {
    const headers = ['Número', 'Objeto', 'Órgão', 'Modalidade', 'Portal', 'UF', 'Município', 'Valor Estimado', 'Encerramento', 'Status'];
    const row = getLicRow(lic);
    const ts = new Date().toISOString().slice(0, 10);
    const fname = `edital-${lic.numero.replace(/[\/\\]/g, '-')}-${ts}`;

    if (tipo === 'csv') {
      downloadCSV(fname, headers, [row]);
      toast.success('CSV do edital baixado');
    } else if (tipo === 'pdf') {
      downloadPDF(fname, `Edital ${lic.numero}`, headers, [row]);
      toast.success('PDF do edital baixado');
    } else if (tipo === 'json') {
      downloadJSON(fname, lic);
      toast.success('JSON do edital baixado');
    } else {
      const bom = '\uFEFF';
      const csvContent = [headers.join(';'), row.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(';')].join('\n');
      const jsonContent = JSON.stringify(lic, null, 2);
      const zip = new JSZip();
      zip.file(`${fname}.csv`, bom + csvContent);
      zip.file(`${fname}.json`, jsonContent);
      zip.generateAsync({ type: 'blob' }).then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fname}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('ZIP do edital baixado');
      });
    }
  };

  const handleDownloadEditalPortal = async (lic: Licitacao | ResultadoBusca) => {
    setDownloadingEdital(lic.id);
    try {
      const session = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-edital`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.data.session?.access_token}`,
          },
          body: JSON.stringify({
            numero: lic.numero,
            portal: lic.portal || 'PNCP',
            url: (lic as ResultadoBusca).url || null,
            orgao: lic.orgao,
            objeto: lic.objeto,
          }),
        }
      );

      if (!response.ok) {
        toast.error('Erro ao buscar edital no portal');
        return;
      }

      const data = await response.json();

      if (!data.success) {
        toast.error(data.error || 'Erro ao buscar edital');
        return;
      }

      if (data.tipo === 'arquivo_direto') {
        // Direct file download from base64
        const byteChars = atob(data.arquivo.conteudo_base64);
        const byteNumbers = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
          byteNumbers[i] = byteChars.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: data.arquivo.content_type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = data.arquivo.nome;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`Edital ${lic.numero} baixado com sucesso!`);
      } else if (data.tipo === 'lista_documentos' && data.documentos?.length > 0) {
        // Multiple docs: download first one, show info about others
        const firstDoc = data.documentos[0];
        if (firstDoc.url) {
          window.open(firstDoc.url, '_blank');
          toast.success(`${data.documentos.length} documento(s) encontrado(s). Abrindo download...`);
        } else {
          toast.info(`${data.documentos.length} documento(s) encontrado(s) no ${data.portal}`);
        }
      } else if (data.tipo === 'redirecionamento') {
        // Redirect to portal
        window.open(data.url, '_blank');
        toast.info(data.mensagem || `Redirecionando para o portal ${data.portal}...`);
      }
    } catch (err) {
      console.error('Erro download edital:', err);
      toast.error('Erro ao conectar com o serviço de download');
    } finally {
      setDownloadingEdital(null);
    }
  };

  const dadosExibidos = modoResultados === 'busca' ? resultadosBusca : licitacoes;

  const filtered = dadosExibidos.filter((l) => {
    const s = search.toLowerCase();
    const matchSearch = !s ||
      l.objeto.toLowerCase().includes(s) ||
      l.orgao.toLowerCase().includes(s) ||
      l.numero.toLowerCase().includes(s) ||
      (l.municipio || '').toLowerCase().includes(s) ||
      (l.uf || '').toLowerCase().includes(s);
    const matchStatus = statusFilter === 'all' || l.status === statusFilter;
    const matchModalidade = modalidadeFilter === 'all' || l.modalidade === modalidadeFilter;
    const matchPortal = portalFilter === 'all' || (l.portal || '').toLowerCase().includes(portalFilter.toLowerCase());
    const matchDataInicio = !dataInicio || (l.data_encerramento && new Date(l.data_encerramento) >= dataInicio);
    const matchDataFim = !dataFim || (l.data_encerramento && new Date(l.data_encerramento) <= new Date(dataFim.getTime() + 86400000));
    const matchUf = ufFilter === 'all'
      ? (regiaoFilter === 'all' || ufsDisponiveis.includes(l.uf || ''))
      : l.uf === ufFilter;
    return matchSearch && matchStatus && matchModalidade && matchPortal && matchUf && matchDataInicio && matchDataFim;
  });

  return (
    <div className="space-y-4">
      {/* Header de busca */}
      <div className="bg-card rounded-xl border border-border/50 p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-accent" />
            <h3 className="font-semibold text-sm">Buscar Licitações</h3>
            <Badge variant="outline" className="bg-accent/15 text-accent border-accent/30 text-[10px]">
              {filtered.length} registros
            </Badge>
            {modoResultados === 'busca' && (
              <Badge variant="outline" className="bg-warning/15 text-warning border-warning/30 text-[10px] cursor-pointer" onClick={handleVoltarLocal}>
                ✕ Resultados da busca — Clique para voltar
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="text-xs h-7 px-3 gap-1.5" disabled={filtered.length === 0}>
                  <Download className="w-3.5 h-3.5" /> Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleDownload('csv')} className="gap-2 text-xs">
                  <FileSpreadsheet className="w-3.5 h-3.5" /> CSV / Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDownload('pdf')} className="gap-2 text-xs">
                  <FileText className="w-3.5 h-3.5" /> PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDownload('json')} className="gap-2 text-xs">
                  <FileJson className="w-3.5 h-3.5" /> JSON
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDownloadZip} className="gap-2 text-xs">
                  <FileArchive className="w-3.5 h-3.5" /> ZIP (CSV + JSON)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {PORTAIS.map(p => (
              <Button key={p.id} size="sm" variant="outline" className="text-[10px] h-7 px-2" asChild>
                <a href={p.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-3 h-3 mr-1" /> {p.nome}
                </a>
              </Button>
            ))}
          </div>
        </div>

        {/* Busca manual */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por CNPJ, objeto, órgão, número, município..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 text-xs"
              onKeyDown={e => e.key === 'Enter' && handleBuscarLicitacoes()}
            />
          </div>
          <Button
            onClick={() => handleBuscarLicitacoes()}
            disabled={buscando}
            size="sm"
            className="bg-accent hover:bg-accent/90 text-accent-foreground shrink-0"
          >
            {buscando ? (
              <><RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" /> Buscando...</>
            ) : (
              <><Search className="w-3.5 h-3.5 mr-1" /> Buscar</>
            )}
          </Button>
        </div>

        {buscando && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Pesquisando licitações nos portais...</span>
              <span>{Math.round(progresso)}%</span>
            </div>
            <Progress value={progresso} className="h-1.5" />
          </div>
        )}

        {/* Pesquisa avançada com IA */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-accent" />
            <Input
              placeholder="Pesquisa avançada com IA (ex: pavimentação, saneamento, TI, infraestrutura...)"
              value={buscaAvancada}
              onChange={e => setBuscaAvancada(e.target.value)}
              className="pl-9 text-xs"
              onKeyDown={e => e.key === 'Enter' && handleBuscaIA()}
            />
          </div>
          <Button
            onClick={handleBuscaIA}
            disabled={buscandoIA || buscando}
            size="sm"
            variant="outline"
            className="shrink-0"
          >
            {buscandoIA ? (
              <><RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" /> Buscando...</>
            ) : (
              <><Sparkles className="w-3.5 h-3.5 mr-1" /> Pesquisar com IA</>
            )}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={portalFilter} onValueChange={setPortalFilter}>
          <SelectTrigger className="w-[200px] bg-card border-border/50">
            <Globe className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" /><SelectValue placeholder="Portal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os portais</SelectItem>
            {PORTAIS.map(p => <SelectItem key={p.id} value={p.nome}>{p.nome}</SelectItem>)}
          </SelectContent>
        </Select>
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
        <Button
          onClick={() => handleBuscarLicitacoes()}
          disabled={buscando}
          className="bg-accent hover:bg-accent/90 text-accent-foreground h-10 px-4"
        >
          {buscando ? (
            <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Buscando...</>
          ) : (
            <><Search className="w-4 h-4 mr-2" /> Buscar nos Portais</>
          )}
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        {loading ? 'Carregando...' : `${filtered.length} licitações encontradas`}
      </p>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Nº / Objeto</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Órgão</th>
                <th className="text-center text-xs font-semibold text-muted-foreground px-4 py-3">Portal</th>
                <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Valor</th>
                <th className="text-center text-xs font-semibold text-muted-foreground px-4 py-3">Encerramento</th>
                <th className="text-center text-xs font-semibold text-muted-foreground px-4 py-3">Status</th>
                <th className="text-center text-xs font-semibold text-muted-foreground px-4 py-3">Download</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && !loading && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhuma licitação encontrada. Use a busca acima para pesquisar nos portais.</td></tr>
              )}
              {filtered.map((lic, i) => {
                const st = statusConfig[lic.status] || { label: lic.status, className: 'bg-muted text-muted-foreground' };
                const url = (lic as ResultadoBusca).url;
                return (
                  <tr
                    key={lic.id}
                    className="border-b border-border/30 hover:bg-muted/30 transition-colors cursor-pointer animate-fade-in"
                    style={{ animationDelay: `${i * 40}ms` }}
                    onClick={() => url && window.open(url, '_blank')}
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
                      {lic.municipio && lic.uf && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" />{lic.municipio}/{lic.uf}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                        {lic.portal || '-'}
                      </Badge>
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
                      <Badge variant="outline" className={cn('text-[10px] px-2 py-0.5', st.className)}>{st.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] gap-1">
                            <Download className="w-3 h-3" /> Baixar
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={() => handleDownloadEditalPortal(lic)} 
                            className="gap-2 text-xs font-semibold text-accent"
                            disabled={downloadingEdital === lic.id}
                          >
                            {downloadingEdital === lic.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <FileDown className="w-3.5 h-3.5" />
                            )}
                            Edital Completo (Portal)
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownloadItem(lic, 'csv')} className="gap-2 text-xs">
                            <FileSpreadsheet className="w-3.5 h-3.5" /> CSV / Excel
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownloadItem(lic, 'pdf')} className="gap-2 text-xs">
                            <FileText className="w-3.5 h-3.5" /> PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownloadItem(lic, 'json')} className="gap-2 text-xs">
                            <FileJson className="w-3.5 h-3.5" /> JSON
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownloadItem(lic, 'zip')} className="gap-2 text-xs">
                            <FileArchive className="w-3.5 h-3.5" /> ZIP (CSV + JSON)
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
