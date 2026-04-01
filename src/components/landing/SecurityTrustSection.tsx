import { useNavigate } from 'react-router-dom';
import { Shield, Lock, Database, Eye, FileCheck, Server, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

const items = [
  { icon: Lock, title: 'Criptografia AES-256-GCM', desc: 'Credenciais de portais e certificados digitais protegidos por criptografia simétrica com derivação de chave via PBKDF2.' },
  { icon: Database, title: 'Segregação Multi-Tenant', desc: 'Row Level Security (RLS) em todas as tabelas — cada cliente acessa exclusivamente seus próprios dados.' },
  { icon: Eye, title: 'Trilha de Auditoria', desc: 'Registro completo de ações críticas com encadeamento de hashes (SHA-256) para garantir imutabilidade e rastreabilidade.' },
  { icon: FileCheck, title: 'LGPD e Compliance', desc: 'Política de privacidade, termos de uso, consentimento explícito e gestão de direitos do titular conforme legislação vigente.' },
  { icon: Server, title: 'Rate Limiting e Anti-Brute Force', desc: 'Proteção por função com janelas configuráveis, prevenção de abuso de API e logs de tentativas bloqueadas.' },
  { icon: Shield, title: 'RBAC Completo', desc: 'Controle de acesso baseado em papéis com separação por tenant, módulo e função — atribuição manual de privilégios administrativos.' },
];

export default function SecurityTrustSection() {
  const navigate = useNavigate();

  return (
    <section className="py-20 md:py-28 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <p className="section-label">Segurança e Conformidade</p>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Infraestrutura com <span className="text-accent">padrão corporativo</span>
            </h2>
            <p className="text-base text-muted-foreground max-w-2xl mx-auto mt-4">
              Controles técnicos de segurança implementados desde a base — não como camada superficial.
            </p>
          </motion.div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
          {items.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="bg-card rounded-xl border border-border/50 p-6 hover:border-accent/30 hover:shadow-md transition-all"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/8 flex items-center justify-center mb-4">
                <item.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-sm font-bold mb-1.5">{item.title}</h3>
              <p className="text-[13px] text-muted-foreground leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <Button variant="outline" size="sm" className="text-[13px] font-semibold" onClick={() => navigate('/seguranca-informacao')}>
            Segurança da Informação <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
          <Button variant="outline" size="sm" className="text-[13px] font-semibold" onClick={() => navigate('/compliance')}>
            Compliance e Governança <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
          <Button variant="outline" size="sm" className="text-[13px] font-semibold" onClick={() => navigate('/status')}>
            Status da Plataforma <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>
      </div>
    </section>
  );
}
