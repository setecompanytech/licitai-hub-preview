import { supabase } from '@/integrations/supabase/client';
import { lerTextoDoEdital } from '@/lib/processo/textoDoEdital';
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
    // A leitura do edital e dos anexos vive em lib/processo/textoDoEdital — a
    // montagem da Proposta usa a mesma. Duas cópias divergiriam no primeiro
    // ajuste, e esta é a leitura de que dependem checklist, proposta e itens.
    const { texto: lido } = await lerTextoDoEdital(licitacaoId, {
      limitePorArquivo: 60_000,
      aoProgredir: (fase) => setEstado(licitacaoId, { fase }),
    });
    const partes = lido ? [lido] : [];

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
