import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Cotação automática dos itens do edital como PROCESSO DA PÁGINA, fora do
 * React — mesmo padrão de `lib/habilitacao/gerarChecklist`: a série de
 * pesquisas continua rodando se o usuário trocar de aba; os componentes
 * apenas observam o estado.
 *
 * Cada item vira uma consulta à Edge Function `pesquisa-preco-real`
 * (Google Shopping via Serper + Firecrawl), que devolve fornecedores reais
 * com preço, loja e link — a fonte fica visível para o usuário auditar.
 */

export type FornecedorCotado = {
  titulo: string;
  preco: number;
  loja: string;
  url: string;
};

export type CotacaoItem = {
  status: 'cotando' | 'cotado' | 'erro';
  fornecedores: FornecedorCotado[];
  menorPreco: number;
  precoMedio: number;
  erro?: string;
};

export type EstadoCotacao = {
  rodando: boolean;
  atual: string;      // descrição do item em pesquisa
  feitos: number;
  total: number;
  cotacoes: Record<string, CotacaoItem>; // por id do licitacao_itens
};

const INICIAL: EstadoCotacao = { rodando: false, atual: '', feitos: 0, total: 0, cotacoes: {} };
const estados = new Map<string, EstadoCotacao>();
const listeners = new Map<string, Set<() => void>>();

function setEstado(licitacaoId: string, patch: Partial<EstadoCotacao>) {
  const atual = estados.get(licitacaoId) ?? { ...INICIAL, cotacoes: {} };
  estados.set(licitacaoId, { ...atual, ...patch });
  listeners.get(licitacaoId)?.forEach((cb) => cb());
}

export function getEstadoCotacao(licitacaoId: string): EstadoCotacao {
  return estados.get(licitacaoId) ?? INICIAL;
}

export function subscribeCotacao(licitacaoId: string, cb: () => void): () => void {
  if (!listeners.has(licitacaoId)) listeners.set(licitacaoId, new Set());
  listeners.get(licitacaoId)!.add(cb);
  return () => listeners.get(licitacaoId)?.delete(cb);
}

/** Cota uma lista de itens em série. Itens já cotados nesta sessão são pulados. */
export async function cotarItens(
  licitacaoId: string,
  itens: Array<{ id: string; descricao: string }>,
): Promise<void> {
  const estado = getEstadoCotacao(licitacaoId);
  if (estado.rodando) return; // já em andamento — a UI só observa

  const pendentes = itens.filter((it) => estado.cotacoes[it.id]?.status !== 'cotado');
  if (!pendentes.length) return;

  setEstado(licitacaoId, { rodando: true, feitos: 0, total: pendentes.length });
  let comPreco = 0;
  try {
    for (let i = 0; i < pendentes.length; i++) {
      const item = pendentes[i];
      setEstado(licitacaoId, {
        atual: item.descricao.slice(0, 80),
        feitos: i,
        cotacoes: { ...getEstadoCotacao(licitacaoId).cotacoes, [item.id]: { status: 'cotando', fornecedores: [], menorPreco: 0, precoMedio: 0 } },
      });
      let resultado: CotacaoItem;
      try {
        const { data, error } = await supabase.functions.invoke('pesquisa-preco-real', {
          body: { termo: item.descricao.slice(0, 120) },
        });
        const fornecedores: FornecedorCotado[] = (data?.data?.fornecedores || [])
          .slice(0, 8)
          .map((f: { titulo?: string; nome?: string; preco?: number; loja?: string; url?: string }) => ({
            titulo: f.titulo || f.nome || '',
            preco: f.preco || 0,
            loja: f.loja || '',
            url: f.url || '',
          }))
          .filter((f: FornecedorCotado) => f.preco > 0);
        if (error || !data?.success || !fornecedores.length) {
          resultado = { status: 'erro', fornecedores: [], menorPreco: 0, precoMedio: 0, erro: 'Nenhum resultado na pesquisa' };
        } else {
          const precos = fornecedores.map((f) => f.preco);
          resultado = {
            status: 'cotado',
            fornecedores,
            menorPreco: Math.min(...precos),
            precoMedio: Math.round((precos.reduce((a, b) => a + b, 0) / precos.length) * 100) / 100,
          };
          comPreco++;
        }
      } catch {
        resultado = { status: 'erro', fornecedores: [], menorPreco: 0, precoMedio: 0, erro: 'Erro na pesquisa' };
      }
      setEstado(licitacaoId, {
        feitos: i + 1,
        cotacoes: { ...getEstadoCotacao(licitacaoId).cotacoes, [item.id]: resultado },
      });
    }
    toast.success(`Cotação automática concluída: ${comPreco} de ${pendentes.length} item(ns) com preço encontrado.`);
  } finally {
    setEstado(licitacaoId, { rodando: false, atual: '' });
  }
}
