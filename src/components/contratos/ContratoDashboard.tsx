import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MoneyInput } from '@/components/ui/money-input';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { supabase } from '@/integrations/supabase/client';
import { situacaoDaVigencia, tetoDecenal } from '@/lib/contratos/vigencia';
import { excessoDeExecucao } from '@/lib/contratos/excesso-de-execucao';
import { useMembroPermissoes } from '@/hooks/useMembroPermissoes';
import { toast } from 'sonner';
import {
  DollarSign, TrendingUp, Package, ShoppingCart, AlertTriangle,
  Calendar, Loader2, Receipt, Lock, Pencil, Check, X, CheckCircle2,
  FilePlus2, Layers, ExternalLink, ListChecks, RotateCcw,
} from 'lucide-react';
import { EncerrarContratoDialog, ReabrirContratoDialog } from './EncerramentoDoContrato';
import {
  MOTIVOS_ENCERRAMENTO, rotuloDoMotivo, sugestaoDeEncerramento, aditivoPosteriorAoEncerramento,
  type MotivoEncerramento,
} from '@/lib/contratos/encerramento';
import CabecalhoDoDocumento from '@/components/documento/CabecalhoDoDocumento';
import SecaoDoDocumento from '@/components/documento/SecaoDoDocumento';
import DeOndeVem from '@/components/documento/DeOndeVem';
import FolhaDeAssinaturas from '@/components/documento/FolhaDeAssinaturas';
import BotaoImprimir from '@/components/documento/BotaoImprimir';
import RelatorioConsumoAtaDialog from './RelatorioConsumoAtaDialog';
import ManutencaoAtaSrpDialog from './ManutencaoAtaSrpDialog';
import EvolucaoMensalDashboard from './EvolucaoMensalDashboard';
import ContratoEntrega from './ContratoEntrega';
import ContratoReajuste from './ContratoReajuste';
import { situacaoDoReajuste } from '@/lib/contratos/reajuste';
import { TIPOS_REAJUSTE } from '@/lib/contratos/instrumentos';
import { coberturaDoContrato, ROTULO_SITUACAO, textoDoDesvio, type SituacaoDoCusto } from '@/lib/contratos/cobertura-de-custo';
import ContratoEficacia from './ContratoEficacia';
import FaixaIndicadores from '@/components/gestao/FaixaIndicadores';
import SeloSituacao, { ValorIndisponivel } from '@/components/gestao/SeloSituacao';
import ListaDeCampos, { BlocoDoPainel } from '@/components/gestao/ListaDeCampos';
import TextoExpansivel from '@/components/gestao/TextoExpansivel';
import SecaoRecolhivel from '@/components/ui/secao-recolhivel';

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
/* Quantidade no papel: até três casas, sem "R$". */
const fmtQtd = (v: unknown) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(Number(v) || 0);
/* Rótulos da situação do pedido, os mesmos da aba Pedidos. */
const SITUACAO_PEDIDO: Record<string, string> = { pendente: 'Pendente', entregue: 'Entregue', parcial: 'Parcial', cancelado: 'Cancelado' };

const dataBr = (iso?: string | null) =>
  iso ? new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : null;

/**
 * Saldo de item no alerta: "restam 0 KG" não é saldo baixo, é saldo ESGOTADO
 * (o filé de pescada do 17/2025, 400 de 400 consumidos, saía como "baixo").
 * Quem lê "baixo" ainda acha que dá para pedir; "esgotado" diz que não.
 */
type ItemComSaldo = {
  saldo_quantitativo_efetivo?: number | string | null;
  saldo_quantitativo?: number | string | null;
  unidade?: string | null;
};
const saldoEsgotado = (i: ItemComSaldo) => Number(i.saldo_quantitativo_efetivo ?? i.saldo_quantitativo) <= 0;
const fraseDoSaldo = (i: ItemComSaldo) => saldoEsgotado(i)
  ? `saldo esgotado (0 ${i.unidade})`
  : `saldo baixo (restam ${i.saldo_quantitativo_efetivo ?? i.saldo_quantitativo} ${i.unidade})`;

/**
 * Uma ação pendente do contrato, do jeito que o cartão "Próximas ações" a
 * mostra: o que fazer, por quê, e para onde ir.
 *
 * Existe como tipo porque a MESMA lista alimenta duas peças da referência — o
 * cartão que enumera tudo e o aviso destacado, que é o primeiro item dela. Sem
 * uma fonte só, as duas se contradiriam na primeira regra que mudasse.
 */
type AcaoPendente = {
  chave: string;
  titulo: string;
  detalhe: ReactNode;
  tom: 'atencao' | 'critico' | 'ativo';
  /** O que resolve a pendência — link para a aba certa ou botão de decisão. */
  acao?: ReactNode;
};

/** O que `cobertura_de_custo_do_contrato` devolve (migration 20260923000001). */
type CoberturaRpc = {
  declarado: number; comprovado_pago: number; comprovado_aberto: number;
  do_contrato_pago: number; do_contrato_aberto: number;
  a_distribuir: number; a_distribuir_n: number;
  declarado_sem_documento: number; cobertura_pct: number | null;
  pedidos_total: number; pedidos_sem_custo: number; pedidos_declarado: number; pedidos_documentado: number;
  pedidos_parcial: number; pedidos_conferido: number; pedidos_divergente: number;
};
const situacoesDoContrato = (c: CoberturaRpc) => ([
  ['sem_custo', c.pedidos_sem_custo], ['declarado', c.pedidos_declarado], ['documentado', c.pedidos_documentado],
  ['parcial', c.pedidos_parcial], ['conferido', c.pedidos_conferido], ['divergente', c.pedidos_divergente],
] as Array<[SituacaoDoCusto, number]>).filter(([, n]) => Number(n) > 0).map(([chave, n]) => ({ chave, n: Number(n) }));

