import { extractTextFromBlob } from '@/lib/pdf-text-extractor';

export type ExtractedAnalysisDocument = {
  name: string;
  text: string;
};

export type AnalysisLicitacaoInfo = {
  numero: string;
  modalidade: string;
  orgao: string;
  objeto: string;
};

export type DocumentEvidence = {
  label: string;
  type: string;
  heading: string;
  emissionDate: string | null;
  validityDate: string | null;
  cnpj: string | null;
  emissionLine: string | null;
  validityLine: string | null;
  relevantSnippets: string[];
  excerpt: string;
};

const MAX_ZIP_DEPTH = 3;
const TEXT_PREVIEW_LIMIT = 4200;
const RELEVANT_SNIPPETS_LIMIT = 8;
const CONTEXT_DOCUMENT_LIMIT = 36;
const EDITAL_SECTION_LIMIT = 18000;
const CONTEXT_TOTAL_LIMIT = 180000;

const KEY_LINE_PATTERNS = [
  /v[aá]lid[oa]?\s+at[eé]/i,
  /validade/i,
  /vig[eê]ncia/i,
  /vencimento/i,
  /data\s+de\s+emiss[aã]o/i,
  /emitid[ao]/i,
  /cnpj/i,
  /cpf/i,
  /objeto/i,
  /per[ií]odo/i,
  /nota\s+fiscal/i,
  /atestado/i,
  /alvar[aá]/i,
  /licen[cç]a/i,
  /certid[aã]o/i,
  /fal[eê]ncia/i,
  /fgts/i,
  /trabalhista/i,
  /municipal/i,
  /estadual/i,
  /sanit[aá]ri/i,
];

function sanitizeText(text: string) {
  return text.replace(/\u0000/g, '').replace(/\r/g, '').trim();
}

function collapseWhitespace(text: string) {
  return sanitizeText(text).replace(/\s+/g, ' ').trim();
}

