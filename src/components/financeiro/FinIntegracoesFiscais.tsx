// FinIntegracoesFiscais — Fase 5
// Centraliza: agendamentos SEFAZ por CNPJ, gestão de SPED/DCTFWeb, apuração de impostos.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import EstadoVazio from "@/components/shared/EstadoVazio";
import { FileSpreadsheet, RefreshCw, Plus, Loader2, Calculator, Building2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { statusDoCertificadoA1, type StatusDoCertificado } from "@/lib/financeiro/xml-por-chave";
import { motivoDaEdgeFunction } from "@/lib/erro-edge-function";
import { ShieldCheck, Copy } from "lucide-react";

const TRIBUTOS = [
  { value: "icms", label: "ICMS" }, { value: "iss", label: "ISS" },
  { value: "pis", label: "PIS" }, { value: "cofins", label: "COFINS" },
  { value: "irpj", label: "IRPJ" }, { value: "csll", label: "CSLL" },
  { value: "inss", label: "INSS" }, { value: "das", label: "Simples (DAS)" },
  { value: "fgts", label: "FGTS" },
];

const SPED_TIPOS = [
  { value: "sped_fiscal", label: "SPED Fiscal (EFD)" },
  { value: "sped_contribuicoes", label: "SPED Contribuições (EFD-C)" },
  { value: "sped_contabil", label: "SPED Contábil" },
  { value: "ecf", label: "ECF (IRPJ/CSLL)" },
  { value: "ecd", label: "ECD" },
  { value: "dctfweb", label: "DCTFWeb" },
];

/** Último status do agendamento SEFAZ → família semântica (o texto continua visível). */
const statusAgendamento = (status: string): "success" | "warning" | "danger" =>
  status === "sucesso" ? "success" : status === "configuracao_pendente" ? "warning" : "danger";

export default function FinIntegracoesFiscais() {
  const { empresaAtiva } = useEmpresa();
  const { toast } = useToast();
  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  // Certificado A1 (30/09): estado lido pela edge (o cofre é privado), link de envio pelo fluxo que já existe.
  const [certificado, setCertificado] = useState<StatusDoCertificado | null | "carregando">("carregando");
  const [linkDeEnvio, setLinkDeEnvio] = useState<string | null>(null);
  const [gerandoLink, setGerandoLink] = useState(false);
  const [ultimaLeituraDoCert, setUltimaLeituraDoCert] = useState(0);
  const atualizarCertificado = async () => {
    if (!empresaAtiva?.id) return;
    const s = await statusDoCertificadoA1(empresaAtiva.id);
    setCertificado(s);
    setUltimaLeituraDoCert(Date.now());
  };
  useEffect(() => {
    if (!empresaAtiva?.id) return;
    setCertificado("carregando");
    void atualizarCertificado();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaAtiva?.id]);
  // O envio acontece em OUTRA aba (a página do link): enquanto houver link
  // gerado e ainda não houver certificado, o cartão se atualiza sozinho.
  useEffect(() => {
    if (!linkDeEnvio || !empresaAtiva?.id) return;
    if (certificado !== "carregando" && certificado?.tem_certificado) return;
    const id = window.setInterval(() => { void atualizarCertificado(); }, 8000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkDeEnvio, empresaAtiva?.id, certificado]);
  const gerarLinkDeEnvio = async () => {
    if (!empresaAtiva?.id) return;
    setGerandoLink(true);
    try {
      const { data, error } = await supabase.functions.invoke("gerar-link-certificado", { body: { empresa_id: empresaAtiva.id } });
      if (error) throw error;
      if (data?.upload_url) {
        setLinkDeEnvio(String(data.upload_url));
        toast({ title: "Link de envio gerado", description: "Abra o link, escolha o .pfx e informe a senha. Ele também vai por e-mail." });
      } else {
        throw new Error(data?.error ?? "A função não devolveu o link.");
      }
    } catch (e) {
      toast({ title: "Não foi possível gerar o link", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setGerandoLink(false);
    }
  };
  const [speds, setSpeds] = useState<any[]>([]);
  const [apuracoes, setApuracoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [novoCnpj, setNovoCnpj] = useState("");
  const [puxando, setPuxando] = useState<string | null>(null);

  const carregar = async () => {
    if (!empresaAtiva) return;
    setLoading(true);
    const [a, s, ap] = await Promise.all([
      supabase.from("fin_sefaz_agendamentos" as any).select("*").eq("empresa_id", empresaAtiva.id).order("created_at", { ascending: false }),
      supabase.from("fin_sped_arquivos" as any).select("*").eq("empresa_id", empresaAtiva.id).order("competencia", { ascending: false }).limit(50),
      supabase.from("fin_apuracao_impostos" as any).select("*").eq("empresa_id", empresaAtiva.id).order("competencia", { ascending: false }).limit(60),
    ]);
    setAgendamentos((a.data as any[]) || []);
    setSpeds((s.data as any[]) || []);
    setApuracoes((ap.data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, [empresaAtiva?.id]);

  const adicionarAgendamento = async () => {
    if (!empresaAtiva) return;
    const cnpj = novoCnpj.replace(/\D/g, "");
    if (cnpj.length !== 14) {
      toast({ title: "CNPJ inválido", description: "Informe 14 dígitos.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("fin_sefaz_agendamentos" as any).insert({
      empresa_id: empresaAtiva.id, cnpj, frequencia: "diaria",
    });
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Agendamento criado", description: "A próxima execução puxará as últimas NF-e via SEFAZ." });
      setNovoCnpj("");
      await carregar();
    }
  };

  const puxarAgora = async (id: string) => {
    setPuxando(id);
    try {
      const { data, error } = await supabase.functions.invoke("fin-sefaz-nsu-puxar", { body: { agendamento_id: id } });
      if (error) throw error;
      const resp = data as any;
      if (resp?.configuracao_pendente) {
        toast({ title: "Configuração pendente", description: resp?.message ?? "Configure o certificado A1 e o proxy da SEFAZ (cartão acima)." });
      } else if (resp?.ok === false) {
        toast({ title: "A SEFAZ não foi consultada", description: resp?.message ?? resp?.erro ?? "Veja o motivo na coluna Status.", variant: "destructive" });
      } else {
        toast({ title: "SEFAZ consultado", description: `${resp?.importadas || 0} NF-e importadas.` });
      }
      await carregar();
    } catch (e: any) {
      const motivo = (await motivoDaEdgeFunction(e)) ?? e?.message;
      toast({ title: "Erro ao consultar a SEFAZ", description: motivo, variant: "destructive" });
      await carregar();
      return;
    } finally {
      setPuxando(null);
    }
  };

  const cnpjInvalido = novoCnpj.trim().length > 0 && novoCnpj.replace(/\D/g, "").length !== 14;

  return (
    <div className="space-y-4">
      <Tabs defaultValue="sefaz" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sefaz"><Building2 className="h-4 w-4" aria-hidden="true" />SEFAZ por CNPJ</TabsTrigger>
          <TabsTrigger value="sped"><FileSpreadsheet className="h-4 w-4" aria-hidden="true" />SPED / DCTFWeb</TabsTrigger>
          <TabsTrigger value="impostos"><Calculator className="h-4 w-4" aria-hidden="true" />Apuração de Impostos</TabsTrigger>
        </TabsList>

        <TabsContent value="sefaz" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" aria-hidden="true" />Certificado digital A1</CardTitle>
              <CardDescription>
                É com ele que o sistema fala com a SEFAZ: busca o XML de uma NF-e pela chave e puxa as notas emitidas contra a empresa.
                O arquivo .pfx fica no cofre privado e a senha, cifrada; nenhum dos dois volta ao navegador.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {certificado === "carregando" ? (
                <Skeleton className="h-5 w-72" />
              ) : certificado?.tem_certificado ? (
                <p className="text-sm text-foreground">
                  <Badge variant="success" className="mr-2">Enviado</Badge>
                  {certificado.arquivo}{certificado.enviado_em ? ` · ${new Date(certificado.enviado_em).toLocaleDateString("pt-BR")}` : ""}
                  {!certificado.com_senha && <span className="ml-2 text-warning-ink">sem a senha guardada — envie de novo</span>}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground"><Badge variant="warning" className="mr-2">Sem certificado</Badge>Envie o .pfx da empresa pelo link abaixo.</p>
              )}
              {certificado !== "carregando" && (
                <p className="text-xs text-muted-foreground">
                  Proxy da SEFAZ: {certificado?.proxy_configurado
                    ? <span className="text-success-ink">configurado</span>
                    : <span className="text-warning-ink">{certificado?.proxy_motivo ?? "não configurado (SEFAZ_PROXY_URL e SEFAZ_PROXY_TOKEN nas edge functions — ver services/sefaz-proxy/README.md)"}</span>}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={() => void gerarLinkDeEnvio()} disabled={gerandoLink}>
                  {gerandoLink ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
                  {certificado && certificado !== "carregando" && certificado.tem_certificado ? "Enviar outro certificado" : "Gerar link de envio"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void atualizarCertificado()} title={ultimaLeituraDoCert ? `Lido às ${new Date(ultimaLeituraDoCert).toLocaleTimeString("pt-BR")}` : undefined}>
                  <RefreshCw aria-hidden="true" />Atualizar
                </Button>
                {linkDeEnvio && (
                  <>
                    <a href={linkDeEnvio} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline-offset-2 hover:underline">Abrir a página de envio</a>
                    <Button size="sm" variant="ghost" onClick={() => { void navigator.clipboard?.writeText(linkDeEnvio); toast({ title: "Link copiado" }); }}>
                      <Copy aria-hidden="true" />Copiar link
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Importação automática NF-e por CNPJ</CardTitle>
              <CardDescription>
                Cada CNPJ cadastrado é consultado periodicamente via DistribuicaoDFe (SEFAZ Nacional), trazendo NF-e emitidas contra ele.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="warning">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                <AlertDescription>
                  A consulta à SEFAZ usa o certificado A1 acima e o proxy mTLS do Praefectus (<code className="rounded bg-muted px-1">services/sefaz-proxy</code>). Sem os dois, a importação manual de XML continua disponível.
                </AlertDescription>
              </Alert>

              <div className="space-y-1.5">
                <Label htmlFor="sefaz-novo-cnpj">CNPJ a monitorar</Label>
                <div className="flex flex-wrap items-start gap-2">
                  <Input
                    id="sefaz-novo-cnpj"
                    placeholder="CNPJ (somente números)"
                    value={novoCnpj}
                    onChange={(e) => setNovoCnpj(e.target.value)}
                    maxLength={18}
                    className="max-w-xs"
                    aria-invalid={cnpjInvalido || undefined}
                    aria-describedby={cnpjInvalido ? "sefaz-novo-cnpj-erro" : undefined}
                  />
                  <Button onClick={adicionarAgendamento} className="shrink-0">
                    <Plus aria-hidden="true" />Adicionar CNPJ
                  </Button>
                </div>
                {cnpjInvalido && (
                  <p id="sefaz-novo-cnpj-erro" className="text-xs text-destructive-ink">CNPJ inválido — informe 14 dígitos.</p>
                )}
              </div>

              {loading ? (
                // Espera na forma da tabela — linhas de 48px —, não um spinner
                // no centro (Design System v3).
                <div role="status" aria-label="Carregando agendamentos" className="overflow-hidden rounded-lg border border-border">
                  <div className="flex flex-col gap-px bg-border">
                    {Array.from({ length: 3 }, (_, i) => (
                      <div key={i} className="flex items-center gap-4 bg-card px-4 py-3">
                        <Skeleton className="h-4 w-36" />
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="ml-auto h-4 w-24" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : agendamentos.length === 0 ? (
                <EstadoVazio
                  tamanho="compacto"
                  icone={<Building2 />}
                  titulo="Nenhum CNPJ agendado"
                  descricao="Adicione um CNPJ acima para que a SEFAZ seja consultada periodicamente por notas emitidas contra ele."
                />
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>CNPJ</TableHead>
                        <TableHead>Frequência</TableHead>
                        <TableHead>Última execução</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Importadas</TableHead>
                        <TableHead className="text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {agendamentos.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="font-mono whitespace-nowrap">{a.cnpj}</TableCell>
                          <TableCell className="capitalize">{a.frequencia}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            {a.ultima_execucao ? new Date(a.ultima_execucao).toLocaleString("pt-BR") : "—"}
                          </TableCell>
                          <TableCell>
                            {a.ultimo_status ? (
                              <Badge variant={statusAgendamento(a.ultimo_status)}>{a.ultimo_status}</Badge>
                            ) : <Badge variant="warning">aguardando</Badge>}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{a.total_importadas || 0}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" disabled={puxando === a.id} onClick={() => puxarAgora(a.id)} className="shrink-0">
                              {puxando === a.id ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
                              Puxar agora
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sped">
          <Card>
            <CardHeader>
              <CardTitle>SPED, ECF, ECD e DCTFWeb</CardTitle>
              <CardDescription>
                Histórico de arquivos fiscais gerados, transmitidos e retificados. A geração é executada por edge functions especializadas (uma por leiaute).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {speds.length === 0 ? (
                <EstadoVazio
                  tamanho="compacto"
                  icone={<FileSpreadsheet />}
                  titulo="Nenhum arquivo SPED/DCTFWeb gerado ainda"
                  descricao="A geração será disparada conforme seu regime tributário e as competências fechadas no módulo de Apuração."
                />
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Competência</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Registros</TableHead>
                        <TableHead>Recibo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {speds.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="whitespace-nowrap">
                            {SPED_TIPOS.find((t) => t.value === s.tipo)?.label || s.tipo}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {new Date(s.competencia).toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" })}
                          </TableCell>
                          <TableCell><Badge variant="muted" className="capitalize">{s.status}</Badge></TableCell>
                          <TableCell className="text-right tabular-nums">{s.total_registros || 0}</TableCell>
                          <TableCell className="font-mono">{s.recibo || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="impostos">
          <Card>
            <CardHeader>
              <CardTitle>Apuração e Conciliação de Impostos</CardTitle>
              <CardDescription>
                Cruzamento entre valor apurado (NF-e + folha), valor declarado (DCTFWeb/SPED) e valor pago (financeiro).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {apuracoes.length === 0 ? (
                <EstadoVazio
                  tamanho="compacto"
                  icone={<Calculator />}
                  titulo="Nenhuma apuração registrada"
                  descricao="As apurações são geradas automaticamente ao fechar a competência no módulo de Apuração Fiscal."
                />
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Competência</TableHead>
                        <TableHead>Tributo</TableHead>
                        <TableHead className="text-right">Devido</TableHead>
                        <TableHead className="text-right">Pago</TableHead>
                        <TableHead className="text-right">Divergência</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {apuracoes.map((ap) => {
                        const div = Number(ap.divergencia || 0);
                        const divergente = Math.abs(div) > 0.01;
                        return (
                          <TableRow key={ap.id}>
                            <TableCell className="whitespace-nowrap">
                              {new Date(ap.competencia).toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" })}
                            </TableCell>
                            <TableCell className="uppercase">{ap.tributo}</TableCell>
                            <TableCell className="text-right tabular-nums">R$ {Number(ap.valor_devido).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell className="text-right tabular-nums">R$ {Number(ap.valor_pago).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell className={`text-right tabular-nums font-semibold ${divergente ? "text-destructive-ink" : "text-success-ink"}`}>
                              R$ {div.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell><Badge variant="muted" className="capitalize">{ap.status}</Badge></TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
