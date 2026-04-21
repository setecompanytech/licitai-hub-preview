import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Upload, FileText, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { extractTextFromFile } from '@/lib/pdf-text-extractor';

type ExtractedData = {
  numero_contrato?: string;
  objeto?: string;
  orgao_contratante?: string;
  valor_global?: number;
  data_assinatura?: string;
  data_inicio?: string;
  data_fim?: string;
  vigencia_meses?: number;
  modalidade?: string;
  uf?: string;
  municipio?: string;
  fiscal_nome?: string;
  fiscal_email?: string;
  fiscal_telefone?: string;
  observacoes?: string;
  itens?: Array<{
    codigo_item?: string;
    descricao: string;
    quantidade?: number;
    unidade?: string;
    valor_unitario?: number;
    valor_total?: number;
  }>;
};

interface ImportarContratoPDFProps {
  onExtracted: (data: ExtractedData, opts: { tipo_estrutura: 'itens' | 'lotes' }) => void;
}

const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

function isAcceptedDocument(file: File) {
  const name = file.name.toLowerCase();
  return (
    ACCEPTED_MIME_TYPES.includes(file.type) ||
    name.endsWith('.pdf') ||
    name.endsWith('.txt') ||
    name.endsWith('.doc') ||
    name.endsWith('.docx')
  );
}

export default function ImportarContratoPDF({ onExtracted }: ImportarContratoPDFProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'upload' | 'extracting' | 'done' | 'error'>('upload');
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState('');
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [tipoEstrutura, setTipoEstrutura] = useState<'itens' | 'lotes'>('itens');
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep('upload');
    setProgress(0);
    setFileName('');
    setExtracted(null);
    setErrorMsg('');
    setTipoEstrutura('itens');
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isAcceptedDocument(file)) {
      toast.error('Selecione um arquivo PDF, DOC, DOCX ou TXT');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      toast.error('Arquivo muito grande (máx. 20MB)');
      return;
    }

    setFileName(file.name);
    setStep('extracting');
    setProgress(10);

    try {
      const texto = await extractTextFromFile(file, 80);
      setProgress(55);

      if (!texto || texto.trim().length < 80) {
        throw new Error('Não foi possível extrair texto legível do documento. Verifique se o arquivo está protegido, corrompido ou contém apenas imagens.');
      }

      setProgress(65);
      const { data, error } = await supabase.functions.invoke('extrair-contrato-pdf', {
        body: {
          texto_pdf: texto,
          nome_arquivo: file.name,
          tipo_arquivo: file.type || file.name.split('.').pop() || 'desconhecido',
        },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Erro na extração');

      setProgress(100);
      setExtracted(data.data);
      setStep('done');
    } catch (err: any) {
      console.error('Extraction error:', err);
      setErrorMsg(err.message || 'Erro ao processar o documento');
      setStep('error');
    }

    if (fileRef.current) fileRef.current.value = '';
  };

  const handleConfirm = () => {
    if (extracted) {
      onExtracted(extracted, { tipo_estrutura: tipoEstrutura });
      setOpen(false);
      reset();
      toast.success('Dados extraídos aplicados ao formulário!');
    }
  };

  const filledFields = extracted
    ? Object.entries(extracted).filter(([k, v]) => v !== null && v !== undefined && k !== 'itens').length
    : 0;
  const totalItens = extracted?.itens?.length || 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="w-4 h-4 mr-2" /> Importar Contrato
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" /> Importar Contrato por Documento
          </DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="py-8">
            <label
              htmlFor="pdf-upload"
              className="flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 cursor-pointer hover:border-primary/50 transition-colors"
            >
              <Upload className="w-10 h-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm font-medium">Clique ou arraste o documento do contrato</p>
              <p className="text-xs text-muted-foreground mt-1">PDF, DOC, DOCX ou TXT até 20MB</p>
            </label>
            <input
              id="pdf-upload"
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              className="hidden"
              onChange={handleFile}
            />
          </div>
        )}

        {step === 'extracting' && (
          <div className="py-8 space-y-4">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium">Processando: {fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {progress < 60 ? 'Lendo o conteúdo real do documento...' : 'Extraindo dados estruturados do contrato...'}
                </p>
              </div>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {step === 'done' && extracted && (
          <div className="py-4 space-y-4">
            <div className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-medium">Extração concluída!</span>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
              {extracted.numero_contrato && (
                <div><span className="text-muted-foreground">Nº Contrato:</span> <strong>{extracted.numero_contrato}</strong></div>
              )}
              {extracted.orgao_contratante && (
                <div><span className="text-muted-foreground">Órgão:</span> <strong>{extracted.orgao_contratante}</strong></div>
              )}
              {extracted.objeto && (
                <div><span className="text-muted-foreground">Objeto:</span> <span className="line-clamp-2">{extracted.objeto}</span></div>
              )}
              {extracted.valor_global != null && (
                <div><span className="text-muted-foreground">Valor Global:</span> <strong>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(extracted.valor_global)}</strong></div>
              )}
              {(extracted.data_assinatura || extracted.data_inicio || extracted.data_fim) && (
                <div>
                  <span className="text-muted-foreground">Vigência:</span>{' '}
                  <strong>{extracted.data_assinatura || '—'}</strong>
                  <span className="text-muted-foreground"> assinatura</span>
                  {' · '}
                  <strong>{extracted.data_inicio || '—'}</strong>
                  <span className="text-muted-foreground"> início</span>
                  {' · '}
                  <strong>{extracted.data_fim || '—'}</strong>
                  <span className="text-muted-foreground"> fim</span>
                </div>
              )}
              {extracted.modalidade && (
                <div><span className="text-muted-foreground">Modalidade:</span> {extracted.modalidade}</div>
              )}
              <div className="flex gap-2 pt-1 flex-wrap">
                <Badge variant="secondary" className="text-[10px]">{filledFields} campos extraídos</Badge>
                {totalItens > 0 && <Badge variant="secondary" className="text-[10px]">{totalItens} itens encontrados</Badge>}
                {extracted.vigencia_meses != null && <Badge variant="secondary" className="text-[10px]">{extracted.vigencia_meses} meses</Badge>}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={reset}>Tentar Outro</Button>
              <Button onClick={handleConfirm}>Aplicar ao Formulário</Button>
            </div>
          </div>
        )}

        {step === 'error' && (
          <div className="py-6 space-y-4">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-medium">Erro na extração</span>
            </div>
            <p className="text-sm text-muted-foreground">{errorMsg}</p>
            <Button variant="outline" onClick={reset}>Tentar Novamente</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
