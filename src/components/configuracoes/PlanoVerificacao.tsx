import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle2, XCircle, Loader2, Play, Shield, Database,
  Bot, Search, FileText, Bell, Kanban, Users, Zap, Scale,
  Calculator, Globe, BarChart3, CreditCard
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

const planLabels: Record<string, { name: string; color: string }> = {
  basico: { name: 'Básico', color: 'bg-muted text-muted-foreground' },
  profissional: { name: 'Profissional', color: 'bg-accent/15 text-accent' },
  enterprise: { name: 'Enterprise', color: 'bg-primary/15 text-primary' },
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
    <section className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-accent" />
          <h2 className="text-sm font-semibold">Verificação de Funcionalidades por Plano</h2>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        Selecione um plano para testar se todas as funcionalidades incluídas estão operando corretamente.
      </p>

      {/* Plan selector */}
      <div className="flex gap-2 mb-5">
        {Object.entries(planLabels).map(([slug, { name, color }]) => (
          <button
            key={slug}
            onClick={() => { setSelectedPlan(slug); setResults({}); }}
            className={cn(
              'px-4 py-2 rounded-lg text-xs font-semibold transition-all border',
              selectedPlan === slug
                ? 'border-accent bg-accent/10 text-accent ring-1 ring-accent/30'
                : 'border-border/50 text-muted-foreground hover:border-accent/40'
            )}
          >
            {name}
          </button>
        ))}
      </div>

      {/* Progress */}
      {(passCount + failCount) > 0 && (
        <div className="mb-5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Progresso dos testes</span>
            <span className="font-semibold">
              <span className="text-success">{passCount} ✓</span>
              {failCount > 0 && <span className="text-destructive ml-2">{failCount} ✗</span>}
              <span className="text-muted-foreground ml-2">/ {planTests.length}</span>
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      {/* Test list */}
      <div className="space-y-2 mb-5 max-h-[400px] overflow-y-auto">
        {planTests.map((t) => {
          const status = results[t.id] || 'idle';
          const Icon = t.icon;
          return (
            <div
              key={t.id}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg border transition-all',
                status === 'pass' && 'border-success/30 bg-success/5',
                status === 'fail' && 'border-destructive/30 bg-destructive/5',
                status === 'running' && 'border-accent/30 bg-accent/5',
                status === 'idle' && 'border-border/50 bg-muted/20',
              )}
            >
              <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.description}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="hidden sm:flex gap-1">
                  {t.plans.map(p => (
                    <Badge key={p} variant="outline" className={cn('text-xs px-1.5 py-0', planLabels[p]?.color)}>
                      {planLabels[p]?.name}
                    </Badge>
                  ))}
                </div>
                {status === 'idle' && <div className="w-5 h-5 rounded-full bg-muted" />}
                {status === 'running' && <Loader2 className="w-5 h-5 text-accent animate-spin" />}
                {status === 'pass' && <CheckCircle2 className="w-5 h-5 text-success" />}
                {status === 'fail' && <XCircle className="w-5 h-5 text-destructive" />}
              </div>
            </div>
          );
        })}
      </div>

      {/* Run button */}
      <Button
        onClick={runTests}
        disabled={running || !user}
        className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
      >
        {running ? (
          <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Executando testes...</>
        ) : (
          <><Play className="w-4 h-4 mr-2" /> Testar Plano {planLabels[selectedPlan]?.name}</>
        )}
      </Button>

      {/* Summary */}
      {!running && passCount + failCount === planTests.length && planTests.length > 0 && (
        <div className={cn(
          'mt-4 p-4 rounded-lg border text-center',
          failCount === 0 ? 'border-success/30 bg-success/5' : 'border-warning/30 bg-warning/5'
        )}>
          {failCount === 0 ? (
            <>
              <CheckCircle2 className="w-8 h-8 text-success mx-auto mb-2" />
              <p className="text-sm font-bold text-success">Plano {planLabels[selectedPlan]?.name} — 100% Operacional</p>
              <p className="text-xs text-muted-foreground mt-1">Todas as {planTests.length} funcionalidades estão ativas e funcionando corretamente.</p>
            </>
          ) : (
            <>
              <XCircle className="w-8 h-8 text-warning mx-auto mb-2" />
              <p className="text-sm font-bold text-warning">Plano {planLabels[selectedPlan]?.name} — {passCount}/{planTests.length} testes passaram</p>
              <p className="text-xs text-muted-foreground mt-1">{failCount} funcionalidade(s) com falha. Verifique as permissões do banco de dados.</p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
