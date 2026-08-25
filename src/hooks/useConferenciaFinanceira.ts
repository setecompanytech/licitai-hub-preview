import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';

/**
 * A conferência do Financeiro, lida pela tela.
 *
 * A função no banco refaz as derivações e devolve o que não fecha. Aqui ela
 * vira algo que aparece sozinho na primeira tela do módulo — porque uma
 * conferência que só roda quando alguém desconfia não previne nada; ela apenas
 * confirma, tarde, o que já custou.
 *
 * `refetchInterval` acompanha o resumo (60s): quem está conciliando vê o
 * achado sumir conforme corrige, e isso é metade do valor da ferramenta.
 */

export type Achado = {
  severidade: 'critico' | 'atencao' | 'informativo';
  categoria: string;
  descricao: string;
  valor: number | null;
  referencia: string | null;
};

const PESO: Record<Achado['severidade'], number> = { critico: 0, atencao: 1, informativo: 2 };

export function useConferenciaFinanceira() {
  const { empresaAtiva } = useEmpresa();
  return useQuery({
    queryKey: ['fin-conferencia', empresaAtiva?.id],
    enabled: !!empresaAtiva?.id,
    refetchInterval: 60_000,
    queryFn: async (): Promise<Achado[]> => {
      const { data, error } = await supabase.rpc('financeiro_conferencia' as never, {
        p_empresa_id: empresaAtiva!.id,
      } as never);
      // Falha aqui não pode ser silenciosa: sem conferência, quem olha a tela
      // precisa SABER que ninguém conferiu — não supor que estava tudo certo.
      if (error) throw error;
      const linhas = ((data ?? []) as unknown) as Achado[];
      return [...linhas].sort((a, b) => PESO[a.severidade] - PESO[b.severidade]);
    },
  });
}
