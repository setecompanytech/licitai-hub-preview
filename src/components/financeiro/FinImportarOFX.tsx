import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Upload, Loader2, ArrowDownCircle, ArrowUpCircle, Sparkles } from "lucide-react";
import { useContas, useEmpresaId } from "@/hooks/useFinanceiro";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { BancoLogo, findBanco } from "./BancoSelectorLogos";

interface MovimentoOFX {
  fitid: string;
  data: string;
  valor: number; // positivo = crédito, negativo = débito
  memo: string;
  tipo: "CREDIT" | "DEBIT";
  _sugestao?: { lancamento_id: string; descricao: string; valor: number };
  _ignorar?: boolean;
}

function parseOFX(text: string): MovimentoOFX[] {
  // Parser leve para SGML/XML OFX — extrai blocos <STMTTRN>...</STMTTRN>
  const movs: MovimentoOFX[] = [];
  const regex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text))) {
    const block = m[1];
    const get = (tag: string) => {
      const r = new RegExp(`<${tag}>([^<\\r\\n]+)`, "i").exec(block);
      return r?.[1]?.trim() || "";
    };
    const dtRaw = get("DTPOSTED").slice(0, 8); // YYYYMMDD
    if (dtRaw.length !== 8) continue;
    const data = `${dtRaw.slice(0, 4)}-${dtRaw.slice(4, 6)}-${dtRaw.slice(6, 8)}`;
    const valor = parseFloat(get("TRNAMT").replace(",", ".")) || 0;
    const tipo = (get("TRNTYPE").toUpperCase().includes("CREDIT") || valor > 0) ? "CREDIT" : "DEBIT";
    movs.push({
      fitid: get("FITID") || `${data}-${valor}-${movs.length}`,
      data,
      valor,
      memo: get("MEMO") || get("NAME") || "Movimento bancário",
      tipo,
    });
  }
  return movs;
}

