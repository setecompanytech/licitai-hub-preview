import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Search, RefreshCw, FileText, AlertTriangle, XCircle, Clock,
  CheckCircle2, Globe, Building2, MapPin, Award, PauseCircle,
  ArrowUpDown, FileCheck, Newspaper, ExternalLink, Eye,
  CalendarDays, Bookmark, Sparkles, ChevronDown, ChevronUp, CalendarIcon, Download
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type AtoLicitatorio = {
  id: string;
  titulo: string;
  orgao: string;
  tipo: string | null;
  portal: string | null;
  data_publicacao: string | null;
  valor_estimado: number | null;
  municipio: string | null;
  uf: string | null;
  url: string | null;
  relevancia_score: number | null;
  palavras_chave: string[] | null;
  cnae_compativel: boolean | null;
  lido: boolean | null;
  status: string | null;
  created_at: string;
};

const tipoConfig: Record<string, { label: string; icon: typeof FileText; color: string }> = {
  aviso_licitacao: { label: 'Aviso de Licitação', icon: CalendarDays, color: 'bg-accent/15 text-accent border-accent/30' },
  edital: { label: 'Edital', icon: FileText, color: 'bg-info/15 text-info border-info/30' },
  suspensao: { label: 'Suspenso', icon: PauseCircle, color: 'bg-warning/15 text-warning border-warning/30' },
  cancelamento: { label: 'Cancelado', icon: XCircle, color: 'bg-destructive/15 text-destructive border-destructive/30' },
  adiamento: { label: 'Adiado', icon: Clock, color: 'bg-warning/15 text-warning border-warning/30' },
  revogacao: { label: 'Revogado', icon: XCircle, color: 'bg-destructive/15 text-destructive border-destructive/30' },
  homologacao: { label: 'Homologado', icon: FileCheck, color: 'bg-success/15 text-success border-success/30' },
  adjudicacao: { label: 'Adjudicado', icon: Award, color: 'bg-success/15 text-success border-success/30' },
  aditivamento: { label: 'Aditivado', icon: ArrowUpDown, color: 'bg-primary/15 text-primary border-primary/30' },
  errata: { label: 'Errata', icon: AlertTriangle, color: 'bg-warning/15 text-warning border-warning/30' },
  resultado: { label: 'Resultado', icon: CheckCircle2, color: 'bg-info/15 text-info border-info/30' },
  contrato: { label: 'Contrato', icon: Bookmark, color: 'bg-primary/15 text-primary border-primary/30' },
  ata_registro_precos: { label: 'Ata de Registro', icon: FileText, color: 'bg-accent/15 text-accent border-accent/30' },
};

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const UFS_DISPONIVEIS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS',
  'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC',
  'SE', 'SP', 'TO'
];

const FONTES_DIARIOS = [
  { id: 'todos', label: 'Todas as fontes', url: '' },
  { id: 'dou', label: 'DOU (Federal)', url: 'https://www.in.gov.br/servicos/diario-oficial-da-uniao' },
  { id: 'ioepa', label: 'IOEPA (Estadual)', url: 'https://www.ioepa.com.br/portal/' },
  { id: 'tcmpa', label: 'TCMPA (Municípios)', url: 'https://www.tcmpa.tc.br/portalsc/LISTAGEM_GRID/' },
  { id: 'doesp', label: 'DOE/SP', url: 'https://doe.sp.gov.br/' },
  { id: 'ioerj', label: 'IOERJ', url: 'https://portal.ioerj.com.br/' },
  { id: 'dodf', label: 'DODF.e (Distrito Federal)', url: 'https://dodf.df.gov.br/' },
  { id: 'dobelem', label: 'DO Belém', url: 'https://sistemas.belem.pa.gov.br/diario/painel' },
  { id: 'doananindeua', label: 'DO Ananindeua', url: 'https://ananindeua.pa.gov.br/diario_oficial' },
  { id: 'pncp', label: 'PNCP', url: 'https://pncp.gov.br/app/editais?pagina=1' },
];

