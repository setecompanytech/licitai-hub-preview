-- ═══════════════════════════════════════════════════════════════════════════
-- Assinatura lida × assinatura conferida
-- ═══════════════════════════════════════════════════════════════════════════
--
-- O contrato 008/2026 está assinado pelas DUAS partes — o Comandante-Geral da
-- PMPA de um lado, e a contratada do outro, com certificado ICP-Brasil. Mesmo
-- assim o painel exibe "Assinado por apenas uma das partes · Não inicie a
-- execução", em vermelho, no topo.
--
-- A leitura errou. Isso vai acontecer: a assinatura digital é desenhada pelo
-- fluxo de aparência do PDF e nem sempre entra na camada de texto, o carimbo
-- vem em caixa própria, e o nome da contratada aparece rotulado "Contratado".
-- Qualquer um desses basta para o lado ser perdido.
--
-- ── O defeito não é a leitura errada; é não haver como corrigi-la ───────────
--
-- `assinatura_situacao` só podia ser escrita pela extração. Quem tem o papel
-- na mão e vê as duas assinaturas não tinha como dizer isso ao sistema.
--
-- Um alerta crítico que a pessoa sabe estar errado e não pode desligar não
-- vira ruído só ele: ensina que os alertas daquele painel podem ser ignorados.
-- E os outros ali são verdadeiros — falta de Extrato do Fiscal, contrato sem
-- eficácia, prazo vencido.

ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS assinatura_origem text NOT NULL DEFAULT 'documento';

COMMENT ON COLUMN public.contratos.assinatura_origem IS
  'documento | conferido. Como `assinatura_situacao` foi determinada: lida do '
  'PDF pela extração, ou afirmada por quem tem o instrumento em mãos. A '
  'diferença importa porque a leitura erra — assinatura digital nem sempre '
  'entra na camada de texto — e porque quem confere depois precisa saber se '
  'está apoiado no papel ou na máquina.';

ALTER TABLE public.contratos
  DROP CONSTRAINT IF EXISTS chk_assinatura_origem;
ALTER TABLE public.contratos
  ADD CONSTRAINT chk_assinatura_origem
  CHECK (assinatura_origem IN ('documento','conferido'));

-- ── A releitura não pode desfazer a conferência ─────────────────────────────
--
-- Sem isto, reler o documento sobrescreveria `assinatura_situacao` com o mesmo
-- erro de leitura, e o alerta voltaria — depois de alguém já ter conferido o
-- papel. O gatilho protege o que foi afirmado por gente.
CREATE OR REPLACE FUNCTION public.tg_preserva_assinatura_conferida()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.assinatura_origem = 'conferido'
     AND NEW.assinatura_origem <> 'conferido'
     AND NEW.assinatura_situacao IS DISTINCT FROM OLD.assinatura_situacao THEN
    NEW.assinatura_situacao := OLD.assinatura_situacao;
    NEW.assinatura_origem   := 'conferido';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.tg_preserva_assinatura_conferida() IS
  'Impede que a releitura automática sobrescreva uma situação de assinatura '
  'conferida por pessoa. Máquina não desfaz o que gente afirmou olhando o '
  'documento — o caminho de volta é conferir de novo, à mão.';

DROP TRIGGER IF EXISTS trg_preserva_assinatura_conferida ON public.contratos;
CREATE TRIGGER trg_preserva_assinatura_conferida
  BEFORE UPDATE OF assinatura_situacao ON public.contratos
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_preserva_assinatura_conferida();

-- ── Conferência ─────────────────────────────────────────────────────────────
--
--   SELECT numero_contrato, assinatura_situacao, assinatura_origem,
--          assinatura_observacao
--     FROM public.contratos
--    WHERE assinatura_situacao IS NOT NULL
--    ORDER BY assinatura_origem, numero_contrato;
--
-- `assinatura_observacao` guarda os dois lados COMO FORAM LIDOS. É por ela que
-- se vê onde a extração falhou — no 008/2026 deve trazer o órgão e não a
-- contratada.
