// FinIntegracoesFiscais — Fase 5
// Centraliza: agendamentos SEFAZ por CNPJ, gestão de SPED/DCTFWeb, apuração de impostos.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileSpreadsheet, RefreshCw, Plus, Loader2, Calculator, Building2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

export default function FinIntegracoesFiscais() {
  const { empresaAtiva } = useEmpresa();
  const { toast } = useToast();
  const [agendamentos, setAgendamentos] = useState<any[]>([]);
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
        toast({
          title: "Configuração pendente",
          description: "Configure SEFAZ_PROXY_URL nas Integrações para ativar o pull automático. Importação manual via XML continua disponível.",
        });
      } else {
        toast({ title: "SEFAZ consultado", description: `${resp?.importadas || 0} NF-e importadas.` });
      }
      await carregar();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setPuxando(null);
    }
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="sefaz" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sefaz" className="gap-1.5"><Building2 className="w-4 h-4" /> SEFAZ por CNPJ</TabsTrigger>
          <TabsTrigger value="sped" className="gap-1.5"><FileSpreadsheet className="w-4 h-4" /> SPED / DCTFWeb</TabsTrigger>
          <TabsTrigger value="impostos" className="gap-1.5"><Calculator className="w-4 h-4" /> Apuração de Impostos</TabsTrigger>
        </TabsList>

        <TabsContent value="sefaz">
          <Card>
            <CardHeader>
              <CardTitle>Importação automática NF-e por CNPJ</CardTitle>
              <CardDescription>
                Cada CNPJ cadastrado é consultado periodicamente via DistribuicaoDFe (SEFAZ Nacional), trazendo NF-e emitidas contra ele.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>
                  A consulta SEFAZ exige certificado digital A1 instalado em proxy mTLS externo. Configure <code>SEFAZ_PROXY_URL</code> em Integrações para ativar; importação manual de XML continua sempre disponível.
                </AlertDescription>
              </Alert>

              <div className="flex gap-2">
                <Input
                  placeholder="CNPJ (somente números)"
                  value={novoCnpj}
                  onChange={(e) => setNovoCnpj(e.target.value)}
                  maxLength={18}
                  className="max-w-xs"
                />
                <Button onClick={adicionarAgendamento} className="shrink-0">
                  <Plus className="w-4 h-4 mr-1.5" /> Adicionar CNPJ
                </Button>
              </div>

              {loading ? (
                <div className="py-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
              ) : agendamentos.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nenhum CNPJ agendado.</p>
              ) : (
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
                        <TableCell className="font-mono text-xs whitespace-nowrap">{a.cnpj}</TableCell>
                        <TableCell className="capitalize text-xs">{a.frequencia}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {a.ultima_execucao ? new Date(a.ultima_execucao).toLocaleString("pt-BR") : "—"}
                        </TableCell>
                        <TableCell>
                          {a.ultimo_status ? (
                            <Badge variant="outline" className={
                              a.ultimo_status === "sucesso" ? "bg-success/15 text-success" :
                              a.ultimo_status === "configuracao_pendente" ? "bg-warning/15 text-warning" :
                              "bg-destructive/15 text-destructive"
                            }>{a.ultimo_status}</Badge>
                          ) : <span className="text-xs text-muted-foreground">aguardando</span>}
                        </TableCell>
                        <TableCell className="text-right font-mono">{a.total_importadas || 0}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" disabled={puxando === a.id} onClick={() => puxarAgora(a.id)} className="shrink-0">
                            {puxando === a.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                            Puxar agora
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
                <Alert>
                  <AlertDescription>
                    Nenhum arquivo SPED/DCTFWeb gerado ainda. A geração será disparada conforme seu regime tributário e competências fechadas no módulo de Apuração.
                  </AlertDescription>
                </Alert>
              ) : (
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
                        <TableCell className="text-xs whitespace-nowrap">
                          {SPED_TIPOS.find((t) => t.value === s.tipo)?.label || s.tipo}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {new Date(s.competencia).toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" })}
                        </TableCell>
                        <TableCell><Badge variant="outline" className="capitalize">{s.status}</Badge></TableCell>
                        <TableCell className="text-right font-mono">{s.total_registros || 0}</TableCell>
                        <TableCell className="font-mono text-xs">{s.recibo || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
                <Alert>
                  <AlertDescription>
                    Nenhuma apuração registrada. As apurações são geradas automaticamente ao fechar a competência no módulo de Apuração Fiscal.
                  </AlertDescription>
                </Alert>
              ) : (
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
                      return (
                        <TableRow key={ap.id}>
                          <TableCell className="text-xs whitespace-nowrap">
                            {new Date(ap.competencia).toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" })}
                          </TableCell>
                          <TableCell className="text-xs uppercase">{ap.tributo}</TableCell>
                          <TableCell className="text-right font-mono text-xs">R$ {Number(ap.valor_devido).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-right font-mono text-xs">R$ {Number(ap.valor_pago).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell className={`text-right font-mono text-xs ${Math.abs(div) > 0.01 ? "text-destructive" : "text-success"}`}>
                            R$ {div.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell><Badge variant="outline" className="capitalize">{ap.status}</Badge></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
