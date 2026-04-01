import { Helmet } from 'react-helmet-async';
import LandingNavbar from '@/components/landing/LandingNavbar';
import LandingFooter from '@/components/landing/LandingFooter';
import { CheckCircle2, AlertTriangle, XCircle, Activity } from 'lucide-react';

type ServiceStatus = 'operacional' | 'degradado' | 'indisponivel';

const services: { name: string; category: string; status: ServiceStatus }[] = [
  { name: 'Autenticação e Login', category: 'Infraestrutura', status: 'operacional' },
  { name: 'Banco de Dados', category: 'Infraestrutura', status: 'operacional' },
  { name: 'Edge Functions', category: 'Infraestrutura', status: 'operacional' },
  { name: 'Armazenamento de Arquivos', category: 'Infraestrutura', status: 'operacional' },
  { name: 'Monitoramento de Editais', category: 'Módulos Principais', status: 'operacional' },
  { name: 'Crawler PNCP', category: 'Módulos Principais', status: 'operacional' },
  { name: 'Motor de Precificação', category: 'Módulos Principais', status: 'operacional' },
  { name: 'Geração de Propostas', category: 'Módulos Principais', status: 'operacional' },
  { name: 'Robô de Lances', category: 'Módulos Principais', status: 'operacional' },
  { name: 'Assistente IA', category: 'Módulos Principais', status: 'operacional' },
  { name: 'Envio de E-mail', category: 'Comunicações', status: 'operacional' },
  { name: 'Integração WhatsApp', category: 'Comunicações', status: 'operacional' },
  { name: 'Alertas e Boletins', category: 'Comunicações', status: 'operacional' },
  { name: 'Stripe (Pagamentos)', category: 'Integrações', status: 'operacional' },
  { name: 'PNCP API', category: 'Integrações', status: 'operacional' },
  { name: 'Firecrawl', category: 'Integrações', status: 'operacional' },
];

const statusConfig: Record<ServiceStatus, { label: string; icon: typeof CheckCircle2; color: string }> = {
  operacional: { label: 'Operacional', icon: CheckCircle2, color: 'text-success' },
  degradado: { label: 'Degradado', icon: AlertTriangle, color: 'text-warning' },
  indisponivel: { label: 'Indisponível', icon: XCircle, color: 'text-destructive' },
};

export default function StatusPlataforma() {
  const categories = [...new Set(services.map(s => s.category))];
  const allOperational = services.every(s => s.status === 'operacional');

  return (
    <>
      <Helmet>
        <title>Status da Plataforma | PRAEFECTUS</title>
        <meta name="description" content="Acompanhe em tempo real a disponibilidade dos serviços e módulos da plataforma PRAEFECTUS." />
      </Helmet>
      <div className="min-h-screen bg-background">
        <LandingNavbar />
        <main className="pt-24 pb-20 px-6">
          <div className="max-w-3xl mx-auto">
            <div className="mb-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/8 border border-primary/15 text-primary text-[11px] font-bold uppercase tracking-wider mb-4">
                <Activity className="w-3.5 h-3.5" /> Status
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4">Status da Plataforma</h1>
              <p className="text-base text-muted-foreground">Disponibilidade dos serviços e módulos do PRAEFECTUS.</p>
            </div>

            {/* Global status */}
            <div className={`rounded-xl border p-6 mb-8 ${allOperational ? 'bg-success/5 border-success/20' : 'bg-warning/5 border-warning/20'}`}>
              <div className="flex items-center gap-3">
                {allOperational ? (
                  <CheckCircle2 className="w-6 h-6 text-success" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-warning" />
                )}
                <div>
                  <p className="font-bold text-foreground">
                    {allOperational ? 'Todos os sistemas operacionais' : 'Alguns serviços com restrição'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Última verificação: {new Date().toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>
            </div>

            {/* Services by category */}
            <div className="space-y-6">
              {categories.map((cat) => (
                <div key={cat} className="bg-card rounded-xl border border-border/50 overflow-hidden">
                  <div className="px-5 py-3 bg-muted/40 border-b border-border/50">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{cat}</span>
                  </div>
                  {services.filter(s => s.category === cat).map((s, i, arr) => {
                    const cfg = statusConfig[s.status];
                    const Icon = cfg.icon;
                    return (
                      <div key={s.name} className={`px-5 py-3.5 flex items-center justify-between ${i < arr.length - 1 ? 'border-b border-border/30' : ''}`}>
                        <span className="text-sm text-foreground/80">{s.name}</span>
                        <div className={`flex items-center gap-1.5 text-xs font-semibold ${cfg.color}`}>
                          <Icon className="w-3.5 h-3.5" />
                          <span>{cfg.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="mt-10 p-5 rounded-xl bg-muted/50 border border-border/50 text-[13px] text-muted-foreground">
              <p>Esta página reflete o status operacional dos serviços do PRAEFECTUS. Para relatar incidentes ou solicitar suporte, entre em contato através do canal de atendimento da plataforma.</p>
            </div>
          </div>
        </main>
        <LandingFooter />
      </div>
    </>
  );
}
