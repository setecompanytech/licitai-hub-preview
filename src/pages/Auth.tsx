import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  Zap, Mail, Lock, User, ArrowRight, Loader2, ShieldCheck, KeyRound, ArrowLeft,
  Phone, Building2, Briefcase, MapPin, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';

const CARGOS = [
  'Diretor(a)', 'Gerente', 'Coordenador(a)', 'Analista', 'Assistente',
  'Pregoeiro(a)', 'Licitante', 'Consultor(a)', 'Empresário(a)', 'Outro'
];

const UFS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA',
  'PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
];

const COMO_CONHECEU = [
  'Google / Busca', 'Indicação', 'Redes Sociais', 'Evento / Feira', 'Outro'
];

const QTD_FUNCIONARIOS = [
  '1 a 5', '6 a 20', '21 a 50', '51 a 100', 'Mais de 100'
];

const LICITACOES_MES = [
  '1 a 5', '6 a 15', '16 a 30', 'Mais de 30', 'Ainda não participo'
];

const FATURAMENTO_ANUAL = [
  'Até R$ 100 mil', 'R$ 100 mil a R$ 500 mil', 'R$ 500 mil a R$ 1 milhão',
  'R$ 1 milhão a R$ 5 milhões', 'Acima de R$ 5 milhões', 'Prefiro não informar'
];

type AuthStep = 'escolha' | 'manual' | 'certificado' | 'signup' | 'forgot';

