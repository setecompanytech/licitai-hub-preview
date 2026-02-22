import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const ACCENT: [number, number, number] = [249, 115, 22];
const DARK: [number, number, number] = [26, 26, 46];
const GRAY: [number, number, number] = [100, 100, 120];
const WHITE: [number, number, number] = [255, 255, 255];

interface Section {
  title: string;
  icon: string;
  description: string;
  features: string[];
}

const sections: Section[] = [
  {
    title: 'Dashboard',
    icon: '📊',
    description: 'Visão geral consolidada de todas as licitações, indicadores de desempenho e alertas em tempo real.',
    features: [
      'Resumo de licitações ativas, ganhas e perdidas',
      'Gráficos de valor total e distribuição por modalidade',
      'Alertas de prazos próximos ao vencimento',
      'Indicadores de taxa de sucesso e economia',
    ],
  },
  {
    title: 'Monitoramento de Editais',
    icon: '🔍',
    description: 'Busca automática e monitoramento contínuo de editais em mais de 500 portais de licitação.',
    features: [
      'Monitoramento 24/7 em portais federais, estaduais e municipais',
      'Filtros por CNAE, UF, município, valor e palavras-chave',
      'Score de relevância automático por compatibilidade',
      'Alertas instantâneos para novos editais compatíveis',
      'Marcação de lidos/não lidos e favoritos',
    ],
  },
  {
    title: 'Chat do Pregão',
    icon: '💬',
    description: 'Monitoramento em tempo real do chat de pregões eletrônicos com alertas inteligentes.',
    features: [
      'Acompanhamento em tempo real do chat do pregão',
      'Alertas de menção ao CNPJ da empresa',
      'Monitoramento de lances e movimentações de concorrentes',
      'Histórico completo de mensagens por pregão',
    ],
  },
  {
    title: 'Boletins Diários por E-mail',
    icon: '📧',
    description: 'Envio automático de boletins 3x ao dia com novas licitações, alterações e resultados.',
    features: [
      'Boletim da manhã (08h): novas licitações publicadas',
      'Boletim do meio-dia (12h): alterações, suspensões e cancelamentos',
      'Boletim da tarde (17h): resultados e homologações',
      'Configuração individual de preferências de recebimento',
      'Integração com Resend para entrega confiável',
    ],
  },
  {
    title: 'Licitações Estratégicas',
    icon: '🎯',
    description: 'Análise inteligente que identifica oportunidades com maior probabilidade de sucesso.',
    features: [
      'Score de oportunidade baseado em histórico',
      'Análise de concorrência e competitividade',
      'Recomendações de preço competitivo',
      'Ranking de licitações mais promissoras',
    ],
  },
  {
    title: 'Análise de Mercado',
    icon: '📈',
    description: 'Dashboard com dados do mercado, preços praticados e tendências do setor.',
    features: [
      'Distribuição de licitações por segmento e região',
      'Preços médios praticados por tipo de serviço/produto',
      'Tendências de crescimento por setor',
      'Análise de sazonalidade e demanda',
    ],
  },
  {
    title: 'Kanban de Licitações',
    icon: '📋',
    description: 'Gestão visual do pipeline de licitações com arrastar e soltar.',
    features: [
      'Colunas personalizáveis (A Fazer, Em Andamento, Concluído)',
      'Atribuição de responsáveis e prazos',
      'Priorização por cores e tags',
      'Vinculação direta com editais monitorados',
    ],
  },
  {
    title: 'Robô de Lances',
    icon: '🤖',
    description: 'Automação inteligente de lances em pregões eletrônicos com estratégias configuráveis.',
    features: [
      'Configuração de valor mínimo e decremento',
      'Lances automáticos em tempo real',
      'Credenciais seguras para múltiplos portais',
      'Histórico detalhado de lances realizados',
      'Suporte a Compras.gov, BEC/SP, Licitações-e e outros',
    ],
  },
  {
    title: 'Análise de Concorrentes',
    icon: '👥',
    description: 'Monitoramento e análise detalhada das empresas concorrentes.',
    features: [
      'Consulta automática de CNPJ via Receita Federal',
      'Consulta SINTEGRA para dados estaduais',
      'Emissão de certidões negativas automáticas',
      'Histórico de participações e vitórias',
      'Análise de porte, CNAE e capital social',
    ],
  },
  {
    title: 'Gestão de Documentos',
    icon: '📁',
    description: 'Repositório centralizado para todos os documentos de licitação.',
    features: [
      'Upload e organização por licitação',
      'Geração automática de documentos via IA',
      'Templates personalizáveis para propostas',
      'Controle de versões e validade',
    ],
  },
  {
    title: 'Assessoria Cadastral',
    icon: '✅',
    description: 'Suporte completo para cadastro e manutenção em sistemas de compras públicas.',
    features: [
      'Orientação para cadastro no SICAF',
      'Suporte ao CAUFESP e CRCs estaduais',
      'Checklist de documentos necessários',
      'Alertas de vencimento de cadastros',
    ],
  },
  {
    title: 'Apoio Jurídico com IA',
    icon: '⚖️',
    description: 'Geração automatizada de peças jurídicas com fundamentação legal.',
    features: [
      'Geração de impugnações de edital',
      'Recursos administrativos automatizados',
      'Contrarrazões e pareceres jurídicos',
      'Pedidos de reequilíbrio econômico-financeiro',
      'Fundamentação na Lei 14.133/2021 e Lei 8.666/93',
    ],
  },
  {
    title: 'Precificação Inteligente',
    icon: '💰',
    description: 'Planilhas de preço com referência SINAPI e cálculo automático de BDI.',
    features: [
      'Consulta à base SINAPI atualizada',
      'Cálculo automático de BDI configurável',
      'Composição de custos unitários',
      'Exportação em formato Excel e PDF',
    ],
  },
  {
    title: 'Assistente IA',
    icon: '🧠',
    description: 'Chat inteligente que responde dúvidas sobre licitações e auxilia na elaboração de propostas.',
    features: [
      'Respostas sobre legislação de licitações',
      'Auxílio na elaboração de propostas técnicas',
      'Análise de editais e cláusulas',
      'Sugestões de estratégias competitivas',
    ],
  },
  {
    title: 'Blog e Conteúdos',
    icon: '📰',
    description: 'Portal de conhecimento com artigos, notícias e guias sobre licitações.',
    features: [
      'Artigos sobre mudanças na legislação',
      'Guias práticos para iniciantes',
      'Notícias do mercado de licitações',
      'Dicas e melhores práticas',
    ],
  },
  {
    title: 'Gestão Multi-empresa',
    icon: '🏢',
    description: 'Gerencie múltiplas empresas e equipes com controle de acesso granular.',
    features: [
      'Cadastro de múltiplas empresas por conta',
      'Papéis: Admin, Operador e Visualizador',
      'Alternância rápida entre empresas',
      'Certificados digitais por empresa',
    ],
  },
  {
    title: 'Planos e Assinaturas',
    icon: '💎',
    description: 'Três planos flexíveis para atender empresas de todos os portes.',
    features: [
      'Plano Básico: monitoramento essencial',
      'Plano Profissional: recursos avançados + IA',
      'Plano Enterprise: ilimitado + suporte dedicado',
      'Pagamento via Stripe com gestão automática',
    ],
  },
];

