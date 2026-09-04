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

// "Operacional" sugeria que o robô opera naquele portal. O que se mede é se o
// endereço responde — nada além disso.
const STATUS_CONFIG: Record<string, { icon: typeof Shield; cor: string; label: string }> = {
  ok: { icon: CheckCircle2, cor: 'text-success', label: 'Responde' },
  alerta: { icon: AlertTriangle, cor: 'text-warning', label: 'Respondeu com erro' },
  falha: { icon: XCircle, cor: 'text-destructive', label: 'Fora do ar' },
  desconhecido: { icon: Globe, cor: 'text-muted-foreground', label: 'Não verificado' },
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
    <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Shield className="w-4 h-4 text-muted-foreground" />
            Portais no ar
          </h3>
          <p className="text-xs text-muted-foreground max-w-xl">
            Confere se o endereço de cada portal responde. <strong>Não testa a automação</strong> —
            se o robô consegue fazer login, achar a sala da disputa e enviar lance
            só se sabe rodando uma sessão de verdade.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-xs">
            {okCount} responderam
          </Badge>
          {failCount > 0 && (
            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-xs">
              {failCount} fora do ar
            </Badge>
          )}
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7 gap-1"
            onClick={runHealthcheck}
            disabled={checking}
          >
            {checking ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            {checking ? 'Verificando...' : 'Verificar Agora'}
          </Button>
        </div>
      </div>

      {loading ? (
        /* A lista que vem é uma linha por portal. O esqueleto tem essa forma
           para a caixa não pular de altura quando os doze chegarem. */
        <div className="space-y-1.5" role="status" aria-busy="true">
          <span className="sr-only">Consultando portais</span>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-2.5 py-1.5">
              <Skeleton className="h-2 w-2 rounded-full shrink-0" />
              <Skeleton className="h-3 flex-1 max-w-[180px]" />
              <Skeleton className="h-3 w-14 shrink-0 ml-auto" />
            </div>
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-6">
          <Globe className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Nenhum portal verificado ainda.</p>
          <p className="text-xs text-muted-foreground mt-1">
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
                className={`flex items-start gap-3 rounded-lg border p-3 ${
                  entry.seletores_ok
                    ? 'border-success/20 bg-success/5'
                    : 'border-destructive/20 bg-destructive/5'
                }`}
              >
                <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${config.cor}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold">{entry.portal_nome}</p>
                  <Badge variant="outline" className={`text-xs mt-1 ${config.cor}`}>
                    {config.label}
                  </Badge>
                  {entry.seletores_falhos.length > 0 && (
                    <div className="mt-1.5 space-y-0.5">
                      {entry.seletores_falhos.map((s, i) => (
                        <p key={i} className="text-xs text-destructive truncate">⚠️ {s}</p>
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
