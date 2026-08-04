-- =============================================================================
-- MIGRATION: Metas do Comercial — Praça por colaborador (Fase 1)
-- Data: 2026-08-04
-- Objetivo: dia útil varia por praça — feriado ganha escopo (nacional/
--           estadual/municipal) e o colaborador ganha uma praça (uf,
--           municipio). O motor filtra: nacionais + os da UF dele + os do
--           município dele. Sem praça definida, só os nacionais (fallback
--           que preserva o comportamento atual — nada quebra na transição).
--
-- Ressalvas da auditoria aplicadas aqui:
--   (1) A UNIQUE antiga (empresa_id, data) barraria duas UFs com feriado na
--       mesma data. Trocada por índice único com COALESCE — NULLs são
--       distintos entre si no Postgres, então sem o COALESCE daria para
--       duplicar o nacional da mesma data.
--   (2) Município é texto livre e falha PARA MENOS quando a grafia diverge
--       ("Santa Rosa" vs "SANTA ROSA "): a comparação canônica usa
--       comercial_normalizar_municipio, espelho de src/lib/metas/praca.ts —
--       as duas versões precisam mudar juntas.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Normalização de município (espelho do normalizarMunicipio em TS)
--    minúsculas, sem acento, pontuação vira espaço, espaços colapsados.
--
--    Dois reforços vindos da verificação adversarial:
--    a) comercial_sem_acento ganha ñ/Ñ (o TS já os cobria via NFD+\p{Mn};
--       sem isto, 'Muñoz' nunca casaria entre os dois lados);
--    b) normalize(..., NFC) recompõe entrada decomposta (texto colado do
--       macOS chega em NFD e o translate só mapeia pré-compostos — 'São'
--       decomposto viraria 'sa o' no SQL e 'sao' no TS).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.comercial_sem_acento(p_texto text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT translate(
    coalesce(p_texto, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'
  );
$$;

CREATE OR REPLACE FUNCTION public.comercial_normalizar_municipio(p_texto text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(
    btrim(regexp_replace(
      lower(public.comercial_sem_acento(normalize(coalesce(p_texto, ''), NFC))),
      '[^a-z0-9]+', ' ', 'g'
    )),
    ''
  )
$$;

COMMENT ON FUNCTION public.comercial_normalizar_municipio(text) IS
  'Forma canonica de municipio para comparacao de praca. ESPELHO de '
  'src/lib/metas/praca.ts (normalizarMunicipio) — mudar as duas juntas.';

-- -----------------------------------------------------------------------------
-- 2. Escopo do feriado: uf/municipio opcionais
--    NULL/NULL = nacional; uf = estadual; uf+municipio = municipal.
-- -----------------------------------------------------------------------------
ALTER TABLE public.comercial_feriados
  ADD COLUMN IF NOT EXISTS uf text,
  ADD COLUMN IF NOT EXISTS municipio text;

COMMENT ON COLUMN public.comercial_feriados.uf IS
  'NULL = feriado nacional. Preenchida (sigla maiuscula) = vale para a UF.';
COMMENT ON COLUMN public.comercial_feriados.municipio IS
  'Com uf preenchida, restringe o feriado ao municipio. Comparacao sempre '
  'pela forma normalizada (comercial_normalizar_municipio).';

ALTER TABLE public.comercial_feriados DROP CONSTRAINT IF EXISTS comercial_feriados_uf_valida;
ALTER TABLE public.comercial_feriados ADD CONSTRAINT comercial_feriados_uf_valida
  CHECK (uf IS NULL OR uf ~ '^[A-Z]{2}$');

-- Município válido = tem UF e sobrevive à normalização ('   ' e '***'
-- normalizam para NULL; sem esta regra, um "municipal" em branco valeria
-- para a UF inteira — falha PARA MAIS, o oposto da filosofia do módulo).
ALTER TABLE public.comercial_feriados DROP CONSTRAINT IF EXISTS comercial_feriados_municipio_exige_uf;
ALTER TABLE public.comercial_feriados ADD CONSTRAINT comercial_feriados_municipio_exige_uf
  CHECK (
    municipio IS NULL
    OR (uf IS NOT NULL AND public.comercial_normalizar_municipio(municipio) IS NOT NULL)
  );

-- Coerência BIDIRECIONAL com a coluna abrangencia: o motor filtra por
-- uf/municipio e ignora o rótulo — sem as duas direções, um "nacional" com
-- uf preenchida valeria só para uma UF com rótulo de nacional.
-- 'ponto_facultativo' e 'outro' ficam livres de propósito (podem ser de
-- qualquer escopo).
ALTER TABLE public.comercial_feriados DROP CONSTRAINT IF EXISTS comercial_feriados_abrangencia_praca;
ALTER TABLE public.comercial_feriados ADD CONSTRAINT comercial_feriados_abrangencia_praca
  CHECK (
    (abrangencia <> 'nacional' OR (uf IS NULL AND municipio IS NULL))
    AND (abrangencia <> 'estadual' OR (uf IS NOT NULL AND municipio IS NULL))
    AND (abrangencia <> 'municipal'
         OR (uf IS NOT NULL AND public.comercial_normalizar_municipio(municipio) IS NOT NULL))
  );

-- Ressalva (1): unicidade por praça, com COALESCE
ALTER TABLE public.comercial_feriados DROP CONSTRAINT IF EXISTS comercial_feriados_data_unica;
CREATE UNIQUE INDEX IF NOT EXISTS ux_comercial_feriados_data_praca
  ON public.comercial_feriados (
    empresa_id,
    data,
    COALESCE(uf, ''),
    COALESCE(public.comercial_normalizar_municipio(municipio), '')
  );

-- O índice de período da 20260803000003 virou redundante: o único acima tem
-- o mesmo prefixo (empresa_id, data) e atende as mesmas consultas de range.
DROP INDEX IF EXISTS public.idx_comercial_feriados_periodo;

-- -----------------------------------------------------------------------------
-- 3. Praça do colaborador
--    Editável pelo admin na tela de Equipe; RLS de empresa_membros já cobre.
-- -----------------------------------------------------------------------------
ALTER TABLE public.empresa_membros
  ADD COLUMN IF NOT EXISTS praca_uf text,
  ADD COLUMN IF NOT EXISTS praca_municipio text;

COMMENT ON COLUMN public.empresa_membros.praca_uf IS
  'Praca do colaborador para o calculo de dias uteis das metas. NULL = usa '
  'so os feriados nacionais (comportamento anterior a Fase 1).';
COMMENT ON COLUMN public.empresa_membros.praca_municipio IS
  'Municipio da praca; so tem efeito com praca_uf preenchida.';

ALTER TABLE public.empresa_membros DROP CONSTRAINT IF EXISTS empresa_membros_praca_uf_valida;
ALTER TABLE public.empresa_membros ADD CONSTRAINT empresa_membros_praca_uf_valida
  CHECK (praca_uf IS NULL OR praca_uf ~ '^[A-Z]{2}$');

ALTER TABLE public.empresa_membros DROP CONSTRAINT IF EXISTS empresa_membros_praca_municipio_exige_uf;
ALTER TABLE public.empresa_membros ADD CONSTRAINT empresa_membros_praca_municipio_exige_uf
  CHECK (
    praca_municipio IS NULL
    OR (praca_uf IS NOT NULL AND public.comercial_normalizar_municipio(praca_municipio) IS NOT NULL)
  );