export default function DiariosOficiaisTab() {
  const { user } = useAuth();
  const [atos, setAtos] = useState<AtoLicitatorio[]>([]);
  const [loading, setLoading] = useState(true);
  const [buscando, setBuscando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [busca, setBusca] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('todos');
  const [ufFiltro, setUfFiltro] = useState('todos');
  const [fonteFiltro, setFonteFiltro] = useState('todos');
  const [ufsBusca, setUfsBusca] = useState<string[]>(['PA']);
  const [mostrarPortais, setMostrarPortais] = useState(false);
  const [buscaIA, setBuscaIA] = useState('');
  const [buscandoIA, setBuscandoIA] = useState(false);
  const [dataInicio, setDataInicio] = useState<Date | undefined>();
  const [dataFim, setDataFim] = useState<Date | undefined>();

  const carregarAtos = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('monitoramento_editais')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Erro ao carregar atos:', error);
    } else {
      setAtos(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    carregarAtos();
  }, [user]);

  const handleBuscar = async () => {
    if (!user) return;
    setBuscando(true);
    setProgresso(0);

    const interval = setInterval(() => {
      setProgresso(p => Math.min(90, p + Math.random() * 12));
    }, 500);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/busca-diarios-oficiais`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({
            ufs: ufsBusca,
            palavras_chave: buscaIA
              ? buscaIA.split(',').map(s => s.trim()).filter(Boolean)
              : ['licitação', 'pregão', 'concorrência', 'obra', 'construção', 'pavimentação', 'reforma', 'infraestrutura'],
            dias_retroativos: 7,
          }),
        }
      );

      if (!response.ok) {
        if (response.status === 429) {
          toast.error('Limite de requisições atingido. Aguarde e tente novamente.');
        } else if (response.status === 402) {
          toast.error('Créditos insuficientes. Adicione créditos ao workspace.');
        } else {
          toast.error('Erro na busca. Tente novamente.');
        }
        return;
      }

      const data = await response.json();
      if (data.success) {
        toast.success(`${data.total} atos encontrados em ${data.diarios_pesquisados?.length || 0} diários oficiais`);
        await carregarAtos();
      } else {
        toast.error(data.error || 'Erro na busca');
      }
    } catch (err) {
      toast.error('Erro ao conectar com o serviço de busca');
      console.error(err);
    } finally {
      clearInterval(interval);
      setProgresso(100);
      setTimeout(() => {
        setBuscando(false);
        setProgresso(0);
      }, 500);
    }
  };

  const handleBuscaIA = async () => {
    if (!buscaIA.trim()) {
      toast.error('Digite termos para a pesquisa avançada com IA');
      return;
    }
    setBuscandoIA(true);
    await handleBuscar();
    setBuscandoIA(false);
  };

  const marcarComoLido = async (id: string) => {
    await supabase.from('monitoramento_editais').update({ lido: true }).eq('id', id);
    setAtos(prev => prev.map(a => a.id === id ? { ...a, lido: true } : a));
  };

  const atosFiltrados = atos.filter(a => {
    const matchBusca = !busca ||
      a.titulo.toLowerCase().includes(busca.toLowerCase()) ||
      a.orgao.toLowerCase().includes(busca.toLowerCase()) ||
      (a.palavras_chave || []).some(kw => kw.toLowerCase().includes(busca.toLowerCase())) ||
      (a.url || '').toLowerCase().includes(busca.toLowerCase());
    const matchTipo = tipoFiltro === 'todos' || a.tipo === tipoFiltro;
    const matchUf = ufFiltro === 'todos' || a.uf === ufFiltro;
    const matchDataInicio = !dataInicio || (a.data_publicacao && new Date(a.data_publicacao) >= dataInicio);
    const matchDataFim = !dataFim || (a.data_publicacao && new Date(a.data_publicacao) <= new Date(dataFim.getTime() + 86400000));
    const portalLower = a.portal?.toLowerCase() || '';
    const matchFonte = fonteFiltro === 'todos' ||
      (fonteFiltro === 'tcmpa' && portalLower.includes('tcm')) ||
      (fonteFiltro === 'dou' && portalLower.includes('dou')) ||
      (fonteFiltro === 'ioepa' && (portalLower.includes('ioepa') || portalLower.includes('doe-pa') || portalLower.includes('pará'))) ||
      (fonteFiltro === 'doesp' && (portalLower.includes('doe-sp') || portalLower.includes('doesp') || portalLower.includes('são paulo'))) ||
      (fonteFiltro === 'ioerj' && (portalLower.includes('ioerj') || portalLower.includes('doe-rj') || portalLower.includes('rio de janeiro'))) ||
      (fonteFiltro === 'dodf' && (portalLower.includes('dodf') || portalLower.includes('doe-df') || portalLower.includes('distrito federal'))) ||
      (fonteFiltro === 'dobelem' && (portalLower.includes('belém') || portalLower.includes('belem'))) ||
      (fonteFiltro === 'doananindeua' && portalLower.includes('ananindeua')) ||
      (fonteFiltro === 'pncp' && portalLower.includes('pncp'));
    return matchBusca && matchTipo && matchUf && matchFonte && matchDataInicio && matchDataFim;
  });

  const naoLidos = atos.filter(a => !a.lido).length;
  const fonteAtual = FONTES_DIARIOS.find(f => f.id === fonteFiltro);

  return (
    <div className="space-y-4">
      {/* Header da busca */}
      <div className="bg-card rounded-xl border border-border/50 p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-accent" />
            <h3 className="font-semibold text-sm">Busca nos Diários Oficiais</h3>
            <Badge variant="outline" className="bg-accent/15 text-accent border-accent/30 text-[10px]">
              {naoLidos > 0 ? `${naoLidos} novos` : `${atos.length} registros`}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Select value={ufsBusca[0] || 'PA'} onValueChange={v => setUfsBusca([v])}>
              <SelectTrigger className="w-[100px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UFS_DISPONIVEIS.map(uf => (
                  <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleBuscar}
              disabled={buscando}
              size="sm"
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              {buscando ? (
                <><RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" /> Buscando...</>
              ) : (
                <><Search className="w-3.5 h-3.5 mr-1" /> Buscar Diários Oficiais</>
              )}
            </Button>
          </div>
        </div>

        {buscando && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Pesquisando diários oficiais ({ufsBusca[0]})...</span>
              <span>{Math.round(progresso)}%</span>
            </div>
            <Progress value={progresso} className="h-1.5" />
          </div>
        )}

        {/* Pesquisa avançada com IA */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-accent" />
            <Input
              placeholder="Pesquisa avançada com IA (ex: pavimentação, saneamento, energia solar...)"
              value={buscaIA}
              onChange={e => setBuscaIA(e.target.value)}
              className="pl-9 text-xs"
              onKeyDown={e => e.key === 'Enter' && handleBuscaIA()}
            />
          </div>
          <Button
            onClick={handleBuscaIA}
            disabled={buscandoIA || buscando}
            size="sm"
            variant="outline"
            className="shrink-0"
          >
            {buscandoIA ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <><Sparkles className="w-3.5 h-3.5 mr-1" /> Pesquisar com IA</>
            )}
          </Button>
        </div>

        {/* Toggle para mostrar portais */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-between text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setMostrarPortais(!mostrarPortais)}
        >
          <span className="flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5" />
            Acessar portais dos Diários Oficiais
          </span>
          {mostrarPortais ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </Button>

        {mostrarPortais && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {FONTES_DIARIOS.filter(f => f.id !== 'todos').map(fonte => (
              <a
                key={fonte.id}
                href={fonte.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/40 hover:bg-muted/80 border border-border/30 hover:border-accent/40 transition-all group"
              >
                <div className="w-7 h-7 rounded-md bg-accent/10 flex items-center justify-center shrink-0 group-hover:bg-accent/20 transition-colors">
                  <Newspaper className="w-3.5 h-3.5 text-accent" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{fonte.label}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{fonte.url}</p>
                </div>
                <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-accent shrink-0" />
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Filtrar por CNPJ, objeto, órgão, palavras-chave..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("h-10 text-xs gap-1.5", dataInicio && "text-foreground")}>
              <CalendarIcon className="w-3.5 h-3.5" />
              {dataInicio ? format(dataInicio, "dd/MM/yyyy") : "Data início"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dataInicio} onSelect={setDataInicio} locale={ptBR} className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("h-10 text-xs gap-1.5", dataFim && "text-foreground")}>
              <CalendarIcon className="w-3.5 h-3.5" />
              {dataFim ? format(dataFim, "dd/MM/yyyy") : "Data fim"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dataFim} onSelect={setDataFim} locale={ptBR} className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
        {(dataInicio || dataFim) && (
          <Button variant="ghost" size="sm" className="h-10 text-xs" onClick={() => { setDataInicio(undefined); setDataFim(undefined); }}>
            Limpar datas
          </Button>
        )}
        <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Tipo de ato" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {Object.entries(tipoConfig).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={ufFiltro} onValueChange={setUfFiltro}>
          <SelectTrigger className="w-[100px]"><SelectValue placeholder="UF" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas</SelectItem>
            {UFS_DISPONIVEIS.map(uf => (
              <SelectItem key={uf} value={uf}>{uf}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={fonteFiltro} onValueChange={setFonteFiltro}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Fonte" /></SelectTrigger>
          <SelectContent>
            {FONTES_DIARIOS.map(f => (
              <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Link direto ao portal selecionado */}
      {fonteFiltro !== 'todos' && fonteAtual?.url && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/5 border border-accent/20 text-xs">
          <Globe className="w-3.5 h-3.5 text-accent shrink-0" />
          <span className="text-muted-foreground">Filtrando por:</span>
          <span className="font-medium">{fonteAtual.label}</span>
          <span className="text-muted-foreground">—</span>
          <a
            href={fonteAtual.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline flex items-center gap-1"
          >
            Acessar portal <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {loading ? 'Carregando...' : `${atosFiltrados.length} atos encontrados`}
      </p>

      {/* Lista de atos */}
      <div className="space-y-2">
        {atosFiltrados.map(ato => {
          const cfg = tipoConfig[ato.tipo || ''] || { label: ato.tipo || 'Outro', icon: FileText, color: 'bg-muted text-muted-foreground border-border' };
          const Icon = cfg.icon;
          return (
            <div
              key={ato.id}
              className={cn(
                "bg-card rounded-xl border border-border/50 p-4 shadow-sm hover:shadow-md transition-shadow",
                !ato.lido && "border-l-2 border-l-accent"
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", cfg.color)}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <Badge variant="outline" className={cn(cfg.color, "text-[10px]")}>
                        {cfg.label}
                      </Badge>
                      {ato.portal && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Globe className="w-3 h-3" /> {ato.portal}
                        </span>
                      )}
                      {ato.relevancia_score && ato.relevancia_score >= 80 && (
                        <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-[10px]">
                          Alta relevância
                        </Badge>
                      )}
                      {!ato.lido && (
                        <Badge variant="outline" className="bg-accent/10 text-accent border-accent/20 text-[10px]">
                          Novo
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium leading-snug">{ato.titulo}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3" /> {ato.orgao}
                      </span>
                      {ato.municipio && ato.uf && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {ato.municipio}/{ato.uf}
                        </span>
                      )}
                      {ato.data_publicacao && (
                        <span>{new Date(ato.data_publicacao).toLocaleDateString('pt-BR')}</span>
                      )}
                      {ato.valor_estimado && (
                        <span className="font-medium text-foreground">{formatCurrency(ato.valor_estimado)}</span>
                      )}
                    </div>
                    {ato.palavras_chave && ato.palavras_chave.length > 0 && (
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {ato.palavras_chave.slice(0, 4).map((kw, i) => (
                          <span key={i} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{kw}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {!ato.lido && (
                    <Button size="sm" variant="ghost" className="h-7 px-2" title="Marcar como lido" onClick={() => marcarComoLido(ato.id)}>
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  {ato.url && (
                    <Button size="sm" variant="outline" className="h-7 px-2 gap-1" asChild>
                      <a href={ato.url} target="_blank" rel="noopener noreferrer" title="Ver no portal">
                        <Globe className="w-3.5 h-3.5" />
                        <span className="text-[10px] hidden sm:inline">Portal</span>
                      </a>
                    </Button>
                  )}
                  {ato.url && (
                    <Button size="sm" variant="outline" className="h-7 px-2 gap-1" asChild>
                      <a href={ato.url} target="_blank" rel="noopener noreferrer" title="Baixar edital" download>
                        <Download className="w-3.5 h-3.5" />
                        <span className="text-[10px] hidden sm:inline">Baixar</span>
                      </a>
                    </Button>
                  )}
                  {!ato.url && (
                    <span className="text-[10px] text-muted-foreground italic">Sem link</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {!loading && atosFiltrados.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Newspaper className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Nenhum ato encontrado nos diários oficiais.</p>
            <p className="text-xs mt-1">Clique em "Buscar Diários Oficiais" ou use a pesquisa avançada com IA para iniciar.</p>
            <div className="flex justify-center gap-2 mt-4">
              <Button size="sm" variant="outline" onClick={() => setMostrarPortais(true)}>
                <Globe className="w-3.5 h-3.5 mr-1" /> Ver portais disponíveis
              </Button>
              <Button size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground" onClick={handleBuscar} disabled={buscando}>
                <Search className="w-3.5 h-3.5 mr-1" /> Buscar agora
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
