import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Send, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function BoletimConfig() {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [config, setConfig] = useState({
    boletim_manha: true,
    boletim_meiodia: true,
    boletim_tarde: true,
    notificacao_push: true,
  });

  useEffect(() => {
    if (user) loadConfig();
  }, [user]);

  const loadConfig = async () => {
    const { data } = await supabase
      .from('boletim_preferencias')
      .select('*')
      .eq('user_id', user!.id)
      .maybeSingle();

    if (data) {
      setConfig({
        boletim_manha: data.boletim_manha,
        boletim_meiodia: data.boletim_meiodia,
        boletim_tarde: data.boletim_tarde,
        notificacao_push: data.notificacao_push,
      });
    }
  };

  const saveConfig = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from('boletim_preferencias')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('boletim_preferencias')
          .update({ ...config })
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('boletim_preferencias')
          .insert({ user_id: user.id, email: user.email!, ...config });
      }
      toast.success('Preferências salvas com sucesso!');
    } catch {
      toast.error('Erro ao salvar preferências');
    } finally {
      setSaving(false);
    }
  };

  const enviarTeste = async (tipo: 'manha' | 'meiodia' | 'tarde') => {
    if (!user) return;
    setSending(tipo);
    try {
      // Ensure preferences exist first
      const { data: existing } = await supabase
        .from('boletim_preferencias')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!existing) {
        await supabase
          .from('boletim_preferencias')
          .insert({ user_id: user.id, email: user.email!, ...config });
      }

      const { data, error } = await supabase.functions.invoke('envio-boletim', {
        body: { tipo, user_id: user.id },
      });

      if (error) throw error;
      toast.success(`Boletim de teste enviado para ${user.email}!`);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar boletim de teste');
    } finally {
      setSending(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-4">
        <h3 className="text-sm font-semibold">Configuração de Notificações por E-mail</h3>
        <p className="text-xs text-muted-foreground">
          Configure quais boletins deseja receber no e-mail <strong>{user?.email}</strong>
        </p>

        <div className="space-y-3">
          {[
            { key: 'boletim_manha' as const, label: 'Boletim da manhã (08:00)', desc: 'Novas licitações publicadas', tipo: 'manha' as const },
            { key: 'boletim_meiodia' as const, label: 'Boletim do meio-dia (12:00)', desc: 'Alterações, suspensões e cancelamentos', tipo: 'meiodia' as const },
            { key: 'boletim_tarde' as const, label: 'Boletim da tarde (17:00)', desc: 'Resultados e homologações do dia', tipo: 'tarde' as const },
            { key: 'notificacao_push' as const, label: 'Notificações push', desc: 'Alertas em tempo real no navegador', tipo: null },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="flex-1">
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <div className="flex items-center gap-2">
                {item.tipo && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs h-7 px-2"
                    disabled={sending !== null}
                    onClick={() => enviarTeste(item.tipo!)}
                  >
                    {sending === item.tipo ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Send className="w-3 h-3" />
                    )}
                    <span className="ml-1">Teste</span>
                  </Button>
                )}
                <Switch
                  checked={config[item.key]}
                  onCheckedChange={(v) => setConfig({ ...config, [item.key]: v })}
                />
              </div>
            </div>
          ))}
        </div>

        <Button
          className="bg-accent hover:bg-accent/90 text-accent-foreground"
          onClick={saveConfig}
          disabled={saving}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Salvar Configuração
        </Button>
      </Card>
    </div>
  );
}
