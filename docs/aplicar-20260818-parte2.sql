-- =============================================================================
-- Praefectus — migrations 20260818000007 e 20260818000008
-- Projeto: uwtyuwktxalnpgrcbbgk — CONFIRA A URL ANTES DE EXECUTAR
-- Copia consolidada; a fonte de verdade fica em supabase/migrations/
-- =============================================================================
BEGIN;

-- =============================================================================
-- Documentos são da EMPRESA, não de quem fez o upload
--
-- `documentos` nasceu sem `empresa_id` e com RLS `auth.uid() = user_id`. Na
-- prática: a CND que o dono baixou da Receita é invisível para o financeiro,
-- que é justamente quem precisa dela para acompanhar a NF-e. O kit de
-- faturamento sairia vazio, e nem daria erro — só não teria nada dentro.
--
-- Mesmo princípio já codificado para licitações (CLAUDE.md, princípio 2):
-- certidão negativa é da pessoa jurídica, não da pessoa física que a emitiu.
--
-- Resolução da empresa no backfill, por ordem de confiança — mesma disciplina
-- de 20260808000004 (backfill de licitacoes):
--   a) empresa ativa do perfil, se o usuário for mesmo membro dela;
--   b) a única empresa do usuário, quando ele só pertence a uma.
-- Usuário ambíguo fica de fora: chutar contaminaria uma empresa com documento
-- de outra, e documento de habilitação errado reprova em licitação.
-- =============================================================================

ALTER TABLE public.documentos
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE;

WITH empresa_unica AS (
  SELECT user_id, (min(empresa_id::text))::uuid AS empresa_id
    FROM public.empresa_membros
   GROUP BY user_id
  HAVING count(DISTINCT empresa_id) = 1
),
resolucao AS (
  SELECT d.id,
         COALESCE(
           CASE
             WHEN EXISTS (
               SELECT 1 FROM public.empresa_membros m
                WHERE m.user_id = d.user_id
                  AND m.empresa_id = p.empresa_ativa_id
             ) THEN p.empresa_ativa_id
           END,
           eu.empresa_id
         ) AS empresa_id
    FROM public.documentos d
    LEFT JOIN public.profiles p      ON p.user_id = d.user_id
    LEFT JOIN empresa_unica  eu      ON eu.user_id = d.user_id
   WHERE d.empresa_id IS NULL
)
UPDATE public.documentos d
   SET empresa_id = r.empresa_id
  FROM resolucao r
 WHERE r.id = d.id
   AND r.empresa_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_documentos_empresa_validade
  ON public.documentos(empresa_id, validade);

-- ── RLS: a empresa inteira lê e mantém ───────────────────────────────────────
--
-- O fallback por `user_id` continua para documento que o backfill não conseguiu
-- resolver — sem ele, quem subiu perderia acesso ao próprio arquivo.
DROP POLICY IF EXISTS "Users can CRUD own documentos" ON public.documentos;
DROP POLICY IF EXISTS "Membros gerenciam documentos da empresa" ON public.documentos;

CREATE POLICY "Membros gerenciam documentos da empresa" ON public.documentos
  FOR ALL TO authenticated
  USING (
    public.is_empresa_member(auth.uid(), empresa_id)
    OR (empresa_id IS NULL AND auth.uid() = user_id)
  )
  WITH CHECK (
    public.is_empresa_member(auth.uid(), empresa_id)
    OR (empresa_id IS NULL AND auth.uid() = user_id)
  );

COMMENT ON COLUMN public.documentos.empresa_id IS
  'Empresa dona do documento. Certidão, contrato social e atestado são da '
  'pessoa jurídica — o financeiro precisa alcançar o que o comercial subiu. '
  'Nulo só em registro antigo que o backfill não conseguiu resolver.';

-- =============================================================================
-- Normaliza as unidades já gravadas
--
-- O levantamento mostrou o mesmo conceito escrito de três formas:
--   UNIDADE (23) · UND (15) · Unidade (15)  →  53 registros, contados como três
--   caixa (9) · CAIXA (3)                   →  12 registros, contados como dois
--
-- Não vieram do cadastro de produto: vieram da extração de editais e contratos,
-- que grava o que o órgão escreveu. A normalização na entrada foi para o código
-- no mesmo commit; isto resolve o que já está no banco, para relatório parar de
-- contar o mesmo item duas vezes.
--
-- O que NÃO é tocado, de propósito:
--   • 'Embalagem 2 L' e similares — é descrição de embalagem no campo errado.
--     Converter exigiria adivinhar (embalagem? litro? 2 litros?), e adivinhar
--     aqui apaga a informação que o edital trouxe. Fica para revisão humana.
--   • qualquer código que já esteja canônico.
--
-- Só as equivalências que são inequívocas. Na dúvida, não mexer: unidade errada
-- em item de contrato vira quantidade errada na entrega.
-- =============================================================================

DO $$
DECLARE
  t text;
  -- (grafia gravada, código canônico) — espelho de src/lib/unidades.ts
  mapa text[][] := ARRAY[
    ['UNIDADE', 'UN'], ['UND', 'UN'], ['UNID', 'UN'], ['UNID.', 'UN'], ['U', 'UN'],
    ['CAIXA', 'CX'], ['CX.', 'CX'],
    ['QUILO', 'KG'], ['QUILOS', 'KG'], ['KG.', 'KG'],
    ['LITRO', 'L'], ['LITROS', 'L'],
    ['PACOTE', 'PCT'], ['PACOTES', 'PCT'],
    ['METRO', 'M'], ['METROS', 'M'],
    ['PECA', 'PC'], ['PEÇA', 'PC'],
    ['SACO', 'SC'], ['SACOS', 'SC'],
    ['FRASCO', 'FR'], ['FRC', 'FR'],
    ['LATA', 'LT'],
    ['DUZIA', 'DZ'], ['DÚZIA', 'DZ'],
    ['SERVICO', 'SERV'], ['SERVIÇO', 'SERV'], ['SV', 'SERV'],
    ['HORA', 'HR'], ['HORAS', 'HR']
  ];
  par text[];
  tabelas text[] := ARRAY[
    'produtos', 'contrato_itens', 'licitacao_itens', 'edital_itens_extraidos',
    'catalogo_itens_precificados', 'pedido_itens', 'itens_pedido_compra',
    'nota_fiscal_itens', 'pre_nota_itens', 'quotation_items',
    'shopping_list_items', 'products_normalized', 'agent_itens_edital',
    'agent_historico_precos'
  ];
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    -- Tabela que não existir neste ambiente é ignorada, não derruba a migration.
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;

    FOREACH par SLICE 1 IN ARRAY mapa LOOP
      EXECUTE format(
        'UPDATE public.%I SET unidade = %L
          WHERE upper(btrim(unidade)) = upper(%L) AND unidade <> %L',
        t, par[2], par[1], par[2]);
    END LOOP;
  END LOOP;
END $$;

-- Conferência (rode depois; o esperado é uma linha por código canônico):
--   SELECT unidade, count(*) FROM public.contrato_itens
--    WHERE unidade IS NOT NULL GROUP BY 1 ORDER BY 2 DESC;

COMMIT;
