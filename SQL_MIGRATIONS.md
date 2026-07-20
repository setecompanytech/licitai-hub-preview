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
  FOR INSERT WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "cert_update" ON public.certificados_digitais
  FOR UPDATE USING (public.is_empresa_admin(auth.uid(), empresa_id));
CREATE POLICY "cert_delete" ON public.certificados_digitais
  FOR DELETE USING (public.is_empresa_admin(auth.uid(), empresa_id));
```

> **Bucket Supabase Storage**: crie o bucket privado `certificados` em **Storage → New Bucket → Name: certificados → Public: OFF**.

---

## [2026-07-09] Vinculação NF-e ↔ Pedido + colunas empresa_membros

### Passo 1 — Coluna `pedido_id` em financeiro_nfes_emitidas

```sql
ALTER TABLE public.financeiro_nfes_emitidas
  ADD COLUMN IF NOT EXISTS pedido_id uuid REFERENCES public.pedidos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_nfes_pedido ON public.financeiro_nfes_emitidas(pedido_id);
```

### Passo 3 — Trigger: saldo_atual da conta ao marcar lançamento como realizado/conciliado

> **IMPORTANTE**: rode este bloco no Supabase para ativar a dedução automática do saldo.

```sql
CREATE OR REPLACE FUNCTION public.trg_fn_saldo_lancamento()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_delta NUMERIC;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Status entrou em realizado/conciliado
    IF NEW.status IN ('realizado', 'conciliado') AND OLD.status NOT IN ('realizado', 'conciliado') THEN
      IF NEW.conta_id IS NOT NULL AND NEW.valor IS NOT NULL THEN
        v_delta := CASE WHEN NEW.natureza = 'receita' THEN NEW.valor ELSE -NEW.valor END;
        UPDATE public.financeiro_contas SET saldo_atual = COALESCE(saldo_atual,0) + v_delta WHERE id = NEW.conta_id;
      END IF;
    END IF;
    -- Status saiu de realizado/conciliado (reabertura)
    IF OLD.status IN ('realizado', 'conciliado') AND NEW.status NOT IN ('realizado', 'conciliado') THEN
      IF OLD.conta_id IS NOT NULL AND OLD.valor IS NOT NULL THEN
        v_delta := CASE WHEN OLD.natureza = 'receita' THEN -OLD.valor ELSE OLD.valor END;
        UPDATE public.financeiro_contas SET saldo_atual = COALESCE(saldo_atual,0) + v_delta WHERE id = OLD.conta_id;
      END IF;
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    IF NEW.status IN ('realizado', 'conciliado') AND NEW.conta_id IS NOT NULL AND NEW.valor IS NOT NULL THEN
      v_delta := CASE WHEN NEW.natureza = 'receita' THEN NEW.valor ELSE -NEW.valor END;
      UPDATE public.financeiro_contas SET saldo_atual = COALESCE(saldo_atual,0) + v_delta WHERE id = NEW.conta_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('realizado', 'conciliado') AND OLD.conta_id IS NOT NULL AND OLD.valor IS NOT NULL THEN
      v_delta := CASE WHEN OLD.natureza = 'receita' THEN -OLD.valor ELSE OLD.valor END;
      UPDATE public.financeiro_contas SET saldo_atual = COALESCE(saldo_atual,0) + v_delta WHERE id = OLD.conta_id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_saldo_lancamento ON public.financeiro_lancamentos;
CREATE TRIGGER trg_saldo_lancamento
  AFTER INSERT OR UPDATE OR DELETE ON public.financeiro_lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_saldo_lancamento();
```

> **Nota**: lançamentos já existentes com status=realizado/conciliado **não** serão retroativamente ajustados. Use "Sincronizar saldos" em Contas após criar o trigger.
> O trigger agora cobre também `conciliado` além de `realizado`.

---

### Passo 2 — Colunas de identificação em empresa_membros

```sql
ALTER TABLE public.empresa_membros
  ADD COLUMN IF NOT EXISTS nome_individual      text,
  ADD COLUMN IF NOT EXISTS login_individual     text,
  ADD COLUMN IF NOT EXISTS identificacao_completa boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "membros_update_self" ON public.empresa_membros;
CREATE POLICY "membros_update_self" ON public.empresa_membros
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

---

## [2026-07-16] Recalcular saldo_atual de todas as contas com base nos lançamentos

> Rode este bloco quando o `saldo_atual` de alguma conta estiver errado (ex.: lançamentos deletados sem reverter saldo, trigger ativo junto com código, etc.).
> É seguro rodar a qualquer momento — apenas recalcula, não perde dados.

```sql
-- Recalcula saldo_atual = saldo_inicial + soma dos lancamentos realizados/conciliados
UPDATE public.financeiro_contas fc
SET saldo_atual = fc.saldo_inicial + COALESCE((
  SELECT SUM(
    CASE WHEN fl.natureza = 'receita' THEN fl.valor ELSE -fl.valor END
  )
  FROM public.financeiro_lancamentos fl
  WHERE fl.conta_id = fc.id
    AND fl.status IN ('realizado', 'conciliado')
    AND fl.empresa_id = fc.empresa_id
), 0);
```

> Se você também tem o trigger `trg_saldo_lancamento` ativo, remova-o antes de rodar este bloco para evitar dupla contagem:
> ```sql
> DROP TRIGGER IF EXISTS trg_saldo_lancamento ON public.financeiro_lancamentos;
> ```

---

## [2026-07-20] Bucket de anexos de pedidos

> Crie o bucket privado `pedidos-anexos` em **Supabase → Storage → New Bucket** com:
> - Name: `pedidos-anexos`
> - Public: **OFF** (privado)
>
> Arquivos armazenados no caminho `{empresa_id}/{pedido_id}/{nome_do_arquivo}`.
> Não é necessário SQL — só criar o bucket no painel do Supabase.
