import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SituacaoDoRobo } from './robo-do-cliente';

type SaudeDoRobo = {
  configurado?: boolean;
  online?: boolean;
  agentes?: Array<{
    online?: boolean;
    erro?: string | null;
    portais_suportados?: string[] | null;
  }>;
};

function situacaoPelaSaude(data: unknown): SituacaoDoRobo | null {
  const saude = data as SaudeDoRobo | null;
  if (!saude || typeof saude !== 'object' || typeof saude.online !== 'boolean') return null;

  const agentes = Array.isArray(saude.agentes) ? saude.agentes : [];
  const portais = [...new Set(
    agentes.flatMap((agente) => Array.isArray(agente.portais_suportados) ? agente.portais_suportados : []),
  )];
  const motivo = saude.online
    ? null
    : saude.configurado === false
      ? 'Robô ainda não configurado'
      : agentes.find((agente) => typeof agente.erro === 'string' && agente.erro.trim())?.erro || 'Indisponível no momento';

  return {
    disponivel: saude.online,
    motivo,
    ligado: null,
    portais_suportados: portais.length ? portais : null,
    verificado_em: new Date().toISOString(),
  };
}

/**
 * A situação do robô para esta empresa, perguntada ao servidor.
 *
 * O cliente não recebe healthcheck, versão nem slots: recebe `disponivel` e, se
 * não estiver, o motivo em linguagem de negócio. Quem traduz a infraestrutura
 * nisso é o `healthcheck`, que já reduz a resposta para clientes — o navegador
 * não recebe endereço, versão, memória ou qualquer diagnóstico interno.
 *
 * Chave única no react-query: o cabeçalho e o checklist perguntam a mesma coisa
 * e dividem a mesma requisição, em vez de uma cada.
 *
 * Falha NÃO vira "disponível": a tela diz "situação indisponível no momento"
 * — nunca um "pronto" que ninguém verificou.
 *
 * ─── CADÊNCIA: NO MÁXIMO UMA VEZ POR MINUTO ────────────────────────────────
 *
 * A consulta sonda o agente em cada pergunta. Por isso:
 *  - só UM leitor acompanha (`acompanhar: true`, o cabeçalho) a cada 60 s. Com
 *    intervalo em todos, cada observador do react-query tem o próprio relógio,
 *    desencontrado dos outros — três leitores na tela fariam três perguntas por
 *    minuto;
 *  - os demais leem o cache e só perguntam ao montar, se o dado passou de 90 s,
 *    ou quando a pessoa clica em "Atualizar";
 *  - voltar à aba do navegador não dispara pergunta.
 */
export function useSituacaoDoRobo(
  empresaId: string | null | undefined,
  { acompanhar = false }: { acompanhar?: boolean } = {},
) {
  const consulta = useQuery({
    queryKey: ['robo-situacao', empresaId ?? null],
    enabled: !!empresaId,
    staleTime: 90_000,
    refetchInterval: acompanhar ? 60_000 : false,
    refetchOnWindowFocus: false,
    retry: false,
    queryFn: async (): Promise<SituacaoDoRobo> => {
      const { data, error } = await supabase.functions.invoke('robo-lances-webhook/healthcheck', { body: {} });
      if (error) {
        // O detalhe fica no console para quem depura; a tela do cliente só
        // precisa saber que a resposta não veio.
        console.error('[robo-lances] healthcheck', (error as { message?: string }).message);
        throw new Error('situacao-indisponivel');
      }
      const situacao = situacaoPelaSaude(data);
      if (!situacao) throw new Error('situacao-sem-resposta-reconhecivel');
      return situacao;
    },
  });

  const situacao = consulta.data ?? null;
  return {
    situacao,
    carregando: consulta.isFetching && !situacao,
    /** Sem resposta utilizável: erro, ação não implantada ou sem empresa. */
    indisponivel: !situacao && !consulta.isFetching,
    recarregar: consulta.refetch,
  };
}
