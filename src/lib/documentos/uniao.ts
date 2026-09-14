/**
 * União de arquivos do módulo Documentos — a operação, sem a tela.
 *
 * ─ O que estava quebrado ────────────────────────────────────────────────
 * `MergeDocumentos` montava o PDF com `jspdf` e, para cada PDF de ENTRADA,
 * escrevia uma PÁGINA DE CAPA (`doc.text(arq.nome)` + "Este documento foi
 * incluído no merge") — descartando o conteúdo do original. Quem juntava
 * cinco certidões baixava cinco folhas em branco com nomes escritos, e o
 * toast dizia "PDF combinado gerado com sucesso!".
 *
 * A causa é a biblioteca: `jspdf` DESENHA páginas novas e não sabe ler um PDF
 * existente. Quem concatena é o `pdf-lib` (`PDFDocument.load` + `copyPages`),
 * que já estava no `package.json` e já faz exatamente isto em
 * `src/lib/faturamento/kit.ts` (`montarPdfUnico`).
 *
 * ─ Fronteiras ──────────────────────────────────────────────────────────
 * Tudo acontece no NAVEGADOR: os bytes são lidos com `arrayBuffer()` (que não
 * escreve no arquivo de origem) e o resultado é um Blob novo — nada sobe para
 * o servidor e nada é sobrescrito no disco de quem usa.
 *
 * Nada aqui lê o cofre de documentos da empresa: os arquivos vêm do
 * computador de quem está na tela. É por isso que não há risco de anexar
 * documento de outra empresa — e é também o limite desta aba.
 */

/** O que a união sabe tratar DE VERDADE. */
export const EXTENSOES_ACEITAS = ['.pdf', '.jpg', '.jpeg', '.png'] as const;

/**
 * `accept` do input. O valor anterior prometia `.doc,.docx,.xls,.xlsx` e
 * NENHUMA conversão existia — esses arquivos caíam justamente no ramo da capa
 * vazia. Anunciar formato que não se converte é falha silenciosa na entrada do
 * fluxo (princípio 3): removidos.
 */
export const ACCEPT_DO_INPUT = EXTENSOES_ACEITAS.join(',');

/**
 * Limites REAIS, não decorativos: a união roda na memória da aba, com o
 * arquivo inteiro carregado de uma vez. Acima disso o navegador não devolve
 * erro — ele trava ou mata a aba, e quem está na tela não entende o que houve.
 */
export const LIMITE_POR_ARQUIVO_BYTES = 25 * 1024 * 1024;
export const LIMITE_TOTAL_BYTES = 100 * 1024 * 1024;

export type TipoDeArquivo = 'pdf' | 'imagem';

export type ArquivoParaUniao = {
  id: string;
  nome: string;
  tamanhoBytes: number;
  tipo: TipoDeArquivo;
  file: File;
};

/** Erro de UM arquivo — a lista continua, o arquivo não entra. */
export type RecusaDeArquivo = { nome: string; motivo: string };

export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

/**
 * O tipo do arquivo pelo MIME e, quando o navegador não informa (arrastar de
 * certos gerenciadores devolve `type` vazio), pela extensão. `null` = não
 * sabemos tratar — e não saber tratar tem que virar recusa visível, não capa.
 */
export function classificarArquivo(file: File): TipoDeArquivo | null {
  const mime = (file.type || '').toLowerCase();
  const nome = (file.name || '').toLowerCase();
  if (mime === 'application/pdf' || nome.endsWith('.pdf')) return 'pdf';
  if (mime === 'image/jpeg' || mime === 'image/png') return 'imagem';
  if (/\.(jpe?g|png)$/.test(nome)) return 'imagem';
  return null;
}

/**
 * Validação de UM arquivo, com a razão por extenso. Antes não havia validação
 * nenhuma: `handleAddFiles` aceitava qualquer coisa, de `.exe` a vídeo de
 * 800 MB, e o problema só aparecia (ou não aparecia) no fim.
 */
/**
 * O veredito sobre um arquivo. `motivo` só vem preenchido quando `ok` é falso.
 *
 * Por que não é união discriminada (`{ok:true,…} | {ok:false,…}`), que seria a
 * forma idiomática: este projeto compila com `strict: false`, e sem
 * `strictNullChecks` o TypeScript NÃO estreita união por discriminante — um
 * `if (!veredito.ok)` continua enxergando a união inteira, e ler `motivo`
 * dentro dele vira erro de compilação. O tipo chato aqui é o que o compilador
 * do projeto entende.
 */
export interface VeredictoDeArquivo {
  ok: boolean;
  tipo?: TipoDeArquivo;
  /** Preenchido só na recusa, em linguagem para quem anexou. */
  motivo?: string;
}

