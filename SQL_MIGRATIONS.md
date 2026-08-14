# SQL Migrations — Praefectus / Licitai Hub

> Rode cada bloco no **Supabase SQL Editor** do projeto `uwtyuwktxalnpgrcbbgk`.
> Os blocos são idempotentes (usam `IF NOT EXISTS` / `IF NOT EXISTS`), então podem ser rerodados sem problema.
> Sempre adicione novas entradas **no final**, com data e descrição.
>
> **O que entra aqui:** as migrations escritas à mão, que um humano precisa colar no SQL
> Editor. As migrations de nome UUID em `supabase/migrations/` são geradas e aplicadas
> automaticamente pelo Lovable e **não** são registradas neste arquivo — registrá-las
> enterraria as que exigem ação. A exceção é quando uma migration do Lovable vira fundação
> de um épico ou tem defeito conhecido; aí ela entra, com o motivo escrito.

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

## [2026-07-20] Bucket de anexos de pedidos + políticas RLS

> Crie o bucket privado `pedidos-anexos` em **Supabase → Storage → New Bucket** com:
> - Name: `pedidos-anexos`
> - Public: **OFF** (privado)
>
> Depois rode o SQL abaixo para habilitar upload/download para usuários autenticados.

```sql
-- RLS: usuários autenticados podem fazer upload de anexos de pedidos
CREATE POLICY "pedidos_anexos_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pedidos-anexos');

-- RLS: usuários autenticados podem ler/listar seus anexos
CREATE POLICY "pedidos_anexos_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'pedidos-anexos');

-- RLS: usuários autenticados podem deletar anexos
CREATE POLICY "pedidos_anexos_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'pedidos-anexos');

-- RLS: usuários autenticados podem atualizar (upsert)
CREATE POLICY "pedidos_anexos_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'pedidos-anexos');
```

## [2026-08-03] Módulo de Metas do Comercial — Fase A (modelo de dados)

> Cria as tabelas do módulo de metas do comercial. Nada aqui altera módulo existente:
> o *realizado* continua sendo derivado de `contratos`, `contrato_pedidos` e `licitacoes`.
>
> Atenção ao nome: **`financeiro_metas` já existe e é outra coisa** (orçamento por conta
> contábil). Por isso este módulo usa o prefixo `comercial_`.
>
> Ao final, o script aplica os padrões (R$ 300.000 pregão eletrônico / R$ 100.000 dispensa
> e os motivos de perda) em todas as empresas já cadastradas.

```sql
-- =============================================================================
-- MIGRATION: Modulo de Metas do Comercial — Fase A (modelo de dados)
-- Data: 2026-08-03
-- Objetivo: Metas mensais por colaborador do comercial, com valores-alvo por
--           modalidade parametrizaveis (nunca fixos no codigo), motivos de
--           perda parametrizaveis e registro de perda com motivo obrigatorio.
--
-- Observacoes de projeto:
--   - `financeiro_metas` JA EXISTE e e outra coisa (orcamento por conta
--     contabil). Por isso todo este modulo usa o prefixo `comercial_`.
--   - Valores monetarios em numeric(14,2) — nunca ponto flutuante binario.
--   - Nenhuma tabela nova duplica dado que ja vive em `contratos`,
--     `contrato_pedidos` ou `licitacoes`; o realizado e sempre derivado.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Configuracao geral do modulo por empresa
--    Limiares de alerta e janela historica ficam aqui para nao virarem
--    constante no codigo do motor de projecao (Fase C).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.comercial_metas_config (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id                uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  -- Meses de historico usados para taxa de conversao e ticket medio
  janela_historica_meses    int NOT NULL DEFAULT 6 CHECK (janela_historica_meses BETWEEN 1 AND 36),
  -- Alerta dispara quando faltam <= N dias uteis e o realizado esta abaixo do %
  alerta_dias_limite        int NOT NULL DEFAULT 10 CHECK (alerta_dias_limite BETWEEN 1 AND 31),
  alerta_percentual_minimo  numeric(5,2) NOT NULL DEFAULT 70.00
                              CHECK (alerta_percentual_minimo BETWEEN 0 AND 100),
  -- Minimo de contratos historicos para confiar no ticket medio real;
  -- abaixo disso o motor cai no valor-alvo da modalidade
  min_amostra_ticket        int NOT NULL DEFAULT 3 CHECK (min_amostra_ticket >= 1),
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comercial_metas_config_empresa_unica UNIQUE (empresa_id)
);

-- -----------------------------------------------------------------------------
-- 2. Valores-alvo (estimulados) por modalidade
--    Substitui os R$ 300.000 (pregao eletronico) e R$ 100.000 (dispensa)
--    hard-coded. Parametrizavel por periodo e, opcionalmente, por colaborador.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.comercial_valores_alvo (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  modalidade_codigo text NOT NULL,
  valor_alvo        numeric(14,2) NOT NULL CHECK (valor_alvo >= 0),
  vigencia_inicio   date NOT NULL DEFAULT CURRENT_DATE,
  vigencia_fim      date,
  -- NULL = vale para toda a empresa; preenchido = override do colaborador
  user_id           uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comercial_valores_alvo_vigencia_valida
    CHECK (vigencia_fim IS NULL OR vigencia_fim >= vigencia_inicio)
);

-- UNIQUE com coluna anulavel: NULLs sao distintos entre si no Postgres, entao
-- sem o COALESCE seria possivel cadastrar dois defaults de empresa iguais.
CREATE UNIQUE INDEX IF NOT EXISTS ux_comercial_valores_alvo_vigencia
  ON public.comercial_valores_alvo (
    empresa_id,
    modalidade_codigo,
    COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid),
    vigencia_inicio
  );

CREATE INDEX IF NOT EXISTS idx_comercial_valores_alvo_empresa
  ON public.comercial_valores_alvo (empresa_id, modalidade_codigo);

-- -----------------------------------------------------------------------------
-- 3. Meta mensal por colaborador
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.comercial_metas (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id         uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id            uuid NOT NULL,
  ano                int NOT NULL CHECK (ano BETWEEN 2000 AND 2100),
  mes                int NOT NULL CHECK (mes BETWEEN 1 AND 12),
  meta_faturamento   numeric(14,2) NOT NULL DEFAULT 0 CHECK (meta_faturamento >= 0),
  meta_contratos     int CHECK (meta_contratos IS NULL OR meta_contratos >= 0),
  meta_participacoes int CHECK (meta_participacoes IS NULL OR meta_participacoes >= 0),
  -- Sobre o que a meta e medida. Default 'faturamento' (pedido faturado),
  -- pendente de confirmacao do negocio; 'contratos_ganhos' mede valor contratado.
  base_meta          text NOT NULL DEFAULT 'faturamento'
                       CHECK (base_meta IN ('faturamento', 'contratos_ganhos')),
  observacao         text,
  criado_por         uuid,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comercial_metas_periodo_unico UNIQUE (empresa_id, user_id, ano, mes)
);

CREATE INDEX IF NOT EXISTS idx_comercial_metas_periodo
  ON public.comercial_metas (empresa_id, ano, mes);

-- -----------------------------------------------------------------------------
-- 4. Motivos de perda (lista parametrizavel)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.comercial_motivos_perda (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  codigo     text NOT NULL,
  label      text NOT NULL,
  ativo      boolean NOT NULL DEFAULT true,
  ordem      int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comercial_motivos_perda_codigo_unico UNIQUE (empresa_id, codigo)
);

-- -----------------------------------------------------------------------------
-- 5. Registro de perda — motivo OBRIGATORIO
--    A obrigatoriedade e garantida em tres camadas: NOT NULL aqui, trigger de
--    bloqueio no status da licitacao (Fase B) e dialogo na interface (Fase B).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.comercial_perdas (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  licitacao_id      uuid NOT NULL REFERENCES public.licitacoes(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL,
  motivo_id         uuid NOT NULL REFERENCES public.comercial_motivos_perda(id) ON DELETE RESTRICT,
  observacao        text,
  valor_estimado    numeric(14,2) CHECK (valor_estimado IS NULL OR valor_estimado >= 0),
  modalidade_codigo text,
  data_perda        date NOT NULL DEFAULT CURRENT_DATE,
  registrado_por    uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comercial_perdas_licitacao_unica UNIQUE (licitacao_id)
);

CREATE INDEX IF NOT EXISTS idx_comercial_perdas_colaborador
  ON public.comercial_perdas (empresa_id, user_id, data_perda);

-- -----------------------------------------------------------------------------
-- 6. Snapshot de indicadores
--    Guarda o resultado E as premissas usadas no calculo, para o relatorio
--    continuar reproduzivel meses depois mesmo que as taxas mudem.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.comercial_meta_snapshots (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL,
  ano         int NOT NULL CHECK (ano BETWEEN 2000 AND 2100),
  mes         int NOT NULL CHECK (mes BETWEEN 1 AND 12),
  referencia  text NOT NULL CHECK (referencia IN ('Q1', 'Q2', 'MES')),
  indicadores jsonb NOT NULL DEFAULT '{}'::jsonb,
  premissas   jsonb NOT NULL DEFAULT '{}'::jsonb,
  gerado_em   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comercial_meta_snapshots_unico UNIQUE (empresa_id, user_id, ano, mes, referencia)
);

CREATE INDEX IF NOT EXISTS idx_comercial_snapshots_periodo
  ON public.comercial_meta_snapshots (empresa_id, ano, mes);

-- -----------------------------------------------------------------------------
-- 7. Triggers de updated_at (funcao compartilhada ja existente no projeto)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS comercial_metas_config_updated_at ON public.comercial_metas_config;
CREATE TRIGGER comercial_metas_config_updated_at
  BEFORE UPDATE ON public.comercial_metas_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS comercial_valores_alvo_updated_at ON public.comercial_valores_alvo;
CREATE TRIGGER comercial_valores_alvo_updated_at
  BEFORE UPDATE ON public.comercial_valores_alvo
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS comercial_metas_updated_at ON public.comercial_metas;
CREATE TRIGGER comercial_metas_updated_at
  BEFORE UPDATE ON public.comercial_metas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS comercial_motivos_perda_updated_at ON public.comercial_motivos_perda;
CREATE TRIGGER comercial_motivos_perda_updated_at
  BEFORE UPDATE ON public.comercial_motivos_perda
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 8. RLS — padrao do projeto: leitura/escrita por membro da empresa,
--    delete restrito ao admin da empresa.
-- -----------------------------------------------------------------------------
ALTER TABLE public.comercial_metas_config    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comercial_valores_alvo    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comercial_metas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comercial_motivos_perda   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comercial_perdas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comercial_meta_snapshots  ENABLE ROW LEVEL SECURITY;

-- comercial_metas_config — so admin da empresa altera a parametrizacao
DROP POLICY IF EXISTS "comercial_metas_config_select" ON public.comercial_metas_config;
CREATE POLICY "comercial_metas_config_select" ON public.comercial_metas_config FOR SELECT
  USING (public.is_empresa_member(auth.uid(), empresa_id));
DROP POLICY IF EXISTS "comercial_metas_config_insert" ON public.comercial_metas_config;
CREATE POLICY "comercial_metas_config_insert" ON public.comercial_metas_config FOR INSERT
  WITH CHECK (public.is_empresa_admin(auth.uid(), empresa_id));
DROP POLICY IF EXISTS "comercial_metas_config_update" ON public.comercial_metas_config;
CREATE POLICY "comercial_metas_config_update" ON public.comercial_metas_config FOR UPDATE
  USING (public.is_empresa_admin(auth.uid(), empresa_id));
DROP POLICY IF EXISTS "comercial_metas_config_delete" ON public.comercial_metas_config;
CREATE POLICY "comercial_metas_config_delete" ON public.comercial_metas_config FOR DELETE
  USING (public.is_empresa_admin(auth.uid(), empresa_id));

-- comercial_valores_alvo — todos leem (o motor precisa), admin parametriza
DROP POLICY IF EXISTS "comercial_valores_alvo_select" ON public.comercial_valores_alvo;
CREATE POLICY "comercial_valores_alvo_select" ON public.comercial_valores_alvo FOR SELECT
  USING (public.is_empresa_member(auth.uid(), empresa_id));
DROP POLICY IF EXISTS "comercial_valores_alvo_insert" ON public.comercial_valores_alvo;
CREATE POLICY "comercial_valores_alvo_insert" ON public.comercial_valores_alvo FOR INSERT
  WITH CHECK (public.is_empresa_admin(auth.uid(), empresa_id));
DROP POLICY IF EXISTS "comercial_valores_alvo_update" ON public.comercial_valores_alvo;
CREATE POLICY "comercial_valores_alvo_update" ON public.comercial_valores_alvo FOR UPDATE
  USING (public.is_empresa_admin(auth.uid(), empresa_id));
DROP POLICY IF EXISTS "comercial_valores_alvo_delete" ON public.comercial_valores_alvo;
CREATE POLICY "comercial_valores_alvo_delete" ON public.comercial_valores_alvo FOR DELETE
  USING (public.is_empresa_admin(auth.uid(), empresa_id));

-- comercial_metas — colaborador le a propria e as demais do time (visao de
-- setor no dashboard e filtrada na aplicacao); so admin da empresa define meta
DROP POLICY IF EXISTS "comercial_metas_select" ON public.comercial_metas;
CREATE POLICY "comercial_metas_select" ON public.comercial_metas FOR SELECT
  USING (public.is_empresa_member(auth.uid(), empresa_id));
DROP POLICY IF EXISTS "comercial_metas_insert" ON public.comercial_metas;
CREATE POLICY "comercial_metas_insert" ON public.comercial_metas FOR INSERT
  WITH CHECK (public.is_empresa_admin(auth.uid(), empresa_id));
DROP POLICY IF EXISTS "comercial_metas_update" ON public.comercial_metas;
CREATE POLICY "comercial_metas_update" ON public.comercial_metas FOR UPDATE
  USING (public.is_empresa_admin(auth.uid(), empresa_id));
DROP POLICY IF EXISTS "comercial_metas_delete" ON public.comercial_metas;
CREATE POLICY "comercial_metas_delete" ON public.comercial_metas FOR DELETE
  USING (public.is_empresa_admin(auth.uid(), empresa_id));

-- comercial_motivos_perda
DROP POLICY IF EXISTS "comercial_motivos_perda_select" ON public.comercial_motivos_perda;
CREATE POLICY "comercial_motivos_perda_select" ON public.comercial_motivos_perda FOR SELECT
  USING (public.is_empresa_member(auth.uid(), empresa_id));
DROP POLICY IF EXISTS "comercial_motivos_perda_insert" ON public.comercial_motivos_perda;
CREATE POLICY "comercial_motivos_perda_insert" ON public.comercial_motivos_perda FOR INSERT
  WITH CHECK (public.is_empresa_admin(auth.uid(), empresa_id));
DROP POLICY IF EXISTS "comercial_motivos_perda_update" ON public.comercial_motivos_perda;
CREATE POLICY "comercial_motivos_perda_update" ON public.comercial_motivos_perda FOR UPDATE
  USING (public.is_empresa_admin(auth.uid(), empresa_id));
DROP POLICY IF EXISTS "comercial_motivos_perda_delete" ON public.comercial_motivos_perda;
CREATE POLICY "comercial_motivos_perda_delete" ON public.comercial_motivos_perda FOR DELETE
  USING (public.is_empresa_admin(auth.uid(), empresa_id));

-- comercial_perdas — qualquer membro registra a propria perda; sem UPDATE
-- (correcao = apagar e registrar de novo, mantendo a trilha)
DROP POLICY IF EXISTS "comercial_perdas_select" ON public.comercial_perdas;
CREATE POLICY "comercial_perdas_select" ON public.comercial_perdas FOR SELECT
  USING (public.is_empresa_member(auth.uid(), empresa_id));
DROP POLICY IF EXISTS "comercial_perdas_insert" ON public.comercial_perdas;
CREATE POLICY "comercial_perdas_insert" ON public.comercial_perdas FOR INSERT
  WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));
DROP POLICY IF EXISTS "comercial_perdas_update" ON public.comercial_perdas;
CREATE POLICY "comercial_perdas_update" ON public.comercial_perdas FOR UPDATE
  USING (public.is_empresa_member(auth.uid(), empresa_id));
DROP POLICY IF EXISTS "comercial_perdas_delete" ON public.comercial_perdas;
CREATE POLICY "comercial_perdas_delete" ON public.comercial_perdas FOR DELETE
  USING (public.is_empresa_admin(auth.uid(), empresa_id));

-- comercial_meta_snapshots
DROP POLICY IF EXISTS "comercial_meta_snapshots_select" ON public.comercial_meta_snapshots;
CREATE POLICY "comercial_meta_snapshots_select" ON public.comercial_meta_snapshots FOR SELECT
  USING (public.is_empresa_member(auth.uid(), empresa_id));
DROP POLICY IF EXISTS "comercial_meta_snapshots_insert" ON public.comercial_meta_snapshots;
CREATE POLICY "comercial_meta_snapshots_insert" ON public.comercial_meta_snapshots FOR INSERT
  WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));
DROP POLICY IF EXISTS "comercial_meta_snapshots_update" ON public.comercial_meta_snapshots;
CREATE POLICY "comercial_meta_snapshots_update" ON public.comercial_meta_snapshots FOR UPDATE
  USING (public.is_empresa_member(auth.uid(), empresa_id));
DROP POLICY IF EXISTS "comercial_meta_snapshots_delete" ON public.comercial_meta_snapshots;
CREATE POLICY "comercial_meta_snapshots_delete" ON public.comercial_meta_snapshots FOR DELETE
  USING (public.is_empresa_admin(auth.uid(), empresa_id));

-- -----------------------------------------------------------------------------
-- 9. Seed dos padroes por empresa
--    Mesma abordagem de `fin_seed_plano_contas_padrao`: funcao idempotente que
--    a aplicacao pode chamar ao criar empresa ou para restaurar os padroes.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.comercial_seed_padroes(p_empresa_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_valores int := 0;
  v_motivos int := 0;
BEGIN
  -- Valores-alvo estimulados por modalidade
  INSERT INTO public.comercial_valores_alvo (empresa_id, modalidade_codigo, valor_alvo, vigencia_inicio)
  VALUES
    (p_empresa_id, 'pregao_eletronico', 300000.00, DATE '2000-01-01'),
    (p_empresa_id, 'dispensa',          100000.00, DATE '2000-01-01')
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_valores = ROW_COUNT;

  -- Motivos de perda
  INSERT INTO public.comercial_motivos_perda (empresa_id, codigo, label, ordem)
  VALUES
    (p_empresa_id, 'preco',                 'Preço',                 1),
    (p_empresa_id, 'habilitacao',           'Habilitação',           2),
    (p_empresa_id, 'prazo',                 'Prazo',                 3),
    (p_empresa_id, 'especificacao_tecnica', 'Especificação técnica', 4),
    (p_empresa_id, 'desistencia',           'Desistência',           5),
    (p_empresa_id, 'outro',                 'Outro',                 99)
  ON CONFLICT (empresa_id, codigo) DO NOTHING;
  GET DIAGNOSTICS v_motivos = ROW_COUNT;

  -- Configuracao geral
  INSERT INTO public.comercial_metas_config (empresa_id)
  VALUES (p_empresa_id)
  ON CONFLICT (empresa_id) DO NOTHING;

  RETURN jsonb_build_object(
    'empresa_id',      p_empresa_id,
    'valores_alvo',    v_valores,
    'motivos_perda',   v_motivos
  );
END;
$$;

-- Aplica os padroes nas empresas ja existentes
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.empresas LOOP
    PERFORM public.comercial_seed_padroes(r.id);
  END LOOP;
END;
$$;
```

