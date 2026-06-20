import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, Loader2, RefreshCw, AlertTriangle, ExternalLink, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useProcessoAutoPrepare } from '@/hooks/useProcessoAutoPrepare';
import { toast } from 'sonner';

interface Props {
  licitacaoId: string;
  urlEdital?: string;
}

export default function EditalOriginalCard({ licitacaoId, urlEdital }: Props) {
  const { prepared, running, editalPdfPath, totalItens, trigger } = useProcessoAutoPrepare(
    licitacaoId,
    { autoRun: true },
  );
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(false);

  useEffect(() => {
    if (!editalPdfPath) { setSignedUrl(null); return; }
    let cancelled = false;
    setLoadingUrl(true);
    supabase.storage
      .from('processo-arquivos')
      .createSignedUrl(editalPdfPath, 60 * 60)
      .then(({ data }) => { if (!cancelled) setSignedUrl(data?.signedUrl ?? null); })
      .finally(() => { if (!cancelled) setLoadingUrl(false); });
    return () => { cancelled = true; };
  }, [editalPdfPath]);

  const handleReprocess = async () => {
    toast.info('Refazendo preparação automática…');
    const ok = await trigger(true);
    if (ok) toast.success('Pasta preparada com sucesso.');
    else toast.warning('Não foi possível concluir a preparação automática. Tente abrir o edital diretamente no portal de origem.');
  };

  const isPncp = !!urlEdital?.includes('pncp.gov.br');
  const unavailable = !prepared && !running;

  return (
    <Card className="p-4 border-accent/30">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-md bg-accent/10 flex items-center justify-center shrink-0">
          <FileText className="w-5 h-5 text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm">Edital Original</h3>
            {prepared && (
              <Badge variant="outline" className="gap-1 text-xs">
                <CheckCircle2 className="w-3 h-3 text-success" /> Pronto
              </Badge>
            )}
            {running && (
              <Badge variant="outline" className="gap-1 text-xs">
                <Loader2 className="w-3 h-3 animate-spin" /> Preparando…
              </Badge>
            )}
            {unavailable && (
              <Badge variant="outline" className="gap-1 text-xs">
                <AlertTriangle className="w-3 h-3 text-warning" /> Indisponível
              </Badge>
            )}
            {totalItens != null && totalItens > 0 && (
              <Badge variant="secondary" className="text-xs">
                {totalItens} itens extraídos
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {prepared
              ? 'O PDF do edital foi baixado automaticamente e está disponível para consulta nesta pasta.'
              : running
              ? 'Buscando o edital original na fonte e extraindo os itens em segundo plano…'
              : isPncp
              ? 'Não foi possível baixar o PDF automaticamente. Use o botão abaixo para acessar o edital no PNCP ou tente novamente.'
              : 'O sistema tenta baixar o PDF e extrair os itens automaticamente quando você marca interesse no processo.'}
          </p>

          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {signedUrl && (
              <>
                <Button asChild size="sm" variant="outline">
                  <a href={signedUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Abrir PDF
                  </a>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <a href={signedUrl} download="edital-original.pdf">
                    <Download className="w-3.5 h-3.5 mr-1.5" /> Baixar
                  </a>
                </Button>
              </>
            )}
            {loadingUrl && (
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Gerando link…
              </span>
            )}
            {/* Link direto ao portal quando PDF não está disponível */}
            {unavailable && urlEdital && (
              <Button asChild size="sm" variant="outline">
                <a href={urlEdital} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                  {isPncp ? 'Ver no PNCP' : 'Ver edital'}
                </a>
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={handleReprocess} disabled={running}>
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${running ? 'animate-spin' : ''}`} />
              {prepared ? 'Atualizar' : 'Tentar novamente'}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
