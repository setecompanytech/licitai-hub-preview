/**
 * FinResumoExecutivo — Resumo Executivo de Finanças.
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
import { Table } from '@/components/ui/table';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowDownCircle, ArrowUpCircle, CheckCircle2, Landmark, Percent, Printer, Scale, Sparkles, Wallet } from "lucide-react";
import EstadoVazio from "@/components/shared/EstadoVazio";
import ValorDeCartao from "./ValorDeCartao";
import { useEmpresaId } from "@/hooks/useFinanceiro";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatBRL, formatDocumento } from "@/lib/financeiro/formatters";
import { buscarTodos } from "@/lib/financeiro/paginar";
import { diasDeAtraso, estaEmAtraso } from "@/lib/financeiro/atraso";

type LancDetalhe = {
  id: string;
  descricao: string;
  pessoa: string;
  data_vencimento: string;
  valor: number;
  status: string;
  /** Pela régua única de `atraso.ts` — o status `em_atraso` nunca é gravado. */
  emAtraso: boolean;
  semVencimento: boolean;
  diasAtraso: number;
};

type LinhaDoAno = {
  id: string; tipo: string; status: string; valor: number; descricao: string | null;
  pessoa_id: string | null; data_competencia: string; data_vencimento: string | null;
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

// Anatomia de tabela do Design System v3: cabeçalho em `secondary`, rótulo
// 12/600 sem caixa alta, linhas de 48px, corpo 13px.
const TH = "h-11 px-4 text-xs font-semibold tracking-wide text-muted-foreground";
const TD = "h-12 px-4 py-2.5 align-middle text-sm text-foreground";
const TOTAL = "border-t border-border bg-secondary font-semibold";
const SECAO = "mb-3 text-lg font-semibold leading-6 text-foreground";

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

      const [contasRes, lancs, pessoasRes] = await Promise.all([
        supabase
          .from("financeiro_contas")
          .select("id, nome, banco, agencia, conta, tipo, saldo_atual, limite")
          .eq("empresa_id", empresaId!)
          .eq("ativa", true)
          .order("nome"),
        // O ano inteiro, página a página: sem `.range` o PostgREST devolve no
        // máximo 1000 linhas e o resumo para a diretoria somava uma amostra.
        buscarTodos<LinhaDoAno>((de, ate) =>
          supabase
            .from("financeiro_lancamentos")
            .select("id, tipo, status, valor, descricao, pessoa_id, data_competencia, data_vencimento")
            .eq("empresa_id", empresaId!)
            .gte("data_competencia", `${ano}-01-01`)
            .order("data_competencia")
            .order("id")
            .range(de, ate)),
        supabase
          .from("financeiro_pessoas")
          .select("id, nome, documento")
          .eq("empresa_id", empresaId!),
      ]);

      const contas = (contasRes.data ?? []) as any as ContaSaldo[];
      const pessoaMap = new Map<string, { nome: string; documento: string | null }>();
      (pessoasRes.data ?? []).forEach((p: any) => pessoaMap.set(p.id, { nome: p.nome, documento: p.documento }));

      const noMes = lancs.filter((l) => (l.data_competencia ?? "") >= inicioMes);
      const realizado = (l: any) => ["realizado", "conciliado", "pago"].includes(l.status);
      const aberto = (l: any) => ["previsto", "em_atraso", "pendente"].includes(l.status);

      const saldoTotal = contas.reduce((s, c) => s + Number(c.saldo_atual ?? 0), 0);
      const limiteTotal = contas.reduce((s, c) => s + Number(c.limite ?? 0), 0);

      const receitaMes = noMes.filter((l) => l.tipo === "a_receber" && realizado(l)).reduce((s, l) => s + Number(l.valor), 0);
      const despesaMes = noMes.filter((l) => l.tipo === "a_pagar" && realizado(l)).reduce((s, l) => s + Number(l.valor), 0);

      // A competência não entra no lugar do vencimento: a coluna "Previsão de
      // pagamento" mostrava a competência como se fosse prazo, e o atraso saía
      // de `status === 'em_atraso'`, que nunca é gravado — inadimplência zero
      // para uma carteira com meses de atraso (21/09).
      const buildDetalhe = (filtro: (l: LinhaDoAno) => boolean): LancDetalhe[] =>
        lancs
          .filter(filtro)
          .map((l): LancDetalhe => ({
            id: l.id,
            descricao: l.descricao ?? "—",
            pessoa: l.pessoa_id ? (pessoaMap.get(l.pessoa_id)?.nome ?? "—") : "—",
            data_vencimento: l.data_vencimento ?? "",
            valor: Number(l.valor),
            status: l.status,
            emAtraso: estaEmAtraso(l),
            semVencimento: !l.data_vencimento,
            diasAtraso: diasDeAtraso(l),
          }))
          .sort((a, b) => (a.data_vencimento < b.data_vencimento ? -1 : 1));

      const detalheCP = buildDetalhe((l) => l.tipo === "a_pagar" && aberto(l));
      const detalheCR = buildDetalhe((l) => l.tipo === "a_receber" && aberto(l));

      const totalCP = detalheCP.reduce((s, l) => s + l.valor, 0);
      const totalCR = detalheCR.reduce((s, l) => s + l.valor, 0);
      const inadimplencia = detalheCR.filter((l) => l.emAtraso).reduce((s, l) => s + l.valor, 0);

      return {
        contas, saldoTotal, limiteTotal,
        receitaMes, despesaMes, resultadoMes: receitaMes - despesaMes,
        detalheCP, detalheCR, totalCP, totalCR, inadimplencia,
      };
    },
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-4 max-w-5xl mx-auto" role="status" aria-label="Carregando resumo executivo">
        <Skeleton className="h-11 w-56 ml-auto" />
        <Skeleton className="h-[32rem]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end print:hidden">
        <Button onClick={() => window.print()} variant="outline">
          <Printer aria-hidden="true" /> Imprimir / Salvar PDF
        </Button>
      </div>

      <div className="mx-auto max-w-5xl space-y-8 rounded-lg border border-border bg-card p-6 shadow-sm md:p-8 print:border-0 print:p-0 print:shadow-none">
        {/* Cabeçalho do documento — a página já tem o h1 do módulo, este é o
            título do documento impresso. */}
        <header className="border-b border-border pb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold leading-6 text-foreground">Resumo Executivo de Finanças</h2>
              <p className="mt-1 text-base font-medium text-foreground">{empresaAtiva?.razao_social}</p>
              {empresaAtiva?.cnpj && (
                <p className="text-sm text-muted-foreground">CNPJ: {formatDocumento(empresaAtiva.cnpj)}</p>
              )}
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <p>Posição em</p>
              <p className="font-medium tabular-nums text-foreground">{format(new Date(), "dd/MM/yyyy", { locale: ptBR })}</p>
              <p className="text-xs tabular-nums">{format(new Date(), "HH:mm:ss")}</p>
            </div>
          </div>
          <p className="mt-3 text-sm leading-5 text-muted-foreground">
            Veja abaixo o resumo das contas a pagar, contas a receber e contas correntes da sua empresa.
          </p>
        </header>

        {/* 1. Posição financeira — os quatro cartões KPI do Design System v3
            (112px): rótulo em cima, ícone num ladrilho tingido, valor 28/36. */}
        <section>
          <h3 className={SECAO}>Posição financeira atual</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiBox label="Saldo em contas" value={data.saldoTotal} icon={Wallet} />
            <KpiBox label="A receber" value={data.totalCR} tone="success" icon={ArrowDownCircle} />
            <KpiBox label="A pagar" value={data.totalCP} tone="danger" icon={ArrowUpCircle} />
            <KpiBox label="Posição líquida" value={data.saldoTotal + data.totalCR - data.totalCP} icon={Scale} />
          </div>
        </section>

        {/* 2. Resultado do mês */}
        <section>
          <h3 className={SECAO}>Resultado do mês corrente</h3>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-border"><td className={TD}>(+) Receitas realizadas</td><td className={`${TD} text-right tabular-nums text-success-ink`}>{formatBRL(data.receitaMes)}</td></tr>
                <tr className="border-b border-border"><td className={TD}>(−) Despesas realizadas</td><td className={`${TD} text-right tabular-nums text-destructive-ink`}>({formatBRL(data.despesaMes)})</td></tr>
                <tr className={TOTAL}><td className={TD}>(=) Resultado líquido do mês</td><td className={`${TD} text-right tabular-nums ${data.resultadoMes >= 0 ? "text-success-ink" : "text-destructive-ink"}`}>{formatBRL(data.resultadoMes)}</td></tr>
              </tbody>
            </Table>
          </div>
        </section>

        {/* 3. Detalhe Contas a Pagar */}
        <section>
          <h3 className="mb-1 text-lg font-semibold leading-6 text-foreground">Resumo das Contas a Pagar</h3>
          <p className="mb-3 text-sm leading-5 text-muted-foreground">Todas as contas a pagar atrasadas ou a vencer na data atual</p>
          <TabelaLancamentos lancs={data.detalheCP} tipo="pagar" total={data.totalCP} />
        </section>

        {/* 4. Detalhe Contas a Receber */}
        <section>
          <h3 className="mb-1 text-lg font-semibold leading-6 text-foreground">Resumo das Contas a Receber</h3>
          <p className="mb-3 text-sm leading-5 text-muted-foreground">Todas as contas a receber atrasadas ou a vencer na data atual</p>
          <TabelaLancamentos lancs={data.detalheCR} tipo="receber" total={data.totalCR} />
        </section>

        {/* 5. Contas Correntes */}
        <section>
          <h3 className="mb-1 text-lg font-semibold leading-6 text-foreground">Resumo das Contas Correntes</h3>
          <p className="mb-3 text-sm leading-5 text-muted-foreground">Saldo atual das contas correntes (consideradas no Resumo Financeiro)</p>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table className="w-full text-sm">
              <thead className="bg-secondary">
                <tr className="border-b border-border">
                  <th className={`${TH} text-left`}>Tipo de Conta</th>
                  <th className={`${TH} text-left`}>Conta Corrente</th>
                  <th className={`${TH} text-right`}>Valor do Limite</th>
                  <th className={`${TH} text-right`}>Saldo Atual</th>
                  <th className={`${TH} text-right`}>Saldo Disponível</th>
                </tr>
              </thead>
              <tbody>
                {data.contas.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4">
                      <EstadoVazio tamanho="compacto" icone={<Landmark />} titulo="Nenhuma conta corrente ativa." />
                    </td>
                  </tr>
                ) : data.contas.map((c) => {
                  const negativo = Number(c.saldo_atual) < 0;
                  return (
                    <tr key={c.id} className="border-t border-border transition-colors duration-150 hover:bg-muted/60">
                      <td className={TD}>{c.tipo ?? "Conta Corrente"}</td>
                      <td className={TD}>
                        <div className="font-medium">{c.nome}</div>
                        {(c.banco || c.agencia || c.conta) && (
                          <div className="text-xs text-muted-foreground">
                            {[c.banco, c.agencia ? `Ag: ${c.agencia}` : null, c.conta ? `Conta: ${c.conta}` : null].filter(Boolean).join(" · ")}
                          </div>
                        )}
                      </td>
                      <td className={`${TD} text-right tabular-nums`}>{formatBRL(Number(c.limite ?? 0))}</td>
                      <td className={`${TD} text-right tabular-nums ${negativo ? "text-destructive-ink" : "text-info-ink"}`}>
                        {formatBRL(Number(c.saldo_atual ?? 0))}
                      </td>
                      <td className={`${TD} text-right tabular-nums ${negativo ? "text-destructive-ink" : "text-info-ink"}`}>
                        {formatBRL(Number(c.saldo_atual ?? 0) + Number(c.limite ?? 0))}
                      </td>
                    </tr>
                  );
                })}
                <tr className={TOTAL}>
                  <td colSpan={2} className={TD}>Total ({data.contas.length})</td>
                  <td className={`${TD} text-right tabular-nums`}>{formatBRL(data.limiteTotal)}</td>
                  <td className={`${TD} text-right tabular-nums`}>{formatBRL(data.saldoTotal)}</td>
                  <td className={`${TD} text-right tabular-nums`}>{formatBRL(data.saldoTotal + data.limiteTotal)}</td>
                </tr>
              </tbody>
            </Table>
          </div>
        </section>

        {/* 6. Indicadores */}
        <section>
          <h3 className={SECAO}>Indicadores de saúde</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card className="flex min-h-[112px] flex-col justify-between gap-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 truncate text-sm font-medium leading-5 text-muted-foreground">Inadimplência (em atraso)</p>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-warning-tint text-warning-ink">
                  <ArrowDownCircle className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>
              <div className="min-w-0">
                <ValorDeCartao valor={formatBRL(data.inadimplencia)} className="mt-0 text-foreground" />
                <p className="mt-0.5 text-xs leading-4 tabular-nums text-muted-foreground">
                  {data.totalCR > 0 ? ((data.inadimplencia / data.totalCR) * 100).toFixed(1) : 0}% do total a receber
                </p>
              </div>
            </Card>
            <Card className="flex min-h-[112px] flex-col justify-between gap-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 truncate text-sm font-medium leading-5 text-muted-foreground">Margem do mês</p>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Percent className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>
              <div className="min-w-0">
                <p className="whitespace-nowrap text-[1.75rem] font-semibold leading-9 tabular-nums text-foreground">
                  {data.receitaMes > 0 ? ((data.resultadoMes / data.receitaMes) * 100).toFixed(1) : 0}%
                </p>
                <p className="mt-0.5 text-xs leading-4 text-muted-foreground">Resultado / Receita realizada</p>
              </div>
            </Card>
          </div>
        </section>

        <footer className="flex items-center gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
          <Sparkles className="h-3 w-3 shrink-0" aria-hidden="true" />
          Documento gerado automaticamente pelo PRAEFECTUS · Confidencial · Uso restrito à diretoria
        </footer>
      </div>
    </div>
  );
}

