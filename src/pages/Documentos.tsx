import { useState, useRef, useEffect, useCallback } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import ProcessoContextoBanner from '@/components/shared/ProcessoContextoBanner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  FileText, Upload, Repeat, CheckCircle2, AlertTriangle,
  Shield, FolderOpen, Download, FileArchive, Trash2, Loader2, Eye, Users,
  CalendarDays, Bot
} from 'lucide-react';
import MergeDocumentos from '@/components/documentos/MergeDocumentos';
import AtestadosCapacidadeTecnica from '@/components/documentos/AtestadosCapacidadeTecnica';
import AlertaVencimentoDocumentos from '@/components/documentos/AlertaVencimentoDocumentos';
import { IconeRecolher, lerRecolhida, gravarRecolhida } from '@/components/ui/secao-recolhivel';
// A escolha de qual data é a validade tem teste próprio: um documento fiscal
// traz emissão, hora e prazo juntos, e a errada manda renovar o que está bom —
// ou leva a empresa à sessão com certidão vencida.
import { extrairValidadeDoTexto, montarData, normalizarEspacos } from '@/lib/documentos/validade';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useAuthorization } from '@/hooks/useAuthorization';
import { useColaboradores } from '@/hooks/useMetasComercial';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

type DocStatus = 'ok' | 'vencido' | 'ausente';

type Documento = {
  nome: string;
  categoria: string;
  artigo: string;
  status: DocStatus;
  validade?: string;
  arquivo?: string;
  storagePath?: string;
  /** Id da linha no banco — é por ele que renovação e remoção acontecem. */
  dbId?: string;
  /** Linha anterior à conversão para empresa: só o dono vê, até compartilhar. */
  legadoPrivado?: boolean;
};

type VisionImage = {
  name: string;
  dataUrl: string;
};

type DocumentAnalysisPayload = {
  images: VisionImage[];
  supportText: string;
};

// Checklist de documentos exigidos pela Lei 14.133/2021 — status começa como 'ausente'
// e será atualizado conforme o usuário faz upload
const checklistDocumentos: Documento[] = [
  { nome: 'Ato Constitutivo / Contrato Social', categoria: 'Habilitação Jurídica', artigo: 'Art. 66', status: 'ausente' },
  { nome: 'Cédula de Identidade dos Sócios', categoria: 'Habilitação Jurídica', artigo: 'Art. 66', status: 'ausente' },
  // Documento AUXILIAR: informa o que está arquivado na Junta, mas não substitui
  // o teor jurídico do contrato social (objeto, capital, poderes). Vale o mesmo
  // para a certidão de inteiro teor e a específica.
  { nome: 'Certidão Simplificada da Junta Comercial', categoria: 'Habilitação Jurídica', artigo: 'Art. 66', status: 'ausente' },
  { nome: 'Cartão CNPJ', categoria: 'Regularidade Fiscal', artigo: 'Art. 68, I', status: 'ausente' },
  // Art. 68, II — prova de INSCRIÇÃO no cadastro de contribuintes, que não se
  // confunde com a certidão de regularidade do inciso III. A sigla muda em cada
  // ente (FIC no Pará, CISC em Belém), então a vaga é nomeada pela função e o
  // sistema reconhece as siglas locais pelo nome do arquivo.
  { nome: 'Inscrição Estadual (cadastro de contribuintes)', categoria: 'Regularidade Fiscal', artigo: 'Art. 68, II', status: 'ausente' },
  { nome: 'Inscrição Municipal (cadastro de contribuintes)', categoria: 'Regularidade Fiscal', artigo: 'Art. 68, II', status: 'ausente' },
  { nome: 'Certidão Negativa de Débitos Federais (CND)', categoria: 'Regularidade Fiscal', artigo: 'Art. 68', status: 'ausente' },
  { nome: 'Certidão de Regularidade do FGTS (CRF)', categoria: 'Regularidade Fiscal', artigo: 'Art. 68', status: 'ausente' },
  { nome: 'Certidão Negativa de Débitos Estaduais', categoria: 'Regularidade Fiscal', artigo: 'Art. 68', status: 'ausente' },
  { nome: 'Certidão Negativa de Débitos Municipais', categoria: 'Regularidade Fiscal', artigo: 'Art. 68', status: 'ausente' },
  { nome: 'CNDT – Certidão Trabalhista', categoria: 'Regularidade Fiscal', artigo: 'Art. 68', status: 'ausente' },
  { nome: 'Registro no CREA/CAU', categoria: 'Qualificação Técnica', artigo: 'Art. 67', status: 'ausente' },
  // Atestado de Capacidade Técnica é gerenciado pelo componente dedicado com subcategorias por segmento
  { nome: 'CAT – Certidão de Acervo Técnico', categoria: 'Qualificação Técnica', artigo: 'Art. 67', status: 'ausente' },
  { nome: 'Balanço Patrimonial (último exercício)', categoria: 'Qualif. Econômico-Financeira', artigo: 'Art. 69', status: 'ausente' },
  { nome: 'Certidão Negativa de Falência', categoria: 'Qualif. Econômico-Financeira', artigo: 'Art. 69', status: 'ausente' },
  { nome: 'Declaração de Inexistência de Fato Impeditivo', categoria: 'Declarações', artigo: 'Art. 63, §1º', status: 'ausente' },
  { nome: 'Declaração de Não Emprego de Menor', categoria: 'Declarações', artigo: 'Art. 68, VI', status: 'ausente' },
  { nome: 'Declaração ME/EPP (se aplicável)', categoria: 'Declarações', artigo: 'LC 123/2006', status: 'ausente' },
];

