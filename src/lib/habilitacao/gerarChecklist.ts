import { supabase } from '@/integrations/supabase/client';
import { extractTextFromBlob } from '@/lib/pdf-text-extractor';
import { toast } from 'sonner';

/**
 * Geração do checklist de habilitação como PROCESSO DA PÁGINA, fora do React.
 *
 * A primeira versão rodava dentro do componente da aba Documentos — trocar de
 * aba desmontava o componente e matava a geração no meio (baixar edital →
 * extrair texto → IA). Aqui o pipeline vive no módulo: continua rodando
 * enquanto o app estiver aberto, em qualquer aba; os componentes apenas
 * observam o estado e o resultado chega por toast + recarga do checklist.
 */

export type EstadoGeracao = {
  rodando: boolean;
  fase: string;
  /** Incrementa a cada geração concluída (com ou sem erro) — dispara recarga na UI. */
  concluidas: number;
  erro: string | null;
};

const INICIAL: EstadoGeracao = { rodando: false, fase: '', concluidas: 0, erro: null };
const estados = new Map<string, EstadoGeracao>();
const listeners = new Map<string, Set<() => void>>();

function setEstado(licitacaoId: string, patch: Partial<EstadoGeracao>) {
  const atual = estados.get(licitacaoId) ?? { ...INICIAL };
  estados.set(licitacaoId, { ...atual, ...patch });
  listeners.get(licitacaoId)?.forEach((cb) => cb());
}

export function getEstadoGeracao(licitacaoId: string): EstadoGeracao {
  return estados.get(licitacaoId) ?? INICIAL;
}

export function subscribeGeracao(licitacaoId: string, cb: () => void): () => void {
  if (!listeners.has(licitacaoId)) listeners.set(licitacaoId, new Set());
  listeners.get(licitacaoId)!.add(cb);
  return () => listeners.get(licitacaoId)?.delete(cb);
}

/**
 * Recorta o texto de um documento longo mantendo o que interessa à habilitação.
 * Editais e TRs passam de 200 mil caracteres; enviar tudo estoura o orçamento
 * da análise. Mantém o início do documento (identificação/objeto) e os blocos
 * que falam de habilitação/exigências, com um vizinho de cada lado p/ contexto.
 */
function recortarRelevante(texto: string, limite: number): string {
  if (texto.length <= limite) return texto;
  const RELEVANTE = /habilita|qualifica[cç][ãa]o|declara[cç]|certid|comprova[cç]|regularidade|exig[êe]nc|documenta[cç]|credenciamento|proposta/i;
  const blocos = texto.split(/\n{2,}/);
  const marcado = blocos.map((b) => RELEVANTE.test(b));
  const incluir = blocos.map((_, i) => marcado[i] || marcado[i - 1] || marcado[i + 1]);
  incluir[0] = true;
  if (blocos.length > 1) incluir[1] = true;
  const partes: string[] = [];
  let total = 0;
  for (let i = 0; i < blocos.length; i++) {
    if (!incluir[i]) continue;
    if (total + blocos[i].length > limite) break;
    partes.push(blocos[i]);
    total += blocos[i].length + 2;
  }
  return partes.join('\n\n');
}

/** Extrai a mensagem real de um FunctionsHttpError (o corpo JSON da resposta). */
async function mensagemReal(error: unknown, fallback: string): Promise<string> {
  const ctx = (error as { context?: Response })?.context;
  if (ctx && typeof ctx.json === 'function') {
    const body = await ctx.json().catch(() => null);
    if (body?.error) return String(body.error);
  }
  return fallback;
}