## [2026-08-03] Metas do Comercial — Fase B (ingestão e motivo de perda obrigatório)

> Liga o módulo de metas aos demais: deriva o realizado de `licitacoes`, `contratos` e
> `contrato_pedidos`, e passa a exigir motivo para marcar um processo como **Perdida**.
>
> **Rode depois da Fase A.** O script faz três alterações retroativas, todas idempotentes:
> - preenche `contratos.vendedor_user_id` nulo com `contratos.user_id`, marcando
>   `vendedor_atribuido_automaticamente = true` para auditoria;
> - preenche `licitacoes.data_proposta_enviada` dos processos que já passaram da proposta;
> - cria em `comercial_perdas` um registro "Não informado (anterior à regra)" para cada
>   perda antiga — o motivo fica **inativo**, então não aparece na lista de escolha.
>
> ⚠️ A partir daqui, mudar o status para "Perdida" sem registro em `comercial_perdas` é
> recusado pelo banco. As telas que faziam isso (Kanban, edição do processo e Robô de
> Lances) já abrem o diálogo de motivo antes de gravar.

```sql
-- =============================================================================
-- MIGRATION: Metas do Comercial — Fase B (ingestao e vinculo com os modulos)
-- Data: 2026-08-03
-- Objetivo: derivar o realizado dos modulos existentes (licitacoes, contratos,
--           contrato_pedidos) e tornar obrigatorio o motivo de perda.
--
-- Decisoes de negocio aplicadas aqui:
--   (3) contratos sem vendedor_user_id recebem o contratos.user_id, marcados
--       como atribuicao automatica para auditoria futura;
--   (4) motivo de perda so e exigido daqui pra frente — o historico recebe o
--       motivo "Nao informado (anterior a regra)", inativo para novos registros;
--   (5) "participado" = proposta enviada, medida por licitacoes.data_proposta_enviada.
--
-- Nenhuma tabela nova: o realizado e sempre derivado, nunca copiado.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Vendedor do contrato (decisao 3)
-- -----------------------------------------------------------------------------
ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS vendedor_atribuido_automaticamente boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.contratos.vendedor_atribuido_automaticamente IS
  'true = vendedor_user_id foi preenchido pela implantacao do modulo de metas '
  'com o contratos.user_id, e nao informado por uma pessoa. Serve de trilha '
  'para revisao posterior da carteira.';

UPDATE public.contratos
   SET vendedor_user_id = user_id,
       vendedor_atribuido_automaticamente = true
 WHERE vendedor_user_id IS NULL
   AND user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contratos_vendedor
  ON public.contratos (vendedor_user_id, data_assinatura)
  WHERE vendedor_user_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 2. Marco de "participacao" = proposta enviada (decisao 5)
--    O status guarda so o estado atual; sem uma data propria nao daria para
--    atribuir a participacao ao mes correto.
-- -----------------------------------------------------------------------------
ALTER TABLE public.licitacoes
  ADD COLUMN IF NOT EXISTS data_proposta_enviada timestamptz;

COMMENT ON COLUMN public.licitacoes.data_proposta_enviada IS
  'Momento em que o processo alcancou "Proposta Enviada" pela primeira vez. '
  'E o evento que conta como participacao no modulo de metas.';

CREATE OR REPLACE FUNCTION public.comercial_marcar_proposta_enviada()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Uma vez marcada, nunca mais muda: voltar o card no Kanban nao apaga o
  -- fato de a proposta ter sido enviada.
  IF NEW.data_proposta_enviada IS NULL
     AND NEW.status IN ('Proposta Enviada', 'Em Disputa', 'Vencida', 'Homologada', 'Perdida')
  THEN
    NEW.data_proposta_enviada := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS licitacoes_marcar_proposta_enviada ON public.licitacoes;
CREATE TRIGGER licitacoes_marcar_proposta_enviada
  BEFORE INSERT OR UPDATE ON public.licitacoes
  FOR EACH ROW EXECUTE FUNCTION public.comercial_marcar_proposta_enviada();

-- Backfill: usa a mensagem de sistema da mudanca de status quando existir
-- (e o registro mais proximo do evento real); senao cai no updated_at.
UPDATE public.licitacoes l
   SET data_proposta_enviada = COALESCE(
         (SELECT MIN(m.created_at)
            FROM public.licitacao_mensagens m
           WHERE m.licitacao_id = l.id
             AND m.tipo = 'sistema'
             AND m.conteudo ILIKE '%Proposta Enviada%'),
         l.updated_at)
 WHERE l.data_proposta_enviada IS NULL
   AND l.status IN ('Proposta Enviada', 'Em Disputa', 'Vencida', 'Homologada', 'Perdida');

CREATE INDEX IF NOT EXISTS idx_licitacoes_proposta_enviada
  ON public.licitacoes (empresa_id, user_id, data_proposta_enviada)
  WHERE data_proposta_enviada IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 3. Normalizacao de modalidade em SQL
--    ESPELHO de src/lib/metas/modalidades.ts — as duas versoes precisam mudar
--    juntas. Aqui e a autoridade para agregacao; la, para a interface.
-- -----------------------------------------------------------------------------
-- Remove acentos sem depender da extensao `unaccent`, que pode nao estar
-- instalada no projeto. Cobre o que aparece em nome de modalidade.
CREATE OR REPLACE FUNCTION public.comercial_sem_acento(p_texto text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT translate(
    coalesce(p_texto, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
  );
$$;

CREATE OR REPLACE FUNCTION public.comercial_normalizar_modalidade(p_texto text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  t text;
BEGIN
  t := lower(regexp_replace(public.comercial_sem_acento(coalesce(p_texto, '')), '[^a-zA-Z0-9]+', ' ', 'g'));
  t := trim(t);
  IF t = '' THEN RETURN 'outra'; END IF;

  IF t LIKE '%pregao%' AND (t LIKE '%presencial%' OR t LIKE '%nao eletronico%') THEN
    RETURN 'pregao_presencial';
  END IF;
  IF t LIKE '%pregao%'        THEN RETURN 'pregao_eletronico'; END IF;
  IF t LIKE '%dispensa%'      THEN RETURN 'dispensa'; END IF;
  IF t LIKE '%inexigib%'      THEN RETURN 'inexigibilidade'; END IF;
  IF t LIKE '%credenciamento%' THEN RETURN 'credenciamento'; END IF;
  IF t LIKE '%tomada%'        THEN RETURN 'tomada_precos'; END IF;
  IF t LIKE '%convite%'       THEN RETURN 'convite'; END IF;
  IF t LIKE '%concorrencia%'  THEN RETURN 'concorrencia'; END IF;
  IF t LIKE '%concurso%'      THEN RETURN 'concurso'; END IF;
  IF t LIKE '%leilao%'        THEN RETURN 'leilao'; END IF;

  RETURN 'outra';
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. Perdas historicas (decisao 4)
--    Motivo inativo: aparece no relatorio, mas nao na lista de escolha.
-- -----------------------------------------------------------------------------
INSERT INTO public.comercial_motivos_perda (empresa_id, codigo, label, ordem, ativo)
SELECT e.id, 'nao_informado_legado', 'Não informado (anterior à regra)', 100, false
  FROM public.empresas e
ON CONFLICT (empresa_id, codigo) DO NOTHING;

INSERT INTO public.comercial_perdas (
  empresa_id, licitacao_id, user_id, motivo_id, observacao,
  valor_estimado, modalidade_codigo, data_perda
)
SELECT l.empresa_id,
       l.id,
       l.user_id,
       m.id,
       'Registro criado na implantação do módulo de metas. A perda é anterior à regra de motivo obrigatório.',
       l.valor_estimado,
       public.comercial_normalizar_modalidade(l.modalidade),
       COALESCE(l.data_encerramento::date, l.updated_at::date)
  FROM public.licitacoes l
  JOIN public.comercial_motivos_perda m
    ON m.empresa_id = l.empresa_id
   AND m.codigo = 'nao_informado_legado'
 WHERE l.empresa_id IS NOT NULL
   AND (l.status = 'Perdida' OR l.resultado = 'Perdedor')
ON CONFLICT (licitacao_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 5. Motivo obrigatorio daqui pra frente
--    Só em UPDATE: um INSERT ja nascendo "Perdida" nao teria como ter o
--    registro de perda antes, e nenhum fluxo do app faz isso hoje.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.comercial_exigir_motivo_perda()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'Perdida' AND OLD.status IS DISTINCT FROM 'Perdida' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.comercial_perdas p WHERE p.licitacao_id = NEW.id
    ) THEN
      RAISE EXCEPTION
        'Registre o motivo da perda antes de marcar o processo como Perdida.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS licitacoes_exigir_motivo_perda ON public.licitacoes;
CREATE TRIGGER licitacoes_exigir_motivo_perda
  BEFORE UPDATE ON public.licitacoes
  FOR EACH ROW EXECUTE FUNCTION public.comercial_exigir_motivo_perda();

-- -----------------------------------------------------------------------------
-- 6. Realizado mensal por colaborador
--    security_invoker=on: sem isso a view rodaria com o dono e furaria a RLS
--    das tabelas de origem.
--    Fuso America/Sao_Paulo em todo timestamptz, para o mes fechar certo.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.vw_comercial_realizado_mensal
WITH (security_invoker = on) AS
WITH participacoes AS (
  SELECT l.empresa_id,
         l.user_id,
         EXTRACT(YEAR  FROM l.data_proposta_enviada AT TIME ZONE 'America/Sao_Paulo')::int AS ano,
         EXTRACT(MONTH FROM l.data_proposta_enviada AT TIME ZONE 'America/Sao_Paulo')::int AS mes,
         COUNT(*)::int AS participados
    FROM public.licitacoes l
   WHERE l.empresa_id IS NOT NULL
     AND l.data_proposta_enviada IS NOT NULL
   GROUP BY 1, 2, 3, 4
),
ganhos AS (
  SELECT c.empresa_id,
         c.vendedor_user_id AS user_id,
         EXTRACT(YEAR  FROM c.data_assinatura)::int AS ano,
         EXTRACT(MONTH FROM c.data_assinatura)::int AS mes,
         COUNT(*)::int AS ganhos,
         SUM(c.valor_global)::numeric(14,2) AS valor_ganho
    FROM public.contratos c
   WHERE c.empresa_id IS NOT NULL
     AND c.vendedor_user_id IS NOT NULL
     AND c.data_assinatura IS NOT NULL
   GROUP BY 1, 2, 3, 4
),
perdas AS (
  SELECT p.empresa_id,
         p.user_id,
         EXTRACT(YEAR  FROM p.data_perda)::int AS ano,
         EXTRACT(MONTH FROM p.data_perda)::int AS mes,
         COUNT(*)::int AS perdidos,
         COALESCE(SUM(p.valor_estimado), 0)::numeric(14,2) AS valor_perdido
    FROM public.comercial_perdas p
   GROUP BY 1, 2, 3, 4
),
faturamento AS (
  SELECT c.empresa_id,
         c.vendedor_user_id AS user_id,
         EXTRACT(YEAR  FROM cp.data_pedido)::int AS ano,
         EXTRACT(MONTH FROM cp.data_pedido)::int AS mes,
         COUNT(*)::int AS pedidos_faturados,
         SUM(cp.valor_total)::numeric(14,2) AS valor_faturado
    FROM public.contrato_pedidos cp
    JOIN public.contratos c ON c.id = cp.contrato_id
   WHERE c.empresa_id IS NOT NULL
     AND c.vendedor_user_id IS NOT NULL
     AND cp.data_pedido IS NOT NULL
   GROUP BY 1, 2, 3, 4
),
quitacoes AS (
  SELECT c.empresa_id,
         c.vendedor_user_id AS user_id,
         EXTRACT(YEAR  FROM cp.data_quitacao)::int AS ano,
         EXTRACT(MONTH FROM cp.data_quitacao)::int AS mes,
         COUNT(*)::int AS nfe_quitadas,
         SUM(cp.valor_total)::numeric(14,2) AS valor_quitado
    FROM public.contrato_pedidos cp
    JOIN public.contratos c ON c.id = cp.contrato_id
   WHERE c.empresa_id IS NOT NULL
     AND c.vendedor_user_id IS NOT NULL
     AND cp.nf_quitada IS TRUE
     AND cp.data_quitacao IS NOT NULL
   GROUP BY 1, 2, 3, 4
),
chaves AS (
  SELECT empresa_id, user_id, ano, mes FROM participacoes
  UNION SELECT empresa_id, user_id, ano, mes FROM ganhos
  UNION SELECT empresa_id, user_id, ano, mes FROM perdas
  UNION SELECT empresa_id, user_id, ano, mes FROM faturamento
  UNION SELECT empresa_id, user_id, ano, mes FROM quitacoes
)
SELECT k.empresa_id,
       k.user_id,
       k.ano,
       k.mes,
       COALESCE(pa.participados, 0)      AS participados,
       COALESCE(g.ganhos, 0)             AS ganhos,
       COALESCE(pe.perdidos, 0)          AS perdidos,
       COALESCE(g.valor_ganho, 0)        AS valor_ganho,
       COALESCE(pe.valor_perdido, 0)     AS valor_perdido,
       COALESCE(f.pedidos_faturados, 0)  AS pedidos_faturados,
       COALESCE(f.valor_faturado, 0)     AS valor_faturado,
       COALESCE(q.nfe_quitadas, 0)       AS nfe_quitadas,
       COALESCE(q.valor_quitado, 0)      AS valor_quitado
  FROM chaves k
  LEFT JOIN participacoes pa ON (pa.empresa_id, pa.user_id, pa.ano, pa.mes) = (k.empresa_id, k.user_id, k.ano, k.mes)
  LEFT JOIN ganhos       g  ON (g.empresa_id,  g.user_id,  g.ano,  g.mes)  = (k.empresa_id, k.user_id, k.ano, k.mes)
  LEFT JOIN perdas       pe ON (pe.empresa_id, pe.user_id, pe.ano, pe.mes) = (k.empresa_id, k.user_id, k.ano, k.mes)
  LEFT JOIN faturamento  f  ON (f.empresa_id,  f.user_id,  f.ano,  f.mes)  = (k.empresa_id, k.user_id, k.ano, k.mes)
  LEFT JOIN quitacoes    q  ON (q.empresa_id,  q.user_id,  q.ano,  q.mes)  = (k.empresa_id, k.user_id, k.ano, k.mes);

COMMENT ON VIEW public.vw_comercial_realizado_mensal IS
  'Realizado mensal por colaborador, derivado de licitacoes (participados), '
  'contratos (ganhos), comercial_perdas (perdidos) e contrato_pedidos '
  '(faturado e NF quitada). Mes calculado em America/Sao_Paulo.';
```

