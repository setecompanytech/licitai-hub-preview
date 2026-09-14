-- ============================================================================
-- Robô de Lances integrado ao processo — fundação de dados
--
-- Três lacunas que a tela nova não pode esconder, levantadas em 14/09/2026:
--
--   1. A precificação não tinha VERSÃO. "Salvar precificação" apagava e
--      reinseria as linhas; o piso do robô era digitado à parte, pré-preenchido
--      com o custo. Não havia como dizer "este limite veio da versão 3,
--      aprovada por fulano em tal data".
--   2. Parar o robô gravava `encerrado` no banco ANTES de qualquer confirmação
--      do agente. A tela dizia "parado" para algo que talvez continuasse.
--   3. `sessoes_lance_real` e `lances_historico` eram visíveis só para quem
--      iniciou a sessão. O colega que abre a pasta do processo não via o robô
--      que opera o processo da empresa dele.
--
-- Tudo aqui é ADITIVO: nenhuma coluna é removida, nenhum dado é apagado.
--
-- ── Reversão ────────────────────────────────────────────────────────────────
--   DROP FUNCTION IF EXISTS public.aprovar_precificacao_versao(uuid);
--   DROP FUNCTION IF EXISTS public.limites_operacionais_do_processo(uuid);
--   DROP TABLE IF EXISTS public.precificacao_versao_itens;
--   DROP TABLE IF EXISTS public.precificacao_versoes;   -- depois de soltar as FKs abaixo
--   ALTER TABLE public.robo_lances_disputas DROP COLUMN IF EXISTS precificacao_versao_id,
--     DROP COLUMN IF EXISTS limites_confirmados_versao_id, DROP COLUMN IF EXISTS limites_confirmados_em;
--   ALTER TABLE public.sessoes_lance_real DROP COLUMN IF EXISTS parada_solicitada_em,
--     DROP COLUMN IF EXISTS parada_solicitada_por, DROP COLUMN IF EXISTS parada_confirmada_em,
--     DROP COLUMN IF EXISTS disputa_id, DROP COLUMN IF EXISTS empresa_id;
--   DROP POLICY "Membros da empresa veem as sessões do robô" ON public.sessoes_lance_real;
--   DROP POLICY "Membros da empresa veem os lances das sessões" ON public.lances_historico;
-- ============================================================================

-- ── 0. Quem opera ───────────────────────────────────────────────────────────
--
-- O banco só distinguia "membro" de "admin". `viewer` existia no enum e era
-- barrado apenas na interface. Escrever precificação e ver custo passa a
-- exigir papel que opera (admin ou operador) — é o comportamento que a
-- interface já praticava, agora do lado de quem não pode ser contornado.

CREATE OR REPLACE FUNCTION public.is_empresa_operador(_user_id uuid, _empresa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.empresa_membros
     WHERE user_id = _user_id
       AND empresa_id = _empresa_id
       AND papel IN ('admin', 'operador')
  );
$$;

-- ── 1. Versões da precificação ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.precificacao_versoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  licitacao_id uuid NOT NULL REFERENCES public.licitacoes(id) ON DELETE CASCADE,
  numero integer NOT NULL,
  situacao text NOT NULL DEFAULT 'rascunho'
    CHECK (situacao IN ('rascunho', 'submetida', 'aprovada', 'substituida', 'descartada')),
  -- Critério EFETIVO de disputa. Decide se o limite é unitário, do lote, ou
  -- se limite em reais nem se aplica (maior desconto).
  criterio_disputa text NOT NULL DEFAULT 'nao_informado'
    CHECK (criterio_disputa IN ('menor_preco_item', 'menor_preco_lote', 'maior_desconto', 'outro', 'nao_informado')),
  -- Camadas percentuais (0–100) e a ORIGEM de cada uma: indicador do
  -- Financeiro, configuração tributária, digitado, ou não configurado.
  premissas jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Documentos e versões documentais em que a precificação se apoiou.
  documentos_usados jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_inicial_centavos bigint,
  observacao text,
  criado_por uuid NOT NULL DEFAULT auth.uid(),
  submetida_por uuid,
  submetida_em timestamptz,
  aprovada_por uuid,
  aprovada_em timestamptz,
  substituida_por_versao_id uuid REFERENCES public.precificacao_versoes(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (licitacao_id, numero)
);

