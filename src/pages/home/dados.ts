/**
 * Conteúdo da landing pública — separado da apresentação para o texto poder
 * ser revisado sem tocar em componente.
 *
 * Todos os links apontam para rotas PÚBLICAS existentes em App.tsx ou para
 * âncoras da própria página. Nada aqui referencia a área logada.
 */
import {
  Radar, Bell, Crosshair, Kanban, Bot, FileSearch, Calculator, TrendingUp,
  Users, FileText, ShoppingCart, Target, Send, Trophy, Gauge, Landmark,
  type LucideIcon,
} from 'lucide-react';

// ─── Navegação ────────────────────────────────────────────────────────────────

export type ItemNav = { rotulo: string; href: string; icone: LucideIcon };

export const GRUPOS_FUNCIONALIDADES: { titulo: string; itens: ItemNav[] }[] = [
  {
    titulo: 'Monitorar & Vencer',
    itens: [
      { rotulo: 'Monitoramento de Editais', href: '#funcionalidades', icone: Radar },
      { rotulo: 'Boletins Diários', href: '#funcionalidades', icone: Bell },
      { rotulo: 'Robô de Lances', href: '#funcionalidades', icone: Crosshair },
      { rotulo: 'Kanban de Processos', href: '#funcionalidades', icone: Kanban },
    ],
  },
  {
    titulo: 'Inteligência & IA',
    itens: [
      { rotulo: 'AURÉLIA — consultora IA', href: '#ia', icone: Bot },
      { rotulo: 'Análise de Edital por IA', href: '#ia', icone: FileSearch },
      { rotulo: 'Precificação Inteligente', href: '#funcionalidades', icone: Calculator },
      { rotulo: 'Mercado & Concorrentes', href: '#funcionalidades', icone: TrendingUp },
    ],
  },
  {
    titulo: 'Gerir & Faturar',
    itens: [
      { rotulo: 'Gestão de Contratos', href: '#funcionalidades', icone: FileText },
      { rotulo: 'Compras, Pedidos e Estoque', href: '#funcionalidades', icone: ShoppingCart },
      { rotulo: 'Metas do Comercial', href: '#funcionalidades', icone: Target },
      { rotulo: 'Equipe & Permissões', href: '#funcionalidades', icone: Users },
    ],
  },
];

// ─── Hero ─────────────────────────────────────────────────────────────────────

export const BULLETS_HERO: { texto: string }[] = [
  { texto: 'Monitoramento de editais do PNCP e diários oficiais em tempo real' },
  { texto: 'Robô de Lances operando nos principais portais de disputa' },
  { texto: 'AURÉLIA lê o edital e aponta riscos antes de você decidir' },
  { texto: 'Kanban do processo inteiro, do aviso à homologação' },
  { texto: 'Metas do comercial com projeção e alerta de risco por colaborador' },
];

// ─── Trio de proposta de valor ────────────────────────────────────────────────

export const TRIO_VALOR: { icone: LucideIcon; titulo: string; texto: string }[] = [
  {
    icone: Bot,
    titulo: 'IA no edital',
    texto:
      'A AURÉLIA analisa cláusulas, exigências de habilitação e riscos do edital em minutos — antes de a sua equipe gastar horas nele.',
  },
  {
    icone: Landmark,
    titulo: 'Gestão de ponta a ponta',
    texto:
      'Do aviso de licitação ao pedido faturado: monitoramento, disputa, contrato, compras e financeiro no mesmo lugar.',
  },
  {
    icone: Gauge,
    titulo: 'Metas & projeção',
    texto:
      'Meta por colaborador com projeção de fechamento, ritmo necessário por dia útil e alerta quando o mês entra em risco.',
  },
];

// ─── Grid de funcionalidades ──────────────────────────────────────────────────

