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
import ListaDeCampos from '@/components/gestao/ListaDeCampos';
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
    // Tintas `-ink`: legíveis como texto sobre o branco do cartão.
    if (score <= 2) return { label: 'Fraca', color: 'text-destructive-ink' };
    if (score <= 3) return { label: 'Média', color: 'text-warning-ink' };
    return { label: 'Forte', color: 'text-success-ink' };
  };

  const strength = passwordStrength(newPassword);

  return (
    <div className="space-y-6">
      {/* Alterar Senha */}
      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Key className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-lg font-semibold leading-6 text-foreground">Alterar Senha</h2>
        </div>

        <div className="max-w-md space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nova-senha">Nova Senha</Label>
            <Input
              id="nova-senha"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              maxLength={128}
            />
            {newPassword && (
              <p className={`text-xs ${strength.color}`}>
                Força: {strength.label}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirmar-senha">Confirmar Nova Senha</Label>
            <Input
              id="confirmar-senha"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a nova senha"
              maxLength={128}
            />
          </div>
          <div className="flex justify-end">
            <Button
              onClick={handleChangePassword}
              disabled={changingPassword || !newPassword}
            >
              {changingPassword ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Key aria-hidden="true" />}
              Alterar Senha
            </Button>
          </div>
        </div>

        <div className="mt-4 border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            <strong>Requisitos de senha:</strong> Mínimo de 8 caracteres. Recomendamos combinar letras maiúsculas, minúsculas, números e caracteres especiais.
          </p>
        </div>
      </section>

      {/* Informações de Segurança — ficha rótulo/valor do módulo Gestão. */}
      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="mb-2 flex items-center gap-2">
          <Shield className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-lg font-semibold leading-6 text-foreground">Informações de Segurança</h2>
        </div>

        <ListaDeCampos
          campos={[
            { rotulo: 'E-mail da conta', valor: user?.email },
            {
              rotulo: 'E-mail confirmado',
              valor: (
                <Badge variant={user?.email_confirmed_at ? 'success' : 'warning'} className="gap-1">
                  {user?.email_confirmed_at
                    ? <><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Verificado</>
                    : <><AlertTriangle className="h-4 w-4" aria-hidden="true" /> Pendente</>}
                </Badge>
              ),
            },
            { rotulo: 'Último login', valor: user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString('pt-BR') : '—', numerico: true },
            { rotulo: 'Conta criada em', valor: user?.created_at ? new Date(user.created_at).toLocaleString('pt-BR') : '—', numerico: true },
          ]}
        />
      </section>

      {/* MFA */}
      <MfaEnrollment />

      {/* LGPD */}
      <SolicitacaoLgpd />

      {/* Log de Atividades de Autenticação */}
      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Eye className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-lg font-semibold leading-6 text-foreground">Atividades Recentes de Autenticação</h2>
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
          <div className="max-h-64 divide-y divide-border overflow-y-auto">
            {recentLogins.map((log) => (
              <div key={log.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
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
