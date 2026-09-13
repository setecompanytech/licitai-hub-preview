import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MoneyInput } from "@/components/ui/money-input";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldCheck, Check, X, Loader2, ShieldAlert, CheckCircle2 } from "lucide-react";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useMembroPermissoes } from "@/hooks/useMembroPermissoes";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const fmtData = (d?: string | null) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR") : "—");

type Config = { ativo: boolean; limite_admin: number; janela_dias: number };
type Pendente = {
  id: string; descricao: string | null; valor: number;
  data_vencimento: string | null; aprovacao_status: string | null; aprovacao_motivo: string | null;
};
type LogRow = {
  id: string; acao: string; valor: number; descricao: string | null;
  motivo: string | null; criado_em: string;
};

/**
 * Aprovação de Pagamentos — reconstruída (09/09) depois de a versão anterior
 * se revelar fachada: aprovar não tirava da fila, rejeitar CANCELAVA o
 * título, e a baixa nunca consultou nada.
 *
 * Agora o desenho é o inverso: a tela é só a mesa de decisão — quem garante
 * é o BANCO. Trigger bloqueia a baixa manual sem aprovação (em qualquer
 * tela), a alçada é conferida no servidor (RPC), o valor é congelado na
 * aprovação (mudou, reaprova), rejeição devolve com motivo sem matar o
 * título, e tudo deixa trilha. Opt-in por empresa, desligado por padrão.
 */
