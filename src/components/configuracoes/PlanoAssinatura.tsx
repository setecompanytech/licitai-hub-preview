import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { CreditCard, Check, Star, Zap, QrCode, FileText, Copy, Loader2, ShieldCheck, ArrowLeft, Clock, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type PaymentMethod = 'pix' | 'boleto' | 'cartao';

const paymentMethods: { key: PaymentMethod; label: string; icon: typeof CreditCard; desc: string }[] = [
  { key: 'pix', label: 'PIX', icon: QrCode, desc: 'Aprovação instantânea' },
  { key: 'boleto', label: 'Boleto', icon: FileText, desc: 'Até 3 dias úteis' },
  { key: 'cartao', label: 'Cartão de Crédito', icon: CreditCard, desc: 'Parcele em até 12x' },
];

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

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/* ── PIX Checkout ── */
function PixCheckout({ plano, total, cycle }: { plano: Plano; total: number; cycle: BillingCycle }) {
  const [status, setStatus] = useState<'qr' | 'confirmado'>('qr');
  const pixCode = `00020126580014BR.GOV.BCB.PIX0136licitia-${plano.slug}-${Date.now()}5204000053039865802BR5913LICITIA LTDA6008BRASILIA62070503***6304`;

  const handleCopy = () => {
    navigator.clipboard.writeText(pixCode);
    toast.success('Código PIX copiado!');
  };

  if (status === 'confirmado') {
    return (
      <div className="flex flex-col items-center gap-4 py-6">
        <div className="w-16 h-16 rounded-full bg-success/15 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-success" />
        </div>
        <h3 className="text-lg font-bold">Pagamento Confirmado!</h3>
        <p className="text-sm text-muted-foreground text-center">
          Plano <strong>{plano.nome}</strong> ({cycleConfig[cycle].label}) ativado com sucesso.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50">
        <div>
          <p className="text-xs text-muted-foreground">Plano {plano.nome} • {cycleConfig[cycle].label}</p>
          <p className="text-lg font-bold">{formatCurrency(total)}</p>
        </div>
        <QrCode className="w-6 h-6 text-accent" />
      </div>

      {/* QR Code placeholder */}
      <div className="flex flex-col items-center gap-3">
        <div className="w-48 h-48 bg-muted rounded-xl border-2 border-dashed border-border flex items-center justify-center">
          <div className="text-center">
            <QrCode className="w-20 h-20 text-muted-foreground/40 mx-auto" />
            <p className="text-[10px] text-muted-foreground mt-1">QR Code PIX</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Escaneie o QR Code com seu app bancário</p>
      </div>

      {/* Copia e cola */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold">PIX Copia e Cola</Label>
        <div className="flex gap-2">
          <Input readOnly value={pixCode} className="text-[10px] font-mono" />
          <Button size="sm" variant="outline" onClick={handleCopy} className="flex-shrink-0">
            <Copy className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex items-start gap-2 p-3 rounded-lg bg-accent/5 border border-accent/10">
        <Clock className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
        <p className="text-[11px] text-muted-foreground">
          O pagamento via PIX é <strong className="text-foreground">confirmado instantaneamente</strong>. Após o pagamento, seu plano será ativado automaticamente.
        </p>
      </div>

      <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" onClick={() => {
        setStatus('confirmado');
        toast.success('Pagamento PIX confirmado!');
      }}>
        Já realizei o pagamento
      </Button>
    </div>
  );
}

/* ── Boleto Checkout ── */
function BoletoCheckout({ plano, total, cycle }: { plano: Plano; total: number; cycle: BillingCycle }) {
  const [gerado, setGerado] = useState(false);
  const [gerando, setGerando] = useState(false);
  const boletoCode = '23793.38128 60000.000003 00000.000400 1 84340000' + Math.floor(total * 100);

  const handleGerar = () => {
    setGerando(true);
    setTimeout(() => {
      setGerando(false);
      setGerado(true);
      toast.success('Boleto gerado com sucesso!');
    }, 1500);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(boletoCode);
    toast.success('Linha digitável copiada!');
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50">
        <div>
          <p className="text-xs text-muted-foreground">Plano {plano.nome} • {cycleConfig[cycle].label}</p>
          <p className="text-lg font-bold">{formatCurrency(total)}</p>
        </div>
        <FileText className="w-6 h-6 text-accent" />
      </div>

      {!gerado ? (
        <>
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <FileText className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Clique abaixo para gerar seu boleto bancário
            </p>
          </div>

          <div className="flex items-start gap-2 p-3 rounded-lg bg-accent/5 border border-accent/10">
            <Clock className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-muted-foreground">
              O boleto tem vencimento em <strong className="text-foreground">3 dias úteis</strong>. Após a compensação bancária, seu plano será ativado automaticamente.
            </p>
          </div>

          <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" onClick={handleGerar} disabled={gerando}>
            {gerando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileText className="w-4 h-4 mr-2" />}
            Gerar Boleto
          </Button>
        </>
      ) : (
        <>
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Linha Digitável</Label>
            <div className="flex gap-2">
              <Input readOnly value={boletoCode} className="text-[11px] font-mono" />
              <Button size="sm" variant="outline" onClick={handleCopy} className="flex-shrink-0">
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="h-20 bg-muted rounded-lg border border-border/50 flex items-center justify-center">
            <div className="flex gap-[2px]">
              {Array.from({ length: 40 }).map((_, i) => (
                <div key={i} className="bg-foreground/70" style={{ width: i % 3 === 0 ? '2px' : '1px', height: `${20 + Math.random() * 30}px` }} />
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={handleCopy}>
              <Copy className="w-4 h-4 mr-2" /> Copiar código
            </Button>
            <Button className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground" onClick={() => toast.info('Download do boleto em PDF')}>
              <FileText className="w-4 h-4 mr-2" /> Baixar PDF
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground text-center">
            Após o pagamento, a compensação pode levar até 3 dias úteis.
          </p>
        </>
      )}
    </div>
  );
}

/* ── Cartão de Crédito Checkout ── */
function CartaoCheckout({ plano, total, cycle }: { plano: Plano; total: number; cycle: BillingCycle }) {
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [parcelas, setParcelas] = useState('1');
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);

  const maxParcelas = Math.min(12, Math.floor(total / 50) || 1);

  const formatCardNumber = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  const formatExpiry = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) return digits.slice(0, 2) + '/' + digits.slice(2);
    return digits;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cardNumber.replace(/\s/g, '').length < 16) { toast.error('Número do cartão inválido'); return; }
    if (!cardName.trim()) { toast.error('Informe o nome no cartão'); return; }
    if (cardExpiry.length < 5) { toast.error('Data de validade inválida'); return; }
    if (cardCvv.length < 3) { toast.error('CVV inválido'); return; }

    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      setSuccess(true);
      toast.success('Pagamento aprovado!');
    }, 2000);
  };

  if (success) {
    return (
      <div className="flex flex-col items-center gap-4 py-6">
        <div className="w-16 h-16 rounded-full bg-success/15 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-success" />
        </div>
        <h3 className="text-lg font-bold">Pagamento Aprovado!</h3>
        <p className="text-sm text-muted-foreground text-center">
          Plano <strong>{plano.nome}</strong> ({cycleConfig[cycle].label}) ativado com sucesso.
          {parseInt(parcelas) > 1 && <><br />{parcelas}x de {formatCurrency(total / parseInt(parcelas))}</>}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50">
        <div>
          <p className="text-xs text-muted-foreground">Plano {plano.nome} • {cycleConfig[cycle].label}</p>
          <p className="text-lg font-bold">{formatCurrency(total)}</p>
        </div>
        <CreditCard className="w-6 h-6 text-accent" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Número do cartão</Label>
          <Input
            placeholder="0000 0000 0000 0000"
            value={cardNumber}
            onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
            maxLength={19}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-semibold">Nome no cartão</Label>
          <Input
            placeholder="NOME COMO NO CARTÃO"
            value={cardName}
            onChange={(e) => setCardName(e.target.value.toUpperCase())}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Validade</Label>
            <Input
              placeholder="MM/AA"
              value={cardExpiry}
              onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
              maxLength={5}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold">CVV</Label>
            <Input
              placeholder="000"
              type="password"
              value={cardCvv}
              onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
              maxLength={4}
            />
          </div>
        </div>

        {maxParcelas > 1 && (
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Parcelas</Label>
            <Select value={parcelas} onValueChange={setParcelas}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: maxParcelas }, (_, i) => i + 1).map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}x de {formatCurrency(total / n)} {n === 1 ? '(à vista)' : 'sem juros'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex items-start gap-2 p-3 rounded-lg bg-accent/5 border border-accent/10">
          <ShieldCheck className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-muted-foreground">
            Pagamento <strong className="text-foreground">100% seguro</strong>. Seus dados são criptografados e protegidos.
          </p>
        </div>

        <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" disabled={processing}>
          {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CreditCard className="w-4 h-4 mr-2" />}
          {processing ? 'Processando...' : `Pagar ${formatCurrency(total)}`}
        </Button>
      </form>
    </div>
  );
}

