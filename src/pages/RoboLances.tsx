import { useState, useMemo } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Bot, Plus, Play, Pause, Settings, Globe, Clock, TrendingDown,
  AlertTriangle, CheckCircle2, ExternalLink, RefreshCw, Trash2, Edit2,
  Eye, ChevronDown, Search, MessageSquare, ListChecks, Info,
  Building2, Hash, CalendarDays, FileText, Shield, MoreVertical,
  Zap, Target, ArrowDown, Send,
} from 'lucide-react';
import CredenciaisPortalForm from '@/components/robo-lances/CredenciaisPortalForm';
import ConfigurarLanceDialog, { type LanceConfig } from '@/components/robo-lances/ConfigurarLanceDialog';
import AgenteExternoConfig from '@/components/robo-lances/AgenteExternoConfig';
import AgenteTemplateDownload from '@/components/robo-lances/AgenteTemplateDownload';
import { toast } from 'sonner';

/* ── mock items for each dispute ── */
type DisputeItem = {
  numero: number;
  descricao: string;
  situacao: 'disputando' | 'encerrado' | 'aguardando';
  melhorLance: number | null;
  seuUltimoLance: number | null;
  disputando: boolean;
};

type ChatMessage = {
  id: string;
  timestamp: Date;
  autor: string;
  texto: string;
  tipo: 'sistema' | 'pregoeiro' | 'empresa';
};

type Operation = {
  id: string;
  timestamp: Date;
  acao: string;
  resultado: 'sucesso' | 'erro' | 'info';
  detalhes: string;
};

const generateMockItems = (lance: LanceConfig): DisputeItem[] => {
  const count = 3 + Math.floor(Math.random() * 5);
  const descs = [
    'Película Protetora Tela', 'Curativo / Cobertura', 'Curativo / Cobertura Antimicrobiano',
    'Material de Escritório', 'Toner para Impressora', 'Luva Procedimento',
    'Álcool em Gel 70%', 'Papel A4 Resma 500fls',
  ];
  return Array.from({ length: count }, (_, i) => ({
    numero: i + 1,
    descricao: descs[i % descs.length],
    situacao: i === 0 ? 'disputando' : i < count - 1 ? 'aguardando' : 'encerrado',
    melhorLance: lance.valorReferencia * (0.7 + Math.random() * 0.25),
    seuUltimoLance: i < 2 ? lance.valorInicial * (0.85 + Math.random() * 0.1) : null,
    disputando: i < 2,
  }));
};

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const statusColors: Record<string, string> = {
  vencendo: 'bg-success/15 text-success border-success/30',
  ativo: 'bg-info/15 text-info border-info/30',
  perdendo: 'bg-warning/15 text-warning border-warning/30',
  aguardando: 'bg-muted text-muted-foreground border-border',
  encerrado: 'bg-secondary text-secondary-foreground border-border',
};

