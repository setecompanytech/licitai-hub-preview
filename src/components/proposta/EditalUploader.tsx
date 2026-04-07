import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, Loader2, X, CheckCircle, Sparkles, AlertCircle, Download } from 'lucide-react';
import { toast } from 'sonner';
import { streamAIChat } from '@/lib/ai-stream';
import { useEditalExtraction } from '@/hooks/useEditalExtraction';
import { extractTextFromFile } from '@/lib/pdf-text-extractor';
import SugestaoMarcasReview from './SugestaoMarcasReview';

interface EditalUploaderProps {
  onExtracted: (data: ExtractedEditalData) => void;
  isExtracting: boolean;
  setIsExtracting: (v: boolean) => void;
  licitacaoId?: string;
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
  garantia: string;
  condicoesEntrega: string;
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
  /** Custo de aquisição (compra) unitário — usado para sugestão automática de preço de venda */
  custoAquisicao?: number;
}

export default function EditalUploader({ onExtracted, isExtracting, setIsExtracting, licitacaoId }: EditalUploaderProps) {
  const [editalFile, setEditalFile] = useState<File | null>(null);
  const [extracted, setExtracted] = useState(false);
  const [progress, setProgress] = useState('');
  const [hasExistingItens, setHasExistingItens] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const extractedItensRef = useRef<Array<{ id?: string; numero?: number; descricao: string; quantidade?: number; unidade?: string; valor_unitario?: number }>>([]);
  const { fetchItens, saveItensManual } = useEditalExtraction();

  // Check for existing centralized items
  useEffect(() => {
    if (licitacaoId) {
      fetchItens(licitacaoId).then(items => {
        setHasExistingItens(items.length > 0);
      });
    }
  }, [licitacaoId, fetchItens]);
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

    const text = await extractTextFromFile(editalFile, 150, true);
    if (!text || text.trim().length < 50) {
      toast.error('Não foi possível extrair texto do documento. Verifique se o arquivo não está protegido ou corrompido.');
      setIsExtracting(false);
      setProgress('');
      return;
    }

    // Use up to 60k chars but prioritize beginning + end of document (prazos/condições often at end)
    const fullText = text.trim();
    let truncated: string;
    if (fullText.length <= 60000) {
      truncated = fullText;
    } else {
      // Take first 40k and last 20k to capture both items and conditions/prazos
      const head = fullText.slice(0, 40000);
      const tail = fullText.slice(-20000);
      truncated = head + '\n\n[...]\n\n' + tail;
    }

    setProgress('Analisando edital com IA...');

    await streamAIChat({
      messages: [{
        role: 'user',
        content: `Você é um extrator especializado de dados de editais de licitação pública brasileira. Analise o texto REAL do documento abaixo e extraia TODOS os dados estruturados.

REGRA FUNDAMENTAL: Extraia SOMENTE informações que REALMENTE existem no texto. NÃO invente dados. NÃO suponha valores. Se uma informação não está no documento, use string vazia "".

ATENÇÃO ESPECIAL — busque cuidadosamente TODOS estes campos no documento:
1. PRAZO DE ENTREGA — pode estar em seções como "Das Condições de Entrega", "Da Entrega", "Prazo de Execução", "Do Fornecimento", no Termo de Referência ou em Cláusulas do Contrato
2. LOCAL DE ENTREGA — pode estar nas mesmas seções acima, geralmente com endereço completo
3. PRAZO/CONDIÇÕES DE PAGAMENTO — seções como "Do Pagamento", "Das Condições de Pagamento"
4. LIQUIDAÇÃO/NFe — como deve ser emitida a Nota Fiscal e condições de liquidação
5. PRAZO DE VALIDADE DA PROPOSTA — geralmente 60 dias, mas extraia o valor EXATO do edital
6. GARANTIA — prazo de garantia dos produtos/serviços conforme o edital

Retorne APENAS JSON válido, sem explicações:
{
  "numeroLicitacao": "número completo do pregão/licitação conforme o documento",
  "orgao": "nome EXATO do órgão licitante conforme o documento",
  "modalidade": "modalidade EXATA (Pregão Eletrônico, Concorrência, Dispensa, etc)",
  "objeto": "descrição EXATA do objeto conforme escrito no edital",
  "valorEstimado": "valor estimado EXATO se mencionado no documento",
  "prazoValidade": "prazo de validade da proposta conforme o edital (ex: '60 dias corridos')",
  "prazoPagamento": "condições/prazo de pagamento COMPLETOS conforme o edital, incluindo forma de pagamento",
  "prazoEntrega": "prazo de entrega COMPLETO conforme o edital (ex: 'Até 15 dias úteis após emissão da Ordem de Fornecimento')",
  "localEntrega": "local de entrega COMPLETO com endereço conforme o edital",
  "liquidacaoNfe": "condições de liquidação e emissão de Nota Fiscal conforme o edital",
  "garantia": "prazo e condições de garantia conforme o edital",
  "condicoesEntrega": "horários, dias, agendamento e outras condições de entrega conforme o edital",
  "itens": [
    {
      "item": "1",
      "descricao": "descrição FIEL e COMPLETA ao documento, incluindo TODAS as especificações técnicas",
      "quantidade": "quantidade EXATA conforme o edital",
      "unidade": "unidade de medida EXATA (UN, CX, PCT, KG, PACOTES, etc)",
      "marca": "marca se especificada no edital ou vazio",
      "fabricante": "fabricante se especificado ou vazio",
      "modelo": "modelo se especificado ou vazio",
      "valorUnitario": "valor unitário de referência se mencionado",
      "valorTotal": "valor total se mencionado"
    }
  ]
}

REGRAS CRÍTICAS:
- Copie descrições FIELMENTE do documento, incluindo especificações técnicas completas
- NÃO resuma nem abrevie as descrições dos itens — copie na íntegra
- NÃO substitua por produtos diferentes do que está escrito
- NÃO invente valores de referência que não existem no documento
- Se não encontrar um campo, use string vazia ""
- Retorne APENAS JSON válido

TEXTO DO DOCUMENTO:
${truncated}`
      }],
      action: 'analise_edital',
      onDelta: (chunk) => {
        content += chunk;
        setProgress('Extraindo dados do edital...');
      },
      onDone: async () => {
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

            // Persist items centrally if licitacaoId is available
            if (licitacaoId && itens.length > 0) {
              await saveItensManual(licitacaoId, itens.map((item, idx) => ({
                numero: parseInt(item.item) || idx + 1,
                descricao: item.descricao,
                quantidade: parseFloat(item.quantidade) || 1,
                unidade: item.unidade,
                valor_unitario: parseFloat(item.valorUnitario.replace(',', '.')) || 0,
                valor_total: parseFloat(item.valorTotal.replace(',', '.')) || 0,
                marca: item.marca || null,
                fabricante: item.fabricante || null,
                modelo: item.modelo || null,
                origem: 'ia',
                lote: 'Único',
                licitacao_id: licitacaoId,
                user_id: '',
              })));
              setHasExistingItens(true);
            }

            // Store for suggestion component
            extractedItensRef.current = itens.map((item, idx) => ({
              numero: parseInt(item.item) || idx + 1,
              descricao: item.descricao,
              quantidade: parseFloat(item.quantidade) || 1,
              unidade: item.unidade,
              valor_unitario: parseFloat(item.valorUnitario.replace(',', '.')) || 0,
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
                  <Badge className="ml-2 bg-accent/10 text-accent border-accent/20 text-[10px]">
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
            <>
              <div className="flex items-center gap-2 p-2.5 bg-accent/5 border border-accent/20 rounded-lg">
                <CheckCircle className="w-4 h-4 text-accent shrink-0" />
                <p className="text-xs text-accent">
                  Extração concluída! Avance para revisar e editar os dados extraídos nas próximas etapas.
                </p>
              </div>

              {licitacaoId && (
                <SugestaoMarcasReview
                  licitacaoId={licitacaoId}
                  itens={extractedItensRef.current}
                  onMarcaAplicada={(itemId, marca) => {
                    toast.success(`Marca "${marca}" aplicada com sucesso!`);
                  }}
                />
              )}
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Show "Import existing items" button if centralized items exist */}
          {hasExistingItens && licitacaoId && (
            <button
              type="button"
              onClick={async () => {
                setIsExtracting(true);
                setProgress('Importando itens já extraídos...');
                const items = await fetchItens(licitacaoId);
                const itens: EditalItem[] = items.map(i => ({
                  item: String(i.numero),
                  descricao: i.descricao,
                  quantidade: String(i.quantidade),
                  unidade: i.unidade,
                  marca: i.marca || '',
                  fabricante: i.fabricante || '',
                  modelo: i.modelo || '',
                  valorUnitario: String(i.valor_unitario),
                  valorUnitarioExtenso: '',
                  valorTotal: String(i.valor_total),
                  valorTotalExtenso: '',
                }));
                onExtracted({
                  numeroLicitacao: '', orgao: '', modalidade: 'Pregão Eletrônico',
                  objeto: '', valorEstimado: '', prazoValidade: '60 dias corridos',
                  prazoPagamento: '', prazoEntrega: '', localEntrega: '',
                  liquidacaoNfe: '', itens, rawText: '',
                });
                setExtracted(true);
                setIsExtracting(false);
                setProgress('');
                toast.success(`${itens.length} itens importados da extração anterior!`);
              }}
              className="w-full border-2 border-accent/40 bg-accent/5 rounded-xl p-4 flex items-center gap-3 hover:bg-accent/10 transition-all"
            >
              <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                <Download className="w-5 h-5 text-accent" />
              </div>
              <div className="text-left flex-1">
                <span className="text-sm font-semibold text-foreground block">Importar itens já extraídos</span>
                <span className="text-xs text-muted-foreground">Reutilize a extração centralizada desta licitação</span>
              </div>
            </button>
          )}
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
        </div>
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
