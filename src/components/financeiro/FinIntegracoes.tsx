import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Banknote, FileSearch, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function FinIntegracoes() {
  const [pluggyLoading, setPluggyLoading] = useState(false);
  const [pluggyStatus, setPluggyStatus] = useState<"unknown" | "configured" | "missing">("unknown");
  const [chaveNfe, setChaveNfe] = useState("");
  const [cnpjEmitente, setCnpjEmitente] = useState("");
  const [nfeResult, setNfeResult] = useState<any>(null);
  const [nfeLoading, setNfeLoading] = useState(false);

  const testarPluggy = async () => {
    setPluggyLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("pluggy-sync", { body: { action: "create_connect_token" } });
      if (error) throw error;
      if (data?.setup_required) {
        setPluggyStatus("missing");
        toast.warning(data.message);
      } else if (data?.accessToken) {
        setPluggyStatus("configured");
        toast.success("Pluggy configurado! Token gerado com sucesso.");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setPluggyLoading(false);
    }
  };

  const consultarNfe = async () => {
    if (!chaveNfe || chaveNfe.length !== 44) {
      toast.error("Chave NF-e deve ter 44 dígitos");
      return;
    }
    setNfeLoading(true);
    setNfeResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("nfe-consult-sefaz", {
        body: { chave_nfe: chaveNfe, cnpj_emitente: cnpjEmitente },
      });
      if (error) throw error;
      setNfeResult(data);
      if (data?.setup_required) {
        toast.warning(data.message);
      } else if (data?.ok) {
        toast.success(`Consulta SEFAZ concluída via ${data.provider}`);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setNfeLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Pluggy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Banknote className="w-5 h-5" /> Pluggy — Open Finance</CardTitle>
          <CardDescription>
            Conecte contas bancárias e cartões via Open Finance para sincronização automática de transações.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="warning">
            <AlertCircle className="w-4 h-4" aria-hidden="true" />
            <AlertTitle>Configuração necessária</AlertTitle>
            <AlertDescription>
              Para habilitar a sincronização bancária via Pluggy, acesse{" "}
              <a href="https://dashboard.pluggy.ai" target="_blank" rel="noopener noreferrer" className="underline">dashboard.pluggy.ai</a>{" "}
              e crie um aplicativo. Depois adicione os secrets <code className="rounded bg-muted px-1 text-foreground">PLUGGY_CLIENT_ID</code> e{" "}
              <code className="rounded bg-muted px-1 text-foreground">PLUGGY_CLIENT_SECRET</code> nas configurações de Lovable Cloud.
            </AlertDescription>
          </Alert>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={testarPluggy} disabled={pluggyLoading}>
              {pluggyLoading ? "Testando..." : "Testar conexão Pluggy"}
            </Button>
            {pluggyStatus === "configured" && (
              <Badge variant="success"><CheckCircle2 className="w-3 h-3 mr-1" aria-hidden="true" />Configurado</Badge>
            )}
            {pluggyStatus === "missing" && (
              <Badge variant="danger"><AlertCircle className="w-3 h-3 mr-1" aria-hidden="true" />Secrets ausentes</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* SEFAZ NF-e */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileSearch className="w-5 h-5" /> Consulta SEFAZ NF-e</CardTitle>
          <CardDescription>
            Consulte status de NF-e diretamente na SEFAZ via NFe.io ou FocusNFe.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="warning">
            <AlertCircle className="w-4 h-4" aria-hidden="true" />
            <AlertTitle>Configuração necessária</AlertTitle>
            <AlertDescription>
              Adicione o secret <code className="rounded bg-muted px-1 text-foreground">SEFAZ_API_TOKEN</code> (NFe.io ou FocusNFe) e opcionalmente{" "}
              <code className="rounded bg-muted px-1 text-foreground">SEFAZ_PROVIDER</code> (<code>nfeio</code> ou <code>focusnfe</code>) nas configurações de Lovable Cloud.
            </AlertDescription>
          </Alert>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sefaz-chave-nfe">Chave NF-e (44 dígitos)</Label>
              <Input
                id="sefaz-chave-nfe"
                inputMode="numeric"
                value={chaveNfe}
                onChange={e => setChaveNfe(e.target.value.replace(/\D/g, "").slice(0, 44))}
                placeholder="35200107..."
                aria-describedby="sefaz-chave-nfe-ajuda"
              />
              <p id="sefaz-chave-nfe-ajuda" className="text-xs text-muted-foreground">
                {chaveNfe.length}/44 dígitos
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sefaz-cnpj-emitente">CNPJ emitente (obrigatório se NFe.io)</Label>
              <Input
                id="sefaz-cnpj-emitente"
                value={cnpjEmitente}
                onChange={e => setCnpjEmitente(e.target.value)}
                placeholder="00.000.000/0001-00"
              />
            </div>
          </div>
          <Button onClick={consultarNfe} disabled={nfeLoading}>
            {nfeLoading ? "Consultando..." : "Consultar SEFAZ"}
          </Button>
          {nfeResult && (
            <pre className="max-h-96 overflow-auto rounded-md border border-border bg-muted p-3 text-xs text-foreground">
              {JSON.stringify(nfeResult, null, 2)}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