export const FUNCIONALIDADES: { icone: LucideIcon; titulo: string; texto: string }[] = [
  {
    icone: Radar,
    titulo: 'Monitoramento de Editais',
    texto: 'Novos editais do PNCP filtrados pelo seu perfil, com UFs prioritárias e alertas.',
  },
  {
    icone: Crosshair,
    titulo: 'Robô de Lances',
    texto: 'Lances automáticos com limites seus, decremento configurável e trilha completa.',
  },
  {
    icone: Bot,
    titulo: 'AURÉLIA — Consultora IA',
    texto: 'Tira dúvidas de habilitação, analisa cláusulas e orienta pela Lei 14.133/2021.',
  },
  {
    icone: Calculator,
    titulo: 'Precificação Inteligente',
    texto: 'Custos, margem e comparação com preços públicos para propor sem chutar.',
  },
  {
    icone: Send,
    titulo: 'Proposta Comercial',
    texto: 'Propostas e documentos padronizados, gerados a partir do próprio processo.',
  },
  {
    icone: Kanban,
    titulo: 'Kanban de Processos',
    texto: 'Cada licitação em um card, do monitoramento à homologação, com motivo de perda.',
  },
  {
    icone: FileText,
    titulo: 'Gestão de Contratos',
    texto: 'Contratos, atas, saldos e aditivos ligados aos pedidos e ao faturamento.',
  },
  {
    icone: ShoppingCart,
    titulo: 'Compras, Pedidos e Estoque',
    texto: 'Pedidos de compra e venda em kanban, NF-e e estoque no mesmo fluxo.',
  },
  {
    icone: Target,
    titulo: 'Metas do Comercial',
    texto: 'Meta × realizado por colaborador, projeção de fechamento e alerta de risco.',
  },
];

// ─── Faixa IA ─────────────────────────────────────────────────────────────────

export const PONTOS_IA: string[] = [
  'Análise de edital: exigências, prazos e riscos resumidos em linguagem direta',
  'Avaliação de preço com histórico público antes de você dar o lance',
  'Consultoria contínua pela Lei 14.133/2021, dentro da tela em que você trabalha',
];

// ─── Números ──────────────────────────────────────────────────────────────────

/**
 * ⚠️ VALIDAR ANTES DE DIVULGAR: números exibidos publicamente como fato.
 * Origem atual: 823 = contagem de editais PNCP no dashboard em 03/08/2026;
 * 27 = todas as UFs (o PNCP é nacional); 24 = portais no template do agente
 * do Robô de Lances. Se algum não puder ser sustentado, remova a linha —
 * a seção se ajusta sozinha.
 */
export const NUMEROS: { valor: number; sufixo?: string; rotulo: string }[] = [
  { valor: 823, sufixo: '+', rotulo: 'editais novos no radar por dia' },
  { valor: 27, rotulo: 'unidades da federação monitoradas' },
  { valor: 24, rotulo: 'portais de disputa suportados pelo robô' },
  { valor: 6, rotulo: 'etapas da licitação em uma só plataforma' },
];

// ─── Processo em 6 etapas ─────────────────────────────────────────────────────

export const ETAPAS: { titulo: string; texto: string; icone: LucideIcon }[] = [
  { icone: Radar, titulo: 'Monitore', texto: 'Editais do PNCP e diários oficiais chegam filtrados pelo seu perfil de atuação.' },
  { icone: FileSearch, titulo: 'Analise com IA', texto: 'A AURÉLIA lê o edital, resume exigências e aponta riscos de habilitação.' },
  { icone: Calculator, titulo: 'Precifique', texto: 'Custos, margem e preços públicos de referência para uma proposta defensável.' },
  { icone: Crosshair, titulo: 'Dispute', texto: 'Robô de Lances opera dentro dos seus limites, com você no controle.' },
  { icone: Trophy, titulo: 'Contrate', texto: 'Vitória vira contrato com saldo, pedidos e obrigações acompanhados.' },
  { icone: Gauge, titulo: 'Fature e meça', texto: 'Pedidos faturados alimentam o financeiro e as metas do comercial.' },
];

// ─── Depoimentos (placeholders — substituir por clientes reais) ───────────────

