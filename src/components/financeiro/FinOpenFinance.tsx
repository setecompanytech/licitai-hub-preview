import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import EstadoVazio from "@/components/shared/EstadoVazio";
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

type VarianteStatus = "success" | "warning" | "danger" | "muted";

const STATUS_VARIANT: Record<string, { label: string; variante: VarianteStatus; icon: typeof CheckCircle2 }> = {
  pendente: { label: "Pendente", variante: "warning", icon: AlertCircle },
  ativa: { label: "Ativa", variante: "success", icon: CheckCircle2 },
  erro: { label: "Erro", variante: "danger", icon: AlertCircle },
  revogada: { label: "Revogada", variante: "muted", icon: AlertCircle },
  expirada: { label: "Expirada", variante: "danger", icon: AlertCircle },
};

/** O selo do log também fala português — o valor cru do banco fica no dado. */
const LOG_STATUS_LABEL: Record<string, string> = {
  sucesso: "Sucesso",
  erro: "Erro",
  parcial: "Parcial",
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
        <TabsTrigger value="conexoes"><Plug className="w-4 h-4 mr-2" aria-hidden="true" />Conexões</TabsTrigger>
        <TabsTrigger value="logs"><Activity className="w-4 h-4 mr-2" aria-hidden="true" />Histórico de sincronizações</TabsTrigger>
      </TabsList>

      <TabsContent value="conexoes" className="mt-0 space-y-4">
        <Alert variant="info">
          <ShieldCheck className="w-4 h-4" aria-hidden="true" />
          <AlertTitle>Open Finance e integração bancária</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            Conecte suas contas bancárias para sincronização automática de extratos e saldos. Suporte a agregadores
            <strong> Pluggy </strong>e<strong> Belvo</strong> (requer credenciais do provedor configuradas como secrets).
            Enquanto a integração API não estiver ativa, use <strong>Importar OFX</strong> ou registre uma <strong>conexão manual</strong> para
            organizar suas contas.
          </AlertDescription>
        </Alert>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-semibold text-foreground">
            {conexoes.length} conexão(ões) configurada(s)
          </h3>
          <Button onClick={() => setNovoOpen(true)} size="sm">
            <Plus className="w-4 h-4" aria-hidden="true" />Nova conexão
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground" role="status">
            <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> Carregando conexões…
          </div>
        ) : conexoes.length === 0 ? (
          <Card>
            <CardContent className="p-0">
              <EstadoVazio
                icone={<Building2 />}
                titulo="Nenhuma conexão bancária configurada"
                descricao="Registre uma conexão manual para organizar suas contas ou conecte um agregador Open Finance."
                acao={
                  <Button onClick={() => setNovoOpen(true)}>
                    <Plus className="w-4 h-4" aria-hidden="true" />Nova conexão
                  </Button>
                }
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {conexoes.map((c) => {
              const st = STATUS_VARIANT[c.status] ?? { label: c.status, variante: "muted" as const, icon: AlertCircle };
              const Icon = st.icon;
              const conta = contas.find((cc) => cc.id === c.conta_id);
              return (
                <Card key={c.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-base font-semibold text-foreground truncate">{c.banco_nome}</p>
                        <p className="text-sm text-muted-foreground">
                          {c.provedor === "manual" ? "Conexão manual" : `Via ${c.provedor.charAt(0).toUpperCase() + c.provedor.slice(1)}`}
                          {conta && ` · ${conta.nome}`}
                        </p>
                      </div>
                      <Badge variant={st.variante} className="gap-1">
                        <Icon className="w-3 h-3" aria-hidden="true" />{st.label}
                      </Badge>
                    </div>
                    {c.erro_mensagem && (
                      <Alert variant="destructive">
                        <AlertCircle className="w-4 h-4" aria-hidden="true" />
                        <AlertDescription>{c.erro_mensagem}</AlertDescription>
                      </Alert>
                    )}
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>Frequência: cada {c.frequencia_horas}h</p>
                      <p>
                        Última sync:{" "}
                        {c.ultima_sincronizacao
                          ? format(new Date(c.ultima_sincronizacao), "dd/MM/yyyy HH:mm", { locale: ptBR })
                          : "—"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => sincronizar.mutate(c)}
                        disabled={sincronizar.isPending}
                      >
                        {sincronizar.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <RefreshCw className="w-4 h-4" aria-hidden="true" />
                        )}
                        Sincronizar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Remover conexão com ${c.banco_nome}`}
                        onClick={() => {
                          if (confirm(`Remover conexão com ${c.banco_nome}?`)) remover.mutate(c.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" aria-hidden="true" />
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
            <CardTitle>Últimas 50 sincronizações</CardTitle>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <EstadoVazio
                icone={<Activity />}
                titulo="Nenhum registro de sincronização"
                descricao="Assim que uma conexão sincronizar, o resultado aparece aqui."
                tamanho="compacto"
              />
            ) : (
              <div className="max-h-96 overflow-y-auto">
                {logs.map((l) => {
                  const conexao = conexoes.find((c) => c.id === l.conexao_id);
                  return (
                    <div key={l.id} className="flex items-center justify-between gap-3 border-b border-border p-3 text-sm last:border-b-0">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground truncate">{conexao?.banco_nome ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(l.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                          {l.duracao_ms != null && ` · ${l.duracao_ms}ms`}
                        </p>
                        {l.erro && <p className="text-xs text-destructive-ink truncate">{l.erro}</p>}
                      </div>
                      <Badge
                        variant={
                          l.status === "sucesso" ? "success" : l.status === "erro" ? "danger" : "muted"
                        }
                      >
                        {LOG_STATUS_LABEL[l.status] ?? l.status} · {l.movimentos_novos} mov.
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
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="of-provedor">Provedor</Label>
              <Select value={provedor} onValueChange={(v) => setProvedor(v as typeof provedor)}>
                <SelectTrigger id="of-provedor"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual (importação OFX)</SelectItem>
                  <SelectItem value="pluggy">Pluggy (Open Finance)</SelectItem>
                  <SelectItem value="belvo">Belvo (Open Finance)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="of-banco">Banco</Label>
              <Select value={bancoCodigo} onValueChange={setBancoCodigo}>
                <SelectTrigger id="of-banco"><SelectValue placeholder="Selecione..." /></SelectTrigger>
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
              <Label htmlFor="of-conta">Conta vinculada (opcional)</Label>
              <Select value={contaId} onValueChange={setContaId}>
                <SelectTrigger id="of-conta"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {contas.filter((c) => c.ativa).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="of-frequencia">Frequência de sincronização (horas)</Label>
              <Input id="of-frequencia" type="number" min={1} max={168} value={frequencia} onChange={(e) => setFrequencia(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoOpen(false)}>Cancelar</Button>
            <Button onClick={() => criar.mutate()} disabled={criar.isPending || !bancoCodigo}>
              {criar.isPending && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              Criar conexão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}
