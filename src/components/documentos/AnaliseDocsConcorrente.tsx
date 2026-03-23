import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Upload, FileText, Loader2, X, Search, AlertTriangle,
  FileArchive, Scale, Download, BookOpen
} from 'lucide-react';
import { toast } from 'sonner';
import { streamAIChat, type ChatMessage } from '@/lib/ai-stream';
import ReactMarkdown from 'react-markdown';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type ArquivoUpload = {
  id: string;
  nome: string;
  tamanho: number;
  file: File;
};

const SYSTEM_CONTEXT = `Voce e um perito em analise juridico-contabil de licitacoes publicas brasileiras, com dominio absoluto da Lei 14.133/2021.

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

ESTRUTURA OBRIGATORIA DO RELATORIO:

**RELATORIO DE ANALISE JURIDICO-CONTABIL**

Iniciar com um paragrafo introdutorio de contextualizacao, indicando o objeto da analise, o processo licitatorio vinculado (se informado), a legislacao de referencia e o resultado objetivo preliminar.

**1. INVENTARIO DE DOCUMENTOS IDENTIFICADOS**

Listar cada documento em formato estruturado, um por linha, com a seguinte formatacao:

a) **[Nome do Documento]** — Tipo: [Certidao/Atestado/Balanco/etc.] — Status: **[CONFORME/NAO CONFORME/RESSALVA/AUSENTE/NAO VERIFICAVEL]** — [Observacao fundamentada]

b) **[Nome do Documento]** — Tipo: [tipo] — Status: **[status]** — [Observacao]

E assim sucessivamente para cada documento identificado.

**2. HABILITACAO JURIDICA (Art. 66)**

Analisar em subitens separados por linha em branco:

a) **Ato constitutivo ou contrato social:** redigir paragrafo completo sobre registro, atualizacao, compatibilidade do objeto social com o certame.

b) **Qualificacao dos socios e poderes de representacao:** redigir paragrafo sobre identificacao dos socios, clausula de administracao e poderes.

c) **Procuracao:** redigir paragrafo sobre existencia, poderes especificos para licitacoes, identificacao do outorgante e outorgado.

**3. REGULARIDADE FISCAL E TRABALHISTA (Art. 68)**

Analisar individualmente cada certidao em subitem separado:

a) **CND Federal (RFB/PGFN):** redigir paragrafo sobre apresentacao, validade, CNPJ correto e abrangencia previdenciaria.

b) **CRF/FGTS:** redigir paragrafo sobre apresentacao, validade e autenticidade.

c) **CNDT (Justica do Trabalho):** redigir paragrafo sobre apresentacao, validade e orgao emissor.

d) **Certidoes Estaduais e Municipais:** redigir paragrafo sobre presenca, tipos identificados e validade.

e) **Certidoes vencidas:** redigir paragrafo indicando expressamente se foram ou nao identificadas certidoes vencidas na data de abertura do certame.

**4. QUALIFICACAO TECNICA (Art. 67)**

a) **Atestados de capacidade tecnica:** redigir paragrafo sobre quantitativos minimos, emissor idoneo, objeto compativel, municipios de execucao.

b) **Licencas e registros sanitarios:** redigir paragrafo sobre alvaras, relatorios de inspecao e demais exigencias setoriais, quando aplicavel.

c) **Equipe tecnica:** redigir paragrafo sobre vinculo dos responsaveis tecnicos com a licitante e registros profissionais.

**5. QUALIFICACAO ECONOMICO-FINANCEIRA (Art. 69)**

a) **Balanco patrimonial:** redigir paragrafo sobre ultimo exercicio social, registro na Junta Comercial, tipo de balanco (abertura, exercicio, livro diario).

b) **Indices financeiros:** listar cada indice em subitem separado com a formula, o valor apurado, o valor exigido no edital e o status. Exemplo:

- **Liquidez Corrente (LC):** AC / PC = [valor]. Exigido: [valor]. Status: **CONFORME**.
- **Liquidez Geral (LG):** (AC + RLP) / (PC + PNC) = [valor]. Exigido: [valor]. Status: **CONFORME**.
- **Solvencia Geral (SG):** AT / (PC + PNC) = [valor]. Exigido: [valor]. Status: **CONFORME**.

c) **Patrimonio Liquido:** redigir paragrafo sobre valor apresentado versus exigido.

d) **Certidao Negativa de Falencia e Recuperacao Judicial:** redigir paragrafo sobre validade e comarca.

**6. ANALISE CONTABIL DETALHADA**

a) Redigir paragrafo sobre coerencia entre Ativo Circulante, Passivo Circulante, Ativo Total e Passivo Total.

b) Redigir paragrafo sobre ausencia de notas explicativas, quando exigiveis.

c) Redigir paragrafo sobre divergencias contabeis com fundamentacao tecnica.

**7. DECLARACOES OBRIGATORIAS (Art. 63, par. 1)**

Listar cada declaracao exigida em subitem separado:

a) **[Nome da Declaracao]:** Apresentada: [Sim/Nao]. Assinada: [Sim/Nao]. Status: **[CONFORME/AUSENTE]**.

**8. INCONSISTENCIAS E IRREGULARIDADES**

Para cada irregularidade detectada, apresentar em subitem separado com paragrafos:

a) **Documento:** [nome do documento]
**Irregularidade:** [descricao objetiva e detalhada em paragrafo completo]
**Fundamentacao Legal:** [artigo(s) da Lei 14.133/2021]
**Consequencia juridica:** [inabilitacao, diligencia (Art. 64) ou saneamento]
**Classificacao:** [falha sanavel (Art. 64, par. 1) ou insanavel]
**Recomendacao processual:** [recurso administrativo, contrarrazao ou impugnacao]

**9. QUADRO RESUMO DE CONFORMIDADE**

Listar cada requisito habilitatorio em subitem separado:

a) **[Requisito]:** Exigencia: [descricao]. Documento apresentado: [nome]. Situacao: **[status]**. Fundamentacao: [artigo].

**10. CONCLUSAO E RECOMENDACOES**

a) Redigir paragrafo de sintese das irregularidades identificadas, segregando entre sanaveis e insanaveis.

b) Redigir paragrafo com a tese recursal, indicando os artigos aplicaveis.

c) Redigir paragrafo com recomendacao objetiva: se cabivel recurso, contrarrazao ou pedido de diligencia.

REGRAS ADICIONAIS:

- Se o EDITAL foi fornecido, CRUZE cada exigencia habilitatoria do edital com os documentos apresentados, indicando expressamente quais foram atendidas e quais nao.
- Se algum documento exigido no edital nao foi apresentado, classifique como **AUSENTE** com fundamentacao no artigo aplicavel.
- Se o conteudo de um documento nao pode ser verificado (arquivo binario ou ilegivel), classifique como **NAO VERIFICAVEL** e recomende analise manual.
- NAO invente informacoes. Baseie-se exclusivamente no conteudo extraido dos documentos.
- Cada paragrafo deve ser redigido de forma completa, coerente e fluida, como um parecer tecnico profissional.
- NAO utilize frases telegraficas ou listas sem contexto. Cada subitem deve conter uma analise substancial.
- Priorize a objetividade e a rastreabilidade de cada conclusao.`;

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
    if (ext !== '.pdf') {
      toast.error('O edital deve ser um arquivo PDF.');
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

  const extractFileText = async (file: File, nome: string): Promise<string[]> => {
    const textos: string[] = [];
    try {
      if (nome.toLowerCase().endsWith('.zip')) {
        const { default: JSZip } = await import('jszip');
        const zip = await JSZip.loadAsync(file);
        const entries = Object.entries(zip.files);
        for (const [name, entry] of entries) {
          if (!entry.dir && name.toLowerCase().endsWith('.pdf')) {
            textos.push(`[Arquivo ZIP > ${name}]: Documento PDF encontrado no arquivo compactado.`);
          } else if (!entry.dir) {
            try {
              const text = await entry.async('text');
              if (text && text.length > 50) {
                textos.push(`[Arquivo ZIP > ${name}]:\n${text.slice(0, 8000)}`);
              }
            } catch {
              textos.push(`[Arquivo ZIP > ${name}]: Arquivo binário (não textual).`);
            }
          }
        }
      } else {
        const text = await file.text();
        textos.push(`[${nome}]:\n${text.slice(0, 12000)}`);
      }
    } catch {
      textos.push(`[${nome}]: Não foi possível ler o conteúdo.`);
    }
    return textos;
  };

  const handleAnalisar = async () => {
    if (arquivos.length === 0) {
      toast.error('Adicione pelo menos um documento para análise.');
      return;
    }

    setAnalisando(true);
    setResultado('');

    // Extract text from competitor documents
    const textos: string[] = [];
    for (const arq of arquivos) {
      const extracted = await extractFileText(arq.file, arq.nome);
      textos.push(...extracted);
    }

    // Extract edital text if provided
    let editalTexto = '';
    if (editalFile) {
      const editalExtracted = await extractFileText(editalFile.file, editalFile.nome);
      editalTexto = editalExtracted.join('\n\n');
    }

    const listaArquivos = arquivos.map(a => `- ${a.nome} (${formatSize(a.tamanho)})`).join('\n');

    const licInfo = licitacaoSelecionada && licitacaoSelecionada !== 'none'
      ? licitacoes.find(l => l.id === licitacaoSelecionada)
      : null;

    const context = `DOCUMENTOS DO CONCORRENTE PARA ANÁLISE:
${listaArquivos}

${licInfo ? `PROCESSO LICITATÓRIO VINCULADO:\n- Número: ${licInfo.numero}\n- Modalidade: ${licInfo.modalidade}\n- Órgão: ${licInfo.orgao}\n- Objeto: ${licInfo.objeto}\n` : ''}
${editalTexto ? `EDITAL DA LICITAÇÃO (para cruzamento de exigências):\n${editalTexto}\n` : ''}
${observacoes ? `OBSERVAÇÕES ADICIONAIS DO USUÁRIO:\n${observacoes}\n` : ''}
CONTEÚDO EXTRAÍDO DOS DOCUMENTOS DO CONCORRENTE:
${textos.join('\n\n---\n\n')}`;

    const messages: ChatMessage[] = [
      {
        role: 'user',
        content: `Elabore o RELATORIO DE ANALISE JURIDICO-CONTABIL dos documentos de habilitacao do concorrente conforme a estrutura obrigatoria definida nas instrucoes do sistema.

Requisitos adicionais:
a) Identifique e catalogue todos os documentos contidos nos arquivos enviados, mesmo que estejam dentro de arquivos compactados.
b) Classifique cada documento com status textual (CONFORME, NAO CONFORME, RESSALVA, AUSENTE, NAO VERIFICAVEL).
c) Apresente os indices financeiros em tabela quando houver balanco patrimonial.
d) Fundamente cada conclusao com o artigo aplicavel da Lei 14.133/2021.
e) Diferencie falhas sanaveis (Art. 64, par. 1) de falhas insanaveis.
${editalTexto ? 'f) Realize o cruzamento sistematico entre cada exigencia habilitatoria do edital e os documentos apresentados, indicando expressamente o atendimento ou nao de cada requisito.' : ''}

${context}`,
      },
    ];

    await streamAIChat({
      messages,
      action: 'assistente',
      context: SYSTEM_CONTEXT,
      onDelta: (chunk) => {
        setResultado(prev => prev + chunk);
      },
      onDone: () => {
        setAnalisando(false);
        toast.success('Análise concluída!');
      },
      onError: (err) => {
        toast.error(err);
        setAnalisando(false);
      },
    });
  };

  const handleDownloadRelatorio = () => {
    if (!resultado) return;
    const blob = new Blob([resultado], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'relatorio-analise-concorrente.md';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Relatório baixado!');
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
        Envie os documentos de habilitação do concorrente e o edital da licitação. A IA fará o cruzamento das exigências,
        listando cada documento identificado e seu status de conformidade com a Lei 14.133/2021.
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
          Edital da Licitação (opcional — permite cruzamento de exigências)
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
              <span className="text-sm font-medium text-foreground block">Anexar Edital (PDF)</span>
              <span className="text-[11px] text-muted-foreground">
                A IA cruzará as exigências do edital com os documentos do concorrente
              </span>
            </div>
          </button>
        )}
        <input
          ref={editalRef}
          type="file"
          accept=".pdf"
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
          <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold">Relatorio de Analise Juridico-Contabil</h4>
            </div>
            <Button size="sm" variant="outline" onClick={handleDownloadRelatorio}>
              <Download className="w-3 h-3 mr-1" /> Baixar .md
            </Button>
          </div>

          <div className="bg-card rounded-xl border border-border/50 p-5 max-h-[600px] overflow-y-auto prose prose-sm dark:prose-invert max-w-none prose-p:mb-4 prose-li:mb-2 prose-headings:mt-6 prose-headings:mb-3 prose-ul:my-3 prose-ol:my-3 [&_br]:block [&_br]:mb-2">
            <ReactMarkdown>{resultado}</ReactMarkdown>
          </div>
        </div>
      )}

      {analisando && !resultado && (
        <div className="bg-card rounded-xl border border-border/50 p-8 flex flex-col items-center gap-3 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
          <p className="text-sm font-medium">Analisando documentos...</p>
          <p className="text-xs text-muted-foreground">
            A IA está realizando análise jurídico-contábil, verificando conformidade com a Lei 14.133/2021,
            listando documentos identificados e cruzando com as exigências{editalFile ? ' do edital' : ' legais'}.
          </p>
        </div>
      )}
    </div>
  );
}
