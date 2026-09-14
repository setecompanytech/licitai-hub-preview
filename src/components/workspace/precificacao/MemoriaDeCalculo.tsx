import { useId } from 'react';
import { ValorIndisponivel } from '@/components/gestao/SeloSituacao';
import type { CamadasPreco } from '@/lib/precificacao/formacao-preco';
import type { LinhaDaMemoria, OrigemDaPremissa } from '@/lib/precificacao/versao';
import { formatarCentavos, formatPercentual, ORDEM_DAS_CAMADAS, ROTULO_DA_CAMADA } from './formato';

/**
 * A memória de cálculo de um item — o caminho do custo ao preço, linha a
 * linha, exatamente como `calcularVersao` produziu.
 *
 * A tela não recalcula nem arredonda: centavo vem inteiro e só é formatado.
 * Duas linhas têm nomes que não podem se confundir, e por isso chegam aqui já
 * nomeadas pelo cálculo: "Margem sobre a venda" (a política) e "Acréscimo
 * sobre o custo (conferência)" (o quanto o preço está acima do custo). Tratar
 * o segundo como margem foi o erro do multiplicador.
 *
 * Camada sem origem aparece como "Configuração pendente", não como 0%: o
 * cálculo usa zero para seguir adiante, mas zero não é o que alguém escolheu.
 */
export default function MemoriaDeCalculo({
  linhas,
  origem,
}: {
  linhas: LinhaDaMemoria[];
  origem: Record<keyof CamadasPreco, OrigemDaPremissa>;
}) {
  const idTitulo = useId();
  const pendentes = new Set(
    ORDEM_DAS_CAMADAS.filter((k) => !origem?.[k] || origem[k].fonte === 'nao_configurado').map((k) => ROTULO_DA_CAMADA[k]),
  );

  return (
    <section aria-labelledby={idTitulo} className="flex flex-col gap-2">
      <h3 id={idTitulo} className="g-corpo font-semibold text-foreground">
        Memória de cálculo
      </h3>
      {linhas.length === 0 ? (
        <p className="g-corpo text-muted-foreground">Sem cálculo: informe o custo de aquisição do item.</p>
      ) : (
        <ol className="flex flex-col">
          {linhas.map((linha, i) => (
            <li
              key={`${linha.rotulo}-${i}`}
              className="flex items-start justify-between gap-4 border-b border-border/70 py-2 last:border-0"
            >
              <div className="min-w-0">
                <p className="g-corpo text-foreground">{linha.rotulo}</p>
                {linha.formula && <p className="g-meta text-muted-foreground">{linha.formula}</p>}
              </div>
              <p className="g-corpo shrink-0 text-right font-medium tabular-nums text-foreground">
                {pendentes.has(linha.rotulo) ? (
                  <ValorIndisponivel razao="Configuração pendente" />
                ) : linha.centavos != null ? (
                  formatarCentavos(linha.centavos)
                ) : (
                  formatPercentual(linha.percentual)
                )}
              </p>
            </li>
          ))}
        </ol>
      )}
      <p className="g-meta text-muted-foreground">
        Cálculo determinístico, arredondado ao centavo. A IA não altera estes valores.
      </p>
    </section>
  );
}
