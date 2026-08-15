import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Cotação automática dos itens do edital como PROCESSO DA PÁGINA, fora do
 * React — mesmo padrão de `lib/habilitacao/gerarChecklist`: a série de
 * pesquisas continua rodando se o usuário trocar de aba; os componentes
 * apenas observam o estado.
 *
 * DUAS fontes por item, consultadas em paralelo:
 *  - `consulta-painel-precos`: preços unitários HOMOLOGADOS em ATAs e
 *    contratos reais no PNCP — a referência que a IN 65/2021 manda
 *    priorizar (contratações públicas similares vêm antes de cotação de
 *    mercado);
 *  - `pesquisa-preco-real`: fornecedores de mercado (Google Shopping via
 *    Serper + Firecrawl), com preço, loja e link.
 * Toda fonte fica visível para o usuário auditar antes de usar o preço.
 */

export type FornecedorCotado = {
  titulo: string;
  preco: number;
  loja: string;
  url: string;
  origem: 'internet' | 'pncp';
  /** Só para origem 'pncp': contextualiza o preço homologado. */
  orgao?: string;
  data?: string;
  situacao?: string;
};

export type CotacaoItem = {
  status: 'cotando' | 'cotado' | 'erro';
  fornecedores: FornecedorCotado[];
  menorPreco: number;
  precoMedio: number;
  /** Mediana dos preços homologados no PNCP — a âncora da pesquisa de preços. */
  pncpMediana?: number;
  pncpRegistros?: number;
  /** O PNCP respondeu mas sem registros para o termo — sinalizado, não omitido. */
  pncpVazio?: boolean;
  /** Marca/fabricante do resultado de mercado mais frequente — sugestão, quem confirma é o usuário. */
  marcaSugerida?: string;
  erro?: string;
};

/**
 * Descrições de edital são burocráticas e longas; a busca do PNCP usa a frase
 * exata, então cortamos no primeiro delimitador de complemento e limitamos o
 * tamanho ("CADEIRA FIXA EMPILHÁVEL EM POLIPROPILENO, CONFORME..." → parte
 * antes da vírgula).
 */
function termoCurto(descricao: string): string {
  // Normaliza pontuação/travessões e usa as primeiras palavras significativas:
  // "CADEIRA PARA ESCRITORIO – TIPO DIRETOR Cadeira administrativa..." →
  // "CADEIRA PARA ESCRITORIO TIPO DIRETOR". Frase exata longa no PNCP = zero.
  const palavras = descricao
    .split(/[,;:(]/)[0]
    .replace(/[–—\-"']/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);
  const base = palavras.slice(0, 6).join(' ');
  return (base.length >= 8 ? base : descricao).slice(0, 80);
}

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
        const anoAtual = new Date().getFullYear();
        const [internet, pncp] = await Promise.allSettled([
          supabase.functions.invoke('pesquisa-preco-real', {
            body: { termo: item.descricao.slice(0, 120) },
          }),
          supabase.functions.invoke('consulta-painel-precos', {
            body: { termo: termoCurto(item.descricao), anoInicio: anoAtual - 2, anoFim: anoAtual },
          }),
        ]);

        const fornecedores: FornecedorCotado[] = [];

        // PNCP primeiro: preço homologado é a referência prioritária (IN 65/2021)
        let pncpMediana: number | undefined;
        let pncpRegistros: number | undefined;
        let pncpVazio = false;
        if (pncp.status === 'fulfilled' && pncp.value.data?.success) {
          const d = pncp.value.data as {
            resultados?: Array<{ descricao?: string; orgao?: string; preco_unitario?: number; data_compra?: string; url?: string; situacao?: string }>;
            resumo?: { mediana?: number; total_registros?: number };
          };
          fornecedores.push(
            ...(d.resultados || [])
              .filter((r) => (r.preco_unitario || 0) > 0)
              .slice(0, 6)
              .map((r) => ({
                titulo: r.descricao || '',
                preco: r.preco_unitario || 0,
                loja: 'PNCP',
                url: r.url || '',
                origem: 'pncp' as const,
                orgao: r.orgao || '',
                data: (r.data_compra || '').slice(0, 10),
                situacao: r.situacao || '',
              })),
          );
          if (d.resumo?.mediana) {
            pncpMediana = d.resumo.mediana;
            pncpRegistros = d.resumo.total_registros;
          }
          if (!(d.resultados || []).length) pncpVazio = true;
        } else {
          pncpVazio = true;
        }

        let marcaSugerida: string | undefined;
        if (internet.status === 'fulfilled' && internet.value.data?.success) {
          const d = internet.value.data as { data?: { fornecedores?: Array<{ titulo?: string; nome?: string; preco?: number; loja?: string; url?: string; marca?: string }> } };
          const doMercado = (d.data?.fornecedores || []).slice(0, 8);
          fornecedores.push(
            ...doMercado
              .map((f) => ({
                titulo: f.titulo || f.nome || '',
                preco: f.preco || 0,
                loja: f.loja || '',
                url: f.url || '',
                origem: 'internet' as const,
              }))
              .filter((f) => f.preco > 0),
          );
          // Marca mais frequente entre os resultados de mercado — a função
          // pesquisa-preco-real já extrai a marca de cada título.
          const contagem = new Map<string, number>();
          for (const f of doMercado) {
            const m = (f.marca || '').trim();
            if (m) contagem.set(m, (contagem.get(m) || 0) + 1);
          }
          marcaSugerida = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
        }

        if (!fornecedores.length) {
          resultado = { status: 'erro', fornecedores: [], menorPreco: 0, precoMedio: 0, erro: 'Nenhum resultado na pesquisa' };
        } else {
          const precos = fornecedores.map((f) => f.preco);
          resultado = {
            status: 'cotado',
            fornecedores,
            menorPreco: Math.min(...precos),
            precoMedio: Math.round((precos.reduce((a, b) => a + b, 0) / precos.length) * 100) / 100,
            pncpMediana,
            pncpRegistros,
            pncpVazio,
            marcaSugerida,
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
