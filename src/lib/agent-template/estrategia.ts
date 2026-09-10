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

/**
 * Portais liberados para ENVIAR LANCE.
 *
 * Lista vazia = nenhum portal da lance. Um portal so entra aqui depois que o
 * souLider() dele foi conferido contra a tela real de uma disputa — nao contra
 * o que o codigo supoe que a tela tem.
 *
 * Por que uma lista, e nao so o souLider() de cada portal: sem ela, o caminho
 * mais curto para "fazer funcionar" com pressa e escrever
 * \`async souLider() { return false; }\`. Uma linha, passa despercebida num
 * diff, e reabre o defeito mais caro da auditoria de 02/09/2026 — "nunca estou
 * liderando" faz o robo dar lance contra si mesmo ate o piso.
 *
 * Com a lista, liberar um portal e um ato deliberado, num arquivo que existe
 * para isso, com autor e data no historico.
 */
const PORTAIS_COM_LANCE_LIBERADO = [];

/** Este portal pode enviar lance? */
function podeEnviarLance(portalId) {
  return PORTAIS_COM_LANCE_LIBERADO.includes(portalId);
}

/** Nunca dar lance sem saber contra quem. */
const AGUARDAR = (motivo) => ({ acao: 'aguardar', valor: null, motivo });
const ENCERRAR = (motivo) => ({ acao: 'encerrar', valor: null, motivo });
const LANCE = (valor, motivo) => ({ acao: 'lance', valor, motivo });

/**
 * @param {object} estado
 * @param {string}      estado.portalId          id do portal, para a trava de liberacao
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
    portalId,
    valorAtual,
    valorMinimo,
    melhorLance,
    souLider,
    decrementoMin,
    decrementoPercentual,
    rodada,
    maxLances,
  } = estado;

  // A trava fica ANTES de tudo: sem ela, corrigir um seletor de leitura poderia
  // acidentalmente abrir o caminho de escrita.
  if (!podeEnviarLance(portalId)) {
    return AGUARDAR(
      \`Portal "\${portalId || '(nao informado)'}" nao esta liberado para enviar lance — \` +
      'o souLider() dele ainda nao foi conferido contra a tela real'
    );
  }

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

/**
 * O que mandamos bate com o que o portal publicou?
 *
 * ─── POR QUE ISTO EXISTE ───────────────────────────────────────────────────
 *
 * A tela monta os itens da disputa a partir do nosso lado — Precificação,
 * Proposta Comercial, extração do edital. Nada disso conversa com o portal. Um
 * item numerado errado, um lote que mudou, uma republicação do edital, e o robô
 * entra na disputa mirando um item que não existe — sem que nada acuse.
 *
 * Esta função é PURA de propósito, como a \`decidirLance\`: comparar é regra de
 * negócio, e regra de negócio se testa sem abrir navegador.
 *
 * ─── O QUE ELA NÃO FAZ ─────────────────────────────────────────────────────
 *
 * Não corrige nada e não impede nada. Divergência não é necessariamente erro:
 * disputar 3 itens de um edital com 60 é rotina. Quem decide é gente — a função
 * só garante que a pessoa saiba antes, e não depois do pregão.
 *
 * @param {Array<{numero:number, descricao?:string, valor_estimado_orgao?:number}>} nossos
 * @param {Array<{numero:number, descricao?:string, valor_referencia?:number}>} doPortal
 */
function conferirItens(nossos, doPortal) {
  const meus = Array.isArray(nossos) ? nossos : [];
  const deles = Array.isArray(doPortal) ? doPortal : [];

  // Lista vazia do portal e "nao consegui ler" sao coisas diferentes, e o
  // chamador nao tem como distinguir olhando so o resultado. Sem leitura, nao
  // se afirma nada: dizer "todos os itens faltam" seria acusar o portal de um
  // defeito nosso.
  if (deles.length === 0) {
    return {
      leu: false,
      ok: null,
      faltando: [],
      sobrando: [],
      divergencias: [],
      resumo: 'Nao foi possivel ler a lista de itens do portal',
    };
  }

  const porNumero = new Map(deles.map((i) => [Number(i.numero), i]));

  const faltando = meus
    .filter((i) => !porNumero.has(Number(i.numero)))
    .map((i) => Number(i.numero));

  const nossosNumeros = new Set(meus.map((i) => Number(i.numero)));
  const sobrando = deles
    .filter((i) => !nossosNumeros.has(Number(i.numero)))
    .map((i) => Number(i.numero));

  // Divergencia de valor so quando OS DOIS lados tem numero: comparar contra
  // ausencia produziria alarme em todo item que ninguem estimou.
  const divergencias = [];
  for (const meu of meus) {
    const dele = porNumero.get(Number(meu.numero));
    if (!dele) continue;
    const nosso = Number(meu.valor_estimado_orgao);
    const portal = Number(dele.valor_referencia);
    if (!Number.isFinite(nosso) || !Number.isFinite(portal) || portal <= 0) continue;
    // 1% de tolerancia: arredondamento de centavo em item de milhares nao e
    // divergencia, e alarme por centavo treina a pessoa a ignorar o aviso.
    if (Math.abs(nosso - portal) / portal > 0.01) {
      divergencias.push({ numero: Number(meu.numero), nosso, portal });
    }
  }

  const partes = [];
  if (faltando.length) partes.push(\`\${faltando.length} item(ns) que enviamos NAO existem no portal (\${faltando.slice(0, 6).join(', ')})\`);
  if (divergencias.length) partes.push(\`\${divergencias.length} item(ns) com valor de referencia diferente\`);
  if (sobrando.length) partes.push(\`\${sobrando.length} item(ns) do edital ficaram de fora\`);

  return {
    leu: true,
    // O campo ok fala so do que e defeito NOSSO: item inexistente e valor
    // divergente. Item sobrando nao entra — escolher 3 de 60 e decisao, nao erro.
    ok: faltando.length === 0 && divergencias.length === 0,
    faltando,
    sobrando,
    divergencias,
    resumo: partes.length ? partes.join('; ') : \`\${meus.length} item(ns) conferem com o portal\`,
  };
}

module.exports = { decidirLance, podeEnviarLance, conferirItens, PORTAIS_COM_LANCE_LIBERADO };
`,
};
