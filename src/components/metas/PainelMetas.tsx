import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { nomeExibido } from '@/lib/equipe/nomeExibido';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import EstadoVazio from '@/components/shared/EstadoVazio';
import BarraFiltros from '@/components/gestao/BarraFiltros';
import FaixaIndicadores, { type Indicador } from '@/components/gestao/FaixaIndicadores';
import { SecaoGestao } from '@/components/gestao/TelaGestao';
import ListaDeCampos from '@/components/gestao/ListaDeCampos';
import { AvisoDeContexto, ValorIndisponivel } from '@/components/gestao/SeloSituacao';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Target, TrendingUp, CalendarDays, AlertTriangle,
  Trophy, UserRound, Users,
} from 'lucide-react';
import {
  useMetasConfig, useValoresAlvo, useRealizadoMensal, useFeriados,
  useColaboradores, useMetas, useContratosAssinados,
} from '@/hooks/useMetasComercial';
import { useAuthorization } from '@/hooks/useAuthorization';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { formatBRL, formatFracao } from '@/lib/financeiro/formatters';
import { paraCentavos, paraReais } from '@/lib/metas/dinheiro';
import { apurarTickets } from '@/lib/metas/tickets';
import { resolverValoresAlvo } from '@/lib/metas/valores-alvo';
import { BASES_META, filtrarHistorico, inicioDaJanela, realizadoDoMes } from '@/lib/metas/painel';
import { filtrarFeriadosPorPraca } from '@/lib/metas/praca';
import { filtrarColaboradoresDoPainel } from '@/lib/metas/colaboradores';
import { avaliarAlerta, projetarMeta, type Severidade } from '@/lib/metas/projecao';
import { estadoDaBarra } from '@/lib/metas/progresso';
import { rotuloModalidade } from '@/lib/metas/modalidades';
import {
  APURACAO, AVISO_CRITERIOS_DISTINTOS, apuracaoDaBase, type MetricaRealizado,
} from '@/lib/metas/apuracao';
import { CampoFiltro, LinhaApuracao } from './comuns';
import { MESES } from './meses';

