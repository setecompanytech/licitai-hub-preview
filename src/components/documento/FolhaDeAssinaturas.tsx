export type Signatario = {
  /** O papel — "Gestor do contrato", "Responsável técnico". Sempre impresso. */
  papel: string;
  /** Se o sistema conhece o nome, ele já vem escrito. Senão, a linha vai vazia. */
  nome?: string | null;
  /** Matrícula, CPF, CREA — o que aquele papel exigir. */
  documento?: string | null;
};

type Props = {
  signatarios: Signatario[];
  /** Cidade da assinatura. Sem ela a linha de local/data não é impressa. */
  local?: string | null;
};

/**
 * O bloco de assinaturas — o que transforma uma tela impressa em documento.
 *
 * Fica só no papel, e é deliberado: assinatura na tela seria promessa falsa
 * (não há assinatura eletrônica aqui, e fingir que há é pior do que não ter).
 * No papel ela cumpre o que o processo administrativo exige — alguém assume
 * o que está escrito.
 *
 * O nome vem preenchido quando o sistema o conhece, porque linha em branco
 * que já podia estar escrita é retrabalho. O que ele nunca preenche é a
 * assinatura em si.
 */
export default function FolhaDeAssinaturas({ signatarios, local }: Props) {
  if (signatarios.length === 0) return null;
  const hoje = new Date();

  return (
    <section className="so-impresso mt-10 bloco-inteiro">
      {local && (
        <p className="text-[12px] mb-8 text-right">
          {local}, {hoje.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}.
        </p>
      )}

      <div
        className="grid gap-x-10 gap-y-8"
        style={{ gridTemplateColumns: `repeat(${Math.min(signatarios.length, 3)}, minmax(0, 1fr))` }}
      >
        {signatarios.map((s, i) => (
          <div key={i} className="text-center">
            {/* A linha primeiro, o nome embaixo: é onde a caneta encosta. */}
            <div className="border-t border-black mt-12 mb-1.5" />
            <p className="text-[12px] font-semibold leading-tight">{s.nome || ' '}</p>
            <p className="text-[10.5px] leading-tight">{s.papel}</p>
            {s.documento && <p className="text-[10px] leading-tight">{s.documento}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
