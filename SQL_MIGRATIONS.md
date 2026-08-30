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

---

## 2026-08-16 — Disputas do Robô de Lances viram entidade

As disputas viviam só na memória da tela: recarregar a página perdia a
configuração inteira (estratégia, itens, valor mínimo). Esta tabela guarda a
disputa vinculada à empresa e ao processo de origem.

```sql
-- =============================================================================
-- Disputas do Robô de Lances como ENTIDADE
--
-- As disputas viviam só na memória da tela (useState): recarregar a página
-- perdia a configuração inteira — estratégia, itens, valor mínimo. Numa véspera
-- de pregão isso é perda de trabalho crítico, e explicava o painel "Disputas
-- adicionadas" sempre vazio ao entrar pelo módulo.
--
-- A disputa é DA EMPRESA e pertence a um PROCESSO: abrir a pasta do processo
-- deve mostrar as disputas dele, sem reseleção (mesmo princípio já aplicado a
-- precificação, proposta e catálogo).
--
-- `itens` fica em jsonb: são os itens em disputa com o piso definido pelo
-- operador (valor mínimo), fotografados no momento da configuração. Não é
-- duplicação de licitacao_itens — é a estratégia daquela sessão, que não pode
-- mudar sozinha se o edital for reextraído no meio do pregão.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.robo_lances_disputas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  licitacao_id uuid,                       -- processo de origem (pasta)
  edital text NOT NULL,
  portal text,
  tipo_disputa text NOT NULL DEFAULT 'item'
    CHECK (tipo_disputa IN ('item', 'lote')),
  -- Estratégia
  valor_referencia numeric NOT NULL DEFAULT 0,
  valor_inicial numeric NOT NULL DEFAULT 0,
  valor_minimo numeric NOT NULL DEFAULT 0,  -- piso: trava financeira do operador
  decremento_min numeric NOT NULL DEFAULT 0,
  decremento_percentual numeric NOT NULL DEFAULT 0,
  intervalo_segundos integer NOT NULL DEFAULT 30,
  max_lances integer NOT NULL DEFAULT 20,
  modo_automatico boolean NOT NULL DEFAULT false,
  horario text,
  -- Andamento
  status text NOT NULL DEFAULT 'aguardando'
    CHECK (status IN ('aguardando', 'ativo', 'vencendo', 'perdendo', 'encerrado')),
  meu_lance numeric NOT NULL DEFAULT 0,
  valor_atual numeric NOT NULL DEFAULT 0,
  itens jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.robo_lances_disputas IS
  'Disputas configuradas no Robô de Lances. Pertencem à empresa e, quando '
  'nascem de uma pasta, ao processo (licitacao_id). itens = estratégia da '
  'sessão (com valor mínimo por item), não espelho de licitacao_itens.';

CREATE INDEX IF NOT EXISTS idx_robo_disputas_licitacao
  ON public.robo_lances_disputas (licitacao_id);

CREATE INDEX IF NOT EXISTS idx_robo_disputas_empresa
  ON public.robo_lances_disputas (empresa_id, status);

ALTER TABLE public.robo_lances_disputas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Membros da empresa veem as disputas" ON public.robo_lances_disputas;
CREATE POLICY "Membros da empresa veem as disputas"
ON public.robo_lances_disputas FOR SELECT TO authenticated
USING (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "Membros da empresa criam disputas" ON public.robo_lances_disputas;
CREATE POLICY "Membros da empresa criam disputas"
ON public.robo_lances_disputas FOR INSERT TO authenticated
WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "Membros da empresa atualizam disputas" ON public.robo_lances_disputas;
CREATE POLICY "Membros da empresa atualizam disputas"
ON public.robo_lances_disputas FOR UPDATE TO authenticated
USING (public.is_empresa_member(auth.uid(), empresa_id))
WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "Admins da empresa apagam disputas" ON public.robo_lances_disputas;
CREATE POLICY "Admins da empresa apagam disputas"
ON public.robo_lances_disputas FOR DELETE TO authenticated
USING (public.is_empresa_admin(auth.uid(), empresa_id));

DROP TRIGGER IF EXISTS set_updated_at_robo_disputas ON public.robo_lances_disputas;
CREATE TRIGGER set_updated_at_robo_disputas
  BEFORE UPDATE ON public.robo_lances_disputas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

---

## 2026-08-17 — Bonificação: tipos por faturamento e por NF-e quitada

A interface passou a oferecer "% sobre Faturamento" e "% sobre NF-e quitada",
mas o CHECK da tabela só aceitava os quatro tipos originais e recusava a
gravação. Este bloco amplia a lista.

```sql
-- =============================================================================
-- Bonificação: dois tipos novos de base de cálculo
--
--   percentual_faturamento  — percentual sobre o valor FATURADO (nota emitida)
--   percentual_nf_quitada   — percentual sobre o valor RECEBIDO (nota quitada)
--
-- A distinção importa em pagamento parcial: faturar R$ 100 e receber R$ 60 dá
-- bases diferentes, e quem configura escolhe qual vale.
--
-- A tabela nasceu com um CHECK fechado nos quatro tipos originais, então a
-- interface oferecia os novos e o banco recusava a gravação
-- ("comissoes_config_tipo_comissao_check"). Aqui a lista é ampliada — o CHECK
-- continua fechado de propósito: tipo inválido tem de ser recusado, e a
-- alternativa (coluna livre) transformaria erro de digitação em cálculo errado.
-- =============================================================================

ALTER TABLE public.comissoes_config
  DROP CONSTRAINT IF EXISTS comissoes_config_tipo_comissao_check;

ALTER TABLE public.comissoes_config
  ADD CONSTRAINT comissoes_config_tipo_comissao_check
  CHECK (tipo_comissao IN (
    'percentual_contrato',
    'percentual_lucro',
    'percentual_faturamento',
    'percentual_nf_quitada',
    'valor_fixo',
    'nota_fiscal'
  ));

COMMENT ON COLUMN public.comissoes_config.tipo_comissao IS
  'Base de cálculo da bonificação. Tipos iniciados por "percentual" usam o '
  'campo percentual sobre a base correspondente; os demais usam valor_fixo. '
  'Espelho no front: src/lib/equipe/bonificacao.ts (autoridade única).';
```

---

## 20260818000001 — Vendedor do contrato só o administrador altera

O campo decide meta e bonificação. A tela já esconde o seletor de quem não é
admin; isto fecha a porta também na API, sem tirar de ninguém o direito de
editar o resto do contrato.

```sql
-- =============================================================================
-- Trocar o vendedor de um contrato é ato de administrador
--
-- `vendedor_user_id` decide de quem é a meta e para quem vai a bonificação.
-- A tela já esconde o seletor de quem não é admin, mas esconder um controle
-- não fecha a porta: a mesma linha continua atualizável pela API com o token
-- de qualquer membro, e a policy de contratos autoriza UPDATE para a empresa
-- inteira (assim tem de ser — financeiro lança consumo, jurídico faz aditivo).
--
-- Então o recorte é por COLUNA, não por linha: todos seguem editando o
-- contrato; só administrador muda de quem ele é.
--
-- auth.uid() nulo = execução server-side (edge function com service_role,
-- job de cron). Esses caminhos não passam por RLS e não são o risco aqui.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.contratos_vendedor_somente_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.vendedor_user_id IS DISTINCT FROM OLD.vendedor_user_id
     AND auth.uid() IS NOT NULL
     AND NOT public.is_empresa_admin(auth.uid(), NEW.empresa_id)
  THEN
    RAISE EXCEPTION
      'Somente o administrador da empresa pode alterar o vendedor responsável pelo contrato.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contratos_vendedor_somente_admin ON public.contratos;

CREATE TRIGGER trg_contratos_vendedor_somente_admin
  BEFORE UPDATE ON public.contratos
  FOR EACH ROW
  EXECUTE FUNCTION public.contratos_vendedor_somente_admin();

COMMENT ON COLUMN public.contratos.vendedor_user_id IS
  'Colaborador responsável pelo contrato: define a carteira que ele vê, a meta '
  'em que o contrato conta e quem recebe a bonificação. Só administrador altera '
  '(trigger trg_contratos_vendedor_somente_admin).';
```

---

## 20260818000002 — Meta medida sobre NF-e quitada

Terceira base de meta, entre faturamento e contratos ganhos. O realizado já
existia na view (`valor_quitado`); só o CHECK precisava aceitar o valor.

```sql
-- =============================================================================
-- Meta medida sobre NF-e quitada
--
-- O ciclo comercial tem três marcos de dinheiro, e eles não coincidem:
--   contrato assinado  → compromisso
--   pedido faturado    → nota emitida
--   NF-e quitada       → dinheiro em caixa
--
-- As metas só ofereciam os dois primeiros. Faltava justamente o que o
-- financeiro persegue — e a bonificação já sabia distinguir os três desde
-- 20260817000001, então meta e bonificação falavam vocabulários diferentes.
--
-- O realizado não precisa de coluna nova: vw_comercial_realizado_mensal já
-- expõe `valor_quitado` (contrato_pedidos.nf_quitada = true, agrupado por
-- data_quitacao). O que faltava era o CHECK aceitar a terceira opção.
--
-- O CHECK continua fechado de propósito: base inválida tem de ser recusada na
-- gravação, não virar comparação silenciosa contra a base errada.
-- =============================================================================

ALTER TABLE public.comercial_metas
  DROP CONSTRAINT IF EXISTS comercial_metas_base_meta_check;

ALTER TABLE public.comercial_metas
  ADD CONSTRAINT comercial_metas_base_meta_check
  CHECK (base_meta IN ('faturamento', 'nf_quitada', 'contratos_ganhos'));

COMMENT ON COLUMN public.comercial_metas.base_meta IS
  'Marco do ciclo comercial contra o qual a meta é comparada: contratos_ganhos '
  '(valor assinado), faturamento (nota emitida) ou nf_quitada (valor recebido). '
  'Espelho no front: BASES_META em src/lib/metas/painel.ts.';
```

---

## 20260818000003 — Quando a bonificação pode ser paga (política de cada empresa)

Cada empresa remunera de um jeito: ao ganhar o contrato, ao faturar ou só
depois que o cliente quita a nota. A exigência é lida de
`comissoes_config.evento_pagamento`, por colaborador — o produto não escolhe.

Sem configuração, nada é exigido. Idempotente: se a versão anterior desta
migration já foi colada, colar esta de novo substitui a função.

```sql
-- =============================================================================
-- Quando a bonificação pode ser paga — política de CADA empresa
--
-- Cada empresa remunera de um jeito: há quem pague ao ganhar o contrato, quem
-- pague ao faturar e quem só pague depois que o cliente quita a nota. Nenhum
-- desses é "o certo" — é decisão comercial de quem assina o plano.
--
-- A primeira versão desta trava exigia quitação de todos, transformando a
-- política de um cliente em regra do produto. Aqui a exigência passa a ser
-- lida de `comissoes_config.evento_pagamento`, por colaborador.
--
-- O que a trava impede é o descompasso: paga-se antes do marco que a própria
-- empresa declarou. Nota faturada e nunca recebida virando bônus pago é
-- prejuízo silencioso — mas só para quem escolheu pagar no recebimento.
--
-- Sem configuração para o colaborador, não há política declarada e nada é
-- exigido: inventar uma barraria a empresa que ainda não configurou.
--
-- A trava é no TRÂNSITO para 'pago'. Lançar como pendente sempre vale — é a
-- fila do financeiro.
--
-- Idempotente: se a versão anterior desta migration já foi aplicada, colar
-- esta de novo substitui a função e afrouxa a exigência para a política certa.
-- =============================================================================

-- ── 1. A política, por colaborador ───────────────────────────────────────────
ALTER TABLE public.comissoes_config
  ADD COLUMN IF NOT EXISTS evento_pagamento text;

-- Configuração que nasceu antes desta coluna herda o marco que o próprio tipo
-- de cálculo já pressupõe — nada muda de comportamento sem alguém decidir.
UPDATE public.comissoes_config
   SET evento_pagamento = CASE
         WHEN tipo_comissao IN ('percentual_nf_quitada', 'nota_fiscal') THEN 'nf_quitada'
         WHEN tipo_comissao = 'percentual_faturamento'                  THEN 'nota_emitida'
         ELSE 'contrato_assinado'
       END
 WHERE evento_pagamento IS NULL;

ALTER TABLE public.comissoes_config
  ALTER COLUMN evento_pagamento SET DEFAULT 'contrato_assinado';

ALTER TABLE public.comissoes_config
  DROP CONSTRAINT IF EXISTS comissoes_config_evento_pagamento_check;

ALTER TABLE public.comissoes_config
  ADD CONSTRAINT comissoes_config_evento_pagamento_check
  CHECK (evento_pagamento IN ('contrato_assinado', 'nota_emitida', 'nf_quitada'));

COMMENT ON COLUMN public.comissoes_config.evento_pagamento IS
  'Marco a partir do qual a bonificação pode ser paga: contrato_assinado, '
  'nota_emitida ou nf_quitada. Política da empresa, não do produto. Distinto '
  'de tipo_comissao, que define a BASE do cálculo. Espelho no front: '
  'EVENTOS_PAGAMENTO em src/lib/equipe/bonificacao.ts.';

-- ── 2. A trava, obedecendo à política declarada ──────────────────────────────
CREATE OR REPLACE FUNCTION public.bonificacao_paga_so_apos_quitacao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_evento text;
  v_ok     boolean;
BEGIN
  IF NEW.status <> 'pago' OR COALESCE(OLD.status, '') = 'pago' THEN
    RETURN NEW;
  END IF;

  SELECT evento_pagamento INTO v_evento
    FROM public.comissoes_config
   WHERE empresa_id = NEW.empresa_id
     AND user_id = NEW.user_id
     AND ativo IS TRUE
   LIMIT 1;

  -- Empresa sem política declarada não é barrada por uma política inventada.
  IF v_evento IS NULL THEN
    RETURN NEW;
  END IF;

  v_ok := CASE v_evento
    WHEN 'nf_quitada' THEN EXISTS (
      SELECT 1 FROM public.contrato_pedidos cp
       WHERE cp.id = NEW.contrato_pedido_id
         AND cp.nf_quitada IS TRUE
    )
    WHEN 'nota_emitida' THEN EXISTS (
      SELECT 1 FROM public.contrato_pedidos cp
       WHERE cp.id = NEW.contrato_pedido_id
         AND cp.nota_fiscal IS NOT NULL
    )
    WHEN 'contrato_assinado' THEN EXISTS (
      -- O vínculo pode vir direto do contrato ou pelo pedido que o consome.
      SELECT 1 FROM public.contratos c
       WHERE c.data_assinatura IS NOT NULL
         AND (
           c.id = NEW.contrato_id
           OR c.id = (SELECT cp.contrato_id FROM public.contrato_pedidos cp
                       WHERE cp.id = NEW.contrato_pedido_id)
         )
    )
    ELSE true
  END;

  IF NOT v_ok THEN
    RAISE EXCEPTION
      'Bonificação só pode ser paga a partir do marco configurado para este colaborador (%). Vincule o lançamento ao contrato ou pedido correspondente.',
      v_evento
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bonificacao_paga_so_apos_quitacao ON public.comissoes_lancamentos;

CREATE TRIGGER trg_bonificacao_paga_so_apos_quitacao
  BEFORE UPDATE ON public.comissoes_lancamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.bonificacao_paga_so_apos_quitacao();

COMMENT ON COLUMN public.comissoes_lancamentos.contrato_pedido_id IS
  'Pedido que comprova o marco de pagamento (nota emitida ou NF-e quitada), '
  'conforme comissoes_config.evento_pagamento do colaborador.';
```

---

## 20260818000004 — Excluir contrato: só o responsável ou o administrador

A lista passou a oferecer "Todos da equipe", e a lixeira ficava ativa em
contrato alheio. Policy RESTRICTIVE só para DELETE — soma com E lógico à
permissiva existente, então leitura e edição da equipe seguem intactas.

```sql
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
```

---

## 20260818000005 — Backfill do nome de quem criou a própria empresa

`addEmpresa` inseria o vínculo do criador sem nome nem e-mail, então o dono do
negócio aparecia como "Colaborador". Causa corrigida no front; isto resolve o
passado. Só toca linha sem nenhuma identificação.

```sql
-- =============================================================================
-- Backfill: nome do membro que criou a própria empresa
--
-- `addEmpresa` inseria o vínculo do criador com apenas empresa_id, user_id e
-- papel — sem nome nem e-mail. Só o fluxo de convite os preenchia. Resultado:
-- o dono do negócio aparecia como "Colaborador" em toda tela que lista membros
-- (vendedor do contrato, metas, bonificação), e contrato atribuído a ele ficava
-- sem identificação visível.
--
-- A causa foi corrigida no front no mesmo commit; isto resolve o passado.
--
-- O nome vem de `profiles`, onde já existe. A tela NÃO pode fazer essa leitura:
-- a policy de profiles é `auth.uid() = user_id`, cada um lê só a si mesmo — e
-- afrouxá-la para exibir nomes de colegas seria trocar privacidade por rótulo.
-- Por isso o dado é copiado para empresa_membros, que é onde as telas leem.
--
-- Só toca linha SEM nenhuma identificação (nome, nome_individual e email
-- vazios) e só quando há nome no perfil: não sobrescreve nada preenchido, nem
-- apaga o que existe.
--
-- Rotina de uma vez: não há cron nem repetição. Rodar de novo é inofensivo —
-- as linhas já corrigidas deixam de casar com o WHERE.
-- =============================================================================

-- Prévia (opcional, rode antes para ver o que será alterado):
--   SELECT em.empresa_id, em.user_id, p.nome_completo, p.username
--     FROM public.empresa_membros em
--     JOIN public.profiles p ON p.user_id = em.user_id
--    WHERE COALESCE(NULLIF(em.nome_individual,''), NULLIF(em.nome,''), NULLIF(em.email,'')) IS NULL
--      AND COALESCE(NULLIF(p.nome_completo,''), NULLIF(p.username,'')) IS NOT NULL;

UPDATE public.empresa_membros em
   SET nome = COALESCE(NULLIF(p.nome_completo, ''), NULLIF(p.username, ''))
  FROM public.profiles p
 WHERE p.user_id = em.user_id
   AND COALESCE(NULLIF(em.nome_individual, ''), NULLIF(em.nome, ''), NULLIF(em.email, '')) IS NULL
   AND COALESCE(NULLIF(p.nome_completo, ''), NULLIF(p.username, '')) IS NOT NULL;
```

---

## 20260818000006 — Período de teste explícito na criação da empresa

Toda empresa nova nasce com assinatura `trial` no plano **Básico (7 dias)**;
as seis existentes recebem o mesmo prazo contado de hoje (retroativo venceria
todas de uma vez). Gatilho SECURITY DEFINER porque a policy de `assinaturas`
só deixa o admin do sistema escrever.

```sql
-- =============================================================================
-- Período de teste explícito, com prazo, no lugar de acesso indefinido
--
-- Hoje ninguém assina porque nada pede: quem cria a própria empresa vira admin
-- dela, e o bypass de plano libera qualquer admin. Seis empresas, de maio a
-- julho de 2026, nenhuma com assinatura. Não houve burla — o sistema nunca
-- perguntou.
--
-- Aqui nasce o outro lado: toda empresa nova ganha uma assinatura `trial` com
-- data de fim. O acesso continua liberado no começo, mas passa a ter prazo
-- visível em vez de ser silencioso e eterno.
--
-- Por que TRIGGER e não código de tela: a policy de `assinaturas` só deixa
-- administrador do sistema escrever (e assim deve ser — é a tabela que decide
-- quem paga). A tela do cliente não pode inserir a própria assinatura. O
-- gatilho, SECURITY DEFINER, cobre todo caminho de criação de empresa, hoje e
-- amanhã.
--
-- Qual plano o teste oferece: BÁSICO, por decisão do dono do produto. Os três
-- planos têm teste configurado e Profissional/Enterprise empatam em 14 dias —
-- escolher pelo maior preço seria critério inventado aqui, não política dele.
-- O prazo sai do próprio plano (`trial_dias`), hoje 7 dias.
--
-- Trocar o plano de teste = trocar o slug em `plano_de_teste()`, um lugar só.
-- =============================================================================

-- ── 1. O plano de teste, resolvido em um lugar só ────────────────────────────
CREATE OR REPLACE FUNCTION public.plano_de_teste()
RETURNS TABLE (id uuid, trial_dias int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, COALESCE(p.trial_dias, 0)
    FROM public.planos p
   WHERE COALESCE(p.ativo, true) IS TRUE
     AND COALESCE(p.trial_dias, 0) > 0
   -- 'basico' primeiro; se ele sair do ar ou perder o trial, cai no mais
   -- barato que ainda tenha teste — nunca no mais caro por acidente.
   ORDER BY (p.slug = 'basico') DESC, p.preco_mensal ASC
   LIMIT 1;
$$;

COMMENT ON FUNCTION public.plano_de_teste() IS
  'Plano usado no período de teste: básico, por decisão do dono do produto. '
  'Sem ele, o mais barato ainda com trial_dias > 0. Sem nenhum, não devolve '
  'linha e nenhum teste é criado — melhor não inventar prazo.';

-- ── 2. Empresa nova nasce em teste ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.criar_trial_da_empresa()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plano uuid;
  v_dias  int;
BEGIN
  SELECT t.id, t.trial_dias INTO v_plano, v_dias FROM public.plano_de_teste() t;
  IF v_plano IS NULL THEN
    RETURN NEW;  -- nenhum plano configurado para teste: nada a fazer
  END IF;

  -- Empresa recriada ou importada não ganha teste novo por cima do existente.
  IF EXISTS (SELECT 1 FROM public.assinaturas a WHERE a.empresa_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.assinaturas (empresa_id, plano_id, status, data_inicio, data_fim, observacoes)
  VALUES (NEW.id, v_plano, 'trial', now(), now() + (v_dias || ' days')::interval,
          'Período de teste criado automaticamente na abertura da empresa.');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_criar_trial_da_empresa ON public.empresas;

CREATE TRIGGER trg_criar_trial_da_empresa
  AFTER INSERT ON public.empresas
  FOR EACH ROW
  EXECUTE FUNCTION public.criar_trial_da_empresa();

-- ── 3. As empresas que já existem ────────────────────────────────────────────
--
-- Decisão deliberada: o prazo conta a partir de HOJE, não da data de cadastro.
-- Contar retroativo deixaria as seis já vencidas e cortaria o acesso de todas
-- no mesmo instante — inclusive o do dono do produto. Quem já usa recebe o
-- mesmo prazo de quem chega agora, e a partir daí a régra vale para todos.
INSERT INTO public.assinaturas (empresa_id, plano_id, status, data_inicio, data_fim, observacoes)
SELECT e.id, t.id, 'trial', now(), now() + (t.trial_dias || ' days')::interval,
       'Período de teste concedido na regularização de ' || to_char(now(), 'DD/MM/YYYY') ||
       ' — empresa cadastrada em ' || to_char(e.created_at, 'DD/MM/YYYY') || ' sem assinatura.'
  FROM public.empresas e
 CROSS JOIN public.plano_de_teste() t
 WHERE NOT EXISTS (SELECT 1 FROM public.assinaturas a WHERE a.empresa_id = e.id);

COMMENT ON COLUMN public.assinaturas.status IS
  'pendente | trial | ativa | cancelada | vencida. `trial` e `ativa` com data_fim '
  'no futuro (ou nula) liberam o plano — ver check-subscription.';
```

---

## 20260818000007 — Documentos são da empresa, não de quem subiu

`documentos` tinha RLS `auth.uid() = user_id`: a CND que o dono baixou era
invisível para o financeiro, que é quem precisa dela para acompanhar a NF-e.
Adiciona `empresa_id`, faz backfill pela empresa de quem subiu e abre para
`is_empresa_member`, mantendo fallback por `user_id` no que não deu para
resolver.

```sql
-- =============================================================================
-- Documentos são da EMPRESA, não de quem fez o upload
--
-- `documentos` nasceu sem `empresa_id` e com RLS `auth.uid() = user_id`. Na
-- prática: a CND que o dono baixou da Receita é invisível para o financeiro,
-- que é justamente quem precisa dela para acompanhar a NF-e. O kit de
-- faturamento sairia vazio, e nem daria erro — só não teria nada dentro.
--
-- Mesmo princípio já codificado para licitações (CLAUDE.md, princípio 2):
-- certidão negativa é da pessoa jurídica, não da pessoa física que a emitiu.
--
-- Resolução da empresa no backfill, por ordem de confiança — mesma disciplina
-- de 20260808000004 (backfill de licitacoes):
--   a) empresa ativa do perfil, se o usuário for mesmo membro dela;
--   b) a única empresa do usuário, quando ele só pertence a uma.
-- Usuário ambíguo fica de fora: chutar contaminaria uma empresa com documento
-- de outra, e documento de habilitação errado reprova em licitação.
-- =============================================================================

ALTER TABLE public.documentos
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE;

WITH empresa_unica AS (
  SELECT user_id, (min(empresa_id::text))::uuid AS empresa_id
    FROM public.empresa_membros
   GROUP BY user_id
  HAVING count(DISTINCT empresa_id) = 1
),
resolucao AS (
  SELECT d.id,
         COALESCE(
           CASE
             WHEN EXISTS (
               SELECT 1 FROM public.empresa_membros m
                WHERE m.user_id = d.user_id
                  AND m.empresa_id = p.empresa_ativa_id
             ) THEN p.empresa_ativa_id
           END,
           eu.empresa_id
         ) AS empresa_id
    FROM public.documentos d
    LEFT JOIN public.profiles p      ON p.user_id = d.user_id
    LEFT JOIN empresa_unica  eu      ON eu.user_id = d.user_id
   WHERE d.empresa_id IS NULL
)
UPDATE public.documentos d
   SET empresa_id = r.empresa_id
  FROM resolucao r
 WHERE r.id = d.id
   AND r.empresa_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_documentos_empresa_validade
  ON public.documentos(empresa_id, validade);

-- ── RLS: a empresa inteira lê e mantém ───────────────────────────────────────
--
-- O fallback por `user_id` continua para documento que o backfill não conseguiu
-- resolver — sem ele, quem subiu perderia acesso ao próprio arquivo.
DROP POLICY IF EXISTS "Users can CRUD own documentos" ON public.documentos;
DROP POLICY IF EXISTS "Membros gerenciam documentos da empresa" ON public.documentos;

CREATE POLICY "Membros gerenciam documentos da empresa" ON public.documentos
  FOR ALL TO authenticated
  USING (
    public.is_empresa_member(auth.uid(), empresa_id)
    OR (empresa_id IS NULL AND auth.uid() = user_id)
  )
  WITH CHECK (
    public.is_empresa_member(auth.uid(), empresa_id)
    OR (empresa_id IS NULL AND auth.uid() = user_id)
  );

COMMENT ON COLUMN public.documentos.empresa_id IS
  'Empresa dona do documento. Certidão, contrato social e atestado são da '
  'pessoa jurídica — o financeiro precisa alcançar o que o comercial subiu. '
  'Nulo só em registro antigo que o backfill não conseguiu resolver.';
```

---

## 20260818000008 — Normaliza as unidades já gravadas

UNIDADE/UND/Unidade viravam três conceitos em relatório; caixa/CAIXA, dois.
Vieram da extração de editais, não do cadastro. Só equivalências inequívocas —
'Embalagem 2 L' fica para revisão humana.

```sql
-- =============================================================================
-- Normaliza as unidades já gravadas
--
-- O levantamento mostrou o mesmo conceito escrito de três formas:
--   UNIDADE (23) · UND (15) · Unidade (15)  →  53 registros, contados como três
--   caixa (9) · CAIXA (3)                   →  12 registros, contados como dois
--
-- Não vieram do cadastro de produto: vieram da extração de editais e contratos,
-- que grava o que o órgão escreveu. A normalização na entrada foi para o código
-- no mesmo commit; isto resolve o que já está no banco, para relatório parar de
-- contar o mesmo item duas vezes.
--
-- O que NÃO é tocado, de propósito:
--   • 'Embalagem 2 L' e similares — é descrição de embalagem no campo errado.
--     Converter exigiria adivinhar (embalagem? litro? 2 litros?), e adivinhar
--     aqui apaga a informação que o edital trouxe. Fica para revisão humana.
--   • qualquer código que já esteja canônico.
--
-- Só as equivalências que são inequívocas. Na dúvida, não mexer: unidade errada
-- em item de contrato vira quantidade errada na entrega.
-- =============================================================================

DO $$
DECLARE
  t text;
  -- (grafia gravada, código canônico) — espelho de src/lib/unidades.ts
  mapa text[][] := ARRAY[
    ['UNIDADE', 'UN'], ['UND', 'UN'], ['UNID', 'UN'], ['UNID.', 'UN'], ['U', 'UN'],
    ['CAIXA', 'CX'], ['CX.', 'CX'],
    ['QUILO', 'KG'], ['QUILOS', 'KG'], ['KG.', 'KG'],
    ['LITRO', 'L'], ['LITROS', 'L'],
    ['PACOTE', 'PCT'], ['PACOTES', 'PCT'],
    ['METRO', 'M'], ['METROS', 'M'],
    ['PECA', 'PC'], ['PEÇA', 'PC'],
    ['SACO', 'SC'], ['SACOS', 'SC'],
    ['FRASCO', 'FR'], ['FRC', 'FR'],
    ['LATA', 'LT'],
    ['DUZIA', 'DZ'], ['DÚZIA', 'DZ'],
    ['SERVICO', 'SERV'], ['SERVIÇO', 'SERV'], ['SV', 'SERV'],
    ['HORA', 'HR'], ['HORAS', 'HR']
  ];
  par text[];
  tabelas text[] := ARRAY[
    'produtos', 'contrato_itens', 'licitacao_itens', 'edital_itens_extraidos',
    'catalogo_itens_precificados', 'pedido_itens', 'itens_pedido_compra',
    'nota_fiscal_itens', 'pre_nota_itens', 'quotation_items',
    'shopping_list_items', 'products_normalized', 'agent_itens_edital',
    'agent_historico_precos'
  ];
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    -- Tabela que não existir neste ambiente é ignorada, não derruba a migration.
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;

    FOREACH par SLICE 1 IN ARRAY mapa LOOP
      EXECUTE format(
        'UPDATE public.%I SET unidade = %L
          WHERE upper(btrim(unidade)) = upper(%L) AND unidade <> %L',
        t, par[2], par[1], par[2]);
    END LOOP;
  END LOOP;
END $$;

-- Conferência (rode depois; o esperado é uma linha por código canônico):
--   SELECT unidade, count(*) FROM public.contrato_itens
--    WHERE unidade IS NOT NULL GROUP BY 1 ORDER BY 2 DESC;
```

---

## 20260818000009 — Unidades: comparar sem pontuação nem acento

A migration anterior comparou texto literal e `UND.` escapou por causa do ponto.
Agora o SQL aplica a mesma regra do front (maiúsculas, sem acento, sem
pontuação) em vez de tentar listar cada grafia.

```sql
-- =============================================================================
-- Unidades: comparar ignorando pontuação e acento, como o front já fazia
--
-- A 20260818000008 comparou texto literal e deixou escapar `UND.` — o ponto
-- final bastou para não casar com `UND`. No front isso não acontece: a chave de
-- comparação remove pontuação e acento antes de olhar a tabela.
--
-- Ou seja: a lista em SQL era um espelho escrito à mão da regra em TypeScript, e
-- divergiu na primeira execução. Aqui o SQL passa a aplicar a MESMA regra —
-- maiúsculas, sem acento, sem pontuação — em vez de tentar antecipar cada
-- grafia possível.
--
-- O que continua de fora, e deve mesmo:
--   'Embalagem 2 L' (4) · 'Botijão 13 KG' (1) · 'Caixa 1 L' (1) — descrição de
--   embalagem no campo de unidade. Sem pontuação viram 'EMBALAGEM2L',
--   'BOTIJAO13KG', 'CAIXA1L': não casam com nada, e é o correto. Converter
--   exigiria adivinhar, e adivinhar apaga o que o edital trouxe.
--   'QCG' (1) — código que não reconhecemos. Fica como está.
-- =============================================================================

