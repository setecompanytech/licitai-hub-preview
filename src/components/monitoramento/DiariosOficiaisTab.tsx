import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Search, RefreshCw, FileText, AlertTriangle, XCircle, Clock,
  CheckCircle2, Globe, Building2, MapPin, Award, PauseCircle,
  ArrowUpDown, FileCheck, Newspaper, ExternalLink, Eye,
  CalendarDays, Bookmark, Sparkles, ChevronDown, ChevronUp, CalendarIcon, Download,
  FileSpreadsheet, FileJson
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Loader2, Filter } from 'lucide-react';
import { streamAIChat } from '@/lib/ai-stream';
import { downloadCSV, downloadPDF, downloadJSON } from '@/lib/download-utils';

type AtoLicitatorio = {
  id: string;
  titulo: string;
  orgao: string;
  tipo: string | null;
  portal: string | null;
  data_publicacao: string | null;
  valor_estimado: number | null;
  municipio: string | null;
  uf: string | null;
  url: string | null;
  relevancia_score: number | null;
  palavras_chave: string[] | null;
  cnae_compativel: boolean | null;
  lido: boolean | null;
  status: string | null;
  created_at: string;
  texto_integral: string | null;
};

const tipoConfig: Record<string, { label: string; icon: typeof FileText; color: string }> = {
  aviso_licitacao: { label: 'Aviso de Licitação', icon: CalendarDays, color: 'bg-accent/15 text-accent border-accent/30' },
  edital: { label: 'Edital', icon: FileText, color: 'bg-info/15 text-info border-info/30' },
  suspensao: { label: 'Suspenso', icon: PauseCircle, color: 'bg-warning/15 text-warning border-warning/30' },
  cancelamento: { label: 'Cancelado', icon: XCircle, color: 'bg-destructive/15 text-destructive border-destructive/30' },
  adiamento: { label: 'Adiado', icon: Clock, color: 'bg-warning/15 text-warning border-warning/30' },
  revogacao: { label: 'Revogado', icon: XCircle, color: 'bg-destructive/15 text-destructive border-destructive/30' },
  homologacao: { label: 'Homologado', icon: FileCheck, color: 'bg-success/15 text-success border-success/30' },
  adjudicacao: { label: 'Adjudicado', icon: Award, color: 'bg-success/15 text-success border-success/30' },
  aditivamento: { label: 'Aditivado', icon: ArrowUpDown, color: 'bg-primary/15 text-primary border-primary/30' },
  errata: { label: 'Errata', icon: AlertTriangle, color: 'bg-warning/15 text-warning border-warning/30' },
  resultado: { label: 'Resultado', icon: CheckCircle2, color: 'bg-info/15 text-info border-info/30' },
  contrato: { label: 'Contrato', icon: Bookmark, color: 'bg-primary/15 text-primary border-primary/30' },
  ata_registro_precos: { label: 'Ata de Registro', icon: FileText, color: 'bg-accent/15 text-accent border-accent/30' },
};

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const UFS_DISPONIVEIS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS',
  'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC',
  'SE', 'SP', 'TO'
];

const FONTES_DIARIOS = [
  { id: 'todos', label: 'Todas as fontes', url: '' },
  { id: 'dou', label: 'DOU (Federal)', url: 'https://www.in.gov.br/servicos/diario-oficial-da-uniao' },
  { id: 'ioepa', label: 'IOEPA (Estadual)', url: 'https://www.ioepa.com.br/portal/' },
  { id: 'tcmpa', label: 'TCMPA (Municípios)', url: 'https://www.tcmpa.tc.br/portalsc/LISTAGEM_GRID/' },
  { id: 'doesp', label: 'DOE/SP', url: 'https://doe.sp.gov.br/' },
  { id: 'ioerj', label: 'IOERJ', url: 'https://portal.ioerj.com.br/' },
  { id: 'dodf', label: 'DODF.e (Distrito Federal)', url: 'https://dodf.df.gov.br/' },
  { id: 'dobelem', label: 'DO Belém', url: 'https://sistemas.belem.pa.gov.br/diario/painel' },
  { id: 'doananindeua', label: 'DO Ananindeua', url: 'https://ananindeua.pa.gov.br/diario_oficial' },
  { id: 'pncp', label: 'PNCP', url: 'https://pncp.gov.br/app/editais?pagina=1' },
];

