import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
/* As três listas de status viviam AQUI DENTRO — a redeclaração que o princípio
   1 do CLAUDE.md proíbe. Elas saíram para `lib/licitacao/recortes-do-painel`,
   onde ficam ao lado do filtro da listagem que precisa reproduzir exatamente
   esta conta, e onde está registrado o que a auditoria de 13/09 mediu: trocar
   estas listas por `normalizarStatus` MUDA os números da tela (em especial
   "Em andamento", que hoje ignora o status canônico 'Em Análise'). O valor
   não mudou nesta passagem de propósito — mudar critério de apuração é
   decisão do dono do produto. Ler o cabeçalho daquele arquivo antes de mexer. */
import {
  STATUS_ANDAMENTO,
  STATUS_GANHO,
  STATUS_PERDIDO,
} from '@/lib/licitacao/recortes-do-painel';

export type ModalidadeBreakdown = {
  modalidade: string;
  total: number;
  ganhas: number;
  perdidas: number;
  emAndamento: number;
  valorGanho: number;
};

export type StatusBreakdown = {
  status: string;
  count: number;
  color: string;
};

export type UfBreakdown = {
  uf: string;
  total: number;
  ganhas: number;
  perdidas: number;
};

export type TimelineItem = {
  mes: string;
  pregao_ganhas: number;
  pregao_perdidas: number;
  dispensa_ganhas: number;
  dispensa_perdidas: number;
  emAndamento: number;
};

export type AnalyticsKpis = {
  totalProcessos: number;
  ganhas: number;
  perdidas: number;
  emAndamento: number;
  taxaVitoria: number;
  valorTotalGanho: number;
  valorEmDisputa: number;
  pregoes: number;
  dispensas: number;
  pregoesGanhos: number;
  dispensasGanhas: number;
};

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const STATUS_COLORS: Record<string, string> = {
  'Monitorando': 'hsl(var(--info))',
  'Analisando': 'hsl(var(--warning))',
  'Proposta Enviada': 'hsl(var(--chart-3))',
  'enviada': 'hsl(var(--chart-3))',
  'proposta': 'hsl(var(--chart-3))',
  'Em Disputa': 'hsl(var(--chart-4))',
  'Publicado': 'hsl(var(--muted-foreground))',
  'Vencida': 'hsl(var(--success))',
  'vencida': 'hsl(var(--success))',
  'Homologada': 'hsl(var(--success))',
  'Perdida': 'hsl(var(--destructive))',
  'perdida': 'hsl(var(--destructive))',
  'Arquivada': 'hsl(var(--muted-foreground))',
};

function isDispensa(modalidade: string) {
  return modalidade?.toLowerCase().includes('dispensa');
}

function isPregao(modalidade: string) {
  return modalidade?.toLowerCase().includes('pregão') || modalidade?.toLowerCase().includes('pregao');
}

/**
 * A linha como esta tela a lê — exatamente as colunas do `select` abaixo.
 * Era `any[]`, e `any` aqui apagava justamente os erros que este hook produz:
 * coluna renomeada, campo que não veio no select, `status` comparado com uma
 * lista de strings. O tipo explícito é o que faz o compilador cobrar.
 */
type LicitacaoDeAnalytics = {
  id: string;
  numero: string | null;
  orgao: string | null;
  objeto: string | null;
  modalidade: string | null;
  status: string | null;
  valor_estimado: number | null;
  valor_adjudicado: number | null;
  uf: string | null;
  municipio: string | null;
  data_abertura: string | null;
  data_encerramento: string | null;
  /** Dá o ano ao número publicado sem ele — identidade do card na agenda. */
  ano_compra: string | null;
  /** Fora da mesa de trabalho. Sem esta coluna a agenda cobrava prazo de processo encerrado. */
  arquivado_em: string | null;
  /** Chave do espelho PNCP: a agenda lê a situação da compra (revogada, anulada, suspensa). */
  numero_controle_pncp: string | null;
  created_at: string;
  updated_at: string | null;
};

