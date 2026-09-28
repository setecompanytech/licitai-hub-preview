import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import SeloPraefectusIA from '@/components/shared/SeloPraefectusIA';
import { toast } from 'sonner';
import { Sparkles, Loader2, Copy, BarChart3, Upload, FileText, Archive, X } from 'lucide-react';
import { streamAIChat } from '@/lib/ai-stream';
import ReactMarkdown from 'react-markdown';
import NotaDeOrigem from '@/components/apoio-juridico/NotaDeOrigem';
import { marcarNotasComoLinks } from '@/lib/juridico/notas-de-origem';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/**
 * Dois perfis (28/09/2026): "Empresa" — o balanço da própria empresa ou de
 * um concorrente, lido para a habilitação do art. 69 e para a precificação;
 * "Ente público" — o balanço do órgão contratante, lido pela Lei 4.320, LRF
 * e NBC TSP para medir a capacidade de pagamento. Antes só havia o segundo,
 * e ele era aplicado a tudo.
 */
type Perfil = 'empresa' | 'ente';
const PROMPT_EMPRESA = (nome: string, exercicio: string, dados: string) => `Analise as demonstrações contábeis da empresa "${nome || 'não informada'}", exercício ${exercicio}, para fins de HABILITAÇÃO econômico-financeira em licitação (Lei 14.133/2021, art. 69) e de precificação:

${dados}

Estrutura obrigatória:
## 1. Leitura das demonstrações
- Saldos usados (ativo circulante, realizável a longo prazo, passivo circulante, exigível a longo prazo, patrimônio líquido, receita, resultado), cada um com [[fonte:anexo|linha]].
## 2. Índices do art. 69
- Liquidez Geral, Liquidez Corrente e Solvência Geral: fórmula, cálculo e resultado.
- Endividamento e capital circulante líquido.
- Patrimônio líquido e capital social: até que valor estimado de contratação a empresa atende ao mínimo de 10% (art. 69, § 4º).
## 3. Riscos e inconsistências
- Saldos que não fecham, contas atípicas, notas explicativas ausentes, o que um pregoeiro questionaria.
## 4. O que o edital pode e não pode exigir
- Vedação de faturamento mínimo e índice de lucratividade (§ 2º); relação de compromissos (§ 3º); último exercício se constituída há menos de 2 anos (§ 6º).
## 5. Impacto na precificação
- Capital de giro disponível × prazo de pagamento; margem mínima recomendada.
## 6. Recomendações
Use texto_da_norma para o art. 69 antes de citá-lo. Toda afirmação com nota de origem.`;
const PROMPT_ENTE = (orgao: string, exercicio: string, dados: string) => `Analise os seguintes dados contábeis do ente público "${orgao || 'não informado'}", exercício ${exercicio}, pela Lei 4.320/1964, LRF (LC 101/2000) e NBC TSP, para medir a CAPACIDADE DE PAGAMENTO de quem fornece a ele:

${dados}

Estrutura obrigatória:
## 1. Diagnóstico geral
- Situação patrimonial líquida; liquidez corrente, seca e geral; endividamento.
## 2. Divergências e irregularidades
- Saldos inconsistentes; classificação de receitas e despesas; princípios contábeis.
## 3. Conformidade legal
- Lei 4.320/64; limites da LRF (art. 19/20 pessoal, art. 29 dívida); mínimos de saúde e educação (CF art. 198 e 212).
## 4. Riscos para fornecedores
- Capacidade de pagamento, restos a pagar, atraso típico.
## 5. Impacto na precificação
- Margem de segurança e prazo de pagamento a considerar na proposta.
## 6. Recomendações
Toda afirmação com nota de origem; número sem fonte é "(a confirmar)".`;

