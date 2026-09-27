import { Info } from 'lucide-react';
import SecaoRecolhivel from '@/components/ui/secao-recolhivel';

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
  /**
   * Com identidade, o bloco nasce recolhido e lembra quem o abriu (27/09: no
   * Resumo do contrato o parágrafo ocupava uma dobra inteira em toda visita).
   * No papel ele sai inteiro, recolhido ou não — é para quem não pode abrir
   * o sistema que ele existe.
   */
  id?: string;
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
  id,
}: Props) {
  if (itens.length === 0) return null;

  const titulo = (
    <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
      De onde vêm estes números
    </span>
  );
  const corpo = (
    <p className="text-xs leading-relaxed text-muted-foreground">
        {itens.map((it, i) => (
          <span key={it.numero}>
            {i > 0 && <span className="mx-2 text-muted-foreground">•</span>}
            <strong className="font-semibold text-foreground">{it.numero}</strong>
            {' = '}
            {it.origem}
            {it.ondeEditar && <span className="italic"> (muda em {it.ondeEditar})</span>}
          </span>
        ))}
        {fecho && <span className="mt-2 block">{fecho}</span>}
    </p>
  );

  if (id) {
    return (
      <SecaoRecolhivel
        id={id}
        titulo={titulo}
        recolhidaPorPadrao
        manterNoPapel
        className="rounded-lg border border-border bg-secondary p-4"
        classNameIcone="text-muted-foreground"
      >
        <div className="mt-2">{corpo}</div>
      </SecaoRecolhivel>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-secondary p-4">
      <h4 className="mb-2">{titulo}</h4>
      {corpo}
    </div>
  );
}
