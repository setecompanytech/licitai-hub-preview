import { Helmet } from 'react-helmet-async';
import LandingNavbar from '@/components/landing/LandingNavbar';
import LandingFooter from '@/components/landing/LandingFooter';
import { Scale, Shield, FileText, Eye, Users, Database, Lock, Mail, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const controlCards = [
  {
    icon: Users,
    title: 'Gestão de Acessos (RBAC)',
    items: [
      'Modelo RBAC com papéis definidos por tenant.',
      'Separação de privilégios: usuário, operador, administrador.',
      'Controle de acesso por módulo e plano de assinatura.',
      'Verificação de permissões antes da exibição de interfaces.',
    ],
  },
  {
    icon: Database,
    title: 'Governança de Dados',
    items: [
      'Segregação lógica multi-tenant com RLS em todas as tabelas.',
      'Backups agendados com verificação de integridade.',
      'Política de retenção com limpeza automatizada.',
      'Segredos armazenados em ambiente criptografado.',
    ],
  },
  {
    icon: Eye,
    title: 'Rastreabilidade e Auditoria',
    items: [
      'Trilha de auditoria para eventos críticos.',
      'Registro de IP, sessão e carimbo de tempo em operações sensíveis.',
      'Logs de autenticação e alterações de configuração.',
      'Histórico de versões com detecção de retificações.',
    ],
  },
  {
    icon: Lock,
    title: 'Proteção contra Irregularidades',
    items: [
      'Salvaguardas contra conluio (bid rigging) conforme Lei 14.133/2021.',
      'Restrição multi-CNPJ no mesmo item de licitação.',
      'Termo de Aceite obrigatório para automação.',
      'Alertas automáticos de conflito de interesse.',
    ],
  },
];

export default function ComplianceGovernanca() {
  return (
    <>
      <Helmet>
        <title>Governança e Compliance | PRAEFECTUS</title>
        <meta name="description" content="Política de Governança e Compliance do PRAEFECTUS — compromisso institucional, conformidade legal, ética empresarial, controles internos e prevenção de irregularidades." />
      </Helmet>
      <div className="min-h-screen bg-background">
        <LandingNavbar />
        <main className="pt-24 pb-20 px-6">
          <div className="max-w-4xl mx-auto">
            {/* Hero */}
            <div className="mb-14">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/8 border border-primary/15 text-primary text-xs font-bold uppercase tracking-wider mb-4">
                <Scale className="w-3.5 h-3.5" /> Compliance
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4">Política de Governança e Compliance</h1>
              <p className="text-base text-muted-foreground leading-relaxed max-w-2xl">
                O PRAEFECTUS opera com práticas de governança corporativa, conformidade legal e controles internos projetados para garantir a segurança, a transparência e a integridade das operações.
              </p>
              <p className="text-xs text-muted-foreground mt-3">Última atualização: 02 de abril de 2026</p>
            </div>

            {/* POLÍTICA */}
            <div className="prose prose-sm max-w-none text-foreground space-y-8 leading-relaxed mb-16">

              {/* 1 */}
              <section>
                <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">1. COMPROMISSO INSTITUCIONAL</h2>
                <p className="text-sm text-muted-foreground">
                  1.1. A <strong>PRAEFECTUS DADOS E CORPORATIVO LTDA</strong> ("PRAEFECTUS") assume o compromisso institucional de conduzir suas atividades com <strong>integridade, transparência e responsabilidade</strong>, adotando práticas de governança corporativa e compliance como pilares estratégicos da organização.<br /><br />

                  1.2. A presente Política de Governança e Compliance ("Política") estabelece as diretrizes, os valores e os controles que orientam a atuação da PRAEFECTUS, de seus colaboradores, prestadores de serviço e parceiros comerciais, assegurando a conformidade com a legislação brasileira e com as melhores práticas do mercado.<br /><br />

                  1.3. A PRAEFECTUS reconhece que a confiança de seus clientes, parceiros e da sociedade constitui ativo essencial à sustentabilidade do negócio, e compromete-se a preservá-la por meio da adoção de padrões éticos rigorosos e de mecanismos de prevenção, detecção e resposta a irregularidades.
                </p>
              </section>

              {/* 2 */}
              <section>
                <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">2. CONFORMIDADE LEGAL</h2>
                <p className="text-sm text-muted-foreground">
                  2.1. A PRAEFECTUS opera em conformidade com a legislação brasileira aplicável, incluindo, de forma não exaustiva:<br /><br />

                  a) <strong>Lei nº 13.709/2018</strong> (LGPD) – proteção de dados pessoais, com designação de Encarregado de Proteção de Dados (DPO), implementação de bases legais para tratamento, garantia dos direitos do titular e adoção de medidas técnicas e administrativas de segurança;<br /><br />

                  b) <strong>Lei nº 12.965/2014</strong> (Marco Civil da Internet) – guarda de registros de acesso, respeito à privacidade e sigilo das comunicações;<br /><br />

                  c) <strong>Lei nº 14.133/2021</strong> (Nova Lei de Licitações) – fundamentação técnica e jurídica das funcionalidades relacionadas a processos licitatórios;<br /><br />

                  d) <strong>Lei nº 12.846/2013</strong> (Lei Anticorrupção) – prevenção de atos lesivos à administração pública, com salvaguardas específicas no módulo de automação de lances;<br /><br />

                  e) <strong>Lei nº 8.078/1990</strong> (Código de Defesa do Consumidor) – transparência nas relações de consumo, quando aplicável.<br /><br />

                  2.2. A conformidade legal é assegurada por meio de revisões periódicas dos <a href="/termos-de-uso" className="text-primary hover:underline">Termos de Uso</a>, da <a href="/politica-de-privacidade" className="text-primary hover:underline">Política de Privacidade</a>, da <a href="/politica-cookies" className="text-primary hover:underline">Política de Cookies</a> e dos demais instrumentos normativos publicados.
                </p>
              </section>

              {/* 3 */}
              <section>
                <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">3. ÉTICA EMPRESARIAL</h2>
                <p className="text-sm text-muted-foreground">
                  3.1. A PRAEFECTUS pauta sua atuação pelos seguintes valores e princípios éticos:<br /><br />

                  a) <strong>Integridade:</strong> condução de todas as atividades com honestidade, retidão e respeito à lei, repudiando quaisquer práticas ilícitas, fraudulentas ou antiéticas;<br /><br />

                  b) <strong>Transparência:</strong> disponibilização de informações claras, precisas e acessíveis sobre os serviços prestados, os termos contratuais, o tratamento de dados pessoais e os controles de segurança adotados;<br /><br />

                  c) <strong>Imparcialidade:</strong> tratamento equitativo de todos os clientes e parceiros, sem discriminação ou favorecimento indevido;<br /><br />

                  d) <strong>Responsabilidade:</strong> assunção de responsabilidade pelas consequências de suas ações e decisões, com compromisso de reparação em caso de falhas;<br /><br />

                  e) <strong>Combate à corrupção:</strong> proibição expressa de oferecimento, promessa, solicitação ou aceitação de vantagens indevidas, em qualquer forma, a agentes públicos ou privados, em conformidade com a <strong>Lei nº 12.846/2013</strong>.<br /><br />

                  3.2. Todos os colaboradores, prestadores de serviço e parceiros da PRAEFECTUS devem observar os princípios éticos aqui estabelecidos, sendo vedada qualquer conduta que possa comprometer a reputação ou a integridade da organização.
                </p>
              </section>

              {/* 4 */}
              <section>
                <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">4. CONTROLES INTERNOS</h2>
                <p className="text-sm text-muted-foreground">
                  4.1. A PRAEFECTUS implementa controles internos proporcionais à natureza, à complexidade e ao risco de suas atividades, abrangendo:<br /><br />

                  a) <strong>Controle de acesso:</strong> modelo de autorização baseado em papéis (RBAC) com separação por tenant, função e módulo, assegurando que cada usuário acesse exclusivamente os dados e funcionalidades pertinentes ao seu perfil;<br /><br />

                  b) <strong>Segregação de dados:</strong> isolamento lógico multi-tenant com políticas de segurança em nível de linha (RLS), garantindo que os dados de cada organização cliente sejam acessíveis apenas aos seus usuários autorizados;<br /><br />

                  c) <strong>Gestão de segredos:</strong> chaves de API, credenciais e informações sensíveis armazenadas exclusivamente em ambiente criptografado, com acesso restrito;<br /><br />

                  d) <strong>Consentimento e opt-out:</strong> mecanismos de consentimento explícito para comunicações e cookies não essenciais, com opção de revogação a qualquer tempo;<br /><br />

                  e) <strong>Separação de ambientes:</strong> ambientes de demonstração e produção segregados para evitar contaminação de dados ou operações indevidas.
                </p>
              </section>

              {/* 5 */}
              <section>
                <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">5. AUDITORIA</h2>
                <p className="text-sm text-muted-foreground">
                  5.1. A Plataforma mantém trilhas de auditoria abrangentes para garantir a rastreabilidade e a accountability das operações, incluindo:<br /><br />

                  a) <strong>Eventos críticos:</strong> registro de criação, edição, exclusão, envio e exportação de dados, com identificação do usuário, data, horário e endereço IP;<br /><br />

                  b) <strong>Autenticação e sessões:</strong> logs de tentativas de autenticação (bem-sucedidas e falhas), alterações de credenciais e gestão de sessões ativas;<br /><br />

                  c) <strong>Módulo de lances:</strong> encadeamento de hashes para garantir a imutabilidade e a integridade dos registros de lances automatizados, com registro de IP, sessão e agente de usuário;<br /><br />

                  d) <strong>Alterações de configuração:</strong> registro de modificações em parâmetros críticos do sistema, perfis de alerta e configurações de segurança.<br /><br />

                  5.2. Os registros de auditoria são mantidos em ambiente protegido, com acesso restrito a pessoal autorizado, e podem ser consultados e exportados por administradores por meio do painel de auditoria interno.<br /><br />

                  5.3. A PRAEFECTUS persegue a obtenção de certificações internacionais de segurança (SOC 2 Type II e ISO 27001), conforme roadmap público divulgado na página de <a href="/seguranca-informacao" className="text-primary hover:underline">Segurança da Informação</a>.
                </p>
              </section>

              {/* 6 */}
              <section>
                <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">6. PREVENÇÃO DE IRREGULARIDADES</h2>
                <p className="text-sm text-muted-foreground">
                  6.1. A PRAEFECTUS adota medidas específicas de prevenção a irregularidades no contexto de licitações públicas, em conformidade com a <strong>Lei nº 14.133/2021</strong> e a <strong>Lei nº 12.846/2013</strong>:<br /><br />

                  a) <strong>Salvaguardas contra conluio (<em>bid rigging</em>):</strong> a Plataforma implementa restrições que impedem a participação de múltiplas empresas do mesmo grupo econômico no mesmo item de um pregão, com alertas automáticos de conflito de interesse;<br /><br />

                  b) <strong>Termo de Aceite de Responsabilidade:</strong> obrigatório para utilização do módulo de automação de lances, no qual o USUÁRIO declara ciência de suas responsabilidades legais e das restrições aplicáveis;<br /><br />

                  c) <strong>Detecção de anomalias:</strong> monitoramento contínuo de padrões de uso para identificação de comportamentos potencialmente irregulares, com mecanismos de rate limiting e bloqueio preventivo;<br /><br />

                  d) <strong>Proteção contra fraudes:</strong> validação de integridade de dados, sanitização de inputs e prevenção contra acessos não autorizados em todas as camadas do sistema.<br /><br />

                  6.2. A PRAEFECTUS repudia quaisquer práticas que possam configurar atos de improbidade administrativa, fraude em licitações, corrupção ativa ou passiva, ou qualquer outra conduta lesiva à administração pública.
                </p>
              </section>

              {/* 7 */}
              <section>
                <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">7. CANAL DE COMUNICAÇÃO</h2>
                <p className="text-sm text-muted-foreground">
                  7.1. A PRAEFECTUS disponibiliza os seguintes canais para comunicações relacionadas a governança, compliance, proteção de dados e relato de irregularidades:<br /><br />

                  a) <strong>Encarregado de Proteção de Dados (DPO):</strong> para questões relacionadas ao tratamento de dados pessoais, exercício de direitos do titular e incidentes de segurança:<br />
                  E-mail: <a href="mailto:dpo@praefectus.com.br" className="text-primary hover:underline">dpo@praefectus.com.br</a><br /><br />

                  b) <strong>Canal de Compliance:</strong> para relato de irregularidades, suspeitas de fraude, conflitos de interesse ou condutas antiéticas:<br />
                  E-mail: <a href="mailto:compliance@praefectus.com.br" className="text-primary hover:underline">compliance@praefectus.com.br</a><br /><br />

                  c) <strong>Contato geral:</strong> para solicitações comerciais e operacionais:<br />
                  E-mail: <a href="mailto:contato@praefectus.com.br" className="text-primary hover:underline">contato@praefectus.com.br</a><br /><br />

                  7.2. A PRAEFECTUS compromete-se a tratar todas as comunicações com <strong>sigilo e confidencialidade</strong>, assegurando a proteção do comunicante contra retaliações, em conformidade com as boas práticas de governança corporativa.<br /><br />

                  7.3. Comunicações anônimas serão aceitas e analisadas, desde que contenham informações suficientes para apuração.
                </p>
              </section>

              {/* 8 */}
              <section>
                <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">8. REVISÃO PERIÓDICA</h2>
                <p className="text-sm text-muted-foreground">
                  8.1. Esta Política será revisada periodicamente, no mínimo <strong>a cada 12 (doze) meses</strong>, ou sempre que houver alterações significativas na legislação aplicável, no escopo dos serviços prestados ou nos riscos identificados.<br /><br />

                  8.2. As revisões serão conduzidas em conjunto pela área de compliance, pela equipe de segurança da informação e pelo Encarregado de Proteção de Dados (DPO).<br /><br />

                  8.3. As alterações serão comunicadas aos USUÁRIOS por meio de notificação na Plataforma ou por e-mail. A data da última atualização será indicada no topo deste documento.
                </p>
              </section>

            </div>

            {/* Control Cards */}
            <div className="mb-12">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" /> Controles Implementados
              </h2>
              <div className="space-y-4">
                {controlCards.map((s) => (
                  <div key={s.title} className="bg-card rounded-xl border border-border/50 p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/8 flex items-center justify-center">
                        <s.icon className="w-4.5 h-4.5 text-primary" />
                      </div>
                      <h3 className="text-sm font-bold">{s.title}</h3>
                    </div>
                    <ul className="space-y-2">
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

            {/* Related links */}
            <div className="grid sm:grid-cols-3 gap-3 mb-12">
              <Link to="/politica-de-privacidade" className="group rounded-xl border border-border/50 p-4 hover:border-primary/30 transition-colors">
                <FileText className="w-5 h-5 text-primary mb-2" />
                <p className="text-sm font-bold group-hover:text-primary transition-colors">Política de Privacidade</p>
                <p className="text-xs text-muted-foreground mt-1">Tratamento de dados pessoais</p>
              </Link>
              <Link to="/seguranca-informacao" className="group rounded-xl border border-border/50 p-4 hover:border-primary/30 transition-colors">
                <Lock className="w-5 h-5 text-primary mb-2" />
                <p className="text-sm font-bold group-hover:text-primary transition-colors">Segurança da Informação</p>
                <p className="text-xs text-muted-foreground mt-1">Trust Center e controles técnicos</p>
              </Link>
              <Link to="/termos-de-uso" className="group rounded-xl border border-border/50 p-4 hover:border-primary/30 transition-colors">
                <Scale className="w-5 h-5 text-primary mb-2" />
                <p className="text-sm font-bold group-hover:text-primary transition-colors">Termos de Uso</p>
                <p className="text-xs text-muted-foreground mt-1">Condições contratuais</p>
              </Link>
            </div>

            {/* DPO Contact */}
            <div className="p-6 rounded-xl bg-muted/50 border border-border/50">
              <p className="font-semibold text-foreground mb-2 flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary" /> Canal de Compliance e DPO
              </p>
              <p className="text-[13px] text-muted-foreground leading-relaxed mb-3">
                Para relatar irregularidades, exercer direitos como titular de dados ou comunicar incidentes de segurança:
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <a href="mailto:compliance@praefectus.com.br" className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline">
                  compliance@praefectus.com.br <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <a href="mailto:dpo@praefectus.com.br" className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline">
                  dpo@praefectus.com.br <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </main>
        <LandingFooter />
      </div>
    </>
  );
}
