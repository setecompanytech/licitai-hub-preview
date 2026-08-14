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
    const edital = lista.arquivos.find((a: { tipo?: string }) => /edital/i.test(a.tipo || '')) || lista.arquivos[0];

    setEstado(licitacaoId, { fase: 'Baixando o edital…' });
    const { data: abrir, error: abrirErr } = await supabase.functions.invoke('pncp-arquivos-edital', {
      body: { licitacao_id: licitacaoId, action: 'abrir', sequencial: edital.sequencial },
    });
    if (abrirErr || !abrir?.success || !abrir?.path) {
      throw new Error(await mensagemReal(abrirErr, 'Não foi possível baixar o edital do PNCP.'));
    }

    const { data: signed } = await supabase.storage.from('processo-arquivos').createSignedUrl(abrir.path, 600);
    if (!signed?.signedUrl) throw new Error('Edital baixado, mas o link de leitura não pôde ser gerado.');

    setEstado(licitacaoId, { fase: 'Lendo o edital (extração de texto)…' });
    const blob = await fetch(signed.signedUrl).then((r) => r.blob());
    const texto = await extractTextFromBlob(blob, abrir.nome || 'edital.pdf', 80, true);
    if (!texto || texto.trim().length < 200) {
      throw new Error('O texto do edital não pôde ser extraído (PDF digitalizado sem OCR?).');
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
