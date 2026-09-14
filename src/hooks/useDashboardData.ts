import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { STATUS_GANHO, STATUS_PERDIDO } from '@/lib/licitacao/recortes-do-painel';

/**
 * Os números que o painel lê do banco.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DUAS MUDANÇAS ESTRUTURAIS (13/09/2026), as duas por medição
 * ─────────────────────────────────────────────────────────────────────────
 *
 * 1. ~35 IDAS AO BANCO PARA MOSTRAR 5 NÚMEROS.
 *    `loadAll` disparava, a cada montagem e a cada evento de realtime:
 *      loadKpis        7 consultas em `licitacoes` + 2 no cache do PNCP
 *      loadChartMensal 6 meses × 4 consultas = 24 idas, EM SÉRIE por mês
 *      loadRecentes    1
 *      loadModalidades 1
 *    O painel renderizava só `kpis`. `chartMensal`, `chartValor`, `recentes`
 *    e `modalidades` eram calculados e jogados fora — e o único consumidor do
 *    hook em todo o repo é `pages/Index.tsx` (conferido antes de mexer;
 *    `Analytics.tsx` usa o OUTRO hook, `useAnalyticsData`).
 *    Agora tudo o que a tela não desenha só é buscado se quem chama pedir
 *    (`useDashboardData({ incluirDesempenho: true })`), e a forma do retorno
 *    continua a mesma para não quebrar consumidor futuro.
 *    As contagens de processo saíram do caminho padrão por um segundo motivo:
 *    elas refaziam em SQL a mesma conta que `useAnalyticsData` — montado na
 *    MESMA tela — já faz sobre linhas que ele acabou de baixar.
 *
 * 2. NÚMERO NÃO APURADO NÃO É ZERO.
 *    `editaisAbertos` nascia 0 e o `catch` silencioso do cache do PNCP o
 *    deixava em 0: cache fora do ar e cache vazio davam a MESMA tela
 *    ("0 editais vigentes"), que é a falha silenciosa do princípio 3. E
 *    `propostasEnviadas`, `taxaVitoria` e `roiMedio` passariam a devolver 0
 *    quando não fossem apurados, afirmando derrota onde não houve medição.
 *    Todos esses campos agora são `number | null`, e `null` quer dizer
 *    "não apurado" — quem exibe mostra "—", nunca 0.
 *
 * O que sobra no caminho padrão são 3 consultas: editais que entraram hoje no
 * monitoramento, contagem do cache do PNCP e o carimbo do último sync.
 */

type KpiData = {
  /** Processos da empresa na tabela `licitacoes`. Só com `incluirDesempenho`. */
  licitacoesMonitoradas: number | null;
  /** Soma do ganho dos últimos 6 meses (adjudicado, ou estimado na falta dele). Só com `incluirDesempenho`. */
  valorTotalGanho: number | null;
  /** Editais que o usuário passou a monitorar hoje. */
  licitacoesHoje: number;
  /** Editais vigentes no cache do PNCP. `null` = não foi possível apurar. */
  editaisAbertos: number | null;
  /** Fim da última sincronização do PNCP (ISO). `null` = nunca sincronizou / não apurado. */
  ultimaSincronizacao: string | null;
  /** Só com `incluirDesempenho`. `null` = não apurado. */
  propostasEnviadas: number | null;
  /** Percentual 0–100. Só com `incluirDesempenho`. `null` = não apurado. */
  taxaVitoria: number | null;
  /** Percentual 0–100 de economia sobre o estimado. Só com `incluirDesempenho`. */
  roiMedio: number | null;
};

type ChartMensal = {
  mes: string;
  vitorias: number;
  derrotas: number;
  propostas: number;
};

type ChartValor = {
  mes: string;
  valor: number;
};

type LicitacaoRecente = {
  id: string;
  numero: string;
  orgao: string;
  objeto: string;
  status: string;
  valor_estimado: number | null;
  uf: string | null;
  municipio: string | null;
  data_encerramento: string | null;
};

type ModalidadeItem = {
  name: string;
  value: number;
  fill: string;
};

interface OpcoesDoPainel {
  /**
   * Busca também a série mensal, o valor mês a mês, os recentes e a quebra por
   * modalidade — mais a taxa de vitória, o ROI e as propostas enviadas.
   * São ~30 idas ao banco: só ligue em tela que de fato desenhe isso.
   */
  incluirDesempenho?: boolean;
}

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const MODALIDADE_COLORS: Record<string, string> = {
  'Pregão Eletrônico': 'hsl(210, 100%, 40%)',
  'Concorrência': 'hsl(174, 72%, 40%)',
  'Tomada de Preços': 'hsl(38, 92%, 50%)',
  'Dispensa': 'hsl(220, 14%, 60%)',
  'Inexigibilidade': 'hsl(142, 71%, 45%)',
};

/** As duas colunas de valor que toda soma de ganho usa. */
type ValoresDoGanho = { valor_estimado: number | null; valor_adjudicado: number | null };

