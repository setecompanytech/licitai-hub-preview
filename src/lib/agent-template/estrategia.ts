// A decisão de preço do robô de lances, isolada num arquivo só.
//
// Ela vivia embutida no `_startBiddingLoop` do session-manager, duplicada entre
// a VPS e o template deste repo, sem teste em nenhum dos dois. A auditoria de
// 02/09/2026 (docs/auditoria-agente-v2.2.0.md) encontrou ali o defeito mais
// caro do sistema: o robô dava lance contra si mesmo, baixando o próprio preço
// até o piso sem nenhum concorrente ter coberto.
//
// Decisão que move dinheiro não pode existir em duas cópias que ninguém
// compara. Este arquivo é a fonte única — o mesmo texto vai para o ZIP do
// agente e é exercitado pelos testes em src/test/robo-estrategia.test.ts, que
// extraem e executam ESTE código, não uma reescrita dele.

export const ESTRATEGIA_FILES: Record<string, string> = {
  'src/estrategia.js': `/**
 * Decide o que fazer na próxima rodada de uma disputa.
 *
 * Função pura: não toca navegador, não toca rede, não olha relógio. Recebe o
 * estado da sessão e devolve uma decisão com o motivo dela. É assim que dá para
 * provar por teste que o robô não faz besteira com dinheiro.
 */

/** Nunca dar lance sem saber contra quem. */
const AGUARDAR = (motivo) => ({ acao: 'aguardar', valor: null, motivo });
const ENCERRAR = (motivo) => ({ acao: 'encerrar', valor: null, motivo });
const LANCE = (valor, motivo) => ({ acao: 'lance', valor, motivo });

/**
 * @param {object} estado
 * @param {number}      estado.valorAtual        nosso último lance
 * @param {number}      estado.valorMinimo       piso: o robô nunca ultrapassa
 * @param {number|null} estado.melhorLance       melhor lance lido no portal
 * @param {boolean|null} estado.souLider         se o melhor lance é NOSSO
 * @param {number}      [estado.decrementoMin]   decremento absoluto, em reais
 * @param {number}      [estado.decrementoPercentual] alternativa, em % (0-100)
 * @param {number}      estado.rodada            rodada atual
 * @param {number}      estado.maxLances         teto de rodadas
 * @returns {{acao: 'lance'|'aguardar'|'encerrar', valor: number|null, motivo: string}}
 */
function decidirLance(estado) {
  const {
    valorAtual,
    valorMinimo,
    melhorLance,
    souLider,
    decrementoMin,
    decrementoPercentual,
    rodada,
    maxLances,
  } = estado;

  if (typeof maxLances === 'number' && rodada >= maxLances) {
    return ENCERRAR(\`Teto de \${maxLances} lances atingido\`);
  }

  // Sem leitura confiável não há estratégia. O código antigo caía em
  // \`melhorLance || valorAtual\` e dava lance às cegas partindo do próprio
  // valor — cobrindo a si mesmo com um número inventado.
  if (melhorLance === null || melhorLance === undefined || !Number.isFinite(melhorLance)) {
    return AGUARDAR('Não foi possível ler o melhor lance no portal');
  }

  // O DEFEITO QUE CUSTAVA DINHEIRO: quando lideramos, o melhor lance da sessão
  // é o nosso. Sem esta guarda o robô cobria o próprio lance a cada rodada e
  // descia sozinho até o piso, sem nenhum concorrente ter aparecido.
  if (souLider === true) {
    return AGUARDAR('Já estamos liderando — cobrir o próprio lance só queima margem');
  }

  // \`souLider\` desconhecido é diferente de \`false\`. Se o portal não sabe dizer
  // quem lidera, não dá para distinguir o nosso lance do alheio, e a guarda
  // acima perde o efeito. Melhor parar do que arriscar.
  if (souLider !== false) {
    return AGUARDAR('O portal não informou quem está liderando');
  }

  if (melhorLance >= valorAtual) {
    return AGUARDAR('O melhor lance não é melhor que o nosso — nada a cobrir');
  }

  // O código antigo fazia \`decrementoPercentual || 1\`: quem configurasse 0%
  // recebia 1% sem saber. Substituir configuração por padrão inventado é a
  // mesma família de defeito que esta função existe para eliminar — aqui, zero
  // explícito significa "não sei de quanto descer", e isso manda parar.
  let decremento = null;
  if (Number.isFinite(decrementoMin) && decrementoMin > 0) {
    decremento = decrementoMin;
  } else if (Number.isFinite(decrementoPercentual) && decrementoPercentual > 0) {
    decremento = melhorLance * (decrementoPercentual / 100);
  }

  if (decremento === null || !Number.isFinite(decremento) || decremento <= 0) {
    return AGUARDAR('Nenhum decremento válido configurado (nem em reais, nem em %)');
  }

  const novoValor = Number((melhorLance - decremento).toFixed(2));

  // O piso é intransponível, e chegar nele encerra em vez de dar lance nele:
  // igualar o mínimo é entregar a margem inteira sem garantia de vitória.
  if (novoValor <= valorMinimo) {
    return ENCERRAR(
      \`Próximo lance (R$ \${novoValor.toFixed(2)}) alcançaria o piso de R$ \${Number(valorMinimo).toFixed(2)}\`
    );
  }

  return LANCE(novoValor, \`Cobrindo R$ \${melhorLance.toFixed(2)} com decremento de R$ \${decremento.toFixed(2)}\`);
}

module.exports = { decidirLance };
`,
};
