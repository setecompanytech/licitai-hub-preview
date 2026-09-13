import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Upload, FileText, Trash2, Sparkles, Loader2, Search,
  BookOpen, Scale, Gavel, ScrollText, FileWarning, Tag
} from 'lucide-react';

const TIPOS_DOCUMENTO = [
  { value: 'decisao', label: 'Decisão Judicial', icon: Gavel },
  { value: 'acordao', label: 'Acórdão', icon: Scale },
  { value: 'doutrina', label: 'Doutrina', icon: BookOpen },
  { value: 'sumula', label: 'Súmula', icon: ScrollText },
  { value: 'parecer', label: 'Parecer', icon: FileWarning },
  { value: 'legislacao', label: 'Legislação', icon: FileText },
];

// O Select da ui não aceita item com valor vazio; "todos os tipos" ganha um
// sentinela só na apresentação — o estado `filtroTipo` continua '' para "todos".
const TODOS_TIPOS = '__todos__';

type DocJuridico = {
  id: string;
  titulo: string;
  tipo: string;
  tribunal: string | null;
  numero_processo: string | null;
  ementa: string | null;
  texto_integral: string | null;
  arquivo_nome: string;
  tags: string[];
  created_at: string;
};

export default function BaseJuridicaUpload() {
  const { user } = useAuth();
  const [docs, setDocs] = useState<DocJuridico[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [search, setSearch] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');

  // Form state
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState('decisao');
  const [tribunal, setTribunal] = useState('');
  const [numeroProcesso, setNumeroProcesso] = useState('');
  const [tags, setTags] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [textoExtraido, setTextoExtraido] = useState('');
  const [ementaExtraida, setEmentaExtraida] = useState('');

  const fetchDocs = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('base_juridica')
      .select('id, titulo, tipo, tribunal, numero_processo, ementa, texto_integral, arquivo_nome, tags, created_at')
      .order('created_at', { ascending: false });

    if (!error && data) setDocs(data as DocJuridico[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const extractTextFromFile = async (f: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        resolve(text?.slice(0, 50000) || '');
      };
      reader.onerror = () => resolve('');
      reader.readAsText(f);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
        toast.info('Texto muito curto para extração automática. Preencha manualmente.');
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
          content: `Analise o documento jurídico abaixo e extraia as seguintes informações em JSON:\n{\n  "titulo": "título do documento",\n  "tipo": "decisao|acordao|doutrina|sumula|parecer|legislacao",\n  "tribunal": "tribunal ou órgão emissor",\n  "numero_processo": "número do processo se houver",\n  "ementa": "ementa ou resumo do documento (máx 500 palavras)",\n  "tags": ["palavras-chave relevantes para licitações e direito administrativo"]\n}\n\nDocumento:\n${truncated}`,
        }],
        action: 'extracao_juridica',
        onDelta: (chunk) => { fullText += chunk; },
        onDone: () => {},
        onError: (err) => { streamErr = err; },
      });
      if (streamErr) throw new Error(streamErr);

      // Parse JSON from AI response
      const jsonMatch = fullText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.titulo) setTitulo(parsed.titulo);
        if (parsed.tipo) setTipo(parsed.tipo);
        if (parsed.tribunal) setTribunal(parsed.tribunal);
        if (parsed.numero_processo) setNumeroProcesso(parsed.numero_processo);
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
            : 'A IA não conseguiu identificar os dados estruturados. Preencha o título, tipo e ementa manualmente nos campos abaixo.',
          duration: 8000,
        }
      );
    }
    setExtracting(false);
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Nenhum arquivo selecionado', {
        description: 'Selecione um arquivo (PDF, DOCX ou TXT) para adicionar à base jurídica.',
        duration: 5000,
      });
      return;
    }
    if (!titulo) {
      toast.error('Título obrigatório', {
        description: 'Informe um título para identificar este documento na base jurídica.',
        duration: 5000,
      });
      return;
    }
    setUploading(true);

    try {
      // Upload file
      const filePath = `${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('juridico')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get text if not extracted yet
      let textoFinal = textoExtraido;
      if (!textoFinal) {
        textoFinal = await extractTextFromFile(file);
        textoFinal = textoFinal.slice(0, 50000);
      }

      const tagsArray = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];

      const { error: dbError } = await supabase.from('base_juridica').insert({
        user_id: user.id,
        titulo,
        tipo,
        tribunal: tribunal || null,
        numero_processo: numeroProcesso || null,
        ementa: ementaExtraida || null,
        texto_integral: textoFinal || null,
        arquivo_path: filePath,
        arquivo_nome: file.name,
        tags: tagsArray,
      });

      if (dbError) throw dbError;

      toast.success('Documento jurídico adicionado à base da IA!');
      resetForm();
      fetchDocs();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar documento');
    }
    setUploading(false);
  };

  const resetForm = () => {
    setTitulo('');
    setTipo('decisao');
    setTribunal('');
    setNumeroProcesso('');
    setTags('');
    setFile(null);
    setTextoExtraido('');
    setEmentaExtraida('');
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('base_juridica').delete().eq('id', id);
    if (!error) {
      setDocs(prev => prev.filter(d => d.id !== id));
      toast.success('Documento removido da base');
    }
  };

  const filtered = docs.filter(d => {
    const matchSearch = !search ||
      d.titulo.toLowerCase().includes(search.toLowerCase()) ||
      d.ementa?.toLowerCase().includes(search.toLowerCase()) ||
      d.tribunal?.toLowerCase().includes(search.toLowerCase());
    const matchTipo = !filtroTipo || d.tipo === filtroTipo;
    return matchSearch && matchTipo;
  });

  const tipoLabel = (t: string) => TIPOS_DOCUMENTO.find(td => td.value === t)?.label || t;
  const TipoIcon = (t: string) => TIPOS_DOCUMENTO.find(td => td.value === t)?.icon || FileText;

  return (
    <div className="space-y-6">
      {/* Upload Form */}
      <section className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Upload className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
          <h3 className="text-lg font-semibold">Alimentar Base Jurídica da IA</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Faça upload de decisões, acórdãos, doutrinas, súmulas e pareceres para enriquecer as respostas da IA.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="bj-arquivo">Arquivo (PDF/TXT/DOC)</Label>
            <Input
              id="bj-arquivo"
              type="file"
              accept=".pdf,.txt,.doc,.docx,.rtf"
              onChange={handleFileChange}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bj-tipo">Tipo de Documento</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger id="bj-tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_DOCUMENTO.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {file && (
          <Button
            variant="outline"
            onClick={extractWithAI}
            disabled={extracting}
          >
            {extracting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
            {extracting ? 'Extraindo com IA...' : 'Extrair dados com IA'}
          </Button>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="bj-titulo">Título</Label>
            <Input id="bj-titulo" value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: RE 1.287.322 - STF" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bj-tribunal">Tribunal / Órgão</Label>
            <Input id="bj-tribunal" value={tribunal} onChange={e => setTribunal(e.target.value)} placeholder="Ex: STF, STJ, TCU, TRF-1" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="bj-processo">Nº do Processo</Label>
            <Input id="bj-processo" value={numeroProcesso} onChange={e => setNumeroProcesso(e.target.value)} placeholder="0001234-56.2024.8.14.0301" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bj-tags">Tags (separadas por vírgula)</Label>
            <Input id="bj-tags" value={tags} onChange={e => setTags(e.target.value)} placeholder="licitação, pregão, habilitação" />
          </div>
        </div>

        {ementaExtraida && (
          <div className="space-y-2">
            <Label htmlFor="bj-ementa">Ementa extraída pela IA</Label>
            <Textarea
              id="bj-ementa"
              value={ementaExtraida}
              onChange={e => setEmentaExtraida(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
        )}

        <Button onClick={handleUpload} disabled={uploading || !file || !titulo}>
          {uploading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}
          Adicionar à Base Jurídica
        </Button>
      </section>

      {/* Documents List */}
      <section className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
          <h3 className="text-lg font-semibold">Documentos na Base ({docs.length})</h3>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Label htmlFor="bj-busca" className="sr-only">Buscar por título, ementa ou tribunal</Label>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="bj-busca"
              placeholder="Buscar por título, ementa ou tribunal..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="w-full sm:w-56">
            <Label htmlFor="bj-filtro-tipo" className="sr-only">Filtrar por tipo</Label>
            <Select
              value={filtroTipo || TODOS_TIPOS}
              onValueChange={v => setFiltroTipo(v === TODOS_TIPOS ? '' : v)}
            >
              <SelectTrigger id="bj-filtro-tipo">
                <SelectValue placeholder="Todos os tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS_TIPOS}>Todos os tipos</SelectItem>
                {TIPOS_DOCUMENTO.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3" role="status" aria-label="Carregando documentos">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-md" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center text-center py-8 gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-tint text-primary">
              <BookOpen className="w-6 h-6" aria-hidden="true" />
            </span>
            <p className="text-base font-semibold">Nenhum documento na base jurídica</p>
            <p className="text-sm text-muted-foreground max-w-md">
              Faça upload de decisões, acórdãos e doutrinas para enriquecer a IA.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {filtered.map(doc => {
              const Icon = TipoIcon(doc.tipo);
              return (
                <li key={doc.id} className="flex items-start gap-3 rounded-md border border-border bg-background p-3 hover:bg-muted/50 transition-colors">
                  <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{doc.titulo}</p>
                    <div className="flex flex-wrap items-center gap-1 mt-1">
                      <Badge variant="info">{tipoLabel(doc.tipo)}</Badge>
                      {doc.tribunal && <Badge variant="muted">{doc.tribunal}</Badge>}
                      {doc.numero_processo && <span className="text-xs text-muted-foreground tabular-nums">{doc.numero_processo}</span>}
                    </div>
                    {doc.ementa && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{doc.ementa}</p>
                    )}
                    {doc.tags && doc.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-1">
                        {doc.tags.map((tag, i) => (
                          <span key={i} className="inline-flex items-center gap-1 text-xs text-muted-foreground">
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
                    className="text-destructive hover:text-destructive hover:bg-destructive-tint"
                    aria-label={`Remover ${doc.titulo} da base`}
                    title="Remover da base"
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
