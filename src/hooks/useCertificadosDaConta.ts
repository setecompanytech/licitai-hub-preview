/**
 * Os certificados registrados, por empresa — a leitura dos "slots".
 *
 * Passa pelo `robo-lances-webhook` em vez de consultar a tabela: a RLS de
 * `cert_upload_tokens` é por `user_id`, então lido direto o certificado que uma
 * pessoa registrou a outra da MESMA empresa não veria. O servidor lê por
 * `empresa_membros`, que é o critério certo (ver a action
 * `certificados-das-empresas`).
 *
 * Falha não vira lista vazia: lista vazia significa "nenhuma empresa", e dizer
 * isso quando a leitura falhou faria a tela afirmar que não há nada a registrar.
 * O erro sobe e a tela oferece "Tentar novamente" (princípio 3 do CLAUDE.md).
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  resumoDosSlots,
  slotsDeCertificado,
  type CertificadoDaEmpresa,
  type SlotDeCertificado,
} from '@/lib/robo/certificados-da-conta';

export interface EstadoDosCertificados {
  slots: SlotDeCertificado[];
  resumo: ReturnType<typeof resumoDosSlots>;
  carregando: boolean;
  erro: string | null;
  recarregar: () => void;
}

export function useCertificadosDaConta(): EstadoDosCertificados {
  const [slots, setSlots] = useState<SlotDeCertificado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [pedido, setPedido] = useState(0);

  const recarregar = useCallback(() => setPedido((n) => n + 1), []);

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    setErro(null);

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke(
          'robo-lances-webhook/certificados-das-empresas',
          { body: {} },
        );
        if (!vivo) return;

        // `error.message` traz só "non-2xx status code"; o motivo real está no
        // corpo. Sem isto, a tela mostra uma frase que não diz o que fazer.
        if (error) {
          let motivo = (data as { erro?: string } | null)?.erro;
          const contexto = (error as { context?: Response }).context;
          if (!motivo && contexto && typeof contexto.json === 'function') {
            const corpo = await contexto.json().catch(() => null);
            motivo = (corpo as { erro?: string } | null)?.erro;
          }
          throw new Error(motivo || error.message);
        }

        const lista = ((data as { certificados?: CertificadoDaEmpresa[] } | null)?.certificados) || [];
        setSlots(slotsDeCertificado(lista));
      } catch (e) {
        if (vivo) setErro((e as Error).message || 'Não foi possível ler os certificados.');
      } finally {
        if (vivo) setCarregando(false);
      }
    })();

    return () => { vivo = false; };
  }, [pedido]);

  return { slots, resumo: resumoDosSlots(slots), carregando, erro, recarregar };
}
