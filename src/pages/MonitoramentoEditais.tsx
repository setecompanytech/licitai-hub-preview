import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Download,
  Search,
  FileText,
  XCircle,
  Clock,
  CheckCircle2,
  RefreshCw,
  Globe,
  Building2,
  CalendarDays,
  PauseCircle,
  FileCheck,
  Award,
  ArrowUpDown,
  List,
  Newspaper,
} from "lucide-react";
import LicitacoesTab from "@/components/monitoramento/LicitacoesTab";
import DiariosOficiaisTab from "@/components/monitoramento/DiariosOficiaisTab";
import BuscaInteligenteTab from "@/components/monitoramento/BuscaInteligenteTab";


type TipoDocumento =
  | "edital"
  | "aviso"
  | "cancelamento"
  | "suspenso"
  | "adiado"
  | "aditivado"
  | "adjudicado"
  | "homologado";

const tipoConfig: Record<TipoDocumento, { label: string; icon: typeof FileText; color: string }> = {
  edital: { label: "Edital", icon: FileText, color: "bg-info/15 text-info border-info/30" },
  aviso: { label: "Aviso de Licitação", icon: CalendarDays, color: "bg-accent/15 text-accent border-accent/30" },
  cancelamento: {
    label: "Cancelado",
    icon: XCircle,
    color: "bg-destructive/15 text-destructive border-destructive/30",
  },
  suspenso: { label: "Suspenso", icon: PauseCircle, color: "bg-warning/15 text-warning border-warning/30" },
  adiado: { label: "Adiado", icon: Clock, color: "bg-warning/15 text-warning border-warning/30" },
  aditivado: { label: "Aditivado", icon: ArrowUpDown, color: "bg-primary/15 text-primary border-primary/30" },
  adjudicado: { label: "Adjudicado", icon: Award, color: "bg-success/15 text-success border-success/30" },
  homologado: { label: "Homologado", icon: FileCheck, color: "bg-success/15 text-success border-success/30" },
};

const portaisMonitorados = [
  { id: "pncp", nome: "PNCP", url: "https://www.gov.br/pncp/pt-br", ativo: true },
  { id: "compras-gov", nome: "Compras Governamentais", url: "https://www.gov.br/compras/pt-br", ativo: true },
  { id: "bll", nome: "BLL Compras", url: "https://bllcompras.com", ativo: true },
  { id: "licitanet", nome: "Licitanet", url: "https://www.licitanet.com.br", ativo: true },
  { id: "licitacoes-e", nome: "Licitações-e (BB)", url: "https://licitacoes-e2.bb.com.br/aop-inter-estatico/", ativo: true },
  { id: "portal-compras", nome: "Portal de Compras Públicas", url: "https://www.portaldecompraspublicas.com.br", ativo: true },
  { id: "bnc", nome: "Bolsa Nacional de Compras", url: "https://bnc.org.br/", ativo: true },
  { id: "banparanet", nome: "Banparanet (PA)", url: "https://cotacao.banpara.b.br/portal/Mural.aspx", ativo: true },
  { id: "bec-sp", nome: "BEC/SP", url: "https://www.bec.sp.gov.br/BECSP/Home/Home.aspx", ativo: true },
  { id: "compras-rj", nome: "Compras Públicas RJ", url: "https://www.compras.rj.gov.br/", ativo: true },
];

const mockDocumentoCount: Record<TipoDocumento, number> = {
  edital: 3, aviso: 2, cancelamento: 1, suspenso: 1, adiado: 1, aditivado: 1, adjudicado: 1, homologado: 1,
};

