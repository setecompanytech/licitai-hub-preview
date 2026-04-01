import { useNavigate } from 'react-router-dom';
import PraefectusLogo from '@/components/shared/PraefectusLogo';

export default function LandingFooter() {
  const navigate = useNavigate();

  const productLinks = [
    { label: 'Funcionalidades', href: '#features' },
    { label: 'Como Funciona', href: '#como-funciona' },
    { label: 'Segmentos Atendidos', href: '#segmentos' },
    { label: 'Portais Integrados', href: '#portais' },
    { label: 'Planos', href: '#planos' },
  ];

  const supportLinks = [
    { label: 'Central de Ajuda', onClick: () => navigate('/suporte') },
    { label: 'FAQ', onClick: () => navigate('/faq') },
    { label: 'E-book Gratuito', onClick: () => navigate('/ebook') },
    { label: 'Blog', onClick: () => navigate('/blog') },
    { label: 'Status da Plataforma', onClick: () => navigate('/status') },
  ];

  const securityLinks = [
    { label: 'Segurança da Informação', onClick: () => navigate('/seguranca-informacao') },
    { label: 'Compliance e Governança', onClick: () => navigate('/compliance') },
    { label: 'Privacidade e LGPD', onClick: () => navigate('/lgpd') },
    { label: 'Política de Privacidade', onClick: () => navigate('/politica-de-privacidade') },
    { label: 'Termos de Uso', onClick: () => navigate('/termos-de-uso') },
  ];

  return (
    <footer className="border-t border-border/30 py-14 px-6 bg-card">
      <div className="max-w-7xl mx-auto grid md:grid-cols-5 gap-10">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2.5 mb-4">
            <PraefectusLogo size="md" />
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mb-3">
            Plataforma de inteligência operacional para licitações públicas. Monitoramento, precificação, propostas e automação de lances com cobertura nacional.
          </p>
          <p className="text-[11px] text-muted-foreground/50 mb-4">
            Conforme Lei 14.133/2021 — Não substitui assessoria jurídica profissional.
          </p>
          <p className="text-[11px] text-muted-foreground/40">
            CNPJ: Em processo de registro · contato@praefectus.com.br
          </p>
        </div>

        <div>
          <h4 className="font-semibold text-sm mb-4">Produto</h4>
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            {productLinks.map((l) => (
              <li key={l.label}>
                <a href={l.href} className="hover:text-foreground transition-colors">{l.label}</a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="font-semibold text-sm mb-4">Suporte</h4>
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            {supportLinks.map((l) => (
              <li key={l.label}>
                <button onClick={l.onClick} className="hover:text-foreground transition-colors">{l.label}</button>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="font-semibold text-sm mb-4">Segurança e Legal</h4>
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            {securityLinks.map((l) => (
              <li key={l.label}>
                <button onClick={l.onClick} className="hover:text-foreground transition-colors">{l.label}</button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-10 pt-6 border-t border-border/20 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <span>© {new Date().getFullYear()} PRAEFECTUS. Todos os direitos reservados.</span>
        <div className="flex items-center gap-6 text-xs text-muted-foreground/50">
          <span>Criptografia AES-256</span>
          <span>Multi-tenant com RLS</span>
          <span>Conforme LGPD</span>
        </div>
      </div>
    </footer>
  );
}