export default function DiariosOficiaisTab() {
  const { user } = useAuth();
  const [atos, setAtos] = useState<AtoLicitatorio[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [buscando, setBuscando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [busca, setBusca] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('todos');
  const [ufFiltro, setUfFiltro] = useState('todos');
  const [fonteFiltro, setFonteFiltro] = useState('todos');
  const [ufsBusca, setUfsBusca] = useState<string[]>(['PA']);
  const [mostrarPortais, setMostrarPortais] = useState(false);
  const [buscaIA, setBuscaIA] = useState('');
  const [buscandoIA, setBuscandoIA] = useState(false);
  const [filtrandoIA, setFiltrandoIA] = useState(false);
  const [idsRelevantesIA, setIdsRelevantesIA] = useState<string[] | null>(null);
  const [dataInicio, setDataInicio] = useState<Date | undefined>();
  const [dataFim, setDataFim] = useState<Date | undefined>();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const carregarAtos = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('monitoramento_editais')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Erro ao carregar atos:', error);
    } else {
      // Deduplicate client-side by title+orgao similarity
      const seen = new Set<string>();
      const unique = (data || []).filter(a => {
        const key = `${a.titulo.substring(0, 60).toLowerCase()}_${a.orgao.substring(0, 30).toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setAtos(unique);
    }
    setLoading(false);
  };

  useEffect(() => {
    carregarAtos();
  }, [user]);

  const handleBuscar = async () => {
    if (!user) return;
    setBuscando(true);
    setProgresso(0);

    const interval = setInterval(() => {
      setProgresso(p => Math.min(90, p + Math.random() * 12));
    }, 500);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/busca-diarios-oficiais`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({
            ufs: ufsBusca,
            palavras_chave: buscaIA
              ? buscaIA.split(',').map(s => s.trim()).filter(Boolean)
              : ['licitação', 'pregão', 'concorrência', 'obra', 'construção', 'pavimentação', 'reforma', 'infraestrutura'],
            dias_retroativos: 7,
          }),
        }
      );

      if (!response.ok) {
        if (response.status === 429) {
          toast.error('Limite de requisições atingido. Aguarde e tente novamente.');
        } else if (response.status === 402) {
          toast.error('Créditos insuficientes. Adicione créditos ao workspace.');
        } else {
          toast.error('Erro na busca. Tente novamente.');
        }
        return;
      }

      const data = await response.json();
      if (data.success) {
        const fontes = data.diarios_pesquisados?.join(', ') || 'portais oficiais';
        toast.success(`${data.total} atos reais encontrados: ${fontes}`);
        await carregarAtos();
      } else {
        toast.error(data.error || 'Erro na busca');
      }
    } catch (err) {
      toast.error('Erro ao conectar com o serviço de busca');
      console.error(err);
    } finally {
      clearInterval(interval);
      setProgresso(100);
      setTimeout(() => {
        setBuscando(false);
        setProgresso(0);
      }, 500);
    }
  };

  const handleBuscaIA = async () => {
    if (!buscaIA.trim()) {
      toast.error('Digite termos para a pesquisa avançada com IA');
      return;
    }
    setBuscandoIA(true);
    setIdsRelevantesIA(null);
    await handleBuscar();
    setBuscandoIA(false);
  };

  const handleFiltrarIA = async () => {
    if (!buscaIA.trim()) {
      toast.error('Digite o que deseja filtrar (ex: pavimentação, saneamento)');
      return;
    }
    if (atos.length === 0) {
      toast.error('Nenhum resultado carregado para filtrar. Busque nos portais primeiro.');
      return;
    }
    setFiltrandoIA(true);

    // Build a summary of existing results for AI analysis
    const resumos = atos.slice(0, 60).map((a, i) => 
      `${i}|${a.id}|${a.titulo.substring(0, 120)}|${a.orgao.substring(0, 60)}|${a.tipo || ''}|${a.municipio || ''}/${a.uf || ''}`
    ).join('\n');

    let content = '';
    await streamAIChat({
      messages: [{
        role: 'user',
        content: `Analise os atos licitatórios abaixo e retorne APENAS os IDs (coluna 2, UUID) dos que são RELEVANTES para o filtro: "${buscaIA}".

Considere relevância semântica (não apenas palavras exatas). Por exemplo, "material hospitalar" deve incluir "luvas", "seringas", "medicamentos" etc.

Formato de cada linha: índice|id|título|órgão|tipo|local

${resumos}

Retorne APENAS um JSON array com os IDs relevantes, sem explicações: ["id1", "id2", ...]`
      }],
      action: 'filtro_ia_diarios',
      onDelta: (chunk) => { content += chunk; },
      onDone: () => {
        try {
          const jsonMatch = content.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const ids = JSON.parse(jsonMatch[0]) as string[];
            setIdsRelevantesIA(ids);
            toast.success(`IA encontrou ${ids.length} atos relevantes para "${buscaIA}"`);
          } else {
            toast.error('IA não conseguiu classificar os resultados.');
          }
        } catch {
          toast.error('Erro ao processar resposta da IA.');
        }
        setFiltrandoIA(false);
      },
      onError: (err) => {
        toast.error(err);
        setFiltrandoIA(false);
      },
    });
  };

  const marcarComoLido = async (id: string) => {
    await supabase.from('monitoramento_editais').update({ lido: true }).eq('id', id);
    setAtos(prev => prev.map(a => a.id === id ? { ...a, lido: true } : a));
  };

  const handleDownloadPublicacao = async (ato: AtoLicitatorio) => {
    if (!ato.url) {
      toast.error('Sem link disponível para download');
      return;
    }
    setDownloadingId(ato.id);
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
            url: ato.url,
            numero: ato.titulo,
            orgao: ato.orgao,
            objeto: ato.titulo,
            portal: ato.portal,
          }),
        }
      );

      if (!response.ok) {
        // Edge function couldn't find a downloadable file — open the URL directly
        window.open(ato.url, '_blank');
        toast.info('Publicação aberta no portal. O documento será exibido na página do diário oficial.');
        return;
      }

      const data = await response.json();

      if (data.tipo === 'arquivo_direto' && data.arquivo?.conteudo_base64) {
        const byteChars = atob(data.arquivo.conteudo_base64);
        const byteNumbers = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
          byteNumbers[i] = byteChars.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: data.arquivo.content_type || 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = data.arquivo.nome || 'edital.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
        toast.success('Download concluído!');
      } else if (data.tipo === 'download_urls' && data.documentos?.length > 0) {
        const doc = data.documentos[0];
        if (doc.url) {
          window.open(doc.url, '_blank');
          toast.success(`Abrindo: ${doc.nome || 'documento'}`);
        }
      } else {
        // No downloadable file found — open the original URL
        window.open(ato.url, '_blank');
        toast.info('Publicação aberta no portal do diário oficial.');
      }
    } catch (err: any) {
      console.error('Erro download:', err);
      // On any error, fallback to opening the URL directly
      if (ato.url) {
        window.open(ato.url, '_blank');
        toast.info('Publicação aberta no portal do diário oficial.');
      } else {
        toast.error('Erro ao acessar a publicação');
      }
    } finally {
      setDownloadingId(null);
    }
  };

  const atosFiltrados = atos.filter(a => {
    // If AI filter is active, only show matching IDs
    if (idsRelevantesIA !== null && !idsRelevantesIA.includes(a.id)) return false;
    const matchBusca = !busca ||
      a.titulo.toLowerCase().includes(busca.toLowerCase()) ||
      a.orgao.toLowerCase().includes(busca.toLowerCase()) ||
      (a.palavras_chave || []).some(kw => kw.toLowerCase().includes(busca.toLowerCase())) ||
      (a.url || '').toLowerCase().includes(busca.toLowerCase());
    const matchTipo = tipoFiltro === 'todos' || a.tipo === tipoFiltro;
    const matchUf = ufFiltro === 'todos' || a.uf === ufFiltro;
    const matchDataInicio = !dataInicio || (a.data_publicacao && new Date(a.data_publicacao) >= dataInicio);
    const matchDataFim = !dataFim || (a.data_publicacao && new Date(a.data_publicacao) <= new Date(dataFim.getTime() + 86400000));
    const portalLower = a.portal?.toLowerCase() || '';
    const matchFonte = fonteFiltro === 'todos' ||
      (fonteFiltro === 'tcmpa' && portalLower.includes('tcm')) ||
      (fonteFiltro === 'dou' && portalLower.includes('dou')) ||
      (fonteFiltro === 'ioepa' && (portalLower.includes('ioepa') || portalLower.includes('doe-pa') || portalLower.includes('pará'))) ||
      (fonteFiltro === 'doesp' && (portalLower.includes('doe-sp') || portalLower.includes('doesp') || portalLower.includes('são paulo'))) ||
      (fonteFiltro === 'ioerj' && (portalLower.includes('ioerj') || portalLower.includes('doe-rj') || portalLower.includes('rio de janeiro'))) ||
      (fonteFiltro === 'dodf' && (portalLower.includes('dodf') || portalLower.includes('doe-df') || portalLower.includes('distrito federal'))) ||
      (fonteFiltro === 'dobelem' && (portalLower.includes('belém') || portalLower.includes('belem'))) ||
      (fonteFiltro === 'doananindeua' && portalLower.includes('ananindeua')) ||
      (fonteFiltro === 'pncp' && portalLower.includes('pncp'));
    return matchBusca && matchTipo && matchUf && matchFonte && matchDataInicio && matchDataFim;
  });

  // Reorder: if AI filter is active, put matched items in the order returned by AI
  const atosOrdenados = idsRelevantesIA !== null
    ? atosFiltrados.sort((a, b) => idsRelevantesIA.indexOf(a.id) - idsRelevantesIA.indexOf(b.id))
    : atosFiltrados;

  const naoLidos = atos.filter(a => !a.lido).length;
  const fonteAtual = FONTES_DIARIOS.find(f => f.id === fonteFiltro);

  const getExportHeaders = () => ['Tipo', 'Título', 'Órgão', 'Portal/Fonte', 'UF', 'Município', 'Data Publicação', 'Valor Estimado', 'Palavras-chave'];

  const getExportRows = (items: AtoLicitatorio[]) =>
    items.map(a => [
      tipoConfig[a.tipo || '']?.label || a.tipo || '-',
      a.titulo,
      a.orgao,
      a.portal || '-',
      a.uf || '-',
      a.municipio || '-',
      a.data_publicacao ? new Date(a.data_publicacao).toLocaleDateString('pt-BR') : '-',
      a.valor_estimado ? formatCurrency(a.valor_estimado) : '-',
      (a.palavras_chave || []).join(', ') || '-',
    ]);

  const handleExportBulk = (tipo: 'csv' | 'pdf' | 'json') => {
    if (atosOrdenados.length === 0) { toast.error('Nenhum ato para exportar'); return; }
    const ts = new Date().toISOString().slice(0, 10);
    const headers = getExportHeaders();
    const rows = getExportRows(atosOrdenados);
    if (tipo === 'csv') downloadCSV(`diarios-oficiais-${ts}`, headers, rows);
    else if (tipo === 'pdf') downloadPDF(`diarios-oficiais-${ts}`, 'Diários Oficiais — Atos Licitatórios', headers, rows);
    else downloadJSON(`diarios-oficiais-${ts}`, atosOrdenados);
    toast.success(`Exportação ${tipo.toUpperCase()} realizada com ${atosOrdenados.length} atos`);
  };

  const handleExportDOFormatPDF = () => {
    if (atosOrdenados.length === 0) { toast.error('Nenhum ato para exportar'); return; }
    // Generate a text-based PDF in official gazette format
    const jsPDF = (window as any).jspdf?.jsPDF;
    // Use import approach instead
    import('jspdf').then(({ default: jsPDF }) => {
      const doc = new jsPDF({ orientation: 'portrait' });
      const ts = new Date().toLocaleString('pt-BR');
      const pageWidth = doc.internal.pageSize.getWidth();

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('DIÁRIO OFICIAL — ATOS LICITATÓRIOS', pageWidth / 2, 18, { align: 'center' });
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120);
      doc.text(`Gerado em: ${ts} | ${atosOrdenados.length} publicações`, pageWidth / 2, 24, { align: 'center' });
      doc.setTextColor(0);

      let y = 34;
      const lineHeight = 4.5;
      const margin = 14;
      const maxWidth = pageWidth - margin * 2;

      atosOrdenados.forEach((ato, idx) => {
        // Check if we need a new page
        if (y > 270) { doc.addPage(); y = 18; }

        const tipoLabel = (tipoConfig[ato.tipo || '']?.label || ato.tipo || 'ATO').toUpperCase();

        // Separator
        doc.setDrawColor(180);
        doc.line(margin, y, pageWidth - margin, y);
        y += 5;

        // Type header
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(`${tipoLabel} — ${ato.orgao.toUpperCase()}`, margin, y);
        y += lineHeight + 1;

        // Portal and date
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100);
        const metaLine = [
          ato.portal ? `Fonte: ${ato.portal}` : null,
          ato.data_publicacao ? `Data: ${new Date(ato.data_publicacao).toLocaleDateString('pt-BR')}` : null,
          ato.municipio && ato.uf ? `Local: ${ato.municipio}/${ato.uf}` : ato.uf ? `UF: ${ato.uf}` : null,
          ato.valor_estimado ? `Valor: ${formatCurrency(ato.valor_estimado)}` : null,
        ].filter(Boolean).join(' | ');
        doc.text(metaLine, margin, y);
        y += lineHeight;
        doc.setTextColor(0);

        // Title
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        const titleLines = doc.splitTextToSize(ato.titulo, maxWidth);
        titleLines.forEach((line: string) => {
          if (y > 280) { doc.addPage(); y = 18; }
          doc.text(line, margin, y);
          y += lineHeight;
        });

        // Full text if available
        if (ato.texto_integral) {
          doc.setFont('courier', 'normal');
          doc.setFontSize(7);
          const textLines = doc.splitTextToSize(ato.texto_integral, maxWidth);
          textLines.forEach((line: string) => {
            if (y > 280) { doc.addPage(); y = 18; }
            doc.text(line, margin, y);
            y += lineHeight - 0.5;
          });
        }

        // Keywords
        if (ato.palavras_chave && ato.palavras_chave.length > 0) {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(6.5);
          doc.setTextColor(130);
          doc.text(`Palavras-chave: ${ato.palavras_chave.join(', ')}`, margin, y);
          doc.setTextColor(0);
          y += lineHeight;
        }

        y += 4;
      });

      doc.save(`diario-oficial-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success('PDF no formato Diário Oficial exportado com sucesso!');
    });
  };

  const handleExportSingleDO = (ato: AtoLicitatorio) => {
    import('jspdf').then(({ default: jsPDF }) => {
      const doc = new jsPDF({ orientation: 'portrait' });
      const ts = new Date().toLocaleString('pt-BR');
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 14;
      const maxWidth = pageWidth - margin * 2;
      const lineHeight = 4.5;

      const tipoLabel = (tipoConfig[ato.tipo || '']?.label || ato.tipo || 'ATO').toUpperCase();

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('DIÁRIO OFICIAL', pageWidth / 2, 18, { align: 'center' });
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120);
      doc.text(`Gerado em: ${ts}`, pageWidth / 2, 23, { align: 'center' });
      doc.setTextColor(0);

      let y = 34;
      doc.setDrawColor(180);
      doc.line(margin, y, pageWidth - margin, y);
      y += 6;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`${tipoLabel}`, margin, y);
      y += lineHeight + 2;

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      const fields = [
        ['ÓRGÃO:', ato.orgao],
        ['FONTE:', ato.portal || 'N/I'],
        ['DATA DE PUBLICAÇÃO:', ato.data_publicacao ? new Date(ato.data_publicacao).toLocaleDateString('pt-BR') : 'N/I'],
        ['LOCAL:', [ato.municipio, ato.uf].filter(Boolean).join('/') || 'N/I'],
        ['VALOR ESTIMADO:', ato.valor_estimado ? formatCurrency(ato.valor_estimado) : 'N/I'],
      ];

      fields.forEach(([label, value]) => {
        doc.setFont('helvetica', 'bold');
        doc.text(label as string, margin, y);
        doc.setFont('helvetica', 'normal');
        doc.text(value as string, margin + doc.getTextWidth(label as string) + 2, y);
        y += lineHeight + 1;
      });

      y += 3;
      doc.setFont('helvetica', 'bold');
      doc.text('OBJETO:', margin, y);
      y += lineHeight;
      doc.setFont('helvetica', 'normal');
      const titleLines = doc.splitTextToSize(ato.titulo, maxWidth);
      titleLines.forEach((line: string) => {
        if (y > 280) { doc.addPage(); y = 18; }
        doc.text(line, margin, y);
        y += lineHeight;
      });

      if (ato.texto_integral) {
        y += 4;
        doc.setDrawColor(200);
        doc.line(margin, y, pageWidth - margin, y);
        y += 5;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text('TEXTO INTEGRAL DA PUBLICAÇÃO:', margin, y);
        y += lineHeight + 2;
        doc.setFont('courier', 'normal');
        doc.setFontSize(7.5);
        const textLines = doc.splitTextToSize(ato.texto_integral, maxWidth);
        textLines.forEach((line: string) => {
          if (y > 280) { doc.addPage(); y = 18; }
          doc.text(line, margin, y);
          y += lineHeight - 0.5;
        });
      }

      if (ato.palavras_chave && ato.palavras_chave.length > 0) {
        y += 4;
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7);
        doc.setTextColor(130);
        doc.text(`Palavras-chave: ${ato.palavras_chave.join(', ')}`, margin, y);
      }

      const safeName = ato.titulo.substring(0, 40).replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
      doc.save(`publicacao-${safeName}-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success('PDF da publicação exportado!');
    });
  };

  return (
    <div className="space-y-4">
      {/* Header da busca */}
      <div className="bg-card rounded-xl border border-border/50 p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-accent" />
            <h3 className="font-semibold text-sm">Busca nos Diários Oficiais</h3>
            <Badge variant="outline" className="bg-accent/15 text-accent border-accent/30 text-[10px]">
              {naoLidos > 0 ? `${naoLidos} novos` : `${atosOrdenados.length} registros`}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" disabled={atosOrdenados.length === 0}>
                  <Download className="w-3.5 h-3.5" /> Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportDOFormatPDF} className="gap-2 text-xs font-semibold text-accent">
                  <FileText className="w-3.5 h-3.5" /> PDF (Formato Diário Oficial)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportBulk('pdf')} className="gap-2 text-xs">
                  <FileText className="w-3.5 h-3.5" /> PDF (Tabela)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportBulk('csv')} className="gap-2 text-xs">
                  <FileSpreadsheet className="w-3.5 h-3.5" /> CSV / Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportBulk('json')} className="gap-2 text-xs">
                  <FileJson className="w-3.5 h-3.5" /> JSON
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Select value={ufsBusca[0] || 'PA'} onValueChange={v => setUfsBusca([v])}>
              <SelectTrigger className="w-[100px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UFS_DISPONIVEIS.map(uf => (
                  <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleBuscar}
              disabled={buscando}
              size="sm"
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              {buscando ? (
                <><RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" /> Buscando...</>
              ) : (
                <><Search className="w-3.5 h-3.5 mr-1" /> Buscar Diários Oficiais</>
              )}
            </Button>
          </div>
        </div>

        {buscando && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Pesquisando diários oficiais ({ufsBusca[0]})...</span>
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
              placeholder="Pesquisa com IA (ex: pavimentação, saneamento, energia solar...)"
              value={buscaIA}
              onChange={e => { setBuscaIA(e.target.value); if (!e.target.value.trim()) setIdsRelevantesIA(null); }}
              className="pl-9 text-xs"
              onKeyDown={e => e.key === 'Enter' && handleFiltrarIA()}
            />
          </div>
          <Button
            onClick={handleFiltrarIA}
            disabled={filtrandoIA || buscandoIA || buscando}
            size="sm"
            variant="outline"
            className="shrink-0"
            title="Filtra os resultados já carregados usando IA semântica"
          >
            {filtrandoIA ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <><Filter className="w-3.5 h-3.5 mr-1" /> Filtrar com IA</>
            )}
          </Button>
          <Button
            onClick={handleBuscaIA}
            disabled={buscandoIA || buscando || filtrandoIA}
            size="sm"
            variant="outline"
            className="shrink-0"
            title="Busca novos resultados nos portais usando estes termos"
          >
            {buscandoIA ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <><Sparkles className="w-3.5 h-3.5 mr-1" /> Buscar nos Portais</>
            )}
          </Button>
          {idsRelevantesIA !== null && (
            <Button
              onClick={() => setIdsRelevantesIA(null)}
              size="sm"
              variant="ghost"
              className="shrink-0 text-xs"
            >
              Limpar filtro IA
            </Button>
          )}
        </div>

        {/* Toggle para mostrar portais */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-between text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setMostrarPortais(!mostrarPortais)}
        >
          <span className="flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5" />
            Acessar portais dos Diários Oficiais
          </span>
          {mostrarPortais ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </Button>

        {mostrarPortais && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {FONTES_DIARIOS.filter(f => f.id !== 'todos').map(fonte => (
              <a
                key={fonte.id}
                href={fonte.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/40 hover:bg-muted/80 border border-border/30 hover:border-accent/40 transition-all group"
              >
                <div className="w-7 h-7 rounded-md bg-accent/10 flex items-center justify-center shrink-0 group-hover:bg-accent/20 transition-colors">
                  <Newspaper className="w-3.5 h-3.5 text-accent" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{fonte.label}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{fonte.url}</p>
                </div>
                <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-accent shrink-0" />
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Filtrar por CNPJ, objeto, órgão, palavras-chave..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("h-10 text-xs gap-1.5", dataInicio && "text-foreground")}>
              <CalendarIcon className="w-3.5 h-3.5" />
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
              <CalendarIcon className="w-3.5 h-3.5" />
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
        <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Tipo de ato" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {Object.entries(tipoConfig).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={ufFiltro} onValueChange={setUfFiltro}>
          <SelectTrigger className="w-[100px]"><SelectValue placeholder="UF" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas</SelectItem>
            {UFS_DISPONIVEIS.map(uf => (
              <SelectItem key={uf} value={uf}>{uf}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={fonteFiltro} onValueChange={setFonteFiltro}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Fonte" /></SelectTrigger>
          <SelectContent>
            {FONTES_DIARIOS.map(f => (
              <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Link direto ao portal selecionado */}
      {fonteFiltro !== 'todos' && fonteAtual?.url && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/5 border border-accent/20 text-xs">
          <Globe className="w-3.5 h-3.5 text-accent shrink-0" />
          <span className="text-muted-foreground">Filtrando por:</span>
          <span className="font-medium">{fonteAtual.label}</span>
          <span className="text-muted-foreground">—</span>
          <a
            href={fonteAtual.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline flex items-center gap-1"
          >
            Acessar portal <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {loading ? 'Carregando...' : `${atosOrdenados.length} atos encontrados${idsRelevantesIA !== null ? ' (filtro IA ativo)' : ''}`}
      </p>

      {/* Lista de atos */}
      <div className="space-y-2">
        {atosOrdenados.map(ato => {
          const cfg = tipoConfig[ato.tipo || ''] || { label: ato.tipo || 'Outro', icon: FileText, color: 'bg-muted text-muted-foreground border-border' };
          const Icon = cfg.icon;
          return (
            <div
              key={ato.id}
              className={cn(
                "bg-card rounded-xl border border-border/50 p-4 shadow-sm hover:shadow-md transition-shadow",
                !ato.lido && "border-l-2 border-l-accent"
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", cfg.color)}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <Badge variant="outline" className={cn(cfg.color, "text-[10px]")}>
                        {cfg.label}
                      </Badge>
                      {ato.portal && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Globe className="w-3 h-3" /> {ato.portal}
                        </span>
                      )}
                      {ato.relevancia_score && ato.relevancia_score >= 80 && (
                        <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-[10px]">
                          Alta relevância
                        </Badge>
                      )}
                      {!ato.lido && (
                        <Badge variant="outline" className="bg-accent/10 text-accent border-accent/20 text-[10px]">
                          Novo
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium leading-snug">{ato.titulo}</p>
                    
                    {/* Texto Integral - formato diário oficial */}
                    {ato.texto_integral && (
                      <div className="mt-2">
                        <button
                          onClick={() => setExpandedIds(prev => {
                            const next = new Set(prev);
                            if (next.has(ato.id)) next.delete(ato.id); else next.add(ato.id);
                            return next;
                          })}
                          className="text-[10px] text-accent hover:underline flex items-center gap-1"
                        >
                          <FileText className="w-3 h-3" />
                          {expandedIds.has(ato.id) ? 'Ocultar texto integral' : 'Ver texto integral (formato DO)'}
                          {expandedIds.has(ato.id) ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                        {expandedIds.has(ato.id) && (
                          <div className="mt-1.5 p-3 rounded-lg bg-muted/50 border border-border/40">
                            <p className="text-xs font-mono leading-relaxed whitespace-pre-wrap text-foreground/90">
                              {ato.texto_integral}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3" /> {ato.orgao}
                      </span>
                      {ato.municipio && ato.uf && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {ato.municipio}/{ato.uf}
                        </span>
                      )}
                      {ato.data_publicacao && (
                        <span>{new Date(ato.data_publicacao).toLocaleDateString('pt-BR')}</span>
                      )}
                      {ato.valor_estimado && (
                        <span className="font-medium text-foreground">{formatCurrency(ato.valor_estimado)}</span>
                      )}
                    </div>
                    {ato.palavras_chave && ato.palavras_chave.length > 0 && (
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {ato.palavras_chave.slice(0, 4).map((kw, i) => (
                          <span key={i} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{kw}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {!ato.lido && (
                    <Button size="sm" variant="ghost" className="h-7 px-2" title="Marcar como lido" onClick={() => marcarComoLido(ato.id)}>
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 gap-1"
                    onClick={() => handleExportSingleDO(ato)}
                    title="Exportar publicação em PDF (formato DO)"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span className="text-[10px] hidden sm:inline">PDF</span>
                  </Button>
                  {ato.url && (
                    <Button size="sm" variant="outline" className="h-7 px-2 gap-1" asChild>
                      <a href={ato.url} target="_blank" rel="noopener noreferrer" title="Ver no portal">
                        <Globe className="w-3.5 h-3.5" />
                        <span className="text-[10px] hidden sm:inline">Portal</span>
                      </a>
                    </Button>
                  )}
                  {ato.url && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 gap-1"
                      disabled={downloadingId === ato.id}
                      onClick={() => handleDownloadPublicacao(ato)}
                      title="Baixar publicação original"
                    >
                      {downloadingId === ato.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      <span className="text-[10px] hidden sm:inline">Baixar</span>
                    </Button>
                  )}
                  {!ato.url && (
                    <span className="text-[10px] text-muted-foreground italic">Sem link</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {!loading && atosOrdenados.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Newspaper className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Nenhum ato encontrado nos diários oficiais.</p>
            <p className="text-xs mt-1">Clique em "Buscar Diários Oficiais" ou use a pesquisa avançada com IA para iniciar.</p>
            <div className="flex justify-center gap-2 mt-4">
              <Button size="sm" variant="outline" onClick={() => setMostrarPortais(true)}>
                <Globe className="w-3.5 h-3.5 mr-1" /> Ver portais disponíveis
              </Button>
              <Button size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground" onClick={handleBuscar} disabled={buscando}>
                <Search className="w-3.5 h-3.5 mr-1" /> Buscar agora
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
