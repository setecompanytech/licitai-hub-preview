-- ═══════════════════════════════════════════════════════════════════════════
-- A conta de engenharia da plataforma não cria empresa nem entra em empresa
-- Data: 2026-09-19
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Decisão do Rafael (14/09, confirmada pelo Ian em 19/09): o engsoft@ opera o
-- sistema pelo Admin e NÃO é membro de cliente. Quem cria empresa vira admin
-- dela (EmpresaContext.addEmpresa), e o incidente de 16/09 veio justamente de
-- uma conta da plataforma entrar numa empresa de cliente — as telas passaram a
-- misturar Santa Rosa e BAQPLAST.
--
-- "Conta de engenharia" é definida por fato, não por e-mail: ADMIN DA
-- PLATAFORMA SEM EMPRESA NENHUMA (a mesma regra do front, em
-- `src/lib/conta-de-engenharia.ts`). A `comercial@gruposantarosa`, também
-- admin da plataforma (os dois coexistem, decisão de 19/09), está na Santa
-- Rosa e fica de fora: a regra não atinge o login do dono do produto.
--
-- Duas travas, as duas antes de gravar:
--   1. empresa_membros — a conta de engenharia não vira membro (criação de
--      empresa, convite de membro, convite de setor ou SQL à mão);
--   2. empresas — ela não cria empresa pela API. `auth.uid()` é nulo no SQL
--      Editor e no service_role, então a manutenção pela plataforma segue
--      possível; só a sessão da própria conta é barrada.
--
-- Idempotente (CREATE OR REPLACE + DROP TRIGGER IF EXISTS). REVERSÃO:
--   drop trigger if exists trg_conta_de_engenharia_fora_das_empresas on public.empresa_membros;
--   drop trigger if exists trg_conta_de_engenharia_nao_cria_empresa on public.empresas;
--   drop function if exists public.conta_de_engenharia_fora_das_empresas();
--   drop function if exists public.conta_de_engenharia_nao_cria_empresa();
--   drop function if exists public.eh_conta_de_engenharia(uuid);

create or replace function public.eh_conta_de_engenharia(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select _user_id is not null
     and public.has_role(_user_id, 'admin')
     and not exists (select 1 from public.empresa_membros m where m.user_id = _user_id)
$$;

-- Só os gatilhos abaixo a usam (e rodam como dono): ninguém de fora precisa
-- perguntar ao banco se uma conta é a de engenharia.
revoke all on function public.eh_conta_de_engenharia(uuid) from public, anon, authenticated;

create or replace function public.conta_de_engenharia_fora_das_empresas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.eh_conta_de_engenharia(new.user_id) then
    raise exception 'A conta de engenharia da plataforma não entra em empresa de cliente'
      using errcode = 'P0001',
            hint = 'Conta de engenharia = admin da plataforma sem empresa. Ver CLAUDE.md, seção Permissões.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_conta_de_engenharia_fora_das_empresas on public.empresa_membros;
create trigger trg_conta_de_engenharia_fora_das_empresas
  before insert or update of user_id on public.empresa_membros
  for each row execute function public.conta_de_engenharia_fora_das_empresas();

create or replace function public.conta_de_engenharia_nao_cria_empresa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.eh_conta_de_engenharia(auth.uid()) then
    raise exception 'A conta de engenharia da plataforma não cadastra empresa'
      using errcode = 'P0001',
            hint = 'Quem cria empresa vira admin dela, e a conta de engenharia não é membro de cliente.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_conta_de_engenharia_nao_cria_empresa on public.empresas;
create trigger trg_conta_de_engenharia_nao_cria_empresa
  before insert on public.empresas
  for each row execute function public.conta_de_engenharia_nao_cria_empresa();