/* ── Main Component ── */
export default function PlanoAssinatura() {
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [cycle, setCycle] = useState<BillingCycle>('mensal');
  const [payment, setPayment] = useState<PaymentMethod | null>(null);
  const [loading, setLoading] = useState(true);
  const [highlight, setHighlight] = useState(false);
  const [selectedPlano, setSelectedPlano] = useState<Plano | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();

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

  const handleSelect = (plano: Plano) => {
    setSelectedPlano(plano);
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

  const selectedPrice = selectedPlano ? getPrice(selectedPlano.preco_mensal) : null;

  return (
    <>
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

        {/* Payment method selector removed - now inside checkout dialog */}

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

      {/* Checkout Dialog */}
      <Dialog open={!!selectedPlano} onOpenChange={(open) => { if (!open) { setSelectedPlano(null); setPayment(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {!payment && <><CreditCard className="w-5 h-5 text-accent" /> Escolha a forma de pagamento</>}
              {payment === 'pix' && <><QrCode className="w-5 h-5 text-accent" /> Pagamento via PIX</>}
              {payment === 'boleto' && <><FileText className="w-5 h-5 text-accent" /> Pagamento via Boleto</>}
              {payment === 'cartao' && <><CreditCard className="w-5 h-5 text-accent" /> Pagamento via Cartão</>}
            </DialogTitle>
            <DialogDescription>
              {!payment
                ? `Plano ${selectedPlano?.nome} • ${cycleConfig[cycle].label} — ${selectedPrice ? formatCurrency(selectedPrice.total) : ''}`
                : `Finalize a assinatura do plano ${selectedPlano?.nome}`}
            </DialogDescription>
          </DialogHeader>

          {selectedPlano && selectedPrice && !payment && (
            <div className="space-y-4 py-2">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50">
                <div>
                  <p className="text-sm font-semibold">{selectedPlano.nome}</p>
                  <p className="text-xs text-muted-foreground">{cycleConfig[cycle].label}</p>
                </div>
                <p className="text-lg font-bold">{formatCurrency(selectedPrice.total)}</p>
              </div>

              <div className="space-y-2">
                {paymentMethods.map((m) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.key}
                      onClick={() => setPayment(m.key)}
                      className="w-full flex items-center gap-4 p-4 rounded-xl border border-border/50 hover:border-accent hover:bg-accent/5 transition-all duration-200 text-left"
                    >
                      <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-5 h-5 text-accent" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold">{m.label}</p>
                        <p className="text-xs text-muted-foreground">{m.desc}</p>
                      </div>
                      <ArrowLeft className="w-4 h-4 text-muted-foreground rotate-180" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {selectedPlano && selectedPrice && payment && (
            <div>
              <button
                onClick={() => setPayment(null)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Alterar forma de pagamento
              </button>

              {payment === 'pix' && <PixCheckout plano={selectedPlano} total={selectedPrice.total} cycle={cycle} />}
              {payment === 'boleto' && <BoletoCheckout plano={selectedPlano} total={selectedPrice.total} cycle={cycle} />}
              {payment === 'cartao' && <CartaoCheckout plano={selectedPlano} total={selectedPrice.total} cycle={cycle} />}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}