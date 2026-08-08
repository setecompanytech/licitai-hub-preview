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
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  Upload, Download, Trash2, Loader2, Bot,
  CheckCircle2, Plus, FileText,
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
    <div className="bg-card rounded-xl border border-border/50 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Atestados de Capacidade Técnica</h3>
          <Badge variant="outline" className="text-xs">Art. 67</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {totalDocs} atestado{totalDocs !== 1 ? 's' : ''} em {segmentosComDoc} segmento{segmentosComDoc !== 1 ? 's' : ''}
          </Badge>
          <Button size="sm" onClick={openUploadDialog} className="gap-1 text-xs">
            <Plus className="w-3 h-3" />
            Adicionar Atestado
          </Button>
        </div>
      </div>

      {/* Filters */}
      {totalDocs > 0 && (
        <div className="px-5 py-2.5 border-b border-border/30 space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar atestado..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setFilterSegmento('todos')}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-medium transition-colors border',
                filterSegmento === 'todos'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted'
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
                  onClick={() => setFilterSegmento(seg.value)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-medium transition-colors border flex items-center gap-1',
                    filterSegmento === seg.value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted'
                  )}
                >
                  <Icon className="w-3 h-3" />
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
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
          <FileText className="w-8 h-8 mb-2 opacity-40" />
          <p className="text-sm">{totalDocs === 0 ? 'Nenhum atestado cadastrado' : 'Nenhum resultado para o filtro'}</p>
          {totalDocs === 0 && (
            <Button size="sm" variant="outline" className="mt-3 gap-1" onClick={openUploadDialog}>
              <Plus className="w-3 h-3" /> Adicionar primeiro atestado
            </Button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-border/30">
          {filteredDocs.map(doc => {
            const seg = SEGMENTOS_ACT.find(s => s.value === doc.segmento);
            const Icon = seg?.icon || ShoppingBasket;
            return (
              <div key={doc.id} className="px-5 py-3 flex items-start justify-between hover:bg-muted/20 transition-colors">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">{seg?.label || doc.segmento}</Badge>
                      <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                      <span className="text-xs text-success font-medium">Cadastrado</span>
                    </div>
                    {/* Key fields: Objeto, Cliente/Órgão, Ano */}
                    {doc.dados_extraidos?.objeto && (
                      <p className="text-xs mt-1.5 font-medium text-foreground line-clamp-2">
                        <span className="text-muted-foreground font-normal">Objeto: </span>
                        {doc.dados_extraidos.objeto}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                      {doc.dados_extraidos?.orgao_emissor && (
                        <span className="text-xs text-foreground">
                          <span className="text-muted-foreground">Cliente/Órgão: </span>
                          <strong>{doc.dados_extraidos.orgao_emissor}</strong>
                        </span>
                      )}
                      {doc.dados_extraidos?.ano_fornecimento && (
                        <span className="text-xs text-foreground">
                          <span className="text-muted-foreground">Ano: </span>
                          <strong>{doc.dados_extraidos.ano_fornecimento}</strong>
                        </span>
                      )}
                      {doc.dados_extraidos?.valor && (
                        <Badge variant="outline" className="text-xs">R$ {doc.dados_extraidos.valor}</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0 ml-2">
                  <Button size="sm" variant="ghost" onClick={() => handleDownload(doc)} title="Baixar">
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRemove(doc)}
                    disabled={removingId === doc.id}
                    className="text-destructive hover:text-destructive"
                    title="Remover"
                  >
                    {removingId === doc.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
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
              <FileText className="w-5 h-5 text-muted-foreground" />
              Adicionar Atestado de Capacidade Técnica
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Segment selector */}
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Segmento
              </Label>
              <Select value={selectedSegmento} onValueChange={setSelectedSegmento}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione o segmento do atestado" />
                </SelectTrigger>
                <SelectContent>
                  {SEGMENTOS_ACT.map(seg => {
                    const Icon = seg.icon;
                    return (
                      <SelectItem key={seg.value} value={seg.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <span className="text-sm">{seg.label}</span>
                            <span className="text-xs text-muted-foreground ml-1.5">– {seg.sublabel}</span>
                          </div>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* File */}
            <div>
              <Label className="text-xs">Arquivo (PDF/PNG/JPG)</Label>
              <Input
                key={fileInputKey}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={handleFileSelect}
                className="mt-1"
              />

              {pendingFile && (
                <div className="mt-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{pendingFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {pendingFile.type === 'application/pdf' ? 'PDF' : 'Imagem'} • {formatFileSize(pendingFile.size)}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs whitespace-nowrap">Arquivo selecionado</Badge>
                  </div>
                </div>
              )}
            </div>

            {/* AI Extract button */}
            {pendingFile && selectedSegmento && (
              <Button
                variant="outline"
                className="w-full gap-2 border-accent/30 text-accent hover:bg-accent/10"
                onClick={handleAIExtract}
                disabled={analyzing}
              >
                {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
                {analyzing ? 'Extraindo dados com IA...' : 'Extrair Dados com IA'}
              </Button>
            )}

            {extractionStatus !== 'idle' && (
              <div
                className={cn(
                  'rounded-lg border px-3 py-2 text-xs',
                  extractionStatus === 'success' && 'border-success/30 bg-success/10 text-foreground',
                  extractionStatus === 'warning' && 'border-warning/30 bg-warning/10 text-foreground',
                  extractionStatus === 'error' && 'border-destructive/30 bg-destructive/10 text-foreground',
                )}
              >
                {extractionMessage}
              </div>
            )}

            {/* Extracted data display */}
            {extractedData && (
              <div className="space-y-2 p-3 bg-muted rounded-lg border border-border">
                <p className="text-xs font-semibold text-foreground flex items-center gap-1">
                  <Bot className="w-3 h-3" /> Dados Extraídos pela IA
                </p>
                <div>
                  <Label className="text-xs text-muted-foreground">Objeto</Label>
                  <Textarea
                    value={extractedData.objeto || ''}
                    onChange={e => setExtractedData(prev => ({ ...prev, objeto: e.target.value }))}
                    className="mt-0.5 text-xs min-h-[50px]"
                    placeholder="Descrição do objeto atestado"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Cliente / Órgão Contratante</Label>
                  <Input
                    value={extractedData.orgao_emissor || ''}
                    onChange={e => setExtractedData(prev => ({ ...prev, orgao_emissor: e.target.value }))}
                    className="mt-0.5 text-xs h-8"
                    placeholder="Órgão público ou empresa contratante"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Ano do Fornecimento</Label>
                    <Input
                      value={extractedData.ano_fornecimento || ''}
                      onChange={e => setExtractedData(prev => ({ ...prev, ano_fornecimento: e.target.value }))}
                      className="mt-0.5 text-xs h-8"
                      placeholder="Ex: 2024"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Valor</Label>
                    <Input
                      value={extractedData.valor || ''}
                      onChange={e => setExtractedData(prev => ({ ...prev, valor: e.target.value }))}
                      className="mt-0.5 text-xs h-8"
                      placeholder="Valor contratual"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">CNPJ Contratante</Label>
                    <Input
                      value={extractedData.cnpj_contratante || ''}
                      onChange={e => setExtractedData(prev => ({ ...prev, cnpj_contratante: e.target.value }))}
                      className="mt-0.5 text-xs h-8"
                      placeholder="00.000.000/0000-00"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Info about validity */}
            <p className="text-xs text-muted-foreground italic">
              ℹ️ Atestados de capacidade técnica para fornecimento não possuem validade e permanecem válidos permanentemente.
            </p>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="ghost" onClick={() => setUploadDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpload} disabled={uploading || !pendingFile || !selectedSegmento}>
              {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
              Enviar Atestado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
