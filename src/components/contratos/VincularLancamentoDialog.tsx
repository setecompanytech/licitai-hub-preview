import { useEffect, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Link2, Loader2, AlertTriangle, CheckCircle2, Unlink, Split, Undo2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  ordenarCandidatos, conferirSoma, quitacaoDoPedido,
  type PedidoParaCasar, type TituloCandidato,
} from '@/lib/contratos/casar-pedido';
import { podeRatear, disponivelParaRatear } from '@/lib/contratos/rateio';
import { deDataLocal } from '@/lib/financeiro/data-local';

/** Uma linha de rateio, como o banco guarda (tabela fora do types.ts gerado). */
type Rateio = { id: string; lancamento_id: string; contrato_pedido_id: string; valor: number; observacao: string | null };
type ConsultaRateios = {
  select: (c: string) => {
    in: (col: string, v: string[]) => Promise<{ data: Rateio[] | null; error: { message: string } | null }>;
    eq: (col: string, v: string) => Promise<{ data: Rateio[] | null; error: { message: string } | null }>;
  };
};
const tabelaRateios = () => supabase.from('financeiro_lancamento_rateios' as never) as unknown as ConsultaRateios;

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

type Props = {
  aberto: boolean;
  onFechar: () => void;
  contratoId: string;
  empresaId: string | null | undefined;
  pedido: PedidoParaCasar | null;
  aoVincular: () => void;
};

/**
 * Liga um pedido a lançamentos que JÁ existem no Financeiro.
 *
 * O caso que isto resolve: a empresa adere ao sistema com contrato em
 * andamento. Os pedidos antigos precisam ser cadastrados para que saldo e
 * consumo fiquem certos — mas os recebimentos deles já estão no Financeiro,
 * muitos já conciliados contra o extrato.
 *
 * Sem esta tela restavam três saídas ruins: gerar conta a receber e contar a
 * receita duas vezes; não gerar e deixar o título órfão do contrato; ou apagar
 * o título antigo e perder a conciliação bancária.
 *
 * Aqui não se cria nada. Casa-se — o mesmo movimento de
 * `useCasarTransferencia`, que resolveu esta classe de problema para
 * transferência entre contas próprias.
 */
