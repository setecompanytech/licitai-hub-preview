/**
 * Como um documento contratual se chama na tela e no papel.
 *
 * A tela misturava duas escritas: o órgão saía como foi digitado — "FUNDAÇÃO
 * SANTA CASA DE MISERICÓRDIA DO PARÁ" num cartão e "Estado do Pará | Polícia
 * Militar do Pará" no seguinte — e o documento saía como "Contrato n. X",
 * que não é o nome do instrumento.
 *
 * Aqui está a régua única. E ela não é só estética: em contratação pública o
 * NOME do instrumento diz o regime jurídico dele, e chamar de "Termo Aditivo"
 * algo que a lei registra por apostila é erro de conteúdo, não de formatação.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Órgão
// ─────────────────────────────────────────────────────────────────────────────

/**
 * O nome do órgão, sempre em caixa alta.
 *
 * É a forma como o órgão se identifica no preâmbulo do edital e do contrato,
 * e é o que faz uma lista de contratos ser varrida pelo olho sem tropeço —
 * hoje metade dos cartões grita e a outra metade sussurra, conforme quem
 * digitou.
 *
 * Em função, e não em CSS (`uppercase`), porque o mesmo nome é usado no
 * cabeçalho impresso, na busca e na exportação: regra que vive na folha de
 * estilo vale só onde alguém lembrou de aplicar a classe.
 *
 * Também colapsa espaço repetido — nome colado de PDF costuma trazer dois ou
 * três, e a diferença some quando tudo é maiúscula, mas continua atrapalhando
 * a busca.
 */
export function nomeDoOrgao(nome: string | null | undefined): string {
  const limpo = (nome ?? '').replace(/\s+/g, ' ').trim();
  return limpo.toLocaleUpperCase('pt-BR');
}

// ─────────────────────────────────────────────────────────────────────────────
// Documento principal — o que `contratos.tipo_documento` distingue
// ─────────────────────────────────────────────────────────────────────────────

export type TipoDocumento = 'contrato' | 'ata_srp';

/** O número já se apresenta? ("ATA SRP Nº 022/2024", "Contrato 17/2025") */
const jaSeApresenta = (numero: string, prefixos: RegExp) => prefixos.test(numero);

/**
 * Como a Ata de Registro de Preços se chama.
 *
 * O valor gravado às vezes já é o nome inteiro, e prefixar produzia
 * "ATA SRP n. ATA SRP Nº 022/2024". Quando o número se apresenta, ele fala
 * por si.
 */
export function rotuloDaAta(numero: string | null | undefined): string {
  const n = (numero ?? '').trim();
  if (!n) return 'ATA SRP';
  return jaSeApresenta(n, /^\s*(ata|arp)\b/i) ? n : `ATA SRP n.º ${n}`;
}

/**
 * Como o contrato se chama: **Contrato Administrativo**.
 *
 * "Contrato" sozinho não distingue do contrato civil, e é assim que o
 * instrumento é nomeado na Lei 14.133/2021. Mesma proteção contra prefixo
 * duplicado da ata.
 */
export function rotuloDoContrato(numero: string | null | undefined): string {
  const n = (numero ?? '').trim();
  if (!n) return 'Contrato Administrativo';
  return jaSeApresenta(n, /^\s*contrat/i) ? n : `Contrato Administrativo n.º ${n}`;
}

/** O rótulo do documento principal, escolhido pelo tipo. */
export function rotuloDoDocumento(
  tipo: string | null | undefined,
  numero: string | null | undefined,
): string {
  return tipo === 'ata_srp' ? rotuloDaAta(numero) : rotuloDoContrato(numero);
}

