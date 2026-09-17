import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Bot, Building2, CalendarDays, FolderOpen, Globe, PowerOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SeloSituacao from '@/components/gestao/SeloSituacao';
import type { LanceConfig } from '@/components/robo-lances/ConfigurarLanceDialog';
import type { NivelAutomacao } from '@/components/robo-lances/NivelAutomacaoSelector';
import { TOM_DO_ESTADO_DO_ROBO, aberturaEmBrasilia } from '@/components/robo-lances/painel/participacoes-no-painel';
import type { ParticipacaoCarregada } from '@/hooks/useParticipacoesDoRobo';
import { acaoPrincipalDaAgenda, agendamentoDaDisputa } from '@/lib/robo/agendamento';
import { nomeDoPortal } from '@/lib/robo/portais';
import { ROTULO_DA_ABA, ROTULO_DO_ESTADO_DO_ROBO } from '@/lib/robo/situacao-da-participacao';
import FonteDaFaseTexto from './FonteDaFase';
import { TOM_DA_ABA } from './leitura-da-participacao';
import { BotaoDePararRobo, DialogoDeParada } from './ParadaDaSessao';
import type { LeituraDaParada, ParadaDaSessao } from './useParadaDaSessao';

const ROTULO_DO_NIVEL: Record<NivelAutomacao, string> = {
  1: 'Assistente',
  2: 'Semiautomático',
  3: 'Automação controlada',
};

interface Props {
  lance: LanceConfig;
  participacao: ParticipacaoCarregada | null;
  /** A situação (fase, robô) ainda não teve a primeira leitura. */
  situacaoPendente: boolean;
  /** Estado do robô com o pedido de parada local por cima. */
  leituraDaParada: LeituraDaParada;
  parada: ParadaDaSessao;
  /** Há sessão do robô em andamento — a ação principal vira "Parar". */
  emAndamento: boolean;
  podeOperar: boolean;
  nivel: NivelAutomacao;
  /** O interruptor do robô da empresa; leitura não confirmada conta como ligado. */
  roboLigado: boolean;
  /** Abre "Editar parâmetros" — é onde a data e o horário da sessão são definidos. */
  aoDefinirData: () => void;
  /** "Editar parâmetros" — o diálogo é montado pela página, que grava. */
  editar: ReactNode;
  /** O menu "Ações", já com os handlers da disputa. */
  acoes: ReactNode;
  /** A lista, na aba e com a busca de onde a pessoa veio. */
}

/**
 * O topo da página da disputa: o que é, em que pé está e UMA ação principal.
 *
 * Segue a anatomia do módulo Gestão (`TelaGestao`): identificador do registro
 * como título, selos de situação, linha de contexto e ações à direita. Não usa
 * `TelaGestao` direto porque lá o grupo de ações não encolhe (`shrink-0`) — com
 * quatro botões, a 390 px ele passaria da largura da tela e a página inteira
 * rolaria de lado. Aqui as ações quebram linha.
 *
 * ── A ação principal é escolhida pelo estado ────────────────────────────────
 *
 * Com sessão em andamento: "Parar robô nesta disputa". Sem ela, desde
 * 17/09/2026 o destaque é a AGENDA, não o envio (D7 — o modelo do ConLicitação
 * é ligar/desligar, não "enviar ao robô"): com data e hora, "Robô entra sozinho
 * 23/10 às 09:15"; sem elas, "Definir data da sessão". O envio imediato mora em
 * Ações › "Entrar agora", para teste, disputa sem data ou nova tentativa. Nunca
 * parar e entrar juntos — com o robô de pé, entrar de novo abriria outra sessão
 * para o mesmo pregão.
 *
 * Os selos separam duas perguntas que a tela antiga fundia: em que fase está o
 * CERTAME (e quem informou) e o que o ROBÔ está fazendo nele.
 */
