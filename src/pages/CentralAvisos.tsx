import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import FaixaIndicadores from '@/components/gestao/FaixaIndicadores';
import { useAlertas, type TipoAlerta, type Alerta, type FiltrosAlertas } from '@/hooks/useAlertas';
import { toast } from 'sonner';
import {
  Bell, FileText, AlertTriangle, Ban, XCircle, CheckCircle2, Trophy,
  Archive, Eye, EyeOff, ChevronLeft, ChevronRight, ExternalLink,
  Settings, Filter, AlertCircle, Building2, MapPin, Hash, Bookmark,
  Banknote, CalendarDays, Rss,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

/**
 * Aparência por tipo de aviso.
 *
 * `ladrilho` pinta o quadradinho do ícone, e `variante` a etiqueta ao lado do
 * título. Os dois saem do MESMO trio tinta/tinta-escura, por isso ficam juntos
 * aqui: separados, cada um seguiria seu caminho na primeira alteração.
 *
 * O estado lido/não lido NÃO é cor de tipo (Design System v3): não lido vai
 * na tinta verde da ação (`bg-primary-tint`), lido fica no cartão branco. A
 * tarja saturada na borda esquerda saiu junto com o redesign — o ladrilho e o
 * selo já dizem o tipo, sem uma segunda cor disputando a linha.
 *
 * Alteração usa o azul informativo: é categoria, não alerta — âmbar já é
 * suspensão, e duas coisas diferentes na mesma cor se confundem na lista.
 */
type VarianteBadge = 'success' | 'warning' | 'danger' | 'info' | 'muted';

const TIPO_CONFIG: Record<
  string,
  { icon: React.ElementType; label: string; variante: VarianteBadge; ladrilho: string }
> = {
  novo_edital: {
    icon: FileText, label: 'Novo edital', variante: 'success',
    ladrilho: 'bg-primary-tint text-primary',
  },
  alteracao: {
    icon: AlertTriangle, label: 'Alteração', variante: 'info',
    ladrilho: 'bg-info-tint text-info-ink',
  },
  suspensao: {
    icon: Ban, label: 'Suspensão', variante: 'warning',
    ladrilho: 'bg-warning-tint text-warning-ink',
  },
  cancelamento: {
    icon: XCircle, label: 'Cancelamento', variante: 'danger',
    ladrilho: 'bg-destructive-tint text-destructive-ink',
  },
  homologacao: {
    icon: CheckCircle2, label: 'Homologação', variante: 'success',
    ladrilho: 'bg-success-tint text-success-ink',
  },
  resultado: {
    icon: Trophy, label: 'Resultado', variante: 'muted',
    ladrilho: 'bg-muted text-muted-foreground',
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

export default function CentralAvisos() {
  const {
    alertas, total, naoLidos, urgentes, loading, erro, pagina, totalPaginas,
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
        <CabecalhoPagina
          acoes={
            <Button variant="outline" asChild>
              <Link to="/configuracoes/alertas">
                <Settings aria-hidden="true" /> Configurar alertas
              </Link>
            </Button>
          }
        />

        {/* Resumo — cartão KPI do Design System: rótulo em cima, número
            tabular, ícone no canto. O tom do ícone marca o que é urgente. */}
        <FaixaIndicadores
          itens={[
            { rotulo: 'Total', valor: total, icone: Bell },
            { rotulo: 'Não lidos', valor: naoLidos, icone: EyeOff, tom: 'info' },
            { rotulo: 'Urgentes', valor: urgentes, icone: AlertTriangle, tom: 'critico' },
          ]}
        />

        {/* Filter chips — o ícone Lucide do tipo no lugar do emoji, que é o
            único "ícone multicolorido" que o Design System não admite. */}
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" aria-expanded={showFilters} onClick={() => setShowFilters(!showFilters)}>
            <Filter aria-hidden="true" /> Filtros {filtroTipos.length > 0 && `(${filtroTipos.length})`}
          </Button>
          {showFilters && Object.entries(TIPO_CONFIG).map(([tipo, cfg]) => {
            const Icone = cfg.icon;
            return (
              <Button
                key={tipo}
                size="sm"
                variant={filtroTipos.includes(tipo as TipoAlerta) ? 'default' : 'outline'}
                aria-pressed={filtroTipos.includes(tipo as TipoAlerta)}
                onClick={() => toggleTipo(tipo as TipoAlerta)}
              >
                <Icone aria-hidden="true" /> {cfg.label}
              </Button>
            );
          })}
        </div>

        <Tabs value={tab} onValueChange={v => { setTab(v); setPagina(1); }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
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
                <Eye aria-hidden="true" /> Marcar todos como lidos
              </Button>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            {loading ? (
              /* Esqueleto na forma da linha de aviso: ladrilho, título, meta, hora. */
              <div className="space-y-2" role="status">
                <span className="sr-only">Carregando avisos…</span>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3.5 rounded-lg border border-border bg-card px-4 py-3.5 shadow-sm">
                    <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3.5 w-1/2" />
                    </div>
                    <Skeleton className="h-4 w-10" />
                  </div>
                ))}
              </div>
            ) : erro ? (
              /* Princípio 3 do CLAUDE.md: a falha de carga deixa rastro. A
                 mensagem vem do hook; o retry é o próprio filtro/aba. */
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                <AlertDescription>{erro}</AlertDescription>
              </Alert>
            ) : alertas.length === 0 ? (
              <Card>
                <EstadoVazio
                  icone={<Bell />}
                  titulo="Nenhum aviso encontrado"
                  descricao="Configure seus segmentos e UFs para receber avisos personalizados."
                  acao={
                    <Button variant="outline" asChild>
                      <Link to="/configuracoes/alertas">
                        <Settings aria-hidden="true" /> Configurar alertas
                      </Link>
                    </Button>
                  }
                />
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
                  <h2 className="pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
                        /* Não lido na tinta verde da ação; lido no cartão
                           branco. Sem opacidade: texto apagado é texto que
                           não passa no contraste. */
                        className={`flex cursor-pointer items-start gap-3.5 rounded-lg border px-4 py-3.5 shadow-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                          alerta.lido
                            ? 'border-border bg-card hover:bg-muted/60'
                            : 'border-primary-line bg-primary-tint hover:border-primary/40'
                        }`}
                      >
                        <div aria-hidden="true" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${cfg.ladrilho}`}>
                          <Icon className="h-4 w-4" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className={`text-base leading-5 text-foreground ${alerta.lido ? 'font-medium' : 'font-semibold'}`}>
                              {alerta.titulo}
                            </p>
                            <Badge variant={cfg.variante}>{cfg.label}</Badge>
                            {alerta.urgente && <Badge variant="danger">Urgente</Badge>}
                          </div>

                          {/* Órgão · UF · processo numa linha só, como no
                              protótipo — antes eram três etiquetas soltas. */}
                          <p className="mt-1 truncate text-sm text-muted-foreground">
                            {[alerta.orgao, alerta.uf, alerta.numero_processo || alerta.numero_pregao]
                              .filter(Boolean)
                              .join('  ·  ')}
                          </p>
                        </div>

                        {/* Hora e arquivar sempre visíveis: ação que só aparece
                            no hover não existe no toque. */}
                        <div className="flex shrink-0 items-center gap-1 self-start">
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {horaDe(alerta.created_at)}
                          </span>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label="Arquivar aviso"
                            className="text-muted-foreground hover:text-foreground"
                            onClick={e => { e.stopPropagation(); arquivar(alerta.id); }}
                          >
                            <Archive aria-hidden="true" />
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
            <div className="mt-4 flex items-center justify-center gap-2">
              <Button size="sm" variant="outline" aria-label="Página anterior" disabled={pagina === 1} onClick={() => setPagina(p => p - 1)}>
                <ChevronLeft aria-hidden="true" />
              </Button>
              <span className="text-sm text-muted-foreground tabular-nums">{pagina} / {totalPaginas}</span>
              <Button size="sm" variant="outline" aria-label="Próxima página" disabled={pagina === totalPaginas} onClick={() => setPagina(p => p + 1)}>
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>
          )}
        </Tabs>

        {/* Detail drawer */}
        <Sheet open={!!selectedAlerta} onOpenChange={() => setSelectedAlerta(null)}>
          <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
            {selectedAlerta && (() => {
              const cfg = TIPO_CONFIG[selectedAlerta.tipo] || TIPO_CONFIG.novo_edital;
              const Icone = cfg.icon;
              return (
                <>
                  <SheetHeader>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={cfg.variante} className="gap-1">
                        <Icone className="h-3 w-3" aria-hidden="true" /> {cfg.label}
                      </Badge>
                      {selectedAlerta.urgente && <Badge variant="danger">Urgente</Badge>}
                    </div>
                    <SheetTitle className="mt-2">{selectedAlerta.titulo}</SheetTitle>
                  </SheetHeader>
                  <div className="mt-4 space-y-4">
                    <p className="text-sm leading-relaxed text-muted-foreground">{selectedAlerta.descricao}</p>

                    {/* Ficha do aviso — rótulo com ícone Lucide (sem emoji) e
                        valor à direita, na superfície rebaixada. */}
                    <div className="space-y-2 rounded-md border border-border bg-secondary p-3 text-sm">
                      {selectedAlerta.orgao && (
                        <div className="flex justify-between gap-3">
                          <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Building2 className="h-3.5 w-3.5" aria-hidden="true" />Órgão</span>
                          <span className="max-w-[60%] text-right font-medium text-foreground">{selectedAlerta.orgao}</span>
                        </div>
                      )}
                      {selectedAlerta.uf && (
                        <div className="flex justify-between gap-3">
                          <span className="inline-flex items-center gap-1.5 text-muted-foreground"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />UF</span>
                          <span className="font-medium text-foreground">{selectedAlerta.uf}</span>
                        </div>
                      )}
                      {selectedAlerta.numero_processo && (
                        <div className="flex justify-between gap-3">
                          <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Hash className="h-3.5 w-3.5" aria-hidden="true" />Processo</span>
                          <span className="font-medium tabular-nums text-foreground">{selectedAlerta.numero_processo}</span>
                        </div>
                      )}
                      {selectedAlerta.numero_pregao && (
                        <div className="flex justify-between gap-3">
                          <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Bookmark className="h-3.5 w-3.5" aria-hidden="true" />Pregão</span>
                          <span className="font-medium tabular-nums text-foreground">{selectedAlerta.numero_pregao}</span>
                        </div>
                      )}
                      {selectedAlerta.valor_estimado && (
                        <div className="flex justify-between gap-3">
                          <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Banknote className="h-3.5 w-3.5" aria-hidden="true" />Valor</span>
                          <span className="font-semibold tabular-nums text-foreground">R$ {Number(selectedAlerta.valor_estimado).toLocaleString('pt-BR')}</span>
                        </div>
                      )}
                      {selectedAlerta.data_abertura && (
                        <div className="flex justify-between gap-3">
                          <span className="inline-flex items-center gap-1.5 text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />Abertura</span>
                          <span className="font-medium tabular-nums text-foreground">{new Date(selectedAlerta.data_abertura).toLocaleDateString('pt-BR')}</span>
                        </div>
                      )}
                      <div className="flex justify-between gap-3">
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Rss className="h-3.5 w-3.5" aria-hidden="true" />Fonte</span>
                        <Badge variant="muted">{selectedAlerta.fonte}</Badge>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {selectedAlerta.url_edital && (
                        <Button asChild className="flex-1">
                          <a href={selectedAlerta.url_edital} target="_blank" rel="noopener noreferrer">
                            <ExternalLink aria-hidden="true" /> Acessar edital
                          </a>
                        </Button>
                      )}
                      <Button variant="outline" onClick={() => { arquivar(selectedAlerta.id); setSelectedAlerta(null); }}>
                        <Archive aria-hidden="true" /> Arquivar
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
