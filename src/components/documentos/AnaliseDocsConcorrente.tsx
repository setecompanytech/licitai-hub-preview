import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Upload, FileText, Loader2, X, Search,
  FileArchive, Scale, Download, BookOpen
} from 'lucide-react';
import { toast } from 'sonner';
import { streamAIChat, type ChatMessage } from '@/lib/ai-stream';
import ReactMarkdown from 'react-markdown';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { extractTextFromBlob } from '@/lib/pdf-text-extractor';

type ArquivoUpload = {
  id: string;
  nome: string;
  tamanho: number;
  file: File;
};

const SYSTEM_CONTEXT = `Voce e um perito em analise juridico-contabil de licitacoes publicas brasileiras, com dominio absoluto da Lei 14.133/2021, LC 123/2006, CF/88 Art. 37, Decreto 11.462/2023 e jurisprudencia consolidada do TCU.

DIRETRIZES DE FORMATACAO OBRIGATORIAS:

1. NAO utilize emojis, emoticons, figurinhas, icones ou simbolos decorativos em hipotese alguma.
2. NAO utilize saudacoes, apresentacoes de IA ou frases como "Claro!", "Com certeza!", "Vou analisar".
3. Linguagem estritamente tecnica, formal e impessoal, em terceira pessoa.
4. NAO utilize tabelas Markdown. Apresente todas as informacoes em formato de lista estruturada com paragrafos.
5. Cada subitem (a, b, c, d, e) deve ocupar uma linha propria, separada por quebra de linha.
6. Entre cada secao numerada (1., 2., 3.) deve haver uma linha em branco de separacao.
7. Entre cada subitem (a, b, c) deve haver uma linha em branco de separacao.
8. Status de conformidade devem ser apresentados em negrito: **CONFORME**, **NAO CONFORME**, **RESSALVA**, **AUSENTE**, **NAO VERIFICAVEL**.
9. Separe secoes com titulos em negrito e numeracao.
10. Cite SEMPRE os artigos aplicaveis da Lei 14.133/2021 entre parenteses.
11. Cada paragrafo deve conter uma ideia completa, com redacao fluida e coerente, evitando frases telegraficas.
12. Utilize negrito para destacar termos tecnicos e nomes de documentos na primeira mencao.

REGRAS CRITICAS DE ANALISE:

- LEIA e INTERPRETE integralmente o conteudo textual de cada documento enviado.
- Para cada documento identificado, transcreva o NOME EXATO do documento conforme consta no cabecalho ou titulo do arquivo.
- Extraia e cite dados especificos: numeros de CNPJ, datas de validade, nomes de signatarios, valores contabeis, numeros de processos.
- Identifique a NATUREZA de cada documento (certidao, atestado, balanco, declaracao, contrato social, procuracao, etc.).
- Verifique a VALIDADE temporal de cada certidao em relacao a data provavel de abertura do certame.
- Quando houver dados numericos (balanco patrimonial, indices financeiros), CALCULE e apresente os indices com a formula utilizada.
- NAO INVENTE informacoes. Se o conteudo de um documento nao pode ser lido, classifique como **NAO VERIFICAVEL**.
- Se um documento exigido pelo edital NAO foi encontrado entre os documentos enviados, classifique como **AUSENTE** com a fundamentacao legal.

ESTRUTURA OBRIGATORIA DO RELATORIO:

**RELATORIO DE ANALISE JURIDICO-CONTABIL**

Iniciar com um paragrafo introdutorio de contextualizacao, indicando o objeto da analise, o processo licitatorio vinculado (se informado), a legislacao de referencia e o resultado objetivo preliminar.

**1. INVENTARIO DE DOCUMENTOS IDENTIFICADOS**

Listar cada documento em formato estruturado, um por linha, com a seguinte formatacao:

a) **[Nome do Documento conforme consta no arquivo]** — Tipo: [Certidao/Atestado/Balanco/etc.] — Emissao: [data se identificada] — Validade: [data se identificada] — Status: **[CONFORME/NAO CONFORME/RESSALVA/AUSENTE/NAO VERIFICAVEL]** — [Observacao fundamentada com dados extraidos do documento]

b) [proximo documento...]

E assim sucessivamente para CADA documento identificado nos arquivos enviados.

**2. HABILITACAO JURIDICA (Art. 66)**

a) **Ato constitutivo ou contrato social:** redigir paragrafo completo sobre registro, atualizacao, compatibilidade do objeto social com o certame. Transcrever o objeto social identificado e confrontar com o objeto da licitacao.

b) **Qualificacao dos socios e poderes de representacao:** redigir paragrafo sobre identificacao dos socios (nomes e CPFs se identificados), clausula de administracao e poderes.

c) **Procuracao:** redigir paragrafo sobre existencia, poderes especificos para licitacoes, identificacao do outorgante e outorgado com nomes.

**3. REGULARIDADE FISCAL E TRABALHISTA (Art. 68)**

Analisar individualmente cada certidao em subitem separado, informando dados concretos extraidos:

a) **CND Federal (RFB/PGFN):** informar se foi apresentada, CNPJ constante, data de emissao, data de validade, e se abrange contribuicoes previdenciarias. Status: **[CONFORME/NAO CONFORME/AUSENTE]**.

b) **CRF/FGTS:** informar se foi apresentado, data de emissao, data de validade, situacao de regularidade. Status: **[CONFORME/NAO CONFORME/AUSENTE]**.

c) **CNDT (Justica do Trabalho):** informar se foi apresentada, CNPJ consultado, data de emissao, data de validade. Status: **[CONFORME/NAO CONFORME/AUSENTE]**.

d) **Certidoes Estaduais e Municipais:** informar quais foram identificadas, orgaos emissores, datas de validade. Status: **[CONFORME/NAO CONFORME/AUSENTE]**.

e) **Certidoes vencidas:** redigir paragrafo indicando expressamente se foram ou nao identificadas certidoes com validade expirada, informando a data de validade e a data provavel de abertura do certame.

**4. QUALIFICACAO TECNICA (Art. 67)**

a) **Atestados de capacidade tecnica:** informar quantos foram identificados, orgaos ou empresas emissoras, objetos atestados, quantitativos e se sao compativeis com o objeto licitado.

b) **Licencas e registros:** informar se foram identificados alvaras, licencas sanitarias, registros profissionais, com seus numeros e validades.

c) **Equipe tecnica:** informar se ha vinculo dos responsaveis tecnicos com a licitante e registros profissionais identificados.

**5. QUALIFICACAO ECONOMICO-FINANCEIRA (Art. 69)**

a) **Balanco patrimonial:** informar o exercicio social a que se refere, se esta registrado, valores de Ativo Circulante, Passivo Circulante, Ativo Total, Passivo Nao Circulante, Realizavel a Longo Prazo e Patrimonio Liquido extraidos do documento.

b) **Indices financeiros:** calcular cada indice com a formula e os valores extraidos do balanco:

- **Liquidez Corrente (LC):** AC / PC = [valor calculado]. Exigido pelo edital: [valor se informado]. Status: **[CONFORME/NAO CONFORME]**.

- **Liquidez Geral (LG):** (AC + RLP) / (PC + PNC) = [valor calculado]. Exigido pelo edital: [valor se informado]. Status: **[CONFORME/NAO CONFORME]**.

- **Solvencia Geral (SG):** AT / (PC + PNC) = [valor calculado]. Exigido pelo edital: [valor se informado]. Status: **[CONFORME/NAO CONFORME]**.

c) **Patrimonio Liquido:** informar o valor extraido do balanco e confrontar com o valor minimo exigido no edital, se aplicavel.

d) **Certidao Negativa de Falencia e Recuperacao Judicial:** informar se foi apresentada, comarca, data de emissao e validade.

**6. ANALISE CONTABIL DETALHADA**

a) Redigir paragrafo sobre coerencia entre os valores contabeis extraidos: Ativo Circulante, Passivo Circulante, Ativo Total e Passivo Total.

b) Redigir paragrafo sobre ausencia de notas explicativas, quando exigiveis.

c) Redigir paragrafo sobre quaisquer divergencias contabeis identificadas com fundamentacao tecnica.

**7. DECLARACOES OBRIGATORIAS (Art. 63, par. 1)**

Listar cada declaracao exigida em subitem separado:

a) **[Nome da Declaracao]:** Apresentada: [Sim/Nao]. Assinada: [Sim/Nao]. Status: **[CONFORME/AUSENTE]**.

**8. INCONSISTENCIAS E IRREGULARIDADES**

Para cada irregularidade detectada, apresentar em subitem separado com paragrafos completos:

a) **Documento:** [nome do documento conforme identificado]
**Irregularidade:** [descricao objetiva e detalhada, com transcricao dos dados que evidenciam a irregularidade]
**Fundamentacao Legal:** [artigo(s), inciso(s) e paragrafo(s) da Lei 14.133/2021]
**Consequencia juridica:** [inabilitacao, diligencia (Art. 64) ou saneamento]
**Classificacao:** [falha sanavel (Art. 64, par. 1) ou insanavel]
**Recomendacao processual:** [recurso administrativo, contrarrazao ou impugnacao, com o prazo legal aplicavel]

**9. QUADRO RESUMO DE CONFORMIDADE**

Listar cada requisito habilitatorio em subitem separado:

a) **[Requisito]:** Exigencia: [transcricao da exigencia do edital]. Documento apresentado: [nome]. Situacao: **[status]**. Fundamentacao: [artigo].

**10. CONCLUSAO E RECOMENDACOES**

a) Redigir paragrafo de sintese das irregularidades identificadas, segregando entre sanaveis e insanaveis, com contagem total.

b) Redigir paragrafo com a tese recursal, indicando os artigos aplicaveis e a estrategia processual recomendada.

c) Redigir paragrafo com recomendacao objetiva: se cabivel recurso (Art. 165), contrarrazao (Art. 165, par. 1) ou pedido de diligencia (Art. 64), indicando o prazo legal.

REGRAS ADICIONAIS:

- Se o EDITAL foi fornecido, CRUZE cada exigencia habilitatoria do edital com os documentos apresentados, indicando expressamente quais foram atendidas e quais nao, transcrevendo o item do edital e o documento correspondente.
- Se algum documento exigido no edital nao foi apresentado, classifique como **AUSENTE** com fundamentacao no artigo aplicavel e transcricao do item editalicio violado.
- Se o conteudo de um documento nao pode ser verificado (arquivo binario ou ilegivel), classifique como **NAO VERIFICAVEL** e recomende analise manual.
- NAO invente informacoes. Baseie-se exclusivamente no conteudo extraido dos documentos.
- Cada paragrafo deve ser redigido de forma completa, coerente e fluida, como um parecer tecnico profissional.
- NAO utilize frases telegraficas ou listas sem contexto. Cada subitem deve conter uma analise substancial com dados concretos.
- Priorize a objetividade e a rastreabilidade de cada conclusao aos dados extraidos.`;

