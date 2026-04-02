
CREATE TABLE public.site_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chave TEXT NOT NULL UNIQUE,
  valor TEXT NOT NULL DEFAULT 'false',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.site_config ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read config
CREATE POLICY "Authenticated users can read site_config"
ON public.site_config FOR SELECT TO authenticated
USING (true);

-- Only admins can update
CREATE POLICY "Admins can update site_config"
ON public.site_config FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert site_config"
ON public.site_config FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Anon can read (for landing page maintenance check)
CREATE POLICY "Anon can read site_config"
ON public.site_config FOR SELECT TO anon
USING (true);

-- Insert the maintenance_mode flag (off by default)
INSERT INTO public.site_config (chave, valor) VALUES ('maintenance_mode', 'false');
