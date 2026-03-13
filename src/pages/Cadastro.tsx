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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex flex-col items-center justify-center p-4">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 text-center">
        <Link to="/">
          <PraefectusLogo size="lg" />
        </Link>
        <p className="text-sm text-muted-foreground mt-2">
          Plataforma completa para licitações públicas
        </p>
      </motion.div>

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = i === step;
          const isDone = i < step;
          return (
            <div key={i} className="flex items-center gap-2">
              {i > 0 && <div className={`w-8 h-0.5 rounded-full transition-colors ${isDone ? 'bg-accent' : 'bg-border'}`} />}
              <button
                onClick={() => i < step && setStep(i)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-accent text-accent-foreground shadow-md'
                    : isDone
                    ? 'bg-accent/10 text-accent cursor-pointer'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {isDone ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Form card */}
      <motion.div
        layout
        className="w-full max-w-xl bg-card rounded-2xl border border-border/50 shadow-xl overflow-hidden"
      >
        <div className="p-8">
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
                  <h3 className="text-lg font-bold text-foreground">Dados do contato</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="col-span-full">
                      <Label>Nome completo *</Label>
                      <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome completo" />
                    </div>
                    <div>
                      <Label>Cargo *</Label>
                      <select value={cargo} onChange={e => setCargo(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                        <option value="">Selecionar</option>
                        {CARGOS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <Label>Celular</Label>
                      <Input value={celular} onChange={e => setCelular(e.target.value)} placeholder="(00) 00000-0000" />
                    </div>
                    <div>
                      <Label>Telefone empresarial</Label>
                      <Input value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(00) 0000-0000" />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 1 — Account */}
              {step === 1 && (
                <div className="space-y-5">
                  <h3 className="text-lg font-bold text-foreground">Dados da conta</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label>E-mail *</Label>
                      <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" />
                    </div>
                    <div>
                      <Label>Confirmar e-mail *</Label>
                      <Input type="email" value={emailConfirm} onChange={e => setEmailConfirm(e.target.value)} placeholder="Confirme o e-mail" />
                    </div>
                    <div className="col-span-full">
                      <Label>CNPJ *</Label>
                      <Input value={cnpj} onChange={e => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
                    </div>
                    <div className="relative">
                      <Label>Senha *</Label>
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={senha}
                        onChange={e => setSenha(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-8 text-muted-foreground">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <div>
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
                  <h3 className="text-lg font-bold text-foreground">Configuração do serviço</h3>
                  <div>
                    <Label className="mb-3 block">Estados de interesse *</Label>
                    <div className="flex flex-wrap gap-2">
                      {UFS.map(uf => (
                        <button
                          key={uf}
                          onClick={() => toggleUf(uf)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                            ufsInteresse.includes(uf)
                              ? 'bg-accent text-accent-foreground border-accent shadow-sm'
                              : 'bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted'
                          }`}
                        >
                          {uf}
                        </button>
                      ))}
                    </div>
                    {ufsInteresse.length > 0 && (
                      <p className="text-xs text-accent mt-2 font-medium">{ufsInteresse.length} estado(s) selecionado(s)</p>
                    )}
                  </div>
                </div>
              )}

              {/* Step 3 — Profile */}
              {step === 3 && (
                <div className="space-y-5">
                  <h3 className="text-lg font-bold text-foreground">Informações do perfil</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label>Como conheceu a plataforma?</Label>
                      <select value={comoConheceu} onChange={e => setComoConheceu(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                        <option value="">Selecionar</option>
                        {COMO_CONHECEU.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <Label>Quantidade de funcionários</Label>
                      <select value={qtdFuncionarios} onChange={e => setQtdFuncionarios(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                        <option value="">Selecionar</option>
                        {QTD_FUNCIONARIOS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <Label>Licitações que participa por mês</Label>
                      <select value={licitacoesMes} onChange={e => setLicitacoesMes(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                        <option value="">Selecionar</option>
                        {LICITACOES_MES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <Label>Faturamento anual com licitações</Label>
                      <select value={faturamentoAnual} onChange={e => setFaturamentoAnual(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
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
        <div className="border-t border-border/50 px-8 py-5 flex items-center justify-between bg-muted/20">
          <div>
            {step > 0 ? (
              <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => navigate('/landing#planos')}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Planos
              </Button>
            )}
          </div>

          <div>
            {step < 3 ? (
              <Button
                onClick={() => setStep(step + 1)}
                disabled={!canNext()}
                className="rounded-xl font-bold bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                Próximo <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="rounded-xl font-bold bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Enviar cadastro
              </Button>
            )}
          </div>
        </div>

        {/* Terms */}
        <div className="px-8 pb-5">
          <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
            Ao confirmar o cadastro, declara estar ciente e de acordo com nossos{' '}
            <Link to="/termos-de-uso" className="underline text-accent">Termos de uso</Link> e{' '}
            <Link to="/politica-de-privacidade" className="underline text-accent">Política de privacidade</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
