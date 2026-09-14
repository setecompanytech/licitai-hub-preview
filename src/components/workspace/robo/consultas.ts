/**
 * Leituras da aba "Robô de Lances" do processo que o hook compartilhado não faz.
 *
 * `useParticipacoesDoRobo` entrega disputa, sessão e os lances da sessão
 * inteira. A pasta do processo precisa de três leituras a mais, só dela: a
 * versão da precificação de onde saíram os limites, os lances POR ITEM
 * (`sessao_lance_itens`) e o histórico da sessão — este lido só quando o
 * painel de detalhes abre.
 *
 * ── Migração pendente é um estado, não uma queda ────────────────────────────
 *
 * `precificacao_versoes` nasce na migration 20260914000002 e
 * `sessao_lance_itens` na 20260909000011; nenhuma é aplicada sozinha (o SQL é
 * colado no editor). Publicar a tela antes do SQL devolve 42P01 / PGRST205.
 * Tratar isso como erro comum mandaria a pessoa "tentar novamente" algo que
 * não vai funcionar; tratar como vazio diria "nenhuma versão aprovada" quando
 * a verdade é "ainda não existe onde aprovar". Vira `migracao_pendente`.
 *
 * ── Nada aqui escreve ───────────────────────────────────────────────────────
 *
 * Só `select`. Parar o robô passa por `lib/robo/comandos.ts`, por clique
 * confirmado; montar, desmontar ou trocar de empresa nunca dispara comando.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ItemDaSessao } from './itens-da-disputa';

export type EstadoDaLeitura = 'ociosa' | 'carregando' | 'pronta' | 'migracao_pendente' | 'erro';

export interface Leitura<T> {
  dados: T | null;
  estado: EstadoDaLeitura;
  erro: string | null;
  recarregar: () => void;
}

// `types.ts` está congelado em 16/08 e não conhece as tabelas de 09/09 e 14/09.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tabelaNova = (nome: string): any => (supabase as any).from(nome);

/** Tabela ou coluna que ainda não existe no banco — a migration não rodou. */
export function ehMigracaoPendente(erro: unknown): boolean {
  const e = (erro ?? {}) as { code?: string; message?: string };
  if (e.code === '42P01' || e.code === 'PGRST205' || e.code === '42703' || e.code === 'PGRST204') return true;
  const mensagem = String(e.message ?? '').toLowerCase();
  return (
    mensagem.includes('does not exist') ||
    mensagem.includes('could not find the table') ||
    mensagem.includes('schema cache')
  );
}

type Resposta = { data: unknown; error: unknown };

interface Resultado<T> {
  alvo: string | null;
  dados: T | null;
  estado: EstadoDaLeitura;
  erro: string | null;
}

/**
 * Uma leitura por `alvo` (id da sessão, da versão), refeita quando `gatilho`
 * muda — a aba passa o instante da última releitura do hook, então itens e
 * participação envelhecem juntos.
 *
 * Releitura do MESMO alvo não apaga o que está na tela (a tabela não pisca a
 * cada 15 s); troca de alvo apaga na hora, para o lance da sessão A nunca
 * aparecer, nem por um instante, na linha da sessão B. Falha também apaga:
 * dado antigo exibido ao lado de "erro" parece dado atual.
 */
function useLeitura<T>(alvo: string | null, gatilho: number, ler: (alvo: string) => PromiseLike<Resposta>): Leitura<T> {
  const [resultado, setResultado] = useState<Resultado<T>>({ alvo: null, dados: null, estado: 'ociosa', erro: null });
  const [nonce, setNonce] = useState(0);
  const lerRef = useRef(ler);
  lerRef.current = ler;

  useEffect(() => {
    if (!alvo) return;
    let cancelado = false;
    setResultado((atual) => (atual.alvo === alvo ? atual : { alvo, dados: null, estado: 'carregando', erro: null }));

    Promise.resolve(lerRef.current(alvo)).then(
      ({ data, error }) => {
        if (cancelado) return;
        if (error) {
          setResultado(
            ehMigracaoPendente(error)
              ? { alvo, dados: null, estado: 'migracao_pendente', erro: null }
              : {
                  alvo,
                  dados: null,
                  estado: 'erro',
                  // A mensagem real do banco — o princípio 3 do CLAUDE.md.
                  erro: (error as { message?: string }).message || 'Falha na consulta.',
                },
          );
          return;
        }
        setResultado({ alvo, dados: (data ?? null) as T | null, estado: 'pronta', erro: null });
      },
      (e: unknown) => {
        if (cancelado) return;
        setResultado({
          alvo,
          dados: null,
          estado: 'erro',
          erro: e instanceof Error ? e.message : 'Sem resposta do banco.',
        });
      },
    );

    return () => {
      cancelado = true;
    };
  }, [alvo, gatilho, nonce]);

  const recarregar = useCallback(() => setNonce((n) => n + 1), []);

  if (!alvo) return { dados: null, estado: 'ociosa', erro: null, recarregar };
  if (resultado.alvo !== alvo) return { dados: null, estado: 'carregando', erro: null, recarregar };
  return { dados: resultado.dados, estado: resultado.estado, erro: resultado.erro, recarregar };
}

export interface VersaoVinculada {
  id: string;
  numero: number;
  situacao: string | null;
  aprovada_em: string | null;
}

/**
 * A versão da precificação apontada por `disputa.precificacao_versao_id`.
 *
 * A policy da tabela só deixa OPERADOR ler (a versão carrega custo). Para
 * `viewer` a consulta volta vazia sem erro — a tela diz "não visível para esta
 * conta", e não "nenhuma versão aprovada", que seria mentira.
 */
export function useVersaoVinculada(versaoId: string | null): Leitura<VersaoVinculada> {
  return useLeitura<VersaoVinculada>(versaoId, 0, (id) =>
    tabelaNova('precificacao_versoes').select('id, numero, situacao, aprovada_em').eq('id', id).maybeSingle(),
  );
}

/** Lances por item, como o agente os leu na sala. */
export function useItensDaSessao(sessaoId: string | null, gatilho: number): Leitura<ItemDaSessao[]> {
  return useLeitura<ItemDaSessao[]>(sessaoId, gatilho, (id) =>
    tabelaNova('sessao_lance_itens')
      .select(
        'sessao_id, numero, lote, descricao, seu_ultimo_lance, melhor_lance, sou_lider, situacao, valor_minimo, licitacao_item_id',
      )
      .eq('sessao_id', id)
      .order('numero', { ascending: true }),
  );
}

export interface LanceDoHistorico {
  id: string;
  valor: number;
  tipo: string;
  rodada: number | null;
  timestamp_lance: string;
}

/**
 * Histórico da sessão — só `origem = 'real'`, o mesmo filtro do hook
 * compartilhado: lance de simulação listado aqui pareceria lance enviado.
 */
export function useLancesDaSessao(sessaoId: string | null, gatilho: number): Leitura<LanceDoHistorico[]> {
  return useLeitura<LanceDoHistorico[]>(sessaoId, gatilho, (id) =>
    supabase
      .from('lances_historico')
      .select('id, valor, tipo, rodada, timestamp_lance')
      .eq('sessao_id', id)
      .eq('origem', 'real')
      .order('timestamp_lance', { ascending: false })
      .limit(50),
  );
}

/** Relógio da tela, para perceber leitura envelhecendo sem ninguém recarregar. */
export function useRelogio(intervaloMs: number): number {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setAgora(Date.now()), intervaloMs);
    return () => window.clearInterval(id);
  }, [intervaloMs]);
  return agora;
}
