import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import EstadoVazio from "@/components/shared/EstadoVazio";
import {
  FileText, Plus, Trash2, Send, AlertCircle, Loader2, ExternalLink, Search,
  CheckCircle2, Building2, User, Truck, Calculator, ShieldCheck, FileDown, Info, RefreshCw, Package,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useDanfeDownload } from "@/hooks/useDanfeDownload";
import { toast } from "sonner";
import {
  CFOPS_FREQUENTES, NATUREZAS_OPERACAO, CSOSN_OPCOES, CST_ICMS_OPCOES,
  ORIGEM_MERCADORIA, UNIDADES_COMERCIAIS, FRETE_MODALIDADES, FINALIDADES_NFE,
  PRESENCA_COMPRADOR, ETAPAS_EMISSAO,
} from "@/lib/nfeReference";
import { CFOPSelect } from "./CFOPSelect";

type ItemNFe = {
  codigo: string;
  descricao: string;
  ncm: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valor_unitario: number;
  origem: string;
  cst_csosn: string;
  aliq_icms: number;
  aliq_ipi: number;
  aliq_pis: number;
  aliq_cofins: number;
};

type Destinatario = {
  nome: string; documento: string; email: string;
  ie: string; logradouro: string; numero: string; complemento: string;
  bairro: string; cep: string; municipio: string; uf: string; telefone: string;
  indicador_ie: string; // 1=Contribuinte, 2=Isento, 9=Não contribuinte
};

// SEFAZ 4.00 — campos fiscais adicionais
type FiscaisExtras = {
  tpNF: "0" | "1";              // 0=Entrada, 1=Saída
  indFinal: "0" | "1";          // 0=Normal, 1=Consumidor final
  idDest: "1" | "2" | "3";      // 1=Interna, 2=Interestadual, 3=Exterior — auto
  tpEmis: "1" | "2" | "3" | "4" | "5" | "6" | "7" | "9"; // 1=Normal, 6=SVC-AN, 7=SVC-RS, etc.
  refNFe: string;               // Chave 44 dígitos da NF-e referenciada (devolução)
  numero_manual: string;        // Override de numeração (migração)
  autXML: string[];             // CNPJs autorizados a baixar XML (até 10)
};

const fiscaisExtrasVazio = (): FiscaisExtras => ({
  tpNF: "1",
  indFinal: "1",
  idDest: "1",
  tpEmis: "1",
  refNFe: "",
  numero_manual: "",
  autXML: [],
});

type Transporte = {
  modalidade_frete: string;
  transportador_nome: string;
  transportador_doc: string;
  transportador_ie: string;
  transportador_endereco: string;
  transportador_municipio: string;
  transportador_uf: string;
  placa_veiculo: string;
  uf_veiculo: string;
  rntrc_antt: string;
  qtd_volumes: string;
  especie: string;
  marca_volumes: string;
  numeracao_volumes: string;
  peso_bruto: string;
  peso_liquido: string;
};

type NFeRow = {
  id: string; numero: number | null; serie: number | null; modelo: string;
  chave_acesso: string | null; destinatario_dados: any; valor_total: number | null;
  status: string; ambiente: string; protocolo: string | null; xml_url: string | null;
  danfe_url: string | null; motivo: string | null; data_emissao: string | null;
};

type PedidoFatura = {
  id: string; numero: number; tipo: string; status: string;
  valor_total: number; created_at: string; pessoa_id: string | null;
  pessoa_nome: string | null; pessoa_doc: string | null;
  nfe_id: string | null; nfe_numero: number | null;
  nfe_status: string | null; nfe_chave: string | null;
};

// Subconjunto de financeiro_nfes_emitidas usado para vincular NF-e ao pedido
type NfeVinculada = {
  id: string;
  numero: number | null;
  status: string;
  chave_acesso: string | null;
  pedido_id: string | null;
};

/** Status da NF-e → família semântica. A cor reforça; o texto nunca sai. */
const STATUS_VARIANT: Record<string, "success" | "warning" | "danger" | "info" | "muted"> = {
  rascunho: "muted", processando: "warning", autorizada: "success",
  rejeitada: "danger", cancelada: "danger", denegada: "danger",
};

/** Rótulo curto do status, para caber no Badge da tabela. */
const STATUS_TEXTO: Record<string, string> = {
  rascunho: "Rascunho", processando: "Processando", autorizada: "Autorizada",
  rejeitada: "Rejeitada", cancelada: "Cancelada", denegada: "Denegada",
};

const itemVazio = (): ItemNFe => ({
  codigo: "", descricao: "", ncm: "", cfop: "5102", unidade: "UN",
  quantidade: 1, valor_unitario: 0, origem: "0", cst_csosn: "102",
  aliq_icms: 0, aliq_ipi: 0, aliq_pis: 0, aliq_cofins: 0,
});

const destinatarioVazio = (): Destinatario => ({
  nome: "", documento: "", email: "", ie: "", logradouro: "", numero: "",
  complemento: "", bairro: "", cep: "", municipio: "", uf: "", telefone: "",
  indicador_ie: "9",
});

const transporteVazio = (): Transporte => ({
  modalidade_frete: "9", transportador_nome: "", transportador_doc: "",
  transportador_ie: "", transportador_endereco: "", transportador_municipio: "", transportador_uf: "",
  placa_veiculo: "", uf_veiculo: "", rntrc_antt: "",
  qtd_volumes: "", especie: "", marca_volumes: "", numeracao_volumes: "",
  peso_bruto: "", peso_liquido: "",
});

