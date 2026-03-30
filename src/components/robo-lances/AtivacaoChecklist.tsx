import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle2, Circle, AlertTriangle, Server, Key, Shield, 
  FileCheck, Rocket, Loader2, Download, ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';

type CheckItem = {
  id: string;
  label: string;
  descricao: string;
  status: 'pendente' | 'ok' | 'erro' | 'verificando';
  icon: typeof Server;
  acao?: () => void;
  acaoLabel?: string;
};

export default function AtivacaoChecklist() {
  const { user } = useAuth();
  const [items, setItems] = useState<CheckItem[]>([]);
  const [checking, setChecking] = useState(false);

  const verificarStatus = async () => {
    if (!user) return;
    setChecking(true);

    const newItems: CheckItem[] = [];

    // 1. Verificar agente configurado
    const { data: agentes } = await supabase
      .from('agente_externo_config')
      .select('*')
      .eq('user_id', user.id);

    const agenteAtivo = agentes?.find(a => a.status === 'ativo');
    const agenteConfigurado = agentes && agentes.length > 0;

    newItems.push({
      id: 'agente',
      label: 'Agente Externo Configurado',
      descricao: agenteAtivo
        ? `Conectado: ${agenteAtivo.url_base} (v${agenteAtivo.versao_agente || '?'})`
        : agenteConfigurado
        ? `Configurado mas offline (${agentes[0].status})`
        : 'Configure o servidor VPS com o agente de automação',
      status: agenteAtivo ? 'ok' : agenteConfigurado ? 'erro' : 'pendente',
      icon: Server,
    });

    // 2. Verificar healthcheck do agente
    if (agenteAtivo) {
      const heartbeatRecente = agenteAtivo.ultimo_heartbeat &&
        (Date.now() - new Date(agenteAtivo.ultimo_heartbeat).getTime()) < 120000;

      newItems.push({
        id: 'heartbeat',
        label: 'Heartbeat Ativo',
        descricao: heartbeatRecente
          ? `Último sinal: ${new Date(agenteAtivo.ultimo_heartbeat!).toLocaleString('pt-BR')}`
          : 'O agente não envia sinal de vida há mais de 2 minutos',
        status: heartbeatRecente ? 'ok' : 'erro',
        icon: Shield,
      });

      // 3. Verificar capacidade
      const slotsLivres = (agenteAtivo.max_sessoes_paralelas || 3) - (agenteAtivo.sessoes_ativas || 0);
      newItems.push({
        id: 'capacidade',
        label: 'Slots Disponíveis',
        descricao: `${slotsLivres} de ${agenteAtivo.max_sessoes_paralelas} slots livres | ${agenteAtivo.ram_mb || '?'}MB RAM`,
        status: slotsLivres > 0 ? 'ok' : 'erro',
        icon: Rocket,
      });
    }

    // 4. Verificar credenciais de portal
    const { data: credenciais } = await supabase
      .from('credenciais_portal' as any)
      .select('*')
      .eq('user_id', user.id);

    const temCredencial = credenciais && credenciais.length > 0;
    newItems.push({
      id: 'credenciais',
      label: 'Credenciais de Portal',
      descricao: temCredencial
        ? `${credenciais.length} portal(is) configurado(s)`
        : 'Configure credenciais para pelo menos um portal de licitação',
      status: temCredencial ? 'ok' : 'pendente',
      icon: Key,
    });

    // 5. Verificar healthcheck dos portais
    const { data: healthchecks } = await supabase
      .from('portal_healthcheck' as any)
      .select('*')
      .eq('status', 'ok');

    const portaisOk = healthchecks?.length || 0;
    newItems.push({
      id: 'portais',
      label: 'Portais Operacionais',
      descricao: portaisOk > 0
        ? `${portaisOk} portal(is) verificado(s) e operacional(is)`
        : 'Execute o healthcheck para verificar a disponibilidade dos portais',
      status: portaisOk > 0 ? 'ok' : 'pendente',
      icon: FileCheck,
    });

    setItems(newItems);
    setChecking(false);
  };

  useEffect(() => {
    verificarStatus();
  }, [user]);

  const okCount = items.filter(i => i.status === 'ok').length;
  const total = items.length;
  const progress = total > 0 ? (okCount / total) * 100 : 0;
  const pronto = okCount === total && total > 0;

  const statusIcon = (status: string) => {
    switch (status) {
      case 'ok': return <CheckCircle2 className="w-4 h-4 text-success shrink-0" />;
      case 'erro': return <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />;
      case 'verificando': return <Loader2 className="w-4 h-4 animate-spin text-warning shrink-0" />;
      default: return <Circle className="w-4 h-4 text-muted-foreground shrink-0" />;
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Rocket className="w-4 h-4 text-accent" />
          Checklist de Ativação — Robô de Lances
        </h3>
        <div className="flex items-center gap-2">
          {pronto ? (
            <Badge className="bg-success/15 text-success border-success/30 text-[10px]">
              ✅ Pronto
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">
              {okCount}/{total} etapas
            </Badge>
          )}
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7 gap-1"
            onClick={verificarStatus}
            disabled={checking}
          >
            {checking ? <Loader2 className="w-3 h-3 animate-spin" /> : <Shield className="w-3 h-3" />}
            Reverificar
          </Button>
        </div>
      </div>

      <Progress value={progress} className="h-2" />

      <div className="space-y-2">
        {items.map(item => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              className={`flex items-start gap-3 rounded-lg border p-3 ${
                item.status === 'ok'
                  ? 'border-success/20 bg-success/5'
                  : item.status === 'erro'
                  ? 'border-destructive/20 bg-destructive/5'
                  : 'border-border/50 bg-muted/10'
              }`}
            >
              {statusIcon(item.status)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                  <p className="text-xs font-semibold">{item.label}</p>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">{item.descricao}</p>
              </div>
              {item.acao && (
                <Button size="sm" variant="outline" className="text-[10px] h-6" onClick={item.acao}>
                  {item.acaoLabel || 'Configurar'}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {pronto && (
        <div className="bg-success/10 border border-success/20 rounded-lg p-3 text-center">
          <p className="text-xs text-success font-semibold">
            🚀 Sistema pronto para disputas reais! O robô pode participar de licitações no Compras.gov e outros portais.
          </p>
        </div>
      )}
    </div>
  );
}
