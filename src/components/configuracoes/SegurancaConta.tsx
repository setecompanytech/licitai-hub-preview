import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Shield, Key, Eye, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import MfaEnrollment from './MfaEnrollment';
import SolicitacaoLgpd from './SolicitacaoLgpd';
import EstadoVazio from '@/components/shared/EstadoVazio';
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
      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Key className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-foreground">Alterar Senha</h2>
        </div>

        <div className="max-w-md space-y-4">
          <div>
            <Label htmlFor="nova-senha">Nova Senha</Label>
            <Input
              id="nova-senha"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              maxLength={128}
              className="mt-1"
            />
            {newPassword && (
              <p className={`mt-1 text-xs ${strength.color}`}>
                Força: {strength.label}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="confirmar-senha">Confirmar Nova Senha</Label>
            <Input
              id="confirmar-senha"
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
          >
            {changingPassword ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Key aria-hidden="true" />}
            Alterar Senha
          </Button>
        </div>

        <div className="mt-4 border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            <strong>Requisitos de senha:</strong> Mínimo de 8 caracteres. Recomendamos combinar letras maiúsculas, minúsculas, números e caracteres especiais.
          </p>
        </div>
      </section>

      {/* Informações de Segurança */}
      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Shield className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-foreground">Informações de Segurança</h2>
        </div>

        <dl className="text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-3">
            <dt className="text-muted-foreground">E-mail da conta</dt>
            <dd className="font-medium text-foreground">{user?.email}</dd>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-3">
            <dt className="text-muted-foreground">E-mail confirmado</dt>
            <dd>
              <Badge variant={user?.email_confirmed_at ? 'success' : 'warning'} className="gap-1">
                {user?.email_confirmed_at
                  ? <><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Verificado</>
                  : <><AlertTriangle className="h-4 w-4" aria-hidden="true" /> Pendente</>}
              </Badge>
            </dd>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-3">
            <dt className="text-muted-foreground">Último login</dt>
            <dd className="text-xs font-medium text-foreground">{user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString('pt-BR') : '—'}</dd>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 py-3">
            <dt className="text-muted-foreground">Conta criada em</dt>
            <dd className="text-xs font-medium text-foreground">{user?.created_at ? new Date(user.created_at).toLocaleString('pt-BR') : '—'}</dd>
          </div>
        </dl>
      </section>

      {/* MFA */}
      <MfaEnrollment />

      {/* LGPD */}
      <SolicitacaoLgpd />

      {/* Log de Atividades de Autenticação */}
      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Eye className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-foreground">Atividades Recentes de Autenticação</h2>
        </div>

        {loadingLogs ? (
          <div role="status" aria-busy="true" className="space-y-2">
            <span className="sr-only">Carregando atividades</span>
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : recentLogins.length === 0 ? (
          <EstadoVazio
            tamanho="compacto"
            icone={<Eye aria-hidden="true" />}
            titulo="Nenhum registro de atividade"
            descricao="Os acessos e eventos de autenticação da sua conta aparecem aqui assim que acontecerem."
          />
        ) : (
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {recentLogins.map((log) => (
              <div key={log.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="muted">{log.evento}</Badge>
                  {log.ip_address && <span className="text-muted-foreground">IP: {log.ip_address}</span>}
                </div>
                <span className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString('pt-BR')}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
