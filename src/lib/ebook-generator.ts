import jsPDF from 'jspdf';

// ── Brand colors ──
const ACCENT: [number, number, number] = [45, 166, 153]; // teal accent
const DARK: [number, number, number] = [22, 28, 45];
const GRAY: [number, number, number] = [100, 106, 120];
const LIGHT_BG: [number, number, number] = [243, 245, 250];
const WHITE: [number, number, number] = [255, 255, 255];

interface Section {
  title: string;
  icon: string;
  description: string;
  howItWorks: string;
  features: string[];
  tip: string;
}

const sections: Section[] = [
  {
    title: 'Dashboard Inteligente',
    icon: '📊',
    description: 'O Dashboard é a tela inicial da LicitaIA. Ele apresenta uma visão consolidada de todas as licitações, indicadores de desempenho e alertas em tempo real, permitindo decisões rápidas e estratégicas.',
    howItWorks: 'Ao acessar o sistema, o Dashboard exibe automaticamente os dados mais relevantes: total de licitações ativas, ganhas e perdidas; gráficos de valor por modalidade; e alertas de prazos. Os dados são atualizados em tempo real conforme você interage com o sistema.',
    features: [
      'Resumo de licitações ativas, ganhas e perdidas com indicadores visuais',
      'Gráficos interativos de valor total e distribuição por modalidade',
      'Alertas automáticos de prazos próximos ao vencimento',
      'Indicadores de taxa de sucesso e economia acumulada',
      'Filtros por período, modalidade e status',
    ],
    tip: 'Acesse o Dashboard diariamente para não perder nenhum prazo crítico.',
  },
  {
    title: 'Monitoramento de Editais',
    icon: '🔍',
    description: 'O módulo de Monitoramento realiza buscas automáticas e contínuas em mais de 500 portais de licitação em todo o Brasil, trazendo as oportunidades mais relevantes para o seu perfil.',
    howItWorks: 'Configure seus filtros de busca (CNAE, UF, palavras-chave e faixa de valor) e o sistema passará a monitorar automaticamente 24h por dia. Cada edital encontrado recebe um score de relevância baseado na compatibilidade com a sua empresa.',
    features: [
      'Monitoramento 24/7 em portais federais, estaduais e municipais',
      'Filtros avançados por CNAE, UF, município, valor e palavras-chave',
      'Score de relevância automático por compatibilidade com a empresa',
      'Alertas instantâneos para novos editais compatíveis',
      'Marcação de lidos/não lidos, favoritos e arquivamento',
      'Integração com Diários Oficiais da União, Estados e Municípios',
    ],
    tip: 'Configure pelo menos 3 palavras-chave e seu CNAE principal para melhores resultados.',
  },
  {
    title: 'Chat do Pregão em Tempo Real',
    icon: '💬',
    description: 'Acompanhe o chat de pregões eletrônicos em tempo real, receba alertas inteligentes sobre menções à sua empresa e monitore as movimentações dos concorrentes.',
    howItWorks: 'Selecione o pregão que deseja acompanhar e o sistema abrirá um painel com o chat em tempo real. Você receberá notificações automáticas quando seu CNPJ for mencionado ou quando houver lances de concorrentes monitorados.',
    features: [
      'Acompanhamento em tempo real do chat do pregão',
      'Alertas automáticos de menção ao CNPJ da empresa',
      'Monitoramento de lances e movimentações de concorrentes',
      'Histórico completo de mensagens por pregão',
      'Notificações sonoras para eventos importantes',
    ],
    tip: 'Mantenha o chat aberto durante o horário do pregão para reagir rapidamente.',
  },
  {
    title: 'Boletins Diários Automáticos',
    icon: '📧',
    description: 'Receba resumos diários por e-mail com as informações mais importantes: novas licitações, alterações em editais e resultados de certames, sem precisar acessar a plataforma.',
    howItWorks: 'O sistema envia até 3 boletins por dia, cada um com foco diferente. Basta configurar seu e-mail e selecionar quais boletins deseja receber. Os horários são fixos para criar uma rotina previsível.',
    features: [
      'Boletim da manhã (08h): novas licitações publicadas na data',
      'Boletim do meio-dia (12h): alterações, suspensões e cancelamentos',
      'Boletim da tarde (17h): resultados, homologações e adjudicações',
      'Configuração individual de quais boletins receber',
      'E-mails com layout limpo e links diretos para os editais',
    ],
    tip: 'Ative os 3 boletins para ter cobertura completa do ciclo diário.',
  },
  {
    title: 'Licitações Estratégicas com IA',
    icon: '🎯',
    description: 'A Inteligência Artificial da LicitaIA analisa seu histórico, identifica padrões de sucesso e recomenda as licitações com maior probabilidade de vitória.',
    howItWorks: 'O algoritmo cruza dados como: histórico de participações, preços praticados, perfil de concorrentes e características do edital. O resultado é um ranking de oportunidades ordenado por score de probabilidade.',
    features: [
      'Score de oportunidade baseado em machine learning',
      'Análise de concorrência e nível de competitividade',
      'Recomendações de preço competitivo baseadas em dados reais',
      'Ranking automático das licitações mais promissoras',
      'Alertas para oportunidades de alto potencial',
    ],
    tip: 'Quanto mais licitações você participar, mais precisa será a IA.',
  },
  {
    title: 'Análise de Mercado e Tendências',
    icon: '📈',
    description: 'Dashboard analítico com dados de mercado, preços praticados em contratos públicos e tendências setoriais para embasar suas decisões.',
    howItWorks: 'Consulte dados agregados de licitações realizadas em todo o Brasil. Visualize preços médios por segmento, distribuição geográfica e tendências de crescimento para planejar sua estratégia.',
    features: [
      'Distribuição de licitações por segmento e região em mapa interativo',
      'Preços médios praticados por tipo de serviço ou produto',
      'Tendências de crescimento e sazonalidade por setor',
      'Consulta a contratos vigentes no Portal de Transparência',
      'Dados de empenhos por órgão e categoria de despesa',
    ],
    tip: 'Use a análise de mercado para justificar preços em propostas técnicas.',
  },
  {
    title: 'Kanban de Licitações',
    icon: '📋',
    description: 'Gerencie visualmente todo o pipeline de licitações da sua empresa com quadro Kanban, arrastar e soltar, prazos e responsáveis.',
    howItWorks: 'Crie cards para cada licitação e organize-os nas colunas: A Fazer, Em Andamento, Aguardando e Concluído. Atribua responsáveis, defina prioridades e acompanhe prazos em uma única tela.',
    features: [
      'Colunas personalizáveis com arrastar e soltar',
      'Atribuição de responsáveis e prazos por card',
      'Priorização por cores: alta, média e baixa',
      'Tags e etiquetas personalizáveis',
      'Vinculação direta com editais monitorados',
    ],
    tip: 'Crie um card assim que identificar uma licitação promissora.',
  },
  {
    title: 'Robô de Lances Automatizado',
    icon: '🤖',
    description: 'Automatize a participação em pregões eletrônicos com estratégias configuráveis de decremento, limites de valor e intervalos de lance.',
    howItWorks: 'Configure os parâmetros da disputa: valor de referência, valor mínimo (piso), decremento por lance e intervalo entre lances. O robô executará os lances automaticamente durante a sessão, respeitando suas regras.',
    features: [
      'Configuração de valor mínimo, decremento e intervalo entre lances',
      'Lances automáticos em tempo real durante o pregão',
      'Simulação de disputa antes da sessão real',
      'Histórico detalhado de todos os lances realizados',
      'Suporte a Compras.gov, BEC/SP, Licitações-e e outros portais',
      'Agente externo para execução em infraestrutura própria',
    ],
    tip: 'Sempre faça uma simulação antes de ativar o modo automático.',
  },
  {
    title: 'Análise de Concorrentes',
    icon: '👥',
    description: 'Monitore e analise detalhadamente as empresas concorrentes: CNPJ, SINTEGRA, certidões negativas e histórico de participações.',
    howItWorks: 'Cadastre os CNPJs dos concorrentes e o sistema buscará automaticamente dados na Receita Federal e SINTEGRA. Acompanhe o histórico de participações e identifique padrões de comportamento.',
    features: [
      'Consulta automática de CNPJ via Receita Federal',
      'Consulta SINTEGRA para dados de inscrição estadual',
      'Emissão de certidões negativas automatizadas',
      'Histórico de participações e vitórias por concorrente',
      'Análise de porte, CNAE e capital social',
    ],
    tip: 'Cadastre os 5 concorrentes mais frequentes para acompanhamento contínuo.',
  },
  {
    title: 'Gestão de Documentos',
    icon: '📁',
    description: 'Repositório centralizado para todos os documentos da empresa relacionados a licitações, com controle de validade e alertas de vencimento.',
    howItWorks: 'Faça upload de documentos e organize-os por tipo e licitação. O sistema monitora automaticamente as datas de validade e envia alertas antes do vencimento.',
    features: [
      'Upload e organização por tipo de documento e licitação',
      'Alertas automáticos de vencimento de documentos',
      'Merge de documentos PDF em um único arquivo',
      'Análise de documentos de concorrentes por IA',
      'Controle de versões e histórico de atualizações',
    ],
    tip: 'Mantenha todos os documentos atualizados para agilizar a montagem de propostas.',
  },
  {
    title: 'Assessoria Cadastral',
    icon: '✅',
    description: 'Orientação completa para cadastro e manutenção em sistemas de compras públicas como SICAF, CAUFESP e CRCs estaduais.',
    howItWorks: 'Selecione o sistema de cadastro desejado e o LicitaIA apresentará um checklist interativo com todos os documentos necessários, prazos e instruções passo a passo.',
    features: [
      'Orientação detalhada para cadastro no SICAF',
      'Suporte ao CAUFESP e CRCs estaduais',
      'Checklist interativo de documentos necessários',
      'Alertas de vencimento de cadastros ativos',
      'Links diretos para os portais de cadastramento',
    ],
    tip: 'Renove os cadastros com pelo menos 30 dias de antecedência.',
  },
  {
    title: 'Apoio Jurídico com IA',
    icon: '⚖️',
    description: 'Gere peças jurídicas automatizadas com fundamentação legal atualizada, incluindo impugnações, recursos e pedidos de reequilíbrio econômico-financeiro.',
    howItWorks: 'Selecione o tipo de peça, informe os dados do edital e a situação. A IA gerará o documento com fundamentação na Lei 14.133/2021, Lei 8.666/93 e jurisprudência do TCU. Você pode editar antes de exportar.',
    features: [
      'Geração de impugnações de edital com fundamentação legal',
      'Recursos administrativos e contrarrazões automatizados',
      'Pareceres jurídicos com citação de legislação vigente',
      'Pedidos de reequilíbrio econômico-financeiro',
      'Upload de base jurídica própria para enriquecer a IA',
      'Exportação em formato editável (DOCX) e PDF',
    ],
    tip: 'Revise sempre o documento gerado antes de protocolar.',
  },
  {
    title: 'Precificação Inteligente',
    icon: '💰',
    description: 'Ferramentas completas de precificação: consulta SINAPI, cálculo de BDI, composição de custos, cotação de frete e pesquisa de preços no mercado.',
    howItWorks: 'Utilize as calculadoras integradas para compor preços unitários, calcular BDI e tributos. Consulte preços de referência no Painel de Preços do Governo e em fornecedores do mercado.',
    features: [
      'Consulta à base SINAPI atualizada mensalmente',
      'Calculadora de BDI com parâmetros configuráveis',
      'Composição de custos unitários assistida por IA',
      'Cotação de frete automática por origem e destino',
      'Pesquisa de preços em fornecedores do mercado',
      'Exportação de planilhas em formato Excel e PDF',
    ],
    tip: 'Sempre compare ao menos 3 fontes de preço para maior competitividade.',
  },
  {
    title: 'Assistente IA Conversacional',
    icon: '🧠',
    description: 'Chat inteligente que responde dúvidas sobre licitações, legislação, modalidades e auxilia na elaboração de propostas técnicas e comerciais.',
    howItWorks: 'Digite sua pergunta ou descreva o que precisa no chat. A IA responde com base na legislação vigente, melhores práticas e dados do seu histórico. As conversas ficam salvas para consulta futura.',
    features: [
      'Respostas fundamentadas sobre legislação de licitações',
      'Auxílio na elaboração de propostas técnicas e comerciais',
      'Análise de cláusulas e condições de editais',
      'Sugestões de estratégias competitivas personalizadas',
      'Histórico de conversas salvo automaticamente',
    ],
    tip: 'Seja específico na pergunta para obter respostas mais precisas.',
  },
  {
    title: 'Blog e Base de Conhecimento',
    icon: '📰',
    description: 'Portal de conhecimento com artigos, notícias, guias práticos e atualizações sobre legislação de licitações no Brasil.',
    howItWorks: 'Acesse o blog a qualquer momento para ler artigos publicados pela equipe editorial e conteúdos gerados por IA. Filtre por categoria ou busque por palavra-chave.',
    features: [
      'Artigos sobre mudanças na legislação de licitações',
      'Guias práticos para empresas iniciantes em licitações',
      'Notícias do mercado e análises de conjuntura',
      'Dicas e melhores práticas de profissionais experientes',
      'Conteúdo atualizado por IA com curadoria humana',
    ],
    tip: 'Acompanhe o blog semanalmente para ficar atualizado sobre mudanças legislativas.',
  },
  {
    title: 'Gestão Multi-empresa',
    icon: '🏢',
    description: 'Gerencie múltiplas empresas em uma única conta, com controle de acesso por papéis e alternância rápida entre CNPJs.',
    howItWorks: 'Cadastre suas empresas, atribua membros com papéis específicos (Admin, Operador, Visualizador) e alterne entre elas com um clique. Cada empresa tem seus próprios dados e certificados.',
    features: [
      'Cadastro de múltiplas empresas por conta',
      'Papéis: Administrador, Operador e Visualizador',
      'Alternância rápida entre empresas na barra lateral',
      'Certificados digitais independentes por empresa',
      'Isolamento completo de dados entre empresas',
    ],
    tip: 'Defina um Admin para cada empresa para melhor governança.',
  },
  {
    title: 'Planos e Assinaturas',
    icon: '💎',
    description: 'A LicitaIA oferece três planos flexíveis, do básico ao enterprise, para atender empresas de todos os portes e necessidades.',
    howItWorks: 'Compare os planos disponíveis, selecione o mais adequado e realize o pagamento de forma segura. A ativação é instantânea e você pode fazer upgrade a qualquer momento.',
    features: [
      'Plano Básico: monitoramento essencial e boletins diários',
      'Plano Profissional: recursos avançados, IA e robô de lances',
      'Plano Enterprise: ilimitado, suporte dedicado e API',
      'Pagamento seguro com gestão automática de cobrança',
      'Upgrade e downgrade a qualquer momento',
    ],
    tip: 'Comece com o plano Profissional para aproveitar os recursos de IA.',
  },
];

