import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { BadgeCheck, Briefcase, Flag, IdCard, Loader2, MapPin, ShieldCheck, User } from 'lucide-react';
import RepresentanteUploader from '@/components/configuracoes/RepresentanteUploader';
import type { ExtractedRepresentanteData } from '@/components/configuracoes/RepresentanteUploader';
import { CampoHub, GradeHub, RodapeHub } from '../PerfilPrimitivos';

/**
 * Representante legal — quem assina pela empresa.
 *
 * Não é tabela própria: são as colunas `rep_*` de `empresas`. Mora aqui porque
 * é o dado que entra em toda declaração e procuração gerada, e ficava escondido
 * dentro de Configurações.
 *
 * O uploader de documento continua sendo o mesmo componente das Configurações —
 * ele extrai os campos de uma foto do RG ou CNH e preenche o formulário. Ter
 * duas extrações diferentes para o mesmo dado é como as duas telas passariam a
 * discordar sobre o nome de quem assina.
 */
export default function SecaoRepresentante() {
  const { empresaAtiva } = useEmpresa();

  const [form, setForm] = useState({
    rep_nome: '', rep_cpf: '', rep_rg: '', rep_orgao_expedidor: '',
    rep_cargo: '', rep_nacionalidade: '', rep_naturalidade: '',
  });
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!empresaAtiva) { setCarregando(false); return; }
    let vivo = true;
    (async () => {
      const { data } = await supabase
        .from('empresas')
        .select('rep_nome, rep_cpf, rep_rg, rep_orgao_expedidor, rep_cargo, rep_nacionalidade, rep_naturalidade')
        .eq('id', empresaAtiva.id)
        .maybeSingle();
      if (!vivo || !data) { setCarregando(false); return; }
      setForm({
        rep_nome: data.rep_nome ?? '',
        rep_cpf: data.rep_cpf ?? '',
        rep_rg: data.rep_rg ?? '',
        rep_orgao_expedidor: data.rep_orgao_expedidor ?? '',
        rep_cargo: data.rep_cargo ?? '',
        rep_nacionalidade: data.rep_nacionalidade ?? '',
        rep_naturalidade: data.rep_naturalidade ?? '',
      });
      setCarregando(false);
    })();
    return () => { vivo = false; };
  }, [empresaAtiva]);

  const campo = (k: keyof typeof form) => ({
    value: form[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value })),
  });

  /* A extração preenche o formulário, não o banco: quem confere e salva é a
     pessoa. Gravar direto faria uma leitura errada de OCR virar o nome de quem
     assina a proposta, sem ninguém olhar. */
  function aoExtrair(d: ExtractedRepresentanteData) {
    setForm(f => ({
      rep_nome: d.repNome ?? f.rep_nome,
      rep_cpf: d.repCpf ?? f.rep_cpf,
      rep_rg: d.repRg ?? f.rep_rg,
      rep_orgao_expedidor: d.repOrgaoExp ?? f.rep_orgao_expedidor,
      rep_nacionalidade: d.repNacionalidade ?? f.rep_nacionalidade,
      rep_naturalidade: d.repNaturalidade ?? f.rep_naturalidade,
      rep_cargo: d.repCargo ?? f.rep_cargo,
    }));
    toast.info('Campos preenchidos pela leitura do documento. Confira antes de salvar.');
  }

  async function salvar() {
    if (!empresaAtiva) return;
    setSalvando(true);
    const { error } = await supabase
      .from('empresas')
      .update({
        rep_nome: form.rep_nome.trim() || null,
        rep_cpf: form.rep_cpf.trim() || null,
        rep_rg: form.rep_rg.trim() || null,
        rep_orgao_expedidor: form.rep_orgao_expedidor.trim() || null,
        rep_cargo: form.rep_cargo.trim() || null,
        rep_nacionalidade: form.rep_nacionalidade.trim() || null,
        rep_naturalidade: form.rep_naturalidade.trim() || null,
      } as never)
      .eq('id', empresaAtiva.id);
    setSalvando(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Representante legal atualizado.');
  }

  if (carregando) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
      </div>
    );
  }

  if (!empresaAtiva) {
    return (
      <p className="text-sm text-muted-foreground py-8">
        Selecione uma empresa no topo para editar o representante legal dela.
      </p>
    );
  }

  return (
    <>
      <div className="mb-6">
        <RepresentanteUploader onExtracted={aoExtrair} />
      </div>

      <GradeHub>
        <CampoHub icone={User} rotulo="Nome completo">
          <Input {...campo('rep_nome')} placeholder="Nome de quem assina" />
        </CampoHub>
        <CampoHub icone={IdCard} rotulo="CPF">
          <Input {...campo('rep_cpf')} placeholder="000.000.000-00" />
        </CampoHub>
        <CampoHub icone={Briefcase} rotulo="Cargo">
          <Input {...campo('rep_cargo')} placeholder="Ex.: Sócio-administrador" />
        </CampoHub>

        <CampoHub icone={IdCard} rotulo="RG">
          <Input {...campo('rep_rg')} placeholder="Número do RG" />
        </CampoHub>
        <CampoHub icone={ShieldCheck} rotulo="Órgão expedidor">
          <Input {...campo('rep_orgao_expedidor')} placeholder="Ex.: SSP/PA" />
        </CampoHub>
        <CampoHub icone={Flag} rotulo="Nacionalidade">
          <Input {...campo('rep_nacionalidade')} placeholder="Brasileiro(a)" />
        </CampoHub>

        <CampoHub icone={MapPin} rotulo="Naturalidade">
          <Input {...campo('rep_naturalidade')} placeholder="Cidade de nascimento" />
        </CampoHub>
      </GradeHub>

      <RodapeHub>
        <Button onClick={salvar} disabled={salvando}>
          {salvando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BadgeCheck className="w-4 h-4 mr-2" />}
          Salvar alterações
        </Button>
        <p className="text-xs text-muted-foreground">
          Estes dados entram nas declarações e procurações geradas pelo sistema.
        </p>
      </RodapeHub>
    </>
  );
}
