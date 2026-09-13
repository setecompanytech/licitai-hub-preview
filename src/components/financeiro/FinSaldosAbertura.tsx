import { useEffect, useMemo, useState } from "react";
import { dataLocal } from '@/lib/financeiro/data-local';
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Save, Scale, CheckCircle2, AlertTriangle } from "lucide-react";
import EstadoVazio from "@/components/shared/EstadoVazio";
import { useToast } from "@/hooks/use-toast";

interface ContaPC {
  id: string;
  codigo: string;
  nome: string;
  natureza: string;
  natureza_saldo: "D" | "C";
  tipo_conta: string;
  aceita_lancamento: boolean;
}
interface Saldo {
  id?: string;
  conta_id: string;
  saldo_devedor: number;
  saldo_credor: number;
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function FinSaldosAbertura() {
  const { empresaAtiva } = useEmpresa();
  const { toast } = useToast();
  const [dataCorte, setDataCorte] = useState(() => {
    const d = new Date(); d.setMonth(0); d.setDate(1);
    return dataLocal(d);
  });
  const [contas, setContas] = useState<ContaPC[]>([]);
  const [saldos, setSaldos] = useState<Map<string, Saldo>>(new Map());
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [validacao, setValidacao] = useState<any>(null);

  const carregar = async () => {
    if (!empresaAtiva) return;
    setLoading(true);
    const [contasRes, saldosRes] = await Promise.all([
      supabase.from("financeiro_plano_contas" as any).select("id,codigo,nome,natureza,natureza_saldo,tipo_conta,aceita_lancamento")
        .eq("empresa_id", empresaAtiva.id)
        .in("natureza", ["ativo", "passivo", "pl"])
        .eq("aceita_lancamento", true)
        .order("codigo"),
      supabase.from("financeiro_saldos_iniciais" as any).select("*")
        .eq("empresa_id", empresaAtiva.id).eq("data_corte", dataCorte),
    ]);
    if (contasRes.error) toast({ title: "Erro", description: contasRes.error.message, variant: "destructive" });
    setContas((contasRes.data || []) as any);
    const m = new Map<string, Saldo>();
    ((saldosRes.data || []) as any[]).forEach((s) => m.set(s.conta_id, s));
    setSaldos(m);
    setLoading(false);
    validar();
  };

  const validar = async () => {
    if (!empresaAtiva) return;
    const { data } = await supabase.rpc("financeiro_validar_balancete_abertura" as any, {
      p_empresa_id: empresaAtiva.id, p_data_corte: dataCorte,
    });
    setValidacao(data);
  };

  useEffect(() => { carregar(); }, [empresaAtiva?.id, dataCorte]);

  const setValor = (conta: ContaPC, valor: number) => {
    const novo = new Map(saldos);
    const atual = novo.get(conta.id) || { conta_id: conta.id, saldo_devedor: 0, saldo_credor: 0 };
    if (conta.natureza_saldo === "D") {
      atual.saldo_devedor = valor; atual.saldo_credor = 0;
    } else {
      atual.saldo_credor = valor; atual.saldo_devedor = 0;
    }
    novo.set(conta.id, atual);
    setSaldos(novo);
  };

  const salvar = async () => {
    if (!empresaAtiva) return;
    setSalvando(true);
    const userRes = await supabase.auth.getUser();
    const userId = userRes.data.user?.id;
    const linhas = Array.from(saldos.values()).filter((s) => s.saldo_devedor > 0 || s.saldo_credor > 0).map((s) => ({
      ...s, empresa_id: empresaAtiva.id, data_corte: dataCorte, created_by: userId, updated_by: userId,
    }));
    if (linhas.length === 0) {
      toast({ title: "Nada a salvar", description: "Preencha pelo menos um saldo." });
      setSalvando(false); return;
    }
    const { error } = await supabase.from("financeiro_saldos_iniciais" as any).upsert(linhas, {
      onConflict: "empresa_id,conta_id,data_corte",
    });
    setSalvando(false);
    if (error) toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    else { toast({ title: "Saldos salvos", description: `${linhas.length} contas atualizadas.` }); carregar(); }
  };

  const totais = useMemo(() => {
    let d = 0, c = 0;
    saldos.forEach((s) => { d += Number(s.saldo_devedor || 0); c += Number(s.saldo_credor || 0); });
    return { d, c, dif: d - c };
  }, [saldos]);

  if (!empresaAtiva) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Scale className="w-5 h-5" />Saldos de Abertura (Balanço Inicial)</CardTitle>
        <CardDescription>Registro de saldos iniciais por conta patrimonial — partida dobrada (ITG 2000): ΣDevedores = ΣCredores.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Label htmlFor="saldos-data-corte">Data de Corte</Label>
            <Input id="saldos-data-corte" type="date" value={dataCorte} onChange={(e) => setDataCorte(e.target.value)} className="w-44" />
          </div>
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Salvar Saldos
          </Button>
        </div>

        {totais.dif === 0 && (totais.d > 0 || totais.c > 0) ? (
          <Alert variant="success">
            <CheckCircle2 className="w-4 h-4" />
            <AlertDescription>Balancete em equilíbrio: ΣD = ΣC = {fmt(totais.d)}</AlertDescription>
          </Alert>
        ) : totais.dif !== 0 ? (
          <Alert variant="destructive">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>Diferença de {fmt(Math.abs(totais.dif))} entre Devedores ({fmt(totais.d)}) e Credores ({fmt(totais.c)}).</AlertDescription>
          </Alert>
        ) : null}

        {contas.length === 0 ? (
          <EstadoVazio
            icone={<Scale />}
            titulo="Nenhuma conta patrimonial analítica"
            descricao={'Importe o Plano de Contas Padrão PME primeiro, na aba "Plano de Contas", para lançar os saldos de abertura'}
          />
        ) : (
          <div className="rounded-lg border border-border max-h-[60vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted sticky top-0 text-sm font-semibold text-foreground">
                <tr>
                  <th className="text-left px-4 py-3">Código</th>
                  <th className="text-left px-4 py-3">Conta</th>
                  <th className="text-center px-4 py-3">Natureza</th>
                  <th className="text-right px-4 py-3 w-48">Saldo (R$)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {contas.map((c) => {
                  const s = saldos.get(c.id);
                  const valor = c.natureza_saldo === "D" ? (s?.saldo_devedor || 0) : (s?.saldo_credor || 0);
                  return (
                    <tr key={c.id} className="hover:bg-muted">
                      <td className="px-4 py-2 text-sm tabular-nums text-muted-foreground">{c.codigo}</td>
                      <td className="px-4 py-2">{c.nome}</td>
                      <td className="px-4 py-2 text-center">
                        <Badge variant="muted">{c.natureza_saldo === "D" ? "Devedora" : "Credora"}</Badge>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Input type="number" step="0.01" min="0" value={valor || ""}
                          onChange={(e) => setValor(c, Number(e.target.value))}
                          aria-label={`Saldo de abertura da conta ${c.codigo} ${c.nome}`}
                          className="text-right tabular-nums w-40 ml-auto" placeholder="0,00" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-muted sticky bottom-0 font-semibold">
                <tr>
                  <td colSpan={3} className="text-right px-4 py-3">Totais:</td>
                  <td className="text-right px-4 py-3 tabular-nums">D {fmt(totais.d)} · C {fmt(totais.c)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
