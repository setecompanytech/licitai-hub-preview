import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { itemUnitario, type EditalDoAcervo, type ItemUnitario } from '@/lib/mercado/preco-observado';

/**
 * Os itens dos editais da busca por objeto, lidos no PNCP pela edge
 * `itens-do-acervo-pncp` (com cache em `pncp_editais_itens`), já casados
 * com o objeto pesquisado. Roda quando a lista de editais muda — a lista só
 * muda quando uma busca termina, então não há chamada a cada tecla.
 */
export interface EstadoDosItens {
  carregando: boolean;
  itens: ItemUnitario[];
  erro: string;
  /** Editais lidos agora no PNCP e editais que já estavam em cache. */
  buscados: number;
  cacheados: number;
  totalItens: number;
}

const VAZIO: EstadoDosItens = { carregando: false, itens: [], erro: '', buscados: 0, cacheados: 0, totalItens: 0 };

export function useItensDoAcervo(objeto: string, editais: EditalDoAcervo[]): EstadoDosItens {
  const [estado, setEstado] = useState<EstadoDosItens>(VAZIO);

  useEffect(() => {
    if (editais.length === 0 || objeto.trim().length < 3) {
      setEstado(VAZIO);
      return;
    }
    let vivo = true;
    setEstado((s) => ({ ...s, carregando: true, erro: '' }));
    const corpo = {
      objeto,
      editais: editais.map(({ pncp_id, cnpj_orgao, ano_compra, sequencial_compra }) => ({ pncp_id, cnpj_orgao, ano_compra, sequencial_compra })),
    };
    supabase.functions.invoke('itens-do-acervo-pncp', { body: corpo })
      .then(({ data, error }) => {
        if (!vivo) return;
        if (error || data?.error) {
          setEstado({ ...VAZIO, erro: String(data?.error ?? error?.message ?? 'Sem resposta') });
          return;
        }
        const porId = new Map(editais.map((e) => [e.pncp_id, e]));
        const brutos = (data?.itens ?? []) as Array<Record<string, unknown>>;
        setEstado({
          carregando: false,
          erro: '',
          itens: brutos.map((raw) => itemUnitario(raw, porId.get(String(raw.pncp_id ?? '')))),
          buscados: Number(data?.buscados ?? 0),
          cacheados: Number(data?.cacheados ?? 0),
          totalItens: Number(data?.total_itens ?? 0),
        });
      })
      .catch((e: unknown) => {
        if (vivo) setEstado({ ...VAZIO, erro: e instanceof Error ? e.message : 'Sem resposta' });
      });
    return () => { vivo = false; };
  }, [objeto, editais]);

  return estado;
}
