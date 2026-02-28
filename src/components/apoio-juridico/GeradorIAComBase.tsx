import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Sparkles, Loader2, BookOpen, Copy, Download } from 'lucide-react';
import { streamAIChat } from '@/lib/ai-stream';
import ReactMarkdown from 'react-markdown';

type DocRef = { id: string; titulo: string; tipo: string; ementa: string | null; texto_integral: string | null };

export default function GeradorIAComBase() {
  const { user } = useAuth();
  const [tipoDoc, setTipoDoc] = useState('Impugnação ao Edital');
  const [editalNum, setEditalNum] = useState('');
  const [contexto, setContexto] = useState('');
  const [resultado, setResultado] = useState('');
  const [gerando, setGerando] = useState(false);
  const [docsBase, setDocsBase] = useState<DocRef[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('base_juridica')
      .select('id, titulo, tipo, ementa, texto_integral')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) setDocsBase(data as DocRef[]);
      });
  }, [user]);

  const toggleDoc = (id: string) => {
    setSelectedDocs(prev =>
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  };

  const handleGerar = async () => {
    if (!contexto) {
      toast.error('Descreva o contexto e fundamentação');
      return;
    }
    setGerando(true);
    setResultado('');

    // Build context from selected documents
    let baseContext = '';
    if (selectedDocs.length > 0) {
      const selected = docsBase.filter(d => selectedDocs.includes(d.id));
      baseContext = '\n\n--- DOCUMENTOS DE REFERÊNCIA DA BASE JURÍDICA ---\n';
      for (const doc of selected) {
        baseContext += `\n### ${doc.titulo} (${doc.tipo})\n`;
        if (doc.ementa) baseContext += `Ementa: ${doc.ementa}\n`;
        if (doc.texto_integral) baseContext += `Texto: ${doc.texto_integral.slice(0, 5000)}\n`;
      }
    }

    const prompt = `Tipo: ${tipoDoc}\nEdital: ${editalNum}\nContexto: ${contexto}${baseContext}`;

    await streamAIChat({
      messages: [{ role: 'user', content: prompt }],
      action: 'gerador_juridico',
      context: baseContext,
      onDelta: (text) => setResultado(prev => prev + text),
      onDone: () => setGerando(false),
      onError: (err) => {
        toast.error(err);
        setGerando(false);
      },
    });
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(resultado);
    toast.success('Copiado!');
  };

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-border/50 p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-accent" />
          <h3 className="text-sm font-semibold">Gerador de Documentos com IA</h3>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground">Tipo de Documento</label>
            <select
              value={tipoDoc}
              onChange={e => setTipoDoc(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option>Impugnação ao Edital</option>
              <option>Recurso Administrativo</option>
              <option>Contrarrazões</option>
              <option>Pedido de Esclarecimento</option>
              <option>Pedido de Reconsideração</option>
              <option>Reequilíbrio Econômico-Financeiro</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Nº do Edital</label>
            <Input value={editalNum} onChange={e => setEditalNum(e.target.value)} placeholder="PE-001/2026" className="mt-1" />
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Fundamentação / Contexto</label>
          <Textarea
            value={contexto}
            onChange={e => setContexto(e.target.value)}
            placeholder="Descreva os fatos, a cláusula contestada e os fundamentos jurídicos..."
            className="mt-1 min-h-[120px]"
          />
        </div>

        {/* Document selection */}
        {docsBase.length > 0 && (
          <div>
            <label className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
              <BookOpen className="w-3 h-3" />
              Documentos da Base Jurídica como referência ({selectedDocs.length} selecionados)
            </label>
            <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto p-2 rounded-md bg-muted/30">
              {docsBase.map(doc => (
                <Badge
                  key={doc.id}
                  variant={selectedDocs.includes(doc.id) ? 'default' : 'outline'}
                  className="cursor-pointer text-[11px] transition-colors"
                  onClick={() => toggleDoc(doc.id)}
                >
                  {doc.titulo.slice(0, 40)}{doc.titulo.length > 40 ? '...' : ''}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <Button onClick={handleGerar} disabled={gerando} className="bg-accent hover:bg-accent/90 text-accent-foreground">
          {gerando ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
          Gerar Documento
        </Button>
      </div>

      {/* Result */}
      {resultado && (
        <div className="bg-card rounded-xl border border-border/50 p-6 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Documento Gerado</h3>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={copyToClipboard}>
                <Copy className="w-3 h-3 mr-1" /> Copiar
              </Button>
            </div>
          </div>
          <div className="prose prose-sm max-w-none dark:prose-invert text-sm">
            <ReactMarkdown>{resultado}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
