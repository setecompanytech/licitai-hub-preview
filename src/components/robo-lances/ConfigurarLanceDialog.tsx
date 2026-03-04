import { useState, useEffect, useCallback, useMemo } from 'react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Bot, Trash2, Package, Layers, FileSearch, Loader2, Search, CheckCircle2, Building2, ArrowRight, Pencil, Calculator } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

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
  licitacaoId?: string;
};

type LicitacaoRow = {
  id: string;
  numero: string;
  orgao: string;
  objeto: string;
  modalidade: string;
  status: string;
  valor_estimado: number | null;
  portal: string | null;
  data_encerramento: string | null;
};

type PrecificacaoRow = {
  id: string;
  item: string;
  descricao: string | null;
  quantidade: number | null;
  unidade: string | null;
  preco_unitario: number | null;
  custo_unitario: number | null;
};

type CatalogoRow = {
  id: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  preco_unitario: number;
  custo_unitario: number;
};

type Props = {
  onSave: (lance: LanceConfig) => void;
  editingLance?: LanceConfig | null;
  trigger?: React.ReactNode;
};

export default function ConfigurarLanceDialog({ onSave, editingLance, trigger }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<0 | 1 | 2>(editingLance ? 1 : 0);

  // Step 0 – Import
  const [licitacoes, setLicitacoes] = useState<LicitacaoRow[]>([]);
  const [loadingLicitacoes, setLoadingLicitacoes] = useState(false);
  const [searchLic, setSearchLic] = useState('');
  const [selectedLicId, setSelectedLicId] = useState<string | null>(null);
  const [loadingItems, setLoadingItems] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('todos');

  // Step 1 fields
  const [edital, setEdital] = useState(editingLance?.edital || '');
  const [portal, setPortal] = useState(editingLance?.portal || '');
  const [decrementoMin, setDecrementoMin] = useState(editingLance?.decrementoMin?.toString() || '');
  const [decrementoPercentual, setDecrementoPercentual] = useState(editingLance?.decrementoPercentual?.toString() || '1.5');
  const [intervaloSegundos, setIntervaloSegundos] = useState(editingLance?.intervaloSegundos?.toString() || '30');
  const [maxLances, setMaxLances] = useState(editingLance?.maxLances?.toString() || '20');
  const [modoAutomatico, setModoAutomatico] = useState(editingLance?.modoAutomatico ?? true);
  const [horario, setHorario] = useState(editingLance?.horario || '');

  // Step 2 fields
  const [tipoDisputa, setTipoDisputa] = useState<'item' | 'lote'>(editingLance?.tipoDisputa || 'item');
  const [itens, setItens] = useState<DisputeItem[]>(editingLance?.itens || []);
  const [licitacaoIdRef, setLicitacaoIdRef] = useState<string | undefined>(editingLance?.licitacaoId);

  // Step 2 – R$ discount values (user inputs in Reais, system calculates %)
  const [descontoInicialReais, setDescontoInicialReais] = useState(
    editingLance && editingLance.valorReferencia > 0
      ? String(Math.round((editingLance.valorReferencia - editingLance.valorInicial) * 100) / 100)
      : ''
  );
  const [descontoMinimoReais, setDescontoMinimoReais] = useState(
    editingLance && editingLance.valorReferencia > 0
      ? String(Math.round((editingLance.valorReferencia - editingLance.valorMinimo) * 100) / 100)
      : ''
  );

  // New item form
  const [novoDesc, setNovoDesc] = useState('');
  const [novoQtd, setNovoQtd] = useState('1');
  const [novoUnidade, setNovoUnidade] = useState('UN');
  const [novoValorRef, setNovoValorRef] = useState('');
  const [novoLote, setNovoLote] = useState('');

  // ── Auto-calculated values from items ──
  const somaReferencia = useMemo(() => {
    return itens.reduce((sum, item) => sum + (item.valorReferencia * item.quantidade), 0);
  }, [itens]);

  const valorInicial = useMemo(() => {
    const desconto = parseFloat(descontoInicialReais) || 0;
    return Math.round((somaReferencia - desconto) * 100) / 100;
  }, [somaReferencia, descontoInicialReais]);

  const valorMinimo = useMemo(() => {
    const desconto = parseFloat(descontoMinimoReais) || 0;
    return Math.round((somaReferencia - desconto) * 100) / 100;
  }, [somaReferencia, descontoMinimoReais]);

  const pctInicial = useMemo(() => {
    if (somaReferencia <= 0) return 0;
    return Math.round(((parseFloat(descontoInicialReais) || 0) / somaReferencia) * 10000) / 100;
  }, [somaReferencia, descontoInicialReais]);

  const pctMinimo = useMemo(() => {
    if (somaReferencia <= 0) return 0;
    return Math.round(((parseFloat(descontoMinimoReais) || 0) / somaReferencia) * 10000) / 100;
  }, [somaReferencia, descontoMinimoReais]);

  // ── Fetch licitações from Kanban ──
  const fetchLicitacoes = useCallback(async () => {
    if (!user) return;
    setLoadingLicitacoes(true);
    try {
      const { data, error } = await supabase
        .from('licitacoes')
        .select('id, numero, orgao, objeto, modalidade, status, valor_estimado, portal, data_encerramento')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setLicitacoes((data as LicitacaoRow[]) || []);
    } catch {
      toast.error('Erro ao carregar processos.');
    } finally {
      setLoadingLicitacoes(false);
    }
  }, [user]);

  useEffect(() => {
    if (open && step === 0) {
      fetchLicitacoes();
    }
  }, [open, step, fetchLicitacoes]);

  // ── Import selected licitação ──
  const handleImportLicitacao = async (lic: LicitacaoRow) => {
    setSelectedLicId(lic.id);
    setLoadingItems(true);

    // Fill Step 1 fields
    setEdital(lic.numero);
    setPortal(lic.portal || '');
    setLicitacaoIdRef(lic.id);

    if (lic.data_encerramento) {
      try {
        const d = new Date(lic.data_encerramento);
        setHorario(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
      } catch { /* ignore */ }
    }

    // Fetch items from precificacao + catalogo
    try {
      const [precRes, catRes] = await Promise.all([
        supabase
          .from('precificacao')
          .select('id, item, descricao, quantidade, unidade, preco_unitario, custo_unitario')
          .eq('user_id', user!.id)
          .eq('licitacao_id', lic.id),
        supabase
          .from('catalogo_itens_precificados')
          .select('id, descricao, quantidade, unidade, preco_unitario, custo_unitario')
          .eq('user_id', user!.id)
          .eq('licitacao_id', lic.id),
      ]);

      const importedItems: DisputeItem[] = [];
      let num = 1;

      if (precRes.data && precRes.data.length > 0) {
        for (const p of precRes.data as PrecificacaoRow[]) {
          importedItems.push({
            id: crypto.randomUUID(),
            numero: num++,
            descricao: p.descricao || p.item,
            quantidade: p.quantidade || 1,
            unidade: p.unidade || 'UN',
            valorReferencia: p.preco_unitario || p.custo_unitario || 0,
            valorMinimo: 0,
            lote: `Lote ${Math.ceil(num / 5)}`,
            disputando: true,
            situacao: 'aguardando',
            melhorLance: null,
            seuUltimoLance: null,
          });
        }
      }

      if (catRes.data && catRes.data.length > 0) {
        const existingDescs = new Set(importedItems.map(i => i.descricao.toLowerCase()));
        for (const c of catRes.data as CatalogoRow[]) {
          if (!existingDescs.has(c.descricao.toLowerCase())) {
            importedItems.push({
              id: crypto.randomUUID(),
              numero: num++,
              descricao: c.descricao,
              quantidade: c.quantidade || 1,
              unidade: c.unidade || 'UN',
              valorReferencia: c.preco_unitario || c.custo_unitario || 0,
              valorMinimo: 0,
              lote: `Lote ${Math.ceil(num / 5)}`,
              disputando: true,
              situacao: 'aguardando',
              melhorLance: null,
              seuUltimoLance: null,
            });
          }
        }
      }

      setItens(importedItems);

      const itemCount = importedItems.length;
      toast.success(
        itemCount > 0
          ? `✅ Processo importado com ${itemCount} ${itemCount === 1 ? 'item' : 'itens'}!`
          : '✅ Dados do processo importados! Cadastre os itens manualmente no Passo 3.'
      );
    } catch {
      toast.error('Erro ao importar itens do processo.');
    } finally {
      setLoadingItems(false);
      setStep(1);
    }
  };

  const resetForm = () => {
    setEdital(''); setPortal('');
    setDecrementoMin(''); setDecrementoPercentual('1.5');
    setIntervaloSegundos('30'); setMaxLances('20'); setModoAutomatico(true); setHorario('');
    setItens([]); setTipoDisputa('item'); setStep(editingLance ? 1 : 0);
    setSelectedLicId(null); setSearchLic(''); setStatusFilter('todos'); setLicitacaoIdRef(undefined);
    setDescontoInicialReais(''); setDescontoMinimoReais('');
    resetItemForm();
  };

  const resetItemForm = () => {
    setNovoDesc(''); setNovoQtd('1'); setNovoUnidade('UN');
    setNovoValorRef(''); setNovoLote('');
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
      valorMinimo: 0,
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
    setItens(prev => prev.filter(i => i.id !== id).map((item, idx) => ({ ...item, numero: idx + 1 })));
  };

  const handleSave = () => {
    const lance: LanceConfig = {
      id: editingLance?.id || crypto.randomUUID(),
      edital, portal,
      valorReferencia: somaReferencia,
      valorInicial,
      valorMinimo,
      decrementoMin: parseFloat(decrementoMin) || 0,
      decrementoPercentual: parseFloat(decrementoPercentual) || 1.5,
      intervaloSegundos: parseInt(intervaloSegundos) || 30,
      maxLances: parseInt(maxLances) || 20,
      modoAutomatico, status: 'aguardando', horario,
      meuLance: editingLance?.meuLance || 0,
      valorAtual: somaReferencia,
      itens, tipoDisputa,
      licitacaoId: licitacaoIdRef,
    };
    onSave(lance);
    resetForm();
    setOpen(false);
  };

  const step1Valid = edital && portal;

  const formatCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const lotes = [...new Set(itens.map(i => i.lote))].filter(Boolean);

  // Filter licitações
  const statusOptions = ['todos', ...new Set(licitacoes.map(l => l.status))];
  const filteredLicitacoes = licitacoes.filter(l => {
    const matchSearch = !searchLic ||
      l.numero.toLowerCase().includes(searchLic.toLowerCase()) ||
      l.orgao.toLowerCase().includes(searchLic.toLowerCase()) ||
      l.objeto.toLowerCase().includes(searchLic.toLowerCase());
    const matchStatus = statusFilter === 'todos' || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      'Monitorando': 'bg-info/10 text-info border-info/30',
      'Analisando': 'bg-warning/10 text-warning border-warning/30',
      'Proposta': 'bg-accent/10 text-accent border-accent/30',
      'Em Disputa': 'bg-primary/10 text-primary border-primary/30',
      'Vencida': 'bg-success/10 text-success border-success/30',
      'Homologada': 'bg-success/10 text-success border-success/30',
    };
    return map[s] || 'bg-muted text-muted-foreground border-border';
  };

  const stepLabels = editingLance
    ? ['1. Dados da Disputa', '2. Itens / Lotes']
    : ['1. Origem', '2. Dados da Disputa', '3. Itens / Lotes'];

  const currentStepIndex = editingLance ? step - 1 : step;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
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
            {step === 0 && 'Escolha como deseja cadastrar a disputa.'}
            {step === 1 && `Passo ${editingLance ? '1/2' : '2/3'} — Configure os parâmetros gerais da disputa.`}
            {step === 2 && `Passo ${editingLance ? '2/2' : '3/3'} — Cadastre os itens/lotes. Os valores da disputa são calculados automaticamente.`}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-2">
          {stepLabels.map((label, idx) => (
            <div key={label} className="flex items-center gap-2">
              {idx > 0 && <div className="w-5 h-px bg-border" />}
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                currentStepIndex === idx ? 'bg-accent text-accent-foreground' :
                currentStepIndex > idx ? 'bg-accent/20 text-accent' : 'bg-muted text-muted-foreground'
              }`}>
                {currentStepIndex > idx && <CheckCircle2 className="w-3 h-3" />}
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* ── STEP 0: Choose source ── */}
        {step === 0 && !editingLance && (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-dashed border-border hover:border-accent/50 hover:bg-muted/30 transition-all text-center group"
              >
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center group-hover:bg-accent/10 transition-colors">
                  <Pencil className="w-6 h-6 text-muted-foreground group-hover:text-accent" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Cadastro Manual</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Preencha todos os dados da disputa e adicione os itens manualmente.</p>
                </div>
              </button>
              <button
                onClick={() => { /* stay on step 0, show list below */ }}
                className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-accent/40 bg-accent/5 hover:bg-accent/10 transition-all text-center group"
              >
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                  <FileSearch className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Importar do Kanban</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Selecione um processo da sua gestão e importe dados + itens precificados automaticamente.</p>
                </div>
              </button>
            </div>

            {/* Licitações list */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <FileSearch className="w-4 h-4 text-accent" />
                  Seus Processos Licitatórios
                </h4>
                <Badge variant="outline" className="text-[10px]">
                  {filteredLicitacoes.length} {filteredLicitacoes.length === 1 ? 'processo' : 'processos'}
                </Badge>
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por número, órgão ou objeto..."
                    value={searchLic}
                    onChange={(e) => setSearchLic(e.target.value)}
                    className="h-8 pl-8 text-xs"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 w-40 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map(s => (
                      <SelectItem key={s} value={s} className="text-xs">
                        {s === 'todos' ? 'Todos os status' : s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {loadingLicitacoes ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-accent" />
                  <span className="text-xs text-muted-foreground ml-2">Carregando processos...</span>
                </div>
              ) : filteredLicitacoes.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-border rounded-lg bg-muted/20">
                  <Building2 className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">
                    {licitacoes.length === 0
                      ? 'Nenhum processo na gestão. Inicie um processo pelo Monitoramento ou Kanban.'
                      : 'Nenhum processo encontrado com os filtros selecionados.'}
                  </p>
                </div>
              ) : (
                <ScrollArea className="max-h-64">
                  <div className="space-y-1.5">
                    {filteredLicitacoes.map((lic) => (
                      <button
                        key={lic.id}
                        onClick={() => handleImportLicitacao(lic)}
                        disabled={loadingItems && selectedLicId === lic.id}
                        className={`w-full text-left rounded-lg border p-3 transition-all hover:border-accent/50 hover:bg-accent/5 group ${
                          selectedLicId === lic.id && loadingItems
                            ? 'border-accent bg-accent/5'
                            : 'border-border'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-foreground">{lic.numero}</span>
                              <Badge variant="outline" className={`text-[9px] ${statusColor(lic.status)}`}>
                                {lic.status}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{lic.orgao}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{lic.objeto}</p>
                            <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                              {lic.portal && <span>{lic.portal}</span>}
                              {lic.valor_estimado && (
                                <span className="font-mono font-medium text-foreground">
                                  {formatCurrency(lic.valor_estimado)}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="shrink-0 ml-3 self-center">
                            {loadingItems && selectedLicId === lic.id ? (
                              <Loader2 className="w-4 h-4 animate-spin text-accent" />
                            ) : (
                              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-colors" />
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>
        )}

        {/* ── STEP 1: Dispute data ── */}
        {step === 1 && (
          <div className="space-y-5 py-2">
            {licitacaoIdRef && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-success/10 border border-success/30 text-xs text-success">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Dados importados do processo <strong>{edital}</strong>. Revise e ajuste conforme necessário.</span>
              </div>
            )}

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

            <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3 border border-border/50">
              <div>
                <p className="text-sm font-medium">Modo Automático</p>
                <p className="text-xs text-muted-foreground">O robô enviará lances automaticamente respeitando os parâmetros configurados</p>
              </div>
              <Switch checked={modoAutomatico} onCheckedChange={setModoAutomatico} />
            </div>
          </div>
        )}

        {/* ── STEP 2: Items/Lots ── */}
        {step === 2 && (
          <div className="space-y-5 py-2">
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Layers className="w-4 h-4 text-accent" /> Tipo de Disputa
              </h4>
              <div className="flex gap-3">
                <button
                  onClick={() => setTipoDisputa('item')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                    tipoDisputa === 'item' ? 'bg-accent text-accent-foreground border-accent' : 'bg-card text-muted-foreground border-border hover:border-accent/50'
                  }`}
                >
                  <Package className="w-4 h-4" /> Por Item
                </button>
                <button
                  onClick={() => setTipoDisputa('lote')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                    tipoDisputa === 'lote' ? 'bg-accent text-accent-foreground border-accent' : 'bg-card text-muted-foreground border-border hover:border-accent/50'
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
                  <label className="text-[10px] text-muted-foreground">Valor Unit. (R$)</label>
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
                      <span className="font-normal text-muted-foreground ml-2">em {lotes.length} {lotes.length === 1 ? 'lote' : 'lotes'}</span>
                    )}
                  </h4>
                  {licitacaoIdRef && (
                    <Badge variant="outline" className="text-[9px] bg-success/10 text-success border-success/30">
                      Importados do Kanban
                    </Badge>
                  )}
                </div>

                <div className="border border-border rounded-lg overflow-hidden max-h-44 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-[10px] w-10 text-center">Nº</TableHead>
                        <TableHead className="text-[10px]">Descrição</TableHead>
                        <TableHead className="text-[10px] text-center">Qtd</TableHead>
                        <TableHead className="text-[10px] text-center">Unid.</TableHead>
                        {tipoDisputa === 'lote' && <TableHead className="text-[10px]">Lote</TableHead>}
                        <TableHead className="text-[10px] text-right">Vlr Unit.</TableHead>
                        <TableHead className="text-[10px] text-right">Vlr Total</TableHead>
                        <TableHead className="text-[10px] w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {itens.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-xs text-center font-medium">{item.numero}</TableCell>
                          <TableCell className="text-xs max-w-[160px] truncate">{item.descricao}</TableCell>
                          <TableCell className="text-xs text-center">{item.quantidade}</TableCell>
                          <TableCell className="text-xs text-center">{item.unidade}</TableCell>
                          {tipoDisputa === 'lote' && (
                            <TableCell><Badge variant="outline" className="text-[9px]">{item.lote}</Badge></TableCell>
                          )}
                          <TableCell className="text-xs text-right font-mono">
                            {item.valorReferencia > 0 ? formatCurrency(item.valorReferencia) : '—'}
                          </TableCell>
                          <TableCell className="text-xs text-right font-mono font-semibold">
                            {item.valorReferencia > 0 ? formatCurrency(item.valorReferencia * item.quantidade) : '—'}
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

            {/* ── Auto-calculated values panel ── */}
            {itens.length > 0 && (
              <div className="space-y-3 border border-accent/30 rounded-xl bg-accent/5 p-4">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-accent" />
                  Valores da Disputa
                  <Badge variant="outline" className="text-[9px] bg-accent/10 text-accent border-accent/30 ml-auto">
                    Calculado automaticamente
                  </Badge>
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Os valores são calculados com base na somatória dos {itens.length} {itens.length === 1 ? 'item' : 'itens'} cadastrados (Qtd × Vlr Unit.).
                </p>

                <div className="grid grid-cols-3 gap-3">
                  {/* Valor de Referência – read-only sum */}
                  <div className="bg-card rounded-lg border border-border p-3 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Valor de Referência</p>
                    <p className="text-lg font-bold text-foreground mt-1 font-mono">{formatCurrency(somaReferencia)}</p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">Σ (Qtd × Vlr Unit.)</p>
                  </div>

                  {/* Valor Inicial – input in R$, shows % */}
                  <div className="bg-card rounded-lg border border-border p-3 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Valor Inicial (1º lance)</p>
                    <p className="text-lg font-bold text-accent mt-1 font-mono">{formatCurrency(valorInicial)}</p>
                    <div className="flex items-center justify-center gap-1 mt-1.5">
                      <span className="text-[10px] text-muted-foreground">Desconto R$</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={descontoInicialReais}
                        onChange={(e) => setDescontoInicialReais(e.target.value)}
                        placeholder="0,00"
                        className="h-6 w-24 text-[11px] text-center px-1"
                      />
                    </div>
                    <p className="text-[9px] text-accent font-medium mt-1">≈ {pctInicial.toFixed(2)}% de desconto</p>
                  </div>

                  {/* Valor Mínimo – input in R$, shows % */}
                  <div className="bg-card rounded-lg border border-destructive/30 p-3 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Valor Mínimo (piso)</p>
                    <p className="text-lg font-bold text-destructive mt-1 font-mono">{formatCurrency(valorMinimo)}</p>
                    <div className="flex items-center justify-center gap-1 mt-1.5">
                      <span className="text-[10px] text-muted-foreground">Desconto R$</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={descontoMinimoReais}
                        onChange={(e) => setDescontoMinimoReais(e.target.value)}
                        placeholder="0,00"
                        className="h-6 w-24 text-[11px] text-center px-1"
                      />
                    </div>
                    <p className="text-[9px] text-destructive font-medium mt-1">≈ {pctMinimo.toFixed(2)}% de desconto</p>
                  </div>
                </div>

                {valorMinimo > valorInicial && (
                  <p className="text-[10px] text-destructive flex items-center gap-1">
                    ⚠️ O valor mínimo (piso) está acima do valor inicial. Ajuste os percentuais.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex justify-between sm:justify-between">
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep((step - 1) as 0 | 1)}>
              Voltar
            </Button>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setOpen(false); resetForm(); }}>Cancelar</Button>
            {step === 0 && (
              <Button onClick={() => setStep(1)} variant="outline" className="text-xs">
                <Pencil className="w-3.5 h-3.5 mr-1" /> Pular para cadastro manual
              </Button>
            )}
            {step === 1 && (
              <Button
                onClick={() => setStep(2)}
                disabled={!step1Valid}
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                Próximo: Itens / Lotes
              </Button>
            )}
            {step === 2 && (
              <Button
                onClick={handleSave}
                disabled={itens.length === 0 || somaReferencia <= 0 || valorMinimo > valorInicial}
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
