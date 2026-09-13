import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import EstadoVazio from '@/components/shared/EstadoVazio';
import {
  FileText, Loader2, RefreshCw, AlertTriangle, ExternalLink, Download, Maximize2,
} from 'lucide-react';
import ConteudoDoZip from '@/components/workspace/ConteudoDoZip';
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
  /** Informa quantos arquivos existem no PNCP — a pasta Edital soma no contador. */
  onArquivosPncp?: (n: number) => void;
}

const VISUALIZAVEL = ['pdf'];

/**
 * Em resposta não-2xx o supabase-js devolve FunctionsHttpError, cujo `message`
 * é sempre genérico ("non-2xx status code"). A causa real vem no corpo, então
 * lemos a Response anexada antes de cair no texto padrão.
 */
async function mensagemDoErro(error: unknown, fallback: string): Promise<string> {
  // FunctionsHttpError.context É a Response (não um envelope) — ler direto,
  // com tolerância à forma antiga { response }.
  const ctx = (error as { context?: Response & { response?: Response } })?.context;
  const resp = ctx && typeof (ctx as Response).clone === 'function' ? (ctx as Response) : ctx?.response;
  if (resp) {
    const body = await resp.clone().json().catch(() => null);
    if (body?.error) return String(body.error);
  }
  return (error as Error)?.message || fallback;
}

/**
 * Lê os arquivos da contratação no PNCP e exibe o selecionado num frame,
 * sem sair da aplicação. O arquivo é materializado no bucket privado pela
 * Edge Function `pncp-arquivos-edital` — assim ele continua abrindo mesmo
 * quando o portal está fora do ar.
 */
