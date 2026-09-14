import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ChevronDown, ChevronUp, Download, FileArchive, FileImage, FilePlus, FileText,
  GripVertical, Info, Loader2, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { AvisoDeFalha } from '@/components/gestao/SeloSituacao';
import {
  ACCEPT_DO_INPUT, EXTENSOES_ACEITAS, LIMITE_POR_ARQUIVO_BYTES, LIMITE_TOTAL_BYTES,
  type ArquivoParaUniao, type RecusaDeArquivo,
  formatarTamanho, nomeSeguro, unirEmPdf, unirEmZip, validarArquivo,
} from '@/lib/documentos/uniao';

/* ═══════════════════════════════════════════════════════════════════════════
   Unir arquivos — a TELA. A operação (e o histórico do defeito que ela
   carregava) vive em `@/lib/documentos/uniao`.

   Resumo do que mudou aqui, porque a tela também mentia:

   · o `accept` prometia `.doc,.docx,.xls,.xlsx` sem que existisse conversão
     nenhuma — e era justamente por esses arquivos que a versão anterior
     gerava a página de capa vazia. Saíram do `accept` e passam a ser
     RECUSADOS com motivo, um a um;

   · "Clique ou arraste arquivos aqui" era meia verdade: o input está em
     `sr-only` (recorte de 1px), então soltar um arquivo sobre o rótulo nunca
     chegava nele. O arrastar agora tem `onDrop` próprio;

   · o `GripVertical` era decorativo — não havia arrastar para reordenar. A
     linha virou `draggable` de verdade, e os botões subir/descer continuam
     sendo o caminho de quem usa teclado, leitor de tela ou toque;

   · `doc.save()` baixava sozinho e não sobrava evidência do que foi gerado.
     Agora o resultado fica na tela com a CONTAGEM DE PÁGINAS — exatamente o
     número que a versão de capas falsificava — e o download é um ato de quem
     está ali.
   ═══════════════════════════════════════════════════════════════════════════ */

type Progresso = { atual: number; total: number; nome: string };