// ─────────────────────────────────────────────────────────────────────────────
// Alterações — e aqui a lei separa instrumentos que a tela juntava
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A espécie do instrumento que formaliza a alteração.
 *
 * `contrato_aditivos` guarda onze tipos sob um nome só — "aditivo" — e três
 * deles não são aditivo coisa nenhuma:
 *
 *   • **Apostilamento** (Lei 14.133/2021, art. 136, I) — reajuste e
 *     repactuação de preços JÁ PREVISTOS no contrato são registrados por
 *     simples apostila, dispensado o termo aditivo. É ato unilateral da
 *     Administração: não há o que negociar, só o que registrar.
 *
 *   • **Adesão** (art. 86 §2º) — órgão não participante aderindo à ata
 *     ("carona"). Não altera a ata; cria vínculo novo com um terceiro.
 *
 *   • **Remanejamento** (art. 86 §§5º e 6º) — quantitativos transferidos
 *     entre participantes da mesma ata. Também não altera o total.
 *
 * A distinção tem efeito prático, não decorativo: apostilamento **não consome
 * o limite de 25% do art. 125**, e chamar de aditivo o que é apostila sugere
 * negociação e assinatura das duas partes onde a lei não exige nenhuma.
 */
export type EspecieDaAlteracao = 'aditivo' | 'apostilamento' | 'adesao' | 'remanejamento';

const ESPECIE_POR_TIPO: Record<string, EspecieDaAlteracao> = {
  // Alteram a substância do ajuste — exigem acordo das partes (arts. 124–125).
  valor: 'aditivo',
  quantidade: 'aditivo',
  valor_quantidade: 'aditivo',
  prazo: 'aditivo',
  escopo: 'aditivo',
  reequilibrio: 'aditivo', // art. 124, II, "d" — restabelece o equilíbrio
  revisao: 'aditivo',
  // Só registram o que o contrato já previa — art. 136, I.
  reajuste: 'apostilamento',
  repactuacao: 'apostilamento',
  // Instrumentos próprios da ata de registro de preços.
  adesao: 'adesao',
  remanejamento: 'remanejamento',
};

export function especieDaAlteracao(tipo: string | null | undefined): EspecieDaAlteracao {
  // Tipo desconhecido cai em `aditivo`: é a espécie mais exigente, e supor a
  // mais exigente erra para o lado seguro — quem confere descobre que bastava
  // apostila; o contrário só se descobre em auditoria.
  return ESPECIE_POR_TIPO[(tipo ?? '').trim().toLowerCase()] ?? 'aditivo';
}

const NOME_DA_ESPECIE: Record<EspecieDaAlteracao, string> = {
  aditivo: 'Termo Aditivo',
  apostilamento: 'Termo de Apostilamento',
  adesao: 'Termo de Adesão',
  remanejamento: 'Termo de Remanejamento',
};

const OBJETO_DA_ALTERACAO: Record<string, string> = {
  valor: 'acréscimo ou supressão de valor',
  quantidade: 'alteração de quantitativos',
  valor_quantidade: 'valor e quantitativos',
  prazo: 'prorrogação de prazo',
  escopo: 'alteração do objeto',
  reequilibrio: 'reequilíbrio econômico-financeiro',
  revisao: 'revisão contratual',
  reajuste: 'reajuste de preços',
  repactuacao: 'repactuação de preços',
  adesao: 'adesão de órgão não participante',
  remanejamento: 'remanejamento entre participantes',
};

/**
 * Como a alteração se chama: "Termo Aditivo n.º 2" ou
 * "Termo de Apostilamento n.º 1".
 */
export function rotuloDaAlteracao(
  tipo: string | null | undefined,
  // `contrato_aditivos.numero_aditivo` é numérico no banco e string quando vem
  // de formulário. Aceita os dois em vez de obrigar quem chama a converter.
  numero: string | number | null | undefined,
): string {
  const nome = NOME_DA_ESPECIE[especieDaAlteracao(tipo)];
  const n = (numero ?? '').toString().trim();
  if (!n) return nome;
  return jaSeApresenta(n, /^\s*termo\b/i) ? n : `${nome} n.º ${n}`;
}

/** O que a alteração muda, em uma expressão. Vazio para tipo desconhecido. */
export function objetoDaAlteracao(tipo: string | null | undefined): string {
  return OBJETO_DA_ALTERACAO[(tipo ?? '').trim().toLowerCase()] ?? '';
}