export async function gerarChecklist(licitacaoId: string): Promise<void> {
  const atual = getEstadoGeracao(licitacaoId);
  if (atual.rodando) return; // já em andamento — a UI só observa

  setEstado(licitacaoId, { rodando: true, erro: null, fase: 'Localizando o edital no PNCP…' });
  try {
    // 1. Localiza e materializa o edital (mesma infra do Edital em tela)
    const { data: lista, error: listaErr } = await supabase.functions.invoke('pncp-arquivos-edital', {
      body: { licitacao_id: licitacaoId, action: 'listar' },
    });
    if (listaErr || !lista?.success || !lista?.arquivos?.length) {
      throw new Error(await mensagemReal(listaErr, 'Edital não localizado no PNCP — confira o "Edital em tela" em Anexos.'));
    }

    // Exigências de habilitação moram tanto no edital quanto nos anexos (Termo
    // de Referência, sobretudo) — a leitura percorre TODOS os arquivos do
    // processo, com o edital primeiro. Falha em um anexo não derruba o resto.
    const arquivos = [...(lista.arquivos as Array<{ sequencial: number; nome?: string; tipo?: string; titulo?: string }>)]
      .sort((a, b) =>
        (/edital/i.test(`${b.tipo || ''} ${b.titulo || ''} ${b.nome || ''}`) ? 1 : 0) -
        (/edital/i.test(`${a.tipo || ''} ${a.titulo || ''} ${a.nome || ''}`) ? 1 : 0));

    const LIMITE_POR_ARQUIVO = 60_000;
    const partes: string[] = [];
    for (let i = 0; i < arquivos.length; i++) {
      const arq = arquivos[i];
      const rotulo = arq.titulo || arq.nome || `anexo ${arq.sequencial}`;
      setEstado(licitacaoId, { fase: `Lendo documento ${i + 1}/${arquivos.length}: ${rotulo}…` });
      try {
        const { data: abrir, error: abrirErr } = await supabase.functions.invoke('pncp-arquivos-edital', {
          body: { licitacao_id: licitacaoId, action: 'abrir', sequencial: arq.sequencial },
        });
        if (abrirErr || !abrir?.success || !abrir?.path) continue;
        const { data: signed } = await supabase.storage.from('processo-arquivos').createSignedUrl(abrir.path, 600);
        if (!signed?.signedUrl) continue;
        const blob = await fetch(signed.signedUrl).then((r) => r.blob());
        const bruto = await extractTextFromBlob(blob, abrir.nome || 'documento.pdf', 100, true);
        if (bruto && bruto.trim().length >= 200) {
          partes.push(`===== DOCUMENTO: ${abrir.nome || rotulo} =====\n${recortarRelevante(bruto, LIMITE_POR_ARQUIVO)}`);
        }
      } catch {
        // anexo ilegível (imagem sem OCR, formato exótico) — segue para o próximo
      }
    }

    const texto = partes.join('\n\n');
    if (!texto || texto.trim().length < 200) {
      throw new Error('Nenhum documento do processo pôde ser lido (PDFs digitalizados sem OCR?).');
    }

    setEstado(licitacaoId, { fase: 'Aurélia analisando as exigências…' });
    const { data, error } = await supabase.functions.invoke('habilitacao-checklist', {
      body: { licitacao_id: licitacaoId, edital_texto: texto },
    });
    if (error || !data?.success) {
      throw new Error(await mensagemReal(error, (data as { error?: string })?.error || 'A análise falhou.'));
    }

    const r = data.resumo as { ok: number; vence_antes_sessao: number; faltante: number; total: number };
    toast.success(`Checklist de habilitação pronto: ${r.ok} ok · ${r.vence_antes_sessao} vencendo · ${r.faltante} faltante(s).`);

    // Trilha de auditoria — direto, sem hook (estamos fora do React)
    const { data: u } = await supabase.auth.getUser();
    if (u?.user) {
      const { data: lic } = await supabase.from('licitacoes').select('empresa_id').eq('id', licitacaoId).maybeSingle();
      await supabase.from('atividades_colaborador').insert({
        user_id: u.user.id,
        empresa_id: lic?.empresa_id ?? null,
        acao: 'habilitacao_checklist_gerado',
        modulo: 'licitacoes',
        descricao: `Checklist de habilitação gerado pela Aurélia: ${r.total} exigências (${r.faltante} faltantes).`,
        metadata: { ...r, licitacao_id: licitacaoId },
      });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Não foi possível gerar o checklist.';
    setEstado(licitacaoId, { erro: msg });
    toast.error(`Checklist de habilitação: ${msg}`);
  } finally {
    const c = getEstadoGeracao(licitacaoId).concluidas;
    setEstado(licitacaoId, { rodando: false, fase: '', concluidas: c + 1 });
  }
}
