import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Shield, Search, RefreshCw, Loader2, Filter, Download } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/contexts/AuthContext';

type AuditEntry = {
  id: string;
  evento: string;
  user_id: string;
  created_at: string;
  detalhes: any;
  ip_address: string | null;
  user_agent: string | null;
  licitacao_id: string | null;
  valor_lance: number | null;
  nivel_automacao: number;
};

export default function AuditoriaAdmin() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [eventoFilter, setEventoFilter] = useState('todos');
  const [periodoFilter, setPeriodoFilter] = useState('7d');

  const fetchLogs = async () => {
    setLoading(true);
    let query = supabase
      .from('audit_log_lances')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (eventoFilter !== 'todos') {
      query = query.eq('evento', eventoFilter);
    }

    if (periodoFilter !== 'todos') {
      const days = periodoFilter === '1d' ? 1 : periodoFilter === '7d' ? 7 : periodoFilter === '30d' ? 30 : 90;
      const since = new Date();
      since.setDate(since.getDate() - days);
      query = query.gte('created_at', since.toISOString());
    }

    const { data } = await query;
    setLogs(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchLogs(); }, [eventoFilter, periodoFilter]);

  const filtered = search
    ? logs.filter(l =>
        l.evento.toLowerCase().includes(search.toLowerCase()) ||
        l.user_id.toLowerCase().includes(search.toLowerCase()) ||
        JSON.stringify(l.detalhes).toLowerCase().includes(search.toLowerCase())
      )
    : logs;

  const eventColors: Record<string, string> = {
    lance_enviado: 'bg-accent/10 text-accent border-accent/20',
    lance_rejeitado: 'bg-destructive/10 text-destructive border-destructive/20',
    kill_switch: 'bg-destructive/10 text-destructive border-destructive/20',
    sessao_iniciada: 'bg-success/10 text-success border-success/20',
    sessao_encerrada: 'bg-muted text-muted-foreground',
    login: 'bg-success/10 text-success border-success/20',
    configuracao_alterada: 'bg-warning/10 text-warning border-warning/20',
  };

  const handleExport = () => {
    const csv = [
      'ID,Evento,Usuário,Data,IP,Detalhes',
      ...filtered.map(l => `${l.id},${l.evento},${l.user_id},${l.created_at},${l.ip_address || ''},${JSON.stringify(l.detalhes).replace(/,/g, ';')}`)
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditoria-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout>
      <Helmet>
        <title>Auditoria e Governança | PRAEFECTUS</title>
      </Helmet>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Shield className="w-6 h-6 text-accent" />
              Auditoria e Governança
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Trilha de auditoria com registro de eventos críticos, rastreabilidade e conformidade.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExport} disabled={filtered.length === 0}>
              <Download className="w-4 h-4 mr-1" /> Exportar CSV
            </Button>
            <Button variant="outline" size="sm" onClick={fetchLogs}>
              <RefreshCw className="w-4 h-4 mr-1" /> Atualizar
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por evento, usuário ou detalhe..."
                className="pl-10"
                maxLength={100}
              />
            </div>
          </div>
          <div className="w-40">
            <Select value={eventoFilter} onValueChange={setEventoFilter}>
              <SelectTrigger><Filter className="w-3 h-3 mr-1" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os eventos</SelectItem>
                <SelectItem value="lance_enviado">Lance enviado</SelectItem>
                <SelectItem value="lance_rejeitado">Lance rejeitado</SelectItem>
                <SelectItem value="kill_switch">Kill switch</SelectItem>
                <SelectItem value="sessao_iniciada">Sessão iniciada</SelectItem>
                <SelectItem value="sessao_encerrada">Sessão encerrada</SelectItem>
                <SelectItem value="login">Login</SelectItem>
                <SelectItem value="configuracao_alterada">Config. alterada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-32">
            <Select value={periodoFilter} onValueChange={setPeriodoFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1d">24 horas</SelectItem>
                <SelectItem value="7d">7 dias</SelectItem>
                <SelectItem value="30d">30 dias</SelectItem>
                <SelectItem value="90d">90 dias</SelectItem>
                <SelectItem value="todos">Tudo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total de registros', value: filtered.length },
            { label: 'Eventos únicos', value: new Set(filtered.map(l => l.evento)).size },
            { label: 'Usuários únicos', value: new Set(filtered.map(l => l.user_id)).size },
            { label: 'Últimas 24h', value: filtered.filter(l => new Date(l.created_at) > new Date(Date.now() - 86400000)).length },
          ].map((s) => (
            <div key={s.label} className="bg-card border border-border rounded-lg p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>Nenhum registro encontrado para os filtros selecionados.</p>
          </div>
        ) : (
          <div className="border border-border rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Data/Hora</TableHead>
                  <TableHead className="text-xs">Evento</TableHead>
                  <TableHead className="text-xs">Usuário</TableHead>
                  <TableHead className="text-xs">IP</TableHead>
                  <TableHead className="text-xs">Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, 100).map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] ${eventColors[log.evento] || ''}`}>
                        {log.evento}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {log.user_id.slice(0, 8)}...
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {log.ip_address || '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                      {typeof log.detalhes === 'object' ? JSON.stringify(log.detalhes).slice(0, 80) : String(log.detalhes).slice(0, 80)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
