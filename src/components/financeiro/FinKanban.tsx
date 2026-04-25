import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, AlertCircle, Clock, FileText, Loader2 } from "lucide-react";
import { format, differenceInDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";

interface Lancamento {
  id: string;
  descricao: string;
  valor: number;
  data_competencia: string;
  data_pagamento: string | null;
  status: string;
  documento_ref: string | null;
}

type ColunaKanban = "aberto" | "vence_7d" | "vencido" | "pago";

const COLUNAS: { id: ColunaKanban; nome: string; cor: string; icone: typeof Clock }[] = [
  { id: "aberto", nome: "Em aberto", cor: "bg-info/10 border-info/30", icone: FileText },
  { id: "vence_7d", nome: "Vence em 7 dias", cor: "bg-warning/10 border-warning/30", icone: Clock },
  { id: "vencido", nome: "Vencido", cor: "bg-destructive/10 border-destructive/30", icone: AlertCircle },
  { id: "pago", nome: "Concluído", cor: "bg-success/10 border-success/30", icone: CheckCircle2 },
];

interface Props {
  tipo: "a_pagar" | "a_receber";
}

export default function FinKanban({ tipo }: Props) {
  const { empresaAtiva } = useEmpresa();
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = async () => {
    if (!empresaAtiva) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("fin_lancamentos")
      .select("id, descricao, valor, data_competencia, data_pagamento, status, documento_ref")
      .eq("empresa_id", empresaAtiva.id)
      .eq("tipo", tipo)
      .order("data_competencia", { ascending: true })
      .limit(500);
    if (error) toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" });
    setLancamentos(data || []);
    setLoading(false);
  };

  useEffect(() => {
    carregar();
  }, [empresaAtiva?.id, tipo]);

  const classificar = (l: Lancamento): ColunaKanban => {
    if (l.status === "realizado" || l.status === "conciliado") return "pago";
    const dias = differenceInDays(parseISO(l.data_competencia), new Date());
    if (dias < 0) return "vencido";
    if (dias <= 7) return "vence_7d";
    return "aberto";
  };

  const marcarPago = async (id: string) => {
    const { error } = await supabase
      .from("fin_lancamentos")
      .update({ status: "realizado", data_pagamento: new Date().toISOString().slice(0, 10) })
      .eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: tipo === "a_pagar" ? "Marcado como pago" : "Marcado como recebido" });
    carregar();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const total = lancamentos.reduce((s, l) => (classificar(l) !== "pago" ? s + Number(l.valor) : s), 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              Total {tipo === "a_pagar" ? "a pagar" : "a receber"} em aberto
            </p>
            <p className="text-2xl font-bold">
              {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </p>
          </div>
          <Badge variant="outline">{lancamentos.length} lançamentos</Badge>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {COLUNAS.map((col) => {
          const items = lancamentos.filter((l) => classificar(l) === col.id);
          const subtotal = items.reduce((s, l) => s + Number(l.valor), 0);
          const Icone = col.icone;
          return (
            <Card key={col.id} className={`${col.cor} border-2`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Icone className="w-4 h-4" />
                  {col.nome}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {items.length} · {subtotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </p>
              </CardHeader>
              <CardContent className="p-2">
                <ScrollArea className="h-[460px]">
                  <div className="space-y-2">
                    {items.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-6">Nenhum item</p>
                    ) : (
                      items.map((l) => (
                        <Card key={l.id} className="bg-card border shadow-sm">
                          <CardContent className="p-3 space-y-1">
                            <p className="text-sm font-medium line-clamp-2">{l.descricao}</p>
                            {l.documento_ref && (
                              <p className="text-[11px] text-muted-foreground">Doc: {l.documento_ref}</p>
                            )}
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">
                                {format(parseISO(l.data_competencia), "dd/MM/yy", { locale: ptBR })}
                              </span>
                              <span className="text-sm font-semibold">
                                {Number(l.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                              </span>
                            </div>
                            {col.id !== "pago" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full h-7 text-xs"
                                onClick={() => marcarPago(l.id)}
                              >
                                {tipo === "a_pagar" ? "Marcar pago" : "Marcar recebido"}
                              </Button>
                            )}
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
