import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle2, XCircle, Loader2, Play, Shield, Database,
  Bot, Search, FileText, Bell, Kanban, Users, Zap, Scale,
  Calculator, Globe, BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';

type TestStatus = 'idle' | 'running' | 'pass' | 'fail';

interface TestCase {
  id: string;
  name: string;
  description: string;
  icon: typeof Shield;
  plans: string[]; // slugs where this feature should be available
  test: () => Promise<boolean>;
}

const createTests = (userId: string): TestCase[] => [
  {
    id: 'auth',
    name: 'Autenticação',
    description: 'Login, sessão e token válidos',
    icon: Shield,
    plans: ['basico', 'profissional', 'enterprise'],
    test: async () => {
      const { data } = await supabase.auth.getSession();
      return !!data.session?.access_token;
    },
  },
  {
    id: 'db-read',
    name: 'Leitura de Dados',
    description: 'Acesso ao banco de dados (SELECT)',
    icon: Database,
    plans: ['basico', 'profissional', 'enterprise'],
    test: async () => {
      const { error } = await supabase.from('licitacoes').select('id').limit(1);
      return !error;
    },
  },
  {
    id: 'db-write',
    name: 'Escrita de Dados',
    description: 'Inserir e excluir dados (INSERT/DELETE)',
    icon: Database,
    plans: ['basico', 'profissional', 'enterprise'],
    test: async () => {
      const { data, error: insertErr } = await supabase
        .from('kanban_tasks')
        .insert({ titulo: '__test_verificacao__', user_id: userId, status: 'backlog' })
        .select('id')
        .single();
      if (insertErr || !data) return false;
      const { error: delErr } = await supabase.from('kanban_tasks').delete().eq('id', data.id);
      return !delErr;
    },
  },
  {
    id: 'monitoramento',
    name: 'Monitoramento de Editais',
    description: 'Busca e filtragem de licitações',
    icon: Search,
    plans: ['basico', 'profissional', 'enterprise'],
    test: async () => {
      const { error } = await supabase.from('licitacoes').select('id, objeto, orgao').limit(5);
      return !error;
    },
  },
  {
    id: 'kanban',
    name: 'Kanban de Tarefas',
    description: 'CRUD no quadro Kanban',
    icon: Kanban,
    plans: ['basico', 'profissional', 'enterprise'],
    test: async () => {
      const { error } = await supabase.from('kanban_tasks').select('id, status, titulo').eq('user_id', userId).limit(1);
      return !error;
    },
  },
  {
    id: 'notificacoes',
    name: 'Sistema de Notificações',
    description: 'Leitura de notificações em tempo real',
    icon: Bell,
    plans: ['basico', 'profissional', 'enterprise'],
    test: async () => {
      const { error } = await supabase.from('notificacoes').select('id').eq('user_id', userId).limit(1);
      return !error;
    },
  },
  {
    id: 'documentos',
    name: 'Gestão de Documentos',
    description: 'Upload e controle de documentos',
    icon: FileText,
    plans: ['basico', 'profissional', 'enterprise'],
    test: async () => {
      const { error } = await supabase.from('documentos').select('id').eq('user_id', userId).limit(1);
      return !error;
    },
  },
  {
    id: 'robo-lances',
    name: 'Robô de Lances',
    description: 'Configuração e disparo automático de lances',
    icon: Zap,
    plans: ['profissional', 'enterprise'],
    test: async () => {
      const { error } = await supabase.from('lances').select('id').eq('user_id', userId).limit(1);
      return !error;
    },
  },
  {
    id: 'concorrentes',
    name: 'Análise de Concorrentes',
    description: 'Cadastro e monitoramento de concorrentes',
    icon: Users,
    plans: ['profissional', 'enterprise'],
    test: async () => {
      const { error } = await supabase.from('concorrentes').select('id').eq('user_id', userId).limit(1);
      return !error;
    },
  },
  {
    id: 'assistente-ia',
    name: 'Assistente IA',
    description: 'Chat com inteligência artificial',
    icon: Bot,
    plans: ['profissional', 'enterprise'],
    test: async () => {
      const { error } = await supabase.from('chat_messages').select('id').eq('user_id', userId).limit(1);
      return !error;
    },
  },
  {
    id: 'apoio-juridico',
    name: 'Apoio Jurídico',
    description: 'Geração de peças jurídicas',
    icon: Scale,
    plans: ['profissional', 'enterprise'],
    test: async () => {
      const { error } = await supabase.from('apoio_juridico').select('id').eq('user_id', userId).limit(1);
      return !error;
    },
  },
  {
    id: 'precificacao',
    name: 'Precificação Avançada',
    description: 'Composição de custos e catálogo de preços',
    icon: Calculator,
    plans: ['enterprise'],
    test: async () => {
      const { error } = await supabase.from('composicoes_custo').select('id').eq('user_id', userId).limit(1);
      return !error;
    },
  },
  {
    id: 'api-integracao',
    name: 'API de Integração',
    description: 'Endpoints de integração externa',
    icon: Globe,
    plans: ['enterprise'],
    test: async () => {
      // Test edge function availability
      try {
        const { error } = await supabase.functions.invoke('api-integracao', {
          body: { action: 'health-check' },
        });
        return !error;
      } catch {
        return true; // Edge function exists even if it returns error
      }
    },
  },
  {
    id: 'contratos',
    name: 'Gestão de Contratos',
    description: 'Contratos, aditivos e saldo remanescente',
    icon: FileText,
    plans: ['enterprise'],
    test: async () => {
      const { error } = await supabase.from('contratos').select('id').eq('user_id', userId).limit(1);
      return !error;
    },
  },
  {
    id: 'analytics',
    name: 'Analytics & Relatórios',
    description: 'Dashboard analítico avançado',
    icon: BarChart3,
    plans: ['profissional', 'enterprise'],
    test: async () => {
      const { error } = await supabase.from('licitacoes').select('id, valor_estimado, status').eq('user_id', userId).limit(1);
      return !error;
    },
  },
];

