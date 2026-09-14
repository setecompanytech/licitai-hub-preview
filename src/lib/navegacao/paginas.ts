/**
 * Padronização das telas do menu (identidade 12/09/2026).
 *
 * `menu.ts` responde "o que existe e onde clica". Este arquivo responde
 * "como cada tela se apresenta": o título que aparece no h1, a linha que
 * explica a tela, a ação principal e o padrão de conteúdo logo abaixo.
 *
 * Por que num registro, e não espalhado em cada página: eram 93 títulos
 * escritos à mão, com tamanhos e vocabulários diferentes — a mesma doença
 * que o vocabulário de status tinha antes de `licitacao/status.ts`. Aqui,
 * mudar o nome de um módulo é uma linha, e a tela inteira acompanha.
 *
 * Regras que as descrições seguem:
 *  - dizem o que a tela FAZ, não o que o produto promete;
 *  - uma frase, sem ponto final, na voz de quem usa;
 *  - nenhum número sem fonte (nada de "13 portais", "99,9%").
 *
 * O `padrao` não é enfeite: é o contrato de layout abaixo do cabeçalho, e
 * a galeria de referência (docs/padronizacao-menus) desenha cada um.
 */
import {
  Archive, BarChart3, Bell, BookOpen, Bot, Building2, Calculator, CalendarDays,
  ClipboardCheck, Crosshair, DollarSign, Download, FileBarChart, FileText, Gauge,
  GraduationCap, HeadphonesIcon, Kanban, LayoutDashboard, ListChecks, MessageSquare,
  Plug, Scale, Send, Settings, Shield, ShieldCheck, ShoppingCart, SlidersHorizontal,
  Target, TrendingUp, Users, Workflow,
} from 'lucide-react';
import type { ElementType } from 'react';

/** O que vem abaixo do cabeçalho — o contrato de layout da tela. */
export type PadraoDeConteudo =
  | 'painel'      // KPIs em linha + blocos de leitura (gráfico, mapa, listas)
  | 'abas'        // fila de abas; cada aba é uma seção da mesma tela
  | 'tabela'      // lista densa com filtros acima e ações por linha
  | 'cartoes'     // grade de cartões (catálogo, coleção, hub)
  | 'formulario'  // campos agrupados por assunto, ação no rodapé
  | 'kanban'      // colunas arrastáveis
  | 'calendario'  // grade de datas
  | 'conversa';   // fio de mensagens com composição ao pé

export interface PaginaPadrao {
  /** Rota exata de `menu.ts`. */
  rota: string;
  /** Grupo do menu — vira o primeiro degrau da trilha. */
  grupo: string;
  /** Vai no h1 (28/36 Manrope). Pode ser mais pleno que o rótulo do menu. */
  titulo: string;
  /** Uma frase abaixo do título (16/24), sem ponto final. */
  descricao: string;
  /** Ícone do módulo — o mesmo do menu, para a tela e a barra combinarem. */
  icone: ElementType;
  /** Rótulo da ação principal (botão verde à direita do título). Ausente
   *  quando a tela é de leitura e não tem uma ação que a defina. */
  acao?: string;
  padrao: PadraoDeConteudo;
  /** Abas reais da tela, quando `padrao === 'abas'`. */
  abas?: string[];
}

