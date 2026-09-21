import { Helmet } from 'react-helmet-async';
import LandingNavbar from '@/components/landing/LandingNavbar';
import LandingFooter from '@/components/landing/LandingFooter';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import { Badge } from '@/components/ui/badge';
import { Scale, Shield, FileText, Eye, Users, Database, Lock, Mail, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

/* Cartão de link relacionado — o cartão clicável do padrão. */
const LINK_RELACIONADO =
  'group rounded-lg border border-border bg-card p-4 shadow-sm transition-[border-color,box-shadow] duration-150 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

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
        <main className="px-6 pb-20 pt-24">
          <div className="mx-auto max-w-4xl">
            {/* Cabeçalho padrão no lugar do herói: título 28/36, descrição e o
                selo "Compliance" com a data da revisão logo abaixo. */}
            <CabecalhoPagina
              className="mb-10"
              titulo="Política de Governança e Compliance"
              descricao="O PRAEFECTUS opera com práticas de governança corporativa, conformidade legal e controles internos projetados para garantir a segurança, a transparência e a integridade das operações."
              icone={<Scale />}
            >
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="muted" className="gap-1">
                  <Scale className="h-3.5 w-3.5" aria-hidden="true" /> Compliance
                </Badge>
                <span className="text-xs text-muted-foreground">Última atualização: 02 de abril de 2026</span>
              </div>
            </CabecalhoPagina>

            {/* POLÍTICA — largura de leitura, seções com título 18/600. */}
            <div className="mb-16 max-w-3xl space-y-8 text-foreground">

              {/* 1 */}
              <section>
                <h2 className="mb-3 border-b border-border pb-2 text-xl font-semibold leading-7 text-foreground">1. COMPROMISSO INSTITUCIONAL</h2>
                <p className="text-base leading-6 text-muted-foreground">
                  1.1. A <strong>PRAEFECTUS DADOS E CORPORATIVO LTDA</strong> ("PRAEFECTUS") assume o compromisso institucional de conduzir suas atividades com <strong>integridade, transparência e responsabilidade</strong>, adotando práticas de governança corporativa e compliance como pilares estratégicos da organização.<br /><br />

                  1.2. A presente Política de Governança e Compliance ("Política") estabelece as diretrizes, os valores e os controles que orientam a atuação da PRAEFECTUS, de seus colaboradores, prestadores de serviço e parceiros comerciais, assegurando a conformidade com a legislação brasileira e com as melhores práticas do mercado.<br /><br />

                  1.3. A PRAEFECTUS reconhece que a confiança de seus clientes, parceiros e da sociedade constitui ativo essencial à sustentabilidade do negócio, e compromete-se a preservá-la por meio da adoção de padrões éticos rigorosos e de mecanismos de prevenção, detecção e resposta a irregularidades.
                </p>
              </section>

              {/* 2 */}
              <section>
                <h2 className="mb-3 border-b border-border pb-2 text-xl font-semibold leading-7 text-foreground">2. CONFORMIDADE LEGAL</h2>
                <p className="text-base leading-6 text-muted-foreground">
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
                <h2 className="mb-3 border-b border-border pb-2 text-xl font-semibold leading-7 text-foreground">3. ÉTICA EMPRESARIAL</h2>
                <p className="text-base leading-6 text-muted-foreground">
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
                <h2 className="mb-3 border-b border-border pb-2 text-xl font-semibold leading-7 text-foreground">4. CONTROLES INTERNOS</h2>
                <p className="text-base leading-6 text-muted-foreground">
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
                <h2 className="mb-3 border-b border-border pb-2 text-xl font-semibold leading-7 text-foreground">5. AUDITORIA</h2>
                <p className="text-base leading-6 text-muted-foreground">
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
                <h2 className="mb-3 border-b border-border pb-2 text-xl font-semibold leading-7 text-foreground">6. PREVENÇÃO DE IRREGULARIDADES</h2>
                <p className="text-base leading-6 text-muted-foreground">
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
                <h2 className="mb-3 border-b border-border pb-2 text-xl font-semibold leading-7 text-foreground">7. CANAL DE COMUNICAÇÃO</h2>
                <p className="text-base leading-6 text-muted-foreground">
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
                <h2 className="mb-3 border-b border-border pb-2 text-xl font-semibold leading-7 text-foreground">8. REVISÃO PERIÓDICA</h2>
                <p className="text-base leading-6 text-muted-foreground">
                  8.1. Esta Política será revisada periodicamente, no mínimo <strong>a cada 12 (doze) meses</strong>, ou sempre que houver alterações significativas na legislação aplicável, no escopo dos serviços prestados ou nos riscos identificados.<br /><br />

                  8.2. As revisões serão conduzidas em conjunto pela área de compliance, pela equipe de segurança da informação e pelo Encarregado de Proteção de Dados (DPO).<br /><br />

                  8.3. As alterações serão comunicadas aos USUÁRIOS por meio de notificação na Plataforma ou por e-mail. A data da última atualização será indicada no topo deste documento.
                </p>
              </section>

            </div>

            {/* Control Cards — cartões compactos com o ícone num ladrilho neutro. */}
            <section className="mb-12">
              <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold leading-7 text-foreground">
                <Shield className="h-5 w-5 text-muted-foreground" aria-hidden="true" /> Controles Implementados
              </h2>
              <div className="space-y-3">
                {controlCards.map((s) => (
                  <div key={s.title} className="rounded-lg border border-border bg-card p-5 shadow-sm">
                    <div className="mb-3 flex items-center gap-3">
                      <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <s.icon className="h-4 w-4" />
                      </span>
                      <h3 className="text-base font-semibold text-foreground">{s.title}</h3>
                    </div>
                    <ul className="space-y-2">
                      {s.items.map((item, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm leading-5 text-muted-foreground">
                          <Shield className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>

            {/* Related links */}
            <div className="mb-12 grid gap-3 sm:grid-cols-3">
              <Link to="/politica-de-privacidade" className={LINK_RELACIONADO}>
                <FileText className="mb-2 h-5 w-5 text-muted-foreground" aria-hidden="true" />
                <p className="text-base font-medium text-foreground transition-colors group-hover:text-primary">Política de Privacidade</p>
                <p className="mt-1 text-xs text-muted-foreground">Tratamento de dados pessoais</p>
              </Link>
              <Link to="/seguranca-informacao" className={LINK_RELACIONADO}>
                <Lock className="mb-2 h-5 w-5 text-muted-foreground" aria-hidden="true" />
                <p className="text-base font-medium text-foreground transition-colors group-hover:text-primary">Segurança da Informação</p>
                <p className="mt-1 text-xs text-muted-foreground">Trust Center e controles técnicos</p>
              </Link>
              <Link to="/termos-de-uso" className={LINK_RELACIONADO}>
                <Scale className="mb-2 h-5 w-5 text-muted-foreground" aria-hidden="true" />
                <p className="text-base font-medium text-foreground transition-colors group-hover:text-primary">Termos de Uso</p>
                <p className="mt-1 text-xs text-muted-foreground">Condições contratuais</p>
              </Link>
            </div>

            {/* DPO Contact */}
            <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <p className="mb-2 flex items-center gap-2 text-lg font-semibold leading-6 text-foreground">
                <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Canal de Compliance e DPO
              </p>
              <p className="mb-3 max-w-3xl text-sm leading-5 text-muted-foreground">
                Para relatar irregularidades, exercer direitos como titular de dados ou comunicar incidentes de segurança:
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <a href="mailto:compliance@praefectus.com.br" className="inline-flex items-center gap-2 rounded-md text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  compliance@praefectus.com.br <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
                <a href="mailto:dpo@praefectus.com.br" className="inline-flex items-center gap-2 rounded-md text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  dpo@praefectus.com.br <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
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
