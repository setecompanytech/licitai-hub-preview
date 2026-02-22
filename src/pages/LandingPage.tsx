import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Zap, Shield, Bot, BarChart3, Users, Search, ChevronRight, Check, Star, ArrowRight, MessageCircle, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

type Plano = {
  id: string;
  nome: string;
  slug: string;
  descricao: string | null;
  preco_mensal: number;
  preco_anual: number | null;
  recursos: string[];
  destaque: boolean;
};

type FaqItem = {
  id: string;
  pergunta: string;
  resposta: string;
  categoria: string;
};

const features = [
  { icon: Search, title: 'Monitoramento Inteligente', desc: 'IA rastreia editais em Compras.gov.br, PNCP e BEC/SP 24/7, filtrando por CNAE automaticamente.' },
  { icon: Bot, title: 'Assistente IA Especializado', desc: 'Tire dúvidas jurídicas, gere documentos e analise editais com inteligência artificial treinada.' },
  { icon: Zap, title: 'Robô de Lances Automático', desc: 'Configure estratégias de lance e deixe nosso robô competir por você nos pregões eletrônicos.' },
  { icon: Shield, title: 'Gestão de Documentos', desc: 'Organize certidões, atestados e propostas com alertas de vencimento automáticos.' },
  { icon: Users, title: 'Análise de Concorrentes', desc: 'Monitore CNPJs, histórico de participações e estratégias dos seus competidores.' },
  { icon: BarChart3, title: 'Analytics Avançado', desc: 'Dashboards em tempo real com métricas de desempenho, taxa de sucesso e ROI.' },
];

