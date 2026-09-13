import { useState, useEffect } from 'react';
import { dataLocal, hojeLocal } from '@/lib/financeiro/data-local';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import KitFaturamento from './KitFaturamento';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import EstadoVazio from '@/components/shared/EstadoVazio';
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
  contrato_item_id: string | null;
  quantidade: number | null;
  valor_unitario: number | null;
  uf: string | null;
  municipio: string | null;
};

type VarianteBadge = 'success' | 'warning' | 'danger' | 'info' | 'muted';

const KANBAN_CFG: Record<string, { label: string; variante: VarianteBadge }> = {
  pedido:          { label: 'Aguard. Faturamento', variante: 'info' },
  separar_estoque: { label: 'Separar Estoque',     variante: 'warning' },
  faturar:         { label: 'Faturar',             variante: 'warning' },
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
          contrato_item_id, quantidade, valor_unitario,
          contratos!inner(numero_contrato, orgao_contratante, empresa_id, uf, municipio)
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
        contrato_item_id: r.contrato_item_id ?? null,
        quantidade: r.quantidade ?? null,
        valor_unitario: r.valor_unitario ?? null,
        uf: r.contratos?.uf ?? null,
        municipio: r.contratos?.municipio ?? null,
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

  // ——— Fase D: do faturamento à NF-e de saída ———————————————————————————
  // O pedido revisado vira Conta a Receber AQUI e, se pedido, segue direto ao
  // Emissor com os dados carregados (item, quantidade, preço e os fiscais do
  // produto do contrato). A entrega é por sessionStorage: o Emissor lê a
  // chave uma vez e a apaga — recarregar a página não re-preenche fantasma.
  const encaminharParaEmissor = async (r: Row) => {
    let fiscal: Record<string, unknown> = {};
    let descricaoItem = r.descricao || `Pedido ${r.numero_pedido}`;
    try {
      if (r.contrato_item_id) {
        const { data: ci } = await (supabase.from('contrato_itens') as any)
          .select('descricao, unidade, produto_id')
          .eq('id', r.contrato_item_id).maybeSingle();
        if (ci?.descricao) descricaoItem = ci.descricao;
        if (ci?.produto_id) {
          const { data: p } = await supabase.from('produtos')
            .select('codigo, descricao, unidade, ncm, cfop, cst_icms, csosn, p_icms, p_pis, p_cofins, origem_mercadoria')
            .eq('id', ci.produto_id).maybeSingle();
          if (p) {
            fiscal = {
              codigo: (p as any).codigo || '',
              ncm: (p as any).ncm || '',
              cfop: (p as any).cfop || '',
              unidade: (p as any).unidade || ci.unidade || 'UN',
              cst_csosn: (p as any).csosn || (p as any).cst_icms || '',
              aliq_icms: Number((p as any).p_icms) || 0,
              aliq_pis: Number((p as any).p_pis) || 0,
              aliq_cofins: Number((p as any).p_cofins) || 0,
              origem: (p as any).origem_mercadoria || '0',
            };
            if ((p as any).descricao) descricaoItem = (p as any).descricao;
          }
        }
      }
    } catch { /* fiscais são conveniência — o emissor deixa editar tudo */ }

    sessionStorage.setItem('praefectus_emissor_prefill', JSON.stringify({
      origem: 'contrato_pedido',
      contrato_pedido_id: r.id,
      numero_pedido: r.numero_pedido,
      contrato_numero: r.contrato_numero,
      orgao: r.orgao,
      uf: r.uf,
      municipio: r.municipio,
      itens: [{
        descricao: descricaoItem,
        quantidade: Number(r.quantidade) || 1,
        valor_unitario: Number(r.valor_unitario) || r.valor_total,
        ...fiscal,
      }],
    }));
    navigate('/financeiro/emissor_nfe');
  };

  const handleFaturar = async (emitirNfe = false) => {
    if (!faturando || !contaId) return;
    setSaving(true);
    try {
      const nParcelas = Math.max(1, parseInt(parcelas) || 1);
      // A última parcela carrega a sobra do arredondamento: 10.000 em 3×
      // gravava 3.333,33 ×3 = 9.999,99 e um centavo sumia do contrato.
      const valorParcela = Math.round((faturando.valor_total / nParcelas) * 100) / 100;
      const valorUltima = +(faturando.valor_total - valorParcela * (nParcelas - 1)).toFixed(2);
      const hoje = new Date();
      const diaBase = hoje.getDate();

      const inserts = Array.from({ length: nParcelas }, (_, i) => {
        // Mês a mês com dia grampeado no fim do mês: somar mês a partir do
        // dia 31 estourava (31/jan em 3× dava 03/mar, 31/mar e 01/mai).
        const alvo = new Date(hoje.getFullYear(), hoje.getMonth() + i + 1, 1, 12);
        const ultimoDia = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
        alvo.setDate(Math.min(diaBase, ultimoDia));
        const venc = alvo;
        return {
          empresa_id: faturando.empresa_id,
          tipo: 'a_receber' as const,
          natureza: 'receita' as const,
          status: 'previsto' as const,
          descricao: `${faturando.contrato_numero ?? 'Contrato'} · Pedido ${faturando.numero_pedido}${nParcelas > 1 ? ` — Parcela ${i + 1}/${nParcelas}` : ''}`,
          valor: i === nParcelas - 1 ? valorUltima : valorParcela,
          data_competencia: dataLocal(venc),
          // Sem vencimento a parcela ficava invisível para o fluxo de caixa.
          data_vencimento: dataLocal(venc),
          data_emissao: hojeLocal(),
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
      const pedidoFaturado = faturando;
      setFaturando(null);
      setContaId('');
      setParcelas('1');
      load();
      if (emitirNfe) await encaminharParaEmissor(pedidoFaturado);
    } catch {
      toast.error('Erro inesperado ao faturar.');
    } finally {
      setSaving(false);
    }
  };

  const total = rows.reduce((s, r) => s + r.valor_total, 0);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">Total pendente</p>
        <p className="text-[2rem] leading-10 font-bold tabular-nums text-foreground">{fmt(total)}</p>
        <p className="text-xs text-muted-foreground">
          {rows.length} pedido{rows.length === 1 ? '' : 's'} aguardando faturamento
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12" role="status" aria-label="Carregando pedidos">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" aria-hidden="true" />
        </div>
      ) : rows.length === 0 ? (
        <EstadoVazio
          icone={<Check />}
          titulo="Tudo em dia!"
          descricao="Nenhum pedido aguardando faturamento."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contrato</TableHead>
                <TableHead>N.º Pedido</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-center">Data</TableHead>
                <TableHead className="text-center">Status Kanban</TableHead>
                <TableHead className="w-24">
                  <span className="sr-only">Ações</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(r => {
                const kCfg = r.kanban_status ? KANBAN_CFG[r.kanban_status] : null;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-1">
                        <span className="font-medium">{r.contrato_numero ?? '—'}</span>
                        {r.orgao && (
                          <span
                            className="min-w-0 max-w-[140px] truncate text-muted-foreground"
                            title={r.orgao}
                          >
                            · {r.orgao}
                          </span>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="ml-1 h-8 w-8 shrink-0 text-primary"
                          onClick={() => navigate(`/contratos/${r.contrato_id}`)}
                          aria-label={`Abrir contrato ${r.contrato_numero ?? ''}`.trim()}
                          title="Abrir contrato"
                        >
                          <ExternalLink aria-hidden="true" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell nowrap className="text-sm font-mono font-medium">{r.numero_pedido}</TableCell>
                    <TableCell truncate className="text-sm" title={r.descricao || undefined}>{r.descricao || '—'}</TableCell>
                    <TableCell nowrap className="text-sm text-right font-semibold tabular-nums">{fmt(r.valor_total)}</TableCell>
                    <TableCell nowrap className="text-sm text-center tabular-nums">
                      {r.data_pedido
                        ? new Date(r.data_pedido + 'T00:00:00').toLocaleDateString('pt-BR')
                        : '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      {kCfg ? (
                        <Badge variant={kCfg.variante}>{kCfg.label}</Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2 justify-end">
                        <KitFaturamento
                          pedido={{
                            id: r.id,
                            numero_pedido: r.numero_pedido,
                            valor_total: r.valor_total,
                            contrato_id: r.contrato_id,
                            contrato_numero: r.contrato_numero,
                            orgao: r.orgao,
                          }}
                        />
                        <Button
                          size="sm"
                          onClick={() => { setFaturando(r); setContaId(''); setParcelas('1'); }}
                        >
                          <DollarSign aria-hidden="true" /> Faturar
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

      {/* Dialog de faturamento */}
      <Dialog open={!!faturando} onOpenChange={v => { if (!v) { setFaturando(null); setContaId(''); setParcelas('1'); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
              <DollarSign className="w-5 h-5 text-muted-foreground" aria-hidden="true" /> Lançar Conta a Receber
            </DialogTitle>
          </DialogHeader>
          {faturando && (
            <div className="space-y-4 py-1">
              <div className="rounded-md border border-border bg-muted p-3 text-sm space-y-1">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Pedido</span>
                  <span className="font-medium">{faturando.numero_pedido}</span>
                </div>
                {faturando.contrato_numero && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Contrato</span>
                    <span className="font-medium">{faturando.contrato_numero}</span>
                  </div>
                )}
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Valor total</span>
                  <span className="font-bold tabular-nums text-foreground">{fmt(faturando.valor_total)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pedido-conta-destino" className="text-sm">Conta destino *</Label>
                <Select value={contaId} onValueChange={setContaId}>
                  <SelectTrigger id="pedido-conta-destino">
                    <SelectValue placeholder="Selecione a conta bancária..." />
                  </SelectTrigger>
                  <SelectContent>
                    {contas.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pedido-parcelas" className="text-sm">Número de parcelas</Label>
                <Input
                  id="pedido-parcelas"
                  type="number" min="1" max="60"
                  value={parcelas}
                  onChange={e => setParcelas(e.target.value)}
                />
                {parseInt(parcelas) > 1 && (
                  <p className="text-xs text-muted-foreground">
                    {parseInt(parcelas)} parcelas de {fmt(faturando.valor_total / parseInt(parcelas))}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={() => { setFaturando(null); }}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!contaId || saving}
                  onClick={() => handleFaturar(false)}
                >
                  {saving
                    ? <Loader2 className="animate-spin" aria-hidden="true" />
                    : <Check aria-hidden="true" />}
                  Gerar {parseInt(parcelas) > 1 ? `${parcelas} parcelas` : 'conta'}
                </Button>
                <Button
                  size="sm"
                  disabled={!contaId || saving}
                  onClick={() => handleFaturar(true)}
                  title="Cria a conta a receber e abre o Emissor com os dados do pedido carregados"
                >
                  {saving
                    ? <Loader2 className="animate-spin" aria-hidden="true" />
                    : <ExternalLink aria-hidden="true" />}
                  Faturar e emitir NF-e
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
