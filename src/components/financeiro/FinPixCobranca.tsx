import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, QrCode, Copy, RefreshCw, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { formatBRL, formatDate } from "@/lib/financeiro/formatters";
import { toast } from "sonner";

type Cobranca = {
  id: string;
  txid: string;
  valor: number;
  descricao: string | null;
  chave_pix: string;
  beneficiario_nome: string;
  br_code: string;
  status: string;
  data_pagamento: string | null;
  created_at: string;
};

export default function FinPixCobranca() {
  const { empresaAtiva } = useEmpresa();
  const [loading, setLoading] = useState(false);
  const [cobrancas, setCobrancas] = useState<Cobranca[]>([]);
  const [form, setForm] = useState({
    chave_pix: "",
    beneficiario_nome: "",
    beneficiario_cidade: "BELEM",
    valor: "",
    descricao: "",
  });
  const [emitting, setEmitting] = useState(false);
  const [ultimaCobranca, setUltimaCobranca] = useState<Cobranca | null>(null);

  const carregar = async () => {
    if (!empresaAtiva?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from("fin_pix_cobrancas")
      .select("*")
      .eq("empresa_id", empresaAtiva.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setCobrancas((data ?? []) as Cobranca[]);
    setLoading(false);
  };

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [empresaAtiva?.id]);

  const emitir = async () => {
    if (!empresaAtiva?.id) return toast.error("Selecione uma empresa");
    if (!form.chave_pix || !form.beneficiario_nome || !form.valor) {
      return toast.error("Preencha chave PIX, beneficiário e valor");
    }
    setEmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("emitir-pix", {
        body: {
          empresa_id: empresaAtiva.id,
          chave_pix: form.chave_pix.trim(),
          beneficiario_nome: form.beneficiario_nome.trim(),
          beneficiario_cidade: form.beneficiario_cidade.trim(),
          valor: Number(form.valor.replace(",", ".")),
          descricao: form.descricao.trim() || undefined,
        },
      });
      if (error) throw error;
      toast.success("Cobrança PIX gerada");
      setUltimaCobranca(data.cobranca);
      setForm({ ...form, valor: "", descricao: "" });
      carregar();
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao gerar PIX");
    } finally {
      setEmitting(false);
    }
  };

  const copiar = async (txt: string) => {
    await navigator.clipboard.writeText(txt);
    toast.success("BR Code copiado");
  };

  const marcarPago = async (id: string) => {
    const { error } = await supabase
      .from("fin_pix_cobrancas")
      .update({ status: "pago", data_pagamento: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Cobrança marcada como paga"); carregar(); }
  };

  const qrUrl = (brCode: string) =>
    `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(brCode)}`;

  return (
    <Tabs defaultValue="nova" className="space-y-4">
      <TabsList>
        <TabsTrigger value="nova"><QrCode className="h-4 w-4 mr-1.5" /> Nova cobrança</TabsTrigger>
        <TabsTrigger value="historico">Histórico ({cobrancas.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="nova" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Gerar cobrança PIX</CardTitle>
            <CardDescription>Gera BR Code estático (Pix Copia e Cola) e QR Code conforme padrão BACEN.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Chave PIX (CPF/CNPJ/e-mail/telefone/aleatória)</Label>
                <Input value={form.chave_pix} onChange={(e) => setForm({ ...form, chave_pix: e.target.value })}
                  placeholder="Ex: 12.345.678/0001-90" />
              </div>
              <div>
                <Label>Beneficiário (nome) · até 25 chars</Label>
                <Input value={form.beneficiario_nome} maxLength={25}
                  onChange={(e) => setForm({ ...form, beneficiario_nome: e.target.value })}
                  placeholder="PRAEFECTUS LTDA" />
              </div>
              <div>
                <Label>Cidade · até 15 chars</Label>
                <Input value={form.beneficiario_cidade} maxLength={15}
                  onChange={(e) => setForm({ ...form, beneficiario_cidade: e.target.value })} />
              </div>
              <div>
                <Label>Valor (R$)</Label>
                <Input type="text" inputMode="decimal" value={form.valor}
                  onChange={(e) => setForm({ ...form, valor: e.target.value })}
                  placeholder="1500.00" />
              </div>
              <div className="md:col-span-2">
                <Label>Descrição (opcional)</Label>
                <Input value={form.descricao} maxLength={72}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  placeholder="NF 1234 / Pedido 56" />
              </div>
            </div>
            <Button onClick={emitir} disabled={emitting} className="w-full">
              {emitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <QrCode className="h-4 w-4 mr-2" />}
              Gerar PIX
            </Button>
          </CardContent>
        </Card>

        {ultimaCobranca && (
          <Card className="border-primary/40 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success" /> Cobrança gerada — {formatBRL(ultimaCobranca.valor)}
              </CardTitle>
              <CardDescription>TXID: {ultimaCobranca.txid}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col md:flex-row gap-4 items-start">
              <img src={qrUrl(ultimaCobranca.br_code)} alt="QR Code PIX" className="rounded border border-border bg-white p-2" />
              <div className="flex-1 space-y-2 w-full">
                <Label>Pix Copia e Cola</Label>
                <div className="flex gap-2">
                  <Input value={ultimaCobranca.br_code} readOnly className="font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={() => copiar(ultimaCobranca.br_code)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Compartilhe o QR Code ou o código copia-e-cola com o pagador. Após pagamento, marque como pago no histórico ou
                  configure webhook no seu PSP para baixa automática.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="historico" className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Cobranças PIX</CardTitle>
            <Button variant="outline" size="sm" onClick={carregar} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-48 w-full" />
            ) : cobrancas.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma cobrança PIX gerada ainda.</p>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead className="border-b">
                    <tr className="text-left">
                      <th className="py-2 px-2 whitespace-nowrap">Data</th>
                      <th className="py-2 px-2 whitespace-nowrap">TXID</th>
                      <th className="py-2 px-2 whitespace-nowrap">Beneficiário</th>
                      <th className="py-2 px-2 text-right whitespace-nowrap">Valor</th>
                      <th className="py-2 px-2 whitespace-nowrap">Status</th>
                      <th className="py-2 px-2 whitespace-nowrap">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cobrancas.map((c) => (
                      <tr key={c.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-1.5 px-2 whitespace-nowrap">{formatDate(c.created_at)}</td>
                        <td className="py-1.5 px-2 font-mono whitespace-nowrap">{c.txid}</td>
                        <td className="py-1.5 px-2 whitespace-nowrap">{c.beneficiario_nome}</td>
                        <td className="py-1.5 px-2 text-right whitespace-nowrap">{formatBRL(c.valor)}</td>
                        <td className="py-1.5 px-2 whitespace-nowrap">
                          <Badge variant={c.status === "pago" ? "default" : c.status === "pendente" ? "secondary" : "outline"}>
                            {c.status}
                          </Badge>
                        </td>
                        <td className="py-1.5 px-2 whitespace-nowrap flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => copiar(c.br_code)}>
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          {c.status === "pendente" && (
                            <Button variant="ghost" size="sm" onClick={() => marcarPago(c.id)}>
                              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
