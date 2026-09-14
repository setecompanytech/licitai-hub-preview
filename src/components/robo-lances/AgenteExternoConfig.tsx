import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useMembroPermissoes } from '@/hooks/useMembroPermissoes';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  Server, WifiOff, Loader2, CheckCircle2, XCircle, Clock,
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
// A chave do agente gerenciado NÃO mora mais aqui. Até 14/09/2026 ela era uma
// constante deste arquivo — ou seja, ia no JavaScript público servido a
// qualquer visitante, e é a mesma chave que o servidor confere nos callbacks
// do agente. Agora ela é o segredo `AGENTE_API_KEY` da edge function
// `robo-lances-webhook`, e o navegador nunca a vê: nem manda, nem recebe.
//
// A chave antiga ficou no histórico do git e deve ser tratada como vazada:
// trocá-la exige o `.env` da VPS e o segredo da função, fora do app.

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'muted';

export default function AgenteExternoConfig() {
  const { user, subscription } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const { isAdmin } = useMembroPermissoes();
  const [agentes, setAgentes] = useState<AgenteConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [provisioning, setProvisioning] = useState(false);
  const [certLinkLoading, setCertLinkLoading] = useState(false);
  const [certUploadUrl, setCertUploadUrl] = useState<string | null>(null);

  const planSlug = isAdmin ? 'enterprise' : subscription.planSlug;
  const planConfig = planSlug ? PLAN_SESSION_LIMITS[planSlug] : null;

  useEffect(() => {
    if (!user) return;
    supabase
      .from('agente_externo_config')
      // Colunas explícitas, sem `api_key_hash`: a migration 20260914000003 tira
      // o SELECT dessa coluna do navegador, e `*` passaria a falhar.
      .select('id, nome, url_base, status, ultimo_heartbeat, versao_agente, capacidades, max_sessoes_paralelas, sessoes_ativas, ram_mb')
      .eq('user_id', user.id)
      .then(({ data, error }) => {
        // Falha de leitura não pode parecer "nenhum agente": a tela ofereceria
        // ativar de novo algo que já existe.
        if (error) toast.error(`Não foi possível ler a configuração do agente: ${error.message}`);
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
          // Sem `api_key`: para o agente gerenciado, o servidor usa o próprio
          // segredo e ignora qualquer chave vinda daqui.
          max_sessoes_paralelas: planConfig.sessions,
        },
      });

      if (resp.error) {
        // A causa vem no corpo (`context`) — inclusive o 503 de "chave do
        // serviço não configurada", que precisa chegar à pessoa como está.
        let detalhe = resp.error.message;
        try {
          const corpo = await (resp.error as { context?: Response }).context?.json();
          if (corpo?.error) detalhe = corpo.error;
        } catch {
          /* fica a mensagem original */
        }
        throw new Error(detalhe);
      }
      const result = resp.data as { success: boolean; agente: AgenteConfig; error?: string };
      if (!result.success) throw new Error(result.error || 'Erro ao provisionar');

      toast.success('Agente configurado automaticamente! ✅');
      setAgentes((prev) => {
        const exists = prev.find((a) => a.id === result.agente.id);
        if (exists) return prev.map((a) => (a.id === result.agente.id ? result.agente : a));
        return [...prev, result.agente];
      });

      // Auto-generate certificate upload link for Enterprise
      if (empresaAtiva?.id) {
        await handleGerarLinkCertificado();
      }
    } catch (e) {
      toast.error((e as Error).message || 'Erro ao provisionar agente');
    } finally {
      setProvisioning(false);
    }
  };

  const handleGerarLinkCertificado = async () => {
    if (!empresaAtiva?.id) {
      toast.error('Selecione uma empresa antes de gerar o link.');
      return;
    }
    setCertLinkLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('gerar-link-certificado', {
        body: { empresa_id: empresaAtiva.id },
      });
      if (error) throw error;
      if (data?.upload_url) {
        setCertUploadUrl(data.upload_url);
        toast.success('Link de upload gerado! Você receberá por e-mail e WhatsApp.');
      }
    } catch (err) {
      toast.error((err as Error).message || 'Erro ao gerar link de upload');
    } finally {
      setCertLinkLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (certUploadUrl) {
      navigator.clipboard.writeText(certUploadUrl);
      toast.success('Link copiado para a área de transferência!');
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'ativo': return <CheckCircle2 className="w-4 h-4 text-success" aria-hidden="true" />;
      case 'offline': return <WifiOff className="w-4 h-4 text-destructive" aria-hidden="true" />;
      case 'verificando': return <Loader2 className="w-4 h-4 animate-spin text-warning" aria-hidden="true" />;
      default: return <XCircle className="w-4 h-4 text-muted-foreground" aria-hidden="true" />;
    }
  };

  const statusBadge = (status: string): BadgeVariant => {
    const map: Record<string, BadgeVariant> = {
      ativo: 'success',
      offline: 'danger',
      verificando: 'warning',
      inativo: 'muted',
      erro: 'danger',
    };
    return map[status] || map.inativo;
  };

  /** O selo do agente sai com inicial maiúscula, como os demais da tela. */
  const rotuloStatus = (status: string) => status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Server className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
          Agente Cloud de Lances
        </h3>
        {planConfig && (
          <Badge variant="muted" className="gap-1">
            <ShieldCheck className="w-3 h-3" aria-hidden="true" />
            Plano {planConfig.label} — até {planConfig.sessions} sessão(ões)
          </Badge>
        )}
      </div>

      {loading ? (
        <div className="space-y-3" role="status" aria-busy="true">
          <span className="sr-only">Carregando agente</span>
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
      ) : agentes.length === 0 ? (
        <div className="text-center py-8 space-y-4">
          <div className="w-14 h-14 rounded-full bg-primary-tint text-primary flex items-center justify-center mx-auto">
            <Rocket className="w-7 h-7" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <p className="text-lg font-semibold text-foreground">
              Ative seu Agente Cloud com um clique
            </p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              O sistema configura automaticamente o servidor de automação de acordo com seu plano.
              Sem necessidade de configuração técnica — tudo é gerenciado pela plataforma.
            </p>
          </div>

          {planConfig ? (
            <div className="space-y-3">
              <div className="bg-muted rounded-lg p-4 max-w-sm mx-auto text-left space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  O que será configurado:
                </p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-success shrink-0" aria-hidden="true" />
                    Servidor dedicado em nuvem
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-success shrink-0" aria-hidden="true" />
                    {planConfig.sessions} sessão(ões) paralela(s) de navegador
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-success shrink-0" aria-hidden="true" />
                    Certificado digital seguro (configurado localmente)
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-success shrink-0" aria-hidden="true" />
                    Monitoramento 24/7 e auto-recuperação
                  </li>
                </ul>
              </div>

              <Button
                onClick={handleAutoProvision}
                disabled={provisioning}
                className="px-8"
              >
                {provisioning ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Rocket className="w-4 h-4" aria-hidden="true" />
                )}
                Ativar Agente Cloud
              </Button>
            </div>
          ) : (
            <div className="bg-warning-tint border border-warning-line rounded-lg p-4 max-w-sm mx-auto">
              <p className="text-sm text-warning-ink">
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
              <div key={agente.id} className="border border-border rounded-lg p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    {statusIcon(agente.status)}
                    <div>
                      <p className="text-base font-medium">{agente.nome}</p>
                      {agente.versao_agente && (
                        <p className="text-xs text-muted-foreground">v{agente.versao_agente}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {agente.ultimo_heartbeat && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" aria-hidden="true" />
                        {new Date(agente.ultimo_heartbeat).toLocaleTimeString('pt-BR')}
                      </span>
                    )}
                    <Badge variant={statusBadge(agente.status)}>
                      {rotuloStatus(agente.status)}
                    </Badge>
                  </div>
                </div>

                {/* Capacidade de sessões paralelas */}
                <div className="bg-muted rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Layers className="w-4 h-4" aria-hidden="true" />
                      Sessões Paralelas
                    </span>
                    <span className="font-medium tabular-nums">
                      {ativas} / {maxSess} ativas
                    </span>
                  </div>
                  <Progress value={usagePercent} className="h-2" />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Cpu className="w-3 h-3" aria-hidden="true" />
                      {maxSess - ativas} slot{maxSess - ativas !== 1 ? 's' : ''} disponíve{maxSess - ativas !== 1 ? 'is' : 'l'}
                    </span>
                    {agente.ram_mb && (
                      <span className="flex items-center gap-1">
                        <HardDrive className="w-3 h-3" aria-hidden="true" />
                        {agente.ram_mb}MB RAM
                      </span>
                    )}
                  </div>
                </div>

                {/* Gerenciado pela plataforma badge */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ShieldCheck className="w-4 h-4 text-success shrink-0" aria-hidden="true" />
                  <span>Gerenciado automaticamente pela plataforma — sem configuração técnica necessária</span>
                </div>
              </div>
            );
          })}

          {/* Certificate Upload Section */}
          <div className="border border-border rounded-lg p-4 space-y-3 bg-muted">
            <div className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <h4 className="text-base font-semibold">Certificado Digital</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              Gere um link seguro e temporário (24h) para enviar seu certificado digital (.pfx).
              O link será enviado também por <strong>e-mail</strong> e <strong>WhatsApp</strong>.
            </p>

            {certUploadUrl ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 bg-card border border-border rounded-md p-2">
                  <Link2 className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
                  <span className="text-sm text-foreground truncate flex-1">{certUploadUrl}</span>
                  <Button size="icon" variant="ghost" className="shrink-0" onClick={handleCopyLink} aria-label="Copiar link">
                    <Copy className="w-4 h-4" aria-hidden="true" />
                  </Button>
                </div>
                <div className="flex items-center gap-2 text-sm text-success-ink">
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  <span>Link enviado por e-mail e WhatsApp. Válido por 24 horas.</span>
                </div>
                <Button
                  variant="outline"
                  onClick={handleGerarLinkCertificado}
                  disabled={certLinkLoading}
                >
                  {certLinkLoading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="w-4 h-4" aria-hidden="true" />}
                  Gerar novo link
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleGerarLinkCertificado}
                disabled={certLinkLoading || !empresaAtiva?.id}
              >
                {certLinkLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                )}
                Gerar Link de Upload Seguro
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