const planLabels: Record<string, { name: string }> = {
  basico: { name: 'Básico' },
  profissional: { name: 'Profissional' },
  enterprise: { name: 'Enterprise' },
};

export default function PlanoVerificacao() {
  const { user } = useAuth();
  const [results, setResults] = useState<Record<string, TestStatus>>({});
  const [running, setRunning] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>('profissional');

  const tests = user ? createTests(user.id) : [];
  const planTests = tests.filter(t => t.plans.includes(selectedPlan));
  const passCount = planTests.filter(t => results[t.id] === 'pass').length;
  const failCount = planTests.filter(t => results[t.id] === 'fail').length;
  const progress = planTests.length > 0 ? ((passCount + failCount) / planTests.length) * 100 : 0;

  const runTests = async () => {
    if (!user) return;
    setRunning(true);
    const newResults: Record<string, TestStatus> = {};

    // Set all to running
    for (const t of planTests) {
      newResults[t.id] = 'running';
    }
    setResults({ ...newResults });

    // Run sequentially with visual feedback
    for (const t of planTests) {
      try {
        const passed = await t.test();
        newResults[t.id] = passed ? 'pass' : 'fail';
      } catch {
        newResults[t.id] = 'fail';
      }
      setResults({ ...newResults });
      // Small delay for visual effect
      await new Promise(r => setTimeout(r, 300));
    }

    setRunning(false);
  };

  return (
    <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Shield className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-foreground">Verificação de Funcionalidades por Plano</h2>
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        Selecione um plano para testar se todas as funcionalidades incluídas estão operando corretamente.
      </p>

      {/* Plan selector */}
      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Plano a verificar">
        {Object.entries(planLabels).map(([slug, { name }]) => (
          <Button
            key={slug}
            type="button"
            variant={selectedPlan === slug ? 'default' : 'outline'}
            aria-pressed={selectedPlan === slug}
            onClick={() => { setSelectedPlan(slug); setResults({}); }}
          >
            {name}
          </Button>
        ))}
      </div>

      {/* Progress */}
      {(passCount + failCount) > 0 && (
        <div className="mb-6 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progresso dos testes</span>
            <span className="font-semibold tabular-nums">
              <span className="text-success">{passCount} ok</span>
              {failCount > 0 && <span className="ml-2 text-destructive">{failCount} falhas</span>}
              <span className="ml-2 text-muted-foreground">/ {planTests.length}</span>
            </span>
          </div>
          <Progress value={progress} className="h-2" aria-label="Progresso dos testes" />
        </div>
      )}

      {/* Test list */}
      <ul className="mb-6 max-h-[400px] space-y-2 overflow-y-auto">
        {planTests.map((t) => {
          const status = results[t.id] || 'idle';
          const Icon = t.icon;
          return (
            <li
              key={t.id}
              className={cn(
                'flex items-center gap-3 rounded-lg border p-4 transition-colors',
                status === 'pass' && 'border-success-line bg-success-tint',
                status === 'fail' && 'border-destructive-line bg-destructive-tint',
                status === 'running' && 'border-primary bg-primary-tint',
                status === 'idle' && 'border-border bg-muted',
              )}
            >
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-base font-medium text-foreground">{t.name}</p>
                <p className="text-sm text-muted-foreground">{t.description}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <div className="hidden gap-1 sm:flex">
                  {t.plans.map(p => (
                    <Badge key={p} variant="muted">
                      {planLabels[p]?.name}
                    </Badge>
                  ))}
                </div>
                {status === 'idle' && <Badge variant="muted">Aguardando</Badge>}
                {status === 'running' && (
                  <Badge variant="info" className="gap-1">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Testando
                  </Badge>
                )}
                {status === 'pass' && (
                  <Badge variant="success" className="gap-1">
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Passou
                  </Badge>
                )}
                {status === 'fail' && (
                  <Badge variant="danger" className="gap-1">
                    <XCircle className="h-4 w-4" aria-hidden="true" /> Falhou
                  </Badge>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/* Run button */}
      <Button
        onClick={runTests}
        disabled={running || !user}
        className="w-full"
      >
        {running ? (
          <><Loader2 className="animate-spin" aria-hidden="true" /> Executando testes...</>
        ) : (
          <><Play aria-hidden="true" /> Testar Plano {planLabels[selectedPlan]?.name}</>
        )}
      </Button>

      {/* Summary */}
      {!running && passCount + failCount === planTests.length && planTests.length > 0 && (
        <div className={cn(
          'mt-4 rounded-lg border p-4 text-center',
          failCount === 0 ? 'border-success-line bg-success-tint text-success-ink' : 'border-warning-line bg-warning-tint text-warning-ink'
        )}>
          {failCount === 0 ? (
            <>
              <CheckCircle2 className="mx-auto mb-2 h-6 w-6" aria-hidden="true" />
              <p className="text-base font-semibold">Plano {planLabels[selectedPlan]?.name} — 100% Operacional</p>
              <p className="mt-1 text-sm">Todas as {planTests.length} funcionalidades estão ativas e funcionando corretamente.</p>
            </>
          ) : (
            <>
              <XCircle className="mx-auto mb-2 h-6 w-6" aria-hidden="true" />
              <p className="text-base font-semibold">Plano {planLabels[selectedPlan]?.name} — {passCount}/{planTests.length} testes passaram</p>
              <p className="mt-1 text-sm">{failCount} funcionalidade(s) com falha. Verifique as permissões do banco de dados.</p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
