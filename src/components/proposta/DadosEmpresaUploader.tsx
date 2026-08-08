import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Loader2, X, CheckCircle, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { streamAIChat } from '@/lib/ai-stream';

export interface ExtractedEmpresaData {
  telefone?: string;
  email?: string;
  repNome?: string;
  repCpf?: string;
  repRg?: string;
  repOrgaoExp?: string;
  repCargo?: string;
  repNaturalidade?: string;
  repNacionalidade?: string;
  banco?: string;
  agencia?: string;
  conta?: string;
}

interface DadosEmpresaUploaderProps {
  onExtracted: (data: ExtractedEmpresaData) => void;
}

export default function DadosEmpresaUploader({ onExtracted }: DadosEmpresaUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extracted, setExtracted] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    const allowedTypes = [
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    const allowedExts = ['.pdf', '.doc', '.docx', '.txt', '.xls', '.xlsx'];
    const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();

    if (!allowedTypes.includes(f.type) && !allowedExts.includes(ext)) {
      toast.error('Formato inválido. Use PDF, Word (DOC/DOCX) ou Excel (XLS/XLSX).');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 10MB.');
      return;
    }
    setFile(f);
    setExtracted(false);
  };

  const handleExtract = async () => {
    if (!file) return;

    setIsExtracting(true);
    let content = '';

    const text = await file.text();
    const truncated = text.slice(0, 12000);

    await streamAIChat({
      messages: [{
        role: 'user',
        content: `Analise o documento a seguir e extraia os dados da empresa, representante legal e dados bancários em formato JSON com os campos:
{
  "telefone": "telefone da empresa",
  "email": "email da empresa",
  "repNome": "nome completo do representante legal / sócio",
  "repCpf": "CPF do representante",
  "repRg": "RG do representante",
  "repOrgaoExp": "órgão expedidor do RG (ex: SSP/PA)",
  "repCargo": "cargo ou função (ex: Sócio-Administrador)",
  "repNaturalidade": "cidade de nascimento",
  "repNacionalidade": "nacionalidade",
  "banco": "nome do banco",
  "agencia": "número da agência",
  "conta": "número da conta corrente"
}

Extraia SOMENTE os campos que encontrar no documento. Para campos não encontrados, use string vazia "".
Retorne APENAS o JSON, sem explicações.

DOCUMENTO:
${truncated}`
      }],
      action: 'analise_edital',
      onDelta: (chunk) => { content += chunk; },
      onDone: () => {
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const data = JSON.parse(jsonMatch[0]) as ExtractedEmpresaData;
            onExtracted(data);
            setExtracted(true);
            toast.success('Dados da empresa/representante extraídos com sucesso!');
          } else {
            toast.error('Não foi possível extrair dados do documento.');
          }
        } catch {
          toast.error('Erro ao processar dados do documento.');
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
    setFile(null);
    setExtracted(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground flex items-center gap-2">
        <UserCheck className="w-4 h-4 text-muted-foreground" />
        Envie um documento (contrato social, procuração, etc.) para extrair dados automaticamente
      </p>

      {file ? (
        <div className="flex items-center gap-4 bg-muted/30 rounded-lg p-4 border border-border/50">
          <FileText className="w-8 h-8 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {(file.size / 1024).toFixed(0)} KB
              {extracted && <span className="text-success ml-2">✓ Dados extraídos</span>}
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
          className="w-full border-2 border-dashed border-border rounded-lg p-5 flex flex-col items-center gap-2 hover:border-accent/50 hover:bg-muted/30 transition-colors"
        >
          <Upload className="w-7 h-7 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Envie documento da empresa para extração por IA</span>
          <span className="text-xs text-muted-foreground">PDF, Word (DOC/DOCX) ou Excel (XLS/XLSX) — Máx. 10MB</span>
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
