import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock, User, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import PraefectusLogo from '@/components/shared/PraefectusLogo';

const equipeLabels: Record<string, string> = {
  geral: 'Geral',
  financeiro: 'Financeiro',
  comercial: 'Comercial',
  logistica: 'Logística',
  juridico: 'Jurídico',
  contabil: 'Contábil',
  licitacoes: 'Licitações',
  documentos: 'Documentos',
};

type ConviteStatus = 'loading' | 'invalid' | 'expired' | 'used' | 'valid' | 'success';

interface ConviteData {
  id: string;
  equipe: string;
  papel: string;
  email_setor: string;
  empresa_id: string;
  expires_at: string;
  accepted_at: string | null;
  usos: number | null;
  max_usos: number | null;
  empresa_nome: string;
}

/** Mesma regra da edge function — as duas precisam recusar o mesmo. */
const REGRA_LOGIN = /^[A-Za-z0-9._-]{3,30}$/;

/** Erro da edge function vem no corpo; o `message` do supabase-js é genérico. */
async function mensagemDoErro(error: unknown, doCorpo?: string): Promise<string> {
  if (doCorpo) return doCorpo;
  const ctx = (error as { context?: { response?: Response } })?.context;
  if (ctx?.response) {
    const body = await ctx.response.clone().json().catch(() => null);
    if (body?.error) return String(body.error);
  }
  return (error as Error)?.message || 'Erro ao criar o acesso.';
}

