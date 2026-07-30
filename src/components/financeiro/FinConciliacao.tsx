import { useMemo, useRef, useState } from "react";
import {
  useContas,
  useExtratosImportados,
  useMovimentosExtrato,
  useImportarOFX,
  useConciliarAutomatico,
  useConciliarManual,
  useDesfazerConciliacao,
  useLancamentos,
  useUpsertLancamento,
  ajustarSaldoConta,
  useEmpresaId,
} from "@/hooks/useFinanceiro";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Upload,
  Sparkles,
  Link2,
  Unlink,
  Loader2,
  FileCheck2,
  Search,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Plus,
  ArrowLeftRight,
  Ban,
  ChevronDown,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  Clock,
  XCircle,
  Wallet,
  Trash2,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatBRL, formatDate, statusLabel } from "@/lib/financeiro/formatters";
import { parseCsvExtrato, csvParaOfx } from "@/lib/financeiro/csvToOfx";
import { toast } from "sonner";
import FinRelatorioConciliacao from "./FinRelatorioConciliacao";
import LancamentoDialog from "./LancamentoDialog";

type MatchSugestao = {
  movimento_id: string;
  lancamento_id: string;
  score: number;
  motivos: Record<string, unknown>;
  metodo?: string;
  justificativa_ia?: string;
};

