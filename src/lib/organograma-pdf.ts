import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Funcionalidade {
  nome: string;
  descricao: string;
  passoAPasso: string[];
}

interface SubModulo {
  nome: string;
  funcionalidades: Funcionalidade[];
}

interface Modulo {
  grupo: string;
  subModulos: SubModulo[];
}

const SISTEMA: Modulo[] = [
  {
    grupo: '1. PAINEL',
    subModulos: [
      {
        nome: '1.1 Dashboard',
        funcionalidades: [
          {
            nome: 'KPIs Principais',
            descricao: 'Exibe 6 indicadores-chave em tempo real: Licitações Monitoradas, Propostas Enviadas, Taxa de Vitória (%), ROI Médio (%), Valor Ganho (R$) e Novas Hoje.',
            passoAPasso: [
              '1. Acesse o Dashboard pela barra lateral (ícone "Dashboard").',
              '2. Visualize os 6 cards de KPI na parte superior.',
              '3. Use o seletor de empresa no canto superior direito para filtrar por empresa ou "Todas as Empresas".',
            ],
          },
          {
            nome: 'KPIs de Detalhamento de Processos',
            descricao: 'Exibe 4 indicadores detalhados: Ganhas (com breakdown de Pregões e Dispensas), Perdidas, Em Andamento (com valor em disputa) e Pregões/Dispensas totais.',
            passoAPasso: [
              '1. Role para baixo dos KPIs principais.',
              '2. Visualize os 4 cards com detalhamento por tipo de processo.',
              '3. Clique em "Pregões/Dispensas" para navegar ao Analytics completo.',
            ],
          },
          {
            nome: 'Acesso Rápido aos Módulos',
            descricao: 'Grade com atalhos visuais para todos os módulos do sistema, permitindo navegação rápida.',
            passoAPasso: [
              '1. Localize a seção "Acesso Rápido" no Dashboard.',
              '2. Clique no card do módulo desejado para navegar diretamente.',
            ],
          },
          {
            nome: 'Painel de Processos Licitatórios',
            descricao: 'Lista os processos licitatórios cadastrados no sistema com status, valores e datas, permitindo gestão rápida.',
            passoAPasso: [
              '1. Role até a seção "Processos Licitatórios" no Dashboard.',
              '2. Visualize a tabela com número, órgão, objeto, valor e status.',
              '3. Clique em um processo para ver detalhes ou editar.',
            ],
          },
          {
            nome: 'Gráficos de Desempenho',
            descricao: 'Dois gráficos: Licitações por Mês (barras) e Valor por Período (área/linha), mostrando tendências temporais.',
            passoAPasso: [
              '1. Role até a seção de gráficos na parte inferior do Dashboard.',
              '2. Analise o gráfico de licitações mensais e o de valores.',
              '3. Os dados são atualizados automaticamente conforme a empresa selecionada.',
            ],
          },
          {
            nome: 'Relatório Gerencial PDF',
            descricao: 'Gera um relatório profissional em PDF com KPIs, desempenho financeiro e lista de processos.',
            passoAPasso: [
              '1. Clique no botão "Relatório PDF" no canto superior direito do Dashboard.',
              '2. O sistema compila os dados da empresa ativa.',
              '3. O PDF é gerado e baixado automaticamente.',
            ],
          },
          {
            nome: 'Seletor de Empresa',
            descricao: 'Permite alternar entre as empresas cadastradas ou selecionar "Todas as Empresas" para uma visão consolidada.',
            passoAPasso: [
              '1. Clique no seletor de empresa no canto superior direito.',
              '2. Escolha a empresa desejada ou "Todas as Empresas".',
              '3. Todos os dados do painel serão filtrados automaticamente.',
            ],
          },
          {
            nome: 'Onboarding Wizard',
            descricao: 'Assistente de configuração inicial que guia novos usuários nas primeiras etapas do sistema.',
            passoAPasso: [
              '1. No primeiro acesso, o wizard aparece automaticamente.',
              '2. Siga os passos indicados para configurar empresa, pesquisa e documentos.',
              '3. Pode ser fechado e não reaparecerá após conclusão.',
            ],
          },
        ],
      },
      {
        nome: '1.2 Analytics',
        funcionalidades: [
          {
            nome: 'KPIs Analíticos em Tempo Real',
            descricao: 'Cards com métricas avançadas: Total de processos, Ganhas, Perdidas, Em Andamento, Pregões Ganhos, Dispensas Ganhas e Valor em Disputa.',
            passoAPasso: [
              '1. Acesse Analytics pela barra lateral.',
              '2. Visualize os KPIs sincronizados em tempo real (indicador verde pulsante).',
              '3. Filtre por empresa usando o seletor.',
            ],
          },
          {
            nome: 'Gráfico de Modalidades',
            descricao: 'Gráfico de barras mostrando a distribuição de licitações por modalidade (Pregão, Concorrência, Dispensa, etc.).',
            passoAPasso: [
              '1. Role até o gráfico "Por Modalidade" na página Analytics.',
              '2. Passe o mouse sobre as barras para ver detalhes.',
            ],
          },
          {
            nome: 'Gráfico por Status',
            descricao: 'Gráfico pizza mostrando a distribuição por status (Monitorando, Em Disputa, Vencida, Perdida, etc.).',
            passoAPasso: [
              '1. Visualize o gráfico pizza de distribuição por status.',
              '2. Cada fatia mostra o percentual e quantidade.',
            ],
          },
          {
            nome: 'Gráfico por UF',
            descricao: 'Distribuição geográfica das licitações por Unidade Federativa.',
            passoAPasso: [
              '1. Visualize o gráfico de UFs no painel Analytics.',
              '2. Identifique as regiões com maior concentração de oportunidades.',
            ],
          },
          {
            nome: 'Timeline de Processos',
            descricao: 'Linha do tempo mostrando a evolução de processos ao longo dos meses.',
            passoAPasso: [
              '1. Analise o gráfico de timeline na parte inferior.',
              '2. Identifique tendências e sazonalidades.',
            ],
          },
        ],
      },
    ],
  },
  {
    grupo: '2. MONITORAMENTO',
    subModulos: [
      {
        nome: '2.1 Editais',
        funcionalidades: [
          {
            nome: 'Pesquisa Automática em Portais',
            descricao: 'Pesquisa simultânea em até 38 portais de compras públicas (PNCP, Compras.gov.br, BEC/SP, BLL, etc.), buscando editais compatíveis com o CNAE da empresa.',
            passoAPasso: [
              '1. Acesse "Editais" na barra lateral.',
              '2. Clique em "Pesquisar Portais" para iniciar a varredura.',
              '3. Acompanhe a barra de progresso durante a pesquisa.',
              '4. Os resultados são exibidos classificados por tipo.',
            ],
          },
          {
            nome: 'Filtro por Tipo de Documento',
            descricao: 'Filtros visuais por tipo: Edital, Aviso de Licitação, Cancelamento, Suspenso, Adiado, Aditivado, Adjudicado e Homologado.',
            passoAPasso: [
              '1. Observe os 8 cards de tipo na parte superior.',
              '2. Clique em um tipo para filtrar os resultados.',
              '3. Clique novamente para remover o filtro.',
            ],
          },
          {
            nome: 'Aba Licitações',
            descricao: 'Lista completa de licitações encontradas com busca inteligente, filtros avançados por portal/região/modalidade, score de viabilidade e ações de favoritar ou iniciar processo.',
            passoAPasso: [
              '1. Selecione a aba "Licitações".',
              '2. Use a busca inteligente para filtrar resultados.',
              '3. Clique em "Iniciar Processo" para mover ao Kanban.',
              '4. Use o ícone de estrela para favoritar.',
            ],
          },
          {
            nome: 'Aba Dispensa Eletrônica',
            descricao: 'Lista específica de dispensas eletrônicas com valores e prazos diferenciados.',
            passoAPasso: [
              '1. Selecione a aba "Dispensa Eletrônica".',
              '2. Visualize as dispensas disponíveis.',
              '3. Aplique filtros e inicie processos conforme necessário.',
            ],
          },
          {
            nome: 'Aba Diários Oficiais',
            descricao: 'Monitoramento de publicações em diários oficiais (DOU, DOE, DOM) relacionadas a licitações.',
            passoAPasso: [
              '1. Selecione a aba "Diários Oficiais".',
              '2. Configure os termos de busca.',
              '3. Visualize as publicações encontradas.',
            ],
          },
          {
            nome: 'Aba Portais Monitorados',
            descricao: 'Lista dos portais de compras ativos no sistema com status de conexão e última sincronização.',
            passoAPasso: [
              '1. Selecione a aba "Portais".',
              '2. Visualize os portais ativos e suas informações.',
            ],
          },
          {
            nome: 'Aba Configuração de Pesquisa',
            descricao: 'Configuração de palavras-chave, CNAEs, UFs de interesse e faixa de valores para personalizar a busca automática.',
            passoAPasso: [
              '1. Selecione a aba "Configuração de Pesquisa".',
              '2. Defina palavras-chave do seu segmento.',
              '3. Selecione as UFs de interesse.',
              '4. Configure valores mínimo e máximo.',
              '5. Salve as configurações.',
            ],
          },
        ],
      },
      {
        nome: '2.2 Boletins Diários',
        funcionalidades: [
          {
            nome: 'Recebimento de Boletins por E-mail',
            descricao: 'Configura o envio automático de boletins de licitações por e-mail em até 3 horários: manhã, meio-dia e tarde.',
            passoAPasso: [
              '1. Acesse "Boletins Diários" pela barra lateral.',
              '2. Na aba "Configurações", ative os horários desejados.',
              '3. Confirme o e-mail de recebimento.',
              '4. Salve as preferências.',
            ],
          },
          {
            nome: 'Histórico de Envios',
            descricao: 'Lista os boletins enviados recentemente com status (enviado, erro) e data.',
            passoAPasso: [
              '1. Na aba "Boletins", visualize o histórico de envios.',
              '2. Verifique o status de cada envio (sucesso ou erro).',
            ],
          },
        ],
      },
      {
        nome: '2.3 Chat e Mural',
        funcionalidades: [
          {
            nome: 'Chat do Pregão em Tempo Real',
            descricao: 'Chat integrado ao pregão eletrônico com mensagens categorizadas: Convocação, Mensagem do Pregoeiro, Alerta, Esclarecimento e outros.',
            passoAPasso: [
              '1. Acesse "Chat e Mural" pela barra lateral.',
              '2. Selecione a licitação desejada.',
              '3. Acompanhe as mensagens em tempo real.',
              '4. Use o filtro por tipo de mensagem.',
            ],
          },
          {
            nome: 'Alertas Sonoros',
            descricao: 'Sistema de alertas sonoros configuráveis para convocações, mensagens do pregoeiro e alertas urgentes.',
            passoAPasso: [
              '1. Ative/desative os alertas sonoros pelo ícone de som.',
              '2. Cada tipo de mensagem tem um som diferente (urgente, normal, alerta).',
            ],
          },
          {
            nome: 'Mural de Comunicados',
            descricao: 'Área de publicação de comunicados internos sobre licitações, decisões e resultados.',
            passoAPasso: [
              '1. Selecione a aba "Mural".',
              '2. Visualize os comunicados publicados.',
              '3. Publique novos comunicados clicando em "Nova Publicação".',
            ],
          },
        ],
      },
      {
        nome: '2.4 WhatsApp Setores',
        funcionalidades: [
          {
            nome: 'Configuração de Notificações por Setor',
            descricao: 'Distribui notificações via WhatsApp para setores específicos: Licitações, Jurídico, Financeiro e Documentação. Cada setor recebe apenas alertas relevantes.',
            passoAPasso: [
              '1. Acesse "WhatsApp Setores" pela barra lateral.',
              '2. Configure o número de WhatsApp para cada setor.',
              '3. Ative/desative notificações por setor usando os switches.',
              '4. Defina os tipos de alerta que cada setor deve receber.',
              '5. Clique em "Salvar Configurações".',
            ],
          },
        ],
      },
    ],
  },
  {
    grupo: '3. GESTÃO DE LICITAÇÕES',
    subModulos: [
      {
        nome: '3.1 Estratégicas',
        funcionalidades: [
          {
            nome: 'Score de Viabilidade com IA',
            descricao: 'Análise inteligente que pontua cada licitação em 4 eixos: Relevância, Viabilidade, Concorrência e Score Geral, gerando recomendação (Alta, Média, Baixa).',
            passoAPasso: [
              '1. Acesse "Estratégicas" pela barra lateral.',
              '2. Visualize as licitações ranqueadas por score geral.',
              '3. Analise os fatores positivos e de risco de cada uma.',
              '4. Use o filtro por UF para restringir a região.',
              '5. Salve licitações prioritárias clicando no ícone de favorito.',
            ],
          },
          {
            nome: 'Análise CAPAG',
            descricao: 'Consulta a Capacidade de Pagamento (CAPAG) de órgãos públicos para avaliar risco de inadimplência.',
            passoAPasso: [
              '1. Na página de Licitações Estratégicas, acesse a aba "CAPAG".',
              '2. Informe o órgão ou ente público.',
              '3. Visualize a nota CAPAG e os indicadores fiscais.',
            ],
          },
        ],
      },
      {
        nome: '3.2 Calendário',
        funcionalidades: [
          {
            nome: 'Calendário Visual de Licitações',
            descricao: 'Visualização em calendário mensal com datas de abertura, encerramento e validade de documentos.',
            passoAPasso: [
              '1. Acesse "Calendário" pela barra lateral.',
              '2. Navegue entre os meses usando as setas.',
              '3. Clique em uma data para ver os eventos daquele dia.',
              '4. Eventos são coloridos por tipo (abertura, encerramento, validade).',
            ],
          },
          {
            nome: 'Sincronização com Google Calendar',
            descricao: 'Exporta os eventos de licitações para o Google Calendar ou outros calendários via arquivo .ics.',
            passoAPasso: [
              '1. No calendário, clique em "Sincronizar".',
              '2. Escolha o formato de exportação.',
              '3. O arquivo .ics será gerado para importação no seu calendário.',
            ],
          },
        ],
      },
      {
        nome: '3.3 Kanban',
        funcionalidades: [
          {
            nome: 'Quadro Kanban de 8 Etapas',
            descricao: 'Gerencia o ciclo de vida dos processos licitatórios em 8 colunas: Monitorando, Analisando, Proposta, Em Disputa, Vencida, Homologada, Perdida e Arquivada.',
            passoAPasso: [
              '1. Acesse "Kanban" pela barra lateral.',
              '2. Visualize os cards organizados por etapa.',
              '3. Arraste os cards entre as colunas para mudar o status.',
              '4. Clique em um card para editar detalhes (número, órgão, valor, UF).',
              '5. Use o botão "+" para criar um novo processo manualmente.',
            ],
          },
          {
            nome: 'Edição Completa de Processos',
            descricao: 'Dialog de edição com campos: número, órgão, objeto, valor estimado (com máscara BRL), UF, município e data de encerramento.',
            passoAPasso: [
              '1. Clique no ícone de lápis em qualquer card.',
              '2. Edite os campos desejados.',
              '3. Clique em "Salvar" para persistir as alterações.',
              '4. Para excluir, clique em "Excluir" (confirmação obrigatória).',
            ],
          },
        ],
      },
      {
        nome: '3.4 Robô de Lances',
        funcionalidades: [
          {
            nome: 'Configuração de Disputas',
            descricao: 'Configura lances automáticos com parâmetros: decremento (%), valor mínimo (% do referência), intervalo entre lances (segundos) e máximo de lances.',
            passoAPasso: [
              '1. Acesse "Robô de Lances" pela barra lateral.',
              '2. Na aba "Disputar", adicione uma nova disputa.',
              '3. Informe o edital, portal, itens e valores de referência.',
              '4. Configure os parâmetros de lance (decremento, mínimo, intervalo).',
              '5. Clique em "Iniciar" para ativar o robô.',
            ],
          },
          {
            nome: 'Credenciais de Portais',
            descricao: 'Gerencia login e senha dos portais de compras, com suporte a certificado digital A1.',
            passoAPasso: [
              '1. Na aba "Credenciais", selecione o portal.',
              '2. Informe login e senha ou faça upload do certificado A1.',
              '3. Salve as credenciais (armazenadas com criptografia).',
            ],
          },
          {
            nome: 'Agente Externo',
            descricao: 'Integração com agentes de lances hospedados externamente (VPS/EC2) via webhooks para envio real de lances.',
            passoAPasso: [
              '1. Na aba "Agente Externo", configure a URL do agente.',
              '2. Baixe o template de agente Node.js.',
              '3. Hospede o agente em sua infraestrutura.',
              '4. Teste a conexão e configure a API key.',
            ],
          },
          {
            nome: 'Simulação de Disputa',
            descricao: 'Simula cenários de disputa para planejamento estratégico antes do pregão real.',
            passoAPasso: [
              '1. Na aba "Simulação", configure o cenário.',
              '2. Defina concorrentes fictícios e comportamentos.',
              '3. Execute a simulação e analise os resultados.',
            ],
          },
          {
            nome: 'Chat do Pregão Integrado',
            descricao: 'Visualização do mural/chat do pregão em andamento com mensagens em tempo real.',
            passoAPasso: [
              '1. Selecione uma disputa ativa.',
              '2. Na parte inferior, alterne para a aba "Mural".',
              '3. Acompanhe convocações e mensagens do pregoeiro.',
            ],
          },
          {
            nome: 'Exportar Resultados',
            descricao: 'Exporta os resultados das disputas em CSV, PDF ou JSON.',
            passoAPasso: [
              '1. Após encerrar uma disputa, clique em "Exportar".',
              '2. Escolha o formato (CSV, PDF ou JSON).',
              '3. O arquivo será gerado e baixado automaticamente.',
            ],
          },
        ],
      },
      {
        nome: '3.5 Histórico',
        funcionalidades: [
          {
            nome: 'Registro Completo de Licitações',
            descricao: 'Histórico de todas as licitações com status detalhado (Publicado, Em Disputa, Homologado, Contrato Assinado, Deserto, Fracassado, Revogado, Anulado).',
            passoAPasso: [
              '1. Acesse "Histórico" pela barra lateral.',
              '2. Use a barra de busca para filtrar por número, órgão ou objeto.',
              '3. Filtre por status usando o seletor.',
              '4. Clique em uma licitação para ver detalhes.',
              '5. Exporte dados em CSV, PDF ou JSON usando o botão "Exportar".',
            ],
          },
        ],
      },
      {
        nome: '3.6 Contratos',
        funcionalidades: [
          {
            nome: 'Gestão de Contratos',
            descricao: 'Cadastro e acompanhamento de contratos com campos: número, objeto, órgão, valor global, valor consumido, saldo remanescente, vigência e fiscal responsável.',
            passoAPasso: [
              '1. Acesse "Contratos" pela barra lateral.',
              '2. Clique em "Novo Contrato" para cadastrar.',
              '3. Preencha os dados do contrato (número, órgão, objeto, valores, datas).',
              '4. Informe os dados do fiscal (nome, e-mail, telefone).',
              '5. Salve o contrato.',
            ],
          },
          {
            nome: 'Monitoramento de Saldo e Vigência',
            descricao: 'Barra de progresso visual do consumo do contrato e alertas automáticos de vencimento.',
            passoAPasso: [
              '1. Na lista de contratos, observe a barra de progresso de cada um.',
              '2. Contratos com status "Vencendo" são destacados em amarelo.',
              '3. Filtre por status (Vigente, Vencendo, Encerrado, Suspenso).',
            ],
          },
          {
            nome: 'Aditivos Contratuais',
            descricao: 'Registro de aditivos com tipo, justificativa, valor e prazo adicional.',
            passoAPasso: [
              '1. Abra o contrato desejado.',
              '2. Clique em "Adicionar Aditivo".',
              '3. Preencha tipo, número, valor, prazo e justificativa.',
              '4. Salve o aditivo.',
            ],
          },
        ],
      },
    ],
  },
  {
    grupo: '4. INTELIGÊNCIA',
    subModulos: [
      {
        nome: '4.1 Análise de Mercado',
        funcionalidades: [
          {
            nome: 'KPIs de Mercado',
            descricao: 'Indicadores agregados: Licitações/mês, Volume financeiro, Órgãos contratando e Valor médio das contratações.',
            passoAPasso: [
              '1. Acesse "Análise de Mercado" pela barra lateral.',
              '2. Visualize os 4 KPIs na parte superior.',
            ],
          },
          {
            nome: 'Aba Transparência PA',
            descricao: 'Consulta de dados do Portal da Transparência do Pará com contratos e licitações estaduais.',
            passoAPasso: [
              '1. Selecione a aba "Transparência PA".',
              '2. Busque por órgão, objeto ou período.',
              '3. Visualize os resultados com valores e detalhes.',
            ],
          },
          {
            nome: 'Aba Contratos Gov',
            descricao: 'Consulta de contratos do Governo Federal com detalhes de valores, vigência e situação.',
            passoAPasso: [
              '1. Selecione a aba "Contratos Gov".',
              '2. Pesquise por órgão ou tipo de contrato.',
              '3. Exporte os resultados encontrados.',
            ],
          },
          {
            nome: 'Análise por Segmento',
            descricao: 'Gráfico de barras com volume de licitações e valores por segmento (Construção Civil, TI, Saúde, etc.).',
            passoAPasso: [
              '1. Selecione a aba "Por Segmento".',
              '2. Analise os segmentos com maior volume.',
            ],
          },
          {
            nome: 'Preços Praticados',
            descricao: 'Gráfico de evolução de preços médios, máximos e mínimos ao longo dos meses.',
            passoAPasso: [
              '1. Selecione a aba "Preços Praticados".',
              '2. Analise as tendências de preço.',
            ],
          },
          {
            nome: 'Produtos Mais Solicitados',
            descricao: 'Ranking dos itens mais solicitados em licitações com quantidade e valor médio.',
            passoAPasso: [
              '1. Selecione a aba "Mais Solicitados".',
              '2. Identifique os produtos de maior demanda.',
            ],
          },
        ],
      },
      {
        nome: '4.2 Concorrentes',
        funcionalidades: [
          {
            nome: 'Análise de Documentos de Concorrentes',
            descricao: 'Upload e análise de documentos de concorrentes (propostas, habilitação) com extração de dados via IA.',
            passoAPasso: [
              '1. Acesse "Concorrentes" e selecione a aba "Análise de Documentos".',
              '2. Faça upload do documento do concorrente.',
              '3. A IA extrai dados como CNPJ, valores, técnicas.',
              '4. Visualize a análise comparativa.',
            ],
          },
          {
            nome: 'Consulta CNPJ',
            descricao: 'Consulta dados de qualquer CNPJ na Receita Federal: razão social, CNAE, situação, endereço, capital social.',
            passoAPasso: [
              '1. Selecione a aba "Consulta CNPJ".',
              '2. Informe o CNPJ do concorrente.',
              '3. Clique em "Consultar".',
              '4. Visualize os dados cadastrais completos.',
            ],
          },
          {
            nome: 'Consulta SINTEGRA',
            descricao: 'Consulta Inscrição Estadual e situação cadastral no SINTEGRA por UF.',
            passoAPasso: [
              '1. Selecione a aba "SINTEGRA".',
              '2. Informe CNPJ e UF.',
              '3. Clique em "Consultar" para obter a IE.',
            ],
          },
          {
            nome: 'Certidões Negativas',
            descricao: 'Links diretos para emissão de certidões negativas (CND Federal, FGTS, CNDT, etc.) do concorrente.',
            passoAPasso: [
              '1. Selecione a aba "Certidões Negativas".',
              '2. Clique no link do tipo de certidão desejada.',
              '3. Você será redirecionado ao portal oficial.',
            ],
          },
        ],
      },
      {
        nome: '4.3 Precificação',
        funcionalidades: [
          {
            nome: 'Pesquisa de Preços Unificada',
            descricao: 'Motor de busca que pesquisa preços em Mercado Livre, Google Shopping e fontes oficiais. Três modos: Pesquisa Simples, Especificação Técnica e Cotação por Edital.',
            passoAPasso: [
              '1. Acesse "Precificação" pela barra lateral.',
              '2. Escolha o modo de pesquisa (Simples, Especificação ou Edital).',
              '3. Informe o termo ou faça upload do documento.',
              '4. Visualize os resultados com imagens, preços e lojas.',
              '5. Clique em "Adicionar ao Carrinho" para usar na proposta.',
            ],
          },
          {
            nome: 'Catálogo de Itens Precificados',
            descricao: 'Repositório de itens já precificados com imagens, marca, modelo e preço calculado, salvos para reuso em propostas futuras.',
            passoAPasso: [
              '1. Na aba "Catálogo", visualize os itens salvos.',
              '2. Busque por descrição ou filtro.',
              '3. Clique em um item para ver detalhes ou editar.',
              '4. Use "Importar para Proposta" para adicionar ao carrinho.',
            ],
          },
          {
            nome: 'Calculadora Unificada (BDI / Engenharia / Mão de Obra)',
            descricao: 'Calculadora que distingue automaticamente entre Fornecimento de Produtos (BDI), Serviços de Engenharia (BDI + encargos TCU 2622/2013) e Mão de Obra Contínua (IN SEGES/ME nº 5/2017).',
            passoAPasso: [
              '1. Na aba "Calculadora", o tipo é sugerido pelo CNAE da empresa.',
              '2. Informe os custos unitários, quantidades e margens.',
              '3. Os tributos são aplicados automaticamente conforme regime tributário e UF.',
              '4. Visualize a composição detalhada de custos.',
              '5. Exporte em XLSX (8 abas), Word ou PDF.',
            ],
          },
          {
            nome: 'Painel de Preços Gov',
            descricao: 'Consulta ao Painel de Preços do Governo Federal para referências oficiais de preços praticados.',
            passoAPasso: [
              '1. Na aba "Painel Gov", informe o item.',
              '2. Visualize os preços de referência oficiais.',
            ],
          },
          {
            nome: 'Cotações de Fornecedores',
            descricao: 'Upload e gestão de cotações recebidas de fornecedores com comparativo automático.',
            passoAPasso: [
              '1. Na aba "Cotações", clique em "Nova Cotação".',
              '2. Faça upload do arquivo de cotação.',
              '3. Preencha fornecedor, CNPJ e validade.',
              '4. O sistema organiza os itens para comparativo.',
            ],
          },
          {
            nome: 'Comparativo de Preços',
            descricao: 'Dashboard comparativo com média, mediana, mínimo e máximo entre todas as fontes de preço.',
            passoAPasso: [
              '1. Na aba "Comparativo", visualize o dashboard.',
              '2. Analise os preços por fonte (Mercado, Gov, Fornecedores).',
            ],
          },
          {
            nome: 'Inteligência de Preços com IA',
            descricao: 'Análise inteligente de preços com alertas de inexequibilidade e sugestões de margem.',
            passoAPasso: [
              '1. Na aba "Inteligência", a IA analisa os preços coletados.',
              '2. Receba alertas de preços fora da faixa.',
              '3. Visualize sugestões de margem e BDI.',
            ],
          },
          {
            nome: 'Fontes e Fabricantes',
            descricao: 'Gestão de fontes de preços e fabricantes cadastrados para rastreabilidade.',
            passoAPasso: [
              '1. Na aba "Fontes", visualize as fontes cadastradas.',
              '2. Adicione novas fontes com URL, categoria e palavras-chave.',
            ],
          },
          {
            nome: 'Listas de Compras',
            descricao: 'Organização de itens em listas temáticas para facilitar a gestão de cotações.',
            passoAPasso: [
              '1. Na aba "Listas", crie uma nova lista.',
              '2. Adicione itens da pesquisa ou catálogo.',
              '3. Exporte a lista para cotação com fornecedores.',
            ],
          },
          {
            nome: 'Importações (Planilha)',
            descricao: 'Importação de itens via planilha Excel usando o modelo padronizado do sistema.',
            passoAPasso: [
              '1. Na aba "Importações", baixe o modelo de planilha.',
              '2. Preencha os dados no Excel.',
              '3. Faça upload da planilha preenchida.',
              '4. O sistema valida e importa os itens automaticamente.',
            ],
          },
        ],
      },
      {
        nome: '4.4 Proposta Comercial',
        funcionalidades: [
          {
            nome: 'Fluxo de 8 Etapas Normatizado (ABNT/Lei 14.133)',
            descricao: 'Elaboração guiada em 8 passos: Edital, Empresa, Representante, Licitação, Planilha, Declarações, Formatação e Geração.',
            passoAPasso: [
              '1. Acesse "Proposta Comercial" pela barra lateral.',
              '2. Siga o stepper na parte superior.',
              '3. Etapa 1 — Edital: Faça upload do edital para extração automática via IA.',
              '4. Etapa 2 — Empresa: Dados são pré-preenchidos da empresa ativa.',
              '5. Etapa 3 — Representante: Dados do representante legal.',
              '6. Etapa 4 — Licitação: Dados do processo (órgão, número, prazos).',
              '7. Etapa 5 — Planilha: Preencha os 11 campos obrigatórios de cada item.',
              '8. Etapa 6 — Declarações: Selecione as declarações obrigatórias (8 modelos).',
              '9. Etapa 7 — Formatação: Configure marca d\'água, timbrado e layout.',
              '10. Etapa 8 — Gerar: Gere a proposta final com IA.',
            ],
          },
          {
            nome: 'Extração Automática de Edital via IA',
            descricao: 'Upload de edital (PDF, Word) com extração automática de: Órgão, número, objeto, itens, prazos de pagamento e entrega.',
            passoAPasso: [
              '1. Na etapa 1, clique em "Upload do Edital".',
              '2. Selecione o arquivo (PDF ou DOCX).',
              '3. A IA extrai os dados automaticamente.',
              '4. Revise e corrija os dados extraídos.',
            ],
          },
          {
            nome: 'Planilha de Preços (11 colunas)',
            descricao: 'Planilha com 11 colunas obrigatórias: Item, Qtd, Unid, Descrição, Marca, Fabricante, Modelo, Vlr Unitário, Vlr Unitário Extenso, Vlr Total, Vlr Total Extenso.',
            passoAPasso: [
              '1. Na etapa 5, adicione itens manualmente ou importe.',
              '2. Importe do Catálogo, do Carrinho de Itens ou via Excel.',
              '3. Os valores em extenso são gerados automaticamente.',
              '4. Edite qualquer campo diretamente na planilha.',
            ],
          },
          {
            nome: 'Papel Timbrado / Marca d\'Água',
            descricao: 'Upload de cabeçalho e rodapé (PNG, JPG, PDF, DOCX) com preenchimento total da largura. Configuração de margens, orientação e escala.',
            passoAPasso: [
              '1. Na etapa 7 ou em Configurações, acesse "Papel Timbrado".',
              '2. Faça upload da imagem de cabeçalho.',
              '3. Faça upload da imagem de rodapé.',
              '4. Configure margens (mm), orientação e escala.',
              '5. Visualize a prévia de impressão em formato A4.',
            ],
          },
          {
            nome: 'Exportação em PDF, Word e Excel',
            descricao: 'Gera a proposta final nos formatos PDF, Word e Excel, com opções de layout Retrato e Paisagem.',
            passoAPasso: [
              '1. Na etapa 8, após gerar o texto da proposta.',
              '2. Clique em "Baixar PDF", "Baixar Word" ou "Baixar Excel".',
              '3. Escolha a orientação (Retrato ou Paisagem).',
              '4. O documento é gerado com timbrado, declarações e formatação ABNT.',
            ],
          },
          {
            nome: 'Visualização em Tempo Real (Live Preview)',
            descricao: 'Painel lateral com prévia do documento sendo montado, atualizado em tempo real conforme o preenchimento.',
            passoAPasso: [
              '1. Clique no ícone de painel lateral para abrir o Live Preview.',
              '2. Conforme preenche cada etapa, a prévia é atualizada.',
              '3. Feche o painel quando não precisar mais.',
            ],
          },
        ],
      },
    ],
  },
  {
    grupo: '5. JURÍDICO & DOCS',
    subModulos: [
      {
        nome: '5.1 Documentos',
        funcionalidades: [
          {
            nome: 'Checklist de Habilitação (Lei 14.133/2021)',
            descricao: 'Lista de documentos obrigatórios por categoria (Habilitação Jurídica, Regularidade Fiscal, Qualificação Técnica, etc.) com status e validade.',
            passoAPasso: [
              '1. Acesse "Documentos" pela barra lateral.',
              '2. Visualize os documentos organizados por categoria.',
              '3. O status é exibido por cores: verde (ok), amarelo (pendente), vermelho (vencido).',
              '4. Clique em "Upload" para anexar um documento.',
            ],
          },
          {
            nome: 'Upload e Gestão de Documentos',
            descricao: 'Upload de documentos com controle de validade, tipo e nome. Suporta PDF, imagens e documentos Office.',
            passoAPasso: [
              '1. Clique em "Upload" no documento desejado.',
              '2. Selecione o arquivo.',
              '3. Defina a data de validade (se aplicável).',
              '4. O sistema armazena e monitora a validade.',
            ],
          },
          {
            nome: 'Alertas de Vencimento',
            descricao: 'Alertas automáticos para documentos próximos do vencimento (30, 15 e 7 dias antes).',
            passoAPasso: [
              '1. Na aba "Alertas", visualize os documentos vencendo.',
              '2. Clique no alerta para acessar o documento.',
              '3. Renove o documento fazendo um novo upload.',
            ],
          },
          {
            nome: 'Merge de Documentos',
            descricao: 'Unifica múltiplos PDFs em um único arquivo para envio consolidado ao portal de compras.',
            passoAPasso: [
              '1. Na aba "Merge", selecione os documentos.',
              '2. Arraste para definir a ordem.',
              '3. Clique em "Gerar PDF Unificado".',
              '4. O arquivo consolidado é baixado automaticamente.',
            ],
          },
          {
            nome: 'Checklist por Modalidade',
            descricao: 'Lista de verificação personalizada conforme a modalidade da licitação (Pregão, Concorrência, RDC, etc.).',
            passoAPasso: [
              '1. Na aba "Checklist", selecione a modalidade.',
              '2. Visualize os documentos exigidos para aquela modalidade.',
              '3. Marque os itens já providenciados.',
            ],
          },
        ],
      },
      {
        nome: '5.2 Assessoria Cadastral',
        funcionalidades: [
          {
            nome: 'Gestão de Cadastros em Portais',
            descricao: 'Acompanhamento do status de cadastro em 6+ portais: SICAF, CAUFESP, SIGA/PA, CRC Municipal, CEIS e Portal de Compras Públicas.',
            passoAPasso: [
              '1. Acesse "Assessoria Cadastral" pela barra lateral.',
              '2. Visualize cada portal com status (Ativo, Pendente, Expirado, Não Cadastrado).',
              '3. Veja o progresso de cadastro (%) e documentos pendentes.',
              '4. Clique no link externo para acessar o portal.',
            ],
          },
          {
            nome: 'Documentos Necessários por Portal',
            descricao: 'Lista os documentos exigidos por cada portal com status de situação.',
            passoAPasso: [
              '1. Na aba "Documentos", visualize a lista por portal.',
              '2. Verifique o status de cada documento (OK, Pendente, A Vencer).',
            ],
          },
        ],
      },
      {
        nome: '5.3 Apoio Jurídico',
        funcionalidades: [
          {
            nome: 'Aba Modelos e Templates (24 tipos)',
            descricao: 'Geração de 24 tipos de documentos jurídicos: Esclarecimentos, Impugnações, Recursos (Administrativo, Contrarrazões, Reconsideração, Hierárquico), Reequilíbrio (Reajuste, Repactuação, Revisão), Planilhas de Custos, Declarações (ME/EPP, Idoneidade, Nepotismo, Elaboração Independente, Anticorrupção, Acessibilidade), Peças de Defesa e Gestão Contratual.',
            passoAPasso: [
              '1. Acesse "Apoio Jurídico" e selecione a aba "Modelos e Templates".',
              '2. Busque o modelo desejado ou navegue por categoria.',
              '3. Clique em "Gerar com IA" para personalizar.',
              '4. Informe os dados do caso (licitação, partes, fatos).',
              '5. A IA gera o documento fundamentado na legislação vigente.',
              '6. Revise e exporte em PDF ou Word.',
            ],
          },
          {
            nome: 'Aba Gerador IA (com Base Jurídica)',
            descricao: 'Gerador independente que permite upload de documentos (editais, decisões, recursos) e gera peças processuais fundamentadas com IA.',
            passoAPasso: [
              '1. Selecione a aba "Gerador IA".',
              '2. Faça upload dos documentos de referência.',
              '3. Descreva o que precisa (ex: "Impugnação por restrição à competitividade").',
              '4. A IA analisa os documentos e gera a peça jurídica.',
            ],
          },
          {
            nome: 'Aba Reequilíbrio Econômico-Financeiro',
            descricao: 'Gestão de índices econômicos e convenções coletivas para pedidos de reequilíbrio contratual.',
            passoAPasso: [
              '1. Selecione a aba "Reequilíbrio".',
              '2. Informe o contrato, valor original e índice aplicável.',
              '3. O sistema calcula o valor reajustado.',
              '4. Gere o parecer jurídico automaticamente.',
            ],
          },
          {
            nome: 'Aba Base Jurídica (RAG)',
            descricao: 'Upload de jurisprudências, acórdãos e pareceres próprios para enriquecer as respostas da IA com documentos do usuário.',
            passoAPasso: [
              '1. Selecione a aba "Base Jurídica".',
              '2. Faça upload de PDFs de jurisprudências.',
              '3. Preencha metadados (tribunal, número, tags).',
              '4. Os documentos são indexados para uso pelo Gerador IA.',
            ],
          },
          {
            nome: 'Aba Legislação',
            descricao: 'Referência rápida às principais leis e normas: Lei 14.133/2021, LC 123/2006, Decreto 11.462/2023, IN SEGES 73/2022, Lei Anticorrupção e CF/88.',
            passoAPasso: [
              '1. Selecione a aba "Legislação".',
              '2. Visualize a lista de leis com descrição.',
              '3. Clique no link externo para acessar o texto integral.',
            ],
          },
        ],
      },
      {
        nome: '5.4 Apoio Contábil',
        funcionalidades: [
          {
            nome: 'Aba Modelos e Templates (10 tipos)',
            descricao: 'Modelos contábeis: Composição de Custos, Cálculo de BDI, Análise de Inexequibilidade, Parecer de Viabilidade, Demonstrativo de Encargos, Parecer de Reequilíbrio, Qualificação Econômico-Financeira, Memorial Tributário, Checklist de Certidões e Fluxo de Caixa.',
            passoAPasso: [
              '1. Acesse "Apoio Contábil" e selecione a aba "Modelos e Templates".',
              '2. Busque ou navegue pelos modelos por categoria.',
              '3. Clique em "Baixar" para obter o template.',
              '4. Clique em "Gerar com IA" para personalizar.',
            ],
          },
          {
            nome: 'Aba Análise de Balanço IA',
            descricao: 'Upload de balanço patrimonial com análise automática de índices contábeis (liquidez, endividamento, lucratividade) para habilitação.',
            passoAPasso: [
              '1. Selecione a aba "Análise de Balanço IA".',
              '2. Faça upload do balanço patrimonial.',
              '3. A IA calcula os índices e verifica conformidade.',
              '4. Visualize o parecer com os índices calculados.',
            ],
          },
          {
            nome: 'Aba Gerador IA Contábil',
            descricao: 'Geração de documentos contábeis personalizados com fundamentação em NBC, CFC e Lei 14.133/2021.',
            passoAPasso: [
              '1. Selecione a aba "Gerador IA".',
              '2. Descreva o documento contábil necessário.',
              '3. A IA gera com fundamentação normativa.',
            ],
          },
          {
            nome: 'Aba Legislação Contábil',
            descricao: 'Referências a normas contábeis aplicáveis a licitações.',
            passoAPasso: [
              '1. Selecione a aba "Legislação Contábil".',
              '2. Consulte as normas por categoria.',
            ],
          },
          {
            nome: 'Aba Base Contábil IA',
            descricao: 'Upload de documentos contábeis próprios para enriquecer as respostas da IA.',
            passoAPasso: [
              '1. Selecione a aba "Base Contábil IA".',
              '2. Faça upload de documentos contábeis.',
              '3. Preencha os metadados.',
            ],
          },
        ],
      },
      {
        nome: '5.5 Índices & Repactuação',
        funcionalidades: [
          {
            nome: 'Aba Índices Econômicos',
            descricao: 'Consulta em tempo real de índices: IPCA, INPC, IGP-M, INCC, CUB, SINAPI, Salário Mínimo, SELIC e CDI, com variação mensal, anual e acumulado 12 meses.',
            passoAPasso: [
              '1. Acesse "Índices & Repactuação" pela barra lateral.',
              '2. Na aba "Índices", visualize os índices atualizados.',
              '3. Filtre por categoria (Inflação, Construção, Salário, Juros).',
              '4. Clique em "Atualizar" para buscar dados mais recentes.',
            ],
          },
          {
            nome: 'Aba Convenções Coletivas (CCTs)',
            descricao: 'Cadastro de convenções coletivas de trabalho com pisos salariais, reajustes e vigência.',
            passoAPasso: [
              '1. Selecione a aba "Convenções Coletivas".',
              '2. Clique em "Nova CCT" para cadastrar.',
              '3. Informe categoria profissional, sindicato, piso salarial e reajuste.',
              '4. Defina a vigência e abrangência territorial.',
            ],
          },
          {
            nome: 'Aba Simulador de Reajuste',
            descricao: 'Calcula o valor reajustado de um contrato com base no índice selecionado, período e valor original.',
            passoAPasso: [
              '1. Selecione a aba "Simulador".',
              '2. Informe o valor original do contrato.',
              '3. Selecione o índice de reajuste (IPCA, IGP-M, etc.).',
              '4. Defina o período (mês/ano início e fim).',
              '5. Clique em "Calcular".',
              '6. Visualize o valor reajustado, diferença e fundamentação.',
            ],
          },
          {
            nome: 'Aba Parecer IA',
            descricao: 'Geração automática de parecer técnico de reequilíbrio com fundamentação legal e cálculos.',
            passoAPasso: [
              '1. Selecione a aba "Parecer IA".',
              '2. Informe os dados do contrato e reajuste.',
              '3. A IA gera o parecer fundamentado.',
              '4. Exporte em PDF ou Word.',
            ],
          },
        ],
      },
    ],
  },
  {
    grupo: '6. FERRAMENTAS',
    subModulos: [
      {
        nome: '6.1 Assistente IA',
        funcionalidades: [
          {
            nome: 'Chat com IA Especializada em Licitações',
            descricao: 'Assistente conversacional com conhecimento especializado em licitações, Lei 14.133/2021, cálculo de BDI e elaboração de documentos jurídicos.',
            passoAPasso: [
              '1. Acesse "Assistente IA" pela barra lateral.',
              '2. Digite sua pergunta ou use uma das sugestões rápidas.',
              '3. O assistente responde com referências legais.',
              '4. Continue a conversa para aprofundar o tema.',
            ],
          },
          {
            nome: 'Sugestões Rápidas',
            descricao: 'Perguntas pré-definidas para orientação: requisitos de habilitação, critérios de julgamento, cálculo de BDI e modelos de impugnação.',
            passoAPasso: [
              '1. Na tela do Assistente, visualize as 4 sugestões.',
              '2. Clique em uma sugestão para iniciar a conversa.',
            ],
          },
        ],
      },
      {
        nome: '6.2 Tutorial / Guia',
        funcionalidades: [
          {
            nome: 'Guia Passo a Passo do Sistema',
            descricao: 'Tutorial visual com 8+ etapas guiando o usuário desde a configuração inicial até o acompanhamento de resultados.',
            passoAPasso: [
              '1. Acesse "Tutorial / Guia" pela barra lateral.',
              '2. Siga os passos numerados na ordem sugerida.',
              '3. Cada passo tem botão de navegação direta ao módulo.',
              '4. Dicas práticas são exibidas em cada etapa.',
            ],
          },
        ],
      },
      {
        nome: '6.3 Blog',
        funcionalidades: [
          {
            nome: 'Artigos Especializados',
            descricao: 'Blog com artigos sobre licitações categorizados em: Clima & Alimentos, Força Maior, Jurisprudência, Como Licitar, entre outros.',
            passoAPasso: [
              '1. Acesse "Blog" pela barra lateral.',
              '2. Navegue pelos artigos ou filtre por categoria.',
              '3. Use a busca para encontrar temas específicos.',
              '4. Clique em um artigo para ler o conteúdo completo.',
              '5. Artigos em destaque são identificados com badge.',
            ],
          },
        ],
      },
      {
        nome: '6.4 E-book',
        funcionalidades: [
          {
            nome: 'E-book ABNT do Sistema',
            descricao: 'Geração de e-book profissional em PDF com 10 capítulos cobrindo todas as funcionalidades do sistema, formatado conforme ABNT.',
            passoAPasso: [
              '1. Acesse "E-book" pela barra lateral.',
              '2. Visualize o sumário com os 10 capítulos.',
              '3. Clique em "Gerar E-book" para criar o PDF.',
              '4. O download inicia automaticamente.',
            ],
          },
        ],
      },
    ],
  },
  {
    grupo: '7. CONFIGURAÇÃO',
    subModulos: [
      {
        nome: '7.1 Empresas',
        funcionalidades: [
          {
            nome: 'Cadastro de Empresas (Multiempresa)',
            descricao: 'Cadastro de múltiplas empresas com consulta automática de CNPJ na Receita Federal e SINTEGRA. Preenche automaticamente razão social, CNAE, endereço, IE e e-mail.',
            passoAPasso: [
              '1. Acesse "Empresas" pela barra lateral.',
              '2. Clique em "Nova Empresa".',
              '3. Informe o CNPJ (somente números).',
              '4. Clique em "Consultar CNPJ" — os dados são preenchidos automaticamente via Receita Federal.',
              '5. Revise e complete os dados (representante legal, certificado digital).',
              '6. Clique em "Cadastrar Empresa".',
            ],
          },
          {
            nome: 'Edição de Empresa',
            descricao: 'Edição completa dos dados cadastrais, representante legal e certificado digital.',
            passoAPasso: [
              '1. Na lista de empresas, clique no ícone de lápis.',
              '2. Edite os campos desejados.',
              '3. Salve as alterações.',
            ],
          },
          {
            nome: 'Exclusão de Empresa',
            descricao: 'Remoção de empresa com confirmação obrigatória.',
            passoAPasso: [
              '1. Na lista de empresas, clique no ícone de lixeira.',
              '2. Confirme a exclusão no diálogo.',
            ],
          },
          {
            nome: 'Certificado Digital (e-CNPJ / A1)',
            descricao: 'Upload de certificado digital A1 para assinatura de propostas e autenticação em portais.',
            passoAPasso: [
              '1. No cadastro da empresa, acesse a seção "Certificado Digital".',
              '2. Faça upload do certificado A1 (.pfx).',
              '3. O sistema armazena com segurança.',
            ],
          },
        ],
      },
      {
        nome: '7.2 Configurações',
        funcionalidades: [
          {
            nome: 'Dados Cadastrais da Empresa Ativa',
            descricao: 'Edição dos dados da empresa ativa: CNPJ (com consulta automática), razão social, CNAE, endereço completo, e-mail, telefone, IE e IM.',
            passoAPasso: [
              '1. Acesse "Configurações" pela barra lateral.',
              '2. Os dados da empresa ativa são carregados automaticamente.',
              '3. Edite os campos necessários.',
              '4. Use "Consultar CNPJ" para atualizar dados da Receita.',
              '5. Clique em "Salvar Configurações".',
            ],
          },
          {
            nome: 'Dados do Representante Legal',
            descricao: 'Cadastro do representante legal com extração via upload de documento (IA extrai CPF, RG, cargo).',
            passoAPasso: [
              '1. Na seção "Representante", preencha manualmente ou faça upload de documento.',
              '2. A IA extrai automaticamente nome, CPF, RG e cargo.',
              '3. Revise os dados extraídos.',
              '4. Salve.',
            ],
          },
          {
            nome: 'CNAEs Secundários',
            descricao: 'Cadastro de CNAEs secundários para ampliar o escopo do monitoramento de editais.',
            passoAPasso: [
              '1. Na seção "CNAEs Secundários", adicione os códigos.',
              '2. Os CNAEs serão usados para filtrar licitações compatíveis.',
            ],
          },
          {
            nome: 'Papel Timbrado / Marca d\'Água',
            descricao: 'Upload de cabeçalho e rodapé com preenchimento full bleed. Configuração de margens (mm), orientação (Retrato/Paisagem) e escala com prévia A4 em tempo real.',
            passoAPasso: [
              '1. Na seção "Papel Timbrado", faça upload do cabeçalho.',
              '2. Faça upload do rodapé.',
              '3. Clique em "Configurar Página" para ajustar margens e orientação.',
              '4. Visualize a prévia de impressão A4.',
              '5. Use os botões "Ver", "Trocar" e "Excluir" abaixo de cada arquivo.',
            ],
          },
          {
            nome: 'Plano de Assinatura',
            descricao: 'Visualização do plano atual e gestão da assinatura.',
            passoAPasso: [
              '1. Na seção "Plano", visualize seu plano ativo.',
              '2. Veja a data de início e fim da assinatura.',
            ],
          },
        ],
      },
      {
        nome: '7.3 Suporte',
        funcionalidades: [
          {
            nome: 'Sistema de Tickets',
            descricao: 'Abertura e acompanhamento de tickets de suporte com categorias (Geral, Bug, Funcionalidade, Cobrança) e prioridades.',
            passoAPasso: [
              '1. Acesse "Suporte" pela barra lateral.',
              '2. Clique em "Novo Ticket".',
              '3. Preencha assunto, categoria, prioridade e descrição.',
              '4. Envie o ticket.',
              '5. Acompanhe o status (Aberto, Em Andamento, Resolvido).',
            ],
          },
          {
            nome: 'Chat com Suporte IA',
            descricao: 'Chat integrado com IA para resolução rápida de dúvidas comuns.',
            passoAPasso: [
              '1. Na aba "Chat", digite sua dúvida.',
              '2. O assistente responde instantaneamente.',
              '3. Se não resolver, abra um ticket formal.',
            ],
          },
        ],
      },
    ],
  },
];

