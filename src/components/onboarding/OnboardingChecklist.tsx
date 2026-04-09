import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Circle, ArrowRight, X, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { supabase } from '@/integrations/supabase/client';

const CHECKLIST_DISMISSED_KEY = 'praefectus_checklist_dismissed';

interface ChecklistItem {
  id: string;
  label: string;
  desc: string;
  route: string;
  check: () => boolean;
}

export default function OnboardingChecklist() {
  const { user } = useAuth();
  const { empresas } = useEmpresa();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(true);
  const [hasConfig, setHasConfig] = useState(false);
  const [hasLicitacao, setHasLicitacao] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (localStorage.getItem(CHECKLIST_DISMISSED_KEY) === 'true') return;
    setDismissed(false);

    const checkData = async () => {
      const [configRes, licRes] = await Promise.all([
        supabase.from('configuracoes').select('id').eq('user_id', user.id).maybeSingle(),
        supabase.from('licitacoes').select('id').eq('user_id', user.id).limit(1),
      ]);
      setHasConfig(!!configRes.data);
      setHasLicitacao((licRes.data?.length || 0) > 0);
    };
    checkData();
  }, [user, empresas]);

  const items: ChecklistItem[] = [
    { id: 'empresa', label: 'Cadastrar empresa', desc: 'Adicione sua primeira empresa com CNPJ', route: '/empresas', check: () => empresas.length > 0 },
    { id: 'config', label: 'Configurar monitoramento', desc: 'Defina palavras-chave e portais', route: '/configuracoes', check: () => hasConfig },
    { id: 'monitorar', label: 'Explorar editais', desc: 'Busque e monitore editais do PNCP', route: '/monitoramento-editais', check: () => hasLicitacao },
    { id: 'plano', label: 'Escolher um plano', desc: 'Ative funcionalidades avançadas', route: '/configuracoes?scroll=planos', check: () => false },
  ];

  const completed = items.filter(i => i.check()).length;
  const progress = (completed / items.length) * 100;

  if (dismissed || !user || completed === items.length) return null;

  return (
    <Card className="mb-4 border-accent/30 bg-gradient-to-r from-accent/5 to-transparent">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent" />
          <CardTitle className="text-sm font-semibold">Primeiros Passos</CardTitle>
        </div>
        <Button
          variant="ghost" size="icon" className="h-6 w-6"
          onClick={() => { setDismissed(true); localStorage.setItem(CHECKLIST_DISMISSED_KEY, 'true'); }}
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-3 mb-3">
          <Progress value={progress} className="h-1.5 flex-1" />
          <span className="text-xs text-muted-foreground font-medium">{completed}/{items.length}</span>
        </div>
        <div className="space-y-2">
          {items.map((item) => {
            const done = item.check();
            return (
              <button
                key={item.id}
                onClick={() => !done && navigate(item.route)}
                disabled={done}
                className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors ${
                  done ? 'opacity-60' : 'hover:bg-muted/50 cursor-pointer'
                }`}
              >
                {done ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium ${done ? 'line-through text-muted-foreground' : ''}`}>{item.label}</p>
                  <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                </div>
                {!done && <ArrowRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
