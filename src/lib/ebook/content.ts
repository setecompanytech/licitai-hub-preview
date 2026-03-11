export interface EbookSection {
  title: string;
  contextualizacao: string;
  fundamento: string;
  fluxos: string[];
  funcionalidades: string[];
  routeHint: string;
}

export const ebookSections: EbookSection[] = [
  {
    title: 'Visao Estrategica do Dashboard',
    contextualizacao:
      'O Dashboard da Praefectus consolida indicadores operacionais e financeiros em uma unica visao, reduzindo o tempo de analise e aumentando a capacidade de decisao das equipes de licitacao.',
    fundamento:
      'A centralizacao de dados melhora governanca, rastreabilidade e resposta a prazos criticos. O modulo organiza informacoes por status, modalidade e valor para apoiar planejamento tatico e executivo.',
    fluxos: [
      'Acessar o Dashboard no inicio do expediente.',
      'Aplicar filtros por periodo e modalidade.',
      'Priorizar cards com alerta de prazo e risco.',
      'Abrir licitacoes criticas diretamente pelos indicadores.',
    ],
    funcionalidades: [
      'Resumo de licitacoes ativas, ganhas e perdidas.',
      'Graficos comparativos por faixa de valor e modalidade.',
      'Alertas de vencimento com destaque visual.',
      'Visao consolidada da taxa de sucesso por periodo.',
    ],
    routeHint: '/dashboard',
  },
  {
    title: 'Monitoramento de Editais e Diarios',
    contextualizacao:
      'A LicitaIA monitora continuamente fontes publicas para identificar oportunidades compativeis com o perfil da empresa, reduzindo perda de editais relevantes.',
    fundamento:
      'A cobertura multiplataforma e o filtro por aderencia aumentam eficiencia comercial e reduzem esforco manual em buscas repetitivas.',
    fluxos: [
      'Configurar CNAE, estados, municipios e palavras-chave.',
      'Revisar novos editais classificados por relevancia.',
      'Marcar editais como lidos, favoritos ou arquivados.',
      'Encaminhar editais qualificados para o Kanban.',
    ],
    funcionalidades: [
      'Monitoramento continuo de portais federais, estaduais e municipais.',
      'Classificacao automatica por score de relevancia.',
      'Alertas de publicacao, retificacao e suspensao.',
      'Integracao com diarios oficiais para rastreio ampliado.',
    ],
    routeHint: '/monitoramento-editais',
  },
  {
    title: 'Chat do Pregao e Acompanhamento em Tempo Real',
    contextualizacao:
      'O modulo de chat permite leitura operacional do pregao em tempo real, incluindo eventos de lance, mensagens da comissao e movimentacao de concorrentes.',
    fundamento:
      'A visibilidade imediata de eventos criticos reduz tempo de resposta e melhora a estrategia de disputa durante a sessao publica.',
    fluxos: [
      'Selecionar o pregao ativo no painel.',
      'Acompanhar mensagens e eventos relevantes.',
      'Acionar equipe tecnica ao detectar risco ou questionamento.',
      'Registrar decisoes para historico de auditoria.',
    ],
    funcionalidades: [
      'Painel de chat em tempo real por pregao.',
      'Alerta de mencao ao CNPJ da empresa.',
      'Registro de eventos para pos-analise.',
      'Historico consultavel para melhoria continua.',
    ],
    routeHint: '/monitoramento-chat',
  },
  {
    title: 'Proposta Tecnica e Comercial Normatizada',
    contextualizacao:
      'A proposta tecnica e comercial na LicitaIA segue estrutura padronizada para manter conformidade documental, clareza juridica e fidelidade entre tela e arquivos exportados.',
    fundamento:
      'O fluxo respeita ABNT NBR 14724 e Lei 14.133/2021, com base em dados estruturados para garantir consistencia entre PDF, Word e Excel.',
    fluxos: [
      'Iniciar proposta a partir do edital selecionado.',
      'Preencher dados comerciais e enderecamento institucional.',
      'Validar planilha com 11 colunas obrigatorias.',
      'Aplicar declaracoes, dados de contratacao e assinatura digital.',
    ],
    funcionalidades: [
      'Sequencia documental: proposta, planilha, notas, declaracoes e assinatura.',
      'Planilha padrao com Item, Quantidade, Unidade, Descricao, Marca, Fabricante, Modelo, Valor Unitario, Valor Unitario por Extenso, Valor Total e Valor Total por Extenso.',
      'Extracao assistida por IA para preenchimento inicial.',
      'Exportacao sincronizada para PDF, Word e Excel.',
      'Selecao bancaria com destaque para BANPARA quando aplicavel.',
    ],
    routeHint: '/proposta-tecnica',
  },
  {
    title: 'Precificacao Inteligente e Composicao de Custos',
    contextualizacao:
      'O modulo de precificacao transforma memoria de calculo em processo rastreavel e repetivel, diminuindo erro humano e elevando competitividade.',
    fundamento:
      'A combinacao de referencias publicas, composicao de custos e regras fiscais permite propostas tecnicamente sustentaveis e comercialmente viaveis.',
    fluxos: [
      'Definir itens, unidades e quantidades da proposta.',
      'Consultar referencias de preco e custos logísticos.',
      'Calcular BDI e impactos tributarios.',
      'Consolidar composicao final e exportar memoria.',
    ],
    funcionalidades: [
      'Composicao de custo unitario assistida.',
      'Calculadoras fiscal e tributaria integradas.',
      'Consulta de preco publico para balizamento.',
      'Exportacao da composicao para revisao interna.',
    ],
    routeHint: '/precificacao',
  },
  {
    title: 'Apoio Juridico com IA e Base Normativa',
    contextualizacao:
      'Apoio juridico estruturado para impugnacoes, recursos e manifestacoes tecnicas com apoio de inteligencia artificial e base legal parametrizada.',
    fundamento:
      'A padronizacao reduz inconsistencias, acelera redacao e aumenta robustez argumentativa conforme legislacao e jurisprudencia aplicavel.',
    fluxos: [
      'Selecionar tipo de peca juridica.',
      'Anexar dados do edital e fatos relevantes.',
      'Gerar minuta inicial com fundamentacao.',
      'Revisar juridicamente e exportar documento final.',
    ],
    funcionalidades: [
      'Geracao de impugnacao e recurso administrativo.',
      'Suporte para contrarrazoes e pareceres.',
      'Apoio a pedidos de reequilibrio economico-financeiro.',
      'Upload de base juridica para contexto interno.',
    ],
    routeHint: '/apoio-juridico',
  },
  {
    title: 'Gestao de Documentos e Validades',
    contextualizacao:
      'A gestao documental centraliza arquivos obrigatorios da empresa para licitacoes, com foco em validade, disponibilidade e controle de versoes.',
    fundamento:
      'O repositorio unico reduz retrabalho, evita envio de documento vencido e acelera montagem de habilitacao e proposta.',
    fluxos: [
      'Cadastrar documentos por categoria.',
      'Associar arquivo a empresa e licitacao.',
      'Monitorar vencimentos pelo painel de alertas.',
      'Atualizar versao e manter historico de alteracoes.',
    ],
    funcionalidades: [
      'Repositorio central por tipo documental.',
      'Alertas de vencimento com antecedencia.',
      'Combinacao de arquivos para envio unificado.',
      'Rastreamento de atualizacao e responsavel.',
    ],
    routeHint: '/documentos',
  },
  {
    title: 'Kanban Operacional de Licitacoes',
    contextualizacao:
      'O Kanban organiza a execucao das licitacoes em etapas claras, promovendo responsabilidade, visibilidade e previsibilidade de entrega.',
    fundamento:
      'A gestao visual de fluxo reduz gargalos e facilita coordenacao entre times comercial, tecnico, juridico e financeiro.',
    fluxos: [
      'Criar card para cada oportunidade aprovada.',
      'Definir responsavel e data limite por etapa.',
      'Atualizar status conforme andamento real.',
      'Encerrar card com registro de resultado.',
    ],
    funcionalidades: [
      'Colunas personalizaveis por processo.',
      'Priorizacao por criticidade e prazo.',
      'Atribuicao de responsavel por atividade.',
      'Historico de movimentacao para auditoria.',
    ],
    routeHint: '/kanban',
  },
  {
    title: 'Robo de Lances com Regras Configuraveis',
    contextualizacao:
      'O robo de lances automatiza respostas em pregoes eletronicos conforme parametros definidos pelo usuario, preservando estrategia e limites de risco.',
    fundamento:
      'A automacao controlada melhora tempo de reacao em disputa e padroniza conduta operacional em sessoes de alta volatilidade.',
    fluxos: [
      'Configurar valor de referencia, piso e decremento.',
      'Definir intervalo entre lances e limite de rodadas.',
      'Executar simulacao antes da sessao real.',
      'Iniciar monitoramento e acompanhar historico.',
    ],
    funcionalidades: [
      'Lance automatico com regra de parada.',
      'Controle de segundos entre lances.',
      'Historico completo de tentativas e resultados.',
      'Modo manual para intervencao imediata.',
    ],
    routeHint: '/robo-lances',
  },
  {
    title: 'Governanca Multiempresa e Perfis de Acesso',
    contextualizacao:
      'A operacao multiempresa permite administrar diferentes CNPJs em uma unica plataforma, com segregacao de dados e papeis por membro.',
    fundamento:
      'O modelo de acesso por papel reforca seguranca, evita exposicao indevida de informacoes e melhora governanca corporativa.',
    fluxos: [
      'Cadastrar empresa e membros autorizados.',
      'Definir papeis de acesso por responsabilidade.',
      'Alternar empresa ativa conforme processo.',
      'Auditar alteracoes relevantes por usuario.',
    ],
    funcionalidades: [
      'Gerenciamento de multiplas empresas em conta unica.',
      'Papeis administrativos e operacionais separados.',
      'Isolamento de dados por empresa.',
      'Controle de certificados e configuracoes dedicadas.',
    ],
    routeHint: '/empresas',
  },
];
