create table if not exists pedidos_exclusoes (
  id uuid default gen_random_uuid() primary key,
  contrato_id uuid references contratos(id) on delete set null,
  pedido_id uuid,
  numero_pedido text not null,
  descricao text,
  valor_total numeric default 0,
  data_pedido date,
  status text,
  deletado_por_user_id uuid references auth.users(id) on delete set null,
  deletado_por_email text,
  motivo text not null,
  pedido_snapshot jsonb,
  deleted_at timestamptz default now() not null
);

alter table pedidos_exclusoes enable row level security;

create policy "empresa members can read pedidos_exclusoes"
  on pedidos_exclusoes for select
  using (
    contrato_id in (
      select c.id from contratos c
      inner join empresa_membros em on em.empresa_id = c.empresa_id
      where em.user_id = auth.uid()
    )
  );

create policy "authenticated users can insert pedidos_exclusoes"
  on pedidos_exclusoes for insert
  with check (auth.uid() is not null and deletado_por_user_id = auth.uid());
