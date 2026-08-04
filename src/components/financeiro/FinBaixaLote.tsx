import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCheck, Loader2, Search } from "lucide-react";
import { useContas, useEmpresaId } from "@/hooks/useFinanceiro";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

type Tipo = "a_pagar" | "a_receber";

export default function FinBaixaLote() {
  const empresaId = useEmpresaId();
  const qc = useQueryClient();
  const { data: contas = [] } = useContas();
  const [tipo, setTipo] = useState<Tipo>("a_pagar");
  const [busca, setBusca] = useState("");
  const [contaPadrao, setContaPadrao] = useState<string>("");
  const [dataPadrao, setDataPadrao] = useState<string>(new Date().toISOString().slice(0, 10));
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const { data: pendentes = [], isLoading } = useQuery({
    queryKey: ["fin-baixa-lote-pendentes", empresaId, tipo],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro_lancamentos")
        .select("id, descricao, valor, data_vencimento, data_competencia, status, pessoa_id")
        .eq("empresa_id", empresaId!)
        .eq("tipo", tipo)
        .in("status", ["previsto", "em_atraso"])
        .order("data_vencimento", { ascending: true })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return pendentes;
    return pendentes.filter((l) => l.descricao.toLowerCase().includes(q));
  }, [busca, pendentes]);

  const toggle = (id: string) => {
    setSelecionados((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selecionados.size === filtrados.length) setSelecionados(new Set());
    else setSelecionados(new Set(filtrados.map((l) => l.id)));
  };

  const totalSelecionado = useMemo(
    () => filtrados.filter((l) => selecionados.has(l.id)).reduce((acc, l) => acc + Number(l.valor), 0),
    [filtrados, selecionados]
  );

  async function handleBaixar() {
    if (selecionados.size === 0 || !contaPadrao) return;
    setSaving(true);
    try {
      const ids = Array.from(selecionados);
      const { error } = await supabase
        .from("financeiro_lancamentos")
        .update({
          status: "realizado",
          data_realizado: dataPadrao,
          conta_id: contaPadrao,
        })
        .in("id", ids);
      if (error) throw error;
      toast.success(`${ids.length} lançamento(s) baixado(s) com sucesso.`);
      setSelecionados(new Set());
      qc.invalidateQueries({ queryKey: ["fin-baixa-lote-pendentes"] });
      qc.invalidateQueries({ queryKey: ["fin-lancamentos"] });
      qc.invalidateQueries({ queryKey: ["fin-resumo-visor"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao baixar em lote");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCheck className="w-5 h-5 text-primary" /> Baixa em lote
            </CardTitle>
            <Tabs value={tipo} onValueChange={(v) => { setTipo(v as Tipo); setSelecionados(new Set()); }}>
              <TabsList>
                <TabsTrigger value="a_pagar">Contas a Pagar</TabsTrigger>
                <TabsTrigger value="a_receber">Contas a Receber</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5 md:col-span-1">
              <Label>Conta para liquidação</Label>
              <Select value={contaPadrao} onValueChange={setContaPadrao}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {contas.filter((c) => c.ativa).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Data da operação</Label>
              <Input type="date" value={dataPadrao} onChange={(e) => setDataPadrao(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input className="pl-8" placeholder="Filtrar descrição..." value={busca} onChange={(e) => setBusca(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="rounded-md border">
            <div className="flex items-center gap-3 p-3 border-b bg-muted/30 text-xs font-medium">
              <Checkbox
                checked={filtrados.length > 0 && selecionados.size === filtrados.length}
                onCheckedChange={toggleAll}
              />
              <span className="flex-1">Descrição</span>
              <span className="w-24 text-right">Vencimento</span>
              <span className="w-32 text-right">Valor</span>
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              {isLoading ? (
                <div className="p-8 text-center text-sm text-muted-foreground"><Loader2 className="w-4 h-4 mx-auto animate-spin" /></div>
              ) : filtrados.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">Nenhum lançamento pendente encontrado.</div>
              ) : (
                filtrados.map((l) => {
                  const checked = selecionados.has(l.id);
                  const atrasado = l.status === "em_atraso";
                  return (
                    <div key={l.id} className="flex items-center gap-3 p-3 border-b hover:bg-muted/20 text-sm">
                      <Checkbox checked={checked} onCheckedChange={() => toggle(l.id)} />
                      <div className="flex-1 min-w-0">
                        <p className="truncate">{l.descricao}</p>
                        {atrasado && <Badge variant="destructive" className="text-xs mt-0.5">Em atraso</Badge>}
                      </div>
                      <span className="w-24 text-right text-xs text-muted-foreground">
                        {l.data_vencimento ? format(new Date(l.data_vencimento + "T00:00:00"), "dd/MM/yyyy") : "—"}
                      </span>
                      <span className="w-32 text-right font-medium tabular-nums">
                        R$ {Number(l.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-3 p-3 rounded-md bg-muted/30">
            <div className="text-sm">
              <span className="text-muted-foreground">Selecionados:</span>{" "}
              <span className="font-semibold">{selecionados.size}</span>
              <span className="text-muted-foreground"> · Total:</span>{" "}
              <span className="font-semibold tabular-nums">
                R$ {totalSelecionado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <Button onClick={handleBaixar} disabled={!contaPadrao || selecionados.size === 0 || saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCheck className="w-4 h-4 mr-2" />}
              Baixar {selecionados.size} lançamento(s)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
