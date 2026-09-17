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
// agente e é exercitado pelos testes em src/components/robo-lances/test/estrategia.test.ts, que
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
// LIBERADO: comprasgov — 16/09/2026, pedido do Ian ("pode ligar o robo pra dar
// lances, mandaram eu ligar"), sobre a autorizacao de Giovanny Valente e Rubens
// de 14-15/09/2026 ("pode testar fazer lances sem problemas"). O que segura o
// lance daqui em diante e a configuracao de cada disputa e o controle de quem
// opera: modo automatico, piso por item, teto de lances, robo da empresa
// ligado, parada pelo painel e freio de emergencia. E o envio so acontece no
// campo de lance DO ITEM, com o botao ao lado dele (ComprasGovPortal.enviarLance);
// sem esse campo na tela, o robo avisa e segue acompanhando.
const PORTAIS_COM_LANCE_LIBERADO = ['comprasgov'];

/** Este portal pode enviar lance? */
function podeEnviarLance(portalId) {
  return PORTAIS_COM_LANCE_LIBERADO.includes(portalId);
}

/** Nunca dar lance sem saber contra quem. */
const AGUARDAR = (motivo) => ({ acao: 'aguardar', valor: null, motivo });
/**
 * Encerrar tem ESCOPO (16/09/2026, Fase 7): o teto de lances vale para a
 * disputa inteira e tira o robo da sala; piso alcancado, item encerrado no
 * portal ou proposta nao classificada acabam so com AQUELE item — num pregao
 * de varios itens, os outros continuam.
 */
const ENCERRAR = (motivo, escopo = 'item') => ({ acao: 'encerrar', valor: null, motivo, escopo });
const LANCE = (valor, motivo) => ({ acao: 'lance', valor, motivo });

/**
 * As estrategias que um item pode ter (16/09/2026, modelo do ConLicitacao).
 *
 * - melhor_preco: cobre o melhor lance sempre que nao estivermos em 1o, ate o
 *   piso. E o comportamento que o robo ja tinha, e por isso e o que vale para
 *   item sem estrategia escolhida — disputa cadastrada antes desta versao
 *   continua fazendo o que fazia.
 * - iminencia: a mesma conta, mas so nos 2 minutos finais da etapa aberta (e
 *   no encerramento aleatorio do modo aberto e fechado). Lance dado no inicio
 *   so ensina o preco ao concorrente e gasta margem antes da hora.
 * - desempatar_1o: cobre o 1o lugar SO QUANDO ele esta perto — a diferenca
 *   entre o nosso ultimo lance e o do 1o colocado cabe na MARGEM EM REAIS do
 *   item. Mais longe que isso, o robo nao persegue. O passo do lance e o
 *   mesmo das outras (decremento, ou o intervalo minimo do edital).
 *   Definido pelo Ian em 16/09. Na reuniao de 14/09 o Giovanny marcou
 *   "Desempatar no 1o lugar" com 10,00 na tela do ConLicitacao e disse "eu
 *   acho perigoso... porque vai muito do modo de disputa", mas o produto nao
 *   explica o que o campo faz; a leitura como distancia maxima foi escolhida
 *   por nao depender de nada que o robo ainda nao le.
 *
 * Estrategia escrita que nao esta aqui NAO vira melhor_preco: o robo aguarda e
 * diz por que. Nome desconhecido e sinal de tela e agente em versoes
 * diferentes, e adivinhar a intencao seria decidir preco no chute.
 */
const ESTRATEGIAS = ['melhor_preco', 'iminencia', 'desempatar_1o'];

const NOME_DA_ESTRATEGIA = {
  melhor_preco: 'melhor preco',
  iminencia: 'iminencia',
  desempatar_1o: 'desempatar no 1o lugar',
};

