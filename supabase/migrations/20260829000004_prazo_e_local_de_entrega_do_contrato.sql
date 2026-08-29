-- ═══════════════════════════════════════════════════════════════════════════
-- Prazo de entrega, local de entrega e prazo de recebimento
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Todo contrato administrativo e toda ata de registro de preços dizem, por
-- escrito, três coisas que o sistema não guardava em lugar nenhum:
--
--   1. em quanto tempo entregar depois do pedido;
--   2. onde entregar;
--   3. em quanto tempo o órgão recebe e atesta o objeto.
--
-- São obrigações com prazo. Estourar a primeira é inadimplemento contratual
-- (Lei 14.133/2021, art. 137, II) e abre caminho para as sanções do art. 156.
-- A terceira governa quando a nota pode ser paga — art. 140, §1º.
--
-- Sem esses campos, quem lança um pedido no sistema não tem como saber quando
-- ele vence, e a tela de Pedidos exibe a data do pedido sem nada dizer sobre o
-- prazo que começou a correr naquele instante.
--
-- ── Por que dias E texto ────────────────────────────────────────────────────
-- O número é o que permite calcular a data-limite. A frase literal é o que
-- permite CONFERIR o número — quem lê "10 (dez) dias úteis, contados do
-- recebimento da ordem de fornecimento" sabe imediatamente se o 10 gravado
-- está certo. Prazo extraído por IA que dispara aviso sem deixar conferir de
-- onde saiu é palpite com aparência de obrigação.
--
-- ── Por que a unidade é coluna, e não convenção ─────────────────────────────
-- "10 dias úteis" e "10 dias corridos" são prazos diferentes — em dezembro, a
-- diferença passa de uma semana. Guardar só o número e supor a unidade é a
-- forma mais fácil de o sistema avisar no dia errado, que é pior do que não
-- avisar: quem confia no aviso perde o prazo confiando.

ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS prazo_entrega_dias        integer,
  ADD COLUMN IF NOT EXISTS prazo_entrega_unidade     text,
  ADD COLUMN IF NOT EXISTS prazo_entrega_clausula    text,
  ADD COLUMN IF NOT EXISTS local_entrega             text,
  ADD COLUMN IF NOT EXISTS local_entrega_clausula    text,
  ADD COLUMN IF NOT EXISTS prazo_recebimento_dias    integer,
  ADD COLUMN IF NOT EXISTS prazo_recebimento_unidade text,
  ADD COLUMN IF NOT EXISTS prazo_recebimento_clausula text;

COMMENT ON COLUMN public.contratos.prazo_entrega_dias IS
  'Prazo para entregar, em dias, contado do pedido / ordem de fornecimento. '
  'Nulo significa que ninguém registrou — não que o prazo seja zero ou que não '
  'exista. A tela de Pedidos avisa quando está nulo em vez de calcular sozinha.';

COMMENT ON COLUMN public.contratos.prazo_entrega_unidade IS
  'uteis | corridos. Sem isso, "10 dias" é ambíguo e o aviso cai no dia errado '
  '— em dezembro a diferença entre as duas leituras passa de uma semana.';

COMMENT ON COLUMN public.contratos.prazo_entrega_clausula IS
  'A frase literal do contrato de onde o prazo saiu. É o que permite conferir '
  'o número: prazo extraído por IA que dispara aviso sem deixar ver a origem é '
  'palpite com aparência de obrigação.';

COMMENT ON COLUMN public.contratos.local_entrega IS
  'Onde entregar, como o contrato descreve — endereço, unidade, almoxarifado, '
  'ou a regra ("nas unidades indicadas na ordem de fornecimento").';

COMMENT ON COLUMN public.contratos.prazo_recebimento_dias IS
  'Prazo do órgão para receber e atestar o objeto (Lei 14.133/2021, art. 140). '
  'Governa quando a nota pode ser apresentada e paga; contado da entrega.';

COMMENT ON COLUMN public.contratos.prazo_recebimento_unidade IS
  'uteis | corridos, pela mesma razão do prazo de entrega.';

-- ── Coerência ───────────────────────────────────────────────────────────────
-- Unidade só aceita as duas que existem em contrato público brasileiro. E
-- unidade sem prazo não significa nada: ou os dois, ou nenhum.
ALTER TABLE public.contratos
  DROP CONSTRAINT IF EXISTS chk_prazo_entrega_unidade;
ALTER TABLE public.contratos
  ADD CONSTRAINT chk_prazo_entrega_unidade
  CHECK (
    prazo_entrega_unidade IS NULL
    OR (prazo_entrega_unidade IN ('uteis','corridos') AND prazo_entrega_dias IS NOT NULL)
  ) NOT VALID;

ALTER TABLE public.contratos
  DROP CONSTRAINT IF EXISTS chk_prazo_recebimento_unidade;
ALTER TABLE public.contratos
  ADD CONSTRAINT chk_prazo_recebimento_unidade
  CHECK (
    prazo_recebimento_unidade IS NULL
    OR (prazo_recebimento_unidade IN ('uteis','corridos') AND prazo_recebimento_dias IS NOT NULL)
  ) NOT VALID;

-- Prazo negativo ou absurdo é erro de leitura, não cláusula. Cinco anos de
-- folga cobre o contrato mais longo do art. 108 sem barrar caso legítimo.
ALTER TABLE public.contratos
  DROP CONSTRAINT IF EXISTS chk_prazos_plausiveis;
ALTER TABLE public.contratos
  ADD CONSTRAINT chk_prazos_plausiveis
  CHECK (
    (prazo_entrega_dias     IS NULL OR prazo_entrega_dias     BETWEEN 1 AND 1825)
    AND (prazo_recebimento_dias IS NULL OR prazo_recebimento_dias BETWEEN 1 AND 1825)
  ) NOT VALID;

-- ── Conferência ─────────────────────────────────────────────────────────────
--
--   SELECT numero_contrato,
--          prazo_entrega_dias, prazo_entrega_unidade,
--          local_entrega IS NOT NULL AS tem_local,
--          prazo_recebimento_dias, prazo_recebimento_unidade
--     FROM public.contratos
--    ORDER BY prazo_entrega_dias NULLS FIRST;
--
-- Enquanto nenhum documento for reprocessado, tudo vem nulo: as colunas só se
-- preenchem na próxima extração ou no preenchimento manual.
--
-- Depois de conferidas as cláusulas gravadas:
--   ALTER TABLE public.contratos VALIDATE CONSTRAINT chk_prazo_entrega_unidade;
--   ALTER TABLE public.contratos VALIDATE CONSTRAINT chk_prazo_recebimento_unidade;
--   ALTER TABLE public.contratos VALIDATE CONSTRAINT chk_prazos_plausiveis;
