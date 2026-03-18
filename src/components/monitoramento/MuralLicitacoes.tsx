import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  Search, MapPin, Building2, CalendarDays, RefreshCw, Globe, Loader2,
  ExternalLink, DollarSign, FileText, ChevronLeft, ChevronRight, Eye,
  X, AlertTriangle, CheckCircle2, Clock, Gavel, Star, StarOff, Download,
  FileDown, Link2, Package, Scale, ShieldCheck, Info, ListOrdered,
  SlidersHorizontal, ChevronDown, ChevronUp, Landmark
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import MarcarInteresseDialog from '@/components/compromissos/MarcarInteresseDialog';
import { useLicitacaoIntegration } from '@/hooks/useLicitacaoIntegration';

type DetalhePNCP = {
  success: boolean;
  objeto: string;
  orgao: string;
  cnpj_orgao: string;
  unidade_orgao: string;
  modalidade: string;
  modo_disputa: string | null;
  criterio_julgamento: string | null;
  tipo_contratacao: string | null;
  tipo_instrumento_convocatorio: string | null;
  srp: boolean;
  informacao_complementar: string | null;
  processo_administrativo: string | null;
  situacao: string;
  valor_total_estimado: number | null;
  valor_total_homologado: number | null;
  data_publicacao_pncp: string | null;
  data_abertura_proposta: string | null;
  data_encerramento_proposta: string | null;
  uf: string;
  municipio: string;
  link_sistema_origem: string | null;
  numero_compra: string;
  numero_controle_pncp: string;
  itens: Array<{
    numero: number;
    descricao: string;
    quantidade: number;
    unidade_medida: string;
    valor_unitario_estimado: number;
    valor_total: number;
    criterio_julgamento_item: string | null;
    situacao: string;
    tipo_beneficio: string | null;
    fornecedor_nome: string | null;
    marca: string | null;
  }>;
  total_itens: number;
  url_pncp: string;
  fonte: string;
  consultado_em: string;
};

type LicitacaoMural = {
  id: string;
  numero: string;
  orgao: string;
  objeto: string;
  modalidade: string;
  status: string;
  valor_estimado: number | null;
  uf: string | null;
  municipio: string | null;
  data_abertura: string | null;
  data_encerramento: string | null;
  data_publicacao: string | null;
  portal: string;
  url: string | null;
  pncpNumero: string | null;
  cnpjOrgao: string | null;
  anoCompra: string | null;
  sequencialCompra: string | null;
  // Campos adicionais para filtros client-side
  esferaNome: string | null;
  tipoInstrumentoNome: string | null;
  unidadeOrgao: string | null;
};

const UFS_BRASIL = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
  'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'
];

const MODALIDADES = [
  { value: 'pregão eletrônico', label: 'Pregão Eletrônico', cod: 6 },
  { value: 'concorrência', label: 'Concorrência', cod: 4 },
  { value: 'concorrência - eletrônica', label: 'Concorrência Eletrônica', cod: 5 },
  { value: 'dispensa de licitação', label: 'Dispensa de Licitação', cod: 7 },
  { value: 'inexigibilidade', label: 'Inexigibilidade', cod: 8 },
  { value: 'credenciamento', label: 'Credenciamento', cod: 11 },
  { value: 'leilão', label: 'Leilão', cod: 1 },
  { value: 'diálogo competitivo', label: 'Diálogo Competitivo', cod: 2 },
  { value: 'concurso', label: 'Concurso', cod: 3 },
  { value: 'manifestação de interesse', label: 'Manifestação de Interesse', cod: 9 },
  { value: 'pré-qualificação', label: 'Pré-qualificação', cod: 10 },
  { value: 'leilão - eletrônico', label: 'Leilão Eletrônico', cod: 12 },
  { value: 'concurso - eletrônico', label: 'Concurso Eletrônico', cod: 13 },
];

const TIPOS_INSTRUMENTO = [
  { value: 'edital', label: 'Edital' },
  { value: 'aviso_contratacao_direta', label: 'Aviso de Contratação Direta' },
  { value: 'ato_adesao', label: 'Ato que Autoriza Adesão' },
  { value: 'aviso_dispensa', label: 'Aviso de Dispensa de Licitação' },
];

const ESFERAS = [
  { value: 'federal', label: 'Federal' },
  { value: 'estadual', label: 'Estadual' },
  { value: 'municipal', label: 'Municipal' },
  { value: 'distrital', label: 'Distrital' },
];

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const statusColor = (status: string) => {
  const s = status.toLowerCase();
  if (s.includes('divulgad') || s.includes('publicad') || s.includes('aberta')) return 'bg-info/10 text-info border-info/20';
  if (s.includes('homologad')) return 'bg-success/10 text-success border-success/20';
  if (s.includes('encerrad') || s.includes('fechad')) return 'bg-muted text-muted-foreground border-border';
  if (s.includes('revogad') || s.includes('cancel') || s.includes('anulad')) return 'bg-destructive/10 text-destructive border-destructive/20';
  if (s.includes('suspens')) return 'bg-warning/10 text-warning border-warning/20';
  return 'bg-accent/10 text-accent border-accent/20';
};

