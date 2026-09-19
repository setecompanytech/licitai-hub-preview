-- ═══════════════════════════════════════════════════════════════════════════
-- A infraestrutura do robô é da conta de engenharia, não de todo admin
-- Data: 2026-09-19
-- ═══════════════════════════════════════════════════════════════════════════
--
-- O Rafael, em 18/09, com prints de Admin › Configurações do Robô de Lances
-- logado como GRUPO SANTA ROSA: "Eu vejo essas funções como configurações
-- internas do desenvolvedor do sistema, não cabe ao usuário aderente ao plano
-- ter todas as informações" — e o e-mail de engenharia "teria toda essa
-- visualização". Em 19/09 o Ian decidiu que a `comercial@gruposantarosa`
-- MANTÉM o papel de admin da plataforma (o resto do grupo Admin segue com
-- ela), mas a infraestrutura do robô passa a ser só da conta de engenharia.
--
-- "Conta de engenharia" = admin da plataforma sem empresa nenhuma
-- (`eh_conta_de_engenharia`, migration 20260919000003). Esta migration troca
-- `has_role(auth.uid(), 'admin')` por `sou_conta_de_engenharia()` nas regras
-- que davam a infraestrutura do robô a todo admin:
--
--   agente_externo_config — configuração de agente de todas as contas
--   sessoes_lance_real    — sessões do robô de todas as empresas
--   webhook_log           — registro de chamadas de todas as contas
--   robo_historico        — histórico do robô de todas as empresas
--   robo_avisos_portal    — escrever avisos e ler os fora do ar
--   contas_para_plataforma / nomes_de_empresas_para_plataforma — nomes para
--                           o diagnóstico e a aba do agente
--
-- O que NÃO muda: cada cliente segue lendo as PRÓPRIAS sessões, a própria
-- configuração de agente e o próprio registro de chamadas pelas regras de
-- dono e de membro da empresa. `portal_healthcheck` fica como está: uma regra
-- antiga deixa qualquer usuário logado ler a saúde dos portais.
--
-- `sou_conta_de_engenharia()` existe porque `eh_conta_de_engenharia(uuid)` não
-- pode ser chamada pelo navegador (EXECUTE revogado em 000003): esta versão só
-- responde sobre a própria conta.
--
-- Idempotente (CREATE OR REPLACE + DROP POLICY IF EXISTS). REVERSÃO: recriar
-- as regras com `public.has_role(auth.uid(), 'admin'::public.app_role)` no
-- lugar de `public.sou_conta_de_engenharia()` (textos de 20260914000004 e
-- 20260917000004), e as duas funções de nome com o teste de `has_role`.

create or replace function public.sou_conta_de_engenharia()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.eh_conta_de_engenharia(auth.uid())
$$;

revoke all on function public.sou_conta_de_engenharia() from public, anon;
grant execute on function public.sou_conta_de_engenharia() to authenticated;

-- ── Leitura entre empresas: só a engenharia ────────────────────────────────

drop policy if exists "Plataforma lê configuração dos agentes" on public.agente_externo_config;
create policy "Plataforma lê configuração dos agentes"
on public.agente_externo_config for select to authenticated
using (public.sou_conta_de_engenharia());

drop policy if exists "Plataforma lê sessões do robô" on public.sessoes_lance_real;
create policy "Plataforma lê sessões do robô"
on public.sessoes_lance_real for select to authenticated
using (public.sou_conta_de_engenharia());

drop policy if exists "Plataforma lê registro de chamadas" on public.webhook_log;
create policy "Plataforma lê registro de chamadas"
on public.webhook_log for select to authenticated
using (public.sou_conta_de_engenharia());

drop policy if exists "Plataforma lê o histórico do robô" on public.robo_historico;
create policy "Plataforma lê o histórico do robô"
on public.robo_historico for select to authenticated
using (public.sou_conta_de_engenharia());

-- ── Avisos aos clientes: cliente lê o vigente; a engenharia escreve e vê todos

drop policy if exists "Clientes leem avisos vigentes" on public.robo_avisos_portal;
create policy "Clientes leem avisos vigentes"
on public.robo_avisos_portal for select to authenticated
using (
  (ativo and inicio_em <= now() and (fim_em is null or fim_em > now()))
  or public.sou_conta_de_engenharia()
);

drop policy if exists "Plataforma escreve avisos" on public.robo_avisos_portal;
create policy "Plataforma escreve avisos"
on public.robo_avisos_portal for all to authenticated
using (public.sou_conta_de_engenharia())
with check (public.sou_conta_de_engenharia());

-- ── Nomes para o diagnóstico e para a aba do agente ─────────────────────────

create or replace function public.nomes_de_empresas_para_plataforma(p_ids uuid[])
returns table (id uuid, razao_social text, nome_fantasia text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.sou_conta_de_engenharia() then
    raise exception 'Consulta exclusiva da gestão técnica do sistema.';
  end if;
  return query
    select e.id, e.razao_social::text, e.nome_fantasia::text
      from public.empresas e
     where e.id = any (p_ids);
end $$;

revoke all on function public.nomes_de_empresas_para_plataforma(uuid[]) from public;
grant execute on function public.nomes_de_empresas_para_plataforma(uuid[]) to authenticated;

create or replace function public.contas_para_plataforma(p_ids uuid[])
returns table (id uuid, nome text, empresas text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.sou_conta_de_engenharia() then
    raise exception 'Consulta exclusiva da gestão técnica do sistema.';
  end if;
  return query
    select u.id,
           coalesce(nullif(trim(p.nome_completo), ''), 'Conta sem nome')::text,
           (select string_agg(coalesce(e.nome_fantasia, e.razao_social), ', ' order by e.razao_social)
              from public.empresa_membros m
              join public.empresas e on e.id = m.empresa_id
             where m.user_id = u.id)::text
      from unnest(p_ids) as u(id)
      left join public.profiles p on p.user_id = u.id;
end $$;

revoke all on function public.contas_para_plataforma(uuid[]) from public;
grant execute on function public.contas_para_plataforma(uuid[]) to authenticated;

notify pgrst, 'reload schema';