export default function AnaliseBalancoIA() {
  const [dados, setDados] = useState('');
  const [perfil, setPerfil] = useState<Perfil>('empresa');
  const [orgao, setOrgao] = useState('');
  const [exercicio, setExercicio] = useState(new Date().getFullYear().toString());
  const [resultado, setResultado] = useState('');
  const [analisando, setAnalisando] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; text: string }[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState(0);

  const extractTextFromFile = async (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve((e.target?.result as string)?.slice(0, 50000) || '');
      reader.onerror = () => resolve('');
      reader.readAsText(file);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setExtracting(true);
    setExtractProgress(0);
    const results: { name: string; text: string }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setExtractProgress(Math.round(((i) / files.length) * 100));

      if (file.name.endsWith('.zip')) {
        try {
          const JSZip = (await import('jszip')).default;
          const zip = await JSZip.loadAsync(file);
          const zipFiles = Object.values(zip.files).filter(f => !f.dir && (f.name.endsWith('.txt') || f.name.endsWith('.csv') || f.name.endsWith('.xml')));
          for (const zf of zipFiles) {
            const content = await zf.async('string');
            results.push({ name: zf.name, text: content.slice(0, 30000) });
          }
          if (zipFiles.length === 0) {
            // Try extracting any text-readable file
            const allFiles = Object.values(zip.files).filter(f => !f.dir);
            for (const zf of allFiles.slice(0, 5)) {
              try {
                const content = await zf.async('string');
                if (content && content.length > 50) {
                  results.push({ name: zf.name, text: content.slice(0, 30000) });
                }
              } catch { /* binary file, skip */ }
            }
          }
        } catch {
          toast.error(`Erro ao processar ZIP: ${file.name}`);
        }
      } else {
        const text = await extractTextFromFile(file);
        if (text && text.length > 20) {
          results.push({ name: file.name, text: text.slice(0, 50000) });
        } else {
          toast.info(`${file.name}: texto não extraído (PDF binário). Use a extração via IA na Base Contábil para PDFs complexos.`);
        }
      }
    }

    setExtractProgress(100);
    if (results.length > 0) {
      setUploadedFiles(prev => [...prev, ...results]);
      const combined = results.map(r => `--- ${r.name} ---\n${r.text}`).join('\n\n');
      setDados(prev => prev ? prev + '\n\n' + combined : combined);
      toast.success(`${results.length} arquivo(s) processado(s) com sucesso!`);
    }
    setExtracting(false);
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleAnalisar = async () => {
    if (!dados) { toast.error('Cole os dados do balanço patrimonial ou demonstração contábil'); return; }
    setAnalisando(true);
    setResultado('');

    const prompt = perfil === 'empresa' ? PROMPT_EMPRESA(orgao, exercicio, dados) : PROMPT_ENTE(orgao, exercicio, dados);

    const chamar = (endpoint: 'juridico' | 'ai-chat') => streamAIChat({
      messages: [{ role: 'user', content: prompt }],
      action: 'contabilidade_tributaria',
      endpoint,
      extra: { dominio: 'contabil', modelo: { titulo: perfil === 'empresa' ? 'Análise de Qualificação Econômico-Financeira' : 'Análise de balanço do ente contratante', categoria: 'Habilitação', fundamentacao: perfil === 'empresa' ? 'Art. 69, Lei 14.133/2021' : 'Lei 4.320/1964; LC 101/2000' } },
      onDelta: (text) => setResultado(prev => prev + text),
      onDone: () => setAnalisando(false),
      onError: (err) => {
        if (endpoint === 'juridico' && /404|not found|n[aã]o encontrad/i.test(err)) { setResultado(''); void chamar('ai-chat'); return; }
        toast.error(err); setAnalisando(false);
      },
    });
    await chamar('juridico');
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-card p-5 shadow-sm space-y-4">
        <div className="space-y-1">
          {/* Recurso de IA: o selo "Praefectus IA" identifica o gerador. */}
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="flex items-center gap-2 text-lg font-semibold leading-6 text-foreground">
              <BarChart3 className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              Análise de Balanço e Demonstrações Contábeis
            </h2>
            <SeloPraefectusIA />
          </div>
          <p className="text-sm text-muted-foreground">
            Cole os dados do balanço patrimonial, DRE ou demonstrações contábeis para uma análise completa de divergências, conformidade legal e riscos.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="ab-perfil">De quem é o balanço</Label>
            <Select value={perfil} onValueChange={(v) => setPerfil(v as Perfil)}>
              <SelectTrigger id="ab-perfil"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="empresa">Empresa (habilitação art. 69 e precificação)</SelectItem>
                <SelectItem value="ente">Ente público (capacidade de pagamento)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ab-orgao">{perfil === 'empresa' ? 'Empresa' : 'Órgão / Entidade'}</Label>
            <Input id="ab-orgao" value={orgao} onChange={e => setOrgao(e.target.value)} placeholder={perfil === 'empresa' ? 'A sua empresa ou o concorrente' : 'Prefeitura de Belém, Governo do Pará...'} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ab-exercicio">Exercício</Label>
            <Input id="ab-exercicio" value={exercicio} onChange={e => setExercicio(e.target.value)} placeholder="2025" />
          </div>
        </div>

        <div className="rounded-md border border-dashed border-border p-4 space-y-3">
          <Label htmlFor="ab-arquivos" className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Upload de Arquivos (PDF, TXT, CSV, XLS, ZIP)
          </Label>
          <Input
            id="ab-arquivos"
            type="file"
            accept=".pdf,.txt,.csv,.xls,.xlsx,.xml,.doc,.docx,.zip"
            multiple
            onChange={handleFileUpload}
            disabled={extracting}
          />
          {extracting && (
            <div className="space-y-1" role="status">
              <Progress value={extractProgress} className="h-2" />
              <p className="text-xs text-muted-foreground">Extraindo texto dos arquivos... {extractProgress}%</p>
            </div>
          )}
          {uploadedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {uploadedFiles.map((f, i) => (
                <Badge key={i} variant="muted" className="gap-1">
                  {f.name.endsWith('.zip') ? <Archive className="w-3 h-3" aria-hidden="true" /> : <FileText className="w-3 h-3" aria-hidden="true" />}
                  {f.name.slice(0, 30)}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(i)}
                    aria-label={`Remover ${f.name}`}
                    className="ml-1 h-5 w-5 rounded-sm p-0 text-muted-foreground hover:text-destructive-ink [&_svg]:size-3"
                  >
                    <X aria-hidden="true" />
                  </Button>
                </Badge>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            O conteúdo extraído será adicionado automaticamente ao campo de dados abaixo. Para PDFs complexos, use a Base Contábil com extração via IA.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ab-dados">Dados Contábeis (cole o balanço, DRE ou valores, ou use o upload acima)</Label>
          <Textarea id="ab-dados" value={dados} onChange={e => setDados(e.target.value)}
            placeholder={`Cole aqui os dados contábeis. Exemplos:\n\nATIVO CIRCULANTE: R$ 150.000.000\nATIVO NÃO CIRCULANTE: R$ 320.000.000\nPASSIVO CIRCULANTE: R$ 180.000.000\nPATRIMÔNIO LÍQUIDO: R$ 290.000.000\n\nOu cole o texto completo do balanço patrimonial...`}
            className="min-h-44 font-mono text-sm" />
        </div>

        <div className="flex flex-wrap gap-2">
          {(perfil === 'empresa' ? ['Lei 14.133/2021, art. 69', 'NBC TG 26', 'NBC TG 1000 / ITG 1000', 'CFC/CRC'] : ['Lei 4.320/64', 'LRF - LC 101/2000', 'NBC TSP', 'CF art. 198 e 212']).map((b) => <Badge key={b} variant="muted">{b}</Badge>)}
        </div>

        <Button onClick={handleAnalisar} disabled={analisando}>
          {analisando ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
          Analisar com IA Contábil
        </Button>
      </section>

      {resultado && (
        <section className="rounded-lg border border-border bg-card p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold leading-6 text-foreground">Parecer da IA Contábil</h2>
            <Button variant="outline" onClick={() => { navigator.clipboard.writeText(resultado); toast.success('Copiado!'); }}>
              <Copy aria-hidden="true" /> Copiar
            </Button>
          </div>
          <div className="prose prose-sm max-w-none dark:prose-invert text-sm">
            <ReactMarkdown components={{ a: NotaDeOrigem }}>{marcarNotasComoLinks(resultado)}</ReactMarkdown>
          </div>
        </section>
      )}
    </div>
  );
}
