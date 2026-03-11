import { useState, useRef, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
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
  FileText, Upload, CheckCircle2, AlertTriangle, Clock,
  Shield, FolderOpen, Download, FileArchive, ClipboardList, Trash2, Loader2,
  CalendarDays, Bot
} from 'lucide-react';
import MergeDocumentos from '@/components/documentos/MergeDocumentos';
import AlertaVencimentoDocumentos from '@/components/documentos/AlertaVencimentoDocumentos';
import ChecklistModalidade from '@/components/licitacoes/ChecklistModalidade';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

type DocStatus = 'ok' | 'pendente' | 'vencido' | 'ausente';

type Documento = {
  nome: string;
  categoria: string;
  artigo: string;
  status: DocStatus;
  validade?: string;
  arquivo?: string;
  storagePath?: string;
};

// Checklist de documentos exigidos pela Lei 14.133/2021 — status começa como 'ausente'
// e será atualizado conforme o usuário faz upload
const checklistDocumentos: Documento[] = [
  { nome: 'Ato Constitutivo / Contrato Social', categoria: 'Habilitação Jurídica', artigo: 'Art. 66', status: 'ausente' },
  { nome: 'Cédula de Identidade dos Sócios', categoria: 'Habilitação Jurídica', artigo: 'Art. 66', status: 'ausente' },
  { nome: 'Certidão Simplificada da Junta Comercial', categoria: 'Habilitação Jurídica', artigo: 'Art. 66', status: 'ausente' },
  { nome: 'Certidão Negativa de Débitos Federais (CND)', categoria: 'Regularidade Fiscal', artigo: 'Art. 68', status: 'ausente' },
  { nome: 'Certidão de Regularidade do FGTS (CRF)', categoria: 'Regularidade Fiscal', artigo: 'Art. 68', status: 'ausente' },
  { nome: 'Certidão Negativa de Débitos Estaduais', categoria: 'Regularidade Fiscal', artigo: 'Art. 68', status: 'ausente' },
  { nome: 'Certidão Negativa de Débitos Municipais', categoria: 'Regularidade Fiscal', artigo: 'Art. 68', status: 'ausente' },
  { nome: 'CNDT – Certidão Trabalhista', categoria: 'Regularidade Fiscal', artigo: 'Art. 68', status: 'ausente' },
  { nome: 'Registro no CREA/CAU', categoria: 'Qualificação Técnica', artigo: 'Art. 67', status: 'ausente' },
  { nome: 'Atestado de Capacidade Técnica', categoria: 'Qualificação Técnica', artigo: 'Art. 67', status: 'ausente' },
  { nome: 'CAT – Certidão de Acervo Técnico', categoria: 'Qualificação Técnica', artigo: 'Art. 67', status: 'ausente' },
  { nome: 'Balanço Patrimonial (último exercício)', categoria: 'Qualif. Econômico-Financeira', artigo: 'Art. 69', status: 'ausente' },
  { nome: 'Certidão Negativa de Falência', categoria: 'Qualif. Econômico-Financeira', artigo: 'Art. 69', status: 'ausente' },
  { nome: 'Declaração de Inexistência de Fato Impeditivo', categoria: 'Declarações', artigo: 'Art. 63, §1º', status: 'ausente' },
  { nome: 'Declaração de Não Emprego de Menor', categoria: 'Declarações', artigo: 'Art. 68, VI', status: 'ausente' },
  { nome: 'Declaração ME/EPP (se aplicável)', categoria: 'Declarações', artigo: 'LC 123/2006', status: 'ausente' },
];

const statusConfig: Record<DocStatus, { icon: typeof CheckCircle2; color: string; label: string }> = {
  ok: { icon: CheckCircle2, color: 'text-success', label: 'Regular' },
  pendente: { icon: Clock, color: 'text-warning', label: 'Pendente' },
  vencido: { icon: AlertTriangle, color: 'text-destructive', label: 'Vencido' },
  ausente: { icon: AlertTriangle, color: 'text-destructive', label: 'Ausente' },
};

