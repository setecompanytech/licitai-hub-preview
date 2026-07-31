import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileText, Loader2, RefreshCw, AlertTriangle, ExternalLink, Download, Maximize2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ArquivoPncp {
  sequencial: number;
  nome: string;
  titulo: string;
  tipo: string;
  data_publicacao: string | null;
  url: string | null;
  extensao: string;
}

interface Props {
  licitacaoId: string;
  urlEdital?: string;
}

const VISUALIZAVEL = ['pdf'];

/**
 * Lê os arquivos da contratação no PNCP e exibe o selecionado num frame,
 * sem sair da aplicação. O arquivo é materializado no bucket privado pela
 * Edge Function `pncp-arquivos-edital` — assim ele continua abrindo mesmo
 * quando o portal está fora do ar.
 */
export default function EditalViewer({ licitacaoId, urlEdital }: Props) {
  const [arquivos, setArquivos] = useState<ArquivoPncp[]>([]);
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [selecionado, setSelecionado] = useState<ArquivoPncp | null>(null);
  const [abrindo, setAbrindo] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [erroArquivo, setErroArquivo] = useState<string | null>(null);

  // A contratação pode não ser rastreável até o PNCP (processo de outro portal,
  // sem correspondência no cache). Nesse caso o card some da tela em vez de
  // mostrar um erro que o usuário não tem como resolver.
  const [semFontePncp, setSemFontePncp] = useState(false);

  const carregarLista = useCallback(async () => {
    setCarregandoLista(true);
    setErroLista(null);
    try {
      const { data, error } = await supabase.functions.invoke('pncp-arquivos-edital', {
        body: { licitacao_id: licitacaoId, action: 'listar' },
      });
      if (data?.sem_fonte_pncp) {
        setSemFontePncp(true);
        setArquivos([]);
        return;
      }
      if (error || !data?.success) {
        setErroLista(error?.message || data?.error || 'Não foi possível listar os arquivos no PNCP.');
        setArquivos([]);
        return;
      }
      setArquivos(data.arquivos || []);
    } catch (e) {
      setErroLista(e instanceof Error ? e.message : 'Erro ao consultar o PNCP.');
    } finally {
      setCarregandoLista(false);
    }
  }, [licitacaoId]);

  useEffect(() => { carregarLista(); }, [carregarLista]);

  const abrirArquivo = async (arq: ArquivoPncp) => {
    setSelecionado(arq);
    setSignedUrl(null);
    setErroArquivo(null);
    setAbrindo(true);
    try {
      const { data, error } = await supabase.functions.invoke('pncp-arquivos-edital', {
        body: { licitacao_id: licitacaoId, action: 'abrir', sequencial: arq.sequencial },
      });
      if (error || !data?.success || !data?.path) {
        setErroArquivo(error?.message || data?.error || 'Não foi possível baixar este arquivo do PNCP.');
        return;
      }

      const { data: signed, error: signErr } = await supabase.storage
        .from('processo-arquivos')
        .createSignedUrl(data.path, 60 * 60);

      if (signErr || !signed?.signedUrl) {
        setErroArquivo('Arquivo baixado, mas não foi possível gerar o link de visualização.');
        return;
      }
      setSignedUrl(signed.signedUrl);
      if (data.cached === false) toast.success(`${arq.titulo} carregado do PNCP.`);
    } catch (e) {
      setErroArquivo(e instanceof Error ? e.message : 'Erro ao abrir o arquivo.');
    } finally {
      setAbrindo(false);
    }
  };

  // Primeiro arquivo com "edital" no título abre sozinho
  useEffect(() => {
    if (selecionado || arquivos.length === 0) return;
    const preferido =
      arquivos.find((a) => /edital/i.test(a.titulo) && a.extensao === 'pdf') ||
      arquivos.find((a) => a.extensao === 'pdf') ||
      arquivos[0];
    if (preferido) abrirArquivo(preferido);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arquivos]);

  if (semFontePncp) return null;

  const podeExibirNoFrame = selecionado && VISUALIZAVEL.includes(selecionado.extensao);

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <FileText className="w-4 h-4 text-accent" />
        <h3 className="font-semibold text-sm">Edital em tela</h3>
        {arquivos.length > 0 && (
          <Badge variant="secondary" className="text-xs">{arquivos.length} arquivos no PNCP</Badge>
        )}
        <div className="flex-1" />
        <Button size="sm" variant="ghost" onClick={carregarLista} disabled={carregandoLista}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${carregandoLista ? 'animate-spin' : ''}`} />
          Atualizar lista
        </Button>
      </div>

      {carregandoLista && arquivos.length === 0 && (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Consultando os arquivos no PNCP…
        </div>
      )}

      {erroLista && (
        <div className="flex items-start gap-2 p-3 rounded-md border border-warning/40 bg-warning/10 text-xs">
          <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p>{erroLista}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={carregarLista}>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Tentar novamente
              </Button>
              {urlEdital && (
                <Button asChild size="sm" variant="ghost">
                  <a href={urlEdital} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Abrir no PNCP
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {arquivos.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-3">
          {/* Lista de arquivos */}
          <div className="border border-border rounded-md divide-y divide-border/60 max-h-[620px] overflow-y-auto">
            {arquivos.map((a) => {
              const ativo = selecionado?.sequencial === a.sequencial;
              return (
                <button
                  key={a.sequencial}
                  type="button"
                  onClick={() => abrirArquivo(a)}
                  className={`w-full text-left p-2.5 transition hover:bg-muted/50 ${ativo ? 'bg-accent/10 border-l-2 border-l-accent' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    <FileText className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${ativo ? 'text-accent' : 'text-muted-foreground'}`} />
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{a.titulo}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <Badge variant="outline" className="text-[9px] uppercase">{a.extensao}</Badge>
                        <span className="text-[10px] text-muted-foreground truncate">{a.tipo}</span>
                        {a.data_publicacao && (
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(a.data_publicacao).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Frame do arquivo */}
          <div className="border border-border rounded-md overflow-hidden bg-muted/20 min-h-[420px] flex flex-col">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card">
              <span className="text-xs font-medium truncate flex-1">
                {selecionado ? selecionado.titulo : 'Selecione um arquivo'}
              </span>
              {signedUrl && (
                <>
                  <Button asChild size="sm" variant="ghost" className="h-7">
                    <a href={signedUrl} target="_blank" rel="noopener noreferrer" title="Abrir em nova aba">
                      <Maximize2 className="w-3.5 h-3.5" />
                    </a>
                  </Button>
                  <Button asChild size="sm" variant="ghost" className="h-7">
                    <a href={signedUrl} download={selecionado?.nome} title="Baixar">
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  </Button>
                </>
              )}
            </div>

            <div className="flex-1 relative">
              {abrindo && (
                <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground bg-background/60 z-10">
                  <Loader2 className="w-4 h-4 animate-spin" /> Baixando do PNCP…
                </div>
              )}

              {erroArquivo && (
                <div className="p-6 text-center space-y-3">
                  <AlertTriangle className="w-8 h-8 mx-auto text-warning" />
                  <p className="text-xs text-muted-foreground">{erroArquivo}</p>
                  {urlEdital && (
                    <Button asChild size="sm" variant="outline">
                      <a href={urlEdital} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Abrir no PNCP
                      </a>
                    </Button>
                  )}
                </div>
              )}

              {signedUrl && podeExibirNoFrame && (
                <iframe
                  src={signedUrl}
                  title={selecionado?.titulo || 'Edital'}
                  className="w-full h-[600px] border-0 bg-white"
                />
              )}

              {signedUrl && !podeExibirNoFrame && (
                <div className="p-6 text-center space-y-3">
                  <FileText className="w-8 h-8 mx-auto text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">
                    <strong>{selecionado?.nome}</strong> é um arquivo <strong>.{selecionado?.extensao}</strong> —
                    o navegador não renderiza esse formato. Baixe para abrir no aplicativo correspondente.
                  </p>
                  <Button asChild size="sm" variant="outline">
                    <a href={signedUrl} download={selecionado?.nome}>
                      <Download className="w-3.5 h-3.5 mr-1.5" /> Baixar {selecionado?.extensao.toUpperCase()}
                    </a>
                  </Button>
                </div>
              )}

              {!signedUrl && !abrindo && !erroArquivo && (
                <div className="p-10 text-center text-xs text-muted-foreground">
                  Escolha um arquivo na lista ao lado para visualizar aqui.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!carregandoLista && !erroLista && arquivos.length === 0 && (
        <p className="text-xs text-muted-foreground py-6 text-center">
          O PNCP não retornou arquivos para esta contratação.
        </p>
      )}
    </Card>
  );
}
