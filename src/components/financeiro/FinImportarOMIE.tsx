import { useState, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Upload, FileSpreadsheet, Download, Loader2, AlertCircle, CheckCircle2,
  Sparkles, Eye,
} from "lucide-react";
import { useEmpresaId } from "@/hooks/useFinanceiro";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { readExcelAsArrays, writeExcelFile } from "@/lib/excel-utils";

/* ---------------------------------------------------------------------------
 * IMPORTADOR OMIE — Pessoas, Contas a Pagar e Contas a Receber
 * Suporta planilhas .xlsx no padrão OMIE (~40 colunas) com mapeamento
 * automático por similaridade de cabeçalho + ajuste manual coluna→campo.
 * --------------------------------------------------------------------------*/

type Entidade = "pessoas" | "a_pagar" | "a_receber";

interface CampoDef {
  key: string;
  label: string;
  required?: boolean;
  aliases: string[]; // termos comuns usados em planilhas OMIE
  type?: "text" | "number" | "date" | "doc" | "uf" | "email" | "tipo_pessoa";
}

/* ---------- Schemas (campos esperados x cabeçalhos OMIE) ----------------- */

const SCHEMA_PESSOAS: CampoDef[] = [
  { key: "tipo", label: "Tipo (cliente/fornecedor)", aliases: ["tipo", "tipo cadastro", "categoria"], type: "tipo_pessoa" },
  { key: "documento", label: "CNPJ/CPF", required: true, aliases: ["cnpj", "cpf", "cnpj/cpf", "documento", "cnpj_cpf"], type: "doc" },
  { key: "nome", label: "Razão Social / Nome", required: true, aliases: ["razao social", "razão social", "nome", "nome_razao", "nome cliente", "nome fornecedor"] },
  { key: "nome_fantasia", label: "Nome Fantasia", aliases: ["nome fantasia", "fantasia", "apelido"] },
  { key: "ie", label: "Inscrição Estadual", aliases: ["inscricao estadual", "inscrição estadual", "ie"] },
  { key: "im", label: "Inscrição Municipal", aliases: ["inscricao municipal", "inscrição municipal", "im"] },
  { key: "ind_ie_dest", label: "Indicador IE", aliases: ["indicador ie", "ind ie"] },
  { key: "regime_tributario", label: "Regime tributário", aliases: ["regime tributario", "regime", "tributacao"] },
  { key: "cnae_principal", label: "CNAE principal", aliases: ["cnae", "cnae principal"] },
  { key: "email", label: "E-mail", aliases: ["email", "e-mail", "email principal"], type: "email" },
  { key: "telefone", label: "Telefone", aliases: ["telefone", "fone", "celular", "telefone1"] },
  { key: "site", label: "Site", aliases: ["site", "website", "url"] },
  { key: "endereco_logradouro", label: "Endereço", aliases: ["endereco", "endereço", "logradouro", "rua"] },
  { key: "endereco_numero", label: "Número", aliases: ["numero", "número", "nro"] },
  { key: "endereco_complemento", label: "Complemento", aliases: ["complemento", "compl"] },
  { key: "endereco_bairro", label: "Bairro", aliases: ["bairro"] },
  { key: "endereco_cep", label: "CEP", aliases: ["cep"] },
  { key: "endereco_municipio", label: "Município", aliases: ["municipio", "município", "cidade"] },
  { key: "endereco_uf", label: "UF", aliases: ["uf", "estado"], type: "uf" },
  { key: "banco_codigo", label: "Banco (código)", aliases: ["banco", "codigo banco", "cod banco"] },
  { key: "banco_agencia", label: "Agência", aliases: ["agencia", "agência"] },
  { key: "banco_conta", label: "Conta", aliases: ["conta", "conta corrente", "cc"] },
  { key: "pix_chave", label: "Chave PIX", aliases: ["pix", "chave pix"] },
  { key: "limite_credito", label: "Limite de crédito", aliases: ["limite", "limite credito", "limite de crédito"], type: "number" },
  { key: "prazo_padrao_dias", label: "Prazo médio (dias)", aliases: ["prazo", "prazo medio", "prazo padrao"], type: "number" },
  { key: "tags", label: "Tags (separadas por ;)", aliases: ["tags", "etiquetas", "categorias"] },
  { key: "observacoes", label: "Observações", aliases: ["observacao", "observação", "obs", "observacoes"] },
];

