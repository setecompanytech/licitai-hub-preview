import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, ArrowDown, DollarSign, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useAuditLog } from '@/hooks/useAuditLog';
import { toast } from 'sonner';

type EstrategiaLance = {
  valorInicial: number;
  valorMinimo: number;
  decrementoMin: number;
  decrementoPercentual: number;
  maxLances: number;
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
            <ShieldCheck className="w-5 h-5 text-warning" />
            Autorizar Estratégia — Nível 2
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-warning/5 border border-warning/20 rounded-lg p-3">
            <p className="text-xs text-warning font-semibold mb-2">
              Revise a estratégia antes de autorizar
            </p>
            <p className="text-xs text-muted-foreground">
              No modo semiautomático, o sistema executará lances dentro dos parâmetros abaixo.
              Você está autorizando esta estratégia de forma expressa.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold">Edital: {edital}</p>
            
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Valor Inicial', value: formatCurrency(estrategia.valorInicial), icon: DollarSign },
                { label: 'Valor Mínimo (Piso)', value: formatCurrency(estrategia.valorMinimo), icon: ArrowDown },
                { label: 'Decremento Mínimo', value: formatCurrency(estrategia.decrementoMin), icon: ArrowDown },
                { label: 'Decremento %', value: `${estrategia.decrementoPercentual}%`, icon: ArrowDown },
                { label: 'Máx. Lances', value: String(estrategia.maxLances), icon: CheckCircle2 },
                { label: 'Intervalo', value: `${estrategia.intervaloSegundos}s`, icon: CheckCircle2 },
              ].map((item) => (
                <div key={item.label} className="bg-muted/50 rounded-lg p-2 flex items-center gap-2">
                  <item.icon className="w-3 h-3 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="text-xs font-semibold font-mono">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {limiteFinanceiro > 0 && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                excedeLimite
                  ? 'bg-destructive/5 border-destructive/20'
                  : 'bg-success/5 border-success/20'
              }`}>
                {excedeLimite ? (
                  <>
                    <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                    <p className="text-xs text-destructive">
                      ⚠️ Valor inicial ({formatCurrency(estrategia.valorInicial)}) excede o limite financeiro ({formatCurrency(limiteFinanceiro)}).
                    </p>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                    <p className="text-xs text-success">
                      ✅ Dentro do limite financeiro ({formatCurrency(limiteFinanceiro)}).
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-border pt-3">
            <label className="text-xs font-semibold block mb-1">
              Digite <Badge variant="outline" className="text-xs mx-1">AUTORIZO</Badge> para confirmar
            </label>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
              placeholder="AUTORIZO"
              className="font-mono text-center tracking-widest"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleAutorizar}
            disabled={confirmText !== 'AUTORIZO' || excedeLimite}
            className="bg-warning hover:bg-warning/90 text-warning-foreground"
          >
            <ShieldCheck className="w-4 h-4 mr-1" />
            Autorizar Estratégia
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
