-- ═══════════════════════════════════════════════════════════════════════════
-- Nome e empresas de uma conta, só para a plataforma
-- Data: 2026-09-19
-- ═══════════════════════════════════════════════════════════════════════════
--
-- A aba "Agente e infraestrutura" (Admin › Configurações do Robô de Lances)
-- passou a listar a configuração de agente de TODAS as contas — a policy
-- "Plataforma lê configuração dos agentes" (20260914000004) já permitia; a
-- tela é que filtrava pela conta logada, e a conta de engenharia (engsoft@),
-- que não tem agente próprio, via a aba vazia.
--
-- Cada linha de `agente_externo_config` tem só `user_id`. Para dizer de quem é
-- o agente sem abrir `profiles` e `empresa_membros` à plataforma, esta função
-- devolve o MÍNIMO: o nome da pessoa e os nomes das empresas dela. Sem e-mail,
-- sem telefone, sem papel. Mesmo padrão de `nomes_de_empresas_para_plataforma`.
--
-- Idempotente (CREATE OR REPLACE). REVERSÃO:
--   drop function if exists public.contas_para_plataforma(uuid[]);

create or replace function public.contas_para_plataforma(p_ids uuid[])
returns table (id uuid, nome text, empresas text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Consulta exclusiva da operação Praefectus.';
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
