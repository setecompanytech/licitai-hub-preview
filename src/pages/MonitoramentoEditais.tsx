import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Download, Search, FileText, AlertTriangle, XCircle, Clock,
  CheckCircle2, RefreshCw, Globe, Building2, Filter, CalendarDays,
  PauseCircle, FileCheck, Award, Ban, ArrowUpDown
} from 'lucide-react';

type TipoDocumento =
  | 'edital' | 'aviso' | 'cancelamento' | 'suspenso'
  | 'adiado' | 'aditivado' | 'adjudicado' | 'homologado';

type Documento = {
  id: string;
  tipo: TipoDocumento;
  numero: string;
  orgao: string;
  portal: string;
  objeto: string;
  dataPublicacao: string;
  valor: number;
  baixado: boolean;
  url: string;
};

const tipoConfig: Record<TipoDocumento, { label: string; icon: typeof FileText; color: string }> = {
  edital: { label: 'Edital', icon: FileText, color: 'bg-info/15 text-info border-info/30' },
  aviso: { label: 'Aviso de Licitação', icon: CalendarDays, color: 'bg-accent/15 text-accent border-accent/30' },
  cancelamento: { label: 'Cancelado', icon: XCircle, color: 'bg-destructive/15 text-destructive border-destructive/30' },
  suspenso: { label: 'Suspenso', icon: PauseCircle, color: 'bg-warning/15 text-warning border-warning/30' },
  adiado: { label: 'Adiado', icon: Clock, color: 'bg-warning/15 text-warning border-warning/30' },
  aditivado: { label: 'Aditivado', icon: ArrowUpDown, color: 'bg-primary/15 text-primary border-primary/30' },
  adjudicado: { label: 'Adjudicado', icon: Award, color: 'bg-success/15 text-success border-success/30' },
  homologado: { label: 'Homologado', icon: FileCheck, color: 'bg-success/15 text-success border-success/30' },
};

const portaisMonitorados = [
  { id: 'pncp', nome: 'PNCP', url: 'pncp.gov.br', ativo: true },
  { id: 'compras-gov', nome: 'Compras.gov.br', url: 'comprasnet.gov.br', ativo: true },
  { id: 'bll', nome: 'BLL Compras', url: 'bllcompras.com', ativo: true },
  { id: 'blc', nome: 'BLC Licitações', url: 'blc.com.br', ativo: false },
  { id: 'licitanet', nome: 'Licitanet', url: 'licitanet.com.br', ativo: true },
  { id: 'licitacoes-e', nome: 'Licitações-e (BB)', url: 'licitacoes-e.com.br', ativo: true },
  { id: 'portal-compras', nome: 'Portal de Compras Públicas', url: 'portaldecompraspublicas.com.br', ativo: true },
  { id: 'tcmpa', nome: 'TCM-PA', url: 'tcm.pa.gov.br', ativo: true },
  { id: 'compras-gov-br', nome: 'Compras Governamentais', url: 'comprasgovernamentais.gov.br', ativo: false },
];

