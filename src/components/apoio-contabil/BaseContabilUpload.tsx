import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import EstadoVazio from '@/components/shared/EstadoVazio';
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

/** O Select da ui não aceita item com valor vazio; o filtro "todos" continua
 *  sendo `''` no estado (é o que a filtragem abaixo testa com `!filtroTipo`). */
const TODOS_TIPOS = 'todos';

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
  const arquivoRef = useRef<HTMLInputElement>(null);

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
      <section className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" aria-hidden="true" />
            Alimentar Base Contábil da IA
          </h2>
          <p className="text-sm text-muted-foreground">
            Faça upload de balanços, DREs, balancetes, pareceres contábeis e normas para enriquecer as análises da IA.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="bc-arquivo">Arquivo (PDF/TXT/XLS/DOC)</Label>
            <Input id="bc-arquivo" ref={arquivoRef} type="file" accept=".pdf,.txt,.doc,.docx,.xls,.xlsx,.csv,.rtf" onChange={handleFileChange} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bc-tipo">Tipo de Documento</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger id="bc-tipo"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS_DOCUMENTO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {file && (
          <Button variant="outline" onClick={extractWithAI} disabled={extracting}>
            {extracting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
            {extracting ? 'Extraindo com IA...' : 'Extrair dados com IA'}
          </Button>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="bc-titulo">Título</Label>
            <Input id="bc-titulo" value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Balanço Patrimonial 2025 - Prefeitura X" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bc-orgao">Órgão / Empresa Emissora</Label>
            <Input id="bc-orgao" value={orgaoEmissor} onChange={e => setOrgaoEmissor(e.target.value)} placeholder="Ex: Prefeitura de Belém, CFC, CRC-PA" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="bc-numero">Nº do Documento</Label>
            <Input id="bc-numero" value={numeroDocumento} onChange={e => setNumeroDocumento(e.target.value)} placeholder="NBC TG 26, IN RFB 1.234" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bc-tags">Tags (separadas por vírgula)</Label>
            <Input id="bc-tags" value={tags} onChange={e => setTags(e.target.value)} placeholder="balanço, ICMS, precificação, BDI" />
          </div>
        </div>

        {ementaExtraida && (
          <div className="space-y-2">
            <Label htmlFor="bc-ementa">Resumo extraído pela IA</Label>
            <Textarea id="bc-ementa" value={ementaExtraida} onChange={e => setEmentaExtraida(e.target.value)} className="min-h-20 text-sm" />
          </div>
        )}

        <Button onClick={handleUpload} disabled={uploading || !file || !titulo}>
          {uploading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}
          Adicionar à Base Contábil
        </Button>
      </section>

      <section className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" aria-hidden="true" />
          Documentos na Base ({docs.length})
        </h2>

        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <div className="flex-1 min-w-0 space-y-2">
            <Label htmlFor="bc-busca">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input id="bc-busca" placeholder="Buscar por título, resumo ou órgão..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
          </div>
          <div className="w-full md:w-64 space-y-2">
            <Label htmlFor="bc-filtro-tipo">Tipo</Label>
            <Select
              value={filtroTipo || TODOS_TIPOS}
              onValueChange={v => setFiltroTipo(v === TODOS_TIPOS ? '' : v)}
            >
              <SelectTrigger id="bc-filtro-tipo"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS_TIPOS}>Todos os tipos</SelectItem>
                {TIPOS_DOCUMENTO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3" role="status" aria-busy="true">
            <span className="sr-only">Carregando documentos</span>
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-md" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EstadoVazio
            tamanho="compacto"
            icone={<Calculator />}
            titulo={docs.length === 0 ? 'Nenhum documento na base contábil' : 'Nenhum documento corresponde ao filtro'}
            descricao={
              docs.length === 0
                ? 'Faça upload de balanços, DREs e normas para enriquecer a IA'
                : 'Ajuste a busca ou o tipo de documento para ver outros resultados'
            }
            acao={
              docs.length === 0 ? (
                <Button variant="outline" onClick={() => arquivoRef.current?.focus()}>
                  <Upload aria-hidden="true" /> Selecionar arquivo
                </Button>
              ) : (
                <Button variant="outline" onClick={() => { setSearch(''); setFiltroTipo(''); }}>
                  Limpar filtros
                </Button>
              )
            }
          />
        ) : (
          <div className="space-y-3">
            {filtered.map(doc => {
              const Icon = TipoIcon(doc.tipo);
              return (
                <div key={doc.id} className="flex items-start gap-3 rounded-md border border-border p-3">
                  <div className="w-10 h-10 rounded-md bg-primary-tint text-primary flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-base text-foreground truncate">{doc.titulo}</p>
                    <div className="flex flex-wrap items-center gap-1 mt-1">
                      <Badge variant="info">{tipoLabel(doc.tipo)}</Badge>
                      {doc.orgao_emissor && <Badge variant="muted">{doc.orgao_emissor}</Badge>}
                    </div>
                    {doc.ementa && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{doc.ementa}</p>}
                    {doc.tags && doc.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-1">
                        {doc.tags.map((tag, i) => (
                          <span key={i} className="inline-flex items-center gap-1 text-xs text-primary">
                            <Tag className="w-3 h-3" aria-hidden="true" />{tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {doc.arquivo_nome} · {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                      {doc.texto_integral ? ` · ${(doc.texto_integral.length / 1000).toFixed(0)}k chars indexados` : ''}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(doc.id)}
                    aria-label={`Remover ${doc.titulo}`}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
