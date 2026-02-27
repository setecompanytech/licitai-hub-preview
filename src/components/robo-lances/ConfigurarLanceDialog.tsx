import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Bot } from 'lucide-react';

const portaisDisponiveis = [
  { id: 'pncp', nome: 'PNCP' },
  { id: 'compras-gov', nome: 'Compras Governamentais' },
  { id: 'bll', nome: 'BLL Compras' },
  { id: 'licitanet', nome: 'Licitanet' },
  { id: 'licitacoes-e', nome: 'Licitações-e (BB)' },
  { id: 'portal-compras', nome: 'Portal de Compras Públicas' },
  { id: 'bnc', nome: 'Bolsa Nacional de Compras' },
  { id: 'banparanet', nome: 'Banparanet (PA)' },
  { id: 'bec-sp', nome: 'BEC/SP' },
  { id: 'compras-rj', nome: 'Compras Públicas RJ' },
];

export type LanceConfig = {
  id: string;
  edital: string;
  portal: string;
  valorReferencia: number;
  valorInicial: number;
  valorMinimo: number;
  decrementoMin: number;
  decrementoPercentual: number;
  intervaloSegundos: number;
  maxLances: number;
  modoAutomatico: boolean;
  status: 'aguardando' | 'ativo' | 'vencendo' | 'perdendo' | 'encerrado';
  horario: string;
  meuLance: number;
  valorAtual: number;
};

type Props = {
  onSave: (lance: LanceConfig) => void;
  editingLance?: LanceConfig | null;
  trigger?: React.ReactNode;
};

export default function ConfigurarLanceDialog({ onSave, editingLance, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [edital, setEdital] = useState(editingLance?.edital || '');
  const [portal, setPortal] = useState(editingLance?.portal || '');
  const [valorReferencia, setValorReferencia] = useState(editingLance?.valorReferencia?.toString() || '');
  const [valorInicial, setValorInicial] = useState(editingLance?.valorInicial?.toString() || '');
  const [valorMinimo, setValorMinimo] = useState(editingLance?.valorMinimo?.toString() || '');
  const [decrementoMin, setDecrementoMin] = useState(editingLance?.decrementoMin?.toString() || '');
  const [decrementoPercentual, setDecrementoPercentual] = useState(editingLance?.decrementoPercentual?.toString() || '1.5');
  const [intervaloSegundos, setIntervaloSegundos] = useState(editingLance?.intervaloSegundos?.toString() || '30');
  const [maxLances, setMaxLances] = useState(editingLance?.maxLances?.toString() || '20');
  const [modoAutomatico, setModoAutomatico] = useState(editingLance?.modoAutomatico ?? true);
  const [horario, setHorario] = useState(editingLance?.horario || '');

  const resetForm = () => {
    setEdital(''); setPortal(''); setValorReferencia(''); setValorInicial('');
    setValorMinimo(''); setDecrementoMin(''); setDecrementoPercentual('1.5');
    setIntervaloSegundos('30'); setMaxLances('20'); setModoAutomatico(true); setHorario('');
  };

  const handleSave = () => {
    const lance: LanceConfig = {
      id: editingLance?.id || crypto.randomUUID(),
      edital,
      portal,
      valorReferencia: parseFloat(valorReferencia) || 0,
      valorInicial: parseFloat(valorInicial) || 0,
      valorMinimo: parseFloat(valorMinimo) || 0,
      decrementoMin: parseFloat(decrementoMin) || 0,
      decrementoPercentual: parseFloat(decrementoPercentual) || 1.5,
      intervaloSegundos: parseInt(intervaloSegundos) || 30,
      maxLances: parseInt(maxLances) || 20,
      modoAutomatico,
      status: 'aguardando',
      horario,
      meuLance: editingLance?.meuLance || 0,
      valorAtual: parseFloat(valorReferencia) || 0,
    };
    onSave(lance);
    resetForm();
    setOpen(false);
  };

  const calcMinFromPercent = () => {
    const ref = parseFloat(valorReferencia);
    const pct = parseFloat(decrementoPercentual);
    if (ref && pct) {
      setValorMinimo((ref * (1 - pct / 100 * 10)).toFixed(2));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">
            <Plus className="w-4 h-4 mr-1" /> Nova Sessão de Lance
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-accent" />
            {editingLance ? 'Editar Sessão de Lance' : 'Configurar Nova Sessão de Lance'}
          </DialogTitle>
          <DialogDescription>
            Configure os parâmetros para a fase de lances automáticos, similar ao sistema EFFECTI.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Identificação */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Identificação da Licitação</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Nº do Edital / Pregão *</label>
                <Input
                  value={edital}
                  onChange={(e) => setEdital(e.target.value)}
                  placeholder="PE-001/2026"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Portal *</label>
                <Select value={portal} onValueChange={setPortal}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione o portal" />
                  </SelectTrigger>
                  <SelectContent>
                    {portaisDisponiveis.map((p) => (
                      <SelectItem key={p.id} value={p.nome}>{p.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Horário da Sessão</label>
              <Input
                type="time"
                value={horario}
                onChange={(e) => setHorario(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
          </div>

          {/* Valores */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Valores</h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Valor de Referência (R$) *</label>
                <Input
                  type="number"
                  step="0.01"
                  value={valorReferencia}
                  onChange={(e) => setValorReferencia(e.target.value)}
                  placeholder="0,00"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Valor Inicial (1º lance) *</label>
                <Input
                  type="number"
                  step="0.01"
                  value={valorInicial}
                  onChange={(e) => setValorInicial(e.target.value)}
                  placeholder="0,00"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Valor Mínimo (piso) *</label>
                <Input
                  type="number"
                  step="0.01"
                  value={valorMinimo}
                  onChange={(e) => setValorMinimo(e.target.value)}
                  placeholder="0,00"
                  className="mt-1"
                />
                <button
                  type="button"
                  onClick={calcMinFromPercent}
                  className="text-[10px] text-accent hover:underline mt-0.5"
                >
                  Calcular a partir do %
                </button>
              </div>
            </div>
          </div>

          {/* Regras de Decremento */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Regras de Decremento Automático</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Decremento Mínimo (R$)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={decrementoMin}
                  onChange={(e) => setDecrementoMin(e.target.value)}
                  placeholder="Ex: 50000"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Decremento Percentual (%)</label>
                <Input
                  type="number"
                  step="0.1"
                  value={decrementoPercentual}
                  onChange={(e) => setDecrementoPercentual(e.target.value)}
                  placeholder="1.5"
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Intervalo entre lances (seg)</label>
                <Input
                  type="number"
                  value={intervaloSegundos}
                  onChange={(e) => setIntervaloSegundos(e.target.value)}
                  placeholder="30"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Máx. lances por sessão</label>
                <Input
                  type="number"
                  value={maxLances}
                  onChange={(e) => setMaxLances(e.target.value)}
                  placeholder="20"
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          {/* Modo Automático */}
          <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3 border border-border/50">
            <div>
              <p className="text-sm font-medium">Modo Automático</p>
              <p className="text-xs text-muted-foreground">
                O robô enviará lances automaticamente respeitando os parâmetros configurados
              </p>
            </div>
            <Switch checked={modoAutomatico} onCheckedChange={setModoAutomatico} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            onClick={handleSave}
            disabled={!edital || !portal || !valorReferencia || !valorInicial || !valorMinimo}
            className="bg-accent hover:bg-accent/90 text-accent-foreground"
          >
            {editingLance ? 'Salvar Alterações' : 'Cadastrar Sessão'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
