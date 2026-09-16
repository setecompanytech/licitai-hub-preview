import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, ArrowDown, DollarSign, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useAuditLog } from '@/hooks/useAuditLog';
import { toast } from 'sonner';
import { textoDoLimiteDeLances } from '@/lib/robo/estrategia-do-item';

type EstrategiaLance = {
  valorInicial: number;
  valorMinimo: number;
  decrementoMin: number;
  decrementoPercentual: number;
  maxLances: number | null;
  intervaloSegundos: number;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  estrategia: EstrategiaLance;
  limiteFinanceiro: number;
  sessaoId?: string;
  licitacaoId?: string;
  edital: string;
  onAutorizar: () => void;
};

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function AutorizacaoLanceDialog({
  open, onOpenChange, estrategia, limiteFinanceiro,
  sessaoId, licitacaoId, edital, onAutorizar,
}: Props) {
  const { registrar } = useAuditLog();
  const [confirmText, setConfirmText] = useState('');

  const excedeLimite = estrategia.valorInicial > limiteFinanceiro && limiteFinanceiro > 0;

  const handleAutorizar = async () => {
    if (confirmText !== 'AUTORIZO') {
      toast.error('Digite AUTORIZO para confirmar.');
      return;
    }

    if (excedeLimite) {
      toast.error('Valor excede o limite financeiro definido.');
      return;
    }

    await registrar('estrategia_aprovada', {
      estrategia,
      edital,
      limite_financeiro: limiteFinanceiro,
    }, {
      sessaoId,
      licitacaoId,
      nivelAutomacao: 2,
      valorLance: estrategia.valorInicial,
    });

    toast.success('Estratégia autorizada. O sistema executará dentro dos limites definidos.');
    onAutorizar();
    onOpenChange(false);
    setConfirmText('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-warning" aria-hidden="true" />
            Autorizar Estratégia — Nível 2
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-warning-tint border border-warning-line rounded-lg p-4">
            <p className="text-sm text-warning-ink font-semibold mb-1">
              Revise a estratégia antes de autorizar
            </p>
            <p className="text-sm text-muted-foreground">
              No modo semiautomático, o sistema executará lances dentro dos parâmetros abaixo.
              Você está autorizando esta estratégia de forma expressa.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold">Edital: {edital}</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { label: 'Valor Inicial', value: formatCurrency(estrategia.valorInicial), icon: DollarSign },
                { label: 'Valor Mínimo (Piso)', value: formatCurrency(estrategia.valorMinimo), icon: ArrowDown },
                { label: 'Decremento Mínimo', value: formatCurrency(estrategia.decrementoMin), icon: ArrowDown },
                { label: 'Decremento %', value: `${estrategia.decrementoPercentual}%`, icon: ArrowDown },
                { label: 'Máx. Lances', value: textoDoLimiteDeLances(estrategia.maxLances), icon: CheckCircle2 },
                { label: 'Intervalo', value: `${estrategia.intervaloSegundos}s`, icon: CheckCircle2 },
              ].map((item) => (
                <div key={item.label} className="bg-muted rounded-md p-3 flex items-center gap-2">
                  <item.icon className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="text-sm font-semibold tabular-nums">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {limiteFinanceiro > 0 && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                excedeLimite
                  ? 'bg-destructive-tint border-destructive-line'
                  : 'bg-success-tint border-success-line'
              }`}>
                {excedeLimite ? (
                  <>
                    <AlertTriangle className="w-4 h-4 text-destructive-ink shrink-0" aria-hidden="true" />
                    <p className="text-sm text-destructive-ink">
                      Valor inicial ({formatCurrency(estrategia.valorInicial)}) excede o limite financeiro ({formatCurrency(limiteFinanceiro)}).
                    </p>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-success-ink shrink-0" aria-hidden="true" />
                    <p className="text-sm text-success-ink">
                      Dentro do limite financeiro ({formatCurrency(limiteFinanceiro)}).
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-border pt-4">
            <Label htmlFor="autorizacao-confirmacao" className="block mb-1">
              Digite <Badge variant="muted" className="mx-1">AUTORIZO</Badge> para confirmar
            </Label>
            <Input
              id="autorizacao-confirmacao"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
              placeholder="AUTORIZO"
              autoComplete="off"
              className="text-center tracking-widest"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleAutorizar}
            disabled={confirmText !== 'AUTORIZO' || excedeLimite}
          >
            <ShieldCheck className="w-4 h-4" aria-hidden="true" />
            Autorizar Estratégia
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
