import { Skeleton } from '@/components/ui/skeleton';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2, XCircle, AlertTriangle, RefreshCw, Shield, Globe, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

type HealthEntry = {
  id: string;
  portal_id: string;
  portal_nome: string;
  status: string;
  seletores_ok: boolean;
  seletores_falhos: string[];
  ultima_verificacao: string | null;
  detalhes: Record<string, unknown>;
};

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'muted';

// "Operacional" sugeria que o robô opera naquele portal. O que se mede é se o
// endereço responde — nada além disso.
const STATUS_CONFIG: Record<string, { icon: typeof Shield; cor: string; variante: BadgeVariant; label: string }> = {
  ok: { icon: CheckCircle2, cor: 'text-success', variante: 'success', label: 'Responde' },
  alerta: { icon: AlertTriangle, cor: 'text-warning', variante: 'warning', label: 'Respondeu com erro' },
  falha: { icon: XCircle, cor: 'text-destructive', variante: 'danger', label: 'Fora do ar' },
  desconhecido: { icon: Globe, cor: 'text-muted-foreground', variante: 'muted', label: 'Não verificado' },
};

export default function PortalHealthcheck() {
  const [entries, setEntries] = useState<HealthEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('portal_healthcheck' as any)
      .select('*')
      .order('portal_nome');
    setEntries((data || []) as unknown as HealthEntry[]);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const runHealthcheck = async () => {
    setChecking(true);
    try {
      const { error } = await supabase.functions.invoke('portal-healthcheck', {
        body: { action: 'check-all' },
      });
      if (error) throw error;
      toast.success('Healthcheck concluído!');
      await loadData();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao executar healthcheck.');
    } finally {
      setChecking(false);
    }
  };

  // As colunas do banco se chamam `seletores_ok` e `seletores_falhos` desde
  // março, mas a função só faz HEAD/GET na URL do portal e olha o status HTTP —
  // nunca abre navegador nem testa seletor. "12 seletores OK" queria dizer "12
  // sites responderam", o que é confiança sem lastro: seletor quebrado só
  // aparece no meio de uma disputa. Os nomes das colunas ficam; o que a tela
  // afirma passa a ser o que de fato foi medido.
  const okCount = entries.filter(e => e.seletores_ok).length;
  const failCount = entries.filter(e => !e.seletores_ok).length;

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
            Portais no ar
          </h3>
          <p className="text-sm text-muted-foreground max-w-xl">
            Confere se o endereço de cada portal responde. <strong>Não testa a automação</strong> —
            se o robô consegue fazer login, achar a sala da disputa e enviar lance
            só se sabe rodando uma sessão de verdade.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Badge variant="success">
            {okCount} responderam
          </Badge>
          {failCount > 0 && (
            <Badge variant="danger">
              {failCount} fora do ar
            </Badge>
          )}
          <Button
            variant="outline"
            onClick={runHealthcheck}
            disabled={checking}
          >
            {checking ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="w-4 h-4" aria-hidden="true" />}
            {checking ? 'Verificando...' : 'Verificar Agora'}
          </Button>
        </div>
      </div>

      {loading ? (
        /* A lista que vem é uma linha por portal. O esqueleto tem essa forma
           para a caixa não pular de altura quando os doze chegarem. */
        <div className="space-y-2" role="status" aria-busy="true">
          <span className="sr-only">Consultando portais</span>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 py-2">
              <Skeleton className="h-3 w-3 rounded-full shrink-0" />
              <Skeleton className="h-4 flex-1 max-w-[180px]" />
              <Skeleton className="h-4 w-14 shrink-0 ml-auto" />
            </div>
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-6">
          <div className="w-10 h-10 rounded-full bg-primary-tint text-primary flex items-center justify-center mx-auto mb-2">
            <Globe className="w-5 h-5" aria-hidden="true" />
          </div>
          <p className="text-base font-semibold">Nenhum portal verificado ainda</p>
          <p className="text-sm text-muted-foreground mt-1">
            Clique em "Verificar Agora" para executar o healthcheck em todos os portais.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {entries.map((entry) => {
            const config = STATUS_CONFIG[entry.status] || STATUS_CONFIG.desconhecido;
            const Icon = config.icon;
            return (
              <div
                key={entry.id}
                className={`flex items-start gap-3 rounded-lg border p-4 ${
                  entry.seletores_ok
                    ? 'border-success-line bg-success-tint'
                    : 'border-destructive-line bg-destructive-tint'
                }`}
              >
                <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${config.cor}`} aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{entry.portal_nome}</p>
                  <Badge variant={config.variante} className="mt-1">
                    {config.label}
                  </Badge>
                  {entry.seletores_falhos.length > 0 && (
                    <div className="mt-2 space-y-0.5">
                      {entry.seletores_falhos.map((s, i) => (
                        <p key={i} className="text-xs text-destructive-ink truncate">⚠️ {s}</p>
                      ))}
                    </div>
                  )}
                  {entry.ultima_verificacao && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Último check: {new Date(entry.ultima_verificacao).toLocaleString('pt-BR')}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
