import { useState, useRef, useEffect, useCallback } from 'react';
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
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
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
  const [filterSegmento, setFilterSegmento] = useState<string>('todos');
  const [searchTerm, setSearchTerm] = useState('');

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

  const openUploadDialog = () => {
    setSelectedSegmento('');
    setPendingFile(null);
    setExtractedData(undefined);
    setUploadDialogOpen(true);
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
    e.target.value = '';
  };

  const fileToVisionPayload = async (file: File): Promise<{ name: string; dataUrl: string } | null> => {
    return new Promise((resolve) => {
      if (file.type.startsWith('image/')) {
        const img = new Image();
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string;
          img.onload = () => {
            const maxDim = 1600;
            let w = img.width, h = img.height;
            if (w > maxDim || h > maxDim) {
              const ratio = Math.min(maxDim / w, maxDim / h);
              w = Math.round(w * ratio);
              h = Math.round(h * ratio);
            }
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, w, h);
            resolve({ name: file.name, dataUrl: canvas.toDataURL('image/jpeg', 0.85) });
          };
          img.onerror = () => resolve(null);
          img.src = dataUrl;
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      } else {
        resolve(null);
      }
    });
  };

  const handleAIExtract = async () => {
    if (!pendingFile) return;
    setAnalyzing(true);
    try {
      const segLabel = SEGMENTOS_ACT.find(s => s.value === selectedSegmento)?.label || 'não especificado';

      // Step 1: Extract raw text from the document
      let rawText = '';

      if (pendingFile.type.startsWith('image/')) {
        // Use vision OCR for images
        const payload = await fileToVisionPayload(pendingFile);
        if (payload) {
          const { data, error } = await supabase.functions.invoke('document-vision-extract', {
            body: {
              fileName: pendingFile.name,
              images: [payload],
              mode: 'ocr',
            },
          });
          if (error) throw error;
          rawText = data?.text || '';
        }
      } else if (pendingFile.type === 'application/pdf') {
        // For PDFs: convert first page to image via canvas, then use vision OCR
        const pdfDataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = () => resolve('');
          reader.readAsDataURL(pendingFile);
        });

        if (pdfDataUrl) {
          // Send PDF as data URL to vision - the edge function accepts image data URLs
          // For PDFs we'll try reading text content and if insufficient use a text-based approach
          const textContent = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              const arr = new Uint8Array(e.target?.result as ArrayBuffer);
              // Try to extract readable text from PDF binary
              let text = '';
              try {
                const decoder = new TextDecoder('latin1');
                const raw = decoder.decode(arr);
                // Extract text between parentheses (PDF text objects)
                const matches = raw.match(/\(([^)]{2,})\)/g);
                if (matches) {
                  text = matches.map(m => m.slice(1, -1)).join(' ');
                }
              } catch {}
              resolve(text);
            };
            reader.onerror = () => resolve('');
            reader.readAsArrayBuffer(pendingFile);
          });

          // If we got meaningful text from PDF parsing, use it directly
          if (textContent.length > 50) {
            rawText = textContent.slice(0, 15000);
          } else {
            // Render PDF page to canvas for vision OCR
            // We'll use an object URL approach with an iframe/canvas
            // Since we can't use pdf.js easily, send whatever text we have
            rawText = textContent;
          }
        }
      }

      // Step 2: Use ai-chat to extract structured data from the raw text
      const extractPrompt = `Analise o texto extraído deste Atestado de Capacidade Técnica do segmento "${segLabel}".

EXTRAIA as seguintes informações e retorne em JSON puro (sem markdown, sem \`\`\`):
{
  "objeto": "descrição completa do objeto/serviço/fornecimento atestado",
  "orgao_emissor": "nome do órgão público ou empresa privada que emitiu/contratou (Cliente/Órgão contratante)",
  "ano_fornecimento": "ano ou período do fornecimento (ex: 2024, 2023/2024)",
  "valor": "valor contratual se mencionado",
  "cnpj_contratante": "CNPJ do contratante se encontrado",
  "periodo": "período completo de execução/fornecimento se mencionado"
}

REGRAS:
- Leia TODO o texto atentamente.
- "orgao_emissor" = quem CONTRATOU ou ATESTOU a capacidade (o cliente/órgão).
- "ano_fornecimento" = o ano em que o fornecimento ou serviço foi prestado.
- "objeto" = o que foi fornecido ou o serviço prestado.
- Campo não encontrado = "".
- NÃO invente dados ausentes.

TEXTO DO DOCUMENTO:
${rawText.slice(0, 12000)}`;

      const { data: aiData, error: aiError } = await supabase.functions.invoke('ai-chat', {
        body: {
          messages: [{ role: 'user', content: extractPrompt }],
          action: 'extracao_act',
        },
      });
      if (aiError) throw aiError;

      let responseText = '';
      if (typeof aiData === 'string') responseText = aiData;
      else if (aiData?.text) responseText = aiData.text;
      else if (aiData?.choices?.[0]?.message?.content) responseText = aiData.choices[0].message.content;

      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        setExtractedData({
          objeto: parsed.objeto || '',
          orgao_emissor: parsed.orgao_emissor || '',
          ano_fornecimento: parsed.ano_fornecimento || '',
          valor: parsed.valor || '',
          cnpj_contratante: parsed.cnpj_contratante || '',
          periodo: parsed.periodo || '',
        });
        toast.success('Dados do atestado extraídos pela IA!');
      } else {
        toast.info('Não foi possível extrair dados automaticamente. Preencha manualmente.');
      }
    } catch (err) {
      console.error('ACT extraction error:', err);
      toast.error('Erro na extração. Preencha manualmente.');
    }
    setAnalyzing(false);
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
        dados_extraidos: extractedData || null,
      });
      if (dbError) throw dbError;

      toast.success(`Atestado de "${segLabel}" adicionado!`);
      setUploadDialogOpen(false);
      fetchDocs();
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
          <FolderOpen className="w-4 h-4 text-accent" />
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
                'px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors border',
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
                    'px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors border flex items-center gap-1',
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
                  <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon className="w-4 h-4 text-accent" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">{seg?.label || doc.segmento}</Badge>
                      <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                      <span className="text-[10px] text-success font-medium">Cadastrado</span>
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
                        <span className="text-xs text-foreground/80">
                          <span className="text-muted-foreground">Cliente/Órgão: </span>
                          <strong>{doc.dados_extraidos.orgao_emissor}</strong>
                        </span>
                      )}
                      {doc.dados_extraidos?.ano_fornecimento && (
                        <span className="text-xs text-foreground/80">
                          <span className="text-muted-foreground">Ano: </span>
                          <strong>{doc.dados_extraidos.ano_fornecimento}</strong>
                        </span>
                      )}
                      {doc.dados_extraidos?.valor && (
                        <Badge variant="outline" className="text-[10px]">R$ {doc.dados_extraidos.valor}</Badge>
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
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-accent" />
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
                            <span className="text-[10px] text-muted-foreground ml-1.5">– {seg.sublabel}</span>
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
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={handleFileSelect}
                className="mt-1"
              />
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

            {/* Extracted data display */}
            {extractedData && (
              <div className="space-y-2 p-3 bg-accent/5 rounded-lg border border-accent/20">
                <p className="text-xs font-semibold text-accent flex items-center gap-1">
                  <Bot className="w-3 h-3" /> Dados Extraídos pela IA
                </p>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Objeto</Label>
                  <Textarea
                    value={extractedData.objeto || ''}
                    onChange={e => setExtractedData(prev => ({ ...prev, objeto: e.target.value }))}
                    className="mt-0.5 text-xs min-h-[50px]"
                    placeholder="Descrição do objeto atestado"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Cliente / Órgão Contratante</Label>
                  <Input
                    value={extractedData.orgao_emissor || ''}
                    onChange={e => setExtractedData(prev => ({ ...prev, orgao_emissor: e.target.value }))}
                    className="mt-0.5 text-xs h-8"
                    placeholder="Órgão público ou empresa contratante"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Ano do Fornecimento</Label>
                    <Input
                      value={extractedData.ano_fornecimento || ''}
                      onChange={e => setExtractedData(prev => ({ ...prev, ano_fornecimento: e.target.value }))}
                      className="mt-0.5 text-xs h-8"
                      placeholder="Ex: 2024"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Valor</Label>
                    <Input
                      value={extractedData.valor || ''}
                      onChange={e => setExtractedData(prev => ({ ...prev, valor: e.target.value }))}
                      className="mt-0.5 text-xs h-8"
                      placeholder="Valor contratual"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">CNPJ Contratante</Label>
                    <Input
                      value={extractedData.cnpj_contratante || ''}
                      onChange={e => setExtractedData(prev => ({ ...prev, cnpj_contratante: e.target.value }))}
                      className="mt-0.5 text-xs h-8"
                      placeholder="00.000.000/0000-00"
                    />
                  </div>
                </div>
                      className="mt-0.5 text-xs h-8"
                      placeholder="Ex: 01/2024 a 12/2024"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Info about validity */}
            <p className="text-[11px] text-muted-foreground italic">
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
