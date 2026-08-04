import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Building2, FileText, Globe, Search, CheckCircle2, ArrowRight, ArrowLeft,
  Sparkles, Shield, Bot,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';

const ONBOARDING_KEY = 'praefectus_onboarding_done';

export function useOnboarding() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) { setLoaded(true); return; }

    // Quick local check first
    if (localStorage.getItem(ONBOARDING_KEY) === 'true') {
      setShow(false);
      setLoaded(true);
      return;
    }

    // Check DB for onboarding_done flag
    const check = async () => {
      const { data } = await supabase
        .from('configuracoes')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        // User already has config row → onboarding was completed before
        localStorage.setItem(ONBOARDING_KEY, 'true');
        setShow(false);
      } else {
        setShow(true);
      }
      setLoaded(true);
    };
    check();
  }, [user]);

  const dismiss = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setShow(false);
  };

  return { showOnboarding: loaded ? show : false, dismissOnboarding: dismiss };
}

type Props = {
  open: boolean;
  onClose: () => void;
};

const steps = [
  { title: 'Bem-vindo ao PRAEFECTUS', icon: Sparkles, desc: 'Vamos configurar sua conta em poucos passos.' },
  { title: 'Cadastre sua Empresa', icon: Building2, desc: 'Informe os dados da empresa que participa de licitações.' },
  { title: 'Portais de Interesse', icon: Globe, desc: 'Selecione os portais que você monitora.' },
  { title: 'Palavras-chave', icon: Search, desc: 'Defina termos para monitoramento automático de editais.' },
  { title: 'Pronto!', icon: CheckCircle2, desc: 'Sua conta está configurada. Comece a usar o PRAEFECTUS!' },
];

const portaisOpcoes = [
  'PNCP', 'ComprasNet', 'Licitações-e (BB)', 'BLL Compras', 'Licitanet',
  'Portal de Compras Públicas', 'BNC', 'BEC/SP', 'Compras RJ',
];

