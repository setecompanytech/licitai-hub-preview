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

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  rascunho: "secondary", processando: "default", autorizada: "default",
  rejeitada: "destructive", cancelada: "destructive", denegada: "destructive",
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

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="faturas">
            <Package className="w-4 h-4 mr-1.5" />Faturas de pedido
            {pedidosFatura.filter(p => p.status === 'faturar').length > 0 && (
              <Badge className="ml-1.5 h-4 px-1 text-xs bg-warning text-warning-foreground border-0">
                {pedidosFatura.filter(p => p.status === 'faturar').length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="emissao"><Send className="w-4 h-4 mr-1.5" />Nova emissão</TabsTrigger>
          <TabsTrigger value="emitidas"><FileText className="w-4 h-4 mr-1.5" />Notas emitidas</TabsTrigger>
          <TabsTrigger value="guia"><Info className="w-4 h-4 mr-1.5" />Passo a passo (SEBRAE)</TabsTrigger>
        </TabsList>

        {/* ============ FATURAS DE PEDIDO ============ */}
        <TabsContent value="faturas">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2"><Package className="w-5 h-5" />Faturas de Pedido</CardTitle>
                  <CardDescription>Pedidos que aguardam emissão de NF-e (A Faturar) ou que já foram faturados. Clique em "Pré-preencher" para iniciar a emissão.</CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={carregarPedidosFatura} disabled={loadingPedidos}>
                  {loadingPedidos ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingPedidos ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : pedidosFatura.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
                  <Package className="w-10 h-10 text-muted-foreground/20" />
                  <p className="text-sm text-muted-foreground">Nenhum pedido aguardando faturamento</p>
                  <p className="text-xs text-muted-foreground">Pedidos aparecem aqui ao mover para "A Faturar" ou "Faturado" no Kanban de Gestão de Compras.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nº</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Cliente / Fornecedor</TableHead>
                        <TableHead>Valor Total</TableHead>
                        <TableHead>Status Pedido</TableHead>
                        <TableHead>NF-e Vinculada</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pedidosFatura.map(p => (
                        <TableRow key={p.id}>
                          <TableCell className="font-semibold">#{p.numero}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{p.tipo === 'venda' ? 'Venda' : 'Compra'}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">{p.pessoa_nome || <span className="text-muted-foreground">—</span>}</div>
                            {p.pessoa_doc && <div className="text-xs text-muted-foreground">{p.pessoa_doc}</div>}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {(p.valor_total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={p.status === 'faturado' ? 'default' : 'secondary'}
                              className={p.status === 'faturar' ? 'bg-warning/10 text-warning border-warning/30' : 'bg-success/10 text-success border-success/30'}
                            >
                              {p.status === 'faturado' ? 'Faturado' : 'A Faturar'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {p.nfe_numero ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="text-xs font-medium">NF-e #{p.nfe_numero}</span>
                                <Badge variant={STATUS_VARIANT[p.nfe_status || ''] || 'outline'} className="text-xs w-fit">
                                  {p.nfe_status || '—'}
                                </Badge>
                                {p.nfe_chave && (
                                  <span className="text-xs text-muted-foreground font-mono">{p.nfe_chave.slice(0, 8)}…{p.nfe_chave.slice(-4)}</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">Não emitida</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(p.created_at).toLocaleDateString('pt-BR')}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => navigate(`/gestao-compras?pedido=${p.id}`)}
                              >
                                <ExternalLink className="w-3 h-3 mr-1" /> Detalhar Pedido
                              </Button>
                              {p.nfe_id && (
                                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setActiveTab('emitidas')}>
                                  <FileText className="w-3 h-3 mr-1" /> Ver NF-e
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
          <Alert>
            <AlertCircle className="w-4 h-4" />
            <AlertTitle>Configuração necessária</AlertTitle>
            <AlertDescription>
              A transmissão à SEFAZ depende do secret <code className="bg-muted px-1 rounded">FOCUS_NFE_API_TOKEN</code> e de um certificado A1 cadastrado.
              Use <code className="bg-muted px-1 rounded">FOCUS_NFE_AMBIENTE=homologacao</code> para testes.
            </AlertDescription>
          </Alert>

          {/* 1. Natureza */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5" />1. Natureza da operação (CFOP)</CardTitle>
              <CardDescription>Defina o tipo fiscal (venda, remessa, devolução, exportação).</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <Label>Modelo</Label>
                <Select value={modelo} onValueChange={v => setModelo(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nfe">NF-e — Mercadoria (mod 55)</SelectItem>
                    <SelectItem value="nfce">NFC-e — Consumidor (mod 65)</SelectItem>
                    <SelectItem value="nfse">NFS-e — Serviço</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label>Natureza da operação</Label>
                <Select value={naturezaOp} onValueChange={setNaturezaOp}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{NATUREZAS_OPERACAO.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Série</Label>
                <Input type="number" min={1} value={serie} onChange={e => setSerie(Number(e.target.value))} />
              </div>
              {modelo !== "nfse" && (
                <>
                  <div>
                    <Label>Finalidade</Label>
                    <Select value={finalidade} onValueChange={setFinalidade}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{FINALIDADES_NFE.map(f => <SelectItem key={f.codigo} value={f.codigo}>{f.codigo} — {f.descricao}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Presença do comprador</Label>
                    <Select value={presenca} onValueChange={setPresenca}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
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
                <CardTitle className="flex items-center gap-2"><ShieldCheck className="w-5 h-5" />1.5 Identificação fiscal (SEFAZ 4.00)</CardTitle>
                <CardDescription>
                  Campos obrigatórios do schema NF-e: tipo de operação, destino, consumidor final, contingência e referências.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <Label>Tipo de operação (tpNF)</Label>
                    <Select value={fiscais.tpNF} onValueChange={v => setFiscais({ ...fiscais, tpNF: v as "0" | "1" })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 — Saída</SelectItem>
                        <SelectItem value="0">0 — Entrada (devolução de fornecedor)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Consumidor final (indFinal)</Label>
                    <Select value={fiscais.indFinal} onValueChange={v => setFiscais({ ...fiscais, indFinal: v as "0" | "1" })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">0 — Operação normal</SelectItem>
                        <SelectItem value="1">1 — Consumidor final</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Destino (idDest) — auto</Label>
                    <Select value={fiscais.idDest} onValueChange={v => setFiscais({ ...fiscais, idDest: v as "1" | "2" | "3" })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 — Operação interna</SelectItem>
                        <SelectItem value="2">2 — Interestadual</SelectItem>
                        <SelectItem value="3">3 — Exterior</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">Calculado automaticamente pela UF emitente × destinatário.</p>
                  </div>
                  <div>
                    <Label>Tipo de emissão (tpEmis)</Label>
                    <Select value={fiscais.tpEmis} onValueChange={v => setFiscais({ ...fiscais, tpEmis: v as FiscaisExtras["tpEmis"] })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
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
                  <div className="rounded-md border p-3 bg-muted/30 space-y-2">
                    <Label className="text-xs font-semibold uppercase">NF-e referenciada (devolução)</Label>
                    <Input
                      value={fiscais.refNFe}
                      onChange={e => setFiscais({ ...fiscais, refNFe: e.target.value.replace(/\D/g, "").slice(0, 44) })}
                      placeholder="44 dígitos da chave de acesso da NF-e original"
                      className="font-mono"
                      maxLength={44}
                    />
                    <p className="text-xs text-muted-foreground">
                      Obrigatório (Rejeição 539). Cole a chave da NF-e original que está sendo devolvida.
                    </p>
                  </div>
                )}

                {/* Numeração manual (Sprint 3) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label>Número manual da NF-e (opcional)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={fiscais.numero_manual}
                      onChange={e => setFiscais({ ...fiscais, numero_manual: e.target.value })}
                      placeholder="Deixe vazio para autonumeração"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Use para migrar de outro emissor mantendo a sequência.</p>
                  </div>
                </div>

                {/* CNPJs autorizados (autXML) — Sprint 3 */}
                <div className="rounded-md border p-3 space-y-2">
                  <Label className="text-xs font-semibold uppercase">CNPJs autorizados a baixar XML (autXML)</Label>
                  <p className="text-xs text-muted-foreground">
                    Até 10 CNPJs (ex.: contador, transportadora). Aparecem no XML autorizado pela SEFAZ.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      value={autXmlInput}
                      onChange={e => setAutXmlInput(e.target.value)}
                      placeholder="00.000.000/0000-00"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const limpo = autXmlInput.replace(/\D/g, "");
                        if (limpo.length !== 14) { toast.error("CNPJ inválido"); return; }
                        if (fiscais.autXML.includes(limpo)) { toast.error("CNPJ já adicionado"); return; }
                        if (fiscais.autXML.length >= 10) { toast.error("Máximo de 10 CNPJs"); return; }
                        setFiscais({ ...fiscais, autXML: [...fiscais.autXML, limpo] });
                        setAutXmlInput("");
                      }}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  {fiscais.autXML.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {fiscais.autXML.map((c, i) => (
                        <Badge key={i} variant="secondary" className="gap-1">
                          {c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")}
                          <button
                            type="button"
                            onClick={() => setFiscais({ ...fiscais, autXML: fiscais.autXML.filter((_, idx) => idx !== i) })}
                            className="ml-1 hover:text-destructive"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Alerta contingência */}
                {fiscais.tpEmis !== "1" && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Modo contingência ativo</AlertTitle>
                    <AlertDescription className="text-xs">
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
              <CardTitle className="flex items-center gap-2"><Building2 className="w-5 h-5" />2. Dados do emitente</CardTitle>
              <CardDescription>Carregados automaticamente da empresa ativa. Edite no menu Configurações se necessário.</CardDescription>
            </CardHeader>
            <CardContent>
              {empresaAtiva ? (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                  <div><Label className="text-xs text-muted-foreground">Razão social</Label><div className="font-medium">{empresaAtiva.razao_social}</div></div>
                  <div><Label className="text-xs text-muted-foreground">CNPJ</Label><div className="font-medium">{empresaAtiva.cnpj}</div></div>
                  <div><Label className="text-xs text-muted-foreground">IE</Label><div className="font-medium">{empresaAtiva.inscricao_estadual || <span className="text-destructive">não cadastrada</span>}</div></div>
                  <div><Label className="text-xs text-muted-foreground">Regime</Label><div className="font-medium uppercase">{empresaAtiva.regime_tributario || "—"}</div></div>
                  <div className="md:col-span-2"><Label className="text-xs text-muted-foreground">Endereço</Label><div className="font-medium">{empresaAtiva.endereco || "—"}</div></div>
                  <div><Label className="text-xs text-muted-foreground">Município/UF</Label><div className="font-medium">{empresaAtiva.municipio || "—"}/{empresaAtiva.uf || "—"}</div></div>
                  <div><Label className="text-xs text-muted-foreground">CEP</Label><div className="font-medium">{empresaAtiva.cep || "—"}</div></div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Nenhuma empresa ativa selecionada.</div>
              )}
            </CardContent>
          </Card>

          {/* 3. Destinatário */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><User className="w-5 h-5" />3. Destinatário</CardTitle>
              <CardDescription>Digite o CNPJ e clique em Buscar para preencher automaticamente via Receita Federal.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-3">
                  <Label>CPF / CNPJ</Label>
                  <div className="flex gap-1">
                    <Input value={destinatario.documento} onChange={e => setDestinatario({ ...destinatario, documento: e.target.value })} placeholder="00.000.000/0000-00" />
                    <Button type="button" variant="outline" size="icon" onClick={buscarDestinatario} disabled={buscandoCNPJ}>
                      {buscandoCNPJ ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                <div className="md:col-span-5"><Label>Nome / Razão social</Label><Input value={destinatario.nome} onChange={e => setDestinatario({ ...destinatario, nome: e.target.value })} /></div>
                <div className="md:col-span-2">
                  <Label>Indicador IE</Label>
                  <Select value={destinatario.indicador_ie} onValueChange={v => setDestinatario({ ...destinatario, indicador_ie: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 — Contribuinte ICMS</SelectItem>
                      <SelectItem value="2">2 — Isento</SelectItem>
                      <SelectItem value="9">9 — Não contribuinte</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2"><Label>Inscrição Estadual</Label><Input value={destinatario.ie} onChange={e => setDestinatario({ ...destinatario, ie: e.target.value })} disabled={destinatario.indicador_ie !== "1"} /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-5"><Label>Logradouro</Label><Input value={destinatario.logradouro} onChange={e => setDestinatario({ ...destinatario, logradouro: e.target.value })} /></div>
                <div className="md:col-span-1"><Label>Número</Label><Input value={destinatario.numero} onChange={e => setDestinatario({ ...destinatario, numero: e.target.value })} /></div>
                <div className="md:col-span-2"><Label>Complemento</Label><Input value={destinatario.complemento} onChange={e => setDestinatario({ ...destinatario, complemento: e.target.value })} /></div>
                <div className="md:col-span-2"><Label>Bairro</Label><Input value={destinatario.bairro} onChange={e => setDestinatario({ ...destinatario, bairro: e.target.value })} /></div>
                <div className="md:col-span-2"><Label>CEP</Label><Input value={destinatario.cep} onChange={e => setDestinatario({ ...destinatario, cep: e.target.value })} /></div>
                <div className="md:col-span-4"><Label>Município</Label><Input value={destinatario.municipio} onChange={e => setDestinatario({ ...destinatario, municipio: e.target.value })} /></div>
                <div className="md:col-span-1"><Label>UF</Label><Input maxLength={2} value={destinatario.uf} onChange={e => setDestinatario({ ...destinatario, uf: e.target.value.toUpperCase() })} /></div>
                <div className="md:col-span-3"><Label>Telefone</Label><Input value={destinatario.telefone} onChange={e => setDestinatario({ ...destinatario, telefone: e.target.value })} /></div>
                <div className="md:col-span-4"><Label>E-mail</Label><Input type="email" value={destinatario.email} onChange={e => setDestinatario({ ...destinatario, email: e.target.value })} /></div>
              </div>
            </CardContent>
          </Card>

          {/* 4. Produtos / Serviço */}
          {modelo === "nfse" ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5" />4. Serviço prestado</CardTitle>
                <CardDescription>Descrição completa, código municipal e valor.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2"><Label>Descrição do serviço</Label><Textarea rows={3} value={serviceDescricao} onChange={e => setServiceDescricao(e.target.value)} /></div>
                <div className="space-y-3">
                  <div><Label>Código municipal (LC 116/03)</Label><Input value={serviceCodigo} onChange={e => setServiceCodigo(e.target.value)} placeholder="Ex: 1.05" /></div>
                  <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={serviceValor} onChange={e => setServiceValor(Number(e.target.value))} /></div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5" />4. Produtos / Serviços</CardTitle>
                    <CardDescription>NCM (8 dígitos), CFOP, unidade, quantidade e valor.</CardDescription>
                  </div>
                  <Button size="sm" variant="outline" onClick={adicionarItem}><Plus className="w-4 h-4 mr-1" />Adicionar item</Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {itens.map((it, idx) => (
                  <div key={idx} className="border rounded-lg p-3 space-y-3 bg-muted/30">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">Item {idx + 1}</Badge>
                      <Button size="icon" variant="ghost" onClick={() => removerItem(idx)} disabled={itens.length === 1}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-12 md:col-span-2"><Label className="text-xs">Código</Label><Input value={it.codigo} onChange={e => atualizarItem(idx, "codigo", e.target.value)} placeholder="PRD0001" /></div>
                      <div className="col-span-12 md:col-span-6"><Label className="text-xs">Descrição</Label><Input value={it.descricao} onChange={e => atualizarItem(idx, "descricao", e.target.value)} /></div>
                      <div className="col-span-6 md:col-span-2"><Label className="text-xs">NCM</Label><Input maxLength={8} value={it.ncm} onChange={e => atualizarItem(idx, "ncm", e.target.value.replace(/\D/g, ""))} placeholder="00000000" /></div>
                      <div className="col-span-12 md:col-span-4">
                        <Label className="text-xs">CFOP</Label>
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
                      <div className="col-span-4 md:col-span-2">
                        <Label className="text-xs">Unidade</Label>
                        <Select value={it.unidade} onValueChange={v => atualizarItem(idx, "unidade", v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{UNIDADES_COMERCIAIS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-4 md:col-span-2"><Label className="text-xs">Quantidade</Label><Input type="number" step="0.01" value={it.quantidade} onChange={e => atualizarItem(idx, "quantidade", Number(e.target.value))} /></div>
                      <div className="col-span-4 md:col-span-2"><Label className="text-xs">Valor unitário</Label><Input type="number" step="0.01" value={it.valor_unitario} onChange={e => atualizarItem(idx, "valor_unitario", Number(e.target.value))} /></div>
                      <div className="col-span-12 md:col-span-6 flex items-end justify-end">
                        <div className="text-sm">
                          <span className="text-muted-foreground">Subtotal: </span>
                          <span className="font-semibold">{((it.quantidade || 0) * (it.valor_unitario || 0)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                        </div>
                      </div>
                    </div>
                    <Separator />
                    {/* Bloco fiscal */}
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-6 md:col-span-3">
                        <Label className="text-xs flex items-center gap-1"><Calculator className="w-3 h-3" />Origem</Label>
                        <Select value={it.origem} onValueChange={v => atualizarItem(idx, "origem", v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent className="max-h-72">{ORIGEM_MERCADORIA.map(o => <SelectItem key={o.codigo} value={o.codigo}>{o.codigo} — {o.descricao}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-6 md:col-span-3">
                        <Label className="text-xs">{empresaAtiva?.regime_tributario === "simples" ? "CSOSN" : "CST ICMS"}</Label>
                        <Select value={it.cst_csosn} onValueChange={v => atualizarItem(idx, "cst_csosn", v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent className="max-h-72">
                            {(empresaAtiva?.regime_tributario === "simples" ? CSOSN_OPCOES : CST_ICMS_OPCOES).map(c => <SelectItem key={c.codigo} value={c.codigo}>{c.codigo} — {c.descricao}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-3 md:col-span-2"><Label className="text-xs">% ICMS</Label><Input type="number" step="0.01" value={it.aliq_icms} onChange={e => atualizarItem(idx, "aliq_icms", Number(e.target.value))} /></div>
                      <div className="col-span-3 md:col-span-2"><Label className="text-xs">% IPI</Label><Input type="number" step="0.01" value={it.aliq_ipi} onChange={e => atualizarItem(idx, "aliq_ipi", Number(e.target.value))} /></div>
                      <div className="col-span-3 md:col-span-2"><Label className="text-xs">% PIS</Label><Input type="number" step="0.01" value={it.aliq_pis} onChange={e => atualizarItem(idx, "aliq_pis", Number(e.target.value))} /></div>
                      <div className="col-span-3 md:col-span-2"><Label className="text-xs">% COFINS</Label><Input type="number" step="0.01" value={it.aliq_cofins} onChange={e => atualizarItem(idx, "aliq_cofins", Number(e.target.value))} /></div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* 5. Transporte (apenas NF-e) */}
          {modelo !== "nfse" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Truck className="w-5 h-5" />5. Transporte</CardTitle>
                <CardDescription>Modalidade de frete e dados do transportador (se houver).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Modalidade */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  <div className="md:col-span-12">
                    <Label>Modalidade do frete</Label>
                    <Select value={transporte.modalidade_frete} onValueChange={v => setTransporte({ ...transporte, modalidade_frete: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{FRETE_MODALIDADES.map(f => <SelectItem key={f.codigo} value={f.codigo}>{f.codigo} — {f.descricao}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Transportador */}
                {transporte.modalidade_frete !== "9" && (
                  <div className="space-y-3 rounded-md border p-3 bg-muted/30">
                    <div className="text-xs font-semibold uppercase text-muted-foreground">Dados do transportador</div>
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                      <div className="md:col-span-6"><Label>Razão social / Nome</Label><Input value={transporte.transportador_nome} onChange={e => setTransporte({ ...transporte, transportador_nome: e.target.value })} /></div>
                      <div className="md:col-span-3"><Label>CNPJ/CPF</Label><Input value={transporte.transportador_doc} onChange={e => setTransporte({ ...transporte, transportador_doc: e.target.value })} placeholder="00.000.000/0000-00" /></div>
                      <div className="md:col-span-3"><Label>Inscrição Estadual</Label><Input value={transporte.transportador_ie} onChange={e => setTransporte({ ...transporte, transportador_ie: e.target.value })} placeholder="ISENTO ou nº" /></div>
                      <div className="md:col-span-6"><Label>Endereço completo</Label><Input value={transporte.transportador_endereco} onChange={e => setTransporte({ ...transporte, transportador_endereco: e.target.value })} placeholder="Rua, nº, bairro" /></div>
                      <div className="md:col-span-4"><Label>Município</Label><Input value={transporte.transportador_municipio} onChange={e => setTransporte({ ...transporte, transportador_municipio: e.target.value })} /></div>
                      <div className="md:col-span-2"><Label>UF</Label><Input maxLength={2} value={transporte.transportador_uf} onChange={e => setTransporte({ ...transporte, transportador_uf: e.target.value.toUpperCase() })} /></div>
                    </div>

                    <div className="text-xs font-semibold uppercase text-muted-foreground pt-1">Veículo</div>
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                      <div className="md:col-span-3"><Label>Placa</Label><Input value={transporte.placa_veiculo} onChange={e => setTransporte({ ...transporte, placa_veiculo: e.target.value.toUpperCase() })} placeholder="ABC1D23" /></div>
                      <div className="md:col-span-2"><Label>UF da placa</Label><Input maxLength={2} value={transporte.uf_veiculo} onChange={e => setTransporte({ ...transporte, uf_veiculo: e.target.value.toUpperCase() })} /></div>
                      <div className="md:col-span-3"><Label>RNTRC / ANTT</Label><Input value={transporte.rntrc_antt} onChange={e => setTransporte({ ...transporte, rntrc_antt: e.target.value })} placeholder="Registro ANTT" /></div>
                    </div>
                  </div>
                )}

                {/* Volumes */}
                <div className="space-y-2 rounded-md border p-3 bg-muted/30">
                  <div className="text-xs font-semibold uppercase text-muted-foreground">Volumes transportados</div>
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    <div className="md:col-span-2"><Label>Quantidade</Label><Input value={transporte.qtd_volumes} onChange={e => setTransporte({ ...transporte, qtd_volumes: e.target.value })} placeholder="Ex: 5" /></div>
                    <div className="md:col-span-3"><Label>Espécie</Label><Input value={transporte.especie} onChange={e => setTransporte({ ...transporte, especie: e.target.value })} placeholder="Caixa, Pallet, Volume..." /></div>
                    <div className="md:col-span-3"><Label>Marca</Label><Input value={transporte.marca_volumes} onChange={e => setTransporte({ ...transporte, marca_volumes: e.target.value })} placeholder="Marca da embalagem" /></div>
                    <div className="md:col-span-4"><Label>Numeração</Label><Input value={transporte.numeracao_volumes} onChange={e => setTransporte({ ...transporte, numeracao_volumes: e.target.value })} placeholder="Ex: 001-005" /></div>
                    <div className="md:col-span-3"><Label>Peso bruto (kg)</Label><Input type="number" step="0.001" value={transporte.peso_bruto} onChange={e => setTransporte({ ...transporte, peso_bruto: e.target.value })} placeholder="Ex: 12.500" /></div>
                    <div className="md:col-span-3"><Label>Peso líquido (kg)</Label><Input type="number" step="0.001" value={transporte.peso_liquido} onChange={e => setTransporte({ ...transporte, peso_liquido: e.target.value })} placeholder="Ex: 12.000" /></div>
                  </div>
                </div>

                {/* Alertas contextuais por modalidade */}
                {transporteValidacao.erros.length > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Dados de transporte obrigatórios</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc pl-5 text-sm space-y-0.5 mt-1">
                        {transporteValidacao.erros.map((e, i) => <li key={i}>{e}</li>)}
                      </ul>
                      <p className="text-xs mt-2 opacity-80">A emissão será bloqueada até que estes campos sejam preenchidos.</p>
                    </AlertDescription>
                  </Alert>
                )}
                {transporteValidacao.erros.length === 0 && transporteValidacao.avisos.length > 0 && (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>Atenção ao bloco de transporte</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc pl-5 text-sm space-y-0.5 mt-1">
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
                <CardTitle className="flex items-center gap-2"><Calculator className="w-5 h-5" />6. Totais e informações complementares</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div><Label className="text-xs">Total produtos</Label><Input readOnly value={totalProdutos.toFixed(2)} className="bg-muted" /></div>
                  <div><Label className="text-xs">Frete (R$)</Label><Input type="number" step="0.01" value={valorFrete} onChange={e => setValorFrete(Number(e.target.value))} /></div>
                  <div><Label className="text-xs">Seguro (R$)</Label><Input type="number" step="0.01" value={valorSeguro} onChange={e => setValorSeguro(Number(e.target.value))} /></div>
                  <div><Label className="text-xs">Desconto (R$)</Label><Input type="number" step="0.01" value={desconto} onChange={e => setDesconto(Number(e.target.value))} /></div>
                  <div><Label className="text-xs">Outras despesas (R$)</Label><Input type="number" step="0.01" value={outrasDespesas} onChange={e => setOutrasDespesas(Number(e.target.value))} /></div>
                </div>
                <div>
                  <Label>Informações complementares</Label>
                  <Textarea rows={3} value={infoComplementares} onChange={e => setInfoComplementares(e.target.value)} placeholder="Ex: NF-e ref. ao Empenho nº 001202/2026 — Contrato nº 0772/2024. Banco BANPARÁ Ag.0053 C/C 917650-0." />
                </div>
              </CardContent>
            </Card>
          )}

          {/* 7. Validação e transmissão */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ShieldCheck className="w-5 h-5" />7. Validar, assinar e transmitir</CardTitle>
              <CardDescription>O sistema verifica inconsistências antes do envio à SEFAZ.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {validacoes.erros.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="w-4 h-4" />
                  <AlertTitle>Inconsistências bloqueantes ({validacoes.erros.length})</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc pl-4 mt-1 space-y-0.5 text-xs">
                      {validacoes.erros.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
              {validacoes.avisos.length > 0 && (
                <Alert>
                  <AlertCircle className="w-4 h-4" />
                  <AlertTitle>Avisos ({validacoes.avisos.length})</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc pl-4 mt-1 space-y-0.5 text-xs">
                      {validacoes.avisos.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
              {validacoes.ok && validacoes.avisos.length === 0 && (
                <Alert>
                  <CheckCircle2 className="w-4 h-4" />
                  <AlertTitle>Pronto para transmitir</AlertTitle>
                  <AlertDescription>Todos os campos obrigatórios foram validados.</AlertDescription>
                </Alert>
              )}

              <div className="flex items-center justify-between border-t pt-4">
                <div className="text-sm">
                  <span className="text-muted-foreground">Valor total da nota: </span>
                  <span className="text-2xl font-bold">{totalNota.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                </div>
                <Button onClick={emitir} disabled={emitting || polling || !validacoes.ok} size="lg">
                  {emitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Transmitindo à SEFAZ...</>
                    : polling ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Aguardando autorização...</>
                    : <><Send className="w-4 h-4 mr-2" />Assinar e transmitir</>}
                </Button>
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
                <div className="text-sm text-muted-foreground py-6 text-center">Carregando...</div>
              ) : emitidas.length === 0 ? (
                <div className="text-sm text-muted-foreground py-6 text-center">Nenhuma nota emitida ainda.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Modelo</TableHead>
                        <TableHead>Nº/Série</TableHead>
                        <TableHead>Chave</TableHead>
                        <TableHead>Destinatário</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Progresso / Motivo</TableHead>
                        <TableHead>Ambiente</TableHead>
                        <TableHead>Emissão</TableHead>
                        <TableHead>Ações</TableHead>
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
                            <TableCell className="whitespace-nowrap">{(n.valor_total || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                            <TableCell><Badge variant={STATUS_VARIANT[n.status] || "secondary"}>{n.status}</Badge></TableCell>
                            <TableCell className="max-w-[280px]">
                              <div className="flex items-start gap-1.5">
                                {n.status === "processando" && <Loader2 className="w-3 h-3 mt-0.5 animate-spin text-muted-foreground shrink-0" />}
                                {n.status === "autorizada" && <CheckCircle2 className="w-3 h-3 mt-0.5 text-primary shrink-0" />}
                                {(n.status === "rejeitada" || n.status === "denegada") && <AlertCircle className="w-3 h-3 mt-0.5 text-destructive shrink-0" />}
                                <span className="text-xs text-muted-foreground line-clamp-2" title={motivoTexto}>{motivoTexto}</span>
                              </div>
                            </TableCell>
                            <TableCell><Badge variant={n.ambiente === "producao" ? "default" : "outline"}>{n.ambiente}</Badge></TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{n.data_emissao ? new Date(n.data_emissao).toLocaleString("pt-BR") : "—"}</TableCell>
                            <TableCell>
                              <div className="flex gap-2 items-center flex-wrap">
                                {podeAtualizar && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2 text-xs shrink-0"
                                    onClick={() => atualizarStatusLinha(n.id)}
                                    disabled={isRefreshing}
                                    title="Consultar status atual na SEFAZ"
                                  >
                                    {isRefreshing ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                                    Atualizar status
                                  </Button>
                                )}
                                {n.xml_url && <a href={n.xml_url} target="_blank" rel="noopener noreferrer" className="text-xs underline inline-flex items-center gap-1 shrink-0">XML <ExternalLink className="w-3 h-3" /></a>}
                                {n.status === "autorizada" ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2 text-xs shrink-0"
                                    onClick={() => baixarDanfe(n.id)}
                                    disabled={downloading}
                                  >
                                    {downloading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <FileDown className="w-3 h-3 mr-1" />}
                                    DANFE
                                  </Button>
                                ) : (
                                  <span className="text-xs text-muted-foreground">DANFE indisponível</span>
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
              <CardTitle>Operações na Emissão — Passo a Passo</CardTitle>
              <CardDescription>Roteiro oficial baseado no manual SEBRAE de emissão fiscal.</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {ETAPAS_EMISSAO.map((e, i) => (
                  <li key={e.id} className="flex gap-3 p-3 border rounded-lg">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">{i + 1}</div>
                    <div>
                      <div className="font-medium">{e.titulo}</div>
                      <div className="text-sm text-muted-foreground">{e.descricao}</div>
                    </div>
                  </li>
                ))}
              </ol>
              <Separator className="my-4" />
              <div className="text-xs text-muted-foreground space-y-1">
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
