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

/**
 * Aparência por tipo de aviso.
 *
 * `tarja` é a faixa colorida na borda esquerda da linha — é o que deixa o tipo
 * legível ao correr o olho pela lista, antes de ler qualquer palavra.
 * `ladrilho` pinta o quadradinho do ícone, e `selo` a etiqueta ao lado do
 * título. Os três saem do MESMO matiz, por isso ficam juntos aqui: separados,
 * cada um seguiria seu caminho na primeira alteração.
 *
 * Alteração usa violeta (`--chart-5`) por ser categoria, não estado: âmbar já
 * é suspensão, e duas coisas diferentes na mesma cor se confundem na lista.
 */
const TIPO_CONFIG: Record<
  string,
  { icon: React.ElementType; label: string; color: string; tarja: string; ladrilho: string; selo: string; emoji: string }
> = {
  novo_edital: {
    icon: FileText, label: 'Novo edital', emoji: '🆕',
    color: 'bg-accent/10 text-accent border-accent/30',
    tarja: 'bg-accent', ladrilho: 'bg-accent/10 text-accent', selo: 'bg-accent/10 text-accent',
  },
  alteracao: {
    icon: AlertTriangle, label: 'Alteração', emoji: '⚠️',
    color: 'bg-chart-5/10 text-chart-5 border-chart-5/30',
    tarja: 'bg-chart-5', ladrilho: 'bg-chart-5/10 text-chart-5', selo: 'bg-chart-5/10 text-chart-5',
  },
  suspensao: {
    icon: Ban, label: 'Suspensão', emoji: '🚫',
    color: 'bg-warning-tint text-warning-ink border-warning-line',
    tarja: 'bg-warning', ladrilho: 'bg-warning-tint text-warning-ink', selo: 'bg-warning-tint text-warning-ink',
  },
  cancelamento: {
    icon: XCircle, label: 'Cancelamento', emoji: '❌',
    color: 'bg-destructive-tint text-destructive-ink border-destructive-line',
    tarja: 'bg-destructive', ladrilho: 'bg-destructive-tint text-destructive-ink', selo: 'bg-destructive-tint text-destructive-ink',
  },
  homologacao: {
    icon: CheckCircle2, label: 'Homologação', emoji: '✅',
    color: 'bg-success-tint text-success-ink border-success-line',
    tarja: 'bg-success', ladrilho: 'bg-success-tint text-success-ink', selo: 'bg-success-tint text-success-ink',
  },
  resultado: {
    icon: Trophy, label: 'Resultado', emoji: '📊',
    color: 'bg-muted text-muted-foreground border-border',
    tarja: 'bg-border', ladrilho: 'bg-muted text-muted-foreground', selo: 'bg-muted text-muted-foreground',
  },
};

/**
 * Em que dia o aviso caiu, do ponto de vista de quem lê hoje.
 * Só apresentação: agrupa a lista que o banco já devolveu ordenada.
 */
function rotuloDoDia(iso: string): string {
  const dia = new Date(iso);
  const hoje = new Date();
  const zerar = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dias = Math.round((zerar(hoje) - zerar(dia)) / 86_400_000);
  if (dias <= 0) return 'Hoje';
  if (dias === 1) return 'Ontem';
  if (dias === 2) return 'Anteontem';
  return dia.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
}

