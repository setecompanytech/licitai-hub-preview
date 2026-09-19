-- ═══════════════════════════════════════════════════════════════════════════
-- O admin da plataforma não passa por cima de dado de cliente
-- Data: 2026-09-19
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Levantamento de 19/09 (pg_policies do banco no ar): de 46 regras em que o
-- admin da plataforma (`user_roles.role = 'admin'`) tem passe próprio, 42 são
-- de operação, catálogo, negócio da Praefectus ou LGPD — corretas. Quatro
-- davam ao admin LER, ALTERAR E APAGAR dado de cliente, pela fórmula
-- "dono OU admin" herdada das migrations de março:
--
--   notas_fiscais / nota_fiscal_itens — Contratos › Pedidos
--   sub_tarefas                       — Equipe › Tarefas
--   transacoes_bancarias              — legada, sem uso no app
--
-- As quatro estavam VAZIAS no dia (0 linhas): nada foi exposto. Fecha-se agora
-- porque duas são usadas pelo app, e o dado do primeiro cliente nasceria
-- alcançável pela plataforma. Linha combinada em 19/09: a plataforma enxerga a
-- operação, não o negócio de cada cliente.
--
-- Cada regra é refeita IGUAL à original, só sem o `OR has_role(..., 'admin')`:
-- o acesso do próprio dono não muda.
--
-- Idempotente (DROP POLICY IF EXISTS + CREATE). REVERSÃO: recriar as quatro
-- com o `OR public.has_role(auth.uid(), 'admin')` de volta (textos originais
-- em 20260316235727, 20260317001119 e 20260316234219).

drop policy if exists "Users manage own notas_fiscais" on public.notas_fiscais;
create policy "Users manage own notas_fiscais"
  on public.notas_fiscais for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users manage nota_fiscal_itens via parent" on public.nota_fiscal_itens;
create policy "Users manage nota_fiscal_itens via parent"
  on public.nota_fiscal_itens for all to authenticated
  using (
    exists (select 1 from public.notas_fiscais nf
             where nf.id = nota_fiscal_itens.nota_fiscal_id and nf.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.notas_fiscais nf
             where nf.id = nota_fiscal_itens.nota_fiscal_id and nf.user_id = auth.uid())
  );

drop policy if exists "Users manage own transacoes_bancarias" on public.transacoes_bancarias;
create policy "Users manage own transacoes_bancarias"
  on public.transacoes_bancarias for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can manage sub_tarefas of their tasks" on public.sub_tarefas;
create policy "Users can manage sub_tarefas of their tasks"
  on public.sub_tarefas for all to authenticated
  using (
    exists (select 1 from public.tarefas_colaborador t
             where t.id = sub_tarefas.tarefa_id
               and (t.atribuido_a = auth.uid() or t.criado_por = auth.uid()))
  )
  with check (
    exists (select 1 from public.tarefas_colaborador t
             where t.id = sub_tarefas.tarefa_id
               and (t.atribuido_a = auth.uid() or t.criado_por = auth.uid()))
  );
