import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Search, CheckCircle2, CalendarDays, Bell, Crosshair, Shield,
  ArrowRight, Loader2, Brain, Play, Building2,
  FileText, DollarSign,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';
import { streamAIChat } from '@/lib/ai-stream';
import ReactMarkdown from 'react-markdown';

const WORKFLOW_STEPS = [
  { key: 'pesquisa', label: 'Pesquisa de Editais', icon: Search, desc: 'Busca automática em portais por CNAEs e palavras-chave' },
  { key: 'selecao', label: 'Seleção & Score', icon: Brain, desc: 'IA analisa viabilidade e compatibilidade com a empresa' },
  { key: 'agendamento', label: 'Agendamento', icon: CalendarDays, desc: 'Adiciona prazos ao calendário com alertas 7/3/1 dias' },
  { key: 'alertas', label: 'Alertas Multicanal', icon: Bell, desc: 'Notificações via sistema, e-mail e WhatsApp' },
  { key: 'precificacao', label: 'Validação de Preços', icon: DollarSign, desc: 'Pesquisa mercadológica e análise de margem' },
  { key: 'documentacao', label: 'Documentação', icon: FileText, desc: 'Verificação de certidões e habilitação' },
  { key: 'proposta', label: 'Proposta Comercial', icon: Shield, desc: 'Montagem automática da proposta de preços' },
  { key: 'lances', label: 'Robô de Lances', icon: Crosshair, desc: 'Configuração e execução de lances automáticos' },
];

// Tipografia do Markdown devolvido pela IA, em tokens. Cobre TODOS os blocos
// que o modelo pode emitir: sem a regra de `h1` um "# Título" herdaria o h1
// global (28px, index.css) e competiria com o título da página; sem a regra de
// `a` o preflight do Tailwind zera cor e sublinhado e o link some no corpo.
const MARKDOWN_ETAPA =
  'text-sm leading-6 text-foreground ' +
  '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 ' +
  '[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground ' +
  '[&_code]:rounded [&_code]:bg-background [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs ' +
  '[&_h1]:mt-3 [&_h1]:text-base [&_h1]:font-semibold ' +
  '[&_h2]:mt-3 [&_h2]:text-base [&_h2]:font-semibold ' +
  '[&_h3]:mt-3 [&_h3]:font-semibold ' +
  '[&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 ' +
  '[&_p]:mb-2 ' +
  '[&_pre]:mb-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-background [&_pre]:p-3 ' +
  '[&_pre_code]:bg-transparent [&_pre_code]:p-0 ' +
  '[&_strong]:text-foreground ' +
  '[&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5';

