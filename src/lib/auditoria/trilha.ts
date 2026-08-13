import { supabase } from '@/integrations/supabase/client';
import { getSessaoId } from '@/lib/auditoria/sessao';

/**
 * Escrita na trilha sem depender de hooks.
 *
 * O `AuthContext` não pode usar `useActivityLog`: aquele hook consome
 * `useEmpresa`, que por sua vez depende do usuário autenticado — a dependência
 * é circular. Como os eventos de sessão são justamente os que acontecem antes
 * de haver empresa ativa, eles entram por aqui, com `empresa_id` nulo.
 *
 * Nunca lança: uma falha ao auditar não pode impedir alguém de entrar ou sair
 * do sistema.
 */
export async function registrarEventoSessao(
  userId: string,
  acao: 'login' | 'logout' | 'sessao_expirada' | 'usuario_atualizado',
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    await supabase.from('atividades_colaborador').insert({
      user_id: userId,
      empresa_id: null,
      acao,
      modulo: 'auth',
      descricao: DESCRICOES[acao],
      metadata: {
        ...metadata,
        rota: typeof window !== 'undefined' ? window.location.pathname : null,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        sessao_id: getSessaoId(),
      },
    });
  } catch (err) {
    console.error('[auditoria/sessao]', acao, err);
  }
}

const DESCRICOES: Record<string, string> = {
  login: 'Entrou no sistema.',
  logout: 'Saiu do sistema.',
  sessao_expirada: 'Sessão encerrada pelo sistema.',
  usuario_atualizado: 'Dados de acesso alterados.',
};
