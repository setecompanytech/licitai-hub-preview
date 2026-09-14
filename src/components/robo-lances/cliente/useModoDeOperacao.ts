import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAuditLog } from '@/hooks/useAuditLog';
import { usePapelEmpresa } from '@/hooks/usePapelEmpresa';
import type { NivelAutomacao } from '@/components/robo-lances/NivelAutomacaoSelector';

/**
 * O modo de operação do robô (nível 1, 2 ou 3) e o que anda com ele: o aceite
 * de termos, o limite financeiro do aceite vigente e a autorização da
 * estratégia.
 *
 * Saiu de `pages/RoboLances.tsx` em 14/09/2026, quando a disputa ganhou página
 * própria: o botão do modo mora no topo da lista, e o limite e a autorização
 * moram na aba Estratégia da disputa. As duas telas usam ESTE hook — duas
 * cópias da troca de nível seriam duas conferências do freio, e cedo ou tarde
 * uma delas deixaria de conferir.
 */
export interface ModoDeOperacao {
  nivel: NivelAutomacao;
  /** Só o administrador da empresa troca o nível. */
  podeAlterar: boolean;
  /** Devolve `true` quando o nível foi aplicado — o diálogo fecha para o aceite abrir. */
  alterarNivel: (novo: NivelAutomacao) => Promise<boolean>;
  aceiteAberto: boolean;
  definirAceiteAberto: (aberto: boolean) => void;
  aoAceitar: (aceiteId: string) => void;
  /** Limite do aceite vigente. 0 = nenhum aceite vigente (nunca "limite de R$ 0,00"). */
  limiteFinanceiro: number;
  /** `false` enquanto a leitura não terminou — ausência de resposta não é ausência de limite. */
  limiteCarregado: boolean;
  estrategiaAutorizada: boolean;
  autorizarEstrategia: () => void;
}

const CHAVE_DO_NIVEL = 'robo_nivel_automacao';

function nivelGuardado(): NivelAutomacao {
  try {
    const salvo = localStorage.getItem(CHAVE_DO_NIVEL);
    return (salvo ? parseInt(salvo) : 1) as NivelAutomacao;
  } catch {
    return 1;
  }
}

function guardarNivel(nivel: NivelAutomacao) {
  try {
    localStorage.setItem(CHAVE_DO_NIVEL, String(nivel));
  } catch {
    // Armazenamento bloqueado: o nível vale para esta visita.
  }
}

