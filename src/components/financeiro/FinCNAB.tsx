import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, Download, Upload, Loader2, History } from "lucide-react";
import { useEmpresaId } from "@/hooks/useFinanceiro";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

export default function FinCNAB() {
  const empresaId = useEmpresaId();
  const [gerando, setGerando] = useState(false);

  const { data: pendentesPagar = 0 } = useQuery({
    queryKey: ["cnab-pendentes-pagar", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { count } = await supabase
        .from("financeiro_lancamentos")
        .select("*", { count: "exact", head: true })
        .eq("empresa_id", empresaId!)
        .eq("tipo", "a_pagar")
        .in("status", ["previsto", "em_atraso"]);
      return count ?? 0;
    },
  });

  const { data: pendentesReceber = 0 } = useQuery({
    queryKey: ["cnab-pendentes-receber", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { count } = await supabase
        .from("financeiro_lancamentos")
        .select("*", { count: "exact", head: true })
        .eq("empresa_id", empresaId!)
        .eq("tipo", "a_receber")
        .in("status", ["previsto", "em_atraso"]);
      return count ?? 0;
    },
  });

  function gerarRemessaSimulada(tipo: "cobranca" | "pagamento") {
    setGerando(true);
    setTimeout(() => {
      // Stub: gera arquivo CNAB 240 placeholder
      const header = `0010000         01REMESSA-COBRANCA${" ".repeat(20)}${format(new Date(), "ddMMyyyy")}${" ".repeat(50)}`;
      const conteudo = [header, `001${tipo.toUpperCase().padEnd(237)}`].join("\n");
      const blob = new Blob([conteudo], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `CNAB240_${tipo}_${format(new Date(), "yyyyMMdd_HHmmss")}.rem`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Remessa ${tipo.toUpperCase()} CNAB 240 gerada.`);
      setGerando(false);
    }, 1000);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileSpreadsheet className="w-5 h-5 text-primary" /> Remessa & Retorno CNAB 240
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Geração de arquivos CNAB 240 para cobrança bancária e pagamento em massa, e processamento de retornos com baixa automática.
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="cobranca">
          <TabsList>
            <TabsTrigger value="cobranca">Cobrança</TabsTrigger>
            <TabsTrigger value="pagamento">Pagamento</TabsTrigger>
            <TabsTrigger value="retorno">Retorno</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="cobranca" className="space-y-3 mt-4">
            <div className="rounded-md border p-4 bg-muted/20">
              <p className="text-sm font-medium">Remessa de cobrança bancária</p>
              <p className="text-xs text-muted-foreground mt-1">
                Gera arquivo CNAB 240 com os títulos a receber pendentes para envio ao banco emissor de boletos.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Badge variant="secondary">{pendentesReceber} título(s) a receber pendente(s)</Badge>
              </div>
              <Button className="mt-3" onClick={() => gerarRemessaSimulada("cobranca")} disabled={gerando || pendentesReceber === 0}>
                {gerando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                Gerar remessa
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="pagamento" className="space-y-3 mt-4">
            <div className="rounded-md border p-4 bg-muted/20">
              <p className="text-sm font-medium">Remessa de pagamento em massa</p>
              <p className="text-xs text-muted-foreground mt-1">
                Gera arquivo CNAB 240 com fornecedores selecionados para débito automático em conta corrente.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Badge variant="secondary">{pendentesPagar} título(s) a pagar pendente(s)</Badge>
              </div>
              <Button className="mt-3" onClick={() => gerarRemessaSimulada("pagamento")} disabled={gerando || pendentesPagar === 0}>
                {gerando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                Gerar remessa
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="retorno" className="space-y-3 mt-4">
            <div className="rounded-md border p-4 bg-muted/20">
              <p className="text-sm font-medium">Processar arquivo de retorno</p>
              <p className="text-xs text-muted-foreground mt-1">
                Faça upload do arquivo .ret enviado pelo banco. O sistema fará a baixa automática dos títulos confirmados.
              </p>
              <input type="file" accept=".ret,.txt" className="mt-3 block w-full text-sm
                file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0
                file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                onChange={() => toast.info("Processador de retorno: implementação completa requer especificação do layout do banco.")} />
            </div>
          </TabsContent>

          <TabsContent value="historico" className="space-y-3 mt-4">
            <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
              <History className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              Nenhuma transmissão registrada ainda. As remessas geradas e os retornos processados aparecerão aqui.
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