function splitMeaningfulLines(text: string) {
  return sanitizeText(text)
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function getExtension(name: string) {
  const normalized = name.toLowerCase();
  const index = normalized.lastIndexOf('.');
  return index >= 0 ? normalized.slice(index) : '';
}

function humanizeDocumentLabel(name: string) {
  const raw = name.split('/').pop() || name;
  return raw
    .replace(/\.[^.]+$/, '')
    .replace(/^\s*\d+(?:\.\d+)*\s*[-–—]\s*/u, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeDate(value: string | null) {
  if (!value) return null;
  const match = value.match(/\b(\d{2})[\/.\-](\d{2})[\/.\-](\d{4})\b/);
  return match ? `${match[1]}/${match[2]}/${match[3]}` : null;
}

function extractLiteralLine(text: string, patterns: RegExp[]) {
  const lines = splitMeaningfulLines(text);
  return lines.find((line) => patterns.some((pattern) => pattern.test(line))) ?? null;
}

function extractDateByPattern(text: string, patterns: RegExp[]) {
  const compact = collapseWhitespace(text);
  for (const pattern of patterns) {
    const match = compact.match(pattern);
    const captured = match?.[1] || match?.[0] || null;
    const normalized = normalizeDate(captured);
    if (normalized) return normalized;
  }
  return null;
}

function detectDocumentType(text: string, fileName: string) {
  const sample = `${humanizeDocumentLabel(fileName)} ${collapseWhitespace(text).slice(0, 1500)}`.toLowerCase();
  if (sample.includes('atestado de capacidade')) return 'Atestado de Capacidade Técnica';
  if (sample.includes('alvar') || sample.includes('localização e funcionamento') || sample.includes('localizacao e funcionamento')) {
    return 'Alvará / Licença de Funcionamento';
  }
  if (sample.includes('sanitari')) return 'Licença / Documento Sanitário';
  if (sample.includes('cndt')) return 'Certidão Trabalhista';
  if (sample.includes('fgts') || sample.includes('crf')) return 'Certidão de Regularidade do FGTS';
  if (sample.includes('falencia')) return 'Certidão de Falência e Recuperação Judicial';
  if (sample.includes('balan')) return 'Balanço / Documento Contábil';
  if (sample.includes('contrato social')) return 'Contrato Social';
  if (sample.includes('certid')) return 'Certidão';
  if (sample.includes('declar')) return 'Declaração';
  if (sample.includes('cnpj')) return 'Comprovante Cadastral';
  return 'Documento de Habilitação';
}

function chooseHeading(text: string, label: string) {
  const lines = splitMeaningfulLines(text);
  const preferred = lines
    .slice(0, 8)
    .filter((line) => line.length >= 6 && line.length <= 110)
    .slice(0, 3);

  return preferred.length > 0 ? preferred.join(' | ') : label;
}

function collectRelevantSnippets(text: string) {
  const snippets: string[] = [];
  const seen = new Set<string>();

  for (const line of splitMeaningfulLines(text)) {
    if (!KEY_LINE_PATTERNS.some((pattern) => pattern.test(line))) continue;
    const cleaned = line.slice(0, 220);
    if (seen.has(cleaned)) continue;
    seen.add(cleaned);
    snippets.push(cleaned);
    if (snippets.length >= RELEVANT_SNIPPETS_LIMIT) break;
  }

  return snippets;
}

function buildExcerpt(text: string) {
  return sanitizeText(text).slice(0, TEXT_PREVIEW_LIMIT);
}

function buildDocDedupKey(doc: ExtractedAnalysisDocument) {
  const normalizedName = humanizeDocumentLabel(doc.name).toLowerCase();
  const normalizedText = collapseWhitespace(doc.text).slice(0, 1200);
  return `${normalizedName}|${normalizedText}|${doc.text.length}`;
}

function dedupeDocuments(documents: ExtractedAnalysisDocument[]) {
  const seen = new Set<string>();

  return documents.filter((doc) => {
    const key = buildDocDedupKey(doc);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildDocumentEvidence(document: ExtractedAnalysisDocument): DocumentEvidence {
  const label = humanizeDocumentLabel(document.name);
  const emissionPatterns = [
    /data\s+de\s+emiss[aã]o\s*(?:[:\-]|\b)\s*(\d{2}[\/.\-]\d{2}[\/.\-]\d{4})/i,
    /emitid[ao]\s+em\s*(\d{2}[\/.\-]\d{2}[\/.\-]\d{4})/i,
    /emiss[aã]o\s*(?:[:\-]|\b)\s*(\d{2}[\/.\-]\d{2}[\/.\-]\d{4})/i,
  ];
  const validityPatterns = [
    /v[aá]lid[oa]?\s+at[eé]\s*(\d{2}[\/.\-]\d{2}[\/.\-]\d{4})/i,
    /data\s+de\s+validade\s*(?:[:\-]|\b)\s*(\d{2}[\/.\-]\d{2}[\/.\-]\d{4})/i,
    /validade\s*(?:[:\-]|\b)\s*(\d{2}[\/.\-]\d{2}[\/.\-]\d{4})/i,
    /vig[eê]ncia\s*(?:[:\-]|\b)\s*(\d{2}[\/.\-]\d{2}[\/.\-]\d{4})/i,
    /vencimento\s*(?:[:\-]|\b)\s*(\d{2}[\/.\-]\d{2}[\/.\-]\d{4})/i,
  ];

  return {
    label,
    type: detectDocumentType(document.text, document.name),
    heading: chooseHeading(document.text, label),
    emissionDate: extractDateByPattern(document.text, emissionPatterns),
    validityDate: extractDateByPattern(document.text, validityPatterns),
    cnpj: collapseWhitespace(document.text).match(/\b\d{2}\.?\d{3}\.?\d{3}\/\d{4}-?\d{2}\b/)?.[0] ?? null,
    emissionLine: extractLiteralLine(document.text, [/data\s+de\s+emiss[aã]o/i, /emitid[ao]/i, /emiss[aã]o/i]),
    validityLine: extractLiteralLine(document.text, [/v[aá]lid[oa]?\s+at[eé]/i, /validade/i, /vig[eê]ncia/i, /vencimento/i]),
    relevantSnippets: collectRelevantSnippets(document.text),
    excerpt: buildExcerpt(document.text),
  };
}

async function readSupportedBlob(blob: Blob, name: string) {
  const ext = getExtension(name);

  if (['.txt', '.csv', '.xml'].includes(ext)) {
    return sanitizeText(await blob.text());
  }

  if (['.pdf', '.docx', '.doc'].includes(ext)) {
    return sanitizeText(await extractTextFromBlob(blob, name, 150));
  }

  return '';
}

async function extractZipBlob(
  blob: Blob,
  zipName: string,
  depth = 0,
): Promise<ExtractedAnalysisDocument[]> {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(blob);
  const documents: ExtractedAnalysisDocument[] = [];
  const entries = Object.values(zip.files).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  for (const entry of entries) {
    if (entry.dir) continue;

    const entryExt = getExtension(entry.name);
    const qualifiedName = `${zipName.replace(/\.[^.]+$/, '')}/${entry.name}`;

    if (entryExt === '.zip') {
      if (depth >= MAX_ZIP_DEPTH) {
        documents.push({
          name: qualifiedName,
          text: '[Arquivo ZIP interno não processado por exceder o limite de profundidade. Classificar como NÃO VERIFICÁVEL.]',
        });
        continue;
      }

      try {
        const nestedBytes = await entry.async('uint8array');
        const nestedBlob = new Blob([nestedBytes], { type: 'application/zip' });
        const nestedDocuments = await extractZipBlob(nestedBlob, qualifiedName, depth + 1);
        documents.push(...nestedDocuments);
      } catch {
        documents.push({
          name: qualifiedName,
          text: '[Não foi possível abrir o ZIP interno. Classificar como NÃO VERIFICÁVEL.]',
        });
      }

      continue;
    }

    if (!['.pdf', '.doc', '.docx', '.txt', '.csv', '.xml'].includes(entryExt)) continue;

    try {
      const contentBytes = await entry.async('uint8array');
      const contentBlob = new Blob([contentBytes]);
      const text = await readSupportedBlob(contentBlob, entry.name);
      documents.push({
        name: qualifiedName,
        text: text || '[Documento sem conteúdo textual extraível. Classificar como NÃO VERIFICÁVEL.]',
      });
    } catch {
      documents.push({
        name: qualifiedName,
        text: '[Erro na extração do documento. Classificar como NÃO VERIFICÁVEL.]',
      });
    }
  }

  return dedupeDocuments(documents);
}

export async function extractDocumentsFromUpload(file: File, name = file.name): Promise<ExtractedAnalysisDocument[]> {
  const ext = getExtension(name);

  if (ext === '.zip') {
    return extractZipBlob(file, name);
  }

  try {
    const text = await readSupportedBlob(file, name);
    return [{
      name,
      text: text || '[Documento sem conteúdo textual extraível. Classificar como NÃO VERIFICÁVEL.]',
    }];
  } catch {
    return [{
      name,
      text: '[Não foi possível ler o conteúdo do documento. Classificar como NÃO VERIFICÁVEL.]',
    }];
  }
}

function extractEditalHabilitacaoSection(editalTexto: string) {
  const cleaned = sanitizeText(editalTexto);
  if (!cleaned) return '';

  const sectionMatch = cleaned.match(/(?:^|\n)(?:9\.|8\.|10\.)\s*DA\s+FASE\s+DE\s+HABILITAÇÃO[\s\S]{0,18000}?(?=\n\s*(?:10\.|11\.|12\.)\s+)/i);
  if (sectionMatch?.[0]) return sectionMatch[0].slice(0, EDITAL_SECTION_LIMIT);

  return cleaned.slice(0, EDITAL_SECTION_LIMIT);
}

function collectEditalRequirementLines(editalTexto: string) {
  return splitMeaningfulLines(editalTexto)
    .filter((line) => /habilita|atestado|alvar|certid|balan|fal[eê]ncia|fgts|cndt|regularidade|qualifica/i.test(line))
    .slice(0, 24);
}

export function buildConcorrenteAnalysisContext({
  documents,
  editalTexto,
  licInfo,
  observacoes,
}: {
  documents: ExtractedAnalysisDocument[];
  editalTexto?: string;
  licInfo?: AnalysisLicitacaoInfo | null;
  observacoes?: string;
}) {
  const documentBlocks = dedupeDocuments(documents)
    .slice(0, CONTEXT_DOCUMENT_LIMIT)
    .map((document, index) => {
      const evidence = buildDocumentEvidence(document);
      return [
        `[DOCUMENTO ${String(index + 1).padStart(2, '0')}]`,
        `Arquivo original: ${document.name}`,
        `Rótulo preferencial do item: ${evidence.label}`,
        `Tipo sugerido: ${evidence.type}`,
        `Cabeçalho relevante: ${evidence.heading}`,
        `Emissão identificada: ${evidence.emissionDate ?? 'Não identificada'}`,
        `Validade identificada: ${evidence.validityDate ?? 'Não identificada'}`,
        `CNPJ identificado: ${evidence.cnpj ?? 'Não identificado'}`,
        `Linha literal de emissão: ${evidence.emissionLine ?? 'Não identificada'}`,
        `Linha literal de validade: ${evidence.validityLine ?? 'Não identificada'}`,
        'Trechos literais prioritários:',
        ...(evidence.relevantSnippets.length > 0
          ? evidence.relevantSnippets.map((snippet) => `- ${snippet}`)
          : ['- Nenhum trecho-chave automático localizado.']),
        'Trecho fiel do documento:',
        evidence.excerpt,
        `[FIM_DOCUMENTO ${String(index + 1).padStart(2, '0')}]`,
      ].join('\n');
    })
    .join('\n\n');

  const editalSection = editalTexto ? extractEditalHabilitacaoSection(editalTexto) : '';
  const editalLines = editalTexto ? collectEditalRequirementLines(editalTexto) : [];

  const context = [
    'ANÁLISE DOCUMENTAL DO CONCORRENTE — CONTEXTO ESTRUTURADO',
    '',
    licInfo
      ? [
          'PROCESSO LICITATÓRIO VINCULADO:',
          `- Número: ${licInfo.numero}`,
          `- Modalidade: ${licInfo.modalidade}`,
          `- Órgão: ${licInfo.orgao}`,
          `- Objeto: ${licInfo.objeto}`,
        ].join('\n')
      : 'PROCESSO LICITATÓRIO VINCULADO: não informado.',
    '',
    observacoes ? `OBSERVAÇÕES DO USUÁRIO:\n${observacoes}` : 'OBSERVAÇÕES DO USUÁRIO: nenhuma.',
    '',
    editalTexto
      ? [
          'EDITAL — TRECHOS PRIORITÁRIOS PARA O CRUZAMENTO:',
          ...(editalLines.length > 0 ? editalLines.map((line) => `- ${line}`) : ['- Nenhum trecho-chave automático localizado.']),
          '',
          'EDITAL — RECORTE DA SEÇÃO DE HABILITAÇÃO:',
          editalSection,
        ].join('\n')
      : 'EDITAL: não fornecido. A análise deve se limitar aos documentos anexados e à Lei nº 14.133/2021.',
    '',
    'DOCUMENTOS DO CONCORRENTE — LEITURA INDIVIDUAL COM ÂNCORAS:',
    documentBlocks,
  ]
    .filter(Boolean)
    .join('\n');

  return context.slice(0, CONTEXT_TOTAL_LIMIT);
}

export function buildConcorrenteAnalysisUserMessage(hasEdital: boolean) {
  return `Elabore o RELATÓRIO DE ANÁLISE JURÍDICO-CONTÁBIL completo com 10 seções obrigatórias e com fidelidade estrita aos documentos fornecidos.

REGRAS DECISIVAS DE FIDELIDADE:
1. Analise um [DOCUMENTO XX] por vez. É proibido transportar datas, CNPJs, status ou observações de um documento para outro.
2. No inventário documental, use como título principal o campo “Rótulo preferencial do item”.
3. O item 1 do relatório deve seguir EXATAMENTE este padrão hierárquico:
   a) NOME DO DOCUMENTO
     a.1) Tipo: ...
     a.2) Emissão: ...
     a.3) Validade: ...
     a.4) Status: **CONFORME/NAO CONFORME/RESSALVA/AUSENTE/NAO VERIFICAVEL**
     a.5) Fundamentação: ...
4. Só informe data de emissão ou validade quando houver correspondência literal no texto do documento ou nas linhas literais já destacadas no contexto.
5. Quando houver expressão como “VÁLIDO ATÉ”, “DATA DE EMISSÃO”, “VALIDADE” ou “VIGÊNCIA”, reproduza a data exatamente como encontrada. Não deduza validade pelo ano do arquivo, pelo ano do cabeçalho ou por padrão do órgão emissor.
6. Se um campo não estiver legível ou não existir no documento, escreva “Não identificada”, “Indeterminada” ou **NAO VERIFICAVEL**, conforme o caso.
7. Em cada conclusão relevante, cite o trecho literal que fundamenta a afirmação.
8. ${hasEdital ? 'CRUZAMENTO OBRIGATÓRIO: transcreva a exigência do edital, identifique o documento correspondente e aponte precisamente conformidade, ausência, falha sanável ou vício insanável.' : 'Como não há edital, limite o confronto à Lei nº 14.133/2021 e deixe claro quando a conclusão depende de exigência editalícia não fornecida.'}
9. Não use tabelas markdown. Mantenha espaçamento limpo com uma linha em branco entre cada item e subitem.
10. Redija em português brasileiro formal, técnico, auditável e sem frases genéricas.`;
}