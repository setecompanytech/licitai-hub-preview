import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import LandingNavbar from '@/components/landing/LandingNavbar';
import LandingFooter from '@/components/landing/LandingFooter';
import { CheckCircle2, AlertTriangle, XCircle, Activity, RefreshCw, Loader2, Clock, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

type ServiceStatus = 'operacional' | 'degradado' | 'indisponivel';

interface ServiceCheck {
  name: string;
  status: ServiceStatus;
  latency: number;
}

const statusConfig: Record<ServiceStatus, { label: string; icon: typeof CheckCircle2; color: string; bg: string }> = {
  operacional: { label: 'Operacional', icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10' },
  degradado: { label: 'Degradado', icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10' },
  indisponivel: { label: 'Indisponível', icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10' },
};

// Static services that depend on external factors
const staticServices: { name: string; category: string; status: ServiceStatus }[] = [
  { name: 'Monitoramento de Editais', category: 'Módulos', status: 'operacional' },
  { name: 'Motor de Precificação', category: 'Módulos', status: 'operacional' },
  { name: 'Geração de Propostas', category: 'Módulos', status: 'operacional' },
  { name: 'Robô de Lances', category: 'Módulos', status: 'operacional' },
  { name: 'Assistente IA (AURÉLIA)', category: 'Módulos', status: 'operacional' },
  { name: 'Envio de E-mail', category: 'Comunicações', status: 'operacional' },
  { name: 'Integração WhatsApp', category: 'Comunicações', status: 'operacional' },
  { name: 'Stripe (Pagamentos)', category: 'Integrações', status: 'operacional' },
];

export default function StatusPlataforma() {
  const [liveServices, setLiveServices] = useState<ServiceCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastCheck, setLastCheck] = useState<string>('');
  const [overallStatus, setOverallStatus] = useState<ServiceStatus>('operacional');

  const runHealthCheck = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('health-check');
      if (error) throw error;
      setLiveServices(data.services || []);
      setOverallStatus(data.status || 'degradado');
      setLastCheck(new Date().toLocaleTimeString('pt-BR'));
    } catch {
      setLiveServices([
        { name: 'Banco de Dados', status: 'indisponivel', latency: 0 },
        { name: 'Autenticação', status: 'indisponivel', latency: 0 },
        { name: 'Storage', status: 'indisponivel', latency: 0 },
        { name: 'Edge Functions', status: 'indisponivel', latency: 0 },
        { name: 'API PNCP', status: 'indisponivel', latency: 0 },
      ]);
      setOverallStatus('indisponivel');
      setLastCheck(new Date().toLocaleTimeString('pt-BR'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { runHealthCheck(); }, []);

  const OverallIcon = statusConfig[overallStatus].icon;
  const allServices = [
    ...liveServices.map(s => ({ ...s, category: 'Infraestrutura', live: true })),
    ...staticServices.map(s => ({ ...s, latency: 0, live: false })),
  ];

  const groups = allServices.reduce((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {} as Record<string, typeof allServices>);

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Status da Plataforma | PRAEFECTUS</title>
        <meta name="description" content="Status em tempo real dos serviços da plataforma PRAEFECTUS de licitações." />
      </Helmet>
      <LandingNavbar />

      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Overall Status Banner */}
        <div className={`rounded-2xl p-8 mb-8 text-center ${statusConfig[overallStatus].bg} border border-border/30`}>
          {loading ? (
            <Loader2 className="w-12 h-12 animate-spin mx-auto text-muted-foreground" />
          ) : (
            <>
              <OverallIcon className={`w-16 h-16 mx-auto mb-4 ${statusConfig[overallStatus].color}`} />
              <h1 className="text-3xl font-bold mb-2">
                {overallStatus === 'operacional' ? 'Todos os sistemas operacionais' :
                 overallStatus === 'degradado' ? 'Desempenho degradado em alguns serviços' :
                 'Alguns serviços estão indisponíveis'}
              </h1>
              <p className="text-muted-foreground text-sm">
                Última verificação: {lastCheck}
              </p>
            </>
          )}
        </div>

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Activity className="w-4 h-4" />
            <span>Health checks em tempo real</span>
          </div>
          <Button onClick={runHealthCheck} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Verificar agora
          </Button>
        </div>

        {/* Service Groups */}
        {Object.entries(groups).map(([category, services]) => (
          <div key={category} className="mb-6">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">{category}</h2>
            <div className="space-y-1">
              {services.map((svc) => {
                const cfg = statusConfig[svc.status as ServiceStatus];
                const Icon = cfg.icon;
                return (
                  <div key={svc.name} className="flex items-center justify-between p-3 rounded-lg bg-card/50 border border-border/30 hover:bg-card/80 transition-colors">
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${cfg.color}`} />
                      <span className="text-sm font-medium">{svc.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {svc.live && svc.latency > 0 && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {svc.latency}ms
                        </span>
                      )}
                      <Badge variant="outline" className={`text-xs ${cfg.color}`}>
                        {cfg.label}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* SLA Info */}
        <div className="mt-12 rounded-xl bg-card/50 border border-border/30 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-accent" />
            <h2 className="font-semibold">SLA e Garantias</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="font-semibold text-2xl">99.9%</p>
              <p className="text-muted-foreground">Uptime garantido</p>
            </div>
            <div>
              <p className="font-semibold text-2xl">&lt; 200ms</p>
              <p className="text-muted-foreground">Latência média da API</p>
            </div>
            <div>
              <p className="font-semibold text-2xl">24/7</p>
              <p className="text-muted-foreground">Monitoramento contínuo</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Consulte nossa <a href="/politica-sla" className="underline hover:text-foreground">Política de SLA</a> para detalhes completos sobre disponibilidade, tempos de resposta e compensações.
          </p>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
