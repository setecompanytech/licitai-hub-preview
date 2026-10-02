/**
 * A CENTRAL DE NOTIFICAÇÕES DO COMPRAS.GOV, lida pelo robô (02/10/2026).
 *
 * O agente lê a central do fornecedor quando confere a sessão e guarda o que
 * viu; `GET /notificacoes-portal` serve. Faltava o consumidor — e com ele falta
 * a única fonte que alcança **todas as compras da empresa**, inclusive as que
 * não estão em disputa.
 *
 * O valor disso foi medido em 01/10: a reabertura do pregão 90029/2026 para o
 * dia 08/10 — a próxima disputa real — apareceu **só ali**, na mensagem do
 * agente de contratação das 10:43. Nenhuma tela do Praefectus a teria mostrado.
 *
 * O QUE ESTE MÓDULO DECIDE, e por que não é "mandar tudo": a central publica
 * muita coisa, e a maior parte é registro, não chamado. Avisar sobre tudo
 * treina a pessoa a ignorar o sininho — e aí o aviso que importa passa junto
 * com o resto.
 *
 * Sem `Deno.*` de propósito — o vitest roda este arquivo.
 */

/** O que o agente devolve por notificação (ver `notificacaoResumida`). */
export interface NotificacaoDoPortal {
  id: string | null;
  lida?: boolean;
  texto?: string | null;
  publicada_em?: string | null;
  categoria?: string | null;
  contexto?: string | null;
  uasg?: string | null;
  numero_compra?: string | null;
  modalidade?: string | null;
  id_compra?: string | null;
  item?: number | null;
}

export type UrgenciaDoAviso = 'urgente' | 'importante' | 'informativo';

export interface AvisoDaCentral {
  /** `portal:<id>` — a chave que impede o mesmo aviso de sair duas vezes. */
  chave: string;
  urgencia: UrgenciaDoAviso;
  titulo: string;
  mensagem: string;
  compra: string | null;
  item: number | null;
  publicadaEm: string | null;
}

/**
 * Chamado de verdade: exige ação de gente, com prazo correndo.
 *
 * A convocação para enviar proposta e anexos é o caso que a operação descreveu
 * com todas as letras — *"ele me dá um prazo de duas horas […] se eu não enviar,
 * minha empresa será desclassificada"*.
 */
const PEDE_ACAO =
  /convocad|convoca[çc][ãa]o|dilig[êe]ncia|intima|apresent\w*\s+(a\s+)?(proposta|documento)|envi\w*\s+(os\s+)?anexos|prazo para|habilita[çc][ãa]o|recurso|impugna|negocia[çc][ãa]o/i;

/**
 * Muda o calendário: a compra volta, muda de data ou para. Não há prazo
 * correndo agora, mas quem opera precisa saber hoje — foi assim que a
 * reabertura de 08/10 apareceu.
 */
const MUDA_O_CALENDARIO =
  /reabertur|reabr|remarcad|nova data|adiad|suspens|retomad|republica|cancelad|revogad|anulad/i;

/**
 * REGISTRO DE ANDAMENTO — o portal narrando o que aconteceu, sem pedir nada.
 *
 * Conferido primeiro, e por um motivo concreto: *"O item 76 está na etapa de
 * julgamento de proposta no período de intenção de recursos"* contém a palavra
 * "recurso" e viraria **alerta urgente**. É o texto mais comum da central — se
 * ele toca o sininho, o sininho deixa de significar alguma coisa, e o chamado
 * que importa passa junto com o resto.
 *
 * A regra: a central NARRA na terceira pessoa ("o item está", "foi para") e
 * CHAMA na segunda ("você foi convocado", "apresente"). O que narra não acorda
 * ninguém.
 */
const EH_REGISTRO =
  /est[áa] n[ao] (etapa|fase)|foi para (a|o) (etapa|fase)|per[íi]odo de inten[çc][ãa]o|etapa de julgamento|encerrad[ao] a (etapa|fase)|teve a solicita[çc][ãa]o|em an[áa]lise/i;

