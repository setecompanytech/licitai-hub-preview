import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Bot, Play, Pause, Settings, Globe, Clock, TrendingDown,
  AlertTriangle, CheckCircle2, ExternalLink, RefreshCw, Trash2, Edit2, Eye
} from 'lucide-react';
import CredenciaisPortalForm from '@/components/robo-lances/CredenciaisPortalForm';
import ConfigurarLanceDialog, { type LanceConfig } from '@/components/robo-lances/ConfigurarLanceDialog';
import GuiaPassoAPasso from '@/components/robo-lances/GuiaPassoAPasso';
import DeteccaoPortais from '@/components/robo-lances/DeteccaoPortais';
import SimulacaoDisputa from '@/components/robo-lances/SimulacaoDisputa';
import AgenteExternoConfig from '@/components/robo-lances/AgenteExternoConfig';
import { toast } from 'sonner';

const portais = [
  { id: 'pncp', nome: 'PNCP', url: 'https://www.gov.br/pncp/pt-br', status: 'conectado', sessoes: 3 },
  { id: 'compras-gov', nome: 'Compras Governamentais', url: 'https://www.gov.br/compras/pt-br', status: 'conectado', sessoes: 2 },
  { id: 'bll', nome: 'BLL Compras', url: 'https://bllcompras.com', status: 'conectado', sessoes: 1 },
  { id: 'licitanet', nome: 'Licitanet', url: 'https://www.licitanet.com.br', status: 'conectado', sessoes: 2 },
  { id: 'licitacoes-e', nome: 'Licitações-e (BB)', url: 'https://licitacoes-e2.bb.com.br/aop-inter-estatico/', status: 'conectado', sessoes: 4 },
  { id: 'portal-compras', nome: 'Portal de Compras Públicas', url: 'https://www.portaldecompraspublicas.com.br', status: 'conectado', sessoes: 1 },
  { id: 'bnc', nome: 'Bolsa Nacional de Compras', url: 'https://bnc.org.br/', status: 'conectado', sessoes: 1 },
  { id: 'banparanet', nome: 'Banparanet (PA)', url: 'https://cotacao.banpara.b.br/portal/Mural.aspx', status: 'conectado', sessoes: 1 },
  { id: 'bec-sp', nome: 'BEC/SP', url: 'https://www.bec.sp.gov.br/BECSP/Home/Home.aspx', status: 'conectado', sessoes: 1 },
  { id: 'compras-rj', nome: 'Compras Públicas RJ', url: 'https://www.compras.rj.gov.br/', status: 'conectado', sessoes: 1 },
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
  const [lances, setLances] = useState<LanceConfig[]>([]);
  const [selectedLance, setSelectedLance] = useState<LanceConfig | null>(null);
  const [detailLance, setDetailLance] = useState<LanceConfig | null>(null);

  const handleSaveLance = (lance: LanceConfig) => {
    setLances((prev) => {
      const exists = prev.find((l) => l.id === lance.id);
      if (exists) {
        toast.success('Sessão de lance atualizada!');
        return prev.map((l) => (l.id === lance.id ? lance : l));
      }
      toast.success('Nova sessão de lance cadastrada!');
      return [...prev, lance];
    });
    setSelectedLance(null);
  };

  const handleDelete = (id: string) => {
    setLances((prev) => prev.filter((l) => l.id !== id));
    toast.info('Sessão removida.');
  };

  const handleToggleStatus = (id: string) => {
    setLances((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        if (l.status === 'aguardando') return { ...l, status: 'ativo' as const };
        if (l.status === 'ativo' || l.status === 'vencendo' || l.status === 'perdendo')
          return { ...l, status: 'aguardando' as const };
        return l;
      })
    );
  };

  const activeLances = lances.filter((l) => l.status !== 'encerrado');
  const winning = lances.filter((l) => l.status === 'vencendo').length;
  const losing = lances.filter((l) => l.status === 'perdendo').length;

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
            <ConfigurarLanceDialog onSave={handleSaveLance} />
          </div>
        </div>

        {/* Guia passo-a-passo */}
        <GuiaPassoAPasso />

        {/* Detecção de portais */}
        <DeteccaoPortais />

        <Tabs defaultValue="lances" className="space-y-4">
          <TabsList>
            <TabsTrigger value="lances">Lances Ativos</TabsTrigger>
            <TabsTrigger value="portais">Portais Conectados</TabsTrigger>
            <TabsTrigger value="agente">Agente Externo</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
            <TabsTrigger value="regras">Regras de Lance</TabsTrigger>
          </TabsList>

          {/* Lances Ativos */}
          <TabsContent value="lances" className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Sessões Cadastradas', value: String(lances.length), icon: Play, color: 'text-success' },
                { label: 'Vencendo', value: String(winning), icon: CheckCircle2, color: 'text-success' },
                { label: 'Perdendo', value: String(losing), icon: AlertTriangle, color: 'text-warning' },
                { label: 'Modo', value: autoMode ? 'Automático' : 'Manual', icon: Bot, color: 'text-accent' },
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

            {/* Empty state */}
            {lances.length === 0 && (
              <div className="bg-card rounded-xl border border-border/50 p-10 shadow-sm text-center space-y-3">
                <Bot className="w-10 h-10 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma sessão de lance cadastrada ainda.
                </p>
                 <p className="text-xs text-muted-foreground">
                   Clique em <strong>"Nova Sessão de Lance"</strong> para configurar os parâmetros automáticos de disputa.
                 </p>
              </div>
            )}

            {/* Lance cards */}
            <div className="space-y-3">
              {lances.map((lance) => (
                <div
                  key={lance.id}
                  className="bg-card rounded-xl border border-border/50 p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between">
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
                        <p className="text-xs text-muted-foreground">Ref. / Atual</p>
                        <p className="text-sm font-semibold">{formatCurrency(lance.valorReferencia)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">1º Lance</p>
                        <p className="text-sm font-semibold text-accent">
                          {formatCurrency(lance.valorInicial)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Valor Mín.</p>
                        <p className="text-sm font-semibold text-destructive">
                          {formatCurrency(lance.valorMinimo)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Decremento</p>
                        <p className="text-sm">{formatCurrency(lance.decrementoMin)}</p>
                      </div>
                      {lance.horario && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {lance.horario}
                        </div>
                      )}
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDetailLance(lance)}
                          title="Detalhes"
                        >
                          <Eye className="w-3 h-3" />
                        </Button>
                        <ConfigurarLanceDialog
                          onSave={handleSaveLance}
                          editingLance={lance}
                          trigger={
                            <Button size="sm" variant="ghost" title="Editar">
                              <Edit2 className="w-3 h-3" />
                            </Button>
                          }
                        />
                        {lance.status !== 'encerrado' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleToggleStatus(lance.id)}
                          >
                            {lance.status === 'aguardando' ? (
                              <><Play className="w-3 h-3 mr-1" /> Iniciar</>
                            ) : (
                              <><Pause className="w-3 h-3 mr-1" /> Pausar</>
                            )}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(lance.id)}
                          title="Remover"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Detail panel */}
                  {detailLance?.id === lance.id && (
                    <div className="mt-3 pt-3 border-t border-border/50 grid grid-cols-5 gap-3">
                      <div>
                        <p className="text-[10px] text-muted-foreground">Decremento %</p>
                        <p className="text-xs font-medium">{lance.decrementoPercentual}%</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Intervalo</p>
                        <p className="text-xs font-medium">{lance.intervaloSegundos}s</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Máx. Lances</p>
                        <p className="text-xs font-medium">{lance.maxLances}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Modo</p>
                        <p className="text-xs font-medium">{lance.modoAutomatico ? 'Automático' : 'Manual'}</p>
                      </div>
                      <div className="flex items-end">
                        <Button size="sm" variant="ghost" onClick={() => setDetailLance(null)}>
                          Fechar
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Simulação de disputa */}
                  {(lance.status === 'ativo' || lance.status === 'aguardando') && (
                    <SimulacaoDisputa
                      lance={lance}
                      onUpdate={(updated) =>
                        setLances((prev) => prev.map((l) => (l.id === updated.id ? updated : l)))
                      }
                    />
                  )}
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

          {/* Agente Externo */}
          <TabsContent value="agente" className="space-y-4">
            <AgenteExternoConfig />
            <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
              <h3 className="text-sm font-semibold mb-3">Arquitetura de Integração</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="border border-border/50 rounded-lg p-3">
                  <p className="text-xs font-semibold text-accent">Sistema (Cloud)</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Gerencia sessões, credenciais e histórico. Envia comandos via webhook.
                  </p>
                </div>
                <div className="flex flex-col items-center justify-center">
                  <div className="text-[10px] text-muted-foreground">←→ Webhook API</div>
                  <div className="w-full border-t border-dashed border-accent/50 my-1" />
                  <div className="text-[10px] text-muted-foreground">REST + Callbacks</div>
                </div>
                <div className="border border-accent/30 rounded-lg p-3 bg-accent/5">
                  <p className="text-xs font-semibold text-accent">Agente Dedicado</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Servidor com Puppeteer + certificado digital. Executa lances reais nos portais.
                  </p>
                </div>
              </div>
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
              <h3 className="text-sm font-semibold">Regras de Lance Automático (Padrão Global)</h3>
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
