import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import EstadoVazio from '@/components/shared/EstadoVazio';
import {
  CalendarDays, FileText, AlertTriangle, Clock, CheckCircle2,
  ChevronRight, Shield, Building2, Database, Trophy, FileWarning,
} from 'lucide-react';
import { cn } from '@/lib/utils';
// Autoridade única do vocabulário de status (CLAUDE.md, princípio 1).
import { normalizarStatus } from '@/lib/licitacao/status';
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

interface DocValidade {
  id: string;
  nome: string;
  validade: string;
  tipo: string;
  origem: 'documento' | 'certificado_empresa' | 'certificado_portal';
  status: 'ok' | 'vencendo' | 'vencido';
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

function calcDocStatus(validade: string): 'ok' | 'vencendo' | 'vencido' {
  const hoje = new Date();
  const val = new Date(validade);
  if (val < hoje) return 'vencido';
  const diff = Math.ceil((val.getTime() - hoje.getTime()) / 86400000);
  return diff <= 30 ? 'vencendo' : 'ok';
}

export default function CalendarioLicitacoes() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [activeTab, setActiveTab] = useState('todos');
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const navigate = useNavigate();
  const hoje = new Date();

  // Fetch licitações
  const { data: licitacoes = [] } = useQuery({
    queryKey: ['calendario-licitacoes', user?.id, empresaAtiva?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('licitacoes')
        .select('id, numero, objeto, orgao, status, data_abertura, data_encerramento, modalidade, valor_estimado')
        .order('data_abertura', { ascending: true });
      // Agenda da empresa, como o painel que a exibe (RLS limita ao permitido)
      return (data || []) as LicitacaoEvento[];
    },
    enabled: !!user,
  });

  // Fetch document expiry dates
  const { data: docsValidade = [] } = useQuery({
    queryKey: ['calendario-docs-validade', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const docs: DocValidade[] = [];

      // 1) Documentos with validade
      const { data: documentos } = await supabase
        .from('documentos')
        .select('id, nome, tipo, validade')
        .eq('user_id', user.id)
        .not('validade', 'is', null);
      (documentos || []).forEach((d: any) => {
        if (d.validade) {
          docs.push({
            id: d.id,
            nome: d.nome,
            validade: d.validade,
            tipo: d.tipo,
            origem: 'documento',
            status: calcDocStatus(d.validade),
          });
        }
      });

      // 2) Empresa certificates
      const { data: empresas } = await supabase
        .from('empresas')
        .select('id, razao_social, certificado_validade')
        .eq('created_by', user.id)
        .not('certificado_validade', 'is', null);
      (empresas || []).forEach((e: any) => {
        if (e.certificado_validade) {
          docs.push({
            id: `cert-emp-${e.id}`,
            nome: `Certificado Digital — ${e.razao_social}`,
            validade: e.certificado_validade,
            tipo: 'certificado',
            origem: 'certificado_empresa',
            status: calcDocStatus(e.certificado_validade),
          });
        }
      });

      // 3) Portal credentials certificates
      const { data: creds } = await supabase
        .from('credenciais_portais_safe' as any)
        .select('id, portal_nome, validade_certificado')
        .eq('user_id', user.id)
        .not('validade_certificado', 'is', null);
      (creds || []).forEach((c: any) => {
        if (c.validade_certificado) {
          docs.push({
            id: `cert-portal-${c.id}`,
            nome: `Certificado ${c.portal_nome}`,
            validade: c.validade_certificado,
            tipo: 'certificado_portal',
            origem: 'certificado_portal',
            status: calcDocStatus(c.validade_certificado),
          });
        }
      });

      return docs;
    },
    enabled: !!user,
  });

  // Fetch backup config for calendar integration
  const { data: backupConfig } = useQuery({
    queryKey: ['calendario-backup-config', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('backup_config' as any)
        .select('*')
        .eq('user_id', user.id)
        .eq('ativo', true)
        .eq('alerta_calendario', true)
        .maybeSingle();
      return data as any;
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
      const key = format(new Date(doc.validade), 'yyyy-MM-dd');
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

  // Docs vencendo/vencidos
  const docsAlerta = useMemo(
    () => docsValidade.filter((d) => d.status === 'vencendo' || d.status === 'vencido')
      .sort((a, b) => new Date(a.validade).getTime() - new Date(b.validade).getTime()),
    [docsValidade]
  );

  // As duas metades do alerta, cada uma em seu Alert — a mesma filtragem que
  // antes era repetida cinco vezes dentro do JSX.
  const docsVencidos = useMemo(() => docsAlerta.filter((d) => d.status === 'vencido'), [docsAlerta]);
  const docsVencendo = useMemo(() => docsAlerta.filter((d) => d.status === 'vencendo'), [docsAlerta]);

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
        val.docs.some((doc) => doc.status === 'vencido')
      )
        urgentDates.push(d);
    });

