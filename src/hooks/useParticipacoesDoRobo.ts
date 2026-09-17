/**
 * Participações do robô — o carregamento que a aba "Robô de Lances" do
 * processo e o painel geral compartilham.
 *
 * Um único lugar lê disputa, processo, sessão, lances e capacidade do agente,
 * e entrega cada participação já projetada (`situacao-da-participacao.ts`).
 * Duas telas lendo cada uma do seu jeito foi como o painel e a pasta passaram
 * a discordar sobre o que está "em disputa".
 *
 * ── Funciona antes e depois da migration 20260914000002 ─────────────────────
 *
 * As colunas novas (`precificacao_versao_id`, `parada_*`, `disputa_id`) não
 * são pedidas pelo nome: as consultas usam `*` e filtram só por colunas que já
 * existiam. Publicar a tela antes de rodar o SQL não derruba o robô — a
 * participação só aparece sem versão aprovada, que é exatamente a verdade
 * naquele momento.
 *
 * ── Capacidade do portal vem do AGENTE ─────────────────────────────────────
 *
 * A lista de portais com lance liberado mora no código do agente (CommonJS,
 * roda na VPS). O site não pode importá-la, e mesmo que pudesse diria o que o
 * REPOSITÓRIO supõe, não o que o serviço instalado faz. Lê-se o que o agente
 * declarou em `agente_externo_config.capacidades`. Sem declaração: nenhum
 * portal liberado — a tela diz "somente monitoramento", nunca simula envio.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  portaisLiberadosDeclarados,
  projetarParticipacao,
  type DisputaParaProjecao,
  type Participacao,
  type SessaoParaProjecao,
} from '@/lib/robo/situacao-da-participacao';

export interface ProcessoDaParticipacao {
  id: string;
  numero: string;
  orgao: string;
  objeto: string;
  data_abertura: string | null;
  operador_id: string | null;
  status: string | null;
}

export interface DisputaCarregada extends DisputaParaProjecao {
  empresa_id: string;
  edital: string;
  tipo_disputa: string | null;
  horario: string | null;
  modo_automatico: boolean | null;
  valor_referencia: number | null;
  decremento_min: number | null;
  decremento_percentual: number | null;
  intervalo_segundos: number | null;
  max_lances: number | null;
  created_at: string;
  updated_at: string;
  limites_confirmados_versao_id?: string | null;
  limites_confirmados_em?: string | null;
}

export interface SessaoCarregada extends SessaoParaProjecao {
  licitacao_id: string | null;
  lance_config_id: string | null;
  disputa_id?: string | null;
  portal_nome: string | null;
  valor_atual: number | null;
  rodada_atual: number | null;
  created_at: string;
}

export interface LanceConfirmado {
  sessao_id: string;
  valor: number;
  rodada: number;
  tipo: string;
  timestamp_lance: string;
}

export interface ParticipacaoCarregada {
  disputa: DisputaCarregada;
  processo: ProcessoDaParticipacao | null;
  sessao: SessaoCarregada | null;
  /** Último lance PRÓPRIO registrado pelo agente (origem real). */
  ultimoLanceProprio: LanceConfirmado | null;
  /** Menor lance que o agente leu na sala, próprio ou concorrente. */
  melhorLanceInformado: LanceConfirmado | null;
  projecao: Participacao;
}

export interface CapacidadeDoServico {
  portaisComLanceLiberado: string[];
  /** 'agente' quando algum agente declarou capacidades legíveis por esta conta. */
  fonte: 'agente' | 'nao_verificada';
  verificadaEm: string | null;
}

export interface EstadoDasParticipacoes {
  participacoes: ParticipacaoCarregada[];
  carregando: boolean;
  erro: string | null;
  semEmpresa: boolean;
  /** Quando os dados foram lidos. A tela exibe com fuso. */
  lidoEm: Date | null;
  capacidade: CapacidadeDoServico;
  recarregar: () => Promise<void>;
}

export interface OpcoesDasParticipacoes {
  empresaId: string | null;
  /** Presente: só as participações deste processo. */
  licitacaoId?: string | null;
  /** Relê a cada N segundos. Ausente: só sob demanda. */
  intervaloSegundos?: number | null;
}

// `types.ts` está congelado em 16/08 e não conhece as colunas de 14/09.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tabela = (nome: string): any => (supabase as any).from(nome);

const SEM_CAPACIDADE: CapacidadeDoServico = { portaisComLanceLiberado: [], fonte: 'nao_verificada', verificadaEm: null };

interface Bruto {
  disputas: DisputaCarregada[];
  processos: Map<string, ProcessoDaParticipacao>;
  sessoes: SessaoCarregada[];
  lances: LanceConfirmado[];
  capacidade: CapacidadeDoServico;
}

/** A sessão de uma disputa: pelo vínculo explícito; pelo processo só quando não há ambiguidade. */
function sessaoDaDisputa(d: DisputaCarregada, sessoes: SessaoCarregada[], disputasDoProcesso: number): SessaoCarregada | null {
  const maisRecente = (lista: SessaoCarregada[]) =>
    lista.sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;

  const explicitas = sessoes.filter((s) => s.disputa_id === d.id || s.lance_config_id === d.id);
  if (explicitas.length) return maisRecente(explicitas);
  if (d.licitacao_id && disputasDoProcesso === 1) {
    return maisRecente(sessoes.filter((s) => s.licitacao_id === d.licitacao_id));
  }
  return null;
}