export function generateEbook(): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const m = 20;
  const cw = pw - m * 2;

  // ════════════════════════════════════════════
  //  COVER PAGE
  // ════════════════════════════════════════════
  doc.setFillColor(...DARK);
  doc.rect(0, 0, pw, ph, 'F');

  // Top accent bar
  doc.setFillColor(...ACCENT);
  doc.rect(0, 0, pw, 5, 'F');

  // Decorative circle
  doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
  doc.setGState(new (doc as any).GState({ opacity: 0.08 }));
  doc.circle(pw * 0.75, ph * 0.35, 80, 'F');
  doc.setGState(new (doc as any).GState({ opacity: 1 }));

  // Title
  doc.setTextColor(...WHITE);
  doc.setFontSize(42);
  doc.setFont('helvetica', 'bold');
  doc.text('LicitaIA', m, 80);

  doc.setFontSize(16);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 210, 220);
  doc.text('Guia Completo da Plataforma', m, 95);

  // Accent line
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(1.2);
  doc.line(m, 105, m + 60, 105);

  doc.setFontSize(11);
  doc.setTextColor(160, 170, 185);
  const introLines = doc.splitTextToSize(
    'Manual completo com todas as funcionalidades do sistema LicitaIA. ' +
    'Ideal para treinamento de equipes, onboarding de novos colaboradores e consulta rápida durante o dia a dia.',
    cw * 0.7
  );
  doc.text(introLines, m, 118);

  // Bottom info
  doc.setFontSize(9);
  doc.setTextColor(120, 130, 145);
  const today = new Date().toLocaleDateString('pt-BR', { year: 'numeric', month: 'long' });
  doc.text(`Versão 2.0 • ${today}`, m, ph - 28);
  doc.text(`${sections.length} capítulos • ~36 páginas`, m, ph - 21);

  doc.setFontSize(8);
  doc.setTextColor(90, 100, 115);
  doc.text('© LicitaIA – Todos os direitos reservados. Uso interno.', m, ph - 12);

  // ════════════════════════════════════════════
  //  TABLE OF CONTENTS
  // ════════════════════════════════════════════
  doc.addPage();
  drawPageHeader(doc, 'Sumário');
  let y = 52;

  doc.setFontSize(10);
  sections.forEach((s, i) => {
    if (y > ph - 25) {
      doc.addPage();
      drawPageHeader(doc, 'Sumário (cont.)');
      y = 52;
    }

    // Number
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...ACCENT);
    doc.text(String(i + 1).padStart(2, '0'), m, y);

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK);
    doc.text(`${s.icon}  ${s.title}`, m + 12, y);

    // Dotted line
    const titleW = doc.getTextWidth(`${s.icon}  ${s.title}`);
    doc.setDrawColor(200, 200, 210);
    doc.setLineDashPattern([1, 2], 0);
    doc.line(m + 14 + titleW, y, pw - m - 12, y);
    doc.setLineDashPattern([], 0);

    // Page number
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    const pageNum = (i + 1) * 2 + 1;
    doc.text(String(pageNum), pw - m - 5, y, { align: 'right' });

    y += 10;
  });

  drawPageFooter(doc, 2);

  // ════════════════════════════════════════════
  //  CONTENT PAGES
  // ════════════════════════════════════════════
  sections.forEach((section, idx) => {
    doc.addPage();
    const pageNum = (idx + 1) * 2 + 1;

    // ── Header strip ──
    doc.setFillColor(...ACCENT);
    doc.rect(0, 0, pw, 4, 'F');

    // Chapter number + icon
    doc.setFillColor(...DARK);
    doc.roundedRect(m, 14, 50, 14, 3, 3, 'F');
    doc.setTextColor(...WHITE);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`CAPÍTULO ${String(idx + 1).padStart(2, '0')}`, m + 25, 22.5, { align: 'center' });

    // Title
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK);
    doc.text(`${section.icon}  ${section.title}`, m, 42);

    // Accent underline
    doc.setDrawColor(...ACCENT);
    doc.setLineWidth(0.8);
    doc.line(m, 47, m + 70, 47);

    y = 56;

    // ── Description ──
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 65, 80);
    const descLines = doc.splitTextToSize(section.description, cw);
    doc.text(descLines, m, y);
    y += descLines.length * 5.5 + 8;

    // ── How it works box ──
    const howLines = doc.splitTextToSize(section.howItWorks, cw - 16);
    const howBoxH = howLines.length * 5 + 20;
    doc.setFillColor(...LIGHT_BG);
    doc.roundedRect(m, y, cw, howBoxH, 3, 3, 'F');

    doc.setFillColor(...ACCENT);
    doc.rect(m, y, 3, howBoxH, 'F'); // left accent bar

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...ACCENT);
    doc.text('COMO FUNCIONA', m + 10, y + 10);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 65, 80);
    doc.text(howLines, m + 10, y + 18);
    y += howBoxH + 8;

    // ── Features list ──
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK);
    doc.text('FUNCIONALIDADES', m, y);
    y += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    section.features.forEach((feat) => {
      if (y > ph - 35) {
        drawPageFooter(doc, pageNum);
        doc.addPage();
        doc.setFillColor(...ACCENT);
        doc.rect(0, 0, pw, 4, 'F');
        y = 20;
      }
      // Bullet
      doc.setFillColor(...ACCENT);
      doc.circle(m + 3, y - 1, 1.3, 'F');
      doc.setTextColor(50, 55, 70);
      const featLines = doc.splitTextToSize(feat, cw - 12);
      doc.text(featLines, m + 9, y);
      y += featLines.length * 5 + 3;
    });

    y += 4;

    // ── Tip box ──
    if (y < ph - 40) {
      doc.setFillColor(255, 248, 230);
      const tipLines = doc.splitTextToSize(section.tip, cw - 20);
      const tipH = tipLines.length * 5 + 14;
      doc.roundedRect(m, y, cw, tipH, 3, 3, 'F');
      doc.setDrawColor(240, 200, 80);
      doc.setLineWidth(0.5);
      doc.roundedRect(m, y, cw, tipH, 3, 3, 'S');

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(180, 140, 20);
      doc.text('💡 DICA', m + 8, y + 9);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120, 100, 30);
      doc.text(tipLines, m + 8, y + 16);
    }

    drawPageFooter(doc, pageNum);
  });

  // ════════════════════════════════════════════
  //  FINAL PAGE
  // ════════════════════════════════════════════
  doc.addPage();
  doc.setFillColor(...DARK);
  doc.rect(0, 0, pw, ph, 'F');

  doc.setFillColor(...ACCENT);
  doc.rect(0, ph - 5, pw, 5, 'F');

  // Decorative
  doc.setGState(new (doc as any).GState({ opacity: 0.06 }));
  doc.setFillColor(...ACCENT);
  doc.circle(pw * 0.3, ph * 0.4, 100, 'F');
  doc.setGState(new (doc as any).GState({ opacity: 1 }));

  doc.setTextColor(...WHITE);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('Obrigado por usar a LicitaIA!', pw / 2, ph / 2 - 25, { align: 'center' });

  doc.setFontSize(13);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(190, 200, 215);
  doc.text('Sua plataforma inteligente para', pw / 2, ph / 2 - 5, { align: 'center' });
  doc.text('licitações públicas no Brasil', pw / 2, ph / 2 + 4, { align: 'center' });

  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(0.8);
  doc.line(pw / 2 - 30, ph / 2 + 15, pw / 2 + 30, ph / 2 + 15);

  doc.setFontSize(10);
  doc.setTextColor(140, 150, 165);
  doc.text('suporte@licitaia.com.br', pw / 2, ph / 2 + 30, { align: 'center' });
  doc.text('www.licitaia.com.br', pw / 2, ph / 2 + 38, { align: 'center' });

  doc.setFontSize(8);
  doc.setTextColor(90, 100, 115);
  doc.text('Material de uso exclusivo para empresas com plano ativo.', pw / 2, ph - 20, { align: 'center' });

  doc.save('LicitaIA-Guia-Completo.pdf');
}

// ── Helpers ──

function drawPageHeader(doc: jsPDF, title: string) {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFillColor(...ACCENT);
  doc.rect(0, 0, pw, 4, 'F');

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  doc.text(title, 20, 30);

  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(0.5);
  doc.line(20, 36, pw - 20, 36);
}

function drawPageFooter(doc: jsPDF, pageNum: number) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  doc.setFontSize(7);
  doc.setTextColor(170, 175, 185);
  doc.text('LicitaIA – Guia Completo da Plataforma', 20, ph - 8);
  doc.text(`Página ${pageNum}`, pw - 20, ph - 8, { align: 'right' });
}
