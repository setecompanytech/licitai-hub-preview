import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Database, Clock, Mail, CalendarDays, HardDrive, Save, Loader2, Download, CheckCircle2, AlertTriangle, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const DIAS_SEMANA = [
  { value: '0', label: 'Domingo' },
  { value: '1', label: 'Segunda-feira' },
  { value: '2', label: 'Terça-feira' },
  { value: '3', label: 'Quarta-feira' },
  { value: '4', label: 'Quinta-feira' },
  { value: '5', label: 'Sexta-feira' },
  { value: '6', label: 'Sábado' },
];

const HORARIOS = [
  '00:00', '01:00', '02:00', '03:00', '04:00', '05:00',
  '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
  '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
  '18:00', '19:00', '20:00', '21:00', '22:00', '23:00',
];

interface BackupConfig {
  id?: string;
  ativo: boolean;
  frequencia: string;
  dia_semana: number;
  dia_mes: number;
  hora_execucao: string;
  enviar_email: boolean;
  email_destino: string;
  alerta_calendario: boolean;
  backup_storage: boolean;
  ultimo_backup: string | null;
  proximo_backup: string | null;
}

interface BackupHistorico {
  id: string;
  tipo: string;
  status: string;
  tamanho_bytes: number | null;
  storage_path: string | null;
  tabelas_exportadas: string[] | null;
  registros_total: number | null;
  erro: string | null;
  created_at: string;
}

const defaultConfig: BackupConfig = {
  ativo: true,
  frequencia: 'semanal',
  dia_semana: 1,
  dia_mes: 1,
  hora_execucao: '03:00',
  enviar_email: true,
  email_destino: '',
  alerta_calendario: true,
  backup_storage: true,
  ultimo_backup: null,
  proximo_backup: null,
};

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
}