export function useModoDeOperacao({ lerLimite = true }: { lerLimite?: boolean } = {}): ModoDeOperacao {
  const { user } = useAuth();
  const { isAdmin } = usePapelEmpresa();
  const { registrar } = useAuditLog();
  const [nivel, setNivel] = useState<NivelAutomacao>(nivelGuardado);
  const [aceiteAberto, setAceiteAberto] = useState(false);
  const [estrategiaAutorizada, setEstrategiaAutorizada] = useState(false);

  /**
   * ─── TRAVA DE SEGURANÇA QUE NÃO TRAVAVA (corrigido em 13/09/2026) ────────
   *
   * `limiteFinanceiro` era declarado com `useState(0)` e NUNCA teve setter. O
   * número digitado no `AceiteTermosDialog` era gravado em
   * `robo_aceite_termos.limite_financeiro` e ninguém o lia de volta:
   * `AutorizacaoLanceDialog` recebia `0`, e a checagem `excedeLimite` daquele
   * diálogo (`valorInicial > limite && limite > 0`) ficava sempre falsa.
   *
   * Agora o aceite VIGENTE (o mais recente, não revogado) é lido de volta.
   */
  const [limiteFinanceiro, setLimiteFinanceiro] = useState(0);
  const [limiteCarregado, setLimiteCarregado] = useState(false);

  /**
   * "Vigente" = o mais recente COM `revogado_em` nulo. Herdar o teto de um
   * aceite revogado seria ressuscitar uma permissão que alguém retirou.
   *
   * A RLS da tabela é `auth.uid() = user_id`; o filtro por usuário deixa a
   * consulta explícita, não substitui a trava do banco.
   */
  const carregarLimiteFinanceiro = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('robo_aceite_termos' as never)
      .select('limite_financeiro')
      .eq('user_id', user.id)
      .is('revogado_em', null)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      // Sem o limite, a trava do diálogo de autorização volta a ficar
      // desligada. A pessoa precisa saber disso.
      console.error('[robo-lances] carregar limite financeiro', error.message);
      toast.error(
        `Não foi possível ler o limite financeiro do aceite: ${error.message}. ` +
          'A conferência de teto na autorização fica indisponível até a leitura funcionar.',
        { duration: 12000 },
      );
      setLimiteCarregado(true);
      return;
    }

    const linha = (data as unknown as Array<{ limite_financeiro: number | null }> | null)?.[0];
    setLimiteFinanceiro(Number(linha?.limite_financeiro) || 0);
    setLimiteCarregado(true);
  }, [user]);

  useEffect(() => {
    if (lerLimite) carregarLimiteFinanceiro();
  }, [lerLimite, carregarLimiteFinanceiro]);

  const alterarNivel = async (novo: NivelAutomacao): Promise<boolean> => {
    if (!isAdmin) {
      toast.error('Só o administrador da empresa altera o nível de automação.');
      return false;
    }
    // Freio verificado é PRÉ-REQUISITO dos níveis com envio automático — o
    // freio funcionar do outro lado, não o botão existir na tela. O teste do
    // freio é ferramenta da operação Praefectus (saiu da tela do cliente em
    // 14/09/2026), então a mensagem manda ao suporte, e o detalhe do agente
    // vai para o console.
    if (novo > 1) {
      let freio: { ok?: boolean; detalhe?: string | null } | null | undefined = null;
      try {
        const { data } = await supabase.functions.invoke('robo-lances-webhook/healthcheck', { body: {} });
        freio = (data as { agentes?: Array<{ kill_switch?: { ok?: boolean; detalhe?: string | null } | null }> } | null)
          ?.agentes?.[0]?.kill_switch;
      } catch (e) {
        console.error('[robo-lances] verificar freio antes do nível', e);
      }
      if (!freio?.ok) {
        if (freio?.detalhe) console.error('[robo-lances] freio não verificado', freio.detalhe);
        toast.error(
          `Nível ${novo} indisponível no momento: a parada de emergência do robô ainda não foi verificada ` +
            'pela equipe Praefectus. Fale com o suporte para ativar o envio automático.',
          { duration: 15000 },
        );
        return false;
      }
      // Níveis 2 e 3 pedem o aceite de termos antes de valer.
      setNivel(novo);
      guardarNivel(novo);
      setAceiteAberto(true);
      setEstrategiaAutorizada(false);
      registrar('nivel_alterado', { de: nivel, para: novo }, { nivelAutomacao: novo });
      return true;
    }
    setNivel(1);
    guardarNivel(1);
    setEstrategiaAutorizada(false);
    registrar('nivel_alterado', { de: nivel, para: 1 }, { nivelAutomacao: 1 });
    return true;
  };

  const aoAceitar = () => {
    // O aceite acabou de gravar um limite novo — relê agora, senão a tela
    // continuaria com o teto anterior (ou com zero) até o próximo F5.
    carregarLimiteFinanceiro();
    toast.success(`Nível ${nivel} ativado com sucesso!`);
  };

  return {
    nivel,
    podeAlterar: isAdmin,
    alterarNivel,
    aceiteAberto,
    definirAceiteAberto: setAceiteAberto,
    aoAceitar,
    limiteFinanceiro,
    limiteCarregado,
    estrategiaAutorizada,
    autorizarEstrategia: () => setEstrategiaAutorizada(true),
  };
}
