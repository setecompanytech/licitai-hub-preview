import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileX, FileCheck2, Loader2, RefreshCw, Info, ShieldCheck } from "lucide-react";
import { useImportacaoNotas, type ResultadoImportacao } from "@/hooks/useImportacaoNotas";
import { useEmpresa } from "@/contexts/EmpresaContext";
import FinSefazConsulta from "./FinSefazConsulta";

const fmt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

interface Props {
  onImportacaoConcluida?: () => void;
}

export default function FinImportarNotas({ onImportacaoConcluida }: Props) {
  const { empresaAtiva } = useEmpresa();
  const { importar, importando, listarRecentes } = useImportacaoNotas();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [ultimoLote, setUltimoLote] = useState<ResultadoImportacao[] | null>(null);
  const [recentes, setRecentes] = useState<any[]>([]);

  const carregarRecentes = useCallback(async () => {
    setRecentes(await listarRecentes(20));
  }, [listarRecentes]);

  useEffect(() => { carregarRecentes(); }, [carregarRecentes]);

  async function processar(files: File[]) {
    const xmls = files.filter(f => f.name.toLowerCase().endsWith(".xml"));
    if (xmls.length === 0) return;
    const r = await importar(xmls);
    if (r) {
      setUltimoLote(r.resultados);
      await carregarRecentes();
      onImportacaoConcluida?.();
    }
  }

  return (
    <Tabs defaultValue="upload" className="space-y-4">
      <TabsList>
        <TabsTrigger value="upload">
          <Upload className="w-4 h-4 mr-2" />Upload manual de XMLs
        </TabsTrigger>
        <TabsTrigger value="sefaz">
          <ShieldCheck className="w-4 h-4 mr-2" />Consulta SEFAZ por CNPJ (A1)
        </TabsTrigger>
      </TabsList>

      <TabsContent value="upload" className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Importação automática de notas fiscais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => {
              e.preventDefault(); setDragOver(false);
              processar(Array.from(e.dataTransfer.files));
            }}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
            }`}
          >
            {importando ? (
              <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin" />
                Processando XMLs e gerando lançamentos...
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-8 h-8 text-muted-foreground" />
                <div className="text-sm font-medium">Arraste seus XMLs aqui ou clique para selecionar</div>
                <div className="text-xs text-muted-foreground">
                  NF-e (modelo 55) e NFS-e (padrão ABRASF) — até 50 arquivos, 5 MB cada
                </div>
              </div>
            )}
            <input
              ref={inputRef} type="file" accept=".xml,application/xml,text/xml"
              multiple className="hidden"
              onChange={e => { if (e.target.files) processar(Array.from(e.target.files)); e.target.value = ""; }}
            />
          </div>

          <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground flex gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              O sistema detecta automaticamente se a nota é de <b>entrada</b> (despesa) ou <b>saída</b> (receita) comparando o CNPJ do
              emitente/destinatário com o CNPJ da empresa ativa. NF-e vira lançamento de comércio; NFS-e vira lançamento de serviço.
              Apurações tributárias da competência são marcadas como <b>desatualizadas</b> automaticamente.
            </div>
          </div>
        </CardContent>
      </Card>

      {ultimoLote && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resultado do último lote</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-72">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Arquivo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Direção</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Detalhe</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ultimoLote.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs max-w-[260px] truncate">{r.nome}</TableCell>
                      <TableCell>{r.tipo?.toUpperCase() ?? "—"}</TableCell>
                      <TableCell>{r.direcao ?? "—"}</TableCell>
                      <TableCell className="text-right">{r.valor ? fmt(r.valor) : "—"}</TableCell>
                      <TableCell>
                        <Badge variant={
                          r.status === "processada" ? "default" :
                          r.status === "duplicada" ? "secondary" : "destructive"
                        }>
                          {r.status === "processada" && <FileCheck2 className="w-3 h-3 mr-1" />}
                          {r.status === "erro" && <FileX className="w-3 h-3 mr-1" />}
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.erro ?? r.competencia ?? r.chave ?? ""}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Notas processadas recentemente</span>
            <Button size="sm" variant="ghost" onClick={carregarRecentes}>
              <RefreshCw className="w-3 h-3 mr-1" />Atualizar
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentes.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Nenhuma nota importada ainda.</div>
          ) : (
            <ScrollArea className="max-h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Emissão</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Nº</TableHead>
                    <TableHead>Contraparte</TableHead>
                    <TableHead>Direção</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentes.map(n => (
                    <TableRow key={n.id}>
                      <TableCell className="text-xs">{n.data_emissao}</TableCell>
                      <TableCell><Badge variant="outline">{n.tipo.toUpperCase()}</Badge></TableCell>
                      <TableCell className="text-xs">{n.numero}/{n.serie ?? "—"}</TableCell>
                      <TableCell className="text-xs max-w-[280px] truncate">
                        {n.direcao === "saida" ? n.nome_destinatario : n.nome_emitente}
                      </TableCell>
                      <TableCell>
                        <Badge variant={n.direcao === "saida" ? "default" : "secondary"}>
                          {n.direcao}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">{fmt(Number(n.valor_total))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
