
-- ============================================
-- AUDIT: Fix ALL restrictive RLS policies
-- PostgreSQL requires at least 1 PERMISSIVE policy per operation.
-- All current policies are RESTRICTIVE → drop & recreate as PERMISSIVE.
-- ============================================

-- 1. apoio_juridico
DROP POLICY IF EXISTS "Users can CRUD own apoio_juridico" ON public.apoio_juridico;
CREATE POLICY "Users can CRUD own apoio_juridico" ON public.apoio_juridico FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2. assinaturas
DROP POLICY IF EXISTS "Admins can manage all subscriptions" ON public.assinaturas;
DROP POLICY IF EXISTS "Members can view own subscriptions" ON public.assinaturas;
CREATE POLICY "Admins can manage all subscriptions" ON public.assinaturas FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Members can view own subscriptions" ON public.assinaturas FOR SELECT TO authenticated USING (is_empresa_member(auth.uid(), empresa_id));

-- 3. boletim_envios
DROP POLICY IF EXISTS "Users can view own envios" ON public.boletim_envios;
CREATE POLICY "Users can view own envios" ON public.boletim_envios FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 4. boletim_preferencias
DROP POLICY IF EXISTS "Users can insert own preferences" ON public.boletim_preferencias;
DROP POLICY IF EXISTS "Users can update own preferences" ON public.boletim_preferencias;
DROP POLICY IF EXISTS "Users can view own preferences" ON public.boletim_preferencias;
CREATE POLICY "Users can insert own preferences" ON public.boletim_preferencias FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own preferences" ON public.boletim_preferencias FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view own preferences" ON public.boletim_preferencias FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 5. chat_messages
DROP POLICY IF EXISTS "Users can CRUD own chat" ON public.chat_messages;
CREATE POLICY "Users can CRUD own chat" ON public.chat_messages FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 6. concorrentes
DROP POLICY IF EXISTS "Users can delete own concorrentes" ON public.concorrentes;
DROP POLICY IF EXISTS "Users can insert own concorrentes" ON public.concorrentes;
DROP POLICY IF EXISTS "Users can update own concorrentes" ON public.concorrentes;
DROP POLICY IF EXISTS "Users can view own concorrentes" ON public.concorrentes;
CREATE POLICY "Users can delete own concorrentes" ON public.concorrentes FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own concorrentes" ON public.concorrentes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own concorrentes" ON public.concorrentes FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view own concorrentes" ON public.concorrentes FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 7. configuracoes
DROP POLICY IF EXISTS "Users can CRUD own config" ON public.configuracoes;
CREATE POLICY "Users can CRUD own config" ON public.configuracoes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 8. credenciais_portais
DROP POLICY IF EXISTS "Users can delete own credentials" ON public.credenciais_portais;
DROP POLICY IF EXISTS "Users can insert own credentials" ON public.credenciais_portais;
DROP POLICY IF EXISTS "Users can update own credentials" ON public.credenciais_portais;
DROP POLICY IF EXISTS "Users can view own credentials" ON public.credenciais_portais;
CREATE POLICY "Users can delete own credentials" ON public.credenciais_portais FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own credentials" ON public.credenciais_portais FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own credentials" ON public.credenciais_portais FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view own credentials" ON public.credenciais_portais FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 9. document_templates
DROP POLICY IF EXISTS "Admins can manage templates" ON public.document_templates;
DROP POLICY IF EXISTS "Authenticated users can view active templates" ON public.document_templates;
CREATE POLICY "Admins can manage templates" ON public.document_templates FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can view active templates" ON public.document_templates FOR SELECT TO authenticated USING (ativo = true);

-- 10. documentos
DROP POLICY IF EXISTS "Users can CRUD own documentos" ON public.documentos;
CREATE POLICY "Users can CRUD own documentos" ON public.documentos FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 11. faq
DROP POLICY IF EXISTS "Admins can manage FAQs" ON public.faq;
DROP POLICY IF EXISTS "Anyone can view active FAQs" ON public.faq;
CREATE POLICY "Admins can manage FAQs" ON public.faq FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can view active FAQs" ON public.faq FOR SELECT USING (ativo = true);

-- 12. kanban_tasks
DROP POLICY IF EXISTS "Users can CRUD own tasks" ON public.kanban_tasks;
CREATE POLICY "Users can CRUD own tasks" ON public.kanban_tasks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 13. lances
DROP POLICY IF EXISTS "Users can CRUD own lances" ON public.lances;
CREATE POLICY "Users can CRUD own lances" ON public.lances FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 14. licitacoes
DROP POLICY IF EXISTS "Users can delete own licitacoes" ON public.licitacoes;
DROP POLICY IF EXISTS "Users can insert own licitacoes" ON public.licitacoes;
DROP POLICY IF EXISTS "Users can update own licitacoes" ON public.licitacoes;
DROP POLICY IF EXISTS "Users can view own licitacoes" ON public.licitacoes;
CREATE POLICY "Users can delete own licitacoes" ON public.licitacoes FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own licitacoes" ON public.licitacoes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own licitacoes" ON public.licitacoes FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view own licitacoes" ON public.licitacoes FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 15. monitoramento_editais
DROP POLICY IF EXISTS "Users can CRUD own monitoramento" ON public.monitoramento_editais;
CREATE POLICY "Users can CRUD own monitoramento" ON public.monitoramento_editais FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 16. notificacoes
DROP POLICY IF EXISTS "Users can CRUD own notificacoes" ON public.notificacoes;
CREATE POLICY "Users can CRUD own notificacoes" ON public.notificacoes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 17. planos
DROP POLICY IF EXISTS "Admins can manage plans" ON public.planos;
DROP POLICY IF EXISTS "Anyone can view active plans" ON public.planos;
CREATE POLICY "Admins can manage plans" ON public.planos FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can view active plans" ON public.planos FOR SELECT USING (ativo = true);

-- 18. precificacao
DROP POLICY IF EXISTS "Users can CRUD own precificacao" ON public.precificacao;
CREATE POLICY "Users can CRUD own precificacao" ON public.precificacao FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 19. profiles
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 20. tickets_suporte
DROP POLICY IF EXISTS "Admins can manage all tickets" ON public.tickets_suporte;
DROP POLICY IF EXISTS "Users can create own tickets" ON public.tickets_suporte;
DROP POLICY IF EXISTS "Users can view own tickets" ON public.tickets_suporte;
CREATE POLICY "Admins can manage all tickets" ON public.tickets_suporte FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can create own tickets" ON public.tickets_suporte FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own tickets" ON public.tickets_suporte FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 21. user_roles
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 22. whatsapp_envios
DROP POLICY IF EXISTS "Users can view own whatsapp envios" ON public.whatsapp_envios;
CREATE POLICY "Users can view own whatsapp envios" ON public.whatsapp_envios FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 23. whatsapp_preferencias
DROP POLICY IF EXISTS "Users can delete own whatsapp prefs" ON public.whatsapp_preferencias;
DROP POLICY IF EXISTS "Users can insert own whatsapp prefs" ON public.whatsapp_preferencias;
DROP POLICY IF EXISTS "Users can update own whatsapp prefs" ON public.whatsapp_preferencias;
DROP POLICY IF EXISTS "Users can view own whatsapp prefs" ON public.whatsapp_preferencias;
CREATE POLICY "Users can delete own whatsapp prefs" ON public.whatsapp_preferencias FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own whatsapp prefs" ON public.whatsapp_preferencias FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own whatsapp prefs" ON public.whatsapp_preferencias FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view own whatsapp prefs" ON public.whatsapp_preferencias FOR SELECT TO authenticated USING (auth.uid() = user_id);
