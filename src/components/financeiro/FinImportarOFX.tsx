import { useState, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Upload,
  Loader2,
  ArrowDownCircle,
  ArrowUpCircle,
  Sparkles,
  Pencil,
  CheckCircle2,
} from "lucide-react";
import {
  useContas,
  useEmpresaId,
  useCategorias,
  usePessoas,
} from "@/hooks/useFinanceiro";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { BancoLogo, findBanco } from "./BancoSelectorLogos";
import type { Database } from "@/integrations/supabase/types";

type TipoDocumento = Database["public"]["Enums"]["financeiro_tipo_documento"];

const TIPO_DOCUMENTO_OPTIONS: { value: TipoDocumento; label: string }[] = [
  { value: "outro", label: "Outros" },
  { value: "pix", label: "PIX" },
  { value: "ted", label: "TED" },
  { value: "doc", label: "DOC" },
  { value: "boleto", label: "Boleto" },
  { value: "nfe", label: "NF-e" },
  { value: "nfse", label: "NFS-e" },
  { value: "nfce", label: "NFC-e" },
  { value: "cte", label: "CT-e" },
  { value: "duplicata", label: "Duplicata" },
  { value: "fatura", label: "Fatura" },
  { value: "recibo", label: "Recibo" },
  { value: "contrato", label: "Contrato" },
  { value: "darf", label: "DARF" },
  { value: "das", label: "DAS" },
  { value: "gps", label: "GPS" },
  { value: "gnre", label: "GNRE" },
];

interface MovimentoEditavel {
  categoria_id: string | null;
  tipo_documento: TipoDocumento;
  numero_documento: string;
  pessoa_id: string | null;
  favorecido_texto: string; // nome bruto extraído (caso não vincule pessoa)
  observacoes: string;
}

interface MovimentoOFX {
  fitid: string;
  data: string;
  valor: number; // positivo = crédito, negativo = débito
  memo: string;
  tipo: "CREDIT" | "DEBIT";
  _sugestao?: { lancamento_id: string; descricao: string; valor: number };
  _ignorar?: boolean;
  _editado?: boolean;
  _detalhes: MovimentoEditavel;
}

// ─────────────────────────────────────────────────────────────────────────────
// Extração inteligente de metadados do MEMO/NAME do OFX
// ─────────────────────────────────────────────────────────────────────────────
function inferirTipoDocumento(memo: string): TipoDocumento {
  const m = memo.toUpperCase();
  if (/\bPIX\b|QR\s?CODE|PIX\s?ENVIADO|PIX\s?RECEBIDO/.test(m)) return "pix";
  if (/\bTED\b|TRANSF.*ELETR/.test(m)) return "ted";
  if (/\bDOC\b/.test(m)) return "doc";
  if (/BOLETO|TIT(\.|ULO)/.test(m)) return "boleto";
  if (/DARF/.test(m)) return "darf";
  if (/\bDAS\b|SIMPLES\s?NACIONAL/.test(m)) return "das";
  if (/\bGPS\b|PREVID/.test(m)) return "gps";
  if (/GNRE/.test(m)) return "gnre";
  if (/NF[-\s]?E|NOTA\s?FISCAL\s?ELETR/.test(m)) return "nfe";
  if (/NFS[-\s]?E|SERVI[CÇ]O\s?ELETR/.test(m)) return "nfse";
  if (/DUPLICATA|DUPL\b/.test(m)) return "duplicata";
  if (/FATURA/.test(m)) return "fatura";
  if (/RECIBO/.test(m)) return "recibo";
  if (/CONTRATO/.test(m)) return "contrato";
  if (/CT[-\s]?E/.test(m)) return "cte";
  return "outro";
}

function extrairNumeroDocumento(memo: string): string {
  // Procura sequências numéricas longas (>= 5 dígitos) — comum em IDs PIX, boletos, NFs
  const match = memo.match(/\b\d{5,}\b/);
  return match?.[0] ?? "";
}

