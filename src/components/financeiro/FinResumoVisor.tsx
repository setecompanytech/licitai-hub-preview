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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-48 lg:col-span-1" />
          <Skeleton className="h-48 lg:col-span-2" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} aria-hidden="true" />
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

      {/* Atalhos rápidos */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground mr-2">Ações rápidas</span>
            <Button variant="default" onClick={() => navegarFinanceiro("a_pagar")}>
              <Plus className="w-4 h-4" aria-hidden="true" /> Conta a Pagar
            </Button>
            <Button variant="default" onClick={() => navegarFinanceiro("a_receber")}>
              <Plus className="w-4 h-4" aria-hidden="true" /> Conta a Receber
            </Button>
            <Button variant="outline" onClick={() => navegarFinanceiro("transferencia")}>
              <ArrowLeftRight className="w-4 h-4" aria-hidden="true" /> Transferência
            </Button>
            <Button variant="outline" onClick={() => navegarFinanceiro("conciliacao")}>
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> Conciliação
            </Button>
            <Button variant="outline" onClick={() => navegarFinanceiro("baixa_lote")}>
              <Layers className="w-4 h-4" aria-hidden="true" /> Baixa em Lote
            </Button>
            <Button variant="outline" onClick={() => navegarFinanceiro("importar_ofx")}>
              <FileSpreadsheet className="w-4 h-4" aria-hidden="true" /> Importar OFX
            </Button>
            <Button variant="ghost" onClick={() => navegarFinanceiro("contas")}>
              <Wallet className="w-4 h-4" aria-hidden="true" /> Gerenciar Contas
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Hero + gráfico */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Hero — data de hoje e saldo, em cartão claro */}
        <Card className="lg:col-span-1">
          <CardContent className="p-6 h-full flex flex-col justify-between">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-4xl font-bold leading-none tabular-nums text-foreground">{dataExtenso.dia}</p>
                <p className="text-lg font-semibold mt-1 capitalize">{dataExtenso.mes}</p>
                <p className="text-sm text-muted-foreground capitalize">{dataExtenso.semana}-feira</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-muted-foreground">Hoje</p>
                <p className="text-sm text-muted-foreground tabular-nums">{dataExtenso.ano}</p>
              </div>
            </div>
            <div className="mt-6">
              <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Wallet className="w-4 h-4" aria-hidden="true" />
                Saldo em contas
              </p>
              <p className="mt-1 text-[2rem] leading-10 font-bold tabular-nums text-foreground">
                {formatBRL(data.saldoTotal)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Gráfico 10 dias */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
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
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 10, fontSize: 12 }}
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TopAtrasosCard titulo="Contas a Pagar — Maiores Atrasos" itens={data.topAtrasosPagar} tipo="pagar" />
        <TopAtrasosCard titulo="Contas a Receber — Maiores Atrasos" itens={data.topAtrasosReceber} tipo="receber" />
      </div>
    </div>
  );
}