export default function FinEmissorNFe() {
  const { empresaAtiva } = useEmpresa();
  const navigate = useNavigate();
  const [buscandoCNPJ, setBuscandoCNPJ] = useState(false);
  const { baixarDanfe, aguardarAutorizacaoEBaixar, consultarStatus, downloading, polling } = useDanfeDownload();
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  const atualizarStatusLinha = async (nfeId: string) => {
    setRefreshingId(nfeId);
    try {
      await consultarStatus(nfeId, { autoBaixar: true });
      await carregar();
    } finally {
      setRefreshingId(null);
    }
  };

  const STATUS_LABEL: Record<string, string> = {
    rascunho: "Rascunho",
    processando: "Aguardando autorização da SEFAZ",
    autorizada: "Autorizada — DANFE disponível",
    rejeitada: "Rejeitada pela SEFAZ",
    denegada: "Denegada pela SEFAZ",
    cancelada: "Cancelada",
  };

  const [modelo, setModelo] = useState<"nfe" | "nfce" | "nfse">("nfe");
  const [naturezaOp, setNaturezaOp] = useState(NATUREZAS_OPERACAO[0]);
  const [finalidade, setFinalidade] = useState("1");
  const [presenca, setPresenca] = useState("1");
  const [serie, setSerie] = useState(1);

  const [destinatario, setDestinatario] = useState<Destinatario>(destinatarioVazio());
  const [itens, setItens] = useState<ItemNFe[]>([itemVazio()]);
  const [transporte, setTransporte] = useState<Transporte>(transporteVazio());
  const [fiscais, setFiscais] = useState<FiscaisExtras>(fiscaisExtrasVazio());
  const [autXmlInput, setAutXmlInput] = useState("");

  const [valorFrete, setValorFrete] = useState(0);
  const [valorSeguro, setValorSeguro] = useState(0);
  const [desconto, setDesconto] = useState(0);
  const [outrasDespesas, setOutrasDespesas] = useState(0);
  const [infoComplementares, setInfoComplementares] = useState("");

  // NFS-e
  const [serviceDescricao, setServiceDescricao] = useState("");
  const [serviceValor, setServiceValor] = useState(0);
  const [serviceCodigo, setServiceCodigo] = useState("");

  const [emitting, setEmitting] = useState(false);
  const [emitidas, setEmitidas] = useState<NFeRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [activeTab, setActiveTab] = useState("faturas");

  const [pedidosFatura, setPedidosFatura] = useState<PedidoFatura[]>([]);
  const [loadingPedidos, setLoadingPedidos] = useState(false);

  // ====== Fase D: chegada da esteira Pedidos a Faturar ======
  // O prefill viaja por sessionStorage e é consumido UMA vez (a chave morre
  // na leitura — recarregar a página não re-preenche fantasma). Preenche
  // itens com os dados do pedido + fiscais do produto do contrato e aponta o
  // destinatário: pessoa do cadastro com o nome do órgão, se existir; senão
  // nome/UF/município do contrato, para o usuário completar CNPJ e endereço.
  useEffect(() => {
    if (!empresaAtiva?.id) return;
    const bruto = sessionStorage.getItem('praefectus_emissor_prefill');
    if (!bruto) return;
    sessionStorage.removeItem('praefectus_emissor_prefill');
    try {
      const p = JSON.parse(bruto) as {
        origem: string; numero_pedido?: string; contrato_numero?: string | null;
        orgao?: string | null; uf?: string | null; municipio?: string | null;
        itens?: Array<Partial<ItemNFe>>;
      };
      if (p.itens?.length) {
        setItens(p.itens.map(i => ({ ...itemVazio(), ...i })));
      }
      setActiveTab('emissao');
      setInfoComplementares(prev => prev || [
        p.contrato_numero ? `Contrato ${p.contrato_numero}` : null,
        p.numero_pedido ? `Pedido/OF ${p.numero_pedido}` : null,
      ].filter(Boolean).join(' — '));
      (async () => {
        let preenchido = false;
        if (p.orgao) {
          const { data } = await supabase
            .from('financeiro_pessoas')
            .select('nome, documento')
            .eq('empresa_id', empresaAtiva.id)
            .ilike('nome', `%${p.orgao.slice(0, 40)}%`)
            .limit(1)
            .maybeSingle();
          if (data) {
            setDestinatario(d => ({
              ...d,
              nome: (data as { nome: string }).nome,
              documento: (data as { documento: string | null }).documento || '',
              uf: p.uf || d.uf,
              municipio: p.municipio || d.municipio,
            }));
            preenchido = true;
          }
        }
        if (!preenchido) {
          setDestinatario(d => ({
            ...d,
            nome: p.orgao || d.nome,
            uf: p.uf || d.uf,
            municipio: p.municipio || d.municipio,
          }));
        }
        toast.info(`Dados do pedido ${p.numero_pedido ?? ''} carregados — confira o destinatário (CNPJ/endereço) antes de transmitir.`);
      })();
    } catch { /* prefill corrompido: emissor abre limpo */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaAtiva?.id]);

  // ====== Cálculo automático do idDest (1=Interna, 2=Interestadual, 3=Exterior) ======
  useEffect(() => {
    const ufEmit = (empresaAtiva?.uf || "").toUpperCase();
    const ufDest = (destinatario.uf || "").toUpperCase();
    if (!ufEmit || !ufDest) return;
    const novo: FiscaisExtras["idDest"] = ufDest === "EX" ? "3" : ufDest === ufEmit ? "1" : "2";
    if (novo !== fiscais.idDest) setFiscais(f => ({ ...f, idDest: novo }));
  }, [empresaAtiva?.uf, destinatario.uf, fiscais.idDest]);

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
    } catch (e: any) { toast.error(e.message); }
    finally { setLoadingList(false); }
  };

  const carregarPedidosFatura = async () => {
    if (!empresaAtiva) return;
    setLoadingPedidos(true);
    try {
      const { data: pedidosData, error: pedErr } = await (supabase
        .from('pedidos' as never)
        .select('id, numero, tipo, status, valor_total, created_at, pessoa_id')
        .eq('empresa_id', empresaAtiva.id)
        .in('status', ['faturar', 'faturado'])
        .order('created_at', { ascending: false }) as any);
      if (pedErr) throw pedErr;
      if (!pedidosData || pedidosData.length === 0) { setPedidosFatura([]); return; }

      const pedidoIds = pedidosData.map((p: any) => p.id);
      const pessoaIds = [...new Set(pedidosData.filter((p: any) => p.pessoa_id).map((p: any) => p.pessoa_id))] as string[];

      // Falha ao buscar NF-es vinculadas não deve derrubar a listagem de pedidos
      const buscarNfesVinculadas = async (): Promise<{ data: NfeVinculada[] | null }> => {
        try {
          const { data } = await supabase
            .from('financeiro_nfes_emitidas')
            .select('id, numero, status, chave_acesso, pedido_id')
            .in('pedido_id', pedidoIds);
          return { data };
        } catch {
          return { data: null };
        }
      };

      const [pessoasRes, nfesRes] = await Promise.all([
        pessoaIds.length > 0
          ? supabase.from('financeiro_pessoas').select('id, nome, documento').in('id', pessoaIds)
          : Promise.resolve({ data: [] as { id: string; nome: string; documento: string }[] }),
        buscarNfesVinculadas(),
      ]);

      const pessoasMap: Record<string, any> = {};
      (pessoasRes.data || []).forEach((p: any) => { pessoasMap[p.id] = p; });
      const nfesMap: Record<string, NfeVinculada> = {};
      (nfesRes.data || []).forEach(n => { if (n.pedido_id) nfesMap[n.pedido_id] = n; });

      setPedidosFatura(pedidosData.map((p: any) => ({
        id: p.id, numero: p.numero, tipo: p.tipo, status: p.status,
        valor_total: p.valor_total, created_at: p.created_at, pessoa_id: p.pessoa_id,
        pessoa_nome: pessoasMap[p.pessoa_id]?.nome ?? null,
        pessoa_doc: pessoasMap[p.pessoa_id]?.documento ?? null,
        nfe_id: nfesMap[p.id]?.id ?? null,
        nfe_numero: nfesMap[p.id]?.numero ?? null,
        nfe_status: nfesMap[p.id]?.status ?? null,
        nfe_chave: nfesMap[p.id]?.chave_acesso ?? null,
      })));
    } catch (e: any) {
      toast.error('Erro ao carregar pedidos: ' + e.message);
    } finally {
      setLoadingPedidos(false);
    }
  };

  useEffect(() => { carregar(); carregarPedidosFatura(); }, [empresaAtiva?.id]);

  const buscarDestinatario = async () => {
    const digits = destinatario.documento.replace(/\D/g, "");
    if (digits.length !== 14 && digits.length !== 11) {
      toast.error("Informe um CNPJ válido (14 dígitos) para busca automática");
      return;
    }
    if (digits.length === 11) {
      toast.info("CPF não permite consulta pública — preencha manualmente os dados");
      setDestinatario({ ...destinatario, indicador_ie: "9" });
      return;
    }
    setBuscandoCNPJ(true);
    try {
      const { data, error } = await supabase.functions.invoke("consulta-cnpj", {
        body: { cnpj: digits },
      });
      if (error || data?.error) {
        toast.error("CNPJ não encontrado ou inválido");
        return;
      }
      setDestinatario({
        ...destinatario,
        nome: data.razaoSocial || destinatario.nome,
        logradouro: data.logradouro || "",
        numero: data.numero || "",
        complemento: data.complemento || "",
        bairro: data.bairro || "",
        cep: data.cep || "",
        municipio: data.municipio || "",
        uf: data.uf || "",
        telefone: data.telefone || destinatario.telefone,
        ie: data.inscricaoEstadual || destinatario.ie,
      });
      toast.success("Dados preenchidos automaticamente");
    } finally {
      setBuscandoCNPJ(false);
    }
  };

  const adicionarItem = () => setItens([...itens, itemVazio()]);
  const removerItem = (idx: number) => setItens(itens.filter((_, i) => i !== idx));
  const atualizarItem = (idx: number, campo: keyof ItemNFe, valor: any) => {
    const novos = [...itens]; (novos[idx] as any)[campo] = valor; setItens(novos);
  };

  const totalProdutos = useMemo(
    () => itens.reduce((acc, it) => acc + (Number(it.quantidade) || 0) * (Number(it.valor_unitario) || 0), 0),
    [itens]
  );
  const totalNota = modelo === "nfse"
    ? serviceValor
    : totalProdutos + valorFrete + valorSeguro + outrasDespesas - desconto;

  // ======= Validação específica do bloco Transporte (modalidade_frete) =======
  const transporteValidacao = useMemo(() => {
    const erros: string[] = [];
    const avisos: string[] = [];
    const m = transporte.modalidade_frete;
    const exigeTransportador = m === "0" || m === "1" || m === "2"; // CIF, FOB, terceiros
    const proprio = m === "3" || m === "4"; // próprio remetente/destinatário
    const semFrete = m === "9";

    if (semFrete) {
      const algumDado =
        transporte.transportador_nome || transporte.transportador_doc ||
        transporte.placa_veiculo || transporte.qtd_volumes ||
        transporte.peso_bruto || transporte.peso_liquido;
      if (algumDado) avisos.push('Modalidade "9 — Sem frete" dispensa transportador e volumes. Os dados preenchidos serão ignorados pela SEFAZ.');
    }

    if (exigeTransportador || proprio) {
      if (!transporte.transportador_nome.trim()) erros.push("Informe a razão social/nome do transportador.");
      const docLimpo = transporte.transportador_doc.replace(/\D/g, "");
      if (!docLimpo) erros.push("Informe o CNPJ/CPF do transportador.");
      else if (docLimpo.length !== 11 && docLimpo.length !== 14) erros.push("CNPJ/CPF do transportador inválido.");
      if (!transporte.transportador_uf || transporte.transportador_uf.length !== 2) avisos.push("UF do transportador não informada.");
      // Volumes
      const qtd = Number(transporte.qtd_volumes);
      if (!transporte.qtd_volumes || isNaN(qtd) || qtd <= 0) erros.push("Informe a quantidade de volumes transportados.");
      if (!transporte.especie.trim()) erros.push("Informe a espécie dos volumes (Caixa, Pallet, etc.).");
      const pb = Number(String(transporte.peso_bruto).replace(",", "."));
      const pl = Number(String(transporte.peso_liquido).replace(",", "."));
      if (!transporte.peso_bruto || isNaN(pb) || pb <= 0) erros.push("Informe o peso bruto total (kg).");
      if (!transporte.peso_liquido || isNaN(pl) || pl <= 0) erros.push("Informe o peso líquido total (kg).");
      if (!isNaN(pb) && !isNaN(pl) && pl > pb) erros.push("Peso líquido não pode ser maior que o peso bruto.");
      // Veículo (apenas avisos — opcional na SEFAZ)
      if (proprio && !transporte.placa_veiculo.trim()) avisos.push("Frete próprio: recomenda-se informar a placa do veículo.");
      if (transporte.placa_veiculo && !transporte.uf_veiculo) avisos.push("UF da placa do veículo não informada.");
    }

    return { erros, avisos };
  }, [transporte]);

  // ======= Validações pré-envio (estilo SEFAZ) =======
  const validacoes = useMemo(() => {
    const erros: string[] = [];
    const avisos: string[] = [];
    if (!empresaAtiva) erros.push("Selecione uma empresa ativa.");
    if (empresaAtiva && (!empresaAtiva.cnpj || !empresaAtiva.razao_social)) erros.push("Empresa emitente sem CNPJ ou razão social.");
    if (empresaAtiva && !empresaAtiva.inscricao_estadual && modelo !== "nfse") avisos.push("Emitente sem Inscrição Estadual cadastrada.");
    if (!destinatario.nome) erros.push("Destinatário sem nome/razão social.");
    if (!destinatario.documento) erros.push("Destinatário sem CPF/CNPJ.");
    else {
      // Mesmo rigor já aplicado ao transportador: sem 11/14 dígitos o payload
      // sai sem `cpf` nem `cnpj` (ver emitir()) e a SEFAZ rejeita.
      const docDest = destinatario.documento.replace(/\D/g, "");
      if (docDest.length !== 11 && docDest.length !== 14) {
        erros.push("CPF/CNPJ do destinatário inválido — 11 dígitos para CPF ou 14 para CNPJ.");
      }
    }
    if (modelo !== "nfse") {
      if (!destinatario.uf) avisos.push("UF do destinatário não informada.");
      if (itens.some(i => !i.descricao)) erros.push("Existem itens sem descrição.");
      if (itens.some(i => !i.ncm || i.ncm.length < 8)) erros.push("NCM inválido (deve conter 8 dígitos) em algum item.");
      if (itens.some(i => i.valor_unitario <= 0)) erros.push("Item com valor unitário zerado.");
      if (itens.some(i => i.quantidade <= 0)) erros.push("Item com quantidade zerada.");
      if (totalNota <= 0) erros.push("Valor total da nota deve ser maior que zero.");
      erros.push(...transporteValidacao.erros);
      avisos.push(...transporteValidacao.avisos);

      // Sprint 1: refNFe obrigatória em devolução (finalidade=4)
      if (finalidade === "4") {
        const chave = (fiscais.refNFe || "").replace(/\D/g, "");
        if (!chave) erros.push("Devolução (finalidade 4) exige a chave da NF-e referenciada (44 dígitos).");
        else if (chave.length !== 44) erros.push("Chave da NF-e referenciada inválida — deve conter 44 dígitos.");
      }
      // Sprint 1: indFinal=1 → presença não pode ser 0 (sem operação presencial)
      if (fiscais.indFinal === "1" && presenca === "0") {
        avisos.push("Consumidor final geralmente exige indicador de presença diferente de 0.");
      }
      // Sprint 2: contingência exige justificativa em info complementar
      if (fiscais.tpEmis !== "1" && (!infoComplementares || infoComplementares.trim().length < 15)) {
        erros.push("Modo de emissão em contingência exige justificativa (mín. 15 caracteres) nas informações complementares.");
      }
      // Sprint 3: validar CNPJs autorizados (autXML)
      if (fiscais.autXML.length > 10) erros.push("Máximo de 10 CNPJs autorizados a baixar o XML.");
      const autInvalidos = fiscais.autXML.filter(c => c.replace(/\D/g, "").length !== 14);
      if (autInvalidos.length) erros.push(`CNPJ(s) autorizado(s) inválido(s): ${autInvalidos.join(", ")}`);
      // Sprint 3: numeração manual
      if (fiscais.numero_manual) {
        const n = Number(fiscais.numero_manual);
        if (!Number.isInteger(n) || n <= 0 || n > 999999999) erros.push("Número manual da NF-e inválido (1 a 999.999.999).");
      }
    } else {
      if (!serviceDescricao) erros.push("Descrição do serviço obrigatória.");
      if (serviceValor <= 0) erros.push("Valor do serviço deve ser maior que zero.");
    }
    return { erros, avisos, ok: erros.length === 0 };
  }, [empresaAtiva, destinatario, itens, modelo, serviceDescricao, serviceValor, totalNota, transporteValidacao, finalidade, presenca, fiscais, infoComplementares]);

  const emitir = async () => {
    if (!validacoes.ok) {
      toast.error("Corrija as inconsistências antes de transmitir");
      return;
    }
    setEmitting(true);
    try {
      const fnName = modelo === "nfse" ? "emitir-nfse" : "emitir-nfe";
      const docDest = destinatario.documento.replace(/\D/g, "");
      const payload: any = {
        empresa_id: empresaAtiva!.id,
        // Fix: edge fn needs cnpj_emitente explicitly
        cnpj_emitente: (empresaAtiva!.cnpj || "").replace(/\D/g, ""),
        modelo,
        natureza_operacao: naturezaOp,
        finalidade,
        presenca_comprador: presenca,
        serie,
        destinatario: {
          // Fix: edge fn reads razao_social, not nome
          razao_social: destinatario.nome,
          nome: destinatario.nome,
          // Fix: edge fn reads cnpj/cpf separately, not documento
          ...(docDest.length === 14 ? { cnpj: docDest } : {}),
          ...(docDest.length === 11 ? { cpf: docDest } : {}),
          email: destinatario.email || undefined,
          inscricao_estadual: destinatario.ie || undefined,
          indicador_ie: destinatario.indicador_ie,
          endereco: {
            logradouro: destinatario.logradouro,
            numero: destinatario.numero,
            complemento: destinatario.complemento,
            bairro: destinatario.bairro,
            cep: destinatario.cep.replace(/\D/g, ""),
            municipio: destinatario.municipio,
            uf: destinatario.uf,
          },
          telefone: destinatario.telefone || undefined,
        },
        transporte: { ...transporte },
        valores: { frete: valorFrete, seguro: valorSeguro, desconto, outras: outrasDespesas },
        info_complementares: infoComplementares || undefined,
        fiscais: {
          tpNF: fiscais.tpNF,
          indFinal: fiscais.indFinal,
          idDest: fiscais.idDest,
          tpEmis: fiscais.tpEmis,
          refNFe: fiscais.refNFe ? fiscais.refNFe.replace(/\D/g, "") : undefined,
          numero_manual: fiscais.numero_manual ? Number(fiscais.numero_manual) : undefined,
          autXML: fiscais.autXML.map(c => c.replace(/\D/g, "")).filter(c => c.length === 14),
        },
      };
      if (modelo === "nfse") {
        payload.servico = { descricao: serviceDescricao, valor: serviceValor, codigo_servico: serviceCodigo || undefined };
      } else {
        // Fix: transform flat item fields into nested icms/pis/cofins and add valor_total
        payload.itens = itens.map(item => {
          const qt = Number(item.quantidade) || 0;
          const pu = Number(item.valor_unitario) || 0;
          const vt = qt * pu;
          const aliqIcms = Number(item.aliq_icms) || 0;
          const aliqIpi  = Number(item.aliq_ipi)  || 0;
          const aliqPis  = Number(item.aliq_pis)  || 0;
          const aliqCofins = Number(item.aliq_cofins) || 0;
          return {
            codigo: item.codigo,
            descricao: item.descricao,
            ncm: item.ncm,
            cfop: item.cfop,
            unidade: item.unidade,
            quantidade: qt,
            valor_unitario: pu,
            valor_total: vt,
            icms: {
              origem: item.origem,
              cst: item.cst_csosn,
              aliquota: aliqIcms,
              base_calculo: vt,
              valor: parseFloat(((aliqIcms / 100) * vt).toFixed(2)),
            },
            pis: {
              cst: aliqPis > 0 ? "01" : "07",
              aliquota: aliqPis,
              valor: parseFloat(((aliqPis / 100) * vt).toFixed(2)),
            },
            cofins: {
              cst: aliqCofins > 0 ? "01" : "07",
              aliquota: aliqCofins,
              valor: parseFloat(((aliqCofins / 100) * vt).toFixed(2)),
            },
            ...(aliqIpi > 0 ? { ipi: { cst: "50", aliquota: aliqIpi, valor: parseFloat(((aliqIpi / 100) * vt).toFixed(2)) } } : {}),
          };
        });
        payload.valor_total = totalNota;
      }

      const { data, error } = await supabase.functions.invoke(fnName, { body: payload });
      if (error) throw error;
      if (data?.setup_required) {
        toast.warning(data.message || "Configure FOCUS_NFE_API_TOKEN para emitir.");
        return;
      }
      toast.success(data?.message || "NF-e enviada à SEFAZ — aguardando autorização...");
      await carregar();
      setActiveTab("emitidas");

      // Polling automático até autorização + download do DANFE
      const nfeId = data?.nfe_id;
      if (nfeId && modelo !== "nfse") {
        await aguardarAutorizacaoEBaixar(nfeId);
        await carregar();
      }

    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setEmitting(false);
    }
  };

  // Espelhos das validações acima, para mostrar o erro JUNTO ao campo (a lista
  // bloqueante do passo 7 continua sendo a fonte — aqui só se aponta onde dói).
  const refNFeInvalida =
    finalidade === "4" && fiscais.refNFe.length > 0 && fiscais.refNFe.replace(/\D/g, "").length !== 44;
  const numeroManualInvalido = (() => {
    if (!fiscais.numero_manual) return false;
    const n = Number(fiscais.numero_manual);
    return !Number.isInteger(n) || n <= 0 || n > 999999999;
  })();
  const documentoDestInvalido = (() => {
    const d = destinatario.documento.replace(/\D/g, "");
    return d.length > 0 && d.length !== 11 && d.length !== 14;
  })();
  const justificativaContingenciaFalta =
    modelo !== "nfse" && fiscais.tpEmis !== "1" && infoComplementares.trim().length < 15;

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="faturas" className="gap-2">
            <Package className="h-4 w-4" />Faturas de pedido
            {pedidosFatura.filter(p => p.status === 'faturar').length > 0 && (
              <Badge variant="warning">
                {pedidosFatura.filter(p => p.status === 'faturar').length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="emissao" className="gap-2"><Send className="h-4 w-4" />Nova emissão</TabsTrigger>
          <TabsTrigger value="emitidas" className="gap-2"><FileText className="h-4 w-4" />Notas emitidas</TabsTrigger>
          <TabsTrigger value="guia" className="gap-2"><Info className="h-4 w-4" />Passo a passo (SEBRAE)</TabsTrigger>
        </TabsList>

        {/* ============ FATURAS DE PEDIDO ============ */}
        <TabsContent value="faturas">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" />Faturas de pedido</CardTitle>
                  <CardDescription>Pedidos que aguardam emissão de NF-e (A Faturar) ou que já foram faturados.</CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={carregarPedidosFatura} disabled={loadingPedidos}
                  aria-label="Atualizar a lista de pedidos a faturar">
                  {loadingPedidos ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Atualizar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingPedidos ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : pedidosFatura.length === 0 ? (
                <EstadoVazio
                  tamanho="compacto"
                  icone={<Package />}
                  titulo="Nenhum pedido aguardando faturamento"
                  descricao={'Pedidos aparecem aqui ao mover para "A Faturar" ou "Faturado" no Kanban de Gestão de Compras.'}
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">Nº</TableHead>
                        <TableHead className="whitespace-nowrap">Tipo</TableHead>
                        <TableHead>Cliente / fornecedor</TableHead>
                        <TableHead className="whitespace-nowrap text-right">Valor total</TableHead>
                        <TableHead className="whitespace-nowrap">Status do pedido</TableHead>
                        <TableHead className="whitespace-nowrap">NF-e vinculada</TableHead>
                        <TableHead className="whitespace-nowrap">Data</TableHead>
                        <TableHead className="whitespace-nowrap">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pedidosFatura.map(p => (
                        <TableRow key={p.id}>
                          <TableCell className="font-semibold tabular-nums">#{p.numero}</TableCell>
                          <TableCell>
                            <Badge variant="muted">{p.tipo === 'venda' ? 'Venda' : 'Compra'}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">{p.pessoa_nome || <span className="text-muted-foreground">—</span>}</div>
                            {p.pessoa_doc && <div className="text-xs text-muted-foreground">{p.pessoa_doc}</div>}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right tabular-nums">
                            {(p.valor_total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </TableCell>
                          <TableCell>
                            <Badge variant={p.status === 'faturado' ? 'success' : 'warning'}>
                              {p.status === 'faturado' ? 'Faturado' : 'A faturar'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {p.nfe_numero ? (
                              <div className="flex flex-col items-start gap-1">
                                <span className="text-sm font-medium">NF-e #{p.nfe_numero}</span>
                                <Badge variant={STATUS_VARIANT[p.nfe_status || ''] || 'muted'}>
                                  {STATUS_TEXTO[p.nfe_status || ''] || p.nfe_status || '—'}
                                </Badge>
                                {p.nfe_chave && (
                                  <span className="font-mono text-xs text-muted-foreground">{p.nfe_chave.slice(0, 8)}…{p.nfe_chave.slice(-4)}</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">Não emitida</span>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                            {new Date(p.created_at).toLocaleDateString('pt-BR')}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => navigate(`/gestao-compras?pedido=${p.id}`)}
                              >
                                <ExternalLink className="h-4 w-4" /> Detalhar pedido
                              </Button>
                              {p.nfe_id && (
                                <Button size="sm" variant="ghost" onClick={() => setActiveTab('emitidas')}>
                                  <FileText className="h-4 w-4" /> Ver NF-e
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

        {/* ============ EMISSAO ============ */}
        <TabsContent value="emissao" className="space-y-4">
          <Alert variant="info">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Configuração necessária</AlertTitle>
            <AlertDescription>
              A transmissão à SEFAZ depende do secret <code className="rounded bg-muted px-1">FOCUS_NFE_API_TOKEN</code> e de um certificado A1 cadastrado.
              Use <code className="rounded bg-muted px-1">FOCUS_NFE_AMBIENTE=homologacao</code> para testes.
            </AlertDescription>
          </Alert>

          {/* 1. Natureza */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />1. Natureza da operação (CFOP)</CardTitle>
              <CardDescription>Defina o tipo fiscal (venda, remessa, devolução, exportação).</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor="nfe-modelo">Modelo</Label>
                <Select value={modelo} onValueChange={v => setModelo(v as any)}>
                  <SelectTrigger id="nfe-modelo"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nfe">NF-e — Mercadoria (mod 55)</SelectItem>
                    <SelectItem value="nfce">NFC-e — Consumidor (mod 65)</SelectItem>
                    <SelectItem value="nfse">NFS-e — Serviço</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="nfe-natureza">Natureza da operação</Label>
                <Select value={naturezaOp} onValueChange={setNaturezaOp}>
                  <SelectTrigger id="nfe-natureza"><SelectValue /></SelectTrigger>
                  <SelectContent>{NATUREZAS_OPERACAO.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nfe-serie">Série</Label>
                <Input id="nfe-serie" type="number" min={1} value={serie} onChange={e => setSerie(Number(e.target.value))} />
              </div>
              {modelo !== "nfse" && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="nfe-finalidade">Finalidade</Label>
                    <Select value={finalidade} onValueChange={setFinalidade}>
                      <SelectTrigger id="nfe-finalidade"><SelectValue /></SelectTrigger>
                      <SelectContent>{FINALIDADES_NFE.map(f => <SelectItem key={f.codigo} value={f.codigo}>{f.codigo} — {f.descricao}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="nfe-presenca">Presença do comprador</Label>
                    <Select value={presenca} onValueChange={setPresenca}>
                      <SelectTrigger id="nfe-presenca"><SelectValue /></SelectTrigger>
                      <SelectContent>{PRESENCA_COMPRADOR.map(p => <SelectItem key={p.codigo} value={p.codigo}>{p.codigo} — {p.descricao}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* 1.5 Campos fiscais SEFAZ 4.00 */}
          {modelo !== "nfse" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" />1.5 Identificação fiscal (SEFAZ 4.00)</CardTitle>
                <CardDescription>
                  Campos obrigatórios do schema NF-e: tipo de operação, destino, consumidor final, contingência e referências.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="fiscal-tpnf">Tipo de operação (tpNF)</Label>
                    <Select value={fiscais.tpNF} onValueChange={v => setFiscais({ ...fiscais, tpNF: v as "0" | "1" })}>
                      <SelectTrigger id="fiscal-tpnf"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 — Saída</SelectItem>
                        <SelectItem value="0">0 — Entrada (devolução de fornecedor)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="fiscal-indfinal">Consumidor final (indFinal)</Label>
                    <Select value={fiscais.indFinal} onValueChange={v => setFiscais({ ...fiscais, indFinal: v as "0" | "1" })}>
                      <SelectTrigger id="fiscal-indfinal"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">0 — Operação normal</SelectItem>
                        <SelectItem value="1">1 — Consumidor final</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="fiscal-iddest">Destino (idDest) — auto</Label>
                    <Select value={fiscais.idDest} onValueChange={v => setFiscais({ ...fiscais, idDest: v as "1" | "2" | "3" })}>
                      <SelectTrigger id="fiscal-iddest" aria-describedby="fiscal-iddest-ajuda"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 — Operação interna</SelectItem>
                        <SelectItem value="2">2 — Interestadual</SelectItem>
                        <SelectItem value="3">3 — Exterior</SelectItem>
                      </SelectContent>
                    </Select>
                    <p id="fiscal-iddest-ajuda" className="text-xs text-muted-foreground">Calculado automaticamente pela UF emitente × destinatário.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="fiscal-tpemis">Tipo de emissão (tpEmis)</Label>
                    <Select value={fiscais.tpEmis} onValueChange={v => setFiscais({ ...fiscais, tpEmis: v as FiscaisExtras["tpEmis"] })}>
                      <SelectTrigger id="fiscal-tpemis"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 — Normal</SelectItem>
                        <SelectItem value="2">2 — Contingência FS-IA</SelectItem>
                        <SelectItem value="4">4 — EPEC (SCAN)</SelectItem>
                        <SelectItem value="5">5 — Contingência FS-DA</SelectItem>
                        <SelectItem value="6">6 — Contingência SVC-AN</SelectItem>
                        <SelectItem value="7">7 — Contingência SVC-RS</SelectItem>
                        <SelectItem value="9">9 — Contingência off-line NFC-e</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Referência NF-e (Devolução) */}
                {finalidade === "4" && (
                  <div className="space-y-1.5 rounded-md border border-border bg-muted p-4">
                    <Label htmlFor="fiscal-refnfe">NF-e referenciada (devolução)</Label>
                    <Input
                      id="fiscal-refnfe"
                      value={fiscais.refNFe}
                      onChange={e => setFiscais({ ...fiscais, refNFe: e.target.value.replace(/\D/g, "").slice(0, 44) })}
                      placeholder="44 dígitos da chave de acesso da NF-e original"
                      className="font-mono"
                      maxLength={44}
                      aria-invalid={refNFeInvalida || undefined}
                      aria-describedby={refNFeInvalida ? "fiscal-refnfe-erro" : "fiscal-refnfe-ajuda"}
                    />
                    {refNFeInvalida ? (
                      <p id="fiscal-refnfe-erro" className="text-xs text-destructive-ink">
                        Chave incompleta — {fiscais.refNFe.replace(/\D/g, "").length} de 44 dígitos (Rejeição 539).
                      </p>
                    ) : (
                      <p id="fiscal-refnfe-ajuda" className="text-xs text-muted-foreground">
                        Obrigatório (Rejeição 539). Cole a chave da NF-e original que está sendo devolvida.
                      </p>
                    )}
                  </div>
                )}

                {/* Numeração manual (Sprint 3) */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="fiscal-numero-manual">Número manual da NF-e (opcional)</Label>
                    <Input
                      id="fiscal-numero-manual"
                      type="number"
                      min={1}
                      value={fiscais.numero_manual}
                      onChange={e => setFiscais({ ...fiscais, numero_manual: e.target.value })}
                      placeholder="Deixe vazio para autonumeração"
                      aria-invalid={numeroManualInvalido || undefined}
                      aria-describedby={numeroManualInvalido ? "fiscal-numero-manual-erro" : "fiscal-numero-manual-ajuda"}
                    />
                    {numeroManualInvalido ? (
                      <p id="fiscal-numero-manual-erro" className="text-xs text-destructive-ink">
                        Número inválido — informe um inteiro de 1 a 999.999.999.
                      </p>
                    ) : (
                      <p id="fiscal-numero-manual-ajuda" className="text-xs text-muted-foreground">Use para migrar de outro emissor mantendo a sequência.</p>
                    )}
                  </div>
                </div>

                {/* CNPJs autorizados (autXML) — Sprint 3 */}
                <div className="space-y-3 rounded-md border border-border p-4">
                  <Label htmlFor="fiscal-autxml">CNPJs autorizados a baixar XML (autXML)</Label>
                  <p id="fiscal-autxml-ajuda" className="text-xs text-muted-foreground">
                    Até 10 CNPJs (ex.: contador, transportadora). Aparecem no XML autorizado pela SEFAZ.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Input
                      id="fiscal-autxml"
                      value={autXmlInput}
                      onChange={e => setAutXmlInput(e.target.value)}
                      placeholder="00.000.000/0000-00"
                      className="max-w-xs"
                      aria-describedby="fiscal-autxml-ajuda"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      aria-label="Adicionar CNPJ autorizado a baixar o XML"
                      onClick={() => {
                        const limpo = autXmlInput.replace(/\D/g, "");
                        if (limpo.length !== 14) { toast.error("CNPJ inválido"); return; }
                        if (fiscais.autXML.includes(limpo)) { toast.error("CNPJ já adicionado"); return; }
                        if (fiscais.autXML.length >= 10) { toast.error("Máximo de 10 CNPJs"); return; }
                        setFiscais({ ...fiscais, autXML: [...fiscais.autXML, limpo] });
                        setAutXmlInput("");
                      }}
                    >
                      <Plus className="h-4 w-4" /> Adicionar
                    </Button>
                  </div>
                  {fiscais.autXML.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {fiscais.autXML.map((c, i) => {
                        const formatado = c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
                        return (
                          <Badge key={i} variant="muted" className="gap-2">
                            {formatado}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={`Remover o CNPJ autorizado ${formatado}`}
                              onClick={() => setFiscais({ ...fiscais, autXML: fiscais.autXML.filter((_, idx) => idx !== i) })}
                              className="-mr-1 h-5 w-5 shrink-0 hover:bg-transparent hover:text-destructive-ink [&_svg]:size-3"
                            >
                              <Trash2 />
                            </Button>
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Alerta contingência */}
                {fiscais.tpEmis !== "1" && (
                  <Alert variant="warning">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Modo contingência ativo</AlertTitle>
                    <AlertDescription>
                      Use somente quando a SEFAZ de origem estiver indisponível. Justifique nas informações complementares (mín. 15 caracteres).
                      Após o restabelecimento, transmita as notas em até 168h.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

          {/* 2. Emitente */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />2. Dados do emitente</CardTitle>
              <CardDescription>Carregados automaticamente da empresa ativa. Edite no menu Configurações se necessário.</CardDescription>
            </CardHeader>
            <CardContent>
              {empresaAtiva ? (
                <dl className="grid grid-cols-1 gap-4 text-sm md:grid-cols-4">
                  <div><dt className="text-xs text-muted-foreground">Razão social</dt><dd className="font-medium">{empresaAtiva.razao_social}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">CNPJ</dt><dd className="font-medium">{empresaAtiva.cnpj}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">IE</dt><dd className="font-medium">{empresaAtiva.inscricao_estadual || <span className="text-destructive-ink">não cadastrada</span>}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Regime</dt><dd className="font-medium uppercase">{empresaAtiva.regime_tributario || "—"}</dd></div>
                  <div className="md:col-span-2"><dt className="text-xs text-muted-foreground">Endereço</dt><dd className="font-medium">{empresaAtiva.endereco || "—"}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Município/UF</dt><dd className="font-medium">{empresaAtiva.municipio || "—"}/{empresaAtiva.uf || "—"}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">CEP</dt><dd className="font-medium">{empresaAtiva.cep || "—"}</dd></div>
                </dl>
              ) : (
                <EstadoVazio
                  tamanho="compacto"
                  icone={<Building2 />}
                  titulo="Nenhuma empresa ativa selecionada"
                  descricao="Escolha a empresa emitente no seletor do topo para carregar CNPJ, IE e endereço."
                />
              )}
            </CardContent>
          </Card>

          {/* 3. Destinatário */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" />3. Destinatário</CardTitle>
              <CardDescription>Digite o CNPJ e clique em Buscar para preencher automaticamente via Receita Federal.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                <div className="space-y-1.5 md:col-span-3">
                  <Label htmlFor="dest-documento">CPF / CNPJ</Label>
                  <div className="flex gap-2">
                    <Input id="dest-documento" value={destinatario.documento}
                      onChange={e => setDestinatario({ ...destinatario, documento: e.target.value })}
                      placeholder="00.000.000/0000-00"
                      aria-invalid={documentoDestInvalido || undefined}
                      aria-describedby={documentoDestInvalido ? "dest-documento-erro" : undefined} />
                    <Button type="button" variant="outline" size="icon" onClick={buscarDestinatario} disabled={buscandoCNPJ}
                      aria-label="Buscar dados do destinatário pelo CNPJ">
                      {buscandoCNPJ ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </div>
                  {documentoDestInvalido && (
                    <p id="dest-documento-erro" className="text-xs text-destructive-ink">
                      Documento inválido — 11 dígitos para CPF ou 14 para CNPJ.
                    </p>
                  )}
                </div>
                <div className="space-y-1.5 md:col-span-5">
                  <Label htmlFor="dest-nome">Nome / Razão social</Label>
                  <Input id="dest-nome" value={destinatario.nome} onChange={e => setDestinatario({ ...destinatario, nome: e.target.value })} />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="dest-indicador-ie">Indicador IE</Label>
                  <Select value={destinatario.indicador_ie} onValueChange={v => setDestinatario({ ...destinatario, indicador_ie: v })}>
                    <SelectTrigger id="dest-indicador-ie"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 — Contribuinte ICMS</SelectItem>
                      <SelectItem value="2">2 — Isento</SelectItem>
                      <SelectItem value="9">9 — Não contribuinte</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="dest-ie">Inscrição Estadual</Label>
                  <Input id="dest-ie" value={destinatario.ie} onChange={e => setDestinatario({ ...destinatario, ie: e.target.value })} disabled={destinatario.indicador_ie !== "1"} />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                <div className="space-y-1.5 md:col-span-5">
                  <Label htmlFor="dest-logradouro">Logradouro</Label>
                  <Input id="dest-logradouro" value={destinatario.logradouro} onChange={e => setDestinatario({ ...destinatario, logradouro: e.target.value })} />
                </div>
                <div className="space-y-1.5 md:col-span-1">
                  <Label htmlFor="dest-numero">Número</Label>
                  <Input id="dest-numero" value={destinatario.numero} onChange={e => setDestinatario({ ...destinatario, numero: e.target.value })} />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="dest-complemento">Complemento</Label>
                  <Input id="dest-complemento" value={destinatario.complemento} onChange={e => setDestinatario({ ...destinatario, complemento: e.target.value })} />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="dest-bairro">Bairro</Label>
                  <Input id="dest-bairro" value={destinatario.bairro} onChange={e => setDestinatario({ ...destinatario, bairro: e.target.value })} />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="dest-cep">CEP</Label>
                  <Input id="dest-cep" value={destinatario.cep} onChange={e => setDestinatario({ ...destinatario, cep: e.target.value })} />
                </div>
                <div className="space-y-1.5 md:col-span-4">
                  <Label htmlFor="dest-municipio">Município</Label>
                  <Input id="dest-municipio" value={destinatario.municipio} onChange={e => setDestinatario({ ...destinatario, municipio: e.target.value })} />
                </div>
                <div className="space-y-1.5 md:col-span-1">
                  <Label htmlFor="dest-uf">UF</Label>
                  <Input id="dest-uf" maxLength={2} value={destinatario.uf} onChange={e => setDestinatario({ ...destinatario, uf: e.target.value.toUpperCase() })} />
                </div>
                <div className="space-y-1.5 md:col-span-3">
                  <Label htmlFor="dest-telefone">Telefone</Label>
                  <Input id="dest-telefone" value={destinatario.telefone} onChange={e => setDestinatario({ ...destinatario, telefone: e.target.value })} />
                </div>
                <div className="space-y-1.5 md:col-span-4">
                  <Label htmlFor="dest-email">E-mail</Label>
                  <Input id="dest-email" type="email" value={destinatario.email} onChange={e => setDestinatario({ ...destinatario, email: e.target.value })} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 4. Produtos / Serviço */}
          {modelo === "nfse" ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />4. Serviço prestado</CardTitle>
                <CardDescription>Descrição completa, código municipal e valor.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="servico-descricao">Descrição do serviço</Label>
                  <Textarea id="servico-descricao" rows={3} value={serviceDescricao} onChange={e => setServiceDescricao(e.target.value)} />
                </div>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="servico-codigo">Código municipal (LC 116/03)</Label>
                    <Input id="servico-codigo" value={serviceCodigo} onChange={e => setServiceCodigo(e.target.value)} placeholder="Ex: 1.05" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="servico-valor">Valor (R$)</Label>
                    <Input id="servico-valor" type="number" step="0.01" value={serviceValor} onChange={e => setServiceValor(Number(e.target.value))} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />4. Produtos / serviços</CardTitle>
                    <CardDescription>NCM (8 dígitos), CFOP, unidade, quantidade e valor.</CardDescription>
                  </div>
                  <Button size="sm" variant="outline" onClick={adicionarItem}><Plus className="h-4 w-4" />Adicionar item</Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {itens.map((it, idx) => {
                  const ncmInvalido = it.ncm.length > 0 && it.ncm.length !== 8;
                  return (
                  <div key={idx} className="space-y-4 rounded-lg border border-border bg-muted p-4">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="muted">Item {idx + 1}</Badge>
                      <Button size="icon" variant="ghost" onClick={() => removerItem(idx)} disabled={itens.length === 1}
                        aria-label={`Remover o item ${idx + 1}`}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                    <div className="grid grid-cols-12 gap-3">
                      <div className="col-span-12 space-y-1.5 md:col-span-2">
                        <Label htmlFor={`item-${idx}-codigo`}>Código</Label>
                        <Input id={`item-${idx}-codigo`} value={it.codigo} onChange={e => atualizarItem(idx, "codigo", e.target.value)} placeholder="PRD0001" />
                      </div>
                      <div className="col-span-12 space-y-1.5 md:col-span-6">
                        <Label htmlFor={`item-${idx}-descricao`}>Descrição</Label>
                        <Input id={`item-${idx}-descricao`} value={it.descricao} onChange={e => atualizarItem(idx, "descricao", e.target.value)} />
                      </div>
                      <div className="col-span-6 space-y-1.5 md:col-span-2">
                        <Label htmlFor={`item-${idx}-ncm`}>NCM</Label>
                        <Input id={`item-${idx}-ncm`} maxLength={8} value={it.ncm}
                          onChange={e => atualizarItem(idx, "ncm", e.target.value.replace(/\D/g, ""))} placeholder="00000000"
                          aria-invalid={ncmInvalido || undefined}
                          aria-describedby={ncmInvalido ? `item-${idx}-ncm-erro` : undefined} />
                        {ncmInvalido && (
                          <p id={`item-${idx}-ncm-erro`} className="text-xs text-destructive-ink">NCM deve ter 8 dígitos.</p>
                        )}
                      </div>
                      <div className="col-span-12 space-y-1.5 md:col-span-4">
                        {/* CFOPSelect é um combobox próprio (fora deste lote): o
                            rótulo fica visível, sem htmlFor apontando para nada. */}
                        <Label>CFOP</Label>
                        <CFOPSelect
                          value={it.cfop}
                          onChange={(v) => atualizarItem(idx, "cfop", v)}
                          tipo="saida"
                          ufDestino={
                            destinatario.uf && empresaAtiva?.uf
                              ? destinatario.uf === empresaAtiva.uf ? "mesma" : "outra"
                              : undefined
                          }
                          ufEmitente={empresaAtiva?.uf}
                          ufDestinatario={destinatario.uf}
                          finalidade={finalidade}
                        />
                      </div>
                      <div className="col-span-4 space-y-1.5 md:col-span-2">
                        <Label htmlFor={`item-${idx}-unidade`}>Unidade</Label>
                        <Select value={it.unidade} onValueChange={v => atualizarItem(idx, "unidade", v)}>
                          <SelectTrigger id={`item-${idx}-unidade`}><SelectValue /></SelectTrigger>
                          <SelectContent>{UNIDADES_COMERCIAIS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-4 space-y-1.5 md:col-span-2">
                        <Label htmlFor={`item-${idx}-quantidade`}>Quantidade</Label>
                        <Input id={`item-${idx}-quantidade`} type="number" step="0.01" value={it.quantidade} onChange={e => atualizarItem(idx, "quantidade", Number(e.target.value))} />
                      </div>
                      <div className="col-span-4 space-y-1.5 md:col-span-2">
                        <Label htmlFor={`item-${idx}-valor`}>Valor unitário</Label>
                        <Input id={`item-${idx}-valor`} type="number" step="0.01" value={it.valor_unitario} onChange={e => atualizarItem(idx, "valor_unitario", Number(e.target.value))} />
                      </div>
                      <div className="col-span-12 flex items-end justify-end md:col-span-6">
                        <div className="text-sm">
                          <span className="text-muted-foreground">Subtotal: </span>
                          <span className="font-semibold tabular-nums">{((it.quantidade || 0) * (it.valor_unitario || 0)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                        </div>
                      </div>
                    </div>
                    <Separator />
                    {/* Bloco fiscal */}
                    <div className="grid grid-cols-12 gap-3">
                      <div className="col-span-6 space-y-1.5 md:col-span-3">
                        <Label htmlFor={`item-${idx}-origem`} className="flex items-center gap-1"><Calculator className="h-3 w-3" />Origem</Label>
                        <Select value={it.origem} onValueChange={v => atualizarItem(idx, "origem", v)}>
                          <SelectTrigger id={`item-${idx}-origem`}><SelectValue /></SelectTrigger>
                          <SelectContent className="max-h-72">{ORIGEM_MERCADORIA.map(o => <SelectItem key={o.codigo} value={o.codigo}>{o.codigo} — {o.descricao}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-6 space-y-1.5 md:col-span-3">
                        <Label htmlFor={`item-${idx}-cst`}>{empresaAtiva?.regime_tributario === "simples" ? "CSOSN" : "CST ICMS"}</Label>
                        <Select value={it.cst_csosn} onValueChange={v => atualizarItem(idx, "cst_csosn", v)}>
                          <SelectTrigger id={`item-${idx}-cst`}><SelectValue /></SelectTrigger>
                          <SelectContent className="max-h-72">
                            {(empresaAtiva?.regime_tributario === "simples" ? CSOSN_OPCOES : CST_ICMS_OPCOES).map(c => <SelectItem key={c.codigo} value={c.codigo}>{c.codigo} — {c.descricao}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-6 space-y-1.5 md:col-span-2">
                        <Label htmlFor={`item-${idx}-icms`}>% ICMS</Label>
                        <Input id={`item-${idx}-icms`} type="number" step="0.01" value={it.aliq_icms} onChange={e => atualizarItem(idx, "aliq_icms", Number(e.target.value))} />
                      </div>
                      <div className="col-span-6 space-y-1.5 md:col-span-2">
                        <Label htmlFor={`item-${idx}-ipi`}>% IPI</Label>
                        <Input id={`item-${idx}-ipi`} type="number" step="0.01" value={it.aliq_ipi} onChange={e => atualizarItem(idx, "aliq_ipi", Number(e.target.value))} />
                      </div>
                      <div className="col-span-6 space-y-1.5 md:col-span-2">
                        <Label htmlFor={`item-${idx}-pis`}>% PIS</Label>
                        <Input id={`item-${idx}-pis`} type="number" step="0.01" value={it.aliq_pis} onChange={e => atualizarItem(idx, "aliq_pis", Number(e.target.value))} />
                      </div>
                      <div className="col-span-6 space-y-1.5 md:col-span-2">
                        <Label htmlFor={`item-${idx}-cofins`}>% COFINS</Label>
                        <Input id={`item-${idx}-cofins`} type="number" step="0.01" value={it.aliq_cofins} onChange={e => atualizarItem(idx, "aliq_cofins", Number(e.target.value))} />
                      </div>
                    </div>
                  </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* 5. Transporte (apenas NF-e) */}
          {modelo !== "nfse" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5" />5. Transporte</CardTitle>
                <CardDescription>Modalidade de frete e dados do transportador (se houver).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Modalidade */}
                <div className="space-y-1.5">
                  <Label htmlFor="transp-modalidade">Modalidade do frete</Label>
                  <Select value={transporte.modalidade_frete} onValueChange={v => setTransporte({ ...transporte, modalidade_frete: v })}>
                    <SelectTrigger id="transp-modalidade"><SelectValue /></SelectTrigger>
                    <SelectContent>{FRETE_MODALIDADES.map(f => <SelectItem key={f.codigo} value={f.codigo}>{f.codigo} — {f.descricao}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                {/* Transportador */}
                {transporte.modalidade_frete !== "9" && (
                  <div className="space-y-4 rounded-md border border-border bg-muted p-4">
                    <h3 className="text-lg font-semibold text-foreground">Dados do transportador</h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                      <div className="space-y-1.5 md:col-span-6">
                        <Label htmlFor="transp-nome">Razão social / Nome</Label>
                        <Input id="transp-nome" value={transporte.transportador_nome} onChange={e => setTransporte({ ...transporte, transportador_nome: e.target.value })} />
                      </div>
                      <div className="space-y-1.5 md:col-span-3">
                        <Label htmlFor="transp-doc">CNPJ/CPF</Label>
                        <Input id="transp-doc" value={transporte.transportador_doc} onChange={e => setTransporte({ ...transporte, transportador_doc: e.target.value })} placeholder="00.000.000/0000-00" />
                      </div>
                      <div className="space-y-1.5 md:col-span-3">
                        <Label htmlFor="transp-ie">Inscrição Estadual</Label>
                        <Input id="transp-ie" value={transporte.transportador_ie} onChange={e => setTransporte({ ...transporte, transportador_ie: e.target.value })} placeholder="ISENTO ou nº" />
                      </div>
                      <div className="space-y-1.5 md:col-span-6">
                        <Label htmlFor="transp-endereco">Endereço completo</Label>
                        <Input id="transp-endereco" value={transporte.transportador_endereco} onChange={e => setTransporte({ ...transporte, transportador_endereco: e.target.value })} placeholder="Rua, nº, bairro" />
                      </div>
                      <div className="space-y-1.5 md:col-span-4">
                        <Label htmlFor="transp-municipio">Município</Label>
                        <Input id="transp-municipio" value={transporte.transportador_municipio} onChange={e => setTransporte({ ...transporte, transportador_municipio: e.target.value })} />
                      </div>
                      <div className="space-y-1.5 md:col-span-2">
                        <Label htmlFor="transp-uf">UF</Label>
                        <Input id="transp-uf" maxLength={2} value={transporte.transportador_uf} onChange={e => setTransporte({ ...transporte, transportador_uf: e.target.value.toUpperCase() })} />
                      </div>
                    </div>

                    <h3 className="text-lg font-semibold text-foreground">Veículo</h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                      <div className="space-y-1.5 md:col-span-3">
                        <Label htmlFor="transp-placa">Placa</Label>
                        <Input id="transp-placa" value={transporte.placa_veiculo} onChange={e => setTransporte({ ...transporte, placa_veiculo: e.target.value.toUpperCase() })} placeholder="ABC1D23" />
                      </div>
                      <div className="space-y-1.5 md:col-span-2">
                        <Label htmlFor="transp-uf-placa">UF da placa</Label>
                        <Input id="transp-uf-placa" maxLength={2} value={transporte.uf_veiculo} onChange={e => setTransporte({ ...transporte, uf_veiculo: e.target.value.toUpperCase() })} />
                      </div>
                      <div className="space-y-1.5 md:col-span-3">
                        <Label htmlFor="transp-rntrc">RNTRC / ANTT</Label>
                        <Input id="transp-rntrc" value={transporte.rntrc_antt} onChange={e => setTransporte({ ...transporte, rntrc_antt: e.target.value })} placeholder="Registro ANTT" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Volumes */}
                <div className="space-y-4 rounded-md border border-border bg-muted p-4">
                  <h3 className="text-lg font-semibold text-foreground">Volumes transportados</h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                    <div className="space-y-1.5 md:col-span-2">
                      <Label htmlFor="vol-quantidade">Quantidade</Label>
                      <Input id="vol-quantidade" value={transporte.qtd_volumes} onChange={e => setTransporte({ ...transporte, qtd_volumes: e.target.value })} placeholder="Ex: 5" />
                    </div>
                    <div className="space-y-1.5 md:col-span-3">
                      <Label htmlFor="vol-especie">Espécie</Label>
                      <Input id="vol-especie" value={transporte.especie} onChange={e => setTransporte({ ...transporte, especie: e.target.value })} placeholder="Caixa, Pallet, Volume..." />
                    </div>
                    <div className="space-y-1.5 md:col-span-3">
                      <Label htmlFor="vol-marca">Marca</Label>
                      <Input id="vol-marca" value={transporte.marca_volumes} onChange={e => setTransporte({ ...transporte, marca_volumes: e.target.value })} placeholder="Marca da embalagem" />
                    </div>
                    <div className="space-y-1.5 md:col-span-4">
                      <Label htmlFor="vol-numeracao">Numeração</Label>
                      <Input id="vol-numeracao" value={transporte.numeracao_volumes} onChange={e => setTransporte({ ...transporte, numeracao_volumes: e.target.value })} placeholder="Ex: 001-005" />
                    </div>
                    <div className="space-y-1.5 md:col-span-3">
                      <Label htmlFor="vol-peso-bruto">Peso bruto (kg)</Label>
                      <Input id="vol-peso-bruto" type="number" step="0.001" value={transporte.peso_bruto} onChange={e => setTransporte({ ...transporte, peso_bruto: e.target.value })} placeholder="Ex: 12.500" />
                    </div>
                    <div className="space-y-1.5 md:col-span-3">
                      <Label htmlFor="vol-peso-liquido">Peso líquido (kg)</Label>
                      <Input id="vol-peso-liquido" type="number" step="0.001" value={transporte.peso_liquido} onChange={e => setTransporte({ ...transporte, peso_liquido: e.target.value })} placeholder="Ex: 12.000" />
                    </div>
                  </div>
                </div>

                {/* Alertas contextuais por modalidade */}
                {transporteValidacao.erros.length > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Dados de transporte obrigatórios</AlertTitle>
                    <AlertDescription>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                        {transporteValidacao.erros.map((e, i) => <li key={i}>{e}</li>)}
                      </ul>
                      <p className="mt-2 text-xs">A emissão será bloqueada até que estes campos sejam preenchidos.</p>
                    </AlertDescription>
                  </Alert>
                )}
                {transporteValidacao.erros.length === 0 && transporteValidacao.avisos.length > 0 && (
                  <Alert variant="warning">
                    <Info className="h-4 w-4" />
                    <AlertTitle>Atenção ao bloco de transporte</AlertTitle>
                    <AlertDescription>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                        {transporteValidacao.avisos.map((a, i) => <li key={i}>{a}</li>)}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

          {/* 6. Totais e info adicionais */}
          {modelo !== "nfse" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Calculator className="h-5 w-5" />6. Totais e informações complementares</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
                  <div className="space-y-1.5">
                    <Label htmlFor="tot-produtos">Total produtos</Label>
                    <Input id="tot-produtos" readOnly value={totalProdutos.toFixed(2)} className="bg-muted tabular-nums" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tot-frete">Frete (R$)</Label>
                    <Input id="tot-frete" type="number" step="0.01" value={valorFrete} onChange={e => setValorFrete(Number(e.target.value))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tot-seguro">Seguro (R$)</Label>
                    <Input id="tot-seguro" type="number" step="0.01" value={valorSeguro} onChange={e => setValorSeguro(Number(e.target.value))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tot-desconto">Desconto (R$)</Label>
                    <Input id="tot-desconto" type="number" step="0.01" value={desconto} onChange={e => setDesconto(Number(e.target.value))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tot-outras">Outras despesas (R$)</Label>
                    <Input id="tot-outras" type="number" step="0.01" value={outrasDespesas} onChange={e => setOutrasDespesas(Number(e.target.value))} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="info-complementares">Informações complementares</Label>
                  <Textarea id="info-complementares" rows={3} value={infoComplementares} onChange={e => setInfoComplementares(e.target.value)}
                    placeholder="Ex: NF-e ref. ao Empenho nº 001202/2026 — Contrato nº 0772/2024. Banco BANPARÁ Ag.0053 C/C 917650-0."
                    aria-invalid={justificativaContingenciaFalta || undefined}
                    aria-describedby={justificativaContingenciaFalta ? "info-complementares-erro" : undefined} />
                  {justificativaContingenciaFalta && (
                    <p id="info-complementares-erro" className="text-xs text-destructive-ink">
                      Emissão em contingência exige justificativa aqui — mínimo de 15 caracteres.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 7. Validação e transmissão */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" />7. Validar, assinar e transmitir</CardTitle>
              <CardDescription>O sistema verifica inconsistências antes do envio à SEFAZ.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {validacoes.erros.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Inconsistências bloqueantes ({validacoes.erros.length})</AlertTitle>
                  <AlertDescription>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                      {validacoes.erros.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
              {validacoes.avisos.length > 0 && (
                <Alert variant="warning">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Avisos ({validacoes.avisos.length})</AlertTitle>
                  <AlertDescription>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                      {validacoes.avisos.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
              {validacoes.ok && validacoes.avisos.length === 0 && (
                <Alert variant="success">
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Pronto para transmitir</AlertTitle>
                  <AlertDescription>Todos os campos obrigatórios foram validados.</AlertDescription>
                </Alert>
              )}

              <div className="flex flex-col gap-4 border-t border-border pt-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Valor total da nota</p>
                  <p className="text-[2rem] font-bold leading-10 tabular-nums text-foreground">
                    {totalNota.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={emitir} disabled={emitting || polling || !validacoes.ok} size="lg">
                    {(emitting || polling) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {emitting ? "Transmitindo à SEFAZ…"
                      : polling ? "Aguardando autorização…"
                      : "Assinar e transmitir"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ EMITIDAS ============ */}
        <TabsContent value="emitidas">
          <Card>
            <CardHeader>
              <CardTitle>Notas emitidas</CardTitle>
              <CardDescription>Últimas 50 notas registradas — após autorização da SEFAZ, baixe o XML e o DANFE.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingList ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : emitidas.length === 0 ? (
                <EstadoVazio
                  tamanho="compacto"
                  icone={<FileText />}
                  titulo="Nenhuma nota emitida ainda"
                  descricao="As notas transmitidas aparecem aqui com status, chave de acesso e o link do DANFE."
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">Modelo</TableHead>
                        <TableHead className="whitespace-nowrap">Nº/Série</TableHead>
                        <TableHead className="whitespace-nowrap">Chave</TableHead>
                        <TableHead>Destinatário</TableHead>
                        <TableHead className="whitespace-nowrap text-right">Valor</TableHead>
                        <TableHead className="whitespace-nowrap">Status</TableHead>
                        <TableHead>Progresso / motivo</TableHead>
                        <TableHead className="whitespace-nowrap">Ambiente</TableHead>
                        <TableHead className="whitespace-nowrap">Emissão</TableHead>
                        <TableHead className="whitespace-nowrap">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {emitidas.map(n => {
                        const dest = (n.destinatario_dados || {}) as any;
                        const isRefreshing = refreshingId === n.id;
                        const podeAtualizar = ["processando", "rascunho", "rejeitada"].includes(n.status);
                        const motivoTexto = n.motivo || STATUS_LABEL[n.status] || "—";
                        return (
                          <TableRow key={n.id}>
                            <TableCell className="uppercase whitespace-nowrap">{n.modelo}</TableCell>
                            <TableCell className="whitespace-nowrap">{n.numero ?? "—"}/{n.serie ?? "—"}</TableCell>
                            <TableCell className="font-mono text-xs whitespace-nowrap">{n.chave_acesso ? `${n.chave_acesso.slice(0, 8)}…${n.chave_acesso.slice(-4)}` : "—"}</TableCell>
                            <TableCell>
                              <div className="text-sm">{dest.nome || "—"}</div>
                              <div className="text-xs text-muted-foreground">{dest.documento || ""}</div>
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-right tabular-nums">{(n.valor_total || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                            <TableCell><Badge variant={STATUS_VARIANT[n.status] || "muted"}>{STATUS_TEXTO[n.status] || n.status}</Badge></TableCell>
                            <TableCell className="max-w-[280px]">
                              <div className="flex items-start gap-2">
                                {n.status === "processando" && <Loader2 className="mt-0.5 h-3 w-3 shrink-0 animate-spin text-muted-foreground" />}
                                {n.status === "autorizada" && <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-success-ink" />}
                                {(n.status === "rejeitada" || n.status === "denegada") && <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-destructive-ink" />}
                                <span className="line-clamp-2 text-sm text-muted-foreground" title={motivoTexto}>{motivoTexto}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={n.ambiente === "producao" ? "info" : "muted"}>
                                {/* valor fora do par conhecido continua aparecendo cru — rótulo não inventa ambiente */}
                                {n.ambiente === "producao" ? "Produção" : n.ambiente === "homologacao" ? "Homologação" : n.ambiente}
                              </Badge>
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{n.data_emissao ? new Date(n.data_emissao).toLocaleString("pt-BR") : "—"}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap items-center gap-2">
                                {podeAtualizar && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="shrink-0"
                                    onClick={() => atualizarStatusLinha(n.id)}
                                    disabled={isRefreshing}
                                    title="Consultar status atual na SEFAZ"
                                  >
                                    {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                    Atualizar status
                                  </Button>
                                )}
                                {n.xml_url && (
                                  <a href={n.xml_url} target="_blank" rel="noopener noreferrer"
                                    className="inline-flex shrink-0 items-center gap-1 rounded-md text-sm text-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                    XML <ExternalLink className="h-3 w-3" />
                                  </a>
                                )}
                                {n.status === "autorizada" ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="shrink-0"
                                    onClick={() => baixarDanfe(n.id)}
                                    disabled={downloading}
                                  >
                                    {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                                    DANFE
                                  </Button>
                                ) : (
                                  <span className="text-sm text-muted-foreground">DANFE indisponível</span>
                                )}
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
        </TabsContent>

        {/* ============ GUIA SEBRAE ============ */}
        <TabsContent value="guia">
          <Card>
            <CardHeader>
              <CardTitle>Operações na emissão — passo a passo</CardTitle>
              <CardDescription>Roteiro oficial baseado no manual SEBRAE de emissão fiscal.</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {ETAPAS_EMISSAO.map((e, i) => (
                  <li key={e.id} className="flex gap-3 rounded-lg border border-border p-4">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary-tint text-sm font-semibold text-primary">{i + 1}</div>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{e.titulo}</p>
                      <p className="text-sm text-muted-foreground">{e.descricao}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <Separator className="my-6" />
              <div className="space-y-2 text-xs text-muted-foreground">
                <p><strong>Base legal:</strong> Lei 14.133/2021, Convênio ICMS 110/05, Manual de Orientação ao Contribuinte (MOC) v7.0 — SEFAZ.</p>
                <p><strong>Certificação:</strong> A emissão exige certificado digital A1 ou A3 vinculado ao CNPJ emitente.</p>
                <p><strong>DANFE:</strong> Documento Auxiliar — não substitui a NF-e e só é válido após autorização da SEFAZ (chave de 44 dígitos).</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