function extrairFavorecido(memo: string): string {
  // Remove códigos numéricos e palavras-chave ruidosas, devolve nome em Title Case
  let s = memo
    .replace(/\b\d{5,}\b/g, " ")
    .replace(
      /\b(PIX|TED|DOC|BOLETO|TAR|TARIFA|ENVIADO|RECEBIDO|TRANSF|TRANSFERENCIA|CR[ÉE]DITO|D[ÉE]BITO|QR\s?CODE|PLANO|ADAPT|LIQ|EST[AÁ]TICO|EM|DE|PARA|DA|DO|N[ºO°]?)\b/gi,
      " "
    )
    .replace(/[^\p{L}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (s.length < 3) return "";
  // Title Case
  return s
    .toLowerCase()
    .split(" ")
    .filter((w) => w.length > 1)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function inferirCategoria(
  memo: string,
  natureza: "receita" | "despesa",
  categorias: { id: string; nome: string; natureza: string | null }[]
): string | null {
  const m = memo.toUpperCase();
  const candidatas = categorias.filter(
    (c) => !c.natureza || c.natureza === natureza
  );
  // Heurísticas de palavras-chave → nome de categoria
  const regras: { match: RegExp; alvo: RegExp }[] = [
    { match: /TAR|TARIFA|MANUTEN[ÇC]/, alvo: /tarifa|banc[áa]ria|servi[çc]o.*banc/i },
    { match: /JUROS|MULTA/, alvo: /juros|multa|encargo/i },
    { match: /SAL[AÁ]RIO|FOLHA/, alvo: /sal[áa]rio|folha/i },
    { match: /ALUGUEL|LOCA[ÇC]/, alvo: /aluguel|loca[çc]/i },
    { match: /ENERGIA|LUZ|CEMIG|ENEL|EQUATORIAL/, alvo: /energia|luz/i },
    { match: /[ÁA]GUA|SANEAGO|SABESP/, alvo: /[áa]gua/i },
    { match: /INTERNET|TELEFONIA|VIVO|CLARO|TIM|OI/, alvo: /internet|telefon|comunica/i },
    { match: /COMBUST|POSTO|GASOLINA|DIESEL/, alvo: /combust/i },
    { match: /IMPOSTO|DARF|DAS|INSS|FGTS/, alvo: /imposto|tribut/i },
  ];
  for (const r of regras) {
    if (r.match.test(m)) {
      const cat = candidatas.find((c) => r.alvo.test(c.nome));
      if (cat) return cat.id;
    }
  }
  return null;
}

function inferirPessoa(
  favorecido: string,
  pessoas: { id: string; nome: string }[]
): string | null {
  if (!favorecido) return null;
  const fav = favorecido.toLowerCase();
  // Match por inclusão substring de cada token significativo
  const tokens = fav.split(" ").filter((t) => t.length > 3);
  if (tokens.length === 0) return null;
  const found = pessoas.find((p) => {
    const n = p.nome.toLowerCase();
    return tokens.some((t) => n.includes(t)) || fav.includes(n);
  });
  return found?.id ?? null;
}

function parseOFX(text: string): MovimentoOFX[] {
  const movs: MovimentoOFX[] = [];
  const regex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text))) {
    const block = m[1];
    const get = (tag: string) => {
      const r = new RegExp(`<${tag}>([^<\\r\\n]+)`, "i").exec(block);
      return r?.[1]?.trim() || "";
    };
    const dtRaw = get("DTPOSTED").slice(0, 8);
    if (dtRaw.length !== 8) continue;
    const data = `${dtRaw.slice(0, 4)}-${dtRaw.slice(4, 6)}-${dtRaw.slice(6, 8)}`;
    const valor = parseFloat(get("TRNAMT").replace(",", ".")) || 0;
    const tipo =
      get("TRNTYPE").toUpperCase().includes("CREDIT") || valor > 0
        ? "CREDIT"
        : "DEBIT";
    const memo = get("MEMO") || get("NAME") || "Movimento bancário";
    movs.push({
      fitid: get("FITID") || `${data}-${valor}-${movs.length}`,
      data,
      valor,
      memo,
      tipo,
      _detalhes: {
        categoria_id: null,
        tipo_documento: inferirTipoDocumento(memo),
        numero_documento: extrairNumeroDocumento(memo),
        pessoa_id: null,
        favorecido_texto: extrairFavorecido(memo),
        observacoes: memo,
      },
    });
  }
  return movs;
}