const SCHEMA_LANCAMENTO: CampoDef[] = [
  { key: "descricao", label: "Descrição", required: true, aliases: ["descricao", "descrição", "historico", "histórico", "titulo"] },
  { key: "valor", label: "Valor", required: true, aliases: ["valor", "valor documento", "vlr", "valor_total"], type: "number" },
  { key: "data_vencimento", label: "Vencimento", required: true, aliases: ["vencimento", "data vencimento", "dt vencimento", "venc"], type: "date" },
  { key: "data_competencia", label: "Competência", aliases: ["competencia", "competência", "data competencia", "emissao", "emissão"], type: "date" },
  { key: "numero_documento", label: "Nº documento", aliases: ["documento", "numero documento", "nf", "nota fiscal", "num doc"] },
  { key: "pessoa_documento", label: "CNPJ/CPF (cliente/fornecedor)", aliases: ["cnpj", "cpf", "cnpj fornecedor", "cnpj cliente", "documento fornecedor"], type: "doc" },
  { key: "pessoa_nome", label: "Cliente / Fornecedor (nome)", aliases: ["fornecedor", "cliente", "razao social", "razão social", "nome"] },
  { key: "categoria_codigo", label: "Categoria (código)", aliases: ["categoria", "codigo categoria", "cod categoria"] },
  { key: "centro_custo_codigo", label: "Centro de custo", aliases: ["centro custo", "centro de custo", "cc"] },
  { key: "conta_codigo", label: "Conta financeira", aliases: ["conta", "conta corrente", "banco"] },
  { key: "parcela_numero", label: "Parcela (nº)", aliases: ["parcela", "num parcela"], type: "number" },
  { key: "parcela_total", label: "Total de parcelas", aliases: ["total parcelas", "qtd parcelas", "parcelas"], type: "number" },
  { key: "valor_juros", label: "Juros", aliases: ["juros", "valor juros"], type: "number" },
  { key: "valor_multa", label: "Multa", aliases: ["multa", "valor multa"], type: "number" },
  { key: "valor_desconto", label: "Desconto", aliases: ["desconto", "valor desconto"], type: "number" },
  { key: "observacoes", label: "Observações", aliases: ["observacao", "observação", "obs"] },
];

const SCHEMAS: Record<Entidade, CampoDef[]> = {
  pessoas: SCHEMA_PESSOAS,
  a_pagar: SCHEMA_LANCAMENTO,
  a_receber: SCHEMA_LANCAMENTO,
};

/* ---------- Utils ---------------------------------------------------------- */

