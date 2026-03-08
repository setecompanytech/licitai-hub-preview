/**
 * Modalidades de Licitação – Lei 14.133/2021 (Nova Lei de Licitações)
 * Fonte: TCU, Justen Advogados, Lei 14.133/2021
 */

export interface EtapaProcesso {
  ordem: number;
  nome: string;
  descricao: string;
  fundamentacao: string;
}

export interface ModalidadeLicitacao {
  id: string;
  nome: string;
  fundamentacao: string;
  descricao: string;
  objetoAplicavel: string;
  objetoNaoAplicavel?: string;
  criteriosJulgamento: {
    id: string;
    nome: string;
    fundamentacao: string;
    descricao: string;
    obrigatorio?: boolean;
  }[];
  modosDisputa: {
    id: string;
    nome: string;
    fundamentacao: string;
    descricao: string;
    padrao?: boolean;
  }[];
  preferenciaMeEpp: {
    aplicavel: boolean;
    descricao: string;
    fundamentacao: string;
    beneficios: string[];
  };
  etapas: EtapaProcesso[];
  formaRealizacao: string;
  prazosMinimos: string;
  observacoes?: string;
}

export const MODALIDADES: ModalidadeLicitacao[] = [
  {
    id: 'pregao',
    nome: 'Pregão Eletrônico',
    fundamentacao: 'Art. 6º, XLI e Art. 29 da Lei 14.133/2021',
    descricao: 'Modalidade obrigatória para aquisição de bens e serviços comuns, incluindo serviços comuns de engenharia, cujo padrão de qualidade pode ser objetivamente definido pelo edital.',
    objetoAplicavel: 'Bens comuns, serviços comuns e serviços comuns de engenharia',
    objetoNaoAplicavel: 'Obras, serviços especiais de engenharia e serviços técnicos de natureza predominantemente intelectual',
    criteriosJulgamento: [
      { id: 'menor_preco', nome: 'Menor Preço', fundamentacao: 'Art. 33, I', descricao: 'Critério padrão do pregão. Vence o licitante com menor preço ou lance mais baixo.', obrigatorio: true },
      { id: 'maior_desconto', nome: 'Maior Desconto', fundamentacao: 'Art. 33, II', descricao: 'Lances em percentual de desconto sobre preço máximo fixado. Orçamento não pode ser sigiloso.' },
    ],
    modosDisputa: [
      { id: 'aberto', nome: 'Aberto', fundamentacao: 'Art. 56, I', descricao: 'Lances públicos e sucessivos, decrescentes. Modo padrão.', padrao: true },
      { id: 'aberto_fechado', nome: 'Aberto e Fechado', fundamentacao: 'Art. 56, III', descricao: 'Fase de lances abertos seguida de proposta fechada dos melhores classificados.' },
      { id: 'fechado_aberto', nome: 'Fechado e Aberto', fundamentacao: 'Art. 56, IV', descricao: 'Propostas fechadas seguidas de lances abertos dos melhores classificados.' },
    ],
    preferenciaMeEpp: {
      aplicavel: true,
      descricao: 'Tratamento diferenciado e favorecido obrigatório para ME/EPP conforme LC 123/2006.',
      fundamentacao: 'LC 123/2006, Art. 44 e 45; Lei 14.133/2021, Art. 4º',
      beneficios: [
        'Empate ficto: ME/EPP com proposta até 5% superior ao melhor preço pode cobrir oferta (Art. 44, §1º LC 123)',
        'Prazo de 5 minutos para cobrir a proposta (Art. 45 LC 123)',
        'Regularização fiscal: prazo de 5 dias úteis para regularização de documentação fiscal (Art. 43, §1º LC 123)',
        'Licitação exclusiva para ME/EPP em contratações até R$ 80.000,00 (Art. 48, I LC 123)',
        'Subcontratação obrigatória de ME/EPP em até 30% do objeto (Art. 48, II LC 123)',
        'Cota reservada de até 25% do objeto para ME/EPP (Art. 48, III LC 123)',
      ],
    },
    etapas: [
      { ordem: 1, nome: 'Fase Preparatória / Planejamento', descricao: 'ETP, TR, pesquisa de preços, designação do pregoeiro e equipe de apoio', fundamentacao: 'Art. 18 a 27' },
      { ordem: 2, nome: 'Publicação do Edital', descricao: 'Divulgação no PNCP, DOE/DOU e jornal de grande circulação. Prazo mínimo: 8 dias úteis (menor preço/maior desconto)', fundamentacao: 'Art. 54 e 55' },
      { ordem: 3, nome: 'Impugnação e Esclarecimento', descricao: 'Impugnação até 3 dias úteis antes da abertura. Esclarecimentos até 3 dias úteis antes', fundamentacao: 'Art. 164' },
      { ordem: 4, nome: 'Abertura da Sessão e Classificação de Propostas', descricao: 'Análise de conformidade das propostas com o edital. Desclassificação de propostas inexequíveis', fundamentacao: 'Art. 59' },
      { ordem: 5, nome: 'Fase de Lances', descricao: 'Envio de lances por meio do sistema eletrônico. Modo aberto (padrão): lances sucessivos decrescentes', fundamentacao: 'Art. 56 e 57' },
      { ordem: 6, nome: 'Negociação', descricao: 'Pregoeiro negocia com o primeiro classificado para obter condições mais vantajosas', fundamentacao: 'Art. 61' },
      { ordem: 7, nome: 'Verificação da Conformidade', descricao: 'Análise da aceitabilidade da proposta e exame de amostra/prova de conceito quando exigido', fundamentacao: 'Art. 59, §2º' },
      { ordem: 8, nome: 'Habilitação', descricao: 'Verificação dos documentos de habilitação do vencedor (jurídica, técnica, fiscal, econômico-financeira)', fundamentacao: 'Art. 62 a 70' },
      { ordem: 9, nome: 'Benefícios ME/EPP', descricao: 'Aplicação do empate ficto (5%) e prazo para regularização fiscal', fundamentacao: 'LC 123/2006, Art. 44-45' },
      { ordem: 10, nome: 'Fase Recursal', descricao: 'Intenção de recurso manifestada imediatamente. Prazo de 3 dias úteis para razões recursais', fundamentacao: 'Art. 165' },
      { ordem: 11, nome: 'Adjudicação', descricao: 'Pregoeiro adjudica o objeto ao vencedor (quando sem recurso)', fundamentacao: 'Art. 71' },
      { ordem: 12, nome: 'Homologação', descricao: 'Autoridade competente homologa o procedimento e autoriza a contratação', fundamentacao: 'Art. 71' },
    ],
    formaRealizacao: 'Preferencialmente eletrônico (Art. 17, §2º)',
    prazosMinimos: '8 dias úteis (menor preço/maior desconto)',
  },
  {
    id: 'concorrencia',
    nome: 'Concorrência Eletrônica',
    fundamentacao: 'Art. 6º, XXXVIII e Art. 29, parágrafo único da Lei 14.133/2021',
    descricao: 'Modalidade para contratação de bens e serviços especiais e de obras e serviços comuns e especiais de engenharia.',
    objetoAplicavel: 'Obras, serviços de engenharia, bens e serviços especiais, serviços técnicos de natureza intelectual',
    criteriosJulgamento: [
      { id: 'menor_preco', nome: 'Menor Preço', fundamentacao: 'Art. 33, I', descricao: 'Aplicável para obras e serviços de engenharia comuns.' },
      { id: 'maior_desconto', nome: 'Maior Desconto', fundamentacao: 'Art. 33, II', descricao: 'Desconto sobre preço máximo fixado pela Administração.' },
      { id: 'melhor_tecnica', nome: 'Melhor Técnica ou Conteúdo Artístico', fundamentacao: 'Art. 33, III', descricao: 'Seleção pela maior nota técnica conforme critérios do edital.' },
      { id: 'tecnica_preco', nome: 'Técnica e Preço', fundamentacao: 'Art. 33, IV e Art. 36', descricao: 'Conjugação de critérios técnicos (até 70% peso) e preço. Para obras, serviços de engenharia, natureza intelectual e TI.' },
      { id: 'maior_retorno', nome: 'Maior Retorno Econômico', fundamentacao: 'Art. 33, VI', descricao: 'Exclusivo para contratos de eficiência. Maior percentual sobre economia gerada.' },
    ],
    modosDisputa: [
      { id: 'aberto', nome: 'Aberto', fundamentacao: 'Art. 56, I', descricao: 'Lances públicos sucessivos. Padrão para menor preço/maior desconto.', padrao: true },
      { id: 'fechado', nome: 'Fechado', fundamentacao: 'Art. 56, II', descricao: 'Propostas em sigilo até a data de divulgação. Obrigatório em técnica e preço (isoladamente).' },
      { id: 'aberto_fechado', nome: 'Aberto e Fechado', fundamentacao: 'Art. 56, III', descricao: 'Combinação: lances abertos seguidos de proposta fechada.' },
      { id: 'fechado_aberto', nome: 'Fechado e Aberto', fundamentacao: 'Art. 56, IV', descricao: 'Combinação: propostas fechadas seguidas de lances abertos.' },
    ],
    preferenciaMeEpp: {
      aplicavel: true,
      descricao: 'Tratamento diferenciado obrigatório, com empate ficto de 10% para concorrência.',
      fundamentacao: 'LC 123/2006, Art. 44, §1º (10% para concorrência); Lei 14.133/2021, Art. 4º',
      beneficios: [
        'Empate ficto: ME/EPP com proposta até 10% superior ao melhor preço pode cobrir oferta',
        'Regularização fiscal: prazo de 5 dias úteis',
        'Licitação exclusiva para ME/EPP em contratações até R$ 80.000,00',
        'Subcontratação obrigatória de ME/EPP em até 30%',
        'Cota reservada de até 25% do objeto',
      ],
    },
    etapas: [
      { ordem: 1, nome: 'Fase Preparatória / Planejamento', descricao: 'ETP, TR/Anteprojeto/Projeto Básico, pesquisa de preços, matriz de riscos', fundamentacao: 'Art. 18 a 27' },
      { ordem: 2, nome: 'Publicação do Edital', descricao: 'PNCP, DOE/DOU. Prazo mínimo: 10 dias úteis (menor preço/maior desconto) ou 25 dias úteis (técnica e preço/melhor técnica)', fundamentacao: 'Art. 55' },
      { ordem: 3, nome: 'Impugnação e Esclarecimento', descricao: 'Impugnação até 3 dias úteis antes. Esclarecimentos até 3 dias úteis antes', fundamentacao: 'Art. 164' },
      { ordem: 4, nome: 'Abertura da Sessão e Classificação', descricao: 'Análise de conformidade, desclassificação de inexequíveis', fundamentacao: 'Art. 59' },
      { ordem: 5, nome: 'Fase de Lances / Propostas', descricao: 'Conforme modo de disputa definido. Possibilidade de lances intermediários', fundamentacao: 'Art. 56 e 57' },
      { ordem: 6, nome: 'Negociação', descricao: 'Comissão negocia com classificados para condições mais vantajosas', fundamentacao: 'Art. 61' },
      { ordem: 7, nome: 'Habilitação', descricao: 'Verificação de habilitação jurídica, técnica, fiscal, social e econômico-financeira', fundamentacao: 'Art. 62 a 70' },
      { ordem: 8, nome: 'Benefícios ME/EPP', descricao: 'Empate ficto (10%) e regularização fiscal', fundamentacao: 'LC 123/2006' },
      { ordem: 9, nome: 'Fase Recursal', descricao: 'Intenção de recurso na sessão. Prazo de 3 dias úteis para razões', fundamentacao: 'Art. 165' },
      { ordem: 10, nome: 'Adjudicação e Homologação', descricao: 'Adjudicação pela comissão e homologação pela autoridade competente', fundamentacao: 'Art. 71' },
    ],
    formaRealizacao: 'Preferencialmente eletrônico (Art. 17, §2º)',
    prazosMinimos: '10 dias úteis (menor preço/maior desconto); 25 dias úteis (técnica e preço/melhor técnica)',
  },
  {
    id: 'concurso',
    nome: 'Concurso',
    fundamentacao: 'Art. 6º, XXXIX e Art. 30 da Lei 14.133/2021',
    descricao: 'Modalidade para escolha de trabalho técnico, científico ou artístico, mediante a instituição de prêmio ou remuneração.',
    objetoAplicavel: 'Projeto técnico, científico ou artístico',
    criteriosJulgamento: [
      { id: 'melhor_tecnica', nome: 'Melhor Técnica ou Conteúdo Artístico', fundamentacao: 'Art. 33, III', descricao: 'Critério obrigatório e exclusivo do concurso.', obrigatorio: true },
    ],
    modosDisputa: [
      { id: 'fechado', nome: 'Fechado', fundamentacao: 'Art. 30', descricao: 'Trabalhos apresentados em sigilo e julgados por comissão especial.' },
    ],
    preferenciaMeEpp: {
      aplicavel: false,
      descricao: 'Não se aplica tratamento diferenciado ME/EPP em concurso, dada a natureza do julgamento por qualidade técnica/artística.',
      fundamentacao: 'LC 123/2006 — aplicação restrita',
      beneficios: [],
    },
    etapas: [
      { ordem: 1, nome: 'Fase Preparatória', descricao: 'Definição do objeto, critérios de qualificação, forma de apresentação e prêmio/remuneração', fundamentacao: 'Art. 30' },
      { ordem: 2, nome: 'Publicação do Edital', descricao: 'Prazo mínimo: 35 dias úteis', fundamentacao: 'Art. 55' },
      { ordem: 3, nome: 'Inscrição e Apresentação dos Trabalhos', descricao: 'Recebimento dos projetos/trabalhos conforme edital', fundamentacao: 'Art. 30' },
      { ordem: 4, nome: 'Julgamento pela Comissão', descricao: 'Comissão especial avalia conforme critérios do edital', fundamentacao: 'Art. 30' },
      { ordem: 5, nome: 'Classificação e Resultado', descricao: 'Divulgação dos classificados e premiação', fundamentacao: 'Art. 30' },
      { ordem: 6, nome: 'Homologação', descricao: 'Autoridade competente homologa o resultado', fundamentacao: 'Art. 71' },
    ],
    formaRealizacao: 'Presencial ou eletrônico',
    prazosMinimos: '35 dias úteis',
  },
  {
    id: 'leilao',
    nome: 'Leilão',
    fundamentacao: 'Art. 6º, XL e Art. 31 da Lei 14.133/2021',
    descricao: 'Modalidade para alienação de bens imóveis ou móveis inservíveis, apreendidos ou penhorados.',
    objetoAplicavel: 'Alienação de bens móveis e imóveis',
    criteriosJulgamento: [
      { id: 'maior_lance', nome: 'Maior Lance', fundamentacao: 'Art. 33, V', descricao: 'Vence quem oferecer o maior valor. Critério exclusivo e obrigatório.', obrigatorio: true },
    ],
    modosDisputa: [
      { id: 'aberto', nome: 'Aberto', fundamentacao: 'Art. 31', descricao: 'Lances sucessivos e crescentes. Modo exclusivo do leilão.', padrao: true },
    ],
    preferenciaMeEpp: {
      aplicavel: false,
      descricao: 'Não se aplica tratamento diferenciado ME/EPP em leilão de alienação.',
      fundamentacao: 'LC 123/2006 — inaplicável',
      beneficios: [],
    },
    etapas: [
      { ordem: 1, nome: 'Fase Preparatória', descricao: 'Avaliação dos bens, definição de preço mínimo e condições de pagamento', fundamentacao: 'Art. 31' },
      { ordem: 2, nome: 'Publicação do Edital', descricao: 'Prazo mínimo: 15 dias úteis', fundamentacao: 'Art. 55' },
      { ordem: 3, nome: 'Visitação', descricao: 'Período para interessados examinarem os bens', fundamentacao: 'Art. 31' },
      { ordem: 4, nome: 'Sessão de Lances', descricao: 'Lances crescentes a partir do preço mínimo. Conduzido por servidor ou leiloeiro oficial', fundamentacao: 'Art. 31' },
      { ordem: 5, nome: 'Arrematação e Pagamento', descricao: 'Arrematante efetua pagamento conforme condições do edital', fundamentacao: 'Art. 31' },
      { ordem: 6, nome: 'Homologação', descricao: 'Autoridade competente homologa', fundamentacao: 'Art. 71' },
    ],
    formaRealizacao: 'Preferencialmente eletrônico (Internet)',
    prazosMinimos: '15 dias úteis',
    observacoes: 'Não há fase de habilitação. Pode ser conduzido por servidor designado ou leiloeiro oficial.',
  },
  {
    id: 'dialogo_competitivo',
    nome: 'Diálogo Competitivo',
    fundamentacao: 'Art. 6º, XLII e Art. 32 da Lei 14.133/2021',
    descricao: 'Modalidade para contratações complexas, quando a Administração não consegue definir previamente a solução técnica mais adequada.',
    objetoAplicavel: 'Contratações que envolvam inovação tecnológica, adaptação de soluções de mercado ou impossibilidade de definir especificações com precisão',
    criteriosJulgamento: [
      { id: 'tecnica_preco', nome: 'Técnica e Preço', fundamentacao: 'Art. 33, IV', descricao: 'Conjugação de nota técnica (até 70%) e preço.' },
      { id: 'melhor_tecnica', nome: 'Melhor Técnica ou Conteúdo Artístico', fundamentacao: 'Art. 33, III', descricao: 'Seleção pela maior nota técnica.' },
      { id: 'menor_preco', nome: 'Menor Preço', fundamentacao: 'Art. 33, I', descricao: 'Após definição da solução técnica, pode-se adotar menor preço.' },
      { id: 'maior_retorno', nome: 'Maior Retorno Econômico', fundamentacao: 'Art. 33, VI', descricao: 'Para contratos de eficiência resultantes do diálogo.' },
    ],
    modosDisputa: [
      { id: 'fechado', nome: 'Fechado', fundamentacao: 'Art. 32', descricao: 'Propostas apresentadas após fase de diálogo.' },
      { id: 'aberto_fechado', nome: 'Aberto e Fechado', fundamentacao: 'Art. 56, III', descricao: 'Combinação possível após regulamentação.' },
    ],
    preferenciaMeEpp: {
      aplicavel: true,
      descricao: 'Aplicável conforme a natureza do objeto e a viabilidade.',
      fundamentacao: 'LC 123/2006; Lei 14.133/2021, Art. 4º',
      beneficios: [
        'Empate ficto conforme modalidade aplicável',
        'Regularização fiscal em 5 dias úteis',
      ],
    },
    etapas: [
      { ordem: 1, nome: 'Fase Preparatória', descricao: 'Definição das necessidades, requisitos mínimos e critérios de pré-seleção', fundamentacao: 'Art. 32' },
      { ordem: 2, nome: 'Publicação do Edital de Pré-Seleção', descricao: 'Divulgação das necessidades e abertura de manifestação de interesse', fundamentacao: 'Art. 32' },
      { ordem: 3, nome: 'Pré-Seleção dos Participantes', descricao: 'Análise das manifestações e seleção dos aptos ao diálogo (mínimo 3)', fundamentacao: 'Art. 32, §1º' },
      { ordem: 4, nome: 'Fase de Diálogo', descricao: 'Reuniões individuais com pré-selecionados para discussão de soluções. Informações são confidenciais', fundamentacao: 'Art. 32, §1º, III' },
      { ordem: 5, nome: 'Definição da Solução Técnica', descricao: 'Administração define a solução técnica com base nos diálogos realizados', fundamentacao: 'Art. 32, §1º, V' },
      { ordem: 6, nome: 'Fase Competitiva', descricao: 'Novo edital com especificações definitivas. Apresentação de propostas finais', fundamentacao: 'Art. 32, §1º, VI' },
      { ordem: 7, nome: 'Habilitação e Julgamento', descricao: 'Análise das propostas e habilitação dos classificados', fundamentacao: 'Art. 62 a 70' },
      { ordem: 8, nome: 'Adjudicação e Homologação', descricao: 'Adjudicação e homologação pela autoridade competente', fundamentacao: 'Art. 71' },
    ],
    formaRealizacao: 'Presencial (fase de diálogo) e eletrônico (fase competitiva)',
    prazosMinimos: '25 dias úteis',
    observacoes: 'Uso restrito a situações de inovação tecnológica ou impossibilidade de definição prévia de especificações. Inspirada na legislação europeia.',
  },
  {
    id: 'dispensa_eletronica',
    nome: 'Dispensa Eletrônica',
    fundamentacao: 'Art. 75 da Lei 14.133/2021; Decreto 11.462/2023',
    descricao: 'Contratação direta com disputa simplificada para valores abaixo dos limites legais ou situações previstas em lei.',
    objetoAplicavel: 'Bens e serviços de engenharia até R$ 116.559,97 (obras até R$ 116.559,97) e bens/serviços em geral até R$ 59.906,02 (valores atualizados pelo IPCA)',
    criteriosJulgamento: [
      { id: 'menor_preco', nome: 'Menor Preço', fundamentacao: 'Art. 75', descricao: 'Critério padrão da dispensa eletrônica.', obrigatorio: true },
      { id: 'maior_desconto', nome: 'Maior Desconto', fundamentacao: 'Art. 75', descricao: 'Desconto sobre preço de referência.' },
    ],
    modosDisputa: [
      { id: 'aberto', nome: 'Aberto', fundamentacao: 'Decreto 11.462/2023', descricao: 'Propostas abertas com possibilidade de lances.', padrao: true },
    ],
    preferenciaMeEpp: {
      aplicavel: true,
      descricao: 'Tratamento diferenciado obrigatório. Dispensas até R$ 80.000,00 são preferencialmente exclusivas para ME/EPP.',
      fundamentacao: 'LC 123/2006, Art. 48, I; Decreto 11.462/2023',
      beneficios: [
        'Exclusividade para ME/EPP em contratações até R$ 80.000,00',
        'Empate ficto de 5%',
        'Regularização fiscal em 5 dias úteis',
      ],
    },
    etapas: [
      { ordem: 1, nome: 'Fase Preparatória', descricao: 'Justificativa da dispensa, TR simplificado, pesquisa de preços (mínimo 3 fontes)', fundamentacao: 'Art. 75' },
      { ordem: 2, nome: 'Publicação do Aviso', descricao: 'Divulgação no PNCP com prazo mínimo de 3 dias úteis', fundamentacao: 'Decreto 11.462/2023' },
      { ordem: 3, nome: 'Recebimento de Propostas', descricao: 'Fornecedores registram propostas no sistema eletrônico', fundamentacao: 'Decreto 11.462/2023' },
      { ordem: 4, nome: 'Fase de Lances', descricao: 'Modo aberto com lances sucessivos por período definido', fundamentacao: 'Decreto 11.462/2023' },
      { ordem: 5, nome: 'Negociação e Habilitação', descricao: 'Negociação com melhor classificado e verificação de habilitação simplificada', fundamentacao: 'Decreto 11.462/2023' },
      { ordem: 6, nome: 'Adjudicação e Homologação', descricao: 'Autoridade adjudica e homologa', fundamentacao: 'Art. 71' },
    ],
    formaRealizacao: 'Exclusivamente eletrônico',
    prazosMinimos: '3 dias úteis',
  },
];

