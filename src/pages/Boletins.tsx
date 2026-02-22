import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  Bell, Mail, Clock, CheckCircle2, AlertTriangle, FileText,
  Download, Eye, Settings, CalendarDays, Filter
} from 'lucide-react';

type Boletim = {
  id: string;
  titulo: string;
  tipo: 'novas' | 'alteracoes' | 'resultados';
  data: string;
  hora: string;
  totalItens: number;
  lido: boolean;
  itens: { titulo: string; orgao: string; valor: string }[];
};

const mockBoletins: Boletim[] = [
  {
    id: '1', titulo: 'Novas licitações – Manhã', tipo: 'novas', data: '2026-02-22', hora: '08:00',
    totalItens: 12, lido: false,
    itens: [
      { titulo: 'PE-201/2026 – Pavimentação em Ananindeua', orgao: 'Pref. Ananindeua', valor: 'R$ 4.500.000' },
      { titulo: 'CC-015/2026 – Construção de escola', orgao: 'SEDUC/PA', valor: 'R$ 12.000.000' },
      { titulo: 'PE-089/2026 – Reforma de UBS', orgao: 'SESPA', valor: 'R$ 2.300.000' },
    ]
  },
  {
    id: '2', titulo: 'Alterações e avisos – Meio-dia', tipo: 'alteracoes', data: '2026-02-22', hora: '12:00',
    totalItens: 5, lido: false,
    itens: [
      { titulo: 'Suspensão – PE-012/2026', orgao: 'SEMAS/PA', valor: 'R$ 3.200.000' },
      { titulo: 'Adiamento – PE-078/2026', orgao: 'SETRAN/PA', valor: 'R$ 1.800.000' },
    ]
  },
  {
    id: '3', titulo: 'Resultados do dia – Tarde', tipo: 'resultados', data: '2026-02-21', hora: '17:00',
    totalItens: 8, lido: true,
    itens: [
      { titulo: 'Adjudicado – PE-099/2025', orgao: 'COSANPA', valor: 'R$ 7.400.000' },
      { titulo: 'Homologado – CC-001/2026', orgao: 'Governo do Pará', valor: 'R$ 45.000.000' },
    ]
  },
  {
    id: '4', titulo: 'Novas licitações – Manhã', tipo: 'novas', data: '2026-02-21', hora: '08:00',
    totalItens: 15, lido: true,
    itens: [
      { titulo: 'PE-180/2026 – Sinalização BR-316', orgao: 'DNIT', valor: 'R$ 6.100.000' },
    ]
  },
  {
    id: '5', titulo: 'Alterações e avisos – Meio-dia', tipo: 'alteracoes', data: '2026-02-21', hora: '12:00',
    totalItens: 3, lido: true,
    itens: [
      { titulo: 'Cancelamento – PE-055/2026', orgao: 'Pref. Marituba', valor: 'R$ 890.000' },
    ]
  },
];

const tipoConfig = {
  novas: { label: 'Novas Licitações', color: 'bg-success/15 text-success border-success/30', icon: FileText },
  alteracoes: { label: 'Alterações', color: 'bg-warning/15 text-warning border-warning/30', icon: AlertTriangle },
  resultados: { label: 'Resultados', color: 'bg-info/15 text-info border-info/30', icon: CheckCircle2 },
};

