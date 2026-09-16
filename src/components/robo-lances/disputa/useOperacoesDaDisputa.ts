import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { resumirErroParaCliente } from '@/lib/robo/situacao-da-participacao';

/**
 * O log de operações da disputa: o que o robô EXECUTOU no portal.
 *
 * ─── ESTA ABA ESTEVE VAZIA DESDE QUE NASCEU ────────────────────────────────
 *
 * `operations` era um `useState([])` sem nenhum setter: a aba mostrava
 * "Nenhuma operação registrada" para sempre — inclusive depois de o robô ter
 * entrado no portal e dado lances. A fonte real já existia: as sessões do
 * agente (`sessoes_lance_real`, por `lance_config_id`) e os lances de cada uma
 * (`lances_historico`). Elas foram preferidas à remoção da aba porque
 * respondem a uma pergunta que a auditoria não responde: a trilha registra o
 * que ALGUÉM autorizou; isto registra o que o robô FEZ.
 *
 * Saiu de `pages/RoboLances.tsx` em 14/09/2026 para a aba Acompanhamento da
 * página da disputa.
 */
export type OperacaoDaDisputa = {
  id: string;
  timestamp: Date;
  acao: string;
  resultado: 'sucesso' | 'erro' | 'info';
  detalhes: string;
};

const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Duas leituras, nesta ordem obrigatória: as sessões desta disputa e, só então,
 * os lances daquelas sessões — `lances_historico` não tem `lance_config_id`, o
 * vínculo é pelo `sessao_id`. Sem sessão, a segunda consulta é pulada.
 *
 * `gatilho` relê (depois de "Enviar ao robô", por exemplo).
 */
export function useOperacoesDaDisputa(disputaId: string | null, gatilho = 0) {
  const [operacoes, setOperacoes] = useState<OperacaoDaDisputa[]>([]);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!disputaId) {
      setOperacoes([]);
      return;
    }
    let cancelado = false;
    setCarregando(true);

    (async () => {
      const { data: sessoes, error: erroSessoes } = await supabase
        .from('sessoes_lance_real')
        .select('id, status, resultado, erro, portal_nome, rodada_atual, valor_atual, created_at, updated_at')
        .eq('lance_config_id', disputaId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (cancelado) return;
      if (erroSessoes) {
        // Lista vazia sem explicação é indistinguível de "o robô nunca rodou".
        console.error('[robo-lances] carregar operações', erroSessoes.message);
        toast.error(`Não foi possível carregar as operações: ${erroSessoes.message}`, { duration: 12000 });
        setOperacoes([]);
        setCarregando(false);
        return;
      }

      const linhasSessao = (sessoes || []) as Array<{
        id: string;
        status: string;
        resultado: string | null;
        erro: string | null;
        portal_nome: string;
        rodada_atual: number | null;
        valor_atual: number | null;
        created_at: string;
        updated_at: string;
      }>;

      const eventos: OperacaoDaDisputa[] = linhasSessao.map((s) => ({
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
          // vezes de bastidor. Aqui vai o resumo em linguagem de cliente, com o
          // que fazer; o texto completo fica no Admin Praefectus › Robô de Lances.
          s.erro
            ? (() => {
                const r = resumirErroParaCliente(s.erro);
                return `${r.texto} ${r.acao}.`;
              })()
            : null,
        ]
          .filter(Boolean)
          .join(' · '),
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
            id: string;
            valor: number;
            rodada: number;
            tipo: string;
            origem: string;
            timestamp_lance: string;
          }>) {
            eventos.push({
              id: `lance-${l.id}`,
              timestamp: new Date(l.timestamp_lance),
              // Três tipos, três leituras. `recusado` passou a chegar em
              // 16/09, quando o webhook deixou de descartar o callback que o
              // agente já enviava: o portal não aceitou aquele lance, e
              // mostrá-lo como "enviado" faria a linha do tempo afirmar algo
              // que não está no portal.
              acao: l.tipo === 'concorrente'
                ? 'Lance de concorrente'
                : l.tipo === 'recusado'
                  ? 'Lance recusado pelo portal'
                  : 'Lance enviado',
              resultado: l.tipo === 'concorrente'
                ? 'info'
                : l.tipo === 'recusado'
                  ? 'erro'
                  : 'sucesso',
              detalhes: `${moeda(Number(l.valor) || 0)} · rodada ${l.rodada} · origem ${l.origem}`,
            });
          }
        }
      }

      eventos.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setOperacoes(eventos);
      setCarregando(false);
    })();

    return () => {
      cancelado = true;
    };
  }, [disputaId, gatilho]);

  return { operacoes, carregando };
}
