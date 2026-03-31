import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useEmpresa } from "@/contexts/EmpresaContext";
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
  Zap,
  List,
  Newspaper,
  ExternalLink,
  KeyRound,
  ShieldCheck,
  Gavel,
} from "lucide-react";
// LicitacoesTab removed — integrated into MuralLicitacoes via "Incluir portais externos" toggle
import DiariosOficiaisTab from "@/components/monitoramento/DiariosOficiaisTab";
import ConfiguracaoPesquisaTab from "@/components/monitoramento/ConfiguracaoPesquisaTab";
import DispensaEletronicaTab from "@/components/monitoramento/DispensaEletronicaTab";
import MuralLicitacoes from "@/components/monitoramento/MuralLicitacoes";
import { TODOS_PORTAIS } from "@/data/portais-compras";



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

const portaisMonitorados = TODOS_PORTAIS.filter(p => p.ativo);

const documentoCount: Record<TipoDocumento, number> = {
  edital: 0, aviso: 0, cancelamento: 0, suspenso: 0, adiado: 0, aditivado: 0, adjudicado: 0, homologado: 0,
};

export default function MonitoramentoEditais() {
  const [pesquisando, setPesquisando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [tipoFiltro, setTipoFiltro] = useState<TipoDocumento | "todos">("todos");
  const navigate = useNavigate();
  const { empresaAtiva } = useEmpresa();

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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
              <Download className="w-5 h-5 sm:w-6 sm:h-6 text-accent flex-shrink-0" />
              Monitoramento de Editais
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Pesquisa automática nos portais em nome da empresa cadastrada
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="flex items-center gap-2 bg-card rounded-lg border border-border/50 px-3 py-2 min-w-0">
              <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-xs sm:text-sm font-medium truncate">
                {empresaAtiva?.nome_fantasia || empresaAtiva?.razao_social || 'Nenhuma empresa selecionada'}
              </span>
              {empresaAtiva?.cnae_principal && (
                <Badge variant="outline" className="bg-success/15 text-success border-success/30 text-[10px] flex-shrink-0 whitespace-nowrap">
                  CNAE {empresaAtiva.cnae_principal}
                </Badge>
              )}
            </div>
            <Button
              onClick={handlePesquisar}
              disabled={pesquisando}
              className="bg-accent hover:bg-accent/90 text-accent-foreground flex-shrink-0"
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
                Pesquisando em {portaisMonitorados.length} portais...
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
            const count = documentoCount[tipo];
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

        <Tabs defaultValue="mural" className="space-y-4">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="mural">
              <Gavel className="w-4 h-4 mr-1" />
              Mural (Tempo Real)
            </TabsTrigger>
            <TabsTrigger value="dispensa">
              <Zap className="w-4 h-4 mr-1" />
              Dispensa Eletrônica
            </TabsTrigger>
            <TabsTrigger value="diarios">
              <Newspaper className="w-4 h-4 mr-1" />
              Diários Oficiais
            </TabsTrigger>
            <TabsTrigger value="portais">
              <Globe className="w-4 h-4 mr-1" />
              Portais ({portaisMonitorados.length})
            </TabsTrigger>
            <TabsTrigger value="config">Configuração de Pesquisa</TabsTrigger>
          </TabsList>

          <TabsContent value="mural">
            <MuralLicitacoes />
          </TabsContent>



          <TabsContent value="dispensa">
            <DispensaEletronicaTab />
          </TabsContent>

          <TabsContent value="diarios">
            <DiariosOficiaisTab />
          </TabsContent>

          <TabsContent value="portais" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {portaisMonitorados.map((portal) => (
                <div key={portal.id} className="bg-card rounded-xl border border-border/50 p-5 shadow-sm flex flex-col">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Globe className="w-5 h-5 text-accent" />
                      <h3 className="font-semibold text-sm">{portal.nomeAbreviado}</h3>
                    </div>
                    <div className="flex gap-1">
                      {portal.dispensaEletronica && (
                        <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-[9px]">
                          Dispensa
                        </Badge>
                      )}
                      {portal.uf && (
                        <Badge variant="outline" className="text-[9px]">{portal.uf}</Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{portal.descricao}</p>
                  <p className="text-[10px] text-muted-foreground mb-4 truncate">{portal.url}</p>
                  <div className="mt-auto flex flex-col gap-2">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => navigate('/robo-lances')}
                      >
                        <KeyRound className="w-3 h-3 mr-1" /> Credenciais
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => navigate('/robo-lances')}
                      >
                        <ShieldCheck className="w-3 h-3 mr-1" /> Certificado
                      </Button>
                    </div>
                    <Button size="sm" variant="default" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" asChild>
                      <a href={portal.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3 h-3 mr-1" /> Acessar Portal
                      </a>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="config" className="space-y-4">
            <ConfiguracaoPesquisaTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
