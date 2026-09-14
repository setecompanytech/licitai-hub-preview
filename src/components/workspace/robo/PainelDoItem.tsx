import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import ListaDeCampos, { BlocoDoPainel, type Campo } from '@/components/gestao/ListaDeCampos';
import { AvisoDeFalha } from '@/components/gestao/SeloSituacao';
import type { ParticipacaoCarregada } from '@/hooks/useParticipacoesDoRobo';
import { useLancesDaSessao } from './consultas';
import type { LinhaDoItem } from './itens-da-disputa';
import { LimiteDoItem, NaoInformado } from './ValoresDoItem';
import { dataHoraDeBrasilia, formatarMoeda, formatarPercentual } from './formatos';

/**
 * Detalhe sob demanda: o item escolhido, a estratégia da disputa, a origem do
 * limite e o histórico de lances da sessão.
 *
 * Mora no painel, e não na tabela, porque é o que se consulta — não o que se
 * vigia. O histórico só é lido quando o painel abre: numa sessão longa são
 * dezenas de linhas que ninguém pediu a cada releitura de 15 s.
 */

interface PainelDoItemProps {
  participacao: ParticipacaoCarregada;
  /** `null` = painel aberto pela estratégia, sem item escolhido. */
  linha: LinhaDoItem | null;
  origemDaVersao: ReactNode;
  gatilho: number;
}

const ROTULO_DO_TIPO: Record<string, string> = { meu: 'Seu lance', concorrente: 'Concorrente' };

function lideranca(linha: LinhaDoItem): ReactNode {
  const lider = linha.daSessao?.sou_lider;
  if (lider === true) return 'Você lidera';
  if (lider === false) return 'Outro participante lidera';
  return <NaoInformado texto="Não informado pelo portal" />;
}

export default function PainelDoItem({ participacao, linha, origemDaVersao, gatilho }: PainelDoItemProps) {
  const { disputa, sessao } = participacao;
  const lances = useLancesDaSessao(sessao?.id ?? null, gatilho);
  const ouNaoInformado = (texto: string | null) => texto ?? <NaoInformado />;

  const camposDoItem: Campo[] = linha
    ? [
        ...(linha.lote ? [{ rotulo: 'Lote', valor: linha.lote }] : []),
        { rotulo: 'Produto', valor: linha.descricao || <NaoInformado />, largo: true },
        { rotulo: 'Seu último lance', valor: ouNaoInformado(formatarMoeda(linha.daSessao?.seu_ultimo_lance)), numerico: true },
        { rotulo: 'Melhor lance', valor: ouNaoInformado(formatarMoeda(linha.daSessao?.melhor_lance)), numerico: true },
        { rotulo: 'Liderança', valor: lideranca(linha) },
        {
          rotulo: 'Limite autorizado',
          valor: <LimiteDoItem valor={linha.limite} confirmado={!!disputa.limites_confirmados_em} />,
          numerico: true,
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-5">
      {linha && (
        <BlocoDoPainel titulo={linha.numero !== null ? `Item ${linha.numero}` : 'Item sem número'}>
          <ListaDeCampos campos={camposDoItem} />
          {sessao && !linha.daSessao && (
            <p className="g-meta text-muted-foreground">
              O serviço não registrou este item na sessão — nenhum item com o mesmo identificador, ou com o
              mesmo lote e número.
            </p>
          )}
        </BlocoDoPainel>
      )}

      <BlocoDoPainel titulo="Estratégia">
        <ListaDeCampos
          campos={[
            {
              rotulo: 'Modo',
              valor:
                disputa.modo_automatico === true
                  ? 'Lances automáticos'
                  : disputa.modo_automatico === false
                    ? 'Sem lances automáticos'
                    : <NaoInformado />,
            },
            { rotulo: 'Decremento mínimo', valor: ouNaoInformado(formatarMoeda(disputa.decremento_min)), numerico: true },
            {
              rotulo: 'Decremento percentual',
              valor: ouNaoInformado(formatarPercentual(disputa.decremento_percentual)),
              numerico: true,
            },
            {
              rotulo: 'Intervalo entre lances',
              valor: disputa.intervalo_segundos != null ? `${disputa.intervalo_segundos} s` : <NaoInformado />,
              numerico: true,
            },
            {
              rotulo: 'Máximo de lances',
              valor: disputa.max_lances != null ? String(disputa.max_lances) : <NaoInformado />,
              numerico: true,
            },
          ]}
        />
      </BlocoDoPainel>

      <BlocoDoPainel titulo="Origem do limite">
        <ListaDeCampos
          campos={[
            { rotulo: 'Versão da precificação', valor: origemDaVersao, largo: true },
            {
              rotulo: 'Confirmação do serviço',
              valor: disputa.limites_confirmados_em
                ? `Confirmados em ${dataHoraDeBrasilia(disputa.limites_confirmados_em)} • horário de Brasília`
                : 'Não confirmado pelo serviço',
              largo: true,
            },
          ]}
        />
      </BlocoDoPainel>

      <BlocoDoPainel titulo="Histórico de lances">
        <p className="g-meta text-muted-foreground">
          Lances da sessão inteira confirmados pelo agente — o registro não identifica o item. Horário de
          Brasília.
        </p>
        {!sessao ? (
          <p className="g-corpo text-muted-foreground">Sem sessão do robô — nenhum lance registrado.</p>
        ) : lances.estado === 'carregando' || lances.estado === 'ociosa' ? (
          <div role="status" aria-busy="true" className="flex flex-col gap-2">
            <span className="sr-only">Carregando histórico de lances…</span>
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : lances.estado === 'migracao_pendente' ? (
          <p className="g-corpo text-warning-ink">Migração pendente — o histórico da sessão ainda não está disponível no banco.</p>
        ) : lances.estado === 'erro' ? (
          <AvisoDeFalha aoTentarNovamente={lances.recarregar}>
            Não foi possível ler o histórico de lances: {lances.erro}
          </AvisoDeFalha>
        ) : !lances.dados?.length ? (
          <p className="g-corpo text-muted-foreground">Nenhum lance confirmado pelo agente nesta sessão.</p>
        ) : (
          <ol className="flex flex-col divide-y divide-border">
            {lances.dados.map((lance) => (
              <li key={lance.id} className="flex items-center justify-between gap-3 py-2">
                <span className="flex min-w-0 flex-col">
                  <span className="g-corpo text-foreground">{ROTULO_DO_TIPO[lance.tipo] ?? lance.tipo}</span>
                  <time dateTime={lance.timestamp_lance} className="g-meta tabular-nums text-muted-foreground">
                    {dataHoraDeBrasilia(lance.timestamp_lance, { segundos: true }) ?? 'Horário não informado'}
                  </time>
                </span>
                <span className="g-corpo shrink-0 font-medium tabular-nums text-foreground">
                  {formatarMoeda(lance.valor) ?? <NaoInformado />}
                </span>
              </li>
            ))}
          </ol>
        )}
      </BlocoDoPainel>

      <Link
        to={{ search: '?aba=documentos' }}
        replace
        className="g-corpo inline-flex min-h-[44px] items-center gap-1.5 self-start rounded-[var(--g-raio)] font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <FileText aria-hidden="true" className="h-4 w-4" />
        Documentos do processo
      </Link>
    </div>
  );
}
