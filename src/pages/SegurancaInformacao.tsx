import { Helmet } from 'react-helmet-async';
import LandingNavbar from '@/components/landing/LandingNavbar';
import LandingFooter from '@/components/landing/LandingFooter';
import { Shield, Lock, Database, Eye, Server, Key, HardDrive, AlertTriangle, Users, FileCheck, BadgeCheck, Mail, ExternalLink, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const controls = [
  { icon: Lock, title: 'Autenticação Segura', desc: 'Autenticação baseada em JWT com refresh tokens, expiração controlada, confirmação de e-mail obrigatória e recuperação de senha segura. Suporte a RBAC com separação por tenant, função e módulo.' },
  { icon: Key, title: 'Criptografia de Dados Sensíveis', desc: 'Credenciais de portais e certificados digitais protegidos por criptografia AES-256-GCM com derivação de chave via PBKDF2 (100.000 iterações). Dados sensíveis nunca trafegam ou são armazenados em texto claro.' },
  { icon: Database, title: 'Segregação Lógica de Dados', desc: 'Arquitetura multi-tenant com Row Level Security (RLS) aplicada em todas as tabelas do banco de dados. Cada cliente acessa exclusivamente seus próprios registros, com verificação em nível de consulta.' },
  { icon: Eye, title: 'Trilha de Auditoria', desc: 'Registro completo de eventos críticos — criação, edição, exclusão, envio e exportação. O módulo de lances utiliza encadeamento de hashes SHA-256 para garantir a imutabilidade dos registros.' },
  { icon: Server, title: 'Proteção contra Ataques', desc: 'Rate limiting por função com janelas configuráveis, prevenção de brute force com bloqueio por tentativas excessivas, sanitização de inputs e validação de payloads em todas as Edge Functions.' },
  { icon: Shield, title: 'Controle de Acesso (RBAC)', desc: 'Modelo baseado em papéis com atribuição manual de privilégios administrativos. Componentes AdminGuard e PlanGuard para proteção de rotas. Estado de carregamento obrigatório para verificação de permissões.' },
  { icon: HardDrive, title: 'Backups e Recuperação', desc: 'Sistema de backup agendado com verificação de integridade, histórico de execuções e armazenamento seguro. Configuração de frequência (diário, semanal, mensal) e alertas de falha.' },
  { icon: AlertTriangle, title: 'Monitoramento de Eventos', desc: 'Logs de autenticação, falhas de envio, alterações de configuração e acessos a recursos críticos. Rate limiting com logs de tentativas bloqueadas para detecção de anomalias.' },
  { icon: Users, title: 'Gestão de Sessões', desc: 'Controle de sessões ativas com expiração automática. Tokens JWT com renovação controlada e invalidação segura em caso de logout ou alteração de credenciais.' },
  { icon: FileCheck, title: 'Política de Retenção', desc: 'Dados mantidos conforme necessidade operacional e obrigações legais. Limpeza automatizada de logs temporários e registros de rate limiting com frequência configurável.' },
];

const certifications = [
  { name: 'LGPD', status: 'Implementado', desc: 'Lei Geral de Proteção de Dados — políticas, DPO designado, direitos do titular ativos', done: true },
  { name: 'Security Headers', status: 'Implementado', desc: 'HSTS, X-Frame-Options, CSP, Referrer-Policy, Permissions-Policy', done: true },
  { name: 'SOC 2 Type II', status: 'Roadmap 2026', desc: 'Auditoria independente de controles de segurança, disponibilidade e confidencialidade', done: false },
  { name: 'ISO 27001', status: 'Roadmap 2027', desc: 'Sistema de gestão de segurança da informação com certificação internacional', done: false },
];

export default function SegurancaInformacao() {
  return (
    <>
      <Helmet>
        <title>Trust Center — Segurança da Informação | PRAEFECTUS</title>
        <meta name="description" content="Trust Center do PRAEFECTUS — controles técnicos de segurança, conformidade LGPD, roadmap de certificações e política de dados." />
      </Helmet>
      <div className="min-h-screen bg-background">
        <LandingNavbar />
        <main className="pt-24 pb-20 px-6">
          <div className="max-w-4xl mx-auto">
            {/* Hero */}
            <div className="mb-14">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/8 border border-primary/15 text-primary text-[11px] font-bold uppercase tracking-wider mb-4">
                <Shield className="w-3.5 h-3.5" /> Trust Center
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4">Segurança da Informação</h1>
              <p className="text-base text-muted-foreground leading-relaxed max-w-2xl">
                O PRAEFECTUS implementa controles técnicos de segurança desde a base da arquitetura — não como camada superficial ou cosmética. Cada módulo opera com autenticação, autorização, criptografia e rastreabilidade integradas.
              </p>
            </div>

            {/* Certifications / Compliance Status */}
            <div className="mb-12">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <BadgeCheck className="w-5 h-5 text-primary" /> Conformidade e Certificações
              </h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {certifications.map((c) => (
                  <div key={c.name} className={`rounded-xl border p-4 ${c.done ? 'bg-success/5 border-success/20' : 'bg-muted/30 border-border/50'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.done ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'}`}>
                        {c.status}
                      </span>
                      <span className="text-sm font-bold text-foreground">{c.name}</span>
                    </div>
                    <p className="text-[12px] text-muted-foreground leading-relaxed mt-1">{c.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Controls grid */}
            <div className="mb-12">
              <h2 className="text-lg font-bold mb-4">Controles Técnicos Implementados</h2>
              <div className="space-y-4">
                {controls.map((c) => (
                  <div key={c.title} className="bg-card rounded-xl border border-border/50 p-5">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg bg-primary/8 flex items-center justify-center flex-shrink-0">
                        <c.icon className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold mb-1">{c.title}</h3>
                        <p className="text-[13px] text-muted-foreground leading-relaxed">{c.desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Related links */}
            <div className="grid sm:grid-cols-3 gap-3 mb-12">
              <Link to="/politica-de-privacidade" className="group rounded-xl border border-border/50 p-4 hover:border-primary/30 transition-colors">
                <FileCheck className="w-5 h-5 text-primary mb-2" />
                <p className="text-sm font-bold group-hover:text-primary transition-colors">Política de Privacidade</p>
                <p className="text-[11px] text-muted-foreground mt-1">Tratamento de dados pessoais</p>
              </Link>
              <Link to="/lgpd" className="group rounded-xl border border-border/50 p-4 hover:border-primary/30 transition-colors">
                <Lock className="w-5 h-5 text-primary mb-2" />
                <p className="text-sm font-bold group-hover:text-primary transition-colors">Conformidade LGPD</p>
                <p className="text-[11px] text-muted-foreground mt-1">Bases legais e direitos do titular</p>
              </Link>
              <Link to="/status" className="group rounded-xl border border-border/50 p-4 hover:border-primary/30 transition-colors">
                <Server className="w-5 h-5 text-primary mb-2" />
                <p className="text-sm font-bold group-hover:text-primary transition-colors">Status da Plataforma</p>
                <p className="text-[11px] text-muted-foreground mt-1">Disponibilidade em tempo real</p>
              </Link>
            </div>

            {/* DPO Contact */}
            <div className="p-6 rounded-xl bg-muted/50 border border-border/50">
              <p className="font-semibold text-foreground mb-2 flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary" /> Contato do Encarregado de Dados (DPO)
              </p>
              <p className="text-[13px] text-muted-foreground leading-relaxed mb-3">
                Para exercer seus direitos como titular de dados, relatar incidentes de segurança ou solicitar informações sobre o tratamento de dados pessoais, entre em contato com nosso DPO:
              </p>
              <a href="mailto:dpo@praefectus.com.br" className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline">
                dpo@praefectus.com.br <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </main>
        <LandingFooter />
      </div>
    </>
  );
}
