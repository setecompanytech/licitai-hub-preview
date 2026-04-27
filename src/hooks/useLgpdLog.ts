import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';

export type LgpdOperacao =
  | 'acesso'
  | 'exportacao'
  | 'exclusao'
  | 'anonimizacao'
  | 'retificacao'
  | 'compartilhamento'
  | 'coleta';

export type LgpdBaseLegal =
  | 'consentimento'
  | 'execucao_contrato'
  | 'obrigacao_legal'
  | 'legitimo_interesse'
  | 'protecao_credito'
  | 'exercicio_regular_direitos';

export type LgpdRegistro = {
  operacao: LgpdOperacao;
  categoriaDados: string; // ex: 'cadastro_cliente', 'documento_fiscal', 'colaborador_pii'
  finalidade: string;     // ex: 'emissao_nf', 'cumprimento_contrato'
  modulo: string;         // ex: 'financeiro', 'monitoramento'
  baseLegal?: LgpdBaseLegal;
  titularId?: string;     // CNPJ, CPF ou ID interno
  titularTipo?: 'cnpj' | 'cpf' | 'colaborador' | 'outro';
  descricao?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Registra operações sobre dados pessoais conforme Art. 37 da LGPD.
 * Falha silenciosamente — auditoria nunca pode bloquear a operação principal.
 */
export function useLgpdLog() {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();

  const registrar = useCallback(async (r: LgpdRegistro) => {
    if (!user) return;
    try {
      await (supabase.from('lgpd_tratamento_log' as any) as any).insert({
        user_id: user.id,
        empresa_id: empresaAtiva?.id ?? null,
        operacao: r.operacao,
        categoria_dados: r.categoriaDados,
        finalidade: r.finalidade,
        modulo: r.modulo,
        base_legal: r.baseLegal ?? 'execucao_contrato',
        titular_id: r.titularId ?? null,
        titular_tipo: r.titularTipo ?? null,
        descricao: r.descricao ?? null,
        metadata: r.metadata ?? {},
        user_agent: navigator.userAgent,
      });
    } catch {
      /* swallow — auditoria nunca quebra fluxo */
    }
  }, [user, empresaAtiva]);

  return { registrar };
}
