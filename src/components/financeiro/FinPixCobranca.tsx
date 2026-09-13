import { useState, useEffect } from "react";
import { interpretarValorColado } from '@/lib/financeiro/valor-colado';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import EstadoVazio from "@/components/shared/EstadoVazio";
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

/** Status da cobrança → família semântica. A cor reforça, o texto permanece. */
const statusVariant = (status: string): "success" | "warning" | "muted" =>
  status === "pago" ? "success" : status === "pendente" ? "warning" : "muted";

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

  useEffect(() => { carregar();   }, [empresaAtiva?.id]);

  const emitir = async () => {
    if (!empresaAtiva?.id) return toast.error("Selecione uma empresa");
    if (!form.chave_pix || !form.beneficiario_nome || !form.valor) {
      return toast.error("Preencha chave PIX, beneficiário e valor");
    }
    setEmitting(true);
    try {
      const valorNumerico = interpretarValorColado(form.valor);
      if (valorNumerico === null || valorNumerico <= 0) {
        toast.error("Valor inválido — use o formato 1.234,56.");
        return;
      }
      const { data, error } = await supabase.functions.invoke("emitir-pix", {
        body: {
          empresa_id: empresaAtiva.id,
          chave_pix: form.chave_pix.trim(),
          beneficiario_nome: form.beneficiario_nome.trim(),
          beneficiario_cidade: form.beneficiario_cidade.trim(),
          valor: valorNumerico,
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

  const valorInvalido = form.valor.trim().length > 0 && (() => {
    const v = interpretarValorColado(form.valor);
    return v === null || v <= 0;
  })();

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
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Beneficiário</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="pix-chave">Chave PIX (CPF/CNPJ/e-mail/telefone/aleatória)</Label>
                  <Input id="pix-chave" value={form.chave_pix} onChange={(e) => setForm({ ...form, chave_pix: e.target.value })}
                    placeholder="Ex: 12.345.678/0001-90" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pix-beneficiario">Beneficiário (nome) · até 25 chars</Label>
                  <Input id="pix-beneficiario" value={form.beneficiario_nome} maxLength={25}
                    onChange={(e) => setForm({ ...form, beneficiario_nome: e.target.value })}
                    placeholder="PRAEFECTUS LTDA" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pix-cidade">Cidade · até 15 chars</Label>
                  <Input id="pix-cidade" value={form.beneficiario_cidade} maxLength={15}
                    onChange={(e) => setForm({ ...form, beneficiario_cidade: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Cobrança</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="pix-valor">Valor (R$)</Label>
                  <Input id="pix-valor" type="text" inputMode="decimal" value={form.valor}
                    onChange={(e) => setForm({ ...form, valor: e.target.value })}
                    placeholder="1500.00"
                    aria-invalid={valorInvalido || undefined}
                    aria-describedby={valorInvalido ? "pix-valor-erro" : undefined} />
                  {valorInvalido && (
                    <p id="pix-valor-erro" className="text-xs text-destructive-ink">Valor inválido — use o formato 1.234,56.</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pix-descricao">Descrição (opcional)</Label>
                  <Input id="pix-descricao" value={form.descricao} maxLength={72}
                    onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                    placeholder="NF 1234 / Pedido 56" />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
              <Button onClick={emitir} disabled={emitting}>
                {emitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                Gerar PIX
              </Button>
            </div>
          </CardContent>
        </Card>

        {ultimaCobranca && (
          <Card className="border-success-line bg-success-tint">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-success-ink">
                <CheckCircle2 className="h-5 w-5" /> Cobrança gerada — {formatBRL(ultimaCobranca.valor)}
              </CardTitle>
              <CardDescription>TXID: {ultimaCobranca.txid}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-start gap-4 md:flex-row">
              {/* bg-white é funcional: a zona de silêncio do QR precisa ser clara em
                  qualquer tema para o leitor do banco reconhecer o código. */}
              <img src={qrUrl(ultimaCobranca.br_code)} alt="QR Code da cobrança PIX" className="rounded-md border border-border bg-white p-2" />
              <div className="w-full flex-1 space-y-2">
                <Label htmlFor="pix-br-code">Pix Copia e Cola</Label>
                <div className="flex gap-2">
                  <Input id="pix-br-code" value={ultimaCobranca.br_code} readOnly className="font-mono text-sm" />
                  <Button variant="outline" size="icon" aria-label="Copiar código Pix Copia e Cola"
                    onClick={() => copiar(ultimaCobranca.br_code)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
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
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle>Cobranças PIX</CardTitle>
            <Button variant="outline" size="sm" onClick={carregar} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-48 w-full" />
            ) : cobrancas.length === 0 ? (
              <EstadoVazio
                tamanho="compacto"
                icone={<QrCode />}
                titulo="Nenhuma cobrança PIX gerada ainda"
                descricao="Gere a primeira na aba Nova cobrança — o BR Code aparece aqui com o status do pagamento."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Data</TableHead>
                      <TableHead className="whitespace-nowrap">TXID</TableHead>
                      <TableHead className="whitespace-nowrap">Beneficiário</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Valor</TableHead>
                      <TableHead className="whitespace-nowrap">Status</TableHead>
                      <TableHead className="whitespace-nowrap">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cobrancas.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="whitespace-nowrap">{formatDate(c.created_at)}</TableCell>
                        <TableCell className="whitespace-nowrap font-mono">{c.txid}</TableCell>
                        <TableCell className="whitespace-nowrap">{c.beneficiario_nome}</TableCell>
                        <TableCell className="whitespace-nowrap text-right tabular-nums">{formatBRL(c.valor)}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex flex-wrap gap-2">
                            <Button variant="ghost" size="sm" aria-label={`Copiar BR Code da cobrança ${c.txid}`}
                              onClick={() => copiar(c.br_code)}>
                              <Copy className="h-4 w-4" />
                            </Button>
                            {c.status === "pendente" && (
                              <Button variant="ghost" size="sm" aria-label={`Marcar paga — cobrança ${c.txid}`}
                                onClick={() => marcarPago(c.id)}>
                                <CheckCircle2 className="h-4 w-4" />
                                Marcar paga
                              </Button>
                            )}
                          </div>
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
    </Tabs>
  );
}
