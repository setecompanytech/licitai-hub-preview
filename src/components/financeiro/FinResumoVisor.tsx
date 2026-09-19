import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  RefreshCw, Wallet, ArrowDownCircle, ArrowUpCircle, AlertTriangle, TrendingUp, Clock, Activity,
  Plus, ArrowLeftRight, FileSpreadsheet, CheckCircle2, Layers, Banknote, Landmark, PiggyBank, CreditCard,
} from "lucide-react";
import { ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ReferenceLine } from "recharts";
import { useResumoVisorFinanceiro } from "@/hooks/useFinanceiro";
import { formatBRL } from "@/lib/financeiro/formatters";
import EstadoVazio from "@/components/shared/EstadoVazio";
import ValorDeCartao from "./ValorDeCartao";
import { useQueryClient } from "@tanstack/react-query";

function navegarFinanceiro(view: string) {
  window.dispatchEvent(new CustomEvent("fin:navigate", { detail: view }));
}

const AUTO_OPEN_KEY = "fin_resumo_auto_open";

const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function formatDataCurta(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function getResumoAutoOpen(): boolean {
  try { return localStorage.getItem(AUTO_OPEN_KEY) === "1"; } catch { return false; }
}

export default function FinResumoVisor() {
  const { data, isLoading, isFetching, refetch } = useResumoVisorFinanceiro();
  const qc = useQueryClient();
  const [autoOpen, setAutoOpen] = useState(getResumoAutoOpen());

  useEffect(() => {
    try { localStorage.setItem(AUTO_OPEN_KEY, autoOpen ? "1" : "0"); } catch { /* noop */ }
  }, [autoOpen]);

  const hoje = new Date();
  const dataExtenso = {
    dia: String(hoje.getDate()).padStart(2, "0"),
    mes: MESES[hoje.getMonth()],
    semana: DIAS_SEMANA[hoje.getDay()],
    ano: hoje.getFullYear(),
  };

  if (isLoading || !data) {
    return (
      <div className="space-y-4" role="status" aria-label="Carregando resumo">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Skeleton className="h-48 lg:col-span-1" />
          <Skeleton className="h-48 lg:col-span-2" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  const chartData = data.proximos10Dias.map((d) => ({
    label: formatDataCurta(d.data),
    pagar: d.previstoPagar,
    receber: d.previstoReceber,
    saldo: d.saldoProjetado,
  }));

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            onClick={() => { qc.invalidateQueries({ queryKey: ["fin-resumo-visor"] }); refetch(); }}
            disabled={isFetching}
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} aria-hidden="true" />
            Atualizar
          </Button>
          <span className="text-sm text-muted-foreground">Atualização automática a cada 60s</span>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="auto-open" checked={autoOpen} onCheckedChange={setAutoOpen} />
          <Label htmlFor="auto-open" className="cursor-pointer">
            Exibir Resumo automaticamente ao abrir Financeiro
          </Label>
        </div>
      </div>

      {/* Atalhos rápidos — o ícone dentro do botão já tem 16px pelo primitivo. */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-2 text-sm font-medium text-muted-foreground">Ações rápidas</span>
            <Button variant="default" onClick={() => navegarFinanceiro("a_pagar")}>
              <Plus aria-hidden="true" /> Conta a Pagar
            </Button>
            <Button variant="default" onClick={() => navegarFinanceiro("a_receber")}>
              <Plus aria-hidden="true" /> Conta a Receber
            </Button>
            <Button variant="outline" onClick={() => navegarFinanceiro("transferencia")}>
              <ArrowLeftRight aria-hidden="true" /> Transferência
            </Button>
            <Button variant="outline" onClick={() => navegarFinanceiro("conciliacao")}>
              <CheckCircle2 aria-hidden="true" /> Conciliação
            </Button>
            <Button variant="outline" onClick={() => navegarFinanceiro("baixa_lote")}>
              <Layers aria-hidden="true" /> Baixa em Lote
            </Button>
            <Button variant="outline" onClick={() => navegarFinanceiro("importar_ofx")}>
              <FileSpreadsheet aria-hidden="true" /> Importar OFX
            </Button>
            <Button variant="ghost" onClick={() => navegarFinanceiro("contas")}>
              <Wallet aria-hidden="true" /> Gerenciar Contas
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Hero + gráfico */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Hero — data de hoje e saldo, em cartão claro. O dia é o número
            grande (28/600), o saldo é o KPI do cartão. */}
        <Card className="lg:col-span-1">
          <CardContent className="flex h-full flex-col justify-between p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-4xl font-semibold leading-none tabular-nums text-foreground">{dataExtenso.dia}</p>
                <p className="mt-1 text-lg font-semibold capitalize leading-6 text-foreground">{dataExtenso.mes}</p>
                <p className="text-sm capitalize text-muted-foreground">{dataExtenso.semana}-feira</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-muted-foreground">Hoje</p>
                <p className="text-sm tabular-nums text-muted-foreground">{dataExtenso.ano}</p>
              </div>
            </div>
            <div className="mt-6 min-w-0">
              <p className="flex items-center gap-2 text-sm font-medium leading-5 text-muted-foreground">
                <Wallet className="h-4 w-4" aria-hidden="true" />
                Saldo em contas
              </p>
              <ValorDeCartao valor={formatBRL(data.saldoTotal)} className="text-foreground" />
            </div>
          </CardContent>
        </Card>

        {/* Gráfico 10 dias */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              Resumo para os próximos 10 dias
            </CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                <Tooltip
                  formatter={(value: number) => formatBRL(value)}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 10, fontSize: 13, color: "hsl(var(--foreground))" }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="3 3" />
                <Bar dataKey="pagar" name="Previsto a Pagar" fill="hsl(var(--destructive))" opacity={0.7} radius={[4, 4, 0, 0]} />
                <Bar dataKey="receber" name="Previsto a Receber" fill="hsl(var(--primary))" opacity={0.7} radius={[4, 4, 0, 0]} />
                <Line dataKey="saldo" name="Saldo Projetado" stroke="hsl(var(--foreground))" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Cards de hoje */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <CardHoje
          tipo="pagar"
          qtd={data.hojePagar.qtd}
          total={data.hojePagar.total}
          atraso={data.hojePagar.atraso}
        />
        <CardHoje
          tipo="receber"
          qtd={data.hojeReceber.qtd}
          total={data.hojeReceber.total}
          atraso={data.hojeReceber.atraso}
        />
      </div>

      {/* Saldos por conta */}
      <SaldosPorConta contas={data.contasSaldo} saldoTotal={data.saldoTotal} />

      {/* Indicadores extras */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <IndicadorCard
          icon={Activity}
          label="Inadimplência do mês"
          value={`${data.inadimplenciaMesPct.toFixed(1)}%`}
          tone={data.inadimplenciaMesPct > 10 ? "danger" : data.inadimplenciaMesPct > 5 ? "warning" : "success"}
        />
        <IndicadorCard
          icon={Clock}
          label="Runway de caixa"
          value={data.runwayDias !== null ? `${data.runwayDias} dias` : "—"}
          hint={data.runwayDias !== null ? "com despesa média 30d" : "sem despesas registradas"}
          tone={data.runwayDias === null ? "default" : data.runwayDias < 30 ? "danger" : data.runwayDias < 90 ? "warning" : "success"}
        />
        <IndicadorCard
          icon={AlertTriangle}
          label="Total em atraso"
          value={formatBRL(data.hojePagar.atraso + data.hojeReceber.atraso)}
          hint={`${data.topAtrasosPagar.length + data.topAtrasosReceber.length} contas`}
          tone={(data.hojePagar.atraso + data.hojeReceber.atraso) > 0 ? "warning" : "success"}
        />
      </div>

      {/* Top atrasos */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TopAtrasosCard titulo="Contas a Pagar — Maiores Atrasos" itens={data.topAtrasosPagar} tipo="pagar" />
        <TopAtrasosCard titulo="Contas a Receber — Maiores Atrasos" itens={data.topAtrasosReceber} tipo="receber" />
      </div>
    </div>
  );
}

/**
 * Cartão KPI do Design System v3 (112px): rótulo em cima, ícone num ladrilho
 * de 32px tingido à direita, valor pelo `ValorDeCartao` (28/600, que encolhe
 * em vez de quebrar) e linha de contexto 12px. Texto colorido só na tinta
 * `*-ink`, nunca na cor cheia sobre branco.
 */
function CardHoje({ tipo, qtd, total, atraso }: { tipo: "pagar" | "receber"; qtd: number; total: number; atraso: number }) {
  const isPagar = tipo === "pagar";
  const Icon = isPagar ? ArrowUpCircle : ArrowDownCircle;
  const cor = isPagar ? "text-destructive-ink" : "text-success-ink";
  const caixa = isPagar ? "bg-destructive-tint text-destructive-ink" : "bg-success-tint text-success-ink";

  return (
    <Card className="flex min-h-[112px] flex-col justify-between gap-2 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-medium leading-5 text-muted-foreground">
          {isPagar ? "Pagar Hoje" : "Receber Hoje"}
        </p>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${caixa}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <div className="min-w-0">
        <ValorDeCartao valor={formatBRL(total)} className={`mt-0 ${cor}`} />
        <p className="mt-0.5 flex items-baseline gap-1 text-xs leading-4 text-muted-foreground">
          <span className="font-semibold tabular-nums text-foreground">{qtd}</span>
          <span>contas</span>
        </p>
        {atraso > 0 && (
          <p className="text-xs leading-4 text-muted-foreground">
            Em atraso: <span className="font-medium tabular-nums">{formatBRL(atraso)}</span>
          </p>
        )}
      </div>
    </Card>
  );
}

function IndicadorCard({ icon: Icon, label, value, hint, tone }: { icon: React.ElementType; label: string; value: string; hint?: string; tone: "default" | "success" | "warning" | "danger" }) {
  const cor = {
    default: "text-foreground",
    success: "text-success-ink",
    warning: "text-warning-ink",
    danger: "text-destructive-ink",
  }[tone];
  const caixa = {
    default: "bg-muted text-muted-foreground",
    success: "bg-success-tint text-success-ink",
    warning: "bg-warning-tint text-warning-ink",
    danger: "bg-destructive-tint text-destructive-ink",
  }[tone];
  return (
    <Card className="flex min-h-[112px] flex-col justify-between gap-2 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-medium leading-5 text-muted-foreground">{label}</p>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${caixa}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <div className="min-w-0">
        <ValorDeCartao valor={value} className={`mt-0 ${cor}`} />
        {hint && <p className="mt-0.5 text-xs leading-4 text-muted-foreground">{hint}</p>}
      </div>
    </Card>
  );
}

function TopAtrasosCard({ titulo, itens, tipo }: { titulo: string; itens: Array<{ id: string; descricao: string; pessoa: string; diasAtraso: number; valor: number; vencimento: string }>; tipo: "pagar" | "receber" }) {
  const cor = tipo === "pagar" ? "text-destructive-ink" : "text-success-ink";
  const bg = tipo === "pagar" ? "bg-destructive-tint text-destructive-ink" : "bg-success-tint text-success-ink";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>{titulo}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {itens.length === 0 ? (
          <EstadoVazio
            tamanho="compacto"
            icone={<CheckCircle2 />}
            titulo="Nenhuma conta em atraso"
            descricao={tipo === "pagar" ? "Tudo em dia com os fornecedores." : "Tudo em dia com os clientes."}
          />
        ) : (
          <ul className="divide-y divide-border">
            {itens.map((it) => {
              const iniciais = (it.pessoa || "—").split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "—";
              return (
                <li key={it.id} className="flex items-center gap-3 px-5 py-3 transition-colors duration-150 hover:bg-muted/60">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-xs font-semibold ${bg}`} aria-hidden="true">
                    {iniciais}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">{it.pessoa}</div>
                    <div className="truncate text-xs text-muted-foreground">{it.descricao}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                      Venc. {formatDataCurta(it.vencimento)} · <Badge variant="danger">{it.diasAtraso}d em atraso</Badge>
                    </div>
                  </div>
                  <div className={`whitespace-nowrap text-right text-sm font-semibold tabular-nums ${cor}`}>
                    {formatBRL(it.valor)}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function iconeContaTipo(tipo: string | null) {
  switch ((tipo ?? "").toLowerCase()) {
    case "corrente": return Landmark;
    case "poupanca":
    case "poupança": return PiggyBank;
    case "cartao":
    case "cartão":
    case "cartao_credito": return CreditCard;
    case "caixa":
    case "dinheiro": return Banknote;
    default: return Wallet;
  }
}

function SaldosPorConta({ contas, saldoTotal }: { contas: Array<{ id: string; nome: string; tipo: string | null; banco: string | null; agencia: string | null; conta: string | null; cor: string | null; saldoAtual: number; ativa: boolean }>; saldoTotal: number }) {
  const ativas = contas.filter((c) => c.ativa);
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          Saldos por conta
          <Badge variant="muted" className="ml-1">{ativas.length} ativas</Badge>
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={() => navegarFinanceiro("contas")}>Gerenciar</Button>
      </CardHeader>
      <CardContent className="p-0">
        {ativas.length === 0 ? (
          <EstadoVazio
            tamanho="compacto"
            icone={<Wallet />}
            titulo="Nenhuma conta cadastrada"
            descricao="Sem conta corrente cadastrada não há saldo para consolidar."
            acao={
              <Button variant="outline" onClick={() => navegarFinanceiro("contas")}>
                Cadastrar conta
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {ativas.map((c) => {
              const Icon = iconeContaTipo(c.tipo);
              const negativo = c.saldoAtual < 0;
              const pct = saldoTotal > 0 ? (c.saldoAtual / saldoTotal) * 100 : 0;
              const subtitulo = [c.banco, c.agencia, c.conta].filter(Boolean).join(" · ");
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors duration-150 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                    onClick={() => navegarFinanceiro("contas")}
                    aria-label={`${c.nome}: ${formatBRL(c.saldoAtual)}. Abrir contas correntes`}
                  >
                    {/* A cor vem do cadastro da conta (escolha do usuário) —
                        exceção de dado, não cor de interface. */}
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${c.cor ? "" : "bg-muted text-muted-foreground"}`}
                      style={c.cor ? { backgroundColor: `${c.cor}22`, color: c.cor } : undefined}
                      aria-hidden="true"
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">{c.nome}</div>
                      {subtitulo && <div className="truncate text-xs text-muted-foreground">{subtitulo}</div>}
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className={negativo ? "h-full bg-destructive" : "h-full bg-primary"}
                          style={{ width: `${Math.min(100, Math.abs(pct))}%` }}
                        />
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className={`text-sm font-semibold tabular-nums ${negativo ? "text-destructive-ink" : "text-foreground"}`}>
                        {formatBRL(c.saldoAtual)}
                      </div>
                      {saldoTotal > 0 && !negativo && (
                        <div className="text-xs tabular-nums text-muted-foreground">{pct.toFixed(1)}%</div>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
            {/* Linha de total na superfície rebaixada, como o rodapé de tabela. */}
            <li className="flex items-center justify-between bg-secondary px-5 py-3 font-semibold">
              <span className="text-sm text-foreground">Saldo consolidado</span>
              <span className={`text-right text-sm tabular-nums ${saldoTotal < 0 ? "text-destructive-ink" : "text-foreground"}`}>
                {formatBRL(saldoTotal)}
              </span>
            </li>
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
