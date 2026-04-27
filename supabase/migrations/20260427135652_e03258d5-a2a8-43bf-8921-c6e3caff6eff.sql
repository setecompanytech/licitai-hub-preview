-- Tabela de telemetria de consistência das buscas do Mural
CREATE TABLE IF NOT EXISTS public.mural_busca_telemetria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  pagina INTEGER NOT NULL DEFAULT 1,
  fonte TEXT NOT NULL CHECK (fonte IN ('live','cache','misto','nenhuma')),
  total_somado INTEGER NOT NULL DEFAULT 0,
  total_recebido INTEGER NOT NULL DEFAULT 0,
  total_unico INTEGER NOT NULL DEFAULT 0,
  total_filtrado INTEGER NOT NULL DEFAULT 0,
  total_final INTEGER NOT NULL DEFAULT 0,
  duplicatas INTEGER NOT NULL DEFAULT 0,
  divergencias JSONB NOT NULL DEFAULT '{}'::jsonb,
  filtros JSONB NOT NULL DEFAULT '{}'::jsonb,
  chamadas_total INTEGER NOT NULL DEFAULT 0,
  chamadas_ok INTEGER NOT NULL DEFAULT 0,
  chamadas_erro INTEGER NOT NULL DEFAULT 0,
  duracao_ms INTEGER,
  severidade TEXT NOT NULL DEFAULT 'info' CHECK (severidade IN ('info','warning','error')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mural_telemetria_created ON public.mural_busca_telemetria(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mural_telemetria_severidade ON public.mural_busca_telemetria(severidade, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mural_telemetria_user ON public.mural_busca_telemetria(user_id, created_at DESC);

ALTER TABLE public.mural_busca_telemetria ENABLE ROW LEVEL SECURITY;

-- Usuário autenticado pode inserir seu próprio registro
CREATE POLICY "Usuário insere telemetria própria"
ON public.mural_busca_telemetria
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Usuário lê apenas seus registros
CREATE POLICY "Usuário lê telemetria própria"
ON public.mural_busca_telemetria
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Admins leem tudo
CREATE POLICY "Admins leem toda telemetria"
ON public.mural_busca_telemetria
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Painel agregado (últimas 24h) para admins
CREATE OR REPLACE FUNCTION public.mural_telemetria_painel(p_horas INTEGER DEFAULT 24)
RETURNS JSONB
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'janela_horas', p_horas,
    'total_buscas', (SELECT count(*) FROM public.mural_busca_telemetria WHERE created_at >= now() - (p_horas || ' hours')::interval),
    'com_divergencia', (SELECT count(*) FROM public.mural_busca_telemetria WHERE created_at >= now() - (p_horas || ' hours')::interval AND divergencias <> '{}'::jsonb),
    'por_severidade', (
      SELECT jsonb_object_agg(severidade, total)
      FROM (
        SELECT severidade, count(*) total
        FROM public.mural_busca_telemetria
        WHERE created_at >= now() - (p_horas || ' hours')::interval
        GROUP BY severidade
      ) s
    ),
    'por_fonte', (
      SELECT jsonb_object_agg(fonte, total)
      FROM (
        SELECT fonte, count(*) total
        FROM public.mural_busca_telemetria
        WHERE created_at >= now() - (p_horas || ' hours')::interval
        GROUP BY fonte
      ) s
    ),
    'media_duplicatas', (SELECT round(avg(duplicatas)::numeric, 2) FROM public.mural_busca_telemetria WHERE created_at >= now() - (p_horas || ' hours')::interval),
    'media_duracao_ms', (SELECT round(avg(duracao_ms)::numeric, 0) FROM public.mural_busca_telemetria WHERE created_at >= now() - (p_horas || ' hours')::interval),
    'top_divergencias', (
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT created_at, fonte, total_somado, total_recebido, total_unico, total_final, divergencias, severidade
        FROM public.mural_busca_telemetria
        WHERE created_at >= now() - (p_horas || ' hours')::interval
          AND divergencias <> '{}'::jsonb
        ORDER BY created_at DESC
        LIMIT 20
      ) t
    )
  );
$$;