export default function WorkflowIA() {
  const { user } = useAuth();
  const { empresas, empresaAtiva } = useEmpresa();
  const [empresaId, setEmpresaId] = useState(empresaAtiva?.id || '');
  const [running, setRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [stepResults, setStepResults] = useState<Record<string, string>>({});
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  const runWorkflow = async () => {
    if (!user || !empresaId) {
      toast.error('Selecione uma empresa para iniciar o workflow.');
      return;
    }

    const mem = empresas.find(e => e.empresa_id === empresaId);
    if (!mem) return;
    const empresa = mem.empresa;

    setRunning(true);
    setCompleted(new Set());
    setStepResults({});

    for (let i = 0; i < WORKFLOW_STEPS.length; i++) {
      const step = WORKFLOW_STEPS[i];
      setCurrentStep(i);

      let content = '';
      await streamAIChat({
        messages: [{
          role: 'user',
          content: `Você é o assistente de workflow autônomo da PRAEFECTUS. Execute a etapa "${step.label}" para a empresa:

**Empresa**: ${empresa.nome_fantasia || empresa.razao_social}
**CNPJ**: ${empresa.cnpj}
**CNAE Principal**: ${empresa.cnae_principal || 'Não informado'}
**UF**: ${empresa.uf || 'N/I'}
**Município**: ${empresa.municipio || 'N/I'}

**Etapa**: ${step.label}
**Descrição**: ${step.desc}

${i > 0 ? `**Resultado da etapa anterior (${WORKFLOW_STEPS[i - 1].label})**: ${stepResults[WORKFLOW_STEPS[i - 1].key]?.substring(0, 500) || 'N/A'}` : ''}

Forneça:
1. Ações executadas nesta etapa
2. Resultados encontrados (dados concretos)
3. Recomendações para o usuário
4. Próximos passos sugeridos

Seja objetivo e formate em Markdown limpo com seções numeradas. NÃO utilize emojis, emoticons ou caracteres decorativos.`
        }],
        action: 'workflow_ia_step',
        onDelta: (chunk) => {
          content += chunk;
          setStepResults(prev => ({ ...prev, [step.key]: content }));
        },
        onDone: () => {
          setCompleted(prev => new Set(prev).add(step.key));
        },
        onError: () => {
          setStepResults(prev => ({ ...prev, [step.key]: 'Erro ao executar esta etapa.' }));
          setCompleted(prev => new Set(prev).add(step.key));
        },
      });
    }

    setRunning(false);
    setCurrentStep(-1);
    toast.success('Esteira concluída. Revise e aprove os processos sugeridos.');
  };

  const progressPercent = WORKFLOW_STEPS.length > 0 ? (completed.size / WORKFLOW_STEPS.length) * 100 : 0;

  return (
    <AppLayout>
      <CabecalhoPagina
        acoes={
          <Button onClick={runWorkflow} disabled={running || !empresaId}>
            {running ? (
              <><Loader2 aria-hidden="true" className="w-4 h-4 animate-spin" /> Executando...</>
            ) : (
              <><Play aria-hidden="true" className="w-4 h-4" /> Iniciar esteira</>
            )}
          </Button>
        }
        filtros={
          <div className="flex flex-col gap-1">
            <label htmlFor="workflow-empresa" className="text-sm font-medium text-foreground">Empresa</label>
            <Select value={empresaId} onValueChange={setEmpresaId}>
              <SelectTrigger id="workflow-empresa" className="w-full sm:w-64">
                <SelectValue placeholder="Selecione a empresa" />
              </SelectTrigger>
              <SelectContent>
                {empresas.map(e => (
                  <SelectItem key={e.empresa_id} value={e.empresa_id}>
                    <span className="flex items-center gap-2">
                      <Building2 className="w-4 h-4" aria-hidden="true" />
                      {e.empresa.nome_fantasia || e.empresa.razao_social}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      <div className="space-y-6">
        {/* Progress */}
        {running && (
          <Card className="p-6 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progresso da esteira</span>
              <span className="font-medium tabular-nums">{Math.round(progressPercent)}%</span>
            </div>
            <Progress value={progressPercent} className="h-2" aria-label="Progresso da esteira" />
          </Card>
        )}

        {/* Steps */}
        <div className="space-y-3">
          {WORKFLOW_STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isActive = currentStep === idx;
            const isDone = completed.has(step.key);
            const hasResult = !!stepResults[step.key];

            return (
              <Card
                key={step.key}
                className={`p-6 transition-colors ${isActive ? 'ring-2 ring-ring' : ''} ${isDone ? 'border-success-line' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div
                    aria-hidden="true"
                    className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isDone ? 'bg-success-tint text-success-ink' : isActive ? 'bg-warning-tint text-warning-ink' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {isDone ? <CheckCircle2 className="w-5 h-5" /> : isActive ? <Loader2 className="w-5 h-5 animate-spin" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-foreground">{step.label}</h3>
                      {isDone && <Badge variant="success">Concluído</Badge>}
                      {isActive && <Badge variant="warning">Em execução</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{step.desc}</p>

                    {hasResult && (
                      <div className="mt-3 rounded-lg border border-border bg-muted p-4">
                        <div className={MARKDOWN_ETAPA}>
                          <ReactMarkdown>{stepResults[step.key]}</ReactMarkdown>
                        </div>
                      </div>
                    )}
                  </div>
                  {idx < WORKFLOW_STEPS.length - 1 && (
                    <ArrowRight aria-hidden="true" className="hidden sm:block w-4 h-4 text-muted-foreground flex-shrink-0 mt-3" />
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        {/* Completion message */}
        {!running && completed.size === WORKFLOW_STEPS.length && (
          <Alert variant="success">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            <AlertTitle className="text-lg font-semibold">Esteira concluída</AlertTitle>
            <AlertDescription>
              <p>
                Revise os resultados acima e acesse seus <strong>Compromissos</strong> para aprovar ou rejeitar os processos sugeridos.
              </p>
              <Button className="mt-4" onClick={() => window.location.href = '/meus-compromissos'}>
                <ArrowRight className="w-4 h-4" aria-hidden="true" /> Ver meus compromissos
              </Button>
            </AlertDescription>
          </Alert>
        )}
      </div>
    </AppLayout>
  );
}