export function validarArquivo(file: File, bytesJaNaLista: number): VeredictoDeArquivo {
  const tipo = classificarArquivo(file);
  if (!tipo) {
    return {
      ok: false,
      motivo: `formato não suportado — a união trata ${EXTENSOES_ACEITAS.join(', ')}. Converta para PDF antes de anexar.`,
    };
  }
  if (file.size === 0) {
    return { ok: false, motivo: 'arquivo vazio (0 byte) — provavelmente não terminou de copiar.' };
  }
  if (file.size > LIMITE_POR_ARQUIVO_BYTES) {
    return {
      ok: false,
      motivo: `tem ${formatarTamanho(file.size)} e o limite por arquivo é ${formatarTamanho(LIMITE_POR_ARQUIVO_BYTES)}.`,
    };
  }
  if (bytesJaNaLista + file.size > LIMITE_TOTAL_BYTES) {
    return {
      ok: false,
      motivo: `estouraria o total de ${formatarTamanho(LIMITE_TOTAL_BYTES)} que a união suporta de uma vez.`,
    };
  }
  return { ok: true, tipo };
}

export type ResultadoDaUniao = {
  blob: Blob;
  /** Só o PDF conta páginas — é a prova de que concatenou em vez de capear. */
  paginas?: number;
  falhas: RecusaDeArquivo[];
};

type EntradaDaUniao = Pick<ArquivoParaUniao, 'nome' | 'tipo' | 'file'>;

/**
 * A união de verdade: as páginas de cada PDF de entrada são COPIADAS para o
 * documento de saída, na ordem da lista. Imagem vira uma página A4 com a foto
 * ajustada — esse ramo já funcionava e continua igual.
 *
 * Um arquivo ilegível (PDF corrompido, cifra que o `ignoreEncryption` não
 * vence) não derruba o lote: ele entra em `falhas` e a tela diz o nome. Perder
 * o lote inteiro por causa de um anexo é pior do que entregar o resto avisando.
 */
export async function unirEmPdf(
  arquivos: EntradaDaUniao[],
  aoProgredir?: (indice: number, nome: string) => void,
): Promise<ResultadoDaUniao> {
  const { PDFDocument } = await import('pdf-lib');
  const alvo = await PDFDocument.create();
  const falhas: RecusaDeArquivo[] = [];

  for (let i = 0; i < arquivos.length; i++) {
    const arq = arquivos[i];
    aoProgredir?.(i, arq.nome);
    try {
      const bytes = new Uint8Array(await arq.file.arrayBuffer());
      if (arq.tipo === 'pdf') {
        // `ignoreEncryption`: certidão de portal costuma vir com permissões de
        // dono, sem senha de abertura. Sem isto o `load` recusa um arquivo que
        // qualquer leitor abre.
        const origem = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const paginas = await alvo.copyPages(origem, origem.getPageIndices());
        paginas.forEach((p) => alvo.addPage(p));
      } else {
        const ehPng = /\.png$/i.test(arq.nome) || arq.file.type === 'image/png';
        const img = ehPng ? await alvo.embedPng(bytes) : await alvo.embedJpg(bytes);
        const pagina = alvo.addPage([595.28, 841.89]); // A4 em pontos
        const escala = Math.min(535 / img.width, 780 / img.height, 1);
        pagina.drawImage(img, {
          x: 30,
          y: 841.89 - 30 - img.height * escala,
          width: img.width * escala,
          height: img.height * escala,
        });
      }
    } catch (erro) {
      falhas.push({
        nome: arq.nome,
        motivo: erro instanceof Error ? erro.message : 'não foi possível ler o arquivo.',
      });
    }
  }

  const paginas = alvo.getPageCount();
  const bytes = await alvo.save();
  // `save()` devolve Uint8Array<ArrayBufferLike>; BlobPart exige ArrayBuffer.
  const blob = new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'application/pdf' });
  return { blob, paginas, falhas };
}

/** Pacote compactado — não transforma nada, só empacota na ordem da lista. */
export async function unirEmZip(
  arquivos: Array<Pick<ArquivoParaUniao, 'nome' | 'file'>>,
  aoProgredir?: (indice: number, nome: string) => void,
): Promise<ResultadoDaUniao> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const falhas: RecusaDeArquivo[] = [];
  const usados = new Map<string, number>();

  for (let i = 0; i < arquivos.length; i++) {
    const arq = arquivos[i];
    aoProgredir?.(i, arq.nome);
    try {
      // Dois arquivos de mesmo nome viravam UM dentro do ZIP — o segundo
      // sobrescrevia o primeiro em silêncio. Numerar preserva os dois.
      const vezes = (usados.get(arq.nome) ?? 0) + 1;
      usados.set(arq.nome, vezes);
      const nome = vezes === 1 ? arq.nome : `${vezes}_${arq.nome}`;
      zip.file(nome, await arq.file.arrayBuffer());
    } catch (erro) {
      falhas.push({
        nome: arq.nome,
        motivo: erro instanceof Error ? erro.message : 'não foi possível ler o arquivo.',
      });
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  return { blob, falhas };
}

/** Nome de arquivo sem os caracteres que o sistema de arquivos recusa. */
export function nomeSeguro(valor: string, padrao: string): string {
  const limpo = valor.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '_');
  return limpo || padrao;
}
