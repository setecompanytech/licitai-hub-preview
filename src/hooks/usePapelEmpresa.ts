import { useMemo } from 'react';
import { useEmpresa } from '@/contexts/EmpresaContext';

/**
 * Papel do usuário na empresa ativa — autoridade única sobre quem pode o quê.
 *
 * Os papéis (`admin` | `operador` | `viewer`) sempre existiram em Equipe →
 * Permissões, mas cada tela decidia por conta própria (ou não decidia: o Robô
 * de Lances entregava configuração de infraestrutura e nível de automação a
 * qualquer pessoa com acesso ao módulo). Mesma disciplina do vocabulário de
 * status: uma fonte, um lugar.
 */
export function usePapelEmpresa() {
  const { empresas, empresaAtiva } = useEmpresa();

  return useMemo(() => {
    const membro = empresas.find((e) => e.empresa_id === empresaAtiva?.id);
    const papel = membro?.papel ?? null;
    return {
      papel,
      /** Infraestrutura, credenciais da empresa e decisões de risco financeiro. */
      isAdmin: papel === 'admin',
      /** Opera o dia a dia: configura disputa, precifica, monta proposta. */
      podeOperar: papel === 'admin' || papel === 'operador',
      /** Só acompanha — vê a sessão, não a altera. */
      isViewer: papel === 'viewer',
    };
  }, [empresas, empresaAtiva?.id]);
}
