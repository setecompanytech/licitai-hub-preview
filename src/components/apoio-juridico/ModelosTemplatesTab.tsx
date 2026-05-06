import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { streamAIChat } from '@/lib/ai-stream';
import ReactMarkdown from 'react-markdown';
import DocumentosPeticaoUploader, { type FatoPeticao } from './DocumentosPeticaoUploader';
import { exportLegalPDF, exportLegalWord } from '@/lib/legal-document-export';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import {
  Search, BookOpen, FileText, Download, Copy, Sparkles, Loader2,
  MessageSquare, FileWarning, Gavel, ArrowUpDown, ShieldQuestion,
  Calculator, Filter, X, TrendingUp, Users, ChevronDown, ChevronUp,
  Scale, SlidersHorizontal, ListChecks, Target, Shield, Info,
  Landmark, Award, Upload, CheckCircle, Building2, User, FolderOpen, Hash,
  Eye, FileCode, AArrowDown, AArrowUp, RotateCcw, ArrowLeft,
} from 'lucide-react';
import { MODALIDADES, type ModalidadeLicitacao } from '@/data/modalidades-licitacao';
import { useJuridicoPedidos, type JuridicoPedido } from '@/hooks/useJuridicoPedidos';
import { useProcessoAtivo } from '@/hooks/useProcessoAtivo';
import PedidosJuridicosList from './PedidosJuridicosList';
import ModeloCard from './ModeloCard';
import PreviewEstruturaDocumento from './PreviewEstruturaDocumento';

/* ── Types ── */
type Modelo = {
  id: string; titulo: string; categoria: string; descricao: string;
  icon: typeof FileText; fundamentacao: string;
  requisitosFiltro: ('indices' | 'ccts' | 'base_juridica' | 'contrato')[];
};

type DocRef = { id: string; titulo: string; tipo: string; ementa: string | null; texto_integral: string | null };
type Indice = { id: string; nome: string; sigla: string; valor: number; variacao_mensal: number | null; acumulado_12m: number | null; periodo: string; fonte: string };
type CCT = { id: string; categoria_profissional: string; piso_salarial: number | null; reajuste_percentual: number | null; indice_reajuste: string | null; vigencia_inicio: string | null; vigencia_fim: string | null; sindicato_laboral: string | null; abrangencia_uf: string | null };

/* ── Data ── */
const modelos: Modelo[] = [
  { id: '1', titulo: 'Pedido de Esclarecimento', categoria: 'Esclarecimentos', descricao: 'Solicitar esclarecimentos sobre termos ambíguos do edital', icon: MessageSquare, fundamentacao: 'Art. 164 da Lei 14.133/2021', requisitosFiltro: ['base_juridica'] },
  { id: '2', titulo: 'Impugnação ao Edital', categoria: 'Impugnações', descricao: 'Contestar cláusulas restritivas ou ilegais do edital', icon: FileWarning, fundamentacao: 'Art. 164 da Lei 14.133/2021', requisitosFiltro: ['base_juridica'] },
  { id: '3', titulo: 'Recurso Administrativo', categoria: 'Recursos', descricao: 'Recurso contra decisão de habilitação ou julgamento', icon: Gavel, fundamentacao: 'Art. 165 da Lei 14.133/2021', requisitosFiltro: ['base_juridica'] },
  { id: '4', titulo: 'Contrarrazões de Recurso', categoria: 'Recursos', descricao: 'Resposta ao recurso interposto por outro licitante', icon: ArrowUpDown, fundamentacao: 'Art. 165, §3º da Lei 14.133/2021', requisitosFiltro: ['base_juridica'] },
  { id: '5', titulo: 'Pedido de Reconsideração', categoria: 'Recursos', descricao: 'Reconsideração de penalidades aplicadas', icon: ShieldQuestion, fundamentacao: 'Art. 166 da Lei 14.133/2021', requisitosFiltro: [] },
  { id: '6', titulo: 'Recurso Hierárquico', categoria: 'Recursos', descricao: 'Recurso à autoridade superior quando pedido de reconsideração indeferido', icon: ArrowUpDown, fundamentacao: 'Art. 167 da Lei 14.133/2021', requisitosFiltro: ['base_juridica'] },
  { id: '7', titulo: 'Reajuste Contratual (Índice)', categoria: 'Reequilíbrio', descricao: 'Aplicação de índice de preços previsto no contrato para recomposição inflacionária', icon: TrendingUp, fundamentacao: 'Art. 92, §3º e Art. 135, I da Lei 14.133/2021', requisitosFiltro: ['indices', 'contrato', 'base_juridica'] },
  { id: '8', titulo: 'Repactuação (MO/CCT)', categoria: 'Reequilíbrio', descricao: 'Revisão de custos de mão de obra por dissídio coletivo', icon: Users, fundamentacao: 'Art. 135, I da Lei 14.133/2021', requisitosFiltro: ['ccts', 'indices', 'contrato', 'base_juridica'] },
  { id: '9', titulo: 'Revisão / Reequilíbrio Stricto Sensu', categoria: 'Reequilíbrio', descricao: 'Reequilíbrio por fatos imprevisíveis (caso fortuito, força maior, fato do príncipe)', icon: Scale, fundamentacao: 'Art. 124, II, "d" da Lei 14.133/2021', requisitosFiltro: ['indices', 'contrato', 'base_juridica'] },
  { id: '10', titulo: 'Planilha de Composição de Custos', categoria: 'Propostas', descricao: 'Modelo de planilha analítica de custos e formação de preços', icon: Calculator, fundamentacao: 'Art. 58 da Lei 14.133/2021', requisitosFiltro: ['indices'] },
  { id: '11', titulo: 'Declaração de ME/EPP', categoria: 'Declarações', descricao: 'Declaração de enquadramento como microempresa ou EPP', icon: FileText, fundamentacao: 'LC 123/2006, Art. 3º', requisitosFiltro: [] },
  { id: '12', titulo: 'Declaração de Inexistência de Fato Impeditivo', categoria: 'Declarações', descricao: 'Declaração de que não existem fatos impeditivos à habilitação', icon: FileText, fundamentacao: 'Art. 63, §1º da Lei 14.133/2021', requisitosFiltro: [] },
  { id: '13', titulo: 'Declaração de Não Emprego de Menor', categoria: 'Declarações', descricao: 'Cumprimento ao disposto no Art. 7º, XXXIII da CF', icon: FileText, fundamentacao: 'Art. 68, VI da Lei 14.133/2021', requisitosFiltro: [] },
  { id: '14', titulo: 'Declaração de Reserva de Cargos (PCD)', categoria: 'Declarações', descricao: 'Cumprimento da reserva de cargos para PCD e reabilitados', icon: FileText, fundamentacao: 'Art. 63, IV da Lei 14.133/2021', requisitosFiltro: [] },
  { id: '15', titulo: 'Declaração de Idoneidade', categoria: 'Declarações', descricao: 'Declaração de que não foi declarada inidônea por nenhum órgão público', icon: Shield, fundamentacao: 'Art. 156, §§ 4º e 5º da Lei 14.133/2021', requisitosFiltro: [] },
  { id: '16', titulo: 'Declaração de Nepotismo', categoria: 'Declarações', descricao: 'Declaração de inexistência de vínculo familiar com agentes públicos do órgão licitante', icon: Users, fundamentacao: 'Súmula Vinculante 13/STF + Art. 14, IV da Lei 14.133/2021', requisitosFiltro: [] },
  { id: '17', titulo: 'Declaração de Elaboração Independente de Proposta', categoria: 'Declarações', descricao: 'Declaração anticolusão garantindo elaboração independente da proposta', icon: FileText, fundamentacao: 'Art. 63 da Lei 14.133/2021 + IN 2/2009 MPOG', requisitosFiltro: [] },
  { id: '18', titulo: 'Declaração de Responsabilidade (Lei Anticorrupção)', categoria: 'Declarações', descricao: 'Compromisso de cumprimento da legislação anticorrupção e compliance', icon: Shield, fundamentacao: 'Lei 12.846/2013, Art. 5º + Art. 156 da Lei 14.133/2021', requisitosFiltro: [] },
  { id: '19', titulo: 'Defesa Prévia (Sanções Administrativas)', categoria: 'Defesas', descricao: 'Defesa prévia em procedimento de aplicação de penalidades administrativas', icon: Scale, fundamentacao: 'Art. 157, §1º da Lei 14.133/2021', requisitosFiltro: ['base_juridica', 'contrato'] },
  { id: '20', titulo: 'Representação ao Tribunal de Contas', categoria: 'Representações', descricao: 'Representação ao TCU/TCE para denúncia de irregularidades em licitação', icon: Landmark, fundamentacao: 'Arts. 170-171 da Lei 14.133/2021', requisitosFiltro: ['base_juridica'] },
  { id: '21', titulo: 'Pedido de Aditivo Contratual', categoria: 'Contratos', descricao: 'Solicitação de alteração contratual (quantitativa, qualitativa ou de prazo)', icon: FileText, fundamentacao: 'Arts. 124-125 da Lei 14.133/2021', requisitosFiltro: ['contrato', 'base_juridica'] },
  { id: '22', titulo: 'Mandado de Segurança Licitatório', categoria: 'Judicial', descricao: 'Remédio constitucional contra ato ilegal ou abusivo de autoridade em licitação', icon: Gavel, fundamentacao: 'CF/88, Art. 5º, LXIX + Lei 12.016/2009', requisitosFiltro: ['base_juridica'] },
  { id: '23', titulo: 'Parecer Jurídico', categoria: 'Pareceres', descricao: 'Análise técnico-jurídica sobre questões do processo licitatório ou contratual', icon: BookOpen, fundamentacao: 'Art. 53, §4º da Lei 14.133/2021', requisitosFiltro: ['base_juridica'] },
  { id: '24', titulo: 'Declaração de Acessibilidade', categoria: 'Declarações', descricao: 'Declaração de cumprimento das normas de acessibilidade para PcD', icon: FileText, fundamentacao: 'Art. 63, §1º, III da Lei 14.133/2021 + Lei 13.146/2015', requisitosFiltro: [] },
];

const categorias = [...new Set(modelos.map(m => m.categoria))];
const fmtPerc = (v: number | null) => v != null ? `${v >= 0 ? '+' : ''}${v.toFixed(2)}%` : '—';

