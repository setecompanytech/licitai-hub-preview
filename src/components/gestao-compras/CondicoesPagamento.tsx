import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';
import { AlertCircle, Loader2, Pencil, Plus, Search, Sparkles } from 'lucide-react';

export type CondicaoPagamento = {
  id: string;
  codigo: number;
  descricao: string;
  tipo: 'a_vista' | 'a_prazo' | 'parcelado';
  forma_pagamento: string | null;
  vencimento_sabado: string;
  vencimento_domingo: string;
  parcelas: Array<{ dias: number; percentual: number }>;
  dia_vencimento: number | null;
  juro_diario: number;
  percentual_acrescimo: number;
  ativo: boolean;
};

const FORMAS_PAGAMENTO = ['Boleto', 'PIX', 'Transferência (TED)', 'Dinheiro', 'Cartão de Crédito', 'Cartão de Débito', 'Cheque', 'Empenho / Ordem Bancária'];
const REGRAS_FDS = [
  { value: 'prorroga', label: 'Prorroga' },
  { value: 'antecipa', label: 'Antecipa' },
  { value: 'mantem', label: 'Mantém' },
];

/** Condições que o botão "Criar padrão" semeia numa empresa vazia. */
const SEMENTES: Array<Pick<CondicaoPagamento, 'descricao' | 'tipo' | 'forma_pagamento' | 'parcelas'>> = [
  { descricao: 'A VISTA', tipo: 'a_vista', forma_pagamento: 'PIX', parcelas: [{ dias: 0, percentual: 100 }] },
  { descricao: 'BOLETO 7 DIAS', tipo: 'a_prazo', forma_pagamento: 'Boleto', parcelas: [{ dias: 7, percentual: 100 }] },
  { descricao: 'BOLETO 15 DIAS', tipo: 'a_prazo', forma_pagamento: 'Boleto', parcelas: [{ dias: 15, percentual: 100 }] },
  { descricao: 'BOLETO 30 DIAS', tipo: 'a_prazo', forma_pagamento: 'Boleto', parcelas: [{ dias: 30, percentual: 100 }] },
  { descricao: 'BOLETO 30/60', tipo: 'parcelado', forma_pagamento: 'Boleto', parcelas: [{ dias: 30, percentual: 50 }, { dias: 60, percentual: 50 }] },
  { descricao: 'BOLETO 30/60/90', tipo: 'parcelado', forma_pagamento: 'Boleto', parcelas: [{ dias: 30, percentual: 33.33 }, { dias: 60, percentual: 33.33 }, { dias: 90, percentual: 33.34 }] },
  { descricao: 'EMPENHO 30 DIAS', tipo: 'a_prazo', forma_pagamento: 'Empenho / Ordem Bancária', parcelas: [{ dias: 30, percentual: 100 }] },
];

const formVazio = () => ({
  id: '' as string | '',
  descricao: '',
  tipo: 'a_vista' as CondicaoPagamento['tipo'],
  forma_pagamento: '',
  vencimento_sabado: 'prorroga',
  vencimento_domingo: 'prorroga',
  parcelas: [{ dias: 0, percentual: 100 }] as Array<{ dias: number; percentual: number }>,
  dia_vencimento: '' as string,
  juro_diario: '0',
  percentual_acrescimo: '0,00',
});

const numBr = (s: string) => parseFloat(String(s).replace(/\./g, '').replace(',', '.')) || 0;

/**
 * Cadastro das Condições de Pagamento — o modelo clássico dos ERPs (09/09):
 * código, descrição, tipo, forma, regra de fim de semana, parcelas cujos
 * percentuais DEVEM fechar 100% (a tela avisa em vermelho; o banco tem a
 * CONSTRAINT), juro diário e acréscimo. O seletor do pedido bebe daqui.
 */
