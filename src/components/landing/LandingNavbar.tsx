import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import PraefectusLogo from '@/components/shared/PraefectusLogo';

export default function LandingNavbar() {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const links = [
    { label: 'Como Funciona', href: '#como-funciona' },
    { label: 'Funcionalidades', href: '#features' },
    { label: 'Segmentos', href: '#segmentos' },
    { label: 'Planos', href: '#planos' },
    { label: 'Segurança', onClick: () => navigate('/seguranca-informacao') },
    { label: 'Status', onClick: () => navigate('/status') },
  ];

  return (
    <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${
      scrolled
        ? 'bg-background/95 backdrop-blur-lg border-b border-border shadow-sm'
        : 'bg-transparent'
    }`}>
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2.5">
          <PraefectusLogo size="lg" variant={scrolled ? 'default' : 'light'} />
        </a>

        <div className="hidden lg:flex items-center gap-1">
          {links.map((l) => (
            'onClick' in l && l.onClick ? (
              <button
                key={l.label}
                onClick={l.onClick}
                className={`px-3 py-2 text-[13px] font-medium transition-colors rounded-md ${
                  scrolled
                    ? 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                {l.label}
              </button>
            ) : (
              <a
                key={l.label}
                href={(l as any).href}
                className={`px-3 py-2 text-[13px] font-medium transition-colors rounded-md ${
                  scrolled
                    ? 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                {l.label}
              </a>
            )
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className={`text-[13px] font-semibold ${scrolled ? '' : 'text-white hover:text-white hover:bg-white/10'}`}
            onClick={() => navigate('/auth')}
          >
            Entrar
          </Button>
          <Button
            size="sm"
            className="bg-accent hover:bg-accent/90 text-accent-foreground text-[13px] font-bold rounded-lg"
            onClick={() => navigate('/auth?step=signup')}
          >
            Criar Conta
          </Button>
        </div>

        <button className="lg:hidden p-2" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen
            ? <X className={`w-5 h-5 ${scrolled ? 'text-foreground' : 'text-white'}`} />
            : <Menu className={`w-5 h-5 ${scrolled ? 'text-foreground' : 'text-white'}`} />
          }
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="lg:hidden border-t border-border bg-card shadow-lg overflow-hidden"
          >
            <div className="px-6 py-4 space-y-1">
              {links.map((l) => (
                'onClick' in l && l.onClick ? (
                  <button key={l.label} onClick={() => { setMobileOpen(false); l.onClick!(); }}
                    className="block w-full text-left px-4 py-2.5 text-sm text-foreground hover:text-accent font-medium rounded-md hover:bg-muted/60">
                    {l.label}
                  </button>
                ) : (
                  <a key={l.label} href={(l as any).href} onClick={() => setMobileOpen(false)}
                    className="block px-4 py-2.5 text-sm text-foreground hover:text-accent font-medium rounded-md hover:bg-muted/60">
                    {l.label}
                  </a>
                )
              ))}
              <div className="pt-3 flex flex-col gap-2">
                <Button variant="outline" className="w-full" onClick={() => navigate('/auth')}>Entrar</Button>
                <Button className="w-full bg-accent text-accent-foreground font-bold" onClick={() => navigate('/auth?step=signup')}>Criar Conta</Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
