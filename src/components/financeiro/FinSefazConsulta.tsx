import { useEffect, useState } from "react";
import { hojeLocal } from "@/lib/financeiro/data-local";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import EstadoVazio from "@/components/shared/EstadoVazio";
import { ShieldCheck, Cloud, AlertTriangle, FileSearch, Loader2, History } from "lucide-react";
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

type VarianteBadge = "success" | "warning" | "danger" | "info" | "muted";

const statusBadge: Record<Municipio["status"], VarianteBadge> = {
  homologado: "success",
  em_homologacao: "warning",
  pendente: "muted",
  indisponivel: "danger",
};

const statusLabel: Record<Municipio["status"], string> = {
  homologado: "Homologado",
  em_homologacao: "Em homologação",
  pendente: "Pendente",
  indisponivel: "Indisponível",
};

/** Status do log de consulta → família semântica (a cor é reforço; o texto fica). */
const logBadge = (status: string): VarianteBadge =>
  status === "sucesso" ? "success"
    : status === "parcial" ? "warning"
    : status === "nao_configurado" ? "muted"
    : "danger";

export default function FinSefazConsulta({ empresaId, cnpjEmpresa, onConcluido }: Props) {
  const [tipo, setTipo] = useState<"nfe" | "nfse">("nfe");
  const [cnpj, setCnpj] = useState(cnpjEmpresa ?? "");
  const [inicio, setInicio] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [fim, setFim] = useState(() => hojeLocal());
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
  const cnpjInvalido = cnpj.trim().length > 0 && cnpj.replace(/\D/g, "").length !== 14;

  return (
    <div className="space-y-4">
      <Alert variant="info">
        <ShieldCheck className="w-4 h-4" />
        <AlertTitle>Consulta automática por CNPJ via certificado A1</AlertTitle>
        <AlertDescription className="space-y-2">
          <p>
            Esta integração elimina o upload manual de XMLs ao consultar diretamente a SEFAZ Nacional (NF-e) ou as prefeituras
            (NFS-e). Requer <b>certificado digital A1</b> da empresa cadastrado e, para NFS-e, que o município esteja homologado.
          </p>
          <p className="flex items-center gap-2">
            <Cloud className="w-4 h-4 shrink-0" />
            <span>O processamento mTLS é executado por proxy externo seguro (configuração de infra).</span>
          </p>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSearch className="w-5 h-5" /> Nova consulta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="sefaz-tipo">Tipo</Label>
              <Select value={tipo} onValueChange={(v: "nfe" | "nfse") => setTipo(v)}>
                <SelectTrigger id="sefaz-tipo"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nfe">NF-e (modelo 55)</SelectItem>
                  <SelectItem value="nfse">NFS-e</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sefaz-cnpj">CNPJ consultante</Label>
              <Input
                id="sefaz-cnpj"
                value={cnpj}
                onChange={e => setCnpj(e.target.value)}
                placeholder="00.000.000/0001-00"
                aria-invalid={cnpjInvalido || undefined}
                aria-describedby={cnpjInvalido ? "sefaz-cnpj-erro" : undefined}
              />
              {cnpjInvalido && (
                <p id="sefaz-cnpj-erro" className="text-xs text-destructive-ink">CNPJ inválido — informe os 14 dígitos.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sefaz-inicio">Competência início</Label>
              <Input id="sefaz-inicio" type="date" value={inicio} onChange={e => setInicio(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sefaz-fim">Competência fim</Label>
              <Input id="sefaz-fim" type="date" value={fim} onChange={e => setFim(e.target.value)} />
            </div>
          </div>

          {tipo === "nfse" && (
            <div className="space-y-1.5">
              <Label htmlFor="sefaz-municipio">Município (homologação)</Label>
              <Select value={municipioCod} onValueChange={setMunicipioCod}>
                <SelectTrigger id="sefaz-municipio"><SelectValue placeholder="Selecione o município" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {municipios.map(m => (
                    <SelectItem key={m.codigo_ibge} value={m.codigo_ibge}>
                      {m.municipio}/{m.uf} — {statusLabel[m.status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {munSel && (
                <div className="flex flex-wrap items-center gap-2 pt-1 text-sm text-muted-foreground">
                  <Badge variant={statusBadge[munSel.status]}>{statusLabel[munSel.status]}</Badge>
                  <span>Padrão: <code>{munSel.padrao_nfse}</code></span>
                  {munSel.observacoes && <span>· {munSel.observacoes}</span>}
                </div>
              )}
              {munSel && (munSel.status === "pendente" || munSel.status === "indisponivel") && (
                <Alert variant="destructive" className="mt-2">
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription>
                    Município ainda não homologado. Use o upload manual de XMLs ou solicite homologação ao suporte.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={consultar} disabled={loading || !empresaId}>
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Consultando SEFAZ…</> : "Consultar e importar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de consultas</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <EstadoVazio
              tamanho="compacto"
              icone={<History />}
              titulo="Nenhuma consulta registrada"
              descricao="As consultas feitas aqui ficam listadas com o resultado de cada importação."
            />
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
                      <TableCell className="whitespace-nowrap">{new Date(l.created_at).toLocaleString("pt-BR")}</TableCell>
                      <TableCell><Badge variant="muted">{l.tipo.toUpperCase()}</Badge></TableCell>
                      <TableCell className="whitespace-nowrap">{l.competencia_inicio} → {l.competencia_fim}</TableCell>
                      <TableCell>
                        <Badge variant={logBadge(l.status)}>{l.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{l.notas_encontradas ?? 0}</TableCell>
                      <TableCell className="text-right tabular-nums">{l.notas_importadas ?? 0}</TableCell>
                      <TableCell className="max-w-[260px] truncate text-muted-foreground" title={l.erro_mensagem ?? undefined}>
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
