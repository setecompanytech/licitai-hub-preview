import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CalendarDays, FileText, AlertTriangle, Clock, CheckCircle2,
  ChevronRight, Filter, Eye
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { format, isSameDay, isWithinInterval, addDays, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
  status: 'ok' | 'vencendo' | 'vencido';
  storagePath?: string;
}

const statusColors: Record<string, string> = {
  'Publicado': 'bg-blue-500',
  'Em Análise': 'bg-yellow-500',
  'Proposta Enviada': 'bg-purple-500',
  'Em Disputa': 'bg-orange-500',
  'Vencida': 'bg-green-500',
  'Perdida': 'bg-red-500',
  'Homologada': 'bg-emerald-600',
  'Suspensa': 'bg-gray-500',
};

export default function CalendarioLicitacoes() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [activeTab, setActiveTab] = useState('todos');
  const { user } = useAuth();
  const navigate = useNavigate();

  // Fetch licitações
  const { data: licitacoes = [] } = useQuery({
    queryKey: ['calendario-licitacoes', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('licitacoes')
        .select('id, numero, objeto, orgao, status, data_abertura, data_encerramento, modalidade, valor_estimado')
        .eq('user_id', user.id)
        .order('data_abertura', { ascending: true });
      if (error) throw error;
      return (data || []) as LicitacaoEvento[];
    },
    enabled: !!user,
  });

  // Fetch document validity from documentos-habilitacao metadata
  const { data: docsValidade = [] } = useQuery({
    queryKey: ['calendario-docs-validade', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('documentos')
        .select('id, nome, descricao, tipo')
        .eq('user_id', user.id);
      // We'll derive expiry from the documentos table if available
      return [] as DocValidade[];
    },
    enabled: !!user,
  });

  const hoje = new Date();

  // Build calendar markers
  const eventDates = useMemo(() => {
    const map = new Map<string, { licitacoes: LicitacaoEvento[]; docs: DocValidade[] }>();

    licitacoes.forEach(l => {
      [l.data_abertura, l.data_encerramento].forEach(d => {
        if (!d) return;
        const key = format(new Date(d), 'yyyy-MM-dd');
        if (!map.has(key)) map.set(key, { licitacoes: [], docs: [] });
        const entry = map.get(key)!;
        if (!entry.licitacoes.find(x => x.id === l.id)) entry.licitacoes.push(l);
      });
    });

    docsValidade.forEach(doc => {
      const key = doc.validade;
      if (!map.has(key)) map.set(key, { licitacoes: [], docs: [] });
      map.get(key)!.docs.push(doc);
    });

    return map;
  }, [licitacoes, docsValidade]);

  // Events for selected date
  const selectedEvents = useMemo(() => {
    if (!selectedDate) return { licitacoes: [], docs: [] };
    const key = format(selectedDate, 'yyyy-MM-dd');
    return eventDates.get(key) || { licitacoes: [], docs: [] };
  }, [selectedDate, eventDates]);

  // Upcoming events (next 30 days)
  const upcoming = useMemo(() => {
    const end = addDays(hoje, 30);
    return licitacoes
      .filter(l => {
        const d = l.data_abertura ? new Date(l.data_abertura) : null;
        return d && isWithinInterval(d, { start: hoje, end });
      })
      .sort((a, b) => new Date(a.data_abertura!).getTime() - new Date(b.data_abertura!).getTime());
  }, [licitacoes]);

  // Urgentes (próximos 3 dias)
  const urgentes = useMemo(() => {
    const limit = addDays(hoje, 3);
    return licitacoes.filter(l => {
      const d = l.data_abertura ? new Date(l.data_abertura) : null;
      return d && isWithinInterval(d, { start: hoje, end: limit });
    });
  }, [licitacoes]);

  // Calendar modifiers for highlighting dates
  const modifiers = useMemo(() => {
    const licitDates: Date[] = [];
    const docDates: Date[] = [];
    const urgentDates: Date[] = [];

    eventDates.forEach((val, key) => {
      const d = new Date(key + 'T12:00:00');
      if (val.licitacoes.length > 0) licitDates.push(d);
      if (val.docs.length > 0) docDates.push(d);
      if (val.licitacoes.some(l => {
        const dt = l.data_abertura ? new Date(l.data_abertura) : null;
        return dt && isWithinInterval(dt, { start: hoje, end: addDays(hoje, 3) });
      })) urgentDates.push(d);
    });

    return { licitacao: licitDates, documento: docDates, urgente: urgentDates };
  }, [eventDates]);

  const modifiersStyles = {
    licitacao: { backgroundColor: 'hsl(var(--accent) / 0.2)', borderRadius: '50%' },
    documento: { border: '2px solid hsl(var(--warning))', borderRadius: '50%' },
    urgente: { backgroundColor: 'hsl(var(--destructive) / 0.2)', borderRadius: '50%' },
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <div className="space-y-4">
      {/* Alertas urgentes */}
      {urgentes.length > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm animate-fade-in">
          <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-destructive">
              {urgentes.length} licitaç{urgentes.length > 1 ? 'ões' : 'ão'} nos próximos 3 dias
            </p>
            <ul className="mt-1 space-y-0.5">
              {urgentes.map(l => (
                <li key={l.id} className="text-xs text-destructive/80">
                  • {l.numero} — {l.orgao} — {l.data_abertura && format(new Date(l.data_abertura), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Calendar */}
        <Card className="lg:col-span-1 p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-accent" />
            Calendário
          </h3>
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
                <TabsTrigger value="todos" className="text-xs px-2 h-6">Todos</TabsTrigger>
                <TabsTrigger value="proximos" className="text-xs px-2 h-6">Próximos 30d</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="todos" className="mt-0">
              {selectedEvents.licitacoes.length === 0 && selectedEvents.docs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <CalendarDays className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  Nenhum evento nesta data
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {selectedEvents.licitacoes.map(l => (
                    <div
                      key={l.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => navigate('/licitacoes-estrategicas')}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={cn('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', statusColors[l.status] || 'bg-gray-400')} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{l.numero}</p>
                          <p className="text-xs text-muted-foreground truncate">{l.orgao}</p>
                          <p className="text-xs text-muted-foreground/70 truncate">{l.objeto}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <Badge variant="outline" className="text-[10px]">{l.status}</Badge>
                        {l.valor_estimado && (
                          <span className="text-xs font-medium text-accent">{formatCurrency(l.valor_estimado)}</span>
                        )}
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                  {selectedEvents.docs.map(doc => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-warning/30 bg-warning/5"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-warning" />
                        <div>
                          <p className="text-sm font-medium">{doc.nome}</p>
                          <p className="text-xs text-warning">Vence em {format(new Date(doc.validade), 'dd/MM/yyyy')}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className={cn('text-[10px]', doc.status === 'vencido' ? 'text-destructive' : 'text-warning')}>
                        {doc.status === 'vencido' ? 'Vencido' : 'Vencendo'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="proximos" className="mt-0">
              {upcoming.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  Nenhuma licitação nos próximos 30 dias
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {upcoming.map(l => {
                    const d = new Date(l.data_abertura!);
                    const diffDias = Math.ceil((d.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
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
                            <p className="text-[10px] uppercase text-muted-foreground">{format(d, 'MMM', { locale: ptBR })}</p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{l.numero} — {l.orgao}</p>
                            <p className="text-xs text-muted-foreground truncate">{l.objeto}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {isUrgent && (
                            <Badge variant="destructive" className="text-[10px]">
                              {diffDias === 0 ? 'Hoje' : `${diffDias}d`}
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-[10px]">{l.modalidade}</Badge>
                        </div>
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
          <p className="text-2xl font-bold text-green-500">
            {licitacoes.filter(l => l.status === 'Vencida' || l.status === 'Homologada').length}
          </p>
          <p className="text-[10px] text-muted-foreground uppercase">Ganhas</p>
        </Card>
      </div>
    </div>
  );
}