export function useAnalyticsData() {
  const { user } = useAuth();
  const { empresaAtiva, todasSelecionadas } = useEmpresa();
  const [licitacoes, setLicitacoes] = useState<LicitacaoDeAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  /** Mensagem real do banco quando a carga falha. Ver o comentário em `loadData`. */
  const [erro, setErro] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Escopo por empresa — "Ganhas" e "Valor Ganho" são resultados da empresa,
    // não do colaborador que cadastrou. O RLS (Onda 4) já limita às empresas
    // das quais o usuário é membro.
    let q = supabase
      .from('licitacoes')
      .select('id, numero, orgao, objeto, modalidade, status, valor_estimado, valor_adjudicado, uf, municipio, data_abertura, data_encerramento, ano_compra, arquivado_em, numero_controle_pncp, created_at, updated_at');

    if (!todasSelecionadas && empresaAtiva) {
      q = q.eq('empresa_id', empresaAtiva.id);
    }

    /* O `error` era descartado (`const { data } = await q`): RLS negando,
       rede caída ou coluna renomeada viravam `data: null` → lista vazia, e a
       tela anunciava uma empresa sem nenhum processo. É a falha silenciosa do
       princípio 3 do CLAUDE.md. A lista anterior NÃO é apagada no erro —
       sumir com o que já estava na tela é a mesma mentira em outro formato. */
    const { data, error } = await q;
    if (error) {
      setErro(error.message);
      setLoading(false);
      return;
    }
    setErro(null);
    setLicitacoes((data || []) as LicitacaoDeAnalytics[]);
    setLoading(false);
  }, [user, empresaAtiva, todasSelecionadas]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('analytics-licitacoes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'licitacoes', filter: `user_id=eq.${user.id}` },
        () => { loadData(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, loadData]);

  // Compute KPIs
  const kpis: AnalyticsKpis = (() => {
    const ganhas = licitacoes.filter(l => STATUS_GANHO.includes(l.status));
    const perdidas = licitacoes.filter(l => STATUS_PERDIDO.includes(l.status));
    const emAndamento = licitacoes.filter(l => STATUS_ANDAMENTO.includes(l.status));
    const totalDecididas = ganhas.length + perdidas.length;
    const taxa = totalDecididas > 0 ? (ganhas.length / totalDecididas) * 100 : 0;
    const valorGanho = ganhas.reduce((s, l) => s + (l.valor_adjudicado || l.valor_estimado || 0), 0);
    const valorDisputa = emAndamento.reduce((s, l) => s + (l.valor_estimado || 0), 0);

    const pregoes = licitacoes.filter(l => isPregao(l.modalidade));
    const dispensas = licitacoes.filter(l => isDispensa(l.modalidade));

    return {
      totalProcessos: licitacoes.length,
      ganhas: ganhas.length,
      perdidas: perdidas.length,
      emAndamento: emAndamento.length,
      taxaVitoria: Math.round(taxa * 10) / 10,
      valorTotalGanho: valorGanho,
      valorEmDisputa: valorDisputa,
      pregoes: pregoes.length,
      dispensas: dispensas.length,
      pregoesGanhos: pregoes.filter(l => STATUS_GANHO.includes(l.status)).length,
      dispensasGanhas: dispensas.filter(l => STATUS_GANHO.includes(l.status)).length,
    };
  })();

  // Breakdown by modalidade
  const modalidadeBreakdown: ModalidadeBreakdown[] = (() => {
    const map: Record<string, ModalidadeBreakdown> = {};
    licitacoes.forEach(l => {
      const mod = l.modalidade || 'Outros';
      if (!map[mod]) map[mod] = { modalidade: mod, total: 0, ganhas: 0, perdidas: 0, emAndamento: 0, valorGanho: 0 };
      map[mod].total++;
      if (STATUS_GANHO.includes(l.status)) {
        map[mod].ganhas++;
        map[mod].valorGanho += l.valor_adjudicado || l.valor_estimado || 0;
      }
      if (STATUS_PERDIDO.includes(l.status)) map[mod].perdidas++;
      if (STATUS_ANDAMENTO.includes(l.status)) map[mod].emAndamento++;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  })();

  // Breakdown by status
  const statusBreakdown: StatusBreakdown[] = (() => {
    const map: Record<string, number> = {};
    licitacoes.forEach(l => { map[l.status] = (map[l.status] || 0) + 1; });
    return Object.entries(map)
      .map(([status, count]) => ({ status, count, color: STATUS_COLORS[status] || 'hsl(var(--muted-foreground))' }))
      .sort((a, b) => b.count - a.count);
  })();

  // Breakdown by UF
  const ufBreakdown: UfBreakdown[] = (() => {
    const map: Record<string, UfBreakdown> = {};
    licitacoes.forEach(l => {
      const uf = l.uf || 'N/I';
      if (!map[uf]) map[uf] = { uf, total: 0, ganhas: 0, perdidas: 0 };
      map[uf].total++;
      if (STATUS_GANHO.includes(l.status)) map[uf].ganhas++;
      if (STATUS_PERDIDO.includes(l.status)) map[uf].perdidas++;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  })();

  // Timeline (last 6 months)
  const timeline: TimelineItem[] = (() => {
    const now = new Date();
    const items: TimelineItem[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = d.getTime();
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).getTime();
      const label = MESES[d.getMonth()];
      const inRange = licitacoes.filter(l => {
        const t = new Date(l.updated_at).getTime();
        return t >= start && t <= end;
      });
      items.push({
        mes: label,
        pregao_ganhas: inRange.filter(l => isPregao(l.modalidade) && STATUS_GANHO.includes(l.status)).length,
        pregao_perdidas: inRange.filter(l => isPregao(l.modalidade) && STATUS_PERDIDO.includes(l.status)).length,
        dispensa_ganhas: inRange.filter(l => isDispensa(l.modalidade) && STATUS_GANHO.includes(l.status)).length,
        dispensa_perdidas: inRange.filter(l => isDispensa(l.modalidade) && STATUS_PERDIDO.includes(l.status)).length,
        emAndamento: inRange.filter(l => STATUS_ANDAMENTO.includes(l.status)).length,
      });
    }
    return items;
  })();

  return {
    kpis, modalidadeBreakdown, statusBreakdown, ufBreakdown, timeline, licitacoes, loading,
    erro,
    recarregar: loadData,
  };
}
