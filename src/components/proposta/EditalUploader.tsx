import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Loader2, X, CheckCircle } from 'lucide-react';
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
  valorUnitario: string;
  valorTotal: string;
}

export default function EditalUploader({ onExtracted, isExtracting, setIsExtracting }: EditalUploaderProps) {
  const [editalFile, setEditalFile] = useState<File | null>(null);
  const [extracted, setExtracted] = useState(false);
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
    let content = '';

    // Read file as text
    const text = await editalFile.text();
    const truncated = text.slice(0, 15000); // Limit context size

    await streamAIChat({
      messages: [{
        role: 'user',
        content: `Analise o seguinte texto de edital de licitação e extraia as informações em formato JSON com os campos:
{
  "numeroLicitacao": "número do pregão/licitação",
  "orgao": "órgão licitante",
  "modalidade": "modalidade (Pregão Eletrônico, etc)",
  "objeto": "descrição do objeto",
  "valorEstimado": "valor estimado se disponível",
  "prazoValidade": "prazo de validade da proposta",
  "localEntrega": "local e horário de entrega",
  "liquidacaoNfe": "condições de pagamento/liquidação",
  "itens": [{"item": "1", "descricao": "...", "quantidade": "...", "unidade": "...", "valorUnitario": "", "valorTotal": ""}]
}

Retorne APENAS o JSON, sem explicações adicionais.

EDITAL:
${truncated}`
      }],
      action: 'analise_edital',
      onDelta: (chunk) => { content += chunk; },
      onDone: () => {
        try {
          // Try to extract JSON from the response
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const data = JSON.parse(jsonMatch[0]);
            onExtracted({
              numeroLicitacao: data.numeroLicitacao || '',
              orgao: data.orgao || '',
              modalidade: data.modalidade || 'Pregão Eletrônico',
              objeto: data.objeto || '',
              valorEstimado: data.valorEstimado || '',
              prazoValidade: data.prazoValidade || '60 dias corridos',
              localEntrega: data.localEntrega || '',
              liquidacaoNfe: data.liquidacaoNfe || '',
              itens: data.itens || [],
              rawText: truncated,
            });
            setExtracted(true);
            toast.success('Dados do edital extraídos com sucesso!');
          } else {
            toast.error('Não foi possível extrair dados estruturados do edital.');
          }
        } catch {
          toast.error('Erro ao processar dados do edital.');
        }
        setIsExtracting(false);
      },
      onError: (err) => {
        toast.error(err);
        setIsExtracting(false);
      },
    });
  };

  const handleRemove = () => {
    setEditalFile(null);
    setExtracted(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="space-y-3">
      {editalFile ? (
        <div className="flex items-center gap-4 bg-muted/30 rounded-lg p-4 border border-border/50">
          <FileText className="w-8 h-8 text-accent shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{editalFile.name}</p>
            <p className="text-xs text-muted-foreground">
              {(editalFile.size / 1024).toFixed(0)} KB
              {extracted && <span className="text-accent ml-2">✓ Dados extraídos</span>}
            </p>
          </div>
          <div className="flex gap-2">
            {!extracted && (
              <Button size="sm" onClick={handleExtract} disabled={isExtracting}>
                {isExtracting ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Extraindo...</>
                ) : (
                  <><CheckCircle className="w-4 h-4 mr-1" /> Extrair Dados</>
                )}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleRemove}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="w-full border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center gap-2 hover:border-accent/50 hover:bg-muted/30 transition-colors"
        >
          <Upload className="w-8 h-8 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Envie o edital para extração automática por IA</span>
          <span className="text-xs text-muted-foreground">PDF, DOC, DOCX ou TXT — Máx. 10MB</span>
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
