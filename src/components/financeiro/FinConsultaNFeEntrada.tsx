import { useEffect, useRef, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Inbox, AlertCircle, Loader2, CheckCircle2, Upload, Download, Receipt, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { parseNFeXML } from "@/lib/parseNFe";

/**
 * NF-e de ENTRADA — o acervo automático (Fase 1, 08/09/2026).
 *
 * Terceiro emite NF-e contra o CNPJ da empresa → o provedor de DFe entrega no
 * webhook `nfe-entrada-webhook` → a nota aparece AQUI, sem F5 (realtime).
 * Enquanto o provedor não está contratado, o Importar XML alimenta o mesmo
 * acervo — mesma tabela, mesmo fluxo, origem distinta.
 *
 * "Gerar Conta a Pagar" cria o lançamento previsto com o número e o valor da
 * nota — o espelho do fluxo de Contas a Receber. Vencimento nasce igual à
 * emissão e se edita no lançamento: prazo de pagamento é do acordo com o
 * fornecedor, e inventar um seria pior que pedir o ajuste.
 */

type NfeEntrada = {
  id: string;
  chave: string;
  emitente_cnpj: string | null;
  emitente_nome: string | null;
  numero: string | null;
  serie: string | null;
  valor_total: number | null;
  data_emissao: string | null;
  natureza_operacao: string | null;
  situacao: string;
  origem: string;
  xml: string | null;
  manifestacao: string | null;
  lancamento_id: string | null;
  recebida_em: string;
};

const brl = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Parser espelho do webhook: as mesmas tags do schema 4.00. */
function lerXmlNfe(xml: string) {
  const tag = (nome: string, escopo = xml) =>
    escopo.match(new RegExp(`<${nome}>([^<]*)</${nome}>`))?.[1] ?? null;
  const bloco = (nome: string) => xml.match(new RegExp(`<${nome}>([\\s\\S]*?)</${nome}>`))?.[1] ?? "";
  const emit = bloco("emit");
  const dest = bloco("dest");
  const dhEmi = tag("dhEmi") ?? tag("dEmi");
  return {
    chave: xml.match(/Id="NFe(\d{44})"/)?.[1] ?? null,
    emitente_cnpj: tag("CNPJ", emit)?.replace(/\D/g, "") ?? null,
    emitente_nome: tag("xNome", emit),
    destinatario_cnpj: tag("CNPJ", dest)?.replace(/\D/g, "") ?? null,
    numero: tag("nNF"),
    serie: tag("serie"),
    valor_total: Number(tag("vNF")) || null,
    data_emissao: dhEmi ? dhEmi.slice(0, 10) : null,
    natureza_operacao: tag("natOp"),
  };
}

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
  const { user } = useAuth();
  const [notas, setNotas] = useState<NfeEntrada[]>([]);
  const [loadingNotas, setLoadingNotas] = useState(true);
  const [gerandoId, setGerandoId] = useState<string | null>(null);
  const entradaXml = useRef<HTMLInputElement>(null);
  const [chaveNfe, setChaveNfe] = useState("");

  const carregarNotas = useCallback(async () => {
    if (!empresaAtiva?.id) return;
    setLoadingNotas(true);
    const { data, error } = await (supabase.from("nfe_entradas" as never) as any)
      .select("*")
      .eq("empresa_id", empresaAtiva.id)
      .order("recebida_em", { ascending: false })
      .limit(200);
    setLoadingNotas(false);
    // A tabela vem da 20260908000008 (já aplicada); erro aqui não derruba a
    // manifestação abaixo.
    if (!error) setNotas((data ?? []) as NfeEntrada[]);
  }, [empresaAtiva?.id]);

  useEffect(() => { void carregarNotas(); }, [carregarNotas]);

  // Nota nova do webhook aparece sem F5 — a tabela está na publicação.
  useEffect(() => {
    if (!empresaAtiva?.id) return;
    const canal = supabase
      .channel(`nfe-entradas-${empresaAtiva.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "nfe_entradas", filter: `empresa_id=eq.${empresaAtiva.id}` },
        () => void carregarNotas())
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [empresaAtiva?.id, carregarNotas]);

  const importarXml = async (file: File | null) => {
    if (!file || !empresaAtiva?.id) return;
    const xml = await file.text();
    const dados = lerXmlNfe(xml);
    if (!dados.chave) { toast.error("Não achei a chave de acesso no XML — é um XML de NF-e (procNFe/NFe)?"); return; }
    if (dados.destinatario_cnpj && empresaAtiva.cnpj &&
        dados.destinatario_cnpj !== String(empresaAtiva.cnpj).replace(/\D/g, "")) {
      toast.error("O destinatário desta NF-e não é o CNPJ da empresa ativa.", {
        description: `Destinatário no XML: ${dados.destinatario_cnpj}. Troque de empresa ou confira o arquivo.`,
      });
      return;
    }
    const { error } = await (supabase.from("nfe_entradas" as never) as any).insert({
      empresa_id: empresaAtiva.id,
      chave: dados.chave,
      emitente_cnpj: dados.emitente_cnpj,
      emitente_nome: dados.emitente_nome,
      destinatario_cnpj: dados.destinatario_cnpj,
      numero: dados.numero ?? dados.chave.slice(25, 34).replace(/^0+/, ""),
      serie: dados.serie,
      valor_total: dados.valor_total,
      data_emissao: dados.data_emissao,
      natureza_operacao: dados.natureza_operacao,
      situacao: "autorizada",
      origem: "importada",
      xml,
    });
    if (error) {
      if (String(error.code) === "23505") toast.info("Esta NF-e já está no acervo.");
      else toast.error("Não foi possível importar: " + error.message);
      return;
    }
    toast.success(`NF-e ${dados.numero ?? ""} de ${dados.emitente_nome ?? "emitente"} importada.`);
    void carregarNotas();
  };

  const baixarXml = (n: NfeEntrada) => {
    if (!n.xml) { toast.info("Esta nota chegou como resumo — o XML completo ainda não veio."); return; }
    const blob = new Blob([n.xml], { type: "application/xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `NFe-${n.chave}.xml`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const gerarContaAPagar = async (n: NfeEntrada) => {
    if (!empresaAtiva?.id || !user) return;
    if (!n.valor_total) { toast.error("Nota sem valor — complete o XML antes de gerar o lançamento."); return; }
    setGerandoId(n.id);
    try {
      const hoje = new Date().toISOString().slice(0, 10);

      // ——— Auto-vínculo ao contrato em execução (Fase A) ———————————————
      // Produto da NF que é produto de item de contrato VIGENTE aponta o
      // dono da compra. Só vincula quando a resposta é ÚNICA — resposta
      // ambígua fica para o lápis; chute não entra no custo de ninguém.
      // Falha aqui não impede a conta: é conveniência, não pré-requisito.
      let contratoAuto: { id: string; numero: string } | null = null;
      try {
        if (n.xml) {
          const parsed = parseNFeXML(n.xml);
          const codigos = [...new Set((parsed.itens || []).map(i => i.c_prod).filter(Boolean))];
          const eans = [...new Set((parsed.itens || []).map(i => i.c_ean).filter(v => v && v !== 'SEM GTIN'))];
          const prodIds = new Set<string>();
          if (codigos.length) {
            const { data } = await supabase.from('produtos').select('id')
              .eq('empresa_id', empresaAtiva.id).in('codigo', codigos);
            (data || []).forEach(p => prodIds.add((p as { id: string }).id));
          }
          if (eans.length) {
            const { data } = await supabase.from('produtos').select('id')
              .eq('empresa_id', empresaAtiva.id).in('codigo_ean', eans);
            (data || []).forEach(p => prodIds.add((p as { id: string }).id));
          }
          if (prodIds.size > 0) {
            const { data: cis } = await (supabase.from('contrato_itens') as any)
              .select('contrato_id, contratos!inner(id, numero_contrato, data_fim, tipo_documento, excluido_em, empresa_id)')
              .in('produto_id', Array.from(prodIds));
            const vigentes = new Map<string, string>();
            for (const ci of (cis as unknown as Array<{ contratos: { id: string; numero_contrato: string | null; data_fim: string | null; tipo_documento: string; excluido_em: string | null; empresa_id: string } | null }>) || []) {
              const c = ci.contratos;
              if (!c || c.empresa_id !== empresaAtiva.id || c.tipo_documento !== 'contrato') continue;
              if (c.excluido_em) continue;
              if (c.data_fim && c.data_fim < hoje) continue;
              vigentes.set(c.id, c.numero_contrato || '');
            }
            if (vigentes.size === 1) {
              const [id, numero] = Array.from(vigentes.entries())[0];
              contratoAuto = { id, numero };
            }
          }
        }
      } catch { /* segue sem vínculo automático */ }

      const { data: lanc, error } = await supabase.from("financeiro_lancamentos").insert({
        contrato_id: contratoAuto?.id ?? null,
        empresa_id: empresaAtiva.id,
        tipo: "a_pagar",
        natureza: "despesa" as const,
        status: "previsto" as const,
        descricao: `NF-e ${n.numero ?? ""} — ${n.emitente_nome ?? "fornecedor"}`.trim(),
        valor: n.valor_total,
        // Vencimento é do ACORDO com o fornecedor, que a NF-e não traz:
        // nasce igual à emissão e se ajusta no lançamento — palpite de prazo
        // viraria atraso fabricado ou folga inexistente.
        data_vencimento: n.data_emissao ?? hoje,
        data_competencia: n.data_emissao ?? hoje,
        data_emissao: n.data_emissao,
        numero_documento: n.numero,
        origem: "manual" as const,
        origem_tipo: "sefaz_nfe" as const,
        origem_job: "FinConsultaNFeEntrada",
        origem_usuario_id: user.id,
        origem_timestamp: new Date().toISOString(),
        origem_metadata: { chave: n.chave, nfe_entrada_id: n.id },
      } as never).select("id").single();
      if (error || !lanc) throw error ?? new Error("lançamento não criado");

      // O documento fiscal viaja junto: quem abrir o lançamento vê o XML.
      await (supabase.from("financeiro_documentos_fiscais" as never) as any).insert({
        empresa_id: empresaAtiva.id,
        lancamento_id: (lanc as { id: string }).id,
        tipo: "nfe",
        numero: n.numero,
        serie: n.serie,
        chave_acesso: n.chave,
        data_emissao: n.data_emissao,
        valor_total: n.valor_total,
        arquivo_nome: `NFe-${n.chave}.xml`,
        arquivo_xml: n.xml,
      });

      await (supabase.from("nfe_entradas" as never) as any)
        .update({ lancamento_id: (lanc as { id: string }).id })
        .eq("id", n.id);

      toast.success(
        contratoAuto
          ? `Conta a Pagar criada e vinculada ao contrato ${contratoAuto.numero} (produto do contrato).`
          : "Conta a Pagar criada com o XML anexado.",
        {
          description: contratoAuto
            ? "O vínculo é reversível no lápis do lançamento. Ajuste o vencimento conforme o prazo do fornecedor."
            : "Ajuste o vencimento no lançamento conforme o prazo do fornecedor.",
        },
      );
      void carregarNotas();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar o lançamento");
    } finally {
      setGerandoId(null);
    }
  };
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
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Inbox className="w-5 h-5" /> NF-e Recebidas
              </CardTitle>
              <CardDescription>
                Notas emitidas contra o CNPJ da empresa. Chegam sozinhas pelo webhook do provedor de
                DFe — e, enquanto ele não está ativo, importe o XML aqui: mesmo acervo, mesmo fluxo.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <input ref={entradaXml} type="file" accept=".xml,text/xml" className="hidden"
                onChange={(e) => { void importarXml(e.target.files?.[0] ?? null); e.target.value = ""; }} />
              <Button size="sm" variant="outline" onClick={() => entradaXml.current?.click()}>
                <Upload className="w-4 h-4 mr-1" /> Importar XML
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingNotas ? (
            <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : notas.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma NF-e recebida ainda. Ative o webhook no provedor de DFe (Configuração NF-e) ou
              importe um XML para começar.
            </div>
          ) : (
            <div className="divide-y divide-border/40 rounded-md border border-border/40 max-h-[420px] overflow-y-auto">
              {notas.map((n) => (
                <div key={n.id} className="flex items-start justify-between gap-3 p-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium flex items-center gap-2 flex-wrap">
                      <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                      NF-e {n.numero ?? "s/nº"}{n.serie ? ` · série ${n.serie}` : ""} — {n.emitente_nome ?? "emitente não lido"}
                      {n.situacao === "cancelada" && (
                        <Badge variant="outline" className="text-xs border-destructive/40 text-destructive">Cancelada</Badge>
                      )}
                      {n.situacao === "resumo" && (
                        <Badge variant="outline" className="text-xs border-warning/40 text-warning">aguardando XML completo</Badge>
                      )}
                      {n.lancamento_id && (
                        <Badge variant="outline" className="text-xs border-success/40 text-success">Conta a Pagar gerada</Badge>
                      )}
                      <Badge variant="outline" className="text-[10px]">{n.origem === "webhook" ? "automática" : "importada"}</Badge>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono">{n.chave}</p>
                    <p className="text-xs text-muted-foreground">
                      {[n.emitente_cnpj, n.data_emissao ? new Date(n.data_emissao + "T12:00:00").toLocaleDateString("pt-BR") : null,
                        n.natureza_operacao].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <p className="font-semibold tabular-nums">{brl(n.valor_total)}</p>
                    <div className="flex items-center gap-1 justify-end">
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => baixarXml(n)}
                        title="Baixar o XML da nota">
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs"
                        title="Preencher a manifestação abaixo com esta chave"
                        onClick={() => { setChaveNfe(n.chave); toast.info("Chave preenchida na manifestação, abaixo."); }}>
                        Manifestar
                      </Button>
                      {!n.lancamento_id && n.situacao !== "cancelada" && (
                        <Button size="sm" variant="outline" className="h-7 text-xs"
                          disabled={gerandoId === n.id}
                          onClick={() => gerarContaAPagar(n)}>
                          {gerandoId === n.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <><Receipt className="w-3.5 h-3.5 mr-1" /> Gerar Conta a Pagar</>}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
