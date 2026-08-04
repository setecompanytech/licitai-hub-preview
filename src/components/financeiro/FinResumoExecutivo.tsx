/**
 * FinResumoExecutivo — Resumo Executivo de Finanças (modelo Omie 11.9).
 *
 * Documento imprimível (one-pager institucional) que consolida:
 *   1) Posição financeira (saldo, a receber, a pagar, posição líquida)
 *   2) Resultado do mês corrente
 *   3) Indicadores de saúde (inadimplência, margem)
 *   4) Detalhamento de Contas a Pagar (todas atrasadas/a vencer)
 *   5) Detalhamento de Contas a Receber (todas atrasadas/a vencer)
 *   6) Saldos de Contas Correntes ativas
 *
 * Estrutura inspirada no anexo "11.9 RESUMO EXECUTIVO DE FINANÇAS" do INTERFACE
 * FINANCEIRO 2 — destinado à diretoria, com botão Imprimir / Salvar PDF.
 */
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Printer, Sparkles, Loader2 } from "lucide-react";
import { useEmpresaId } from "@/hooks/useFinanceiro";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatBRL, formatDocumento } from "@/lib/financeiro/formatters";

type LancDetalhe = {
  id: string;
  descricao: string;
  pessoa: string;
  data_vencimento: string;
  valor: number;
  status: string;
  diasAtraso: number;
};

type ContaSaldo = {
  id: string;
  nome: string;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  tipo: string | null;
  saldo_atual: number;
  limite: number;
};

