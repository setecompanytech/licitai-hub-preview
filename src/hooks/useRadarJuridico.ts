import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { hojeLocal } from '@/lib/financeiro/data-local';
import {
  eventosDoRadar,
  type AlteracaoDeEdital, type CctDoRadar, type ContratoDoRadar, type DocumentoDoRadar, type EventoDoRadar, type LicitacaoDoRadar,
} from '@/lib/juridico/radar';

/**
 * O Radar Jurídico da empresa ativa (27/09/2026): lê contratos, termos,
 * publicações, processos, documentos com validade, convenções coletivas e
 * os avisos do robô de edital alterado, e deixa a régua pura
 * (`lib/juridico/radar.ts`) dizer o que precisa de peça. Uma leitura só,
 * usada pela aba Radar e pelo bloco do Painel geral. Nada é gravado.
 */
/**
 * Consulta com tipo MÍNIMO: o `types.ts` gerado não conhece as colunas que
 * vieram por migration colada à mão, e encadear sete consultas tipadas num
 * `Promise.all` estoura o compilador (TS2589). Este contrato diz só o que o
 * radar usa: filtros que devolvem a própria consulta e um resultado cru.
 */
type Resultado = { data: unknown; error: { message: string } | null };
type Consulta = PromiseLike<Resultado> & {
  eq: (coluna: string, valor: string) => Consulta;
  is: (coluna: string, valor: null) => Consulta;
  not: (coluna: string, operador: string, valor: null) => Consulta;
  gte: (coluna: string, valor: string) => Consulta;
  ilike: (coluna: string, padrao: string) => Consulta;
};
type Leitor = { from: (tabela: string) => { select: (colunas: string) => Consulta } };
const db = supabase as unknown as Leitor;

export function useRadarJuridico() {
  const { empresaAtiva } = useEmpresa();
  const empresaId = empresaAtiva?.id ?? null;
  return useQuery<EventoDoRadar[]>({
    queryKey: ['radar-juridico', empresaId],
    enabled: !!empresaId,
    staleTime: 60_000,
    queryFn: async () => {
      const desde = new Date(Date.now() - 20 * 86400000).toISOString();
      const [c, a, p, l, d, k, h] = await Promise.all([
        db.from('contratos')
          .select('id, numero_contrato, orgao_contratante, tipo_documento, status, data_assinatura, data_fim, indice_reajuste, data_base_reajuste, saldo_remanescente, valor_global, fiscal_nome, especie_objeto')
          .eq('empresa_id', empresaId!).is('excluido_em', null),
        db.from('contrato_aditivos').select('contrato_id, tipo, data_assinatura, data_base_reajuste'),
        db.from('contrato_publicacoes').select('contrato_id, tipo'),
        db.from('licitacoes').select('id, numero, orgao, status, resultado, updated_at').eq('empresa_id', empresaId!).is('arquivado_em', null),
        db.from('documentos').select('id, nome, tipo, validade').eq('empresa_id', empresaId!).not('validade', 'is', null),
        db.from('convencoes_coletivas').select('id, categoria_profissional, vigencia_inicio, abrangencia_uf').eq('status', 'vigente'),
        db.from('robo_historico').select('id, edital, link, ocorreu_em, titulo').eq('empresa_id', empresaId!).gte('ocorreu_em', desde).ilike('titulo', '%licitação mudou%'),
      ]);
      const falha = c.error ?? a.error ?? l.error ?? d.error;
      if (falha) throw falha;
      type Ad = { contrato_id: string; tipo: string | null; data_assinatura: string | null; data_base_reajuste: string | null };
      type Pub = { contrato_id: string; tipo: string | null };
      const aditivos = (a.data ?? []) as Ad[];
      // Tabelas que vieram por migration colada à mão: ausentes, o radar segue sem a régua delas.
      const publicacoes = p.error ? [] : ((p.data ?? []) as Pub[]);
      const alteracoes = h.error ? [] : ((h.data ?? []) as AlteracaoDeEdital[]);
      const ccts = k.error ? [] : ((k.data ?? []) as CctDoRadar[]);
      const contratos: ContratoDoRadar[] = ((c.data ?? []) as Array<Omit<ContratoDoRadar, 'aditivos' | 'publicacoes'>>).map((ct) => ({
        ...ct,
        saldo_remanescente: ct.saldo_remanescente === null ? null : Number(ct.saldo_remanescente),
        valor_global: ct.valor_global === null ? null : Number(ct.valor_global),
        aditivos: aditivos.filter((x) => x.contrato_id === ct.id),
        publicacoes: publicacoes.filter((x) => x.contrato_id === ct.id),
      }));
      return eventosDoRadar({
        contratos,
        licitacoes: (l.data ?? []) as LicitacaoDoRadar[],
        documentos: (d.data ?? []) as DocumentoDoRadar[],
        ccts,
        alteracoesDeEdital: alteracoes,
        hoje: hojeLocal(),
      });
    },
  });
}
