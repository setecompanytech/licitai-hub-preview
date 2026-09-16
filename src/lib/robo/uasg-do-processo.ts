/**
 * A UASG da disputa a partir do processo (16/09/2026).
 *
 * O processo (`licitacoes`) não tem coluna de UASG, e a disputa importada do
 * Kanban nascia com o campo vazio — sem ele o robô não acha a compra no
 * Compras.gov (o número se repete entre órgãos) e o lembrete acusa "falta a
 * UASG". O espelho do PNCP (`pncp_editais_cache`) guarda o que resolve, pelas
 * coordenadas do processo (princípio 4: espelho primeiro):
 *
 * 1. o link do Compras.gov, que carrega o id da compra — UASG (6) + modalidade
 *    (2) + número (5) + ano (4): `...?compra=92531505000072026` → 925315;
 * 2. `uasg_codigo`;
 * 3. `codigo_unidade` (o `unidadeOrgao.codigoUnidade` do PNCP, que no
 *    Compras.gov é a UASG: 925315 no 7/2026).
 *
 * ESPELHO: `uasgDoEspelho` em `supabase/functions/_shared/compra-comprasgov.ts`,
 * que o agendador usa para disputa já cadastrada sem UASG.
 */
import { supabase } from '@/integrations/supabase/client';

export interface LinhaDoEspelho {
  link_sistema_origem?: string | null;
  link_comprasnet?: string | null;
  uasg_codigo?: string | null;
  codigo_unidade?: string | null;
}

const seisDigitos = (v: unknown) => {
  const d = String(v ?? '').replace(/\D/g, '');
  return d.length === 6 ? d : null;
};

export function uasgDoEspelho(linha: LinhaDoEspelho | null | undefined): string | null {
  if (!linha) return null;
  for (const link of [linha.link_comprasnet, linha.link_sistema_origem]) {
    const m = String(link ?? '').match(/compra=(\d{17})\b/);
    if (m) return m[1].slice(0, 6);
  }
  return seisDigitos(linha.uasg_codigo) ?? seisDigitos(linha.codigo_unidade);
}

export interface CoordenadasDoProcesso {
  numero_controle_pncp?: string | null;
  cnpj_orgao?: string | null;
  ano_compra?: string | null;
  sequencial_compra?: string | null;
}

/** Busca no espelho do PNCP. Nunca lança: sem achar, a pessoa preenche. */
export async function buscarUasgDoProcesso(proc: CoordenadasDoProcesso): Promise<string | null> {
  const colunas = 'link_sistema_origem, link_comprasnet, uasg_codigo, codigo_unidade';
  try {
    if (proc.numero_controle_pncp) {
      const { data } = await supabase
        .from('pncp_editais_cache')
        .select(colunas)
        .eq('numero_controle_pncp', proc.numero_controle_pncp)
        .limit(1);
      const uasg = uasgDoEspelho((data as LinhaDoEspelho[] | null)?.[0]);
      if (uasg) return uasg;
    }
    const cnpj = String(proc.cnpj_orgao ?? '').replace(/\D/g, '');
    if (cnpj.length === 14 && proc.ano_compra && proc.sequencial_compra) {
      const { data } = await supabase
        .from('pncp_editais_cache')
        .select(colunas)
        .eq('cnpj_orgao', cnpj)
        .eq('ano_compra', String(proc.ano_compra))
        .eq('sequencial_compra', String(Number(proc.sequencial_compra)))
        .limit(1);
      return uasgDoEspelho((data as LinhaDoEspelho[] | null)?.[0]);
    }
  } catch {
    /* sem espelho: o campo fica para a pessoa */
  }
  return null;
}
