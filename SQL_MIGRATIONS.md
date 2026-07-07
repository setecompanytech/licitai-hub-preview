# SQL Migrations — Praefectus / Licitai Hub

> Rode cada bloco no **Supabase SQL Editor** do projeto `sbnlovigyifvrkgsoalj`.
> Os blocos são idempotentes (usam `IF NOT EXISTS` / `IF NOT EXISTS`), então podem ser rerodados sem problema.
> Sempre adicione novas entradas **no final**, com data e descrição.

---

## [2026-06-11] Módulo de Compras — Estoque e NF-e

```sql
-- Catálogo de produtos
CREATE TABLE IF NOT EXISTS public.produtos (
  id                uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id        uuid        NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  codigo            text,
  descricao         text        NOT NULL,
  unidade           text        NOT NULL DEFAULT 'UN',
  categoria         text,
  saldo_atual       numeric     NOT NULL DEFAULT 0,
  saldo_minimo      numeric     NOT NULL DEFAULT 0,
  preco_custo_medio numeric     NOT NULL DEFAULT 0,
  ativo             boolean     NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_produtos_empresa ON public.produtos(empresa_id);

ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "produtos_select" ON public.produtos
  FOR SELECT USING (public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "produtos_insert" ON public.produtos
  FOR INSERT WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "produtos_update" ON public.produtos
  FOR UPDATE USING (public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "produtos_delete" ON public.produtos
  FOR DELETE USING (public.is_empresa_admin(auth.uid(), empresa_id));
```

---

## [2026-06-12] Campos fiscais no produto (NCM, CFOP, CST)

```sql
ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS ncm        text,
  ADD COLUMN IF NOT EXISTS cfop       text,
  ADD COLUMN IF NOT EXISTS cst_icms   text,
  ADD COLUMN IF NOT EXISTS csosn      text,
  ADD COLUMN IF NOT EXISTS cst_pis    text,
  ADD COLUMN IF NOT EXISTS cst_cofins text,
  ADD COLUMN IF NOT EXISTS p_icms     numeric,
  ADD COLUMN IF NOT EXISTS p_pis      numeric,
  ADD COLUMN IF NOT EXISTS p_cofins   numeric;
```

---

## [2026-07-04] Colunas adicionais em produtos + tabela produto_fornecedores

### Passo 1 — Colunas adicionais em produtos

```sql
ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS codigo_ean                 text,
  ADD COLUMN IF NOT EXISTS preco_venda                numeric     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cest                       text,
  ADD COLUMN IF NOT EXISTS tipo_produto               text        DEFAULT '00',
  ADD COLUMN IF NOT EXISTS origem_mercadoria          text,
  ADD COLUMN IF NOT EXISTS numero_fci                 text,
  ADD COLUMN IF NOT EXISTS peso_liquido               numeric     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS peso_bruto                 numeric     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS altura                     numeric     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS largura                    numeric     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS profundidade               numeric     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dias_crossdocking          integer     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lead_time_ressuprimento    integer     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS marca                      text,
  ADD COLUMN IF NOT EXISTS modelo                     text,
  ADD COLUMN IF NOT EXISTS dias_garantia              integer     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unidade_tributavel         text,
  ADD COLUMN IF NOT EXISTS quantidade_tributavel      numeric     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fator_conversao            numeric     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS codigo_ean_tributavel      text,
  ADD COLUMN IF NOT EXISTS indicador_producao_escala  text,
  ADD COLUMN IF NOT EXISTS observacoes                text;
```

### Passo 2 — Tabela produto_fornecedores (vinculação produto ↔ fornecedor)

```sql
CREATE TABLE IF NOT EXISTS public.produto_fornecedores (
  id          uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id  uuid        NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  produto_id  uuid        NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  pessoa_id   uuid        NOT NULL REFERENCES public.financeiro_pessoas(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (produto_id, pessoa_id)
);

CREATE INDEX IF NOT EXISTS idx_pf_produto ON public.produto_fornecedores(produto_id);
CREATE INDEX IF NOT EXISTS idx_pf_pessoa  ON public.produto_fornecedores(pessoa_id);
CREATE INDEX IF NOT EXISTS idx_pf_empresa ON public.produto_fornecedores(empresa_id);

ALTER TABLE public.produto_fornecedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pf_select" ON public.produto_fornecedores
  FOR SELECT USING (public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "pf_insert" ON public.produto_fornecedores
  FOR INSERT WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "pf_delete" ON public.produto_fornecedores
  FOR DELETE USING (public.is_empresa_member(auth.uid(), empresa_id));
```

