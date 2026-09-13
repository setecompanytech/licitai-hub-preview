-- ============================================================================
-- Histórico de conversas da AURÉLIA
--
-- Até aqui a conversa vivia em `useState`: fechar o painel guardava, recarregar
-- a página apagava. Quem pedia uma análise de edital, saía para conferir o
-- documento e voltava, encontrava a tela em branco — e refazia a pergunta, com
-- outro gasto de IA e outra resposta, que raramente é igual à primeira.
--
-- O "Nova consulta" que existia era só um `setMessages`: não abria nada novo,
-- apagava o que havia. Agora abrir uma conversa nova preserva a anterior, que
-- é o que "novo" significa em qualquer outro lugar do sistema.
--
-- CONVERSA É PESSOAL, como `processos_interesse` e `monitoramento_editais`
-- (CLAUDE.md, princípio 2): o dono é `user_id`, e colega da mesma empresa não
-- lê a conversa alheia. `empresa_id` entra como CONTEXTO — a AURÉLIA responde
-- sobre os processos da empresa ativa, e o histórico precisa saber de qual —,
-- nunca como chave de compartilhamento.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.aurelia_conversas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Nulo quando a pessoa conversou sem empresa ativa. Não é erro: a AURÉLIA
  -- responde dúvida de lei sem precisar de empresa nenhuma.
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,

  -- Primeira pergunta, aparada. Serve de nome na lista do histórico, que é o
  -- que a pessoa reconhece — melhor que "Conversa de 13/09 às 19:08", porque
  -- ninguém lembra a hora em que perguntou, e sim o que perguntou.
  titulo text,

  -- Onde a pessoa estava quando começou. Uma dúvida feita dentro do dossiê de
  -- um processo é outra coisa que a mesma frase feita no painel.
  rota_origem text,

  -- Reordena a lista sem varrer as mensagens: o histórico é lido toda vez que
  -- o painel abre, e a conversa mais recente é a que interessa.
  ultima_mensagem_em timestamptz NOT NULL DEFAULT now(),
  total_mensagens integer NOT NULL DEFAULT 0,

  arquivada_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.aurelia_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id uuid NOT NULL REFERENCES public.aurelia_conversas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  papel text NOT NULL CHECK (papel IN ('user', 'assistant')),
  conteudo text NOT NULL,

  -- Ordem explícita, e não `created_at`: duas mensagens gravadas no mesmo
  -- milissegundo (a pergunta e o início da resposta) embaralhariam a conversa,
  -- e conversa fora de ordem é pior que conversa perdida.
  ordem integer NOT NULL,

  -- Ferramenta que a AURÉLIA executou para responder (buscar_edital,
  -- consultar_historico_precos…). Guardar isto é o que permite, relendo a
  -- conversa, distinguir o que ela consultou do que ela concluiu.
  ferramenta text,

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_aurelia_mensagem_ordem UNIQUE (conversa_id, ordem)
);

CREATE INDEX IF NOT EXISTS idx_aurelia_conversas_recentes
  ON public.aurelia_conversas (user_id, ultima_mensagem_em DESC)
  WHERE arquivada_em IS NULL;

CREATE INDEX IF NOT EXISTS idx_aurelia_mensagens_conversa
  ON public.aurelia_mensagens (conversa_id, ordem);

COMMENT ON TABLE public.aurelia_conversas IS
  'Conversas com a AURÉLIA. PESSOAL por user_id — colega da mesma empresa não lê a conversa alheia. empresa_id é contexto, não chave de compartilhamento.';
COMMENT ON COLUMN public.aurelia_conversas.titulo IS
  'Primeira pergunta aparada. É o que a pessoa reconhece na lista; data e hora, não.';
COMMENT ON COLUMN public.aurelia_mensagens.ordem IS
  'Ordem explícita. created_at não basta: pergunta e início da resposta caem no mesmo milissegundo.';

-- `updated_at` sem gatilho é coluna que mente — nasce com now() e congela ali.
DROP TRIGGER IF EXISTS trg_aurelia_conversas_updated_at ON public.aurelia_conversas;
CREATE TRIGGER trg_aurelia_conversas_updated_at
  BEFORE UPDATE ON public.aurelia_conversas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── RLS: a conversa é de quem conversou ─────────────────────────────────────
ALTER TABLE public.aurelia_conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aurelia_mensagens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dono gerencia a propria conversa" ON public.aurelia_conversas;
CREATE POLICY "dono gerencia a propria conversa" ON public.aurelia_conversas
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "dono gerencia as proprias mensagens" ON public.aurelia_mensagens;
CREATE POLICY "dono gerencia as proprias mensagens" ON public.aurelia_mensagens
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── O resumo da conversa acompanha as mensagens ─────────────────────────────
--
-- Mantido por gatilho, e não pelo front, por dois motivos. O primeiro é que a
-- resposta da AURÉLIA chega em streaming: o front grava a mensagem no fim, e
-- se a pessoa fechar a aba no meio a contagem ficaria errada para sempre. O
-- segundo é que contagem calculada em dois lugares diverge — e aqui ela decide
-- a ordem da lista, então divergir significa a conversa de ontem aparecendo
-- na frente da de agora.
CREATE OR REPLACE FUNCTION public.aurelia_resumir_conversa()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_conversa uuid := COALESCE(NEW.conversa_id, OLD.conversa_id);
BEGIN
  UPDATE public.aurelia_conversas c
     SET total_mensagens = (
           SELECT count(*) FROM public.aurelia_mensagens m WHERE m.conversa_id = v_conversa
         ),
         ultima_mensagem_em = COALESCE(
           (SELECT max(m.created_at) FROM public.aurelia_mensagens m WHERE m.conversa_id = v_conversa),
           c.created_at
         ),
         -- O título nasce da primeira pergunta e não muda depois: renomear a
         -- conversa a cada mensagem faria a lista dançar sob os olhos de quem
         -- está procurando nela.
         titulo = COALESCE(
           c.titulo,
           NULLIF(left((SELECT m.conteudo FROM public.aurelia_mensagens m
                         WHERE m.conversa_id = v_conversa AND m.papel = 'user'
                         ORDER BY m.ordem LIMIT 1), 80), '')
         )
   WHERE c.id = v_conversa;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  -- O resumo é reflexo da conversa, nunca obstáculo a ela.
  RAISE WARNING 'aurelia_resumir_conversa: %', SQLERRM;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_aurelia_resumir_conversa ON public.aurelia_mensagens;
CREATE TRIGGER trg_aurelia_resumir_conversa
  AFTER INSERT OR UPDATE OR DELETE ON public.aurelia_mensagens
  FOR EACH ROW EXECUTE FUNCTION public.aurelia_resumir_conversa();

NOTIFY pgrst, 'reload schema';
