import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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

const GRAVIDADE_COLORS: Record<string, string> = {
  alta: 'bg-destructive/10 text-destructive border-destructive/30',
  media: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30',
  baixa: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30',
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
        <div className="flex items-center gap-2 mb-1">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-accent text-accent-foreground text-xs font-bold">1</div>
          <h4 className="text-sm font-semibold">Etapa 1 — Envio do Edital para Análise</h4>
        </div>

        <p className="text-xs text-muted-foreground">
          Envie o arquivo do edital ou cole o texto abaixo. A IA identificará automaticamente todas as irregularidades, falhas e vícios com fundamentação na Lei 14.133/2021.
        </p>

        <div>
          <label className="text-xs text-muted-foreground">Nº do Edital</label>
          <Input
            value={editalNum}
            onChange={e => setEditalNum(e.target.value)}
            placeholder="PE-001/2026"
            className="mt-1"
          />
        </div>

        {/* File upload */}
        <div className="space-y-2">
          {editalFile ? (
            <div className="flex items-center gap-3 bg-muted/30 rounded-lg p-3 border border-border/50">
              <FileText className="w-5 h-5 text-accent shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{editalFile.name}</p>
                <p className="text-[10px] text-muted-foreground">{(editalFile.size / 1024).toFixed(0)} KB</p>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditalFile(null); setEditalText(''); }}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          ) : (
            <label className="flex flex-col items-center gap-2 border-2 border-dashed border-border/60 rounded-xl p-6 cursor-pointer hover:border-accent/50 hover:bg-accent/5 transition-all">
              <Upload className="w-6 h-6 text-accent" />
              <span className="text-xs font-medium">Enviar arquivo do edital</span>
              <div className="flex gap-1">
                <Badge variant="outline" className="text-[9px]">PDF</Badge>
                <Badge variant="outline" className="text-[9px]">DOC</Badge>
                <Badge variant="outline" className="text-[9px]">TXT</Badge>
              </div>
              <input type="file" accept=".pdf,.doc,.docx,.txt" className="hidden" onChange={handleFileUpload} />
            </label>
          )}
        </div>

        <div className="relative">
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-center">
            <span className="bg-card px-2 text-[10px] text-muted-foreground">ou cole o texto</span>
          </div>
          <div className="border-t border-border/40 my-3" />
        </div>

        <Textarea
          value={editalText}
          onChange={e => setEditalText(e.target.value)}
          placeholder="Cole aqui o texto completo do edital para análise automática de irregularidades..."
          className="min-h-[200px] text-xs"
        />

        <Button
          onClick={handleExtract}
          disabled={extracting || !editalText.trim()}
          className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
        >
          {extracting ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {progress || 'Analisando...'}</>
          ) : (
            <><Sparkles className="w-4 h-4 mr-2" /> Analisar Irregularidades com IA</>
          )}
        </Button>
      </div>
    );
  }

  // STEP 2: Review + manual add
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-accent text-accent-foreground text-xs font-bold">2</div>
          <h4 className="text-sm font-semibold">Etapa 2 — Revisão e Complemento</h4>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="text-xs">
          <ChevronLeft className="w-3 h-3 mr-1" /> Voltar
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Revise as irregularidades encontradas pela IA. Desmarque as que não deseja incluir e adicione novas irregularidades manualmente.
      </p>

      {/* Stats */}
      <div className="flex gap-3">
        <Badge variant="outline" className="text-xs">
          {irregularidades.length} encontrada(s)
        </Badge>
        <Badge className="bg-accent/10 text-accent border-accent/20 text-xs">
          {selectedCount} selecionada(s)
        </Badge>
        <Badge variant="outline" className="text-xs">
          {irregularidades.filter(i => i.origem === 'manual').length} manual(is)
        </Badge>
      </div>

      {/* Irregularidades list */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {irregularidades.map((item) => (
          <div
            key={item.id}
            className={`rounded-lg border p-3 space-y-2 transition-all ${
              item.selecionada ? 'bg-card border-border' : 'bg-muted/20 border-border/30 opacity-60'
            }`}
          >
            <div className="flex items-start gap-3">
              <Checkbox
                checked={item.selecionada}
                onCheckedChange={() => toggleIrregularidade(item.id)}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={`text-[9px] border ${GRAVIDADE_COLORS[item.gravidade]}`}>
                    <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                    {GRAVIDADE_LABELS[item.gravidade]}
                  </Badge>
                  <Badge variant="outline" className="text-[9px]">
                    {item.origem === 'ia' ? '🤖 IA' : '✏️ Manual'}
                  </Badge>
                  {item.artigos.map((art, i) => (
                    <Badge key={i} variant="outline" className="text-[9px] bg-primary/5">
                      <Scale className="w-2.5 h-2.5 mr-0.5" /> {art}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-foreground leading-relaxed">{item.descricao}</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed italic">
                  📖 {item.fundamentacao}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeIrregularidade(item.id)}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ))}

        {irregularidades.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs">Nenhuma irregularidade encontrada. Adicione manualmente abaixo.</p>
          </div>
        )}
      </div>

      {/* Manual add */}
      {showManualForm ? (
        <div className="bg-muted/30 rounded-lg border border-border/50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-semibold flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Adicionar Irregularidade Manual
            </h5>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowManualForm(false)}>
              <X className="w-3 h-3" />
            </Button>
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">Descrição da irregularidade *</label>
            <Textarea
              value={manualDesc}
              onChange={e => setManualDesc(e.target.value)}
              placeholder="Descreva a irregularidade, falha ou vício identificado no edital..."
              className="mt-1 min-h-[80px] text-xs"
            />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">Fundamentação jurídica</label>
            <Textarea
              value={manualFund}
              onChange={e => setManualFund(e.target.value)}
              placeholder="Cite artigos da Lei 14.133/2021, jurisprudência TCU, doutrina..."
              className="mt-1 min-h-[60px] text-xs"
            />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">Gravidade</label>
            <select
              value={manualGrav}
              onChange={e => setManualGrav(e.target.value as 'alta' | 'media' | 'baixa')}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs"
            >
              <option value="alta">🔴 Alta — Ilegalidade clara</option>
              <option value="media">🟡 Média — Vício relevante</option>
              <option value="baixa">🔵 Baixa — Irregularidade menor</option>
            </select>
          </div>
          <Button size="sm" onClick={addManual} className="bg-accent hover:bg-accent/90 text-accent-foreground">
            <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar
          </Button>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setShowManualForm(true)} className="w-full border-dashed">
          <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar irregularidade manual
        </Button>
      )}

      {/* Proceed */}
      <Button
        onClick={handleFinish}
        disabled={selectedCount === 0}
        className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
      >
        <CheckCircle className="w-4 h-4 mr-2" />
        Gerar Documento com {selectedCount} Irregularidade(s)
        <ChevronRight className="w-4 h-4 ml-2" />
      </Button>
    </div>
  );
}
