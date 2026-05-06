import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ListTree, Sparkles, CheckCircle, AlertTriangle, FileSearch } from 'lucide-react';
import { streamAIChat } from '@/lib/ai-stream';
import { toast } from 'sonner';

export interface EstruturaPreview {
  resumo: string;
  partes: string[];
  fundamentos: string[];
  pedidos: string[];
  riscos?: string[];
  paginasEstimadas?: number;
}

interface Props {
  /** Title of the model being generated (e.g. "Recurso Administrativo") */
  modeloTitulo: string;
  /** Legal basis */
  fundamentacao: string;
  /** Full assembled context (same that will go to final generation) */
  contextoCompleto: string;
  /** True while we are generating the FINAL document — disables preview controls */
  gerandoFinal: boolean;
  /** Callback fired when the user confirms generation. */
  onConfirmar: () => void;
  /** Optional disabled flag (e.g. missing context) */
  disabledConfirmar?: boolean;
}

/**
 * Light-weight structural preview shown before the final generation.
 * Calls the AI gateway with a small, structured prompt asking for an outline
 * (sections, foundations, pleadings, risks). The user can review and then
 * confirm the heavy generation.
 */
export default function PreviewEstruturaDocumento({
  modeloTitulo, fundamentacao, contextoCompleto,
  gerandoFinal, onConfirmar, disabledConfirmar,
}: Props) {
  const [preview, setPreview] = useState<EstruturaPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const gerarPreview = async () => {
    if (!contextoCompleto.trim()) {
      toast.error('Preencha o contexto antes de pré-visualizar');
      return;
    }
    setLoading(true);
    setErro(null);
    setPreview(null);
    let acc = '';
    const prompt = `Você está pré-analisando a estrutura de um documento jurídico antes da redação final.

DOCUMENTO: ${modeloTitulo}
FUNDAMENTAÇÃO: ${fundamentacao}

CONTEXTO COMPLETO:
${contextoCompleto.slice(0, 8000)}

Retorne APENAS um JSON válido (sem markdown, sem cercas) com a seguinte estrutura:
{
  "resumo": "resumo executivo em até 80 palavras do que será produzido",
  "partes": ["I - Endereçamento", "II - Qualificação", "..."],
  "fundamentos": ["Art. X da Lei 14.133/2021 — finalidade", "Acórdão TCU nº ... — tese"],
  "pedidos": ["Pedido principal: ...", "Pedido subsidiário: ..."],
  "riscos": ["pontos frágeis ou que exigem prova adicional"],
  "paginasEstimadas": 5
}

REGRAS:
- "partes" deve refletir a estrutura formal completa do documento.
- "fundamentos" deve trazer 3 a 8 itens com base legal e/ou jurisprudencial pertinente.
- "pedidos" deve listar pedidos concretos.
- "riscos" deve apontar fragilidades, lacunas ou exigências de prova.
- Não invente dados — se faltar informação, indique em "riscos".`;

    await streamAIChat({
      messages: [{ role: 'user', content: prompt }],
      action: 'preview_estrutura_juridica',
      onDelta: (c) => { acc += c; },
      onDone: () => {
        try {
          const m = acc.match(/\{[\s\S]*\}/);
          if (!m) throw new Error('Resposta sem JSON');
          const parsed = JSON.parse(m[0]) as EstruturaPreview;
          setPreview(parsed);
        } catch (e: any) {
          setErro(e?.message || 'Falha ao interpretar a estrutura');
        }
        setLoading(false);
      },
      onError: (err) => { setErro(err); setLoading(false); },
    });
  };

  return (
    <div className="bg-card border border-border/50 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <FileSearch className="w-4 h-4 text-accent shrink-0" />
          <h4 className="text-sm font-semibold whitespace-nowrap">Pré-visualização da estrutura</h4>
          {preview && (
            <Badge className="text-[10px] gap-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/30 shrink-0">
              <CheckCircle className="w-2.5 h-2.5" /> Estrutura pronta
            </Badge>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            size="sm" variant="outline" className="h-8 text-xs"
            onClick={gerarPreview} disabled={loading || gerandoFinal}
          >
            {loading
              ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Analisando…</>
              : <><ListTree className="w-3 h-3 mr-1" /> {preview ? 'Recalcular' : 'Pré-visualizar'}</>}
          </Button>
          <Button
            size="sm" className="h-8 text-xs bg-accent hover:bg-accent/90 text-accent-foreground"
            onClick={onConfirmar} disabled={gerandoFinal || disabledConfirmar}
          >
            {gerandoFinal
              ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Gerando…</>
              : <><Sparkles className="w-3 h-3 mr-1" /> Confirmar geração</>}
          </Button>
        </div>
      </div>

      {erro && (
        <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded p-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {erro}
        </div>
      )}

      {!preview && !loading && !erro && (
        <p className="text-[11px] text-muted-foreground">
          Clique em <strong>Pré-visualizar</strong> para gerar um resumo e o esqueleto do documento (seções,
          fundamentos, pedidos e riscos) antes de produzir a redação completa. Isso evita gerações desperdiçadas.
        </p>
      )}

      {preview && (
        <div className="space-y-3 text-xs">
          <div>
            <p className="font-semibold text-foreground mb-1">Resumo executivo</p>
            <p className="text-muted-foreground leading-relaxed">{preview.resumo}</p>
            {preview.paginasEstimadas != null && (
              <Badge variant="outline" className="text-[10px] mt-1.5">
                Estimativa: {preview.paginasEstimadas} {preview.paginasEstimadas === 1 ? 'página' : 'páginas'}
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Bloco titulo="Estrutura (partes)" itens={preview.partes} accent />
            <Bloco titulo="Pedidos" itens={preview.pedidos} accent />
            <Bloco titulo="Fundamentos" itens={preview.fundamentos} />
            {preview.riscos && preview.riscos.length > 0 && (
              <Bloco titulo="Riscos / pontos a reforçar" itens={preview.riscos} warn />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Bloco({ titulo, itens, accent, warn }: { titulo: string; itens: string[]; accent?: boolean; warn?: boolean }) {
  return (
    <div className={`rounded p-2 border ${warn ? 'border-amber-500/30 bg-amber-500/5' : accent ? 'border-accent/20 bg-accent/5' : 'border-border/50 bg-muted/20'}`}>
      <p className={`font-semibold mb-1 ${warn ? 'text-amber-700 dark:text-amber-500' : ''}`}>{titulo}</p>
      <ul className="space-y-0.5 list-disc pl-4">
        {itens.map((t, i) => <li key={i} className="text-muted-foreground">{t}</li>)}
      </ul>
    </div>
  );
}
