import { useState, useMemo, useEffect, useCallback } from 'react';
import { usePapelEmpresa } from '@/hooks/usePapelEmpresa';
import ProcessoContextoBanner from '@/components/shared/ProcessoContextoBanner';
import { useProcessoAtivo } from '@/hooks/useProcessoAtivo';
import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { Badge, badgeVariants } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  AlertTriangle, CheckCircle2, RefreshCw, Trash2, Edit2,
  Eye, ChevronDown, Search, MessageSquare, ListChecks, Info,
  Building2, Hash, CalendarDays, FileText, Shield, MoreVertical,
  Zap, Target, ArrowDown, Send, Trophy, XCircle, History, ShieldCheck,
  Monitor,
} from 'lucide-react';
import CredenciaisPortalForm from '@/components/robo-lances/CredenciaisPortalForm';
import ConfigurarLanceDialog, { type LanceConfig, type DisputeItem } from '@/components/robo-lances/ConfigurarLanceDialog';
import AgenteExternoConfig from '@/components/robo-lances/AgenteExternoConfig';
// AgenteTemplateDownload removed — agent is now cloud-managed
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
import VncWebViewer from '@/components/robo-lances/VncWebViewer';
import SessoesDoRobo from '@/components/robo-lances/SessoesDoRobo';
import ConferenciaDosItens from '@/components/robo-lances/ConferenciaDosItens';
import PedidoDoRobo from '@/components/robo-lances/PedidoDoRobo';
import { usePedidosDoRobo } from '@/components/robo-lances/usePedidosDoRobo';
import AcessoManualPortal from '@/components/robo-lances/AcessoManualPortal';
import { idDoPortal, nomeDoPortal, agenteOpera } from '@/lib/robo/portais';
import { useAuditLog } from '@/hooks/useAuditLog';
import { toast } from 'sonner';
import { useLicitacaoIntegration } from '@/hooks/useLicitacaoIntegration';
import { useEmpresa } from '@/contexts/EmpresaContext';
import RegistrarPerdaDialog, { type PerdaAlvo } from '@/components/metas/RegistrarPerdaDialog';
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

/** Variantes semânticas do Badge de ui — status sempre com texto. */
type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'muted';

const statusVariant: Record<string, BadgeVariant> = {
  vencendo: 'success',
  ativo: 'info',
  perdendo: 'warning',
  aguardando: 'muted',
  encerrado: 'muted',
};

const rotuloStatus = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Falha silenciosa também vale para permissão: dizer por que não aparece. */
function SemPermissao() {
  return (
    <div className="mx-auto max-w-xl rounded-lg border border-border bg-card shadow-sm">
      <EstadoVazio
        icone={<Shield />}
        titulo="Área restrita ao administrador"
        descricao="Credenciais de portal, infraestrutura do agente e nível de automação são configurações da empresa. Peça a um administrador em Equipe → Permissões."
        tamanho="compacto"
      />
    </div>
  );
}

