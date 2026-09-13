import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CreditCard, Check, Star, Zap, Loader2, ExternalLink, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { descreverFalha } from '@/lib/erro-edge-function';

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
  const { refreshSubscription } = useAuth();
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
      refreshSubscription();
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
        body: { priceId: stripeConfig.prices[cycle] },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;
      if (data?.url) {
        /**
         * Mesma aba, não `window.open`.
         *
         * O clique dispara uma chamada assíncrona antes de abrir a janela, e
         * nesse ponto o navegador já não considera a abertura como resposta a
         * um gesto do usuário — Chrome e Safari bloqueiam o popup em silêncio.
         * O usuário clica, nada acontece, e não há erro nenhum para investigar.
         *
         * O Checkout do Stripe é um fluxo de página inteira e já volta pelo
         * `success_url`. Navegar na mesma aba nunca é bloqueado.
         */
        window.location.href = data.url;
      } else {
        toast.error('Não foi possível gerar o link de pagamento.');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      // "Tente novamente" é conselho inútil quando a causa é uma chave ausente
      // no servidor: tentar de novo falha de novo, para sempre. O motivo real
      // vem no corpo da resposta e precisa ser buscado.
      const motivo = await descreverFalha(err);
      toast.error('Não foi possível iniciar o pagamento', {
        description: motivo ?? 'Tente novamente em alguns instantes.',
        duration: 12000,
      });
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
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Portal error:', err);
      const motivo = await descreverFalha(err);
      toast.error('Não foi possível abrir o portal de assinatura', {
        description: motivo ?? 'Tente novamente em alguns instantes.',
        duration: 12000,
      });
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
      <section className="rounded-lg border border-border bg-card p-6 shadow-sm" role="status" aria-busy="true">
        <span className="sr-only">Carregando planos</span>
        <div className="mb-4 flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-foreground">Plano & Assinatura</h2>
        </div>
        <div className="space-y-4">
          <Skeleton className="mx-auto h-11 w-full max-w-md" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-64 w-full rounded-lg" />)}
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
        'rounded-lg border bg-card p-6 shadow-sm transition-all duration-700',
        highlight ? 'border-primary ring-2 ring-ring' : 'border-border'
      )}
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-foreground">Plano & Assinatura</h2>
        </div>
        {subscription?.subscribed && (
          <Button variant="outline" onClick={handleManageSubscription} disabled={managingPortal}>
            {managingPortal ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Settings aria-hidden="true" />}
            Gerenciar Assinatura
          </Button>
        )}
      </div>

      {/* Active subscription banner */}
      {subscription?.subscribed && activePlanSlug && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-success-line bg-success-tint p-4 text-success-ink">
          <Check className="h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="text-base font-semibold">Assinatura ativa</p>
            <p className="text-sm">
              Plano {activePlanSlug.charAt(0).toUpperCase() + activePlanSlug.slice(1)}
              {subscription.subscription_end && ` • Renova em ${new Date(subscription.subscription_end).toLocaleDateString('pt-BR')}`}
            </p>
          </div>
        </div>
      )}

      {/* Cycle selector */}
      <div className="mb-6 flex items-center justify-center">
        <div className="inline-flex flex-wrap gap-1 rounded-md bg-muted p-1" role="group" aria-label="Ciclo de cobrança">
          {(Object.keys(cycleConfig) as BillingCycle[]).map((key) => {
            const active = cycle === key;
            const cfg = cycleConfig[key];
            return (
              <Button
                key={key}
                type="button"
                variant={active ? 'default' : 'ghost'}
                size="sm"
                aria-pressed={active}
                onClick={() => setCycle(key)}
                className="relative"
              >
                {cfg.label}
                {cfg.discount > 0 && (
                  <Badge variant="success" className="absolute -right-2 -top-2 px-1.5 py-0">
                    -{cfg.discount * 100}%
                  </Badge>
                )}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Plans grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {planos.map((plano) => {
          const price = getPrice(plano.preco_mensal);
          const isHighlight = plano.destaque;
          const isActive = activePlanSlug === plano.slug;
          const isLoading = checkingOut === plano.id;

          return (
            <div
              key={plano.id}
              className={cn(
                'relative flex flex-col rounded-lg border bg-card p-6 transition-colors',
                isActive
                  ? 'border-success'
                  : isHighlight
                    ? 'border-primary'
                    : 'border-border hover:border-primary/40'
              )}
            >
              {isActive && (
                <Badge variant="success" className="absolute -top-3 left-1/2 -translate-x-1/2 gap-1">
                  <Check className="h-4 w-4" aria-hidden="true" /> Seu Plano
                </Badge>
              )}
              {!isActive && isHighlight && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 gap-1">
                  <Star className="h-4 w-4" aria-hidden="true" /> Mais popular
                </Badge>
              )}

              <h3 className="mb-1 text-lg font-semibold text-foreground">{plano.nome}</h3>
              <p className="mb-4 min-h-10 text-sm text-muted-foreground">{plano.descricao}</p>

              <div className="mb-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-[2rem] font-bold leading-10 tabular-nums text-foreground">{formatCurrency(price.monthly)}</span>
                  <span className="text-sm text-muted-foreground">/mês</span>
                </div>
                {cycle !== 'mensal' && (
                  <div className="mt-1 space-y-1">
                    <p className="text-sm text-muted-foreground">
                      Total: <span className="font-semibold tabular-nums text-foreground">{formatCurrency(price.total)}</span> / {cycleConfig[cycle].label.toLowerCase()}
                    </p>
                    <p className="flex items-center gap-1 text-sm font-medium text-success">
                      <Zap className="h-4 w-4" aria-hidden="true" />
                      Economia de {formatCurrency(price.saved)}
                    </p>
                  </div>
                )}
                {cycle === 'mensal' && (
                  <p className="mt-1 text-sm text-muted-foreground">Sem fidelidade</p>
                )}
              </div>

              <div className="mb-4 flex gap-3 text-sm text-muted-foreground">
                <span>{plano.limite_licitacoes === -1 ? '∞' : plano.limite_licitacoes} licitações</span>
                <span>•</span>
                <span>{plano.limite_usuarios === -1 ? '∞' : plano.limite_usuarios} {(plano.limite_usuarios ?? 1) === 1 ? 'usuário' : 'usuários'}</span>
              </div>

              <ul className="mb-6 flex-1 space-y-2">
                {plano.recursos?.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => isActive ? handleManageSubscription() : handleCheckout(plano)}
                variant={isActive ? 'outline' : isHighlight ? 'default' : 'outline'}
                className={cn(
                  'w-full truncate',
                  isActive && 'border-success text-success-ink hover:bg-success-tint',
                )}
                disabled={isLoading || managingPortal}
              >
                {isLoading ? (
                  <><Loader2 className="animate-spin" aria-hidden="true" /> Redirecionando...</>
                ) : isActive ? (
                  <><Settings aria-hidden="true" /> Gerenciar</>
                ) : (
                  <><ExternalLink aria-hidden="true" /> <span className="truncate">Assinar {plano.nome}</span></>
                )}
              </Button>
            </div>
          );
        })}
      </div>

      <div className="mt-4 space-y-1">
        <p className="text-center text-xs text-muted-foreground">
          Pagamento seguro via <strong>Cartão de Crédito</strong> ou <strong>Boleto Bancário</strong> processado pelo Stripe.
        </p>
        <p className="text-center text-xs text-muted-foreground">
          Cancele a qualquer momento pelo portal de gerenciamento.
        </p>
      </div>
    </section>
  );
}
