import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Bot, Play, Pause, Settings, Globe, Clock, TrendingDown,
  AlertTriangle, CheckCircle2, ExternalLink, RefreshCw
} from 'lucide-react';
import CredenciaisPortalForm from '@/components/robo-lances/CredenciaisPortalForm';

const portais = [
  { id: 'pncp', nome: 'PNCP', url: 'https://www.gov.br/pncp/pt-br', status: 'conectado', sessoes: 3 },
  { id: 'compras-gov', nome: 'Compras Governamentais', url: 'https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/public/landing', status: 'conectado', sessoes: 2 },
  { id: 'bll', nome: 'BLL Compras', url: 'https://bllcompras.com', status: 'conectado', sessoes: 1 },
  { id: 'licitanet', nome: 'Licitanet', url: 'https://www.licitanet.com.br', status: 'conectado', sessoes: 2 },
  { id: 'licitacoes-e', nome: 'Licitações-e (BB)', url: 'https://licitacoes-e2.bb.com.br/aop-inter-estatico/', status: 'conectado', sessoes: 4 },
  { id: 'portal-compras', nome: 'Portal de Compras Públicas', url: 'https://www.portaldecompraspublicas.com.br', status: 'conectado', sessoes: 1 },
  { id: 'tcmpa', nome: 'TCM-PA', url: 'https://www.tcm.pa.gov.br', status: 'conectado', sessoes: 1 },
];

type Lance = {
  id: string;
  edital: string;
  portal: string;
  valorAtual: number;
  meuLance: number;
  status: 'aguardando' | 'ativo' | 'vencendo' | 'perdendo' | 'encerrado';
  horario: string;
  decrementoMin: number;
};

const lancesAtivos: Lance[] = [
  { id: '1', edital: 'PE-001/2026', portal: 'PNCP', valorAtual: 4500000, meuLance: 4200000, status: 'vencendo', horario: '14:30', decrementoMin: 50000 },
  { id: '2', edital: 'PE-012/2026', portal: 'Compras.gov.br', valorAtual: 890000, meuLance: 870000, status: 'ativo', horario: '15:00', decrementoMin: 10000 },
  { id: '3', edital: 'CC-003/2026', portal: 'BLL Compras', valorAtual: 2300000, meuLance: 2250000, status: 'perdendo', horario: '15:30', decrementoMin: 25000 },
  { id: '4', edital: 'PE-045/2026', portal: 'Licitações-e (BB)', valorAtual: 1200000, meuLance: 0, status: 'aguardando', horario: '16:00', decrementoMin: 15000 },
  { id: '5', edital: 'PE-078/2026', portal: 'PNCP', valorAtual: 560000, meuLance: 540000, status: 'encerrado', horario: '13:00', decrementoMin: 5000 },
];

