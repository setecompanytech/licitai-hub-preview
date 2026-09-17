-- ═══════════════════════════════════════════════════════════════════════════
-- A pasta existe para todo processo do quadro
-- Data: 2026-09-17
-- ═══════════════════════════════════════════════════════════════════════════
--
-- O Kanban lê `licitacoes` (da EMPRESA, princípio 2). A aba Compromissos lia
-- `processos_interesse` (PESSOAL, RLS por auth.uid()). Medição de 17/09 na O S
-- DISTRIBUIDORA: 31 processos no quadro, 2 pastas na aba — 22 pertenciam a um
-- colega e 5 processos não tinham pasta nenhuma.
--
-- A tela passou a listar o quadro da empresa com o compromisso pessoal por
-- cima. Este SQL acerta o que já está gravado:
--
--   1. empresa nos compromissos órfãos ...... 68 linhas de 70
--   2. desfaz a duplicata (usuário, licitação) ... 1 caso
--   3. trava a duplicidade com índice único
--   4. cria a pasta faltante para o DONO de cada processo ... 29 linhas
--
-- Tudo idempotente: rodar de novo não cria nada nem apaga o que foi decidido
-- depois (status pessoal, alertas e score ficam como estão).
--
-- REVERSÃO: `DROP INDEX IF EXISTS public.uq_processos_interesse_user_licitacao;`
-- As linhas criadas em (4) podem ser removidas por
-- `DELETE FROM public.processos_interesse WHERE created_at >= '<data da aplicação>'
--    AND status = 'interessado';` — confira antes, a decisão pessoal pode ter mudado.

-- ── 1. Compromisso sem empresa ───────────────────────────────────────────────
-- Nasciam assim porque `criarCompromisso` era chamado sem o terceiro parâmetro.
-- O código já não faz isso; aqui fica o passado.
UPDATE public.processos_interesse pi
   SET empresa_id = l.empresa_id
  FROM public.licitacoes l
 WHERE pi.licitacao_id = l.id
   AND pi.empresa_id IS NULL
   AND l.empresa_id IS NOT NULL;

-- ── 2. Duplicata por (usuário, licitação) ────────────────────────────────────
-- Mantém a mais ANTIGA: é a que carrega o histórico de alertas enviados.
DELETE FROM public.processos_interesse pi
 USING public.processos_interesse manter
 WHERE pi.licitacao_id IS NOT NULL
   AND manter.licitacao_id = pi.licitacao_id
   AND manter.user_id = pi.user_id
   AND (manter.created_at, manter.id) < (pi.created_at, pi.id);

-- ── 3. Uma pasta por pessoa e processo ───────────────────────────────────────
-- A tabela não tinha índice nenhum além da chave primária. O parcial deixa
-- livres os compromissos ainda sem processo (pasta criada antes da licitação).
CREATE UNIQUE INDEX IF NOT EXISTS uq_processos_interesse_user_licitacao
  ON public.processos_interesse (user_id, licitacao_id)
  WHERE licitacao_id IS NOT NULL;

-- ── 4. Pasta para o dono de cada processo ────────────────────────────────────
-- Só para quem cadastrou (`licitacoes.user_id`): criar para todos os membros
-- encheria a aba de cada colega com decisões que ninguém tomou. Quem abrir um
-- processo do colega ganha a própria pasta pelo app, quando acompanhar.
INSERT INTO public.processos_interesse (
  user_id, empresa_id, licitacao_id, numero, orgao, objeto, modalidade,
  valor_estimado, uf, municipio, data_abertura, data_encerramento, portal, url,
  status, alerta_sistema, alerta_email, alerta_whatsapp,
  alerta_7dias, alerta_3dias, alerta_1dia
)
SELECT l.user_id,
       l.empresa_id,
       l.id,
       l.numero,
       l.orgao,
       l.objeto,
       l.modalidade,
       l.valor_estimado,
       l.uf,
       l.municipio,
       COALESCE(l.data_abertura, l.data_encerramento),
       l.data_encerramento,
       l.portal,
       l.url_edital,
       -- Processo já arquivado não volta para a mesa de trabalho por causa
       -- deste backfill.
       CASE WHEN l.arquivado_em IS NOT NULL THEN 'arquivado' ELSE 'interessado' END,
       true, true, false,
       true, true, true
  FROM public.licitacoes l
 WHERE l.user_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM public.processos_interesse pi
      WHERE pi.licitacao_id = l.id AND pi.user_id = l.user_id
   )
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
