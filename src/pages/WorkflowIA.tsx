import { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Bot, Search, CheckCircle2, CalendarDays, Bell, Crosshair, Shield,
  ArrowRight, Loader2, RefreshCw, Brain, Play, Pause, Building2,
  FileText, DollarSign, Zap,
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
          content: `Você é o assistente de workflow autônomo da Praefectus. Execute a etapa "${step.label}" para a empresa:

**Empresa**: ${empresa.nome_fantasia || empresa.razao_social}
**CNPJ**: ${empresa.cnpj}
**CNAE Principal**: ${empresa.cnae_principal || 'Não informado'}
**UF**: ${empresa.uf || 'N/I'}
**Município**: ${empresa.municipio || 'N/I'}

**Etapa**: ${step.label}
**Descrição**: ${step.desc}

${i > 0 ? `**Resultado da etapa anterior (${WORKFLOW_STEPS[i - 1].label})**: ${stepResults[WORKFLOW_STEPS[i - 1].key]?.substring(0, 500) || 'N/A'}` : ''}

Forneça:
1. **Ações executadas** nesta etapa
2. **Resultados encontrados** (dados concretos)
3. **Recomendações** para o usuário
4. **Próximos passos** sugeridos

Seja objetivo e formate em Markdown. Use emojis para status (✅ concluído, ⚠️ atenção, ❌ problema).`
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
          setStepResults(prev => ({ ...prev, [step.key]: '❌ Erro ao executar esta etapa.' }));
          setCompleted(prev => new Set(prev).add(step.key));
        },
      });
    }

    setRunning(false);
    setCurrentStep(-1);
    toast.success('🤖 Workflow completo! Revise e aprove os processos sugeridos.');
  };

  const progressPercent = WORKFLOW_STEPS.length > 0 ? (completed.size / WORKFLOW_STEPS.length) * 100 : 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Bot className="w-6 h-6 text-accent" />
              Workflow Autônomo IA
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              A IA executa todo o trajeto: pesquisa → seleção → agendamento → lances. Você aprova no final.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={empresaId} onValueChange={setEmpresaId}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Selecione a empresa" />
              </SelectTrigger>
              <SelectContent>
                {empresas.map(e => (
                  <SelectItem key={e.empresa_id} value={e.empresa_id}>
                    <span className="flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5" />
                      {e.empresa.nome_fantasia || e.empresa.razao_social}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={runWorkflow}
              disabled={running || !empresaId}
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              {running ? (
                <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Executando...</>
              ) : (
                <><Play className="w-4 h-4 mr-1" /> Iniciar Workflow</>
              )}
            </Button>
          </div>
        </div>

        {/* Progress */}
        {running && (
          <Card className="p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progresso do Workflow</span>
              <span className="font-medium">{Math.round(progressPercent)}%</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
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
                className={`p-4 transition-all ${isActive ? 'ring-2 ring-accent shadow-lg' : ''} ${isDone ? 'border-success/30' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isDone ? 'bg-success/20 text-success' : isActive ? 'bg-accent/20 text-accent animate-pulse' : 'bg-muted text-muted-foreground'
                  }`}>
                    {isDone ? <CheckCircle2 className="w-5 h-5" /> : isActive ? <Loader2 className="w-5 h-5 animate-spin" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm">{step.label}</h3>
                      {isDone && <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-[10px]">Concluído</Badge>}
                      {isActive && <Badge variant="outline" className="bg-accent/10 text-accent border-accent/20 text-[10px]">Em execução</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>

                    {hasResult && (
                      <div className="mt-3 bg-muted/30 rounded-lg p-3 border border-border/50">
                        <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
                          <ReactMarkdown>{stepResults[step.key]}</ReactMarkdown>
                        </div>
                      </div>
                    )}
                  </div>
                  {idx < WORKFLOW_STEPS.length - 1 && (
                    <ArrowRight className="w-4 h-4 text-muted-foreground/30 flex-shrink-0 mt-3" />
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        {/* Completion message */}
        {!running && completed.size === WORKFLOW_STEPS.length && (
          <Card className="p-6 text-center bg-success/5 border-success/20">
            <CheckCircle2 className="w-12 h-12 mx-auto text-success mb-3" />
            <h3 className="text-lg font-bold">Workflow Completo!</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Revise os resultados acima e acesse seus <strong>Compromissos</strong> para aprovar ou rejeitar os processos sugeridos.
            </p>
            <Button className="mt-4 bg-accent hover:bg-accent/90 text-accent-foreground" onClick={() => window.location.href = '/meus-compromissos'}>
              <ArrowRight className="w-4 h-4 mr-1" /> Ver Meus Compromissos
            </Button>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