export default function MergeDocumentos() {
  const [arquivos, setArquivos] = useState<ArquivoParaUniao[]>([]);
  const [nomeArquivo, setNomeArquivo] = useState('documentos_licitacao');
  const [formato, setFormato] = useState<'pdf' | 'zip'>('pdf');
  const [progresso, setProgresso] = useState<Progresso | null>(null);
  const [recusados, setRecusados] = useState<RecusaDeArquivo[]>([]);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [resultado, setResultado] = useState<
    { url: string; nomeFinal: string; paginas?: number; tamanho: number; falhas: RecusaDeArquivo[] } | null
  >(null);
  const [arrastandoArquivos, setArrastandoArquivos] = useState(false);
  const [arrastandoLinha, setArrastandoLinha] = useState<number | null>(null);

  const processando = progresso !== null;
  const bytesNaLista = arquivos.reduce((s, a) => s + a.tamanhoBytes, 0);

  /**
   * Entrada única para o input e para o arrastar — a validação tem que ser a
   * mesma nos dois caminhos, senão o arrastar volta a ser a porta larga.
   */
  const adicionar = useCallback((lista: FileList | File[] | null) => {
    if (!lista) return;
    setArquivos((prev) => {
      let acumulado = prev.reduce((s, a) => s + a.tamanhoBytes, 0);
      const aceitos: ArquivoParaUniao[] = [];
      const recusas: RecusaDeArquivo[] = [];

      for (const file of Array.from(lista)) {
        const veredito = validarArquivo(file, acumulado);
        if (!veredito.ok) {
          recusas.push({ nome: file.name, motivo: veredito.motivo });
          continue;
        }
        acumulado += file.size;
        aceitos.push({
          id: crypto.randomUUID(),
          nome: file.name,
          tamanhoBytes: file.size,
          tipo: veredito.tipo,
          file,
        });
      }

      setRecusados(recusas);
      if (recusas.length > 0) {
        toast.error(
          recusas.length === 1
            ? `1 arquivo não entrou na lista.`
            : `${recusas.length} arquivos não entraram na lista.`,
          { description: 'O motivo de cada um está abaixo da área de envio.' },
        );
      }
      return aceitos.length > 0 ? [...prev, ...aceitos] : prev;
    });
  }, []);

  const remover = (id: string) => setArquivos((prev) => prev.filter((a) => a.id !== id));

  const mover = (de: number, para: number) => {
    if (para < 0 || para >= arquivos.length || de === para) return;
    setArquivos((prev) => {
      const proximo = [...prev];
      const [item] = proximo.splice(de, 1);
      proximo.splice(para, 0, item);
      return proximo;
    });
  };

  const gerar = async () => {
    if (arquivos.length < 2) {
      toast.error('Adicione pelo menos 2 arquivos para juntar.');
      return;
    }
    setErroGeral(null);
    // Um resultado anterior ficaria disponível para download depois de a lista
    // mudar — link antigo com rótulo novo. Some antes de começar.
    if (resultado) URL.revokeObjectURL(resultado.url);
    setResultado(null);
    setProgresso({ atual: 0, total: arquivos.length, nome: arquivos[0].nome });

    try {
      const aoProgredir = (indice: number, nome: string) =>
        setProgresso({ atual: indice, total: arquivos.length, nome });
      const saida =
        formato === 'pdf'
          ? await unirEmPdf(arquivos, aoProgredir)
          : await unirEmZip(arquivos, aoProgredir);

      const nomeFinal = `${nomeSeguro(nomeArquivo, 'documentos_licitacao')}.${formato}`;
      setResultado({
        url: URL.createObjectURL(saida.blob),
        nomeFinal,
        paginas: saida.paginas,
        tamanho: saida.blob.size,
        falhas: saida.falhas,
      });
      if (saida.falhas.length > 0) {
        toast.warning(`${saida.falhas.length} arquivo(s) ficaram de fora — veja o resultado.`);
      } else {
        toast.success('Arquivo gerado. Baixe abaixo.');
      }
    } catch (erro) {
      // Mensagem REAL, não "erro ao processar": quem lê o motivo pode agir.
      setErroGeral(erro instanceof Error ? erro.message : String(erro));
    } finally {
      setProgresso(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ── Cabeçalho e formato ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <FileArchive className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <h3 className="g-titulo-secao text-foreground">Unir arquivos</h3>
          <span className="g-meta rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
            {arquivos.length} na lista
          </span>
        </div>
        {/* Dois estados, um só de cada vez — `aria-pressed` diz qual está
            escolhido a quem não enxerga a tinta. */}
        <div
          className="inline-flex overflow-hidden rounded-[var(--g-raio)] border border-border"
          role="group"
          aria-label="Formato do arquivo de saída"
        >
          {(['pdf', 'zip'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFormato(f)}
              aria-pressed={formato === f}
              className={cn(
                'g-corpo min-h-[var(--g-linha)] px-4 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                formato === f
                  ? 'bg-primary-tint font-semibold text-foreground'
                  : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* ── O que esta aba faz e o que ela NÃO faz ──────────────────────── */}
      <p className="g-corpo flex items-start gap-2 rounded-xl border border-border bg-muted/40 px-4 py-3 text-muted-foreground">
        <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          <b className="text-foreground">PDF</b> concatena as páginas de cada arquivo na ordem da
          lista; <b className="text-foreground">ZIP</b> empacota os arquivos como estão. Aceita{' '}
          {EXTENSOES_ACEITAS.join(', ')} — até {formatarTamanho(LIMITE_POR_ARQUIVO_BYTES)} por
          arquivo e {formatarTamanho(LIMITE_TOTAL_BYTES)} no total.{' '}
          <b className="text-foreground">Não há conversão de Word, Excel ou imagem HEIC</b>: converta
          para PDF antes. Tudo acontece no seu navegador — os arquivos de origem não são alterados,
          nada sobe para o servidor, e esta aba não lê o cofre de documentos da empresa.
        </span>
      </p>

      {/* ── Nome da saída ───────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="merge-nome-saida" className="g-corpo">
          Nome do arquivo de saída
        </Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id="merge-nome-saida"
            value={nomeArquivo}
            onChange={(e) => setNomeArquivo(e.target.value)}
            placeholder="documentos_licitacao"
            className="g-controle min-w-0 flex-1 rounded-[var(--g-raio)]"
          />
          <span className="g-corpo text-muted-foreground">.{formato}</span>
        </div>
      </div>

      {/* ── Área de envio: clicar OU arrastar ───────────────────────────
          O arrastar precisa de `onDrop` próprio: o input está em `sr-only`
          (1px recortado), então soltar o arquivo sobre o rótulo nunca chegava
          nele — a tela prometia arrastar e só o clique funcionava. */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setArrastandoArquivos(true);
        }}
        onDragLeave={() => setArrastandoArquivos(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastandoArquivos(false);
          adicionar(e.dataTransfer?.files ?? null);
        }}
        className={cn(
          'rounded-xl border-2 border-dashed border-border transition-colors',
          arrastandoArquivos && 'border-primary bg-primary-tint',
        )}
      >
        <label className="flex cursor-pointer flex-col items-center justify-center gap-1 px-4 py-8 text-center focus-within:outline-none focus-within:ring-2 focus-within:ring-ring">
          <FilePlus className="mb-1 h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <span className="g-corpo font-medium text-foreground">
            Clique ou arraste arquivos aqui
          </span>
          <span className="g-meta text-muted-foreground">
            {EXTENSOES_ACEITAS.join(' · ')}
          </span>
          <input
            type="file"
            multiple
            className="sr-only"
            accept={ACCEPT_DO_INPUT}
            aria-label="Escolher arquivos para unir"
            onChange={(e) => {
              adicionar(e.target.files);
              e.target.value = '';
            }}
          />
        </label>
      </div>

      {/* ── Recusas: erro POR ARQUIVO, com o motivo de cada um ──────────── */}
      {recusados.length > 0 && (
        <div
          role="alert"
          className="rounded-xl border border-destructive-line bg-destructive-tint px-4 py-3"
        >
          <p className="g-corpo font-semibold text-destructive-ink">
            {recusados.length === 1
              ? '1 arquivo não entrou na lista'
              : `${recusados.length} arquivos não entraram na lista`}
          </p>
          <ul className="mt-1 flex flex-col gap-1">
            {recusados.map((r, i) => (
              <li key={`${r.nome}-${i}`} className="g-corpo text-destructive-ink">
                <b className="font-medium">{r.nome}</b>: {r.motivo}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setRecusados([])}
            className="g-meta mt-2 font-medium text-destructive-ink underline underline-offset-2"
          >
            Entendi, ocultar
          </button>
        </div>
      )}

      {/* ── Lista com a ORDEM de processamento ──────────────────────────── */}
      {arquivos.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-2">
            <p className="g-meta font-semibold uppercase tracking-wide text-muted-foreground">
              Ordem de processamento — de cima para baixo
            </p>
            <p className="g-meta tabular-nums text-muted-foreground">
              {formatarTamanho(bytesNaLista)} de {formatarTamanho(LIMITE_TOTAL_BYTES)}
            </p>
          </div>
          <ul className="divide-y divide-border">
            {arquivos.map((arq, index) => {
              const Icone = arq.tipo === 'imagem' ? FileImage : FileText;
              return (
                <li
                  key={arq.id}
                  draggable
                  onDragStart={() => setArrastandoLinha(index)}
                  onDragEnd={() => setArrastandoLinha(null)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (arrastandoLinha !== null) mover(arrastandoLinha, index);
                    setArrastandoLinha(null);
                  }}
                  className={cn(
                    'flex min-h-[var(--g-linha)] flex-wrap items-center gap-3 px-4 py-2',
                    arrastandoLinha === index && 'bg-primary-tint',
                  )}
                >
                  {/* O ícone deixou de ser enfeite: a linha é `draggable` e
                      solta na posição de destino. Quem não arrasta (teclado,
                      leitor de tela, toque) usa os botões — o caminho
                      acessível não pode depender do mouse. */}
                  <GripVertical
                    className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="g-corpo w-6 shrink-0 tabular-nums text-muted-foreground">
                    {index + 1}.
                  </span>
                  <Icone className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="g-corpo truncate font-medium text-foreground">{arq.nome}</p>
                    <p className="g-meta text-muted-foreground">
                      {arq.tipo === 'pdf' ? 'PDF' : 'Imagem'} · {formatarTamanho(arq.tamanhoBytes)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Subir E descer: com um sentido só, a última linha nunca
                        chega ao topo sem N cliques. */}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => mover(index, index - 1)}
                      disabled={index === 0 || processando}
                      className="h-11 w-11"
                      title="Mover para cima"
                      aria-label={`Mover ${arq.nome} para cima`}
                    >
                      <ChevronUp className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => mover(index, index + 1)}
                      disabled={index === arquivos.length - 1 || processando}
                      className="h-11 w-11"
                      title="Mover para baixo"
                      aria-label={`Mover ${arq.nome} para baixo`}
                    >
                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => remover(arq.id)}
                      disabled={processando}
                      className="h-11 w-11 text-destructive-ink hover:bg-destructive-tint hover:text-destructive-ink"
                      title="Remover da lista"
                      aria-label={`Remover ${arq.nome} da lista`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* ── Vazio ───────────────────────────────────────────────────────── */}
      {arquivos.length === 0 && recusados.length === 0 && (
        <p className="g-corpo text-center text-muted-foreground">
          Nenhum arquivo na lista. Adicione ao menos dois para unir.
        </p>
      )}

      {/* ── Ação, progresso e falha ─────────────────────────────────────── */}
      {erroGeral && (
        <AvisoDeFalha aoTentarNovamente={gerar}>
          Não foi possível gerar o arquivo: {erroGeral}
        </AvisoDeFalha>
      )}

      {arquivos.length >= 2 && (
        <Button onClick={gerar} disabled={processando} className="min-h-[var(--g-linha)] w-full">
          {progresso ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Processando {progresso.atual + 1} de {progresso.total}…
            </>
          ) : (
            <>
              <Download className="h-4 w-4" aria-hidden="true" />
              Gerar {formato.toUpperCase()} com {arquivos.length} arquivos
            </>
          )}
        </Button>
      )}

      {progresso && (
        <p role="status" aria-live="polite" className="g-corpo truncate text-muted-foreground">
          Lendo {progresso.nome}…
        </p>
      )}

      {/* ── Resultado: o download é um ATO de quem está na tela ──────────
          O código anterior chamava `doc.save()`/`a.click()` sozinho e não
          sobrava evidência do que foi gerado. Agora o arquivo fica aqui, com
          a contagem de páginas — que é exatamente o número que a versão de
          capas falsificava. */}
      {resultado && (
        <div className="flex flex-col gap-3 rounded-xl border border-success-line bg-success-tint px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="g-corpo font-semibold text-success-ink">{resultado.nomeFinal}</p>
              <p className="g-meta text-success-ink/90">
                {resultado.paginas !== undefined && (
                  <>
                    {resultado.paginas} página{resultado.paginas === 1 ? '' : 's'} ·{' '}
                  </>
                )}
                {formatarTamanho(resultado.tamanho)}
              </p>
            </div>
            <a
              href={resultado.url}
              download={resultado.nomeFinal}
              className="g-corpo inline-flex min-h-[var(--g-linha)] shrink-0 items-center gap-2 rounded-[var(--g-raio)] bg-primary px-4 font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-sm:w-full max-sm:justify-center"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Baixar
            </a>
          </div>
          {resultado.falhas.length > 0 && (
            <ul className="flex flex-col gap-1 border-t border-success-line pt-2">
              {resultado.falhas.map((f, i) => (
                <li key={`${f.nome}-${i}`} className="g-meta text-destructive-ink">
                  <b className="font-medium">{f.nome}</b> ficou de fora: {f.motivo}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
