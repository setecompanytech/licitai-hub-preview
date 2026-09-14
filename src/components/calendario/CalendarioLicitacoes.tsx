import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar } from '@/components/ui/calendar';
// `Badge` renderiza uma <div>; dentro de um <button> só cabe conteúdo de
// frase, então os selos que vivem em linhas clicáveis usam `badgeVariants`
// num <span> — mesma pele, HTML conforme. Fora de botão, o componente.
import { Badge, badgeVariants } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import EstadoVazio from '@/components/shared/EstadoVazio';
import {
  CalendarDays, FileText, AlertTriangle, Clock, CheckCircle2,
  ChevronRight, Shield, Building2, Database, Trophy, FileWarning, RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
// Autoridade única do vocabulário de status (CLAUDE.md, princípio 1).
import { normalizarStatus } from '@/lib/licitacao/status';
/* Vencimento de documento passou a ter uma régua só, compartilhada com o
   painel: `lib/documentos/validade`. Duas correções vieram com ela — "vence
   hoje" deixou de cair no balde de 30 dias, e a comparação virou de DIA (antes
   era contra `new Date()` COM hora, e às 9h da manhã um documento válido o dia
   inteiro já aparecia vencido). A leitura das três fontes saiu daqui para
   `useVencimentosDeDocumentos`, porque o painel precisa exatamente destes
   mesmos vencimentos e uma segunda consulta divergiria na primeira mudança. */
import {
  diaDaValidade, diasAteVencer, exigeAtencao, frasePrazo,
  ORDEM_DE_URGENCIA, ROTULO_DA_SITUACAO, type SituacaoValidade,
} from '@/lib/documentos/situacao';
import {
  useVencimentosDeDocumentos, ROTA_DA_ORIGEM, ROTULO_DA_ORIGEM, type DocValidade,
} from '@/hooks/useVencimentosDeDocumentos';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useQuery } from '@tanstack/react-query';
import { format, isWithinInterval, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import SyncCalendarButton from './SyncCalendarButton';
import { CalendarEvent } from '@/lib/calendar-sync';

interface LicitacaoEvento {
  id: string;
  numero: string;
  objeto: string;
  orgao: string;
  status: string;
  data_abertura: string | null;
  data_encerramento: string | null;
  modalidade: string;
  valor_estimado: number | null;
}

/** Ponto colorido antes do número do processo — reforço do status, que também
 *  vai escrito no selo ao lado. Só tokens. */
const statusColors: Record<string, string> = {
  Publicado: 'bg-info',
  Monitorando: 'bg-info',
  'Em Análise': 'bg-warning',
  'Proposta Enviada': 'bg-primary',
  'Em Disputa': 'bg-primary',
  Vencida: 'bg-success',
  Perdida: 'bg-destructive',
  Homologada: 'bg-success',
  Arquivada: 'bg-muted-foreground',
};

/* Tinta por situação de validade, num lugar só. Cada bloco reescrevia o
   ternário "vencido ? destrutivo : aviso" — com a categoria nova ("vence
   hoje") seriam cinco lugares para lembrar. Vence hoje acompanha o vencido no
   vermelho: a ação é hoje nos dois casos. */
const PELE_DA_SITUACAO: Record<
  SituacaoValidade,
  { caixa: string; tinta: string; selo: 'danger' | 'warning' | 'success' }
> = {
  vencido: { caixa: 'border-destructive-line bg-destructive-tint', tinta: 'text-destructive-ink', selo: 'danger' },
  vence_hoje: { caixa: 'border-destructive-line bg-destructive-tint', tinta: 'text-destructive-ink', selo: 'danger' },
  vencendo: { caixa: 'border-warning-line bg-warning-tint', tinta: 'text-warning-ink', selo: 'warning' },
  ok: { caixa: 'border-border bg-card hover:bg-muted', tinta: 'text-muted-foreground', selo: 'success' },
};

/* Todo evento da agenda tem que alcançar a origem dele — era o defeito central
   desta tela: a data existia, mas o clique não levava ao registro. O mapa
   origem → rota mora em `useVencimentosDeDocumentos` (ROTA_DA_ORIGEM), junto
   da consulta que produz a origem, e é o mesmo que o painel usa.

   O cadastro de credencial de portal mora na aba "Portais" do Robô de Lances,
   e essa aba ainda vive em `useState` — `RoboLances` não lê `?aba=`. Mandar
   `?aba=portais` seria um link que finge navegar e cai em "Disputar" sem
   avisar; por isso leva-se à tela, e a aba fica a um clique. */

export default function CalendarioLicitacoes() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [activeTab, setActiveTab] = useState('todos');
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const navigate = useNavigate();
  const hoje = new Date();

  // Fetch licitações
  const {
    data: licitacoes = [],
    isLoading: carregandoLicitacoes,
    error: erroLicitacoes,
    refetch: recarregarLicitacoes,
  } = useQuery({
    queryKey: ['calendario-licitacoes', user?.id, empresaAtiva?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('licitacoes')
        .select('id, numero, objeto, orgao, status, data_abertura, data_encerramento, modalidade, valor_estimado')
        .order('data_abertura', { ascending: true });
      // CLAUDE.md, princípio 3: falha silenciosa é proibida. Sem este `throw`
      // o react-query nunca enxerga o erro do banco — a consulta "termina bem"
      // com zero linhas e a tela pinta "nada agendado", imagem idêntica à de
      // uma agenda de verdade vazia. Quem tem sessão hoje não descobre.
      if (error) throw error;
      // Agenda da empresa, como o painel que a exibe (RLS limita ao permitido)
      return (data || []) as LicitacaoEvento[];
    },
    enabled: !!user,
  });

  /* Os vencimentos vêm do hook compartilhado com o painel — mesma consulta,
     mesmo cache, mesma classificação de situação. */
  const {
    documentos: docsValidade,
    carregando: carregandoDocs,
    erro: erroDocs,
    recarregar: recarregarDocs,
  } = useVencimentosDeDocumentos();

  // Fetch backup config for calendar integration
  const {
    data: backupConfig,
    isLoading: carregandoBackup,
    error: erroBackup,
    refetch: recarregarBackup,
  } = useQuery({
    queryKey: ['calendario-backup-config', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('backup_config')
        .select('*')
        .eq('user_id', user.id)
        .eq('ativo', true)
        .eq('alerta_calendario', true)
        .maybeSingle();
      // `maybeSingle` já devolve `data: null` sem erro quando não há linha —
      // então um `error` aqui é falha de verdade, não ausência de config.
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Generate backup dates for the next 90 days
  const backupDates = useMemo(() => {
    if (!backupConfig) return [];
    const dates: Date[] = [];
    const freq = backupConfig.frequencia;
    const start = new Date();
    const end = addDays(start, 90);
    const [h, m] = (backupConfig.hora_execucao || '03:00').split(':').map(Number);

    if (freq === 'diario') {
      const cur = new Date(start);
      cur.setHours(h, m, 0, 0);
      if (cur <= start) cur.setDate(cur.getDate() + 1);
      while (cur <= end) {
        dates.push(new Date(cur));
        cur.setDate(cur.getDate() + 1);
      }
    } else if (freq === 'semanal') {
      const targetDay = backupConfig.dia_semana ?? 1;
      const cur = new Date(start);
      const daysAhead = ((targetDay - cur.getDay()) + 7) % 7 || 7;
      cur.setDate(cur.getDate() + daysAhead);
      cur.setHours(h, m, 0, 0);
      while (cur <= end) {
        dates.push(new Date(cur));
        cur.setDate(cur.getDate() + 7);
      }
    } else if (freq === 'mensal') {
      const targetDia = backupConfig.dia_mes ?? 1;
      const cur = new Date(start);
      cur.setDate(targetDia);
      cur.setHours(h, m, 0, 0);
      if (cur <= start) cur.setMonth(cur.getMonth() + 1);
      while (cur <= end) {
        dates.push(new Date(cur));
        cur.setMonth(cur.getMonth() + 1);
      }
    }
    return dates;
  }, [backupConfig]);

  // Build calendar markers
  const eventDates = useMemo(() => {
    const map = new Map<string, { licitacoes: LicitacaoEvento[]; docs: DocValidade[]; backups: boolean }>();

    const getEntry = (key: string) => {
      if (!map.has(key)) map.set(key, { licitacoes: [], docs: [], backups: false });
      return map.get(key)!;
    };

    licitacoes.forEach((l) => {
      [l.data_abertura, l.data_encerramento].forEach((d) => {
        if (!d) return;
        const key = format(new Date(d), 'yyyy-MM-dd');
        const entry = getEntry(key);
        if (!entry.licitacoes.find((x) => x.id === l.id)) entry.licitacoes.push(l);
      });
    });

    docsValidade.forEach((doc) => {
      const key = format(diaDaValidade(doc.validade), 'yyyy-MM-dd');
      getEntry(key).docs.push(doc);
    });

    backupDates.forEach((bd) => {
      const key = format(bd, 'yyyy-MM-dd');
      getEntry(key).backups = true;
    });

    return map;
  }, [licitacoes, docsValidade, backupDates]);

  // Events for selected date
  const selectedEvents = useMemo(() => {
    if (!selectedDate) return { licitacoes: [], docs: [], backups: false };
    const key = format(selectedDate, 'yyyy-MM-dd');
    return eventDates.get(key) || { licitacoes: [], docs: [], backups: false };
  }, [selectedDate, eventDates]);

  // Upcoming licitações (next 30 days)
  const upcoming = useMemo(() => {
    const end = addDays(hoje, 30);
    return licitacoes
      .filter((l) => {
        const d = l.data_abertura ? new Date(l.data_abertura) : null;
        return d && isWithinInterval(d, { start: hoje, end });
      })
      .sort((a, b) => new Date(a.data_abertura!).getTime() - new Date(b.data_abertura!).getTime());
  }, [licitacoes]);

  // Tudo que pede atenção: vencido, vence hoje ou vence dentro da janela.
  const docsAlerta = useMemo(
    () => docsValidade.filter((d) => exigeAtencao(d.situacao))
      .sort((a, b) => diaDaValidade(a.validade).getTime() - diaDaValidade(b.validade).getTime()),
    [docsValidade]
  );

  /* BUG corrigido: a aba Documentos ordenava com `docsValidade.sort(...)`, que
     ordena NO LUGAR — e o array é o objeto que o react-query guarda em cache.
     Cada render reordenava o cache do lado de fora da biblioteca; quem lesse
     `docsValidade` depois (o mapa do calendário, o .ICS) recebia uma ordem
     diferente da que tinha gravado. A cópia isola a ordenação da apresentação,
     e o `useMemo` ainda tira o sort do caminho de cada render. */
  const docsOrdenados = useMemo(
    () =>
      [...docsValidade].sort((a, b) =>
        ORDEM_DE_URGENCIA[a.situacao] - ORDEM_DE_URGENCIA[b.situacao] ||
        diaDaValidade(a.validade).getTime() - diaDaValidade(b.validade).getTime()),
    [docsValidade]
  );

  /* As metades do alerta, cada uma em seu Alert. "Vence hoje" passou a ser uma
     categoria própria: no balde de 30 dias, o único dia em que ainda dá para
     renovar a certidão a tempo ficava com o mesmo peso visual de um prazo de
     um mês. Ele acompanha o vencido no alerta vermelho porque a ação é hoje. */
  const docsVencidos = useMemo(() => docsAlerta.filter((d) => d.situacao === 'vencido'), [docsAlerta]);
  const docsVencemHoje = useMemo(() => docsAlerta.filter((d) => d.situacao === 'vence_hoje'), [docsAlerta]);
  const docsVencendo = useMemo(() => docsAlerta.filter((d) => d.situacao === 'vencendo'), [docsAlerta]);

  // Urgentes (próximos 3 dias)
  const urgentes = useMemo(() => {
    const limit = addDays(hoje, 3);
    return licitacoes.filter((l) => {
      const d = l.data_abertura ? new Date(l.data_abertura) : null;
      return d && isWithinInterval(d, { start: hoje, end: limit });
    });
  }, [licitacoes]);

  // Calendar modifiers
  const modifiers = useMemo(() => {
    const licitDates: Date[] = [];
    const docDates: Date[] = [];
    const urgentDates: Date[] = [];
    const bkpDates: Date[] = [];

    eventDates.forEach((val, key) => {
      const d = new Date(key + 'T12:00:00');
      if (val.licitacoes.length > 0) licitDates.push(d);
      if (val.docs.length > 0) docDates.push(d);
      if (val.backups) bkpDates.push(d);
      if (
        val.licitacoes.some((l) => {
          const dt = l.data_abertura ? new Date(l.data_abertura) : null;
          return dt && isWithinInterval(dt, { start: hoje, end: addDays(hoje, 3) });
        }) ||
        val.docs.some((doc) => doc.situacao === 'vencido' || doc.situacao === 'vence_hoje')
      )
        urgentDates.push(d);
    });

    return { licitacao: licitDates, documento: docDates, urgente: urgentDates, backup: bkpDates };
  }, [eventDates]);

  /* Marcação do dia por classe, não por `style` com `hsl(...)` escrito à mão:
     cor dentro do .tsx é o que a identidade 12/09 proíbe, e a tinta do token
     acompanha o tema sozinha. `modifiersClassNames` é a API equivalente do
     react-day-picker — mesmos quatro modificadores, mesma leitura.

     A prioridade é dada por ESPECIFICIDADE, nunca pela ordem em que o Tailwind
     emite as utilities: `[&&]` repete a classe no seletor (0,2,0), `[&&&]`
     três vezes (0,3,0) e `[&&&&]` quatro (0,4,0) — conferido no CSS compilado
     deste projeto. O que precisa ser vencido em `ui/calendar.tsx`:

       day_selected  bg-primary / text-primary-foreground        (0,1,0)
                     hover: e focus: das mesmas duas             (0,2,0)
       day (ghost)   hover:bg-muted / hover:text-foreground      (0,2,0)
       day_today     bg-accent / text-accent-foreground          (0,1,0)

     Por isso o marcador de licitação fica em 0,3,0: em 0,2,0 ele empatava com
     os estados de `hover`/`focus` do dia selecionado e o desempate virava a
     ordem do arquivo — fundo claro com número BRANCO, ilegível, justamente no
     caminho comum (a tela abre com hoje já selecionado e a pessoa clica nos
     dias que têm evento).

     Ordem entre os marcadores, explícita:
       urgente (0,4,0) > licitação (0,3,0)  — vermelho não pode ser encoberto
       documento (0,3,0) > backup (0,2,0)   — vencimento na frente do backup
     O `rounded-full` também precisa do reforço: solto, ele perde para o
     `rounded-md` do botão de dia e o marcador saía quadrado, ao contrário
     das bolinhas da legenda.

     A seleção volta a se distinguir por um anel `ring-inset` (por dentro,
     para não invadir o dia vizinho), que não disputa com a tinta. */
  const anelSelecionado = 'aria-selected:ring-2 aria-selected:ring-inset aria-selected:ring-ring';
  const modifiersClassNames = {
    licitacao: `[&&&]:rounded-full [&&&]:bg-primary-tint [&&&]:text-primary font-semibold ${anelSelecionado}`,
    documento: `[&&&]:rounded-full [&&&]:border-2 [&&&]:border-warning ${anelSelecionado}`,
    urgente: `[&&&&]:rounded-full [&&&&]:bg-destructive-tint [&&&&]:text-destructive-ink font-semibold ${anelSelecionado}`,
    backup: `[&&]:rounded-full [&&]:border-2 [&&]:border-info ${anelSelecionado}`,
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const origemIcon = (origem: DocValidade['origem']) => {
    if (origem === 'certificado_empresa') return <Building2 className="w-4 h-4 text-warning" />;
    if (origem === 'certificado_portal') return <Shield className="w-4 h-4 text-warning" />;
    return <FileText className="w-4 h-4 text-warning" />;
  };

  const irParaProcesso = (id: string) => navigate(`/processo/${id}`);
  const irParaOrigemDoDoc = (doc: DocValidade) => navigate(ROTA_DA_ORIGEM[doc.origem]);

  /* A grade do mês ganha a coluna larga da composição (≈65%), e o calendário
     do shadcn nasce com célula de 36px fixos (`w-9`) — largura que não olha
     para o contêiner. Numa coluna de 65% ele ficaria encolhido no canto
     esquerdo, com dois terços do cartão vazios. Estas linhas trocam largura
     fixa por `flex-1` e deixam a grade acompanhar a coluna; todo o resto do
     `classNames` continua vindo de `ui/calendar.tsx` (lá o spread do que
     recebemos é aplicado DEPOIS dos padrões, então só estas chaves mudam).

     `day` recompõe `buttonVariants({ variant: 'ghost' })` de propósito: é o
     mesmo par `hover:bg-muted / hover:text-foreground` (0,2,0) que a análise
     de especificidade dos marcadores acima pressupõe. Escrever o hover à mão
     aqui faria os dois textos divergirem sem ninguém perceber. */
  const calendarioFluido = {
    months: 'flex w-full flex-col',
    month: 'w-full space-y-4',
    table: 'w-full border-collapse',
    head_row: 'flex w-full',
    head_cell: 'flex-1 rounded-md text-[0.8rem] font-normal text-muted-foreground',
    row: 'mt-2 flex w-full',
    cell: 'relative flex-1 p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md',
    day: cn(buttonVariants({ variant: 'ghost' }), 'h-10 w-full p-0 font-normal aria-selected:opacity-100'),
  };

  /* CLAUDE.md, princípio 3 — falha silenciosa é proibida. Nenhuma das três
     consultas tratava `error`: queda de rede, RLS negando ou view ausente
     davam exatamente a mesma tela de "nada agendado". Cada fonte que falhou é
     nomeada, com a mensagem real do banco, e uma retentativa só refaz o que
     quebrou (não vale re-baixar a agenda inteira porque o backup falhou). */
  const fontesComErro: { rotulo: string; mensagem: string; recarregar: () => void }[] = [];
  if (erroLicitacoes) {
    fontesComErro.push({
      rotulo: 'Processos do calendário',
      mensagem: (erroLicitacoes as Error).message,
      recarregar: () => void recarregarLicitacoes(),
    });
  }
  if (erroDocs) {
    fontesComErro.push({
      rotulo: 'Validade de documentos',
      mensagem: (erroDocs as Error).message,
      recarregar: () => void recarregarDocs(),
    });
  }
  if (erroBackup) {
    fontesComErro.push({
      rotulo: 'Agenda de backup',
      mensagem: (erroBackup as Error).message,
      recarregar: () => void recarregarBackup(),
    });
  }

  /* Estado de carregando — não existia. As três consultas usavam `data = []`
     como padrão e ninguém lia `isLoading`, então enquanto a rede trabalhava a
     tela desenhava os estados VAZIOS por inteiro ("Nenhum evento nesta data",
     KPIs em 0) e depois trocava tudo de uma vez. Quem abria a tela lia um
     "não há nada" que era mentira.

     `isLoading` do react-query v5 é `isPending && isFetching`: consulta
     desabilitada (sem `user`) não entra aqui, então a tela sem sessão não fica
     presa num esqueleto eterno. */
  const carregando = carregandoLicitacoes || carregandoDocs || carregandoBackup;

  if (carregando) {
    return (
      <div className="space-y-4" role="status" aria-busy="true">
        <span className="sr-only">Carregando a agenda</span>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,65fr)_minmax(0,35fr)]">
          <Card className="order-2 space-y-4 p-6 lg:order-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-10 w-40" />
            </div>
            <Skeleton className="h-[320px] w-full rounded-md" />
            <div className="flex flex-wrap gap-3">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-4 w-24" />
              ))}
            </div>
          </Card>
          <Card className="order-1 space-y-4 p-6 lg:order-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-10 w-full" />
            <div className="space-y-2">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          </Card>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <Card key={i} className="space-y-2 p-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-28" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Erro antes de tudo: o que está errado na tela precisa ser lido antes
          do que ela conseguiu montar. */}
      {fontesComErro.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="w-5 h-5" aria-hidden="true" />
          <AlertTitle>Parte da agenda não pôde ser carregada</AlertTitle>
          <AlertDescription className="space-y-3">
            <ul className="space-y-1">
              {fontesComErro.map((f) => (
                <li key={f.rotulo}>
                  • <strong>{f.rotulo}</strong> — {f.mensagem}
                </li>
              ))}
            </ul>
            <p>
              O que aparece abaixo está incompleto: a ausência de um evento aqui{' '}
              <strong>não</strong> significa que ele não existe.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => fontesComErro.forEach((f) => f.recarregar())}
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Alertas urgentes — Alert de ui em tinta (`destructive`/`warning`), no
          lugar das caixas com alfa composto na mão (`bg-destructive/10`). */}
      {(urgentes.length > 0 || docsVencidos.length > 0 || docsVencemHoje.length > 0) && (
        <Alert variant="destructive">
          <AlertTriangle className="w-5 h-5" aria-hidden="true" />
          <AlertTitle>Exige atenção agora</AlertTitle>
          <AlertDescription className="space-y-3">
            {urgentes.length > 0 && (
              <div>
                <p className="font-semibold">
                  {urgentes.length} licitaç{urgentes.length > 1 ? 'ões' : 'ão'} nos próximos 3 dias
                </p>
                {/* Cada linha do alerta é um evento, então cada linha abre o
                    processo. Alerta que só narra obriga a pessoa a procurar o
                    mesmo registro de novo em outra tela. */}
                <ul className="mt-1 space-y-1">
                  {urgentes.map((l) => (
                    <li key={l.id}>
                      •{' '}
                      <button
                        type="button"
                        onClick={() => irParaProcesso(l.id)}
                        className="text-left underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
                      >
                        {l.numero} — {l.orgao} —{' '}
                        {l.data_abertura &&
                          format(new Date(l.data_abertura), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {docsVencidos.length > 0 && (
              <div>
                <p className="font-semibold">
                  {docsVencidos.length} documento(s) vencido(s)
                </p>
                <ul className="mt-1 space-y-1">
                  {docsVencidos.map((d) => (
                    <li key={d.id}>
                      •{' '}
                      <button
                        type="button"
                        onClick={() => irParaOrigemDoDoc(d)}
                        title={ROTULO_DA_ORIGEM[d.origem]}
                        className="text-left underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
                      >
                        {d.nome} — venceu em {format(diaDaValidade(d.validade), 'dd/MM/yyyy')}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {/* Vence HOJE — separado do vencido e do "em 30 dias" porque a ação
                é diferente: ainda dá para usar o documento, e é o último dia. */}
            {docsVencemHoje.length > 0 && (
              <div>
                <p className="font-semibold">
                  {docsVencemHoje.length} documento(s) vence(m) hoje
                </p>
                <ul className="mt-1 space-y-1">
                  {docsVencemHoje.map((d) => (
                    <li key={d.id}>
                      •{' '}
                      <button
                        type="button"
                        onClick={() => irParaOrigemDoDoc(d)}
                        title={ROTULO_DA_ORIGEM[d.origem]}
                        className="text-left underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
                      >
                        {d.nome} — último dia de validade ({format(diaDaValidade(d.validade), 'dd/MM/yyyy')})
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Warning: docs vencendo */}
      {docsVencendo.length > 0 && (
        <Alert variant="warning">
          <Clock className="w-5 h-5" aria-hidden="true" />
          <AlertTitle>
            {docsVencendo.length} documento(s) próximo(s) do vencimento
          </AlertTitle>
          <AlertDescription>
            <ul className="mt-1 space-y-1">
              {docsVencendo.map((d) => {
                // Dias de calendário (a régua compartilhada). A conta antiga
                // usava `hoje` COM hora, então o mesmo documento dizia "vence
                // em 5 dias" de manhã e "em 4" à tarde.
                const diff = diasAteVencer(d.validade);
                return (
                  <li key={d.id}>
                    •{' '}
                    <button
                      type="button"
                      onClick={() => irParaOrigemDoDoc(d)}
                      title={ROTULO_DA_ORIGEM[d.origem]}
                      className="text-left underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
                    >
                      {d.nome} — vence em <strong>{diff} dia{diff > 1 ? 's' : ''}</strong> (
                      {format(diaDaValidade(d.validade), 'dd/MM/yyyy')})
                    </button>
                  </li>
                );
              })}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Composição da referência: a grade do mês ocupa ≈65% da área útil e o
          painel de agenda e alertas os ≈35% restantes. Estava invertido —
          `lg:grid-cols-3` com o calendário em 1 coluna e o painel em 2 dava
          33%/67%, o oposto do contrato.

          `minmax(0, …fr)` em vez de `65fr`/`35fr` puro porque o padrão de uma
          coluna de grade é `min-width: auto`: sem isso, o texto longo do objeto
          empurra a coluna do painel para além da fração e o `truncate` das
          linhas nunca chega a valer.

          Abaixo de `lg` a AGENDA vem primeiro (`order`), como manda a regra de
          celular do padrão: a lista do que acontece vale mais do que a grade do
          mês numa tela estreita. A ordem no DOM continua calendário → painel
          para que a navegação por teclado no desktop siga a leitura visual da
          esquerda para a direita, que é onde esta tela é operada. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,65fr)_minmax(0,35fr)]">
        {/* Calendar */}
        <Card className="order-2 p-6 lg:order-1">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-primary" aria-hidden="true" />
              Calendário
            </h2>
            <SyncCalendarButton
              events={[
                ...licitacoes
                  .filter((l) => l.data_abertura)
                  .map((l): CalendarEvent => ({
                    uid: l.id,
                    title: `[${l.modalidade}] ${l.numero} — ${l.orgao}`,
                    description: l.objeto,
                    start: new Date(l.data_abertura!),
                    end: l.data_encerramento ? new Date(l.data_encerramento) : undefined,
                    alarm: 60,
                  })),
                ...docsValidade
                  .filter((d) => d.validade)
                  .map((d): CalendarEvent => ({
                    uid: d.id,
                    title: `⚠ Vencimento: ${d.nome}`,
                    description: `Documento com vencimento em ${format(diaDaValidade(d.validade), 'dd/MM/yyyy')}. Origem: ${d.origem}`,
                    start: diaDaValidade(d.validade),
                    alarm: 1440,
                    allDay: true,
                  })),
              ]}
            />
          </div>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            locale={ptBR}
            modifiers={modifiers}
            modifiersClassNames={modifiersClassNames}
            classNames={calendarioFluido}
            className="w-full rounded-md border border-border pointer-events-auto"
          />
          <div className="flex flex-wrap gap-3 mt-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="w-3 h-3 rounded-full bg-primary-tint border border-primary" /> Licitação
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="w-3 h-3 rounded-full border-2 border-warning" /> Documento
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="w-3 h-3 rounded-full bg-destructive-tint border border-destructive-line" /> Urgente
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="w-3 h-3 rounded-full border-2 border-info" /> Backup
            </span>
          </div>
        </Card>

        {/* Events panel */}
        <Card className="order-1 p-6 lg:order-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            {/* Título e abas empilhados: na coluna de 35% a fila de três abas
                não cabe ao lado da data por extenso. */}
            <div className="mb-4 space-y-3">
              <h2 className="text-lg font-semibold">
                {selectedDate
                  ? format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                  : 'Selecione uma data'}
              </h2>
              <TabsList className="w-full justify-start overflow-x-auto">
                <TabsTrigger value="todos">Dia</TabsTrigger>
                <TabsTrigger value="proximos">Próximos 30d</TabsTrigger>
                <TabsTrigger value="documentos">Documentos</TabsTrigger>
              </TabsList>
            </div>

            {/* Tab: selected day */}
            <TabsContent value="todos" className="mt-0">
              {selectedEvents.licitacoes.length === 0 && selectedEvents.docs.length === 0 && !selectedEvents.backups ? (
                <EstadoVazio
                  tamanho="compacto"
                  icone={<CalendarDays />}
                  titulo="Nenhum evento nesta data"
                  descricao="Escolha outro dia no calendário ao lado para ver sessões, entregas e vencimentos."
                />
              ) : (
                <div className="space-y-2 h-[min(52vh,520px)] overflow-y-auto overscroll-contain pr-2">
                  {selectedEvents.licitacoes.map((l) => (
                    /* Levava a `/kanban` — destino fixo que abria o quadro
                       inteiro e deixava a pessoa procurar de novo o processo
                       que ela acabou de clicar. O `id` já vem na consulta. */
                    <button
                      key={l.id}
                      type="button"
                      className="group flex w-full flex-col gap-2 p-3 text-left rounded-lg border border-border bg-card hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      onClick={() => irParaProcesso(l.id)}
                    >
                      <span className="flex items-start gap-2 min-w-0">
                        <span
                          aria-hidden="true"
                          className={cn(
                            'w-2 h-2 rounded-full mt-1.5 flex-shrink-0',
                            statusColors[l.status] || 'bg-muted-foreground'
                          )}
                        />
                        <span className="min-w-0 flex-1 block">
                          <span className="block text-sm font-medium truncate group-hover:underline">{l.numero}</span>
                          <span className="block text-sm text-muted-foreground truncate">{l.orgao}</span>
                          <span className="block text-sm text-muted-foreground truncate">{l.objeto}</span>
                        </span>
                        <ChevronRight className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
                      </span>
                      {/* Selo e valor descem para a segunda linha: na coluna
                          estreita eles disputavam espaço com o objeto e as duas
                          coisas ficavam truncadas. */}
                      <span className="flex flex-wrap items-center gap-2 pl-4">
                        <span className={badgeVariants({ variant: 'muted' })}>{l.status}</span>
                        {l.valor_estimado && (
                          <span className="text-sm font-medium tabular-nums text-foreground">
                            {formatCurrency(l.valor_estimado)}
                          </span>
                        )}
                      </span>
                    </button>
                  ))}
                  {selectedEvents.docs.map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => irParaOrigemDoDoc(doc)}
                      title={ROTULO_DA_ORIGEM[doc.origem]}
                      className={cn(
                        'group flex w-full flex-wrap items-center justify-between gap-2 p-3 text-left rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                        PELE_DA_SITUACAO[doc.situacao].caixa
                      )}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        {origemIcon(doc.origem)}
                        <span className="min-w-0 block">
                          <span className="block text-sm font-medium truncate group-hover:underline">{doc.nome}</span>
                          <span className={cn('block text-sm', PELE_DA_SITUACAO[doc.situacao].tinta)}>
                            {frasePrazo(doc.validade)} · {format(diaDaValidade(doc.validade), 'dd/MM/yyyy')}
                          </span>
                        </span>
                      </span>
                      <span className="flex items-center gap-2 flex-shrink-0">
                        <span className={badgeVariants({ variant: PELE_DA_SITUACAO[doc.situacao].selo })}>
                          {ROTULO_DA_SITUACAO[doc.situacao]}
                        </span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                      </span>
                    </button>
                  ))}
                  {selectedEvents.backups && (
                    <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border border-border bg-card">
                      <div className="flex items-center gap-2 min-w-0">
                        <Database className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium">Backup programado</p>
                          <p className="text-sm text-muted-foreground">
                            Backup automático agendado para esta data
                          </p>
                        </div>
                      </div>
                      <Badge variant="info">Agendado</Badge>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* Tab: upcoming 30 days */}
            <TabsContent value="proximos" className="mt-0">
              {upcoming.length === 0 ? (
                <EstadoVazio
                  tamanho="compacto"
                  icone={<CheckCircle2 />}
                  titulo="Nenhuma licitação nos próximos 30 dias"
                  descricao="Nada com data de abertura marcada para o próximo mês."
                />
              ) : (
                <div className="space-y-2 h-[min(52vh,520px)] overflow-y-auto overscroll-contain pr-2">
                  {upcoming.map((l) => {
                    const d = new Date(l.data_abertura!);
                    const diffDias = Math.ceil((d.getTime() - hoje.getTime()) / 86400000);
                    const isUrgent = diffDias <= 3;
                    return (
                      <button
                        key={l.id}
                        type="button"
                        className={cn(
                          'group flex w-full flex-col gap-2 p-3 text-left rounded-lg border transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                          isUrgent ? 'border-destructive-line bg-destructive-tint' : 'border-border bg-card'
                        )}
                        onClick={() => irParaProcesso(l.id)}
                      >
                        <span className="flex items-start gap-3 min-w-0">
                          <span className="text-center flex-shrink-0 w-12 block">
                            <span className="block text-lg font-bold tabular-nums leading-6">{format(d, 'dd')}</span>
                            <span className="block text-xs uppercase text-muted-foreground">
                              {format(d, 'MMM', { locale: ptBR })}
                            </span>
                          </span>
                          <span className="min-w-0 flex-1 block">
                            <span className="block text-sm font-medium truncate group-hover:underline">
                              {l.numero} — {l.orgao}
                            </span>
                            <span className="block text-sm text-muted-foreground truncate">{l.objeto}</span>
                          </span>
                          <ChevronRight className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
                        </span>
                        <span className="flex flex-wrap items-center gap-2 pl-[3.75rem]">
                          {isUrgent && (
                            <span className={badgeVariants({ variant: 'danger' })}>
                              {diffDias === 0 ? 'Hoje' : `Em ${diffDias}d`}
                            </span>
                          )}
                          <span className={badgeVariants({ variant: 'muted' })}>{l.modalidade}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* Tab: documents */}
            <TabsContent value="documentos" className="mt-0">
              {docsOrdenados.length === 0 ? (
                <EstadoVazio
                  tamanho="compacto"
                  icone={<FileText />}
                  titulo="Nenhum documento com data de validade cadastrada"
                  descricao="Cadastre a validade nos documentos de habilitação ou nos certificados digitais."
                />
              ) : (
                <div className="space-y-2 h-[min(52vh,520px)] overflow-y-auto overscroll-contain pr-2">
                  {docsOrdenados.map((doc) => {
                    const val = diaDaValidade(doc.validade);
                    return (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => irParaOrigemDoDoc(doc)}
                        title={ROTULO_DA_ORIGEM[doc.origem]}
                        className={cn(
                          'group flex w-full flex-wrap items-center justify-between gap-2 p-3 text-left rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                          PELE_DA_SITUACAO[doc.situacao].caixa
                        )}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          {origemIcon(doc.origem)}
                          <span className="min-w-0 block">
                            <span className="block text-sm font-medium truncate group-hover:underline">{doc.nome}</span>
                            <span className="block text-sm text-muted-foreground">
                              Validade: {format(val, 'dd/MM/yyyy')}
                              {doc.situacao !== 'ok' && ` (${frasePrazo(doc.validade).toLowerCase()})`}
                            </span>
                          </span>
                        </span>
                        <span className="flex items-center gap-2 flex-shrink-0">
                          <span
                            className={badgeVariants({
                              variant: PELE_DA_SITUACAO[doc.situacao].selo,
                            })}
                          >
                            {ROTULO_DA_SITUACAO[doc.situacao]}
                          </span>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </Card>
      </div>

      {/* REBRAND — anatomia `kpi-meta`, a mesma dos Contratos e dos
          Compromissos: rótulo e ícone em cima, valor grande à esquerda, nota
          de contexto embaixo. Antes eram cinco números centralizados com o
          rótulo em CAIXA ALTA — caixa alta em rótulo de 12px é o que mais
          atrasa a leitura, porque tira a silhueta da palavra.

          ⚠ CORREÇÃO DE DADO, não de aparência. A contagem de "Ganhas" comparava
          `status` com dois literais escritos aqui:

              l.status === 'Vencida' || l.status === 'Homologada'

          É o padrão que o CLAUDE.md proíbe no princípio 1 — e pelo mesmo motivo
          histórico (`Homologada` × `Homologado`). A lista perdia processo
          gravado como `Homologado`, `adjudicada`, `vencedor`, `ata_registro` ou
          `contrato assinado`: o número aparecia MENOR do que a realidade, num
          cartão que a pessoa usa para conferir resultado.
          Agora passa por `normalizarStatus`, que é a autoridade. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {(() => {
          const ganhas = licitacoes.filter((l) => {
            const s = normalizarStatus(l.status);
            return s === 'Vencida' || s === 'Homologada';
          }).length;
          const vencidos = docsVencidos.length;

          const cartoes = [
            { rot: 'Total de processos', val: licitacoes.length, ic: CalendarDays, nota: 'Com data no calendário' },
            { rot: 'Encerra em 3 dias', val: urgentes.length, ic: AlertTriangle, nota: urgentes.length > 0 ? 'Exige decisão hoje' : 'Nenhum prazo apertado', alerta: urgentes.length > 0 },
            { rot: 'Próximos 30 dias', val: upcoming.length, ic: Clock, nota: 'Abertura ou encerramento' },
            { rot: 'Ganhas', val: ganhas, ic: Trophy, nota: 'Vencidas e homologadas', bom: ganhas > 0 },
            { rot: 'Documentos em alerta', val: docsAlerta.length, ic: FileWarning, nota: vencidos > 0 ? `${vencidos} já ${vencidos === 1 ? 'vencido' : 'vencidos'}` : 'Nenhum vencido', alerta: vencidos > 0 },
          ];

          return cartoes.map(({ rot, val, ic: Icone, nota, alerta, bom }) => (
            <Card key={rot} className={cn('p-4 min-w-0', alerta && 'border-warning-line bg-warning-tint')}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className={cn('text-sm', alerta ? 'text-warning-ink' : 'text-muted-foreground')}>{rot}</span>
                <Icone className={cn('w-4 h-4 shrink-0', alerta ? 'text-warning-ink' : 'text-muted-foreground')} aria-hidden="true" />
              </div>
              <p className={cn(
                'text-[2rem] leading-10 font-bold tabular-nums',
                alerta && 'text-warning-ink',
                bom && 'text-success',
              )}>
                {val}
              </p>
              <p className={cn('text-xs mt-1', alerta ? 'text-warning-ink' : 'text-muted-foreground')}>{nota}</p>
            </Card>
          ));
        })()}
      </div>
    </div>
  );
}
