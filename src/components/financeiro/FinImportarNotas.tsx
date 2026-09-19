import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
          <Upload className="h-4 w-4" aria-hidden="true" />Upload manual de XMLs
        </TabsTrigger>
        <TabsTrigger value="sefaz">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />Consulta SEFAZ por CNPJ (A1)
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
            className={`cursor-pointer rounded-md border border-dashed p-6 text-center transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
              dragOver ? "border-primary bg-primary-tint" : "border-input hover:border-primary hover:bg-primary-tint"
            }`}
          >
            {importando ? (
              <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                {/* A zona É o botão (role="button"): o Loader2 ocupa o ladrilho
                    do ícone de envio, na tinta da ação — sem spinner grande no
                    centro (Design System v3). */}
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-tint text-primary" aria-hidden="true">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </span>
                Processando XMLs e gerando lançamentos...
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground" aria-hidden="true">
                  <Upload className="h-5 w-5" />
                </span>
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
          <CardContent className="p-0">
            {/* A altura máxima vai no scroller que ui/table cria: a rolagem
                (horizontal e vertical) fica presa ao contêiner e o cabeçalho,
                preso ao topo — um segundo contêiner de rolagem em volta
                deixaria o sticky preso ao de dentro. */}
            <div className="[&>div]:max-h-72">
              <Table>
                <TableHeader className="sticky top-0 z-10">
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
                      <TableCell className="max-w-[260px] truncate font-medium" title={r.nome}>{r.nome}</TableCell>
                      <TableCell>{r.tipo?.toUpperCase() ?? "—"}</TableCell>
                      <TableCell>{r.direcao ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">{r.valor ? fmt(r.valor) : "—"}</TableCell>
                      <TableCell>
                        {/* Situação da linha na variante semântica: importada
                            verde, duplicada âmbar, erro vermelho — sempre com
                            o texto que já existia. */}
                        <Badge variant={
                          r.status === "processada" ? "success" :
                          r.status === "duplicada" ? "warning" : "danger"
                        }>
                          {r.status === "processada" && <FileCheck2 className="h-3 w-3" aria-hidden="true" />}
                          {r.status === "erro" && <FileX className="h-3 w-3" aria-hidden="true" />}
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.erro ?? r.competencia ?? r.chave ?? ""}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        {/* A ação de atualizar sai de dentro do h3: título e botão são irmãos
            no cabeçalho, como em todo cartão de seção do sistema. */}
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <CardTitle>Notas processadas recentemente</CardTitle>
          <Button size="sm" variant="ghost" onClick={carregarRecentes}>
            <RefreshCw aria-hidden="true" />Atualizar
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {recentes.length === 0 ? (
            <EstadoVazio
              tamanho="compacto"
              icone={<FileText />}
              titulo="Nenhuma nota importada ainda"
              descricao="Envie os XMLs acima ou faça a consulta na SEFAZ para ver as notas aqui."
            />
          ) : (
            <div className="[&>div]:max-h-96">
              <Table>
                <TableHeader className="sticky top-0 z-10">
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
                      <TableCell className="whitespace-nowrap tabular-nums">{n.data_emissao}</TableCell>
                      {/* Tipo de documento é rótulo neutro, não situação: em
                          cinza, para o azul não disputar com o verde da direção. */}
                      <TableCell><Badge variant="muted">{n.tipo.toUpperCase()}</Badge></TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">{n.numero}/{n.serie ?? "—"}</TableCell>
                      <TableCell className="max-w-[280px] truncate" title={(n.direcao === "saida" ? n.nome_destinatario : n.nome_emitente) ?? undefined}>
                        {n.direcao === "saida" ? n.nome_destinatario : n.nome_emitente}
                      </TableCell>
                      <TableCell>
                        <Badge variant={n.direcao === "saida" ? "success" : "muted"}>
                          {n.direcao}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right font-medium tabular-nums">{fmt(Number(n.valor_total))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
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
