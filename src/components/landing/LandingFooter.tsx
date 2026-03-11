import { useNavigate } from 'react-router-dom';
import { Zap } from 'lucide-react';

export default function LandingFooter() {
  const navigate = useNavigate();

  const productLinks = [
    { label: 'Funcionalidades', href: '#features' },
    { label: 'Portais Integrados', href: '#portais' },
    { label: 'Preços', href: '#planos' },
    { label: 'FAQ', onClick: () => navigate('/faq') },
  ];

  const supportLinks = [
    { label: 'Central de Ajuda', onClick: () => navigate('/suporte') },
    { label: 'E-book Gratuito', onClick: () => navigate('/ebook') },
    { label: 'Blog', onClick: () => navigate('/blog') },
  ];

  const legalLinks = [
    { label: 'Termos de Uso', onClick: () => navigate('/termos-de-uso') },
    { label: 'Política de Privacidade', onClick: () => navigate('/politica-de-privacidade') },
    { label: 'LGPD', onClick: () => navigate('/lgpd') },
  ];

  return (
    <footer className="border-t border-border/30 py-14 px-6 bg-card">
      <div className="max-w-7xl mx-auto grid md:grid-cols-5 gap-10">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <Zap className="w-4 h-4 text-accent-foreground" />
            </div>
            <span className="text-lg font-brand font-bold tracking-widest uppercase">PRAEFECTUS</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mb-3">
            Plataforma de gestão e monitoramento de licitações com IA. Integrada com 38 portais em todos os 27 estados.
          </p>
          <p className="text-[11px] text-muted-foreground/40">
            Conforme Lei 14.133/2021 — Não substitui assessoria jurídica profissional.
          </p>
        </div>

        <div>
          <h4 className="font-bold text-sm mb-4">Produto</h4>
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            {productLinks.map((l) => (
              <li key={l.label}>
                {l.onClick ? (
                  <button onClick={l.onClick} className="hover:text-foreground transition-colors">{l.label}</button>
                ) : (
                  <a href={l.href} className="hover:text-foreground transition-colors">{l.label}</a>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-sm mb-4">Suporte</h4>
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            {supportLinks.map((l) => (
              <li key={l.label}>
                <button onClick={l.onClick} className="hover:text-foreground transition-colors">{l.label}</button>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-sm mb-4">Legal</h4>
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            {legalLinks.map((l) => (
              <li key={l.label}>
                <button onClick={l.onClick} className="hover:text-foreground transition-colors">{l.label}</button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-10 pt-6 border-t border-border/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>© {new Date().getFullYear()} Praefectus. Todos os direitos reservados.</span>
      </div>
    </footer>
  );
}
