-- ============================================================================
-- Atestados de capacidade técnica passam a ser da EMPRESA
--
-- Estavam presos ao usuário que subiu o arquivo: `documentos.empresa_id` nulo,
-- arquivo em `<user_id>/` no storage. O efeito era duplo e nenhum deles é
-- aceitável para o documento:
--
--   - colega da mesma empresa não via o atestado;
--   - a montagem automática da pasta de habilitação FALHAVA ao baixá-lo, porque
--     as policies de storage só liberam a pasta do próprio dono.
--
-- A correção do escopo é a certa, e a razão é do dono do produto: o atestado é
-- emitido por órgão público ou empresa privada, assinado por representante, e
-- integra a documentação de habilitação do certame. É da empresa que se
-- habilita, não de quem digitalizou o papel.
--
-- ⚠️ Esta migration move apenas o VÍNCULO da linha. O ARQUIVO no storage é
-- movido pela função `normalizar-arquivos-documentos`, que já existe e já faz
-- exatamente isso para o resto do cofre — rode-a depois desta. A ordem importa:
-- sem `empresa_id` na linha, ela não sabe para onde mover.
--
-- Idempotente: rodar de novo não reprocessa o que já tem empresa.
-- ============================================================================

-- ── 1. Quem é a empresa de cada atestado órfão ──────────────────────────────
--
-- A empresa vem da associação do dono em `empresa_membros`. Quando a pessoa é
-- membro de UMA empresa só, não há ambiguidade e a conversão é segura.
--
-- Quem é membro de várias fica de fora, de propósito: escolher por ele seria
-- adivinhar de qual empresa é o atestado, e atestado atribuído à empresa errada
-- é pior que atestado invisível — ele entra numa habilitação que não deveria.
-- Esses casos aparecem na consulta de conferência do fim deste arquivo.

WITH dono_de_uma_empresa AS (
  SELECT user_id, MIN(empresa_id) AS empresa_id
    FROM public.empresa_membros
   GROUP BY user_id
  HAVING COUNT(DISTINCT empresa_id) = 1
)
UPDATE public.documentos d
   SET empresa_id = u.empresa_id,
       updated_at = now()
  FROM dono_de_uma_empresa u
 WHERE d.user_id = u.user_id
   AND d.empresa_id IS NULL
   AND d.nome LIKE 'ACT %';

-- ── 2. Conferência ──────────────────────────────────────────────────────────
--
-- Não é parte da migração: é o que se olha depois de rodar. Devolve os
-- atestados que continuaram órfãos e o motivo, para a decisão ser tomada com
-- nome e número na frente em vez de no escuro.

DO $$
DECLARE
  v_convertidos integer;
  v_orfaos integer;
  v_ambiguos integer;
BEGIN
  SELECT count(*) INTO v_convertidos
    FROM public.documentos
   WHERE nome LIKE 'ACT %' AND empresa_id IS NOT NULL;

  SELECT count(*) INTO v_orfaos
    FROM public.documentos
   WHERE nome LIKE 'ACT %' AND empresa_id IS NULL;

  SELECT count(*) INTO v_ambiguos
    FROM public.documentos d
   WHERE d.nome LIKE 'ACT %'
     AND d.empresa_id IS NULL
     AND EXISTS (
       SELECT 1 FROM public.empresa_membros m
        WHERE m.user_id = d.user_id
        GROUP BY m.user_id HAVING COUNT(DISTINCT m.empresa_id) > 1
     );

  RAISE NOTICE 'Atestados com empresa: %', v_convertidos;
  RAISE NOTICE 'Atestados ainda sem empresa: % (destes, % pertencem a quem é membro de mais de uma empresa e exigem escolha manual)',
    v_orfaos, v_ambiguos;
  IF v_orfaos > 0 THEN
    RAISE NOTICE 'Os que sobraram continuam visíveis para o próprio dono — nada foi perdido.';
  END IF;
END $$;

-- ── 3. O arquivo, depois da linha ───────────────────────────────────────────
--
-- Para mover os arquivos de `<user_id>/…` para `empresa/<empresa_id>/…`, chame
-- a edge function que já existe:
--
--   POST <projeto>/functions/v1/normalizar-arquivos-documentos
--
-- Ela varre `documentos` com `empresa_id` cujo `arquivo_path` não começa com
-- `empresa/`, move no storage e atualiza a coluna. É idempotente e trata
-- colisão de nome. Enquanto ela não roda, o atestado aparece para a equipe mas
-- o download falha para quem não é o dono — o vínculo já mudou, o arquivo não.

NOTIFY pgrst, 'reload schema';
