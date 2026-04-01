import { Helmet } from 'react-helmet-async';
import LandingNavbar from '@/components/landing/LandingNavbar';
import LandingFooter from '@/components/landing/LandingFooter';
import { Shield, Lock, Database, Eye, Server, Key, HardDrive, AlertTriangle, Users, FileCheck } from 'lucide-react';

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

export default function SegurancaInformacao() {
  return (
    <>
      <Helmet>
        <title>Segurança da Informação | PRAEFECTUS</title>
        <meta name="description" content="Conheça os controles técnicos de segurança implementados no PRAEFECTUS — criptografia, segregação de dados, auditoria e conformidade." />
      </Helmet>
      <div className="min-h-screen bg-background">
        <LandingNavbar />
        <main className="pt-24 pb-20 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="mb-14">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/8 border border-primary/15 text-primary text-[11px] font-bold uppercase tracking-wider mb-4">
                <Shield className="w-3.5 h-3.5" /> Segurança
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4">Segurança da Informação</h1>
              <p className="text-base text-muted-foreground leading-relaxed max-w-2xl">
                O PRAEFECTUS implementa controles técnicos de segurança desde a base da arquitetura — não como camada superficial ou cosmética. Cada módulo opera com autenticação, autorização, criptografia e rastreabilidade integradas.
              </p>
            </div>

            <div className="space-y-6">
              {controls.map((c) => (
                <div key={c.title} className="bg-card rounded-xl border border-border/50 p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/8 flex items-center justify-center flex-shrink-0">
                      <c.icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold mb-1.5">{c.title}</h2>
                      <p className="text-[13px] text-muted-foreground leading-relaxed">{c.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-12 p-6 rounded-xl bg-muted/50 border border-border/50 text-[13px] text-muted-foreground leading-relaxed">
              <p className="font-semibold text-foreground mb-2">Compromisso com a Transparência</p>
              <p>Esta página descreve os controles técnicos efetivamente implementados na plataforma. O PRAEFECTUS mantém o compromisso de aperfeiçoar continuamente sua postura de segurança, incorporando novas camadas de proteção conforme a evolução do produto e as melhores práticas do mercado.</p>
            </div>
          </div>
        </main>
        <LandingFooter />
      </div>
    </>
  );
}
