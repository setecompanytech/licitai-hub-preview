import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { useAlertas, type TipoAlerta, type Alerta, type FiltrosAlertas } from '@/hooks/useAlertas';
import { toast } from 'sonner';
import {
  Bell, FileText, AlertTriangle, Ban, XCircle, CheckCircle2, Trophy,
  Archive, Eye, EyeOff, ChevronLeft, ChevronRight, ExternalLink,
  Loader2, Settings, Filter
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const TIPO_CONFIG: Record<string, { icon: any; label: string; color: string; emoji: string }> = {
  novo_edital: { icon: FileText, label: 'Novo Edital', color: 'bg-info/10 text-info border-info/30', emoji: '🆕' },
  alteracao: { icon: AlertTriangle, label: 'Alteração', color: 'bg-warning/10 text-warning border-warning/30', emoji: '⚠️' },
  suspensao: { icon: Ban, label: 'Suspensão', color: 'bg-warning/10 text-warning border-warning/30', emoji: '🚫' },
  cancelamento: { icon: XCircle, label: 'Cancelamento', color: 'bg-destructive/10 text-destructive border-destructive/30', emoji: '❌' },
  homologacao: { icon: CheckCircle2, label: 'Homologação', color: 'bg-success/10 text-success border-success/30', emoji: '✅' },
  resultado: { icon: Trophy, label: 'Resultado', color: 'bg-muted text-muted-foreground border-border', emoji: '📊' },
};

const FONTE_COLORS: Record<string, string> = {
  PNCP: 'bg-muted text-muted-foreground',
  DOU: 'bg-muted text-muted-foreground',
  DOE: 'bg-muted text-muted-foreground',
  ComprasNet: 'bg-muted text-muted-foreground',
  sistema: 'bg-muted text-muted-foreground',
};

export default function CentralAvisos() {
  const {
    alertas, total, naoLidos, urgentes, loading, pagina, totalPaginas,
    buscarAlertas, marcarComoLido, arquivar, marcarTodosLidos, setPagina,
  } = useAlertas();

  const [tab, setTab] = useState('todos');
  const [filtroTipos, setFiltroTipos] = useState<TipoAlerta[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedAlerta, setSelectedAlerta] = useState<Alerta | null>(null);

  useEffect(() => {
    const filtros: FiltrosAlertas = {};
    if (tab === 'nao_lidos') filtros.lido = false;
    if (tab === 'urgentes') filtros.urgente = true;
    if (tab === 'arquivados') filtros.arquivado = true;
    if (filtroTipos.length > 0) filtros.tipos = filtroTipos;
    buscarAlertas(filtros);
  }, [tab, filtroTipos, pagina, buscarAlertas]);

  const toggleTipo = (tipo: TipoAlerta) => {
    setFiltroTipos(prev => prev.includes(tipo) ? prev.filter(t => t !== tipo) : [...prev, tipo]);
    setPagina(1);
  };

  const openAlerta = (alerta: Alerta) => {
    setSelectedAlerta(alerta);
    if (!alerta.lido) marcarComoLido(alerta.id);
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Bell className="w-5 h-5 text-muted-foreground" />
              Central de Avisos
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Editais, alterações, suspensões, cancelamentos e homologações
            </p>
          </div>
          <Link to="/configuracoes/alertas">
            <Button variant="outline" size="sm" className="text-xs">
              <Settings className="w-3.5 h-3.5 mr-1" /> Configurar
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="stat-card text-center">
            <p className="text-lg font-bold">{total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
          <div className="stat-card text-center">
            <p className="text-lg font-bold text-info">{naoLidos}</p>
            <p className="text-xs text-muted-foreground">Não lidos</p>
          </div>
          <div className="stat-card text-center">
            <p className="text-lg font-bold text-destructive">{urgentes}</p>
            <p className="text-xs text-muted-foreground">Urgentes</p>
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="w-3 h-3 mr-1" /> Filtros {filtroTipos.length > 0 && `(${filtroTipos.length})`}
          </Button>
          {showFilters && Object.entries(TIPO_CONFIG).map(([tipo, cfg]) => (
            <button
              key={tipo}
              onClick={() => toggleTipo(tipo as TipoAlerta)}
              className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border transition-colors ${
                filtroTipos.includes(tipo as TipoAlerta)
                  ? cfg.color
                  : 'bg-muted/30 text-muted-foreground border-border/50'
              }`}
            >
              {cfg.emoji} {cfg.label}
            </button>
          ))}
        </div>

        <Tabs value={tab} onValueChange={v => { setTab(v); setPagina(1); }}>
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="todos">Todos</TabsTrigger>
              <TabsTrigger value="nao_lidos">
                Não lidos {naoLidos > 0 && <Badge className="ml-1 text-xs h-4 px-1.5">{naoLidos}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="urgentes">Urgentes</TabsTrigger>
              <TabsTrigger value="arquivados">Arquivados</TabsTrigger>
            </TabsList>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={marcarTodosLidos}>
                <Eye className="w-3 h-3 mr-1" /> Marcar todos como lidos
              </Button>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : alertas.length === 0 ? (
              <Card className="p-10 text-center">
                <Bell className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Nenhum alerta encontrado</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Configure seus segmentos e UFs para receber avisos personalizados
                </p>
              </Card>
            ) : (
              alertas.map(alerta => {
                const cfg = TIPO_CONFIG[alerta.tipo] || TIPO_CONFIG.novo_edital;
                const Icon = cfg.icon;
                return (
                  <div
                    key={alerta.id}
                    onClick={() => openAlerta(alerta)}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      !alerta.lido
                        ? 'bg-secondary border-border hover:bg-secondary/80'
                        : 'border-border/50 hover:bg-muted/40'
                    }`}
                  >
                    <div className={`p-1.5 rounded-lg shrink-0 ${cfg.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm leading-tight truncate ${!alerta.lido ? 'font-bold' : 'font-medium'}`}>
                          {alerta.titulo}
                        </p>
                        {alerta.urgente && (
                          <span className="shrink-0 w-2 h-2 rounded-full bg-destructive animate-pulse" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{alerta.descricao}</p>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        {alerta.uf && <Badge variant="outline" className="text-xs h-4">{alerta.uf}</Badge>}
                        {alerta.orgao && <Badge variant="outline" className="text-xs h-4 max-w-[150px] truncate">{alerta.orgao}</Badge>}
                        <Badge className={`text-xs h-4 border-0 ${FONTE_COLORS[alerta.fonte] || ''}`}>{alerta.fonte}</Badge>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(alerta.created_at), { addSuffix: true, locale: ptBR })}
                      </p>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs h-6 px-2"
                        onClick={e => { e.stopPropagation(); arquivar(alerta.id); }}
                      >
                        <Archive className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination */}
          {totalPaginas > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button size="sm" variant="outline" disabled={pagina === 1} onClick={() => setPagina(p => p - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-xs text-muted-foreground">{pagina} / {totalPaginas}</span>
              <Button size="sm" variant="outline" disabled={pagina === totalPaginas} onClick={() => setPagina(p => p + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </Tabs>

        {/* Detail drawer */}
        <Sheet open={!!selectedAlerta} onOpenChange={() => setSelectedAlerta(null)}>
          <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
            {selectedAlerta && (() => {
              const cfg = TIPO_CONFIG[selectedAlerta.tipo] || TIPO_CONFIG.novo_edital;
              return (
                <>
                  <SheetHeader>
                    <div className="flex items-center gap-2">
                      <Badge className={`${cfg.color} border text-xs`}>
                        {cfg.emoji} {cfg.label}
                      </Badge>
                      {selectedAlerta.urgente && (
                        <Badge variant="destructive" className="text-xs">URGENTE</Badge>
                      )}
                    </div>
                    <SheetTitle className="text-left text-base mt-2">{selectedAlerta.titulo}</SheetTitle>
                  </SheetHeader>
                  <div className="space-y-4 mt-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">{selectedAlerta.descricao}</p>

                    <div className="bg-muted/30 rounded-lg p-3 space-y-2 text-sm">
                      {selectedAlerta.orgao && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">🏛️ Órgão</span>
                          <span className="font-medium text-right max-w-[60%]">{selectedAlerta.orgao}</span>
                        </div>
                      )}
                      {selectedAlerta.uf && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">📍 UF</span>
                          <span className="font-medium">{selectedAlerta.uf}</span>
                        </div>
                      )}
                      {selectedAlerta.numero_processo && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">📋 Processo</span>
                          <span className="font-medium">{selectedAlerta.numero_processo}</span>
                        </div>
                      )}
                      {selectedAlerta.numero_pregao && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">🔖 Pregão</span>
                          <span className="font-medium">{selectedAlerta.numero_pregao}</span>
                        </div>
                      )}
                      {selectedAlerta.valor_estimado && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">💰 Valor</span>
                          <span className="font-bold">R$ {Number(selectedAlerta.valor_estimado).toLocaleString('pt-BR')}</span>
                        </div>
                      )}
                      {selectedAlerta.data_abertura && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">📅 Abertura</span>
                          <span className="font-medium">{new Date(selectedAlerta.data_abertura).toLocaleDateString('pt-BR')}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">📡 Fonte</span>
                        <Badge className={`${FONTE_COLORS[selectedAlerta.fonte]} border-0 text-xs`}>{selectedAlerta.fonte}</Badge>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {selectedAlerta.url_edital && (
                        <a href={selectedAlerta.url_edital} target="_blank" rel="noopener noreferrer" className="flex-1">
                          <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                            <ExternalLink className="w-4 h-4 mr-2" /> Acessar Edital
                          </Button>
                        </a>
                      )}
                      <Button variant="outline" onClick={() => { arquivar(selectedAlerta.id); setSelectedAlerta(null); }}>
                        <Archive className="w-4 h-4 mr-1" /> Arquivar
                      </Button>
                    </div>
                  </div>
                </>
              );
            })()}
          </SheetContent>
        </Sheet>
      </div>
    </AppLayout>
  );
}
