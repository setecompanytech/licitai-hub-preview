import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreditCard, Check, Star, Zap, Loader2, ExternalLink, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

import { type BillingCycle, cycleConfig, formatCurrency } from '@/data/pricing-config';
import { stripePlans, type StripePlanSlug } from '@/data/stripe-config';

interface Plano {
  id: string;
  nome: string;
  slug: string;
  preco_mensal: number;
  descricao: string | null;
  recursos: string[] | null;
  destaque: boolean | null;
  limite_licitacoes: number | null;
  limite_usuarios: number | null;
}

export default function PlanoAssinatura() {
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [cycle, setCycle] = useState<BillingCycle>('mensal');
  const [loading, setLoading] = useState(true);
  const [highlight, setHighlight] = useState(false);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<{ subscribed: boolean; product_id?: string; subscription_end?: string } | null>(null);
  const [managingPortal, setManagingPortal] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // Handle checkout success/cancel from URL params
  useEffect(() => {
    const checkout = searchParams.get('checkout');
    if (checkout === 'success') {
      toast.success('Assinatura realizada com sucesso! Bem-vindo ao PRAEFECTUS.');
      searchParams.delete('checkout');
      setSearchParams(searchParams, { replace: true });
      checkSubscription();
    } else if (checkout === 'cancel') {
      toast.info('Checkout cancelado.');
      searchParams.delete('checkout');
      setSearchParams(searchParams, { replace: true });
    }
  }, []);

  useEffect(() => {
    if (searchParams.get('scroll') === 'planos' && !loading) {
      sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setHighlight(true);
      const timer = setTimeout(() => {
        setHighlight(false);
        searchParams.delete('scroll');
        setSearchParams(searchParams, { replace: true });
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [loading, searchParams]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('planos')
        .select('id, nome, slug, preco_mensal, descricao, recursos, destaque, limite_licitacoes, limite_usuarios')
        .eq('ativo', true)
        .order('preco_mensal', { ascending: true });

      if (data) {
        setPlanos(data.map((p) => ({
          ...p,
          recursos: Array.isArray(p.recursos) ? (p.recursos as string[]) : null,
        })));
      }
      setLoading(false);
    })();
    checkSubscription();
  }, []);

  const checkSubscription = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke('check-subscription', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!error && data) {
        setSubscription(data);
      }
    } catch (err) {
      console.error('Error checking subscription:', err);
    }
  };

  const getPrice = (baseMonthly: number) => {
    const { months, discount } = cycleConfig[cycle];
    const discountedMonthly = baseMonthly * (1 - discount);
    return {
      monthly: discountedMonthly,
      total: discountedMonthly * months,
      saved: baseMonthly * months * discount,
    };
  };

  const handleCheckout = async (plano: Plano) => {
    const slug = plano.slug as StripePlanSlug;
    const stripeConfig = stripePlans[slug];
    if (!stripeConfig) {
      toast.error('Plano não configurado para pagamento.');
      return;
    }

    setCheckingOut(plano.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Faça login para assinar um plano.');
        setCheckingOut(null);
        return;
      }

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId: stripeConfig.price_id },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      toast.error('Erro ao iniciar checkout. Tente novamente.');
    } finally {
      setCheckingOut(null);
    }
  };

  const handleManageSubscription = async () => {
    setManagingPortal(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Faça login para gerenciar sua assinatura.');
        return;
      }

      const { data, error } = await supabase.functions.invoke('customer-portal', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (err) {
      console.error('Portal error:', err);
      toast.error('Erro ao abrir portal. Tente novamente.');
    } finally {
      setManagingPortal(false);
    }
  };

  const getActivePlanSlug = (): string | null => {
    if (!subscription?.subscribed || !subscription.product_id) return null;
    for (const [slug, config] of Object.entries(stripePlans)) {
      if (config.product_id === subscription.product_id) return slug;
    }
    return null;
  };

  if (loading) {
    return (
      <section className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="w-5 h-5 text-accent" />
          <h2 className="text-sm font-semibold">Plano & Assinatura</h2>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-muted rounded-lg w-full max-w-md" />
          <div className="grid md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <div key={i} className="h-64 bg-muted rounded-xl" />)}
          </div>
        </div>
      </section>
    );
  }

  const activePlanSlug = getActivePlanSlug();

  return (
    <section
      ref={sectionRef}
      id="planos"
      className={cn(
        'bg-card rounded-xl border p-5 shadow-sm transition-all duration-700',
        highlight ? 'border-accent ring-2 ring-accent/40 shadow-lg' : 'border-border/50'
      )}
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-accent" />
          <h2 className="text-sm font-semibold">Plano & Assinatura</h2>
        </div>
        {subscription?.subscribed && (
          <Button size="sm" variant="outline" onClick={handleManageSubscription} disabled={managingPortal}>
            {managingPortal ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Settings className="w-3.5 h-3.5 mr-1.5" />}
            Gerenciar Assinatura
          </Button>
        )}
      </div>

      {/* Active subscription banner */}
      {subscription?.subscribed && activePlanSlug && (
        <div className="mb-5 p-3 rounded-lg bg-success/10 border border-success/20 flex items-center gap-3">
          <Check className="w-5 h-5 text-success flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-success">Assinatura ativa</p>
            <p className="text-xs text-muted-foreground">
              Plano {activePlanSlug.charAt(0).toUpperCase() + activePlanSlug.slice(1)}
              {subscription.subscription_end && ` • Renova em ${new Date(subscription.subscription_end).toLocaleDateString('pt-BR')}`}
            </p>
          </div>
        </div>
      )}

      {/* Cycle selector */}
      <div className="flex items-center justify-center mb-6">
        <div className="inline-flex bg-muted rounded-lg p-1 gap-1">
          {(Object.keys(cycleConfig) as BillingCycle[]).map((key) => {
            const active = cycle === key;
            const cfg = cycleConfig[key];
            return (
              <button
                key={key}
                onClick={() => setCycle(key)}
                className={cn(
                  'relative px-4 py-2 rounded-md text-xs font-semibold transition-all duration-200',
                  active
                    ? 'bg-accent text-accent-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {cfg.label}
                {cfg.discount > 0 && (
                  <span className={cn(
                    'absolute -top-2 -right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full',
                    active ? 'bg-success text-success-foreground' : 'bg-success/20 text-success'
                  )}>
                    -{cfg.discount * 100}%
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Plans grid */}
      <div className="grid md:grid-cols-3 gap-4">
        {planos.map((plano) => {
          const price = getPrice(plano.preco_mensal);
          const isHighlight = plano.destaque;
          const isActive = activePlanSlug === plano.slug;
          const isLoading = checkingOut === plano.id;

          return (
            <div
              key={plano.id}
              className={cn(
                'relative rounded-xl border p-5 flex flex-col transition-all duration-300',
                isActive
                  ? 'border-success ring-1 ring-success/30 shadow-lg'
                  : isHighlight
                    ? 'border-accent shadow-lg ring-1 ring-accent/30 scale-[1.02]'
                    : 'border-border/50 hover:border-accent/40 hover:shadow-md'
              )}
            >
              {isActive && (
                <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-success text-success-foreground text-[10px] gap-1">
                  <Check className="w-3 h-3" /> Seu Plano
                </Badge>
              )}
              {!isActive && isHighlight && (
                <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-accent text-accent-foreground text-[10px] gap-1">
                  <Star className="w-3 h-3" /> Mais popular
                </Badge>
              )}

              <h3 className="text-base font-bold mb-1">{plano.nome}</h3>
              <p className="text-xs text-muted-foreground mb-4 min-h-[32px]">{plano.descricao}</p>

              <div className="mb-4">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-extrabold tracking-tight">{formatCurrency(price.monthly)}</span>
                  <span className="text-xs text-muted-foreground">/mês</span>
                </div>
                {cycle !== 'mensal' && (
                  <div className="mt-1 space-y-0.5">
                    <p className="text-xs text-muted-foreground">
                      Total: <span className="font-semibold text-foreground">{formatCurrency(price.total)}</span> / {cycleConfig[cycle].label.toLowerCase()}
                    </p>
                    <p className="text-[11px] text-success font-medium flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      Economia de {formatCurrency(price.saved)}
                    </p>
                  </div>
                )}
                {cycle === 'mensal' && (
                  <p className="text-xs text-muted-foreground mt-1">Sem fidelidade</p>
                )}
              </div>

              <div className="flex gap-3 mb-4 text-[11px] text-muted-foreground">
                <span>{plano.limite_licitacoes === -1 ? '∞' : plano.limite_licitacoes} licitações</span>
                <span>•</span>
                <span>{plano.limite_usuarios === -1 ? '∞' : plano.limite_usuarios} {(plano.limite_usuarios ?? 1) === 1 ? 'usuário' : 'usuários'}</span>
              </div>

              <ul className="space-y-2 flex-1 mb-5">
                {plano.recursos?.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <Check className="w-3.5 h-3.5 text-accent mt-0.5 flex-shrink-0" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => isActive ? handleManageSubscription() : handleCheckout(plano)}
                variant={isActive ? 'outline' : isHighlight ? 'default' : 'outline'}
                className={cn(
                  'w-full',
                  isActive && 'border-success text-success hover:bg-success/10',
                  !isActive && isHighlight && 'bg-accent hover:bg-accent/90 text-accent-foreground'
                )}
                disabled={isLoading || managingPortal}
              >
                {isLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Redirecionando...</>
                ) : isActive ? (
                  <><Settings className="w-4 h-4 mr-2" /> Gerenciar</>
                ) : (
                  <><ExternalLink className="w-4 h-4 mr-2" /> Assinar {plano.nome}</>
                )}
              </Button>
            </div>
          );
        })}
      </div>

      <div className="mt-4 space-y-1">
        <p className="text-[11px] text-muted-foreground text-center">
          Pagamento seguro via <strong>Cartão de Crédito</strong> ou <strong>Boleto Bancário</strong> processado pelo Stripe.
        </p>
        <p className="text-[11px] text-muted-foreground text-center">
          Cancele a qualquer momento pelo portal de gerenciamento.
        </p>
      </div>
    </section>
  );
}
