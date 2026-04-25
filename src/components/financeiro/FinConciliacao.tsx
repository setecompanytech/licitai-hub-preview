import { useState, useRef } from "react";
import {
  useContas,
  useExtratosImportados,
  useMovimentosExtrato,
  useImportarOFX,
  useConciliarAutomatico,
  useConciliarManual,
  useDesfazerConciliacao,
  useLancamentos,
} from "@/hooks/useFinanceiro";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Upload, Sparkles, Link2, Unlink, Loader2, FileCheck2 } from "lucide-react";
import { formatCurrency, formatDateBR } from "@/lib/financeiro/formatters";

export default function FinConciliacao() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [contaSelecionada, setContaSelecionada] = useState<string>("");
  const [filtroConciliado, setFiltroConciliado] = useState<"todos" | "pendente" | "conciliado">(
    "pendente"
  );
  const [dialogManual, setDialogManual] = useState<{
    movimento_id: string;
    valor: number;
    natureza: "receita" | "despesa";
  } | null>(null);

  const { data: contas } = useContas();
  const { data: extratos } = useExtratosImportados();
  const { data: movimentos, isLoading: loadingMov } = useMovimentosExtrato({
    conta_id: contaSelecionada || undefined,
    conciliado: filtroConciliado === "todos" ? undefined : filtroConciliado === "conciliado",
  });

  const importar = useImportarOFX();
  const conciliarAuto = useConciliarAutomatico();
  const conciliarManual = useConciliarManual();
  const desfazer = useDesfazerConciliacao();

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!contaSelecionada) {
      alert("Selecione uma conta antes de importar.");
      e.target.value = "";
      return;
    }
    const conteudo = await file.text();
    importar.mutate(
      { conta_id: contaSelecionada, arquivo_nome: file.name, conteudo_ofx: conteudo },
      { onSettled: () => (e.target.value = "") }
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-muted-foreground">Conta bancária</label>
            <Select value={contaSelecionada} onValueChange={setContaSelecionada}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma conta" />
              </SelectTrigger>
              <SelectContent>
                {(contas ?? [])
                  .filter((c) => c.tipo === "corrente" || c.tipo === "poupanca" || c.tipo === "caixa")
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-[160px]">
            <label className="text-xs text-muted-foreground">Status</label>
            <Select value={filtroConciliado} onValueChange={(v) => setFiltroConciliado(v as typeof filtroConciliado)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pendente">Pendentes</SelectItem>
                <SelectItem value="conciliado">Conciliados</SelectItem>
                <SelectItem value="todos">Todos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".ofx,.OFX"
            className="hidden"
            onChange={onFile}
          />
          <Button
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={importar.isPending || !contaSelecionada}
          >
            {importar.isPending ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-1.5" />
            )}
            Importar OFX
          </Button>

          <Button
            onClick={() =>
              conciliarAuto.mutate({
                conta_id: contaSelecionada || undefined,
                auto_aplicar: true,
                score_minimo: 75,
              })
            }
            disabled={conciliarAuto.isPending}
          >
            {conciliarAuto.isPending ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-1.5" />
            )}
            Conciliar automaticamente
          </Button>
        </CardContent>
      </Card>

      {/* Histórico de extratos */}
      {(extratos?.length ?? 0) > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Extratos importados (últimos)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {(extratos ?? []).slice(0, 6).map((ex) => (
                <div
                  key={ex.id}
                  className="border rounded-md p-3 text-sm flex items-start justify-between"
                >
                  <div>
                    <div className="font-medium flex items-center gap-1.5">
                      <FileCheck2 className="w-4 h-4 text-primary" />
                      {ex.arquivo_nome}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {ex.conta?.nome ?? "—"} • {ex.total_movimentos ?? 0} mov.
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {ex.data_inicio ? formatDateBR(ex.data_inicio) : "?"} a{" "}
                      {ex.data_fim ? formatDateBR(ex.data_fim) : "?"}
                    </div>
                  </div>
                  <Badge variant={ex.status === "concluido" ? "default" : "secondary"}>
                    {ex.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Movimentos */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Movimentos do extrato</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Conta</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[140px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingMov && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      <Loader2 className="w-4 h-4 inline animate-spin mr-2" />
                      Carregando…
                    </TableCell>
                  </TableRow>
                )}
                {!loadingMov && (movimentos?.length ?? 0) === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum movimento. Importe um arquivo OFX para começar.
                    </TableCell>
                  </TableRow>
                )}
                {(movimentos ?? []).map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDateBR(m.data_movimento)}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{m.descricao}</div>
                      {m.descricao_extra && (
                        <div className="text-xs text-muted-foreground">{m.descricao_extra}</div>
                      )}
                      {m.lancamento && (
                        <div className="text-xs text-primary mt-0.5">
                          → {m.lancamento.descricao}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{m.conta?.nome ?? "—"}</TableCell>
                    <TableCell
                      className={`text-right font-mono ${
                        Number(m.valor) >= 0 ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {formatCurrency(Number(m.valor))}
                    </TableCell>
                    <TableCell>
                      {m.conciliado ? (
                        <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-600">
                          conciliado
                        </Badge>
                      ) : (
                        <Badge variant="secondary">pendente</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {m.conciliado && m.lancamento_id ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            desfazer.mutate({
                              movimento_id: m.id,
                              lancamento_id: m.lancamento_id!,
                            })
                          }
                        >
                          <Unlink className="w-3.5 h-3.5 mr-1" />
                          Desfazer
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setDialogManual({
                              movimento_id: m.id,
                              valor: Math.abs(Number(m.valor)),
                              natureza: Number(m.valor) >= 0 ? "receita" : "despesa",
                            })
                          }
                        >
                          <Link2 className="w-3.5 h-3.5 mr-1" />
                          Vincular
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <DialogVincularManual
        info={dialogManual}
        onClose={() => setDialogManual(null)}
        onConfirm={(lancamento_id) => {
          if (!dialogManual) return;
          conciliarManual.mutate(
            { movimento_id: dialogManual.movimento_id, lancamento_id },
            { onSuccess: () => setDialogManual(null) }
          );
        }}
      />
    </div>
  );
}

// ----------------------------------------------------------------------------

function DialogVincularManual({
  info,
  onClose,
  onConfirm,
}: {
  info: { movimento_id: string; valor: number; natureza: "receita" | "despesa" } | null;
  onClose: () => void;
  onConfirm: (lancamentoId: string) => void;
}) {
  const { data: lancamentos } = useLancamentos({ status: "previsto" });
  if (!info) return null;

  // Sugestão: lançamentos com valor próximo (±10%) e mesma natureza
  const sugeridos = (lancamentos ?? []).filter(
    (l) =>
      l.natureza === info.natureza &&
      Math.abs(Number(l.valor) - info.valor) / info.valor < 0.1
  );
  const outros = (lancamentos ?? []).filter(
    (l) => l.natureza === info.natureza && !sugeridos.includes(l)
  );

  return (
    <Dialog open={!!info} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Vincular a um lançamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {sugeridos.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-1">
                Sugestões (valor próximo)
              </div>
              {sugeridos.map((l) => (
                <button
                  key={l.id}
                  onClick={() => onConfirm(l.id)}
                  className="w-full text-left border rounded-md p-2 hover:bg-accent transition-colors mb-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{l.descricao}</span>
                    <span className="text-sm font-mono">{formatCurrency(Number(l.valor))}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Venc.: {l.data_vencimento ? formatDateBR(l.data_vencimento) : "—"}
                  </div>
                </button>
              ))}
            </div>
          )}
          {outros.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-1">
                Outros lançamentos {info.natureza === "receita" ? "a receber" : "a pagar"}
              </div>
              {outros.slice(0, 30).map((l) => (
                <button
                  key={l.id}
                  onClick={() => onConfirm(l.id)}
                  className="w-full text-left border rounded-md p-2 hover:bg-accent transition-colors mb-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{l.descricao}</span>
                    <span className="text-sm font-mono text-muted-foreground">
                      {formatCurrency(Number(l.valor))}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
          {sugeridos.length === 0 && outros.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-6">
              Nenhum lançamento previsto encontrado para vincular.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
