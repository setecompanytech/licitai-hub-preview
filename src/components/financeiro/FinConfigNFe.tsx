import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, ShieldCheck } from "lucide-react";
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

  if (loading) return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>;

  const provedorAtual = PROVEDORES.find((p) => p.v === config.provedor);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" /> Configuração de Emissão de NF-e
            </CardTitle>
            <CardDescription>
              Escolha o provedor e cadastre as credenciais. O sistema rotineiriza a emissão pela configuração desta empresa.
            </CardDescription>
          </div>
          <Badge variant={config.ativo ? "default" : "secondary"}>{config.ativo ? "Ativa" : "Inativa"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Provedor</Label>
            <Select value={config.provedor} onValueChange={(v) => setConfig({ ...config, provedor: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROVEDORES.map((p) => (
                  <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {provedorAtual && <p className="text-xs text-muted-foreground mt-1">{provedorAtual.desc}</p>}
          </div>
          <div>
            <Label>Ambiente</Label>
            <Select value={config.ambiente} onValueChange={(v) => setConfig({ ...config, ambiente: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="homologacao">Homologação (testes)</SelectItem>
                <SelectItem value="producao">Produção (notas reais)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>API Token / Chave</Label>
          <Input
            type="password"
            value={config.api_token ?? ""}
            onChange={(e) => setConfig({ ...config, api_token: e.target.value })}
            placeholder="Cole aqui o token fornecido pelo provedor"
          />
          <p className="text-xs text-muted-foreground mt-1">
            FocusNFe: token único da conta · NFe.io: API Key · SEFAZ Direto: deixar em branco e configurar certificado abaixo
          </p>
        </div>

        {config.provedor === "sefaz_direto" && (
          <div>
            <Label>Token secundário (opcional · senha do certificado)</Label>
            <Input
              type="password"
              value={config.api_token_secundario ?? ""}
              onChange={(e) => setConfig({ ...config, api_token_secundario: e.target.value })}
              placeholder="Senha do .pfx"
            />
            <p className="text-xs text-warning mt-1">
              ⚠ Emissão direta SEFAZ requer upload do certificado A1 e está em fase de habilitação. Use FocusNFe enquanto isso.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Série padrão</Label>
            <Input type="number" min={1} value={config.serie_padrao}
              onChange={(e) => setConfig({ ...config, serie_padrao: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Próximo número</Label>
            <Input type="number" min={1} value={config.proximo_numero}
              onChange={(e) => setConfig({ ...config, proximo_numero: Number(e.target.value) })} />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Switch checked={config.ativo} onCheckedChange={(v) => setConfig({ ...config, ativo: v })} />
          <Label className="cursor-pointer">Configuração ativa para emissão</Label>
        </div>

        <div>
          <Label>Observações internas</Label>
          <Input value={config.observacoes ?? ""} onChange={(e) => setConfig({ ...config, observacoes: e.target.value })} />
        </div>

        <Button onClick={salvar} disabled={saving} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar configuração
        </Button>
      </CardContent>
    </Card>
  );
}
