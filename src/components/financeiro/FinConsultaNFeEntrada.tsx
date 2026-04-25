import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Inbox, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { toast } from "sonner";

type ManifestacaoRow = {
  id: string;
  chave_nfe: string;
  tipo: string;
  motivo: string | null;
  protocolo: string | null;
  data_manifestacao: string;
  automatica: boolean | null;
};

const TIPO_LABEL: Record<string, string> = {
  ciencia: "Ciência da Operação",
  confirmacao: "Confirmação da Operação",
  desconhecimento: "Desconhecimento",
  nao_realizada: "Operação Não Realizada",
};

const TIPO_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ciencia: "secondary",
  confirmacao: "default",
  desconhecimento: "destructive",
  nao_realizada: "destructive",
};

export default function FinConsultaNFeEntrada() {
  const { empresaAtiva } = useEmpresa();
  const [chaveNfe, setChaveNfe] = useState("");
  const [tipo, setTipo] = useState<"ciencia" | "confirmacao" | "desconhecimento" | "nao_realizada">("ciencia");
  const [motivo, setMotivo] = useState("");
  const [loading, setLoading] = useState(false);
  const [historico, setHistorico] = useState<ManifestacaoRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const carregar = async () => {
    if (!empresaAtiva) return;
    setLoadingList(true);
    try {
      const { data, error } = await supabase
        .from("financeiro_manifestacoes")
        .select("id, chave_nfe, tipo, motivo, protocolo, data_manifestacao, automatica")
        .eq("empresa_id", empresaAtiva.id)
        .order("data_manifestacao", { ascending: false })
        .limit(50);
      if (error) throw error;
      setHistorico((data || []) as unknown as ManifestacaoRow[]);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => { carregar(); }, [empresaAtiva?.id]);

  const exigeMotivo = tipo === "desconhecimento" || tipo === "nao_realizada";

  const manifestar = async () => {
    if (!empresaAtiva) return toast.error("Selecione uma empresa ativa");
    if (!chaveNfe || chaveNfe.length !== 44) return toast.error("Chave NF-e deve ter 44 dígitos");
    if (exigeMotivo && motivo.trim().length < 15) return toast.error("Motivo obrigatório (mínimo 15 caracteres) para esse tipo de evento");

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manifestacao-destinatario", {
        body: {
          empresa_id: empresaAtiva.id,
          chave_nfe: chaveNfe,
          tipo,
          motivo: motivo || undefined,
        },
      });
      if (error) throw error;
      if (data?.setup_required) {
        toast.warning(data.message || "Configure FOCUS_NFE_API_TOKEN para manifestar.");
        return;
      }
      toast.success(data?.message || "Manifestação registrada");
      setChaveNfe("");
      setMotivo("");
      await carregar();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Alert>
        <AlertCircle className="w-4 h-4" />
        <AlertTitle>Manifestação do Destinatário</AlertTitle>
        <AlertDescription>
          Registre Ciência, Confirmação, Desconhecimento ou Operação Não Realizada para NF-e recebidas.
          Requer <code className="bg-muted px-1 rounded">FOCUS_NFE_API_TOKEN</code> e certificado A1 vinculado ao CNPJ destinatário.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Inbox className="w-5 h-5" /> Nova manifestação</CardTitle>
          <CardDescription>Informe a chave de 44 dígitos da NF-e recebida.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Chave NF-e (44 dígitos)</Label>
              <Input
                value={chaveNfe}
                onChange={e => setChaveNfe(e.target.value.replace(/\D/g, "").slice(0, 44))}
                placeholder="35200107..."
              />
              <p className="text-xs text-muted-foreground mt-1">{chaveNfe.length}/44 dígitos</p>
            </div>
            <div>
              <Label>Tipo de evento</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ciencia">Ciência da Operação</SelectItem>
                  <SelectItem value="confirmacao">Confirmação da Operação</SelectItem>
                  <SelectItem value="desconhecimento">Desconhecimento da Operação</SelectItem>
                  <SelectItem value="nao_realizada">Operação Não Realizada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {exigeMotivo && (
            <div>
              <Label>Motivo (obrigatório — 15 a 255 caracteres)</Label>
              <Input
                value={motivo}
                onChange={e => setMotivo(e.target.value.slice(0, 255))}
                placeholder="Descreva o motivo do desconhecimento ou não realização da operação"
              />
              <p className="text-xs text-muted-foreground mt-1">{motivo.length}/255</p>
            </div>
          )}
          <Button onClick={manifestar} disabled={loading}>
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Registrando...</> : <><CheckCircle2 className="w-4 h-4 mr-2" />Registrar manifestação</>}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de manifestações</CardTitle>
          <CardDescription>Últimas 50 manifestações.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingList ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Carregando...</div>
          ) : historico.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Nenhuma manifestação registrada.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Data</TableHead>
                    <TableHead>Chave NF-e</TableHead>
                    <TableHead className="whitespace-nowrap">Evento</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead className="whitespace-nowrap">Protocolo</TableHead>
                    <TableHead className="whitespace-nowrap">Origem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historico.map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(m.data_manifestacao).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{m.chave_nfe}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant={TIPO_VARIANT[m.tipo] || "secondary"}>
                          {TIPO_LABEL[m.tipo] || m.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{m.motivo || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs">{m.protocolo || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant={m.automatica ? "outline" : "secondary"}>
                          {m.automatica ? "automática" : "manual"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