export default function ModelosTemplatesTab() {
  const { user } = useAuth();

  // Filters
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Modality filter
  const [modalidadeId, setModalidadeId] = useState<string | null>(null);
  const [etapaFiltro, setEtapaFiltro] = useState<string | null>(null);
  const [criterioFiltro, setCriterioFiltro] = useState<string | null>(null);
  const [showModalidadeInfo, setShowModalidadeInfo] = useState(false);

  // Edital upload for auto-extraction
  const editalFileRef = useRef<HTMLInputElement>(null);
  const [editalUploadFile, setEditalUploadFile] = useState<File | null>(null);
  const [extractingEdital, setExtractingEdital] = useState(false);
  const [editalExtracted, setEditalExtracted] = useState(false);
  const [extractedEditalContext, setExtractedEditalContext] = useState('');

  // Empresa / Representante Legal
  const { empresas } = useEmpresa();
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string | null>(null);
  const [incluirDadosEmpresa, setIncluirDadosEmpresa] = useState(true);
  const [incluirRepresentante, setIncluirRepresentante] = useState(true);

  const selectedEmpresa = useMemo(() => {
    if (!selectedEmpresaId) return empresas.length === 1 ? empresas[0]?.empresa : null;
    return empresas.find(e => e.empresa_id === selectedEmpresaId)?.empresa || null;
  }, [selectedEmpresaId, empresas]);

  // Auto-select if only one empresa
  useEffect(() => {
    if (empresas.length === 1 && !selectedEmpresaId) {
      setSelectedEmpresaId(empresas[0].empresa_id);
    }
  }, [empresas, selectedEmpresaId]);

  // Research data
  const [indices, setIndices] = useState<Indice[]>([]);
  const [ccts, setCcts] = useState<CCT[]>([]);
  const [docsBase, setDocsBase] = useState<DocRef[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Generation state
  const [activeModeloId, setActiveModeloId] = useState<string | null>(null);
  // Quando aberto via deep-link (?modelo=...), renderiza inline (página completa)
  // ao invés do Sheet/Drawer modal — para parecer uma página própria.
  const [inlineMode, setInlineMode] = useState<boolean>(false);

  // Deep-link: abrir modelo automaticamente via /apoio-juridico/redigir/:modeloId
  // ou (legacy) ?modelo=<id> — ambos suportam abertura em nova aba.
  const { modeloId: routeModeloId } = useParams<{ modeloId?: string }>();
  const navigate = useNavigate();
  useEffect(() => {
    if (routeModeloId) {
      setActiveModeloId(routeModeloId);
      setInlineMode(true);
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const mid = params.get('modelo');
    if (mid) {
      setActiveModeloId(mid);
      setInlineMode(true);
    }
  }, [routeModeloId]);
  const [contexto, setContexto] = useState('');
  const [editalNum, setEditalNum] = useState('');
  const [selectedIndices, setSelectedIndices] = useState<string[]>([]);
  const [selectedCCTs, setSelectedCCTs] = useState<string[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [resultado, setResultado] = useState('');
  const [gerando, setGerando] = useState(false);

  // Pedidos jurídicos (persistência)
  const { pedidos, criarPedido, salvarVersao } = useJuridicoPedidos();
  const { processo } = useProcessoAtivo();
  const [pedidoAtivo, setPedidoAtivo] = useState<JuridicoPedido | null>(null);
  const [showPedidos, setShowPedidos] = useState(false);

  // Preferência de tamanho da fonte da área de filtros (persistente em localStorage)
  // Escala em passos: 0=85%, 1=100% (padrão), 2=115%, 3=130%, 4=145%
  const FILTER_FONT_KEY = 'apoio-juridico:filtros:fontStep';
  const FILTER_FONT_SCALES = [0.85, 1, 1.15, 1.3, 1.45];
  const [filterFontStep, setFilterFontStep] = useState<number>(() => {
    if (typeof window === 'undefined') return 1;
    const v = Number(window.localStorage.getItem(FILTER_FONT_KEY));
    return Number.isFinite(v) && v >= 0 && v < FILTER_FONT_SCALES.length ? v : 1;
  });
  useEffect(() => {
    try { window.localStorage.setItem(FILTER_FONT_KEY, String(filterFontStep)); } catch {}
  }, [filterFontStep]);

  // Cap responsivo: em telas pequenas, limita a escala máxima para evitar
  // que a barra de filtros estoure a viewport ou sobreponha elementos.
  // <480px: máx 1.0 (sem aumento); <640px: máx 1.15; <768px: máx 1.30
  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window === 'undefined' ? 1280 : window.innerWidth
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const maxScaleForViewport = viewportWidth < 480 ? 1 : viewportWidth < 640 ? 1.15 : viewportWidth < 768 ? 1.3 : 1.45;
  const filterFontScale = Math.min(FILTER_FONT_SCALES[filterFontStep], maxScaleForViewport);
  const isFontCapped = FILTER_FONT_SCALES[filterFontStep] > maxScaleForViewport;

  // Pré-preenchimento a partir do processo ativo (vinculação automática)
  useEffect(() => {
    if (!processo) return;
    if (!editalNum && processo.numero) setEditalNum(processo.numero);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processo?.id]);

  // Contagem de pedidos por modelo (para badge)
  const pedidosPorModelo = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of pedidos) {
      if (p.modelo_id) map[p.modelo_id] = (map[p.modelo_id] || 0) + 1;
    }
    return map;
  }, [pedidos]);

  // Petition upload state
  const [showPeticaoUploader, setShowPeticaoUploader] = useState(false);
  const [fatosPeticao, setFatosPeticao] = useState<FatoPeticao[]>([]);
  const [peticaoDocsTexto, setPeticaoDocsTexto] = useState('');

  const modalidade = MODALIDADES.find(m => m.id === modalidadeId) || null;

  // Handle edital upload and AI extraction
  const handleEditalUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedTypes = ['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type) && !file.name.endsWith('.txt')) {
      toast.error('Formato inválido. Use PDF, DOC, DOCX ou TXT.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 10MB.');
      return;
    }
    setEditalUploadFile(file);
    setEditalExtracted(false);
    setExtractedEditalContext('');
  };

  const handleExtractEdital = async () => {
    if (!editalUploadFile) return;
    setExtractingEdital(true);

    const text = await editalUploadFile.text();
    const truncated = text.slice(0, 20000);
    let content = '';

    const modalidadeNames = MODALIDADES.map(m => m.id + '=' + m.nome).join(', ');

    await streamAIChat({
      messages: [{
        role: 'user',
        content: `Analise o Edital abaixo e extraia as informações no formato JSON:

{
  "modalidade_id": "ID da modalidade entre: ${modalidadeNames}",
  "numero_licitacao": "número completo do pregão/licitação",
  "orgao": "órgão licitante",
  "objeto": "descrição do objeto",
  "criterio_julgamento": "critério de julgamento identificado (menor preço, melhor técnica, etc)",
  "modo_disputa": "modo de disputa (aberto, fechado, aberto e fechado)",
  "etapa_atual": "etapa atual do processo se identificável",
  "me_epp": "informações sobre tratamento diferenciado para ME/EPP",
  "valor_estimado": "valor estimado se disponível",
  "prazo_validade": "prazo de validade da proposta",
  "resumo_edital": "resumo executivo do edital em até 200 palavras"
}

REGRAS:
- Identifique a modalidade exata (Pregão Eletrônico, Concorrência, Concurso, Leilão, Diálogo Competitivo, Dispensa Eletrônica)
- Se não encontrar um campo, use string vazia ""
- Retorne APENAS o JSON válido, sem explicações

TEXTO DO EDITAL:
${truncated}`
      }],
      action: 'analise_edital',
      onDelta: (chunk) => { content += chunk; },
      onDone: () => {
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const data = JSON.parse(jsonMatch[0]);

            // Auto-fill modalidade
            if (data.modalidade_id) {
              const found = MODALIDADES.find(m => m.id === data.modalidade_id);
              if (found) {
                setModalidadeId(found.id);
                // Try to match criteria
                if (data.criterio_julgamento) {
                  const criterioMatch = found.criteriosJulgamento.find(c =>
                    c.nome.toLowerCase().includes(data.criterio_julgamento.toLowerCase()) ||
                    data.criterio_julgamento.toLowerCase().includes(c.nome.toLowerCase())
                  );
                  if (criterioMatch) setCriterioFiltro(criterioMatch.id);
                }
              }
            }

            // Auto-fill edital number
            if (data.numero_licitacao) setEditalNum(data.numero_licitacao);

            // Build extracted context for AI generation
            let ctx = '';
            if (data.orgao) ctx += `Órgão: ${data.orgao}\n`;
            if (data.objeto) ctx += `Objeto: ${data.objeto}\n`;
            if (data.valor_estimado) ctx += `Valor estimado: ${data.valor_estimado}\n`;
            if (data.prazo_validade) ctx += `Prazo validade: ${data.prazo_validade}\n`;
            if (data.modo_disputa) ctx += `Modo de disputa: ${data.modo_disputa}\n`;
            if (data.me_epp) ctx += `ME/EPP: ${data.me_epp}\n`;
            if (data.resumo_edital) ctx += `\nResumo: ${data.resumo_edital}\n`;
            setExtractedEditalContext(ctx);

            // Pre-fill contexto if empty
            if (!contexto && data.resumo_edital) {
              setContexto(data.resumo_edital);
            }

            setEditalExtracted(true);
            toast.success('Dados do edital extraídos com sucesso!');
          } else {
            toast.error('Não foi possível extrair dados estruturados do edital.');
          }
        } catch {
          toast.error('Erro ao processar dados do edital.');
        }
        setExtractingEdital(false);
      },
      onError: (err) => {
        toast.error(err);
        setExtractingEdital(false);
      },
    });
  };

  const removeEditalUpload = () => {
    setEditalUploadFile(null);
    setEditalExtracted(false);
    setExtractedEditalContext('');
    if (editalFileRef.current) editalFileRef.current.value = '';
  };

  // Load research data
  useEffect(() => {
    if (!user) return;
    setLoadingData(true);
    Promise.all([
      supabase.from('indices_economicos').select('id, nome, sigla, valor, variacao_mensal, acumulado_12m, periodo, fonte').order('sigla'),
      supabase.from('convencoes_coletivas').select('id, categoria_profissional, piso_salarial, reajuste_percentual, indice_reajuste, vigencia_inicio, vigencia_fim, sindicato_laboral, abrangencia_uf').eq('status', 'vigente'),
      supabase.from('base_juridica').select('id, titulo, tipo, ementa, texto_integral').order('created_at', { ascending: false }).limit(50),
    ]).then(([indRes, cctRes, docRes]) => {
      setIndices((indRes.data as Indice[]) || []);
      setCcts((cctRes.data as CCT[]) || []);
      setDocsBase((docRes.data as DocRef[]) || []);
      setLoadingData(false);
    });
  }, [user]);

  // Filtered models
  const filteredModelos = useMemo(() => {
    return modelos.filter(m => {
      const matchSearch = !search ||
        m.titulo.toLowerCase().includes(search.toLowerCase()) ||
        m.categoria.toLowerCase().includes(search.toLowerCase()) ||
        m.descricao.toLowerCase().includes(search.toLowerCase()) ||
        m.fundamentacao.toLowerCase().includes(search.toLowerCase());
      const matchCat = !catFilter || m.categoria === catFilter;
      return matchSearch && matchCat;
    });
  }, [search, catFilter]);

  const activeModelo = modelos.find(m => m.id === activeModeloId);

  // Map model titles to PETICAO_CONFIG keys for petition upload
  const MODELO_PETICAO_MAP: Record<string, string> = {
    'Pedido de Esclarecimento': 'Pedido de Esclarecimento',
    'Impugnação ao Edital': 'Impugnação ao Edital',
    'Recurso Administrativo': 'Recurso Administrativo',
    'Contrarrazões de Recurso': 'Contrarrazões',
    'Pedido de Reconsideração': 'Pedido de Reconsideração',
    'Recurso Hierárquico': 'Recurso Hierárquico',
    'Defesa Prévia (Sanções Administrativas)': 'Defesa Prévia',
    'Representação ao Tribunal de Contas': 'Representação ao TCU',
    'Mandado de Segurança Licitatório': 'Mandado de Segurança',
    'Parecer Jurídico': 'Parecer Jurídico',
  };
  const peticaoConfigKey = activeModelo ? MODELO_PETICAO_MAP[activeModelo.titulo] : null;
  const isPeticaoType = !!peticaoConfigKey;

  const toggle = (list: string[], id: string, setter: (v: string[]) => void) => {
    setter(list.includes(id) ? list.filter(x => x !== id) : [...list, id]);
  };

  // Build AI context with modality info and generate
  const handleGerar = async () => {
    if (!activeModelo) return;
    if (!contexto.trim() && fatosPeticao.length === 0) {
      toast.error('Descreva o contexto ou anexe documentos para extração de fatos');
      return;
    }
    setGerando(true);
    setResultado('');

    let fullContext = '';

    // Inject empresa and representative data
    if (selectedEmpresa) {
      if (incluirDadosEmpresa) {
        fullContext += `\n--- DADOS DA EMPRESA (LICITANTE/PETICIONANTE) ---\n`;
        fullContext += `Razão Social: ${selectedEmpresa.razao_social}\n`;
        if (selectedEmpresa.nome_fantasia) fullContext += `Nome Fantasia: ${selectedEmpresa.nome_fantasia}\n`;
        fullContext += `CNPJ: ${selectedEmpresa.cnpj}\n`;
        if (selectedEmpresa.endereco) fullContext += `Endereço: ${selectedEmpresa.endereco}${selectedEmpresa.complemento ? `, ${selectedEmpresa.complemento}` : ''}${selectedEmpresa.bairro ? `, ${selectedEmpresa.bairro}` : ''}\n`;
        if (selectedEmpresa.municipio) fullContext += `Município/UF: ${selectedEmpresa.municipio}/${selectedEmpresa.uf || ''}\n`;
        if (selectedEmpresa.cep) fullContext += `CEP: ${selectedEmpresa.cep}\n`;
        if (selectedEmpresa.inscricao_estadual) fullContext += `Inscrição Estadual: ${selectedEmpresa.inscricao_estadual}\n`;
        if (selectedEmpresa.inscricao_municipal) fullContext += `Inscrição Municipal: ${selectedEmpresa.inscricao_municipal}\n`;
        if (selectedEmpresa.telefone) fullContext += `Telefone: ${selectedEmpresa.telefone}\n`;
        if (selectedEmpresa.email) fullContext += `E-mail: ${selectedEmpresa.email}\n`;
        if (selectedEmpresa.regime_tributario) fullContext += `Regime Tributário: ${selectedEmpresa.regime_tributario}\n`;
        if (selectedEmpresa.cnae_principal) fullContext += `CNAE Principal: ${selectedEmpresa.cnae_principal}\n`;
      }
      if (incluirRepresentante && selectedEmpresa.rep_nome) {
        fullContext += `\n--- REPRESENTANTE LEGAL ---\n`;
        fullContext += `Nome: ${selectedEmpresa.rep_nome}\n`;
        if (selectedEmpresa.rep_cpf) fullContext += `CPF: ${selectedEmpresa.rep_cpf}\n`;
        if (selectedEmpresa.rep_rg) fullContext += `RG: ${selectedEmpresa.rep_rg}${selectedEmpresa.rep_orgao_expedidor ? ` (${selectedEmpresa.rep_orgao_expedidor})` : ''}\n`;
        if (selectedEmpresa.rep_cargo) fullContext += `Cargo: ${selectedEmpresa.rep_cargo}\n`;
        if (selectedEmpresa.rep_naturalidade) fullContext += `Naturalidade: ${selectedEmpresa.rep_naturalidade}\n`;
        if (selectedEmpresa.rep_nacionalidade) fullContext += `Nacionalidade: ${selectedEmpresa.rep_nacionalidade}\n`;
      }
    }

    // Inject modality context
    if (modalidade) {
      fullContext += `\n\n--- MODALIDADE DE LICITAÇÃO ---\n`;
      fullContext += `Modalidade: ${modalidade.nome}\n`;
      fullContext += `Fundamentação: ${modalidade.fundamentacao}\n`;
      fullContext += `Objeto aplicável: ${modalidade.objetoAplicavel}\n`;
      fullContext += `Forma de realização: ${modalidade.formaRealizacao}\n`;
      fullContext += `Prazos mínimos: ${modalidade.prazosMinimos}\n`;

      // Inject specific stage if selected
      if (etapaFiltro) {
        const etapa = modalidade.etapas.find(e => e.nome === etapaFiltro);
        if (etapa) {
          fullContext += `\nETAPA DO PROCESSO: ${etapa.nome}\n`;
          fullContext += `Descrição: ${etapa.descricao}\n`;
          fullContext += `Fundamentação: ${etapa.fundamentacao}\n`;
        }
      } else {
        fullContext += `\nETAPAS DO PROCESSO:\n`;
        modalidade.etapas.forEach(e => {
          fullContext += `${e.ordem}. ${e.nome}: ${e.descricao} (${e.fundamentacao})\n`;
        });
      }

      // Inject judgment criteria
      if (criterioFiltro) {
        const criterio = modalidade.criteriosJulgamento.find(c => c.id === criterioFiltro);
        if (criterio) {
          fullContext += `\nCRITÉRIO DE JULGAMENTO: ${criterio.nome} (${criterio.fundamentacao})\n`;
          fullContext += `${criterio.descricao}\n`;
        }
      } else {
        fullContext += `\nCRITÉRIOS DE JULGAMENTO APLICÁVEIS:\n`;
        modalidade.criteriosJulgamento.forEach(c => {
          fullContext += `- ${c.nome} (${c.fundamentacao}): ${c.descricao}${c.obrigatorio ? ' [OBRIGATÓRIO]' : ''}\n`;
        });
      }

      // Inject dispute modes
      fullContext += `\nMODOS DE DISPUTA:\n`;
      modalidade.modosDisputa.forEach(m => {
        fullContext += `- ${m.nome} (${m.fundamentacao}): ${m.descricao}${m.padrao ? ' [PADRÃO]' : ''}\n`;
      });

      // Inject ME/EPP preferences
      fullContext += `\nPREFERÊNCIA ME/EPP:\n`;
      fullContext += `Aplicável: ${modalidade.preferenciaMeEpp.aplicavel ? 'SIM' : 'NÃO'}\n`;
      fullContext += `${modalidade.preferenciaMeEpp.descricao}\n`;
      fullContext += `Fundamentação: ${modalidade.preferenciaMeEpp.fundamentacao}\n`;
      if (modalidade.preferenciaMeEpp.beneficios.length > 0) {
        fullContext += `Benefícios:\n`;
        modalidade.preferenciaMeEpp.beneficios.forEach(b => {
          fullContext += `  • ${b}\n`;
        });
      }
    }

    // Attach selected indices
    if (selectedIndices.length > 0) {
      fullContext += '\n\n--- ÍNDICES ECONÔMICOS SELECIONADOS ---\n';
      for (const idx of indices.filter(i => selectedIndices.includes(i.id))) {
        fullContext += `- ${idx.sigla} (${idx.nome}): Valor ${idx.valor}, Variação mensal ${fmtPerc(idx.variacao_mensal)}, Acumulado 12m ${fmtPerc(idx.acumulado_12m)}, Período: ${idx.periodo}, Fonte: ${idx.fonte}\n`;
      }
    }

    // Attach selected CCTs
    if (selectedCCTs.length > 0) {
      fullContext += '\n\n--- CONVENÇÕES COLETIVAS SELECIONADAS ---\n';
      for (const c of ccts.filter(ct => selectedCCTs.includes(ct.id))) {
        fullContext += `- ${c.categoria_profissional}: Piso ${c.piso_salarial ? `R$ ${c.piso_salarial}` : 'N/I'}, Reajuste ${c.reajuste_percentual ? `${c.reajuste_percentual}%` : 'N/I'}, Índice ${c.indice_reajuste || 'N/I'}, Vigência ${c.vigencia_inicio || '?'} a ${c.vigencia_fim || '?'}\n`;
      }
    }

    // Attach selected base jurídica docs
    if (selectedDocs.length > 0) {
      fullContext += '\n\n--- DOCUMENTOS DA BASE JURÍDICA ---\n';
      for (const doc of docsBase.filter(d => selectedDocs.includes(d.id))) {
        fullContext += `\n### ${doc.titulo} (${doc.tipo})\n`;
        if (doc.ementa) fullContext += `Ementa: ${doc.ementa}\n`;
        if (doc.texto_integral) fullContext += `Texto: ${doc.texto_integral.slice(0, 4000)}\n`;
      }
    }

    // Attach petition facts from document upload
    if (fatosPeticao.length > 0) {
      fullContext += '\n\n--- FATOS/IRREGULARIDADES EXTRAÍDOS DOS DOCUMENTOS ---\n';
      fatosPeticao.forEach((fato, idx) => {
        fullContext += `\n${idx + 1}. [${fato.gravidade.toUpperCase()}] [${fato.categoria}] ${fato.origem === 'ia' ? '(IA)' : fato.origem === 'concorrente' ? '(Inteligência Concorrente)' : '(Manual)'}\n`;
        fullContext += `   Descrição: ${fato.descricao}\n`;
        fullContext += `   Fundamentação: ${fato.fundamentacao}\n`;
      });
      if (peticaoDocsTexto) {
        fullContext += `\n--- INFORMAÇÕES COMPLEMENTARES DOS DOCUMENTOS ---\n${peticaoDocsTexto}\n`;
      }
    }

    // Type-specific instructions
    let instrucao = '';
    if (activeModelo.categoria === 'Reequilíbrio') {
      if (activeModelo.id === '7') {
        instrucao = 'Gere pedido de REAJUSTE CONTRATUAL por índice (Art. 92, §3º e Art. 135, I da Lei 14.133/2021). Automático, anual, por apostilamento. Demonstre cálculo com índice selecionado.';
      } else if (activeModelo.id === '8') {
        instrucao = 'Gere pedido de REPACTUAÇÃO por dissídio/CCT (Art. 135, I da Lei 14.133/2021). Exclusivo para serviços com dedicação exclusiva de MO. Demonstre variação via planilha de custos (antes/depois).';
      } else if (activeModelo.id === '9') {
        instrucao = 'Gere pedido de REVISÃO/REEQUILÍBRIO STRICTO SENSU (Art. 124, II, "d" da Lei 14.133/2021). Aplique Teoria da Imprevisão. Demonstre nexo causal e onerosidade excessiva.';
      }
    } else if (activeModelo.categoria === 'Recursos' && fatosPeticao.length > 0) {
      instrucao = `Gere ${activeModelo.titulo} COMPLETO com base nos ${fatosPeticao.length} fatos jurídicos extraídos dos documentos anexados. Para CADA fato: 1) Descreva objetivamente; 2) Apresente fundamentação jurídica (Lei 14.133/2021, TCU); 3) Formule o pedido específico. Estruture com: I) Endereçamento; II) Qualificação; III) Tempestividade (${activeModelo.fundamentacao}); IV) Dos Fatos; V) Do Direito; VI) Dos Pedidos; VII) Fecho. Linguagem técnica, objetiva e impessoal.`;
    } else if (activeModelo.categoria === 'Recursos') {
      instrucao = `Gere ${activeModelo.titulo} com fundamentação na ${activeModelo.fundamentacao}. Estruture com: I) Tempestividade; II) Fatos; III) Fundamentos jurídicos; IV) Pedido. Linguagem técnica, objetiva e impessoal.`;
    } else if (activeModelo.categoria === 'Impugnações' || activeModelo.categoria === 'Esclarecimentos') {
      if (fatosPeticao.length > 0) {
        instrucao = `Gere ${activeModelo.titulo} COMPLETO com base nas ${fatosPeticao.length} irregularidades/pontos extraídos do edital. Para CADA irregularidade: 1) Descreva o vício/ponto; 2) Cite artigo violado; 3) Demonstre prejuízo; 4) Formule pedido específico. Estruture com: I) Endereçamento; II) Qualificação; III) Tempestividade (${activeModelo.fundamentacao}); IV) Das Irregularidades/Pontos; V) Do Direito; VI) Dos Pedidos; VII) Fecho.`;
      } else {
        instrucao = `Gere ${activeModelo.titulo} com fundamentação no ${activeModelo.fundamentacao}. Estruture com: I) Legitimidade; II) Tempestividade; III) Cláusulas impugnadas; IV) Fundamentação legal; V) Pedido.`;
      }
    } else if (activeModelo.categoria === 'Defesas') {
      instrucao = `Gere ${activeModelo.titulo} COMPLETO (${activeModelo.fundamentacao}). Estruture com: I) Endereçamento à autoridade competente; II) Qualificação do defendente; III) Da Tempestividade; IV) Dos Fatos (narrativa cronológica); V) Das Razões de Defesa (fundamentação jurídica, princípios do contraditório e ampla defesa); VI) Da Desproporcionalidade da Penalidade (se aplicável); VII) Dos Pedidos; VIII) Fecho. Linguagem técnica, objetiva e impessoal.`;
    } else if (activeModelo.categoria === 'Representações') {
      instrucao = `Gere ${activeModelo.titulo} COMPLETO (${activeModelo.fundamentacao}). Estruture com: I) Endereçamento ao Tribunal de Contas competente; II) Qualificação do representante; III) Da Legitimidade; IV) Dos Fatos (descrição detalhada das irregularidades); V) Das Violações Legais (fundamentação na Lei 14.133/2021 e jurisprudência do TCU); VI) Das Provas; VII) Dos Pedidos (medidas cautelares, se cabíveis); VIII) Fecho.`;
    } else if (activeModelo.categoria === 'Contratos') {
      instrucao = `Gere ${activeModelo.titulo} COMPLETO (${activeModelo.fundamentacao}). Estruture com: I) Endereçamento; II) Qualificação; III) Do Contrato Original (dados, objeto, vigência); IV) Da Necessidade de Alteração (justificativa técnica e legal); V) Da Fundamentação Legal (Arts. 124-125 da Lei 14.133/2021, limites quantitativos e qualitativos); VI) Da Manutenção do Equilíbrio Econômico-Financeiro; VII) Dos Pedidos; VIII) Fecho.`;
    } else if (activeModelo.categoria === 'Judicial') {
      instrucao = `Gere ${activeModelo.titulo} COMPLETO (${activeModelo.fundamentacao}). Estruture com: I) Endereçamento ao Juízo competente; II) Qualificação do impetrante e da autoridade coatora; III) Do Cabimento do Mandado de Segurança (direito líquido e certo); IV) Da Tempestividade (prazo de 120 dias); V) Dos Fatos; VI) Do Direito (ilegalidade ou abuso de poder); VII) Do Pedido Liminar (fumus boni iuris e periculum in mora); VIII) Dos Pedidos Finais; IX) Fecho. Inclua pedido de notificação da autoridade e oitiva do MP.`;
    } else if (activeModelo.categoria === 'Pareceres') {
      instrucao = `Gere ${activeModelo.titulo} COMPLETO (${activeModelo.fundamentacao}). Estruture com: I) Identificação (número, data, processo); II) Do Objeto da Consulta; III) Dos Fatos; IV) Da Análise Jurídica (fundamentação detalhada na Lei 14.133/2021, doutrina e jurisprudência); V) Da Conclusão; VI) Da Recomendação. Linguagem técnica, impessoal e analítica.`;
    } else {
      instrucao = `Gere ${activeModelo.titulo} conforme ${activeModelo.fundamentacao}. Formato técnico-jurídico, linguagem impessoal e objetiva.`;
    }

    if (modalidade) {
      instrucao += ` IMPORTANTE: O documento refere-se à modalidade ${modalidade.nome} (${modalidade.fundamentacao}). Adeque toda a linguagem, prazos, procedimentos e fundamentação à modalidade indicada.`;
      if (etapaFiltro) {
        instrucao += ` O documento está relacionado à etapa: "${etapaFiltro}". Foque nos procedimentos e fundamentações desta etapa específica.`;
      }
    }

    // Inject extracted edital context
    if (extractedEditalContext) {
      fullContext += `\n\n--- DADOS EXTRAÍDOS DO EDITAL ---\n${extractedEditalContext}`;
    }

    // ── ABNT Legal Writing Quality System Prompt ──
    const abntSystemPrompt = `
VOCÊ É UM ADVOGADO ESPECIALISTA EM DIREITO ADMINISTRATIVO E PÚBLICO, COM DOMÍNIO PLENO DA LINGUÍSTICA JURÍDICA FORENSE. SEU NÍVEL É DE PÓS-GRADUAÇÃO STRICTO SENSU (MESTRADO/DOUTORADO).

REGRAS OBRIGATÓRIAS DE QUALIDADE TEXTUAL JURÍDICA (ABNT):

1. ESTRUTURA TEXTUAL:
   - Use numeração progressiva (ABNT NBR 6024:2012) para seções e subseções
   - Títulos de seção em CAIXA ALTA e negrito
   - Subtítulos em negrito, apenas primeira letra maiúscula
   - Parágrafos com recuo de primeira linha (1,25cm)

2. LINGUAGEM JURÍDICA:
   - Empregue linguagem técnica, impessoal, objetiva e formal
   - Use a terceira pessoa ou voz passiva (nunca "eu" ou "nós")
   - Prefira período composto subordinado quando necessário à precisão
   - Evite coloquialismos, redundâncias e prolixidade
   - Use latinismos jurídicos consagrados quando pertinentes (data venia, ad argumentandum tantum, ex vi legis, mutatis mutandis)
   - Aplique corretamente os pronomes de tratamento (Excelentíssimo, Ilustríssimo, Douto)

3. CITAÇÕES (ABNT NBR 10520:2002):
   - Citações diretas curtas (até 3 linhas): entre aspas duplas, no corpo do texto
   - Citações diretas longas (mais de 3 linhas): em bloco recuado (use > para marcar), fonte menor, sem aspas
   - Citações indiretas: parafrasear com indicação de autoria (SOBRENOME, ano)
   - Citações de legislação: Lei nº X.XXX/XXXX, Art. XX, §Xº, inciso X, alínea "x"
   - Citações de jurisprudência: TRIBUNAL. Tipo de decisão nº. Relator: Min./Des. Nome. Data. Publicação.

4. REFERÊNCIAS DOUTRINÁRIAS:
   - Cite doutrinadores consagrados do Direito Administrativo brasileiro: Celso Antônio Bandeira de Mello, Hely Lopes Meirelles, Maria Sylvia Zanella Di Pietro, José dos Santos Carvalho Filho, Marçal Justen Filho
   - Para licitações especificamente: Joel de Menezes Niebuhr, Jessé Torres Pereira Junior, Jorge Ulisses Jacoby Fernandes
   - Para citações do TCU: use Acórdão nº XXXX/XXXX - Plenário/1ª Câmara/2ª Câmara

5. FUNDAMENTAÇÃO LEGAL OBRIGATÓRIA:
   - Cite artigos, parágrafos, incisos e alíneas com precisão
   - Hierarquia normativa: CF/88 → Leis Complementares → Leis Ordinárias → Decretos → INs
   - Base primária: Lei 14.133/2021 (Nova Lei de Licitações)
   - Bases complementares: LC 123/2006, Decreto 11.462/2023, IN SEGES 73/2022
   - Referência constitucional quando aplicável: Art. 37, XXI da CF/88

6. FORMATAÇÃO DO DOCUMENTO:
   - Use "# " para título principal (centralizado)
   - Use "## " para seções numeradas (I, II, III ou 1, 2, 3)
   - Use "### " para subseções
   - Use "> " para citações longas (blocos de citação)
   - Estruture o documento com: Preâmbulo → Fatos → Fundamentos → Pedido → Encerramento
   - Inclua qualificação completa das partes quando dados da empresa forem fornecidos
   - Finalize com local, data e espaço para assinatura

7. TERMINOLOGIA PRECISA:
   - "licitante" (não "participante" ou "concorrente" genericamente)
   - "Administração Pública" (com maiúsculas)
   - "edital" ou "instrumento convocatório"
   - "habilitação" (não "qualificação")
   - "adjudicação" e "homologação" (distinguir corretamente)
   - "pregoeiro(a)" para pregão; "comissão de licitação" para demais
   - "autoridade superior" (Art. 165, §2º da Lei 14.133/2021)

${instrucao}
Linguagem técnica, objetiva, impessoal e auditável. Cite fontes e períodos dos dados numéricos quando disponíveis.
`;

    fullContext += `\n\n${abntSystemPrompt}`;

    const prompt = `Tipo de Documento: ${activeModelo.titulo}\nCategoria: ${activeModelo.categoria}\nFundamentação Legal: ${activeModelo.fundamentacao}${modalidade ? `\nModalidade: ${modalidade.nome}` : ''}${etapaFiltro ? `\nEtapa do Processo: ${etapaFiltro}` : ''}${criterioFiltro ? `\nCritério de Julgamento: ${modalidade?.criteriosJulgamento.find(c => c.id === criterioFiltro)?.nome || ''}` : ''}\nEdital/Contrato: ${editalNum || 'Não informado'}\n\nContexto do Usuário:\n${contexto}`;

    // Mapeia categoria → tipo/prefixo de numeração
    const cat = activeModelo.categoria.toLowerCase();
    let tipoPedido: 'reajuste' | 'repactuacao' | 'revisao' | 'outros' = 'outros';
    let prefixo = 'DOC';
    if (cat === 'reequilíbrio' || cat === 'reequilibrio') {
      if (activeModelo.titulo.toLowerCase().includes('reajuste')) { tipoPedido = 'reajuste'; prefixo = 'REQ'; }
      else if (activeModelo.titulo.toLowerCase().includes('repactua')) { tipoPedido = 'repactuacao'; prefixo = 'REP'; }
      else { tipoPedido = 'revisao'; prefixo = 'REV'; }
    } else {
      const prefMap: Record<string, string> = {
        'esclarecimentos': 'ESC', 'impugnações': 'IMP', 'impugnacoes': 'IMP',
        'recursos': 'REC', 'declarações': 'DCL', 'declaracoes': 'DCL',
        'defesas': 'DEF', 'representações': 'RTC', 'representacoes': 'RTC',
        'contratos': 'ADT', 'judicial': 'JUD', 'pareceres': 'PAR', 'propostas': 'PRP',
      };
      prefixo = prefMap[cat] || 'DOC';
    }

    let acumulado = '';
    await streamAIChat({
      messages: [{ role: 'user', content: prompt }],
      action: 'gerador_juridico',
      context: fullContext,
      onDelta: (text) => { acumulado += text; setResultado(prev => prev + text); },
      onDone: async () => {
        setGerando(false);
        // Persiste como pedido (cria novo ou nova versão do ativo)
        try {
          let pedidoRef = pedidoAtivo;
          if (!pedidoRef || pedidoRef.modelo_id !== activeModelo.id) {
            pedidoRef = await criarPedido({
              tipo: tipoPedido,
              modelo_id: activeModelo.id,
              modelo_titulo: activeModelo.titulo,
              categoria: activeModelo.categoria,
              prefixo_numero: prefixo,
              pregao_numero: editalNum || undefined,
              orgao_contratante: processo?.orgao || undefined,
              dados_caso: { contexto, modalidade: modalidade?.nome, etapa: etapaFiltro, criterio: criterioFiltro },
            });
            if (pedidoRef) setPedidoAtivo(pedidoRef);
          }
          if (pedidoRef && acumulado.trim()) {
            await salvarVersao(pedidoRef, acumulado, `Geração IA — ${activeModelo.titulo}`, 'gerador_juridico');
          }
        } catch (e) {
          console.error('[ModelosTemplates] persist pedido falhou', e);
        }
      },
      onError: (err) => { toast.error(err); setGerando(false); },
    });
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(resultado);
    toast.success('Documento copiado!');
  };

  const resetGeneration = () => {
    setActiveModeloId(null);
    setContexto('');
    setEditalNum('');
    setSelectedIndices([]);
    setSelectedCCTs([]);
    setSelectedDocs([]);
    setResultado('');
    setShowPeticaoUploader(false);
    setFatosPeticao([]);
    setPeticaoDocsTexto('');
    setPedidoAtivo(null);
    // Se estiver no modo inline (deep-link), volta para a lista de modelos
    if (inlineMode) {
      setInlineMode(false);
      // Se viemos da rota dedicada, navega de volta para a lista
      if (routeModeloId) {
        navigate('/apoio-juridico', { replace: true });
      } else {
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete('modelo');
          window.history.replaceState({}, '', url.toString());
        } catch {}
      }
    }
  };

  const handlePeticaoFinish = (fatos: FatoPeticao[], documentosTexto: string, numEdital: string) => {
    setFatosPeticao(fatos);
    setPeticaoDocsTexto(documentosTexto);
    setEditalNum(numEdital);
    setShowPeticaoUploader(false);
    toast.success(`${fatos.length} fato(s)/irregularidade(s) extraído(s) para geração do documento.`);
  };

  return (
    <div className="space-y-3">
      {/* Cabeçalho condensado, KPIs, filtros e lista de modelos
          ficam OCULTOS quando aberto via deep-link (/apoio-juridico/redigir/:id),
          para que a nova aba mostre apenas a redação do modelo escolhido. */}
      {!inlineMode && (<>
      {/* ── Cabeçalho condensado: KPIs + ações rápidas (1 linha) ── */}
      <div className="bg-card rounded-lg border border-border/60 shadow-sm p-3 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-md bg-accent/10 flex items-center justify-center shrink-0">
            <FolderOpen className="w-4 h-4 text-accent" />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold leading-tight">Apoio Jurídico</p>
            <p className="text-[10px] text-muted-foreground leading-tight truncate">
              {modelos.length} modelos · {pedidos.length} documentos · Lei 14.133/2021
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 ml-auto flex-wrap">
          {processo?.numero && (
            <Badge variant="outline" className="text-[10px] gap-1 shrink-0 h-6 px-2">
              <FileText className="w-2.5 h-2.5" /> Processo {processo.numero}
            </Badge>
          )}
          <Button
            size="sm" variant="outline" className="h-7 text-xs gap-1.5"
            onClick={() => editalFileRef.current?.click()}
            disabled={extractingEdital}
          >
            <Upload className="w-3 h-3" /> Edital (IA)
          </Button>
          <input
            ref={editalFileRef} type="file" accept=".pdf,.doc,.docx,.txt"
            className="hidden" onChange={handleEditalUpload}
          />
          <Button
            size="sm" variant={showPedidos ? 'default' : 'outline'}
            className="h-7 text-xs gap-1.5"
            onClick={() => setShowPedidos(s => !s)}
          >
            <Hash className="w-3 h-3" /> Documentos ({pedidos.length})
            {showPedidos ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </Button>
        </div>
      </div>

      {/* Edital Upload Status — barra slim */}
      {editalUploadFile && (
        <div className="bg-card rounded-lg border border-border/60 p-2.5 flex items-center gap-3 flex-wrap">
          <div className="w-7 h-7 rounded bg-accent/10 flex items-center justify-center shrink-0">
            <FileText className="w-3.5 h-3.5 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate">{editalUploadFile.name}</p>
            <p className="text-[10px] text-muted-foreground">
              {(editalUploadFile.size / 1024).toFixed(0)} KB
              {editalExtracted && (
                <span className="ml-2 inline-flex items-center gap-0.5 text-accent">
                  <CheckCircle className="w-2.5 h-2.5" /> Extraído
                </span>
              )}
              {extractingEdital && (
                <span className="ml-2 inline-flex items-center gap-0.5 text-accent animate-pulse">
                  <Loader2 className="w-2.5 h-2.5 animate-spin" /> Analisando…
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-1.5 shrink-0">
            {!editalExtracted && (
              <Button size="sm" onClick={handleExtractEdital} disabled={extractingEdital} className="h-7 text-xs bg-accent hover:bg-accent/90 text-accent-foreground">
                <Sparkles className="w-3 h-3 mr-1" /> Extrair
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={removeEditalUpload}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Meus Documentos (colapsável; só aparece o conteúdo quando ativado) ── */}
      {showPedidos && (
        <div className="bg-card rounded-lg border border-border/60 shadow-sm p-3 space-y-2">
          {pedidos.length === 0 ? (
            <div className="flex items-center gap-3 py-3 px-2">
              <FileText className="w-4 h-4 text-muted-foreground/50 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Nenhum documento gerado ainda. Selecione um modelo abaixo para começar — cada documento recebe numeração híbrida e versionamento automático.
              </p>
            </div>
          ) : (
            <PedidosJuridicosList
              onSelecionar={(p) => {
                setPedidoAtivo(p);
                if (p.modelo_id) setActiveModeloId(p.modelo_id);
                if (p.pregao_numero) setEditalNum(p.pregao_numero);
              }}
            />
          )}
        </div>
      )}

      {/* ── Barra unificada: busca + modalidade + filtros (3 colunas, grid responsivo) ──
           A propriedade `zoom` escala todo o conteúdo (texto, ícones, paddings) de
           forma proporcional, respeitando a preferência do usuário em localStorage. */}
      <div
        className="bg-card rounded-lg border border-border/60 shadow-sm p-3 space-y-2.5 max-w-full overflow-x-hidden"
        style={{ zoom: filterFontScale }}
      >
        {/* Controle de tamanho da fonte dos filtros */}
        <div className="flex items-center justify-end gap-1 -mb-1 flex-wrap">
          <span className="text-[11px] text-muted-foreground mr-1 hidden sm:inline">Tamanho da fonte</span>
          {isFontCapped && (
            <span
              className="text-[10px] text-amber-600 dark:text-amber-400 mr-1"
              title="O tamanho foi limitado para caber na tela atual"
            >
              limitado p/ tela
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-6 w-6 p-0 shrink-0"
            disabled={filterFontStep <= 0}
            onClick={() => setFilterFontStep(s => Math.max(0, s - 1))}
            title="Diminuir tamanho da fonte dos filtros"
            aria-label="Diminuir tamanho da fonte dos filtros"
          >
            <AArrowDown className="w-3.5 h-3.5" />
          </Button>
          <span className="text-[10px] tabular-nums text-muted-foreground w-9 text-center">
            {Math.round(filterFontScale * 100)}%
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-6 w-6 p-0"
            disabled={filterFontStep >= FILTER_FONT_SCALES.length - 1}
            onClick={() => setFilterFontStep(s => Math.min(FILTER_FONT_SCALES.length - 1, s + 1))}
            title="Aumentar tamanho da fonte dos filtros"
            aria-label="Aumentar tamanho da fonte dos filtros"
          >
            <AArrowUp className="w-3.5 h-3.5" />
          </Button>
          {filterFontStep !== 1 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground"
              onClick={() => setFilterFontStep(1)}
              title="Restaurar tamanho padrão"
              aria-label="Restaurar tamanho padrão"
            >
              <RotateCcw className="w-3 h-3" />
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
          <div className="md:col-span-5 relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar modelo, categoria ou fundamentação..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-9 text-xs"
            />
          </div>
          <div className="md:col-span-3">
            <Select value={modalidadeId || '__none__'} onValueChange={v => { setModalidadeId(v === '__none__' ? null : v); setEtapaFiltro(null); setCriterioFiltro(null); }}>
              <SelectTrigger className="h-9 text-xs">
                <Landmark className="w-3 h-3 mr-1 text-accent shrink-0" />
                <SelectValue placeholder="Modalidade…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__" className="text-xs">Sem modalidade</SelectItem>
                {MODALIDADES.map(m => (
                  <SelectItem key={m.id} value={m.id} className="text-xs">{m.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Select value={etapaFiltro || '__all__'} onValueChange={v => setEtapaFiltro(v === '__all__' ? null : v)} disabled={!modalidade}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Etapa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__" className="text-xs">Todas as etapas</SelectItem>
                {modalidade?.etapas.map(e => (
                  <SelectItem key={e.nome} value={e.nome} className="text-xs">{e.ordem}. {e.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Select value={criterioFiltro || '__all__'} onValueChange={v => setCriterioFiltro(v === '__all__' ? null : v)} disabled={!modalidade}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Critério" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__" className="text-xs">Todos critérios</SelectItem>
                {modalidade?.criteriosJulgamento.map(c => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Chips de categoria (substituem o painel de filtros pesado) */}
        <div className="flex flex-wrap gap-2 items-center pt-2 border-t border-border/40">
          <Badge
            variant={catFilter === null ? 'default' : 'outline'}
            className="cursor-pointer text-[13px] h-7 px-3 font-medium"
            onClick={() => setCatFilter(null)}
          >
            Todos · {modelos.length}
          </Badge>
          {categorias.map(cat => {
            const count = modelos.filter(m => m.categoria === cat).length;
            const docCount = pedidos.filter(p => p.categoria === cat).length;
            return (
              <Badge
                key={cat}
                variant={catFilter === cat ? 'default' : 'outline'}
                className="cursor-pointer text-[13px] h-7 px-3 gap-1.5 font-medium"
                onClick={() => setCatFilter(catFilter === cat ? null : cat)}
              >
                {cat} · {count}
                {docCount > 0 && (
                  <span className={`inline-block px-1.5 rounded text-[11px] font-semibold ${catFilter === cat ? 'bg-primary-foreground/20' : 'bg-accent/15 text-accent'}`}>{docCount}</span>
                )}
              </Badge>
            );
          })}
          {(search || catFilter) && (
            <Button
              variant="ghost" size="sm" className="h-7 px-2 text-[12px] text-muted-foreground ml-auto"
              onClick={() => { setSearch(''); setCatFilter(null); }}
            >
              <X className="w-3 h-3 mr-1" /> Limpar ({filteredModelos.length})
            </Button>
          )}
          {modalidade && (
            <Button
              variant="ghost" size="sm"
              className="h-7 px-2 text-[12px] text-muted-foreground"
              onClick={() => setShowModalidadeInfo(!showModalidadeInfo)}
            >
              <Info className="w-3 h-3 mr-1" />
              {showModalidadeInfo ? 'Ocultar detalhes' : 'Detalhes da modalidade'}
            </Button>
          )}
        </div>

        {/* Detalhes da modalidade (colapsável, opcional) */}
        {modalidade && showModalidadeInfo && (
          <div className="mt-2 p-3 rounded-md bg-muted/30 space-y-3 text-xs border border-border/40">
            <div>
              <p className="font-semibold text-foreground">{modalidade.nome}</p>
              <p className="text-muted-foreground mt-1">{modalidade.descricao}</p>
              <Badge variant="outline" className="text-[10px] mt-1">{modalidade.fundamentacao}</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className="font-semibold flex items-center gap-1"><ListChecks className="w-3 h-3 text-accent" /> Etapas do Processo</p>
                <div className="space-y-1">
                  {modalidade.etapas.map(e => (
                    <div key={e.ordem} className={`flex items-start gap-2 p-1.5 rounded ${etapaFiltro === e.nome ? 'bg-accent/10 border border-accent/30' : ''}`}>
                      <span className="w-4 h-4 rounded-full bg-accent/20 text-accent flex items-center justify-center flex-shrink-0 text-[9px] font-bold">{e.ordem}</span>
                      <div>
                        <p className="font-medium text-[11px]">{e.nome}</p>
                        <p className="text-muted-foreground text-[10px]">{e.descricao}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <p className="font-semibold flex items-center gap-1"><Target className="w-3 h-3 text-accent" /> Critérios de Julgamento</p>
                  {modalidade.criteriosJulgamento.map(c => (
                    <div key={c.id} className={`p-1.5 rounded ${criterioFiltro === c.id ? 'bg-accent/10 border border-accent/30' : ''}`}>
                      <p className="font-medium text-[11px]">{c.nome} <span className="text-muted-foreground">({c.fundamentacao})</span></p>
                      <p className="text-muted-foreground text-[10px]">{c.descricao}</p>
                      {c.obrigatorio && <Badge variant="default" className="text-[9px] mt-0.5">Obrigatório</Badge>}
                    </div>
                  ))}
                </div>
                <div className="space-y-1.5">
                  <p className="font-semibold flex items-center gap-1"><Award className="w-3 h-3 text-accent" /> Modos de Disputa</p>
                  {modalidade.modosDisputa.map(m => (
                    <div key={m.id} className="p-1.5 rounded">
                      <p className="font-medium text-[11px]">{m.nome} <span className="text-muted-foreground">({m.fundamentacao})</span></p>
                      <p className="text-muted-foreground text-[10px]">{m.descricao}</p>
                      {m.padrao && <Badge variant="secondary" className="text-[9px] mt-0.5">Padrão</Badge>}
                    </div>
                  ))}
                </div>
                <div className="space-y-1.5">
                  <p className="font-semibold flex items-center gap-1"><Shield className="w-3 h-3 text-accent" /> Preferência ME/EPP</p>
                  <Badge variant={modalidade.preferenciaMeEpp.aplicavel ? 'default' : 'secondary'} className="text-[10px]">
                    {modalidade.preferenciaMeEpp.aplicavel ? 'Aplicável' : 'Não aplicável'}
                  </Badge>
                  <p className="text-muted-foreground">{modalidade.preferenciaMeEpp.descricao}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      </>)}

      {/* ── Active Generation
           - Modo padrão: Sheet/Drawer modal (Radix Dialog em portal).
           - Modo inline (deep-link via /apoio-juridico/redigir/:id ou ?modelo=…):
             renderiza inline, SEM portal/overlay/fixed, ocupando todo o
             conteúdo do AppLayout. Isso elimina o "espelho quebrado" onde a
             lista aparecia atrás do drawer. ── */}
      {inlineMode && activeModelo ? (
        <section
          aria-label={`Redigir: ${activeModelo.titulo}`}
          className="bg-background border border-border/50 rounded-lg shadow-sm overflow-hidden flex flex-col"
          style={{ minHeight: 'calc(100vh - 180px)' }}
        >
          {activeModelo && (
            <>
              <header className="px-6 pt-6 pb-4 border-b border-border/50 shrink-0">
                <div className="flex items-center gap-2 mb-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={resetGeneration}
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Voltar para a lista de modelos
                  </Button>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="flex items-center gap-2 text-base font-semibold">
                      <Sparkles className="w-5 h-5 text-accent shrink-0" />
                      <span className="truncate">{activeModelo.titulo}</span>
                    </h2>
                    <p className="text-xs mt-1 text-muted-foreground">
                      {activeModelo.descricao}
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap mt-2">
                      <Badge variant="outline" className="text-[10px] shrink-0">{activeModelo.fundamentacao}</Badge>
                      {modalidade && <Badge variant="secondary" className="text-[10px] shrink-0">{modalidade.nome}</Badge>}
                      {etapaFiltro && <Badge variant="secondary" className="text-[10px] shrink-0">{etapaFiltro}</Badge>}
                      {selectedEmpresa && (
                        <Badge variant="secondary" className="text-[10px] shrink-0 max-w-[200px] truncate">
                          {selectedEmpresa.razao_social}
                        </Badge>
                      )}
                      {pedidoAtivo && (
                        <Badge className="text-[10px] gap-1 bg-accent/15 text-accent border-accent/30 hover:bg-accent/20 shrink-0">
                          <Hash className="w-2.5 h-2.5" /> {pedidoAtivo.numero_formatado} · v{pedidoAtivo.versoes_count}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </header>

              {/* Layout 2 colunas: formulário + preview live */}
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(0,420px)_1fr] overflow-hidden">
                {/* Coluna esquerda: formulário com scroll */}
                <div className="overflow-y-auto px-6 py-4 space-y-4 border-r border-border/50 bg-muted/10">
                  <div className="bg-card rounded-lg border border-border/50 p-4 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Sparkles className="w-5 h-5 text-accent" />
              <h3 className="text-sm font-semibold">Gerar: {activeModelo.titulo}</h3>
              <Badge variant="outline" className="text-[10px]">{activeModelo.fundamentacao}</Badge>
              {modalidade && <Badge variant="secondary" className="text-[10px]">{modalidade.nome}</Badge>}
              {etapaFiltro && <Badge variant="secondary" className="text-[10px]">{etapaFiltro}</Badge>}
              {criterioFiltro && <Badge variant="secondary" className="text-[10px]">{modalidade?.criteriosJulgamento.find(c => c.id === criterioFiltro)?.nome}</Badge>}
              {selectedEmpresa && <Badge variant="secondary" className="text-[10px]">{selectedEmpresa.razao_social.slice(0, 30)}</Badge>}
              {pedidoAtivo && (
                <Badge variant="default" className="text-[10px] gap-1 bg-accent/15 text-accent border-accent/30 hover:bg-accent/20">
                  <Hash className="w-2.5 h-2.5" /> {pedidoAtivo.numero_formatado} · v{pedidoAtivo.versoes_count}
                </Badge>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={resetGeneration}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Empresa & Representante Legal Selector */}
          <div className="bg-muted/30 rounded-lg border border-border/50 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-accent" />
              <h4 className="text-xs font-semibold">Dados Cadastrais da Empresa</h4>
            </div>

            {empresas.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                Nenhuma empresa cadastrada. Acesse Configurações → Empresas para cadastrar.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Empresa</label>
                    <Select value={selectedEmpresaId || ''} onValueChange={v => setSelectedEmpresaId(v || null)}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Selecione a empresa..." />
                      </SelectTrigger>
                      <SelectContent>
                        {empresas.map(e => (
                          <SelectItem key={e.empresa_id} value={e.empresa_id} className="text-xs">
                            {e.empresa.razao_social} ({e.empresa.cnpj})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end gap-4">
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={incluirDadosEmpresa}
                        onChange={e => setIncluirDadosEmpresa(e.target.checked)}
                        className="rounded border-border"
                      />
                      <Building2 className="w-3 h-3 text-muted-foreground" />
                      Dados da Empresa
                    </label>
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={incluirRepresentante}
                        onChange={e => setIncluirRepresentante(e.target.checked)}
                        className="rounded border-border"
                      />
                      <User className="w-3 h-3 text-muted-foreground" />
                      Representante Legal
                    </label>
                  </div>
                </div>

                {selectedEmpresa && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] text-muted-foreground bg-background/50 rounded-md p-3 border border-border/30">
                    {incluirDadosEmpresa && (
                      <div className="space-y-0.5">
                        <p className="font-semibold text-foreground text-xs flex items-center gap-1"><Building2 className="w-3 h-3 text-accent" /> Empresa</p>
                        <p><strong>Razão Social:</strong> {selectedEmpresa.razao_social}</p>
                        <p><strong>CNPJ:</strong> {selectedEmpresa.cnpj}</p>
                        {selectedEmpresa.endereco && <p><strong>Endereço:</strong> {selectedEmpresa.endereco}{selectedEmpresa.bairro ? `, ${selectedEmpresa.bairro}` : ''}</p>}
                        {selectedEmpresa.municipio && <p><strong>Cidade/UF:</strong> {selectedEmpresa.municipio}/{selectedEmpresa.uf}</p>}
                        {selectedEmpresa.cep && <p><strong>CEP:</strong> {selectedEmpresa.cep}</p>}
                        {selectedEmpresa.inscricao_estadual && <p><strong>IE:</strong> {selectedEmpresa.inscricao_estadual}</p>}
                        {selectedEmpresa.telefone && <p><strong>Fone:</strong> {selectedEmpresa.telefone}</p>}
                        {selectedEmpresa.email && <p><strong>E-mail:</strong> {selectedEmpresa.email}</p>}
                      </div>
                    )}
                    {incluirRepresentante && (
                      <div className="space-y-0.5">
                        <p className="font-semibold text-foreground text-xs flex items-center gap-1"><User className="w-3 h-3 text-accent" /> Representante Legal</p>
                        {selectedEmpresa.rep_nome ? (
                          <>
                            <p><strong>Nome:</strong> {selectedEmpresa.rep_nome}</p>
                            {selectedEmpresa.rep_cpf && <p><strong>CPF:</strong> {selectedEmpresa.rep_cpf}</p>}
                            {selectedEmpresa.rep_rg && <p><strong>RG:</strong> {selectedEmpresa.rep_rg}{selectedEmpresa.rep_orgao_expedidor ? ` (${selectedEmpresa.rep_orgao_expedidor})` : ''}</p>}
                            {selectedEmpresa.rep_cargo && <p><strong>Cargo:</strong> {selectedEmpresa.rep_cargo}</p>}
                            {selectedEmpresa.rep_naturalidade && <p><strong>Naturalidade:</strong> {selectedEmpresa.rep_naturalidade}</p>}
                            {selectedEmpresa.rep_nacionalidade && <p><strong>Nacionalidade:</strong> {selectedEmpresa.rep_nacionalidade}</p>}
                          </>
                        ) : (
                          <p className="italic text-destructive">Representante não cadastrado. Acesse Configurações → Empresa.</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground">Nº do Edital / Contrato</label>
              <Input value={editalNum} onChange={e => setEditalNum(e.target.value)} placeholder="PE-001/2026 ou CT-001/2026" className="mt-1" />
            </div>
          </div>

          {/* ── Petition Document Upload (Recursos, Impugnações, Esclarecimentos) ── */}
          {isPeticaoType && (
            <>
              {showPeticaoUploader ? (
                <DocumentosPeticaoUploader
                  tipoDoc={peticaoConfigKey!}
                  onFinish={handlePeticaoFinish}
                  editalNum={editalNum}
                  setEditalNum={setEditalNum}
                />
              ) : (
                <>
                  {fatosPeticao.length > 0 ? (
                    <div className="bg-accent/5 border border-accent/20 rounded-lg p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-accent" />
                          <h4 className="text-xs font-semibold">{fatosPeticao.length} fato(s)/irregularidade(s) extraído(s) dos documentos</h4>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setShowPeticaoUploader(true)} className="text-xs text-accent">
                          Reanalisar documentos
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {fatosPeticao.map((fato, idx) => (
                          <Badge
                            key={fato.id}
                            variant="outline"
                            className={`text-[10px] ${fato.gravidade === 'alta' ? 'border-destructive/40 text-destructive' : fato.gravidade === 'media' ? 'border-yellow-500/40 text-yellow-700 dark:text-yellow-400' : 'border-blue-500/40 text-blue-700 dark:text-blue-400'}`}
                          >
                            {idx + 1}. {fato.descricao.slice(0, 50)}{fato.descricao.length > 50 ? '...' : ''}
                            {fato.origem === 'manual' && ' ✏️'}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full border-dashed border-accent/30 text-accent hover:bg-accent/5 gap-2"
                      onClick={() => setShowPeticaoUploader(true)}
                    >
                      <Upload className="w-4 h-4" />
                      Anexar Peças Jurídicas para Extração de Fatos com IA
                    </Button>
                  )}
                </>
              )}
            </>
          )}

          <div>
            <label className="text-xs text-muted-foreground">
              {isPeticaoType && fatosPeticao.length > 0 ? 'Contexto Adicional (opcional)' : 'Contexto / Fatos / Fundamentação'}
            </label>
            <Textarea
              value={contexto}
              onChange={e => setContexto(e.target.value)}
              placeholder={
                activeModelo.categoria === 'Reequilíbrio'
                  ? 'Descreva o contrato, itens afetados, valores originais vs. atuais, e impacto financeiro...'
                  : activeModelo.categoria === 'Recursos'
                    ? 'Descreva a decisão contestada, os fatos e fundamentos jurídicos...'
                    : 'Descreva o contexto, fatos relevantes e objetivo do documento...'
              }
              className="mt-1 min-h-[100px]"
            />
          </div>

          {/* Dynamic data selectors */}
          {activeModelo.requisitosFiltro.includes('indices') && (
            <DataSelector
              label="Índices Econômicos"
              icon={<TrendingUp className="w-3 h-3" />}
              loading={loadingData}
              items={indices}
              selected={selectedIndices}
              onToggle={id => toggle(selectedIndices, id, setSelectedIndices)}
              renderItem={i => `${i.sigla}: ${fmtPerc(i.acumulado_12m)} (12m)`}
              getId={i => i.id}
            />
          )}

          {activeModelo.requisitosFiltro.includes('ccts') && (
            <DataSelector
              label="Convenções Coletivas (CCTs)"
              icon={<Users className="w-3 h-3" />}
              loading={loadingData}
              items={ccts}
              selected={selectedCCTs}
              onToggle={id => toggle(selectedCCTs, id, setSelectedCCTs)}
              renderItem={c => `${c.categoria_profissional}: ${c.reajuste_percentual ? `+${c.reajuste_percentual}%` : 'N/I'}`}
              getId={c => c.id}
            />
          )}

          {activeModelo.requisitosFiltro.includes('base_juridica') && docsBase.length > 0 && (
            <DataSelector
              label="Base Jurídica (Jurisprudência/Doutrina)"
              icon={<BookOpen className="w-3 h-3" />}
              loading={loadingData}
              items={docsBase}
              selected={selectedDocs}
              onToggle={id => toggle(selectedDocs, id, setSelectedDocs)}
              renderItem={d => d.titulo.length > 50 ? d.titulo.slice(0, 50) + '...' : d.titulo}
              getId={d => d.id}
            />
          )}

          {/* ── Pré-visualização da estrutura antes da geração final ── */}
          <PreviewEstruturaDocumento
            modeloTitulo={activeModelo.titulo}
            fundamentacao={activeModelo.fundamentacao}
            contextoCompleto={[
              `Documento: ${activeModelo.titulo}`,
              `Categoria: ${activeModelo.categoria}`,
              `Fundamentação: ${activeModelo.fundamentacao}`,
              modalidade ? `Modalidade: ${modalidade.nome}` : '',
              etapaFiltro ? `Etapa: ${etapaFiltro}` : '',
              editalNum ? `Edital/Contrato: ${editalNum}` : '',
              selectedEmpresa ? `Empresa: ${selectedEmpresa.razao_social} (CNPJ ${selectedEmpresa.cnpj})` : '',
              processo?.orgao ? `Órgão: ${processo.orgao}` : '',
              extractedEditalContext ? `\nDados extraídos do edital:\n${extractedEditalContext}` : '',
              fatosPeticao.length > 0
                ? `\nFatos extraídos (${fatosPeticao.length}):\n` + fatosPeticao.map((f, i) => `${i + 1}. [${f.gravidade}] ${f.descricao}`).join('\n')
                : '',
              `\nContexto do usuário:\n${contexto}`,
            ].filter(Boolean).join('\n')}
            gerandoFinal={gerando}
            onConfirmar={handleGerar}
            disabledConfirmar={!contexto.trim() && fatosPeticao.length === 0}
          />

                  </div>
                </div>


                {/* Coluna direita: preview live ABNT */}
                <div className="flex flex-col overflow-hidden bg-background">
                  <div className="flex items-center justify-between gap-2 px-6 py-3 border-b border-border/50 shrink-0 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <Eye className="w-4 h-4 text-accent shrink-0" />
                      <h4 className="text-xs font-semibold whitespace-nowrap">Preview ABNT em tempo real</h4>
                      {gerando && (
                        <Badge className="text-[10px] gap-1 bg-accent/10 text-accent border-accent/30 shrink-0">
                          <Loader2 className="w-2.5 h-2.5 animate-spin" /> Gerando…
                        </Badge>
                      )}
                      {!gerando && resultado && (
                        <Badge className="text-[10px] gap-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/30 shrink-0">
                          <CheckCircle className="w-2.5 h-2.5" /> Pronto
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        onClick={handleGerar}
                        disabled={gerando}
                        className="bg-accent hover:bg-accent/90 text-accent-foreground h-8 text-xs shrink-0"
                      >
                        {gerando ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
                        {resultado && !gerando ? 'Regerar' : 'Gerar'}
                      </Button>
                      {resultado && !gerando && (
                        <>
                          <Button size="sm" variant="outline" onClick={copyToClipboard} className="h-8 text-xs shrink-0">
                            <Copy className="w-3 h-3 mr-1" /> Copiar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 h-8 text-xs shrink-0"
                            onClick={async () => {
                              const meta = {
                                empresa: selectedEmpresa?.razao_social,
                                cnpj: selectedEmpresa?.cnpj,
                                edital: editalNum || undefined,
                                modalidade: modalidade?.nome,
                                fundamentacao: activeModelo?.fundamentacao,
                                timbradoUrl: selectedEmpresa?.timbrado_url,
                                certificado_nome: selectedEmpresa?.certificado_nome,
                                certificado_tipo: selectedEmpresa?.certificado_tipo,
                                rep_nome: selectedEmpresa?.rep_nome || undefined,
                                rep_cpf: selectedEmpresa?.rep_cpf || undefined,
                              };
                              await exportLegalPDF(resultado, activeModelo?.titulo || 'Documento Jurídico', meta);
                              toast.success('PDF ABNT gerado!');
                            }}
                          >
                            <Download className="w-3 h-3" /> PDF
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 h-8 text-xs shrink-0"
                            onClick={() => {
                              const meta = {
                                empresa: selectedEmpresa?.razao_social,
                                cnpj: selectedEmpresa?.cnpj,
                                edital: editalNum || undefined,
                                modalidade: modalidade?.nome,
                                fundamentacao: activeModelo?.fundamentacao,
                                timbradoUrl: selectedEmpresa?.timbrado_url,
                                certificado_nome: selectedEmpresa?.certificado_nome,
                                certificado_tipo: selectedEmpresa?.certificado_tipo,
                                rep_nome: selectedEmpresa?.rep_nome || undefined,
                                rep_cpf: selectedEmpresa?.rep_cpf || undefined,
                              };
                              exportLegalWord(resultado, activeModelo?.titulo || 'Documento Jurídico', meta);
                              toast.success('Word ABNT gerado!');
                            }}
                          >
                            <Download className="w-3 h-3" /> Word
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto bg-muted/20 p-6">
                    {!resultado && !gerando && (
                      <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground gap-3 max-w-md mx-auto">
                        <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center">
                          <FileCode className="w-6 h-6 text-accent" />
                        </div>
                        <p className="text-sm font-medium">Preview do documento aparecerá aqui</p>
                        <p className="text-xs">
                          Preencha o contexto à esquerda e clique em <strong>Gerar</strong>.
                          O texto é renderizado em tempo real conforme a IA escreve, com formatação ABNT
                          (margens 3cm/2cm, espaçamento 1,5, citações recuadas).
                        </p>
                      </div>
                    )}

                    {(resultado || gerando) && (
                      <div className="bg-background mx-auto rounded-md shadow-md border border-border/40 max-w-[210mm] min-h-[297mm] p-12">
                        <div className="prose prose-sm max-w-none dark:prose-invert text-sm leading-[1.6]">
                          <ReactMarkdown>{resultado || ''}</ReactMarkdown>
                          {gerando && (
                            <span className="inline-block w-2 h-4 bg-accent animate-pulse align-middle ml-0.5" />
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 px-6 py-2 border-t border-border/50 bg-muted/10 shrink-0">
                    <Info className="w-3 h-3 text-accent shrink-0" />
                    <p className="text-[10px] text-muted-foreground truncate">
                      ABNT NBR 14724 · Times New Roman 12pt · Entrelinhas 1,5 · Citações recuadas 4cm · Margens 3cm/2cm
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      ) : (
        <Sheet open={!!activeModelo} onOpenChange={(open) => { if (!open) resetGeneration(); }} modal>
          <SheetContent
            side="right"
            className="w-full sm:max-w-none sm:w-[95vw] lg:w-[90vw] xl:w-[1400px] p-0 overflow-hidden flex flex-col"
          >
            {activeModelo && (
              <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/50 shrink-0">
                <SheetTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="w-5 h-5 text-accent shrink-0" />
                  <span className="truncate">{activeModelo.titulo}</span>
                </SheetTitle>
                <SheetDescription className="text-xs mt-1">
                  Carregando editor de redação completo…
                </SheetDescription>
                <p className="text-xs text-muted-foreground mt-2">
                  Para a melhor experiência, abra este modelo em página dedicada:
                </p>
                <Button
                  size="sm"
                  className="mt-2 w-fit"
                  onClick={() => { resetGeneration(); navigate(`/apoio-juridico/redigir/${activeModelo.id}`); }}
                >
                  Abrir página de redação
                </Button>
              </SheetHeader>
            )}
          </SheetContent>
        </Sheet>
      )}

      {!inlineMode && (<>
      {/* ── Acervo de Modelos – Layout Forense (estilo Vade Mecum) ── */}
      {filteredModelos.length === 0 ? (
        <div className="bg-card rounded-xl border border-dashed border-border/50 p-10 text-center">
          <Filter className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum modelo encontrado para os filtros aplicados.</p>
          <Button variant="link" size="sm" onClick={() => { setSearch(''); setCatFilter(null); }}>
            Limpar filtros
          </Button>
        </div>
      ) : (
        <div className="bg-card border border-border/60 rounded-md overflow-hidden shadow-sm">
          {/* Cabeçalho institucional */}
          <div className="px-4 py-3 border-b-2 border-primary/30 bg-gradient-to-b from-primary/[0.04] to-transparent">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">
                  Praefectus · Acervo Jurídico
                </p>
                <h2 className="text-base font-bold text-foreground leading-tight mt-0.5 tracking-tight">
                  Compêndio de Modelos Processuais e Administrativos
                </h2>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground tabular-nums shrink-0">
                <span className="px-1.5 py-0.5 border border-border/60 rounded-sm bg-background/60">
                  Lei nº 14.133/2021
                </span>
                <span className="px-1.5 py-0.5 border border-border/60 rounded-sm bg-background/60">
                  {filteredModelos.length} peças
                </span>
              </div>
            </div>
          </div>

          {/* Capítulos por categoria */}
          <div className="divide-y divide-border/60">
            {categorias.map((cat, catIdx) => {
              const items = filteredModelos.filter(m => m.categoria === cat);
              if (items.length === 0) return null;
              const catCount = pedidos.filter(p => p.categoria === cat).length;
              const romano = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV'][catIdx] || String(catIdx + 1);

              return (
                <section key={cat} className="bg-background">
                  {/* Cabeçalho do capítulo — faixa institucional
                      Tipografia e espaçamento uniformes em todos os breakpoints.
                      Contraste AA garantido: bg-secondary + text-secondary-foreground
                      (par de tokens validado em light/dark). Fallback sólido antes
                      do blur para navegadores sem backdrop-filter. */}
                  <header className="sticky top-0 z-[1] flex items-center justify-between gap-3 px-4 py-2.5 bg-secondary supports-[backdrop-filter]:bg-secondary/95 backdrop-blur-sm border-y border-border text-secondary-foreground shadow-[inset_3px_0_0_0_hsl(var(--accent))]">
                    <div className="flex items-baseline gap-2.5 min-w-0">
                      <span className="text-[13px] font-bold text-secondary-foreground tabular-nums tracking-wider shrink-0">
                        CAP. {romano}
                      </span>
                      <span className="w-px h-3.5 bg-secondary-foreground/30 shrink-0" aria-hidden="true" />
                      <h3 className="text-[13px] font-bold uppercase tracking-[0.12em] text-secondary-foreground truncate">
                        {cat}
                      </h3>
                      <span className="text-[12px] text-secondary-foreground/75 tabular-nums shrink-0">
                        ({items.length} {items.length === 1 ? 'peça' : 'peças'})
                      </span>
                    </div>
                    {catCount > 0 && (
                      <Badge className="text-[11px] gap-1 bg-background text-foreground border-border shrink-0 h-5 px-2 tabular-nums">
                        <FileText className="w-3 h-3" /> {catCount} emitida{catCount === 1 ? '' : 's'}
                      </Badge>
                    )}
                  </header>

                  {/* Lista enumerada de modelos */}
                  <div>
                    {items.map((m, idx) => (
                      <ModeloCard
                        key={m.id}
                        modelo={m}
                        index={idx}
                        pedidosCount={pedidosPorModelo[m.id] || 0}
                        onAbrir={() => {
                          setActiveModeloId(m.id);
                          setPedidoAtivo(null);
                          setResultado('');
                          setContexto('');
                          setEditalNum(processo?.numero || '');
                          setSelectedIndices([]);
                          setSelectedCCTs([]);
                          setSelectedDocs([]);
                        }}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>

          {/* Rodapé institucional */}
          <div className="px-4 py-2 border-t border-border/60 bg-muted/20 flex items-center justify-between gap-2 flex-wrap">
            <p className="text-[11px] text-muted-foreground">
              Documento gerado em conformidade com a NBR 14.724 · ABNT
            </p>
            <p className="text-[11px] text-muted-foreground">
              Fundamentação: Lei 14.133/2021, LC 123/2006, CF/88 art. 37
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Reusable data selector component ── */
function DataSelector<T>({
  label, icon, loading, items, selected, onToggle, renderItem, getId,
}: {
  label: string; icon: React.ReactNode; loading: boolean;
  items: T[]; selected: string[]; onToggle: (id: string) => void;
  renderItem: (item: T) => string; getId: (item: T) => string;
}) {
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = items.filter(item =>
    renderItem(item).toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-2">
      <label className="text-xs text-muted-foreground flex items-center gap-1">
        {icon} {label} ({selected.length} selecionado{selected.length !== 1 ? 's' : ''})
      </label>
      {items.length > 5 && (
        <Input
          placeholder={`Buscar ${label.toLowerCase()}...`}
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="h-7 text-xs"
        />
      )}
      <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto p-2 rounded-md bg-muted/30">
        {loading ? (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" /> Carregando...
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum item encontrado</p>
        ) : (
          filtered.map(item => {
            const id = getId(item);
            return (
              <Badge
                key={id}
                variant={selected.includes(id) ? 'default' : 'outline'}
                className="cursor-pointer text-[11px] transition-colors"
                onClick={() => onToggle(id)}
              >
                {renderItem(item)}
              </Badge>
            );
          })
        )}
      </div>
    </div>
  );
}