/**
 * Consome o limite do art. 125 (25%, ou 50% em obra/serviço de engenharia)?
 *
 * Só alteração quantitativa consome. Prazo é art. 107; reajuste e repactuação
 * são apostila; adesão e remanejamento não tocam o valor original do ajuste.
 */
export function consomeLimiteDoArt125(tipo: string | null | undefined): boolean {
  const t = (tipo ?? '').trim().toLowerCase();
  // Por INCLUSÃO, e não por exclusão. A cópia que existia no gatilho do banco
  // era por exclusão, e por isso `prazo_quantidade` — uma prorrogação — entrou
  // na conta por omissão e acusou 100% de acréscimo no 149/2024. Com lista de
  // inclusão, tipo novo fica de fora até alguém decidir que ele entra.
  return ['valor', 'quantidade', 'valor_quantidade', 'escopo'].includes(t);
}

/**
 * Prorrogação de fornecimento ou serviço contínuo — art. 107.
 *
 * Abre um NOVO período, com a estimativa do período. Não acresce nada ao
 * anterior e não toca o limite do art. 125. Tratá-la como acréscimo faz todo
 * contrato contínuo estourar o limite na primeira renovação.
 */
export function ehProrrogacaoDeContinuo(tipo: string | null | undefined): boolean {
  return (tipo ?? '').trim().toLowerCase() === 'prorrogacao';
}

/**
 * O que a alteração faz com o limite do art. 125 — em uma frase.
 *
 * Fica FORA do rótulo do seletor, de propósito. Rótulo é nome de instituto
 * ("Reequilíbrio Econômico-Financeiro (art. 124, II, 'd')"); consequência é
 * outra coisa. Misturar as duas produz um menu de linhas longas que ninguém lê
 * até o fim — e foi o que eu fiz na primeira tentativa.
 *
 * Aparece abaixo do seletor, depois da escolha, que é quando a pessoa quer
 * saber o que vai acontecer.
 */
export function efeitoNoLimite(tipo: string | null | undefined): string {
  const t = (tipo ?? '').trim().toLowerCase();
  if (consomeLimiteDoArt125(t)) {
    return 'Consome o limite do art. 125: 25% do valor inicial atualizado, '
      + '50% em reforma de edifício ou de equipamento.';
  }
  if (t === 'prorrogacao') {
    return 'Abre novo período de vigência. Não acresce ao anterior e não consome o '
      + 'limite do art. 125 — mas conta para a vigência máxima decenal do art. 107.';
  }
  if (t === 'prazo') {
    return 'Prorroga pelo tempo necessário à conclusão do objeto (art. 111). Não '
      + 'consome o limite do art. 125.';
  }
  if (t === 'prazo_valor' || t === 'prazo_quantidade') {
    // A frase anterior dizia "a parte do acréscimo consome o limite" — mas o
    // cálculo do alerta (20260831000008) deixa o misto FORA da soma, de
    // propósito: o uso real deste tipo é a RENOVAÇÃO de contínuo, onde o
    // "acréscimo" é a estimativa do novo período (art. 107) e não consome
    // limite nenhum. Rótulo afirmando o que o cálculo não faz é o pior dos
    // mundos; agora os dois dizem a mesma coisa. O 149/2024 usa exatamente
    // assim: +3.600 do novo período anual.
    return 'Prorroga e registra a estimativa do novo período (art. 107) — esse acréscimo '
      + 'NÃO consome o limite do art. 125. Acréscimo genuíno dentro da mesma vigência '
      + 'deve ser registrado como Alteração Quantitativa.';
  }
  if (t === 'reajuste') {
    return 'Registro por apostila — não é alteração contratual e não consome o limite.';
  }
  if (['reequilibrio', 'revisao', 'repactuacao'].includes(t)) {
    return 'Restabelece o equilíbrio econômico-financeiro. Fica fora do limite do '
      + 'art. 125, que só alcança alteração quantitativa.';
  }
  if (['adesao', 'remanejamento'].includes(t)) {
    return 'Não toca o valor original do ajuste.';
  }
  return '';
}
