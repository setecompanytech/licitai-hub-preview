import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Menu, X } from 'lucide-react';
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
    { label: 'Funcionalidades', href: '#features' },
    { label: 'Portais', href: '#portais' },
    { label: 'Planos', href: '#planos' },
    { label: 'Depoimentos', href: '#depoimentos' },
    { label: 'FAQ', href: '#faq' },
  ];

  return (
    <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${
      scrolled
        ? 'bg-background/95 backdrop-blur-lg border-b border-border shadow-sm'
        : 'bg-transparent'
    }`}>
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="#" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">P</span>
          </div>
          <span className={`text-xl font-brand font-bold tracking-[0.2em] uppercase transition-colors duration-300 ${
            scrolled ? 'text-foreground' : 'text-white'
          }`}>
            PRAEFECTUS
          </span>
        </a>

        <div className="hidden lg:flex items-center gap-1">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={`px-3.5 py-2 text-[13px] font-medium transition-colors rounded-md ${
                scrolled
                  ? 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              {l.label}
            </a>
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
            className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-md font-semibold text-[13px] px-5"
            onClick={() => navigate('/auth')}
          >
            Começar Agora <ArrowRight className="w-3.5 h-3.5 ml-1" />
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
            className="lg:hidden border-t border-border bg-background/98 backdrop-blur-xl overflow-hidden"
          >
            <div className="px-6 py-4 space-y-1">
              {links.map((l) => (
                <a key={l.href} href={l.href} onClick={() => setMobileOpen(false)}
                  className="block px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground rounded-md hover:bg-muted/40">
                  {l.label}
                </a>
              ))}
              <div className="pt-3 flex flex-col gap-2">
                <Button variant="outline" className="w-full" onClick={() => navigate('/auth')}>Entrar</Button>
                <Button className="w-full bg-primary text-primary-foreground" onClick={() => navigate('/auth')}>Começar Agora</Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
