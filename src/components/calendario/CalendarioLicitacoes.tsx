import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CalendarDays, FileText, AlertTriangle, Clock, CheckCircle2,
  ChevronRight, Shield, Building2, Database,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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

const statusColors: Record<string, string> = {
  Publicado: 'bg-info',
  Monitorando: 'bg-info',
  'Em Análise': 'bg-warning',
  'Proposta Enviada': 'bg-primary',
  'Em Disputa': 'bg-accent',
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
  const navigate = useNavigate();
  const hoje = new Date();

  // Fetch licitações
  const { data: licitacoes = [] } = useQuery({
    queryKey: ['calendario-licitacoes', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('licitacoes')
        .select('id, numero, objeto, orgao, status, data_abertura, data_encerramento, modalidade, valor_estimado')
        .eq('user_id', user.id)
        .order('data_abertura', { ascending: true });
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
        .from('credenciais_portais')
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
      let cur = new Date(start);
      cur.setHours(h, m, 0, 0);
      if (cur <= start) cur.setDate(cur.getDate() + 1);
      while (cur <= end) {
        dates.push(new Date(cur));
        cur.setDate(cur.getDate() + 1);
      }
    } else if (freq === 'semanal') {
      const targetDay = backupConfig.dia_semana ?? 1;
      let cur = new Date(start);
      const daysAhead = ((targetDay - cur.getDay()) + 7) % 7 || 7;
      cur.setDate(cur.getDate() + daysAhead);
      cur.setHours(h, m, 0, 0);
      while (cur <= end) {
        dates.push(new Date(cur));
        cur.setDate(cur.getDate() + 7);
      }
    } else if (freq === 'mensal') {
      const targetDia = backupConfig.dia_mes ?? 1;
      let cur = new Date(start);
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

  const modifiersStyles = {
    licitacao: { backgroundColor: 'hsl(var(--accent) / 0.2)', borderRadius: '50%' },
    documento: { border: '2px solid hsl(var(--warning))', borderRadius: '50%' },
    urgente: { backgroundColor: 'hsl(var(--destructive) / 0.2)', borderRadius: '50%' },
    backup: { border: '2px solid hsl(var(--info))', borderRadius: '50%' },
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
      {/* Alertas urgentes */}
      {(urgentes.length > 0 || docsAlerta.filter((d) => d.status === 'vencido').length > 0) && (
        <div className="flex items-start gap-3 px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm animate-fade-in">
          <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <div>
            {urgentes.length > 0 && (
              <>
                <p className="font-semibold text-destructive">
                  {urgentes.length} licitaç{urgentes.length > 1 ? 'ões' : 'ão'} nos próximos 3 dias
                </p>
                <ul className="mt-1 space-y-0.5">
                  {urgentes.map((l) => (
                    <li key={l.id} className="text-xs text-destructive/80">
                      • {l.numero} — {l.orgao} —{' '}
                      {l.data_abertura &&
                        format(new Date(l.data_abertura), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {docsAlerta.filter((d) => d.status === 'vencido').length > 0 && (
              <>
                <p className="font-semibold text-destructive mt-2">
                  {docsAlerta.filter((d) => d.status === 'vencido').length} documento(s) vencido(s)
                </p>
                <ul className="mt-1 space-y-0.5">
                  {docsAlerta
                    .filter((d) => d.status === 'vencido')
                    .map((d) => (
                      <li key={d.id} className="text-xs text-destructive/80">
                        • {d.nome} — venceu em {format(new Date(d.validade), 'dd/MM/yyyy')}
                      </li>
                    ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}

      {/* Warning: docs vencendo */}
      {docsAlerta.filter((d) => d.status === 'vencendo').length > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 bg-warning/10 border border-warning/20 rounded-lg text-sm animate-fade-in">
          <Clock className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-warning">
              {docsAlerta.filter((d) => d.status === 'vencendo').length} documento(s) próximo(s) do
              vencimento
            </p>
            <ul className="mt-1 space-y-0.5">
              {docsAlerta
                .filter((d) => d.status === 'vencendo')
                .map((d) => {
                  const diff = Math.ceil(
                    (new Date(d.validade).getTime() - hoje.getTime()) / 86400000
                  );
                  return (
                    <li key={d.id} className="text-xs text-warning/80">
                      • {d.nome} — vence em <strong>{diff} dia{diff > 1 ? 's' : ''}</strong> (
                      {format(new Date(d.validade), 'dd/MM/yyyy')})
                    </li>
                  );
                })}
            </ul>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Calendar */}
        <Card className="lg:col-span-1 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-accent" />
              Calendário
            </h3>
            <SyncCalendarButton
              events={licitacoes
                .filter((l) => l.data_abertura)
                .map((l): CalendarEvent => ({
                  uid: l.id,
                  title: `[${l.modalidade}] ${l.numero} — ${l.orgao}`,
                  description: l.objeto,
                  start: new Date(l.data_abertura!),
                  end: l.data_encerramento ? new Date(l.data_encerramento) : undefined,
                  alarm: 60,
                }))}
            />
          </div>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            locale={ptBR}
            modifiers={modifiers}
            modifiersStyles={modifiersStyles}
            className="rounded-md border pointer-events-auto"
          />
          <div className="flex flex-wrap gap-3 mt-3 text-[10px]">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-accent/20 border border-accent/40" /> Licitação
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full border-2 border-warning" /> Documento
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-destructive/20" /> Urgente
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full border-2 border-info" /> Backup
            </span>
          </div>
        </Card>

        {/* Events panel */}
        <Card className="lg:col-span-2 p-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                {selectedDate
                  ? format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                  : 'Selecione uma data'}
              </h3>
              <TabsList className="h-8">
                <TabsTrigger value="todos" className="text-xs px-2 h-6">
                  Dia
                </TabsTrigger>
                <TabsTrigger value="proximos" className="text-xs px-2 h-6">
                  Próximos 30d
                </TabsTrigger>
                <TabsTrigger value="documentos" className="text-xs px-2 h-6">
                  Documentos
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Tab: selected day */}
            <TabsContent value="todos" className="mt-0">
              {selectedEvents.licitacoes.length === 0 && selectedEvents.docs.length === 0 && !selectedEvents.backups ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <CalendarDays className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  Nenhum evento nesta data
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {selectedEvents.licitacoes.map((l) => (
                    <div
                      key={l.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => navigate('/kanban')}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className={cn(
                            'w-2 h-2 rounded-full mt-1.5 flex-shrink-0',
                            statusColors[l.status] || 'bg-muted-foreground'
                          )}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{l.numero}</p>
                          <p className="text-xs text-muted-foreground truncate">{l.orgao}</p>
                          <p className="text-xs text-muted-foreground/70 truncate">{l.objeto}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <Badge variant="outline" className="text-[10px]">
                          {l.status}
                        </Badge>
                        {l.valor_estimado && (
                          <span className="text-xs font-medium text-accent">
                            {formatCurrency(l.valor_estimado)}
                          </span>
                        )}
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                  {selectedEvents.docs.map((doc) => (
                    <div
                      key={doc.id}
                      className={cn(
                        'flex items-center justify-between p-3 rounded-lg border',
                        doc.status === 'vencido'
                          ? 'border-destructive/30 bg-destructive/5'
                          : 'border-warning/30 bg-warning/5'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {origemIcon(doc.origem)}
                        <div>
                          <p className="text-sm font-medium">{doc.nome}</p>
                          <p
                            className={cn(
                              'text-xs',
                              doc.status === 'vencido' ? 'text-destructive' : 'text-warning'
                            )}
                          >
                            {doc.status === 'vencido' ? 'Vencido' : 'Vence'} em{' '}
                            {format(new Date(doc.validade), 'dd/MM/yyyy')}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px]',
                          doc.status === 'vencido' ? 'text-destructive' : 'text-warning'
                        )}
                      >
                        {doc.status === 'vencido' ? 'Vencido' : 'Vencendo'}
                      </Badge>
                    </div>
                  ))}
                  {selectedEvents.backups && (
                    <div className="flex items-center justify-between p-3 rounded-lg border border-info/30 bg-info/5">
                      <div className="flex items-center gap-2">
                        <Database className="w-4 h-4 text-info" />
                        <div>
                          <p className="text-sm font-medium">Backup programado</p>
                          <p className="text-xs text-muted-foreground">
                            Backup automático agendado para esta data
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] text-info border-info/30">
                        Agendado
                      </Badge>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* Tab: upcoming 30 days */}
            <TabsContent value="proximos" className="mt-0">
              {upcoming.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  Nenhuma licitação nos próximos 30 dias
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {upcoming.map((l) => {
                    const d = new Date(l.data_abertura!);
                    const diffDias = Math.ceil((d.getTime() - hoje.getTime()) / 86400000);
                    const isUrgent = diffDias <= 3;
                    return (
                      <div
                        key={l.id}
                        className={cn(
                          'flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer hover:bg-muted/50',
                          isUrgent ? 'border-destructive/30 bg-destructive/5' : 'border-border/50'
                        )}
                        onClick={() => navigate('/licitacoes-estrategicas')}
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="text-center flex-shrink-0 w-12">
                            <p className="text-lg font-bold leading-none">{format(d, 'dd')}</p>
                            <p className="text-[10px] uppercase text-muted-foreground">
                              {format(d, 'MMM', { locale: ptBR })}
                            </p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {l.numero} — {l.orgao}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">{l.objeto}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {isUrgent && (
                            <Badge variant="destructive" className="text-[10px]">
                              {diffDias === 0 ? 'Hoje' : `${diffDias}d`}
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-[10px]">
                            {l.modalidade}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* Tab: documents */}
            <TabsContent value="documentos" className="mt-0">
              {docsValidade.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>Nenhum documento com data de validade cadastrada</p>
                  <p className="text-xs mt-1">
                    Cadastre a validade nos documentos de habilitação ou nos certificados digitais.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
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
                            'flex items-center justify-between p-3 rounded-lg border',
                            doc.status === 'vencido'
                              ? 'border-destructive/30 bg-destructive/5'
                              : doc.status === 'vencendo'
                              ? 'border-warning/30 bg-warning/5'
                              : 'border-border/50'
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {origemIcon(doc.origem)}
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{doc.nome}</p>
                              <p className="text-xs text-muted-foreground">
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
                            variant="outline"
                            className={cn(
                              'text-[10px] flex-shrink-0',
                              doc.status === 'vencido'
                                ? 'text-destructive border-destructive/30'
                                : doc.status === 'vencendo'
                                ? 'text-warning border-warning/30'
                                : 'text-success border-success/30'
                            )}
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

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-accent">{licitacoes.length}</p>
          <p className="text-[10px] text-muted-foreground uppercase">Total Processos</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-warning">{urgentes.length}</p>
          <p className="text-[10px] text-muted-foreground uppercase">Urgentes (3d)</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{upcoming.length}</p>
          <p className="text-[10px] text-muted-foreground uppercase">Próximos 30d</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-success">
            {licitacoes.filter((l) => l.status === 'Vencida' || l.status === 'Homologada').length}
          </p>
          <p className="text-[10px] text-muted-foreground uppercase">Ganhas</p>
        </Card>
        <Card className="p-3 text-center">
          <p
            className={cn(
              'text-2xl font-bold',
              docsAlerta.filter((d) => d.status === 'vencido').length > 0
                ? 'text-destructive'
                : docsAlerta.length > 0
                ? 'text-warning'
                : 'text-success'
            )}
          >
            {docsAlerta.length}
          </p>
          <p className="text-[10px] text-muted-foreground uppercase">Docs Alerta</p>
        </Card>
      </div>
    </div>
  );
}