export default function EditalViewer({ licitacaoId, urlEdital, onArquivosPncp }: Props) {
  const [arquivos, setArquivos] = useState<ArquivoPncp[]>([]);
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [selecionado, setSelecionado] = useState<ArquivoPncp | null>(null);
  const [abrindo, setAbrindo] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [erroArquivo, setErroArquivo] = useState<string | null>(null);
  // Só o download revela a extensão: a listagem do PNCP não traz nome de arquivo
  const [arquivoAberto, setArquivoAberto] = useState<{ nome: string; ext: string } | null>(null);

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
        setErroLista(
          error
            ? await mensagemDoErro(error, 'Não foi possível listar os arquivos no PNCP.')
            : data?.error || 'Não foi possível listar os arquivos no PNCP.',
        );
        setArquivos([]);
        return;
      }
      setArquivos(data.arquivos || []);
      onArquivosPncp?.((data.arquivos || []).length);
    } catch (e) {
      setErroLista(e instanceof Error ? e.message : 'Erro ao consultar o PNCP.');
    } finally {
      setCarregandoLista(false);
    }
  }, [licitacaoId, onArquivosPncp]);

  useEffect(() => { carregarLista(); }, [carregarLista]);

  const abrirArquivo = async (arq: ArquivoPncp, opts?: { force?: boolean }) => {
    setSelecionado(arq);
    setSignedUrl(null);
    setErroArquivo(null);
    setArquivoAberto(null);
    setAbrindo(true);
    try {
      const { data, error } = await supabase.functions.invoke('pncp-arquivos-edital', {
        body: { licitacao_id: licitacaoId, action: 'abrir', sequencial: arq.sequencial, force: opts?.force === true },
      });
      if (error || !data?.success || !data?.path) {
        setErroArquivo(
          error
            ? await mensagemDoErro(error, 'Não foi possível baixar este arquivo do PNCP.')
            : data?.error || 'Não foi possível baixar este arquivo do PNCP.',
        );
        return;
      }

      const { data: signed, error: signErr } = await supabase.storage
        .from('processo-arquivos')
        .createSignedUrl(data.path, 60 * 60);

      if (signErr || !signed?.signedUrl) {
        setErroArquivo('Arquivo baixado, mas não foi possível gerar o link de visualização.');
        return;
      }
      const nomeReal: string = data.nome || arq.nome;
      const ext = (String(data.path).match(/\.([a-z0-9]{2,5})$/i) || [])[1]?.toLowerCase()
        || (nomeReal.match(/\.([a-z0-9]{2,5})$/i) || [])[1]?.toLowerCase()
        || '';
      setArquivoAberto({ nome: nomeReal, ext });
      setSignedUrl(signed.signedUrl);
      if (data.cached === false) toast.success(`${arq.titulo} carregado do PNCP.`);
    } catch (e) {
      setErroArquivo(e instanceof Error ? e.message : 'Erro ao abrir o arquivo.');
    } finally {
      setAbrindo(false);
    }
  };

  // Leitura SOB DEMANDA (decisão do dono, 03/09): o card abre compacto — só a
  // lista de arquivos — e o frame de leitura nasce no clique, como na pasta de
  // anexos manuais. O auto-abrir tomava a tela inteira com um PDF de 145
  // páginas que ninguém pediu para ler ainda.
  const fecharLeitura = () => { setSelecionado(null); setSignedUrl(null); };

  if (semFontePncp) return null;

  const podeExibirNoFrame = !!arquivoAberto && VISUALIZAVEL.includes(arquivoAberto.ext);

  return (
    <Card className="p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FileText className="w-5 h-5 text-primary" aria-hidden="true" />
        <h2 className="text-lg font-semibold">Edital em tela</h2>
        {arquivos.length > 0 && (
          <Badge variant="muted">{arquivos.length} arquivos no PNCP</Badge>
        )}
        <Button size="sm" variant="ghost" className="ml-auto" onClick={carregarLista} disabled={carregandoLista}>
          <RefreshCw className={`w-4 h-4 ${carregandoLista ? 'animate-spin' : ''}`} aria-hidden="true" />
          Atualizar lista
        </Button>
      </div>

      {carregandoLista && arquivos.length === 0 && (
        <div role="status" aria-busy="true" className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Consultando os arquivos no PNCP…
        </div>
      )}

      {erroLista && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>Não foi possível listar os arquivos</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{erroLista}</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={carregarLista}>
                <RefreshCw className="w-4 h-4" aria-hidden="true" /> Tentar novamente
              </Button>
              {urlEdital && (
                <Button asChild size="sm" variant="ghost">
                  <a href={urlEdital} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4" aria-hidden="true" /> Abrir no PNCP
                  </a>
                </Button>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {arquivos.length > 0 && (
        <div className={`grid grid-cols-1 gap-3 ${selecionado ? 'lg:grid-cols-[280px_1fr]' : ''}`}>
          {/* Lista de arquivos */}
          <div className="max-h-[620px] divide-y divide-border overflow-y-auto rounded-md border border-border">
            {arquivos.map((a) => {
              const ativo = selecionado?.sequencial === a.sequencial;
              return (
                <button
                  key={a.sequencial}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => abrirArquivo(a)}
                  className={`w-full p-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset ${ativo ? 'border-l-2 border-l-primary bg-primary-tint' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    <FileText className={`w-4 h-4 mt-0.5 shrink-0 ${ativo ? 'text-primary' : 'text-muted-foreground'}`} aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{a.titulo}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {a.extensao && (
                          <Badge variant="outline" className="uppercase">{a.extensao}</Badge>
                        )}
                        <span className="truncate text-xs text-muted-foreground">{a.tipo}</span>
                        {a.data_publicacao && (
                          <span className="text-xs text-muted-foreground">
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

          {/* Frame do arquivo — só existe depois do clique */}
          {selecionado && (
          <div className="flex min-h-[420px] flex-col overflow-hidden rounded-md border border-border bg-muted">
            <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {selecionado.titulo}
              </span>
              <Button size="sm" variant="ghost" onClick={fecharLeitura} title="Recolher a leitura">
                Recolher
              </Button>
              {signedUrl && (
                <>
                  <Button asChild size="sm" variant="ghost" className="w-9 px-0">
                    <a href={signedUrl} target="_blank" rel="noopener noreferrer" title="Abrir em nova aba" aria-label="Abrir em nova aba">
                      <Maximize2 className="w-4 h-4" aria-hidden="true" />
                    </a>
                  </Button>
                  <Button asChild size="sm" variant="ghost" className="w-9 px-0">
                    <a href={signedUrl} download={arquivoAberto?.nome} title="Baixar" aria-label="Baixar arquivo">
                      <Download className="w-4 h-4" aria-hidden="true" />
                    </a>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-9 px-0"
                    title="Documento quebrado? Baixar novamente do PNCP"
                    aria-label="Baixar novamente do PNCP"
                    onClick={() => selecionado && abrirArquivo(selecionado, { force: true })}
                  >
                    <RefreshCw className="w-4 h-4" aria-hidden="true" />
                  </Button>
                </>
              )}
            </div>

            <div className="relative flex-1">
              {abrindo && (
                <div role="status" aria-busy="true" className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-background/60 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Baixando do PNCP…
                </div>
              )}

              {erroArquivo && (
                <div className="p-6">
                  <Alert variant="warning">
                    <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                    <AlertTitle>Não foi possível abrir o arquivo</AlertTitle>
                    <AlertDescription className="space-y-3">
                      <p>{erroArquivo}</p>
                      {urlEdital && (
                        <Button asChild size="sm" variant="outline">
                          <a href={urlEdital} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-4 h-4" aria-hidden="true" /> Abrir no PNCP
                          </a>
                        </Button>
                      )}
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              {signedUrl && podeExibirNoFrame && (
                <iframe
                  src={signedUrl}
                  title={selecionado?.titulo || 'Edital'}
                  className="h-[600px] w-full border-0 bg-card"
                />
              )}

              {/* ZIP é o formato em que o PNCP publica a maior parte dos
                  editais. Mandar baixar e descompactar para ler o edital era
                  transferir trabalho ao usuário por uma limitação do navegador
                  que o próprio navegador sabe resolver. */}
              {signedUrl && !podeExibirNoFrame && arquivoAberto?.ext === 'zip' && (
                <ConteudoDoZip url={signedUrl} nomeZip={arquivoAberto?.nome} />
              )}

              {signedUrl && !podeExibirNoFrame && arquivoAberto?.ext !== 'zip' && (
                <EstadoVazio
                  tamanho="compacto"
                  icone={<FileText />}
                  titulo="O navegador não exibe este formato"
                  descricao={
                    <>
                      <strong>{arquivoAberto?.nome}</strong>
                      {arquivoAberto?.ext ? <> é um arquivo <strong>.{arquivoAberto.ext}</strong> —</> : ' —'}{' '}
                      baixe para abrir no aplicativo correspondente.
                    </>
                  }
                  acao={
                    <Button asChild variant="outline">
                      <a href={signedUrl} download={arquivoAberto?.nome}>
                        <Download className="w-4 h-4" aria-hidden="true" />
                        Baixar {arquivoAberto?.ext ? arquivoAberto.ext.toUpperCase() : 'arquivo'}
                      </a>
                    </Button>
                  }
                />
              )}

              {!signedUrl && !abrindo && !erroArquivo && (
                <p className="p-10 text-center text-sm text-muted-foreground">
                  Escolha um arquivo na lista ao lado para visualizar aqui.
                </p>
              )}
            </div>
          </div>
          )}
        </div>
      )}

      {!carregandoLista && !erroLista && arquivos.length === 0 && (
        <EstadoVazio
          tamanho="compacto"
          icone={<FileText />}
          titulo="Nenhum arquivo no PNCP"
          descricao="O PNCP não retornou arquivos para esta contratação."
        />
      )}
    </Card>
  );
}
