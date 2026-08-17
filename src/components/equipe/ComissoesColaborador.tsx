import { useState, useEffect } from 'react';
import { TIPOS_BONIFICACAO, ehPercentual, rotuloDoValor } from '@/lib/equipe/bonificacao';
import { nomeExibido } from '@/lib/equipe/nomeExibido';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { DollarSign, Plus, Settings, TrendingUp, Eye, EyeOff, Receipt } from 'lucide-react';

const TIPO_COMISSAO = TIPOS_BONIFICACAO as Record<string, { label: string; desc: string }>;

const STATUS_LANCAMENTO: Record<string, { label: string; color: string }> = {
  pendente: { label: 'Pendente', color: 'bg-warning/15 text-warning' },
  aprovado: { label: 'Aprovado', color: 'bg-info/15 text-info' },
  pago: { label: 'Pago', color: 'bg-success/15 text-success' },
  cancelado: { label: 'Cancelado', color: 'bg-destructive/15 text-destructive' },
  rejeitado: { label: 'Rejeitado', color: 'bg-destructive/15 text-destructive' },
};

type Config = {
  id: string;
  empresa_id: string;
  user_id: string;
  tipo_comissao: string;
  percentual: number;
  valor_fixo: number;
  regra_desconto: any;
  visibilidade_publica: boolean;
  ativo: boolean;
};

type Lancamento = {
  id: string;
  user_id: string;
  tipo: string;
  valor_base: number;
  desconto_percentual: number;
  percentual_comissao: number;
  valor_comissao: number;
  nota_fiscal: string | null;
  status: string;
  observacoes: string | null;
  created_at: string;
  contrato_pedido_id: string | null;
};

/** Pedido com NF-e quitada — o fato que autoriza o pagamento da bonificação. */
type PedidoQuitado = {
  id: string;
  numero_pedido: string;
  nota_fiscal: string | null;
  valor_total: number;
  data_quitacao: string | null;
  vendedor_user_id: string | null;
  orgao: string | null;
};

type Membro = {
  user_id: string;
  nome: string | null;
  email: string | null;
  /** Conta criada por convite de setor: `nome` é o rótulo do setor e vários
   *  colaboradores o compartilham. Quem identifica a pessoa são estes. */
  nome_individual: string | null;
  login_individual: string | null;
};


