import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle2, AlertTriangle, Download, FileArchive, Loader2, Bot,
  Shield, FileText, ClipboardCheck, Package, ArrowRight, Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

type DocResult = {
  nome: string;
  categoria: string;
  artigo_referencia?: string;
  obrigatorio: boolean;
  observacao?: string;
  encontrado: boolean;
  documento_match?: {
    id: string;
    nome: string;
    arquivo_path: string;
    source: string;
  } | null;
};

type VerificacaoResult = {
  total_exigidos: number;
  total_encontrados: number;
  total_faltantes: number;
  prazo_entrega: string | null;
  forma_apresentacao: string | null;
  documentos: DocResult[];
  arquivos_download: { nome: string; url: string; path: string }[];
};

interface Props {
  editalTexto: string;
  licitacaoId?: string | null;
  licitacaoNumero?: string;
}

const categoriaCor: Record<string, string> = {
  'Habilitação Jurídica': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  'Regularidade Fiscal': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  'Qualificação Técnica': 'bg-violet-500/10 text-violet-600 border-violet-500/20',
  'Qualif. Econômico-Financeira': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  'Declarações': 'bg-sky-500/10 text-sky-600 border-sky-500/20',
  'Proposta': 'bg-pink-500/10 text-pink-600 border-pink-500/20',
  'Outros': 'bg-gray-500/10 text-gray-600 border-gray-500/20',
};

