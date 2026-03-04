import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FileText, BookOpen, Layout, Loader2, Download, Sparkles,
  Package, Image as ImageIcon, ClipboardList, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { streamAIChat } from '@/lib/ai-stream';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';
import jsPDF from 'jspdf';

interface CatalogoItem {
  id: string;
  descricao: string;
  marca: string | null;
  fabricante: string | null;
  modelo: string | null;
  unidade: string;
  quantidade: number;
}

interface ProductSpec {
  nome: string;
  descricao_detalhada: string;
  especificacoes: { chave: string; valor: string }[];
  imagens: string[];
  marca: string;
  modelo: string;
  categoria: string;
}

type DocType = 'ficha' | 'folder' | 'catalogo';

interface CatalogoDocGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CatalogoItem[];
}

const DOC_LABELS: Record<DocType, { label: string; icon: typeof FileText; desc: string }> = {
  ficha: { label: 'Ficha Técnica', icon: ClipboardList, desc: 'Especificações detalhadas de cada produto' },
  folder: { label: 'Folder', icon: Layout, desc: 'Material promocional com imagens e destaques' },
  catalogo: { label: 'Catálogo', icon: BookOpen, desc: 'Catálogo completo com todos os produtos' },
};

export default function CatalogoDocGenerator({ open, onOpenChange, items }: CatalogoDocGeneratorProps) {
  const [docType, setDocType] = useState<DocType>('ficha');
  const [isGenerating, setIsGenerating] = useState(false);
  const [specs, setSpecs] = useState<ProductSpec[]>([]);
  const [generatedDoc, setGeneratedDoc] = useState('');
  const [step, setStep] = useState<'config' | 'result'>('config');

  const resetState = () => {
    setSpecs([]);
    setGeneratedDoc('');
    setStep('config');
  };

  const searchProductSpecs = async (item: CatalogoItem): Promise<ProductSpec> => {
    const searchTerm = [item.descricao, item.marca, item.modelo].filter(Boolean).join(' ').substring(0, 150);

    try {
      // Use Firecrawl search to find real product specs
      const { data, error } = await supabase.functions.invoke('firecrawl-search', {
        body: {
          query: `"${searchTerm}" especificações técnicas ficha técnica`,
          options: { limit: 3, lang: 'pt-br', country: 'BR', scrapeOptions: { formats: ['markdown'] } },
        },
      });

      let scrapedContent = '';
      if (!error && data?.success && data?.data?.length > 0) {
        scrapedContent = data.data
          .slice(0, 2)
          .map((r: any) => r.markdown || r.description || '')
          .join('\n\n')
          .substring(0, 15000);
      }

      // Use AI to extract structured specs from scraped content
      let specJson = '';
      await streamAIChat({
        messages: [{ role: 'user', content: `Produto: ${searchTerm}\n\nConteúdo extraído da internet:\n${scrapedContent || 'Nenhum conteúdo encontrado, use seu conhecimento sobre o produto.'}` }],
        action: 'extrair-spec-produto',
        context: `Você é um especialista em especificações técnicas de produtos. Analise o conteúdo extraído da internet e gere uma ficha técnica FIEL e REAL do produto.

REGRAS:
- Extraia APENAS dados REAIS encontrados no conteúdo ou que sejam de conhecimento público sobre o produto
- NÃO invente especificações. Se não encontrar, coloque "Consultar fabricante"
- NÃO inclua preços em nenhum campo
- Inclua URLs de imagens reais encontradas no conteúdo (se houver)

Responda APENAS em JSON sem markdown:
{
  "nome": "nome completo e correto do produto",
  "descricao_detalhada": "descrição técnica detalhada do produto sem mencionar preço",
  "especificacoes": [
    {"chave": "Dimensões", "valor": "..."},
    {"chave": "Peso", "valor": "..."},
    {"chave": "Material", "valor": "..."},
    {"chave": "Cor", "valor": "..."},
    {"chave": "Voltagem", "valor": "..."},
    {"chave": "Garantia", "valor": "..."}
  ],
  "imagens": ["url1", "url2"],
  "marca": "marca real",
  "modelo": "modelo real",
  "categoria": "categoria do produto"
}`,
        onDelta: (d) => { specJson += d; },
        onDone: () => {},
        onError: () => {},
      });

      let clean = specJson.trim();
      if (clean.startsWith('```')) clean = clean.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      const parsed = JSON.parse(clean);
      return parsed as ProductSpec;
    } catch (e) {
      console.error('Error fetching spec for:', searchTerm, e);
      return {
        nome: item.descricao,
        descricao_detalhada: item.descricao,
        especificacoes: [],
        imagens: [],
        marca: item.marca || '',
        modelo: item.modelo || '',
        categoria: 'Geral',
      };
    }
  };

  const generateDocument = async () => {
    if (items.length === 0) {
      toast.error('Nenhum item selecionado.');
      return;
    }

    setIsGenerating(true);
    setGeneratedDoc('');
    setSpecs([]);

    try {
      // Step 1: Search specs for all items (max 10 in parallel)
      toast.info(`Pesquisando especificações reais para ${items.length} produto(s)...`);
      const specPromises = items.slice(0, 10).map(searchProductSpecs);
      const results = await Promise.allSettled(specPromises);
      const fetchedSpecs = results
        .filter((r): r is PromiseFulfilledResult<ProductSpec> => r.status === 'fulfilled')
        .map(r => r.value);

      setSpecs(fetchedSpecs);

      if (fetchedSpecs.length === 0) {
        toast.error('Não foi possível obter especificações.');
        setIsGenerating(false);
        return;
      }

      // Step 2: Generate the document using AI
      toast.info('Gerando documento...');

      const specsContext = fetchedSpecs.map((s, i) => `
PRODUTO ${i + 1}:
Nome: ${s.nome}
Marca: ${s.marca}
Modelo: ${s.modelo}
Categoria: ${s.categoria}
Descrição: ${s.descricao_detalhada}
Especificações: ${s.especificacoes.map(e => `${e.chave}: ${e.valor}`).join(', ')}
`).join('\n---\n');

      const prompts: Record<DocType, string> = {
        ficha: `Gere uma FICHA TÉCNICA profissional para cada produto listado abaixo. 

FORMATO para cada produto:
## [Nome do Produto]
**Marca:** [marca] | **Modelo:** [modelo] | **Categoria:** [categoria]

### Descrição
[descrição técnica detalhada]

### Especificações Técnicas
| Característica | Detalhe |
|---|---|
[tabela com todas as especificações]

### Informações Adicionais
[garantia, certificações, compatibilidades]

---

REGRAS:
- NÃO mencione preços, valores ou custos em NENHUM lugar
- Use linguagem técnica e profissional
- Destaque diferenciais do produto
- Dados devem ser FIÉIS às especificações reais encontradas`,

        folder: `Gere um FOLDER PROMOCIONAL profissional para os produtos listados.

FORMATO:
# 📋 Catálogo de Produtos

Para cada produto:
## ✨ [Nome do Produto]
> [frase de impacto sobre o produto - sem mencionar preço]

**Marca:** [marca] | **Modelo:** [modelo]

### Por que escolher este produto?
- ✅ [benefício 1]
- ✅ [benefício 2]
- ✅ [benefício 3]

### Destaques Técnicos
[3-5 especificações mais relevantes em formato de destaque]

---

REGRAS:
- NÃO mencione preços, valores ou custos
- Linguagem comercial e persuasiva
- Foque em benefícios e diferenciais
- Visual limpo e organizado`,

        catalogo: `Gere um CATÁLOGO DE PRODUTOS profissional e completo.

FORMATO:
# 📦 Catálogo de Produtos

**Data de emissão:** [data atual]
**Total de produtos:** [quantidade]

---

Para cada produto:
## [Nº] — [Nome do Produto]

| Campo | Detalhe |
|---|---|
| Marca | [marca] |
| Modelo | [modelo] |
| Categoria | [categoria] |
[todas as especificações em tabela]

**Descrição:** [descrição técnica resumida]

---

### Resumo do Catálogo
[tabela resumo com todos os produtos: Nº, Nome, Marca, Modelo, Categoria]

REGRAS:
- NÃO mencione preços, valores ou custos em NENHUM lugar do catálogo
- Formato profissional adequado para apresentação em licitações
- Especificações técnicas fiéis e detalhadas
- Numeração sequencial dos itens`,
      };

      let doc = '';
      await streamAIChat({
        messages: [{ role: 'user', content: specsContext }],
        action: 'gerar-doc-catalogo',
        context: prompts[docType],
        onDelta: (d) => {
          doc += d;
          setGeneratedDoc(doc);
        },
        onDone: () => {},
        onError: (err) => toast.error('Erro na geração: ' + err),
      });

      setStep('result');
      toast.success(`${DOC_LABELS[docType].label} gerado com sucesso!`);
    } catch (e) {
      console.error('Error generating doc:', e);
      toast.error('Erro ao gerar documento.');
    }

    setIsGenerating(false);
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth() - margin * 2;
    let y = margin;

    doc.setFontSize(16);
    doc.text(DOC_LABELS[docType].label, margin, y);
    y += 10;

    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')} | ${items.length} produto(s)`, margin, y);
    y += 10;

    doc.setTextColor(0);
    doc.setFontSize(10);

    // Strip markdown and write plain text
    const plainText = generatedDoc
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*/g, '')
      .replace(/\|/g, ' ')
      .replace(/---/g, '————————————————')
      .replace(/- ✅/g, '•')
      .replace(/- /g, '• ')
      .replace(/>/g, '');

    const lines = doc.splitTextToSize(plainText, pageWidth);
    for (const line of lines) {
      if (y > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += 5;
    }

    // Add product images if available
    specs.forEach((spec) => {
      if (spec.imagens.length > 0) {
        if (y > doc.internal.pageSize.getHeight() - 60) {
          doc.addPage();
          y = margin;
        }
        doc.setFontSize(9);
        doc.text(`Imagens: ${spec.nome}`, margin, y);
        y += 5;
        doc.setFontSize(8);
        doc.setTextColor(100);
        spec.imagens.slice(0, 3).forEach((url) => {
          doc.text(`📷 ${url.substring(0, 80)}...`, margin, y);
          y += 4;
        });
        doc.setTextColor(0);
        y += 5;
      }
    });

    doc.save(`${DOC_LABELS[docType].label.toLowerCase().replace(/\s/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success('PDF baixado!');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetState(); }}>
      <DialogContent className="max-w-5xl max-h-[90vh] p-0 overflow-hidden">
        <ScrollArea className="max-h-[90vh]">
          <div className="p-6 space-y-5">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-accent" />
                Gerador de Documentos — IA com Pesquisa Real
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Gera fichas técnicas, folders e catálogos com especificações reais extraídas da internet. Sem preços.
              </p>
            </DialogHeader>

            {step === 'config' && (
              <div className="space-y-5">
                {/* Document type selection */}
                <Tabs value={docType} onValueChange={(v) => setDocType(v as DocType)}>
                  <TabsList className="w-full">
                    {(Object.entries(DOC_LABELS) as [DocType, typeof DOC_LABELS[DocType]][]).map(([key, { label, icon: Icon }]) => (
                      <TabsTrigger key={key} value={key} className="flex-1 gap-1.5">
                        <Icon className="w-3.5 h-3.5" />
                        {label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {(Object.entries(DOC_LABELS) as [DocType, typeof DOC_LABELS[DocType]][]).map(([key, { desc }]) => (
                    <TabsContent key={key} value={key}>
                      <div className="bg-muted/30 rounded-lg p-3 text-xs text-muted-foreground">
                        {desc}
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>

                {/* Selected items preview */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Package className="w-4 h-4 text-primary" />
                    Produtos selecionados ({items.length})
                  </h4>
                  <div className="border border-border/40 rounded-lg overflow-hidden max-h-[200px] overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr>
                          <th className="px-3 py-1.5 text-left font-semibold">#</th>
                          <th className="px-3 py-1.5 text-left font-semibold">Descrição</th>
                          <th className="px-3 py-1.5 text-left font-semibold">Marca</th>
                          <th className="px-3 py-1.5 text-left font-semibold">Modelo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, i) => (
                          <tr key={item.id} className={i % 2 === 0 ? 'bg-muted/10' : ''}>
                            <td className="px-3 py-1.5">{i + 1}</td>
                            <td className="px-3 py-1.5 max-w-[300px] truncate">{item.descricao}</td>
                            <td className="px-3 py-1.5">{item.marca || '—'}</td>
                            <td className="px-3 py-1.5">{item.modelo || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-accent/5 border border-accent/20 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
                  <p className="font-semibold text-foreground">🔍 Como funciona:</p>
                  <p>1. A IA pesquisa especificações técnicas reais na internet para cada produto</p>
                  <p>2. Extrai dados fiéis: dimensões, materiais, garantia, certificações</p>
                  <p>3. Gera o documento no formato escolhido <strong>sem incluir preços</strong></p>
                  <p>4. Inclui imagens reais dos produtos quando disponíveis</p>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={generateDocument}
                    disabled={isGenerating || items.length === 0}
                    className="bg-accent hover:bg-accent/90 text-accent-foreground"
                  >
                    {isGenerating ? (
                      <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Gerando...</>
                    ) : (
                      <><Sparkles className="w-4 h-4 mr-1" /> Gerar {DOC_LABELS[docType].label}</>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {step === 'result' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Badge className="bg-accent/15 text-accent border-accent/30">
                    {DOC_LABELS[docType].label} — {items.length} produto(s)
                  </Badge>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => { resetState(); }}>
                      <RefreshCw className="w-3.5 h-3.5 mr-1" /> Novo
                    </Button>
                    <Button size="sm" onClick={downloadPDF} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                      <Download className="w-3.5 h-3.5 mr-1" /> Baixar PDF
                    </Button>
                  </div>
                </div>

                {/* Product images grid */}
                {specs.some(s => s.imagens.length > 0) && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-primary" /> Imagens Reais dos Produtos
                    </h4>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {specs.filter(s => s.imagens.length > 0).map((spec, i) => (
                        <div key={i} className="flex-shrink-0 w-24 space-y-1">
                          <div className="aspect-square bg-muted/10 rounded-md border border-border/30 overflow-hidden">
                            <img
                              src={spec.imagens[0]}
                              alt={spec.nome}
                              className="w-full h-full object-contain p-1"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          </div>
                          <p className="text-[9px] text-muted-foreground truncate text-center">{spec.nome.substring(0, 30)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Generated document */}
                <div className="border border-border/40 rounded-lg bg-card p-5 min-h-[300px]">
                  <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-foreground prose-p:text-foreground/90 prose-strong:text-foreground prose-td:text-xs prose-th:text-xs">
                    <ReactMarkdown>{generatedDoc}</ReactMarkdown>
                  </div>
                </div>
              </div>
            )}

            {/* Loading state */}
            {isGenerating && step === 'config' && (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-accent" />
                <p className="text-sm text-muted-foreground">
                  Pesquisando especificações reais na internet e gerando documento...
                </p>
                <p className="text-xs text-muted-foreground/70">
                  Isso pode levar alguns segundos por produto.
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
