import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Send, FileText, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import EstadoVazio from "@/components/shared/EstadoVazio";

const PADROES = [
  { id: "abrasf", nome: "ABRASF 2.04", cidades: "Maioria das capitais (SP, RJ, BH, Curitiba, Recife)" },
  { id: "ginfes", nome: "GINFES", cidades: "Pequenas e médias cidades de SP, MG, BA" },
  { id: "ginflo", nome: "ISSNet (Betha)", cidades: "Diversas cidades de SC, PR e RS" },
  { id: "tinus", nome: "Tinus", cidades: "Cidades do interior de SP" },
  { id: "siapnet", nome: "SIAPnet", cidades: "Cidades do RJ" },
];

export default function FinNFSe() {
  // O título e a linha de explicação da tela vêm do cabeçalho da página
  // (`/financeiro/nfse`), então aqui começa direto no conteúdo.
  return (
    <Tabs defaultValue="emitir" className="space-y-4">
      <TabsList>
        <TabsTrigger value="emitir">Emitir NFS-e</TabsTrigger>
        <TabsTrigger value="monitor">Monitor de Prefeituras</TabsTrigger>
        <TabsTrigger value="config">Padrões suportados</TabsTrigger>
      </TabsList>

      <TabsContent value="emitir" className="mt-4">
        <div className="rounded-lg border border-border bg-card shadow-sm">
          <EstadoVazio
            icone={<FileText aria-hidden="true" />}
            titulo="Emissor de NFS-e"
            descricao={'A emissão NFS-e requer integração específica por município. Configure o padrão da sua prefeitura na aba "Padrões suportados".'}
            acao={
              <Button disabled>
                <Send className="w-4 h-4" aria-hidden="true" /> Emitir nota
              </Button>
            }
          />
        </div>
      </TabsContent>

      <TabsContent value="monitor" className="mt-4">
        <div className="rounded-lg border border-border bg-card shadow-sm">
          <EstadoVazio
            icone={<Building2 aria-hidden="true" />}
            titulo="Monitor de prefeituras"
            descricao="O acompanhamento de status das prefeituras (online/offline) está em desenvolvimento."
          />
        </div>
      </TabsContent>

      <TabsContent value="config" className="mt-4 space-y-3">
        {PADROES.map((p) => (
          <div
            key={p.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 shadow-sm"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{p.nome}</p>
              <p className="text-xs text-muted-foreground">{p.cidades}</p>
            </div>
            <Badge variant="success">Suportado</Badge>
          </div>
        ))}
      </TabsContent>
    </Tabs>
  );
}
