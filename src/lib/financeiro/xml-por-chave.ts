/**
 * O XML de uma NF-e pela chave, pela SEFAZ (30/09/2026).
 *
 * A porta oficial é o NFeDistribuicaoDFe com o certificado A1 da empresa; a
 * edge `nfe-xml-por-chave` lê o certificado do cofre e fala com o proxy mTLS.
 * Aqui só a chamada e a leitura da resposta, para as telas não repetirem.
 */
import { supabase } from '@/integrations/supabase/client';
import { motivoDaEdgeFunction } from '@/lib/erro-edge-function';

export type ResumoDaNfe = {
  tipo: 'procNFe' | 'resNFe' | 'outro';
  chave: string | null;
  numero: string | null;
  serie: string | null;
  emitente_cnpj: string | null;
  emitente_razao: string | null;
  valor_total: number | null;
  data_emissao: string | null;
};

export type ResultadoDaBusca =
  | { ok: true; xml: string; resumo: ResumoDaNfe }
  | { ok: false; motivo: string; setup_required?: boolean; sem_certificado?: boolean; precisa_manifestar?: boolean; resumo?: ResumoDaNfe };

export type StatusDoCertificado = {
  tem_certificado: boolean;
  arquivo: string | null;
  enviado_em: string | null;
  com_senha: boolean;
  proxy_configurado: boolean;
};

export async function buscarXmlPorChave(empresaId: string, chave: string): Promise<ResultadoDaBusca> {
  const { data, error } = await supabase.functions.invoke('nfe-xml-por-chave', { body: { empresa_id: empresaId, chave: chave.replace(/\D/g, '') } });
  if (error) return { ok: false, motivo: (await motivoDaEdgeFunction(error)) ?? error.message };
  if (data?.error) return { ok: false, motivo: String(data.error) };
  if (data?.ok && typeof data.xml === 'string') return { ok: true, xml: data.xml, resumo: data.resumo };
  return { ok: false, motivo: String(data?.motivo ?? 'A SEFAZ não devolveu a nota.'), setup_required: !!data?.setup_required, sem_certificado: !!data?.sem_certificado, precisa_manifestar: !!data?.precisa_manifestar, resumo: data?.resumo };
}

export async function statusDoCertificadoA1(empresaId: string): Promise<StatusDoCertificado | null> {
  const { data, error } = await supabase.functions.invoke('nfe-xml-por-chave', { body: { empresa_id: empresaId, modo: 'status' } });
  if (error || !data || data.error) return null;
  return data as StatusDoCertificado;
}

/** O XML como arquivo, para entrar pelo mesmo caminho do XML enviado à mão. */
export function arquivoDoXml(xml: string, chave: string): File {
  return new File([xml], `NFe-${chave.replace(/\D/g, '')}.xml`, { type: 'text/xml' });
}
