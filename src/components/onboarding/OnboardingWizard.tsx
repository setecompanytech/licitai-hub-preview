import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
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

  /* `onboardingCarregado` existe para quem precisa distinguir "ainda não sei"
     de "não precisa". Só `showOnboarding: false` confunde os dois, e quem
     esperar o wizard sair para agir dispararia durante a checagem — antes de
     haver resposta. É o caso do MascoteBoasVindas. */
  return {
    showOnboarding: loaded ? show : false,
    dismissOnboarding: dismiss,
    onboardingCarregado: loaded,
  };
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
            <StepIcon className="w-5 h-5 text-primary" aria-hidden="true" />
            {steps[step].title}
          </DialogTitle>
          <DialogDescription>{steps[step].desc}</DialogDescription>
        </DialogHeader>

        <Progress
          value={progress}
          className="h-2"
          aria-label={`Etapa ${step + 1} de ${steps.length}`}
        />

        {/* Step 0: Welcome */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 [&>*]:min-w-0">
              {/* "13+ Portais / Monitoramento em tempo real" saiu: é
                  exatamente o número sem fonte que a régua da identidade
                  proíbe (paginas.ts nomeia "13 portais" como exemplo), e
                  contradizia a própria etapa seguinte, que oferece nove.
                  O cartão agora diz o que a etapa 2 realmente faz. */}
              {[
                { icon: Bot, label: 'IA integrada', desc: 'Extração automática de editais' },
                { icon: Shield, label: 'Segurança', desc: 'Dados protegidos com criptografia' },
                { icon: Globe, label: 'Portais', desc: 'Você escolhe quais monitorar no próximo passo' },
              ].map(f => (
                <div key={f.label} className="rounded-lg border border-border bg-muted/50 p-4 text-center">
                  <span aria-hidden="true" className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary-tint text-primary">
                    <f.icon className="w-5 h-5" />
                  </span>
                  <p className="text-sm font-semibold">{f.label}</p>
                  <p className="text-xs text-muted-foreground">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 1: Empresa */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="onb-razao-social">Razão Social *</Label>
              <Input
                id="onb-razao-social"
                value={empresa.razao_social}
                onChange={e => setEmpresa(prev => ({ ...prev, razao_social: e.target.value }))}
                placeholder="Nome da empresa"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="onb-cnpj">CNPJ *</Label>
              <Input
                id="onb-cnpj"
                value={empresa.cnpj}
                onChange={e => setEmpresa(prev => ({ ...prev, cnpj: e.target.value }))}
                placeholder="00.000.000/0001-00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="onb-email">E-mail da empresa</Label>
              <Input
                id="onb-email"
                type="email"
                value={empresa.email}
                onChange={e => setEmpresa(prev => ({ ...prev, email: e.target.value }))}
                placeholder="contato@empresa.com"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {empresas.length > 0
                ? 'Se o CNPJ já existir na sua conta, o sistema atualizará a empresa existente em vez de duplicar.'
                : 'Você pode pular esta etapa e cadastrar depois em Configuração → Empresas.'}
            </p>
          </div>
        )}

        {/* Step 2: Portais */}
        {step === 2 && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Portais de interesse">
              {portaisOpcoes.map(p => {
                const selecionado = portaisSelecionados.includes(p);
                return (
                  <Button
                    key={p}
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-pressed={selecionado}
                    onClick={() => togglePortal(p)}
                    className={cn(
                      'rounded-full',
                      selecionado
                        ? 'border-primary/40 bg-primary-tint text-primary hover:bg-primary-tint'
                        : 'text-muted-foreground'
                    )}
                  >
                    {selecionado && <CheckCircle2 aria-hidden="true" />}
                    {p}
                  </Button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Selecione os portais que você deseja monitorar. Você pode alterar depois.
            </p>
          </div>
        )}

        {/* Step 3: Keywords */}
        {step === 3 && (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="onb-palavras">Palavras-chave (separadas por vírgula)</Label>
              <Input
                id="onb-palavras"
                value={palavras}
                onChange={e => setPalavras(e.target.value)}
                placeholder="material de limpeza, informática, mobiliário"
              />
            </div>
            {palavras && (
              <div className="flex flex-wrap gap-2">
                {palavras.split(',').map(p => p.trim()).filter(Boolean).map(p => (
                  <Badge key={p} variant="info">{p}</Badge>
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
            <span aria-hidden="true" className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-tint text-success-ink">
              <CheckCircle2 className="w-6 h-6" />
            </span>
            <div>
              <p className="text-lg font-semibold">Tudo pronto!</p>
              {/* "Dashboard" virou "Painel": é o nome que o registro
                  (lib/navegacao/paginas.ts) dá à rota /dashboard, e o mesmo
                  que a pessoa lê no menu e no h1 da tela. */}
              <p className="text-sm text-muted-foreground mt-1">
                Explore o Painel, monitore editais e comece a disputar licitações com inteligência.
              </p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-2 mt-4 pt-4 border-t border-border">
          <div className="text-sm text-muted-foreground tabular-nums">
            Etapa {step + 1} de {steps.length}
          </div>
          <div className="flex flex-wrap gap-2">
            {step > 0 && (
              <Button type="button" variant="ghost" onClick={() => setStep(s => s - 1)}>
                <ArrowLeft aria-hidden="true" /> Voltar
              </Button>
            )}
            {step === 0 && (
              <Button type="button" variant="ghost" onClick={() => { localStorage.setItem(ONBOARDING_KEY, 'true'); onClose(); }}>
                Pular
              </Button>
            )}
            {step < steps.length - 1 ? (
              <Button type="button" onClick={() => setStep(s => s + 1)}>
                Próximo <ArrowRight aria-hidden="true" />
              </Button>
            ) : (
              <Button type="button" onClick={handleFinish} disabled={saving}>
                {saving ? 'Salvando...' : 'Começar a usar'} <Sparkles aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