const mockDocumentos: Documento[] = [
  { id: '1', tipo: 'edital', numero: 'PE-001/2026', orgao: 'Prefeitura de Belém', portal: 'PNCP', objeto: 'Construção de ponte sobre o Rio Guamá – Lote 3', dataPublicacao: '2026-02-18', valor: 12500000, baixado: true, url: '#' },
  { id: '2', tipo: 'aviso', numero: 'AV-045/2026', orgao: 'SEDOP/PA', portal: 'Compras.gov.br', objeto: 'Aviso de licitação para pavimentação asfáltica BR-316', dataPublicacao: '2026-02-19', valor: 8900000, baixado: false, url: '#' },
  { id: '3', tipo: 'cancelamento', numero: 'PE-012/2026', orgao: 'SEMAS/PA', portal: 'BLL Compras', objeto: 'Cancelamento – Reforma do prédio sede', dataPublicacao: '2026-02-17', valor: 3200000, baixado: false, url: '#' },
  { id: '4', tipo: 'suspenso', numero: 'CC-003/2026', orgao: 'DNIT', portal: 'Licitações-e (BB)', objeto: 'Suspensão – Obra de contenção na PA-150', dataPublicacao: '2026-02-16', valor: 5600000, baixado: false, url: '#' },
  { id: '5', tipo: 'adiado', numero: 'PE-078/2026', orgao: 'SETRAN/PA', portal: 'PNCP', objeto: 'Adiamento – Sinalização viária em Ananindeua', dataPublicacao: '2026-02-15', valor: 1800000, baixado: true, url: '#' },
  { id: '6', tipo: 'aditivado', numero: 'CT-022/2025', orgao: 'Prefeitura de Marituba', portal: 'Portal de Compras Públicas', objeto: 'Aditivo – Ampliação de escola municipal', dataPublicacao: '2026-02-20', valor: 2100000, baixado: false, url: '#' },
  { id: '7', tipo: 'adjudicado', numero: 'PE-099/2025', orgao: 'COSANPA', portal: 'Compras.gov.br', objeto: 'Adjudicação – Sistema de abastecimento de água', dataPublicacao: '2026-02-14', valor: 7400000, baixado: true, url: '#' },
  { id: '8', tipo: 'homologado', numero: 'CC-001/2026', orgao: 'Governo do Pará', portal: 'PNCP', objeto: 'Homologação – Construção do novo terminal rodoviário', dataPublicacao: '2026-02-13', valor: 45000000, baixado: true, url: '#' },
  { id: '9', tipo: 'edital', numero: 'PE-155/2026', orgao: 'TCM-PA', portal: 'TCM-PA', objeto: 'Reforma e adequação do prédio do tribunal', dataPublicacao: '2026-02-21', valor: 6300000, baixado: false, url: '#' },
  { id: '10', tipo: 'aviso', numero: 'AV-088/2026', orgao: 'UFPA', portal: 'Compras.gov.br', objeto: 'Aviso de licitação para construção de laboratório', dataPublicacao: '2026-02-20', valor: 4200000, baixado: false, url: '#' },
];

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function MonitoramentoEditais() {
  const [busca, setBusca] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState<TipoDocumento | 'todos'>('todos');
  const [pesquisando, setPesquisando] = useState(false);
  const [progresso, setProgresso] = useState(0);

  const documentosFiltrados = mockDocumentos.filter((doc) => {
    const matchBusca =
      !busca ||
      doc.objeto.toLowerCase().includes(busca.toLowerCase()) ||
      doc.numero.toLowerCase().includes(busca.toLowerCase()) ||
      doc.orgao.toLowerCase().includes(busca.toLowerCase());
    const matchTipo = tipoFiltro === 'todos' || doc.tipo === tipoFiltro;
    return matchBusca && matchTipo;
  });

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

  const totalPorTipo = (tipo: TipoDocumento) =>
    mockDocumentos.filter((d) => d.tipo === tipo).length;

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
                <><RefreshCw className="w-4 h-4 mr-1 animate-spin" /> Pesquisando...</>
              ) : (
                <><Search className="w-4 h-4 mr-1" /> Pesquisar Portais</>
              )}
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        {pesquisando && (
          <div className="bg-card rounded-xl border border-border/50 p-4 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Pesquisando em {portaisMonitorados.filter(p => p.ativo).length} portais...</span>
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
            const count = totalPorTipo(tipo);
            return (
              <button
                key={tipo}
                onClick={() => setTipoFiltro(tipoFiltro === tipo ? 'todos' : tipo)}
                className={`stat-card text-center cursor-pointer ${tipoFiltro === tipo ? 'ring-2 ring-accent' : ''}`}
              >
                <Icon className={`w-5 h-5 mx-auto mb-1 ${cfg.color.split(' ')[1]}`} />
                <p className="text-lg font-bold">{count}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">{cfg.label}</p>
              </button>
            );
          })}
        </div>

        <Tabs defaultValue="resultados" className="space-y-4">
          <TabsList>
            <TabsTrigger value="resultados">Resultados ({documentosFiltrados.length})</TabsTrigger>
            <TabsTrigger value="portais">Portais Monitorados</TabsTrigger>
            <TabsTrigger value="config">Configuração de Pesquisa</TabsTrigger>
          </TabsList>

          {/* Resultados */}
          <TabsContent value="resultados" className="space-y-4">
            {/* Search + filter */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por número, órgão ou objeto..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button variant="outline" size="sm" onClick={() => { setBusca(''); setTipoFiltro('todos'); }}>
                <Filter className="w-4 h-4 mr-1" /> Limpar Filtros
              </Button>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-1" /> Baixar Todos
              </Button>
            </div>

            {/* Document list */}
            <div className="space-y-3">
              {documentosFiltrados.map((doc) => {
                const cfg = tipoConfig[doc.tipo];
                const Icon = cfg.icon;
                return (
                  <div
                    key={doc.id}
                    className="bg-card rounded-xl border border-border/50 p-4 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${cfg.color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-semibold text-sm">{doc.numero}</span>
                          <Badge variant="outline" className={cfg.color + ' text-[10px]'}>
                            {cfg.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">• {doc.portal}</span>
                        </div>
                        <p className="text-sm text-foreground truncate">{doc.objeto}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>{doc.orgao}</span>
                          <span>•</span>
                          <span>{new Date(doc.dataPublicacao).toLocaleDateString('pt-BR')}</span>
                          <span>•</span>
                          <span className="font-medium text-foreground">{formatCurrency(doc.valor)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {doc.baixado ? (
                        <Badge variant="outline" className="bg-success/15 text-success border-success/30">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Baixado
                        </Badge>
                      ) : (
                        <Button size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground">
                          <Download className="w-3 h-3 mr-1" /> Baixar
                        </Button>
                      )}
                      <Button size="sm" variant="outline">
                        <Globe className="w-3 h-3 mr-1" /> Ver no Portal
                      </Button>
                    </div>
                  </div>
                );
              })}
              {documentosFiltrados.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Search className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">Nenhum documento encontrado com os filtros aplicados.</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Portais Monitorados */}
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
                          ? 'bg-success/15 text-success border-success/30'
                          : 'bg-muted text-muted-foreground border-border'
                      }
                    >
                      {portal.ativo ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">{portal.url}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Busca automática: {portal.ativo ? 'Sim' : 'Não'}</span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">
                        <FileText className="w-3 h-3 mr-1" /> Cadastrar
                      </Button>
                      <Button size="sm" variant="outline">
                        <Globe className="w-3 h-3 mr-1" /> Acessar
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Configuração */}
          <TabsContent value="config" className="space-y-4">
            <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-semibold">Configuração de Pesquisa Automática</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground">CNAE para filtro</label>
                  <Input defaultValue="42.11-1 – Construção de rodovias e ferrovias" className="mt-1" />
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
                    <Badge key={tipo} variant="outline" className={tipoConfig[tipo].color + ' cursor-pointer'}>
                      <CheckCircle2 className="w-3 h-3 mr-1" /> {tipoConfig[tipo].label}
                    </Badge>
                  ))}
                </div>
              </div>
              <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">
                Salvar Configuração
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
