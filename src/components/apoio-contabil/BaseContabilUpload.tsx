import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Upload, FileText, Trash2, Sparkles, Loader2, Search,
  BookOpen, Calculator, BarChart3, ClipboardList, FileWarning, Tag
} from 'lucide-react';

const TIPOS_DOCUMENTO = [
  { value: 'balanco', label: 'Balanço Patrimonial', icon: BarChart3 },
  { value: 'dre', label: 'DRE', icon: Calculator },
  { value: 'balancete', label: 'Balancete', icon: ClipboardList },
  { value: 'parecer_contabil', label: 'Parecer Contábil', icon: FileWarning },
  { value: 'norma', label: 'Norma Contábil', icon: FileText },
  { value: 'legislacao_tributaria', label: 'Legislação Tributária', icon: BookOpen },
  { value: 'demonstracao_fluxo', label: 'Demonstração Fluxo de Caixa', icon: BarChart3 },
  { value: 'nota_explicativa', label: 'Nota Explicativa', icon: FileText },
];

type DocContabil = {
  id: string;
  titulo: string;
  tipo: string;
  orgao_emissor: string | null;
  numero_documento: string | null;
  ementa: string | null;
  texto_integral: string | null;
  arquivo_nome: string;
  tags: string[];
  created_at: string;
};

