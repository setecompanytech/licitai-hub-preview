import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Plus, Trash2, Send, AlertCircle, Loader2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { toast } from "sonner";

type ItemNFe = {
  descricao: string;
  ncm: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valor_unitario: number;
};

type NFeEmitida = {
  id: string;
  numero: number | null;
  serie: number | null;
  modelo: string;
  chave_acesso: string | null;
  destinatario_nome: string | null;
  destinatario_documento: string | null;
  valor_total: number | null;
  status: string;
  ambiente: string;
  protocolo: string | null;
  url_xml: string | null;
  url_danfe: string | null;
  motivo_status: string | null;
  emitida_em: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  rascunho: "secondary",
  processando: "default",
  autorizada: "default",
  rejeitada: "destructive",
  cancelada: "destructive",
  denegada: "destructive",
};

export default function FinEmissorNFe() {
  const { empresaAtiva } = useEmpresa();
  const [modelo, setModelo] = useState<"55" | "65" | "nfse">("55");
  const [destNome, setDestNome] = useState("");
  const [destDoc, setDestDoc] = useState("");
  const [destEmail, setDestEmail] = useState("");
  const [naturezaOp, setNaturezaOp] = useState("Venda de mercadoria");
  const [itens, setItens] = useState<ItemNFe[]>([
    { descricao: "", ncm: "", cfop: "5102", unidade: "UN", quantidade: 1, valor_unitario: 0 },
  ]);
  const [serviceDescricao, setServiceDescricao] = useState("");
  const [serviceValor, setServiceValor] = useState(0);
  const [serviceCodigo, setServiceCodigo] = useState("");
  const [emitting, setEmitting] = useState(false);
  const [emitidas, setEmitidas] = useState<NFeEmitida[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const carregar = async () => {
    if (!empresaAtiva) return;
    setLoadingList(true);
    try {
      const { data, error } = await supabase
        .from("financeiro_nfes_emitidas")
        .select("id, numero, serie, modelo, chave_acesso, destinatario_nome, destinatario_documento, valor_total, status, ambiente, protocolo, url_xml, url_danfe, motivo_status, emitida_em")
        .eq("empresa_id", empresaAtiva.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setEmitidas((data || []) as NFeEmitida[]);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => { carregar(); }, [empresaAtiva?.id]);

  const adicionarItem = () => {
    setItens([...itens, { descricao: "", ncm: "", cfop: "5102", unidade: "UN", quantidade: 1, valor_unitario: 0 }]);
  };

  const removerItem = (idx: number) => {
    setItens(itens.filter((_, i) => i !== idx));
  };

  const atualizarItem = (idx: number, campo: keyof ItemNFe, valor: any) => {
    const novos = [...itens];
    (novos[idx] as any)[campo] = valor;
    setItens(novos);
  };

  const totalNota = modelo === "nfse"
    ? serviceValor
    : itens.reduce((acc, it) => acc + (Number(it.quantidade) || 0) * (Number(it.valor_unitario) || 0), 0);

  const emitir = async () => {
    if (!empresaAtiva) {
      toast.error("Selecione uma empresa ativa");
      return;
    }
    if (!destNome || !destDoc) {
      toast.error("Informe nome e CPF/CNPJ do destinatário");
      return;
    }
    if (modelo === "nfse" && (!serviceDescricao || serviceValor <= 0)) {
      toast.error("Informe descrição e valor do serviço");
      return;
    }
    if (modelo !== "nfse" && itens.some(i => !i.descricao || i.valor_unitario <= 0)) {
      toast.error("Preencha descrição e valor unitário em todos os itens");
      return;
    }

    setEmitting(true);
    try {
      const fnName = modelo === "nfse" ? "emitir-nfse" : "emitir-nfe";
      const payload: any = {
        empresa_id: empresaAtiva.id,
        modelo,
        natureza_operacao: naturezaOp,
        destinatario: {
          nome: destNome,
          documento: destDoc.replace(/\D/g, ""),
          email: destEmail || undefined,
        },
      };
      if (modelo === "nfse") {
        payload.servico = {
          descricao: serviceDescricao,
          valor: serviceValor,
          codigo_servico: serviceCodigo || undefined,
        };
      } else {
        payload.itens = itens;
        payload.valor_total = totalNota;
      }

      const { data, error } = await supabase.functions.invoke(fnName, { body: payload });
      if (error) throw error;
      if (data?.setup_required) {
        toast.warning(data.message || "Configure o secret FOCUS_NFE_API_TOKEN para emitir.");
        return;
      }
      toast.success(data?.message || "Solicitação de emissão enviada");
      await carregar();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setEmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Alert>
        <AlertCircle className="w-4 h-4" />
        <AlertTitle>Configuração necessária</AlertTitle>
        <AlertDescription>
          A emissão depende do secret <code className="bg-muted px-1 rounded">FOCUS_NFE_API_TOKEN</code> e do certificado A1 cadastrado em "Certificados Digitais" no painel Focus NFe.
          Defina <code className="bg-muted px-1 rounded">FOCUS_NFE_AMBIENTE</code> = <code>homologacao</code> para testes ou <code>producao</code> para emissão real.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5" /> Emissor de NF-e / NFC-e / NFS-e</CardTitle>
          <CardDescription>Emissão fiscal integrada via Focus NFe.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Modelo</Label>
              <Select value={modelo} onValueChange={(v) => setModelo(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="55">NF-e (55) — Mercadoria</SelectItem>
                  <SelectItem value="65">NFC-e (65) — Consumidor</SelectItem>
                  <SelectItem value="nfse">NFS-e — Serviço</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Natureza da operação</Label>
              <Input value={naturezaOp} onChange={e => setNaturezaOp(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Destinatário (nome / razão social)</Label>
              <Input value={destNome} onChange={e => setDestNome(e.target.value)} />
            </div>
            <div>
              <Label>CPF / CNPJ</Label>
              <Input value={destDoc} onChange={e => setDestDoc(e.target.value)} placeholder="00.000.000/0000-00" />
            </div>
            <div>
              <Label>E-mail (opcional)</Label>
              <Input type="email" value={destEmail} onChange={e => setDestEmail(e.target.value)} />
            </div>
          </div>

          {modelo === "nfse" ? (
            <div className="space-y-3 border-t pt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <Label>Descrição do serviço</Label>
                  <Textarea value={serviceDescricao} onChange={e => setServiceDescricao(e.target.value)} rows={3} />
                </div>
                <div className="space-y-3">
                  <div>
                    <Label>Código municipal do serviço</Label>
                    <Input value={serviceCodigo} onChange={e => setServiceCodigo(e.target.value)} placeholder="Ex: 1.05" />
                  </div>
                  <div>
                    <Label>Valor (R$)</Label>
                    <Input type="number" step="0.01" value={serviceValor} onChange={e => setServiceValor(Number(e.target.value))} />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Itens da nota</h4>
                <Button type="button" size="sm" variant="outline" onClick={adicionarItem}>
                  <Plus className="w-4 h-4 mr-1" /> Adicionar item
                </Button>
              </div>
              <div className="space-y-2">
                {itens.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-end p-2 border rounded">
                    <div className="col-span-12 md:col-span-4">
                      <Label className="text-xs">Descrição</Label>
                      <Input value={it.descricao} onChange={e => atualizarItem(idx, "descricao", e.target.value)} />
                    </div>
                    <div className="col-span-4 md:col-span-2">
                      <Label className="text-xs">NCM</Label>
                      <Input value={it.ncm} onChange={e => atualizarItem(idx, "ncm", e.target.value)} placeholder="00000000" />
                    </div>
                    <div className="col-span-4 md:col-span-1">
                      <Label className="text-xs">CFOP</Label>
                      <Input value={it.cfop} onChange={e => atualizarItem(idx, "cfop", e.target.value)} />
                    </div>
                    <div className="col-span-4 md:col-span-1">
                      <Label className="text-xs">UN</Label>
                      <Input value={it.unidade} onChange={e => atualizarItem(idx, "unidade", e.target.value)} />
                    </div>
                    <div className="col-span-6 md:col-span-1">
                      <Label className="text-xs">Qtd</Label>
                      <Input type="number" step="0.01" value={it.quantidade} onChange={e => atualizarItem(idx, "quantidade", Number(e.target.value))} />
                    </div>
                    <div className="col-span-6 md:col-span-2">
                      <Label className="text-xs">Vlr unitário</Label>
                      <Input type="number" step="0.01" value={it.valor_unitario} onChange={e => atualizarItem(idx, "valor_unitario", Number(e.target.value))} />
                    </div>
                    <div className="col-span-12 md:col-span-1 flex justify-end">
                      <Button type="button" size="icon" variant="ghost" onClick={() => removerItem(idx)} disabled={itens.length === 1}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border-t pt-4">
            <div className="text-sm">
              <span className="text-muted-foreground">Total da nota: </span>
              <span className="text-lg font-semibold">{totalNota.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
            </div>
            <Button onClick={emitir} disabled={emitting}>
              {emitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Emitindo...</> : <><Send className="w-4 h-4 mr-2" />Emitir nota</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notas emitidas</CardTitle>
          <CardDescription>Últimas 50 notas registradas.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingList ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Carregando...</div>
          ) : emitidas.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Nenhuma nota emitida ainda.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Modelo</TableHead>
                    <TableHead className="whitespace-nowrap">Nº/Série</TableHead>
                    <TableHead>Destinatário</TableHead>
                    <TableHead className="whitespace-nowrap">Valor</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                    <TableHead className="whitespace-nowrap">Ambiente</TableHead>
                    <TableHead className="whitespace-nowrap">Emitida em</TableHead>
                    <TableHead className="whitespace-nowrap">Arquivos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emitidas.map(n => (
                    <TableRow key={n.id}>
                      <TableCell className="whitespace-nowrap">{n.modelo}</TableCell>
                      <TableCell className="whitespace-nowrap">{n.numero ?? "—"}/{n.serie ?? "—"}</TableCell>
                      <TableCell>
                        <div className="text-sm">{n.destinatario_nome || "—"}</div>
                        <div className="text-xs text-muted-foreground">{n.destinatario_documento || ""}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{(n.valor_total || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant={(STATUS_COLORS[n.status] as any) || "secondary"}>{n.status}</Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant={n.ambiente === "producao" ? "default" : "outline"}>{n.ambiente}</Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {n.emitida_em ? new Date(n.emitida_em).toLocaleString("pt-BR") : "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex gap-1">
                          {n.url_xml && <a href={n.url_xml} target="_blank" rel="noopener noreferrer" className="text-xs underline inline-flex items-center gap-1">XML <ExternalLink className="w-3 h-3" /></a>}
                          {n.url_danfe && <a href={n.url_danfe} target="_blank" rel="noopener noreferrer" className="text-xs underline inline-flex items-center gap-1 ml-2">DANFE <ExternalLink className="w-3 h-3" /></a>}
                          {!n.url_xml && !n.url_danfe && <span className="text-xs text-muted-foreground">—</span>}
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
    </div>
  );
}
