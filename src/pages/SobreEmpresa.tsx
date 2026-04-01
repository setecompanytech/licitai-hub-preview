import { Helmet } from 'react-helmet-async';
import LandingNavbar from '@/components/landing/LandingNavbar';
import LandingFooter from '@/components/landing/LandingFooter';
import { Target, Lightbulb, Shield, Users, BarChart3, Globe } from 'lucide-react';

const values = [
  { icon: Target, title: 'Precisão Operacional', desc: 'Cada funcionalidade é construída para eliminar retrabalho e aumentar a assertividade na seleção e resposta a oportunidades públicas.' },
  { icon: Shield, title: 'Segurança por Design', desc: 'Criptografia AES-256-GCM, segregação multi-tenant com RLS, trilha de auditoria com encadeamento de hashes e conformidade LGPD desde a fundação.' },
  { icon: Lightbulb, title: 'Inteligência Aplicada', desc: 'Modelos de IA para extração documental, score de aderência e composição de custos — transformando dados públicos em vantagem competitiva.' },
  { icon: Users, title: 'Foco no Licitante', desc: 'Projetado por quem conhece a rotina de fornecedores, consultorias e equipes comerciais que operam em contratações públicas diariamente.' },
  { icon: BarChart3, title: 'Escala Nacional', desc: 'Cobertura de 38+ portais de compras públicas, incluindo PNCP, ComprasNet, BEC-SP, Licitanet, BLL e portais estaduais e municipais.' },
  { icon: Globe, title: 'Transparência', desc: 'Páginas públicas de segurança, compliance, status da plataforma e políticas de privacidade acessíveis a qualquer visitante.' },
];

export default function SobreEmpresa() {
  return (
    <>
      <Helmet>
        <title>Sobre a Empresa | PRAEFECTUS</title>
        <meta name="description" content="Conheça a PRAEFECTUS — plataforma brasileira de inteligência operacional para licitações públicas. Missão, valores e compromisso com segurança e conformidade." />
        <link rel="canonical" href="https://praefectus.com.br/sobre" />
      </Helmet>
      <div className="min-h-screen bg-background">
        <LandingNavbar />
        <main className="pt-24 pb-20 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="mb-14">
              <p className="text-xs font-semibold tracking-widest text-accent uppercase mb-3">Sobre a PRAEFECTUS</p>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                Inteligência operacional para quem compete em licitações públicas
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl">
                A PRAEFECTUS é uma plataforma SaaS brasileira especializada no ciclo completo de licitações públicas — do monitoramento de editais à automação de lances — projetada para fornecedores, consultorias licitatórias e equipes comerciais que buscam produtividade, precisão e conformidade.
              </p>
            </div>

            <section className="mb-16">
              <h2 className="text-xl font-bold mb-3">Missão</h2>
              <p className="text-muted-foreground leading-relaxed">
                Democratizar o acesso a oportunidades de contratações públicas por meio de tecnologia, eliminando barreiras operacionais e fornecendo ferramentas de inteligência que antes estavam restritas a grandes empresas e consultorias especializadas.
              </p>
            </section>

            <section className="mb-16">
              <h2 className="text-xl font-bold mb-3">Visão</h2>
              <p className="text-muted-foreground leading-relaxed">
                Ser a plataforma de referência nacional em gestão inteligente de licitações, reconhecida pela robustez técnica, segurança dos dados e capacidade de gerar vantagem competitiva mensurável para seus clientes.
              </p>
            </section>

            <section className="mb-16">
              <h2 className="text-xl font-bold mb-6">Valores e Diferenciais</h2>
              <div className="grid md:grid-cols-2 gap-6">
                {values.map((v) => (
                  <div key={v.title} className="border border-border rounded-xl p-6 bg-card">
                    <v.icon className="w-6 h-6 text-accent mb-3" />
                    <h3 className="font-semibold mb-2">{v.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{v.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="mb-16">
              <h2 className="text-xl font-bold mb-3">Arquitetura Técnica</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                A plataforma é construída sobre uma stack moderna e auditável:
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2"><span className="text-accent font-bold">•</span> Frontend em React 18 com TypeScript, Vite e Tailwind CSS</li>
                <li className="flex items-start gap-2"><span className="text-accent font-bold">•</span> Backend PostgreSQL com Row Level Security (RLS) em todas as tabelas</li>
                <li className="flex items-start gap-2"><span className="text-accent font-bold">•</span> Edge Functions serverless com rate limiting e validação de payloads</li>
                <li className="flex items-start gap-2"><span className="text-accent font-bold">•</span> Criptografia AES-256-GCM com derivação PBKDF2 para dados sensíveis</li>
                <li className="flex items-start gap-2"><span className="text-accent font-bold">•</span> Modelos Gemini para extração documental e análise de editais</li>
                <li className="flex items-start gap-2"><span className="text-accent font-bold">•</span> Conformidade com LGPD, WCAG e normas ABNT (NBR 14724)</li>
              </ul>
            </section>

            <section className="border border-border rounded-xl p-8 bg-card">
              <h2 className="text-xl font-bold mb-3">Contato Institucional</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Para questões comerciais, parcerias ou informações institucionais:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li><strong>E-mail:</strong> contato@praefectus.com.br</li>
                <li><strong>Suporte:</strong> suporte@praefectus.com.br</li>
                <li><strong>DPO / Privacidade:</strong> privacidade@praefectus.com.br</li>
              </ul>
            </section>
          </div>
        </main>
        <LandingFooter />
      </div>
    </>
  );
}
