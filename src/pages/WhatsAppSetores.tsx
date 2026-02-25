import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  MessageSquare,
  Phone,
  Gavel,
  Scale,
  DollarSign,
  FileText,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Info,
} from 'lucide-react';

const SETORES = [
  {
    key: 'setor_licitacoes' as const,
    label: 'Licitações',
    desc: 'Novos editais, prazos, resultados e alterações',
    icon: Gavel,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
  },
  {
    key: 'setor_juridico' as const,
    label: 'Jurídico',
    desc: 'Impugnações, recursos, pareceres e prazos legais',
    icon: Scale,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  {
    key: 'setor_financeiro' as const,
    label: 'Financeiro',
    desc: 'Empenhos, pagamentos, garantias e cauções',
    icon: DollarSign,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
  },
  {
    key: 'setor_documentos' as const,
    label: 'Documentos',
    desc: 'Certidões vencendo, documentos pendentes e atualizações',
    icon: FileText,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
  },
];

interface Envio {
  id: string;
  setor: string;
  mensagem: string;
  status: string;
  created_at: string;
}

export default function WhatsAppSetores() {
  const { user } = useAuth();
  const [telefone, setTelefone] = useState('');
  const [setores, setSetores] = useState({
    setor_licitacoes: true,
    setor_juridico: false,
    setor_financeiro: false,
    setor_documentos: false,
  });
  const [ativo, setAtivo] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [hasPrefs, setHasPrefs] = useState(false);

  useEffect(() => {
    if (user) {
      loadPreferences();
      loadEnvios();
    }
  }, [user]);

  const loadPreferences = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('whatsapp_preferencias')
      .select('*')
      .eq('user_id', user!.id)
      .maybeSingle();

    if (data) {
      setTelefone(data.telefone);
      setSetores({
        setor_licitacoes: data.setor_licitacoes,
        setor_juridico: data.setor_juridico,
        setor_financeiro: data.setor_financeiro,
        setor_documentos: data.setor_documentos,
      });
      setAtivo(data.ativo);
      setHasPrefs(true);
    }
    setLoading(false);
  };

  const loadEnvios = async () => {
    const { data } = await supabase
      .from('whatsapp_envios')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (data) setEnvios(data);
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const handleSave = async () => {
    if (!telefone || telefone.replace(/\D/g, '').length < 10) {
      toast.error('Informe um telefone válido com DDD');
      return;
    }

    setSaving(true);
    const payload = {
      user_id: user!.id,
      telefone: telefone.replace(/\D/g, ''),
      ativo,
      ...setores,
    };

    if (hasPrefs) {
      const { error } = await supabase
        .from('whatsapp_preferencias')
        .update(payload)
        .eq('user_id', user!.id);
      if (error) toast.error('Erro ao salvar: ' + error.message);
      else toast.success('Preferências atualizadas!');
    } else {
      const { error } = await supabase
        .from('whatsapp_preferencias')
        .insert(payload);
      if (error) toast.error('Erro ao salvar: ' + error.message);
      else {
        toast.success('Preferências salvas!');
        setHasPrefs(true);
      }
    }
    setSaving(false);
  };

  const handleTestEnvio = async (setor: string) => {
    if (!telefone || telefone.replace(/\D/g, '').length < 10) {
      toast.error('Configure seu telefone antes de testar');
      return;
    }

    setTesting(setor);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-envio', {
        body: {
          telefone: telefone.replace(/\D/g, ''),
          setor,
          user_id: user!.id,
          tipo: 'teste',
        },
      });

      if (error) throw error;
      toast.success(`Envio simulado para setor ${setor}! (modo teste)`);
      loadEnvios();
    } catch (err: any) {
      toast.error('Erro no envio: ' + (err.message || 'Erro desconhecido'));
    }
    setTesting(null);
  };

  const getSetorLabel = (key: string) =>
    SETORES.find((s) => s.key === key || s.label.toLowerCase() === key.toLowerCase())?.label || key;

  const getStatusBadge = (status: string) => {
    if (status === 'simulado')
      return <Badge variant="outline" className="text-xs gap-1"><Info className="w-3 h-3" />Simulado</Badge>;
    if (status === 'enviado')
      return <Badge className="text-xs gap-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/20"><CheckCircle2 className="w-3 h-3" />Enviado</Badge>;
    return <Badge variant="destructive" className="text-xs gap-1"><XCircle className="w-3 h-3" />Erro</Badge>;
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-3xl">
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">WhatsApp por Setor</h1>
              <p className="text-sm text-muted-foreground">Configure alertas por departamento em um único número</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Telefone e status */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Phone className="w-5 h-5 text-accent" />
              <h2 className="text-sm font-semibold">Número do WhatsApp</h2>
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Notificações ativas</span>
                <Switch checked={ativo} onCheckedChange={setAtivo} />
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <Label className="text-xs">Telefone com DDD</Label>
                <Input
                  placeholder="(11) 99999-9999"
                  value={formatPhone(telefone)}
                  onChange={(e) => setTelefone(e.target.value.replace(/\D/g, ''))}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="mt-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
              <p className="text-xs text-amber-600 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 flex-shrink-0" />
                Modo simulado ativo — os envios são registrados mas não enviados de fato. Conecte uma API (Z-API, Evolution) para envios reais.
              </p>
            </div>
          </Card>

          {/* Setores */}
          <Card className="p-5">
            <h2 className="text-sm font-semibold mb-4">Setores de Notificação</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Escolha quais tipos de alerta você deseja receber. Cada setor envia mensagens específicas para sua área.
            </p>
            <div className="grid gap-3">
              {SETORES.map((setor) => (
                <div
                  key={setor.key}
                  className="flex items-center justify-between p-4 rounded-xl border border-border/50 hover:border-border transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg ${setor.bgColor} flex items-center justify-center`}>
                      <setor.icon className={`w-4.5 h-4.5 ${setor.color}`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{setor.label}</p>
                      <p className="text-xs text-muted-foreground">{setor.desc}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7 gap-1"
                      disabled={!setores[setor.key] || testing !== null}
                      onClick={() => handleTestEnvio(setor.label.toLowerCase())}
                    >
                      {testing === setor.label.toLowerCase() ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Send className="w-3 h-3" />
                      )}
                      Testar
                    </Button>
                    <Switch
                      checked={setores[setor.key]}
                      onCheckedChange={(checked) =>
                        setSetores((prev) => ({ ...prev, [setor.key]: checked }))
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Histórico */}
          {envios.length > 0 && (
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-accent" />
                <h2 className="text-sm font-semibold">Últimos Envios</h2>
              </div>
              <div className="space-y-2">
                {envios.map((envio) => (
                  <div
                    key={envio.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {getSetorLabel(envio.setor)}
                        </Badge>
                        {getStatusBadge(envio.status)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {envio.mensagem}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground ml-3 whitespace-nowrap">
                      {new Date(envio.created_at).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Button onClick={handleSave} disabled={saving} className="bg-accent hover:bg-accent/90 text-accent-foreground">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Salvar Configurações
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
