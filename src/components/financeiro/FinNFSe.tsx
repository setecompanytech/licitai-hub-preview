import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Send, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const PADROES = [
  { id: "abrasf", nome: "ABRASF 2.04", cidades: "Maioria das capitais (SP, RJ, BH, Curitiba, Recife)" },
  { id: "ginfes", nome: "GINFES", cidades: "Pequenas e médias cidades de SP, MG, BA" },
  { id: "ginflo", nome: "ISSNet (Betha)", cidades: "Diversas cidades de SC, PR e RS" },
  { id: "tinus", nome: "Tinus", cidades: "Cidades do interior de SP" },
  { id: "siapnet", nome: "SIAPnet", cidades: "Cidades do RJ" },
];

export default function FinNFSe() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="w-5 h-5 text-primary" /> NFS-e Municipal
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Emissão e monitoramento de Notas Fiscais de Serviço Eletrônicas para 5.570 municípios brasileiros.
          </p>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="emitir">
            <TabsList>
              <TabsTrigger value="emitir">Emitir NFS-e</TabsTrigger>
              <TabsTrigger value="monitor">Monitor de Prefeituras</TabsTrigger>
              <TabsTrigger value="config">Padrões suportados</TabsTrigger>
            </TabsList>

            <TabsContent value="emitir" className="mt-4">
              <div className="rounded-md border p-6 text-center">
                <FileText className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm font-medium">Emissor de NFS-e</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                  A emissão NFS-e requer integração específica por município. Configure o padrão da sua prefeitura na aba "Padrões suportados".
                </p>
                <Button className="mt-4" disabled><Send className="w-4 h-4 mr-2" /> Emitir nota</Button>
              </div>
            </TabsContent>

            <TabsContent value="monitor" className="mt-4">
              <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
                Monitor de status de prefeituras (online/offline) — em desenvolvimento.
              </div>
            </TabsContent>

            <TabsContent value="config" className="mt-4 space-y-2">
              {PADROES.map((p) => (
                <div key={p.id} className="rounded-md border p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{p.nome}</p>
                    <p className="text-xs text-muted-foreground">{p.cidades}</p>
                  </div>
                  <Badge variant="secondary">Suportado</Badge>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
