import { Info } from 'lucide-react';

export type Procedencia = {
  /** O número, com o nome exato que aparece na tela. */
  numero: string;
  /** De onde ele sai — a conta, a tabela, o campo. */
  origem: string;
  /** Onde se muda esse número. Ausente quando não há como editá-lo à mão. */
  ondeEditar?: string;
};

type Props = {
  itens: Procedencia[];
  /** Fecha o bloco. O padrão serve para painel derivado de outra tela. */
  fecho?: string;
};

/**
 * Declara de onde vem cada número do painel.
 *
 * É a resposta escrita para a pergunta que todo mundo faz olhando um número
 * em tela — "isso saiu de onde?" — e que hoje só se responde lendo o código.
 *
 * Não é documentação por gentileza. Esta semana três defeitos nasceram da
 * mesma causa: dois lugares mandando no mesmo número sem que nada na tela
 * dissesse qual mandava. O saldo tinha duas autoridades; `grupo_dre` tinha
 * três réguas; a meta tinha duas portas. Um painel que declara a própria
 * procedência não impede o defeito, mas o torna visível para quem usa —
 * antes de virar diferença de R$ 48.907,10 que só o extrato do banco pega.
 *
 * O texto fica na tela E no papel: quem recebe o documento impresso é
 * exatamente quem não tem como abrir o sistema para conferir.
 */
export default function DeOndeVem({
  itens,
  fecho = 'Edite sempre na origem — este painel acompanha sozinho.',
}: Props) {
  if (itens.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-1.5">
        <Info className="w-3.5 h-3.5" />
        De onde vêm estes números
      </h4>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {itens.map((it, i) => (
          <span key={it.numero}>
            {i > 0 && <span className="mx-1.5 opacity-40">•</span>}
            <strong className="font-semibold text-foreground/80">{it.numero}</strong>
            {' = '}
            {it.origem}
            {it.ondeEditar && <span className="italic"> (muda em {it.ondeEditar})</span>}
          </span>
        ))}
        {fecho && <span className="block mt-1.5">{fecho}</span>}
      </p>
    </div>
  );
}