export default function RoboLances() {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const { registrarResultadoDisputa, registrarPerda } = useLicitacaoIntegration();
  const { registrar } = useAuditLog();
  const [perdaAlvo, setPerdaAlvo] = useState<PerdaAlvo | null>(null);
  const [salvandoPerda, setSalvandoPerda] = useState(false);
  const [lances, setLances] = useState<LanceConfig[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Clicar na disputa já selecionada desmarca e volta ao estado inicial da
  // tela. Até 10/09/2026 não havia como sair de uma disputa sem trocar de
  // tela — o Ian pediu para "desclicar" apertando de novo no card.
  const alternarSelecao = useCallback(
    (id: string) => setSelectedId((atual) => (atual === id ? null : id)),
    [],
  );
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
  const { isAdmin, podeOperar } = usePapelEmpresa();
  const [paradaEmergencial, setParadaEmergencial] = useState(false);

  // Sem permissão, a aba administrativa não fica selecionada de forma órfã.
  useEffect(() => {
    if (!isAdmin && activeMainTab !== 'disputar') setActiveMainTab('disputar');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);
  // O Robô passa a saber em qual processo se está disputando — antes ele
  // ignorava a pasta de origem e obrigava a reselecionar o edital.
  const { processoId } = useProcessoAtivo();

  /** Converte a linha do banco para a configuração usada na tela. */
  const linhaParaLance = (r: Record<string, unknown>): LanceConfig => ({
    id: String(r.id),
    edital: String(r.edital || ''),
    portal: String(r.portal || ''),
    valorReferencia: Number(r.valor_referencia) || 0,
    valorInicial: Number(r.valor_inicial) || 0,
    valorMinimo: Number(r.valor_minimo) || 0,
    decrementoMin: Number(r.decremento_min) || 0,
    decrementoPercentual: Number(r.decremento_percentual) || 0,
    intervaloSegundos: Number(r.intervalo_segundos) || 30,
    maxLances: Number(r.max_lances) || 20,
    modoAutomatico: !!r.modo_automatico,
    status: (r.status as LanceConfig['status']) || 'aguardando',
    horario: String(r.horario || ''),
    meuLance: Number(r.meu_lance) || 0,
    valorAtual: Number(r.valor_atual) || 0,
    // Piso `0` gravado ANTES desta mudança nunca foi decisão de ninguém: era o
    // valor fixo que todo item importado recebia, e não havia campo na tela
    // para alterá-lo. Lido de volta como zero, ele autorizaria o robô a descer
    // até zero num item que ninguém avaliou.
    //
    // Vira `null` — "ninguém decidiu" — que é o que sempre foi. Um piso zero
    // escolhido de propósito a partir de agora chega pelo campo da tela, e
    // ninguém escolhe descer até R$ 0,00.
    itens: (((r.itens as DisputeItem[]) || []).map((i) => ({
      ...i,
      valorMinimo: i.valorMinimo === 0 ? null : i.valorMinimo ?? null,
    }))) as DisputeItem[],
    tipoDisputa: (r.tipo_disputa as 'item' | 'lote') || 'item',
    licitacaoId: (r.licitacao_id as string) || undefined,
    uasg: (r.uasg as string) || undefined,
  });

  // As disputas passam a viver no banco. Abrindo pelo prontuário, o painel
  // mostra as DESTA pasta; sem processo aberto, as da empresa.
  useEffect(() => {
    if (!user || !empresaAtiva?.id) return;
    let q = supabase
      .from('robo_lances_disputas' as never)
      .select('*')
      .eq('empresa_id', empresaAtiva.id);
    if (processoId) q = q.eq('licitacao_id', processoId);
    q.order('created_at', { ascending: false }).then(({ data, error }) => {
      if (error) {
        // Painel vazio sem explicação é indistinguível de "não há disputa" — e a
        // pessoa conclui que perdeu o trabalho. O erro tem que aparecer na tela.
        console.error('[robo-lances] carregar disputas', error.message);
        toast.error(`Não foi possível carregar as disputas: ${error.message}`, { duration: 12000 });
        return;
      }
      setLances(((data || []) as unknown as Record<string, unknown>[]).map(linhaParaLance));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, empresaAtiva?.id, processoId]);

  const handleNivelChange = async (novoNivel: NivelAutomacao) => {
    if (!isAdmin) {
      toast.error('Só o administrador da empresa altera o nível de automação.');
      return;
    }
    // Freio verificado é PRÉ-REQUISITO dos níveis com envio automático. O
    // próprio sistema exige "botão de parada emergencial" no nível 3 — mas
    // exigia o botão existir na tela, não o freio funcionar do outro lado.
    if (novoNivel > 1) {
      const { data } = await supabase.functions.invoke('robo-lances-webhook/healthcheck', { body: {} });
      const ks = (data as { agentes?: Array<{ kill_switch?: { ok?: boolean; detalhe?: string | null } | null }> } | null)
        ?.agentes?.[0]?.kill_switch;
      if (!ks?.ok) {
        toast.error(
          `Nível ${novoNivel} bloqueado: a parada de emergência ainda não foi verificada no agente` +
          `${ks?.detalhe ? ` (${ks.detalhe})` : ''}. Rode "Testar freio de emergência" no checklist antes de ativar envio automático.`,
          { duration: 15000 },
        );
        return;
      }
    }
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
    // Sem empresa ativa não há onde gravar: `empresa_id` é NOT NULL e a RLS é por
    // membro da empresa. Antes o bloco inteiro era pulado em silêncio e a tela
    // ainda dizia "Nova disputa adicionada!" — a estratégia sumia ao recarregar,
    // que é justamente a queixa da véspera de pregão.
    if (!user || !empresaAtiva?.id) {
      toast.error('Selecione uma empresa ativa antes de salvar a disputa.', { duration: 10000 });
      return;
    }

    const linha = {
      id: lance.id,
      empresa_id: empresaAtiva.id,
      user_id: user.id,
      licitacao_id: lance.licitacaoId ?? processoId ?? null,
      edital: lance.edital,
      portal: lance.portal || null,
      uasg: lance.uasg || null,
      tipo_disputa: lance.tipoDisputa,
      valor_referencia: lance.valorReferencia,
      valor_inicial: lance.valorInicial,
      valor_minimo: lance.valorMinimo,
      decremento_min: lance.decrementoMin,
      decremento_percentual: lance.decrementoPercentual,
      intervalo_segundos: lance.intervaloSegundos,
      max_lances: lance.maxLances,
      modo_automatico: lance.modoAutomatico,
      horario: lance.horario || null,
      status: lance.status,
      meu_lance: lance.meuLance,
      valor_atual: lance.valorAtual,
      itens: lance.itens as never,
    };
    supabase
      .from('robo_lances_disputas' as never)
      .upsert(linha as never, { onConflict: 'id' })
      .then(({ error }) => {
        if (error) toast.error(`Disputa não foi salva: ${error.message}`, { duration: 12000 });
      });

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

  // Apagar precisa alcançar o banco: antes só saía da tela e voltava ao
  // recarregar. O `select()` existe porque a policy de DELETE é de admin da
  // empresa — sem ele, um não-admin veria "removida" e nada teria acontecido.
  const handleDelete = async (id: string) => {
    const { data, error } = await supabase
      .from('robo_lances_disputas' as never)
      .delete()
      .eq('id', id)
      .select('id');

    if (error) {
      toast.error(`Disputa não foi removida: ${error.message}`, { duration: 12000 });
      return;
    }
    if (!(data as unknown as unknown[] | null)?.length) {
      toast.error('Disputa não removida: só um administrador da empresa pode apagar.', { duration: 12000 });
      return;
    }

    setLances((prev) => prev.filter((l) => l.id !== id));
    if (selectedId === id) setSelectedId(null);
    toast.info('Disputa removida.');
  };

  const proximoStatus = (atual: LanceConfig['status']): LanceConfig['status'] | null => {
    if (atual === 'aguardando') return 'ativo';
    if (atual === 'ativo' || atual === 'vencendo' || atual === 'perdendo') return 'aguardando';
    return null;
  };

  // O status também vive no banco. Antes a mudança era só de tela e voltava para
  // "aguardando" ao recarregar — numa disputa marcada como ativa, isso engana.
  const handleToggleStatus = async (id: string) => {
    const atual = lances.find((l) => l.id === id);
    if (!atual) return;
    const novo = proximoStatus(atual.status);
    if (!novo) return;

    setLances((prev) => prev.map((l) => (l.id === id ? { ...l, status: novo } : l)));

    const { error } = await supabase
      .from('robo_lances_disputas' as never)
      .update({ status: novo } as never)
      .eq('id', id);

    if (error) {
      // Desfaz na tela: mostrar um estado que o banco não tem é pior que não mudar.
      setLances((prev) => prev.map((l) => (l.id === id ? { ...l, status: atual.status } : l)));
      toast.error(`Status não foi salvo: ${error.message}`, { duration: 12000 });
    }
  };

  /**
   * Manda a disputa selecionada para o robô, de verdade.
   *
   * Até 08/09/2026 NADA na interface fazia isto. A edge function
   * `enviar-sessao` existia, o agente tinha a rota `/sessao/iniciar`, e as duas
   * pontas nunca se encontraram — "Iniciar disputa" apenas mudava a coluna
   * `status` no banco. Testar o robô exigia SSH no servidor.
   *
   * Enviar NÃO significa dar lance: a lista `PORTAIS_COM_LANCE_LIBERADO` do
   * agente está vazia, então a estratégia devolve "aguardar" em toda rodada. O
   * robô entra, navega e lê — que é exatamente o que se quer observar agora.
   */
  const [enviandoAoRobo, setEnviandoAoRobo] = useState(false);

  /**
   * O convite deixou de ser um pop-up e virou um FAROL.
   *
   * A primeira versao abria um cartao no meio da tela ao enviar. Resolvia o
   * "usuario perdido", mas com dois avisos para o mesmo trabalho em quinze
   * segundos — o cartao do PedidoDoRobo dispara logo depois, e com instrucao
   * de verdade.
   *
   * O que nao podia se perder junto: o estimulo a assistir DESDE O COMECO. A
   * parte mais convincente do robo e ve-lo entrando no portal e digitando o
   * login, e isso acontece nos primeiros segundos — quem chega depois so ve
   * tela preta.
   *
   * Entao, em vez de bloquear a tela, o botao que ja existe acende e pulsa.
   * Aponta em vez de interromper.
   */
  const [destacarAssistir, setDestacarAssistir] = useState(false);
  useEffect(() => {
    if (!destacarAssistir) return;
    // Uma sessao que falha dura ~13s, medidos. Vinte segundos cobrem o inicio
    // sem virar enfeite permanente — farol que fica aceso deixa de ser aviso.
    const t = setTimeout(() => setDestacarAssistir(false), 20000);
    return () => clearTimeout(t);
  }, [destacarAssistir]);

  /**
   * Um caminho só até a tela do robô, e ele termina COM a tela aberta.
   *
   * Antes eram quatro passos: trocar de aba, rolar até quase o fim da página,
   * achar o painel e clicar em "Abrir VNC Integrado". A sessão pode terminar em
   * segundos — ninguém chegava a tempo, e a conclusão era que a tela remota não
   * funcionava.
   *
   * O contador existe porque o pedido se repete: enviar duas sessões seguidas
   * precisa abrir duas vezes, e um booleano já em `true` não dispara efeito
   * nenhum na segunda.
   */
  const [pedidoDeTelaRemota, setPedidoDeTelaRemota] = useState(0);

  /**
   * Existe robô DE PÉ nesta disputa agora?
   *
   * O freio ficava visível o tempo todo, e isso e um defeito proprio: botao
   * vermelho sem nada para parar treina a pessoa a ignora-lo — exatamente o
   * contrario do que ele existe para fazer. E, aparecendo sempre, ele competia
   * em destaque com a acao principal da tela.
   *
   * Quem sabe se ha sessao viva e o agente, e e a ele que se pergunta.
   */
  const { data: estadoDoRobo } = usePedidosDoRobo();
  const sessaoVivaDesta = (estadoDoRobo?.sessoesVivas || []).find(
    (sv) => sv.edital === selectedLance?.edital,
  );

  const irParaTelaRemota = () => {
    setActiveMainTab('agente');
    setPedidoDeTelaRemota((n) => n + 1);
  };

    const handleEnviarAoRobo = async () => {
    if (!selectedLance) return;

    const portalId = idDoPortal(selectedLance.portal);
    if (!portalId) {
      toast.error(
        `Portal "${selectedLance.portal}" não é um dos que o robô sabe operar.`,
        { duration: 10000 },
      );
      return;
    }

    setEnviandoAoRobo(true);
    setDestacarAssistir(true);

    // O CONVITE SAI NO PRIMEIRO CLIQUE, antes de qualquer ida ao servidor.
    //
    // Só assim dá para ver o começo: o robô abre o Chrome e carrega a tela de
    // login em poucos segundos, e a chamada de envio só retorna DEPOIS que ele
    // terminou de entrar e navegar. Avisar no fim é avisar quando não serve.
    //
    // O id fica guardado para o convite ser retirado caso o envio seja recusado
    // antes de o robô abrir qualquer coisa — convidar para assistir a uma
    // sessão que não existe seria a mesma mentira, na direção contrária.

    // Reconhecer o portal não é o mesmo que o agente NO AR saber operá-lo.
    //
    // A VPS pode estar num build atrás do template — em 09/09/2026 estava, com 8
    // dos 23 módulos. Perguntar ao `/health` é a única forma de responder isso
    // sem escrever no código uma verdade que envelhece. E a resposta vem com a
    // lista, então a mensagem diz o que ELE tem, não o que falta.
    try {
      const { data: saude } = await supabase.functions.invoke(
        'robo-lances-webhook/healthcheck',
        { body: {} },
      );
      const suportados = (saude as {
        agentes?: Array<{ portais_suportados?: string[] | null }>;
      } | null)?.agentes?.[0]?.portais_suportados;

      if (!agenteOpera(portalId, suportados)) {
        toast.error(
          `O agente no ar ainda não tem o módulo de ${nomeDoPortal(portalId)}. ` +
            `Hoje ele opera: ${(suportados || []).join(', ')}.`,
          { duration: 15000 },
        );
        setEnviandoAoRobo(false);
        return;
      }
    } catch {
      // Healthcheck indisponível não impede o envio: a edge function repete a
      // validação, e o agente é a autoridade final. Barrar aqui trocaria um
      // erro informativo por um bloqueio sem causa visível.
    }

    try {
      const { data, error } = await supabase.functions.invoke(
        'robo-lances-webhook/enviar-sessao',
        {
          body: {
            lance_config_id: selectedLance.id,
            portal_id: portalId,
            portal_nome: nomeDoPortal(selectedLance.portal),
            edital: selectedLance.edital,
            valor_referencia: selectedLance.valorReferencia,
            valor_inicial: selectedLance.valorInicial,
            valor_minimo: selectedLance.valorMinimo,
            decremento_min: selectedLance.decrementoMin,
            decremento_percentual: selectedLance.decrementoPercentual,
            intervalo_segundos: selectedLance.intervaloSegundos,
            max_lances: selectedLance.maxLances,
            // ── O QUE FALTAVA ATRAVESSAR ──────────────────────────────────
            //
            // Até aqui o robô recebia `edital` (string), portal e três valores
            // da disputa inteira. Num pregão com 40 itens ele achava o
            // processo e não sabia em qual item estava — era uma ilha.
            //
            // Os três valores viajam SEPARADOS de propósito. Colapsá-los num
            // campo só foi o defeito: preço de venda, custo e estimativa do
            // órgão viram todos "R$ alguma coisa", e depois de gravados não
            // dá para saber qual âncora a disputa estava usando.
            empresa_id: empresaAtiva?.id ?? null,
            licitacao_id: selectedLance.licitacaoId ?? null,
            tipo_disputa: selectedLance.tipoDisputa,
            // Compras.gov: o número da compra se repete entre órgãos; a UASG
            // desambigua. Vai fora de `sessoes_lance_real` de propósito — a
            // disputa é o registro, e a sessão não precisa de coluna nova.
            uasg: selectedLance.uasg ?? null,
            itens: (selectedLance.itens || []).map((i) => ({
              numero: i.numero,
              lote: i.lote,
              descricao: i.descricao,
              marca: i.marca ?? null,
              modelo: i.modelo ?? null,
              quantidade: i.quantidade,
              unidade: i.unidade,
              preco_venda: i.valorReferencia > 0 ? i.valorReferencia : null,
              custo_unitario: i.custoUnitario ?? null,
              valor_estimado_orgao: i.valorEstimadoOrgao ?? null,
              // `null` viaja como `null`: o piso ausente é uma decisão que
              // ninguém tomou, e o agente precisa distinguir isso de zero.
              valor_minimo: i.valorMinimo ?? null,
              origem: i.origem ?? null,
              disputando: i.disputando,
            })),
          },
        },
      );

      // A mensagem real do servidor, nunca um "erro ao enviar" genérico: a
      // causa costuma ser credencial ausente ou agente fora do ar, e as duas
      // têm conserto diferente.
      //
      // Ler `error.message` NÃO basta. Quando a função responde não-2xx, o
      // cliente do Supabase devolve `data: null` e a mensagem literal
      // "Edge Function returned a non-2xx status code" — o corpo da resposta,
      // onde está a causa, fica guardado em `error.context`. Sem abrir isso, o
      // usuário recebe uma frase que não diz nada e o defeito vira caça ao
      // tesouro. Foi exatamente o que aconteceu no primeiro teste real.
      let motivo = (data as { error?: string } | null)?.error;

      if (!motivo && error) {
        const contexto = (error as { context?: Response }).context;
        if (contexto && typeof contexto.json === 'function') {
          const corpo = await contexto.json().catch(() => null);
          motivo = (corpo as { error?: string } | null)?.error;
        }
        motivo = motivo || error.message;
      }

      if (motivo) {
        // Recusa da edge function: o agente nunca foi acionado, então não há
        // nada para assistir. Deixar o convite na tela seria convidar para uma
        // sessão que não existe.
        toast.error(motivo, { duration: 15000 });
        return;
      }

      registrar(
        'sessao_criada',
        { portal: portalId, edital: selectedLance.edital, origem: 'botao_enviar_ao_robo' },
        { licitacaoId: selectedLance.licitacaoId, nivelAutomacao: nivelAutomacao },
      );

      // Discreto de propósito: o convite grande já está na tela desde o clique,
      // e ele é que carrega o caminho para assistir. Repetir a mesma oferta
      // aqui empilharia dois avisos dizendo a mesma coisa. Este só confirma o
      // que aconteceu, para quem dispensou o convite.
      toast.success('Sessão aceita pelo robô.', { duration: 6000 });
    } catch (e) {
      toast.error(`Não foi possível falar com o robô: ${(e as Error).message}`, {
        duration: 15000,
      });
    } finally {
      setEnviandoAoRobo(false);
    }
  };

  const handleEndDispute = async (resultado: 'venceu' | 'perdeu') => {
    if (!selectedLance) return;

    // Derrota em processo vinculado passa pelo diálogo de motivo antes de
    // qualquer gravação — o encerramento continua no fluxo abaixo.
    if (resultado === 'perdeu' && selectedLance.licitacaoId) {
      setPerdaAlvo({
        licitacaoId: selectedLance.licitacaoId,
        numero: selectedLance.edital,
        orgao: selectedLance.portal,
        valorEstimado: selectedLance.valorMinimo ?? null,
      });
      return;
    }

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

  /** Registra o motivo e só então encerra a disputa como derrota. */
  const confirmarPerdaDisputa = async ({ motivoId, observacao }: { motivoId: string; observacao: string }) => {
    if (!perdaAlvo || !selectedLance || !empresaAtiva) return;
    setSalvandoPerda(true);
    const ok = await registrarPerda({
      licitacaoId: perdaAlvo.licitacaoId,
      empresaId: empresaAtiva.id,
      motivoId,
      observacao,
      valorEstimado: perdaAlvo.valorEstimado,
    });
    setSalvandoPerda(false);
    if (!ok) return;

    setPerdaAlvo(null);
    setLances(prev => prev.map(l =>
      l.id === selectedLance.id ? { ...l, status: 'encerrado' as const } : l
    ));
    await postResultToMural(selectedLance, 'perdeu');
    setBottomTab('mural');
  };

  const filteredLances = lances.filter(
    (l) =>
      l.edital.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.portal.toLowerCase().includes(searchTerm.toLowerCase())
  );

  /* ── Selo de nível ──
     O selo não é enfeite: é a informação mais cara desta tela. Nível 3
     significa que o sistema envia lance com dinheiro da empresa sem ninguém
     confirmar, e quem abre a página precisa saber disso antes de clicar em
     qualquer coisa. Ele vinha só dentro da aba de configuração, a dois cliques
     de distância.

     Armado (nível 2 ou 3), o selo vira ATALHO para a aba de disputa — que é
     onde mora a parada de emergência. É navegação, não capacidade nova: o
     botão de parada continua exatamente onde estava, com o mesmo escopo e as
     mesmas regras. Só o caminho até ele encurtou.

     Veste o Badge semântico de ui (tinta + texto), com o mesmo desenho quer
     seja botão, quer seja só selo. */
  const nivelArmado = nivelAutomacao >= 2;
  const seloNivelClasse = cn(
    badgeVariants({
      variant: nivelAutomacao >= 3 ? 'danger' : nivelAutomacao === 2 ? 'warning' : 'muted',
    }),
    'gap-1.5 py-1',
    nivelArmado && 'cursor-pointer hover:brightness-95',
  );
  const seloNivelExplica =
    nivelAutomacao >= 3
      ? 'O sistema envia lances sem confirmação humana. Clique para ir à disputa, onde fica a parada de emergência.'
      : nivelAutomacao === 2
        ? 'O sistema sugere; o envio pede confirmação. Clique para ir à disputa.'
        : 'Somente acompanhamento — nenhum lance é enviado.';
  const seloNivelConteudo = (
    <>
      <Zap className="w-3 h-3" aria-hidden="true" />
      Nível {nivelAutomacao}
      {nivelArmado && <span className="font-normal">· armado</span>}
    </>
  );
  const seloNivel = nivelArmado ? (
    <button
      type="button"
      onClick={() => setActiveMainTab('disputar')}
      className={seloNivelClasse}
      title={seloNivelExplica}
    >
      {seloNivelConteudo}
    </button>
  ) : (
    <span className={seloNivelClasse} title={seloNivelExplica}>{seloNivelConteudo}</span>
  );

  return (
    <AppLayout>
      {/* Declara a pasta de origem e devolve o caminho de volta. Sem px-4: o
          contêiner da página já aplica a margem lateral, e o padding extra
          encolhia a barra em relação ao cabeçalho logo abaixo. */}
      <div className="mb-3">
        <ProcessoContextoBanner />
      </div>

      <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="flex flex-col">
        {/* ── Cabeçalho do módulo (identidade 12/09) ──
            A faixa herói navy com a foto do aperto de mão saiu: o cabeçalho
            padrão é claro, com o ícone do módulo em tinta verde, o título em
            navy e a ação principal à direita. As abas e o selo de nível ficam
            entre o título e o conteúdo — a navegação e o estado de risco,
            lado a lado, visíveis antes de qualquer clique.

            Título, descrição, ícone e trilha NÃO são escritos aqui: vêm de
            `lib/navegacao/paginas.ts` pela rota atual. Repeti-los no .tsx era
            como os 93 títulos à mão divergiam — mudar o nome do módulo
            passava a exigir caçar a string em cada tela.

            Credenciais da empresa, infraestrutura do agente e nível de
            automação (decisão de risco financeiro) são do administrador.
            Operador e visualizador ficam com a aba de trabalho.

            Agente Cloud vem logo depois de Disputar porque é o movimento
            seguinte de quem acabou de enviar: a sessão pode durar segundos, e
            ter "Portais" no caminho obriga a atravessar uma aba que não
            interessa naquele instante. Portais é cadastro — se faz uma vez,
            não a cada disputa. */}
        <CabecalhoPagina
          acoes={
            <>
              <ExportarResultados lances={lances} />
              {podeOperar && (
                <ConfigurarLanceDialog
                  processoAtivoId={processoId}
                  onSave={handleSaveLance}
                  trigger={
                    <Button>
                      <Plus className="w-4 h-4" aria-hidden="true" /> Nova sessão
                    </Button>
                  }
                />
              )}
            </>
          }
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabsList>
              <TabsTrigger value="disputar">
                <Zap className="w-4 h-4 mr-1.5" aria-hidden="true" /> Disputar
              </TabsTrigger>
              {isAdmin && (
                <>
                  <TabsTrigger value="agente">
                    <Shield className="w-4 h-4 mr-1.5" aria-hidden="true" /> Agente
                  </TabsTrigger>
                  <TabsTrigger value="portais">
                    <Globe className="w-4 h-4 mr-1.5" aria-hidden="true" /> Portais
                  </TabsTrigger>
                  <TabsTrigger value="configuracoes">
                    <Settings className="w-4 h-4 mr-1.5" aria-hidden="true" /> Configurações
                  </TabsTrigger>
                </>
              )}
            </TabsList>
            {seloNivel}
          </div>
        </CabecalhoPagina>

        {/* ── DISPUTAR TAB ── */}
        <TabsContent
          value="disputar"
          className="m-0 flex flex-col md:flex-row overflow-hidden rounded-lg border border-border bg-card shadow-sm"
        >
          {/* LEFT SIDEBAR – lista de disputas. No celular vira a faixa de cima,
              com a lista limitada em altura; no desktop, coluna à esquerda. */}
          <aside className="w-full md:w-72 md:shrink-0 border-b md:border-b-0 md:border-r border-border flex flex-col">
            <div className="p-4 border-b border-border space-y-3">
              <h2 className="text-lg font-semibold text-foreground">Disputas adicionadas</h2>
              {/* O gatilho de criar subiu para o cabeçalho, como ação principal
                  da tela ("Nova sessão", pelo registro). Aqui havia um SEGUNDO
                  gatilho do MESMO diálogo, com outro rótulo — dois nomes para a
                  mesma coisa na mesma dobra.

                  Visualizador acompanha a sessão — vê posição, lances e
                  resultado — mas não configura estratégia nem dispara lance, e
                  continua sabendo por quê. */}
              {!podeOperar && (
                <div className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
                  Você acompanha as disputas em modo leitura. Para configurar,
                  peça o papel de operador em Equipe → Permissões.
                </div>
              )}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  placeholder="Buscar disputa..."
                  aria-label="Buscar disputa"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto md:max-h-none md:flex-1">
              <div className="p-2 space-y-1">
                {filteredLances.length === 0 && (
                  <EstadoVazio
                    icone={<Bot />}
                    titulo="Nenhuma disputa adicionada"
                    descricao={
                      searchTerm
                        ? 'Nenhuma disputa corresponde à busca.'
                        : 'Use "Nova sessão", no topo da tela, para começar.'
                    }
                    tamanho="compacto"
                  />
                )}
                {filteredLances.map((lance) => {
                  const selecionada = selectedId === lance.id;
                  return (
                    <button
                      key={lance.id}
                      type="button"
                      onClick={() => alternarSelecao(lance.id)}
                      aria-pressed={selecionada}
                      title={selecionada ? 'Clique de novo para desmarcar' : undefined}
                      className={cn(
                        'w-full text-left rounded-md px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                        selecionada ? 'bg-primary-tint text-foreground' : 'text-foreground hover:bg-muted',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold truncate">{lance.edital}</span>
                        <Badge variant={statusVariant[lance.status] || 'muted'} className="shrink-0">
                          {lance.status === 'ativo' && (
                            <span className="w-1.5 h-1.5 rounded-full bg-current mr-1 animate-pulse" aria-hidden="true" />
                          )}
                          {rotuloStatus(lance.status)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{lance.portal}</p>
                      {lance.horario && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <CalendarDays className="w-3 h-3" aria-hidden="true" />
                          Sessão: {lance.horario}
                        </div>
                      )}
                      {lance.licitacaoId && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <MessageSquare className="w-3 h-3" aria-hidden="true" />
                          Vinculado ao Kanban
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          {/* MAIN CONTENT */}
          <div className="flex-1 min-w-0 flex flex-col">
            {/* Simultaneous disputes summary bar */}
            <DisputasResumo lances={lances} onSelect={alternarSelecao} selectedId={selectedId} />

            {!selectedLance ? (
              /* empty state with level selector */
              <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
                <EstadoVazio
                  icone={<Target />}
                  titulo="Selecione ou crie uma disputa"
                  descricao={'Abra uma disputa da lista ao lado ou use "Nova sessão", no topo da tela, para gerenciar os lances.'}
                  className="py-0"
                />
                {/* Level selector in empty state */}
                <div className="w-full max-w-3xl">
                  <NivelAutomacaoSelector nivel={nivelAutomacao} onChange={handleNivelChange} />
                </div>
              </div>
            ) : (
              <>
                {/* ── Dispute Header Bar ── */}
                {/* `justify-between` SEM gap deixava os dois grupos se
                    encostarem quando o conteudo crescia — foi o que aconteceu
                    ao trazer o freio de volta: o botao vermelho colou no selo
                    "N1 — Assistente".

                    `flex-wrap` faz a barra quebrar em duas linhas em vez de
                    espremer o titulo, e `shrink-0` no grupo de acoes garante
                    que quem cede espaco e o texto, nao o botao. */}
                <div className="border-b border-border px-4 py-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                  <div className="flex flex-wrap items-center gap-3 min-w-0">
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold flex flex-wrap items-center gap-2">
                        {selectedLance.edital}
                        {selectedLance.horario && (
                          <span className="text-sm font-normal text-muted-foreground">
                            — {selectedLance.horario}
                          </span>
                        )}
                      </h2>
                      <p className="text-sm text-muted-foreground">{selectedLance.portal}</p>
                    </div>
                    <Badge variant={statusVariant[selectedLance.status] || 'muted'}>
                      {rotuloStatus(selectedLance.status)}
                    </Badge>
                    <Badge variant={nivelAutomacao === 1 ? 'info' : nivelAutomacao === 2 ? 'warning' : 'danger'}>
                      N{nivelAutomacao} — {nivelAutomacao === 1 ? 'Assistente' : nivelAutomacao === 2 ? 'Semi' : 'Auto'}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {/* O FREIO NÃO DEPENDE DO NÍVEL DE AUTOMAÇÃO — mas
                        depende de haver o que frear.
                        Ele ficava escondido atrás de `nivelAutomacao >= 2`, sob
                        a premissa de que N1 é assistente e não age sozinho.
                        Isso deixou de valer quando o botão "Enviar ao robô" foi
                        construído: em N1 ele dispara uma sessão real, que loga
                        na conta do cliente e abre um navegador no portal.
                        Em 09/09/2026 uma sessão travada teve que ser encerrada
                        por `curl` na VPS, porque a tela não oferecia parada.
                        Quem consegue disparar tem que conseguir parar. */}
                    {sessaoVivaDesta && (
                      <KillSwitchButton
                        sessaoId={sessaoVivaDesta.sessao_id}
                        licitacaoId={selectedLance.licitacaoId}
                        onParada={handleParadaEmergencial}
                        disabled={paradaEmergencial}
                      />
                    )}

                    {/* Level 2: Authorize strategy button */}
                    {nivelAutomacao === 2 && !estrategiaAutorizada && selectedLance.status === 'aguardando' && (
                      <Button
                        variant="outline"
                        onClick={() => setAutorizacaoOpen(true)}
                      >
                        <ShieldCheck className="w-4 h-4" aria-hidden="true" /> Autorizar Estratégia
                      </Button>
                    )}
                    {estrategiaAutorizada && (
                      <Badge variant="success" className="gap-1">
                        <CheckCircle2 className="w-3 h-3" aria-hidden="true" /> Estratégia Autorizada
                      </Badge>
                    )}

                    {/* O botão que faltava. Fica FORA do menu "Ações" porque é
                        a única coisa nesta tela que move o robô de verdade —
                        escondê-lo atrás de um menu era parte do motivo de
                        ninguém notar que ele não existia.

                        Só o operador vê: quem tem papel de visualizador
                        acompanha a disputa, não dispara sessão. */}
                    {podeOperar && (
                      <>
                        <Button
                          onClick={handleEnviarAoRobo}
                          disabled={enviandoAoRobo}
                          title="Abre a sessão no agente: entra no portal, navega até a disputa e lê a tela. Não envia lance — o envio segue travado até o portal ser liberado."
                        >
                          {enviandoAoRobo
                            ? <><RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" /> Enviando…</>
                            : <><Send className="w-4 h-4" aria-hidden="true" /> Enviar ao robô</>}
                        </Button>

                        {/* O ATALHO PRECISA VIR ANTES DO ENVIO.
                            Uma sessão que falha dura ~13 segundos, medidos. Quem
                            clica em enviar e só depois procura onde assistir
                            chega quando já acabou — e o que sobra é um spinner
                            que termina em nada, sem dizer para onde ir.

                            Quando acende (`destacarAssistir`), o botão vira a
                            ação verde e pulsa pelo `pulse-glow` — que anima só
                            o box-shadow, sem piscar o texto. */}
                        <Button
                          variant={destacarAssistir ? 'default' : 'ghost'}
                          onClick={() => {
                            setDestacarAssistir(false);
                            irParaTelaRemota();
                          }}
                          className={destacarAssistir ? 'animate-pulse-glow' : 'text-muted-foreground hover:text-foreground'}
                          title="Abre a tela remota já conectada. A sessão pode durar poucos segundos — deixá-la aberta antes de enviar é o jeito de acompanhar desde o início."
                        >
                          <Monitor className="w-4 h-4" aria-hidden="true" />
                          {destacarAssistir ? 'Assista agora — o robô está entrando' : 'Assistir ao vivo'}
                        </Button>
                      </>
                    )}

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline">
                          <Settings className="w-4 h-4" aria-hidden="true" /> Ações <ChevronDown className="w-4 h-4" aria-hidden="true" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setDetailsOpen(true)}>
                          <Info className="w-4 h-4 mr-2" aria-hidden="true" /> Detalhes da licitação
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleStatus(selectedLance.id)}>
                          {selectedLance.status === 'aguardando' ? (
                            <><Play className="w-4 h-4 mr-2" aria-hidden="true" /> Iniciar disputa</>
                          ) : (
                            <><Pause className="w-4 h-4 mr-2" aria-hidden="true" /> Pausar disputa</>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Edit2 className="w-4 h-4 mr-2" aria-hidden="true" /> Editar parâmetros
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-success-ink focus:text-success-ink"
                          onClick={() => handleEndDispute('venceu')}
                        >
                          <Trophy className="w-4 h-4 mr-2" aria-hidden="true" /> Encerrar como Venceu
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleEndDispute('perdeu')}
                        >
                          <XCircle className="w-4 h-4 mr-2" aria-hidden="true" /> Encerrar como Perdeu
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDelete(selectedLance.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" aria-hidden="true" /> Remover disputa
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <div className="relative w-full sm:w-48">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                      <Input placeholder="Buscar item..." aria-label="Buscar item" className="pl-9" />
                    </div>
                  </div>
                </div>

                {/* ── A conferência dos itens contra o edital do portal ──────
                    Fica IMEDIATAMENTE acima da tabela que ela julga: o veredito
                    e a lista que ele avalia se leem juntos, e o número do item
                    acusado está logo abaixo, na linha correspondente.

                    Só com sessão viva, porque é o robô quem confere — sem
                    sessão não há o que mostrar, e um cartão permanente dizendo
                    "aguardando" viraria paisagem. */}
                {sessaoVivaDesta && (
                  <div className="px-4 pt-4">
                    <ConferenciaDosItens
                      conferencia={sessaoVivaDesta.conferencia}
                      edital={selectedLance.edital}
                    />
                  </div>
                )}

                {/* ── Items Table ── */}
                <div className="min-w-0">
                  {disputeItems.length === 0 ? (
                    <EstadoVazio
                      icone={<ListChecks />}
                      titulo="Nenhum item cadastrado nesta disputa"
                      descricao="Edite a disputa para adicionar itens e lotes."
                    />
                  ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted">
                        <TableHead className="w-12 text-center">Item</TableHead>
                        <TableHead className="w-12"><span className="sr-only">Ações</span></TableHead>
                        <TableHead>Situação</TableHead>
                        <TableHead className="text-right">Vlr Ref.</TableHead>
                        <TableHead className="text-right">Melhor Lance</TableHead>
                        <TableHead className="text-right">Seu Último Lance</TableHead>
                        <TableHead className="text-center">Qtd</TableHead>
                        <TableHead className="text-center">Disputando</TableHead>
                        <TableHead>Descrição</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {disputeItems.map((item) => (
                        <TableRow key={item.numero}>
                          <TableCell className="text-center font-medium tabular-nums">{item.numero}</TableCell>
                          <TableCell className="text-center">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  aria-label={`Ações do item ${item.numero}`}
                                >
                                  <MoreVertical className="w-4 h-4" aria-hidden="true" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start">
                                <DropdownMenuItem><ArrowDown className="w-4 h-4 mr-2" aria-hidden="true" /> Enviar lance</DropdownMenuItem>
                                <DropdownMenuItem><Eye className="w-4 h-4 mr-2" aria-hidden="true" /> Ver histórico</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                item.situacao === 'disputando'
                                  ? 'info'
                                  : item.situacao === 'encerrado'
                                  ? 'muted'
                                  : 'warning'
                              }
                            >
                              {rotuloStatus(item.situacao)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {item.valorReferencia > 0 ? formatCurrency(item.valorReferencia) : '—'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {item.melhorLance ? formatCurrency(item.melhorLance) : '—'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {item.seuUltimoLance ? formatCurrency(item.seuUltimoLance) : '—'}
                          </TableCell>
                          <TableCell className="text-center tabular-nums">
                            {item.quantidade} {item.unidade}
                          </TableCell>
                          <TableCell className="text-center">
                            {item.disputando ? (
                              <span className="inline-flex items-center gap-1 text-success-ink font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" aria-hidden="true" /> Sim
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground max-w-[200px] truncate" title={item.descricao}>
                            {item.descricao}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  )}
                </div>

                {/* ── Painel de Risco (Level 1+) ── */}
                <div className="px-4 py-4 border-t border-border">
                  <PainelRisco lance={selectedLance} nivel={nivelAutomacao} />
                </div>

                {/* ── Bottom Panel: Mural + Simulação + Operações + Auditoria ──
                    Abas de ui aninhadas nas abas principais: o Radix isola os
                    dois contextos, e cada painel só monta quando ativo — o
                    mesmo que o `bottomTab === …` fazia à mão. */}
                <div className="border-t border-border">
                  <Tabs
                    value={bottomTab}
                    onValueChange={(v) => setBottomTab(v as 'mural' | 'operacoes' | 'simulacao' | 'auditoria')}
                  >
                    <div className="px-4 pt-4">
                      <TabsList>
                        <TabsTrigger value="mural">
                          <MessageSquare className="w-4 h-4 mr-1.5" aria-hidden="true" /> Mural
                        </TabsTrigger>
                        <TabsTrigger value="simulacao">
                          <Zap className="w-4 h-4 mr-1.5" aria-hidden="true" /> Simulação
                        </TabsTrigger>
                        <TabsTrigger value="operacoes">
                          <ListChecks className="w-4 h-4 mr-1.5" aria-hidden="true" /> Operações
                        </TabsTrigger>
                        <TabsTrigger value="auditoria">
                          <History className="w-4 h-4 mr-1.5" aria-hidden="true" /> Auditoria
                        </TabsTrigger>
                      </TabsList>
                    </div>

                    <TabsContent value="mural" className="m-0 h-64 p-4">
                      {selectedLance.licitacaoId ? (
                        <LicitacaoChat
                          licitacaoId={selectedLance.licitacaoId}
                          licitacaoNumero={selectedLance.edital}
                        />
                      ) : (
                        <EstadoVazio
                          icone={<MessageSquare />}
                          titulo="Esta disputa não está vinculada a um processo do Kanban"
                          descricao="Importe do Kanban ao criar a disputa para ativar o Mural em tempo real."
                          tamanho="compacto"
                          className="h-full"
                        />
                      )}
                    </TabsContent>

                    <TabsContent value="simulacao" className="m-0 p-4">
                      <SimulacaoDisputa
                        lance={selectedLance}
                        onUpdate={(updated) => {
                          setLances(prev => prev.map(l => l.id === updated.id ? updated : l));
                        }}
                        licitacaoId={selectedLance.licitacaoId}
                      />
                    </TabsContent>

                    <TabsContent value="auditoria" className="m-0 p-4">
                      <AuditTrailViewer sessaoId={undefined} />
                    </TabsContent>

                    <TabsContent value="operacoes" className="m-0 p-4 space-y-2 max-h-64 overflow-y-auto">
                      {operations.length === 0 ? (
                        <EstadoVazio
                          icone={<ListChecks />}
                          titulo="Nenhuma operação registrada"
                          descricao="Inicie uma disputa para ver o log de operações."
                          tamanho="compacto"
                        />
                      ) : (
                        operations.map((op) => (
                          <div key={op.id} className="flex flex-wrap items-center gap-3 text-sm">
                            <span className="text-muted-foreground shrink-0 tabular-nums">
                              {op.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                            <Badge
                              variant={
                                op.resultado === 'sucesso' ? 'success' :
                                op.resultado === 'erro' ? 'danger' :
                                'info'
                              }
                            >
                              {rotuloStatus(op.resultado)}
                            </Badge>
                            <span className="font-medium text-foreground">{op.acao}</span>
                            <span className="text-muted-foreground">{op.detalhes}</span>
                          </div>
                        ))
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
              </>
            )}
          </div>
        </TabsContent>

        {/* ── PORTAIS TAB ── */}
        <TabsContent value="portais" className="m-0 space-y-6">
          {!isAdmin ? <SemPermissao /> : (<>
          <CredenciaisPortalForm />
          <PortalHealthcheck />
          </>)}
        </TabsContent>

        {/* ── AGENTE CLOUD TAB ── */}
        <TabsContent value="agente" className="m-0 space-y-6">
          {!isAdmin ? <SemPermissao /> : (<>
          {/* A ordem segue o USO e a URGÊNCIA, não a configuração.
              O painel com prazo não pode exigir rolagem: a tela remota mostra o
              robô enquanto ele trabalha, e ele pode terminar em segundos. Tudo
              que ficasse acima dela — checklist inclusive — vira distância a
              percorrer com o relógio correndo.
              Sessões vem logo abaixo porque é a mesma pergunta ("o robô
              funcionou?") respondida depois que a janela fechou.
              Checklist, config e healthcheck são ajuste: consultados quando
              algo está errado, não a cada disputa. */}
          {/* Acima do VNC de propósito: quando o robô pede um código, isso é a
              coisa mais urgente da tela — e um código de verificação vale
              segundos. Quando ele não pede nada, este bloco não desenha nada. */}
          <PedidoDoRobo onAbrirTelaRemota={irParaTelaRemota} />
          <VncWebViewer abrirEm={pedidoDeTelaRemota} />
          {/* Logo abaixo da tela remota porque é a alternativa a ela: quem não
              quer usar o VNC vai querer entrar no portal pelo próprio navegador,
              e é justamente aí que a tentação de instalar o .pfx aparece. */}
          <AcessoManualPortal />
          <SessoesDoRobo />
          <AtivacaoChecklist />
          <AgenteExternoConfig />
          <PortalHealthcheck />
          </>)}
        </TabsContent>

        {/* ── CONFIGURAÇÕES TAB ── */}
        <TabsContent value="configuracoes" className="m-0 space-y-6">
          {!isAdmin ? <SemPermissao /> : (<>
          <NivelAutomacaoSelector nivel={nivelAutomacao} onChange={handleNivelChange} />
          <EstrategiaIAPanel lance={selectedLance} />
          <DisputaRealtimePanel />

          <div className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-4 max-w-2xl">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Settings className="w-5 h-5 text-muted-foreground" aria-hidden="true" /> Regras de Lance Automático (Padrão Global)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="config-decremento">Decremento padrão (%)</Label>
                <Input id="config-decremento" type="number" step="0.1" value={configDecremento} onChange={(e) => setConfigDecremento(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="config-lance-min">Lance mínimo (% do estimado)</Label>
                <Input id="config-lance-min" type="number" step="1" value={configLanceMin} onChange={(e) => setConfigLanceMin(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="config-intervalo">Intervalo entre lances (seg)</Label>
                <Input id="config-intervalo" type="number" step="1" min="1" value={configIntervalo} onChange={(e) => setConfigIntervalo(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="config-max-lances">Máx. lances por sessão</Label>
                <Input id="config-max-lances" type="number" step="1" min="1" value={configMaxLances} onChange={(e) => setConfigMaxLances(e.target.value)} className="mt-1" />
              </div>
            </div>
            <Button onClick={handleSaveConfig}>
              Salvar Regras
            </Button>
          </div>

          {/* Audit trail in config tab too */}
          <AuditTrailViewer />
          </>)}
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
            <DialogTitle>Detalhes da licitação</DialogTitle>
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
                  <item.icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{item.label}</p>
                    <p className="text-sm text-muted-foreground">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <RegistrarPerdaDialog
        alvo={perdaAlvo}
        salvando={salvandoPerda}
        onCancelar={() => setPerdaAlvo(null)}
        onConfirmar={confirmarPerdaDisputa}
      />
    </AppLayout>
  );
}