const horaDe = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

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
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold tracking-tight">Central de Avisos</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Editais, alterações, suspensões, cancelamentos e homologações
            </p>
          </div>
          <Link to="/configuracoes/alertas" className="flex-shrink-0">
            <Button variant="outline">
              <Settings className="w-4 h-4" /> Configurar
            </Button>
          </Link>
        </div>

        {/* Resumo — número grande e rótulo embaixo, como no protótipo */}
        <div className="grid grid-cols-3 gap-4 [&>*]:min-w-0">
          {[
            { valor: total, rotulo: 'Total', cor: '' },
            { valor: naoLidos, rotulo: 'Não lidos', cor: '' },
            { valor: urgentes, rotulo: 'Urgentes', cor: 'text-destructive' },
          ].map((s) => (
            <Card key={s.rotulo} className="py-6 px-4 text-center">
              <p className={`text-4xl font-bold tabular-nums leading-none ${s.cor}`}>{s.valor}</p>
              <p className="text-sm text-muted-foreground mt-2">{s.rotulo}</p>
            </Card>
          ))}
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
            {/* Toda aba carrega o próprio contador — no protótipo o número faz
                parte da aba, e é o que diz se vale a pena entrar nela. */}
            <TabsList>
              <TabsTrigger value="todos">
                Todos <span className="ml-1.5 text-xs tabular-nums opacity-70">{total}</span>
              </TabsTrigger>
              <TabsTrigger value="nao_lidos">
                Não lidos <span className="ml-1.5 text-xs tabular-nums opacity-70">{naoLidos}</span>
              </TabsTrigger>
              <TabsTrigger value="urgentes">
                Urgentes <span className="ml-1.5 text-xs tabular-nums opacity-70">{urgentes}</span>
              </TabsTrigger>
              <TabsTrigger value="arquivados">Arquivados</TabsTrigger>
            </TabsList>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={marcarTodosLidos}>
                <Eye className="w-4 h-4" /> Marcar todos como lidos
              </Button>
            </div>
          </div>

          <div className="mt-4 space-y-4">
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
              // Agrupado por dia, preservando a ordem que veio do banco. O
              // rótulo do dia é o que dá noção de tempo sem obrigar a ler hora
              // por hora — "há 2 horas" em cada linha não compõe essa noção.
              Object.entries(
                alertas.reduce<Record<string, typeof alertas>>((acc, a) => {
                  const dia = rotuloDoDia(a.created_at);
                  (acc[dia] ||= []).push(a);
                  return acc;
                }, {}),
              ).map(([dia, doDia]) => (
                <section key={dia} className="space-y-2">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground pt-2">
                    {dia}
                  </h2>

                  {doDia.map(alerta => {
                    const cfg = TIPO_CONFIG[alerta.tipo] || TIPO_CONFIG.novo_edital;
                    const Icon = cfg.icon;
                    return (
                      <div
                        key={alerta.id}
                        onClick={() => openAlerta(alerta)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openAlerta(alerta); } }}
                        className={`group relative flex items-start gap-3.5 pl-5 pr-4 py-3.5 rounded-xl bg-card shadow-sm cursor-pointer overflow-hidden transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                          alerta.lido ? 'opacity-60 hover:opacity-100' : ''
                        }`}
                      >
                        {/* Tarja do tipo. Some no lido: a cor é chamado de
                            atenção, e o que já foi lido não chama mais. */}
                        {!alerta.lido && (
                          <span className={`absolute left-0 top-0 bottom-0 w-1 ${cfg.tarja}`} aria-hidden="true" />
                        )}

                        <div className={`w-9 h-9 rounded-lg shrink-0 flex items-center justify-center ${cfg.ladrilho}`}>
                          <Icon className="w-4 h-4" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={`text-base leading-snug ${alerta.lido ? 'font-medium' : 'font-semibold'}`}>
                              {alerta.titulo}
                            </p>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full leading-none whitespace-nowrap ${cfg.selo}`}>
                              {cfg.label}
                            </span>
                            {alerta.urgente && (
                              <span className="text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full leading-none bg-destructive-tint text-destructive-ink whitespace-nowrap">
                                Urgente
                              </span>
                            )}
                          </div>

                          {/* Órgão · UF · processo numa linha só, como no
                              protótipo — antes eram três etiquetas soltas. */}
                          <p className="text-sm text-muted-foreground mt-1 truncate">
                            {[alerta.orgao, alerta.uf, alerta.numero_processo || alerta.numero_pregao]
                              .filter(Boolean)
                              .join('  ·  ')}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 shrink-0 self-start">
                          <span className="text-sm text-muted-foreground tabular-nums">
                            {horaDe(alerta.created_at)}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label="Arquivar aviso"
                            className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity h-7 w-7 p-0"
                            onClick={e => { e.stopPropagation(); arquivar(alerta.id); }}
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </section>
              ))
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
