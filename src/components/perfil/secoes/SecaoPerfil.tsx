import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { AtSign, BadgeCheck, Briefcase, Info, Loader2, Mail, Phone, User } from 'lucide-react';
import { CampoHub, GradeHub, RodapeHub } from '../PerfilPrimitivos';
import FotoPerfil from '../FotoPerfil';

/**
 * Meu perfil — o que a pessoa é dentro do sistema.
 *
 * Grava em `profiles`, que já tem nome_completo, username, cargo e telefone.
 * O e-mail é só leitura de propósito: trocar e-mail muda a credencial de
 * acesso e exige confirmação no endereço atual, o que é fluxo de Segurança,
 * não de cadastro.
 *
 * O protótipo mostra "Telefone" e "Celular" separados; o banco tem um campo
 * só. Ficou um, com o nome que a coluna tem — inventar o segundo daria uma
 * caixa que aceita digitação e não guarda em lugar nenhum.
 */
export default function SecaoPerfil() {
  const { user } = useAuth();

  const [nome, setNome] = useState('');
  const [username, setUsername] = useState('');
  const [cargo, setCargo] = useState('');
  const [telefone, setTelefone] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const email = user?.email ?? '';

  useEffect(() => {
    if (!user) return;
    let vivo = true;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('nome_completo, username, cargo, telefone')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!vivo) return;
      setNome(data?.nome_completo ?? user.user_metadata?.nome_completo ?? '');
      setUsername(data?.username ?? '');
      setCargo(data?.cargo ?? '');
      setTelefone(data?.telefone ?? '');
      setCarregando(false);
    })();
    return () => { vivo = false; };
  }, [user]);

  /* Um botão só para tudo. Antes cada campo tinha o seu, e quem mudava nome e
     usuário juntos salvava metade sem perceber. */
  async function salvar() {
    if (!user) return;
    if (!nome.trim()) { toast.error('Informe seu nome completo'); return; }

    const limpo = username.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');
    setSalvando(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        nome_completo: nome.trim(),
        username: limpo || null,
        cargo: cargo.trim() || null,
        telefone: telefone.trim() || null,
      } as never)
      .eq('user_id', user.id);

    // O nome também vive no metadata da sessão — é dele que a barra do topo e
    // o avatar leem. Sem esta segunda escrita, o perfil salva e o cabeçalho
    // continua mostrando o nome velho até o próximo login.
    if (!error) {
      await supabase.auth.updateUser({ data: { nome_completo: nome.trim() } });
    }

    setSalvando(false);

    if (error) {
      toast.error(
        error.message.includes('unique')
          ? 'Este nome de usuário já está em uso. Escolha outro.'
          : error.message,
      );
      return;
    }
    setUsername(limpo);
    toast.success('Perfil atualizado.');
  }

  if (carregando) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando seu perfil...
      </div>
    );
  }

  return (
    <>
      <FotoPerfil nome={nome} email={email} />

      <GradeHub>
        <CampoHub icone={User} rotulo="Nome completo">
          <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome completo" />
        </CampoHub>

        <CampoHub
          icone={AtSign}
          rotulo="Nome de usuário"
          dica={
            <>
              Você pode entrar com <b className="text-foreground">@{username || 'seu.usuario'}</b> ou
              com o e-mail. Apenas minúsculas, números, ponto, hífen e sublinhado.
            </>
          }
        >
          <Input
            value={username}
            onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))}
            placeholder="@seu.usuario"
          />
        </CampoHub>

        <CampoHub
          icone={Mail}
          rotulo="E-mail"
          dica={<>Para trocar o e-mail, use <b className="text-foreground">Segurança</b> — a mudança exige confirmação no endereço atual.</>}
        >
          <Input value={email} readOnly className="bg-muted/40 cursor-default select-all" />
        </CampoHub>

        <CampoHub icone={Briefcase} rotulo="Cargo">
          <Input value={cargo} onChange={e => setCargo(e.target.value)} placeholder="Ex.: Proprietário(a) / Sócio(a)" />
        </CampoHub>

        <CampoHub
          icone={Phone}
          rotulo="Telefone"
          dica={!telefone ? <span className="italic">Não informado</span> : undefined}
        >
          <Input value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(00) 00000-0000" />
        </CampoHub>
      </GradeHub>

      <RodapeHub>
        <Button onClick={salvar} disabled={salvando}>
          {salvando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BadgeCheck className="w-4 h-4 mr-2" />}
          Salvar alterações
        </Button>
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          Estes dados aparecem nas propostas e nos documentos gerados.
        </p>
      </RodapeHub>
    </>
  );
}