DO $$
DECLARE
  t text;
  mapa text[][] := ARRAY[
    ['UNIDADE', 'UN'], ['UND', 'UN'], ['UNID', 'UN'], ['U', 'UN'],
    ['CAIXA', 'CX'],
    ['QUILO', 'KG'], ['QUILOS', 'KG'], ['QUILOGRAMA', 'KG'],
    ['LITRO', 'L'], ['LITROS', 'L'],
    ['PACOTE', 'PCT'], ['PACOTES', 'PCT'],
    ['METRO', 'M'], ['METROS', 'M'],
    ['PECA', 'PC'],
    ['SACO', 'SC'], ['SACOS', 'SC'],
    ['FRASCO', 'FR'], ['FRC', 'FR'],
    ['LATA', 'LT'],
    ['DUZIA', 'DZ'],
    ['SERVICO', 'SERV'], ['SV', 'SERV'],
    ['HORA', 'HR'], ['HORAS', 'HR'],
    ['GRAMA', 'G'], ['GRAMAS', 'G'],
    ['TONELADA', 'TON'], ['TONELADAS', 'TON']
  ];
  par text[];
  tabelas text[] := ARRAY[
    'produtos', 'contrato_itens', 'licitacao_itens', 'edital_itens_extraidos',
    'catalogo_itens_precificados', 'pedido_itens', 'itens_pedido_compra',
    'nota_fiscal_itens', 'pre_nota_itens', 'quotation_items',
    'shopping_list_items', 'products_normalized', 'agent_itens_edital',
    'agent_historico_precos'
  ];
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;

    FOREACH par SLICE 1 IN ARRAY mapa LOOP
      -- A chave: sem acento (translate), sem pontuação (regexp), maiúscula.
      -- Mesma regra de `chave()` em src/lib/unidades.ts.
      EXECUTE format(
        'UPDATE public.%I SET unidade = %L
          WHERE regexp_replace(
                  upper(translate(btrim(unidade),
                        ''ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç'',
                        ''AAAAAEEEEIIIIOOOOOUUUUCAAAAAEEEEIIIIOOOOOUUUUC'')),
                  ''[^A-Z0-9]'', '''', ''g'') = %L
            AND unidade <> %L',
        t, par[2], par[1], par[2]);
    END LOOP;
  END LOOP;
END $$;
```

---

## 20260818000010 — Checklist guarda o trecho original do edital

A linha trazia a leitura da IA e o número do item; faltava o texto como o órgão
escreveu. Nulo em registro antigo — o trecho só existe a partir da próxima
geração do checklist.

```sql
-- =============================================================================
-- Checklist de habilitação guarda o TRECHO ORIGINAL do edital
--
-- Hoje a linha traz o nome da exigência (interpretação da IA) e o número do
-- item. Quem confere precisa do texto como o órgão escreveu: "atestado(s) de
-- capacidade técnica, emitido(s) por pessoa jurídica de direito público ou
-- privado, que comprove(m) a execução anterior de objeto similar e compatível"
-- diz o que "Atestado de Capacidade Técnica" não diz — quem pode emitir, o que
-- precisa comprovar, e o que conta como similar.
--
-- Sem o texto à vista, conferir exige abrir o PDF e procurar o item. A
-- interpretação continua ali, agora acompanhada da fonte.
--
-- Nulo em linha antiga: o trecho só existe a partir da próxima geração.
-- =============================================================================

ALTER TABLE public.processo_habilitacao_checklist
  ADD COLUMN IF NOT EXISTS trecho_edital text;

COMMENT ON COLUMN public.processo_habilitacao_checklist.trecho_edital IS
  'Transcrição literal do trecho do edital que cria a exigência, como o órgão '
  'escreveu. Complementa `exigencia` (interpretação) e `referencia` (número do '
  'item). Nulo em registro anterior a 18/08/2026.';
```

---

## 20260819000001 — Forma de execução da ATA (contrato ou empenho, art. 95)

Declara se a ATA será executada por termo de contrato ou por nota de empenho, e
sob qual hipótese do art. 95. É o que permite ao sistema apontar depois a
contradição: entrega declarada como integral que vira parcelada.

Nulo em registro antigo — inferir a hipótese seria adivinhar sobre a
regularidade de um processo alheio.

```sql
-- =============================================================================
-- Como a ATA de Registro de Preços será executada: contrato ou empenho
--
-- A Lei 14.133/2021, art. 95, permite substituir o termo de contrato por nota de
-- empenho — mas só em duas hipóteses: entrega imediata e integral, sem qualquer
-- obrigação futura; ou valor dentro do limite de dispensa por valor.
--
-- Fora disso, execução parcelada ou serviço contínuo EXIGE contrato formal.
-- Usar só o empenho nesses casos é falha grave do processo administrativo — e é
-- exatamente o caso que o sistema não tinha como perceber, porque a forma de
-- execução nunca foi declarada: pedidos simplesmente penduravam na linha de
-- `contratos`, fosse ela ATA ou contrato.
--
-- Declarada a forma, a tela passa a avisar quando o uso contradiz a hipótese:
-- vários pedidos numa ATA declarada como entrega imediata e integral.
--
-- Nulo em registro antigo, de propósito: ninguém declarou nada até aqui, e
-- inferir a hipótese a partir do que já existe seria adivinhar sobre a
-- regularidade de um processo alheio.
-- =============================================================================

ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS forma_execucao text,
  ADD COLUMN IF NOT EXISTS art95_fundamento text;

ALTER TABLE public.contratos
  DROP CONSTRAINT IF EXISTS contratos_forma_execucao_check;

ALTER TABLE public.contratos
  ADD CONSTRAINT contratos_forma_execucao_check
  CHECK (forma_execucao IS NULL OR forma_execucao IN ('contrato_formal', 'empenho'));

ALTER TABLE public.contratos
  DROP CONSTRAINT IF EXISTS contratos_art95_fundamento_check;

ALTER TABLE public.contratos
  ADD CONSTRAINT contratos_art95_fundamento_check
  CHECK (art95_fundamento IS NULL OR art95_fundamento IN ('entrega_imediata', 'valor_dispensa'));

-- Fundamento só faz sentido quando a execução dispensa o contrato. Guardar um
-- sem o outro deixaria o registro afirmando meia coisa.
ALTER TABLE public.contratos
  DROP CONSTRAINT IF EXISTS contratos_art95_coerente;

ALTER TABLE public.contratos
  ADD CONSTRAINT contratos_art95_coerente
  CHECK (art95_fundamento IS NULL OR forma_execucao = 'empenho');

COMMENT ON COLUMN public.contratos.forma_execucao IS
  'Como a ATA será executada: contrato_formal (termo de contrato) ou empenho '
  '(nota de empenho substituindo o contrato, Lei 14.133/2021 art. 95). Nulo em '
  'registro anterior a 19/08/2026, e em contratos — onde o termo é o próprio '
  'instrumento. Espelho no front: FORMAS_EXECUCAO em src/lib/contratos/instrumentos.ts.';

COMMENT ON COLUMN public.contratos.art95_fundamento IS
  'Hipótese que dispensa o contrato: entrega_imediata (entrega integral, sem '
  'obrigação futura) ou valor_dispensa (dentro do limite de dispensa por valor). '
  'Só existe quando forma_execucao = empenho.';
```

---

## 20260819000002 — Reequilíbrio, reajuste e vigência por espécie

Três lacunas do mesmo tema: o que sustenta cada pedido de valor, a ressalva que
preserva o direito ao reequilíbrio, e o prazo que a espécie do objeto comporta.
Tudo nulo em registro antigo.

```sql
-- =============================================================================
-- O que o reequilíbrio exige, o que o reajuste exige, e o prazo que a espécie
-- do objeto comporta
--
-- Três lacunas do mesmo tema, apontadas pelo dono do produto.
--
-- 1. REVISÃO × REAJUSTE. Os dois já ficavam fora do teto do art. 125 — e isso
--    está certo, nenhum acresce objeto. Mas o que sustenta cada um é diferente:
--    reajuste é índice e data-base; revisão exige fato imprevisível POSTERIOR à
--    proposta, ausência de culpa e prova documental. Sem esses campos, o pedido
--    nasce sem o que o sustenta, e a falta só aparece quando o órgão indefere.
--
-- 2. PRECLUSÃO LÓGICA. Assinar prorrogação sem ressalva depois do fato gerador
--    pode ser lido como aceitação dos preços antigos — renúncia ao direito. O
--    sistema tinha as datas e os tipos e não os cruzava. `com_ressalva` é o dado
--    que faltava: sem ele, não há como distinguir a prorrogação que preservou o
--    direito da que o comprometeu.
--
-- 3. VIGÊNCIA POR ESPÉCIE. 120 meses era teto de tudo. Dez anos só cabem em
--    serviço ou fornecimento contínuo (arts. 106 e 107); compra com entrega
--    imediata se esgota no ato, e locação de informática tem 4 anos (art. 109).
--
-- Tudo nulo em registro antigo: são declarações que ninguém fez até aqui, e
-- inferi-las seria o sistema opinar sobre processo que não acompanhou.
-- =============================================================================

-- ── 1 e 2 · o que sustenta o pedido, e a ressalva ────────────────────────────
ALTER TABLE public.contrato_aditivos
  ADD COLUMN IF NOT EXISTS data_fato_gerador date,
  ADD COLUMN IF NOT EXISTS indice_reajuste text,
  ADD COLUMN IF NOT EXISTS data_base_reajuste date,
  ADD COLUMN IF NOT EXISTS com_ressalva boolean;

COMMENT ON COLUMN public.contrato_aditivos.data_fato_gerador IS
  'Quando ocorreu o evento que rompeu a equação econômico-financeira. Só em '
  'revisão/reequilíbrio, e precisa ser POSTERIOR à apresentação da proposta. '
  'É a data que o sistema cruza para avisar sobre preclusão lógica.';

COMMENT ON COLUMN public.contrato_aditivos.indice_reajuste IS
  'Índice contratual aplicado no reajuste (INPC, IPCA, IGP-M…). Só em reajuste '
  'e repactuação — revisão não se calcula por índice.';

COMMENT ON COLUMN public.contrato_aditivos.data_base_reajuste IS
  'Data-base a partir da qual conta a periodicidade do reajuste.';

COMMENT ON COLUMN public.contrato_aditivos.com_ressalva IS
  'Prorrogação assinada COM ressalva quanto aos preços. Assinar sem ressalva '
  'depois do fato gerador pode ser interpretado como renúncia ao reequilíbrio '
  '(preclusão lógica). Nulo = não declarado, e o sistema trata como sem ressalva '
  'ao avisar — o alerta é conservador de propósito.';

-- ── 3 · a espécie do objeto, que define o prazo possível ─────────────────────
ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS especie_objeto text;

ALTER TABLE public.contratos
  DROP CONSTRAINT IF EXISTS contratos_especie_objeto_check;

ALTER TABLE public.contratos
  ADD CONSTRAINT contratos_especie_objeto_check
  CHECK (especie_objeto IS NULL OR especie_objeto IN (
    'compra_entrega_imediata', 'servico_continuo', 'servico_escopo', 'informatica'
  ));

COMMENT ON COLUMN public.contratos.especie_objeto IS
  'Espécie do objeto, que determina o prazo máximo: compra_entrega_imediata '
  '(art. 105), servico_continuo (arts. 106 e 107, até 10 anos), servico_escopo '
  '(art. 111) ou informatica (art. 109, 4 anos). Espelho no front: '
  'ESPECIES_OBJETO em src/lib/contratos/instrumentos.ts.';
```

---

## 20260824000001 — Alerta legal por instrumento: ata não é contrato

**Por quê.** A ATA SRP 022/2024 recebeu "acréscimos acumulados em VALOR
atingiram 120,43% — Limite legal Lei 14.133/21, art. 125: 25%". A conta fecha
(R$ 8.494.080 + R$ 10.229.184 = o valor global de R$ 18.723.264), mas a lei
citada é a de outro instrumento: `recalcular_alertas_aditivos_contrato` lia
`contratos` pelo id e nunca olhava `tipo_documento`.

O art. 125 rege alteração de CONTRATO. Na Ata de Registro de Preços valem o
art. 30 do Decreto 11.462/2023 (é vedado acrescer quantitativo registrado — não
há teto de 25% a estourar) e o art. 32, §4º (o total das adesões não pode
exceder o dobro do registrado).

**O que muda.**
1. `contrato_aditivos.tipo` ganha dois valores — `adesao` e `remanejamento` —
   sem alterar constraint (a coluna nunca teve CHECK). É o dado que faltava:
   sem ele, todo movimento na ata virava "acréscimo".
2. A função ramifica por `tipo_documento`. Contrato segue idêntico ao de antes.
   Ata passa a avisar conforme o Decreto.
3. Reaplica o cálculo **apenas nas atas**, para o aviso antigo sair da tela.

**Nada é reclassificado.** Enquanto ninguém disser o que os aditivos foram, a
ata recebe um aviso que declara a dúvida e pede a classificação, em vez de
afirmar infração sob a lei errada.

**Arquivo:** `supabase/migrations/20260824000001_alerta_legal_por_instrumento.sql`

---

## 20260824000002 — Alertas legais escrevem dinheiro em português

**Por quê.** A mensagem saía `R$ 10229184 de acréscimos (120.43% sobre R$
8494080)`. São oito dígitos sem separador, num aviso que a pessoa lê para
decidir se houve infração — é assim que se confunde dez milhões com um milhão. O
percentual vinha com ponto decimal, que em português é separador de milhar.

A causa era `::TEXT` na concatenação: a representação crua do numeric.

**O que muda.** Entram `formatar_brl(numeric)` e `formatar_numero(numeric, int)`,
e as mensagens passam a chamá-las. Usam vírgula e ponto **literais** no padrão do
`to_char` — e não `G`/`D`, que dependem do `lc_numeric` do servidor.

Ao final, recalcula **todos** os registros: o texto cru afetava contrato e ata
igualmente.

**Arquivo:** `supabase/migrations/20260824000002_alerta_legal_valores_em_reais.sql`

---

## 20260824000003 — contrato_itens ganha produto_id

**Por quê.** O formulário "Cadastrar Item da ATA" oferece "Buscar Produto do
Catálogo" e grava `produto_id` — mas a coluna nunca existiu em
`contrato_itens`. Nenhuma migration a criou: a tela nasceu apostando num schema
que não veio, e TODO cadastro manual de item morria com "Could not find the
'produto_id' column of 'contrato_itens' in the schema cache".

**O que muda.** `produto_id UUID REFERENCES produtos(id) ON DELETE SET NULL`
(apagar o produto não pode apagar o item de um contrato), com índice parcial.
Nulo permitido: item antigo não tem produto e não precisa ter.

Junto, no front: o insert parou de enviar `custo_total`, que é coluna GERADA
(`custo_unitario * quantidade_contratada`) — era o segundo erro à espreita
atrás do primeiro.

**Arquivo:** `supabase/migrations/20260824000003_contrato_itens_produto_id.sql`

---

## 20260824000004 — O preço do item guarda a própria história

**Por quê.** O valor registrado na ATA muda legitimamente — reequilíbrio
econômico-financeiro, reajuste por índice anual — e o sistema aceitava a edição
ESQUECENDO o valor anterior. Impossível responder "de quanto para quanto foi, e
por quê": exatamente o que o relatório de evolução precisa.

**O que muda.** Tabela `contrato_item_precos_historico` alimentada por GATILHO
em toda mudança de `valor_unitario` (qualquer porta deixa rastro), com
`variacao_pct` calculada no ato. `motivo` (reequilibrio | reajuste |
repactuacao | revisao | correcao | outro) nasce nulo — classificar é decisão de
alguém. View `vw_evolucao_precos_itens` (security_invoker) entrega valor
original × atual, aumento absoluto e % acumulado, nº de alterações e motivos.

**Arquivo:** `supabase/migrations/20260824000004_historico_de_precos_do_item.sql`

---

## 20260824000005 — A lixeira passa a ter volta

**Por quê.** O ícone de excluir fazia DELETE com cascata: itens, aditivos,
arquivos e pedidos iam junto, sem restauração. Exclusão por engano era perda
definitiva.

**O que muda.** `contratos.excluido_em`/`excluido_por`: excluir vira marca; o
registro sai das telas e dos cálculos, os filhos ficam intactos, restaurar é
voltar a nulo. As três funções de cascata (consumo da ata, saldo quantitativo e
financeiro do item) passam a ignorar contratos marcados; um gatilho auxiliar
cutuca os itens da ata quando a marca muda, para a fatia ir e voltar na hora.
Exclusão DEFINITIVA continua existindo — como segundo passo, dentro da lixeira.

**Arquivo:** `supabase/migrations/20260824000005_lixeira_de_contratos.sql`

---

## 20260824000006 — Reequilíbrio no derivado não consome a ata

**Por quê.** Reequilíbrio (caso fortuito/força maior, art. 124, II, "d") no
contrato derivado subia o `valor_global` do contrato, e o consumo da ata — soma
dos globais — encolhia o saldo. Errado: a ata registra QUANTIDADES; o
reequilíbrio repara o preço do contrato, não toma quantidade do registrado.
Deixar a álea extraordinária comer o saldo bloquearia contratos futuros por um
dinheiro que não saiu da ata.

**O que muda.** `recalc_consumo_ata_pai` desconta o efeito líquido dos
institutos fora-do-objeto (reequilibrio/revisao/repactuacao/reajuste:
acréscimos − supressões) da fatia de cada derivado. Gatilho novo em
`contrato_aditivos` cutuca a ata quando o aditivo do derivado muda. Reaplica
nas atas existentes ao final.

**Arquivo:** `supabase/migrations/20260824000006_reequilibrio_nao_consome_a_ata.sql`

---

## 20260824000007 — O diário fotografa depois do recálculo

**Por quê.** A auditoria registrava "Total consumido: R$ 0" no instante em que
um derivado de R$ 2,1 mi acabava de entrar. Não era conta errada: era ORDEM —
gatilhos do mesmo evento disparam em ordem alfabética, e `trg_log_...` vem
antes de `trg_recalc_...`, fotografando o valor de antes.

**O que muda.** Renomeia os três gatilhos de log para `trg_zlog_...`: passam a
disparar por último e fotografam o estado que o recálculo deixou.

**Arquivo:** `supabase/migrations/20260824000007_diario_fotografa_depois.sql`

---

## 20260824000008 — O diário da ata escreve dinheiro em português

**Por quê.** "Total consumido: R$ 2123520 (25.00% do valor global)" — sete
dígitos sem separador e percentual com ponto: a mesma doença dos alertas
legais, corrigida na 20260824000002 e esquecida nos diários de recálculo.

**O que muda.** Os corpos de `log_recalc_saldo_ata_item` e
`log_recalc_consumo_ata_pai` passam a usar `formatar_brl`/`formatar_numero`.
Os gatilhos (já `trg_zlog_*`) continuam apontando para elas.

**Arquivo:** `supabase/migrations/20260824000008_diario_escreve_em_reais.sql`

---

## 20260824000009 — O diário identifica o item; não o transcreve

**Por quê.** Cada recálculo de saldo gravava a DESCRIÇÃO INTEIRA do item (700
caracteres de especificação) em `valor_anterior`, repetidos a cada evento —
parede de texto no diálogo, peso morto na tabela.

**O que muda.** `log_recalc_saldo_ata_item` grava os primeiros 140 caracteres
com reticências; a especificação completa mora no item, que o diálogo já
mostra na seção própria. Mantém o `formatar_brl` da 20260824000008.

**Arquivo:** `supabase/migrations/20260824000009_diario_nao_grava_parede_de_texto.sql`

---

## 20260825000001 — O teto do art. 125 mede-se sobre o valor inicial atualizado

**Por quê.** A letra da lei: "até 25% do valor inicial **atualizado**" — o
original corrigido por reequilíbrio/reajuste/revisão/repactuação. O alerta
dividia pelo original CRU: o 2º termo do 068/2025 (R$ 2.557.296,00, que o órgão
calculou como 25,00% exatos do valor reequilibrado de R$ 10.229.184,00) seria
acusado de falsos 40,14% sobre os R$ 6.370.560,00 crus.

**O que muda.** A base vira `valor_global_original + Σ(fora-do-objeto líquido)`;
o texto do alerta cita "valor inicial atualizado"; e os disparos passam de `>=`
para `>` — **no limite exato é lícito** ("até" 25%), acusar 25,00% cravados
chamaria de infração o termo calibrado no máximo legal. Reaplica em todos os
contratos ao final.

**Arquivo:** `supabase/migrations/20260825000001_art125_base_valor_atualizado.sql`

---

## 20260825000002 — O movimento bancário respeita a própria natureza

**Por quê.** Todos os caminhos que gravam lançamento (OFX e manual) usam a
convenção `valor` em módulo + `natureza` (receita/despesa). A fórmula do saldo
somava `movimento_bancario` sem olhar a natureza: um DÉBITO de extrato SOMAVA
no saldo da conta.

**O que muda.** `financeiro_recalcular_saldo_conta` passa a ler a natureza
(`despesa` subtrai) e recalcula todas as contas ao final. Saldos mudam onde há
débitos de extrato — é a correção aparecendo.

**Arquivo:** `supabase/migrations/20260825000002_movimento_bancario_respeita_natureza.sql`

---

## 20260825000003 — Indicadores gerenciais: a ponte Financeiro → comercial

**Por quê.** O sistema já formava preço em cinco camadas, já derivava a RECEITA
dos lançamentos e já classificava cada despesa no plano de contas (`grupo_dre`).
Faltava a travessa: ninguém computava quanto as despesas fixas representam da
receita — e esse percentual era **digitado à mão** na calculadora.

**O que muda.** `financeiro_indicadores_gerenciais(empresa, referencia, meses)`
devolve, por competência e em janela móvel: receita bruta, CMV, despesas
operacionais e financeiras, médias mensais, os percentuais sobre receita e a
**cobertura da classificação** (percentual apurado sobre lançamento sem
categoria é palpite — a função diz quanto está classificado).

Doutrina: o **CMV fica fora** do percentual (já é o custo unitário do item na
cotação; somá-lo cobraria o produto duas vezes) e a régua é **competência**,
igual à apuração tributária.

Tabela `financeiro_indicadores_adotados` congela a versão usada para
precificar, com data, autor e o retrato completo — proposta entregue não se
reescreve com o percentual do mês seguinte.

**Arquivo:** `supabase/migrations/20260825000003_indicadores_gerenciais.sql`


## 20260825000004 — Regime tributário: fonte única

O regime morava em `empresas.regime_tributario` (vocabulário `simples_nacional |
lucro_presumido | lucro_real`) **e** em `financeiro_config_tributaria.regime`
(`simples | presumido | real`). Nada sincronizava os dois, e o segundo tinha
`DEFAULT 'simples'` — empresa cadastrada como Lucro Presumido que nunca abriu a aba
de configuração do Financeiro era apurada como Simples Nacional, por uma tabela que
termina em R$ 4.800.000 de RBT12.

A partir daqui o front lê o regime só do cadastro. Este SQL alinha o dado gravado e
marca como desatualizada toda apuração calculada sob o regime errado.

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Regime tributário: uma fonte só, e as apurações feitas sob a errada marcadas
-- ─────────────────────────────────────────────────────────────────────────────
--
-- O regime morava em dois lugares que não se falavam:
--
--   empresas.regime_tributario            'simples_nacional' | 'lucro_presumido' | 'lucro_real'
--   financeiro_config_tributaria.regime   'simples'          | 'presumido'       | 'real'
--
-- Nada sincronizava — nem poderia, porque as palavras diferem. Pior: a coluna
-- do Financeiro tem DEFAULT 'simples'. Empresa cadastrada como Lucro Presumido
-- que nunca abriu a aba de configuração do Financeiro era apurada como Simples
-- Nacional, por uma tabela (Anexo I) que termina em R$ 4.800.000 de RBT12 —
-- e a tela estendia a sexta faixa em silêncio quando o faturamento passava
-- disso.
--
-- A partir daqui o front lê o regime SÓ de `empresas.regime_tributario`. Esta
-- migration alinha o dado que já está gravado e deixa rastro do que foi
-- apurado sob a premissa errada.

-- ── 1. Alinha a coluna legada ao cadastro ────────────────────────────────────
-- A coluna não é removida: ela ainda é gravada por `salvarConfig` junto das
-- alíquotas, e apagá-la quebraria o upsert. Deixa de DECIDIR, passa a espelhar.
UPDATE public.financeiro_config_tributaria c
   SET regime = CASE e.regime_tributario
                  WHEN 'simples_nacional' THEN 'simples'
                  WHEN 'lucro_presumido'  THEN 'presumido'
                  WHEN 'lucro_real'       THEN 'real'
                  ELSE c.regime
                END
  FROM public.empresas e
 WHERE e.id = c.empresa_id
   AND e.regime_tributario IS NOT NULL
   AND c.regime IS DISTINCT FROM CASE e.regime_tributario
                                   WHEN 'simples_nacional' THEN 'simples'
                                   WHEN 'lucro_presumido'  THEN 'presumido'
                                   WHEN 'lucro_real'       THEN 'real'
                                 END;

COMMENT ON COLUMN public.financeiro_config_tributaria.regime IS
  'ESPELHO de empresas.regime_tributario — não é a fonte. Quem decide o regime '
  'é o cadastro da empresa (Configurações); esta coluna é mantida em sincronia '
  'para não quebrar o upsert das alíquotas. Ver src/lib/tributario/regime.ts.';

-- ── 2. Marca as apurações calculadas sob o regime errado ─────────────────────
-- As colunas de "desatualizada" já existem e já são usadas pela tela. Reusá-las
-- é melhor do que inventar uma sinalização nova: quem abre o histórico já sabe
-- ler esse aviso.
UPDATE public.financeiro_apuracoes a
   SET apuracao_desatualizada = true,
       desatualizada_motivo   = 'Apurada como ' || a.regime || ', mas o regime da empresa é '
                                || CASE e.regime_tributario
                                     WHEN 'simples_nacional' THEN 'simples'
                                     WHEN 'lucro_presumido'  THEN 'presumido'
                                     WHEN 'lucro_real'       THEN 'real'
                                   END
                                || '. Recalcular antes de usar.',
       desatualizada_em       = now()
  FROM public.empresas e
 WHERE e.id = a.empresa_id
   AND e.regime_tributario IS NOT NULL
   AND a.regime IS DISTINCT FROM CASE e.regime_tributario
                                   WHEN 'simples_nacional' THEN 'simples'
                                   WHEN 'lucro_presumido'  THEN 'presumido'
                                   WHEN 'lucro_real'       THEN 'real'
                                 END
   AND COALESCE(a.apuracao_desatualizada, false) = false;

-- ── 3. Conferência ───────────────────────────────────────────────────────────
-- Roda depois e mostra em que pé ficou cada empresa.
--
--   SELECT e.razao_social,
--          e.regime_tributario                    AS cadastro,
--          c.regime                               AS espelho_financeiro,
--          count(a.id) FILTER (WHERE a.apuracao_desatualizada) AS apuracoes_a_recalcular
--     FROM public.empresas e
--     LEFT JOIN public.financeiro_config_tributaria c ON c.empresa_id = e.id
--     LEFT JOIN public.financeiro_apuracoes a         ON a.empresa_id = e.id
--    GROUP BY 1,2,3
--    ORDER BY 1;
```

## 20260825000005 — Alíquotas: as colunas não comportavam os próprios defaults

Nove colunas de `financeiro_config_tributaria` nasceram `numeric(5,4)` (teto 9,9999)
com DEFAULT em ponto percentual — IRPJ 15, adicional 10, ICMS 18. O `CREATE TABLE`
passou porque o Postgres não avalia a expressão de default na criação; o `INSERT` é
que não passa, **nem omitindo as colunas**. A tabela nasceu em abril e ficou com zero
linhas, em todas as empresas.

Sem linha, o hook caía no `DEFAULT_CONFIG` do código, cujo `regime` é `simples` — e foi
esse padrão, não uma escolha de ninguém, que apurou uma empresa de Lucro Presumido pela
tabela do Simples Nacional. Rode **depois** da 20260825000004.

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- financeiro_config_tributaria: as alíquotas não cabiam na própria coluna
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Nove colunas foram criadas como `numeric(5,4)` — precisão 5, escala 4, ou
-- seja, teto de 9,9999. E receberam DEFAULT em ponto percentual: IRPJ 15,
-- adicional 10, ICMS 18. Nenhum desses três cabe.
--
-- O CREATE TABLE passou porque o Postgres não avalia a expressão de DEFAULT na
-- criação. O INSERT é que não passa — e não passa nem quando OMITE as colunas,
-- porque é justamente aí que o default é avaliado. Resultado: a tabela nasceu
-- em abril e nunca recebeu uma linha. Zero, em todas as empresas.
--
-- A consequência não era uma tela de erro; era pior. Sem linha, o hook caía no
-- DEFAULT_CONFIG do código, cujo `regime` é 'simples' — e foi esse padrão de
-- código, e não uma escolha de ninguém, que apurou uma empresa de Lucro
-- Presumido pela tabela do Simples Nacional. Salvar a configuração certa era
-- impossível: o upsert estourava em silêncio no toast e a tela seguia
-- mostrando os mesmos padrões.
--
-- Aqui as nove viram `numeric(7,4)`: até 999,9999, com as quatro casas que a
-- alíquota efetiva exige. E ganham CHECK 0..100, porque alíquota tributária é
-- percentual transcrito de texto legal e essa faixa é real (ver CLAUDE.md — o
-- CHECK vale para estas, não por varredura de nome: `aliquota_st_mva` passa de
-- 100 legitimamente e não está aqui).
--
-- A sequência é DROP DEFAULT → ALTER TYPE → SET DEFAULT de propósito: mudar o
-- tipo com o default pendurado faz o Postgres tentar converter a expressão, e
-- é exatamente a conversão que estoura.

DO $$
DECLARE
  col text;
  padrao text;
  colunas constant text[][] := ARRAY[
    ['aliquota_pis',        '0.65'],
    ['aliquota_cofins',     '3.00'],
    ['aliquota_pis_nc',     '1.65'],
    ['aliquota_cofins_nc',  '7.60'],
    ['aliquota_irpj',      '15.00'],
    ['adicional_irpj',     '10.00'],
    ['aliquota_csll',       '9.00'],
    ['aliquota_iss',        '5.00'],
    ['aliquota_icms',      '18.00']
  ];
  i int;
BEGIN
  FOR i IN 1 .. array_length(colunas, 1) LOOP
    col    := colunas[i][1];
    padrao := colunas[i][2];

    EXECUTE format('ALTER TABLE public.financeiro_config_tributaria ALTER COLUMN %I DROP DEFAULT', col);
    EXECUTE format('ALTER TABLE public.financeiro_config_tributaria ALTER COLUMN %I TYPE numeric(7,4)', col);
    EXECUTE format('ALTER TABLE public.financeiro_config_tributaria ALTER COLUMN %I SET DEFAULT %s', col, padrao);

    EXECUTE format('ALTER TABLE public.financeiro_config_tributaria DROP CONSTRAINT IF EXISTS %I', 'chk_' || col || '_faixa');
    EXECUTE format(
      'ALTER TABLE public.financeiro_config_tributaria ADD CONSTRAINT %I CHECK (%I IS NULL OR (%I >= 0 AND %I <= 100))',
      'chk_' || col || '_faixa', col, col, col);
  END LOOP;
END $$;

COMMENT ON TABLE public.financeiro_config_tributaria IS
  'Alíquotas e presunções da empresa, em ponto percentual (0–100). A coluna '
  '`regime` é ESPELHO de empresas.regime_tributario — quem decide o regime é o '
  'cadastro. Nasceu em 2026-04 com nove colunas numeric(5,4) que não comportavam '
  'os próprios defaults, e por isso ficou vazia até 2026-08.';

-- ── Conferência ──────────────────────────────────────────────────────────────
--   SELECT column_name, numeric_precision, numeric_scale, column_default
--     FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'financeiro_config_tributaria'
--      AND (column_name LIKE 'aliquota%' OR column_name = 'adicional_irpj')
--    ORDER BY column_name;
--
-- Depois disto, salvar a configuração tributária pela tela passa a funcionar —
-- e é o que cria a primeira linha da tabela.
```

## 20260825000006 — O saldo entende as duas formas de transferência

Auditoria do "saldo consolidado" da home do Financeiro. Três defeitos na fórmula de
`financeiro_recalcular_saldo_conta`:

1. **Transferência espelhada se anulava.** O `LancamentoDialog` grava duas linhas (uma por
   conta); a fórmula só conhecia o formato de linha única do `FinTransferencia`. Nas duas
   contas o resultado dava líquido zero.
2. **Linha de outra conta entrava na soma.** A seleção era `conta_id = X OR conta_destino_id
   = X`, mas os ramos de a_receber/a_pagar/movimento_bancario não conferiam qual casou.
3. **Movimento de extrato cancelado contava.** O ramo do extrato não filtrava status, e a
   conciliação grava lançamento `cancelado` ao ignorar um movimento.

Recalcula todas as contas ao final — os saldos mudam onde havia transferência espelhada.

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- O saldo passa a entender as duas formas de transferência — e a parar de
-- somar linha de outra conta
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Três defeitos na mesma fórmula, achados auditando de onde saía o "saldo
-- consolidado em tempo real" da tela inicial do Financeiro.
--
-- ── 1. A TRANSFERÊNCIA ESPELHADA SE ANULAVA ─────────────────────────────────
-- Há dois caminhos para transferir entre contas, e eles gravam formatos
-- diferentes:
--
--   FinTransferencia    UMA linha: conta_id = origem, conta_destino_id = destino,
--                       natureza = 'movimentacao'.
--   LancamentoDialog    DUAS linhas espelhadas, uma por conta:
--                       A: conta_id = origem,  conta_destino_id = destino, natureza = 'despesa'
--                       B: conta_id = destino, conta_destino_id = origem,  natureza = 'receita'
--
-- A fórmula só conhecia o primeiro formato. Aplicada ao segundo, na conta de
-- origem a linha A dava −valor e a linha B dava +valor (pelo ramo do
-- conta_destino_id): líquido ZERO. O mesmo no destino. A transferência
-- simplesmente não existia para o saldo.
--
-- A tela disfarçava chamando `ajustarSaldoConta`, um UPDATE direto no
-- saldo_atual — que sobrevivia até alguém mexer em qualquer lançamento
-- daquela conta. Aí o gatilho recalculava, o ajuste evaporava, e o saldo
-- saltava sem explicação. É desta família o saldo fóssil.
--
-- O formato de duas linhas não é o errado: ele é o que faz a transferência
-- aparecer no extrato das DUAS contas. Quem estava errada era a fórmula, que
-- passa a distinguir os dois pela `natureza` — perna espelhada age só na
-- própria conta_id; linha única sai da origem e entra no destino.
--
-- ── 2. A LINHA DE OUTRA CONTA ENTRAVA NA SOMA ──────────────────────────────
-- A linha era selecionada por `conta_id = X OR conta_destino_id = X`, mas os
-- ramos de a_receber/a_pagar/movimento_bancario não conferiam QUAL das duas
-- casou. Um a_receber com conta_destino_id preenchido somava nas duas contas —
-- o mesmo dinheiro, em dois lugares.
--
-- ── 3. MOVIMENTO BANCÁRIO CANCELADO CONTAVA ────────────────────────────────
-- Os ramos a_receber/a_pagar exigem status realizado/conciliado. O do extrato
-- não exigia nada. E a conciliação grava lançamento com status 'cancelado' ao
-- ignorar um movimento (FinConciliacao). Cancelado entrava no saldo.
--
-- Mantive apenas a exclusão do 'cancelado', que é indiscutível. Movimento de
-- extrato com status 'previsto' é caso a conferir, não a decidir por migration:
-- a consulta ao pé deste arquivo mostra a distribuição.

CREATE OR REPLACE FUNCTION public.financeiro_recalcular_saldo_conta(p_conta_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saldo_inicial numeric(15,2);
  v_movimento numeric(15,2);
BEGIN
  SELECT saldo_inicial INTO v_saldo_inicial FROM public.financeiro_contas WHERE id = p_conta_id;

  SELECT COALESCE(SUM(
    CASE
      -- Perna de transferência espelhada: a natureza diz o lado, e ela só age
      -- na própria conta_id. A outra perna cuida da outra conta.
      WHEN tipo = 'transferencia' AND natureza IN ('despesa','receita') THEN
        CASE WHEN conta_id = p_conta_id
             THEN CASE WHEN natureza = 'despesa' THEN -valor ELSE valor END
             ELSE 0 END

      -- Transferência de linha única: sai da origem, entra no destino.
      WHEN tipo = 'transferencia' AND conta_id = p_conta_id         THEN -valor
      WHEN tipo = 'transferencia' AND conta_destino_id = p_conta_id THEN  valor

      -- Daqui para baixo, só conta o que é DESTA conta. Sem esta linha, um
      -- lançamento cujo conta_destino_id aponte para cá somaria aqui também.
      WHEN conta_id IS DISTINCT FROM p_conta_id THEN 0

      WHEN tipo = 'a_receber' AND status IN ('realizado','conciliado') THEN  valor
      WHEN tipo = 'a_pagar'   AND status IN ('realizado','conciliado') THEN -valor

      -- Valor é gravado em módulo por todos os caminhos; o sinal é a natureza.
      WHEN tipo = 'movimento_bancario' AND status IS DISTINCT FROM 'cancelado' THEN
        CASE WHEN natureza = 'despesa' THEN -valor ELSE valor END

      ELSE 0
    END
  ), 0) INTO v_movimento
  FROM public.financeiro_lancamentos
  WHERE conta_id = p_conta_id OR conta_destino_id = p_conta_id;

  UPDATE public.financeiro_contas
  SET saldo_atual = COALESCE(v_saldo_inicial,0) + COALESCE(v_movimento,0), updated_at = now()
  WHERE id = p_conta_id;
END;
$$;

COMMENT ON FUNCTION public.financeiro_recalcular_saldo_conta(uuid) IS
  'saldo_atual = saldo_inicial + movimentos desta conta. Transferência vem em '
  'dois formatos: perna espelhada (natureza despesa/receita, age só na própria '
  'conta_id) e linha única (natureza movimentacao, sai da origem e entra no '
  'destino). Fora transferência, só conta o que tem conta_id desta conta. '
  'Movimento de extrato cancelado não entra.';

-- Reaplica em todas as contas. Onde houver transferência espelhada o saldo
-- muda: é a correção aparecendo, não defeito novo.
SELECT public.financeiro_recalcular_saldo_conta(id) FROM public.financeiro_contas;

-- ── Conferência ─────────────────────────────────────────────────────────────
--
-- Transferências por formato (2 = espelhada, 1 = linha única):
--   SELECT origem_lote_id, count(*) AS linhas, max(valor) AS valor
--     FROM public.financeiro_lancamentos WHERE tipo = 'transferencia'
--    GROUP BY origem_lote_id ORDER BY linhas DESC;
--
-- Movimento de extrato por status — se aparecer 'previsto' com peso, é decisão
-- de negócio se deve ou não compor o saldo:
--   SELECT status, count(*), SUM(CASE WHEN natureza='despesa' THEN -valor ELSE valor END)
--     FROM public.financeiro_lancamentos WHERE tipo = 'movimento_bancario'
--    GROUP BY status ORDER BY 3 DESC;
--
-- Lançamento não-transferência com conta_destino_id (o esperado é nenhum):
--   SELECT tipo, status, count(*) FROM public.financeiro_lancamentos
--    WHERE tipo <> 'transferencia' AND conta_destino_id IS NOT NULL GROUP BY 1,2;
```

## 20260825000007 — Invariantes do Financeiro

O banco passa a recusar o impossível: transferência sem destino, `conta_destino_id` fora
de transferência, origem igual a destino, realizado sem data de realização, vencimento a
mais de 15 anos da competência, competência fora de 2000–2100.

Todas entram como **NOT VALID** — valem para toda linha nova, não rejeitam o que já está
gravado. Há dado torto na base agora, e barrar a migration por causa dele adiaria a
proteção de tudo o que vier depois. O roteiro para validar o passado está no fim do arquivo.

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Invariantes do Financeiro — o banco passa a recusar o impossível
-- ═══════════════════════════════════════════════════════════════════════════
--
-- A auditoria de 25/08 mostrou que o banco aceitava tudo o que lhe davam:
-- transferência de R$ 300.000 saindo de uma conta com R$ 39,75, conta de
-- aplicação com saldo negativo, coluna numeric(5,4) com DEFAULT 15 que não
-- comportava o próprio padrão, vencimento em 2031, e uma tabela de
-- configuração vazia por quatro meses sem que nada estranhasse.
--
-- Sem invariante, o sistema não distingue erro de digitação de fato — trata os
-- dois com a mesma seriedade, e é por isso que um campo errado contamina sete
-- camadas a jusante. O banco é a última instância que pode dizer "esse estado
-- não existe no mundo".
--
-- ── Por que NOT VALID ───────────────────────────────────────────────────────
-- Todas as restrições entram como NOT VALID: passam a valer para toda linha
-- nova ou alterada, e NÃO rejeitam o que já está gravado. É deliberado. Há
-- dado torto na base agora (os oito pares de PIX com origem errada, entre
-- outros), e barrar a migration por causa dele adiaria a proteção de tudo o
-- que vier depois. Corrigido o passado, cada uma vira VALID com um comando —
-- o roteiro está no fim do arquivo.

-- ── 1. Transferência sem destino não é transferência ────────────────────────
-- Uma transferência é uma relação entre DUAS contas. Sem a segunda, o saldo
-- não tem para onde ir e o dinheiro some da soma da empresa.
ALTER TABLE public.financeiro_lancamentos
  DROP CONSTRAINT IF EXISTS chk_transferencia_tem_destino;
ALTER TABLE public.financeiro_lancamentos
  ADD CONSTRAINT chk_transferencia_tem_destino
  CHECK (tipo <> 'transferencia' OR conta_destino_id IS NOT NULL) NOT VALID;

-- ── 2. conta_destino_id só existe em transferência ──────────────────────────
-- Este é o defeito nº 2 da fórmula do saldo, agora barrado na entrada: um
-- a_receber com conta_destino_id preenchido era somado nas DUAS contas, porque
-- a seleção era (conta_id = X OR conta_destino_id = X). A fórmula foi
-- corrigida; a restrição impede que o caso volte a existir.
ALTER TABLE public.financeiro_lancamentos
  DROP CONSTRAINT IF EXISTS chk_destino_so_em_transferencia;
ALTER TABLE public.financeiro_lancamentos
  ADD CONSTRAINT chk_destino_so_em_transferencia
  CHECK (tipo = 'transferencia' OR conta_destino_id IS NULL) NOT VALID;

-- ── 3. Transferência entre a mesma conta é ruído ────────────────────────────
-- Origem igual a destino não move dinheiro. Aparece quando alguém escolhe a
-- conta errada no segundo campo e não percebe, e depois aparece no extrato
-- como um par que não faz nada.
ALTER TABLE public.financeiro_lancamentos
  DROP CONSTRAINT IF EXISTS chk_transferencia_contas_distintas;
ALTER TABLE public.financeiro_lancamentos
  ADD CONSTRAINT chk_transferencia_contas_distintas
  CHECK (conta_destino_id IS NULL OR conta_id IS DISTINCT FROM conta_destino_id) NOT VALID;

-- ── 4. Lançamento realizado tem data de realização ──────────────────────────
-- "Realizado" e "conciliado" afirmam que o dinheiro se moveu. Sem a data, não
-- há como situar o movimento no tempo — e é a data que decide competência,
-- apuração e indicador.
ALTER TABLE public.financeiro_lancamentos
  DROP CONSTRAINT IF EXISTS chk_realizado_tem_data;
ALTER TABLE public.financeiro_lancamentos
  ADD CONSTRAINT chk_realizado_tem_data
  CHECK (status NOT IN ('realizado','conciliado') OR data_realizado IS NOT NULL) NOT VALID;

-- ── 5. Vencimento plausível ─────────────────────────────────────────────────
-- A ETHOS tem 154 contas a pagar previstas com vencimento até 10/08/2031.
-- Contrato administrativo de dez anos existe (Lei 14.133, art. 108), então a
-- faixa é generosa DE PROPÓSITO: quinze anos à frente da competência e cinco
-- atrás. Não é para julgar prazo de contrato — é para pegar o dedo que
-- escorregou no ano.
ALTER TABLE public.financeiro_lancamentos
  DROP CONSTRAINT IF EXISTS chk_vencimento_plausivel;
ALTER TABLE public.financeiro_lancamentos
  ADD CONSTRAINT chk_vencimento_plausivel
  CHECK (
    data_vencimento IS NULL
    OR data_competencia IS NULL
    OR (data_vencimento >= data_competencia - interval '5 years'
    AND  data_vencimento <= data_competencia + interval '15 years')
  ) NOT VALID;

-- ── 6. Competência dentro do tempo do sistema ───────────────────────────────
-- Ano digitado errado é o erro de teclado mais comum em data. 1900 e 2199 não
-- são competências de ninguém.
ALTER TABLE public.financeiro_lancamentos
  DROP CONSTRAINT IF EXISTS chk_competencia_plausivel;
ALTER TABLE public.financeiro_lancamentos
  ADD CONSTRAINT chk_competencia_plausivel
  CHECK (data_competencia IS NULL
      OR (data_competencia >= DATE '2000-01-01' AND data_competencia <= DATE '2100-01-01')) NOT VALID;

-- ── 7. Saldo de abertura de conta não é nulo por omissão ────────────────────
-- `saldo_inicial` NULL e `saldo_inicial` zero significam coisas diferentes na
-- cabeça de quem cadastra — "ainda não informei" e "abriu zerada" — mas a
-- fórmula do saldo trata as duas como zero, via COALESCE. A coluna passa a ter
-- padrão explícito para que a ausência seja uma escolha registrada.
ALTER TABLE public.financeiro_contas
  ALTER COLUMN saldo_inicial SET DEFAULT 0;

COMMENT ON COLUMN public.financeiro_contas.saldo_inicial IS
  'Saldo da conta na data de abertura no sistema. Zero significa "abriu '
  'zerada", e é o padrão. A fórmula do saldo soma este valor aos movimentos — '
  'saldo de abertura não informado produz conta com saldo negativo sem que '
  'haja erro de lançamento algum.';

COMMENT ON CONSTRAINT chk_destino_so_em_transferencia ON public.financeiro_lancamentos IS
  'conta_destino_id fora de transferência fazia o lançamento somar nas duas '
  'contas, porque financeiro_recalcular_saldo_conta seleciona por '
  '(conta_id = X OR conta_destino_id = X).';

-- ── Roteiro para validar o passado ──────────────────────────────────────────
--
-- Cada consulta abaixo lista o que impede a restrição de virar VALID. Rode,
-- corrija o que aparecer, e então promova a restrição.
--
-- 1. Transferência sem destino:
--    SELECT id, data_competencia, valor, descricao FROM public.financeiro_lancamentos
--     WHERE tipo = 'transferencia' AND conta_destino_id IS NULL;
--
-- 2. Destino fora de transferência:
--    SELECT id, tipo, data_competencia, valor, descricao FROM public.financeiro_lancamentos
--     WHERE tipo <> 'transferencia' AND conta_destino_id IS NOT NULL;
--
-- 3. Origem igual a destino:
--    SELECT id, data_competencia, valor, descricao FROM public.financeiro_lancamentos
--     WHERE conta_id IS NOT DISTINCT FROM conta_destino_id AND conta_destino_id IS NOT NULL;
--
-- 4. Realizado sem data:
--    SELECT id, status, data_competencia, valor, descricao FROM public.financeiro_lancamentos
--     WHERE status IN ('realizado','conciliado') AND data_realizado IS NULL;
--
-- 5/6. Datas implausíveis:
--    SELECT id, data_competencia, data_vencimento, valor, descricao
--      FROM public.financeiro_lancamentos
--     WHERE data_vencimento > data_competencia + interval '15 years'
--        OR data_vencimento < data_competencia - interval '5 years'
--        OR data_competencia NOT BETWEEN DATE '2000-01-01' AND DATE '2100-01-01';
--
-- Depois de zerar cada lista:
--    ALTER TABLE public.financeiro_lancamentos VALIDATE CONSTRAINT chk_transferencia_tem_destino;
--    ALTER TABLE public.financeiro_lancamentos VALIDATE CONSTRAINT chk_destino_so_em_transferencia;
--    ALTER TABLE public.financeiro_lancamentos VALIDATE CONSTRAINT chk_transferencia_contas_distintas;
--    ALTER TABLE public.financeiro_lancamentos VALIDATE CONSTRAINT chk_realizado_tem_data;
--    ALTER TABLE public.financeiro_lancamentos VALIDATE CONSTRAINT chk_vencimento_plausivel;
--    ALTER TABLE public.financeiro_lancamentos VALIDATE CONSTRAINT chk_competencia_plausivel;
```

## 20260825000008 — financeiro_conferencia()

Refaz as derivações e devolve o que não fecha: saldo divergente, conta negativa,
transferência sem par ou acima do saldo, faturamento divergente, regime ausente, data
implausível, lançamento sem categoria. Não corrige nada.

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- financeiro_conferencia() — o módulo passa a poder provar a própria correção
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Nada no Financeiro comparava o que ele afirmava com o que ele mesmo tinha.
-- Nada conferia `saldo_atual` contra `saldo_inicial + movimentos`; nada
-- comparava faturamento declarado com contabilizado; nada notou que uma tabela
-- de configuração estava vazia desde abril. Cada achado da auditoria de 25/08
-- precisou de um humano indo procurar.
--
-- É essa ausência que faz um erro de digitação virar cascata. Sem prova local,
-- o erro não fica contido: vaza para tudo a jusante, porque a jusante não tem
-- como se defender. Um número derivável e conferido isola o estrago; um número
-- guardado e nunca conferido o espalha.
--
-- Esta função refaz as derivações e devolve o que não fecha. Não corrige nada
-- — corrigir dinheiro é decisão de gente. Ela só se recusa a ficar calada.

CREATE OR REPLACE FUNCTION public.financeiro_conferencia(p_empresa_id uuid)
RETURNS TABLE (
  severidade  text,   -- 'critico' | 'atencao' | 'informativo'
  categoria   text,
  descricao   text,
  valor       numeric,
  referencia  text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$

  -- ── 1. O saldo bate com os lançamentos? ───────────────────────────────────
  -- A conferência que provou a correção de 25/08. Enquanto der zero, o saldo é
  -- derivável a qualquer momento; qualquer valor aqui é saldo fóssil voltando.
  WITH mov AS (
    SELECT c.id AS conta_id,
           COALESCE(SUM(
             CASE
               WHEN l.tipo = 'transferencia' AND l.natureza IN ('despesa','receita') THEN
                 CASE WHEN l.conta_id = c.id
                      THEN CASE WHEN l.natureza = 'despesa' THEN -l.valor ELSE l.valor END
                      ELSE 0 END
               WHEN l.tipo = 'transferencia' AND l.conta_id = c.id         THEN -l.valor
               WHEN l.tipo = 'transferencia' AND l.conta_destino_id = c.id THEN  l.valor
               WHEN l.conta_id IS DISTINCT FROM c.id THEN 0
               WHEN l.tipo = 'a_receber' AND l.status IN ('realizado','conciliado') THEN  l.valor
               WHEN l.tipo = 'a_pagar'   AND l.status IN ('realizado','conciliado') THEN -l.valor
               WHEN l.tipo = 'movimento_bancario' AND l.status IS DISTINCT FROM 'cancelado' THEN
                 CASE WHEN l.natureza = 'despesa' THEN -l.valor ELSE l.valor END
               ELSE 0
             END), 0) AS movimento
      FROM public.financeiro_contas c
      LEFT JOIN public.financeiro_lancamentos l
             ON (l.conta_id = c.id OR l.conta_destino_id = c.id)
     WHERE c.empresa_id = p_empresa_id
     GROUP BY c.id
  )
  SELECT 'critico'::text,
         'saldo divergente'::text,
         'O saldo gravado de "' || c.nome || '" não corresponde aos lançamentos. '
           || 'Gravado ' || to_char(c.saldo_atual, 'FM999G999G999D00')
           || ', derivado ' || to_char(COALESCE(c.saldo_inicial,0) + m.movimento, 'FM999G999G999D00') || '.',
         c.saldo_atual - (COALESCE(c.saldo_inicial,0) + m.movimento),
         c.id::text
    FROM public.financeiro_contas c
    JOIN mov m ON m.conta_id = c.id
   WHERE abs(c.saldo_atual - (COALESCE(c.saldo_inicial,0) + m.movimento)) > 0.005

  UNION ALL

  -- ── 2. Conta com saldo negativo ───────────────────────────────────────────
  -- Conta corrente pode ficar negativa (cheque especial). Aplicação e caixa,
  -- não: é sempre saldo de abertura faltando ou lançamento com sentido trocado.
  SELECT (CASE WHEN c.nome ILIKE '%aplica%' OR c.nome ILIKE '%caix%' THEN 'critico' ELSE 'atencao' END)::text,
         'saldo negativo'::text,
         'A conta "' || c.nome || '" está com saldo negativo. '
           || CASE WHEN COALESCE(c.saldo_inicial,0) = 0
                   THEN 'O saldo de abertura está zerado — confira se ele foi informado.'
                   ELSE 'Confira se há lançamento com origem ou sentido trocado.' END,
         c.saldo_atual,
         c.id::text
    FROM public.financeiro_contas c
   WHERE c.empresa_id = p_empresa_id
     AND c.ativa
     AND c.saldo_atual < 0

  UNION ALL

  -- ── 3. Transferência de conta que não tinha o dinheiro ────────────────────
  -- O erro de 25/08: oito PIX lançados como saída de uma conta que abriu o ano
  -- com R$ 39,75. A conferência olha o saldo de abertura contra o que saiu.
  SELECT 'atencao'::text,
         'transferência acima do saldo'::text,
         'A conta "' || c.nome || '" registra saídas por transferência muito acima '
           || 'do que recebeu. Confira a conta de origem desses lançamentos.',
         t.saiu - t.entrou,
         c.id::text
    FROM public.financeiro_contas c
    JOIN LATERAL (
      SELECT COALESCE(SUM(l.valor) FILTER (WHERE l.natureza = 'despesa'), 0) AS saiu,
             COALESCE(SUM(l.valor) FILTER (WHERE l.natureza = 'receita'), 0) AS entrou
        FROM public.financeiro_lancamentos l
       WHERE l.conta_id = c.id AND l.tipo = 'transferencia'
    ) t ON true
   WHERE c.empresa_id = p_empresa_id
     AND t.saiu - t.entrou > COALESCE(c.saldo_inicial, 0) + 1000

  UNION ALL

  -- ── 4. Perna de transferência sem par ─────────────────────────────────────
  -- O formato espelhado grava duas linhas por lote. Lote com uma perna só
  -- significa dinheiro saindo de uma conta e não entrando em nenhuma.
  SELECT 'critico'::text,
         'transferência sem par'::text,
         'Lote de transferência com ' || cnt || ' perna(s) em vez de 2. '
           || 'O dinheiro sai de uma conta e não entra em nenhuma.',
         valor_lote,
         lote::text
    FROM (
      SELECT l.origem_lote_id AS lote, count(*) AS cnt, max(l.valor) AS valor_lote
        FROM public.financeiro_lancamentos l
       WHERE l.empresa_id = p_empresa_id
         AND l.tipo = 'transferencia'
         AND l.natureza IN ('despesa','receita')
         AND l.origem_lote_id IS NOT NULL
       GROUP BY l.origem_lote_id
      HAVING count(*) <> 2
    ) pares

  UNION ALL

  -- ── 5. Faturamento declarado × contabilizado ──────────────────────────────
  -- Os dois números que não convergiam. A diferença não é erro por si: parte é
  -- nota a receber com prazo correndo. Vira aviso quando passa de 10%.
  SELECT 'atencao'::text,
         'faturamento não confere'::text,
         'O faturamento declarado em Apuração difere do que os lançamentos somam. '
           || 'Declarado ' || to_char(d.declarado, 'FM999G999G999D00')
           || ', contabilizado ' || to_char(d.contabilizado, 'FM999G999G999D00') || '.',
         d.declarado - d.contabilizado,
         NULL::text
    FROM (
      SELECT
        (SELECT COALESCE(SUM(f.valor_faturamento), 0)
           FROM public.faturamento_mensal f WHERE f.empresa_id = p_empresa_id) AS declarado,
        (SELECT COALESCE(SUM(l.valor), 0)
           FROM public.financeiro_lancamentos l
           JOIN public.financeiro_categorias c ON c.id = l.categoria_id
          WHERE l.empresa_id = p_empresa_id
            AND c.grupo_dre = 'receita_bruta'
            AND l.status IN ('realizado','conciliado')) AS contabilizado
    ) d
   WHERE d.declarado > 0
     AND abs(d.declarado - d.contabilizado) > d.declarado * 0.10

  UNION ALL

  -- ── 6. Regime tributário ausente ──────────────────────────────────────────
  -- Sem regime não há por qual tabela apurar, e o padrão do banco era
  -- 'simples' — foi assim que uma empresa de Lucro Presumido foi apurada pela
  -- tabela do Simples Nacional sem ninguém ter escolhido nada.
  SELECT 'critico'::text,
         'regime não definido'::text,
         'A empresa não tem regime tributário no cadastro. A apuração não pode '
           || 'ser feita, e qualquer padrão adotado seria decidir no lugar de alguém.',
         NULL::numeric,
         e.id::text
    FROM public.empresas e
   WHERE e.id = p_empresa_id
     AND e.regime_tributario IS NULL

  UNION ALL

  -- ── 7. Lançamento com data implausível ────────────────────────────────────
  SELECT 'atencao'::text,
         'data implausível'::text,
         count(*) || ' lançamento(s) com vencimento a mais de 15 anos da competência. '
           || 'Provável ano digitado errado.',
         SUM(l.valor),
         NULL::text
    FROM public.financeiro_lancamentos l
   WHERE l.empresa_id = p_empresa_id
     AND l.data_vencimento IS NOT NULL
     AND l.data_competencia IS NOT NULL
     AND l.data_vencimento > l.data_competencia + interval '15 years'
  HAVING count(*) > 0

  UNION ALL

  -- ── 8. Lançamento sem categoria ───────────────────────────────────────────
  -- Percentual apurado sobre lançamento sem categoria é palpite com cara de
  -- número. A cobertura entra como informativo enquanto for pequena.
  SELECT (CASE WHEN SUM(l.valor) > 50000 THEN 'atencao' ELSE 'informativo' END)::text,
         'sem classificação'::text,
         count(*) || ' lançamento(s) realizado(s) sem categoria. '
           || 'Eles ficam fora do DRE e dos indicadores gerenciais.',
         SUM(l.valor),
         NULL::text
    FROM public.financeiro_lancamentos l
   WHERE l.empresa_id = p_empresa_id
     AND l.categoria_id IS NULL
     AND l.status IN ('realizado','conciliado')
     AND l.tipo IN ('a_receber','a_pagar')
  HAVING count(*) > 0

$$;

COMMENT ON FUNCTION public.financeiro_conferencia(uuid) IS
  'Refaz as derivações do Financeiro e devolve o que não fecha: saldo que não '
  'corresponde aos lançamentos, conta negativa, transferência sem par ou acima '
  'do saldo, faturamento divergente, regime ausente, data implausível, '
  'lançamento sem categoria. Não corrige nada — corrigir dinheiro é decisão de '
  'gente. Ela só se recusa a ficar calada.';

GRANT EXECUTE ON FUNCTION public.financeiro_conferencia(uuid) TO authenticated;

-- Uso:
--   SELECT * FROM public.financeiro_conferencia(
--     (SELECT id FROM public.empresas WHERE razao_social ILIKE 'ETHOS%')
--   ) ORDER BY CASE severidade WHEN 'critico' THEN 1 WHEN 'atencao' THEN 2 ELSE 3 END;
```

## 20260825000009 — A conferência checa o próprio gatilho

Em 25/08, entre 12h44 e 13h05, ninguém — nem eu, nem o sistema — conseguiu responder a uma
pergunta de uma linha: "o gatilho do saldo está no ar?". Inferi a resposta errada de um
arquivo de migration e afirmei que ele não existia. Existia.

A conferência cobria saldo, transferência, faturamento e regime. Não cobria a
infraestrutura que faz tudo isso valer. Sem `trg_saldo_lancamento`, `saldo_atual` congela
no último recálculo manual e passa a mentir em silêncio — continua exibido, com a mesma
aparência, apenas parado no tempo.

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- A conferência passa a checar o mecanismo que a sustenta
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Em 25/08, entre 12h44 e 13h05, ninguém — nem eu, nem o sistema — conseguiu
-- responder a uma pergunta de uma linha: "o gatilho do saldo está no ar?".
--
-- Passei vinte minutos inferindo a resposta errada a partir de um arquivo de
-- migration, e afirmei que o gatilho não existia. Existia. Foi preciso uma
-- consulta a pg_trigger, escrita à mão, para desfazer o engano.
--
-- A conferência cobria saldo, transferência, faturamento e regime. Não cobria
-- a infraestrutura que faz tudo isso valer: `saldo_atual` só acompanha os
-- lançamentos porque `trg_saldo_lancamento` dispara. Sem ele, o número volta a
-- ser algo guardado que ninguém atualiza — e o defeito é invisível, porque o
-- saldo continua lá, com a mesma cara de sempre, apenas parado no tempo.
--
-- Sistema que verifica os próprios dados e não verifica os próprios mecanismos
-- tem um ponto cego exatamente onde mais dói.

-- ═══════════════════════════════════════════════════════════════════════════
-- financeiro_conferencia() — o módulo passa a poder provar a própria correção
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Nada no Financeiro comparava o que ele afirmava com o que ele mesmo tinha.
-- Nada conferia `saldo_atual` contra `saldo_inicial + movimentos`; nada
-- comparava faturamento declarado com contabilizado; nada notou que uma tabela
-- de configuração estava vazia desde abril. Cada achado da auditoria de 25/08
-- precisou de um humano indo procurar.
--
-- É essa ausência que faz um erro de digitação virar cascata. Sem prova local,
-- o erro não fica contido: vaza para tudo a jusante, porque a jusante não tem
-- como se defender. Um número derivável e conferido isola o estrago; um número
-- guardado e nunca conferido o espalha.
--
-- Esta função refaz as derivações e devolve o que não fecha. Não corrige nada
-- — corrigir dinheiro é decisão de gente. Ela só se recusa a ficar calada.

CREATE OR REPLACE FUNCTION public.financeiro_conferencia(p_empresa_id uuid)
RETURNS TABLE (
  severidade  text,   -- 'critico' | 'atencao' | 'informativo'
  categoria   text,
  descricao   text,
  valor       numeric,
  referencia  text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$

  -- ── 1. O saldo bate com os lançamentos? ───────────────────────────────────
  -- A conferência que provou a correção de 25/08. Enquanto der zero, o saldo é
  -- derivável a qualquer momento; qualquer valor aqui é saldo fóssil voltando.
  WITH mov AS (
    SELECT c.id AS conta_id,
           COALESCE(SUM(
             CASE
               WHEN l.tipo = 'transferencia' AND l.natureza IN ('despesa','receita') THEN
                 CASE WHEN l.conta_id = c.id
                      THEN CASE WHEN l.natureza = 'despesa' THEN -l.valor ELSE l.valor END
                      ELSE 0 END
               WHEN l.tipo = 'transferencia' AND l.conta_id = c.id         THEN -l.valor
               WHEN l.tipo = 'transferencia' AND l.conta_destino_id = c.id THEN  l.valor
               WHEN l.conta_id IS DISTINCT FROM c.id THEN 0
               WHEN l.tipo = 'a_receber' AND l.status IN ('realizado','conciliado') THEN  l.valor
               WHEN l.tipo = 'a_pagar'   AND l.status IN ('realizado','conciliado') THEN -l.valor
               WHEN l.tipo = 'movimento_bancario' AND l.status IS DISTINCT FROM 'cancelado' THEN
                 CASE WHEN l.natureza = 'despesa' THEN -l.valor ELSE l.valor END
               ELSE 0
             END), 0) AS movimento
      FROM public.financeiro_contas c
      LEFT JOIN public.financeiro_lancamentos l
             ON (l.conta_id = c.id OR l.conta_destino_id = c.id)
     WHERE c.empresa_id = p_empresa_id
     GROUP BY c.id
  )
  SELECT 'critico'::text,
         'saldo divergente'::text,
         'O saldo gravado de "' || c.nome || '" não corresponde aos lançamentos. '
           || 'Gravado ' || to_char(c.saldo_atual, 'FM999G999G999D00')
           || ', derivado ' || to_char(COALESCE(c.saldo_inicial,0) + m.movimento, 'FM999G999G999D00') || '.',
         c.saldo_atual - (COALESCE(c.saldo_inicial,0) + m.movimento),
         c.id::text
    FROM public.financeiro_contas c
    JOIN mov m ON m.conta_id = c.id
   WHERE abs(c.saldo_atual - (COALESCE(c.saldo_inicial,0) + m.movimento)) > 0.005

  UNION ALL

  -- ── 2. Conta com saldo negativo ───────────────────────────────────────────
  -- Conta corrente pode ficar negativa (cheque especial). Aplicação e caixa,
  -- não: é sempre saldo de abertura faltando ou lançamento com sentido trocado.
  SELECT (CASE WHEN c.nome ILIKE '%aplica%' OR c.nome ILIKE '%caix%' THEN 'critico' ELSE 'atencao' END)::text,
         'saldo negativo'::text,
         'A conta "' || c.nome || '" está com saldo negativo. '
           || CASE WHEN COALESCE(c.saldo_inicial,0) = 0
                   THEN 'O saldo de abertura está zerado — confira se ele foi informado.'
                   ELSE 'Confira se há lançamento com origem ou sentido trocado.' END,
         c.saldo_atual,
         c.id::text
    FROM public.financeiro_contas c
   WHERE c.empresa_id = p_empresa_id
     AND c.ativa
     AND c.saldo_atual < 0

  UNION ALL

  -- ── 3. Transferência de conta que não tinha o dinheiro ────────────────────
  -- O erro de 25/08: oito PIX lançados como saída de uma conta que abriu o ano
  -- com R$ 39,75. A conferência olha o saldo de abertura contra o que saiu.
  SELECT 'atencao'::text,
         'transferência acima do saldo'::text,
         'A conta "' || c.nome || '" registra saídas por transferência muito acima '
           || 'do que recebeu. Confira a conta de origem desses lançamentos.',
         t.saiu - t.entrou,
         c.id::text
    FROM public.financeiro_contas c
    JOIN LATERAL (
      SELECT COALESCE(SUM(l.valor) FILTER (WHERE l.natureza = 'despesa'), 0) AS saiu,
             COALESCE(SUM(l.valor) FILTER (WHERE l.natureza = 'receita'), 0) AS entrou
        FROM public.financeiro_lancamentos l
       WHERE l.conta_id = c.id AND l.tipo = 'transferencia'
    ) t ON true
   WHERE c.empresa_id = p_empresa_id
     AND t.saiu - t.entrou > COALESCE(c.saldo_inicial, 0) + 1000

  UNION ALL

  -- ── 4. Perna de transferência sem par ─────────────────────────────────────
  -- O formato espelhado grava duas linhas por lote. Lote com uma perna só
  -- significa dinheiro saindo de uma conta e não entrando em nenhuma.
  SELECT 'critico'::text,
         'transferência sem par'::text,
         'Lote de transferência com ' || cnt || ' perna(s) em vez de 2. '
           || 'O dinheiro sai de uma conta e não entra em nenhuma.',
         valor_lote,
         lote::text
    FROM (
      SELECT l.origem_lote_id AS lote, count(*) AS cnt, max(l.valor) AS valor_lote
        FROM public.financeiro_lancamentos l
       WHERE l.empresa_id = p_empresa_id
         AND l.tipo = 'transferencia'
         AND l.natureza IN ('despesa','receita')
         AND l.origem_lote_id IS NOT NULL
       GROUP BY l.origem_lote_id
      HAVING count(*) <> 2
    ) pares

  UNION ALL

  -- ── 5. Faturamento declarado × contabilizado ──────────────────────────────
  -- Os dois números que não convergiam. A diferença não é erro por si: parte é
  -- nota a receber com prazo correndo. Vira aviso quando passa de 10%.
  SELECT 'atencao'::text,
         'faturamento não confere'::text,
         'O faturamento declarado em Apuração difere do que os lançamentos somam. '
           || 'Declarado ' || to_char(d.declarado, 'FM999G999G999D00')
           || ', contabilizado ' || to_char(d.contabilizado, 'FM999G999G999D00') || '.',
         d.declarado - d.contabilizado,
         NULL::text
    FROM (
      SELECT
        (SELECT COALESCE(SUM(f.valor_faturamento), 0)
           FROM public.faturamento_mensal f WHERE f.empresa_id = p_empresa_id) AS declarado,
        (SELECT COALESCE(SUM(l.valor), 0)
           FROM public.financeiro_lancamentos l
           JOIN public.financeiro_categorias c ON c.id = l.categoria_id
          WHERE l.empresa_id = p_empresa_id
            AND c.grupo_dre = 'receita_bruta'
            AND l.status IN ('realizado','conciliado')) AS contabilizado
    ) d
   WHERE d.declarado > 0
     AND abs(d.declarado - d.contabilizado) > d.declarado * 0.10

  UNION ALL

  -- ── 6. Regime tributário ausente ──────────────────────────────────────────
  -- Sem regime não há por qual tabela apurar, e o padrão do banco era
  -- 'simples' — foi assim que uma empresa de Lucro Presumido foi apurada pela
  -- tabela do Simples Nacional sem ninguém ter escolhido nada.
  SELECT 'critico'::text,
         'regime não definido'::text,
         'A empresa não tem regime tributário no cadastro. A apuração não pode '
           || 'ser feita, e qualquer padrão adotado seria decidir no lugar de alguém.',
         NULL::numeric,
         e.id::text
    FROM public.empresas e
   WHERE e.id = p_empresa_id
     AND e.regime_tributario IS NULL

  UNION ALL

  -- ── 7. Lançamento com data implausível ────────────────────────────────────
  SELECT 'atencao'::text,
         'data implausível'::text,
         count(*) || ' lançamento(s) com vencimento a mais de 15 anos da competência. '
           || 'Provável ano digitado errado.',
         SUM(l.valor),
         NULL::text
    FROM public.financeiro_lancamentos l
   WHERE l.empresa_id = p_empresa_id
     AND l.data_vencimento IS NOT NULL
     AND l.data_competencia IS NOT NULL
     AND l.data_vencimento > l.data_competencia + interval '15 years'
  HAVING count(*) > 0

  UNION ALL

  -- ── 8. Lançamento sem categoria ───────────────────────────────────────────
  -- Percentual apurado sobre lançamento sem categoria é palpite com cara de
  -- número. A cobertura entra como informativo enquanto for pequena.
  SELECT (CASE WHEN SUM(l.valor) > 50000 THEN 'atencao' ELSE 'informativo' END)::text,
         'sem classificação'::text,
         count(*) || ' lançamento(s) realizado(s) sem categoria. '
           || 'Eles ficam fora do DRE e dos indicadores gerenciais.',
         SUM(l.valor),
         NULL::text
    FROM public.financeiro_lancamentos l
   WHERE l.empresa_id = p_empresa_id
     AND l.categoria_id IS NULL
     AND l.status IN ('realizado','conciliado')
     AND l.tipo IN ('a_receber','a_pagar')
  HAVING count(*) > 0

  UNION ALL

  -- ── 9. O gatilho que mantém o saldo derivado está ativo? ──────────────────
  -- Sem ele, saldo_atual congela no último recálculo manual e passa a mentir
  -- em silêncio. É a única checagem aqui que não olha dado, e sim o motor.
  SELECT 'critico'::text,
         'gatilho do saldo inativo'::text,
         'O gatilho trg_saldo_lancamento não está ativo em financeiro_lancamentos. '
           || 'Sem ele, o saldo das contas para de acompanhar os lançamentos: '
           || 'continua exibido, com a mesma aparência, apenas parado no tempo. '
           || 'Reinstale antes de confiar em qualquer saldo desta tela.',
         NULL::numeric,
         NULL::text
   WHERE NOT EXISTS (
     SELECT 1
       FROM pg_trigger t
       JOIN pg_class cl     ON cl.oid = t.tgrelid
       JOIN pg_namespace ns ON ns.oid = cl.relnamespace
      WHERE ns.nspname = 'public'
        AND cl.relname = 'financeiro_lancamentos'
        AND t.tgname   = 'trg_saldo_lancamento'
        AND NOT t.tgisinternal
        AND t.tgenabled = 'O'   -- 'O' = ativo; 'D' = desabilitado
   )

$$;

COMMENT ON FUNCTION public.financeiro_conferencia(uuid) IS
  'Refaz as derivações do Financeiro e devolve o que não fecha: saldo que não '
  'corresponde aos lançamentos, conta negativa, transferência sem par ou acima '
  'do saldo, faturamento divergente, regime ausente, data implausível, '
  'lançamento sem categoria. Não corrige nada — corrigir dinheiro é decisão de '
  'gente. Ela só se recusa a ficar calada.';

GRANT EXECUTE ON FUNCTION public.financeiro_conferencia(uuid) TO authenticated;

-- Uso:
--   SELECT * FROM public.financeiro_conferencia(
--     (SELECT id FROM public.empresas WHERE razao_social ILIKE 'ETHOS%')
--   ) ORDER BY CASE severidade WHEN 'critico' THEN 1 WHEN 'atencao' THEN 2 ELSE 3 END;
```

## 20260825000010 — O documento fiscal fica no sistema

O PDF enviado em Contas a Receber era lido para a memória, virava imagem, ia para a IA e
sumia ao fechar a tela. O XML tinha o mesmo destino. Sobrava o **registro** da nota; não
sobrava a **nota**.

`financeiro_documentos_fiscais` existe desde abril com as colunas certas — e com RLS
habilitada e **zero políticas**, ou seja, inacessível. Não foi esquecida: foi construída
sem porta. Os buckets `nfes-xml`, `danfes` e `capturas-ocr` também existem sem uso, e
isolam por `auth.uid()` — por usuário. Nota fiscal é da **empresa**: com aquela regra, o
documento que o contador subiu ficaria invisível para o sócio.

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- O documento fiscal passa a ficar no sistema
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Hoje o PDF que se envia em Contas a Receber é lido para a memória, vira
-- imagem, vai para a IA, produz um lançamento — e some quando a tela fecha.
-- O XML tem o mesmo destino por outro caminho: a edge function extrai os
-- campos e não guarda o arquivo. Sobra o REGISTRO da nota; não sobra a NOTA.
--
-- Para quem vende a órgão público isso é três problemas de uma vez:
--
--   • Guarda. O XML da NF-e É o documento fiscal; o DANFE em PDF é só a
--     representação impressa dele. Guardar campos extraídos não cumpre o
--     prazo decadencial de cinco anos.
--   • Prova. Quando o órgão questiona uma entrega, ou quando se pede
--     reequilíbrio, a nota é a prova. Hoje ela está no e-mail de alguém.
--   • Auditoria da leitura. Em 25/08 a IA leu o número da nota no lugar da
--     chave de acesso. Sem o arquivo original, não há como reconferir o que
--     ela leu errado — e `ocr_data`, a coluna que existe exatamente para
--     isso, está vazia.
--
-- ── O que já existia, e por que nunca funcionou ─────────────────────────────
-- `financeiro_documentos_fiscais` foi criada em abril com as colunas certas,
-- incluindo `arquivo_url`, `arquivo_xml` e `ocr_data`. Tem RLS habilitada e
-- ZERO políticas — o que significa que ninguém, nunca, conseguiria ler ou
-- gravar nela. Ela não foi esquecida: ela foi construída sem porta.
--
-- Os buckets `nfes-xml`, `danfes` e `capturas-ocr` também existem desde abril,
-- sem uso. E as políticas deles isolam por `auth.uid()` — por USUÁRIO. Nota
-- fiscal é da EMPRESA: com aquela regra, o documento que o contador subiu
-- ficaria invisível para o sócio. É o mesmo defeito do princípio 2 do
-- CLAUDE.md, e é por isso que aqui nasce um bucket novo em vez de reaproveitar
-- os três.

-- ── 1. O bucket, isolado por empresa ────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('financeiro-documentos', 'financeiro-documentos', false)
ON CONFLICT (id) DO NOTHING;

-- Caminho: {empresa_id}/{ano}/{uuid}.{ext}
-- A primeira pasta é a empresa, e é ela que a política confere.
DROP POLICY IF EXISTS "membros leem documentos fiscais" ON storage.objects;
CREATE POLICY "membros leem documentos fiscais"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'financeiro-documentos'
    AND public.is_empresa_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "membros enviam documentos fiscais" ON storage.objects;
CREATE POLICY "membros enviam documentos fiscais"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'financeiro-documentos'
    AND public.is_empresa_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

-- Excluir documento fiscal é ato de administrador. Nota guardada por
-- obrigação legal não se apaga por engano de quem estava organizando pasta.
DROP POLICY IF EXISTS "admin exclui documentos fiscais" ON storage.objects;
CREATE POLICY "admin exclui documentos fiscais"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'financeiro-documentos'
    AND public.is_empresa_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

-- ── 2. A tabela ganha o que faltava para servir ─────────────────────────────
ALTER TABLE public.financeiro_documentos_fiscais
  ADD COLUMN IF NOT EXISTS lancamento_id uuid
    REFERENCES public.financeiro_lancamentos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS storage_path  text,
  ADD COLUMN IF NOT EXISTS arquivo_nome  text,
  ADD COLUMN IF NOT EXISTS arquivo_mime  text,
  ADD COLUMN IF NOT EXISTS arquivo_bytes bigint,
  ADD COLUMN IF NOT EXISTS enviado_por   uuid;

-- `data_emissao` e `valor_total` eram NOT NULL. Isso obrigaria a esperar a
-- leitura da IA terminar para só então gravar o documento — e era justamente
-- a leitura que podia falhar, levando o arquivo junto. A CHEGADA do documento
-- é um fato; o CONTEÚDO dele é uma interpretação, e interpretação pode vir
-- depois, ou não vir.
ALTER TABLE public.financeiro_documentos_fiscais
  ALTER COLUMN data_emissao DROP NOT NULL,
  ALTER COLUMN valor_total  DROP NOT NULL,
  ALTER COLUMN valor_total  SET DEFAULT 0,
  ALTER COLUMN tipo         SET DEFAULT 'outro';

CREATE INDEX IF NOT EXISTS idx_fdf_lancamento
  ON public.financeiro_documentos_fiscais(lancamento_id)
  WHERE lancamento_id IS NOT NULL;

-- ── 3. As políticas que nunca existiram ─────────────────────────────────────
DROP POLICY IF EXISTS "membros leem docs fiscais" ON public.financeiro_documentos_fiscais;
CREATE POLICY "membros leem docs fiscais"
  ON public.financeiro_documentos_fiscais FOR SELECT TO authenticated
  USING (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "membros gravam docs fiscais" ON public.financeiro_documentos_fiscais;
CREATE POLICY "membros gravam docs fiscais"
  ON public.financeiro_documentos_fiscais FOR INSERT TO authenticated
  WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "membros atualizam docs fiscais" ON public.financeiro_documentos_fiscais;
CREATE POLICY "membros atualizam docs fiscais"
  ON public.financeiro_documentos_fiscais FOR UPDATE TO authenticated
  USING (public.is_empresa_member(auth.uid(), empresa_id))
  WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "admin exclui docs fiscais" ON public.financeiro_documentos_fiscais;
CREATE POLICY "admin exclui docs fiscais"
  ON public.financeiro_documentos_fiscais FOR DELETE TO authenticated
  USING (public.is_empresa_admin(auth.uid(), empresa_id));

COMMENT ON TABLE public.financeiro_documentos_fiscais IS
  'O documento fiscal em si — o arquivo, não os campos extraídos dele. '
  'storage_path aponta para o bucket financeiro-documentos; arquivo_xml guarda '
  'o XML da NF-e, que É o documento (o DANFE é só a representação impressa). '
  'ocr_data guarda o que a leitura automática entendeu, para se poder conferir '
  'depois contra o original. Nasceu em 2026-04 com RLS habilitada e nenhuma '
  'política — inacessível — e só passou a servir em 2026-08.';

COMMENT ON COLUMN public.financeiro_documentos_fiscais.ocr_data IS
  'O que a leitura automática entendeu, cru. Em 25/08 a IA leu o número da '
  'nota no lugar da chave de acesso; sem este campo e sem o arquivo original, '
  'não havia como descobrir o que ela leu errado.';
```

## 20260825000011 — A conferência nota a nota sem documento

Não basta permitir anexar: o sistema precisa **notar a ausência**. Campo de anexo opcional
que ninguém preenche é indistinguível de campo que não existe — e a descoberta vem no pior
momento, quando o documento é pedido. Vale só a partir de 25/08.

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- A conferência nota a nota fiscal que ficou sem documento
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Não basta permitir anexar: o sistema precisa NOTAR a ausência. Um campo de
-- anexo opcional que ninguém preenche é indistinguível de um campo que não
-- existe — e a descoberta vem no pior momento, quando o documento é pedido.
--
-- Décimo achado: lançamento de NF-e/NFS-e cujo arquivo não foi guardado.
-- Vale só do dia 25/08 em diante, quando o arquivamento passou a existir;
-- cobrar do que veio antes seria cobrar obrigação que ninguém podia cumprir.

CREATE OR REPLACE FUNCTION public.financeiro_conferencia(p_empresa_id uuid)
RETURNS TABLE (
  severidade  text,   -- 'critico' | 'atencao' | 'informativo'
  categoria   text,
  descricao   text,
  valor       numeric,
  referencia  text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$

  -- ── 1. O saldo bate com os lançamentos? ───────────────────────────────────
  -- A conferência que provou a correção de 25/08. Enquanto der zero, o saldo é
  -- derivável a qualquer momento; qualquer valor aqui é saldo fóssil voltando.
  WITH mov AS (
    SELECT c.id AS conta_id,
           COALESCE(SUM(
             CASE
               WHEN l.tipo = 'transferencia' AND l.natureza IN ('despesa','receita') THEN
                 CASE WHEN l.conta_id = c.id
                      THEN CASE WHEN l.natureza = 'despesa' THEN -l.valor ELSE l.valor END
                      ELSE 0 END
               WHEN l.tipo = 'transferencia' AND l.conta_id = c.id         THEN -l.valor
               WHEN l.tipo = 'transferencia' AND l.conta_destino_id = c.id THEN  l.valor
               WHEN l.conta_id IS DISTINCT FROM c.id THEN 0
               WHEN l.tipo = 'a_receber' AND l.status IN ('realizado','conciliado') THEN  l.valor
               WHEN l.tipo = 'a_pagar'   AND l.status IN ('realizado','conciliado') THEN -l.valor
               WHEN l.tipo = 'movimento_bancario' AND l.status IS DISTINCT FROM 'cancelado' THEN
                 CASE WHEN l.natureza = 'despesa' THEN -l.valor ELSE l.valor END
               ELSE 0
             END), 0) AS movimento
      FROM public.financeiro_contas c
      LEFT JOIN public.financeiro_lancamentos l
             ON (l.conta_id = c.id OR l.conta_destino_id = c.id)
     WHERE c.empresa_id = p_empresa_id
     GROUP BY c.id
  )
  SELECT 'critico'::text,
         'saldo divergente'::text,
         'O saldo gravado de "' || c.nome || '" não corresponde aos lançamentos. '
           || 'Gravado ' || to_char(c.saldo_atual, 'FM999G999G999D00')
           || ', derivado ' || to_char(COALESCE(c.saldo_inicial,0) + m.movimento, 'FM999G999G999D00') || '.',
         c.saldo_atual - (COALESCE(c.saldo_inicial,0) + m.movimento),
         c.id::text
    FROM public.financeiro_contas c
    JOIN mov m ON m.conta_id = c.id
   WHERE abs(c.saldo_atual - (COALESCE(c.saldo_inicial,0) + m.movimento)) > 0.005

  UNION ALL

  -- ── 2. Conta com saldo negativo ───────────────────────────────────────────
  -- Conta corrente pode ficar negativa (cheque especial). Aplicação e caixa,
  -- não: é sempre saldo de abertura faltando ou lançamento com sentido trocado.
  SELECT (CASE WHEN c.nome ILIKE '%aplica%' OR c.nome ILIKE '%caix%' THEN 'critico' ELSE 'atencao' END)::text,
         'saldo negativo'::text,
         'A conta "' || c.nome || '" está com saldo negativo. '
           || CASE WHEN COALESCE(c.saldo_inicial,0) = 0
                   THEN 'O saldo de abertura está zerado — confira se ele foi informado.'
                   ELSE 'Confira se há lançamento com origem ou sentido trocado.' END,
         c.saldo_atual,
         c.id::text
    FROM public.financeiro_contas c
   WHERE c.empresa_id = p_empresa_id
     AND c.ativa
     AND c.saldo_atual < 0

  UNION ALL

  -- ── 3. Transferência de conta que não tinha o dinheiro ────────────────────
  -- O erro de 25/08: oito PIX lançados como saída de uma conta que abriu o ano
  -- com R$ 39,75. A conferência olha o saldo de abertura contra o que saiu.
  SELECT 'atencao'::text,
         'transferência acima do saldo'::text,
         'A conta "' || c.nome || '" registra saídas por transferência muito acima '
           || 'do que recebeu. Confira a conta de origem desses lançamentos.',
         t.saiu - t.entrou,
         c.id::text
    FROM public.financeiro_contas c
    JOIN LATERAL (
      SELECT COALESCE(SUM(l.valor) FILTER (WHERE l.natureza = 'despesa'), 0) AS saiu,
             COALESCE(SUM(l.valor) FILTER (WHERE l.natureza = 'receita'), 0) AS entrou
        FROM public.financeiro_lancamentos l
       WHERE l.conta_id = c.id AND l.tipo = 'transferencia'
    ) t ON true
   WHERE c.empresa_id = p_empresa_id
     AND t.saiu - t.entrou > COALESCE(c.saldo_inicial, 0) + 1000

  UNION ALL

  -- ── 4. Perna de transferência sem par ─────────────────────────────────────
  -- O formato espelhado grava duas linhas por lote. Lote com uma perna só
  -- significa dinheiro saindo de uma conta e não entrando em nenhuma.
  SELECT 'critico'::text,
         'transferência sem par'::text,
         'Lote de transferência com ' || cnt || ' perna(s) em vez de 2. '
           || 'O dinheiro sai de uma conta e não entra em nenhuma.',
         valor_lote,
         lote::text
    FROM (
      SELECT l.origem_lote_id AS lote, count(*) AS cnt, max(l.valor) AS valor_lote
        FROM public.financeiro_lancamentos l
       WHERE l.empresa_id = p_empresa_id
         AND l.tipo = 'transferencia'
         AND l.natureza IN ('despesa','receita')
         AND l.origem_lote_id IS NOT NULL
       GROUP BY l.origem_lote_id
      HAVING count(*) <> 2
    ) pares

  UNION ALL

  -- ── 5. Faturamento declarado × contabilizado ──────────────────────────────
  -- Os dois números que não convergiam. A diferença não é erro por si: parte é
  -- nota a receber com prazo correndo. Vira aviso quando passa de 10%.
  SELECT 'atencao'::text,
         'faturamento não confere'::text,
         'O faturamento declarado em Apuração difere do que os lançamentos somam. '
           || 'Declarado ' || to_char(d.declarado, 'FM999G999G999D00')
           || ', contabilizado ' || to_char(d.contabilizado, 'FM999G999G999D00') || '.',
         d.declarado - d.contabilizado,
         NULL::text
    FROM (
      SELECT
        (SELECT COALESCE(SUM(f.valor_faturamento), 0)
           FROM public.faturamento_mensal f WHERE f.empresa_id = p_empresa_id) AS declarado,
        (SELECT COALESCE(SUM(l.valor), 0)
           FROM public.financeiro_lancamentos l
           JOIN public.financeiro_categorias c ON c.id = l.categoria_id
          WHERE l.empresa_id = p_empresa_id
            AND c.grupo_dre = 'receita_bruta'
            AND l.status IN ('realizado','conciliado')) AS contabilizado
    ) d
   WHERE d.declarado > 0
     AND abs(d.declarado - d.contabilizado) > d.declarado * 0.10

  UNION ALL

  -- ── 6. Regime tributário ausente ──────────────────────────────────────────
  -- Sem regime não há por qual tabela apurar, e o padrão do banco era
  -- 'simples' — foi assim que uma empresa de Lucro Presumido foi apurada pela
  -- tabela do Simples Nacional sem ninguém ter escolhido nada.
  SELECT 'critico'::text,
         'regime não definido'::text,
         'A empresa não tem regime tributário no cadastro. A apuração não pode '
           || 'ser feita, e qualquer padrão adotado seria decidir no lugar de alguém.',
         NULL::numeric,
         e.id::text
    FROM public.empresas e
   WHERE e.id = p_empresa_id
     AND e.regime_tributario IS NULL

  UNION ALL

  -- ── 7. Lançamento com data implausível ────────────────────────────────────
  SELECT 'atencao'::text,
         'data implausível'::text,
         count(*) || ' lançamento(s) com vencimento a mais de 15 anos da competência. '
           || 'Provável ano digitado errado.',
         SUM(l.valor),
         NULL::text
    FROM public.financeiro_lancamentos l
   WHERE l.empresa_id = p_empresa_id
     AND l.data_vencimento IS NOT NULL
     AND l.data_competencia IS NOT NULL
     AND l.data_vencimento > l.data_competencia + interval '15 years'
  HAVING count(*) > 0

  UNION ALL

  -- ── 8. Lançamento sem categoria ───────────────────────────────────────────
  -- Percentual apurado sobre lançamento sem categoria é palpite com cara de
  -- número. A cobertura entra como informativo enquanto for pequena.
  SELECT (CASE WHEN SUM(l.valor) > 50000 THEN 'atencao' ELSE 'informativo' END)::text,
         'sem classificação'::text,
         count(*) || ' lançamento(s) realizado(s) sem categoria. '
           || 'Eles ficam fora do DRE e dos indicadores gerenciais.',
         SUM(l.valor),
         NULL::text
    FROM public.financeiro_lancamentos l
   WHERE l.empresa_id = p_empresa_id
     AND l.categoria_id IS NULL
     AND l.status IN ('realizado','conciliado')
     AND l.tipo IN ('a_receber','a_pagar')
  HAVING count(*) > 0

  UNION ALL

  -- ── 9. O gatilho que mantém o saldo derivado está ativo? ──────────────────
  -- Sem ele, saldo_atual congela no último recálculo manual e passa a mentir
  -- em silêncio. É a única checagem aqui que não olha dado, e sim o motor.
  SELECT 'critico'::text,
         'gatilho do saldo inativo'::text,
         'O gatilho trg_saldo_lancamento não está ativo em financeiro_lancamentos. '
           || 'Sem ele, o saldo das contas para de acompanhar os lançamentos: '
           || 'continua exibido, com a mesma aparência, apenas parado no tempo. '
           || 'Reinstale antes de confiar em qualquer saldo desta tela.',
         NULL::numeric,
         NULL::text
   WHERE NOT EXISTS (
     SELECT 1
       FROM pg_trigger t
       JOIN pg_class cl     ON cl.oid = t.tgrelid
       JOIN pg_namespace ns ON ns.oid = cl.relnamespace
      WHERE ns.nspname = 'public'
        AND cl.relname = 'financeiro_lancamentos'
        AND t.tgname   = 'trg_saldo_lancamento'
        AND NOT t.tgisinternal
        AND t.tgenabled = 'O'   -- 'O' = ativo; 'D' = desabilitado
   )

  UNION ALL

  -- ── 10. Nota fiscal lançada sem o documento guardado ──────────────────────
  -- O XML da NF-e É o documento fiscal; o DANFE é a representação impressa
  -- dele. Guardar só os campos extraídos não cumpre o prazo decadencial de
  -- cinco anos, e deixa sem prova quem precisar responder a questionamento do
  -- órgão ou pedir reequilíbrio.
  --
  -- Só conta lançamento nascido a partir de 2026-08-25: cobrar documento do
  -- que foi lançado antes de o arquivamento existir seria cobrar uma
  -- obrigação retroativa que ninguém tinha como cumprir.
  SELECT 'atencao'::text,
         'nota sem documento'::text,
         count(*) || ' lançamento(s) de NF-e/NFS-e sem o arquivo guardado. '
           || 'Os campos foram registrados, o documento não — e é ele que vale '
           || 'como prova e cumpre o prazo de guarda.',
         SUM(l.valor),
         NULL::text
    FROM public.financeiro_lancamentos l
   WHERE l.empresa_id = p_empresa_id
     AND l.tipo_documento IN ('nfe','nfse','nfce')
     AND l.created_at >= DATE '2026-08-25'
     AND NOT EXISTS (
       SELECT 1 FROM public.financeiro_documentos_fiscais d
        WHERE d.lancamento_id = l.id
          AND (d.storage_path IS NOT NULL OR d.arquivo_xml IS NOT NULL)
     )
  HAVING count(*) > 0

$$;

COMMENT ON FUNCTION public.financeiro_conferencia(uuid) IS
  'Refaz as derivações do Financeiro e devolve o que não fecha: saldo que não '
  'corresponde aos lançamentos, conta negativa, transferência sem par ou acima '
  'do saldo, faturamento divergente, regime ausente, data implausível, '
  'lançamento sem categoria. Não corrige nada — corrigir dinheiro é decisão de '
  'gente. Ela só se recusa a ficar calada.';

GRANT EXECUTE ON FUNCTION public.financeiro_conferencia(uuid) TO authenticated;

-- Uso:
--   SELECT * FROM public.financeiro_conferencia(
--     (SELECT id FROM public.empresas WHERE razao_social ILIKE 'ETHOS%')
--   ) ORDER BY CASE severidade WHEN 'critico' THEN 1 WHEN 'atencao' THEN 2 ELSE 3 END;
```

## 20260825000012 — O DRE ignora transferência entre contas próprias

Dinheiro que sai de uma conta da empresa e entra em outra da mesma empresa não é receita
nem despesa — o patrimônio não mudou, só de gaveta.

A view somava sem olhar o `tipo`. O que a protegia era **acidente**: o `JOIN` com categorias
é interno e transferência normalmente não tem categoria. Basta alguém categorizar uma — e
como a tela grava duas pernas (`receita` e `despesa`), ela infla os dois lados ao mesmo
tempo: o total fica certo e todas as parcelas, erradas.

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- O DRE ignora transferência entre contas próprias
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Dinheiro que sai de uma conta da empresa e entra em outra conta da mesma
-- empresa não é receita nem despesa: o patrimônio não mudou. Só mudou de
-- gaveta. Isso não é opinião contábil — é a definição de resultado.
--
-- A view somava `financeiro_lancamentos` sem olhar o `tipo`. O que a protegia
-- era acidente: o JOIN com `financeiro_categorias` é INTERNO, e transferência
-- normalmente não tem categoria, então ficava de fora por não ter par no
-- JOIN. Basta alguém categorizar uma transferência — por organização, por
-- engano, por um importador futuro que preencha categoria — e ela entra no
-- resultado.
--
-- Pior: o formato que a tela de lançamento grava é de DUAS pernas, uma com
-- natureza 'receita' e outra com 'despesa'. Categorizadas, elas inflam os dois
-- lados do DRE ao mesmo tempo, e a diferença entre eles continua zero. O
-- resultado final fica certo e todos os números que o compõem, errados — que
-- é o tipo de erro que ninguém encontra olhando o total.
--
-- Depender de acidente para estar certo é o mesmo que estar errado e ainda não
-- ter sido pego. A regra passa a ser explícita.

DROP MATERIALIZED VIEW IF EXISTS public.mv_financeiro_dre_mensal;

CREATE MATERIALIZED VIEW public.mv_financeiro_dre_mensal AS
SELECT
  l.empresa_id,
  date_trunc('month', l.data_competencia)::date AS competencia,
  c.grupo_dre,
  c.id AS categoria_id,
  c.nome AS categoria_nome,
  c.natureza,
  SUM(l.valor) AS total
FROM public.financeiro_lancamentos l
JOIN public.financeiro_categorias c ON c.id = l.categoria_id
WHERE l.status IN ('realizado','conciliado')
  -- Transferência entre contas próprias não é resultado, tenha categoria ou não.
  AND l.tipo <> 'transferencia'
GROUP BY l.empresa_id, date_trunc('month', l.data_competencia), c.grupo_dre, c.id, c.nome, c.natureza;

CREATE UNIQUE INDEX idx_mv_dre
  ON public.mv_financeiro_dre_mensal(empresa_id, competencia, categoria_id);

COMMENT ON MATERIALIZED VIEW public.mv_financeiro_dre_mensal IS
  'DRE mensal por categoria. Exclui transferência entre contas próprias: '
  'dinheiro que muda de gaveta não é receita nem despesa. Antes a exclusão era '
  'acidental — dependia de a transferência não ter categoria — e uma '
  'transferência categorizada inflava os dois lados do resultado ao mesmo '
  'tempo, deixando o total certo e todas as parcelas erradas.';

REFRESH MATERIALIZED VIEW public.mv_financeiro_dre_mensal;

-- ── Conferência ─────────────────────────────────────────────────────────────
-- Transferência categorizada que estava entrando no DRE (o esperado é nenhuma,
-- mas se houver, este é o valor que saiu do resultado agora):
--   SELECT c.grupo_dre, count(*), SUM(l.valor)
--     FROM public.financeiro_lancamentos l
--     JOIN public.financeiro_categorias c ON c.id = l.categoria_id
--    WHERE l.tipo = 'transferencia' AND l.status IN ('realizado','conciliado')
--    GROUP BY 1 ORDER BY 3 DESC;
```

## 20260825000013 — A conferência aponta o título que na verdade é transferência

Décimo primeiro achado. `INT RESGATE MAPFRERFDI` lançado como conta a receber não é
recebimento de cliente: é dinheiro da empresa voltando do CDB. Na ETHOS são R$ 1,86 milhão
assim, inflando o "Total a receber em aberto".

O achado **aponta e não prescreve**, de propósito: o remédio depende de a transferência
correspondente já existir. Se existe, o título é duplicata e se remove; se não existe, o
título **é** a transferência e se converte. Converter uma duplicata criaria uma terceira
contagem.

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- A conferência aponta o título que na verdade é transferência
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Décimo primeiro achado. "INT RESGATE MAPFRERFDI" lançado como conta a
-- receber não é recebimento de cliente: é dinheiro da empresa voltando do CDB.
-- Na ETHOS são R$ 1,86 milhão assim, inflando o "Total a receber em aberto".
--
-- O achado APONTA e não prescreve, de propósito: o remédio depende de a
-- transferência correspondente já existir. Se existe, o título é duplicata e
-- se remove; se não existe, o título É a transferência e se converte.
-- Converter uma duplicata criaria uma TERCEIRA contagem — confundir os dois
-- casos dobra o erro em vez de corrigi-lo.
--
-- Precisa de `unaccent_imutavel`, criada abaixo: comparar descrição de extrato
-- sem tirar acento erra em "aplicação" e acerta em "aplicacao" — o tipo de
-- acerto pela metade que deixa dinheiro passar.

CREATE OR REPLACE FUNCTION public.unaccent_imutavel(txt text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT translate(
    COALESCE(txt, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
  );
$fn$;

COMMENT ON FUNCTION public.unaccent_imutavel(text) IS
  'Remove acentos por translate, sem depender da extensão unaccent — que não é '
  'IMMUTABLE e por isso não serve em índice nem em view materializada.';

CREATE OR REPLACE FUNCTION public.financeiro_conferencia(p_empresa_id uuid)
RETURNS TABLE (
  severidade  text,   -- 'critico' | 'atencao' | 'informativo'
  categoria   text,
  descricao   text,
  valor       numeric,
  referencia  text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$

  -- ── 1. O saldo bate com os lançamentos? ───────────────────────────────────
  -- A conferência que provou a correção de 25/08. Enquanto der zero, o saldo é
  -- derivável a qualquer momento; qualquer valor aqui é saldo fóssil voltando.
  WITH mov AS (
    SELECT c.id AS conta_id,
           COALESCE(SUM(
             CASE
               WHEN l.tipo = 'transferencia' AND l.natureza IN ('despesa','receita') THEN
                 CASE WHEN l.conta_id = c.id
                      THEN CASE WHEN l.natureza = 'despesa' THEN -l.valor ELSE l.valor END
                      ELSE 0 END
               WHEN l.tipo = 'transferencia' AND l.conta_id = c.id         THEN -l.valor
               WHEN l.tipo = 'transferencia' AND l.conta_destino_id = c.id THEN  l.valor
               WHEN l.conta_id IS DISTINCT FROM c.id THEN 0
               WHEN l.tipo = 'a_receber' AND l.status IN ('realizado','conciliado') THEN  l.valor
               WHEN l.tipo = 'a_pagar'   AND l.status IN ('realizado','conciliado') THEN -l.valor
               WHEN l.tipo = 'movimento_bancario' AND l.status IS DISTINCT FROM 'cancelado' THEN
                 CASE WHEN l.natureza = 'despesa' THEN -l.valor ELSE l.valor END
               ELSE 0
             END), 0) AS movimento
      FROM public.financeiro_contas c
      LEFT JOIN public.financeiro_lancamentos l
             ON (l.conta_id = c.id OR l.conta_destino_id = c.id)
     WHERE c.empresa_id = p_empresa_id
     GROUP BY c.id
  )
  SELECT 'critico'::text,
         'saldo divergente'::text,
         'O saldo gravado de "' || c.nome || '" não corresponde aos lançamentos. '
           || 'Gravado ' || to_char(c.saldo_atual, 'FM999G999G999D00')
           || ', derivado ' || to_char(COALESCE(c.saldo_inicial,0) + m.movimento, 'FM999G999G999D00') || '.',
         c.saldo_atual - (COALESCE(c.saldo_inicial,0) + m.movimento),
         c.id::text
    FROM public.financeiro_contas c
    JOIN mov m ON m.conta_id = c.id
   WHERE abs(c.saldo_atual - (COALESCE(c.saldo_inicial,0) + m.movimento)) > 0.005

  UNION ALL

  -- ── 2. Conta com saldo negativo ───────────────────────────────────────────
  -- Conta corrente pode ficar negativa (cheque especial). Aplicação e caixa,
  -- não: é sempre saldo de abertura faltando ou lançamento com sentido trocado.
  SELECT (CASE WHEN c.nome ILIKE '%aplica%' OR c.nome ILIKE '%caix%' THEN 'critico' ELSE 'atencao' END)::text,
         'saldo negativo'::text,
         'A conta "' || c.nome || '" está com saldo negativo. '
           || CASE WHEN COALESCE(c.saldo_inicial,0) = 0
                   THEN 'O saldo de abertura está zerado — confira se ele foi informado.'
                   ELSE 'Confira se há lançamento com origem ou sentido trocado.' END,
         c.saldo_atual,
         c.id::text
    FROM public.financeiro_contas c
   WHERE c.empresa_id = p_empresa_id
     AND c.ativa
     AND c.saldo_atual < 0

  UNION ALL

  -- ── 3. Transferência de conta que não tinha o dinheiro ────────────────────
  -- O erro de 25/08: oito PIX lançados como saída de uma conta que abriu o ano
  -- com R$ 39,75. A conferência olha o saldo de abertura contra o que saiu.
  SELECT 'atencao'::text,
         'transferência acima do saldo'::text,
         'A conta "' || c.nome || '" registra saídas por transferência muito acima '
           || 'do que recebeu. Confira a conta de origem desses lançamentos.',
         t.saiu - t.entrou,
         c.id::text
    FROM public.financeiro_contas c
    JOIN LATERAL (
      SELECT COALESCE(SUM(l.valor) FILTER (WHERE l.natureza = 'despesa'), 0) AS saiu,
             COALESCE(SUM(l.valor) FILTER (WHERE l.natureza = 'receita'), 0) AS entrou
        FROM public.financeiro_lancamentos l
       WHERE l.conta_id = c.id AND l.tipo = 'transferencia'
    ) t ON true
   WHERE c.empresa_id = p_empresa_id
     AND t.saiu - t.entrou > COALESCE(c.saldo_inicial, 0) + 1000

  UNION ALL

  -- ── 4. Perna de transferência sem par ─────────────────────────────────────
  -- O formato espelhado grava duas linhas por lote. Lote com uma perna só
  -- significa dinheiro saindo de uma conta e não entrando em nenhuma.
  SELECT 'critico'::text,
         'transferência sem par'::text,
         'Lote de transferência com ' || cnt || ' perna(s) em vez de 2. '
           || 'O dinheiro sai de uma conta e não entra em nenhuma.',
         valor_lote,
         lote::text
    FROM (
      SELECT l.origem_lote_id AS lote, count(*) AS cnt, max(l.valor) AS valor_lote
        FROM public.financeiro_lancamentos l
       WHERE l.empresa_id = p_empresa_id
         AND l.tipo = 'transferencia'
         AND l.natureza IN ('despesa','receita')
         AND l.origem_lote_id IS NOT NULL
       GROUP BY l.origem_lote_id
      HAVING count(*) <> 2
    ) pares

  UNION ALL

  -- ── 5. Faturamento declarado × contabilizado ──────────────────────────────
  -- Os dois números que não convergiam. A diferença não é erro por si: parte é
  -- nota a receber com prazo correndo. Vira aviso quando passa de 10%.
  SELECT 'atencao'::text,
         'faturamento não confere'::text,
         'O faturamento declarado em Apuração difere do que os lançamentos somam. '
           || 'Declarado ' || to_char(d.declarado, 'FM999G999G999D00')
           || ', contabilizado ' || to_char(d.contabilizado, 'FM999G999G999D00') || '.',
         d.declarado - d.contabilizado,
         NULL::text
    FROM (
      SELECT
        (SELECT COALESCE(SUM(f.valor_faturamento), 0)
           FROM public.faturamento_mensal f WHERE f.empresa_id = p_empresa_id) AS declarado,
        (SELECT COALESCE(SUM(l.valor), 0)
           FROM public.financeiro_lancamentos l
           JOIN public.financeiro_categorias c ON c.id = l.categoria_id
          WHERE l.empresa_id = p_empresa_id
            AND c.grupo_dre = 'receita_bruta'
            AND l.status IN ('realizado','conciliado')) AS contabilizado
    ) d
   WHERE d.declarado > 0
     AND abs(d.declarado - d.contabilizado) > d.declarado * 0.10

  UNION ALL

  -- ── 6. Regime tributário ausente ──────────────────────────────────────────
  -- Sem regime não há por qual tabela apurar, e o padrão do banco era
  -- 'simples' — foi assim que uma empresa de Lucro Presumido foi apurada pela
  -- tabela do Simples Nacional sem ninguém ter escolhido nada.
  SELECT 'critico'::text,
         'regime não definido'::text,
         'A empresa não tem regime tributário no cadastro. A apuração não pode '
           || 'ser feita, e qualquer padrão adotado seria decidir no lugar de alguém.',
         NULL::numeric,
         e.id::text
    FROM public.empresas e
   WHERE e.id = p_empresa_id
     AND e.regime_tributario IS NULL

  UNION ALL

  -- ── 7. Lançamento com data implausível ────────────────────────────────────
  SELECT 'atencao'::text,
         'data implausível'::text,
         count(*) || ' lançamento(s) com vencimento a mais de 15 anos da competência. '
           || 'Provável ano digitado errado.',
         SUM(l.valor),
         NULL::text
    FROM public.financeiro_lancamentos l
   WHERE l.empresa_id = p_empresa_id
     AND l.data_vencimento IS NOT NULL
     AND l.data_competencia IS NOT NULL
     AND l.data_vencimento > l.data_competencia + interval '15 years'
  HAVING count(*) > 0

  UNION ALL

  -- ── 8. Lançamento sem categoria ───────────────────────────────────────────
  -- Percentual apurado sobre lançamento sem categoria é palpite com cara de
  -- número. A cobertura entra como informativo enquanto for pequena.
  SELECT (CASE WHEN SUM(l.valor) > 50000 THEN 'atencao' ELSE 'informativo' END)::text,
         'sem classificação'::text,
         count(*) || ' lançamento(s) realizado(s) sem categoria. '
           || 'Eles ficam fora do DRE e dos indicadores gerenciais.',
         SUM(l.valor),
         NULL::text
    FROM public.financeiro_lancamentos l
   WHERE l.empresa_id = p_empresa_id
     AND l.categoria_id IS NULL
     AND l.status IN ('realizado','conciliado')
     AND l.tipo IN ('a_receber','a_pagar')
  HAVING count(*) > 0

  UNION ALL

  -- ── 9. O gatilho que mantém o saldo derivado está ativo? ──────────────────
  -- Sem ele, saldo_atual congela no último recálculo manual e passa a mentir
  -- em silêncio. É a única checagem aqui que não olha dado, e sim o motor.
  SELECT 'critico'::text,
         'gatilho do saldo inativo'::text,
         'O gatilho trg_saldo_lancamento não está ativo em financeiro_lancamentos. '
           || 'Sem ele, o saldo das contas para de acompanhar os lançamentos: '
           || 'continua exibido, com a mesma aparência, apenas parado no tempo. '
           || 'Reinstale antes de confiar em qualquer saldo desta tela.',
         NULL::numeric,
         NULL::text
   WHERE NOT EXISTS (
     SELECT 1
       FROM pg_trigger t
       JOIN pg_class cl     ON cl.oid = t.tgrelid
       JOIN pg_namespace ns ON ns.oid = cl.relnamespace
      WHERE ns.nspname = 'public'
        AND cl.relname = 'financeiro_lancamentos'
        AND t.tgname   = 'trg_saldo_lancamento'
        AND NOT t.tgisinternal
        AND t.tgenabled = 'O'   -- 'O' = ativo; 'D' = desabilitado
   )

  UNION ALL

  -- ── 10. Nota fiscal lançada sem o documento guardado ──────────────────────
  -- O XML da NF-e É o documento fiscal; o DANFE é a representação impressa
  -- dele. Guardar só os campos extraídos não cumpre o prazo decadencial de
  -- cinco anos, e deixa sem prova quem precisar responder a questionamento do
  -- órgão ou pedir reequilíbrio.
  --
  -- Só conta lançamento nascido a partir de 2026-08-25: cobrar documento do
  -- que foi lançado antes de o arquivamento existir seria cobrar uma
  -- obrigação retroativa que ninguém tinha como cumprir.
  SELECT 'atencao'::text,
         'nota sem documento'::text,
         count(*) || ' lançamento(s) de NF-e/NFS-e sem o arquivo guardado. '
           || 'Os campos foram registrados, o documento não — e é ele que vale '
           || 'como prova e cumpre o prazo de guarda.',
         SUM(l.valor),
         NULL::text
    FROM public.financeiro_lancamentos l
   WHERE l.empresa_id = p_empresa_id
     AND l.tipo_documento IN ('nfe','nfse','nfce')
     AND l.created_at >= DATE '2026-08-25'
     AND NOT EXISTS (
       SELECT 1 FROM public.financeiro_documentos_fiscais d
        WHERE d.lancamento_id = l.id
          AND (d.storage_path IS NOT NULL OR d.arquivo_xml IS NOT NULL)
     )
  HAVING count(*) > 0

  UNION ALL

  -- ── 11. Título que na verdade é transferência entre contas próprias ───────
  -- "INT RESGATE MAPFRERFDI" lançado como conta a receber não é recebimento de
  -- cliente: é dinheiro da empresa voltando do CDB para a conta corrente. Ele
  -- infla o "Total a receber em aberto" e, antes da correção de 25/08, entrava
  -- como faturamento na calculadora de margem.
  --
  -- O achado APONTA e não prescreve: o remédio depende de a transferência
  -- correspondente já existir. Se existe, o título é duplicata e se remove; se
  -- não existe, o título É a transferência e se converte. Converter uma
  -- duplicata criaria uma TERCEIRA contagem.
  SELECT 'atencao'::text,
         'título que é transferência'::text,
         count(*) || ' título(s) a receber/pagar cuja descrição é de movimentação '
           || 'entre contas próprias (resgate, aplicação, transferência). '
           || 'Não são receita nem despesa — são o mesmo dinheiro mudando de conta.',
         SUM(l.valor),
         NULL::text
    FROM public.financeiro_lancamentos l
   WHERE l.empresa_id = p_empresa_id
     AND l.tipo IN ('a_receber','a_pagar')
     AND l.status <> 'cancelado'
     AND (
          lower(public.unaccent_imutavel(l.descricao)) LIKE '%resgate%'
       OR lower(public.unaccent_imutavel(l.descricao)) LIKE '%aplicacao%'
       OR lower(public.unaccent_imutavel(l.descricao)) LIKE '%transferencia entre%'
       OR lower(public.unaccent_imutavel(l.descricao)) LIKE '%transf propria%'
       OR lower(public.unaccent_imutavel(l.descricao)) LIKE '%entre contas%'
       OR lower(public.unaccent_imutavel(l.descricao)) LIKE '%mesma titularidade%'
     )
  HAVING count(*) > 0

$$;

COMMENT ON FUNCTION public.financeiro_conferencia(uuid) IS
  'Refaz as derivações do Financeiro e devolve o que não fecha: saldo que não '
  'corresponde aos lançamentos, conta negativa, transferência sem par ou acima '
  'do saldo, faturamento divergente, regime ausente, data implausível, '
  'lançamento sem categoria. Não corrige nada — corrigir dinheiro é decisão de '
  'gente. Ela só se recusa a ficar calada.';

GRANT EXECUTE ON FUNCTION public.financeiro_conferencia(uuid) TO authenticated;

-- Uso:
--   SELECT * FROM public.financeiro_conferencia(
--     (SELECT id FROM public.empresas WHERE razao_social ILIKE 'ETHOS%')
--   ) ORDER BY CASE severidade WHEN 'critico' THEN 1 WHEN 'atencao' THEN 2 ELSE 3 END;
```

## 20260827000001 — Sincronizar saldos conferia pertencimento onde ele não mora

A função checava `empresas.user_id` e `empresas.membros`. Nenhuma das duas existe: a
tabela tem `created_by`, e o pertencimento mora em `empresa_membros` — que é o que
`is_empresa_member` consulta e o resto do sistema usa.

Ela levantava `column e.user_id does not exist` em toda chamada, para todo usuário,
desde 30/04. **O botão nunca funcionou uma vez.**

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- "Sincronizar saldos" falhava por conferir pertencimento onde ele não mora
-- ═══════════════════════════════════════════════════════════════════════════
--
-- A função checava o vínculo do usuário com a empresa assim:
--
--     WHERE e.id = p_empresa_id
--       AND (e.user_id = v_uid
--            OR EXISTS (SELECT 1 FROM jsonb_array_elements(e.membros) m
--                        WHERE (m->>'user_id')::uuid = v_uid))
--
-- `empresas` não tem `user_id` nem `membros`. Tem `created_by`, e o
-- pertencimento mora em `empresa_membros` — que é exatamente o que
-- `public.is_empresa_member` consulta, e o que todo o resto do sistema usa
-- (CLAUDE.md, princípio 2).
--
-- O resultado é que a função levantava `column e.user_id does not exist` em
-- TODA chamada, para todo usuário, desde que foi criada em 30/04. O botão
-- nunca funcionou uma vez.
--
-- E o erro não chegava a quem clicava. A tela faz
-- `e instanceof Error ? e.message : "Falha ao sincronizar saldos."`, e o erro
-- do Supabase é um `PostgrestError` — um objeto simples, não um `Error`. A
-- causa exata existia, vinha pela rede, e era descartada na última linha antes
-- de virar texto na tela.
--
-- ── O que a função faz, para quem for ler depois ────────────────────────────
-- Ela zera a defasagem SÓ das contas que não têm lançamento nenhum: saldo
-- gravado diferente do saldo de abertura, sem movimento que o justifique, é
-- resíduo. Conta com lançamento não é tocada aqui — para essa existe
-- `financeiro_recalcular_saldo_conta`, que deriva o saldo do movimento.

CREATE OR REPLACE FUNCTION public.sincronizar_saldos_contas_sem_movimento(p_empresa_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;
  IF p_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Empresa não informada.';
  END IF;

  -- O vínculo é lido de onde ele mora. `is_empresa_member` consulta
  -- `empresa_membros`, e é a mesma autoridade que as políticas de RLS usam —
  -- duas leituras diferentes do mesmo conceito é como se erra duas vezes.
  IF NOT public.is_empresa_member(v_uid, p_empresa_id) THEN
    RAISE EXCEPTION 'Acesso negado à empresa informada.';
  END IF;

  WITH alvos AS (
    SELECT c.id
    FROM public.financeiro_contas c
    WHERE c.empresa_id = p_empresa_id
      AND COALESCE(c.ativa, true) = true
      AND COALESCE(c.saldo_atual, 0) <> COALESCE(c.saldo_inicial, 0)
      AND NOT EXISTS (
        SELECT 1 FROM public.financeiro_lancamentos l
        WHERE l.conta_id = c.id OR l.conta_destino_id = c.id
      )
  )
  UPDATE public.financeiro_contas c
     SET saldo_atual = COALESCE(c.saldo_inicial, 0),
         updated_at  = now()
    FROM alvos
   WHERE c.id = alvos.id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sincronizar_saldos_contas_sem_movimento(uuid) TO authenticated;

COMMENT ON FUNCTION public.sincronizar_saldos_contas_sem_movimento(uuid) IS
  'Zera a defasagem das contas SEM lançamento nenhum — saldo gravado diferente '
  'do de abertura, sem movimento que o justifique, é resíduo. Conta com '
  'lançamento não é tocada: para essa, quem manda é '
  'financeiro_recalcular_saldo_conta. O vínculo do usuário é lido por '
  'is_empresa_member; a versão de 30/04 procurava em empresas.user_id e '
  'empresas.membros, colunas que não existem, e por isso falhava em toda '
  'chamada desde que nasceu.';

-- ── Conferência ─────────────────────────────────────────────────────────────
-- Quais contas seriam ajustadas (rode antes, se quiser ver):
--   SELECT c.nome, c.saldo_inicial, c.saldo_atual
--     FROM public.financeiro_contas c
--     JOIN public.empresas e ON e.id = c.empresa_id
--    WHERE e.razao_social ILIKE 'ETHOS%'
--      AND COALESCE(c.ativa, true)
--      AND COALESCE(c.saldo_atual,0) <> COALESCE(c.saldo_inicial,0)
--      AND NOT EXISTS (SELECT 1 FROM public.financeiro_lancamentos l
--                       WHERE l.conta_id = c.id OR l.conta_destino_id = c.id);
```

## 20260827000002 — Movimento de extrato sem direção não pode virar entrada

Defeito meu, de 25/08. A fórmula do saldo fazia `CASE WHEN natureza = 'despesa' THEN -valor
ELSE valor END` — assumindo que `natureza` é `receita` **ou** `despesa`. O enum tem **três**
valores, e o terceiro (`movimentacao`) caía no `ELSE` e virava entrada.

No Banpará PJ do GRUPO SANTA ROSA: dois `PAGTO PIX EXTERNO` de R$ 9.874,99 e R$ 14.578,56,
somando R$ 24.453,55. Saldo gravado R$ 50.821,99 contra R$ 1.914,89 no banco — diferença de
R$ 48.907,10, **exatamente o dobro**. Dobro é a assinatura de sinal invertido.

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Movimento de extrato sem direção declarada não pode virar entrada
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Defeito meu, introduzido em 25/08 na 20260825000002 e agravado na
-- 20260825000006. A fórmula do saldo fazia:
--
--     WHEN tipo = 'movimento_bancario' ... THEN
--       CASE WHEN natureza = 'despesa' THEN -valor ELSE valor END
--
-- Ela assume que `natureza` é `receita` OU `despesa`. Mas o enum
-- `financeiro_natureza` tem TRÊS valores, e o terceiro — `movimentacao` — caía
-- no ELSE e virava entrada.
--
-- ── O que isso custou, em número fechado ────────────────────────────────────
-- No Banpará PJ do GRUPO SANTA ROSA há dois lançamentos "PAGTO PIX EXTERNO"
-- com natureza `movimentacao`: R$ 9.874,99 e R$ 14.578,56, somando
-- R$ 24.453,55. São pagamentos — saída, sem ambiguidade.
--
--   saldo gravado    R$ 50.821,99
--   saldo no banco   R$  1.914,89
--   diferença        R$ 48.907,10  =  2 × 24.453,55
--
-- O dobro é a assinatura de sinal invertido: somar +X onde deveria −X erra
-- por 2X. E a tela de Lançamentos usava a régua oposta (`natureza <> 'receita'`
-- → saída), então os cartões mostravam o resultado certo enquanto o saldo
-- mostrava o errado. Duas leituras do mesmo campo, com sinais contrários — o
-- defeito que esta semana inteira se dedicou a remover, e que eu reintroduzi.
--
-- ── A regra nova ────────────────────────────────────────────────────────────
-- A fórmula deixa de adivinhar. Movimento de extrato só entra no saldo quando
-- a natureza diz a direção; `movimentacao` não diz, então NÃO CONTA e a
-- conferência acusa. Contar errado é pior do que não contar: o saldo errado
-- parece resposta, e o saldo incompleto pede conferência.

CREATE OR REPLACE FUNCTION public.financeiro_recalcular_saldo_conta(p_conta_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saldo_inicial numeric(15,2);
  v_movimento numeric(15,2);
BEGIN
  SELECT saldo_inicial INTO v_saldo_inicial FROM public.financeiro_contas WHERE id = p_conta_id;

  SELECT COALESCE(SUM(
    CASE
      -- Perna de transferência espelhada: a natureza diz o lado, e ela só age
      -- na própria conta_id. A outra perna cuida da outra conta.
      WHEN tipo = 'transferencia' AND natureza IN ('despesa','receita') THEN
        CASE WHEN conta_id = p_conta_id
             THEN CASE WHEN natureza = 'despesa' THEN -valor ELSE valor END
             ELSE 0 END

      -- Transferência de linha única: sai da origem, entra no destino.
      WHEN tipo = 'transferencia' AND conta_id = p_conta_id         THEN -valor
      WHEN tipo = 'transferencia' AND conta_destino_id = p_conta_id THEN  valor

      -- Daqui para baixo, só conta o que é DESTA conta.
      WHEN conta_id IS DISTINCT FROM p_conta_id THEN 0

      WHEN tipo = 'a_receber' AND status IN ('realizado','conciliado') THEN  valor
      WHEN tipo = 'a_pagar'   AND status IN ('realizado','conciliado') THEN -valor

      -- Movimento de extrato: a natureza tem de dizer a direção. `receita`
      -- entra, `despesa` sai, e `movimentacao` NÃO CONTA — porque não diz nada,
      -- e somar por omissão foi o que produziu R$ 48.907,10 de saldo
      -- inexistente numa conta só. A conferência acusa os que ficarem de fora.
      WHEN tipo = 'movimento_bancario' AND status IS DISTINCT FROM 'cancelado' THEN
        CASE natureza
          WHEN 'receita' THEN  valor
          WHEN 'despesa' THEN -valor
          ELSE 0
        END

      ELSE 0
    END
  ), 0) INTO v_movimento
  FROM public.financeiro_lancamentos
  WHERE conta_id = p_conta_id OR conta_destino_id = p_conta_id;

  UPDATE public.financeiro_contas
  SET saldo_atual = COALESCE(v_saldo_inicial,0) + COALESCE(v_movimento,0), updated_at = now()
  WHERE id = p_conta_id;
END;
$$;

COMMENT ON FUNCTION public.financeiro_recalcular_saldo_conta(uuid) IS
  'saldo_atual = saldo_inicial + movimentos desta conta. Movimento de extrato '
  'só entra quando a natureza diz a direção: receita entra, despesa sai, '
  'movimentacao NÃO conta — somar por omissão produziu R$ 48.907,10 de saldo '
  'inexistente numa conta em 2026-08. Transferência vem em dois formatos: '
  'perna espelhada (age só na própria conta_id) e linha única (sai da origem, '
  'entra no destino).';

-- ── A invariante, para não voltar ───────────────────────────────────────────
-- Movimento de extrato é sempre entrada ou saída — o banco não tem terceira
-- opção. Quem grava sem direção está gravando dado incompleto, e o lugar de
-- barrar isso é a entrada, não o relatório.
--
-- NOT VALID: as linhas que já existem continuam, para a migration não travar
-- em dado torto. O roteiro de correção está no fim.
ALTER TABLE public.financeiro_lancamentos
  DROP CONSTRAINT IF EXISTS chk_movimento_bancario_tem_direcao;
ALTER TABLE public.financeiro_lancamentos
  ADD CONSTRAINT chk_movimento_bancario_tem_direcao
  CHECK (tipo <> 'movimento_bancario' OR natureza IN ('receita','despesa')) NOT VALID;

COMMENT ON CONSTRAINT chk_movimento_bancario_tem_direcao ON public.financeiro_lancamentos IS
  'Movimento de extrato precisa dizer se entrou ou saiu. Com natureza '
  '`movimentacao` ele não diz, e a fórmula do saldo o somava por omissão.';

-- Recalcula todas as contas com a fórmula corrigida.
SELECT public.financeiro_recalcular_saldo_conta(id) FROM public.financeiro_contas;

-- ── Roteiro ─────────────────────────────────────────────────────────────────
--
-- 1. Quem está sem direção, em todas as empresas:
--
--    SELECT e.razao_social, c.nome AS conta, l.data_competencia, l.descricao,
--           l.valor, l.origem
--      FROM public.financeiro_lancamentos l
--      JOIN public.financeiro_contas c ON c.id = l.conta_id
--      JOIN public.empresas e ON e.id = c.empresa_id
--     WHERE l.tipo = 'movimento_bancario'
--       AND l.natureza NOT IN ('receita','despesa')
--     ORDER BY e.razao_social, l.data_competencia;
--
-- 2. Corrigido o sentido de cada um (só quem conhece o extrato pode dizer),
--    valide a restrição:
--
--    ALTER TABLE public.financeiro_lancamentos
--      VALIDATE CONSTRAINT chk_movimento_bancario_tem_direcao;
```

## 20260827000003 — O saldo do extrato é a verdade que vem de fora

Em 25/08 a conferência deu `diferenca = 0` nas catorze contas da ETHOS e eu apresentei isso
como prova. **Não era.** Ela compara o saldo gravado com uma re-derivação pela **mesma**
fórmula: se a fórmula erra, os dois lados erram igual e a diferença dá zero. Ela detecta
deriva entre gravado e derivado — não detecta erro **na** derivação.

O que pegou os R$ 48.907,10 foi o dono do produto dizer o saldo real do banco. Todo OFX traz
`<LEDGERBAL><BALAMT>` — o parser lia e descartava. Agora fica, e `financeiro_confronto_com_extrato`
compara o calculado com o declarado pelo banco.

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- O saldo que o banco declara — a única verdade que vem de fora
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Em 25/08 a conferência disse `diferenca = 0` nas catorze contas da ETHOS, e
-- eu apresentei isso como prova de que o saldo estava certo. Não era.
--
-- A conferência compara o `saldo_atual` gravado com uma re-derivação que usa a
-- MESMA fórmula. Se a fórmula está errada, os dois lados erram igual e a
-- diferença dá zero. Ela detecta DERIVA entre o gravado e o derivado; não
-- detecta erro NA derivação.
--
-- O que pegou o defeito do sinal — R$ 48.907,10 de saldo inexistente numa
-- conta só — não foi o sistema. Foi o dono do produto dizer "o saldo real na
-- conta bancária é R$ 1.914,89". Só o extrato, que é externo, poderia
-- contradizer a fórmula.
--
-- ── O dado já chegava, e era descartado ─────────────────────────────────────
-- Todo OFX traz `<LEDGERBAL><BALAMT>` — o saldo que o banco declara na data de
-- corte. O parser do front lê (`finalBalance`), e ninguém guarda. A verdade
-- externa entrava no sistema a cada importação e era jogada fora na linha
-- seguinte.
--
-- Aqui ela passa a ficar. E a conferência ganha a única checagem que não olha
-- o próprio umbigo: saldo calculado contra saldo declarado pelo banco.

ALTER TABLE public.financeiro_extratos_importados
  ADD COLUMN IF NOT EXISTS saldo_final     numeric(15,2),
  ADD COLUMN IF NOT EXISTS saldo_final_em  date;

COMMENT ON COLUMN public.financeiro_extratos_importados.saldo_final IS
  'O saldo que o BANCO declara no extrato (OFX: LEDGERBAL/BALAMT). É a única '
  'referência externa que o Financeiro tem — tudo o mais é o sistema '
  'conferindo a si mesmo. Nulo em extrato que não traga o campo.';

COMMENT ON COLUMN public.financeiro_extratos_importados.saldo_final_em IS
  'Data de corte do saldo declarado (OFX: LEDGERBAL/DTASOF). Sem ela o saldo '
  'não pode ser comparado, porque não se sabe a que momento ele se refere.';

-- ── A checagem contra a verdade de fora ─────────────────────────────────────
--
-- Devolve, por conta, o saldo declarado no extrato mais recente e o saldo que
-- o sistema calcula. Só compara quando o extrato é o ÚLTIMO e não há
-- lançamento posterior à data de corte — comparar com movimento pelo meio
-- acusaria divergência onde há apenas o tempo passando.
CREATE OR REPLACE FUNCTION public.financeiro_confronto_com_extrato(p_empresa_id uuid)
RETURNS TABLE (
  conta_id          uuid,
  conta             text,
  saldo_declarado   numeric,
  saldo_calculado   numeric,
  diferenca         numeric,
  data_corte        date,
  lancamentos_apos  integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH ultimo AS (
    SELECT DISTINCT ON (x.conta_id)
           x.conta_id, x.saldo_final, x.saldo_final_em
      FROM public.financeiro_extratos_importados x
     WHERE x.empresa_id = p_empresa_id
       AND x.saldo_final IS NOT NULL
       AND x.saldo_final_em IS NOT NULL
     ORDER BY x.conta_id, x.saldo_final_em DESC
  )
  SELECT c.id,
         c.nome,
         u.saldo_final,
         c.saldo_atual,
         c.saldo_atual - u.saldo_final,
         u.saldo_final_em,
         (SELECT count(*)::int
            FROM public.financeiro_lancamentos l
           WHERE (l.conta_id = c.id OR l.conta_destino_id = c.id)
             AND l.data_competencia > u.saldo_final_em)
    FROM public.financeiro_contas c
    JOIN ultimo u ON u.conta_id = c.id
   WHERE c.empresa_id = p_empresa_id;
$$;

COMMENT ON FUNCTION public.financeiro_confronto_com_extrato(uuid) IS
  'Confronta o saldo calculado com o saldo que o BANCO declarou no último '
  'extrato importado. É a única checagem do Financeiro que não usa a própria '
  'fórmula dos dois lados — e por isso a única capaz de acusar um erro NA '
  'fórmula. `lancamentos_apos` diz quantos lançamentos existem depois da data '
  'de corte: havendo algum, a diferença é esperada e não indica defeito.';

GRANT EXECUTE ON FUNCTION public.financeiro_confronto_com_extrato(uuid) TO authenticated;

-- ── Conferência ─────────────────────────────────────────────────────────────
--   SELECT * FROM public.financeiro_confronto_com_extrato(
--     (SELECT id FROM public.empresas WHERE razao_social ILIKE 'SANTA ROSA%'));
--
-- Enquanto nenhum extrato novo for importado, o resultado vem vazio: a coluna
-- `saldo_final` só se preenche na próxima importação de OFX.
```

## 20260827000004 — Metas do Comercial em tempo real

A tela tinha só `invalidateQueries`: ao salvar um valor-alvo, o cache era refeito **na sessão
de quem salvou**. O vendedor com a página aberta continuava vendo o alvo antigo até recarregar.

Numa tela que anuncia "Risco crítico — 0% da meta com 2 dias úteis restantes", o número que
decide se alguém corre atrás de proposta hoje pode ter mudado há uma hora.

Precisa ser migration porque o canal `postgres_changes` só recebe eventos de tabelas na
publicação `supabase_realtime`. Sem isso o `subscribe()` conecta, não dá erro, e nunca dispara.

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Metas do Comercial: a alteração do administrador chega a quem está olhando
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Até aqui a tela tinha apenas `invalidateQueries`: ao salvar um valor-alvo, o
-- cache era refeito NA SESSÃO DE QUEM SALVOU. O vendedor com a página aberta
-- continuava vendo o alvo antigo até recarregar — e nada ali sugeria que
-- devesse.
--
-- Numa tela que anuncia "Risco crítico — 0% da meta com 2 dias úteis
-- restantes", isso não é detalhe de conforto: o número que decide se alguém
-- corre atrás de proposta hoje pode ter mudado há uma hora.
--
-- ── Por que isto é migration, e não só código ───────────────────────────────
-- O canal do cliente (`postgres_changes`) só recebe eventos de tabelas que
-- estão na publicação `supabase_realtime`. Sem esta linha, o `subscribe()` do
-- front conecta, não dá erro nenhum, e nunca dispara — o pior tipo de falha:
-- a que parece estar funcionando.

DO $$
BEGIN
  -- `ADD TABLE` é erro se a tabela já estiver na publicação, e este arquivo
  -- precisa poder ser colado de novo sem quebrar.
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public' AND tablename = 'comercial_valores_alvo'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.comercial_valores_alvo;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public' AND tablename = 'comercial_metas_config'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.comercial_metas_config;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public' AND tablename = 'comercial_metas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.comercial_metas;
  END IF;
END $$;

-- `REPLICA IDENTITY FULL` faz o evento carregar a linha ANTIGA além da nova.
-- Sem isso, um UPDATE chega sem os valores anteriores e o filtro por
-- `empresa_id` não se aplica a eles — uma alteração que MUDE de empresa
-- escaparia do canal de quem deveria ser notificado.
ALTER TABLE public.comercial_valores_alvo REPLICA IDENTITY FULL;
ALTER TABLE public.comercial_metas_config REPLICA IDENTITY FULL;
ALTER TABLE public.comercial_metas        REPLICA IDENTITY FULL;

-- ── Conferência ─────────────────────────────────────────────────────────────
-- As três precisam aparecer aqui, senão o canal do front nunca dispara.
--   SELECT schemaname, tablename
--     FROM pg_publication_tables
--    WHERE pubname = 'supabase_realtime'
--      AND tablename LIKE 'comercial_%'
--    ORDER BY tablename;
```

## 20260827000005 — A meta olha as três pontas da esteira

`comercial_metas` guardava **um** valor em reais e uma **escolha** de contra o quê
compará-lo. Mas contratos ganhos, faturamento e NF-e quitada não são três formas de medir
a mesma coisa — são três **momentos** do mesmo dinheiro:

```
contrato ganho  →  o negócio fechou   (valor assinado)
faturamento     →  a nota saiu        (pedido faturado)
NF-e quitada    →  o dinheiro entrou  (valor recebido)
```

Olhar um ponto só esconde onde a esteira travou. Contratos em dia com quitação zerada é ter
fechado e não entregado — e o painel mostrava isso como meta batida.

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- A meta passa a olhar as três pontas da esteira, não uma de cada vez
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `comercial_metas` guardava UM valor em reais (`meta_faturamento`) e uma
-- ESCOLHA (`base_meta`) de contra o quê compará-lo: contratos ganhos,
-- faturamento ou NF-e quitada.
--
-- Só que essas três não são formas diferentes de medir a mesma coisa. São três
-- MOMENTOS do mesmo dinheiro:
--
--   contrato ganho  →  o negócio fechou   (valor assinado)
--   faturamento     →  a nota saiu        (pedido faturado)
--   NF-e quitada    →  o dinheiro entrou  (valor recebido)
--
-- Um contrato assinado em março vira faturamento em maio e quitação em julho.
-- Escolher uma base é escolher em que ponto da esteira olhar — e olhar um
-- ponto só esconde onde ela travou.
--
-- Um vendedor pode estar com contratos em dia e quitação a zero: fechou
-- negócio, não entregou. Outro pode ter faturamento alto e quitação baixa:
-- entregou, não recebeu. Com uma base só, o painel mostra um desses como
-- "meta batida" e o outro como "risco crítico" — dependendo apenas de qual
-- base o administrador escolheu, não do que aconteceu.
--
-- ── O que muda ──────────────────────────────────────────────────────────────
-- Entra `meta_quitacao`. `meta_faturamento` e `meta_contratos` já existiam —
-- a segunda, aliás, existia e NUNCA foi exibida no painel.
--
-- `base_meta` não some: passa a significar META PRINCIPAL — a que dispara o
-- alerta de risco e alimenta a projeção de fechamento. As outras duas ficam
-- visíveis como acompanhamento. Assim quem já usa não vê comportamento mudar,
-- e ganha as outras duas de graça.

ALTER TABLE public.comercial_metas
  ADD COLUMN IF NOT EXISTS meta_quitacao numeric(14,2);

COMMENT ON COLUMN public.comercial_metas.meta_faturamento IS
  'Meta de faturamento do mês, em reais — soma dos pedidos faturados '
  '(contrato_pedidos.data_pedido). É a ponta do meio da esteira: a nota saiu, '
  'o dinheiro ainda não entrou.';

COMMENT ON COLUMN public.comercial_metas.meta_quitacao IS
  'Meta de NF-e quitada do mês, em reais — soma dos pedidos com data_quitacao. '
  'É a última ponta da esteira, a única que representa dinheiro em caixa. '
  'Nula significa que não foi definida, não que é zero.';

COMMENT ON COLUMN public.comercial_metas.meta_contratos IS
  'Meta de contratos ganhos no mês, em quantidade. Primeira ponta da esteira: '
  'o negócio fechou, e vira faturamento nos meses seguintes. Existia desde o '
  'início e nunca foi exibida no painel.';

COMMENT ON COLUMN public.comercial_metas.meta_participacoes IS
  'Meta de propostas enviadas no mês, em quantidade. É o ANTES da esteira — '
  'o esforço que produz os contratos.';

COMMENT ON COLUMN public.comercial_metas.base_meta IS
  'A meta PRINCIPAL: qual das três dispara o alerta de risco e alimenta a '
  'projeção de fechamento. Valores: contratos_ganhos, faturamento, nf_quitada. '
  'As outras duas continuam medidas e exibidas — a principal é a que manda no '
  'alarme, para o painel não gritar três vezes pelo mesmo mês.';

-- ── Coerência: a meta principal precisa ter valor ───────────────────────────
-- Eleger como principal uma meta que ninguém definiu produz alerta sobre o
-- nada — "0% de uma meta de R$ 0,00" — que é pior do que não alertar.
ALTER TABLE public.comercial_metas
  DROP CONSTRAINT IF EXISTS chk_meta_principal_tem_valor;
ALTER TABLE public.comercial_metas
  ADD CONSTRAINT chk_meta_principal_tem_valor
  CHECK (
    (base_meta = 'faturamento'      AND COALESCE(meta_faturamento, 0) > 0)
    OR (base_meta = 'nf_quitada'      AND COALESCE(meta_quitacao, 0) > 0)
    OR (base_meta = 'contratos_ganhos' AND COALESCE(meta_contratos, 0) > 0)
  ) NOT VALID;

COMMENT ON CONSTRAINT chk_meta_principal_tem_valor ON public.comercial_metas IS
  'A meta eleita como principal precisa ter valor. Sem isto, o painel alerta '
  'sobre "0% de uma meta de R$ 0,00" — barulho que ensina a ignorar o alarme.';

-- ── Migração do que já existe ───────────────────────────────────────────────
-- Quem tinha `base_meta = nf_quitada` guardava o alvo em `meta_faturamento`,
-- porque era a única coluna de valor. Esse número é meta de QUITAÇÃO, e é para
-- lá que ele vai. `meta_faturamento` fica com o mesmo valor: sem outra
-- informação, faturar o que se pretende receber é a leitura conservadora — e o
-- administrador ajusta quando abrir a tela.
UPDATE public.comercial_metas
   SET meta_quitacao = meta_faturamento
 WHERE base_meta = 'nf_quitada'
   AND meta_quitacao IS NULL;

-- ── Conferência ─────────────────────────────────────────────────────────────
--   SELECT base_meta, count(*),
--          count(meta_faturamento) AS com_faturamento,
--          count(meta_quitacao)    AS com_quitacao,
--          count(meta_contratos)   AS com_contratos
--     FROM public.comercial_metas GROUP BY 1 ORDER BY 1;
--
-- Depois de as três estarem preenchidas onde precisam:
--   ALTER TABLE public.comercial_metas VALIDATE CONSTRAINT chk_meta_principal_tem_valor;
```

## 20260828000001 — Categoria sem grupo de DRE herda o grupo da gêmea de mesmo nome

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Categoria sem grupo de DRE herda o grupo da gêmea de mesmo nome
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `financeiro_categorias` tem 603 linhas e 445 delas estão com `grupo_dre`
-- NULL — 73,8%. Não é caso raro: é a regra. O plano de contas foi classificado
-- para uma empresa e replicado sem a classificação para as outras, então
-- "13º Salário" existe como `desp_operacional` num lugar e como NULL em vários
-- outros. O nome é o mesmo; o grupo, não.
--
-- Enquanto o `grupo_dre` é NULL, o lançamento cai num balaio "outros" que o
-- DRE não sabe onde somar. Até 27/08/2026 havia um atalho no cálculo que
-- varria esse balaio para dentro de Receita Bruta ou Despesas Operacionais
-- conforme a natureza — e era ele que fazia o relatório parecer completo
-- exatamente onde estava mais incompleto. O atalho saiu. Sem ele, o que não
-- tem grupo aparece na tela como "Fora do resultado", que é honesto mas não
-- resolve.
--
-- ── Por que herdar pelo nome é seguro ───────────────────────────────────────
-- `grupo_dre` classifica o que a categoria SIGNIFICA na estrutura do
-- resultado, não uma política de quem a usa. "Aluguel" é despesa operacional
-- em qualquer empresa; não há decisão do assinante embutida nisso.
--
-- E a base confirma que não há ambiguidade. Esta consulta devolveu ZERO linhas
-- em 28/08/2026 — nenhum nome carrega dois grupos diferentes:
--
--   SELECT lower(btrim(nome)), array_agg(DISTINCT grupo_dre)
--     FROM public.financeiro_categorias WHERE grupo_dre IS NOT NULL
--    GROUP BY 1 HAVING count(DISTINCT grupo_dre) > 1;
--
-- ── O que este arquivo NÃO faz ──────────────────────────────────────────────
-- Só preenche NULL. Nunca sobrescreve grupo já gravado — quem classificou à
-- mão continua mandando.
--
-- E alcança 191 das 445. As outras 254 (186 nomes distintos) não têm gêmea
-- classificada em lugar nenhum, e para elas não existe resposta derivável:
-- inventar um grupo seria pior do que deixar em branco, porque um número
-- errado dentro do resultado não se distingue de um certo. Elas continuam
-- aparecendo em "Fora do resultado" até alguém classificá-las. O roteiro para
-- descobrir QUAIS importam está no fim.

UPDATE public.financeiro_categorias AS destino
   SET grupo_dre = fonte.grupo_dre
  FROM (
    SELECT DISTINCT lower(btrim(nome)) AS chave, grupo_dre
      FROM public.financeiro_categorias
     WHERE grupo_dre IS NOT NULL
  ) AS fonte
 WHERE destino.grupo_dre IS NULL
   AND lower(btrim(destino.nome)) = fonte.chave;

-- O DRE lê de uma materialized view: sem o refresh, a classificação nova só
-- apareceria no próximo agendamento.
REFRESH MATERIALIZED VIEW public.mv_financeiro_dre_mensal;

-- ── Conferência ─────────────────────────────────────────────────────────────
--
-- 1. Quanto sobrou sem grupo (o esperado é 254):
--
--    SELECT count(*) FILTER (WHERE grupo_dre IS NULL) AS sem_grupo,
--           count(*) FILTER (WHERE grupo_dre IS NOT NULL) AS com_grupo
--      FROM public.financeiro_categorias;
--
-- 2. Os nomes que sobraram, ordenados pelo que de fato movimenta dinheiro.
--    Classificar os 186 na mão é trabalho inútil: a maioria não tem
--    lançamento nenhum. Esta lista diz por onde começar.
--
--    SELECT c.nome, count(l.id) AS lancamentos, COALESCE(SUM(l.valor), 0) AS total
--      FROM public.financeiro_categorias c
--      LEFT JOIN public.financeiro_lancamentos l
--             ON l.categoria_id = c.id
--            AND l.status IN ('realizado','conciliado')
--     WHERE c.grupo_dre IS NULL
--     GROUP BY c.nome
--    HAVING count(l.id) > 0
--     ORDER BY total DESC;
--
-- 3. O que ainda fica fora do resultado, por competência:
--
--    SELECT competencia, natureza, count(*), SUM(total)
--      FROM public.mv_financeiro_dre_mensal
--     WHERE grupo_dre IS NULL
--     GROUP BY 1,2 ORDER BY 1 DESC;
```

## 20260829000001 — Classifica as categorias sem grupo que movimentam dinheiro

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Classifica as 15 categorias sem grupo que de fato movimentam dinheiro
-- ═══════════════════════════════════════════════════════════════════════════
--
-- A 20260828000001 herdou o grupo pela gêmea de mesmo nome e resolveu 191 das
-- 445 (conferido: 349 com grupo, 254 sem). Restaram 186 nomes distintos — e
-- classificar 186 à mão seria trabalho jogado fora, porque a esmagadora
-- maioria nunca recebeu um lançamento.
--
-- A consulta por movimento reduziu o problema a **15 nomes**, somando
-- R$ 170.934,06 em 46 lançamentos. É isso que estava caindo em "Fora do
-- resultado" no DRE.
--
-- ── Como cada uma foi classificada ──────────────────────────────────────────
--
-- MOVIMENTAÇÃO (não é resultado — muda o caixa, não o patrimônio de resultado)
--   Distribuição de Lucro aos Sócios   R$ 69.524,58   é destino do lucro, não
--                                                      despesa que o produz
--   Emprestimos e Financiamentos Rec.  R$ 49.770,00   dinheiro que entra com
--   Empréstimos Recebidos              R$ 11.955,58   obrigação de voltar
--   Aporte e Integralização de Capital R$    297,00   sócio pondo dinheiro
--
--   Somadas: R$ 131.547,16 — 77% do total. Estavam inflando receita e despesa
--   ao mesmo tempo pelo antigo atalho por natureza.
--
-- RECEITA BRUTA
--   Vendas de Gêneros Alimentícios     R$ 20.740,00   é o objeto social do
--                                                      Grupo Santa Rosa
-- DEDUÇÕES DA RECEITA
--   Simples Nacional (DAS)             R$  9.136,18   tributo sobre a receita
--                                                      bruta, não despesa
-- DESPESA OPERACIONAL
--   Salários                           R$  3.545,98
--   TLPL E Taxas De Funcionamento      R$  3.271,32
--   Assinaturas De Portais Licitações  R$    947,48   ⚠ ver nota abaixo
--   Assinaturas de Portais Licitações  R$    628,00   ⚠ mesma categoria
--   Certificado Digital                R$    350,00
--   Táxi, Transporte por App           R$     50,00
-- DESPESA FINANCEIRA
--   Tarifas Bancárias                  R$    540,87
-- RECEITA FINANCEIRA
--   Rendimentos de Aplicações          R$      0,07
--
-- ── O que NÃO entra aqui ────────────────────────────────────────────────────
-- "Outras Receitas" (R$ 177,00, 1 lançamento) fica de fora de propósito. O
-- nome não diz se é operacional ou financeira, e um lançamento de R$ 177 não
-- justifica adivinhar. Continua declarada em "Fora do resultado" até alguém
-- que conheça o lançamento decidir — que é exatamente para isso que o painel
-- passou a declarar o que ficou fora.
--
-- ── Nota: duas categorias iguais, com caixa diferente ───────────────────────
-- "Assinaturas De Portais De Licitações" e "Assinaturas de Portais de
-- Licitações" são a MESMA coisa escrita com maiúsculas diferentes, e as duas
-- têm lançamento. Este arquivo casa por `lower(btrim())`, então ambas recebem
-- o grupo — mas o DRE vai continuar exibindo DUAS linhas para a mesma despesa,
-- R$ 947,48 e R$ 628,00 em vez de R$ 1.575,48. Isso é defeito de cadastro, não
-- de classificação, e fundir categoria é operação destrutiva (move lançamento
-- de terceiros): fica registrado aqui, para decisão de quem cadastra.

UPDATE public.financeiro_categorias
   SET grupo_dre = novo.grupo
  FROM (VALUES
    ('distribuição de lucro aos sócios',      'movimentacao'),
    ('emprestimos e financiamentos recebidos','movimentacao'),
    ('empréstimos recebidos',                 'movimentacao'),
    ('aporte e integralização de capital',    'movimentacao'),
    ('vendas de gêneros alimentícios',        'receita_bruta'),
    ('simples nacional (das)',                'deducoes'),
    ('salários',                              'desp_operacional'),
    ('tlpl e taxas de funcionamento',         'desp_operacional'),
    ('assinaturas de portais de licitações',  'desp_operacional'),
    ('certificado digital',                   'desp_operacional'),
    ('táxi, transporte por app',              'desp_operacional'),
    ('tarifas bancárias',                     'desp_financeira'),
    ('rendimentos de aplicações',             'receita_financeira')
  ) AS novo(chave, grupo)
 WHERE grupo_dre IS NULL
   AND lower(btrim(nome)) = novo.chave;

REFRESH MATERIALIZED VIEW public.mv_financeiro_dre_mensal;

-- ── Conferência ─────────────────────────────────────────────────────────────
--
-- 1. O que ainda cai fora do resultado tendo movimento. O esperado é UMA
--    linha: "Outras Receitas", R$ 177,00.
--
--    SELECT c.nome, count(l.id) AS lancamentos, COALESCE(SUM(l.valor), 0) AS total
--      FROM public.financeiro_categorias c
--      LEFT JOIN public.financeiro_lancamentos l
--             ON l.categoria_id = c.id
--            AND l.status IN ('realizado','conciliado')
--     WHERE c.grupo_dre IS NULL
--     GROUP BY c.nome HAVING count(l.id) > 0
--     ORDER BY total DESC;
--
-- 2. O DRE agora fechando por grupo, e não mais por atalho:
--
--    SELECT competencia, grupo_dre, natureza, SUM(total)
--      FROM public.mv_financeiro_dre_mensal
--     WHERE competencia >= date_trunc('month', now()) - interval '3 months'
--     GROUP BY 1,2,3 ORDER BY 1 DESC, 2;
--
-- 3. As duas "Assinaturas" que continuam separadas por causa da caixa:
--
--    SELECT id, empresa_id, nome, grupo_dre
--      FROM public.financeiro_categorias
--     WHERE lower(btrim(nome)) = 'assinaturas de portais de licitações';
```

## 20260829000002 — A conferência vê categoria que não entra no DRE

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- A conferência passa a ver categoria que não entra no DRE
-- ═══════════════════════════════════════════════════════════════════════════
--
-- A verificação 8 já acusava lançamento SEM categoria. Faltava o buraco
-- vizinho, e mais difícil de enxergar: o lançamento TEM categoria, a tela
-- mostra o nome dela, e mesmo assim ele não entra em linha nenhuma do
-- resultado — porque a categoria não está ligada a um grupo do DRE.
--
-- Em 28/08/2026 isso valia 445 das 603 categorias. O que impedia de notar era
-- um atalho no cálculo do DRE: quando não achava o grupo, ele somava tudo que
-- tivesse aquela natureza, e as categorias sem classificação entravam em
-- Receita Bruta ou Despesas Operacionais como se estivessem classificadas.
--
-- O atalho saiu em 27/08. As categorias foram classificadas em 28 e 29 — 191
-- por herança de nome, 13 à mão. Sobrou uma, de R$ 177,00.
--
-- Falta o que impede de voltar. Sem esta verificação, a próxima categoria
-- cadastrada sem grupo repete o ciclo em silêncio, e ninguém descobre até
-- alguém conferir o DRE contra a contabilidade.
--
-- Entra junto a verificação 13: categoria cadastrada duas vezes com caixa
-- diferente. Não erra total nenhum — mas parte a mesma despesa em duas linhas
-- do relatório, e faz quem confere procurar diferença onde não há.
--
-- Este arquivo recria a função inteira; as verificações 1 a 11 seguem iguais.

CREATE OR REPLACE FUNCTION public.financeiro_conferencia(p_empresa_id uuid)
RETURNS TABLE (
  severidade  text,   -- 'critico' | 'atencao' | 'informativo'
  categoria   text,
  descricao   text,
  valor       numeric,
  referencia  text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$

  -- ── 1. O saldo bate com os lançamentos? ───────────────────────────────────
  -- A conferência que provou a correção de 25/08. Enquanto der zero, o saldo é
  -- derivável a qualquer momento; qualquer valor aqui é saldo fóssil voltando.
  WITH mov AS (
    SELECT c.id AS conta_id,
           COALESCE(SUM(
             CASE
               WHEN l.tipo = 'transferencia' AND l.natureza IN ('despesa','receita') THEN
                 CASE WHEN l.conta_id = c.id
                      THEN CASE WHEN l.natureza = 'despesa' THEN -l.valor ELSE l.valor END
                      ELSE 0 END
               WHEN l.tipo = 'transferencia' AND l.conta_id = c.id         THEN -l.valor
               WHEN l.tipo = 'transferencia' AND l.conta_destino_id = c.id THEN  l.valor
               WHEN l.conta_id IS DISTINCT FROM c.id THEN 0
               WHEN l.tipo = 'a_receber' AND l.status IN ('realizado','conciliado') THEN  l.valor
               WHEN l.tipo = 'a_pagar'   AND l.status IN ('realizado','conciliado') THEN -l.valor
               WHEN l.tipo = 'movimento_bancario' AND l.status IS DISTINCT FROM 'cancelado' THEN
                 CASE WHEN l.natureza = 'despesa' THEN -l.valor ELSE l.valor END
               ELSE 0
             END), 0) AS movimento
      FROM public.financeiro_contas c
      LEFT JOIN public.financeiro_lancamentos l
             ON (l.conta_id = c.id OR l.conta_destino_id = c.id)
     WHERE c.empresa_id = p_empresa_id
     GROUP BY c.id
  )
  SELECT 'critico'::text,
         'saldo divergente'::text,
         'O saldo gravado de "' || c.nome || '" não corresponde aos lançamentos. '
           || 'Gravado ' || to_char(c.saldo_atual, 'FM999G999G999D00')
           || ', derivado ' || to_char(COALESCE(c.saldo_inicial,0) + m.movimento, 'FM999G999G999D00') || '.',
         c.saldo_atual - (COALESCE(c.saldo_inicial,0) + m.movimento),
         c.id::text
    FROM public.financeiro_contas c
    JOIN mov m ON m.conta_id = c.id
   WHERE abs(c.saldo_atual - (COALESCE(c.saldo_inicial,0) + m.movimento)) > 0.005

  UNION ALL

  -- ── 2. Conta com saldo negativo ───────────────────────────────────────────
  -- Conta corrente pode ficar negativa (cheque especial). Aplicação e caixa,
  -- não: é sempre saldo de abertura faltando ou lançamento com sentido trocado.
  SELECT (CASE WHEN c.nome ILIKE '%aplica%' OR c.nome ILIKE '%caix%' THEN 'critico' ELSE 'atencao' END)::text,
         'saldo negativo'::text,
         'A conta "' || c.nome || '" está com saldo negativo. '
           || CASE WHEN COALESCE(c.saldo_inicial,0) = 0
                   THEN 'O saldo de abertura está zerado — confira se ele foi informado.'
                   ELSE 'Confira se há lançamento com origem ou sentido trocado.' END,
         c.saldo_atual,
         c.id::text
    FROM public.financeiro_contas c
   WHERE c.empresa_id = p_empresa_id
     AND c.ativa
     AND c.saldo_atual < 0

  UNION ALL

  -- ── 3. Transferência de conta que não tinha o dinheiro ────────────────────
  -- O erro de 25/08: oito PIX lançados como saída de uma conta que abriu o ano
  -- com R$ 39,75. A conferência olha o saldo de abertura contra o que saiu.
  SELECT 'atencao'::text,
         'transferência acima do saldo'::text,
         'A conta "' || c.nome || '" registra saídas por transferência muito acima '
           || 'do que recebeu. Confira a conta de origem desses lançamentos.',
         t.saiu - t.entrou,
         c.id::text
    FROM public.financeiro_contas c
    JOIN LATERAL (
      SELECT COALESCE(SUM(l.valor) FILTER (WHERE l.natureza = 'despesa'), 0) AS saiu,
             COALESCE(SUM(l.valor) FILTER (WHERE l.natureza = 'receita'), 0) AS entrou
        FROM public.financeiro_lancamentos l
       WHERE l.conta_id = c.id AND l.tipo = 'transferencia'
    ) t ON true
   WHERE c.empresa_id = p_empresa_id
     AND t.saiu - t.entrou > COALESCE(c.saldo_inicial, 0) + 1000

  UNION ALL

  -- ── 4. Perna de transferência sem par ─────────────────────────────────────
  -- O formato espelhado grava duas linhas por lote. Lote com uma perna só
  -- significa dinheiro saindo de uma conta e não entrando em nenhuma.
  SELECT 'critico'::text,
         'transferência sem par'::text,
         'Lote de transferência com ' || cnt || ' perna(s) em vez de 2. '
           || 'O dinheiro sai de uma conta e não entra em nenhuma.',
         valor_lote,
         lote::text
    FROM (
      SELECT l.origem_lote_id AS lote, count(*) AS cnt, max(l.valor) AS valor_lote
        FROM public.financeiro_lancamentos l
       WHERE l.empresa_id = p_empresa_id
         AND l.tipo = 'transferencia'
         AND l.natureza IN ('despesa','receita')
         AND l.origem_lote_id IS NOT NULL
       GROUP BY l.origem_lote_id
      HAVING count(*) <> 2
    ) pares

  UNION ALL

  -- ── 5. Faturamento declarado × contabilizado ──────────────────────────────
  -- Os dois números que não convergiam. A diferença não é erro por si: parte é
  -- nota a receber com prazo correndo. Vira aviso quando passa de 10%.
  SELECT 'atencao'::text,
         'faturamento não confere'::text,
         'O faturamento declarado em Apuração difere do que os lançamentos somam. '
           || 'Declarado ' || to_char(d.declarado, 'FM999G999G999D00')
           || ', contabilizado ' || to_char(d.contabilizado, 'FM999G999G999D00') || '.',
         d.declarado - d.contabilizado,
         NULL::text
    FROM (
      SELECT
        (SELECT COALESCE(SUM(f.valor_faturamento), 0)
           FROM public.faturamento_mensal f WHERE f.empresa_id = p_empresa_id) AS declarado,
        (SELECT COALESCE(SUM(l.valor), 0)
           FROM public.financeiro_lancamentos l
           JOIN public.financeiro_categorias c ON c.id = l.categoria_id
          WHERE l.empresa_id = p_empresa_id
            AND c.grupo_dre = 'receita_bruta'
            AND l.status IN ('realizado','conciliado')) AS contabilizado
    ) d
   WHERE d.declarado > 0
     AND abs(d.declarado - d.contabilizado) > d.declarado * 0.10

  UNION ALL

  -- ── 6. Regime tributário ausente ──────────────────────────────────────────
  -- Sem regime não há por qual tabela apurar, e o padrão do banco era
  -- 'simples' — foi assim que uma empresa de Lucro Presumido foi apurada pela
  -- tabela do Simples Nacional sem ninguém ter escolhido nada.
  SELECT 'critico'::text,
         'regime não definido'::text,
         'A empresa não tem regime tributário no cadastro. A apuração não pode '
           || 'ser feita, e qualquer padrão adotado seria decidir no lugar de alguém.',
         NULL::numeric,
         e.id::text
    FROM public.empresas e
   WHERE e.id = p_empresa_id
     AND e.regime_tributario IS NULL

  UNION ALL

  -- ── 7. Lançamento com data implausível ────────────────────────────────────
  SELECT 'atencao'::text,
         'data implausível'::text,
         count(*) || ' lançamento(s) com vencimento a mais de 15 anos da competência. '
           || 'Provável ano digitado errado.',
         SUM(l.valor),
         NULL::text
    FROM public.financeiro_lancamentos l
   WHERE l.empresa_id = p_empresa_id
     AND l.data_vencimento IS NOT NULL
     AND l.data_competencia IS NOT NULL
     AND l.data_vencimento > l.data_competencia + interval '15 years'
  HAVING count(*) > 0

  UNION ALL

  -- ── 8. Lançamento sem categoria ───────────────────────────────────────────
  -- Percentual apurado sobre lançamento sem categoria é palpite com cara de
  -- número. A cobertura entra como informativo enquanto for pequena.
  SELECT (CASE WHEN SUM(l.valor) > 50000 THEN 'atencao' ELSE 'informativo' END)::text,
         'sem classificação'::text,
         count(*) || ' lançamento(s) realizado(s) sem categoria. '
           || 'Eles ficam fora do DRE e dos indicadores gerenciais.',
         SUM(l.valor),
         NULL::text
    FROM public.financeiro_lancamentos l
   WHERE l.empresa_id = p_empresa_id
     AND l.categoria_id IS NULL
     AND l.status IN ('realizado','conciliado')
     AND l.tipo IN ('a_receber','a_pagar')
  HAVING count(*) > 0

  UNION ALL

  -- ── 9. O gatilho que mantém o saldo derivado está ativo? ──────────────────
  -- Sem ele, saldo_atual congela no último recálculo manual e passa a mentir
  -- em silêncio. É a única checagem aqui que não olha dado, e sim o motor.
  SELECT 'critico'::text,
         'gatilho do saldo inativo'::text,
         'O gatilho trg_saldo_lancamento não está ativo em financeiro_lancamentos. '
           || 'Sem ele, o saldo das contas para de acompanhar os lançamentos: '
           || 'continua exibido, com a mesma aparência, apenas parado no tempo. '
           || 'Reinstale antes de confiar em qualquer saldo desta tela.',
         NULL::numeric,
         NULL::text
   WHERE NOT EXISTS (
     SELECT 1
       FROM pg_trigger t
       JOIN pg_class cl     ON cl.oid = t.tgrelid
       JOIN pg_namespace ns ON ns.oid = cl.relnamespace
      WHERE ns.nspname = 'public'
        AND cl.relname = 'financeiro_lancamentos'
        AND t.tgname   = 'trg_saldo_lancamento'
        AND NOT t.tgisinternal
        AND t.tgenabled = 'O'   -- 'O' = ativo; 'D' = desabilitado
   )

  UNION ALL

  -- ── 10. Nota fiscal lançada sem o documento guardado ──────────────────────
  -- O XML da NF-e É o documento fiscal; o DANFE é a representação impressa
  -- dele. Guardar só os campos extraídos não cumpre o prazo decadencial de
  -- cinco anos, e deixa sem prova quem precisar responder a questionamento do
  -- órgão ou pedir reequilíbrio.
  --
  -- Só conta lançamento nascido a partir de 2026-08-25: cobrar documento do
  -- que foi lançado antes de o arquivamento existir seria cobrar uma
  -- obrigação retroativa que ninguém tinha como cumprir.
  SELECT 'atencao'::text,
         'nota sem documento'::text,
         count(*) || ' lançamento(s) de NF-e/NFS-e sem o arquivo guardado. '
           || 'Os campos foram registrados, o documento não — e é ele que vale '
           || 'como prova e cumpre o prazo de guarda.',
         SUM(l.valor),
         NULL::text
    FROM public.financeiro_lancamentos l
   WHERE l.empresa_id = p_empresa_id
     AND l.tipo_documento IN ('nfe','nfse','nfce')
     AND l.created_at >= DATE '2026-08-25'
     AND NOT EXISTS (
       SELECT 1 FROM public.financeiro_documentos_fiscais d
        WHERE d.lancamento_id = l.id
          AND (d.storage_path IS NOT NULL OR d.arquivo_xml IS NOT NULL)
     )
  HAVING count(*) > 0

  UNION ALL

  -- ── 11. Título que na verdade é transferência entre contas próprias ───────
  -- "INT RESGATE MAPFRERFDI" lançado como conta a receber não é recebimento de
  -- cliente: é dinheiro da empresa voltando do CDB para a conta corrente. Ele
  -- infla o "Total a receber em aberto" e, antes da correção de 25/08, entrava
  -- como faturamento na calculadora de margem.
  --
  -- O achado APONTA e não prescreve: o remédio depende de a transferência
  -- correspondente já existir. Se existe, o título é duplicata e se remove; se
  -- não existe, o título É a transferência e se converte. Converter uma
  -- duplicata criaria uma TERCEIRA contagem.
  SELECT 'atencao'::text,
         'título que é transferência'::text,
         count(*) || ' título(s) a receber/pagar cuja descrição é de movimentação '
           || 'entre contas próprias (resgate, aplicação, transferência). '
           || 'Não são receita nem despesa — são o mesmo dinheiro mudando de conta.',
         SUM(l.valor),
         NULL::text
    FROM public.financeiro_lancamentos l
   WHERE l.empresa_id = p_empresa_id
     AND l.tipo IN ('a_receber','a_pagar')
     AND l.status <> 'cancelado'
     AND (
          lower(public.unaccent_imutavel(l.descricao)) LIKE '%resgate%'
       OR lower(public.unaccent_imutavel(l.descricao)) LIKE '%aplicacao%'
       OR lower(public.unaccent_imutavel(l.descricao)) LIKE '%transferencia entre%'
       OR lower(public.unaccent_imutavel(l.descricao)) LIKE '%transf propria%'
       OR lower(public.unaccent_imutavel(l.descricao)) LIKE '%entre contas%'
       OR lower(public.unaccent_imutavel(l.descricao)) LIKE '%mesma titularidade%'
     )
  HAVING count(*) > 0


  UNION ALL

  -- ── 12. Categoria que existe mas não tem grupo de DRE ─────────────────────
  -- A verificação 8 pega lançamento SEM categoria. Este é o buraco vizinho, e
  -- mais difícil de ver: o lançamento tem categoria, a tela mostra o nome dela
  -- bonitinho, e mesmo assim ele não entra em linha nenhuma do resultado —
  -- porque a categoria não está ligada a um grupo do DRE.
  --
  -- Em 28/08/2026 isso valia 445 das 603 categorias (73,8%), e o DRE tinha um
  -- atalho que varria tudo para dentro de Receita Bruta ou Despesas
  -- Operacionais conforme a natureza. O relatório parecia completo justamente
  -- onde estava mais incompleto. O atalho saiu; o buraco, sem esta verificação,
  -- voltaria em silêncio na próxima categoria cadastrada sem grupo.
  SELECT (CASE WHEN SUM(l.valor) > 20000 THEN 'atencao' ELSE 'informativo' END)::text,
         'categoria fora do DRE'::text,
         count(DISTINCT c.id) || ' categoria(s) com lançamento e sem grupo de DRE. '
           || 'Os lançamentos aparecem classificados na tela, mas ficam fora do '
           || 'resultado. Financeiro → Categorias, coluna Grupo DRE.',
         SUM(l.valor),
         string_agg(DISTINCT c.nome, ', ' ORDER BY c.nome)
    FROM public.financeiro_lancamentos l
    JOIN public.financeiro_categorias c ON c.id = l.categoria_id
   WHERE l.empresa_id = p_empresa_id
     AND c.grupo_dre IS NULL
     AND l.status IN ('realizado','conciliado')
     AND l.tipo IN ('a_receber','a_pagar')
  HAVING count(*) > 0

  UNION ALL

  -- ── 13. Duas categorias com o mesmo nome ──────────────────────────────────
  -- "Assinaturas De Portais De Licitações" e "Assinaturas de Portais de
  -- Licitações" são a mesma despesa escrita com maiúsculas diferentes, e as
  -- duas tinham lançamento: o DRE exibia R$ 947,48 e R$ 628,00 em linhas
  -- separadas em vez de R$ 1.575,48 numa só.
  --
  -- Nenhum total fica errado — o que se perde é a leitura. Duas linhas com o
  -- mesmo nome fazem quem confere procurar diferença onde não há.
  SELECT 'informativo'::text,
         'categoria repetida'::text,
         count(*) || ' nome(s) de categoria cadastrado(s) mais de uma vez, '
           || 'variando só maiúsculas ou espaços. O DRE mostra uma linha para cada.',
         NULL::numeric,
         string_agg(nome_exemplo, ', ' ORDER BY nome_exemplo)
    FROM (
      SELECT min(c.nome) AS nome_exemplo
        FROM public.financeiro_categorias c
       WHERE c.empresa_id = p_empresa_id
       GROUP BY lower(btrim(c.nome))
      HAVING count(*) > 1
    ) AS repetidas
  HAVING count(*) > 0
$$;

COMMENT ON FUNCTION public.financeiro_conferencia(uuid) IS
  'Refaz as derivações do Financeiro e devolve o que não fecha: saldo que não '
  'corresponde aos lançamentos, conta negativa, transferência sem par ou acima '
  'do saldo, faturamento divergente, regime ausente, data implausível, '
  'lançamento sem categoria, categoria sem grupo de DRE e categoria repetida. '
  'Não corrige nada — corrigir dinheiro é decisão de gente. Ela só se recusa a '
  'ficar calada.';

GRANT EXECUTE ON FUNCTION public.financeiro_conferencia(uuid) TO authenticated;

-- Uso:
--   SELECT * FROM public.financeiro_conferencia(
--     (SELECT id FROM public.empresas WHERE razao_social ILIKE 'ETHOS%')
--   ) ORDER BY CASE severidade WHEN 'critico' THEN 1 WHEN 'atencao' THEN 2 ELSE 3 END;
```

## 20260829000003 — O limite do art. 125 isenta só o que a lei isenta

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- O limite do art. 125 conta só o que a lei manda contar
-- ═══════════════════════════════════════════════════════════════════════════
--
-- O gatilho `alerta_limite_aditivo_25pct` grava alerta de auditoria quando os
-- acréscimos acumulados passam de 25% (50% em obra/serviço de engenharia).
-- Ele já sabia quais tipos ficam de fora — a 20260505192100 acertou isso — mas
-- dois pontos anulavam o acerto.
--
-- ── Defeito 1: o reforço reativava a avaliação ──────────────────────────────
--
--     IF NOT v_avalia_valor AND COALESCE(NEW.valor_acrescimo,0) > 0 THEN
--       v_avalia_valor := true;
--     END IF;
--
-- O reforço existe por bom motivo: cobrir quem escolheu tipo genérico e lançou
-- acréscimo real. Só que um REAJUSTE sempre traz `valor_acrescimo > 0` — é a
-- definição dele. Então o reforço reacendia a avaliação justamente no tipo que
-- a linha de cima tinha acabado de isentar.
--
-- ── Defeito 2, maior: a soma acumulava tudo ─────────────────────────────────
--
--     SELECT COALESCE(SUM(valor_acrescimo),0) ...
--       FROM public.contrato_aditivos WHERE contrato_id = NEW.contrato_id;
--
-- Sem filtro de tipo. Mesmo quando o gatilho avaliava um aditivo legítimo de
-- valor, o percentual acumulado somava junto reajuste, repactuação, adesão e
-- remanejamento. Num contrato com R$ 50.000 de reajuste e R$ 20.000 de
-- acréscimo real, o alerta acusava R$ 70.000 sobre o valor original.
--
-- ── Por que isso importa ────────────────────────────────────────────────────
--
-- Lei 14.133/2021, art. 136, I: reajuste e repactuação de preços PREVISTOS no
-- próprio contrato são registrados por simples apostila, dispensado o termo
-- aditivo. Apostila não é alteração do ajuste — é registro do que já estava
-- pactuado —, e por isso não consome o limite do art. 125.
--
-- Reequilíbrio (art. 124, II, "d") e revisão restabelecem a equação econômica
-- rompida por fato superveniente: recompõem o contrato, não o ampliam.
--
-- Adesão (Decreto 11.462/2023, art. 32, §4º) tem teto próprio, e remanejamento
-- redistribui entre participantes sem acrescer o total registrado.
--
-- ── E havia duas autoridades sobre o mesmo número ───────────────────────────
--
-- A tela de Aditivos já filtrava certo (`FORA_DO_ART_125` em
-- ContratoAditivos.tsx) e mostrava, digamos, "12% de 25%". O gatilho, olhando
-- os mesmos aditivos, gravava alerta dizendo "atingiram 70%". Os dois números
-- na mesma tela, discordando, sem nada explicando qual valia.
--
-- Este arquivo alinha o gatilho à régua da tela. A lista de isenção passa a
-- estar escrita uma vez, num lugar só do gatilho, em vez de espalhada por três
-- condições que precisavam concordar entre si.

CREATE OR REPLACE FUNCTION public.alerta_limite_aditivo_25pct()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  v_user_id UUID;
  v_valor_original NUMERIC;
  v_total_acrescimo NUMERIC;
  v_total_qtd_acrescimo NUMERIC;
  v_qtd_total_contrato NUMERIC;
  v_pct_valor NUMERIC;
  v_pct_qtd NUMERIC;
  v_objeto TEXT;
  v_limite NUMERIC := 25.0;
  v_tipo_norm TEXT;
  v_avalia_valor BOOLEAN := false;
  v_avalia_qtd BOOLEAN := false;

  -- Escrito UMA vez. Antes a mesma regra vivia em três condições que
  -- precisavam concordar entre si, e não concordavam.
  --   reequilibrio, revisao  → art. 124, II, "d": recompõem, não ampliam
  --   repactuacao, reajuste  → art. 136, I: apostila, não aditivo
  --   adesao, remanejamento  → instrumentos da ata, teto próprio
  c_isentos CONSTANT TEXT :=
    '(reequilibr|revisao|repactua|reajust|adesao|remanejam)';
BEGIN
  SELECT c.user_id, c.valor_global_original, c.objeto
  INTO v_user_id, v_valor_original, v_objeto
  FROM public.contratos c WHERE c.id = NEW.contrato_id;

  IF v_user_id IS NULL THEN RETURN NEW; END IF;

  -- Reforma/obra/engenharia: limite ampliado para 50% (art. 125, §1º)
  IF lower(COALESCE(v_objeto,'')) ~ '(reforma|engenharia|obra)' THEN
    v_limite := 50.0;
  END IF;

  v_tipo_norm := translate(
    lower(COALESCE(NEW.tipo, '')),
    'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'
  );

  -- Isento é isento: sai antes de qualquer outra decisão, e o reforço abaixo
  -- não tem como reacendê-lo.
  IF v_tipo_norm ~ c_isentos THEN
    RETURN NEW;
  END IF;

  -- Tipos quantitativos, sujeitos ao art. 125.
  IF v_tipo_norm ~ '(valor|quantitativ|quantidade|acrescim|supressa|misto)' THEN
    v_avalia_valor := true;
    v_avalia_qtd := true;
  END IF;

  -- Reforço para tipo genérico que traz acréscimo real ("outros" com valor).
  -- Continua valendo, mas já não alcança os isentos.
  IF NOT v_avalia_valor AND COALESCE(NEW.valor_acrescimo,0) > 0 THEN
    v_avalia_valor := true;
  END IF;
  IF NOT v_avalia_qtd AND COALESCE(NEW.quantidade_acrescimo,0) > 0 THEN
    v_avalia_qtd := true;
  END IF;

  -- Nada a avaliar (ex.: aditivo de prazo puro, art. 107).
  IF NOT v_avalia_valor AND NOT v_avalia_qtd THEN
    RETURN NEW;
  END IF;

  -- O acumulado também ignora os isentos. Era este o defeito grande: mesmo
  -- avaliando um aditivo legítimo, a soma trazia junto todo o reajuste do
  -- contrato e o percentual saía inflado.
  SELECT COALESCE(SUM(valor_acrescimo),0), COALESCE(SUM(quantidade_acrescimo),0)
  INTO v_total_acrescimo, v_total_qtd_acrescimo
  FROM public.contrato_aditivos
  WHERE contrato_id = NEW.contrato_id
    AND translate(
          lower(COALESCE(tipo,'')),
          'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'
        ) !~ c_isentos;

  v_pct_valor := CASE WHEN COALESCE(v_valor_original,0) > 0
    THEN ROUND((v_total_acrescimo / v_valor_original) * 100, 2) ELSE 0 END;

  SELECT COALESCE(SUM(quantidade_contratada),0) INTO v_qtd_total_contrato
  FROM public.contrato_itens WHERE contrato_id = NEW.contrato_id;

  v_pct_qtd := CASE WHEN COALESCE(v_qtd_total_contrato,0) > 0
    THEN ROUND((v_total_qtd_acrescimo / v_qtd_total_contrato) * 100, 2) ELSE 0 END;

  IF v_avalia_valor AND v_total_acrescimo > 0 AND v_pct_valor >= v_limite THEN
    INSERT INTO public.contrato_ia_auditoria (contrato_id, campo, valor_anterior, valor_novo, origem, user_id, arquivo_nome)
    VALUES (
      NEW.contrato_id, 'alerta_aditivo_valor',
      'Limite legal Lei 14.133/21, art. 125: ' || v_limite::TEXT || '%',
      'ATENÇÃO: acréscimos acumulados em VALOR atingiram ' || v_pct_valor::TEXT || '% (R$ ' || v_total_acrescimo::TEXT || ' sobre R$ ' || COALESCE(v_valor_original,0)::TEXT || '). '
        || 'Não entram nesta conta reajuste, repactuação, reequilíbrio, revisão, adesão e remanejamento.',
      'alerta_limite_legal', v_user_id,
      'Aditivo nº ' || COALESCE(NEW.numero_aditivo,'?')
    );
  END IF;

  IF v_avalia_qtd AND v_total_qtd_acrescimo > 0 AND v_pct_qtd >= 25.0 THEN
    INSERT INTO public.contrato_ia_auditoria (contrato_id, campo, valor_anterior, valor_novo, origem, user_id, arquivo_nome)
    VALUES (
      NEW.contrato_id, 'alerta_aditivo_quantidade',
      'Limite legal Lei 14.133/21, art. 125: 25%',
      'ATENÇÃO: acréscimos acumulados em QUANTIDADE atingiram ' || v_pct_qtd::TEXT || '% (' || v_total_qtd_acrescimo::TEXT || ' sobre ' || v_qtd_total_contrato::TEXT || ')',
      'alerta_limite_legal', v_user_id,
      'Aditivo nº ' || COALESCE(NEW.numero_aditivo,'?')
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'alerta_limite_aditivo_25pct: %', SQLERRM;
  RETURN NEW;
END; $$;

COMMENT ON FUNCTION public.alerta_limite_aditivo_25pct() IS
  'Alerta quando os acréscimos acumulados atingem o limite do art. 125 da Lei '
  '14.133/2021 (25%, ou 50% em obra e serviço de engenharia). Ficam de fora, e '
  'também não entram no acumulado: reajuste e repactuação (art. 136, I — '
  'registrados por apostila), reequilíbrio e revisão (art. 124, II, "d" — '
  'recompõem a equação, não ampliam o objeto), adesão (teto próprio no Decreto '
  '11.462/2023, art. 32, §4º) e remanejamento (redistribui entre participantes '
  'sem acrescer o registrado). Mesma régua da tela de Aditivos.';

-- ── Limpeza dos alertas gerados pela regra antiga ───────────────────────────
-- Alerta legal que não devia existir é pior do que alerta nenhum: ensina a
-- ignorar o alarme, e o próximo — verdadeiro — passa despercebido.
--
-- Só apaga o que foi gerado PELO GATILHO (origem = 'alerta_limite_legal') e
-- cujo aditivo é de tipo isento. Auditoria feita por gente ou por IA fica.
DELETE FROM public.contrato_ia_auditoria a
USING public.contrato_aditivos ad
WHERE a.origem = 'alerta_limite_legal'
  AND a.contrato_id = ad.contrato_id
  AND a.arquivo_nome = 'Aditivo nº ' || COALESCE(ad.numero_aditivo,'?')
  AND translate(
        lower(COALESCE(ad.tipo,'')),
        'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'
      ) ~ '(reequilibr|revisao|repactua|reajust|adesao|remanejam)';

-- ── Conferência ─────────────────────────────────────────────────────────────
--
-- 1. Alertas de limite que sobraram, com o tipo do aditivo que os gerou.
--    Nenhum deve ser de tipo isento.
--
--    SELECT ad.tipo, count(*)
--      FROM public.contrato_ia_auditoria a
--      JOIN public.contrato_aditivos ad
--        ON ad.contrato_id = a.contrato_id
--       AND a.arquivo_nome = 'Aditivo nº ' || COALESCE(ad.numero_aditivo,'?')
--     WHERE a.origem = 'alerta_limite_legal'
--     GROUP BY 1 ORDER BY 2 DESC;
--
-- 2. O acumulado por contrato, como o gatilho passa a enxergar — e é o mesmo
--    número que a tela de Aditivos mostra:
--
--    SELECT c.numero_contrato, c.valor_global_original,
--           SUM(ad.valor_acrescimo) FILTER (
--             WHERE translate(lower(COALESCE(ad.tipo,'')),
--                   'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc')
--                   !~ '(reequilibr|revisao|repactua|reajust|adesao|remanejam)'
--           ) AS acrescimo_que_conta,
--           SUM(ad.valor_acrescimo) AS acrescimo_total
--      FROM public.contratos c
--      JOIN public.contrato_aditivos ad ON ad.contrato_id = c.id
--     GROUP BY 1,2
--    HAVING SUM(ad.valor_acrescimo) > 0
--     ORDER BY 4 DESC;
```

## 20260829000004 — Prazo de entrega, local de entrega e prazo de recebimento

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Prazo de entrega, local de entrega e prazo de recebimento
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Todo contrato administrativo e toda ata de registro de preços dizem, por
-- escrito, três coisas que o sistema não guardava em lugar nenhum:
--
--   1. em quanto tempo entregar depois do pedido;
--   2. onde entregar;
--   3. em quanto tempo o órgão recebe e atesta o objeto.
--
-- São obrigações com prazo. Estourar a primeira é inadimplemento contratual
-- (Lei 14.133/2021, art. 137, II) e abre caminho para as sanções do art. 156.
-- A terceira governa quando a nota pode ser paga — art. 140, §1º.
--
-- Sem esses campos, quem lança um pedido no sistema não tem como saber quando
-- ele vence, e a tela de Pedidos exibe a data do pedido sem nada dizer sobre o
-- prazo que começou a correr naquele instante.
--
-- ── Por que dias E texto ────────────────────────────────────────────────────
-- O número é o que permite calcular a data-limite. A frase literal é o que
-- permite CONFERIR o número — quem lê "10 (dez) dias úteis, contados do
-- recebimento da ordem de fornecimento" sabe imediatamente se o 10 gravado
-- está certo. Prazo extraído por IA que dispara aviso sem deixar conferir de
-- onde saiu é palpite com aparência de obrigação.
--
-- ── Por que a unidade é coluna, e não convenção ─────────────────────────────
-- "10 dias úteis" e "10 dias corridos" são prazos diferentes — em dezembro, a
-- diferença passa de uma semana. Guardar só o número e supor a unidade é a
-- forma mais fácil de o sistema avisar no dia errado, que é pior do que não
-- avisar: quem confia no aviso perde o prazo confiando.

ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS prazo_entrega_dias        integer,
  ADD COLUMN IF NOT EXISTS prazo_entrega_unidade     text,
  ADD COLUMN IF NOT EXISTS prazo_entrega_clausula    text,
  ADD COLUMN IF NOT EXISTS local_entrega             text,
  ADD COLUMN IF NOT EXISTS local_entrega_clausula    text,
  ADD COLUMN IF NOT EXISTS prazo_recebimento_dias    integer,
  ADD COLUMN IF NOT EXISTS prazo_recebimento_unidade text,
  ADD COLUMN IF NOT EXISTS prazo_recebimento_clausula text;

COMMENT ON COLUMN public.contratos.prazo_entrega_dias IS
  'Prazo para entregar, em dias, contado do pedido / ordem de fornecimento. '
  'Nulo significa que ninguém registrou — não que o prazo seja zero ou que não '
  'exista. A tela de Pedidos avisa quando está nulo em vez de calcular sozinha.';

COMMENT ON COLUMN public.contratos.prazo_entrega_unidade IS
  'uteis | corridos. Sem isso, "10 dias" é ambíguo e o aviso cai no dia errado '
  '— em dezembro a diferença entre as duas leituras passa de uma semana.';

COMMENT ON COLUMN public.contratos.prazo_entrega_clausula IS
  'A frase literal do contrato de onde o prazo saiu. É o que permite conferir '
  'o número: prazo extraído por IA que dispara aviso sem deixar ver a origem é '
  'palpite com aparência de obrigação.';

COMMENT ON COLUMN public.contratos.local_entrega IS
  'Onde entregar, como o contrato descreve — endereço, unidade, almoxarifado, '
  'ou a regra ("nas unidades indicadas na ordem de fornecimento").';

COMMENT ON COLUMN public.contratos.prazo_recebimento_dias IS
  'Prazo do órgão para receber e atestar o objeto (Lei 14.133/2021, art. 140). '
  'Governa quando a nota pode ser apresentada e paga; contado da entrega.';

COMMENT ON COLUMN public.contratos.prazo_recebimento_unidade IS
  'uteis | corridos, pela mesma razão do prazo de entrega.';

-- ── Coerência ───────────────────────────────────────────────────────────────
-- Unidade só aceita as duas que existem em contrato público brasileiro. E
-- unidade sem prazo não significa nada: ou os dois, ou nenhum.
ALTER TABLE public.contratos
  DROP CONSTRAINT IF EXISTS chk_prazo_entrega_unidade;
ALTER TABLE public.contratos
  ADD CONSTRAINT chk_prazo_entrega_unidade
  CHECK (
    prazo_entrega_unidade IS NULL
    OR (prazo_entrega_unidade IN ('uteis','corridos') AND prazo_entrega_dias IS NOT NULL)
  ) NOT VALID;

ALTER TABLE public.contratos
  DROP CONSTRAINT IF EXISTS chk_prazo_recebimento_unidade;
ALTER TABLE public.contratos
  ADD CONSTRAINT chk_prazo_recebimento_unidade
  CHECK (
    prazo_recebimento_unidade IS NULL
    OR (prazo_recebimento_unidade IN ('uteis','corridos') AND prazo_recebimento_dias IS NOT NULL)
  ) NOT VALID;

-- Prazo negativo ou absurdo é erro de leitura, não cláusula. Cinco anos de
-- folga cobre o contrato mais longo do art. 108 sem barrar caso legítimo.
ALTER TABLE public.contratos
  DROP CONSTRAINT IF EXISTS chk_prazos_plausiveis;
ALTER TABLE public.contratos
  ADD CONSTRAINT chk_prazos_plausiveis
  CHECK (
    (prazo_entrega_dias     IS NULL OR prazo_entrega_dias     BETWEEN 1 AND 1825)
    AND (prazo_recebimento_dias IS NULL OR prazo_recebimento_dias BETWEEN 1 AND 1825)
  ) NOT VALID;

-- ── Conferência ─────────────────────────────────────────────────────────────
--
--   SELECT numero_contrato,
--          prazo_entrega_dias, prazo_entrega_unidade,
--          local_entrega IS NOT NULL AS tem_local,
--          prazo_recebimento_dias, prazo_recebimento_unidade
--     FROM public.contratos
--    ORDER BY prazo_entrega_dias NULLS FIRST;
--
-- Enquanto nenhum documento for reprocessado, tudo vem nulo: as colunas só se
-- preenchem na próxima extração ou no preenchimento manual.
--
-- Depois de conferidas as cláusulas gravadas:
--   ALTER TABLE public.contratos VALIDATE CONSTRAINT chk_prazo_entrega_unidade;
--   ALTER TABLE public.contratos VALIDATE CONSTRAINT chk_prazo_recebimento_unidade;
--   ALTER TABLE public.contratos VALIDATE CONSTRAINT chk_prazos_plausiveis;
```

## 20260829000005 — Validade, eficácia e extratos de publicação

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Validade e eficácia: assinatura das partes e divulgação oficial
-- ═══════════════════════════════════════════════════════════════════════════
--
-- São duas coisas, e o sistema tratava como uma só.
--
--   VALIDADE  nasce da assinatura por agente competente, com objeto lícito e
--             na forma da lei. A partir daí o contrato existe.
--
--   EFICÁCIA  nasce da divulgação. Lei 14.133/2021, art. 94: a divulgação no
--             PNCP é "condição indispensável para a eficácia do contrato e de
--             seus aditamentos", nos prazos de 20 dias úteis (licitação) ou
--             10 dias úteis (contratação direta), contados da assinatura.
--             Antes disso o ajuste não produz efeitos e a execução não pode
--             começar legitimamente.
--
-- ── Por que isto é problema de quem VENDE ───────────────────────────────────
--
-- Publicar é dever do órgão. Mas quem paga o preço de executar antes da
-- eficácia é o fornecedor: entrega feita sob contrato ineficaz é entrega sem
-- título que a sustente, e a conta a receber nasce contestável.
--
-- Daí duas necessidades que o sistema não atendia:
--
--   1. Avisar quando o documento anexado tem assinatura de UMA parte só.
--      Instrumento com uma assinatura é proposta, não ajuste.
--
--   2. Guardar os EXTRATOS — do contrato, da ata, de cada aditivo e da
--      designação do fiscal —, que são a prova de que a eficácia começou e a
--      partir de quando os prazos correm.

-- ── 1. Como o instrumento foi assinado ──────────────────────────────────────

ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS assinatura_situacao   text,
  ADD COLUMN IF NOT EXISTS assinatura_observacao text;

COMMENT ON COLUMN public.contratos.assinatura_situacao IS
  'ambas | so_contratada | so_orgao | nenhuma. Documento assinado por uma '
  'parte só é proposta, não ajuste: não vincula ninguém e não inicia prazo. '
  'Nulo significa que ninguém verificou — diferente de "está tudo certo".';

ALTER TABLE public.contratos
  DROP CONSTRAINT IF EXISTS chk_assinatura_situacao;
ALTER TABLE public.contratos
  ADD CONSTRAINT chk_assinatura_situacao
  CHECK (assinatura_situacao IS NULL
         OR assinatura_situacao IN ('ambas','so_contratada','so_orgao','nenhuma'))
  NOT VALID;

-- Art. 94, §1º: contrato de urgência tem eficácia desde a assinatura — mas
-- continua obrigado a publicar no prazo, sob pena de nulidade.
ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS eficacia_por_urgencia boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.contratos.eficacia_por_urgencia IS
  'Art. 94, §1º — urgência expressamente caracterizada dá eficácia desde a '
  'assinatura. Não dispensa a publicação posterior no prazo legal.';

-- ── 2. Os extratos ──────────────────────────────────────────────────────────
--
-- Tabela, e não colunas, porque um contrato tem VÁRIAS publicações: o extrato
-- do próprio contrato, o de cada aditivo, o da designação do fiscal, e as
-- republicações quando o órgão erra e retifica.

CREATE TABLE IF NOT EXISTS public.contrato_publicacoes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  contrato_id  uuid NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  -- Quando a publicação é de um aditivo específico. Nulo = é do contrato/ata.
  aditivo_id   uuid REFERENCES public.contrato_aditivos(id) ON DELETE CASCADE,

  tipo         text NOT NULL,
  -- PNCP, DOU, DOE, DOM, sítio oficial. O PNCP é o que dá eficácia (art. 94);
  -- os demais podem ser exigidos por norma local e ficam registrados junto.
  veiculo      text NOT NULL DEFAULT 'PNCP',
  data_publicacao date NOT NULL,
  numero       text,
  url          text,
  observacao   text,

  arquivo_id   uuid REFERENCES public.contrato_arquivos(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid
);

COMMENT ON TABLE public.contrato_publicacoes IS
  'Os extratos publicados de um contrato: do próprio contrato ou ata, de cada '
  'termo aditivo e da designação do fiscal. É a prova de que a eficácia '
  'começou e a partir de quando os prazos correm (Lei 14.133/2021, art. 94).';

COMMENT ON COLUMN public.contrato_publicacoes.tipo IS
  'extrato_contrato | extrato_ata | extrato_aditivo | designacao_fiscal | outro';

COMMENT ON COLUMN public.contrato_publicacoes.veiculo IS
  'Onde saiu. O PNCP é o que dá eficácia; diário oficial e sítio próprio '
  'podem ser exigidos por norma local e ficam registrados do mesmo jeito.';

ALTER TABLE public.contrato_publicacoes
  DROP CONSTRAINT IF EXISTS chk_publicacao_tipo;
ALTER TABLE public.contrato_publicacoes
  ADD CONSTRAINT chk_publicacao_tipo
  CHECK (tipo IN ('extrato_contrato','extrato_ata','extrato_aditivo','designacao_fiscal','outro'));

-- Extrato de aditivo sem dizer QUAL aditivo não serve de prova de nada.
ALTER TABLE public.contrato_publicacoes
  DROP CONSTRAINT IF EXISTS chk_publicacao_aditivo_identificado;
ALTER TABLE public.contrato_publicacoes
  ADD CONSTRAINT chk_publicacao_aditivo_identificado
  CHECK (tipo <> 'extrato_aditivo' OR aditivo_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_publicacoes_contrato
  ON public.contrato_publicacoes(contrato_id, tipo);
CREATE INDEX IF NOT EXISTS idx_publicacoes_aditivo
  ON public.contrato_publicacoes(aditivo_id) WHERE aditivo_id IS NOT NULL;

ALTER TABLE public.contrato_publicacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "publicacoes_select" ON public.contrato_publicacoes;
CREATE POLICY "publicacoes_select" ON public.contrato_publicacoes
  FOR SELECT USING (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "publicacoes_insert" ON public.contrato_publicacoes;
CREATE POLICY "publicacoes_insert" ON public.contrato_publicacoes
  FOR INSERT WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "publicacoes_update" ON public.contrato_publicacoes;
CREATE POLICY "publicacoes_update" ON public.contrato_publicacoes
  FOR UPDATE USING (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "publicacoes_delete" ON public.contrato_publicacoes;
CREATE POLICY "publicacoes_delete" ON public.contrato_publicacoes
  FOR DELETE USING (public.is_empresa_admin(auth.uid(), empresa_id));

-- ── Conferência ─────────────────────────────────────────────────────────────
--
-- 1. Contratos assinados que ainda não têm extrato — os que não podem ser
--    executados:
--
--    SELECT c.numero_contrato, c.modalidade, c.data_assinatura,
--           c.assinatura_situacao, c.eficacia_por_urgencia
--      FROM public.contratos c
--     WHERE c.data_assinatura IS NOT NULL
--       AND NOT EXISTS (
--         SELECT 1 FROM public.contrato_publicacoes p
--          WHERE p.contrato_id = c.id
--            AND p.tipo IN ('extrato_contrato','extrato_ata')
--       )
--     ORDER BY c.data_assinatura;
--
-- 2. Aditivos sem extrato próprio (art. 94 fala em "contrato E SEUS
--    aditamentos"):
--
--    SELECT c.numero_contrato, a.numero_aditivo, a.tipo, a.data_assinatura
--      FROM public.contrato_aditivos a
--      JOIN public.contratos c ON c.id = a.contrato_id
--     WHERE NOT EXISTS (
--       SELECT 1 FROM public.contrato_publicacoes p WHERE p.aditivo_id = a.id
--     );
```

## 20260829000006 — Prazo de pagamento do contrato

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Prazo de pagamento — a última ponta, e a que fecha o ciclo do fornecedor
-- ═══════════════════════════════════════════════════════════════════════════
--
-- A 20260829000004 trouxe três prazos: entregar, onde entregar, e em quanto
-- tempo o órgão recebe e atesta. Faltava o quarto, que é o único que interessa
-- ao caixa: **em quanto tempo a Administração paga.**
--
-- É cláusula obrigatória. Lei 14.133/2021, art. 92, V: o contrato deve conter
-- "o preço e as condições de pagamento, os critérios, a data-base e a
-- periodicidade do reajustamento de preços". Não é praxe nem costume — está
-- escrito no instrumento, como os outros três.
--
-- ── Por que faz diferença aqui ──────────────────────────────────────────────
--
-- 1. O Contas a Receber projeta entrada de dinheiro. Sem o prazo do contrato,
--    a data dessa projeção é chute — e um fluxo de caixa montado sobre chute
--    parece planejamento e não é.
--
-- 2. O atraso tem consequência que a lei nomeia. Art. 137, §2º, IV: a
--    contratada pode pedir a extinção do contrato quando houver "atraso
--    superior a 2 (dois) meses, contado da emissão da nota fiscal, dos
--    pagamentos ou de parcelas de pagamentos devidos pela Administração".
--    Quem não acompanha o prazo não sabe que o direito nasceu.
--
-- ── Mesma modelagem dos outros prazos ───────────────────────────────────────
-- Dias, unidade e a cláusula literal. "30 dias úteis" e "30 dias corridos" são
-- coisas diferentes, e a frase de origem é o que permite conferir o número sem
-- reabrir o PDF.
--
-- E o marco também é dado: pagamento contado do quê? Do ateste, da emissão da
-- nota, ou do protocolo? Contratos usam os três, e supor um deles desloca a
-- previsão em semanas.

ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS prazo_pagamento_dias     integer,
  ADD COLUMN IF NOT EXISTS prazo_pagamento_unidade  text,
  ADD COLUMN IF NOT EXISTS prazo_pagamento_marco    text,
  ADD COLUMN IF NOT EXISTS prazo_pagamento_clausula text;

COMMENT ON COLUMN public.contratos.prazo_pagamento_dias IS
  'Prazo da Administração para pagar, em dias, contado do marco da cláusula. '
  'Cláusula obrigatória (Lei 14.133/2021, art. 92, V). Nulo significa que '
  'ninguém registrou — a projeção do Contas a Receber fica sem base.';

COMMENT ON COLUMN public.contratos.prazo_pagamento_unidade IS
  'uteis | corridos. Pela mesma razão dos demais prazos: em dezembro a '
  'diferença entre as duas leituras passa de uma semana.';

COMMENT ON COLUMN public.contratos.prazo_pagamento_marco IS
  'De onde o prazo é contado: ateste | nota_fiscal | protocolo | entrega. '
  'Contratos usam os quatro, e supor um deles desloca a previsão de entrada em '
  'semanas. Nulo quando a cláusula não diz.';

COMMENT ON COLUMN public.contratos.prazo_pagamento_clausula IS
  'A frase literal de onde o prazo saiu — o que permite conferir o número sem '
  'reabrir o PDF.';

ALTER TABLE public.contratos
  DROP CONSTRAINT IF EXISTS chk_prazo_pagamento_unidade;
ALTER TABLE public.contratos
  ADD CONSTRAINT chk_prazo_pagamento_unidade
  CHECK (
    prazo_pagamento_unidade IS NULL
    OR (prazo_pagamento_unidade IN ('uteis','corridos') AND prazo_pagamento_dias IS NOT NULL)
  ) NOT VALID;

ALTER TABLE public.contratos
  DROP CONSTRAINT IF EXISTS chk_prazo_pagamento_marco;
ALTER TABLE public.contratos
  ADD CONSTRAINT chk_prazo_pagamento_marco
  CHECK (
    prazo_pagamento_marco IS NULL
    OR prazo_pagamento_marco IN ('ateste','nota_fiscal','protocolo','entrega')
  ) NOT VALID;

ALTER TABLE public.contratos
  DROP CONSTRAINT IF EXISTS chk_prazo_pagamento_plausivel;
ALTER TABLE public.contratos
  ADD CONSTRAINT chk_prazo_pagamento_plausivel
  CHECK (prazo_pagamento_dias IS NULL OR prazo_pagamento_dias BETWEEN 1 AND 365)
  NOT VALID;

-- ── Conferência ─────────────────────────────────────────────────────────────
--
--   SELECT numero_contrato,
--          prazo_entrega_dias, prazo_entrega_unidade,
--          prazo_recebimento_dias,
--          prazo_pagamento_dias, prazo_pagamento_unidade, prazo_pagamento_marco
--     FROM public.contratos
--    ORDER BY prazo_pagamento_dias NULLS FIRST;
--
-- Vem tudo nulo até o próximo reprocessamento do PDF ou preenchimento manual.
```

## 20260829000007 — A natureza manda no sinal, e o que é previsto não entra no saldo

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- A natureza manda no sinal, e o que é previsto não entra no saldo
-- ═══════════════════════════════════════════════════════════════════════════
--
-- O Banpará PJ da ETHOS mostrava R$ 3.523.216,96. O saldo real na conta é
-- R$ 1.914,89. Sobra de R$ 3.521.302,07.
--
-- A decomposição do saldo bateu ao centavo com a fórmula — ou seja, ela estava
-- somando exatamente o que mandei somar. O defeito é o que mandei.
--
-- ── Defeito 1: transferência não respeitava o status ────────────────────────
--
-- Erro meu, introduzido na 20260827000002. `a_receber` e `a_pagar` só entram
-- quando `realizado` ou `conciliado`. `transferencia` não tinha essa condição:
--
--     WHEN tipo = 'transferencia' AND natureza IN ('despesa','receita') THEN ...
--
-- Sem filtro de status, transferência PREVISTA — que ainda não aconteceu —
-- mexia no saldo como se tivesse acontecido. No Banpará são 9 lançamentos
-- previstos, somando −R$ 2.464.000,00.
--
-- Saldo é o dinheiro que ESTÁ na conta. Previsão pertence ao fluxo de caixa,
-- que é outra tela e outra pergunta.
--
-- ── Defeito 2: o tipo decidia o sinal, ignorando a natureza ─────────────────
--
--     WHEN tipo = 'a_receber' AND status IN (...) THEN  valor
--     WHEN tipo = 'a_pagar'   AND status IN (...) THEN -valor
--
-- O sinal vinha do TIPO do documento, não da direção do dinheiro. E existem,
-- no Banpará, 5 lançamentos `a_receber` com natureza `despesa` — somando
-- R$ 1.744.123,37, entre eles "NF 728 – CARNE MOIDA" (R$ 1.343.620,57) e
-- "NF 727 – CARNE MOIDA" (R$ 373.015,11). São compras lançadas como conta a
-- receber.
--
-- A fórmula somava esses R$ 1,74 milhão ao saldo. Deveria subtrair. O erro de
-- uma linha assim é 2× o valor dela.
--
-- A regra passa a ser a mesma em todo lugar: **`natureza` diz para onde o
-- dinheiro foi; `tipo` diz que documento é.** É como `movimento_bancario` e a
-- perna espelhada de transferência já funcionavam — faltava valer para os
-- títulos.
--
-- ── Defeito 3: duplicata de importação (NÃO corrigido aqui) ─────────────────
--
-- A mesma conta tem 17 grupos de lançamentos repetidos: "MOVIMENTAÇÃO" de
-- R$ 300.000,00 em 17/06 aparece 3 vezes; três TEDs de R$ 250.000,00 aparecem
-- 2 vezes cada; "TAR PIX EXTE EMISSAO" de R$ 12,00 em 02/01 aparece 6 vezes.
-- Somam mais de R$ 1,3 milhão em excesso.
--
-- Isso é dado, não fórmula, e apagar lançamento é irreversível: fica como
-- decisão de quem conhece o extrato. O roteiro está no fim deste arquivo.

CREATE OR REPLACE FUNCTION public.financeiro_recalcular_saldo_conta(p_conta_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saldo_inicial numeric(15,2);
  v_movimento numeric(15,2);
BEGIN
  SELECT saldo_inicial INTO v_saldo_inicial FROM public.financeiro_contas WHERE id = p_conta_id;

  SELECT COALESCE(SUM(
    CASE
      -- ── Nada previsto entra no saldo ──────────────────────────────────────
      -- Saldo é o dinheiro que ESTÁ na conta. Previsão é fluxo de caixa, que é
      -- outra tela. Cancelado idem.
      WHEN status NOT IN ('realizado','conciliado') THEN 0

      -- ── Transferência espelhada: a natureza diz o lado ────────────────────
      -- Age só na própria conta_id; a outra perna cuida da outra conta.
      WHEN tipo = 'transferencia' AND natureza IN ('despesa','receita') THEN
        CASE WHEN conta_id = p_conta_id
             THEN CASE WHEN natureza = 'despesa' THEN -valor ELSE valor END
             ELSE 0 END

      -- ── Transferência de linha única: sai da origem, entra no destino ─────
      WHEN tipo = 'transferencia' AND conta_id = p_conta_id         THEN -valor
      WHEN tipo = 'transferencia' AND conta_destino_id = p_conta_id THEN  valor

      -- Daqui para baixo, só conta o que é DESTA conta.
      WHEN conta_id IS DISTINCT FROM p_conta_id THEN 0

      -- ── Título e movimento de extrato: a NATUREZA manda no sinal ──────────
      -- Antes o sinal vinha do TIPO — `a_receber` somava, `a_pagar` subtraía —
      -- e 5 compras lançadas como "a receber" entraram somando R$ 1.744.123,37
      -- numa conta só. `tipo` diz que documento é; `natureza` diz para onde o
      -- dinheiro foi, e é a direção que o saldo precisa.
      --
      -- `movimentacao` continua não contando: não diz direção, e somar por
      -- omissão já produziu R$ 48.907,10 de saldo inexistente em agosto.
      WHEN tipo IN ('a_receber','a_pagar','movimento_bancario') THEN
        CASE natureza
          WHEN 'receita' THEN  valor
          WHEN 'despesa' THEN -valor
          ELSE 0
        END

      ELSE 0
    END
  ), 0) INTO v_movimento
  FROM public.financeiro_lancamentos
  WHERE conta_id = p_conta_id OR conta_destino_id = p_conta_id;

  UPDATE public.financeiro_contas
  SET saldo_atual = COALESCE(v_saldo_inicial,0) + COALESCE(v_movimento,0), updated_at = now()
  WHERE id = p_conta_id;
END;
$$;

COMMENT ON FUNCTION public.financeiro_recalcular_saldo_conta(uuid) IS
  'saldo_atual = saldo_inicial + o que de fato entrou e saiu. Duas regras '
  'governam tudo: só entra o que está realizado ou conciliado (previsto é '
  'fluxo de caixa, não saldo), e quem decide o sinal é a NATUREZA, não o tipo '
  'do documento — 5 compras lançadas como "a receber" somavam R$ 1.744.123,37 '
  'ao saldo do Banpará em vez de subtrair. `movimentacao` não conta, porque '
  'não diz direção.';

-- ── A invariante: tipo e natureza precisam concordar ────────────────────────
-- Conta a receber com natureza de despesa é dado incoerente. A fórmula agora
-- resolve pelo lado seguro, mas o lugar de barrar isso é a entrada.
--
-- NOT VALID: as 5 linhas do Banpará (e o que houver nas outras contas)
-- continuam existindo para poderem ser conferidas e corrigidas. O roteiro
-- está no fim.
ALTER TABLE public.financeiro_lancamentos
  DROP CONSTRAINT IF EXISTS chk_titulo_natureza_coerente;
ALTER TABLE public.financeiro_lancamentos
  ADD CONSTRAINT chk_titulo_natureza_coerente
  CHECK (
    tipo NOT IN ('a_receber','a_pagar')
    OR (tipo = 'a_receber' AND natureza = 'receita')
    OR (tipo = 'a_pagar'   AND natureza = 'despesa')
  ) NOT VALID;

COMMENT ON CONSTRAINT chk_titulo_natureza_coerente ON public.financeiro_lancamentos IS
  'Conta a receber é receita; conta a pagar é despesa. A combinação trocada '
  'existia e somava ao saldo o que deveria subtrair.';

-- Recalcula tudo com a fórmula corrigida.
SELECT public.financeiro_recalcular_saldo_conta(id) FROM public.financeiro_contas;

-- ── Roteiro ─────────────────────────────────────────────────────────────────
--
-- 1. Os títulos com tipo e natureza trocados, em todas as empresas. São eles
--    que o CHECK acima recusaria:
--
--    SELECT e.razao_social, c.nome AS conta, l.data_competencia, l.descricao,
--           l.tipo, l.natureza, l.status, l.valor
--      FROM public.financeiro_lancamentos l
--      JOIN public.financeiro_contas c ON c.id = l.conta_id
--      JOIN public.empresas e ON e.id = l.empresa_id
--     WHERE (l.tipo = 'a_receber' AND l.natureza <> 'receita')
--        OR (l.tipo = 'a_pagar'   AND l.natureza <> 'despesa')
--     ORDER BY l.valor DESC;
--
--    Corrigido cada um (trocar o tipo ou a natureza — só quem conhece a nota
--    pode dizer qual), valide:
--      ALTER TABLE public.financeiro_lancamentos
--        VALIDATE CONSTRAINT chk_titulo_natureza_coerente;
--
-- 2. As duplicatas. Esta lista mostra os grupos e quanto sobra em cada um:
--
--    SELECT c.nome AS conta, l.data_competencia, l.descricao, l.valor,
--           count(*) AS vezes, (count(*) - 1) * l.valor AS excesso
--      FROM public.financeiro_lancamentos l
--      JOIN public.financeiro_contas c ON c.id = l.conta_id
--     GROUP BY 1,2,3,4
--    HAVING count(*) > 1
--     ORDER BY (count(*) - 1) * l.valor DESC;
--
--    NÃO apague sem conferir o extrato: pagamento repetido de mesmo valor no
--    mesmo dia existe (tarifa por operação, por exemplo, e "TAR PIX EXTE
--    EMISSAO" de R$ 12,00 seis vezes num dia pode ser real). Duplicata de
--    importação é a que tem o mesmo valor E a mesma descrição E não aparece
--    duas vezes no extrato do banco.
--
-- 3. Depois de limpar, confira contra o extrato:
--
--    SELECT nome, saldo_inicial, saldo_atual FROM public.financeiro_contas
--     WHERE empresa_id = (SELECT id FROM public.empresas WHERE razao_social ILIKE 'ETHOS%')
--     ORDER BY nome;
```

## 20260829000008 — Perna espelhada se reconhece pelo destino nulo

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Perna espelhada se reconhece pelo destino nulo, não pela natureza
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Erro meu, que sobreviveu à 20260827000002 e à 20260829000007 porque as duas
-- copiaram a mesma linha sem questioná-la:
--
--     WHEN tipo = 'transferencia' AND natureza IN ('despesa','receita') THEN
--       ...perna espelhada...
--     WHEN tipo = 'transferencia' AND conta_id = p_conta_id THEN -valor
--
-- A condição usa a NATUREZA para decidir se a linha é perna espelhada. Mas o
-- que distingue os dois formatos de transferência não é a natureza — é o
-- DESTINO:
--
--   perna espelhada     duas linhas, cada uma sabendo só da própria conta.
--                       `conta_destino_id` é NULO.
--   linha única         uma linha só, sabendo origem e destino.
--                       `conta_destino_id` está preenchido.
--
-- ── O que isso custou ───────────────────────────────────────────────────────
--
-- No Banpará PJ da ETHOS, em 19/03/2026:
--
--     transferencia · despesa      · MOVIMENTAÇÃO · R$ 12.000,00 → −12.000,00
--     transferencia · movimentacao · MOVIMENTAÇÃO · R$ 12.000,00 → −12.000,00
--
-- São as duas pernas da MESMA transferência. A segunda tem natureza
-- `movimentacao`, não casa com `natureza IN ('despesa','receita')`, cai na
-- regra da linha única e vira −valor. Uma transferência de R$ 12.000,00 tirou
-- R$ 24.000,00 da conta.
--
-- É também o que a conferência vinha acusando como "transferência sem par:
-- lote com 1 perna em vez de 2". O par existia; a fórmula é que não o
-- reconhecia.
--
-- ── A regra ─────────────────────────────────────────────────────────────────
-- Destino nulo é perna espelhada, e aí a natureza diz o lado — e `movimentacao`
-- não diz lado nenhum, então não conta, como em todo o resto do sistema.

CREATE OR REPLACE FUNCTION public.financeiro_recalcular_saldo_conta(p_conta_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saldo_inicial numeric(15,2);
  v_movimento numeric(15,2);
BEGIN
  SELECT saldo_inicial INTO v_saldo_inicial FROM public.financeiro_contas WHERE id = p_conta_id;

  SELECT COALESCE(SUM(
    CASE
      -- Saldo é o dinheiro que ESTÁ na conta. Previsto é fluxo de caixa,
      -- cancelado é nada.
      WHEN status NOT IN ('realizado','conciliado') THEN 0

      -- ── Transferência: o DESTINO diz qual dos dois formatos é ─────────────
      -- Destino nulo = perna espelhada, uma linha por conta. A natureza diz o
      -- lado, e `movimentacao` não diz lado nenhum: não conta.
      WHEN tipo = 'transferencia' AND conta_destino_id IS NULL THEN
        CASE WHEN conta_id = p_conta_id
             THEN CASE natureza
                    WHEN 'despesa' THEN -valor
                    WHEN 'receita' THEN  valor
                    ELSE 0
                  END
             ELSE 0 END

      -- Destino preenchido = linha única: sai da origem, entra no destino.
      WHEN tipo = 'transferencia' AND conta_id = p_conta_id         THEN -valor
      WHEN tipo = 'transferencia' AND conta_destino_id = p_conta_id THEN  valor

      -- Daqui para baixo, só conta o que é DESTA conta.
      WHEN conta_id IS DISTINCT FROM p_conta_id THEN 0

      -- ── Título e movimento de extrato: a NATUREZA manda no sinal ──────────
      WHEN tipo IN ('a_receber','a_pagar','movimento_bancario') THEN
        CASE natureza
          WHEN 'receita' THEN  valor
          WHEN 'despesa' THEN -valor
          ELSE 0
        END

      ELSE 0
    END
  ), 0) INTO v_movimento
  FROM public.financeiro_lancamentos
  WHERE conta_id = p_conta_id OR conta_destino_id = p_conta_id;

  UPDATE public.financeiro_contas
  SET saldo_atual = COALESCE(v_saldo_inicial,0) + COALESCE(v_movimento,0), updated_at = now()
  WHERE id = p_conta_id;
END;
$$;

COMMENT ON FUNCTION public.financeiro_recalcular_saldo_conta(uuid) IS
  'saldo_atual = saldo_inicial + o que de fato entrou e saiu. Três regras: só '
  'entra o que está realizado ou conciliado; quem decide o sinal é a NATUREZA, '
  'não o tipo do documento; e transferência com `conta_destino_id` nulo é '
  'perna espelhada, não linha única — confundir os dois fez uma transferência '
  'de R$ 12.000,00 sair duas vezes da mesma conta.';

SELECT public.financeiro_recalcular_saldo_conta(id) FROM public.financeiro_contas;

-- ── Conferência ─────────────────────────────────────────────────────────────
--
-- A "transferência sem par" que a conferência acusava deve sumir:
--
--   SELECT c.categoria, c.descricao, c.valor
--     FROM public.empresas e
--    CROSS JOIN LATERAL public.financeiro_conferencia(e.id) c
--    WHERE c.categoria = 'transferência sem par';
--
-- E os saldos:
--
--   SELECT nome, saldo_inicial, saldo_atual FROM public.financeiro_contas
--    WHERE empresa_id = (SELECT id FROM public.empresas WHERE razao_social ILIKE 'ETHOS%')
--    ORDER BY nome;
```

## 20260829000009 — Revoga a 20260829000008 (premissa falsa)

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Revoga a 20260829000008 — a premissa dela era falsa
-- ═══════════════════════════════════════════════════════════════════════════
--
-- A 20260829000008 trocou o discriminador do ramo de transferência:
--
--     antes:  WHEN tipo = 'transferencia' AND natureza IN ('despesa','receita')
--     depois: WHEN tipo = 'transferencia' AND conta_destino_id IS NULL
--
-- Escrevi que perna espelhada tem `conta_destino_id` nulo. Não verifiquei isso
-- contra os dados. Escrevi a migration, escrevi o comentário longo explicando
-- o raciocínio, e nada disso torna a premissa verdadeira.
--
-- ── O que aconteceu ao aplicar ──────────────────────────────────────────────
--
--   Banpará PJ            2.498.970,22 →  2.132.030,48
--   Bradesco PJ                    ok  →    −10.415,90
--   Caixinha                       ok  →    −70.119,00
--   Inter PJ                       ok  →   −223.671,64
--   Itaú PJ                        ok  → −2.975.953,63
--
-- Quatro contas negativas. `useCasarTransferencia` cria transferência de LINHA
-- ÚNICA com `natureza = 'movimentacao'` E `conta_destino_id` preenchido — e a
-- regra nova mandava linhas com destino preenchido para o ramo de linha única
-- independentemente de já existir a outra perna, contando o mesmo dinheiro
-- duas vezes.
--
-- ── A lição, que é a mesma de sempre ────────────────────────────────────────
--
-- Cada correção desta semana veio de conferir a fórmula contra os dados. Esta
-- veio de olhar a fórmula e raciocinar sobre ela — e o raciocínio estava certo
-- em tese e errado na base. Fórmula de saldo não se corrige por dedução; se
-- corrige medindo antes e depois.
--
-- Este arquivo devolve a fórmula da 20260829000007, que continua valendo:
--   • só entra o que está realizado ou conciliado;
--   • quem decide o sinal é a natureza, não o tipo do documento.
--
-- ── O que fica em aberto ────────────────────────────────────────────────────
--
-- O defeito que a 20260829000008 tentava corrigir É REAL: no Banpará, em
-- 19/03, duas pernas da mesma transferência de R$ 12.000,00 subtraem cada uma.
-- Continua errado, e a conferência segue acusando "transferência sem par".
--
-- Corrigir exige primeiro saber como as duas formas realmente convivem na
-- base. A consulta que responde:
--
--   SELECT natureza,
--          count(*) FILTER (WHERE conta_destino_id IS NULL)     AS sem_destino,
--          count(*) FILTER (WHERE conta_destino_id IS NOT NULL) AS com_destino
--     FROM public.financeiro_lancamentos
--    WHERE tipo = 'transferencia'
--    GROUP BY 1 ORDER BY 1;

CREATE OR REPLACE FUNCTION public.financeiro_recalcular_saldo_conta(p_conta_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saldo_inicial numeric(15,2);
  v_movimento numeric(15,2);
BEGIN
  SELECT saldo_inicial INTO v_saldo_inicial FROM public.financeiro_contas WHERE id = p_conta_id;

  SELECT COALESCE(SUM(
    CASE
      -- Saldo é o dinheiro que ESTÁ na conta.
      WHEN status NOT IN ('realizado','conciliado') THEN 0

      -- Perna espelhada: age só na própria conta_id.
      WHEN tipo = 'transferencia' AND natureza IN ('despesa','receita') THEN
        CASE WHEN conta_id = p_conta_id
             THEN CASE WHEN natureza = 'despesa' THEN -valor ELSE valor END
             ELSE 0 END

      -- Linha única: sai da origem, entra no destino.
      WHEN tipo = 'transferencia' AND conta_id = p_conta_id         THEN -valor
      WHEN tipo = 'transferencia' AND conta_destino_id = p_conta_id THEN  valor

      WHEN conta_id IS DISTINCT FROM p_conta_id THEN 0

      -- A natureza manda no sinal.
      WHEN tipo IN ('a_receber','a_pagar','movimento_bancario') THEN
        CASE natureza
          WHEN 'receita' THEN  valor
          WHEN 'despesa' THEN -valor
          ELSE 0
        END

      ELSE 0
    END
  ), 0) INTO v_movimento
  FROM public.financeiro_lancamentos
  WHERE conta_id = p_conta_id OR conta_destino_id = p_conta_id;

  UPDATE public.financeiro_contas
  SET saldo_atual = COALESCE(v_saldo_inicial,0) + COALESCE(v_movimento,0), updated_at = now()
  WHERE id = p_conta_id;
END;
$$;

COMMENT ON FUNCTION public.financeiro_recalcular_saldo_conta(uuid) IS
  'saldo_atual = saldo_inicial + o que de fato entrou e saiu. Só entra o que '
  'está realizado ou conciliado, e quem decide o sinal é a NATUREZA, não o '
  'tipo do documento. O ramo de transferência ainda conta duas vezes a perna '
  'espelhada cuja natureza é `movimentacao` — defeito conhecido, R$ 12.000,00 '
  'no Banpará em 19/03/2026; a tentativa de corrigi-lo pelo destino nulo '
  '(20260829000008) partiu de premissa falsa e foi revogada.';

SELECT public.financeiro_recalcular_saldo_conta(id) FROM public.financeiro_contas;
```

## 20260829000010 — Aluguel e software não são despesa financeira

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Aluguel e software não são despesa financeira
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Achado de brinde da verificação 13 (categoria repetida), aplicada horas
-- antes. Ela foi criada para encontrar duplicidade de cadastro e acabou
-- expondo outra coisa: ao listar as categorias do grupo `desp_financeira` da
-- ETHOS lado a lado, duas destoavam do resto.
--
--   Despesas Financeiras                       128 lançamentos   ✓
--   Tarifas E Serviços Bancários                41               ✓
--   Sistema De Gestão Empresarial               29               ✗
--   Outras Despesas Financeiras                 12               ✓
--   Juros De Empréstimos e Financeiamentos      11               ✓
--   Aluguel e Ocupação                          10               ✗
--   Tarifas Bancárias                            4 + 3           ✓
--   Juros E Encargos Financeiros Pagos           1               ✓
--
-- Despesa financeira é o CUSTO DO DINHEIRO — juro, tarifa, IOF, desconto
-- concedido, antecipação de recebível. Aluguel e assinatura de software são
-- custo de operar, e vão em `desp_operacional`.
--
-- Não é convenção nem preferência contábil: nenhum arcabouço classifica
-- aluguel como despesa financeira. Por isso a correção não vira coluna de
-- configuração (princípio 7 do CLAUDE.md) — é erro de cadastro, não política
-- de assinante.
--
-- ── O efeito ────────────────────────────────────────────────────────────────
-- 8 lançamentos realizados, R$ 18.229,04 — R$ 12.350,00 de aluguel e
-- R$ 5.879,04 de software. Saem do Resultado Financeiro e entram em Despesas
-- Operacionais. As DUAS linhas do DRE estavam erradas na mesma medida: uma
-- para pior, outra para melhor.
--
-- Os outros lançamentos dessas categorias estão previstos ou cancelados e
-- entram quando forem realizados — já no grupo certo.

UPDATE public.financeiro_categorias
   SET grupo_dre = 'desp_operacional'
 WHERE empresa_id = (SELECT id FROM public.empresas WHERE razao_social ILIKE 'ETHOS%')
   AND grupo_dre = 'desp_financeira'
   AND (nome ILIKE '%aluguel%' OR nome ILIKE '%sistema de gest%');

REFRESH MATERIALIZED VIEW public.mv_financeiro_dre_mensal;

-- ── Conferência ─────────────────────────────────────────────────────────────
--
-- O grupo `desp_financeira` deve conter só custo do dinheiro:
--
--   SELECT c.nome, c.grupo_dre,
--          (SELECT count(*) FROM public.financeiro_lancamentos l
--            WHERE l.categoria_id = c.id) AS lancamentos
--     FROM public.financeiro_categorias c
--    WHERE c.empresa_id = (SELECT id FROM public.empresas WHERE razao_social ILIKE 'ETHOS%')
--      AND c.grupo_dre = 'desp_financeira'
--    ORDER BY 3 DESC;
--
-- ── O que fica em aberto ────────────────────────────────────────────────────
-- A mesma varredura vale para os outros grupos — `desp_operacional`,
-- `receita_bruta`, `deducoes`, `cmv_cps` — e para as outras empresas. Trocar o
-- filtro de `grupo_dre` na consulta acima e ler a lista é o suficiente: quem
-- está no lugar errado destoa dos vizinhos.
```

## 20260829000011 — Funde as categorias duplicadas, e só as que são de fato duplicadas

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Funde as categorias duplicadas, e só as que são de fato duplicadas
-- ═══════════════════════════════════════════════════════════════════════════
--
-- A verificação 13 achou 14 pares de categorias com o mesmo nome dentro da
-- mesma empresa. Medidos um a um, não são o mesmo caso:
--
--   12 pares  uma das duas nunca recebeu lançamento (ou nenhuma recebeu).
--             Apagar a vazia não move dinheiro nenhum.
--
--    1 par    ETHOS · Tarifas Bancárias — AS DUAS em uso, 4 e 3 lançamentos,
--             criadas no mesmo dia. Precisa mover antes de apagar.
--
--    1 par    BAQPLAST · Consultoria Empresarial — NÃO é duplicata: uma tem
--             natureza `receita` (a consultoria que a empresa vende) e outra
--             `despesa` (a que ela contrata). Mesmo nome, coisas opostas.
--             Fundir destruiria informação. Tratada à parte, no fim.
--
-- ── De onde vieram ──────────────────────────────────────────────────────────
-- Os códigos denunciam dois planos de contas concorrentes semeados um por
-- cima do outro: `5.01.01` × `4.3.01` para aluguel, `10.01` × `4.5` para
-- despesas financeiras, `6.1` × `4.5.01` para tarifas. Na ETHOS o segundo
-- plano entrou em 25/08/2026; na MULTIMIX em 02/06; na BAQPLAST em 17/07.
--
-- ── A regra de quem sobrevive ───────────────────────────────────────────────
-- Quem tem mais lançamento. Empate, a mais antiga. Quem manda é o USO, não a
-- antiguidade: a categoria que o dia a dia escolheu é a que as pessoas
-- reconhecem na tela.
--
-- ── O que impede o estrago ──────────────────────────────────────────────────
-- `financeiro_lancamentos.categoria_id` tem ON DELETE RESTRICT. Se este script
-- esquecer de repontar alguma referência, o DELETE FALHA em vez de apagar
-- dado. A rede está armada; este arquivo só não pode se apoiar nela.

-- ── 1. O que vai mudar, guardado antes ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.bkp_categorias_fundidas_20260829 (
  categoria_removida uuid PRIMARY KEY,
  categoria_mantida  uuid NOT NULL,
  empresa_id         uuid NOT NULL,
  nome               text NOT NULL,
  codigo             text,
  natureza           text,
  grupo_dre          text,
  lancamentos_movidos integer NOT NULL DEFAULT 0,
  guardado_em        timestamptz NOT NULL DEFAULT now()
);

-- Só entram pares em que natureza E grupo_dre coincidem. É essa condição que
-- deixa o par da BAQPLAST de fora sozinho, sem lista de exceção escrita à mão
-- — e que protege contra o próximo caso igual que ninguém previu.
INSERT INTO public.bkp_categorias_fundidas_20260829
  (categoria_removida, categoria_mantida, empresa_id, nome, codigo, natureza, grupo_dre)
WITH duplicadas AS (
  SELECT empresa_id, lower(btrim(nome)) AS chave
    FROM public.financeiro_categorias
   GROUP BY 1, 2
  HAVING count(*) > 1
     AND count(DISTINCT natureza) = 1
     AND count(DISTINCT COALESCE(grupo_dre, '(nulo)')) = 1
),
ranqueadas AS (
  SELECT c.id, c.empresa_id, c.nome, c.codigo, c.natureza, c.grupo_dre,
         lower(btrim(c.nome)) AS chave,
         (SELECT count(*) FROM public.financeiro_lancamentos l
           WHERE l.categoria_id = c.id) AS uso,
         row_number() OVER (
           PARTITION BY c.empresa_id, lower(btrim(c.nome))
           ORDER BY (SELECT count(*) FROM public.financeiro_lancamentos l
                      WHERE l.categoria_id = c.id) DESC,
                    c.created_at ASC
         ) AS posicao
    FROM public.financeiro_categorias c
    JOIN duplicadas d ON d.empresa_id = c.empresa_id
                     AND d.chave = lower(btrim(c.nome))
)
SELECT perdedora.id, vencedora.id, perdedora.empresa_id, perdedora.nome,
       perdedora.codigo, perdedora.natureza, perdedora.grupo_dre
  FROM ranqueadas perdedora
  JOIN ranqueadas vencedora
    ON vencedora.empresa_id = perdedora.empresa_id
   AND vencedora.chave = perdedora.chave
   AND vencedora.posicao = 1
 WHERE perdedora.posicao > 1
ON CONFLICT (categoria_removida) DO NOTHING;

-- Quais lançamentos se movem, um a um. Sem isto o backup devolveria a
-- categoria e não separaria de volta os lançamentos que se juntaram — a
-- reversão seria parcial e ninguém saberia disso até precisar dela.
CREATE TABLE IF NOT EXISTS public.bkp_lancamentos_recategorizados_20260829 (
  lancamento_id      uuid PRIMARY KEY,
  categoria_anterior uuid NOT NULL,
  categoria_nova     uuid NOT NULL,
  campo              text NOT NULL,
  guardado_em        timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.bkp_lancamentos_recategorizados_20260829
  (lancamento_id, categoria_anterior, categoria_nova, campo)
SELECT l.id, l.categoria_id, b.categoria_mantida, 'categoria_id'
  FROM public.financeiro_lancamentos l
  JOIN public.bkp_categorias_fundidas_20260829 b ON b.categoria_removida = l.categoria_id
ON CONFLICT (lancamento_id) DO NOTHING;

-- ── 2. Reponta TODAS as referências ─────────────────────────────────────────
-- Cinco colunas apontam para categoria. Esquecer uma faz o DELETE falhar (na
-- que tem RESTRICT) ou deixar referência órfã (nas que não têm).

-- O contador vem do registro dos lançamentos, não de uma contagem ao vivo.
-- A versão anterior contava `financeiro_lancamentos` na hora: rodando o script
-- de novo, a categoria já não existia, os lançamentos já haviam se movido, e a
-- contagem sobrescrevia o número certo por zero. `bkp_lancamentos_...` tem
-- ON CONFLICT DO NOTHING e preserva o primeiro registro — dele o número não
-- foge.
UPDATE public.bkp_categorias_fundidas_20260829 b
   SET lancamentos_movidos = (
     SELECT count(*) FROM public.bkp_lancamentos_recategorizados_20260829 r
      WHERE r.categoria_anterior = b.categoria_removida
   );

UPDATE public.financeiro_lancamentos l
   SET categoria_id = b.categoria_mantida
  FROM public.bkp_categorias_fundidas_20260829 b
 WHERE l.categoria_id = b.categoria_removida;

-- O palpite da conciliação também aponta para categoria.
UPDATE public.financeiro_lancamentos l
   SET categoria_sugerida_id = b.categoria_mantida
  FROM public.bkp_categorias_fundidas_20260829 b
 WHERE l.categoria_sugerida_id = b.categoria_removida;

UPDATE public.fin_conciliacao_regras r
   SET categoria_id = b.categoria_mantida
  FROM public.bkp_categorias_fundidas_20260829 b
 WHERE r.categoria_id = b.categoria_removida;

UPDATE public.financeiro_regras_categorizacao r
   SET categoria_id = b.categoria_mantida
  FROM public.bkp_categorias_fundidas_20260829 b
 WHERE r.categoria_id = b.categoria_removida;

-- Hierarquia: categoria filha da que vai sumir passa a ser filha da que fica.
UPDATE public.financeiro_categorias c
   SET parent_id = b.categoria_mantida
  FROM public.bkp_categorias_fundidas_20260829 b
 WHERE c.parent_id = b.categoria_removida;

-- ── 3. Agora sim, apagar ────────────────────────────────────────────────────
DELETE FROM public.financeiro_categorias c
 USING public.bkp_categorias_fundidas_20260829 b
 WHERE c.id = b.categoria_removida;

REFRESH MATERIALIZED VIEW public.mv_financeiro_dre_mensal;

-- ── 4. O par que NÃO era duplicata ──────────────────────────────────────────
--
-- BAQPLAST · "Consultoria Empresarial" existe duas vezes com naturezas
-- opostas: `1.02.01` é receita (a consultoria que a empresa vende) e `4.03.03`
-- é despesa (a que ela contrata). O nome igual é que confunde — e a de
-- despesa ainda está com `grupo_dre = receita_bruta`, o que somaria despesa
-- dentro da receita bruta no primeiro lançamento que recebesse.
--
-- Renomear resolve as duas coisas: o nome passa a dizer o que é, e o grupo
-- passa a ser o certo. Nenhum lançamento existe ainda, então nada se move.
UPDATE public.financeiro_categorias
   SET nome = 'Consultoria Empresarial Contratada',
       grupo_dre = 'desp_operacional'
 WHERE codigo = '4.03.03'
   AND natureza = 'despesa'
   AND lower(btrim(nome)) = 'consultoria empresarial'
   AND empresa_id = (SELECT id FROM public.empresas
                      WHERE razao_social ILIKE 'BAQPLAST%');

-- ── Conferência ─────────────────────────────────────────────────────────────
--
-- 1. O que foi fundido, e quantos lançamentos cada fusão moveu:
--
--    SELECT nome, codigo, lancamentos_movidos
--      FROM public.bkp_categorias_fundidas_20260829
--     ORDER BY lancamentos_movidos DESC, nome;
--
--    O esperado: 13 linhas, e só "Tarifas Bancárias" com movidos > 0 (3).
--
-- 2. Não deve sobrar duplicata de natureza e grupo iguais:
--
--    SELECT e.razao_social, lower(btrim(c.nome)), count(*)
--      FROM public.financeiro_categorias c
--      JOIN public.empresas e ON e.id = c.empresa_id
--     GROUP BY 1, 2
--    HAVING count(*) > 1
--       AND count(DISTINCT c.natureza) = 1
--       AND count(DISTINCT COALESCE(c.grupo_dre, '(nulo)')) = 1;
--
-- 3. E a conferência deve parar de acusar (sobra o par da BAQPLAST, que agora
--    tem nomes distintos e portanto some também):
--
--    SELECT e.razao_social, c.categoria, c.descricao
--      FROM public.empresas e
--     CROSS JOIN LATERAL public.financeiro_conferencia(e.id) c
--     WHERE c.categoria = 'categoria repetida';
--
-- ── Para desfazer ───────────────────────────────────────────────────────────
-- Duas tabelas guardam o suficiente: `bkp_categorias_fundidas` tem a categoria
-- apagada com todos os seus campos, e `bkp_lancamentos_recategorizados` tem
-- cada lançamento que trocou de dono. A volta é completa.
--
--   -- 1. Recria as categorias apagadas
--   INSERT INTO public.financeiro_categorias
--          (id, empresa_id, nome, codigo, natureza, grupo_dre)
--   SELECT categoria_removida, empresa_id, nome, codigo, natureza, grupo_dre
--     FROM public.bkp_categorias_fundidas_20260829
--   ON CONFLICT (id) DO NOTHING;
--
--   -- 2. Devolve cada lançamento à categoria de origem
--   UPDATE public.financeiro_lancamentos l
--      SET categoria_id = b.categoria_anterior
--     FROM public.bkp_lancamentos_recategorizados_20260829 b
--    WHERE l.id = b.lancamento_id;
--
--   REFRESH MATERIALIZED VIEW public.mv_financeiro_dre_mensal;
--
-- Quando o resultado estiver conferido e a volta não fizer mais falta:
--   DROP TABLE public.bkp_categorias_fundidas_20260829;
--   DROP TABLE public.bkp_lancamentos_recategorizados_20260829;
```

## 20260830000001 — A Ordem de Fornecimento / Nota de Empenho fica no sistema

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- A Ordem de Fornecimento / Nota de Empenho fica no sistema
-- ═══════════════════════════════════════════════════════════════════════════
--
-- O upload de pedido em Gestão de Contratos lê o PDF, manda o texto para a IA,
-- preenche o formulário — e **descarta o arquivo**. Nenhuma chamada a storage,
-- nenhum registro em `contrato_arquivos`.
--
-- É o mesmo defeito que o Financeiro tinha em 25/08 com a NF-e, e a
-- consequência é a mesma: o pedido existe e a AUTORIZAÇÃO dele não. Numa
-- divergência com o órgão sobre quantidade empenhada, é a nota de empenho que
-- se apresenta — e ela não está em lugar nenhum.
--
-- ── E o empenho não é objeto no sistema ─────────────────────────────────────
--
-- `contrato_pedidos` não guarda o número do empenho. Sem ele:
--
--   • não dá para saber quantos pedidos saíram do mesmo empenho;
--   • não dá para avisar quando a soma deles passa o valor empenhado;
--   • o controle de saldo é só contra o contrato inteiro, que é grosso demais
--     — um empenho estimativo de R$ 40 mil pode estourar sem que o contrato
--     de R$ 175 mil dê qualquer sinal.
--
-- O art. 60 da Lei 4.320/64 é claro: despesa não pode ser realizada sem prévio
-- empenho. Controlar consumo sem controlar empenho é controlar metade.

ALTER TABLE public.contrato_pedidos
  ADD COLUMN IF NOT EXISTS numero_empenho     text,
  ADD COLUMN IF NOT EXISTS tipo_empenho       text,
  ADD COLUMN IF NOT EXISTS valor_empenho      numeric(15,2),
  -- O PDF da Ordem/Empenho, guardado em `contrato_arquivos`.
  ADD COLUMN IF NOT EXISTS arquivo_ordem_id   uuid
    REFERENCES public.contrato_arquivos(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.contrato_pedidos.numero_empenho IS
  'Número da nota de empenho que autoriza este pedido (ex.: 2026NE003716). '
  'É por ele que se sabe quantos pedidos saíram do mesmo empenho e se a soma '
  'deles passou o valor empenhado.';

COMMENT ON COLUMN public.contrato_pedidos.tipo_empenho IS
  'ordinario | global | estimativo. Muda o que o saldo significa: no ordinário '
  'o valor é certo e único; no global é o teto de várias entregas; no '
  'estimativo é previsão, e ultrapassar exige reforço.';

COMMENT ON COLUMN public.contrato_pedidos.valor_empenho IS
  'Valor total empenhado no documento — não o do pedido. Um empenho global de '
  'R$ 40.000 pode gerar oito pedidos de R$ 5.000; é contra este número que a '
  'soma deles é conferida.';

COMMENT ON COLUMN public.contrato_pedidos.arquivo_ordem_id IS
  'O PDF da Ordem de Fornecimento ou Nota de Empenho, em contrato_arquivos. '
  'ON DELETE SET NULL: apagado o arquivo, o pedido continua — mas fica '
  'visível que a autorização saiu do sistema.';

ALTER TABLE public.contrato_pedidos
  DROP CONSTRAINT IF EXISTS chk_tipo_empenho;
ALTER TABLE public.contrato_pedidos
  ADD CONSTRAINT chk_tipo_empenho
  CHECK (tipo_empenho IS NULL OR tipo_empenho IN ('ordinario','global','estimativo'))
  NOT VALID;

CREATE INDEX IF NOT EXISTS idx_pedidos_empenho
  ON public.contrato_pedidos(contrato_id, numero_empenho)
  WHERE numero_empenho IS NOT NULL;

-- ── O tipo do arquivo ───────────────────────────────────────────────────────
-- `contrato_arquivos.tipo` é texto livre. Registrar o valor que a tela passa a
-- usar deixa claro para quem vier depois que "ordem_fornecimento" não é um
-- palpite de quem escreveu a tela.
COMMENT ON COLUMN public.contrato_arquivos.tipo IS
  'contrato | aditivo | ata | apostilamento | ordem_fornecimento | outro. '
  'ordem_fornecimento guarda a OF ou a nota de empenho que autoriza um pedido, '
  'ligada de volta por contrato_pedidos.arquivo_ordem_id.';

-- ── Conferência ─────────────────────────────────────────────────────────────
--
-- 1. Pedidos por empenho, com a soma contra o valor empenhado. Linha em que
--    `soma_dos_pedidos` passa `valor_empenho` é despesa sem cobertura:
--
--    SELECT c.numero_contrato, p.numero_empenho, p.tipo_empenho,
--           max(p.valor_empenho)  AS valor_empenho,
--           count(*)              AS pedidos,
--           SUM(p.valor_total)    AS soma_dos_pedidos
--      FROM public.contrato_pedidos p
--      JOIN public.contratos c ON c.id = p.contrato_id
--     WHERE p.numero_empenho IS NOT NULL
--       AND p.status <> 'cancelado'
--     GROUP BY 1, 2, 3
--     ORDER BY SUM(p.valor_total) - max(p.valor_empenho) DESC;
--
-- 2. Pedidos sem a Ordem guardada — os que não têm como provar a autorização:
--
--    SELECT c.numero_contrato, p.numero_pedido, p.data_pedido, p.valor_total
--      FROM public.contrato_pedidos p
--      JOIN public.contratos c ON c.id = p.contrato_id
--     WHERE p.arquivo_ordem_id IS NULL
--       AND p.status <> 'cancelado'
--     ORDER BY p.data_pedido DESC;
```

## 20260830000002 — O empenho autoriza; o pedido consome

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- O empenho autoriza; o pedido consome
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Erro de modelagem meu, da 20260830000001: tratei o empenho como CAMPO do
-- pedido. Ele é outra coisa — é o pai.
--
-- O defeito aparece no contrato 008/2026 da Polícia Militar. O upload da nota
-- de empenho criou DOIS PEDIDOS somando R$ 175.440,00, que é o valor global
-- inteiro. O contrato marca 100% consumido e nenhuma entrega foi feita.
--
-- É a mecânica do empenho global e do estimativo que o modelo não comportava:
--
--   empenho global de 100 pacotes
--     → cliente pede 10 hoje       → NF-e, 10 consumidos
--     → pede 30 amanhã             → NF-e, 40 consumidos
--     → pede 60 depois             → NF-e, 100 — empenho esgotado
--
-- Com o empenho virando pedido, o upload consome os 100 de uma vez, e as três
-- entregas reais somam 200. O contrato estoura sem nada ter sido entregue a
-- mais.
--
-- ── Os três tipos, e por que o modelo precisa distingui-los ─────────────────
--
--   ORDINÁRIO    valor certo, pagamento de uma vez. Um pedido só o consome
--                inteiro. Excesso é irregularidade.
--
--   GLOBAL       valor total conhecido, pagamento parcelado. Vários pedidos
--                até esgotar. Excesso é despesa sem cobertura (Lei 4.320/64,
--                art. 60).
--
--   ESTIMATIVO   montante não determinável — água, energia, combustível.
--                Vários pedidos, e ultrapassar não é erro: exige REFORÇO do
--                empenho antes de continuar.
--
-- A mesma diferença de R$ 5.000 tem três leituras e três providências. Guardar
-- só o número, sem o tipo e sem o total, não permite nenhuma delas.

CREATE TABLE IF NOT EXISTS public.contrato_empenhos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  contrato_id  uuid NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,

  -- Normalizado como AAAANEnnnnnn. O mesmo documento aparece como
  -- "2026NE003716", "2026.260101NE003716" e "2026 NE 003716" — três grafias
  -- viram três empenhos na hora de somar, e o controle de saldo deixa de
  -- existir sem ninguém perceber.
  numero       text NOT NULL,
  tipo         text NOT NULL,
  valor        numeric(15,2),
  quantidade   numeric(15,4),
  unidade      text,
  data_emissao date,

  -- O PDF que autoriza. Fica UMA vez, no empenho, e não repetido em cada
  -- pedido que nasce dele.
  arquivo_id   uuid REFERENCES public.contrato_arquivos(id) ON DELETE SET NULL,
  observacao   text,

  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid
);

COMMENT ON TABLE public.contrato_empenhos IS
  'A nota de empenho que AUTORIZA os pedidos. O empenho autoriza um total; '
  'cada pedido consome parte dele. Antes o empenho era campo do pedido, e o '
  'upload dele consumia o contrato inteiro antes de qualquer entrega.';

COMMENT ON COLUMN public.contrato_empenhos.tipo IS
  'ordinario | global | estimativo. Muda o SENTIDO do excesso: no ordinário é '
  'irregularidade, no global é despesa sem cobertura (art. 60), no estimativo '
  'é rotina que exige reforço antes de continuar.';

COMMENT ON COLUMN public.contrato_empenhos.valor IS
  'O total EMPENHADO — não o de um pedido. É contra ele que a soma dos '
  'pedidos do empenho é conferida.';

COMMENT ON COLUMN public.contrato_empenhos.quantidade IS
  'Quantidade autorizada, quando o empenho a fixa. Empenho global de 100 '
  'pacotes esgota na centésima unidade, não no valor.';

ALTER TABLE public.contrato_empenhos
  DROP CONSTRAINT IF EXISTS chk_empenho_tipo;
ALTER TABLE public.contrato_empenhos
  ADD CONSTRAINT chk_empenho_tipo
  CHECK (tipo IN ('ordinario','global','estimativo'));

-- Um número de empenho é único dentro do contrato: dois registros com o mesmo
-- número seriam dois saldos para a mesma autorização.
CREATE UNIQUE INDEX IF NOT EXISTS idx_empenho_unico
  ON public.contrato_empenhos(contrato_id, numero);

ALTER TABLE public.contrato_empenhos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "empenhos_select" ON public.contrato_empenhos;
CREATE POLICY "empenhos_select" ON public.contrato_empenhos
  FOR SELECT USING (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "empenhos_insert" ON public.contrato_empenhos;
CREATE POLICY "empenhos_insert" ON public.contrato_empenhos
  FOR INSERT WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "empenhos_update" ON public.contrato_empenhos;
CREATE POLICY "empenhos_update" ON public.contrato_empenhos
  FOR UPDATE USING (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "empenhos_delete" ON public.contrato_empenhos;
CREATE POLICY "empenhos_delete" ON public.contrato_empenhos
  FOR DELETE USING (public.is_empresa_admin(auth.uid(), empresa_id));

-- ── O pedido passa a apontar para o empenho ─────────────────────────────────
-- ON DELETE SET NULL, não CASCADE: apagar o empenho não pode apagar entregas
-- que aconteceram. O pedido fica órfão e VISÍVEL, que é o que permite
-- descobrir o engano.
ALTER TABLE public.contrato_pedidos
  ADD COLUMN IF NOT EXISTS empenho_id uuid
    REFERENCES public.contrato_empenhos(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.contrato_pedidos.empenho_id IS
  'O empenho que autoriza este pedido. Nulo em pedido anterior à adesão ao '
  'sistema, ou em contrato sem empenho registrado — e é por isso que a tela '
  'diferencia "sem empenho" de "dentro do empenho".';

CREATE INDEX IF NOT EXISTS idx_pedidos_empenho_id
  ON public.contrato_pedidos(empenho_id) WHERE empenho_id IS NOT NULL;

-- ── O saldo do empenho, derivado ────────────────────────────────────────────
-- Função e não coluna, pela mesma razão que `saldo_atual` do Financeiro passou
-- a ser derivado: número gravado descola do que o originou e mente em
-- silêncio.
CREATE OR REPLACE FUNCTION public.contrato_empenho_saldo(p_empenho_id uuid)
RETURNS TABLE (
  valor_empenhado   numeric,
  valor_consumido   numeric,
  saldo_valor       numeric,
  qtd_empenhada     numeric,
  qtd_consumida     numeric,
  saldo_qtd         numeric,
  pedidos           integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.valor,
         COALESCE(SUM(p.valor_total), 0),
         e.valor - COALESCE(SUM(p.valor_total), 0),
         e.quantidade,
         COALESCE(SUM(p.quantidade), 0),
         e.quantidade - COALESCE(SUM(p.quantidade), 0),
         count(p.id)::int
    FROM public.contrato_empenhos e
    LEFT JOIN public.contrato_pedidos p
           ON p.empenho_id = e.id
          AND p.status <> 'cancelado'
   WHERE e.id = p_empenho_id
   GROUP BY e.id, e.valor, e.quantidade;
$$;

COMMENT ON FUNCTION public.contrato_empenho_saldo(uuid) IS
  'O que resta de um empenho, em valor e em quantidade. Derivado dos pedidos, '
  'nunca gravado: número de saldo que se guarda descola do que o originou.';

GRANT EXECUTE ON FUNCTION public.contrato_empenho_saldo(uuid) TO authenticated;

-- ── Conferência ─────────────────────────────────────────────────────────────
--
--   SELECT e.numero, e.tipo, s.*
--     FROM public.contrato_empenhos e
--    CROSS JOIN LATERAL public.contrato_empenho_saldo(e.id) s
--    ORDER BY s.saldo_valor;
--
-- ── O que NÃO é feito aqui ──────────────────────────────────────────────────
--
-- Os dois "pedidos" do 008/2026 (2026.260101NE003716-1 e -2, somando o valor
-- global inteiro) são o empenho, não entregas. Convertê-los exige decidir se
-- viram UM empenho de R$ 175.440,00 com dois itens, ou dois empenhos — e isso
-- depende do documento, que só quem o tem em mãos pode ler.
--
-- Enquanto não forem convertidos, o contrato segue marcando 100% consumido
-- sem entrega nenhuma. O roteiro está na conversa; a decisão é de quem
-- conhece a nota.
```

## 20260830000003 — Cota principal e cota reservada

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Cota principal e cota reservada
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Os dois "pedidos" do contrato 008/2026 são a mesma coisa dividida em duas:
--
--   2026.260101NE003716-1   306.000 un   R$ 131.580,00   75,0%
--   2026.260101NE003716-2   102.000 un   R$  43.860,00   25,0%
--                           408.000      R$ 175.440,00
--
-- É a divisão do art. 48, III da Lei Complementar 123/2006, ao centavo: em
-- licitação de bem divisível, até 25% do objeto é reservado à disputa
-- exclusiva de ME, EPP e MEI, e o restante vai à ampla concorrência.
--
-- O sistema não conhecia o conceito. Nenhuma coluna, em tabela nenhuma.
--
-- ── Por que precisa existir ─────────────────────────────────────────────────
--
-- Não é rótulo. Três consequências práticas:
--
--   1. O saldo de cada cota é INDEPENDENTE. Esgotada a reservada, a entrega
--      seguinte sai da principal — e isso muda o que se pode faturar. Somar as
--      duas num saldo só esconde exatamente o momento em que uma acaba.
--
--   2. A reservada é executável só por quem mantém o enquadramento. Empresa
--      que ultrapassa o teto do Simples ou cresce para média porte perde o
--      direito a ela; o contrato continua, a cota não.
--
--   3. Empenho e nota fiscal as apresentam separadas. É assim que o órgão
--      confere, e é assim que o dossiê precisa estar.

-- ── A cota no item do contrato ──────────────────────────────────────────────
-- É no item que ela nasce: a licitação divide o LOTE, e o contrato herda a
-- divisão. O pedido descobre sua cota pelo item que consome.
ALTER TABLE public.contrato_itens
  ADD COLUMN IF NOT EXISTS cota text;

COMMENT ON COLUMN public.contrato_itens.cota IS
  'principal | reservada. Divisão do art. 48, III da LC 123/2006: até 25% do '
  'objeto reservado a ME/EPP/MEI, o restante em ampla concorrência. Nulo em '
  'item que não foi dividido — a maioria dos contratos.';

ALTER TABLE public.contrato_itens
  DROP CONSTRAINT IF EXISTS chk_item_cota;
ALTER TABLE public.contrato_itens
  ADD CONSTRAINT chk_item_cota
  CHECK (cota IS NULL OR cota IN ('principal','reservada')) NOT VALID;

-- ── E no item do empenho ────────────────────────────────────────────────────
-- O empenho empenha as duas cotas em linhas separadas, com valores próprios.
-- Guardar só o total do empenho perderia justamente a divisão que interessa.
CREATE TABLE IF NOT EXISTS public.contrato_empenho_itens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  empenho_id    uuid NOT NULL REFERENCES public.contrato_empenhos(id) ON DELETE CASCADE,
  -- O item do contrato que esta linha empenha. Nulo quando o empenho traz
  -- descrição que não casa com nenhum item cadastrado — acontece, e é melhor
  -- guardar solto do que forçar um vínculo errado.
  contrato_item_id uuid REFERENCES public.contrato_itens(id) ON DELETE SET NULL,

  cota          text,
  descricao     text,
  quantidade    numeric(15,4),
  unidade       text,
  valor_unitario numeric(15,4),
  valor_total   numeric(15,2),

  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.contrato_empenho_itens IS
  'As linhas de um empenho. Um empenho de bem divisível traz a cota principal '
  'e a reservada como linhas separadas, com quantidades e valores próprios — '
  'e é por linha que o saldo de cada cota se esgota.';

ALTER TABLE public.contrato_empenho_itens
  DROP CONSTRAINT IF EXISTS chk_empenho_item_cota;
ALTER TABLE public.contrato_empenho_itens
  ADD CONSTRAINT chk_empenho_item_cota
  CHECK (cota IS NULL OR cota IN ('principal','reservada'));

CREATE INDEX IF NOT EXISTS idx_empenho_itens_empenho
  ON public.contrato_empenho_itens(empenho_id);

ALTER TABLE public.contrato_empenho_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "empenho_itens_select" ON public.contrato_empenho_itens;
CREATE POLICY "empenho_itens_select" ON public.contrato_empenho_itens
  FOR SELECT USING (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "empenho_itens_insert" ON public.contrato_empenho_itens;
CREATE POLICY "empenho_itens_insert" ON public.contrato_empenho_itens
  FOR INSERT WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "empenho_itens_update" ON public.contrato_empenho_itens;
CREATE POLICY "empenho_itens_update" ON public.contrato_empenho_itens
  FOR UPDATE USING (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "empenho_itens_delete" ON public.contrato_empenho_itens;
CREATE POLICY "empenho_itens_delete" ON public.contrato_empenho_itens
  FOR DELETE USING (public.is_empresa_admin(auth.uid(), empresa_id));

-- ── O pedido consome de uma cota ────────────────────────────────────────────
ALTER TABLE public.contrato_pedidos
  ADD COLUMN IF NOT EXISTS cota text;

COMMENT ON COLUMN public.contrato_pedidos.cota IS
  'De qual cota esta entrega sai. Herda do item quando ele tem cota definida; '
  'nulo em contrato não dividido.';

ALTER TABLE public.contrato_pedidos
  DROP CONSTRAINT IF EXISTS chk_pedido_cota;
ALTER TABLE public.contrato_pedidos
  ADD CONSTRAINT chk_pedido_cota
  CHECK (cota IS NULL OR cota IN ('principal','reservada')) NOT VALID;

-- ── De onde veio a espécie ──────────────────────────────────────────────────
-- Espécie lida do documento é fato; escolhida à mão é declaração de quem
-- preencheu. Como o mesmo excesso é irregularidade num tipo e rotina noutro,
-- quem confere precisa saber em que dos dois está apoiado.
ALTER TABLE public.contrato_empenhos
  ADD COLUMN IF NOT EXISTS tipo_origem  text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS tipo_trecho  text;

COMMENT ON COLUMN public.contrato_empenhos.tipo_origem IS
  'documento | manual. Como a espécie do empenho foi determinada. A IA só '
  'devolve `documento` quando encontra o campo ROTULADO na nota (ESPÉCIE DE '
  'EMPENHO, TIPO DE EMPENHO); sem rótulo ela devolve nulo e quem tem a nota '
  'escolhe — e aí fica `manual`.';

COMMENT ON COLUMN public.contrato_empenhos.tipo_trecho IS
  'O trecho literal onde a espécie aparece no documento. Permite conferir a '
  'leitura sem reabrir o PDF — o mesmo que se faz com as cláusulas de prazo.';

ALTER TABLE public.contrato_empenhos
  DROP CONSTRAINT IF EXISTS chk_empenho_tipo_origem;
ALTER TABLE public.contrato_empenhos
  ADD CONSTRAINT chk_empenho_tipo_origem
  CHECK (tipo_origem IN ('documento','manual'));

-- ── O saldo POR COTA ────────────────────────────────────────────────────────
-- Derivado, como todo saldo neste sistema. Devolve uma linha por cota do
-- empenho: somar as duas esconderia o momento em que uma acaba.
CREATE OR REPLACE FUNCTION public.contrato_empenho_saldo_por_cota(p_empenho_id uuid)
RETURNS TABLE (
  cota             text,
  valor_empenhado  numeric,
  valor_consumido  numeric,
  saldo_valor      numeric,
  qtd_empenhada    numeric,
  qtd_consumida    numeric,
  saldo_qtd        numeric,
  pedidos          integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH empenhado AS (
    SELECT COALESCE(i.cota, 'principal') AS cota,
           SUM(i.valor_total) AS valor,
           SUM(i.quantidade)  AS qtd
      FROM public.contrato_empenho_itens i
     WHERE i.empenho_id = p_empenho_id
     GROUP BY 1
  ),
  consumido AS (
    SELECT COALESCE(p.cota, 'principal') AS cota,
           SUM(p.valor_total) AS valor,
           SUM(p.quantidade)  AS qtd,
           count(*)::int      AS n
      FROM public.contrato_pedidos p
     WHERE p.empenho_id = p_empenho_id
       AND p.status <> 'cancelado'
     GROUP BY 1
  )
  SELECT COALESCE(e.cota, c.cota),
         COALESCE(e.valor, 0),
         COALESCE(c.valor, 0),
         COALESCE(e.valor, 0) - COALESCE(c.valor, 0),
         COALESCE(e.qtd, 0),
         COALESCE(c.qtd, 0),
         COALESCE(e.qtd, 0) - COALESCE(c.qtd, 0),
         COALESCE(c.n, 0)
    FROM empenhado e
    FULL OUTER JOIN consumido c ON c.cota = e.cota;
$$;

COMMENT ON FUNCTION public.contrato_empenho_saldo_por_cota(uuid) IS
  'O que resta de cada cota do empenho, em valor e em quantidade. Uma linha '
  'por cota: somar principal e reservada num saldo só esconde o momento em '
  'que uma delas acaba, que é justamente quando a informação importa.';

GRANT EXECUTE ON FUNCTION public.contrato_empenho_saldo_por_cota(uuid) TO authenticated;

-- ── Conferência ─────────────────────────────────────────────────────────────
--
--   SELECT e.numero, e.tipo, s.*
--     FROM public.contrato_empenhos e
--    CROSS JOIN LATERAL public.contrato_empenho_saldo_por_cota(e.id) s
--    ORDER BY e.numero, s.cota;
--
-- A proporção, para conferir contra a LC 123: a reservada não pode passar de
-- 25% do objeto.
--
--   SELECT e.numero,
--          SUM(i.valor_total) FILTER (WHERE i.cota = 'reservada')
--            / NULLIF(SUM(i.valor_total), 0) * 100 AS pct_reservada
--     FROM public.contrato_empenhos e
--     JOIN public.contrato_empenho_itens i ON i.empenho_id = e.id
--    GROUP BY 1;

```
