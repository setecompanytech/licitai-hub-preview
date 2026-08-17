-- =============================================================================
-- Backfill: nome do membro que criou a própria empresa
--
-- `addEmpresa` inseria o vínculo do criador com apenas empresa_id, user_id e
-- papel — sem nome nem e-mail. Só o fluxo de convite os preenchia. Resultado:
-- o dono do negócio aparecia como "Colaborador" em toda tela que lista membros
-- (vendedor do contrato, metas, bonificação), e contrato atribuído a ele ficava
-- sem identificação visível.
--
-- A causa foi corrigida no front no mesmo commit; isto resolve o passado.
--
-- O nome vem de `profiles`, onde já existe. A tela NÃO pode fazer essa leitura:
-- a policy de profiles é `auth.uid() = user_id`, cada um lê só a si mesmo — e
-- afrouxá-la para exibir nomes de colegas seria trocar privacidade por rótulo.
-- Por isso o dado é copiado para empresa_membros, que é onde as telas leem.
--
-- Só toca linha SEM nenhuma identificação (nome, nome_individual e email
-- vazios) e só quando há nome no perfil: não sobrescreve nada preenchido, nem
-- apaga o que existe.
--
-- Rotina de uma vez: não há cron nem repetição. Rodar de novo é inofensivo —
-- as linhas já corrigidas deixam de casar com o WHERE.
-- =============================================================================

-- Prévia (opcional, rode antes para ver o que será alterado):
--   SELECT em.empresa_id, em.user_id, p.nome_completo, p.username
--     FROM public.empresa_membros em
--     JOIN public.profiles p ON p.user_id = em.user_id
--    WHERE COALESCE(NULLIF(em.nome_individual,''), NULLIF(em.nome,''), NULLIF(em.email,'')) IS NULL
--      AND COALESCE(NULLIF(p.nome_completo,''), NULLIF(p.username,'')) IS NOT NULL;

UPDATE public.empresa_membros em
   SET nome = COALESCE(NULLIF(p.nome_completo, ''), NULLIF(p.username, ''))
  FROM public.profiles p
 WHERE p.user_id = em.user_id
   AND COALESCE(NULLIF(em.nome_individual, ''), NULLIF(em.nome, ''), NULLIF(em.email, '')) IS NULL
   AND COALESCE(NULLIF(p.nome_completo, ''), NULLIF(p.username, '')) IS NOT NULL;
