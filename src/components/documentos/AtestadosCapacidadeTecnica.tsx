import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  Upload, Download, Trash2, Loader2, Bot,
  CheckCircle2, AlertTriangle, Plus, FileText,
  ShoppingBasket, Monitor, Sparkles, Package, Utensils,
  Wrench, Shirt, Pill, Building2, FolderOpen, Filter, Search
} from 'lucide-react';

const SEGMENTOS_ACT = [
  { value: 'alimentos', label: 'Gêneros Alimentícios', sublabel: 'Cestas básicas, merenda escolar', icon: Utensils },
  { value: 'informatica', label: 'Informática e Tecnologia', sublabel: 'Equipamentos, suprimentos, software', icon: Monitor },
  { value: 'limpeza', label: 'Higiene e Limpeza', sublabel: 'Produtos de limpeza, descartáveis', icon: Sparkles },
  { value: 'escritorio', label: 'Material de Escritório', sublabel: 'Papelaria, expediente', icon: Package },
  { value: 'moveis', label: 'Móveis e Equipamentos', sublabel: 'Mobiliário, eletrodomésticos', icon: Building2 },
  { value: 'vestuario', label: 'Vestuário e EPIs', sublabel: 'Uniformes, fardamento, EPIs', icon: Shirt },
  { value: 'medicamentos', label: 'Medicamentos e Saúde', sublabel: 'Medicamentos, material hospitalar', icon: Pill },
  { value: 'manutencao', label: 'Manutenção e Serviços', sublabel: 'Manutenção predial, elétrica', icon: Wrench },
  { value: 'outros', label: 'Outros Segmentos', sublabel: 'Segmentos não listados', icon: ShoppingBasket },
];

type ACTDoc = {
  id: string;
  nome: string;
  segmento: string;
  validade?: string;
  arquivo_path?: string;
  dados_extraidos?: {
    objeto?: string;
    orgao_emissor?: string;
    ano_fornecimento?: string;
    valor?: string;
    cnpj_contratante?: string;
    periodo?: string;
  };
};

type VisionImage = {
  name: string;
  dataUrl: string;
};

type DocumentAnalysisPayload = {
  images: VisionImage[];
  supportText: string;
};

type ExtractionStatus = 'idle' | 'success' | 'warning' | 'error';

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

const createEmptyExtractedData = (): NonNullable<ACTDoc['dados_extraidos']> => ({
  objeto: '',
  orgao_emissor: '',
  ano_fornecimento: '',
  valor: '',
  cnpj_contratante: '',
  periodo: '',
});

const hasExtractedContent = (value?: ACTDoc['dados_extraidos']) =>
  Boolean(
    value?.objeto ||
    value?.orgao_emissor ||
    value?.ano_fornecimento ||
    value?.valor ||
    value?.cnpj_contratante ||
    value?.periodo,
  );

