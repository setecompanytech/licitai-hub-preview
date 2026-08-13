import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { normalizarModalidade } from '@/lib/metas/modalidades';
import { useActivityLog } from '@/hooks/useActivityLog';

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
  // Coordenadas PNCP — usadas por edital-auto-ingest para extrair itens
  pncpNumero?: string | null;
  cnpjOrgao?: string | null;
  anoCompra?: number | string | null;
  sequencialCompra?: number | string | null;
};

export function useLicitacaoIntegration() {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const navigate = useNavigate();
  // A trilha mora aqui, no ponto único de escrita, e não nas telas: é o que
  // faz auditoria ser consequência estrutural em vez de disciplina de quem
  // escreve a próxima tela.
  const { registrar } = useActivityLog();

  /** Create a licitação from edital data and optionally navigate */
  const iniciarProcesso = useCallback(async (edital: EditalData, navigateTo?: string) => {
    if (!user) {
      toast.error('Faça login para iniciar um processo.');
      return null;
    }

    try {
      // Duplicidade agora é por EMPRESA, não por pessoa: com o processo sendo
      // da empresa, dois colegas puxando o mesmo edital do monitoramento
      // criariam dois processos concorrentes para a mesma licitação.
      let dedup = supabase
        .from('licitacoes')
        .select('id')
        .eq('numero', edital.numero)
        .eq('orgao', edital.orgao);
      dedup = empresaAtiva
        ? dedup.eq('empresa_id', empresaAtiva.id)
        : dedup.eq('user_id', user.id);
      const { data: existing } = await dedup.maybeSingle();

      if (existing) {
        toast.info('Esta licitação já está na gestão da empresa.');
        if (navigateTo) navigate(navigateTo);
        return existing.id;
      }

      const { data, error } = await supabase
        .from('licitacoes')
        .insert({
          user_id: user.id,
          // Sem isto a licitação nasce órfã de empresa, e a view de realizado
          // do módulo de metas (que filtra empresa_id) deixa de contá-la como
          // participação. Foi o que aconteceu com as 33 primeiras.
          empresa_id: empresaAtiva?.id ?? null,
          // Dono operacional do processo. A coluna existia desde sempre e nunca
          // era preenchida — sem ela não há como responder "quem está tocando
          // este processo?" nem redistribuir carteira quando alguém sai.
          operador_id: user.id,
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
          numero_controle_pncp: edital.pncpNumero || null,
          cnpj_orgao: edital.cnpjOrgao || null,
          ano_compra: edital.anoCompra ? String(edital.anoCompra) : null,
          sequencial_compra: edital.sequencialCompra ? String(edital.sequencialCompra) : null,
        })
        .select('id')
        .single();

      if (error) throw error;

      await registrar({
        acao: 'processo_iniciado',
        modulo: 'licitacoes',
        descricao: `Processo ${edital.numero} — ${edital.orgao} iniciado a partir do monitoramento.`,
        licitacaoId: data.id,
        para: edital.status || 'Monitorando',
        metadata: { portal: edital.portal ?? null, modalidade: edital.modalidade ?? null },
      });

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

      // 🔄 Gatilho: prepara automaticamente a Pasta do Processo
      if (data?.id) {
        supabase.functions
          .invoke('processo-auto-prepare', { body: { licitacao_id: data.id } })
          .then(({ error: prepErr }) => {
            if (prepErr) console.warn('[auto-prepare] background:', prepErr);
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
  }, [user, navigate, empresaAtiva, registrar]);

  /**
   * Auto-create or reuse a compromisso (processos_interesse) linked to a licitação.
   * Sets default multichannel alerts (system + email) and links to the licitacao_id.
   * Returns the compromisso id (existing or new).
   */
  const criarCompromisso = useCallback(async (
    edital: EditalData,
    licitacaoId: string,
    empresaId?: string | null,
  ): Promise<string | null> => {
    if (!user) return null;
    try {
      // Reuse existing compromisso if same licitacao+user
      const { data: existing } = await supabase
        .from('processos_interesse')
        .select('id')
        .eq('user_id', user.id)
        .eq('licitacao_id', licitacaoId)
        .maybeSingle();
      if (existing?.id) return existing.id;

      const { data, error } = await supabase
        .from('processos_interesse')
        .insert({
          user_id: user.id,
          empresa_id: empresaId || null,
          licitacao_id: licitacaoId,
          numero: edital.numero,
          orgao: edital.orgao,
          objeto: edital.objeto,
          modalidade: edital.modalidade || 'Pregão',
          valor_estimado: edital.valor_estimado,
          uf: edital.uf,
          municipio: edital.municipio,
          data_abertura: edital.data_encerramento,
          data_encerramento: edital.data_encerramento,
          portal: edital.portal,
          url: edital.url,
          status: 'interessado',
          alerta_sistema: true,
          alerta_email: true,
          alerta_whatsapp: false,
          alerta_7dias: true,
          alerta_3dias: true,
          alerta_1dia: true,
        })
        .select('id')
        .single();
      if (error) throw error;
      return data?.id || null;
    } catch (err) {
      console.error('[criarCompromisso]', err);
      return null;
    }
  }, [user]);

  /**
   * Espelha o arquivamento no compromisso vinculado. O Kanban e a aba
   * Compromissos leem tabelas diferentes (`licitacoes` e `processos_interesse`),
   * então arquivar de um lado precisa refletir no outro.
   */
  const sincronizarCompromisso = useCallback(async (
    licitacaoId: string,
    arquivada: boolean,
  ) => {
    if (!user) return;
    try {
      await supabase
        .from('processos_interesse')
        .update({ status: arquivada ? 'arquivado' : 'interessado' })
        .eq('user_id', user.id)
        .eq('licitacao_id', licitacaoId);
    } catch (err) {
      console.error('[sincronizarCompromisso]', err);
    }
  }, [user]);

  /** Update licitação status and create notification */
  const atualizarStatus = useCallback(async (
    licitacaoId: string,
    novoStatus: string,
    detalhes?: string
  ) => {
    if (!user) return;

    try {
      // Lê o valor anterior antes de sobrescrever: sem o "de", a trilha registra
      // que algo mudou mas não o quê, que é metade de uma auditoria.
      const { data: antes } = await supabase
        .from('licitacoes')
        .select('status')
        .eq('id', licitacaoId)

        .maybeSingle();

      const { error } = await supabase
        .from('licitacoes')
        .update({ status: novoStatus })
        .eq('id', licitacaoId)
;

      if (error) throw error;

      await registrar({
        acao: 'status_alterado',
        modulo: 'licitacoes',
        descricao: detalhes,
        licitacaoId,
        de: antes?.status ?? null,
        para: novoStatus,
      });

      // Arquivar/desarquivar no Kanban reflete no compromisso
      const arquivada = novoStatus === 'Arquivada';
      const { data: compromisso } = await supabase
        .from('processos_interesse')
        .select('id, status')
        .eq('user_id', user.id)
        .eq('licitacao_id', licitacaoId)
        .maybeSingle();

      if (compromisso && (arquivada || compromisso.status === 'arquivado')) {
        await sincronizarCompromisso(licitacaoId, arquivada);
      }

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
  }, [user, sincronizarCompromisso, registrar]);

  /**
   * Registra a perda e só então move o processo para "Perdida".
   *
   * A ordem importa: o trigger `licitacoes_exigir_motivo_perda` recusa a
   * mudança de status enquanto não existir o registro em `comercial_perdas`.
   * Se o UPDATE falhar, o registro de perda é desfeito para não deixar um
   * processo "perdido" no relatório e "em disputa" no Kanban.
   */
  const registrarPerda = useCallback(async (params: {
    licitacaoId: string;
    empresaId: string;
    motivoId: string;
    observacao?: string;
    modalidade?: string | null;
    valorEstimado?: number | null;
  }) => {
    if (!user) return false;

    const { data: perda, error: erroPerda } = await supabase
      .from('comercial_perdas')
      .insert({
        empresa_id: params.empresaId,
        licitacao_id: params.licitacaoId,
        user_id: user.id,
        motivo_id: params.motivoId,
        observacao: params.observacao || null,
        valor_estimado: params.valorEstimado ?? null,
        modalidade_codigo: normalizarModalidade(params.modalidade),
        registrado_por: user.id,
      })
      .select('id')
      .single();

    if (erroPerda) {
      console.error('[registrarPerda]', erroPerda);
      toast.error(
        erroPerda.code === '23505'
          ? 'Este processo já tem uma perda registrada.'
          : 'Não foi possível registrar o motivo da perda.',
      );
      return false;
    }

    const { error: erroStatus } = await supabase
      .from('licitacoes')
      .update({ status: 'Perdida', resultado: 'Perdedor' })
      .eq('id', params.licitacaoId)
;

    if (erroStatus) {
      // Desfaz para não deixar os dois módulos discordando entre si
      await supabase.from('comercial_perdas').delete().eq('id', (perda as { id: string }).id);
      console.error('[registrarPerda] status', erroStatus);
      toast.error('Motivo registrado, mas não foi possível atualizar o processo. Nada foi salvo.');
      return false;
    }

    await supabase.from('licitacao_mensagens').insert({
      licitacao_id: params.licitacaoId,
      user_id: user.id,
      conteudo: `❌ Processo marcado como **Perdido**.${params.observacao ? `\nObservação: ${params.observacao}` : ''}`,
      tipo: 'sistema',
    });

    await registrar({
      acao: 'perda_registrada',
      modulo: 'licitacoes',
      descricao: params.observacao || 'Perda registrada com motivo.',
      licitacaoId: params.licitacaoId,
      para: 'Perdida',
      metadata: { motivo_id: params.motivoId ?? null },
    });

    toast.success('Perda registrada.');
    return true;
  }, [user, registrar]);

  /**
   * Arquiva (ou restaura) um processo a partir de qualquer uma das telas,
   * mantendo Kanban e Compromissos na mesma situação.
   *
   * Arquivamento é o eixo de VISIBILIDADE e mora só em `arquivado_em`. A versão
   * anterior também gravava status='Arquivada' ao arquivar e 'Monitorando' ao
   * restaurar — ou seja, um processo Homologado arquivado e restaurado voltava
   * como Monitorando, apagando silenciosamente o desfecho que alimenta os KPIs
   * "Ganhas" e "Valor Ganho" do painel. Não tocar em `status` torna a operação
   * reversível de verdade.
   */
  const arquivarProcesso = useCallback(async (
    licitacaoId: string,
    arquivar = true,
  ) => {
    if (!user) return false;
    try {
      const { error } = await supabase
        .from('licitacoes')
        .update({ arquivado_em: arquivar ? new Date().toISOString() : null })
        .eq('id', licitacaoId)
;
      if (error) throw error;

      await registrar({
        acao: arquivar ? 'processo_arquivado' : 'processo_restaurado',
        modulo: 'licitacoes',
        descricao: arquivar
          ? 'Processo arquivado — sai do painel e continua consultável no histórico.'
          : 'Processo restaurado ao painel com o desfecho preservado.',
        licitacaoId,
      });

      await sincronizarCompromisso(licitacaoId, arquivar);
      return true;
    } catch (err) {
      console.error('[arquivarProcesso]', err);
      toast.error(arquivar ? 'Erro ao arquivar processo.' : 'Erro ao restaurar processo.');
      return false;
    }
  }, [user, sincronizarCompromisso, registrar]);

  /**
   * Remove a licitação e o compromisso vinculado. Sem isso o compromisso fica
   * órfão (`licitacao_id` vira NULL pelo ON DELETE SET NULL) e o processo
   * continua aparecendo na aba Compromissos depois de excluído no Kanban.
   */
  const excluirProcesso = useCallback(async (licitacaoId: string) => {
    if (!user) return false;
    try {
      // Guarda a identificação antes de apagar: depois do DELETE não há de onde
      // tirar "qual processo foi excluído", e é a pergunta mais provável de uma
      // auditoria de exclusão.
      const { data: alvo } = await supabase
        .from('licitacoes')
        .select('numero, orgao, status')
        .eq('id', licitacaoId)

        .maybeSingle();

      await supabase
        .from('processos_interesse')
        .delete()
        .eq('user_id', user.id)
        .eq('licitacao_id', licitacaoId);

      const { error } = await supabase
        .from('licitacoes')
        .delete()
        .eq('id', licitacaoId)
;
      if (error) throw error;

      await registrar({
        acao: 'processo_excluido',
        modulo: 'licitacoes',
        descricao: alvo ? `Processo ${alvo.numero} — ${alvo.orgao} excluído.` : 'Processo excluído.',
        licitacaoId,
        de: alvo?.status ?? null,
        metadata: { numero: alvo?.numero ?? null, orgao: alvo?.orgao ?? null },
      });

      return true;
    } catch (err) {
      console.error('[excluirProcesso]', err);
      return false;
    }
  }, [user, registrar]);

  /** Record dispute result from Robô de Lances */
  const registrarResultadoDisputa = useCallback(async (
    licitacaoId: string,
    resultado: 'venceu' | 'perdeu',
    valorFinal?: number
  ) => {
    if (!user) return;

    // Derrota exige motivo. Quem chama precisa ter passado por registrarPerda
    // antes; sem o registro, o banco recusaria a mudança de status e a
    // exceção do trigger apareceria como erro cru para o usuário.
    if (resultado === 'perdeu') {
      const { data: perda } = await supabase
        .from('comercial_perdas')
        .select('id')
        .eq('licitacao_id', licitacaoId)
        .maybeSingle();

      if (!perda) {
        toast.error('Registre o motivo da perda para encerrar a disputa como derrota.');
        return;
      }
    }

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
;

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
    criarCompromisso,
    atualizarStatus,
    registrarPerda,
    arquivarProcesso,
    excluirProcesso,
    registrarResultadoDisputa,
    criarNotificacao,
  };
}
