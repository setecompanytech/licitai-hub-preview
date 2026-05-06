import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';

export type JuridicoPedidoTipo = 'reajuste' | 'repactuacao' | 'revisao' | 'outros';
export type JuridicoPedidoStatus =
  | 'rascunho'
  | 'em_revisao'
  | 'gerado'
  | 'assinado'
  | 'protocolado'
  | 'em_analise'
  | 'deferido'
  | 'indeferido'
  | 'parcialmente_deferido';

export const STATUS_LABELS: Record<JuridicoPedidoStatus, string> = {
  rascunho: 'Rascunho',
  em_revisao: 'Em revisão',
  gerado: 'Gerado',
  assinado: 'Assinado',
  protocolado: 'Protocolado',
  em_analise: 'Em análise',
  deferido: 'Deferido',
  indeferido: 'Indeferido',
  parcialmente_deferido: 'Parcialmente deferido',
};

export const STATUS_FLOW: JuridicoPedidoStatus[] = [
  'rascunho', 'em_revisao', 'gerado', 'assinado', 'protocolado', 'em_analise', 'deferido',
];

export const TIPO_LABELS: Record<JuridicoPedidoTipo, string> = {
  reajuste: 'Reajuste',
  repactuacao: 'Repactuação',
  revisao: 'Revisão / Reequilíbrio',
};

