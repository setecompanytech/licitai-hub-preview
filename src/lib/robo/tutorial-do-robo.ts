/**
 * O texto do tutorial do Robô de lances — o "?" do topo da lista (17/09/2026).
 *
 * Pedido do Ian: um guia que explique como o robô funciona, o passo a passo de
 * uso e, em cartões separados, o que muda em cada portal — porque o robô que
 * entra com login hoje opera o Compras.gov e o Portal de Compras Públicas, e os
 * demais portais seguem por integração de API.
 *
 * Mora fora do componente por dois motivos: constante exportada de arquivo de
 * componente desliga a atualização instantânea da tela, e o texto é o que
 * envelhece — quando um portal ganhar lance liberado, a mudança é aqui, com
 * teste, e não caçando frase dentro de JSX.
 *
 * Regra do texto: só o que o robô faz HOJE. O que ainda não faz aparece como
 * "ainda não", nunca omitido — o cliente decide a estratégia a partir disto.
 */

export type FaseDoRobo = { titulo: string; texto: string };

export type PassoDoTutorial = { titulo: string; texto: string; onde: string };

export type ComoOPortalFunciona = 'robo-gov-br' | 'robo-login' | 'api';

export type PortalNoTutorial = {
  id: string;
  nome: string;
  como: ComoOPortalFunciona;
  /** O selo do cartão. */
  rotuloDoComo: string;
  resumo: string;
  oQueFaz: string[];
  lance: { liberado: boolean; texto: string };
  /** O que a empresa precisa saber antes de contar com o robô nesse portal. */
  atencao?: string;
};

export const FASES_DO_ROBO: readonly FaseDoRobo[] = [
  {
    titulo: 'Você configura',
    texto: 'Cadastra a disputa, o valor mínimo de cada item e a estratégia. É aqui que a empresa decide até onde o robô pode ir.',
  },
  {
    titulo: 'O robô entra sozinho',
    texto: 'No horário da sessão, ele entra no portal com o acesso da empresa e acompanha item por item.',
  },
  {
    titulo: 'Você acompanha',
    texto: 'Posição, melhor lance, avisos e linha do tempo aparecem no Praefectus, sem precisar abrir o portal.',
  },
];

export const PASSOS_DO_TUTORIAL: readonly PassoDoTutorial[] = [
  {
    titulo: 'Ligue o robô da empresa',
    texto: 'O botão "Ligar o robô", no topo desta página, vale para todas as disputas da empresa. Desligado, o robô não entra em nenhuma.',
    onde: 'Topo da página do Robô de lances',
  },
  {
    titulo: 'Confira o acesso aos portais',
    texto: 'O robô entra com o acesso da empresa: login e senha, ou certificado digital, conforme o portal. Sem acesso cadastrado, ele não consegue entrar.',
    onde: 'Gerenciar portais',
  },
  {
    titulo: 'Cadastre a disputa',
    texto: 'Escolha o portal e informe a licitação. No Compras.gov, a UASG e o número/ano trazem sozinhos os itens, a data e os dados da compra.',
    onde: 'Nova sessão',
  },
  {
    titulo: 'Defina o valor mínimo e as estratégias de cada item',
    texto: 'O valor mínimo (piso) é obrigatório: o robô nunca dá lance abaixo dele. Marque uma, duas ou as três estratégias do item — elas somam. O limite de lances é opcional.',
    onde: 'Nova sessão › itens, ou Editar parâmetros',
  },
  {
    titulo: 'Marque a data e a hora da sessão',
    texto: 'Com data e hora, o robô entra sozinho 15 minutos antes. Sem data, ele só entra quando alguém clica em Entrar agora.',
    onde: 'Definir data da sessão, na página da disputa',
  },
  {
    titulo: 'Ligue o Modo Automático da disputa',
    texto: 'Ligado, o robô pode dar lance nos portais em que o lance está liberado. Desligado, ele entra e só acompanha.',
    onde: 'Editar parâmetros › Modo Automático',
  },
  {
    titulo: 'Acompanhe',
    texto: 'A página da disputa mostra o robô entrando, a posição e o melhor lance de cada item e a linha do tempo. Os avisos chegam no canto da tela, no sininho e por e-mail.',
    onde: 'Aba Em disputa › abrir a disputa',
  },
  {
    titulo: 'Pare ou encerre quando quiser',
    texto: '"Parar robô nesta disputa" interrompe só aquela disputa; lances já aceitos pelo portal continuam valendo. Quando a fase de lances termina, o robô sai sozinho.',
    onde: 'Página da disputa · Ações',
  },
];

