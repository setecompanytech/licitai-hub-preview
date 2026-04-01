import { Helmet } from 'react-helmet-async';
import LandingNavbar from '@/components/landing/LandingNavbar';
import LandingFooter from '@/components/landing/LandingFooter';
import { Scale, Shield, FileText, Eye, Users, Database, Lock } from 'lucide-react';

const sections = [
  {
    icon: Scale,
    title: 'Conformidade Legal',
    items: [
      'Operação em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei 13.709/2018).',
      'Fundamentação técnica e jurídica baseada na Lei 14.133/2021 (Nova Lei de Licitações).',
      'Termos de uso e política de privacidade publicados e acessíveis a todos os usuários.',
      'Consentimento explícito para comunicações por e-mail e WhatsApp com mecanismo de opt-out.',
      'Conformidade com a Lei Anticorrupção (12.846/2013) no módulo de automação de lances.',
    ],
  },
  {
    icon: Eye,
    title: 'Rastreabilidade e Auditoria',
    items: [
      'Trilha de auditoria para eventos críticos: criação, edição, exclusão, envio e exportação.',
      'Encadeamento de hashes SHA-256 nos registros de lances para garantir imutabilidade.',
      'Registro de IP, sessão, carimbo de tempo e agente de usuário em operações sensíveis.',
      'Logs de autenticação, falhas de acesso e alterações de configuração.',
      'Histórico de versões de publicações com detecção automática de retificações.',
    ],
  },
  {
    icon: Users,
    title: 'Gestão de Acessos',
    items: [
      'Modelo RBAC (Role-Based Access Control) com papéis definidos por tenant.',
      'Separação de privilégios: usuário, operador, administrador — com atribuição manual.',
      'Controle de acesso por módulo e plano de assinatura (PlanGuard).',
      'Proteção de rotas administrativas com componente AdminGuard.',
      'Verificação de permissões no banco de dados antes da renderização de interfaces.',
    ],
  },
  {
    icon: Database,
    title: 'Governança de Dados',
    items: [
      'Segregação lógica multi-tenant com Row Level Security (RLS) em todas as tabelas.',
      'Dados de cada cliente isolados e inacessíveis a outros tenants.',
      'Backups agendados com verificação de integridade e histórico de execuções.',
      'Política de retenção com limpeza automatizada de registros temporários.',
      'Chaves de API e segredos armazenados exclusivamente em ambiente criptografado.',
    ],
  },
  {
    icon: Lock,
    title: 'Proteção contra Práticas Irregulares',
    items: [
      'Salvaguardas contra conluio (bid rigging) em operações multi-CNPJ — conforme Lei 14.133/2021.',
      'Restrição de participação com múltiplas empresas do mesmo grupo no mesmo item.',
      'Termo de Aceite de Responsabilidade obrigatório para automação de lances.',
      'Alertas automáticos de conflito de interesse em processos licitatórios.',
      'Separação entre ambientes de demonstração e produção.',
    ],
  },
  {
    icon: FileText,
    title: 'Proteção de Dados Pessoais (LGPD)',
    items: [
      'Finalidades de tratamento documentadas e limitadas à operação da plataforma.',
      'Bases legais aplicáveis: execução de contrato, legítimo interesse e consentimento.',
      'Direitos do titular assegurados: acesso, retificação, exclusão e portabilidade.',
      'Canal de comunicação para exercício de direitos: contato@praefectus.com.br.',
      'Política de cookies e tecnologias de rastreamento publicada.',
    ],
  },
];

export default function ComplianceGovernanca() {
  return (
    <>
      <Helmet>
        <title>Compliance e Governança | PRAEFECTUS</title>
        <meta name="description" content="Conheça as práticas de compliance, governança e conformidade legal do PRAEFECTUS — LGPD, auditoria, RBAC e proteção de dados." />
      </Helmet>
      <div className="min-h-screen bg-background">
        <LandingNavbar />
        <main className="pt-24 pb-20 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="mb-14">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/8 border border-primary/15 text-primary text-[11px] font-bold uppercase tracking-wider mb-4">
                <Scale className="w-3.5 h-3.5" /> Compliance
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4">Compliance e Governança</h1>
              <p className="text-base text-muted-foreground leading-relaxed max-w-2xl">
                O PRAEFECTUS opera com práticas de governança, conformidade legal e controles internos projetados para garantir a segurança, a transparência e a integridade das operações.
              </p>
            </div>

            <div className="space-y-8">
              {sections.map((s) => (
                <div key={s.title} className="bg-card rounded-xl border border-border/50 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 rounded-lg bg-primary/8 flex items-center justify-center">
                      <s.icon className="w-4.5 h-4.5 text-primary" />
                    </div>
                    <h2 className="text-base font-bold">{s.title}</h2>
                  </div>
                  <ul className="space-y-2.5">
                    {s.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-[13px] text-muted-foreground leading-relaxed">
                        <Shield className="w-3.5 h-3.5 text-accent flex-shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </main>
        <LandingFooter />
      </div>
    </>
  );
}
