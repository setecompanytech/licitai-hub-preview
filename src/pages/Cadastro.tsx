import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, User, Building2, Settings, BarChart3, Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import PraefectusLogo from '@/components/shared/PraefectusLogo';

const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];

const CARGOS = ['Sócio / Proprietário', 'Diretor(a)', 'Gerente', 'Analista de licitações', 'Pregoeiro(a)', 'Consultor(a)', 'Outro'];

const COMO_CONHECEU = ['Google', 'Indicação', 'Redes sociais', 'LinkedIn', 'Evento / Feira', 'Outro'];

const QTD_FUNCIONARIOS = ['1-5', '6-15', '16-50', '51-200', '200+'];

const LICITACOES_MES = ['1-5', '6-15', '16-30', '31-50', '50+'];

const FATURAMENTO_ANUAL = ['Até R$ 100 mil', 'R$ 100 mil – R$ 500 mil', 'R$ 500 mil – R$ 2 milhões', 'R$ 2 milhões – R$ 10 milhões', 'Acima de R$ 10 milhões'];

const STEPS = [
  { icon: User, label: 'Dados do contato' },
  { icon: Building2, label: 'Dados da conta' },
  { icon: Settings, label: 'Configuração' },
  { icon: BarChart3, label: 'Perfil' },
];