export function generateOrganogramaPDF() {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginL = 15;
  const marginR = 15;
  const contentW = pageW - marginL - marginR;
  let y = 0;

  const addHeader = () => {
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, pageW, 28, 'F');
    doc.setFillColor(250, 204, 21); // accent yellow
    doc.rect(0, 28, pageW, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('PRAEFECTUS — Organograma do Sistema', marginL, 14);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Manual Completo de Funcionalidades e Passo a Passo', marginL, 22);
    const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    doc.text(today, pageW - marginR, 22, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  };

  const addFooter = (pageNum: number) => {
    doc.setFillColor(241, 245, 249); // slate-100
    doc.rect(0, pageH - 12, pageW, 12, 'F');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('PRAEFECTUS — Sistema de Gestão de Licitações Públicas', marginL, pageH - 5);
    doc.text(`Página ${pageNum}`, pageW - marginR, pageH - 5, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  };

  const checkPage = (needed: number) => {
    if (y + needed > pageH - 18) {
      addFooter(doc.getNumberOfPages());
      doc.addPage();
      addHeader();
      y = 36;
    }
  };

  // ── Cover page ──
  addHeader();
  y = 50;

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(marginL, y, contentW, 55, 3, 3, 'F');
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Organograma Completo', pageW / 2, y + 18, { align: 'center' });
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Todas as funcionalidades do sistema Praefectus', pageW / 2, y + 28, { align: 'center' });
  doc.text('com descrição detalhada e instruções passo a passo.', pageW / 2, y + 35, { align: 'center' });
  doc.setFontSize(9);
  doc.text('Do PAINEL à CONFIGURAÇÃO — 7 grupos · 30+ submódulos · 90+ funcionalidades', pageW / 2, y + 47, { align: 'center' });
  y += 65;

  // ── Organogram chart ──
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Estrutura Hierárquica do Sistema', marginL, y);
  y += 8;

  // Draw org chart boxes
  const boxH = 10;
  const groupColors: [number, number, number][] = [
    [59, 130, 246],   // blue
    [16, 185, 129],   // emerald
    [249, 115, 22],   // orange
    [139, 92, 246],   // violet
    [236, 72, 153],   // pink
    [20, 184, 166],   // teal
    [107, 114, 128],  // gray
  ];

  // Root box
  doc.setFillColor(15, 23, 42);
  const rootW = 60;
  doc.roundedRect((pageW - rootW) / 2, y, rootW, boxH, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Praefectus', pageW / 2, y + 6.5, { align: 'center' });
  y += boxH + 4;

  // Group boxes
  const groupW = (contentW - 6 * 3) / 7;
  SISTEMA.forEach((mod, i) => {
    const x = marginL + i * (groupW + 3);
    const [r, g, b] = groupColors[i % groupColors.length];
    doc.setFillColor(r, g, b);
    doc.roundedRect(x, y, groupW, boxH + 2, 1.5, 1.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'bold');
    const label = mod.grupo.replace(/^\d+\.\s*/, '');
    doc.text(label, x + groupW / 2, y + 4, { align: 'center' });
    // sub count
    doc.setFontSize(4.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`${mod.subModulos.length} módulos`, x + groupW / 2, y + 8.5, { align: 'center' });

    // line from root to group
    doc.setDrawColor(r, g, b);
    doc.setLineWidth(0.3);
    doc.line(pageW / 2, y - 4, x + groupW / 2, y);
  });

  y += boxH + 12;
  doc.setTextColor(0, 0, 0);
  addFooter(1);

  // ── Sumário ──
  doc.addPage();
  addHeader();
  y = 36;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('SUMÁRIO', marginL, y);
  y += 8;

  let pageEstimate = 3;
  SISTEMA.forEach((mod) => {
    checkPage(8);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(59, 130, 246);
    doc.text(mod.grupo, marginL, y);
    doc.setTextColor(150, 150, 150);
    doc.text(`p. ${pageEstimate}`, pageW - marginR, y, { align: 'right' });
    y += 5;

    mod.subModulos.forEach((sub) => {
      checkPage(5);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(`    ${sub.nome}`, marginL, y);
      const funcCount = sub.funcionalidades.length;
      doc.text(`(${funcCount} funções)`, pageW - marginR, y, { align: 'right' });
      y += 4;
      pageEstimate++;
    });
    y += 2;
  });

  addFooter(doc.getNumberOfPages());

  // ── Detailed content ──
  SISTEMA.forEach((mod, gi) => {
    doc.addPage();
    addHeader();
    y = 36;

    // Group title bar
    const [r, g, b] = groupColors[gi % groupColors.length];
    doc.setFillColor(r, g, b);
    doc.roundedRect(marginL, y, contentW, 10, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(mod.grupo, marginL + 4, y + 7);
    y += 16;

    mod.subModulos.forEach((sub) => {
      checkPage(20);

      // Sub-module title
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(marginL, y, contentW, 8, 1.5, 1.5, 'F');
      doc.setDrawColor(r, g, b);
      doc.setLineWidth(0.5);
      doc.line(marginL, y, marginL, y + 8);
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(sub.nome, marginL + 4, y + 5.5);
      y += 12;

      sub.funcionalidades.forEach((func) => {
        checkPage(25);

        // Function name
        doc.setFillColor(r, g, b);
        doc.circle(marginL + 2, y + 1.5, 1.2, 'F');
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(func.nome, marginL + 6, y + 2.5);
        y += 5;

        // Description
        doc.setTextColor(71, 85, 105);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        const descLines = doc.splitTextToSize(func.descricao, contentW - 8);
        descLines.forEach((line: string) => {
          checkPage(5);
          doc.text(line, marginL + 6, y);
          y += 3.5;
        });
        y += 1;

        // Step-by-step
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        checkPage(5);
        doc.text('Como executar:', marginL + 6, y);
        y += 3.5;

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);
        func.passoAPasso.forEach((passo) => {
          checkPage(5);
          const passoLines = doc.splitTextToSize(passo, contentW - 14);
          passoLines.forEach((line: string) => {
            checkPage(4);
            doc.text(line, marginL + 10, y);
            y += 3.2;
          });
        });

        y += 4;
      });

      y += 3;
    });
  });

  addFooter(doc.getNumberOfPages());

  // Add page numbers to all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    // Footer is already added at key points, but let's ensure consistency
  }

  doc.save('Praefectus-Organograma-Completo.pdf');
}