/**
 * AS ESTRATEGIAS SOMAM (17/09/2026). O Rafael, dono do produto, na tela do
 * cadastro: "sao as 3 opcoes que o usuario escolhe — ele pode escolher as 3 ou
 * somente 2 ou somente 1", como no ConLicitacao. O item passa a trazer
 * \`estrategias\` (lista); \`estrategia\` (uma so) e o formato de antes e continua
 * valendo para a disputa cadastrada antes.
 *
 * Cada estrategia marcada e um gatilho, e o robo cobre o 1o colocado quando
 * QUALQUER um deles autoriza:
 * - melhor_preco autoriza sempre (e as outras nada acrescentam a ela);
 * - iminencia autoriza nos 2 minutos finais, a qualquer distancia do 1o;
 * - desempatar_1o autoriza a qualquer momento, mas so com o 1o dentro da margem.
 * Com iminencia e desempatar_1o juntas: antes da iminencia, so perto do 1o;
 * nela, a qualquer distancia.
 *
 * Nada informado (nem lista, nem estrategia) = melhor preco, como sempre foi.
 * Lista VAZIA informada nao vira melhor preco: a tela nao deixa salvar assim,
 * e se chegar, o robo aguarda — dar lance por uma estrategia que ninguem
 * marcou seria decidir preco no chute.
 *
 * @returns {string[]} as estrategias, sem repeticao, na ordem de ESTRATEGIAS
 */
