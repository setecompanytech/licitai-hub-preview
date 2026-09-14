/**
 * Painel de participações do robô — o corpo da lista do robô (`/robo-lances`).
 *
 * Cada linha abre a disputa em página própria (`/robo-lances/disputa/:id`),
 * com ou sem processo vinculado. Até 14/09/2026 a linha com processo ia para a
 * pasta do processo e a sem processo "abria a configuração nesta tela" — um
 * bloco de três colunas embaixo do painel, igual em qualquer aba. A aba e a
 * busca da lista viajam no estado da navegação, para a volta cair no mesmo lugar.
 *
 * ── Por que existe ─────────────────────────────────────────────────────────
 *
 * A tela do robô tinha uma lista de disputas com um selo só ("Ativo",
 * "Aguardando"), e esse selo era gravado por CLIQUE no menu Ações. Quem lia
 * "Ativo" entendia "o robô está na sala" — e ele podia nunca ter sido
 * iniciado. Aqui as duas perguntas ficam separadas, como a projeção já faz:
 *
 *   aba     = em que fase está o certame (e QUEM informou: agente ou marcação)
 *   coluna  = o que o robô está fazendo nela
 *
 * ── O que esta tela NÃO afirma ─────────────────────────────────────────────
 *
 *  - Situação da proposta: não existe registro de proposta ligado à disputa.
 *    A coluna diz "Não rastreada" em vez de inventar um estado.
 *  - Envio de lance: só o agente declara em que portal pode enviar. Sem
 *    declaração, o aviso de monitoramento fica no topo — nunca simulamos.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Activity, Bot, ChevronDown, FilePlus2, Flag, Hand, ListChecks, RefreshCw, SlidersHorizontal, X,
  type LucideIcon,
} from 'lucide-react';
import AbasGestao from '@/components/gestao/AbasGestao';
import BarraFiltros from '@/components/gestao/BarraFiltros';
import TabelaGestao, { type ColunaGestao } from '@/components/gestao/TabelaGestao';
import SeloSituacao, { AvisoDeContexto, AvisoDeFalha, ValorIndisponivel } from '@/components/gestao/SeloSituacao';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/contexts/AuthContext';
import { useAbaNaUrl } from '@/lib/navegacao/aba-na-url';
import { useParticipacoesDoRobo, type ParticipacaoCarregada } from '@/hooks/useParticipacoesDoRobo';
import { ROTULO_DA_ABA, ROTULO_DO_ESTADO_DO_ROBO, type AbaDoPainel } from '@/lib/robo/situacao-da-participacao';
import { cn } from '@/lib/utils';
import {
  ABAS_DO_PAINEL,
  ABA_PADRAO,
  FILTROS_VAZIOS,
  ROTULO_DA_PREPARACAO,
  SEM_PORTAL,
  TODOS,
  TOM_DO_ESTADO_DO_ROBO,
  aberturaEmBrasilia,
  abaValida,
  contarFiltrosAplicados,
  contarFiltrosExtras,
  contarPorAba,
  filtrarParticipacoes,
  horaEmBrasilia,
  portaisDasParticipacoes,
  preparacaoDaEstrategia,
  type FiltrosDoPainel,
} from './participacoes-no-painel';

/** Relê a cada 30 s: o horário da leitura fica visível, então dado velho se denuncia. */
const INTERVALO_DE_LEITURA = 30;

/**
 * O vazio de cada aba — uma linha e, no máximo, um atalho.
 *
 * Até 14/09/2026 cada aba vazia desenhava o mesmo bloco grande (ícone num
 * círculo, título, parágrafo e botão), e trocar Configuradas por Em disputa
 * parecia não mudar nada na tela. Agora cada aba diz, numa frase e com o
 * próprio ícone, o que ela mostraria — e aponta a aba que tem registros.
 */
