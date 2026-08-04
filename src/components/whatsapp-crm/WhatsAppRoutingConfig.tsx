import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
];

type SetorKey = 'setor_licitacoes' | 'setor_juridico' | 'setor_financeiro' | 'setor_documentos';
type TelefoneKey = 'telefone_licitacoes' | 'telefone_juridico' | 'telefone_financeiro' | 'telefone_documentos';

const SETORES = [
  { key: 'setor_licitacoes' as SetorKey, telefoneKey: 'telefone_licitacoes' as TelefoneKey, label: 'Licitações', desc: 'Novos editais, prazos, resultados', icon: Gavel, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
  { key: 'setor_juridico' as SetorKey, telefoneKey: 'telefone_juridico' as TelefoneKey, label: 'Jurídico', desc: 'Impugnações, recursos, pareceres', icon: Scale, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  { key: 'setor_financeiro' as SetorKey, telefoneKey: 'telefone_financeiro' as TelefoneKey, label: 'Financeiro', desc: 'Empenhos, pagamentos, garantias', icon: DollarSign, color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
  { key: 'setor_documentos' as SetorKey, telefoneKey: 'telefone_documentos' as TelefoneKey, label: 'Documentos', desc: 'Certidões, atestados, habilitação', icon: FileText, color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
];

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const setorColorMap: Record<string, string> = {
  'licitações': 'bg-emerald-500/10 text-emerald-600',
  'jurídico': 'bg-blue-500/10 text-blue-600',
  'financeiro': 'bg-amber-500/10 text-amber-600',
  'documentos': 'bg-purple-500/10 text-purple-600',
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
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Webhook URL */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Globe className="w-5 h-5 text-primary" />
          <h2 className="text-sm font-semibold">URL do Webhook</h2>
          <Badge variant="outline" className="text-xs">Configure no provedor</Badge>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Copie esta URL e cole nas configurações de webhook do seu provedor (Evolution API, Z-API ou Twilio).
        </p>
        <div className="flex gap-2">
          <Input value={webhookUrl} readOnly className="text-xs font-mono" />
          <Button variant="outline" size="icon" onClick={copyWebhookUrl}><Copy className="w-4 h-4" /></Button>
        </div>
      </Card>

      {/* Números por setor */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Phone className="w-5 h-5 text-primary" />
            <h2 className="text-sm font-semibold">Números por Setor</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Notificações</span>
            <Switch checked={ativoPrefs} onCheckedChange={setAtivoPrefs} />
          </div>
        </div>

        <div className="mb-4">
          <Label className="text-xs">Número Principal (padrão)</Label>
          <Input
            placeholder="(11) 99999-9999"
            value={formatPhone(telefoneGlobal)}
            onChange={e => setTelefoneGlobal(e.target.value.replace(/\D/g, ''))}
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">Usado quando o setor não tem número próprio</p>
        </div>

        <div className="grid gap-3">
          {SETORES.map(setor => {
            const ativoSetor = setoresAtivos[setor.key];
            const telSetor = telefonesSetor[setor.telefoneKey];
            return (
              <div key={setor.key} className={`rounded-xl border transition-colors ${ativoSetor ? 'border-border bg-card' : 'border-border/40 bg-muted/20 opacity-70'}`}>
                <div className="flex items-center justify-between p-3 pb-1.5">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-lg ${setor.bgColor} flex items-center justify-center`}>
                      <setor.icon className={`w-4 h-4 ${setor.color}`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{setor.label}</p>
                      <p className="text-xs text-muted-foreground">{setor.desc}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" disabled={!ativoSetor || testing !== null} onClick={() => handleTestEnvioSetor(setor)}>
                      {testing === setor.key ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}Testar
                    </Button>
                    <Switch checked={ativoSetor} onCheckedChange={v => setSetoresAtivos(p => ({ ...p, [setor.key]: v }))} />
                  </div>
                </div>
                {ativoSetor && (
                  <div className="px-3 pb-3 pt-1">
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder={telefoneGlobal ? `Padrão: ${formatPhone(telefoneGlobal)}` : '(11) 99999-9999'}
                        value={formatPhone(telSetor)}
                        onChange={e => setTelefonesSetor(p => ({ ...p, [setor.telefoneKey]: e.target.value.replace(/\D/g, '') }))}
                        className="flex-1 text-xs"
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {telSetor ? '✅ Próprio' : '📋 Padrão'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Roteamento IA */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Route className="w-5 h-5 text-primary" />
              <h2 className="text-sm font-semibold">Roteamento Automático</h2>
            </div>
            <Switch checked={config.ativo} onCheckedChange={v => setConfig(p => ({ ...p, ativo: v }))} />
          </div>

          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
              <div className="flex items-start gap-2">
                <Bot className="w-4 h-4 text-primary mt-0.5" />
                <div>
                  <p className="text-xs font-medium">IA Classificadora</p>
                  <p className="text-xs text-muted-foreground">
                    Cada mensagem recebida é analisada pela IA que identifica o setor e encaminha automaticamente.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <Label className="text-xs">Resposta Automática</Label>
              <Switch checked={config.resposta_automatica} onCheckedChange={v => setConfig(p => ({ ...p, resposta_automatica: v }))} />
            </div>

            {config.resposta_automatica && (
              <>
                <div>
                  <Label className="text-xs">Mensagem de boas-vindas</Label>
                  <Textarea value={config.mensagem_boas_vindas} onChange={e => setConfig(p => ({ ...p, mensagem_boas_vindas: e.target.value }))} className="mt-1 text-xs" rows={3} />
                  <p className="text-xs text-muted-foreground mt-1">💡 No horário, a IA gera respostas personalizadas. Esta é o fallback.</p>
                </div>
                <div>
                  <Label className="text-xs">Mensagem fora do horário</Label>
                  <Textarea value={config.mensagem_fora_horario} onChange={e => setConfig(p => ({ ...p, mensagem_fora_horario: e.target.value }))} className="mt-1 text-xs" rows={3} />
                </div>
              </>
            )}
          </div>
        </Card>

        {/* Horário + Provedor */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-primary" />
            <h2 className="text-sm font-semibold">Horário e Provedor</h2>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Início</Label>
                <Input type="time" value={config.horario_inicio} onChange={e => setConfig(p => ({ ...p, horario_inicio: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Fim</Label>
                <Input type="time" value={config.horario_fim} onChange={e => setConfig(p => ({ ...p, horario_fim: e.target.value }))} className="mt-1" />
              </div>
            </div>

            <div>
              <Label className="text-xs mb-2 block">Dias de funcionamento</Label>
              <div className="flex gap-1.5">
                {DIAS.map(dia => (
                  <Button key={dia.value} variant={config.dias_semana.includes(dia.value) ? 'default' : 'outline'} size="sm" className="text-xs h-8 w-10" onClick={() => toggleDia(dia.value)}>
                    {dia.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-primary" />
                <Label className="text-xs font-semibold">Provedor de API</Label>
              </div>

              <Select value={config.provider} onValueChange={v => setConfig(p => ({ ...p, provider: v }))}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="evolution">Evolution API (Gratuito, Self-hosted)</SelectItem>
                  <SelectItem value="zapi">Z-API (~R$50/mês)</SelectItem>
                  <SelectItem value="twilio">Twilio WhatsApp</SelectItem>
                </SelectContent>
              </Select>

              <div className="mt-3 space-y-2">
                <div>
                  <Label className="text-xs">URL Base</Label>
                  <Input
                    placeholder={config.provider === 'evolution' ? 'https://sua-api.com' : config.provider === 'zapi' ? 'https://api.z-api.io/instances/...' : 'https://api.twilio.com/...'}
                    value={config.provider_url} onChange={e => setConfig(p => ({ ...p, provider_url: e.target.value }))} className="mt-1 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs">Instância / ID</Label>
                  <Input placeholder="Nome da instância" value={config.provider_instance} onChange={e => setConfig(p => ({ ...p, provider_instance: e.target.value }))} className="mt-1 text-xs" />
                </div>
              </div>

              <div className="mt-3 p-2 rounded bg-muted/50 border border-border">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Info className="w-3 h-3 flex-shrink-0" />
                  Sem provedor configurado, o sistema opera em modo simulado.
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar Tudo
        </Button>
        <Button variant="outline" onClick={handleTestWebhook} className="gap-2">
          <Shield className="w-4 h-4" />
          Testar Webhook
        </Button>
      </div>

      {/* Routing Logs */}
      {logs.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Route className="w-5 h-5 text-primary" />
            <h2 className="text-sm font-semibold">Log de Roteamento</h2>
            <Badge variant="outline" className="text-xs">{logs.length} eventos</Badge>
          </div>
          <ScrollArea className="max-h-64">
            <div className="space-y-2">
              {logs.map(log => (
                <div key={log.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30 text-xs">
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <Badge className={`text-xs ${setorColorMap[log.setor_destino] || 'bg-muted'}`}>{log.setor_destino}</Badge>
                  <span className="text-muted-foreground truncate flex-1">{log.motivo}</span>
                  <span className="text-muted-foreground whitespace-nowrap">{log.confianca ? `${(log.confianca * 100).toFixed(0)}%` : '—'}</span>
                  <span className="text-muted-foreground whitespace-nowrap">
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
