import { useEffect, useMemo, useRef, useState } from "react";
import { acharContrapartida, decidirAcao, type Contrapartida } from "@/lib/financeiro/transferencia-propria";
import { hojeLocal } from "@/lib/financeiro/data-local";
import {
  useContas,
  useExtratosImportados,
  useMovimentosExtrato,
  useImportarOFX,
  useConciliarAutomatico,
  useConciliarManual,
  useCasarTransferencia,
  useCriarTransferenciaDeMovimento,
  useDesfazerConciliacao,
  useResumoPorExtrato,
  useLancamentos,
  useUpsertLancamento,
  useEmpresaId,
} from "@/hooks/useFinanceiro";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
  BarChart3,
  Plus,
  ArrowLeft,
  ArrowLeftRight,
  Ban,
  ChevronDown,
  RotateCcw,
  Clock,
  XCircle,
  Wallet,
  Trash2,
  Pencil,
  Filter,
  ArrowRightLeft,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatBRL, formatDate, statusLabel } from "@/lib/financeiro/formatters";
import { Input } from "@/components/ui/input";
import { parseCsvExtrato, csvParaOfx } from "@/lib/financeiro/csvToOfx";
import { toast } from "sonner";
import EstadoVazio from "@/components/shared/EstadoVazio";
import FinRelatorioConciliacao from "./FinRelatorioConciliacao";
import LancamentoDialog from "./LancamentoDialog";
import SeloDoContrato from "./SeloDoContrato";
import { useVinculosDeContrato } from "@/hooks/useVinculosDeContrato";

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
  // Fluxo em dois passos: a tela abre na lista de extratos e só monta a área de
  // conciliação (movimentos, sugestões, IA) do extrato que o usuário escolher.
  const [extratoAberto, setExtratoAberto] = useState<string | null>(null);
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
  const { data: resumoExtratos } = useResumoPorExtrato();
  const { data: movimentos, isLoading: loadingMov } = useMovimentosExtrato(
    {
      extrato_id: extratoAberto || undefined,
      conta_id: contaSelecionada || undefined,
      conciliado:
        filtroConciliado === "todos" || filtroConciliado === "ignorado"
          ? undefined
          : filtroConciliado === "conciliado",
    },
    { enabled: !!extratoAberto },
  );
  const { data: lancamentosTodos } = useLancamentos({});
  // O que cada título sustenta na Gestão. Conciliar passou a TER efeito lá —
  // o gatilho da 20260831000001 refaz a quitação do pedido —, e efeito que a
  // tela não anuncia é efeito que ninguém confere.
  const { data: vinculosDeContrato } = useVinculosDeContrato();

  const extratoAtivo = useMemo(
    () => (extratos ?? []).find((e) => e.id === extratoAberto) ?? null,
    [extratos, extratoAberto],
  );

  function abrirExtrato(ex: { id: string; conta_id: string }) {
    setExtratoAberto(ex.id);
    setContaSelecionada(ex.conta_id);
    setSugestoes([]);
    setSelecionadas(new Set());
    setMovsSelecionados(new Set());
    setFiltroConciliado("pendente");
  }

  function voltarParaLista() {
    setExtratoAberto(null);
    setSugestoes([]);
    setSelecionadas(new Set());
    setMovsSelecionados(new Set());
  }

  // ─── Mutations ────────────────────────────────────────────────────────────
  const importar = useImportarOFX();
  const conciliarAuto = useConciliarAutomatico();
  const conciliarManual = useConciliarManual();
  const casarTransferencia = useCasarTransferencia();
  const criarTransferencia = useCriarTransferenciaDeMovimento();
  /** Conta do outro lado escolhida por movimento, quando a ponta não existe. */
  const [contrapartidaEscolhida, setContrapartidaEscolhida] = useState<Record<string, string>>({});

  /**
   * Transferência entre contas próprias, reconhecida antes de conciliar.
   *
   * O extrato de cada conta enxerga metade da operação, e nada nas duas linhas
   * diz que são a mesma coisa. Conciliadas às cegas viram uma despesa e uma
   * receita que nunca existiram — foi assim que R$ 19,17 milhões em pernas de
   * transferência entraram nos relatórios de margem.
   *
   * O casamento é aritmético: mesmo valor, sinais opostos, contas próprias
   * diferentes, datas próximas. A regra e os testes estão em
   * src/lib/financeiro/transferencia-propria.ts.
   */
  const contasProprias = useMemo(
    () => (contas ?? []).map((c: { id: string }) => c.id),
    [contas],
  );

  const candidatosTransferencia = useMemo<Contrapartida[]>(() => {
    type LancParaCasar = {
      id: string; conta_id: string | null; natureza: string | null; valor: number | string;
      data_realizado: string | null; data_competencia: string | null; descricao: string | null;
    };
    return ((lancamentosTodos ?? []) as unknown as LancParaCasar[])
      .filter((l) => !!l.conta_id && contasProprias.includes(l.conta_id))
      .map((l) => ({
        id: l.id,
        conta_id: l.conta_id,
        // O extrato usa sinal; o lançamento usa `natureza`. Traduz para poder
        // comparar sentidos: sem isto, saída e entrada pareceriam iguais.
        valor: (l.natureza === 'despesa' ? -1 : 1) * Math.abs(Number(l.valor) || 0),
        data: String(l.data_realizado ?? l.data_competencia ?? '').slice(0, 10),
        descricao: l.descricao,
        origem: 'lancamento' as const,
      }));
  }, [lancamentosTodos, contasProprias]);

  const paresPorMovimento = useMemo(() => {
    const mapa = new Map<string, ReturnType<typeof acharContrapartida>>();
    type MovParaCasar = {
      id: string; conta_id: string | null; valor: number | string; data_movimento: string;
      descricao: string | null; conciliado?: boolean | null; ignorado?: boolean | null;
    };
    for (const m of (movimentos ?? []) as unknown as MovParaCasar[]) {
      if (m.conciliado || m.ignorado) continue;
      const pares = acharContrapartida(
        { id: m.id, conta_id: m.conta_id, valor: Number(m.valor), data_movimento: m.data_movimento, descricao: m.descricao },
        candidatosTransferencia,
        { contasProprias },
      );
      if (pares.length > 0) mapa.set(m.id, pares);
    }
    return mapa;
  }, [movimentos, candidatosTransferencia, contasProprias]);
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
              data_competencia: params.mov.data_movimento ?? hojeLocal(),
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

  /**
   * O "saldo do sistema" vem da RÉGUA ÚNICA do banco (financeiro_saldo_derivado)
   * — a mesma que o recálculo grava e a conferência mede. A cópia local que
   * vivia aqui divergia em três pontos (contava previsto, tratava movimentação
   * como saída e ignorava conta_destino_id): uma transferência de linha única
   * de 50 mil fazia a tela acusar 50 mil de divergência inexistente no destino
   * (A9 da auditoria). Uma fórmula, um lugar — também no cliente.
   */
  const { data: saldoSistema = 0 } = useQuery({
    queryKey: ["fin-saldo-derivado", contaSelecionada],
    enabled: !!contaSelecionada,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("financeiro_saldo_derivado", {
        p_conta_id: contaSelecionada,
      });
      if (error) throw error;
      return Number(data) || 0;
    },
  });

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
        // Saldo: o lançamento conciliado acima já disparou o gatilho.
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
      <TabsList>
        <TabsTrigger value="conciliar">
          <Link2 className="w-4 h-4 mr-2" />Conciliação
        </TabsTrigger>
        <TabsTrigger value="relatorio">
          <BarChart3 className="w-4 h-4 mr-2" />Relatório por período
        </TabsTrigger>
      </TabsList>

      {/* ════════════════════════════════════════════════════════════════════ */}
      <TabsContent value="conciliar" className="space-y-4 mt-0">

        {/* ══════════ LISTA DE EXTRATOS (tela inicial) ══════════ */}
        {!extratoAberto && (
          <>
            {/* ── Importar ── */}
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-wrap items-end gap-4">
                  <div className="flex-1 min-w-[200px] space-y-2">
                    <Label htmlFor="conciliacao-conta">Conta bancária</Label>
                    <Select value={contaSelecionada} onValueChange={setContaSelecionada}>
                      <SelectTrigger id="conciliacao-conta">
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

                  <div className="flex flex-wrap items-center gap-2 ml-auto">
                    <input ref={fileRef} type="file" accept=".ofx,.OFX" className="hidden" onChange={onFile} />
                    <input ref={csvRef} type="file" accept=".csv,.CSV,text/csv" className="hidden" onChange={onCsvFile} />

                    <Button
                      variant="outline"
                      onClick={() => fileRef.current?.click()}
                      disabled={importar.isPending || !contaSelecionada}
                    >
                      {importar.isPending
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Upload className="w-4 h-4" />}
                      Importar OFX
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => csvRef.current?.click()}
                      disabled={importar.isPending || !contaSelecionada}
                      title="CSV com colunas: data, descricao, valor (opcional documento)"
                    >
                      {importar.isPending
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Upload className="w-4 h-4" />}
                      Importar CSV
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── Extratos para conciliar ── */}
            <Card>
              <CardHeader className="py-4 px-6 border-b border-border">
                <CardTitle className="flex flex-wrap items-center gap-2">
                  <FileCheck2 className="w-5 h-5 text-muted-foreground" />
                  Extratos importados
                  <Badge variant="muted">{extratos?.length ?? 0}</Badge>
                  <span className="ml-auto text-sm font-normal text-muted-foreground">
                    Clique em um extrato para conciliar
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {(extratos?.length ?? 0) === 0 ? (
                  <EstadoVazio
                    icone={<FileCheck2 />}
                    titulo="Nenhum extrato importado"
                    descricao="Selecione a conta acima e importe um arquivo OFX ou CSV para começar a conciliar"
                  />
                ) : (
                  <div className="divide-y divide-border">
                    {(extratos ?? []).map((ex) => {
                      const r = resumoExtratos?.get(ex.id);
                      const total = r?.total ?? ex.total_movimentos ?? 0;
                      const conciliados = r?.conciliados ?? 0;
                      const pendentes = r?.pendentes ?? 0;
                      const pct = total ? Math.round((conciliados / total) * 100) : 0;
                      const concluido = total > 0 && pendentes === 0;
                      return (
                        <div
                          key={ex.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => abrirExtrato(ex)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); abrirExtrato(ex); }
                          }}
                          className="flex flex-wrap items-center gap-4 px-6 py-4 cursor-pointer hover:bg-muted transition-colors focus:outline-none focus-visible:bg-muted"
                        >
                          <div className="min-w-[220px] flex-1">
                            <div className="flex items-center gap-2">
                              <FileCheck2 className={`w-4 h-4 shrink-0 ${concluido ? "text-success" : "text-muted-foreground"}`} />
                              <span className="text-base font-medium truncate">{ex.arquivo_nome}</span>
                            </div>
                            <div className="text-sm text-muted-foreground mt-1 pl-6">
                              {ex.conta?.nome ?? "—"} ·{" "}
                              {ex.data_inicio ? formatDate(ex.data_inicio) : "?"} → {ex.data_fim ? formatDate(ex.data_fim) : "?"}
                            </div>
                          </div>

                          <div className="w-[150px]">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-muted-foreground tabular-nums">
                                {conciliados}/{total}
                              </span>
                              <span className={`tabular-nums ${concluido ? "text-success-ink" : "text-muted-foreground"}`}>
                                {pct}%
                              </span>
                            </div>
                            <div
                              className="h-1.5 rounded-full bg-muted overflow-hidden"
                              role="progressbar"
                              aria-valuenow={pct}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-label={`${conciliados} de ${total} movimentos conciliados`}
                            >
                              <div
                                className={`h-full rounded-full transition-all ${concluido ? "bg-success" : "bg-primary"}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>

                          <div className="w-[130px] text-right">
                            {concluido ? (
                              <Badge variant="success" className="gap-1">
                                <CheckCircle2 className="h-3 w-3" />Conciliado
                              </Badge>
                            ) : (
                              <>
                                <div className="text-sm font-semibold tabular-nums text-warning-ink">
                                  {pendentes} pendente{pendentes === 1 ? "" : "s"}
                                </div>
                                {!!r?.valor_pendente && (
                                  <div className="text-xs text-muted-foreground tabular-nums">
                                    {formatBRL(r.valor_pendente)}
                                  </div>
                                )}
                              </>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="sm"
                              onClick={() => abrirExtrato(ex)}
                            >
                              <Link2 className="w-4 h-4" />Conciliar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={`Reprocessar extrato ${ex.arquivo_nome}`}
                              onClick={() => iniciarReprocesso(ex.id, ex.conta_id, ex.arquivo_nome)}
                              disabled={reprocessando === ex.id}
                              title="Reprocessar extrato com parser atualizado"
                            >
                              {reprocessando === ex.id
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : <RotateCcw className="w-4 h-4" />}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              aria-label={`Apagar extrato ${ex.arquivo_nome}`}
                              onClick={() => setConfirmApagarExtrato({ extrato_id: ex.id, arquivo_nome: ex.arquivo_nome, total_movimentos: ex.total_movimentos ?? 0 })}
                              disabled={apagandoExtrato === ex.id}
                              title="Apagar extrato e seus movimentos"
                            >
                              {apagandoExtrato === ex.id
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : <Trash2 className="w-4 h-4" />}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* ══════════ CONCILIAÇÃO DO EXTRATO SELECIONADO ══════════ */}
        {extratoAberto && (
          <>
        {/* ── Controles ── */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[220px]">
                <Button variant="ghost" size="sm" className="-ml-3 text-muted-foreground" onClick={voltarParaLista}>
                  <ArrowLeft className="w-4 h-4" />Todos os extratos
                </Button>
                <div className="flex items-center gap-2 mt-2">
                  <FileCheck2 className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-lg font-semibold truncate">{extratoAtivo?.arquivo_nome ?? "Extrato"}</span>
                </div>
                <div className="text-sm text-muted-foreground pl-6">
                  {extratoAtivo?.conta?.nome ?? "—"} ·{" "}
                  {extratoAtivo?.data_inicio ? formatDate(extratoAtivo.data_inicio) : "?"} →{" "}
                  {extratoAtivo?.data_fim ? formatDate(extratoAtivo.data_fim) : "?"}
                </div>
              </div>

              <div className="min-w-[150px] space-y-2">
                <Label htmlFor="conciliacao-exibindo">Exibindo</Label>
                <Select
                  value={filtroConciliado}
                  onValueChange={(v) => setFiltroConciliado(v as typeof filtroConciliado)}
                >
                  <SelectTrigger id="conciliacao-exibindo">
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

              <div className="flex flex-wrap items-center gap-2 ml-auto">
                <Button
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
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Sparkles className="w-4 h-4" />}
                  Auto-conciliar (≥ 90)
                </Button>

                <Button
                  variant="outline"
                  onClick={classificarTodas}
                  disabled={classificandoTodas || !contaSelecionada || (movimentos ?? []).filter((m: any) => !m.conciliado && !m.ignorado).length === 0}
                  title="Classifica todos os movimentos pendentes com IA de uma vez"
                >
                  {classificandoTodas
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Sparkles className="w-4 h-4" />}
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* 1. Saldo extrato */}
              <div className="rounded-lg border border-border bg-card p-6 space-y-2 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Saldo extrato</span>
                  <Wallet className="w-4 h-4 text-muted-foreground" />
                </div>
                <span className={`block text-[2rem] leading-10 font-bold tabular-nums ${saldoExtrato >= 0 ? "text-success-ink" : "text-destructive-ink"}`}>
                  {formatBRL(saldoExtrato)}
                </span>
                <div className="text-xs text-muted-foreground tabular-nums">
                  <span className="text-success-ink">+{formatBRL(resumoMovimentos.entradas)}</span>
                  {" / "}
                  <span className="text-destructive-ink">-{formatBRL(resumoMovimentos.saidas)}</span>
                </div>
              </div>

              {/* 2. Saldo sistema */}
              <div className="rounded-lg border border-border bg-card p-6 space-y-2 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Saldo sistema</span>
                  <BarChart3 className="w-4 h-4 text-muted-foreground" />
                </div>
                <span className={`block text-[2rem] leading-10 font-bold tabular-nums ${saldoSistema >= 0 ? "text-foreground" : "text-destructive-ink"}`}>
                  {formatBRL(saldoSistema)}
                </span>
                <div className="text-xs text-muted-foreground">Lançamentos da conta</div>
              </div>

              {/* 3. Diferença */}
              <div className={`rounded-lg border p-6 space-y-2 shadow-sm ${emEquilibrio ? "border-success-line bg-success-tint" : "border-warning-line bg-warning-tint"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-xs font-semibold uppercase tracking-wide ${emEquilibrio ? "text-success-ink" : "text-warning-ink"}`}>Diferença</span>
                  {emEquilibrio
                    ? <CheckCircle2 className="w-4 h-4 text-success-ink" />
                    : <XCircle className="w-4 h-4 text-warning-ink" />}
                </div>
                <span className={`block text-[2rem] leading-10 font-bold tabular-nums ${emEquilibrio ? "text-success-ink" : "text-warning-ink"}`}>
                  {emEquilibrio ? "Em dia" : formatBRL(Math.abs(diferenca))}
                </span>
                <div className={`text-xs ${emEquilibrio ? "text-success-ink" : "text-warning-ink"}`}>{emEquilibrio ? "Extrato e sistema batem" : diferenca > 0 ? "Extrato maior" : "Sistema maior"}</div>
              </div>

              {/* 4. Conciliados / progresso */}
              <div className="rounded-lg border border-border bg-card p-6 space-y-2 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Conciliados</span>
                  <CheckCircle2 className="w-4 h-4 text-success" />
                </div>
                <span className="block text-[2rem] leading-10 font-bold tabular-nums text-foreground">
                  {resumoGeral.conciliados}
                  <span className="text-base font-normal text-muted-foreground"> / {resumoGeral.total}</span>
                </span>
                <div
                  className="h-1.5 rounded-full bg-muted overflow-hidden"
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${resumoGeral.conciliados} de ${resumoGeral.total} movimentos conciliados`}
                >
                  <div className="h-full rounded-full bg-success transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>

              {/* 5. Pendentes */}
              <div className="rounded-lg border border-border bg-card p-6 space-y-2 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pendentes</span>
                  <Clock className="w-4 h-4 text-warning-ink" />
                </div>
                <span className="block text-[2rem] leading-10 font-bold tabular-nums text-warning-ink">
                  {resumoGeral.pendentes}
                </span>
                <div className="text-xs text-muted-foreground">{resumoGeral.ignorados} ignorado(s)</div>
              </div>

              {/* 6. Valor pendente de conciliar */}
              <div className="rounded-lg border border-border bg-card p-6 space-y-2 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">A conciliar</span>
                  <ArrowLeftRight className="w-4 h-4 text-muted-foreground" />
                </div>
                <span className="block text-[2rem] leading-10 font-bold tabular-nums text-foreground">
                  {formatBRL(valorPendente)}
                </span>
                <div className="text-xs text-muted-foreground tabular-nums">
                  <span className="text-success-ink">+{formatBRL(entradasPendentes)}</span>
                  {" / "}
                  <span className="text-destructive-ink">-{formatBRL(saidasPendentes)}</span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── Sugestões ── */}
        <Card>
          <CardHeader className="py-4 px-6 border-b border-border">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-muted-foreground" />
                <CardTitle>Sugestões de conciliação</CardTitle>
                {sugestoes.length > 0 && (
                  <Badge variant="muted" className="tabular-nums">
                    {sugestoes.length}
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 ml-auto">
                <div className="flex items-center gap-2 min-w-[210px]">
                  <span className="whitespace-nowrap text-sm font-medium text-muted-foreground">Score mín.</span>
                  <Slider
                    aria-label="Score mínimo das sugestões"
                    value={[scoreMinimo]}
                    onValueChange={([v]) => setScoreMinimo(v)}
                    min={50} max={100} step={5}
                    className="flex-1"
                  />
                  <span className="w-7 text-right text-sm font-semibold tabular-nums">{scoreMinimo}</span>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => buscarSugestoes(false)}
                  disabled={conciliarAuto.isPending}
                >
                  {conciliarAuto.isPending
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Search className="w-4 h-4" />}
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
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Sparkles className="w-4 h-4" />}
                  Sugerir com IA
                </Button>

                {sugestoes.length > 0 && (
                  <>
                    <Button
                      size="sm"
                      onClick={aplicarSelecionadas}
                      disabled={selecionadas.size === 0}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Aplicar ({selecionadas.size})
                    </Button>
                    <Button variant="outline" size="sm" onClick={aplicarTodasAlta}>
                      <Sparkles className="w-4 h-4" />
                      Aprovar ≥ 90
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {sugestoes.length === 0 ? (
              <EstadoVazio
                icone={<Search />}
                titulo="Nenhuma sugestão buscada ainda"
                descricao={
                  <>
                    Clique em <strong>Buscar</strong> para encontrar correspondências entre movimentos do extrato e
                    lançamentos, sem aplicar alterações. Use <strong>Auto-conciliar</strong> para aplicar de uma vez
                    todos os matches com score ≥ 90.
                  </>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted">
                      <TableHead className="w-[44px] pl-6">
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
                      <TableHead className="text-right w-[100px] pr-6">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sugestoes.map((s) => {
                      const mov = movMap.get(s.movimento_id);
                      const lanc = lancMap.get(s.lancamento_id);
                      const checked = selecionadas.has(s.movimento_id);
                      return (
                        <TableRow key={s.movimento_id + s.lancamento_id} className="text-sm">
                          <TableCell className="pl-6">
                            <Checkbox
                              checked={checked}
                              aria-label="Selecionar sugestão"
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
                                <div className="font-medium truncate max-w-[220px]" title={mov.descricao}>{mov.descricao}</div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  {formatDate(mov.data_movimento)} ·{" "}
                                  <span className={`tabular-nums ${Number(mov.valor) >= 0 ? "text-success-ink" : "text-destructive-ink"}`}>
                                    {formatBRL(Number(mov.valor))}
                                  </span>
                                </div>
                              </div>
                            ) : <span className="text-muted-foreground text-xs">—</span>}
                          </TableCell>
                          <TableCell>
                            {lanc ? (
                              <div>
                                <div className="font-medium truncate max-w-[220px]" title={lanc.descricao}>{lanc.descricao}</div>
                                <div className="text-xs text-muted-foreground tabular-nums mt-1">
                                  {lanc.data_vencimento ? `Venc.: ${formatDate(lanc.data_vencimento)}` : "—"} · {formatBRL(Number(lanc.valor))}
                                </div>
                                {/* Conciliar aqui marca uma entrega como paga
                                    do outro lado. Dizer isso ANTES do clique é
                                    o que separa conferir de descobrir depois. */}
                                <SeloDoContrato
                                  vinculo={vinculosDeContrato?.[s.lancamento_id]}
                                  statusFuturo="conciliado"
                                />
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs">Lançamento fora da página atual</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <MotivosBadges motivos={s.motivos} />
                              {s.justificativa_ia && (
                                <p className="text-xs italic text-muted-foreground max-w-[15rem]">
                                  "{s.justificativa_ia}"
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right pr-5">
                            <Button
                              size="sm"
                              variant="outline"
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
                              <Link2 />
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

          </>
        )}

        {/* Input escondido do reprocesso — usado a partir da lista */}
        <input
          ref={reprocFileRef}
          type="file"
          accept=".ofx,.OFX"
          className="hidden"
          onChange={onReprocessarFile}
        />

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
                    Lançamentos conciliados por este extrato não serão excluídos: voltam a
                    <strong> previsto</strong>, aguardando conciliação de novo.
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
                    /**
                     * Desfazer a conciliação ANTES de apagar o extrato.
                     *
                     * `financeiro_conciliacoes` cai por ON DELETE CASCADE junto
                     * com os movimentos — mas o `status = conciliado` fica no
                     * lançamento. Resultado: marca sem fato. Na reimportação o
                     * motor não enxergava esses lançamentos, nenhum match era
                     * achado, e as pendências ficavam insolúveis pela tela.
                     *
                     * Só reverte quem estava conciliado POR CAUSA deste extrato
                     * — a conciliação diz quais são. Quem foi marcado por outro
                     * caminho não é tocado.
                     */
                    const { data: vinculos } = await supabase
                      .from("financeiro_conciliacoes")
                      .select("lancamento_id, extrato_movimento_id, financeiro_extrato_movimentos!inner(extrato_id)")
                      .eq("financeiro_extrato_movimentos.extrato_id", confirmApagarExtrato.extrato_id);
                    const idsParaReverter = [
                      ...new Set(((vinculos ?? []) as { lancamento_id: string }[]).map((v) => v.lancamento_id)),
                    ];
                    if (idsParaReverter.length > 0) {
                      await supabase
                        .from("financeiro_lancamentos")
                        .update({ status: "previsto", data_conciliado: null } as never)
                        .in("id", idsParaReverter)
                        .eq("status", "conciliado");
                    }

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
                    toast.success(
                      idsParaReverter.length > 0
                        ? `Extrato apagado · ${idsParaReverter.length} lançamento(s) voltaram a previsto`
                        : "Extrato apagado.",
                      { description: idsParaReverter.length > 0
                          ? "Eles perderam o que os conciliava, então voltaram a aguardar conciliação."
                          : undefined },
                    );
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
        {/* As duas colunas (extrato × sistema) são lidas lado a lado: em tela
            estreita elas rolam juntas dentro do cartão, sem espremer a linha
            nem empurrar a página inteira para o lado. */}
        {extratoAberto && (
        <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
          {/* Cabeçalho split e linhas rolam juntos, no mesmo eixo. O
              "carregando" e o estado vazio ficam FORA da faixa de 52rem
              (logo abaixo, no fecho do cartão): dentro dela um extrato sem
              movimentos nasceria com barra de rolagem e o texto centralizado
              cairia fora do campo de visão em tela estreita. */}
          <div className="overflow-x-auto">
          <div className="min-w-[52rem]">
          {/* Cabeçalho split */}
          <div className="grid grid-cols-[1fr_auto_1fr] bg-muted border-b border-border">
            <div className="px-4 py-3 flex items-center gap-3">
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
              <span className="text-sm font-semibold text-foreground">Extrato bancário</span>
            </div>
            <div className="w-px bg-border" />
            <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-foreground">Lançamento do sistema</span>
              {movsSelecionados.size > 0 && (
                <Button
                  size="sm"
                  onClick={efetivarSelecionados}
                  disabled={upsertLancamento.isPending || conciliarManual.isPending}
                >
                  {(upsertLancamento.isPending || conciliarManual.isPending)
                    ? <Loader2 className="animate-spin" />
                    : <CheckCircle2 />}
                  Efetivar ({movsSelecionados.size})
                </Button>
              )}
            </div>
          </div>

          {/* Grupos por data */}
          {!loadingMov && movimentosAgrupados.map((group) => (
            <div key={group.date}>
              {/* Separador de data */}
              <div className="flex items-center gap-3 px-4 py-2 bg-muted border-y border-border text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{formatDate(group.date)}</span>
                <div className="flex-1 h-px bg-border" />
                {group.creditos > 0 && (
                  <span className="text-success-ink tabular-nums">+{formatBRL(group.creditos)}</span>
                )}
                {group.debitos > 0 && (
                  <span className="text-destructive-ink tabular-nums">-{formatBRL(group.debitos)}</span>
                )}
                <span className="text-muted-foreground">{group.movimentos.length} mov.</span>
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
                // Transferência entre contas próprias tem precedência sobre a
                // sugestão comum: conciliar às cegas cria receita e despesa que
                // não existiram, e depois ninguém desfaz porque o saldo fecha.
                const paresTransf = paresPorMovimento.get(m.id) ?? [];
                const acaoTransf = m.conciliado || m.ignorado
                  ? "nenhum"
                  : decidirAcao(
                      { id: m.id, conta_id: m.conta_id, valor: Number(m.valor), data_movimento: m.data_movimento, descricao: m.descricao },
                      paresTransf,
                    );
                const borderColor = m.conciliado
                  ? "border-l-success"
                  : m.ignorado
                  ? "border-l-border"
                  : acaoTransf !== "nenhum"
                  ? "border-l-info"
                  : movSugs.length > 0
                  ? "border-l-primary"
                  : "border-l-warning";

                return (
                  <div
                    key={m.id}
                    className={`grid grid-cols-[1fr_auto_1fr] border-b border-border border-l-2 hover:bg-muted transition-colors ${borderColor} ${m.ignorado ? "opacity-60" : ""}`}
                  >
                    {/* ESQUERDA: Extrato */}
                    <div className="flex items-start gap-3 px-4 py-3">
                      {!m.conciliado && !m.ignorado ? (
                        <Checkbox
                          checked={movsSelecionados.has(m.id)}
                          onCheckedChange={(v) => {
                            setMovsSelecionados((curr) => {
                              const next = new Set(curr);
                              if (v) next.add(m.id);
                              else next.delete(m.id);
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
                          <span className={`text-sm font-semibold tabular-nums shrink-0 ${isCredito ? "text-success-ink" : "text-destructive-ink"}`}>
                            {isCredito ? "+" : ""}{formatBRL(Number(m.valor))}
                          </span>
                        </div>
                        {m.descricao_extra && (
                          <div className="text-xs text-muted-foreground truncate">{m.descricao_extra}</div>
                        )}
                        <div className="text-xs text-muted-foreground mt-1">{m.conta?.nome ?? "—"}</div>

                        {/* Transferência entre contas próprias.
                            Fica do lado do EXTRATO, não do sistema, porque a
                            pergunta é sobre esta linha do banco: "isto é dinheiro
                            entrando, ou é o seu próprio dinheiro mudando de
                            conta?". Conciliar sem responder cria receita e
                            despesa que nunca existiram — e depois ninguém
                            desfaz, porque o saldo fecha. */}
                        {acaoTransf === "casar" && paresTransf[0] && (
                          <div className="mt-2 rounded-md border border-border bg-muted p-3">
                            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                              <ArrowRightLeft className="w-4 h-4 shrink-0" />
                              Transferência entre contas próprias
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Casa com <strong className="text-foreground">{paresTransf[0].contrapartida.descricao || "lançamento"}</strong>
                              {" "}({paresTransf[0].motivos.join(" · ")}).
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Isto não é receita nem despesa: é o mesmo dinheiro mudando de conta.
                            </p>
                            <Button
                              size="sm" variant="outline"
                              className="mt-2"
                              disabled={casarTransferencia.isPending}
                              onClick={() =>
                                casarTransferencia.mutate({
                                  movimento_id: m.id,
                                  movimento_conta_id: m.conta_id,
                                  movimento_valor: Number(m.valor),
                                  lancamento_id: paresTransf[0].contrapartida.id,
                                  lancamento_conta_id: paresTransf[0].contrapartida.conta_id!,
                                })
                              }
                            >
                              Unificar como transferência
                            </Button>
                          </div>
                        )}
                        {acaoTransf === "criar_par" && (
                          <div className="mt-2 rounded-md border border-warning-line bg-warning-tint p-3">
                            <p className="text-sm font-semibold text-warning-ink flex items-center gap-2">
                              <ArrowRightLeft className="w-4 h-4 shrink-0" />
                              Parece transferência, e falta a outra ponta
                            </p>
                            <p className="text-xs text-warning-ink mt-1">
                              A descrição indica movimentação entre contas próprias, mas nenhuma conta
                              da empresa registra o valor no sentido oposto — provavelmente o extrato
                              da outra conta ainda não foi importado.
                            </p>
                            {/* Sem esta escolha sobrariam dois caminhos ruins:
                                lançar como despesa (inventando um custo) ou
                                deixar o movimento pendente para sempre. */}
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              <Select
                                value={contrapartidaEscolhida[m.id] ?? ""}
                                onValueChange={(v) =>
                                  setContrapartidaEscolhida((c) => ({ ...c, [m.id]: v }))
                                }
                              >
                                <SelectTrigger className="w-full sm:w-56" aria-label={Number(m.valor) >= 0 ? "Conta de origem da transferência" : "Conta de destino da transferência"}>
                                  <SelectValue placeholder={Number(m.valor) >= 0 ? "Saiu de qual conta?" : "Entrou em qual conta?"} />
                                </SelectTrigger>
                                <SelectContent>
                                  {(contas ?? [])
                                    .filter((c: { id: string }) => c.id !== m.conta_id)
                                    .map((c: { id: string; nome: string }) => (
                                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                              <Button
                                size="sm" variant="outline"
                                disabled={!contrapartidaEscolhida[m.id] || criarTransferencia.isPending}
                                onClick={() =>
                                  criarTransferencia.mutate({
                                    movimento_id: m.id,
                                    movimento_conta_id: m.conta_id,
                                    movimento_valor: Number(m.valor),
                                    data: m.data_movimento,
                                    descricao: m.descricao || "Transferência entre contas próprias",
                                    contrapartida_conta_id: contrapartidaEscolhida[m.id],
                                  })
                                }
                              >
                                Lançar a contrapartida
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* DIVISOR VERTICAL */}
                    <div className="w-px bg-border my-2" />

                    {/* DIREITA: Sistema */}
                    <div className="flex items-center gap-2 px-4 py-3 min-w-0">
                      {m.conciliado && m.lancamento ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{m.lancamento.descricao}</div>
                            <div className="text-xs text-muted-foreground">
                              {statusLabel[m.lancamento.status] ?? m.lancamento.status}
                              {m.lancamento.data_vencimento && ` · Venc: ${formatDate(m.lancamento.data_vencimento)}`}
                            </div>
                            {/* Já conciliado: aqui o selo serve para DESFAZER
                                com consciência — soltar este movimento tira a
                                quitação do pedido. */}
                            <SeloDoContrato
                              vinculo={m.lancamento_id ? vinculosDeContrato?.[m.lancamento_id] : undefined}
                              statusFuturo={m.lancamento.status}
                            />
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-muted-foreground shrink-0"
                            onClick={() => desfazer.mutate({ movimento_id: m.id, lancamento_id: m.lancamento_id! })}
                          >
                            <Unlink />Desfazer
                          </Button>
                        </>
                      ) : m.ignorado ? (
                        <>
                          <Ban className="w-4 h-4 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <Badge variant="muted" truncate>
                              {m.ignorado_motivo || "Ignorado"}
                            </Badge>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-muted-foreground shrink-0"
                            onClick={() => ignorarMov.mutate({ id: m.id, ignorar: false, mov: { valor: m.valor, descricao: m.descricao, data_movimento: m.data_movimento, conta_id: m.conta_id, lancamento_id: m.lancamento_id } })}
                          >
                            <RotateCcw />Restaurar
                          </Button>
                        </>
                      ) : (
                        <>
                          {/* Card de sugestão IA se já classificou */}
                          {aiClassifs[m.id] ? (
                            <div className="flex-1 min-w-0">
                              <div className="rounded-md border border-border bg-muted p-3 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-muted-foreground shrink-0" />
                                    <span className="text-sm font-semibold text-foreground">Sugestão IA</span>
                                    <Badge variant="muted" className="tabular-nums">{aiClassifs[m.id].confianca}%</Badge>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    aria-label="Descartar sugestão da IA"
                                    className="shrink-0 px-2 text-muted-foreground"
                                    onClick={() => setAiClassifs((p) => { const n = { ...p }; delete n[m.id]; return n; })}
                                  >
                                    <XCircle />
                                  </Button>
                                </div>
                                <div className="space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="info">
                                      {aiClassifs[m.id].tipo === "a_pagar" ? "Conta a Pagar" : aiClassifs[m.id].tipo === "a_receber" ? "Conta a Receber" : "Movimentação"}
                                    </Badge>
                                    {aiClassifs[m.id].categoria_nome && (
                                      <Badge variant="muted">
                                        {aiClassifs[m.id].categoria_nome}
                                      </Badge>
                                    )}
                                    {aiClassifs[m.id].pessoa_nome && (
                                      <Badge variant="muted">
                                        {aiClassifs[m.id].pessoa_nome}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs italic text-muted-foreground">{aiClassifs[m.id].justificativa}</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    size="sm"
                                    className="flex-1"
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
                                    <Plus />Criar com IA
                                  </Button>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button size="sm" variant="outline" className="px-2" aria-label="Outras formas de tratar este movimento">
                                        <ChevronDown />
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
                            <Badge variant="info" className="gap-1 shrink-0">
                              <Sparkles className="h-3 w-3" />{movSugs.length} sugestão
                            </Badge>
                          )}
                          {/* Botão Analisar com IA */}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-primary hover:bg-primary-tint shrink-0"
                            onClick={() => classificarLancamento(m)}
                            disabled={classificandoIA[m.id]}
                          >
                            {classificandoIA[m.id]
                              ? <Loader2 className="animate-spin" />
                              : <Sparkles />}
                            {classificandoIA[m.id] ? "Analisando…" : "IA"}
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="outline" className="ml-auto">
                                <Link2 />Tratar<ChevronDown />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-60 max-h-[60vh] overflow-y-auto">
                              <DropdownMenuLabel className="text-xs tabular-nums text-muted-foreground">
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
                                    <Sparkles className="w-3.5 h-3.5 text-muted-foreground mr-2 shrink-0" />
                                    <span className="truncate flex-1" title={lancSug.descricao}>
                                      {lancSug.descricao}
                                      {/* No menu o espaço é curto: só o número
                                          do contrato, que já basta para não
                                          escolher o título errado entre dois
                                          de mesmo valor. */}
                                      {vinculosDeContrato?.[s.lancamento_id]?.numero_contrato && (
                                        <span className="ml-1 text-primary">
                                          · {vinculosDeContrato[s.lancamento_id].numero_contrato}
                                        </span>
                                      )}
                                    </span>
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
          </div>

          {/* Estado vazio / loading — herdam a largura real do cartão */}
          {loadingMov && (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground" role="status">
              <Loader2 className="w-4 h-4 animate-spin" />Carregando movimentos…
            </div>
          )}
          {!loadingMov && movimentosFiltrados.length === 0 && (
            <EstadoVazio
              icone={<FileCheck2 />}
              titulo={contaSelecionada ? "Nenhum movimento nesta visão" : "Nenhuma conta selecionada"}
              descricao={
                contaSelecionada
                  ? "Importe um arquivo OFX ou CSV, ou troque o filtro de exibição, para ver movimentos aqui"
                  : "Selecione uma conta bancária para visualizar os movimentos"
              }
            />
          )}
        </div>
        )}

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

function ScoreBadge({ score, metodo }: { score: number; metodo?: string }) {
  // Quatro degraus, um por faixa do rótulo. "Alta" (>= 90) e "Boa" (75-89) têm
  // que se distinguir de relance: é entre elas que o operador decide entre o
  // botão "Aprovar >= 90" e a conferência à mão. O degrau da "Boa" usa o token
  // `success-line` (verde mais fraco nos dois temas) no lugar do antigo
  // `bg-success/60` — mesmo efeito, sem compor alfa na mão.
  const barColor =
    score >= 90
      ? "bg-success"
      : score >= 75
      ? "bg-success-line"
      : score >= 60
      ? "bg-warning"
      : "bg-destructive";
  const label = score >= 90 ? "Alta" : score >= 75 ? "Boa" : score >= 60 ? "Média" : "Baixa";
  return (
    <div className="w-16 space-y-1">
      <div className="flex items-center justify-between gap-1">
        <span className="text-sm font-semibold tabular-nums">{score}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div
        className="h-1.5 rounded-full bg-muted overflow-hidden"
        role="progressbar"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Compatibilidade ${label.toLowerCase()}: ${score} de 100`}
      >
        <div
          className={`h-full rounded-full ${barColor} transition-all`}
          style={{ width: `${score}%` }}
        />
      </div>
      {metodo === "ia" && (
        <Badge variant="muted" className="gap-1">
          <Sparkles className="h-3 w-3" /> IA
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
        <Badge variant="success">
          Valor exato
        </Badge>
      )}
      {dias >= 0 && (
        <Badge variant="muted" className="tabular-nums">
          {dias === 0 ? "Mesma data" : `±${dias}d`}
        </Badge>
      )}
      {sim > 0 && (
        <Badge variant="muted" className="tabular-nums">
          Texto {Math.round(sim * 100)}%
        </Badge>
      )}
      {mesmaConta && (
        <Badge variant="muted">
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

  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroValorMin, setFiltroValorMin] = useState("");
  const [filtroValorMax, setFiltroValorMax] = useState("");
  const [filtroDataDe, setFiltroDataDe] = useState("");
  const [filtroDataAte, setFiltroDataAte] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [editando, setEditando] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!info) {
      setFiltroTexto("");
      setFiltroValorMin("");
      setFiltroValorMax("");
      setFiltroDataDe("");
      setFiltroDataAte("");
      setFiltroStatus("todos");
      setEditando(null);
    }
  }, [info]);

  if (!info) return null;

  const elegiveis = (lancamentos ?? []).filter(
    (l) =>
      l.natureza === info.natureza &&
      l.status !== "conciliado" &&
      l.status !== "cancelado"
  );

  const temFiltro =
    !!filtroTexto || !!filtroValorMin || !!filtroValorMax ||
    !!filtroDataDe || !!filtroDataAte || filtroStatus !== "todos";

  const filtrados = elegiveis.filter((l) => {
    if (filtroTexto && !l.descricao?.toLowerCase().includes(filtroTexto.toLowerCase())) return false;
    const v = Number(l.valor);
    if (filtroValorMin !== "" && !isNaN(Number(filtroValorMin)) && v < Number(filtroValorMin)) return false;
    if (filtroValorMax !== "" && !isNaN(Number(filtroValorMax)) && v > Number(filtroValorMax)) return false;
    const dataRef = l.data_vencimento ?? l.data_competencia ?? "";
    if (filtroDataDe && dataRef < filtroDataDe) return false;
    if (filtroDataAte && dataRef > filtroDataAte) return false;
    if (filtroStatus !== "todos" && l.status !== filtroStatus) return false;
    return true;
  });

  const sugeridos = filtrados.filter(
    (l) => info.valor > 0 && Math.abs(Number(l.valor) - info.valor) / info.valor < 0.02
  );
  const outros = filtrados.filter((l) => !sugeridos.includes(l));

  const limparFiltros = () => {
    setFiltroTexto(""); setFiltroValorMin(""); setFiltroValorMax("");
    setFiltroDataDe(""); setFiltroDataAte(""); setFiltroStatus("todos");
  };

  const renderItem = (l: (typeof elegiveis)[number], destaque = false) => (
    <div key={l.id} className="flex items-stretch gap-2 mb-2">
      <button
        onClick={() => onConfirm(l.id)}
        className="flex-1 min-w-0 rounded-md border border-border bg-card p-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <div className="flex items-center justify-between gap-2">
          <span className={`text-sm ${destaque ? "font-semibold" : ""} truncate`}>{l.descricao}</span>
          <span className="text-sm whitespace-nowrap tabular-nums shrink-0">{formatBRL(Number(l.valor))}</span>
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
          <span>{statusLabel[l.status] ?? l.status}</span>
          <span>·</span>
          <span>
            {l.data_vencimento
              ? `Venc.: ${formatDate(l.data_vencimento)}`
              : `Comp.: ${formatDate(l.data_competencia)}`}
          </span>
        </div>
      </button>
      <Button
        variant="outline"
        size="icon"
        onClick={() => setEditando(l as Record<string, unknown>)}
        className="h-auto shrink-0 text-muted-foreground"
        aria-label={`Editar lançamento ${l.descricao ?? ""}`}
        title="Editar lançamento"
      >
        <Pencil />
      </Button>
    </div>
  );

  return (
    <>
      <Dialog open={!!info} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Vincular a um lançamento</DialogTitle>
          </DialogHeader>

          {/* ── Filtros ── */}
          <div className="space-y-3 rounded-md border border-border bg-muted p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Filter className="w-4 h-4" />
              Filtros
              {temFiltro && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto text-muted-foreground"
                  onClick={limparFiltros}
                >
                  Limpar filtros
                </Button>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="vincular-busca">Buscar por descrição</Label>
              <Input
                id="vincular-busca"
                placeholder="Buscar por descrição..."
                value={filtroTexto}
                onChange={(e) => setFiltroTexto(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Input
                type="number"
                placeholder="Valor mínimo"
                aria-label="Valor mínimo"
                value={filtroValorMin}
                onChange={(e) => setFiltroValorMin(e.target.value)}
                className="flex-1 min-w-[100px] tabular-nums"
              />
              <Input
                type="number"
                placeholder="Valor máximo"
                aria-label="Valor máximo"
                value={filtroValorMax}
                onChange={(e) => setFiltroValorMax(e.target.value)}
                className="flex-1 min-w-[100px] tabular-nums"
              />
              <div className="flex items-center gap-2 flex-1 min-w-[160px]">
                <Label htmlFor="vincular-data-de" className="whitespace-nowrap">De</Label>
                <Input
                  id="vincular-data-de"
                  type="date"
                  value={filtroDataDe}
                  onChange={(e) => setFiltroDataDe(e.target.value)}
                  className="flex-1"
                />
              </div>
              <div className="flex items-center gap-2 flex-1 min-w-[160px]">
                <Label htmlFor="vincular-data-ate" className="whitespace-nowrap">até</Label>
                <Input
                  id="vincular-data-ate"
                  type="date"
                  value={filtroDataAte}
                  onChange={(e) => setFiltroDataAte(e.target.value)}
                  className="flex-1"
                />
              </div>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="flex-1 min-w-[130px]" aria-label="Status do lançamento">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  <SelectItem value="previsto">Previsto</SelectItem>
                  <SelectItem value="realizado">Realizado</SelectItem>
                  <SelectItem value="em_atraso">Em atraso</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ── Lista ── */}
          <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
            {sugeridos.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                  Sugestões (valor próximo)
                </h3>
                {sugeridos.map((l) => renderItem(l, true))}
              </div>
            )}
            {outros.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                  {sugeridos.length > 0 ? "Outros lançamentos" : `Lançamentos ${info.natureza === "receita" ? "a receber" : "a pagar"}`}
                  {" "}({outros.length})
                </h3>
                {outros.map((l) => renderItem(l))}
              </div>
            )}
            {filtrados.length === 0 && (
              <EstadoVazio
                tamanho="compacto"
                icone={<Search />}
                titulo={temFiltro ? "Nenhum lançamento com esses filtros" : "Nenhum lançamento disponível para vincular"}
                descricao={
                  temFiltro ? (
                    "Limpe os filtros ou amplie a faixa de valor e data para ver outros lançamentos"
                  ) : (
                    <>
                      Crie primeiro um lançamento em <strong>Lançamentos → Novo lançamento</strong>{" "}
                      ({info.natureza === "receita" ? "a receber" : "a pagar"}) com valor de{" "}
                      <strong>{formatBRL(info.valor)}</strong> e tente vincular novamente.
                    </>
                  )
                }
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de edição do lançamento selecionado */}
      {editando && (
        <LancamentoDialog
          open={!!editando}
          onOpenChange={(v) => !v && setEditando(null)}
          initial={editando as never}
          onSaved={() => setEditando(null)}
        />
      )}
    </>
  );
}
