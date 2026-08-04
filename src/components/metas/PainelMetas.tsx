import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Target, Loader2, Pencil, TrendingUp, CalendarDays, AlertTriangle,
  Gauge, Info, Trophy, Send, UserRound,
} from 'lucide-react';
import {
  useMetasConfig, useValoresAlvo, useRealizadoMensal, useFeriados,
  useColaboradores, useMetas, useContratosAssinados,
} from '@/hooks/useMetasComercial';
import { useAuthorization } from '@/hooks/useAuthorization';
import { useAuth } from '@/contexts/AuthContext';
import { formatBRL, formatPercent } from '@/lib/financeiro/formatters';
import { paraCentavos, paraReais } from '@/lib/metas/dinheiro';
import { apurarTickets } from '@/lib/metas/tickets';
import { resolverValoresAlvo } from '@/lib/metas/valores-alvo';
import { filtrarHistorico, inicioDaJanela, realizadoDoMes } from '@/lib/metas/painel';
import { avaliarAlerta, projetarMeta, type Severidade } from '@/lib/metas/projecao';
import { rotuloModalidade } from '@/lib/metas/modalidades';
import DefinirMetaDialog from './DefinirMetaDialog';

const NOMES_MES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/** Hoje no fuso do negócio, em 'YYYY-MM-DD'. */
function hojeEmSaoPaulo(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

const ESTILO_ALERTA: Record<Exclude<Severidade, 'nenhum'>, { classe: string; titulo: string }> = {
  atencao: {
    classe: 'border-warning/40 bg-warning/10 text-warning',
    titulo: 'Atenção',
  },
  risco: {
    classe: 'border-warning/50 bg-warning/15 text-warning',
    titulo: 'Meta em risco',
  },
  critico: {
    classe: 'border-destructive/40 bg-destructive/10 text-destructive',
    titulo: 'Risco crítico',
  },
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
    <Card className={destaque ? 'border-primary/40' : undefined}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs text-muted-foreground">{rotulo}</span>
          <Icone className={`w-4 h-4 shrink-0 ${destaque ? 'text-primary' : 'text-muted-foreground'}`} />
        </div>
        <p className="text-xl font-bold tabular-nums mt-1">{valor}</p>
        {detalhe && <p className="text-xs text-muted-foreground mt-0.5">{detalhe}</p>}
      </CardContent>
    </Card>
  );
}

