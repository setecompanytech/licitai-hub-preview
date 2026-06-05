-- Adiciona campo username na tabela profiles para login por usuário
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_unique UNIQUE (username);
CREATE INDEX IF NOT EXISTS profiles_username_lower_idx ON public.profiles (lower(username));

-- Função segura que resolve username → email (sem expor dados de outros usuários)
CREATE OR REPLACE FUNCTION public.buscar_email_por_username(p_username TEXT)
RETURNS TEXT LANGUAGE sql SECURITY DEFINER SET search_path = 'public' AS $$
  SELECT u.email
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.user_id
  WHERE lower(p.username) = lower(trim(p_username))
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.buscar_email_por_username(TEXT) TO anon, authenticated;
