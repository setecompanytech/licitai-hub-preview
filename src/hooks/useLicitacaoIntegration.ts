import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

type EditalData = {
  numero: string;
  orgao: string;
  objeto: string;
  modalidade?: string;
  status?: string;
  valor_estimado?: number | null;
  uf?: string | null;
  municipio?: string | null;
  data_encerramento?: string | null;
  portal?: string | null;
  url?: string | null;
};

export function useLicitacaoIntegration() {
  const { user } = useAuth();
  const navigate = useNavigate();

  /** Create a licitação from edital data and optionally navigate */
  const iniciarProcesso = useCallback(async (edital: EditalData, navigateTo?: string) => {
    if (!user) {
      toast.error('Faça login para iniciar um processo.');
      return null;
    }

    try {
      // Check if already exists
      const { data: existing } = await supabase
        .from('licitacoes')
        .select('id')
        .eq('user_id', user.id)
        .eq('numero', edital.numero)
        .eq('orgao', edital.orgao)
        .maybeSingle();

      if (existing) {
        toast.info('Esta licitação já está na sua gestão.');
        if (navigateTo) navigate(navigateTo);
        return existing.id;
      }

      const { data, error } = await supabase
        .from('licitacoes')
        .insert({
          user_id: user.id,
          numero: edital.numero,
          orgao: edital.orgao,
          objeto: edital.objeto,
          modalidade: edital.modalidade || 'Pregão Eletrônico',
          status: edital.status || 'Monitorando',
          valor_estimado: edital.valor_estimado,
          uf: edital.uf,
          municipio: edital.municipio,
          data_encerramento: edital.data_encerramento,
          portal: edital.portal,
          url_edital: edital.url,
        })
        .select('id')
        .single();

      if (error) throw error;

      // Create notification
      await criarNotificacao(
        'Novo processo iniciado',
        `Licitação ${edital.numero} — ${edital.orgao} foi adicionada à gestão.`,
        '/licitacoes',
        'info'
      );

      // Add system message to chat
      if (data?.id) {
        await supabase.from('licitacao_mensagens').insert({
          licitacao_id: data.id,
          user_id: user.id,
          conteudo: `📋 Processo iniciado a partir do monitoramento de editais.\n**${edital.numero}** — ${edital.orgao}\nObjeto: ${edital.objeto}`,
          tipo: 'sistema',
        });
      }

      toast.success('✅ Processo adicionado à Gestão de Licitações!');
      if (navigateTo) navigate(navigateTo);
      return data?.id;
    } catch (err) {
      console.error(err);
      toast.error('Erro ao iniciar processo.');
      return null;
    }
  }, [user, navigate]);

  /** Update licitação status and create notification */
  const atualizarStatus = useCallback(async (
    licitacaoId: string,
    novoStatus: string,
    detalhes?: string
  ) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('licitacoes')
        .update({ status: novoStatus })
        .eq('id', licitacaoId)
        .eq('user_id', user.id);

      if (error) throw error;

      // System message in chat
      await supabase.from('licitacao_mensagens').insert({
        licitacao_id: licitacaoId,
        user_id: user.id,
        conteudo: `🔄 Status atualizado para **${novoStatus}**${detalhes ? `\n${detalhes}` : ''}`,
        tipo: 'sistema',
      });

      // Notification
      await criarNotificacao(
        `Status atualizado: ${novoStatus}`,
        detalhes || `Licitação teve seu status alterado para ${novoStatus}.`,
        '/licitacoes',
        novoStatus === 'Vencida' || novoStatus === 'Homologada' ? 'sucesso' : 'info'
      );
    } catch (err) {
      console.error(err);
      toast.error('Erro ao atualizar status.');
    }
  }, [user]);

  /** Record dispute result from Robô de Lances */
  const registrarResultadoDisputa = useCallback(async (
    licitacaoId: string,
    resultado: 'venceu' | 'perdeu',
    valorFinal?: number
  ) => {
    if (!user) return;

    const novoStatus = resultado === 'venceu' ? 'Vencida' : 'Perdida';

    try {
      const updateData: Record<string, unknown> = {
        status: novoStatus,
        resultado: resultado === 'venceu' ? 'Vencedor' : 'Perdedor',
      };
      if (valorFinal && resultado === 'venceu') {
        updateData.valor_adjudicado = valorFinal;
      }

      await supabase
        .from('licitacoes')
        .update(updateData)
        .eq('id', licitacaoId)
        .eq('user_id', user.id);

      // System message
      await supabase.from('licitacao_mensagens').insert({
        licitacao_id: licitacaoId,
        user_id: user.id,
        conteudo: resultado === 'venceu'
          ? `🏆 **Disputa vencida!** Valor final: R$ ${valorFinal?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || 'N/I'}`
          : `❌ Disputa encerrada — não foi possível vencer este item.`,
        tipo: 'sistema',
      });

      // Notification
      await criarNotificacao(
        resultado === 'venceu' ? '🏆 Disputa vencida!' : '❌ Disputa perdida',
        resultado === 'venceu'
          ? `Parabéns! Você venceu a disputa${valorFinal ? ` com valor R$ ${valorFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}.`
          : 'A disputa foi encerrada sem sucesso.',
        '/licitacoes',
        resultado === 'venceu' ? 'sucesso' : 'alerta'
      );

      toast.success(resultado === 'venceu' ? '🏆 Vitória registrada!' : 'Resultado registrado.');
    } catch (err) {
      console.error(err);
    }
  }, [user]);

  /** Create a notification */
  const criarNotificacao = useCallback(async (
    titulo: string,
    mensagem: string,
    link?: string,
    tipo?: string
  ) => {
    if (!user) return;
    try {
      await supabase.from('notificacoes').insert({
        user_id: user.id,
        titulo,
        mensagem,
        link,
        tipo: tipo || 'info',
      });
    } catch (err) {
      console.error('Erro ao criar notificação:', err);
    }
  }, [user]);

  return {
    iniciarProcesso,
    atualizarStatus,
    registrarResultadoDisputa,
    criarNotificacao,
  };
}
