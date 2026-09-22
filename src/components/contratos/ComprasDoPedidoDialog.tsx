import { useCallback, useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MoneyInput } from '@/components/ui/money-input';
import { Skeleton } from '@/components/ui/skeleton';
import SeloSituacao from '@/components/gestao/SeloSituacao';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Link2, Undo2 } from 'lucide-react';
import {
  fmtReais, fraseDaCobertura, parteSugerida, ROTULO_SITUACAO, situacaoDoCusto, sobraDoTitulo, type SituacaoDoCusto,
} from '@/lib/contratos/cobertura-de-custo';

type PedidoDaCompra = { id: string; numero_pedido: string; quantidade: number; custo_total?: number | null };
type CustoDoPedido = { situacao: SituacaoDoCusto; comprovado_pago: number; comprovado_aberto: number };
type Titulo = {
  id: string; descricao: string | null; valor: number; status: string;
  data_competencia: string | null; numero_documento: string | null;
};
type Rateio = { id: string; lancamento_id: string; contrato_pedido_id: string; valor: number };

const PAGO = new Set(['realizado', 'conciliado']);
const dataBr = (d: string | null) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString('pt-BR') : '—');

/**
 * Compras deste pedido — o custo COMPROVADO.
 *
 * Lista as contas a pagar atribuídas ao contrato e deixa o Admin/Financeiro
 * destinar a parte de cada uma a este pedido (rateio), ou desfazer. É o único
 * caminho da compra até o pedido: a coluna `contrato_pedido_id` é do título
 * da NF de saída, e a quitação a lê como parcela do recebimento.
 */
