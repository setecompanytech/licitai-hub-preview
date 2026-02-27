import { useState, useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import {
  Search, MapPin, Calendar as CalendarIcon2, Building2, CalendarDays, RefreshCw,
  Sparkles, Globe, Download, FileText, FileSpreadsheet, FileJson, FileArchive,
  FileDown, Loader2, Send, ChevronDown, ChevronUp, Filter, X, Zap, Brain
} from 'lucide-react';
import { downloadCSV, downloadPDF, downloadJSON } from '@/lib/download-utils';
import JSZip from 'jszip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

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
  pncpNumero?: string;
  cnpjOrgao?: string;
  anoCompra?: number;
  sequencialCompra?: number;
  isMock?: boolean;
};

const PORTAIS = [
  { id: 'pncp', nome: 'PNCP (API oficial)', shortName: 'PNCP' },
  { id: 'comprasnet', nome: 'Compras Governamentais', shortName: 'Compras Gov' },
  { id: 'licitacoes-e', nome: 'Licitações-e (BB)', shortName: 'Licitações-e' },
  { id: 'bnc', nome: 'BNC', shortName: 'BNC' },
  { id: 'banparanet', nome: 'Banparanet PA', shortName: 'Banparanet' },
  { id: 'becsp', nome: 'BEC/SP', shortName: 'BEC/SP' },
  { id: 'comprasrj', nome: 'Compras Públicas RJ', shortName: 'Compras RJ' },
  { id: 'licitanet', nome: 'Licitanet', shortName: 'Licitanet' },
  { id: 'bll', nome: 'BLL Compras', shortName: 'BLL' },
  { id: 'portalcompras', nome: 'Portal de Compras Públicas', shortName: 'Portal Compras' },
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

const GENERIC_PORTAL_URLS = [
  'https://www.gov.br/compras/pt-br',
  'https://www.gov.br/compras',
  'https://www.gov.br',
  'https://bnc.org.br',
  'https://www.bec.sp.gov.br',
  'https://www.compras.rj.gov.br',
  'https://licitacoes-e2.bb.com.br/aop-inter-estatico/',
  'https://cotacao.banpara.b.br/portal/Mural.aspx',
  'https://www.licitanet.com.br',
  'https://bllcompras.com',
  'https://www.portaldecompraspublicas.com.br',
  'https://pncp.gov.br',
];

function isGenericPortalUrl(url: string): boolean {
  if (!url) return true;
  const clean = url.replace(/\/+$/, '').split('?')[0].split('#')[0];
  return GENERIC_PORTAL_URLS.some(b => clean === b || clean === b.replace(/\/+$/, ''));
}

const SUGESTOES_RAPIDAS = [
  'Pavimentação asfáltica',
  'Material hospitalar',
  'Serviços de TI',
  'Obras de saneamento',
  'Reforma predial',
  'Equipamentos laboratoriais',
];

export default function LicitacoesTab() {
  const { user } = useAuth();
  const [licitacoes, setLicitacoes] = useState<ResultadoBusca[]>([]);
  const [resultadosBusca, setResultadosBusca] = useState<ResultadoBusca[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [modalidadeFilter, setModalidadeFilter] = useState<string>('all');
  const [regiaoFilter, setRegiaoFilter] = useState<string>('all');
  const [ufFilter, setUfFilter] = useState<string>('all');
  const [dataInicio, setDataInicio] = useState<Date | undefined>();
  const [dataFim, setDataFim] = useState<Date | undefined>();
  const [buscando, setBuscando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [modoResultados, setModoResultados] = useState<'local' | 'busca'>('local');
  const [analiseIA, setAnaliseIA] = useState<string | null>(null);
  const [showAnalise, setShowAnalise] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [portaisSelecionados, setPortaisSelecionados] = useState<string[]>(['pncp']);
  const [downloadingEdital, setDownloadingEdital] = useState<string | null>(null);
  const [comAnaliseIA, setComAnaliseIA] = useState(true);
  const resultadosRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('licitacoes')
      .select('id, numero, orgao, objeto, modalidade, status, valor_estimado, uf, municipio, data_encerramento, portal')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setLicitacoes((data || []).map(d => ({ ...d, portal: d.portal || '-' })) as ResultadoBusca[]);
        setLoading(false);
      });
  }, [user]);

  const togglePortal = (id: string) => {
    setPortaisSelecionados(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const ufsDisponiveis = regiaoFilter === 'all'
    ? Object.values(regioes).flat()
    : regioes[regiaoFilter] || [];

  const handleRegiaoChange = (v: string) => { setRegiaoFilter(v); setUfFilter('all'); };

  const handleBuscaUnificada = async (queryOverride?: string) => {
    if (!user) return;
    const queryText = queryOverride || search;
    if (!queryText.trim()) {
      toast.error('Digite o que deseja buscar');
      return;
    }

    setBuscando(true);
    setProgresso(0);
    setAnaliseIA(null);

    const interval = setInterval(() => {
      setProgresso(p => Math.min(92, p + Math.random() * 8));
    }, 400);

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const portais = portaisSelecionados.length > 0 ? portaisSelecionados : ['pncp'];

      // Launch both searches in parallel for speed
      const [buscaResult, iaResult] = await Promise.allSettled([
        // 1) Standard search
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/busca-licitacoes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            query: queryText,
            uf: ufFilter !== 'all' ? ufFilter : undefined,
            modalidade: modalidadeFilter !== 'all' ? modalidadeFilter : undefined,
            portal: portais.length === 1 ? portais[0] : 'all',
            dataInicio: dataInicio ? dataInicio.toISOString().split('T')[0] : undefined,
            dataFim: dataFim ? dataFim.toISOString().split('T')[0] : undefined,
            pagina: 1,
          }),
        }).then(r => r.ok ? r.json() : null),

        // 2) AI-powered search (if enabled)
        comAnaliseIA
          ? fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/busca-editais-ia`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                query: queryText,
                uf: ufFilter !== 'all' ? ufFilter : undefined,
                portais,
                com_analise_ia: true,
                limite: 30,
              }),
            }).then(r => r.ok ? r.json() : null)
          : Promise.resolve(null),
      ]);

      // Merge results from both sources
      const allResults: ResultadoBusca[] = [];
      const seenIds = new Set<string>();

      // Process standard search results
      if (buscaResult.status === 'fulfilled' && buscaResult.value) {
        const data = buscaResult.value;
        (data.items || []).forEach((item: any, idx: number) => {
          const id = item.id || `std-${idx}`;
          if (!seenIds.has(id)) {
            seenIds.add(id);
            allResults.push({
              id,
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
              pncpNumero: item.numeroControlePNCP || item.pncpNumero || null,
              cnpjOrgao: item.cnpjOrgao || item.orgaoEntidade?.cnpj || null,
            });
          }
        });
      }

      // Process IA search results
      if (iaResult.status === 'fulfilled' && iaResult.value?.success) {
        const iaData = iaResult.value;
        if (iaData.analise_ia) {
          setAnaliseIA(iaData.analise_ia);
          setShowAnalise(true);
        }
        (iaData.resultados || []).forEach((item: any, idx: number) => {
          const key = `${item.numero}-${item.orgao}`.toLowerCase();
          if (!seenIds.has(key)) {
            seenIds.add(key);
            allResults.push({
              id: `ia-${idx}`,
              numero: item.numero || '-',
              orgao: item.orgao || '-',
              objeto: item.titulo || '-',
              modalidade: item.modalidade || 'Não informada',
              status: item.status || 'Publicado',
              valor_estimado: item.valor_estimado || null,
              uf: item.uf || null,
              municipio: item.municipio || null,
              data_encerramento: item.data_abertura || null,
              portal: item.portal || '-',
              url: item.url || null,
              pncpNumero: item.pncp_numero || null,
              cnpjOrgao: item.cnpj_orgao || null,
            });
          }
        });
      }

      setResultadosBusca(allResults);
      setModoResultados('busca');

      const totalPortais = portais.length;
      toast.success(
        `${allResults.length} licitações encontradas em ${totalPortais} portal${totalPortais > 1 ? 'is' : ''}${comAnaliseIA ? ' com análise IA' : ''}`
      );

      // Scroll to results
      setTimeout(() => resultadosRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
    } catch (err) {
      toast.error('Erro ao conectar com o serviço de busca');
      console.error(err);
    } finally {
      clearInterval(interval);
      setProgresso(100);
      setTimeout(() => { setBuscando(false); setProgresso(0); }, 500);
    }
  };

  const handleVoltarLocal = () => {
    setModoResultados('local');
    setResultadosBusca([]);
    setAnaliseIA(null);
  };

  const getExportData = () => {
    const headers = ['Número', 'Objeto', 'Órgão', 'Modalidade', 'Portal', 'UF', 'Município', 'Valor Estimado', 'Encerramento', 'Status'];
    const rows = filtered.map(l => [
      l.numero, l.objeto, l.orgao, l.modalidade, l.portal || '-',
      l.uf || '-', l.municipio || '-',
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
    a.href = url; a.download = `licitacoes-${ts}.zip`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Download ZIP realizado');
  };

  const getLicRow = (l: ResultadoBusca) => [
    l.numero, l.objeto, l.orgao, l.modalidade, l.portal || '-',
    l.uf || '-', l.municipio || '-',
    l.valor_estimado ? formatCurrency(l.valor_estimado) : '-',
    l.data_encerramento ? new Date(l.data_encerramento).toLocaleDateString('pt-BR') : '-',
    l.status,
  ];

  const handleDownloadItem = (lic: ResultadoBusca, tipo: 'csv' | 'pdf' | 'json' | 'zip') => {
    const headers = ['Número', 'Objeto', 'Órgão', 'Modalidade', 'Portal', 'UF', 'Município', 'Valor Estimado', 'Encerramento', 'Status'];
    const row = getLicRow(lic);
    const ts = new Date().toISOString().slice(0, 10);
    const fname = `edital-${lic.numero.replace(/[\/\\]/g, '-')}-${ts}`;
    if (tipo === 'csv') { downloadCSV(fname, headers, [row]); toast.success('CSV baixado'); }
    else if (tipo === 'pdf') { downloadPDF(fname, `Edital ${lic.numero}`, headers, [row]); toast.success('PDF baixado'); }
    else if (tipo === 'json') { downloadJSON(fname, lic); toast.success('JSON baixado'); }
    else {
      const bom = '\uFEFF';
      const csvContent = [headers.join(';'), row.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(';')].join('\n');
      const zip = new JSZip();
      zip.file(`${fname}.csv`, bom + csvContent);
      zip.file(`${fname}.json`, JSON.stringify(lic, null, 2));
      zip.generateAsync({ type: 'blob' }).then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${fname}.zip`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('ZIP baixado');
      });
    }
  };

  const hasEditalDownload = (lic: ResultadoBusca): boolean => {
    if (lic.isMock) return false;
    // Has PNCP data for direct API download
    if (lic.pncpNumero || (lic.cnpjOrgao && lic.anoCompra && lic.sequencialCompra)) return true;
    // Has a specific (non-generic) URL
    if (lic.url && !isGenericPortalUrl(lic.url)) return true;
    // Has enough data for PNCP search fallback
    if (lic.orgao && lic.objeto && lic.orgao !== '-') return true;
    return false;
  };

  const handleDownloadEditalPortal = async (lic: ResultadoBusca) => {
    if (lic.isMock) {
      toast.warning('Dados simulados — download funciona apenas com licitações reais.');
      return;
    }
    setDownloadingEdital(lic.id);
    toast.info('Buscando edital nos portais...');
    try {
      const session = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-edital`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.data.session?.access_token}` },
          body: JSON.stringify({
            numero: lic.numero, portal: lic.portal || 'PNCP',
            url: lic.url || null, orgao: lic.orgao, objeto: lic.objeto,
            pncpNumero: lic.pncpNumero || null, cnpjOrgao: lic.cnpjOrgao || null,
            anoCompra: lic.anoCompra || null, sequencialCompra: lic.sequencialCompra || null,
          }),
        }
      );
      const data = await response.json();
      if (!data.success) { toast.error(data.error || 'Não foi possível baixar o edital.'); return; }
      if (data.tipo === 'arquivo_direto') {
        const byteChars = atob(data.arquivo.conteudo_base64);
        const byteNumbers = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
        const blob = new Blob([byteNumbers], { type: data.arquivo.content_type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = data.arquivo.nome;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`Edital "${data.arquivo.nome}" baixado!`);
      } else if (data.tipo === 'download_urls' && data.documentos?.[0]?.url) {
        window.open(data.documentos[0].url, '_blank');
        toast.success(`Baixando "${data.documentos[0].nome}"`);
      }
    } catch { toast.error('Erro ao baixar edital.'); } finally { setDownloadingEdital(null); }
  };

  const dadosExibidos = modoResultados === 'busca' ? resultadosBusca : licitacoes;

  const filtered = dadosExibidos.filter((l) => {
    const s = search.toLowerCase();
    const matchSearch = modoResultados === 'busca' || !s ||
      l.objeto.toLowerCase().includes(s) ||
      l.orgao.toLowerCase().includes(s) ||
      l.numero.toLowerCase().includes(s);
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
    <div className="space-y-4">
      {/* Unified Search */}
      <div className="bg-accent/5 rounded-xl border-2 border-accent/30 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-accent/15 flex items-center justify-center">
              <Zap className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h3 className="font-semibold text-sm flex items-center gap-2">
                Busca Inteligente
                <Badge className="bg-accent text-accent-foreground text-[10px]">IA + Portais</Badge>
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Pesquisa simultânea em {portaisSelecionados.length} portal{portaisSelecionados.length !== 1 ? 'is' : ''} com análise inteligente
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {modoResultados === 'busca' && (
              <Badge variant="outline" className="bg-warning/15 text-warning border-warning/30 text-[10px] cursor-pointer gap-1" onClick={handleVoltarLocal}>
                <X className="w-3 h-3" /> Limpar resultados
              </Badge>
            )}
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
          </div>
        </div>

        {/* Main search input */}
        <form onSubmit={e => { e.preventDefault(); handleBuscaUnificada(); }} className="flex gap-2">
          <div className="relative flex-1">
            <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-accent" />
            <Input
              placeholder="Descreva o que busca: pavimentação em PA, TI acima de 500 mil, material hospitalar SP..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 text-sm bg-background border-accent/20 focus-visible:ring-accent"
              disabled={buscando}
            />
          </div>
          <Button
            type="submit"
            disabled={buscando}
            className="bg-accent hover:bg-accent/90 text-accent-foreground px-5 gap-2"
          >
            {buscando ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Buscando...</>
            ) : (
              <><Send className="w-4 h-4" /> Buscar</>
            )}
          </Button>
        </form>

        {/* Quick suggestions */}
        {modoResultados === 'local' && (
          <div className="flex flex-wrap gap-1.5">
            {SUGESTOES_RAPIDAS.map((s, i) => (
              <button
                key={i}
                onClick={() => { setSearch(s); handleBuscaUnificada(s); }}
                disabled={buscando}
                className="px-3 py-1 rounded-full border border-border/50 bg-background text-xs text-muted-foreground hover:bg-accent/10 hover:text-accent hover:border-accent/30 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Progress */}
        {buscando && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Pesquisando em {portaisSelecionados.length} portais{comAnaliseIA ? ' + análise IA' : ''}...
              </span>
              <span className="font-medium">{Math.round(progresso)}%</span>
            </div>
            <Progress value={progresso} className="h-1.5" />
          </div>
        )}

        {/* Filters toggle + portal selection */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs gap-1.5 h-7 px-2"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-3.5 h-3.5" />
            Filtros avançados ({portaisSelecionados.length} portais)
            {showFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </Button>

          <label className="flex items-center gap-1.5 text-xs cursor-pointer ml-auto">
            <Checkbox
              checked={comAnaliseIA}
              onCheckedChange={(v) => setComAnaliseIA(!!v)}
              className="h-3.5 w-3.5"
            />
            <Brain className="w-3.5 h-3.5 text-accent" />
            <span className="text-muted-foreground">Análise IA</span>
          </label>
        </div>

        {showFilters && (
          <div className="space-y-3 pt-1 border-t border-accent/10">
            {/* Portais */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium">Portais de busca</label>
                <div className="flex gap-2">
                  <Button variant="link" size="sm" className="text-[10px] h-auto p-0" onClick={() => setPortaisSelecionados(PORTAIS.map(p => p.id))}>
                    Marcar todos
                  </Button>
                  <Button variant="link" size="sm" className="text-[10px] h-auto p-0 text-muted-foreground" onClick={() => setPortaisSelecionados([])}>
                    Desmarcar
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5">
                {PORTAIS.map(p => (
                  <label
                    key={p.id}
                    className={cn(
                      'flex items-center gap-1.5 p-2 rounded-lg border text-xs cursor-pointer transition-colors',
                      portaisSelecionados.includes(p.id)
                        ? 'bg-accent/10 border-accent/40 text-accent'
                        : 'bg-muted/30 border-border/30 hover:bg-muted/50'
                    )}
                  >
                    <Checkbox
                      checked={portaisSelecionados.includes(p.id)}
                      onCheckedChange={() => togglePortal(p.id)}
                      className="h-3.5 w-3.5"
                    />
                    <span className="truncate">{p.shortName}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Filters row */}
            <div className="flex flex-wrap items-center gap-2">
              <Select value={regiaoFilter} onValueChange={handleRegiaoChange}>
                <SelectTrigger className="w-[140px] h-8 text-xs bg-background border-border/50">
                  <MapPin className="w-3 h-3 mr-1 text-muted-foreground" /><SelectValue placeholder="Região" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas regiões</SelectItem>
                  {Object.keys(regioes).map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={ufFilter} onValueChange={setUfFilter}>
                <SelectTrigger className="w-[100px] h-8 text-xs bg-background border-border/50"><SelectValue placeholder="UF" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {ufsDisponiveis.sort().map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={modalidadeFilter} onValueChange={setModalidadeFilter}>
                <SelectTrigger className="w-[160px] h-8 text-xs bg-background border-border/50"><SelectValue placeholder="Modalidade" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas modalidades</SelectItem>
                  <SelectItem value="Pregão Eletrônico">Pregão Eletrônico</SelectItem>
                  <SelectItem value="Concorrência">Concorrência</SelectItem>
                  <SelectItem value="Tomada de Preços">Tomada de Preços</SelectItem>
                  <SelectItem value="Dispensa">Dispensa</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px] h-8 text-xs bg-background border-border/50"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos status</SelectItem>
                  {Object.entries(statusConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("h-8 text-xs gap-1", dataInicio && "text-foreground")}>
                    <CalendarDays className="w-3 h-3" />
                    {dataInicio ? format(dataInicio, "dd/MM/yy") : "Início"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dataInicio} onSelect={setDataInicio} locale={ptBR} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("h-8 text-xs gap-1", dataFim && "text-foreground")}>
                    <CalendarDays className="w-3 h-3" />
                    {dataFim ? format(dataFim, "dd/MM/yy") : "Fim"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dataFim} onSelect={setDataFim} locale={ptBR} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              {(dataInicio || dataFim) && (
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setDataInicio(undefined); setDataFim(undefined); }}>
                  Limpar datas
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* AI Analysis */}
      {analiseIA && (
        <div className="bg-accent/5 rounded-xl border border-accent/20 p-4 shadow-sm animate-fade-in">
          <button
            className="flex items-center gap-2 w-full text-left mb-2"
            onClick={() => setShowAnalise(!showAnalise)}
          >
            <Brain className="w-4 h-4 text-accent" />
            <span className="text-sm font-semibold flex-1">Análise da IA</span>
            <Badge variant="outline" className="bg-accent/15 text-accent border-accent/30 text-[10px]">Inteligência Artificial</Badge>
            {showAnalise ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          {showAnalise && (
            <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
              <ReactMarkdown>{analiseIA}</ReactMarkdown>
            </div>
          )}
        </div>
      )}

      {/* Results count */}
      <div ref={resultadosRef} className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {loading ? 'Carregando...' : `${filtered.length} licitações encontradas`}
        </p>
        {modoResultados === 'busca' && (
          <Badge variant="outline" className="text-[10px]">
            Resultados da busca
          </Badge>
        )}
      </div>

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
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {modoResultados === 'local'
                    ? 'Nenhuma licitação salva. Use a busca acima para encontrar oportunidades.'
                    : 'Nenhum resultado encontrado. Tente ampliar os termos ou selecionar mais portais.'}
                </td></tr>
              )}
              {filtered.map((lic, i) => {
                const st = statusConfig[lic.status] || { label: lic.status, className: 'bg-muted text-muted-foreground' };
                return (
                  <tr
                    key={lic.id}
                    className="border-b border-border/30 hover:bg-muted/30 transition-colors cursor-pointer animate-fade-in"
                    style={{ animationDelay: `${i * 30}ms` }}
                    onClick={() => lic.url && window.open(lic.url, '_blank')}
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
                      <Badge variant="outline" className="text-[10px] px-2 py-0.5">{lic.portal || '-'}</Badge>
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
                          {hasEditalDownload(lic) && (
                            <DropdownMenuItem
                              onClick={() => handleDownloadEditalPortal(lic)}
                              className="gap-2 text-xs font-semibold text-accent"
                              disabled={downloadingEdital === lic.id}
                            >
                              {downloadingEdital === lic.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
                              Edital Completo (Portal)
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleDownloadItem(lic, 'csv')} className="gap-2 text-xs"><FileSpreadsheet className="w-3.5 h-3.5" /> CSV</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownloadItem(lic, 'pdf')} className="gap-2 text-xs"><FileText className="w-3.5 h-3.5" /> PDF</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownloadItem(lic, 'json')} className="gap-2 text-xs"><FileJson className="w-3.5 h-3.5" /> JSON</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownloadItem(lic, 'zip')} className="gap-2 text-xs"><FileArchive className="w-3.5 h-3.5" /> ZIP</DropdownMenuItem>
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
