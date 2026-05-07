import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRightLeft, Loader2 } from "lucide-react";
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
  const [data, setData] = useState<string>(new Date().toISOString().slice(0, 10));
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
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowRightLeft className="w-5 h-5 text-primary" /> Transferência entre contas
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Movimente saldo entre contas correntes. O sistema registra automaticamente uma única operação tipo "transferência" que afeta as duas contas — sem dupla contagem no DRE.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Conta de origem</Label>
              <Select value={origem} onValueChange={setOrigem} disabled={isLoading}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
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
                  Saldo atual: <span className="font-medium text-foreground">R$ {Number(contaOrigem.saldo_atual).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Conta de destino</Label>
              <Select value={destino} onValueChange={setDestino} disabled={isLoading}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
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
                  Saldo atual: <span className="font-medium text-foreground">R$ {Number(contaDestino.saldo_atual).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" min="0" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
            </div>
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Observações (opcional)</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
          </div>

          {contaOrigem && valorNum > Number(contaOrigem.saldo_atual) && (
            <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-xs">
              ⚠️ Atenção: o valor informado é maior que o saldo atual da conta de origem. A transferência ficará permitida, mas a conta ficará negativa.
            </div>
          )}

          <Button className="w-full" onClick={handleSubmit} disabled={!podeSalvar || saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRightLeft className="w-4 h-4 mr-2" />}
            Registrar transferência
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