export function generateEbook(): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = 0;

  // ===== COVER PAGE =====
  doc.setFillColor(...DARK);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // Accent bar
  doc.setFillColor(...ACCENT);
  doc.rect(0, 0, pageWidth, 6, 'F');

  // Title
  doc.setTextColor(...WHITE);
  doc.setFontSize(36);
  doc.setFont('helvetica', 'bold');
  doc.text('ConLicitação', pageWidth / 2, 80, { align: 'center' });

  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 200, 210);
  doc.text('Guia Completo da Plataforma', pageWidth / 2, 95, { align: 'center' });

  // Decorative line
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(1);
  doc.line(pageWidth / 2 - 30, 105, pageWidth / 2 + 30, 105);

  doc.setFontSize(11);
  doc.setTextColor(160, 160, 180);
  doc.text('Manual de Funcionalidades', pageWidth / 2, 118, { align: 'center' });
  doc.text('Para uso interno das empresas assinantes', pageWidth / 2, 126, { align: 'center' });

  // Version info
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 140);
  const today = new Date().toLocaleDateString('pt-BR', { year: 'numeric', month: 'long' });
  doc.text(`Versão 1.0 • ${today}`, pageWidth / 2, pageHeight - 30, { align: 'center' });
  doc.text('© ConLicitação – Todos os direitos reservados', pageWidth / 2, pageHeight - 22, { align: 'center' });

  // ===== TABLE OF CONTENTS =====
  doc.addPage();
  y = margin;
  addPageHeader(doc, 'Sumário');
  y = 50;

  doc.setFontSize(10);
  sections.forEach((section, i) => {
    if (y > pageHeight - 20) {
      doc.addPage();
      y = margin + 10;
    }
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text(`${String(i + 1).padStart(2, '0')}`, margin, y);
    doc.setTextColor(...DARK);
    doc.setFont('helvetica', 'bold');
    doc.text(`${section.icon}  ${section.title}`, margin + 12, y);

    // Dotted line
    doc.setDrawColor(200, 200, 200);
    doc.setLineDashPattern([1, 2], 0);
    const titleW = doc.getTextWidth(`${section.icon}  ${section.title}`);
    doc.line(margin + 14 + titleW, y, pageWidth - margin - 10, y);
    doc.setLineDashPattern([], 0);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text(`${i + 3}`, pageWidth - margin - 5, y, { align: 'right' });
    y += 9;
  });

  // ===== CONTENT PAGES =====
  sections.forEach((section, idx) => {
    doc.addPage();
    y = margin;

    // Section header
    addPageHeader(doc, `${String(idx + 1).padStart(2, '0')}. ${section.title}`);
    y = 48;

    // Icon + description
    doc.setFontSize(16);
    doc.setTextColor(...DARK);
    doc.text(section.icon, margin, y);
    y += 10;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    const descLines = doc.splitTextToSize(section.description, contentWidth);
    doc.text(descLines, margin, y);
    y += descLines.length * 6 + 8;

    // Features box
    doc.setFillColor(245, 245, 250);
    const boxHeight = section.features.length * 8 + 16;
    doc.roundedRect(margin, y, contentWidth, boxHeight, 3, 3, 'F');

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...ACCENT);
    doc.text('Funcionalidades:', margin + 8, y + 10);
    y += 18;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...DARK);
    section.features.forEach((feat) => {
      doc.setFillColor(...ACCENT);
      doc.circle(margin + 10, y - 1.2, 1.5, 'F');
      doc.text(feat, margin + 16, y);
      y += 8;
    });

    // Footer
    addPageFooter(doc, idx + 3);
  });

  // ===== FINAL PAGE =====
  doc.addPage();
  doc.setFillColor(...DARK);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  doc.setFillColor(...ACCENT);
  doc.rect(0, pageHeight - 6, pageWidth, 6, 'F');

  doc.setTextColor(...WHITE);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('Obrigado!', pageWidth / 2, pageHeight / 2 - 20, { align: 'center' });

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 180, 200);
  doc.text('ConLicitação – Sua plataforma completa', pageWidth / 2, pageHeight / 2, { align: 'center' });
  doc.text('para licitações públicas', pageWidth / 2, pageHeight / 2 + 8, { align: 'center' });

  doc.setFontSize(10);
  doc.setTextColor(140, 140, 160);
  doc.text('suporte@conlicitacao.com.br', pageWidth / 2, pageHeight / 2 + 30, { align: 'center' });

  doc.save('ConLicitacao-Guia-Completo.pdf');
}

function addPageHeader(doc: jsPDF, title: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(...ACCENT);
  doc.rect(0, 0, pageWidth, 3, 'F');

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  doc.text(title, 20, 30);

  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(0.5);
  doc.line(20, 35, pageWidth - 20, 35);
}

function addPageFooter(doc: jsPDF, pageNum: number) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 180);
  doc.text('ConLicitação – Guia Completo da Plataforma', 20, pageHeight - 10);
  doc.text(`Página ${pageNum}`, pageWidth - 20, pageHeight - 10, { align: 'right' });
}