---

## [2026-07-04] Tabelas pedidos e pedido_itens (Kanban de Pedidos de Compra e Venda)

### Passo 1 — Tabela principal de pedidos

```sql
CREATE TABLE IF NOT EXISTS public.pedidos (
  id                      uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id              uuid        NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  numero                  integer     NOT NULL DEFAULT 1,
  tipo                    text        NOT NULL DEFAULT 'venda',
  status                  text        NOT NULL DEFAULT 'pedido',
  pessoa_id               uuid        REFERENCES public.financeiro_pessoas(id),
  previsao_faturamento    date,
  total_mercadorias       numeric     NOT NULL DEFAULT 0,
  valor_desconto          numeric     NOT NULL DEFAULT 0,
  total_ipi               numeric     NOT NULL DEFAULT 0,
  total_icms_st           numeric     NOT NULL DEFAULT 0,
  valor_total             numeric     NOT NULL DEFAULT 0,
  vendedor                text,
  numero_parcelas         text        DEFAULT 'A Vista',
  cenario_fiscal          text,
  categoria               text,
  conta_corrente          text,
  etapa                   text,
  num_pedido_cliente      text,
  num_contrato_venda      text,
  contato                 text,
  projeto                 text,
  origem_pedido           text        DEFAULT 'sistema',
  dados_adicionais_nfe    text,
  nf_consumo_final        boolean     NOT NULL DEFAULT false,
  email_destinatario      text,
  enviar_boleto           boolean     NOT NULL DEFAULT false,
  observacoes             text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pedidos_empresa ON public.pedidos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_pessoa  ON public.pedidos(pessoa_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_status  ON public.pedidos(status);

ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pedidos_select" ON public.pedidos
  FOR SELECT USING (public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "pedidos_insert" ON public.pedidos
  FOR INSERT WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "pedidos_update" ON public.pedidos
  FOR UPDATE USING (public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "pedidos_delete" ON public.pedidos
  FOR DELETE USING (public.is_empresa_member(auth.uid(), empresa_id));
```

### Passo 2 — Tabela de itens do pedido

```sql
CREATE TABLE IF NOT EXISTS public.pedido_itens (
  id              uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id       uuid        NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  empresa_id      uuid        NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  produto_id      uuid        REFERENCES public.produtos(id),
  codigo_produto  text,
  descricao       text        NOT NULL,
  unidade         text        NOT NULL DEFAULT 'PC',
  quantidade      numeric     NOT NULL DEFAULT 1,
  preco_unitario  numeric     NOT NULL DEFAULT 0,
  valor_total     numeric     NOT NULL DEFAULT 0,
  local_estoque   text        DEFAULT 'PADRAO - Local de Estoque Padrão',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pi_pedido  ON public.pedido_itens(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pi_empresa ON public.pedido_itens(empresa_id);

ALTER TABLE public.pedido_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pi_select" ON public.pedido_itens
  FOR SELECT USING (public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "pi_insert" ON public.pedido_itens
  FOR INSERT WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "pi_update" ON public.pedido_itens
  FOR UPDATE USING (public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "pi_delete" ON public.pedido_itens
  FOR DELETE USING (public.is_empresa_member(auth.uid(), empresa_id));
```

---

## [2026-07-07] Tabela certificados_digitais (Certificado A1/A3 para NFS-e)

```sql
CREATE TABLE IF NOT EXISTS public.certificados_digitais (
  id              uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id      uuid        NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo            text        NOT NULL DEFAULT 'A1',
  nome_titular    text,
  cnpj_titular    text,
  validade        date,
  storage_path    text,
  ativo           boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cert_empresa ON public.certificados_digitais(empresa_id);

ALTER TABLE public.certificados_digitais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cert_select" ON public.certificados_digitais
  FOR SELECT USING (public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "cert_insert" ON public.certificados_digitais
  FOR INSERT WITH CHECK (public.is_empresa_admin(auth.uid(), empresa_id));
CREATE POLICY "cert_update" ON public.certificados_digitais
  FOR UPDATE USING (public.is_empresa_admin(auth.uid(), empresa_id));
CREATE POLICY "cert_delete" ON public.certificados_digitais
  FOR DELETE USING (public.is_empresa_admin(auth.uid(), empresa_id));
```

> **Bucket Supabase Storage**: crie o bucket privado `certificados` em **Storage → New Bucket → Name: certificados → Public: OFF**.
