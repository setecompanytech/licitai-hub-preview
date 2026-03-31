import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  Server, Wifi, WifiOff, Loader2, CheckCircle2, XCircle, Clock,
  Layers, Cpu, HardDrive, Rocket, ShieldCheck, RefreshCw, Upload, Link2, Copy,
} from 'lucide-react';

type AgenteConfig = {
  id: string;
  nome: string;
  url_base: string;
  status: string;
  ultimo_heartbeat: string | null;
  versao_agente: string | null;
  capacidades: string[];
  max_sessoes_paralelas: number;
  sessoes_ativas: number;
  ram_mb: number | null;
};

/** Limites de sessões por plano */
const PLAN_SESSION_LIMITS: Record<string, { sessions: number; label: string }> = {
  profissional: { sessions: 1, label: 'Profissional' },
  enterprise: { sessions: 5, label: 'Enterprise' },
};

const MANAGED_AGENT_URL = 'https://agente.praefectus.com.br';
const MANAGED_AGENT_KEY = 'praefectus_agente_2026_secreto';

export default function AgenteExternoConfig() {
  const { user, subscription } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const [agentes, setAgentes] = useState<AgenteConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [provisioning, setProvisioning] = useState(false);
  const [certLinkLoading, setCertLinkLoading] = useState(false);
  const [certUploadUrl, setCertUploadUrl] = useState<string | null>(null);

  const planSlug = subscription.planSlug;
  const planConfig = planSlug ? PLAN_SESSION_LIMITS[planSlug] : null;

  useEffect(() => {
    if (!user) return;
    supabase
      .from('agente_externo_config')
      .select('*')
      .eq('user_id', user.id)
      .then(({ data }) => {
        setAgentes((data || []) as unknown as AgenteConfig[]);
        setLoading(false);
      });
  }, [user]);

  /** Provisiona automaticamente o agente gerenciado para o plano do usuário */
  const handleAutoProvision = async () => {
    if (!planConfig) {
      toast.error('Seu plano não inclui o Robô de Lances em nuvem.');
      return;
    }

    setProvisioning(true);
    try {
      const resp = await supabase.functions.invoke('robo-lances-webhook/configurar-agente', {
        body: {
          url_base: MANAGED_AGENT_URL,
          nome: `Agente Cloud — ${planConfig.label}`,
          api_key: MANAGED_AGENT_KEY,
          max_sessoes_paralelas: planConfig.sessions,
        },
      });

      if (resp.error) throw resp.error;
      const result = resp.data as { success: boolean; agente: AgenteConfig; error?: string };
      if (!result.success) throw new Error(result.error || 'Erro ao provisionar');

      toast.success('Agente configurado automaticamente! ✅');
      setAgentes((prev) => {
        const exists = prev.find((a) => a.id === result.agente.id);
        if (exists) return prev.map((a) => (a.id === result.agente.id ? result.agente : a));
        return [...prev, result.agente];
      });
    } catch (e: any) {
      toast.error(e.message || 'Erro ao provisionar agente');
    } finally {
      setProvisioning(false);
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'ativo': return <CheckCircle2 className="w-4 h-4 text-success" />;
      case 'offline': return <WifiOff className="w-4 h-4 text-destructive" />;
      case 'verificando': return <Loader2 className="w-4 h-4 animate-spin text-warning" />;
      default: return <XCircle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      ativo: 'bg-success/15 text-success border-success/30',
      offline: 'bg-destructive/15 text-destructive border-destructive/30',
      verificando: 'bg-warning/15 text-warning border-warning/30',
      inativo: 'bg-muted text-muted-foreground border-border',
      erro: 'bg-destructive/15 text-destructive border-destructive/30',
    };
    return map[status] || map.inativo;
  };

  return (
    <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Server className="w-4 h-4 text-accent" />
          Agente Cloud de Lances
        </h3>
        {planConfig && (
          <Badge variant="outline" className="text-[10px] gap-1">
            <ShieldCheck className="w-3 h-3" />
            Plano {planConfig.label} — até {planConfig.sessions} sessão(ões)
          </Badge>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : agentes.length === 0 ? (
        <div className="text-center py-8 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto">
            <Rocket className="w-7 h-7 text-accent" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">
              Ative seu Agente Cloud com um clique
            </p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              O sistema configura automaticamente o servidor de automação de acordo com seu plano.
              Sem necessidade de configuração técnica — tudo é gerenciado pela plataforma.
            </p>
          </div>

          {planConfig ? (
            <div className="space-y-3">
              <div className="bg-muted/30 rounded-lg p-3 max-w-sm mx-auto text-left space-y-1.5">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  O que será configurado:
                </p>
                <ul className="text-[11px] text-muted-foreground space-y-1">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3 text-success shrink-0" />
                    Servidor dedicado em nuvem
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3 text-success shrink-0" />
                    {planConfig.sessions} sessão(ões) paralela(s) de navegador
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3 text-success shrink-0" />
                    Certificado digital seguro (configurado localmente)
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3 text-success shrink-0" />
                    Monitoramento 24/7 e auto-recuperação
                  </li>
                </ul>
              </div>

              <Button
                onClick={handleAutoProvision}
                disabled={provisioning}
                className="bg-accent hover:bg-accent/90 text-accent-foreground font-bold px-8"
              >
                {provisioning ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Rocket className="w-4 h-4 mr-2" />
                )}
                Ativar Agente Cloud
              </Button>
            </div>
          ) : (
            <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 max-w-sm mx-auto">
              <p className="text-xs text-warning">
                O Robô de Lances em nuvem está disponível a partir do plano <strong>Profissional</strong>.
                Faça upgrade para ativar essa funcionalidade.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {agentes.map((agente) => {
            const maxSess = agente.max_sessoes_paralelas || 3;
            const ativas = agente.sessoes_ativas || 0;
            const usagePercent = Math.min(100, (ativas / maxSess) * 100);

            return (
              <div key={agente.id} className="border border-border/50 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {statusIcon(agente.status)}
                    <div>
                      <p className="text-sm font-medium">{agente.nome}</p>
                      {agente.versao_agente && (
                        <p className="text-[10px] text-muted-foreground">v{agente.versao_agente}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {agente.ultimo_heartbeat && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(agente.ultimo_heartbeat).toLocaleTimeString('pt-BR')}
                      </span>
                    )}
                    <Badge variant="outline" className={statusBadge(agente.status)}>
                      {agente.status}
                    </Badge>
                  </div>
                </div>

                {/* Capacidade de sessões paralelas */}
                <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Layers className="w-3.5 h-3.5" />
                      Sessões Paralelas
                    </span>
                    <span className="font-medium">
                      {ativas} / {maxSess} ativas
                    </span>
                  </div>
                  <Progress value={usagePercent} className="h-1.5" />
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Cpu className="w-3 h-3" />
                      {maxSess - ativas} slot{maxSess - ativas !== 1 ? 's' : ''} disponíve{maxSess - ativas !== 1 ? 'is' : 'l'}
                    </span>
                    {agente.ram_mb && (
                      <span className="flex items-center gap-1">
                        <HardDrive className="w-3 h-3" />
                        {agente.ram_mb}MB RAM
                      </span>
                    )}
                  </div>
                </div>

                {/* Gerenciado pela plataforma badge */}
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <ShieldCheck className="w-3.5 h-3.5 text-success" />
                  <span>Gerenciado automaticamente pela plataforma — sem configuração técnica necessária</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
