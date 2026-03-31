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
  Zap, Target, ArrowDown, Send, Trophy, XCircle, History, ShieldCheck,
} from 'lucide-react';
import CredenciaisPortalForm from '@/components/robo-lances/CredenciaisPortalForm';
import ConfigurarLanceDialog, { type LanceConfig, type DisputeItem } from '@/components/robo-lances/ConfigurarLanceDialog';
import AgenteExternoConfig from '@/components/robo-lances/AgenteExternoConfig';
import AgenteTemplateDownload from '@/components/robo-lances/AgenteTemplateDownload';
import LicitacaoChat from '@/components/licitacoes/LicitacaoChat';
import SimulacaoDisputa from '@/components/robo-lances/SimulacaoDisputa';
import DisputasResumo from '@/components/robo-lances/DisputasResumo';
import ExportarResultados from '@/components/robo-lances/ExportarResultados';
import NivelAutomacaoSelector, { type NivelAutomacao } from '@/components/robo-lances/NivelAutomacaoSelector';
import AceiteTermosDialog from '@/components/robo-lances/AceiteTermosDialog';
import PainelRisco from '@/components/robo-lances/PainelRisco';
import KillSwitchButton from '@/components/robo-lances/KillSwitchButton';
import AuditTrailViewer from '@/components/robo-lances/AuditTrailViewer';
import AutorizacaoLanceDialog from '@/components/robo-lances/AutorizacaoLanceDialog';
import DisputaRealtimePanel from '@/components/robo-lances/DisputaRealtimePanel';
import PortalHealthcheck from '@/components/robo-lances/PortalHealthcheck';
import EstrategiaIAPanel from '@/components/robo-lances/EstrategiaIAPanel';
import AtivacaoChecklist from '@/components/robo-lances/AtivacaoChecklist';
import { useAuditLog } from '@/hooks/useAuditLog';
import { toast } from 'sonner';
import { useLicitacaoIntegration } from '@/hooks/useLicitacaoIntegration';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type Operation = {
  id: string;
  timestamp: Date;
  acao: string;
  resultado: 'sucesso' | 'erro' | 'info';
  detalhes: string;
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
  const { user } = useAuth();
  const { registrarResultadoDisputa } = useLicitacaoIntegration();
  const { registrar } = useAuditLog();
  const [lances, setLances] = useState<LanceConfig[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [bottomTab, setBottomTab] = useState<'mural' | 'operacoes' | 'simulacao' | 'auditoria'>('mural');
  const [activeMainTab, setActiveMainTab] = useState('disputar');

  // ── Governance: 3 Levels ──
  const [nivelAutomacao, setNivelAutomacao] = useState<NivelAutomacao>(() => {
    const saved = localStorage.getItem('robo_nivel_automacao');
    return (saved ? parseInt(saved) : 1) as NivelAutomacao;
  });
  const [aceiteTermosOpen, setAceiteTermosOpen] = useState(false);
  const [aceiteId, setAceiteId] = useState<string | null>(null);
  const [limiteFinanceiro, setLimiteFinanceiro] = useState(0);
  const [autorizacaoOpen, setAutorizacaoOpen] = useState(false);
  const [estrategiaAutorizada, setEstrategiaAutorizada] = useState(false);
  const [paradaEmergencial, setParadaEmergencial] = useState(false);

  const handleNivelChange = (novoNivel: NivelAutomacao) => {
    if (novoNivel > 1) {
      // Require aceite for levels 2 and 3
      setNivelAutomacao(novoNivel);
      localStorage.setItem('robo_nivel_automacao', String(novoNivel));
      setAceiteTermosOpen(true);
      setEstrategiaAutorizada(false);
      registrar('nivel_alterado', { de: nivelAutomacao, para: novoNivel }, { nivelAutomacao: novoNivel });
    } else {
      setNivelAutomacao(1);
      localStorage.setItem('robo_nivel_automacao', '1');
      setAceiteId(null);
      setEstrategiaAutorizada(false);
      registrar('nivel_alterado', { de: nivelAutomacao, para: 1 }, { nivelAutomacao: 1 });
    }
  };

  const handleAceite = (id: string) => {
    setAceiteId(id);
    toast.success(`Nível ${nivelAutomacao} ativado com sucesso!`);
  };

  const handleParadaEmergencial = () => {
    setParadaEmergencial(true);
    // Stop all active disputes
    setLances(prev => prev.map(l =>
      l.status === 'ativo' || l.status === 'vencendo' || l.status === 'perdendo'
        ? { ...l, status: 'encerrado' as const }
        : l
    ));
  };

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

  const disputeItems = useMemo(
    () => selectedLance?.itens ?? [],
    [selectedLance?.id, selectedLance?.itens]
  );

  const [operations, setOperations] = useState<Operation[]>([]);

  /* ── Post dispute result to mural ── */
  const postResultToMural = async (lance: LanceConfig, resultado: 'venceu' | 'perdeu', valorFinal?: number) => {
    if (!user || !lance.licitacaoId) return;

    const itensResumo = lance.itens.slice(0, 5).map(i =>
      `  • Item ${i.numero}: ${i.descricao.slice(0, 50)}${i.descricao.length > 50 ? '...' : ''} — ${formatCurrency(i.valorReferencia)} × ${i.quantidade}`
    ).join('\n');
    const maisItens = lance.itens.length > 5 ? `\n  ...e mais ${lance.itens.length - 5} itens` : '';

    const conteudo = resultado === 'venceu'
      ? `🏆 **DISPUTA VENCIDA — ${lance.edital}**\n\n` +
        `📋 Portal: ${lance.portal}\n` +
        `💰 Valor de Referência: ${formatCurrency(lance.valorReferencia)}\n` +
        `✅ Valor Final Adjudicado: ${valorFinal ? formatCurrency(valorFinal) : 'N/I'}\n` +
        `📊 Desconto: ${lance.valorReferencia > 0 && valorFinal ? ((1 - valorFinal / lance.valorReferencia) * 100).toFixed(2) + '%' : 'N/I'}\n\n` +
        `**Itens da disputa (${lance.itens.length}):**\n${itensResumo}${maisItens}\n\n` +
        `⏱️ Encerrado em ${new Date().toLocaleString('pt-BR')}`
      : `❌ **DISPUTA PERDIDA — ${lance.edital}**\n\n` +
        `📋 Portal: ${lance.portal}\n` +
        `💰 Valor de Referência: ${formatCurrency(lance.valorReferencia)}\n` +
        `📊 ${lance.itens.length} itens disputados\n\n` +
        `**Itens:**\n${itensResumo}${maisItens}\n\n` +
        `⏱️ Encerrado em ${new Date().toLocaleString('pt-BR')}`;

    try {
      await supabase.from('licitacao_mensagens').insert({
        licitacao_id: lance.licitacaoId,
        user_id: user.id,
        conteudo,
        tipo: resultado === 'venceu' ? 'sucesso' : 'alerta',
      });
    } catch (err) {
      console.error('Erro ao postar no mural:', err);
    }
  };

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

  const handleEndDispute = async (resultado: 'venceu' | 'perdeu') => {
    if (!selectedLance) return;

    const valorFinal = resultado === 'venceu'
      ? selectedLance.meuLance || selectedLance.valorMinimo
      : undefined;

    // Update local state
    setLances(prev => prev.map(l =>
      l.id === selectedLance.id ? { ...l, status: 'encerrado' as const } : l
    ));

    // Post to mural
    await postResultToMural(selectedLance, resultado, valorFinal);

    // Update licitação status if linked
    if (selectedLance.licitacaoId) {
      await registrarResultadoDisputa(selectedLance.licitacaoId, resultado, valorFinal);
    }

    // Switch to mural tab to show the result
    setBottomTab('mural');
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
          <div className="flex items-center gap-2">
            <ExportarResultados lances={lances} />
          </div>
          <TabsList className="bg-muted/50">
            <TabsTrigger value="disputar" className="text-xs">
              <Zap className="w-3.5 h-3.5 mr-1" /> Disputar
            </TabsTrigger>
            <TabsTrigger value="portais" className="text-xs">
              <Globe className="w-3.5 h-3.5 mr-1" /> Portais
            </TabsTrigger>
            <TabsTrigger value="agente" className="text-xs">
              <Shield className="w-3.5 h-3.5 mr-1" /> Agente Cloud
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
                    {lance.licitacaoId && (
                      <div className={`flex items-center gap-1 text-[10px] mt-0.5 ${
                        selectedId === lance.id ? 'text-accent-foreground/70' : 'text-muted-foreground'
                      }`}>
                        <MessageSquare className="w-3 h-3" />
                        Vinculado ao Kanban
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* MAIN CONTENT */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Simultaneous disputes summary bar */}
            <DisputasResumo lances={lances} onSelect={setSelectedId} selectedId={selectedId} />

            {!selectedLance ? (
              /* empty state with level selector */
              <div className="flex-1 flex flex-col items-center justify-center bg-muted/20 gap-6 p-6">
                <div className="text-center space-y-3">
                  <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto">
                    <Target className="w-8 h-8 text-accent" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">Selecione ou crie uma disputa</h3>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    Adicione uma nova disputa no painel lateral ou selecione uma existente para gerenciar seus lances.
                  </p>
                </div>
                {/* Level selector in empty state */}
                <div className="w-full max-w-3xl">
                  <NivelAutomacaoSelector nivel={nivelAutomacao} onChange={handleNivelChange} />
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
                    <Badge variant="outline" className={`text-[9px] ${
                      nivelAutomacao === 1 ? 'bg-info/15 text-info border-info/30' :
                      nivelAutomacao === 2 ? 'bg-warning/15 text-warning border-warning/30' :
                      'bg-destructive/15 text-destructive border-destructive/30'
                    }`}>
                      N{nivelAutomacao} — {nivelAutomacao === 1 ? 'Assistente' : nivelAutomacao === 2 ? 'Semi' : 'Auto'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Kill Switch - visible for levels 2 and 3 */}
                    {nivelAutomacao >= 2 && selectedLance.status !== 'encerrado' && (
                      <KillSwitchButton
                        sessaoId={undefined}
                        licitacaoId={selectedLance.licitacaoId}
                        onParada={handleParadaEmergencial}
                        disabled={paradaEmergencial}
                      />
                    )}

                    {/* Level 2: Authorize strategy button */}
                    {nivelAutomacao === 2 && !estrategiaAutorizada && selectedLance.status === 'aguardando' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs gap-1.5 border-warning/40 text-warning hover:bg-warning/10"
                        onClick={() => setAutorizacaoOpen(true)}
                      >
                        <ShieldCheck className="w-3.5 h-3.5" /> Autorizar Estratégia
                      </Button>
                    )}
                    {estrategiaAutorizada && (
                      <Badge variant="outline" className="bg-success/15 text-success border-success/30 text-[9px]">
                        ✓ Estratégia Autorizada
                      </Badge>
                    )}

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="outline" className="text-xs gap-1.5">
                          <Settings className="w-3.5 h-3.5" /> Ações <ChevronDown className="w-3 h-3" />
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
                          className="text-success focus:text-success"
                          onClick={() => handleEndDispute('venceu')}
                        >
                          <Trophy className="w-3.5 h-3.5 mr-2" /> Encerrar como Venceu
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleEndDispute('perdeu')}
                        >
                          <XCircle className="w-3.5 h-3.5 mr-2" /> Encerrar como Perdeu
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
                  {disputeItems.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center py-16">
                      <div className="text-center space-y-2">
                        <ListChecks className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                        <p className="text-xs text-muted-foreground">Nenhum item cadastrado nesta disputa.</p>
                        <p className="text-[10px] text-muted-foreground">Edite a disputa para adicionar itens e lotes.</p>
                      </div>
                    </div>
                  ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-10 text-center text-xs">Item</TableHead>
                        <TableHead className="w-10 text-center text-xs" />
                        <TableHead className="text-xs">Situação</TableHead>
                        <TableHead className="text-right text-xs">Vlr Ref.</TableHead>
                        <TableHead className="text-right text-xs">Melhor Lance</TableHead>
                        <TableHead className="text-right text-xs">Seu Último Lance</TableHead>
                        <TableHead className="text-center text-xs">Qtd</TableHead>
                        <TableHead className="text-center text-xs">Disputando</TableHead>
                        <TableHead className="text-xs">Descrição</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {disputeItems.map((item) => (
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
                          <TableCell className="text-right text-xs font-mono text-muted-foreground">
                            {item.valorReferencia > 0 ? formatCurrency(item.valorReferencia) : '—'}
                          </TableCell>
                          <TableCell className="text-right text-xs font-mono">
                            {item.melhorLance ? formatCurrency(item.melhorLance) : '—'}
                          </TableCell>
                          <TableCell className="text-right text-xs font-mono">
                            {item.seuUltimoLance ? formatCurrency(item.seuUltimoLance) : '—'}
                          </TableCell>
                          <TableCell className="text-center text-xs">
                            {item.quantidade} {item.unidade}
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
                  )}
                </div>

                {/* ── Painel de Risco (Level 1+) ── */}
                <div className="px-4 py-2 border-t border-border overflow-auto max-h-52 shrink-0">
                  <PainelRisco lance={selectedLance} nivel={nivelAutomacao} />
                </div>

                {/* ── Bottom Panel: Mural + Operations + Audit ── */}
                <div className="border-t border-border bg-card shrink-0">
                  <div className="flex items-center gap-0 border-b border-border">
                     <button
                      onClick={() => setBottomTab('mural')}
                      className={`px-4 py-2 text-xs font-medium transition-colors flex items-center gap-1.5 border-b-2 ${
                        bottomTab === 'mural'
                          ? 'border-accent text-accent'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <MessageSquare className="w-3.5 h-3.5" /> Mural
                    </button>
                    <button
                      onClick={() => setBottomTab('simulacao')}
                      className={`px-4 py-2 text-xs font-medium transition-colors flex items-center gap-1.5 border-b-2 ${
                        bottomTab === 'simulacao'
                          ? 'border-accent text-accent'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Zap className="w-3.5 h-3.5" /> Simulação
                    </button>
                    <button
                      onClick={() => setBottomTab('operacoes')}
                      className={`px-4 py-2 text-xs font-medium transition-colors flex items-center gap-1.5 border-b-2 ${
                        bottomTab === 'operacoes'
                          ? 'border-accent text-accent'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <ListChecks className="w-3.5 h-3.5" /> Operações
                    </button>
                    <button
                      onClick={() => setBottomTab('auditoria')}
                      className={`px-4 py-2 text-xs font-medium transition-colors flex items-center gap-1.5 border-b-2 ${
                        bottomTab === 'auditoria'
                          ? 'border-accent text-accent'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <History className="w-3.5 h-3.5" /> Auditoria
                    </button>
                  </div>

                  <div className="h-56">
                    {bottomTab === 'mural' ? (
                      selectedLance?.licitacaoId ? (
                        <LicitacaoChat
                          licitacaoId={selectedLance.licitacaoId}
                          licitacaoNumero={selectedLance.edital}
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center space-y-2">
                            <MessageSquare className="w-6 h-6 text-muted-foreground/30 mx-auto" />
                            <p className="text-xs text-muted-foreground">
                              Esta disputa não está vinculada a um processo do Kanban.
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              Importe do Kanban ao criar a disputa para ativar o Mural em tempo real.
                            </p>
                          </div>
                        </div>
                      )
                    ) : bottomTab === 'simulacao' ? (
                      <div className="p-3 overflow-auto h-full">
                        <SimulacaoDisputa
                          lance={selectedLance}
                          onUpdate={(updated) => {
                            setLances(prev => prev.map(l => l.id === updated.id ? updated : l));
                          }}
                          licitacaoId={selectedLance.licitacaoId}
                        />
                      </div>
                    ) : bottomTab === 'auditoria' ? (
                      <div className="p-3 overflow-auto h-full">
                        <AuditTrailViewer sessaoId={undefined} />
                      </div>
                    ) : (
                      <div className="p-3 space-y-2 overflow-auto h-full">
                        {operations.length === 0 ? (
                          <div className="text-center py-8">
                            <ListChecks className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                            <p className="text-xs text-muted-foreground">Nenhuma operação registrada.</p>
                            <p className="text-[10px] text-muted-foreground mt-1">Inicie uma disputa para ver o log de operações.</p>
                          </div>
                        ) : (
                          operations.map((op) => (
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
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </TabsContent>

        {/* ── PORTAIS TAB ── */}
        <TabsContent value="portais" className="flex-1 m-0 overflow-auto p-6 space-y-6">
          <CredenciaisPortalForm />
          <PortalHealthcheck />
        </TabsContent>

        {/* ── AGENTE EXTERNO TAB ── */}
        <TabsContent value="agente" className="flex-1 m-0 overflow-auto p-6 space-y-6">
          <AtivacaoChecklist />
          <AgenteExternoConfig />
          <AgenteTemplateDownload />
          <PortalHealthcheck />
        </TabsContent>

        {/* ── CONFIGURAÇÕES TAB ── */}
        <TabsContent value="configuracoes" className="flex-1 m-0 overflow-auto p-6 space-y-6">
          <NivelAutomacaoSelector nivel={nivelAutomacao} onChange={handleNivelChange} />
          <EstrategiaIAPanel lance={selectedLance} />
          <DisputaRealtimePanel />

          <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm space-y-4 max-w-2xl">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Settings className="w-4 h-4 text-accent" /> Regras de Lance Automático (Padrão Global)
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground">Decremento padrão (%)</label>
                <Input type="number" step="0.1" value={configDecremento} onChange={(e) => setConfigDecremento(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Lance mínimo (% do estimado)</label>
                <Input type="number" step="1" value={configLanceMin} onChange={(e) => setConfigLanceMin(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Intervalo entre lances (seg)</label>
                <Input type="number" step="1" min="1" value={configIntervalo} onChange={(e) => setConfigIntervalo(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Máx. lances por sessão</label>
                <Input type="number" step="1" min="1" value={configMaxLances} onChange={(e) => setConfigMaxLances(e.target.value)} className="mt-1" />
              </div>
            </div>
            <Button onClick={handleSaveConfig} className="bg-accent hover:bg-accent/90 text-accent-foreground">
              Salvar Regras
            </Button>
          </div>

          {/* Audit trail in config tab too */}
          <AuditTrailViewer />
        </TabsContent>
      </Tabs>

      {/* ── Governance Dialogs ── */}
      <AceiteTermosDialog
        open={aceiteTermosOpen}
        onOpenChange={setAceiteTermosOpen}
        nivel={nivelAutomacao}
        sessaoId={undefined}
        licitacaoId={selectedLance?.licitacaoId}
        onAceite={handleAceite}
      />

      {selectedLance && (
        <AutorizacaoLanceDialog
          open={autorizacaoOpen}
          onOpenChange={setAutorizacaoOpen}
          estrategia={{
            valorInicial: selectedLance.valorInicial,
            valorMinimo: selectedLance.valorMinimo,
            decrementoMin: selectedLance.decrementoMin,
            decrementoPercentual: selectedLance.decrementoPercentual,
            maxLances: selectedLance.maxLances,
            intervaloSegundos: selectedLance.intervaloSegundos,
          }}
          limiteFinanceiro={limiteFinanceiro}
          sessaoId={undefined}
          licitacaoId={selectedLance.licitacaoId}
          edital={selectedLance.edital}
          onAutorizar={() => setEstrategiaAutorizada(true)}
        />
      )}

      {/* ── Details Modal ── */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Detalhes da licitação</DialogTitle>
          </DialogHeader>
          {selectedLance && (
            <div className="divide-y divide-border">
              {[
                { icon: Building2, label: 'Empresa', value: '—' },
                { icon: Hash, label: 'CNPJ', value: '—' },
                { icon: Globe, label: 'Portal', value: selectedLance.portal },
                { icon: Hash, label: 'Licitação', value: selectedLance.edital },
                { icon: Building2, label: 'Órgão', value: '—' },
                { icon: Hash, label: 'UASG', value: '—' },
                { icon: CalendarDays, label: 'Data de abertura', value: selectedLance.horario || 'Não definido' },
                { icon: FileText, label: 'Sistema de Registro de Preços', value: 'Não' },
                { icon: TrendingDown, label: 'Valor de Referência', value: formatCurrency(selectedLance.valorReferencia) },
                { icon: Target, label: 'Valor Inicial (1º Lance)', value: formatCurrency(selectedLance.valorInicial) },
                { icon: AlertTriangle, label: 'Valor Mínimo (Piso)', value: formatCurrency(selectedLance.valorMinimo) },
                { icon: ArrowDown, label: 'Decremento Mínimo', value: formatCurrency(selectedLance.decrementoMin) },
                { icon: ArrowDown, label: 'Decremento Percentual', value: `${selectedLance.decrementoPercentual}%` },
                { icon: Clock, label: 'Intervalo entre lances', value: `${selectedLance.intervaloSegundos}s` },
                { icon: ListChecks, label: 'Máx. Lances', value: String(selectedLance.maxLances) },
                { icon: Bot, label: 'Modo', value: selectedLance.modoAutomatico ? 'Automático' : 'Manual' },
                { icon: Shield, label: 'Nível de Automação', value: `Nível ${nivelAutomacao} — ${nivelAutomacao === 1 ? 'Assistente' : nivelAutomacao === 2 ? 'Semiautomático' : 'Automação Controlada'}` },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-3 py-3 px-1">
                  <item.icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
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