/** Etapas comuns a todas modalidades (Rito Comum - Art. 17) */
export const RITO_COMUM_ETAPAS: EtapaProcesso[] = [
  { ordem: 1, nome: 'Fase Preparatória', descricao: 'Planejamento: ETP, TR, pesquisa de preços, análise de riscos, definição da modalidade e critério', fundamentacao: 'Art. 18' },
  { ordem: 2, nome: 'Divulgação do Edital', descricao: 'Publicação no PNCP e demais meios de divulgação', fundamentacao: 'Art. 54' },
  { ordem: 3, nome: 'Apresentação de Propostas e Lances', descricao: 'Recebimento de propostas e, quando aberto, fase de lances', fundamentacao: 'Art. 55-57' },
  { ordem: 4, nome: 'Julgamento', descricao: 'Classificação conforme critério de julgamento definido', fundamentacao: 'Art. 58-60' },
  { ordem: 5, nome: 'Habilitação', descricao: 'Verificação documental do primeiro classificado', fundamentacao: 'Art. 62-70' },
  { ordem: 6, nome: 'Fase Recursal', descricao: 'Manifestação de intenção recursal e razões/contrarrazões', fundamentacao: 'Art. 165' },
  { ordem: 7, nome: 'Homologação', descricao: 'Autoridade competente homologa o procedimento', fundamentacao: 'Art. 71' },
];

/** Critérios de julgamento consolidados */
export const CRITERIOS_JULGAMENTO = [
  { id: 'menor_preco', nome: 'Menor Preço', artigo: 'Art. 33, I' },
  { id: 'maior_desconto', nome: 'Maior Desconto', artigo: 'Art. 33, II' },
  { id: 'melhor_tecnica', nome: 'Melhor Técnica ou Conteúdo Artístico', artigo: 'Art. 33, III' },
  { id: 'tecnica_preco', nome: 'Técnica e Preço', artigo: 'Art. 33, IV' },
  { id: 'maior_lance', nome: 'Maior Lance', artigo: 'Art. 33, V' },
  { id: 'maior_retorno', nome: 'Maior Retorno Econômico', artigo: 'Art. 33, VI' },
];

/** Modos de disputa consolidados */
export const MODOS_DISPUTA = [
  { id: 'aberto', nome: 'Aberto', artigo: 'Art. 56, I' },
  { id: 'fechado', nome: 'Fechado', artigo: 'Art. 56, II' },
  { id: 'aberto_fechado', nome: 'Aberto e Fechado', artigo: 'Art. 56, III' },
  { id: 'fechado_aberto', nome: 'Fechado e Aberto', artigo: 'Art. 56, IV' },
];
