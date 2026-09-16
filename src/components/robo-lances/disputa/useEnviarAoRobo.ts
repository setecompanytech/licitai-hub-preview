import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuditLog } from '@/hooks/useAuditLog';
import { agenteOpera, idDoPortal, nomeDoPortal } from '@/lib/robo/portais';
import type { LanceConfig } from '@/components/robo-lances/ConfigurarLanceDialog';
import type { NivelAutomacao } from '@/components/robo-lances/NivelAutomacaoSelector';
import type { EstadoDoRoboDaEmpresa } from '@/components/robo-lances/cliente/useRoboDaEmpresa';

/**
 * "Enviar ao robô" — manda UMA disputa para o serviço de execução, de verdade.
 *
 * Até 08/09/2026 NADA na interface fazia isto. A edge function `enviar-sessao`
 * existia, o agente tinha a rota `/sessao/iniciar`, e as duas pontas nunca se
 * encontraram — "Iniciar disputa" apenas mudava a coluna `status` no banco.
 *
 * Enviar NÃO significa dar lance: sem portal com envio liberado, a estratégia
 * devolve "aguardar" em toda rodada. O robô entra, navega e lê.
 *
 * Saiu de `pages/RoboLances.tsx` em 14/09/2026, quando o botão passou a morar
 * no cabeçalho da página da disputa. Mesmo fluxo, mesmas recusas, mesma trilha.
 */
export interface OpcoesDoEnvio {
  empresaId: string | null | undefined;
  /** Ligado/desligado da empresa — robô desligado é recusado antes da ida ao servidor. */
  estadoDoRobo: EstadoDoRoboDaEmpresa;
  /** Relê o ligado/desligado quando o servidor responde 409. */
  relerLigado: () => void;
  /** O que a `situacao-do-robo` diz que o robô no ar opera. Sem resposta, não barra. */
  portaisSuportados: string[] | null | undefined;
  nivel: NivelAutomacao;
  /** O robô aceitou a sessão — a tela relê a participação. Não inicia nada. */
  aoAceitar?: () => void;
}