function normalize(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function autoMatch(headers: string[], schema: CampoDef[]): Record<string, number> {
  const map: Record<string, number> = {};
  const used = new Set<number>();
  const normHeaders = headers.map((h) => normalize(h));

  for (const campo of schema) {
    const aliases = [campo.label, campo.key, ...campo.aliases].map(normalize);
    let bestIdx = -1;
    let bestScore = 0;
    normHeaders.forEach((h, i) => {
      if (used.has(i) || !h) return;
      for (const a of aliases) {
        if (h === a) { if (10 > bestScore) { bestScore = 10; bestIdx = i; } continue; }
        if (h.includes(a) || a.includes(h)) {
          const s = Math.min(h.length, a.length) / Math.max(h.length, a.length) * 8;
          if (s > bestScore) { bestScore = s; bestIdx = i; }
        }
      }
    });
    if (bestIdx >= 0 && bestScore >= 4) { map[campo.key] = bestIdx; used.add(bestIdx); }
  }
  return map;
}

function parseValor(v: any): number {
  if (typeof v === "number") return v;
  const s = String(v ?? "").trim();
  if (!s) return NaN;
  const limpo = s.replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
  return parseFloat(limpo);
}

function parseData(v: any): string {
  if (!v && v !== 0) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  // Excel pode entregar objetos { result } ou números seriais
  if (typeof v === "object" && v && "result" in v) v = (v as any).result;
  if (typeof v === "number") {
    // serial Excel (epoch 1899-12-30)
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m) {
    const dd = m[1].padStart(2, "0");
    const mm = m[2].padStart(2, "0");
    const yyyy = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${yyyy}-${mm}-${dd}`;
  }
  return "";
}

function limparDoc(v: any): string {
  return String(v ?? "").replace(/\D/g, "");
}

function asString(v: any): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && "result" in v) return String((v as any).result ?? "");
  if (typeof v === "object" && "text" in v) return String((v as any).text ?? "");
  return String(v).trim();
}

/* ---------- Componente ----------------------------------------------------- */

export default function FinImportarOMIE() {
  const empresaId = useEmpresaId();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [entidade, setEntidade] = useState<Entidade>("a_pagar");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<any[][]>([]);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [importing, setImporting] = useState(false);
  const [showMapping, setShowMapping] = useState(false);

  const schema = SCHEMAS[entidade];

  /* --------- Linhas processadas + validação --------- */
  const processadas = useMemo(() => {
    if (!rows.length) return [] as Array<{ data: Record<string, any>; erros: string[] }>;
    return rows.map((row) => {
      const data: Record<string, any> = {};
      const erros: string[] = [];
      for (const campo of schema) {
        const idx = mapping[campo.key];
        if (idx === undefined || idx < 0) continue;
        const raw = row[idx];
        let val: any = asString(raw);
        if (campo.type === "number") val = parseValor(raw);
        else if (campo.type === "date") val = parseData(raw);
        else if (campo.type === "doc") val = limparDoc(raw);
        else if (campo.type === "uf") val = String(raw ?? "").toUpperCase().slice(0, 2);
        data[campo.key] = val;
      }
      for (const campo of schema) {
        if (!campo.required) continue;
        const v = data[campo.key];
        if (v === undefined || v === null || v === "" || (typeof v === "number" && isNaN(v))) {
          erros.push(`${campo.label} obrigatório`);
        }
      }
      if (entidade !== "pessoas") {
        if (typeof data.valor === "number" && data.valor <= 0) erros.push("Valor deve ser > 0");
        if (data.data_vencimento && !/^\d{4}-\d{2}-\d{2}$/.test(data.data_vencimento)) erros.push("Vencimento inválido");
      }
      if (entidade === "pessoas") {
        const doc = data.documento;
        if (doc && doc.length !== 11 && doc.length !== 14) erros.push("CNPJ/CPF deve ter 11 ou 14 dígitos");
      }
      return { data, erros };
    });
  }, [rows, mapping, schema, entidade]);

  const validas = processadas.filter((p) => p.erros.length === 0);
  const invalidas = processadas.filter((p) => p.erros.length > 0);

  /* --------- Upload --------- */
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const arr = await readExcelAsArrays(f);
      if (arr.length < 2) {
        toast.error("Planilha vazia ou sem cabeçalho.");
        return;
      }
      const hdr = arr[0].map((h) => asString(h));
      const data = arr.slice(1).filter((r) => r.some((c) => asString(c).trim()));
      setHeaders(hdr);
      setRows(data);
      const auto = autoMatch(hdr, schema);
      setMapping(auto);
      setShowMapping(true);
      const matched = Object.keys(auto).length;
      toast.success(`${data.length} linha(s) lida(s). ${matched}/${schema.length} colunas mapeadas automaticamente.`);
    } catch (err) {
      toast.error("Não foi possível ler a planilha. Use formato .xlsx.");
    }
  }

  function handleEntidadeChange(v: string) {
    const e = v as Entidade;
    setEntidade(e);
    if (headers.length) setMapping(autoMatch(headers, SCHEMAS[e]));
  }

  /* --------- Modelo OMIE para download --------- */
  async function baixarModelo() {
    const data = [
      schema.map((c) => c.label),
      schema.map((c) => {
        if (c.type === "date") return "2025-03-15";
        if (c.type === "number") return c.key === "valor" ? "1500,00" : "0";
        if (c.type === "doc") return "00.000.000/0001-00";
        if (c.type === "uf") return "MG";
        if (c.type === "email") return "exemplo@empresa.com.br";
        if (c.key === "descricao") return "Exemplo de lançamento";
        if (c.key === "nome") return "Empresa Exemplo Ltda";
        return "";
      }),
    ];
    const widths = schema.map((c) => Math.max(14, c.label.length + 2));
    await writeExcelFile(`modelo_omie_${entidade}.xlsx`, [
      { name: entidade.toUpperCase(), data, colWidths: widths },
    ]);
  }

  /* --------- Importação --------- */
  async function handleImportar() {
    if (!empresaId) { toast.error("Empresa não identificada."); return; }
    if (validas.length === 0) return;
    setImporting(true);
    try {
      if (entidade === "pessoas") await importarPessoas();
      else await importarLancamentos();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao importar");
    } finally {
      setImporting(false);
    }
  }

  async function importarPessoas() {
    const payload = validas.map(({ data: d }) => {
      const endereco = (d.endereco_logradouro || d.endereco_municipio) ? {
        logradouro: d.endereco_logradouro || null,
        numero: d.endereco_numero || null,
        complemento: d.endereco_complemento || null,
        bairro: d.endereco_bairro || null,
        cep: limparDoc(d.endereco_cep) || null,
        municipio: d.endereco_municipio || null,
        uf: d.endereco_uf || null,
      } : null;
      const banco = (d.banco_codigo || d.banco_agencia || d.banco_conta || d.pix_chave) ? {
        banco: d.banco_codigo || null,
        agencia: d.banco_agencia || null,
        conta: d.banco_conta || null,
        pix: d.pix_chave || null,
      } : null;
      const tags = d.tags ? String(d.tags).split(/[;,]/).map((t: string) => t.trim()).filter(Boolean) : null;
      const tipo = inferirTipo(d.tipo);
      return {
        empresa_id: empresaId,
        tipo,
        documento: d.documento || null,
        nome: d.nome,
        nome_fantasia: d.nome_fantasia || null,
        ie: d.ie || null,
        im: d.im || null,
        ind_ie_dest: d.ind_ie_dest || null,
        regime_tributario: d.regime_tributario || null,
        cnae_principal: d.cnae_principal || null,
        email: d.email || null,
        telefone: d.telefone || null,
        site: d.site || null,
        endereco,
        dados_bancarios: banco,
        tags,
        limite_credito: d.limite_credito || null,
        prazo_padrao_dias: d.prazo_padrao_dias || null,
        observacoes: d.observacoes || null,
      };
    });
    const { error } = await supabase.from("financeiro_pessoas").insert(payload as any);
    if (error) throw error;
    toast.success(`${payload.length} pessoa(s) importada(s) com sucesso.`);
    reset();
    qc.invalidateQueries({ queryKey: ["fin-pessoas"] });
  }

  async function importarLancamentos() {
    // Pré-resolve documentos de pessoas para vincular automaticamente
    const docs = Array.from(new Set(
      validas.map(({ data: d }) => d.pessoa_documento).filter(Boolean)
    ));
    let pessoaPorDoc: Record<string, string> = {};
    if (docs.length) {
      const { data: ps } = await supabase
        .from("financeiro_pessoas")
        .select("id, documento")
        .eq("empresa_id", empresaId!)
        .in("documento", docs);
      (ps || []).forEach((p: any) => { if (p.documento) pessoaPorDoc[p.documento] = p.id; });
    }

    const { data: userData } = await supabase.auth.getUser();
    const usuarioId = userData.user?.id ?? null;
    const totalValor = validas.reduce((acc, { data: d }) => acc + Number(d.valor || 0), 0);
    const { data: lote, error: loteErr } = await supabase
      .from("financeiro_origem_lotes")
      .insert({
        empresa_id: empresaId!,
        origem_tipo: "importacao_csv",
        job: "FinImportarOMIE",
        descricao: `Importação OMIE (${entidade}) — ${validas.length} linha(s)`,
        usuario_id: usuarioId,
        total_registros: validas.length,
        total_valor: totalValor,
        metadata: { entidade },
      })
      .select("id")
      .single();
    if (loteErr) throw loteErr;
    const nowIso = new Date().toISOString();

    const payload = validas.map(({ data: d }) => ({
      empresa_id: empresaId,
      tipo: entidade,
      natureza: entidade === "a_pagar" ? "despesa" : "receita",
      status: "previsto",
      descricao: d.descricao,
      valor: d.valor,
      data_vencimento: d.data_vencimento,
      data_competencia: d.data_competencia || d.data_vencimento,
      numero_documento: d.numero_documento || null,
      pessoa_id: d.pessoa_documento ? (pessoaPorDoc[d.pessoa_documento] || null) : null,
      parcela_numero: d.parcela_numero || null,
      parcela_total: d.parcela_total || null,
      valor_juros: d.valor_juros || null,
      valor_multa: d.valor_multa || null,
      valor_desconto: d.valor_desconto || null,
      observacoes: d.observacoes || null,
      origem: "importacao_omie",
      origem_tipo: "importacao_csv",
      origem_lote_id: lote.id,
      origem_job: "FinImportarOMIE",
      origem_usuario_id: usuarioId,
      origem_timestamp: nowIso,
      origem_metadata: { entidade },
    }));
    const { error } = await supabase.from("financeiro_lancamentos").insert(payload as any);
    if (error) throw error;
    const semVinculo = validas.filter(({ data: d }) => d.pessoa_documento && !pessoaPorDoc[d.pessoa_documento]).length;
    toast.success(
      `${payload.length} lançamento(s) importado(s).${semVinculo ? ` ${semVinculo} sem vínculo automático de pessoa.` : ""}`
    );
    reset();
    qc.invalidateQueries({ queryKey: ["fin-lancamentos"] });
    qc.invalidateQueries({ queryKey: ["fin-baixa-lote-pendentes"] });
    qc.invalidateQueries({ queryKey: ["fin-resumo-visor"] });
  }

  function reset() {
    setHeaders([]); setRows([]); setMapping({});
    if (fileRef.current) fileRef.current.value = "";
  }

  /* --------- Render --------- */
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileSpreadsheet className="w-5 h-5 text-muted-foreground" /> Importar planilha OMIE (.xlsx)
            </CardTitle>
            <Tabs value={entidade} onValueChange={handleEntidadeChange}>
              <TabsList>
                <TabsTrigger value="a_pagar">Contas a Pagar</TabsTrigger>
                <TabsTrigger value="a_receber">Contas a Receber</TabsTrigger>
                <TabsTrigger value="pessoas">Clientes / Fornecedores</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border bg-muted/20 p-3 text-xs space-y-2">
            <p className="font-medium flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
              Mapeamento inteligente — reconhece automaticamente as ~40 colunas do padrão OMIE.
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
              <li>Aceita planilhas exportadas do OMIE sem alterações</li>
              <li>Datas em qualquer formato (ISO, dd/mm/aaaa, serial Excel)</li>
              <li>CNPJ/CPF com ou sem máscara — vínculo automático com pessoas já cadastradas</li>
              <li>Você pode revisar e ajustar o mapeamento coluna→campo antes de importar</li>
            </ul>
            <Button variant="outline" size="sm" onClick={baixarModelo}>
              <Download className="w-3.5 h-3.5 mr-1.5" /> Baixar modelo OMIE ({entidade})
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label>Selecione o arquivo .xlsx</Label>
            <input
              ref={fileRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={handleFile}
              className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
            />
          </div>

          {rows.length > 0 && (
            <>
              {/* Métricas */}
              <div className="grid grid-cols-4 gap-3">
                <Card><CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Linhas lidas</p>
                  <p className="text-2xl font-semibold">{rows.length}</p>
                </CardContent></Card>
                <Card><CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Colunas mapeadas</p>
                  <p className="text-2xl font-semibold">{Object.keys(mapping).length}/{schema.length}</p>
                </CardContent></Card>
                <Card><CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Válidas</p>
                  <p className="text-2xl font-semibold text-success">{validas.length}</p>
                </CardContent></Card>
                <Card><CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Com erro</p>
                  <p className="text-2xl font-semibold text-destructive">{invalidas.length}</p>
                </CardContent></Card>
              </div>

              {/* Toggle mapeamento */}
              <Button variant="outline" size="sm" onClick={() => setShowMapping((s) => !s)}>
                <Eye className="w-3.5 h-3.5 mr-1.5" />
                {showMapping ? "Ocultar" : "Revisar"} mapeamento de colunas
              </Button>

              {showMapping && (
                <div className="rounded-md border p-3 space-y-2 max-h-[320px] overflow-y-auto">
                  <p className="text-xs text-muted-foreground mb-2">
                    Associe cada campo do sistema à coluna correspondente da sua planilha.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {schema.map((campo) => (
                      <div key={campo.key} className="flex items-center gap-2 text-xs">
                        <span className="flex-1 truncate">
                          {campo.label}
                          {campo.required && <span className="text-destructive">*</span>}
                        </span>
                        <Select
                          value={mapping[campo.key]?.toString() ?? "_none"}
                          onValueChange={(v) => {
                            setMapping((m) => {
                              const copy = { ...m };
                              if (v === "_none") delete copy[campo.key];
                              else copy[campo.key] = parseInt(v);
                              return copy;
                            });
                          }}
                        >
                          <SelectTrigger className="h-8 w-[200px] text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">— Não importar —</SelectItem>
                            {headers.map((h, i) => (
                              <SelectItem key={i} value={i.toString()}>
                                {h || `Coluna ${i + 1}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview linhas */}
              <div className="rounded-md border">
                <div className="flex items-center gap-2 p-3 border-b bg-muted/30 text-xs font-medium">
                  <span className="w-6"></span>
                  <span className="flex-1">Preview ({Math.min(processadas.length, 50)} de {processadas.length})</span>
                </div>
                <div className="max-h-[320px] overflow-y-auto divide-y">
                  {processadas.slice(0, 50).map((p, i) => (
                    <div key={i} className="flex items-start gap-2 p-2.5 text-sm">
                      <span className="w-6 pt-0.5">
                        {p.erros.length === 0
                          ? <CheckCircle2 className="w-4 h-4 text-success" />
                          : <AlertCircle className="w-4 h-4 text-destructive" />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium">
                          {p.data.descricao || p.data.nome || <em className="text-muted-foreground">(sem identificação)</em>}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {entidade === "pessoas"
                            ? [p.data.documento, p.data.endereco_municipio, p.data.endereco_uf].filter(Boolean).join(" • ")
                            : [p.data.data_vencimento, p.data.pessoa_nome, p.data.numero_documento].filter(Boolean).join(" • ")}
                        </p>
                        {p.erros.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {p.erros.map((e, j) => (
                              <Badge key={j} variant="destructive" className="text-xs">{e}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      {entidade !== "pessoas" && typeof p.data.valor === "number" && !isNaN(p.data.valor) && (
                        <span className="text-right text-sm tabular-nums whitespace-nowrap">
                          R$ {p.data.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between flex-wrap gap-3 p-3 rounded-md bg-muted/30">
                <div className="text-sm">
                  Pronto para importar: <strong>{validas.length}</strong> registro(s)
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={reset} disabled={importing}>Cancelar</Button>
                  <Button onClick={handleImportar} disabled={validas.length === 0 || importing}>
                    {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                    Importar {validas.length} registro(s)
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function inferirTipo(v: any): string {
  const s = normalize(asString(v));
  if (!s) return "fornecedor";
  if (s.includes("ambos") || (s.includes("cliente") && s.includes("fornecedor"))) return "ambos";
  if (s.includes("funcion")) return "funcionario";
  if (s.includes("client")) return "cliente";
  if (s.includes("forneced")) return "fornecedor";
  return "fornecedor";
}

