-- ═══════════════════════════════════════════════════════════════════════════
-- engsoft@praefectus.com.br é o admin da plataforma
-- Data: 2026-09-19
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Decisão do Rafael (14/09, confirmada pelo Ian em 19/09): o que é de
-- desenvolvimento e TI — o grupo Admin inteiro, com a tela remota do robô, o
-- agente e o servidor — fica numa conta de engenharia, e não nas contas dos
-- clientes. Até aqui o único admin da plataforma era a
-- `comercial@gruposantarosa.com.br`, que é também admin do Grupo Santa Rosa.
--
-- Esta migration só REGISTRA o papel. A conta em si é criada à mão no Auth
-- (SQL Editor ou Dashboard › Authentication › Add user, com o e-mail já
-- confirmado) e nunca por migration: criar conta leva senha, e segredo não
-- entra no repositório.
--
-- A conta NÃO é membro de empresa nenhuma: enxerga a operação pelo Admin, sem
-- se misturar aos dados de negócio dos clientes (incidente de 16/09).
--
-- A `comercial@gruposantarosa` MANTÉM o papel: os dois admins coexistem
-- (decisão do Ian, 19/09). Seção Permissões do CLAUDE.md.
--
-- Idempotente: não faz nada se a conta ainda não existir, nem se o papel já
-- estiver lá. REVERSÃO:
--   delete from public.user_roles r using auth.users u
--    where r.user_id = u.id and r.role = 'admin'
--      and lower(u.email) = 'engsoft@praefectus.com.br';

insert into public.user_roles (user_id, role)
select u.id, 'admin'::public.app_role
from auth.users u
where lower(u.email) = 'engsoft@praefectus.com.br'
on conflict (user_id, role) do nothing;
