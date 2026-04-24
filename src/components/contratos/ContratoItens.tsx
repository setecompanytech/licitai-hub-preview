import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMembroPermissoes } from '@/hooks/useMembroPermissoes';
import { toast } from 'sonner';
import {
  Plus, Trash2, Loader2, Package, Copy, Download, Link2
} from 'lucide-react';

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

type ContratoItem = {
  id: string; contrato_id: string; descricao: string; unidade: string;
  quantidade_contratada: number; valor_unitario: number; valor_total: number;
  quantidade_consumida: number; saldo_quantitativo: number; saldo_financeiro: number;
  codigo_item: string | null; observacoes: string | null; origem_aditivo_id: string | null;
  ata_item_id: string | null; quantidade_ata_consumida: number | null;
  custo_unitario?: number | null; custo_total?: number | null;
  numero_lote?: string | null; descricao_lote?: string | null;
};

type Aditivo = { id: string; numero_aditivo: string; tipo: string; };

type ContratoMeta = {
  tipo_documento: 'contrato' | 'ata_srp' | string;
  ata_srp_id: string | null;
  tipo_estrutura?: 'itens' | 'lotes' | string | null;
};

export default function ContratoItens({ contratoId }: { contratoId: string }) {
  const { user } = useAuth();
  const { isFinanceiro, isAdmin } = useMembroPermissoes();
  const podeVerCustos = isFinanceiro || isAdmin;
  const [meta, setMeta] = useState<ContratoMeta | null>(null);
  const [itens, setItens] = useState<ContratoItem[]>([]);
  const [ataItens, setAtaItens] = useState<ContratoItem[]>([]);
  const [aditivos, setAditivos] = useState<Aditivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    descricao: '', unidade: 'UN', quantidade_contratada: '',
    valor_unitario: '', custo_unitario: '', codigo_item: '', observacoes: '', origem_aditivo_id: '',
    ata_item_id: '',
  });

  const isContratoComATA = meta?.tipo_documento === 'contrato' && !!meta?.ata_srp_id;

  const loadData = async () => {
    setLoading(true);
    const metaRes = await supabase.from('contratos').select('tipo_documento, ata_srp_id, tipo_estrutura').eq('id', contratoId).maybeSingle();
    const m = metaRes.data as ContratoMeta | null;
    setMeta(m);

    const [itensRes, aditivosRes] = await Promise.all([
      supabase.from('contrato_itens').select('*').eq('contrato_id', contratoId).order('created_at', { ascending: true }),
      supabase.from('contrato_aditivos').select('id, numero_aditivo, tipo').eq('contrato_id', contratoId).order('created_at', { ascending: true }),
    ]);
    setItens((itensRes.data as any[]) || []);
    setAditivos((aditivosRes.data as any[]) || []);

    if (m?.tipo_documento === 'contrato' && m.ata_srp_id) {
      const ataItensRes = await supabase.from('contrato_itens').select('*').eq('contrato_id', m.ata_srp_id).order('created_at', { ascending: true });
      setAtaItens((ataItensRes.data as any[]) || []);
    } else {
      setAtaItens([]);
    }

    setLoading(false);
  };

  useEffect(() => { loadData(); }, [contratoId]);

  const getOrigemLabel = (aditivoId: string | null) => {
    if (!aditivoId) return meta?.tipo_documento === 'ata_srp' ? 'ATA SRP' : 'Contrato Original';
    const ad = aditivos.find(a => a.id === aditivoId);
    return ad ? `Aditivo ${ad.numero_aditivo}` : 'Aditivo';
  };

  const ataItemLabel = (id: string | null) => {
    if (!id) return null;
    const it = ataItens.find(a => a.id === id);
    if (!it) return 'Item da ATA';
    return `${it.codigo_item || '—'} · ${it.descricao.slice(0, 40)}${it.descricao.length > 40 ? '…' : ''}`;
  };

  const onSelectAtaItem = (ataItemId: string) => {
    const it = ataItens.find(a => a.id === ataItemId);
    if (!it) {
      setForm(f => ({ ...f, ata_item_id: '' }));
      return;
    }
    const saldo = Math.max((it.quantidade_contratada || 0) - (it.quantidade_ata_consumida || 0), 0);
    setForm(f => ({
      ...f,
      ata_item_id: ataItemId,
      descricao: it.descricao,
      unidade: it.unidade,
      codigo_item: it.codigo_item || '',
      valor_unitario: String(it.valor_unitario),
      quantidade_contratada: f.quantidade_contratada || String(saldo || ''),
    }));
  };

  const handleSave = async () => {
    if (isContratoComATA && !form.ata_item_id) {
      toast.error('Selecione o item da ATA de origem');
      return;
    }
    if (!form.descricao) { toast.error('Informe a descrição do item'); return; }

    const qty = parseFloat(form.quantidade_contratada) || 0;
    const unit = parseFloat(form.valor_unitario) || 0;
    const total = qty * unit;

    // valida saldo da ATA
    if (form.ata_item_id) {
      const ataItem = ataItens.find(a => a.id === form.ata_item_id);
      if (ataItem) {
        const saldoDisp = Math.max((ataItem.quantidade_contratada || 0) - (ataItem.quantidade_ata_consumida || 0), 0);
        if (qty > saldoDisp) {
          toast.error(`Quantidade excede saldo da ATA (disponível: ${saldoDisp})`);
          return;
        }
      }
    }

    const custoUnit = parseFloat(form.custo_unitario) || 0;
    const custoTotal = qty * custoUnit;

    setSaving(true);
    const { error } = await supabase.from('contrato_itens').insert({
      contrato_id: contratoId,
      user_id: user!.id,
      descricao: form.descricao,
      unidade: form.unidade,
      quantidade_contratada: qty,
      valor_unitario: unit,
      valor_total: total,
      custo_unitario: custoUnit || null,
      custo_total: custoTotal || null,
      saldo_quantitativo: qty,
      saldo_financeiro: total,
      codigo_item: form.codigo_item || null,
      observacoes: form.observacoes || null,
      origem_aditivo_id: form.origem_aditivo_id || null,
      ata_item_id: form.ata_item_id || null,
    } as any);
    setSaving(false);
    if (error) { toast.error('Erro ao salvar item', { description: error.message }); return; }
    toast.success('Item cadastrado!');
    setDialogOpen(false);
    setForm({ descricao: '', unidade: 'UN', quantidade_contratada: '', valor_unitario: '', custo_unitario: '', codigo_item: '', observacoes: '', origem_aditivo_id: '', ata_item_id: '' });
    loadData();
  };

  const handleImportarDaAta = async () => {
    if (!isContratoComATA || ataItens.length === 0) return;
    if (!confirm(`Importar ${ataItens.length} item(ns) da ATA para o contrato? Quantidades virão com o saldo disponível e podem ser ajustadas depois.`)) return;
    setImporting(true);
    try {
      const jaImportados = new Set(itens.filter(i => i.ata_item_id).map(i => i.ata_item_id));
      const novos = ataItens
        .filter(it => !jaImportados.has(it.id))
        .map(it => {
          const saldo = Math.max((it.quantidade_contratada || 0) - (it.quantidade_ata_consumida || 0), 0);
          return {
            contrato_id: contratoId,
            user_id: user!.id,
            descricao: it.descricao,
            unidade: it.unidade,
            quantidade_contratada: saldo,
            valor_unitario: it.valor_unitario,
            valor_total: saldo * (it.valor_unitario || 0),
            saldo_quantitativo: saldo,
            saldo_financeiro: saldo * (it.valor_unitario || 0),
            codigo_item: it.codigo_item,
            ata_item_id: it.id,
          };
        });
      if (novos.length === 0) {
        toast.info('Todos os itens da ATA já foram importados');
      } else {
        const { error } = await supabase.from('contrato_itens').insert(novos as any);
        if (error) throw error;
        toast.success(`${novos.length} item(ns) importado(s) da ATA`);
      }
      loadData();
    } catch (err: any) {
      toast.error('Erro ao importar', { description: err.message });
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from('contrato_itens').delete().eq('id', id);
    toast.success('Item excluído');
    loadData();
  };

  const handleDuplicate = async (item: ContratoItem) => {
    setForm({
      descricao: item.descricao,
      unidade: item.unidade,
      quantidade_contratada: String(item.quantidade_contratada),
      valor_unitario: String(item.valor_unitario),
      custo_unitario: item.custo_unitario != null ? String(item.custo_unitario) : '',
      codigo_item: item.codigo_item || '',
      observacoes: `Duplicado do item "${item.descricao}" — vinculado a aditivo`,
      origem_aditivo_id: '',
      ata_item_id: item.ata_item_id || '',
    });
    setDialogOpen(true);
  };

  const totalContratado = itens.reduce((s, i) => s + i.valor_total, 0);
  const totalSaldo = itens.reduce((s, i) => s + i.saldo_financeiro, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Package className="w-4 h-4 text-accent" /> Itens {meta?.tipo_documento === 'ata_srp' ? 'da ATA SRP' : 'do Contrato'}
          </h3>
          <p className="text-xs text-muted-foreground">
            Total: {fmt(totalContratado)} | Saldo: {fmt(totalSaldo)}
          </p>
          {isContratoComATA && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
              <Link2 className="w-3 h-3" /> Contrato vinculado à ATA SRP — itens devem ser selecionados da ATA de origem
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isContratoComATA && ataItens.length > 0 && (
            <Button size="sm" variant="outline" onClick={handleImportarDaAta} disabled={importing}>
              {importing ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1" />}
              Importar itens da ATA
            </Button>
          )}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-3.5 h-3.5 mr-1" /> Novo Item</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Cadastrar Item {meta?.tipo_documento === 'ata_srp' ? 'da ATA' : 'do Contrato'}</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3 mt-3">
                {isContratoComATA && (
                  <div className="col-span-2">
                    <Label>Item da ATA de origem *</Label>
                    <Select value={form.ata_item_id} onValueChange={onSelectAtaItem}>
                      <SelectTrigger><SelectValue placeholder="Selecionar item da ATA" /></SelectTrigger>
                      <SelectContent>
                        {ataItens.map(it => {
                          const saldo = Math.max((it.quantidade_contratada || 0) - (it.quantidade_ata_consumida || 0), 0);
                          return (
                            <SelectItem key={it.id} value={it.id} disabled={saldo <= 0}>
                              {it.codigo_item ? `[${it.codigo_item}] ` : ''}{it.descricao.slice(0, 60)} — saldo: {saldo} {it.unidade}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Ao selecionar, descrição/unidade/valor são preenchidos automaticamente.
                    </p>
                  </div>
                )}
                <div className="col-span-2">
                  <Label>Origem (Aditivo)</Label>
                  <Select value={form.origem_aditivo_id} onValueChange={v => setForm(f => ({ ...f, origem_aditivo_id: v === '__contrato__' ? '' : v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecionar origem" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__contrato__">{meta?.tipo_documento === 'ata_srp' ? 'ATA Original' : 'Contrato Original'}</SelectItem>
                      {aditivos.map(a => (
                        <SelectItem key={a.id} value={a.id}>Aditivo {a.numero_aditivo} ({a.tipo})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label>Descrição *</Label>
                  <Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} disabled={isContratoComATA && !!form.ata_item_id} />
                </div>
                <div>
                  <Label>Código</Label>
                  <Input value={form.codigo_item} onChange={e => setForm(f => ({ ...f, codigo_item: e.target.value }))} placeholder="ITEM-01" disabled={isContratoComATA && !!form.ata_item_id} />
                </div>
                <div>
                  <Label>Unidade</Label>
                  <Select value={form.unidade} onValueChange={v => setForm(f => ({ ...f, unidade: v }))} disabled={isContratoComATA && !!form.ata_item_id}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['UN', 'CX', 'KG', 'L', 'M', 'M²', 'M³', 'PCT', 'HR', 'DIA', 'MÊS', 'SV'].map(u => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Quantidade</Label>
                  <Input type="number" value={form.quantidade_contratada} onChange={e => setForm(f => ({ ...f, quantidade_contratada: e.target.value }))} />
                </div>
                <div>
                  <Label>Valor Unitário (R$)</Label>
                  <Input type="number" step="0.01" value={form.valor_unitario} onChange={e => setForm(f => ({ ...f, valor_unitario: e.target.value }))} disabled={isContratoComATA && !!form.ata_item_id} />
                </div>
                <div className="col-span-2">
                  <Label>Observações</Label>
                  <Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-3">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />} Salvar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : itens.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground text-sm">
          {isContratoComATA && ataItens.length > 0
            ? 'Nenhum item ainda. Use "Importar itens da ATA" para começar.'
            : 'Nenhum item cadastrado'}
        </Card>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs whitespace-nowrap">Origem</TableHead>
                {isContratoComATA && <TableHead className="text-xs whitespace-nowrap">Item ATA</TableHead>}
                <TableHead className="text-xs whitespace-nowrap">Código</TableHead>
                <TableHead className="text-xs whitespace-nowrap">Descrição</TableHead>
                <TableHead className="text-xs text-center whitespace-nowrap">UN</TableHead>
                <TableHead className="text-xs text-right whitespace-nowrap">Qtd</TableHead>
                <TableHead className="text-xs text-right whitespace-nowrap">Vlr Unit.</TableHead>
                <TableHead className="text-xs text-right whitespace-nowrap">Total</TableHead>
                <TableHead className="text-xs text-right whitespace-nowrap">Consumido</TableHead>
                <TableHead className="text-xs text-right whitespace-nowrap">Saldo Qtd</TableHead>
                <TableHead className="text-xs text-right whitespace-nowrap">Saldo R$</TableHead>
                <TableHead className="text-xs w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.map(item => {
                const pct = item.quantidade_contratada > 0
                  ? (item.quantidade_consumida / item.quantidade_contratada) * 100 : 0;
                const lowStock = pct >= 80;
                return (
                  <TableRow key={item.id} className={lowStock ? 'bg-warning/5' : ''}>
                    <TableCell className="text-xs whitespace-nowrap">
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {getOrigemLabel(item.origem_aditivo_id)}
                      </Badge>
                    </TableCell>
                    {isContratoComATA && (
                      <TableCell className="text-xs whitespace-nowrap">
                        {item.ata_item_id ? (
                          <Badge className="text-[10px] bg-amber-500/10 text-amber-600 font-normal">{ataItemLabel(item.ata_item_id)}</Badge>
                        ) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                    )}
                    <TableCell className="text-xs font-mono whitespace-nowrap">{item.codigo_item || '—'}</TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">{item.descricao}</TableCell>
                    <TableCell className="text-xs text-center whitespace-nowrap">{item.unidade}</TableCell>
                    <TableCell className="text-xs text-right whitespace-nowrap">{item.quantidade_contratada}</TableCell>
                    <TableCell className="text-xs text-right whitespace-nowrap">{fmt(item.valor_unitario)}</TableCell>
                    <TableCell className="text-xs text-right font-medium whitespace-nowrap">{fmt(item.valor_total)}</TableCell>
                    <TableCell className="text-xs text-right whitespace-nowrap">
                      {item.quantidade_consumida}
                      <span className="text-muted-foreground ml-1">({pct.toFixed(0)}%)</span>
                    </TableCell>
                    <TableCell className={`text-xs text-right font-medium whitespace-nowrap ${lowStock ? 'text-warning' : 'text-success'}`}>
                      {item.saldo_quantitativo}
                    </TableCell>
                    <TableCell className={`text-xs text-right font-medium whitespace-nowrap ${lowStock ? 'text-warning' : 'text-success'}`}>
                      {fmt(item.saldo_financeiro)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-0.5">
                        <Button size="icon" variant="ghost" className="h-7 w-7" title="Duplicar item (aditivo)" onClick={() => handleDuplicate(item)}>
                          <Copy className="w-3.5 h-3.5 text-accent" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(item.id)}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
