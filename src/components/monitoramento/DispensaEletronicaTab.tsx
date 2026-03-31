import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Globe, Search, ExternalLink, MapPin, Building2, ShieldCheck,
  Zap, Filter, CheckCircle2, AlertTriangle, Info, ChevronDown, ChevronUp,
} from 'lucide-react';
import {
  TODOS_PORTAIS, getPortaisDispensa, PORTAIS_FEDERAIS, PORTAIS_ESTADUAIS,
  PORTAIS_PLATAFORMAS, REGIOES_UFS, UF_NOMES,
  type PortalCompras, type PortalCategoria,
} from '@/data/portais-compras';

const categoriaConfig: Record<PortalCategoria, { label: string; className: string; icon: typeof Globe }> = {
  federal: { label: 'Federal', className: 'bg-info/15 text-info border-info/30', icon: Building2 },
  estadual: { label: 'Estadual', className: 'bg-accent/15 text-accent border-accent/30', icon: MapPin },
  plataforma: { label: 'Plataforma', className: 'bg-primary/15 text-primary border-primary/30', icon: Globe },
  municipal: { label: 'Municipal', className: 'bg-warning/15 text-warning border-warning/30', icon: Building2 },
};

function PortalCard({ portal }: { portal: PortalCompras }) {
  const [expanded, setExpanded] = useState(false);
  const catCfg = categoriaConfig[portal.categoria];

  return (
    <div className="bg-card rounded-xl border border-border/50 p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Globe className="w-4 h-4 text-accent shrink-0" />
          <h3 className="font-semibold text-sm truncate">{portal.nomeAbreviado}</h3>
        </div>
        <div className="flex gap-1 shrink-0">
          {portal.dispensaEletronica && (
            <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-[9px] px-1.5">
              Dispensa
            </Badge>
          )}
          {portal.licitacao && (
            <Badge variant="outline" className="bg-info/10 text-info border-info/30 text-[9px] px-1.5">
              Licitação
            </Badge>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <Badge variant="outline" className={`${catCfg.className} text-[9px]`}>
          {catCfg.label}
        </Badge>
        {portal.uf && (
          <Badge variant="outline" className="text-[9px]">
            {portal.uf}
          </Badge>
        )}
        {portal.apiDisponivel && (
          <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-[9px]">
            <Zap className="w-2.5 h-2.5 mr-0.5" /> API
          </Badge>
        )}
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-muted-foreground text-left hover:text-foreground transition-colors flex items-center gap-1 mb-3"
      >
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {expanded ? 'Ocultar detalhes' : 'Ver detalhes'}
      </button>

      {expanded && (
        <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
          {portal.descricao}
        </p>
      )}

      <div className="mt-auto">
        <Button size="sm" variant="default" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" asChild>
          <a href={portal.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="w-3 h-3 mr-1" /> Acessar Portal
          </a>
        </Button>
      </div>
    </div>
  );
}

export default function DispensaEletronicaTab() {
  const [search, setSearch] = useState('');
  const [regiaoFilter, setRegiaoFilter] = useState<string>('all');
  const [categoriaFilter, setCategoriaFilter] = useState<string>('all');
  const [subTab, setSubTab] = useState('todos');

  const portaisDispensa = useMemo(() => getPortaisDispensa(), []);

  const portaisFiltrados = useMemo(() => {
    let list = subTab === 'todos'
      ? portaisDispensa
      : subTab === 'federais'
        ? PORTAIS_FEDERAIS.filter(p => p.dispensaEletronica)
        : subTab === 'estaduais'
          ? PORTAIS_ESTADUAIS.filter(p => p.dispensaEletronica)
          : PORTAIS_PLATAFORMAS.filter(p => p.dispensaEletronica);

    if (regiaoFilter !== 'all') {
      const ufsRegiao = REGIOES_UFS[regiaoFilter]?.ufs || [];
      list = list.filter(p => !p.uf || ufsRegiao.includes(p.uf));
    }

    if (categoriaFilter !== 'all') {
      list = list.filter(p => p.categoria === categoriaFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.nome.toLowerCase().includes(q) ||
        p.nomeAbreviado.toLowerCase().includes(q) ||
        (p.uf && UF_NOMES[p.uf]?.toLowerCase().includes(q)) ||
        (p.uf && p.uf.toLowerCase().includes(q))
      );
    }

    return list;
  }, [portaisDispensa, subTab, regiaoFilter, categoriaFilter, search]);

  const stats = useMemo(() => ({
    total: portaisDispensa.length,
    federais: PORTAIS_FEDERAIS.filter(p => p.dispensaEletronica).length,
    estaduais: PORTAIS_ESTADUAIS.filter(p => p.dispensaEletronica).length,
    plataformas: PORTAIS_PLATAFORMAS.filter(p => p.dispensaEletronica).length,
    comApi: portaisDispensa.filter(p => p.apiDisponivel).length,
    ufsCobertas: new Set(portaisDispensa.filter(p => p.uf).map(p => p.uf)).size,
  }), [portaisDispensa]);

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-accent/5 border border-accent/20 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-accent mt-0.5 shrink-0" />
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Dispensa Eletrônica — Lei 14.133/2021 (Valores 2026)</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            A dispensa de licitação na forma eletrônica é obrigatória para contratações diretas até
            os limites legais atualizados pelo <strong>Decreto nº 12.807/2025</strong>, vigentes desde 1º/jan/2026:
          </p>
          <ul className="text-xs text-muted-foreground leading-relaxed list-disc list-inside mt-1 space-y-0.5">
            <li><strong>R$ 65.492,11</strong> — Compras e outros serviços (art. 75, II)</li>
            <li><strong>R$ 130.984,20</strong> — Obras e serviços de engenharia (art. 75, I)</li>
            <li><strong>R$ 10.478,74</strong> — Manutenção de veículos e peças (art. 75, §7º)</li>
            <li><strong>R$ 13.098,41</strong> — Contrato verbal / entrega imediata (art. 95, §2º)</li>
          </ul>
          <p className="text-xs text-muted-foreground leading-relaxed mt-1">
            Desde setembro/2025, todas as dispensas com disputa no Governo Federal ocorrem exclusivamente no <strong>Novo DC (Compras.gov.br)</strong>.
            Cada estado e plataforma homologada também opera sua própria dispensa eletrônica.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        <div className="stat-card text-center">
          <p className="text-lg sm:text-2xl font-bold text-accent">{stats.total}</p>
          <p className="text-[10px] text-muted-foreground">Portais com Dispensa</p>
        </div>
        <div className="stat-card text-center">
          <p className="text-lg sm:text-2xl font-bold text-info">{stats.federais}</p>
          <p className="text-[10px] text-muted-foreground">Federais</p>
        </div>
        <div className="stat-card text-center">
          <p className="text-lg sm:text-2xl font-bold text-primary">{stats.estaduais}</p>
          <p className="text-[10px] text-muted-foreground">Estaduais</p>
        </div>
        <div className="stat-card text-center">
          <p className="text-lg sm:text-2xl font-bold text-warning">{stats.plataformas}</p>
          <p className="text-[10px] text-muted-foreground">Plataformas</p>
        </div>
        <div className="stat-card text-center">
          <p className="text-lg sm:text-2xl font-bold text-success">{stats.comApi}</p>
          <p className="text-[10px] text-muted-foreground">Com API</p>
        </div>
        <div className="stat-card text-center">
          <p className="text-lg sm:text-2xl font-bold text-foreground">{stats.ufsCobertas}/27</p>
          <p className="text-[10px] text-muted-foreground">UFs Cobertas</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar portal por nome ou UF..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={regiaoFilter} onValueChange={setRegiaoFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Região" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Regiões</SelectItem>
            {Object.entries(REGIOES_UFS).map(([key, val]) => (
              <SelectItem key={key} value={key}>{val.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="federal">Federal</SelectItem>
            <SelectItem value="estadual">Estadual</SelectItem>
            <SelectItem value="plataforma">Plataforma</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Sub-tabs */}
      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList>
          <TabsTrigger value="todos">Todos ({stats.total})</TabsTrigger>
          <TabsTrigger value="federais">Federais ({stats.federais})</TabsTrigger>
          <TabsTrigger value="estaduais">Estaduais ({stats.estaduais})</TabsTrigger>
          <TabsTrigger value="plataformas">Plataformas ({stats.plataformas})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Portal Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {portaisFiltrados.map(portal => (
          <PortalCard key={portal.id} portal={portal} />
        ))}
      </div>

      {portaisFiltrados.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Nenhum portal encontrado com os filtros selecionados.</p>
        </div>
      )}

      {/* UF Coverage Map */}
      <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-accent" />
          Cobertura por Unidade Federativa
        </h3>
        <div className="space-y-4">
          {Object.entries(REGIOES_UFS).map(([key, regiao]) => (
            <div key={key}>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {regiao.nome}
              </h4>
              <div className="flex flex-wrap gap-2">
                {regiao.ufs.map(uf => {
                  const portaisUF = TODOS_PORTAIS.filter(p => p.uf === uf && p.dispensaEletronica);
                  const temPortal = portaisUF.length > 0;
                  return (
                    <div
                      key={uf}
                      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs ${
                        temPortal
                          ? 'border-success/30 bg-success/5'
                          : 'border-border/50 bg-muted/30'
                      }`}
                      title={temPortal ? portaisUF.map(p => p.nomeAbreviado).join(', ') : 'Utiliza PNCP / Plataformas'}
                    >
                      {temPortal ? (
                        <CheckCircle2 className="w-3 h-3 text-success" />
                      ) : (
                        <Globe className="w-3 h-3 text-muted-foreground" />
                      )}
                      <span className="font-medium">{uf}</span>
                      {temPortal && (
                        <span className="text-[9px] text-muted-foreground">({portaisUF.length})</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-4">
          UFs sem portal estadual próprio utilizam PNCP + plataformas homologadas (BLL, BNC, Licitações-e, etc.) para dispensas eletrônicas.
        </p>
      </div>
    </div>
  );
}
