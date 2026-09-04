import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  BadgeCheck, Building2, FileDigit, Hash, Loader2, Mail, MapPin, Phone,
} from 'lucide-react';
import { CampoHub, GradeHub, RodapeHub } from '../PerfilPrimitivos';

/**
 * Dados da empresa — a mesma linha de `empresas` que a tela de Empresas edita.
 *
 * Uma fonte só, dois lugares de edição. Se um dia isto virar uma cópia dos
 * campos com escrita própria, os dois passam a divergir e a proposta sai com o
 * CNPJ de uma tela e o endereço de outra.
 */
export default function SecaoEmpresa() {
  const { empresaAtiva, reloadEmpresas } = useEmpresa();

  const [form, setForm] = useState({
    razao_social: '', nome_fantasia: '', cnpj: '',
    inscricao_estadual: '', inscricao_municipal: '',
    email: '', telefone: '',
    endereco: '', bairro: '', municipio: '', uf: '', cep: '',
  });
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!empresaAtiva) { setCarregando(false); return; }
    let vivo = true;
    (async () => {
      const { data } = await supabase
        .from('empresas')
        .select('razao_social, nome_fantasia, cnpj, inscricao_estadual, inscricao_municipal, email, telefone, endereco, bairro, municipio, uf, cep')
        .eq('id', empresaAtiva.id)
        .maybeSingle();
      if (!vivo || !data) { setCarregando(false); return; }
      setForm({
        razao_social: data.razao_social ?? '',
        nome_fantasia: data.nome_fantasia ?? '',
        cnpj: data.cnpj ?? '',
        inscricao_estadual: data.inscricao_estadual ?? '',
        inscricao_municipal: data.inscricao_municipal ?? '',
        email: data.email ?? '',
        telefone: data.telefone ?? '',
        endereco: data.endereco ?? '',
        bairro: data.bairro ?? '',
        municipio: data.municipio ?? '',
        uf: data.uf ?? '',
        cep: data.cep ?? '',
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

  async function salvar() {
    if (!empresaAtiva) return;
    if (!form.razao_social.trim()) { toast.error('A razão social é obrigatória'); return; }
    setSalvando(true);
    const { error } = await supabase
      .from('empresas')
      .update({
        razao_social: form.razao_social.trim(),
        nome_fantasia: form.nome_fantasia.trim() || null,
        inscricao_estadual: form.inscricao_estadual.trim() || null,
        inscricao_municipal: form.inscricao_municipal.trim() || null,
        email: form.email.trim() || null,
        telefone: form.telefone.trim() || null,
        endereco: form.endereco.trim() || null,
        bairro: form.bairro.trim() || null,
        municipio: form.municipio.trim() || null,
        uf: form.uf.trim().toUpperCase() || null,
        cep: form.cep.trim() || null,
      } as never)
      .eq('id', empresaAtiva.id);
    setSalvando(false);
    if (error) { toast.error(error.message); return; }
    // O nome da empresa aparece no cabeçalho e no seletor: sem recarregar, o
    // topo continua com o nome antigo até trocar de empresa.
    await reloadEmpresas();
    toast.success('Dados da empresa atualizados.');
  }

  if (carregando) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando dados da empresa...
      </div>
    );
  }

  if (!empresaAtiva) {
    return (
      <p className="text-sm text-muted-foreground py-8">
        Nenhuma empresa selecionada. Escolha uma no seletor do topo para editar os dados dela.
      </p>
    );
  }

  return (
    <>
      <GradeHub>
        <CampoHub icone={Building2} rotulo="Razão social">
          <Input {...campo('razao_social')} placeholder="Razão social" />
        </CampoHub>
        <CampoHub icone={Building2} rotulo="Nome fantasia">
          <Input {...campo('nome_fantasia')} placeholder="Nome fantasia" />
        </CampoHub>
        {/* CNPJ é a identidade da linha e a chave de tudo que aponta para ela.
            Trocar aqui seria trocar de empresa, não editar esta. */}
        <CampoHub icone={FileDigit} rotulo="CNPJ" dica="Para mudar o CNPJ, cadastre outra empresa.">
          <Input value={form.cnpj} readOnly className="bg-muted/40 cursor-default select-all" />
        </CampoHub>

        <CampoHub icone={Hash} rotulo="Inscrição estadual">
          <Input {...campo('inscricao_estadual')} placeholder="Isento, se não houver" />
        </CampoHub>
        <CampoHub icone={Hash} rotulo="Inscrição municipal">
          <Input {...campo('inscricao_municipal')} placeholder="Isento, se não houver" />
        </CampoHub>
        <CampoHub icone={Mail} rotulo="E-mail da empresa">
          <Input {...campo('email')} placeholder="contato@empresa.com.br" />
        </CampoHub>

        <CampoHub icone={Phone} rotulo="Telefone">
          <Input {...campo('telefone')} placeholder="(00) 0000-0000" />
        </CampoHub>
        <CampoHub icone={MapPin} rotulo="CEP">
          <Input {...campo('cep')} placeholder="00000-000" />
        </CampoHub>
        <CampoHub icone={MapPin} rotulo="Endereço">
          <Input {...campo('endereco')} placeholder="Rua, número, complemento" />
        </CampoHub>

        <CampoHub icone={MapPin} rotulo="Bairro">
          <Input {...campo('bairro')} placeholder="Bairro" />
        </CampoHub>
        <CampoHub icone={MapPin} rotulo="Município">
          <Input {...campo('municipio')} placeholder="Município" />
        </CampoHub>
        <CampoHub icone={MapPin} rotulo="UF">
          <Input {...campo('uf')} maxLength={2} placeholder="UF" />
        </CampoHub>
      </GradeHub>

      <RodapeHub>
        <Button onClick={salvar} disabled={salvando}>
          {salvando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BadgeCheck className="w-4 h-4 mr-2" />}
          Salvar alterações
        </Button>
        <p className="text-xs text-muted-foreground">
          É desta linha que saem o cabeçalho das propostas e os dados das declarações.
        </p>
      </RodapeHub>
    </>
  );
}