const KPIS_VAZIOS: KpiData = {
  licitacoesMonitoradas: null,
  valorTotalGanho: null,
  licitacoesHoje: 0,
  editaisAbertos: null,
  ultimaSincronizacao: null,
  propostasEnviadas: null,
  taxaVitoria: null,
  roiMedio: null,
};

export function useDashboardData(opcoes: OpcoesDoPainel = {}) {
  const incluirDesempenho = opcoes.incluirDesempenho ?? false;
  const { user } = useAuth();
  const { empresaAtiva, todasSelecionadas } = useEmpresa();
  const [kpis, setKpis] = useState<KpiData>(KPIS_VAZIOS);
  const [chartMensal, setChartMensal] = useState<ChartMensal[]>([]);
  const [chartValor, setChartValor] = useState<ChartValor[]>([]);
  const [recentes, setRecentes] = useState<LicitacaoRecente[]>([]);
  const [modalidades, setModalidades] = useState<ModalidadeItem[]>([]);
  const [loading, setLoading] = useState(true);
  /**
   * Mensagem real do banco quando a carga falha. O hook descartava TODO
   * `error` das consultas (só desestruturava `count`/`data`): RLS negando,
   * rede caída ou coluna renomeada viravam zeros, e o painel anunciava uma
   * empresa sem processos. Princípio 3 do CLAUDE.md — falha silenciosa é
   * proibida —, por isso a mensagem sobe e a tela oferece "Tentar novamente".
   */
  const [erro, setErro] = useState<string | null>(null);

  const empresaId = empresaAtiva?.id;

  const loadAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    /* Escopo por empresa, como a listagem de processos do painel. Vai como
       `.match()` de um objeto — vazio em "Todas as Empresas" — em vez de um
       `.eq` condicional: o `.eq` exigia um genérico sobre o construtor de
       consulta do supabase-js, e o tipo dele é recursivo o bastante para o
       compilador desistir ("type instantiation is excessively deep"). */
    const escopo = !todasSelecionadas && empresaId ? { empresa_id: empresaId } : {};

    const contagem = () =>
      supabase.from('licitacoes').select('*', { count: 'exact', head: true }).match(escopo);
    const linhas = (colunas: string) =>
      supabase.from('licitacoes').select(colunas).match(escopo);

    const hojeISO = new Date().toISOString().split('T')[0];

    /* O caminho padrão pergunta ao banco só o que o painel desenha sem pedir
       desempenho: quantos editais entraram HOJE no monitoramento do usuário.
       O resto de `licitacoes` o painel já tem em memória por `useAnalyticsData`
       — as contagens que existiam aqui refaziam, em SQL, a mesma conta que
       aquele hook faz sobre linhas já baixadas. */
    const editaisDoDia = await supabase
      .from('monitoramento_editais')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', `${hojeISO}T00:00:00`);

    if (editaisDoDia.error) {
      setErro(editaisDoDia.error.message);
      setLoading(false);
      return;
    }
    setErro(null);

    // Cache do PNCP e carimbo do sync. `null` quando a leitura falha — é a
    // diferença entre "não há edital vigente" e "não consegui olhar".
    let editaisAbertos: number | null = null;
    let ultimaSincronizacao: string | null = null;
    try {
      const [cache, syncLog] = await Promise.all([
        supabase
          .from('pncp_editais_cache')
          .select('*', { count: 'exact', head: true })
          .gte('data_encerramento_proposta', new Date().toISOString()),
        supabase
          .from('pncp_sync_log')
          .select('concluido_em')
          // 'parcial' também conta como sync: os workers terminam parcial
          // quando o PNCP devolve algum 429, e o selo dizia "Aguardando sync"
          // com a coleta funcionando.
          .in('status', ['sucesso', 'parcial'])
          .order('concluido_em', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (!cache.error) editaisAbertos = cache.count ?? 0;
      ultimaSincronizacao = syncLog.data?.concluido_em ?? null;
    } catch {
      // Tabela ausente no ambiente — segue `null`, e a tela diz que não apurou.
    }

    let licitacoesMonitoradas: number | null = null;
    let valorTotalGanho: number | null = null;
    let propostasEnviadas: number | null = null;
    let taxaVitoria: number | null = null;
    let roiMedio: number | null = null;

    if (incluirDesempenho) {
      const seisMesesAtras = new Date();
      seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 6);

      const [total, ganhos, propostas, vencidas, perdidas, roiData] = await Promise.all([
        contagem(),
        linhas('valor_estimado, valor_adjudicado')
          .in('status', STATUS_GANHO)
          .gte('created_at', seisMesesAtras.toISOString()),
        contagem().in('status', ['Proposta Enviada', 'enviada', 'proposta']),
        contagem().in('status', STATUS_GANHO),
        contagem().in('status', STATUS_PERDIDO),
        linhas('valor_estimado, valor_adjudicado')
          .in('status', STATUS_GANHO)
          .not('valor_estimado', 'is', null)
          .not('valor_adjudicado', 'is', null),
      ]);

      licitacoesMonitoradas = total.count ?? null;
      valorTotalGanho = ((ganhos.data || []) as unknown as ValoresDoGanho[])
        .reduce((s, l) => s + (l.valor_adjudicado || l.valor_estimado || 0), 0);
      propostasEnviadas = propostas.count ?? null;

      const decididas = (vencidas.count || 0) + (perdidas.count || 0);
      // Sem processo decidido a taxa não é 0%: é indivisível. Zero afirmaria
      // que a empresa perdeu tudo o que disputou.
      taxaVitoria = decididas > 0 ? Math.round(((vencidas.count || 0) / decididas) * 1000) / 10 : null;

      const linhasRoi = (roiData.data || []) as unknown as ValoresDoGanho[];
      const somaEstimado = linhasRoi.reduce((s, l) => s + (l.valor_estimado || 0), 0);
      const somaAdjudicado = linhasRoi.reduce((s, l) => s + (l.valor_adjudicado || 0), 0);
      // Economia sobre o estimado. Sem base estimada não há razão a calcular.
      roiMedio = somaEstimado > 0
        ? Math.round(((somaEstimado - somaAdjudicado) / somaEstimado) * 1000) / 10
        : null;
    }

    setKpis({
      licitacoesMonitoradas,
      valorTotalGanho,
      licitacoesHoje: editaisDoDia.count || 0,
      editaisAbertos,
      ultimaSincronizacao,
      propostasEnviadas,
      taxaVitoria,
      roiMedio,
    });

    if (incluirDesempenho) {
      /* Os seis meses vão JUNTOS. O laço original tinha `await` dentro dele:
         os meses corriam em série, um esperando o outro, e cada um abria
         quatro consultas. Não reduz o número de consultas — reduz cinco
         esperas de rede encadeadas. */
      const janelas = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(new Date().getFullYear(), new Date().getMonth() - (5 - i), 1);
        return {
          rotulo: MESES[d.getMonth()],
          inicio: d.toISOString(),
          fim: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString(),
        };
      });

      const [porMes, recentesData, modalidadesData] = await Promise.all([
        Promise.all(
          janelas.map(async ({ rotulo, inicio, fim }) => {
            const [v, p, pr, vals] = await Promise.all([
              contagem().in('status', STATUS_GANHO).gte('updated_at', inicio).lte('updated_at', fim),
              contagem().in('status', STATUS_PERDIDO).gte('updated_at', inicio).lte('updated_at', fim),
              contagem().in('status', ['Proposta Enviada', 'enviada', 'proposta']).gte('created_at', inicio).lte('created_at', fim),
              linhas('valor_estimado, valor_adjudicado').in('status', STATUS_GANHO).gte('updated_at', inicio).lte('updated_at', fim),
            ]);
            return {
              mes: rotulo,
              vitorias: v.count || 0,
              derrotas: p.count || 0,
              propostas: pr.count || 0,
              valor: ((vals.data || []) as unknown as ValoresDoGanho[])
                .reduce((s, l) => s + (l.valor_adjudicado || l.valor_estimado || 0), 0),
            };
          }),
        ),
        supabase
          .from('licitacoes')
          .select('id, numero, orgao, objeto, status, valor_estimado, uf, municipio, data_encerramento')
          .match(escopo)
          .order('created_at', { ascending: false })
          .limit(5),
        linhas('modalidade'),
      ]);

      setChartMensal(porMes.map(({ mes, vitorias, derrotas, propostas }) => ({ mes, vitorias, derrotas, propostas })));
      setChartValor(porMes.map(({ mes, valor }) => ({ mes, valor })));
      setRecentes((recentesData.data || []) as unknown as LicitacaoRecente[]);

      const linhasModalidade = (modalidadesData.data || []) as unknown as { modalidade: string | null }[];
      const contagens: Record<string, number> = {};
      linhasModalidade.forEach((l) => {
        const nome = l.modalidade || 'Outros';
        contagens[nome] = (contagens[nome] || 0) + 1;
      });
      setModalidades(
        Object.entries(contagens).map(([name, qtd]) => ({
          name,
          value: Math.round((qtd / linhasModalidade.length) * 100),
          fill: MODALIDADE_COLORS[name] || 'hsl(220, 14%, 60%)',
        })),
      );
    }

    setLoading(false);
  }, [user, empresaId, todasSelecionadas, incluirDesempenho]);

  useEffect(() => {
    if (!user) return;
    void loadAll();

    // Realtime: o painel se atualiza quando as tabelas de origem mudam.
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'licitacoes', filter: `user_id=eq.${user.id}` }, () => void loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contratos', filter: `user_id=eq.${user.id}` }, () => void loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kanban_tasks', filter: `user_id=eq.${user.id}` }, () => void loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'monitoramento_editais', filter: `user_id=eq.${user.id}` }, () => void loadAll())
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [user, loadAll]);

  return { kpis, chartMensal, chartValor, recentes, modalidades, loading, erro, recarregar: loadAll };
}