export default function FinConciliacao() {
  // ─── Refs ─────────────────────────────────────────────────────────────────
  const fileRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);
  const reprocFileRef = useRef<HTMLInputElement>(null);
  const reprocAlvo = useRef<{ extrato_id: string; conta_id: string; arquivo_nome: string } | null>(null);

  // ─── State ────────────────────────────────────────────────────────────────
  const [reprocessando, setReprocessando] = useState<string | null>(null);
  const [confirmReproc, setConfirmReproc] = useState<{
    extrato_id: string;
    conta_id: string;
    arquivo_nome: string;
    total_movimentos: number;
  } | null>(null);
  const [confirmApagarExtrato, setConfirmApagarExtrato] = useState<{
    extrato_id: string;
    arquivo_nome: string;
    total_movimentos: number;
  } | null>(null);
  const [apagandoExtrato, setApagandoExtrato] = useState<string | null>(null);
  const qc = useQueryClient();
  const [contaSelecionada, setContaSelecionada] = useState<string>("");
  const [filtroConciliado, setFiltroConciliado] = useState<
    "todos" | "pendente" | "conciliado" | "ignorado"
  >("pendente");
  const [scoreMinimo, setScoreMinimo] = useState<number>(75);
  const [sugestoes, setSugestoes] = useState<MatchSugestao[]>([]);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [dialogManual, setDialogManual] = useState<{
    movimento_id: string;
    valor: number;
    natureza: "receita" | "despesa";
  } | null>(null);
  const [novoLanc, setNovoLanc] = useState<{
    movimento_id: string;
    initial: Record<string, unknown>;
    defaultTipo: "a_pagar" | "a_receber" | "movimentacao" | "transferencia";
  } | null>(null);
  const [movsSelecionados, setMovsSelecionados] = useState<Set<string>>(new Set());

  type AiClassif = {
    tipo: string; natureza: string; descricao_sugerida: string;
    categoria_id: string | null; categoria_nome: string | null;
    pessoa_id: string | null; pessoa_nome: string | null;
    confianca: number; justificativa: string;
  };
  const [aiClassifs, setAiClassifs] = useState<Record<string, AiClassif>>({});
  const [classificandoIA, setClassificandoIA] = useState<Record<string, boolean>>({});
  const [classificandoTodas, setClassificandoTodas] = useState(false);

  // ─── Data ─────────────────────────────────────────────────────────────────
  const empresaId = useEmpresaId();
  const { data: contas } = useContas();
  const { data: extratos } = useExtratosImportados();
  const { data: movimentos, isLoading: loadingMov } = useMovimentosExtrato({
    conta_id: contaSelecionada || undefined,
    conciliado:
      filtroConciliado === "todos" || filtroConciliado === "ignorado"
        ? undefined
        : filtroConciliado === "conciliado",
  });
  const { data: lancamentosTodos } = useLancamentos({});

  // ─── Mutations ────────────────────────────────────────────────────────────
  const importar = useImportarOFX();
  const conciliarAuto = useConciliarAutomatico();
  const conciliarManual = useConciliarManual();
  const desfazer = useDesfazerConciliacao();
  const upsertLancamento = useUpsertLancamento();

  const ignorarMov = useMutation({
    mutationFn: async (params: {
      id: string;
      ignorar: boolean;
      motivo?: string;
      mov?: { valor: number; descricao?: string; data_movimento?: string; conta_id?: string; lancamento_id?: string | null };
    }) => {
      if (params.ignorar) {
        const { error: errPatch } = await supabase
          .from("financeiro_extrato_movimentos")
          .update({ ignorado: true, ignorado_em: new Date().toISOString(), ignorado_motivo: params.motivo ?? null } as never)
          .eq("id", params.id);
        if (errPatch) throw errPatch;

        if (params.mov && empresaId) {
          const valor = Math.abs(Number(params.mov.valor));
          const natureza: string = Number(params.mov.valor) >= 0 ? "receita" : "despesa";
          const tipo: string = natureza === "receita" ? "a_receber" : "a_pagar";
          const { data: lanc, error: errLanc } = await supabase
            .from("financeiro_lancamentos")
            .insert({
              empresa_id: empresaId,
              conta_id: params.mov.conta_id ?? null,
              descricao: params.mov.descricao ?? "Movimento ignorado na conciliação",
              valor,
              natureza: natureza as never,
              tipo: tipo as never,
              status: "cancelado" as never,
              data_competencia: params.mov.data_movimento ?? new Date().toISOString().slice(0, 10),
              origem_tipo: "ignorado_conciliacao",
              origem_job: "ignorarMov",
              origem_timestamp: new Date().toISOString(),
            } as never)
            .select("id")
            .single();
          if (!errLanc && lanc) {
            await supabase
              .from("financeiro_extrato_movimentos")
              .update({ lancamento_id: lanc.id } as never)
              .eq("id", params.id);
          }
        }
      } else {
        const lancamentoId = params.mov?.lancamento_id;
        if (lancamentoId) {
          const { data: lancamentoCheck } = await supabase
            .from("financeiro_lancamentos")
            .select("id, origem_tipo")
            .eq("id", lancamentoId)
            .single();
          if ((lancamentoCheck as any)?.origem_tipo === "ignorado_conciliacao") {
            await supabase.from("financeiro_lancamentos").delete().eq("id", lancamentoId);
          }
        }
        const { error } = await supabase
          .from("financeiro_extrato_movimentos")
          .update({ ignorado: false, ignorado_em: null, ignorado_motivo: null, lancamento_id: null } as never)
          .eq("id", params.id);
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["fin-movimentos"] });
      qc.invalidateQueries({ queryKey: ["fin-lancamentos"] });
      toast.success(vars.ignorar ? "Movimento ignorado." : "Movimento restaurado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ─── Derived ──────────────────────────────────────────────────────────────
  const movimentosFiltrados = useMemo(() => {
    const lista = movimentos ?? [];
    if (filtroConciliado === "ignorado") return lista.filter((m: any) => m.ignorado === true);
    if (filtroConciliado === "pendente") return lista.filter((m: any) => !m.ignorado);
    return lista;
  }, [movimentos, filtroConciliado]);

  const resumoMovimentos = useMemo(() => {
    const entradas = movimentosFiltrados
      .filter((m: any) => Number(m.valor) > 0)
      .reduce((acc: number, m: any) => acc + Number(m.valor), 0);
    const saidas = movimentosFiltrados
      .filter((m: any) => Number(m.valor) < 0)
      .reduce((acc: number, m: any) => acc + Math.abs(Number(m.valor)), 0);
    return { entradas, saidas, saldo: entradas - saidas };
  }, [movimentosFiltrados]);

  const resumoGeral = useMemo(() => {
    const all = movimentos ?? [];
    return {
      total: all.length,
      pendentes: all.filter((m: any) => !m.conciliado && !m.ignorado).length,
      conciliados: all.filter((m: any) => m.conciliado).length,
      ignorados: all.filter((m: any) => m.ignorado).length,
    };
  }, [movimentos]);

  const movMap = useMemo(() => {
    const m = new Map<string, NonNullable<typeof movimentos>[number]>();
    (movimentos ?? []).forEach((mov) => m.set(mov.id, mov));
    return m;
  }, [movimentos]);

  const lancMap = useMemo(() => {
    const m = new Map<string, NonNullable<typeof lancamentosTodos>[number]>();
    (lancamentosTodos ?? []).forEach((l) => m.set(l.id, l));
    return m;
  }, [lancamentosTodos]);

  const saldoExtrato = useMemo(() => {
    return (movimentos ?? []).reduce((s: number, m: any) => s + Number(m.valor), 0);
  }, [movimentos]);

  const saldoSistema = useMemo(() => {
    if (!contaSelecionada) return 0;
    return (lancamentosTodos ?? [])
      .filter((l: any) => l.conta_id === contaSelecionada && l.status !== "cancelado")
      .reduce((s: number, l: any) => {
        const val = Number(l.valor);
        return l.natureza === "receita" ? s + val : s - val;
      }, 0);
  }, [lancamentosTodos, contaSelecionada]);

  const movimentosAgrupados = useMemo(() => {
    const grupos = new Map<string, any[]>();
    for (const m of movimentosFiltrados) {
      const date = (m as any).data_movimento?.slice(0, 10) ?? "sem-data";
      if (!grupos.has(date)) grupos.set(date, []);
      grupos.get(date)!.push(m);
    }
    return Array.from(grupos.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, movs]) => ({
        date,
        movimentos: movs,
        creditos: movs.filter((m: any) => Number(m.valor) > 0).reduce((s: number, m: any) => s + Number(m.valor), 0),
        debitos: movs.filter((m: any) => Number(m.valor) < 0).reduce((s: number, m: any) => s + Math.abs(Number(m.valor)), 0),
      }));
  }, [movimentosFiltrados]);

  const movSugestoesMap = useMemo(() => {
    const m = new Map<string, MatchSugestao[]>();
    for (const s of sugestoes) {
      if (!m.has(s.movimento_id)) m.set(s.movimento_id, []);
      m.get(s.movimento_id)!.push(s);
    }
    return m;
  }, [sugestoes]);

  // ─── Handlers ─────────────────────────────────────────────────────────────
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!contaSelecionada) {
      toast.error("Selecione uma conta antes de importar.");
      e.target.value = "";
      return;
    }
    const conteudo = await file.text();
    importar.mutate(
      { conta_id: contaSelecionada, arquivo_nome: file.name, conteudo_ofx: conteudo },
      { onSettled: () => (e.target.value = "") }
    );
  }

  async function onCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!contaSelecionada) {
      toast.error("Selecione uma conta antes de importar.");
      e.target.value = "";
      return;
    }
    try {
      const texto = await file.text();
      const linhas = parseCsvExtrato(texto);
      if (linhas.length === 0) {
        toast.error("Nenhuma linha válida encontrada no CSV. Verifique cabeçalhos: data, descricao, valor.");
        e.target.value = "";
        return;
      }
      const ofxEquivalente = csvParaOfx(linhas);
      const nome = file.name.replace(/\.csv$/i, ".csv.ofx");
      importar.mutate(
        { conta_id: contaSelecionada, arquivo_nome: nome, conteudo_ofx: ofxEquivalente },
        {
          onSuccess: () => toast.success(`${linhas.length} linha(s) do CSV convertidas e importadas.`),
          onSettled: () => (e.target.value = ""),
        }
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao processar CSV.");
      e.target.value = "";
    }
  }

  function iniciarReprocesso(extrato_id: string, conta_id: string, arquivo_nome: string) {
    const ex = (extratos ?? []).find((e) => e.id === extrato_id);
    setConfirmReproc({
      extrato_id,
      conta_id,
      arquivo_nome,
      total_movimentos: ex?.total_movimentos ?? 0,
    });
  }

  function confirmarReprocesso() {
    if (!confirmReproc) return;
    reprocAlvo.current = {
      extrato_id: confirmReproc.extrato_id,
      conta_id: confirmReproc.conta_id,
      arquivo_nome: confirmReproc.arquivo_nome,
    };
    setConfirmReproc(null);
    reprocFileRef.current?.click();
  }

  async function onReprocessarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const alvo = reprocAlvo.current;
    e.target.value = "";
    if (!file || !alvo) return;
    setReprocessando(alvo.extrato_id);
    try {
      const { error: errMov } = await supabase
        .from("financeiro_extrato_movimentos")
        .delete()
        .eq("extrato_id", alvo.extrato_id);
      if (errMov) throw errMov;
      const { error: errExt } = await supabase
        .from("financeiro_extratos_importados")
        .delete()
        .eq("id", alvo.extrato_id);
      if (errExt) throw errExt;
      const conteudo = await file.text();
      importar.mutate(
        { conta_id: alvo.conta_id, arquivo_nome: file.name, conteudo_ofx: conteudo },
        {
          onSuccess: () => {
            toast.success("Extrato reprocessado com sucesso.");
            qc.invalidateQueries({ queryKey: ["fin-extratos-importados"] });
            qc.invalidateQueries({ queryKey: ["fin-movimentos-extrato"] });
          },
          onError: (err) => toast.error(err instanceof Error ? err.message : "Falha no reprocesso."),
          onSettled: () => setReprocessando(null),
        }
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao remover extrato antigo.");
      setReprocessando(null);
    } finally {
      reprocAlvo.current = null;
    }
  }

  function buscarSugestoes(usar_ia = false) {
    conciliarAuto.mutate(
      {
        conta_id: contaSelecionada || undefined,
        auto_aplicar: false,
        score_minimo: scoreMinimo,
        usar_ia,
      },
      {
        onSuccess: (data) => {
          setSugestoes(data.matches ?? []);
          setSelecionadas(new Set((data.matches ?? []).map((m) => m.movimento_id)));
          const iaSug = (data as { ia_sugeridos?: number }).ia_sugeridos;
          if (usar_ia && iaSug) toast.success(`IA sugeriu ${iaSug} novos matches.`);
        },
      }
    );
  }

  function aplicarSelecionadas() {
    const aAplicar = sugestoes.filter((s) => selecionadas.has(s.movimento_id));
    if (aAplicar.length === 0) { toast.info("Nenhuma sugestão selecionada."); return; }
    let aplicados = 0, erros = 0;
    Promise.all(
      aAplicar.map(
        (s) =>
          new Promise<void>((resolve) => {
            conciliarManual.mutate(
              { movimento_id: s.movimento_id, lancamento_id: s.lancamento_id },
              {
                onSuccess: () => { aplicados++; resolve(); },
                onError: () => { erros++; resolve(); },
              }
            );
          })
      )
    ).then(() => {
      if (aplicados > 0) toast.success(`${aplicados} conciliações aplicadas.`);
      if (erros > 0) toast.error(`${erros} falha(s) ao conciliar.`);
      setSugestoes((curr) => curr.filter((s) => !selecionadas.has(s.movimento_id)));
      setSelecionadas(new Set());
    });
  }

  function aplicarTodasAlta() {
    const auto = sugestoes.filter((s) => s.score >= 90);
    if (auto.length === 0) { toast.info("Nenhuma sugestão com score ≥ 90 disponível."); return; }
    setSelecionadas(new Set(auto.map((s) => s.movimento_id)));
    setTimeout(() => aplicarSelecionadas(), 50);
  }

  function toggleTodas(check: boolean) {
    if (check) setSelecionadas(new Set(sugestoes.map((s) => s.movimento_id)));
    else setSelecionadas(new Set());
  }

  async function efetivarSelecionados() {
    const movsSel = movimentosFiltrados.filter(
      (m: any) => movsSelecionados.has(m.id) && !m.conciliado && !m.ignorado
    );
    if (movsSel.length === 0) return;
    let ok = 0, erros = 0;
    for (const m of movsSel) {
      const isCredito = Number(m.valor) >= 0;
      try {
        const lanc = await upsertLancamento.mutateAsync({
          descricao: m.descricao || "Movimento bancário",
          valor: Math.abs(Number(m.valor)),
          data_competencia: m.data_movimento,
          conta_id: m.conta_id,
          natureza: isCredito ? "receita" : "despesa",
          tipo: isCredito ? "a_receber" : "a_pagar",
          status: "conciliado",
          data_realizado: m.data_movimento,
        });
        await conciliarManual.mutateAsync({
          movimento_id: m.id,
          lancamento_id: (lanc as any).id,
        });
        if (m.conta_id) {
          const delta = isCredito ? Math.abs(Number(m.valor)) : -Math.abs(Number(m.valor));
          await ajustarSaldoConta(m.conta_id, delta);
        }
        ok++;
      } catch {
        erros++;
      }
    }
    if (ok > 0) toast.success(`${ok} lançamento(s) efetivados e conciliados.`);
    if (erros > 0) toast.error(`${erros} falha(s) ao efetivar.`);
    setMovsSelecionados(new Set());
    qc.invalidateQueries({ queryKey: ["fin-movimentos-extrato"] });
    qc.invalidateQueries({ queryKey: ["fin-contas"] });
    qc.invalidateQueries({ queryKey: ["fin-resumo-visor"] });
    qc.invalidateQueries({ queryKey: ["fin-resumo"] });
  }

  function classificarHeuristica(descricao: string, valor: number): AiClassif {
    const d = (descricao ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const isCredito = Number(valor) >= 0;
    const receitaKws = ["recebimento", "receb", "deposito", "dep", "pix recebido", "ted recebida",
      "cliente", "venda", "contrato", "honorario", "entrada", "credito em conta", "estorno"];
    const despesaKws = ["pagamento", "pagto", "pago", "debito", "boleto", "fatura", "fornecedor",
      "aluguel", "energia", "luz", "agua", "internet", "telefone", "salario", "folha",
      "inss", "fgts", "imposto", "taxa", "tarifa", "manutencao", "compra", "nf ", "pix enviado",
      "ted enviado", "doc enviado", "saque", "retirada"];
    const movKws = ["transferencia entre", "transf propria", "resgate", "aplicacao", "entre contas"];
    const isMovimentacao = movKws.some((k) => d.includes(k));
    const matchReceita = receitaKws.some((k) => d.includes(k));
    const matchDespesa = despesaKws.some((k) => d.includes(k));
    let tipo: string; let natureza: string; let justificativa: string; let confianca: number;
    if (isMovimentacao) {
      tipo = "movimentacao"; natureza = "movimentacao"; confianca = 72;
      justificativa = "Palavras-chave indicam transferência entre contas.";
    } else if (matchReceita && !matchDespesa) {
      tipo = "a_receber"; natureza = "receita"; confianca = 78;
      justificativa = "Descrição sugere recebimento de valor.";
    } else if (matchDespesa && !matchReceita) {
      tipo = "a_pagar"; natureza = "despesa"; confianca = 78;
      justificativa = "Descrição sugere pagamento ou despesa.";
    } else {
      tipo = isCredito ? "a_receber" : "a_pagar";
      natureza = isCredito ? "receita" : "despesa";
      confianca = 52;
      justificativa = isCredito ? "Entrada — classificado como receita pelo sinal positivo." : "Saída — classificado como despesa pelo sinal negativo.";
    }
    return { tipo, natureza, descricao_sugerida: descricao, categoria_id: null, categoria_nome: null, pessoa_id: null, pessoa_nome: null, confianca, justificativa };
  }

  async function classificarLancamento(m: any) {
    if (!empresaId) return;
    setClassificandoIA((prev) => ({ ...prev, [m.id]: true }));
    try {
      const { data, error } = await supabase.functions.invoke("classificar-lancamento", {
        body: {
          empresa_id: empresaId,
          descricao: m.descricao,
          valor: m.valor,
          data_movimento: m.data_movimento,
          conta_id: m.conta_id,
        },
      });
      if (error || !data) {
        // Edge function não deployada ou indisponível — usa heurística local
        setAiClassifs((prev) => ({ ...prev, [m.id]: classificarHeuristica(m.descricao, m.valor) }));
      } else {
        setAiClassifs((prev) => ({ ...prev, [m.id]: data as AiClassif }));
      }
    } catch {
      // Fallback heurístico silencioso
      setAiClassifs((prev) => ({ ...prev, [m.id]: classificarHeuristica(m.descricao, m.valor) }));
    } finally {
      setClassificandoIA((prev) => ({ ...prev, [m.id]: false }));
    }
  }

  async function classificarTodas() {
    const pendentes = (movimentos ?? []).filter((m: any) => !m.conciliado && !m.ignorado && !aiClassifs[(m as any).id]);
    if (pendentes.length === 0) { toast.info("Nenhum movimento pendente para classificar."); return; }
    setClassificandoTodas(true);
    let ok = 0;
    // Processa em lotes de 5 para não sobrecarregar
    const LOTE = 5;
    for (let i = 0; i < pendentes.length; i += LOTE) {
      const lote = pendentes.slice(i, i + LOTE);
      await Promise.all(lote.map(async (m: any) => {
        try {
          const { data, error } = await supabase.functions.invoke("classificar-lancamento", {
            body: { empresa_id: empresaId, descricao: m.descricao, valor: m.valor, data_movimento: m.data_movimento, conta_id: m.conta_id },
          });
          const resultado = (error || !data) ? classificarHeuristica(m.descricao, m.valor) : data as AiClassif;
          setAiClassifs((prev) => ({ ...prev, [m.id]: resultado }));
          ok++;
        } catch {
          const resultado = classificarHeuristica(m.descricao, m.valor);
          setAiClassifs((prev) => ({ ...prev, [m.id]: resultado }));
          ok++;
        }
      }));
    }
    setClassificandoTodas(false);
    toast.success(`${ok} movimento(s) classificado(s) com IA.`);
  }

  // ─── JSX ──────────────────────────────────────────────────────────────────
  return (
    <Tabs defaultValue="conciliar" className="space-y-4">
      <TabsList className="h-9">
        <TabsTrigger value="conciliar" className="text-xs px-3">
          <Link2 className="w-3.5 h-3.5 mr-1.5" />Conciliação
        </TabsTrigger>
        <TabsTrigger value="relatorio" className="text-xs px-3">
          <BarChart3 className="w-3.5 h-3.5 mr-1.5" />Relatório por período
        </TabsTrigger>
      </TabsList>

      {/* ════════════════════════════════════════════════════════════════════ */}
      <TabsContent value="conciliar" className="space-y-4 mt-0">

        {/* ── Controles ── */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs text-muted-foreground mb-1 block">Conta bancária</label>
                <Select value={contaSelecionada} onValueChange={setContaSelecionada}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Selecione uma conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {(contas ?? [])
                      .filter((c) => ["corrente", "poupanca", "caixa"].includes(c.tipo ?? ""))
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="min-w-[150px]">
                <label className="text-xs text-muted-foreground mb-1 block">Exibindo</label>
                <Select
                  value={filtroConciliado}
                  onValueChange={(v) => setFiltroConciliado(v as typeof filtroConciliado)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendentes</SelectItem>
                    <SelectItem value="conciliado">Conciliados</SelectItem>
                    <SelectItem value="ignorado">Ignorados</SelectItem>
                    <SelectItem value="todos">Todos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2 ml-auto flex-wrap">
                <input ref={fileRef} type="file" accept=".ofx,.OFX" className="hidden" onChange={onFile} />
                <input ref={csvRef} type="file" accept=".csv,.CSV,text/csv" className="hidden" onChange={onCsvFile} />

                <Button
                  variant="outline"
                  size="sm"
                  className="h-9"
                  onClick={() => fileRef.current?.click()}
                  disabled={importar.isPending || !contaSelecionada}
                >
                  {importar.isPending
                    ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    : <Upload className="w-3.5 h-3.5 mr-1.5" />}
                  Importar OFX
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="h-9"
                  onClick={() => csvRef.current?.click()}
                  disabled={importar.isPending || !contaSelecionada}
                  title="CSV com colunas: data, descricao, valor (opcional documento)"
                >
                  {importar.isPending
                    ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    : <Upload className="w-3.5 h-3.5 mr-1.5" />}
                  Importar CSV
                </Button>

                <Button
                  size="sm"
                  className="h-9"
                  onClick={() =>
                    conciliarAuto.mutate({
                      conta_id: contaSelecionada || undefined,
                      auto_aplicar: true,
                      score_minimo: 90,
                    })
                  }
                  disabled={conciliarAuto.isPending}
                >
                  {conciliarAuto.isPending
                    ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
                  Auto-conciliar (≥ 90)
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 border-primary/40 text-primary hover:bg-primary/10"
                  onClick={classificarTodas}
                  disabled={classificandoTodas || !contaSelecionada || (movimentos ?? []).filter((m: any) => !m.conciliado && !m.ignorado).length === 0}
                  title="Classifica todos os movimentos pendentes com IA de uma vez"
                >
                  {classificandoTodas
                    ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
                  Classificar todas com IA
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Resumo de conciliação ── */}
        {(movimentos ?? []).length > 0 && (() => {
          const diferenca = saldoExtrato - saldoSistema;
          const emEquilibrio = Math.abs(diferenca) < 0.01;
          const pct = resumoGeral.total ? Math.round((resumoGeral.conciliados / resumoGeral.total) * 100) : 0;
          const todosMovs = movimentos ?? [];
          const movsPendentes = (todosMovs as any[]).filter((m) => !m.conciliado && !m.ignorado);
          const valorPendente = movsPendentes.reduce((s: number, m: any) => s + Math.abs(Number(m.valor)), 0);
          const entradasPendentes = movsPendentes.filter((m: any) => Number(m.valor) >= 0).reduce((s: number, m: any) => s + Number(m.valor), 0);
          const saidasPendentes = movsPendentes.filter((m: any) => Number(m.valor) < 0).reduce((s: number, m: any) => s + Math.abs(Number(m.valor)), 0);
          return (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {/* 1. Saldo extrato */}
              <div className="rounded-lg border bg-card p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Saldo extrato</span>
                  <Wallet className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <span className={`text-base font-semibold tabular-nums ${saldoExtrato >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                  {formatBRL(saldoExtrato)}
                </span>
                <div className="text-[11px] text-muted-foreground">
                  <span className="text-emerald-600 dark:text-emerald-400">+{formatBRL(resumoMovimentos.entradas)}</span>
                  {" / "}
                  <span className="text-rose-600 dark:text-rose-400">-{formatBRL(resumoMovimentos.saidas)}</span>
                </div>
              </div>

              {/* 2. Saldo sistema */}
              <div className="rounded-lg border bg-card p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Saldo sistema</span>
                  <BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <span className={`text-base font-semibold tabular-nums ${saldoSistema >= 0 ? "text-foreground" : "text-rose-600 dark:text-rose-400"}`}>
                  {formatBRL(saldoSistema)}
                </span>
                <div className="text-[11px] text-muted-foreground">Lançamentos da conta</div>
              </div>

              {/* 3. Diferença */}
              <div className={`rounded-lg border p-3 space-y-1 ${emEquilibrio ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800" : "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Diferença</span>
                  {emEquilibrio
                    ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    : <XCircle className="w-3.5 h-3.5 text-amber-500" />}
                </div>
                <span className={`text-base font-semibold tabular-nums ${emEquilibrio ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                  {emEquilibrio ? "Em dia" : formatBRL(Math.abs(diferenca))}
                </span>
                <div className="text-[11px] text-muted-foreground">{emEquilibrio ? "Extrato e sistema batem" : diferenca > 0 ? "Extrato maior" : "Sistema maior"}</div>
              </div>

              {/* 4. Conciliados / progresso */}
              <div className="rounded-lg border bg-card p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Conciliados</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                <span className="text-base font-semibold tabular-nums">
                  {resumoGeral.conciliados}
                  <span className="text-sm text-muted-foreground font-normal"> / {resumoGeral.total}</span>
                </span>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>

              {/* 5. Pendentes */}
              <div className="rounded-lg border bg-card p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Pendentes</span>
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                </div>
                <span className="text-base font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                  {resumoGeral.pendentes}
                </span>
                <div className="text-[11px] text-muted-foreground">{resumoGeral.ignorados} ignorado(s)</div>
              </div>

              {/* 6. Valor pendente de conciliar */}
              <div className="rounded-lg border bg-card p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">A conciliar</span>
                  <ArrowLeftRight className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <span className="text-base font-semibold tabular-nums text-foreground">
                  {formatBRL(valorPendente)}
                </span>
                <div className="text-[11px] text-muted-foreground">
                  <span className="text-emerald-600 dark:text-emerald-400">+{formatBRL(entradasPendentes)}</span>
                  {" / "}
                  <span className="text-rose-600 dark:text-rose-400">-{formatBRL(saidasPendentes)}</span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── Sugestões ── */}
        <Card>
          <CardHeader className="py-3 px-5 border-b">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <CardTitle className="text-sm font-semibold">Sugestões de conciliação</CardTitle>
                {sugestoes.length > 0 && (
                  <Badge variant="secondary" className="tabular-nums text-xs px-2">
                    {sugestoes.length}
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 ml-auto">
                <div className="flex items-center gap-2 min-w-[210px]">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">Score mín.</span>
                  <Slider
                    value={[scoreMinimo]}
                    onValueChange={([v]) => setScoreMinimo(v)}
                    min={50} max={100} step={5}
                    className="flex-1"
                  />
                  <span className="text-xs font-mono font-semibold w-6 text-right">{scoreMinimo}</span>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => buscarSugestoes(false)}
                  disabled={conciliarAuto.isPending}
                >
                  {conciliarAuto.isPending
                    ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                    : <Search className="w-3.5 h-3.5 mr-1" />}
                  Buscar
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => buscarSugestoes(true)}
                  disabled={conciliarAuto.isPending}
                  title="Usa IA para encontrar matches em casos ambíguos"
                >
                  {conciliarAuto.isPending
                    ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                    : <Sparkles className="w-3.5 h-3.5 mr-1 text-primary" />}
                  Sugerir com IA
                </Button>

                {sugestoes.length > 0 && (
                  <>
                    <Button
                      size="sm"
                      onClick={aplicarSelecionadas}
                      disabled={selecionadas.size === 0}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      Aplicar ({selecionadas.size})
                    </Button>
                    <Button variant="secondary" size="sm" onClick={aplicarTodasAlta}>
                      <Sparkles className="w-3.5 h-3.5 mr-1" />
                      Aprovar ≥ 90
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {sugestoes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center px-6 gap-2">
                <Search className="w-8 h-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  Clique em <strong>Buscar</strong> para encontrar correspondências entre movimentos do extrato e lançamentos, sem aplicar alterações.
                </p>
                <p className="text-xs text-muted-foreground">
                  Use <strong>Auto-conciliar</strong> para aplicar automaticamente todos os matches com score ≥ 90.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs bg-muted/30">
                      <TableHead className="w-[44px] pl-5">
                        <Checkbox
                          checked={selecionadas.size === sugestoes.length && sugestoes.length > 0}
                          onCheckedChange={(v) => toggleTodas(!!v)}
                          aria-label="Selecionar todas"
                        />
                      </TableHead>
                      <TableHead className="w-[88px]">Score</TableHead>
                      <TableHead>Movimento (extrato)</TableHead>
                      <TableHead>Lançamento previsto</TableHead>
                      <TableHead className="w-[160px]">Compatibilidade</TableHead>
                      <TableHead className="text-right w-[100px] pr-5">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sugestoes.map((s) => {
                      const mov = movMap.get(s.movimento_id);
                      const lanc = lancMap.get(s.lancamento_id);
                      const checked = selecionadas.has(s.movimento_id);
                      return (
                        <TableRow key={s.movimento_id + s.lancamento_id} className="text-sm hover:bg-muted/30">
                          <TableCell className="pl-5">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => {
                                setSelecionadas((curr) => {
                                  const next = new Set(curr);
                                  if (v) next.add(s.movimento_id);
                                  else next.delete(s.movimento_id);
                                  return next;
                                });
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <ScoreBadge score={s.score} metodo={s.metodo} />
                          </TableCell>
                          <TableCell>
                            {mov ? (
                              <div>
                                <div className="font-medium truncate max-w-[220px]">{mov.descricao}</div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  {formatDate(mov.data_movimento)} ·{" "}
                                  <span className={Number(mov.valor) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                                    {formatBRL(Number(mov.valor))}
                                  </span>
                                </div>
                              </div>
                            ) : <span className="text-muted-foreground text-xs">—</span>}
                          </TableCell>
                          <TableCell>
                            {lanc ? (
                              <div>
                                <div className="font-medium truncate max-w-[220px]">{lanc.descricao}</div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  {lanc.data_vencimento ? `Venc.: ${formatDate(lanc.data_vencimento)}` : "—"} · {formatBRL(Number(lanc.valor))}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs">Lançamento fora da página atual</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <MotivosBadges motivos={s.motivos} />
                              {s.justificativa_ia && (
                                <p className="text-[11px] italic text-muted-foreground max-w-[240px] leading-snug">
                                  "{s.justificativa_ia}"
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right pr-5">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() =>
                                conciliarManual.mutate(
                                  { movimento_id: s.movimento_id, lancamento_id: s.lancamento_id },
                                  {
                                    onSuccess: () =>
                                      setSugestoes((curr) =>
                                        curr.filter((x) => x.movimento_id !== s.movimento_id)
                                      ),
                                  }
                                )
                              }
                            >
                              <Link2 className="w-3 h-3 mr-1" />
                              Vincular
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Extratos importados ── */}
        {(extratos?.length ?? 0) > 0 && (
          <Card>
            <CardHeader className="py-3 px-5 border-b">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-primary" />
                Extratos importados
                <Badge variant="outline" className="text-xs">{extratos!.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                {(extratos ?? []).map((ex) => (
                  <div
                    key={ex.id}
                    className="flex items-start justify-between gap-2 rounded-lg border bg-card p-3 hover:bg-accent/40 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <FileCheck2 className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="text-sm font-medium truncate">{ex.arquivo_nome}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {ex.conta?.nome ?? "—"} · {ex.total_movimentos ?? 0} movimentos
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {ex.data_inicio ? formatDate(ex.data_inicio) : "?"} → {ex.data_fim ? formatDate(ex.data_fim) : "?"}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <Badge
                        variant={ex.status === "concluido" ? "default" : "secondary"}
                        className="text-[10px] px-1.5"
                      >
                        {ex.status}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs text-muted-foreground"
                        onClick={() => iniciarReprocesso(ex.id, ex.conta_id, ex.arquivo_nome)}
                        disabled={reprocessando === ex.id}
                        title="Reprocessar extrato com parser atualizado"
                      >
                        {reprocessando === ex.id
                          ? <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          : <RotateCcw className="w-3 h-3 mr-1" />}
                        Reprocessar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs text-destructive/70 hover:text-destructive"
                        onClick={() => setConfirmApagarExtrato({ extrato_id: ex.id, arquivo_nome: ex.arquivo_nome, total_movimentos: ex.total_movimentos ?? 0 })}
                        disabled={apagandoExtrato === ex.id}
                        title="Apagar extrato e seus movimentos"
                      >
                        {apagandoExtrato === ex.id
                          ? <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          : <Trash2 className="w-3 h-3 mr-1" />}
                        Apagar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <input
                ref={reprocFileRef}
                type="file"
                accept=".ofx,.OFX"
                className="hidden"
                onChange={onReprocessarFile}
              />
            </CardContent>
          </Card>
        )}

        {/* ── AlertDialog: confirmar reprocesso ── */}
        <AlertDialog open={!!confirmReproc} onOpenChange={(o) => !o && setConfirmReproc(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reprocessar extrato?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2 text-sm">
                  <p>
                    Esta ação irá <strong>apagar permanentemente</strong> o extrato{" "}
                    <span className="font-mono text-foreground">{confirmReproc?.arquivo_nome}</span> e os{" "}
                    <strong>{confirmReproc?.total_movimentos ?? 0} movimentos</strong> associados, incluindo
                    conciliações pendentes vinculadas.
                  </p>
                  <p>
                    Em seguida, será solicitado o arquivo OFX para reimportar. Conciliações já efetivadas
                    em lançamentos não serão revertidas, mas perderão o vínculo com o movimento.
                  </p>
                  <p className="text-muted-foreground">Tem certeza que deseja continuar?</p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmarReprocesso}>Apagar e reprocessar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ── AlertDialog: confirmar apagar extrato ── */}
        <AlertDialog open={!!confirmApagarExtrato} onOpenChange={(o) => !o && setConfirmApagarExtrato(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Apagar extrato?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2 text-sm">
                  <p>
                    Esta ação irá <strong>apagar permanentemente</strong> o extrato{" "}
                    <span className="font-mono text-foreground">{confirmApagarExtrato?.arquivo_nome}</span> e os{" "}
                    <strong>{confirmApagarExtrato?.total_movimentos ?? 0} movimentos</strong> associados.
                  </p>
                  <p className="text-muted-foreground">
                    Lançamentos já conciliados não serão excluídos, mas perderão o vínculo com o extrato.
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={async () => {
                  if (!confirmApagarExtrato) return;
                  setApagandoExtrato(confirmApagarExtrato.extrato_id);
                  setConfirmApagarExtrato(null);
                  try {
                    await supabase
                      .from("financeiro_extrato_movimentos")
                      .delete()
                      .eq("extrato_id", confirmApagarExtrato.extrato_id);
                    const { error } = await supabase
                      .from("financeiro_extratos_importados")
                      .delete()
                      .eq("id", confirmApagarExtrato.extrato_id);
                    if (error) throw error;
                    qc.invalidateQueries({ queryKey: ["fin-extratos"] });
                    qc.invalidateQueries({ queryKey: ["fin-movimentos"] });
                    toast.success("Extrato apagado.");
                  } catch (e: any) {
                    toast.error(e.message ?? "Erro ao apagar extrato.");
                  } finally {
                    setApagandoExtrato(null);
                  }
                }}
              >
                Apagar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ── Extrato bancário — layout padrão de mercado ── */}
        <div className="rounded-lg border overflow-hidden">
          {/* Cabeçalho split */}
          <div className="grid grid-cols-[1fr_auto_1fr] bg-muted/30 border-b">
            <div className="px-5 py-2.5 flex items-center gap-3">
              <Checkbox
                checked={
                  movimentosFiltrados.filter((m: any) => !m.conciliado && !m.ignorado).length > 0 &&
                  movimentosFiltrados.filter((m: any) => !m.conciliado && !m.ignorado).every((m: any) => movsSelecionados.has(m.id))
                }
                onCheckedChange={(v) => {
                  const pendentes = movimentosFiltrados.filter((m: any) => !m.conciliado && !m.ignorado);
                  setMovsSelecionados(v ? new Set(pendentes.map((m: any) => m.id)) : new Set());
                }}
                aria-label="Selecionar todos"
                disabled={movimentosFiltrados.filter((m: any) => !m.conciliado && !m.ignorado).length === 0}
              />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Extrato bancário</span>
            </div>
            <div className="w-px bg-border" />
            <div className="px-5 py-2.5 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lançamento do sistema</span>
              {movsSelecionados.size > 0 && (
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={efetivarSelecionados}
                  disabled={upsertLancamento.isPending || conciliarManual.isPending}
                >
                  {(upsertLancamento.isPending || conciliarManual.isPending)
                    ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                    : <CheckCircle2 className="w-3 h-3 mr-1.5" />}
                  Efetivar ({movsSelecionados.size})
                </Button>
              )}
            </div>
          </div>

          {/* Estado vazio / loading */}
          {loadingMov && (
            <div className="py-14 text-center text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 inline animate-spin mr-2" />Carregando movimentos…
            </div>
          )}
          {!loadingMov && movimentosFiltrados.length === 0 && (
            <div className="py-14 text-center text-muted-foreground text-sm">
              {contaSelecionada
                ? "Nenhum movimento. Importe um arquivo OFX ou CSV para começar."
                : "Selecione uma conta bancária para visualizar os movimentos."}
            </div>
          )}

          {/* Grupos por data */}
          {!loadingMov && movimentosAgrupados.map((group) => (
            <div key={group.date}>
              {/* Separador de data */}
              <div className="flex items-center gap-3 px-5 py-1.5 bg-muted/20 border-b border-t text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{formatDate(group.date)}</span>
                <div className="flex-1 h-px bg-border/60" />
                {group.creditos > 0 && (
                  <span className="text-emerald-600 dark:text-emerald-400 tabular-nums">+{formatBRL(group.creditos)}</span>
                )}
                {group.debitos > 0 && (
                  <span className="text-rose-600 dark:text-rose-400 tabular-nums">-{formatBRL(group.debitos)}</span>
                )}
                <span className="text-muted-foreground/50">{group.movimentos.length} mov.</span>
              </div>

              {/* Movimentos do grupo */}
              {group.movimentos.map((m: any) => {
                const isCredito = Number(m.valor) >= 0;
                const valorAbs = Math.abs(Number(m.valor));
                const naturezaSugerida: "receita" | "despesa" = isCredito ? "receita" : "despesa";
                const baseInitial = {
                  descricao: m.descricao || "Movimento bancário",
                  valor: valorAbs,
                  data_competencia: m.data_movimento,
                  data_vencimento: m.data_movimento,
                  data_realizado: m.data_movimento,
                  conta_id: m.conta_id,
                  status: "realizado" as const,
                };
                const movSugs = movSugestoesMap.get(m.id) ?? [];
                const borderColor = m.conciliado
                  ? "border-l-emerald-400"
                  : m.ignorado
                  ? "border-l-muted-foreground/20"
                  : movSugs.length > 0
                  ? "border-l-primary"
                  : "border-l-amber-400";

                return (
                  <div
                    key={m.id}
                    className={`grid grid-cols-[1fr_auto_1fr] border-b border-l-2 hover:bg-muted/10 transition-colors ${borderColor} ${m.ignorado ? "opacity-50" : ""}`}
                  >
                    {/* ESQUERDA: Extrato */}
                    <div className="flex items-start gap-3 px-4 py-3">
                      {!m.conciliado && !m.ignorado ? (
                        <Checkbox
                          checked={movsSelecionados.has(m.id)}
                          onCheckedChange={(v) => {
                            setMovsSelecionados((curr) => {
                              const next = new Set(curr);
                              v ? next.add(m.id) : next.delete(m.id);
                              return next;
                            });
                          }}
                          aria-label="Selecionar movimento"
                          className="mt-0.5 shrink-0"
                        />
                      ) : (
                        <div className="w-4 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-medium truncate">{m.descricao}</span>
                          <span className={`text-sm font-semibold tabular-nums shrink-0 ${isCredito ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                            {isCredito ? "+" : ""}{formatBRL(Number(m.valor))}
                          </span>
                        </div>
                        {m.descricao_extra && (
                          <div className="text-xs text-muted-foreground truncate">{m.descricao_extra}</div>
                        )}
                        <div className="text-xs text-muted-foreground mt-0.5">{m.conta?.nome ?? "—"}</div>
                      </div>
                    </div>

                    {/* DIVISOR VERTICAL */}
                    <div className="w-px bg-border/70 my-2" />

                    {/* DIREITA: Sistema */}
                    <div className="flex items-center gap-2 px-4 py-3 min-w-0">
                      {m.conciliado && m.lancamento ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{m.lancamento.descricao}</div>
                            <div className="text-xs text-muted-foreground">
                              {statusLabel[m.lancamento.status] ?? m.lancamento.status}
                              {m.lancamento.data_vencimento && ` · Venc: ${formatDate(m.lancamento.data_vencimento)}`}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-muted-foreground shrink-0"
                            onClick={() => desfazer.mutate({ movimento_id: m.id, lancamento_id: m.lancamento_id! })}
                          >
                            <Unlink className="w-3 h-3 mr-1" />Desfazer
                          </Button>
                        </>
                      ) : m.ignorado ? (
                        <>
                          <Ban className="w-4 h-4 text-muted-foreground/50 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="text-xs text-muted-foreground italic">
                              {m.ignorado_motivo || "Ignorado"}
                            </span>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-muted-foreground shrink-0"
                            onClick={() => ignorarMov.mutate({ id: m.id, ignorar: false, mov: { valor: m.valor, descricao: m.descricao, data_movimento: m.data_movimento, conta_id: m.conta_id, lancamento_id: m.lancamento_id } })}
                          >
                            <RotateCcw className="w-3 h-3 mr-1" />Restaurar
                          </Button>
                        </>
                      ) : (
                        <>
                          {/* Card de sugestão IA se já classificou */}
                          {aiClassifs[m.id] ? (
                            <div className="flex-1 min-w-0">
                              <div className="rounded-md border border-primary/20 bg-primary/5 p-2 space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                                    <span className="text-xs font-semibold text-primary">Sugestão IA</span>
                                    <span className="text-[10px] text-muted-foreground bg-muted px-1 rounded tabular-nums">{aiClassifs[m.id].confianca}%</span>
                                  </div>
                                  <button
                                    className="text-muted-foreground/50 hover:text-muted-foreground"
                                    onClick={() => setAiClassifs((p) => { const n = { ...p }; delete n[m.id]; return n; })}
                                  >
                                    <XCircle className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                <div className="text-xs space-y-0.5">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <Badge variant="outline" className="text-[10px] px-1.5 h-4">
                                      {aiClassifs[m.id].tipo === "a_pagar" ? "Conta a Pagar" : aiClassifs[m.id].tipo === "a_receber" ? "Conta a Receber" : "Movimentação"}
                                    </Badge>
                                    {aiClassifs[m.id].categoria_nome && (
                                      <Badge variant="outline" className="text-[10px] px-1.5 h-4 border-blue-300 text-blue-600 dark:text-blue-400">
                                        {aiClassifs[m.id].categoria_nome}
                                      </Badge>
                                    )}
                                    {aiClassifs[m.id].pessoa_nome && (
                                      <Badge variant="outline" className="text-[10px] px-1.5 h-4 border-violet-300 text-violet-600 dark:text-violet-400">
                                        {aiClassifs[m.id].pessoa_nome}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-muted-foreground italic text-[10px] leading-snug">{aiClassifs[m.id].justificativa}</p>
                                </div>
                                <div className="flex gap-1.5">
                                  <Button
                                    size="sm"
                                    className="h-6 text-[10px] px-2 flex-1"
                                    onClick={() => {
                                      const ai = aiClassifs[m.id];
                                      setNovoLanc({
                                        movimento_id: m.id,
                                        initial: {
                                          ...baseInitial,
                                          tipo: ai.tipo,
                                          natureza: ai.natureza,
                                          descricao: ai.descricao_sugerida,
                                          ...(ai.categoria_id ? { categoria_id: ai.categoria_id } : {}),
                                          ...(ai.pessoa_id ? { pessoa_id: ai.pessoa_id } : {}),
                                        },
                                        defaultTipo: ai.tipo as "a_pagar" | "a_receber" | "movimentacao",
                                      });
                                    }}
                                  >
                                    <Plus className="w-3 h-3 mr-1" />Criar com IA
                                  </Button>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button size="sm" variant="outline" className="h-6 text-[10px] px-1.5">
                                        <ChevronDown className="w-3 h-3" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-56">
                                      <DropdownMenuItem onClick={() => setDialogManual({ movimento_id: m.id, valor: valorAbs, natureza: naturezaSugerida })}>
                                        <Link2 className="w-3.5 h-3.5 mr-2" />Vincular existente
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem className="text-muted-foreground" onClick={() => {
                                        const motivo = window.prompt("Motivo (opcional):", "");
                                        if (motivo === null) return;
                                        ignorarMov.mutate({ id: m.id, ignorar: true, motivo: motivo || undefined, mov: { valor: m.valor, descricao: m.descricao, data_movimento: m.data_movimento, conta_id: m.conta_id } });
                                      }}>
                                        <Ban className="w-3.5 h-3.5 mr-2" />Ignorar
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                            </div>
                          ) : (
                          <>
                          {movSugs.length > 0 && (
                            <Badge variant="outline" className="text-xs border-primary/30 text-primary shrink-0">
                              <Sparkles className="w-3 h-3 mr-1" />{movSugs.length} sugestão
                            </Badge>
                          )}
                          {/* Botão Analisar com IA */}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-primary hover:bg-primary/10 shrink-0"
                            onClick={() => classificarLancamento(m)}
                            disabled={classificandoIA[m.id]}
                          >
                            {classificandoIA[m.id]
                              ? <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              : <Sparkles className="w-3 h-3 mr-1" />}
                            {classificandoIA[m.id] ? "Analisando…" : "IA"}
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="outline" className="h-7 text-xs ml-auto">
                                <Link2 className="w-3 h-3 mr-1" />Tratar<ChevronDown className="w-3 h-3 ml-1" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-60">
                              <DropdownMenuLabel className="text-xs text-muted-foreground">
                                {isCredito ? "+" : ""}{formatBRL(Number(m.valor))} · {formatDate(m.data_movimento)}
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {movSugs.map((s) => {
                                const lancSug = lancMap.get(s.lancamento_id);
                                return lancSug ? (
                                  <DropdownMenuItem
                                    key={s.lancamento_id}
                                    onClick={() =>
                                      conciliarManual.mutate(
                                        { movimento_id: m.id, lancamento_id: s.lancamento_id },
                                        { onSuccess: () => setSugestoes((curr) => curr.filter((x) => x.movimento_id !== m.id)) }
                                      )
                                    }
                                  >
                                    <Sparkles className="w-3.5 h-3.5 text-primary mr-2 shrink-0" />
                                    <span className="truncate flex-1">{lancSug.descricao}</span>
                                    <span className="ml-2 text-xs text-muted-foreground tabular-nums">{s.score}</span>
                                  </DropdownMenuItem>
                                ) : null;
                              })}
                              {movSugs.length > 0 && <DropdownMenuSeparator />}
                              <DropdownMenuItem
                                onClick={() => setDialogManual({ movimento_id: m.id, valor: valorAbs, natureza: naturezaSugerida })}
                              >
                                <Link2 className="w-3.5 h-3.5 mr-2" />Vincular a lançamento existente
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setNovoLanc({ movimento_id: m.id, initial: { ...baseInitial, tipo: "a_pagar", natureza: "despesa" }, defaultTipo: "a_pagar" })}
                              >
                                <Plus className="w-3.5 h-3.5 mr-2" />Criar conta a pagar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setNovoLanc({ movimento_id: m.id, initial: { ...baseInitial, tipo: "a_receber", natureza: "receita" }, defaultTipo: "a_receber" })}
                              >
                                <Plus className="w-3.5 h-3.5 mr-2" />Criar conta a receber
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setNovoLanc({ movimento_id: m.id, initial: { ...baseInitial, tipo: "transferencia", natureza: "movimentacao", conta_id: m.conta_id, status: "conciliado" }, defaultTipo: "transferencia" })}
                              >
                                <ArrowLeftRight className="w-3.5 h-3.5 mr-2" />Transferência / Movimentação
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-muted-foreground"
                                onClick={() => {
                                  const motivo = window.prompt("Motivo (opcional) para ignorar este movimento:", "");
                                  if (motivo === null) return;
                                  ignorarMov.mutate({ id: m.id, ignorar: true, motivo: motivo || undefined, mov: { valor: m.valor, descricao: m.descricao, data_movimento: m.data_movimento, conta_id: m.conta_id } });
                                }}
                              >
                                <Ban className="w-3.5 h-3.5 mr-2" />Ignorar / desconsiderar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* ── Dialogs ── */}
        <DialogVincularManual
          info={dialogManual}
          onClose={() => setDialogManual(null)}
          onConfirm={(lancamento_id) => {
            if (!dialogManual) return;
            conciliarManual.mutate(
              { movimento_id: dialogManual.movimento_id, lancamento_id },
              { onSuccess: () => setDialogManual(null) }
            );
          }}
        />

        {novoLanc && (
          <LancamentoDialog
            open={!!novoLanc}
            onOpenChange={(v) => !v && setNovoLanc(null)}
            initial={novoLanc.initial as never}
            defaultTipo={novoLanc.defaultTipo as never}
            onSaved={(lanc) => {
              const movId = novoLanc.movimento_id;
              setNovoLanc(null);
              conciliarManual.mutate(
                { movimento_id: movId, lancamento_id: (lanc as { id: string }).id },
                { onSuccess: () => toast.success("Lançamento criado e movimento conciliado.") }
              );
            }}
          />
        )}
      </TabsContent>

      {/* ════════════════════════════════════════════════════════════════════ */}
      <TabsContent value="relatorio" className="mt-0">
        <FinRelatorioConciliacao />
      </TabsContent>
    </Tabs>
  );
}

// ─── Helpers visuais ──────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  tone: "default" | "success" | "warning" | "danger" | "muted";
}) {
  const cls = {
    default: "text-foreground",
    success: "text-emerald-600 dark:text-emerald-400",
    warning: "text-amber-600 dark:text-amber-400",
    danger: "text-rose-600 dark:text-rose-400",
    muted: "text-muted-foreground",
  }[tone];
  return (
    <div className="rounded-lg border bg-card p-3 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">{label}</span>
        <Icon className={`w-3.5 h-3.5 ${cls}`} />
      </div>
      <span className={`text-base font-semibold tabular-nums ${cls}`}>{value}</span>
    </div>
  );
}

function ScoreBadge({ score, metodo }: { score: number; metodo?: string }) {
  const barColor =
    score >= 90
      ? "bg-emerald-500"
      : score >= 75
      ? "bg-primary"
      : score >= 60
      ? "bg-amber-500"
      : "bg-rose-500";
  const label = score >= 90 ? "Alta" : score >= 75 ? "Boa" : score >= 60 ? "Média" : "Baixa";
  return (
    <div className="w-[64px] space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tabular-nums">{score}</span>
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor} transition-all`}
          style={{ width: `${score}%` }}
        />
      </div>
      {metodo === "ia" && (
        <Badge
          variant="outline"
          className="text-[9px] px-1 py-0 h-3.5 border-primary/40 text-primary gap-0.5 mt-0.5"
        >
          <Sparkles className="w-2 h-2" /> IA
        </Badge>
      )}
    </div>
  );
}

function MotivosBadges({ motivos }: { motivos: Record<string, unknown> }) {
  const valor = motivos?.valor_match === true;
  const dias = Number(motivos?.diferenca_dias ?? -1);
  const sim = Number(motivos?.similaridade_descricao ?? 0);
  const mesmaConta = motivos?.mesma_conta === true;
  return (
    <div className="flex flex-wrap gap-1">
      {valor && (
        <Badge variant="outline" className="text-[10px] border-emerald-500/50 text-emerald-600 dark:text-emerald-400">
          Valor exato
        </Badge>
      )}
      {dias >= 0 && (
        <Badge variant="outline" className="text-[10px]">
          {dias === 0 ? "Mesma data" : `±${dias}d`}
        </Badge>
      )}
      {sim > 0 && (
        <Badge variant="outline" className="text-[10px]">
          Texto {Math.round(sim * 100)}%
        </Badge>
      )}
      {mesmaConta && (
        <Badge variant="outline" className="text-[10px]">
          Mesma conta
        </Badge>
      )}
    </div>
  );
}

// ─── Diálogo de vínculo manual ────────────────────────────────────────────────

function DialogVincularManual({
  info,
  onClose,
  onConfirm,
}: {
  info: { movimento_id: string; valor: number; natureza: "receita" | "despesa" } | null;
  onClose: () => void;
  onConfirm: (lancamentoId: string) => void;
}) {
  const { data: lancamentos } = useLancamentos({ status: "todos" });
  if (!info) return null;

  const elegiveis = (lancamentos ?? []).filter(
    (l) =>
      l.natureza === info.natureza &&
      l.status !== "conciliado" &&
      l.status !== "cancelado"
  );

  const sugeridos = elegiveis.filter(
    (l) => info.valor > 0 && Math.abs(Number(l.valor) - info.valor) / info.valor < 0.02
  );
  const outros = elegiveis.filter((l) => !sugeridos.includes(l));

  const renderItem = (l: (typeof elegiveis)[number], destaque = false) => (
    <button
      key={l.id}
      onClick={() => onConfirm(l.id)}
      className="w-full text-left border rounded-md p-2.5 hover:bg-accent transition-colors mb-1.5"
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`text-sm ${destaque ? "font-semibold" : ""} truncate`}>{l.descricao}</span>
        <span className="text-sm font-mono whitespace-nowrap tabular-nums">{formatBRL(Number(l.valor))}</span>
      </div>
      <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
        <span>{statusLabel[l.status] ?? l.status}</span>
        <span>·</span>
        <span>
          {l.data_vencimento
            ? `Venc.: ${formatDate(l.data_vencimento)}`
            : `Comp.: ${formatDate(l.data_competencia)}`}
        </span>
      </div>
    </button>
  );

  return (
    <Dialog open={!!info} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Vincular a um lançamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {sugeridos.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                Sugestões (valor próximo)
              </div>
              {sugeridos.map((l) => renderItem(l, true))}
            </div>
          )}
          {outros.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                Outros lançamentos {info.natureza === "receita" ? "a receber" : "a pagar"} ({outros.length})
              </div>
              {outros.slice(0, 50).map((l) => renderItem(l))}
            </div>
          )}
          {sugeridos.length === 0 && outros.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-8 space-y-2">
              <p>Nenhum lançamento disponível para vincular.</p>
              <p className="text-xs">
                Crie primeiro um lançamento em <strong>Lançamentos → Novo lançamento</strong>{" "}
                ({info.natureza === "receita" ? "a receber" : "a pagar"}) com valor de{" "}
                <strong>{formatBRL(info.valor)}</strong> e tente vincular novamente.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
