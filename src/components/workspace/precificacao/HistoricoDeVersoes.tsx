import { useMemo } from 'react';
import SeloSituacao from '@/components/gestao/SeloSituacao';
import {
  diferencasEntreVersoes,
  type Diferenca,
  type ItemCalculado,
  type PremissasDaVersao,
} from '@/lib/precificacao/versao';
import { recalcularVersao, type VersaoDePrecificacao } from '@/hooks/usePrecificacaoVersoes';
import {
  dataHoraDeBrasilia,
  formatarCentavos,
  formatarReais,
  formatPercentual,
  ORDEM_DAS_CAMADAS,
  ROTULO_DA_CAMADA,
  ROTULO_DO_CRITERIO,
  SITUACAO_DA_VERSAO,
} from './formato';

/**
 * As versões do processo e, antes de aprovar, o que muda em relação à vigente.
 *
 * A versão aprovada é RECALCULADA a partir das linhas e premissas gravadas —
 * não lida dos centavos gravados — para que as duas pontas da comparação
 * passem pelo mesmo `calcularVersao`. Se um dia a regra de cálculo mudar, a
 * diferença aparece aqui como diferença, em vez de ficar escondida entre um
 * número gravado e outro recalculado.
 */
function descrever(d: Diferenca): string {
  const centavos = (v: number | boolean | null) => formatarCentavos(v as number | null);
  switch (d.campo) {
    case 'incluido':
      return `Entra nesta revisão — limite ${centavos(d.para)}`;
    case 'removido':
      return `Sai desta revisão — limite era ${centavos(d.de)}`;
    case 'autorizado':
      return d.para ? 'Volta a ser autorizado para disputa' : 'Deixa de ser autorizado para disputa';
    case 'custo':
      return `Custo base: ${formatarReais(d.de as number | null)} → ${formatarReais(d.para as number | null)}`;
    case 'preco_inicial':
      return `Preço inicial: ${centavos(d.de)} → ${centavos(d.para)}`;
    case 'limite':
      return `Limite: ${centavos(d.de)} → ${centavos(d.para)}`;
    default:
      return '';
  }
}

function valorDaCamada(p: PremissasDaVersao, k: keyof PremissasDaVersao['camadas']): string {
  return !p.origem?.[k] || p.origem[k].fonte === 'nao_configurado' || p.camadas?.[k] == null
    ? 'não configurado'
    : formatPercentual(p.camadas[k]);
}

export default function HistoricoDeVersoes({
  versoes,
  vigente,
  atuais,
  premissasAtuais,
  compararComVigente,
  nomes,
}: {
  versoes: VersaoDePrecificacao[];
  vigente: VersaoDePrecificacao | null;
  atuais: ItemCalculado[] | null;
  premissasAtuais: PremissasDaVersao | null;
  /** Há revisão em curso (gravada ou não) diferente da vigente. */
  compararComVigente: boolean;
  nomes: Record<string, string>;
}) {
  const comparacao = useMemo(() => {
    if (!compararComVigente || !vigente || !atuais || !premissasAtuais) return null;
    const itens = diferencasEntreVersoes(recalcularVersao(vigente).itens, atuais);
    const premissas: string[] = [];
    ORDEM_DAS_CAMADAS.forEach((k) => {
      const de = valorDaCamada(vigente.premissas, k);
      const para = valorDaCamada(premissasAtuais, k);
      if (de !== para) premissas.push(`${ROTULO_DA_CAMADA[k]}: ${de} → ${para}`);
    });
    if (vigente.premissas.criterio !== premissasAtuais.criterio) {
      premissas.push(
        `Critério de disputa: ${ROTULO_DO_CRITERIO[vigente.premissas.criterio]} → ${ROTULO_DO_CRITERIO[premissasAtuais.criterio]}`,
      );
    }
    return { itens, premissas };
  }, [compararComVigente, vigente, atuais, premissasAtuais]);

  const nome = (id: string | null) => (id && nomes[id]) || 'usuário não identificado';

  return (
    <div className="flex flex-col gap-4">
      {comparacao && (
        <section className="g-cartao flex flex-col gap-2 p-4" aria-label={`Mudanças em relação à versão ${vigente?.numero}`}>
          <h3 className="g-corpo font-semibold text-foreground">
            Mudanças em relação à versão {vigente?.numero} aprovada
          </h3>
          {comparacao.itens.length === 0 && comparacao.premissas.length === 0 ? (
            <p className="g-corpo text-muted-foreground">Nenhuma mudança de premissa, preço ou limite.</p>
          ) : (
            <ul className="flex flex-col">
              {comparacao.premissas.map((m) => (
                <li key={m} className="g-corpo border-b border-border/70 py-2 text-foreground last:border-0">
                  {m}
                </li>
              ))}
              {comparacao.itens.map((d) => (
                <li
                  key={`${d.chave}-${d.campo}`}
                  className="g-corpo flex flex-wrap gap-x-2 border-b border-border/70 py-2 last:border-0"
                >
                  <span className="font-medium text-foreground">
                    Item {d.numero}
                    {d.lote && d.lote !== 'Único' ? ` · Lote ${d.lote}` : ''}
                  </span>
                  <span className="tabular-nums text-foreground">{descrever(d)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {versoes.length === 0 ? (
        <p className="g-corpo text-muted-foreground">Nenhuma versão salva para este processo.</p>
      ) : (
        <ol className="g-cartao flex flex-col px-4">
          {versoes.map((v) => {
            const situacao = SITUACAO_DA_VERSAO[v.situacao] ?? SITUACAO_DA_VERSAO.rascunho;
            return (
              <li
                key={v.id}
                className="flex flex-col gap-1 border-b border-border/70 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="g-corpo font-semibold text-foreground">Versão {v.numero}</span>
                  <SeloSituacao tom={situacao.tom}>{situacao.rotulo}</SeloSituacao>
                </div>
                <div className="g-meta flex flex-col text-muted-foreground sm:items-end">
                  {v.aprovada_em ? (
                    <span>
                      Aprovada por {nome(v.aprovada_por)} em {dataHoraDeBrasilia(v.aprovada_em)} (horário de Brasília)
                    </span>
                  ) : v.submetida_em ? (
                    <span>
                      Submetida por {nome(v.submetida_por)} em {dataHoraDeBrasilia(v.submetida_em)}
                    </span>
                  ) : (
                    <span>Criada em {dataHoraDeBrasilia(v.created_at)}</span>
                  )}
                  <span className="tabular-nums">Total inicial {formatarCentavos(v.total_inicial_centavos)}</span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
