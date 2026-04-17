-- Remover política permissiva
DROP POLICY IF EXISTS "Authenticated can read price history" ON public.price_historico;

-- Função auxiliar: usuário possui assinatura ativa em alguma empresa?
CREATE OR REPLACE FUNCTION public.user_has_active_subscription(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.assinaturas a
    JOIN public.empresa_membros em ON em.empresa_id = a.empresa_id
    WHERE em.user_id = _user_id
      AND a.status IN ('ativa', 'active', 'trialing')
      AND (a.data_fim IS NULL OR a.data_fim >= CURRENT_DATE)
  )
$$;

-- Nova política restritiva: somente assinantes ativos podem ler
CREATE POLICY "Active subscribers can read price history"
ON public.price_historico
FOR SELECT
TO authenticated
USING (public.user_has_active_subscription(auth.uid()));