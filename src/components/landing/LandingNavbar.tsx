import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, ArrowRight, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

export default function LandingNavbar() {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = [
    { label: 'Funcionalidades', href: '#features' },
    { label: 'Portais', href: '#portais' },
    { label: 'Treinamentos', href: '#treinamentos' },
    { label: 'Planos', href: '#planos' },
    { label: 'Depoimentos', href: '#depoimentos' },
    { label: 'FAQ', href: '#faq' },
  ];

  return (
    <nav className="fixed top-0 w-full z-50 bg-background/70 backdrop-blur-2xl border-b border-border/40">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center shadow-lg" style={{ boxShadow: 'var(--shadow-glow)' }}>
            <Zap className="w-5 h-5 text-accent-foreground" />
          </div>
          <span className="text-xl font-extrabold tracking-tight">
            Licit<span className="gradient-text">IA</span>
          </span>
        </div>

        <div className="hidden lg:flex items-center gap-1">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="px-3.5 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted/50"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/auth')}>
            Entrar
          </Button>
          <Button
            size="sm"
            className="bg-accent hover:bg-accent/90 text-accent-foreground rounded-xl shadow-lg"
            style={{ boxShadow: 'var(--shadow-glow)' }}
            onClick={() => navigate('/auth')}
          >
            Começar Grátis <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>

        <button className="lg:hidden p-2" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="lg:hidden border-t border-border/40 bg-background/95 backdrop-blur-2xl overflow-hidden"
          >
            <div className="px-6 py-4 space-y-2">
              {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setMobileOpen(false)}
                  className="block px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50"
                >
                  {l.label}
                </a>
              ))}
              <div className="pt-3 flex flex-col gap-2">
                <Button variant="outline" className="w-full" onClick={() => navigate('/auth')}>Entrar</Button>
                <Button className="w-full bg-accent text-accent-foreground" onClick={() => navigate('/auth')}>Começar Grátis</Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
