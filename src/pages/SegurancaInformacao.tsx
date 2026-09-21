import { Helmet } from 'react-helmet-async';
import LandingNavbar from '@/components/landing/LandingNavbar';
import LandingFooter from '@/components/landing/LandingFooter';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import { Badge } from '@/components/ui/badge';
import { Shield, Lock, Database, Eye, Server, Key, HardDrive, AlertTriangle, Users, FileCheck, BadgeCheck, Mail, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

/* Cartão de link relacionado — o cartão clicável do padrão. */
const LINK_RELACIONADO =
  'group rounded-lg border border-border bg-card p-4 shadow-sm transition-[border-color,box-shadow] duration-150 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

const controls = [
  { icon: Lock, title: 'Autenticação Segura', desc: 'Autenticação baseada em JWT com refresh tokens, expiração controlada, confirmação de e-mail obrigatória e recuperação de senha segura. Suporte a RBAC com separação por tenant, função e módulo.' },
  { icon: Key, title: 'Criptografia de Dados Sensíveis', desc: 'Credenciais de portais e certificados digitais protegidos por criptografia AES-256-GCM com derivação de chave via PBKDF2 (100.000 iterações). Dados sensíveis nunca trafegam ou são armazenados em texto claro.' },
  { icon: Database, title: 'Segregação Lógica de Dados', desc: 'Arquitetura multi-tenant com Row Level Security (RLS) aplicada em todas as tabelas do banco de dados. Cada cliente acessa exclusivamente seus próprios registros, com verificação em nível de consulta.' },
  { icon: Eye, title: 'Trilha de Auditoria', desc: 'Registro completo de eventos críticos — criação, edição, exclusão, envio e exportação. O módulo de lances utiliza encadeamento de hashes SHA-256 para garantir a imutabilidade dos registros.' },
  { icon: Server, title: 'Proteção contra Ataques', desc: 'Rate limiting por função com janelas configuráveis, prevenção de brute force com bloqueio por tentativas excessivas, sanitização de inputs e validação de payloads em todas as Edge Functions.' },
  { icon: Shield, title: 'Controle de Acesso (RBAC)', desc: 'Modelo baseado em papéis com atribuição manual de privilégios administrativos. Componentes de proteção de rotas e verificação de permissões em tempo real.' },
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
        <meta name="description" content="Política de Segurança da Informação e Trust Center do PRAEFECTUS — controles institucionais, conformidade LGPD, gestão de incidentes e continuidade de serviço." />
      </Helmet>
      <div className="min-h-screen bg-background">
        <LandingNavbar />
        <main className="px-6 pb-20 pt-24">
          <div className="mx-auto max-w-4xl">
            {/* Cabeçalho padrão no lugar do herói: título 28/36, descrição e o
                selo "Trust Center" com a data da revisão logo abaixo. */}
            <CabecalhoPagina
              className="mb-10"
              titulo="Política de Segurança da Informação"
              descricao="O PRAEFECTUS implementa controles técnicos e administrativos de segurança desde a base da arquitetura, em conformidade com a LGPD e o Marco Civil da Internet."
              icone={<Shield />}
            >
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="muted" className="gap-1">
                  <Shield className="h-3.5 w-3.5" aria-hidden="true" /> Trust Center
                </Badge>
                <span className="text-xs text-muted-foreground">Última atualização: 02 de abril de 2026</span>
              </div>
            </CabecalhoPagina>

            {/* POLÍTICA DE SEGURANÇA — largura de leitura, seções com título 18/600. */}
            <div className="mb-16 max-w-3xl space-y-8 text-foreground">

              {/* 1 */}
              <section>
                <h2 className="mb-3 border-b border-border pb-2 text-xl font-semibold leading-7 text-foreground">1. OBJETIVO</h2>
                <p className="text-base leading-6 text-muted-foreground">
                  1.1. A presente Política de Segurança da Informação ("Política") estabelece as diretrizes, responsabilidades e controles adotados pela <strong>PRAEFECTUS DADOS E CORPORATIVO LTDA</strong> ("PRAEFECTUS") para a proteção dos dados pessoais, informações corporativas e sistemas que compõem a plataforma <strong>PRAEFECTUS</strong> ("Plataforma").<br /><br />

                  1.2. Esta Política tem por objetivo assegurar a proteção adequada dos ativos de informação contra ameaças internas e externas, acidentais ou deliberadas, em conformidade com a <strong>Lei nº 13.709/2018</strong> (Lei Geral de Proteção de Dados Pessoais – LGPD), a <strong>Lei nº 12.965/2014</strong> (Marco Civil da Internet) e o <strong>Decreto nº 8.771/2016</strong>.<br /><br />

                  1.3. As disposições desta Política aplicam-se a todos os USUÁRIOS da Plataforma, colaboradores, prestadores de serviço e terceiros que acessem ou processem informações no âmbito da Plataforma.
                </p>
              </section>

              {/* 2 */}
              <section>
                <h2 className="mb-3 border-b border-border pb-2 text-xl font-semibold leading-7 text-foreground">2. PRINCÍPIOS</h2>
                <p className="text-base leading-6 text-muted-foreground">
                  A Política fundamenta-se nos três pilares da segurança da informação, em conformidade com os princípios previstos no <strong>Art. 6º da LGPD</strong> e com as boas práticas internacionais:<br /><br />

                  a) <strong>Confidencialidade:</strong> garantia de que as informações sejam acessadas exclusivamente por pessoas autorizadas, conforme o princípio da necessidade de conhecer (<em>need-to-know</em>). Os controles de acesso são implementados com base no modelo de privilégio mínimo, assegurando que cada USUÁRIO acesse apenas os dados e funcionalidades pertinentes ao seu perfil e ao plano contratado;<br /><br />

                  b) <strong>Integridade:</strong> garantia de que as informações sejam mantidas íntegras, precisas e completas durante todo o ciclo de vida, protegidas contra alterações não autorizadas, corrupção acidental ou destruição indevida. A Plataforma emprega mecanismos de validação, trilhas de auditoria e controles de versão para assegurar a confiabilidade dos dados;<br /><br />

                  c) <strong>Disponibilidade:</strong> garantia de que as informações e os serviços estejam acessíveis e operacionais quando necessário, dentro dos níveis de serviço aplicáveis. A Plataforma adota medidas de redundância, monitoramento contínuo e procedimentos de recuperação para minimizar interrupções não planejadas.
                </p>
              </section>

              {/* 3 */}
              <section>
                <h2 className="mb-3 border-b border-border pb-2 text-xl font-semibold leading-7 text-foreground">3. CONTROLES INSTITUCIONAIS</h2>
                <p className="text-base leading-6 text-muted-foreground">
                  A PRAEFECTUS adota medidas técnicas e administrativas aptas a proteger os dados pessoais e os ativos de informação, nos termos do <strong>Art. 46 da LGPD</strong> e do <strong>Art. 13 do Decreto nº 8.771/2016</strong>. Os controles incluem, de forma não exaustiva:<br /><br />

                  <strong>3.1. Controle de Acesso</strong><br />
                  O acesso à Plataforma e aos dados nela armazenados é controlado por modelo de autorização baseado em papéis (RBAC – <em>Role-Based Access Control</em>), implementado com separação por tenant, função e módulo. Cada USUÁRIO acessa exclusivamente os dados e funcionalidades pertinentes ao seu perfil, empresa e plano contratado. Privilégios administrativos são atribuídos de forma restritiva e auditável.<br /><br />

                  <strong>3.2. Autenticação</strong><br />
                  A Plataforma implementa autenticação segura com confirmação de e-mail obrigatória, expiração controlada de sessões, renovação segura de tokens e invalidação em caso de logout ou alteração de credenciais. A PRAEFECTUS recomenda a utilização de senhas fortes e a adoção de boas práticas de segurança pelos USUÁRIOS.<br /><br />

                  <strong>3.3. Monitoramento</strong><br />
                  A Plataforma mantém monitoramento contínuo de eventos de segurança, incluindo tentativas de autenticação, acessos a recursos críticos, alterações de configuração e falhas de sistema. Mecanismos de detecção de anomalias e de limitação de taxa (<em>rate limiting</em>) são empregados para identificar e mitigar comportamentos potencialmente maliciosos.<br /><br />

                  <strong>3.4. Registros de Acesso (Logs)</strong><br />
                  Os registros de acesso a aplicações de internet são armazenados de forma segura pelo prazo mínimo de <strong>6 (seis) meses</strong>, conforme <strong>Art. 15 da Lei nº 12.965/2014</strong>. Os logs incluem, no mínimo: identificação do USUÁRIO, data e horário de acesso, endereço IP de origem e ações realizadas. Os registros são mantidos em ambiente protegido, com acesso restrito a pessoal autorizado.<br /><br />

                  <strong>3.5. Backups</strong><br />
                  A Plataforma dispõe de sistema de backup agendado com verificação de integridade, histórico de execuções e armazenamento em ambiente seguro. A frequência dos backups é configurável (diário, semanal, mensal) e alertas automáticos são emitidos em caso de falha na execução. Os procedimentos de restauração são testados periodicamente.
                </p>
              </section>

              {/* 4 */}
              <section>
                <h2 className="mb-3 border-b border-border pb-2 text-xl font-semibold leading-7 text-foreground">4. RESPONSABILIDADES</h2>
                <p className="text-base leading-6 text-muted-foreground">
                  <strong>4.1. Responsabilidades dos USUÁRIOS</strong><br /><br />
                  a) Manter a confidencialidade de suas credenciais de acesso e não compartilhá-las com terceiros;<br />
                  b) Comunicar imediatamente à PRAEFECTUS qualquer uso não autorizado de sua conta ou suspeita de violação de segurança;<br />
                  c) Utilizar a Plataforma em conformidade com a legislação vigente, com os Termos de Uso e com a presente Política;<br />
                  d) Não inserir na Plataforma conteúdo malicioso, vírus ou qualquer elemento que possa comprometer a segurança do ambiente;<br />
                  e) Manter atualizados seus dados cadastrais e informações de contato.<br /><br />

                  <strong>4.2. Responsabilidades dos Administradores</strong><br /><br />
                  a) Gerenciar os acessos dos USUÁRIOS vinculados à sua organização, observando o princípio do privilégio mínimo;<br />
                  b) Monitorar as atividades dos colaboradores sob sua responsabilidade e reportar comportamentos anômalos;<br />
                  c) Garantir que os USUÁRIOS sob sua gestão conheçam e cumpram esta Política e os Termos de Uso;<br />
                  d) Colaborar com a PRAEFECTUS na investigação de incidentes de segurança, quando solicitado.<br /><br />

                  <strong>4.3. Responsabilidades da PRAEFECTUS</strong><br /><br />
                  a) Implementar e manter medidas técnicas e administrativas de segurança proporcionais aos riscos envolvidos no tratamento de dados, nos termos do <strong>Art. 46 da LGPD</strong>;<br />
                  b) Designar e manter um Encarregado de Proteção de Dados (DPO), conforme <strong>Art. 41 da LGPD</strong>;<br />
                  c) Comunicar aos TITULARES e à ANPD a ocorrência de incidentes de segurança que possam acarretar risco ou dano relevante, conforme <strong>Art. 48 da LGPD</strong>;<br />
                  d) Revisar periodicamente esta Política e os controles de segurança implementados;<br />
                  e) Assegurar que operadores e prestadores de serviço que tratem dados em seu nome adotem medidas de segurança compatíveis.
                </p>
              </section>

              {/* 5 */}
              <section>
                <h2 className="mb-3 border-b border-border pb-2 text-xl font-semibold leading-7 text-foreground">5. GESTÃO DE INCIDENTES DE SEGURANÇA</h2>
                <p className="text-base leading-6 text-muted-foreground">
                  A PRAEFECTUS mantém procedimentos estruturados para gestão de incidentes de segurança da informação, abrangendo as seguintes etapas:<br /><br />

                  <strong>5.1. Identificação</strong><br />
                  Incidentes de segurança são identificados por meio de monitoramento contínuo, alertas automatizados, análise de logs e comunicações de USUÁRIOS ou colaboradores. Qualquer evento que possa comprometer a confidencialidade, a integridade ou a disponibilidade dos dados ou sistemas é classificado e registrado para análise.<br /><br />

                  <strong>5.2. Resposta</strong><br />
                  Após a identificação, a equipe responsável avalia a gravidade do incidente, isola os sistemas afetados quando necessário e adota medidas imediatas para conter a ameaça. A avaliação inclui a determinação da natureza dos dados afetados, o volume de registros envolvidos, os riscos para os titulares e a necessidade de comunicação à ANPD e aos titulares, nos termos do <strong>Art. 48 da LGPD</strong>.<br /><br />

                  <strong>5.3. Mitigação e Recuperação</strong><br />
                  Após a contenção, são implementadas medidas corretivas para eliminar a causa raiz do incidente, restaurar os serviços afetados e prevenir a recorrência. O incidente é documentado com registro de: cronologia dos eventos, dados afetados, medidas adotadas, resultados obtidos e lições aprendidas. A documentação é mantida para fins de auditoria e conformidade.
                </p>
              </section>

              {/* 6 */}
              <section>
                <h2 className="mb-3 border-b border-border pb-2 text-xl font-semibold leading-7 text-foreground">6. TRATAMENTO DE DADOS PESSOAIS</h2>
                <p className="text-base leading-6 text-muted-foreground">
                  6.1. O tratamento de dados pessoais pela PRAEFECTUS observa integralmente os princípios e as disposições da <strong>Lei nº 13.709/2018</strong> (LGPD), em especial os princípios da finalidade, adequação, necessidade, livre acesso, qualidade dos dados, transparência, segurança, prevenção, não discriminação e responsabilização, previstos no <strong>Art. 6º da LGPD</strong>.<br /><br />

                  6.2. A segregação lógica de dados é implementada por meio de isolamento multi-tenant com políticas de segurança em nível de linha (RLS), garantindo que cada organização cliente acesse exclusivamente seus próprios registros.<br /><br />

                  6.3. Dados pessoais sensíveis, como certificados digitais, são processados exclusivamente em memória volátil, sem armazenamento permanente, em conformidade com o <strong>Art. 11 da LGPD</strong>.<br /><br />

                  6.4. Credenciais de portais e informações sensíveis são protegidas por criptografia em repouso e em trânsito, com chaves gerenciadas de forma segura.<br /><br />

                  6.5. Para informações detalhadas sobre categorias de dados coletados, finalidades, bases legais, compartilhamento, retenção e direitos do titular, consulte a <a href="/politica-de-privacidade" className="text-primary hover:underline">Política de Privacidade</a>.
                </p>
              </section>

              {/* 7 */}
              <section>
                <h2 className="mb-3 border-b border-border pb-2 text-xl font-semibold leading-7 text-foreground">7. CONTINUIDADE DO SERVIÇO</h2>
                <p className="text-base leading-6 text-muted-foreground">
                  7.1. A PRAEFECTUS adota medidas para assegurar a disponibilidade e a continuidade operacional da Plataforma, incluindo:<br /><br />

                  a) <strong>Redundância de infraestrutura:</strong> utilização de provedores de nuvem com replicação geográfica e failover automático para minimizar o impacto de falhas de hardware ou rede;<br /><br />

                  b) <strong>Backups e recuperação:</strong> procedimentos de backup agendado com verificação de integridade e testes periódicos de restauração, conforme descrito na Seção 3.5;<br /><br />

                  c) <strong>Monitoramento de disponibilidade:</strong> monitoramento contínuo do status dos serviços, com painel de status público acessível em <a href="/status" className="text-primary hover:underline">praefectus.com.br/status</a>, para transparência sobre a disponibilidade da Plataforma;<br /><br />

                  d) <strong>Modo de manutenção:</strong> em situações que demandem intervenções críticas, a Plataforma poderá ser colocada em modo de manutenção, com acesso temporariamente restrito, mediante comunicação prévia aos USUÁRIOS quando possível.<br /><br />

                  7.2. A PRAEFECTUS <strong>não garante disponibilidade ininterrupta</strong> da Plataforma, reconhecendo que interrupções podem ocorrer em decorrência de manutenções programadas, atualizações, falhas de terceiros, caso fortuito ou força maior. A PRAEFECTUS compromete-se a envidar esforços razoáveis para restabelecer o serviço no menor tempo possível.
                </p>
              </section>

              {/* 8 */}
              <section>
                <h2 className="mb-3 border-b border-border pb-2 text-xl font-semibold leading-7 text-foreground">8. REVISÃO PERIÓDICA</h2>
                <p className="text-base leading-6 text-muted-foreground">
                  8.1. Esta Política será revisada periodicamente, no mínimo <strong>a cada 12 (doze) meses</strong>, ou sempre que houver alterações significativas na legislação aplicável, nos controles de segurança implementados ou no escopo dos serviços prestados pela Plataforma.<br /><br />

                  8.2. As revisões serão conduzidas pela equipe de segurança da informação em conjunto com o Encarregado de Proteção de Dados (DPO), e as alterações serão comunicadas aos USUÁRIOS por meio de notificação na Plataforma ou por e-mail.<br /><br />

                  8.3. A data da última revisão será indicada no topo deste documento.
                </p>
              </section>

              {/* 9 */}
              <section>
                <h2 className="mb-3 border-b border-border pb-2 text-xl font-semibold leading-7 text-foreground">9. LEGISLAÇÃO APLICÁVEL</h2>
                <p className="text-base leading-6 text-muted-foreground">
                  Esta Política é regida pelas seguintes normas:<br /><br />

                  • <strong>Lei nº 13.709/2018</strong> – Lei Geral de Proteção de Dados Pessoais (LGPD)<br />
                  • <strong>Lei nº 12.965/2014</strong> – Marco Civil da Internet<br />
                  • <strong>Decreto nº 8.771/2016</strong> – Regulamentação do Marco Civil da Internet<br />
                  • <strong>Constituição Federal de 1988</strong>, Art. 5º, X e XII – Direitos fundamentais à intimidade e ao sigilo de dados
                </p>
              </section>
            </div>

            {/* Certifications / Compliance Status — estado em selo semântico com texto. */}
            <section className="mb-12">
              <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold leading-7 text-foreground">
                <BadgeCheck className="h-5 w-5 text-muted-foreground" aria-hidden="true" /> Conformidade e Certificações
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {certifications.map((c) => (
                  <div key={c.name} className={`rounded-lg border p-4 ${c.done ? 'border-success-line bg-success-tint' : 'border-border bg-card shadow-sm'}`}>
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Badge variant={c.done ? 'success' : 'muted'}>{c.status}</Badge>
                      <span className="text-base font-medium text-foreground">{c.name}</span>
                    </div>
                    <p className="mt-1 text-xs leading-4 text-muted-foreground">{c.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Controls grid — cartões compactos com o ícone num ladrilho neutro. */}
            <section className="mb-12">
              <h2 className="mb-4 text-xl font-semibold leading-7 text-foreground">Controles Técnicos Implementados</h2>
              <div className="space-y-3">
                {controls.map((c) => (
                  <div key={c.title} className="rounded-lg border border-border bg-card p-5 shadow-sm">
                    <div className="flex items-start gap-4">
                      <span aria-hidden="true" className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <c.icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="mb-1 text-base font-semibold text-foreground">{c.title}</h3>
                        <p className="text-sm leading-5 text-muted-foreground">{c.desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Related links */}
            <div className="mb-12 grid gap-3 sm:grid-cols-3">
              <Link to="/politica-de-privacidade" className={LINK_RELACIONADO}>
                <FileCheck className="mb-2 h-5 w-5 text-muted-foreground" aria-hidden="true" />
                <p className="text-base font-medium text-foreground transition-colors group-hover:text-primary">Política de Privacidade</p>
                <p className="mt-1 text-xs text-muted-foreground">Tratamento de dados pessoais</p>
              </Link>
              <Link to="/lgpd" className={LINK_RELACIONADO}>
                <Lock className="mb-2 h-5 w-5 text-muted-foreground" aria-hidden="true" />
                <p className="text-base font-medium text-foreground transition-colors group-hover:text-primary">Conformidade LGPD</p>
                <p className="mt-1 text-xs text-muted-foreground">Bases legais e direitos do titular</p>
              </Link>
              <Link to="/status" className={LINK_RELACIONADO}>
                <Server className="mb-2 h-5 w-5 text-muted-foreground" aria-hidden="true" />
                <p className="text-base font-medium text-foreground transition-colors group-hover:text-primary">Status da Plataforma</p>
                <p className="mt-1 text-xs text-muted-foreground">Disponibilidade em tempo real</p>
              </Link>
            </div>

            {/* DPO Contact */}
            <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <p className="mb-2 flex items-center gap-2 text-lg font-semibold leading-6 text-foreground">
                <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Contato do Encarregado de Dados (DPO)
              </p>
              <p className="mb-3 max-w-3xl text-sm leading-5 text-muted-foreground">
                Para exercer seus direitos como titular de dados, relatar incidentes de segurança ou solicitar informações sobre o tratamento de dados pessoais, entre em contato com nosso DPO:
              </p>
              <a href="mailto:dpo@praefectus.com.br" className="inline-flex items-center gap-2 rounded-md text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                dpo@praefectus.com.br <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>
          </div>
        </main>
        <LandingFooter />
      </div>
    </>
  );
}
