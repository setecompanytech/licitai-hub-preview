/**
 * FinAtividadeUsuarios — Relatório de Atividades dos Usuários.
 *
 * Lista cronológica de eventos do módulo financeiro (INSERT/UPDATE/DELETE) com
 * agrupamento por Usuário → Data → Tipo, exibindo evento, descrição, valor,
 * data e categoria. Imprimível em PDF (botão Print que aciona window.print).
 *
 * Fonte: tabela financeiro_audit_log (preenchida pelos triggers
 * financeiro_audit_trigger sobre fin_lancamentos, fin_contas, fin_pessoas, etc).
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import EstadoVazio from "@/components/shared/EstadoVazio";
import ValorDeCartao from "./ValorDeCartao";
import { Printer, RefreshCw, Activity, Search, PlusCircle, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useFinanceiro";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { formatBRL } from "@/lib/financeiro/formatters";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type EventoLog = {
  id: number;
  usuario_id: string | null;
  usuario_email: string;
  tabela: string;
  operacao: "INSERT" | "UPDATE" | "DELETE";
  created_at: string;
  descricao: string;
  valor: number;
  categoria: string;
  data_evento: string;
};

const OPERACAO_LABEL: Record<string, string> = {
  INSERT: "Inclusão",
  UPDATE: "Alteração",
  DELETE: "Exclusão",
};

/** Status sempre com texto — a tinta é reforço, nunca a única pista. */
const OPERACAO_VARIANTE: Record<string, "success" | "warning" | "danger" | "muted"> = {
  INSERT: "success",
  UPDATE: "warning",
  DELETE: "danger",
};

const TABELA_LABEL: Record<string, string> = {
  fin_pessoas: "Clientes e Fornecedores",
  financeiro_pessoas: "Clientes e Fornecedores",
  fin_lancamentos: "Lançamento Financeiro",
  financeiro_lancamentos: "Lançamento Financeiro",
  fin_contas: "Conta Corrente",
  financeiro_contas: "Conta Corrente",
  fin_categorias: "Categoria",
  financeiro_categorias: "Categoria",
  fin_centros_custo: "Centro de Custo",
  financeiro_centros_custo: "Centro de Custo",
  fin_movimentacoes: "Movimentação Bancária",
  financeiro_extrato_movimentos: "Movimentação Bancária",
};

function classificarTipo(tabela: string, dados: any): string {
  const base = TABELA_LABEL[tabela] ?? tabela;
  if (tabela.includes("lancamentos") || tabela.includes("movimentacoes")) {
    const tipo = dados?.tipo;
    if (tipo === "a_pagar") return "Lançamento de Conta a Pagar";
    if (tipo === "a_receber") return "Lançamento de Conta a Receber";
    const valor = Number(dados?.valor ?? 0);
    if (valor > 0) return "Lançamento de Conta Corrente a Crédito";
    if (valor < 0) return "Lançamento de Conta Corrente a Débito";
  }
  return base;
}

function useAtividade(diasAtras: number) {
  const empresaId = useEmpresaId();
  return useQuery({
    queryKey: ["fin-atividade-usuarios", empresaId, diasAtras],
    enabled: !!empresaId,
    queryFn: async (): Promise<EventoLog[]> => {
      const since = new Date();
      since.setDate(since.getDate() - diasAtras);
      since.setHours(0, 0, 0, 0);

      const { data: logs, error } = await supabase
        .from("financeiro_audit_log")
        .select("id, usuario_id, tabela, operacao, dados_antes, dados_depois, created_at")
        .eq("empresa_id", empresaId!)
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;

      // Resolve emails dos usuários em batch
      const userIds = Array.from(new Set((logs ?? []).map((l) => l.usuario_id).filter(Boolean))) as string[];
      const emailMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, nome_completo")
          .in("user_id", userIds);
        (profs ?? []).forEach((p: any) => emailMap.set(p.user_id, p.nome_completo ?? p.user_id));
      }

      return (logs ?? []).map((l: any) => {
        const dados = l.dados_depois ?? l.dados_antes ?? {};
        const valor = Number(dados?.valor ?? dados?.saldo_atual ?? 0);
        return {
          id: l.id,
          usuario_id: l.usuario_id,
          usuario_email: l.usuario_id ? (emailMap.get(l.usuario_id) ?? "Sistema") : "Sistema",
          tabela: l.tabela,
          operacao: l.operacao,
          created_at: l.created_at,
          descricao: dados?.descricao ?? dados?.nome ?? dados?.razao_social ?? "—",
          valor,
          categoria: dados?.categoria ?? dados?.categoria_nome ?? "Não Identificado",
          data_evento: dados?.data_competencia ?? dados?.data_vencimento ?? l.created_at,
        };
      });
    },
  });
}

