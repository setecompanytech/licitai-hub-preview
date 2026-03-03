import { useState, useRef } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FileText, Upload, CheckCircle2, AlertTriangle, Clock,
  Shield, FolderOpen, Download, Eye, FileArchive, ClipboardList, Trash2, Loader2
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

const documentosIniciais: Documento[] = [
  { nome: 'Ato Constitutivo / Contrato Social', categoria: 'Habilitação Jurídica', artigo: 'Art. 66', status: 'ok', arquivo: 'contrato-social.pdf' },
  { nome: 'Cédula de Identidade dos Sócios', categoria: 'Habilitação Jurídica', artigo: 'Art. 66', status: 'ok', arquivo: 'rg-socios.pdf' },
  { nome: 'Certidão Simplificada da Junta Comercial', categoria: 'Habilitação Jurídica', artigo: 'Art. 66', status: 'pendente', validade: '2026-03-15' },
  { nome: 'Certidão Negativa de Débitos Federais (CND)', categoria: 'Regularidade Fiscal', artigo: 'Art. 68', status: 'ok', validade: '2026-06-20', arquivo: 'cnd-federal.pdf' },
  { nome: 'Certidão de Regularidade do FGTS (CRF)', categoria: 'Regularidade Fiscal', artigo: 'Art. 68', status: 'vencido', validade: '2026-01-10' },
  { nome: 'Certidão Negativa de Débitos Estaduais', categoria: 'Regularidade Fiscal', artigo: 'Art. 68', status: 'ok', validade: '2026-08-01', arquivo: 'cnd-estadual.pdf' },
  { nome: 'Certidão Negativa de Débitos Municipais', categoria: 'Regularidade Fiscal', artigo: 'Art. 68', status: 'pendente' },
  { nome: 'CNDT – Certidão Trabalhista', categoria: 'Regularidade Fiscal', artigo: 'Art. 68', status: 'ok', validade: '2026-05-10', arquivo: 'cndt.pdf' },
  { nome: 'Registro no CREA/CAU', categoria: 'Qualificação Técnica', artigo: 'Art. 67', status: 'ok', arquivo: 'crea.pdf' },
  { nome: 'Atestado de Capacidade Técnica', categoria: 'Qualificação Técnica', artigo: 'Art. 67', status: 'ok', arquivo: 'atestado-tecnico.pdf' },
  { nome: 'CAT – Certidão de Acervo Técnico', categoria: 'Qualificação Técnica', artigo: 'Art. 67', status: 'ausente' },
  { nome: 'Balanço Patrimonial (último exercício)', categoria: 'Qualif. Econômico-Financeira', artigo: 'Art. 69', status: 'ok', arquivo: 'balanco-2025.pdf' },
  { nome: 'Certidão Negativa de Falência', categoria: 'Qualif. Econômico-Financeira', artigo: 'Art. 69', status: 'ok', validade: '2026-09-01', arquivo: 'certidao-falencia.pdf' },
  { nome: 'Declaração de Inexistência de Fato Impeditivo', categoria: 'Declarações', artigo: 'Art. 63, §1º', status: 'ok', arquivo: 'decl-impeditivo.pdf' },
  { nome: 'Declaração de Não Emprego de Menor', categoria: 'Declarações', artigo: 'Art. 68, VI', status: 'ok', arquivo: 'decl-menor.pdf' },
  { nome: 'Declaração ME/EPP (se aplicável)', categoria: 'Declarações', artigo: 'LC 123/2006', status: 'pendente' },
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
  const [documentos, setDocumentos] = useState<Documento[]>(documentosIniciais);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [removingIdx, setRemovingIdx] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingUploadIdx = useRef<number | null>(null);
  const { user } = useAuth();

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
      e.target.value = '';
      return;
    }

    setDocumentos(prev => prev.map((d, i) =>
      i === idx ? { ...d, arquivo: file.name, storagePath: path, status: 'ok' as DocStatus } : d
    ));

    toast.success(`"${documentos[idx].nome}" enviado com sucesso!`);
    setUploadingIdx(null);
    e.target.value = '';
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
                                  <p className="text-xs text-muted-foreground">
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
      </div>
    </AppLayout>
  );
}
