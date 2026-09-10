-- ============================================================================
-- CAPAG municipal de verdade (10/09)
-- ============================================================================
-- A análise CAPAG só tinha dado oficial para ESTADOS (CSV pequeno do Tesouro
-- baixado a cada chamada); município era estimativa de IA. O Tesouro publica
-- a CAPAG de todos os municípios, mas num XLSX de 24MB — inviável de baixar
-- e parsear na edge a cada requisição. Solução: a planilha oficial (aba
-- "Prévia da CAPAG", posição 01/06/2026) vira esta tabela de referência,
-- semeada fora da migration; a edge capag-analysis consulta o banco.
--
-- Dados compartilhados de fonte pública (não têm empresa_id de propósito):
-- leitura para qualquer autenticado, escrita só via service_role (a RLS sem
-- policy de escrita bloqueia o resto). Indicadores na convenção de RAZÃO
-- DERIVADA do repo (fração 0–1): vêm de divisão feita pelo Tesouro, não de
-- alíquota transcrita.
CREATE TABLE IF NOT EXISTS public.capag_municipios (
  cod_ibge integer PRIMARY KEY,
  municipio text NOT NULL,
  uf text NOT NULL,
  capag text,
  indicador1 numeric,
  nota1 text,
  indicador2 numeric,
  nota2 text,
  indicador3 numeric,
  nota3 text,
  icf text,
  observacao text,
  origem_nota text,
  posicao date NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.capag_municipios IS
  'CAPAG oficial por município (Tesouro Nacional, planilha capag-municipios, aba Prévia da CAPAG). Indicadores em fração 0–1. Atualização semestral manual — ver SQL_MIGRATIONS.md.';

CREATE INDEX IF NOT EXISTS idx_capag_municipios_uf_nome
  ON public.capag_municipios (uf, lower(municipio));

ALTER TABLE public.capag_municipios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "capag_municipios_select" ON public.capag_municipios;
CREATE POLICY "capag_municipios_select" ON public.capag_municipios
  FOR SELECT TO authenticated USING (true);