// O selo diz o que o documento É, não o que vai acontecer com ele. Certidão
// válida por mais 26 dias é REGULAR — não há o que fazer com ela hoje, e marcá-la
// como "pendente" mandava procurar um problema inexistente. O vencimento que se
// aproxima é aviso, e vive no lembrete do canto da tela (LembreteDeVencimento),
// que acompanha a pessoa em qualquer página e volta até o documento ser renovado.
const statusConfig: Record<DocStatus, { icon: typeof CheckCircle2; color: string; label: string }> = {
  ok: { icon: CheckCircle2, color: 'text-success', label: 'Regular' },
  vencido: { icon: AlertTriangle, color: 'text-destructive', label: 'Vencido' },
  ausente: { icon: AlertTriangle, color: 'text-destructive', label: 'Ausente' },
};

/** Dias até a validade, contados por DATA — hora não entra, fuso não desloca. */
const diasAteVencer = (validade: string): number | null => {
  const m = String(validade).match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const alvo = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const agora = new Date();
  const hoje = Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate());
  return Math.round((alvo - hoje) / 86400000);
};



const imageFileToVisionPayload = async (file: File): Promise<VisionImage[]> =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      try {
        const maxDimension = 1800;
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Não foi possível preparar a imagem para análise.'));
          return;
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve([{ name: file.name, dataUrl: canvas.toDataURL('image/jpeg', 0.9) }]);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Não foi possível abrir a imagem enviada.'));
    };

    img.src = objectUrl;
  });

const extractPdfSupportText = async (pdf: any, maxPages: number) => {
  const pageTexts: string[] = [];

  for (let i = 1; i <= maxPages; i += 1) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => ('str' in item ? item.str : ''))
      .join(' ');

    pageTexts.push(pageText);
  }

  return normalizarEspacos(pageTexts.join('\n'));
};

const renderPdfToVisionImages = async (pdf: any, fileName: string, maxPages: number): Promise<VisionImage[]> => {
  const images: VisionImage[] = [];

  for (let i = 1; i <= maxPages; i += 1) {
    const page = await pdf.getPage(i);
    const firstViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(
      1.5,
      1600 / Math.max(firstViewport.width, 1),
      1600 / Math.max(firstViewport.height, 1),
    );
    const viewport = page.getViewport({ scale: Math.max(scale, 0.5) });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);

    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    await page.render({ canvasContext: ctx, viewport }).promise;
    images.push({
      name: `${fileName}_p${i}`,
      dataUrl: canvas.toDataURL('image/jpeg', 0.88),
    });
  }

  return images;
};

const buildDocumentAnalysisPayload = async (file: File): Promise<DocumentAnalysisPayload> => {
  if (file.type.startsWith('image/')) {
    return {
      images: await imageFileToVisionPayload(file),
      supportText: '',
    };
  }

  if (file.type === 'application/pdf') {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

    const arrayBuffer = await file.arrayBuffer();
    let pdf: any;

    try {
      pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    } catch {
      pdf = await pdfjsLib.getDocument({ data: arrayBuffer, disableWorker: true } as any).promise;
    }

    const maxPages = Math.min(pdf.numPages, 3);
    const [supportText, images] = await Promise.all([
      extractPdfSupportText(pdf, maxPages),
      renderPdfToVisionImages(pdf, file.name, maxPages),
    ]);

    return { images, supportText };
  }

  return { images: [], supportText: '' };
};

/**
 * Nome do arquivo sem o caminho interno do armazenamento.
 *
 * O caminho gravado inclui a pasta do usuário — um identificador de 36
 * caracteres que a tela mostrava por inteiro antes do nome. Ele não diz nada a
 * quem confere documento e empurrava o nome real para fora da vista.
 */
function nomeDoArquivo(caminho: string): string {
  return caminho.split('/').pop() || caminho;
}