export const paginasPadrao: PaginaPadrao[] = [
  // ── Inteligência ──────────────────────────────────────────────────────
  {
    rota: '/dashboard', grupo: 'Inteligência', titulo: 'Painel', icone: LayoutDashboard,
    descricao: 'O dia da sua empresa: oportunidades, prazos e resultados num relance',
    acao: 'Relatório PDF', padrao: 'painel',
  },
  {
    rota: '/analytics', grupo: 'Inteligência', titulo: 'Analytics', icone: BarChart3,
    // A tela não quebra por período, órgão nem responsável: as agregações de
    // `useAnalyticsData` são modalidade, status e UF, mais a evolução dos
    // últimos seis meses no gráfico de barras — que a descrição resume como
    // "mês a mês" porque descrição do registro não carrega número.
    descricao: 'Desempenho da operação por modalidade, status e UF, com a evolução mês a mês',
    padrao: 'painel',
  },
  {
    rota: '/precificacao', grupo: 'Inteligência', titulo: 'Precificação', icone: DollarSign,
    descricao: 'Do item do edital ao preço final, com custos, tributos e margem',
    acao: 'Nova composição', padrao: 'abas',
    abas: ['Itens do edital', 'Marketplaces', 'Preços gov', 'Cotações', 'Calculadora', 'Catálogo', 'Inteligência', 'Nova precificação'],
  },
  {
    rota: '/proposta-tecnica', grupo: 'Inteligência', titulo: 'Proposta comercial', icone: FileBarChart,
    descricao: 'Monte a proposta com a planilha de preços e gere o documento de envio',
    acao: 'Nova proposta', padrao: 'formulario',
  },
  {
    rota: '/analise-mercado', grupo: 'Inteligência', titulo: 'Análise de mercado', icone: TrendingUp,
    descricao: 'Preços praticados e contratos publicados por órgão e região',
    padrao: 'abas', abas: ['Panorama', 'Preços', 'Maiores contratos', 'Consultas'],
  },
  {
    rota: '/concorrentes', grupo: 'Inteligência', titulo: 'Concorrentes', icone: Users,
    descricao: 'Consulte CNPJ, idoneidade, certidões e documentos de quem disputa com você',
    acao: 'Nova consulta', padrao: 'abas',
    abas: ['Análise de documentos', 'Consulta CNPJ', 'Idoneidade', 'Sintegra', 'Certidões'],
  },

  // ── Monitoramento ─────────────────────────────────────────────────────
  {
    rota: '/monitoramento-editais', grupo: 'Monitoramento', titulo: 'Editais e licitações', icone: Download,
    descricao: 'Busque editais publicados e traga para o seu fluxo os que interessam',
    acao: 'Buscar editais', padrao: 'tabela',
  },
  {
    rota: '/avisos', grupo: 'Monitoramento', titulo: 'Central de avisos', icone: Bell,
    descricao: 'Tudo que o sistema detectou e precisa da sua atenção',
    padrao: 'abas', abas: ['Todos', 'Não lidos', 'Urgentes', 'Arquivados'],
  },
  {
    rota: '/boletins', grupo: 'Monitoramento', titulo: 'Boletins diários', icone: Bell,
    descricao: 'O resumo do dia por e-mail e o histórico do que já foi enviado',
    acao: 'Enviar agora', padrao: 'abas', abas: ['Boletins', 'Configuração', 'Histórico'],
  },
  {
    rota: '/monitoramento-chat', grupo: 'Monitoramento', titulo: 'Chat e mural', icone: MessageSquare,
    descricao: 'Mensagens do processo e o mural da equipe no mesmo lugar',
    // Os rótulos são os que a tela mostra, na mesma ordem. Os antigos
    // ('Processo', 'Chat', 'Mural') invertiam o sentido: 'Processo' é o mural do
    // processo e 'Mural' são as publicações do portal. A primeira aba só existe
    // quando a URL traz ?lid.
    padrao: 'conversa', abas: ['Mural do Processo', 'Chat do Pregoeiro', 'Publicações do Portal'],
  },

  // ── Gestão de Processos ───────────────────────────────────────────────
  {
    rota: '/licitacoes-estrategicas', grupo: 'Gestão de Processos', titulo: 'Licitações estratégicas', icone: Target,
    descricao: 'As disputas que merecem prioridade, com a saúde fiscal de quem compra',
    padrao: 'abas', abas: ['Oportunidades', 'CAPAG'],
  },
  {
    rota: '/meus-compromissos', grupo: 'Gestão de Processos', titulo: 'Meus compromissos', icone: ListChecks,
    descricao: 'O que é seu para fazer, por processo e por prazo',
    padrao: 'cartoes', abas: ['Ativos', 'Removidos'],
  },
  {
    rota: '/calendario', grupo: 'Gestão de Processos', titulo: 'Calendário', icone: CalendarDays,
    descricao: 'Sessões, entregas e vencimentos no mês',
    // Sem `acao`: o Calendário não cria nada. Ele mostra prazo de processo e
    // validade de documento, que nascem em outras telas — cadastro de tarefa
    // genérica não existe no sistema, e compromisso é de /meus-compromissos.
    // A linha `acao: 'Novo compromisso'` que estava aqui descrevia um botão que
    // a tela nunca teve; deixá-la no registro é convite para alguém implementar
    // depois o botão fictício que o padrão visual proíbe.
    padrao: 'calendario',
  },
  {
    rota: '/workflow-ia', grupo: 'Gestão de Processos', titulo: 'Workflow IA', icone: Workflow,
    descricao: 'A esteira que leva o edital da leitura à proposta pronta',
    acao: 'Iniciar esteira', padrao: 'formulario',
  },
  {
    rota: '/kanban', grupo: 'Gestão de Processos', titulo: 'Gestão de licitações', icone: Kanban,
    descricao: 'Cada processo na sua etapa, do edital ao desfecho',
    padrao: 'kanban', abas: ['Kanban', 'Compromissos', 'Histórico de extrações'],
  },
  {
    rota: '/robo-lances', grupo: 'Gestão de Processos', titulo: 'Robô de lances', icone: Crosshair,
    descricao: 'Cada participação por fase, e o que o robô está fazendo em cada uma',
    acao: 'Nova sessão', padrao: 'abas', abas: ['Disputar', 'Agente', 'Portais', 'Configurações'],
  },
  {
    rota: '/historico-licitacoes', grupo: 'Gestão de Processos', titulo: 'Histórico e desempenho', icone: Archive,
    descricao: 'O que já foi disputado, com resultado e valor',
    acao: 'Registrar licitação', padrao: 'tabela',
  },
  {
    rota: '/metas-comercial', grupo: 'Gestão de Processos', titulo: 'Metas do comercial', icone: Gauge,
    descricao: 'Meta por pessoa, ritmo necessário e projeção de fechamento',
    padrao: 'abas', abas: ['Painel', 'Equipe', 'Relatórios'],
  },
  {
    rota: '/gestao-contratos', grupo: 'Gestão de Processos', titulo: 'Gestão de contratos', icone: FileText,
    descricao: 'Saldo, vigência, aditivos e entregas de cada contrato assinado',
    acao: 'Novo contrato', padrao: 'tabela',
  },
  {
    rota: '/gestao-compras', grupo: 'Gestão de Processos', titulo: 'Compras, pedidos e estoque', icone: ShoppingCart,
    descricao: 'Pedidos de venda, produtos, fornecedores e o estoque que os atende',
    acao: 'Novo pedido', padrao: 'abas',
    abas: ['Pedidos', 'Produtos', 'Fornecedores', 'Estoque', 'NF-e', 'Certificado'],
  },

  // ── Jurídico & Contábil ───────────────────────────────────────────────
  {
    rota: '/documentos', grupo: 'Jurídico & Contábil', titulo: 'Documentos', icone: Shield,
    descricao: 'Certidões e atestados com validade vigiada e montagem da pasta de habilitação',
    /* Sem ação principal de propósito (achado da revisão de 13/09): o envio é
       POR VAGA do checklist — cada linha tem o seu "Enviar"/"Substituir", e o
       campo de arquivo só sabe o destino porque a linha clicada o registrou.
       Um botão no topo teria de adivinhar a vaga. */
    padrao: 'abas', abas: ['Documentos', 'Atestados', 'Unir arquivos', 'Alertas', 'Histórico'],
  },
  {
    rota: '/assessoria-cadastral', grupo: 'Jurídico & Contábil', titulo: 'Assessoria cadastral', icone: ClipboardCheck,
    descricao: 'Situação dos seus cadastros nos portais e o que falta em cada um',
    padrao: 'abas', abas: ['Cadastros', 'Documentos'],
  },
  {
    rota: '/apoio-juridico', grupo: 'Jurídico & Contábil', titulo: 'Apoio jurídico', icone: Scale,
    descricao: 'Impugnações, recursos e reequilíbrio a partir dos modelos e da sua base',
    acao: 'Redigir peça', padrao: 'abas',
    abas: ['Modelos', 'Reequilíbrio', 'Gerador com base', 'Base jurídica'],
  },
  {
    rota: '/apoio-contabil', grupo: 'Jurídico & Contábil', titulo: 'Apoio contábil', icone: Calculator,
    descricao: 'Balanço, índices de habilitação e pareceres a partir dos seus demonstrativos',
    acao: 'Nova análise', padrao: 'abas',
    abas: ['Modelos', 'Análise de balanço', 'Gerador', 'Legislação', 'Base contábil'],
  },
  {
    rota: '/indices-repactuacao', grupo: 'Jurídico & Contábil', titulo: 'Índices e repactuação', icone: TrendingUp,
    descricao: 'IPCA, INPC, IGP-M e CCTs para calcular reajuste e repactuação',
    padrao: 'abas', abas: ['Índices', 'CCTs', 'Simulador'],
  },

  // ── Financeiro ────────────────────────────────────────────────────────
  {
    rota: '/financeiro', grupo: 'Financeiro', titulo: 'Financeiro', icone: DollarSign,
    descricao: 'Saldo, contas, notas e apuração — o dinheiro do edital ao recebimento',
    acao: 'Novo lançamento', padrao: 'cartoes',
  },

  // ── Comunicação ───────────────────────────────────────────────────────
  {
    rota: '/whatsapp-crm', grupo: 'Comunicação', titulo: 'WhatsApp CRM', icone: MessageSquare,
    descricao: 'Conversas, funil e disparos com os contatos da sua operação',
    padrao: 'abas', abas: ['Caixa de entrada', 'Funil', 'Roteamento', 'Disparos', 'Modelos', 'Painel'],
  },

  // ── Ferramentas ───────────────────────────────────────────────────────
  {
    // A consultora tem nome próprio, e é assim que a equipe se refere a ela:
    // o h1 diz AURÉLIA (decisão do dono do produto em 13/09). O rótulo do
    // menu continua "Assistente IA", que é o que se procura quem ainda não a
    // conhece — título e rótulo divergem de propósito.
    rota: '/assistente', grupo: 'Ferramentas', titulo: 'AURÉLIA', icone: Bot,
    descricao: 'Pergunte sobre editais, contratos e regras — a consultora responde com o seu contexto',
    padrao: 'conversa',
  },
  {
    rota: '/api-integracao', grupo: 'Ferramentas', titulo: 'API e integração', icone: Plug,
    // "Chaves" só volta quando existir tela que emita e revogue chave de API:
    // hoje a autenticação é o JWT do próprio usuário, obtido no login.
    descricao: 'Token, endpoints e exemplos para conectar outros sistemas',
    padrao: 'cartoes',
  },
  {
    rota: '/tutorial', grupo: 'Ferramentas', titulo: 'Tutorial', icone: GraduationCap,
    descricao: 'O caminho de uso da plataforma, passo a passo',
    padrao: 'cartoes',
  },
  {
    rota: '/blog', grupo: 'Ferramentas', titulo: 'Blog', icone: BookOpen,
    descricao: 'Artigos sobre licitação, jurisprudência e prática de mercado',
    padrao: 'cartoes',
  },
  {
    rota: '/ebook', grupo: 'Ferramentas', titulo: 'E-books', icone: Download,
    descricao: 'Materiais para baixar e estudar offline',
    padrao: 'cartoes',
  },

  // ── Conta (menu do avatar) e telas que mudaram de grupo em 13/09 ──────
  {
    rota: '/empresas', grupo: 'Conta', titulo: 'Empresas', icone: Building2,
    descricao: 'As empresas que você opera e os certificados de cada uma',
    acao: 'Nova empresa', padrao: 'cartoes',
  },
  {
    rota: '/equipe', grupo: 'Conta', titulo: 'Equipe', icone: Users,
    descricao: 'Quem tem acesso, o que cada um faz e como é remunerado',
    acao: 'Convidar pessoa', padrao: 'abas', abas: ['Membros', 'Tarefas', 'Comissões', 'Relatório'],
  },
  {
    rota: '/configuracoes/alertas', grupo: 'Conta', titulo: 'Alertas de editais', icone: Bell,
    descricao: 'O que você quer ser avisado, por qual canal e com que antecedência',
    padrao: 'abas', abas: ['Segmentos', 'Empresa', 'Canais'],
  },
  {
    rota: '/definir-metas', grupo: 'Conta', titulo: 'Definir metas', icone: SlidersHorizontal,
    descricao: 'Alvo por pessoa e período, e as regras que medem o alcance',
    acao: 'Nova meta', padrao: 'formulario',
  },
  {
    rota: '/configuracoes', grupo: 'Conta', titulo: 'Configurações', icone: Settings,
    descricao: 'Dados da empresa, plano, regime tributário, timbrado e segurança',
    padrao: 'abas', abas: ['Geral', 'Plano', 'Regime', 'Timbrado', 'Segurança'],
  },
  {
    rota: '/suporte', grupo: 'Ferramentas', titulo: 'Suporte', icone: HeadphonesIcon,
    descricao: 'Fale com a equipe e acompanhe seus chamados',
    acao: 'Abrir chamado', padrao: 'abas', abas: ['Chat', 'Chamados'],
  },

  // ── Admin ─────────────────────────────────────────────────────────────
  {
    rota: '/admin/templates', grupo: 'Admin', titulo: 'Templates de IA', icone: ShieldCheck,
    descricao: 'Prompts e modelos que alimentam os geradores do produto',
    acao: 'Novo template', padrao: 'tabela',
  },
  {
    rota: '/admin/financeiro', grupo: 'Admin', titulo: 'Financeiro da plataforma', icone: DollarSign,
    descricao: 'Assinaturas dos clientes e os chamados ligados a cobrança',
    padrao: 'abas', abas: ['Assinaturas', 'Chamados'],
  },
  {
    rota: '/admin/fontes-fabricantes', grupo: 'Admin', titulo: 'Fontes e fabricantes', icone: Target,
    descricao: 'Catálogo de fontes de preço e fabricantes usados na precificação',
    acao: 'Nova fonte', padrao: 'tabela',
  },
  {
    rota: '/admin/marketing', grupo: 'Admin', titulo: 'Marketing', icone: TrendingUp,
    descricao: 'Origem dos cadastros, campanhas e distribuição geográfica',
    padrao: 'abas', abas: ['Evolução', 'Fontes', 'Campanhas', 'Geográfico', 'Leads'],
  },
  {
    rota: '/admin/distribuicao', grupo: 'Admin', titulo: 'Distribuição', icone: Send,
    descricao: 'O que o sistema enviou, para quem e com qual desfecho',
    padrao: 'tabela',
  },
  {
    rota: '/admin/auditoria', grupo: 'Admin', titulo: 'Auditoria', icone: ShieldCheck,
    descricao: 'Trilha de quem fez o quê, com exportação para conferência',
    acao: 'Exportar PDF', padrao: 'tabela',
  },
  {
    // A operação do robô que saiu da tela do cliente em 14/09/2026. Mesmo
    // ícone do módulo do cliente: é o mesmo robô, visto por quem o opera.
    rota: '/admin/robo-lances', grupo: 'Admin', titulo: 'Robô de Lances', icone: Crosshair,
    descricao: 'Agente, sessões, diagnóstico e avisos do robô, operados pela equipe Praefectus',
    padrao: 'abas',
    abas: ['Agente e infraestrutura', 'Sessões e tela remota', 'Diagnóstico', 'Avisos aos clientes', 'Auditoria e eventos'],
  },
  {
    rota: '/admin/metricas-saas', grupo: 'Admin', titulo: 'Métricas SaaS', icone: BarChart3,
    descricao: 'Assinantes, receita recorrente e retenção da plataforma',
    padrao: 'painel',
  },
];

const porRota = new Map(paginasPadrao.map((p) => [p.rota, p]));

/** A padronização da rota, quando existe. Rota fora do menu devolve undefined. */
export function padraoDaRota(rota: string): PaginaPadrao | undefined {
  return porRota.get(rota.split('?')[0]);
}

/** Trilha pronta para o CabecalhoPagina: grupo › tela. */
export function trilhaDaRota(rota: string): { rotulo: string; para?: string }[] {
  const p = padraoDaRota(rota);
  if (!p) return [];
  return [{ rotulo: 'Painel', para: '/dashboard' }, { rotulo: p.grupo }, { rotulo: p.titulo }];
}