export default function Cadastro() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const planoSlug = params.get('plano') || '';

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Step 1 — Contact
  const [nome, setNome] = useState('');
  const [cargo, setCargo] = useState('');
  const [celular, setCelular] = useState('');
  const [telefone, setTelefone] = useState('');

  // Step 2 — Account
  const [email, setEmail] = useState('');
  const [emailConfirm, setEmailConfirm] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [senha, setSenha] = useState('');
  const [senhaConfirm, setSenhaConfirm] = useState('');

  // Step 3 — Service config
  const [ufsInteresse, setUfsInteresse] = useState<string[]>([]);

  // Step 4 — Profile
  const [comoConheceu, setComoConheceu] = useState('');
  const [qtdFuncionarios, setQtdFuncionarios] = useState('');
  const [licitacoesMes, setLicitacoesMes] = useState('');
  const [faturamentoAnual, setFaturamentoAnual] = useState('');

  const toggleUf = (uf: string) => {
    setUfsInteresse(prev => prev.includes(uf) ? prev.filter(u => u !== uf) : [...prev, uf]);
  };

  const canNext = () => {
    switch (step) {
      case 0: return nome.trim().length >= 3 && cargo;
      case 1: return email && email === emailConfirm && cnpj.length >= 14 && senha.length >= 6 && senha === senhaConfirm;
      case 2: return ufsInteresse.length > 0;
      case 3: return true;
      default: return false;
    }
  };

  const handleSubmit = async () => {
    if (senha !== senhaConfirm) { toast.error('As senhas não coincidem'); return; }
    if (email !== emailConfirm) { toast.error('Os e-mails não coincidem'); return; }

    setLoading(true);
    try {
      const { error } = await signUp(email, senha, nome);
      if (error) { toast.error(error.message || 'Erro ao criar conta'); setLoading(false); return; }

      // Save lead metadata
      await supabase.from('leads').insert({
        nome,
        email,
        telefone: celular || telefone || null,
        empresa: cnpj,
        mensagem: `Plano: ${planoSlug} | Cargo: ${cargo} | Como conheceu: ${comoConheceu} | Funcionários: ${qtdFuncionarios} | Licitações/mês: ${licitacoesMes} | Faturamento: ${faturamentoAnual} | UFs: ${ufsInteresse.join(',')}`,
        origem: 'cadastro-plano',
        utm_source: params.get('utm_source'),
        utm_medium: params.get('utm_medium'),
        utm_campaign: params.get('utm_campaign'),
        utm_content: params.get('utm_content'),
        utm_term: params.get('utm_term'),
      }).select().single();

      toast.success('Cadastro realizado! Verifique seu e-mail para confirmar a conta.');
      navigate('/auth');
    } catch {
      toast.error('Erro inesperado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Régua v3 das telas de acesso: título 24/600, campo e <select> nativo com a
  // mesma pele do `Input` (40px, raio 8, borda `input`, foco na cor de ação).
  const classeTitulo = 'text-3xl font-semibold leading-8 tracking-tight text-foreground';
  const classeSelect =
    'flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-base text-foreground shadow-sm transition-colors duration-150 hover:border-foreground-tertiary focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 md:text-sm';
  const classeLinkTermos = 'font-medium text-primary underline underline-offset-2 transition-colors hover:text-primary-hover';

  return (
    <div className="flex min-h-screen min-h-[100dvh] flex-col items-center justify-center bg-background px-4 py-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 text-center">
        <Link
          to="/"
          aria-label="Praefectus — página inicial"
          className="inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <PraefectusLogo size="lg" />
        </Link>
        <p className="mt-2 text-sm text-muted-foreground">
          Plataforma completa para licitações públicas
        </p>
      </motion.div>

      {/* Stepper em chips (manual §4): o feito na tinta da ação, o atual em
          verde sólido, o próximo na superfície rebaixada. No celular só o
          ícone aparece; o nome do passo continua para o leitor de tela. */}
      <ol aria-label={`Etapa ${step + 1} de ${STEPS.length}`} className="mb-6 flex flex-wrap items-center justify-center gap-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = i === step;
          const isDone = i < step;
          return (
            <li key={i} className="flex items-center gap-2">
              {i > 0 && (
                <span
                  aria-hidden="true"
                  className={cn('h-0.5 w-6 rounded-full transition-colors', isDone ? 'bg-primary' : 'bg-border')}
                />
              )}
              <button
                type="button"
                onClick={() => i < step && setStep(i)}
                aria-current={isActive ? 'step' : undefined}
                className={cn(
                  'inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  isActive && 'border-primary bg-primary text-primary-foreground',
                  isDone && 'cursor-pointer border-primary-line bg-primary-tint text-primary',
                  !isActive && !isDone && 'border-transparent bg-muted text-muted-foreground',
                )}
              >
                {isDone ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
                <span className="hidden sm:inline">{s.label}</span>
                <span className="sr-only sm:hidden">{s.label}</span>
              </button>
            </li>
          );
        })}
      </ol>

      {/* Form card */}
      <div className="w-full max-w-xl overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="p-6 sm:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.2 }}
            >
              {/* Step 0 — Contact */}
              {step === 0 && (
                <div className="space-y-5">
                  <h2 className={classeTitulo}>Dados do contato</h2>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="col-span-full space-y-2">
                      <Label>Nome completo *</Label>
                      <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome completo" />
                    </div>
                    <div className="space-y-2">
                      <Label>Cargo *</Label>
                      <select value={cargo} onChange={e => setCargo(e.target.value)} className={classeSelect}>
                        <option value="">Selecionar</option>
                        {CARGOS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Celular</Label>
                      <Input value={celular} onChange={e => setCelular(e.target.value)} placeholder="(00) 00000-0000" />
                    </div>
                    <div className="space-y-2">
                      <Label>Telefone empresarial</Label>
                      <Input value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(00) 0000-0000" />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 1 — Account */}
              {step === 1 && (
                <div className="space-y-5">
                  <h2 className={classeTitulo}>Dados da conta</h2>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>E-mail *</Label>
                      <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" />
                    </div>
                    <div className="space-y-2">
                      <Label>Confirmar e-mail *</Label>
                      <Input type="email" value={emailConfirm} onChange={e => setEmailConfirm(e.target.value)} placeholder="Confirme o e-mail" />
                    </div>
                    <div className="col-span-full space-y-2">
                      <Label>CNPJ *</Label>
                      <Input value={cnpj} onChange={e => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
                    </div>
                    <div className="space-y-2">
                      <Label>Senha *</Label>
                      <div className="relative">
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          value={senha}
                          onChange={e => setSenha(e.target.value)}
                          placeholder="Mínimo 6 caracteres"
                          className="pr-11"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                          aria-pressed={showPassword}
                          className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Confirmar senha *</Label>
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={senhaConfirm}
                        onChange={e => setSenhaConfirm(e.target.value)}
                        placeholder="Repita a senha"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2 — Service config */}
              {step === 2 && (
                <div className="space-y-5">
                  <h2 className={classeTitulo}>Configuração do serviço</h2>
                  <div>
                    <Label className="mb-3 block">Estados de interesse *</Label>
                    <div className="flex flex-wrap gap-2" role="group" aria-label="Estados de interesse">
                      {UFS.map(uf => {
                        const selecionado = ufsInteresse.includes(uf);
                        return (
                          <button
                            key={uf}
                            type="button"
                            onClick={() => toggleUf(uf)}
                            aria-pressed={selecionado}
                            className={cn(
                              'inline-flex h-8 items-center rounded-md border px-2.5 text-xs font-semibold tabular-nums transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                              selecionado
                                ? 'border-primary bg-primary-tint text-primary'
                                : 'border-input bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground',
                            )}
                          >
                            {uf}
                          </button>
                        );
                      })}
                    </div>
                    {ufsInteresse.length > 0 && (
                      <p className="mt-2 text-xs font-medium tabular-nums text-muted-foreground">{ufsInteresse.length} estado(s) selecionado(s)</p>
                    )}
                  </div>
                </div>
              )}

              {/* Step 3 — Profile */}
              {step === 3 && (
                <div className="space-y-5">
                  <h2 className={classeTitulo}>Informações do perfil</h2>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Como conheceu a plataforma?</Label>
                      <select value={comoConheceu} onChange={e => setComoConheceu(e.target.value)} className={classeSelect}>
                        <option value="">Selecionar</option>
                        {COMO_CONHECEU.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Quantidade de funcionários</Label>
                      <select value={qtdFuncionarios} onChange={e => setQtdFuncionarios(e.target.value)} className={classeSelect}>
                        <option value="">Selecionar</option>
                        {QTD_FUNCIONARIOS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Licitações que participa por mês</Label>
                      <select value={licitacoesMes} onChange={e => setLicitacoesMes(e.target.value)} className={classeSelect}>
                        <option value="">Selecionar</option>
                        {LICITACOES_MES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Faturamento anual com licitações</Label>
                      <select value={faturamentoAnual} onChange={e => setFaturamentoAnual(e.target.value)} className={classeSelect}>
                        <option value="">Selecionar</option>
                        {FATURAMENTO_ANUAL.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer nav */}
        <div className="border-t border-border bg-secondary px-6 py-4 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              {step > 0 ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => setStep(step - 1)}>
                  <ArrowLeft aria-hidden="true" /> Voltar
                </Button>
              ) : (
                <Button type="button" variant="ghost" size="sm" onClick={() => navigate('/landing#planos')}>
                  <ArrowLeft aria-hidden="true" /> Planos
                </Button>
              )}
            </div>

            <div>
              {step < 3 ? (
                <Button
                  type="button"
                  onClick={() => setStep(step + 1)}
                  disabled={!canNext()}
                >
                  Próximo <ArrowRight aria-hidden="true" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                  Enviar cadastro
                </Button>
              )}
            </div>
          </div>

          {/* Terms */}
          <p className="mt-4 text-center text-xs leading-4 text-muted-foreground">
            Ao confirmar o cadastro, declara estar ciente e de acordo com nossos{' '}
            <Link to="/termos-de-uso" className={classeLinkTermos}>Termos de uso</Link> e{' '}
            <Link to="/politica-de-privacidade" className={classeLinkTermos}>Política de privacidade</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