export default function PainelMetas() {
  const hoje = hojeEmSaoPaulo();
  const [anoRef, mesRef] = hoje.split('-').map(Number);

  const [ano, setAno] = useState(anoRef);
  const [mes, setMes] = useState(mesRef);
  const [userId, setUserId] = useState<string>('');
  const [dialogoAberto, setDialogoAberto] = useState(false);

  // Admin (global ou da empresa) acompanha o time inteiro e define as metas.
  // Colaborador vê apenas o próprio painel, sem poder alterar a própria meta.
  const { isAdmin } = useAuthorization();
  const { user } = useAuth();

  const { data: config } = useMetasConfig();
  const { data: colaboradores, isLoading: carregandoColaboradores } = useColaboradores();
  const { data: valoresAlvo } = useValoresAlvo();
  const { data: realizado, isLoading: carregandoRealizado } = useRealizadoMensal({ ano });
  const { data: feriados } = useFeriados(ano);
  const { data: metas } = useMetas({ ano, mes });

  const janelaMeses = config?.janela_historica_meses ?? 6;
  const desde = inicioDaJanela(ano, mes, janelaMeses);

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
    colaborador?.nome || colaborador?.email || (!isAdmin ? user?.email : null) || 'Colaborador';

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

    const tickets = apurarTickets(
      (contratos ?? []).map((c) => ({
        modalidade: c.modalidade,
        valorGlobalCent: paraCentavos(c.valor_global),
      })),
    );

    const valoresAlvoCent = resolverValoresAlvo(valoresAlvo ?? [], hoje, selecionado);

    const projecao = projetarMeta({
      metaCent: paraCentavos(Number(meta.meta_faturamento)),
      realizadoCent,
      ano,
      mes,
      hoje,
      feriados: (feriados ?? []).map((f) => f.data),
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

    return { projecao, severidade, tickets, historico };
  }, [config, selecionado, meta, realizado, contratos, valoresAlvo, feriados, ano, mes, hoje]);

  const anos = [anoRef - 2, anoRef - 1, anoRef, anoRef + 1];
  const carregando = carregandoColaboradores || carregandoRealizado;

  return (
    <div className="space-y-4">
      {/* ── Seletores ── */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-[200px] flex-1">
            <Label className="text-sm text-muted-foreground mb-1 block">Colaborador</Label>
            {isAdmin ? (
              <Select value={selecionado} onValueChange={setUserId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={carregandoColaboradores ? 'Carregando…' : 'Selecione'} />
                </SelectTrigger>
                <SelectContent>
                  {(colaboradores ?? []).map((c) => (
                    <SelectItem key={c.user_id} value={c.user_id}>
                      {c.nome || c.email || c.user_id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="h-9 flex items-center gap-2 px-3 rounded-md border bg-muted/30 text-sm">
                <UserRound className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">{nomeColaborador}</span>
              </div>
            )}
          </div>
          <div className="w-[150px]">
            <Label className="text-sm text-muted-foreground mb-1 block">Mês</Label>
            <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {NOMES_MES.map((nome, i) => (
                  <SelectItem key={nome} value={String(i + 1)}>{nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-[110px]">
            <Label className="text-sm text-muted-foreground mb-1 block">Ano</Label>
            <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {isAdmin && (
            <Button
              size="sm"
              className="h-9"
              disabled={!selecionado}
              onClick={() => setDialogoAberto(true)}
            >
              {meta ? <Pencil className="w-3.5 h-3.5 mr-1.5" /> : <Target className="w-3.5 h-3.5 mr-1.5" />}
              {meta ? 'Editar meta' : 'Definir meta'}
            </Button>
          )}
        </CardContent>
      </Card>

      {carregando ? (
        <Card className="p-12 text-center">
          <Loader2 className="w-6 h-6 mx-auto animate-spin text-muted-foreground" />
        </Card>
      ) : !selecionado ? (
        <Card className="p-12 text-center">
          <p className="text-base text-muted-foreground">
            Nenhum colaborador encontrado nesta empresa.
          </p>
        </Card>
      ) : !meta ? (
        <Card className="p-12 text-center">
          <Target className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-base font-medium text-muted-foreground">
            Sem meta definida para {NOMES_MES[mes - 1].toLowerCase()} de {ano}
          </p>
          {isAdmin ? (
            <>
              <p className="text-base text-muted-foreground mt-1 mb-4">
                Defina a meta de {nomeColaborador} para o painel calcular projeção e alertas.
              </p>
              <Button size="sm" onClick={() => setDialogoAberto(true)}>
                <Target className="w-3.5 h-3.5 mr-1.5" />
                Definir meta
              </Button>
            </>
          ) : (
            <p className="text-base text-muted-foreground mt-1">
              Um administrador da empresa precisa definir sua meta do mês para o painel
              calcular projeção e alertas.
            </p>
          )}
        </Card>
      ) : analise && (
        <>
          {/* ── Alerta ── */}
          {analise.severidade !== 'nenhum' && (
            <div className={`flex items-start gap-2.5 rounded-lg border px-4 py-3 ${ESTILO_ALERTA[analise.severidade].classe}`}>
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <div className="text-base">
                <p className="font-semibold">{ESTILO_ALERTA[analise.severidade].titulo}</p>
                <p className="opacity-90 mt-0.5">
                  {formatPercent(analise.projecao.percentualRealizado, 0)} da meta com{' '}
                  {analise.projecao.diasUteisRestantes} dia(s) útil(eis) restante(s).
                  Abaixo do mínimo de {Number(config?.alerta_percentual_minimo ?? 70)}% configurado.
                </p>
              </div>
            </div>
          )}

          {/* ── Meta × realizado ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Indicador
              rotulo="Meta do mês"
              valor={formatBRL(paraReais(analise.projecao.metaCent))}
              detalhe={meta.base_meta === 'faturamento' ? 'Sobre faturamento' : 'Sobre contratos ganhos'}
              icone={Target}
            />
            <Indicador
              rotulo="Realizado"
              valor={formatBRL(paraReais(analise.projecao.realizadoCent))}
              detalhe={`${formatPercent(analise.projecao.percentualRealizado, 1)} da meta`}
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
              detalhe={`${analise.projecao.diasUteisDecorridos} decorrido(s)`}
              icone={CalendarDays}
            />
          </div>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                <span>Progresso</span>
                <span className="tabular-nums">
                  {formatPercent(analise.projecao.percentualRealizado, 1)}
                </span>
              </div>
              <Progress value={Math.min(100, analise.projecao.percentualRealizado * 100)} className="h-2" />
            </CardContent>
          </Card>

          {/* ── O que falta fazer ── */}
          <Card>
            <CardHeader className="py-3 px-5 border-b">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Gauge className="w-4 h-4 text-primary" />
                O que falta para bater a meta
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Send className="w-3 h-3" /> Participações
                  </p>
                  <p className="text-2xl font-bold tabular-nums mt-1">
                    {analise.projecao.participacoesNecessarias}
                  </p>
                  <p className="text-xs text-muted-foreground">propostas a enviar</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Trophy className="w-3 h-3" /> Contratos
                  </p>
                  <p className="text-2xl font-bold tabular-nums mt-1">
                    {analise.projecao.contratosNecessarios}
                  </p>
                  <p className="text-xs text-muted-foreground">a ganhar</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Ritmo necessário</p>
                  <p className="text-2xl font-bold tabular-nums mt-1">
                    {formatBRL(paraReais(analise.projecao.runRateNecessarioCent))}
                  </p>
                  <p className="text-xs text-muted-foreground">por dia útil restante</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Ritmo atual</p>
                  <p className="text-2xl font-bold tabular-nums mt-1">
                    {formatBRL(paraReais(analise.projecao.ritmoDiarioCent))}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {analise.projecao.gapRitmo === null
                      ? 'sem ritmo apurado ainda'
                      : analise.projecao.gapRitmo <= 0
                        ? 'ritmo suficiente'
                        : `precisa subir ${formatPercent(analise.projecao.gapRitmo, 0)}`}
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <span className="text-muted-foreground text-xs">Projeção de fechamento:</span>
                <span className="font-semibold tabular-nums">
                  {formatBRL(paraReais(analise.projecao.projecaoFimMesCent))}
                </span>
                <Badge
                  variant={analise.projecao.projecaoFimMesCent >= analise.projecao.metaCent ? 'default' : 'outline'}
                  className="text-xs"
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
            <CardHeader className="py-3 px-5 border-b">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Info className="w-4 h-4 text-primary" />
                Premissas do cálculo
                <Badge
                  variant={analise.projecao.premissas.confianca === 'alta' ? 'default' : 'outline'}
                  className="text-xs ml-1"
                >
                  confiança {analise.projecao.premissas.confianca}
                </Badge>
                <span className="ml-auto text-xs font-normal text-muted-foreground">
                  {analise.historico.length} mês(es) de histórico
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Conversão participado → ganho</p>
                  <p className="font-semibold tabular-nums mt-0.5">
                    {formatPercent(analise.projecao.premissas.txGanho, 1)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Conversão ganho → faturado</p>
                  <p className="font-semibold tabular-nums mt-0.5">
                    {formatPercent(analise.projecao.premissas.txFaturamento, 1)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Ticket ponderado</p>
                  <p className="font-semibold tabular-nums mt-0.5">
                    {formatBRL(paraReais(analise.projecao.premissas.ticketPonderadoCent))}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Índice sazonal</p>
                  <p className="font-semibold tabular-nums mt-0.5">
                    {analise.projecao.premissas.indiceSazonal.toFixed(2)}
                  </p>
                </div>
              </div>

              {analise.tickets.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">
                    Carteira na janela de {janelaMeses} mês(es)
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {analise.tickets.map((t) => (
                      <Badge key={t.modalidade} variant="outline" className="text-xs font-normal">
                        {rotuloModalidade(t.modalidade)} · {formatPercent(t.mix, 0)} ·{' '}
                        {formatBRL(paraReais(t.ticketCent))} ({t.amostra})
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {analise.projecao.premissas.motivosBaixaConfianca.length > 0 && (
                <div className="rounded-md border border-warning/30 bg-warning/5 px-3 py-2.5">
                  <p className="text-sm font-medium text-warning mb-1">
                    O que puxou a confiança para baixo
                  </p>
                  <ul className="text-base text-muted-foreground space-y-0.5 list-disc list-inside">
                    {analise.projecao.premissas.motivosBaixaConfianca.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {isAdmin && selecionado && (
        <DefinirMetaDialog
          aberto={dialogoAberto}
          onFechar={() => setDialogoAberto(false)}
          colaborador={{ user_id: selecionado, nome: nomeColaborador }}
          ano={ano}
          mes={mes}
          metaAtual={meta}
        />
      )}
    </div>
  );
}