export default function Auth() {
  const [step, setStep] = useState<AuthStep>('escolha');
  const [email, setEmail] = useState('');
  const [emailConfirm, setEmailConfirm] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [nome, setNome] = useState('');
  const [cargo, setCargo] = useState('');
  const [celular, setCelular] = useState('');
  const [telefoneEmpresarial, setTelefoneEmpresarial] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [uf, setUf] = useState('');
  const [comoConheceu, setComoConheceu] = useState('');
  const [qtdFuncionarios, setQtdFuncionarios] = useState('');
  const [licitacoesMes, setLicitacoesMes] = useState('');
  const [faturamentoAnual, setFaturamentoAnual] = useState('');
  const [aceitaTermos, setAceitaTermos] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user, signIn, signUp, resetPassword } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const formatCnpj = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 14);
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
    if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
    if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      toast.error('E-mail ou senha incorretos');
    } else {
      navigate('/');
    }
  };

  const checkLeakedPassword = async (pwd: string): Promise<boolean> => {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(pwd);
      const hashBuffer = await crypto.subtle.digest('SHA-1', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
      const prefix = hashHex.slice(0, 5);
      const suffix = hashHex.slice(5);
      const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
      const text = await response.text();
      return text.split('\n').some(line => line.startsWith(suffix));
    } catch {
      return false; // fail open if API unreachable
    }
  };

  const validatePasswordStrength = (pwd: string): string | null => {
    if (pwd.length < 8) return 'A senha deve ter no mínimo 8 caracteres';
    if (!/[A-Z]/.test(pwd)) return 'A senha deve conter ao menos uma letra maiúscula';
    if (!/[a-z]/.test(pwd)) return 'A senha deve conter ao menos uma letra minúscula';
    if (!/[0-9]/.test(pwd)) return 'A senha deve conter ao menos um número';
    if (!/[^A-Za-z0-9]/.test(pwd)) return 'A senha deve conter ao menos um caractere especial (!@#$%...)';
    return null;
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) { toast.error('Informe seu nome completo'); return; }
    if (!celular.trim()) { toast.error('Informe seu celular'); return; }
    if (email !== emailConfirm) { toast.error('Os e-mails não conferem'); return; }
    if (password !== passwordConfirm) { toast.error('As senhas não conferem'); return; }
    
    const strengthError = validatePasswordStrength(password);
    if (strengthError) { toast.error(strengthError); return; }
    
    if (!aceitaTermos) { toast.error('Você precisa aceitar os termos de uso'); return; }

    setLoading(true);

    // Check if password has been leaked
    const isLeaked = await checkLeakedPassword(password);
    if (isLeaked) {
      setLoading(false);
      toast.error('Esta senha já foi exposta em vazamentos de dados. Por segurança, escolha outra senha.');
      return;
    }

    const { error } = await signUp(email, password, nome);
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Conta criada! Verifique seu e-mail para confirmar o cadastro.');
      setStep('manual');
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await resetPassword(email);
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('E-mail de recuperação enviado!');
      setStep('manual');
    }
  };

  const backButton = (to: AuthStep = 'escolha') => (
    <button onClick={() => setStep(to)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
      <ArrowLeft className="w-4 h-4" />
      Voltar
    </button>
  );

  // Signup form - professional multi-section layout
  if (step === 'signup') {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="bg-card border-b border-border">
          <div className="max-w-3xl mx-auto px-4 py-6 flex items-center justify-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
              <Zap className="w-5 h-5 text-accent-foreground" />
            </div>
             <span className="text-2xl font-brand font-bold tracking-widest uppercase">
               PRAEFECTUS
             </span>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="bg-card rounded-2xl border border-border shadow-lg p-6 md:p-10">
            <div className="mb-6">
              <button onClick={() => setStep('escolha')} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </button>
              <h1 className="text-2xl font-bold">Cadastre-se</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Experimente todas as ferramentas do Praefectus por <strong className="text-accent">15 dias gratuitos</strong>
              </p>
            </div>

            <form onSubmit={handleSignup} className="space-y-8">
              {/* Seção 1: Dados do contato */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <User className="w-4 h-4 text-accent" />
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Dados do contato</h2>
                </div>
                <Separator className="mb-4" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-medium">Nome completo *</Label>
                    <Input
                      value={nome}
                      onChange={e => setNome(e.target.value)}
                      placeholder="Seu nome completo"
                      className="mt-1.5"
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Cargo</Label>
                    <Select value={cargo} onValueChange={setCargo}>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="Selecionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {CARGOS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Celular *</Label>
                    <Input
                      value={celular}
                      onChange={e => setCelular(formatPhone(e.target.value))}
                      placeholder="(00) 00000-0000"
                      className="mt-1.5"
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Telefone empresarial</Label>
                    <Input
                      value={telefoneEmpresarial}
                      onChange={e => setTelefoneEmpresarial(formatPhone(e.target.value))}
                      placeholder="(00) 0000-0000"
                      className="mt-1.5"
                    />
                  </div>
                </div>
              </section>

              {/* Seção 2: Dados da conta */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Mail className="w-4 h-4 text-accent" />
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Dados da conta</h2>
                </div>
                <Separator className="mb-4" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-medium">E-mail *</Label>
                    <Input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      className="mt-1.5"
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Confirmar e-mail *</Label>
                    <Input
                      type="email"
                      value={emailConfirm}
                      onChange={e => setEmailConfirm(e.target.value)}
                      placeholder="Confirme seu e-mail"
                      className="mt-1.5"
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-xs font-medium">CNPJ</Label>
                    <Input
                      value={cnpj}
                      onChange={e => setCnpj(formatCnpj(e.target.value))}
                      placeholder="00.000.000/0001-00"
                      className="mt-1.5"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">Opcional no cadastro. Você poderá cadastrar empresas depois.</p>
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Escolha uma senha *</Label>
                    <Input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="mt-1.5"
                      required
                      minLength={6}
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Confirmar senha *</Label>
                    <Input
                      type="password"
                      value={passwordConfirm}
                      onChange={e => setPasswordConfirm(e.target.value)}
                      placeholder="Confirme sua senha"
                      className="mt-1.5"
                      required
                      minLength={6}
                    />
                  </div>
                </div>
              </section>

              {/* Seção 3: Configuração do serviço */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="w-4 h-4 text-accent" />
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Configuração do serviço</h2>
                </div>
                <Separator className="mb-4" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-medium">Estado de atuação</Label>
                    <Select value={uf} onValueChange={setUf}>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="Selecionar estado" />
                      </SelectTrigger>
                      <SelectContent>
                        {UFS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </section>

              {/* Seção 4: Informações do perfil */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Briefcase className="w-4 h-4 text-accent" />
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Informações do perfil</h2>
                </div>
                <Separator className="mb-4" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-medium">Como conheceu o Praefectus?</Label>
                    <Select value={comoConheceu} onValueChange={setComoConheceu}>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="Selecionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {COMO_CONHECEU.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Quantidade de funcionários?</Label>
                    <Select value={qtdFuncionarios} onValueChange={setQtdFuncionarios}>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="Selecionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {QTD_FUNCIONARIOS.map(q => <SelectItem key={q} value={q}>{q}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Quantas licitações participa por mês?</Label>
                    <Select value={licitacoesMes} onValueChange={setLicitacoesMes}>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="Selecionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {LICITACOES_MES.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Faturamento anual com licitações?</Label>
                    <Select value={faturamentoAnual} onValueChange={setFaturamentoAnual}>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="Selecionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {FATURAMENTO_ANUAL.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </section>

              {/* Declaração de Consentimento — LGPD */}
              <div className="flex items-start gap-3 p-5 rounded-xl bg-muted/50 border border-border">
                <Checkbox
                  id="termos"
                  checked={aceitaTermos}
                  onCheckedChange={(v) => setAceitaTermos(v === true)}
                  className="mt-0.5"
                />
                <label htmlFor="termos" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                  <strong className="text-foreground text-sm block mb-1">Declaração de Consentimento</strong>
                  Ao confirmar o cadastro, <strong>DECLARO</strong>, para os devidos fins de direito, que li, compreendi e aceito integralmente os{' '}
                  <a href="/termos-de-uso" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline font-semibold">Termos de Uso</a>{' '}
                  e a{' '}
                  <a href="/politica-de-privacidade" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline font-semibold">Política de Privacidade</a>{' '}
                  da plataforma Praefectus, manifestando consentimento livre, informado e inequívoco, nos termos do{' '}
                  <strong>Art. 7º, inciso I, da Lei nº 13.709/2018 (LGPD)</strong>, para o tratamento de meus dados pessoais nas finalidades descritas nos referidos documentos.
                </label>
              </div>

              {/* Submit */}
              <Button
                type="submit"
                className="w-full h-12 text-base bg-accent hover:bg-accent/90 text-accent-foreground"
                disabled={loading || !aceitaTermos}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <ChevronRight className="w-5 h-5 mr-2" />}
                Enviar cadastro
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Já tem conta?{' '}
                <button type="button" onClick={() => setStep('manual')} className="text-accent hover:underline font-medium">
                  Fazer login
                </button>
              </p>
            </form>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6 pb-8">
            Sistema de Gestão de Licitações Públicas com IA
          </p>
        </div>
      </div>
    );
  }

  // Login and other steps
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--gradient-dark)' }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center">
            <Zap className="w-6 h-6 text-accent-foreground" />
          </div>
           <span className="text-3xl font-brand font-bold tracking-widest uppercase text-white">
             PRAEFECTUS
           </span>
        </div>

        <div className="bg-card rounded-2xl border border-border/50 shadow-2xl p-8">

          {/* ===== STEP: ESCOLHA ===== */}
          {step === 'escolha' && (
            <>
              <h2 className="text-xl font-bold text-center mb-1">Identifique-se</h2>
              <p className="text-sm text-muted-foreground text-center mb-8">
                Escolha como deseja acessar o sistema
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => setStep('manual')}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-border/50 hover:border-accent/50 hover:bg-accent/5 transition-all group text-left"
                >
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/15 transition-colors">
                    <KeyRound className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">Login e Senha</p>
                    <p className="text-xs text-muted-foreground">Acesse com seu e-mail e senha cadastrados</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
                </button>

                <button
                  onClick={() => setStep('certificado')}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-border/50 hover:border-accent/50 hover:bg-accent/5 transition-all group text-left"
                >
                  <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0 group-hover:bg-accent/15 transition-colors">
                    <ShieldCheck className="w-6 h-6 text-accent" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">Certificado Digital</p>
                    <p className="text-xs text-muted-foreground">Acesse com e-CNPJ ou e-CPF (A1/A3)</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
                </button>
              </div>

              <div className="mt-8 pt-5 border-t border-border/50 text-center">
                <p className="text-sm text-muted-foreground">
                  Não tem conta?{' '}
                  <button onClick={() => setStep('signup')} className="text-accent hover:underline font-medium">
                    Cadastre-se
                  </button>
                </p>
              </div>
            </>
          )}

          {/* ===== STEP: LOGIN MANUAL ===== */}
          {step === 'manual' && (
            <>
              {backButton()}
              <div className="flex items-center gap-2 mb-5">
                <KeyRound className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold">Acesso com Login e Senha</h2>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input type="email" placeholder="Seu e-mail" value={email} onChange={e => setEmail(e.target.value)} className="pl-10" required />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input type="password" placeholder="Sua senha" value={password} onChange={e => setPassword(e.target.value)} className="pl-10" required minLength={6} />
                </div>
                <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                  Entrar
                </Button>
              </form>

              <div className="mt-4 text-center">
                <button onClick={() => setStep('forgot')} className="text-sm text-accent hover:underline">
                  Esqueceu a senha?
                </button>
              </div>
            </>
          )}

          {/* ===== STEP: CERTIFICADO DIGITAL ===== */}
          {step === 'certificado' && (
            <>
              {backButton()}
              <div className="flex items-center gap-2 mb-5">
                <ShieldCheck className="w-5 h-5 text-accent" />
                <h2 className="text-lg font-bold">Acesso com Certificado Digital</h2>
              </div>

              <div className="rounded-lg bg-muted/50 border border-border/50 p-4 mb-5">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Para acessar via certificado digital, é necessário ter uma conta vinculada.
                  Se é seu primeiro acesso, <button onClick={() => setStep('signup')} className="text-accent hover:underline font-medium">crie sua conta</button> primeiro
                  e depois cadastre seus certificados na área de <strong>Empresas</strong>.
                </p>
              </div>

              <div className="space-y-3">
                <Button onClick={() => setStep('manual')} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                  <KeyRound className="w-4 h-4 mr-2" />
                  Entrar com Login e Senha
                </Button>
                <Button onClick={() => setStep('signup')} variant="outline" className="w-full">
                  <User className="w-4 h-4 mr-2" />
                  Criar conta
                </Button>
              </div>

              <div className="mt-5 p-3 rounded-lg bg-accent/5 border border-accent/10">
                <p className="text-[11px] text-muted-foreground">
                  <strong className="text-foreground">Certificados aceitos:</strong> e-CNPJ A1, e-CNPJ A3, e-CPF A1, e-CPF A3 nos formatos .pfx, .p12, .cer, .crt e .pem.
                </p>
              </div>
            </>
          )}

          {/* ===== STEP: ESQUECEU SENHA ===== */}
          {step === 'forgot' && (
            <>
              {backButton('manual')}
              <h2 className="text-lg font-bold mb-1">Recuperar senha</h2>
              <p className="text-sm text-muted-foreground mb-5">Informe seu e-mail para receber o link de recuperação</p>

              <form onSubmit={handleForgot} className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input type="email" placeholder="Seu e-mail" value={email} onChange={e => setEmail(e.target.value)} className="pl-10" required />
                </div>
                <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                  Enviar link
                </Button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Sistema de Gestão de Licitações Públicas com IA
        </p>
      </div>
    </div>
  );
}