## [2026-08-03] Metas do Comercial — Fase C (feriados e padrões de conversão)

> Insumos do motor de projeção. **Rode depois das Fases A e B.**
>
> - `comercial_feriados`: calendário alimentado pelo admin. Dia útil = seg–sex menos
>   essas datas. **Com a tabela vazia nada muda** — o motor se comporta como só seg–sex.
> - Três colunas novas em `comercial_metas_config`: as taxas assumidas quando o
>   colaborador ainda não tem histórico, e os anos exigidos para confiar na sazonalidade.
>   Ficam configuráveis pelo mesmo motivo dos valores-alvo: não virar constante no código.

```sql
-- =============================================================================
-- MIGRATION: Metas do Comercial — Fase C (insumos do motor de projecao)
-- Data: 2026-08-03
-- Objetivo: dar ao motor os dois insumos que faltavam — o calendario de dias
--           uteis e os padroes de conversao usados quando nao ha historico.
--
-- Decisao (6): dias uteis = seg-sex menos as datas de comercial_feriados.
-- Com a tabela vazia o motor se comporta como "so seg-sex", entao nada quebra
-- enquanto o admin nao cadastrar feriado nenhum.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Calendario de feriados, alimentado pelo admin
--    Por empresa: filial em outro municipio tem feriado municipal diferente.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.comercial_feriados (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  data       date NOT NULL,
  descricao  text NOT NULL,
  -- 'nacional' | 'estadual' | 'municipal' | 'ponto_facultativo' | 'outro'
  abrangencia text NOT NULL DEFAULT 'nacional',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comercial_feriados_data_unica UNIQUE (empresa_id, data)
);

CREATE INDEX IF NOT EXISTS idx_comercial_feriados_periodo
  ON public.comercial_feriados (empresa_id, data);

COMMENT ON TABLE public.comercial_feriados IS
  'Datas descontadas do calculo de dias uteis do modulo de metas. Vazia, o '
  'motor considera apenas segunda a sexta.';

ALTER TABLE public.comercial_feriados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comercial_feriados_select" ON public.comercial_feriados;
CREATE POLICY "comercial_feriados_select" ON public.comercial_feriados FOR SELECT
  USING (public.is_empresa_member(auth.uid(), empresa_id));
DROP POLICY IF EXISTS "comercial_feriados_insert" ON public.comercial_feriados;
CREATE POLICY "comercial_feriados_insert" ON public.comercial_feriados FOR INSERT
  WITH CHECK (public.is_empresa_admin(auth.uid(), empresa_id));
DROP POLICY IF EXISTS "comercial_feriados_update" ON public.comercial_feriados;
CREATE POLICY "comercial_feriados_update" ON public.comercial_feriados FOR UPDATE
  USING (public.is_empresa_admin(auth.uid(), empresa_id));
DROP POLICY IF EXISTS "comercial_feriados_delete" ON public.comercial_feriados;
CREATE POLICY "comercial_feriados_delete" ON public.comercial_feriados FOR DELETE
  USING (public.is_empresa_admin(auth.uid(), empresa_id));

-- -----------------------------------------------------------------------------
-- 2. Padroes conservadores de conversao
--    Usados quando o colaborador ainda nao tem historico. Ficam na
--    configuracao pelo mesmo motivo dos valores-alvo: nao virar constante no
--    codigo do motor.
-- -----------------------------------------------------------------------------
ALTER TABLE public.comercial_metas_config
  ADD COLUMN IF NOT EXISTS tx_ganho_padrao numeric(5,4) NOT NULL DEFAULT 0.2000
    CHECK (tx_ganho_padrao > 0 AND tx_ganho_padrao <= 1),
  ADD COLUMN IF NOT EXISTS tx_faturamento_padrao numeric(5,4) NOT NULL DEFAULT 0.7000
    CHECK (tx_faturamento_padrao > 0 AND tx_faturamento_padrao <= 1),
  -- Anos de historico exigidos para confiar no indice de sazonalidade
  ADD COLUMN IF NOT EXISTS min_anos_sazonalidade int NOT NULL DEFAULT 2
    CHECK (min_anos_sazonalidade >= 1);

COMMENT ON COLUMN public.comercial_metas_config.tx_ganho_padrao IS
  'Conversao participado -> ganho assumida quando falta historico. '
  'Conservadora de proposito: quanto menor, mais processos o motor exige.';
COMMENT ON COLUMN public.comercial_metas_config.tx_faturamento_padrao IS
  'Fracao do valor contratado que vira pedido faturado, assumida quando falta historico.';
```

## [2026-08-04] Metas do Comercial — Praça por colaborador (Fase 1)

Dia útil por praça: feriado ganha escopo (uf/municipio opcionais; NULL/NULL =
nacional) e o colaborador ganha praça em `empresa_membros`. A UNIQUE de
feriados vira índice com COALESCE (duas UFs podem ter feriado na mesma data);
comparação de município é canônica via `comercial_normalizar_municipio`,
espelho de `src/lib/metas/praca.ts`. Sem praça definida = só nacionais.
Inclui reforços da verificação adversarial: ñ no `comercial_sem_acento`,
`normalize(NFC)` contra entrada decomposta, CHECKs pela forma normalizada e
coerência bidirecional com `abrangencia`.