const statusColors: Record<string, string> = {
  vencendo: 'bg-success/15 text-success border-success/30',
  ativo: 'bg-info/15 text-info border-info/30',
  perdendo: 'bg-warning/15 text-warning border-warning/30',
  aguardando: 'bg-muted text-muted-foreground border-border',
  encerrado: 'bg-secondary text-secondary-foreground border-border',
};

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function RoboLances() {
  const [autoMode, setAutoMode] = useState(true);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Bot className="w-6 h-6 text-accent" />
              Robô de Lances
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Automação integrada com todos os portais de licitação
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-card rounded-lg border border-border/50 px-4 py-2">
              <span className="text-sm font-medium">Modo Automático</span>
              <Switch checked={autoMode} onCheckedChange={setAutoMode} />
            </div>
            <Button variant="outline" size="sm">
              <Settings className="w-4 h-4 mr-1" /> Configurar Regras
            </Button>
          </div>
        </div>

        <Tabs defaultValue="lances" className="space-y-4">
          <TabsList>
            <TabsTrigger value="lances">Lances Ativos</TabsTrigger>
            <TabsTrigger value="portais">Portais Conectados</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
            <TabsTrigger value="regras">Regras de Lance</TabsTrigger>
          </TabsList>

          {/* Lances Ativos */}
          <TabsContent value="lances" className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Sessões Ativas', value: '5', icon: Play, color: 'text-success' },
                { label: 'Vencendo', value: '1', icon: CheckCircle2, color: 'text-success' },
                { label: 'Perdendo', value: '1', icon: AlertTriangle, color: 'text-warning' },
                { label: 'Economia Média', value: '-6.7%', icon: TrendingDown, color: 'text-accent' },
              ].map((s) => (
                <div key={s.label} className="stat-card">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">{s.label}</span>
                    <s.icon className={`w-4 h-4 ${s.color}`} />
                  </div>
                  <p className="text-2xl font-bold">{s.value}</p>
                </div>
              ))}
            </div>

            {/* Lance cards */}
            <div className="space-y-3">
              {lancesAtivos.map((lance) => (
                <div
                  key={lance.id}
                  className="bg-card rounded-xl border border-border/50 p-4 shadow-sm flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <Badge variant="outline" className={statusColors[lance.status]}>
                      {lance.status.charAt(0).toUpperCase() + lance.status.slice(1)}
                    </Badge>
                    <div>
                      <p className="font-semibold text-sm">{lance.edital}</p>
                      <p className="text-xs text-muted-foreground">{lance.portal}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Valor Atual</p>
                      <p className="text-sm font-semibold">{formatCurrency(lance.valorAtual)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Meu Lance</p>
                      <p className="text-sm font-semibold text-accent">
                        {lance.meuLance > 0 ? formatCurrency(lance.meuLance) : '—'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Decremento Mín.</p>
                      <p className="text-sm">{formatCurrency(lance.decrementoMin)}</p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {lance.horario}
                    </div>
                    <div className="flex gap-2">
                      {lance.status !== 'encerrado' && (
                        <>
                          <Button size="sm" variant="outline">
                            <TrendingDown className="w-3 h-3 mr-1" /> Dar Lance
                          </Button>
                          <Button size="sm" variant="ghost">
                            <Pause className="w-3 h-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Portais */}
          <TabsContent value="portais" className="space-y-6">
            <CredenciaisPortalForm />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {portais.map((portal) => (
                <div key={portal.id} className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Globe className="w-5 h-5 text-accent" />
                      <h3 className="font-semibold text-sm">{portal.nome}</h3>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        portal.status === 'conectado'
                          ? 'bg-success/15 text-success border-success/30'
                          : 'bg-destructive/15 text-destructive border-destructive/30'
                      }
                    >
                      {portal.status === 'conectado' ? 'Conectado' : 'Desconectado'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">{portal.url}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{portal.sessoes} sessões ativas</span>
                    <div className="flex gap-2">
                      {portal.status === 'conectado' ? (
                        <>
                          <Button size="sm" variant="ghost">
                            <RefreshCw className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant="outline">
                            <ExternalLink className="w-3 h-3 mr-1" /> Acessar
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground">
                          Conectar
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Histórico */}
          <TabsContent value="historico">
            <div className="bg-card rounded-xl border border-border/50 p-6 shadow-sm">
              <p className="text-sm text-muted-foreground text-center py-8">
                Histórico de lances e resultados será exibido aqui após conectar ao backend.
              </p>
            </div>
          </TabsContent>

          {/* Regras */}
          <TabsContent value="regras" className="space-y-4">
            <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-semibold">Regras de Lance Automático</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground">Decremento padrão (%)</label>
                  <Input defaultValue="1.5" className="mt-1" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Lance mínimo (% do estimado)</label>
                  <Input defaultValue="85" className="mt-1" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Intervalo entre lances (seg)</label>
                  <Input defaultValue="30" className="mt-1" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Máx. lances por sessão</label>
                  <Input defaultValue="20" className="mt-1" />
                </div>
              </div>
              <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">
                Salvar Regras
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
