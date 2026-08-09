import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, DollarSign, Check, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

type Row = {
  id: string;
  numero_pedido: string;
  descricao: string | null;
  valor_total: number;
  data_pedido: string | null;
  status: string;
  pedido_id: string | null;
  kanban_status: string | null;
  contrato_id: string;
  contrato_numero: string | null;
  orgao: string | null;
  empresa_id: string | null;
};

const KANBAN_CFG: Record<string, { label: string; color: string }> = {
  pedido:          { label: 'Aguard. Faturamento', color: 'bg-info/10 text-info border-info/20' },
  separar_estoque: { label: 'Separar Estoque',     color: 'bg-warning/10 text-warning border-warning/20' },
  faturar:         { label: 'Faturar',             color: 'bg-warning/10 text-warning border-warning/20' },
};

export default function FinPedidosAFaturar() {
  const { empresaAtiva } = useEmpresa();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [rows, setRows] = useState<Row[]>([]);
  const [contas, setContas] = useState<{ id: string; nome: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog de faturamento
  const [faturando, setFaturando] = useState<Row | null>(null);
  const [contaId, setContaId] = useState('');
  const [parcelas, setParcelas] = useState('1');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!empresaAtiva?.id) return;
    setLoading(true);
    try {
      // 1. Busca contrato_pedidos da empresa (via contratos)
      const { data: cpRows, error } = await supabase
        .from('contrato_pedidos')
        .select(`
          id, numero_pedido, descricao, valor_total, data_pedido, status, pedido_id, contrato_id,
          contratos!inner(numero_contrato, orgao_contratante, empresa_id)
        `)
        .eq('contratos.empresa_id', empresaAtiva.id)
        .eq('nf_quitada', false)
        .neq('status', 'cancelado')
        .order('data_pedido', { ascending: false }) as any;

      if (error) throw error;

      const all: Row[] = (cpRows || []).map((r: any) => ({
        id: r.id,
        numero_pedido: r.numero_pedido,
        descricao: r.descricao,
        valor_total: r.valor_total,
        data_pedido: r.data_pedido,
        status: r.status,
        pedido_id: r.pedido_id,
        kanban_status: null,
        contrato_id: r.contrato_id,
        contrato_numero: r.contratos?.numero_contrato ?? null,
        orgao: r.contratos?.orgao_contratante ?? null,
        empresa_id: r.contratos?.empresa_id ?? null,
      }));

      // 2. Fetch kanban status for linked pedidos
      const linkedIds = all.map(r => r.pedido_id).filter(Boolean) as string[];
      const kMap: Record<string, string> = {};
      if (linkedIds.length > 0) {
        const { data: kRows } = await supabase
          .from('pedidos' as never)
          .select('id, status')
          .in('id', linkedIds);
        for (const k of (kRows ?? []) as any[]) kMap[k.id] = k.status;
      }

      // 3. Filter: exclude faturado/cancelado/entrega in kanban
      const filtered = all.filter(r => {
        if (!r.pedido_id) return true; // sem kanban → mostrar
        const ks = kMap[r.pedido_id] ?? 'pedido';
        return !['faturado', 'cancelado', 'entrega'].includes(ks);
      }).map(r => ({
        ...r,
        kanban_status: r.pedido_id ? (kMap[r.pedido_id] ?? 'pedido') : null,
      }));

      setRows(filtered);

      // 4. Contas financeiras
      const { data: contasData } = await supabase
        .from('financeiro_contas' as never)
        .select('id, nome')
        .eq('empresa_id', empresaAtiva.id)
        .eq('ativo', true)
        .order('nome') as any;
      setContas(contasData || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [empresaAtiva?.id]);

  const handleFaturar = async () => {
    if (!faturando || !contaId) return;
    setSaving(true);
    try {
      const nParcelas = Math.max(1, parseInt(parcelas) || 1);
      const valorParcela = faturando.valor_total / nParcelas;
      const hoje = new Date();

      const inserts = Array.from({ length: nParcelas }, (_, i) => {
        const venc = new Date(hoje);
        venc.setMonth(venc.getMonth() + i + 1);
        return {
          empresa_id: faturando.empresa_id,
          tipo: 'a_receber' as const,
          natureza: 'receita' as const,
          status: 'previsto' as const,
          descricao: `${faturando.contrato_numero ?? 'Contrato'} · Pedido ${faturando.numero_pedido}${nParcelas > 1 ? ` — Parcela ${i + 1}/${nParcelas}` : ''}`,
          valor: parseFloat(valorParcela.toFixed(2)),
          data_competencia: venc.toISOString().slice(0, 10),
          data_emissao: hoje.toISOString().slice(0, 10),
          conta_id: contaId,
          contrato_id: faturando.contrato_id,
          contrato_pedido_id: faturando.id,
          origem: 'manual' as const,
          origem_tipo: 'manual' as const,
          origem_job: 'FinPedidosAFaturar',
          origem_usuario_id: user?.id ?? null,
          origem_timestamp: new Date().toISOString(),
          created_by: user?.id ?? null,
        };
      });

      const { error: errIns } = await supabase
        .from('financeiro_lancamentos')
        .insert(inserts as any);

      if (errIns) { toast.error('Erro ao criar conta a receber: ' + errIns.message); return; }

      // Atualiza kanban status para 'faturado' se tiver pedido_id
      if (faturando.pedido_id) {
        await supabase
          .from('pedidos')
          .update({ status: 'faturado' })
          .eq('id', faturando.pedido_id);
      }

      toast.success(`${nParcelas} conta(s) a receber criada(s) no Financeiro.`);
      setFaturando(null);
      setContaId('');
      setParcelas('1');
      load();
    } catch {
      toast.error('Erro inesperado ao faturar.');
    } finally {
      setSaving(false);
    }
  };

  const total = rows.reduce((s, r) => s + r.valor_total, 0);

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Pedidos a Faturar</h2>
          <p className="text-sm text-muted-foreground">
            Pedidos de contratos aguardando faturamento. Após faturar, o valor é lançado em Contas a Receber.
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Total pendente</p>
          <p className="text-xl font-bold text-foreground">{fmt(total)}</p>
          <p className="text-xs text-muted-foreground">{rows.length} pedido(s)</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Check className="w-10 h-10 mb-3 text-success/60" />
          <p className="font-medium">Tudo em dia!</p>
          <p className="text-sm">Nenhum pedido aguardando faturamento.</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Contrato</TableHead>
                <TableHead className="text-xs">N.º Pedido</TableHead>
                <TableHead className="text-xs">Descrição</TableHead>
                <TableHead className="text-xs text-right">Valor</TableHead>
                <TableHead className="text-xs text-center">Data</TableHead>
                <TableHead className="text-xs text-center">Status Kanban</TableHead>
                <TableHead className="text-xs w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(r => {
                const kCfg = r.kanban_status ? KANBAN_CFG[r.kanban_status] : null;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-1">
                        <span className="font-medium">{r.contrato_numero ?? '—'}</span>
                        {r.orgao && (
                          <span className="text-muted-foreground truncate max-w-[140px]">· {r.orgao}</span>
                        )}
                        <button
                          onClick={() => navigate(`/contratos/${r.contrato_id}`)}
                          className="text-primary hover:opacity-80 ml-1"
                          title="Abrir contrato"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-mono font-medium">{r.numero_pedido}</TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">{r.descricao || '—'}</TableCell>
                    <TableCell className="text-xs text-right font-semibold">{fmt(r.valor_total)}</TableCell>
                    <TableCell className="text-xs text-center">
                      {r.data_pedido
                        ? new Date(r.data_pedido + 'T00:00:00').toLocaleDateString('pt-BR')
                        : '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      {kCfg ? (
                        <Badge className={`text-xs border ${kCfg.color}`}>{kCfg.label}</Badge>
                      ) : (
                        <span className="text-muted-foreground/40 text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => { setFaturando(r); setContaId(''); setParcelas('1'); }}
                      >
                        <DollarSign className="w-3 h-3 mr-1" /> Faturar
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dialog de faturamento */}
      <Dialog open={!!faturando} onOpenChange={v => { if (!v) { setFaturando(null); setContaId(''); setParcelas('1'); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-muted-foreground" /> Lançar Conta a Receber
            </DialogTitle>
          </DialogHeader>
          {faturando && (
            <div className="space-y-4 py-1">
              <div className="bg-muted/40 border rounded-md p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pedido</span>
                  <span className="font-medium">{faturando.numero_pedido}</span>
                </div>
                {faturando.contrato_numero && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Contrato</span>
                    <span className="font-medium">{faturando.contrato_numero}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor total</span>
                  <span className="font-bold text-foreground">{fmt(faturando.valor_total)}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Conta destino *</Label>
                <Select value={contaId} onValueChange={setContaId}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Selecione a conta bancária..." />
                  </SelectTrigger>
                  <SelectContent>
                    {contas.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Número de parcelas</Label>
                <Input
                  type="number" min="1" max="60"
                  className="h-8 text-sm"
                  value={parcelas}
                  onChange={e => setParcelas(e.target.value)}
                />
                {parseInt(parcelas) > 1 && (
                  <p className="text-xs text-muted-foreground">
                    {parseInt(parcelas)} parcelas de {fmt(faturando.valor_total / parseInt(parcelas))}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={() => { setFaturando(null); }}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  disabled={!contaId || saving}
                  onClick={handleFaturar}
                >
                  {saving
                    ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                    : <Check className="w-3.5 h-3.5 mr-1" />}
                  Gerar {parseInt(parcelas) > 1 ? `${parcelas} parcelas` : 'conta'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
