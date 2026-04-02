import { Helmet } from 'react-helmet-async';
import LandingNavbar from '@/components/landing/LandingNavbar';
import LandingFooter from '@/components/landing/LandingFooter';

export default function PoliticaCookies() {
  return (
    <>
      <Helmet>
        <title>Política de Cookies | PRAEFECTUS</title>
        <meta name="description" content="Política de Cookies da PRAEFECTUS — tipos de cookies utilizados, finalidades, consentimento e gerenciamento, em conformidade com a LGPD." />
        <link rel="canonical" href="https://praefectus.com.br/politica-cookies" />
      </Helmet>
      <div className="min-h-screen bg-background">
        <LandingNavbar />
        <main className="pt-24 pb-20 px-6">
          <div className="max-w-3xl mx-auto">
            <div className="mb-12">
              <p className="text-xs font-semibold tracking-widest text-accent uppercase mb-3">Política de Cookies</p>
              <h1 className="text-3xl font-bold tracking-tight mb-4">Política de Cookies e Tecnologias de Rastreamento</h1>
              <p className="text-sm text-muted-foreground">Última atualização: 02 de abril de 2026</p>
            </div>

            <div className="prose prose-sm max-w-none text-foreground space-y-8 leading-relaxed">

              {/* 1 */}
              <section>
                <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">1. O QUE SÃO COOKIES</h2>
                <p className="text-sm text-muted-foreground">
                  1.1. Cookies são pequenos arquivos de texto armazenados no dispositivo do USUÁRIO (computador, tablet ou smartphone) pelo navegador de internet quando este acessa um site ou aplicação web.<br /><br />

                  1.2. Os cookies permitem que a Plataforma reconheça o dispositivo do USUÁRIO em acessos subsequentes, armazene preferências de navegação, mantenha sessões de autenticação ativas e colete dados estatísticos sobre o uso do serviço.<br /><br />

                  1.3. A presente Política de Cookies integra a <a href="/politica-de-privacidade" className="text-primary hover:underline">Política de Privacidade</a> da <strong>PRAEFECTUS DADOS E CORPORATIVO LTDA</strong> ("PRAEFECTUS") e descreve as categorias de cookies e tecnologias correlatas utilizadas pela plataforma <strong>PRAEFECTUS</strong> ("Plataforma"), suas finalidades e as opções de gerenciamento disponíveis ao USUÁRIO, em conformidade com a <strong>Lei nº 13.709/2018</strong> (LGPD) e a <strong>Lei nº 12.965/2014</strong> (Marco Civil da Internet).
                </p>
              </section>

              {/* 2 */}
              <section>
                <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">2. TIPOS DE COOKIES UTILIZADOS</h2>
                <p className="text-sm text-muted-foreground">
                  A Plataforma utiliza as seguintes categorias de cookies e tecnologias de armazenamento local:<br /><br />

                  <strong>2.1. Cookies Essenciais (Estritamente Necessários)</strong><br /><br />
                  São indispensáveis ao funcionamento básico da Plataforma e não podem ser desativados sem comprometimento do serviço. Incluem:<br /><br />

                  a) <strong>Autenticação e sessão:</strong> tokens de autenticação (JWT) e tokens de renovação (<em>refresh tokens</em>), necessários para manter o USUÁRIO autenticado e garantir a segurança da sessão;<br />
                  b) <strong>Preferências de sistema:</strong> tema de interface (claro/escuro), empresa selecionada, idioma e configurações de exibição;<br />
                  c) <strong>Segurança:</strong> proteção contra ataques de falsificação de requisição (<em>CSRF</em>) e controle de integridade de sessão.<br /><br />

                  <strong>Base legal:</strong> legítimo interesse do controlador (Art. 7º, IX, da LGPD) e execução contratual (Art. 7º, V, da LGPD). Estes cookies são ativados automaticamente e sua desativação impede o uso adequado da Plataforma.<br /><br />

                  <strong>2.2. Cookies de Desempenho</strong><br /><br />
                  Coletam informações agregadas e anonimizadas sobre o desempenho da Plataforma, permitindo a identificação de erros, gargalos de performance e oportunidades de otimização. Incluem:<br /><br />

                  a) Métricas de tempo de carregamento de páginas e funcionalidades;<br />
                  b) Registro de erros de execução para diagnóstico e correção;<br />
                  c) Dados de estabilidade do serviço.<br /><br />

                  <strong>Base legal:</strong> legítimo interesse do controlador (Art. 7º, IX, da LGPD), observado o princípio da necessidade e a anonimização dos dados coletados.<br /><br />

                  <strong>2.3. Cookies Analíticos</strong><br /><br />
                  Utilizados para compreender como os USUÁRIOS interagem com a Plataforma, com o objetivo de aprimorar a experiência do produto. Incluem:<br /><br />

                  a) Páginas visitadas e fluxos de navegação;<br />
                  b) Tempo de permanência por funcionalidade;<br />
                  c) Origem do acesso e padrões de uso agregados.<br /><br />

                  <strong>Base legal:</strong> consentimento do titular (Art. 7º, I, da LGPD). Os cookies analíticos somente são ativados após o consentimento expresso do USUÁRIO, por meio do banner de consentimento exibido no primeiro acesso à Plataforma. Os dados coletados são anonimizados e <strong>não são compartilhados com terceiros para fins de publicidade</strong>.<br /><br />

                  <strong>2.4. Armazenamento Local (LocalStorage / SessionStorage)</strong><br /><br />
                  Além de cookies, a Plataforma utiliza mecanismos de armazenamento local do navegador para manter estados de interface, cache de dados de sessão e preferências de configuração. Esses dados permanecem exclusivamente no dispositivo do USUÁRIO e são removidos automaticamente ao encerrar a sessão (SessionStorage) ou conforme a política de retenção aplicável (LocalStorage).
                </p>
              </section>

              {/* 3 */}
              <section>
                <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">3. FINALIDADE DO USO DE COOKIES</h2>
                <p className="text-sm text-muted-foreground">
                  Os cookies e tecnologias correlatas são utilizados pela Plataforma para as seguintes finalidades:<br /><br />

                  a) <strong>Operação do serviço:</strong> manter a autenticação do USUÁRIO, gerenciar sessões, preservar preferências de interface e garantir o funcionamento seguro da Plataforma;<br /><br />

                  b) <strong>Segurança:</strong> prevenir fraudes, proteger contra acessos não autorizados e monitorar a integridade das sessões;<br /><br />

                  c) <strong>Melhoria contínua:</strong> identificar erros, otimizar o desempenho e aprimorar a experiência do USUÁRIO com base em dados agregados e anonimizados;<br /><br />

                  d) <strong>Análise estatística:</strong> compreender padrões de uso para orientar decisões de produto, exclusivamente com dados anonimizados e mediante consentimento prévio;<br /><br />

                  e) <strong>Privacidade em áreas sensíveis:</strong> a Plataforma <strong>não carrega</strong> cookies analíticos ou scripts de rastreamento em páginas de autenticação e recuperação de senha, em observância ao princípio da minimização previsto no <strong>Art. 6º, III, da LGPD</strong>.
                </p>
              </section>

              {/* 4 */}
              <section>
                <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">4. GERENCIAMENTO DE COOKIES PELO USUÁRIO</h2>
                <p className="text-sm text-muted-foreground">
                  4.1. O USUÁRIO poderá gerenciar suas preferências de cookies das seguintes formas:<br /><br />

                  a) <strong>Banner de consentimento:</strong> no primeiro acesso à Plataforma, um banner de consentimento permite ao USUÁRIO optar entre aceitar apenas cookies essenciais ou aceitar todas as categorias de cookies. A escolha do USUÁRIO é registrada e respeitada em acessos subsequentes;<br /><br />

                  b) <strong>Configurações do navegador:</strong> o USUÁRIO poderá, a qualquer tempo, configurar seu navegador para bloquear, excluir ou gerenciar cookies. Cada navegador possui procedimentos específicos, geralmente acessíveis por meio do menu de configurações ou preferências de privacidade;<br /><br />

                  c) <strong>Revogação de consentimento:</strong> o USUÁRIO poderá revogar o consentimento para cookies analíticos a qualquer momento, limpando os cookies do navegador ou ajustando suas preferências no banner de consentimento.<br /><br />

                  4.2. A desativação de <strong>cookies essenciais</strong> poderá impactar funcionalidades críticas da Plataforma, como autenticação, manutenção de sessão e preferências de interface, podendo tornar o serviço parcial ou totalmente indisponível.<br /><br />

                  4.3. A desativação de <strong>cookies analíticos ou de desempenho</strong> não afeta o funcionamento das funcionalidades essenciais da Plataforma.
                </p>
              </section>

              {/* 5 */}
              <section>
                <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">5. CONSENTIMENTO</h2>
                <p className="text-sm text-muted-foreground">
                  5.1. <strong>Cookies essenciais</strong> são ativados automaticamente, sem necessidade de consentimento prévio, por serem indispensáveis à prestação do serviço contratado, com fundamento no <strong>Art. 7º, V e IX, da LGPD</strong>.<br /><br />

                  5.2. <strong>Cookies analíticos</strong> somente são ativados mediante <strong>consentimento prévio, livre, informado e inequívoco</strong> do USUÁRIO, manifestado por meio do banner de consentimento, em conformidade com o <strong>Art. 7º, I, e Art. 8º da LGPD</strong>.<br /><br />

                  5.3. O consentimento poderá ser <strong>revogado a qualquer tempo</strong>, sem prejuízo da licitude do tratamento realizado anteriormente, nos termos do <strong>Art. 8º, §5º, da LGPD</strong>.<br /><br />

                  5.4. A recusa em consentir com cookies analíticos não limita o acesso às funcionalidades da Plataforma nem constitui condição para a prestação do serviço.
                </p>
              </section>

              {/* 6 */}
              <section>
                <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">6. COOKIES DE TERCEIROS</h2>
                <p className="text-sm text-muted-foreground">
                  6.1. A Plataforma poderá utilizar cookies originados por terceiros em contextos específicos, incluindo:<br /><br />

                  a) <strong>Processadores de pagamento</strong> (Stripe): para processamento seguro de transações financeiras e gestão de assinaturas;<br />
                  b) <strong>Serviços de e-mail transacional:</strong> para envio de comunicações operacionais;<br />
                  c) <strong>APIs de portais governamentais:</strong> para consultas a portais de compras públicas, quando aplicável.<br /><br />

                  6.2. Cada provedor terceiro opera sob sua própria política de cookies e privacidade. A PRAEFECTUS não controla os cookies de terceiros, mas seleciona provedores que adotem práticas compatíveis com a LGPD.
                </p>
              </section>

              {/* 7 */}
              <section>
                <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">7. RETENÇÃO</h2>
                <p className="text-sm text-muted-foreground">
                  7.1. <strong>Cookies de sessão:</strong> são removidos automaticamente ao encerrar o navegador.<br /><br />

                  7.2. <strong>Cookies persistentes:</strong> são mantidos por prazo máximo de <strong>12 (doze) meses</strong>, conforme a necessidade operacional de cada cookie, sendo renovados mediante novo consentimento quando aplicável.<br /><br />

                  7.3. O USUÁRIO poderá solicitar a remoção de dados coletados por meio de cookies a qualquer tempo, por meio do canal do Encarregado de Proteção de Dados: <a href="mailto:dpo@praefectus.com.br" className="text-primary hover:underline">dpo@praefectus.com.br</a>.
                </p>
              </section>

              {/* 8 */}
              <section>
                <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">8. ATUALIZAÇÕES DESTA POLÍTICA</h2>
                <p className="text-sm text-muted-foreground">
                  8.1. A PRAEFECTUS reserva-se o direito de atualizar esta Política de Cookies a qualquer tempo, para adequação a alterações tecnológicas, legais ou operacionais.<br /><br />

                  8.2. As alterações serão comunicadas ao USUÁRIO por meio de atualização do banner de consentimento ou notificação na Plataforma. A data da última atualização será indicada no topo deste documento.<br /><br />

                  8.3. A continuidade de uso da Plataforma após a publicação das alterações, associada à manutenção do consentimento para cookies não essenciais, constituirá aceitação dos novos termos.
                </p>
              </section>

            </div>

            <div className="mt-12 pt-8 border-t border-border text-xs text-muted-foreground">
              <p>Para dúvidas sobre esta política, entre em contato com o Encarregado de Proteção de Dados (DPO): <strong><a href="mailto:dpo@praefectus.com.br" className="text-primary hover:underline">dpo@praefectus.com.br</a></strong></p>
            </div>
          </div>
        </main>
        <LandingFooter />
      </div>
    </>
  );
}