export default function Documentos() {
  const [filter, setFilter] = useState<DocStatus | 'todos'>('todos');
  const [activeTab, setActiveTab] = useState('documentos');
  const [documentos, setDocumentos] = useState<Documento[]>(checklistDocumentos);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [removingIdx, setRemovingIdx] = useState<number | null>(null);
  const [analyzingIdx, setAnalyzingIdx] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingUploadIdx = useRef<number | null>(null);
  const { user } = useAuth();

  // Validade dialog state
  const [validadeDialogOpen, setValidadeDialogOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingValidadeDate, setPendingValidadeDate] = useState<Date | undefined>(undefined);
  const [pendingManualDate, setPendingManualDate] = useState('');

  // Sync checklist status from uploaded documents in DB
  useEffect(() => {
    if (!user) return;
    const syncFromDB = async () => {
      const { data } = await supabase
        .from('documentos')
        .select('id, nome, validade, arquivo_path')
        .eq('user_id', user.id);
      if (!data) return;
      setDocumentos(
        checklistDocumentos.map((doc) => {
          const match = data.find((d) => d.nome === doc.nome);
          if (!match) {
            return { ...doc, status: 'ausente' as DocStatus, validade: undefined, arquivo: undefined, storagePath: undefined };
          }

          const hoje = new Date();
          const validade = match.validade ? new Date(match.validade) : null;
          let status: DocStatus = 'ok';
          if (validade && validade < hoje) status = 'vencido';
          else if (validade) {
            const diff = (validade.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24);
            if (diff <= 30) status = 'pendente';
          }

          return {
            ...doc,
            status,
            validade: match.validade || undefined,
            arquivo: match.arquivo_path || undefined,
            storagePath: match.arquivo_path || undefined,
          };
        })
      );
    };
    syncFromDB();

    const channel = supabase
      .channel('documentos-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documentos', filter: `user_id=eq.${user.id}` }, () => syncFromDB())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

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
    const path = `${user.id}/${slug}.${ext}`;

    // Remove old file if exists
    if (documentos[idx].storagePath) {
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
    if (idx === null) return;

    setAnalyzingIdx(idx);
    
    try {
      // Call AI to analyze the document for expiry date
      const response = await supabase.functions.invoke('ai-chat', {
        body: {
          messages: [
            {
              role: 'user',
              content: `Analise o nome deste documento de habilitação para licitações e informe a validade padrão segundo a legislação brasileira. Documento: "${documentos[idx].nome}". Categoria: "${documentos[idx].categoria}". Responda APENAS com a data provável de vencimento no formato YYYY-MM-DD, calculando a partir de hoje (${format(new Date(), 'yyyy-MM-dd')}). Se não houver validade padrão, responda "SEM_VALIDADE".`
            }
          ]
        }
      });

      if (response.data) {
        const text = typeof response.data === 'string' ? response.data : 
          response.data?.choices?.[0]?.message?.content || '';
        const dateMatch = text.match(/\d{4}-\d{2}-\d{2}/);
        if (dateMatch) {
          const suggestedDate = new Date(dateMatch[0]);
          setPendingValidadeDate(suggestedDate);
          setPendingManualDate(dateMatch[0]);
          toast.success(`IA sugeriu validade: ${format(suggestedDate, 'dd/MM/yyyy')}`);
        } else {
          toast.info('IA não identificou uma data de validade padrão para este documento.');
        }
      }
    } catch {
      toast.error('Erro na análise por IA. Informe a validade manualmente.');
    } finally {
      setAnalyzingIdx(null);
    }
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

  const handleRemove = async (globalIdx: number) => {
    if (!user) return;
    const doc = documentos[globalIdx];

    setRemovingIdx(globalIdx);

    if (doc.storagePath) {
      const { error } = await supabase.storage.from('documentos-habilitacao').remove([doc.storagePath]);
      if (error) {
        toast.error('Erro ao remover: ' + error.message);
        setRemovingIdx(null);
        return;
      }
    }

    setDocumentos(prev => prev.map((d, i) =>
      i === globalIdx ? { ...d, arquivo: undefined, storagePath: undefined, status: 'pendente' as DocStatus } : d
    ));

    toast.success(`"${doc.nome}" removido.`);
    setRemovingIdx(null);
  };

  const getGlobalIndex = (doc: Documento) => documentos.findIndex(d => d.nome === doc.nome);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Shield className="w-6 h-6 text-accent" />
              Controle de Documentos
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Conformidade com a Lei 14.133/2021 e legislação vigente
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="documentos" className="flex items-center gap-1">
              <FolderOpen className="w-4 h-4" /> Documentos
            </TabsTrigger>
            <TabsTrigger value="merge" className="flex items-center gap-1">
              <FileArchive className="w-4 h-4" /> Juntar PDF/ZIP
            </TabsTrigger>
            <TabsTrigger value="checklist" className="flex items-center gap-1">
              <ClipboardList className="w-4 h-4" /> Checklist
            </TabsTrigger>
          </TabsList>

          <TabsContent value="documentos" className="space-y-4">
            <AlertaVencimentoDocumentos documentos={documentos} />

            {/* Progress */}
            <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Conformidade Geral</span>
                <span className="text-sm font-bold text-accent">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
              <div className="flex gap-4 mt-3">
                {(['ok', 'pendente', 'vencido', 'ausente'] as DocStatus[]).map((s) => {
                  const cfg = statusConfig[s];
                  const count = documentos.filter((d) => d.status === s).length;
                  return (
                    <button
                      key={s}
                      onClick={() => setFilter(filter === s ? 'todos' : s)}
                      className={`flex items-center gap-1 text-xs ${cfg.color} ${filter === s ? 'font-bold underline' : ''}`}
                    >
                      <cfg.icon className="w-3 h-3" />
                      {count} {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Docs by Category */}
            <div className="space-y-4">
              {categorias.map((cat) => {
                const docs = filtered.filter((d) => d.categoria === cat);
                if (docs.length === 0) return null;
                return (
                  <div key={cat} className="bg-card rounded-xl border border-border/50 shadow-sm">
                    <div className="flex items-center gap-2 px-5 py-3 border-b border-border/50">
                      <FolderOpen className="w-4 h-4 text-accent" />
                      <h3 className="text-sm font-semibold">{cat}</h3>
                      <Badge variant="outline" className="ml-auto text-xs">
                        {docs[0]?.artigo}
                      </Badge>
                    </div>
                    <div className="divide-y divide-border/30">
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
                              <div>
                                <p className="text-sm font-medium">{doc.nome}</p>
                                {doc.validade && (
                                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <CalendarDays className="w-3 h-3" />
                                    Validade: {new Date(doc.validade).toLocaleDateString('pt-BR')}
                                  </p>
                                )}
                                {doc.arquivo && (
                                  <p className="text-xs text-muted-foreground/70 flex items-center gap-1">
                                    <FileText className="w-3 h-3" /> {doc.arquivo}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={`text-xs ${cfg.color}`}>
                                {cfg.label}
                              </Badge>
                              {doc.arquivo ? (
                                <div className="flex gap-1">
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
                                    {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleRemove(globalIdx)}
                                    disabled={isRemoving}
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                    title="Remover arquivo"
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
          </TabsContent>

          <TabsContent value="merge">
            <MergeDocumentos />
          </TabsContent>

          <TabsContent value="checklist">
            <ChecklistModalidade />
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
                <CalendarDays className="w-5 h-5 text-accent" />
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
                <Label className="text-xs text-muted-foreground">Ou digite: DD/MM/AAAA</Label>
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
                    // Try to parse DD/MM/YYYY
                    const match = val.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
                    if (match) {
                      const d = new Date(`${match[3]}-${match[2]}-${match[1]}`);
                      if (!isNaN(d.getTime())) {
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
                <div className="flex items-center gap-2 p-2 bg-accent/10 rounded-lg text-sm">
                  <CheckCircle2 className="w-4 h-4 text-accent" />
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
      </div>
    </AppLayout>
  );
}
