import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { hojeLocal } from "@/lib/financeiro/data-local";

/**
 * A data da baixa se PERGUNTA, não se deduz.
 *
 * Três fluxos gravavam datas diferentes sem perguntar nada: o ✓ do Kanban e o
 * da tabela carimbavam HOJE em silêncio; a baixa em lote usava uma "data da
 * operação" genérica. Medido em 01/09/2026, na ETHOS: a carteira de julho
 * inteira conciliada com data de competência — R$ 572.935,64 contados em julho
 * quando o extrato pagou em agosto. O saldo do dia sobrevive; a curva mensal e
 * a conciliação por extrato viram ficção.
 *
 * A data que vale é a do EXTRATO — o dia em que o dinheiro de fato saiu ou
 * entrou. Hoje é só o palpite inicial do campo.
 */
export function DataDaBaixaDialog({
  aberto,
  tipo,
  quantidade,
  onConfirmar,
  onFechar,
}: {
  aberto: boolean;
  tipo: "a_pagar" | "a_receber";
  /** Quantos lançamentos a baixa cobre (1 = individual). */
  quantidade: number;
  onConfirmar: (data: string) => void | Promise<void>;
  onFechar: () => void;
}) {
  const [data, setData] = useState(hojeLocal());
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    if (aberto) {
      setData(hojeLocal());
      setSalvando(false);
    }
  }, [aberto]);

  const confirmar = async () => {
    if (!data || salvando) return;
    setSalvando(true);
    try {
      await onConfirmar(data);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(v) => { if (!v) onFechar(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {quantidade > 1
              ? `Baixar ${quantidade} lançamentos`
              : "Baixar lançamento"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="data-da-baixa">
            {tipo === "a_pagar" ? "Pago em" : "Recebido em"}
          </Label>
          <Input
            id="data-da-baixa"
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") confirmar(); }}
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            Use a data do extrato — o dia em que o dinheiro de fato{" "}
            {tipo === "a_pagar" ? "saiu da" : "entrou na"} conta. Com outra
            data, o lançamento conta no mês errado.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={salvando || !data}>
            Confirmar baixa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