function estrategiasDoItem(estrategias, estrategia) {
  if (Array.isArray(estrategias)) {
    const marcadas = estrategias.map((e) => String(e === null || e === undefined ? '' : e).trim()).filter(Boolean);
    const unicas = marcadas.filter((e, i) => marcadas.indexOf(e) === i);
    return unicas.sort((a, b) => {
      const ia = ESTRATEGIAS.indexOf(a);
      const ib = ESTRATEGIAS.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  }
  const uma = estrategia === null || estrategia === undefined ? '' : String(estrategia).trim();
  return [uma || 'melhor_preco'];
}

/**
 * Modo aberto: 10 minutos, e cada lance nos 2 minutos finais prorroga mais 2
 * (Lei 14.133/2021; IN SEGES/ME 73/2022). E essa a janela da iminencia.
 */
const SEGUNDOS_DE_IMINENCIA = 120;

/**
 * As fases que a leitura da sala pode informar. Nenhum portal as le ainda —
 * sai do mapeamento da sala em pregao real. Ate la chega null, e null quer
 * dizer "nao sei": nunca "esta aberta".
 *
 * - aguardando: a disputa do item ainda nao abriu
 * - aberta: etapa de lances corrida (com ou sem prorrogacao)
 * - encerramento_aleatorio: aberto e fechado, depois dos 15 minutos — pode
 *   fechar a qualquer segundo, entao ja e iminencia
 * - fechada: o lance final e fechado do aberto e fechado
 * - desempate_me_epp: o portal convocou a microempresa ou empresa de pequeno
 *   porte (empate ficto da LC 123/2006) a cobrir o 1o colocado — um lance so
 * - suspensa: o pregoeiro suspendeu
 * - encerrada: acabou para este item
 */
const FASES = ['aguardando', 'aberta', 'encerramento_aleatorio', 'fechada', 'desempate_me_epp', 'suspensa', 'encerrada'];

const CENTAVOS = (valor) => Number(valor.toFixed(2));
const CENTAVOS_PARA_BAIXO = (valor) => Math.floor(valor * 100 + 1e-6) / 100;
const REAIS = (valor) => 'R$ ' + Number(valor).toFixed(2);

/** Estamos na janela em que a estrategia de iminencia age? */
function emIminencia(fase, segundosRestantes) {
  if (fase === 'encerramento_aleatorio') return true;
  if (fase !== null && fase !== undefined && fase !== 'aberta') return false;
  return Number.isFinite(segundosRestantes) && segundosRestantes <= SEGUNDOS_DE_IMINENCIA;
}

/**
 * @param {object} estado
 * @param {string}      estado.portalId          id do portal, para a trava de liberacao
 * @param {number|null} estado.valorAtual        nosso ultimo lance NESTE item (null = ainda nao demos)
 * @param {number}      estado.valorMinimo       piso: obrigatorio; o robo nunca ultrapassa
 * @param {number|null} estado.melhorLance       melhor lance lido no portal
 * @param {boolean|null} estado.souLider         se o melhor lance e NOSSO
 * @param {number}      [estado.decrementoMin]   passo configurado, em reais
 * @param {number}      [estado.decrementoPercentual] alternativa, em % (0-100)
 * @param {number}      [estado.intervaloMinimo] intervalo minimo entre lances do edital, em reais
 * @param {number}      [estado.intervaloMinimoPercentual] o mesmo, quando o edital o da em %
 * @param {string[]}    [estado.estrategias]     as marcadas no item, cumulativas (ver estrategiasDoItem)
 * @param {string}      [estado.estrategia]      formato de antes: uma de ESTRATEGIAS; vazio = melhor_preco
 * @param {number}      [estado.margemDesempate] desempatar_1o: distancia maxima ate o 1o colocado, em reais
 * @param {string|null} [estado.fase]            uma de FASES; null = nao lida
 * @param {number|null} [estado.segundosRestantes] da etapa aberta; null = nao lido
 * @param {boolean|null} [estado.elegivel]       chamados pelo portal para a fase (lance final, etapa aberta, desempate)?
 * @param {number}      [estado.lanceFinalFechado] valor do lance final fechado, escolhido pela empresa
 * @param {boolean}     [estado.lanceFechadoEnviado] o lance final ja foi dado
 * @param {boolean}     [estado.lanceDesempateEnviado] o lance de desempate de ME/EPP ja foi dado
 * @param {number}      [estado.lancesEnviados]  lances aceitos ate aqui
 * @param {number|null} [estado.maxLances]       teto de lances; vazio ou 0 = sem teto, disputa ate o piso
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
    intervaloMinimo,
    intervaloMinimoPercentual,
    estrategias,
    estrategia,
    margemDesempate,
    fase,
    segundosRestantes,
    elegivel,
    lanceFinalFechado,
    lanceFechadoEnviado,
    lanceDesempateEnviado,
    lancesEnviados,
    maxLances,
    modoAutomatico,
  } = estado;

  // A trava fica ANTES de tudo: sem ela, corrigir um seletor de leitura poderia
  // acidentalmente abrir o caminho de escrita.
  if (!podeEnviarLance(portalId)) {
    return AGUARDAR(
      \`Portal "\${portalId || '(nao informado)'}" nao esta liberado para enviar lance — \` +
      'o souLider() dele ainda nao foi conferido contra a tela real'
    );
  }

  // MODO AUTOMATICO DA DISPUTA (16/09/2026): o interruptor do cadastro dizia
  // "o robo enviara lances automaticamente" e nao chegava ao robo. Desligado,
  // o robo entra e acompanha, sem lance. So \`false\` explicito para aqui: quem
  // chama pelo laco manda o valor da disputa (ausente vira false no laco).
  if (modoAutomatico === false) {
    return AGUARDAR('Modo automatico desligado nesta disputa: o robo acompanha e nao da lance');
  }

  // O teto conta LANCES ENVIADOS, e e opcional. Antes contava rodadas de
  // leitura: com o padrao de 20 rodadas a 30 s, o robo saia da sala em 10
  // minutos sem ter dado lance nenhum. Sem teto, a disputa vai ate o piso
  // ("30 ou infinitamente ate chegar no meu limite" — reuniao de 14/09).
  const enviados = Number.isFinite(lancesEnviados) ? lancesEnviados : 0;
  if (Number.isFinite(maxLances) && maxLances > 0 && enviados >= maxLances) {
    return ENCERRAR(\`Teto de \${maxLances} lances atingido\`, 'sessao');
  }

  // O piso e obrigatorio. Sem ele a comparacao com o proximo lance virava
  // comparacao com zero, e o robo podia descer ate um centavo.
  if (!Number.isFinite(valorMinimo) || valorMinimo <= 0) {
    return AGUARDAR('Sem valor minimo (piso) definido para o item — o robo nao disputa sem piso');
  }

  const marcadas = estrategiasDoItem(estrategias, estrategia);
  if (marcadas.length === 0) {
    return AGUARDAR('Nenhuma estrategia marcada neste item: o robo acompanha e nao da lance');
  }
  const desconhecida = marcadas.find((e) => !ESTRATEGIAS.includes(e));
  if (desconhecida) {
    return AGUARDAR(\`Estrategia "\${desconhecida}" nao e conhecida por esta versao do robo\`);
  }
  const comMelhorPreco = marcadas.includes('melhor_preco');
  const comIminencia = marcadas.includes('iminencia');
  const comDesempate = marcadas.includes('desempatar_1o');

  const faseLida = fase === null || fase === undefined || fase === '' ? null : fase;
  if (faseLida !== null && !FASES.includes(faseLida)) {
    return AGUARDAR(\`Fase "\${faseLida}" nao reconhecida\`);
  }
  if (faseLida === 'encerrada') return ENCERRAR('O portal encerrou a disputa deste item');
  if (faseLida === 'suspensa') return AGUARDAR('Disputa suspensa pelo pregoeiro');
  if (faseLida === 'aguardando') return AGUARDAR('A disputa deste item ainda nao abriu');

  // O código antigo fazia \`decrementoPercentual || 1\`: quem configurasse 0%
  // recebia 1% sem saber. Substituir configuração por padrão inventado é a
  // mesma família de defeito que esta função existe para eliminar.
  const decrementoConfigurado = () => {
    if (Number.isFinite(decrementoMin) && decrementoMin > 0) return decrementoMin;
    if (Number.isFinite(decrementoPercentual) && decrementoPercentual > 0) return melhorLance * (decrementoPercentual / 100);
    return null;
  };

  // O INTERVALO MINIMO DO EDITAL nao e padrao inventado: e regra publicada pelo
  // orgao e lida no portal (R$ 0,0100 no 7/2026 da SEDUC/PA), e lance com
  // diferenca menor e recusado. E O PADRAO (decisao do Ian, 16/09): sem passo
  // configurado, o robo desce so o degrau minimo do portal, para nao gastar
  // margem a toa; um passo configurado menor que ele sobe para ele.
  const calcularPasso = (configurado, nomeDoConfigurado) => {
    let intervalo = null;
    if (Number.isFinite(intervaloMinimo) && intervaloMinimo > 0) {
      intervalo = intervaloMinimo;
    } else if (Number.isFinite(intervaloMinimoPercentual) && intervaloMinimoPercentual > 0) {
      intervalo = melhorLance * (intervaloMinimoPercentual / 100);
    }
    let passo = Number.isFinite(configurado) && configurado > 0 ? configurado : null;
    let origem = nomeDoConfigurado;
    if (intervalo !== null && (passo === null || passo < intervalo)) {
      origem = passo === null
        ? 'intervalo minimo do edital'
        : 'intervalo minimo do edital, maior que o ' + nomeDoConfigurado + ' configurado';
      passo = intervalo;
    }
    if (passo === null || !Number.isFinite(passo) || passo <= 0) return null;
    // Centavos: portal recusa fracao. Arredondar para cima encolheria o passo
    // abaixo do intervalo do edital (e o lance seria recusado), entao nesse
    // caso o arredondamento vai para baixo.
    const bruto = melhorLance - passo;
    let valor = CENTAVOS(bruto);
    if (intervalo !== null && melhorLance - valor < intervalo - 1e-9) valor = CENTAVOS_PARA_BAIXO(bruto);
    return { passo, origem, valor };
  };

  /**
   * Cobrir o 1o colocado. Um caminho so para todas as ocasioes, com as
   * mesmas guardas: sem leitura nao ha lance, nunca cobrir o proprio lance,
   * so perto do 1o quando quem autoriza e a desempatar_1o, nunca chegar no piso.
   *
   * @param {string|null} ocasiao  texto extra do motivo
   * @param {string} porQual       a estrategia que autorizou este lance
   */
  const cobrirOPrimeiro = (ocasiao, porQual) => {
    const porMargem = porQual === 'desempatar_1o';
    // Sem leitura confiável não há estratégia. O código antigo caía em
    // \`melhorLance || valorAtual\` e dava lance às cegas partindo do próprio
    // valor — cobrindo a si mesmo com um número inventado.
    if (melhorLance === null || melhorLance === undefined || !Number.isFinite(melhorLance)) {
      return AGUARDAR('Não foi possível ler o melhor lance no portal');
    }
    // O DEFEITO QUE CUSTAVA DINHEIRO: quando lideramos, o melhor lance da
    // sessão é o nosso. Sem esta guarda o robô cobria o próprio lance a cada
    // rodada e descia sozinho até o piso, sem nenhum concorrente ter aparecido.
    if (souLider === true) {
      return AGUARDAR('Já estamos liderando — cobrir o próprio lance só queima margem');
    }
    // \`souLider\` desconhecido é diferente de \`false\`: sem saber quem lidera,
    // a guarda acima perde o efeito. Melhor parar do que arriscar.
    if (souLider !== false) {
      return AGUARDAR('O portal não informou quem está liderando');
    }
    // DESEMPATAR NO 1o LUGAR: a margem e a distancia maxima ate o 1o colocado.
    // Sem margem ou sem lance nosso para medir, nao ha como saber se ele esta
    // perto — e a estrategia existe justamente para nao perseguir quem esta
    // longe.
    if (porMargem) {
      if (!Number.isFinite(margemDesempate) || margemDesempate <= 0) {
        return AGUARDAR('Desempatar no 1o lugar precisa da margem em reais do item: sem ela o robo nao sabe ate que distancia do 1o colocado vale cobrir');
      }
      if (!Number.isFinite(valorAtual)) {
        return AGUARDAR('Desempatar no 1o lugar: sem lance nosso no item, nao ha distancia ate o 1o colocado para medir');
      }
      const distancia = valorAtual - melhorLance;
      if (distancia > margemDesempate + 1e-9) {
        return AGUARDAR(
          \`Desempatar no 1o lugar: o 1o colocado esta \${REAIS(distancia)} abaixo do nosso lance, \` +
          \`alem da margem de \${REAIS(margemDesempate)} — o robo nao persegue\`
        );
      }
    }
    const conta = calcularPasso(decrementoConfigurado(), 'decremento');
    if (!conta) {
      return AGUARDAR('Nenhum decremento válido configurado (nem em reais, nem em %), e o intervalo minimo do edital nao foi lido');
    }
    // O piso é intransponível, e chegar nele encerra em vez de dar lance nele:
    // igualar o mínimo é entregar a margem inteira sem garantia de vitória.
    if (conta.valor <= valorMinimo) {
      return ENCERRAR(\`Próximo lance (\${REAIS(conta.valor)}) alcançaria o piso de \${REAIS(valorMinimo)}\`);
    }
    return LANCE(
      conta.valor,
      \`Cobrindo \${REAIS(melhorLance)} com passo de \${REAIS(conta.passo)} \` +
      \`(\${conta.origem}; estrategia: \${NOME_DA_ESTRATEGIA[porQual]}\${ocasiao ? '; ' + ocasiao : ''})\`
    );
  };

  // LANCE FINAL FECHADO (modo aberto e fechado). Um lance so, as cegas, e so
  // para quem o portal chamar. O valor e decisao da empresa: o robo nao
  // escolhe sozinho o numero de um lance que nao da para corrigir depois.
  if (faseLida === 'fechada') {
    if (elegivel === false) return AGUARDAR('Fora dos elegiveis para o lance final fechado');
    if (elegivel !== true) return AGUARDAR('Nao foi possivel saber se estamos entre os elegiveis do lance final fechado');
    if (lanceFechadoEnviado) return AGUARDAR('O lance final fechado ja foi dado — o portal aceita um so');
    if (Number.isFinite(lanceFinalFechado) && lanceFinalFechado > 0) {
      if (lanceFinalFechado < valorMinimo) {
        return AGUARDAR(\`O lance final configurado (\${REAIS(lanceFinalFechado)}) fica abaixo do piso de \${REAIS(valorMinimo)}\`);
      }
      return LANCE(CENTAVOS(lanceFinalFechado), \`Lance final fechado configurado: \${REAIS(lanceFinalFechado)}\`);
    }
    return AGUARDAR('O lance final fechado precisa de valor definido pela empresa; o robo nao escolhe esse numero sozinho');
  }

  // DESEMPATE DE ME/EPP: o portal convoca a pequena empresa com lance ate 5%
  // acima do 1o colocado a cobri-lo, uma vez. Qualquer estrategia aproveita a
  // convocacao, com as mesmas guardas — a margem so vale quando a desempatar_1o
  // e a unica marcada (melhor preco e iminencia cobrem a qualquer distancia).
  if (faseLida === 'desempate_me_epp') {
    if (elegivel === false) return AGUARDAR('O portal nao convocou a empresa para o desempate');
    if (elegivel !== true) return AGUARDAR('Nao foi possivel saber se a empresa foi convocada para o desempate');
    if (lanceDesempateEnviado) return AGUARDAR('O lance de desempate ja foi dado — o portal aceita um so');
    const porQual = comMelhorPreco ? 'melhor_preco' : comIminencia ? 'iminencia' : 'desempatar_1o';
    return cobrirOPrimeiro('desempate de ME/EPP', porQual);
  }

  // Modo fechado e aberto: so passam para a etapa aberta a melhor proposta e
  // as ate 10% acima (ou as tres melhores). Fora delas, nao ha lance a dar.
  if (faseLida === 'aberta' && elegivel === false) {
    return ENCERRAR('Nossa proposta nao foi classificada para a etapa aberta');
  }

  if (melhorLance === null || melhorLance === undefined || !Number.isFinite(melhorLance)) {
    return AGUARDAR('Não foi possível ler o melhor lance no portal');
  }
  if (souLider === true) {
    return AGUARDAR('Já estamos liderando — cobrir o próprio lance só queima margem');
  }
  if (souLider !== false) {
    return AGUARDAR('O portal não informou quem está liderando');
  }

  // Valor IGUAL ao melhor e fora do 1o lugar e empate perdido: o portal da o
  // lugar a quem registrou primeiro. Ai ha o que cobrir. So o valor MAIOR que
  // o nosso, com o portal dizendo que nao lideramos, e leitura que nao fecha.
  if (Number.isFinite(valorAtual) && melhorLance > valorAtual) {
    return AGUARDAR('O melhor lance não é melhor que o nosso — nada a cobrir');
  }

  // Os gatilhos marcados, do mais amplo ao mais restrito (ver estrategiasDoItem).
  // A leitura acima ja rodou, para que um defeito de leitura apareca durante a
  // etapa inteira, e nao so nos dois minutos da iminencia.
  if (comMelhorPreco) return cobrirOPrimeiro(null, 'melhor_preco');
  if (comIminencia && emIminencia(faseLida, segundosRestantes)) return cobrirOPrimeiro(null, 'iminencia');

  const esperaDaIminencia = () => {
    if (!Number.isFinite(segundosRestantes) && faseLida !== 'encerramento_aleatorio') {
      return 'Estrategia de iminencia: o tempo restante nao foi lido, e sem ele o robo nao sabe quando agir';
    }
    return \`Estrategia de iminencia: faltam \${Math.round(segundosRestantes)} s; o robo age nos \${SEGUNDOS_DE_IMINENCIA / 60} minutos finais\`;
  };

  if (comDesempate) {
    const porMargem = cobrirOPrimeiro(null, 'desempatar_1o');
    // Com a iminencia marcada junto, quem le o motivo precisa saber que a
    // espera e so ate os minutos finais.
    if (porMargem.acao === 'aguardar' && comIminencia) {
      return AGUARDAR(porMargem.motivo + '. ' + esperaDaIminencia());
    }
    return porMargem;
  }

  return AGUARDAR(esperaDaIminencia());
}

/**
 * Quando ler a sala de novo.
 *
 * Fora da iminencia, no ritmo configurado na disputa. Dentro dela (e no lance
 * final fechado, que dura 5 minutos), a cada poucos segundos: cada lance
 * alheio nos 2 minutos finais prorroga a etapa, e responder 30 s depois e
 * chegar atrasado. Faltando menos que um intervalo para a iminencia, a
 * proxima leitura cai no inicio dela, e nao depois.
 */
const SEGUNDOS_DE_LEITURA_RAPIDA = 3;
/**
 * PISO DO RITMO FORA DA IMINENCIA (17/09/2026). Cada rodada recarrega a pagina
 * da compra no portal; uma disputa cadastrada com intervalo de 1 s fez o robo
 * reler o Compras.gov uma vez por segundo (sessao f4adbbe6, 02:49). Acesso
 * nesse ritmo e o que leva o portal a pedir captcha. Na iminencia a leitura
 * rapida continua valendo.
 */
const SEGUNDOS_MINIMOS_ENTRE_LEITURAS = 10;
function proximaLeituraMs({ intervaloSegundos, fase, segundosRestantes } = {}) {
  const configurado = Number.isFinite(intervaloSegundos) && intervaloSegundos > 0 ? intervaloSegundos : 30;
  const base = Math.max(SEGUNDOS_MINIMOS_ENTRE_LEITURAS, configurado);
  if (emIminencia(fase, segundosRestantes) || fase === 'fechada') {
    return Math.min(base, SEGUNDOS_DE_LEITURA_RAPIDA) * 1000;
  }
  const corrida = fase === null || fase === undefined || fase === 'aberta';
  if (corrida && Number.isFinite(segundosRestantes) && segundosRestantes > SEGUNDOS_DE_IMINENCIA &&
      segundosRestantes - SEGUNDOS_DE_IMINENCIA < base) {
    return Math.max(1, segundosRestantes - SEGUNDOS_DE_IMINENCIA) * 1000;
  }
  return base * 1000;
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

/**
 * QUAIS ITENS LER NESTA RODADA (16/09/2026, Fase 7).
 *
 * O robo le item por item, e cada leitura custa alguns segundos de pagina. Com
 * um item em disputa (lance correndo, iminencia), reler a cada rodada os que
 * ainda aguardam atrasaria justamente o que decide o preco: 4 itens dao uma
 * rodada de ~14 s, 40 itens passariam de 2 minutos.
 *
 * - item EM DISPUTA (fase aberta, encerramento aleatorio, fechada, desempate):
 *   toda rodada;
 * - os outros: no maximo a cada LEITURA_DE_ITEM_FORA_DA_DISPUTA_MS, mas SO
 *   enquanto houver algum item em disputa;
 * - nenhum item em disputa (ou a fase ainda nao e lida, como hoje): todos a
 *   cada rodada, como antes.
 * Item encerrado nao e lido.
 *
 * @param {Array<{chave: string, fase?: string|null, ultimaLeituraEm?: number, encerrado?: boolean}>} itens
 * @param {number} agora ms
 * @returns {string[]} as chaves a ler, na ordem recebida
 */
const FASES_EM_DISPUTA = ['aberta', 'encerramento_aleatorio', 'fechada', 'desempate_me_epp'];
const LEITURA_DE_ITEM_FORA_DA_DISPUTA_MS = 60000;

function itensParaLer(itens, agora) {
  const vivos = (itens || []).filter((i) => i && !i.encerrado);
  const emDisputa = (i) => FASES_EM_DISPUTA.includes(i.fase);
  if (!vivos.some(emDisputa)) return vivos.map((i) => i.chave);
  return vivos
    .filter((i) => emDisputa(i) || !Number.isFinite(i.ultimaLeituraEm) || agora - i.ultimaLeituraEm >= LEITURA_DE_ITEM_FORA_DA_DISPUTA_MS)
    .map((i) => i.chave);
}

/**
 * A FASE DE LANCES DO ITEM JA ACABOU NO PORTAL? (16/09/2026)
 *
 * A pagina publica da compra mostra a situacao de cada item. No 7/2026, dois
 * dias depois da sessao, todos estavam "Aguardando julgamento". Sem ler isso o
 * robo nao percebia o fim — a fase da sala ainda nao e lida — e ficava na sala
 * ate o limite de 10 horas, ocupando uma das 6 vagas.
 *
 * So palavras de fase POSTERIOR aos lances. "Encerramento aleatorio" e
 * "Disputa encerrada" (fim da etapa aberta, com a fechada por vir) NAO contam.
 */
const SITUACOES_DEPOIS_DOS_LANCES = [
  'julgamento', 'aceito', 'aceita', 'adjudicad', 'homologad', 'habilitad', 'habilitação', 'habilitacao',
  'recurso', 'deserto', 'fracassad', 'cancelad', 'revogad', 'anulad',
];

function faseDeLancesEncerrada(situacao) {
  const s = String(situacao || '').toLowerCase();
  if (!s) return false;
  return SITUACOES_DEPOIS_DOS_LANCES.some((p) => s.indexOf(p) >= 0);
}

module.exports = {
  faseDeLancesEncerrada,
  itensParaLer,
  LEITURA_DE_ITEM_FORA_DA_DISPUTA_MS,
  decidirLance,
  podeEnviarLance,
  conferirItens,
  proximaLeituraMs,
  emIminencia,
  estrategiasDoItem,
  ESTRATEGIAS,
  FASES,
  PORTAIS_COM_LANCE_LIBERADO,
};
`,
};
