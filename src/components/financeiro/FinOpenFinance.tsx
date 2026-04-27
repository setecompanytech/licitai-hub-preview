import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plug, Plus, RefreshCw, Trash2, AlertCircle, CheckCircle2, Loader2, ShieldCheck, Building2, Activity } from "lucide-react";
import { useEmpresaId, useContas } from "@/hooks/useFinanceiro";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Conexao = {
  id: string;
  empresa_id: string;
  conta_id: string | null;
  provedor: "pluggy" | "belvo" | "manual";
  banco_nome: string;
  banco_codigo: string | null;
  status: "pendente" | "ativa" | "erro" | "revogada" | "expirada";
  ultima_sincronizacao: string | null;
  proxima_sincronizacao: string | null;
  frequencia_horas: number;
  erro_mensagem: string | null;
  created_at: string;
};

const BANCOS_BR = [
  { codigo: "001", nome: "Banco do Brasil" },
  { codigo: "033", nome: "Santander" },
  { codigo: "104", nome: "Caixa Econômica" },
  { codigo: "237", nome: "Bradesco" },
  { codigo: "260", nome: "Nubank" },
  { codigo: "341", nome: "Itaú Unibanco" },
  { codigo: "077", nome: "Inter" },
  { codigo: "336", nome: "C6 Bank" },
  { codigo: "212", nome: "Banco Original" },
  { codigo: "748", nome: "Sicredi" },
];

const STATUS_VARIANT: Record<string, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  pendente: { label: "Pendente", cls: "bg-warning/10 text-warning border-warning/30", icon: AlertCircle },
  ativa: { label: "Ativa", cls: "bg-success/10 text-success border-success/30", icon: CheckCircle2 },
  erro: { label: "Erro", cls: "bg-destructive/10 text-destructive border-destructive/30", icon: AlertCircle },
  revogada: { label: "Revogada", cls: "bg-muted text-muted-foreground", icon: AlertCircle },
  expirada: { label: "Expirada", cls: "bg-destructive/10 text-destructive border-destructive/30", icon: AlertCircle },
};

