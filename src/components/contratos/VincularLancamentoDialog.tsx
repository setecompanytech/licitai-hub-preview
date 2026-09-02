import { useEffect, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Link2, Loader2, AlertTriangle, CheckCircle2, Unlink } from 'lucide-react';
import {
  ordenarCandidatos, conferirSoma, quitacaoDoPedido,
  type PedidoParaCasar, type TituloCandidato,
} from '@/lib/contratos/casar-pedido';
import { deDataLocal } from '@/lib/financeiro/data-local';

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
    setCarregando(false);
    if (error) { toast.error('Não foi possível buscar os lançamentos', { description: error.message }); return; }

    const lista = (data ?? []) as unknown as TituloCandidato[];
    setCandidatos(lista);
    // Já vinculados começam marcados: a tela abre mostrando o estado atual,
    // não uma folha em branco que sugere que nada foi feito.
    setEscolhidos(new Set(lista.filter((t) => t.contrato_pedido_id === pedido.id).map((t) => t.id)));
  }, [pedido, empresaId]);

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
    // relatório do contrato e deixa a meta de quitação cega.
    const q = quitacaoDoPedido(selecionados);
    const { error: errPedido } = await supabase
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
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-4 h-4" />
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

        {carregando ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" /> Procurando lançamentos…
          </div>
        ) : ordenados.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Nenhum lançamento a receber disponível para vincular. Ou todos já
            pertencem a outros pedidos, ou o recebimento ainda não foi lançado
            no Financeiro.
          </div>
        ) : (
          <div className="space-y-1.5">
            {ordenados.map((t) => (
              <label
                key={t.id}
                className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                  escolhidos.has(t.id) ? 'border-primary/40 bg-primary/5' : 'border-border hover:bg-muted/40'
                }`}
              >
                <Checkbox checked={escolhidos.has(t.id)} onCheckedChange={() => alternar(t.id)} className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate" title={t.descricao}>{t.descricao}</span>
                    <span className="text-sm font-semibold tabular-nums">{fmt(Number(t.valor))}</span>
                    <Badge variant="outline" className="text-xs">{t.status}</Badge>
                    {t.contrato_pedido_id === pedido.id && (
                      <Badge className="text-xs bg-primary/10 text-primary border-primary/30">já vinculado</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t.data_competencia && deDataLocal(t.data_competencia).toLocaleDateString('pt-BR')}
                    {/* Os motivos ficam à vista: sugestão sem justificativa
                        vira carimbo automático, e quem decide precisa poder
                        discordar com base em algo. */}
                    {t.motivos.length > 0 && <> · {t.motivos.join(' · ')}</>}
                  </p>
                </div>
              </label>
            ))}
          </div>
        )}

        {/* A conferência da soma avisa e não bloqueia: desconto, retenção e
            glosa fazem a soma divergir legitimamente. */}
        <div
          className={`rounded-lg border p-3 text-sm flex items-start gap-2 ${
            soma.fecha ? 'border-success/40 bg-success/5' : 'border-warning/40 bg-warning/5'
          }`}
        >
          {soma.fecha
            ? <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
            : <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />}
          <div>
            <p className={soma.fecha ? 'text-success' : 'text-warning'}>{soma.frase}</p>
            {selecionados.length > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                Selecionado {fmt(soma.soma)} · pedido {fmt(pedido.valor_total)}
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onFechar}>Cancelar</Button>
          <Button
            size="sm"
            onClick={salvar}
            disabled={salvando || (escolhidos.size === 0 && jaVinculados.length === 0)}
          >
            {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
              : escolhidos.size === 0 ? <Unlink className="w-3.5 h-3.5 mr-1.5" />
              : <Link2 className="w-3.5 h-3.5 mr-1.5" />}
            {escolhidos.size === 0 ? 'Remover vínculos' : `Vincular ${escolhidos.size}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
