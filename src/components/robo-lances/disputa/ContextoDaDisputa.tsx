import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import type { LanceConfig } from '@/components/robo-lances/ConfigurarLanceDialog';
import type { CapacidadeDoServico, DisputaCarregada, ParticipacaoCarregada } from '@/hooks/useParticipacoesDoRobo';
import { lanceLiberadoNoPortal } from '@/lib/robo/situacao-da-participacao';
import type { Leitura, VersaoVinculada } from '@/components/workspace/robo/consultas';
import { linhasDaDisputa } from '@/components/workspace/robo/itens-da-disputa';
import { horaDeBrasilia } from '@/components/workspace/robo/formatos';
import { cn } from '@/lib/utils';
import { descreverVersao, pendenciaVisivel } from './leitura-da-participacao';

type Tom = 'ok' | 'atencao' | 'neutro';

function ItemDoContexto({
  rotulo,
  valor,
  detalhe,
  tom,
}: {
  rotulo: string;
  valor: ReactNode;
  detalhe?: ReactNode;
  tom: Tom;
}) {
  const Icone = tom === 'ok' ? CheckCircle2 : tom === 'atencao' ? AlertTriangle : Clock;
  return (
    <div className="flex min-w-0 flex-col gap-0.5 bg-card px-4 py-3">
      <dt className="g-meta text-muted-foreground">{rotulo}</dt>
      <dd
        className={cn(
          'g-corpo inline-flex items-start gap-1.5 font-medium',
          tom === 'atencao' ? 'text-warning-ink' : 'text-foreground',
        )}
      >
        <Icone
          aria-hidden="true"
          className={cn('mt-0.5 h-4 w-4 shrink-0', tom === 'ok' && 'text-success-ink', tom === 'neutro' && 'text-muted-foreground')}
        />
        <span className="min-w-0">{valor}</span>
      </dd>
      {detalhe && <dd className="g-meta text-muted-foreground">{detalhe}</dd>}
    </div>
  );
}

/**
 * A faixa de contexto sob o cabeçalho: as três condições que decidem se o robô
 * pode fazer alguma coisa nesta disputa, lado a lado, sem clique.
 *
 *   Precificação   — de onde vêm os limites (versão aprovada, ou nenhuma)
 *   Limites        — quantos itens têm limite, e se o serviço os confirmou
 *   Envio de lances — se este portal aceita lance ou é só monitoramento
 *
 * Na tela antiga as três viviam em lugares diferentes (selo na lista, aviso no
 * topo, bloco na coluna da direita), e a pessoa juntava a resposta de cabeça.
 * Uma linha no desktop; empilha no celular.
 *
 * Os limites vêm da precificação aprovada — nunca de percentual inventado sobre
 * o valor de referência (foi o que tirou o "Painel de Risco" da tela).
 */
export default function ContextoDaDisputa({
  linha,
  lance,
  versao,
  capacidade,
  participacao,
}: {
  linha: DisputaCarregada;
  lance: LanceConfig;
  versao: Leitura<VersaoVinculada>;
  capacidade: CapacidadeDoServico;
  participacao: ParticipacaoCarregada | null;
}) {
  const versaoDescrita = descreverVersao(linha.precificacao_versao_id, versao);
  const tomDaVersao: Tom = versaoDescrita.atencao ? 'atencao' : versao.estado === 'pronta' ? 'ok' : 'neutro';

  // Mesmo critério da projeção: limite é `valorMinimo > 0`; zero é "ninguém decidiu".
  const itens = linhasDaDisputa(linha.itens, null);
  const total = itens.length;
  const comLimite = itens.filter((i) => i.limite !== null).length;
  const limitesTexto =
    total > 0
      ? `${comLimite} de ${total} ${total === 1 ? 'item' : 'itens'} com limite`
      : lance.valorMinimo > 0
        ? 'Piso da disputa definido, sem itens cadastrados'
        : 'Nenhum item nem piso definido';
  const limitesCompletos = total > 0 ? comLimite === total : lance.valorMinimo > 0;
  const confirmacao = linha.limites_confirmados_em
    ? `Confirmados pelo serviço às ${horaDeBrasilia(linha.limites_confirmados_em)} • horário de Brasília`
    : 'Não confirmados pelo serviço';

  // Sem declaração do agente, nenhum portal está liberado — a tela nunca simula envio.
  const envioIndisponivel =
    capacidade.fonte === 'nao_verificada' || !lanceLiberadoNoPortal(linha.portal, capacidade.portaisComLanceLiberado);

  const pendencia = participacao ? pendenciaVisivel(participacao.projecao, envioIndisponivel) : null;
  const proximaAcao = participacao?.projecao.proximaAcao ?? null;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <dl
        aria-label="Condições da disputa"
        className="grid grid-cols-1 gap-px overflow-hidden rounded-[var(--g-raio)] border border-border bg-border sm:grid-cols-3"
      >
        <ItemDoContexto
          rotulo="Precificação"
          tom={tomDaVersao}
          valor={versaoDescrita.texto}
          detalhe={
            versaoDescrita.podeTentar ? (
              <button
                type="button"
                onClick={versao.recarregar}
                className="font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Tentar novamente
              </button>
            ) : undefined
          }
        />
        <ItemDoContexto
          rotulo="Limites"
          tom={limitesCompletos ? 'ok' : 'atencao'}
          valor={limitesTexto}
          detalhe={confirmacao}
        />
        <ItemDoContexto
          rotulo="Envio de lances"
          tom={envioIndisponivel ? 'atencao' : 'ok'}
          valor={envioIndisponivel ? 'Indisponível neste portal — somente monitoramento' : 'Liberado neste portal'}
          detalhe={
            envioIndisponivel && capacidade.fonte === 'nao_verificada'
              ? 'Nenhum agente declarou em que portal pode enviar lance.'
              : undefined
          }
        />
      </dl>

      {(pendencia || proximaAcao) && (
        <p className="g-meta text-muted-foreground">
          {pendencia && (
            <>
              Pendência: <span className="text-foreground">{pendencia}</span>
            </>
          )}
          {pendencia && proximaAcao && ' · '}
          {proximaAcao && (
            <>
              Próxima ação: <span className="text-foreground">{proximaAcao}</span>
            </>
          )}
        </p>
      )}
    </div>
  );
}
