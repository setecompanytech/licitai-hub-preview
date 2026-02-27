import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CreditCard, Check, Star, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type BillingCycle = 'mensal' | 'trimestral' | 'semestral' | 'anual';

const cycleConfig: Record<BillingCycle, { label: string; months: number; discount: number }> = {
  mensal:     { label: 'Mensal',     months: 1,  discount: 0 },
  trimestral: { label: 'Trimestral', months: 3,  discount: 0.10 },
  semestral:  { label: 'Semestral',  months: 6,  discount: 0.15 },
  anual:      { label: 'Anual',      months: 12, discount: 0.20 },
};

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
  const sectionRef = useRef<HTMLElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // Auto-scroll when coming from banner
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
  }, []);

  const getPrice = (baseMonthly: number) => {
    const { months, discount } = cycleConfig[cycle];
    const discountedMonthly = baseMonthly * (1 - discount);
    return {
      monthly: discountedMonthly,
      total: discountedMonthly * months,
      saved: baseMonthly * months * discount,
    };
  };

  const formatCurrency = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const handleSelect = (plano: Plano) => {
    const price = getPrice(plano.preco_mensal);
    toast.success(`Plano ${plano.nome} (${cycleConfig[cycle].label}) selecionado — ${formatCurrency(price.total)}`);
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

  return (
    <section
      ref={sectionRef}
      id="planos"
      className={cn(
        'bg-card rounded-xl border p-5 shadow-sm transition-all duration-700',
        highlight ? 'border-accent ring-2 ring-accent/40 shadow-lg' : 'border-border/50'
      )}
    >
      <div className="flex items-center gap-2 mb-5">
        <CreditCard className="w-5 h-5 text-accent" />
        <h2 className="text-sm font-semibold">Plano & Assinatura</h2>
      </div>

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

          return (
            <div
              key={plano.id}
              className={cn(
                'relative rounded-xl border p-5 flex flex-col transition-all duration-300',
                isHighlight
                  ? 'border-accent shadow-lg ring-1 ring-accent/30 scale-[1.02]'
                  : 'border-border/50 hover:border-accent/40 hover:shadow-md'
              )}
            >
              {isHighlight && (
                <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-accent text-accent-foreground text-[10px] gap-1">
                  <Star className="w-3 h-3" /> Mais popular
                </Badge>
              )}

              <h3 className="text-base font-bold mb-1">{plano.nome}</h3>
              <p className="text-xs text-muted-foreground mb-4 min-h-[32px]">{plano.descricao}</p>

              {/* Price */}
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

              {/* Limits */}
              <div className="flex gap-3 mb-4 text-[11px] text-muted-foreground">
                <span>
                  {plano.limite_licitacoes === -1 ? '∞' : plano.limite_licitacoes} licitações
                </span>
                <span>•</span>
                <span>
                  {plano.limite_usuarios === -1 ? '∞' : plano.limite_usuarios} {(plano.limite_usuarios ?? 1) === 1 ? 'usuário' : 'usuários'}
                </span>
              </div>

              {/* Features */}
              <ul className="space-y-2 flex-1 mb-5">
                {plano.recursos?.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <Check className="w-3.5 h-3.5 text-accent mt-0.5 flex-shrink-0" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => handleSelect(plano)}
                variant={isHighlight ? 'default' : 'outline'}
                className={cn(
                  'w-full',
                  isHighlight && 'bg-accent hover:bg-accent/90 text-accent-foreground'
                )}
              >
                Escolher {plano.nome}
              </Button>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-muted-foreground text-center mt-4">
        Todos os planos incluem 3 dias de teste grátis. Cancele a qualquer momento.
      </p>
    </section>
  );
}
