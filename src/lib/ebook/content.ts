export interface EbookSection {
  title: string;
  descricao: string;
  contextualizacao: string;
  comoUsar: string[];
  funcionalidades: string[];
  dicaPratica: string;
  routeHint: string;
}

export const ebookSections: EbookSection[] = [
  {
    title: 'Dashboard — Visão Estratégica',
    descricao:
      'O Dashboard é a tela inicial da PRAEFECTUS. Ele reúne todos os números importantes da sua operação de licitações em um só lugar: quantas licitações estão ativas, quantas foram ganhas, qual o valor total em disputa e quais prazos estão próximos. Funciona como o painel de controle de um avião — uma olhada rápida e você sabe exatamente o estado de toda a operação.',
    contextualizacao:
      'Empresas que participam de licitações públicas precisam acompanhar dezenas de processos simultâneos, cada um com prazos, documentos e valores diferentes. Sem um painel centralizado, informações se perdem em planilhas, e-mails e anotações. O Dashboard resolve isso consolidando tudo em indicadores visuais atualizados automaticamente.',
    comoUsar: [
      'Ao abrir a plataforma, o Dashboard aparece automaticamente como tela inicial.',
      'Observe os cards de KPI no topo: eles mostram licitações ativas, ganhas, perdidas e taxa de sucesso.',
      'Use os gráficos de barras para comparar valores por modalidade (pregão, concorrência, dispensa).',
      'Clique em qualquer indicador com alerta vermelho para ir direto à licitação que precisa de atenção.',
      'Filtre por período (semana, mês, trimestre) para analisar tendências.',
    ],
    funcionalidades: [
      'Cards de KPI com variação percentual em relação ao período anterior.',
      'Gráficos comparativos por faixa de valor e modalidade de licitação.',
      'Alertas visuais de vencimento de prazo com destaque em vermelho.',
      'Taxa de sucesso consolidada por período selecionado.',
      'Acesso rápido às licitações críticas direto pelo indicador.',
    ],
    dicaPratica: 'Comece o dia sempre pelo Dashboard. Em menos de 30 segundos você identifica o que precisa de atenção imediata.',
    routeHint: '/dashboard',
  },
  {
    title: 'Monitoramento de Editais',
    descricao:
      'O módulo de Monitoramento busca automaticamente novas oportunidades de licitação em portais federais, estaduais e municipais. Ele filtra os resultados com base no perfil da sua empresa (CNAE, região, palavras-chave) e classifica cada edital por relevância, para que você nunca perca uma oportunidade compatível.',
    contextualizacao:
      'Todos os dias, centenas de editais são publicados em diversos portais públicos. Monitorar manualmente cada portal é inviável e resulta em oportunidades perdidas. A PRAEFECTUS automatiza essa busca, cruzando os dados publicados com o perfil cadastrado da empresa e gerando alertas em tempo real.',
    comoUsar: [
      'Acesse "Monitoramento de Editais" no menu lateral.',
      'Configure seu perfil de busca: adicione CNAEs, estados, municípios e palavras-chave do seu segmento.',
      'Revise os editais classificados por score de relevância (de 0 a 100).',
      'Marque editais como favoritos, lidos ou arquivados para organizar seu pipeline.',
      'Use os filtros por fonte (Federal, Estadual, Municipal) e por período de publicação.',
    ],
    funcionalidades: [
      'Monitoramento contínuo de portais federais (Compras.gov.br, PNCP), estaduais e municipais.',
      'Score de relevância automático baseado na compatibilidade com seu perfil.',
      'Alertas por e-mail e notificação interna de novos editais compatíveis.',
      'Filtros avançados por CNAE, região, modalidade, valor estimado e prazo.',
      'Integração com Diários Oficiais para rastreio de publicações complementares.',
    ],
    dicaPratica: 'Configure pelo menos 3 palavras-chave específicas do seu nicho. Quanto mais refinado o perfil, maior a precisão dos resultados.',
    routeHint: '/monitoramento-editais',
  },
  {
    title: 'Chat do Pregão em Tempo Real',
    descricao:
      'Durante uma sessão de pregão eletrônico, diversas informações circulam rapidamente: mensagens do pregoeiro, eventos de lance, questionamentos e decisões. O Chat do Pregão captura e organiza todas essas informações em tempo real, permitindo que sua equipe acompanhe a disputa sem sair da plataforma.',
    contextualizacao:
      'Em pregões eletrônicos, segundos podem definir o resultado. A falta de visibilidade sobre o que está acontecendo — quem deu lance, qual o menor preço, se há questionamento pendente — compromete a estratégia de disputa. Este módulo centraliza toda a comunicação do pregão em um painel visual e cronológico.',
    comoUsar: [
      'Selecione o pregão ativo no painel de disputas.',
      'Acompanhe as mensagens do pregoeiro e eventos de lance no feed cronológico.',
      'Observe o painel lateral que mostra a posição dos concorrentes em tempo real.',
      'Use o alerta de menção ao CNPJ da empresa para identificar quando você é citado.',
      'Registre observações internas para análise pós-disputa.',
    ],
    funcionalidades: [
      'Feed de chat em tempo real com mensagens do pregão.',
      'Painel de posição competitiva com ranking de lances.',
      'Alerta automático quando o CNPJ da empresa é mencionado.',
      'Classificação de mensagens por tipo: lance, esclarecimento, decisão.',
      'Histórico completo para auditoria e melhoria contínua.',
    ],
    dicaPratica: 'Mantenha o Chat aberto em um segundo monitor durante disputas. A visibilidade em tempo real é decisiva para ajustar a estratégia.',
    routeHint: '/monitoramento-chat',
  },
  {
    title: 'Proposta Técnica e Comercial',
    descricao:
      'Este módulo permite criar propostas técnicas e comerciais padronizadas, com planilha de preços, dados da empresa, declarações obrigatórias e assinatura digital — tudo em conformidade com as exigências da Lei 14.133/2021 e ABNT NBR 14724. O resultado pode ser exportado em PDF, Word ou Excel.',
    contextualizacao:
      'Uma proposta mal formatada ou incompleta pode desclassificar a empresa na fase de julgamento. A PRAEFECTUS padroniza toda a estrutura documental: desde o cabeçalho com dados institucionais até a planilha com as 11 colunas obrigatórias, eliminando erros de formatação e omissão de campos.',
    comoUsar: [
      'Inicie uma nova proposta selecionando o edital de referência.',
      'Preencha os dados comerciais da empresa (ou importe do cadastro).',
      'Adicione os itens na planilha de preços com quantidade, unidade, descrição, marca e valores.',
      'Revise o preview em tempo real no painel lateral direito.',
      'Exporte em PDF, Word ou Excel com um clique.',
    ],
    funcionalidades: [
      'Planilha de preços com 11 colunas obrigatórias (Item, Qtd, Unidade, Descrição, Marca, Fabricante, Modelo, Valor Unit., Extenso Unit., Valor Total, Extenso Total).',
      'Preview em tempo real da proposta formatada.',
      'Extração assistida por IA para preenchimento inicial a partir do edital.',
      'Exportação sincronizada para PDF, Word e Excel.',
      'Gestão de declarações obrigatórias e assinatura digital.',
    ],
    dicaPratica: 'Use o recurso de importação do catálogo para reaproveitar itens já precificados em licitações anteriores.',
    routeHint: '/proposta-tecnica',
  },
  {
    title: 'Precificação Inteligente',
    descricao:
      'O módulo de Precificação transforma o cálculo de custos em um processo estruturado e rastreável. Ele permite compor o custo unitário de cada item, aplicar BDI (Benefícios e Despesas Indiretas), calcular tributos e comparar com preços de referência do governo — tudo em uma única tela.',
    contextualizacao:
      'Precificar incorretamente é a principal causa de prejuízo em contratos públicos. Valor alto demais perde o certame; valor baixo demais compromete a margem. A PRAEFECTUS oferece calculadoras integradas que consideram regime tributário, custos logísticos, referências públicas e margem-alvo para gerar preços competitivos e sustentáveis.',
    comoUsar: [
      'Acesse "Precificação" e selecione a licitação ou crie uma composição avulsa.',
      'Defina os itens com quantidade, unidade e descrição.',
      'Consulte referências de preço público (Painel de Preços Gov, Banco de Preços).',
      'Use a calculadora de BDI e selecione o regime tributário da empresa.',
      'Exporte a memória de cálculo completa para revisão interna.',
    ],
    funcionalidades: [
      'Composição de custo unitário detalhada (material, mão de obra, logística).',
      'Calculadora de BDI com desmembramento por componente.',
      'Consulta a preços públicos de referência para balizamento.',
      'Calculadora tributária integrada (Simples Nacional, Lucro Presumido, Lucro Real).',
      'Catálogo de itens já precificados para reaproveitamento.',
    ],
    dicaPratica: 'Sempre compare seu preço final com pelo menos 3 referências públicas antes de submeter a proposta.',
    routeHint: '/precificacao',
  },
  {
    title: 'Apoio Jurídico com IA',
    descricao:
      'O Apoio Jurídico permite gerar documentos legais — impugnações, recursos, contrarrazões e pedidos de reequilíbrio — com assistência de inteligência artificial e base normativa integrada. A IA sugere fundamentação jurídica com base na Lei 14.133/2021, jurisprudência do TCU e doutrina aplicável.',
    contextualizacao:
      'Redigir peças jurídicas para licitações exige conhecimento específico da legislação de compras públicas. Muitas empresas não possuem departamento jurídico dedicado e dependem de assessoria externa, o que aumenta custos e prazos. Este módulo democratiza o acesso à argumentação jurídica qualificada.',
    comoUsar: [
      'Selecione o tipo de peça jurídica (impugnação, recurso, contrarrazão, parecer).',
      'Anexe os dados do edital e descreva os fatos relevantes.',
      'A IA gera uma minuta com fundamentação legal automatizada.',
      'Revise e edite o texto diretamente no editor integrado.',
      'Exporte o documento final em PDF ou Word.',
    ],
    funcionalidades: [
      'Geração de impugnação ao edital com fundamentação automática.',
      'Recurso administrativo com citação de jurisprudência.',
      'Contrarrazões e pareceres técnicos estruturados.',
      'Pedido de reequilíbrio econômico-financeiro com cálculos.',
      'Upload de base jurídica própria para enriquecer o contexto da IA.',
    ],
    dicaPratica: 'Faça upload de decisões favoráveis anteriores na base jurídica. A IA aprende com esses precedentes e fortalece a argumentação.',
    routeHint: '/apoio-juridico',
  },
  {
    title: 'Gestão de Documentos',
    descricao:
      'A Gestão de Documentos funciona como um cofre digital organizado para todos os documentos obrigatórios da empresa em licitações: certidões, atestados, contratos sociais e comprovantes. O sistema monitora validades e alerta quando um documento está prestes a vencer.',
    contextualizacao:
      'Documentos vencidos ou ausentes são motivo frequente de inabilitação em licitações. Gerenciar certidões com validades diferentes, de múltiplos órgãos, para várias empresas, é complexo e sujeito a erros. O repositório centralizado resolve isso com controle automático de vencimento e histórico de versões.',
    comoUsar: [
      'Acesse "Documentos" e cadastre os arquivos por categoria (certidão, atestado, contrato).',
      'Associe cada documento à empresa correspondente.',
      'Observe os badges de status: verde (válido), amarelo (vencendo em breve), vermelho (vencido).',
      'Configure alertas para receber aviso com antecedência antes do vencimento.',
      'Use o recurso de combinação para juntar documentos em um único PDF para envio.',
    ],
    funcionalidades: [
      'Repositório centralizado com organização por tipo documental.',
      'Alertas automáticos de vencimento com antecedência configurável.',
      'Badges visuais de status (válido, expirando, vencido).',
      'Combinação de múltiplos documentos em PDF único.',
      'Histórico de versões com rastreamento de alterações.',
    ],
    dicaPratica: 'Configure alertas com 30 dias de antecedência para certidões. Isso garante tempo hábil para renovação sem perder prazos.',
    routeHint: '/documentos',
  },
  {
    title: 'Kanban de Licitações',
    descricao:
      'O Kanban organiza suas licitações em colunas visuais que representam cada etapa do processo: Novo, Análise, Proposta, Enviado e Ganho. Basta arrastar o card de uma coluna para outra conforme o processo avança. É a forma mais intuitiva de visualizar o progresso de todas as oportunidades.',
    contextualizacao:
      'Sem uma visão clara das etapas, é comum que licitações fiquem "paradas" sem que ninguém perceba. O Kanban resolve isso com gestão visual: cada card é uma licitação, cada coluna é uma etapa, e qualquer gargalo fica imediatamente visível para toda a equipe.',
    comoUsar: [
      'Acesse "Kanban" no menu lateral para visualizar o quadro de licitações.',
      'Crie um novo card para cada oportunidade aprovada, preenchendo título, valor e prazo.',
      'Atribua um responsável e defina a data limite para cada etapa.',
      'Arraste o card entre as colunas conforme o andamento (Novo → Análise → Proposta → Enviado → Ganho).',
      'Clique no card para ver detalhes, adicionar notas e consultar histórico de movimentação.',
    ],
    funcionalidades: [
      'Colunas personalizáveis por etapa do processo licitatório.',
      'Drag-and-drop intuitivo para movimentação de cards.',
      'Priorização visual por criticidade e prazo (badges coloridos).',
      'Atribuição de responsável por atividade com avatar.',
      'Histórico de movimentação para auditoria e análise de gargalos.',
    ],
    dicaPratica: 'Defina uma reunião semanal rápida (15 min) para revisar o quadro Kanban com a equipe. Isso evita que processos fiquem esquecidos.',
    routeHint: '/kanban',
  },
  {
    title: 'Robô de Lances',
    descricao:
      'O Robô de Lances automatiza o envio de lances em pregões eletrônicos de acordo com regras configuradas por você: preço de referência, piso mínimo, valor de decremento e intervalo entre lances. Ele reage mais rápido que qualquer operador humano, mantendo sua empresa competitiva durante a fase de disputa.',
    contextualizacao:
      'Em pregões eletrônicos com fase de lances, a velocidade de resposta é crucial. Operadores humanos estão sujeitos a atrasos, erros de digitação e fadiga. O Robô de Lances executa a estratégia definida com precisão e velocidade, registrando cada ação em trilha de auditoria completa.',
    comoUsar: [
      'Acesse "Robô de Lances" e selecione o pregão alvo.',
      'Configure o preço de referência (valor máximo) e o piso mínimo (valor que não pode ser ultrapassado).',
      'Defina o decremento (quanto reduzir a cada lance) e o intervalo em segundos.',
      'Execute uma simulação antes da sessão real para validar a estratégia.',
      'Ative o robô e acompanhe os lances em tempo real no painel de monitoramento.',
    ],
    funcionalidades: [
      'Lance automático com regra de parada configurável.',
      'Controle de intervalo entre lances (em segundos).',
      'Simulação de disputa para teste de estratégia antes da sessão.',
      'Trilha de auditoria completa de todas as ações executadas.',
      'Kill switch (botão de emergência) para interromper instantaneamente.',
    ],
    dicaPratica: 'Sempre execute pelo menos uma simulação antes de ativar o robô em sessão real. Isso evita surpresas com a configuração.',
    routeHint: '/robo-lances',
  },
  {
    title: 'Governança Multiempresa',
    descricao:
      'Para grupos empresariais ou escritórios que administram vários CNPJs, o módulo Multiempresa permite gerenciar todas as empresas em uma única conta. Cada empresa tem seus dados isolados, e os membros da equipe podem ter papéis diferentes (administrador, operador, visualizador) em cada empresa.',
    contextualizacao:
      'Empresas que operam múltiplos CNPJs precisam alternar entre contas, documentos e configurações frequentemente. Sem governança adequada, há risco de enviar documentos da empresa errada ou de operadores acessarem dados que não deveriam. O módulo Multiempresa resolve isso com isolamento de dados e controle de acesso por papel.',
    comoUsar: [
      'Acesse "Empresas" para visualizar e gerenciar seus CNPJs cadastrados.',
      'Clique em "Adicionar Empresa" para cadastrar um novo CNPJ com dados completos.',
      'Convide membros da equipe e defina o papel de cada um (admin, operador, visualizador).',
      'Use o seletor de empresa no topo da tela para alternar entre CNPJs.',
      'Consulte o log de auditoria para rastrear todas as alterações feitas por cada usuário.',
    ],
    funcionalidades: [
      'Gerenciamento de múltiplos CNPJs em conta única.',
      'Papéis de acesso: administrador, operador e visualizador.',
      'Isolamento completo de dados entre empresas.',
      'Seletor rápido de empresa ativa no topo da plataforma.',
      'Log de auditoria por usuário e empresa para rastreabilidade.',
    ],
    dicaPratica: 'Revise os papéis de acesso trimestralmente. Colaboradores que mudaram de função podem ter permissões desatualizadas.',
    routeHint: '/empresas',
  },
];
