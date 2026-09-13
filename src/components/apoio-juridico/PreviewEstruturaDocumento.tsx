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
    <section className="rounded-lg border border-border bg-card p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <FileSearch className="w-5 h-5 text-muted-foreground shrink-0" aria-hidden="true" />
          <h4 className="text-lg font-semibold">Pré-visualização da estrutura</h4>
          {preview && (
            <Badge variant="success" className="gap-1 shrink-0">
              <CheckCircle className="w-3 h-3" aria-hidden="true" /> Estrutura pronta
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button
            variant="outline"
            onClick={gerarPreview} disabled={loading || gerandoFinal}
          >
            {loading
              ? <><Loader2 className="animate-spin" aria-hidden="true" /> Analisando…</>
              : <><ListTree aria-hidden="true" /> {preview ? 'Recalcular' : 'Pré-visualizar'}</>}
          </Button>
          <Button
            onClick={onConfirmar} disabled={gerandoFinal || disabledConfirmar}
          >
            {gerandoFinal
              ? <><Loader2 className="animate-spin" aria-hidden="true" /> Gerando…</>
              : <><Sparkles aria-hidden="true" /> Confirmar geração</>}
          </Button>
        </div>
      </div>

      {erro && (
        <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive-line bg-destructive-tint p-3 text-sm text-destructive-ink">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" /> {erro}
        </div>
      )}

      {!preview && !loading && !erro && (
        <p className="text-sm text-muted-foreground">
          Clique em <strong>Pré-visualizar</strong> para gerar um resumo e o esqueleto do documento (seções,
          fundamentos, pedidos e riscos) antes de produzir a redação completa. Isso evita gerações desperdiçadas.
        </p>
      )}

      {preview && (
        <div className="space-y-4 text-sm">
          <div>
            <p className="font-semibold text-foreground mb-1">Resumo executivo</p>
            <p className="text-muted-foreground">{preview.resumo}</p>
            {preview.paginasEstimadas != null && (
              <Badge variant="info" className="mt-2">
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
    </section>
  );
}

function Bloco({ titulo, itens, accent, warn }: { titulo: string; itens: string[]; accent?: boolean; warn?: boolean }) {
  return (
    <div className={`rounded-md border p-3 ${warn ? 'border-warning-line bg-warning-tint' : accent ? 'border-l-2 border-l-primary border-border bg-muted/50' : 'border-border bg-muted/50'}`}>
      <p className={`font-semibold mb-1 ${warn ? 'text-warning-ink' : ''}`}>{titulo}</p>
      <ul className="space-y-1 list-disc pl-4">
        {itens.map((t, i) => <li key={i} className={warn ? 'text-warning-ink' : 'text-muted-foreground'}>{t}</li>)}
      </ul>
    </div>
  );
}
