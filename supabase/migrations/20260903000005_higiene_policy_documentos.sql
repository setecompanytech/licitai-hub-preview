-- Higiene: a migration 20260818000007 (Lovable) criou a policy ampla
-- "Membros gerenciam documentos da empresa" (FOR ALL por membro). A conversão
-- de 20260903000002 instituiu o conjunto fino (leitura/renovação por membro,
-- exclusão por dono ou admin) — policies permissivas somam por OU, então a
-- antiga, se aplicada, devolveria a exclusão a qualquer membro.
DROP POLICY IF EXISTS "Membros gerenciam documentos da empresa" ON public.documentos;
