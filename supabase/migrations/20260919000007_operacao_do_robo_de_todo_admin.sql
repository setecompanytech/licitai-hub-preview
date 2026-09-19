-- ═══════════════════════════════════════════════════════════════════════════
-- Operação × oficina técnica: a operação do robô volta a todo admin
-- Data: 2026-09-19
-- ═══════════════════════════════════════════════════════════════════════════
--
-- A 20260919000006 deu a infraestrutura INTEIRA do robô só à conta de
-- engenharia (engsoft@). Revista no mesmo dia (Ian, 19/09): quem opera o robô
-- toda manhã é o Rafael, pelo login da Santa Rosa (CNPJ dele, admin da
-- plataforma). Obrigá-lo a um segundo login, num segundo perfil do Chrome, para
-- o clique diário no captcha é atrito; captcha perdido é disputa perdida. E o
-- que ele chamou de "poluição visual" em 18/09 foram os cartões técnicos —
-- agente, RAM, portais no ar, checklist —, não a tela remota.
--
-- A regra passa a ser por NATUREZA:
--
--   operação (todo admin da plataforma, `has_role(... 'admin')`) — volta aqui:
--     sessoes_lance_real  "Plataforma lê sessões do robô"   (aba Sessões)
--     robo_historico      "Plataforma lê o histórico do robô"
--     robo_avisos_portal  "Clientes leem avisos vigentes" e "Plataforma escreve avisos"
--     nomes_de_empresas_para_plataforma (nomes no histórico)
--
--   oficina técnica (só a conta de engenharia, `sou_conta_de_engenharia()`) —
--   fica como a 000006 deixou:
--     agente_externo_config "Plataforma lê configuração dos agentes"
--     webhook_log           "Plataforma lê registro de chamadas" (Diagnóstico)
--     contas_para_plataforma (dono de cada agente, na aba do agente)
--
-- Na tela, o mesmo corte: `AdminRoboLances` mostra Agente e infraestrutura e
-- Diagnóstico só à conta de engenharia. No servidor, `robo-lances-webhook`
-- separa `ehAdmin` (operação) de `verDetalhe` (o cru técnico).
--
-- O que NÃO muda: cada cliente segue lendo só as próprias sessões, o próprio
-- agente e o próprio registro, pelas regras de dono e de membro da empresa.
-- A conta de engenharia continua admin: `has_role` a inclui.
--
-- Idempotente (CREATE OR REPLACE + DROP POLICY IF EXISTS). Os textos são os
-- originais de 20260914000004 e 20260917000004. REVERSÃO: rodar de novo os
-- blocos correspondentes da 20260919000006.

-- ── Operação: leitura entre empresas volta a todo admin ─────────────────────

DROP POLICY IF EXISTS "Plataforma lê sessões do robô" ON public.sessoes_lance_real;
CREATE POLICY "Plataforma lê sessões do robô"
ON public.sessoes_lance_real FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Plataforma lê o histórico do robô" ON public.robo_historico;
CREATE POLICY "Plataforma lê o histórico do robô"
ON public.robo_historico FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ── Avisos aos clientes: cliente lê o vigente; todo admin escreve e vê todos ─

DROP POLICY IF EXISTS "Clientes leem avisos vigentes" ON public.robo_avisos_portal;
CREATE POLICY "Clientes leem avisos vigentes"
ON public.robo_avisos_portal FOR SELECT TO authenticated
USING (
  (ativo AND inicio_em <= now() AND (fim_em IS NULL OR fim_em > now()))
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Plataforma escreve avisos" ON public.robo_avisos_portal;
CREATE POLICY "Plataforma escreve avisos"
ON public.robo_avisos_portal FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ── Nomes das empresas no histórico: todo admin ─────────────────────────────

CREATE OR REPLACE FUNCTION public.nomes_de_empresas_para_plataforma(p_ids uuid[])
RETURNS TABLE (id uuid, razao_social text, nome_fantasia text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Consulta exclusiva da operação Praefectus.';
  END IF;
  RETURN QUERY
    SELECT e.id, e.razao_social::text, e.nome_fantasia::text
      FROM public.empresas e
     WHERE e.id = ANY (p_ids);
END $$;

REVOKE ALL ON FUNCTION public.nomes_de_empresas_para_plataforma(uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.nomes_de_empresas_para_plataforma(uuid[]) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ── Conferência (rodar depois) ──────────────────────────────────────────────
-- Esperado: 4 regras com has_role (operação) e 2 com sou_conta_de_engenharia
-- (oficina técnica).
--
-- SELECT tablename, policyname,
--        CASE WHEN coalesce(qual, '') || coalesce(with_check, '') LIKE '%sou_conta_de_engenharia%'
--             THEN 'oficina técnica (engsoft@)' ELSE 'operação (todo admin)' END AS quem
--   FROM pg_policies
--  WHERE schemaname = 'public'
--    AND policyname IN ('Plataforma lê configuração dos agentes', 'Plataforma lê sessões do robô',
--                       'Plataforma lê registro de chamadas', 'Plataforma lê o histórico do robô',
--                       'Clientes leem avisos vigentes', 'Plataforma escreve avisos')
--  ORDER BY quem, tablename;
