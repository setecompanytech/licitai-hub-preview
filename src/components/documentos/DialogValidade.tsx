import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Bot, CalendarDays, CheckCircle2, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
// A escolha de qual data é a validade tem teste próprio: um documento fiscal
// traz emissão, hora e prazo juntos, e a errada manda renovar o que está bom —
// ou leva a empresa à sessão com certidão vencida.
import { extrairValidadeDoTexto, montarData, normalizarEspacos } from '@/lib/documentos/validade';

type VisionImage = { name: string; dataUrl: string };
type DocumentAnalysisPayload = { images: VisionImage[]; supportText: string };

const imageFileToVisionPayload = async (file: File): Promise<VisionImage[]> =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      try {
        const maxDimension = 1800;
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Não foi possível preparar a imagem para análise.'));
          return;
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve([{ name: file.name, dataUrl: canvas.toDataURL('image/jpeg', 0.9) }]);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Não foi possível abrir a imagem enviada.'));
    };

    img.src = objectUrl;
  });

/* O documento e os itens de texto do pdf.js chegam sem tipo utilizável: a
   biblioteca é carregada por import dinâmico e o formato de `TextItem` muda
   entre versões menores. O `any` aqui é do pdf.js, não da nossa modelagem —
   herdado da tela anterior, inclusive. */
/* eslint-disable @typescript-eslint/no-explicit-any */
const extractPdfSupportText = async (pdf: any, maxPages: number) => {
  const pageTexts: string[] = [];
  for (let i = 1; i <= maxPages; i += 1) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    pageTexts.push(textContent.items.map((item: any) => ('str' in item ? item.str : '')).join(' '));
  }
  return normalizarEspacos(pageTexts.join('\n'));
};

const renderPdfToVisionImages = async (pdf: any, fileName: string, maxPages: number): Promise<VisionImage[]> => {
  const images: VisionImage[] = [];
  for (let i = 1; i <= maxPages; i += 1) {
    const page = await pdf.getPage(i);
    const firstViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(
      1.5,
      1600 / Math.max(firstViewport.width, 1),
      1600 / Math.max(firstViewport.height, 1),
    );
    const viewport = page.getViewport({ scale: Math.max(scale, 0.5) });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    await page.render({ canvasContext: ctx, viewport }).promise;
    images.push({ name: `${fileName}_p${i}`, dataUrl: canvas.toDataURL('image/jpeg', 0.88) });
  }
  return images;
};

const buildDocumentAnalysisPayload = async (file: File): Promise<DocumentAnalysisPayload> => {
  if (file.type.startsWith('image/')) {
    return { images: await imageFileToVisionPayload(file), supportText: '' };
  }

  if (file.type === 'application/pdf') {
    const pdfjsLib = await import('pdfjs-dist');
    // O worker entra por import DINÂMICO, e não no topo do módulo: ele é um
    // `?url` de um bundle de ~1MB que era carregado por toda pessoa que abria a
    // tela — inclusive quem nunca clicou em "Sugerir validade por IA".
    const { default: pdfjsWorker } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

    const arrayBuffer = await file.arrayBuffer();
    let pdf: any;
    try {
      pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    } catch {
      pdf = await pdfjsLib.getDocument({ data: arrayBuffer, disableWorker: true } as any).promise;
    }

    const maxPages = Math.min(pdf.numPages, 3);
    const [supportText, images] = await Promise.all([
      extractPdfSupportText(pdf, maxPages),
      renderPdfToVisionImages(pdf, file.name, maxPages),
    ]);
    return { images, supportText };
  }

  return { images: [], supportText: '' };
};
/* eslint-enable @typescript-eslint/no-explicit-any */

