import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Download, Loader2, FolderOpen } from 'lucide-react';

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
      <div className="p-6 text-center space-y-3">
        <FileText className="w-8 h-8 mx-auto text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{erro}</p>
        <Button asChild size="sm" variant="outline">
          <a href={url} download={nomeZip}><Download className="w-3.5 h-3.5 mr-1.5" /> Baixar ZIP</a>
        </Button>
      </div>
    );
  }

  if (!entradas) {
    return (
      <div className="p-10 text-center">
        <Loader2 className="w-5 h-5 mx-auto animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground mt-2">Abrindo o pacote…</p>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-[minmax(0,260px)_1fr]">
      <div className="border-r border-border max-h-[600px] overflow-y-auto">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
          <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-sm font-medium">{entradas.length} arquivo(s) no pacote</span>
        </div>
        {entradas.map((e) => (
          <button
            key={e.caminho}
            onClick={() => abrirInterno(e)}
            className={`w-full text-left px-3 py-2 border-b border-border/60 hover:bg-muted/50 transition-colors ${
              aberto?.nome === e.nome ? 'bg-accent/10' : ''
            }`}
          >
            <span className="flex items-center gap-2">
              {abrindo === e.caminho
                ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                : <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
              <span className="text-sm truncate">{e.nome}</span>
            </span>
            {e.bytes > 0 && (
              <span className="text-xs text-muted-foreground ml-5.5">{tamanho(e.bytes)}</span>
            )}
          </button>
        ))}
      </div>

      <div className="min-w-0">
        {aberto && ehPdf(aberto.nome) ? (
          <iframe src={aberto.url} title={aberto.nome} className="w-full h-[600px] border-0 bg-white" />
        ) : aberto ? (
          <div className="p-6 text-center space-y-3">
            <FileText className="w-8 h-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              <strong>{aberto.nome}</strong> não é PDF — o navegador não o exibe aqui.
            </p>
            <Button asChild size="sm" variant="outline">
              <a href={aberto.url} download={aberto.nome}>
                <Download className="w-3.5 h-3.5 mr-1.5" /> Baixar arquivo
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
