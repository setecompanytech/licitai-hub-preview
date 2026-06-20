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
      
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `Analise o documento jurídico abaixo e extraia as seguintes informações em JSON:
{
  "titulo": "título do documento",
  "tipo": "decisao|acordao|doutrina|sumula|parecer|legislacao",
  "tribunal": "tribunal ou órgão emissor",
  "numero_processo": "número do processo se houver",
  "ementa": "ementa ou resumo do documento (máx 500 palavras)",
  "tags": ["palavras-chave relevantes para licitações e direito administrativo"]
}

Documento:
${truncated}`
          }],
          action: 'extracao_juridica',
        }),
      });

      if (!resp.ok) throw new Error('Erro na extração');

      let fullText = '';
      if (resp.body) {
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx;
          while ((idx = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 1);
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') break;
            try {
              const p = JSON.parse(jsonStr);
              const c = p.choices?.[0]?.delta?.content;
              if (c) fullText += c;
            } catch { /* partial */ }
          }
        }
      }

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
      }
    } catch (err) {
      console.error(err);
      toast.error('Falha na extração automática do documento', {
        description: 'A IA não conseguiu identificar os dados estruturados. Preencha o título, tipo e ementa manualmente nos campos abaixo.',
        duration: 8000,
      });
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
      <div className="bg-card rounded-xl border border-border/50 p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Upload className="w-5 h-5 text-accent" />
          <h3 className="text-sm font-semibold">Alimentar Base Jurídica da IA</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Faça upload de decisões, acórdãos, doutrinas, súmulas e pareceres para enriquecer as respostas da IA.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground">Arquivo (PDF/TXT/DOC)</label>
            <Input
              type="file"
              accept=".pdf,.txt,.doc,.docx,.rtf"
              onChange={handleFileChange}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Tipo de Documento</label>
            <select
              value={tipo}
              onChange={e => setTipo(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {TIPOS_DOCUMENTO.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

        {file && (
          <Button
            variant="outline"
            size="sm"
            onClick={extractWithAI}
            disabled={extracting}
          >
            {extracting ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
            {extracting ? 'Extraindo com IA...' : 'Extrair dados com IA'}
          </Button>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground">Título</label>
            <Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: RE 1.287.322 - STF" className="mt-1" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Tribunal / Órgão</label>
            <Input value={tribunal} onChange={e => setTribunal(e.target.value)} placeholder="Ex: STF, STJ, TCU, TRF-1" className="mt-1" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground">Nº do Processo</label>
            <Input value={numeroProcesso} onChange={e => setNumeroProcesso(e.target.value)} placeholder="0001234-56.2024.8.14.0301" className="mt-1" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Tags (separadas por vírgula)</label>
            <Input value={tags} onChange={e => setTags(e.target.value)} placeholder="licitação, pregão, habilitação" className="mt-1" />
          </div>
        </div>

        {ementaExtraida && (
          <div>
            <label className="text-xs text-muted-foreground">Ementa extraída pela IA</label>
            <Textarea
              value={ementaExtraida}
              onChange={e => setEmentaExtraida(e.target.value)}
              className="mt-1 min-h-[80px] text-xs"
            />
          </div>
        )}

        <Button onClick={handleUpload} disabled={uploading || !file || !titulo} className="bg-accent hover:bg-accent/90 text-accent-foreground">
          {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
          Adicionar à Base Jurídica
        </Button>
      </div>

      {/* Documents List */}
      <div className="bg-card rounded-xl border border-border/50 p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-accent" />
            <h3 className="text-sm font-semibold">Documentos na Base ({docs.length})</h3>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por título, ementa ou tribunal..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={filtroTipo}
            onChange={e => setFiltroTipo(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Todos os tipos</option>
            {TIPOS_DOCUMENTO.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhum documento na base jurídica</p>
            <p className="text-xs mt-1">Faça upload de decisões, acórdãos e doutrinas para enriquecer a IA</p>
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
                      {doc.tribunal && <Badge variant="secondary" className="text-[10px]">{doc.tribunal}</Badge>}
                      {doc.numero_processo && <span className="text-[10px] text-muted-foreground">{doc.numero_processo}</span>}
                    </div>
                    {doc.ementa && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{doc.ementa}</p>
                    )}
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