export default function Documentos() {
  const [filter, setFilter] = useState<DocStatus | 'todos'>('todos');
  const [activeTab, setActiveTab] = useState('documentos');
  const [documentos, setDocumentos] = useState<Documento[]>(checklistDocumentos);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  // Visualização em tela: conferir validade e assinatura de uma certidão exigia
  // baixar o arquivo e abrir fora do sistema — para um documento que já está
  // aqui e cuja conferência é o trabalho desta tela.
  const [visualizando, setVisualizando] = useState<{ nome: string; url: string } | null>(null);
  const [removingIdx, setRemovingIdx] = useState<number | null>(null);
  const [analyzingIdx, setAnalyzingIdx] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingUploadIdx = useRef<number | null>(null);
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  // Trilha de auditoria (03/09): quem alterou o quê, para o Admin. Hooks no
  // topo, SEMPRE — a tela branca de 02/09 veio de hook depois de return.
  const { isCompanyAdmin } = useAuthorization();
  const { data: colaboradores = [] } = useColaboradores();
  const [historico, setHistorico] = useState<Array<{
    id: string; documento_nome: string; acao: string; autor: string | null;
    validade_nova: string | null; criado_em: string;
  }>>([]);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [historicoCarregando, setHistoricoCarregando] = useState(false);

  const nomeDoAutor = (uid: string | null) => {
    if (!uid) return 'sistema';
    const c = (colaboradores as Array<{ user_id: string; nome?: string; email?: string }>).find((x) => x.user_id === uid);
    return c?.nome || c?.email || 'membro da equipe';
  };

  const abrirHistorico = async () => {
    setHistoricoAberto((v) => !v);
    if (historicoAberto || historico.length > 0 || !empresaAtiva) return;
    setHistoricoCarregando(true);
    const { data } = await (supabase.from('documentos_historico' as never) as any)
      .select('id, documento_nome, acao, autor, validade_nova, criado_em')
      .eq('empresa_id', empresaAtiva.id)
      .order('criado_em', { ascending: false })
      .limit(100);
    setHistorico(data ?? []);
    setHistoricoCarregando(false);
  };

  // Validade dialog state
  const [validadeDialogOpen, setValidadeDialogOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  // Qual pasta está recolhida — preferência de quem lê, guardada no navegador.
  const [categoriasRecolhidas, setCategoriasRecolhidas] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      [...new Set(checklistDocumentos.map((d) => d.categoria))].map((c) => [
        c,
        lerRecolhida(`documentos-categoria-${c}`, false),
      ]),
    ),
  );
  const alternarCategoria = useCallback((cat: string) => {
    setCategoriasRecolhidas((atual) => {
      const nova = !atual[cat];
      gravarRecolhida(`documentos-categoria-${cat}`, nova);
      return { ...atual, [cat]: nova };
    });
  }, []);

  const [pendingValidadeDate, setPendingValidadeDate] = useState<Date | undefined>(undefined);
  const [pendingManualDate, setPendingManualDate] = useState('');

  // Sync checklist status from uploaded documents in DB
  useEffect(() => {
    if (!user) return;
    const syncFromDB = async () => {
      // Documento é DA EMPRESA (princípio nº 2): a régua é a empresa ativa.
      // Linha antiga sem empresa (legado privado) continua visível SÓ para o
      // dono, exatamente como antes — compartilhar é decisão dele, na tela.
      let q = supabase
        .from('documentos')
        .select('id, nome, validade, arquivo_path, empresa_id, user_id');
      q = empresaAtiva
        ? q.or(`empresa_id.eq.${empresaAtiva.id},and(user_id.eq.${user.id},empresa_id.is.null)`)
        : q.eq('user_id', user.id);
      const { data: dataRaw } = await q;
      if (!dataRaw) return;
      // `empresa_id` nasce na migration 20260903000002; o types.ts gerado
      // ainda não a conhece — tipagem local, como nas demais colunas novas.
      const data = dataRaw as unknown as Array<{
        id: string; nome: string; validade: string | null;
        arquivo_path: string | null; empresa_id: string | null; user_id: string;
      }>;
      setDocumentos(
        checklistDocumentos.map((doc) => {
          // A linha da empresa vence a linha privada de mesmo nome.
          const match = data.find((d) => d.nome === doc.nome && d.empresa_id)
            ?? data.find((d) => d.nome === doc.nome);
          if (!match) {
            return { ...doc, status: 'ausente' as DocStatus, validade: undefined, arquivo: undefined, storagePath: undefined };
          }

          const dias = match.validade ? diasAteVencer(match.validade) : null;
          const status: DocStatus = dias !== null && dias < 0 ? 'vencido' : 'ok';

          return {
            ...doc,
            status,
            validade: match.validade || undefined,
            arquivo: match.arquivo_path || undefined,
            storagePath: match.arquivo_path || undefined,
            dbId: match.id,
            legadoPrivado: !match.empresa_id,
          };
        })
      );
    };
    syncFromDB();

    const channel = supabase
      .channel(`documentos-realtime-${empresaAtiva?.id ?? user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documentos', filter: `user_id=eq.${user.id}` }, () => syncFromDB());
    if (empresaAtiva) {
      // O anexo do colega tem de aparecer aqui sem F5 — é o ponto da conversão.
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'documentos', filter: `empresa_id=eq.${empresaAtiva.id}` }, () => syncFromDB());
    }
    channel.subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, empresaAtiva]);

  const categorias = [...new Set(documentos.map((d) => d.categoria))];
  const filtered = filter === 'todos' ? documentos : documentos.filter((d) => d.status === filter);
  const okCount = documentos.filter((d) => d.status === 'ok').length;
  const progress = Math.round((okCount / documentos.length) * 100);

  const handleUploadClick = (globalIdx: number) => {
    pendingUploadIdx.current = globalIdx;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const idx = pendingUploadIdx.current;
    if (!file || idx === null || !user) return;

    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
    if (!allowed.includes(file.type)) {
      toast.error('Formato não suportado. Use PDF, PNG, JPG ou WEBP.');
      e.target.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 10MB.');
      e.target.value = '';
      return;
    }

    // Open validade dialog before uploading
    setPendingFile(file);
    setPendingValidadeDate(documentos[idx].validade ? new Date(documentos[idx].validade!) : undefined);
    setPendingManualDate(documentos[idx].validade || '');
    setValidadeDialogOpen(true);
    e.target.value = '';
  };

  const handleConfirmUpload = async (skipValidade = false) => {
    const file = pendingFile;
    const idx = pendingUploadIdx.current;
    if (!file || idx === null || !user) return;

    setValidadeDialogOpen(false);
    setUploadingIdx(idx);

    const slug = documentos[idx].nome.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60);
    const ext = file.name.split('.').pop();
    // Arquivo da empresa vive em empresa/<id>/… — é o que as policies do
    // storage liberam para os colegas. Sem empresa ativa, cai no caminho
    // pessoal antigo.
    const path = empresaAtiva
      ? `empresa/${empresaAtiva.id}/${slug}.${ext}`
      : `${user.id}/${slug}.${ext}`;

    // Remove o arquivo anterior. Pode falhar quando ele mora na pasta pessoal
    // de OUTRO colega (legado) — aí só o dono original alcança; o arquivo
    // antigo fica órfão no bucket, o que é aceitável: a linha passa a apontar
    // para o novo.
    if (documentos[idx].storagePath && documentos[idx].storagePath !== path) {
      await supabase.storage.from('documentos-habilitacao').remove([documentos[idx].storagePath!]);
    }

    const { error } = await supabase.storage.from('documentos-habilitacao').upload(path, file, { upsert: true });
    if (error) {
      toast.error('Erro ao enviar: ' + error.message);
      setUploadingIdx(null);
      setPendingFile(null);
      return;
    }

    // Determine validade
    let validadeStr: string | undefined;
    if (!skipValidade) {
      if (pendingValidadeDate) {
        validadeStr = format(pendingValidadeDate, 'yyyy-MM-dd');
      } else if (pendingManualDate) {
        validadeStr = pendingManualDate;
      }
    }

    // Calculate new status
    let newStatus: DocStatus = 'ok';
    if (validadeStr) {
      const valDate = new Date(validadeStr);
      if (valDate < new Date()) newStatus = 'vencido';
    }

    // Renovar é UPDATE na linha existente (o RLS permite a qualquer membro);
    // apagar-e-recriar exigiria delete, que é do dono/admin — e renovar a CRF
    // vencida é exatamente a rotina que o colaborador precisa fazer.
    const linhaExistente = documentos[idx].dbId;
    if (linhaExistente) {
      const { data: atualizadas, error: updateDbError } = await supabase
        .from('documentos')
        .update({
          arquivo_path: path,
          validade: validadeStr ?? null,
          tamanho_bytes: file.size,
          // Renovação com empresa ativa promove a linha legada: o documento
          // novo já nasce compartilhado.
          empresa_id: empresaAtiva?.id ?? null,
        } as never)
        .eq('id', linhaExistente)
        .select('id');
      if (updateDbError || !atualizadas?.length) {
        toast.error('Erro ao atualizar cadastro do documento: ' + (updateDbError?.message ?? 'sem permissão para esta linha'));
        setUploadingIdx(null);
        setPendingFile(null);
        return;
      }
    } else {
      const { error: insertDbError } = await supabase
        .from('documentos')
        .insert({
          user_id: user.id,
          empresa_id: empresaAtiva?.id ?? null,
          nome: documentos[idx].nome,
          tipo: documentos[idx].categoria,
          descricao: `${documentos[idx].categoria} • ${documentos[idx].artigo}`,
          arquivo_path: path,
          validade: validadeStr,
          tamanho_bytes: file.size,
        } as never);

      if (insertDbError) {
        toast.error('Erro ao salvar metadados do documento: ' + insertDbError.message);
        setUploadingIdx(null);
        setPendingFile(null);
        return;
      }
    }

    setDocumentos(prev => prev.map((d, i) =>
      i === idx ? {
        ...d,
        arquivo: file.name,
        storagePath: path,
        status: newStatus,
        validade: validadeStr || d.validade
      } : d
    ));

    toast.success(`"${documentos[idx].nome}" enviado com sucesso!`);
    setUploadingIdx(null);
    setPendingFile(null);
    setPendingValidadeDate(undefined);
    setPendingManualDate('');
  };

  const handleAIAnalysis = async () => {
    const idx = pendingUploadIdx.current;
    if (idx === null || !pendingFile) return;

    setAnalyzingIdx(idx);
    
    try {
      const { images, supportText } = await buildDocumentAnalysisPayload(pendingFile);
      const localSuggestion = extrairValidadeDoTexto(supportText);

      if (localSuggestion) {
        setPendingValidadeDate(localSuggestion);
        setPendingManualDate(format(localSuggestion, 'yyyy-MM-dd'));
        toast.success(`Validade identificada: ${format(localSuggestion, 'dd/MM/yyyy')}`);
        return;
      }

      if (images.length === 0 && supportText.length < 10) {
        toast.error('Não foi possível preparar o arquivo para análise automática.');
        return;
      }

      const { data, error } = await supabase.functions.invoke('document-vision-extract', {
        body: {
          fileName: documentos[idx].nome,
          images,
          text: supportText,
          mode: 'document_validity',
        },
      });

      if (error) throw error;

      const aiSuggestion = typeof data?.validityDate === 'string'
        ? extrairValidadeDoTexto(data.validityDate)
        : null;

      const fallbackText = [
        typeof data?.evidenceText === 'string' ? data.evidenceText : '',
        typeof data?.text === 'string' ? data.text : '',
        supportText,
      ].filter(Boolean).join('\n');

      const foundDate = aiSuggestion ?? extrairValidadeDoTexto(fallbackText);

      if (foundDate) {
        setPendingValidadeDate(foundDate);
        setPendingManualDate(format(foundDate, 'yyyy-MM-dd'));
        toast.success(`Validade identificada: ${format(foundDate, 'dd/MM/yyyy')}`);
      } else {
        toast.info('Não identifiquei uma data de validade neste documento.');
      }
    } catch (error) {
      console.error(error);
      toast.error('Erro na análise por IA. Informe a validade manualmente.');
    } finally {
      setAnalyzingIdx(null);
    }
  };

  const handleVisualizar = async (globalIdx: number) => {
    const doc = documentos[globalIdx];
    if (!doc.storagePath) { toast.error('Nenhum arquivo para visualizar.'); return; }
    const { data, error } = await supabase.storage
      .from('documentos-habilitacao').createSignedUrl(doc.storagePath, 600);
    if (error || !data?.signedUrl) {
      toast.error('Erro ao abrir: ' + (error?.message ?? 'arquivo não encontrado'));
      return;
    }
    setVisualizando({ nome: doc.nome, url: data.signedUrl });
  };

  const handleDownload = async (globalIdx: number) => {
    const doc = documentos[globalIdx];
    if (!doc.storagePath || !user) {
      toast.error('Nenhum arquivo disponível para download.');
      return;
    }

    const { data, error } = await supabase.storage.from('documentos-habilitacao').download(doc.storagePath);
    if (error || !data) {
      toast.error('Erro ao baixar: ' + (error?.message ?? 'arquivo não encontrado'));
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.arquivo || 'documento';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(`"${doc.nome}" baixado com sucesso!`);
  };

  /** Linha anterior à conversão (só o dono vê): move o arquivo para a pasta
   *  da empresa e grava o empresa_id — compartilhar é decisão de quem anexou,
   *  nunca efeito de migration (princípio 7). */
  const compartilharComEmpresa = async (globalIdx: number) => {
    const doc = documentos[globalIdx];
    if (!doc.dbId || !empresaAtiva || !user) return;
    let novoPath = doc.storagePath;
    if (doc.storagePath && doc.storagePath.startsWith(`${user.id}/`)) {
      novoPath = `empresa/${empresaAtiva.id}/${doc.storagePath.split('/').pop()}`;
      const { error: moveErr } = await supabase.storage
        .from('documentos-habilitacao')
        .move(doc.storagePath, novoPath);
      if (moveErr && !/already exists/i.test(moveErr.message)) {
        toast.error('Não foi possível mover o arquivo: ' + moveErr.message);
        return;
      }
    }
    const { data: ok, error } = await supabase
      .from('documentos')
      .update({ empresa_id: empresaAtiva.id, arquivo_path: novoPath ?? null } as never)
      .eq('id', doc.dbId)
      .select('id');
    if (error || !ok?.length) {
      toast.error('Não foi possível compartilhar: ' + (error?.message ?? 'linha não encontrada'));
      return;
    }
    toast.success(`Agora toda a equipe de ${empresaAtiva.nome_fantasia ?? empresaAtiva.razao_social} vê este documento.`);
    setDocumentos(prev => prev.map((d, i) =>
      i === globalIdx ? { ...d, legadoPrivado: false, storagePath: novoPath, arquivo: novoPath } : d));
  };

  const handleRemove = async (globalIdx: number) => {
    if (!user) return;
    const doc = documentos[globalIdx];

    setRemovingIdx(globalIdx);

    // A LINHA sai primeiro: é nela que o RLS decide (dono ou admin da
    // empresa). Na ordem inversa, um membro sem permissão perderia o ARQUIVO
    // e a linha ficaria apontando para o nada.
    if (doc.dbId) {
      const { data: removidas, error: deleteDbError } = await supabase
        .from('documentos')
        .delete()
        .eq('id', doc.dbId)
        .select('id');
      if (deleteDbError || !removidas?.length) {
        toast.error(deleteDbError
          ? 'Erro ao remover cadastro: ' + deleteDbError.message
          : 'Documento da empresa: só o dono do anexo ou o Admin podem remover.');
        setRemovingIdx(null);
        return;
      }
    }

    if (doc.storagePath) {
      // Arquivo em pasta pessoal de outro colega (legado) pode ficar órfão —
      // aceitável: o registro já se foi e nada mais o alcança pela tela.
      await supabase.storage.from('documentos-habilitacao').remove([doc.storagePath]);
    }

    setDocumentos(prev => prev.map((d, i) =>
      i === globalIdx ? { ...d, arquivo: undefined, storagePath: undefined, validade: undefined, status: 'ausente' as DocStatus } : d
    ));

    toast.success(`"${doc.nome}" removido.`);
    setRemovingIdx(null);
  };

  const getGlobalIndex = (doc: Documento) => documentos.findIndex(d => d.nome === doc.nome);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* O cofre é alcançado a partir do checklist de habilitação de um
            processo — daqui o usuário volta para a pasta de onde veio. */}
        <ProcessoContextoBanner />
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground flex-shrink-0" />
            Controle de Documentos
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Conformidade com a Lei 14.133/2021 e legislação vigente
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="documentos" className="flex items-center gap-1">
              <FolderOpen className="w-4 h-4" /> Documentos
            </TabsTrigger>
            <TabsTrigger value="merge" className="flex items-center gap-1">
              <FileArchive className="w-4 h-4" /> Juntar PDF/ZIP
            </TabsTrigger>
          </TabsList>

          <TabsContent value="documentos" className="space-y-4">
            <AlertaVencimentoDocumentos documentos={documentos} />

            {/* REBRAND — o `dc-conf` do protótipo, com uma diferença deliberada.

                Era uma barra de progresso ÚNICA: "72%" e um traço azul. Mas a
                pergunta de quem abre esta tela não é "quanto está pronto" — é
                "consigo me habilitar hoje". E o que responde isso não é o
                número, é a COMPOSIÇÃO do que falta: dez pendências ausentes se
                resolvem pedindo os documentos; UMA vencida barra a empresa no
                mesmo dia.

                Então a barra virou segmentada: regular, vencido e ausente lado
                a lado, cada faixa proporcional. A leitura passa a ser
                instantânea e não depende de ler a legenda embaixo.

                O número grande também mudou de cor conforme a saúde. Verde
                ganha o direito de dizer "pode ir"; enquanto houver vencido, ele
                fica vermelho mesmo com 90% de conformidade — porque 90% com uma
                certidão vencida é inabilitação. */}
            {(() => {
              const conta = (s: DocStatus) => documentos.filter((d) => d.status === s).length;
              const nOk = conta('ok');
              const nVenc = conta('vencido');
              const nAus = conta('ausente');
              const total = documentos.length || 1;
              const pct = (n: number) => (n / total) * 100;

              const faixas: { s: DocStatus; n: number; cor: string }[] = [
                { s: 'ok', n: nOk, cor: 'bg-success' },
                { s: 'vencido', n: nVenc, cor: 'bg-destructive' },
                { s: 'ausente', n: nAus, cor: 'bg-muted-foreground/40' },
              ];

              const tomDoNumero = nVenc > 0
                ? 'text-destructive'
                : nAus > 0
                  ? 'text-warning'
                  : 'text-success';

              return (
                <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
                  <div className="flex items-end justify-between gap-4 mb-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-muted-foreground">Conformidade geral</p>
                      <p className={`text-4xl font-bold tabular-nums leading-none mt-1 ${tomDoNumero}`}>
                        {progress}%
                      </p>
                    </div>
                    <p className="text-sm text-right text-muted-foreground leading-snug">
                      {nVenc > 0 ? (
                        <span className="text-destructive font-medium">
                          {nVenc} {nVenc === 1 ? 'documento vencido' : 'documentos vencidos'} — impedem a habilitação
                        </span>
                      ) : nAus > 0 ? (
                        <>Falta{nAus > 1 ? 'm' : ''} {nAus} {nAus === 1 ? 'documento' : 'documentos'} para o dossiê ficar completo</>
                      ) : (
                        <span className="text-success font-medium">Dossiê completo e dentro da validade</span>
                      )}
                    </p>
                  </div>

                  {/* Barra segmentada. O `gap` de 2px entre as faixas é o que
                      separa "duas fatias" de "uma fatia com sombra". */}
                  <div className="flex gap-0.5 h-2.5 rounded-full overflow-hidden bg-muted">
                    {faixas.filter((f) => f.n > 0).map((f) => (
                      <div
                        key={f.s}
                        className={`${f.cor} transition-[width] duration-500 motion-reduce:transition-none`}
                        style={{ width: `${pct(f.n)}%` }}
                        title={`${f.n} ${statusConfig[f.s].label}`}
                      />
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2 mt-3">
                    {faixas.map(({ s, n, cor }) => {
                      const cfg = statusConfig[s];
                      const ativo = filter === s;
                      return (
                        <button
                          key={s}
                          onClick={() => setFilter(ativo ? 'todos' : s)}
                          aria-pressed={ativo}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                            ativo
                              ? 'border-foreground/30 bg-muted font-semibold text-foreground'
                              : 'border-border text-muted-foreground hover:bg-muted/60'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-sm ${cor}`} aria-hidden="true" />
                          <span className="tabular-nums font-medium text-foreground">{n}</span>
                          {cfg.label}
                        </button>
                      );
                    })}
                    {filter !== 'todos' && (
                      <button
                        onClick={() => setFilter('todos')}
                        className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                      >
                        limpar filtro
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Docs by Category */}
            <div className="space-y-4">
              {categorias.map((cat) => {
                const docs = filtered.filter((d) => d.categoria === cat);
                if (docs.length === 0) return null;
                return (
                  <div key={cat} className="bg-card rounded-xl border border-border/50 shadow-sm">
                    {/* A pasta inteira se recolhe: quem veio tratar da regularidade
                        fiscal não precisa rolar a habilitação jurídica antes. */}
                    <button
                      type="button"
                      onClick={() => alternarCategoria(cat)}
                      aria-expanded={!categoriasRecolhidas[cat]}
                      title={categoriasRecolhidas[cat] ? 'Abrir a lista' : 'Recolher a lista'}
                      className="flex w-full items-center gap-2 px-5 py-3 border-b border-border/50 text-left transition-colors hover:bg-muted/40"
                    >
                      <FolderOpen className="w-4 h-4 text-muted-foreground" />
                      <h3 className="text-base font-semibold">{cat}</h3>
                      {categoriasRecolhidas[cat] && (
                        <span className="text-sm text-muted-foreground">
                          {docs.length} documento{docs.length > 1 ? 's' : ''}
                        </span>
                      )}
                      <Badge variant="outline" className="ml-auto text-sm">
                        {docs[0]?.artigo}
                      </Badge>
                      <IconeRecolher
                        aberto={!categoriasRecolhidas[cat]}
                        className="h-4 w-4 shrink-0 text-muted-foreground"
                      />
                    </button>
                    <div className={`divide-y divide-border/30 ${categoriasRecolhidas[cat] ? 'hidden' : ''}`}>
                      {docs.map((doc) => {
                        const cfg = statusConfig[doc.status];
                        const Icon = cfg.icon;
                        const globalIdx = getGlobalIndex(doc);
                        const isUploading = uploadingIdx === globalIdx;
                        const isRemoving = removingIdx === globalIdx;

                        return (
                          <div key={doc.nome} className="flex items-center justify-between px-5 py-3">
                            <div className="flex items-center gap-3">
                              <Icon className={`w-4 h-4 ${cfg.color}`} />
                              <div className="min-w-0">
                                <p className="text-base font-medium">{doc.nome}</p>
                                {doc.validade && (
                                  <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                    <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                                    Validade: {new Date(doc.validade).toLocaleDateString('pt-BR')}
                                  </p>
                                )}
                                {doc.arquivo && (
                                  <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                    <FileText className="w-3.5 h-3.5 shrink-0" />
                                    <span className="truncate">{nomeDoArquivo(doc.arquivo)}</span>
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={`text-sm ${cfg.color}`}>
                                {cfg.label}
                              </Badge>
                              {doc.arquivo ? (
                                <div className="flex gap-1">
                                  {doc.storagePath && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleVisualizar(globalIdx)}
                                      title="Visualizar em tela"
                                    >
                                      <Eye className="w-3 h-3" />
                                    </Button>
                                  )}
                                  {doc.storagePath && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleDownload(globalIdx)}
                                      title="Baixar arquivo"
                                    >
                                      <Download className="w-3 h-3" />
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleUploadClick(globalIdx)}
                                    disabled={isUploading}
                                    title="Substituir arquivo"
                                  >
                                    {/* Trocar um documento por outro é substituição, não envio: a
                                        seta para cima já é o botão "Enviar" da linha sem arquivo. */}
                                    {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Repeat className="w-3 h-3" />}
                                  </Button>
                                  {doc.legadoPrivado && empresaAtiva && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => compartilharComEmpresa(globalIdx)}
                                      className="text-warning hover:text-warning"
                                      title="Hoje só você vê este documento — clique para compartilhar com a equipe da empresa"
                                    >
                                      <Users className="w-3 h-3" />
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleRemove(globalIdx)}
                                    disabled={isRemoving}
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                    title={doc.legadoPrivado ? 'Remover arquivo' : 'Remover (documento da empresa: dono do anexo ou Admin)'}
                                  >
                                    {isRemoving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleUploadClick(globalIdx)}
                                  disabled={isUploading}
                                >
                                  {isUploading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Upload className="w-3 h-3 mr-1" />}
                                  Enviar
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Atestados de Capacidade Técnica — subcategorias por segmento */}
            <AtestadosCapacidadeTecnica />

            {/* ── Trilha de auditoria — só o Admin vê ─────────────────────
                O registro nasce de GATILHO no banco: envio, substituição,
                renovação, compartilhamento e remoção deixam rastro por
                qualquer caminho, não só por esta tela. */}
            {isCompanyAdmin && (
              <div className="rounded-lg border border-border">
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/40"
                  onClick={abrirHistorico}
                >
                  <span>Histórico de alterações (Admin)</span>
                  <span className="text-xs text-muted-foreground">{historicoAberto ? 'recolher' : 'ver'}</span>
                </button>
                {historicoAberto && (
                  <div className="border-t border-border divide-y divide-border/60 max-h-80 overflow-y-auto">
                    {historicoCarregando && (
                      <p className="p-3 text-xs text-muted-foreground flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando registros…
                      </p>
                    )}
                    {!historicoCarregando && historico.length === 0 && (
                      <p className="p-3 text-xs text-muted-foreground">
                        Nenhum registro ainda — a trilha passa a gravar a partir da migration 20260903000006.
                      </p>
                    )}
                    {historico.map((h) => (
                      <div key={h.id} className="px-4 py-2 text-xs flex items-center gap-2 flex-wrap">
                        <span className="text-muted-foreground tabular-nums whitespace-nowrap">
                          {new Date(h.criado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                        <Badge variant="outline" className="text-[10px]">{h.acao}</Badge>
                        <span className="font-medium truncate">{h.documento_nome}</span>
                        <span className="text-muted-foreground">por {nomeDoAutor(h.autor)}</span>
                        {h.validade_nova && (
                          <span className="text-muted-foreground whitespace-nowrap">
                            · validade {h.validade_nova.slice(0, 10).split('-').reverse().join('/')}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="merge">
            <MergeDocumentos />
          </TabsContent>


        </Tabs>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Validade Dialog */}
        <Dialog open={validadeDialogOpen} onOpenChange={setValidadeDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-muted-foreground" />
                Validade do Documento
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Informe a data de vencimento do documento ou utilize a análise por IA para sugestão automática.
              </p>

              {pendingUploadIdx.current !== null && (
                <div className="text-sm font-medium bg-muted/50 p-2 rounded">
                  {documentos[pendingUploadIdx.current]?.nome}
                </div>
              )}

              {/* Manual date input */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Data de Validade
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !pendingValidadeDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarDays className="mr-2 h-4 w-4" />
                      {pendingValidadeDate
                        ? format(pendingValidadeDate, 'dd/MM/yyyy', { locale: ptBR })
                        : 'Selecione a validade'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={pendingValidadeDate}
                      onSelect={(date) => {
                        setPendingValidadeDate(date);
                        if (date) setPendingManualDate(format(date, 'yyyy-MM-dd'));
                      }}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Or manual text input */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Ou digite: DD/MM/AAAA</Label>
                <Input
                  placeholder="DD/MM/AAAA"
                  // `new Date('2026-07-10')` é meia-noite UTC, que no horário de
                  // Brasília é dia 09 às 21h. Era isso que fazia o seletor
                  // mostrar 10/07 e este campo, 09/07 — e digitar 10/07/2026
                  // gravar 2026-07-09. Data de calendário se monta por partes.
                  value={pendingManualDate ? (() => {
                    const m = pendingManualDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
                    const d = m ? montarData(Number(m[1]), Number(m[2]), Number(m[3])) : null;
                    return d ? format(d, 'dd/MM/yyyy') : pendingManualDate;
                  })() : ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    const match = val.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
                    if (match) {
                      const d = montarData(Number(match[3]), Number(match[2]), Number(match[1]));
                      if (d) {
                        setPendingValidadeDate(d);
                        setPendingManualDate(format(d, 'yyyy-MM-dd'));
                        return;
                      }
                    }
                    setPendingManualDate(val);
                  }}
                />
              </div>

              {/* AI Analysis button */}
              <Button
                variant="outline"
                className="w-full gap-2 border-accent/30 text-accent hover:bg-accent/10"
                onClick={handleAIAnalysis}
                disabled={analyzingIdx !== null}
              >
                {analyzingIdx !== null ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Bot className="w-4 h-4" />
                )}
                Sugerir Validade por IA
              </Button>

              {pendingValidadeDate && (
                <div className="flex items-center gap-2 p-2 bg-success/10 rounded-lg text-sm">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  <span>Validade: <strong>{format(pendingValidadeDate, 'dd/MM/yyyy')}</strong></span>
                </div>
              )}
            </div>
            <DialogFooter className="flex gap-2">
              <Button variant="ghost" onClick={() => handleConfirmUpload(true)}>
                Pular (sem validade)
              </Button>
              <Button onClick={() => handleConfirmUpload(false)}>
                Confirmar e Enviar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Conferência em tela. O PDF abre aqui; formato que o navegador não
            renderiza cai no download, que é o que já existia. */}
        <Dialog open={!!visualizando} onOpenChange={(o) => !o && setVisualizando(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle className="text-base">{visualizando?.nome}</DialogTitle>
            </DialogHeader>
            {visualizando && (
              <iframe
                src={visualizando.url}
                title={visualizando.nome}
                className="w-full h-[70vh] border border-border rounded-lg bg-white"
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
