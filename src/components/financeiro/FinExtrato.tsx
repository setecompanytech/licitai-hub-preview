import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { Loader2, RefreshCw, ArrowUpRight, ArrowDownRight } from 'lucide-react';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const fmtDate = (d: string) => { if (!d) return '—'; return new Date(d).toLocaleDateString('pt-BR'); };

export default function FinExtrato() {
  const { empresaAtiva } = useEmpresa();
  const [movs, setMovs] = useState<any[]>([]);
  const [contas, setContas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [contaFilter, setContaFilter] = useState('all');

  useEffect(() => { if (empresaAtiva?.id) load(); }, [empresaAtiva?.id]);

  async function load() {
    setLoading(true);
    const eid = empresaAtiva!.id;
    const [mRes, cRes] = await Promise.all([
      supabase.from('fin_movimentacoes').select('*').eq('empresa_id', eid).order('data_lancamento', { ascending: false }).limit(200),
      supabase.from('fin_contas').select('id, nome').eq('empresa_id', eid),
    ]);
    setMovs(mRes.data || []);
    setContas(cRes.data || []);
    setLoading(false);
  }

  const filtered = contaFilter === 'all' ? movs : movs.filter((m) => m.conta_id === contaFilter);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold flex items-center gap-2"><RefreshCw className="w-5 h-5" /> Extrato / Conciliação</h1>
        <Select value={contaFilter} onValueChange={setContaFilter}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Filtrar por conta" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as contas</SelectItem>
            {contas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">Data</th>
              <th className="text-left p-3 font-medium">Descrição</th>
              <th className="text-center p-3 font-medium">Tipo</th>
              <th className="text-right p-3 font-medium">Valor</th>
              <th className="text-center p-3 font-medium">Conciliado</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => {
              const isCredito = m.tipo_lancamento === 'credito';
              return (
                <tr key={m.id} className="border-t hover:bg-muted/30">
                  <td className="p-3">{fmtDate(m.data_lancamento)}</td>
                  <td className="p-3">{m.descricao}</td>
                  <td className="p-3 text-center">
                    {isCredito ? <ArrowUpRight className="w-4 h-4 text-emerald-600 inline" /> : <ArrowDownRight className="w-4 h-4 text-destructive inline" />}
                  </td>
                  <td className={`p-3 text-right font-medium ${isCredito ? 'text-emerald-600' : 'text-destructive'}`}>
                    {isCredito ? '+' : '-'}{fmt(m.valor)}
                  </td>
                  <td className="p-3 text-center">
                    <Badge variant={m.conciliado_em ? 'default' : 'outline'}>{m.conciliado_em ? 'Sim' : 'Não'}</Badge>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Nenhuma movimentação</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
