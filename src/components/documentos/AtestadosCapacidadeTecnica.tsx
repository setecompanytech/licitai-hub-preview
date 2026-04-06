import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  Upload, Download, Trash2, Loader2, CalendarDays, Bot,
  CheckCircle2, AlertTriangle, Clock, Plus, FileText,
  ShoppingBasket, Monitor, Sparkles, Package, Utensils,
  Wrench, Shirt, Pill, Building2, FolderOpen
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
    valor?: string;
    cnpj_contratante?: string;
    periodo?: string;
  };
};

type ACTStatus = 'ok' | 'pendente' | 'vencido';

function getACTStatus(validade?: string): ACTStatus {
  if (!validade) return 'ok';
  const v = new Date(validade);
  const now = new Date();
  if (v < now) return 'vencido';
  const diff = (v.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diff <= 30) return 'pendente';
  return 'ok';
}

const statusConfig = {
  ok: { icon: CheckCircle2, color: 'text-success', label: 'Regular' },
  pendente: { icon: Clock, color: 'text-warning', label: 'A vencer' },
  vencido: { icon: AlertTriangle, color: 'text-destructive', label: 'Vencido' },
};

export default function AtestadosCapacidadeTecnica() {
  const { user } = useAuth();
  const [docs, setDocs] = useState<ACTDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedSegmento, setSelectedSegmento] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingValidade, setPendingValidade] = useState<Date | undefined>();
  const [pendingManualDate, setPendingManualDate] = useState('');
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ACTDoc['dados_extraidos']>();
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const openUploadDialog = (segmento: string) => {
    setSelectedSegmento(segmento);
    setPendingFile(null);
    setPendingValidade(undefined);
    setPendingManualDate('');
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

  const handleAIExtract = async () => {
    if (!pendingFile) return;
    setAnalyzing(true);
    try {
      const segLabel = SEGMENTOS_ACT.find(s => s.value === selectedSegmento)?.label || selectedSegmento;

      // Read file as text for AI
      const text = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve((e.target?.result as string)?.slice(0, 20000) || '');
        reader.onerror = () => resolve('');
        reader.readAsText(pendingFile!);
      });

      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          messages: [{
            role: 'user',
            content: `Analise este Atestado de Capacidade Técnica do segmento "${segLabel}" e extraia em JSON:
{
  "objeto": "descrição do objeto/serviço atestado",
  "orgao_emissor": "órgão ou empresa que emitiu o atestado",
  "valor": "valor contratual se mencionado",
  "cnpj_contratante": "CNPJ do contratante se encontrado",
  "periodo": "período de execução",
  "validade": "data de validade no formato DD/MM/AAAA se encontrada"
}

Documento:
${text}`
          }],
          action: 'extracao_act',
        },
      });

      if (error) throw error;

      // Parse response - handle streaming or direct
      let responseText = '';
      if (typeof data === 'string') {
        responseText = data;
      } else if (data?.text) {
        responseText = data.text;
      } else if (data?.choices?.[0]?.message?.content) {
        responseText = data.choices[0].message.content;
      }

      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        setExtractedData({
          objeto: parsed.objeto || '',
          orgao_emissor: parsed.orgao_emissor || '',
          valor: parsed.valor || '',
          cnpj_contratante: parsed.cnpj_contratante || '',
          periodo: parsed.periodo || '',
        });

        // Try to extract date from validade field
        if (parsed.validade) {
          const dateMatch = parsed.validade.match(/(\d{2})\/(\d{2})\/(\d{4})/);
          if (dateMatch) {
            const d = new Date(`${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`);
            if (!isNaN(d.getTime())) {
              setPendingValidade(d);
              setPendingManualDate(format(d, 'yyyy-MM-dd'));
            }
          }
        }

        toast.success('Dados do atestado extraídos pela IA!');
      } else {
        toast.info('Não foi possível extrair dados automaticamente.');
      }
    } catch (err) {
      console.error(err);
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
      const slug = nome.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60);
      const ext = pendingFile.name.split('.').pop();
      const path = `${user.id}/act-${selectedSegmento}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('documentos-habilitacao')
        .upload(path, pendingFile, { upsert: true });
      if (uploadError) throw uploadError;

      let validadeStr: string | undefined;
      if (pendingValidade) {
        validadeStr = format(pendingValidade, 'yyyy-MM-dd');
      } else if (pendingManualDate) {
        validadeStr = pendingManualDate;
      }

      const { error: dbError } = await supabase.from('documentos').insert({
        user_id: user.id,
        nome,
        tipo: 'Qualificação Técnica',
        descricao: extractedData?.objeto || `Atestado de Capacidade Técnica - ${segLabel}`,
        arquivo_path: path,
        validade: validadeStr || null,
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

  // Group docs by segmento
  const docsBySegmento = SEGMENTOS_ACT.map(seg => ({
    ...seg,
    docs: docs.filter(d => d.segmento === seg.value),
  }));

  const totalDocs = docs.length;
  const segmentosComDoc = new Set(docs.map(d => d.segmento)).size;

  return (
    <div className="bg-card rounded-xl border border-border/50 shadow-sm">
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
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="divide-y divide-border/30">
          {docsBySegmento.map(seg => {
            const Icon = seg.icon;
            return (
              <div key={seg.value} className="px-5 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{seg.label}</p>
                      <p className="text-[10px] text-muted-foreground">{seg.sublabel}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openUploadDialog(seg.value)}
                    className="gap-1 text-xs"
                  >
                    <Plus className="w-3 h-3" />
                    Adicionar
                  </Button>
                </div>

                {seg.docs.length === 0 ? (
                  <p className="text-xs text-muted-foreground/60 ml-6">Nenhum atestado neste segmento</p>
                ) : (
                  <div className="space-y-2 ml-6">
                    {seg.docs.map(doc => {
                      const status = getACTStatus(doc.validade);
                      const cfg = statusConfig[status];
                      const StatusIcon = cfg.icon;
                      return (
                        <div key={doc.id} className="flex items-start justify-between p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                          <div className="flex items-start gap-2 flex-1 min-w-0">
                            <StatusIcon className={`w-3.5 h-3.5 mt-0.5 ${cfg.color}`} />
                            <div className="min-w-0">
                              {doc.dados_extraidos?.objeto && (
                                <p className="text-xs font-medium truncate">{doc.dados_extraidos.objeto}</p>
                              )}
                              <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                {doc.dados_extraidos?.orgao_emissor && (
                                  <Badge variant="secondary" className="text-[10px]">{doc.dados_extraidos.orgao_emissor}</Badge>
                                )}
                                {doc.dados_extraidos?.valor && (
                                  <Badge variant="outline" className="text-[10px]">R$ {doc.dados_extraidos.valor}</Badge>
                                )}
                                <Badge variant="outline" className={`text-[10px] ${cfg.color}`}>{cfg.label}</Badge>
                              </div>
                              {doc.validade && (
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  <CalendarDays className="w-2.5 h-2.5 inline mr-0.5" />
                                  Validade: {new Date(doc.validade).toLocaleDateString('pt-BR')}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <Button size="sm" variant="ghost" onClick={() => handleDownload(doc)} title="Baixar">
                              <Download className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemove(doc)}
                              disabled={removingId === doc.id}
                              className="text-destructive hover:text-destructive"
                              title="Remover"
                            >
                              {removingId === doc.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
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
            <div className="text-sm font-medium bg-muted/50 p-2 rounded flex items-center gap-2">
              {(() => { const s = SEGMENTOS_ACT.find(s => s.value === selectedSegmento); const I = s?.icon || Package; return <I className="w-4 h-4 text-accent" />; })()}
              {SEGMENTOS_ACT.find(s => s.value === selectedSegmento)?.label}
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
            {pendingFile && (
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
                {extractedData.objeto && (
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Objeto</Label>
                    <Textarea
                      value={extractedData.objeto}
                      onChange={e => setExtractedData(prev => ({ ...prev, objeto: e.target.value }))}
                      className="mt-0.5 text-xs min-h-[50px]"
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {extractedData.orgao_emissor && (
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Órgão Emissor</Label>
                      <Input
                        value={extractedData.orgao_emissor}
                        onChange={e => setExtractedData(prev => ({ ...prev, orgao_emissor: e.target.value }))}
                        className="mt-0.5 text-xs h-8"
                      />
                    </div>
                  )}
                  {extractedData.valor && (
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Valor</Label>
                      <Input
                        value={extractedData.valor}
                        onChange={e => setExtractedData(prev => ({ ...prev, valor: e.target.value }))}
                        className="mt-0.5 text-xs h-8"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Validade */}
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
                      !pendingValidade && 'text-muted-foreground'
                    )}
                  >
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {pendingValidade ? format(pendingValidade, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione a validade'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={pendingValidade}
                    onSelect={(d) => {
                      setPendingValidade(d);
                      if (d) setPendingManualDate(format(d, 'yyyy-MM-dd'));
                    }}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <div>
                <Label className="text-[10px] text-muted-foreground">Ou digite: DD/MM/AAAA</Label>
                <Input
                  placeholder="DD/MM/AAAA"
                  value={pendingManualDate ? (() => {
                    try {
                      const d = new Date(pendingManualDate);
                      return isNaN(d.getTime()) ? pendingManualDate : format(d, 'dd/MM/yyyy');
                    } catch { return pendingManualDate; }
                  })() : ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    const match = val.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
                    if (match) {
                      const d = new Date(`${match[3]}-${match[2]}-${match[1]}`);
                      if (!isNaN(d.getTime())) {
                        setPendingValidade(d);
                        setPendingManualDate(format(d, 'yyyy-MM-dd'));
                        return;
                      }
                    }
                    setPendingManualDate(val);
                  }}
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="ghost" onClick={() => setUploadDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpload} disabled={uploading || !pendingFile}>
              {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
              Enviar Atestado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
