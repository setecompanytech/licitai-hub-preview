import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { Loader2, Search, ArrowDownCircle } from 'lucide-react';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const fmtDate = (d: string) => {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

const statusBadge: Record<string, string> = {
  aberto: 'bg-blue-100 text-blue-800',
  parcial: 'bg-amber-100 text-amber-800',
  pago: 'bg-emerald-100 text-emerald-800',
  cancelado: 'bg-gray-100 text-gray-600',
};

export default function FinContasPagar() {
  const { empresaAtiva } = useEmpresa();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!empresaAtiva?.id) return;
    load();
  }, [empresaAtiva?.id]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('fin_contas_pagar')
      .select('*')
      .eq('empresa_id', empresaAtiva!.id)
      .order('data_vencimento', { ascending: true });
    setItems(data || []);
    setLoading(false);
  }

  const filtered = items.filter((i) =>
    !search || i.descricao?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><ArrowDownCircle className="w-5 h-5 text-red-500" /> Contas a Pagar</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} registro(s)</p>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">Descrição</th>
              <th className="text-right p-3 font-medium">Valor</th>
              <th className="text-center p-3 font-medium">Vencimento</th>
              <th className="text-center p-3 font-medium">Parcela</th>
              <th className="text-center p-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id} className="border-t hover:bg-muted/30">
                <td className="p-3">{item.descricao}</td>
                <td className="p-3 text-right font-medium">{fmt(item.valor_total)}</td>
                <td className="p-3 text-center">{fmtDate(item.data_vencimento)}</td>
                <td className="p-3 text-center">{item.total_parcelas > 1 ? `${item.parcela_atual}/${item.total_parcelas}` : '—'}</td>
                <td className="p-3 text-center">
                  <Badge className={statusBadge[item.status] || ''}>{item.status}</Badge>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Nenhuma conta a pagar encontrada</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
