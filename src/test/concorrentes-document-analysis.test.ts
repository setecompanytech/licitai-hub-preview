import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import ExcelJS from 'exceljs';
import {
  buildDocumentEvidence,
  extractDocumentsFromUpload,
} from '@/lib/concorrentes-document-analysis';

describe('concorrentes document analysis helpers', () => {
  it('extracts literal validity and emission from an alvara text', () => {
    const evidence = buildDocumentEvidence({
      name: '8.5.2 - ALVARA DE FUNCIONAMENTO.pdf',
      text: `ALVARÁ ELETRÔNICO 2026\nLOCALIZAÇÃO E FUNCIONAMENTO\nCNPJ 61.342.683/0001-50\nData de Emissão 03/03/2026\nVÁLIDO ATÉ 10/03/2027`,
    });

    expect(evidence.label).toBe('ALVARA DE FUNCIONAMENTO');
    expect(evidence.type).toBe('Alvará / Licença de Funcionamento');
    expect(evidence.emissionDate).toBe('03/03/2026');
    expect(evidence.validityDate).toBe('10/03/2027');
    expect(evidence.validityLine).toContain('VÁLIDO ATÉ 10/03/2027');
  });

  it('preserves the file label and detects atestado type', () => {
    const evidence = buildDocumentEvidence({
      name: 'ATESTADO - VISEU.pdf',
      text: `PREFEITURA MUNICIPAL DE VISEU\nATESTADO DE CAPACIDADE TÉCNICA\nPeríodo: 11/12/2025\nViseu/PA, 23 de Janeiro de 2026`,
    });

    expect(evidence.label).toBe('ATESTADO - VISEU');
    expect(evidence.type).toBe('Atestado de Capacidade Técnica');
    expect(evidence.relevantSnippets.some((line) => line.includes('ATESTADO DE CAPACIDADE TÉCNICA'))).toBe(true);
  });

  it('detects explicit emission and does not confuse placeholders with issuance data', () => {
    const evidence = buildDocumentEvidence({
      name: 'ALVARA ELETRONICO 2025.pdf',
      text: `ALVARÁ ELETRÔNICO 2025\nData de Emissão: 10/03/2025\nHorário especial XXXXXXX\nData de Abertura: 17/06/2025\nProtocolo 00023151/2025\nVÁLIDO ATÉ 10/03/2026`,
    });

    expect(evidence.emissionDate).toBe('10/03/2025');
    expect(evidence.validityDate).toBe('10/03/2026');
    expect(evidence.registrationDate).toBe('17/06/2025');
    expect(evidence.emissionLine).toContain('Data de Emissão: 10/03/2025');
    expect(evidence.dateAnchors.some((anchor) => anchor.kind === 'protocolo' && anchor.line.includes('00023151/2025'))).toBe(true);
  });

  it('reads documents recursively inside nested zip files', async () => {
    const innerZip = new JSZip();
    innerZip.file('doc-interno.txt', 'ALVARÁ\nData de Emissão 03/03/2026\nVÁLIDO ATÉ 10/03/2027');
    const innerZipBuffer = await innerZip.generateAsync({ type: 'arraybuffer' });

    const outerZip = new JSZip();
    outerZip.file('pasta/documentos.zip', innerZipBuffer);
    const outerZipBuffer = await outerZip.generateAsync({ type: 'arraybuffer' });

    const zipFile = new File([outerZipBuffer], 'concorrente.zip', {
      type: 'application/zip',
    });

    const documents = await extractDocumentsFromUpload(zipFile, zipFile.name);

    expect(documents).toHaveLength(1);
    expect(documents[0].name).toContain('doc-interno.txt');
    expect(documents[0].text).toContain('VÁLIDO ATÉ 10/03/2027');
  });

  it('extracts readable text from xlsx spreadsheets', async () => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([
      ['Documento', 'Emissão', 'Validade'],
      ['CNPJ', '02/02/2026', 'Não aplicável'],
    ]);

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Habilitação');
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const file = new File([buffer], 'habilitacao.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const documents = await extractDocumentsFromUpload(file, file.name);

    expect(documents).toHaveLength(1);
    expect(documents[0].text).toContain('Planilha: Habilitação');
    expect(documents[0].text).toContain('Linha 2: CNPJ | 02/02/2026 | Não aplicável');
  });
});