-- Amplia enum financeiro_tipo_documento com tipos fiscais e meios de pagamento adicionais
ALTER TYPE public.financeiro_tipo_documento ADD VALUE IF NOT EXISTS 'cte';
ALTER TYPE public.financeiro_tipo_documento ADD VALUE IF NOT EXISTS 'duplicata';
ALTER TYPE public.financeiro_tipo_documento ADD VALUE IF NOT EXISTS 'fatura';
ALTER TYPE public.financeiro_tipo_documento ADD VALUE IF NOT EXISTS 'pix';
ALTER TYPE public.financeiro_tipo_documento ADD VALUE IF NOT EXISTS 'ted';
ALTER TYPE public.financeiro_tipo_documento ADD VALUE IF NOT EXISTS 'doc';
ALTER TYPE public.financeiro_tipo_documento ADD VALUE IF NOT EXISTS 'darf';
ALTER TYPE public.financeiro_tipo_documento ADD VALUE IF NOT EXISTS 'das';
ALTER TYPE public.financeiro_tipo_documento ADD VALUE IF NOT EXISTS 'gps';
ALTER TYPE public.financeiro_tipo_documento ADD VALUE IF NOT EXISTS 'gnre';