```sql
-- =============================================================================
-- MIGRATION: Metas do Comercial — Praça por colaborador (Fase 1)
-- Data: 2026-08-04
-- Objetivo: dia útil varia por praça — feriado ganha escopo (nacional/
--           estadual/municipal) e o colaborador ganha uma praça (uf,
--           municipio). O motor filtra: nacionais + os da UF dele + os do
--           município dele. Sem praça definida, só os nacionais (fallback
--           que preserva o comportamento atual — nada quebra na transição).
--
-- Ressalvas da auditoria aplicadas aqui:
--   (1) A UNIQUE antiga (empresa_id, data) barraria duas UFs com feriado na
--       mesma data. Trocada por índice único com COALESCE — NULLs são
--       distintos entre si no Postgres, então sem o COALESCE daria para
--       duplicar o nacional da mesma data.
--   (2) Município é texto livre e falha PARA MENOS quando a grafia diverge
--       ("Santa Rosa" vs "SANTA ROSA "): a comparação canônica usa
--       comercial_normalizar_municipio, espelho de src/lib/metas/praca.ts —
--       as duas versões precisam mudar juntas.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Normalização de município (espelho do normalizarMunicipio em TS)
--    minúsculas, sem acento, pontuação vira espaço, espaços colapsados.
--
--    Dois reforços vindos da verificação adversarial:
--    a) comercial_sem_acento ganha ñ/Ñ (o TS já os cobria via NFD+\p{Mn};
--       sem isto, 'Muñoz' nunca casaria entre os dois lados);
--    b) normalize(..., NFC) recompõe entrada decomposta (texto colado do
--       macOS chega em NFD e o translate só mapeia pré-compostos — 'São'
--       decomposto viraria 'sa o' no SQL e 'sao' no TS).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.comercial_sem_acento(p_texto text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT translate(
    coalesce(p_texto, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'
  );
$$;

CREATE OR REPLACE FUNCTION public.comercial_normalizar_municipio(p_texto text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(
    btrim(regexp_replace(
      lower(public.comercial_sem_acento(normalize(coalesce(p_texto, ''), NFC))),
      '[^a-z0-9]+', ' ', 'g'
    )),
    ''
  )
$$;

COMMENT ON FUNCTION public.comercial_normalizar_municipio(text) IS
  'Forma canonica de municipio para comparacao de praca. ESPELHO de '
  'src/lib/metas/praca.ts (normalizarMunicipio) — mudar as duas juntas.';

-- -----------------------------------------------------------------------------
-- 2. Escopo do feriado: uf/municipio opcionais
--    NULL/NULL = nacional; uf = estadual; uf+municipio = municipal.
-- -----------------------------------------------------------------------------
ALTER TABLE public.comercial_feriados
  ADD COLUMN IF NOT EXISTS uf text,
  ADD COLUMN IF NOT EXISTS municipio text;

COMMENT ON COLUMN public.comercial_feriados.uf IS
  'NULL = feriado nacional. Preenchida (sigla maiuscula) = vale para a UF.';
COMMENT ON COLUMN public.comercial_feriados.municipio IS
  'Com uf preenchida, restringe o feriado ao municipio. Comparacao sempre '
  'pela forma normalizada (comercial_normalizar_municipio).';

ALTER TABLE public.comercial_feriados DROP CONSTRAINT IF EXISTS comercial_feriados_uf_valida;
ALTER TABLE public.comercial_feriados ADD CONSTRAINT comercial_feriados_uf_valida
  CHECK (uf IS NULL OR uf ~ '^[A-Z]{2}$');

-- Município válido = tem UF e sobrevive à normalização ('   ' e '***'
-- normalizam para NULL; sem esta regra, um "municipal" em branco valeria
-- para a UF inteira — falha PARA MAIS, o oposto da filosofia do módulo).
ALTER TABLE public.comercial_feriados DROP CONSTRAINT IF EXISTS comercial_feriados_municipio_exige_uf;
ALTER TABLE public.comercial_feriados ADD CONSTRAINT comercial_feriados_municipio_exige_uf
  CHECK (
    municipio IS NULL
    OR (uf IS NOT NULL AND public.comercial_normalizar_municipio(municipio) IS NOT NULL)
  );

-- Coerência BIDIRECIONAL com a coluna abrangencia: o motor filtra por
-- uf/municipio e ignora o rótulo — sem as duas direções, um "nacional" com
-- uf preenchida valeria só para uma UF com rótulo de nacional.
-- 'ponto_facultativo' e 'outro' ficam livres de propósito (podem ser de
-- qualquer escopo).
ALTER TABLE public.comercial_feriados DROP CONSTRAINT IF EXISTS comercial_feriados_abrangencia_praca;
ALTER TABLE public.comercial_feriados ADD CONSTRAINT comercial_feriados_abrangencia_praca
  CHECK (
    (abrangencia <> 'nacional' OR (uf IS NULL AND municipio IS NULL))
    AND (abrangencia <> 'estadual' OR (uf IS NOT NULL AND municipio IS NULL))
    AND (abrangencia <> 'municipal'
         OR (uf IS NOT NULL AND public.comercial_normalizar_municipio(municipio) IS NOT NULL))
  );

-- Ressalva (1): unicidade por praça, com COALESCE
ALTER TABLE public.comercial_feriados DROP CONSTRAINT IF EXISTS comercial_feriados_data_unica;
CREATE UNIQUE INDEX IF NOT EXISTS ux_comercial_feriados_data_praca
  ON public.comercial_feriados (
    empresa_id,
    data,
    COALESCE(uf, ''),
    COALESCE(public.comercial_normalizar_municipio(municipio), '')
  );

-- O índice de período da 20260803000003 virou redundante: o único acima tem
-- o mesmo prefixo (empresa_id, data) e atende as mesmas consultas de range.
DROP INDEX IF EXISTS public.idx_comercial_feriados_periodo;

-- -----------------------------------------------------------------------------
-- 3. Praça do colaborador
--    Editável pelo admin na tela de Equipe; RLS de empresa_membros já cobre.
-- -----------------------------------------------------------------------------
ALTER TABLE public.empresa_membros
  ADD COLUMN IF NOT EXISTS praca_uf text,
  ADD COLUMN IF NOT EXISTS praca_municipio text;

COMMENT ON COLUMN public.empresa_membros.praca_uf IS
  'Praca do colaborador para o calculo de dias uteis das metas. NULL = usa '
  'so os feriados nacionais (comportamento anterior a Fase 1).';
COMMENT ON COLUMN public.empresa_membros.praca_municipio IS
  'Municipio da praca; so tem efeito com praca_uf preenchida.';

ALTER TABLE public.empresa_membros DROP CONSTRAINT IF EXISTS empresa_membros_praca_uf_valida;
ALTER TABLE public.empresa_membros ADD CONSTRAINT empresa_membros_praca_uf_valida
  CHECK (praca_uf IS NULL OR praca_uf ~ '^[A-Z]{2}$');

ALTER TABLE public.empresa_membros DROP CONSTRAINT IF EXISTS empresa_membros_praca_municipio_exige_uf;
ALTER TABLE public.empresa_membros ADD CONSTRAINT empresa_membros_praca_municipio_exige_uf
  CHECK (
    praca_municipio IS NULL
    OR (praca_uf IS NOT NULL AND public.comercial_normalizar_municipio(praca_municipio) IS NOT NULL)
  );

```
---

## [2026-04-25] Configuração tributária e apurações do Financeiro (registro retroativo)

Migration gerada pelo Lovable (`20260425194132_9068ae31-35fa-436b-bdcc-1fe5038e86c5.sql`),
aplicada em produção mas nunca registrada aqui. Entra no log por ser a fundação do épico do
Motor de Precificação Tributária e por ter um defeito de domínio conhecido.

**DEFEITO CONHECIDO — não corrigido neste bloco.** As nove colunas de alíquota são
`numeric(5,4)`, cujo valor máximo é 9,9999, mas os DEFAULTs são percentuais: `aliquota_irpj
15.00`, `adicional_irpj 10.00` e `aliquota_icms 18.00` estouram o próprio tipo. O DDL passa
(o Postgres não avalia a default expression na criação), mas nenhum INSERT funciona — nem um
que omita as colunas. Por isso `financeiro_config_tributaria` e `financeiro_apuracoes` estavam
com zero linhas em 2026-08-08. O `ALTER TYPE` para `numeric(7,4)` + `CHECK (0..100)` sai na
fase de correção de schema do épico, com bloco próprio; ver `docs/epico-motor-precificacao-tributaria.md`.

Em relação ao arquivo original foram acrescentadas apenas as guardas `DROP POLICY IF EXISTS`
e `DROP TRIGGER IF EXISTS` — sem elas o bloco falha ao ser recolado, porque as tabelas já
existem. As mesmas guardas foram aplicadas ao arquivo de migration, para os dois lados
permanecerem com o mesmo conteúdo.

```sql
-- 0) Coluna auxiliar (precisa existir antes da RPC)
ALTER TABLE public.financeiro_categorias
  ADD COLUMN IF NOT EXISTS tipo_servico text CHECK (tipo_servico IN ('comercio','servico','outro'));

-- 1) Configuração tributária da empresa
CREATE TABLE IF NOT EXISTS public.financeiro_config_tributaria (
  empresa_id uuid PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,
  regime text NOT NULL DEFAULT 'simples' CHECK (regime IN ('simples','presumido','real')),
  anexo_simples smallint CHECK (anexo_simples BETWEEN 1 AND 5),
  presuncao_irpj_comercio numeric(5,2) DEFAULT 8.00,
  presuncao_irpj_servico numeric(5,2) DEFAULT 32.00,
  presuncao_csll_comercio numeric(5,2) DEFAULT 12.00,
  presuncao_csll_servico numeric(5,2) DEFAULT 32.00,
  aliquota_pis numeric(5,4) DEFAULT 0.65,
  aliquota_cofins numeric(5,4) DEFAULT 3.00,
  aliquota_pis_nc numeric(5,4) DEFAULT 1.65,
  aliquota_cofins_nc numeric(5,4) DEFAULT 7.60,
  aliquota_irpj numeric(5,4) DEFAULT 15.00,
  adicional_irpj numeric(5,4) DEFAULT 10.00,
  limite_adicional_irpj numeric(14,2) DEFAULT 20000.00,
  aliquota_csll numeric(5,4) DEFAULT 9.00,
  aliquota_iss numeric(5,4) DEFAULT 5.00,
  aliquota_icms numeric(5,4) DEFAULT 18.00,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.financeiro_config_tributaria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "membros veem config tributaria" ON public.financeiro_config_tributaria;
CREATE POLICY "membros veem config tributaria"
  ON public.financeiro_config_tributaria FOR SELECT
  USING (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "admins gerenciam config tributaria" ON public.financeiro_config_tributaria;
CREATE POLICY "admins gerenciam config tributaria"
  ON public.financeiro_config_tributaria FOR ALL
  USING (public.is_empresa_admin(auth.uid(), empresa_id))
  WITH CHECK (public.is_empresa_admin(auth.uid(), empresa_id));

DROP TRIGGER IF EXISTS trg_fin_config_trib_updated ON public.financeiro_config_tributaria;
CREATE TRIGGER trg_fin_config_trib_updated
  BEFORE UPDATE ON public.financeiro_config_tributaria
  FOR EACH ROW EXECUTE FUNCTION public.fin_updated_at();

-- 2) Apurações mensais
CREATE TABLE IF NOT EXISTS public.financeiro_apuracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  competencia date NOT NULL,
  regime text NOT NULL CHECK (regime IN ('simples','presumido','real')),
  receita_bruta_comercio numeric(14,2) NOT NULL DEFAULT 0,
  receita_bruta_servico numeric(14,2) NOT NULL DEFAULT 0,
  receita_bruta_total numeric(14,2) NOT NULL DEFAULT 0,
  rbt12 numeric(14,2) DEFAULT 0,
  base_irpj numeric(14,2) DEFAULT 0,
  base_csll numeric(14,2) DEFAULT 0,
  base_pis_cofins numeric(14,2) DEFAULT 0,
  valor_simples numeric(14,2) DEFAULT 0,
  aliquota_efetiva_simples numeric(7,4) DEFAULT 0,
  valor_irpj numeric(14,2) DEFAULT 0,
  valor_adicional_irpj numeric(14,2) DEFAULT 0,
  valor_csll numeric(14,2) DEFAULT 0,
  valor_pis numeric(14,2) DEFAULT 0,
  valor_cofins numeric(14,2) DEFAULT 0,
  valor_iss numeric(14,2) DEFAULT 0,
  valor_icms numeric(14,2) DEFAULT 0,
  valor_total numeric(14,2) NOT NULL DEFAULT 0,
  detalhes jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','apurado','pago')),
  pago_em date,
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(empresa_id, competencia, regime)
);

CREATE INDEX IF NOT EXISTS idx_fin_apuracoes_empresa_comp
  ON public.financeiro_apuracoes(empresa_id, competencia DESC);

ALTER TABLE public.financeiro_apuracoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "membros veem apuracoes" ON public.financeiro_apuracoes;
CREATE POLICY "membros veem apuracoes"
  ON public.financeiro_apuracoes FOR SELECT
  USING (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "membros criam apuracoes" ON public.financeiro_apuracoes;
CREATE POLICY "membros criam apuracoes"
  ON public.financeiro_apuracoes FOR INSERT
  WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "membros atualizam apuracoes" ON public.financeiro_apuracoes;
CREATE POLICY "membros atualizam apuracoes"
  ON public.financeiro_apuracoes FOR UPDATE
  USING (public.is_empresa_member(auth.uid(), empresa_id))
  WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "admins removem apuracoes" ON public.financeiro_apuracoes;
CREATE POLICY "admins removem apuracoes"
  ON public.financeiro_apuracoes FOR DELETE
  USING (public.is_empresa_admin(auth.uid(), empresa_id));

DROP TRIGGER IF EXISTS trg_fin_apuracoes_updated ON public.financeiro_apuracoes;
CREATE TRIGGER trg_fin_apuracoes_updated
  BEFORE UPDATE ON public.financeiro_apuracoes
  FOR EACH ROW EXECUTE FUNCTION public.fin_updated_at();

-- 3) RPC de receita por competência
CREATE OR REPLACE FUNCTION public.financeiro_receita_competencia(
  p_empresa_id uuid,
  p_competencia date
)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH faixa AS (
    SELECT date_trunc('month', p_competencia)::date AS ini,
           (date_trunc('month', p_competencia) + interval '1 month - 1 day')::date AS fim
  ),
  rec AS (
    SELECT
      COALESCE(SUM(l.valor) FILTER (WHERE c.tipo_servico = 'comercio'), 0)::numeric AS comercio,
      COALESCE(SUM(l.valor) FILTER (WHERE c.tipo_servico = 'servico'), 0)::numeric AS servico,
      COALESCE(SUM(l.valor), 0)::numeric AS total
    FROM public.financeiro_lancamentos l
    LEFT JOIN public.financeiro_categorias c ON c.id = l.categoria_id
    , faixa f
    WHERE l.empresa_id = p_empresa_id
      AND l.natureza = 'receita'
      AND l.status IN ('realizado','conciliado','previsto')
      AND l.data_competencia BETWEEN f.ini AND f.fim
  ),
  rbt12 AS (
    SELECT COALESCE(SUM(l.valor), 0)::numeric AS total
    FROM public.financeiro_lancamentos l
    WHERE l.empresa_id = p_empresa_id
      AND l.natureza = 'receita'
      AND l.status IN ('realizado','conciliado','previsto')
      AND l.data_competencia >= (date_trunc('month', p_competencia) - interval '12 months')::date
      AND l.data_competencia < date_trunc('month', p_competencia)::date
  )
  SELECT jsonb_build_object(
    'comercio', (SELECT comercio FROM rec),
    'servico', (SELECT servico FROM rec),
    'total', (SELECT total FROM rec),
    'rbt12', (SELECT total FROM rbt12)
  );
$$;
```

---

## [2026-08-08] Remove a tabela `precificacao` (singular) — legado morto

Tabela criada em 2026-02-22 e nunca usada: zero `from('precificacao')` no repo. Sai porque
continua visível no `types.ts` com nome perfeito e colunas atraentes (`custo_unitario`,
`bdi_percentual`, `licitacao_id`) — e o Lovable trabalha a partir do `types.ts`. Mantê-la é
convite para alguém escrever nela e criar um concorrente das tabelas que o épico do motor
tributário vai criar. Ver `docs/epico-motor-precificacao-tributaria.md`, seção 3.2.

**Conferido em produção antes do DROP:** `count(*)` = 0, nenhuma FK apontando para ela
(`pg_constraint.confrelid`), nenhuma view dependente (`pg_depend`/`pg_rewrite`).

Sem `CASCADE` de propósito: se algum objeto tiver surgido depois da conferência, é melhor o
bloco falhar em voz alta do que derrubar o dependente em silêncio.

