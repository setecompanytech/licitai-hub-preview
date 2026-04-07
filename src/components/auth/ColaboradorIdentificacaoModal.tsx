import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { UserCircle, Lock, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';

export default function ColaboradorIdentificacaoModal() {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [nomeIndividual, setNomeIndividual] = useState('');
  const [loginIndividual, setLoginIndividual] = useState('');

  useEffect(() => {
    if (!user || !empresaAtiva) {
      setChecking(false);
      return;
    }

    const check = async () => {
      setChecking(true);
      const { data } = await supabase
        .from('empresa_membros')
        .select('identificacao_completa, papel')
        .eq('empresa_id', empresaAtiva.id)
        .eq('user_id', user.id)
        .maybeSingle();

      // Only show for non-admin members who haven't completed identification
      if (data && !data.identificacao_completa && data.papel !== 'admin') {
        setOpen(true);
      } else {
        setOpen(false);
      }
      setChecking(false);
    };

    check();
  }, [user, empresaAtiva]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeIndividual.trim() || !loginIndividual.trim()) {
      toast.error('Preencha todos os campos');
      return;
    }
    if (!user || !empresaAtiva) return;

    setLoading(true);
    const { error } = await supabase
      .from('empresa_membros')
      .update({
        nome_individual: nomeIndividual.trim(),
        login_individual: loginIndividual.trim(),
        identificacao_completa: true,
      })
      .eq('empresa_id', empresaAtiva.id)
      .eq('user_id', user.id);

    if (error) {
      toast.error('Erro ao salvar identificação');
      console.error(error);
    } else {
      toast.success('Identificação registrada com sucesso!');
      setOpen(false);
    }
    setLoading(false);
  };

  if (checking) return null;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <UserCircle className="w-5 h-5 text-accent" />
            Identificação Individual
          </DialogTitle>
          <DialogDescription>
            Para rastrear suas atividades (vendas, pedidos, comissões), 
            informe seu nome e login individual.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="nome_individual">Seu Nome Completo</Label>
            <div className="relative">
              <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="nome_individual"
                placeholder="Ex: João Silva"
                value={nomeIndividual}
                onChange={(e) => setNomeIndividual(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="login_individual">Login Individual</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="login_individual"
                placeholder="Ex: joao.silva"
                value={loginIndividual}
                onChange={(e) => setLoginIndividual(e.target.value)}
                className="pl-9"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Este login será usado para identificar suas ações no sistema.
            </p>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              'Confirmar Identificação'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