export function useEnviarAoRobo({ empresaId, estadoDoRobo, relerLigado, portaisSuportados, nivel, aoAceitar }: OpcoesDoEnvio) {
  const { registrar } = useAuditLog();
  const [enviando, setEnviando] = useState(false);

  const enviar = async (lance: LanceConfig): Promise<boolean> => {
    // Robô desligado pela empresa: o servidor recusaria de qualquer jeito, mas
    // a recusa chegaria depois de uma ida e volta, com texto de servidor. Aqui
    // a pessoa lê o motivo e onde resolver. Migration pendente e leitura não
    // confirmada NÃO barram — nesses casos ninguém desligou nada.
    if (estadoDoRobo.confirmado && !estadoDoRobo.migracaoPendente && !estadoDoRobo.ligado) {
      toast.error('O robô da empresa está desligado. Ligue-o no topo da lista do robô de lances para iniciar sessões.', {
        duration: 10000,
      });
      return false;
    }

    const portalId = idDoPortal(lance.portal);
    if (!portalId) {
      toast.error(`Portal "${lance.portal}" não é um dos que o robô sabe operar.`, { duration: 10000 });
      return false;
    }

    // Reconhecer o portal não é o mesmo que o robô NO AR saber operá-lo. A
    // pergunta vai à `situacao-do-robo`, que responde sem expor a máquina. A
    // lista é aceita no vocabulário do agente ou no do armazenamento, porque os
    // dois diferem justamente no Compras.gov. Sem resposta, não barra: o
    // servidor repete a validação e é a autoridade final.
    if (portaisSuportados?.length && !agenteOpera(portalId, portaisSuportados) && !portaisSuportados.includes(portalId)) {
      toast.error(`O robô ainda não opera no portal ${nomeDoPortal(portalId)}.`, { duration: 12000 });
      return false;
    }

    setEnviando(true);
    try {
      const { data, error } = await supabase.functions.invoke('robo-lances-webhook/enviar-sessao', {
        body: {
          lance_config_id: lance.id,
          portal_id: portalId,
          portal_nome: nomeDoPortal(lance.portal),
          edital: lance.edital,
          valor_referencia: lance.valorReferencia,
          valor_inicial: lance.valorInicial,
          valor_minimo: lance.valorMinimo,
          decremento_min: lance.decrementoMin,
          decremento_percentual: lance.decrementoPercentual,
          intervalo_segundos: lance.intervaloSegundos,
          max_lances: lance.maxLances,
          // Os três valores do item viajam SEPARADOS de propósito: preço de
          // venda, custo e estimativa do órgão colapsados num campo só viram
          // "R$ alguma coisa", e depois de gravados não dá para saber qual
          // âncora a disputa usava.
          empresa_id: empresaId ?? null,
          licitacao_id: lance.licitacaoId ?? null,
          tipo_disputa: lance.tipoDisputa,
          // Compras.gov: o número da compra se repete entre órgãos; a UASG desambigua.
          uasg: lance.uasg ?? null,
          // Com o lance liberado no Compras.gov, é o que decide se o robô dá
          // lance ou só acompanha (o servidor prefere o valor gravado).
          modo_automatico: lance.modoAutomatico === true,
          itens: (lance.itens || []).map((i) => ({
            // Vínculo estável com `licitacao_itens` — o servidor confere se o
            // item ainda existe antes de gravar.
            licitacao_item_id: i.licitacaoItemId ?? null,
            numero: i.numero,
            lote: i.lote,
            descricao: i.descricao,
            marca: i.marca ?? null,
            modelo: i.modelo ?? null,
            quantidade: i.quantidade,
            unidade: i.unidade,
            preco_venda: i.valorReferencia > 0 ? i.valorReferencia : null,
            custo_unitario: i.custoUnitario ?? null,
            valor_estimado_orgao: i.valorEstimadoOrgao ?? null,
            // `null` viaja como `null`: piso ausente é decisão que ninguém tomou,
            // e o agente precisa distinguir isso de zero.
            valor_minimo: i.valorMinimo ?? null,
            // Vazio viaja vazio: o agente trata como melhor preço.
            estrategia: i.estrategia ?? null,
            margem_desempate: i.margemDesempate ?? null,
            origem: i.origem ?? null,
            disputando: i.disputando,
          })),
        },
      });

      // A mensagem real do servidor, nunca um "erro ao enviar" genérico.
      //
      // Ler `error.message` NÃO basta: com resposta não-2xx, o supabase-js
      // devolve a frase literal "Edge Function returned a non-2xx status code"
      // e guarda o corpo — onde está a causa — em `error.context`.
      //
      // Contrato do servidor (14/09/2026): recusa do agente vem como 502
      // `{ success: false, error }`, e robô desligado pela empresa como 409 —
      // nos dois, `error` já é a frase para mostrar. Sem corpo legível, a frase
      // de transporte vai ao console, não à tela.
      let motivo = (data as { error?: string } | null)?.error;

      if (!motivo && error) {
        const contexto = (error as { context?: Response }).context;
        if (contexto && typeof contexto.json === 'function') {
          const corpo = await contexto.json().catch(() => null);
          motivo = (corpo as { error?: string } | null)?.error;
        }
        // 409: o servidor diz que o robô está desligado. Se a tela ainda o
        // mostrava ligado, relê agora — o selo não pode contradizer a recusa.
        if (contexto?.status === 409) relerLigado();
        if (!motivo) {
          console.error('[robo-lances] enviar-sessao sem motivo legível', contexto?.status, error.message);
          motivo = 'O robô não aceitou a sessão e não informou o motivo. Tente de novo ou fale com o suporte.';
        }
      }

      if (motivo) {
        toast.error(motivo, { duration: 15000 });
        return false;
      }

      registrar(
        'sessao_criada',
        { portal: portalId, edital: lance.edital, origem: 'botao_enviar_ao_robo' },
        { licitacaoId: lance.licitacaoId, nivelAutomacao: nivel },
      );
      // `entrando`: o robô aceitou e ainda está no login ou esperando a
      // verificação do gov.br — o resultado chega pelos avisos (16/09/2026).
      if ((data as { entrando?: boolean } | null)?.entrando) {
        toast.success('Sessão aceita. O robô ainda está entrando no portal — você será avisado quando ele chegar à sala.', { duration: 8000 });
      } else {
        toast.success('Sessão aceita pelo robô.', { duration: 6000 });
      }
      aoAceitar?.();
      return true;
    } catch (e) {
      // Exceção de transporte (rede, função fora do ar) — texto de máquina.
      console.error('[robo-lances] enviar-sessao', e);
      toast.error('Não foi possível falar com o robô agora. Tente de novo em instantes.', { duration: 15000 });
      return false;
    } finally {
      setEnviando(false);
    }
  };

  return { enviando, enviar };
}