```sql
-- Remove a tabela `precificacao` (singular) — legado morto desde 2026-02-22.
--
-- Por que sai:
--   Zero `from('precificacao')` no repo inteiro (as ocorrencias do termo em src/
--   sao `value` de TabsTrigger/TabsContent, nao acesso a tabela). Mas ela continua
--   visivel no src/integrations/supabase/types.ts com um nome perfeito e colunas
--   atraentes (custo_unitario, bdi_percentual, preco_unitario, licitacao_id) —
--   e o Lovable trabalha a partir do types.ts. Deixa-la no schema e convite para
--   alguem escrever nela e criar um concorrente de `precificacao_parametros` e
--   `precificacao_memoria_calculo`, que o epico do motor tributario vai criar.
--   Ver docs/epico-motor-precificacao-tributaria.md, secao 3.2.
--
-- Conferido em producao (uwtyuwktxalnpgrcbbgk) antes do DROP:
--   SELECT count(*) FROM public.precificacao;                    -> 0
--   FKs apontando para ela (pg_constraint.confrelid)             -> nenhuma
--   views dependentes (pg_depend/pg_rewrite)                     -> nenhuma
--
-- Sem CASCADE de proposito: se algum objeto tiver surgido depois da conferencia,
-- e melhor este bloco falhar em voz alta do que derrubar o dependente em silencio.
-- O trigger update_precificacao_updated_at cai junto com a tabela.

DROP TABLE IF EXISTS public.precificacao;
```

## [2026-08-08] Metas do Comercial — seed automático em empresa nova

> Fecha uma lacuna da Fase A: o seed daquela migration percorreu as empresas **uma vez**,
> então empresa criada depois nasce sem valores-alvo e sem motivos de perda — o painel fica
> sem referência de ticket e o diálogo de perda abre vazio, impedindo marcar qualquer
> processo como Perdida.
>
> Trigger em vez de chamada na aplicação porque há mais de um caminho que cria empresa
> (cadastro, convite, seed de demo) e todos precisam do mesmo resultado.
>
> Inclui rede de segurança idempotente para as empresas criadas entre a Fase A e agora.

```sql
-- =============================================================================
-- MIGRATION: Metas do Comercial — seed automatico em empresa nova
-- Data: 2026-08-08
-- Objetivo: fechar a lacuna deixada pela Fase A.
--
-- O seed daquela migration percorreu `SELECT id FROM empresas` uma vez, entao
-- so alcancou as empresas existentes naquele momento. Empresa criada depois
-- nasce sem valores-alvo e sem motivos de perda: o painel de metas fica sem
-- referencia de ticket e o dialogo de perda abre vazio, impedindo marcar
-- qualquer processo como Perdida.
--
-- Trigger, e nao chamada na aplicacao, porque ha mais de um caminho que cria
-- empresa (cadastro, convite, seed de demo) e todos precisam do mesmo
-- resultado. Hoje `comercial_seed_padroes` so e chamada pelo botao
-- "Restaurar padroes" da tela de parametrizacao, que depende de alguem
-- perceber o problema e agir.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.comercial_seed_ao_criar_empresa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.comercial_seed_padroes(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS empresas_comercial_seed_padroes ON public.empresas;
CREATE TRIGGER empresas_comercial_seed_padroes
  AFTER INSERT ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.comercial_seed_ao_criar_empresa();

-- Rede de seguranca: reaplica nas empresas criadas entre a Fase A e agora,
-- que ficaram sem parametrizacao. Idempotente — nao sobrescreve o que existe.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT e.id
      FROM public.empresas e
     WHERE NOT EXISTS (
       SELECT 1 FROM public.comercial_motivos_perda m WHERE m.empresa_id = e.id
     )
  LOOP
    PERFORM public.comercial_seed_padroes(r.id);
  END LOOP;
END;
$$;
```

## [2026-08-08] Metas do Comercial — agendamento dos relatórios (Fase E)

> Cria `comercial_notificar_relatorios()` e agenda uma execução diária às 08:00 de Brasília.
> A função decide sozinha se é dia de avisar: **dia 1** (mensal do mês anterior), **dia 15**
> (1ª quinzena) e **último dia do mês** (2ª quinzena).
>
> ⚠️ **O cron não gera o arquivo.** O PDF e a planilha são montados no navegador, porque quem
> calcula a projeção é o motor em TypeScript (`src/lib/metas/projecao.ts`). Reproduzir o motor
> em SQL criaria uma segunda implementação das fórmulas. O que é automático aqui é o
> **disparo**: a notificação chega na data certa com link para a tela, onde a emissão sai em
> um clique e o snapshot é gravado.
>
> Requer a extensão `pg_cron` (já em uso no projeto).

```sql
-- =============================================================================
-- MIGRATION: Metas do Comercial — agendamento dos relatorios (Fase E)
-- Data: 2026-08-08
-- Objetivo: avisar o colaborador nas datas devidas de emissao.
--
-- LIMITE DESTA ENTREGA, declarado de proposito:
--   O relatorio em PDF/planilha e montado no navegador, porque quem calcula a
--   projecao e o motor em TypeScript (src/lib/metas/projecao.ts). Reproduzir
--   esse motor em SQL para gerar o arquivo aqui criaria uma segunda
--   implementacao das formulas — o mesmo problema que a normalizacao de
--   modalidade ja tem, e que so nao mordeu porque ha teste de paridade.
--
--   Entao o cron NAO emite o arquivo: ele cria a notificacao na data certa,
--   com link para a tela onde a emissao acontece em um clique e o snapshot e
--   gravado. "Automatico" aqui e o disparo, nao o arquivo.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.comercial_notificar_relatorios()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hoje        date;
  v_dia         int;
  v_ultimo_dia  int;
  v_referencia  text;
  v_titulo      text;
  v_mensagem    text;
  v_enviadas    int := 0;
BEGIN
  -- O negocio opera em America/Sao_Paulo; o cron roda em UTC.
  v_hoje       := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_dia        := EXTRACT(DAY FROM v_hoje)::int;
  v_ultimo_dia := EXTRACT(DAY FROM (date_trunc('month', v_hoje) + interval '1 month - 1 day'))::int;

  -- Dia 1 tem precedencia: fecha o mes anterior antes de abrir a quinzena.
  IF v_dia = 1 THEN
    v_referencia := 'MES';
    v_titulo     := 'Relatório mensal de metas disponível';
    v_mensagem   := 'O mês anterior fechou. Emita o relatório mensal com o desempenho e o registro dos trabalhos do período.';
  ELSIF v_dia = 15 THEN
    v_referencia := 'Q1';
    v_titulo     := 'Relatório quinzenal de metas disponível';
    v_mensagem   := 'Primeira quinzena encerrada. O relatório traz a projeção do mês e o que falta para bater a meta.';
  ELSIF v_dia = v_ultimo_dia THEN
    v_referencia := 'Q2';
    v_titulo     := 'Relatório quinzenal de metas disponível';
    v_mensagem   := 'Segunda quinzena encerrada. Confira a projeção de fechamento e os riscos apontados.';
  ELSE
    RETURN jsonb_build_object('data', v_hoje, 'referencia', null, 'notificacoes', 0);
  END IF;

  -- Um aviso por membro do comercial (admin incluso: ele tambem tem meta).
  INSERT INTO public.notificacoes (user_id, titulo, mensagem, link, tipo)
  SELECT DISTINCT m.user_id,
         v_titulo,
         v_mensagem,
         '/metas-comercial',
         'info'
    FROM public.empresa_membros m
   WHERE m.equipe = 'comercial' OR m.papel = 'admin';

  GET DIAGNOSTICS v_enviadas = ROW_COUNT;

  RETURN jsonb_build_object(
    'data', v_hoje,
    'referencia', v_referencia,
    'notificacoes', v_enviadas
  );
END;
$$;

COMMENT ON FUNCTION public.comercial_notificar_relatorios() IS
  'Avisa o comercial nas datas de emissao: dia 1 (mensal do mes anterior), '
  'dia 15 (1a quinzena) e ultimo dia (2a quinzena). Nao gera o arquivo — o '
  'PDF/planilha sai da tela, onde o motor de projecao roda.';

-- Uma execucao diaria decide sozinha se e dia de avisar. Agendar tres crons
-- separados exigiria um por mes para o "ultimo dia", que varia.
SELECT cron.unschedule('comercial-notificar-relatorios')
 WHERE EXISTS (
   SELECT 1 FROM cron.job WHERE jobname = 'comercial-notificar-relatorios'
 );

-- 11:00 UTC = 08:00 em America/Sao_Paulo, inicio do expediente
SELECT cron.schedule(
  'comercial-notificar-relatorios',
  '0 11 * * *',
  $$ SELECT public.comercial_notificar_relatorios(); $$
);
```

## [2026-08-08] `licitacoes.empresa_id` — backfill

> **Diagnóstico (08/08/2026):** das 33 licitações do banco, **zero** tinham `empresa_id`.
> O `iniciarProcesso` nunca gravou esse campo, e a coluna é anulável — nada reclamou.
>
> **Consequência:** `vw_comercial_realizado_mensal` filtra `l.empresa_id IS NOT NULL` para
> contar participações, então "processos participados" ficava **sempre 0** no painel de metas,
> a taxa de conversão nunca saía do padrão conservador e as sugestões vinham infladas. Ganhos
> e faturamento não eram afetados (vêm de `contratos` e `contrato_pedidos`).
>
> A correção do código (`iniciarProcesso` passando a gravar `empresa_id`) foi no mesmo commit.
> Só o backfill resolveria o passado e o problema voltaria no próximo processo criado.
>
> **Resolução por ordem de confiança:** empresa ativa do perfil — apenas se o usuário for mesmo
> membro dela — e, na falta, a única empresa do usuário. **Usuário ambíguo fica de fora**: chutar
> contaminaria o realizado de uma empresa com processo de outra. Rode a conferência do fim do
> script; `sem_empresa > 0` significa caso que precisa de decisão humana, não erro.

```sql
-- =============================================================================
-- MIGRATION: licitacoes.empresa_id — backfill
-- Data: 2026-08-08
-- Objetivo: preencher o vinculo com a empresa nas licitacoes existentes.
--
-- Diagnostico que motivou (08/08/2026): das 33 licitacoes do banco, ZERO tinham
-- empresa_id. O `iniciarProcesso` nunca gravou esse campo desde que existe, e a
-- coluna e anulavel, entao nada reclamou.
--
-- Consequencia concreta: vw_comercial_realizado_mensal filtra
-- `l.empresa_id IS NOT NULL` para contar participacoes, entao "processos
-- participados" ficava sempre 0 no painel de metas. A taxa de conversao nunca
-- saia do padrao conservador e as sugestoes do motor vinham infladas.
-- Ganhos e faturamento nao eram afetados: vem de contratos e contrato_pedidos,
-- que tem empresa_id proprio.
--
-- O conserto do lado do codigo (iniciarProcesso passando a gravar empresa_id)
-- vai no mesmo commit — so o backfill resolveria o passado e o problema
-- voltaria no proximo processo criado.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Resolucao da empresa, por ordem de confianca
--
--    a) empresa ativa do perfil, MAS so se o usuario for mesmo membro dela —
--       sem essa checagem, um perfil com empresa_ativa_id defasada levaria a
--       licitacao para uma empresa da qual a pessoa ja saiu;
--    b) a unica empresa do usuario, quando ele so pertence a uma.
--
--    Usuario ambiguo (varias empresas, sem empresa ativa valida) fica de fora:
--    chutar aqui contaminaria o realizado de uma empresa com processo de outra.
-- -----------------------------------------------------------------------------
WITH empresa_unica AS (
  SELECT user_id,
         (min(empresa_id::text))::uuid AS empresa_id
    FROM public.empresa_membros
   GROUP BY user_id
  HAVING count(DISTINCT empresa_id) = 1
),
resolucao AS (
  SELECT l.id,
         COALESCE(
           CASE
             WHEN EXISTS (
               SELECT 1 FROM public.empresa_membros m
                WHERE m.user_id = l.user_id
                  AND m.empresa_id = p.empresa_ativa_id
             ) THEN p.empresa_ativa_id
           END,
           eu.empresa_id
         ) AS empresa_id
    FROM public.licitacoes l
    LEFT JOIN public.profiles      p  ON p.user_id  = l.user_id
    LEFT JOIN empresa_unica        eu ON eu.user_id = l.user_id
   WHERE l.empresa_id IS NULL
)
UPDATE public.licitacoes l
   SET empresa_id = r.empresa_id
  FROM resolucao r
 WHERE l.id = r.id
   AND r.empresa_id IS NOT NULL;

-- Nota sobre os triggers desta tabela, para quem revisar:
--   - comercial_exigir_motivo_perda so levanta excecao quando o status ENTRA em
--     'Perdida'; aqui o status nao muda, entao o backfill nao e barrado;
--   - comercial_marcar_proposta_enviada so preenche data_proposta_enviada
--     quando ela e nula, e a Fase B ja preencheu todas as elegiveis.

-- -----------------------------------------------------------------------------
-- 2. Perdas que o backfill da Fase B pulou
--    Aquele INSERT exigia empresa_id (a coluna e NOT NULL em comercial_perdas),
--    entao as licitacoes orfas ficaram sem registro de motivo. Agora que tem
--    empresa, entram com o mesmo motivo legado e inativo.
-- -----------------------------------------------------------------------------
INSERT INTO public.comercial_perdas (
  empresa_id, licitacao_id, user_id, motivo_id, observacao,
  valor_estimado, modalidade_codigo, data_perda
)
SELECT l.empresa_id,
       l.id,
       l.user_id,
       m.id,
       'Registro criado no backfill de empresa_id. A perda é anterior à regra de motivo obrigatório.',
       l.valor_estimado,
       public.comercial_normalizar_modalidade(l.modalidade),
       COALESCE(l.data_encerramento::date, l.updated_at::date)
  FROM public.licitacoes l
  JOIN public.comercial_motivos_perda m
    ON m.empresa_id = l.empresa_id
   AND m.codigo = 'nao_informado_legado'
 WHERE l.empresa_id IS NOT NULL
   AND (l.status = 'Perdida' OR l.resultado = 'Perdedor')
ON CONFLICT (licitacao_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. Indice para o filtro da view de realizado
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_licitacoes_empresa_user
  ON public.licitacoes (empresa_id, user_id)
  WHERE empresa_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 4. Conferencia — rode DEPOIS e leia o resultado
--    `sem_empresa` maior que zero significa usuario ambiguo, que precisa de
--    decisao humana; nao e erro do script.
-- -----------------------------------------------------------------------------
-- select count(*)                                    as total,
--        count(empresa_id)                           as com_empresa,
--        count(*) - count(empresa_id)                as sem_empresa,
--        (select count(*) from comercial_perdas)     as perdas_registradas
--   from licitacoes;
```