export default function FinImportarOFX() {
  const empresaId = useEmpresaId();
  const qc = useQueryClient();
  const { data: contas = [] } = useContas();
  const { data: categorias = [] } = useCategorias();
  const { data: pessoas = [] } = usePessoas();
  const [contaId, setContaId] = useState<string>("");
  const [movimentos, setMovimentos] = useState<MovimentoOFX[]>([]);
  const [analisando, setAnalisando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const movimentoEdit = editIdx !== null ? movimentos[editIdx] : null;

  const categoriasReceita = useMemo(
    () => categorias.filter((c) => !c.natureza || c.natureza === "receita"),
    [categorias]
  );
  const categoriasDespesa = useMemo(
    () => categorias.filter((c) => !c.natureza || c.natureza === "despesa"),
    [categorias]
  );

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const text = String(reader.result || "");
      const parsed = parseOFX(text);
      if (parsed.length === 0) {
        toast.error("Nenhuma transação encontrada. Verifique o arquivo OFX.");
        return;
      }
      // enriquecimento inteligente: categoria + pessoa
      const enriquecido = parsed.map((mov) => {
        const natureza = mov.valor > 0 ? "receita" : "despesa";
        const cat = inferirCategoria(mov.memo, natureza, categorias);
        const pid = inferirPessoa(mov._detalhes.favorecido_texto, pessoas);
        return {
          ...mov,
          _detalhes: { ...mov._detalhes, categoria_id: cat, pessoa_id: pid },
        };
      });
      setMovimentos(enriquecido);
      toast.success(`${enriquecido.length} movimentação(ões) detectada(s).`);
      if (empresaId) await sugerirConciliacao(enriquecido);
    };
    reader.readAsText(f, "utf-8");
  }

  async function sugerirConciliacao(movs: MovimentoOFX[]) {
    setAnalisando(true);
    try {
      const datas = movs.map((m) => m.data);
      const dataMin = datas.reduce((a, b) => (a < b ? a : b));
      const dataMax = datas.reduce((a, b) => (a > b ? a : b));
      const { data: pendentes } = await supabase
        .from("financeiro_lancamentos")
        .select("id, descricao, valor, tipo")
        .eq("empresa_id", empresaId!)
        .in("status", ["previsto", "em_atraso"])
        .gte("data_vencimento", dataMin)
        .lte("data_vencimento", dataMax)
        .limit(500);
      const pool = pendentes ?? [];
      const usados = new Set<string>();
      const novos = movs.map((mov) => {
        const valorAbs = Math.abs(mov.valor);
        const tipoEsperado = mov.valor > 0 ? "a_receber" : "a_pagar";
        const cand = pool.find(
          (p) =>
            !usados.has(p.id) &&
            p.tipo === tipoEsperado &&
            Math.abs(Number(p.valor) - valorAbs) < 0.01
        );
        if (cand) {
          usados.add(cand.id);
          return {
            ...mov,
            _sugestao: {
              lancamento_id: cand.id,
              descricao: cand.descricao,
              valor: Number(cand.valor),
            },
          };
        }
        return mov;
      });
      setMovimentos(novos);
      const matches = novos.filter((m) => m._sugestao).length;
      if (matches > 0)
        toast.success(`${matches} conciliação(ões) sugerida(s) automaticamente.`);
    } finally {
      setAnalisando(false);
    }
  }

  function validarConta(conta: typeof contas[number] | undefined): string[] {
    const erros: string[] = [];
    if (!conta) {
      erros.push("Selecione uma conta de destino.");
      return erros;
    }
    if (!conta.banco_nome || !String(conta.banco_nome).trim()) {
      erros.push(
        "A conta selecionada não possui banco cadastrado (banco_nome)."
      );
    }
    if (!conta.agencia || !String(conta.agencia).trim()) {
      erros.push("A conta selecionada não possui agência cadastrada.");
    }
    if (!conta.conta || !String(conta.conta).trim()) {
      erros.push("A conta selecionada não possui número da conta cadastrado.");
    }
    return erros;
  }

  function atualizarDetalhe(idx: number, patch: Partial<MovimentoEditavel>) {
    setMovimentos((prev) =>
      prev.map((m, i) =>
        i === idx
          ? { ...m, _editado: true, _detalhes: { ...m._detalhes, ...patch } }
          : m
      )
    );
  }

  async function importar() {
    if (!contaId || movimentos.length === 0) return;
    const contaSel = contas.find((c) => c.id === contaId);
    const erros = validarConta(contaSel);
    if (erros.length > 0) {
      erros.forEach((e) => toast.error(e));
      toast.error(
        "Cadastro da conta incompleto. Atualize em Financeiro › Contas antes de importar o OFX."
      );
      return;
    }
    setImportando(true);
    try {
      const ativos = movimentos.filter((m) => !m._ignorar);
      const conciliacoes = ativos.filter((m) => m._sugestao);
      for (const c of conciliacoes) {
        await supabase
          .from("financeiro_lancamentos")
          .update({
            status: "conciliado",
            data_realizado: c.data,
            data_conciliado: new Date().toISOString(),
            conta_id: contaId,
          })
          .eq("id", c._sugestao!.lancamento_id);
      }
      // Filtra linhas informativas do OFX (saldos, totais) que vêm com valor 0
      // — o banco rejeita valor = 0 (CHECK valor > 0).
      const candidatos = ativos.filter((m) => !m._sugestao);
      const ignoradosZero = candidatos.filter((m) => Math.abs(m.valor) < 0.005);
      const novos = candidatos
        .filter((m) => Math.abs(m.valor) >= 0.005)
        .map((m) => ({
          empresa_id: empresaId!,
          tipo: "movimento_bancario" as const,
          natureza:
            m.valor > 0 ? ("receita" as const) : ("despesa" as const),
          status: "realizado" as const,
          descricao: (m.memo || "Movimento bancário").slice(0, 500),
          valor: Math.abs(m.valor),
          data_competencia: m.data,
          data_realizado: m.data,
          conta_id: contaId,
          origem: "ofx" as const,
          origem_ref: m.fitid,
          categoria_id: m._detalhes.categoria_id,
          pessoa_id: m._detalhes.pessoa_id,
          tipo_documento: m._detalhes.tipo_documento,
          numero_documento: m._detalhes.numero_documento || null,
          observacoes: m._detalhes.observacoes || null,
        }));
      if (novos.length > 0) {
        // Upsert para evitar erro se o mesmo FITID já foi importado antes
        const { error } = await supabase
          .from("financeiro_lancamentos")
          .upsert(novos, {
            onConflict: "empresa_id,origem,origem_ref",
            ignoreDuplicates: true,
          });
        if (error) throw error;
      }
      const partes = [
        `${conciliacoes.length} conciliação(ões)`,
        `${novos.length} novo(s) lançamento(s)`,
      ];
      if (ignoradosZero.length > 0) {
        partes.push(`${ignoradosZero.length} saldo(s) informativo(s) ignorado(s)`);
      }
      toast.success(`Importação concluída: ${partes.join(", ")}.`);
      setMovimentos([]);
      if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["fin-lancamentos"] });
      qc.invalidateQueries({ queryKey: ["fin-resumo-visor"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao importar OFX");
    } finally {
      setImportando(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Upload className="w-5 h-5 text-primary" /> Importar Extrato OFX
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Faça upload do arquivo .ofx do seu banco. O sistema detecta as
          transações, sugere conciliação automática e extrai categoria, tipo de
          documento, favorecido e número de documento — você pode revisar cada
          movimento antes de importar.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[12px] font-medium text-foreground/80">
              Conta de destino
            </Label>
            <Select value={contaId} onValueChange={setContaId}>
              <SelectTrigger className="h-[52px] py-0 pl-2 pr-3 [&>span]:line-clamp-none">
                {(() => {
                  const sel = contas.find((c) => c.id === contaId);
                  if (!sel)
                    return (
                      <SelectValue placeholder="Selecione a conta corrente para importar o extrato" />
                    );
                  const b = findBanco(sel.banco_nome ?? "");
                  const nomeExibido = b?.nome ?? sel.banco_nome ?? sel.nome;
                  return (
                    <div className="flex items-center gap-2.5 text-left w-full min-w-0">
                      <div className="shrink-0 w-9 h-9 rounded-[6px] bg-background border border-border/70 flex items-center justify-center overflow-hidden">
                        <BancoLogo
                          codigo={b?.codigo}
                          nome={nomeExibido}
                          size={28}
                        />
                      </div>
                      <div className="min-w-0 flex-1 flex flex-col justify-center">
                        <div className="text-[13px] font-semibold leading-[1.15] truncate text-foreground">
                          {nomeExibido}
                        </div>
                        <div className="text-[11px] font-normal text-muted-foreground leading-[1.3] truncate tabular-nums mt-[2px]">
                          {sel.agencia ? `Ag. ${sel.agencia}` : "Ag. —"}
                          <span className="mx-1.5 opacity-50">•</span>
                          {sel.conta ? `C/C ${sel.conta}` : "C/C —"}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </SelectTrigger>
              <SelectContent className="max-h-[320px] p-1">
                {contas
                  .filter((c) => c.ativa)
                  .map((c) => {
                    const b = findBanco(c.banco_nome ?? "");
                    const nomeExibido = b?.nome ?? c.banco_nome ?? c.nome;
                    return (
                      <SelectItem
                        key={c.id}
                        value={c.id}
                        className="h-[48px] py-0 pl-2 pr-2 rounded-[6px] focus:bg-accent/60 [&>span:first-child]:hidden [&>span:last-child]:w-full"
                      >
                        <div className="flex items-center gap-2.5 w-full min-w-0">
                          <div className="shrink-0 w-9 h-9 rounded-[6px] bg-background border border-border/70 flex items-center justify-center overflow-hidden">
                            <BancoLogo
                              codigo={b?.codigo}
                              nome={nomeExibido}
                              size={28}
                            />
                          </div>
                          <div className="min-w-0 flex-1 flex flex-col justify-center">
                            <div className="text-[13px] font-semibold leading-[1.15] truncate text-foreground">
                              {nomeExibido}
                            </div>
                            <div className="text-[11px] font-normal text-muted-foreground leading-[1.3] truncate tabular-nums mt-[2px]">
                              {c.agencia ? `Ag. ${c.agencia}` : "Ag. —"}
                              <span className="mx-1.5 opacity-50">•</span>
                              {c.conta ? `C/C ${c.conta}` : "C/C —"}
                            </div>
                          </div>
                        </div>
                      </SelectItem>
                    );
                  })}
              </SelectContent>
            </Select>
            {(() => {
              const sel = contas.find((c) => c.id === contaId);
              if (!sel) return null;
              const erros = validarConta(sel);
              if (erros.length === 0) return null;
              return (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-[11px] text-destructive space-y-0.5">
                  <div className="font-medium">Cadastro da conta incompleto:</div>
                  <ul className="list-disc list-inside">
                    {erros.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                  <div className="text-muted-foreground">
                    Atualize em Financeiro › Contas antes de importar.
                  </div>
                </div>
              );
            })()}
          </div>
          <div className="space-y-1.5">
            <Label>Arquivo .ofx</Label>
            <input
              ref={fileRef}
              type="file"
              accept=".ofx"
              onChange={handleFile}
              className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
            />
          </div>
        </div>

        {analisando && (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Sparkles className="w-4 h-4 animate-pulse text-primary" />
            Analisando transações e sugerindo conciliações...
          </div>
        )}

        {movimentos.length > 0 && (
          <>
            <div className="rounded-md border max-h-[450px] overflow-y-auto">
              {movimentos.map((m, i) => {
                const cat = categorias.find(
                  (c) => c.id === m._detalhes.categoria_id
                );
                const pes = pessoas.find((p) => p.id === m._detalhes.pessoa_id);
                return (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-2.5 border-b text-sm hover:bg-accent/30 transition-colors"
                  >
                    {m.valor > 0 ? (
                      <ArrowDownCircle className="w-4 h-4 text-success shrink-0" />
                    ) : (
                      <ArrowUpCircle className="w-4 h-4 text-destructive shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="truncate">{m.memo}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          {format(
                            new Date(m.data + "T00:00:00"),
                            "dd/MM/yyyy"
                          )}
                        </span>
                        {m._sugestao && (
                          <Badge variant="secondary" className="text-[10px]">
                            ✨ Conciliar: {m._sugestao.descricao.slice(0, 40)}
                          </Badge>
                        )}
                        {!m._sugestao && cat && (
                          <Badge variant="outline" className="text-[10px]">
                            {cat.nome}
                          </Badge>
                        )}
                        {!m._sugestao && pes && (
                          <Badge variant="outline" className="text-[10px]">
                            {pes.nome}
                          </Badge>
                        )}
                        {m._editado && !m._sugestao && (
                          <Badge
                            variant="default"
                            className="text-[10px] gap-1"
                          >
                            <CheckCircle2 className="w-2.5 h-2.5" /> editado
                          </Badge>
                        )}
                      </div>
                    </div>
                    <span
                      className={`tabular-nums font-medium ${
                        m.valor > 0 ? "text-success" : "text-destructive"
                      }`}
                    >
                      {m.valor > 0 ? "+" : ""} R${" "}
                      {m.valor.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                    {!m._sugestao && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[11px] gap-1 shrink-0"
                        onClick={() => setEditIdx(i)}
                      >
                        <Pencil className="w-3 h-3" />
                        Detalhes
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
            <Button
              onClick={importar}
              disabled={!contaId || importando}
              className="w-full"
            >
              {importando ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              Confirmar importação ({movimentos.length} movimento(s))
            </Button>
          </>
        )}

        {/* ───────── Diálogo estilo Omie: Adicionar como novo lançamento ───────── */}
        <Dialog
          open={editIdx !== null}
          onOpenChange={(o) => !o && setEditIdx(null)}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-base">
                Novo Lançamento de Conta Corrente
              </DialogTitle>
              <DialogDescription className="text-xs">
                Os campos foram preenchidos automaticamente a partir do extrato
                OFX. Edite o que for necessário antes de confirmar a importação.
              </DialogDescription>
            </DialogHeader>

            {movimentoEdit && editIdx !== null && (
              <div className="space-y-4">
                {/* Cabeçalho com banco + data + valor */}
                <div className="grid grid-cols-1 md:grid-cols-[auto_1fr_1fr_1fr] gap-3 items-center p-3 rounded-md border bg-muted/30">
                  {(() => {
                    const sel = contas.find((c) => c.id === contaId);
                    const b = findBanco(sel?.banco_nome ?? "");
                    return (
                      <div className="w-12 h-12 rounded-md bg-background border flex items-center justify-center">
                        <BancoLogo
                          codigo={b?.codigo}
                          nome={b?.nome ?? sel?.banco_nome ?? "—"}
                          size={36}
                        />
                      </div>
                    );
                  })()}
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground tracking-wide">
                      Conta Corrente
                    </div>
                    <div className="text-[13px] font-semibold truncate">
                      {contas.find((c) => c.id === contaId)?.banco_nome ??
                        contas.find((c) => c.id === contaId)?.nome ??
                        "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground tracking-wide">
                      Data do Movimento
                    </div>
                    <div className="text-[13px] font-medium tabular-nums">
                      {format(
                        new Date(movimentoEdit.data + "T00:00:00"),
                        "dd/MM/yyyy"
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground tracking-wide">
                      Valor do Lançamento
                    </div>
                    <div
                      className={`text-[13px] font-semibold tabular-nums ${
                        movimentoEdit.valor > 0
                          ? "text-success"
                          : "text-destructive"
                      }`}
                    >
                      R${" "}
                      {Math.abs(movimentoEdit.valor).toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}
                    </div>
                  </div>
                </div>

                {/* Linha 1: Categoria + Tipo doc + Número doc */}
                <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr] gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[12px]">
                      Categoria <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={movimentoEdit._detalhes.categoria_id ?? ""}
                      onValueChange={(v) =>
                        atualizarDetalhe(editIdx, {
                          categoria_id: v || null,
                        })
                      }
                    >
                      <SelectTrigger className="h-9 text-[13px]">
                        <SelectValue placeholder="Selecione uma categoria" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[280px]">
                        {(movimentoEdit.valor > 0
                          ? categoriasReceita
                          : categoriasDespesa
                        ).map((c) => (
                          <SelectItem
                            key={c.id}
                            value={c.id}
                            className="text-[13px]"
                          >
                            {c.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[12px]">Tipo de Documento</Label>
                    <Select
                      value={movimentoEdit._detalhes.tipo_documento}
                      onValueChange={(v) =>
                        atualizarDetalhe(editIdx, {
                          tipo_documento: v as TipoDocumento,
                        })
                      }
                    >
                      <SelectTrigger className="h-9 text-[13px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIPO_DOCUMENTO_OPTIONS.map((t) => (
                          <SelectItem
                            key={t.value}
                            value={t.value}
                            className="text-[13px]"
                          >
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[12px]">Número do Documento</Label>
                    <Input
                      value={movimentoEdit._detalhes.numero_documento}
                      onChange={(e) =>
                        atualizarDetalhe(editIdx, {
                          numero_documento: e.target.value,
                        })
                      }
                      className="h-9 text-[13px] tabular-nums"
                      placeholder="Ex.: 20260423004"
                    />
                  </div>
                </div>

                {/* Linha 2: Favorecido (Pessoa) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[12px]">Favorecido / Cliente</Label>
                    <Select
                      value={movimentoEdit._detalhes.pessoa_id ?? "_none_"}
                      onValueChange={(v) =>
                        atualizarDetalhe(editIdx, {
                          pessoa_id: v === "_none_" ? null : v,
                        })
                      }
                    >
                      <SelectTrigger className="h-9 text-[13px]">
                        <SelectValue
                          placeholder={
                            movimentoEdit._detalhes.favorecido_texto ||
                            "Não vinculado"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent className="max-h-[280px]">
                        <SelectItem value="_none_" className="text-[13px]">
                          — Não vincular pessoa —
                        </SelectItem>
                        {pessoas.map((p) => (
                          <SelectItem
                            key={p.id}
                            value={p.id}
                            className="text-[13px]"
                          >
                            {p.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {movimentoEdit._detalhes.favorecido_texto &&
                      !movimentoEdit._detalhes.pessoa_id && (
                        <p className="text-[10px] text-muted-foreground">
                          Detectado no extrato:{" "}
                          <span className="font-medium text-foreground/80">
                            {movimentoEdit._detalhes.favorecido_texto}
                          </span>
                        </p>
                      )}
                  </div>
                </div>

                {/* Observações */}
                <div className="space-y-1.5">
                  <Label className="text-[12px]">Observações</Label>
                  <Textarea
                    value={movimentoEdit._detalhes.observacoes}
                    onChange={(e) =>
                      atualizarDetalhe(editIdx, {
                        observacoes: e.target.value,
                      })
                    }
                    rows={3}
                    className="text-[13px] resize-none"
                  />
                </div>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setEditIdx(null)}>
                Cancelar
              </Button>
              <Button onClick={() => setEditIdx(null)}>
                <CheckCircle2 className="w-4 h-4 mr-1.5" /> Salvar e Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