    return { licitacao: licitDates, documento: docDates, urgente: urgentDates, backup: bkpDates };
  }, [eventDates]);

  /* Marcação do dia por classe, não por `style` com `hsl(...)` escrito à mão:
     cor dentro do .tsx é o que a identidade 12/09 proíbe, e a tinta do token
     acompanha o tema sozinha. `modifiersClassNames` é a API equivalente do
     react-day-picker — mesmos quatro modificadores, mesma leitura. */
  const modifiersClassNames = {
    licitacao: 'bg-primary-tint text-primary font-semibold rounded-full',
    documento: 'border-2 border-warning rounded-full',
    urgente: 'bg-destructive-tint text-destructive-ink font-semibold rounded-full',
    backup: 'border-2 border-info rounded-full',
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const origemIcon = (origem: DocValidade['origem']) => {
    if (origem === 'certificado_empresa') return <Building2 className="w-4 h-4 text-warning" />;
    if (origem === 'certificado_portal') return <Shield className="w-4 h-4 text-warning" />;
    return <FileText className="w-4 h-4 text-warning" />;
  };

  return (
    <div className="space-y-4">
      {/* Alertas urgentes — Alert de ui em tinta (`destructive`/`warning`), no
          lugar das caixas com alfa composto na mão (`bg-destructive/10`). */}
      {(urgentes.length > 0 || docsVencidos.length > 0) && (
        <Alert variant="destructive">
          <AlertTriangle className="w-5 h-5" aria-hidden="true" />
          <AlertTitle>Exige atenção agora</AlertTitle>
          <AlertDescription className="space-y-3">
            {urgentes.length > 0 && (
              <div>
                <p className="font-semibold">
                  {urgentes.length} licitaç{urgentes.length > 1 ? 'ões' : 'ão'} nos próximos 3 dias
                </p>
                <ul className="mt-1 space-y-1">
                  {urgentes.map((l) => (
                    <li key={l.id}>
                      • {l.numero} — {l.orgao} —{' '}
                      {l.data_abertura &&
                        format(new Date(l.data_abertura), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
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
                      • {d.nome} — venceu em {format(new Date(d.validade), 'dd/MM/yyyy')}
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
                const diff = Math.ceil(
                  (new Date(d.validade).getTime() - hoje.getTime()) / 86400000
                );
                return (
                  <li key={d.id}>
                    • {d.nome} — vence em <strong>{diff} dia{diff > 1 ? 's' : ''}</strong> (
                    {format(new Date(d.validade), 'dd/MM/yyyy')})
                  </li>
                );
              })}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Calendar */}
        <Card className="lg:col-span-1 p-6">
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
                    description: `Documento com vencimento em ${format(new Date(d.validade), 'dd/MM/yyyy')}. Origem: ${d.origem}`,
                    start: new Date(d.validade),
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
            className="rounded-md border border-border pointer-events-auto"
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
        <Card className="lg:col-span-2 p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="text-lg font-semibold">
                {selectedDate
                  ? format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                  : 'Selecione uma data'}
              </h2>
              <TabsList>
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
                    <button
                      key={l.id}
                      type="button"
                      className="flex w-full items-center justify-between gap-3 p-3 text-left rounded-lg border border-border bg-card hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      onClick={() => navigate('/kanban')}
                    >
                      <span className="flex items-start gap-3 min-w-0">
                        <span
                          aria-hidden="true"
                          className={cn(
                            'w-2 h-2 rounded-full mt-1.5 flex-shrink-0',
                            statusColors[l.status] || 'bg-muted-foreground'
                          )}
                        />
                        <span className="min-w-0 block">
                          <span className="block text-sm font-medium truncate">{l.numero}</span>
                          <span className="block text-sm text-muted-foreground truncate">{l.orgao}</span>
                          <span className="block text-sm text-muted-foreground truncate">{l.objeto}</span>
                        </span>
                      </span>
                      <span className="flex items-center gap-2 flex-shrink-0">
                        <Badge variant="muted">{l.status}</Badge>
                        {l.valor_estimado && (
                          <span className="text-sm font-medium tabular-nums text-foreground">
                            {formatCurrency(l.valor_estimado)}
                          </span>
                        )}
                        <ChevronRight className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                      </span>
                    </button>
                  ))}
                  {selectedEvents.docs.map((doc) => (
                    <div
                      key={doc.id}
                      className={cn(
                        'flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border',
                        doc.status === 'vencido'
                          ? 'border-destructive-line bg-destructive-tint'
                          : 'border-warning-line bg-warning-tint'
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {origemIcon(doc.origem)}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{doc.nome}</p>
                          <p
                            className={cn(
                              'text-sm',
                              doc.status === 'vencido' ? 'text-destructive-ink' : 'text-warning-ink'
                            )}
                          >
                            {doc.status === 'vencido' ? 'Vencido' : 'Vence'} em{' '}
                            {format(new Date(doc.validade), 'dd/MM/yyyy')}
                          </p>
                        </div>
                      </div>
                      <Badge variant={doc.status === 'vencido' ? 'danger' : 'warning'}>
                        {doc.status === 'vencido' ? 'Vencido' : 'Vencendo'}
                      </Badge>
                    </div>
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
                          'flex w-full items-center justify-between gap-3 p-3 text-left rounded-lg border transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                          isUrgent ? 'border-destructive-line bg-destructive-tint' : 'border-border bg-card'
                        )}
                        onClick={() => navigate('/kanban')}
                      >
                        <span className="flex items-start gap-3 min-w-0">
                          <span className="text-center flex-shrink-0 w-12 block">
                            <span className="block text-lg font-bold tabular-nums leading-6">{format(d, 'dd')}</span>
                            <span className="block text-xs uppercase text-muted-foreground">
                              {format(d, 'MMM', { locale: ptBR })}
                            </span>
                          </span>
                          <span className="min-w-0 block">
                            <span className="block text-sm font-medium truncate">
                              {l.numero} — {l.orgao}
                            </span>
                            <span className="block text-sm text-muted-foreground truncate">{l.objeto}</span>
                          </span>
                        </span>
                        <span className="flex flex-wrap items-center justify-end gap-2 flex-shrink-0">
                          {isUrgent && (
                            <Badge variant="danger">
                              {diffDias === 0 ? 'Hoje' : `Em ${diffDias}d`}
                            </Badge>
                          )}
                          <Badge variant="muted">{l.modalidade}</Badge>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* Tab: documents */}
            <TabsContent value="documentos" className="mt-0">
              {docsValidade.length === 0 ? (
                <EstadoVazio
                  tamanho="compacto"
                  icone={<FileText />}
                  titulo="Nenhum documento com data de validade cadastrada"
                  descricao="Cadastre a validade nos documentos de habilitação ou nos certificados digitais."
                />
              ) : (
                <div className="space-y-2 h-[min(52vh,520px)] overflow-y-auto overscroll-contain pr-2">
                  {docsValidade
                    .sort((a, b) => {
                      const order = { vencido: 0, vencendo: 1, ok: 2 };
                      return order[a.status] - order[b.status] || new Date(a.validade).getTime() - new Date(b.validade).getTime();
                    })
                    .map((doc) => {
                      const val = new Date(doc.validade);
                      const diff = Math.ceil((val.getTime() - hoje.getTime()) / 86400000);
                      return (
                        <div
                          key={doc.id}
                          className={cn(
                            'flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border',
                            doc.status === 'vencido'
                              ? 'border-destructive-line bg-destructive-tint'
                              : doc.status === 'vencendo'
                              ? 'border-warning-line bg-warning-tint'
                              : 'border-border bg-card'
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {origemIcon(doc.origem)}
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{doc.nome}</p>
                              <p className="text-sm text-muted-foreground">
                                Validade: {format(val, 'dd/MM/yyyy')}
                                {doc.status === 'vencido'
                                  ? ` (vencido há ${Math.abs(diff)} dia${Math.abs(diff) > 1 ? 's' : ''})`
                                  : doc.status === 'vencendo'
                                  ? ` (${diff} dia${diff > 1 ? 's' : ''} restante${diff > 1 ? 's' : ''})`
                                  : ''}
                              </p>
                            </div>
                          </div>
                          <Badge
                            variant={
                              doc.status === 'vencido'
                                ? 'danger'
                                : doc.status === 'vencendo'
                                ? 'warning'
                                : 'success'
                            }
                            className="flex-shrink-0"
                          >
                            {doc.status === 'vencido'
                              ? 'Vencido'
                              : doc.status === 'vencendo'
                              ? 'Vencendo'
                              : 'Regular'}
                          </Badge>
                        </div>
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
