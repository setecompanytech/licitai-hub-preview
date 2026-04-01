import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  Search, MapPin, Building2, CalendarDays, RefreshCw, Globe, Loader2,
  ExternalLink, DollarSign, FileText, ChevronLeft, ChevronRight, Eye,
  X, AlertTriangle, CheckCircle2, Clock, Gavel, Star, StarOff, Download,
  FileDown, Link2, Package, Scale, ShieldCheck, Info, ListOrdered,
  SlidersHorizontal, ChevronDown, ChevronUp, Landmark, Sparkles
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import MarcarInteresseDialog from '@/components/compromissos/MarcarInteresseDialog';
import { useLicitacaoIntegration } from '@/hooks/useLicitacaoIntegration';
import { REGIOES_ESTADOS } from '@/data/regioes-brasil';

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
  amparo_legal: string | null;
  fonte_orcamentaria: string | null;
  fonte_sistema: string | null;
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

  // Busca direta por URL/Número PNCP
  const [buscaDiretaAberta, setBuscaDiretaAberta] = useState(false);
  const [buscaDiretaTerm, setBuscaDiretaTerm] = useState('');
  const [loadingBuscaDireta, setLoadingBuscaDireta] = useState(false);

  // Filtros avançados (estilo PNCP)
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [tipoInstrumentoFiltro, setTipoInstrumentoFiltro] = useState<string>('all');
  const [esferaFiltro, setEsferaFiltro] = useState<string>('all');
  const [portalFiltro, setPortalFiltro] = useState<string>('all');
  const [municipioFiltro, setMunicipioFiltro] = useState('');
  const [unidadeFiltro, setUnidadeFiltro] = useState('');
  const [orgaoFiltro, setOrgaoFiltro] = useState('');
  
  // Toggle portais externos (Firecrawl)
  const [incluirExternos, setIncluirExternos] = useState(false);
  const [loadingExternos, setLoadingExternos] = useState(false);
  const [licitacoesExternas, setLicitacoesExternas] = useState<LicitacaoMural[]>([]);
  const municipiosUfSelecionada = useMemo(() => {
    if (!ufFiltro || ufFiltro === 'all') return [];
    for (const regiao of Object.values(REGIOES_ESTADOS)) {
      const estado = regiao.estados.find(e => e.uf === ufFiltro);
      if (estado) return estado.cidades.sort((a, b) => a.localeCompare(b));
    }
    return [];
  }, [ufFiltro]);

  // Configurações de pesquisa automática
  const [configCarregada, setConfigCarregada] = useState(false);
  const [segmentosPrioritarios, setSegmentosPrioritarios] = useState<string[]>([]);

  useEffect(() => {
    if (!user || configCarregada) return;
    const loadConfig = async () => {
      const { data } = await supabase
        .from('configuracoes')
        .select('uf_sede, municipio_sede, priorizar_regiao_sede, segmentos_prioridade')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        const priorizar = (data as any).priorizar_regiao_sede ?? false;
        const segs: string[] = (data as any).segmentos_prioridade || [];
        setSegmentosPrioritarios(segs);
        if (priorizar) {
          const ufSede = data.uf_sede;
          if (ufSede && ufFiltro === 'all') setUfFiltro(ufSede);
          // Município da sede NÃO é auto-aplicado como filtro para não restringir demais os resultados
        }
      }
      setConfigCarregada(true);
    };
    loadConfig();
  }, [user]);

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

  // Dados brutos da API (sem filtros client-side)
  const [licitacoesRaw, setLicitacoesRaw] = useState<LicitacaoMural[]>([]);

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
            municipio: municipioFiltro.trim() || undefined,
            pagina,
            mural: true,
          }),
        }
      );

      if (!response.ok) throw new Error(`Erro ${response.status}`);
      const data = await response.json();

      const items: LicitacaoMural[] = (data.items || []).map((item: any) => ({
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

      setLicitacoesRaw(items);
    } catch (err) {
      console.error(err);
      setError('Erro ao carregar licitações do PNCP. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [pagina, ufFiltro, modalidadeFiltro, searchSubmitted, dataInicio, dataFim, uasgSubmitted, municipioFiltro]);

  // Busca em portais externos via Firecrawl (busca-editais-ia)
  const carregarExternos = useCallback(async () => {
    if (!incluirExternos) { setLicitacoesExternas([]); return; }
    const queryText = searchSubmitted || (modalidadeFiltro !== 'all' ? modalidadeFiltro : '') || 'licitações';
    setLoadingExternos(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/busca-editais-ia`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            query: queryText,
            uf: ufFiltro !== 'all' ? ufFiltro : undefined,
            portais: ['pncp', 'bll', 'bnc', 'portalcompras', 'licitacoese', 'comprasnet'],
            com_analise_ia: false,
            limite: 20,
          }),
        }
      );
      if (!resp.ok) throw new Error(`Erro ${resp.status}`);
      const data = await resp.json();
      if (data.success && data.resultados?.length > 0) {
        const externItems: LicitacaoMural[] = data.resultados.map((r: any, idx: number) => ({
          id: `ext-${idx}-${Date.now()}`,
          numero: r.numero || '-',
          orgao: r.orgao || '-',
          objeto: r.titulo || '-',
          modalidade: r.modalidade || 'Não informada',
          status: r.status || 'Publicado',
          valor_estimado: r.valor_estimado,
          uf: r.uf,
          municipio: r.municipio,
          data_abertura: r.data_abertura,
          data_encerramento: null,
          data_publicacao: r.data_publicacao,
          portal: r.portal || 'Portal Externo',
          url: r.url,
          pncpNumero: r.pncp_numero || null,
          cnpjOrgao: r.cnpj_orgao || null,
          anoCompra: r.ano_compra || null,
          sequencialCompra: r.seq_compra || null,
          esferaNome: null,
          tipoInstrumentoNome: null,
          unidadeOrgao: null,
        }));
        setLicitacoesExternas(externItems);
        toast.success(`${externItems.length} resultado(s) de portais externos`);
      } else {
        setLicitacoesExternas([]);
      }
    } catch (err) {
      console.error('Erro portais externos:', err);
      setLicitacoesExternas([]);
    } finally {
      setLoadingExternos(false);
    }
  }, [incluirExternos, searchSubmitted, ufFiltro, modalidadeFiltro]);

  // Filtros client-side aplicados sobre os dados já carregados (sem re-fetch)
  const licitacoesFiltradas = useMemo(() => {
    // Merge PNCP + external results, deduplicating by numero+orgao
    const pncpKeys = new Set(licitacoesRaw.map(i => `${i.numero}|${i.orgao}`));
    const externasDedup = licitacoesExternas.filter(e => !pncpKeys.has(`${e.numero}|${e.orgao}`));
    let items = [...licitacoesRaw, ...externasDedup];

    if (esferaFiltro !== 'all') {
      items = items.filter(i => i.esferaNome?.toLowerCase().includes(esferaFiltro.toLowerCase()));
    }
    if (tipoInstrumentoFiltro !== 'all') {
      const tipoLabel = TIPOS_INSTRUMENTO.find(t => t.value === tipoInstrumentoFiltro)?.label || '';
      items = items.filter(i => i.tipoInstrumentoNome?.toLowerCase().includes(tipoLabel.toLowerCase()));
    }
    // municipio filter is now server-side (sent to edge function)
    if (unidadeFiltro.trim()) {
      const term = unidadeFiltro.trim().toLowerCase();
      items = items.filter(i => i.unidadeOrgao?.toLowerCase().includes(term));
    }
    if (orgaoFiltro.trim()) {
      const term = orgaoFiltro.trim().toLowerCase();
      items = items.filter(i => i.orgao?.toLowerCase().includes(term));
    }

    // Priorizar por segmentos prioritários
    if (segmentosPrioritarios.length > 0) {
      const termsLower = segmentosPrioritarios.map(s => s.toLowerCase());
      items.sort((a, b) => {
        const aMatch = termsLower.some(t => a.objeto?.toLowerCase().includes(t) || a.orgao?.toLowerCase().includes(t));
        const bMatch = termsLower.some(t => b.objeto?.toLowerCase().includes(t) || b.orgao?.toLowerCase().includes(t));
        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;
        return 0;
      });
    }

    return items;
  }, [licitacoesRaw, licitacoesExternas, esferaFiltro, tipoInstrumentoFiltro, unidadeFiltro, orgaoFiltro, segmentosPrioritarios]);

  // Sincronizar licitacoes e totalResultados com os dados filtrados
  useEffect(() => {
    setLicitacoes(licitacoesFiltradas);
    setTotalResultados(licitacoesFiltradas.length);
  }, [licitacoesFiltradas]);

  useEffect(() => {
    if (user) carregarMural();
  }, [carregarMural, user]);

  // Trigger external search when toggle is on and search changes
  useEffect(() => {
    if (user && incluirExternos) carregarExternos();
    else setLicitacoesExternas([]);
  }, [carregarExternos, user, incluirExternos]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagina(1);
    setSearchSubmitted(searchTerm);
    setUasgSubmitted(uasgTerm);
  };

  // ── Busca direta por URL ou número PNCP ──
  const handleBuscaDireta = async () => {
    const term = buscaDiretaTerm.trim();
    if (!term) return;

    // Parse PNCP URL: https://pncp.gov.br/app/editais/CNPJ/ANO/SEQ
    const urlMatch = term.match(/pncp\.gov\.br\/app\/editais\/(\d{11,14})\/(\d{4})\/(\d+)/);
    // Parse manual input: CNPJ/ANO/SEQ or CNPJ-ANO-SEQ
    const manualMatch = !urlMatch ? term.match(/^(\d{11,14})[\/\-](\d{4})[\/\-](\d+)$/) : null;
    // Parse PNCP control number: CNPJ-1-00000N/ANO
    const controlMatch = !urlMatch && !manualMatch ? term.match(/^(\d{11,14})-\d+-(\d+)\/(\d{4})$/) : null;

    const match = urlMatch || manualMatch;
    const cnpj = match?.[1] || controlMatch?.[1];
    const ano = match?.[2] || controlMatch?.[3];
    const seq = match?.[3] || controlMatch?.[2];

    if (!cnpj || !ano || !seq) {
      toast.error('Formato inválido. Use a URL do PNCP (ex: https://pncp.gov.br/app/editais/05054937000163/2026/17) ou CNPJ/ANO/SEQ.');
      return;
    }

    setLoadingBuscaDireta(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/detalhe-licitacao-pncp`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ cnpjOrgao: cnpj, anoCompra: ano, sequencialCompra: seq }),
        }
      );

      if (!resp.ok) throw new Error(`Erro ${resp.status}`);
      const data = await resp.json();
      if (!data.success) throw new Error(data.error || 'Edital não encontrado');

      // Convert detail to LicitacaoMural and open ficha
      const lic: LicitacaoMural = {
        id: `direto-${cnpj}-${ano}-${seq}`,
        numero: data.numero_compra || '-',
        orgao: data.orgao || '-',
        objeto: data.objeto || '-',
        modalidade: data.modalidade || 'Não informada',
        status: data.situacao || 'Publicado',
        valor_estimado: data.valor_total_estimado,
        uf: data.uf || null,
        municipio: data.municipio || null,
        data_abertura: data.data_abertura_proposta || null,
        data_encerramento: data.data_encerramento_proposta || null,
        data_publicacao: data.data_publicacao_pncp || null,
        portal: 'PNCP',
        url: data.url_pncp || `https://pncp.gov.br/app/editais/${cnpj}/${ano}/${seq}`,
        pncpNumero: data.numero_controle_pncp || null,
        cnpjOrgao: cnpj,
        anoCompra: ano,
        sequencialCompra: seq,
        esferaNome: null,
        tipoInstrumentoNome: data.tipo_instrumento_convocatorio || null,
        unidadeOrgao: data.unidade_orgao || null,
      };

      setFichaAberta(lic);
      setDetalhePncp(data);
      setBuscaDiretaAberta(false);
      setBuscaDiretaTerm('');
      toast.success('✅ Edital encontrado e carregado!');
    } catch (err) {
      console.error('Busca direta error:', err);
      toast.error(err instanceof Error ? err.message : 'Edital não encontrado no PNCP.');
    } finally {
      setLoadingBuscaDireta(false);
    }
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
      data_encerramento: lic.data_encerramento || lic.data_abertura,
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
          <div className="bg-accent/10 border-b border-accent/20 px-4 sm:px-6 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-accent/20 flex items-center justify-center flex-shrink-0">
                  <Gavel className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-bold text-base sm:text-lg">Ficha da Licitação</h2>
                  <p className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                    <ShieldCheck className="w-3.5 h-3.5 text-success flex-shrink-0" />
                    <span>Dados extraídos em tempo real da API oficial do PNCP</span>
                    {d && <Badge className="bg-success/10 text-success border-success/30 text-[9px] ml-1">Verificado ✓</Badge>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge className={cn('text-xs', statusColor(d?.situacao || lic.status))}>{d?.situacao || lic.status}</Badge>
                <button onClick={() => toggleFavorito(lic)} className={cn('p-2 rounded-md transition-colors', isFav ? 'text-warning bg-warning/10' : 'text-muted-foreground hover:text-warning')}>
                  {isFav ? <Star className="w-5 h-5 fill-current" /> : <StarOff className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-4 sm:p-6 space-y-6">
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

            {/* ── Layout espelhando o PNCP ── */}
            <div className="space-y-2.5 text-sm">
              {/* Local e Órgão */}
              <div className="flex flex-wrap gap-x-8 gap-y-1">
                <div><span className="font-bold">Local:</span> {(d?.municipio || lic.municipio) && (d?.uf || lic.uf) ? `${d?.municipio || lic.municipio}/${d?.uf || lic.uf}` : d?.uf || lic.uf || 'Não informado'}</div>
                <div><span className="font-bold">Órgão:</span> {d?.orgao || lic.orgao}</div>
              </div>

              {/* Unidade compradora */}
              {(d?.unidade_orgao) && (
                <div><span className="font-bold">Unidade compradora:</span> {d.unidade_orgao}</div>
              )}

              {/* Modalidade, Amparo legal, Tipo, Modo de disputa */}
              <div className="flex flex-wrap gap-x-8 gap-y-1">
                <div><span className="font-bold">Modalidade da contratação:</span> {d?.modalidade || lic.modalidade}</div>
                {d?.amparo_legal && (
                  <div><span className="font-bold">Amparo legal:</span> {d.amparo_legal}</div>
                )}
                {d?.tipo_instrumento_convocatorio && (
                  <div><span className="font-bold">Tipo:</span> {d.tipo_instrumento_convocatorio}</div>
                )}
                {d?.modo_disputa && (
                  <div><span className="font-bold">Modo de disputa:</span> {d.modo_disputa}</div>
                )}
              </div>

              {/* Registro de preço e Fonte orçamentária */}
              <div className="flex flex-wrap gap-x-8 gap-y-1">
                {d && (
                  <div><span className="font-bold">Registro de preço:</span> {d.srp ? 'Sim' : 'Não'}</div>
                )}
                <div><span className="font-bold">Fonte orçamentária:</span> {d?.fonte_orcamentaria || 'Não informada'}</div>
              </div>

              {/* Data de divulgação e Situação */}
              <div className="flex flex-wrap gap-x-8 gap-y-1">
                <div><span className="font-bold">Data de divulgação no PNCP:</span> {formatDate(d?.data_publicacao_pncp || lic.data_publicacao)}</div>
                <div><span className="font-bold">Situação:</span> <Badge className={`${statusColor(d?.situacao || lic.status)} text-[10px] px-2`}>{d?.situacao || lic.status}</Badge></div>
              </div>

              {/* Datas de recebimento de propostas */}
              <div>
                <span className="font-bold">Data de início de recebimento de propostas:</span>{' '}
                {formatDate(d?.data_abertura_proposta || lic.data_abertura)}
                <span className="text-muted-foreground text-xs ml-1">(horário de Brasília)</span>
              </div>
              <div>
                <span className="font-bold">Data fim de recebimento de propostas:</span>{' '}
                {formatDate(d?.data_encerramento_proposta || lic.data_encerramento)}
                <span className="text-muted-foreground text-xs ml-1">(horário de Brasília)</span>
              </div>

              {/* Id contratação PNCP e Fonte */}
              <div className="flex flex-wrap gap-x-8 gap-y-1">
                {(d?.numero_controle_pncp || lic.pncpNumero) && (
                  <div><span className="font-bold">Id contratação PNCP:</span> {d?.numero_controle_pncp || lic.pncpNumero}</div>
                )}
                <div><span className="font-bold">Fonte:</span> {d?.fonte_sistema || d?.link_sistema_origem ? 'Compras.gov.br' : lic.portal}</div>
              </div>

              {/* Dados adicionais */}
              {d?.criterio_julgamento && (
                <div><span className="font-bold">Critério de julgamento:</span> {d.criterio_julgamento}</div>
              )}
              {d?.processo_administrativo && (
                <div><span className="font-bold">Processo administrativo:</span> {d.processo_administrativo}</div>
              )}
              {(d?.cnpj_orgao || lic.cnpjOrgao) && (
                <div><span className="font-bold">CNPJ do Órgão:</span> {(d?.cnpj_orgao || lic.cnpjOrgao!).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')}</div>
              )}

              {/* Valores */}
              {(d?.valor_total_estimado || lic.valor_estimado) && (
                <div><span className="font-bold">Valor total estimado:</span> <span className="text-success font-semibold">{formatCurrency(d?.valor_total_estimado || lic.valor_estimado!)}</span></div>
              )}
              {d?.valor_total_homologado && d.valor_total_homologado > 0 && (
                <div><span className="font-bold">Valor total homologado:</span> <span className="text-success font-semibold">{formatCurrency(d.valor_total_homologado)}</span></div>
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
                        {d.itens.map((item, idx) => (
                          <tr key={idx} className="border-b border-border/20 hover:bg-muted/20">
                            <td className="px-3 py-2 font-mono text-muted-foreground">{item.numero}</td>
                            <td className="px-3 py-2 max-w-[300px]">
                              <span className="line-clamp-2 text-xs">{item.descricao}</span>
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
              data_encerramento: editalInteresse.data_encerramento || editalInteresse.data_abertura, portal: editalInteresse.portal,
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
      <div className="bg-accent/5 rounded-xl border border-accent/20 p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-accent/15 flex items-center justify-center flex-shrink-0">
              <Gavel className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-xs sm:text-sm flex items-center gap-2 flex-wrap">
                <span className="whitespace-nowrap">Mural de Licitações — Tempo Real</span>
                <Badge className="bg-success text-success-foreground text-[10px]">PNCP Oficial</Badge>
              </h3>
              <p className="text-[10px] sm:text-[11px] text-muted-foreground">
                Dados em tempo real da API oficial do Portal Nacional de Contratações Públicas
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setBuscaDiretaAberta(!buscaDiretaAberta)}
              className="gap-1.5 border-accent/30 text-accent hover:bg-accent/10 text-xs"
            >
              <Link2 className="w-3.5 h-3.5" />
              Busca Direta
            </Button>
            <div className="flex items-center gap-2 bg-card border border-border/50 rounded-lg px-2.5 py-1.5">
              <Sparkles className="w-3.5 h-3.5 text-accent flex-shrink-0" />
              <label htmlFor="toggle-externos" className="text-[11px] sm:text-xs font-medium cursor-pointer select-none whitespace-nowrap">
                Incluir portais externos
              </label>
              <Switch
                id="toggle-externos"
                checked={incluirExternos}
                onCheckedChange={setIncluirExternos}
                className="scale-90"
              />
              {loadingExternos && <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />}
            </div>
            <Button size="sm" variant="outline" onClick={carregarMural} disabled={loading} className="gap-1.5 text-xs">
              <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} /> Atualizar
            </Button>
          </div>
        </div>

        {/* Keyword + UASG search bar */}
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row flex-wrap gap-2 mb-3">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Palavra-chave"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 text-xs sm:text-sm"
              disabled={loading}
            />
          </div>
          <div className="relative sm:w-[200px]">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="UASG / CNPJ do Órgão"
              value={uasgTerm}
              onChange={e => setUasgTerm(e.target.value)}
              className="pl-9 text-xs sm:text-sm"
              disabled={loading}
            />
          </div>
          <Button type="submit" disabled={loading} className="bg-accent hover:bg-accent/90 text-accent-foreground gap-1.5 w-full sm:w-auto">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Buscar
          </Button>
        </form>

        {/* ═══ BUSCA DIRETA POR URL/NÚMERO PNCP ═══ */}
        {buscaDiretaAberta && (
          <div className="bg-accent/5 border border-accent/20 rounded-xl p-4 mb-3 animate-fade-in">
            <div className="flex items-center gap-2 mb-3">
              <Link2 className="w-4 h-4 text-accent" />
              <h4 className="text-sm font-bold">Busca Direta por Edital</h4>
              <Badge className="bg-accent/10 text-accent border-accent/20 text-[9px]">PNCP</Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Cole a URL do PNCP ou informe o número no formato <code className="bg-muted px-1.5 py-0.5 rounded text-[10px]">CNPJ/ANO/SEQUENCIAL</code> para localizar qualquer edital publicado.
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="Ex: https://pncp.gov.br/app/editais/05054937000163/2026/17 ou 05054937000163/2026/17"
                value={buscaDiretaTerm}
                onChange={(e) => setBuscaDiretaTerm(e.target.value)}
                className="text-xs flex-1"
                disabled={loadingBuscaDireta}
                onKeyDown={(e) => { if (e.key === 'Enter') handleBuscaDireta(); }}
              />
              <Button
                onClick={handleBuscaDireta}
                disabled={loadingBuscaDireta || !buscaDiretaTerm.trim()}
                className="gap-1.5 bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                {loadingBuscaDireta ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Localizar
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setBuscaDiretaAberta(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

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
                  <Select value={ufFiltro} onValueChange={v => { setUfFiltro(v); setMunicipioFiltro(''); setPagina(1); }}>
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
                  <Select
                    value={municipioFiltro}
                    onValueChange={v => { setMunicipioFiltro(v === 'all' ? '' : v); setPagina(1); }}
                    disabled={loading || ufFiltro === 'all'}
                  >
                    <SelectTrigger className="w-full h-10 text-xs">
                      <SelectValue placeholder={ufFiltro === 'all' ? 'Selecione uma UF primeiro' : 'Todos os municípios'} />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      <SelectItem value="all">Todos os municípios</SelectItem>
                      {municipiosUfSelecionada.map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <p className="text-xs sm:text-sm text-muted-foreground">
          {loading && loadingExternos ? 'Consultando PNCP + portais externos...' :
           loading ? 'Consultando PNCP...' :
           loadingExternos ? `${licitacoesRaw.length} do PNCP • Buscando portais externos...` :
           `${totalResultados} licitações encontradas${licitacoesExternas.length > 0 ? ` (${licitacoesRaw.length} PNCP + ${licitacoesExternas.length} externos)` : ''}`}
        </p>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/30 gap-1 whitespace-nowrap">
            <Globe className="w-3 h-3" /> PNCP Oficial
          </Badge>
          {incluirExternos && licitacoesExternas.length > 0 && (
            <Badge variant="outline" className="text-[10px] bg-accent/10 text-accent border-accent/30 gap-1 whitespace-nowrap">
              <Sparkles className="w-3 h-3" /> Portais Externos
            </Badge>
          )}
        </div>
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
                    <Badge variant="outline" className={cn('text-[9px]', lic.id.startsWith('ext-') ? 'bg-accent/10 text-accent border-accent/30' : '')}>
                      {lic.id.startsWith('ext-') ? '🌐 Externo' : lic.portal}
                    </Badge>
                  </div>
                </div>

                {/* Número */}
                <p className="text-[10px] font-mono text-muted-foreground mb-1">{lic.numero}</p>

                {/* Objeto */}
                <Tooltip delayDuration={400}>
                  <TooltipTrigger asChild>
                    <p className="text-sm font-medium line-clamp-2 mb-3 group-hover:text-accent transition-colors cursor-pointer" onClick={() => setFichaAberta(lic)}>{lic.objeto}</p>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs">
                    {lic.objeto}
                  </TooltipContent>
                </Tooltip>

                {/* Órgão */}
                <Tooltip delayDuration={400}>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <Building2 className="w-3 h-3 flex-shrink-0" />
                      <span className="line-clamp-1">{lic.orgao}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs">
                    {lic.orgao}
                  </TooltipContent>
                </Tooltip>

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
                    <span title="Fim de recebimento de propostas">
                    {(() => {
                      const ds = lic.data_encerramento || lic.data_abertura;
                      if (!ds) return 'N/I';
                      let norm = ds;
                      if (/^\d{4}-\d{2}-\d{2}$/.test(ds)) norm = ds + 'T12:00:00-03:00';
                      else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(ds) && !ds.includes('+') && !ds.includes('Z') && !/\-\d{2}:\d{2}$/.test(ds)) norm = ds + '-03:00';
                      return new Date(norm).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' });
                    })()}
                    </span>
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
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Página {pagina} • {totalResultados} resultado(s)
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={pagina <= 1} onClick={() => setPagina(p => p - 1)} className="gap-1 text-xs">
              <ChevronLeft className="w-3.5 h-3.5" /> Anterior
            </Button>
            <Button variant="outline" size="sm" disabled={licitacoes.length < 50} onClick={() => setPagina(p => p + 1)} className="gap-1 text-xs">
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
            data_encerramento: editalInteresse.data_encerramento || editalInteresse.data_abertura, portal: editalInteresse.portal,
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
