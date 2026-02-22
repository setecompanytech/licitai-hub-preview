
-- Tabela de empresas
CREATE TABLE public.empresas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cnpj TEXT NOT NULL,
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnae_principal TEXT,
  uf TEXT,
  municipio TEXT,
  endereco TEXT,
  certificado_path TEXT,
  certificado_nome TEXT,
  certificado_tipo TEXT,
  certificado_validade TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

-- Tabela de membros da empresa
CREATE TYPE public.empresa_papel AS ENUM ('admin', 'operador', 'viewer');

CREATE TABLE public.empresa_membros (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  papel empresa_papel NOT NULL DEFAULT 'operador',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(empresa_id, user_id)
);

ALTER TABLE public.empresa_membros ENABLE ROW LEVEL SECURITY;

-- Adicionar empresa_ativa_id ao profiles
ALTER TABLE public.profiles ADD COLUMN empresa_ativa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL;

-- Função para verificar se usuário é membro de uma empresa
CREATE OR REPLACE FUNCTION public.is_empresa_member(_user_id UUID, _empresa_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.empresa_membros
    WHERE user_id = _user_id AND empresa_id = _empresa_id
  )
$$;

-- Função para verificar se usuário é admin de uma empresa
CREATE OR REPLACE FUNCTION public.is_empresa_admin(_user_id UUID, _empresa_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.empresa_membros
    WHERE user_id = _user_id AND empresa_id = _empresa_id AND papel = 'admin'
  )
$$;

-- RLS para empresas: membros podem ver, admin pode editar
CREATE POLICY "Members can view their empresas"
ON public.empresas FOR SELECT
USING (public.is_empresa_member(auth.uid(), id));

CREATE POLICY "Admins can update their empresas"
ON public.empresas FOR UPDATE
USING (public.is_empresa_admin(auth.uid(), id));

CREATE POLICY "Authenticated users can create empresas"
ON public.empresas FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins can delete their empresas"
ON public.empresas FOR DELETE
USING (public.is_empresa_admin(auth.uid(), id));

-- RLS para empresa_membros
CREATE POLICY "Members can view empresa members"
ON public.empresa_membros FOR SELECT
USING (public.is_empresa_member(auth.uid(), empresa_id));

CREATE POLICY "Admins can manage empresa members"
ON public.empresa_membros FOR INSERT
WITH CHECK (public.is_empresa_admin(auth.uid(), empresa_id) OR auth.uid() = user_id);

CREATE POLICY "Admins can update empresa members"
ON public.empresa_membros FOR UPDATE
USING (public.is_empresa_admin(auth.uid(), empresa_id));

CREATE POLICY "Admins can remove empresa members"
ON public.empresa_membros FOR DELETE
USING (public.is_empresa_admin(auth.uid(), empresa_id));

-- Trigger para updated_at
CREATE TRIGGER update_empresas_updated_at
BEFORE UPDATE ON public.empresas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