export default function VincularLancamentoDialog({
  aberto, onFechar, contratoId, empresaId, pedido, aoVincular,
}: Props) {
  const [candidatos, setCandidatos] = useState<TituloCandidato[]>([]);
  const [escolhidos, setEscolhidos] = useState<Set<string>>(new Set());
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  // Rateio (22/09): o que cada candidato já distribuiu a outros pedidos, e o
  // que ESTE pedido já recebe por rateio — para a parte sair certa e para
  // dar como desfazer sem sair da tela.
  const [rateadoPorLancamento, setRateadoPorLancamento] = useState<Record<string, number>>({});
  const [rateiosDoPedido, setRateiosDoPedido] = useState<Rateio[]>([]);
  const [desfazendo, setDesfazendo] = useState<{ id: string; motivo: string } | null>(null);

  const carregar = useCallback(async () => {
    if (!pedido || !empresaId) return;
    setCarregando(true);
    // Traz os títulos a receber da empresa que ainda não pertencem a nenhum
    // pedido, MAIS os que já pertencem a este — para dar como desfazer um
    // vínculo errado sem sair da tela.
    const { data, error } = await supabase
      .from('financeiro_lancamentos')
      .select('id, descricao, valor, data_competencia, numero_documento, status, contrato_pedido_id, contrato_id')
      .eq('empresa_id', empresaId)
      .eq('tipo', 'a_receber')
      .or(`contrato_pedido_id.is.null,contrato_pedido_id.eq.${pedido.id}`)
      .order('data_competencia', { ascending: false })
      .limit(400);
    if (error) { setCarregando(false); toast.error('Não foi possível buscar os lançamentos', { description: error.message }); return; }

    const lista = (data ?? []) as unknown as TituloCandidato[];
    // Os rateios existentes. A tabela nasce de migration colada à mão: sem
    // ela a consulta falha, e a tela segue sem a função de ratear — não quebra.
    try {
      const colunas = 'id, lancamento_id, contrato_pedido_id, valor, observacao';
      const [dosCandidatos, doPedido] = await Promise.all([
        lista.length > 0
          ? tabelaRateios().select(colunas).in('lancamento_id', lista.map((t) => t.id))
          : Promise.resolve({ data: [] as Rateio[], error: null }),
        tabelaRateios().select(colunas).eq('contrato_pedido_id', pedido.id),
      ]);
      const soma: Record<string, number> = {};
      for (const r of dosCandidatos.data ?? []) soma[r.lancamento_id] = (soma[r.lancamento_id] ?? 0) + Number(r.valor);
      setRateadoPorLancamento(soma);
      setRateiosDoPedido(doPedido.data ?? []);
    } catch {
      setRateadoPorLancamento({});
      setRateiosDoPedido([]);
    }
    setCarregando(false);
    setCandidatos(lista);
    // Já vinculados começam marcados: a tela abre mostrando o estado atual,
    // não uma folha em branco que sugere que nada foi feito.
    setEscolhidos(new Set(lista.filter((t) => t.contrato_pedido_id === pedido.id).map((t) => t.id)));
  }, [pedido, empresaId]);

  /** Ratear: a parte deste recebimento que cabe neste pedido, pela RPC. */
  const ratear = async (t: TituloCandidato, parte: number) => {
    if (!pedido) return;
    setSalvando(true);
    const { data, error } = await supabase.rpc('ratear_lancamento_em_pedidos' as never, {
      p_lancamento_id: t.id,
      p_rateios: [{ pedido_id: pedido.id, valor: parte }],
      p_observacao: null,
    } as never);
    setSalvando(false);
    if (error) { toast.error('Não foi possível ratear', { description: error.message }); return; }
    const r = (data ?? {}) as { sobra?: number };
    toast.success(`${fmt(parte)} deste recebimento destinados ao pedido ${pedido.numero_pedido}.`, {
      description: Number(r.sobra) > 0
        ? `Sobram ${fmt(Number(r.sobra))} no recebimento para outros pedidos.`
        : 'O recebimento ficou todo distribuído.',
    });
    aoVincular();
    onFechar();
  };

  const confirmarDesfazer = async () => {
    if (!desfazendo) return;
    setSalvando(true);
    const { error } = await supabase.rpc('desfazer_rateio' as never, {
      p_rateio_id: desfazendo.id,
      p_motivo: desfazendo.motivo.trim(),
    } as never);
    setSalvando(false);
    if (error) { toast.error('Não foi possível desfazer o rateio', { description: error.message }); return; }
    toast.success('Rateio desfeito. A quitação do pedido foi recalculada.');
    setDesfazendo(null);
    aoVincular();
    void carregar();
  };

  useEffect(() => { if (aberto) void carregar(); }, [aberto, carregar]);

  if (!pedido) return null;

  const ordenados = ordenarCandidatos(pedido, candidatos);
  const selecionados = candidatos.filter((t) => escolhidos.has(t.id));
  const soma = conferirSoma(pedido, selecionados);
  const jaVinculados = candidatos.filter((t) => t.contrato_pedido_id === pedido.id).map((t) => t.id);

  const alternar = (id: string) =>
    setEscolhidos((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  /**
   * O restante da nota, quando os recebimentos selecionados não a cobrem:
   * nasce como título em aberto do pedido (parcela), apontando o primeiro
   * recebimento como origem — e os selecionados são vinculados em seguida.
   */
  const lancarRestante = async () => {
    if (!pedido || !empresaId || selecionados.length === 0 || soma.diferenca >= -0.005) return;
    const restante = Math.round(-soma.diferenca * 100) / 100;
    const nota = (pedido as { nota_fiscal?: string | null }).nota_fiscal ?? null;
    setSalvando(true);
    const { error } = await supabase.from('financeiro_lancamentos').insert({
      empresa_id: empresaId,
      tipo: 'a_receber', natureza: 'receita', status: 'previsto',
      descricao: `Pedido ${pedido.numero_pedido}${nota ? ` — restante da NF ${nota}` : ' — restante'}`,
      valor: restante,
      data_competencia: pedido.data_pedido ?? new Date().toISOString().slice(0, 10),
      numero_documento: nota,
      contrato_id: contratoId, contrato_pedido_id: pedido.id,
      parcela_pai_id: selecionados[0].id,
      origem: 'manual', origem_tipo: 'manual', origem_job: 'VincularLancamentoDialog.lancarRestante',
      origem_timestamp: new Date().toISOString(),
      observacoes: `Restante do pedido ${pedido.numero_pedido}: ${fmt(soma.soma)} já recebidos em ${selecionados.length} título(s); ${fmt(restante)} em aberto.`,
    } as never);
    if (error) { setSalvando(false); toast.error('Não foi possível lançar o restante', { description: error.message }); return; }
    toast.success(`${fmt(restante)} lançados em aberto como parcela do pedido ${pedido.numero_pedido}.`);
    await salvar();
  };

  const salvar = async () => {
    setSalvando(true);
    const paraLigar = [...escolhidos];
    const paraSoltar = jaVinculados.filter((id) => !escolhidos.has(id));

    // Solta primeiro: se um título saiu da seleção, ele deixa de ser deste
    // pedido antes que a quitação seja recalculada com ele dentro.
    if (paraSoltar.length > 0) {
      const { error } = await supabase
        .from('financeiro_lancamentos')
        .update({ contrato_pedido_id: null } as never)
        .in('id', paraSoltar);
      if (error) { setSalvando(false); toast.error('Erro ao desvincular', { description: error.message }); return; }
    }

    if (paraLigar.length > 0) {
      const { error } = await supabase
        .from('financeiro_lancamentos')
        .update({ contrato_pedido_id: pedido.id, contrato_id: contratoId } as never)
        .in('id', paraLigar);
      if (error) { setSalvando(false); toast.error('Erro ao vincular', { description: error.message }); return; }
    }

    // A quitação volta do título para o pedido. Sem isto o vínculo conserta o
    // relatório do contrato e deixa a meta de quitação cega. Com rateio no
    // pedido, quem manda é o gatilho do banco, que enxerga os dois caminhos.
    const q = quitacaoDoPedido(selecionados);
    const { error: errPedido } = rateiosDoPedido.length > 0
      ? { error: null }
      : await supabase
          .from('contrato_pedidos')
          .update({ nf_quitada: q.nf_quitada, data_quitacao: q.data_quitacao } as never)
          .eq('id', pedido.id);

    setSalvando(false);
    if (errPedido) { toast.error('Vínculo salvo, mas a quitação não voltou ao pedido', { description: errPedido.message }); }
    else {
      toast.success(
        paraLigar.length > 0
          ? `${paraLigar.length} lançamento(s) vinculado(s) ao pedido ${pedido.numero_pedido}.`
          : 'Vínculos removidos.',
        { description: q.nf_quitada ? `Pedido marcado como quitado em ${deDataLocal(q.data_quitacao!).toLocaleDateString('pt-BR')}.` : undefined },
      );
    }
    aoVincular();
    onFechar();
  };

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
      {/* A rolagem é da LISTA, não do diálogo: com o diálogo inteiro rolando,
          o rodapé descia junto e a barra de rolagem cortava o botão
          "Remover vínculos" (print de 08/09). Fixos, aviso e botões ficam
          sempre à vista — sem rolar até o fim para agir. */}
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
            Vincular a lançamento existente
          </DialogTitle>
          <DialogDescription>
            Pedido <strong>{pedido.numero_pedido}</strong> · {fmt(pedido.valor_total)}
            {pedido.data_pedido && ` · ${deDataLocal(pedido.data_pedido).toLocaleDateString('pt-BR')}`}
            <br />
            Para pedido retroativo, cujo recebimento já está no Financeiro. Nada
            é criado aqui — o lançamento que já existe passa a pertencer a este
            pedido.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        {/* O que este pedido já recebe por rateio — e como desfazer, com motivo. */}
        {!carregando && rateiosDoPedido.length > 0 && (
          <div className="mb-2 rounded-lg border border-success-line bg-success-tint p-3 text-sm">
            <p className="font-medium text-success-ink">
              Este pedido recebe {fmt(rateiosDoPedido.reduce((s, r) => s + Number(r.valor), 0))} por rateio de recebimento
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Pedido recebido por rateio não ganha título próprio — seria o mesmo dinheiro duas vezes. A nota dele anexa-se ao
              recebimento que o pagou: Financeiro › Contas a Receber › Extração de documentos → "Anexar como parte".
            </p>
            <ul className="mt-1 space-y-1">
              {rateiosDoPedido.map((r) => {
                const lanc = candidatos.find((t) => t.id === r.lancamento_id);
                return (
                  <li key={r.id} className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="tabular-nums font-medium text-foreground">{fmt(Number(r.valor))}</span>
                    <span className="truncate">{lanc?.descricao ?? `lançamento ${r.lancamento_id.slice(0, 8)}`}</span>
                    {desfazendo?.id === r.id ? (
                      <span className="flex flex-wrap items-center gap-1">
                        <Input
                          value={desfazendo.motivo}
                          onChange={(e) => setDesfazendo({ id: r.id, motivo: e.target.value })}
                          placeholder="Motivo (mínimo 5 caracteres)"
                          className="h-8 w-56"
                          aria-label="Motivo para desfazer o rateio"
                        />
                        <Button size="sm" variant="outline" disabled={salvando || desfazendo.motivo.trim().length < 5} onClick={() => void confirmarDesfazer()}>
                          Confirmar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setDesfazendo(null)}>Cancelar</Button>
                      </span>
                    ) : (
                      <Button size="sm" variant="ghost" className="h-7 gap-1 px-2" onClick={() => setDesfazendo({ id: r.id, motivo: '' })}>
                        <Undo2 aria-hidden="true" className="h-3.5 w-3.5" /> Desfazer rateio
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {carregando ? (
          <div className="space-y-2 py-2" aria-busy="true" aria-label="Procurando lançamentos">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : ordenados.length === 0 ? (
          <div className="py-8 text-sm text-muted-foreground">
            Nenhum lançamento a receber disponível para vincular. Ou todos já
            pertencem a outros pedidos, ou o recebimento ainda não foi lançado
            no Financeiro.
          </div>
        ) : (
          <div className="space-y-1.5">
            {ordenados.map((t) => {
              // Rateio (22/09): recebimento MAIOR que o pedido, baixado e sem
              // dono, entrega só a parte deste pedido e continua inteiro no
              // banco. Recebimento já rateado a alguém não vira vínculo 1↔1.
              const rateado = rateadoPorLancamento[t.id] ?? 0;
              const recebimento = { id: t.id, status: t.status, valor: Number(t.valor), contrato_pedido_id: t.contrato_pedido_id, rateado };
              const pedidoRateavel = {
                id: pedido.id,
                valor_total: pedido.valor_total,
                recebidoPorRateio: rateiosDoPedido.reduce((s, r) => s + Number(r.valor), 0),
                temTituloProprio: jaVinculados.length > 0,
              };
              const rateio = Number(t.valor) > pedido.valor_total + 0.005 ? podeRatear(recebimento, pedidoRateavel) : null;
              const bloqueadoPorRateio = rateado > 0;
              return (
              <label
                key={t.id}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors duration-150 ${
                  escolhidos.has(t.id) ? 'border-primary bg-primary-tint' : 'border-border hover:bg-muted'
                }`}
              >
                <Checkbox
                  checked={escolhidos.has(t.id)}
                  onCheckedChange={() => alternar(t.id)}
                  disabled={(bloqueadoPorRateio) || (rateiosDoPedido.length > 0 && t.contrato_pedido_id !== pedido.id)}
                  // Pedido já recebido por rateio (22/09): título próprio duplicaria
                  // o recebimento. O banco recusa; a tela nem oferece.
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="truncate text-sm font-medium text-foreground" title={t.descricao}>{t.descricao}</span>
                    <span className="text-sm font-semibold tabular-nums">{fmt(Number(t.valor))}</span>
                    <Badge variant="muted">{t.status}</Badge>
                    {t.contrato_pedido_id === pedido.id && (
                      <Badge variant="success">já vinculado</Badge>
                    )}
                    {bloqueadoPorRateio && (
                      <Badge variant="info">rateado · disponível {fmt(disponivelParaRatear(recebimento))}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t.data_competencia && deDataLocal(t.data_competencia).toLocaleDateString('pt-BR')}
                    {/* Os motivos ficam à vista: sugestão sem justificativa
                        vira carimbo automático, e quem decide precisa poder
                        discordar com base em algo. */}
                    {t.motivos.length > 0 && <> · {t.motivos.join(' · ')}</>}
                  </p>
                  {rateio && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      {rateio.pode === false ? (
                        <span className="text-xs text-muted-foreground">Não rateia: {rateio.motivo}.</span>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 px-2"
                          disabled={salvando}
                          onClick={(e) => { e.preventDefault(); void ratear(t, rateio.parte); }}
                          title="O recebimento é maior que o pedido: destina só a parte deste pedido e continua inteiro na conciliação"
                        >
                          <Split aria-hidden="true" className="h-3.5 w-3.5" /> Ratear {fmt(rateio.parte)} para este pedido
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </label>
              );
            })}
          </div>
        )}
        </div>

        {/* A conferência da soma avisa e não bloqueia: desconto, retenção e
            glosa fazem a soma divergir legitimamente. */}
        <div
          className={`flex shrink-0 items-start gap-2 rounded-lg border p-3 text-sm ${
            soma.fecha ? 'border-success-line bg-success-tint' : 'border-warning-line bg-warning-tint'
          }`}
        >
          {soma.fecha
            ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-success-ink" />
            : <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-warning-ink" />}
          <div>
            <p className={soma.fecha ? 'text-success-ink' : 'text-warning-ink'}>{soma.frase}</p>
            {selecionados.length > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                Selecionado {fmt(soma.soma)} · pedido {fmt(pedido.valor_total)}
              </p>
            )}
            {/* Fracionado (22/09): a nota paga em duas vezes. O que já entrou
                casa agora; o que falta vira parcela em aberto do mesmo pedido,
                e a quitação só fecha quando ela também for paga. */}
            {!soma.fecha && soma.diferenca < -0.005 && selecionados.length > 0 && (
              <Button size="sm" variant="outline" className="mt-2" disabled={salvando} onClick={() => void lancarRestante()}>
                <Split aria-hidden="true" /> Lançar {fmt(-soma.diferenca)} como parcela em aberto e vincular
              </Button>
            )}
          </div>
        </div>

        <div className="shrink-0 flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button
            onClick={salvar}
            disabled={salvando || (escolhidos.size === 0 && jaVinculados.length === 0) || (rateiosDoPedido.length > 0 && escolhidos.size > 0)}
          >
            {salvando ? <Loader2 aria-hidden="true" className="animate-spin" />
              : escolhidos.size === 0 ? <Unlink aria-hidden="true" />
              : <Link2 aria-hidden="true" />}
            {escolhidos.size === 0 ? 'Remover vínculos' : `Vincular ${escolhidos.size}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
