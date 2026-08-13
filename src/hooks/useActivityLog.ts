import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { getSessaoId } from '@/lib/auditoria/sessao';

/**
 * Registro de atividade do colaborador.
 *
 * Este hook existia e não tinha um único chamador em todo o `src/` — as telas
 * `AuditoriaAdmin` e `RelatorioAtividades` liam uma tabela sempre vazia. A
 * escrita agora acontece dentro de `useLicitacaoIntegration` e do
 * `AuthContext`, não espalhada pelos componentes: enquanto o registro depender
 * de cada tela lembrar de chamá-lo, cada tela nova nasce com um furo — e este
 * repositório também recebe commits diretos do Lovable, sem revisão.
 *
 * A trilha NÃO tem FK para `licitacoes`: o id do processo vai em `metadata`.
 * É de propósito — o expurgo de 120 dias apaga a licitação, e uma auditoria
 * que morre junto com o objeto auditado não é auditoria.
 */
export type EventoAuditoria = {
  /** O que aconteceu, em verbo no passado: 'status_alterado', 'processo_arquivado'. */
  acao: string;
  /** Módulo de origem: 'licitacoes', 'auth', 'financeiro'… */
  modulo: string;
  descricao?: string;
  /** Processo afetado, quando houver. */
  licitacaoId?: string | null;
  /** Valor anterior e novo — sem isso a trilha diz que algo mudou, mas não o quê. */
  de?: string | null;
  para?: string | null;
  metadata?: Record<string, unknown>;
};

export function useActivityLog() {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();

  const registrar = useCallback(async (evento: EventoAuditoria) => {
    // Sem usuário não há o que atribuir. `empresaAtiva` deixou de ser
    // obrigatória: a versão anterior descartava silenciosamente toda ação feita
    // antes da empresa carregar, que é justamente a janela do login.
    if (!user) return;

    const { acao, modulo, descricao, licitacaoId, de, para, metadata } = evento;

    const { error } = await supabase.from('atividades_colaborador').insert({
      user_id: user.id,
      empresa_id: empresaAtiva?.id ?? null,
      acao,
      modulo,
      descricao: descricao ?? null,
      metadata: {
        ...(metadata || {}),
        ...(licitacaoId ? { licitacao_id: licitacaoId } : {}),
        ...(de !== undefined ? { de } : {}),
        ...(para !== undefined ? { para } : {}),
        rota: typeof window !== 'undefined' ? window.location.pathname : null,
        sessao_id: getSessaoId(),
      },
    });

    // A trilha nunca derruba a operação que ela registra: falhar em auditar um
    // arquivamento é ruim, desfazer o arquivamento por causa disso é pior.
    if (error) console.error('[auditoria]', acao, error.message);
  }, [user, empresaAtiva]);

  /** Assinatura curta, compatível com o formato antigo do hook. */
  const logActivity = useCallback(
    (acao: string, modulo: string, descricao?: string, metadata?: Record<string, unknown>) =>
      registrar({ acao, modulo, descricao, metadata }),
    [registrar]
  );

  return { registrar, logActivity };
}