type Licitacao = {
  id: string;
  numero: string;
  objeto: string;
  orgao: string;
  modalidade: string;
};

export default function AnaliseDocsConcorrente() {
  const [arquivos, setArquivos] = useState<ArquivoUpload[]>([]);
  const [editalFile, setEditalFile] = useState<ArquivoUpload | null>(null);
  const [observacoes, setObservacoes] = useState('');
  const [analisando, setAnalisando] = useState(false);
  const [resultado, setResultado] = useState('');
  const [progressMsg, setProgressMsg] = useState('');
  const [licitacoes, setLicitacoes] = useState<Licitacao[]>([]);
  const [licitacaoSelecionada, setLicitacaoSelecionada] = useState<string>('');
  const fileRef = useRef<HTMLInputElement>(null);
  const editalRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchLicitacoes = async () => {
      const { data } = await supabase
        .from('licitacoes')
        .select('id, numero, objeto, orgao, modalidade')
        .order('created_at', { ascending: false });
      if (data) setLicitacoes(data);
    };
    fetchLicitacoes();
  }, []);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const handleAddFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const novos: ArquivoUpload[] = [];
    for (const f of Array.from(files)) {
      const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();
      if (!['.pdf', '.zip'].includes(ext)) {
        toast.error(`Formato não suportado: ${f.name}. Use PDF ou ZIP.`);
        continue;
      }
      if (f.size > 150 * 1024 * 1024) {
        toast.error(`Arquivo muito grande: ${f.name}. Máximo 150MB.`);
        continue;
      }
      novos.push({
        id: crypto.randomUUID(),
        nome: f.name,
        tamanho: f.size,
        file: f,
      });
    }
    setArquivos(prev => [...prev, ...novos]);
    e.target.value = '';
  };

  const handleAddEdital = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!['.pdf', '.docx'].includes(ext)) {
      toast.error('O edital deve ser um arquivo PDF ou DOCX.');
      return;
    }
    if (file.size > 150 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 150MB.');
      return;
    }

    setEditalFile({
      id: crypto.randomUUID(),
      nome: file.name,
      tamanho: file.size,
      file,
    });
    e.target.value = '';
    toast.success('Edital anexado com sucesso!');
  };

  const handleRemove = (id: string) => {
    setArquivos(prev => prev.filter(a => a.id !== id));
  };

  /** Extract text from a single file using the real PDF/DOCX extractor */
  const extractFileText = async (file: File, nome: string): Promise<{ name: string; text: string }[]> => {
    const results: { name: string; text: string }[] = [];

    try {
      if (nome.toLowerCase().endsWith('.zip')) {
        const { default: JSZip } = await import('jszip');
        const zip = await JSZip.loadAsync(file);
        const entries = Object.entries(zip.files);

        for (const [entryName, entry] of entries) {
          if (entry.dir) continue;

          const lowerName = entryName.toLowerCase();
          try {
            if (lowerName.endsWith('.pdf') || lowerName.endsWith('.docx') || lowerName.endsWith('.doc')) {
              const blob = new Blob([await entry.async('arraybuffer')]);
              const text = await extractTextFromBlob(blob, entryName, 150);
              if (text && text.length > 30) {
                results.push({ name: entryName, text });
              } else {
                results.push({ name: entryName, text: '[Documento sem conteudo textual extraivel — recomenda-se analise manual]' });
              }
            } else if (lowerName.endsWith('.txt') || lowerName.endsWith('.csv') || lowerName.endsWith('.xml')) {
              const text = await entry.async('text');
              if (text && text.length > 30) {
                results.push({ name: entryName, text: text.slice(0, 15000) });
              }
            } else {
              results.push({ name: entryName, text: '[Arquivo binario — formato nao suportado para extracao textual]' });
            }
          } catch {
            results.push({ name: entryName, text: '[Erro na extracao — documento possivelmente protegido ou corrompido]' });
          }
        }
      } else {
        const text = await extractTextFromBlob(file, nome, 150);
        if (text && text.length > 30) {
          results.push({ name: nome, text });
        } else {
          results.push({ name: nome, text: '[Documento sem conteudo textual extraivel — recomenda-se analise manual]' });
        }
      }
    } catch {
      results.push({ name: nome, text: '[Nao foi possivel ler o conteudo do documento]' });
    }

    return results;
  };

  const handleAnalisar = async () => {
    if (arquivos.length === 0) {
      toast.error('Adicione pelo menos um documento para análise.');
      return;
    }

    setAnalisando(true);
    setResultado('');
    setProgressMsg('Extraindo texto dos documentos...');

    // Extract text from competitor documents using real PDF extractor
    const allDocs: { name: string; text: string }[] = [];
    for (let i = 0; i < arquivos.length; i++) {
      setProgressMsg(`Extraindo texto: ${arquivos[i].nome} (${i + 1}/${arquivos.length})...`);
      const extracted = await extractFileText(arquivos[i].file, arquivos[i].nome);
      allDocs.push(...extracted);
    }

    // Extract edital text if provided
    let editalTexto = '';
    if (editalFile) {
      setProgressMsg('Extraindo texto do edital...');
      const editalExtracted = await extractFileText(editalFile.file, editalFile.nome);
      editalTexto = editalExtracted.map(d => `[${d.name}]:\n${d.text}`).join('\n\n');
    }

    setProgressMsg('Enviando para análise pela IA...');

    const listaArquivos = allDocs.map(d => `- ${d.name}`).join('\n');

    const licInfo = licitacaoSelecionada && licitacaoSelecionada !== 'none'
      ? licitacoes.find(l => l.id === licitacaoSelecionada)
      : null;

    const docsContent = allDocs.map(d => `=== DOCUMENTO: ${d.name} ===\n${d.text}`).join('\n\n---SEPARADOR---\n\n');

    const context = `LISTA COMPLETA DE DOCUMENTOS DO CONCORRENTE IDENTIFICADOS:
${listaArquivos}

${licInfo ? `PROCESSO LICITATORIO VINCULADO:\n- Numero: ${licInfo.numero}\n- Modalidade: ${licInfo.modalidade}\n- Orgao: ${licInfo.orgao}\n- Objeto: ${licInfo.objeto}\n` : ''}
${editalTexto ? `\n========================================\nEDITAL DA LICITACAO (INSTRUMENTO CONVOCATORIO) — UTILIZE PARA CRUZAMENTO DE EXIGENCIAS:\n========================================\n${editalTexto}\n========================================\n` : ''}
${observacoes ? `OBSERVACOES ADICIONAIS DO USUARIO:\n${observacoes}\n` : ''}

========================================
CONTEUDO INTEGRAL EXTRAIDO DOS DOCUMENTOS DO CONCORRENTE:
========================================
${docsContent}`;

    const messages: ChatMessage[] = [
      {
        role: 'user',
        content: `Elabore o RELATORIO DE ANALISE JURIDICO-CONTABIL completo dos documentos de habilitacao do concorrente, conforme a estrutura obrigatoria de 10 secoes definida nas instrucoes do sistema.

INSTRUCOES CRITICAS:

1. LEIA INTEGRALMENTE o conteudo textual de CADA documento fornecido abaixo. Extraia dados concretos: nomes, CNPJs, datas, valores, numeros de certidoes.

2. Para cada documento identificado, informe o NOME EXATO conforme consta no cabecalho do documento, a natureza (certidao, atestado, balanco, etc.), a data de emissao/validade e o status de conformidade.

3. Calcule os indices financeiros (LC, LG, SG) com os valores REAIS extraidos do balanco patrimonial, apresentando a formula e os valores utilizados.

4. ${editalTexto ? 'CRUZAMENTO OBRIGATORIO: Para CADA exigencia habilitatoria do edital, verifique se o documento correspondente foi apresentado. Transcreva o item do edital e indique o documento que o atende ou classifique como AUSENTE.' : 'Verifique a conformidade de cada documento com os requisitos da Lei 14.133/2021.'}

5. Identifique TODAS as irregularidades com dados concretos — nao faca afirmacoes genericas. Transcreva o dado que evidencia a irregularidade.

6. Diferencie falhas sanaveis (Art. 64, par. 1) de falhas insanaveis, fundamentando cada classificacao.

7. Na conclusao, apresente a estrategia processual recomendada com o prazo legal aplicavel.

${context}`,
      },
    ];

    await streamAIChat({
      messages,
      action: 'assistente',
      context: SYSTEM_CONTEXT,
      onDelta: (chunk) => {
        setProgressMsg('');
        setResultado(prev => prev + chunk);
      },
      onDone: () => {
        setAnalisando(false);
        setProgressMsg('');
        toast.success('Análise concluída!');
      },
      onError: (err) => {
        toast.error(err);
        setAnalisando(false);
        setProgressMsg('');
      },
    });
  };

  const handleDownloadMD = () => {
    if (!resultado) return;
    const blob = new Blob([resultado], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'relatorio-analise-concorrente.md';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Relatório Markdown baixado!');
  };

  const handleDownloadPDF = async () => {
    if (!resultado) return;
    toast.info('Gerando PDF...');
    try {
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      const marginLeft = 20;
      const marginRight = 20;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const maxWidth = pageWidth - marginLeft - marginRight;
      let y = 25;

      const addPageIfNeeded = (neededHeight: number) => {
        if (y + neededHeight > pageHeight - 20) {
          doc.addPage();
          y = 20;
        }
      };

      // Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('RELATÓRIO DE ANÁLISE JURÍDICO-CONTÁBIL', marginLeft, y);
      y += 8;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`Data de emissão: ${new Date().toLocaleDateString('pt-BR')} — PRAEFECTUS`, marginLeft, y);
      y += 10;

      doc.setDrawColor(200);
      doc.line(marginLeft, y, pageWidth - marginRight, y);
      y += 8;

      // Process content line by line
      const lines = resultado.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();

        if (!trimmed) {
          y += 4;
          continue;
        }

        // Heading detection
        if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
          addPageIfNeeded(10);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(11);
          const headingText = trimmed.replace(/\*\*/g, '');
          const wrapped = doc.splitTextToSize(headingText, maxWidth);
          doc.text(wrapped, marginLeft, y);
          y += wrapped.length * 5 + 4;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          continue;
        }

        if (trimmed.startsWith('## ') || trimmed.startsWith('### ')) {
          addPageIfNeeded(10);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(trimmed.startsWith('## ') ? 11 : 10);
          const headingText = trimmed.replace(/^#{2,3}\s*/, '').replace(/\*\*/g, '');
          const wrapped = doc.splitTextToSize(headingText, maxWidth);
          doc.text(wrapped, marginLeft, y);
          y += wrapped.length * 5 + 4;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          continue;
        }

        // Normal text
        const cleanText = trimmed
          .replace(/\*\*/g, '')
          .replace(/\*/g, '')
          .replace(/^[-•]\s*/, '  • ');

        doc.setFontSize(9);
        const wrapped = doc.splitTextToSize(cleanText, maxWidth);
        addPageIfNeeded(wrapped.length * 4.5);
        doc.text(wrapped, marginLeft, y);
        y += wrapped.length * 4.5 + 1.5;
      }

      // Page numbers
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(150);
        doc.text(`Página ${i} de ${totalPages}`, pageWidth - marginRight, pageHeight - 8, { align: 'right' });
        doc.text('PRAEFECTUS — Análise Jurídico-Contábil', marginLeft, pageHeight - 8);
        doc.setTextColor(0);
      }

      doc.save('relatorio-analise-concorrente.pdf');
      toast.success('Relatório PDF gerado com sucesso!');
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      toast.error('Erro ao gerar PDF.');
    }
  };

  const handleDownloadDOCX = async () => {
    if (!resultado) return;
    toast.info('Gerando documento Word...');
    try {
      const content = `RELATÓRIO DE ANÁLISE JURÍDICO-CONTÁBIL
Data de emissão: ${new Date().toLocaleDateString('pt-BR')} — PRAEFECTUS
${'='.repeat(60)}

${resultado.replace(/\*\*/g, '').replace(/#{2,3}\s*/g, '').replace(/\*/g, '')}

${'='.repeat(60)}
Documento gerado automaticamente pelo sistema PRAEFECTUS.
Este relatório possui finalidade meramente informativa e não substitui parecer jurídico formal.`;

      const blob = new Blob(['\ufeff' + content], { type: 'application/msword;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'relatorio-analise-concorrente.doc';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Relatório Word gerado com sucesso!');
    } catch (err) {
      console.error('Erro ao gerar Word:', err);
      toast.error('Erro ao gerar documento Word.');
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Scale className="w-5 h-5 text-accent" />
        <h3 className="font-semibold text-sm">Análise Jurídico-Contábil de Concorrente</h3>
        <Badge variant="outline" className="text-[10px] bg-accent/10 text-accent border-accent/20">
          Lei 14.133/2021
        </Badge>
      </div>

      <p className="text-xs text-muted-foreground">
        Envie os documentos de habilitação do concorrente e o edital da licitação. A IA realizará a leitura integral dos documentos,
        o cruzamento das exigências editalícias e a análise de conformidade com a Lei 14.133/2021, identificando irregularidades,
        falhas e vícios com fundamentação legal específica.
      </p>

      {/* Seletor de Licitação */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">
          Processo licitatório vinculado (opcional)
        </label>
        <Select value={licitacaoSelecionada} onValueChange={setLicitacaoSelecionada}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione a licitação relacionada..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nenhuma — análise avulsa</SelectItem>
            {licitacoes.map((lic) => (
              <SelectItem key={lic.id} value={lic.id}>
                {lic.numero} — {lic.modalidade} — {lic.orgao}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {licitacaoSelecionada && licitacaoSelecionada !== 'none' && (
          <p className="text-[11px] text-muted-foreground">
            {licitacoes.find(l => l.id === licitacaoSelecionada)?.objeto}
          </p>
        )}
      </div>

      {/* Edital Upload */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5" />
          Edital da Licitação (permite cruzamento de exigências)
        </label>
        {editalFile ? (
          <div className="bg-card rounded-xl border border-accent/30 flex items-center gap-3 px-4 py-3">
            <BookOpen className="w-4 h-4 text-accent shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{editalFile.nome}</p>
              <p className="text-xs text-muted-foreground">{formatSize(editalFile.tamanho)}</p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditalFile(null)}
              className="text-destructive hover:text-destructive"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => editalRef.current?.click()}
            className="w-full border border-dashed border-accent/40 rounded-xl p-4 flex items-center gap-3 hover:border-accent hover:bg-accent/5 transition-colors"
          >
            <Upload className="w-5 h-5 text-accent" />
            <div className="text-left">
              <span className="text-sm font-medium text-foreground block">Anexar Edital (PDF/DOCX)</span>
              <span className="text-[11px] text-muted-foreground">
                A IA cruzará cada exigência do edital com os documentos do concorrente
              </span>
            </div>
          </button>
        )}
        <input
          ref={editalRef}
          type="file"
          accept=".pdf,.docx"
          className="hidden"
          onChange={handleAddEdital}
        />
      </div>

      {/* Upload area - Documentos do concorrente */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">
          Documentos do Concorrente
        </label>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="w-full border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center gap-2 hover:border-accent/50 hover:bg-accent/5 transition-colors"
        >
          <Upload className="w-8 h-8 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">
            Envie documentos do concorrente para análise
          </span>
          <span className="text-xs text-muted-foreground">
            PDF ou ZIP — Máximo 150MB por arquivo
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept=".pdf,.zip"
          className="hidden"
          onChange={handleAddFiles}
        />
      </div>

      {/* File list */}
      {arquivos.length > 0 && (
        <div className="bg-card rounded-xl border border-border/50 divide-y divide-border/30">
          {arquivos.map((arq) => (
            <div key={arq.id} className="flex items-center gap-3 px-4 py-3">
              {arq.nome.endsWith('.zip') ? (
                <FileArchive className="w-4 h-4 text-accent shrink-0" />
              ) : (
                <FileText className="w-4 h-4 text-accent shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{arq.nome}</p>
                <p className="text-xs text-muted-foreground">{formatSize(arq.tamanho)}</p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleRemove(arq.id)}
                className="text-destructive hover:text-destructive"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Observations */}
      {arquivos.length > 0 && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            Observações adicionais (opcional) — Ex: nº do edital, modalidade, requisitos específicos
          </label>
          <Textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Ex: Pregão Eletrônico 001/2026 – exige Liquidez Corrente mínima de 1,5 e atestado com 50% do quantitativo..."
            rows={3}
          />
        </div>
      )}

      {/* Analyze button */}
      {arquivos.length > 0 && (
        <Button
          onClick={handleAnalisar}
          disabled={analisando}
          className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
        >
          {analisando ? (
            <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Analisando documentos com IA...</>
          ) : (
            <><Search className="w-4 h-4 mr-2" /> Analisar Documentos ({arquivos.length} arquivo{arquivos.length > 1 ? 's' : ''}{editalFile ? ' + Edital' : ''})</>
          )}
        </Button>
      )}

      {/* Results */}
      {resultado && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h4 className="text-sm font-semibold">Relatório de Análise Jurídico-Contábil</h4>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={handleDownloadPDF}>
                <Download className="w-3 h-3 mr-1" /> PDF
              </Button>
              <Button size="sm" variant="outline" onClick={handleDownloadDOCX}>
                <Download className="w-3 h-3 mr-1" /> Word
              </Button>
              <Button size="sm" variant="ghost" onClick={handleDownloadMD}>
                <Download className="w-3 h-3 mr-1" /> .md
              </Button>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border/50 p-5 max-h-[600px] overflow-y-auto prose prose-sm dark:prose-invert max-w-none prose-p:mb-4 prose-li:mb-2 prose-headings:mt-6 prose-headings:mb-3 prose-ul:my-3 prose-ol:my-3 [&_br]:block [&_br]:mb-2">
            <ReactMarkdown>{resultado}</ReactMarkdown>
          </div>
        </div>
      )}

      {analisando && !resultado && (
        <div className="bg-card rounded-xl border border-border/50 p-8 flex flex-col items-center gap-3 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
          <p className="text-sm font-medium">{progressMsg || 'Analisando documentos...'}</p>
          <p className="text-xs text-muted-foreground">
            A IA está realizando leitura integral dos documentos, extração de dados concretos e análise
            de conformidade com a Lei 14.133/2021{editalFile ? ' e cruzamento com o edital' : ''}.
          </p>
        </div>
      )}
    </div>
  );
}