export default function BaseContabilUpload() {
  const { user } = useAuth();
  const [docs, setDocs] = useState<DocContabil[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [search, setSearch] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');

  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState('balanco');
  const [orgaoEmissor, setOrgaoEmissor] = useState('');
  const [numeroDocumento, setNumeroDocumento] = useState('');
  const [tags, setTags] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [textoExtraido, setTextoExtraido] = useState('');
  const [ementaExtraida, setEmentaExtraida] = useState('');

  const fetchDocs = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('base_contabil')
      .select('id, titulo, tipo, orgao_emissor, numero_documento, ementa, texto_integral, arquivo_nome, tags, created_at')
      .order('created_at', { ascending: false });
    if (!error && data) setDocs(data as DocContabil[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const extractTextFromFile = async (f: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve((e.target?.result as string)?.slice(0, 50000) || '');
      reader.onerror = () => resolve('');
      reader.readAsText(f);
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    if (!titulo) setTitulo(f.name.replace(/\.[^/.]+$/, ''));
  };

  const extractWithAI = async () => {
    if (!file) return;
    setExtracting(true);
    try {
      const rawText = await extractTextFromFile(file);
      if (!rawText || rawText.length < 50) {
        toast.info('Texto muito curto para extração automática.');
        setExtracting(false);
        return;
      }
      const truncated = rawText.slice(0, 15000);
      const { streamAIChat } = await import('@/lib/ai-stream');
      let fullText = '';
      let streamErr = '';
      await streamAIChat({
        messages: [{
          role: 'user',
          content: `Analise o documento contábil abaixo e extraia as seguintes informações em JSON:\n{\n  "titulo": "título do documento",\n  "tipo": "balanco|dre|balancete|parecer_contabil|norma|legislacao_tributaria|demonstracao_fluxo|nota_explicativa",\n  "orgao_emissor": "órgão emissor ou empresa",\n  "numero_documento": "número do documento se houver",\n  "ementa": "resumo do documento com foco em dados contábeis relevantes (máx 500 palavras)",\n  "tags": ["palavras-chave relevantes para contabilidade, tributação e licitações"]\n}\n\nDocumento:\n${truncated}`,
        }],
        action: 'extracao_contabil',
        onDelta: (chunk) => { fullText += chunk; },
        onDone: () => {},
        onError: (err) => { streamErr = err; },
      });
      if (streamErr) throw new Error(streamErr);
      const jsonMatch = fullText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.titulo) setTitulo(parsed.titulo);
        if (parsed.tipo) setTipo(parsed.tipo);
        if (parsed.orgao_emissor) setOrgaoEmissor(parsed.orgao_emissor);
        if (parsed.numero_documento) setNumeroDocumento(parsed.numero_documento);
        if (parsed.ementa) setEmentaExtraida(parsed.ementa);
        if (parsed.tags) setTags(parsed.tags.join(', '));
        setTextoExtraido(truncated);
        toast.success('Dados extraídos com sucesso pela IA!');
      } else {
        toast.warning('Extração concluída, mas nenhum dado estruturado foi identificado. Preencha os campos manualmente.');
      }
    } catch (err: any) {
      console.error(err);
      const isAuth = /invalid token|unauthorized|sessão/i.test(err?.message ?? '');
      toast.error(
        isAuth ? 'Sessão expirada' : 'Falha na extração automática do documento',
        {
          description: isAuth
            ? 'Recarregue a página (F5) e faça login novamente.'
            : 'Preencha os campos manualmente ou tente outro formato de arquivo (PDF, DOCX, TXT).',
          duration: 8000,
        }
      );
    }
    setExtracting(false);
  };

  const handleUpload = async () => {
    if (!user || !file || !titulo) {
      toast.error('Preencha o título e selecione um arquivo');
      return;
    }
    setUploading(true);
    try {
      const filePath = `${user.id}/contabil/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from('documentos').upload(filePath, file);
      if (uploadError) throw uploadError;

      let textoFinal = textoExtraido;
      if (!textoFinal) {
        textoFinal = await extractTextFromFile(file);
        textoFinal = textoFinal.slice(0, 50000);
      }
      const tagsArray = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];

      const { error: dbError } = await supabase.from('base_contabil').insert({
        user_id: user.id,
        titulo,
        tipo,
        orgao_emissor: orgaoEmissor || null,
        numero_documento: numeroDocumento || null,
        ementa: ementaExtraida || null,
        texto_integral: textoFinal || null,
        arquivo_path: filePath,
        arquivo_nome: file.name,
        tags: tagsArray,
      });
      if (dbError) throw dbError;
      toast.success('Documento contábil adicionado à base da IA!');
      resetForm();
      fetchDocs();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar documento');
    }
    setUploading(false);
  };

  const resetForm = () => {
    setTitulo(''); setTipo('balanco'); setOrgaoEmissor(''); setNumeroDocumento('');
    setTags(''); setFile(null); setTextoExtraido(''); setEmentaExtraida('');
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('base_contabil').delete().eq('id', id);
    if (!error) {
      setDocs(prev => prev.filter(d => d.id !== id));
      toast.success('Documento removido da base');
    }
  };

  const filtered = docs.filter(d => {
    const matchSearch = !search ||
      d.titulo.toLowerCase().includes(search.toLowerCase()) ||
      d.ementa?.toLowerCase().includes(search.toLowerCase()) ||
      d.orgao_emissor?.toLowerCase().includes(search.toLowerCase());
    const matchTipo = !filtroTipo || d.tipo === filtroTipo;
    return matchSearch && matchTipo;
  });

  const tipoLabel = (t: string) => TIPOS_DOCUMENTO.find(td => td.value === t)?.label || t;
  const TipoIcon = (t: string) => TIPOS_DOCUMENTO.find(td => td.value === t)?.icon || FileText;

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl border border-border/50 p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Upload className="w-5 h-5 text-accent" />
          <h3 className="text-sm font-semibold">Alimentar Base Contábil da IA</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Faça upload de balanços, DREs, balancetes, pareceres contábeis e normas para enriquecer as análises da IA.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground">Arquivo (PDF/TXT/XLS/DOC)</label>
            <Input type="file" accept=".pdf,.txt,.doc,.docx,.xls,.xlsx,.csv,.rtf" onChange={handleFileChange} className="mt-1" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Tipo de Documento</label>
            <select value={tipo} onChange={e => setTipo(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              {TIPOS_DOCUMENTO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>

        {file && (
          <Button variant="outline" size="sm" onClick={extractWithAI} disabled={extracting}>
            {extracting ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
            {extracting ? 'Extraindo com IA...' : 'Extrair dados com IA'}
          </Button>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground">Título</label>
            <Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Balanço Patrimonial 2025 - Prefeitura X" className="mt-1" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Órgão / Empresa Emissora</label>
            <Input value={orgaoEmissor} onChange={e => setOrgaoEmissor(e.target.value)} placeholder="Ex: Prefeitura de Belém, CFC, CRC-PA" className="mt-1" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground">Nº do Documento</label>
            <Input value={numeroDocumento} onChange={e => setNumeroDocumento(e.target.value)} placeholder="NBC TG 26, IN RFB 1.234" className="mt-1" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Tags (separadas por vírgula)</label>
            <Input value={tags} onChange={e => setTags(e.target.value)} placeholder="balanço, ICMS, precificação, BDI" className="mt-1" />
          </div>
        </div>

        {ementaExtraida && (
          <div>
            <label className="text-xs text-muted-foreground">Resumo extraído pela IA</label>
            <Textarea value={ementaExtraida} onChange={e => setEmentaExtraida(e.target.value)} className="mt-1 min-h-[80px] text-xs" />
          </div>
        )}

        <Button onClick={handleUpload} disabled={uploading || !file || !titulo} className="bg-accent hover:bg-accent/90 text-accent-foreground">
          {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
          Adicionar à Base Contábil
        </Button>
      </div>

      <div className="bg-card rounded-xl border border-border/50 p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-accent" />
          <h3 className="text-sm font-semibold">Documentos na Base ({docs.length})</h3>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por título, resumo ou órgão..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="">Todos os tipos</option>
            {TIPOS_DOCUMENTO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calculator className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhum documento na base contábil</p>
            <p className="text-xs mt-1">Faça upload de balanços, DREs e normas para enriquecer a IA</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(doc => {
              const Icon = TipoIcon(doc.tipo);
              return (
                <div key={doc.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{doc.titulo}</p>
                    <div className="flex flex-wrap items-center gap-1 mt-1">
                      <Badge variant="outline" className="text-[10px]">{tipoLabel(doc.tipo)}</Badge>
                      {doc.orgao_emissor && <Badge variant="secondary" className="text-[10px]">{doc.orgao_emissor}</Badge>}
                    </div>
                    {doc.ementa && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{doc.ementa}</p>}
                    {doc.tags && doc.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {doc.tags.map((tag, i) => (
                          <span key={i} className="inline-flex items-center gap-0.5 text-[10px] text-accent">
                            <Tag className="w-2.5 h-2.5" />{tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {doc.arquivo_nome} · {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                      {doc.texto_integral ? ` · ${(doc.texto_integral.length / 1000).toFixed(0)}k chars indexados` : ''}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(doc.id)} className="text-destructive hover:text-destructive">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
