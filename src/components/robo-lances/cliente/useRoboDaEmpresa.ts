import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { tabelaAusente } from './robo-do-cliente';

/**
 * O robô DA EMPRESA está ligado?
 *
 * Lê `robo_empresa_config`. Três respostas distintas, e a tela precisa das três:
 *
 *  - sem linha            → ligado. É o comportamento anterior à tabela
 *                           (CLAUDE.md, princípio 7): quem nunca escolheu não é
 *                           bloqueado por um padrão inventado.
 *  - tabela ausente       → ligado, com `migracaoPendente`. O botão fica
 *                           indisponível com uma nota discreta; não é falha da
 *                           empresa, é atualização nossa ainda não aplicada.
 *  - erro de leitura      → NÃO confirmado. Afirmar "ligado" sem ter lido seria
 *                           dizer à pessoa que o robô vai operar quando não se
 *                           sabe; a tela mostra a dúvida e oferece reler.
 */
export interface EstadoDoRoboDaEmpresa {
  ligado: boolean;
  /** A leitura terminou e respondeu (com linha, sem linha ou tabela ausente). */
  confirmado: boolean;
  carregando: boolean;
  migracaoPendente: boolean;
  erro: string | null;
  motivo: string | null;
  alteradoEm: string | null;
}

export interface LinhaDoRoboDaEmpresa {
  ligado: boolean;
  motivo?: string | null;
  alterado_em?: string | null;
}

const INICIAL: EstadoDoRoboDaEmpresa = {
  ligado: true,
  confirmado: false,
  carregando: true,
  migracaoPendente: false,
  erro: null,
  motivo: null,
  alteradoEm: null,
};

export function useRoboDaEmpresa(empresaId: string | null | undefined) {
  const [estado, setEstado] = useState<EstadoDoRoboDaEmpresa>(INICIAL);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    if (!empresaId) {
      setEstado({ ...INICIAL, carregando: false });
      return;
    }
    let cancelado = false;
    setEstado((e) => ({ ...e, carregando: true }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabela de 14/09 fora do types.ts (parado em 16/08)
    (supabase as any)
      .from('robo_empresa_config')
      .select('ligado, motivo, alterado_em')
      .eq('empresa_id', empresaId)
      .maybeSingle()
      .then(({ data, error }: { data: unknown; error: { code?: string; message?: string } | null }) => {
        if (cancelado) return;
        if (error) {
          if (tabelaAusente(error)) {
            setEstado({ ...INICIAL, carregando: false, confirmado: true, migracaoPendente: true });
            return;
          }
          console.error('[robo-lances] ler robo_empresa_config', error.message);
          setEstado({ ...INICIAL, carregando: false, erro: error.message || 'sem resposta do banco' });
          return;
        }
        const linha = (Array.isArray(data) ? data[0] : data) as LinhaDoRoboDaEmpresa | null | undefined;
        setEstado({
          ligado: linha?.ligado !== false,
          confirmado: true,
          carregando: false,
          migracaoPendente: false,
          erro: null,
          motivo: linha?.motivo ?? null,
          alteradoEm: linha?.alterado_em ?? null,
        });
      });

    return () => {
      cancelado = true;
    };
  }, [empresaId, versao]);

  const recarregar = useCallback(() => setVersao((v) => v + 1), []);

  /** Aplica o que o banco devolveu depois de gravar — sem reler. */
  const aplicar = useCallback((linha: LinhaDoRoboDaEmpresa) => {
    setEstado({
      ligado: linha.ligado,
      confirmado: true,
      carregando: false,
      migracaoPendente: false,
      erro: null,
      motivo: linha.motivo ?? null,
      alteradoEm: linha.alterado_em ?? null,
    });
  }, []);

  return { estado, recarregar, aplicar };
}
