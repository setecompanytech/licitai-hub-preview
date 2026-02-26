import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Upload, FileText, Loader2, X, Search, AlertTriangle,
  CheckCircle2, FileArchive, Scale, Download
} from 'lucide-react';
import { toast } from 'sonner';
import { streamAIChat, type ChatMessage } from '@/lib/ai-stream';
import ReactMarkdown from 'react-markdown';

type ArquivoUpload = {
  id: string;
  nome: string;
  tamanho: number;
  file: File;
};

const SYSTEM_CONTEXT = `Você é um especialista em análise documental de licitações públicas brasileiras, com profundo conhecimento da Lei 14.133/2021.

Analise MINUCIOSAMENTE cada documento enviado pelo concorrente e produza um RELATÓRIO TÉCNICO DETALHADO com a seguinte estrutura:

## 📋 RELATÓRIO DE ANÁLISE DOCUMENTAL DO CONCORRENTE

### 1. HABILITAÇÃO JURÍDICA (Art. 66)
- Ato Constitutivo / Contrato Social: verificar se está registrado, atualizado, se o objeto social é compatível com o objeto licitado, se os sócios estão devidamente qualificados.
- Procuração (se houver): verificar poderes específicos para representar em licitações.

### 2. REGULARIDADE FISCAL E TRABALHISTA (Art. 68)
- CND Federal, CRF/FGTS, CNDT, Certidões Estaduais e Municipais: verificar validade, autenticidade, se o CNPJ confere com a empresa licitante.
- Apontar certidões vencidas ou com prazo expirado na data de abertura.

### 3. QUALIFICAÇÃO TÉCNICA (Art. 67)
- Atestados de Capacidade Técnica: verificar se os quantitativos atendem ao mínimo exigido no edital, se o emissor é idôneo, se há registro no CREA/CAU quando exigível.
- CAT – Certidão de Acervo Técnico: verificar compatibilidade com o objeto.
- Verificar se os responsáveis técnicos possuem vínculo com a empresa.

### 4. QUALIFICAÇÃO ECONÔMICO-FINANCEIRA (Art. 69)
- Balanço Patrimonial: verificar se é do último exercício social exigível, se está registrado, se os índices (Liquidez Geral, Liquidez Corrente, Solvência Geral) atendem aos mínimos do edital.
- Certidão Negativa de Falência/Recuperação Judicial: verificar validade e comarca.

### 5. DECLARAÇÕES OBRIGATÓRIAS (Art. 63, §1º)
- Verificar se todas as declarações exigidas foram apresentadas e estão assinadas.

### 6. ⚠️ INCONSISTÊNCIAS E IRREGULARIDADES ENCONTRADAS
Para cada inconsistência, informar:
- **Documento:** nome do documento
- **Irregularidade:** descrição detalhada
- **Fundamentação Legal:** artigo da Lei 14.133/2021 ou legislação aplicável
- **Consequência:** inabilitação, diligência, saneamento ou esclarecimento
- **Recomendação:** se cabe recurso administrativo, contrarrazão ou impugnação

### 7. 📝 CONCLUSÃO E RECOMENDAÇÕES PARA RECURSO
- Resumo das irregularidades que fundamentam recurso administrativo
- Sugestão de tese recursal com citação dos artigos aplicáveis
- Indicar se as falhas são sanáveis ou insanáveis (Art. 64, §1º)

Seja EXTREMAMENTE DETALHISTA e TÉCNICO. Cite SEMPRE os artigos da Lei 14.133/2021.
Se algum documento não foi apresentado, indique como AUSÊNCIA com a devida fundamentação.`;

export default function AnaliseDocsConcorrente() {
  const [arquivos, setArquivos] = useState<ArquivoUpload[]>([]);
  const [observacoes, setObservacoes] = useState('');
  const [analisando, setAnalisando] = useState(false);
  const [resultado, setResultado] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

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
      if (f.size > 20 * 1024 * 1024) {
        toast.error(`Arquivo muito grande: ${f.name}. Máximo 20MB.`);
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

  const handleRemove = (id: string) => {
    setArquivos(prev => prev.filter(a => a.id !== id));
  };

  const handleAnalisar = async () => {
    if (arquivos.length === 0) {
      toast.error('Adicione pelo menos um documento para análise.');
      return;
    }

    setAnalisando(true);
    setResultado('');

    // Extract text content from files
    const textos: string[] = [];
    for (const arq of arquivos) {
      try {
        if (arq.nome.toLowerCase().endsWith('.zip')) {
          const { default: JSZip } = await import('jszip');
          const zip = await JSZip.loadAsync(arq.file);
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
          const text = await arq.file.text();
          const clean = text.slice(0, 12000);
          textos.push(`[${arq.nome}]:\n${clean}`);
        }
      } catch {
        textos.push(`[${arq.nome}]: Não foi possível ler o conteúdo.`);
      }
    }

    const listaArquivos = arquivos.map(a => `- ${a.nome} (${formatSize(a.tamanho)})`).join('\n');

    const context = `DOCUMENTOS DO CONCORRENTE PARA ANÁLISE:
${listaArquivos}

${observacoes ? `OBSERVAÇÕES ADICIONAIS DO USUÁRIO:\n${observacoes}\n` : ''}
CONTEÚDO EXTRAÍDO DOS DOCUMENTOS:
${textos.join('\n\n---\n\n')}`;

    const messages: ChatMessage[] = [
      {
        role: 'user',
        content: `Analise detalhadamente todos os documentos do concorrente enviados abaixo conforme a Lei 14.133/2021. Identifique TODAS as inconsistências, irregularidades, documentos vencidos, ausentes ou em desconformidade. Gere um relatório técnico completo para fundamentar recursos administrativos e contrarrazões.\n\n${context}`,
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
        <h3 className="font-semibold text-sm">Análise Documental de Concorrente</h3>
        <Badge variant="outline" className="text-[10px] bg-accent/10 text-accent border-accent/20">
          Lei 14.133/2021
        </Badge>
      </div>

      <p className="text-xs text-muted-foreground">
        Envie os documentos de habilitação do concorrente (PDF ou ZIP) para que a IA analise cada item conforme
        a Lei 14.133/2021, identificando inconsistências para fundamentar recursos e contrarrazões.
      </p>

      {/* Upload area */}
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
          PDF ou ZIP — Máximo 20MB por arquivo
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
            <><Search className="w-4 h-4 mr-2" /> Analisar Documentos ({arquivos.length} arquivo{arquivos.length > 1 ? 's' : ''})</>
          )}
        </Button>
      )}

      {/* Results */}
      {resultado && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              <h4 className="text-sm font-semibold">Relatório de Análise</h4>
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
            A IA está verificando conformidade com a Lei 14.133/2021, certidões, atestados, balanço patrimonial e declarações.
          </p>
        </div>
      )}
    </div>
  );
}