export default function ComprasDoPedidoDialog({
  pedido, contratoId, custo, aoFechar, aoMudar,
}: {
  pedido: PedidoDaCompra | null;
  contratoId: string;
  custo?: CustoDoPedido;
  aoFechar: () => void;
  aoMudar: () => void;
}) {
  const [carregando, setCarregando] = useState(false);
  const [titulos, setTitulos] = useState<Titulo[]>([]);
  const [rateios, setRateios] = useState<Rateio[]>([]);
  const [partes, setPartes] = useState<Record<string, number>>({});
  const [motivo, setMotivo] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!pedido) return;
    setCarregando(true);
    const { data, error } = await supabase
      .from('financeiro_lancamentos')
      .select('id, descricao, valor, status, data_competencia, numero_documento')
      .eq('contrato_id', contratoId)
      .eq('tipo', 'a_pagar')
      .neq('status', 'cancelado')
      .order('data_competencia', { ascending: false })
      .limit(300);
    if (error) { setCarregando(false); toast.error('Não foi possível listar as contas a pagar', { description: error.message }); return; }
    const lista = ((data ?? []) as unknown as Titulo[]).map(t => ({ ...t, valor: Number(t.valor) || 0 }));
    setTitulos(lista);
    if (lista.length > 0) {
      // A tabela de rateios vem de migration colada à mão: ausente, a tela
      // segue sem os rateios, e o botão de atribuir diz o que falta.
      const { data: rs } = await supabase
        .from('financeiro_lancamento_rateios' as never)
        .select('id, lancamento_id, contrato_pedido_id, valor')
        .in('lancamento_id', lista.map(t => t.id));
      setRateios(((rs ?? []) as unknown as Rateio[]).map(r => ({ ...r, valor: Number(r.valor) || 0 })));
    } else {
      setRateios([]);
    }
    setCarregando(false);
  }, [pedido, contratoId]);

  useEffect(() => { void carregar(); }, [carregar]);

  const declarado = Number(pedido?.custo_total) || 0;
  const comprovado = { declarado, pago: Number(custo?.comprovado_pago) || 0, aberto: Number(custo?.comprovado_aberto) || 0 };
  const situacao = custo?.situacao ?? situacaoDoCusto(comprovado);

  const linhas = useMemo(() => titulos.map(t => {
    const doTitulo = rateios.filter(r => r.lancamento_id === t.id);
    const jaRateado = doTitulo.reduce((s, r) => s + r.valor, 0);
    const neste = pedido ? doTitulo.find(r => r.contrato_pedido_id === pedido.id) ?? null : null;
    const sobra = sobraDoTitulo({ valor: t.valor, jaRateado });
    const sugerida = parteSugerida({ valor: t.valor, jaRateado }, { declarado, comprovado: comprovado.pago + comprovado.aberto });
    return { t, jaRateado, neste, sobra, sugerida };
  }), [titulos, rateios, pedido, declarado, comprovado.pago, comprovado.aberto]);

  const atribuir = async (tituloId: string, valor: number) => {
    if (!pedido) return;
    if (!(valor > 0)) { toast.error('Informe a parte desta conta a pagar que é deste pedido'); return; }
    setSalvando(tituloId);
    const { error } = await supabase.rpc('ratear_lancamento_em_pedidos' as never, {
      p_lancamento_id: tituloId,
      p_rateios: [{ pedido_id: pedido.id, valor }],
      p_observacao: null,
    } as never);
    setSalvando(null);
    if (error) { toast.error('Não foi possível atribuir a compra ao pedido', { description: error.message }); return; }
    toast.success(`${fmtReais(valor)} atribuídos ao pedido ${pedido.numero_pedido}.`);
    await carregar();
    aoMudar();
  };

  const desfazer = async (rateio: Rateio) => {
    const m = (motivo[rateio.id] ?? '').trim();
    if (m.length < 5) { toast.error('Informe o motivo para desfazer (mínimo de 5 caracteres)'); return; }
    setSalvando(rateio.id);
    const { error } = await supabase.rpc('desfazer_rateio' as never, { p_rateio_id: rateio.id, p_motivo: m } as never);
    setSalvando(null);
    if (error) { toast.error('Não foi possível desfazer', { description: error.message }); return; }
    toast.success('Atribuição desfeita.');
    await carregar();
    aoMudar();
  };

  if (!pedido) return null;

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 aria-hidden="true" className="h-5 w-5 text-muted-foreground" />
            Compras do pedido {pedido.numero_pedido}
          </DialogTitle>
          <DialogDescription>
            As contas a pagar atribuídas ao contrato, e a parte de cada uma que é deste pedido. É o custo comprovado.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border bg-secondary p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-0.5">
              <p><span className="text-muted-foreground">Declarado no pedido:</span> <b className="tabular-nums">{declarado > 0 ? fmtReais(declarado) : '—'}</b></p>
              <p><span className="text-muted-foreground">Comprovado:</span> <b className="tabular-nums">{fmtReais(comprovado.pago + comprovado.aberto)}</b>
                {comprovado.aberto > 0 && <span className="text-muted-foreground"> ({fmtReais(comprovado.aberto)} ainda a pagar)</span>}
              </p>
            </div>
            <SeloSituacao tom={ROTULO_SITUACAO[situacao].tom}>{ROTULO_SITUACAO[situacao].rotulo}</SeloSituacao>
          </div>
          <p className="g-meta text-muted-foreground mt-2">{fraseDaCobertura(comprovado, situacao)}</p>
        </div>

        {carregando ? (
          <div role="status" className="space-y-2">
            <span className="sr-only">Carregando as contas a pagar do contrato…</span>
            <Skeleton className="h-16" /><Skeleton className="h-16" />
          </div>
        ) : titulos.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma conta a pagar está atribuída a este contrato. Atribua em Financeiro › Contas a Pagar (ícone de elo, "Atribuir a um contrato") e volte aqui para destinar a parte deste pedido.
          </p>
        ) : (
          <ul className="space-y-2">
            {linhas.map(({ t, jaRateado, neste, sobra, sugerida }) => (
              <li key={t.id} className="rounded-md border border-input bg-card p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{t.descricao || 'Conta a pagar'}</p>
                    <p className="g-meta text-muted-foreground">
                      {t.numero_documento ? `Doc. ${t.numero_documento} · ` : ''}{dataBr(t.data_competencia)}
                      {' · '}<Badge variant={PAGO.has(t.status) ? 'success' : 'warning'}>{PAGO.has(t.status) ? 'paga' : 'em aberto'}</Badge>
                    </p>
                  </div>
                  <div className="text-right tabular-nums">
                    <p className="font-semibold">{fmtReais(t.valor)}</p>
                    <p className="g-meta text-muted-foreground">
                      {jaRateado > 0 ? `${fmtReais(jaRateado)} já em pedidos · ` : ''}sobra {fmtReais(sobra)}
                    </p>
                  </div>
                </div>
                {neste ? (
                  <div className="mt-2 flex flex-wrap items-end gap-2">
                    <p className="text-success-ink">
                      <b className="tabular-nums">{fmtReais(neste.valor)}</b> deste título são deste pedido.
                    </p>
                    <div className="ml-auto flex items-end gap-2">
                      <div className="space-y-1">
                        <Label htmlFor={`motivo-${neste.id}`} className="g-meta">Motivo para desfazer</Label>
                        <Input id={`motivo-${neste.id}`} className="h-8 w-56" value={motivo[neste.id] ?? ''}
                          onChange={e => setMotivo(m => ({ ...m, [neste.id]: e.target.value }))} placeholder="mínimo de 5 caracteres" />
                      </div>
                      <Button size="sm" variant="outline" disabled={salvando === neste.id} onClick={() => void desfazer(neste)}>
                        <Undo2 aria-hidden="true" /> Desfazer
                      </Button>
                    </div>
                  </div>
                ) : sobra > 0 ? (
                  <div className="mt-2 flex flex-wrap items-end gap-2">
                    <div className="space-y-1">
                      <Label htmlFor={`parte-${t.id}`} className="g-meta">Parte deste pedido (R$)</Label>
                      <MoneyInput id={`parte-${t.id}`} className="h-8 w-44" value={partes[t.id] ?? sugerida}
                        onValueChange={v => setPartes(p => ({ ...p, [t.id]: v }))} />
                    </div>
                    <Button size="sm" disabled={salvando === t.id} onClick={() => void atribuir(t.id, partes[t.id] ?? sugerida)}>
                      <Link2 aria-hidden="true" /> Atribuir a este pedido
                    </Button>
                    {sugerida < sobra && declarado > 0 && (
                      <p className="g-meta text-muted-foreground">sugerido: o que falta para cobrir o declarado</p>
                    )}
                  </div>
                ) : (
                  <p className="g-meta text-muted-foreground mt-2">Este título já está todo distribuído entre pedidos.</p>
                )}
              </li>
            ))}
          </ul>
        )}

        <p className="g-meta text-muted-foreground">
          A parte atribuída entra no custo comprovado do pedido e substitui o declarado até o valor coberto. O cruzamento recalcula a situação e avisa quem lançou primeiro.
        </p>
      </DialogContent>
    </Dialog>
  );
}
