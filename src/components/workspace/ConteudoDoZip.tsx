import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Download, Loader2, FolderOpen, AlertTriangle } from 'lucide-react';

/**
 * Abre o pacote .zip do PNCP dentro da tela, em vez de mandar baixar.
 *
 * A maior parte dos editais é publicada assim — edital, termo de referência e
 * anexos num arquivo só. O visualizador dizia apenas "o navegador não renderiza
 * esse formato", o que é verdade e não ajuda: para ler o edital era preciso
 * baixar, descompactar e procurar. Aqui o conteúdo é listado e o PDF de dentro
 * abre no mesmo lugar.
 *
 * Tudo acontece no navegador, sobre o arquivo que já foi baixado para exibição —
 * nada é reenviado nem regravado.
 */

type Entrada = { caminho: string; nome: string; bytes: number };

const tamanho = (b: number) =>
  b > 1_048_576 ? `${(b / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;

const ehPdf = (n: string) => /\.pdf$/i.test(n);

export default function ConteudoDoZip({ url, nomeZip }: { url: string; nomeZip?: string }) {
  const [entradas, setEntradas] = useState<Entrada[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState<{ nome: string; url: string } | null>(null);
  const [abrindo, setAbrindo] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const JSZip = (await import('jszip')).default;
        const zip = await JSZip.loadAsync(await fetch(url).then((r) => r.arrayBuffer()));
        if (!vivo) return;
        const itens = Object.values(zip.files)
          .filter((f) => !f.dir && !/(^|\/)(__MACOSX|\.DS_Store)/i.test(f.name))
          .map((f) => ({
            caminho: f.name,
            nome: f.name.split('/').pop() || f.name,
            // `_data.uncompressedSize` é o tamanho real; a API pública não o expõe.
            bytes: (f as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0,
          }))
          .sort((a, b) => (ehPdf(b.nome) ? 1 : 0) - (ehPdf(a.nome) ? 1 : 0) || a.nome.localeCompare(b.nome));
        setEntradas(itens);
      } catch {
        if (vivo) setErro('Não foi possível abrir o pacote. Baixe para conferir no computador.');
      }
    })();
    return () => { vivo = false; };
  }, [url]);

  // Revoga o endereço temporário do arquivo interno ao trocar ou sair.
  useEffect(() => () => { if (aberto) URL.revokeObjectURL(aberto.url); }, [aberto]);

  const abrirInterno = async (e: Entrada) => {
    setAbrindo(e.caminho);
    try {
      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(await fetch(url).then((r) => r.arrayBuffer()));
      const blob = await zip.file(e.caminho)!.async('blob');
      const tipo = ehPdf(e.nome) ? 'application/pdf' : blob.type;
      if (aberto) URL.revokeObjectURL(aberto.url);
      setAberto({ nome: e.nome, url: URL.createObjectURL(new Blob([blob], { type: tipo })) });
    } finally {
      setAbrindo(null);
    }
  };

  if (erro) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>{erro}</span>
            <Button asChild size="sm" variant="outline">
              <a href={url} download={nomeZip}><Download className="w-4 h-4" aria-hidden="true" /> Baixar ZIP</a>
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!entradas) {
    return (
      <div role="status" aria-busy="true" className="space-y-3 p-6">
        <span className="sr-only">Abrindo o pacote…</span>
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-[minmax(0,260px)_1fr]">
      <div className="max-h-[600px] overflow-y-auto border-r border-border">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <FolderOpen className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
          <span className="text-sm font-medium">{entradas.length} arquivo(s) no pacote</span>
        </div>
        {entradas.map((e) => {
          const ativo = aberto?.nome === e.nome;
          return (
            <Button
              key={e.caminho}
              type="button"
              variant="ghost"
              aria-pressed={ativo}
              onClick={() => abrirInterno(e)}
              className={`h-auto w-full flex-col items-start gap-0.5 whitespace-normal rounded-none border-b border-border px-3 py-2 text-left font-normal ${
                ativo ? 'bg-primary-tint hover:bg-primary-tint' : ''
              }`}
            >
              <span className="flex w-full items-center gap-2">
                {abrindo === e.caminho
                  ? <Loader2 className="w-4 h-4 shrink-0 animate-spin" aria-hidden="true" />
                  : <FileText className="w-4 h-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
                <span className="min-w-0 truncate text-sm">{e.nome}</span>
              </span>
              {e.bytes > 0 && (
                <span className="pl-6 text-xs text-muted-foreground">{tamanho(e.bytes)}</span>
              )}
            </Button>
          );
        })}
      </div>

      <div className="min-w-0">
        {aberto && ehPdf(aberto.nome) ? (
          <iframe src={aberto.url} title={aberto.nome} className="h-[600px] w-full border-0 bg-background" />
        ) : aberto ? (
          <div className="space-y-3 p-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-tint text-primary">
              <FileText className="w-6 h-6" aria-hidden="true" />
            </div>
            <p className="text-sm text-muted-foreground">
              <strong>{aberto.nome}</strong> não é PDF — o navegador não o exibe aqui.
            </p>
            <Button asChild variant="outline">
              <a href={aberto.url} download={aberto.nome}>
                <Download className="w-4 h-4" aria-hidden="true" /> Baixar arquivo
              </a>
            </Button>
          </div>
        ) : (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Escolha um arquivo do pacote para ler aqui.
          </div>
        )}
      </div>
    </div>
  );
}