export default function BackupAgendado() {
  const { user } = useAuth();
  const [config, setConfig] = useState<BackupConfig>(defaultConfig);
  const [historico, setHistorico] = useState<BackupHistorico[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [runningBackup, setRunningBackup] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadConfig();
    loadHistorico();
  }, [user]);

  const loadConfig = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('backup_config' as any)
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) {
      setConfig({
        id: (data as any).id,
        ativo: (data as any).ativo ?? true,
        frequencia: (data as any).frequencia || 'semanal',
        dia_semana: (data as any).dia_semana ?? 1,
        dia_mes: (data as any).dia_mes ?? 1,
        hora_execucao: (data as any).hora_execucao || '03:00',
        enviar_email: (data as any).enviar_email ?? true,
        email_destino: (data as any).email_destino || user.email || '',
        alerta_calendario: (data as any).alerta_calendario ?? true,
        backup_storage: (data as any).backup_storage ?? true,
        ultimo_backup: (data as any).ultimo_backup,
        proximo_backup: (data as any).proximo_backup,
      });
    } else {
      setConfig({ ...defaultConfig, email_destino: user.email || '' });
    }
  };

  const loadHistorico = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('backup_historico' as any)
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);
    if (data) setHistorico(data as any);
  };

  const calcProximoBackup = (): string => {
    const now = new Date();
    const [h, m] = (config.hora_execucao || '03:00').split(':').map(Number);
    const next = new Date(now);
    next.setHours(h, m, 0, 0);

    if (config.frequencia === 'diario') {
      if (next <= now) next.setDate(next.getDate() + 1);
    } else if (config.frequencia === 'semanal') {
      const targetDay = config.dia_semana ?? 1;
      const currentDay = now.getDay();
      let daysAhead = targetDay - currentDay;
      if (daysAhead <= 0) daysAhead += 7;
      next.setDate(now.getDate() + daysAhead);
    } else if (config.frequencia === 'mensal') {
      const targetDia = config.dia_mes ?? 1;
      next.setDate(targetDia);
      if (next <= now) next.setMonth(next.getMonth() + 1);
    }
    return next.toISOString();
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const proximo = config.ativo ? calcProximoBackup() : null;
      const payload = {
        user_id: user.id,
        ativo: config.ativo,
        frequencia: config.frequencia,
        dia_semana: config.dia_semana,
        dia_mes: config.dia_mes,
        hora_execucao: config.hora_execucao,
        enviar_email: config.enviar_email,
        email_destino: config.email_destino || null,
        alerta_calendario: config.alerta_calendario,
        backup_storage: config.backup_storage,
        proximo_backup: proximo,
      };

      if (config.id) {
        const { error } = await supabase
          .from('backup_config' as any)
          .update(payload as any)
          .eq('id', config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('backup_config' as any)
          .insert(payload as any);
        if (error) throw error;
      }

      await loadConfig();
      toast.success('Agendamento de backup salvo com sucesso');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar configuração de backup');
    } finally {
      setSaving(false);
    }
  };

  const handleRunBackupNow = async () => {
    if (!user) return;
    setRunningBackup(true);
    try {
      // Build export data (same as ExportarDados)
      const TABLES = [
        'empresas', 'licitacoes', 'documentos', 'contratos', 'contrato_aditivos',
        'contrato_itens', 'contrato_pedidos', 'contrato_custos',
        'kanban_tasks', 'catalogo_itens_precificados', 'composicoes_custo',
        'apoio_juridico', 'apoio_contabil', 'base_juridica', 'base_contabil',
        'concorrentes', 'editais_favoritos', 'configuracoes', 'lances',
      ];

      const result: Record<string, unknown[]> = {};
      let totalRegistros = 0;
      const tabelasExportadas: string[] = [];

      await Promise.all(
        TABLES.map(async (key) => {
          const query = (supabase.from(key as any) as any).select('*');
          if (key !== 'empresas') {
            query.eq('user_id', user.id);
          }
          const { data } = await query.limit(5000);
          if (data && data.length > 0) {
            result[key] = data;
            totalRegistros += data.length;
            tabelasExportadas.push(key);
          }
        })
      );

      // Handle empresas by membership
      const { data: memberships } = await supabase
        .from('empresa_membros')
        .select('empresa_id')
        .eq('user_id', user.id);
      if (memberships && memberships.length > 0) {
        const ids = memberships.map((m) => m.empresa_id);
        const { data: empresas } = await supabase
          .from('empresas')
          .select('*')
          .in('id', ids);
        if (empresas) {
          result.empresas = empresas;
          totalRegistros += empresas.length;
          if (!tabelasExportadas.includes('empresas')) tabelasExportadas.push('empresas');
        }
      }

      const jsonStr = JSON.stringify(result, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const tamanhoBytes = blob.size;
      const fileName = `backup-${user.id.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json`;

      // Save to storage if enabled
      let storagePath: string | null = null;
      if (config.backup_storage) {
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('documentos')
          .upload(`backups/${user.id}/${fileName}`, blob, {
            contentType: 'application/json',
            upsert: true,
          });
        if (!uploadErr && uploadData) {
          storagePath = uploadData.path;
        }
      }

      // Download file locally
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);

      // Save history record
      await supabase.from('backup_historico' as any).insert({
        user_id: user.id,
        tipo: 'manual',
        status: 'concluido',
        tamanho_bytes: tamanhoBytes,
        storage_path: storagePath,
        tabelas_exportadas: tabelasExportadas,
        registros_total: totalRegistros,
      } as any);

      // Update ultimo_backup
      if (config.id) {
        await supabase
          .from('backup_config' as any)
          .update({ ultimo_backup: new Date().toISOString() } as any)
          .eq('id', config.id);
      }

      await loadConfig();
      await loadHistorico();
      toast.success(`Backup realizado com sucesso. ${totalRegistros} registros exportados.`);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao realizar backup');
    } finally {
      setRunningBackup(false);
    }
  };

  const handleDeleteHistorico = async (id: string) => {
    await supabase.from('backup_historico' as any).delete().eq('id', id);
    await loadHistorico();
    toast.success('Registro removido');
  };

  return (
    <section className="bg-card rounded-xl border border-border/50 p-5 shadow-sm space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-accent" />
          <h2 className="text-sm font-semibold">Backup Programado</h2>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="backup-ativo" className="text-xs text-muted-foreground">Ativar agendamento</Label>
          <Switch
            id="backup-ativo"
            checked={config.ativo}
            onCheckedChange={(v) => setConfig({ ...config, ativo: v })}
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Configure backups automáticos dos seus dados. Os snapshots são armazenados no sistema, enviados por e-mail e registrados no calendário como lembretes recorrentes.
      </p>

      {config.ativo && (
        <>
          <Separator />

          {/* Frequência */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs">Frequência</Label>
              <Select value={config.frequencia} onValueChange={(v) => setConfig({ ...config, frequencia: v })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="diario">Diário</SelectItem>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {config.frequencia === 'semanal' && (
              <div>
                <Label className="text-xs">Dia da semana</Label>
                <Select value={String(config.dia_semana)} onValueChange={(v) => setConfig({ ...config, dia_semana: parseInt(v) })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIAS_SEMANA.map((d) => (
                      <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {config.frequencia === 'mensal' && (
              <div>
                <Label className="text-xs">Dia do mês</Label>
                <Select value={String(config.dia_mes)} onValueChange={(v) => setConfig({ ...config, dia_mes: parseInt(v) })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                      <SelectItem key={d} value={String(d)}>Dia {d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label className="text-xs">Horário</Label>
              <Select value={config.hora_execucao} onValueChange={(v) => setConfig({ ...config, hora_execucao: v })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HORARIOS.map((h) => (
                    <SelectItem key={h} value={h}>{h}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Canais de backup */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Canais de Backup</p>

            {/* E-mail */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
              <Mail className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Envio por e-mail</p>
                    <p className="text-xs text-muted-foreground">Receba o arquivo de backup no seu e-mail</p>
                  </div>
                  <Switch
                    checked={config.enviar_email}
                    onCheckedChange={(v) => setConfig({ ...config, enviar_email: v })}
                  />
                </div>
                {config.enviar_email && (
                  <div>
                    <Label className="text-xs">E-mail de destino</Label>
                    <Input
                      value={config.email_destino}
                      onChange={(e) => setConfig({ ...config, email_destino: e.target.value })}
                      placeholder="seu@email.com"
                      className="mt-1"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Calendário */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
              <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Lembrete no calendário</p>
                  <p className="text-xs text-muted-foreground">Alerta recorrente para verificar e baixar backups</p>
                </div>
                <Switch
                  checked={config.alerta_calendario}
                  onCheckedChange={(v) => setConfig({ ...config, alerta_calendario: v })}
                />
              </div>
            </div>

            {/* Storage */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
              <HardDrive className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Armazenamento no sistema</p>
                  <p className="text-xs text-muted-foreground">Snapshots salvos automaticamente para download posterior</p>
                </div>
                <Switch
                  checked={config.backup_storage}
                  onCheckedChange={(v) => setConfig({ ...config, backup_storage: v })}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {config.ultimo_backup && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 border border-success/20">
                <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                <div>
                  <p className="text-xs font-medium">Último backup</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(config.ultimo_backup), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
            )}
            {config.proximo_backup && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-info/10 border border-info/20">
                <Clock className="w-4 h-4 text-info shrink-0" />
                <div>
                  <p className="text-xs font-medium">Próximo backup</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(config.proximo_backup), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Ações */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Salvar Agendamento
        </Button>
        <Button size="sm" variant="outline" onClick={handleRunBackupNow} disabled={runningBackup} className="gap-1.5">
          {runningBackup ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Executar Backup Agora
        </Button>
      </div>

      {/* Histórico */}
      {historico.length > 0 && (
        <>
          <Separator />
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Histórico de Backups</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {historico.map((h) => (
                <div key={h.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/30">
                  <div className="flex items-center gap-3 min-w-0">
                    <Database className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium truncate">
                          {format(new Date(h.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                        <Badge variant={h.status === 'concluido' ? 'default' : 'destructive'} className="text-[10px] px-1.5 py-0">
                          {h.status === 'concluido' ? 'Concluído' : 'Erro'}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {h.tipo === 'manual' ? 'Manual' : 'Automático'}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {h.registros_total ?? 0} registros | {formatBytes(h.tamanho_bytes)}
                        {h.tabelas_exportadas ? ` | ${h.tabelas_exportadas.length} tabelas` : ''}
                      </p>
                      {h.erro && (
                        <p className="text-[10px] text-destructive flex items-center gap-1 mt-0.5">
                          <AlertTriangle className="w-3 h-3" /> {h.erro}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {h.storage_path && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={async () => {
                          const { data } = await supabase.storage
                            .from('documentos')
                            .createSignedUrl(h.storage_path!, 3600);
                          if (data?.signedUrl) window.open(data.signedUrl, '_blank');
                        }}
                      >
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteHistorico(h.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