/** Hoje no fuso do negócio, em 'YYYY-MM-DD'. */
function hojeEmSaoPaulo(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

/**
 * Severidade → família semântica do Alert (tinta: fundo *-tint, texto *-ink).
 * `atencao` e `risco` compartilham a família de aviso; o título é que separa
 * os dois — cor nunca é a única pista.
 */
const ESTILO_ALERTA: Record<Exclude<Severidade, 'nenhum'>, { variante: 'warning' | 'destructive'; titulo: string }> = {
  atencao: { variante: 'warning', titulo: 'Atenção' },
  risco: { variante: 'warning', titulo: 'Meta em risco' },
  critico: { variante: 'destructive', titulo: 'Risco crítico' },
};

/** As três pontas da esteira, na ordem em que o dinheiro anda. */
const PONTAS: {
  chave: 'contratos_ganhos' | 'faturamento' | 'nf_quitada';
  metrica: MetricaRealizado;
  titulo: string;
  sub: string;
  moeda: boolean;
}[] = [
  { chave: 'contratos_ganhos', metrica: 'ganhos', titulo: '1 · Contratos ganhos', sub: 'o negócio fechou', moeda: false },
  { chave: 'faturamento', metrica: 'pedidos_faturados', titulo: '2 · Faturamento', sub: 'a nota saiu', moeda: true },
  { chave: 'nf_quitada', metrica: 'nfe_quitadas', titulo: '3 · NF-e quitada', sub: 'o dinheiro entrou', moeda: true },
];

export default function PainelMetas() {
  const navigate = useNavigate();
  const hoje = hojeEmSaoPaulo();
  const [anoRef, mesRef] = hoje.split('-').map(Number);

  const [ano, setAno] = useState(anoRef);
  const [mes, setMes] = useState(mesRef);
  const [userId, setUserId] = useState<string>('');

  /**
   * Admin (global ou da empresa ATIVA) acompanha o time inteiro; colaborador vê
   * apenas o próprio painel.
   *
   * `useAuthorization` é a autoridade do módulo inteiro de Metas desde esta
   * leva — ver a nota em `MetasComercial.tsx`. Ela é a única que confina o
   * "admin de empresa" à empresa ATIVA; a outra em uso no módulo considerava
   * admin quem administra QUALQUER empresa, e a divergência aparecia na tela:
   * a mesma pessoa ganhava a aba Equipe e perdia o seletor de colaborador.
   */
  const { isAdmin, loading: carregandoPapel } = useAuthorization();
  const { user } = useAuth();

  const { data: config } = useMetasConfig();
  const { data: membros, isLoading: carregandoColaboradores } = useColaboradores();
  const { data: valoresAlvo } = useValoresAlvo();
  const { data: realizado, isLoading: carregandoRealizado } = useRealizadoMensal({ ano });
  const { data: feriados } = useFeriados(ano);
  const { data: metas } = useMetas({ ano, mes });

  const janelaMeses = config?.janela_historica_meses ?? 6;
  const desde = inicioDaJanela(ano, mes, janelaMeses);

  // Só o comercial e quem tem meta no período — sem isto o painel listava todo
  // membro da empresa, inclusive contas administrativas sem nome.
  const colaboradores = useMemo(
    () => filtrarColaboradoresDoPainel(
      membros ?? [],
      (metas ?? []).map((m) => m.user_id),
    ),
    [membros, metas],
  );

  // Colaborador fica preso a si mesmo; admin, sem escolha feita, cai no primeiro da lista.
  const selecionado = isAdmin
    ? userId || colaboradores?.[0]?.user_id || ''
    : user?.id ?? '';
  const { data: contratos } = useContratosAssinados({ desde, userId: selecionado || undefined });

  const colaborador = useMemo(
    () => (colaboradores ?? []).find((c) => c.user_id === selecionado) ?? null,
    [colaboradores, selecionado],
  );
  // A lista de membros pode não trazer o próprio usuário conforme a RLS; o
  // e-mail da sessão é o último recurso para não exibir "Colaborador" genérico.
  const nomeColaborador =
    (colaborador ? nomeExibido(colaborador as never) : null) || (!isAdmin ? user?.email : null) || 'Colaborador';

  const meta = useMemo(
    () => (metas ?? []).find((m) => m.user_id === selecionado) ?? null,
    [metas, selecionado],
  );

  const analise = useMemo(() => {
    if (!config || !selecionado || !meta) return null;

    const linhas = realizado ?? [];
    const historico = filtrarHistorico(linhas, {
      userId: selecionado, ano, mes, janelaMeses: config.janela_historica_meses,
    });
    const realizadoCent = realizadoDoMes(linhas, {
      userId: selecionado, ano, mes, base: meta.base_meta,
    });

    /**
     * As três pontas da esteira, lado a lado.
     *
     * `realizadoCent` acima mede só a base PRINCIPAL — é ela que dispara o
     * alerta e alimenta a projeção. Mas medir uma ponta só esconde onde a
     * esteira travou: contratos em dia com quitação zerada é ter fechado e não
     * entregado, e o painel mostrava isso como meta batida.
     */
    const linhaDoMes = linhas.find(
      (l) => l.user_id === selecionado && l.ano === ano && l.mes === mes,
    );
    const pontas = {
      contratos_ganhos: { alvo: meta.meta_contratos ?? 0, feito: linhaDoMes?.ganhos ?? 0 },
      faturamento: { alvo: Number(meta.meta_faturamento) || 0, feito: linhaDoMes?.valor_faturado ?? 0 },
      nf_quitada: { alvo: Number(meta.meta_quitacao) || 0, feito: linhaDoMes?.valor_quitado ?? 0 },
    };

    const tickets = apurarTickets(
      (contratos ?? []).map((c) => ({
        modalidade: c.modalidade,
        valorGlobalCent: paraCentavos(c.valor_global),
      })),
    );

    const valoresAlvoCent = resolverValoresAlvo(valoresAlvo ?? [], hoje, selecionado);

    // Fase 1 da praça: nacionais + os da UF/município do colaborador.
    // Sem praça definida, só os nacionais — comportamento anterior.
    const feriadosDaPraca = filtrarFeriadosPorPraca(
      feriados ?? [],
      colaborador ? { uf: colaborador.praca_uf, municipio: colaborador.praca_municipio } : null,
    );
    const prefixoMes = `${ano}-${String(mes).padStart(2, '0')}-`;
    // Set: nacional + estadual na MESMA data são permitidos pelo índice novo,
    // mas só descontam um dia útil — o contador auditável mostra datas únicas.
    const feriadosNoMes = new Set(feriadosDaPraca.filter((d) => d.startsWith(prefixoMes))).size;

    const projecao = projetarMeta({
      metaCent: paraCentavos(Number(meta.meta_faturamento)),
      realizadoCent,
      ano,
      mes,
      hoje,
      feriados: feriadosDaPraca,
      historico,
      tickets,
      valoresAlvoCent,
      parametros: {
        txGanhoPadrao: Number(config.tx_ganho_padrao),
        txFaturamentoPadrao: Number(config.tx_faturamento_padrao),
        minAmostraTicket: config.min_amostra_ticket,
        minAnosSazonalidade: config.min_anos_sazonalidade,
      },
    });

    const severidade = avaliarAlerta(projecao, {
      diasLimite: config.alerta_dias_limite,
      percentualMinimo: Number(config.alerta_percentual_minimo),
    });

    return { projecao, severidade, tickets, historico, feriadosNoMes, pontas };
  }, [config, selecionado, meta, realizado, contratos, valoresAlvo, feriados, colaborador, ano, mes, hoje]);

  // Barra de progresso: mesma severidade do alerta, para não divergirem
  const barra = estadoDaBarra(
    analise?.severidade ?? 'nenhum',
    !!analise && analise.projecao.metaCent > 0 && analise.projecao.restanteCent === 0,
  );

  const anos = [anoRef - 2, anoRef - 1, anoRef, anoRef + 1];
  const carregando = carregandoPapel || carregandoColaboradores || carregandoRealizado;

  /**
   * O motor projeta SEMPRE contra `meta_faturamento` — é assim que
   * `projetarMeta` é alimentado, e a fórmula não muda aqui.
   *
   * Quando a meta principal do mês é outra ponta (contratos ganhos, NF-e
   * quitada), ninguém é obrigado a escrever um alvo de faturamento. Nesse caso
   * o alvo monetário não existe — e alvo inexistente não é R$ 0,00: exibido
   * como zero, o painel anunciava "Falta R$ 0,00 · Meta batida" para quem não
   * faturou nada. Os números que dependem dele passam a declarar a ausência.
   */
  const metaMonetariaDefinida = Number(meta?.meta_faturamento) > 0;
  const razaoSemMetaMonetaria = meta
    ? `Meta de faturamento não definida — a principal deste mês é ${BASES_META[meta.base_meta]?.label.toLowerCase() ?? 'outra ponta'}`
    : 'Meta não definida';

  const baseApurada = meta ? apuracaoDaBase(meta.base_meta) : null;

  /** Volta um mês sem sair da tela — a ação pertinente de quase todo vazio daqui. */
  const irParaMesAnterior = () => {
    if (mes === 1) { setMes(12); setAno((a) => a - 1); return; }
    setMes((m) => m - 1);
  };

  const filtrosAplicados =
    (mes !== mesRef ? 1 : 0)
    + (ano !== anoRef ? 1 : 0)
    + (isAdmin && userId && userId !== colaboradores?.[0]?.user_id ? 1 : 0);

  const limparFiltros = () => { setMes(mesRef); setAno(anoRef); setUserId(''); };

  const praca = colaborador?.praca_uf
    ? colaborador.praca_municipio
      ? `${colaborador.praca_municipio}/${colaborador.praca_uf}`
      : colaborador.praca_uf
    : 'nacional';

  /**
   * Os quatro números do topo, cada um declarando a própria base de apuração.
   *
   * A ordem é a da leitura: quanto é o alvo, quanto já saiu, quanto falta,
   * quanto tempo resta. `valor: null` vira "—" com a razão, nunca 0.
   */
  const indicadores: Indicador[] = analise && meta ? [
    {
      rotulo: 'Meta do mês',
      valor: metaMonetariaDefinida ? formatBRL(paraReais(analise.projecao.metaCent)) : null,
      razaoIndisponivel: razaoSemMetaMonetaria,
      detalhe: BASES_META[meta.base_meta]?.curto ?? 'Sobre faturamento',
      icone: Target,
    },
    {
      rotulo: 'Realizado',
      valor: metaMonetariaDefinida ? formatBRL(paraReais(analise.projecao.realizadoCent)) : null,
      razaoIndisponivel: razaoSemMetaMonetaria,
      detalhe: baseApurada && (
        <span title={baseApurada.explicacao}>
          {baseApurada.curto} · {formatFracao(analise.projecao.percentualRealizado, 1)} da meta
        </span>
      ),
      icone: Trophy,
      tom: analise.projecao.percentualRealizado >= 1 ? 'ok' : 'neutro',
    },
    {
      rotulo: 'Falta',
      valor: metaMonetariaDefinida ? formatBRL(paraReais(analise.projecao.restanteCent)) : null,
      razaoIndisponivel: razaoSemMetaMonetaria,
      // "Meta batida" só pode aparecer quando existe meta: com alvo ausente o
      // `restanteCent` é 0 por falta de referência, não por conquista.
      detalhe: !metaMonetariaDefinida ? undefined
        : analise.projecao.restanteCent === 0 ? 'Meta batida' : 'Para bater a meta',
      icone: TrendingUp,
      tom: analise.severidade === 'critico' ? 'critico'
        : analise.severidade !== 'nenhum' ? 'aviso'
          : 'neutro',
    },
    {
      rotulo: 'Dias úteis restantes',
      valor: String(analise.projecao.diasUteisRestantes),
      // Ressalva 3 da auditoria: quantos feriados entraram no cálculo
      // precisa ficar VISÍVEL — praça errada não dá erro, só distorce.
      detalhe: `${analise.projecao.diasUteisDecorridos} decorrido(s) · ${analise.feriadosNoMes} feriado(s) da praça ${praca}`,
      icone: CalendarDays,
      tom: analise.projecao.diasUteisRestantes <= 3 && analise.projecao.restanteCent > 0 ? 'aviso' : 'neutro',
    },
  ] : [];

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* ── Filtros: período e colaborador ACIMA dos resultados ── */}
      {/* A barra não tem ação própria. Definir meta saiu daqui por decisão do
          dono do produto — Gestão é leitura: acompanhar e levantar relatórios;
          quem define o alvo vai a Ferramentas → Definir Metas. E o convite
          para lá mora no estado vazio, onde a falta de meta é o assunto: o
          mesmo botão nos dois lugares era a mesma ação oferecida duas vezes na
          mesma tela. */}
      <BarraFiltros
        filtrosAplicados={filtrosAplicados}
        aoLimpar={limparFiltros}
      >
        <CampoFiltro rotulo="Colaborador" className="w-full sm:w-56">
          {isAdmin ? (
            <Select value={selecionado} onValueChange={setUserId}>
              <SelectTrigger aria-label="Colaborador" className="g-controle">
                <SelectValue placeholder={carregandoColaboradores ? 'Carregando…' : 'Selecione'} />
              </SelectTrigger>
              <SelectContent>
                {(colaboradores ?? []).map((c) => (
                  <SelectItem key={c.user_id} value={c.user_id}>
                    {nomeExibido(c as never) || c.user_id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            /* Colaborador não escolhe de quem é o painel: o nome é leitura, não
               controle. Um <div> rotulável por `label[for]` não associa nada —
               aqui o nome chega pelo `aria-label` do grupo. */
            <div
              role="group"
              aria-label={`Colaborador: ${nomeColaborador}`}
              className="g-cartao g-corpo flex h-10 items-center gap-2 bg-muted px-3 text-foreground"
            >
              <UserRound aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{nomeColaborador}</span>
            </div>
          )}
        </CampoFiltro>

        <CampoFiltro rotulo="Mês" className="w-full sm:w-40">
          <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
            <SelectTrigger aria-label="Mês" className="g-controle"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MESES.map((nome, i) => (
                <SelectItem key={nome} value={String(i + 1)}>{nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CampoFiltro>

        <CampoFiltro rotulo="Ano" className="w-full sm:w-28">
          <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
            <SelectTrigger aria-label="Ano" className="g-controle"><SelectValue /></SelectTrigger>
            <SelectContent>
              {anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </CampoFiltro>
      </BarraFiltros>

      {carregando ? (
        <div role="status" aria-label="Carregando" className="flex flex-col gap-4">
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr))]">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[72px] rounded-[var(--g-raio)]" />)}
          </div>
          <Skeleton className="h-48 w-full rounded-[var(--g-raio)]" />
        </div>
      ) : !selecionado ? (
        <div className="g-cartao">
          <EstadoVazio
            icone={<Users />}
            titulo="Nenhum colaborador do comercial nesta empresa"
            descricao="O painel lista quem está no setor comercial ou tem meta no período. Sem nenhum dos dois, não há o que acompanhar."
            acao={isAdmin ? (
              <>
                <Button onClick={() => navigate('/equipe')}>
                  <Users aria-hidden="true" />
                  Cadastrar a equipe
                </Button>
                <Button variant="outline" onClick={() => navigate('/definir-metas')}>
                  <Target aria-hidden="true" />
                  Definir metas
                </Button>
              </>
            ) : undefined}
          />
        </div>
      ) : !meta ? (
        <div className="g-cartao">
          <EstadoVazio
            icone={<Target />}
            titulo={`Sem meta definida para ${MESES[mes - 1].toLowerCase()} de ${ano}`}
            descricao={isAdmin
              ? `Defina a meta de ${nomeColaborador} para o painel calcular projeção e alertas. Enquanto não houver alvo, não há projeção — e não é o mesmo que estar zerado.`
              : 'Um administrador da empresa precisa definir sua meta do mês para o painel calcular projeção e alertas. Um mês anterior pode já ter meta.'}
            /* Todo vazio oferece ação pertinente, inclusive a quem não pode
               definir meta: voltar um mês é o gesto que resolve o caso mais
               comum — a meta existe, o filtro é que está no mês errado. */
            acao={
              <>
                {isAdmin && (
                  <Button onClick={() => navigate('/definir-metas')}>
                    <Target aria-hidden="true" />
                    Definir em Ferramentas
                  </Button>
                )}
                <Button variant="outline" onClick={irParaMesAnterior}>
                  <CalendarDays aria-hidden="true" />
                  Ver o mês anterior
                </Button>
              </>
            }
          />
        </div>
      ) : analise && (
        <>
          {/* ── Alerta ── */}
          {analise.severidade !== 'nenhum' && (
            <Alert variant={ESTILO_ALERTA[analise.severidade].variante}>
              <AlertTriangle aria-hidden="true" className="w-4 h-4" />
              <AlertTitle>{ESTILO_ALERTA[analise.severidade].titulo}</AlertTitle>
              <AlertDescription>
                {formatFracao(analise.projecao.percentualRealizado, 0)} da meta com{' '}
                {analise.projecao.diasUteisRestantes} dia(s) útil(eis) restante(s).
                Abaixo do mínimo de {Number(config?.alerta_percentual_minimo ?? 70)}% configurado.
              </AlertDescription>
            </Alert>
          )}

          {/* ── Meta × realizado ── */}
          <FaixaIndicadores itens={indicadores} />

          {/* Sem alvo monetário o motor projeta contra zero: a tela diz isso em
              vez de desenhar barras e ritmos que não significam nada. */}
          {!metaMonetariaDefinida && (
            <AvisoDeContexto
              titulo="Sem meta de faturamento, não há projeção monetária"
              acao={isAdmin ? (
                <Button size="sm" variant="outline" onClick={() => navigate('/definir-metas')}>
                  Definir faturamento
                </Button>
              ) : undefined}
            >
              A meta principal deste mês é {BASES_META[meta.base_meta]?.label.toLowerCase()}, e ela
              continua medida abaixo. Projeção, ritmo e dias necessários dependem de um alvo em
              reais — sem ele, apareceriam como zero.
            </AvisoDeContexto>
          )}

          {/* ── As três pontas da esteira ──
              Na ordem em que o dinheiro anda: o negócio fecha, a nota sai, o
              dinheiro entra. A principal — a que dispara o alerta — vem
              marcada; as outras duas existem para mostrar ONDE a esteira
              travou. Ponta sem alvo definido não aparece: cobrar uma meta que
              ninguém escreveu é barulho. */}
          {PONTAS.some((l) => analise.pontas[l.chave].alvo > 0) && (
            <SecaoGestao titulo="As três pontas do mês">
              <p className="g-meta text-muted-foreground">{AVISO_CRITERIOS_DISTINTOS}</p>
              <div className="g-cartao flex flex-col gap-4 p-4 sm:p-6">
                {PONTAS.filter((l) => analise.pontas[l.chave].alvo > 0).map((l) => {
                  const p = analise.pontas[l.chave];
                  const pct = p.alvo > 0 ? Math.min((p.feito / p.alvo) * 100, 100) : 0;
                  const principal = meta.base_meta === l.chave;
                  const exibir = (v: number) => (l.moeda ? formatBRL(v) : String(v));
                  const apuracao = APURACAO[l.metrica];
                  return (
                    <div key={l.chave} className="flex flex-col gap-1.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="g-corpo flex items-center gap-2 font-medium text-foreground">
                          {l.titulo}
                          {principal && <Badge variant="info">principal</Badge>}
                          <span className="font-normal text-muted-foreground">· {l.sub}</span>
                        </span>
                        <span className="g-corpo whitespace-nowrap tabular-nums text-foreground">
                          <strong>{exibir(p.feito)}</strong>
                          <span className="text-muted-foreground"> de {exibir(p.alvo)}</span>
                        </span>
                      </div>
                      <Progress
                        value={pct}
                        className="h-2"
                        indicatorClassName={cn(
                          pct >= 100 ? 'bg-success' : principal ? 'bg-primary' : 'bg-muted-foreground',
                        )}
                        aria-label={`${l.titulo}: ${exibir(p.feito)} de ${exibir(p.alvo)}`}
                      />
                      {/* Cada ponta cai num mês por uma data diferente — é o que
                          impede de ler as três como etapas do mesmo lote. */}
                      <LinhaApuracao curto={apuracao.curto} explicacao={apuracao.explicacao} />
                    </div>
                  );
                })}
              </div>
            </SecaoGestao>
          )}

          {metaMonetariaDefinida && (
            <>
              {/* A barra usa a MESMA severidade do alerta (estadoDaBarra), para as
                  duas não contarem histórias diferentes. Antes era laranja fixa,
                  igual com 24% e com 98% — exceção à régua de cor encerrada em
                  2026-08-08. */}
              <div className="g-cartao p-4 sm:p-6">
                <div className="g-corpo mb-2 flex items-center justify-between text-muted-foreground">
                  <span>Progresso {baseApurada ? `· ${baseApurada.curto}` : ''}</span>
                  <span className="tabular-nums">
                    {formatFracao(analise.projecao.percentualRealizado, 1)}
                  </span>
                </div>
                <Progress
                  value={Math.min(100, analise.projecao.percentualRealizado * 100)}
                  className="h-2"
                  indicatorClassName={barra.cor}
                  aria-label={barra.rotulo}
                  title={barra.rotulo}
                />
                <p className="sr-only">{barra.rotulo}</p>
              </div>

              {/* ── O que falta fazer ── */}
              <SecaoGestao titulo="O que falta para bater a meta">
                <div className="g-cartao flex flex-col gap-6 p-4 sm:p-6">
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <p className="g-meta text-muted-foreground">Participações</p>
                      <p className="text-xl font-bold leading-7 tabular-nums text-foreground">
                        {analise.projecao.participacoesNecessarias}
                      </p>
                      <LinhaApuracao
                        curto={`propostas a enviar · ${APURACAO.participados.curto}`}
                        explicacao={APURACAO.participados.explicacao}
                      />
                    </div>
                    <div>
                      <p className="g-meta text-muted-foreground">Contratos</p>
                      <p className="text-xl font-bold leading-7 tabular-nums text-foreground">
                        {analise.projecao.contratosNecessarios}
                      </p>
                      <LinhaApuracao
                        curto={`a ganhar · ${APURACAO.ganhos.curto}`}
                        explicacao={APURACAO.ganhos.explicacao}
                      />
                    </div>
                    <div>
                      <p className="g-meta text-muted-foreground">Ritmo necessário</p>
                      <p className="text-xl font-bold leading-7 tabular-nums text-foreground">
                        {formatBRL(paraReais(analise.projecao.runRateNecessarioCent))}
                      </p>
                      <p className="g-meta text-muted-foreground">por dia útil restante</p>
                    </div>
                    <div>
                      <p className="g-meta text-muted-foreground">Ritmo atual</p>
                      <p className="text-xl font-bold leading-7 tabular-nums text-foreground">
                        {/* Dia 1 do mês não tem ritmo "zero": não tem ritmo ainda.
                            A fórmula devolve 0 porque não há divisor — exibir esse
                            0 como fato acusaria de parado quem nem começou. */}
                        {analise.projecao.diasUteisDecorridos > 0
                          ? formatBRL(paraReais(analise.projecao.ritmoDiarioCent))
                          : <ValorIndisponivel razao="Nenhum dia útil decorrido no mês" />}
                      </p>
                      <p className="g-meta text-muted-foreground">
                        {analise.projecao.gapRitmo === null
                          ? 'sem ritmo apurado ainda'
                          : analise.projecao.gapRitmo <= 0
                            ? 'ritmo suficiente'
                            : `precisa subir ${formatFracao(analise.projecao.gapRitmo, 0)}`}
                      </p>
                    </div>
                  </div>

                  <div className="g-corpo flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border pt-6">
                    <span className="text-muted-foreground">Projeção de fechamento:</span>
                    <span className="font-semibold tabular-nums text-foreground">
                      {formatBRL(paraReais(analise.projecao.projecaoFimMesCent))}
                    </span>
                    {/* Bater a meta é ESTADO, não ação: tinta de sucesso quando a
                        projeção alcança, neutra quando não — o verde de ação fica
                        reservado a botão/link/foco (regra da auditoria). */}
                    <Badge
                      variant={
                        analise.projecao.projecaoFimMesCent >= analise.projecao.metaCent ? 'success' : 'muted'
                      }
                    >
                      {analise.projecao.projecaoFimMesCent >= analise.projecao.metaCent
                        ? 'Bate a meta no ritmo atual'
                        : 'Abaixo da meta no ritmo atual'}
                    </Badge>
                  </div>
                </div>
              </SecaoGestao>
            </>
          )}

          {/* ── Premissas ── */}
          <SecaoGestao
            titulo="Premissas do cálculo"
            acoes={
              <div className="flex items-center gap-2">
                <Badge variant={analise.projecao.premissas.confianca === 'alta' ? 'success' : 'muted'}>
                  confiança {analise.projecao.premissas.confianca}
                </Badge>
                <span className="g-meta text-muted-foreground">
                  {analise.historico.length} mês(es) de histórico
                </span>
              </div>
            }
          >
            <div className="g-cartao flex flex-col gap-6 p-4 sm:p-6">
              <ListaDeCampos
                className="sm:grid sm:grid-cols-2 sm:gap-x-8"
                campos={[
                  {
                    rotulo: 'Conversão participado → ganho',
                    valor: formatFracao(analise.projecao.premissas.txGanho, 1),
                    numerico: true,
                  },
                  {
                    rotulo: 'Conversão ganho → faturado',
                    valor: formatFracao(analise.projecao.premissas.txFaturamento, 1),
                    numerico: true,
                  },
                  {
                    rotulo: 'Ticket ponderado',
                    // Ticket zerado é ausência de apuração: nem carteira na
                    // janela, nem valor-alvo cadastrado para a modalidade.
                    valor: analise.projecao.premissas.ticketPonderadoCent > 0
                      ? formatBRL(paraReais(analise.projecao.premissas.ticketPonderadoCent))
                      : <ValorIndisponivel razao="Sem carteira na janela e sem valor-alvo cadastrado" />,
                    numerico: true,
                  },
                  {
                    rotulo: 'Índice sazonal',
                    valor: analise.projecao.premissas.indiceSazonal.toFixed(2),
                    numerico: true,
                  },
                ]}
              />

              {analise.tickets.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="g-meta text-muted-foreground">
                    Carteira na janela de {janelaMeses} mês(es) · {APURACAO.ganhos.curto}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {analise.tickets.map((t) => (
                      <Badge key={t.modalidade} variant="muted" className="font-normal">
                        {rotuloModalidade(t.modalidade)} · {formatFracao(t.mix, 0)} ·{' '}
                        {formatBRL(paraReais(t.ticketCent))} ({t.amostra})
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {analise.projecao.premissas.motivosBaixaConfianca.length > 0 && (
                <Alert variant="warning">
                  <AlertTitle>O que puxou a confiança para baixo</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc list-inside space-y-1">
                      {analise.projecao.premissas.motivosBaixaConfianca.map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </SecaoGestao>
        </>
      )}
    </div>
  );
}
