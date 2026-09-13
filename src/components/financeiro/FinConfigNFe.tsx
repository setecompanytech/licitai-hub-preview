import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Save, ShieldCheck, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { toast } from "sonner";

const PROVEDORES = [
  { v: "focusnfe", l: "FocusNFe", desc: "Recomendado · API REST · NF-e/NFS-e/NFC-e" },
  { v: "nfeio", l: "NFe.io", desc: "Boa cobertura municipal de NFS-e" },
  { v: "sefaz_direto", l: "SEFAZ Direto (certificado A1)", desc: "Sem custo por nota · requer certificado server-side" },
];

export default function FinConfigNFe() {
  const { empresaAtiva } = useEmpresa();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({
    provedor: "focusnfe",
    ambiente: "homologacao",
    api_token: "",
    api_token_secundario: "",
    serie_padrao: 1,
    proximo_numero: 1,
    ativo: true,
    observacoes: "",
  });

  useEffect(() => {
    if (!empresaAtiva?.id) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("fin_config_nfe")
        .select("*")
        .eq("empresa_id", empresaAtiva.id)
        .maybeSingle();
      if (data) setConfig({ ...config, ...data });
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaAtiva?.id]);

  const salvar = async () => {
    if (!empresaAtiva?.id) return toast.error("Selecione uma empresa");
    setSaving(true);
    const { error } = await supabase
      .from("fin_config_nfe")
      .upsert({ ...config, empresa_id: empresaAtiva.id }, { onConflict: "empresa_id" });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Configuração de NF-e salva");
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
      </div>
    );
  }

  const provedorAtual = PROVEDORES.find((p) => p.v === config.provedor);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" /> Configuração de Emissão de NF-e
            </CardTitle>
            <CardDescription>
              Escolha o provedor e cadastre as credenciais. O sistema rotineiriza a emissão pela configuração desta empresa.
            </CardDescription>
          </div>
          <Badge variant={config.ativo ? "success" : "muted"}>{config.ativo ? "Ativa" : "Inativa"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Provedor e ambiente</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="nfe-provedor">Provedor</Label>
              <Select value={config.provedor} onValueChange={(v) => setConfig({ ...config, provedor: v })}>
                <SelectTrigger id="nfe-provedor"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROVEDORES.map((p) => (
                    <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {provedorAtual && <p className="text-xs text-muted-foreground">{provedorAtual.desc}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nfe-ambiente">Ambiente</Label>
              <Select value={config.ambiente} onValueChange={(v) => setConfig({ ...config, ambiente: v })}>
                <SelectTrigger id="nfe-ambiente"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="homologacao">Homologação (testes)</SelectItem>
                  <SelectItem value="producao">Produção (notas reais)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Credenciais</h3>
          <div className="space-y-1.5">
            <Label htmlFor="nfe-token">API Token / Chave</Label>
            <Input
              id="nfe-token"
              type="password"
              value={config.api_token ?? ""}
              onChange={(e) => setConfig({ ...config, api_token: e.target.value })}
              placeholder="Cole aqui o token fornecido pelo provedor"
            />
            <p className="text-xs text-muted-foreground">
              FocusNFe: token único da conta · NFe.io: API Key · SEFAZ Direto: deixar em branco e configurar certificado abaixo
            </p>
          </div>

          {config.provedor === "sefaz_direto" && (
            <div className="space-y-1.5">
              <Label htmlFor="nfe-token-secundario">Token secundário (opcional · senha do certificado)</Label>
              <Input
                id="nfe-token-secundario"
                type="password"
                value={config.api_token_secundario ?? ""}
                onChange={(e) => setConfig({ ...config, api_token_secundario: e.target.value })}
                placeholder="Senha do .pfx"
              />
              <Alert variant="warning">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Emissão direta SEFAZ requer upload do certificado A1 e está em fase de habilitação. Use FocusNFe enquanto isso.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Numeração</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="nfe-serie">Série padrão</Label>
              <Input id="nfe-serie" type="number" min={1} value={config.serie_padrao}
                onChange={(e) => setConfig({ ...config, serie_padrao: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nfe-proximo">Próximo número</Label>
              <Input id="nfe-proximo" type="number" min={1} value={config.proximo_numero}
                onChange={(e) => setConfig({ ...config, proximo_numero: Number(e.target.value) })} />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Situação e anotações</h3>
          <div className="flex items-center gap-3">
            <Switch id="nfe-ativo" checked={config.ativo} onCheckedChange={(v) => setConfig({ ...config, ativo: v })} />
            <Label htmlFor="nfe-ativo" className="cursor-pointer">Configuração ativa para emissão</Label>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nfe-observacoes">Observações internas</Label>
            <Input id="nfe-observacoes" value={config.observacoes ?? ""}
              onChange={(e) => setConfig({ ...config, observacoes: e.target.value })} />
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
          <Button onClick={salvar} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar configuração
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