export default function FinImportarOFX() {
  const empresaId = useEmpresaId();
  const qc = useQueryClient();
  const { data: contas = [] } = useContas();
  const [contaId, setContaId] = useState<string>("");
  const [movimentos, setMovimentos] = useState<MovimentoOFX[]>([]);
  const [analisando, setAnalisando] = useState(false);
  const [importando, setImportando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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
      setMovimentos(parsed);
      toast.success(`${parsed.length} movimentação(ões) detectada(s).`);
      // Sugerir conciliação automática contra lançamentos previstos
      if (empresaId) await sugerirConciliacao(parsed);
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
        const cand = pool.find((p) =>
          !usados.has(p.id) &&
          p.tipo === tipoEsperado &&
          Math.abs(Number(p.valor) - valorAbs) < 0.01
        );
        if (cand) {
          usados.add(cand.id);
          return { ...mov, _sugestao: { lancamento_id: cand.id, descricao: cand.descricao, valor: Number(cand.valor) } };
        }
        return mov;
      });
      setMovimentos(novos);
      const matches = novos.filter((m) => m._sugestao).length;
      if (matches > 0) toast.success(`${matches} conciliação(ões) sugerida(s) automaticamente.`);
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
      erros.push("A conta selecionada não possui banco cadastrado (banco_nome).");
    }
    if (!conta.agencia || !String(conta.agencia).trim()) {
      erros.push("A conta selecionada não possui agência cadastrada.");
    }
    if (!conta.conta || !String(conta.conta).trim()) {
      erros.push("A conta selecionada não possui número da conta cadastrado.");
    }
    return erros;
  }

  async function importar() {
    if (!contaId || movimentos.length === 0) return;
    const contaSel = contas.find((c) => c.id === contaId);
    const erros = validarConta(contaSel);
    if (erros.length > 0) {
      erros.forEach((e) => toast.error(e));
      toast.error("Cadastro da conta incompleto. Atualize em Financeiro › Contas antes de importar o OFX.");
      return;
    }
    setImportando(true);
    try {
      const ativos = movimentos.filter((m) => !m._ignorar);
      // 1) conciliar sugestões: marcar lançamento como conciliado
      const conciliacoes = ativos.filter((m) => m._sugestao);
      for (const c of conciliacoes) {
        await supabase.from("financeiro_lancamentos").update({
          status: "conciliado",
          data_realizado: c.data,
          data_conciliado: new Date().toISOString(),
          conta_id: contaId,
        }).eq("id", c._sugestao!.lancamento_id);
      }
      // 2) lançar movimentos não conciliados como movimento_bancario
      const novos = ativos.filter((m) => !m._sugestao).map((m) => ({
        empresa_id: empresaId!,
        tipo: "movimento_bancario" as const,
        natureza: m.valor > 0 ? ("receita" as const) : ("despesa" as const),
        status: "realizado" as const,
        descricao: m.memo,
        valor: Math.abs(m.valor),
        data_competencia: m.data,
        data_realizado: m.data,
        conta_id: contaId,
        origem: "ofx" as const,
        origem_ref: m.fitid,
      }));
      if (novos.length > 0) {
        const { error } = await supabase.from("financeiro_lancamentos").insert(novos);
        if (error) throw error;
      }
      toast.success(`Importação concluída: ${conciliacoes.length} conciliação(ões), ${novos.length} novo(s) lançamento(s).`);
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
          Faça upload do arquivo .ofx do seu banco. O sistema detecta as transações e sugere conciliação automática com os lançamentos previstos (mesmo valor + tipo + data próxima).
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Conta de destino</Label>
            <Select value={contaId} onValueChange={setContaId}>
              <SelectTrigger className="h-auto min-h-[56px] py-2 px-3">
                {(() => {
                  const sel = contas.find((c) => c.id === contaId);
                  if (!sel) return <SelectValue placeholder="Selecione a conta corrente para importar o extrato" />;
                  const b = findBanco(sel.banco_nome ?? "");
                  const nomeExibido = b?.nome ?? sel.banco_nome ?? sel.nome;
                  return (
                    <div className="flex items-center gap-3 text-left w-full">
                      <div className="shrink-0 w-10 h-10 rounded-md bg-background border border-border flex items-center justify-center overflow-hidden">
                        <BancoLogo codigo={b?.codigo} nome={nomeExibido} size={32} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-semibold leading-tight truncate text-foreground">
                          {nomeExibido}
                        </div>
                        <div className="text-[11px] text-muted-foreground leading-tight truncate tabular-nums mt-0.5">
                          {sel.agencia ? `Ag. ${sel.agencia}` : "Ag. —"}
                          <span className="mx-1.5 opacity-50">•</span>
                          {sel.conta ? `C/C ${sel.conta}` : "C/C —"}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </SelectTrigger>
              <SelectContent className="max-h-[320px]">
                {contas.filter((c) => c.ativa).map((c) => {
                  const b = findBanco(c.banco_nome ?? "");
                  const nomeExibido = b?.nome ?? c.banco_nome ?? c.nome;
                  return (
                    <SelectItem key={c.id} value={c.id} className="py-2.5 px-2 focus:bg-accent/60">
                      <div className="flex items-center gap-3 w-full">
                        <div className="shrink-0 w-9 h-9 rounded-md bg-background border border-border flex items-center justify-center overflow-hidden">
                          <BancoLogo codigo={b?.codigo} nome={nomeExibido} size={28} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-semibold leading-tight truncate text-foreground">
                            {nomeExibido}
                          </div>
                          <div className="text-[11px] text-muted-foreground leading-tight truncate tabular-nums mt-0.5">
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
                    {erros.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                  <div className="text-muted-foreground">Atualize em Financeiro › Contas antes de importar.</div>
                </div>
              );
            })()}
          </div>
          <div className="space-y-1.5">
            <Label>Arquivo .ofx</Label>
            <input ref={fileRef} type="file" accept=".ofx" onChange={handleFile}
              className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90" />
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
              {movimentos.map((m, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 border-b text-sm">
                  {m.valor > 0
                    ? <ArrowDownCircle className="w-4 h-4 text-success shrink-0" />
                    : <ArrowUpCircle className="w-4 h-4 text-destructive shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{m.memo}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">{format(new Date(m.data + "T00:00:00"), "dd/MM/yyyy")}</span>
                      {m._sugestao && (
                        <Badge variant="secondary" className="text-[10px]">
                          ✨ Conciliar com: {m._sugestao.descricao.slice(0, 40)}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <span className={`tabular-nums font-medium ${m.valor > 0 ? "text-success" : "text-destructive"}`}>
                    {m.valor > 0 ? "+" : ""} R$ {m.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
            <Button onClick={importar} disabled={!contaId || importando} className="w-full">
              {importando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              Confirmar importação ({movimentos.length} movimento(s))
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
