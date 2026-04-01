import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import LandingNavbar from '@/components/landing/LandingNavbar';
import LandingFooter from '@/components/landing/LandingFooter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavigate } from 'react-router-dom';
import {
  Search, BarChart3, Bell, FileText, Shield, AlertTriangle, CheckCircle2,
  TrendingUp, Clock, MapPin, Building2, Calculator, Eye
} from 'lucide-react';

// ── Dados simulados realistas ──
const mockOportunidades = [
  { id: 1, orgao: 'Prefeitura Municipal de Curitiba', objeto: 'Aquisição de materiais de limpeza e higienização', modalidade: 'Pregão Eletrônico', valor: 450000, prazo: '3 dias', score: 92, uf: 'PR', status: 'Aberta' },
  { id: 2, orgao: 'Ministério da Saúde', objeto: 'Contratação de serviços de TI — suporte técnico nível 2', modalidade: 'Pregão Eletrônico', valor: 1200000, prazo: '7 dias', score: 87, uf: 'DF', status: 'Aberta' },
  { id: 3, orgao: 'SESC Administração Regional - SP', objeto: 'Fornecimento de equipamentos de informática', modalidade: 'Concorrência', valor: 890000, prazo: '12 dias', score: 78, uf: 'SP', status: 'Aberta' },
  { id: 4, orgao: 'Tribunal Regional do Trabalho 2ª Região', objeto: 'Serviços de manutenção predial', modalidade: 'Pregão Eletrônico', valor: 320000, prazo: '5 dias', score: 71, uf: 'SP', status: 'Aberta' },
  { id: 5, orgao: 'Universidade Federal de Minas Gerais', objeto: 'Aquisição de reagentes e material de laboratório', modalidade: 'Pregão Eletrônico', valor: 180000, prazo: '2 dias', score: 95, uf: 'MG', status: 'Aberta' },
  { id: 6, orgao: 'Secretaria de Educação do Estado do RS', objeto: 'Fornecimento de merenda escolar — proteínas e laticínios', modalidade: 'Pregão Eletrônico', valor: 2300000, prazo: '10 dias', score: 65, uf: 'RS', status: 'Aberta' },
];

const mockKpis = [
  { label: 'Oportunidades Monitoradas', value: '1.247', icon: Search, trend: '+12%' },
  { label: 'Score Médio de Aderência', value: '82%', icon: TrendingUp, trend: '+5%' },
  { label: 'Alertas Enviados (7d)', value: '38', icon: Bell, trend: '+8%' },
  { label: 'Propostas Geradas', value: '14', icon: FileText, trend: '+3%' },
];

const DEMO_BANNER = (
  <div className="bg-warning/10 border-b border-warning/30 px-4 py-2 text-center">
    <div className="flex items-center justify-center gap-2 text-xs font-semibold text-warning">
      <Eye className="w-4 h-4" />
      AMBIENTE DE DEMONSTRAÇÃO — Dados simulados. Nenhuma operação real é executada.
    </div>
  </div>
);