export interface JuridicoPedido {
  id: string;
  empresa_id: string;
  tipo: JuridicoPedidoTipo;
  status: JuridicoPedidoStatus;
  ano: number;
  sequencial: number;
  numero_formatado: string | null;
  instrumento: string | null;
  processo_administrativo: string | null;
  pregao_numero: string | null;
  ata_numero: string | null;
  contrato_numero: string | null;
  aditivo_numero: string | null;
  aditivo_numero_legacy?: string | null;
  orgao_contratante: string | null;
  dados_caso: Record<string, unknown> | null;
  data_protocolo: string | null;
  numero_protocolo: string | null;
  retorno_orgao: string | null;
  versao_atual_id: string | null;
  versoes_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface JuridicoPedidoVersao {
  id: string;
  pedido_id: string;
  versao: number;
  conteudo: string;
  resumo_alteracao: string | null;
  modelo_ia: string | null;
  gerado_por: string;
  gerado_em: string;
}

export interface JuridicoPedidoEvento {
  id: string;
  pedido_id: string;
  evento: string;
  descricao: string | null;
  status_anterior: JuridicoPedidoStatus | null;
  status_novo: JuridicoPedidoStatus | null;
  autor: string | null;
  criado_em: string;
}

export function useJuridicoPedidos(filtroTipo?: JuridicoPedidoTipo) {
  const { empresaAtiva } = useEmpresa();
  const { user } = useAuth();
  const [pedidos, setPedidos] = useState<JuridicoPedido[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!empresaAtiva?.id) { setPedidos([]); return; }
    setLoading(true);
    let q = supabase
      .from('juridico_pedidos' as any)
      .select('*')
      .eq('empresa_id', empresaAtiva.id)
      .order('created_at', { ascending: false });
    if (filtroTipo) q = q.eq('tipo', filtroTipo);
    const { data, error } = await q;
    if (error) {
      toast.error('Falha ao carregar pedidos: ' + error.message);
      setPedidos([]);
    } else {
      setPedidos((data as unknown as JuridicoPedido[]) || []);
    }
    setLoading(false);
  }, [empresaAtiva?.id, filtroTipo]);

  useEffect(() => { load(); }, [load]);

  const criarPedido = useCallback(async (input: {
    tipo: JuridicoPedidoTipo;
    instrumento?: string;
    processo_administrativo?: string;
    pregao_numero?: string;
    ata_numero?: string;
    contrato_numero?: string;
    aditivo_numero?: string;
    orgao_contratante?: string;
    dados_caso?: Record<string, unknown>;
  }) => {
    if (!empresaAtiva?.id || !user) {
      toast.error('Selecione uma empresa ativa para criar o pedido');
      return null;
    }
    const payload = {
      empresa_id: empresaAtiva.id,
      created_by: user.id,
      tipo: input.tipo,
      status: 'rascunho' as JuridicoPedidoStatus,
      ano: new Date().getFullYear(),
      instrumento: input.instrumento ?? null,
      processo_administrativo: input.processo_administrativo ?? null,
      pregao_numero: input.pregao_numero ?? null,
      ata_numero: input.ata_numero ?? null,
      contrato_numero: input.contrato_numero ?? null,
      aditivo_numero: input.aditivo_numero ?? null,
      orgao_contratante: input.orgao_contratante ?? null,
      dados_caso: input.dados_caso ?? {},
    };
    const { data, error } = await supabase
      .from('juridico_pedidos' as any)
      .insert(payload)
      .select('*')
      .single();
    if (error) {
      toast.error('Falha ao criar pedido: ' + error.message);
      return null;
    }
    const pedido = data as unknown as JuridicoPedido;
    await supabase.from('juridico_pedidos_historico' as any).insert({
      pedido_id: pedido.id,
      evento: 'criado',
      descricao: `Pedido ${pedido.numero_formatado} criado`,
      status_novo: 'rascunho',
      autor: user.id,
    });
    await load();
    toast.success(`Pedido ${pedido.numero_formatado} criado`);
    return pedido;
  }, [empresaAtiva?.id, user, load]);

  const atualizarStatus = useCallback(async (
    pedido: JuridicoPedido,
    novoStatus: JuridicoPedidoStatus,
    descricao?: string
  ) => {
    if (!user) return false;
    const { error } = await supabase
      .from('juridico_pedidos' as any)
      .update({ status: novoStatus })
      .eq('id', pedido.id);
    if (error) { toast.error('Falha ao mudar status: ' + error.message); return false; }
    await supabase.from('juridico_pedidos_historico' as any).insert({
      pedido_id: pedido.id,
      evento: 'status_alterado',
      descricao: descricao ?? `Status alterado para ${STATUS_LABELS[novoStatus]}`,
      status_anterior: pedido.status,
      status_novo: novoStatus,
      autor: user.id,
    });
    await load();
    toast.success(`Status: ${STATUS_LABELS[novoStatus]}`);
    return true;
  }, [user, load]);

  const salvarVersao = useCallback(async (
    pedido: JuridicoPedido,
    conteudo: string,
    resumo?: string,
    modeloIa?: string
  ) => {
    if (!user) return null;
    const proximaVersao = (pedido.versoes_count ?? 0) + 1;
    const { data: versao, error: vErr } = await supabase
      .from('juridico_pedidos_versoes' as any)
      .insert({
        pedido_id: pedido.id,
        versao: proximaVersao,
        conteudo,
        resumo_alteracao: resumo ?? null,
        modelo_ia: modeloIa ?? null,
        gerado_por: user.id,
      })
      .select('*')
      .single();
    if (vErr) { toast.error('Falha ao salvar versão: ' + vErr.message); return null; }
    const v = versao as unknown as JuridicoPedidoVersao;

    await supabase
      .from('juridico_pedidos' as any)
      .update({
        versao_atual_id: v.id,
        versoes_count: proximaVersao,
        status: pedido.status === 'rascunho' ? 'gerado' : pedido.status,
      })
      .eq('id', pedido.id);

    await supabase.from('juridico_pedidos_historico' as any).insert({
      pedido_id: pedido.id,
      evento: 'versao_gerada',
      descricao: `Versão v${proximaVersao} gerada${resumo ? ' — ' + resumo : ''}`,
      status_anterior: pedido.status,
      status_novo: pedido.status === 'rascunho' ? 'gerado' : pedido.status,
      autor: user.id,
    });
    await load();
    return v;
  }, [user, load]);

  const excluirPedido = useCallback(async (id: string) => {
    const { error } = await supabase.from('juridico_pedidos' as any).delete().eq('id', id);
    if (error) { toast.error('Falha ao excluir: ' + error.message); return false; }
    await load();
    toast.success('Pedido excluído');
    return true;
  }, [load]);

  return { pedidos, loading, criarPedido, atualizarStatus, salvarVersao, excluirPedido, reload: load };
}

export async function listarVersoes(pedidoId: string): Promise<JuridicoPedidoVersao[]> {
  const { data } = await supabase
    .from('juridico_pedidos_versoes' as any)
    .select('*')
    .eq('pedido_id', pedidoId)
    .order('versao', { ascending: false });
  return (data as unknown as JuridicoPedidoVersao[]) || [];
}

export async function listarHistorico(pedidoId: string): Promise<JuridicoPedidoEvento[]> {
  const { data } = await supabase
    .from('juridico_pedidos_historico' as any)
    .select('*')
    .eq('pedido_id', pedidoId)
    .order('criado_em', { ascending: false });
  return (data as unknown as JuridicoPedidoEvento[]) || [];
}
