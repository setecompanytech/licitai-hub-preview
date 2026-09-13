import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileX, FileCheck2, Loader2, RefreshCw, Info, ShieldCheck, FileText } from "lucide-react";
import EstadoVazio from "@/components/shared/EstadoVazio";
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
          <Upload className="w-4 h-4 mr-2" aria-hidden="true" />Upload manual de XMLs
        </TabsTrigger>
        <TabsTrigger value="sefaz">
          <ShieldCheck className="w-4 h-4 mr-2" aria-hidden="true" />Consulta SEFAZ por CNPJ (A1)
        </TabsTrigger>
      </TabsList>

      <TabsContent value="upload" className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
            Importação automática de notas fiscais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            role="button"
            tabIndex={0}
            aria-label="Arraste seus XMLs aqui ou clique para selecionar arquivos"
            aria-busy={importando}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => {
              e.preventDefault(); setDragOver(false);
              processar(Array.from(e.dataTransfer.files));
            }}
            onClick={() => inputRef.current?.click()}
            onKeyDown={e => {
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click(); }
            }}
            className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
              dragOver ? "border-primary bg-primary-tint" : "border-border hover:border-primary"
            }`}
          >
            {importando ? (
              <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin" aria-hidden="true" />
                Processando XMLs e gerando lançamentos...
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-8 h-8 text-muted-foreground" aria-hidden="true" />
                <div className="text-base font-semibold text-foreground">Arraste seus XMLs aqui ou clique para selecionar</div>
                <div className="text-sm text-muted-foreground">
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

          <Alert variant="info">
            <Info className="w-4 h-4" aria-hidden="true" />
            <AlertDescription>
              O sistema detecta automaticamente se a nota é de <b>entrada</b> (despesa) ou <b>saída</b> (receita) comparando o CNPJ do
              emitente/destinatário com o CNPJ da empresa ativa. NF-e vira lançamento de comércio; NFS-e vira lançamento de serviço.
              Apurações tributárias da competência são marcadas como <b>desatualizadas</b> automaticamente.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {ultimoLote && (
        <Card>
          <CardHeader>
            <CardTitle>Resultado do último lote</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-72">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-sm font-semibold">Arquivo</TableHead>
                      <TableHead className="text-sm font-semibold">Tipo</TableHead>
                      <TableHead className="text-sm font-semibold">Direção</TableHead>
                      <TableHead className="text-sm font-semibold text-right">Valor</TableHead>
                      <TableHead className="text-sm font-semibold">Status</TableHead>
                      <TableHead className="text-sm font-semibold">Detalhe</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ultimoLote.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="max-w-[260px] truncate text-sm" title={r.nome}>{r.nome}</TableCell>
                        <TableCell className="text-sm">{r.tipo?.toUpperCase() ?? "—"}</TableCell>
                        <TableCell className="text-sm">{r.direcao ?? "—"}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{r.valor ? fmt(r.valor) : "—"}</TableCell>
                        <TableCell>
                          <Badge variant={
                            r.status === "processada" ? "success" :
                            r.status === "duplicada" ? "muted" : "danger"
                          }>
                            {r.status === "processada" && <FileCheck2 className="w-3 h-3 mr-1" aria-hidden="true" />}
                            {r.status === "erro" && <FileX className="w-3 h-3 mr-1" aria-hidden="true" />}
                            {r.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {r.erro ?? r.competencia ?? r.chave ?? ""}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2">
            <span>Notas processadas recentemente</span>
            <Button size="sm" variant="ghost" onClick={carregarRecentes}>
              <RefreshCw className="w-4 h-4" aria-hidden="true" />Atualizar
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentes.length === 0 ? (
            <EstadoVazio
              tamanho="compacto"
              icone={<FileText />}
              titulo="Nenhuma nota importada ainda"
              descricao="Envie os XMLs acima ou faça a consulta na SEFAZ para ver as notas aqui."
            />
          ) : (
            <ScrollArea className="max-h-96">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-sm font-semibold">Emissão</TableHead>
                      <TableHead className="text-sm font-semibold">Tipo</TableHead>
                      <TableHead className="text-sm font-semibold">Nº</TableHead>
                      <TableHead className="text-sm font-semibold">Contraparte</TableHead>
                      <TableHead className="text-sm font-semibold">Direção</TableHead>
                      <TableHead className="text-sm font-semibold text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentes.map(n => (
                      <TableRow key={n.id}>
                        <TableCell className="text-sm tabular-nums">{n.data_emissao}</TableCell>
                        <TableCell><Badge variant="info">{n.tipo.toUpperCase()}</Badge></TableCell>
                        <TableCell className="text-sm tabular-nums">{n.numero}/{n.serie ?? "—"}</TableCell>
                        <TableCell className="max-w-[280px] truncate text-sm" title={(n.direcao === "saida" ? n.nome_destinatario : n.nome_emitente) ?? undefined}>
                          {n.direcao === "saida" ? n.nome_destinatario : n.nome_emitente}
                        </TableCell>
                        <TableCell>
                          <Badge variant={n.direcao === "saida" ? "success" : "muted"}>
                            {n.direcao}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium tabular-nums">{fmt(Number(n.valor_total))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
      </TabsContent>

      <TabsContent value="sefaz">
        <FinSefazConsulta
          empresaId={empresaAtiva?.id ?? null}
          cnpjEmpresa={empresaAtiva?.cnpj ?? null}
          onConcluido={() => { carregarRecentes(); onImportacaoConcluida?.(); }}
        />
      </TabsContent>
    </Tabs>
  );
}