/**
 * CHAMADO INEQUÍVOCO — vence o registro, sempre.
 *
 * Existe porque a central mistura: *"O item 4 está na etapa de aceitação. Você
 * foi convocado para enviar anexos, prazo até 11:28."* narra E chama. Conferir
 * registro primeiro descartaria esse texto, e **perder uma convocação custa
 * desclassificação** — enquanto um aviso a mais custa um toque no sininho.
 *
 * Os dois erros não são simétricos, e a regra segue o lado barato.
 */
const CHAMADO_INEQUIVOCO =
  /voc[êe] foi convocad|fica convocad|prazo para encerrar o envio|apresent\w*\s+(a\s+)?proposta|envi\w*\s+(a\s+)?documenta[çc][ãa]o/i;

const limpar = (t: string | null | undefined) => String(t ?? '').replace(/\s+/g, ' ').trim();

/** "Pregão 9/2026 (UASG 980425)" — como a pessoa chama a compra. */
export function rotuloDaCompra(n: NotificacaoDoPortal): string | null {
  const numero = limpar(n.numero_compra);
  const uasg = limpar(n.uasg);
  if (!numero && !uasg) return null;
  const modalidade = limpar(n.modalidade) || 'Compra';
  const partes = [numero ? `${modalidade} ${numero}` : modalidade];
  if (uasg) partes.push(`(UASG ${uasg})`);
  return partes.join(' ');
}

/**
 * Esta notificação vira aviso? E com que peso?
 *
 * `null` quando não vira — e isso é a maioria, de propósito.
 */
export function urgenciaDaNotificacao(n: NotificacaoDoPortal): UrgenciaDoAviso | null {
  // Já lida no portal: alguém viu. Repetir no sininho é ruído.
  if (n.lida === true) return null;
  const texto = limpar(n.texto);
  if (!texto) return null;

  // Chamado inequívoco vence o registro: o texto que narra E convoca é
  // convocação.
  if (CHAMADO_INEQUIVOCO.test(texto)) return 'urgente';

  // Fora isso, narrar não é chamar.
  if (EH_REGISTRO.test(texto)) return null;

  if (PEDE_ACAO.test(texto)) return 'urgente';
  if (MUDA_O_CALENDARIO.test(texto)) return 'importante';
  return null;
}

/**
 * De notificações do portal para avisos do Praefectus.
 *
 * Deduplica por id dentro da própria lista (a central repete a mesma mensagem
 * em cartões aninhados) e devolve só o que merece sininho.
 */
export function avisosDaCentral(notificacoes: NotificacaoDoPortal[]): AvisoDaCentral[] {
  const lista = Array.isArray(notificacoes) ? notificacoes : [];
  const vistos = new Set<string>();
  const avisos: AvisoDaCentral[] = [];

  for (const n of lista) {
    if (!n || !n.id) continue;
    const chave = `portal:${n.id}`;
    if (vistos.has(chave)) continue;

    const urgencia = urgenciaDaNotificacao(n);
    if (!urgencia) continue;
    vistos.add(chave);

    const compra = rotuloDaCompra(n);
    const texto = limpar(n.texto);
    const item = Number.isFinite(Number(n.item)) ? Number(n.item) : null;

    avisos.push({
      chave,
      urgencia,
      titulo: urgencia === 'urgente'
        ? `📣 Chamado no Compras.gov${compra ? ` — ${compra}` : ''}`
        : `📅 Mudança no Compras.gov${compra ? ` — ${compra}` : ''}`,
      // O texto do portal vai inteiro (até o limite), porque é ele que traz o
      // prazo e o número do item. Resumir aqui perderia justamente o que faz
      // a pessoa agir.
      mensagem: item ? `Item ${item}: ${texto}` : texto,
      compra,
      item,
      publicadaEm: n.publicada_em ?? null,
    });
  }

  // Urgente primeiro; dentro de cada peso, a mais recente na frente.
  const peso = (u: UrgenciaDoAviso) => (u === 'urgente' ? 2 : u === 'importante' ? 1 : 0);
  return avisos.sort((a, b) => {
    const d = peso(b.urgencia) - peso(a.urgencia);
    if (d !== 0) return d;
    return String(b.publicadaEm ?? '').localeCompare(String(a.publicadaEm ?? ''));
  });
}
