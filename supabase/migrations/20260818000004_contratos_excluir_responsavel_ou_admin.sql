-- =============================================================================
-- Excluir contrato: só o responsável ou o administrador
--
-- A lista de contratos passou a oferecer "Todos da equipe" a um clique, e a
-- lixeira ficava ativa em contrato alheio — um toque apagava o trabalho de
-- outra pessoa. Ver a carteira da equipe é necessário (financeiro, jurídico,
-- gestão); poder apagá-la não.
--
-- A policy existente é `FOR ALL` e precisa continuar assim: financeiro lança
-- consumo, jurídico registra aditivo, todos leem. Por isso a restrição entra
-- como policy RESTRICTIVE apenas para DELETE — restritivas somam com E lógico
-- às permissivas, então nada do que já funcionava é afetado.
--
-- `COALESCE(vendedor_user_id, user_id)` repete a regra de propriedade do front
-- (src/lib/equipe/escopoProprio.ts): vale o vendedor atribuído; sem vendedor,
-- responde quem cadastrou — senão contrato antigo não teria dono nenhum e
-- ninguém além do admin poderia removê-lo.
--
-- Convenção do repo: delete via is_empresa_admin. Aqui o dono também pode, para
-- que corrigir o próprio lançamento errado não dependa do administrador.
-- =============================================================================

DROP POLICY IF EXISTS "Excluir contrato somente responsavel ou admin" ON public.contratos;

CREATE POLICY "Excluir contrato somente responsavel ou admin" ON public.contratos
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (
    public.is_empresa_admin(auth.uid(), empresa_id)
    OR COALESCE(vendedor_user_id, user_id) = auth.uid()
  );