/**
 * Cartão KPI do Design System v3: rótulo 13/500, ícone num ladrilho de 32px
 * tingido no canto, valor pelo `ValorDeCartao` (28/600, que encolhe em vez
 * de quebrar). Texto colorido só na tinta `*-ink`.
 */
function KpiBox({ label, value, tone, icon: Icon }: { label: string; value: number; tone?: "success" | "danger"; icon: React.ElementType }) {
  const cor = tone === "success" ? "text-success-ink"
    : tone === "danger" ? "text-destructive-ink"
    : "text-foreground";
  const ladrilho = tone === "success" ? "bg-success-tint text-success-ink"
    : tone === "danger" ? "bg-destructive-tint text-destructive-ink"
    : "bg-muted text-muted-foreground";
  return (
    <Card className="flex min-h-[112px] flex-col justify-between gap-2 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-medium leading-5 text-muted-foreground">{label}</p>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${ladrilho}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <ValorDeCartao valor={formatBRL(value)} className={cor} />
    </Card>
  );
}

function TabelaLancamentos({ lancs, tipo, total }: { lancs: LancDetalhe[]; tipo: "pagar" | "receber"; total: number }) {
  const labelPessoa = tipo === "pagar" ? "Fornecedor" : "Cliente";
  const labelData = tipo === "pagar" ? "Previsão de Pagamento" : "Previsão de Recebimento";
  const corValor = tipo === "pagar" ? "text-destructive-ink" : "text-success-ink";

  if (lancs.length === 0) {
    return (
      <EstadoVazio
        tamanho="compacto"
        icone={<CheckCircle2 />}
        titulo="Nenhum lançamento em aberto"
        descricao={tipo === "pagar" ? "Nada a pagar atrasado ou a vencer." : "Nada a receber atrasado ou a vencer."}
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table className="w-full text-sm">
        <thead className="bg-secondary">
          <tr className="border-b border-border">
            <th className={`${TH} w-32 text-left`}>Situação</th>
            <th className={`${TH} text-left`}>{labelPessoa}</th>
            <th className={`${TH} w-40 text-left`}>{labelData}</th>
            <th className={`${TH} w-36 text-right`}>Valor</th>
          </tr>
        </thead>
        <tbody>
          {lancs.slice(0, 30).map((l) => (
            <tr key={l.id} className="border-t border-border transition-colors duration-150 hover:bg-muted/60">
              <td className={`${TD} whitespace-nowrap`}>
                {l.emAtraso ? (
                  <Badge variant="danger">Atrasado</Badge>
                ) : l.semVencimento ? (
                  <Badge variant="warning">Sem vencimento</Badge>
                ) : (
                  <Badge variant="info">A vencer</Badge>
                )}
                {l.diasAtraso > 0 && <span className="ml-1 text-xs tabular-nums text-muted-foreground">{l.diasAtraso}d</span>}
              </td>
              <td className={TD}>
                <div className="max-w-md truncate font-medium">{l.pessoa}</div>
                {l.descricao && <div className="max-w-md truncate text-xs text-muted-foreground">{l.descricao}</div>}
              </td>
              <td className={`${TD} whitespace-nowrap tabular-nums`}>
                {l.data_vencimento ? format(new Date(l.data_vencimento + "T00:00:00"), "dd/MM/yyyy") : "—"}
              </td>
              <td className={`${TD} whitespace-nowrap text-right font-medium tabular-nums ${corValor}`}>{formatBRL(l.valor)}</td>
            </tr>
          ))}
          {lancs.length > 30 && (
            <tr className="border-t border-border bg-secondary">
              <td colSpan={4} className={`${TD} text-xs text-muted-foreground`}>
                +{lancs.length - 30} lançamento(s) adicional(is) — exibindo os 30 com vencimento mais próximo
              </td>
            </tr>
          )}
          <tr className={TOTAL}>
            <td colSpan={3} className={TD}>Total ({lancs.length})</td>
            <td className={`${TD} text-right tabular-nums ${corValor}`}>{formatBRL(total)}</td>
          </tr>
        </tbody>
      </Table>
    </div>
  );
}
