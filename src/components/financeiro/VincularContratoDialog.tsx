import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, Link2, AlertTriangle } from 'lucide-react';
import {
  ordenarContratos, pedidoAPartirDoLancamento, sugerirItem, PONTOS_PARA_PRESELECIONAR,
  type LancamentoParaVincular, type ContratoCandidato,
} from '@/lib/contratos/pedido-do-lancamento';
import { parseNFeXML } from '@/lib/parseNFe';
import { quantidadeDaNota } from '@/lib/financeiro/nfe-para-lancamento';
import { avaliarCabimento } from '@/lib/contratos/cabimento';
import { quitacaoDoPedido } from '@/lib/contratos/casar-pedido';
import { proximoNumeroDePedido } from '@/lib/contratos/numero-do-pedido';

/**
 * Ligar um lançamento já existente ao contrato que o originou.
 *
 * O vínculo `contrato_pedido_id` sempre existiu, mas só era alcançável a
 * partir do PEDIDO — o que pressupõe que o pedido veio primeiro. Contrato que
 * entra na gestão depois de meses de faturamento tem dezenas de lançamentos e
 * nenhum pedido, e a porta existente exigia justamente o que ainda não existe.
 *
 * Aqui a ordem se inverte: o lançamento é o ponto de partida, e o pedido pode
 * ser criado a partir dele. Quem está olhando a nota é quem sabe a que
 * contrato ela pertence.
 *
 * ── O que este diálogo NÃO faz ─────────────────────────────────────────────
 *
 * Não sobe arquivo. A NF-e já tem um lugar só — `financeiro_documentos_fiscais`
 * — e ele é alcançável pelo clipe na linha do lançamento e pelo faturamento em
 * Gestão. Um terceiro caminho de upload criaria a mesma nota em dois lugares,
 * e duas autoridades sobre o mesmo número é o defeito que este sistema já
 * pagou caro para descobrir.
 */

type ItemDoContrato = {
  id: string; descricao: string; codigo_item: string | null;
  quantidade_contratada: number | null; quantidade_consumida: number | null;
  saldo_quantitativo: number | null;
  valor_unitario: number | null;
  /** Nasce na migration 20260830000003 — ainda não está no types.ts gerado. */
  cota: string | null;
};

type PedidoExistente = {
  id: string; numero_pedido: string; descricao: string | null;
  valor_total: number; data_pedido: string | null;
};