export default function RoboLances() {
  const [lances, setLances] = useState<LanceConfig[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [bottomTab, setBottomTab] = useState<'chat' | 'operacoes'>('chat');
  const [chatInput, setChatInput] = useState('');
  const [activeMainTab, setActiveMainTab] = useState('disputar');

  // Configurações globais persistidas em localStorage
  const [configDecremento, setConfigDecremento] = useState(() => localStorage.getItem('robo_config_decremento') || '1.5');
  const [configLanceMin, setConfigLanceMin] = useState(() => localStorage.getItem('robo_config_lance_min') || '85');
  const [configIntervalo, setConfigIntervalo] = useState(() => localStorage.getItem('robo_config_intervalo') || '30');
  const [configMaxLances, setConfigMaxLances] = useState(() => localStorage.getItem('robo_config_max_lances') || '20');

  const handleSaveConfig = () => {
    localStorage.setItem('robo_config_decremento', configDecremento);
    localStorage.setItem('robo_config_lance_min', configLanceMin);
    localStorage.setItem('robo_config_intervalo', configIntervalo);
    localStorage.setItem('robo_config_max_lances', configMaxLances);
    toast.success('Regras salvas com sucesso!');
  };

  const selectedLance = useMemo(
    () => lances.find((l) => l.id === selectedId) ?? null,
    [lances, selectedId]
  );

  const mockItems = useMemo(
    () => (selectedLance ? generateMockItems(selectedLance) : []),
    [selectedLance?.id]
  );

  const mockChat: ChatMessage[] = selectedLance
    ? [
        { id: '1', timestamp: new Date(), autor: 'Sistema', texto: `Disputa ${selectedLance.edital} iniciada. Acompanhando itens em tempo real.`, tipo: 'sistema' },
        { id: '2', timestamp: new Date(), autor: 'Pregoeiro', texto: 'Senhores licitantes, a fase de lances está aberta.', tipo: 'pregoeiro' },
      ]
    : [];

  const mockOps: Operation[] = selectedLance
    ? [
        { id: '1', timestamp: new Date(), acao: 'Login no portal', resultado: 'sucesso', detalhes: `Autenticado em ${selectedLance.portal}` },
        { id: '2', timestamp: new Date(), acao: 'Carregamento de itens', resultado: 'sucesso', detalhes: `${mockItems.length} itens carregados` },
      ]
    : [];

  /* ── handlers ── */
  const handleSaveLance = (lance: LanceConfig) => {
    setLances((prev) => {
      const exists = prev.find((l) => l.id === lance.id);
      if (exists) {
        toast.success('Disputa atualizada!');
        return prev.map((l) => (l.id === lance.id ? lance : l));
      }
      toast.success('Nova disputa adicionada!');
      return [...prev, lance];
    });
    setSelectedId(lance.id);
  };

  const handleDelete = (id: string) => {
    setLances((prev) => prev.filter((l) => l.id !== id));
    if (selectedId === id) setSelectedId(null);
    toast.info('Disputa removida.');
  };

  const handleToggleStatus = (id: string) => {
    setLances((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        if (l.status === 'aguardando') return { ...l, status: 'ativo' as const };
        if (l.status === 'ativo' || l.status === 'vencendo' || l.status === 'perdendo')
          return { ...l, status: 'aguardando' as const };
        return l;
      })
    );
  };

  const filteredLances = lances.filter(
    (l) =>
      l.edital.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.portal.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AppLayout>
      <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="h-full flex flex-col">
        {/* ── Top Header ── */}
        <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2">
          <div className="flex items-center gap-3">
            <Bot className="w-5 h-5 text-accent" />
            <h1 className="text-lg font-bold tracking-tight">Robô de Lances</h1>
          </div>
          <TabsList className="bg-muted/50">
            <TabsTrigger value="disputar" className="text-xs">
              <Zap className="w-3.5 h-3.5 mr-1" /> Disputar
            </TabsTrigger>
            <TabsTrigger value="portais" className="text-xs">
              <Globe className="w-3.5 h-3.5 mr-1" /> Portais
            </TabsTrigger>
            <TabsTrigger value="agente" className="text-xs">
              <Shield className="w-3.5 h-3.5 mr-1" /> Agente Externo
            </TabsTrigger>
            <TabsTrigger value="configuracoes" className="text-xs">
              <Settings className="w-3.5 h-3.5 mr-1" /> Configurações
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── DISPUTAR TAB ── */}
        <TabsContent value="disputar" className="flex-1 m-0 flex overflow-hidden">
          {/* LEFT SIDEBAR – Disputes List */}
          <div className="w-72 border-r border-border bg-card flex flex-col shrink-0">
            <div className="p-3 border-b border-border space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Disputas adicionadas</h3>
              <ConfigurarLanceDialog
                onSave={handleSaveLance}
                trigger={
                  <Button size="sm" variant="outline" className="w-full justify-start gap-2 text-xs">
                    <Plus className="w-3.5 h-3.5" /> Nova disputa
                  </Button>
                }
              />
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-1.5 space-y-1">
                {filteredLances.length === 0 && (
                  <div className="text-center py-8 px-3">
                    <Bot className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-[11px] text-muted-foreground">Nenhuma disputa adicionada.</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Clique em "Nova disputa" para começar.</p>
                  </div>
                )}
                {filteredLances.map((lance) => (
                  <button
                    key={lance.id}
                    onClick={() => setSelectedId(lance.id)}
                    className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors text-xs group ${
                      selectedId === lance.id
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-muted/80 text-foreground'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold truncate">{lance.edital}</span>
                      <Badge
                        variant="outline"
                        className={`text-[9px] scale-90 ${
                          selectedId === lance.id
                            ? 'border-accent-foreground/30 text-accent-foreground'
                            : statusColors[lance.status]
                        }`}
                      >
                        {lance.status === 'ativo' && <span className="w-1.5 h-1.5 rounded-full bg-current mr-1 animate-pulse" />}
                        {lance.status.charAt(0).toUpperCase() + lance.status.slice(1)}
                      </Badge>
                    </div>
                    <p className={`text-[10px] mt-0.5 truncate ${
                      selectedId === lance.id ? 'text-accent-foreground/70' : 'text-muted-foreground'
                    }`}>
                      {lance.portal}
                    </p>
                    {lance.horario && (
                      <div className={`flex items-center gap-1 text-[10px] mt-1 ${
                        selectedId === lance.id ? 'text-accent-foreground/70' : 'text-muted-foreground'
                      }`}>
                        <CalendarDays className="w-3 h-3" />
                        Sessão: {lance.horario}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* MAIN CONTENT */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {!selectedLance ? (
              /* empty state */
              <div className="flex-1 flex items-center justify-center bg-muted/20">
                <div className="text-center space-y-3">
                  <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto">
                    <Target className="w-8 h-8 text-accent" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">Selecione ou crie uma disputa</h3>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    Adicione uma nova disputa no painel lateral ou selecione uma existente para gerenciar seus lances.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* ── Dispute Header Bar ── */}
                <div className="border-b border-border bg-card px-4 py-2.5 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                    <div>
                      <h2 className="text-sm font-bold flex items-center gap-2">
                        {selectedLance.edital}
                        {selectedLance.horario && (
                          <span className="text-xs font-normal text-muted-foreground">
                            — {selectedLance.horario}
                          </span>
                        )}
                      </h2>
                      <p className="text-[11px] text-muted-foreground">{selectedLance.portal}</p>
                    </div>
                    <Badge variant="outline" className={statusColors[selectedLance.status]}>
                      {selectedLance.status.charAt(0).toUpperCase() + selectedLance.status.slice(1)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="outline" className="text-xs gap-1.5">
                          <Settings className="w-3.5 h-3.5" /> Ações da disputa <ChevronDown className="w-3 h-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setDetailsOpen(true)}>
                          <Info className="w-3.5 h-3.5 mr-2" /> Detalhes da licitação
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleStatus(selectedLance.id)}>
                          {selectedLance.status === 'aguardando' ? (
                            <><Play className="w-3.5 h-3.5 mr-2" /> Iniciar disputa</>
                          ) : (
                            <><Pause className="w-3.5 h-3.5 mr-2" /> Pausar disputa</>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Edit2 className="w-3.5 h-3.5 mr-2" /> Editar parâmetros
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDelete(selectedLance.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-2" /> Remover disputa
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <Input placeholder="Buscar item..." className="h-8 pl-8 text-xs w-44" />
                    </div>
                  </div>
                </div>

                {/* ── Items Table ── */}
                <div className="flex-1 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-10 text-center text-xs">Item</TableHead>
                        <TableHead className="w-10 text-center text-xs" />
                        <TableHead className="text-xs">Situação</TableHead>
                        <TableHead className="text-right text-xs">Melhor Lance</TableHead>
                        <TableHead className="text-right text-xs">Seu Último Lance</TableHead>
                        <TableHead className="text-center text-xs">Disputando</TableHead>
                        <TableHead className="text-xs">Descrição</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mockItems.map((item) => (
                        <TableRow key={item.numero} className="group">
                          <TableCell className="text-center text-xs font-medium">{item.numero}</TableCell>
                          <TableCell className="text-center">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                  <MoreVertical className="w-3.5 h-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start">
                                <DropdownMenuItem><ArrowDown className="w-3 h-3 mr-2" /> Enviar lance</DropdownMenuItem>
                                <DropdownMenuItem><Eye className="w-3 h-3 mr-2" /> Ver histórico</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                item.situacao === 'disputando'
                                  ? 'bg-info/10 text-info border-info/30'
                                  : item.situacao === 'encerrado'
                                  ? 'bg-muted text-muted-foreground border-border'
                                  : 'bg-warning/10 text-warning border-warning/30'
                              }`}
                            >
                              {item.situacao.charAt(0).toUpperCase() + item.situacao.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-xs font-mono">
                            {item.melhorLance ? formatCurrency(item.melhorLance) : '—'}
                          </TableCell>
                          <TableCell className="text-right text-xs font-mono">
                            {item.seuUltimoLance ? formatCurrency(item.seuUltimoLance) : '—'}
                          </TableCell>
                          <TableCell className="text-center">
                            {item.disputando ? (
                              <span className="inline-flex items-center gap-1 text-[10px] text-success font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" /> Sim
                              </span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                            {item.descricao}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* ── Bottom Panel: Chat + Operations ── */}
                <div className="border-t border-border bg-card shrink-0">
                  <div className="flex items-center gap-0 border-b border-border">
                    <button
                      onClick={() => setBottomTab('chat')}
                      className={`px-4 py-2 text-xs font-medium transition-colors flex items-center gap-1.5 border-b-2 ${
                        bottomTab === 'chat'
                          ? 'border-accent text-accent'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <MessageSquare className="w-3.5 h-3.5" /> Mensagens do chat
                    </button>
                    <button
                      onClick={() => setBottomTab('operacoes')}
                      className={`px-4 py-2 text-xs font-medium transition-colors flex items-center gap-1.5 border-b-2 ${
                        bottomTab === 'operacoes'
                          ? 'border-accent text-accent'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <ListChecks className="w-3.5 h-3.5" /> Operações realizadas
                    </button>
                  </div>

                  <div className="h-36 overflow-auto">
                    {bottomTab === 'chat' ? (
                      <div className="p-3 space-y-2">
                        {mockChat.map((msg) => (
                          <div key={msg.id} className="flex gap-2 text-xs">
                            <span className="text-muted-foreground shrink-0">
                              {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className={`font-semibold shrink-0 ${
                              msg.tipo === 'pregoeiro' ? 'text-warning' : msg.tipo === 'sistema' ? 'text-info' : 'text-foreground'
                            }`}>
                              [{msg.autor}]
                            </span>
                            <span className="text-foreground">{msg.texto}</span>
                          </div>
                        ))}
                        {mockChat.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-4">
                            As mensagens do chat do pregoeiro aparecerão aqui em tempo real.
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="p-3 space-y-2">
                        {mockOps.map((op) => (
                          <div key={op.id} className="flex items-center gap-3 text-xs">
                            <span className="text-muted-foreground shrink-0">
                              {op.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-[9px] ${
                                op.resultado === 'sucesso' ? 'bg-success/10 text-success border-success/30' :
                                op.resultado === 'erro' ? 'bg-destructive/10 text-destructive border-destructive/30' :
                                'bg-info/10 text-info border-info/30'
                              }`}
                            >
                              {op.resultado}
                            </Badge>
                            <span className="font-medium text-foreground">{op.acao}</span>
                            <span className="text-muted-foreground">{op.detalhes}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Chat input */}
                  {bottomTab === 'chat' && (
                    <div className="border-t border-border px-3 py-2 flex gap-2">
                      <Input
                        placeholder="Enviar mensagem ao pregoeiro..."
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        className="h-8 text-xs flex-1"
                      />
                      <Button size="sm" className="h-8 bg-accent hover:bg-accent/90 text-accent-foreground">
                        <Send className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </TabsContent>

        {/* ── PORTAIS TAB ── */}
        <TabsContent value="portais" className="flex-1 m-0 overflow-auto p-6 space-y-6">
          <CredenciaisPortalForm />
        </TabsContent>

        {/* ── AGENTE EXTERNO TAB ── */}
        <TabsContent value="agente" className="flex-1 m-0 overflow-auto p-6 space-y-6">
          <AgenteExternoConfig />
          <AgenteTemplateDownload />
        </TabsContent>

        {/* ── CONFIGURAÇÕES TAB ── */}
        <TabsContent value="configuracoes" className="flex-1 m-0 overflow-auto p-6 space-y-6">
          <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm space-y-4 max-w-2xl">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Settings className="w-4 h-4 text-accent" /> Regras de Lance Automático (Padrão Global)
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground">Decremento padrão (%)</label>
                <Input value={configDecremento} onChange={(e) => setConfigDecremento(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Lance mínimo (% do estimado)</label>
                <Input value={configLanceMin} onChange={(e) => setConfigLanceMin(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Intervalo entre lances (seg)</label>
                <Input value={configIntervalo} onChange={(e) => setConfigIntervalo(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Máx. lances por sessão</label>
                <Input value={configMaxLances} onChange={(e) => setConfigMaxLances(e.target.value)} className="mt-1" />
              </div>
            </div>
            <Button onClick={handleSaveConfig} className="bg-accent hover:bg-accent/90 text-accent-foreground">
              Salvar Regras
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Details Modal (Effecti-style) ── */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg">Detalhes da licitação</DialogTitle>
          </DialogHeader>
          {selectedLance && (
            <div className="space-y-4 py-2">
              {[
                { icon: Building2, label: 'Portal', value: selectedLance.portal },
                { icon: Hash, label: 'Licitação', value: selectedLance.edital },
                { icon: CalendarDays, label: 'Horário da Sessão', value: selectedLance.horario || 'Não definido' },
                { icon: TrendingDown, label: 'Valor de Referência', value: formatCurrency(selectedLance.valorReferencia) },
                { icon: Target, label: 'Valor Inicial (1º Lance)', value: formatCurrency(selectedLance.valorInicial) },
                { icon: AlertTriangle, label: 'Valor Mínimo (Piso)', value: formatCurrency(selectedLance.valorMinimo) },
                { icon: ArrowDown, label: 'Decremento Mínimo', value: formatCurrency(selectedLance.decrementoMin) },
                { icon: ArrowDown, label: 'Decremento Percentual', value: `${selectedLance.decrementoPercentual}%` },
                { icon: Clock, label: 'Intervalo entre lances', value: `${selectedLance.intervaloSegundos}s` },
                { icon: ListChecks, label: 'Máx. Lances', value: String(selectedLance.maxLances) },
                { icon: Bot, label: 'Modo', value: selectedLance.modoAutomatico ? 'Automático' : 'Manual' },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-3">
                  <item.icon className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">{item.label}</p>
                    <p className="text-sm text-muted-foreground">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
