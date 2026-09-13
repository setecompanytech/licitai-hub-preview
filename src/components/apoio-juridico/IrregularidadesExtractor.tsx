import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Loader2, Sparkles, Upload, FileText, X, Plus, Trash2,
  AlertTriangle, CheckCircle, ChevronRight, ChevronLeft, Scale
} from 'lucide-react';
import { toast } from 'sonner';
import { streamAIChat } from '@/lib/ai-stream';

export interface Irregularidade {
  id: string;
  descricao: string;
  fundamentacao: string;
  gravidade: 'alta' | 'media' | 'baixa';
  artigos: string[];
  selecionada: boolean;
  origem: 'ia' | 'manual';
}

interface IrregularidadesExtractorProps {
  onFinish: (irregularidades: Irregularidade[], editalTexto: string, editalNum: string) => void;
  editalNum: string;
  setEditalNum: (v: string) => void;
}

const GRAVIDADE_VARIANTE: Record<Irregularidade['gravidade'], 'danger' | 'warning' | 'info'> = {
  alta: 'danger',
  media: 'warning',
  baixa: 'info',
};

const GRAVIDADE_LABELS: Record<string, string> = {
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
};

export default function IrregularidadesExtractor({ onFinish, editalNum, setEditalNum }: IrregularidadesExtractorProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [editalText, setEditalText] = useState('');
  const [editalFile, setEditalFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [progress, setProgress] = useState('');
  const [irregularidades, setIrregularidades] = useState<Irregularidade[]>([]);

  // Manual add form
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualDesc, setManualDesc] = useState('');
  const [manualFund, setManualFund] = useState('');
  const [manualGrav, setManualGrav] = useState<'alta' | 'media' | 'baixa'>('media');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowed.includes(file.type) && !file.name.endsWith('.txt')) {
      toast.error('Use PDF, DOC, DOCX ou TXT.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Máximo 10MB.');
      return;
    }
    setEditalFile(file);
    const text = await file.text();
    setEditalText(text);
  };

  const handleExtract = async () => {
    if (!editalText.trim()) {
      toast.error('Cole o texto do edital ou envie um arquivo.');
      return;
    }
    setExtracting(true);
    setProgress('Analisando edital com IA...');
    setIrregularidades([]);

    const truncated = editalText.slice(0, 25000);
    let content = '';

    await streamAIChat({
      messages: [{
        role: 'user',
        content: `Você é um advogado especialista em licitações e contratos administrativos, com profundo conhecimento da Lei 14.133/2021 (Nova Lei de Licitações).

Analise minuciosamente o texto do edital abaixo e identifique TODAS as irregularidades, falhas, vícios, ilegalidades, cláusulas restritivas à competitividade, exigências desproporcionais ou qualquer aspecto que possa ser contestado juridicamente.

Para cada irregularidade encontrada, retorne um JSON array no seguinte formato (SEM markdown, SEM explicações, APENAS o JSON):

[
  {
    "descricao": "Descrição detalhada da irregularidade encontrada, explicando o que está errado e por quê",
    "fundamentacao": "Fundamentação jurídica completa citando artigos da Lei 14.133/2021, jurisprudência do TCU, doutrina aplicável",
    "gravidade": "alta|media|baixa",
    "artigos": ["Art. 5º", "Art. 11, parágrafo único"]
  }
]

CATEGORIAS DE ANÁLISE:
1. Cláusulas restritivas à competitividade (Art. 9º, Art. 14)
2. Exigências de habilitação desproporcionais (Art. 62 a 70)
3. Critérios de julgamento inadequados (Art. 33 a 39)
4. Vícios na descrição do objeto (Art. 6º, XVIII; Art. 40)
5. Prazos insuficientes ou inadequados (Art. 55)
6. Exigências de qualificação técnica excessivas (Art. 67)
7. Exigências de qualificação econômico-financeira abusivas (Art. 69)
8. Ausência de informações obrigatórias (Art. 25)
9. Irregularidades no termo de referência (Art. 6º, XXIII)
10. Direcionamento ou favorecimento (Art. 9º, §1º)
11. Vícios no tratamento diferenciado de ME/EPP (LC 123/2006)
12. Cláusulas contratuais abusivas (Art. 89 a 94)

REGRAS:
- Seja rigoroso e minucioso na análise
- Identifique irregularidades reais e fundamentadas
- Classifique a gravidade: "alta" = ilegalidade clara, "media" = vício relevante, "baixa" = irregularidade menor
- Se não encontrar irregularidades, retorne []
- Retorne APENAS o JSON array válido

TEXTO DO EDITAL:
${truncated}`
      }],
      action: 'analise_edital',
      onDelta: (chunk) => {
        content += chunk;
        setProgress('Identificando irregularidades...');
      },
      onDone: () => {
        try {
          const jsonMatch = content.match(/\[[\s\S]*\]/);
          if (!jsonMatch) {
            toast.warning('Não foram encontradas irregularidades no edital.');
            setIrregularidades([]);
            setStep(2);
            setExtracting(false);
            setProgress('');
            return;
          }
          const parsed = JSON.parse(jsonMatch[0]) as Array<{
            descricao: string;
            fundamentacao: string;
            gravidade: string;
            artigos: string[];
          }>;

          const items: Irregularidade[] = parsed.map((p, idx) => ({
            id: `ia-${idx}`,
            descricao: p.descricao,
            fundamentacao: p.fundamentacao,
            gravidade: (['alta', 'media', 'baixa'].includes(p.gravidade) ? p.gravidade : 'media') as 'alta' | 'media' | 'baixa',
            artigos: p.artigos || [],
            selecionada: true,
            origem: 'ia' as const,
          }));

          setIrregularidades(items);
          setStep(2);
          toast.success(`${items.length} irregularidade(s) identificada(s)!`);
        } catch {
          toast.error('Erro ao processar análise do edital.');
        }
        setExtracting(false);
        setProgress('');
      },
      onError: (err) => {
        toast.error(err);
        setExtracting(false);
        setProgress('');
      },
    });
  };

  const toggleIrregularidade = (id: string) => {
    setIrregularidades(prev =>
      prev.map(i => i.id === id ? { ...i, selecionada: !i.selecionada } : i)
    );
  };

  const removeIrregularidade = (id: string) => {
    setIrregularidades(prev => prev.filter(i => i.id !== id));
  };

  const addManual = () => {
    if (!manualDesc.trim()) {
      toast.error('Descreva a irregularidade.');
      return;
    }
    const newItem: Irregularidade = {
      id: `manual-${Date.now()}`,
      descricao: manualDesc,
      fundamentacao: manualFund || 'Fundamentação a ser complementada',
      gravidade: manualGrav,
      artigos: [],
      selecionada: true,
      origem: 'manual',
    };
    setIrregularidades(prev => [...prev, newItem]);
    setManualDesc('');
    setManualFund('');
    setManualGrav('media');
    setShowManualForm(false);
    toast.success('Irregularidade manual adicionada!');
  };

  const selectedCount = irregularidades.filter(i => i.selecionada).length;

  const handleFinish = () => {
    const selected = irregularidades.filter(i => i.selecionada);
    if (selected.length === 0) {
      toast.error('Selecione ao menos uma irregularidade.');
      return;
    }
    onFinish(selected, editalText, editalNum);
  };

  // STEP 1: Upload/paste edital
  if (step === 1) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary-tint text-primary text-xs font-bold" aria-hidden="true">1</span>
          <h4 className="text-base font-semibold">Etapa 1 — Envio do Edital para Análise</h4>
        </div>

        <p className="text-sm text-muted-foreground">
          Envie o arquivo do edital ou cole o texto abaixo. A IA identificará automaticamente todas as irregularidades, falhas e vícios com fundamentação na Lei 14.133/2021.
        </p>

        <div className="space-y-2">
          <Label htmlFor="irr-edital-num">Nº do Edital</Label>
          <Input
            id="irr-edital-num"
            value={editalNum}
            onChange={e => setEditalNum(e.target.value)}
            placeholder="PE-001/2026"
          />
        </div>

        {/* File upload */}
        <div className="space-y-2">
          {editalFile ? (
            <div className="flex items-center gap-3 rounded-md border border-border bg-muted/50 p-3">
              <FileText className="w-5 h-5 text-muted-foreground shrink-0" aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{editalFile.name}</p>
                <p className="text-xs text-muted-foreground tabular-nums">{(editalFile.size / 1024).toFixed(0)} KB</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => { setEditalFile(null); setEditalText(''); }}
                aria-label="Remover arquivo do edital"
              >
                <X aria-hidden="true" />
              </Button>
            </div>
          ) : (
            <label className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border p-6 cursor-pointer hover:border-primary/40 hover:bg-primary-tint transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
              <Upload className="w-6 h-6 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm font-medium">Enviar arquivo do edital</span>
              <div className="flex gap-1">
                <Badge variant="muted">PDF</Badge>
                <Badge variant="muted">DOC</Badge>
                <Badge variant="muted">TXT</Badge>
              </div>
              <input type="file" accept=".pdf,.doc,.docx,.txt" className="sr-only" onChange={handleFileUpload} />
            </label>
          )}
        </div>

        <div className="relative">
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-center">
            <span className="bg-card px-2 text-xs text-muted-foreground">ou cole o texto</span>
          </div>
          <div className="border-t border-border my-3" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="irr-edital-texto" className="sr-only">Texto do edital</Label>
          <Textarea
            id="irr-edital-texto"
            value={editalText}
            onChange={e => setEditalText(e.target.value)}
            placeholder="Cole aqui o texto completo do edital para análise automática de irregularidades..."
            className="min-h-[200px]"
          />
        </div>

        <Button
          onClick={handleExtract}
          disabled={extracting || !editalText.trim()}
          className="w-full"
        >
          {extracting ? (
            <><Loader2 className="animate-spin" aria-hidden="true" /> {progress || 'Analisando...'}</>
          ) : (
            <><Sparkles aria-hidden="true" /> Analisar Irregularidades com IA</>
          )}
        </Button>
      </div>
    );
  }

  // STEP 2: Review + manual add
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary-tint text-primary text-xs font-bold" aria-hidden="true">2</span>
          <h4 className="text-base font-semibold">Etapa 2 — Revisão e Complemento</h4>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
          <ChevronLeft aria-hidden="true" /> Voltar
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Revise as irregularidades encontradas pela IA. Desmarque as que não deseja incluir e adicione novas irregularidades manualmente.
      </p>

      {/* Stats */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="info" className="tabular-nums">
          {irregularidades.length} encontrada(s)
        </Badge>
        <Badge variant="success" className="tabular-nums">
          {selectedCount} selecionada(s)
        </Badge>
        <Badge variant="muted" className="tabular-nums">
          {irregularidades.filter(i => i.origem === 'manual').length} manual(is)
        </Badge>
      </div>

      {/* Irregularidades list */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {irregularidades.map((item) => (
          <div
            key={item.id}
            className={`rounded-md border p-3 space-y-2 transition-colors ${
              item.selecionada ? 'bg-card border-border' : 'bg-muted/50 border-border opacity-60'
            }`}
          >
            <div className="flex items-start gap-3">
              <Checkbox
                checked={item.selecionada}
                onCheckedChange={() => toggleIrregularidade(item.id)}
                className="mt-0.5"
                aria-label={`Incluir irregularidade: ${item.descricao.slice(0, 60)}`}
              />
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={GRAVIDADE_VARIANTE[item.gravidade]} className="gap-1">
                    <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                    {GRAVIDADE_LABELS[item.gravidade]}
                  </Badge>
                  <Badge variant="muted">
                    {item.origem === 'ia' ? 'IA' : 'Manual'}
                  </Badge>
                  {item.artigos.map((art, i) => (
                    <Badge key={i} variant="info" className="gap-1">
                      <Scale className="w-3 h-3" aria-hidden="true" /> {art}
                    </Badge>
                  ))}
                </div>
                <p className="text-sm text-foreground">{item.descricao}</p>
                <p className="text-sm text-muted-foreground italic">
                  {item.fundamentacao}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive-tint"
                onClick={() => removeIrregularidade(item.id)}
                aria-label="Remover irregularidade"
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
          </div>
        ))}

        {irregularidades.length === 0 && (
          <div className="flex flex-col items-center text-center py-8 gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-tint text-primary">
              <AlertTriangle className="w-6 h-6" aria-hidden="true" />
            </span>
            <p className="text-base font-semibold">Nenhuma irregularidade encontrada</p>
            <p className="text-sm text-muted-foreground">Adicione manualmente abaixo.</p>
          </div>
        )}
      </div>

      {/* Manual add */}
      {showManualForm ? (
        <div className="rounded-md border border-border bg-muted/50 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h5 className="text-base font-semibold flex items-center gap-1">
              <Plus className="w-4 h-4" aria-hidden="true" /> Adicionar Irregularidade Manual
            </h5>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setShowManualForm(false)} aria-label="Fechar formulário manual">
              <X aria-hidden="true" />
            </Button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="irr-manual-desc">Descrição da irregularidade *</Label>
            <Textarea
              id="irr-manual-desc"
              value={manualDesc}
              onChange={e => setManualDesc(e.target.value)}
              placeholder="Descreva a irregularidade, falha ou vício identificado no edital..."
              className="min-h-[80px]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="irr-manual-fund">Fundamentação jurídica</Label>
            <Textarea
              id="irr-manual-fund"
              value={manualFund}
              onChange={e => setManualFund(e.target.value)}
              placeholder="Cite artigos da Lei 14.133/2021, jurisprudência TCU, doutrina..."
              className="min-h-[60px]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="irr-manual-grav">Gravidade</Label>
            <Select value={manualGrav} onValueChange={v => setManualGrav(v as 'alta' | 'media' | 'baixa')}>
              <SelectTrigger id="irr-manual-grav">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alta">Alta — Ilegalidade clara</SelectItem>
                <SelectItem value="media">Média — Vício relevante</SelectItem>
                <SelectItem value="baixa">Baixa — Irregularidade menor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={addManual}>
            <Plus aria-hidden="true" /> Adicionar
          </Button>
        </div>
      ) : (
        <Button variant="outline" onClick={() => setShowManualForm(true)} className="w-full border-dashed">
          <Plus aria-hidden="true" /> Adicionar irregularidade manual
        </Button>
      )}

      {/* Proceed */}
      <Button
        onClick={handleFinish}
        disabled={selectedCount === 0}
        className="w-full"
      >
        <CheckCircle aria-hidden="true" />
        Gerar Documento com {selectedCount} Irregularidade(s)
        <ChevronRight aria-hidden="true" />
      </Button>
    </div>
  );
}
