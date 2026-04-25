import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScanLine, Upload, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const fmt = (v: number | null | undefined) => v == null ? "-" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function FinOCRDocumentos() {
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [motor, setMotor] = useState<string>("");

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setArquivo(file);
    setResultado(null);
    setMotor("");
  };

  const processar = async () => {
    if (!arquivo) return;
    setLoading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(arquivo);
      });

      const { data, error } = await supabase.functions.invoke("ocr-document-financeiro", {
        body: { imageDataUrl: dataUrl },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setResultado(data.dados);
      setMotor(data.motor);
      toast.success(`Documento extraído via ${data.motor}`);
    } catch (e: any) {
      toast.error(`Falha no OCR: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ScanLine className="w-5 h-5" /> OCR Inteligente — Documentos Financeiros</CardTitle>
          <CardDescription>
            Envie uma imagem de NF-e, boleto ou recibo. O sistema usa múltiplas IAs (Gemini Vision, Claude, GPT-5) com fallback automático.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Label>Documento (imagem JPG/PNG)</Label>
              <Input type="file" accept="image/*" onChange={handleUpload} />
            </div>
            <Button onClick={processar} disabled={!arquivo || loading}>
              {loading ? "Processando..." : <><Upload className="w-4 h-4 mr-1" />Extrair</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {resultado && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              Dados extraídos
              {motor && <Badge variant="outline">{motor}</Badge>}
              {resultado.confianca != null && (
                <Badge variant={resultado.confianca > 0.8 ? "default" : "secondary"}>
                  Confiança: {Math.round(resultado.confianca * 100)}%
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            <Field label="Tipo" value={resultado.tipo_documento} />
            <Field label="Número" value={resultado.numero_documento} />
            <Field label="Emitente" value={resultado.emitente_nome} />
            <Field label="CNPJ Emitente" value={resultado.emitente_cnpj} />
            <Field label="Destinatário" value={resultado.destinatario_nome} />
            <Field label="CNPJ/CPF Destinatário" value={resultado.destinatario_cnpj_cpf} />
            <Field label="Data emissão" value={resultado.data_emissao} />
            <Field label="Data vencimento" value={resultado.data_vencimento} />
            <Field label="Valor total" value={fmt(resultado.valor_total)} highlight />
            <Field label="Chave NF-e" value={resultado.chave_nfe} mono />
            <div className="col-span-2">
              <Field label="Código de barras" value={resultado.codigo_barras} mono />
            </div>
            <div className="col-span-2">
              <Field label="Descrição" value={resultado.descricao} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({ label, value, highlight, mono }: { label: string; value: any; highlight?: boolean; mono?: boolean }) {
  if (value == null || value === "") return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-muted-foreground/50 italic">não detectado</div>
    </div>
  );
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`${mono ? "font-mono text-xs" : ""} ${highlight ? "font-semibold text-base" : ""}`}>{String(value)}</div>
    </div>
  );
}
