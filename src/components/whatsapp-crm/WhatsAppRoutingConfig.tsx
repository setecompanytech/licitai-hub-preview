import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  Bot, Loader2, Save, Copy, Clock, Zap, Phone, Send, Info,
  Route, Shield, ArrowRight, Globe, Gavel, Scale, DollarSign, FileText
} from 'lucide-react';

// ── Types ──

interface RoutingConfig {
  id?: string;
  ativo: boolean;
  resposta_automatica: boolean;
  mensagem_boas_vindas: string;
  mensagem_fora_horario: string;
  horario_inicio: string;
  horario_fim: string;
  dias_semana: number[];
  provider: string;
  provider_url: string;
  provider_instance: string;
}

interface RoutingLog {
  id: string;
  setor_destino: string;
  confianca: number;
  motivo: string;
  acao: string;
  created_at: string;
}

const DIAS = [
  { value: 0, label: 'Dom', nome: 'domingo' },
  { value: 1, label: 'Seg', nome: 'segunda-feira' },
  { value: 2, label: 'Ter', nome: 'terça-feira' },
  { value: 3, label: 'Qua', nome: 'quarta-feira' },
  { value: 4, label: 'Qui', nome: 'quinta-feira' },
  { value: 5, label: 'Sex', nome: 'sexta-feira' },
  { value: 6, label: 'Sáb', nome: 'sábado' },
];

type SetorKey = 'setor_licitacoes' | 'setor_juridico' | 'setor_financeiro' | 'setor_documentos';
type TelefoneKey = 'telefone_licitacoes' | 'telefone_juridico' | 'telefone_financeiro' | 'telefone_documentos';

const SETORES = [
  { key: 'setor_licitacoes' as SetorKey, telefoneKey: 'telefone_licitacoes' as TelefoneKey, label: 'Licitações', desc: 'Novos editais, prazos, resultados', icon: Gavel },
  { key: 'setor_juridico' as SetorKey, telefoneKey: 'telefone_juridico' as TelefoneKey, label: 'Jurídico', desc: 'Impugnações, recursos, pareceres', icon: Scale },
  { key: 'setor_financeiro' as SetorKey, telefoneKey: 'telefone_financeiro' as TelefoneKey, label: 'Financeiro', desc: 'Empenhos, pagamentos, garantias', icon: DollarSign },
  { key: 'setor_documentos' as SetorKey, telefoneKey: 'telefone_documentos' as TelefoneKey, label: 'Documentos', desc: 'Certidões, atestados, habilitação', icon: FileText },
];

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

// ── Component ──

