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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Bot, Trash2, Package, Layers } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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

export type DisputeItem = {
  id: string;
  numero: number;
  descricao: string;
  quantidade: number;
  unidade: string;
  valorReferencia: number;
  valorMinimo: number;
  lote: string;
  disputando: boolean;
  situacao: 'aguardando' | 'disputando' | 'encerrado';
  melhorLance: number | null;
  seuUltimoLance: number | null;
};

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
  itens: DisputeItem[];
  tipoDisputa: 'item' | 'lote';
};

type Props = {
  onSave: (lance: LanceConfig) => void;
  editingLance?: LanceConfig | null;
  trigger?: React.ReactNode;
};

export default function ConfigurarLanceDialog({ onSave, editingLance, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 fields
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

  // Step 2 fields – items/lots
  const [tipoDisputa, setTipoDisputa] = useState<'item' | 'lote'>(editingLance?.tipoDisputa || 'item');
  const [itens, setItens] = useState<DisputeItem[]>(editingLance?.itens || []);

  // New item form
  const [novoDesc, setNovoDesc] = useState('');
  const [novoQtd, setNovoQtd] = useState('1');
  const [novoUnidade, setNovoUnidade] = useState('UN');
  const [novoValorRef, setNovoValorRef] = useState('');
  const [novoValorMin, setNovoValorMin] = useState('');
  const [novoLote, setNovoLote] = useState('');

  const resetForm = () => {
    setEdital(''); setPortal(''); setValorReferencia(''); setValorInicial('');
    setValorMinimo(''); setDecrementoMin(''); setDecrementoPercentual('1.5');
    setIntervaloSegundos('30'); setMaxLances('20'); setModoAutomatico(true); setHorario('');
    setItens([]); setTipoDisputa('item'); setStep(1);
    resetItemForm();
  };

  const resetItemForm = () => {
    setNovoDesc(''); setNovoQtd('1'); setNovoUnidade('UN');
    setNovoValorRef(''); setNovoValorMin(''); setNovoLote('');
  };

  const handleAddItem = () => {
    if (!novoDesc.trim()) return;
    const nextNum = itens.length > 0 ? Math.max(...itens.map(i => i.numero)) + 1 : 1;
    const newItem: DisputeItem = {
      id: crypto.randomUUID(),
      numero: nextNum,
      descricao: novoDesc.trim(),
      quantidade: parseInt(novoQtd) || 1,
      unidade: novoUnidade || 'UN',
      valorReferencia: parseFloat(novoValorRef) || 0,
      valorMinimo: parseFloat(novoValorMin) || 0,
      lote: novoLote.trim() || `Lote ${Math.ceil(nextNum / 5)}`,
      disputando: true,
      situacao: 'aguardando',
      melhorLance: null,
      seuUltimoLance: null,
    };
    setItens(prev => [...prev, newItem]);
    resetItemForm();
  };

  const handleRemoveItem = (id: string) => {
    setItens(prev => {
      const filtered = prev.filter(i => i.id !== id);
      return filtered.map((item, idx) => ({ ...item, numero: idx + 1 }));
    });
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
      itens,
      tipoDisputa,
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

  const step1Valid = edital && portal && valorReferencia && valorInicial && valorMinimo;

  const formatCurrency = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const lotes = [...new Set(itens.map(i => i.lote))].filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { resetForm(); } }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">
            <Plus className="w-4 h-4 mr-1" /> Nova Sessão de Lance
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-accent" />
            {editingLance ? 'Editar Sessão de Lance' : 'Configurar Nova Sessão de Lance'}
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? 'Passo 1/2 — Configure os parâmetros gerais da disputa.'
              : 'Passo 2/2 — Cadastre os itens e lotes para lances automáticos.'}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-2">
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${step === 1 ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>
            1. Dados da Disputa
          </div>
          <div className="w-6 h-px bg-border" />
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${step === 2 ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>
            2. Itens / Lotes
          </div>
        </div>

        {step === 1 && (
          <div className="space-y-5 py-2">
            {/* Identificação */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Identificação da Licitação</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Nº do Edital / Pregão *</label>
                  <Input value={edital} onChange={(e) => setEdital(e.target.value)} placeholder="PE-001/2026" className="mt-1" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Portal *</label>
                  <Select value={portal} onValueChange={setPortal}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione o portal" /></SelectTrigger>
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
                <Input type="time" value={horario} onChange={(e) => setHorario(e.target.value)} className="mt-1 w-40" />
              </div>
            </div>

            {/* Valores */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Valores</h4>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Valor de Referência (R$) *</label>
                  <Input type="number" step="0.01" value={valorReferencia} onChange={(e) => setValorReferencia(e.target.value)} placeholder="0,00" className="mt-1" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Valor Inicial (1º lance) *</label>
                  <Input type="number" step="0.01" value={valorInicial} onChange={(e) => setValorInicial(e.target.value)} placeholder="0,00" className="mt-1" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Valor Mínimo (piso) *</label>
                  <Input type="number" step="0.01" value={valorMinimo} onChange={(e) => setValorMinimo(e.target.value)} placeholder="0,00" className="mt-1" />
                  <button type="button" onClick={calcMinFromPercent} className="text-[10px] text-accent hover:underline mt-0.5">
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
                  <Input type="number" step="0.01" value={decrementoMin} onChange={(e) => setDecrementoMin(e.target.value)} placeholder="Ex: 50000" className="mt-1" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Decremento Percentual (%)</label>
                  <Input type="number" step="0.1" value={decrementoPercentual} onChange={(e) => setDecrementoPercentual(e.target.value)} placeholder="1.5" className="mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Intervalo entre lances (seg)</label>
                  <Input type="number" value={intervaloSegundos} onChange={(e) => setIntervaloSegundos(e.target.value)} placeholder="30" className="mt-1" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Máx. lances por sessão</label>
                  <Input type="number" value={maxLances} onChange={(e) => setMaxLances(e.target.value)} placeholder="20" className="mt-1" />
                </div>
              </div>
            </div>

            {/* Modo Automático */}
            <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3 border border-border/50">
              <div>
                <p className="text-sm font-medium">Modo Automático</p>
                <p className="text-xs text-muted-foreground">O robô enviará lances automaticamente respeitando os parâmetros configurados</p>
              </div>
              <Switch checked={modoAutomatico} onCheckedChange={setModoAutomatico} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5 py-2">
            {/* Tipo de disputa */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Layers className="w-4 h-4 text-accent" /> Tipo de Disputa
              </h4>
              <div className="flex gap-3">
                <button
                  onClick={() => setTipoDisputa('item')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                    tipoDisputa === 'item'
                      ? 'bg-accent text-accent-foreground border-accent'
                      : 'bg-card text-muted-foreground border-border hover:border-accent/50'
                  }`}
                >
                  <Package className="w-4 h-4" /> Por Item
                </button>
                <button
                  onClick={() => setTipoDisputa('lote')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                    tipoDisputa === 'lote'
                      ? 'bg-accent text-accent-foreground border-accent'
                      : 'bg-card text-muted-foreground border-border hover:border-accent/50'
                  }`}
                >
                  <Layers className="w-4 h-4" /> Por Lote
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {tipoDisputa === 'item'
                  ? 'Cada item será disputado individualmente. Os lances são enviados item a item.'
                  : 'Os itens são agrupados em lotes. O lance é enviado para o lote como um todo.'}
              </p>
            </div>

            {/* Add item form */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Plus className="w-4 h-4 text-accent" /> Adicionar {tipoDisputa === 'lote' ? 'Item ao Lote' : 'Item'}
              </h4>
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-5">
                  <label className="text-[10px] text-muted-foreground">Descrição *</label>
                  <Input value={novoDesc} onChange={(e) => setNovoDesc(e.target.value)} placeholder="Ex: Toner HP 26A" className="mt-0.5 h-8 text-xs" />
                </div>
                <div className="col-span-1">
                  <label className="text-[10px] text-muted-foreground">Qtd</label>
                  <Input type="number" min="1" value={novoQtd} onChange={(e) => setNovoQtd(e.target.value)} className="mt-0.5 h-8 text-xs" />
                </div>
                <div className="col-span-1">
                  <label className="text-[10px] text-muted-foreground">Unid.</label>
                  <Input value={novoUnidade} onChange={(e) => setNovoUnidade(e.target.value)} placeholder="UN" className="mt-0.5 h-8 text-xs" />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] text-muted-foreground">Valor Ref. (R$)</label>
                  <Input type="number" step="0.01" value={novoValorRef} onChange={(e) => setNovoValorRef(e.target.value)} placeholder="0,00" className="mt-0.5 h-8 text-xs" />
                </div>
                {tipoDisputa === 'lote' && (
                  <div className="col-span-2">
                    <label className="text-[10px] text-muted-foreground">Lote</label>
                    <Input value={novoLote} onChange={(e) => setNovoLote(e.target.value)} placeholder="Lote 1" className="mt-0.5 h-8 text-xs" />
                  </div>
                )}
                <div className={tipoDisputa === 'lote' ? 'col-span-1' : 'col-span-3'}>
                  <label className="text-[10px] text-muted-foreground invisible">+</label>
                  <Button onClick={handleAddItem} size="sm" disabled={!novoDesc.trim()} className="mt-0.5 h-8 w-full bg-accent hover:bg-accent/90 text-accent-foreground text-xs">
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Items list */}
            {itens.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-foreground">
                    {itens.length} {itens.length === 1 ? 'item cadastrado' : 'itens cadastrados'}
                    {tipoDisputa === 'lote' && lotes.length > 0 && (
                      <span className="font-normal text-muted-foreground ml-2">
                        em {lotes.length} {lotes.length === 1 ? 'lote' : 'lotes'}
                      </span>
                    )}
                  </h4>
                </div>

                <div className="border border-border rounded-lg overflow-hidden max-h-52 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-[10px] w-10 text-center">Nº</TableHead>
                        <TableHead className="text-[10px]">Descrição</TableHead>
                        <TableHead className="text-[10px] text-center">Qtd</TableHead>
                        <TableHead className="text-[10px] text-center">Unid.</TableHead>
                        {tipoDisputa === 'lote' && <TableHead className="text-[10px]">Lote</TableHead>}
                        <TableHead className="text-[10px] text-right">Valor Ref.</TableHead>
                        <TableHead className="text-[10px] w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {itens.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-xs text-center font-medium">{item.numero}</TableCell>
                          <TableCell className="text-xs max-w-[180px] truncate">{item.descricao}</TableCell>
                          <TableCell className="text-xs text-center">{item.quantidade}</TableCell>
                          <TableCell className="text-xs text-center">{item.unidade}</TableCell>
                          {tipoDisputa === 'lote' && (
                            <TableCell>
                              <Badge variant="outline" className="text-[9px]">{item.lote}</Badge>
                            </TableCell>
                          )}
                          <TableCell className="text-xs text-right font-mono">
                            {item.valorReferencia > 0 ? formatCurrency(item.valorReferencia) : '—'}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={() => handleRemoveItem(item.id)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {itens.length === 0 && (
              <div className="text-center py-6 border border-dashed border-border rounded-lg bg-muted/20">
                <Package className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Nenhum item cadastrado ainda.</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Preencha o formulário acima para adicionar itens à disputa.
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex justify-between sm:justify-between">
          {step === 2 && (
            <Button variant="outline" onClick={() => setStep(1)}>
              Voltar
            </Button>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setOpen(false); resetForm(); }}>Cancelar</Button>
            {step === 1 ? (
              <Button
                onClick={() => setStep(2)}
                disabled={!step1Valid}
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                Próximo: Itens / Lotes
              </Button>
            ) : (
              <Button
                onClick={handleSave}
                disabled={itens.length === 0}
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                {editingLance ? 'Salvar Alterações' : 'Cadastrar Sessão'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
