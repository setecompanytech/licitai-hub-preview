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

type NFeRow = {
  id: string;
  numero: number | null;
  serie: number | null;
  modelo: string;
  chave_acesso: string | null;
  destinatario_dados: any;
  valor_total: number | null;
  status: string;
  ambiente: string;
  protocolo: string | null;
  xml_url: string | null;
  danfe_url: string | null;
  motivo: string | null;
  data_emissao: string | null;
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  rascunho: "secondary",
  processando: "default",
  autorizada: "default",
  rejeitada: "destructive",
  cancelada: "destructive",
  denegada: "destructive",
};

export default function FinEmissorNFe() {
  const { empresaAtiva } = useEmpresa();
  const [modelo, setModelo] = useState<"nfe" | "nfce" | "nfse">("nfe");
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
  const [emitidas, setEmitidas] = useState<NFeRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const carregar = async () => {
    if (!empresaAtiva) return;
    setLoadingList(true);
    try {
      const { data, error } = await supabase
        .from("financeiro_nfes_emitidas")
        .select("id, numero, serie, modelo, chave_acesso, destinatario_dados, valor_total, status, ambiente, protocolo, xml_url, danfe_url, motivo, data_emissao")
        .eq("empresa_id", empresaAtiva.id)
        .order("data_emissao", { ascending: false })
        .limit(50);
      if (error) throw error;
      setEmitidas((data || []) as unknown as NFeRow[]);
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
  const removerItem = (idx: number) => setItens(itens.filter((_, i) => i !== idx));
  const atualizarItem = (idx: number, campo: keyof ItemNFe, valor: any) => {
    const novos = [...itens];
    (novos[idx] as any)[campo] = valor;
    setItens(novos);
  };

  const totalNota = modelo === "nfse"
    ? serviceValor
    : itens.reduce((acc, it) => acc + (Number(it.quantidade) || 0) * (Number(it.valor_unitario) || 0), 0);

  const emitir = async () => {
    if (!empresaAtiva) return toast.error("Selecione uma empresa ativa");
    if (!destNome || !destDoc) return toast.error("Informe nome e CPF/CNPJ do destinatário");
    if (modelo === "nfse" && (!serviceDescricao || serviceValor <= 0)) return toast.error("Informe descrição e valor do serviço");
    if (modelo !== "nfse" && itens.some(i => !i.descricao || i.valor_unitario <= 0)) return toast.error("Preencha descrição e valor unitário em todos os itens");

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
        payload.servico = { descricao: serviceDescricao, valor: serviceValor, codigo_servico: serviceCodigo || undefined };
      } else {
        payload.itens = itens;
        payload.valor_total = totalNota;
      }

      const { data, error } = await supabase.functions.invoke(fnName, { body: payload });
      if (error) throw error;
      if (data?.setup_required) {
        toast.warning(data.message || "Configure FOCUS_NFE_API_TOKEN para emitir.");
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
          A emissão depende do secret <code className="bg-muted px-1 rounded">FOCUS_NFE_API_TOKEN</code> e de um certificado A1 cadastrado no painel Focus NFe.
          Use <code className="bg-muted px-1 rounded">FOCUS_NFE_AMBIENTE</code> = <code>homologacao</code> para testes.
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
                  <SelectItem value="nfe">NF-e — Mercadoria</SelectItem>
                  <SelectItem value="nfce">NFC-e — Consumidor</SelectItem>
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
                  {emitidas.map(n => {
                    const dest = (n.destinatario_dados || {}) as any;
                    return (
                      <TableRow key={n.id}>
                        <TableCell className="whitespace-nowrap uppercase">{n.modelo}</TableCell>
                        <TableCell className="whitespace-nowrap">{n.numero ?? "—"}/{n.serie ?? "—"}</TableCell>
                        <TableCell>
                          <div className="text-sm">{dest.nome || "—"}</div>
                          <div className="text-xs text-muted-foreground">{dest.documento || ""}</div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{(n.valor_total || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge variant={STATUS_VARIANT[n.status] || "secondary"}>{n.status}</Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge variant={n.ambiente === "producao" ? "default" : "outline"}>{n.ambiente}</Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {n.data_emissao ? new Date(n.data_emissao).toLocaleString("pt-BR") : "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex gap-2">
                            {n.xml_url && <a href={n.xml_url} target="_blank" rel="noopener noreferrer" className="text-xs underline inline-flex items-center gap-1">XML <ExternalLink className="w-3 h-3" /></a>}
                            {n.danfe_url && <a href={n.danfe_url} target="_blank" rel="noopener noreferrer" className="text-xs underline inline-flex items-center gap-1">DANFE <ExternalLink className="w-3 h-3" /></a>}
                            {!n.xml_url && !n.danfe_url && <span className="text-xs text-muted-foreground">—</span>}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
