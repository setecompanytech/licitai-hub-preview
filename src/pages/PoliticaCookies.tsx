import { Helmet } from 'react-helmet-async';
import LandingNavbar from '@/components/landing/LandingNavbar';
import LandingFooter from '@/components/landing/LandingFooter';

const sections = [
  {
    title: '1. O que são Cookies',
    content: 'Cookies são pequenos arquivos de texto armazenados no dispositivo do usuário quando este acessa um site. Eles permitem que o site reconheça o dispositivo e armazene informações sobre preferências, sessão de autenticação e comportamento de navegação.',
  },
  {
    title: '2. Cookies Utilizados pela PRAEFECTUS',
    content: null,
    items: [
      { name: 'Cookies Essenciais', desc: 'Necessários para o funcionamento básico da plataforma, incluindo autenticação (JWT/refresh token), manutenção de sessão e preferências de idioma e tema. Não podem ser desabilitados.' },
      { name: 'Cookies de Desempenho', desc: 'Coletam informações agregadas e anônimas sobre como os usuários utilizam a plataforma (páginas visitadas, tempo de permanência, erros encontrados). Utilizados exclusivamente para melhorar a experiência do produto.' },
      { name: 'Cookies de Funcionalidade', desc: 'Armazenam preferências do usuário como tema (claro/escuro), empresa selecionada, filtros de monitoramento e configurações de exibição.' },
      { name: 'Cookies de Análise (Analytics)', desc: 'Quando autorizados pelo usuário, utilizamos ferramentas de análise para compreender padrões de uso agregados. Os dados coletados são anonimizados e não são compartilhados com terceiros para fins de publicidade.' },
    ],
  },
  {
    title: '3. Armazenamento Local (LocalStorage / SessionStorage)',
    content: 'Além de cookies, a PRAEFECTUS utiliza mecanismos de armazenamento local do navegador para manter estados de interface, cache de dados de sessão e preferências de configuração. Esses dados permanecem exclusivamente no dispositivo do usuário e são limpos automaticamente ao encerrar a sessão ou conforme política de retenção.',
  },
  {
    title: '4. Cookies de Terceiros',
    content: 'A plataforma pode utilizar cookies de terceiros em contextos específicos: Stripe (processamento de pagamentos), serviços de e-mail transacional e APIs de portais de compras públicas. Cada provedor opera sob sua própria política de cookies e privacidade.',
  },
  {
    title: '5. Gestão de Cookies',
    content: 'O usuário pode gerenciar cookies a qualquer momento por meio das configurações do navegador. A desabilitação de cookies essenciais pode impactar funcionalidades críticas como autenticação e manutenção de sessão. Cookies de análise e funcionalidade podem ser desabilitados sem impacto no funcionamento básico da plataforma.',
  },
  {
    title: '6. Base Legal',
    content: 'O uso de cookies essenciais é fundamentado no legítimo interesse do controlador (Art. 7°, IX da LGPD) para garantir a operação segura da plataforma. Cookies não essenciais são baseados no consentimento do titular (Art. 7°, I da LGPD).',
  },
  {
    title: '7. Retenção',
    content: 'Cookies de sessão são removidos automaticamente ao fechar o navegador. Cookies persistentes são mantidos por no máximo 12 meses, conforme necessidade operacional. O usuário pode solicitar a remoção de dados a qualquer momento pelo canal privacidade@praefectus.com.br.',
  },
  {
    title: '8. Atualizações',
    content: 'Esta política pode ser atualizada periodicamente para refletir mudanças tecnológicas ou legais. A data da última revisão é indicada ao final do documento. O uso continuado da plataforma após alterações constitui aceitação da política atualizada.',
  },
];

export default function PoliticaCookies() {
  return (
    <>
      <Helmet>
        <title>Política de Cookies | PRAEFECTUS</title>
        <meta name="description" content="Entenda como a PRAEFECTUS utiliza cookies, armazenamento local e tecnologias correlatas para garantir segurança e funcionalidade da plataforma." />
        <link rel="canonical" href="https://praefectus.com.br/politica-cookies" />
      </Helmet>
      <div className="min-h-screen bg-background">
        <LandingNavbar />
        <main className="pt-24 pb-20 px-6">
          <div className="max-w-3xl mx-auto">
            <div className="mb-12">
              <p className="text-xs font-semibold tracking-widest text-accent uppercase mb-3">Política de Cookies</p>
              <h1 className="text-3xl font-bold tracking-tight mb-4">Uso de Cookies e Tecnologias Correlatas</h1>
              <p className="text-sm text-muted-foreground">Última atualização: Março de 2026</p>
            </div>

            <div className="space-y-8">
              {sections.map((s) => (
                <section key={s.title}>
                  <h2 className="text-lg font-bold mb-3">{s.title}</h2>
                  {s.content && <p className="text-sm text-muted-foreground leading-relaxed">{s.content}</p>}
                  {s.items && (
                    <ul className="space-y-4 mt-3">
                      {s.items.map((item) => (
                        <li key={item.name}>
                          <p className="text-sm"><strong className="text-foreground">{item.name}:</strong>{' '}
                          <span className="text-muted-foreground">{item.desc}</span></p>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>

            <div className="mt-12 pt-8 border-t border-border text-xs text-muted-foreground">
              <p>Para dúvidas sobre esta política: <strong>privacidade@praefectus.com.br</strong></p>
            </div>
          </div>
        </main>
        <LandingFooter />
      </div>
    </>
  );
}
