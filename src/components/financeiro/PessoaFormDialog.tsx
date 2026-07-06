import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, X, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUpsertPessoa, type Pessoa } from "@/hooks/useFinanceiro";
import { useBuscaCNPJ } from "@/hooks/useBuscaCNPJ";
import { toast } from "sonner";

// ── Constants ──────────────────────────────────────────────────────────────
export const TIPOS_PESSOA = [
  { value: "fornecedor", label: "Fornecedor" },
  { value: "cliente", label: "Cliente" },
  { value: "ambos", label: "Cliente e Fornecedor" },
  { value: "funcionario", label: "Funcionário" },
];

const REGIMES = [
  { value: "simples_nacional", label: "Simples Nacional" },
  { value: "lucro_presumido", label: "Lucro Presumido" },
  { value: "lucro_real", label: "Lucro Real" },
  { value: "mei", label: "MEI" },
  { value: "imune", label: "Imune / Isento" },
];

const IND_IE = [
  { value: "1", label: "1 — Contribuinte ICMS" },
  { value: "2", label: "2 — Contribuinte isento" },
  { value: "9", label: "9 — Não contribuinte" },
];

const TIPO_CONTA = [
  { value: "corrente", label: "Conta Corrente" },
  { value: "poupanca", label: "Poupança" },
  { value: "pagamento", label: "Conta Pagamento" },
];

const PIX_TIPOS = [
  { value: "cpf_cnpj", label: "CPF/CNPJ" },
  { value: "email", label: "E-mail" },
  { value: "telefone", label: "Telefone" },
  { value: "aleatoria", label: "Chave aleatória" },
];

type Endereco = {
  logradouro?: string; numero?: string; complemento?: string;
  bairro?: string; cep?: string; municipio?: string; uf?: string;
  cod_municipio_ibge?: string;
};
type Bancario = {
  banco?: string; agencia?: string; conta?: string; tipo_conta?: string;
  pix_chave?: string; pix_tipo?: string; titular?: string;
};
type ContatoSec = { nome?: string; telefone?: string; email?: string; cargo?: string };

const makeEmpty = (defaultTipo = "fornecedor") => ({
  nome: "", documento: "", nome_fantasia: "", tipo: defaultTipo,
  pessoa_tipo: "PJ", email: "", telefone: "", site: "",
  ie: "", im: "", ind_ie_dest: "9", cnae_principal: "", regime_tributario: "",
  limite_credito: "", prazo_padrao_dias: "30", observacoes: "",
  endereco: {} as Endereco,
  dados_bancarios: {} as Bancario,
  contato_secundario: {} as ContatoSec,
  tags: [] as string[],
});

// ── Props ──────────────────────────────────────────────────────────────────
interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Pessoa | null;
  defaultTipo?: string;
  onSuccess?: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────
