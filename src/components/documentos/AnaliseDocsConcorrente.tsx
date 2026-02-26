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

const SYSTEM_CONTEXT = `Você é um especialista em análise jurídico-contábil de licitações públicas brasileiras, com profundo conhecimento da Lei 14.133/2021 (Nova Lei de Licitações e Contratos Administrativos).

Ao receber documentos do concorrente, produza um RELATÓRIO TÉCNICO DETALHADO com a seguinte estrutura obrigatória:

## 📋 RELATÓRIO DE ANÁLISE JURÍDICO-CONTÁBIL

### 1. 📂 INVENTÁRIO DE DOCUMENTOS IDENTIFICADOS
Liste TODOS os documentos encontrados dentro do(s) arquivo(s) enviados, com:
- **Nº** | **Nome do Documento** | **Tipo** (Certidão, Atestado, Balanço, Declaração, etc.) | **Status** (✅ Conforme / ⚠️ Ressalva / ❌ Irregular / ❓ Não verificável)
- Apresentar em formato de tabela para fácil visualização.

### 2. HABILITAÇÃO JURÍDICA (Art. 66)
- Ato Constitutivo / Contrato Social: registrado, atualizado, objeto social compatível, sócios qualificados.
- Procuração (se houver): poderes específicos para licitações.

### 3. REGULARIDADE FISCAL E TRABALHISTA (Art. 68)
- CND Federal, CRF/FGTS, CNDT, Certidões Estaduais/Municipais: validade, autenticidade, CNPJ correto.
- Apontar certidões vencidas ou com prazo expirado na data de abertura.

### 4. QUALIFICAÇÃO TÉCNICA (Art. 67)
- Atestados de Capacidade Técnica: quantitativos mínimos, emissor idôneo, registro CREA/CAU.
- CAT – Certidão de Acervo Técnico: compatibilidade com o objeto.
- Vínculo dos responsáveis técnicos com a empresa.

### 5. QUALIFICAÇÃO ECONÔMICO-FINANCEIRA (Art. 69)
- Balanço Patrimonial: último exercício, registrado, índices (LG, LC, SG) conforme edital.
- Certidão Negativa de Falência/Recuperação Judicial: validade e comarca.

### 6. ANÁLISE CONTÁBIL DETALHADA
- Verificar índices financeiros apresentados vs. exigidos no edital.
- Calcular Liquidez Geral, Liquidez Corrente e Solvência Geral com base nos dados do balanço.
- Patrimônio Líquido mínimo exigido vs. apresentado.
- Apontar divergências contábeis ou ausência de notas explicativas quando exigíveis.

### 7. DECLARAÇÕES OBRIGATÓRIAS (Art. 63, §1º)
- Verificar se todas foram apresentadas e assinadas.

### 8. ⚠️ INCONSISTÊNCIAS E IRREGULARIDADES
Para cada inconsistência:
- **Documento:** nome
- **Irregularidade:** descrição detalhada
- **Fundamentação Legal:** artigo da Lei 14.133/2021
- **Consequência:** inabilitação, diligência, saneamento ou esclarecimento
- **Recomendação:** recurso administrativo, contrarrazão ou impugnação

### 9. 📊 QUADRO RESUMO DE CONFORMIDADE
Tabela resumo: Documento | Exigência do Edital | Situação | Observação

### 10. 📝 CONCLUSÃO E RECOMENDAÇÕES PARA RECURSO
- Resumo das irregularidades
- Tese recursal com artigos aplicáveis
- Falhas sanáveis vs. insanáveis (Art. 64, §1º)

IMPORTANTE:
- Se o EDITAL foi fornecido, CRUZE cada exigência do edital com os documentos apresentados.
- Cite SEMPRE os artigos da Lei 14.133/2021.
- Se algum documento não foi apresentado, indique como AUSÊNCIA DOCUMENTAL com fundamentação.
- Se algum documento não pode ser verificado (PDF binário), indique como "❓ Não verificável — recomenda-se análise manual".`;

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
        content: `Realize uma ANÁLISE JURÍDICO-CONTÁBIL completa dos documentos do concorrente abaixo conforme a Lei 14.133/2021.

INSTRUÇÕES OBRIGATÓRIAS:
1. Liste TODOS os documentos identificados dentro dos arquivos enviados em formato de tabela com status de conformidade.
2. Para cada documento, verifique se está de acordo com as exigências legais e do edital (se fornecido).
3. Identifique TODAS as inconsistências, irregularidades, documentos vencidos, ausentes ou em desconformidade.
4. Faça a análise contábil dos índices financeiros quando houver balanço patrimonial.
5. Gere um relatório técnico completo para fundamentar recursos administrativos e contrarrazões.
${editalTexto ? '\n6. CRUZE cada exigência do edital com os documentos apresentados, indicando se foi atendida ou não.' : ''}

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
              <AlertTriangle className="w-4 h-4 text-warning" />
              <h4 className="text-sm font-semibold">Relatório de Análise Jurídico-Contábil</h4>
            </div>
            <Button size="sm" variant="outline" onClick={handleDownloadRelatorio}>
              <Download className="w-3 h-3 mr-1" /> Baixar .md
            </Button>
          </div>

          <div className="bg-card rounded-xl border border-border/50 p-5 max-h-[600px] overflow-y-auto prose prose-sm dark:prose-invert max-w-none">
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
