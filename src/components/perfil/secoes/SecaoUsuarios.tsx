import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { Button } from '@/components/ui/button';
import { ArrowRight, Loader2, Mail, ShieldCheck, Users } from 'lucide-react';

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
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando usuários...
      </div>
    );
  }

  if (!empresaAtiva) {
    return (
      <p className="text-sm text-muted-foreground py-8">
        Selecione uma empresa no topo para ver quem tem acesso a ela.
      </p>
    );
  }

  return (
    <>
      {erro && (
        <div className="mb-5 rounded-xl border border-destructive-line bg-destructive-tint px-4 py-3 text-sm text-destructive-ink">
          Não foi possível carregar os usuários: {erro}
        </div>
      )}

      {membros.length === 0 && !erro ? (
        <p className="text-sm text-muted-foreground py-6">
          Nenhum usuário além de você tem acesso a esta empresa.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border overflow-hidden">
          {membros.map((m) => (
            <li key={m.id} className="flex items-center gap-3 px-4 py-3 bg-card">
              <span className="w-9 h-9 rounded-full bg-navy-tint text-navy flex items-center justify-center text-xs font-bold shrink-0">
                {(m.nome || m.email || '?').slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{m.nome || 'Sem nome'}</p>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                  <Mail className="w-3 h-3 shrink-0" aria-hidden="true" />
                  {m.email || 'sem e-mail'}
                </p>
              </div>
              <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-muted text-muted-foreground shrink-0">
                {m.papel === 'admin' && <ShieldCheck className="w-3 h-3" aria-hidden="true" />}
                {m.papel}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-7 pt-5 border-t border-border flex flex-wrap items-center gap-4">
        <Button variant="outline" onClick={() => navigate('/equipe')}>
          <Users className="w-4 h-4 mr-2" />
          Gerenciar equipe
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
        <p className="text-xs text-muted-foreground">
          Convidar, remover e definir permissões acontece na tela de Equipe.
        </p>
      </div>
    </>
  );
}
