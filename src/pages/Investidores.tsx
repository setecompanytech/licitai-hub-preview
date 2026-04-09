import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import LandingNavbar from '@/components/landing/LandingNavbar';
import LandingFooter from '@/components/landing/LandingFooter';
import { supabase } from '@/integrations/supabase/client';
import {
  TrendingUp, Users, Building2, DollarSign, Shield, Zap, Globe, BarChart3,
  ArrowUpRight, CheckCircle2, Star, Award, Loader2
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(v);

interface PublicMetrics {
  totalUsers: number;
  totalEmpresas: number;
  activeSubscriptions: number;
  monthlyTrend: { month: string; customers: number }[];
}

const TAM = 850_000_000; // TAM estimado mercado licitações BR (R$ 850M)
const SAM = 120_000_000; // SAM: empresas ativas em licitações digitais
const SOM = 15_000_000;  // SOM: 3 primeiros anos

const differentials = [
  { icon: Zap, title: 'IA Proprietária', desc: 'AURÉLIA: assistente especializada em licitações com análise de editais, precificação e geração de propostas automatizada.' },
  { icon: Shield, title: 'Robô de Lances', desc: 'Automação de disputas em pregão eletrônico com estratégia adaptativa e trilha de auditoria em blockchain.' },
  { icon: Globe, title: '13+ Portais Integrados', desc: 'Monitoramento unificado de PNCP, ComprasNet, BLL, Licitanet, portais estaduais e municipais.' },
  { icon: BarChart3, title: 'Motor de Precificação', desc: 'Composição de custos com BDI, tributos, margem e consulta automática de preços de mercado.' },
];

const milestones = [
  { year: '2025 Q1', label: 'MVP lançado', done: true },
  { year: '2025 Q2', label: 'Robô de Lances v1', done: true },
  { year: '2025 Q3', label: '100 empresas ativas', done: false },
  { year: '2025 Q4', label: 'Expansão nacional', done: false },
  { year: '2026 Q1', label: 'Integração gov.br SSO', done: false },
  { year: '2026 Q2', label: 'Marketplace de fornecedores', done: false },
];

export default function Investidores() {
  const [metrics, setMetrics] = useState<PublicMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPublic = async () => {
      try {
        const [usersRes, empresasRes] = await Promise.all([
          supabase.from('profiles').select('*', { count: 'exact', head: true }),
          supabase.from('empresas').select('*', { count: 'exact', head: true }),
        ]);

        setMetrics({
          totalUsers: usersRes.count || 0,
          totalEmpresas: empresasRes.count || 0,
          activeSubscriptions: 0,
          monthlyTrend: [],
        });
      } catch {
        setMetrics({ totalUsers: 0, totalEmpresas: 0, activeSubscriptions: 0, monthlyTrend: [] });
      } finally {
        setLoading(false);
      }
    };
    fetchPublic();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Investidores | PRAEFECTUS — Plataforma de Licitações com IA</title>
        <meta name="description" content="PRAEFECTUS: plataforma SaaS de licitações públicas com IA, automação e inteligência competitiva. Métricas em tempo real para investidores." />
      </Helmet>
      <LandingNavbar />

      <main className="max-w-6xl mx-auto px-4 py-16">
        {/* Hero */}
        <section className="text-center mb-20">
          <div className="inline-flex items-center gap-2 bg-accent/10 text-accent px-4 py-1.5 rounded-full text-sm font-medium mb-6">
            <Star className="w-4 h-4" /> Oportunidade de Investimento
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-tight">
            Transformando licitações<br />
            <span className="text-accent">públicas com IA</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            O PRAEFECTUS é a plataforma SaaS mais completa para empresas que participam de licitações governamentais.
            Combinamos inteligência artificial, automação e dados em tempo real.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <a href="mailto:investidores@praefectus.com.br" className="inline-flex items-center gap-2 bg-accent text-accent-foreground px-6 py-3 rounded-xl font-semibold hover:opacity-90 transition-opacity">
              Falar com Founders <ArrowUpRight className="w-4 h-4" />
            </a>
            <a href="/sobre" className="inline-flex items-center gap-2 border border-border px-6 py-3 rounded-xl font-semibold hover:bg-muted/50 transition-colors">
              Sobre a Empresa
            </a>
          </div>
        </section>

        {/* KPIs em tempo real */}
        <section className="mb-20">
          <h2 className="text-2xl font-bold text-center mb-8">Métricas em Tempo Real</h2>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Usuários Cadastrados', value: metrics?.totalUsers || 0, icon: Users, suffix: '' },
                { label: 'Empresas Ativas', value: metrics?.totalEmpresas || 0, icon: Building2, suffix: '' },
                { label: 'Portais Integrados', value: 13, icon: Globe, suffix: '+' },
                { label: 'Módulos de IA', value: 8, icon: Zap, suffix: '' },
              ].map((kpi) => (
                <div key={kpi.label} className="bg-card/50 border border-border/30 rounded-2xl p-6 text-center">
                  <kpi.icon className="w-6 h-6 mx-auto mb-3 text-accent" />
                  <p className="text-3xl font-bold">{kpi.value}{kpi.suffix}</p>
                  <p className="text-xs text-muted-foreground mt-1">{kpi.label}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* TAM/SAM/SOM */}
        <section className="mb-20">
          <h2 className="text-2xl font-bold text-center mb-8">Tamanho de Mercado</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { label: 'TAM', value: formatBRL(TAM), desc: 'Mercado total de licitações digitais no Brasil', color: 'bg-blue-500/10 border-blue-500/20' },
              { label: 'SAM', value: formatBRL(SAM), desc: 'Empresas ativas em pregão eletrônico e dispensa', color: 'bg-emerald-500/10 border-emerald-500/20' },
              { label: 'SOM', value: formatBRL(SOM), desc: 'Meta realista para os primeiros 3 anos', color: 'bg-violet-500/10 border-violet-500/20' },
            ].map((m) => (
              <div key={m.label} className={`rounded-2xl p-6 border ${m.color}`}>
                <p className="text-sm font-semibold text-muted-foreground mb-2">{m.label}</p>
                <p className="text-3xl font-bold mb-2">{m.value}</p>
                <p className="text-xs text-muted-foreground">{m.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Diferenciais */}
        <section className="mb-20">
          <h2 className="text-2xl font-bold text-center mb-8">Diferenciais Competitivos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {differentials.map((d) => (
              <div key={d.title} className="bg-card/50 border border-border/30 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                    <d.icon className="w-5 h-5 text-accent" />
                  </div>
                  <h3 className="font-semibold">{d.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{d.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Modelo de Receita */}
        <section className="mb-20">
          <h2 className="text-2xl font-bold text-center mb-8">Modelo de Receita</h2>
          <div className="bg-card/50 border border-border/30 rounded-2xl p-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
              {[
                { plano: 'Básico', preco: 'R$ 197', desc: 'KPIs e monitoramento' },
                { plano: 'Profissional', preco: 'R$ 497', desc: '+ Robô, IA, CRM' },
                { plano: 'Enterprise Start', preco: 'R$ 997', desc: '+ Cloud, contratos' },
                { plano: 'Enterprise Pro', preco: 'R$ 1.497', desc: '+ Multi-empresa' },
                { plano: 'Enterprise Max', preco: 'R$ 1.997', desc: 'Capacidade total' },
              ].map((p) => (
                <div key={p.plano} className="text-center p-4 rounded-xl bg-muted/30">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">{p.plano}</p>
                  <p className="text-xl font-bold">{p.preco}<span className="text-xs text-muted-foreground">/mês</span></p>
                  <p className="text-[10px] text-muted-foreground mt-1">{p.desc}</p>
                </div>
              ))}
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Descontos progressivos: Trimestral (10%), Semestral (15%), Anual (20%)</p>
            </div>
          </div>
        </section>

        {/* Roadmap */}
        <section className="mb-20">
          <h2 className="text-2xl font-bold text-center mb-8">Roadmap</h2>
          <div className="max-w-2xl mx-auto">
            {milestones.map((m, i) => (
              <div key={m.year} className="flex items-start gap-4 pb-6 last:pb-0">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${m.done ? 'bg-emerald-500/20' : 'bg-muted'}`}>
                    {m.done ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30" />}
                  </div>
                  {i < milestones.length - 1 && <div className="w-px h-full bg-border mt-2" />}
                </div>
                <div className="pt-1">
                  <p className="text-xs font-semibold text-muted-foreground">{m.year}</p>
                  <p className={`text-sm font-medium ${m.done ? '' : 'text-muted-foreground'}`}>{m.label}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="text-center bg-gradient-to-br from-accent/5 to-accent/10 rounded-3xl p-12 border border-accent/20">
          <Award className="w-12 h-12 text-accent mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-3">Interessado em investir?</h2>
          <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
            Entre em contato com nossa equipe para receber o pitch deck completo e agendar uma reunião.
          </p>
          <a
            href="mailto:investidores@praefectus.com.br"
            className="inline-flex items-center gap-2 bg-accent text-accent-foreground px-8 py-3 rounded-xl font-semibold hover:opacity-90 transition-opacity"
          >
            investidores@praefectus.com.br <ArrowUpRight className="w-4 h-4" />
          </a>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
