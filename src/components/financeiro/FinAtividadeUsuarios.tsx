/**
 * FinAtividadeUsuarios — Relatório de Atividades dos Usuários (modelo Omie 11.10).
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
import { Printer, RefreshCw, Activity } from "lucide-react";
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
    <div className="space-y-3">
      {/* Filtros */}
      <Card className="print:hidden">
        <CardContent className="p-3 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Período</Label>
            <Select value={String(diasAtras)} onValueChange={(v) => setDiasAtras(Number(v))}>
              <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Hoje</SelectItem>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 flex-1 min-w-[200px]">
            <Label className="text-xs">Filtrar por usuário</Label>
            <Input value={filtroUsuario} onChange={(e) => setFiltroUsuario(e.target.value)} placeholder="Nome ou e-mail..." className="h-8 text-xs" />
          </div>
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />Atualizar
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-1.5" />Imprimir / PDF
          </Button>
        </CardContent>
      </Card>

      {/* Totais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 print:hidden">
        <KpiCard label="Total de eventos" value={totais.total} />
        <KpiCard label="Inclusões" value={totais.inclusoes} tone="success" />
        <KpiCard label="Alterações" value={totais.alteracoes} tone="warning" />
        <KpiCard label="Exclusões" value={totais.exclusoes} tone="danger" />
      </div>

      {/* Relatório */}
      <Card>
        <CardContent className="p-6 print:p-0">
          <header className="border-b pb-3 mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold flex items-center gap-2"><Activity className="w-4 h-4" />Atividade dos Usuários</h1>
              <p className="text-xs text-muted-foreground">{empresaAtiva?.razao_social}</p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <div>Emitido em</div>
              <div className="font-medium">{format(new Date(), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}</div>
            </div>
          </header>

          {isLoading ? (
            <div className="space-y-2"><Skeleton className="h-6 w-full" /><Skeleton className="h-6 w-full" /><Skeleton className="h-6 w-full" /></div>
          ) : filtrados.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Nenhuma atividade registrada no período.</div>
          ) : (
            <div className="space-y-6">
              {Array.from(agrupado.entries()).map(([usuario, datas]) => {
                const totalUsuario = Array.from(datas.values()).reduce((s, d) => s + Array.from(d.values()).reduce((s2, evs) => s2 + evs.length, 0), 0);
                return (
                  <section key={usuario} className="text-xs">
                    <div className="font-semibold border-b border-foreground pb-1 mb-2">
                      Usuário: {usuario}
                    </div>
                    {Array.from(datas.entries()).map(([data, tipos]) => {
                      const totalData = Array.from(tipos.values()).reduce((s, evs) => s + evs.length, 0);
                      return (
                        <div key={data} className="ml-3 mb-3">
                          <div className="text-muted-foreground font-medium border-b border-dashed pb-0.5 mb-1">
                            Data da Atividade: {data}
                          </div>
                          {Array.from(tipos.entries()).map(([tipo, evs]) => (
                            <div key={tipo} className="ml-3 mb-2">
                              <div className="text-xs uppercase tracking-wide text-muted-foreground border-b border-dotted pb-0.5 mb-1">
                                Tipo: {tipo}
                              </div>
                              <table className="w-full">
                                <tbody>
                                  {evs.map((ev) => (
                                    <tr key={ev.id} className="hover:bg-muted/30">
                                      <td className="py-0.5 pr-3 w-24">
                                        <Badge
                                          variant={ev.operacao === "DELETE" ? "destructive" : "outline"}
                                          className="text-xs px-1.5 py-0 h-4"
                                        >
                                          {OPERACAO_LABEL[ev.operacao]}
                                        </Badge>
                                      </td>
                                      <td className="py-0.5 pr-3 truncate max-w-xs">{ev.descricao}</td>
                                      <td className="py-0.5 pr-3 tabular-nums whitespace-nowrap text-right w-28">{formatBRL(ev.valor)}</td>
                                      <td className="py-0.5 pr-3 text-muted-foreground tabular-nums w-24">
                                        {ev.data_evento && ev.data_evento.length >= 10 ? format(new Date(ev.data_evento), "dd/MM/yyyy") : "—"}
                                      </td>
                                      <td className="py-0.5 text-muted-foreground truncate">{ev.categoria}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              <div className="text-xs text-muted-foreground italic ml-1 mt-0.5">
                                atividades({evs.length})
                              </div>
                            </div>
                          ))}
                          <div className="text-xs text-muted-foreground italic ml-1">
                            atividades por data ({totalData})
                          </div>
                        </div>
                      );
                    })}
                    <div className="text-xs text-muted-foreground italic ml-3">
                      atividades por usuário ({totalUsuario})
                    </div>
                  </section>
                );
              })}
            </div>
          )}

          <footer className="border-t pt-2 mt-6 text-xs text-muted-foreground text-center">
            DELETE indica que houve exclusão do registro · Gerado pelo PRAEFECTUS · Página 1
          </footer>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ label, value, tone }: { label: string; value: number; tone?: "success" | "warning" | "danger" }) {
  const cor = tone === "success" ? "text-success"
    : tone === "warning" ? "text-warning"
    : tone === "danger" ? "text-destructive"
    : "text-foreground";
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
        <div className={`text-xl font-semibold tabular-nums ${cor}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