export default function ContratoDashboard({ contratoId }: { contratoId: string }) {
  const [data, setData] = useState<{
    contrato: any; itens: any[]; pedidos: any[]; custos: any[]; aditivos: any[];
    /** Nulo enquanto a migration 20260831000002 não tiver sido aplicada. */
    custoRealizado: { custo_pago: number; custo_comprometido: number; custo_digitado: number; custo_declarado_sem_documento?: number } | null;
    /** Cobertura de custo (22/09): nulo sem a migration 20260923000001 ou sem alçada de custos. */
    cobertura: CoberturaRpc | null;
    /** ATA SRP: os contratos que aderiram aos quantitativos — é deles que o consumo vem. */
    derivados: Array<{ id: string; numero_contrato: string | null; valor_global: number; data_fim: string | null }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  // Os avisos do topo recolhem (08/09): cada um mantém a linha-título à vista.
  const [perguntaAberta, setPerguntaAberta] = useState(true);
  const [alertasAbertos, setAlertasAbertos] = useState(true);
  const [editingGlobal, setEditingGlobal] = useState(false);
  const [editandoVigencia, setEditandoVigencia] = useState(false);
  const [vigForm, setVigForm] = useState({ assinatura: '', inicio: '', fim: '' });
  const [salvandoVigencia, setSalvandoVigencia] = useState(false);
  const [globalInput, setGlobalInput] = useState('');
  // Os diálogos do fim do contrato (21/09): declarar e reabrir.
  const [encerrarAberto, setEncerrarAberto] = useState(false);
  const [reabrirAberto, setReabrirAberto] = useState(false);
  const { temPermissao, isFinanceiro, isAdmin } = useMembroPermissoes();

  const podeVerCustos = isFinanceiro || isAdmin;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const [contratoRes, itensRes, pedidosRes, custosRes, aditivosRes] = await Promise.all([
        supabase.from('contratos').select('*').eq('id', contratoId).single(),
        supabase.from('contrato_itens').select('*').eq('contrato_id', contratoId),
        supabase.from('contrato_pedidos').select('*').eq('contrato_id', contratoId),
        supabase.from('contrato_custos').select('*').eq('contrato_id', contratoId),
        supabase.from('contrato_aditivos').select('*').eq('contrato_id', contratoId),
      ]);
      if (cancelled) return;
      // O custo que VEIO DO FINANCEIRO. Consulta separada e tolerante: a função
      // nasce de migration colada à mão, e sem ela o painel apenas volta ao
      // custo digitado — não quebra.
      const { data: realizado } = await supabase
        .rpc('contrato_custo_realizado' as never, { p_contrato_id: contratoId } as never);
      if (cancelled) return;
      // A cobertura de custo (22/09): declarado nos pedidos × comprovado. A
      // função é restrita a admin/Financeiro e vem de migration colada à mão:
      // negada ou ausente, o painel mostra o resto.
      const { data: cob } = await supabase
        .rpc('cobertura_de_custo_do_contrato' as never, { p_contrato_id: contratoId } as never);
      if (cancelled) return;
      // ATA SRP fala outra língua: o consumo vem dos contratos derivados.
      let derivados: Array<{ id: string; numero_contrato: string | null; valor_global: number; data_fim: string | null }> = [];
      if ((contratoRes.data as any)?.tipo_documento === 'ata_srp') {
        const { data: dv } = await supabase
          .from('contratos')
          .select('id, numero_contrato, valor_global, data_fim')
          .eq('ata_srp_id', contratoId)
          .is('excluido_em', null)
          .order('data_assinatura', { ascending: true });
        derivados = ((dv as any[]) || []).map(d => ({ ...d, valor_global: Number(d.valor_global) || 0 }));
      }
      if (cancelled) return;
      setData({
        derivados,
        contrato: contratoRes.data,
        itens: (itensRes.data as any[]) || [],
        pedidos: (pedidosRes.data as any[]) || [],
        custos: (custosRes.data as any[]) || [],
        aditivos: (aditivosRes.data as any[]) || [],
        custoRealizado: (realizado as unknown as Array<{
          custo_pago: number; custo_comprometido: number; custo_digitado: number; custo_declarado_sem_documento?: number;
        }> | null)?.[0] ?? null,
        cobertura: (cob as unknown as CoberturaRpc[] | null)?.[0] ?? null,
      });
      setLoading(false);
    };
    load();

    // Realtime: sincroniza Valor Global / % consumido quando pedidos forem
    // criados ou removidos (inclusive via cascata do Financeiro).
    const channel = supabase
      .channel(`contrato-dashboard-${contratoId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contrato_pedidos', filter: `contrato_id=eq.${contratoId}` },
        () => load(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contrato_itens', filter: `contrato_id=eq.${contratoId}` },
        () => load(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [contratoId]);

  // Resposta ao questionamento em hipótese: grava a forma que o usuário declarou.
  const definirFormaFornecimento = async (forma: 'unico' | 'continuo') => {
    const { error } = await supabase
      .from('contratos')
      .update({ forma_fornecimento: forma } as never)
      .eq('id', contratoId);
    if (error) {
      toast.error(`Não foi possível registrar: ${error.message}`);
      return;
    }
    toast.success(forma === 'unico'
      ? 'Registrado: entrega única — o alerta de saldo não se aplica a este contrato.'
      : 'Registrado: fornecimento contínuo — o alerta de saldo continua ativo.');
    setData(prev => prev
      ? { ...prev, contrato: { ...prev.contrato, forma_fornecimento: forma } }
      : prev);
  };

  const calc = useMemo(() => {
    if (!data?.contrato) return null;
    const c = data.contrato;
    // A DECLARAÇÃO de fim (21/09): só o status gravado diz que alguém
    // encerrou. Vencido pelo calendário não é encerrado — é pendente.
    const encerrado = c.status === 'encerrado';
    const pedidosAtivos = data.pedidos.filter((p: any) => p.status !== 'cancelado');
    const faturamento = pedidosAtivos.reduce((s: number, p: any) => s + (p.valor_total || 0), 0);
    
    // Sum addendum acrescimos/supressoes
    const totalAditivoValorAcrescimo = data.aditivos.reduce((s: number, a: any) => s + (a.valor_acrescimo || 0), 0);
    const totalAditivoValorSupressao = data.aditivos.reduce((s: number, a: any) => s + (a.valor_supressao || 0), 0);
    const totalAditivoQtdAcrescimo = data.aditivos.reduce((s: number, a: any) => s + (a.quantidade_acrescimo || 0), 0);
    const totalAditivoQtdSupressao = data.aditivos.reduce((s: number, a: any) => s + (a.quantidade_supressao || 0), 0);
    
    // ── O custo agora vem do Financeiro ─────────────────────────────────
    //
    // `contrato_custo_realizado` soma as despesas atribuídas a este contrato e
    // os custos que não nascem de lançamento, IGNORANDO a parcela cujo
    // lançamento já está atribuído — a dupla contagem é impedida lá, não aqui.
    //
    // Por isso `custo_digitado` da função substitui a soma crua de
    // `contrato_custos`: somar a tabela inteira reintroduziria justamente o que
    // a função exclui.
    const cr = data.custoRealizado;
    const custoPago = Number(cr?.custo_pago ?? 0);
    const custoComprometido = Number(cr?.custo_comprometido ?? 0);
    const custoDoFinanceiro = custoPago + custoComprometido;
    const totalCustosTabela = cr
      ? Number(cr.custo_digitado ?? 0)
      : data.custos.reduce((s: number, cc: { valor?: number }) => s + (cc.valor || 0), 0);
    const custosDiretos = data.custos.filter((cc: any) => cc.tipo === 'custo_direto').reduce((s: number, cc: any) => s + cc.valor, 0);
    const tributos = data.custos.filter((cc: any) => cc.tipo === 'tributo').reduce((s: number, cc: any) => s + cc.valor, 0);
    const frete = data.custos.filter((cc: any) => cc.tipo === 'frete_logistica').reduce((s: number, cc: any) => s + cc.valor, 0);
    const despAdmin = data.custos.filter((cc: any) => cc.tipo === 'despesa_administrativa').reduce((s: number, cc: any) => s + cc.valor, 0);
    
    // Custos from pedidos (custo_total field)
    // O custo DECLARADO nos pedidos (22/09) é exceção nomeada: só entra no
    // total o que as contas a pagar do contrato ainda não cobrem. Somar o
    // declarado inteiro ao do Financeiro contaria a mesma compra duas vezes
    // assim que a nota chegasse.
    const custoPedidos = pedidosAtivos.reduce((s: number, p: any) => s + (Number(p.custo_total) || 0), 0);
    const custoDeclaradoSemDocumento = cr && cr.custo_declarado_sem_documento != null
      ? Number(cr.custo_declarado_sem_documento)
      : Math.max(0, custoPedidos - custoDoFinanceiro);
    
    // Total costs = Financeiro + table costs + pedido costs
    const totalCustos = custoDoFinanceiro + totalCustosTabela + custoDeclaradoSemDocumento;

    // O custo do Financeiro é DIRETO: é a compra feita para atender este
    // contrato. Entra no lucro bruto, ao lado dos custos diretos digitados.
    const lucroBruto = faturamento - custosDiretos - custoDeclaradoSemDocumento - custoDoFinanceiro;
    const lucroLiquido = faturamento - totalCustos;

    // ── Previsto × realizado ────────────────────────────────────────────────
    //
    // O previsto sai da Precificação, que gravou `custo_unitario` em cada item.
    // Comparado só sobre o que JÁ FOI ENTREGUE: confrontar o custo realizado de
    // 40% do contrato com o custo previsto de 100% dele daria um desvio que
    // não existe.
    const custoPrevistoDoEntregue = data.itens.reduce(
      (s: number, i: any) => s + (Number(i.custo_unitario) || 0) * (Number(i.quantidade_consumida) || 0),
      0,
    );
    const desvioDeCusto = custoPrevistoDoEntregue > 0
      ? ((custoDoFinanceiro + totalCustosTabela) - custoPrevistoDoEntregue) / custoPrevistoDoEntregue * 100
      : null;

    // Cobertura de custo (22/09): enquanto o comprovado não cobre o declarado,
    // "economia" é ilusão de custo pela metade (decisão 17 do dono).
    const cob = data.cobertura;
    const cobertura = coberturaDoContrato({
      declarado: custoPedidos,
      comprovadoPago: Number(cob?.comprovado_pago ?? 0),
      comprovadoAberto: Number(cob?.comprovado_aberto ?? 0),
      doContratoPago: custoPago,
      doContratoAberto: custoComprometido,
      pedidosTotal: pedidosAtivos.length,
      pedidosSemCusto: cob ? Number(cob.pedidos_sem_custo) : pedidosAtivos.filter((p: any) => !(Number(p.custo_total) > 0)).length,
    });
    const custoIncompleto = cobertura.incompleta;
    
    // valor_global already includes aditivos via trigger, use it directly
    const valorGlobalEfetivo = c.valor_global || 0;
    const pctConsumo = valorGlobalEfetivo > 0 ? (c.valor_consumido / valorGlobalEfetivo) * 100 : 0;
    
    // Contagem por DATA e sem sinal invertido: ver lib/contratos/vigencia.
    const vigencia = situacaoDaVigencia(c.data_fim);
    // O art. 107 limita as prorrogações sucessivas a DEZ ANOS do início, e a
    // renovação anual vira rotina sem memória — ninguém conta os anos. O aviso
    // só aparece quando há algo a decidir: o último período possível, ou o
    // teto já ultrapassado.
    const decenal = tetoDecenal(c.data_inicio, c.data_fim);
    const diasRestantes = vigencia.dias;

    // ── Prazo decorrido ─────────────────────────────────────────────────
    //
    // Quanto do período de vigência já passou — a terceira medida do cartão
    // "Execução do contrato", ao lado de pedidos entregues e valor executado.
    // É leitura derivada das datas que já estão na tela, não regra nova.
    //
    // Sem data de início OU de fim não há período: devolve `null` para o
    // cartão dizer "Apuração a validar" em vez de desenhar uma barra em 0%,
    // que afirmaria "a vigência mal começou" sobre um contrato cujo prazo
    // ninguém sabe (o contrato vindo de scan chega exatamente assim).
    const prazoDecorrido = (() => {
      if (!c.data_inicio || !c.data_fim) return null;
      const ini = new Date(`${String(c.data_inicio).slice(0, 10)}T12:00:00`).getTime();
      const fim = new Date(`${String(c.data_fim).slice(0, 10)}T12:00:00`).getTime();
      if (!Number.isFinite(ini) || !Number.isFinite(fim) || fim <= ini) return null;
      const total = fim - ini;
      const corrido = Math.min(Math.max(Date.now() - ini, 0), total);
      return { pct: (corrido / total) * 100, dias: Math.round(total / 86_400_000) };
    })();
    
    // For items, add addendum quantities proportionally
    const itensComAditivo = data.itens.map((i: any) => {
      const qtdContratadaTotal = (i.quantidade_contratada || 0) + totalAditivoQtdAcrescimo - totalAditivoQtdSupressao;
      const saldoQtd = qtdContratadaTotal - (i.quantidade_consumida || 0);
      return { ...i, quantidade_contratada_total: qtdContratadaTotal, saldo_quantitativo_efetivo: saldoQtd };
    });
    
    // ── A ressalva do excesso ───────────────────────────────────────────
    //
    // Em VALOR, porque é a unidade em que o contrato é controlado e a única
    // que não depende de as unidades de item e de empenho coincidirem.
    // `valor_global` já inclui os aditivos por gatilho, então o inicial se
    // recupera descontando-os.
    const acrescidoPorAditivo = totalAditivoValorAcrescimo - totalAditivoValorSupressao;
    const excesso = excessoDeExecucao({
      inicial: (c.valor_global || 0) - acrescidoPorAditivo,
      jaAcrescido: acrescidoPorAditivo,
      executado: c.valor_consumido || 0,
    });

    const itensAlertaSaldo = itensComAditivo.filter((i: any) => i.quantidade_contratada_total > 0 && (i.quantidade_consumida / i.quantidade_contratada_total) * 100 >= 80);
    /**
     * Forma de fornecimento (decisão do dono, 02/09): em entrega ÚNICA, saldo
     * esgotado é conclusão, não alerta — o aviso existe para proteger pedidos
     * FUTUROS, que ali não existem. NULL = ninguém informou: comportamento
     * clássico + pergunta quando a hipótese surge. Hipótese, não regra.
     */
    const formaFornecimento: 'unico' | 'continuo' | null = (c as any)?.forma_fornecimento ?? null;
    const saldoEsgotado = itensAlertaSaldo.some((i: any) =>
      Number(i.saldo_quantitativo_efetivo ?? i.saldo_quantitativo) <= 0);
    // Encerrado, o alerta de saldo não protege pedido nenhum: não há próximo.
    const alertasSaldoVisiveis = formaFornecimento === 'unico' || encerrado ? [] : itensAlertaSaldo;
    // Saldo esgotado mede pedidos LANÇADOS; concluído exige pedidos ENTREGUES.
    // Empenhado não é entregue (04/09): com os pedidos em Separar Estoque, o
    // painel dizia "fornecimento integral foi entregue" — mentira de estado.
    const todosEntregues = pedidosAtivos.length > 0 && pedidosAtivos.every((p: any) => p.status === 'entregue');
    const entregaUnicaConcluida = formaFornecimento === 'unico' && saldoEsgotado && todosEntregues;
    const entregaUnicaEmAndamento = formaFornecimento === 'unico' && saldoEsgotado && !todosEntregues;
    const pedidosEntregues = pedidosAtivos.filter((p: any) => p.status === 'entregue').length;
    const pedidosAtivosTotal = pedidosAtivos.length;
    const perguntarFormaFornecimento = formaFornecimento === null && saldoEsgotado && !encerrado;
    // Reajuste em sentido estrito: cumprido 1 ano da data-base (ou do último
    // reajuste registrado), o direito nasce — e o alerta junto (art. 92, §3º;
    // interregno da Lei 10.192/2001). Sem data-base registrada, silêncio: o
    // card "Reajuste por índice" abaixo pede a data em vez de chutar.
    const reajuste = situacaoDoReajuste({
      dataBase: (c as any)?.data_base_reajuste,
      reajustesRegistrados: (data.aditivos as any[])
        .filter((a) => TIPOS_REAJUSTE.includes(a.tipo))
        .map((a) => a.data_base_reajuste ?? a.data_assinatura),
      hoje: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date()),
    });
    const reajusteDevido = !!reajuste?.devido;
    // As duas cascatas da ATA precisam concordar: o consumo FINANCEIRO (soma
    // dos contratos derivados) e o FÍSICO (quilos baixados dos itens). Dinheiro
    // andando com quilos parados = contratos derivados com quantidade zerada —
    // o scan não rendeu o número e ninguém completou. Sem este aviso, a
    // divergência só aparecia quando o estoque "sobrava" no fim da vigência.
    const fisicoParado = c?.tipo_documento === 'ata_srp'
      && (c?.valor_consumido || 0) > 0
      && data.itens.length > 0
      && data.itens.every((i: any) => (i.quantidade_ata_consumida || 0) === 0);
    const meses: Record<string, number> = {};
    pedidosAtivos.forEach((p: any) => { if (p.data_pedido) { const k = p.data_pedido.substring(0, 7); meses[k] = (meses[k] || 0) + (p.valor_total || 0); } });
    const pedidosPorMes = Object.entries(meses).sort(([a], [b]) => a.localeCompare(b)).slice(-6);

    // ── O fim do contrato: o sistema sugere, quem opera declara (21/09) ────
    //
    // "Esgotado" aqui é o CONTRATO, não um item: o valor consumido alcançou o
    // global, ou todos os itens com quantidade zeraram o saldo. É o sinal que
    // faz o painel perguntar se há aditivo a registrar ou se as obrigações se
    // cumpriram — e só perguntar: encerrar é decisão de alguém.
    const itensComQuantidade = itensComAditivo.filter((i) => Number(i.quantidade_contratada_total) > 0);
    const contratoEsgotado = (valorGlobalEfetivo > 0 && (Number(c.valor_consumido) || 0) >= valorGlobalEfetivo)
      || (itensComQuantidade.length > 0 && itensComQuantidade.every((i) => Number(i.saldo_quantitativo_efetivo) <= 0));
    const sugestaoEncerramento = sugestaoDeEncerramento({
      encerrado,
      saldoEsgotado: contratoEsgotado,
      vencido: vigencia.vencido,
      vigenciaFrase: vigencia.frase,
      entregaUnicaConcluida,
      todosEntregues,
      instrumento: c.tipo_documento === 'ata_srp' ? 'ata' : 'contrato',
    });
    // Encerrado com aditivo assinado depois: o contrato continuou — reabrir?
    const aditivoPosterior = encerrado ? aditivoPosteriorAoEncerramento(c.data_encerramento, data.aditivos) : null;

    return { c, itensComAditivo, pedidosAtivos, faturamento, totalCustos, totalCustosTabela, custosDiretos, custoPedidos,
      custoDeclaradoSemDocumento, cobertura, custoIncompleto, cob,
      custoPago, custoComprometido, custoDoFinanceiro, custoPrevistoDoEntregue, desvioDeCusto, excesso, decenal, tributos, frete, despAdmin, lucroBruto, lucroLiquido, pctConsumo, diasRestantes, vigencia, prazoDecorrido, fisicoParado, itensAlertaSaldo, alertasSaldoVisiveis, entregaUnicaConcluida, entregaUnicaEmAndamento, pedidosEntregues, pedidosAtivosTotal, perguntarFormaFornecimento, pedidosPorMes, valorGlobalEfetivo, totalAditivoValorAcrescimo, totalAditivoValorSupressao, totalAditivoQtdAcrescimo, totalAditivoQtdSupressao, reajuste, reajusteDevido,
      encerrado, contratoEsgotado, sugestaoEncerramento, aditivoPosterior };
  }, [data]);

  if (loading) {
    // Espera na forma do conteúdo — três indicadores e os dois cartões —, não
    // um spinner no centro (Design System v3).
    return (
      <div role="status" aria-busy="true" className="flex flex-col gap-4">
        <span className="sr-only">Carregando o resumo do contrato…</span>
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }
  if (!calc) {
    return (
      <Card>
        <EstadoVazio tamanho="compacto" titulo="Contrato não encontrado" />
      </Card>
    );
  }

  const { c, itensComAditivo, pedidosAtivos, faturamento, totalCustos, totalCustosTabela, custosDiretos, custoPedidos,
    custoDeclaradoSemDocumento, cobertura, custoIncompleto, cob,
    custoPago, custoComprometido, custoDoFinanceiro, custoPrevistoDoEntregue, desvioDeCusto, excesso,
    decenal, tributos, frete, despAdmin, lucroBruto, lucroLiquido, pctConsumo, vigencia, prazoDecorrido,
    fisicoParado, itensAlertaSaldo, alertasSaldoVisiveis, entregaUnicaConcluida, entregaUnicaEmAndamento,
    pedidosEntregues, pedidosAtivosTotal, perguntarFormaFornecimento, valorGlobalEfetivo,
    totalAditivoValorAcrescimo, totalAditivoValorSupressao, reajuste, reajusteDevido,
    encerrado, sugestaoEncerramento, aditivoPosterior } = calc;
  const margemBruta = faturamento > 0 ? (lucroBruto / faturamento) * 100 : 0;
  const margemLiquida = faturamento > 0 ? (lucroLiquido / faturamento) * 100 : 0;

  /**
   * O custo foi APURADO, ou apenas não existe número?
   *
   * `contrato_custo_realizado` é RPC de migration colada à mão: quando ela não
   * existe, `custoRealizado` volta nulo e o painel cai no custo digitado — a
   * degradação elegante que o comando manda preservar, e que continua aqui.
   *
   * O que se acrescenta é a honestidade sobre o resultado: caindo no custo
   * digitado E sem nada digitado, o sistema não apurou custo nenhum. Exibir
   * R$ 0,00 ali seria AFIRMAR "este contrato não teve custo" — e, pior, fazer
   * o Lucro Líquido igualar o Faturamento, com margem de 100%, num contrato
   * cujas despesas simplesmente ainda não foram atribuídas.
   *
   * Havendo qualquer custo (da RPC, digitado ou do pedido), zero é medida e
   * sai como zero.
   */
  const custoApurado = data!.custoRealizado !== null || totalCustos > 0;

  const isAtaSrp = c.tipo_documento === 'ata_srp';
  /** A própria tela, noutra aba — é a URL que `GestaoContratos` lê em `?aba=`. */
  const abaDoContrato = (aba: string) => `/gestao-contratos?contrato=${contratoId}&aba=${aba}`;

  // ── As três medidas do topo, e a regra que as separa de zero ──────────────
  //
  // "Distinguir custo não apurado de custo efetivamente zero" é a primeira
  // regra do comando, e ela vale para cada um destes três números:
  //
  //  · VALOR ORIGINAL nulo ou zerado é o contrato que veio de scan e cujo
  //    documento não rendeu o número. Escrever R$ 0,00 ali seria afirmar que o
  //    contrato nasceu valendo nada — contrato assim não existe.
  //  · ADITIVOS é o caso oposto, e por isso está aqui: sem nenhum termo
  //    registrado, zero é FATO, não ausência. Ele sai como R$ 0,00 mesmo, com
  //    a razão embaixo. A regra proíbe fingir apuração, não proíbe o zero.
  //  · SALDO depende do valor global; sem global apurado, o saldo herda a
  //    ausência em vez de exibir a subtração de um número que não existe.
  //
  // A segunda regra do comando — "identificar a base de cada indicador" — está
  // no `detalhe` de cada um: a linha fina embaixo diz de onde o número sai.
  const valorOriginal = Number(c.valor_global_original) || 0;
  const saldoRemanescente = c.saldo_remanescente;
  const saldoAditivos = totalAditivoValorAcrescimo - totalAditivoValorSupressao;
  const temAditivos = (data!.aditivos?.length ?? 0) > 0;

  const indicadores = [
    {
      rotulo: 'Valor original',
      valor: valorOriginal > 0 ? fmt(valorOriginal) : null,
      razaoIndisponivel: 'Apuração a validar',
      detalhe: valorOriginal > 0
        ? 'valor do documento, antes dos aditivos'
        : 'o documento não rendeu o número — informe no lápis do valor global',
      icone: DollarSign,
      tom: 'neutro' as const,
    },
    {
      rotulo: 'Aditivos',
      valor: temAditivos ? fmt(saldoAditivos) : fmt(0),
      detalhe: temAditivos
        ? `acréscimos − supressões de ${data!.aditivos.length} termo${data!.aditivos.length === 1 ? '' : 's'}`
        : 'nenhum termo aditivo registrado',
      icone: FilePlus2,
      tom: (saldoAditivos < 0 ? 'aviso' : 'ok') as 'aviso' | 'ok',
    },
    {
      rotulo: 'Saldo',
      valor: valorGlobalEfetivo > 0 && saldoRemanescente != null
        ? fmt(Number(saldoRemanescente))
        : null,
      razaoIndisponivel: 'Apuração a validar',
      // Encerrado, o saldo que sobrou não é carteira: é o que ficou sem
      // executar — e a linha de base diz isso, em vez de pintar de vermelho.
      detalhe: encerrado
        ? `encerrado em ${dataBr(c.data_encerramento) ?? '—'} · ${Number(saldoRemanescente) > 0 ? 'saldo não executado' : 'executado por inteiro'}`
        : valorGlobalEfetivo > 0 && saldoRemanescente != null
          ? 'valor global menos o que já foi consumido'
          : 'depende do valor global, ainda não apurado',
      icone: TrendingUp,
      tom: (encerrado ? 'neutro' : Number(saldoRemanescente) > 0 ? 'ok' : 'critico') as 'ok' | 'critico' | 'neutro',
    },
  ];

  // ── O que ainda falta fazer neste contrato ───────────────────────────────
  //
  // Uma lista só alimenta o cartão "Próximas ações". Até 27/09 ela também
  // alimentava um aviso destacado logo abaixo dos cartões, com o primeiro
  // item repetido: o dono viu "Nenhuma despesa atribuída" duas vezes na
  // mesma dobra e pediu um só — o cartão já traz a providência e o botão.
  //
  // Nenhuma regra nova: cada entrada reaproveita um sinal que o painel já
  // calculava e já exibia em "Alertas" — aqui ele ganha a providência e o
  // caminho, que é o que faltava.
  const acoes: AcaoPendente[] = [];
  if (vigencia.vencido) {
    acoes.push({
      chave: 'vigencia-vencida',
      titulo: 'Vigência vencida',
      detalhe: <>{vigencia.frase}{c.data_fim ? ` (em ${dataBr(c.data_fim)})` : ''}. Se houve prorrogação, registre o aditivo de prazo.</>,
      tom: 'critico',
      acao: (
        <Button asChild size="sm" variant="outline" className="g-controle">
          <Link to={abaDoContrato('contratos-aditivos')}>Registrar aditivo de prazo</Link>
        </Button>
      ),
    });
  }
  if (excesso.excede && !excesso.cabeNoArt125) {
    acoes.push({
      chave: 'excesso-fora-do-125',
      titulo: 'Execução além do que o art. 125 admite',
      detalhe: <>{excesso.frase} São {fmt(excesso.quanto)} a mais que o contratado. {excesso.providencia}</>,
      tom: 'critico',
    });
  }
  if (!c.data_fim) {
    acoes.push({
      chave: 'sem-datas',
      titulo: 'Vigência sem data de fim',
      detalhe: 'Sem data de fim, este contrato fica fora de todos os avisos de vencimento. As datas se informam no lápis de Vigência, ao lado.',
      tom: 'atencao',
    });
  }
  if (perguntarFormaFornecimento) {
    acoes.push({
      chave: 'forma-fornecimento',
      titulo: 'O saldo se esgotou — este contrato é de entrega única?',
      detalhe: 'Em entrega única (comum na dispensa), saldo zerado significa fornecimento concluído e o alerta deixa de fazer sentido. Em fornecimento contínuo/parcelado, o alerta protege os próximos pedidos. O contrato costuma dizer na cláusula de entrega/execução.',
      tom: 'ativo',
      acao: (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="g-controle" onClick={() => definirFormaFornecimento('unico')}>
            É entrega única
          </Button>
          <Button size="sm" variant="outline" className="g-controle" onClick={() => definirFormaFornecimento('continuo')}>
            É fornecimento contínuo
          </Button>
        </div>
      ),
    });
  }
  if (!vigencia.vencido && vigencia.vencendo) {
    acoes.push({
      chave: 'vigencia-vencendo',
      titulo: 'Vigência a vencer',
      detalhe: vigencia.frase,
      tom: 'atencao',
      acao: (
        <Button asChild size="sm" variant="outline" className="g-controle">
          <Link to={abaDoContrato('contratos-aditivos')}>Abrir Arquivos e Aditivos</Link>
        </Button>
      ),
    });
  }
  if (decenal && (decenal.ultrapassa || !decenal.ultimaProrrogacaoAnualCabe)) {
    acoes.push({
      chave: 'teto-decenal',
      titulo: 'Teto decenal (art. 107)',
      detalhe: decenal.frase,
      tom: decenal.ultrapassa ? 'critico' : 'atencao',
    });
  }
  if (excesso.excede && excesso.cabeNoArt125) {
    acoes.push({
      chave: 'excesso-regularizavel',
      titulo: 'Execução além do contratado — regularizável por aditivo',
      detalhe: <>{excesso.frase} São {fmt(excesso.quanto)} a mais que o contratado. {excesso.providencia}</>,
      tom: 'atencao',
      acao: (
        <Button asChild size="sm" variant="outline" className="g-controle">
          <Link to={abaDoContrato('contratos-aditivos')}>Registrar aditivo</Link>
        </Button>
      ),
    });
  }
  if (reajusteDevido && reajuste) {
    acoes.push({
      chave: 'reajuste-devido',
      titulo: 'Reajuste por índice devido',
      detalhe: (
        <>
          Desde {dataBr(reajuste.aniversario)}
          {(c as any)?.indice_reajuste ? ` (${(c as any).indice_reajuste})` : ''} — o interregno de 1 ano se
          cumpriu. Aplicação por apostila (art. 136, I); registre o pedido formal antes de assinar qualquer
          aditivo. Detalhes e estimativa no cartão “Reajuste por índice”, ao lado.
        </>
      ),
      tom: 'atencao',
    });
  }
  if (fisicoParado) {
    acoes.push({
      chave: 'fisico-parado',
      titulo: 'Consumo financeiro sem lastro físico',
      detalhe: 'Há contratos derivados somando valor, mas nenhum quilo foi baixado dos itens da ata. Abra o contrato derivado → Itens/Lotes e preencha as quantidades.',
      tom: 'atencao',
      acao: (
        <Button asChild size="sm" variant="outline" className="g-controle">
          <Link to={abaDoContrato('contratos-derivados')}>Ver contratos derivados</Link>
        </Button>
      ),
    });
  }
  if (alertasSaldoVisiveis.length > 0) {
    acoes.push({
      chave: 'saldo-de-itens',
      titulo: alertasSaldoVisiveis.some(saldoEsgotado)
        ? `${alertasSaldoVisiveis.length} item(ns) com saldo baixo ou esgotado`
        : `${alertasSaldoVisiveis.length} item(ns) com saldo baixo`,
      detalhe: alertasSaldoVisiveis
        .slice(0, 3)
        .map((i: any) => `${i.descricao} (${fraseDoSaldo(i)})`)
        .join(' · '),
      tom: 'atencao',
      acao: (
        <Button asChild size="sm" variant="outline" className="g-controle">
          <Link to={abaDoContrato('itens')}>Conferir Itens/Lotes</Link>
        </Button>
      ),
    });
  }
  if (!isAtaSrp && podeVerCustos && custoDoFinanceiro === 0) {
    acoes.push({
      chave: 'sem-custo-atribuido',
      titulo: 'Nenhuma despesa atribuída a este contrato',
      detalhe: 'Enquanto nada for atribuído, o realizado é só o custo digitado. A atribuição se faz pelo ícone de elo em Financeiro › Contas a Pagar.',
      tom: 'ativo',
      acao: (
        <Button asChild size="sm" variant="outline" className="g-controle">
          <Link to="/financeiro/a_pagar">Abrir Contas a Pagar</Link>
        </Button>
      ),
    });
  }
  // ── O fim do contrato: o sistema sugere, quem opera declara (21/09) ──────
  //
  // Encerrado, as pendências de saldo, vigência, forma de fornecimento,
  // reajuste e teto decenal deixam de existir — não há próximo pedido a
  // proteger nem prazo a renovar. Ficam as que ainda pedem registro: a
  // execução acima do valor (o aditivo que faltou), o consumo sem lastro
  // físico e a despesa não atribuída.
  const SOBREVIVEM_AO_ENCERRAMENTO = new Set(['excesso-fora-do-125', 'excesso-regularizavel', 'fisico-parado', 'sem-custo-atribuido']);
  const pendencias: AcaoPendente[] = encerrado ? acoes.filter((a) => SOBREVIVEM_AO_ENCERRAMENTO.has(a.chave)) : [...acoes];
  const nomeDoInstrumento = isAtaSrp ? 'a ata' : 'o contrato';
  if (encerrado && aditivoPosterior) {
    pendencias.unshift({
      chave: 'reabrir-por-aditivo',
      titulo: `Aditivo ${aditivoPosterior.numero} assinado após o encerramento — reabrir ${nomeDoInstrumento}?`,
      detalhe: `Assinado em ${dataBr(aditivoPosterior.data)}, depois do encerramento em ${dataBr(c.data_encerramento) ?? '—'}. `
        + 'Aditivo depois do fim diz que o fornecimento continuou: reabra para a carteira e os pedidos voltarem a valer.',
      tom: 'atencao',
      acao: (
        <Button size="sm" variant="outline" className="g-controle" onClick={() => setReabrirAberto(true)}>
          <RotateCcw aria-hidden="true" /> Reabrir {nomeDoInstrumento}
        </Button>
      ),
    });
  }
  if (encerrado && c.motivo_encerramento === 'nao_informado') {
    pendencias.unshift({
      chave: 'encerrado-sem-motivo',
      titulo: 'Encerrado sem motivo registrado',
      detalhe: 'A situação foi alterada para Encerrado sem dizer por quê. O relatório e a trilha precisam do motivo e da data.',
      tom: 'atencao',
      acao: (
        <Button size="sm" variant="outline" className="g-controle" onClick={() => setEncerrarAberto(true)}>
          Informar o motivo
        </Button>
      ),
    });
  }
  if (sugestaoEncerramento) {
    // A pergunta substitui o aviso seco de vigência vencida: é o mesmo fato,
    // agora com as duas saídas — aditivo ou encerramento.
    if (sugestaoEncerramento.motivo === 'prazo_vencido') {
      const i = pendencias.findIndex((a) => a.chave === 'vigencia-vencida');
      if (i >= 0) pendencias.splice(i, 1);
    }
    pendencias.unshift({
      chave: 'encerramento',
      titulo: sugestaoEncerramento.titulo,
      detalhe: sugestaoEncerramento.detalhe,
      tom: sugestaoEncerramento.motivo === 'prazo_vencido' ? 'critico' : 'atencao',
      acao: (
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline" className="g-controle">
            <Link to={abaDoContrato('contratos-aditivos')}>Registrar aditivo de {sugestaoEncerramento.aditivo}</Link>
          </Button>
          <Button size="sm" variant="outline" className="g-controle" onClick={() => setEncerrarAberto(true)}>
            Encerrar {nomeDoInstrumento}
          </Button>
        </div>
      ),
    });
  }

  return (
    <div className="documento impressao-em-coluna flex min-w-0 flex-col gap-4">
      {/* Só aparece no papel: a folha sai da impressora sem saber de que
          empresa e de que contrato ela fala, e vai parar dentro de um
          processo administrativo. */}
      <CabecalhoDoDocumento
        titulo={isAtaSrp ? 'Relatório de Consumo de Ata' : 'Relatório de Execução Contratual'}
        referencia={c.objeto ?? undefined}
        identificador={[
          isAtaSrp ? c.numero_ata : c.numero_contrato,
          c.orgao_contratante,
        ].filter(Boolean).join(' — ') || undefined}
      />

      <div className="nao-imprime flex flex-wrap justify-end gap-2">
        <BotaoImprimir />
        {isAtaSrp && (
          <>
            <ManutencaoAtaSrpDialog ataId={contratoId} ataNumero={c.numero_ata || c.numero_contrato} />
            <RelatorioConsumoAtaDialog ataId={contratoId} ataNumero={c.numero_ata || c.numero_contrato} />
          </>
        )}
      </div>

      {/* ── Publicações e documentos ─────────────────────────────────────────
          DESVIO DELIBERADO da referência, que põe este bloco no fim do Resumo.
          Ele fica no topo porque a regra existente vence a composição: antes de
          qualquer número, o contrato já produz efeitos? Executar sob ajuste
          ineficaz é entregar sem título que sustente a cobrança, e nenhum
          indicador de consumo importa antes dessa resposta.

          É o mesmo componente: `ContratoEficacia` guarda o veredito de eficácia
          E a tabela de extratos publicados (`contrato_publicacoes`), com o
          recorte do Diário anexado a cada um. Separar os dois exigiria partir
          um componente que se recolhe sozinho quando a migration falta — a
          degradação que o comando manda preservar. */}
      <section className="flex min-w-0 flex-col gap-2">
        <h2 className="g-titulo-secao text-foreground">Publicações e documentos</h2>
        <ContratoEficacia contratoId={contratoId} />
      </section>

      {/* ── O fato declarado (21/09) ─────────────────────────────────────────
          Sai no papel também: o relatório de execução precisa dizer que o
          contrato terminou, quando e por quê. Só os botões ficam na tela. */}
      {encerrado && (
        <Alert className="bloco-inteiro">
          <CheckCircle2 aria-hidden="true" />
          <AlertTitle>
            {isAtaSrp ? 'Ata encerrada' : 'Contrato encerrado'}
            {dataBr(c.data_encerramento) ? ` em ${dataBr(c.data_encerramento)}` : ''} · {rotuloDoMotivo(c.motivo_encerramento)}
          </AlertTitle>
          <AlertDescription className="text-muted-foreground">
            {MOTIVOS_ENCERRAMENTO[(c.motivo_encerramento ?? 'nao_informado') as MotivoEncerramento]?.explicacao
              ?? MOTIVOS_ENCERRAMENTO.nao_informado.explicacao}
            {Number(saldoRemanescente) > 0 && <> Saldo não executado: {fmt(Number(saldoRemanescente))}.</>}
            {' '}Pedido novo fica barrado; os já lançados seguem editáveis, com notas e quitações.
            <div className="nao-imprime mt-2 flex flex-wrap gap-2">
              {c.motivo_encerramento === 'nao_informado' && (
                <Button size="sm" variant="outline" className="g-controle" onClick={() => setEncerrarAberto(true)}>
                  Informar o motivo
                </Button>
              )}
              <Button size="sm" variant="outline" className="g-controle" onClick={() => setReabrirAberto(true)}>
                <RotateCcw aria-hidden="true" /> Reabrir {isAtaSrp ? 'a ata' : 'o contrato'}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {entregaUnicaEmAndamento && (
        <Alert className="nao-imprime">
          <CheckCircle2 aria-hidden="true" />
          <AlertTitle>Entrega única — fornecimento integral pedido, entrega em andamento</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            Os pedidos lançados cobrem todo o fornecimento ({pedidosEntregues} de {pedidosAtivosTotal} entregues).
            Saldo esgotado aqui é compromisso, não conclusão: o contrato conclui quando os pedidos forem marcados
            como Entregues, na aba Pedidos.
          </AlertDescription>
        </Alert>
      )}

      {entregaUnicaConcluida && !encerrado && (
        <Alert variant="success" className="nao-imprime">
          <CheckCircle2 aria-hidden="true" />
          <AlertTitle>Entrega única concluída</AlertTitle>
          <AlertDescription>
            O fornecimento integral foi entregue e o saldo se esgotou — aqui isso é conclusão,
            não alerta. Se não restam outras obrigações, encerre o contrato: a decisão fica
            registrada com data e motivo, e o saldo sai da carteira.
            <div className="mt-2">
              <Button size="sm" variant="outline" className="g-controle" onClick={() => setEncerrarAberto(true)}>
                Encerrar o contrato
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* ── Coluna principal + painel de contexto ────────────────────────────
          Duas colunas a partir de 1280px, empilhadas abaixo disso. É a
          composição da referência, montada com grid e não com `AreaComPainel`:
          aquele componente transforma o painel em GAVETA em tela estreita, e a
          gaveta precisa de algo que a abra. Aqui o painel não é o detalhe de um
          registro selecionado — é a ficha do contrato, que tem de continuar
          legível no celular. Empilhar é o que entrega isso; a gaveta esconderia
          vigência e reajuste atrás de um botão que a referência não tem. */}
      {/* `impressao-em-coluna`: no papel a grade e o painel viram blocos
          empilhados (regra em `@media print`) — em grade/flex o Chrome
          desenhava a folha de assinaturas por cima do painel. */}
      <div className="impressao-em-coluna grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_var(--g-painel)]">
        <div className="flex min-w-0 flex-col gap-4">
          <FaixaIndicadores itens={indicadores} />

          <SecaoDoDocumento numero="2" titulo="Execução do contrato">
            <div className="flex flex-col gap-4">
              {/* Os dois cartões lado a lado da referência. */}
              <div className="grid items-start gap-4 lg:grid-cols-2">
                <Card className="flex flex-col gap-3 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-base font-semibold leading-6 text-foreground">Execução do contrato</h3>
                    <SeloSituacao
                      tom={pctConsumo >= 100 ? 'critico' : pctConsumo >= 80 ? 'atencao' : 'ativo'}
                      explicacao="Percentual do valor global já consumido pelos pedidos lançados"
                    >
                      {pctConsumo.toFixed(1)}% consumido
                    </SeloSituacao>
                  </div>

                  <div>
                    <Progress value={Math.min(pctConsumo, 100)} className="h-2" />
                    <p className="g-meta mt-1 text-muted-foreground">
                      base: soma dos pedidos não cancelados sobre o valor global vigente
                    </p>
                  </div>

                  <ListaDeCampos
                    campos={[
                      {
                        rotulo: 'Valor global (com aditivos)',
                        numerico: true,
                        valor: editingGlobal ? (
                          <span className="flex items-center justify-end gap-1">
                            <MoneyInput
                              value={parseFloat(globalInput) || 0}
                              onValueChange={v => setGlobalInput(String(v))}
                              className="h-8 w-36 text-sm"
                              autoFocus
                            />
                            <Button size="icon" className="h-8 w-8 shrink-0" aria-label="Salvar o valor global" onClick={async () => {
                              const newVal = parseFloat(globalInput) || 0;
                              const { error } = await supabase.from('contratos').update({ valor_global: newVal, valor_global_original: newVal } as any).eq('id', contratoId);
                              if (error) { toast.error('Erro ao atualizar'); return; }
                              toast.success('Valor Global atualizado!');
                              setEditingGlobal(false);
                              // Relê o contrato: o gatilho recalcula saldo e consumo.
                              const res = await supabase.from('contratos').select('*').eq('id', contratoId).single();
                              if (res.data) setData(prev => prev ? { ...prev, contrato: res.data } : prev);
                            }}><Check aria-hidden="true" className="h-3.5 w-3.5" /></Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" aria-label="Cancelar a edição do valor global" onClick={() => setEditingGlobal(false)}>
                              <X aria-hidden="true" className="h-3.5 w-3.5" />
                            </Button>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5">
                            {valorGlobalEfetivo > 0 ? fmt(valorGlobalEfetivo) : <ValorIndisponivel />}
                            {podeVerCustos && (
                              <Button
                                variant="ghost" size="icon" className="h-6 w-6 nao-imprime"
                                title="Editar o valor global do contrato"
                                aria-label="Editar o valor global do contrato"
                                onClick={() => { setEditingGlobal(true); setGlobalInput(String(c.valor_global || 0)); }}
                              >
                                <Pencil aria-hidden="true" className="h-3 w-3" />
                              </Button>
                            )}
                          </span>
                        ),
                      },
                      {
                        rotulo: 'Valor executado',
                        numerico: true,
                        // Zero aqui é fato — nenhum pedido lançado —, e a linha
                        // do detalhe diz isso. Nulo é ausência de apuração.
                        valor: c.valor_consumido == null
                          ? <ValorIndisponivel />
                          : fmt(Number(c.valor_consumido)),
                      },
                      {
                        rotulo: 'Pedidos entregues',
                        numerico: true,
                        valor: pedidosAtivosTotal === 0
                          ? <span className="text-muted-foreground">nenhum pedido lançado</span>
                          : `${pedidosEntregues} de ${pedidosAtivosTotal}`,
                      },
                      {
                        rotulo: 'Prazo decorrido',
                        numerico: true,
                        valor: prazoDecorrido
                          ? `${prazoDecorrido.pct.toFixed(0)}% de ${prazoDecorrido.dias} dias`
                          : <ValorIndisponivel razao="Vigência a informar" />,
                      },
                      {
                        rotulo: isAtaSrp ? 'Itens registrados' : 'Itens do contrato',
                        numerico: true,
                        valor: (
                          <span className="inline-flex items-center gap-2">
                            {data!.itens.length}
                            {itensAlertaSaldo.length > 0 && (
                              <Badge variant="warning">
                                {itensAlertaSaldo.length} em alerta
                              </Badge>
                            )}
                          </span>
                        ),
                      },
                      {
                        rotulo: isAtaSrp ? 'Empenhos diretos' : 'Pedidos lançados',
                        numerico: true,
                        valor: pedidosAtivos.length,
                      },
                    ]}
                  />
                </Card>

                <Card className="flex flex-col gap-3 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="flex items-center gap-2 text-base font-semibold leading-6 text-foreground">
                      <ListChecks className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      Próximas ações
                    </h3>
                    {pendencias.length > 0 && (
                      <span className="g-meta tabular-nums text-muted-foreground">{pendencias.length} pendente(s)</span>
                    )}
                  </div>
                  {pendencias.length === 0 ? (
                    <p className="g-corpo text-muted-foreground">
                      Nada pendente por aqui: vigência em dia, execução dentro do contratado e nenhum
                      saldo de item em alerta.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-3">
                      {pendencias.map((a) => (
                        <li key={a.chave} className="flex flex-col gap-1.5 border-b border-border/70 pb-3 last:border-0 last:pb-0">
                          <SeloSituacao tom={a.tom} className="self-start">{a.titulo}</SeloSituacao>
                          <p className="g-meta text-muted-foreground">{a.detalhe}</p>
                          {a.acao && <div className="nao-imprime">{a.acao}</div>}
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>

              {/* ── ATA SRP: a segunda linha fala a língua da ata ─────────────
                  Faturamento/custos/lucro são dos CONTRATOS que aderiram aos
                  quantitativos — mostrá-los aqui zerados fingia execução parada
                  numa ata 100% consumida (09/09). O que a ata responde é: quem
                  consumiu, quanto resta, e a exceção do empenho de entrega única
                  (que consome a ata sem contrato no meio). */}
              {isAtaSrp && (() => {
                const derivados = data!.derivados || [];
                const consumoDerivados = Number(c.valor_consumido) || 0;
                const empenhosDiretos = pedidosAtivos.reduce((s: number, p: any) => s + (Number(p.valor_total) || 0), 0);
                const saldoAta = valorGlobalEfetivo - consumoDerivados - empenhosDiretos;
                return (
                  <SecaoRecolhivel
                    id={`contrato-consumo-ata-${contratoId}`}
                    manterNoPapel
                    classNameTitulo="text-base font-semibold leading-6 text-foreground"
                    titulo={<>Consumo da ata</>}
                  >
                    <div className="grade-kpi mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
                      <Card className="bloco-inteiro flex flex-col gap-1 p-4">
                        <div className="text-sm font-medium leading-5 text-muted-foreground">Consumido pelos contratos derivados</div>
                        <p className="valor-kpi text-2xl font-semibold leading-8 tabular-nums text-foreground">{fmt(consumoDerivados)}</p>
                        <p className="g-meta text-muted-foreground">
                          {derivados.length} contrato{derivados.length === 1 ? '' : 's'} · {valorGlobalEfetivo > 0 ? ((consumoDerivados / valorGlobalEfetivo) * 100).toFixed(1) : '0'}% do registrado
                        </p>
                      </Card>
                      <Card className="bloco-inteiro flex flex-col gap-1 p-4">
                        <div className="text-sm font-medium leading-5 text-muted-foreground">Empenhos diretos (entrega única)</div>
                        {pedidosAtivos.length > 0 ? (
                          <>
                            <p className="valor-kpi text-2xl font-semibold leading-8 tabular-nums text-foreground">{fmt(empenhosDiretos)}</p>
                            <p className="g-meta text-muted-foreground">{pedidosAtivos.length} empenho{pedidosAtivos.length === 1 ? '' : 's'} consumindo a ata sem contrato</p>
                          </>
                        ) : (
                          <>
                            <p className="text-2xl font-semibold leading-8 text-muted-foreground">—</p>
                            <p className="g-meta text-muted-foreground">nenhum — todo o consumo vem dos contratos</p>
                          </>
                        )}
                      </Card>
                      <Card className="bloco-inteiro flex flex-col gap-1 p-4">
                        <div className="text-sm font-medium leading-5 text-muted-foreground">Contratos derivados</div>
                        {derivados.length === 0 ? (
                          <p className="g-corpo text-muted-foreground">nenhum ainda</p>
                        ) : (
                          <div className="space-y-0.5">
                            {derivados.slice(0, 3).map(d => (
                              <Link key={d.id} to={`/gestao-contratos?contrato=${d.id}`}
                                className="g-meta block font-medium hover:text-primary hover:underline truncate nao-imprime">
                                {d.numero_contrato || '(sem número)'} · {fmt(d.valor_global)}
                              </Link>
                            ))}
                            {derivados.length > 3 && (
                              <p className="g-meta text-muted-foreground">+{derivados.length - 3} — aba Contratos derivados</p>
                            )}
                          </div>
                        )}
                      </Card>
                      <Card className="bloco-inteiro flex flex-col gap-1 p-4">
                        <div className="text-sm font-medium leading-5 text-muted-foreground">Saldo da ata</div>
                        <p className={`valor-kpi text-2xl font-semibold leading-8 tabular-nums ${saldoAta > 0.005 ? 'text-success-ink' : saldoAta < -0.005 ? 'text-destructive-ink' : 'text-foreground'}`}>{fmt(saldoAta)}</p>
                        <p className="g-meta text-muted-foreground">registrado − derivados − empenhos diretos</p>
                      </Card>
                    </div>
                  </SecaoRecolhivel>
                );
              })()}

              {/* ── Resultado financeiro ──────────────────────────────────────
                  Recolhível porque é consulta de quem fecha o mês, não leitura
                  de quem abre o contrato para ver como vai a execução — e eram
                  quatro cartões grandes empurrando tudo para fora da primeira
                  dobra. Nada saiu: os quatro números, a quebra pago/a pagar e o
                  confronto com o previsto continuam aqui, inteiros. */}
              {!isAtaSrp && podeVerCustos && (
                <SecaoRecolhivel
                  id={`contrato-resultado-${contratoId}`}
                  manterNoPapel
                  classNameTitulo="text-base font-semibold leading-6 text-foreground"
                  titulo={<>Resultado financeiro</>}
                >
                  <div className="mt-3 flex flex-col gap-3">
                    <div className="grade-kpi grid grid-cols-2 gap-4 sm:grid-cols-4">
                      <Card className="bloco-inteiro flex flex-col gap-1 p-4">
                        <div className="text-sm font-medium leading-5 text-muted-foreground">Faturamento</div>
                        <p className="valor-kpi text-2xl font-semibold leading-8 tabular-nums text-foreground">{fmt(faturamento)}</p>
                        {/* Regra 2 do comando: o indicador declara a base. */}
                        <p className="g-meta text-muted-foreground">soma dos pedidos não cancelados</p>
                      </Card>
                      <Card className="bloco-inteiro flex flex-col gap-1 p-4">
                        <div className="text-sm font-medium leading-5 text-muted-foreground">Custos Totais</div>
                        <p className="valor-kpi text-2xl font-semibold leading-8 tabular-nums text-destructive-ink">
                          {custoApurado ? fmt(totalCustos) : <ValorIndisponivel />}
                        </p>
                        {/* Um cartão, a quebra embaixo. Margem é o que se olha de relance;
                            dois cartões competindo pelo mesmo olhar confundem.

                            PAGO e COMPROMETIDO separados porque respondem perguntas
                            diferentes: o comprometido já é custo pelo regime de
                            competência — escondê-lo infla a margem —, mas não saiu do
                            caixa, e somá-los apagaria a posição de caixa. */}
                        {custoPago > 0 && (
                          <p className="g-meta text-muted-foreground">Pago: {fmt(custoPago)}</p>
                        )}
                        {custoComprometido > 0 && (
                          <p className="g-meta text-warning-ink">A pagar: {fmt(custoComprometido)}</p>
                        )}
                        {custoDeclaradoSemDocumento > 0 && (
                          <p className="g-meta text-warning-ink">Declarado sem documento: {fmt(custoDeclaradoSemDocumento)}</p>
                        )}
                        <p className="g-meta text-muted-foreground">
                          base: despesas atribuídas (Financeiro) + custos digitados + custo declarado nos pedidos ainda sem documento
                        </p>
                      </Card>
                      {/* Lucro sem custo apurado não é lucro: seria o faturamento
                          inteiro, com margem de 100%, dito com a mesma cara de
                          um número conferido. */}
                      <Card className="bloco-inteiro flex flex-col gap-1 p-4">
                        <div className="text-sm font-medium leading-5 text-muted-foreground">Lucro Bruto</div>
                        <p className={`valor-kpi text-2xl font-semibold leading-8 tabular-nums ${lucroBruto >= 0 ? 'text-success-ink' : 'text-destructive-ink'}`}>
                          {custoApurado ? fmt(lucroBruto) : <ValorIndisponivel />}
                        </p>
                        {custoApurado && <p className="g-meta text-muted-foreground">Margem: {margemBruta.toFixed(1)}%</p>}
                        <p className="g-meta text-muted-foreground">faturamento − custos diretos</p>
                      </Card>
                      <Card className="bloco-inteiro flex flex-col gap-1 p-4">
                        <div className="text-sm font-medium leading-5 text-muted-foreground">Lucro Líquido</div>
                        <p className={`valor-kpi text-2xl font-semibold leading-8 tabular-nums ${lucroLiquido >= 0 ? 'text-success-ink' : 'text-destructive-ink'}`}>
                          {custoApurado ? fmt(lucroLiquido) : <ValorIndisponivel />}
                        </p>
                        {custoApurado && <p className="g-meta text-muted-foreground">Margem: {margemLiquida.toFixed(1)}%</p>}
                        <p className="g-meta text-muted-foreground">faturamento − custos totais</p>
                      </Card>
                    </div>

                    {/* ── O que a proposta previu, contra o que aconteceu ───────
                        O previsto sai da Precificação, que gravou `custo_unitario`
                        em cada item. É a única comparação que fecha o ciclo: sem
                        ela, a Precificação estima, a empresa executa, e a
                        estimativa seguinte parte do mesmo lugar da anterior — a
                        execução nunca volta.

                        Comparado só sobre o que JÁ FOI ENTREGUE. Confrontar o
                        custo realizado de 40% do contrato com o previsto de 100%
                        dele daria um desvio que não existe. */}
                    {custoPrevistoDoEntregue > 0 && (
                      <Card className="p-4">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <h4 className="text-base font-semibold leading-6 text-foreground">Custo previsto × realizado</h4>
                          <span className="g-meta text-muted-foreground">sobre o que já foi entregue</span>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-3">
                          <div>
                            <p className="g-meta text-muted-foreground">Previsto na proposta</p>
                            <p className="g-corpo font-semibold tabular-nums">{fmt(custoPrevistoDoEntregue)}</p>
                          </div>
                          <div>
                            <p className="g-meta text-muted-foreground">Realizado</p>
                            <p className="g-corpo font-semibold tabular-nums">{fmt(custoDoFinanceiro + totalCustosTabela)}</p>
                          </div>
                          <div>
                            <p className="g-meta text-muted-foreground">Desvio</p>
                            {/* O sinal matemático lia-se como prejuízo ("por que menos 25%?",
                                09/09). O número diz o afastamento; a palavra diz o LADO —
                                economia ou estouro — e ninguém precisa decifrar convenção. */}
                            {/* "Economia" só quando a cobertura fecha (22/09): comparar
                                um custo pela metade com o previsto inteiro sempre
                                parece economia. */}
                            <p className={`g-corpo font-semibold tabular-nums ${
                              desvioDeCusto === null ? '' : desvioDeCusto > 0 ? 'text-destructive-ink' : custoIncompleto ? 'text-warning-ink' : 'text-success-ink'
                            }`}>
                              {desvioDeCusto === null
                                ? <ValorIndisponivel />
                                : textoDoDesvio(desvioDeCusto, custoIncompleto, cobertura.pct)}
                            </p>
                          </div>
                        </div>
                        {/* Custo acima do previsto durante a execução é o que sustenta um
                            pedido de reequilíbrio — e ele exige demonstrar o desequilíbrio
                            com números, não com impressão. */}
                        {desvioDeCusto !== null && desvioDeCusto > 10 && (
                          <p className="g-meta text-warning-ink mt-2">
                            O custo está {desvioDeCusto.toFixed(1)}% acima do previsto na proposta. Se a causa for
                            externa e imprevisível, é a base para pedir reequilíbrio econômico-financeiro
                            (art. 124, II, “d” da Lei 14.133/2021) — que exige demonstrar o desequilíbrio com números.
                          </p>
                        )}
                        {custoDoFinanceiro === 0 && (
                          <p className="g-meta text-muted-foreground mt-2">
                            Nenhuma despesa foi atribuída a este contrato ainda. Atribua pelo ícone de elo em
                            Financeiro › Contas a Pagar para que o realizado deixe de ser só o custo digitado.
                          </p>
                        )}
                      </Card>
                    )}

                    {/* ── Cobertura de custo (22/09): declarado × comprovado ──────
                        O declarado é a exceção (gerencial); o comprovado são as
                        contas a pagar do contrato, distribuídas aos pedidos. */}
                    {(cob || custoPedidos > 0 || custoDoFinanceiro > 0) && (
                      <Card className="p-4">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <h4 className="text-base font-semibold leading-6 text-foreground">Cobertura de custo</h4>
                          <span className="g-meta text-muted-foreground">declarado nos pedidos × comprovado em contas a pagar</span>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-4">
                          <div>
                            <p className="g-meta text-muted-foreground">Declarado nos pedidos</p>
                            <p className="g-corpo font-semibold tabular-nums">{custoPedidos > 0 ? fmt(custoPedidos) : <ValorIndisponivel />}</p>
                          </div>
                          <div>
                            <p className="g-meta text-muted-foreground">Contas a pagar do contrato</p>
                            <p className="g-corpo font-semibold tabular-nums">{fmt(custoDoFinanceiro)}</p>
                            {cobertura.aDistribuir > 0.01 && (
                              <p className="g-meta text-warning-ink">{fmt(cobertura.aDistribuir)} ainda sem pedido</p>
                            )}
                          </div>
                          <div>
                            <p className="g-meta text-muted-foreground">Declarado sem documento</p>
                            <p className="g-corpo font-semibold tabular-nums">{fmt(custoDeclaradoSemDocumento)}</p>
                          </div>
                          <div>
                            <p className="g-meta text-muted-foreground">Cobertura</p>
                            <p className="g-corpo font-semibold tabular-nums">
                              {cobertura.pct === null ? <ValorIndisponivel /> : `${cobertura.pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`}
                            </p>
                          </div>
                        </div>
                        {cob && situacoesDoContrato(cob).length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {situacoesDoContrato(cob).map(s => (
                              <SeloSituacao key={s.chave} tom={ROTULO_SITUACAO[s.chave].tom}>
                                {s.n} {s.n === 1 ? 'pedido' : 'pedidos'}: {ROTULO_SITUACAO[s.chave].rotulo.toLowerCase()}
                              </SeloSituacao>
                            ))}
                          </div>
                        )}
                        <p className="g-meta text-muted-foreground mt-2">
                          O custo declarado é gerencial e é substituído à medida que a nota de entrada ou a conta a pagar chega ao pedido
                          (Pedidos › Compras deste pedido). Só entra no custo total o que as contas a pagar ainda não cobrem.
                        </p>
                      </Card>
                    )}
                  </div>
                </SecaoRecolhivel>
              )}

              {/* Aviso para não-financeiros — só onde há custo escondido (contrato) */}
              {!isAtaSrp && !podeVerCustos && (
                <Card className="border-dashed border-input p-4 shadow-none">
                  <div className="g-meta flex items-center gap-2 text-muted-foreground">
                    <Lock aria-hidden="true" className="h-4 w-4 shrink-0" />
                    <span>Custos, margens e lucratividade são visíveis apenas para o setor Financeiro e Administradores.</span>
                  </div>
                </Card>
              )}

              <DeOndeVem
                id={`contrato-de-onde-vem-${contratoId}`}
                itens={isAtaSrp ? [
                  { numero: 'Valor global', origem: 'valor registrado na ata' },
                  { numero: 'Consumido', origem: 'soma das contratações derivadas (sem os reequilíbrios/reajustes delas, que não sacam a ata) e dos empenhos diretos de entrega única' },
                  { numero: 'Contratos derivados', origem: 'contratações que aderiram aos quantitativos registrados', ondeEditar: 'Contratos derivados' },
                  { numero: 'Itens', origem: 'quantitativos registrados; o consumido de cada item vem dos contratos derivados', ondeEditar: 'Itens/Lotes' },
                ] : [
                  { numero: 'Valor original', origem: 'valor do contrato antes dos aditivos, como o documento o registrou', ondeEditar: 'lápis do Valor global' },
                  { numero: 'Aditivos', origem: 'acréscimos menos supressões dos termos registrados', ondeEditar: 'Arquivos e Aditivos' },
                  { numero: 'Valor global', origem: 'valor original do contrato mais os aditivos de acréscimo', ondeEditar: 'Arquivos e Aditivos' },
                  { numero: 'Saldo', origem: 'valor global menos o que os pedidos já consumiram' },
                  { numero: 'Faturado', origem: 'soma dos pedidos lançados', ondeEditar: 'Pedidos' },
                  { numero: 'Custos', origem: 'despesas atribuídas no Financeiro (pagas e comprometidas), custos digitados e o custo declarado nos pedidos que as contas a pagar ainda não cobrem', ondeEditar: 'Financeiro › Contas a Pagar e Pedidos › Editar' },
                  { numero: 'Itens', origem: 'linhas cadastradas', ondeEditar: 'Itens/Lotes' },
                ]}
              />
            </div>
          </SecaoDoDocumento>

          {/* ── Seção 1: Alertas ─────────────────────────────────────────────
              Continua sendo a seção 1 do documento — é por esse número que o
              órgão a cita. Na tela ela vem depois da execução porque a urgência
              já foi para o alto, em "Próximas ações" e no aviso destacado; aqui
              fica o texto completo de cada alerta, para quem precisa do teor.
              Recolhida por padrão, e `manterNoPapel` garante que o relatório
              impresso sai com os alertas ainda que a tela os esconda. */}
          {(alertasSaldoVisiveis.length > 0 || vigencia.vencido || vigencia.vencendo || fisicoParado || reajusteDevido || excesso.excede) && (
            <SecaoDoDocumento numero="1" titulo="Alertas">
              <div className={`rounded-lg border p-4 ${vigencia.vencido ? 'bg-destructive-tint border-destructive-line' : 'bg-warning-tint border-warning-line'}`}>
                <SecaoRecolhivel
                  id={`contrato-alertas-${contratoId}`}
                  recolhidaPorPadrao
                  manterNoPapel
                  classNameIcone={vigencia.vencido ? 'text-destructive-ink' : 'text-warning-ink'}
                  icone={<AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${vigencia.vencido ? 'text-destructive-ink' : 'text-warning-ink'}`} aria-hidden="true" />}
                  titulo={
                    <span className={`g-corpo font-semibold ${vigencia.vencido ? 'text-destructive-ink' : 'text-warning-ink'}`}>
                      Alertas do contrato
                    </span>
                  }
                >
                  <div className="mt-2 space-y-2">
                    {vigencia.vencido && (
                      <p className="g-meta text-destructive-ink">
                        <strong>{vigencia.frase}</strong> (em {dataBr(c.data_fim) ?? '—'}).
                        {' '}Se houve prorrogação, registre o aditivo de prazo para a vigência voltar a valer.
                      </p>
                    )}
                    {!vigencia.vencido && vigencia.vencendo && <p className="g-meta text-warning-ink">{vigencia.frase}</p>}
                    {decenal && (decenal.ultrapassa || !decenal.ultimaProrrogacaoAnualCabe) && (
                      <p className={`g-meta ${decenal.ultrapassa ? 'text-destructive-ink' : 'text-warning-ink'}`}>
                        <strong>Teto decenal:</strong> {decenal.frase}
                      </p>
                    )}
                    {fisicoParado && (
                      <p className="g-meta text-warning-ink">
                        <strong>Consumo financeiro sem lastro físico:</strong> há contratos derivados somando
                        valor, mas nenhum quilo foi baixado dos itens da ata. Abra o contrato derivado →
                        Itens/Lotes e preencha as quantidades (o lápis edita).
                      </p>
                    )}
                    {/* ── A ressalva do excesso, enquanto durar ────────────────
                        O aviso de `avaliarCabimento` sai no instante do lançamento e
                        some. Quem abre o contrato amanhã vê consumo acima de 100% e nada
                        que diga o que fazer. Aviso que só existe no clique é aviso que
                        ninguém audita.

                        Duas mensagens, porque as providências são opostas: dentro do
                        teto do art. 125, o aditivo regulariza; acima dele o aditivo NÃO
                        regulariza, e mandar pedi-lo manda a pessoa buscar uma solução
                        que não existe. */}
                    {excesso.excede && (
                      <div className={`rounded-md border p-2.5 ${
                        excesso.cabeNoArt125
                          ? 'border-warning-line bg-warning-tint'
                          : 'border-destructive-line bg-destructive-tint'
                      }`}>
                        <p className={`g-meta font-semibold ${
                          excesso.cabeNoArt125 ? 'text-warning-ink' : 'text-destructive-ink'
                        }`}>
                          {excesso.cabeNoArt125
                            ? 'Execução além do contratado — regularizável por aditivo'
                            : 'Execução além do que o art. 125 admite'}
                        </p>
                        <p className="g-meta text-muted-foreground mt-0.5">
                          {excesso.frase} São {fmt(excesso.quanto)} a mais que o contratado.
                        </p>
                        <p className="g-meta text-muted-foreground mt-1">{excesso.providencia}</p>
                      </div>
                    )}
                    {reajusteDevido && reajuste && (
                      <p className="g-meta text-warning-ink">
                        <strong>Reajuste por índice devido</strong> desde{' '}
                        {dataBr(reajuste.aniversario)}
                        {(c as any)?.indice_reajuste ? ` (${(c as any).indice_reajuste})` : ''} — o interregno de 1 ano
                        se cumpriu. Aplicação por apostila (art. 136, I); registre o pedido formal antes de assinar
                        qualquer aditivo. Detalhes e estimativa no card “Reajuste por índice”, ao lado.
                      </p>
                    )}
                    {alertasSaldoVisiveis.map((i: any) => (
                      <p key={i.id} className="g-meta text-warning-ink"><strong>{i.descricao}</strong>: {fraseDoSaldo(i)}</p>
                    ))}
                  </div>
                </SecaoRecolhivel>
              </div>
            </SecaoDoDocumento>
          )}

          {/* Composição de custos - apenas admin/financeiro */}
          {podeVerCustos && totalCustos > 0 && (
            <SecaoDoDocumento numero="3" titulo="Composição de custos">
              <Card className="p-4">
                <SecaoRecolhivel
                  id={`contrato-composicao-custos-${contratoId}`}
                  recolhidaPorPadrao
                  manterNoPapel
                  classNameTitulo="text-base font-semibold leading-6 text-foreground"
                  icone={<Receipt className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
                  titulo={<>Distribuição por natureza de custo — {fmt(totalCustos)}</>}
                >
                  <div className="mt-3 space-y-2">
                    {[
                      // Séries categóricas na paleta de gráfico do DS: `accent`
                      // repetia o primário e `secondary` sumia sobre o trilho `muted`.
                      { label: 'Custo declarado sem documento', valor: custoDeclaradoSemDocumento, color: 'bg-chart-1' },
                      { label: 'Custos Diretos (Outros)', valor: custosDiretos, color: 'bg-chart-3' },
                      { label: 'Desp. Administrativas', valor: despAdmin, color: 'bg-chart-2' },
                      { label: 'Frete / Logística', valor: frete, color: 'bg-chart-4' },
                      { label: 'Tributos', valor: tributos, color: 'bg-chart-5' },
                      { label: 'Outros', valor: totalCustosTabela - custosDiretos - despAdmin - frete - tributos, color: 'bg-chart-8' },
                    ].filter(x => x.valor > 0).map(item => {
                      const pct = totalCustos > 0 ? (item.valor / totalCustos) * 100 : 0;
                      return (
                        <div key={item.label} className="flex items-center gap-3">
                          <span className="g-meta w-40 shrink-0 text-muted-foreground">{item.label}</span>
                          <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                            <div className={`h-full ${item.color} rounded-full`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="g-meta w-32 whitespace-nowrap text-right font-medium tabular-nums">{fmt(item.valor)}</span>
                          <span className="g-meta w-10 text-right text-muted-foreground">{pct.toFixed(0)}%</span>
                        </div>
                      );
                    })}
                  </div>
                </SecaoRecolhivel>
              </Card>
            </SecaoDoDocumento>
          )}

          <SecaoDoDocumento numero="4" titulo={isAtaSrp ? 'Evolução mensal (empenhos diretos)' : 'Evolução mensal'}>
            <SecaoRecolhivel
              id={`contrato-evolucao-mensal-${contratoId}`}
              recolhidaPorPadrao
              manterNoPapel
              classNameTitulo="text-base font-semibold leading-6 text-foreground"
              titulo={<>Valores mês a mês</>}
            >
              <div className="mt-3">
                {isAtaSrp && pedidosAtivos.length === 0 ? (
                  <Card className="p-5 text-sm text-muted-foreground">
                    O consumo desta ata acontece pelos contratos derivados — acompanhe a execução mensal no
                    dashboard de cada contrato. Esta seção passa a valer quando houver empenho direto de
                    entrega única contra a ata.
                  </Card>
                ) : (
                  <EvolucaoMensalDashboard
                    pedidos={data!.pedidos as any[]}
                    podeVerCustos={podeVerCustos}
                    valorGlobal={valorGlobalEfetivo}
                    dataInicio={c.data_inicio}
                    dataFim={c.data_fim}
                  />
                )}
              </div>
            </SecaoRecolhivel>
          </SecaoDoDocumento>

          {/* ── Seção 5: Condições de entrega ──────────────────────────────
              Os dois cartões que a referência chama de "condições de entrega"
              e "reajuste", lado a lado. Moravam no painel lateral, e o painel
              ficou duas telas mais alto que a coluna principal: "Reajuste por
              índice" e "Links de contexto" terminavam no rodapé enquanto a
              esquerda sobrava em branco (27/09). Aqui os dois cabem na dobra
              e o painel volta a ser só a ficha do contrato. */}
          <SecaoDoDocumento numero="5" titulo="Condições de entrega">
            <div className="grid items-start gap-4 lg:grid-cols-2">
              <ContratoEntrega contratoId={contratoId} />
              <ContratoReajuste contratoId={contratoId} />
            </div>
          </SecaoDoDocumento>
        </div>

        {/* ── Painel de contexto ───────────────────────────────────────────── */}
        <aside className="impressao-em-coluna flex min-w-0 flex-col gap-4 xl:sticky xl:top-[calc(var(--g-topo)+1rem)]">
          {/* `bloco-inteiro`: a ficha do contrato vai inteira para a folha em
              que couber — fragmentá-la no meio foi o que sobrepôs a folha de
              assinaturas em 21/09. */}
          <Card className="impressao-em-coluna bloco-inteiro flex flex-col gap-5 p-5">
            <BlocoDoPainel titulo="Informações gerais">
              <ListaDeCampos
                campos={[
                  { rotulo: isAtaSrp ? 'Nº da ata' : 'Nº do contrato', valor: (isAtaSrp ? c.numero_ata : c.numero_contrato) || <ValorIndisponivel razao="Não informado" /> },
                  { rotulo: 'Órgão contratante', valor: c.orgao_contratante || <ValorIndisponivel razao="Não informado" />, largo: true },
                  { rotulo: 'Modalidade', valor: c.modalidade || <ValorIndisponivel razao="Não informada" /> },
                  {
                    rotulo: 'Fiscal do contrato',
                    valor: c.fiscal_nome || <ValorIndisponivel razao="Não designado" />,
                  },
                  ...(c.objeto
                    ? [{ rotulo: 'Objeto', largo: true, valor: <TextoExpansivel texto={String(c.objeto)} linhas={3} /> }]
                    : []),
                  // O fim declarado vai na ficha — e, por ela, no relatório impresso.
                  ...(encerrado
                    ? [{
                        rotulo: 'Encerramento',
                        largo: true,
                        valor: `${dataBr(c.data_encerramento) ?? 'data não informada'} · ${rotuloDoMotivo(c.motivo_encerramento)}`,
                      }]
                    : []),
                ]}
              />
            </BlocoDoPainel>

            {/* ── Seção 5: Vigência ─────────────────────────────────────────
                Sai da coluna principal e vem para o painel: são quatro datas e
                um lápis — dado de identificação do contrato, não medida de
                execução. O número da seção continua o mesmo, porque é ele que
                o ofício cita. */}
            <SecaoDoDocumento numero="6" titulo="Vigência">
              <div className="flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-1.5 text-base font-semibold leading-6 text-foreground">
                  <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Vigência
                </h3>
                {!editandoVigencia && (
                  <Button variant="ghost" size="icon-sm" className="nao-imprime"
                    title="Editar as datas de vigência"
                    aria-label="Editar as datas de vigência"
                    onClick={() => {
                      setVigForm({
                        assinatura: c.data_assinatura?.slice(0, 10) || '',
                        inicio: c.data_inicio?.slice(0, 10) || '',
                        fim: c.data_fim?.slice(0, 10) || '',
                      });
                      setEditandoVigencia(true);
                    }}>
                    <Pencil aria-hidden="true" className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {/* O contrato do scan chega sem datas — o documento não as rendeu — e a
                  vigência ficava em traços SEM caminho para preencher. Sem data de
                  fim, o contrato não entra em aviso de vencimento nenhum. */}
              {!editandoVigencia && !c.data_fim && (
                <p className="g-meta text-warning-ink mt-1">
                  O documento não trouxe as datas. Informe-as no lápis — sem data de fim,
                  este contrato fica fora dos avisos de vencimento.
                </p>
              )}
              {editandoVigencia && (
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  {([['Assinatura', 'assinatura'], ['Início', 'inicio'], ['Fim', 'fim']] as const).map(([rot, chave]) => (
                    <div key={chave}>
                      <span className="g-meta mb-0.5 block text-muted-foreground">{rot}</span>
                      <input type="date" className="h-9 rounded-md border border-input bg-card px-2 text-sm text-foreground shadow-sm transition-colors duration-150 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                        aria-label={rot}
                        value={vigForm[chave]}
                        onChange={e => setVigForm(f => ({ ...f, [chave]: e.target.value }))} />
                    </div>
                  ))}
                  <Button size="sm" className="h-9" aria-label="Salvar as datas de vigência" disabled={salvandoVigencia} onClick={async () => {
                    setSalvandoVigencia(true);
                    const { error } = await supabase.from('contratos').update({
                      data_assinatura: vigForm.assinatura || null,
                      data_inicio: vigForm.inicio || null,
                      data_fim: vigForm.fim || null,
                    } as any).eq('id', contratoId);
                    setSalvandoVigencia(false);
                    if (error) { toast.error('Erro ao salvar vigência', { description: error.message }); return; }
                    toast.success('Vigência atualizada.');
                    setEditandoVigencia(false);
                    // Mesmo padrão do lápis do valor: relê o contrato e atualiza o estado.
                    const res = await supabase.from('contratos').select('*').eq('id', contratoId).single();
                    if (res.data) setData(prev => prev ? { ...prev, contrato: res.data } : prev);
                  }}>
                    {salvandoVigencia ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Check aria-hidden="true" />}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-9" aria-label="Cancelar a edição da vigência" onClick={() => setEditandoVigencia(false)}>
                    <X aria-hidden="true" />
                  </Button>
                </div>
              )}
              <ListaDeCampos
                className="mt-1"
                campos={[
                  { rotulo: 'Assinatura', valor: dataBr(c.data_assinatura) ?? <ValorIndisponivel razao="A informar" /> },
                  { rotulo: 'Início', valor: dataBr(c.data_inicio) ?? <ValorIndisponivel razao="A informar" /> },
                  {
                    rotulo: 'Fim',
                    valor: c.data_fim
                      ? <span className={vigencia.vencido ? 'text-destructive-ink' : vigencia.vencendo ? 'text-warning-ink' : ''}>{dataBr(c.data_fim)}</span>
                      : <ValorIndisponivel razao="A informar" />,
                  },
                  {
                    rotulo: vigencia.vencido ? 'Situação' : 'Dias restantes',
                    valor: vigencia.frase
                      ? (
                        <SeloSituacao tom={vigencia.vencido ? 'critico' : vigencia.vencendo ? 'atencao' : 'sucesso'}>
                          {vigencia.frase}
                        </SeloSituacao>
                      )
                      : <ValorIndisponivel razao="Sem data de fim" />,
                  },
                ]}
              />
            </SecaoDoDocumento>
          </Card>

          {/* ── Links de contexto ─────────────────────────────────────────────
              Só destinos que existem de verdade. A aba do contrato mora em
              `?aba=`, então cada link recarrega a MESMA tela na aba certa — e o
              voltar do navegador funciona. */}
          <Card className="flex flex-col gap-2 p-5 nao-imprime">
            <BlocoDoPainel titulo="Links de contexto">
              <ul className="flex flex-col">
                {isAtaSrp ? (
                  <li className="border-b border-border/70 py-2.5 last:border-0">
                    <Link to={abaDoContrato('contratos-derivados')} className="g-corpo flex items-center justify-between gap-2 font-medium text-primary hover:underline">
                      <span className="inline-flex items-center gap-2"><Layers className="h-4 w-4" aria-hidden="true" /> Contratos derivados</span>
                      <span className="tabular-nums text-muted-foreground">{data!.derivados.length}</span>
                    </Link>
                  </li>
                ) : c.ata_srp_id ? (
                  <li className="border-b border-border/70 py-2.5 last:border-0">
                    <Link to={`/gestao-contratos?contrato=${c.ata_srp_id}`} className="g-corpo flex items-center gap-2 font-medium text-primary hover:underline">
                      <Layers className="h-4 w-4" aria-hidden="true" /> ATA SRP de origem
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </li>
                ) : null}
                {!isAtaSrp && (
                  <li className="border-b border-border/70 py-2.5 last:border-0">
                    <Link to={abaDoContrato('pedidos')} className="g-corpo flex items-center justify-between gap-2 font-medium text-primary hover:underline">
                      <span className="inline-flex items-center gap-2"><ShoppingCart className="h-4 w-4" aria-hidden="true" /> Pedidos vinculados</span>
                      <span className="tabular-nums text-muted-foreground">{pedidosAtivos.length}</span>
                    </Link>
                  </li>
                )}
                <li className="border-b border-border/70 py-2.5 last:border-0">
                  <Link to={abaDoContrato('itens')} className="g-corpo flex items-center justify-between gap-2 font-medium text-primary hover:underline">
                    <span className="inline-flex items-center gap-2"><Package className="h-4 w-4" aria-hidden="true" /> Itens / Lotes</span>
                    <span className="tabular-nums text-muted-foreground">{data!.itens.length}</span>
                  </Link>
                </li>
                <li className="border-b border-border/70 py-2.5 last:border-0">
                  <Link to={abaDoContrato('contratos-aditivos')} className="g-corpo flex items-center justify-between gap-2 font-medium text-primary hover:underline">
                    <span className="inline-flex items-center gap-2"><FilePlus2 className="h-4 w-4" aria-hidden="true" /> Arquivos e aditivos</span>
                    <span className="tabular-nums text-muted-foreground">{data!.aditivos.length}</span>
                  </Link>
                </li>
                {podeVerCustos && (
                  <li className="border-b border-border/70 py-2.5 last:border-0">
                    <Link to="/financeiro/a_pagar" className="g-corpo flex items-center gap-2 font-medium text-primary hover:underline">
                      <DollarSign className="h-4 w-4" aria-hidden="true" /> Financeiro › Contas a Pagar
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </li>
                )}
              </ul>
            </BlocoDoPainel>
          </Card>
        </aside>
      </div>

      {/* Só no papel. Assinar na tela seria promessa falsa — não há assinatura
          eletrônica aqui. O fiscal do órgão já está cadastrado no contrato,
          então o nome dele vem escrito; a caneta é que não. */}
      {/* ── Só no papel: o controle de pedidos e de saldos (21/09) ──────────
          Na tela essas listas vivem nas abas Pedidos e Itens/Lotes; o relatório
          impresso precisa trazê-las, senão sai só o resumo. São os mesmos
          registros já carregados por este painel — nada novo é lido.
          As duas tabelas usam `table-fixed` + largura por coluna: a regra
          global `td, th { overflow-wrap: anywhere }` faz o layout automático
          tratar cada célula como se coubesse em 1 caractere, e a descrição
          longa engolia as colunas de número — "R$ 49.4 / 00,00", "Contr /
          atado". Com largura fixa, número, data e valor levam
          `whitespace-nowrap` (nunca quebram) e as colunas foram medidas para
          o maior valor plausível (R$ 9.999.999,99, 9.999,999, dd/mm/aaaa);
          texto livre (descrição, nº do pedido, NF-e) quebra no espaço e só
          parte uma palavra que não caiba sozinha na coluna. */}
      <SecaoDoDocumento
        numero="6"
        titulo={isAtaSrp ? 'Empenhos diretos, notas e quitações' : 'Pedidos, notas e quitações'}
        className="so-impresso"
      >
        {(data!.pedidos as any[]).length === 0 ? (
          <p className="g-corpo text-muted-foreground">Nenhum pedido lançado.</p>
        ) : (
          <table className="w-full table-fixed text-[11px] leading-tight">
            <colgroup>
              <col className="w-[8%]" /><col className="w-[25%]" /><col className="w-[8%]" /><col className="w-[14%]" />
              <col className="w-[11%]" /><col className="w-[10%]" /><col className="w-[13%]" /><col className="w-[11%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-black text-left align-bottom">
                <th className="py-1 pr-2 font-semibold">Pedido</th>
                <th className="py-1 pr-2 font-semibold">Item / descrição</th>
                <th className="py-1 pr-2 text-right font-semibold">Qtd.</th>
                <th className="py-1 pr-2 text-right font-semibold">Valor</th>
                <th className="py-1 pr-2 font-semibold">Data</th>
                <th className="py-1 pr-2 font-semibold">Situação</th>
                <th className="py-1 pr-2 font-semibold">NF-e</th>
                <th className="py-1 font-semibold">Quitação</th>
              </tr>
            </thead>
            <tbody>
              {[...(data!.pedidos as any[])]
                .sort((a, b) => String(a.data_pedido ?? '').localeCompare(String(b.data_pedido ?? '')))
                .map((p: any) => (
                  <tr key={p.id} className="border-b border-border/70 align-top">
                    <td className="py-1 pr-2 tabular-nums">{p.numero_pedido}</td>
                    <td className="py-1 pr-2">
                      {p.descricao || data!.itens.find((i: any) => i.id === p.contrato_item_id)?.descricao || '—'}
                    </td>
                    <td className="whitespace-nowrap py-1 pr-2 text-right tabular-nums">{fmtQtd(p.quantidade)}</td>
                    <td className="whitespace-nowrap py-1 pr-2 text-right tabular-nums">{fmt(Number(p.valor_total) || 0)}</td>
                    <td className="whitespace-nowrap py-1 pr-2 tabular-nums">{dataBr(p.data_pedido) ?? '—'}</td>
                    <td className="py-1 pr-2">{SITUACAO_PEDIDO[p.status] ?? p.status ?? '—'}</td>
                    <td className="py-1 pr-2 tabular-nums">{p.nota_fiscal || '—'}</td>
                    <td className="py-1 tabular-nums">{p.nf_quitada ? `Quitada${p.data_quitacao ? ` em ${dataBr(p.data_quitacao)}` : ''}` : '—'}</td>
                  </tr>
                ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-black font-semibold">
                <td className="py-1 pr-2" colSpan={3}>Total dos pedidos não cancelados ({pedidosAtivos.length})</td>
                <td className="whitespace-nowrap py-1 pr-2 text-right tabular-nums">{fmt(faturamento)}</td>
                <td colSpan={4} />
              </tr>
            </tfoot>
          </table>
        )}
      </SecaoDoDocumento>

      <SecaoDoDocumento numero="7" titulo="Saldos por item" className="so-impresso">
        {(itensComAditivo as any[]).length === 0 ? (
          <p className="g-corpo text-muted-foreground">Nenhum item cadastrado.</p>
        ) : (
          <table className="w-full table-fixed text-[11px] leading-tight">
            <colgroup>
              <col className="w-[37%]" /><col className="w-[6%]" /><col className="w-[11%]" /><col className="w-[11%]" />
              <col className="w-[9%]" /><col className="w-[12%]" /><col className="w-[14%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-black text-left align-bottom">
                <th className="py-1 pr-2 font-semibold">Item</th>
                <th className="py-1 pr-2 font-semibold">Un.</th>
                <th className="py-1 pr-2 text-right font-semibold">Contratado</th>
                <th className="py-1 pr-2 text-right font-semibold">Consumido</th>
                <th className="py-1 pr-2 text-right font-semibold">Saldo</th>
                <th className="py-1 pr-2 text-right font-semibold">Vlr. unit.</th>
                <th className="py-1 text-right font-semibold">Saldo × vlr. unit.</th>
              </tr>
            </thead>
            <tbody>
              {(itensComAditivo as any[]).map((i: any) => {
                const saldo = Number(i.saldo_quantitativo_efetivo) || 0;
                const vu = Number(i.valor_unitario) || 0;
                return (
                  <tr key={i.id} className="border-b border-border/70 align-top">
                    <td className="py-1 pr-2">{i.codigo_item ? `${i.codigo_item} · ` : ''}{i.descricao}</td>
                    <td className="whitespace-nowrap py-1 pr-2">{i.unidade || '—'}</td>
                    <td className="whitespace-nowrap py-1 pr-2 text-right tabular-nums">{fmtQtd(i.quantidade_contratada_total)}</td>
                    <td className="whitespace-nowrap py-1 pr-2 text-right tabular-nums">{fmtQtd(i.quantidade_consumida)}</td>
                    <td className={`whitespace-nowrap py-1 pr-2 text-right tabular-nums ${saldo <= 0 ? 'font-semibold' : ''}`}>{fmtQtd(saldo)}</td>
                    <td className="whitespace-nowrap py-1 pr-2 text-right tabular-nums">{fmt(vu)}</td>
                    <td className="whitespace-nowrap py-1 text-right tabular-nums">{fmt(saldo * vu)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-black font-semibold">
                <td className="py-1 pr-2" colSpan={6}>Soma dos saldos por item (saldo × valor unitário)</td>
                <td className="whitespace-nowrap py-1 text-right tabular-nums">
                  {fmt((itensComAditivo as any[]).reduce((s: number, i: any) => s + (Number(i.saldo_quantitativo_efetivo) || 0) * (Number(i.valor_unitario) || 0), 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </SecaoDoDocumento>

      <FolhaDeAssinaturas
        local={c.municipio ?? undefined}
        signatarios={[
          { papel: 'Responsável pela emissão' },
          { papel: 'Gestor do contrato' },
          ...(c.fiscal_nome
            ? [{ papel: 'Fiscal do contrato (órgão)', nome: c.fiscal_nome }]
            : []),
        ]}
      />

      {/* Os diálogos do fim do contrato (21/09). Só eles escrevem — via RPC —
          e o painel atualiza o próprio estado com a resposta; a lista, ao
          lado, recarrega pelo realtime de `contratos`. */}
      <EncerrarContratoDialog
        aberto={encerrarAberto}
        aoFechar={() => setEncerrarAberto(false)}
        contratoId={contratoId}
        instrumento={isAtaSrp ? 'ata' : 'contrato'}
        motivoSugerido={encerrado ? null : sugestaoEncerramento?.motivo ?? null}
        dataSugerida={encerrado
          ? c.data_encerramento ?? null
          : sugestaoEncerramento?.motivo === 'prazo_vencido' ? c.data_fim ?? null : null}
        completarMotivo={encerrado && c.motivo_encerramento === 'nao_informado'}
        aoConcluir={(r) => setData(prev => prev
          ? { ...prev, contrato: { ...prev.contrato, status: 'encerrado', data_encerramento: r.data_encerramento, motivo_encerramento: r.motivo } }
          : prev)}
      />
      <ReabrirContratoDialog
        aberto={reabrirAberto}
        aoFechar={() => setReabrirAberto(false)}
        contratoId={contratoId}
        instrumento={isAtaSrp ? 'ata' : 'contrato'}
        aditivo={aditivoPosterior ? { id: aditivoPosterior.id, numero: aditivoPosterior.numero } : null}
        aoConcluir={() => setData(prev => prev
          ? { ...prev, contrato: { ...prev.contrato, status: 'vigente', data_encerramento: null, motivo_encerramento: null } }
          : prev)}
      />
    </div>
  );
}
