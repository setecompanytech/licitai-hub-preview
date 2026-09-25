import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import PraefectusLogo from '@/components/shared/PraefectusLogo';
import { cn } from '@/lib/utils';

/**
 * O cabeçalho das páginas públicas secundárias (contato, soluções, sobre,
 * segurança, ajuda, investidores). A home tem o seu próprio (`lp-header`).
 *
 * É sempre sólido: fundo da página e texto escuro. A versão transparente com
 * texto branco, que só virava sólida depois de 20 px de rolagem, existia para
 * um herói escuro que nenhuma dessas páginas tem — todas abrem em
 * `bg-background`. Na /contato, o logotipo, o menu e o "Entrar" ficavam
 * brancos sobre branco até a pessoa rolar (25/09). Rolar agora só acrescenta
 * a borda e a sombra.
 *
 * Os itens apontam para páginas que existem. "Como funciona", "Segmentos" e
 * "Planos" levavam a âncoras (`#como-funciona`, `#segmentos`, `#planos`) que
 * não existem em página nenhuma: clique sem efeito.
 */
type ItemDoMenu =
  | { label: string; to: string }
  | { label: string; href: string };

export const ITENS_DO_MENU: ItemDoMenu[] = [
  { label: 'Soluções', to: '/solucoes' },
  { label: 'Como funciona', href: '/#processo' },
  { label: 'Sobre', to: '/sobre' },
  { label: 'Segurança', to: '/seguranca-informacao' },
  { label: 'FAQ', to: '/faq' },
  { label: 'Contato', to: '/contato' },
];

const CLASSE_DO_ITEM = 'px-3 py-2 text-[13px] font-medium transition-colors rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50';
const CLASSE_DO_ITEM_MOBILE = 'block w-full text-left px-4 py-2.5 text-sm text-foreground hover:text-accent font-medium rounded-md hover:bg-muted/60';

export default function LandingNavbar() {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const item = (l: ItemDoMenu, classe: string, aoClicar?: () => void) =>
    'to' in l
      ? <Link key={l.label} to={l.to} className={classe} onClick={aoClicar}>{l.label}</Link>
      : <a key={l.label} href={l.href} className={classe} onClick={aoClicar}>{l.label}</a>;

  return (
    <nav
      className={cn(
        'fixed top-0 z-50 w-full border-b bg-background/95 backdrop-blur-lg transition-shadow duration-300',
        scrolled ? 'border-border shadow-sm' : 'border-transparent',
      )}
      data-testid="landing-navbar"
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2.5" aria-label="Praefectus — página inicial">
          <PraefectusLogo size="lg" variant="default" />
        </a>

        <div className="hidden lg:flex items-center gap-1">
          {ITENS_DO_MENU.map((l) => item(l, CLASSE_DO_ITEM))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="text-[13px] font-semibold"
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

        <button
          type="button"
          className="lg:hidden p-2 text-foreground"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
        >
          {mobileOpen ? <X className="w-5 h-5" aria-hidden="true" /> : <Menu className="w-5 h-5" aria-hidden="true" />}
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
              {ITENS_DO_MENU.map((l) => item(l, CLASSE_DO_ITEM_MOBILE, () => setMobileOpen(false)))}
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
