import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Cookie, X } from 'lucide-react';
import { Link } from 'react-router-dom';

const CONSENT_KEY = 'praefectus_cookie_consent';

type ConsentValue = 'all' | 'essential' | null;

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) {
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const accept = (value: ConsentValue) => {
    if (!value) return;
    localStorage.setItem(CONSENT_KEY, value);
    setVisible(false);

    // If analytics accepted, enable tracking
    if (value === 'all' && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cookie-consent', { detail: { analytics: true } }));
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-[9999] p-4 animate-in slide-in-from-bottom-4 duration-500">
      <div className="mx-auto max-w-3xl rounded-xl border border-border bg-card p-5 shadow-xl md:p-6">
        <div className="flex items-start gap-4">
          <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-primary-tint">
            <Cookie className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground">Política de Cookies</h3>
              <button
                onClick={() => accept('essential')}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 -m-1"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
              Utilizamos cookies essenciais para o funcionamento da plataforma e cookies analíticos para melhorar sua experiência. 
              Ao clicar em "Aceitar todos", você concorda com o uso de todos os cookies conforme nossa{' '}
              <Link to="/politica-cookies" className="text-primary hover:underline font-medium">
                Política de Cookies
              </Link>{' '}
              e{' '}
              <Link to="/politica-de-privacidade" className="text-primary hover:underline font-medium">
                Política de Privacidade
              </Link>.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => accept('all')}>
                Aceitar todos
              </Button>
              <Button size="sm" variant="outline" onClick={() => accept('essential')}>
                Apenas essenciais
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
