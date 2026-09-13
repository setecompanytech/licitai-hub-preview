import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { nomeExibido } from '@/lib/equipe/nomeExibido';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import EstadoVazio from '@/components/shared/EstadoVazio';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Target, Loader2, TrendingUp, CalendarDays, AlertTriangle,
  Gauge, Info, Trophy, Send, UserRound, Users,
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

const NOMES_MES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

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

function Indicador({
  rotulo, valor, detalhe, icone: Icone, destaque = false,
}: {
  rotulo: string;
  valor: string;
  detalhe?: string;
  icone: typeof Target;
  destaque?: boolean;
}) {
  return (
    <Card className={destaque ? 'border-primary' : undefined}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm text-muted-foreground">{rotulo}</span>
          <Icone aria-hidden="true" className={cn('w-4 h-4 shrink-0', destaque ? 'text-primary' : 'text-muted-foreground')} />
        </div>
        <p className="mt-2 text-[2rem] leading-10 font-bold tabular-nums text-foreground">{valor}</p>
        {detalhe && <p className="mt-1 text-xs text-muted-foreground">{detalhe}</p>}
      </CardContent>
    </Card>
  );
}

export default function PainelMetas() {
  const navigate = useNavigate();
  const hoje = hojeEmSaoPaulo();
  const [anoRef, mesRef] = hoje.split('-').map(Number);

  const [ano, setAno] = useState(anoRef);
  const [mes, setMes] = useState(mesRef);
  const [userId, setUserId] = useState<string>('');

  // Admin (global ou da empresa) acompanha o time inteiro e define as metas.
  // Colaborador vê apenas o próprio painel, sem poder alterar a própria meta.
  const { isAdmin } = useAuthorization();
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
      contratos: { alvo: meta.meta_contratos ?? 0, feito: linhaDoMes?.ganhos ?? 0 },
      faturamento: { alvo: Number(meta.meta_faturamento) || 0, feito: linhaDoMes?.valor_faturado ?? 0 },
      quitacao: { alvo: Number(meta.meta_quitacao) || 0, feito: linhaDoMes?.valor_quitado ?? 0 },
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
  const carregando = carregandoColaboradores || carregandoRealizado;

  return (
    <div className="space-y-4">
      {/* ── Seletores ── */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 p-6">
          <div className="min-w-[12rem] flex-1">
            {/* `htmlFor` só quando o campo existe: no ramo do colaborador o valor
                é um bloco de leitura, não um controle rotulável, e `label[for]`
                apontando para um <div> não associa nada. Lá o nome chega pelo
                aria-labelledby do grupo. */}
            <Label
              id="painel-metas-colaborador-rotulo"
              htmlFor={isAdmin ? 'painel-metas-colaborador' : undefined}
              className="mb-1 block text-sm text-muted-foreground"
            >
              Colaborador
            </Label>
            {isAdmin ? (
              <Select value={selecionado} onValueChange={setUserId}>
                <SelectTrigger id="painel-metas-colaborador">
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
              <div
                role="group"
                aria-labelledby="painel-metas-colaborador-rotulo"
                className="flex h-11 items-center gap-2 rounded-md border border-border bg-muted px-3 text-sm text-foreground"
              >
                <UserRound aria-hidden="true" className="w-4 h-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{nomeColaborador}</span>
              </div>
            )}
          </div>
          <div className="w-full sm:w-44">
            <Label htmlFor="painel-metas-mes" className="mb-1 block text-sm text-muted-foreground">Mês</Label>
            <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
              <SelectTrigger id="painel-metas-mes"><SelectValue /></SelectTrigger>
              <SelectContent>
                {NOMES_MES.map((nome, i) => (
                  <SelectItem key={nome} value={String(i + 1)}>{nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full sm:w-32">
            <Label htmlFor="painel-metas-ano" className="mb-1 block text-sm text-muted-foreground">Ano</Label>
            <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
              <SelectTrigger id="painel-metas-ano"><SelectValue /></SelectTrigger>
              <SelectContent>
                {anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {/* Definir meta saiu daqui.
              Por decisão do dono do produto, Gestão é leitura: acompanhar e
              levantar relatórios. Quem define o alvo vai a Ferramentas →
              Definir Metas. Deixar o botão aqui era o que fazia a tela de
              acompanhamento parecer também a de configuração — e foi essa
              ambiguidade que gerou duas entradas de menu para uma tela só.

              Sem meta definida, o painel diz para onde ir em vez de oferecer
              um botão que a regra não permite mais. */}
          {isAdmin && !meta && selecionado && (
            <Button
              variant="outline"
              onClick={() => navigate('/definir-metas')}
            >
              <Target aria-hidden="true" />
              Definir em Ferramentas
            </Button>
          )}
        </CardContent>
      </Card>

      {carregando ? (
        <Card>
          <div role="status" aria-label="Carregando" className="flex items-center justify-center p-12">
            <Loader2 aria-hidden="true" className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </Card>
      ) : !selecionado ? (
        <Card>
          <EstadoVazio
            icone={<Users />}
            titulo="Nenhum colaborador encontrado"
            descricao="Nenhum colaborador do comercial foi encontrado nesta empresa."
          />
        </Card>
      ) : !meta ? (
        <Card>
          <EstadoVazio
            icone={<Target />}
            titulo={`Sem meta definida para ${NOMES_MES[mes - 1].toLowerCase()} de ${ano}`}
            descricao={isAdmin
              ? `Defina a meta de ${nomeColaborador} para o painel calcular projeção e alertas.`
              : 'Um administrador da empresa precisa definir sua meta do mês para o painel calcular projeção e alertas.'}
            acao={isAdmin ? (
              <Button onClick={() => navigate('/definir-metas')}>
                <Target aria-hidden="true" />
                Definir em Ferramentas
              </Button>
            ) : undefined}
          />
        </Card>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Indicador
              rotulo="Meta do mês"
              valor={formatBRL(paraReais(analise.projecao.metaCent))}
              detalhe={BASES_META[meta.base_meta]?.curto ?? 'Sobre faturamento'}
              icone={Target}
            />
            <Indicador
              rotulo="Realizado"
              valor={formatBRL(paraReais(analise.projecao.realizadoCent))}
              detalhe={`${formatFracao(analise.projecao.percentualRealizado, 1)} da meta`}
              icone={Trophy}
              destaque
            />
            <Indicador
              rotulo="Falta"
              valor={formatBRL(paraReais(analise.projecao.restanteCent))}
              detalhe={analise.projecao.restanteCent === 0 ? 'Meta batida' : 'Para bater a meta'}
              icone={TrendingUp}
            />
            <Indicador
              rotulo="Dias úteis restantes"
              valor={String(analise.projecao.diasUteisRestantes)}
              // Ressalva 3 da auditoria: quantos feriados entraram no cálculo
              // precisa ficar VISÍVEL — praça errada não dá erro, só distorce.
              detalhe={`${analise.projecao.diasUteisDecorridos} decorrido(s) · ${analise.feriadosNoMes} feriado(s) da praça ${
                colaborador?.praca_uf
                  ? colaborador.praca_municipio
                    ? `${colaborador.praca_municipio}/${colaborador.praca_uf}`
                    : colaborador.praca_uf
                  : 'nacional'
              }`}
              icone={CalendarDays}
            />
          </div>

          {/* ── As três pontas da esteira ──
              Na ordem em que o dinheiro anda: o negócio fecha, a nota sai, o
              dinheiro entra. A principal — a que dispara o alerta — vem
              marcada; as outras duas existem para mostrar ONDE a esteira
              travou. Ponta sem alvo definido não aparece: cobrar uma meta que
              ninguém escreveu é barulho. */}
          {(analise.pontas.contratos.alvo > 0
            || analise.pontas.faturamento.alvo > 0
            || analise.pontas.quitacao.alvo > 0) && (
            <div className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-4">
              <p className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <Target aria-hidden="true" className="w-4 h-4 text-muted-foreground" />
                As três pontas do mês
              </p>
              {([
                { chave: 'contratos_ganhos', titulo: '1 · Contratos ganhos', sub: 'o negócio fechou',
                  p: analise.pontas.contratos, moeda: false },
                { chave: 'faturamento', titulo: '2 · Faturamento', sub: 'a nota saiu',
                  p: analise.pontas.faturamento, moeda: true },
                { chave: 'nf_quitada', titulo: '3 · NF-e quitada', sub: 'o dinheiro entrou',
                  p: analise.pontas.quitacao, moeda: true },
              ] as const).filter((l) => l.p.alvo > 0).map((l) => {
                const pct = l.p.alvo > 0 ? Math.min((l.p.feito / l.p.alvo) * 100, 100) : 0;
                const principal = meta.base_meta === l.chave;
                const exibir = (v: number) => (l.moeda ? formatBRL(v) : String(v));
                return (
                  <div key={l.chave} className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-2 flex-wrap">
                      <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                        {l.titulo}
                        {principal && <Badge variant="info">principal</Badge>}
                        <span className="font-normal text-muted-foreground">· {l.sub}</span>
                      </span>
                      <span className="whitespace-nowrap text-sm tabular-nums text-foreground">
                        <strong>{exibir(l.p.feito)}</strong>
                        <span className="text-muted-foreground"> de {exibir(l.p.alvo)}</span>
                      </span>
                    </div>
                    <Progress
                      value={pct}
                      className="h-2"
                      indicatorClassName={cn(
                        pct >= 100 ? 'bg-success' : principal ? 'bg-primary' : 'bg-muted-foreground',
                      )}
                      aria-label={`${l.titulo}: ${exibir(l.p.feito)} de ${exibir(l.p.alvo)}`}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* A barra usa a MESMA severidade do alerta (estadoDaBarra), para as
              duas não contarem histórias diferentes. Antes era laranja fixa,
              igual com 24% e com 98% — exceção à régua de cor encerrada em
              2026-08-08. */}
          <Card>
            <CardContent className="p-6">
              <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
                <span>Progresso</span>
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
            </CardContent>
          </Card>

          {/* ── O que falta fazer ── */}
          <Card>
            <CardHeader className="border-b p-6">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <Gauge aria-hidden="true" className="w-4 h-4 text-muted-foreground" />
                O que falta para bater a meta
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Send aria-hidden="true" className="w-4 h-4" /> Participações
                  </p>
                  <p className="mt-1 text-[2rem] leading-10 font-bold tabular-nums text-foreground">
                    {analise.projecao.participacoesNecessarias}
                  </p>
                  <p className="text-xs text-muted-foreground">propostas a enviar</p>
                </div>
                <div>
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Trophy aria-hidden="true" className="w-4 h-4" /> Contratos
                  </p>
                  <p className="mt-1 text-[2rem] leading-10 font-bold tabular-nums text-foreground">
                    {analise.projecao.contratosNecessarios}
                  </p>
                  <p className="text-xs text-muted-foreground">a ganhar</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ritmo necessário</p>
                  <p className="mt-1 text-[2rem] leading-10 font-bold tabular-nums text-foreground">
                    {formatBRL(paraReais(analise.projecao.runRateNecessarioCent))}
                  </p>
                  <p className="text-xs text-muted-foreground">por dia útil restante</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ritmo atual</p>
                  <p className="mt-1 text-[2rem] leading-10 font-bold tabular-nums text-foreground">
                    {formatBRL(paraReais(analise.projecao.ritmoDiarioCent))}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {analise.projecao.gapRitmo === null
                      ? 'sem ritmo apurado ainda'
                      : analise.projecao.gapRitmo <= 0
                        ? 'ritmo suficiente'
                        : `precisa subir ${formatFracao(analise.projecao.gapRitmo, 0)}`}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border pt-6 text-sm">
                <span className="text-sm text-muted-foreground">Projeção de fechamento:</span>
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
            </CardContent>
          </Card>

          {/* ── Premissas ── */}
          <Card>
            <CardHeader className="border-b p-6">
              <CardTitle className="flex flex-wrap items-center gap-2 text-lg font-semibold">
                <Info aria-hidden="true" className="w-4 h-4 text-muted-foreground" />
                Premissas do cálculo
                <Badge variant={analise.projecao.premissas.confianca === 'alta' ? 'success' : 'muted'}>
                  confiança {analise.projecao.premissas.confianca}
                </Badge>
                <span className="ml-auto text-sm font-normal text-muted-foreground">
                  {analise.historico.length} mês(es) de histórico
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-sm text-muted-foreground">Conversão participado → ganho</p>
                  <p className="mt-1 text-base font-semibold tabular-nums text-foreground">
                    {formatFracao(analise.projecao.premissas.txGanho, 1)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Conversão ganho → faturado</p>
                  <p className="mt-1 text-base font-semibold tabular-nums text-foreground">
                    {formatFracao(analise.projecao.premissas.txFaturamento, 1)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ticket ponderado</p>
                  <p className="mt-1 text-base font-semibold tabular-nums text-foreground">
                    {formatBRL(paraReais(analise.projecao.premissas.ticketPonderadoCent))}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Índice sazonal</p>
                  <p className="mt-1 text-base font-semibold tabular-nums text-foreground">
                    {analise.projecao.premissas.indiceSazonal.toFixed(2)}
                  </p>
                </div>
              </div>

              {analise.tickets.length > 0 && (
                <div>
                  <p className="mb-2 text-sm text-muted-foreground">
                    Carteira na janela de {janelaMeses} mês(es)
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
            </CardContent>
          </Card>
        </>
      )}

    </div>
  );
}