export default function WhatsAppRoutingConfig() {
  const { user } = useAuth();

  // Routing config state
  const [config, setConfig] = useState<RoutingConfig>({
    ativo: true,
    resposta_automatica: true,
    mensagem_boas_vindas: 'Olá! Recebi sua mensagem. Estou analisando e encaminhando ao setor responsável. Em breve retornaremos!',
    mensagem_fora_horario: 'Olá! No momento estamos fora do horário de atendimento. Sua mensagem foi registrada e será respondida em breve.',
    horario_inicio: '08:00',
    horario_fim: '18:00',
    dias_semana: [1, 2, 3, 4, 5],
    provider: 'evolution',
    provider_url: '',
    provider_instance: '',
  });
  const [hasConfig, setHasConfig] = useState(false);

  // Sector phones state
  const [telefoneGlobal, setTelefoneGlobal] = useState('');
  const [telefonesSetor, setTelefonesSetor] = useState<Record<TelefoneKey, string>>({
    telefone_licitacoes: '', telefone_juridico: '', telefone_financeiro: '', telefone_documentos: '',
  });
  const [setoresAtivos, setSetoresAtivos] = useState<Record<SetorKey, boolean>>({
    setor_licitacoes: true, setor_juridico: false, setor_financeiro: false, setor_documentos: false,
  });
  const [ativoPrefs, setAtivoPrefs] = useState(true);
  const [hasPrefs, setHasPrefs] = useState(false);

  // Shared state
  const [logs, setLogs] = useState<RoutingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`;

  useEffect(() => {
    if (user) {
      Promise.all([loadRoutingConfig(), loadPreferences(), loadLogs()]).then(() => setLoading(false));
    }
  }, [user]);

  // ── Data Loading ──

  const loadRoutingConfig = async () => {
    const { data } = await supabase
      .from('whatsapp_roteamento_config')
      .select('*')
      .eq('user_id', user!.id)
      .maybeSingle();
    if (data) {
      setConfig({
        id: data.id, ativo: data.ativo, resposta_automatica: data.resposta_automatica,
        mensagem_boas_vindas: data.mensagem_boas_vindas || '', mensagem_fora_horario: data.mensagem_fora_horario || '',
        horario_inicio: data.horario_inicio || '08:00', horario_fim: data.horario_fim || '18:00',
        dias_semana: data.dias_semana || [1, 2, 3, 4, 5], provider: data.provider || 'evolution',
        provider_url: data.provider_url || '', provider_instance: data.provider_instance || '',
      });
      setHasConfig(true);
    }
  };

  const loadPreferences = async () => {
    const { data } = await supabase
      .from('whatsapp_preferencias')
      .select('*')
      .eq('user_id', user!.id)
      .maybeSingle();
    if (data) {
      setTelefoneGlobal(data.telefone || '');
      setSetoresAtivos({
        setor_licitacoes: data.setor_licitacoes, setor_juridico: data.setor_juridico,
        setor_financeiro: data.setor_financeiro, setor_documentos: data.setor_documentos,
      });
      setTelefonesSetor({
        telefone_licitacoes: (data as any).telefone_licitacoes || '',
        telefone_juridico: (data as any).telefone_juridico || '',
        telefone_financeiro: (data as any).telefone_financeiro || '',
        telefone_documentos: (data as any).telefone_documentos || '',
      });
      setAtivoPrefs(data.ativo);
      setHasPrefs(true);
    }
  };

  const loadLogs = async () => {
    const { data } = await supabase
      .from('whatsapp_roteamento_log')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setLogs(data as RoutingLog[]);
  };

  // ── Save All ──

  const handleSave = async () => {
    // Validate sector phones
    for (const setor of SETORES) {
      if (setoresAtivos[setor.key]) {
        const tel = telefonesSetor[setor.telefoneKey] || telefoneGlobal;
        if (!tel || tel.replace(/\D/g, '').length < 10) {
          toast.error(`Informe um telefone válido para ${setor.label} ou defina o número principal`);
          return;
        }
      }
    }

    setSaving(true);

    // Save routing config
    const routingPayload: any = {
      user_id: user!.id, ativo: config.ativo, resposta_automatica: config.resposta_automatica,
      mensagem_boas_vindas: config.mensagem_boas_vindas, mensagem_fora_horario: config.mensagem_fora_horario,
      horario_inicio: config.horario_inicio, horario_fim: config.horario_fim,
      dias_semana: config.dias_semana, provider: config.provider,
      provider_url: config.provider_url || null, provider_instance: config.provider_instance || null,
    };

    if (hasConfig) {
      await supabase.from('whatsapp_roteamento_config').update(routingPayload).eq('user_id', user!.id);
    } else {
      await supabase.from('whatsapp_roteamento_config').insert(routingPayload);
      setHasConfig(true);
    }

    // Save preferences (sector phones)
    const prefsPayload: any = {
      user_id: user!.id, telefone: telefoneGlobal.replace(/\D/g, ''), ativo: ativoPrefs,
      ...setoresAtivos,
      telefone_licitacoes: telefonesSetor.telefone_licitacoes.replace(/\D/g, '') || null,
      telefone_juridico: telefonesSetor.telefone_juridico.replace(/\D/g, '') || null,
      telefone_financeiro: telefonesSetor.telefone_financeiro.replace(/\D/g, '') || null,
      telefone_documentos: telefonesSetor.telefone_documentos.replace(/\D/g, '') || null,
    };

    if (hasPrefs) {
      await supabase.from('whatsapp_preferencias').update(prefsPayload).eq('user_id', user!.id);
    } else {
      await supabase.from('whatsapp_preferencias').insert(prefsPayload);
      setHasPrefs(true);
    }

    toast.success('Todas as configurações foram salvas!');
    setSaving(false);
  };

  // ── Actions ──

  const handleTestWebhook = async () => {
    try {
      const res = await supabase.functions.invoke('whatsapp-webhook', {
        body: {
          from: '5511999999999', to: telefoneGlobal.replace(/\D/g, '') || '5511888888888',
          message: 'Olá, preciso de informações sobre o pregão eletrônico 001/2025 do Ministério da Saúde.',
          name: 'João Teste',
        },
      });
      if (res.error) throw res.error;
      const conf = res.data?.confianca ? `${(res.data.confianca * 100).toFixed(0)}%` : '—';
      toast.success(`Teste executado! Setor: ${res.data?.setor} (confiança: ${conf})`);
      loadLogs();
    } catch (err: any) {
      toast.error('Erro no teste: ' + (err.message || 'Erro desconhecido'));
    }
  };

  const handleTestEnvioSetor = async (setor: typeof SETORES[number]) => {
    const tel = telefonesSetor[setor.telefoneKey] || telefoneGlobal;
    if (!tel || tel.replace(/\D/g, '').length < 10) {
      toast.error(`Configure um telefone para ${setor.label} antes de testar`);
      return;
    }
    setTesting(setor.key);
    try {
      await supabase.functions.invoke('whatsapp-envio', {
        body: { telefone: tel.replace(/\D/g, ''), setor: setor.label.toLowerCase(), tipo: 'teste' },
      });
      toast.success(`Envio simulado para ${setor.label} no número ${formatPhone(tel)}!`);
    } catch (err: any) {
      toast.error('Erro no envio: ' + (err.message || 'Erro desconhecido'));
    }
    setTesting(null);
  };

  const toggleDia = (dia: number) => {
    setConfig(prev => ({
      ...prev,
      dias_semana: prev.dias_semana.includes(dia)
        ? prev.dias_semana.filter(d => d !== dia)
        : [...prev.dias_semana, dia].sort(),
    }));
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success('URL copiada!');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">Carregando a configuração de roteamento</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Webhook URL */}
      <Card className="p-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Globe className="w-5 h-5 text-primary" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-foreground">URL do webhook</h2>
          <Badge variant="muted">Configure no provedor</Badge>
        </div>
        <p className="mb-3 text-sm text-muted-foreground">
          Copie esta URL e cole nas configurações de webhook do seu provedor (Evolution API, Z-API ou Twilio).
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor="webhook-url" className="sr-only">URL do webhook</Label>
          <Input id="webhook-url" value={webhookUrl} readOnly className="min-w-64 flex-1 font-mono text-sm" />
          <Button variant="outline" size="icon" onClick={copyWebhookUrl} aria-label="Copiar a URL do webhook">
            <Copy aria-hidden="true" />
          </Button>
        </div>
      </Card>

      {/* Números por setor */}
      <Card className="p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Phone className="w-5 h-5 text-primary" aria-hidden="true" />
            <h2 className="text-lg font-semibold text-foreground">Números por setor</h2>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="prefs-notificacoes" className="text-sm text-muted-foreground">Notificações</Label>
            <Switch id="prefs-notificacoes" checked={ativoPrefs} onCheckedChange={setAtivoPrefs} />
          </div>
        </div>

        <div className="mb-4 space-y-1.5">
          <Label htmlFor="telefone-principal">Número principal (padrão)</Label>
          <Input
            id="telefone-principal"
            placeholder="(11) 99999-9999"
            value={formatPhone(telefoneGlobal)}
            onChange={e => setTelefoneGlobal(e.target.value.replace(/\D/g, ''))}
          />
          <p className="text-xs text-muted-foreground">Usado quando o setor não tem número próprio</p>
        </div>

        <div className="grid gap-3">
          {SETORES.map(setor => {
            const ativoSetor = setoresAtivos[setor.key];
            const telSetor = telefonesSetor[setor.telefoneKey];
            return (
              <div
                key={setor.key}
                className={`rounded-lg border border-border transition-colors ${ativoSetor ? 'bg-card' : 'bg-muted opacity-70'}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span aria-hidden="true" className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary-tint text-primary">
                      <setor.icon className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{setor.label}</p>
                      <p className="text-xs text-muted-foreground">{setor.desc}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!ativoSetor || testing !== null}
                      onClick={() => handleTestEnvioSetor(setor)}
                      aria-label={`Testar o envio para ${setor.label}`}
                    >
                      {testing === setor.key
                        ? <Loader2 className="animate-spin" aria-hidden="true" />
                        : <Send aria-hidden="true" />}
                      Testar
                    </Button>
                    <Label htmlFor={`setor-ativo-${setor.key}`} className="sr-only">
                      Encaminhar mensagens de {setor.label}
                    </Label>
                    <Switch
                      id={`setor-ativo-${setor.key}`}
                      checked={ativoSetor}
                      onCheckedChange={v => setSetoresAtivos(p => ({ ...p, [setor.key]: v }))}
                    />
                  </div>
                </div>
                {ativoSetor && (
                  <div className="px-4 pb-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Label htmlFor={`telefone-${setor.key}`} className="sr-only">
                        Telefone do setor {setor.label}
                      </Label>
                      <Input
                        id={`telefone-${setor.key}`}
                        placeholder={telefoneGlobal ? `Padrão: ${formatPhone(telefoneGlobal)}` : '(11) 99999-9999'}
                        value={formatPhone(telSetor)}
                        onChange={e => setTelefonesSetor(p => ({ ...p, [setor.telefoneKey]: e.target.value.replace(/\D/g, '') }))}
                        className="min-w-48 flex-1"
                      />
                      {/* Status com TEXTO — a cor é reforço, nunca a única pista. */}
                      {telSetor
                        ? <Badge variant="success">Número próprio</Badge>
                        : <Badge variant="muted">Usa o padrão</Badge>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Roteamento IA */}
        <Card className="p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Route className="w-5 h-5 text-primary" aria-hidden="true" />
              <h2 className="text-lg font-semibold text-foreground">Roteamento automático</h2>
            </div>
            <Label htmlFor="roteamento-ativo" className="sr-only">Ligar o roteamento automático</Label>
            <Switch id="roteamento-ativo" checked={config.ativo} onCheckedChange={v => setConfig(p => ({ ...p, ativo: v }))} />
          </div>

          <div className="space-y-4">
            <Alert variant="info">
              <Bot className="h-4 w-4" aria-hidden="true" />
              <AlertTitle>IA classificadora</AlertTitle>
              <AlertDescription>
                Cada mensagem recebida é analisada pela IA que identifica o setor e encaminha automaticamente.
              </AlertDescription>
            </Alert>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor="resposta-automatica">Resposta automática</Label>
              <Switch id="resposta-automatica" checked={config.resposta_automatica} onCheckedChange={v => setConfig(p => ({ ...p, resposta_automatica: v }))} />
            </div>

            {config.resposta_automatica && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="mensagem-boas-vindas">Mensagem de boas-vindas</Label>
                  <Textarea id="mensagem-boas-vindas" value={config.mensagem_boas_vindas} onChange={e => setConfig(p => ({ ...p, mensagem_boas_vindas: e.target.value }))} rows={3} />
                  <p className="text-xs text-muted-foreground">No horário, a IA gera respostas personalizadas. Esta é a mensagem de reserva.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mensagem-fora-horario">Mensagem fora do horário</Label>
                  <Textarea id="mensagem-fora-horario" value={config.mensagem_fora_horario} onChange={e => setConfig(p => ({ ...p, mensagem_fora_horario: e.target.value }))} rows={3} />
                </div>
              </>
            )}
          </div>
        </Card>

        {/* Horário + Provedor */}
        <Card className="p-6">
          <div className="mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" aria-hidden="true" />
            <h2 className="text-lg font-semibold text-foreground">Horário e provedor</h2>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="horario-inicio">Início</Label>
                <Input id="horario-inicio" type="time" value={config.horario_inicio} onChange={e => setConfig(p => ({ ...p, horario_inicio: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="horario-fim">Fim</Label>
                <Input id="horario-fim" type="time" value={config.horario_fim} onChange={e => setConfig(p => ({ ...p, horario_fim: e.target.value }))} />
              </div>
            </div>

            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-medium text-foreground">Dias de funcionamento</legend>
              <div className="flex flex-wrap gap-2">
                {DIAS.map(dia => {
                  const ligado = config.dias_semana.includes(dia.value);
                  return (
                    <Button
                      key={dia.value}
                      variant={ligado ? 'default' : 'outline'}
                      size="sm"
                      aria-pressed={ligado}
                      aria-label={`${ligado ? 'Desligar' : 'Ligar'} ${dia.nome}`}
                      onClick={() => toggleDia(dia.value)}
                    >
                      {dia.label}
                    </Button>
                  );
                })}
              </div>
            </fieldset>

            <div className="space-y-3 border-t border-border pt-4">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" aria-hidden="true" />
                <h3 className="text-lg font-semibold text-foreground">Provedor de API</h3>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="provider">Provedor</Label>
                <Select value={config.provider} onValueChange={v => setConfig(p => ({ ...p, provider: v }))}>
                  <SelectTrigger id="provider"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="evolution">Evolution API (gratuito, self-hosted)</SelectItem>
                    <SelectItem value="zapi">Z-API (~R$ 50/mês)</SelectItem>
                    <SelectItem value="twilio">Twilio WhatsApp</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="provider-url">URL base</Label>
                <Input
                  id="provider-url"
                  placeholder={config.provider === 'evolution' ? 'https://sua-api.com' : config.provider === 'zapi' ? 'https://api.z-api.io/instances/...' : 'https://api.twilio.com/...'}
                  value={config.provider_url}
                  onChange={e => setConfig(p => ({ ...p, provider_url: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="provider-instance">Instância / ID</Label>
                <Input id="provider-instance" placeholder="Nome da instância" value={config.provider_instance} onChange={e => setConfig(p => ({ ...p, provider_instance: e.target.value }))} />
              </div>

              <Alert variant="info">
                <Info className="h-4 w-4" aria-hidden="true" />
                <AlertDescription>
                  Sem provedor configurado, o sistema opera em modo simulado.
                </AlertDescription>
              </Alert>
            </div>
          </div>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
          Salvar tudo
        </Button>
        <Button variant="outline" onClick={handleTestWebhook}>
          <Shield aria-hidden="true" />
          Testar webhook
        </Button>
      </div>

      {/* Routing Logs */}
      {logs.length > 0 && (
        <Card className="p-6">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Route className="w-5 h-5 text-primary" aria-hidden="true" />
            <h2 className="text-lg font-semibold text-foreground">Log de roteamento</h2>
            <Badge variant="muted">{logs.length} eventos</Badge>
          </div>
          <ScrollArea className="max-h-64">
            <div className="space-y-2 pr-2">
              {logs.map(log => (
                <div key={log.id} className="flex flex-wrap items-center gap-3 rounded-md bg-muted p-3 text-sm">
                  <ArrowRight className="w-4 h-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
                  <Badge variant="muted" truncate>{log.setor_destino}</Badge>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">{log.motivo}</span>
                  <span className="whitespace-nowrap text-muted-foreground tabular-nums">
                    {log.confianca ? `${(log.confianca * 100).toFixed(0)}%` : '—'}
                  </span>
                  <span className="whitespace-nowrap text-muted-foreground tabular-nums">
                    {new Date(log.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </Card>
      )}
    </div>
  );
}