## [2026-08-08] `licitacoes.empresa_id` — NOT NULL

> **Rode DEPOIS do backfill (`20260808000004`).** Se sobrar alguma linha sem empresa, o script
> para com mensagem dizendo quantas e de quais usuários — em vez do erro cru do Postgres.
>
> **Levantamento dos caminhos de inserção**, todos corrigidos no commit que acompanha:
>
> | Caminho | Situação antes |
> | --- | --- |
> | `useLicitacaoIntegration.iniciarProcesso` | não gravava |
> | `useProcessoAtivo.criarProcessoManual` | não gravava — origem dos cards "Processo Manual" |
> | `api-integracao` → `POST /licitacoes` | não gravava; repassava o corpo cru |
>
> O terceiro é o que justifica o `NOT NULL`: é uma **API externa**. Mesmo com todo o front
> correto, um cliente da API voltaria a criar licitação órfã — e ninguém perceberia, porque
> `empresa_id` nulo não quebra nada visível, só faz o processo sumir do realizado das metas.
>
> Na API, a empresa passou a ser resolvida **no servidor** e o `empresa_id` do corpo é
> descartado: aceitar do cliente permitiria gravar na empresa de outro.

```sql
-- =============================================================================
-- MIGRATION: licitacoes.empresa_id — NOT NULL
-- Data: 2026-08-08
-- Objetivo: o banco passa a impedir a reincidencia, em vez de depender de cada
--           caminho de insercao lembrar de preencher.
--
-- PRE-REQUISITO: rodar 20260808000004 (backfill) ANTES. Se sobrar qualquer
-- linha com empresa_id nulo, este script para com mensagem explicando quais,
-- em vez de estourar o erro cru do Postgres.
--
-- Levantamento dos caminhos de insercao (08/08/2026) — todos corrigidos no
-- commit que acompanha esta migration:
--   1. src/hooks/useLicitacaoIntegration.ts  → iniciarProcesso
--   2. src/hooks/useProcessoAtivo.ts         → criarProcessoManual ("Processo Manual")
--   3. supabase/functions/api-integracao     → POST /licitacoes (API publica)
--
-- O terceiro e o que justifica o NOT NULL: e uma API externa. Mesmo com todo o
-- front correto, um cliente da API voltaria a criar licitacao orfa, e ninguem
-- perceberia — empresa_id nulo nao quebra nada visivel, so faz o processo
-- sumir silenciosamente do realizado das metas.
-- =============================================================================

DO $$
DECLARE
  v_orfas int;
  v_users text;
BEGIN
  SELECT count(*) INTO v_orfas FROM public.licitacoes WHERE empresa_id IS NULL;

  IF v_orfas > 0 THEN
    SELECT string_agg(DISTINCT user_id::text, ', ')
      INTO v_users
      FROM public.licitacoes
     WHERE empresa_id IS NULL;

    RAISE EXCEPTION
      'Ainda ha % licitacao(oes) sem empresa_id. Rode a migration 20260808000004 primeiro. '
      'Usuarios envolvidos: %. Se ja rodou, esses usuarios sao ambiguos (pertencem a mais de '
      'uma empresa sem empresa ativa valida) e precisam de atribuicao manual antes deste passo.',
      v_orfas, v_users;
  END IF;
END;
$$;

ALTER TABLE public.licitacoes
  ALTER COLUMN empresa_id SET NOT NULL;

-- A FK ja existia; o indice do backfill cobre o filtro da view de realizado.
COMMENT ON COLUMN public.licitacoes.empresa_id IS
  'Empresa dona do processo. NOT NULL desde 2026-08-08: a coluna anulavel '
  'deixou 33 licitacoes orfas, invisiveis ao realizado do modulo de metas.';
```

## [2026-08-09] Convite por setor reutilizável + login individual