COMMENT ON TABLE public.precificacao_versoes IS
  'Versões da precificação de um processo. Aprovada = imutável. Aprovar limites '
  'NÃO envia proposta nem ativa o robô; só produz a referência que ambos usam.';

-- No máximo UMA versão aprovada vigente por processo.
CREATE UNIQUE INDEX IF NOT EXISTS uq_precificacao_versao_aprovada
  ON public.precificacao_versoes (licitacao_id)
  WHERE situacao = 'aprovada';

CREATE INDEX IF NOT EXISTS idx_precificacao_versoes_empresa
  ON public.precificacao_versoes (empresa_id, licitacao_id);

CREATE TABLE IF NOT EXISTS public.precificacao_versao_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  versao_id uuid NOT NULL REFERENCES public.precificacao_versoes(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  -- Identificador ESTÁVEL do item. Nunca casar por descrição ou posição.
  licitacao_item_id uuid REFERENCES public.licitacao_itens(id) ON DELETE SET NULL,
  numero integer NOT NULL,
  lote text,
  descricao text NOT NULL,
  quantidade numeric(18,4) NOT NULL,
  unidade text NOT NULL,
  fornecedor text,
  cotacao_referencia text,
  cotacao_data date,
  cotacao_validade date,
  marca text,
  fabricante text,
  modelo text,
  custo_unitario numeric(18,4),
  frete_unitario numeric(18,4),
  seguro_unitario numeric(18,4),
  outras_despesas_unitario numeric(18,4),
  valor_estimado_orgao numeric(18,4),
  -- Dinheiro de preço em CENTAVOS inteiros: o arredondamento acontece uma vez,
  -- no cálculo, e o banco guarda o resultado — não uma fração a arredondar de novo.
  preco_sugerido_centavos bigint,
  preco_inicial_centavos bigint,
  limite_centavos bigint,
  autorizado boolean NOT NULL DEFAULT true,
  memoria jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_precificacao_versao_itens_versao
  ON public.precificacao_versao_itens (versao_id);

-- empresa_id da versão = empresa do processo. Sem isto, uma versão poderia
-- ser gravada para a empresa A apontando para o processo da empresa B.
CREATE OR REPLACE FUNCTION public.precificacao_versoes_conferir_empresa()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE v_empresa uuid;
BEGIN
  SELECT empresa_id INTO v_empresa FROM public.licitacoes WHERE id = NEW.licitacao_id;
  IF v_empresa IS NULL OR v_empresa <> NEW.empresa_id THEN
    RAISE EXCEPTION 'A versão precisa pertencer à mesma empresa do processo.';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_precificacao_versoes_empresa ON public.precificacao_versoes;
CREATE TRIGGER trg_precificacao_versoes_empresa
  BEFORE INSERT ON public.precificacao_versoes
  FOR EACH ROW EXECUTE FUNCTION public.precificacao_versoes_conferir_empresa();

-- Imutabilidade. Rascunho edita livremente; submetida só volta a rascunho ou
-- é aprovada (pela função de aprovação); aprovada só passa a substituída.
CREATE OR REPLACE FUNCTION public.precificacao_versoes_proteger()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.situacao <> 'rascunho' THEN
      RAISE EXCEPTION 'Só rascunho pode ser excluído. Versão % está %.', OLD.numero, OLD.situacao;
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.situacao IN ('aprovada', 'substituida', 'descartada') THEN
    IF OLD.situacao = 'aprovada' AND NEW.situacao = 'substituida'
       AND NEW.premissas = OLD.premissas
       AND NEW.criterio_disputa = OLD.criterio_disputa
       AND NEW.total_inicial_centavos IS NOT DISTINCT FROM OLD.total_inicial_centavos
       AND NEW.aprovada_por IS NOT DISTINCT FROM OLD.aprovada_por
       AND NEW.aprovada_em IS NOT DISTINCT FROM OLD.aprovada_em THEN
      NEW.updated_at := now();
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Versão % está % e não pode ser alterada. Crie uma nova revisão.', OLD.numero, OLD.situacao;
  END IF;

  -- Aprovar só pela função, que confere papel e pendências no servidor.
  IF NEW.situacao = 'aprovada' AND current_setting('praefectus.aprovando', true) IS DISTINCT FROM 'sim' THEN
    RAISE EXCEPTION 'Aprovação só pela função aprovar_precificacao_versao.';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_precificacao_versoes_proteger ON public.precificacao_versoes;
CREATE TRIGGER trg_precificacao_versoes_proteger
  BEFORE UPDATE OR DELETE ON public.precificacao_versoes
  FOR EACH ROW EXECUTE FUNCTION public.precificacao_versoes_proteger();

CREATE OR REPLACE FUNCTION public.precificacao_versao_itens_proteger()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE v_situacao text;
BEGIN
  SELECT situacao INTO v_situacao
    FROM public.precificacao_versoes
   WHERE id = COALESCE(NEW.versao_id, OLD.versao_id);
  -- Exclusão em cascata da própria versão (rascunho) chega aqui sem pai.
  IF v_situacao IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF v_situacao <> 'rascunho' THEN
    RAISE EXCEPTION 'Itens de uma versão % não podem ser alterados.', v_situacao;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_precificacao_versao_itens_proteger ON public.precificacao_versao_itens;
CREATE TRIGGER trg_precificacao_versao_itens_proteger
  BEFORE INSERT OR UPDATE OR DELETE ON public.precificacao_versao_itens
  FOR EACH ROW EXECUTE FUNCTION public.precificacao_versao_itens_proteger();

ALTER TABLE public.precificacao_versoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.precificacao_versao_itens ENABLE ROW LEVEL SECURITY;

-- Ver custo e premissas: quem opera. `viewer` consulta limites pela função
-- `limites_operacionais_do_processo`, que não devolve custo.
DROP POLICY IF EXISTS "Operadores veem versões da precificação" ON public.precificacao_versoes;
CREATE POLICY "Operadores veem versões da precificação"
ON public.precificacao_versoes FOR SELECT TO authenticated
USING (public.is_empresa_operador(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "Operadores criam versões da precificação" ON public.precificacao_versoes;
CREATE POLICY "Operadores criam versões da precificação"
ON public.precificacao_versoes FOR INSERT TO authenticated
WITH CHECK (public.is_empresa_operador(auth.uid(), empresa_id) AND situacao = 'rascunho');

DROP POLICY IF EXISTS "Operadores revisam versões da precificação" ON public.precificacao_versoes;
CREATE POLICY "Operadores revisam versões da precificação"
ON public.precificacao_versoes FOR UPDATE TO authenticated
USING (public.is_empresa_operador(auth.uid(), empresa_id))
WITH CHECK (public.is_empresa_operador(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "Operadores excluem rascunhos" ON public.precificacao_versoes;
CREATE POLICY "Operadores excluem rascunhos"
ON public.precificacao_versoes FOR DELETE TO authenticated
USING (public.is_empresa_operador(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "Operadores veem itens da versão" ON public.precificacao_versao_itens;
CREATE POLICY "Operadores veem itens da versão"
ON public.precificacao_versao_itens FOR SELECT TO authenticated
USING (public.is_empresa_operador(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "Operadores gravam itens da versão" ON public.precificacao_versao_itens;
CREATE POLICY "Operadores gravam itens da versão"
ON public.precificacao_versao_itens FOR ALL TO authenticated
USING (public.is_empresa_operador(auth.uid(), empresa_id))
WITH CHECK (public.is_empresa_operador(auth.uid(), empresa_id));

-- ── 2. Aprovar limites ──────────────────────────────────────────────────────
--
-- Confere NO SERVIDOR o que a tela também confere: papel de admin, versão em
-- rascunho ou submetida, ao menos um item autorizado, todo item autorizado
-- com preço inicial e limite, limite nunca acima do preço inicial. A versão
-- aprovada anterior vira `substituida` na mesma transação — nenhum instante
-- com duas vigentes, nenhum com zero por falha no meio.
--
-- NÃO toca em robo_lances_disputas: disputa em andamento só troca de limite
-- por ação própria, com diferenças à vista e confirmação do serviço.

CREATE OR REPLACE FUNCTION public.aprovar_precificacao_versao(p_versao_id uuid)
RETURNS public.precificacao_versoes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.precificacao_versoes;
  v_autorizados integer;
  v_incompletos integer;
BEGIN
  SELECT * INTO v FROM public.precificacao_versoes WHERE id = p_versao_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Versão não encontrada.';
  END IF;
  IF NOT public.is_empresa_admin(auth.uid(), v.empresa_id) THEN
    RAISE EXCEPTION 'Aprovar limites exige administrador da empresa.';
  END IF;
  IF v.situacao NOT IN ('rascunho', 'submetida') THEN
    RAISE EXCEPTION 'Versão % está % e não pode ser aprovada.', v.numero, v.situacao;
  END IF;
  IF v.criterio_disputa IN ('nao_informado', 'maior_desconto', 'outro') THEN
    RAISE EXCEPTION 'Critério de disputa "%" não tem limite em reais aprovável.', v.criterio_disputa;
  END IF;

  SELECT count(*) FILTER (WHERE autorizado),
         count(*) FILTER (WHERE autorizado AND (
           preco_inicial_centavos IS NULL OR limite_centavos IS NULL
           OR limite_centavos <= 0 OR limite_centavos > preco_inicial_centavos))
    INTO v_autorizados, v_incompletos
    FROM public.precificacao_versao_itens WHERE versao_id = v.id;

  IF v_autorizados = 0 THEN
    RAISE EXCEPTION 'Nenhum item autorizado nesta versão.';
  END IF;
  IF v_incompletos > 0 THEN
    RAISE EXCEPTION '% item(ns) autorizado(s) sem preço inicial ou com limite inválido.', v_incompletos;
  END IF;

  PERFORM set_config('praefectus.aprovando', 'sim', true);

  UPDATE public.precificacao_versoes
     SET situacao = 'substituida', substituida_por_versao_id = v.id
   WHERE licitacao_id = v.licitacao_id AND situacao = 'aprovada' AND id <> v.id;

  UPDATE public.precificacao_versoes
     SET situacao = 'aprovada', aprovada_por = auth.uid(), aprovada_em = now()
   WHERE id = v.id
  RETURNING * INTO v;

  PERFORM set_config('praefectus.aprovando', '', true);
  RETURN v;
END $$;

REVOKE ALL ON FUNCTION public.aprovar_precificacao_versao(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aprovar_precificacao_versao(uuid) TO authenticated;

-- Limites para quem OPERA sem ver custo: número, lote, preço inicial e limite
-- da versão aprovada vigente. Nenhum custo, nenhuma premissa.
CREATE OR REPLACE FUNCTION public.limites_operacionais_do_processo(p_licitacao_id uuid)
RETURNS TABLE (
  versao_id uuid, versao_numero integer, aprovada_em timestamptz, criterio_disputa text,
  licitacao_item_id uuid, numero integer, lote text, descricao text,
  preco_inicial_centavos bigint, limite_centavos bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.id, v.numero, v.aprovada_em, v.criterio_disputa,
         i.licitacao_item_id, i.numero, i.lote, i.descricao,
         i.preco_inicial_centavos, i.limite_centavos
    FROM public.precificacao_versoes v
    JOIN public.precificacao_versao_itens i ON i.versao_id = v.id
   WHERE v.licitacao_id = p_licitacao_id
     AND v.situacao = 'aprovada'
     AND i.autorizado
     AND public.is_empresa_member(auth.uid(), v.empresa_id)
   ORDER BY i.lote NULLS FIRST, i.numero;
$$;

REVOKE ALL ON FUNCTION public.limites_operacionais_do_processo(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.limites_operacionais_do_processo(uuid) TO authenticated;

-- ── 3. Disputa ↔ versão aprovada ────────────────────────────────────────────
--
-- `precificacao_versao_id`: a versão de onde a configuração tirou os limites.
-- `limites_confirmados_*`: a versão que o SERVIÇO DE EXECUÇÃO confirmou ter
-- aplicado. Ficam separados porque são afirmações diferentes — e a tela exibe
-- como "ativo" só o segundo.

ALTER TABLE public.robo_lances_disputas
  ADD COLUMN IF NOT EXISTS precificacao_versao_id uuid
    REFERENCES public.precificacao_versoes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS limites_confirmados_versao_id uuid
    REFERENCES public.precificacao_versoes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS limites_confirmados_em timestamptz;

-- ── 4. Sessão do robô: empresa, disputa e parada em dois tempos ─────────────

ALTER TABLE public.sessoes_lance_real
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS disputa_id uuid REFERENCES public.robo_lances_disputas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS parada_solicitada_em timestamptz,
  ADD COLUMN IF NOT EXISTS parada_solicitada_por uuid,
  ADD COLUMN IF NOT EXISTS parada_confirmada_em timestamptz;

COMMENT ON COLUMN public.sessoes_lance_real.parada_confirmada_em IS
  'Preenchida só quando o agente responde que encerrou. Parada solicitada sem '
  'esta coluna é "aguardando confirmação", nunca "parado".';

-- Empresa pelo processo; disputa pelo id de configuração quando ele for o da
-- disputa. Linhas sem correspondência ficam como estão — visíveis ao dono.
UPDATE public.sessoes_lance_real s
   SET empresa_id = l.empresa_id
  FROM public.licitacoes l
 WHERE s.licitacao_id = l.id
   AND s.empresa_id IS NULL;

UPDATE public.sessoes_lance_real s
   SET disputa_id = d.id,
       empresa_id = COALESCE(s.empresa_id, d.empresa_id)
  FROM public.robo_lances_disputas d
 WHERE s.lance_config_id = d.id::text
   AND s.disputa_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_sessoes_lance_real_empresa
  ON public.sessoes_lance_real (empresa_id, licitacao_id);

-- Leitura pela equipe. A policy antiga (dono) continua: as duas somam.
DROP POLICY IF EXISTS "Membros da empresa veem as sessões do robô" ON public.sessoes_lance_real;
CREATE POLICY "Membros da empresa veem as sessões do robô"
ON public.sessoes_lance_real FOR SELECT TO authenticated
USING (empresa_id IS NOT NULL AND public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "Membros da empresa veem os lances das sessões" ON public.lances_historico;
CREATE POLICY "Membros da empresa veem os lances das sessões"
ON public.lances_historico FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.sessoes_lance_real s
   WHERE s.id = lances_historico.sessao_id
     AND s.empresa_id IS NOT NULL
     AND public.is_empresa_member(auth.uid(), s.empresa_id)
));

-- ── Conferência ─────────────────────────────────────────────────────────────
DO $$
DECLARE v_com_empresa integer; v_sem_empresa integer;
BEGIN
  SELECT count(*) FILTER (WHERE empresa_id IS NOT NULL), count(*) FILTER (WHERE empresa_id IS NULL)
    INTO v_com_empresa, v_sem_empresa
    FROM public.sessoes_lance_real;
  RAISE NOTICE 'Sessões do robô com empresa: % · sem empresa (visíveis só ao dono): %', v_com_empresa, v_sem_empresa;
END $$;

NOTIFY pgrst, 'reload schema';