export const DEPOIMENTOS: { texto: string; nome: string; cargo: string; iniciais: string }[] = [
  {
    texto:
      '"Antes o edital passava por três pessoas antes de alguém decidir. Hoje a análise da IA chega antes do café e a decisão sai no mesmo dia."',
    nome: 'Nome do Cliente',
    cargo: 'Diretor(a) Comercial — placeholder',
    iniciais: 'NC',
  },
  {
    texto:
      '"O robô segurou o lance no limite que definimos e ganhamos com margem. O processo inteiro ficou registrado para a auditoria."',
    nome: 'Nome do Cliente',
    cargo: 'Sócio(a) — placeholder',
    iniciais: 'NC',
  },
  {
    texto:
      '"O painel de metas acabou com a planilha de fim de mês. Cada vendedor sabe o ritmo que precisa manter para bater a meta."',
    nome: 'Nome do Cliente',
    cargo: 'Gestor(a) de Licitações — placeholder',
    iniciais: 'NC',
  },
];

// ─── FAQ ──────────────────────────────────────────────────────────────────────

export const FAQ: { pergunta: string; resposta: string }[] = [
  {
    pergunta: 'O que é o Praefectus?',
    resposta:
      'Uma plataforma de gestão de licitações que cobre o ciclo completo: monitoramento de editais, análise com IA, precificação, disputa com robô de lances, contratos, compras e metas do comercial — tudo em um único lugar.',
  },
  {
    pergunta: 'Preciso instalar alguma coisa?',
    resposta:
      'Não. O Praefectus roda no navegador. Também há aplicativo móvel para acompanhar avisos e disputas fora do escritório.',
  },
  {
    pergunta: 'Como funciona o monitoramento de editais?',
    resposta:
      'A plataforma acompanha o PNCP e diários oficiais continuamente e filtra os avisos pelo seu perfil: ramo de atuação, modalidades e UFs prioritárias. Você recebe boletins diários e alertas do que interessa.',
  },
  {
    pergunta: 'Em quais portais o Robô de Lances opera?',
    resposta:
      'Nos principais portais públicos de disputa do país, incluindo Compras.gov.br, BLL, Licitações-e, BEC-SP e portais estaduais integrados. Você define limites e decrementos; o robô executa e registra tudo.',
  },
  {
    pergunta: 'A IA substitui a minha equipe?',
    resposta:
      'Não — ela tira o trabalho braçal. A AURÉLIA resume editais, aponta riscos e responde dúvidas com base na Lei 14.133/2021, mas cada decisão de participar, precificar e dar lance continua sendo sua.',
  },
  {
    pergunta: 'Meus dados ficam isolados dos de outras empresas?',
    resposta:
      'Sim. Cada empresa tem seus dados segregados com controle de acesso em nível de linha no banco, e as permissões internas são definidas por papel e setor de cada colaborador.',
  },
  {
    pergunta: 'Posso testar antes de contratar?',
    resposta:
      'Sim. Crie a conta gratuita, cadastre sua empresa e explore a plataforma. A evolução para os planos pagos é feita dentro do próprio sistema, sem contato comercial obrigatório.',
  },
];

// ─── Footer ───────────────────────────────────────────────────────────────────

export const FOOTER_COLUNAS: { titulo: string; links: { rotulo: string; href: string }[] }[] = [
  {
    titulo: 'Produto',
    links: [
      { rotulo: 'Funcionalidades', href: '#funcionalidades' },
      { rotulo: 'IA AURÉLIA', href: '#ia' },
      { rotulo: 'Como funciona', href: '#processo' },
      { rotulo: 'Status da plataforma', href: '/status' },
    ],
  },
  {
    titulo: 'Empresa',
    links: [
      { rotulo: 'Sobre', href: '/sobre' },
      { rotulo: 'Soluções', href: '/solucoes' },
      { rotulo: 'Investidores', href: '/investidores' },
    ],
  },
  {
    titulo: 'Acesso',
    links: [
      { rotulo: 'Entrar', href: '/auth' },
      { rotulo: 'Criar conta', href: '/cadastro' },
      { rotulo: 'Perguntas frequentes', href: '/faq' },
    ],
  },
  {
    titulo: 'Legal',
    links: [
      { rotulo: 'Termos de uso', href: '/termos-de-uso' },
      { rotulo: 'Privacidade', href: '/politica-de-privacidade' },
      { rotulo: 'Cookies', href: '/politica-cookies' },
      { rotulo: 'SLA', href: '/politica-sla' },
    ],
  },
];