> **Corrige o "Usuário não encontrado" ao entrar com um login como `COMERCIAL-01`.**
>
> O e-mail do setor é ponto de **distribuição** do link: vários colaboradores do mesmo setor
> usam o mesmo convite, cada um criando o próprio acesso. Três defeitos impediam isso:
>
> 1. `accepted_at` era marcado no primeiro uso e a tela tratava o convite como consumido —
>    contradizendo o próprio texto dela ("qualquer colaborador que recebê-lo poderá criar um
>    acesso");
> 2. o formulário vinha com o **e-mail do setor preenchido**; quem não trocasse queimava o
>    endereço compartilhado como conta individual;
> 3. ninguém gravava `profiles.username`, que é o único campo consultado no login por usuário.
>
> **Arquitetura escolhida** (o setor tem um e-mail compartilhado, e o Supabase Auth exige
> e-mail único por conta): a identidade passa a ser o **login**, e o e-mail da conta usa
> **sub-endereçamento** do e-mail do setor — `comercial+comercial-01@gruposantarosa.com.br`.
> É único para o Auth e entregue na caixa compartilhada, o que mantém a recuperação de senha
> funcionando. Confirmado empiricamente no HostGator em 09/08/2026: chegou na caixa de
> entrada, não em subpasta.
>
> Quando o e-mail do setor não serve de base (sem arroba, domínio sem ponto), cai no domínio
> `@praefectus.invalid` — reservado pela RFC 2606 — para o cadastro não travar.
>
> Requer redeploy da edge function `accept-sector-invite`.

```sql
-- =============================================================================
-- MIGRATION: convite por setor reutilizavel + login individual
-- Data: 2026-08-09
-- Objetivo: sustentar o fluxo real do produto — o e-mail do setor e ponto de
--           DISTRIBUICAO do link, e cada colaborador cria o proprio acesso.
--
-- Como estava (e por que nao funcionava):
--   1. `empresa_convites.accepted_at` era marcado no primeiro uso e a tela
--      tratava o convite como consumido. O segundo colaborador do setor via
--      "convite ja utilizado" — contradizendo o proprio texto da tela, que
--      promete "qualquer colaborador que recebe-lo podera criar um acesso".
--   2. O formulario vinha com o e-mail do SETOR preenchido. Quem nao trocasse
--      criava a conta com ele, queimando o endereco compartilhado como conta
--      individual.
--   3. Ninguem gravava `profiles.username` — o unico campo que o login por
--      usuario consulta. Dai o "Usuario nao encontrado" para COMERCIAL-01.
--
-- Decisao de arquitetura (setor tem UM e-mail compartilhado): a identidade
-- passa a ser o LOGIN. O e-mail da conta e sintetico e derivado do login; o
-- e-mail do setor fica como contato. Ver o comentario em profiles.username.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Unicidade do login, agora sem depender de maiusculas
--    A constraint antiga era case-sensitive: COMERCIAL-01 e comercial-01
--    coexistiam, e a RPC de login (que compara com lower()) escolheria uma
--    das duas por LIMIT 1 — deixando alguem de fora sem explicacao.
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_username_unique;
DROP INDEX IF EXISTS public.profiles_username_lower_idx;

CREATE UNIQUE INDEX IF NOT EXISTS ux_profiles_username_lower
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL;

COMMENT ON COLUMN public.profiles.username IS
  'Login individual do colaborador. E a identidade de acesso quando o setor '
  'usa um e-mail compartilhado: o e-mail da conta em auth.users e sintetico '
  '(<login>@praefectus.invalid) e nunca recebe mensagem. Unico sem distinguir '
  'maiusculas.';

-- -----------------------------------------------------------------------------
-- 2. Convite reutilizavel
--    `accepted_at` deixa de ser porteiro e passa a registrar o PRIMEIRO uso.
--    Quem controla o reuso agora e `max_usos` (NULL = ilimitado ate expirar).
-- -----------------------------------------------------------------------------
ALTER TABLE public.empresa_convites
  ADD COLUMN IF NOT EXISTS usos int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_usos int;

ALTER TABLE public.empresa_convites DROP CONSTRAINT IF EXISTS empresa_convites_max_usos_positivo;
ALTER TABLE public.empresa_convites
  ADD CONSTRAINT empresa_convites_max_usos_positivo
  CHECK (max_usos IS NULL OR max_usos > 0);

COMMENT ON COLUMN public.empresa_convites.max_usos IS
  'Quantos acessos o link pode criar. NULL = ilimitado ate expires_at.';
COMMENT ON COLUMN public.empresa_convites.accepted_at IS
  'Primeiro uso do convite. NAO bloqueia reuso — quem limita e max_usos.';

-- Convites ja aceitos passam a contar 1 uso, para o numero nao nascer mentindo
UPDATE public.empresa_convites
   SET usos = 1
 WHERE accepted_at IS NOT NULL
   AND usos = 0;

-- -----------------------------------------------------------------------------
-- 3. Quem usou cada convite
--    `accepted_by_email` guarda um unico valor e era sobrescrito. Com varios
--    colaboradores por link, rastreabilidade exige uma linha por aceite.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.empresa_convite_aceites (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  convite_id   uuid NOT NULL REFERENCES public.empresa_convites(id) ON DELETE CASCADE,
  empresa_id   uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL,
  username     text NOT NULL,
  nome         text,
  aceito_em    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT empresa_convite_aceites_user_unico UNIQUE (convite_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_convite_aceites_convite
  ON public.empresa_convite_aceites (convite_id);

ALTER TABLE public.empresa_convite_aceites ENABLE ROW LEVEL SECURITY;

-- Leitura para membros da empresa; escrita so pela edge function (service_role,
-- que ignora RLS). Sem policy de INSERT de proposito: ninguem cria aceite
-- direto pelo cliente.
DROP POLICY IF EXISTS "convite_aceites_select" ON public.empresa_convite_aceites;
CREATE POLICY "convite_aceites_select" ON public.empresa_convite_aceites FOR SELECT
  USING (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "convite_aceites_delete" ON public.empresa_convite_aceites;
CREATE POLICY "convite_aceites_delete" ON public.empresa_convite_aceites FOR DELETE
  USING (public.is_empresa_admin(auth.uid(), empresa_id));

-- -----------------------------------------------------------------------------
-- 4. Disponibilidade do login, checavel ANTES de existir sessao
--    A tela de aceite roda deslogada, entao precisa ser liberada para `anon`.
--    Devolve so um booleano — nunca expoe de quem e o login ocupado.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.username_disponivel(p_username text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles
     WHERE lower(username) = lower(trim(p_username))
  );
$$;

GRANT EXECUTE ON FUNCTION public.username_disponivel(text) TO anon, authenticated;

COMMENT ON FUNCTION public.username_disponivel(text) IS
  'True se o login esta livre. Liberada para anon porque a checagem acontece '
  'na tela de aceite do convite, antes de haver sessao. Retorna apenas o '
  'booleano, sem revelar a quem pertence um login ocupado.';
```

## [2026-08-09] Corrige o comentário de `profiles.username`

> Ajuste só de documentação — **nenhuma mudança de estrutura ou dado**.
>
> O comentário gravado pela `20260809000001` descreve o e-mail da conta como sempre sintético.
> Ficou desatualizado no mesmo dia: o teste no HostGator confirmou que o sub-endereçamento é
> entregue na caixa do setor, e ele virou o padrão — o domínio reservado passou a ser apenas
> a queda.
>
> Comentário de coluna é documentação que vive no banco: quem ler o schema daqui a seis meses
> lê isto, não o commit. Errado, induz à conclusão de que a recuperação de senha não funciona.

```sql
-- =============================================================================
-- MIGRATION: corrige o comentario de profiles.username
-- Data: 2026-08-09
-- Objetivo: o comentario gravado pela 20260809000001 descreve o e-mail da conta
--           como sempre sintetico. Isso ficou desatualizado no mesmo dia: o
--           teste no HostGator confirmou que o sub-enderecamento e entregue na
--           caixa do setor, e ele virou o padrao — o dominio reservado passou a
--           ser apenas a queda.
--
-- Comentario de coluna e documentacao que vive no banco: quem for ler o schema
-- daqui a seis meses le isto, nao o commit. Errado, induz a conclusao de que
-- recuperacao de senha nao funciona.
--
-- O texto vai em UMA linha de proposito: quebrado em concatenacao de strings,
-- uma colagem parcial no SQL Editor deixa passar so o fim e o comando falha
-- com "syntax error" sem deixar claro que faltou conteudo.
-- =============================================================================

COMMENT ON COLUMN public.profiles.username IS 'Login individual do colaborador e identidade de acesso quando o setor usa um e-mail compartilhado. O e-mail da conta em auth.users e derivado dele por sub-enderecamento (comercial+<login>@dominio), entregue na caixa do setor, e e o que mantem a redefinicao de senha funcionando. Quando o e-mail do setor nao serve de base, cai em <login>@praefectus.invalid, dominio reservado pela RFC 2606, e ai a redefinicao fica indisponivel. Regra em supabase/functions/accept-sector-invite/email-conta.ts. Unico sem distinguir maiusculas.';
```

## [2026-08-09] 🔴 SEGURANÇA — fecha a leitura pública de `empresa_convites`

> **Aplique com prioridade.** Vazamento de token de convite **entre empresas**.
>
> A policy `"convite publico por token"` era `FOR SELECT USING (true)`. A intenção era
> permitir buscar *um* convite pelo token na tela de aceite, que roda deslogada — mas RLS não
> restringe quais linhas o cliente pede: `USING (true)` libera a tabela inteira.
>
> **Verificado em 09/08/2026** com a chave `anon` (a mesma que vai no bundle do site), sem
> nenhuma sessão: `GET /rest/v1/empresa_convites?select=token,email_setor,equipe` devolveu
> convites de **múltiplas empresas**, com os tokens. O token é o único segredo necessário
> para criar um acesso dentro da empresa.
>
> O impacto cresceu com o convite reutilizável da `20260809000001`: antes o token morria no
> primeiro aceite; agora cria acessos até expirar.
>
> **Correção:** a leitura pública sai da tabela e vira `convite_por_token(text)` —
> `SECURITY DEFINER`, exige o token, devolve no máximo uma linha e não ecoa o token.
>
> Depois de aplicar, republique o **front** (a tela de aceite passa a usar a RPC).

```sql
-- =============================================================================
-- MIGRATION: fecha a leitura publica de empresa_convites
-- Data: 2026-08-09
-- SEVERIDADE: alta — vazamento de token de convite entre empresas.
--
-- O que estava aberto:
--   A policy "convite publico por token" era `FOR SELECT USING (true)`. A
--   intencao (pelo proprio comentario original) era permitir buscar UM convite
--   pelo token na tela de aceite, que roda deslogada. Mas RLS nao restringe
--   quais linhas o cliente pede: `USING (true)` libera a tabela inteira.
--
--   Verificado em 09/08/2026 com a chave anon — a mesma que vai no bundle do
--   site — sem nenhuma sessao:
--     GET /rest/v1/empresa_convites?select=token,email_setor,equipe
--   devolveu convites de MULTIPLAS empresas, com os tokens. Token e o unico
--   segredo necessario para criar um acesso dentro da empresa.
--
--   O impacto cresceu com o convite reutilizavel (20260809000001): antes o
--   token morria no primeiro aceite; agora cria acessos ate expirar.
--
-- A correcao:
--   RLS nao sabe dizer "so devolvo se voce informou o token certo" — a
--   condicao vale por linha, nao sobre o filtro que o cliente mandou. Entao a
--   leitura publica sai da tabela e vira uma funcao SECURITY DEFINER que
--   RECEBE o token e devolve no maximo uma linha, sem o proprio token e sem
--   campos que nao interessam a tela de aceite.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Fecha a porta
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "convite publico por token" ON public.empresa_convites;

-- O admin da empresa segue com acesso total pela policy "admin pode gerenciar
-- convites", que ja existe e continua valendo.

-- -----------------------------------------------------------------------------
-- 2. Leitura por token, e so por token
--    Nao devolve `token`: quem chama ja o tem, e ecoa-lo so criaria mais uma
--    forma de vazar. Tambem nao devolve empresa_id sozinho sem contexto util.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.convite_por_token(p_token text)
RETURNS TABLE (
  id           uuid,
  empresa_id   uuid,
  equipe       text,
  papel        text,
  email_setor  text,
  expires_at   timestamptz,
  usos         int,
  max_usos     int,
  empresa_nome text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id,
         c.empresa_id,
         c.equipe,
         c.papel,
         c.email_setor,
         c.expires_at,
         c.usos,
         c.max_usos,
         COALESCE(e.nome_fantasia, e.razao_social, 'sua empresa') AS empresa_nome
    FROM public.empresa_convites c
    LEFT JOIN public.empresas e ON e.id = c.empresa_id
   WHERE c.token = p_token
   LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.convite_por_token(text) TO anon, authenticated;

COMMENT ON FUNCTION public.convite_por_token(text) IS
  'Dados do convite para a tela de aceite, que roda deslogada. Substitui a '
  'policy SELECT USING(true), que expunha a tabela inteira — incluindo tokens '
  'de outras empresas — a qualquer portador da chave anon. Exige o token e '
  'devolve no maximo uma linha, sem ecoar o proprio token.';
```

---

## [2026-08-13] Agenda o arquivamento de processos licitatórios

A edge function `licitacoes-cleanup` existe desde fevereiro e nunca teve
agendamento — nenhum dos 12 jobs em `cron.job` aponta para ela. A retenção de
120 dias declarada no `COMMENT` da coluna `licitacoes.arquivado_em` nunca rodou.

A URL vem do vault: quatro migrations antigas fixaram o host de um projeto que
não é mais o atual (`sbnlovigyifvrkgsoalj` vs. `uwtyuwktxalnpgrcbbgk`).

```sql
-- =============================================================================
-- Onda 1 — Agendar o arquivamento/expurgo de processos licitatórios
--
-- A edge function `licitacoes-cleanup` existe desde 20260223030808 e nunca teve
-- agendamento: nenhum dos 12 jobs em cron.job aponta para ela. A política de
-- retenção declarada no próprio COMMENT da coluna `licitacoes.arquivado_em`
-- ("Após 120 dias, será excluído automaticamente") nunca executou.
--
-- A URL vem do vault em vez de literal. Quatro migrations antigas fixaram
-- 'https://sbnlovigyifvrkgsoalj.supabase.co', que não é o projeto atual
-- (uwtyuwktxalnpgrcbbgk, conforme supabase/config.toml e .env) — aqueles jobs
-- provavelmente estão batendo em host errado desde a migração de projeto.
-- Aceita as duas grafias de chave em uso no vault ('SUPABASE_URL' e
-- 'supabase_url').
-- =============================================================================

-- Idempotência: derruba o agendamento anterior antes de recriar.
SELECT cron.unschedule('licitacoes-cleanup-diario')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'licitacoes-cleanup-diario');

SELECT cron.schedule(
  'licitacoes-cleanup-diario',
  '20 6 * * *', -- 06:20 UTC = 03:20 BRT, fora do horário de operação
  $$
  SELECT net.http_post(
    url := COALESCE(
             (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1),
             (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1),
             -- Último recurso: o vault do projeto de produção não tem essas
             -- chaves (verificado em 2026-08-13), e sem fallback a URL vira
             -- NULL — o job seria criado e falharia toda madrugada em silêncio.
             -- O literal aqui é o projeto ao qual o app está preso em quatro
             -- lugares (client.ts:5, vite.config.ts:12, .env, config.toml).
             'https://uwtyuwktxalnpgrcbbgk.supabase.co'
           ) || '/functions/v1/licitacoes-cleanup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Índice que o novo cleanup usa: ele passou a filtrar por `updated_at` para
-- respeitar a carência de 30 dias entre o desfecho e o arquivamento.
CREATE INDEX IF NOT EXISTS idx_licitacoes_pendente_arquivamento
  ON public.licitacoes (updated_at)
  WHERE arquivado_em IS NULL;
```

---

## [2026-08-13] Separa os eixos `fase` e `desfecho` de `status`

A coluna `status` respondia a três perguntas ao mesmo tempo (fase do funil,
desfecho e visibilidade), e escrever uma apagava as outras. Caso concreto:
`arquivarProcesso()` gravava `status = 'Arquivada'` sobre `'Homologada'`, e
restaurar devolvia `'Monitorando'` — apagando o desfecho que alimenta os KPIs
"Ganhas" e "Valor Ganho" do painel.

`status` continua sendo a coluna de escrita; `fase` e `desfecho` são derivadas
por trigger. Os triggers de metas (20260803000002) comparam `NEW.status` com
literais exatos, e o Lovable escreve direto no `main` — um modelo que exige do
app lembrar de preencher três colunas voltaria a divergir na primeira tela nova.

```sql
-- =============================================================================
-- Onda 2 — Separar os três eixos que disputavam a coluna `status`
--
-- `status` respondia a três perguntas ao mesmo tempo:
--   1. em que fase do funil o processo está   (muda várias vezes)
--   2. como ele terminou                       (escrito uma vez, nunca muda)
--   3. se ainda ocupa a mesa de trabalho       (arquivado_em)
--
-- Como as três dividiam o mesmo campo, escrever uma apagava as outras. O caso
-- concreto: `arquivarProcesso()` gravava status='Arquivada' sobre 'Homologada',
-- e restaurar devolvia 'Monitorando' — apagando o fato de a empresa ter ganhado
-- a licitação, que alimenta os KPIs "Ganhas" e "Valor Ganho" do painel.
--
-- DECISÃO DE DESENHO: `status` continua sendo a coluna de escrita. `fase` e
-- `desfecho` são DERIVADAS por trigger, nunca escritas pelo app.
-- Motivo: os triggers `comercial_marcar_proposta_enviada` e
-- `comercial_exigir_motivo_perda` (migration 20260803000002) comparam
-- `NEW.status` com literais exatos, e o Lovable escreve direto no `main` sem
-- passar por revisão. Um modelo em que o app precisa lembrar de preencher três
-- colunas volta a divergir na primeira tela nova. Derivar no banco não tem essa
-- exposição.
-- =============================================================================

ALTER TABLE public.licitacoes
  ADD COLUMN IF NOT EXISTS fase text,
  ADD COLUMN IF NOT EXISTS desfecho text;

COMMENT ON COLUMN public.licitacoes.fase IS
  'DERIVADA de status. Posição no funil operacional: Monitorando, Em Análise, '
  'Proposta Enviada, Em Disputa, Encerrada. Não escrever pelo app.';

COMMENT ON COLUMN public.licitacoes.desfecho IS
  'DERIVADA de status + resultado. Como o processo terminou: Ganho, Perdido, '
  'Deserto, Fracassado, Revogado, Anulado, Desclassificada. NULL enquanto '
  'estiver em andamento. Não escrever pelo app.';

-- -----------------------------------------------------------------------------
-- Derivação — ESPELHO de src/lib/licitacao/status.ts (normalizarStatus).
-- As duas versões precisam mudar juntas.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.licitacoes_derivar_eixos()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_status text := lower(coalesce(NEW.status, ''));
  v_result text := lower(coalesce(NEW.resultado, ''));
BEGIN
  -- ---- Desfecho ----------------------------------------------------------
  -- Vem primeiro porque, uma vez definido, ele congela a fase em 'Encerrada'.
  IF v_result IN ('deserto', 'fracassado', 'revogado', 'anulado', 'desclassificada') THEN
    NEW.desfecho := initcap(v_result);
  ELSIF v_status LIKE '%homolog%' OR v_status LIKE '%vencid%'
        OR v_status LIKE '%adjudic%' OR v_result = 'vencedor' THEN
    NEW.desfecho := 'Ganho';
  ELSIF v_status LIKE '%perdid%' OR v_result = 'perdedor' THEN
    NEW.desfecho := 'Perdido';
  ELSIF TG_OP = 'UPDATE' THEN
    -- Desfecho não se apaga: um processo que já terminou e voltou ao Kanban
    -- por engano continua tendo terminado. Mesma lógica de
    -- `comercial_marcar_proposta_enviada`, que também é irreversível.
    -- (OLD só existe em UPDATE — referenciá-lo em INSERT levanta
    -- 'record "old" is not assigned yet'.)
    NEW.desfecho := OLD.desfecho;
  ELSE
    NEW.desfecho := NULL;
  END IF;

  -- ---- Fase --------------------------------------------------------------
  IF NEW.desfecho IS NOT NULL THEN
    NEW.fase := 'Encerrada';
  ELSIF v_status LIKE '%disputa%' THEN
    NEW.fase := 'Em Disputa';
  ELSIF v_status LIKE '%proposta%' OR v_status = 'enviada' THEN
    NEW.fase := 'Proposta Enviada';
  ELSIF v_status LIKE '%anális%' OR v_status LIKE '%analis%' THEN
    NEW.fase := 'Em Análise';
  ELSE
    -- 'Publicado', 'novo', 'monitorando' e qualquer desconhecido entram pelo
    -- topo do funil: é o único destino que não afirma nada de errado.
    NEW.fase := 'Monitorando';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS licitacoes_derivar_eixos ON public.licitacoes;
CREATE TRIGGER licitacoes_derivar_eixos
  BEFORE INSERT OR UPDATE ON public.licitacoes
  FOR EACH ROW EXECUTE FUNCTION public.licitacoes_derivar_eixos();

-- -----------------------------------------------------------------------------
-- Backfill — reprocessa todas as linhas existentes pelo trigger.
-- O UPDATE no-op dispara o BEFORE UPDATE e preenche fase/desfecho.
-- -----------------------------------------------------------------------------
UPDATE public.licitacoes SET status = status WHERE fase IS NULL;

-- -----------------------------------------------------------------------------
-- Higiene do legado: linhas cujo `status` é 'Arquivada' perderam o desfecho
-- real na gravação antiga e não há como recuperá-lo do próprio campo. O que dá
-- para recuperar vem de `resultado`, `vencedor` e `data_homologacao`, que o
-- arquivamento nunca tocou. As demais ficam sem desfecho — honesto é registrar
-- que não se sabe, não inventar 'Perdido'.
-- -----------------------------------------------------------------------------
UPDATE public.licitacoes
   SET desfecho = 'Ganho', fase = 'Encerrada'
 WHERE desfecho IS NULL
   AND (vencedor IS TRUE OR data_homologacao IS NOT NULL);

-- Marca o arquivamento das que estavam com status='Arquivada' mas sem a data,
-- para que a Onda 1 (que decide a faixa por `arquivado_em`) não as mostre como
-- ativas no painel.
UPDATE public.licitacoes
   SET arquivado_em = COALESCE(arquivado_em, updated_at, now())
 WHERE lower(coalesce(status, '')) LIKE '%arquiv%'
   AND arquivado_em IS NULL;

CREATE INDEX IF NOT EXISTS idx_licitacoes_fase
  ON public.licitacoes (empresa_id, fase) WHERE arquivado_em IS NULL;

CREATE INDEX IF NOT EXISTS idx_licitacoes_desfecho
  ON public.licitacoes (empresa_id, desfecho) WHERE desfecho IS NOT NULL;
```

---

## [2026-08-13] Trilha de auditoria aceita eventos de sessão

As policies de `atividades_colaborador` exigiam `is_empresa_member(uid, empresa_id)`
no INSERT e no SELECT. Com `empresa_id IS NULL` a linha é recusada — e é
exatamente esse o caso de login e logout, que acontecem fora de qualquer empresa.
Sem isto, a trilha de sessão seria escrita, recusada pelo RLS, e ninguém notaria.

```sql
-- =============================================================================
-- Onda 3 — Permitir eventos de sessão na trilha de auditoria
--
-- As policies originais de `atividades_colaborador` (migration 20260310202304)
-- exigem `is_empresa_member(auth.uid(), empresa_id)` tanto no INSERT quanto no
-- SELECT. Com `empresa_id IS NULL` a função não retorna verdadeiro, então a
-- linha é recusada.
--
-- Isso inviabiliza justamente os eventos que a auditoria mais precisa:
-- login e logout acontecem fora de qualquer empresa — no login a empresa ativa
-- ainda não carregou, e no logout ela já foi descartada. Sem esta migration, a
-- trilha de sessão seria escrita, recusada pelo RLS e ninguém notaria: o mesmo
-- padrão de falha silenciosa que deixou a tabela vazia desde que foi criada.
--
-- O escopo é estreito de propósito: `empresa_id IS NULL` só é aceito para o
-- próprio usuário. Ninguém passa a enxergar atividade de outra pessoa.
-- =============================================================================

DROP POLICY IF EXISTS "Members can view empresa activities" ON public.atividades_colaborador;
CREATE POLICY "Members can view empresa activities"
ON public.atividades_colaborador FOR SELECT TO authenticated
USING (
  public.is_empresa_member(auth.uid(), empresa_id)
  OR (empresa_id IS NULL AND user_id = auth.uid())
);

DROP POLICY IF EXISTS "Users can insert own activities" ON public.atividades_colaborador;
CREATE POLICY "Users can insert own activities"
ON public.atividades_colaborador FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (empresa_id IS NULL OR public.is_empresa_member(auth.uid(), empresa_id))
);

-- A policy de DELETE continua exigindo admin da empresa, o que significa que
-- eventos de sessão (empresa_id nulo) não são apagáveis pela interface. É o
-- comportamento desejado para uma trilha de acesso — a limpeza por retenção
-- continua acontecendo pela rotina de expurgo, que roda com service_role.

-- A aba Histórico do prontuário filtra por metadata->>'licitacao_id'.
-- Sem este índice a consulta faz varredura completa da trilha, que cresce
-- rápido por ser escrita em toda operação de processo.
CREATE INDEX IF NOT EXISTS idx_atividades_licitacao
  ON public.atividades_colaborador ((metadata->>'licitacao_id'))
  WHERE metadata ? 'licitacao_id';

-- Consulta "o que esta pessoa fez nesta sessão", que é a leitura natural de
-- uma auditoria de acesso.
CREATE INDEX IF NOT EXISTS idx_atividades_sessao
  ON public.atividades_colaborador ((metadata->>'sessao_id'))
  WHERE metadata ? 'sessao_id';
```

---

## [2026-08-13] Processo licitatório passa a ser da empresa

As policies de `licitacoes` eram estritamente `auth.uid() = user_id` desde a
criação da tabela. O painel anunciava "Resultados de: <empresa>" e entregava só
os processos do usuário logado — dois colaboradores da mesma empresa viam
painéis diferentes, e um processo iniciado por quem saiu ficava invisível para
todos, inclusive para o admin.

O risco clássico (processos legados sem `empresa_id` sumirem) não existe: a
coluna é NOT NULL desde 2026-08-08, com backfill feito.

```sql
-- =============================================================================
-- Onda 4 — Processo licitatório passa a ser da EMPRESA, não do colaborador
--
-- O painel anuncia "Resultados de: <empresa>" e entrega apenas os processos do
-- usuário logado: as policies de `licitacoes` são estritamente
-- `auth.uid() = user_id` desde a criação da tabela (20260222151544). O efeito é
-- que dois colaboradores da mesma empresa veem painéis diferentes, nenhum vê o
-- do outro, e um processo iniciado por quem saiu da empresa fica invisível para
-- todos — inclusive para o admin. O Kanban, apresentado como quadro de equipe,
-- nunca foi colaborativo.
--
-- O risco clássico desta mudança — processos legados sem `empresa_id` sumirem
-- do painel de todo mundo — não existe aqui: a coluna é NOT NULL desde
-- 2026-08-08 (20260808000005), com backfill feito em 20260808000004.
--
-- Papéis preservados:
--   user_id     — quem criou o processo
--   operador_id — quem responde por ele hoje (passou a ser preenchido na Onda 3)
-- Nenhum dos dois deixa de enxergar o próprio processo, mesmo que saia da
-- empresa: as cláusulas por usuário continuam no OR.
-- =============================================================================

-- ---- SELECT -----------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own licitacoes" ON public.licitacoes;
DROP POLICY IF EXISTS "Operadores can view assigned licitacoes" ON public.licitacoes;
CREATE POLICY "Membros da empresa veem os processos"
ON public.licitacoes FOR SELECT TO authenticated
USING (
  public.is_empresa_member(auth.uid(), empresa_id)
  OR user_id = auth.uid()
  OR operador_id = auth.uid()
);

-- ---- INSERT -----------------------------------------------------------------
-- Continua exigindo que a pessoa assine o próprio INSERT (`user_id`), e agora
-- também que ela seja membro da empresa que está recebendo o processo — sem
-- isso, seria possível criar processo dentro de empresa alheia.
DROP POLICY IF EXISTS "Users can insert own licitacoes" ON public.licitacoes;
CREATE POLICY "Membros da empresa criam processos"
ON public.licitacoes FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND public.is_empresa_member(auth.uid(), empresa_id)
);

-- ---- UPDATE -----------------------------------------------------------------
-- O WITH CHECK impede mover um processo para outra empresa como forma de
-- exfiltrá-lo: o destino também precisa ser uma empresa da qual se é membro.
DROP POLICY IF EXISTS "Users can update own licitacoes" ON public.licitacoes;
CREATE POLICY "Membros da empresa atualizam os processos"
ON public.licitacoes FOR UPDATE TO authenticated
USING (
  public.is_empresa_member(auth.uid(), empresa_id)
  OR user_id = auth.uid()
  OR operador_id = auth.uid()
)
WITH CHECK (
  public.is_empresa_member(auth.uid(), empresa_id)
  OR user_id = auth.uid()
);

-- ---- DELETE -----------------------------------------------------------------
-- Convenção do repo: delete via `is_empresa_admin`. O criador continua podendo
-- excluir o que criou — tirar isso removeria uma capacidade que ele já tem hoje,
-- e a exclusão agora fica registrada na trilha (Onda 3).
DROP POLICY IF EXISTS "Users can delete own licitacoes" ON public.licitacoes;
CREATE POLICY "Admin da empresa ou autor excluem o processo"
ON public.licitacoes FOR DELETE TO authenticated
USING (
  public.is_empresa_admin(auth.uid(), empresa_id)
  OR user_id = auth.uid()
);

-- ---- Índices ----------------------------------------------------------------
-- As telas passam a filtrar por empresa_id em vez de user_id; o índice antigo
-- (idx_licitacoes_user) deixa de atender a consulta principal do painel.
CREATE INDEX IF NOT EXISTS idx_licitacoes_empresa_recentes
  ON public.licitacoes (empresa_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_licitacoes_operador
  ON public.licitacoes (operador_id) WHERE operador_id IS NOT NULL;

COMMENT ON COLUMN public.licitacoes.operador_id IS
  'Colaborador responsável pelo processo hoje, que pode não ser quem o criou '
  '(user_id). Preenchido desde a Onda 3 em iniciarProcesso(). Usado para '
  'redistribuir carteira e para manter acesso de quem toca o processo.';
```

---

## [2026-08-14] Encerra a restauração de lançamentos (incidente de maio)

Dois jobs da restauração de 2026-05-07 seguiam agendados: o `tick` falhava a cada
2 minutos (a tabela de progresso não existe mais) e o `popular-fila` capturava
todo delete de `financeiro_lancamentos` — misturando deleções legítimas com o
incidente antigo. A fila tinha 124 pendentes: jun=7, jul=34, ago=83, **maio=0**.
Nenhum item é do incidente; nada a restaurar. Remove a infraestrutura órfã.
O `financeiro_audit_log` fica intacto.

```sql
-- =============================================================================
-- Encerra a rotina de restauração de lançamentos financeiros (incidente de maio)
--
-- DIAGNÓSTICO (2026-08-14). Dois jobs da restauração de 2026-05-07 continuavam
-- agendados três meses depois do incidente:
--
--   restaurar-lancamentos-tick   */2 min — FALHAVA em toda execução (~720/dia):
--                                a tabela `restauracao_lancamentos_progresso`,
--                                que o comando consulta na guarda WHERE, não
--                                existe mais no banco.
--   popular-fila-restauracao     */1 min — "sucedia", mas fazia dano silencioso:
--                                capturava TODO delete de financeiro_lancamentos
--                                para a fila de restauração, misturando deleções
--                                LEGÍTIMAS dos usuários com o incidente antigo.
--
-- A fila tinha 124 pendentes e 0 processados. A distribuição temporal dos
-- deletes fechou a questão: jun=7, jul=34, ago=83, MAIO=0. Nenhum item é do
-- incidente — todos são deleções intencionais pós-incidente. NÃO há nada a
-- restaurar; restaurá-los ressuscitaria lançamentos apagados de propósito.
--
-- Esta migration registra o desligamento (feito manualmente em 2026-08-14) e
-- remove a infraestrutura órfã: a fila, e as SEIS gerações de funções que o
-- incidente deixou para trás. O `financeiro_audit_log` fica intacto — ele é a
-- fonte de verdade e permite refazer qualquer análise futura.
-- =============================================================================

-- Idempotente: já desligados manualmente; repetido aqui para registro.
DO $$ BEGIN PERFORM cron.unschedule('restaurar-lancamentos-tick'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('popular-fila-restauracao'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- A fila: só UUIDs de controle, todos referentes a deleções legítimas.
-- O conteúdo real (dados_antes) permanece no financeiro_audit_log.
DROP TABLE IF EXISTS public.restauracao_lancamentos_fila;
DROP TABLE IF EXISTS public.restauracao_lancamentos_progresso;

-- As seis gerações de funções do incidente.
DROP FUNCTION IF EXISTS public.restaurar_lancamentos_tick();
DROP FUNCTION IF EXISTS public.popular_fila_restauracao(int);
DROP FUNCTION IF EXISTS public.restaurar_lancamentos_por_id_v3(int);
DROP FUNCTION IF EXISTS public.restaurar_lancamentos_por_id_v2(int);
DROP FUNCTION IF EXISTS public.restaurar_lancamentos_por_id(integer);
DROP FUNCTION IF EXISTS public.restaurar_lancamentos_audit(integer);
```

---

## [2026-08-14] Fase 3 — checklist de habilitação como entidade

A extração de exigências já existia (IA), mas o resultado era efêmero. A tabela
persiste o checklist por processo: exigência classificada na taxonomia, casada com
o cofre da empresa (`agent_documentos`, já por empresa), validade comparada com a
data da sessão, e aceite humano registrado.

```sql
-- =============================================================================
-- Fase 3 do prontuário integrado — checklist de habilitação como ENTIDADE
--
-- A extração de exigências já existia (verificar-documentos-edital, IA), mas o
-- resultado era efêmero: vivia na resposta HTTP e evaporava. Sem entidade não
-- há casamento auditável, nem estados, nem aceite, nem alerta. Esta tabela é o
-- checklist do processo: cada exigência do edital vira uma linha, classificada
-- na taxonomia (functions/_shared/habilitacao-tipos.ts), casada com o cofre da
-- empresa (agent_documentos, que já é por empresa) e carregando o estado real.
--
-- Estados do casamento (status): a IA sugere; `conferido` marca o aceite
-- humano — habilitação é risco jurídico, IA propõe e gente confirma, com
-- registro na trilha (atividades_colaborador).
--   ok                 documento do cofre casado e válido na data da sessão
--   vence_antes_sessao documento existe mas a validade expira antes do fim
--                      do recebimento de propostas (faltante na prática)
--   faltante           nenhum documento do tipo no cofre
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.processo_habilitacao_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  licitacao_id uuid NOT NULL,
  -- Classificação
  tipo text,                             -- id da taxonomia (null = não classificado)
  grupo text,                            -- juridica|fiscal|economica|tecnica|declaracoes|outro
  exigencia text NOT NULL,               -- texto extraído do edital
  referencia text,                       -- artigo/item do edital (ex.: "9.1.2")
  obrigatorio boolean NOT NULL DEFAULT true,
  observacao text,
  -- Casamento com o cofre
  status text NOT NULL DEFAULT 'faltante'
    CHECK (status IN ('ok', 'vence_antes_sessao', 'faltante')),
  documento_origem text,                 -- 'agent_documentos' | 'documentos'
  documento_id uuid,
  documento_nome text,
  documento_validade date,
  -- Aceite humano (IA propõe, gente confirma)
  conferido boolean NOT NULL DEFAULT false,
  aceito_por uuid,
  aceito_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.processo_habilitacao_checklist IS
  'Checklist de habilitação do processo: exigências extraídas do edital pela '
  'IA, classificadas por tipo e casadas com o cofre da empresa. conferido=true '
  'após aceite humano (registrado na trilha de auditoria).';

-- Sem FK para licitacoes: o expurgo de 120 dias apaga o processo e o checklist
-- deve morrer junto — mas via limpeza explícita, não cascade silencioso que
-- esconderia checklist órfão de bug. Índice cobre a consulta do prontuário.
CREATE INDEX IF NOT EXISTS idx_habilitacao_checklist_licitacao
  ON public.processo_habilitacao_checklist (licitacao_id);

CREATE INDEX IF NOT EXISTS idx_habilitacao_checklist_empresa
  ON public.processo_habilitacao_checklist (empresa_id, status);

ALTER TABLE public.processo_habilitacao_checklist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Membros da empresa veem o checklist" ON public.processo_habilitacao_checklist;
CREATE POLICY "Membros da empresa veem o checklist"
ON public.processo_habilitacao_checklist FOR SELECT TO authenticated
USING (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "Membros da empresa escrevem o checklist" ON public.processo_habilitacao_checklist;
CREATE POLICY "Membros da empresa escrevem o checklist"
ON public.processo_habilitacao_checklist FOR INSERT TO authenticated
WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "Membros da empresa atualizam o checklist" ON public.processo_habilitacao_checklist;
CREATE POLICY "Membros da empresa atualizam o checklist"
ON public.processo_habilitacao_checklist FOR UPDATE TO authenticated
USING (public.is_empresa_member(auth.uid(), empresa_id))
WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "Membros da empresa apagam o checklist" ON public.processo_habilitacao_checklist;
CREATE POLICY "Membros da empresa apagam o checklist"
ON public.processo_habilitacao_checklist FOR DELETE TO authenticated
USING (public.is_empresa_member(auth.uid(), empresa_id));

-- updated_at automático (gatilho já padrão no projeto)
DROP TRIGGER IF EXISTS set_updated_at_habilitacao_checklist ON public.processo_habilitacao_checklist;
CREATE TRIGGER set_updated_at_habilitacao_checklist
  BEFORE UPDATE ON public.processo_habilitacao_checklist
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```