export function useParticipacoesDoRobo({
  empresaId,
  licitacaoId = null,
  intervaloSegundos = null,
}: OpcoesDasParticipacoes): EstadoDasParticipacoes {
  const [bruto, setBruto] = useState<Bruto | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [lidoEm, setLidoEm] = useState<Date | null>(null);
  const [agora, setAgora] = useState(() => new Date());
  const pedido = useRef(0);

  const recarregar = useCallback(async () => {
    const meu = ++pedido.current;
    if (!empresaId) {
      setBruto(null);
      setErro(null);
      setCarregando(false);
      return;
    }
    setCarregando(true);

    try {
      let consulta = tabela('robo_lances_disputas').select('*').eq('empresa_id', empresaId);
      if (licitacaoId) consulta = consulta.eq('licitacao_id', licitacaoId);
      const { data: disputas, error: e1 } = await consulta.order('updated_at', { ascending: false });
      if (e1) throw e1;

      const listaDisputas = (disputas ?? []) as DisputaCarregada[];
      const idsProcesso = [...new Set(listaDisputas.map((d) => d.licitacao_id).filter(Boolean))] as string[];
      const idsDisputa = listaDisputas.map((d) => d.id);

      const processos = new Map<string, ProcessoDaParticipacao>();
      if (idsProcesso.length) {
        const { data, error } = await tabela('licitacoes')
          .select('id, numero, orgao, objeto, data_abertura, operador_id, status')
          .in('id', idsProcesso);
        if (error) throw error;
        (data ?? []).forEach((p: ProcessoDaParticipacao) => processos.set(p.id, p));
      }

      let sessoes: SessaoCarregada[] = [];
      if (idsDisputa.length) {
        const partes = [`lance_config_id.in.(${idsDisputa.join(',')})`];
        if (idsProcesso.length) partes.push(`licitacao_id.in.(${idsProcesso.join(',')})`);
        const { data, error } = await tabela('sessoes_lance_real').select('*').or(partes.join(','));
        if (error) throw error;
        sessoes = (data ?? []) as SessaoCarregada[];
      }

      let lances: LanceConfirmado[] = [];
      if (sessoes.length) {
        const { data, error } = await tabela('lances_historico')
          .select('sessao_id, valor, rodada, tipo, timestamp_lance')
          .in('sessao_id', sessoes.map((s) => s.id))
          .eq('origem', 'real')
          .order('timestamp_lance', { ascending: false })
          .limit(1000);
        if (error) throw error;
        lances = (data ?? []) as LanceConfirmado[];
      }

      // Capacidade: falha aqui não derruba a tela — só deixa a capacidade
      // "não verificada", que já bloqueia envio.
      let capacidade = SEM_CAPACIDADE;
      const { data: agentes } = await tabela('agente_externo_config').select('capacidades, updated_at');
      // A lista vive em `capacidades.saude` (o /health guardado pelo webhook).
      const declarados: string[] = (agentes ?? []).flatMap(
        (a: { capacidades?: unknown }) => portaisLiberadosDeclarados(a?.capacidades) ?? [],
      );
      if ((agentes ?? []).some((a: { capacidades?: unknown }) => a?.capacidades && typeof a.capacidades === 'object')) {
        const maisRecente = (agentes as Array<{ updated_at?: string }>)
          .map((a) => a.updated_at ?? '')
          .sort()
          .pop();
        capacidade = { portaisComLanceLiberado: [...new Set(declarados)], fonte: 'agente', verificadaEm: maisRecente || null };
      }

      if (meu !== pedido.current) return;
      setBruto({ disputas: listaDisputas, processos, sessoes, lances, capacidade });
      setErro(null);
      setLidoEm(new Date());
      setAgora(new Date());
    } catch (e) {
      if (meu !== pedido.current) return;
      // Falha silenciosa é proibida: a mensagem real vai para a tela, com retry.
      setErro((e as { message?: string })?.message || 'Não foi possível carregar as participações.');
    } finally {
      if (meu === pedido.current) setCarregando(false);
    }
  }, [empresaId, licitacaoId]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  // Relógio da tela: sem ele, "operando" continuaria "operando" dez minutos
  // depois do último sinal, só porque ninguém recarregou.
  useEffect(() => {
    const id = window.setInterval(() => setAgora(new Date()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!intervaloSegundos || intervaloSegundos <= 0) return;
    const id = window.setInterval(() => { recarregar(); }, intervaloSegundos * 1000);
    return () => window.clearInterval(id);
  }, [intervaloSegundos, recarregar]);

  const participacoes = useMemo<ParticipacaoCarregada[]>(() => {
    if (!bruto) return [];
    const porProcesso = new Map<string, number>();
    bruto.disputas.forEach((d) => {
      if (d.licitacao_id) porProcesso.set(d.licitacao_id, (porProcesso.get(d.licitacao_id) ?? 0) + 1);
    });

    return bruto.disputas.map((disputa) => {
      const sessao = sessaoDaDisputa(disputa, [...bruto.sessoes], porProcesso.get(disputa.licitacao_id ?? '') ?? 0);
      const daSessao = sessao ? bruto.lances.filter((l) => l.sessao_id === sessao.id) : [];
      const ultimoLanceProprio = daSessao.find((l) => l.tipo === 'meu') ?? null;
      const melhorLanceInformado = daSessao.length
        ? daSessao.reduce((menor, l) => (Number(l.valor) < Number(menor.valor) ? l : menor))
        : null;

      return {
        disputa,
        processo: disputa.licitacao_id ? bruto.processos.get(disputa.licitacao_id) ?? null : null,
        sessao,
        ultimoLanceProprio,
        melhorLanceInformado,
        projecao: projetarParticipacao(disputa, sessao, {
          agora,
          portaisComLanceLiberado: bruto.capacidade.portaisComLanceLiberado,
        }),
      };
    });
  }, [bruto, agora]);

  return {
    participacoes,
    carregando,
    erro,
    semEmpresa: !empresaId,
    lidoEm,
    capacidade: bruto?.capacidade ?? SEM_CAPACIDADE,
    recarregar,
  };
}