export default function FinAtividadeUsuarios() {
  const { empresaAtiva } = useEmpresa();
  const [diasAtras, setDiasAtras] = useState(7);
  const [filtroUsuario, setFiltroUsuario] = useState("");
  const { data: eventos, isLoading, refetch, isFetching } = useAtividade(diasAtras);

  const filtrados = useMemo(() => {
    if (!eventos) return [];
    if (!filtroUsuario.trim()) return eventos;
    const q = filtroUsuario.toLowerCase();
    return eventos.filter((e) => e.usuario_email.toLowerCase().includes(q));
  }, [eventos, filtroUsuario]);

  // Agrupa: Usuário → Data → Tipo
  const agrupado = useMemo(() => {
    const map = new Map<string, Map<string, Map<string, EventoLog[]>>>();
    filtrados.forEach((ev) => {
      const dataAtv = format(new Date(ev.created_at), "dd/MM/yyyy");
      const tipo = classificarTipo(ev.tabela, { tipo: ev.tabela.includes("a_pagar") ? "a_pagar" : null, valor: ev.valor });
      if (!map.has(ev.usuario_email)) map.set(ev.usuario_email, new Map());
      const u = map.get(ev.usuario_email)!;
      if (!u.has(dataAtv)) u.set(dataAtv, new Map());
      const d = u.get(dataAtv)!;
      if (!d.has(tipo)) d.set(tipo, []);
      d.get(tipo)!.push(ev);
    });
    return map;
  }, [filtrados]);

  const totais = useMemo(() => {
    return {
      total: filtrados.length,
      inclusoes: filtrados.filter((e) => e.operacao === "INSERT").length,
      alteracoes: filtrados.filter((e) => e.operacao === "UPDATE").length,
      exclusoes: filtrados.filter((e) => e.operacao === "DELETE").length,
    };
  }, [filtrados]);

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card className="print:hidden">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          {/* Busca larga à esquerda, período ao lado, ações ancoradas à
              direita — a linha de filtros padrão do módulo. */}
          <div className="min-w-[220px] flex-1 basis-64 space-y-1.5">
            <Label htmlFor="atividade-usuario">Filtrar por usuário</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="atividade-usuario"
                value={filtroUsuario}
                onChange={(e) => setFiltroUsuario(e.target.value)}
                placeholder="Nome ou e-mail..."
                className="pl-9"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="atividade-periodo">Período</Label>
            <Select value={String(diasAtras)} onValueChange={(v) => setDiasAtras(Number(v))}>
              <SelectTrigger id="atividade-periodo" className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Hoje</SelectItem>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={isFetching ? "animate-spin" : undefined} aria-hidden="true" />Atualizar
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer aria-hidden="true" />Imprimir / PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Totais */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
        <KpiCard label="Total de eventos" value={totais.total} icon={Activity} />
        <KpiCard label="Inclusões" value={totais.inclusoes} icon={PlusCircle} tone="success" />
        <KpiCard label="Alterações" value={totais.alteracoes} icon={Pencil} tone="warning" />
        <KpiCard label="Exclusões" value={totais.exclusoes} icon={Trash2} tone="danger" />
      </div>

      {/* Relatório */}
      <Card>
        <CardContent className="p-5 print:p-0">
          <header className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold leading-6 text-foreground">
                <Activity className="h-5 w-5 text-muted-foreground" aria-hidden="true" />Atividade dos Usuários
              </h2>
              <p className="text-sm text-muted-foreground">{empresaAtiva?.razao_social}</p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <div>Emitido em</div>
              <div className="font-medium tabular-nums">{format(new Date(), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}</div>
            </div>
          </header>

          {isLoading ? (
            <div className="space-y-2" role="status" aria-label="Carregando atividades">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : filtrados.length === 0 ? (
            <EstadoVazio
              icone={<Activity />}
              titulo="Nenhuma atividade no período"
              descricao="Nenhum evento do Financeiro foi registrado para o período e o filtro escolhidos."
            />
          ) : (
            <div className="space-y-6">
              {Array.from(agrupado.entries()).map(([usuario, datas]) => {
                const totalUsuario = Array.from(datas.values()).reduce((s, d) => s + Array.from(d.values()).reduce((s2, evs) => s2 + evs.length, 0), 0);
                return (
                  <section key={usuario} className="text-sm">
                    <h3 className="mb-2 border-b border-border pb-1 text-base font-semibold text-foreground">
                      Usuário: {usuario}
                    </h3>
                    {Array.from(datas.entries()).map(([data, tipos]) => {
                      const totalData = Array.from(tipos.values()).reduce((s, evs) => s + evs.length, 0);
                      return (
                        <div key={data} className="ml-3 mb-3">
                          <div className="mb-2 border-b border-border pb-1 text-sm font-medium text-muted-foreground">
                            Data da Atividade: {data}
                          </div>
                          {Array.from(tipos.entries()).map(([tipo, evs]) => (
                            <div key={tipo} className="ml-3 mb-2">
                              <div className="mb-1 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Tipo: {tipo}
                              </div>
                              {/* As mesmas cinco colunas, nos primitivos de `ui/table`:
                                  linhas de 48px, divisórias, hover discreto e a rolagem
                                  presa ao contêiner (Design System v3). */}
                              <div className="overflow-hidden rounded-lg border border-border">
                                <Table>
                                  <TableBody>
                                    {evs.map((ev) => (
                                      <TableRow key={ev.id}>
                                        <TableCell className="w-28">
                                          <Badge variant={OPERACAO_VARIANTE[ev.operacao] ?? "muted"}>
                                            {OPERACAO_LABEL[ev.operacao]}
                                          </Badge>
                                        </TableCell>
                                        <TableCell className="max-w-xs truncate" title={ev.descricao}>{ev.descricao}</TableCell>
                                        <TableCell nowrap className="w-28 text-right tabular-nums">{formatBRL(ev.valor)}</TableCell>
                                        <TableCell nowrap className="w-24 tabular-nums text-muted-foreground">
                                          {ev.data_evento && ev.data_evento.length >= 10 ? format(new Date(ev.data_evento), "dd/MM/yyyy") : "—"}
                                        </TableCell>
                                        <TableCell className="truncate text-muted-foreground">{ev.categoria}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                              <div className="ml-1 mt-1 text-xs text-muted-foreground">
                                atividades({evs.length})
                              </div>
                            </div>
                          ))}
                          <div className="ml-1 text-xs text-muted-foreground">
                            atividades por data ({totalData})
                          </div>
                        </div>
                      );
                    })}
                    <div className="ml-3 text-xs text-muted-foreground">
                      atividades por usuário ({totalUsuario})
                    </div>
                  </section>
                );
              })}
            </div>
          )}

          <footer className="border-t border-border pt-3 mt-6 text-xs text-muted-foreground text-center">
            "Exclusão" indica que houve remoção do registro · Gerado pelo PRAEFECTUS · Página 1
          </footer>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Cartão KPI do Design System v3 (112px): rótulo em cima, ícone num ladrilho
 * tingido no canto, valor 28/36 embaixo — o mesmo desenho do FinResumoCards.
 */
function KpiCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  tone?: "success" | "warning" | "danger";
}) {
  const cor = tone === "success" ? "text-success-ink"
    : tone === "warning" ? "text-warning-ink"
    : tone === "danger" ? "text-destructive-ink"
    : "text-foreground";
  const ladrilho = tone === "success" ? "bg-success-tint text-success-ink"
    : tone === "warning" ? "bg-warning-tint text-warning-ink"
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
      <ValorDeCartao valor={String(value)} className={cor} />
    </Card>
  );
}