export default function OnboardingWizard({ open, onClose }: Props) {
  const { user } = useAuth();
  const { addEmpresa, empresas } = useEmpresa();
  const [step, setStep] = useState(0);
  const [empresa, setEmpresa] = useState({ razao_social: '', cnpj: '', email: '' });
  const [portaisSelecionados, setPortaisSelecionados] = useState<string[]>([]);
  const [palavras, setPalavras] = useState('');
  const [saving, setSaving] = useState(false);

  const progress = ((step + 1) / steps.length) * 100;

  const togglePortal = (p: string) => {
    setPortaisSelecionados(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    );
  };

  const handleFinish = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // Save empresa if provided
      if (empresa.razao_social && empresa.cnpj) {
        await addEmpresa({
          razao_social: empresa.razao_social,
          cnpj: empresa.cnpj,
          email: empresa.email,
        });
      }

      // Save monitoring config
      const palavrasArr = palavras.split(',').map(p => p.trim()).filter(Boolean);
      if (palavrasArr.length > 0 || portaisSelecionados.length > 0) {
        await supabase.from('configuracoes').upsert({
          user_id: user.id,
          palavras_chave: palavrasArr.length > 0 ? palavrasArr : null,
        }, { onConflict: 'user_id' });
      }

      localStorage.setItem(ONBOARDING_KEY, 'true');
      toast.success('Configuração concluída! Bem-vindo ao PRAEFECTUS.');
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar configuração.');
    } finally {
      setSaving(false);
    }
  };

  const StepIcon = steps[step].icon;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-lg" onPointerDownOutside={e => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <StepIcon className="w-5 h-5 text-accent" />
            {steps[step].title}
          </DialogTitle>
        </DialogHeader>

        <Progress value={progress} className="h-1.5 mb-2" />
        <p className="text-sm text-muted-foreground mb-4">{steps[step].desc}</p>

        {/* Step 0: Welcome */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: Bot, label: 'IA Integrada', desc: 'Extração automática de editais' },
                { icon: Shield, label: 'Segurança', desc: 'Dados protegidos com criptografia' },
                { icon: Globe, label: '13+ Portais', desc: 'Monitoramento em tempo real' },
              ].map(f => (
                <div key={f.label} className="bg-muted/50 rounded-lg p-3 text-center">
                  <f.icon className="w-5 h-5 mx-auto text-accent mb-1" />
                  <p className="text-xs font-semibold">{f.label}</p>
                  <p className="text-xs text-muted-foreground">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 1: Empresa */}
        {step === 1 && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Razão Social *</label>
              <Input
                value={empresa.razao_social}
                onChange={e => setEmpresa(prev => ({ ...prev, razao_social: e.target.value }))}
                placeholder="Nome da empresa"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">CNPJ *</label>
              <Input
                value={empresa.cnpj}
                onChange={e => setEmpresa(prev => ({ ...prev, cnpj: e.target.value }))}
                placeholder="00.000.000/0001-00"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">E-mail da empresa</label>
              <Input
                value={empresa.email}
                onChange={e => setEmpresa(prev => ({ ...prev, email: e.target.value }))}
                placeholder="contato@empresa.com"
                className="mt-1"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {empresas.length > 0
                ? 'Se o CNPJ já existir na sua conta, o sistema atualizará a empresa existente em vez de duplicar.'
                : 'Você pode pular esta etapa e cadastrar depois em Configurações → Empresas.'}
            </p>
          </div>
        )}

        {/* Step 2: Portais */}
        {step === 2 && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {portaisOpcoes.map(p => (
                <button
                  key={p}
                  onClick={() => togglePortal(p)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    portaisSelecionados.includes(p)
                      ? 'bg-accent text-accent-foreground border-accent'
                      : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
                  }`}
                >
                  {portaisSelecionados.includes(p) && <CheckCircle2 className="w-3 h-3 inline mr-1" />}
                  {p}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Selecione os portais que você deseja monitorar. Você pode alterar depois.
            </p>
          </div>
        )}

        {/* Step 3: Keywords */}
        {step === 3 && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Palavras-chave (separadas por vírgula)</label>
              <Input
                value={palavras}
                onChange={e => setPalavras(e.target.value)}
                placeholder="material de limpeza, informática, mobiliário"
                className="mt-1"
              />
            </div>
            {palavras && (
              <div className="flex flex-wrap gap-1.5">
                {palavras.split(',').map(p => p.trim()).filter(Boolean).map(p => (
                  <Badge key={p} variant="outline" className="text-xs">{p}</Badge>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              O sistema buscará editais automaticamente com base nessas palavras-chave e nos CNAEs da sua empresa.
            </p>
          </div>
        )}

        {/* Step 4: Done */}
        {step === 4 && (
          <div className="text-center space-y-4 py-4">
            <div className="w-16 h-16 rounded-2xl bg-success/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-success" />
            </div>
            <div>
              <p className="text-sm font-semibold">Tudo pronto!</p>
              <p className="text-xs text-muted-foreground mt-1">
                Explore o Dashboard, monitore editais e comece a disputar licitações com inteligência.
              </p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
          <div className="text-xs text-muted-foreground">
            Etapa {step + 1} de {steps.length}
          </div>
          <div className="flex gap-2">
            {step > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setStep(s => s - 1)}>
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Voltar
              </Button>
            )}
            {step === 0 && (
              <Button size="sm" variant="ghost" onClick={() => { localStorage.setItem(ONBOARDING_KEY, 'true'); onClose(); }}>
                Pular
              </Button>
            )}
            {step < steps.length - 1 ? (
              <Button size="sm" onClick={() => setStep(s => s + 1)}>
                Próximo <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            ) : (
              <Button size="sm" onClick={handleFinish} disabled={saving}>
                {saving ? 'Salvando...' : 'Começar a usar'} <Sparkles className="w-3.5 h-3.5 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
