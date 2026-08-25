-- ─────────────────────────────────────────────────────────────────────────────
-- Regime tributário: uma fonte só, e as apurações feitas sob a errada marcadas
-- ─────────────────────────────────────────────────────────────────────────────
--
-- O regime morava em dois lugares que não se falavam:
--
--   empresas.regime_tributario            'simples_nacional' | 'lucro_presumido' | 'lucro_real'
--   financeiro_config_tributaria.regime   'simples'          | 'presumido'       | 'real'
--
-- Nada sincronizava — nem poderia, porque as palavras diferem. Pior: a coluna
-- do Financeiro tem DEFAULT 'simples'. Empresa cadastrada como Lucro Presumido
-- que nunca abriu a aba de configuração do Financeiro era apurada como Simples
-- Nacional, por uma tabela (Anexo I) que termina em R$ 4.800.000 de RBT12 —
-- e a tela estendia a sexta faixa em silêncio quando o faturamento passava
-- disso.
--
-- A partir daqui o front lê o regime SÓ de `empresas.regime_tributario`. Esta
-- migration alinha o dado que já está gravado e deixa rastro do que foi
-- apurado sob a premissa errada.

-- ── 1. Alinha a coluna legada ao cadastro ────────────────────────────────────
-- A coluna não é removida: ela ainda é gravada por `salvarConfig` junto das
-- alíquotas, e apagá-la quebraria o upsert. Deixa de DECIDIR, passa a espelhar.
UPDATE public.financeiro_config_tributaria c
   SET regime = CASE e.regime_tributario
                  WHEN 'simples_nacional' THEN 'simples'
                  WHEN 'lucro_presumido'  THEN 'presumido'
                  WHEN 'lucro_real'       THEN 'real'
                  ELSE c.regime
                END
  FROM public.empresas e
 WHERE e.id = c.empresa_id
   AND e.regime_tributario IS NOT NULL
   AND c.regime IS DISTINCT FROM CASE e.regime_tributario
                                   WHEN 'simples_nacional' THEN 'simples'
                                   WHEN 'lucro_presumido'  THEN 'presumido'
                                   WHEN 'lucro_real'       THEN 'real'
                                 END;

COMMENT ON COLUMN public.financeiro_config_tributaria.regime IS
  'ESPELHO de empresas.regime_tributario — não é a fonte. Quem decide o regime '
  'é o cadastro da empresa (Configurações); esta coluna é mantida em sincronia '
  'para não quebrar o upsert das alíquotas. Ver src/lib/tributario/regime.ts.';

-- ── 2. Marca as apurações calculadas sob o regime errado ─────────────────────
-- As colunas de "desatualizada" já existem e já são usadas pela tela. Reusá-las
-- é melhor do que inventar uma sinalização nova: quem abre o histórico já sabe
-- ler esse aviso.
UPDATE public.financeiro_apuracoes a
   SET apuracao_desatualizada = true,
       desatualizada_motivo   = 'Apurada como ' || a.regime || ', mas o regime da empresa é '
                                || CASE e.regime_tributario
                                     WHEN 'simples_nacional' THEN 'simples'
                                     WHEN 'lucro_presumido'  THEN 'presumido'
                                     WHEN 'lucro_real'       THEN 'real'
                                   END
                                || '. Recalcular antes de usar.',
       desatualizada_em       = now()
  FROM public.empresas e
 WHERE e.id = a.empresa_id
   AND e.regime_tributario IS NOT NULL
   AND a.regime IS DISTINCT FROM CASE e.regime_tributario
                                   WHEN 'simples_nacional' THEN 'simples'
                                   WHEN 'lucro_presumido'  THEN 'presumido'
                                   WHEN 'lucro_real'       THEN 'real'
                                 END
   AND COALESCE(a.apuracao_desatualizada, false) = false;

-- ── 3. Conferência ───────────────────────────────────────────────────────────
-- Roda depois e mostra em que pé ficou cada empresa.
--
--   SELECT e.razao_social,
--          e.regime_tributario                    AS cadastro,
--          c.regime                               AS espelho_financeiro,
--          count(a.id) FILTER (WHERE a.apuracao_desatualizada) AS apuracoes_a_recalcular
--     FROM public.empresas e
--     LEFT JOIN public.financeiro_config_tributaria c ON c.empresa_id = e.id
--     LEFT JOIN public.financeiro_apuracoes a         ON a.empresa_id = e.id
--    GROUP BY 1,2,3
--    ORDER BY 1;
