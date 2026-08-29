import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { situacaoJuridica, type SituacaoJuridica } from '@/lib/contratos/eficacia';

export type DadosJuridicos = {
  situacao: SituacaoJuridica | null;
  /** A migration 20260829000005 ainda não rodou — nada a exibir, nada a barrar. */
  indisponivel: boolean;
  carregando: boolean;
  recarregar: () => void;
};

/**
 * A situação jurídica do contrato, num lugar só.
 *
 * Duas telas precisam da mesma resposta: o painel do Dashboard, que a exibe, e
 * a aba Pedidos, que precisa avisar antes de alguém registrar pedido num
 * contrato que ainda não produz efeitos.
 *
 * Vive num hook porque a lição desta semana foi cara: saldo com duas fórmulas,
 * `grupo_dre` com três réguas, merge de extração com duas cópias — sempre a
 * mesma história, e sempre a mesma consequência de duas telas discordando
 * sobre o mesmo fato sem que nada diga qual vale.
 */
export function useSituacaoJuridica(contratoId: string | null | undefined): DadosJuridicos {
  const [situacao, setSituacao] = useState<SituacaoJuridica | null>(null);
  const [indisponivel, setIndisponivel] = useState(false);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    if (!contratoId) { setCarregando(false); return; }
    setCarregando(true);
    const [cRes, pRes] = await Promise.all([
      supabase
        .from('contratos')
        .select('data_assinatura, modalidade, assinatura_situacao, eficacia_por_urgencia')
        .eq('id', contratoId)
        .single(),
      supabase
        .from('contrato_publicacoes' as never)
        .select('tipo, data_publicacao')
        .eq('contrato_id', contratoId)
        .in('tipo', ['extrato_contrato', 'extrato_ata']),
    ]);

    setCarregando(false);
    // Coluna ou tabela ausentes = migration não rodou. Recolher é melhor que
    // barrar: ninguém pode ser impedido de trabalhar por um SQL que falta.
    if (cRes.error || pRes.error) { setIndisponivel(true); return; }

    const c = cRes.data as unknown as {
      data_assinatura: string | null; modalidade: string | null;
      assinatura_situacao: string | null; eficacia_por_urgencia: boolean | null;
    };
    const publicacoes = (pRes.data ?? []) as unknown as Array<{ data_publicacao: string }>;

    setIndisponivel(false);
    setSituacao(
      situacaoJuridica({
        dataAssinatura: c.data_assinatura,
        assinaturaSituacao: c.assinatura_situacao as never,
        dataDivulgacao: publicacoes[0]?.data_publicacao ?? null,
        modalidade: c.modalidade,
        urgencia: !!c.eficacia_por_urgencia,
      }),
    );
  }, [contratoId]);

  useEffect(() => { void carregar(); }, [carregar]);

  return { situacao, indisponivel, carregando, recarregar: () => void carregar() };
}
