-- ═══════════════════════════════════════════════════════════════════════════
-- Prazo lido sem cláusula que o sustente sai do contrato
-- Data: 2026-09-18
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Caso que fixou a regra (contrato 17/2025, GRUPO SANTA ROSA, 17/09): uma nota
-- de empenho relida pela IA pôs no contrato `prazo_entrega_dias = 481`, com a
-- "cláusula" "23/04/2026 Inclusão 481,78950 38,0000 18.308,00" — a linha de um
-- item (481,79 kg × R$ 38,00), lida como se fosse dias. A tela de Pedidos
-- passaria a calcular data-limite com 481 dias.
--
-- A leitura nova (front `validateExtractedContract` + função
-- `extrair-contrato-pdf`) já recusa prazo cuja frase citada não fala em prazo.
-- Este SQL acerta o que JÁ está gravado, nos três prazos (entrega, ateste,
-- pagamento), e deixa trilha em `contrato_ia_auditoria`.
--
-- Só mexe onde HÁ frase citada e ela não fala em prazo. Prazo preenchido à mão
-- pelo lápis não tem frase (cláusula NULL) e fica como está.
--
-- Idempotente: a segunda execução não encontra linha nenhuma.
-- REVERSÃO: os valores apagados estão em `contrato_ia_auditoria`
--   (origem = 'ia_rejeicao', campo = '<prazo>_dias', valor_anterior).

-- ── Entrega ──────────────────────────────────────────────────────────────────
INSERT INTO public.contrato_ia_auditoria (contrato_id, campo, valor_anterior, valor_novo, origem, user_id)
SELECT c.id, 'prazo_entrega_dias', c.prazo_entrega_dias::text,
       json_build_object('motivo', 'cláusula citada não fala em prazo (quantidade, valor ou data lida como dias)',
                         'clausula', c.prazo_entrega_clausula)::text,
       'ia_rejeicao', c.user_id
  FROM public.contratos c
 WHERE c.prazo_entrega_dias IS NOT NULL
   AND c.prazo_entrega_clausula IS NOT NULL
   AND c.prazo_entrega_clausula !~* '\m(dia|dias|úteis|uteis|corrido|corridos|prazo|prazos|hora|horas|imediata|imediato)\M';

UPDATE public.contratos c
   SET prazo_entrega_dias = NULL, prazo_entrega_unidade = NULL, prazo_entrega_clausula = NULL
 WHERE c.prazo_entrega_dias IS NOT NULL
   AND c.prazo_entrega_clausula IS NOT NULL
   AND c.prazo_entrega_clausula !~* '\m(dia|dias|úteis|uteis|corrido|corridos|prazo|prazos|hora|horas|imediata|imediato)\M';

-- ── Ateste (recebimento definitivo, art. 140) ────────────────────────────────
INSERT INTO public.contrato_ia_auditoria (contrato_id, campo, valor_anterior, valor_novo, origem, user_id)
SELECT c.id, 'prazo_recebimento_dias', c.prazo_recebimento_dias::text,
       json_build_object('motivo', 'cláusula citada não fala em prazo', 'clausula', c.prazo_recebimento_clausula)::text,
       'ia_rejeicao', c.user_id
  FROM public.contratos c
 WHERE c.prazo_recebimento_dias IS NOT NULL
   AND c.prazo_recebimento_clausula IS NOT NULL
   AND c.prazo_recebimento_clausula !~* '\m(dia|dias|úteis|uteis|corrido|corridos|prazo|prazos|hora|horas|imediata|imediato)\M';

UPDATE public.contratos c
   SET prazo_recebimento_dias = NULL, prazo_recebimento_unidade = NULL, prazo_recebimento_clausula = NULL
 WHERE c.prazo_recebimento_dias IS NOT NULL
   AND c.prazo_recebimento_clausula IS NOT NULL
   AND c.prazo_recebimento_clausula !~* '\m(dia|dias|úteis|uteis|corrido|corridos|prazo|prazos|hora|horas|imediata|imediato)\M';

-- ── Pagamento (art. 92, VI) ──────────────────────────────────────────────────
INSERT INTO public.contrato_ia_auditoria (contrato_id, campo, valor_anterior, valor_novo, origem, user_id)
SELECT c.id, 'prazo_pagamento_dias', c.prazo_pagamento_dias::text,
       json_build_object('motivo', 'cláusula citada não fala em prazo', 'clausula', c.prazo_pagamento_clausula)::text,
       'ia_rejeicao', c.user_id
  FROM public.contratos c
 WHERE c.prazo_pagamento_dias IS NOT NULL
   AND c.prazo_pagamento_clausula IS NOT NULL
   AND c.prazo_pagamento_clausula !~* '\m(dia|dias|úteis|uteis|corrido|corridos|prazo|prazos|hora|horas|imediata|imediato)\M';

UPDATE public.contratos c
   SET prazo_pagamento_dias = NULL, prazo_pagamento_unidade = NULL, prazo_pagamento_marco = NULL,
       prazo_pagamento_clausula = NULL
 WHERE c.prazo_pagamento_dias IS NOT NULL
   AND c.prazo_pagamento_clausula IS NOT NULL
   AND c.prazo_pagamento_clausula !~* '\m(dia|dias|úteis|uteis|corrido|corridos|prazo|prazos|hora|horas|imediata|imediato)\M';

-- ── Contrato 17/2025: a assinatura que o empenho apagou ──────────────────────
-- Em 30/08 o instrumento ("CTR ADM Nº 17.2025 GSR.pdf") foi lido como assinado
-- pelas duas partes (trilha `contrato_ia_auditoria`, origem 'ia_extracao':
-- "HELIO ANTÔNIO LAMEIRA DE ALMEIDA - Diretor Geral e RAFAEL WILLIAM CASTRO DA
-- SILVA - Sócio Administrador"). Em 17/09 a releitura da NE000021-2026 gravou
-- por cima `so_orgao` ("Órgão: ALDELICE DIAS ALVES - CHEFE"), e o painel passou
-- a mandar não iniciar a execução. Volta ao que o instrumento diz — e só se o
-- valor errado ainda estiver lá (idempotente; a correção manual não é tocada).
UPDATE public.contratos
   SET assinatura_situacao   = 'ambas',
       assinatura_origem     = 'documento',
       assinatura_observacao = 'Órgão: HELIO ANTÔNIO LAMEIRA DE ALMEIDA - Diretor Geral · Contratada: RAFAEL WILLIAM CASTRO DA SILVA - Sócio Administrador'
 WHERE id = 'b81fdb91-a9fd-4d39-be77-53ed6cb3ace9'
   AND assinatura_situacao = 'so_orgao'
   AND assinatura_observacao LIKE 'Órgão: ALDELICE DIAS ALVES%';

NOTIFY pgrst, 'reload schema';
