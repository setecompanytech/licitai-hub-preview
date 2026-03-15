import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  Plus, Trash2, Loader2, Receipt, DollarSign, TrendingUp, TrendingDown, Percent
} from 'lucide-react';

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const tiposCusto = [
  { value: 'custo_direto', label: 'Custo Direto', icon: '📦' },
  { value: 'despesa_administrativa', label: 'Despesa Administrativa', icon: '🏢' },
  { value: 'frete_logistica', label: 'Frete / Logística', icon: '🚚' },
  { value: 'tributo', label: 'Tributos', icon: '📋' },
  { value: 'mao_de_obra', label: 'Mão de Obra', icon: '👷' },
  { value: 'outros', label: 'Outros', icon: '📎' },
];

type Custo = {
  id: string; tipo: string; descricao: string; valor: number;
  data_lancamento: string | null; categoria: string | null;
  nota_fiscal: string | null; observacoes: string | null;
};

export default function ContratoCustos({ contratoId, valorFaturado }: { contratoId: string; valorFaturado: number }) {
  const { user } = useAuth();
  const [custos, setCustos] = useState<Custo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState('all');
  const [form, setForm] = useState({
    tipo: 'custo_direto', descricao: '', valor: '',
    data_lancamento: new Date().toISOString().split('T')[0],
    categoria: '', nota_fiscal: '', observacoes: '',
  });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('contrato_custos')
      .select('*')
      .eq('contrato_id', contratoId)
      .order('data_lancamento', { ascending: false });
    setCustos((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [contratoId]);

  const handleSave = async () => {
    if (!form.descricao || !form.valor) { toast.error('Preencha descrição e valor'); return; }
    setSaving(true);
    const { error } = await supabase.from('contrato_custos').insert({
      contrato_id: contratoId,
      user_id: user!.id,
      tipo: form.tipo,
      descricao: form.descricao,
      valor: parseFloat(form.valor) || 0,
      data_lancamento: form.data_lancamento || null,
      categoria: form.categoria || null,
      nota_fiscal: form.nota_fiscal || null,
      observacoes: form.observacoes || null,
    } as any);
    setSaving(false);
    if (error) { toast.error('Erro ao salvar custo'); return; }
    toast.success('Custo registrado!');
    setDialogOpen(false);
    setForm({
      tipo: 'custo_direto', descricao: '', valor: '',
      data_lancamento: new Date().toISOString().split('T')[0],
      categoria: '', nota_fiscal: '', observacoes: '',
    });
    load();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('contrato_custos').delete().eq('id', id);
    toast.success('Custo excluído');
    load();
  };

  const custosFiltrados = filtroTipo === 'all' ? custos : custos.filter(c => c.tipo === filtroTipo);

  // Financial calculations
  const custosPorTipo = useMemo(() => {
    const map: Record<string, number> = {};
    custos.forEach(c => {
      map[c.tipo] = (map[c.tipo] || 0) + c.valor;
    });
    return map;
  }, [custos]);

  const totalCustos = custos.reduce((s, c) => s + c.valor, 0);
  const custosDiretos = custosPorTipo['custo_direto'] || 0;
  const tributos = custosPorTipo['tributo'] || 0;
  const lucroBruto = valorFaturado - custosDiretos;
  const lucroLiquido = valorFaturado - totalCustos;
  const margemBruta = valorFaturado > 0 ? (lucroBruto / valorFaturado) * 100 : 0;
  const margemLiquida = valorFaturado > 0 ? (lucroLiquido / valorFaturado) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Financial KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-1 text-muted-foreground text-[10px] mb-1"><DollarSign className="w-3 h-3" /> Faturamento</div>
          <p className="text-sm font-bold text-foreground">{fmt(valorFaturado)}</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-1 text-muted-foreground text-[10px] mb-1"><Receipt className="w-3 h-3" /> Custos Totais</div>
          <p className="text-sm font-bold text-destructive">{fmt(totalCustos)}</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-1 text-muted-foreground text-[10px] mb-1"><TrendingUp className="w-3 h-3" /> Lucro Bruto</div>
          <p className={`text-sm font-bold ${lucroBruto >= 0 ? 'text-success' : 'text-destructive'}`}>{fmt(lucroBruto)}</p>
          <p className="text-[9px] text-muted-foreground">Margem: {margemBruta.toFixed(1)}%</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-1 text-muted-foreground text-[10px] mb-1"><TrendingDown className="w-3 h-3" /> Lucro Líquido</div>
          <p className={`text-sm font-bold ${lucroLiquido >= 0 ? 'text-success' : 'text-destructive'}`}>{fmt(lucroLiquido)}</p>
          <p className="text-[9px] text-muted-foreground">Margem: {margemLiquida.toFixed(1)}%</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-1 text-muted-foreground text-[10px] mb-1"><Percent className="w-3 h-3" /> Tributos</div>
          <p className="text-sm font-bold text-warning">{fmt(tributos)}</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-1 text-muted-foreground text-[10px] mb-1">🚚 Frete/Logística</div>
          <p className="text-sm font-bold text-accent">{fmt(custosPorTipo['frete_logistica'] || 0)}</p>
        </Card>
      </div>

      {/* Cost breakdown by type */}
      {custos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {tiposCusto.map(t => {
            const val = custosPorTipo[t.value] || 0;
            const pct = totalCustos > 0 ? (val / totalCustos) * 100 : 0;
            return (
              <div key={t.value} className="rounded-lg border p-2 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setFiltroTipo(filtroTipo === t.value ? 'all' : t.value)}>
                <span className="text-sm">{t.icon}</span>
                <p className="text-[9px] font-medium mt-0.5">{t.label}</p>
                <p className="text-xs font-bold">{fmt(val)}</p>
                <p className="text-[9px] text-muted-foreground">{pct.toFixed(0)}%</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Header + Add */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Receipt className="w-4 h-4 text-accent" /> Lançamentos de Custos
          {filtroTipo !== 'all' && (
            <Badge variant="outline" className="text-[10px] cursor-pointer" onClick={() => setFiltroTipo('all')}>
              {tiposCusto.find(t => t.value === filtroTipo)?.label} ✕
            </Badge>
          )}
        </h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-3.5 h-3.5 mr-1" /> Novo Custo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Registrar Custo / Despesa</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="col-span-2">
                <Label>Tipo *</Label>
                <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {tiposCusto.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Descrição *</Label>
                <Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
              </div>
              <div>
                <Label>Valor (R$) *</Label>
                <Input type="number" step="0.01" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} />
              </div>
              <div>
                <Label>Data</Label>
                <Input type="date" value={form.data_lancamento} onChange={e => setForm(f => ({ ...f, data_lancamento: e.target.value }))} />
              </div>
              <div>
                <Label>Categoria</Label>
                <Input value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} placeholder="Material, Serviço..." />
              </div>
              <div>
                <Label>Nota Fiscal</Label>
                <Input value={form.nota_fiscal} onChange={e => setForm(f => ({ ...f, nota_fiscal: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <Label>Observações</Label>
                <Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />} Registrar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : custosFiltrados.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground text-sm">Nenhum custo registrado</Card>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Tipo</TableHead>
                <TableHead className="text-xs">Descrição</TableHead>
                <TableHead className="text-xs text-right">Valor</TableHead>
                <TableHead className="text-xs text-center">Data</TableHead>
                <TableHead className="text-xs">Categoria</TableHead>
                <TableHead className="text-xs">NF</TableHead>
                <TableHead className="text-xs w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {custosFiltrados.map(c => {
                const tipoCfg = tiposCusto.find(t => t.value === c.tipo);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="text-xs">
                      <Badge variant="outline" className="text-[10px]">{tipoCfg?.icon} {tipoCfg?.label || c.tipo}</Badge>
                    </TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">{c.descricao}</TableCell>
                    <TableCell className="text-xs text-right font-medium text-destructive">{fmt(c.valor)}</TableCell>
                    <TableCell className="text-xs text-center">{c.data_lancamento ? new Date(c.data_lancamento + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</TableCell>
                    <TableCell className="text-xs">{c.categoria || '—'}</TableCell>
                    <TableCell className="text-xs">{c.nota_fiscal || '—'}</TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(c.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
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
