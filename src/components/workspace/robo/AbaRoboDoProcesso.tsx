import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Building2, CheckCircle2, ChevronRight, Crosshair, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { SecaoGestao } from '@/components/gestao/TelaGestao';
import TabelaGestao, { type ColunaGestao } from '@/components/gestao/TabelaGestao';
import AreaComPainel from '@/components/gestao/AreaComPainel';
import SeloSituacao, { AvisoDeContexto, AvisoDeFalha } from '@/components/gestao/SeloSituacao';
import FonteDaFaseTexto from '@/components/robo-lances/disputa/FonteDaFase';
import { TOM_DA_ABA, descreverVersao, pendenciaVisivel } from '@/components/robo-lances/disputa/leitura-da-participacao';
import { useParticipacoesDoRobo } from '@/hooks/useParticipacoesDoRobo';
import { ROTULO_DA_ABA, ROTULO_DO_ESTADO_DO_ROBO } from '@/lib/robo/situacao-da-participacao';
import { normalizarStatus } from '@/lib/licitacao/status';
import { cn } from '@/lib/utils';
import ControleDoRobo from './ControleDoRobo';
import PainelDoItem from './PainelDoItem';
import { useItensDaSessao, useRelogio, useVersaoVinculada } from './consultas';
import { linhasDaDisputa, situacaoDoItem, type LinhaDoItem } from './itens-da-disputa';
import { LimiteDoItem, NaoInformado } from './ValoresDoItem';
import { dataHoraDeBrasilia, formatarMoeda, horaDeBrasilia } from './formatos';

/**
 * Aba "Robô de Lances" da pasta do processo.
 *
 * Mostra SÓ a participação deste processo, desta empresa. O painel geral
 * (`/robo-lances`) tem as quatro abas do certame — Cadastradas, Configuradas,
 * Em disputa, Encerradas —; repeti-las aqui daria duas telas para decidir a
 * mesma coisa e, cedo ou tarde, duas respostas. Aqui vai um indicador de
 * situação e o caminho para o painel.
 *
 * ── O que a aba NÃO afirma ──────────────────────────────────────────────────
 *
 *  - Estado da proposta no portal: não existe entidade que o guarde. A linha
 *    diz "não rastreada", em vez de inventar "enviada".
 *  - Envio de lance sem capacidade declarada pelo agente: vira "somente
 *    monitoramento", nunca uma simulação com cara de envio.
 *  - Lance por item sem casamento inequívoco: "Não informado" (ver
 *    `itens-da-disputa.ts`).
 *
 * ── Nada implícito ──────────────────────────────────────────────────────────
 *
 * A aba só lê. Montar, desmontar, trocar de participação ou de empresa não
 * inicia, para, nem transfere nada — o único comando é "Parar robô nesta
 * disputa", por clique confirmado.
 */

interface AbaRoboDoProcessoProps {
  licitacaoId: string;
  empresaId: string | null;
}

/** Leitura sem renovar há mais de três ciclos de 15 s é leitura parada. */
const LEITURA_ATRASADA_MS = 45_000;

// `TOM_DA_ABA`, `FonteDaFaseTexto`, `descreverVersao` e `pendenciaVisivel`
// moravam aqui e foram para `robo-lances/disputa/` (14/09/2026): a página da
// disputa diz as mesmas coisas sobre a mesma participação, com as mesmas frases.

