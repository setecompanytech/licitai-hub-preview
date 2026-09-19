import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Search, Loader2, X, ShieldCheck, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { usePessoas, useUpsertPessoa, useDeletePessoa, type Pessoa } from "@/hooks/useFinanceiro";
import { useBuscaCNPJ } from "@/hooks/useBuscaCNPJ";
import { formatDocumento } from "@/lib/financeiro/formatters";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import EstadoVazio from "@/components/shared/EstadoVazio";
import { toast } from "sonner";

const TIPOS = [
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

const emptyForm = {
  nome: "", documento: "", nome_fantasia: "", tipo: "fornecedor",
  pessoa_tipo: "PJ", email: "", telefone: "", site: "",
  ie: "", im: "", ind_ie_dest: "9", cnae_principal: "", regime_tributario: "",
  limite_credito: "", prazo_padrao_dias: "30",
  observacoes: "",
  endereco: {} as Endereco,
  dados_bancarios: {} as Bancario,
  contato_secundario: {} as ContatoSec,
  tags: [] as string[],
};

export default function FinPessoas() {
  const { data: pessoas = [], isLoading } = usePessoas();
  const upsert = useUpsertPessoa();
  const del = useDeletePessoa();
  const { buscarPorDocumento, loading: buscandoCNPJFallback } = useBuscaCNPJ();
  const [buscandoCNPJEdge, setBuscandoCNPJEdge] = useState(false);
  const buscandoCNPJ = buscandoCNPJEdge || buscandoCNPJFallback;
  const [buscandoCEP, setBuscandoCEP] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Pessoa | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [tagInput, setTagInput] = useState("");
  const [validandoSefaz, setValidandoSefaz] = useState(false);

  const handleValidarSefaz = async () => {
    const cnpj = form.documento.replace(/\D/g, "");
    if (cnpj.length !== 14) {
      toast.error("Informe um CNPJ válido (14 dígitos) para validar a Inscrição Estadual.");
      return;
    }
    if (!form.ie || form.ie.trim().length < 2) {
      toast.error("Informe a Inscrição Estadual antes de validar.");
      return;
    }
    if (!form.endereco.uf) {
      toast.error("Informe a UF (na aba Endereço) antes de validar a IE no SEFAZ.");
      return;
    }
    setValidandoSefaz(true);
    try {
      const { data, error } = await supabase.functions.invoke("nfe-consult-sefaz", {
        body: { cnpj_emitente: cnpj, inscricao_estadual: form.ie.replace(/\D/g, ""), uf: form.endereco.uf, modo: "ie" },
      });
      if (error) throw error;
      if ((data as any)?.setup_required) {
        toast.warning("Consulta SEFAZ ainda não configurada. Validação local aplicada.");
        return;
      }
      if ((data as any)?.ok) {
        toast.success("Inscrição Estadual validada no SEFAZ.");
      } else {
        toast.error((data as any)?.error || "Inscrição Estadual não localizada.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Falha ao consultar SEFAZ.");
    } finally {
      setValidandoSefaz(false);
    }
  };

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const setEnd = (k: keyof Endereco, v: string) =>
    setForm((f) => ({ ...f, endereco: { ...f.endereco, [k]: v } }));
  const setBanc = (k: keyof Bancario, v: string) =>
    setForm((f) => ({ ...f, dados_bancarios: { ...f.dados_bancarios, [k]: v } }));
  const setContato = (k: keyof ContatoSec, v: string) =>
    setForm((f) => ({ ...f, contato_secundario: { ...f.contato_secundario, [k]: v } }));

  const openDialog = (p: Pessoa | null) => {
    setEditing(p);
    if (p) {
      const anyP = p as any;
      setForm({
        nome: p.nome ?? "",
        documento: p.documento ?? "",
        nome_fantasia: p.nome_fantasia ?? "",
        tipo: p.tipo ?? "fornecedor",
        pessoa_tipo: p.pessoa_tipo ?? "PJ",
        email: p.email ?? "",
        telefone: p.telefone ?? "",
        site: anyP.site ?? "",
        ie: anyP.ie ?? "",
        im: anyP.im ?? "",
        ind_ie_dest: String(anyP.ind_ie_dest ?? "9"),
        cnae_principal: anyP.cnae_principal ?? "",
        regime_tributario: anyP.regime_tributario ?? "",
        limite_credito: anyP.limite_credito != null ? String(anyP.limite_credito) : "",
        prazo_padrao_dias: String(anyP.prazo_padrao_dias ?? "30"),
        observacoes: p.observacoes ?? "",
        endereco: (p.endereco as Endereco) ?? {},
        dados_bancarios: (p.dados_bancarios as Bancario) ?? {},
        contato_secundario: (anyP.contato_secundario as ContatoSec) ?? {},
        tags: anyP.tags ?? [],
      });
    } else {
      setForm(emptyForm);
    }
    setTagInput("");
    setOpen(true);
  };

  const validarCPF = (cpf: string): boolean => {
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    let s = 0;
    for (let i = 0; i < 9; i++) s += parseInt(cpf[i]) * (10 - i);
    let d1 = (s * 10) % 11;
    if (d1 === 10) d1 = 0;
    if (d1 !== parseInt(cpf[9])) return false;
    s = 0;
    for (let i = 0; i < 10; i++) s += parseInt(cpf[i]) * (11 - i);
    let d2 = (s * 10) % 11;
    if (d2 === 10) d2 = 0;
    return d2 === parseInt(cpf[10]);
  };

  const handleBuscarCNPJ = async () => {
    const doc = form.documento.replace(/\D/g, "");

    // CPF (11 dígitos): consulta automática à Receita Federal não é permitida
    // por restrição da LGPD/RFB. Validamos o dígito e formatamos o campo.
    if (doc.length === 11) {
      if (!validarCPF(doc)) {
        toast.error("CPF inválido. Verifique os dígitos informados.");
        return;
      }
      const formatado = doc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
      setForm((f) => ({ ...f, pessoa_tipo: "PF", documento: formatado }));
      toast.info(
        "CPF válido. Por restrição da Receita Federal (LGPD), o preenchimento automático de dados de pessoa física não é disponível — preencha o nome e endereço manualmente.",
        { duration: 6000 }
      );
      return;
    }

    if (doc.length !== 14) {
      toast.error("Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.");
      return;
    }

    setBuscandoCNPJEdge(true);
    try {
      // 1ª tentativa: edge function consulta-cnpj (server-side, sem CORS, com retries)
      const { data: edge, error: edgeErr } = await supabase.functions.invoke("consulta-cnpj", {
        body: { cnpj: doc },
      });

      if (!edgeErr && edge && !edge.error && edge.razaoSocial) {
        const cepLimpo = (edge.cep || "").replace(/\D/g, "");
        // Endereço pode vir concatenado em `endereco` (logradouro, numero) — separamos
        let logradouro = "";
        let numero = "";
        if (typeof edge.endereco === "string") {
          const partes = edge.endereco.split(",").map((s: string) => s.trim());
          logradouro = partes[0] || "";
          numero = partes[1] || "";
        }
        setForm((f) => ({
          ...f,
          pessoa_tipo: "PJ",
          nome: edge.razaoSocial,
          nome_fantasia: edge.nomeFantasia || f.nome_fantasia,
          email: edge.email || f.email,
          telefone: edge.telefone || f.telefone,
          ie: edge.inscricaoEstadual || f.ie,
          cnae_principal: edge.cnaePrincipal || f.cnae_principal,
          endereco: {
            ...f.endereco,
            logradouro: logradouro || f.endereco.logradouro,
            numero: numero || f.endereco.numero,
            complemento: edge.complemento || f.endereco.complemento,
            bairro: edge.bairro || f.endereco.bairro,
            cep: cepLimpo || f.endereco.cep,
            municipio: edge.municipio || f.endereco.municipio,
            uf: edge.uf || f.endereco.uf,
          },
        }));
        toast.success("Dados da Receita Federal preenchidos.");
        setBuscandoCNPJEdge(false);
        return;
      }

      // Mensagem amigável se a edge devolveu erro de negócio
      if (edge?.error) {
        toast.error(edge.error);
        setBuscandoCNPJEdge(false);
        return;
      }

      // 2ª tentativa: fallback browser (BrasilAPI/ReceitaWS)
      console.warn("[FinPessoas] Edge consulta-cnpj falhou, usando fallback:", edgeErr);
      const data = await buscarPorDocumento(doc);
      if (!data || !data.razao_social) {
        toast.error("CNPJ não localizado na Receita Federal.");
        return;
      }
      setForm((f) => ({
        ...f,
        pessoa_tipo: "PJ",
        nome: data.razao_social,
        nome_fantasia: data.nome_fantasia ?? f.nome_fantasia,
        email: data.email ?? f.email,
        telefone: data.telefone ?? f.telefone,
        cnae_principal: data.cnae_principal ?? f.cnae_principal,
        endereco: {
          ...f.endereco,
          logradouro: data.logradouro ?? f.endereco.logradouro,
          numero: data.numero ?? f.endereco.numero,
          complemento: data.complemento ?? f.endereco.complemento,
          bairro: data.bairro ?? f.endereco.bairro,
          cep: data.cep ?? f.endereco.cep,
          municipio: data.municipio ?? f.endereco.municipio,
          uf: data.uf ?? f.endereco.uf,
        },
      }));
      toast.success("Dados da Receita Federal preenchidos.");
    } catch (e: any) {
      toast.error(`Falha ao consultar CNPJ: ${e?.message || "erro desconhecido"}`);
    } finally {
      setBuscandoCNPJEdge(false);
    }
  };

  const handleBuscarCEP = async (cepArg?: string) => {
    const cep = ((cepArg ?? form.endereco.cep) || "").replace(/\D/g, "");
    if (cep.length !== 8) {
      toast.error("Informe um CEP válido (8 dígitos).");
      return;
    }
    setBuscandoCEP(true);
    const aplicar = (
      logradouro: string,
      bairro: string,
      municipio: string,
      uf: string,
      complemento?: string,
      ibge?: string
    ) => {
      setForm((f) => ({
        ...f,
        endereco: {
          ...f.endereco,
          logradouro: logradouro || f.endereco.logradouro,
          bairro: bairro || f.endereco.bairro,
          municipio: municipio || f.endereco.municipio,
          uf: uf || f.endereco.uf,
          complemento: f.endereco.complemento || complemento || "",
          cod_municipio_ibge: ibge || f.endereco.cod_municipio_ibge,
        },
      }));
      toast.success("Endereço preenchido a partir do CEP.");
    };
    try {
      // 1ª tentativa: edge function (sem CORS, com fallbacks server-side)
      const { data: edge, error: edgeErr } = await supabase.functions.invoke("consulta-cep", {
        body: { cep },
      });
      if (!edgeErr && edge && !edge.error && (edge.logradouro || edge.municipio)) {
        aplicar(edge.logradouro, edge.bairro, edge.municipio, edge.uf, edge.complemento, edge.ibge);
        return;
      }
      if (edge?.error) {
        // 404 ou inválido — informar e parar (não tem por que tentar browser se servidor disse 'não localizado')
        toast.error(edge.error);
        return;
      }
      // Se a edge function retornou erro de rede/transporte, cai p/ fallback browser
      throw edgeErr ?? new Error("Edge consulta-cep indisponível");
    } catch (errEdge) {
      // 2ª tentativa: ViaCEP direto no browser
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        if (!res.ok) throw new Error(`ViaCEP ${res.status}`);
        const data = await res.json();
        if (data.erro) {
          toast.error("CEP não localizado.");
          return;
        }
        aplicar(data.logradouro, data.bairro, data.localidade, data.uf, data.complemento, data.ibge);
      } catch (e: any) {
        // 3ª tentativa: BrasilAPI v2
        try {
          const res2 = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`);
          if (!res2.ok) throw new Error(`BrasilAPI ${res2.status}`);
          const d = await res2.json();
          aplicar(d.street, d.neighborhood, d.city, d.state);
        } catch (e2: any) {
          toast.error(`Falha ao consultar CEP: ${e2?.message || e?.message || "erro"}`);
        }
      }
    } finally {
      setBuscandoCEP(false);
    }
  };


  // Auto-detecta PF/PJ pelo número de dígitos
  useEffect(() => {
    const d = form.documento.replace(/\D/g, "");
    if (d.length === 11 && form.pessoa_tipo !== "PF") set("pessoa_tipo", "PF");
    else if (d.length === 14 && form.pessoa_tipo !== "PJ") set("pessoa_tipo", "PJ");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.documento]);

  const addTag = () => {
    const t = tagInput.trim();
    if (!t || form.tags.includes(t)) return;
    set("tags", [...form.tags, t]);
    setTagInput("");
  };
  const removeTag = (t: string) =>
    set("tags", form.tags.filter((x) => x !== t));

  const handleSave = async () => {
    if (!form.nome.trim()) {
      toast.error("Informe o nome / razão social.");
      return;
    }
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
      // campos novos (cast pois tipos serão regenerados)
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
    setOpen(false);
  };

  // Quem está prestes a sair do cadastro — o aviso nomeia a pessoa em vez de
  // falar em "pessoa" genérica, que é o que faz clicar em Excluir sem ler.
  const pessoaAExcluir = confirmDel ? pessoas.find((p) => p.id === confirmDel) ?? null : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        <Button onClick={() => openDialog(null)}>
          <Plus className="w-4 h-4" aria-hidden="true" /> Novo cliente/fornecedor
        </Button>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted text-sm font-semibold text-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Nome</th>
                <th className="px-4 py-3 text-left">Documento</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-left">Cidade/UF</th>
                <th className="px-4 py-3 text-left">Tags</th>
                <th className="px-4 py-3 text-left">Contato</th>
                <th className="w-24 px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [0, 1, 2].map((i) => (
                  <tr key={`skel-${i}`} className="border-t border-border">
                    <td colSpan={7} className="px-4 py-3"><Skeleton className="h-8 w-full" /></td>
                  </tr>
                ))
              ) : pessoas.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EstadoVazio
                      icone={<Users aria-hidden="true" />}
                      titulo="Nenhuma pessoa cadastrada"
                      descricao="Cadastre clientes e fornecedores para vincular a lançamentos, notas e pedidos."
                      acao={
                        <Button onClick={() => openDialog(null)}>
                          <Plus className="w-4 h-4" aria-hidden="true" /> Novo cliente/fornecedor
                        </Button>
                      }
                    />
                  </td>
                </tr>
              ) : (
                pessoas.map((p) => {
                  const end = (p.endereco as Endereco) ?? {};
                  const tags = ((p as any).tags as string[]) ?? [];
                  return (
                    <tr key={p.id} className="border-t border-border hover:bg-muted/40">
                      <td className="px-4 py-3 font-medium text-foreground">
                        {p.nome}
                        {p.nome_fantasia && <div className="text-xs text-muted-foreground">{p.nome_fantasia}</div>}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">{p.documento ? formatDocumento(p.documento) : "—"}</td>
                      <td className="px-4 py-3"><Badge variant="info">{TIPOS.find((t) => t.value === p.tipo)?.label ?? p.tipo}</Badge></td>
                      <td className="px-4 py-3 text-muted-foreground">{end.municipio ? `${end.municipio}/${end.uf ?? ""}` : "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {tags.slice(0, 3).map((t) => <Badge key={t} variant="muted">{t}</Badge>)}
                          {tags.length > 3 && <span className="text-xs text-muted-foreground">+{tags.length - 3}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{p.email ?? p.telefone ?? "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <Button size="icon" variant="ghost" aria-label={`Editar ${p.nome}`} onClick={() => openDialog(p)}>
                          <Pencil className="w-4 h-4" aria-hidden="true" />
                        </Button>
                        <Button size="icon" variant="ghost" aria-label={`Excluir ${p.nome}`} onClick={() => setConfirmDel(p.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" aria-hidden="true" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar Cliente/Fornecedor" : "Novo Cliente/Fornecedor"}</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="identificacao" className="mt-2">
            <TabsList>
              <TabsTrigger value="identificacao">Identificação</TabsTrigger>
              <TabsTrigger value="endereco">Endereço</TabsTrigger>
              <TabsTrigger value="fiscal">Fiscal</TabsTrigger>
              <TabsTrigger value="bancario">Bancário</TabsTrigger>
              <TabsTrigger value="contato">Contato</TabsTrigger>
            </TabsList>

            {/* IDENTIFICAÇÃO */}
            <TabsContent value="identificacao" className="space-y-4 pt-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="pes-documento">CPF / CNPJ</Label>
                  <div className="flex gap-2">
                    <Input
                      id="pes-documento"
                      value={form.documento}
                      onChange={(e) => {
                        const d = e.target.value.replace(/\D/g, "").slice(0, 14);
                        let masked = d;
                        if (d.length <= 11) {
                          // CPF: 000.000.000-00
                          masked = d
                            .replace(/^(\d{3})(\d)/, "$1.$2")
                            .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
                            .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
                        } else {
                          // CNPJ: 00.000.000/0000-00
                          masked = d
                            .replace(/^(\d{2})(\d)/, "$1.$2")
                            .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
                            .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4")
                            .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, "$1.$2.$3/$4-$5");
                        }
                        set("documento", masked);
                        // Auto-consulta ao completar CNPJ (14 dígitos)
                        if (d.length === 14 && !buscandoCNPJ) {
                          // pequeno timeout para garantir que o estado esteja atualizado
                          setTimeout(() => handleBuscarCNPJ(), 0);
                        }
                      }}
                      onBlur={() => {
                        const d = form.documento.replace(/\D/g, "");
                        if (d.length === 14 && !buscandoCNPJ) handleBuscarCNPJ();
                      }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleBuscarCNPJ(); } }}
                      inputMode="numeric"
                      placeholder="CPF ou CNPJ (com ou sem pontuação)"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleBuscarCNPJ}
                      disabled={buscandoCNPJ}
                      title="Consultar Receita Federal"
                      aria-label="Consultar Receita Federal"
                      className="h-11 w-11 shrink-0"
                    >
                      {buscandoCNPJ ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Search className="w-4 h-4" aria-hidden="true" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pes-pessoa-tipo">Pessoa</Label>
                  <Select value={form.pessoa_tipo} onValueChange={(v) => set("pessoa_tipo", v)}>
                    <SelectTrigger id="pes-pessoa-tipo"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PJ">Jurídica (PJ)</SelectItem>
                      <SelectItem value="PF">Física (PF)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="pes-nome">Nome / Razão social *</Label>
                  <Input
                    id="pes-nome"
                    value={form.nome}
                    onChange={(e) => set("nome", e.target.value)}
                    aria-required="true"
                    aria-invalid={!form.nome.trim()}
                    aria-describedby={!form.nome.trim() ? "pes-nome-erro" : undefined}
                  />
                  {!form.nome.trim() && (
                    <p id="pes-nome-erro" className="text-sm text-destructive">Informe o nome / razão social para salvar</p>
                  )}
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="pes-fantasia">Nome fantasia</Label>
                  <Input id="pes-fantasia" value={form.nome_fantasia} onChange={(e) => set("nome_fantasia", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pes-tipo">Tipo</Label>
                  <Select value={form.tipo} onValueChange={(v) => set("tipo", v)}>
                    <SelectTrigger id="pes-tipo"><SelectValue /></SelectTrigger>
                    <SelectContent>{TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pes-site">Site</Label>
                  <Input id="pes-site" value={form.site} onChange={(e) => set("site", e.target.value)} placeholder="https://..." />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pes-tags">Tags</Label>
                <div className="flex flex-wrap gap-2">
                  <Input
                    id="pes-tags"
                    className="min-w-0 flex-1"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                    placeholder="Ex.: VIP, Atacado, Inadimplente"
                  />
                  <Button type="button" variant="outline" onClick={addTag}>Adicionar</Button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {form.tags.map((t) => (
                    <Badge key={t} variant="muted" className="gap-1">
                      {t}
                      <button
                        type="button"
                        onClick={() => removeTag(t)}
                        aria-label={`Remover tag ${t}`}
                        className="rounded-sm hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <X className="w-3 h-3" aria-hidden="true" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pes-observacoes">Observações</Label>
                <Textarea id="pes-observacoes" value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} rows={2} />
              </div>
            </TabsContent>

            {/* ENDEREÇO */}
            <TabsContent value="endereco" className="space-y-4 pt-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="pes-cep">CEP</Label>
                  <div className="flex gap-2">
                    <Input
                      id="pes-cep"
                      value={form.endereco.cep ?? ""}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, "").slice(0, 8);
                        const masked = raw.length > 5 ? `${raw.slice(0, 5)}-${raw.slice(5)}` : raw;
                        setEnd("cep", masked);
                        // Auto-busca quando completar 8 dígitos
                        if (raw.length === 8 && !buscandoCEP) {
                          handleBuscarCEP(raw);
                        }
                      }}
                      onBlur={() => {
                        const raw = (form.endereco.cep || "").replace(/\D/g, "");
                        if (raw.length === 8 && !buscandoCEP) handleBuscarCEP(raw);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleBuscarCEP();
                        }
                      }}
                      inputMode="numeric"
                      maxLength={9}
                      placeholder="00000-000"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => handleBuscarCEP()}
                      disabled={buscandoCEP}
                      title="Buscar endereço pelo CEP"
                      aria-label="Buscar endereço pelo CEP"
                      className="h-11 w-11 shrink-0"
                    >
                      {buscandoCEP ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Search className="w-4 h-4" aria-hidden="true" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2 md:col-span-4">
                  <Label htmlFor="pes-logradouro">Logradouro</Label>
                  <Input id="pes-logradouro" value={form.endereco.logradouro ?? ""} onChange={(e) => setEnd("logradouro", e.target.value)} />
                </div>
                <div className="space-y-2 md:col-span-1">
                  <Label htmlFor="pes-numero">Nº</Label>
                  <Input id="pes-numero" value={form.endereco.numero ?? ""} onChange={(e) => setEnd("numero", e.target.value)} />
                </div>
                <div className="space-y-2 md:col-span-3">
                  <Label htmlFor="pes-complemento">Complemento</Label>
                  <Input id="pes-complemento" value={form.endereco.complemento ?? ""} onChange={(e) => setEnd("complemento", e.target.value)} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="pes-bairro">Bairro</Label>
                  <Input id="pes-bairro" value={form.endereco.bairro ?? ""} onChange={(e) => setEnd("bairro", e.target.value)} />
                </div>
                <div className="space-y-2 md:col-span-4">
                  <Label htmlFor="pes-municipio">Município</Label>
                  <Input id="pes-municipio" value={form.endereco.municipio ?? ""} onChange={(e) => setEnd("municipio", e.target.value)} />
                </div>
                <div className="space-y-2 md:col-span-1">
                  <Label htmlFor="pes-uf">UF</Label>
                  <Input id="pes-uf" value={form.endereco.uf ?? ""} onChange={(e) => setEnd("uf", e.target.value.toUpperCase().slice(0, 2))} maxLength={2} />
                </div>
                <div className="space-y-2 md:col-span-1">
                  <Label htmlFor="pes-ibge">IBGE</Label>
                  <Input id="pes-ibge" value={form.endereco.cod_municipio_ibge ?? ""} onChange={(e) => setEnd("cod_municipio_ibge", e.target.value)} />
                </div>
              </div>
            </TabsContent>

            {/* FISCAL */}
            <TabsContent value="fiscal" className="space-y-4 pt-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="pes-ie">Inscrição Estadual</Label>
                  <div className="flex gap-2">
                    <Input id="pes-ie" value={form.ie} onChange={(e) => set("ie", e.target.value)} placeholder="ISENTO se aplicável" />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleValidarSefaz}
                      disabled={validandoSefaz}
                      title="Validar Inscrição Estadual no SEFAZ"
                      aria-label="Validar Inscrição Estadual no SEFAZ"
                      className="h-11 w-11 shrink-0"
                    >
                      {validandoSefaz ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <ShieldCheck className="w-4 h-4" aria-hidden="true" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pes-im">Inscrição Municipal</Label>
                  <Input id="pes-im" value={form.im} onChange={(e) => set("im", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pes-ind-ie">Indicador IE (NF-e)</Label>
                  <Select value={form.ind_ie_dest} onValueChange={(v) => set("ind_ie_dest", v)}>
                    <SelectTrigger id="pes-ind-ie"><SelectValue /></SelectTrigger>
                    <SelectContent>{IND_IE.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pes-regime">Regime tributário</Label>
                  <Select value={form.regime_tributario} onValueChange={(v) => set("regime_tributario", v)}>
                    <SelectTrigger id="pes-regime"><SelectValue placeholder="Selecione…" /></SelectTrigger>
                    <SelectContent>{REGIMES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="pes-cnae">CNAE principal</Label>
                  <Input id="pes-cnae" value={form.cnae_principal} onChange={(e) => set("cnae_principal", e.target.value)} placeholder="Ex.: 4751-2/01 - Comércio varejista de informática" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pes-limite">Limite de crédito (R$)</Label>
                  <Input id="pes-limite" type="number" step="0.01" value={form.limite_credito} onChange={(e) => set("limite_credito", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pes-prazo">Prazo padrão (dias)</Label>
                  <Input id="pes-prazo" type="number" value={form.prazo_padrao_dias} onChange={(e) => set("prazo_padrao_dias", e.target.value)} />
                </div>
              </div>
            </TabsContent>

            {/* BANCÁRIO */}
            <TabsContent value="bancario" className="space-y-4 pt-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2 md:col-span-3">
                  <Label htmlFor="pes-banco">Banco</Label>
                  <Input id="pes-banco" value={form.dados_bancarios.banco ?? ""} onChange={(e) => setBanc("banco", e.target.value)} placeholder="Ex.: 341 - Itaú" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pes-agencia">Agência</Label>
                  <Input id="pes-agencia" value={form.dados_bancarios.agencia ?? ""} onChange={(e) => setBanc("agencia", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pes-conta">Conta</Label>
                  <Input id="pes-conta" value={form.dados_bancarios.conta ?? ""} onChange={(e) => setBanc("conta", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pes-tipo-conta">Tipo</Label>
                  <Select value={form.dados_bancarios.tipo_conta ?? ""} onValueChange={(v) => setBanc("tipo_conta", v)}>
                    <SelectTrigger id="pes-tipo-conta"><SelectValue placeholder="Selecione…" /></SelectTrigger>
                    <SelectContent>{TIPO_CONTA.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-3">
                  <Label htmlFor="pes-titular">Titular (se diferente)</Label>
                  <Input id="pes-titular" value={form.dados_bancarios.titular ?? ""} onChange={(e) => setBanc("titular", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pes-pix-tipo">Tipo de chave PIX</Label>
                  <Select value={form.dados_bancarios.pix_tipo ?? ""} onValueChange={(v) => setBanc("pix_tipo", v)}>
                    <SelectTrigger id="pes-pix-tipo"><SelectValue placeholder="Selecione…" /></SelectTrigger>
                    <SelectContent>{PIX_TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="pes-pix-chave">Chave PIX</Label>
                  <Input id="pes-pix-chave" value={form.dados_bancarios.pix_chave ?? ""} onChange={(e) => setBanc("pix_chave", e.target.value)} />
                </div>
              </div>
            </TabsContent>

            {/* CONTATO */}
            <TabsContent value="contato" className="space-y-4 pt-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="pes-email">E-mail principal</Label>
                  <Input id="pes-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pes-telefone">Telefone principal</Label>
                  <Input id="pes-telefone" value={form.telefone} onChange={(e) => set("telefone", e.target.value)} />
                </div>
              </div>
              <div className="space-y-4 border-t border-border pt-4">
                <p className="text-base font-semibold text-foreground">Contato secundário (responsável)</p>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="pes-contato-nome">Nome</Label>
                    <Input id="pes-contato-nome" value={form.contato_secundario.nome ?? ""} onChange={(e) => setContato("nome", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pes-contato-cargo">Cargo</Label>
                    <Input id="pes-contato-cargo" value={form.contato_secundario.cargo ?? ""} onChange={(e) => setContato("cargo", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pes-contato-email">E-mail</Label>
                    <Input id="pes-contato-email" type="email" value={form.contato_secundario.email ?? ""} onChange={(e) => setContato("email", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pes-contato-telefone">Telefone</Label>
                    <Input id="pes-contato-telefone" value={form.contato_secundario.telefone ?? ""} onChange={(e) => setContato("telefone", e.target.value)} />
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={upsert.isPending || !form.nome.trim()}>
              {upsert.isPending && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pessoa?</AlertDialogTitle>
            <AlertDialogDescription>
              {pessoaAExcluir
                ? `“${pessoaAExcluir.nome}” sai do cadastro. Esta ação não pode ser desfeita.`
                : "Esta ação não pode ser desfeita."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              onClick={async () => { if (confirmDel) await del.mutateAsync({ id: confirmDel }); setConfirmDel(null); }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