const stats = [
  { value: '10.000+', label: 'Editais monitorados/mês' },
  { value: '98%', label: 'Uptime garantido' },
  { value: '3x', label: 'Mais vitórias em média' },
  { value: '500+', label: 'Empresas confiam' },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [anual, setAnual] = useState(false);

  useEffect(() => {
    supabase.from('planos').select('*').eq('ativo', true).order('preco_mensal').then(({ data }) => {
      if (data) setPlanos(data.map(p => ({ ...p, recursos: (p.recursos as any) || [] })));
    });
    supabase.from('faq').select('*').eq('ativo', true).order('ordem').limit(6).then(({ data }) => {
      if (data) setFaqs(data);
    });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center">
              <Zap className="w-5 h-5 text-accent-foreground" />
            </div>
            <span className="text-xl font-bold tracking-tight">
              Licit<span className="text-accent">IA</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Funcionalidades</a>
            <a href="#planos" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Planos</a>
            <a href="#faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors">FAQ</a>
            <button onClick={() => navigate('/suporte')} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Suporte</button>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/auth')}>Entrar</Button>
            <Button size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground" onClick={() => navigate('/auth')}>
              Começar Grátis <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-medium mb-6">
              <Star className="w-4 h-4" /> Plataforma #1 em Licitações com IA
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight mb-6">
              Ganhe mais licitações com{' '}
              <span className="gradient-text">Inteligência Artificial</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-10">
              Monitore editais, analise concorrentes, automatize lances e gerencie documentos — tudo em uma plataforma única, potencializada por IA.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground text-base px-8 py-6" onClick={() => navigate('/auth')}>
                Começar Teste Grátis <ChevronRight className="w-5 h-5 ml-1" />
              </Button>
              <Button size="lg" variant="outline" className="text-base px-8 py-6" onClick={() => { const el = document.getElementById('features'); el?.scrollIntoView({ behavior: 'smooth' }); }}>
                Ver Funcionalidades
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 border-y border-border bg-muted/30">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-3xl md:text-4xl font-extrabold gradient-text">{s.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Tudo que você precisa para vencer</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">Ferramentas poderosas integradas em uma única plataforma, projetadas para maximizar suas chances em licitações públicas.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-card rounded-xl border border-border/50 p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
              >
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                  <f.icon className="w-6 h-6 text-accent" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Planos */}
      <section id="planos" className="py-20 px-6 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Planos & Preços</h2>
            <p className="text-muted-foreground text-lg mb-6">Escolha o plano ideal para o tamanho da sua operação</p>
            <div className="inline-flex items-center gap-3 bg-card rounded-full p-1 border border-border">
              <button onClick={() => setAnual(false)} className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${!anual ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}`}>Mensal</button>
              <button onClick={() => setAnual(true)} className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${anual ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}`}>
                Anual <span className="text-xs opacity-80">(-17%)</span>
              </button>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {planos.map((p) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className={`relative bg-card rounded-2xl border p-8 flex flex-col ${p.destaque ? 'border-accent shadow-lg ring-2 ring-accent/20' : 'border-border/50'}`}
              >
                {p.destaque && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-accent text-accent-foreground text-xs font-bold rounded-full">
                    MAIS POPULAR
                  </div>
                )}
                <h3 className="text-xl font-bold mb-1">{p.nome}</h3>
                <p className="text-sm text-muted-foreground mb-6">{p.descricao}</p>
                <div className="mb-6">
                  <span className="text-4xl font-extrabold">
                    R$ {anual && p.preco_anual ? Math.round(p.preco_anual / 12) : p.preco_mensal}
                  </span>
                  <span className="text-muted-foreground text-sm">/mês</span>
                  {anual && p.preco_anual && (
                    <p className="text-xs text-muted-foreground mt-1">Cobrado R$ {p.preco_anual}/ano</p>
                  )}
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {p.recursos.map((r: string) => (
                    <li key={r} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className={p.destaque ? 'bg-accent hover:bg-accent/90 text-accent-foreground w-full' : 'w-full'}
                  variant={p.destaque ? 'default' : 'outline'}
                  onClick={() => navigate('/auth')}
                >
                  Começar Agora
                </Button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Perguntas Frequentes</h2>
            <p className="text-muted-foreground text-lg">Encontre respostas para as dúvidas mais comuns</p>
          </div>
          <div className="space-y-3">
            {faqs.map((faq) => (
              <div key={faq.id} className="bg-card rounded-xl border border-border/50 overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === faq.id ? null : faq.id)}
                  className="w-full flex items-center justify-between p-5 text-left"
                >
                  <span className="font-medium pr-4">{faq.pergunta}</span>
                  <ChevronRight className={`w-5 h-5 text-muted-foreground flex-shrink-0 transition-transform ${openFaq === faq.id ? 'rotate-90' : ''}`} />
                </button>
                {openFaq === faq.id && (
                  <div className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed border-t border-border/50 pt-4">
                    {faq.resposta}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <Button variant="outline" onClick={() => navigate('/faq')}>
              Ver todas as perguntas <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center rounded-2xl p-12 relative overflow-hidden" style={{ background: 'var(--gradient-dark)' }}>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Pronto para vencer mais licitações?</h2>
          <p className="text-lg text-white/70 mb-8 max-w-2xl mx-auto">
            Junte-se a centenas de empresas que já estão usando IA para dominar o mercado de licitações públicas.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground text-base px-8" onClick={() => navigate('/auth')}>
              Criar Conta Grátis
            </Button>
            <Button size="lg" variant="outline" className="text-base px-8 border-white/20 text-white hover:bg-white/10" onClick={() => navigate('/suporte')}>
              <MessageCircle className="w-4 h-4 mr-2" /> Falar com Suporte
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-6">
        <div className="max-w-6xl mx-auto grid md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
                <Zap className="w-4 h-4 text-accent-foreground" />
              </div>
              <span className="text-lg font-bold">Licit<span className="text-accent">IA</span></span>
            </div>
            <p className="text-sm text-muted-foreground">Plataforma inteligente para gestão e monitoramento de licitações públicas.</p>
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-3">Produto</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#features" className="hover:text-foreground transition-colors">Funcionalidades</a></li>
              <li><a href="#planos" className="hover:text-foreground transition-colors">Preços</a></li>
              <li><button onClick={() => navigate('/faq')} className="hover:text-foreground transition-colors">FAQ</button></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-3">Suporte</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><button onClick={() => navigate('/suporte')} className="hover:text-foreground transition-colors">Central de Ajuda</button></li>
              <li><button onClick={() => navigate('/suporte')} className="hover:text-foreground transition-colors">Abrir Ticket</button></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-3">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><span className="cursor-default">Termos de Uso</span></li>
              <li><span className="cursor-default">Política de Privacidade</span></li>
              <li><span className="cursor-default">LGPD</span></li>
            </ul>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-8 pt-8 border-t border-border text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} LicitIA. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
}