export default function Boletins() {
  const [boletimAberto, setBoletimAberto] = useState<string | null>(null);
  const [notifConfig, setNotifConfig] = useState({
    manha: true, meiodia: true, tarde: true, push: true,
  });

  const naoLidos = mockBoletins.filter(b => !b.lido).length;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Bell className="w-6 h-6 text-accent" />
              Boletins Diários
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Avisos de novas licitações, alterações e resultados
            </p>
          </div>
          {naoLidos > 0 && (
            <Badge className="bg-accent text-accent-foreground">{naoLidos} não lidos</Badge>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="stat-card text-center">
            <FileText className="w-5 h-5 mx-auto mb-1 text-success" />
            <p className="text-lg font-bold">{mockBoletins.filter(b => b.tipo === 'novas').reduce((a, b) => a + b.totalItens, 0)}</p>
            <p className="text-[10px] text-muted-foreground">Novas Licitações</p>
          </div>
          <div className="stat-card text-center">
            <AlertTriangle className="w-5 h-5 mx-auto mb-1 text-warning" />
            <p className="text-lg font-bold">{mockBoletins.filter(b => b.tipo === 'alteracoes').reduce((a, b) => a + b.totalItens, 0)}</p>
            <p className="text-[10px] text-muted-foreground">Alterações</p>
          </div>
          <div className="stat-card text-center">
            <CheckCircle2 className="w-5 h-5 mx-auto mb-1 text-info" />
            <p className="text-lg font-bold">{mockBoletins.filter(b => b.tipo === 'resultados').reduce((a, b) => a + b.totalItens, 0)}</p>
            <p className="text-[10px] text-muted-foreground">Resultados</p>
          </div>
        </div>

        <Tabs defaultValue="boletins" className="space-y-4">
          <TabsList>
            <TabsTrigger value="boletins"><Bell className="w-4 h-4 mr-1" /> Boletins</TabsTrigger>
            <TabsTrigger value="configuracao"><Settings className="w-4 h-4 mr-1" /> Configuração</TabsTrigger>
          </TabsList>

          <TabsContent value="boletins" className="space-y-3">
            {mockBoletins.map(boletim => {
              const cfg = tipoConfig[boletim.tipo];
              const Icon = cfg.icon;
              const isOpen = boletimAberto === boletim.id;
              return (
                <Card key={boletim.id} className={`p-4 transition-shadow hover:shadow-md ${!boletim.lido ? 'border-accent/30 bg-accent/5' : ''}`}>
                  <button className="w-full text-left" onClick={() => setBoletimAberto(isOpen ? null : boletim.id)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${cfg.color}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">{boletim.titulo}</span>
                            {!boletim.lido && <span className="w-2 h-2 rounded-full bg-accent" />}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <CalendarDays className="w-3 h-3" />
                            <span>{new Date(boletim.data).toLocaleDateString('pt-BR')}</span>
                            <Clock className="w-3 h-3" />
                            <span>{boletim.hora}</span>
                            <span>• {boletim.totalItens} itens</span>
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline" className={cfg.color + ' text-[10px]'}>{cfg.label}</Badge>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                      {boletim.itens.map((item, i) => (
                        <div key={i} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg text-sm">
                          <div>
                            <p className="font-medium text-xs">{item.titulo}</p>
                            <p className="text-[10px] text-muted-foreground">{item.orgao}</p>
                          </div>
                          <span className="text-xs font-medium">{item.valor}</span>
                        </div>
                      ))}
                      {boletim.totalItens > boletim.itens.length && (
                        <p className="text-xs text-muted-foreground text-center pt-1">
                          +{boletim.totalItens - boletim.itens.length} itens adicionais
                        </p>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="configuracao">
            <Card className="p-5 space-y-4">
              <h3 className="text-sm font-semibold">Configuração de Notificações</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <p className="text-sm font-medium">Boletim da manhã (08:00)</p>
                    <p className="text-xs text-muted-foreground">Novas licitações publicadas</p>
                  </div>
                  <Switch checked={notifConfig.manha} onCheckedChange={v => setNotifConfig({ ...notifConfig, manha: v })} />
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <p className="text-sm font-medium">Boletim do meio-dia (12:00)</p>
                    <p className="text-xs text-muted-foreground">Alterações, suspensões e cancelamentos</p>
                  </div>
                  <Switch checked={notifConfig.meiodia} onCheckedChange={v => setNotifConfig({ ...notifConfig, meiodia: v })} />
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <p className="text-sm font-medium">Boletim da tarde (17:00)</p>
                    <p className="text-xs text-muted-foreground">Resultados e homologações do dia</p>
                  </div>
                  <Switch checked={notifConfig.tarde} onCheckedChange={v => setNotifConfig({ ...notifConfig, tarde: v })} />
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <p className="text-sm font-medium">Notificações push</p>
                    <p className="text-xs text-muted-foreground">Alertas em tempo real no navegador</p>
                  </div>
                  <Switch checked={notifConfig.push} onCheckedChange={v => setNotifConfig({ ...notifConfig, push: v })} />
                </div>
              </div>
              <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">Salvar Configuração</Button>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