function CardHoje({ tipo, qtd, total, atraso }: { tipo: "pagar" | "receber"; qtd: number; total: number; atraso: number }) {
  const isPagar = tipo === "pagar";
  const Icon = isPagar ? ArrowUpCircle : ArrowDownCircle;
  const cor = isPagar ? "text-destructive" : "text-success";
  const caixa = isPagar ? "bg-destructive-tint text-destructive-ink" : "bg-success-tint text-success-ink";

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">
              {isPagar ? "Pagar Hoje" : "Receber Hoje"}
            </p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className={`text-2xl font-semibold tabular-nums ${cor}`}>{qtd}</span>
              <span className="text-sm text-muted-foreground">contas</span>
            </div>
            <p className={`mt-1 text-[2rem] leading-10 font-bold tabular-nums truncate ${cor}`}>{formatBRL(total)}</p>
            {atraso > 0 && (
              <p className="text-sm text-muted-foreground mt-2">
                Em atraso: <span className="font-medium tabular-nums">{formatBRL(atraso)}</span>
              </p>
            )}
          </div>
          <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${caixa}`}>
            <Icon className="w-5 h-5" aria-hidden="true" />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function IndicadorCard({ icon: Icon, label, value, hint, tone }: { icon: React.ElementType; label: string; value: string; hint?: string; tone: "default" | "success" | "warning" | "danger" }) {
  const cor = {
    default: "text-foreground",
    success: "text-success",
    warning: "text-warning",
    danger: "text-destructive",
  }[tone];
  const caixa = {
    default: "bg-muted text-foreground",
    success: "bg-success-tint text-success-ink",
    warning: "bg-warning-tint text-warning-ink",
    danger: "bg-destructive-tint text-destructive-ink",
  }[tone];
  return (
    <Card>
      <CardContent className="p-6 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className={`mt-1 text-[2rem] leading-10 font-bold tabular-nums truncate ${cor}`}>{value}</p>
          {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
        </div>
        <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${caixa}`}>
          <Icon className="w-5 h-5" aria-hidden="true" />
        </span>
      </CardContent>
    </Card>
  );
}

function TopAtrasosCard({ titulo, itens, tipo }: { titulo: string; itens: Array<{ id: string; descricao: string; pessoa: string; diasAtraso: number; valor: number; vencimento: string }>; tipo: "pagar" | "receber" }) {
  const cor = tipo === "pagar" ? "text-destructive" : "text-success";
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
                <li key={it.id} className="flex items-center gap-3 px-6 py-3 hover:bg-muted/50 transition-colors">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${bg}`} aria-hidden="true">
                    {iniciais}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{it.pessoa}</div>
                    <div className="text-xs text-muted-foreground truncate">{it.descricao}</div>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-1">
                      Venc. {formatDataCurta(it.vencimento)} · <Badge variant="danger">{it.diasAtraso}d em atraso</Badge>
                    </div>
                  </div>
                  <div className={`text-sm font-semibold text-right tabular-nums whitespace-nowrap ${cor}`}>
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
      <CardHeader className="pb-2 flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
          Saldos por conta
          <Badge variant="muted" className="ml-1">{ativas.length} ativas</Badge>
        </CardTitle>
        <Button variant="ghost" onClick={() => navegarFinanceiro("contas")}>Gerenciar</Button>
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
                    className="w-full text-left flex items-center gap-3 px-6 py-3 hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                    onClick={() => navegarFinanceiro("contas")}
                    aria-label={`${c.nome}: ${formatBRL(c.saldoAtual)}. Abrir contas correntes`}
                  >
                    {/* A cor vem do cadastro da conta (escolha do usuário) —
                        exceção de dado, não cor de interface. */}
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${c.cor ? "" : "bg-muted text-foreground"}`}
                      style={c.cor ? { backgroundColor: `${c.cor}22`, color: c.cor } : undefined}
                      aria-hidden="true"
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{c.nome}</div>
                      {subtitulo && <div className="text-xs text-muted-foreground truncate">{subtitulo}</div>}
                      <div className="h-1 bg-muted rounded-full mt-2 overflow-hidden">
                        <div
                          className={negativo ? "h-full bg-destructive" : "h-full bg-primary"}
                          style={{ width: `${Math.min(100, Math.abs(pct))}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-sm font-semibold tabular-nums ${negativo ? "text-destructive" : "text-foreground"}`}>
                        {formatBRL(c.saldoAtual)}
                      </div>
                      {saldoTotal > 0 && !negativo && (
                        <div className="text-xs text-muted-foreground tabular-nums">{pct.toFixed(1)}%</div>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
            <li className="flex items-center justify-between px-6 py-3 bg-muted font-medium">
              <span className="text-sm">Saldo consolidado</span>
              <span className={`text-sm text-right tabular-nums ${saldoTotal < 0 ? "text-destructive" : "text-foreground"}`}>
                {formatBRL(saldoTotal)}
              </span>
            </li>
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
