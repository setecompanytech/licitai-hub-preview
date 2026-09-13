import { useState } from "react";
import { hojeLocal } from "@/lib/financeiro/data-local";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, ArrowRightLeft, Loader2 } from "lucide-react";
import { useContas, useEmpresaId } from "@/hooks/useFinanceiro";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export default function FinTransferencia() {
  const empresaId = useEmpresaId();
  const qc = useQueryClient();
  const { data: contas = [], isLoading } = useContas();
  const [origem, setOrigem] = useState<string>("");
  const [destino, setDestino] = useState<string>("");
  const [valor, setValor] = useState<string>("");
  const [data, setData] = useState<string>(hojeLocal());
  const [descricao, setDescricao] = useState<string>("Transferência entre contas");
  const [obs, setObs] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const contasAtivas = contas.filter((c) => c.ativa);
  const contaOrigem = contasAtivas.find((c) => c.id === origem);
  const contaDestino = contasAtivas.find((c) => c.id === destino);
  const valorNum = Number(valor) || 0;

  const podeSalvar = origem && destino && origem !== destino && valorNum > 0 && empresaId;

  async function handleSubmit() {
    if (!podeSalvar) return;
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const usuarioId = userData.user?.id ?? null;
      // Lançamento duplo: 1 transferência (saída) com conta_destino_id apontando para o destino
      const { error } = await supabase.from("financeiro_lancamentos").insert({
        empresa_id: empresaId!,
        tipo: "transferencia",
        natureza: "movimentacao",
        status: "realizado",
        descricao,
        valor: valorNum,
        data_competencia: data,
        data_realizado: data,
        conta_id: origem,
        conta_destino_id: destino,
        origem: "manual",
        origem_tipo: "manual",
        origem_job: "FinTransferencia",
        origem_usuario_id: usuarioId,
        origem_timestamp: new Date().toISOString(),
        origem_metadata: { conta_origem: origem, conta_destino: destino },
        observacoes: obs || null,
      });
      if (error) throw error;
      toast.success("Transferência registrada com sucesso.");
      qc.invalidateQueries({ queryKey: ["fin-lancamentos"] });
      qc.invalidateQueries({ queryKey: ["fin-contas"] });
      qc.invalidateQueries({ queryKey: ["fin-resumo-visor"] });
      setValor("");
      setObs("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao transferir");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-muted-foreground" /> Transferência entre contas
          </CardTitle>
          <CardDescription>
            Movimente saldo entre contas correntes. O sistema registra automaticamente uma única operação tipo "transferência" que afeta as duas contas — sem dupla contagem no DRE.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="transf-origem">Conta de origem</Label>
              <Select value={origem} onValueChange={setOrigem} disabled={isLoading}>
                <SelectTrigger id="transf-origem"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {contasAtivas.map((c) => (
                    <SelectItem key={c.id} value={c.id} disabled={c.id === destino}>
                      {c.nome} {c.banco_nome ? `· ${c.banco_nome}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {contaOrigem && (
                <p className="text-xs text-muted-foreground">
                  Saldo atual: <span className="font-medium text-foreground tabular-nums">R$ {Number(contaOrigem.saldo_atual).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="transf-destino">Conta de destino</Label>
              <Select value={destino} onValueChange={setDestino} disabled={isLoading}>
                <SelectTrigger id="transf-destino"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {contasAtivas.map((c) => (
                    <SelectItem key={c.id} value={c.id} disabled={c.id === origem}>
                      {c.nome} {c.banco_nome ? `· ${c.banco_nome}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {contaDestino && (
                <p className="text-xs text-muted-foreground">
                  Saldo atual: <span className="font-medium text-foreground tabular-nums">R$ {Number(contaDestino.saldo_atual).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="transf-valor">Valor (R$)</Label>
              <Input id="transf-valor" type="number" step="0.01" min="0" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" className="tabular-nums" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="transf-data">Data</Label>
              <Input id="transf-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="transf-descricao">Descrição</Label>
            <Input id="transf-descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="transf-obs">Observações (opcional)</Label>
            <Textarea id="transf-obs" value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
          </div>

          {contaOrigem && valorNum > Number(contaOrigem.saldo_atual) && (
            <Alert variant="warning">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>
                Atenção: o valor informado é maior que o saldo atual da conta de origem. A transferência ficará permitida, mas a conta ficará negativa.
              </AlertDescription>
            </Alert>
          )}

          <Button className="w-full" onClick={handleSubmit} disabled={!podeSalvar || saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
            Registrar transferência
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