export default function FinResumoExecutivo() {
  const empresaId = useEmpresaId();
  const { empresaAtiva } = useEmpresa();

  const { data, isLoading } = useQuery({
    queryKey: ["resumo-executivo-completo", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const hoje = new Date();
      const ano = hoje.getFullYear();
      const mes = hoje.getMonth() + 1;
      const inicioMes = `${ano}-${String(mes).padStart(2, "0")}-01`;

      const [contasRes, lancsRes, pessoasRes] = await Promise.all([
        supabase
          .from("financeiro_contas")
          .select("id, nome, banco, agencia, conta, tipo, saldo_atual, limite")
          .eq("empresa_id", empresaId!)
          .eq("ativa", true)
          .order("nome"),
        supabase
          .from("financeiro_lancamentos")
          .select("id, tipo, status, valor, descricao, pessoa_id, data_competencia, data_vencimento")
          .eq("empresa_id", empresaId!)
          .gte("data_competencia", `${ano}-01-01`),
        supabase
          .from("financeiro_pessoas")
          .select("id, nome, documento")
          .eq("empresa_id", empresaId!),
      ]);

      const contas = (contasRes.data ?? []) as any as ContaSaldo[];
      const lancs = lancsRes.data ?? [];
      const pessoaMap = new Map<string, { nome: string; documento: string | null }>();
      (pessoasRes.data ?? []).forEach((p: any) => pessoaMap.set(p.id, { nome: p.nome, documento: p.documento }));

      const noMes = lancs.filter((l) => (l.data_competencia ?? "") >= inicioMes);
      const realizado = (l: any) => ["realizado", "conciliado", "pago"].includes(l.status);
      const aberto = (l: any) => ["previsto", "em_atraso", "pendente"].includes(l.status);

      const saldoTotal = contas.reduce((s, c) => s + Number(c.saldo_atual ?? 0), 0);
      const limiteTotal = contas.reduce((s, c) => s + Number(c.limite ?? 0), 0);

      const receitaMes = noMes.filter((l) => l.tipo === "a_receber" && realizado(l)).reduce((s, l) => s + Number(l.valor), 0);
      const despesaMes = noMes.filter((l) => l.tipo === "a_pagar" && realizado(l)).reduce((s, l) => s + Number(l.valor), 0);

      const buildDetalhe = (filtro: (l: any) => boolean): LancDetalhe[] =>
        lancs
          .filter(filtro)
          .map((l: any): LancDetalhe => {
            const venc = l.data_vencimento ?? l.data_competencia;
            const dias = venc
              ? Math.floor((hoje.getTime() - new Date(venc + "T00:00:00").getTime()) / 86_400_000)
              : 0;
            return {
              id: l.id,
              descricao: l.descricao ?? "—",
              pessoa: l.pessoa_id ? (pessoaMap.get(l.pessoa_id)?.nome ?? "—") : "—",
              data_vencimento: venc ?? "",
              valor: Number(l.valor),
              status: l.status,
              diasAtraso: Math.max(dias, 0),
            };
          })
          .sort((a, b) => (a.data_vencimento < b.data_vencimento ? -1 : 1));

      const detalheCP = buildDetalhe((l) => l.tipo === "a_pagar" && aberto(l));
      const detalheCR = buildDetalhe((l) => l.tipo === "a_receber" && aberto(l));

      const totalCP = detalheCP.reduce((s, l) => s + l.valor, 0);
      const totalCR = detalheCR.reduce((s, l) => s + l.valor, 0);
      const inadimplencia = detalheCR.filter((l) => l.status === "em_atraso").reduce((s, l) => s + l.valor, 0);

      return {
        contas, saldoTotal, limiteTotal,
        receitaMes, despesaMes, resultadoMes: receitaMes - despesaMes,
        detalheCP, detalheCR, totalCP, totalCR, inadimplencia,
      };
    },
  });

  if (isLoading || !data) {
    return <div className="h-64 grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end print:hidden">
        <Button onClick={() => window.print()} variant="outline" size="sm">
          <Printer className="w-4 h-4 mr-1.5" /> Imprimir / Salvar PDF
        </Button>
      </div>

      <div className="bg-background border rounded-lg p-8 print:border-0 print:p-0 print:shadow-none space-y-6 max-w-5xl mx-auto">
        {/* Cabeçalho */}
        <header className="border-b pb-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Resumo Executivo de Finanças</h1>
              <p className="text-sm font-medium mt-1">{empresaAtiva?.razao_social}</p>
              {empresaAtiva?.cnpj && (
                <p className="text-xs text-muted-foreground">CNPJ: {formatDocumento(empresaAtiva.cnpj)}</p>
              )}
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p>Posição em</p>
              <p className="font-medium">{format(new Date(), "dd/MM/yyyy", { locale: ptBR })}</p>
              <p className="text-xs">{format(new Date(), "HH:mm:ss")}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Veja abaixo o resumo das contas a pagar, contas a receber e contas correntes da sua empresa.
          </p>
        </header>

        {/* 1. Posição financeira */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Posição financeira atual</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiBox label="Saldo em contas" value={data.saldoTotal} />
            <KpiBox label="A receber" value={data.totalCR} tone="success" />
            <KpiBox label="A pagar" value={data.totalCP} tone="danger" />
            <KpiBox label="Posição líquida" value={data.saldoTotal + data.totalCR - data.totalCP} />
          </div>
        </section>

        {/* 2. Resultado do mês */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Resultado do mês corrente</h2>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b"><td className="py-2">(+) Receitas realizadas</td><td className="text-right tabular-nums text-emerald-600 dark:text-emerald-400">{formatBRL(data.receitaMes)}</td></tr>
              <tr className="border-b"><td className="py-2">(−) Despesas realizadas</td><td className="text-right tabular-nums text-rose-600 dark:text-rose-400">({formatBRL(data.despesaMes)})</td></tr>
              <tr className="border-b-2 border-foreground font-semibold"><td className="py-2">(=) Resultado líquido do mês</td><td className={`text-right tabular-nums ${data.resultadoMes >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>{formatBRL(data.resultadoMes)}</td></tr>
            </tbody>
          </table>
        </section>

        {/* 3. Detalhe Contas a Pagar */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">Resumo das Contas a Pagar</h2>
          <p className="text-xs text-muted-foreground mb-2">Todas as contas a pagar atrasadas ou a vencer na data atual</p>
          <TabelaLancamentos lancs={data.detalheCP} tipo="pagar" total={data.totalCP} />
        </section>

        {/* 4. Detalhe Contas a Receber */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">Resumo das Contas a Receber</h2>
          <p className="text-xs text-muted-foreground mb-2">Todas as contas a receber atrasadas ou a vencer na data atual</p>
          <TabelaLancamentos lancs={data.detalheCR} tipo="receber" total={data.totalCR} />
        </section>

        {/* 5. Contas Correntes */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">Resumo das Contas Correntes</h2>
          <p className="text-xs text-muted-foreground mb-2">Saldo atual das contas correntes (consideradas no Resumo Financeiro)</p>
          <table className="w-full text-xs border">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-2 py-1.5 text-left">Tipo de Conta</th>
                <th className="px-2 py-1.5 text-left">Conta Corrente</th>
                <th className="px-2 py-1.5 text-right">Valor do Limite</th>
                <th className="px-2 py-1.5 text-right">Saldo Atual</th>
                <th className="px-2 py-1.5 text-right">Saldo Disponível</th>
              </tr>
            </thead>
            <tbody>
              {data.contas.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-4 text-muted-foreground">Nenhuma conta corrente ativa.</td></tr>
              ) : data.contas.map((c) => {
                const negativo = Number(c.saldo_atual) < 0;
                return (
                  <tr key={c.id} className="border-t">
                    <td className="px-2 py-1.5">{c.tipo ?? "Conta Corrente"}</td>
                    <td className="px-2 py-1.5">
                      <div className="font-medium">{c.nome}</div>
                      {(c.banco || c.agencia || c.conta) && (
                        <div className="text-xs text-muted-foreground">
                          {[c.banco, c.agencia ? `Ag: ${c.agencia}` : null, c.conta ? `Conta: ${c.conta}` : null].filter(Boolean).join(" · ")}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{formatBRL(Number(c.limite ?? 0))}</td>
                    <td className={`px-2 py-1.5 text-right tabular-nums ${negativo ? "text-rose-600 dark:text-rose-400" : "text-blue-600 dark:text-blue-400"}`}>
                      {formatBRL(Number(c.saldo_atual ?? 0))}
                    </td>
                    <td className={`px-2 py-1.5 text-right tabular-nums ${negativo ? "text-rose-600 dark:text-rose-400" : "text-blue-600 dark:text-blue-400"}`}>
                      {formatBRL(Number(c.saldo_atual ?? 0) + Number(c.limite ?? 0))}
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-foreground font-semibold bg-muted/30">
                <td colSpan={2} className="px-2 py-1.5">Total ({data.contas.length})</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatBRL(data.limiteTotal)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatBRL(data.saldoTotal)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatBRL(data.saldoTotal + data.limiteTotal)}</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* 6. Indicadores */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Indicadores de saúde</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">Inadimplência (em atraso)</p>
                <p className="text-lg font-semibold tabular-nums">{formatBRL(data.inadimplencia)}</p>
                <p className="text-xs text-muted-foreground">
                  {data.totalCR > 0 ? ((data.inadimplencia / data.totalCR) * 100).toFixed(1) : 0}% do total a receber
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">Margem do mês</p>
                <p className="text-lg font-semibold tabular-nums">
                  {data.receitaMes > 0 ? ((data.resultadoMes / data.receitaMes) * 100).toFixed(1) : 0}%
                </p>
                <p className="text-xs text-muted-foreground">Resultado / Receita realizada</p>
              </CardContent>
            </Card>
          </div>
        </section>

        <footer className="border-t pt-4 text-xs text-muted-foreground flex items-center gap-1.5">
          <Sparkles className="w-3 h-3" />
          Documento gerado automaticamente pelo PRAEFECTUS · Confidencial · Uso restrito à diretoria
        </footer>
      </div>
    </div>
  );
}

function KpiBox({ label, value, tone }: { label: string; value: number; tone?: "success" | "danger" }) {
  const cor = tone === "success" ? "text-emerald-600 dark:text-emerald-400"
    : tone === "danger" ? "text-rose-600 dark:text-rose-400"
    : "text-foreground";
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${cor}`}>{formatBRL(value)}</p>
    </div>
  );
}

function TabelaLancamentos({ lancs, tipo, total }: { lancs: LancDetalhe[]; tipo: "pagar" | "receber"; total: number }) {
  const labelPessoa = tipo === "pagar" ? "Fornecedor" : "Cliente";
  const labelData = tipo === "pagar" ? "Previsão de Pagamento" : "Previsão de Recebimento";
  const corValor = tipo === "pagar" ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400";

  if (lancs.length === 0) {
    return <p className="text-xs text-muted-foreground italic py-3">Nenhum lançamento em aberto.</p>;
  }

  return (
    <table className="w-full text-xs border">
      <thead className="bg-muted/40">
        <tr>
          <th className="px-2 py-1.5 text-left w-24">Situação</th>
          <th className="px-2 py-1.5 text-left">{labelPessoa}</th>
          <th className="px-2 py-1.5 text-left w-32">{labelData}</th>
          <th className="px-2 py-1.5 text-right w-32">Valor</th>
        </tr>
      </thead>
      <tbody>
        {lancs.slice(0, 30).map((l) => (
          <tr key={l.id} className="border-t">
            <td className="px-2 py-1.5">
              {l.status === "em_atraso" ? (
                <Badge variant="destructive" className="text-xs px-1.5 py-0 h-4">Atrasado</Badge>
              ) : (
                <Badge variant="outline" className="text-xs px-1.5 py-0 h-4">A vencer</Badge>
              )}
              {l.diasAtraso > 0 && <span className="ml-1 text-xs text-muted-foreground">{l.diasAtraso}d</span>}
            </td>
            <td className="px-2 py-1.5">
              <div className="font-medium truncate max-w-md">{l.pessoa}</div>
              {l.descricao && <div className="text-xs text-muted-foreground truncate max-w-md">{l.descricao}</div>}
            </td>
            <td className="px-2 py-1.5 tabular-nums">
              {l.data_vencimento ? format(new Date(l.data_vencimento + "T00:00:00"), "dd/MM/yyyy") : "—"}
            </td>
            <td className={`px-2 py-1.5 text-right tabular-nums font-medium ${corValor}`}>{formatBRL(l.valor)}</td>
          </tr>
        ))}
        {lancs.length > 30 && (
          <tr className="border-t bg-muted/20">
            <td colSpan={4} className="px-2 py-1.5 text-center text-xs text-muted-foreground italic">
              +{lancs.length - 30} lançamento(s) adicional(is) — exibindo os 30 com vencimento mais próximo
            </td>
          </tr>
        )}
        <tr className="border-t-2 border-foreground font-semibold bg-muted/30">
          <td colSpan={3} className="px-2 py-1.5">Total ({lancs.length})</td>
          <td className={`px-2 py-1.5 text-right tabular-nums ${corValor}`}>{formatBRL(total)}</td>
        </tr>
      </tbody>
    </table>
  );
}