export default function DemoAmbiente() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('dashboard');

  return (
    <>
      <Helmet>
        <title>Demonstração | PRAEFECTUS — Ambiente Simulado</title>
        <meta name="description" content="Explore a PRAEFECTUS em ambiente de demonstração com dados simulados. Dashboards, oportunidades, alertas e filtros inteligentes." />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="min-h-screen bg-background">
        <LandingNavbar />
        {DEMO_BANNER}

        <main className="pt-20 pb-20 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl font-bold">Dashboard Executivo</h1>
                  <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-[10px]">
                    <AlertTriangle className="w-3 h-3 mr-1" /> DEMO
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">Visão consolidada de oportunidades, alertas e desempenho — dados simulados para demonstração.</p>
              </div>
              <Button className="bg-accent hover:bg-accent/90 text-accent-foreground font-bold" onClick={() => navigate('/contato')}>
                Solicitar Acesso Real
              </Button>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {mockKpis.map((kpi) => (
                <div key={kpi.label} className="bg-card border border-border rounded-xl p-5">
                  <div className="flex items-center justify-between mb-2">
                    <kpi.icon className="w-5 h-5 text-accent" />
                    <span className="text-xs text-success font-semibold">{kpi.trend}</span>
                  </div>
                  <p className="text-2xl font-bold">{kpi.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{kpi.label}</p>
                </div>
              ))}
            </div>

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="mb-6">
                <TabsTrigger value="dashboard">Oportunidades</TabsTrigger>
                <TabsTrigger value="alertas">Alertas</TabsTrigger>
                <TabsTrigger value="filtros">Filtros Inteligentes</TabsTrigger>
              </TabsList>

              {/* Oportunidades */}
              <TabsContent value="dashboard" className="space-y-4">
                {mockOportunidades.map((op) => (
                  <div key={op.id} className="bg-card border border-border rounded-xl p-5 hover:border-accent/30 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Building2 className="w-4 h-4 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{op.orgao}</span>
                        </div>
                        <h3 className="font-semibold text-sm mb-2">{op.objeto}</h3>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline" className="text-[10px]">{op.modalidade}</Badge>
                          <Badge variant="outline" className="text-[10px]"><MapPin className="w-3 h-3 mr-1" />{op.uf}</Badge>
                          <Badge variant="outline" className="text-[10px]"><Clock className="w-3 h-3 mr-1" />{op.prazo}</Badge>
                          <Badge variant="outline" className="text-[10px]"><Calculator className="w-3 h-3 mr-1" />R$ {(op.valor / 1000).toFixed(0)}k</Badge>
                        </div>
                      </div>
                      <div className="text-center">
                        <div className={`text-lg font-bold ${op.score >= 80 ? 'text-success' : op.score >= 60 ? 'text-warning' : 'text-muted-foreground'}`}>
                          {op.score}%
                        </div>
                        <p className="text-[10px] text-muted-foreground">Aderência</p>
                      </div>
                    </div>
                  </div>
                ))}
              </TabsContent>

              {/* Alertas */}
              <TabsContent value="alertas" className="space-y-4">
                {[
                  { tipo: 'E-mail', qtd: 12, status: 'Enviados', cor: 'text-success' },
                  { tipo: 'WhatsApp', qtd: 8, status: 'Enviados', cor: 'text-success' },
                  { tipo: 'Push', qtd: 3, status: 'Pendentes', cor: 'text-warning' },
                ].map((a) => (
                  <div key={a.tipo} className="bg-card border border-border rounded-xl p-5 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-sm">{a.tipo}</h3>
                      <p className="text-xs text-muted-foreground">{a.qtd} alertas esta semana</p>
                    </div>
                    <Badge variant="outline" className={a.cor}>
                      <CheckCircle2 className="w-3 h-3 mr-1" /> {a.status}
                    </Badge>
                  </div>
                ))}
                <div className="border border-dashed border-border rounded-xl p-8 text-center text-muted-foreground">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Configure perfis de alerta para receber notificações personalizadas.</p>
                </div>
              </TabsContent>

              {/* Filtros */}
              <TabsContent value="filtros" className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  {[
                    { label: 'CNAEs monitorados', value: '47.12-1, 46.49-4, 26.21-3', count: 3 },
                    { label: 'Palavras-chave', value: 'material de limpeza, equipamento TI, manutenção', count: 5 },
                    { label: 'UFs de interesse', value: 'SP, PR, MG, RS, DF', count: 5 },
                    { label: 'Palavras excluídas', value: 'obra civil, construção', count: 2 },
                  ].map((f) => (
                    <div key={f.label} className="bg-card border border-border rounded-xl p-5">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-sm">{f.label}</h3>
                        <Badge variant="outline" className="text-[10px]">{f.count} ativos</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{f.value}</p>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>

            {/* CTA */}
            <div className="mt-14 bg-card border border-accent/20 rounded-xl p-8 text-center">
              <Shield className="w-8 h-8 text-accent mx-auto mb-3" />
              <h2 className="text-lg font-bold mb-2">Pronto para acessar dados reais?</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Crie sua conta e configure seus perfis de monitoramento em menos de 5 minutos.
              </p>
              <div className="flex gap-3 justify-center">
                <Button className="bg-accent hover:bg-accent/90 text-accent-foreground font-bold" onClick={() => navigate('/auth?step=signup')}>
                  Criar Conta Gratuita
                </Button>
                <Button variant="outline" onClick={() => navigate('/contato')}>
                  Falar com Especialista
                </Button>
              </div>
            </div>
          </div>
        </main>
        <LandingFooter />
      </div>
    </>
  );
}