type Props = {
  lancamento: LancamentoParaVincular | null;
  onFechar: () => void;
  onVinculado?: () => void;
  /**
   * 'receita' liga a nota a um pedido — a entrega que ela cobra.
   * 'despesa' liga a compra ao CONTRATO, e só. Comprar não é entregar: um
   * pagamento a fornecedor não representa entrega nenhuma ao órgão, e criar
   * pedido a partir dele consumiria saldo de contrato por causa de uma compra.
   */
  modo?: 'receita' | 'despesa';
};

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function VincularContratoDialog({
  lancamento, onFechar, onVinculado, modo: modoDoLancamento = 'receita',
}: Props) {
  const ehDespesa = modoDoLancamento === 'despesa';
  const { empresaAtiva } = useEmpresa();
  const { user } = useAuth();

  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [contratos, setContratos] = useState<ContratoCandidato[]>([]);
  const [contratoId, setContratoId] = useState('');

  const [pedidos, setPedidos] = useState<PedidoExistente[]>([]);
  const [itens, setItens] = useState<ItemDoContrato[]>([]);
  const [empenhos, setEmpenhos] = useState<Array<{ id: string; numero: string; tipo: string }>>([]);
  const [saldoDoContrato, setSaldoDoContrato] = useState<number | null>(null);

  /** 'existente' liga a um pedido que já está lá; 'novo' cria a partir da nota. */
  const [modo, setModo] = useState<'existente' | 'novo'>('novo');
  const [pedidoEscolhido, setPedidoEscolhido] = useState('');

  const [itemId, setItemId] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [cota, setCota] = useState('');
  const [empenhoId, setEmpenhoId] = useState('');
  const [numeroPedido, setNumeroPedido] = useState('');
  /** O que o XML da nota diz — quando ele foi anexado e é legível. */
  const [daNota, setDaNota] = useState<{
    total: number;
    linhas: Array<{ descricao: string; quantidade: number; unitario: number }>;
  } | null>(null);

  const aberto = !!lancamento;

  // ── Os contratos, ordenados por probabilidade ────────────────────────────
  useEffect(() => {
    if (!aberto || !empresaAtiva?.id || !lancamento) return;
    let vivo = true;
    setCarregando(true);
    supabase
      .from('contratos')
      .select('id, numero_contrato, objeto, orgao_contratante, saldo_remanescente')
      .eq('empresa_id', empresaAtiva.id)
      .order('created_at', { ascending: false })
      .limit(300)
      .then(({ data, error }) => {
        if (!vivo) return;
        setCarregando(false);
        if (error) { toast.error('Não foi possível listar os contratos', { description: error.message }); return; }
        const ordenados = ordenarContratos(lancamento, (data ?? []) as unknown as ContratoCandidato[]);
        setContratos(ordenados);
        // Só pré-seleciona quando o sinal é forte. Escolher por palpite fraco
        // faz a pessoa confirmar sem olhar — e o vínculo errado é pior do que
        // o vínculo não feito, porque ninguém volta a conferi-lo.
        if (ordenados[0] && ordenados[0].pontos >= PONTOS_PARA_PRESELECIONAR) {
          setContratoId(ordenados[0].id);
        }
      });
    return () => { vivo = false; };
  }, [aberto, empresaAtiva?.id, lancamento]);

  // ── A quantidade vem da nota, não de uma conta de cabeça ─────────────────
  //
  // R$ 30.960,00 a R$ 0,43 são 72.000 unidades. Essa divisão não deveria ser
  // de quem cadastra: o XML traz `qCom` por item, com fé pública. Quando ele
  // foi anexado, a quantidade chega preenchida e com a procedência à vista.
  useEffect(() => {
    if (!aberto || !lancamento) { setDaNota(null); return; }
    let vivo = true;
    supabase
      .from('financeiro_documentos_fiscais' as never)
      .select('arquivo_xml')
      .eq('lancamento_id', lancamento.id)
      .limit(1)
      .then(({ data }) => {
        const xml = (data as unknown as Array<{ arquivo_xml: string | null }> | null)?.[0]?.arquivo_xml;
        if (!vivo || !xml) return;
        try {
          const lido = quantidadeDaNota(parseNFeXML(xml));
          if (!vivo || lido.total <= 0) return;
          setDaNota(lido);
          setQuantidade(String(lido.total));
        } catch { /* XML ilegível: a quantidade continua sendo digitada */ }
      });
    return () => { vivo = false; };
  }, [aberto, lancamento]);

  // A linha da nota aponta o item do contrato. Só sugere com parecença forte:
  // confirmar uma sugestão fraca consome o saldo do item errado, e esse erro
  // ninguém volta a conferir.
  useEffect(() => {
    if (!daNota || itens.length === 0 || itemId) return;
    const sugerido = sugerirItem(daNota.linhas[0]?.descricao ?? '', itens);
    if (sugerido) setItemId(sugerido);
  }, [daNota, itens, itemId]);

  // ── O que o contrato escolhido oferece ───────────────────────────────────
  useEffect(() => {
    if (!contratoId) { setPedidos([]); setItens([]); setEmpenhos([]); setSaldoDoContrato(null); return; }
    let vivo = true;
    (async () => {
      const [ped, its, ctr] = await Promise.all([
        supabase.from('contrato_pedidos')
          .select('id, numero_pedido, descricao, valor_total, data_pedido')
          .eq('contrato_id', contratoId).order('data_pedido', { ascending: false }).limit(200),
        supabase.from('contrato_itens')
          .select('id, descricao, codigo_item, quantidade_contratada, quantidade_consumida, saldo_quantitativo, valor_unitario, cota')
          .eq('contrato_id', contratoId).limit(300),
        supabase.from('contratos').select('saldo_remanescente').eq('id', contratoId).single(),
      ]);
      if (!vivo) return;
      const listaPedidos = (ped.data ?? []) as unknown as PedidoExistente[];
      setPedidos(listaPedidos);
      setItens((its.data ?? []) as unknown as ItemDoContrato[]);
      setSaldoDoContrato(Number((ctr.data as { saldo_remanescente?: number } | null)?.saldo_remanescente ?? 0));
      setNumeroPedido(proximoNumeroDePedido(listaPedidos.map(p => p.numero_pedido)));
      // Sem pedido nenhum, "ligar a um existente" não é opção — e é
      // exatamente o caso que motivou esta tela.
      setModo(listaPedidos.length > 0 ? 'existente' : 'novo');

      // Consulta tolerante: as tabelas de empenho vêm de migration colada à
      // mão, e sem elas a tela apenas não oferece a escolha.
      const { data: emps } = await supabase
        .from('contrato_empenhos' as never)
        .select('id, numero, tipo')
        .eq('contrato_id', contratoId);
      if (vivo) setEmpenhos((emps ?? []) as unknown as Array<{ id: string; numero: string; tipo: string }>);
    })();
    return () => { vivo = false; };
  }, [contratoId]);

  // A cota do item escolhido manda: ela nasce no item, e o pedido a herda.
  useEffect(() => {
    const item = itens.find(i => i.id === itemId);
    if (item?.cota) setCota(item.cota);
  }, [itemId, itens]);

  const cabimento = useMemo(() => {
    if (!lancamento || modo !== 'novo') return null;
    const qtd = parseFloat(quantidade) || 0;
    if (!qtd) return null;
    const item = itens.find(i => i.id === itemId);
    return avaliarCabimento(
      { quantidade: qtd, valor: Number(lancamento.valor) || 0 },
      {
        item: item?.saldo_quantitativo != null
          ? { rotulo: `item ${item.codigo_item ?? ''}`.trim(), saldoQtd: Number(item.saldo_quantitativo) }
          : null,
        contrato: { saldoValor: saldoDoContrato },
      },
    );
  }, [lancamento, modo, quantidade, itemId, itens, saldoDoContrato]);

  const fechar = () => {
    setContratoId(''); setPedidoEscolhido(''); setItemId(''); setQuantidade('');
    setCota(''); setEmpenhoId(''); setNumeroPedido(''); setContratos([]); setDaNota(null);
    onFechar();
  };

  const salvar = async () => {
    if (!lancamento || !contratoId) return;
    setSalvando(true);

    // ── Despesa: atribui e para por aqui ────────────────────────────────────
    //
    // O custo passa a existir UMA vez, no Financeiro, com o contrato apontado.
    // Não é copiado para `contrato_custos` — foi essa cópia que criou dois
    // livros do mesmo dinheiro. `contrato_custo_realizado` soma daqui.
    if (ehDespesa) {
      const { error: errDespesa } = await supabase
        .from('financeiro_lancamentos')
        .update({ contrato_id: contratoId } as never)
        .eq('id', lancamento.id);
      setSalvando(false);
      if (errDespesa) { toast.error('Não foi possível atribuir', { description: errDespesa.message }); return; }
      const escolhido = contratos.find(c => c.id === contratoId);
      toast.success(`Despesa atribuída ao contrato ${escolhido?.numero_contrato ?? ''}.`, {
        description: 'Ela passa a compor o custo — e a margem — deste contrato.',
      });
      onVinculado?.();
      fechar();
      return;
    }

    let pedidoId = pedidoEscolhido;

    if (modo === 'novo') {
      if (!numeroPedido.trim()) { setSalvando(false); toast.error('Informe o número do pedido'); return; }
      const novo = pedidoAPartirDoLancamento(lancamento, {
        contratoId,
        numeroPedido: numeroPedido.trim(),
        itemId,
        quantidade: parseFloat(quantidade) || 0,
        cota,
        empenhoId,
      });
      const { data, error } = await supabase
        .from('contrato_pedidos')
        .insert({ ...novo, user_id: user!.id } as never)
        .select('id')
        .single();
      if (error) {
        setSalvando(false);
        toast.error('Não foi possível criar o pedido', { description: error.message });
        return;
      }
      pedidoId = (data as unknown as { id: string }).id;
    }

    if (!pedidoId) { setSalvando(false); toast.error('Escolha o pedido'); return; }

    // ── O número da nota tem de chegar ao pedido ────────────────────────────
    //
    // A Gestão não guarda cópia da NF-e: ela acha o documento pelo NÚMERO
    // gravado em `contrato_pedidos.nota_fiscal`. Ligar o título a um pedido
    // sem número deixa o vínculo financeiro certo e a coluna "NF-e Financeiro"
    // vazia — a nota existe, está guardada, e não aparece onde é procurada.
    //
    // Só preenche quando está EM BRANCO. Sobrescrever a nota de um pedido que
    // já tem uma seria reescrever referência fiscal em silêncio, e o pedido
    // passaria a apontar para um documento que não é o dele.
    if (modo === 'existente' && lancamento.numero_documento) {
      const escolhido = pedidos.find(p => p.id === pedidoId);
      const { data: atual } = await supabase
        .from('contrato_pedidos').select('nota_fiscal').eq('id', pedidoId).single();
      if (!(atual as { nota_fiscal?: string | null } | null)?.nota_fiscal) {
        await supabase
          .from('contrato_pedidos')
          .update({ nota_fiscal: lancamento.numero_documento } as never)
          .eq('id', pedidoId);
      } else if ((atual as { nota_fiscal?: string | null }).nota_fiscal !== lancamento.numero_documento) {
        // Divergência não se resolve sozinha: pode ser entrega faturada em
        // duas notas, e pode ser o pedido errado. Quem tem os papéis decide.
        toast.warning(
          `O pedido ${escolhido?.numero_pedido ?? ''} já aponta para a nota `
          + `${(atual as { nota_fiscal?: string | null }).nota_fiscal}.`,
          { description: 'O vínculo foi feito, mas o número da nota no pedido não foi alterado.' },
        );
      }
    }

    // O lançamento passa a apontar para o pedido. `contrato_id` vai junto:
    // é por ele que o contrato soma o que já foi faturado, e deixá-lo em
    // branco faria o pedido existir sem o título aparecer no contrato.
    const { error } = await supabase
      .from('financeiro_lancamentos')
      .update({ contrato_pedido_id: pedidoId, contrato_id: contratoId } as never)
      .eq('id', lancamento.id);
    if (error) { setSalvando(false); toast.error('Não foi possível vincular', { description: error.message }); return; }

    // ── A quitação volta do título para o pedido ─────────────────────────
    //
    // Lançamento CONCILIADO é dinheiro que já entrou. Ligá-lo a um pedido que
    // segue marcado como não quitado deixa o contrato certo e a meta de
    // quitação cega — e é justamente o caso mais comum aqui, porque o motivo
    // de o lançamento existir antes do pedido costuma ser que ele já foi pago.
    //
    // Recalculado sobre TODOS os títulos do pedido, não só sobre este: com
    // parcelas, o pedido só está pago quando não falta nenhuma.
    const { data: irmaos } = await supabase
      .from('financeiro_lancamentos')
      .select('status, data_competencia')
      .eq('contrato_pedido_id', pedidoId);
    const q = quitacaoDoPedido((irmaos ?? []) as Array<{ status: string; data_competencia: string | null }>);
    const { error: errQuitacao } = await supabase
      .from('contrato_pedidos')
      .update({ nf_quitada: q.nf_quitada, data_quitacao: q.data_quitacao } as never)
      .eq('id', pedidoId);
    setSalvando(false);
    if (errQuitacao) {
      toast.error('Vínculo salvo, mas a quitação não voltou ao pedido', { description: errQuitacao.message });
    }

    toast.success(
      modo === 'novo'
        ? `Pedido ${numeroPedido} criado e vinculado — o saldo do contrato já reflete esta nota.`
        : 'Lançamento vinculado ao pedido.',
      { description: q.nf_quitada ? 'Pedido marcado como quitado: o título já está conciliado.' : undefined },
    );
    onVinculado?.();
    fechar();
  };

  if (!lancamento) return null;

  const semItens = itens.length === 0;

  return (
    <Dialog open={aberto} onOpenChange={(v) => { if (!v) fechar(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Link2 className="w-4 h-4 text-muted-foreground" />
            {ehDespesa ? 'Atribuir esta despesa a um contrato' : 'Vincular a um contrato'}
          </DialogTitle>
        </DialogHeader>

        <Card className="p-3 bg-muted/40">
          <p className="text-sm font-medium">{lancamento.descricao}</p>
          <div className="flex gap-4 text-xs text-muted-foreground mt-1 flex-wrap">
            <span>{brl(Number(lancamento.valor) || 0)}</span>
            {lancamento.numero_documento && <span>NF {lancamento.numero_documento}</span>}
            {lancamento.data_emissao && (
              <span>emitida em {new Date(lancamento.data_emissao + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
            )}
          </div>
        </Card>

        <div>
          <Label className="text-xs">Contrato</Label>
          {carregando ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> procurando contratos…
            </div>
          ) : (
            <Select value={contratoId} onValueChange={setContratoId}>
              <SelectTrigger><SelectValue placeholder="Escolha o contrato" /></SelectTrigger>
              <SelectContent>
                {contratos.map(c => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">
                    {c.numero_contrato ?? 'sem número'}
                    {c.orgao_contratante && ` · ${c.orgao_contratante.slice(0, 40)}`}
                    {' — '}{(c.objeto ?? '').slice(0, 45)}
                    {(c as { pontos?: number }).pontos! >= PONTOS_PARA_PRESELECIONAR && ' ·  provável'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {contratoId && ehDespesa && (
          <p className="text-xs text-muted-foreground">
            A despesa passa a compor o <b>custo</b> deste contrato — e a margem que o Dashboard
            mostra. Ela continua sendo o mesmo lançamento: nada é copiado, e o valor não muda.
          </p>
        )}

        {contratoId && !ehDespesa && (
          <>
            <div className="flex gap-2">
              <Button size="sm" variant={modo === 'existente' ? 'secondary' : 'ghost'}
                onClick={() => setModo('existente')} disabled={pedidos.length === 0}>
                Ligar a um pedido existente {pedidos.length > 0 && `(${pedidos.length})`}
              </Button>
              <Button size="sm" variant={modo === 'novo' ? 'secondary' : 'ghost'}
                onClick={() => setModo('novo')}>
                Criar o pedido a partir desta nota
              </Button>
            </div>

            {modo === 'existente' ? (
              <div className="space-y-1 max-h-[30vh] overflow-y-auto">
                {pedidos.map(p => (
                  <button key={p.id} type="button" onClick={() => setPedidoEscolhido(p.id)}
                    className={`w-full text-left p-2 rounded-md border text-xs transition-colors ${
                      pedidoEscolhido === p.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                    }`}>
                    <div className="flex justify-between gap-2">
                      <span className="font-medium">{p.numero_pedido}</span>
                      <span className="tabular-nums">{brl(Number(p.valor_total) || 0)}</span>
                    </div>
                    <p className="text-muted-foreground truncate">{p.descricao}</p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Nº do pedido</Label>
                    <Input value={numeroPedido} onChange={e => setNumeroPedido(e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-xs">Quantidade entregue</Label>
                    <Input type="number" value={quantidade} onChange={e => setQuantidade(e.target.value)}
                      placeholder="em unidades do contrato" className="h-8 text-xs" />
                    {/* De onde o número veio. Lido e digitado se parecem na
                        tela, e quem confere precisa saber em qual está
                        apoiado — o mesmo motivo do carimbo de procedência do
                        DRE e da data de entrega. */}
                    {daNota && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {Number(quantidade) === daNota.total
                          ? `Do XML da nota${daNota.linhas.length > 1 ? ` — soma de ${daNota.linhas.length} linhas` : ''}.`
                          : `O XML da nota diz ${daNota.total.toLocaleString('pt-BR')}.`}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Item do contrato</Label>
                  {semItens ? (
                    <p className="text-xs text-muted-foreground py-1">
                      Este contrato não tem itens cadastrados — o pedido é criado sem vínculo de item,
                      e o saldo será controlado só por valor.
                    </p>
                  ) : (
                    <Select value={itemId} onValueChange={setItemId}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Escolha o item" /></SelectTrigger>
                      <SelectContent>
                        {itens.map(i => (
                          <SelectItem key={i.id} value={i.id} className="text-xs">
                            {i.codigo_item ? `[${i.codigo_item}] ` : ''}{i.descricao.slice(0, 60)}
                            {i.saldo_quantitativo != null && ` · saldo ${Number(i.saldo_quantitativo).toLocaleString('pt-BR')}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {empenhos.length > 0 && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Empenho que autoriza</Label>
                      <Select value={empenhoId || '__sem__'} onValueChange={v => setEmpenhoId(v === '__sem__' ? '' : v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__sem__" className="text-xs">Sem empenho registrado</SelectItem>
                          {empenhos.map(e => (
                            <SelectItem key={e.id} value={e.id} className="text-xs">{e.numero}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Cota</Label>
                      <Select value={cota || '__sem__'} onValueChange={v => setCota(v === '__sem__' ? '' : v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__sem__" className="text-xs">Sem divisão de cota</SelectItem>
                          <SelectItem value="principal" className="text-xs">Cota principal</SelectItem>
                          <SelectItem value="reservada" className="text-xs">Cota reservada</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {/* A mesma checagem do lançamento feito em Gestão. Pedido
                    retroativo estoura saldo com frequência — é o motivo de o
                    contrato ter entrado na gestão tarde —, e o aviso nomeia o
                    gargalo em vez de barrar. */}
                {cabimento && !cabimento.cabe && cabimento.gargalo && (
                  <p className="text-xs text-warning flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>{cabimento.frase} {cabimento.gargalo.providencia}</span>
                  </p>
                )}

                {/* Nota com produtos diferentes não é um pedido só. Mostrar as
                    linhas é o que permite perceber isso antes de somar tudo
                    num item que só corresponde a parte delas. */}
                {daNota && daNota.linhas.length > 1 && (
                  <div className="text-[11px] text-muted-foreground border rounded-md p-2 space-y-0.5">
                    <p className="text-warning">
                      A nota tem {daNota.linhas.length} produtos. A soma foi preenchida — se forem itens
                      diferentes do contrato, registre um pedido por item.
                    </p>
                    {daNota.linhas.map((l, i) => (
                      <p key={i}>{l.descricao} — {l.quantidade.toLocaleString('pt-BR')} un</p>
                    ))}
                  </div>
                )}

                <p className="text-[11px] text-muted-foreground">
                  O pedido nasce como <b>entregue</b>, com a data da nota — não a de hoje. O valor é o
                  do lançamento{daNota ? '; a quantidade veio do XML' : '; a quantidade é o que você informar'}.
                </p>
              </div>
            )}
          </>
        )}

        <div className="flex justify-between items-center gap-2 pt-2">
          {((ehDespesa && lancamento.contrato_id) || (!ehDespesa && lancamento.contrato_pedido_id)) && (
            <Badge variant="outline" className="text-[11px]">
              {ehDespesa ? 'já atribuída — salvar troca o contrato' : 'já vinculado — salvar troca o vínculo'}
            </Badge>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={fechar}>Cancelar</Button>
            <Button onClick={salvar}
              disabled={salvando || !contratoId || (!ehDespesa && modo === 'existente' && !pedidoEscolhido)}>
              {salvando && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              {ehDespesa ? 'Atribuir ao contrato' : (modo === 'novo' ? 'Criar pedido e vincular' : 'Vincular')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