export default function CabecalhoDaDisputa({
  lance,
  participacao,
  situacaoPendente,
  leituraDaParada,
  parada,
  emAndamento,
  podeOperar,
  nivel,
  roboLigado,
  aoDefinirData,
  editar,
  acoes,
}: Props) {
  const processo = participacao?.processo ?? null;
  const titulo = processo?.numero || lance.edital || 'Disputa sem número de edital';
  const abertura = processo?.data_abertura ? aberturaEmBrasilia(processo.data_abertura) : null;
  // O agendamento da DISPUTA vem antes da abertura do processo: é por ele que
  // o robô entra sozinho, e é ele que precisa estar à vista quando a disputa
  // foi cadastrada com meses de antecedência.
  const agenda = agendamentoDaDisputa({ dataSessao: lance.dataSessao, horario: lance.horario });
  const quando = agenda.tipo === 'agendada'
    ? `Sessão ${agenda.texto} · o robô entra sozinho ${agenda.textoEntrada}`
    : abertura
      ? abertura.temHorario
        ? `Abertura ${abertura.texto} (Brasília)`
        : `Abertura ${abertura.texto}, sem horário`
      : agenda.tipo === 'so-horario'
        ? `Sessão: ${agenda.texto}, sem data — o robô só entra por Ações › Entrar agora`
        : agenda.tipo === 'so-data'
          ? `Sessão: ${agenda.texto}, sem horário — o robô só entra por Ações › Entrar agora`
          : null;

  const meta: ReactNode[] = [
    <span key="portal" className="inline-flex items-center gap-1">
      <Globe aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      {lance.portal ? nomeDoPortal(lance.portal) : 'Portal não informado'}
    </span>,
  ];
  if (quando) {
    meta.push(
      <span key="quando" className="inline-flex items-center gap-1 tabular-nums">
        <CalendarDays aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        {quando}
      </span>,
    );
  }
  if (processo?.orgao) {
    meta.push(
      <span key="orgao" className="inline-flex min-w-0 items-center gap-1">
        <Building2 aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0">{processo.orgao}</span>
      </span>,
    );
  }
  if (processo?.numero && lance.edital && processo.numero !== lance.edital) {
    meta.push(<span key="edital">Edital {lance.edital}</span>);
  }
  if (lance.uasg) meta.push(<span key="uasg" className="tabular-nums">UASG {lance.uasg}</span>);

  const manual = participacao?.projecao.faseInformadaPor === 'marcacao_manual';

  const acaoDaAgenda = acaoPrincipalDaAgenda(agenda, new Date(), roboLigado);
  const principal = emAndamento ? (
    <BotaoDePararRobo parada={parada} />
  ) : !podeOperar ? null : acaoDaAgenda.tipo === 'definir-data' ? (
    <Button
      type="button"
      onClick={aoDefinirData}
      className="g-controle"
      title="Com data e horário da sessão, o robô entra sozinho 15 minutos antes. Para entrar já, use Ações › Entrar agora."
    >
      <CalendarDays className="h-4 w-4" aria-hidden="true" /> {acaoDaAgenda.rotulo}
    </Button>
  ) : (
    <p
      role="status"
      className={`g-controle inline-flex max-w-full items-center gap-2 rounded-md border px-3 text-sm font-medium ${
        acaoDaAgenda.tipo === 'entra-sozinho'
          ? 'border-border bg-card text-foreground'
          : 'border-warning-line bg-warning-tint text-warning-ink'
      }`}
    >
      {acaoDaAgenda.tipo === 'entra-sozinho' ? (
        <Bot className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      ) : acaoDaAgenda.tipo === 'robo-desligado' ? (
        <PowerOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      ) : (
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
      )}
      <span className="min-w-0">{acaoDaAgenda.texto}</span>
    </p>
  );

  return (
    <header className="flex flex-col gap-3">
      {/* Sem link "← Robô de lances" próprio: a faixa superior já tem o Voltar
          comum e a trilha "Robô de lances", registrada pela página com o
          endereço da lista (aba e busca preservadas). Dois caminhos de volta
          um embaixo do outro era a navegação duplicada apontada em 17/09. */}

      {/* Título e ações dividem a primeira linha; selos e contexto ganham a
          largura inteira embaixo. Na coluna ao lado dos botões eles ficavam com
          um terço da tela e quebravam em três linhas. No celular a ordem do DOM
          vale: título, selos, contexto, ações. */}
      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <h1 className="g-titulo-pagina min-w-0 break-words text-foreground lg:col-start-1 lg:row-start-1">{titulo}</h1>
        <div className="flex min-w-0 flex-col gap-2 lg:col-span-2 lg:row-start-2">
          <div className="flex flex-wrap items-center gap-2">
            {participacao ? (
              <>
                <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                  <SeloSituacao
                    tamanho="grande"
                    tom={manual ? 'atencao' : TOM_DA_ABA[participacao.projecao.aba]}
                    explicacao="Fase do certame, na mesma classificação da lista do robô."
                  >
                    {ROTULO_DA_ABA[participacao.projecao.aba]}
                  </SeloSituacao>
                  <FonteDaFaseTexto fonte={participacao.projecao.faseInformadaPor} />
                </span>
                <SeloSituacao
                  tamanho="grande"
                  tom={TOM_DO_ESTADO_DO_ROBO[leituraDaParada.estado]}
                  explicacao="O que o robô está fazendo nesta disputa."
                >
                  {ROTULO_DO_ESTADO_DO_ROBO[leituraDaParada.estado]}
                </SeloSituacao>
              </>
            ) : (
              <SeloSituacao tamanho="grande" tom="indisponivel">
                {situacaoPendente ? 'Consultando a situação…' : 'Situação do robô não lida'}
              </SeloSituacao>
            )}
            <SeloSituacao
              tamanho="grande"
              tom={nivel >= 3 ? 'critico' : nivel === 2 ? 'atencao' : 'neutro'}
              explicacao="Modo de operação da empresa. Muda-se na aba Estratégia."
            >
              Modo: Nível {nivel} — {ROTULO_DO_NIVEL[nivel]}
            </SeloSituacao>
          </div>
          <p className="g-corpo flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">{meta}</p>
        </div>

        <div className="flex min-w-0 flex-wrap items-start gap-2 lg:col-start-2 lg:row-start-1 lg:justify-end">
          {editar}
          {acoes}
          {lance.licitacaoId && (
            <Button asChild variant="ghost" className="g-controle">
              <Link to={`/processo/${lance.licitacaoId}`}>
                <FolderOpen className="h-4 w-4" aria-hidden="true" /> Abrir pasta do processo
              </Link>
            </Button>
          )}
          {principal}
        </div>
      </div>

      {!podeOperar && (
        <p className="g-corpo rounded-[var(--g-raio)] border border-dashed border-border px-3 py-2 text-muted-foreground">
          Você acompanha esta disputa em modo leitura. Mandar o robô entrar e editar parâmetros exigem o papel de operador —
          peça em Equipe → Permissões.
        </p>
      )}

      <DialogoDeParada parada={parada} />
    </header>
  );
}