export const BOM_SABER: readonly string[] = [
  'O robô nunca dá lance abaixo do valor mínimo do item.',
  'Modo Automático desligado: o robô entra e só acompanha, sem lance.',
  'Lembretes chegam na véspera e 1 hora antes, conferindo robô ligado, acesso, UASG, valor mínimo e documentos de habilitação.',
  'Com a disputa ligada a um processo, o funil acompanha: Em Disputa quando o robô vê a proposta da empresa, Homologada quando o Compras.gov publica a vitória.',
];

export const ABAS_DA_LISTA: readonly { nome: string; texto: string }[] = [
  { nome: 'Cadastradas', texto: 'A disputa existe, mas ainda falta algo para ficar pronta.' },
  { nome: 'Configuradas', texto: 'Portal, preço inicial, valor mínimo em todos os itens e versão aprovada na Precificação.' },
  { nome: 'Em disputa', texto: 'O robô está na sala, ou alguém marcou a fase à mão.' },
  { nome: 'Encerradas', texto: 'A sessão terminou, ou a disputa foi encerrada em Ações.' },
];

export const PORTAIS_NO_TUTORIAL: readonly PortalNoTutorial[] = [
  {
    id: 'compras-gov',
    nome: 'Compras.gov.br',
    como: 'robo-gov-br',
    rotuloDoComo: 'Robô com login gov.br',
    resumo: 'O robô entra no portal como a empresa, com o certificado digital, e disputa item por item.',
    oQueFaz: [
      'Entra pelo gov.br com o certificado digital. O login fica guardado por horas: um login pela manhã costuma cobrir o dia, e cada disputa entra em segundos.',
      'Quando o gov.br pede a verificação "não sou um robô", a equipe Praefectus é avisada e confirma. Com o login vencido, o robô entra 1 hora antes, para dar tempo.',
      'Acha a compra pela UASG e pelo número/ano e lê os itens, o modo de disputa, o intervalo mínimo e a classificação de cada item.',
      'Com o Modo Automático ligado, dá lance seguindo a estratégia de cada item, sem passar do valor mínimo.',
      'Sai sozinho quando o portal encerra a fase de lances.',
    ],
    lance: { liberado: true, texto: 'Lance automático liberado' },
    atencao:
      'A proposta é cadastrada pela equipe da empresa no próprio portal. Na estratégia Iminência, o robô ainda não lê o tempo restante do Compras.gov e só acompanha.',
  },
  {
    id: 'portal-compras',
    nome: 'Portal de Compras Públicas',
    como: 'robo-login',
    rotuloDoComo: 'Robô com login',
    resumo: 'O robô entra com o usuário e a senha da empresa e acompanha o processo.',
    oQueFaz: [
      'Entra com o usuário e a senha da empresa, cadastrados em Gerenciar portais.',
      'Acha o processo em "Seus Processos" e abre os dados do processo.',
      'Fica acompanhando, e cada rodada aparece na linha do tempo da disputa.',
    ],
    lance: { liberado: false, texto: 'Lance automático ainda não liberado — o robô acompanha' },
    atencao: 'A conta da empresa no portal precisa estar ativa. Com o plano vencido, o portal não deixa disputar.',
  },
  {
    id: 'api',
    nome: 'Demais portais',
    como: 'api',
    rotuloDoComo: 'Integração por API',
    resumo: 'Licitanet, BLL, BNC, Licitações-e, BEC/SP e os portais estaduais não usam o robô que entra com login.',
    oQueFaz: [
      'A conexão é pela integração com a API de cada portal, e não por um navegador entrando com login.',
      'O que a integração faz depende do que cada portal libera na API.',
      'Dúvida sobre um portal específico: fale com a equipe Praefectus.',
    ],
    lance: { liberado: false, texto: 'Sem robô com login nesses portais' },
  },
];
