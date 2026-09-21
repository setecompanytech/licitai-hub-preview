import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock, User, Loader2, CheckCircle2, AlertCircle, KeyRound } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import MolduraAcesso from '@/components/auth/MolduraAcesso';

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
/**
 * O login é livre: nome com acento, espaço, ponto — o que o usuário preferir.
 * Ele é guardado inteiro em `profiles.username`, que é o que a entrada no
 * sistema compara. O endereço interno da conta usa uma etiqueta normalizada
 * (ver etiquetaDoLogin na edge function), invisível para quem usa.
 *
 * Só barramos o que impediria a conta de existir: menos de 3 caracteres
 * aproveitáveis, mais de 60, ou "@" — que confundiria login com e-mail na
 * própria tela de entrada, onde o "@" decide entre um e outro.
 */
const REGRA_LOGIN = /^[^@]{3,60}$/;

/** Sobra alguma coisa depois de tirar acento, espaço e pontuação? */
const temBaseAproveitavel = (v: string) =>
  v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]/g, '').length >= 3;

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
    if (!REGRA_LOGIN.test(valor) || !temBaseAproveitavel(valor)) { setLoginLivre(null); return; }

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
      // Via RPC, e não pela tabela: a leitura pública de `empresa_convites`
      // era `USING (true)` e expunha os tokens de todas as empresas a quem
      // tivesse a chave anon. A função exige o token e devolve uma linha só.
      const { data: linhas, error } = await (supabase as any)
        .rpc('convite_por_token', { p_token: token });

      const data = Array.isArray(linhas) ? linhas[0] : linhas;
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

      // A RPC já resolve o nome da empresa — o front não precisa mais do join,
      // que era o que exigia leitura direta da tabela.
      setConvite({ ...data, empresa_nome: data.empresa_nome ?? 'sua empresa' });
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
    if (!REGRA_LOGIN.test(login.trim()) || !temBaseAproveitavel(login)) {
      toast.error('Login inválido. Use de 3 a 60 caracteres, com pelo menos 3 letras ou números, e sem "@".');
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

      toast.success('Conta criada com sucesso! Bem-vindo ao Praefectus.');
      setTimeout(() => navigate('/dashboard'), 1500);
    } finally {
      setSubmitting(false);
    }
  };

  // Régua v3 das telas de acesso: título 24/600 e os avisos de estado com o
  // ícone num ladrilho tingido (trio tint/ink), no lugar do ícone solto.
  const classeTitulo = 'text-3xl font-semibold leading-8 tracking-tight text-foreground';
  const classeAviso = 'flex flex-col items-center gap-3 py-4 text-center';
  const classeLadrilho = 'inline-flex h-14 w-14 items-center justify-center rounded-full [&>svg]:h-7 [&>svg]:w-7';

  return (
    <MolduraAcesso>
        <div>
          {status === 'loading' && (
            /* A espera na forma do formulário que vai chegar (manual §5); o
               texto segue existindo, para o leitor de tela. */
            <div role="status" aria-live="polite" className="space-y-4">
              <span className="sr-only">Validando convite...</span>
              <Skeleton className="h-8 w-3/5" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-11 w-full" />
            </div>
          )}

          {status === 'invalid' && (
            <div className={classeAviso}>
              <span aria-hidden="true" className={`${classeLadrilho} bg-destructive-tint text-destructive-ink`}>
                <AlertCircle />
              </span>
              <h2 className={classeTitulo}>Convite inválido ou expirado</h2>
              <p className="text-sm leading-5 text-muted-foreground">
                Este link de convite não existe ou não é mais válido.
              </p>
              <Button variant="outline" className="w-full" onClick={() => navigate('/auth')}>
                Ir para o login
              </Button>
            </div>
          )}

          {status === 'expired' && (
            <div className={classeAviso}>
              <span aria-hidden="true" className={`${classeLadrilho} bg-destructive-tint text-destructive-ink`}>
                <AlertCircle />
              </span>
              <h2 className={classeTitulo}>Convite expirado</h2>
              <p className="text-sm leading-5 text-muted-foreground">
                Este convite expirou. Solicite ao administrador que envie um novo convite.
              </p>
              <Button variant="outline" className="w-full" onClick={() => navigate('/auth')}>
                Ir para o login
              </Button>
            </div>
          )}

          {status === 'used' && (
            <div className={classeAviso}>
              <span aria-hidden="true" className={`${classeLadrilho} bg-success-tint text-success-ink`}>
                <CheckCircle2 />
              </span>
              <h2 className={classeTitulo}>Convite já utilizado</h2>
              <p className="text-sm leading-5 text-muted-foreground">
                Este convite já foi aceito. Acesse sua conta normalmente.
              </p>
              <Button
                className="w-full"
                onClick={() => navigate('/auth')}
              >
                Ir para o login
              </Button>
            </div>
          )}

          {status === 'success' && (
            <div className={classeAviso}>
              <span aria-hidden="true" className={`${classeLadrilho} bg-success-tint text-success-ink`}>
                <CheckCircle2 />
              </span>
              <h2 className={classeTitulo}>Conta criada!</h2>
              <p className="text-sm leading-5 text-muted-foreground">Redirecionando...</p>
            </div>
          )}

          {status === 'valid' && convite && (
            <>
              <h2 className={classeTitulo}>Criar sua conta</h2>
              {/* Para onde o convite leva, num bloco rebaixado: empresa em
                  destaque, setor como linha secundária. */}
              <div className="mt-4 rounded-lg border border-border bg-secondary px-4 py-3">
                <p className="text-xs leading-4 text-muted-foreground">
                  Você foi convidado para
                </p>
                <p className="mt-0.5 text-base font-semibold leading-5 text-foreground">
                  {convite.empresa_nome}
                </p>
                <p className="mt-0.5 text-sm leading-5 text-muted-foreground">
                  Setor:{' '}
                  <span className="font-medium text-foreground">
                    {equipeLabels[convite.equipe] ?? convite.equipe}
                  </span>
                </p>
              </div>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                {/* Rótulos VISÍVEIS: com só texto de exemplo, o preenchimento
                    automático do navegador apaga a única pista de qual campo é
                    qual — foi assim que um e-mail acabou no campo de login. */}
                <div className="space-y-2">
                  <Label htmlFor="convite-nome">Nome completo</Label>
                  <div className="relative">
                    <User aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="convite-nome"
                      name="nome-completo"
                      type="text"
                      placeholder="Ex.: Maria Souza"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      className="pl-10"
                      required
                      autoFocus
                      autoComplete="name"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="convite-login">Login de acesso</Label>
                  {/* name fora do vocabulário de credencial: com "login" ou
                      "username" o Chrome injeta o e-mail salvo, ignorando o
                      autoComplete="off". */}
                  <div className="relative">
                    <KeyRound aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="convite-login"
                      name="apelido-de-acesso"
                      placeholder="Ex.: COMERCIAL-01 ou Maria Souza"
                      value={login}
                      onChange={(e) => setLogin(e.target.value)}
                      className="pl-10 pr-10"
                      required
                      autoComplete="off"
                      spellCheck={false}
                    />
                    {checandoLogin && (
                      <Loader2 aria-hidden="true" className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                    )}
                    {!checandoLogin && loginLivre === true && (
                      <CheckCircle2 aria-hidden="true" className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-success" />
                    )}
                    {!checandoLogin && loginLivre === false && (
                      <AlertCircle aria-hidden="true" className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-destructive" />
                    )}
                  </div>
                  <p className={`text-xs leading-4 ${loginLivre === false ? 'text-destructive-ink' : 'text-muted-foreground'}`}>
                    {loginLivre === false
                      ? 'Esse login já está em uso. Escolha outro.'
                      : 'É com ele que você vai entrar no sistema. Use o que preferir — nome, apelido ou código — sem "@".'}
                  </p>
                </div>
                <div className="relative">
                  <Lock aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
                  <Lock aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
                  size="lg"
                  className="w-full"
                  disabled={submitting}
                >
                  {submitting && <Loader2 className="animate-spin" aria-hidden="true" />}
                  Criar minha conta
                </Button>
              </form>
            </>
          )}
        </div>
    </MolduraAcesso>
  );
}
