import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, User, Mail, AtSign, Info } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export default function MeuPerfilModal({ open, onOpenChange }: Props) {
  const { user } = useAuth();

  const [nome, setNome] = useState('');
  const [username, setUsername] = useState('');
  const [savingNome, setSavingNome] = useState(false);
  const [savingUser, setSavingUser] = useState(false);

  const email = user?.email ?? '';
  const initials = nome
    ? nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : email.slice(0, 2).toUpperCase();

  useEffect(() => {
    if (!open || !user) return;
    setNome(user.user_metadata?.nome_completo ?? '');
    supabase
      .from('profiles')
      .select('username')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => { if ((data as any)?.username) setUsername((data as any).username); });
  }, [open, user]);

  async function handleSalvarNome() {
    if (!user) return;
    setSavingNome(true);
    const { error } = await supabase.auth.updateUser({ data: { nome_completo: nome.trim() } });
    setSavingNome(false);
    if (error) toast.error('Erro ao atualizar nome');
    else toast.success('Nome atualizado com sucesso!');
  }

  async function handleSalvarUsername() {
    if (!user) return;
    const u = username.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');
    if (!u) { toast.error('Informe um nome de usuário válido'); return; }
    setSavingUser(true);
    const { error } = await supabase.from('profiles').update({ username: u } as never).eq('user_id', user.id);
    setSavingUser(false);
    if (error) {
      toast.error(
        error.message.includes('unique')
          ? 'Este nome de usuário já está em uso. Escolha outro.'
          : error.message
      );
    } else {
      setUsername(u);
      toast.success('Nome de usuário atualizado!');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-4 h-4" /> Meu Perfil
          </DialogTitle>
        </DialogHeader>

        {/* Avatar */}
        <div className="flex justify-center pt-1 pb-3">
          <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-2xl font-bold">
            {initials}
          </div>
        </div>

        <div className="space-y-5">
          {/* Nome */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-sm font-medium">
              <User className="w-3.5 h-3.5 text-muted-foreground" /> Nome completo
            </Label>
            <div className="flex gap-2">
              <Input
                value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder="Seu nome completo"
                onKeyDown={e => e.key === 'Enter' && handleSalvarNome()}
              />
              <Button size="sm" onClick={handleSalvarNome} disabled={savingNome || !nome.trim()}>
                {savingNome ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
              </Button>
            </div>
          </div>

          {/* E-mail (read-only) */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-sm font-medium">
              <Mail className="w-3.5 h-3.5 text-muted-foreground" /> E-mail
            </Label>
            <Input value={email} readOnly className="bg-muted/40 cursor-default select-all" />
            <p className="text-xs text-muted-foreground">
              Para alterar o e-mail acesse Configurações → Segurança.
            </p>
          </div>

          {/* Username */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-sm font-medium">
              <AtSign className="w-3.5 h-3.5 text-muted-foreground" /> Nome de usuário
            </Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm select-none">@</span>
                <Input
                  value={username}
                  onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))}
                  placeholder="seu.usuario"
                  className="pl-7"
                  onKeyDown={e => e.key === 'Enter' && handleSalvarUsername()}
                />
              </div>
              <Button size="sm" onClick={handleSalvarUsername} disabled={savingUser || !username.trim()}>
                {savingUser ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
              </Button>
            </div>
            <div className="flex items-start gap-1.5 rounded-lg bg-muted/50 px-3 py-2">
              <Info className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Você pode usar <strong>@{username || 'seu.usuario'}</strong> ou seu e-mail para entrar no sistema.
                Apenas letras minúsculas, números, <code>_</code>, <code>.</code> e <code>-</code> são permitidos.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
