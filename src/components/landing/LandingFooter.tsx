import { useNavigate } from 'react-router-dom';
import { Zap } from 'lucide-react';

export default function LandingFooter() {
  const navigate = useNavigate();

  return (
    <footer className="border-t border-border/40 py-16 px-6 bg-muted/10">
      <div className="max-w-7xl mx-auto grid md:grid-cols-5 gap-10">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center">
              <Zap className="w-5 h-5 text-accent-foreground" />
            </div>
            <span className="text-xl font-extrabold">Licit<span className="gradient-text">IA</span></span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
            Plataforma inteligente para gestão e monitoramento de licitações públicas, potencializada por inteligência artificial de última geração.
          </p>
        </div>
        <div>
          <h4 className="font-bold text-sm mb-4">Produto</h4>
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            <li><a href="#features" className="hover:text-foreground transition-colors">Funcionalidades</a></li>
            <li><a href="#planos" className="hover:text-foreground transition-colors">Preços</a></li>
            <li><a href="#treinamentos" className="hover:text-foreground transition-colors">Treinamentos</a></li>
            <li><button onClick={() => navigate('/faq')} className="hover:text-foreground transition-colors">FAQ</button></li>
          </ul>
        </div>
        <div>
          <h4 className="font-bold text-sm mb-4">Suporte</h4>
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            <li><button onClick={() => navigate('/suporte')} className="hover:text-foreground transition-colors">Central de Ajuda</button></li>
            <li><button onClick={() => navigate('/suporte')} className="hover:text-foreground transition-colors">Abrir Ticket</button></li>
            <li><button onClick={() => navigate('/ebook')} className="hover:text-foreground transition-colors">E-book Gratuito</button></li>
            <li><button onClick={() => navigate('/blog')} className="hover:text-foreground transition-colors">Blog</button></li>
          </ul>
        </div>
        <div>
          <h4 className="font-bold text-sm mb-4">Legal</h4>
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            <li><button onClick={() => navigate('/termos-de-uso')} className="hover:text-foreground transition-colors">Termos de Uso</button></li>
            <li><button onClick={() => navigate('/politica-de-privacidade')} className="hover:text-foreground transition-colors">Política de Privacidade</button></li>
            <li><button onClick={() => navigate('/lgpd')} className="hover:text-foreground transition-colors">LGPD</button></li>
          </ul>
        </div>
      </div>
      <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-border/30 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} LicitIA. Todos os direitos reservados.
      </div>
    </footer>
  );
}
