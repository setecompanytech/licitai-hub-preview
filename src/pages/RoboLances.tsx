import { useState, useMemo, useEffect, useCallback } from 'react';
import { usePapelEmpresa } from '@/hooks/usePapelEmpresa';
import ProcessoContextoBanner from '@/components/shared/ProcessoContextoBanner';
import { useProcessoAtivo } from '@/hooks/useProcessoAtivo';
import AppLayout from '@/components/layout/AppLayout';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Bot, Plus, Hand, Settings, Globe, Clock, TrendingDown,
  AlertTriangle, Trash2, Edit2,
  ChevronDown, Search, MessageSquare, ListChecks, Info,
  Building2, Hash, CalendarDays, FileText, Shield,
  Target, ArrowDown, Trophy, XCircle,
} from 'lucide-react';
import ConfigurarLanceDialog, { type LanceConfig, type DisputeItem } from '@/components/robo-lances/ConfigurarLanceDialog';
import LicitacaoChat from '@/components/licitacoes/LicitacaoChat';
import DisputasResumo from '@/components/robo-lances/DisputasResumo';
import ExportarResultados from '@/components/robo-lances/ExportarResultados';
import type { NivelAutomacao } from '@/components/robo-lances/NivelAutomacaoSelector';
import AceiteTermosDialog from '@/components/robo-lances/AceiteTermosDialog';
import PainelRisco from '@/components/robo-lances/PainelRisco';
import AutorizacaoLanceDialog from '@/components/robo-lances/AutorizacaoLanceDialog';
import EstrategiaIAPanel from '@/components/robo-lances/EstrategiaIAPanel';
import AtivacaoChecklist from '@/components/robo-lances/AtivacaoChecklist';
import PainelDeControle from '@/components/robo-lances/PainelDeControle';
import ConferenciaDosItens from '@/components/robo-lances/ConferenciaDosItens';
import PedidoDoRobo from '@/components/robo-lances/PedidoDoRobo';
import { usePedidosDoRobo } from '@/components/robo-lances/usePedidosDoRobo';
import PainelDeParticipacoes from '@/components/robo-lances/painel/PainelDeParticipacoes';
import type { ResultadoDoFreio } from '@/components/robo-lances/KillSwitchButton';
import CabecalhoDoRobo from '@/components/robo-lances/cliente/CabecalhoDoRobo';
import FaixaDaEmpresa from '@/components/robo-lances/cliente/FaixaDaEmpresa';
import AvisosDosPortais from '@/components/robo-lances/cliente/AvisosDosPortais';
import DialogoModoDeOperacao from '@/components/robo-lances/cliente/DialogoModoDeOperacao';
import { useRoboDaEmpresa, type LinhaDoRoboDaEmpresa } from '@/components/robo-lances/cliente/useRoboDaEmpresa';
import { useSituacaoDoRobo } from '@/components/robo-lances/cliente/useSituacaoDoRobo';
import { useAvisosDosPortais } from '@/components/robo-lances/cliente/useAvisosDosPortais';
import { ValorIndisponivel } from '@/components/gestao/SeloSituacao';
import { idDoPortal, nomeDoPortal, agenteOpera } from '@/lib/robo/portais';
import { resumirErroParaCliente } from '@/lib/robo/situacao-da-participacao';
import { useAuditLog } from '@/hooks/useAuditLog';
import { toast } from 'sonner';
import { useLicitacaoIntegration } from '@/hooks/useLicitacaoIntegration';
import { useEmpresa } from '@/contexts/EmpresaContext';
import RegistrarPerdaDialog, { type PerdaAlvo } from '@/components/metas/RegistrarPerdaDialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Uma linha do log de operações da disputa.
 *
 * ─── ESTA ABA ESTEVE VAZIA DESDE QUE NASCEU ────────────────────────────────
 *
 * `operations` era um `useState([])` sem nenhum `setOperations` em lugar
 * algum do arquivo: o array nunca saía de vazio, e a aba mostrava "Nenhuma
 * operação registrada" para sempre — inclusive depois de o robô ter entrado
 * no portal e dado lances. Aba que não tem como deixar de estar vazia é
 * funcionalidade inacessível, que o padrão visual proíbe.
 *
 * A fonte real já existia e não estava ligada a nada nesta tela: as sessões
 * do agente (`sessoes_lance_real`, filtradas por `lance_config_id`) e os
 * lances de cada uma (`lances_historico`). Elas foram preferidas à remoção
 * da aba porque respondem a uma pergunta que a Auditoria não responde: a
 * trilha de auditoria registra o que ALGUÉM autorizou; isto registra o que o
 * robô EXECUTOU no portal.
 */
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
  // Contador de gravações nas disputas. O painel de participações tem a
  // própria leitura; quando esta página grava (salva, marca, encerra, remove),
  // o contador muda e o painel relê — senão ele mostraria a fase anterior por
  // até 30 s, contradizendo a coluna ao lado.
  const [versaoDasDisputas, setVersaoDasDisputas] = useState(0);
  const [detailsOpen, setDetailsOpen] = useState(false);
  // Simulação e Auditoria saíram das subabas em 14/09/2026: simular disputa e
  // reproduzir a trilha encadeada por hash são ferramentas da operação
  // Praefectus, e foram para o Admin › Robô de Lances.
  const [bottomTab, setBottomTab] = useState<'mural' | 'operacoes'>('mural');

  // ── Governance: 3 Levels ──
  const [nivelAutomacao, setNivelAutomacao] = useState<NivelAutomacao>(() => {
    const saved = localStorage.getItem('robo_nivel_automacao');
    return (saved ? parseInt(saved) : 1) as NivelAutomacao;
  });
  const [aceiteTermosOpen, setAceiteTermosOpen] = useState(false);
  const [aceiteId, setAceiteId] = useState<string | null>(null);
  /**
   * ─── TRAVA DE SEGURANÇA QUE NÃO TRAVAVA (corrigido em 13/09/2026) ────────
   *
   * `limiteFinanceiro` era declarado com `useState(0)` e NUNCA teve setter.
   * O número que a pessoa digita no `AceiteTermosDialog` era gravado em
   * `robo_aceite_termos.limite_financeiro` e ficava lá: a página jamais o lia
   * de volta. Resultado: `AutorizacaoLanceDialog` recebia `0` em toda
   * autorização, e a checagem `excedeLimite` daquele diálogo é
   *
   *     estrategia.valorInicial > limiteFinanceiro && limiteFinanceiro > 0
   *
   * — ou seja, com zero ela é sempre falsa. O bloco que deveria impedir
   * autorizar uma estratégia acima do teto ficava desligado, e o rodapé verde
   * "Dentro do limite financeiro" nem aparecia (também condicionado a > 0),
   * então nada na tela denunciava a ausência.
   *
   * Agora o aceite VIGENTE (o mais recente, não revogado) é lido de volta e o
   * valor real atravessa. `limiteCarregado` existe para a coluna da direita
   * não afirmar "sem limite" enquanto a consulta ainda está no ar — ausência
   * de resposta não é ausência de limite.
   */
  const [limiteFinanceiro, setLimiteFinanceiro] = useState(0);
  const [limiteCarregado, setLimiteCarregado] = useState(false);
  const [autorizacaoOpen, setAutorizacaoOpen] = useState(false);
  const [estrategiaAutorizada, setEstrategiaAutorizada] = useState(false);
  const { isAdmin, podeOperar } = usePapelEmpresa();
  const [paradaEmergencial, setParadaEmergencial] = useState(false);

  // ── O que é da EMPRESA (14/09/2026) ──
  // Ligado/desligado (`robo_empresa_config`), disponibilidade respondida pelo
  // servidor (`situacao-do-robo`) e avisos da operação (`robo_avisos_portal`).
  // Os três no lugar do que a tela mostrava antes: agente, healthcheck, slots.
  const roboDaEmpresa = useRoboDaEmpresa(empresaAtiva?.id);
  const { situacao: situacaoDoRobo, recarregar: relerSituacaoDoRobo } = useSituacaoDoRobo(empresaAtiva?.id);
  const avisosDosPortais = useAvisosDosPortais();
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
  }, [user, empresaAtiva?.id, processoId]);

  /**
   * Troca o nível de automação. Devolve `true` quando o nível foi aplicado — o
   * diálogo do modo de operação fecha para o aceite de termos abrir por cima.
   */
  const handleNivelChange = async (novoNivel: NivelAutomacao): Promise<boolean> => {
    if (!isAdmin) {
      toast.error('Só o administrador da empresa altera o nível de automação.');
      return false;
    }
    // Freio verificado é PRÉ-REQUISITO dos níveis com envio automático. O
    // próprio sistema exige "botão de parada emergencial" no nível 3 — mas
    // exigia o botão existir na tela, não o freio funcionar do outro lado.
    //
    // A mensagem dizia "rode Testar freio de emergência no checklist". Esse
    // teste saiu da tela do cliente (14/09/2026) — é ferramenta da operação
    // Praefectus —, então apontar para ele mandaria a pessoa atrás de um botão
    // que ela não tem. O detalhe do agente vai para o console.
    if (novoNivel > 1) {
      let ks: { ok?: boolean; detalhe?: string | null } | null | undefined = null;
      try {
        const { data } = await supabase.functions.invoke('robo-lances-webhook/healthcheck', { body: {} });
        ks = (data as { agentes?: Array<{ kill_switch?: { ok?: boolean; detalhe?: string | null } | null }> } | null)
          ?.agentes?.[0]?.kill_switch;
      } catch (e) {
        console.error('[robo-lances] verificar freio antes do nível', e);
      }
      if (!ks?.ok) {
        if (ks?.detalhe) console.error('[robo-lances] freio não verificado', ks.detalhe);
        toast.error(
          `Nível ${novoNivel} indisponível no momento: a parada de emergência do robô ainda não foi verificada ` +
          'pela equipe Praefectus. Fale com o suporte para ativar o envio automático.',
          { duration: 15000 },
        );
        return false;
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
    return true;
  };

  /**
   * Lê o limite financeiro do aceite vigente.
   *
   * "Vigente" = o mais recente COM `revogado_em` nulo. Aceite revogado não
   * autoriza gasto nenhum, e herdar o teto de um aceite cancelado seria
   * ressuscitar uma permissão que alguém retirou de propósito.
   *
   * A RLS da tabela é `auth.uid() = user_id`, então o filtro por usuário aqui
   * é para a consulta ser explícita, não para substituir a trava do banco.
   */
  const carregarLimiteFinanceiro = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('robo_aceite_termos' as never)
      .select('limite_financeiro')
      .eq('user_id', user.id)
      .is('revogado_em', null)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      // Falha silenciosa aqui é perigosa: sem o limite, a trava do diálogo de
      // autorização volta a ficar desligada. A pessoa precisa saber disso.
      console.error('[robo-lances] carregar limite financeiro', error.message);
      toast.error(
        `Não foi possível ler o limite financeiro do aceite: ${error.message}. ` +
        'A conferência de teto na autorização fica indisponível até a leitura funcionar.',
        { duration: 12000 },
      );
      setLimiteCarregado(true);
      return;
    }

    const linha = (data as unknown as Array<{ limite_financeiro: number | null }> | null)?.[0];
    setLimiteFinanceiro(Number(linha?.limite_financeiro) || 0);
    setLimiteCarregado(true);
  }, [user]);

  useEffect(() => {
    carregarLimiteFinanceiro();
  }, [carregarLimiteFinanceiro]);

  const handleAceite = (id: string) => {
    setAceiteId(id);
    // O aceite acabou de gravar um limite novo — relê agora, senão a tela
    // continuaria com o teto anterior (ou com zero) até o próximo F5.
    carregarLimiteFinanceiro();
    toast.success(`Nível ${nivelAutomacao} ativado com sucesso!`);
  };

  /**
   * Chamada pelo `KillSwitchButton` DEPOIS que o freio de emergência respondeu.
   *
   * ─── A PARADA QUE SÓ ACONTECIA NA TELA (corrigido em 14/09/2026) ─────────
   *
   * Esta função trocava para "encerrado", só no estado local, toda disputa
   * ativa da lista. Nada ia ao banco nem ao agente: ao recarregar, as disputas
   * voltavam — e, enquanto isso, a tela afirmava um encerramento que ninguém
   * confirmou. "Encerrado" ainda é fase do CERTAME; o freio para o ROBÔ.
   *
   * Agora quem pede a parada é o servidor (`kill-switch`), para todas as
   * sessões que a pessoa opera, e o próprio botão diz sessão por sessão o que
   * o agente confirmou. Aqui só se relê a lista. O freio continua liberado
   * enquanto houver sessão sem confirmação — travá-lo com a parada pendente
   * tiraria da pessoa a chance de insistir.
   */
  const handleParadaEmergencial = (resultado?: ResultadoDoFreio) => {
    // O freio (`KillSwitchButton` → `robo-lances-webhook/kill-switch`) já pediu
    // a parada de TODAS as sessões que a pessoa opera e já disse, sessão por
    // sessão, o que o agente confirmou. Pedir de novo aqui por `parar-sessao`
    // mandava dois comandos ao agente para a mesma sessão. Aqui só se relê.
    setParadaEmergencial(resultado?.confirmada === true);
    setVersaoDasDisputas((v) => v + 1);
  };

  // As "Regras de lance — padrão deste navegador" saíram em 14/09/2026. Eram
  // quatro campos gravados no localStorage que nada no app lia: nem o cadastro
  // de disputa, nem o agente. Configuração que não se aplica a coisa alguma é
  // promessa falsa; a regra de lance de verdade é a de cada disputa, em
  // "Editar parâmetros".

  /**
   * O robô foi ligado ou desligado. O servidor pode mudar a disponibilidade
   * por isso, e o painel de participações pode ter sessões paradas — os dois
   * releem na hora, em vez de esperar o próximo ciclo.
   */
  const aoAlterarLigado = (linha: LinhaDoRoboDaEmpresa) => {
    roboDaEmpresa.aplicar(linha);
    relerSituacaoDoRobo();
    setVersaoDasDisputas((v) => v + 1);
  };

  /** Portais das disputas desta tela — decide quais avisos de portal se aplicam. */
  const portaisDasDisputas = useMemo(() => lances.map((l) => l.portal), [lances]);

  const selectedLance = useMemo(
    () => lances.find((l) => l.id === selectedId) ?? null,
    [lances, selectedId]
  );

  const disputeItems = useMemo(
    () => selectedLance?.itens ?? [],
    [selectedLance?.itens]
  );

  // O campo "Buscar item..." existia sem `value` nem `onChange`: digitava-se e
  // a tabela não mudava. Agora filtra de verdade, e zera ao trocar de disputa
  // para a busca de uma não esconder os itens da outra.
  const [buscaItem, setBuscaItem] = useState('');
  useEffect(() => {
    setBuscaItem('');
  }, [selectedId]);
  const itensVisiveis = useMemo(() => {
    const termo = buscaItem.trim().toLowerCase();
    if (!termo) return disputeItems;
    return disputeItems.filter((i) =>
      [i.numero, i.lote, i.descricao, i.marca, i.modelo].some((v) => String(v ?? '').toLowerCase().includes(termo)),
    );
  }, [disputeItems, buscaItem]);

  const [operations, setOperations] = useState<Operation[]>([]);
  const [operacoesCarregando, setOperacoesCarregando] = useState(false);

  /**
   * Monta a linha do tempo do que o robô fez NESTA disputa.
   *
   * Duas leituras, nesta ordem obrigatória: as sessões desta configuração de
   * lance e, só então, os lances daquelas sessões — `lances_historico` não
   * tem `lance_config_id`, o vínculo é pelo `sessao_id`. Sem sessão, não há o
   * que perguntar, e a segunda consulta é pulada.
   */
  useEffect(() => {
    if (!selectedId) {
      setOperations([]);
      return;
    }
    let cancelado = false;
    setOperacoesCarregando(true);

    (async () => {
      const { data: sessoes, error: erroSessoes } = await supabase
        .from('sessoes_lance_real')
        .select('id, status, resultado, erro, portal_nome, rodada_atual, valor_atual, created_at, updated_at')
        .eq('lance_config_id', selectedId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (cancelado) return;
      if (erroSessoes) {
        // Lista vazia sem explicação é indistinguível de "o robô nunca rodou".
        console.error('[robo-lances] carregar operações', erroSessoes.message);
        toast.error(`Não foi possível carregar as operações: ${erroSessoes.message}`, { duration: 12000 });
        setOperations([]);
        setOperacoesCarregando(false);
        return;
      }

      const linhasSessao = (sessoes || []) as Array<{
        id: string; status: string; resultado: string | null; erro: string | null;
        portal_nome: string; rodada_atual: number | null; valor_atual: number | null;
        created_at: string; updated_at: string;
      }>;

      const eventos: Operation[] = linhasSessao.map((s) => ({
        id: `sessao-${s.id}`,
        timestamp: new Date(s.created_at),
        acao: 'Sessão do robô',
        // `erro` preenchido é a única leitura segura de falha: `status` varia
        // por portal e `resultado` só existe depois do encerramento.
        resultado: s.erro ? 'erro' : s.resultado ? 'sucesso' : 'info',
        detalhes: [
          s.portal_nome,
          `situação: ${s.status}`,
          s.rodada_atual ? `rodada ${s.rodada_atual}` : null,
          s.resultado ? `resultado: ${s.resultado}` : null,
          // O `erro` da sessão é texto de máquina ("Signal timed out.") e às
          // vezes de bastidor (situação da conta usada no portal). Aqui vai o
          // resumo em linguagem de cliente, com o que fazer; o texto completo
          // fica no Admin Praefectus › Robô de Lances.
          s.erro
            ? (() => {
                const r = resumirErroParaCliente(s.erro);
                return `${r.texto} ${r.acao}.`;
              })()
            : null,
        ].filter(Boolean).join(' · '),
      }));

      if (linhasSessao.length > 0) {
        const { data: lances, error: erroLances } = await supabase
          .from('lances_historico')
          .select('id, valor, rodada, tipo, origem, timestamp_lance, sessao_id')
          .in('sessao_id', linhasSessao.map((s) => s.id))
          .order('timestamp_lance', { ascending: false })
          .limit(100);

        if (cancelado) return;
        if (erroLances) {
          console.error('[robo-lances] carregar lances da sessão', erroLances.message);
          toast.error(`Não foi possível carregar os lances: ${erroLances.message}`, { duration: 12000 });
        } else {
          for (const l of (lances || []) as Array<{
            id: string; valor: number; rodada: number; tipo: string;
            origem: string; timestamp_lance: string;
          }>) {
            eventos.push({
              id: `lance-${l.id}`,
              timestamp: new Date(l.timestamp_lance),
              acao: l.tipo === 'concorrente' ? 'Lance de concorrente' : 'Lance enviado',
              resultado: l.tipo === 'concorrente' ? 'info' : 'sucesso',
              detalhes: `${formatCurrency(Number(l.valor) || 0)} · rodada ${l.rodada} · origem ${l.origem}`,
            });
          }
        }
      }

      eventos.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setOperations(eventos);
      setOperacoesCarregando(false);
    })();

    return () => { cancelado = true; };
  }, [selectedId]);

  /**
   * Dados do processo vinculado, para o modal "Detalhes da licitação".
   *
   * O modal trazia Empresa, CNPJ, Órgão e UASG escritos à mão como `'—'`:
   * quatro campos que nunca mostraram nada e que davam a impressão de que o
   * sistema não tinha o dado. Empresa e CNPJ ele sempre teve (a empresa
   * ativa), UASG viaja na própria disputa, e o órgão está na licitação
   * vinculada — só ninguém ia buscar.
   *
   * A leitura só acontece com o modal aberto: é informação de consulta
   * eventual, e puxá-la a cada seleção de disputa seria uma consulta por
   * clique para uma tela que quase nunca se abre.
   */
  const [orgaoDoProcesso, setOrgaoDoProcesso] = useState<string | null>(null);
  const [orgaoCarregando, setOrgaoCarregando] = useState(false);

  useEffect(() => {
    if (!detailsOpen || !selectedLance?.licitacaoId) {
      setOrgaoDoProcesso(null);
      return;
    }
    let cancelado = false;
    setOrgaoCarregando(true);
    supabase
      .from('licitacoes')
      .select('orgao')
      .eq('id', selectedLance.licitacaoId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelado) return;
        if (error) console.error('[robo-lances] carregar órgão da licitação', error.message);
        setOrgaoDoProcesso((data as { orgao?: string | null } | null)?.orgao || null);
        setOrgaoCarregando(false);
      });
    return () => { cancelado = true; };
  }, [detailsOpen, selectedLance?.licitacaoId]);

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
        // Salvar grava a configuração e mais nada: nenhuma sessão é aberta e o
        // robô não começa. Só o painel de participações relê.
        else setVersaoDasDisputas((v) => v + 1);
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
    setVersaoDasDisputas((v) => v + 1);
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
      return;
    }

    // ─── O RÓTULO PROMETIA O QUE O CLIQUE NÃO FAZ (14/09/2026) ────────────
    // O menu dizia "Iniciar disputa" / "Pausar disputa", e o clique só grava
    // esta coluna: o robô não é iniciado nem parado (isso é "Enviar ao robô" e
    // o freio). O menu passou a dizer "Marcar como … (manual)", e o aviso
    // repete, porque quem clicou esperando o robô precisa saber na hora.
    setVersaoDasDisputas((v) => v + 1);
    toast.info(
      novo === 'ativo'
        ? 'Disputa marcada como em disputa (manual). O robô não foi iniciado.'
        : 'Disputa marcada como aguardando (manual). O robô não foi parado.',
      { duration: 8000 },
    );
  };

  /**
   * Grava o encerramento na própria disputa.
   *
   * "Encerrar como Venceu/Perdeu" mudava só o estado local: ao recarregar, a
   * disputa voltava ao status anterior, e o painel de participações — que lê o
   * banco — seguia mostrando em disputa algo que a pessoa acabara de encerrar.
   */
  const gravarEncerramento = async (id: string) => {
    const { error } = await supabase
      .from('robo_lances_disputas' as never)
      .update({ status: 'encerrado' } as never)
      .eq('id', id);
    if (error) {
      toast.error(`O encerramento não foi gravado na disputa: ${error.message}`, { duration: 12000 });
      return;
    }
    setVersaoDasDisputas((v) => v + 1);
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

  // O farol "Assista agora" e o caminho até a tela remota (VNC) saíram desta
  // tela em 14/09/2026, junto com a aba Agente: assistir ao robô pela tela
  // remota é ferramenta da operação Praefectus, e mora no Admin › Robô de
  // Lances. O cliente acompanha pelo painel de participações e pelos eventos.

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

  /**
   * Participação sem processo vinculado, aberta a partir do painel.
   *
   * Sem pasta para onde ir, o destino é a configuração que já existe nesta
   * tela: a disputa fica selecionada nas colunas abaixo, com "Editar
   * parâmetros" à direita. Seleciona (não alterna) — clicar de novo no painel
   * não pode desmarcar o que a pessoa pediu para abrir.
   */
  const abrirDisputaNaTela = useCallback((id: string) => {
    setSelectedId(id);
    window.requestAnimationFrame(() => {
      document
        .querySelector('[data-coluna="sessao-selecionada"]')
        ?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    });
  }, []);

    const handleEnviarAoRobo = async () => {
    if (!selectedLance) return;

    // Robô desligado pela empresa: o servidor recusaria de qualquer jeito, mas
    // a recusa dele chegaria depois de uma ida e volta, e com texto de
    // servidor. Aqui a pessoa lê o motivo e onde resolver. Migration pendente
    // e leitura não confirmada NÃO barram — nesses casos ninguém desligou nada.
    const ligadoOuDesligado = roboDaEmpresa.estado;
    if (ligadoOuDesligado.confirmado && !ligadoOuDesligado.migracaoPendente && !ligadoOuDesligado.ligado) {
      toast.error('O robô da empresa está desligado. Ligue-o no topo da tela para iniciar sessões.', {
        duration: 10000,
      });
      return;
    }

    const portalId = idDoPortal(selectedLance.portal);
    if (!portalId) {
      toast.error(
        `Portal "${selectedLance.portal}" não é um dos que o robô sabe operar.`,
        { duration: 10000 },
      );
      return;
    }

    // Reconhecer o portal não é o mesmo que o robô NO AR saber operá-lo.
    //
    // A pergunta ia ao healthcheck do agente, e a recusa listava ao cliente os
    // módulos instalados na VPS ("Hoje ele opera: comprasgov, bll…"). Agora vai
    // à `situacao-do-robo`, que responde a mesma coisa sem expor a máquina. A
    // lista é aceita no vocabulário do agente ou no do armazenamento, porque
    // os dois diferem justamente no Compras.gov. Sem resposta, não barra: o
    // servidor repete a validação e é a autoridade final.
    const suportados = situacaoDoRobo?.portais_suportados;
    if (suportados?.length && !agenteOpera(portalId, suportados) && !suportados.includes(portalId)) {
      toast.error(`O robô ainda não opera no portal ${nomeDoPortal(portalId)}.`, { duration: 12000 });
      return;
    }

    setEnviandoAoRobo(true);

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
              // Vínculo estável com `licitacao_itens` — o servidor confere se o
              // item ainda existe antes de gravar. Casar por número ou
              // descrição é o que a pasta do processo não pode fazer.
              licitacao_item_id: i.licitacaoItemId ?? null,
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
      //
      // Contrato do servidor (14/09/2026): recusa do agente vem como 502
      // `{ success: false, error }`, e robô desligado pela empresa como 409 —
      // nos dois, `error` já é a frase para mostrar. Sem corpo legível, a
      // frase de transporte ("non-2xx status code") vai ao console, não à tela.
      let motivo = (data as { error?: string } | null)?.error;

      if (!motivo && error) {
        const contexto = (error as { context?: Response }).context;
        if (contexto && typeof contexto.json === 'function') {
          const corpo = await contexto.json().catch(() => null);
          motivo = (corpo as { error?: string } | null)?.error;
        }
        // 409: o servidor diz que o robô está desligado. Se a tela ainda o
        // mostrava ligado (outra pessoa desligou, ou a leitura envelheceu),
        // relê agora — o selo do topo não pode contradizer a recusa.
        if (contexto?.status === 409) roboDaEmpresa.recarregar();
        if (!motivo) {
          console.error('[robo-lances] enviar-sessao sem motivo legível', contexto?.status, error.message);
          motivo = 'O robô não aceitou a sessão e não informou o motivo. Tente de novo ou fale com o suporte.';
        }
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
      // A exceção aqui é de transporte (rede, função fora do ar) — texto de
      // máquina. Vai ao console; a pessoa lê o que aconteceu e o que fazer.
      console.error('[robo-lances] enviar-sessao', e);
      toast.error('Não foi possível falar com o robô agora. Tente de novo em instantes.', {
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
    await gravarEncerramento(selectedLance.id);

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
    await gravarEncerramento(selectedLance.id);
    await postResultToMural(selectedLance, 'perdeu');
    setBottomTab('mural');
  };

  const filteredLances = lances.filter(
    (l) =>
      l.edital.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.portal.toLowerCase().includes(searchTerm.toLowerCase())
  );

  /* ── Selo de nível ──
     O selo "Nível 1" do cabeçalho virou o botão do modo de operação
     (`DialogoModoDeOperacao`), com o mesmo tom de risco e o nome do nível em
     texto. Com a tela reduzida a uma aba só, o atalho "ir para a disputa" que
     ele fazia perdeu o destino — e o seletor, que morava no estado vazio e na
     aba Configurações, passou a morar atrás dele. */

  /**
   * O menu "Ações" da disputa selecionada.
   *
   * Mora numa variável porque quem o DESENHA agora é a coluna da direita
   * (`PainelDeControle`), mas quem tem os handlers é esta página. Passar o
   * menu pronto evita repassar seis funções uma a uma — e evita que o painel
   * precise saber o que é encerrar, remover ou pausar uma disputa.
   */
  const menuDeAcoes = selectedLance ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full justify-center">
          <Settings className="w-4 h-4" aria-hidden="true" /> Ações <ChevronDown className="w-4 h-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setDetailsOpen(true)}>
          <Info className="w-4 h-4 mr-2" aria-hidden="true" /> Detalhes da licitação
        </DropdownMenuItem>
        {/* Só grava a fase — ver `handleToggleStatus`. Ícone de mão, não de
            play/pause: play e pause prometiam ligar e desligar o robô. Some
            quando a disputa está encerrada, porque ali o clique não fazia nada. */}
        {proximoStatus(selectedLance.status) && (
          <DropdownMenuItem
            onClick={() => handleToggleStatus(selectedLance.id)}
            className="flex-col items-start gap-0.5"
          >
            <span className="inline-flex items-center">
              <Hand className="w-4 h-4 mr-2" aria-hidden="true" />
              {selectedLance.status === 'aguardando'
                ? 'Marcar como em disputa (manual)'
                : 'Marcar como aguardando (manual)'}
            </span>
            <span className="pl-6 text-xs text-muted-foreground">
              Só registra a fase. Não inicia nem para o robô.
            </span>
          </DropdownMenuItem>
        )}
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
  ) : null;

  /**
   * "Editar parâmetros" saiu do menu e virou gatilho de verdade.
   *
   * Era um `<DropdownMenuItem>` SEM `onClick`: clicar nele fechava o menu e
   * não acontecia nada. Pior, a capacidade já existia — `ConfigurarLanceDialog`
   * aceita `editingLance` desde sempre e nenhuma tela passava esse prop. Era
   * função existente inacessível por trás de um botão sem destino, as duas
   * coisas que o padrão visual proíbe na mesma linha.
   *
   * Fora do menu porque um `Dialog` dentro de um item de menu desmonta junto
   * com o menu ao fechar, e o diálogo nunca chega a abrir.
   */
  const gatilhoEditar = selectedLance && podeOperar ? (
    <ConfigurarLanceDialog
      key={selectedLance.id}
      processoAtivoId={processoId}
      editingLance={selectedLance}
      onSave={handleSaveLance}
      trigger={
        <Button variant="outline" className="w-full justify-center">
          <Edit2 className="w-4 h-4" aria-hidden="true" /> Editar parâmetros
        </Button>
      }
    />
  ) : null;

  return (
    <AppLayout>
      {/* Declara a pasta de origem e devolve o caminho de volta. Sem px-4: o
          contêiner da página já aplica a margem lateral, e o padding extra
          encolhia a barra em relação ao cabeçalho logo abaixo. */}
      <div className="mb-3">
        <ProcessoContextoBanner />
      </div>

        {/* ── A TELA DO CLIENTE (14/09/2026) ──────────────────────────────────
            As abas Agente, Portais e Configurações saíram. Mostravam ao
            administrador da EMPRESA o que é da operação da PLATAFORMA: endereço,
            chave e versão do agente, RAM, slots, healthcheck, teste do freio,
            tela remota, simulação, trilha de auditoria encadeada e o nome do
            fornecedor de IA. Tudo isso mora agora no Admin Praefectus › Robô de
            Lances.

            O que ficou é o que a empresa decide, na ordem em que ela pergunta:
            o robô está ligado e disponível? (cabeçalho) · de qual empresa é
            este robô, e o acesso aos portais? (faixa da empresa) · há aviso da
            operação? (faixa de avisos) · em que fase está cada participação?
            (painel) · e a configuração de cada disputa (ferramentas). */}
        <CabecalhoDoRobo
          empresaId={empresaAtiva?.id}
          estado={roboDaEmpresa.estado}
          podeOperar={podeOperar}
          aoAlterarLigado={aoAlterarLigado}
          aoRelerLigado={roboDaEmpresa.recarregar}
          modo={
            <DialogoModoDeOperacao
              nivel={nivelAutomacao}
              podeAlterar={isAdmin}
              aoAlterar={handleNivelChange}
            />
          }
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
        />

        {/* ── AS TRÊS COLUNAS ──────────────────────────────────────────────
            Composição exigida pela referência aprovada e por
            `docs/padrao-visual-gestao.md`: sessões à esquerda, sessão
            selecionada no centro, checklist e ações à direita.

            Antes eram duas — lista e um centro que acumulava identidade da
            disputa, botões, tabela, risco e painel de abas na mesma pilha. Com
            tudo empilhado, o estado do robô, o estado do portal e o dinheiro
            autorizado se liam como um bloco só.

            Uma árvore única, não duas: a quebra para uma coluna abaixo de
            1280px é do CSS grid. Duplicar a árvore com `hidden xl:block`
            renderizaria os mesmos ids de campo duas vezes.

            `items-start` para as colunas não esticarem à altura da mais alta —
            o painel da direita costuma ser o mais alto, e sem isso a lista da
            esquerda ganhava um vazio do tamanho do checklist. */}
        <div className="flex min-w-0 flex-col gap-6">
          {/* Primeiro de tudo quando existe: o robô parado esperando um código
              que o portal mandou à empresa. O código vale segundos. Sem pedido,
              não desenha nada. Sem tela remota — ela é da operação Praefectus. */}
          <PedidoDoRobo />

          <div className="flex min-w-0 flex-col gap-3">
            <FaixaDaEmpresa
              empresa={empresaAtiva}
              isAdmin={isAdmin}
              avisos={avisosDosPortais.avisos}
              erroDosAvisos={avisosDosPortais.erro}
              aoRecarregarAvisos={() => { avisosDosPortais.recarregar(); }}
            />
            <AvisosDosPortais avisos={avisosDosPortais.avisos} portaisDasDisputas={portaisDasDisputas} />
          </div>

          {/* ── PAINEL DE PARTICIPAÇÕES (14/09/2026) ──────────────────────────
              Primeiro conteúdo da aba: responde "em que fase está cada
              participação e o que o robô está fazendo nela" antes de qualquer
              ferramenta. Com processo aberto, mostra só as dele — o mesmo
              recorte que a lista de disputas abaixo já fazia. */}
          <PainelDeParticipacoes
            empresaId={empresaAtiva?.id ?? null}
            licitacaoId={processoId}
            aoAbrirDisputaSemProcesso={abrirDisputaNaTela}
            sinalDeRecarga={versaoDasDisputas}
          />

          <section
            aria-labelledby="titulo-ferramentas-da-disputa"
            className="flex min-w-0 flex-col gap-3 border-t border-border pt-5"
          >
            <div>
              <h2 id="titulo-ferramentas-da-disputa" className="g-titulo-secao text-foreground">
                Ferramentas da disputa
              </h2>
              <p className="g-meta text-muted-foreground">
                Selecione uma disputa para configurar, enviar ao robô e acompanhar os eventos.
              </p>
            </div>
          <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[18rem_minmax(0,1fr)_var(--g-painel)]">
          {/* ── COLUNA 1 · SESSÕES ─────────────────────────────────────────
              Abaixo de 1280px vira a faixa de cima, com a lista limitada em
              altura para não empurrar a sessão selecionada para fora da tela. */}
          <aside
            data-coluna="sessoes"
            aria-label="Sessões do robô"
            className="g-cartao flex min-w-0 flex-col overflow-hidden"
          >
            <div className="p-4 border-b border-border space-y-3">
              <h2 className="g-titulo-secao text-foreground">Sessões</h2>
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
            <div className="max-h-80 overflow-y-auto xl:max-h-[calc(100vh-20rem)]">
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

          {/* ── COLUNA 2 · SESSÃO SELECIONADA ──────────────────────────────
              Só o que descreve a disputa em si: identidade, conferência dos
              itens, tabela, risco e eventos. As decisões sobre ela (enviar,
              parar, autorizar) migraram para a coluna da direita. */}
          <section
            data-coluna="sessao-selecionada"
            aria-label="Sessão selecionada"
            className="g-cartao flex min-w-0 flex-col overflow-hidden"
          >
            {/* Simultaneous disputes summary bar */}
            <DisputasResumo lances={lances} onSelect={alternarSelecao} selectedId={selectedId} />

            {!selectedLance ? (
              /* O seletor de nível saiu daqui (14/09/2026): mora no botão do
                 modo de operação, no topo. No estado vazio ele disputava a
                 atenção com a instrução de selecionar uma disputa. */
              <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
                <EstadoVazio
                  icone={<Target />}
                  titulo="Selecione ou crie uma disputa"
                  descricao={'Abra uma disputa da lista ao lado ou use "Nova sessão", no topo da tela, para gerenciar os lances.'}
                  className="py-0"
                />
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
                  {/* O que sobrou aqui é o que IDENTIFICA a disputa. Freio,
                      envio, tela remota, autorização e o menu "Ações" foram
                      para a coluna da direita: eram decisões sobre a sessão
                      espremidas na mesma linha que o nome dela, e a leitura
                      misturava "o que é isto" com "o que faço com isto".
                      Nenhum comportamento mudou — mesmos papéis, mesmos
                      diálogos, mesmos avisos. */}
                  {disputeItems.length > 0 && (
                    <div className="relative w-full sm:w-48 shrink-0">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                      <Input
                        placeholder="Buscar item..."
                        aria-label="Buscar item por número, lote, descrição, marca ou modelo"
                        value={buscaItem}
                        onChange={(e) => setBuscaItem(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  )}
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
                  ) : itensVisiveis.length === 0 ? (
                    <EstadoVazio
                      icone={<Search />}
                      titulo="Nenhum item corresponde à busca"
                      descricao={`Nada com "${buscaItem.trim()}" no número, lote, descrição, marca ou modelo.`}
                      tamanho="compacto"
                    />
                  ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted">
                        <TableHead className="w-12 text-center">Item</TableHead>
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
                      {/* A coluna de ações por item saiu (14/09/2026). "Enviar
                          lance" e "Ver histórico" eram itens de menu sem
                          `onClick`: fechavam o menu e nada acontecia. Envio de
                          lance não está liberado em portal nenhum, e o
                          histórico que existe é da disputa inteira (aba
                          Operações), não por item — um atalho por item
                          prometeria um recorte que o dado não tem. */}
                      {itensVisiveis.map((item) => (
                        <TableRow key={item.numero}>
                          <TableCell className="text-center font-medium tabular-nums">{item.numero}</TableCell>
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

                {/* ── Estratégia sugerida para ESTA disputa ──
                    Veio da antiga aba Configurações, onde recebia a disputa
                    selecionada mas ficava a uma aba de distância dela. */}
                <div className="px-4 py-4 border-t border-border">
                  <EstrategiaIAPanel lance={selectedLance} />
                </div>

                {/* ── EIXO 6 · EVENTOS — "o que já aconteceu?" ──────────────
                    O sexto eixo do comando. Fica no centro, e não na coluna da
                    direita, porque é o único que precisa de largura: mural e
                    operações são leitura demorada, não resposta de relance. O
                    rótulo da seção nomeia o eixo, para que ele não se confunda
                    com o estado da sessão (que diz o que está acontecendo AGORA,
                    e mora à direita).

                    Simulação e Auditoria saíram em 14/09/2026 — ferramentas da
                    operação Praefectus, hoje no Admin › Robô de Lances.

                    Cada painel só monta quando ativo — o mesmo que o
                    `bottomTab === …` fazia à mão. */}
                <div className="border-t border-border">
                  <Tabs
                    value={bottomTab}
                    onValueChange={(v) => setBottomTab(v as 'mural' | 'operacoes')}
                  >
                    <div className="px-4 pt-4 space-y-2">
                      <h3 className="g-titulo-secao text-foreground">Eventos</h3>
                      <TabsList>
                        <TabsTrigger value="mural">
                          <MessageSquare className="w-4 h-4 mr-1.5" aria-hidden="true" /> Mural
                        </TabsTrigger>
                        <TabsTrigger value="operacoes">
                          <ListChecks className="w-4 h-4 mr-1.5" aria-hidden="true" /> Operações
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

                    {/* Ligada a `sessoes_lance_real` + `lances_historico` —
                        ver o comentário do tipo `Operation`. Antes o array
                        nunca era preenchido e o estado vazio era permanente. */}
                    <TabsContent value="operacoes" className="m-0 p-4 space-y-2 max-h-64 overflow-y-auto">
                      {operacoesCarregando ? (
                        <p className="text-sm text-muted-foreground" role="status">
                          Consultando as sessões e os lances desta disputa…
                        </p>
                      ) : operations.length === 0 ? (
                        <EstadoVazio
                          icone={<ListChecks />}
                          titulo="O robô ainda não operou nesta disputa"
                          descricao='Use "Enviar ao robô" para abrir uma sessão. Cada sessão e cada lance aparecem aqui.'
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
          </section>

          {/* ── COLUNA 3 · CHECKLIST E AÇÕES ───────────────────────────────
              Limites, estado da sessão e eventos são blocos do painel. O
              checklist entra na versão do CLIENTE (14/09/2026): acesso aos
              portais, certificado e uma linha de disponibilidade do robô —
              conexão dos portais e prontidão do agente são da operação
              Praefectus e saíram desta tela.

              Sem disputa selecionada, só o que independe dela: se as
              credenciais valem e se o robô está disponível são perguntas da
              empresa, não da sessão. Limites e estado da sessão não têm o que
              dizer, e inventar um "R$ 0,00" ou um "sem robô de pé" ali seria
              afirmar sobre uma disputa que não existe.

              `PainelDeControle` sem `onAssistir` nem `onVerEventos`: a tela
              remota e a trilha de auditoria não existem para o cliente, e
              botão sem destino é defeito. */}
          <aside
            data-coluna="controle"
            aria-label="Checklist e ações"
            className="flex min-w-0 flex-col gap-4"
          >
            {selectedLance ? (
              <PainelDeControle
                lance={selectedLance}
                nivel={nivelAutomacao}
                podeOperar={podeOperar}
                isAdmin={isAdmin}
                limiteFinanceiro={limiteFinanceiro}
                limiteCarregado={limiteCarregado}
                sessaoViva={sessaoVivaDesta}
                desfechos={estadoDoRobo?.desfechos || []}
                paradaEmergencial={paradaEmergencial}
                enviandoAoRobo={enviandoAoRobo}
                estrategiaAutorizada={estrategiaAutorizada}
                onEnviarAoRobo={handleEnviarAoRobo}
                onAutorizarEstrategia={() => setAutorizacaoOpen(true)}
                onParadaEmergencial={handleParadaEmergencial}
                modoDoChecklist="cliente"
                acoes={<>{gatilhoEditar}{menuDeAcoes}</>}
              />
            ) : (
              <AtivacaoChecklist modo="cliente" somenteLeitura={!isAdmin} />
            )}
          </aside>
          </div>
          </section>
        </div>

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
              {/* Nenhum travessão mudo: ou o dado real, ou `ValorIndisponivel`
                  com a razão de ele não estar aqui. Quatro destas linhas eram
                  `'—'` fixo no código — Empresa, CNPJ, Órgão e UASG —, e o
                  travessão sem explicação é indistinguível de um dado que o
                  sistema perdeu. */}
              {[
                {
                  icon: Building2, label: 'Empresa',
                  value: empresaAtiva?.razao_social
                    ?? <ValorIndisponivel razao="Nenhuma empresa ativa selecionada" />,
                },
                {
                  icon: Hash, label: 'CNPJ',
                  value: empresaAtiva?.cnpj
                    ?? <ValorIndisponivel razao="Nenhuma empresa ativa selecionada" />,
                },
                { icon: Globe, label: 'Portal', value: selectedLance.portal },
                { icon: Hash, label: 'Licitação', value: selectedLance.edital },
                {
                  icon: Building2, label: 'Órgão',
                  value: orgaoCarregando
                    ? <ValorIndisponivel razao="Consultando o processo vinculado" />
                    : orgaoDoProcesso
                    ?? <ValorIndisponivel
                        razao={selectedLance.licitacaoId
                          ? 'O processo vinculado não registra o órgão'
                          : 'Disputa sem processo do Kanban vinculado'}
                      />,
                },
                {
                  icon: Hash, label: 'UASG',
                  // Viaja na própria disputa desde que o Compras.gov passou a
                  // exigir a UASG para desambiguar número de compra repetido.
                  value: selectedLance.uasg
                    ?? <ValorIndisponivel razao="UASG não informada no cadastro da disputa" />,
                },
                { icon: CalendarDays, label: 'Data de abertura', value: selectedLance.horario || <ValorIndisponivel razao="Horário da sessão não cadastrado" /> },
                {
                  icon: FileText, label: 'Sistema de Registro de Preços',
                  // Dizia "Não" para toda licitação. O sistema não guarda essa
                  // informação em lugar nenhum — afirmar "Não" é inventar um
                  // dado sobre o edital, e SRP muda a leitura do resultado.
                  value: <ValorIndisponivel razao="Não apurado — o cadastro não registra SRP" />,
                },
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