export default function FinOpenFinance() {
  const empresaId = useEmpresaId();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: contas = [] } = useContas();

  const [novoOpen, setNovoOpen] = useState(false);
  const [provedor, setProvedor] = useState<"pluggy" | "belvo" | "manual">("manual");
  const [bancoCodigo, setBancoCodigo] = useState("");
  const [contaId, setContaId] = useState<string>("");
  const [frequencia, setFrequencia] = useState("12");

  const { data: conexoes = [], isLoading } = useQuery({
    queryKey: ["fin-of-conexoes", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro_open_finance_conexoes" as any)
        .select("*")
        .eq("empresa_id", empresaId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Conexao[];
    },
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["fin-of-logs", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await supabase
        .from("financeiro_open_finance_sync_log" as any)
        .select("*")
        .eq("empresa_id", empresaId!)
        .order("created_at", { ascending: false })
        .limit(50);
      return (data ?? []) as unknown as Array<{
        id: string;
        conexao_id: string;
        status: string;
        movimentos_novos: number;
        saldo_atual: number | null;
        duracao_ms: number | null;
        erro: string | null;
        created_at: string;
      }>;
    },
  });

  const criar = useMutation({
    mutationFn: async () => {
      if (!empresaId || !user) throw new Error("Sessão inválida.");
      const banco = BANCOS_BR.find((b) => b.codigo === bancoCodigo);
      if (!banco) throw new Error("Selecione um banco.");
      const { error } = await supabase.from("financeiro_open_finance_conexoes" as any).insert({
        empresa_id: empresaId,
        conta_id: contaId || null,
        provedor,
        banco_nome: banco.nome,
        banco_codigo: banco.codigo,
        frequencia_horas: Number(frequencia),
        status: "pendente",
        criado_por: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conexão registrada. Configure as credenciais do provedor para ativar.");
      qc.invalidateQueries({ queryKey: ["fin-of-conexoes"] });
      setNovoOpen(false);
      setBancoCodigo("");
      setContaId("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao criar conexão."),
  });

  const sincronizar = useMutation({
    mutationFn: async (conexao: Conexao) => {
      if (!empresaId) throw new Error("Sessão inválida.");
      const inicio = Date.now();
      // Stub de sincronização (sem API real ainda) — registra log e atualiza timestamp
      const { error: logErr } = await supabase.from("financeiro_open_finance_sync_log" as any).insert({
        conexao_id: conexao.id,
        empresa_id: empresaId,
        status: conexao.provedor === "manual" ? "sucesso" : "erro",
        movimentos_novos: 0,
        duracao_ms: Date.now() - inicio,
        erro: conexao.provedor !== "manual" ? "Provedor ainda não configurado. Use 'Importar OFX' como alternativa." : null,
      });
      if (logErr) throw logErr;
      await supabase
        .from("financeiro_open_finance_conexoes" as any)
        .update({
          ultima_sincronizacao: new Date().toISOString(),
          proxima_sincronizacao: new Date(Date.now() + conexao.frequencia_horas * 3600 * 1000).toISOString(),
        })
        .eq("id", conexao.id);
    },
    onSuccess: (_, conexao) => {
      qc.invalidateQueries({ queryKey: ["fin-of-conexoes"] });
      qc.invalidateQueries({ queryKey: ["fin-of-logs"] });
      if (conexao.provedor === "manual") {
        toast.success("Sincronização manual registrada. Use 'Importar OFX' para os movimentos.");
      } else {
        toast.info("Provedor ainda não conectado. Use 'Importar OFX' enquanto isso.");
      }
    },
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financeiro_open_finance_conexoes" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conexão removida.");
      qc.invalidateQueries({ queryKey: ["fin-of-conexoes"] });
    },
  });

  return (
    <Tabs defaultValue="conexoes" className="space-y-4">
      <TabsList>
        <TabsTrigger value="conexoes"><Plug className="w-3.5 h-3.5 mr-1.5" />Conexões</TabsTrigger>
        <TabsTrigger value="logs"><Activity className="w-3.5 h-3.5 mr-1.5" />Histórico de sincronizações</TabsTrigger>
      </TabsList>

      <TabsContent value="conexoes" className="mt-0 space-y-4">
        <Card className="border-info/30 bg-info/5">
          <CardContent className="p-4 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-info shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Open Finance & Integração Bancária</p>
              <p>
                Conecte suas contas bancárias para sincronização automática de extratos e saldos. Suporte a agregadores
                <strong> Pluggy </strong>e<strong> Belvo</strong> (requer credenciais do provedor configuradas como secrets).
                Enquanto a integração API não estiver ativa, use <strong>Importar OFX</strong> ou registre uma <strong>conexão manual</strong> para
                organizar suas contas.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {conexoes.length} conexão(ões) configurada(s)
          </h3>
          <Button onClick={() => setNovoOpen(true)} size="sm">
            <Plus className="w-4 h-4 mr-1.5" /> Nova conexão
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-8"><Loader2 className="w-5 h-5 mx-auto animate-spin" /></div>
        ) : conexoes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              <Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
              Nenhuma conexão bancária configurada.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {conexoes.map((c) => {
              const st = STATUS_VARIANT[c.status];
              const Icon = st.icon;
              const conta = contas.find((cc) => cc.id === c.conta_id);
              return (
                <Card key={c.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{c.banco_nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.provedor === "manual" ? "Conexão manual" : `Via ${c.provedor.charAt(0).toUpperCase() + c.provedor.slice(1)}`}
                          {conta && ` · ${conta.nome}`}
                        </p>
                      </div>
                      <Badge variant="outline" className={`text-[10px] ${st.cls}`}>
                        <Icon className="w-3 h-3 mr-1" /> {st.label}
                      </Badge>
                    </div>
                    {c.erro_mensagem && (
                      <p className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded p-2">
                        {c.erro_mensagem}
                      </p>
                    )}
                    <div className="text-[11px] text-muted-foreground space-y-0.5">
                      <p>Frequência: cada {c.frequencia_horas}h</p>
                      <p>
                        Última sync:{" "}
                        {c.ultima_sincronizacao
                          ? format(new Date(c.ultima_sincronizacao), "dd/MM/yyyy HH:mm", { locale: ptBR })
                          : "—"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => sincronizar.mutate(c)}
                        disabled={sincronizar.isPending}
                      >
                        {sincronizar.isPending ? (
                          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                        )}
                        Sincronizar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Remover conexão com ${c.banco_nome}?`)) remover.mutate(c.id);
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </TabsContent>

      <TabsContent value="logs" className="mt-0">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimas 50 sincronizações</CardTitle>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-6">Nenhum registro de sincronização.</div>
            ) : (
              <div className="space-y-1 max-h-[500px] overflow-y-auto">
                {logs.map((l) => {
                  const conexao = conexoes.find((c) => c.id === l.conexao_id);
                  return (
                    <div key={l.id} className="flex items-center justify-between gap-3 p-2 border-b text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{conexao?.banco_nome ?? "—"}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {format(new Date(l.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                          {l.duracao_ms != null && ` · ${l.duracao_ms}ms`}
                        </p>
                        {l.erro && <p className="text-[10px] text-destructive truncate">{l.erro}</p>}
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          l.status === "sucesso"
                            ? "bg-success/10 text-success border-success/30"
                            : l.status === "erro"
                            ? "bg-destructive/10 text-destructive border-destructive/30"
                            : "bg-muted"
                        }
                      >
                        {l.status} · {l.movimentos_novos} mov.
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Dialog Nova Conexão */}
      <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova conexão bancária</DialogTitle>
            <DialogDescription>
              Registre uma nova integração com seu banco. Use <strong>Manual</strong> para organizar contas onde você importa OFX
              periodicamente. Provedores Pluggy/Belvo permitem sincronização automática (requer credenciais).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Provedor</Label>
              <Select value={provedor} onValueChange={(v) => setProvedor(v as typeof provedor)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual (importação OFX)</SelectItem>
                  <SelectItem value="pluggy">Pluggy (Open Finance)</SelectItem>
                  <SelectItem value="belvo">Belvo (Open Finance)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Banco</Label>
              <Select value={bancoCodigo} onValueChange={setBancoCodigo}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {BANCOS_BR.map((b) => (
                    <SelectItem key={b.codigo} value={b.codigo}>
                      {b.codigo} · {b.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Conta vinculada (opcional)</Label>
              <Select value={contaId} onValueChange={setContaId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {contas.filter((c) => c.ativa).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Frequência de sincronização (horas)</Label>
              <Input type="number" min={1} max={168} value={frequencia} onChange={(e) => setFrequencia(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoOpen(false)}>Cancelar</Button>
            <Button onClick={() => criar.mutate()} disabled={criar.isPending || !bancoCodigo}>
              {criar.isPending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              Criar conexão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}
