import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Sparkles, Loader2, BookOpen, Copy, TrendingUp, Users } from 'lucide-react';
import { streamAIChat } from '@/lib/ai-stream';
import ReactMarkdown from 'react-markdown';

type DocRef = { id: string; titulo: string; tipo: string; ementa: string | null; texto_integral: string | null };
type Indice = { id: string; nome: string; sigla: string; valor: number; variacao_mensal: number | null; acumulado_12m: number | null; periodo: string; fonte: string };
type CCT = { id: string; categoria_profissional: string; piso_salarial: number | null; reajuste_percentual: number | null; indice_reajuste: string | null; vigencia_inicio: string | null; vigencia_fim: string | null; sindicato_laboral: string | null; abrangencia_uf: string | null };

const TIPOS_REEQUILIBRIO = ['Reequilíbrio Econômico-Financeiro'];
const fmtPerc = (v: number | null) => v != null ? `${v >= 0 ? '+' : ''}${v.toFixed(2)}%` : '—';

export default function GeradorIAComBase() {
  const { user } = useAuth();
  const [tipoDoc, setTipoDoc] = useState('Impugnação ao Edital');
  const [editalNum, setEditalNum] = useState('');
  const [contexto, setContexto] = useState('');
  const [resultado, setResultado] = useState('');
  const [gerando, setGerando] = useState(false);
  const [docsBase, setDocsBase] = useState<DocRef[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);

  // Indices & CCTs for reequilíbrio
  const [indices, setIndices] = useState<Indice[]>([]);
  const [ccts, setCcts] = useState<CCT[]>([]);
  const [loadingIndices, setLoadingIndices] = useState(false);
  const isReequilibrio = TIPOS_REEQUILIBRIO.includes(tipoDoc);

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

  // Auto-load indices & CCTs when reequilíbrio is selected
  useEffect(() => {
    if (isReequilibrio && indices.length === 0) {
      setLoadingIndices(true);
      Promise.all([
        supabase.from('indices_economicos').select('id, nome, sigla, valor, variacao_mensal, acumulado_12m, periodo, fonte').order('sigla'),
        supabase.from('convencoes_coletivas').select('id, categoria_profissional, piso_salarial, reajuste_percentual, indice_reajuste, vigencia_inicio, vigencia_fim, sindicato_laboral, abrangencia_uf').eq('status', 'vigente'),
      ]).then(([indRes, cctRes]) => {
        setIndices((indRes.data as Indice[]) || []);
        setCcts((cctRes.data as CCT[]) || []);
        setLoadingIndices(false);
      });
    }
  }, [isReequilibrio]);

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

    // Build indices/CCT context for reequilíbrio
    let indicesContext = '';
    if (isReequilibrio && (indices.length > 0 || ccts.length > 0)) {
      indicesContext = '\n\n--- DADOS ECONÔMICOS ATUALIZADOS (FONTE OFICIAL) ---\n';
      if (indices.length > 0) {
        indicesContext += '\nÍNDICES ECONÔMICOS:\n';
        for (const i of indices) {
          indicesContext += `- ${i.sigla} (${i.nome}): Valor ${i.valor}, Variação mensal ${fmtPerc(i.variacao_mensal)}, Acumulado 12m ${fmtPerc(i.acumulado_12m)}, Período: ${i.periodo}, Fonte: ${i.fonte}\n`;
        }
      }
      if (ccts.length > 0) {
        indicesContext += '\nCONVENÇÕES COLETIVAS VIGENTES:\n';
        for (const c of ccts) {
          indicesContext += `- ${c.categoria_profissional}: Piso ${c.piso_salarial ? `R$ ${c.piso_salarial}` : 'N/I'}, Reajuste ${c.reajuste_percentual ? `${c.reajuste_percentual}%` : 'N/I'}, Índice ${c.indice_reajuste || 'N/I'}, Vigência ${c.vigencia_inicio || '?'} a ${c.vigencia_fim || '?'}, UF: ${c.abrangencia_uf || 'N/I'}\n`;
        }
      }
      indicesContext += '\nINSTRUÇÃO: Utilize estes dados numéricos oficiais para fundamentar o documento. Cite as fontes e períodos. Linguagem técnica, objetiva, impessoal e auditável.\n';
    }

    const prompt = `Tipo: ${tipoDoc}\nEdital: ${editalNum}\nContexto: ${contexto}${baseContext}${indicesContext}`;

    await streamAIChat({
      messages: [{ role: 'user', content: prompt }],
      action: 'gerador_juridico',
      context: baseContext + indicesContext,
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
            <label className="text-xs text-muted-foreground">Nº do Edital / Contrato</label>
            <Input value={editalNum} onChange={e => setEditalNum(e.target.value)} placeholder="PE-001/2026 ou CT-001/2026" className="mt-1" />
          </div>
        </div>

        {/* Auto-loaded indices/CCTs indicator */}
        {isReequilibrio && (
          <div className="bg-accent/10 border border-accent/20 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-accent" />
              <span className="text-xs font-semibold text-foreground">Dados econômicos sincronizados automaticamente</span>
            </div>
            {loadingIndices ? (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Carregando índices e CCTs...
              </p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {indices.slice(0, 6).map(i => (
                  <Badge key={i.id} variant="outline" className="text-[10px]">
                    📊 {i.sigla}: {fmtPerc(i.acumulado_12m)} (12m)
                  </Badge>
                ))}
                {indices.length > 6 && <Badge variant="outline" className="text-[10px]">+{indices.length - 6} índices</Badge>}
                {ccts.map(c => (
                  <Badge key={c.id} variant="outline" className="text-[10px]">
                    👷 {c.categoria_profissional}: {c.reajuste_percentual ? `+${c.reajuste_percentual}%` : 'N/I'}
                  </Badge>
                ))}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground">
              Estes dados serão injetados automaticamente como contexto para a IA gerar o documento com fundamentação numérica.
            </p>
          </div>
        )}

        <div>
          <label className="text-xs text-muted-foreground">Fundamentação / Contexto</label>
          <Textarea
            value={contexto}
            onChange={e => setContexto(e.target.value)}
            placeholder={isReequilibrio
              ? "Descreva o contrato, itens afetados, valores originais e atuais, e impacto financeiro..."
              : "Descreva os fatos, a cláusula contestada e os fundamentos jurídicos..."
            }
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
