import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShieldCheck, Cloud, AlertTriangle, FileSearch, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Municipio {
  id: string;
  uf: string;
  codigo_ibge: string;
  municipio: string;
  padrao_nfse: string;
  status: "homologado" | "em_homologacao" | "pendente" | "indisponivel";
  observacoes: string | null;
}

interface Props {
  empresaId?: string | null;
  cnpjEmpresa?: string | null;
  onConcluido?: () => void;
}

const statusBadge: Record<Municipio["status"], "default" | "secondary" | "outline" | "destructive"> = {
  homologado: "default",
  em_homologacao: "secondary",
  pendente: "outline",
  indisponivel: "destructive",
};

const statusLabel: Record<Municipio["status"], string> = {
  homologado: "Homologado",
  em_homologacao: "Em homologação",
  pendente: "Pendente",
  indisponivel: "Indisponível",
};

export default function FinSefazConsulta({ empresaId, cnpjEmpresa, onConcluido }: Props) {
  const [tipo, setTipo] = useState<"nfe" | "nfse">("nfe");
  const [cnpj, setCnpj] = useState(cnpjEmpresa ?? "");
  const [inicio, setInicio] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [fim, setFim] = useState(() => new Date().toISOString().slice(0, 10));
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [municipioCod, setMunicipioCod] = useState<string>("");
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("sefaz_homologacoes_municipais")
        .select("*")
        .order("status", { ascending: true })
        .order("municipio", { ascending: true });
      setMunicipios((data ?? []) as Municipio[]);
    })();
  }, []);

  useEffect(() => { if (cnpjEmpresa && !cnpj) setCnpj(cnpjEmpresa); }, [cnpjEmpresa, cnpj]);

  const carregarLogs = async () => {
    if (!empresaId) return;
    const { data } = await supabase
      .from("sefaz_consultas_log")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false })
      .limit(20);
    setLogs(data ?? []);
  };

  useEffect(() => { carregarLogs();   }, [empresaId]);

  const consultar = async () => {
    if (!empresaId) { toast.error("Selecione uma empresa"); return; }
    const cnpjLimpo = cnpj.replace(/\D/g, "");
    if (cnpjLimpo.length !== 14) { toast.error("CNPJ inválido"); return; }
    if (tipo === "nfse" && !municipioCod) { toast.error("Selecione um município para NFS-e"); return; }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("sefaz-consulta-cnpj", {
        body: {
          empresa_id: empresaId,
          cnpj: cnpjLimpo,
          tipo,
          competencia_inicio: inicio,
          competencia_fim: fim,
          municipio_codigo: tipo === "nfse" ? municipioCod : undefined,
        },
      });
      if (error) throw error;

      if (data?.setup_required) {
        toast.warning(data.message ?? "Configuração necessária");
      } else if (data?.ok) {
        toast.success(`${data.importadas} nota(s) importada(s) — ${data.duplicadas} duplicada(s), ${data.erros} erro(s)`);
        onConcluido?.();
      } else {
        toast.error(data?.error ?? "Falha na consulta");
      }
      await carregarLogs();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao consultar SEFAZ");
    } finally {
      setLoading(false);
    }
  };

  const munSel = municipios.find(m => m.codigo_ibge === municipioCod);

  return (
    <div className="space-y-4">
      <Alert>
        <ShieldCheck className="w-4 h-4" />
        <AlertTitle>Consulta automática por CNPJ via certificado A1</AlertTitle>
        <AlertDescription className="text-xs space-y-1">
          <div>
            Esta integração elimina o upload manual de XMLs ao consultar diretamente a SEFAZ Nacional (NF-e) ou as prefeituras
            (NFS-e). Requer <b>certificado digital A1</b> da empresa cadastrado e, para NFS-e, que o município esteja homologado.
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Cloud className="w-3 h-3" />
            <span>O processamento mTLS é executado por proxy externo seguro (configuração de infra).</span>
          </div>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSearch className="w-4 h-4" /> Nova consulta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v: "nfe" | "nfse") => setTipo(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nfe">NF-e (modelo 55)</SelectItem>
                  <SelectItem value="nfse">NFS-e</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>CNPJ consultante</Label>
              <Input value={cnpj} onChange={e => setCnpj(e.target.value)} placeholder="00.000.000/0001-00" />
            </div>
            <div>
              <Label>Competência início</Label>
              <Input type="date" value={inicio} onChange={e => setInicio(e.target.value)} />
            </div>
            <div>
              <Label>Competência fim</Label>
              <Input type="date" value={fim} onChange={e => setFim(e.target.value)} />
            </div>
          </div>

          {tipo === "nfse" && (
            <div>
              <Label>Município (homologação)</Label>
              <Select value={municipioCod} onValueChange={setMunicipioCod}>
                <SelectTrigger><SelectValue placeholder="Selecione o município" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {municipios.map(m => (
                    <SelectItem key={m.codigo_ibge} value={m.codigo_ibge}>
                      {m.municipio}/{m.uf} — {statusLabel[m.status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {munSel && (
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant={statusBadge[munSel.status]}>{statusLabel[munSel.status]}</Badge>
                  <span>Padrão: <code>{munSel.padrao_nfse}</code></span>
                  {munSel.observacoes && <span>· {munSel.observacoes}</span>}
                </div>
              )}
              {munSel && (munSel.status === "pendente" || munSel.status === "indisponivel") && (
                <Alert variant="destructive" className="mt-2">
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription className="text-xs">
                    Município ainda não homologado. Use o upload manual de XMLs ou solicite homologação ao suporte.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <Button onClick={consultar} disabled={loading || !empresaId}>
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Consultando SEFAZ…</> : "Consultar e importar"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de consultas</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Nenhuma consulta registrada.</div>
          ) : (
            <ScrollArea className="max-h-80">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Encontradas</TableHead>
                    <TableHead className="text-right">Importadas</TableHead>
                    <TableHead>Detalhe</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map(l => (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs">{new Date(l.created_at).toLocaleString("pt-BR")}</TableCell>
                      <TableCell><Badge variant="outline">{l.tipo.toUpperCase()}</Badge></TableCell>
                      <TableCell className="text-xs">{l.competencia_inicio} → {l.competencia_fim}</TableCell>
                      <TableCell>
                        <Badge variant={
                          l.status === "sucesso" ? "default" :
                          l.status === "parcial" ? "secondary" :
                          l.status === "nao_configurado" ? "outline" : "destructive"
                        }>{l.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{l.notas_encontradas ?? 0}</TableCell>
                      <TableCell className="text-right">{l.notas_importadas ?? 0}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[260px] truncate">
                        {l.erro_mensagem ?? `${l.duracao_ms ?? 0}ms`}
                      </TableCell>
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
