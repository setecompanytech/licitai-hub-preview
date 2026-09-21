import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import LandingNavbar from '@/components/landing/LandingNavbar';
import LandingFooter from '@/components/landing/LandingFooter';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import FaixaIndicadores from '@/components/gestao/FaixaIndicadores';
import { CheckCircle2, AlertTriangle, XCircle, Activity, RefreshCw, Clock, Shield, Timer, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';

type ServiceStatus = 'operacional' | 'degradado' | 'indisponivel';

interface ServiceCheck {
  name: string;
  status: ServiceStatus;
  latency: number;
}

/* Estado sempre com TEXTO; a cor vem do trio tinta/tinta-escura/linha de cada
   estado (selo `Badge` semântico, ícone na tinta `-ink`, faixa em `-tint`). */
const statusConfig: Record<
  ServiceStatus,
  { label: string; icon: typeof CheckCircle2; variante: BadgeProps['variant']; tinta: string; faixa: string }
> = {
  operacional: { label: 'Operacional', icon: CheckCircle2, variante: 'success', tinta: 'text-success-ink', faixa: 'border-success-line bg-success-tint' },
  degradado: { label: 'Degradado', icon: AlertTriangle, variante: 'warning', tinta: 'text-warning-ink', faixa: 'border-warning-line bg-warning-tint' },
  indisponivel: { label: 'Indisponível', icon: XCircle, variante: 'danger', tinta: 'text-destructive-ink', faixa: 'border-destructive-line bg-destructive-tint' },
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

      <main className="mx-auto max-w-4xl px-6 pb-20 pt-24">
        {/* Cabeçalho padrão; a verificação manual é a ação da tela. */}
        <CabecalhoPagina
          titulo="Status da Plataforma"
          descricao="Health checks em tempo real"
          icone={<Activity />}
          acoes={
            <Button onClick={runHealthCheck} variant="outline" size="sm" disabled={loading}>
              <RefreshCw className={loading ? 'animate-spin' : undefined} aria-hidden="true" />
              Verificar agora
            </Button>
          }
        />

        {/* Situação geral numa faixa tingida pelo estado — ícone na tinta
            escura, título de seção 18/600, sem capa centralizada. */}
        <div className={`mb-8 flex items-start gap-3 rounded-lg border p-5 ${statusConfig[overallStatus].faixa}`}>
          {loading ? (
            <div role="status" aria-busy="true" className="w-full space-y-2">
              <span className="sr-only">Verificando os serviços</span>
              <Skeleton className="h-6 w-2/3 max-w-sm" />
              <Skeleton className="h-4 w-40" />
            </div>
          ) : (
            <>
              <OverallIcon className={`mt-0.5 h-5 w-5 shrink-0 ${statusConfig[overallStatus].tinta}`} aria-hidden="true" />
              <div className="min-w-0">
                <h2 className={`text-xl font-semibold leading-7 ${statusConfig[overallStatus].tinta}`}>
                  {overallStatus === 'operacional' ? 'Todos os sistemas operacionais' :
                   overallStatus === 'degradado' ? 'Desempenho degradado em alguns serviços' :
                   'Alguns serviços estão indisponíveis'}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Última verificação: {lastCheck}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Service Groups — eyebrow de grupo e uma moldura por grupo com as
            linhas separadas por fio; estado em selo semântico com texto. */}
        {Object.entries(groups).map(([category, services]) => (
          <section key={category} className="mb-6">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{category}</h2>
            <div className="divide-y divide-border rounded-lg border border-border bg-card shadow-sm">
              {services.map((svc) => {
                const cfg = statusConfig[svc.status as ServiceStatus];
                const Icon = cfg.icon;
                return (
                  <div key={svc.name} className="flex items-center justify-between gap-3 px-4 py-3 transition-colors duration-150 hover:bg-muted/60">
                    <div className="flex min-w-0 items-center gap-3">
                      <Icon className={`h-4 w-4 shrink-0 ${cfg.tinta}`} aria-hidden="true" />
                      <span className="truncate text-base font-medium text-foreground">{svc.name}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {svc.live && svc.latency > 0 && (
                        <span className="flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          {svc.latency}ms
                        </span>
                      )}
                      <Badge variant={cfg.variante}>
                        {cfg.label}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {/* SLA Info — os três números na faixa de indicadores do padrão. */}
        <section className="mt-12">
          <div className="mb-3 flex items-center gap-2">
            <Shield className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-xl font-semibold leading-7 text-foreground">SLA e Garantias</h2>
          </div>
          <FaixaIndicadores
            itens={[
              { rotulo: 'Uptime garantido', valor: '99.9%', icone: Shield, tom: 'ok' },
              { rotulo: 'Latência média da API', valor: '< 200ms', icone: Timer, tom: 'info' },
              { rotulo: 'Monitoramento contínuo', valor: '24/7', icone: Eye, tom: 'neutro' },
            ]}
          />
          <p className="mt-4 text-xs text-muted-foreground">
            Consulte nossa <a href="/politica-sla" className="underline underline-offset-4 hover:text-foreground">Política de SLA</a> para detalhes completos sobre disponibilidade, tempos de resposta e compensações.
          </p>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
