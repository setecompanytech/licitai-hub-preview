import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import type { ChatMessage } from '@/lib/ai-stream';

/**
 * O histórico de conversas da AURÉLIA.
 *
 * Antes de 13/09/2026 a conversa vivia em `useState`: fechar o painel guardava,
 * recarregar a página apagava. Quem pedia análise de um edital, saía para
 * conferir o documento e voltava, encontrava a tela em branco — e refazia a
 * pergunta, com outro gasto de IA e outra resposta, que raramente sai igual.
 *
 * Três decisões que moldam este hook:
 *
 * A gravação é POR MENSAGEM, não por conversa fechada. A resposta chega em
 * streaming e pode levar meia dúzia de segundos; gravar só no fim perderia
 * tudo se a pessoa fechasse a aba no meio — que é exatamente quando a resposta
 * demora e alguém desiste.
 *
 * A falha de gravação NÃO interrompe a conversa. Histórico é conveniência; a
 * resposta na tela é o serviço. Mas também não some em silêncio: o erro fica
 * exposto em `erro`, e quem chama decide como avisar.
 *
 * A conversa é PESSOAL, como `processos_interesse` (CLAUDE.md, princípio 2).
 * `empresa_id` entra como contexto — a AURÉLIA responde sobre os processos da
 * empresa ativa —, nunca como chave de compartilhamento.
 */

export interface ConversaDaAurelia {
  id: string;
  titulo: string | null;
  ultima_mensagem_em: string;
  total_mensagens: number;
  rota_origem: string | null;
}

/**
 * `types.ts` do Supabase está congelado em 16/08 e não conhece estas tabelas,
 * então o cliente tipado as recusa. O escape é o mesmo que o resto do módulo
 * usa para `nfe_entradas`; sai quando os tipos forem regerados.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tabela = (nome: string) => supabase.from(nome as never) as any;

export function useAureliaHistorico() {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const [conversas, setConversas] = useState<ConversaDaAurelia[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregarConversas = useCallback(async () => {
    if (!user) return;
    setCarregando(true);
    setErro(null);
    const { data, error } = await tabela('aurelia_conversas')
      .select('id, titulo, ultima_mensagem_em, total_mensagens, rota_origem')
      .eq('user_id', user.id)
      .is('arquivada_em', null)
      .order('ultima_mensagem_em', { ascending: false })
      // 50 é o que se percorre com o olho. Além disso a lista vira arquivo
      // morto que ninguém abre, e quem procura algo específico usa a busca.
      .limit(50);

    if (error) setErro(error.message);
    else setConversas((data ?? []) as ConversaDaAurelia[]);
    setCarregando(false);
  }, [user]);

  /** Abre uma conversa nova. Devolve o id, que o chamador guarda. */
  const abrirConversa = useCallback(
    async (rotaOrigem: string): Promise<string | null> => {
      if (!user) return null;
      const { data, error } = await tabela('aurelia_conversas')
        .insert({
          user_id: user.id,
          empresa_id: empresaAtiva?.id ?? null,
          rota_origem: rotaOrigem,
        })
        .select('id')
        .single();

      if (error || !data) {
        setErro(error?.message ?? 'Não foi possível abrir a conversa.');
        return null;
      }
      return (data as { id: string }).id;
    },
    [user, empresaAtiva],
  );

  /**
   * Grava uma mensagem.
   *
   * `ordem` vem de quem chama porque é a posição na conversa que está na tela.
   * Deduzi-la aqui custaria uma consulta por mensagem, e duas gravações
   * simultâneas cairiam na mesma posição.
   */
  const gravarMensagem = useCallback(
    async (
      conversaId: string,
      papel: 'user' | 'assistant',
      conteudo: string,
      ordem: number,
      ferramenta?: string,
    ) => {
      if (!user || !conteudo.trim()) return;
      const { error } = await tabela('aurelia_mensagens').upsert(
        {
          conversa_id: conversaId,
          user_id: user.id,
          papel,
          conteudo,
          ordem,
          ferramenta: ferramenta ?? null,
        },
        // A resposta é gravada uma vez, no fim do streaming, mas um retry ou
        // uma reconexão repetiria a mesma posição. Upsert corrige em vez de
        // duplicar a fala.
        { onConflict: 'conversa_id,ordem' },
      );
      if (error) setErro(error.message);
    },
    [user],
  );

  /** Recupera a conversa inteira, na ordem em que aconteceu. */
  const carregarMensagens = useCallback(
    async (conversaId: string): Promise<ChatMessage[] | null> => {
      const { data, error } = await tabela('aurelia_mensagens')
        .select('papel, conteudo')
        .eq('conversa_id', conversaId)
        .order('ordem', { ascending: true });

      if (error) {
        setErro(error.message);
        return null;
      }
      return ((data ?? []) as { papel: 'user' | 'assistant'; conteudo: string }[]).map((m) => ({
        role: m.papel,
        content: m.conteudo,
      }));
    },
    [],
  );

  /**
   * Arquiva em vez de apagar. Conversa com a IA costuma carregar a análise de
   * um edital que a pessoa citou numa proposta — recuperá-la depois de um
   * clique errado importa mais que economizar linha no banco.
   */
  const arquivarConversa = useCallback(async (conversaId: string) => {
    const { error } = await tabela('aurelia_conversas')
      .update({ arquivada_em: new Date().toISOString() })
      .eq('id', conversaId);
    if (error) setErro(error.message);
    else setConversas((c) => c.filter((x) => x.id !== conversaId));
  }, []);

  useEffect(() => {
    if (user) carregarConversas();
  }, [user, carregarConversas]);

  return {
    conversas,
    carregando,
    erro,
    carregarConversas,
    abrirConversa,
    gravarMensagem,
    carregarMensagens,
    arquivarConversa,
  };
}