export default function FinAprovacoes() {
  const { empresaAtiva } = useEmpresa();
  const { isAdmin, isEmpresaAdmin, isFinanceiro } = useMembroPermissoes();
  const podeConfigurar = isAdmin || isEmpresaAdmin;
  const podeAprovarAlgo = podeConfigurar || isFinanceiro;

  const [config, setConfig] = useState<Config | null>(null);
  const [pendentes, setPendentes] = useState<Pendente[]>([]);
  const [trilha, setTrilha] = useState<LogRow[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvandoCfg, setSalvandoCfg] = useState(false);
  const [agindo, setAgindo] = useState<string | null>(null);
  const [rejeitando, setRejeitando] = useState<Pendente | null>(null);
  const [motivo, setMotivo] = useState("");
  const [cfgLimite, setCfgLimite] = useState(10000);
  const [cfgJanela, setCfgJanela] = useState("30");

  const carregar = async () => {
    if (!empresaAtiva?.id) return;
    setCarregando(true);
    try {
      const { data: cfg } = await (supabase.from("financeiro_config_aprovacao" as never) as any)
        .select("ativo, limite_admin, janela_dias")
        .eq("empresa_id", empresaAtiva.id)
        .maybeSingle();
      const c: Config = (cfg as Config | null) ?? { ativo: false, limite_admin: 10000, janela_dias: 30 };
      setConfig(c);
      setCfgLimite(Number(c.limite_admin) || 10000);
      setCfgJanela(String(c.janela_dias || 30));

      if (c.ativo) {
        const ate = new Date(Date.now() + (c.janela_dias || 30) * 86400000).toISOString().slice(0, 10);
        const [pendRes, logRes] = await Promise.all([
          (supabase.from("financeiro_lancamentos") as any)
            .select("id, descricao, valor, data_vencimento, aprovacao_status, aprovacao_motivo")
            .eq("empresa_id", empresaAtiva.id)
            .eq("tipo", "a_pagar")
            .not("status", "in", "(realizado,conciliado,cancelado)")
            .or("aprovacao_status.is.null,aprovacao_status.in.(pendente,rejeitado)")
            .lte("data_vencimento", ate)
            .order("data_vencimento", { ascending: true })
            .limit(200),
          (supabase.from("financeiro_aprovacoes_log" as never) as any)
            .select("id, acao, valor, descricao, motivo, criado_em")
            .eq("empresa_id", empresaAtiva.id)
            .order("criado_em", { ascending: false })
            .limit(15),
        ]);
        setPendentes(((pendRes.data as unknown as Pendente[]) || []).map(p => ({ ...p, valor: Number(p.valor) || 0 })));
        setTrilha((logRes.data as unknown as LogRow[]) || []);
      } else {
        setPendentes([]);
        setTrilha([]);
      }
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaAtiva?.id]);

  const salvarConfig = async (ativo: boolean) => {
    if (!empresaAtiva?.id) return;
    setSalvandoCfg(true);
    const { error } = await (supabase.from("financeiro_config_aprovacao" as never) as any).upsert({
      empresa_id: empresaAtiva.id,
      ativo,
      limite_admin: cfgLimite,
      janela_dias: Math.min(365, Math.max(1, parseInt(cfgJanela) || 30)),
      updated_at: new Date().toISOString(),
    }, { onConflict: "empresa_id" });
    setSalvandoCfg(false);
    if (error) { toast.error("Não foi possível salvar a configuração", { description: error.message }); return; }
    toast.success(ativo
      ? "Workflow ligado — a baixa manual de contas a pagar passa a exigir aprovação."
      : "Workflow desligado — a baixa volta a não exigir aprovação.");
    carregar();
  };

  const decidir = async (l: Pendente, acao: "aprovar" | "rejeitar", motivoTexto?: string) => {
    setAgindo(l.id);
    try {
      const { error } = await supabase.rpc("aprovar_pagamento" as never, {
        p_lancamento_id: l.id,
        p_acao: acao,
        p_motivo: motivoTexto ?? null,
      } as never);
      if (error) throw error;
      toast.success(acao === "aprovar"
        ? `Aprovado: ${fmt(l.valor)} — liberado para baixa.`
        : "Rejeitado — devolvido para revisão com o motivo registrado (o título continua vivo).");
      setRejeitando(null);
      setMotivo("");
      carregar();
    } catch (e) {
      // Mensagem real do banco: é ela que explica alçada e estado.
      toast.error("A decisão não foi registrada", {
        description: e instanceof Error ? e.message : String(e),
        duration: 7000,
      });
    } finally {
      setAgindo(null);
    }
  };

  const totalPendente = useMemo(
    () => pendentes.filter(p => p.aprovacao_status !== "rejeitado").reduce((s, p) => s + p.valor, 0),
    [pendentes],
  );
  const limite = Number(config?.limite_admin) || 0;

  if (carregando && !config) {
    return (
      <div className="space-y-4" role="status" aria-live="polite" aria-label="Carregando aprovações">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" aria-hidden="true" /> Aprovação de Pagamentos
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Com o workflow ligado, a <b>baixa manual</b> de contas a pagar exige aprovação — a trava é no
            banco e vale em todas as telas. Conciliação bancária não é barrada: o extrato prova que o
            dinheiro saiu, e registrar o fato não é autorizá-lo.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Configuração — política da empresa, decidida pelo admin */}
          <div className="rounded-lg border border-border bg-muted p-4 flex flex-col lg:flex-row lg:items-end gap-4">
            <div className="flex items-start gap-3 flex-1">
              <Switch
                id="wf-ativo"
                checked={!!config?.ativo}
                disabled={!podeConfigurar || salvandoCfg}
                onCheckedChange={v => salvarConfig(v)}
                className="mt-0.5"
              />
              <div>
                <Label htmlFor="wf-ativo">Exigir aprovação antes da baixa</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Até o limite, a equipe do Financeiro aprova; acima, somente o administrador.
                  {!podeConfigurar && " (Só o administrador altera esta política.)"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-2">
                <Label htmlFor="wf-limite">Limite da equipe (R$)</Label>
                <MoneyInput id="wf-limite" value={cfgLimite} onValueChange={setCfgLimite} disabled={!podeConfigurar} className="w-40" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wf-janela">Janela (dias)</Label>
                <Input id="wf-janela" type="number" min={1} max={365} value={cfgJanela} onChange={e => setCfgJanela(e.target.value)}
                  disabled={!podeConfigurar} className="w-24" />
              </div>
              {config?.ativo && podeConfigurar && (
                <Button variant="outline" disabled={salvandoCfg}
                  onClick={() => salvarConfig(true)}>
                  Salvar
                </Button>
              )}
            </div>
          </div>

          {!config?.ativo ? (
            <div className="flex flex-col items-center rounded-lg border border-dashed border-border py-12 px-6 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-tint text-primary">
                <ShieldAlert className="w-6 h-6" aria-hidden="true" />
              </span>
              <p className="mt-3 text-lg font-semibold">Workflow desligado</p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                As baixas acontecem sem aprovação, como sempre. Ligue o interruptor acima para ativar a
                trava de alçada nesta empresa.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted p-4">
                <span className="text-sm">
                  Aguardando aprovação (vencimentos até {config.janela_dias} dias):
                </span>
                <span className="font-semibold tabular-nums text-right">
                  {pendentes.filter(p => p.aprovacao_status !== "rejeitado").length} · {fmt(totalPendente)}
                </span>
              </div>

              <div className="rounded-lg border border-border max-h-[480px] overflow-y-auto">
                {pendentes.length === 0 ? (
                  <div className="flex flex-col items-center py-12 px-6 text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-tint text-primary">
                      <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
                    </span>
                    <p className="mt-3 text-lg font-semibold">Nada aguardando aprovação</p>
                    <p className="mt-1 max-w-md text-sm text-muted-foreground">Nenhum pagamento pendente na janela configurada.</p>
                  </div>
                ) : (
                  pendentes.map(l => {
                    const acimaDoLimite = l.valor > limite;
                    const rejeitado = l.aprovacao_status === "rejeitado";
                    const podeDecidir = podeConfigurar || (isFinanceiro && !acimaDoLimite);
                    return (
                      <div key={l.id} className={`flex flex-wrap items-center gap-3 p-4 border-b border-border last:border-b-0 ${rejeitado ? "bg-destructive-tint" : ""}`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{l.descricao || "(sem descrição)"}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Badge variant={acimaDoLimite ? "warning" : "info"}>
                              {acimaDoLimite ? "Somente admin" : "Equipe Financeiro"}
                            </Badge>
                            {rejeitado && <Badge variant="danger">Rejeitado — em revisão</Badge>}
                            <span className="text-xs text-muted-foreground">Vence {fmtData(l.data_vencimento)}</span>
                          </div>
                          {rejeitado && l.aprovacao_motivo && (
                            <p className="text-xs text-destructive-ink mt-1 truncate" title={l.aprovacao_motivo}>Motivo: {l.aprovacao_motivo}</p>
                          )}
                        </div>
                        <span className="font-semibold tabular-nums whitespace-nowrap text-right">{fmt(l.valor)}</span>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline"
                            aria-label="Rejeitar pagamento"
                            title="Rejeitar (devolve para revisão com motivo — não cancela o título)"
                            disabled={!podeDecidir || agindo === l.id}
                            onClick={() => { setRejeitando(l); setMotivo(""); }}>
                            <X className="w-4 h-4" /> Rejeitar
                          </Button>
                          <Button size="sm"
                            aria-label="Aprovar pagamento"
                            title={podeDecidir ? "Aprovar — libera a baixa" : "Alçada insuficiente para este valor"}
                            disabled={!podeDecidir || agindo === l.id}
                            onClick={() => decidir(l, "aprovar")}>
                            {agindo === l.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Aprovar
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {!podeAprovarAlgo && (
                <p className="text-sm text-muted-foreground">
                  Você pode acompanhar a fila; aprovar é da equipe do Financeiro (até o limite) e do administrador.
                </p>
              )}

              {trilha.length > 0 && (
                <div className="rounded-lg border border-border p-4">
                  <p className="text-sm font-semibold mb-2">Trilha de decisões (últimas {trilha.length})</p>
                  <div className="space-y-1">
                    {trilha.map(t => (
                      <p key={t.id} className="text-xs text-muted-foreground truncate">
                        <span className={t.acao === "aprovado" ? "text-success font-semibold" : "text-destructive font-semibold"}>
                          {t.acao === "aprovado" ? "Aprovado" : "Rejeitado"}
                        </span>{" · "}
                        {new Date(t.criado_em).toLocaleString("pt-BR")} · {fmt(Number(t.valor) || 0)} · {t.descricao || "—"}
                        {t.motivo ? ` · motivo: ${t.motivo}` : ""}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Rejeição pede motivo — é ele que orienta quem vai revisar */}
      <Dialog open={!!rejeitando} onOpenChange={v => !v && setRejeitando(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Rejeitar pagamento</DialogTitle></DialogHeader>
          {rejeitando && (
            <div className="space-y-4">
              <p className="text-sm font-medium">{rejeitando.descricao || "(sem descrição)"} — {fmt(rejeitando.valor)}</p>
              <p className="text-sm text-muted-foreground">
                A rejeição devolve a conta para revisão com o motivo abaixo. O título continua vivo —
                nada é cancelado.
              </p>
              <div className="space-y-2">
                <Label htmlFor="wf-motivo">Motivo *</Label>
                <Textarea id="wf-motivo" rows={3} value={motivo} onChange={e => setMotivo(e.target.value)}
                  placeholder="Ex.: valor diverge do boleto; fornecedor pendente de regularização…" />
                {motivo.trim().length > 0 && motivo.trim().length < 4 && (
                  <p className="text-xs text-destructive">Informe ao menos 4 caracteres.</p>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRejeitando(null)}>Cancelar</Button>
                <Button variant="destructive" disabled={motivo.trim().length < 4 || agindo === rejeitando.id}
                  onClick={() => decidir(rejeitando, "rejeitar", motivo.trim())}>
                  {agindo === rejeitando.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                  Rejeitar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