export default function PessoaFormDialog({ open, onOpenChange, editing, defaultTipo = "fornecedor", onSuccess }: Props) {
  const upsert = useUpsertPessoa();
  const { buscarPorDocumento, loading: buscandoCNPJFallback } = useBuscaCNPJ();
  const [buscandoCNPJEdge, setBuscandoCNPJEdge] = useState(false);
  const buscandoCNPJ = buscandoCNPJEdge || buscandoCNPJFallback;
  const [buscandoCEP, setBuscandoCEP] = useState(false);
  const [validandoSefaz, setValidandoSefaz] = useState(false);
  const [form, setForm] = useState(makeEmpty(defaultTipo));
  const [tagInput, setTagInput] = useState("");

  // Sync form when editing changes
  useEffect(() => {
    if (!open) return;
    if (editing) {
      const p = editing as any;
      setForm({
        nome: editing.nome ?? "",
        documento: editing.documento ?? "",
        nome_fantasia: editing.nome_fantasia ?? "",
        tipo: editing.tipo ?? defaultTipo,
        pessoa_tipo: editing.pessoa_tipo ?? "PJ",
        email: editing.email ?? "",
        telefone: editing.telefone ?? "",
        site: p.site ?? "",
        ie: p.ie ?? "",
        im: p.im ?? "",
        ind_ie_dest: String(p.ind_ie_dest ?? "9"),
        cnae_principal: p.cnae_principal ?? "",
        regime_tributario: p.regime_tributario ?? "",
        limite_credito: p.limite_credito != null ? String(p.limite_credito) : "",
        prazo_padrao_dias: String(p.prazo_padrao_dias ?? "30"),
        observacoes: editing.observacoes ?? "",
        endereco: (editing.endereco as Endereco) ?? {},
        dados_bancarios: (editing.dados_bancarios as Bancario) ?? {},
        contato_secundario: (p.contato_secundario as ContatoSec) ?? {},
        tags: p.tags ?? [],
      });
    } else {
      setForm(makeEmpty(defaultTipo));
    }
    setTagInput("");
  }, [open, editing, defaultTipo]);

  // Auto-detect PF/PJ from documento length
  useEffect(() => {
    const d = form.documento.replace(/\D/g, "");
    if (d.length === 11 && form.pessoa_tipo !== "PF") set("pessoa_tipo", "PF");
    else if (d.length === 14 && form.pessoa_tipo !== "PJ") set("pessoa_tipo", "PJ");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.documento]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm(f => ({ ...f, [k]: v }));
  const setEnd = (k: keyof Endereco, v: string) =>
    setForm(f => ({ ...f, endereco: { ...f.endereco, [k]: v } }));
  const setBanc = (k: keyof Bancario, v: string) =>
    setForm(f => ({ ...f, dados_bancarios: { ...f.dados_bancarios, [k]: v } }));
  const setContato = (k: keyof ContatoSec, v: string) =>
    setForm(f => ({ ...f, contato_secundario: { ...f.contato_secundario, [k]: v } }));

  const addTag = () => {
    const t = tagInput.trim();
    if (!t || form.tags.includes(t)) return;
    set("tags", [...form.tags, t]);
    setTagInput("");
  };
  const removeTag = (t: string) => set("tags", form.tags.filter(x => x !== t));

  const validarCPF = (cpf: string) => {
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    let s = 0;
    for (let i = 0; i < 9; i++) s += parseInt(cpf[i]) * (10 - i);
    let d1 = (s * 10) % 11; if (d1 === 10) d1 = 0;
    if (d1 !== parseInt(cpf[9])) return false;
    s = 0;
    for (let i = 0; i < 10; i++) s += parseInt(cpf[i]) * (11 - i);
    let d2 = (s * 10) % 11; if (d2 === 10) d2 = 0;
    return d2 === parseInt(cpf[10]);
  };

  const handleBuscarCNPJ = async () => {
    const doc = form.documento.replace(/\D/g, "");
    if (doc.length === 11) {
      if (!validarCPF(doc)) { toast.error("CPF inválido."); return; }
      const fmt = doc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
      setForm(f => ({ ...f, pessoa_tipo: "PF", documento: fmt }));
      toast.info("CPF válido. Preencha o nome manualmente.", { duration: 5000 });
      return;
    }
    if (doc.length !== 14) { toast.error("Informe um CPF (11) ou CNPJ (14) válido."); return; }

    setBuscandoCNPJEdge(true);
    try {
      const { data: edge, error: edgeErr } = await supabase.functions.invoke("consulta-cnpj", { body: { cnpj: doc } });
      if (!edgeErr && edge && !edge.error && edge.razaoSocial) {
        const cepLimpo = (edge.cep || "").replace(/\D/g, "");
        let logradouro = ""; let numero = "";
        if (typeof edge.endereco === "string") {
          const partes = edge.endereco.split(",").map((s: string) => s.trim());
          logradouro = partes[0] || ""; numero = partes[1] || "";
        }
        setForm(f => ({
          ...f, pessoa_tipo: "PJ", nome: edge.razaoSocial,
          nome_fantasia: edge.nomeFantasia || f.nome_fantasia,
          email: edge.email || f.email, telefone: edge.telefone || f.telefone,
          ie: edge.inscricaoEstadual || f.ie, cnae_principal: edge.cnaePrincipal || f.cnae_principal,
          endereco: {
            ...f.endereco, logradouro: logradouro || f.endereco.logradouro,
            numero: numero || f.endereco.numero, complemento: edge.complemento || f.endereco.complemento,
            bairro: edge.bairro || f.endereco.bairro, cep: cepLimpo || f.endereco.cep,
            municipio: edge.municipio || f.endereco.municipio, uf: edge.uf || f.endereco.uf,
          },
        }));
        toast.success("Dados da Receita Federal preenchidos.");
        return;
      }
      if (edge?.error) { toast.error(edge.error); return; }
      // Fallback browser
      const data = await buscarPorDocumento(doc);
      if (!data?.razao_social) { toast.error("CNPJ não localizado."); return; }
      setForm(f => ({
        ...f, pessoa_tipo: "PJ", nome: data.razao_social,
        nome_fantasia: data.nome_fantasia ?? f.nome_fantasia,
        email: data.email ?? f.email, telefone: data.telefone ?? f.telefone,
        cnae_principal: data.cnae_principal ?? f.cnae_principal,
        endereco: {
          ...f.endereco, logradouro: data.logradouro ?? f.endereco.logradouro,
          numero: data.numero ?? f.endereco.numero, bairro: data.bairro ?? f.endereco.bairro,
          municipio: data.municipio ?? f.endereco.municipio, uf: data.uf ?? f.endereco.uf,
          cep: (data.cep || "").replace(/\D/g, "") || f.endereco.cep,
        },
      }));
      toast.success("Dados preenchidos (fallback).");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao consultar CNPJ.");
    } finally {
      setBuscandoCNPJEdge(false);
    }
  };

  const handleBuscarCEP = async (rawOverride?: string) => {
    const raw = rawOverride || (form.endereco.cep || "").replace(/\D/g, "");
    if (raw.length !== 8) { toast.error("CEP inválido."); return; }
    setBuscandoCEP(true);
    try {
      const { data: edge, error: edgeErr } = await supabase.functions.invoke("consulta-cep", { body: { cep: raw } });
      if (!edgeErr && edge && !edge.error && edge.logradouro) {
        setEnd("logradouro", edge.logradouro || "");
        if (edge.bairro) setEnd("bairro", edge.bairro);
        if (edge.municipio || edge.localidade) setEnd("municipio", edge.municipio || edge.localidade);
        if (edge.uf) setEnd("uf", edge.uf);
        if (edge.ibge) setEnd("cod_municipio_ibge", edge.ibge);
        toast.success("Endereço preenchido pelo CEP.");
        return;
      }
      const r = await fetch(`https://viacep.com.br/ws/${raw}/json/`);
      const d = await r.json();
      if (d.logradouro) {
        setEnd("logradouro", d.logradouro);
        if (d.bairro) setEnd("bairro", d.bairro);
        if (d.localidade) setEnd("municipio", d.localidade);
        if (d.uf) setEnd("uf", d.uf);
        if (d.ibge) setEnd("cod_municipio_ibge", d.ibge);
        toast.success("Endereço preenchido pelo CEP.");
      } else {
        toast.error("CEP não encontrado.");
      }
    } catch {
      toast.error("Erro ao buscar CEP.");
    } finally {
      setBuscandoCEP(false);
    }
  };

  const handleValidarSefaz = async () => {
    const cnpj = form.documento.replace(/\D/g, "");
    if (cnpj.length !== 14) { toast.error("Informe um CNPJ válido (14 dígitos)."); return; }
    if (!form.ie?.trim()) { toast.error("Informe a Inscrição Estadual antes de validar."); return; }
    if (!form.endereco.uf) { toast.error("Informe a UF (aba Endereço) antes de validar."); return; }
    setValidandoSefaz(true);
    try {
      const { data, error } = await supabase.functions.invoke("nfe-consult-sefaz", {
        body: { cnpj_emitente: cnpj, inscricao_estadual: form.ie.replace(/\D/g, ""), uf: form.endereco.uf, modo: "ie" },
      });
      if (error) throw error;
      if ((data as any)?.setup_required) { toast.warning("Consulta SEFAZ não configurada."); return; }
      if ((data as any)?.ok) toast.success("Inscrição Estadual validada no SEFAZ.");
      else toast.error((data as any)?.error || "Inscrição Estadual não localizada.");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao consultar SEFAZ.");
    } finally {
      setValidandoSefaz(false);
    }
  };

  const handleSave = async () => {
    if (!form.nome.trim()) { toast.error("Informe o nome / razão social."); return; }
    await upsert.mutateAsync({
      id: editing?.id,
      nome: form.nome.trim(),
      documento: form.documento.replace(/\D/g, ""),
      pessoa_tipo: form.pessoa_tipo,
      tipo: form.tipo,
      nome_fantasia: form.nome_fantasia.trim() || null,
      email: form.email.trim() || null,
      telefone: form.telefone.trim() || null,
      observacoes: form.observacoes.trim() || null,
      endereco: Object.keys(form.endereco).length ? form.endereco : null,
      dados_bancarios: Object.keys(form.dados_bancarios).length ? form.dados_bancarios : null,
      ...({
        site: form.site.trim() || null,
        ie: form.ie.trim() || null,
        im: form.im.trim() || null,
        ind_ie_dest: Number(form.ind_ie_dest) || 9,
        cnae_principal: form.cnae_principal.trim() || null,
        regime_tributario: form.regime_tributario || null,
        limite_credito: form.limite_credito ? Number(form.limite_credito) : null,
        prazo_padrao_dias: Number(form.prazo_padrao_dias) || 30,
        contato_secundario: Object.keys(form.contato_secundario).length ? form.contato_secundario : null,
        tags: form.tags,
      } as any),
    } as any);
    onOpenChange(false);
    onSuccess?.();
  };

  const isNew = !editing?.id;
  const titleSuffix = defaultTipo === "fornecedor" && isNew ? "Fornecedor" : "Cliente/Fornecedor";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? `Novo ${titleSuffix}` : `Editar ${titleSuffix}`}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="identificacao" className="mt-2">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="identificacao">Identificação</TabsTrigger>
            <TabsTrigger value="endereco">Endereço</TabsTrigger>
            <TabsTrigger value="fiscal">Fiscal</TabsTrigger>
            <TabsTrigger value="bancario">Bancário</TabsTrigger>
            <TabsTrigger value="contato">Contato</TabsTrigger>
          </TabsList>

          {/* IDENTIFICAÇÃO */}
          <TabsContent value="identificacao" className="space-y-3 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>CPF / CNPJ</Label>
                <div className="flex gap-2">
                  <Input
                    value={form.documento}
                    onChange={(e) => {
                      const d = e.target.value.replace(/\D/g, "").slice(0, 14);
                      let masked = d;
                      if (d.length <= 11) {
                        masked = d
                          .replace(/^(\d{3})(\d)/, "$1.$2")
                          .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
                          .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
                      } else {
                        masked = d
                          .replace(/^(\d{2})(\d)/, "$1.$2")
                          .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
                          .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4")
                          .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, "$1.$2.$3/$4-$5");
                      }
                      set("documento", masked);
                      if (d.length === 14 && !buscandoCNPJ) setTimeout(() => handleBuscarCNPJ(), 0);
                    }}
                    onBlur={() => { const d = form.documento.replace(/\D/g, ""); if (d.length === 14 && !buscandoCNPJ) handleBuscarCNPJ(); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleBuscarCNPJ(); } }}
                    inputMode="numeric"
                    placeholder="CPF ou CNPJ (com ou sem pontuação)"
                  />
                  <Button type="button" variant="outline" size="icon" onClick={handleBuscarCNPJ} disabled={buscandoCNPJ} title="Consultar Receita Federal">
                    {buscandoCNPJ ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Pessoa</Label>
                <Select value={form.pessoa_tipo} onValueChange={(v) => set("pessoa_tipo", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PJ">Jurídica (PJ)</SelectItem>
                    <SelectItem value="PF">Física (PF)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Nome / Razão social *</Label>
                <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Nome fantasia</Label>
                <Input value={form.nome_fantasia} onChange={(e) => set("nome_fantasia", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => set("tipo", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TIPOS_PESSOA.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Site</Label>
                <Input value={form.site} onChange={(e) => set("site", e.target.value)} placeholder="https://..." />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Tags</Label>
              <div className="flex gap-2">
                <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                  placeholder="Ex.: VIP, Atacado, Inadimplente" />
                <Button type="button" variant="outline" onClick={addTag}>Adicionar</Button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {form.tags.map(t => (
                  <Badge key={t} variant="secondary" className="gap-1">
                    {t}
                    <button onClick={() => removeTag(t)} className="hover:text-destructive"><X className="w-3 h-3" /></button>
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} rows={2} />
            </div>
          </TabsContent>

          {/* ENDEREÇO */}
          <TabsContent value="endereco" className="space-y-3 pt-4">
            <div className="grid grid-cols-6 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>CEP</Label>
                <div className="flex gap-2">
                  <Input
                    value={form.endereco.cep ?? ""}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, "").slice(0, 8);
                      const masked = raw.length > 5 ? `${raw.slice(0, 5)}-${raw.slice(5)}` : raw;
                      setEnd("cep", masked);
                      if (raw.length === 8 && !buscandoCEP) handleBuscarCEP(raw);
                    }}
                    onBlur={() => { const raw = (form.endereco.cep || "").replace(/\D/g, ""); if (raw.length === 8 && !buscandoCEP) handleBuscarCEP(raw); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleBuscarCEP(); } }}
                    inputMode="numeric" maxLength={9} placeholder="00000-000"
                  />
                  <Button type="button" variant="default" size="icon" onClick={() => handleBuscarCEP()} disabled={buscandoCEP}>
                    {buscandoCEP ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <div className="col-span-4 space-y-1.5"><Label>Logradouro</Label><Input value={form.endereco.logradouro ?? ""} onChange={(e) => setEnd("logradouro", e.target.value)} /></div>
              <div className="col-span-1 space-y-1.5"><Label>Nº</Label><Input value={form.endereco.numero ?? ""} onChange={(e) => setEnd("numero", e.target.value)} /></div>
              <div className="col-span-3 space-y-1.5"><Label>Complemento</Label><Input value={form.endereco.complemento ?? ""} onChange={(e) => setEnd("complemento", e.target.value)} /></div>
              <div className="col-span-2 space-y-1.5"><Label>Bairro</Label><Input value={form.endereco.bairro ?? ""} onChange={(e) => setEnd("bairro", e.target.value)} /></div>
              <div className="col-span-4 space-y-1.5"><Label>Município</Label><Input value={form.endereco.municipio ?? ""} onChange={(e) => setEnd("municipio", e.target.value)} /></div>
              <div className="col-span-1 space-y-1.5"><Label>UF</Label><Input value={form.endereco.uf ?? ""} onChange={(e) => setEnd("uf", e.target.value.toUpperCase().slice(0, 2))} maxLength={2} /></div>
              <div className="col-span-1 space-y-1.5"><Label>IBGE</Label><Input value={form.endereco.cod_municipio_ibge ?? ""} onChange={(e) => setEnd("cod_municipio_ibge", e.target.value)} /></div>
            </div>
          </TabsContent>

          {/* FISCAL */}
          <TabsContent value="fiscal" className="space-y-3 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Inscrição Estadual</Label>
                <div className="flex gap-2">
                  <Input value={form.ie} onChange={(e) => set("ie", e.target.value)} placeholder="ISENTO se aplicável" />
                  <Button type="button" variant="outline" size="icon" onClick={handleValidarSefaz} disabled={validandoSefaz} title="Validar IE no SEFAZ" className="shrink-0">
                    {validandoSefaz ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5"><Label>Inscrição Municipal</Label><Input value={form.im} onChange={(e) => set("im", e.target.value)} /></div>
              <div className="space-y-1.5">
                <Label>Indicador IE (NF-e)</Label>
                <Select value={form.ind_ie_dest} onValueChange={(v) => set("ind_ie_dest", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{IND_IE.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Regime tributário</Label>
                <Select value={form.regime_tributario} onValueChange={(v) => set("regime_tributario", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                  <SelectContent>{REGIMES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5"><Label>CNAE principal</Label><Input value={form.cnae_principal} onChange={(e) => set("cnae_principal", e.target.value)} placeholder="Ex.: 4751-2/01 - Comércio varejista" /></div>
              <div className="space-y-1.5"><Label>Limite de crédito (R$)</Label><Input type="number" step="0.01" value={form.limite_credito} onChange={(e) => set("limite_credito", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Prazo padrão (dias)</Label><Input type="number" value={form.prazo_padrao_dias} onChange={(e) => set("prazo_padrao_dias", e.target.value)} /></div>
            </div>
          </TabsContent>

          {/* BANCÁRIO */}
          <TabsContent value="bancario" className="space-y-3 pt-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-3 space-y-1.5"><Label>Banco</Label><Input value={form.dados_bancarios.banco ?? ""} onChange={(e) => setBanc("banco", e.target.value)} placeholder="Ex.: 341 - Itaú" /></div>
              <div className="space-y-1.5"><Label>Agência</Label><Input value={form.dados_bancarios.agencia ?? ""} onChange={(e) => setBanc("agencia", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Conta</Label><Input value={form.dados_bancarios.conta ?? ""} onChange={(e) => setBanc("conta", e.target.value)} /></div>
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={form.dados_bancarios.tipo_conta ?? ""} onValueChange={(v) => setBanc("tipo_conta", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                  <SelectContent>{TIPO_CONTA.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-3 space-y-1.5"><Label>Titular (se diferente)</Label><Input value={form.dados_bancarios.titular ?? ""} onChange={(e) => setBanc("titular", e.target.value)} /></div>
              <div className="space-y-1.5">
                <Label>Tipo de chave PIX</Label>
                <Select value={form.dados_bancarios.pix_tipo ?? ""} onValueChange={(v) => setBanc("pix_tipo", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                  <SelectContent>{PIX_TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5"><Label>Chave PIX</Label><Input value={form.dados_bancarios.pix_chave ?? ""} onChange={(e) => setBanc("pix_chave", e.target.value)} /></div>
            </div>
          </TabsContent>

          {/* CONTATO */}
          <TabsContent value="contato" className="space-y-3 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>E-mail principal</Label><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Telefone principal</Label><Input value={form.telefone} onChange={(e) => set("telefone", e.target.value)} /></div>
            </div>
            <div className="border-t pt-3">
              <p className="text-sm font-medium mb-2">Contato secundário (responsável)</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Nome</Label><Input value={form.contato_secundario.nome ?? ""} onChange={(e) => setContato("nome", e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Cargo</Label><Input value={form.contato_secundario.cargo ?? ""} onChange={(e) => setContato("cargo", e.target.value)} /></div>
                <div className="space-y-1.5"><Label>E-mail</Label><Input type="email" value={form.contato_secundario.email ?? ""} onChange={(e) => setContato("email", e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Telefone</Label><Input value={form.contato_secundario.telefone ?? ""} onChange={(e) => setContato("telefone", e.target.value)} /></div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={upsert.isPending || !form.nome.trim()}>
            {upsert.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
