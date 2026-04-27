import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Trash2, AlertCircle, Wand2 } from "lucide-react";
import { useCentrosCusto, useRateios, useSalvarRateios, type RateioItem } from "@/hooks/useCentrosCusto";

interface Props {
  lancamentoId: string | null | undefined;
  valorBase: number;
}

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

export default function RateioCentroCustoEditor({ lancamentoId, valorBase }: Props) {
  const { data: centros = [] } = useCentrosCusto(true);
  const { data: rateiosAtuais = [] } = useRateios(lancamentoId);
  const salvar = useSalvarRateios();

  const [itens, setItens] = useState<RateioItem[]>([]);

  useEffect(() => {
    if (rateiosAtuais.length > 0) {
      setItens(
        rateiosAtuais.map((r) => ({
          centro_custo_id: r.centro_custo_id,
          percentual: Number(r.percentual),
          valor: Number(r.valor),
        })),
      );
    } else {
      setItens([]);
    }
  }, [rateiosAtuais]);

  const totalPerc = useMemo(
    () => itens.reduce((s, i) => s + (Number(i.percentual) || 0), 0),
    [itens],
  );
  const totalValor = useMemo(
    () => Math.round(((totalPerc / 100) * valorBase) * 100) / 100,
    [totalPerc, valorBase],
  );

  const adicionar = () => {
    const usados = new Set(itens.map((i) => i.centro_custo_id));
    const disponivel = centros.find((c) => !usados.has(c.id));
    if (!disponivel) return;
    setItens([...itens, { centro_custo_id: disponivel.id, percentual: 0 }]);
  };

  const remover = (idx: number) => setItens(itens.filter((_, i) => i !== idx));

  const atualizar = (idx: number, patch: Partial<RateioItem>) => {
    setItens(itens.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const dividirIgualmente = () => {
    if (itens.length === 0) return;
    const perc = Math.floor((10000 / itens.length)) / 100;
    const ajustado = itens.map((it, i) => ({
      ...it,
      percentual: i === itens.length - 1 ? Math.round((100 - perc * (itens.length - 1)) * 100) / 100 : perc,
    }));
    setItens(ajustado);
  };

  const handleSalvar = async () => {
    if (!lancamentoId) return;
    await salvar.mutateAsync({ lancamentoId, valorBase, itens });
  };

  const semCentros = centros.length === 0;
  const podeAdicionar = itens.length < centros.length;

  if (!lancamentoId) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Salve o lançamento primeiro para poder configurar o rateio entre centros de custo.
        </AlertDescription>
      </Alert>
    );
  }

  if (semCentros) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Nenhum centro de custo cadastrado. Acesse <strong>Centros de Custo</strong> no hub financeiro
          para criá-los antes de configurar rateio.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-sm">Distribuir lançamento entre centros de custo</p>
          <p className="text-xs text-muted-foreground">
            Valor base: <span className="font-medium">{fmtBRL(valorBase)}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={dividirIgualmente} disabled={itens.length === 0}>
            <Wand2 className="w-4 h-4 mr-1.5" /> Dividir igualmente
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={adicionar} disabled={!podeAdicionar}>
            <Plus className="w-4 h-4 mr-1.5" /> Adicionar
          </Button>
        </div>
      </div>

      {itens.length === 0 && (
        <p className="text-sm text-muted-foreground italic py-4 text-center border border-dashed rounded-md">
          Nenhum rateio configurado. Adicione ao menos um centro de custo para começar.
        </p>
      )}

      {itens.map((item, idx) => {
        const valorCalc = Math.round(((item.percentual / 100) * valorBase) * 100) / 100;
        return (
          <div key={idx} className="grid grid-cols-12 gap-2 items-end border rounded-md p-2">
            <div className="col-span-6 space-y-1">
              <Label className="text-xs">Centro de custo</Label>
              <Select
                value={item.centro_custo_id}
                onValueChange={(v) => atualizar(idx, { centro_custo_id: v })}
              >
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {centros.map((c) => (
                    <SelectItem
                      key={c.id}
                      value={c.id}
                      disabled={itens.some((i, j) => j !== idx && i.centro_custo_id === c.id)}
                    >
                      {c.codigo} · {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-3 space-y-1">
              <Label className="text-xs">Percentual (%)</Label>
              <Input
                type="number" step="0.01" min={0.01} max={100}
                value={item.percentual}
                onChange={(e) => atualizar(idx, { percentual: Number(e.target.value) || 0 })}
                className="h-9"
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Valor</Label>
              <Input readOnly value={fmtBRL(valorCalc)} className="h-9 text-right tabular-nums" />
            </div>
            <div className="col-span-1 flex justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={() => remover(idx)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          </div>
        );
      })}

      <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
        <span>Total rateado</span>
        <div className="flex items-center gap-3">
          <span className={`font-semibold ${totalPerc > 100.001 ? "text-destructive" : ""}`}>
            {totalPerc.toFixed(2)}%
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="font-semibold tabular-nums">{fmtBRL(totalValor)}</span>
        </div>
      </div>

      {totalPerc > 100.001 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>A soma dos percentuais não pode ultrapassar 100%.</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end">
        <Button type="button" onClick={handleSalvar} disabled={salvar.isPending || totalPerc > 100.001}>
          {salvar.isPending ? "Salvando..." : "Salvar rateio"}
        </Button>
      </div>
    </div>
  );
}