export default function VerificadorDocumentos({ editalTexto, licitacaoId, licitacaoNumero }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerificacaoResult | null>(null);
  const [downloading, setDownloading] = useState(false);

  const verificar = useCallback(async () => {
    if (!editalTexto || editalTexto.trim().length < 50) {
      toast.error('Texto do edital insuficiente para análise');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) { toast.error('Sessão expirada'); return; }

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verificar-documentos-edital`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          edital_texto: editalTexto,
          licitacao_id: licitacaoId || null,
        }),
      });

      if (resp.status === 429) { toast.error('Limite de requisições excedido. Aguarde.'); return; }
      if (resp.status === 402) { toast.error('Créditos de IA insuficientes.'); return; }

      const data = await resp.json();
      if (!resp.ok) { toast.error(data.error || 'Erro ao verificar documentos'); return; }

      setResult(data);
      toast.success(`Análise concluída: ${data.total_encontrados} encontrados, ${data.total_faltantes} faltantes`);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao processar verificação');
    } finally {
      setLoading(false);
    }
  }, [editalTexto, licitacaoId]);

  const baixarZip = useCallback(async () => {
    if (!result?.arquivos_download?.length) {
      toast.error('Nenhum arquivo disponível para download');
      return;
    }

    setDownloading(true);
    try {
      const zip = new JSZip();
      let count = 0;

      for (const arq of result.arquivos_download) {
        try {
          const resp = await fetch(arq.url);
          if (!resp.ok) continue;
          const blob = await resp.blob();
          const ext = arq.path.split('.').pop() || 'pdf';
          const safeName = arq.nome.replace(/[^a-zA-Z0-9À-ÿ\s\-_]/g, '').trim().slice(0, 60);
          zip.file(`${safeName}.${ext}`, blob);
          count++;
        } catch { /* skip failed downloads */ }
      }

      if (count === 0) {
        toast.error('Nenhum arquivo pôde ser baixado');
        return;
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const fileName = `Documentos_Habilitacao_${licitacaoNumero || 'Processo'}.zip`;
      saveAs(zipBlob, fileName);
      toast.success(`${count} documento(s) empacotados em ZIP`);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao gerar arquivo ZIP');
    } finally {
      setDownloading(false);
    }
  }, [result, licitacaoNumero]);

  const encontrados = result?.documentos.filter(d => d.encontrado) || [];
  const faltantes = result?.documentos.filter(d => !d.encontrado) || [];

  // Group by category
  const groupBy = (docs: DocResult[]) => {
    const groups: Record<string, DocResult[]> = {};
    docs.forEach(d => {
      const cat = d.categoria || 'Outros';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(d);
    });
    return groups;
  };

  const pctEncontrado = result ? Math.round((result.total_encontrados / Math.max(result.total_exigidos, 1)) * 100) : 0;

  return (
    <Card className="border-accent/30 bg-gradient-to-br from-background to-accent/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bot className="w-5 h-5 text-accent" />
          Conferência Documental por IA
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          A IA lê o edital, identifica todos os documentos exigidos e cruza com os já anexados no sistema.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {!result && (
          <Button
            onClick={verificar}
            disabled={loading || !editalTexto || editalTexto.length < 50}
            className="w-full gap-2"
            variant="default"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analisando edital...
              </>
            ) : (
              <>
                <ClipboardCheck className="w-4 h-4" />
                Verificar Documentos do Edital
              </>
            )}
          </Button>
        )}

        {loading && (
          <div className="space-y-2 animate-pulse">
            <Progress value={45} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              Extraindo documentos exigidos e cruzando com o sistema...
            </p>
          </div>
        )}

        {result && (
          <>
            {/* Summary */}
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <p className="text-lg font-bold">{result.total_exigidos}</p>
                <p className="text-xs text-muted-foreground">Exigidos</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-success/10">
                <p className="text-lg font-bold text-success">{result.total_encontrados}</p>
                <p className="text-xs text-muted-foreground">Encontrados</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-destructive/10">
                <p className="text-lg font-bold text-destructive">{result.total_faltantes}</p>
                <p className="text-xs text-muted-foreground">Faltantes</p>
              </div>
            </div>

            <Progress value={pctEncontrado} className="h-2" />

            {result.prazo_entrega && (
              <div className="flex items-center gap-2 text-xs bg-warning/10 text-warning rounded-md p-2">
                <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Prazo: {result.prazo_entrega}</span>
              </div>
            )}

            {/* Download ZIP */}
            {result.arquivos_download.length > 0 && (
              <Button
                onClick={baixarZip}
                disabled={downloading}
                variant="outline"
                className="w-full gap-2 border-accent/40 hover:bg-accent/10"
              >
                {downloading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileArchive className="w-4 h-4 text-accent" />
                )}
                Baixar {result.arquivos_download.length} documento(s) em ZIP
              </Button>
            )}

            <Separator />

            {/* Found documents */}
            {encontrados.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-1.5 text-success">
                  <CheckCircle2 className="w-4 h-4" />
                  Documentos Encontrados ({encontrados.length})
                </h4>
                {Object.entries(groupBy(encontrados)).map(([cat, docs]) => (
                  <div key={cat} className="space-y-1">
                    <Badge variant="outline" className={`text-xs ${categoriaCor[cat] || categoriaCor['Outros']}`}>
                      {cat}
                    </Badge>
                    {docs.map((doc, i) => (
                      <div key={i} className="flex items-start gap-2 pl-2 py-1 text-xs">
                        <CheckCircle2 className="w-3 h-3 text-success mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium truncate">{doc.nome}</p>
                          {doc.artigo_referencia && (
                            <p className="text-muted-foreground text-xs">{doc.artigo_referencia}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* Missing documents - ALERT */}
            {faltantes.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-2 rounded-md bg-destructive/10 border border-destructive/20">
                  <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-destructive">
                      {faltantes.length} documento(s) não encontrado(s)
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Anexe esses documentos antes de submeter a habilitação
                    </p>
                  </div>
                </div>

                {Object.entries(groupBy(faltantes)).map(([cat, docs]) => (
                  <div key={cat} className="space-y-1">
                    <Badge variant="outline" className={`text-xs ${categoriaCor[cat] || categoriaCor['Outros']}`}>
                      {cat}
                    </Badge>
                    {docs.map((doc, i) => (
                      <div key={i} className="flex items-start gap-2 pl-2 py-1 text-xs">
                        <AlertTriangle className="w-3 h-3 text-destructive mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium truncate">{doc.nome}</p>
                          {doc.observacao && (
                            <p className="text-muted-foreground text-xs">{doc.observacao}</p>
                          )}
                          {doc.artigo_referencia && (
                            <p className="text-muted-foreground text-xs">{doc.artigo_referencia}</p>
                          )}
                        </div>
                        {doc.obrigatorio && (
                          <Badge variant="destructive" className="text-xs px-1 h-4 ml-auto flex-shrink-0">
                            Obrigatório
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* Re-check */}
            <Button
              onClick={() => { setResult(null); }}
              variant="ghost"
              size="sm"
              className="w-full text-xs"
            >
              Nova Verificação
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
