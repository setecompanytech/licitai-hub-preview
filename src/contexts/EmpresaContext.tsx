import { createContext, useContext, useEffect, useState, type ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type Empresa = {
  id: string;
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnae_principal: string | null;
  uf: string | null;
  municipio: string | null;
  endereco: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string | null;
  telefone: string | null;
  email: string | null;
  inscricao_estadual: string | null;
  inscricao_municipal: string | null;
  certificado_nome: string | null;
  certificado_path: string | null;
  certificado_tipo: string | null;
  certificado_validade: string | null;
  regime_tributario: string | null;
  timbrado_url: string | null;
  timbrado_path: string | null;
  cabecalho_url: string | null;
  cabecalho_path: string | null;
  rodape_url: string | null;
  rodape_path: string | null;
  rep_nome: string | null;
  rep_cpf: string | null;
  rep_rg: string | null;
  rep_orgao_expedidor: string | null;
  rep_cargo: string | null;
  rep_naturalidade: string | null;
  rep_nacionalidade: string | null;
};

type EmpresaMembro = {
  empresa_id: string;
  papel: 'admin' | 'operador' | 'viewer';
  empresa: Empresa;
};

type EmpresaContextType = {
  empresas: EmpresaMembro[];
  empresaAtiva: Empresa | null;
  todasSelecionadas: boolean;
  loading: boolean;
  setEmpresaAtiva: (empresaId: string | 'todas') => Promise<void>;
  reloadEmpresas: () => Promise<void>;
  addEmpresa: (data: { cnpj: string; razao_social: string; nome_fantasia?: string; cnae_principal?: string; uf?: string; municipio?: string; endereco?: string; complemento?: string; bairro?: string; cep?: string; telefone?: string; email?: string; inscricao_estadual?: string; certificado_path?: string; certificado_nome?: string; certificado_tipo?: string; certificado_validade?: string; regime_tributario?: string }) => Promise<{ id: string } | null>;
};

const EmpresaContext = createContext<EmpresaContextType | undefined>(undefined);

const normalizeCnpj = (value?: string | null) => value?.replace(/\D/g, '') ?? '';

const optionalValue = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const getEmpresaScore = (empresa: Empresa) => {
  const optionalFields = [
    empresa.nome_fantasia,
    empresa.cnae_principal,
    empresa.uf,
    empresa.municipio,
    empresa.endereco,
    empresa.complemento,
    empresa.bairro,
    empresa.cep,
    empresa.telefone,
    empresa.email,
    empresa.inscricao_estadual,
    empresa.inscricao_municipal,
    empresa.certificado_nome,
    empresa.certificado_path,
    empresa.certificado_tipo,
    empresa.certificado_validade,
    empresa.regime_tributario,
    empresa.timbrado_url,
    empresa.timbrado_path,
    empresa.cabecalho_url,
    empresa.cabecalho_path,
    empresa.rodape_url,
    empresa.rodape_path,
    empresa.rep_nome,
    empresa.rep_cpf,
    empresa.rep_rg,
    empresa.rep_orgao_expedidor,
    empresa.rep_cargo,
    empresa.rep_naturalidade,
    empresa.rep_nacionalidade,
  ];

  return optionalFields.reduce((score, field) => score + (field ? 1 : 0), 0);
};

const dedupeEmpresas = (membros: EmpresaMembro[]) => {
  const uniqueMap = new Map<string, EmpresaMembro>();

  for (const membro of membros) {
    const key = normalizeCnpj(membro.empresa.cnpj) || membro.empresa_id;
    const existing = uniqueMap.get(key);

    if (!existing || getEmpresaScore(membro.empresa) > getEmpresaScore(existing.empresa)) {
      uniqueMap.set(key, membro);
    }
  }

  return Array.from(uniqueMap.values());
};

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [empresas, setEmpresas] = useState<EmpresaMembro[]>([]);
  const [empresaAtiva, setEmpresaAtivaState] = useState<Empresa | null>(null);
  const [todasSelecionadas, setTodasSelecionadas] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadEmpresas = useCallback(async () => {
    if (!user) { setEmpresas([]); setEmpresaAtivaState(null); setLoading(false); return; }

    const { data: membros } = await supabase
      .from('empresa_membros')
      .select('empresa_id, papel, empresas(*)')
      .eq('user_id', user.id);

    if (!membros || membros.length === 0) {
      setEmpresas([]);
      setEmpresaAtivaState(null);
      setLoading(false);
      return;
    }

    const mapped: EmpresaMembro[] = membros.map((m: any) => ({
      empresa_id: m.empresa_id,
      papel: m.papel,
      empresa: m.empresas,
    }));
    const deduped = dedupeEmpresas(mapped);
    const mappedById = new Map(mapped.map((m) => [m.empresa_id, m]));
    setEmpresas(deduped);

    // Load active empresa from profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('empresa_ativa_id')
      .eq('user_id', user.id)
      .single();

    if (profile?.empresa_ativa_id) {
      const active = deduped.find(m => m.empresa_id === profile.empresa_ativa_id);
      const activeSource = mappedById.get(profile.empresa_ativa_id);
      const activeByCnpj = activeSource
        ? deduped.find((m) => normalizeCnpj(m.empresa.cnpj) === normalizeCnpj(activeSource.empresa.cnpj))
        : undefined;
      const resolvedActive = active || activeByCnpj;

      if (resolvedActive) {
        setEmpresaAtivaState(resolvedActive.empresa);
        setTodasSelecionadas(false);
      } else {
        setEmpresaAtivaState(deduped[0].empresa);
        setTodasSelecionadas(false);
      }
    } else if (deduped.length > 0) {
      // No active set — if multiple companies, show "todas"
      if (deduped.length > 1) {
        setTodasSelecionadas(true);
        setEmpresaAtivaState(null);
      } else {
        setEmpresaAtivaState(deduped[0].empresa);
        setTodasSelecionadas(false);
      }
    }

    setLoading(false);
  }, [user]);

  useEffect(() => { loadEmpresas(); }, [loadEmpresas]);

  const setEmpresaAtiva = async (empresaId: string | 'todas') => {
    if (!user) return;

    if (empresaId === 'todas') {
      setTodasSelecionadas(true);
      setEmpresaAtivaState(null);
      await supabase.from('profiles').update({ empresa_ativa_id: null }).eq('user_id', user.id);
    } else {
      const found = empresas.find(e => e.empresa_id === empresaId);
      if (found) {
        setEmpresaAtivaState(found.empresa);
        setTodasSelecionadas(false);
        await supabase.from('profiles').update({ empresa_ativa_id: empresaId }).eq('user_id', user.id);
      }
    }
  };

  const addEmpresa = async (data: any) => {
    if (!user) return null;

    const cnpjNormalizado = normalizeCnpj(data.cnpj);
    if (!cnpjNormalizado) {
      throw new Error('CNPJ inválido');
    }

    const payload = {
      cnpj: cnpjNormalizado,
      razao_social: data.razao_social.trim(),
      nome_fantasia: optionalValue(data.nome_fantasia),
      cnae_principal: optionalValue(data.cnae_principal),
      uf: optionalValue(data.uf),
      municipio: optionalValue(data.municipio),
      endereco: optionalValue(data.endereco),
      complemento: optionalValue(data.complemento),
      bairro: optionalValue(data.bairro),
      cep: optionalValue(data.cep),
      telefone: optionalValue(data.telefone),
      email: optionalValue(data.email),
      inscricao_estadual: optionalValue(data.inscricao_estadual),
      certificado_path: optionalValue(data.certificado_path),
      certificado_nome: optionalValue(data.certificado_nome),
      certificado_tipo: optionalValue(data.certificado_tipo),
      certificado_validade: optionalValue(data.certificado_validade),
      regime_tributario: optionalValue(data.regime_tributario),
    };

    const empresaExistente = empresas.find(
      ({ empresa }) => normalizeCnpj(empresa.cnpj) === cnpjNormalizado,
    );

    if (empresaExistente) {
      const { data: empresaAtualizada, error: updateError } = await supabase
        .from('empresas')
        .update(payload)
        .eq('id', empresaExistente.empresa_id)
        .select('id')
        .single();

      if (updateError) {
        console.error('addEmpresa update error:', updateError);
        throw new Error(updateError.message || 'Erro ao atualizar empresa existente');
      }

      await loadEmpresas();
      return empresaAtualizada;
    }

    const { data: empresa, error } = await supabase
      .from('empresas')
      .insert({ ...payload, created_by: user.id })
      .select('id')
      .single();

    if (error) {
      console.error('addEmpresa insert error:', error);
      throw new Error(error.message || 'Erro ao inserir empresa');
    }
    if (!empresa) return null;

    // Add self as admin
    const { error: membroError } = await supabase.from('empresa_membros').insert({
      empresa_id: empresa.id,
      user_id: user.id,
      papel: 'admin',
    });

    if (membroError) {
      console.error('addEmpresa membro error:', membroError);
    }

    await loadEmpresas();
    return empresa;
  };

  return (
    <EmpresaContext.Provider value={{ empresas, empresaAtiva, todasSelecionadas, loading, setEmpresaAtiva, reloadEmpresas: loadEmpresas, addEmpresa }}>
      {children}
    </EmpresaContext.Provider>
  );
}

export function useEmpresa() {
  const context = useContext(EmpresaContext);
  if (!context) throw new Error('useEmpresa must be used within EmpresaProvider');
  return context;
}
