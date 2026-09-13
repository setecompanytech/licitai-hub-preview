import { useState, useEffect } from 'react';
import { TIPOS_BONIFICACAO, EVENTOS_PAGAMENTO, ehPercentual, rotuloDoValor, eventoDaConfig, type EventoPagamento } from '@/lib/equipe/bonificacao';
import { nomeExibido } from '@/lib/equipe/nomeExibido';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { DollarSign, Plus, Settings, TrendingUp, Eye, EyeOff, Receipt } from 'lucide-react';

const TIPO_COMISSAO = TIPOS_BONIFICACAO as Record<string, { label: string; desc: string }>;

const STATUS_LANCAMENTO: Record<string, { label: string; variante: BadgeProps['variant'] }> = {
  pendente: { label: 'Pendente', variante: 'warning' },
  aprovado: { label: 'Aprovado', variante: 'info' },
  pago: { label: 'Pago', variante: 'success' },
  cancelado: { label: 'Cancelado', variante: 'danger' },
  rejeitado: { label: 'Rejeitado', variante: 'danger' },
};

type Config = {
  id: string;
  empresa_id: string;
  user_id: string;
  tipo_comissao: string;
  percentual: number;
  valor_fixo: number;
  evento_pagamento: string | null;
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

/**
 * Pedido que pode comprovar o marco de pagamento. Traz os dois fatos — nota
 * emitida e nota quitada — porque qual deles vale depende da política da
 * empresa, não do pedido.
 */
type PedidoElegivel = {
  id: string;
  numero_pedido: string;
  nota_fiscal: string | null;
  valor_total: number;
  data_quitacao: string | null;
  nf_quitada: boolean;
  data_assinatura: string | null;
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
  const [cfgEvento, setCfgEvento] = useState<EventoPagamento>('contrato_assinado');
  const [cfgPercentual, setCfgPercentual] = useState('');
  const [cfgValorFixo, setCfgValorFixo] = useState('');
  const [cfgVisibilidade, setCfgVisibilidade] = useState(false);

  /** Zera o formulário — nada do colaborador anterior sobra na próxima vez. */
  const limparConfig = () => {
    setCfgUserId('');
    setCfgTipo('percentual_contrato');
    setCfgEvento('contrato_assinado');
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
  const [pedidos, setPedidos] = useState<PedidoElegivel[]>([]);

  useEffect(() => { loadData(); }, [empresaId]);

  const loadData = async () => {
    setLoading(true);
    const [cfgRes, lancRes, membrosRes, quitRes] = await Promise.all([
      supabase.from('comissoes_config' as any).select('*').eq('empresa_id', empresaId),
      supabase.from('comissoes_lancamentos' as any).select('*').eq('empresa_id', empresaId).order('created_at', { ascending: false }),
      supabase.from('empresa_membros').select('user_id, nome, email, nome_individual, login_individual').eq('empresa_id', empresaId),
      // O lançamento manual aponta QUAL fato autoriza o pagamento. Quais
      // pedidos servem depende do marco configurado, então vêm todos e o
      // filtro acontece na tela.
      supabase
        .from('contrato_pedidos' as any)
        .select('id, numero_pedido, nota_fiscal, valor_total, data_quitacao, nf_quitada, contratos!inner(empresa_id, vendedor_user_id, orgao_contratante, data_assinatura)')
        .eq('contratos.empresa_id', empresaId)
        .order('data_pedido', { ascending: false }),
    ]);
    setConfigs((cfgRes.data as any[]) || []);
    setLancamentos((lancRes.data as any[]) || []);
    setMembros((membrosRes.data as any[]) || []);
    setPedidos(((quitRes.data as any[]) || []).map((p) => ({
      id: p.id,
      numero_pedido: p.numero_pedido,
      nota_fiscal: p.nota_fiscal,
      valor_total: Number(p.valor_total) || 0,
      data_quitacao: p.data_quitacao,
      nf_quitada: !!p.nf_quitada,
      data_assinatura: p.contratos?.data_assinatura ?? null,
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
      evento_pagamento: cfgEvento,
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

  /** O pedido comprova o marco que a empresa escolheu para aquele colaborador. */
  const comprova = (p: PedidoElegivel, evento: EventoPagamento) =>
    evento === 'nf_quitada' ? p.nf_quitada
      : evento === 'nota_emitida' ? !!p.nota_fiscal
      : !!p.data_assinatura;

  const eventoDe = (userId: string): EventoPagamento =>
    eventoDaConfig(configs.find((c) => c.user_id === userId));

  // Lançamento sem vínculo não tem como comprovar marco nenhum — inclusive os
  // antigos, feitos quando nada era exigido.
  const podePagar = (l: Lancamento) => {
    const p = pedidos.find((q) => q.id === l.contrato_pedido_id);
    return !!p && comprova(p, eventoDe(l.user_id));
  };

  // Só os pedidos dos contratos do próprio colaborador: bonificar alguém pela
  // nota que outro vendeu seria o mesmo erro de carteira compartilhada.
  const pedidosDoColaborador = pedidos.filter(
    (q) => q.vendedor_user_id === lancUserId && comprova(q, eventoDe(lancUserId)),
  );

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

  if (loading) return <p className="py-6 text-center text-base text-muted-foreground">Carregando bonificações...</p>;

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(['resumo', 'lancamentos', 'config'] as const).map(t => (
            <Button key={t} variant={tab === t ? 'default' : 'outline'} size="sm" onClick={() => setTab(t)} aria-pressed={tab === t}>
              {t === 'resumo' ? 'Resumo' : t === 'lancamentos' ? 'Lançamentos' : 'Configurar'}
            </Button>
          ))}
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setShowConfigDialog(true)}>
              <Settings aria-hidden="true" /> Configurar
            </Button>
            <Button onClick={() => setShowLancDialog(true)}>
              <Plus aria-hidden="true" /> Lançar bonificação
            </Button>
          </div>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">Pendente</p>
          <p className="text-[2rem] font-bold leading-10 tabular-nums text-warning-ink">{fmt(lancamentos.filter(l => l.status === 'pendente').reduce((s, l) => s + l.valor_comissao, 0))}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">Aprovado</p>
          <p className="text-[2rem] font-bold leading-10 tabular-nums text-foreground">{fmt(lancamentos.filter(l => l.status === 'aprovado').reduce((s, l) => s + l.valor_comissao, 0))}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">Pago</p>
          <p className="text-[2rem] font-bold leading-10 tabular-nums text-success-ink">{fmt(lancamentos.filter(l => l.status === 'pago').reduce((s, l) => s + l.valor_comissao, 0))}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">Colaboradores</p>
          <p className="text-[2rem] font-bold leading-10 tabular-nums text-foreground">{configs.length}</p>
        </div>
      </div>

      {/* Resumo Tab */}
      {tab === 'resumo' && (
        <div className="space-y-2">
          {resumoPorColaborador.length === 0 ? (
            <section className="rounded-lg border border-border bg-card shadow-sm">
              <EstadoVazio
                icone={<DollarSign />}
                titulo="Nenhuma bonificação configurada"
                descricao="Configure os colaboradores bonificados para acompanhar os valores por pessoa."
                acao={isAdmin ? (
                  <Button variant="outline" onClick={() => setShowConfigDialog(true)}>
                    <Settings aria-hidden="true" /> Configurar
                  </Button>
                ) : undefined}
              />
            </section>
          ) : resumoPorColaborador.map(r => (
            <div key={r.user_id} className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base font-semibold text-foreground">{r.exibicao}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {r.cfg && <Badge variant="muted">{TIPO_COMISSAO[r.cfg.tipo_comissao]?.label}</Badge>}
                    {r.cfg && <span className="text-sm text-muted-foreground">
                      {rotuloDoValor(r.cfg.tipo_comissao, r.cfg.percentual, r.cfg.valor_fixo, fmt)}
                    </span>}
                    {r.cfg?.visibilidade_publica
                      ? <Badge variant="muted" className="gap-1"><Eye className="h-3 w-3" aria-hidden="true" />Visível p/ equipe</Badge>
                      : <Badge variant="muted" className="gap-1"><EyeOff className="h-3 w-3" aria-hidden="true" />Somente admin</Badge>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total bonificações</p>
                  <p className="text-lg font-bold tabular-nums text-foreground">{fmt(r.total)}</p>
                  <div className="mt-0.5 flex flex-wrap justify-end gap-2 text-xs tabular-nums">
                    <span className="text-warning-ink">Pendente: {fmt(r.totalPendente)}</span>
                    <span className="text-success-ink">Pago: {fmt(r.totalPago)}</span>
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
            <section className="rounded-lg border border-border bg-card shadow-sm">
              <EstadoVazio
                icone={<Receipt />}
                titulo="Nenhum lançamento registrado"
                descricao="Os lançamentos de bonificação aparecem aqui assim que forem criados."
                acao={isAdmin ? (
                  <Button onClick={() => setShowLancDialog(true)}>
                    <Plus aria-hidden="true" /> Lançar bonificação
                  </Button>
                ) : undefined}
              />
            </section>
          ) : lancamentos.map(l => {
            const st = STATUS_LANCAMENTO[l.status] || STATUS_LANCAMENTO.pendente;
            return (
              <div key={l.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 shadow-sm">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-semibold text-foreground">{getMembroNome(l.user_id)}</span>
                    <Badge variant={st.variante}>{st.label}</Badge>
                    {l.nota_fiscal && <Badge variant="muted">NF: {l.nota_fiscal}</Badge>}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-3 text-sm tabular-nums text-muted-foreground">
                    <span>Base: {fmt(l.valor_base)}</span>
                    {l.desconto_percentual > 0 && <span>Desc: {l.desconto_percentual}%</span>}
                    <span>{l.percentual_comissao}%</span>
                    <span>{new Date(l.created_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                  {l.observacoes && <p className="mt-0.5 text-sm text-muted-foreground">{l.observacoes}</p>}
                  {l.status !== 'pago' && !podePagar(l) && (
                    <p className="mt-0.5 text-sm text-warning-ink">
                      Aguardando {EVENTOS_PAGAMENTO[eventoDe(l.user_id)].exigencia} — pagamento
                      liberado {EVENTOS_PAGAMENTO[eventoDe(l.user_id)].label.toLowerCase()}.
                    </p>
                  )}
                </div>
                <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                  <span className="text-right font-bold tabular-nums text-foreground">{fmt(l.valor_comissao)}</span>
                  {isAdmin && l.status !== 'pago' && (
                    <Select value={l.status} onValueChange={v => handleUpdateLancStatus(l.id, v)}>
                      <SelectTrigger className="h-9 w-[140px] text-sm" aria-label={`Status do lançamento de ${getMembroNome(l.user_id)}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_LANCAMENTO).map(([k, v]) => (
                          <SelectItem key={k} value={k} disabled={k === 'pago' && !podePagar(l)}>
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
            <section className="rounded-lg border border-border bg-card shadow-sm">
              <EstadoVazio
                icone={<Settings />}
                titulo="Nenhum colaborador configurado"
                descricao='Clique em "Configurar" para definir as regras de bonificação.'
                acao={
                  <Button variant="outline" onClick={() => setShowConfigDialog(true)}>
                    <Settings aria-hidden="true" /> Configurar
                  </Button>
                }
              />
            </section>
          ) : configs.map(c => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="min-w-0">
                <p className="text-base font-semibold text-foreground">{getMembroNome(c.user_id)}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span>{TIPO_COMISSAO[c.tipo_comissao]?.label}</span>
                  <span aria-hidden="true">•</span>
                  <span>{rotuloDoValor(c.tipo_comissao, c.percentual, c.valor_fixo, fmt)}</span>
                  <span aria-hidden="true">•</span>
                  <span>{EVENTOS_PAGAMENTO[eventoDaConfig(c)].label}</span>
                  <span aria-hidden="true">•</span>
                  <span>{c.visibilidade_publica ? 'Visível p/ equipe' : 'Somente admin'}</span>
                </div>
              </div>
              <Badge variant={c.ativo ? 'success' : 'muted'}>
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
          <DialogHeader><DialogTitle>Configurar bonificação</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="cfg-colaborador">Colaborador *</Label>
              <Select value={cfgUserId} onValueChange={v => {
                setCfgUserId(v);
                const existing = configs.find(c => c.user_id === v);
                if (existing) {
                  setCfgTipo(existing.tipo_comissao);
                  setCfgEvento(eventoDaConfig(existing));
                  setCfgPercentual(String(existing.percentual));
                  setCfgValorFixo(String(existing.valor_fixo));
                  setCfgVisibilidade(existing.visibilidade_publica);
                } else {
                  // Colaborador ainda sem configuração: volta ao padrão. Antes,
                  // os campos do colaborador anterior permaneciam — e a
                  // visibilidade ligada uma vez contaminava todos os seguintes,
                  // expondo o valor da bonificação de quem nunca foi marcado.
                  setCfgTipo('percentual_contrato');
                  setCfgEvento('contrato_assinado');
                  setCfgPercentual('');
                  setCfgValorFixo('');
                  setCfgRegraDesconto('');
                  setCfgVisibilidade(false);
                }
              }}>
                <SelectTrigger id="cfg-colaborador" className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {membros.map(m => (
                    <SelectItem key={m.user_id} value={m.user_id}>{nomeExibido(m)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="cfg-tipo">Tipo de bonificação</Label>
              <Select value={cfgTipo} onValueChange={setCfgTipo}>
                <SelectTrigger id="cfg-tipo" className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_COMISSAO).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">{TIPO_COMISSAO[cfgTipo]?.desc}</p>
            </div>
            <div>
              <Label htmlFor="cfg-evento">Quando pagar</Label>
              <Select value={cfgEvento} onValueChange={(v) => setCfgEvento(v as EventoPagamento)}>
                <SelectTrigger id="cfg-evento" className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(EVENTOS_PAGAMENTO).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">{EVENTOS_PAGAMENTO[cfgEvento].desc}</p>
            </div>
            {cfgTipo === 'valor_fixo' ? (
              <div>
                <Label htmlFor="cfg-valor-fixo">Valor fixo (R$)</Label>
                <MoneyInput id="cfg-valor-fixo" value={Number(cfgValorFixo) || 0} onValueChange={v => setCfgValorFixo(String(v))} placeholder="R$ 0,00" className="mt-1" />
              </div>
            ) : (
              <div>
                <Label htmlFor="cfg-percentual">Percentual (%)</Label>
                <Input id="cfg-percentual" type="number" value={cfgPercentual} onChange={e => setCfgPercentual(e.target.value)} placeholder="5" step="0.1" className="mt-1" />
              </div>
            )}
            <div>
              <Label htmlFor="cfg-regra">Regra de variação por desconto</Label>
              <Textarea id="cfg-regra" value={cfgRegraDesconto} onChange={e => setCfgRegraDesconto(e.target.value)}
                placeholder="Ex: Desconto até 10% = bonificação cheia. Desconto 10-30% = bonificação -20%. Desconto >30% = bonificação -50%."
                rows={3} className="mt-1" />
              <p className="mt-1 text-xs text-muted-foreground">Descreva como a bonificação varia com os descontos nas ofertas/lances.</p>
            </div>
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
              <div>
                <Label htmlFor="cfg-visibilidade">Visibilidade para equipe</Label>
                <p className="text-xs text-muted-foreground">Outros membros poderão ver as bonificações deste colaborador</p>
              </div>
              <Switch id="cfg-visibilidade" checked={cfgVisibilidade} onCheckedChange={setCfgVisibilidade} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfigDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveConfig} disabled={saving || !cfgUserId}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lançamento Dialog */}
      <Dialog open={showLancDialog} onOpenChange={setShowLancDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Lançar bonificação</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="lanc-colaborador">Colaborador *</Label>
              <Select value={lancUserId} onValueChange={setLancUserId}>
                <SelectTrigger id="lanc-colaborador" className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {configs.filter(c => c.ativo).map(c => (
                    <SelectItem key={c.user_id} value={c.user_id}>{getMembroNome(c.user_id)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="lanc-pedido">{lancUserId ? EVENTOS_PAGAMENTO[eventoDe(lancUserId)].exigencia : 'Comprovação'} *</Label>
              <Select
                value={lancPedidoId}
                onValueChange={(v) => {
                  setLancPedidoId(v);
                  const p = pedidos.find((q) => q.id === v);
                  // O valor do pedido é a base natural do lançamento.
                  if (p) { setLancValorBase(String(p.valor_total)); setLancNF(p.nota_fiscal ?? ''); }
                }}
                disabled={!lancUserId}
              >
                <SelectTrigger id="lanc-pedido" className="mt-1">
                  <SelectValue placeholder={lancUserId ? 'Selecione o pedido' : 'Escolha o colaborador primeiro'} />
                </SelectTrigger>
                <SelectContent>
                  {pedidosDoColaborador.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nota_fiscal ? `NF ${p.nota_fiscal}` : `Pedido ${p.numero_pedido}`}
                      {p.data_quitacao ? ` · ${new Date(p.data_quitacao + 'T12:00:00').toLocaleDateString('pt-BR')}` : ''}
                      {` · ${fmt(p.valor_total)}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {lancUserId && pedidosDoColaborador.length === 0 && (
                <p className="mt-1 text-sm text-warning-ink">
                  Nenhum pedido com {EVENTOS_PAGAMENTO[eventoDe(lancUserId)].exigencia} nos
                  contratos deste colaborador. A bonificação dele é liberada
                  {' '}{EVENTOS_PAGAMENTO[eventoDe(lancUserId)].label.toLowerCase()}.
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="lanc-base">Valor base (R$) *</Label>
                <MoneyInput id="lanc-base" value={Number(lancValorBase) || 0} onValueChange={v => setLancValorBase(String(v))} placeholder="R$ 0,00" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="lanc-desconto">Desconto oferta (%)</Label>
                <Input id="lanc-desconto" type="number" value={lancDesconto} onChange={e => setLancDesconto(e.target.value)} placeholder="0" className="mt-1" />
              </div>
            </div>
            {lancUserId && lancValorBase && (
              <div className="rounded-lg border border-border bg-muted p-4">
                <p className="text-sm text-muted-foreground">Bonificação calculada:</p>
                <p className="text-[2rem] font-bold leading-10 tabular-nums text-foreground">
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
              <Label htmlFor="lanc-nf">Nota fiscal</Label>
              <Input id="lanc-nf" value={lancNF} onChange={e => setLancNF(e.target.value)} placeholder="Número da NF (opcional)" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="lanc-obs">Observações</Label>
              <Textarea id="lanc-obs" value={lancObs} onChange={e => setLancObs(e.target.value)} placeholder="Detalhes do lançamento..." rows={2} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLancDialog(false)}>Cancelar</Button>
            <Button onClick={handleLancar} disabled={saving || !lancUserId || !lancValorBase || !lancPedidoId}>
              {saving ? 'Lançando...' : 'Lançar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