const VAZIO_POR_ABA: Record<AbaDoPainel, { icone: LucideIcon; texto: string }> = {
  cadastradas: { icone: FilePlus2, texto: 'Nenhuma disputa cadastrada. Cadastre com “Nova sessão”, no topo.' },
  configuradas: { icone: ListChecks, texto: 'Nenhuma disputa com portal, preço inicial, limites e versão aprovada.' },
  em_disputa: { icone: Activity, texto: 'Nenhuma disputa acontecendo agora.' },
  encerradas: { icone: Flag, texto: 'Nenhuma disputa encerrada ainda.' },
};

interface Props {
  empresaId: string | null;
  /** Processo aberto na pasta: presente, o painel mostra só as participações dele. */
  licitacaoId?: string | null;
  /** Muda quando a página grava algo nas disputas — o painel relê na hora. */
  sinalDeRecarga?: number;
}

export default function PainelDeParticipacoes({ empresaId, licitacaoId = null, sinalDeRecarga = 0 }: Props) {
  const navigate = useNavigate();
  const { search } = useLocation();
  const { user } = useAuth();
  const noCelular = useIsMobile();
  const idBase = useId();

  const { participacoes, carregando, erro, semEmpresa, lidoEm, capacidade, recarregar } = useParticipacoesDoRobo({
    empresaId,
    licitacaoId,
    intervaloSegundos: INTERVALO_DE_LEITURA,
  });

  // A página gravou (salvou, marcou, removeu): relê sem esperar o próximo ciclo.
  const ultimoSinal = useRef(sinalDeRecarga);
  useEffect(() => {
    if (sinalDeRecarga === ultimoSinal.current) return;
    ultimoSinal.current = sinalDeRecarga;
    recarregar();
  }, [sinalDeRecarga, recarregar]);

  // ── Aba e busca na URL; o resto dos filtros é da sessão de uso ────────────
  const [abaNaUrl, definirAba] = useAbaNaUrl(ABA_PADRAO, 'painel');
  const aba = abaValida(abaNaUrl);
  const [params, setParams] = useSearchParams();
  const busca = params.get('q') ?? '';
  const definirBusca = (valor: string) =>
    setParams(
      (anterior) => {
        const proximo = new URLSearchParams(anterior);
        if (valor) proximo.set('q', valor);
        else proximo.delete('q');
        return proximo;
      },
      { replace: true },
    );

  const [extras, setExtras] = useState(FILTROS_VAZIOS);
  const [maisFiltrosAbertos, setMaisFiltrosAbertos] = useState(false);
  const [filtrosNoCelular, setFiltrosNoCelular] = useState(false);

  const filtros: FiltrosDoPainel = { ...extras, busca };
  const definir = <K extends keyof typeof FILTROS_VAZIOS>(chave: K, valor: (typeof FILTROS_VAZIOS)[K]) =>
    setExtras((atual) => ({ ...atual, [chave]: valor }));
  const limparFiltros = () => {
    setExtras(FILTROS_VAZIOS);
    definirBusca('');
  };

  const aplicados = contarFiltrosAplicados(filtros);
  const extrasAplicados = contarFiltrosExtras(filtros);
  const portais = useMemo(() => portaisDasParticipacoes(participacoes), [participacoes]);

  const filtradas = useMemo(
    () => filtrarParticipacoes(participacoes, filtros, user?.id ?? null),
    // `filtros` é recriado a cada render; as partes dele é que importam.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [participacoes, busca, extras, user?.id],
  );
  // Contagem DEPOIS dos filtros: o número da aba é o que a aba mostra.
  const contagem = useMemo(() => contarPorAba(filtradas), [filtradas]);
  const contagemSemFiltro = useMemo(() => contarPorAba(participacoes), [participacoes]);
  const daAba = useMemo(() => filtradas.filter((p) => p.projecao.aba === aba), [filtradas, aba]);

  // Toda linha abre a página da disputa. A busca da lista (aba e `q`) vai no
  // estado da navegação: o caminho de volta da página cai no mesmo lugar, e o
  // "voltar" do navegador já cai, porque a lista guarda os dois na URL.
  const abrir = (p: ParticipacaoCarregada) => {
    navigate(`/robo-lances/disputa/${p.disputa.id}`, { state: { daLista: search } });
  };

  // ── Colunas ───────────────────────────────────────────────────────────────
  // Seis colunas, e não oito (14/09/2026). Com oito, a tabela media 1.621 px
  // numa caixa de 1.374 — "Pendência" e "Próxima ação" ficavam atrás de uma
  // rolagem cuja barra mora no fim da lista, e a tela parecia quebrada.
  // Proposta desce para linha de apoio (ela repetia "Não rastreada" em toda
  // linha) e próxima ação fica sob a pendência, que é de onde ela nasce.
  const colunas: ColunaGestao<ParticipacaoCarregada>[] = [
    {
      chave: 'processo',
      titulo: 'Processo e objeto',
      tituloCurto: 'Processo',
      prioridade: 'sempre',
      render: (p) => (
        <div className="flex min-w-[11rem] max-w-[18rem] flex-col gap-0.5">
          <span className="font-semibold text-foreground">{p.processo?.numero || p.disputa.edital}</span>
          {p.processo ? (
            <>
              {p.processo.orgao && <span className="g-meta truncate text-muted-foreground">{p.processo.orgao}</span>}
              {/* Truncado só no CSS: o texto inteiro continua no DOM (leitor de
                  tela lê tudo) e no `title` (quem aponta o mouse lê tudo). */}
              {p.processo.objeto && (
                <span className="g-meta truncate text-muted-foreground" title={p.processo.objeto}>
                  {p.processo.objeto}
                </span>
              )}
            </>
          ) : (
            <span className="g-meta text-muted-foreground">Sem processo vinculado</span>
          )}
          {p.projecao.faseInformadaPor === 'marcacao_manual' && (
            <span className="g-meta inline-flex items-center gap-1 text-warning-ink">
              <Hand aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              Marcada manualmente — o portal não confirmou
            </span>
          )}
        </div>
      ),
    },
    {
      chave: 'portal',
      titulo: 'Portal',
      prioridade: 'desktop',
      render: (p) =>
        String(p.disputa.portal ?? '').trim() ? (
          // Quebra linha: "Portal de Compras Públicas" numa linha só tomava 215 px.
          <span className="block min-w-[6rem] max-w-[9rem]">{p.disputa.portal}</span>
        ) : (
          <ValorIndisponivel razao="Portal não informado" />
        ),
    },
    {
      chave: 'data',
      titulo: 'Data relevante',
      tituloCurto: 'Data',
      prioridade: 'sempre',
      render: (p) => {
        const abertura = p.processo?.data_abertura ? aberturaEmBrasilia(p.processo.data_abertura) : null;
        if (abertura) {
          return (
            <span className="flex flex-col">
              <span className="whitespace-nowrap tabular-nums">{abertura.texto}</span>
              <span className="g-meta text-muted-foreground">
                {abertura.temHorario ? 'Abertura · Brasília' : 'Abertura · sem horário'}
              </span>
            </span>
          );
        }
        if (p.disputa.horario) {
          return (
            <span className="flex flex-col">
              <span className="whitespace-nowrap tabular-nums">{p.disputa.horario}</span>
              <span className="g-meta text-muted-foreground">horário sem data</span>
            </span>
          );
        }
        return <ValorIndisponivel razao="Sem data" />;
      },
    },
    {
      chave: 'preparacao',
      titulo: 'Estratégia e proposta',
      tituloCurto: 'Estratégia',
      prioridade: 'desktop',
      render: (p) => {
        const prep = preparacaoDaEstrategia(p);
        return (
          <span className="flex flex-col items-start gap-1">
            <SeloSituacao
              tom={prep === 'configurada' ? 'sucesso' : prep === 'rascunho' ? 'atencao' : 'neutro'}
              explicacao={prep === 'rascunho' ? 'Sem versão aprovada da precificação.' : undefined}
            >
              {ROTULO_DA_PREPARACAO[prep]}
            </SeloSituacao>
            <span
              className="g-meta whitespace-nowrap text-muted-foreground"
              title="O sistema ainda não registra a situação da proposta ligada à disputa."
            >
              Proposta: <span>Não rastreada</span>
            </span>
          </span>
        );
      },
    },
    {
      chave: 'robo',
      titulo: 'Robô',
      prioridade: 'sempre',
      render: (p) => (
        <SeloSituacao tom={TOM_DO_ESTADO_DO_ROBO[p.projecao.estadoDoRobo]}>
          {ROTULO_DO_ESTADO_DO_ROBO[p.projecao.estadoDoRobo]}
        </SeloSituacao>
      ),
    },
    {
      chave: 'pendencia',
      titulo: 'Pendência e próxima ação',
      tituloCurto: 'Pendência',
      prioridade: 'sempre',
      render: (p) => (
        <span className="flex min-w-[12rem] max-w-[18rem] flex-col gap-0.5">
          {p.projecao.pendenciaPrincipal ? (
            <span>{p.projecao.pendenciaPrincipal}</span>
          ) : (
            <span className="text-muted-foreground">Nenhuma pendência</span>
          )}
          {/* O clique leva sempre à página da disputa — não há mais destino a
              explicar linha a linha. */}
          <span className="g-meta text-muted-foreground">
            Próxima ação: <span className="font-medium text-foreground">{p.projecao.proximaAcao || 'nenhuma'}</span>
          </span>
        </span>
      ),
    },
  ];

  // ── Controles de filtro ──────────────────────────────────────────────────
  const campoPortal = (comRotulo: boolean) => (
    <div className={cn('flex flex-col gap-1', !comRotulo && 'contents')}>
      {comRotulo && <Label htmlFor={`${idBase}-portal`}>Portal</Label>}
      <Select value={extras.portal} onValueChange={(v) => definir('portal', v)}>
        <SelectTrigger
          id={`${idBase}-portal`}
          aria-label="Filtrar por portal"
          className="g-controle w-full min-w-[160px] rounded-[var(--g-raio)] md:w-auto"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todos os portais</SelectItem>
          {portais.valores.map((portal) => (
            <SelectItem key={portal} value={portal}>
              {portal}
            </SelectItem>
          ))}
          {portais.algumSemPortal && <SelectItem value={SEM_PORTAL}>Portal não informado</SelectItem>}
        </SelectContent>
      </Select>
    </div>
  );

  const campoResponsavel = (comRotulo: boolean) => (
    <div className={cn('flex flex-col gap-1', !comRotulo && 'contents')}>
      {comRotulo && <Label htmlFor={`${idBase}-responsavel`}>Responsável</Label>}
      <Select value={extras.responsavel} onValueChange={(v) => definir('responsavel', v as FiltrosDoPainel['responsavel'])}>
        <SelectTrigger
          id={`${idBase}-responsavel`}
          aria-label="Filtrar por responsável"
          className="g-controle w-full min-w-[160px] rounded-[var(--g-raio)] md:w-auto"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos os responsáveis</SelectItem>
          <SelectItem value="meus">Somente os meus</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  const campoPendencia = (sufixo: string) => (
    <Label
      htmlFor={`${idBase}-pendencia-${sufixo}`}
      className="g-controle inline-flex cursor-pointer items-center gap-2 rounded-[var(--g-raio)] border border-border bg-card px-3 font-normal"
    >
      <Checkbox
        id={`${idBase}-pendencia-${sufixo}`}
        checked={extras.soComPendencia}
        onCheckedChange={(v) => definir('soComPendencia', v === true)}
      />
      Só com pendência
    </Label>
  );

  const camposExtras = (sufixo: string) => (
    <>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${idBase}-de-${sufixo}`}>Abertura de</Label>
        <Input
          id={`${idBase}-de-${sufixo}`}
          type="date"
          value={extras.de}
          max={extras.ate || undefined}
          onChange={(e) => definir('de', e.target.value)}
          className="g-controle rounded-[var(--g-raio)]"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${idBase}-ate-${sufixo}`}>até</Label>
        <Input
          id={`${idBase}-ate-${sufixo}`}
          type="date"
          value={extras.ate}
          min={extras.de || undefined}
          onChange={(e) => definir('ate', e.target.value)}
          className="g-controle rounded-[var(--g-raio)]"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${idBase}-modo-${sufixo}`}>Modo</Label>
        <Select value={extras.modo} onValueChange={(v) => definir('modo', v as FiltrosDoPainel['modo'])}>
          <SelectTrigger id={`${idBase}-modo-${sufixo}`} className="g-controle w-full min-w-[160px] rounded-[var(--g-raio)]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Automático e manual</SelectItem>
            <SelectItem value="automatico">Automático</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {(extras.de || extras.ate) && (
        <p className="g-meta basis-full text-muted-foreground">
          Com período, participações sem data de abertura no processo saem do resultado.
        </p>
      )}
    </>
  );

  // ── Estados de tela ──────────────────────────────────────────────────────
  const cabecalho = (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <div className="min-w-0">
        <h2 className="g-titulo-secao text-foreground">Participações do robô</h2>
        {licitacaoId && (
          <p className="g-meta text-muted-foreground">Mostrando só as participações do processo aberto.</p>
        )}
      </div>
      {!semEmpresa && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="g-meta tabular-nums text-muted-foreground" aria-live="polite">
            {lidoEm
              ? `Atualização recebida às ${horaEmBrasilia(lidoEm)} • Brasília`
              : carregando
                ? 'Consultando as participações…'
                : 'Ainda sem leitura'}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => recarregar()}
            disabled={carregando}
            className="g-controle rounded-[var(--g-raio)]"
          >
            <RefreshCw aria-hidden="true" className={cn('mr-1.5 h-4 w-4', carregando && 'animate-spin')} />
            Atualizar
          </Button>
        </div>
      )}
    </div>
  );

  if (semEmpresa) {
    return (
      <section aria-label="Participações do robô" data-painel="participacoes" className="flex min-w-0 flex-col gap-3">
        {cabecalho}
        <div className="g-cartao">
          <EstadoVazio
            icone={<Bot />}
            titulo="Nenhuma empresa ativa"
            descricao="Selecione a empresa no topo da tela para ver as participações do robô."
            tamanho="compacto"
          />
        </div>
      </section>
    );
  }

  const semEnvio = capacidade.fonte === 'nao_verificada' || capacidade.portaisComLanceLiberado.length === 0;
  const primeiraAbaComItens = ABAS_DO_PAINEL.find((a) => a !== aba && contagem[a] > 0);
  const vazioPorFiltro = aplicados > 0 && contagemSemFiltro[aba] > 0;

  // Uma linha, com o ícone da própria aba e no máximo um atalho — ver `VAZIO_POR_ABA`.
  const IconeDoVazio = VAZIO_POR_ABA[aba].icone;
  const classeDoAtalho =
    'g-corpo inline-flex min-h-[44px] items-center gap-1 rounded font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  const vazio = vazioPorFiltro ? (
    <div role="status" data-vazio="filtros" className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2">
      <SlidersHorizontal aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
      <p className="g-corpo min-w-0 text-foreground">
        Nenhuma participação com esses filtros — há {contagemSemFiltro[aba]} em {ROTULO_DA_ABA[aba]} sem eles.
      </p>
      <button type="button" onClick={limparFiltros} className={classeDoAtalho}>
        <X aria-hidden="true" className="h-4 w-4" /> Limpar filtros
      </button>
    </div>
  ) : (
    <div role="status" data-vazio={aba} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2">
      <IconeDoVazio aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
      <p className="g-corpo min-w-0 text-foreground">{VAZIO_POR_ABA[aba].texto}</p>
      {primeiraAbaComItens && (
        <button type="button" onClick={() => definirAba(primeiraAbaComItens)} className={classeDoAtalho}>
          Ver {ROTULO_DA_ABA[primeiraAbaComItens]} ({contagem[primeiraAbaComItens]})
        </button>
      )}
    </div>
  );

  return (
    <section aria-label="Participações do robô" data-painel="participacoes" className="flex min-w-0 flex-col gap-3">
      {cabecalho}

      {semEnvio && (
        <AvisoDeContexto titulo="Envio de lances indisponível — os portais estão em modo de monitoramento">
          {capacidade.fonte === 'nao_verificada'
            ? 'Nenhum agente declarou em que portal pode enviar lance. O robô acompanha a sala; esta tela não envia nem simula lances.'
            : 'O agente declarou que nenhum portal tem envio de lance liberado. O robô acompanha a sala; esta tela não envia nem simula lances.'}
        </AvisoDeContexto>
      )}

      {erro && (
        <AvisoDeFalha aoTentarNovamente={() => recarregar()}>
          Não foi possível carregar as participações: {erro}
          {lidoEm ? ` Os dados abaixo são da leitura das ${horaEmBrasilia(lidoEm)} (Brasília).` : ''}
        </AvisoDeFalha>
      )}

      <AbasGestao
        abas={ABAS_DO_PAINEL.map((a) => ({ valor: a, rotulo: ROTULO_DA_ABA[a], contagem: contagem[a] }))}
        valor={aba}
        aoMudar={definirAba}
      />

      <BarraFiltros
        busca={busca}
        aoBuscar={definirBusca}
        placeholderBusca="Buscar por processo, objeto ou edital"
        filtrosAplicados={aplicados}
        aoLimpar={limparFiltros}
        acao={
          noCelular ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setFiltrosNoCelular(true)}
              className="g-controle rounded-[var(--g-raio)]"
            >
              <SlidersHorizontal aria-hidden="true" className="mr-2 h-4 w-4" />
              Filtros
              {aplicados > 0 && (
                <span className="ml-2 rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-semibold leading-none text-primary-foreground">
                  {aplicados}
                </span>
              )}
            </Button>
          ) : undefined
        }
      >
        {/* No celular os filtros vão para a gaveta abaixo: a fila empilhada
            empurraria a tabela para fora da primeira tela. */}
        {!noCelular && (
          <>
            {campoPortal(false)}
            {campoResponsavel(false)}
            {campoPendencia('barra')}
            <Button
              type="button"
              variant="ghost"
              onClick={() => setMaisFiltrosAbertos((v) => !v)}
              aria-expanded={maisFiltrosAbertos}
              aria-controls={`${idBase}-mais-filtros`}
              className="g-controle rounded-[var(--g-raio)]"
            >
              Mais filtros
              {extrasAplicados > 0 && <span className="ml-1 tabular-nums">({extrasAplicados})</span>}
              <ChevronDown
                aria-hidden="true"
                className={cn('ml-1 h-4 w-4 transition-transform', maisFiltrosAbertos && 'rotate-180')}
              />
            </Button>
          </>
        )}
      </BarraFiltros>

      {!noCelular && maisFiltrosAbertos && (
        <div id={`${idBase}-mais-filtros`} className="flex flex-wrap items-end gap-3">
          {camposExtras('barra')}
        </div>
      )}

      {noCelular && (
        <Sheet open={filtrosNoCelular} onOpenChange={setFiltrosNoCelular}>
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
            <SheetHeader className="mb-3 text-left">
              <SheetTitle className="g-titulo-secao">Filtros</SheetTitle>
              <SheetDescription>Valem para as quatro abas do painel.</SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-3">
              {campoPortal(true)}
              {campoResponsavel(true)}
              {campoPendencia('gaveta')}
              {camposExtras('gaveta')}
              {aplicados > 0 && (
                <Button type="button" variant="ghost" onClick={limparFiltros} className="g-controle w-full text-primary">
                  <X aria-hidden="true" className="mr-1.5 h-4 w-4" /> Limpar filtros
                </Button>
              )}
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* Falha sem nenhuma leitura anterior: a tabela some. Um "nenhuma
          participação" embaixo do erro afirmaria que não há registros — e o
          que não há é resposta. */}
      {!(erro && !lidoEm) && (
        <TabelaGestao
          descricao={`Participações do robô — ${ROTULO_DA_ABA[aba]}`}
          colunas={colunas}
          itens={daAba}
          chaveDoItem={(p) => p.disputa.id}
          aoSelecionar={abrir}
          // Esqueleto só na PRIMEIRA leitura: a releitura de 30 s não pode
          // piscar a tabela inteira embaixo de quem está lendo.
          carregando={carregando && !lidoEm}
          vazio={vazio}
        />
      )}
    </section>
  );
}