export default function ComissoesColaborador({ empresaId, isAdmin }: { empresaId: string; isAdmin: boolean }) {
  const { user } = useAuth();
  const [configs, setConfigs] = useState<Config[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showLancDialog, setShowLancDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'resumo' | 'lancamentos' | 'config'>('resumo');

  // Config form
  const [cfgUserId, setCfgUserId] = useState('');
  const [cfgTipo, setCfgTipo] = useState('percentual_contrato');
  const [cfgPercentual, setCfgPercentual] = useState('');
  const [cfgValorFixo, setCfgValorFixo] = useState('');
  const [cfgVisibilidade, setCfgVisibilidade] = useState(false);

  /** Zera o formulário — nada do colaborador anterior sobra na próxima vez. */
  const limparConfig = () => {
    setCfgUserId('');
    setCfgTipo('percentual_contrato');
    setCfgPercentual('');
    setCfgValorFixo('');
    setCfgRegraDesconto('');
    setCfgVisibilidade(false);
  };
  const [cfgRegraDesconto, setCfgRegraDesconto] = useState('');

  // Lançamento form
  const [lancUserId, setLancUserId] = useState('');
  const [lancValorBase, setLancValorBase] = useState('');
  const [lancDesconto, setLancDesconto] = useState('0');
  const [lancNF, setLancNF] = useState('');
  const [lancObs, setLancObs] = useState('');
  const [lancPedidoId, setLancPedidoId] = useState('');
  const [quitados, setQuitados] = useState<PedidoQuitado[]>([]);

  useEffect(() => { loadData(); }, [empresaId]);

  const loadData = async () => {
    setLoading(true);
    const [cfgRes, lancRes, membrosRes, quitRes] = await Promise.all([
      supabase.from('comissoes_config' as any).select('*').eq('empresa_id', empresaId),
      supabase.from('comissoes_lancamentos' as any).select('*').eq('empresa_id', empresaId).order('created_at', { ascending: false }),
      supabase.from('empresa_membros').select('user_id, nome, email, nome_individual, login_individual').eq('empresa_id', empresaId),
      // A bonificação só é paga depois que o cliente quita a NF-e, então o
      // lançamento manual precisa apontar QUAL quitação o autoriza.
      supabase
        .from('contrato_pedidos' as any)
        .select('id, numero_pedido, nota_fiscal, valor_total, data_quitacao, contratos!inner(empresa_id, vendedor_user_id, orgao_contratante)')
        .eq('nf_quitada', true)
        .eq('contratos.empresa_id', empresaId)
        .order('data_quitacao', { ascending: false }),
    ]);
    setConfigs((cfgRes.data as any[]) || []);
    setLancamentos((lancRes.data as any[]) || []);
    setMembros((membrosRes.data as any[]) || []);
    setQuitados(((quitRes.data as any[]) || []).map((p) => ({
      id: p.id,
      numero_pedido: p.numero_pedido,
      nota_fiscal: p.nota_fiscal,
      valor_total: Number(p.valor_total) || 0,
      data_quitacao: p.data_quitacao,
      vendedor_user_id: p.contratos?.vendedor_user_id ?? null,
      orgao: p.contratos?.orgao_contratante ?? null,
    })));
    setLoading(false);
  };

  const getMembroNome = (userId: string) => {
    return nomeExibido(membros.find(m => m.user_id === userId));
  };

  const handleSaveConfig = async () => {
    if (!cfgUserId) return;
    setSaving(true);
    const payload: any = {
      empresa_id: empresaId,
      user_id: cfgUserId,
      tipo_comissao: cfgTipo,
      percentual: parseFloat(cfgPercentual) || 0,
      valor_fixo: parseFloat(cfgValorFixo) || 0,
      visibilidade_publica: cfgVisibilidade,
      regra_desconto: cfgRegraDesconto ? { regra: cfgRegraDesconto } : {},
    };

    const existing = configs.find(c => c.user_id === cfgUserId);
    const { error } = existing
      ? await supabase.from('comissoes_config' as any).update(payload).eq('id', existing.id)
      : await supabase.from('comissoes_config' as any).insert(payload);

    if (error) toast.error('Erro: ' + error.message);
    else { toast.success('Configuração salva'); setShowConfigDialog(false); loadData(); }
    setSaving(false);
  };

  // Só as quitações dos contratos do próprio colaborador: bonificar alguém
  // pela nota que outro vendeu seria o mesmo erro de carteira compartilhada.
  // Lançamento antigo, feito antes desta regra, não tem vínculo com quitação —
  // e sem o vínculo não há como provar que o cliente pagou.
  const temQuitacao = (l: Lancamento) =>
    !!l.contrato_pedido_id && quitados.some((q) => q.id === l.contrato_pedido_id);

  const quitadosDoColaborador = quitados.filter((q) => q.vendedor_user_id === lancUserId);

  const handleLancar = async () => {
    if (!lancUserId || !lancValorBase) return;
    setSaving(true);
    const cfg = configs.find(c => c.user_id === lancUserId);
    const valorBase = parseFloat(lancValorBase);
    const desconto = parseFloat(lancDesconto) || 0;
    const percentual = cfg?.percentual || 0;
    const valorComissao = !ehPercentual(cfg?.tipo_comissao)
      ? cfg.valor_fixo
      : valorBase * (1 - desconto / 100) * (percentual / 100);

    const { error } = await supabase.from('comissoes_lancamentos' as any).insert({
      empresa_id: empresaId,
      user_id: lancUserId,
      tipo: cfg?.tipo_comissao || 'percentual_contrato',
      valor_base: valorBase,
      desconto_percentual: desconto,
      percentual_comissao: percentual,
      valor_comissao: valorComissao,
      nota_fiscal: lancNF || null,
      observacoes: lancObs || null,
      contrato_pedido_id: lancPedidoId || null,
    } as any);

    if (error) toast.error('Erro: ' + error.message);
    else {
      toast.success(`Bonificação de R$ ${valorComissao.toFixed(2)} lançada`);
      setShowLancDialog(false);
      setLancUserId(''); setLancValorBase(''); setLancDesconto('0'); setLancNF(''); setLancObs(''); setLancPedidoId('');
      loadData();
    }
    setSaving(false);
  };

  const handleUpdateLancStatus = async (id: string, status: string) => {
    const updates: any = { status };
    if (status === 'pago') updates.pago_em = new Date().toISOString();
    const { error } = await supabase.from('comissoes_lancamentos' as any).update(updates).eq('id', id);
    if (error) toast.error('Erro ao atualizar');
    else { toast.success('Status atualizado'); loadData(); }
  };

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Resumo por colaborador
  const resumoPorColaborador = membros.map(m => {
    const exibicao = nomeExibido(m);
    const cfg = configs.find(c => c.user_id === m.user_id);
    const lancs = lancamentos.filter(l => l.user_id === m.user_id);
    const totalPendente = lancs.filter(l => l.status === 'pendente').reduce((s, l) => s + (l.valor_comissao || 0), 0);
    const totalAprovado = lancs.filter(l => l.status === 'aprovado').reduce((s, l) => s + (l.valor_comissao || 0), 0);
    const totalPago = lancs.filter(l => l.status === 'pago').reduce((s, l) => s + (l.valor_comissao || 0), 0);
    return { ...m, exibicao, cfg, totalPendente, totalAprovado, totalPago, total: totalPendente + totalAprovado + totalPago };
  }).filter(m => m.cfg || lancamentos.some(l => l.user_id === m.user_id));

  if (loading) return <p className="text-center text-muted-foreground py-6">Carregando bonificações...</p>;

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1">
          {(['resumo', 'lancamentos', 'config'] as const).map(t => (
            <Button key={t} variant={tab === t ? 'default' : 'ghost'} size="sm" onClick={() => setTab(t)} className="text-xs capitalize">
              {t === 'resumo' ? 'Resumo' : t === 'lancamentos' ? 'Lançamentos' : 'Configurar'}
            </Button>
          ))}
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowConfigDialog(true)}>
              <Settings className="w-4 h-4 mr-1" /> Configurar
            </Button>
            <Button size="sm" onClick={() => setShowLancDialog(true)} className="bg-accent hover:bg-accent/90 text-accent-foreground">
              <Plus className="w-4 h-4 mr-1" /> Lançar Bonificação
            </Button>
          </div>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card rounded-lg border border-border/50 p-3 text-center">
          <p className="text-xs text-muted-foreground">Pendente</p>
          <p className="text-lg font-bold text-warning">{fmt(lancamentos.filter(l => l.status === 'pendente').reduce((s, l) => s + l.valor_comissao, 0))}</p>
        </div>
        <div className="bg-card rounded-lg border border-border/50 p-3 text-center">
          <p className="text-xs text-muted-foreground">Aprovado</p>
          <p className="text-lg font-bold text-info">{fmt(lancamentos.filter(l => l.status === 'aprovado').reduce((s, l) => s + l.valor_comissao, 0))}</p>
        </div>
        <div className="bg-card rounded-lg border border-border/50 p-3 text-center">
          <p className="text-xs text-muted-foreground">Pago</p>
          <p className="text-lg font-bold text-success">{fmt(lancamentos.filter(l => l.status === 'pago').reduce((s, l) => s + l.valor_comissao, 0))}</p>
        </div>
        <div className="bg-card rounded-lg border border-border/50 p-3 text-center">
          <p className="text-xs text-muted-foreground">Colaboradores</p>
          <p className="text-lg font-bold text-foreground">{configs.length}</p>
        </div>
      </div>

      {/* Resumo Tab */}
      {tab === 'resumo' && (
        <div className="space-y-2">
          {resumoPorColaborador.length === 0 ? (
            <div className="bg-card rounded-xl border border-border/50 p-8 text-center">
              <DollarSign className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma bonificação configurada. Configure os colaboradores bonificados.</p>
            </div>
          ) : resumoPorColaborador.map(r => (
            <div key={r.user_id} className="bg-card rounded-lg border border-border/50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">{r.exibicao}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {r.cfg && <Badge className="text-xs bg-muted text-muted-foreground">{TIPO_COMISSAO[r.cfg.tipo_comissao]?.label}</Badge>}
                    {r.cfg && <span className="text-xs text-muted-foreground">
                      {rotuloDoValor(r.cfg.tipo_comissao, r.cfg.percentual, r.cfg.valor_fixo, fmt)}
                    </span>}
                    {r.cfg?.visibilidade_publica ? <Eye className="w-3 h-3 text-muted-foreground" /> : <EyeOff className="w-3 h-3 text-muted-foreground" />}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Total bonificações</p>
                  <p className="font-bold text-foreground">{fmt(r.total)}</p>
                  <div className="flex gap-2 text-xs mt-0.5">
                    <span className="text-warning">P: {fmt(r.totalPendente)}</span>
                    <span className="text-success">Pg: {fmt(r.totalPago)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lançamentos Tab */}
      {tab === 'lancamentos' && (
        <div className="space-y-2">
          {lancamentos.length === 0 ? (
            <div className="bg-card rounded-xl border border-border/50 p-8 text-center">
              <Receipt className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum lançamento registrado.</p>
            </div>
          ) : lancamentos.map(l => {
            const st = STATUS_LANCAMENTO[l.status] || STATUS_LANCAMENTO.pendente;
            return (
              <div key={l.id} className="bg-card rounded-lg border border-border/50 p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{getMembroNome(l.user_id)}</span>
                    <Badge className={`text-xs ${st.color}`}>{st.label}</Badge>
                    {l.nota_fiscal && <Badge variant="outline" className="text-xs">NF: {l.nota_fiscal}</Badge>}
                  </div>
                  <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                    <span>Base: {fmt(l.valor_base)}</span>
                    {l.desconto_percentual > 0 && <span>Desc: {l.desconto_percentual}%</span>}
                    <span>{l.percentual_comissao}%</span>
                    <span>{new Date(l.created_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                  {l.observacoes && <p className="text-xs text-muted-foreground mt-0.5">{l.observacoes}</p>}
                  {l.status !== 'pago' && !temQuitacao(l) && (
                    <p className="text-xs text-warning mt-0.5">
                      Aguardando quitação da NF-e — o pagamento só é liberado depois que o
                      cliente paga a nota.
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="font-bold text-foreground">{fmt(l.valor_comissao)}</span>
                  {isAdmin && l.status !== 'pago' && (
                    <Select value={l.status} onValueChange={v => handleUpdateLancStatus(l.id, v)}>
                      <SelectTrigger className="w-[100px] h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_LANCAMENTO).map(([k, v]) => (
                          <SelectItem key={k} value={k} disabled={k === 'pago' && !temQuitacao(l)}>
                            {v.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Config Tab */}
      {tab === 'config' && isAdmin && (
        <div className="space-y-2">
          {configs.length === 0 ? (
            <div className="bg-card rounded-xl border border-border/50 p-8 text-center">
              <Settings className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum colaborador configurado. Clique em "Configurar" para definir as regras de bonificação.</p>
            </div>
          ) : configs.map(c => (
            <div key={c.id} className="bg-card rounded-lg border border-border/50 p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">{getMembroNome(c.user_id)}</p>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <span>{TIPO_COMISSAO[c.tipo_comissao]?.label}</span>
                  <span>•</span>
                  <span>{rotuloDoValor(c.tipo_comissao, c.percentual, c.valor_fixo, fmt)}</span>
                  <span>•</span>
                  <span>{c.visibilidade_publica ? 'Visível p/ equipe' : 'Somente admin'}</span>
                </div>
              </div>
              <Badge className={c.ativo ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'}>
                {c.ativo ? 'Ativo' : 'Inativo'}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {/* Config Dialog */}
      <Dialog
        open={showConfigDialog}
        onOpenChange={(aberto) => { if (!aberto) limparConfig(); setShowConfigDialog(aberto); }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Configurar Bonificação</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Colaborador *</Label>
              <Select value={cfgUserId} onValueChange={v => {
                setCfgUserId(v);
                const existing = configs.find(c => c.user_id === v);
                if (existing) {
                  setCfgTipo(existing.tipo_comissao);
                  setCfgPercentual(String(existing.percentual));
                  setCfgValorFixo(String(existing.valor_fixo));
                  setCfgVisibilidade(existing.visibilidade_publica);
                } else {
                  // Colaborador ainda sem configuração: volta ao padrão. Antes,
                  // os campos do colaborador anterior permaneciam — e a
                  // visibilidade ligada uma vez contaminava todos os seguintes,
                  // expondo o valor da bonificação de quem nunca foi marcado.
                  setCfgTipo('percentual_contrato');
                  setCfgPercentual('');
                  setCfgValorFixo('');
                  setCfgRegraDesconto('');
                  setCfgVisibilidade(false);
                }
              }}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {membros.map(m => (
                    <SelectItem key={m.user_id} value={m.user_id}>{nomeExibido(m)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo de Bonificação</Label>
              <Select value={cfgTipo} onValueChange={setCfgTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_COMISSAO).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">{TIPO_COMISSAO[cfgTipo]?.desc}</p>
            </div>
            {cfgTipo === 'valor_fixo' ? (
              <div>
                <Label>Valor Fixo (R$)</Label>
                <MoneyInput value={Number(cfgValorFixo) || 0} onValueChange={v => setCfgValorFixo(String(v))} placeholder="R$ 0,00" />
              </div>
            ) : (
              <div>
                <Label>Percentual (%)</Label>
                <Input type="number" value={cfgPercentual} onChange={e => setCfgPercentual(e.target.value)} placeholder="5" step="0.1" />
              </div>
            )}
            <div>
              <Label>Regra de variação por desconto</Label>
              <Textarea value={cfgRegraDesconto} onChange={e => setCfgRegraDesconto(e.target.value)}
                placeholder="Ex: Desconto até 10% = bonificação cheia. Desconto 10-30% = bonificação -20%. Desconto >30% = bonificação -50%."
                rows={3} />
              <p className="text-xs text-muted-foreground mt-1">Descreva como a bonificação varia com os descontos nas ofertas/lances.</p>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <Label>Visibilidade para equipe</Label>
                <p className="text-xs text-muted-foreground">Outros membros poderão ver as bonificações deste colaborador</p>
              </div>
              <Switch checked={cfgVisibilidade} onCheckedChange={setCfgVisibilidade} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfigDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveConfig} disabled={saving || !cfgUserId} className="bg-accent hover:bg-accent/90 text-accent-foreground">
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lançamento Dialog */}
      <Dialog open={showLancDialog} onOpenChange={setShowLancDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Lançar Bonificação</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Colaborador *</Label>
              <Select value={lancUserId} onValueChange={setLancUserId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {configs.filter(c => c.ativo).map(c => (
                    <SelectItem key={c.user_id} value={c.user_id}>{getMembroNome(c.user_id)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>NF-e quitada *</Label>
              <Select
                value={lancPedidoId}
                onValueChange={(v) => {
                  setLancPedidoId(v);
                  const p = quitados.find((q) => q.id === v);
                  // O valor recebido é a base natural: foi ele que entrou.
                  if (p) { setLancValorBase(String(p.valor_total)); setLancNF(p.nota_fiscal ?? ''); }
                }}
                disabled={!lancUserId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={lancUserId ? 'Selecione a quitação' : 'Escolha o colaborador primeiro'} />
                </SelectTrigger>
                <SelectContent>
                  {quitadosDoColaborador.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nota_fiscal ? `NF ${p.nota_fiscal}` : `Pedido ${p.numero_pedido}`}
                      {p.data_quitacao ? ` · ${new Date(p.data_quitacao + 'T12:00:00').toLocaleDateString('pt-BR')}` : ''}
                      {` · ${fmt(p.valor_total)}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {lancUserId && quitadosDoColaborador.length === 0 && (
                <p className="text-xs text-warning mt-1">
                  Nenhuma NF-e quitada nos contratos deste colaborador. A bonificação só é
                  lançada depois que o cliente quita a nota.
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor Base (R$) *</Label>
                <MoneyInput value={Number(lancValorBase) || 0} onValueChange={v => setLancValorBase(String(v))} placeholder="R$ 0,00" />
              </div>
              <div>
                <Label>Desconto Oferta (%)</Label>
                <Input type="number" value={lancDesconto} onChange={e => setLancDesconto(e.target.value)} placeholder="0" />
              </div>
            </div>
            {lancUserId && lancValorBase && (
              <div className="bg-muted rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Bonificação calculada:</p>
                <p className="text-lg font-bold text-foreground">
                  {(() => {
                    const cfg = configs.find(c => c.user_id === lancUserId);
                    if (!cfg) return 'R$ 0,00';
                    const base = parseFloat(lancValorBase) || 0;
                    const desc = parseFloat(lancDesconto) || 0;
                    const val = !ehPercentual(cfg.tipo_comissao) ? cfg.valor_fixo : base * (1 - desc / 100) * (cfg.percentual / 100);
                    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                  })()}
                </p>
              </div>
            )}
            <div>
              <Label>Nota Fiscal</Label>
              <Input value={lancNF} onChange={e => setLancNF(e.target.value)} placeholder="Número da NF (opcional)" />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={lancObs} onChange={e => setLancObs(e.target.value)} placeholder="Detalhes do lançamento..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLancDialog(false)}>Cancelar</Button>
            <Button onClick={handleLancar} disabled={saving || !lancUserId || !lancValorBase || !lancPedidoId} className="bg-accent hover:bg-accent/90 text-accent-foreground">
              {saving ? 'Lançando...' : 'Lançar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