interface Props {
  aberto: boolean;
  aoFechar: () => void;
  /** Vaga do checklist a que a validade pertence. */
  nomeDoDocumento: string;
  /** O documento tem prazo por natureza? Vem de `VAGAS_PREVISTAS.vence`. */
  vencePorNatureza: boolean;
  /**
   * Arquivo a enviar. `null` põe o diálogo em modo METADADOS — editar a
   * validade de um documento já anexado, sem subir arquivo nenhum.
   */
  arquivo: File | null;
  /** Validade já gravada (`AAAA-MM-DD`), para o campo nascer preenchido. */
  validadeInicial?: string;
  salvando: boolean;
  /** `undefined` = seguir sem validade. */
  aoConfirmar: (validade?: string) => void;
}

/**
 * O diálogo de validade — do envio e da edição.
 *
 * Saiu da tela para cá junto com a leitura do PDF: eram 170 linhas de canvas,
 * worker e pdf.js dentro de uma página que trata de outra coisa. A separação
 * também rendeu a correção do worker (ver acima).
 *
 * Os dois modos compartilham tudo menos o rodapé, porque a PERGUNTA é a mesma
 * ("até quando este documento vale?") e a resposta se dá do mesmo jeito —
 * calendário, digitação ou leitura automática.
 */
export default function DialogValidade({
  aberto,
  aoFechar,
  nomeDoDocumento,
  vencePorNatureza,
  arquivo,
  validadeInicial,
  salvando,
  aoConfirmar,
}: Props) {
  const [dataEscolhida, setDataEscolhida] = useState<Date | undefined>(undefined);
  const [textoDigitado, setTextoDigitado] = useState('');
  const [analisando, setAnalisando] = useState(false);

  // Reabre sempre com a validade do documento CLICADO. Sem isto, a data do
  // documento anterior ficava no campo e era gravada no seguinte.
  useEffect(() => {
    if (!aberto) return;
    const m = validadeInicial?.match(/^(\d{4})-(\d{2})-(\d{2})/);
    const d = m ? montarData(Number(m[1]), Number(m[2]), Number(m[3])) : null;
    setDataEscolhida(d ?? undefined);
    setTextoDigitado(d ? format(d, 'yyyy-MM-dd') : '');
    setAnalisando(false);
  }, [aberto, validadeInicial]);

  const modoEdicao = arquivo === null;

  const confirmar = (comValidade: boolean) => {
    if (!comValidade) { aoConfirmar(undefined); return; }
    const valor = dataEscolhida
      ? format(dataEscolhida, 'yyyy-MM-dd')
      : textoDigitado || undefined;
    aoConfirmar(valor);
  };

  const analisarPorIA = async () => {
    if (!arquivo) return;
    setAnalisando(true);
    try {
      const { images, supportText } = await buildDocumentAnalysisPayload(arquivo);
      const local = extrairValidadeDoTexto(supportText);
      if (local) {
        setDataEscolhida(local);
        setTextoDigitado(format(local, 'yyyy-MM-dd'));
        toast.success(`Validade identificada: ${format(local, 'dd/MM/yyyy')}`);
        return;
      }

      if (images.length === 0 && supportText.length < 10) {
        toast.error('Não foi possível preparar o arquivo para análise automática.');
        return;
      }

      const { data, error } = await supabase.functions.invoke('document-vision-extract', {
        body: { fileName: nomeDoDocumento, images, text: supportText, mode: 'document_validity' },
      });
      if (error) throw error;

      const sugerida = typeof data?.validityDate === 'string'
        ? extrairValidadeDoTexto(data.validityDate)
        : null;
      const reserva = [
        typeof data?.evidenceText === 'string' ? data.evidenceText : '',
        typeof data?.text === 'string' ? data.text : '',
        supportText,
      ].filter(Boolean).join('\n');

      const achada = sugerida ?? extrairValidadeDoTexto(reserva);
      if (achada) {
        setDataEscolhida(achada);
        setTextoDigitado(format(achada, 'yyyy-MM-dd'));
        toast.success(`Validade identificada: ${format(achada, 'dd/MM/yyyy')}`);
      } else {
        toast.info('Não identifiquei uma data de validade neste documento.');
      }
    } catch (erro) {
      console.error(erro);
      toast.error('Erro na análise por IA. Informe a validade manualmente.');
    } finally {
      setAnalisando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(v) => { if (!v && !salvando) aoFechar(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            {modoEdicao ? 'Editar validade' : 'Validade do documento'}
          </DialogTitle>
          <DialogDescription>{nomeDoDocumento}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Documento que NÃO vence por natureza não é cobrado de data — dizê-lo
              aqui evita que alguém invente uma validade para o contrato social
              só porque o campo estava na frente. */}
          {!vencePorNatureza && (
            <Alert>
              <AlertDescription>
                Este documento não tem prazo por natureza. Você pode seguir sem informar validade.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="validade-seletor" className="g-corpo font-medium">
              Data de validade
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="validade-seletor"
                  variant="outline"
                  className={cn(
                    'g-controle w-full justify-start rounded-[var(--g-raio)] text-left font-normal',
                    !dataEscolhida && 'text-muted-foreground',
                  )}
                >
                  <CalendarDays className="mr-2 h-4 w-4" aria-hidden="true" />
                  {dataEscolhida
                    ? format(dataEscolhida, 'dd/MM/yyyy', { locale: ptBR })
                    : 'Selecione a validade'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataEscolhida}
                  onSelect={(d) => {
                    setDataEscolhida(d);
                    if (d) setTextoDigitado(format(d, 'yyyy-MM-dd'));
                  }}
                  initialFocus
                  className="pointer-events-auto p-3"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="validade-digitada" className="g-corpo font-medium">
              Ou digite: DD/MM/AAAA
            </Label>
            <Input
              id="validade-digitada"
              placeholder="DD/MM/AAAA"
              className="g-controle rounded-[var(--g-raio)]"
              // `new Date('2026-07-10')` é meia-noite UTC, que no horário de
              // Brasília é dia 09 às 21h. Era isso que fazia o seletor mostrar
              // 10/07 e este campo, 09/07 — e digitar 10/07/2026 gravar
              // 2026-07-09. Data de calendário se monta por partes.
              value={textoDigitado ? (() => {
                const m = textoDigitado.match(/^(\d{4})-(\d{2})-(\d{2})$/);
                const d = m ? montarData(Number(m[1]), Number(m[2]), Number(m[3])) : null;
                return d ? format(d, 'dd/MM/yyyy') : textoDigitado;
              })() : ''}
              onChange={(e) => {
                const valor = e.target.value;
                const m = valor.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
                if (m) {
                  const d = montarData(Number(m[3]), Number(m[2]), Number(m[1]));
                  if (d) {
                    setDataEscolhida(d);
                    setTextoDigitado(format(d, 'yyyy-MM-dd'));
                    return;
                  }
                }
                setTextoDigitado(valor);
              }}
            />
          </div>

          {/* A leitura automática precisa do ARQUIVO em mãos; na edição de
              metadados ele está no armazenamento, não aqui. */}
          {!modoEdicao && (
            <Button
              variant="outline"
              className="g-controle w-full rounded-[var(--g-raio)]"
              onClick={analisarPorIA}
              disabled={analisando}
            >
              {analisando
                ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                : <Bot className="h-4 w-4" aria-hidden="true" />}
              {analisando ? 'Lendo o documento…' : 'Sugerir validade por IA'}
            </Button>
          )}

          {dataEscolhida && (
            <Alert variant="success">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>
                Validade: <strong>{format(dataEscolhida, 'dd/MM/yyyy')}</strong>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex flex-wrap gap-2">
          {modoEdicao ? (
            <>
              <Button variant="ghost" onClick={aoFechar} disabled={salvando}>
                Cancelar
              </Button>
              <Button onClick={() => confirmar(true)} disabled={salvando}>
                {salvando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Salvar validade
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => confirmar(false)} disabled={salvando}>
                Pular (sem validade)
              </Button>
              <Button onClick={() => confirmar(true)} disabled={salvando}>
                {salvando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Confirmar e enviar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
