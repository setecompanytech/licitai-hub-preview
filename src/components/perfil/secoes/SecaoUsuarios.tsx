import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { AlertTriangle, ArrowRight, Building2, Mail, ShieldCheck, Users } from 'lucide-react';

type Membro = {
  id: string;
  nome: string | null;
  email: string | null;
  papel: string;
  equipe: string | null;
};

/**
 * Usuários de acesso — quem entra na empresa e com que papel.
 *
 * É uma LISTA, não um editor. Convidar, remover e mudar permissão continuam na
 * tela de Equipe, que tem o fluxo inteiro (convite por e-mail, matriz de
 * permissões por setor, reenvio). Duplicar aqui daria dois lugares para
 * conceder acesso — e conceder acesso é a operação que menos pode ter duas
 * versões da verdade.
 *
 * O que o hub resolve é a pergunta rápida: "quem está dentro?".
 */
export default function SecaoUsuarios() {
  const { empresaAtiva } = useEmpresa();
  const navigate = useNavigate();
  const [membros, setMembros] = useState<Membro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!empresaAtiva) { setCarregando(false); return; }
    let vivo = true;
    (async () => {
      const { data, error } = await supabase
        .from('empresa_membros')
        .select('id, nome, email, papel, equipe')
        .eq('empresa_id', empresaAtiva.id)
        .order('created_at', { ascending: true });
      if (!vivo) return;
      // Mensagem real do banco, não "algo deu errado": sem ela, ninguém
      // descobre que foi o RLS que barrou.
      if (error) setErro(error.message);
      else setMembros((data ?? []) as Membro[]);
      setCarregando(false);
    })();
    return () => { vivo = false; };
  }, [empresaAtiva]);

  if (carregando) {
    return (
      <div role="status" aria-busy="true" className="space-y-2">
        <span className="sr-only">Carregando usuários</span>
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!empresaAtiva) {
    return (
      <EstadoVazio
        tamanho="compacto"
        icone={<Building2 />}
        titulo="Nenhuma empresa selecionada"
        descricao="Selecione uma empresa no topo para ver quem tem acesso a ela."
      />
    );
  }

  return (
    <>
      {erro && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Não foi possível carregar os usuários: {erro}</AlertDescription>
        </Alert>
      )}

      {membros.length === 0 && !erro ? (
        <EstadoVazio
          tamanho="compacto"
          icone={<Users />}
          titulo="Só você tem acesso"
          descricao="Nenhum usuário além de você tem acesso a esta empresa."
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
          {membros.map((m) => (
            <li key={m.id} className="flex items-center gap-3 bg-card px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-foreground">
                {(m.nome || m.email || '?').slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{m.nome || 'Sem nome'}</p>
                <p className="flex items-center gap-2 truncate text-xs text-muted-foreground">
                  <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {m.email || 'sem e-mail'}
                </p>
              </div>
              <Badge variant={m.papel === 'admin' ? 'info' : 'muted'} className="shrink-0 gap-1">
                {m.papel === 'admin' && <ShieldCheck className="h-4 w-4" aria-hidden="true" />}
                {m.papel}
              </Badge>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-border pt-6">
        <Button variant="outline" onClick={() => navigate('/equipe')}>
          <Users aria-hidden="true" />
          Gerenciar equipe
          <ArrowRight aria-hidden="true" />
        </Button>
        <p className="text-xs text-muted-foreground">
          Convidar, remover e definir permissões acontece na tela de Equipe.
        </p>
      </div>
    </>
  );
}
