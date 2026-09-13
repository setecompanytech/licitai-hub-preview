import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import EstadoVazio from "@/components/shared/EstadoVazio";
import { Download, Loader2, History } from "lucide-react";
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

  // Título e descrição da tela vêm do cabeçalho da página (/financeiro/cnab).
  return (
    <Tabs defaultValue="cobranca" className="space-y-4">
      <TabsList>
        <TabsTrigger value="cobranca">Cobrança</TabsTrigger>
        <TabsTrigger value="pagamento">Pagamento</TabsTrigger>
        <TabsTrigger value="retorno">Retorno</TabsTrigger>
        <TabsTrigger value="historico">Histórico</TabsTrigger>
      </TabsList>

      <TabsContent value="cobranca" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Remessa de cobrança bancária</CardTitle>
            <CardDescription>
              Gera arquivo CNAB 240 com os títulos a receber pendentes para envio ao banco emissor de boletos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Badge variant="info">{pendentesReceber} título(s) a receber pendente(s)</Badge>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => gerarRemessaSimulada("cobranca")} disabled={gerando || pendentesReceber === 0}>
                {gerando ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Download className="w-4 h-4" aria-hidden="true" />}
                Gerar remessa
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="pagamento" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Remessa de pagamento em massa</CardTitle>
            <CardDescription>
              Gera arquivo CNAB 240 com fornecedores selecionados para débito automático em conta corrente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Badge variant="info">{pendentesPagar} título(s) a pagar pendente(s)</Badge>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => gerarRemessaSimulada("pagamento")} disabled={gerando || pendentesPagar === 0}>
                {gerando ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Download className="w-4 h-4" aria-hidden="true" />}
                Gerar remessa
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="retorno" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Processar arquivo de retorno</CardTitle>
            <CardDescription>
              Faça upload do arquivo .ret enviado pelo banco. O sistema fará a baixa automática dos títulos confirmados.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="cnab-retorno">Arquivo de retorno (.ret ou .txt)</Label>
            <Input
              id="cnab-retorno"
              type="file"
              accept=".ret,.txt"
              onChange={() => toast.info("Processador de retorno: implementação completa requer especificação do layout do banco.")}
            />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="historico" className="mt-4">
        <Card>
          <CardContent className="p-0">
            <EstadoVazio
              icone={<History aria-hidden="true" />}
              titulo="Nenhuma transmissão registrada"
              descricao="As remessas geradas e os retornos processados aparecerão aqui."
            />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
