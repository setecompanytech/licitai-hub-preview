import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, Loader2, X, CheckCircle, Sparkles, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { streamAIChat } from '@/lib/ai-stream';

interface EditalUploaderProps {
  onExtracted: (data: ExtractedEditalData) => void;
  isExtracting: boolean;
  setIsExtracting: (v: boolean) => void;
}

export interface ExtractedEditalData {
  numeroLicitacao: string;
  orgao: string;
  modalidade: string;
  objeto: string;
  valorEstimado: string;
  prazoValidade: string;
  prazoPagamento: string;
  prazoEntrega: string;
  localEntrega: string;
  liquidacaoNfe: string;
  itens: EditalItem[];
  rawText: string;
}

export interface EditalItem {
  item: string;
  descricao: string;
  quantidade: string;
  unidade: string;
  marca: string;
  fabricante: string;
  modelo: string;
  valorUnitario: string;
  valorUnitarioExtenso: string;
  valorTotal: string;
  valorTotalExtenso: string;
}

export default function EditalUploader({ onExtracted, isExtracting, setIsExtracting }: EditalUploaderProps) {
  const [editalFile, setEditalFile] = useState<File | null>(null);
  const [extracted, setExtracted] = useState(false);
  const [progress, setProgress] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type) && !file.name.endsWith('.txt')) {
      toast.error('Formato inválido. Use PDF, DOC, DOCX ou TXT.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 10MB.');
      return;
    }
    setEditalFile(file);
    setExtracted(false);
  };

  const handleExtract = async () => {
    if (!editalFile) return;

    setIsExtracting(true);
    setProgress('Lendo documento...');
    let content = '';

    const text = await editalFile.text();
    const truncated = text.slice(0, 15000);

    setProgress('Analisando edital com IA...');

    await streamAIChat({
      messages: [{
        role: 'user',
        content: `Analise minuciosamente o texto do edital de licitação abaixo e extraia TODOS os dados disponíveis no formato JSON:

{
  "numeroLicitacao": "número completo do pregão/licitação (ex: PE 001/2026)",
  "orgao": "órgão gerenciador / licitante (nome completo)",
  "modalidade": "modalidade (Pregão Eletrônico, Concorrência, Dispensa, etc)",
  "objeto": "descrição completa do objeto da licitação",
  "valorEstimado": "valor estimado/referência se disponível (apenas número formatado)",
  "prazoValidade": "prazo de validade da proposta (ex: 60 dias corridos)",
  "prazoPagamento": "condições/prazo de pagamento após recebimento (ex: Até 30 dias após recebimento definitivo e apresentação da Nota Fiscal)",
  "prazoEntrega": "prazo de entrega dos bens/serviços (ex: Até 15 dias úteis após emissão da Ordem de Fornecimento)",
  "localEntrega": "local e endereço de entrega dos bens/serviços",
  "liquidacaoNfe": "condições de liquidação e nota fiscal",
  "itens": [
    {
      "item": "1",
      "descricao": "descrição completa do item/produto/serviço",
      "quantidade": "quantidade solicitada",
      "unidade": "unidade de medida (UN, CX, PCT, KG, etc)",
      "marca": "marca se especificada ou vazio",
      "fabricante": "fabricante se especificado ou vazio",
      "modelo": "modelo se especificado ou vazio",
      "valorUnitario": "valor unitário de referência se disponível",
      "valorTotal": "valor total se disponível"
    }
  ]
}

REGRAS IMPORTANTES:
- Extraia TODOS os itens da planilha/tabela de preços do edital
- Para cada item, preencha descrição completa incluindo especificações técnicas
- Se houver marca/fabricante/modelo de referência, inclua
- Se não encontrar um campo, use string vazia ""
- Retorne APENAS o JSON válido, sem explicações ou comentários

TEXTO DO EDITAL:
${truncated}`
      }],
      action: 'analise_edital',
      onDelta: (chunk) => {
        content += chunk;
        setProgress('Extraindo dados do edital...');
      },
      onDone: () => {
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const data = JSON.parse(jsonMatch[0]);
            const itens: EditalItem[] = (data.itens || []).map((i: any, idx: number) => ({
              item: String(i.item || idx + 1),
              descricao: i.descricao || '',
              quantidade: String(i.quantidade || ''),
              unidade: i.unidade || 'UN',
              marca: i.marca || '',
              fabricante: i.fabricante || '',
              modelo: i.modelo || '',
              valorUnitario: i.valorUnitario ? String(i.valorUnitario).replace(/[^\d.,]/g, '') : '',
              valorUnitarioExtenso: '',
              valorTotal: i.valorTotal ? String(i.valorTotal).replace(/[^\d.,]/g, '') : '',
              valorTotalExtenso: '',
            }));

            onExtracted({
              numeroLicitacao: data.numeroLicitacao || '',
              orgao: data.orgao || '',
              modalidade: data.modalidade || 'Pregão Eletrônico',
              objeto: data.objeto || '',
              valorEstimado: data.valorEstimado || '',
              prazoValidade: data.prazoValidade || '60 dias corridos',
              prazoPagamento: data.prazoPagamento || '',
              prazoEntrega: data.prazoEntrega || '',
              localEntrega: data.localEntrega || '',
              liquidacaoNfe: data.liquidacaoNfe || '',
              itens,
              rawText: truncated,
            });
            setExtracted(true);
            toast.success(`Dados extraídos! ${itens.length} item(ns) encontrado(s).`);
          } else {
            toast.error('Não foi possível extrair dados estruturados do edital.');
          }
        } catch {
          toast.error('Erro ao processar dados do edital.');
        }
        setIsExtracting(false);
        setProgress('');
      },
      onError: (err) => {
        toast.error(err);
        setIsExtracting(false);
        setProgress('');
      },
    });
  };

  const handleRemove = () => {
    setEditalFile(null);
    setExtracted(false);
    setProgress('');
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="space-y-3">
      {editalFile ? (
        <div className="bg-muted/30 rounded-xl p-4 border border-border/50 space-y-3">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
              <FileText className="w-6 h-6 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{editalFile.name}</p>
              <p className="text-xs text-muted-foreground">
                {(editalFile.size / 1024).toFixed(0)} KB
                {extracted && (
                  <Badge className="ml-2 bg-green-600/10 text-green-700 dark:text-green-400 border-green-600/20 text-[10px]">
                    <CheckCircle className="w-3 h-3 mr-1" /> Dados extraídos
                  </Badge>
                )}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              {!extracted && (
                <Button size="sm" onClick={handleExtract} disabled={isExtracting} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                  {isExtracting ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Extraindo...</>
                  ) : (
                    <><Sparkles className="w-4 h-4 mr-1" /> Extrair com IA</>
                  )}
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleRemove}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {isExtracting && progress && (
            <div className="flex items-center gap-2 text-xs text-accent animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin" />
              {progress}
            </div>
          )}

          {extracted && (
            <div className="flex items-center gap-2 p-2.5 bg-green-600/5 border border-green-600/20 rounded-lg">
              <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
              <p className="text-xs text-green-700 dark:text-green-400">
                Extração concluída! Avance para revisar e editar os dados extraídos nas próximas etapas.
              </p>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="w-full border-2 border-dashed border-border/60 rounded-xl p-8 flex flex-col items-center gap-3 hover:border-accent/50 hover:bg-accent/5 transition-all group"
        >
          <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
            <Upload className="w-7 h-7 text-accent" />
          </div>
          <div className="text-center">
            <span className="text-sm font-semibold text-foreground block">Envie o edital para extração automática</span>
            <span className="text-xs text-muted-foreground mt-1 block">
              A IA extrairá: órgão, itens, preços, prazos de pagamento, entrega, validade e local
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-[10px]">PDF</Badge>
            <Badge variant="outline" className="text-[10px]">DOC</Badge>
            <Badge variant="outline" className="text-[10px]">DOCX</Badge>
            <Badge variant="outline" className="text-[10px]">TXT</Badge>
            <span className="text-[10px] text-muted-foreground">Máx. 10MB</span>
          </div>
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
