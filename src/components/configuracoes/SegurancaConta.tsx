import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Shield, Key, Eye, Clock, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import MfaEnrollment from './MfaEnrollment';
import SolicitacaoLgpd from './SolicitacaoLgpd';
import { toast } from 'sonner';

export default function SegurancaConta() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [recentLogins, setRecentLogins] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  useEffect(() => {
    if (!user) return;
    // Load recent audit logs for auth events
    const loadLogs = async () => {
      const { data } = await supabase
        .from('audit_log_lances')
        .select('*')
        .eq('user_id', user.id)
        .in('evento', ['login', 'logout', 'password_change', 'session_start'])
        .order('created_at', { ascending: false })
        .limit(20);
      setRecentLogins(data || []);
      setLoadingLogs(false);
    };
    loadLogs();
  }, [user]);

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 8) {
      toast.error('A nova senha deve ter no mínimo 8 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('As senhas não coincidem.');
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Senha alterada com sucesso.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao alterar senha.');
    } finally {
      setChangingPassword(false);
    }
  };

  const passwordStrength = (pwd: string) => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    if (score <= 2) return { label: 'Fraca', color: 'text-destructive' };
    if (score <= 3) return { label: 'Média', color: 'text-warning' };
    return { label: 'Forte', color: 'text-success' };
  };

  const strength = passwordStrength(newPassword);

  return (
    <div className="space-y-6">
      {/* Alterar Senha */}
      <section className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Key className="w-5 h-5 text-accent" />
          <h2 className="text-sm font-semibold">Alterar Senha</h2>
        </div>

        <div className="space-y-3 max-w-md">
          <div>
            <Label className="text-xs">Nova Senha</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              maxLength={128}
              className="mt-1"
            />
            {newPassword && (
              <p className={`text-xs mt-1 ${strength.color}`}>
                Força: {strength.label}
              </p>
            )}
          </div>
          <div>
            <Label className="text-xs">Confirmar Nova Senha</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a nova senha"
              maxLength={128}
              className="mt-1"
            />
          </div>
          <Button
            onClick={handleChangePassword}
            disabled={changingPassword || !newPassword}
            className="bg-accent hover:bg-accent/90 text-accent-foreground"
            size="sm"
          >
            {changingPassword ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Key className="w-4 h-4 mr-2" />}
            Alterar Senha
          </Button>
        </div>

        <div className="mt-4 pt-4 border-t border-border/30">
          <p className="text-xs text-muted-foreground">
            <strong>Requisitos de senha:</strong> Mínimo de 8 caracteres. Recomendamos combinar letras maiúsculas, minúsculas, números e caracteres especiais.
          </p>
        </div>
      </section>

      {/* Informações de Segurança */}
      <section className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-accent" />
          <h2 className="text-sm font-semibold">Informações de Segurança</h2>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between py-2 border-b border-border/20">
            <span className="text-muted-foreground">E-mail da conta</span>
            <span className="font-medium">{user?.email}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border/20">
            <span className="text-muted-foreground">E-mail confirmado</span>
            <Badge variant="outline" className={user?.email_confirmed_at ? 'bg-success/10 text-success border-success/20' : 'bg-warning/10 text-warning border-warning/20'}>
              {user?.email_confirmed_at ? <><CheckCircle2 className="w-3 h-3 mr-1" /> Verificado</> : <><AlertTriangle className="w-3 h-3 mr-1" /> Pendente</>}
            </Badge>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border/20">
            <span className="text-muted-foreground">Último login</span>
            <span className="font-medium text-xs">{user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString('pt-BR') : '—'}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border/20">
            <span className="text-muted-foreground">Conta criada em</span>
            <span className="font-medium text-xs">{user?.created_at ? new Date(user.created_at).toLocaleString('pt-BR') : '—'}</span>
          </div>
        </div>
      </section>

      {/* MFA */}
      <MfaEnrollment />

      {/* LGPD */}
      <SolicitacaoLgpd />
      </section>

      {/* Log de Atividades de Autenticação */}
      <section className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Eye className="w-5 h-5 text-accent" />
          <h2 className="text-sm font-semibold">Atividades Recentes de Autenticação</h2>
        </div>

        {loadingLogs ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : recentLogins.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4">Nenhum registro de atividade encontrado.</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {recentLogins.map((log) => (
              <div key={log.id} className="flex items-center justify-between text-xs py-2 border-b border-border/10">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{log.evento}</Badge>
                  {log.ip_address && <span className="text-muted-foreground">IP: {log.ip_address}</span>}
                </div>
                <span className="text-muted-foreground">{new Date(log.created_at).toLocaleString('pt-BR')}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