export default function MonitoramentoEditais() {
  const [pesquisando, setPesquisando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [tipoFiltro, setTipoFiltro] = useState<TipoDocumento | "todos">("todos");

  const handlePesquisar = () => {
    setPesquisando(true);
    setProgresso(0);
    const interval = setInterval(() => {
      setProgresso((p) => {
        if (p >= 100) {
          clearInterval(interval);
          setPesquisando(false);
          return 100;
        }
        return p + Math.random() * 15;
      });
    }, 400);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Download className="w-6 h-6 text-accent" />
              Monitoramento de Editais
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Pesquisa automática nos portais em nome da empresa cadastrada
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-card rounded-lg border border-border/50 px-3 py-2">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Minha Construtora Ltda.</span>
              <Badge variant="outline" className="bg-success/15 text-success border-success/30 text-[10px]">
                CNAE 42.11-1
              </Badge>
            </div>
            <Button
              onClick={handlePesquisar}
              disabled={pesquisando}
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              {pesquisando ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-1 animate-spin" /> Pesquisando...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-1" /> Pesquisar Portais
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        {pesquisando && (
          <div className="bg-card rounded-xl border border-border/50 p-4 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Pesquisando em {portaisMonitorados.filter((p) => p.ativo).length} portais...
              </span>
              <span className="font-medium">{Math.min(100, Math.round(progresso))}%</span>
            </div>
            <Progress value={Math.min(100, progresso)} className="h-2" />
            <p className="text-xs text-muted-foreground">
              Buscando editais, avisos, cancelamentos, suspensões, adiamentos, aditivos, adjudicações e homologações
            </p>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 lg:grid-cols-8 gap-3">
          {(Object.keys(tipoConfig) as TipoDocumento[]).map((tipo) => {
            const cfg = tipoConfig[tipo];
            const Icon = cfg.icon;
            const count = mockDocumentoCount[tipo];
            return (
              <button
                key={tipo}
                onClick={() => setTipoFiltro(tipoFiltro === tipo ? "todos" : tipo)}
                className={`stat-card text-center cursor-pointer ${tipoFiltro === tipo ? "ring-2 ring-accent" : ""}`}
              >
                <Icon className={`w-5 h-5 mx-auto mb-1 ${cfg.color.split(" ")[1]}`} />
                <p className="text-lg font-bold">{count}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">{cfg.label}</p>
              </button>
            );
          })}
        </div>

        <Tabs defaultValue="licitacoes" className="space-y-4">
          <TabsList>
            <TabsTrigger value="licitacoes">
              <List className="w-4 h-4 mr-1" />
              Licitações
            </TabsTrigger>


            <TabsTrigger value="busca-ia">
              <Search className="w-4 h-4 mr-1" />
              Busca Inteligente IA
            </TabsTrigger>
            <TabsTrigger value="diarios">
              <Newspaper className="w-4 h-4 mr-1" />
              Diários Oficiais
            </TabsTrigger>
            <TabsTrigger value="portais">Portais Monitorados</TabsTrigger>
            <TabsTrigger value="config">Configuração de Pesquisa</TabsTrigger>
          </TabsList>

          <TabsContent value="licitacoes">
            <LicitacoesTab />
          </TabsContent>

          <TabsContent value="busca-ia">
            <BuscaInteligenteTab />
          </TabsContent>

          <TabsContent value="diarios">
            <DiariosOficiaisTab />
          </TabsContent>

          <TabsContent value="portais" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {portaisMonitorados.map((portal) => (
                <div key={portal.id} className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Globe className="w-5 h-5 text-accent" />
                      <h3 className="font-semibold text-sm">{portal.nome}</h3>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        portal.ativo
                          ? "bg-success/15 text-success border-success/30"
                          : "bg-muted text-muted-foreground border-border"
                      }
                    >
                      {portal.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">{portal.url}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Busca automática: {portal.ativo ? "Sim" : "Não"}</span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">
                        <FileText className="w-3 h-3 mr-1" /> Cadastrar
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <a href={portal.url} target="_blank" rel="noopener noreferrer">
                          <Globe className="w-3 h-3 mr-1" /> Acessar
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="config" className="space-y-4">
            <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-semibold">Configuração de Pesquisa Automática</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground">CNAE Principal</label>
                  <Input defaultValue="42.11-1 – Construção de rodovias e ferrovias" className="mt-1" readOnly />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">CNAEs Secundários (cadastrados)</label>
                  <Input defaultValue="42.13-8, 41.20-4" className="mt-1" readOnly />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Gerencie em Configurações → CNAEs Secundários
                  </p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Palavras-chave</label>
                  <Input defaultValue="construção, pavimentação, obra, reforma" className="mt-1" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">UFs monitoradas</label>
                  <Input defaultValue="PA, MA, AP, TO" className="mt-1" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Frequência de busca</label>
                  <Input defaultValue="A cada 30 minutos" className="mt-1" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Valor mínimo (R$)</label>
                  <Input defaultValue="500.000" className="mt-1" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Valor máximo (R$)</label>
                  <Input defaultValue="100.000.000" className="mt-1" />
                </div>
              </div>
              <div className="pt-2">
                <h4 className="text-xs font-semibold mb-2 text-muted-foreground">Tipos de documento para buscar</h4>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(tipoConfig) as TipoDocumento[]).map((tipo) => (
                    <Badge key={tipo} variant="outline" className={tipoConfig[tipo].color + " cursor-pointer"}>
                      <CheckCircle2 className="w-3 h-3 mr-1" /> {tipoConfig[tipo].label}
                    </Badge>
                  ))}
                </div>
              </div>
              <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">Salvar Configuração</Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