export default function AceitarConvite() {
  const [status, setStatus] = useState<ConviteStatus>('loading');
  const [convite, setConvite] = useState<ConviteData | null>(null);
  const [nome, setNome] = useState('');
  const [login, setLogin] = useState('');
  /** null = ainda não checado; a checagem é contra a RPC, liberada para anon. */
  const [loginLivre, setLoginLivre] = useState<boolean | null>(null);
  const [checandoLogin, setChecandoLogin] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  // Disponibilidade do login enquanto digita. Recusar antes do envio é melhor
  // que recusar depois — o colaborador já teria escolhido a senha.
  useEffect(() => {
    const valor = login.trim();
    if (!REGRA_LOGIN.test(valor)) { setLoginLivre(null); return; }

    let cancelado = false;
    setChecandoLogin(true);
    const t = setTimeout(async () => {
      // Cast até o types.ts ser regenerado com a migration 20260809000001
      const { data, error } = await supabase.rpc(
        'username_disponivel' as never,
        { p_username: valor } as never,
      );
      if (cancelado) return;
      setLoginLivre(error ? null : Boolean(data));
      setChecandoLogin(false);
    }, 450);

    return () => { cancelado = true; clearTimeout(t); setChecandoLogin(false); };
  }, [login]);

  useEffect(() => {
    const token = new URL(window.location.href).searchParams.get('token');
    if (!token) {
      setStatus('invalid');
      return;
    }

    const fetchConvite = async () => {
      const { data, error } = await (supabase as any)
        .from('empresa_convites')
        .select('id, equipe, papel, email_setor, empresa_id, expires_at, accepted_at, usos, max_usos, empresas(nome_fantasia, razao_social)')
        .eq('token', token)
        .maybeSingle();

      if (error || !data) {
        setStatus('invalid');
        return;
      }

      // `accepted_at` NÃO invalida mais o convite: o link é do setor inteiro e
      // vários colaboradores criam acesso com ele. Quem limita é `max_usos`,
      // conferido na edge function, que é quem sabe o número real de usos.
      if (data.max_usos !== null && (data.usos ?? 0) >= data.max_usos) {
        setStatus('used');
        return;
      }

      if (new Date(data.expires_at) < new Date()) {
        setStatus('expired');
        return;
      }

      const emp = data.empresas as { nome_fantasia?: string | null; razao_social?: string | null } | null;
      const empresa_nome = emp?.nome_fantasia || emp?.razao_social || 'sua empresa';

      setConvite({ ...data, empresa_nome });
      // O e-mail do setor NÃO vai mais para o formulário. Quando ia, o primeiro
      // colaborador criava a conta com o endereço compartilhado e o queimava
      // como conta individual — ninguém mais do setor conseguia se cadastrar.
      setStatus('valid');
    };

    fetchConvite();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nome.trim()) {
      toast.error('Informe seu nome completo');
      return;
    }
    if (!REGRA_LOGIN.test(login.trim())) {
      toast.error('Login inválido. Use de 3 a 30 caracteres: letras, números, ponto, hífen ou sublinhado.');
      return;
    }
    if (loginLivre === false) {
      toast.error('Esse login já está em uso. Escolha outro.');
      return;
    }
    if (password.length < 8) {
      toast.error('A senha deve ter pelo menos 8 caracteres');
      return;
    }
    if (password !== confirm) {
      toast.error('As senhas não coincidem');
      return;
    }

    setSubmitting(true);
    try {
      const token = new URL(window.location.href).searchParams.get('token')!;

      // A conta é criada NA EDGE FUNCTION, não aqui: só ela pode usar
      // `email_confirm`, e o e-mail sintético nunca receberia a confirmação.
      const { data, error: acceptError } = await supabase.functions.invoke('accept-sector-invite', {
        body: { token, login: login.trim(), senha: password, nome: nome.trim() },
      });

      if (acceptError || !data?.success) {
        toast.error(await mensagemDoErro(acceptError, data?.error));
        return;
      }

      // A function devolve o e-mail sintético; o colaborador nunca precisa vê-lo
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password,
      });

      setStatus('success');
      if (signInError) {
        toast.success('Acesso criado! Entre com o seu login e senha.');
        setTimeout(() => navigate('/auth'), 1800);
        return;
      }

      toast.success('Conta criada com sucesso! Bem-vindo ao PRAEFECTUS.');
      setTimeout(() => navigate('/dashboard'), 1500);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--gradient-dark)' }}>
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <PraefectusLogo size="xl" variant="light" />
        </div>

        <div className="bg-card rounded-2xl border border-border/50 shadow-2xl p-8">
          {status === 'loading' && (
            <div className="text-center space-y-3 py-6">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Validando convite...</p>
            </div>
          )}

          {status === 'invalid' && (
            <div className="text-center space-y-4 py-6">
              <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
              <h2 className="text-xl font-bold">Convite inválido ou expirado</h2>
              <p className="text-sm text-muted-foreground">
                Este link de convite não existe ou não é mais válido.
              </p>
              <Button variant="outline" className="w-full" onClick={() => navigate('/auth')}>
                Ir para o login
              </Button>
            </div>
          )}

          {status === 'expired' && (
            <div className="text-center space-y-4 py-6">
              <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
              <h2 className="text-xl font-bold">Convite expirado</h2>
              <p className="text-sm text-muted-foreground">
                Este convite expirou. Solicite ao administrador que envie um novo convite.
              </p>
              <Button variant="outline" className="w-full" onClick={() => navigate('/auth')}>
                Ir para o login
              </Button>
            </div>
          )}

          {status === 'used' && (
            <div className="text-center space-y-4 py-6">
              <CheckCircle2 className="w-12 h-12 text-success mx-auto" />
              <h2 className="text-xl font-bold">Convite já utilizado</h2>
              <p className="text-sm text-muted-foreground">
                Este convite já foi aceito. Acesse sua conta normalmente.
              </p>
              <Button
                className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
                onClick={() => navigate('/auth')}
              >
                Ir para o login
              </Button>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center space-y-3 py-6">
              <CheckCircle2 className="w-12 h-12 text-success mx-auto" />
              <h2 className="text-xl font-bold">Conta criada!</h2>
              <p className="text-sm text-muted-foreground">Redirecionando...</p>
            </div>
          )}

          {status === 'valid' && convite && (
            <>
              <h2 className="text-xl font-bold text-center mb-2">Criar sua conta</h2>
              <p className="text-xs text-muted-foreground text-center mb-1">
                Você foi convidado para
              </p>
              <p className="text-sm font-semibold text-center mb-1">
                {convite.empresa_nome}
              </p>
              <p className="text-xs text-muted-foreground text-center mb-6">
                Setor:{' '}
                <span className="font-medium">
                  {equipeLabels[convite.equipe] ?? convite.equipe}
                </span>
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Seu nome completo"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="pl-10"
                    required
                    autoFocus
                  />
                </div>
                <div className="space-y-1">
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Crie seu login de acesso (ex.: COMERCIAL-01)"
                      value={login}
                      onChange={(e) => setLogin(e.target.value)}
                      className="pl-10 pr-10"
                      required
                      autoComplete="off"
                      spellCheck={false}
                    />
                    {checandoLogin && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                    )}
                    {!checandoLogin && loginLivre === true && (
                      <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-success" />
                    )}
                    {!checandoLogin && loginLivre === false && (
                      <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-destructive" />
                    )}
                  </div>
                  <p className={`text-xs ${loginLivre === false ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {loginLivre === false
                      ? 'Esse login já está em uso. Escolha outro.'
                      : 'É com ele que você vai entrar no sistema. De 3 a 30 caracteres: letras, números, ponto, hífen ou sublinhado.'}
                  </p>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder="Criar senha (mín. 8 caracteres)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                    minLength={8}
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder="Confirmar senha"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="pl-10"
                    required
                    minLength={8}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
                  disabled={submitting}
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Criar minha conta
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
