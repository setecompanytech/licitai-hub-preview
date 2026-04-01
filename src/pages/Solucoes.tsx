import { Helmet } from 'react-helmet-async';
import LandingNavbar from '@/components/landing/LandingNavbar';
import LandingFooter from '@/components/landing/LandingFooter';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Search, Calculator, FileText, Bot, Gavel, BarChart3, Bell, Users, Briefcase, Link2, Shield, Landmark } from 'lucide-react';

const modules = [
  { icon: Search, title: 'Monitoramento de Editais', desc: 'Cobertura de 38+ portais de compras públicas com crawler PNCP nativo. Filtros por CNAE, palavra-chave, região, município e órgão. Score de aderência por perfil. Detecção automática de retificações e republicações.', href: '/monitoramento-editais' },
  { icon: Bell, title: 'Alertas Inteligentes', desc: 'Notificações por e-mail e WhatsApp com perfis múltiplos, janelas de horário, prevenção de duplicidade e controle de fila. Boletins diários com resumo de oportunidades filtradas por relevância.', href: '/perfis-alerta' },
  { icon: Calculator, title: 'Precificação e Composição de Custos', desc: 'Motor de cálculo com suporte a BDI por modalidade, regimes tributários (Simples, Lucro Presumido, Lucro Real), composição determinística e assistida por IA. Integração com Painel de Preços Gov e cotações de fornecedores.', href: '/precificacao' },
  { icon: FileText, title: 'Geração de Propostas', desc: 'Proposta técnica e comercial com planilha de preços automatizada, importação de catálogo, upload de timbrado, dados bancários e envio integrado. Exportação em PDF conforme padrões de editais.', href: '/proposta-tecnica' },
  { icon: Bot, title: 'Robô de Lances', desc: 'Automação de lances em 23+ portais com níveis de automação configuráveis, trilha de auditoria com hashes SHA-256, kill switch de emergência e simulação de disputas. Healthcheck contínuo de portais.', href: '/robo-lances' },
  { icon: Gavel, title: 'Apoio Jurídico', desc: 'Geração de impugnações, recursos, contrarrazões e pareceres com fundamentação em base jurídica própria. Extração de irregularidades e análise de reequilíbrio econômico-financeiro assistida por IA.', href: '/apoio-juridico' },
  { icon: Landmark, title: 'Apoio Contábil', desc: 'Análise de balanço patrimonial, geração de documentos contábeis e verificação de índices econômicos conforme exigências editalícias. Upload de base contábil com indexação por tags.', href: '/apoio-contabil' },
  { icon: Briefcase, title: 'Gestão de Contratos', desc: 'Dashboard de contratos ativos com itens, pedidos, notas fiscais e custos. Importação de contrato via PDF com extração automática de cláusulas e vigência. Geração de pré-nota.', href: '/gestao-contratos' },
  { icon: BarChart3, title: 'Analytics e Relatórios', desc: 'KPIs de desempenho licitatório, taxa de sucesso, volume por modalidade, evolução temporal e relatórios gerenciais exportáveis. Painel executivo com visão consolidada.', href: '/analytics' },
  { icon: Users, title: 'Gestão de Equipe', desc: 'Controle de colaboradores com tarefas, comissões e relatório de atividades. Registro de ações por módulo para rastreabilidade operacional e governança interna.', href: '/equipe' },
  { icon: Link2, title: 'Integrações', desc: 'API PNCP, Firecrawl (38 portais), Stripe (pagamentos), Resend (e-mail transacional), WhatsApp Business e portais de transparência. Arquitetura preparada para webhooks e API externa.', href: '/api-integracao' },
  { icon: Shield, title: 'Segurança e Compliance', desc: 'Criptografia AES-256-GCM, RLS multi-tenant, RBAC, trilha de auditoria, rate limiting, conformidade LGPD, página pública de segurança e status da plataforma em tempo real.', href: '/seguranca-informacao' },
];

export default function Solucoes() {
  const navigate = useNavigate();

  return (
    <>
      <Helmet>
        <title>Soluções e Módulos | PRAEFECTUS — Plataforma de Licitações</title>
        <meta name="description" content="Conheça os 12 módulos integrados da PRAEFECTUS: monitoramento, precificação, propostas, robô de lances, apoio jurídico, contratos, analytics e mais." />
        <link rel="canonical" href="https://praefectus.com.br/solucoes" />
      </Helmet>
      <div className="min-h-screen bg-background">
        <LandingNavbar />
        <main className="pt-24 pb-20 px-6">
          <div className="max-w-5xl mx-auto">
            <div className="mb-14 text-center">
              <p className="text-xs font-semibold tracking-widest text-accent uppercase mb-3">Soluções</p>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">12 módulos integrados para o ciclo licitatório completo</h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Da identificação da oportunidade à execução do contrato — cada módulo foi projetado para eliminar retrabalho e aumentar a taxa de sucesso.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {modules.map((m) => (
                <div key={m.title} className="border border-border rounded-xl p-6 bg-card hover:border-accent/30 transition-colors group">
                  <m.icon className="w-7 h-7 text-accent mb-3" />
                  <h3 className="text-lg font-bold mb-2">{m.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{m.desc}</p>
                </div>
              ))}
            </div>

            <div className="mt-14 text-center">
              <Button size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground font-bold" onClick={() => navigate('/contato')}>
                Solicitar Demonstração
              </Button>
              <p className="text-xs text-muted-foreground mt-3">Apresentação personalizada em ambiente controlado com dados simulados.</p>
            </div>
          </div>
        </main>
        <LandingFooter />
      </div>
    </>
  );
}