export default function CondicoesPagamento({
  aberto,
  aoFechar,
  aoMudar,
}: {
  aberto: boolean;
  aoFechar: () => void;
  aoMudar?: () => void;
}) {
  const { empresaAtiva } = useEmpresa();
  const [linhas, setLinhas] = useState<CondicaoPagamento[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState('');
  const [form, setForm] = useState(formVazio());
  const [editando, setEditando] = useState(false);

  const carregar = async () => {
    if (!empresaAtiva?.id) return;
    setCarregando(true);
    const { data } = await (supabase.from('financeiro_condicoes_pagamento' as never) as any)
      .select('*')
      .eq('empresa_id', empresaAtiva.id)
      .order('codigo');
    setLinhas(((data as unknown as CondicaoPagamento[]) || []).map(l => ({
      ...l,
      parcelas: Array.isArray(l.parcelas) ? l.parcelas : [{ dias: 0, percentual: 100 }],
    })));
    setCarregando(false);
  };

  useEffect(() => {
    if (aberto) { carregar(); setEditando(false); setForm(formVazio()); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, empresaAtiva?.id]);

  const totalPercentual = useMemo(
    () => form.parcelas.reduce((s, p) => s + (Number(p.percentual) || 0), 0),
    [form.parcelas],
  );
  const fecha100 = Math.abs(totalPercentual - 100) <= 0.01;

  const ajustarParcelas = (tipo: CondicaoPagamento['tipo'], n: number, primeiroDias: number, intervalo: number) => {
    if (tipo === 'a_vista') return [{ dias: 0, percentual: 100 }];
    if (tipo === 'a_prazo') return [{ dias: primeiroDias || 30, percentual: 100 }];
    const qtd = Math.max(2, n);
    const base = Math.floor(10000 / qtd) / 100;
    return Array.from({ length: qtd }, (_, i) => ({
      dias: (primeiroDias || 30) + i * (intervalo || 30),
      // A última parcela carrega a sobra — soma fecha 100 sempre.
      percentual: i === qtd - 1 ? Math.round((100 - base * (qtd - 1)) * 100) / 100 : base,
    }));
  };

  const abrirEdicao = (c: CondicaoPagamento) => {
    setForm({
      id: c.id,
      descricao: c.descricao,
      tipo: c.tipo,
      forma_pagamento: c.forma_pagamento || '',
      vencimento_sabado: c.vencimento_sabado,
      vencimento_domingo: c.vencimento_domingo,
      parcelas: c.parcelas,
      dia_vencimento: c.dia_vencimento ? String(c.dia_vencimento) : '',
      juro_diario: String(c.juro_diario ?? 0).replace('.', ','),
      percentual_acrescimo: String(c.percentual_acrescimo ?? 0).replace('.', ','),
    });
    setEditando(true);
  };

  const salvar = async () => {
    if (!empresaAtiva?.id) return;
    if (!form.descricao.trim()) { toast.error('Informe a descrição.'); return; }
    if (!fecha100) { toast.error('Condição de Pagamento incompleta — os percentuais das parcelas não atingiram 100%.'); return; }
    setSalvando(true);
    const payload = {
      empresa_id: empresaAtiva.id,
      descricao: form.descricao.trim().toUpperCase(),
      tipo: form.tipo,
      forma_pagamento: form.forma_pagamento || null,
      vencimento_sabado: form.vencimento_sabado,
      vencimento_domingo: form.vencimento_domingo,
      parcelas: form.parcelas.map(p => ({ dias: Number(p.dias) || 0, percentual: Number(p.percentual) || 0 })),
      dia_vencimento: form.dia_vencimento ? Math.min(31, Math.max(1, parseInt(form.dia_vencimento) || 0)) || null : null,
      juro_diario: numBr(form.juro_diario),
      percentual_acrescimo: numBr(form.percentual_acrescimo),
      updated_at: new Date().toISOString(),
    };
    let error;
    if (form.id) {
      ({ error } = await (supabase.from('financeiro_condicoes_pagamento' as never) as any)
        .update(payload).eq('id', form.id));
    } else {
      const codigo = (linhas.reduce((m, l) => Math.max(m, l.codigo), 0) || 0) + 1;
      ({ error } = await (supabase.from('financeiro_condicoes_pagamento' as never) as any)
        .insert({ ...payload, codigo }));
    }
    setSalvando(false);
    if (error) { toast.error('Não foi possível salvar', { description: error.message }); return; }
    toast.success(form.id ? 'Condição atualizada.' : 'Condição cadastrada.');
    setEditando(false);
    setForm(formVazio());
    carregar();
    aoMudar?.();
  };

  const criarPadrao = async () => {
    if (!empresaAtiva?.id) return;
    setSalvando(true);
    const base = linhas.reduce((m, l) => Math.max(m, l.codigo), 0);
    const jaTem = new Set(linhas.map(l => l.descricao));
    const inserts = SEMENTES.filter(s => !jaTem.has(s.descricao)).map((s, i) => ({
      empresa_id: empresaAtiva.id,
      codigo: base + i + 1,
      descricao: s.descricao,
      tipo: s.tipo,
      forma_pagamento: s.forma_pagamento,
      parcelas: s.parcelas,
    }));
    if (inserts.length === 0) { toast.info('As condições padrão já existem.'); setSalvando(false); return; }
    const { error } = await (supabase.from('financeiro_condicoes_pagamento' as never) as any).insert(inserts);
    setSalvando(false);
    if (error) { toast.error('Não foi possível criar as condições padrão', { description: error.message }); return; }
    toast.success(`${inserts.length} condição(ões) padrão criada(s) — edite ou complemente à vontade.`);
    carregar();
    aoMudar?.();
  };

  const filtradas = linhas.filter(l => !busca.trim() || l.descricao.toLowerCase().includes(busca.toLowerCase()));

  return (
    <Dialog open={aberto} onOpenChange={v => !v && aoFechar()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cadastro das Condições de Pagamento</DialogTitle>
        </DialogHeader>

        {!editando ? (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row flex-wrap gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Label htmlFor="busca-condicao" className="sr-only">Pesquisar condição</Label>
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input id="busca-condicao" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Pesquisar por descrição…" className="pl-9" />
              </div>
              <Button onClick={() => { setForm(formVazio()); setEditando(true); }}>
                <Plus className="w-4 h-4" /> Cadastrar
              </Button>
              {linhas.length === 0 && (
                <Button variant="outline" onClick={criarPadrao} disabled={salvando}>
                  <Sparkles className="w-4 h-4" /> Criar condições padrão
                </Button>
              )}
            </div>

            <div className="rounded-md border border-border overflow-x-auto">
              {carregando ? (
                <div role="status" aria-busy="true" className="space-y-2 p-4">
                  <span className="sr-only">Carregando</span>
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                </div>
              ) : filtradas.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">
                  Nenhuma condição cadastrada — use "Criar condições padrão" ou "Cadastrar".
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Código</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Forma</TableHead>
                      <TableHead>Parcelas</TableHead>
                      <TableHead className="text-right">Total %</TableHead>
                      <TableHead className="w-10"><span className="sr-only">Editar</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtradas.map(l => {
                      const total = l.parcelas.reduce((s, p) => s + (Number(p.percentual) || 0), 0);
                      const ok = Math.abs(total - 100) <= 0.01;
                      return (
                        <TableRow key={l.id} className="cursor-pointer" onClick={() => abrirEdicao(l)}>
                          <TableCell className="text-sm tabular-nums">{l.codigo}</TableCell>
                          <TableCell className="text-sm font-medium">{l.descricao}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{l.forma_pagamento || '—'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {l.parcelas.map(p => `${p.dias}d`).join(' / ')}
                          </TableCell>
                          <TableCell className={`text-sm text-right tabular-nums ${ok ? '' : 'text-destructive font-semibold'}`}>
                            {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell><Pencil className="w-4 h-4 text-muted-foreground" aria-hidden="true" /></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
            {filtradas.some(l => Math.abs(l.parcelas.reduce((s, p) => s + (Number(p.percentual) || 0), 0) - 100) > 0.01) && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="w-4 h-4" aria-hidden="true" /> Condição de Pagamento incompleta — não atingiu 100%.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label htmlFor="cond-descricao">Descrição *</Label>
                <Input id="cond-descricao" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  placeholder="Ex.: BOLETO 30 DIAS" className="mt-1" />
              </div>
              <div>
                <Label>Condição pagamento</Label>
                <Select value={form.tipo} onValueChange={(v: CondicaoPagamento['tipo']) =>
                  setForm(f => ({ ...f, tipo: v, parcelas: ajustarParcelas(v, f.parcelas.length, f.parcelas[0]?.dias ?? 30, 30) }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a_vista">À Vista</SelectItem>
                    <SelectItem value="a_prazo">A Prazo</SelectItem>
                    <SelectItem value="parcelado">Parcelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Forma de pagamento</Label>
                <Select value={form.forma_pagamento || undefined} onValueChange={v => setForm(f => ({ ...f, forma_pagamento: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecionar…" /></SelectTrigger>
                  <SelectContent>
                    {FORMAS_PAGAMENTO.map(fp => <SelectItem key={fp} value={fp}>{fp}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Vencimento sábado</Label>
                <Select value={form.vencimento_sabado} onValueChange={v => setForm(f => ({ ...f, vencimento_sabado: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{REGRAS_FDS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Vencimento domingo</Label>
                <Select value={form.vencimento_domingo} onValueChange={v => setForm(f => ({ ...f, vencimento_domingo: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{REGRAS_FDS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {form.tipo === 'parcelado' && (
                <div>
                  <Label htmlFor="cond-num-parcelas">Número parcelas</Label>
                  <Input id="cond-num-parcelas" type="number" min={2} max={60} value={form.parcelas.length}
                    onChange={e => setForm(f => ({ ...f, parcelas: ajustarParcelas('parcelado', parseInt(e.target.value) || 2, f.parcelas[0]?.dias ?? 30, 30) }))}
                    className="mt-1" />
                </div>
              )}
              <div>
                <Label htmlFor="cond-dia-venc">Dia de vencimento <span className="font-normal text-muted-foreground">(opcional — grampeia no dia fixo)</span></Label>
                <Input id="cond-dia-venc" type="number" min={1} max={31} value={form.dia_vencimento}
                  onChange={e => setForm(f => ({ ...f, dia_vencimento: e.target.value }))} className="mt-1" placeholder="—" />
              </div>
              <div>
                <Label htmlFor="cond-juro">Juro diário (%)</Label>
                <Input id="cond-juro" value={form.juro_diario} onChange={e => setForm(f => ({ ...f, juro_diario: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="cond-acrescimo">Percentual de acréscimo (%)</Label>
                <Input id="cond-acrescimo" value={form.percentual_acrescimo} onChange={e => setForm(f => ({ ...f, percentual_acrescimo: e.target.value }))} className="mt-1" />
              </div>
            </div>

            {/* Parcelas — dias e percentuais editáveis; a soma tem de fechar 100 */}
            <div className="rounded-md border border-border p-4 space-y-3">
              <p className="text-sm font-semibold">Parcelas (dias × percentual)</p>
              {form.parcelas.map((p, i) => (
                <div key={i} className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor={`parcela-dias-${i}`} className="text-xs text-muted-foreground">Parcela {i + 1} — dias</Label>
                    <Input id={`parcela-dias-${i}`} type="number" min={0} value={p.dias}
                      onChange={e => setForm(f => ({ ...f, parcelas: f.parcelas.map((x, j) => j === i ? { ...x, dias: parseInt(e.target.value) || 0 } : x) }))}
                      className="mt-1 tabular-nums" />
                  </div>
                  <div>
                    <Label htmlFor={`parcela-pct-${i}`} className="text-xs text-muted-foreground">Percentual (%)</Label>
                    <Input id={`parcela-pct-${i}`} type="number" min={0} max={100} step="0.01" value={p.percentual}
                      onChange={e => setForm(f => ({ ...f, parcelas: f.parcelas.map((x, j) => j === i ? { ...x, percentual: parseFloat(e.target.value) || 0 } : x) }))}
                      className="mt-1 tabular-nums" />
                  </div>
                </div>
              ))}
              <p className={`text-sm tabular-nums ${fecha100 ? 'text-muted-foreground' : 'text-destructive font-semibold'}`}>
                Total do percentual: {totalPercentual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}%
                {!fecha100 && ' — Condição de Pagamento incompleta, não atingiu 100%'}
              </p>
            </div>

            <div className="flex flex-wrap justify-between gap-2">
              <Button variant="outline" onClick={() => { setEditando(false); setForm(formVazio()); }}>← Voltar à lista</Button>
              <Button onClick={salvar} disabled={salvando || !fecha100}>
                {salvando && <Loader2 className="w-4 h-4 animate-spin" />} Salvar
              </Button>
            </div>
          </div>
        )}

        {!editando && linhas.length > 0 && (
          <div className="flex justify-end">
            <Button variant="outline" onClick={criarPadrao} disabled={salvando}>
              <Sparkles className="w-4 h-4" /> Completar com condições padrão
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