const formatFileSize = (bytes: number) => {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
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

  return normalizeWhitespace(pageTexts.join('\n'));
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

export default function AtestadosCapacidadeTecnica() {
  const { user } = useAuth();
  const [docs, setDocs] = useState<ACTDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedSegmento, setSelectedSegmento] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ACTDoc['dados_extraidos']>();
  const [extractionStatus, setExtractionStatus] = useState<ExtractionStatus>('idle');
  const [extractionMessage, setExtractionMessage] = useState('');
  const [filterSegmento, setFilterSegmento] = useState<string>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [fileInputKey, setFileInputKey] = useState(0);

  const fetchDocs = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('documentos')
      .select('id, nome, segmento, validade, arquivo_path, dados_extraidos')
      .eq('user_id', user.id)
      .like('nome', 'ACT –%')
      .order('created_at', { ascending: false });
    if (data) setDocs(data.map(d => ({
      ...d,
      segmento: d.segmento || 'outros',
      dados_extraidos: d.dados_extraidos as ACTDoc['dados_extraidos'],
    })));
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const resetUploadDialog = () => {
    setSelectedSegmento('');
    setPendingFile(null);
    setExtractedData(undefined);
    setExtractionStatus('idle');
    setExtractionMessage('');
    setFileInputKey((current) => current + 1);
  };

  const openUploadDialog = () => {
    resetUploadDialog();
    setUploadDialogOpen(true);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setUploadDialogOpen(open);
    if (!open) {
      resetUploadDialog();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
    if (!allowed.includes(f.type)) {
      toast.error('Use PDF, PNG, JPG ou WEBP.');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error('Máximo 10MB.');
      return;
    }
    setPendingFile(f);
    setExtractedData(undefined);
    setExtractionStatus('idle');
    setExtractionMessage('');
  };

  const handleAIExtract = async () => {
    if (!pendingFile || !selectedSegmento) return;
    setAnalyzing(true);
    setExtractionStatus('idle');
    setExtractionMessage('');

    try {
      const payload = await buildDocumentAnalysisPayload(pendingFile);

      if (payload.images.length === 0 && !payload.supportText.trim()) {
        throw new Error('Não foi possível preparar o documento para leitura.');
      }

      const { data: aiData, error: aiError } = await supabase.functions.invoke('extrair-atestado-capacidade', {
        body: {
          fileName: pendingFile.name,
          segmento: selectedSegmento,
          images: payload.images,
          text: payload.supportText,
        },
      });
      if (aiError) throw aiError;

      const parsed = aiData?.result ?? aiData ?? {};
      const nextData = {
        objeto: typeof parsed.objeto === 'string' ? parsed.objeto.trim() : '',
        orgao_emissor: typeof parsed.orgao_emissor === 'string' ? parsed.orgao_emissor.trim() : '',
        ano_fornecimento: typeof parsed.ano_fornecimento === 'string' ? parsed.ano_fornecimento.trim() : '',
        valor: typeof parsed.valor === 'string' ? parsed.valor.trim() : '',
        cnpj_contratante: typeof parsed.cnpj_contratante === 'string' ? parsed.cnpj_contratante.trim() : '',
        periodo: typeof parsed.periodo === 'string' ? parsed.periodo.trim() : '',
      };

      setExtractedData(nextData);

      if (nextData.objeto || nextData.orgao_emissor || nextData.ano_fornecimento) {
        setExtractionStatus('success');
        setExtractionMessage('Leitura concluída. Objeto, Cliente/Órgão e Ano foram validados para revisão.');
        toast.success('Dados do atestado extraídos com sucesso.');
      } else {
        setExtractionStatus('warning');
        setExtractionMessage('A leitura foi executada, mas nenhum campo principal foi encontrado com confiança suficiente.');
        toast.info('A IA não encontrou dados confiáveis. Revise e preencha manualmente se necessário.');
      }
    } catch (err: any) {
      console.error('ACT extraction error:', err);
      setExtractedData(createEmptyExtractedData());
      setExtractionStatus('error');
      setExtractionMessage(err?.message || 'A leitura do documento falhou nesta tentativa.');
      toast.error(err?.message || 'Erro na extração do documento.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleUpload = async () => {
    if (!user || !pendingFile || !selectedSegmento) return;
    setUploading(true);

    try {
      const segLabel = SEGMENTOS_ACT.find(s => s.value === selectedSegmento)?.label || selectedSegmento;
      const nome = `ACT – ${segLabel}`;
      const ext = pendingFile.name.split('.').pop();
      const path = `${user.id}/act-${selectedSegmento}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('documentos-habilitacao')
        .upload(path, pendingFile, { upsert: true });
      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from('documentos').insert({
        user_id: user.id,
        nome,
        tipo: 'Qualificação Técnica',
        descricao: extractedData?.objeto || `Atestado de Capacidade Técnica - ${segLabel}`,
        arquivo_path: path,
        validade: null, // ACTs de fornecimento não possuem validade
        tamanho_bytes: pendingFile.size,
        segmento: selectedSegmento,
        dados_extraidos: hasExtractedContent(extractedData) ? extractedData : null,
      });
      if (dbError) throw dbError;

      toast.success(`Atestado de "${segLabel}" adicionado!`);
      resetUploadDialog();
      setUploadDialogOpen(false);
      await fetchDocs();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar atestado.');
    }
    setUploading(false);
  };

  const handleRemove = async (doc: ACTDoc) => {
    if (!user) return;
    setRemovingId(doc.id);
    try {
      if (doc.arquivo_path) {
        await supabase.storage.from('documentos-habilitacao').remove([doc.arquivo_path]);
      }
      await supabase.from('documentos').delete().eq('id', doc.id);
      setDocs(prev => prev.filter(d => d.id !== doc.id));
      toast.success('Atestado removido.');
    } catch {
      toast.error('Erro ao remover.');
    }
    setRemovingId(null);
  };

  const handleDownload = async (doc: ACTDoc) => {
    if (!doc.arquivo_path) return;
    const { data, error } = await supabase.storage.from('documentos-habilitacao').download(doc.arquivo_path);
    if (error || !data) { toast.error('Erro ao baixar.'); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.arquivo_path.split('/').pop() || 'atestado';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // Filter docs
  const filteredDocs = docs.filter(d => {
    if (filterSegmento !== 'todos' && d.segmento !== filterSegmento) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const obj = d.dados_extraidos?.objeto?.toLowerCase() || '';
      const org = d.dados_extraidos?.orgao_emissor?.toLowerCase() || '';
      const seg = SEGMENTOS_ACT.find(s => s.value === d.segmento)?.label.toLowerCase() || '';
      if (!obj.includes(term) && !org.includes(term) && !seg.includes(term)) return false;
    }
    return true;
  });

  const totalDocs = docs.length;
  const segmentosComDoc = new Set(docs.map(d => d.segmento)).size;

  // Segments that have docs (for filter chips)
  const segmentosAtivos = SEGMENTOS_ACT.filter(s => docs.some(d => d.segmento === s.value));

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <h3 className="text-lg font-semibold">Atestados de capacidade técnica</h3>
          <Badge variant="muted">Art. 67</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="muted">
            {totalDocs} atestado{totalDocs !== 1 ? 's' : ''} em {segmentosComDoc} segmento{segmentosComDoc !== 1 ? 's' : ''}
          </Badge>
          <Button size="sm" onClick={openUploadDialog}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Adicionar atestado
          </Button>
        </div>
      </div>

      {/* Filters */}
      {totalDocs > 0 && (
        <div className="space-y-3 border-b border-border px-6 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative max-w-xs flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                placeholder="Buscar atestado…"
                aria-label="Buscar atestado por objeto, órgão ou segmento"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Filter className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </div>
          {/* Chips de segmento — `aria-pressed` diz qual filtro está ligado
              para quem não enxerga a tinta verde. */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFilterSegmento('todos')}
              aria-pressed={filterSegmento === 'todos'}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                filterSegmento === 'todos'
                  ? 'border-primary bg-primary-tint font-semibold text-foreground'
                  : 'border-border text-muted-foreground hover:bg-muted'
              )}
            >
              Todos ({totalDocs})
            </button>
            {segmentosAtivos.map(seg => {
              const count = docs.filter(d => d.segmento === seg.value).length;
              const Icon = seg.icon;
              return (
                <button
                  key={seg.value}
                  type="button"
                  onClick={() => setFilterSegmento(seg.value)}
                  aria-pressed={filterSegmento === seg.value}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    filterSegmento === seg.value
                      ? 'border-primary bg-primary-tint font-semibold text-foreground'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  )}
                >
                  <Icon className="h-3 w-3" aria-hidden="true" />
                  {seg.label} ({count})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Docs list */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">Carregando atestados…</span>
        </div>
      ) : filteredDocs.length === 0 ? (
        <EstadoVazio
          tamanho="compacto"
          icone={<FileText />}
          titulo={totalDocs === 0 ? 'Nenhum atestado cadastrado' : 'Nenhum resultado para o filtro'}
          descricao={
            totalDocs === 0
              ? 'O atestado prova o que a empresa já forneceu — é ele que a qualificação técnica do art. 67 pede.'
              : 'Ajuste a busca ou escolha outro segmento.'
          }
          acao={totalDocs === 0 ? (
            <Button variant="outline" onClick={openUploadDialog}>
              <Plus className="h-4 w-4" aria-hidden="true" /> Adicionar primeiro atestado
            </Button>
          ) : undefined}
        />
      ) : (
        <div className="divide-y divide-border">
          {filteredDocs.map(doc => {
            const seg = SEGMENTOS_ACT.find(s => s.value === doc.segmento);
            const Icon = seg?.icon || ShoppingBasket;
            return (
              <div key={doc.id} className="flex flex-wrap items-start justify-between gap-3 px-6 py-3 transition-colors hover:bg-muted">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="muted">{seg?.label || doc.segmento}</Badge>
                      <Badge variant="success">
                        <CheckCircle2 className="mr-1 h-3 w-3" aria-hidden="true" /> Cadastrado
                      </Badge>
                    </div>
                    {/* Key fields: Objeto, Cliente/Órgão, Ano */}
                    {doc.dados_extraidos?.objeto && (
                      <p className="mt-2 line-clamp-2 text-sm font-medium text-foreground">
                        <span className="font-normal text-muted-foreground">Objeto: </span>
                        {doc.dados_extraidos.objeto}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                      {doc.dados_extraidos?.orgao_emissor && (
                        <span className="text-sm text-foreground">
                          <span className="text-muted-foreground">Cliente/Órgão: </span>
                          <strong>{doc.dados_extraidos.orgao_emissor}</strong>
                        </span>
                      )}
                      {doc.dados_extraidos?.ano_fornecimento && (
                        <span className="text-sm text-foreground">
                          <span className="text-muted-foreground">Ano: </span>
                          <strong className="tabular-nums">{doc.dados_extraidos.ano_fornecimento}</strong>
                        </span>
                      )}
                      {doc.dados_extraidos?.valor && (
                        <Badge variant="muted">R$ {doc.dados_extraidos.valor}</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownload(doc)}
                    title="Baixar arquivo"
                    aria-label={`Baixar o atestado de ${seg?.label || doc.segmento}`}
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRemove(doc)}
                    disabled={removingId === doc.id}
                    className="text-destructive-ink hover:bg-destructive-tint hover:text-destructive-ink"
                    title="Remover atestado"
                    aria-label={`Remover o atestado de ${seg?.label || doc.segmento}`}
                  >
                    {removingId === doc.id
                      ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      : <Trash2 className="h-4 w-4" aria-hidden="true" />}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              Adicionar atestado de capacidade técnica
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Segment selector */}
            <div className="space-y-2">
              <Label htmlFor="act-segmento" className="text-sm font-medium">
                Segmento
              </Label>
              <Select value={selectedSegmento} onValueChange={setSelectedSegmento}>
                <SelectTrigger id="act-segmento">
                  <SelectValue placeholder="Selecione o segmento do atestado" />
                </SelectTrigger>
                <SelectContent>
                  {SEGMENTOS_ACT.map(seg => {
                    const Icon = seg.icon;
                    return (
                      <SelectItem key={seg.value} value={seg.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          <div>
                            <span className="text-sm">{seg.label}</span>
                            <span className="ml-2 text-xs text-muted-foreground">– {seg.sublabel}</span>
                          </div>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* File */}
            <div className="space-y-2">
              <Label htmlFor="act-arquivo" className="text-sm font-medium">Arquivo (PDF/PNG/JPG)</Label>
              <Input
                id="act-arquivo"
                key={fileInputKey}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={handleFileSelect}
              />

              {pendingFile && (
                <div className="rounded-md border border-border bg-muted px-3 py-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{pendingFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {pendingFile.type === 'application/pdf' ? 'PDF' : 'Imagem'} • {formatFileSize(pendingFile.size)}
                      </p>
                    </div>
                    <Badge variant="muted">Arquivo selecionado</Badge>
                  </div>
                </div>
              )}
            </div>

            {/* AI Extract button */}
            {pendingFile && selectedSegmento && (
              <Button
                variant="outline"
                className="w-full"
                onClick={handleAIExtract}
                disabled={analyzing}
              >
                {analyzing
                  ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  : <Bot className="h-4 w-4" aria-hidden="true" />}
                {analyzing ? 'Extraindo dados com IA…' : 'Extrair dados com IA'}
              </Button>
            )}

            {extractionStatus !== 'idle' && (
              <Alert
                variant={
                  extractionStatus === 'success' ? 'success'
                    : extractionStatus === 'warning' ? 'warning'
                      : 'destructive'
                }
              >
                {extractionStatus === 'success'
                  ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  : <AlertTriangle className="h-4 w-4" aria-hidden="true" />}
                <AlertDescription>{extractionMessage}</AlertDescription>
              </Alert>
            )}

            {/* Extracted data display */}
            {extractedData && (
              <div className="space-y-4 rounded-lg border border-border bg-muted p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Bot className="h-4 w-4" aria-hidden="true" /> Dados extraídos pela IA
                </p>
                <div className="space-y-2">
                  <Label htmlFor="act-objeto" className="text-sm">Objeto</Label>
                  <Textarea
                    id="act-objeto"
                    value={extractedData.objeto || ''}
                    onChange={e => setExtractedData(prev => ({ ...prev, objeto: e.target.value }))}
                    rows={2}
                    placeholder="Descrição do objeto atestado"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="act-orgao" className="text-sm">Cliente / órgão contratante</Label>
                  <Input
                    id="act-orgao"
                    value={extractedData.orgao_emissor || ''}
                    onChange={e => setExtractedData(prev => ({ ...prev, orgao_emissor: e.target.value }))}
                    placeholder="Órgão público ou empresa contratante"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="act-ano" className="text-sm">Ano do fornecimento</Label>
                    <Input
                      id="act-ano"
                      value={extractedData.ano_fornecimento || ''}
                      onChange={e => setExtractedData(prev => ({ ...prev, ano_fornecimento: e.target.value }))}
                      className="tabular-nums"
                      placeholder="Ex: 2024"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="act-valor" className="text-sm">Valor</Label>
                    <Input
                      id="act-valor"
                      value={extractedData.valor || ''}
                      onChange={e => setExtractedData(prev => ({ ...prev, valor: e.target.value }))}
                      className="tabular-nums"
                      placeholder="Valor contratual"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="act-cnpj" className="text-sm">CNPJ contratante</Label>
                    <Input
                      id="act-cnpj"
                      value={extractedData.cnpj_contratante || ''}
                      onChange={e => setExtractedData(prev => ({ ...prev, cnpj_contratante: e.target.value }))}
                      className="tabular-nums"
                      placeholder="00.000.000/0000-00"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Info about validity */}
            <p className="text-sm text-muted-foreground">
              Atestados de capacidade técnica para fornecimento não possuem validade e permanecem válidos permanentemente.
            </p>
          </div>

          <DialogFooter className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => setUploadDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpload} disabled={uploading || !pendingFile || !selectedSegmento}>
              {uploading
                ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                : <Upload className="h-4 w-4" aria-hidden="true" />}
              Enviar atestado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
