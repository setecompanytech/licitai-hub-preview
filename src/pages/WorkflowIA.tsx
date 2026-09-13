import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Bot, Search, CheckCircle2, CalendarDays, Bell, Crosshair, Shield,
  ArrowRight, Loader2, Brain, Play, Building2,
  FileText, DollarSign,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
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
    toast.success('Workflow completo! Revise e aprove os processos sugeridos.');
  };

  const progressPercent = WORKFLOW_STEPS.length > 0 ? (completed.size / WORKFLOW_STEPS.length) * 100 : 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        <CabecalhoPagina
          icone={<Bot />}
          titulo="Workflow Autônomo IA"
          descricao="A IA executa todo o trajeto: pesquisa → seleção → agendamento → lances. Você aprova no final."
          acoes={
            <>
              <label htmlFor="workflow-empresa" className="sr-only">Empresa</label>
              <Select value={empresaId} onValueChange={setEmpresaId}>
                <SelectTrigger id="workflow-empresa" className="w-full sm:w-[240px]">
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map(e => (
                    <SelectItem key={e.empresa_id} value={e.empresa_id}>
                      <span className="flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        {e.empresa.nome_fantasia || e.empresa.razao_social}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={runWorkflow} disabled={running || !empresaId}>
                {running ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Executando...</>
                ) : (
                  <><Play className="w-4 h-4" /> Iniciar Workflow</>
                )}
              </Button>
            </>
          }
        />

        {/* Progress */}
        {running && (
          <Card className="p-6 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progresso do Workflow</span>
              <span className="font-medium tabular-nums">{Math.round(progressPercent)}%</span>
            </div>
            <Progress value={progressPercent} className="h-2" aria-label="Progresso do workflow" />
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
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isDone ? 'bg-success-tint text-success-ink' : isActive ? 'bg-warning-tint text-warning-ink' : 'bg-muted text-muted-foreground'
                  }`}>
                    {isDone ? <CheckCircle2 className="w-5 h-5" /> : isActive ? <Loader2 className="w-5 h-5 animate-spin" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold">{step.label}</h3>
                      {isDone && <Badge variant="success">Concluído</Badge>}
                      {isActive && <Badge variant="warning">Em execução</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{step.desc}</p>

                    {hasResult && (
                      <div className="mt-3 bg-muted rounded-lg p-4 border border-border">
                        <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
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
          <Card className="p-6 text-center bg-success-tint border-success-line">
            <CheckCircle2 className="w-12 h-12 mx-auto text-success-ink mb-3" />
            <h3 className="text-lg font-semibold text-success-ink">Workflow Completo!</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Revise os resultados acima e acesse seus <strong>Compromissos</strong> para aprovar ou rejeitar os processos sugeridos.
            </p>
            <Button className="mt-4" onClick={() => window.location.href = '/meus-compromissos'}>
              <ArrowRight className="w-4 h-4" /> Ver Meus Compromissos
            </Button>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