const CLASSE_LINK =
  'g-corpo inline-flex min-h-[44px] items-center gap-1 rounded-[var(--g-raio)] font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export default function AbaRoboDoProcesso({ licitacaoId, empresaId }: AbaRoboDoProcessoProps) {
  const { participacoes, carregando, erro, semEmpresa, lidoEm, capacidade, recarregar } = useParticipacoesDoRobo({
    empresaId,
    licitacaoId,
    intervaloSegundos: 15,
  });
  const [disputaEscolhida, setDisputaEscolhida] = useState<string | null>(null);
  const [painel, setPainel] = useState<{ chave: string | null } | null>(null);
  const agora = useRelogio(15_000);

  const participacao = participacoes.find((p) => p.disputa.id === disputaEscolhida) ?? participacoes[0] ?? null;
  const disputaId = participacao?.disputa.id ?? null;
  const sessaoId = participacao?.sessao?.id ?? null;
  // Itens da sessão releem junto com a participação: os dois envelhecem juntos.
  const gatilho = lidoEm ? lidoEm.getTime() : 0;

  const versao = useVersaoVinculada(participacao?.disputa.precificacao_versao_id ?? null);
  const itensDaSessao = useItensDaSessao(sessaoId, gatilho);
  const itensDaDisputa = participacao?.disputa.itens;
  const dadosDaSessao = itensDaSessao.dados;
  const linhas = useMemo(() => linhasDaDisputa(itensDaDisputa, dadosDaSessao), [itensDaDisputa, dadosDaSessao]);

  // Outra participação, outro detalhe: o painel não sobrevive à troca.
  useEffect(() => {
    setPainel(null);
  }, [disputaId]);

  const tentarDeNovo = () => {
    void recarregar();
  };

  if (semEmpresa) {
    return (
      <div className="g-cartao">
        <EstadoVazio
          tamanho="compacto"
          icone={<Building2 />}
          titulo="Processo sem empresa vinculada"
          descricao="O robô opera por empresa. Sem empresa associada a este processo, não há participação do robô para mostrar."
        />
      </div>
    );
  }

  if (carregando && participacoes.length === 0 && !erro) {
    return (
      <div role="status" aria-busy="true" className="flex flex-col gap-3">
        <span className="sr-only">Carregando participações do robô…</span>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (erro && participacoes.length === 0) {
    return (
      <AvisoDeFalha aoTentarNovamente={tentarDeNovo}>
        Não foi possível carregar as participações do robô: {erro}
      </AvisoDeFalha>
    );
  }

  if (!participacao) {
    return (
      <div className="g-cartao">
        <EstadoVazio
          tamanho="compacto"
          icone={<Crosshair />}
          titulo="Nenhuma participação do robô para este processo"
          descricao="Configure a disputa no Robô de Lances; ela aparece aqui assim que existir. Nada é iniciado sem a sua confirmação."
          acao={
            <Button asChild className="g-controle">
              <Link to={`/robo-lances?lid=${licitacaoId}`}>Configurar no Robô de Lances</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const { disputa, sessao, processo, projecao } = participacao;
  const versaoDescrita = descreverVersao(disputa.precificacao_versao_id, versao);
  const limitesConfirmados = !!disputa.limites_confirmados_em;
  const envioIndisponivel = capacidade.fonte === 'nao_verificada' || !projecao.lanceLiberadoNoPortal;
  const leituraAtrasada = !!lidoEm && agora - lidoEm.getTime() > LEITURA_ATRASADA_MS;
  const horaDaLeitura = horaDeBrasilia(lidoEm);
  const manual = projecao.faseInformadaPor === 'marcacao_manual';
  const pendencia = pendenciaVisivel(projecao, envioIndisponivel);
  const linhaSelecionada = painel?.chave ? linhas.find((l) => l.chave === painel.chave) ?? null : null;

  const colunas: ColunaGestao<LinhaDoItem>[] = [
    {
      chave: 'item',
      titulo: 'Item',
      prioridade: 'sempre',
      largura: '7rem',
      render: (l) => (
        <span className="flex flex-col">
          <span className="tabular-nums">{l.numero !== null ? `Item ${l.numero}` : 'Sem número'}</span>
          {l.lote && <span className="g-meta text-muted-foreground">Lote {l.lote}</span>}
        </span>
      ),
    },
    {
      chave: 'produto',
      titulo: 'Produto',
      prioridade: 'sempre',
      render: (l) =>
        l.descricao ? (
          <span className="line-clamp-2" title={l.descricao}>
            {l.descricao}
          </span>
        ) : (
          <NaoInformado />
        ),
    },
    {
      chave: 'seu-ultimo',
      titulo: 'Seu último lance',
      tituloCurto: 'Seu lance',
      alinhamento: 'direita',
      prioridade: 'sempre',
      render: (l) => formatarMoeda(l.daSessao?.seu_ultimo_lance) ?? <NaoInformado />,
    },
    {
      chave: 'melhor',
      titulo: 'Melhor lance',
      alinhamento: 'direita',
      prioridade: 'sempre',
      render: (l) => formatarMoeda(l.daSessao?.melhor_lance) ?? <NaoInformado />,
    },
    {
      chave: 'limite',
      titulo: 'Limite autorizado',
      tituloCurto: 'Limite',
      alinhamento: 'direita',
      prioridade: 'sempre',
      render: (l) => <LimiteDoItem valor={l.limite} confirmado={limitesConfirmados} />,
    },
    {
      chave: 'situacao',
      titulo: 'Situação',
      prioridade: 'sempre',
      render: (l) => {
        const s = situacaoDoItem(l, !!sessao);
        return <SeloSituacao tom={s.tom}>{s.rotulo}</SeloSituacao>;
      },
    },
    {
      chave: 'acao',
      titulo: 'Ação',
      alinhamento: 'direita',
      prioridade: 'desktop',
      // Texto, não botão: a linha inteira já é o controle (e botão dentro de
      // linha clicável seria interativo dentro de interativo).
      render: () => (
        <span className="g-corpo inline-flex items-center gap-1 font-medium text-primary">
          Detalhes
          <ChevronRight aria-hidden="true" className="h-4 w-4" />
        </span>
      ),
    },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {erro && (
        <AvisoDeFalha aoTentarNovamente={tentarDeNovo}>
          A última atualização falhou: {erro}.{' '}
          {horaDaLeitura ? `Os dados abaixo são da leitura das ${horaDaLeitura} • horário de Brasília.` : ''}
        </AvisoDeFalha>
      )}
      {!erro && leituraAtrasada && (
        <AvisoDeContexto
          titulo="Dados sem atualização recente"
          acao={
            <Button type="button" variant="outline" className="g-controle" onClick={tentarDeNovo}>
              Atualizar agora
            </Button>
          }
        >
          Última leitura às {horaDaLeitura} • horário de Brasília — a releitura automática não voltou.
        </AvisoDeContexto>
      )}

      {participacoes.length > 1 && (
        <div role="group" aria-label="Participações do robô neste processo" className="flex flex-col gap-2">
          <p className="g-meta text-muted-foreground">
            Este processo tem {participacoes.length} participações do robô. Escolha qual acompanhar:
          </p>
          <div className="flex flex-wrap gap-2">
            {participacoes.map((p) => {
              const ativa = p.disputa.id === disputa.id;
              return (
                <Button
                  key={p.disputa.id}
                  type="button"
                  variant="outline"
                  aria-pressed={ativa}
                  onClick={() => setDisputaEscolhida(p.disputa.id)}
                  className={cn(
                    'g-controle h-auto items-start justify-start gap-2 py-2 text-left max-sm:w-full',
                    ativa && 'border-primary bg-primary-tint',
                  )}
                >
                  {ativa && <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
                  <span className="flex min-w-0 flex-col">
                    <span className="g-corpo font-medium">
                      {p.disputa.portal || 'Portal não informado'} · {p.disputa.edital || 'Sem edital'}
                    </span>
                    <span className="g-meta font-normal text-muted-foreground">
                      {ROTULO_DA_ABA[p.projecao.aba]} · {ROTULO_DO_ESTADO_DO_ROBO[p.projecao.estadoDoRobo]}
                    </span>
                  </span>
                </Button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="g-meta text-muted-foreground">Situação da disputa</span>
            <SeloSituacao
              tom={manual ? 'atencao' : TOM_DA_ABA[projecao.aba]}
              explicacao="Fase do certame, na mesma classificação do painel geral do robô."
            >
              {ROTULO_DA_ABA[projecao.aba]}
            </SeloSituacao>
            <FonteDaFaseTexto fonte={projecao.faseInformadaPor} />
          </div>
          <div className="flex flex-wrap items-center gap-x-4">
            <span className="g-meta text-muted-foreground" aria-live="polite">
              {carregando ? 'Atualizando…' : horaDaLeitura ? `Lido às ${horaDaLeitura} • horário de Brasília` : null}
            </span>
            <Link to="/robo-lances" className={CLASSE_LINK}>
              Ver todas as disputas
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
            {/* A disputa inteira — itens, estratégia, envio e acompanhamento —
                mora na página dela (`/robo-lances/disputa/:id`). A pasta mostra o
                resumo desta participação e o caminho; repetir a disputa aqui
                daria duas telas para decidir a mesma coisa. */}
            <Button asChild variant="outline" className="g-controle">
              <Link to={`/robo-lances/disputa/${disputa.id}`}>
                Abrir no robô de lances
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
        {(pendencia || projecao.proximaAcao) && (
          <p className="g-meta text-muted-foreground">
            {pendencia && (
              <>
                Pendência: <span className="text-foreground">{pendencia}</span>
              </>
            )}
            {pendencia && projecao.proximaAcao && ' · '}
            {projecao.proximaAcao && (
              <>
                Próxima ação: <span className="text-foreground">{projecao.proximaAcao}</span>
              </>
            )}
          </p>
        )}
      </div>

      {envioIndisponivel && (
        <AvisoDeContexto titulo="Envio de lances indisponível — somente monitoramento">
          {capacidade.fonte === 'nao_verificada'
            ? 'Nenhum agente declarou em quais portais o envio de lance está liberado. Sem essa declaração, a PraeFectus não envia lance — só acompanha.'
            : `O agente declarou os portais com envio liberado${
                capacidade.verificadaEm
                  ? ` (em ${dataHoraDeBrasilia(capacidade.verificadaEm)} • horário de Brasília)`
                  : ''
              }, e ${disputa.portal ? `“${disputa.portal}”` : 'o portal desta disputa, que não foi informado,'} não está entre eles.`}
        </AvisoDeContexto>
      )}

      <dl className="g-cartao grid grid-cols-1 sm:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-1 border-b border-border p-4 sm:border-b-0 sm:border-r">
          <dt className="g-meta text-muted-foreground">Origem</dt>
          <dd className="g-corpo text-foreground">Compromissos/Kanban</dd>
          <dd className="g-meta text-muted-foreground">
            {processo ? `Situação do processo: ${normalizarStatus(processo.status)}` : 'Situação do processo não lida'}
          </dd>
        </div>
        <div className="flex min-w-0 flex-col gap-1 border-b border-border p-4 sm:border-b-0 sm:border-r">
          <dt className="g-meta text-muted-foreground">Precificação</dt>
          <dd
            className={cn(
              'g-corpo inline-flex items-start gap-1.5',
              versaoDescrita.atencao ? 'text-warning-ink' : 'text-foreground',
            )}
          >
            {versaoDescrita.atencao && <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>{versaoDescrita.texto}</span>
          </dd>
          <dd className="flex flex-wrap items-center gap-x-4">
            <Link to={{ search: '?aba=precificacao' }} replace className={CLASSE_LINK}>
              Consultar preparação
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
            {versaoDescrita.podeTentar && (
              <button type="button" onClick={versao.recarregar} className={CLASSE_LINK}>
                Tentar novamente
              </button>
            )}
          </dd>
        </div>
        <div className="flex min-w-0 flex-col gap-1 p-4">
          <dt className="g-meta text-muted-foreground">Proposta no portal</dt>
          <dd className="g-corpo text-foreground">Não rastreada — sem confirmação do portal</dd>
        </div>
      </dl>

      <ControleDoRobo participacao={participacao} recarregar={recarregar} />

      <SecaoGestao
        titulo="Itens da disputa"
        contagem={linhas.length}
        acoes={
          <Button type="button" variant="outline" className="g-controle" onClick={() => setPainel({ chave: null })}>
            Estratégia e histórico
          </Button>
        }
      >
        {itensDaSessao.estado === 'migracao_pendente' && (
          <AvisoDeContexto titulo="Migração pendente">
            A tabela de itens da sessão ainda não existe no banco — os lances por item aparecem como “Não informado”.
          </AvisoDeContexto>
        )}
        {itensDaSessao.estado === 'erro' && (
          <AvisoDeFalha aoTentarNovamente={itensDaSessao.recarregar}>
            Não foi possível ler os lances por item: {itensDaSessao.erro}
          </AvisoDeFalha>
        )}
        <AreaComPainel
          painel={
            painel ? (
              <PainelDoItem
                participacao={participacao}
                linha={linhaSelecionada}
                origemDaVersao={versaoDescrita.texto}
                gatilho={gatilho}
              />
            ) : null
          }
          tituloPainel={
            linhaSelecionada
              ? linhaSelecionada.numero !== null
                ? `Item ${linhaSelecionada.numero}`
                : 'Item sem número'
              : 'Estratégia e histórico'
          }
          aoFechar={() => setPainel(null)}
        >
          <TabelaGestao
            colunas={colunas}
            itens={linhas}
            chaveDoItem={(l) => l.chave}
            aoSelecionar={(l) => setPainel({ chave: l.chave })}
            selecionado={(l) => painel?.chave === l.chave}
            carregando={!!sessaoId && itensDaSessao.estado === 'carregando'}
            descricao="Itens da disputa do robô neste processo, com lances e limite autorizado"
            vazio={
              <EstadoVazio
                tamanho="compacto"
                icone={<Package />}
                titulo="Nenhum item cadastrado nesta disputa"
                descricao="Os itens e seus limites são definidos na disputa, no robô de lances."
                acao={
                  <Button asChild variant="outline" className="g-controle">
                    <Link to={`/robo-lances/disputa/${disputa.id}`}>Cadastrar itens na disputa</Link>
                  </Button>
                }
              />
            }
          />
        </AreaComPainel>
      </SecaoGestao>
    </div>
  );
}
