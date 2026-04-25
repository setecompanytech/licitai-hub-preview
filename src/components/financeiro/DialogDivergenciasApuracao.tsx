import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, CheckCircle2, Download, Loader2 } from "lucide-react";
import type { DivergenciaApuracao } from "@/hooks/useValidacaoApuracao";

const fmt = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  divergencias: DivergenciaApuracao[] | null;
  validando: boolean;
  onExportar: () => void;
}

export function DialogDivergenciasApuracao({ open, onOpenChange, divergencias, validando, onExportar }: Props) {
  const total = divergencias?.length ?? 0;
  const altas = divergencias?.filter(d => d.severidade === "alta").length ?? 0;
  const medias = divergencias?.filter(d => d.severidade === "media").length ?? 0;

  function badgeVariant(sev: DivergenciaApuracao["severidade"]) {
    return sev === "alta" ? "destructive" : sev === "media" ? "secondary" : "outline";
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {validando ? <Loader2 className="w-5 h-5 animate-spin" /> :
              total === 0 ? <CheckCircle2 className="w-5 h-5 text-success" /> :
              <AlertTriangle className="w-5 h-5 text-warning" />}
            Validação contra plano de contas
          </DialogTitle>
          <DialogDescription>
            {validando ? "Comparando bases da apuração com os lançamentos realizados no plano de contas..."
              : total === 0 ? "Nenhuma divergência relevante encontrada. Exportação liberada."
              : `${total} divergência(s) detectada(s) — ${altas} alta(s), ${medias} média(s). Revise antes de exportar.`}
          </DialogDescription>
        </DialogHeader>

        {!validando && total > 0 && (
          <ScrollArea className="max-h-[55vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Competência</TableHead>
                  <TableHead>Campo</TableHead>
                  <TableHead className="text-right">Apuração</TableHead>
                  <TableHead className="text-right">Plano contas</TableHead>
                  <TableHead className="text-right">Diferença</TableHead>
                  <TableHead>Sev.</TableHead>
                  <TableHead>Observação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {divergencias!.map((d, i) => (
                  <TableRow key={i}>
                    <TableCell className="whitespace-nowrap">{d.competencia.slice(0, 7)}</TableCell>
                    <TableCell>{d.campo}</TableCell>
                    <TableCell className="text-right">{d.campo.includes("classificação") ? "—" : fmt(d.valor_apurado)}</TableCell>
                    <TableCell className="text-right">{d.campo.includes("classificação") ? `${d.valor_plano} item(ns)` : fmt(d.valor_plano)}</TableCell>
                    <TableCell className={`text-right font-medium ${d.diferenca > 0 ? "text-destructive" : "text-warning"}`}>
                      {d.campo.includes("classificação") ? "—" : `${d.diferenca > 0 ? "+" : ""}${fmt(d.diferenca)}`}
                      {d.diferenca_perc > 0 && <div className="text-xs text-muted-foreground">{d.diferenca_perc.toFixed(2)}%</div>}
                    </TableCell>
                    <TableCell><Badge variant={badgeVariant(d.severidade)}>{d.severidade}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{d.observacao}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={validando}>Cancelar</Button>
          <Button onClick={onExportar} disabled={validando} variant={altas > 0 ? "destructive" : "default"}>
            <Download className="w-4 h-4 mr-1.5" />
            {altas > 0 ? "Exportar mesmo assim" : "Exportar CSV"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
