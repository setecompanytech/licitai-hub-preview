import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
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
  certificado_nome: string | null;
  certificado_validade: string | null;
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
  addEmpresa: (data: { cnpj: string; razao_social: string; nome_fantasia?: string; cnae_principal?: string; uf?: string; municipio?: string; endereco?: string; certificado_path?: string; certificado_nome?: string; certificado_tipo?: string; certificado_validade?: string }) => Promise<{ id: string } | null>;
};

const EmpresaContext = createContext<EmpresaContextType | undefined>(undefined);

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
    setEmpresas(mapped);

    // Load active empresa from profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('empresa_ativa_id')
      .eq('user_id', user.id)
      .single();

    if (profile?.empresa_ativa_id) {
      const active = mapped.find(m => m.empresa_id === profile.empresa_ativa_id);
      if (active) {
        setEmpresaAtivaState(active.empresa);
        setTodasSelecionadas(false);
      } else {
        setEmpresaAtivaState(mapped[0].empresa);
        setTodasSelecionadas(false);
      }
    } else if (mapped.length > 0) {
      // No active set — if multiple companies, show "todas"
      if (mapped.length > 1) {
        setTodasSelecionadas(true);
        setEmpresaAtivaState(null);
      } else {
        setEmpresaAtivaState(mapped[0].empresa);
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

    const { data: empresa, error } = await supabase
      .from('empresas')
      .insert({ ...data, created_by: user.id })
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