// Build PNCP portal URL
function buildPncpUrl(lic: LicitacaoMural): string | null {
  if (lic.cnpjOrgao && lic.anoCompra && lic.sequencialCompra) {
    return `https://pncp.gov.br/app/editais/${lic.cnpjOrgao}/${lic.anoCompra}/${lic.sequencialCompra}`;
  }
  return null;
}

export default function MuralLicitacoes() {
  const { user } = useAuth();
  const { iniciarProcesso } = useLicitacaoIntegration();
  const [licitacoes, setLicitacoes] = useState<LicitacaoMural[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagina, setPagina] = useState(1);
  const [totalResultados, setTotalResultados] = useState(0);

  // Filtros principais
  const [ufFiltro, setUfFiltro] = useState<string>('all');
  const [modalidadeFiltro, setModalidadeFiltro] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchSubmitted, setSearchSubmitted] = useState('');
  const [dataInicio, setDataInicio] = useState<Date | undefined>(undefined);
  const [dataFim, setDataFim] = useState<Date | undefined>(undefined);
  const [uasgTerm, setUasgTerm] = useState('');
  const [uasgSubmitted, setUasgSubmitted] = useState('');

  // Filtros avançados (estilo PNCP)
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [tipoInstrumentoFiltro, setTipoInstrumentoFiltro] = useState<string>('all');
  const [esferaFiltro, setEsferaFiltro] = useState<string>('all');
  const [municipioFiltro, setMunicipioFiltro] = useState('');
  const [unidadeFiltro, setUnidadeFiltro] = useState('');
  const [orgaoFiltro, setOrgaoFiltro] = useState('');

  // Ficha detail
  const [fichaAberta, setFichaAberta] = useState<LicitacaoMural | null>(null);
  const [interesseDialog, setInteresseDialog] = useState(false);
  const [editalInteresse, setEditalInteresse] = useState<LicitacaoMural | null>(null);
  const [iniciandoProcesso, setIniciandoProcesso] = useState<string | null>(null);

  // Download state
  const [downloading, setDownloading] = useState<string | null>(null);

  // Detalhes PNCP
  const [detalhePncp, setDetalhePncp] = useState<DetalhePNCP | null>(null);
  const [loadingDetalhe, setLoadingDetalhe] = useState(false);

  // Favoritos
  const [favoritos, setFavoritos] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    supabase
      .from('editais_favoritos')
      .select('numero, orgao')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (data) setFavoritos(new Set(data.map(f => `${f.numero}|${f.orgao}`)));
      });

    const channel = supabase
      .channel('mural-favoritos-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'editais_favoritos', filter: `user_id=eq.${user.id}` }, async () => {
        const { data } = await supabase
          .from('editais_favoritos')
          .select('numero, orgao')
          .eq('user_id', user.id);
        if (data) setFavoritos(new Set(data.map(f => `${f.numero}|${f.orgao}`)));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const carregarMural = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/busca-licitacoes`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            query: searchSubmitted || undefined,
            uf: ufFiltro !== 'all' ? ufFiltro : undefined,
            modalidade: modalidadeFiltro !== 'all' ? modalidadeFiltro : undefined,
            dataInicio: dataInicio ? dataInicio.toISOString().split('T')[0] : undefined,
            dataFim: dataFim ? dataFim.toISOString().split('T')[0] : undefined,
            cnpjOrgao: uasgSubmitted || undefined,
            pagina,
            mural: true,
          }),
        }
      );

      if (!response.ok) throw new Error(`Erro ${response.status}`);
      const data = await response.json();

      let items: LicitacaoMural[] = (data.items || []).map((item: any) => ({
        id: item.id,
        numero: item.numero || '-',
        orgao: item.orgao || '-',
        objeto: item.objeto || '-',
        modalidade: item.modalidade || 'Não informada',
        status: item.status || 'Publicado',
        valor_estimado: item.valor_estimado,
        uf: item.uf,
        municipio: item.municipio,
        data_abertura: item.data_abertura,
        data_encerramento: item.data_encerramento || null,
        data_publicacao: item.data_publicacao,
        portal: item.portal || 'PNCP',
        url: item.url,
        pncpNumero: item.pncpNumero,
        cnpjOrgao: item.cnpjOrgao,
        anoCompra: item.anoCompra,
        sequencialCompra: item.sequencialCompra,
        esferaNome: item.esferaNome || null,
        tipoInstrumentoNome: item.tipoInstrumentoNome || null,
        unidadeOrgao: item.unidadeOrgao || null,
      }));

      // Filtros client-side para campos não suportados diretamente pela API
      if (esferaFiltro !== 'all') {
        items = items.filter(i => i.esferaNome?.toLowerCase().includes(esferaFiltro.toLowerCase()));
      }
      if (tipoInstrumentoFiltro !== 'all') {
        const tipoLabel = TIPOS_INSTRUMENTO.find(t => t.value === tipoInstrumentoFiltro)?.label || '';
        items = items.filter(i => i.tipoInstrumentoNome?.toLowerCase().includes(tipoLabel.toLowerCase()));
      }
      if (municipioFiltro.trim()) {
        const term = municipioFiltro.trim().toLowerCase();
        items = items.filter(i => i.municipio?.toLowerCase().includes(term));
      }
      if (unidadeFiltro.trim()) {
        const term = unidadeFiltro.trim().toLowerCase();
        items = items.filter(i => i.unidadeOrgao?.toLowerCase().includes(term));
      }
      if (orgaoFiltro.trim()) {
        const term = orgaoFiltro.trim().toLowerCase();
        items = items.filter(i => i.orgao?.toLowerCase().includes(term));
      }

      setLicitacoes(items);
      setTotalResultados(items.length);
    } catch (err) {
      console.error(err);
      setError('Erro ao carregar licitações do PNCP. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [pagina, ufFiltro, modalidadeFiltro, searchSubmitted, dataInicio, dataFim, uasgSubmitted, esferaFiltro, tipoInstrumentoFiltro, municipioFiltro, unidadeFiltro, orgaoFiltro]);

  useEffect(() => {
    if (user) carregarMural();
  }, [carregarMural, user]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagina(1);
    setSearchSubmitted(searchTerm);
    setUasgSubmitted(uasgTerm);
  };

  const handleIniciarProcesso = async (lic: LicitacaoMural) => {
    setIniciandoProcesso(lic.id);
    await iniciarProcesso({
      numero: lic.numero,
      orgao: lic.orgao,
      objeto: lic.objeto,
      modalidade: lic.modalidade,
      valor_estimado: lic.valor_estimado,
      uf: lic.uf,
      municipio: lic.municipio,
      data_encerramento: lic.data_abertura,
      portal: lic.portal,
      url: lic.url || undefined,
    });
    setIniciandoProcesso(null);
  };

  // Download edital via edge function
  const handleDownloadEdital = async (lic: LicitacaoMural) => {
    setDownloading(lic.id);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-edital`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            numero: lic.numero,
            portal: lic.portal,
            url: lic.url,
            orgao: lic.orgao,
            objeto: lic.objeto,
            cnpjOrgao: lic.cnpjOrgao,
            pncpNumero: lic.pncpNumero,
            anoCompra: lic.anoCompra,
            sequencialCompra: lic.sequencialCompra,
          }),
        }
      );

      const data = await resp.json();

      if (!resp.ok || !data.success) {
        // If download failed, offer direct link to PNCP
        const pncpUrl = buildPncpUrl(lic);
        if (pncpUrl) {
          toast.info('Documento não disponível via API. Abrindo portal PNCP...', { duration: 4000 });
          window.open(pncpUrl, '_blank');
        } else if (lic.url) {
          toast.info('Abrindo portal do edital...', { duration: 3000 });
          window.open(lic.url, '_blank');
        } else {
          toast.error(data.error || 'Não foi possível baixar o edital.');
        }
        return;
      }

      if (data.tipo === 'arquivo_direto' && data.arquivo?.conteudo_base64) {
        // Direct download via base64
        const byteCharacters = atob(data.arquivo.conteudo_base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: data.arquivo.content_type || 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = data.arquivo.nome || 'edital.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`✅ ${data.arquivo.nome} baixado com sucesso!`);
      } else if (data.tipo === 'download_urls' && data.documentos?.length > 0) {
        // Open first document URL directly
        window.open(data.documentos[0].url, '_blank');
        toast.success(`📄 ${data.documentos.length} documento(s) encontrado(s). Abrindo download...`);
      } else {
        const pncpUrl = buildPncpUrl(lic);
        if (pncpUrl) {
          window.open(pncpUrl, '_blank');
          toast.info('Abrindo ficha no PNCP...');
        }
      }
    } catch (err) {
      console.error('Download error:', err);
      toast.error('Erro ao tentar baixar o edital.');
    } finally {
      setDownloading(null);
    }
  };

  const toggleFavorito = async (lic: LicitacaoMural) => {
    if (!user) return;
    const key = `${lic.numero}|${lic.orgao}`;
    try {
      if (favoritos.has(key)) {
        await supabase.from('editais_favoritos').delete().eq('user_id', user.id).eq('numero', lic.numero).eq('orgao', lic.orgao);
        setFavoritos(prev => { const n = new Set(prev); n.delete(key); return n; });
        toast.success('Removido dos favoritos');
      } else {
        await supabase.from('editais_favoritos').insert({
          user_id: user.id, numero: lic.numero, orgao: lic.orgao, objeto: lic.objeto,
          modalidade: lic.modalidade, portal: lic.portal, uf: lic.uf, municipio: lic.municipio,
          valor_estimado: lic.valor_estimado, data_abertura: lic.data_abertura, url: lic.url,
        });
        setFavoritos(prev => new Set(prev).add(key));
        toast.success('⭐ Adicionado aos favoritos!');
      }
    } catch { toast.error('Erro ao favoritar'); }
  };

  // ── Fetch detalhe PNCP when ficha opens ──
  useEffect(() => {
    if (!fichaAberta || !fichaAberta.cnpjOrgao || !fichaAberta.anoCompra || !fichaAberta.sequencialCompra) {
      setDetalhePncp(null);
      return;
    }

    const fetchDetalhe = async () => {
      setLoadingDetalhe(true);
      setDetalhePncp(null);
      try {
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        const resp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/detalhe-licitacao-pncp`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              cnpjOrgao: fichaAberta.cnpjOrgao,
              anoCompra: fichaAberta.anoCompra,
              sequencialCompra: fichaAberta.sequencialCompra,
            }),
          }
        );
        if (resp.ok) {
          const data = await resp.json();
          if (data.success) setDetalhePncp(data);
        }
      } catch (err) {
        console.error('Erro ao buscar detalhes PNCP:', err);
      } finally {
        setLoadingDetalhe(false);
      }
    };

    fetchDetalhe();
  }, [fichaAberta]);

  // ── Ficha view with REAL PNCP data ──
  if (fichaAberta) {
    const lic = fichaAberta;
    const isFav = favoritos.has(`${lic.numero}|${lic.orgao}`);
    const pncpUrl = buildPncpUrl(lic);
    const portalUrl = lic.url || pncpUrl;
    const isDownloading = downloading === lic.id;
    const d = detalhePncp; // shorthand for detail data

    const formatDate = (dateStr: string | null) => {
      if (!dateStr) return 'Não informada';
      try {
        let normalized = dateStr;
        // Date-only string (e.g. "2026-03-16") — treat as Brasília local date, show without time
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          // Append T12:00 to avoid midnight UTC→previous day issue, then show date only
          const d = new Date(dateStr + 'T12:00:00-03:00');
          if (isNaN(d.getTime())) return dateStr;
          return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' });
        }
        // PNCP returns datetimes in Brasília time without timezone indicator.
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(dateStr) && !dateStr.includes('+') && !dateStr.includes('Z') && !/\-\d{2}:\d{2}$/.test(dateStr)) {
          normalized = dateStr + '-03:00'; // Brasília UTC-3
        }
        const date = new Date(normalized);
        if (isNaN(date.getTime())) return dateStr;
        return date.toLocaleDateString('pt-BR', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
          timeZone: 'America/Sao_Paulo',
        });
      } catch { return dateStr; }
    };

    return (
      <div className="space-y-4 animate-fade-in">
        <Button variant="ghost" size="sm" onClick={() => { setFichaAberta(null); setDetalhePncp(null); }} className="gap-1.5 text-sm">
          <ChevronLeft className="w-4 h-4" /> Voltar ao Mural
        </Button>

        <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="bg-accent/10 border-b border-accent/20 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
                  <Gavel className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h2 className="font-bold text-lg">Ficha da Licitação</h2>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-success" />
                    Dados extraídos em tempo real da API oficial do PNCP
                    {d && <Badge className="bg-success/10 text-success border-success/30 text-[9px] ml-1">Verificado ✓</Badge>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={cn('text-xs', statusColor(d?.situacao || lic.status))}>{d?.situacao || lic.status}</Badge>
                <button onClick={() => toggleFavorito(lic)} className={cn('p-2 rounded-md transition-colors', isFav ? 'text-warning bg-warning/10' : 'text-muted-foreground hover:text-warning')}>
                  {isFav ? <Star className="w-5 h-5 fill-current" /> : <StarOff className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 space-y-6">
            {/* Loading indicator */}
            {loadingDetalhe && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
                <Loader2 className="w-4 h-4 animate-spin" />
                Consultando dados detalhados do PNCP...
              </div>
            )}

            {/* Objeto */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Objeto</label>
              <p className="text-sm mt-1 leading-relaxed">{d?.objeto || lic.objeto}</p>
            </div>

            {/* ── DADOS CRÍTICOS DO PROCESSO (novos, vindos da API detalhada) ── */}
            {d && (d.modo_disputa || d.criterio_julgamento || d.srp || d.tipo_instrumento_convocatorio) && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                  <Scale className="w-4 h-4" /> Dados do Processo Licitatório
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {d.modo_disputa && (
                    <InfoField icon={<Scale className="w-4 h-4" />} label="Modo de Disputa" value={d.modo_disputa} highlight />
                  )}
                  {d.criterio_julgamento && (
                    <InfoField icon={<Gavel className="w-4 h-4" />} label="Critério de Julgamento" value={d.criterio_julgamento} highlight />
                  )}
                  {d.tipo_instrumento_convocatorio && (
                    <InfoField icon={<FileText className="w-4 h-4" />} label="Instrumento Convocatório" value={d.tipo_instrumento_convocatorio} />
                  )}
                  {d.tipo_contratacao && (
                    <InfoField icon={<Package className="w-4 h-4" />} label="Tipo de Contratação" value={d.tipo_contratacao} />
                  )}
                  <InfoField icon={<ListOrdered className="w-4 h-4" />} label="Registro de Preços (SRP)" value={d.srp ? 'Sim — Sistema de Registro de Preços' : 'Não'} highlight={d.srp} />
                  {d.processo_administrativo && (
                    <InfoField icon={<FileText className="w-4 h-4" />} label="Processo Administrativo" value={d.processo_administrativo} />
                  )}
                </div>
              </div>
            )}

            {/* Grid dados básicos */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <InfoField icon={<FileText className="w-4 h-4" />} label="Número da Compra" value={d?.numero_compra || lic.numero} />
              <InfoField icon={<Building2 className="w-4 h-4" />} label="Órgão" value={d?.orgao || lic.orgao} />
              <InfoField icon={<Gavel className="w-4 h-4" />} label="Modalidade" value={d?.modalidade || lic.modalidade} />
              <InfoField icon={<MapPin className="w-4 h-4" />} label="Localização" value={
                (d?.municipio || lic.municipio) && (d?.uf || lic.uf)
                  ? `${d?.municipio || lic.municipio}/${d?.uf || lic.uf}`
                  : d?.uf || lic.uf || 'Não informada'
              } />
              <InfoField icon={<DollarSign className="w-4 h-4" />} label="Valor Total Estimado" value={
                (d?.valor_total_estimado || lic.valor_estimado) ? formatCurrency(d?.valor_total_estimado || lic.valor_estimado!) : 'Não informado'
              } highlight={!!(d?.valor_total_estimado || lic.valor_estimado)} />
              {d?.valor_total_homologado && d.valor_total_homologado > 0 && (
                <InfoField icon={<DollarSign className="w-4 h-4" />} label="Valor Total Homologado" value={formatCurrency(d.valor_total_homologado)} highlight />
              )}
              <InfoField icon={<CalendarDays className="w-4 h-4" />} label="Início de Recebimento de Propostas" value={formatDate(d?.data_abertura_proposta || lic.data_abertura)} />
              <InfoField icon={<CalendarDays className="w-4 h-4" />} label="Fim de Recebimento de Propostas" value={formatDate(d?.data_encerramento_proposta || lic.data_encerramento)} />
              <InfoField icon={<CalendarDays className="w-4 h-4" />} label="Publicação no PNCP" value={formatDate(d?.data_publicacao_pncp || lic.data_publicacao)} />
              <InfoField icon={<Globe className="w-4 h-4" />} label="Portal" value={lic.portal} />
              {(d?.numero_controle_pncp || lic.pncpNumero) && (
                <InfoField icon={<FileText className="w-4 h-4" />} label="Nº Controle PNCP" value={d?.numero_controle_pncp || lic.pncpNumero!} />
              )}
              {(d?.cnpj_orgao || lic.cnpjOrgao) && (
                <InfoField icon={<Building2 className="w-4 h-4" />} label="CNPJ do Órgão" value={(d?.cnpj_orgao || lic.cnpjOrgao!).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')} />
              )}
              {d?.unidade_orgao && (
                <InfoField icon={<Building2 className="w-4 h-4" />} label="Unidade Compradora" value={d.unidade_orgao} />
              )}
            </div>

            {/* Informação complementar */}
            {d?.informacao_complementar && (
              <div className="bg-muted/30 rounded-lg p-4">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
                  <Info className="w-3.5 h-3.5" /> Informação Complementar
                </label>
                <p className="text-xs leading-relaxed whitespace-pre-wrap">{d.informacao_complementar}</p>
              </div>
            )}

            {/* ── ITENS DA LICITAÇÃO (dados reais do PNCP) ── */}
            {d && d.itens.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-accent" />
                  Itens da Licitação ({d.total_itens} {d.total_itens === 1 ? 'item' : 'itens'})
                  <Badge className="bg-success/10 text-success border-success/30 text-[9px]">Dados reais PNCP</Badge>
                </h3>
                <div className="border border-border/50 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/50 border-b border-border/50">
                          <th className="px-3 py-2 text-left font-semibold text-muted-foreground">#</th>
                          <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Descrição</th>
                          <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Qtd</th>
                          <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Unid</th>
                          <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Vlr. Unit. Est.</th>
                          <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Vlr. Total</th>
                          <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Situação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.itens.slice(0, 50).map((item, idx) => (
                          <tr key={idx} className="border-b border-border/20 hover:bg-muted/20">
                            <td className="px-3 py-2 font-mono text-muted-foreground">{item.numero}</td>
                            <td className="px-3 py-2 max-w-[300px]">
                              <span className="line-clamp-2">{item.descricao}</span>
                              {item.marca && <span className="text-muted-foreground ml-1">(Marca: {item.marca})</span>}
                            </td>
                            <td className="px-3 py-2 text-right">{item.quantidade?.toLocaleString('pt-BR')}</td>
                            <td className="px-3 py-2">{item.unidade_medida}</td>
                            <td className="px-3 py-2 text-right font-mono">
                              {item.valor_unitario_estimado > 0 ? formatCurrency(item.valor_unitario_estimado) : '-'}
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-semibold">
                              {item.valor_total > 0 ? formatCurrency(item.valor_total) : '-'}
                            </td>
                            <td className="px-3 py-2">
                              <Badge variant="outline" className="text-[9px]">{item.situacao || '-'}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {d.itens.length > 50 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground bg-muted/30 text-center">
                      Exibindo 50 de {d.total_itens} itens. Acesse o PNCP para ver todos.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Links diretos */}
            {(portalUrl || pncpUrl || d?.link_sistema_origem) && (
              <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5" /> Links Diretos
                </label>
                <div className="space-y-1">
                  {(d?.url_pncp || pncpUrl) && (
                    <a href={d?.url_pncp || pncpUrl!} target="_blank" rel="noopener noreferrer"
                       className="text-xs text-accent hover:underline flex items-center gap-1.5 break-all">
                      <Globe className="w-3.5 h-3.5 flex-shrink-0" /> {d?.url_pncp || pncpUrl}
                    </a>
                  )}
                  {d?.link_sistema_origem && d.link_sistema_origem !== (d?.url_pncp || pncpUrl) && (
                    <a href={d.link_sistema_origem} target="_blank" rel="noopener noreferrer"
                       className="text-xs text-accent hover:underline flex items-center gap-1.5 break-all">
                      <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" /> {d.link_sistema_origem}
                    </a>
                  )}
                  {lic.url && lic.url !== (d?.url_pncp || pncpUrl) && lic.url !== d?.link_sistema_origem && (
                    <a href={lic.url} target="_blank" rel="noopener noreferrer"
                       className="text-xs text-accent hover:underline flex items-center gap-1.5 break-all">
                      <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" /> {lic.url}
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Fonte e timestamp */}
            {d && (
              <div className="text-[10px] text-muted-foreground/60 flex items-center gap-2 pt-2">
                <ShieldCheck className="w-3 h-3" />
                Fonte: {d.fonte} • Consultado em: {new Date(d.consultado_em).toLocaleString('pt-BR')}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-3 pt-4 border-t border-border/50">
              <Button
                className="bg-accent hover:bg-accent/90 text-accent-foreground gap-2"
                onClick={() => handleDownloadEdital(lic)}
                disabled={isDownloading}
              >
                {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                {isDownloading ? 'Baixando...' : 'Baixar Edital'}
              </Button>

              {portalUrl && (
                <Button variant="outline" className="gap-2" asChild>
                  <a href={portalUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4" /> Acessar no Portal
                  </a>
                </Button>
              )}
              <Button variant="outline" className="gap-2 text-success border-success/30 hover:bg-success/10" onClick={() => { setEditalInteresse(lic); setInteresseDialog(true); }}>
                <CheckCircle2 className="w-4 h-4" /> Marcar Interesse
              </Button>
              <Button
                variant="outline"
                className="gap-2 text-accent border-accent/30 hover:bg-accent/10"
                onClick={() => handleIniciarProcesso(lic)}
                disabled={iniciandoProcesso === lic.id}
              >
                {iniciandoProcesso === lic.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                Iniciar Processo
              </Button>
            </div>
          </div>
        </div>

        {editalInteresse && (
          <MarcarInteresseDialog
            open={interesseDialog}
            onOpenChange={setInteresseDialog}
            edital={{
              numero: editalInteresse.numero, orgao: editalInteresse.orgao, objeto: editalInteresse.objeto,
              modalidade: editalInteresse.modalidade, valor_estimado: editalInteresse.valor_estimado,
              uf: editalInteresse.uf, municipio: editalInteresse.municipio,
              data_encerramento: editalInteresse.data_abertura, portal: editalInteresse.portal,
              url: editalInteresse.url || undefined,
            }}
            onSuccess={() => setEditalInteresse(null)}
          />
        )}
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-accent/5 rounded-xl border border-accent/20 p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-accent/15 flex items-center justify-center">
            <Gavel className="w-5 h-5 text-accent" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-sm flex items-center gap-2">
              Mural de Licitações — Tempo Real
              <Badge className="bg-success text-success-foreground text-[10px]">PNCP Oficial</Badge>
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Dados em tempo real da API oficial do Portal Nacional de Contratações Públicas
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={carregarMural} disabled={loading} className="gap-1.5">
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} /> Atualizar
          </Button>
        </div>

        {/* Keyword + UASG search bar */}
        <form onSubmit={handleSearch} className="flex flex-wrap gap-2 mb-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Palavra-chave"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 text-sm"
              disabled={loading}
            />
          </div>
          <div className="relative w-[200px]">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="UASG / CNPJ do Órgão"
              value={uasgTerm}
              onChange={e => setUasgTerm(e.target.value)}
              className="pl-9 text-sm"
              disabled={loading}
            />
          </div>
          <Button type="submit" disabled={loading} className="bg-accent hover:bg-accent/90 text-accent-foreground gap-1.5">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Buscar
          </Button>
        </form>

        {/* ═══ FILTROS (estilo PNCP) ═══ */}
        <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
          <button
            onClick={() => setFiltrosAbertos(!filtrosAbertos)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-2 text-sm font-semibold">
              <SlidersHorizontal className="w-4 h-4 text-accent" />
              FILTROS
              {(tipoInstrumentoFiltro !== 'all' || modalidadeFiltro !== 'all' || orgaoFiltro || unidadeFiltro || ufFiltro !== 'all' || municipioFiltro || esferaFiltro !== 'all' || dataInicio || dataFim) && (
                <Badge className="bg-accent/10 text-accent border-accent/20 text-[9px]">Ativos</Badge>
              )}
            </div>
            {filtrosAbertos ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>

          {filtrosAbertos && (
            <div className="px-4 pb-4 pt-1 space-y-4 border-t border-border/30">
              {/* Row 1: Tipo Instrumento + Modalidade */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Tipos de Instrumento Convocatório</label>
                  <Select value={tipoInstrumentoFiltro} onValueChange={v => { setTipoInstrumentoFiltro(v); setPagina(1); }}>
                    <SelectTrigger className="w-full h-10 text-xs">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {TIPOS_INSTRUMENTO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Modalidades da Contratação</label>
                  <Select value={modalidadeFiltro} onValueChange={v => { setModalidadeFiltro(v); setPagina(1); }}>
                    <SelectTrigger className="w-full h-10 text-xs">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas modalidades</SelectItem>
                      {MODALIDADES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 2: Órgãos + Unidades */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Órgãos</label>
                  <Input
                    placeholder="Digite o nome do órgão..."
                    value={orgaoFiltro}
                    onChange={e => setOrgaoFiltro(e.target.value)}
                    className="text-xs h-10"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Unidades</label>
                  <Input
                    placeholder="Digite o nome da unidade..."
                    value={unidadeFiltro}
                    onChange={e => setUnidadeFiltro(e.target.value)}
                    className="text-xs h-10"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Row 3: UFs + Municípios */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">UFs</label>
                  <Select value={ufFiltro} onValueChange={v => { setUfFiltro(v); setPagina(1); }}>
                    <SelectTrigger className="w-full h-10 text-xs">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os estados</SelectItem>
                      {UFS_BRASIL.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Municípios</label>
                  <Input
                    placeholder="Digite o nome do município..."
                    value={municipioFiltro}
                    onChange={e => setMunicipioFiltro(e.target.value)}
                    className="text-xs h-10"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Row 4: Esferas + Datas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Esferas</label>
                  <Select value={esferaFiltro} onValueChange={v => { setEsferaFiltro(v); setPagina(1); }}>
                    <SelectTrigger className="w-full h-10 text-xs">
                      <Landmark className="w-3 h-3 mr-1 text-muted-foreground" />
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as esferas</SelectItem>
                      {ESFERAS.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Data de início de recebimento de propostas</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full h-10 justify-start text-left text-xs font-normal", !dataInicio && "text-muted-foreground")}>
                          <CalendarDays className="w-3 h-3 mr-1.5" />
                          {dataInicio ? format(dataInicio, "dd/MM/yyyy") : "Selecione"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={dataInicio} onSelect={(d) => { setDataInicio(d); setPagina(1); }} locale={ptBR} initialFocus className={cn("p-3 pointer-events-auto")} />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Data fim de recebimento de propostas</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full h-10 justify-start text-left text-xs font-normal", !dataFim && "text-muted-foreground")}>
                          <CalendarDays className="w-3 h-3 mr-1.5" />
                          {dataFim ? format(dataFim, "dd/MM/yyyy") : "Selecione"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={dataFim} onSelect={(d) => { setDataFim(d); setPagina(1); }} locale={ptBR} disabled={(date) => dataInicio ? date < dataInicio : false} initialFocus className={cn("p-3 pointer-events-auto")} />
                      </PopoverContent>
                    </Popover>
                  </div>
                  {(dataInicio || dataFim) && (
                    <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground flex-shrink-0" onClick={() => { setDataInicio(undefined); setDataFim(undefined); setPagina(1); }}>
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Clear all filters */}
              {(tipoInstrumentoFiltro !== 'all' || modalidadeFiltro !== 'all' || orgaoFiltro || unidadeFiltro || ufFiltro !== 'all' || municipioFiltro || esferaFiltro !== 'all' || dataInicio || dataFim) && (
                <div className="flex justify-end pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs gap-1.5 text-destructive hover:text-destructive"
                    onClick={() => {
                      setTipoInstrumentoFiltro('all'); setModalidadeFiltro('all');
                      setOrgaoFiltro(''); setUnidadeFiltro('');
                      setUfFiltro('all'); setMunicipioFiltro('');
                      setEsferaFiltro('all'); setDataInicio(undefined); setDataFim(undefined);
                      setPagina(1);
                    }}
                  >
                    <X className="w-3 h-3" /> Limpar todos os filtros
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Active filter badges */}
        {(searchSubmitted || uasgSubmitted) && (
          <div className="flex items-center gap-2 flex-wrap mt-3">
            {searchSubmitted && (
              <Badge variant="outline" className="gap-1 text-xs">
                Pesquisa: "{searchSubmitted}"
                <button onClick={() => { setSearchSubmitted(''); setSearchTerm(''); setPagina(1); }}>
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}
            {uasgSubmitted && (
              <Badge variant="outline" className="gap-1 text-xs bg-primary/5 border-primary/20">
                <Building2 className="w-3 h-3" /> UASG/CNPJ: {uasgSubmitted}
                <button onClick={() => { setUasgSubmitted(''); setUasgTerm(''); setPagina(1); }}>
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {loading ? 'Consultando PNCP...' : `${totalResultados} licitações encontradas`}
        </p>
        <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/30 gap-1">
          <Globe className="w-3 h-3" /> Fonte: PNCP (dados oficiais)
        </Badge>
      </div>

      {/* Error */}
      {error && (
        <Card className="p-4 border-destructive/30 bg-destructive/5">
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        </Card>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-4 space-y-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-1/2" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-6 w-20" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Cards grid (TCMPA-style) */}
      {!loading && licitacoes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {licitacoes.map((lic, idx) => {
            const isFav = favoritos.has(`${lic.numero}|${lic.orgao}`);
            const isDownloading = downloading === lic.id;
            return (
              <Card
                key={lic.id}
                className="p-4 hover:shadow-md transition-all border-border/50 hover:border-accent/30 group animate-fade-in"
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                {/* Top row */}
                <div className="flex items-start justify-between mb-2">
                  <Badge className={cn('text-[10px] px-2 py-0.5', statusColor(lic.status))}>{lic.status}</Badge>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={e => { e.stopPropagation(); toggleFavorito(lic); }}
                      className={cn('p-1 rounded transition-colors', isFav ? 'text-warning' : 'text-muted-foreground/30 hover:text-warning/70')}
                    >
                      {isFav ? <Star className="w-3.5 h-3.5 fill-current" /> : <StarOff className="w-3.5 h-3.5" />}
                    </button>
                    <Badge variant="outline" className="text-[9px]">{lic.portal}</Badge>
                  </div>
                </div>

                {/* Número */}
                <p className="text-[10px] font-mono text-muted-foreground mb-1">{lic.numero}</p>

                {/* Objeto */}
                <p className="text-sm font-medium line-clamp-2 mb-3 group-hover:text-accent transition-colors cursor-pointer" onClick={() => setFichaAberta(lic)}>{lic.objeto}</p>

                {/* Órgão */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                  <Building2 className="w-3 h-3 flex-shrink-0" />
                  <span className="line-clamp-1">{lic.orgao}</span>
                </div>

                {/* Localização */}
                {(lic.municipio || lic.uf) && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    <span>{lic.municipio ? `${lic.municipio}/${lic.uf}` : lic.uf}</span>
                  </div>
                )}

                {/* Bottom row */}
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/30">
                  <div className="flex items-center gap-1.5 text-xs">
                    <DollarSign className="w-3 h-3 text-success" />
                    <span className="font-semibold text-success">
                      {lic.valor_estimado ? formatCurrency(lic.valor_estimado) : 'N/I'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {lic.data_abertura ? new Date(lic.data_abertura).toLocaleDateString('pt-BR') : 'N/I'}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border/20">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs gap-1.5 h-8"
                    onClick={() => setFichaAberta(lic)}
                  >
                    <Eye className="w-3.5 h-3.5" /> Ver Ficha
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs gap-1.5 h-8 text-accent border-accent/30 hover:bg-accent/10"
                    onClick={() => handleDownloadEdital(lic)}
                    disabled={isDownloading}
                  >
                    {isDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                    {isDownloading ? 'Baixando...' : 'Edital'}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!loading && licitacoes.length === 0 && !error && (
        <Card className="p-8 text-center">
          <Gavel className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma licitação encontrada para os filtros selecionados.</p>
          <p className="text-xs text-muted-foreground mt-1">Tente ajustar a UF, modalidade ou termo de pesquisa.</p>
        </Card>
      )}

      {/* Pagination */}
      {!loading && licitacoes.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Página {pagina} • {totalResultados} resultado(s)
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={pagina <= 1} onClick={() => setPagina(p => p - 1)} className="gap-1">
              <ChevronLeft className="w-3.5 h-3.5" /> Anterior
            </Button>
            <Button variant="outline" size="sm" disabled={licitacoes.length < 50} onClick={() => setPagina(p => p + 1)} className="gap-1">
              Próxima <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {editalInteresse && (
        <MarcarInteresseDialog
          open={interesseDialog}
          onOpenChange={setInteresseDialog}
          edital={{
            numero: editalInteresse.numero, orgao: editalInteresse.orgao, objeto: editalInteresse.objeto,
            modalidade: editalInteresse.modalidade, valor_estimado: editalInteresse.valor_estimado,
            uf: editalInteresse.uf, municipio: editalInteresse.municipio,
            data_encerramento: editalInteresse.data_abertura, portal: editalInteresse.portal,
            url: editalInteresse.url || undefined,
          }}
          onSuccess={() => setEditalInteresse(null)}
        />
      )}
    </div>
  );
}

function InfoField({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-muted/30 rounded-lg p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <p className={cn('text-sm', highlight && 'font-bold text-success')}>{value}</p>
    </div>
  );
}
