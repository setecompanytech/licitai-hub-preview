import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  calcularVersao,
  type CriterioDeDisputa,
  type ItemDePrecificacao,
  type LinhaDaMemoria,
  type OrigemDaPremissa,
  type PremissasDaVersao,
  type VersaoCalculada,
} from '@/lib/precificacao/versao';
import type { CamadasPreco } from '@/lib/precificacao/formacao-preco';

/**
 * As versões da precificação de um processo — carregar, revisar, submeter e
 * aprovar.
 *
 * O que este hook NÃO faz é tão importante quanto o que faz:
 *
 *  - não inventa percentual. Despesa administrativa vem do indicador que a
 *    empresa ADOTOU no Financeiro (ato datado, com período); tributo só viria
 *    de uma alíquota efetiva configurada, e `financeiro_config_tributaria` não
 *    tem essa coluna — tem alíquotas por tributo e presunções, que dependem
 *    de regime, anexo e faixa para virar um percentual sobre a venda. Somá-las
 *    aqui seria reapurar imposto dentro da tela de preço. Fica "não
 *    configurado", e a aprovação trava até alguém informar;
 *  - não calcula preço por conta própria. Grava o que `calcularVersao`
 *    devolve, em centavos, com a memória de cálculo junto;
 *  - não aprova no cliente. A aprovação é a função do banco, que confere papel
 *    e pendências do lado que não pode ser contornado.
 *
 * As tabelas `precificacao_versoes` e `precificacao_versao_itens` nasceram em
 * 14/09/2026 e podem ainda não existir no banco de produção. Tabela ausente é
 * um estado explícito (`migracaoPendente`), nunca uma tela quebrada nem uma
 * lista vazia que parece "nenhuma versão".
 */

// ── Tipos das linhas ────────────────────────────────────────────────────────

export type SituacaoDaVersao = 'rascunho' | 'submetida' | 'aprovada' | 'substituida' | 'descartada';

export interface LinhaItemDaVersao {
  id: string;
  versao_id: string;
  empresa_id: string;
  licitacao_item_id: string | null;
  numero: number;
  lote: string | null;
  descricao: string;
  quantidade: number;
  unidade: string;
  fornecedor: string | null;
  cotacao_referencia: string | null;
  cotacao_data: string | null;
  cotacao_validade: string | null;
  marca: string | null;
  fabricante: string | null;
  modelo: string | null;
  custo_unitario: number | null;
  frete_unitario: number | null;
  seguro_unitario: number | null;
  outras_despesas_unitario: number | null;
  valor_estimado_orgao: number | null;
  preco_sugerido_centavos: number | null;
  preco_inicial_centavos: number | null;
  limite_centavos: number | null;
  autorizado: boolean;
  memoria: LinhaDaMemoria[] | null;
}

export interface VersaoDePrecificacao {
  id: string;
  empresa_id: string;
  licitacao_id: string;
  numero: number;
  situacao: SituacaoDaVersao;
  criterio_disputa: CriterioDeDisputa;
  premissas: PremissasDaVersao;
  documentos_usados: unknown[];
  total_inicial_centavos: number | null;
  observacao: string | null;
  criado_por: string | null;
  submetida_por: string | null;
  submetida_em: string | null;
  aprovada_por: string | null;
  aprovada_em: string | null;
  substituida_por_versao_id: string | null;
  created_at: string;
  updated_at: string;
  itens: LinhaItemDaVersao[];
}

/** Item do processo como veio de `licitacao_itens`. */
export interface ItemDoProcesso {
  id: string;
  numero: number;
  lote: string | null;
  descricao: string;
  quantidade: number;
  unidade: string;
  marca: string | null;
  fabricante: string | null;
  modelo: string | null;
  custoUnitario: number | null;
  /** Só quando a origem garante que é a estimativa do órgão — ver `estimadoDoOrgao`. */
  valorEstimadoOrgao: number | null;
  origem: string | null;
}

/** O indicador adotado mais recente, para oferecer "usar este" na revisão. */
export interface IndicadorAdotado {
  id: string;
  pctDespesaAdministrativa: number | null;
  referencia: string;
  meses: number;
  periodo: string;
  adotadoEm: string;
}

export interface ResultadoDaAcao {
  ok: boolean;
  erro?: string;
  versaoId?: string;
}

// ── Erros ───────────────────────────────────────────────────────────────────

type ErroDoBanco = { code?: string; message?: string; details?: string; hint?: string } | null | undefined;

/**
 * Tabela ou função que o PostgREST não conhece. 42P01 vem do Postgres,
 * PGRST205/PGRST202 do cache de esquema do PostgREST — cada caminho reporta a
 * ausência de um jeito, e os três significam a mesma coisa: a migration de
 * 14/09 ainda não foi colada no SQL Editor.
 */
export function ehMigracaoPendente(erro: ErroDoBanco): boolean {
  if (!erro) return false;
  if (erro.code === '42P01' || erro.code === 'PGRST205' || erro.code === 'PGRST202') return true;
  const texto = `${erro.message ?? ''} ${erro.details ?? ''}`.toLowerCase();
  return (
    /(relation|table|function).*does not exist/.test(texto) ||
    texto.includes('could not find the table') ||
    texto.includes('could not find the function')
  );
}

const MENSAGEM_DE_CONFLITO = 'Outra revisão foi salva por outra pessoa — recarregue antes de salvar.';

function mensagemDe(erro: unknown): string {
  if (erro && typeof erro === 'object' && 'message' in erro) return String((erro as { message: unknown }).message);
  return String(erro);
}

// ── Conversões linha ↔ item ─────────────────────────────────────────────────

function numeroOuNulo(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * `licitacao_itens.valor_unitario` NÃO tem um significado só. A extração do
 * PNCP grava ali `valorUnitarioEstimado` (a estimativa do órgão); a
 * sincronização do rascunho da Proposta grava o NOSSO preço; o diálogo do
 * robô grava o valor que a pessoa digitou. A migration de 09/09 registra isso
 * no comentário da coluna: "valor da proposta/edital conforme a origem".
 *
 * Por isso a estimativa só é aproveitada quando a ORIGEM é o PNCP — é o único
 * caminho em que o código de gravação lê um campo de estimativa. Nos demais o
 * campo fica vazio: aviso de "acima do estimado" calculado sobre o nosso
 * próprio preço seria um alarme falso com cara de conferência.
 */
export function estimadoDoOrgao(origem: string | null, valorUnitario: unknown): number | null {
  if (!origem || !/pncp/i.test(origem)) return null;
  const v = numeroOuNulo(valorUnitario);
  return v != null && v > 0 ? v : null;
}

const CAMADAS: Array<keyof CamadasPreco> = ['pctImpostos', 'pctDespesasAdmin', 'pctDespesasOperacionais', 'pctMargem'];

/**
 * Premissas gravadas → premissas utilizáveis. Uma linha antiga ou incompleta
 * não pode virar "0% informado": camada sem origem volta como não configurada.
 */
export function premissasDaLinha(bruto: unknown, criterio?: string | null): PremissasDaVersao {
  const p = (bruto && typeof bruto === 'object' ? bruto : {}) as Partial<PremissasDaVersao>;
  const camadas = {} as CamadasPreco;
  const origem = {} as Record<keyof CamadasPreco, OrigemDaPremissa>;
  CAMADAS.forEach((k) => {
    camadas[k] = numeroOuNulo(p.camadas?.[k]) as number;
    const o = p.origem?.[k];
    origem[k] = o && o.fonte ? o : { fonte: 'nao_configurado' };
  });
  return {
    camadas,
    origem,
    criterio: ((criterio ?? p.criterio) || 'nao_informado') as CriterioDeDisputa,
  };
}

/**
 * Linha gravada → item de precificação. O preço inicial só volta como
 * escolha da pessoa quando a memória diz que foi ("definido na revisão");
 * igual ao sugerido, ele continua acompanhando o sugerido se as premissas
 * mudarem.
 */
export function itemDaLinha(linha: LinhaItemDaVersao): ItemDePrecificacao {
  const memoria = Array.isArray(linha.memoria) ? linha.memoria : [];
  const linhaDoInicial = memoria.find((m) => m.rotulo === 'Preço inicial da proposta');
  const inicial = numeroOuNulo(linha.preco_inicial_centavos);
  const sugerido = numeroOuNulo(linha.preco_sugerido_centavos);
  const definidoNaRevisao =
    inicial != null &&
    (linhaDoInicial?.formula === 'definido na revisão' || sugerido == null || (!linhaDoInicial && inicial !== sugerido));
  const limite = numeroOuNulo(linha.limite_centavos);

  return {
    licitacaoItemId: linha.licitacao_item_id ?? null,
    numero: Number(linha.numero),
    lote: linha.lote ?? null,
    descricao: linha.descricao,
    quantidade: Number(linha.quantidade) || 0,
    unidade: linha.unidade,
    custoUnitario: numeroOuNulo(linha.custo_unitario),
    freteUnitario: numeroOuNulo(linha.frete_unitario),
    seguroUnitario: numeroOuNulo(linha.seguro_unitario),
    outrasDespesasUnitario: numeroOuNulo(linha.outras_despesas_unitario),
    valorEstimadoOrgao: numeroOuNulo(linha.valor_estimado_orgao),
    marca: linha.marca,
    fabricante: linha.fabricante,
    modelo: linha.modelo,
    fornecedor: linha.fornecedor,
    cotacaoReferencia: linha.cotacao_referencia,
    cotacaoData: linha.cotacao_data,
    cotacaoValidade: linha.cotacao_validade,
    precoInicial: definidoNaRevisao ? inicial / 100 : null,
    limite: limite != null ? limite / 100 : null,
    autorizado: linha.autorizado !== false,
  };
}

/** Item do processo → item de precificação, sem nenhum preço ou limite presumido. */
export function itemDoProcesso(i: ItemDoProcesso): ItemDePrecificacao {
  return {
    licitacaoItemId: i.id,
    numero: i.numero,
    lote: i.lote,
    descricao: i.descricao,
    quantidade: i.quantidade,
    unidade: i.unidade,
    custoUnitario: i.custoUnitario,
    valorEstimadoOrgao: i.valorEstimadoOrgao,
    marca: i.marca,
    fabricante: i.fabricante,
    modelo: i.modelo,
    // Limite NUNCA nasce do custo: era exatamente o piso pré-preenchido que a
    // migration de 14/09 veio aposentar.
    limite: null,
    precoInicial: null,
    autorizado: true,
  };
}

/** Recalcula uma versão gravada — para comparar, nunca para regravar. */
export function recalcularVersao(v: VersaoDePrecificacao): VersaoCalculada {
  return calcularVersao(
    [...(v.itens ?? [])].sort((a, b) => a.numero - b.numero).map(itemDaLinha),
    v.premissas,
  );
}

/**
 * Os itens de partida da revisão: os da versão-base, mais os do processo que
 * ela ainda não tem.
 *
 * O casamento é pelo id estável. Quando o edital é reextraído, os ids de
 * `licitacao_itens` mudam e a versão fica com `licitacao_item_id` nulo (a FK é
 * SET NULL); aí — e só aí — casa por lote + número, e o item volta a apontar
 * para o id novo. Descrição nunca é critério.
 */
export function montarItensDaRevisao(
  base: VersaoDePrecificacao | null,
  itensDoProcesso: ItemDoProcesso[],
): ItemDePrecificacao[] {
  const daVersao = [...(base?.itens ?? [])].sort((a, b) => a.numero - b.numero).map(itemDaLinha);
  const usados = new Set<number>();

  itensDoProcesso.forEach((doProcesso) => {
    let idx = daVersao.findIndex((i) => i.licitacaoItemId === doProcesso.id);
    if (idx === -1) {
      idx = daVersao.findIndex(
        (i, n) =>
          !usados.has(n) &&
          i.licitacaoItemId == null &&
          i.numero === doProcesso.numero &&
          (i.lote ?? null) === (doProcesso.lote ?? null),
      );
      if (idx !== -1) daVersao[idx] = { ...daVersao[idx], licitacaoItemId: doProcesso.id };
    }
    if (idx !== -1) {
      usados.add(idx);
      return;
    }
    daVersao.push(itemDoProcesso(doProcesso));
  });

  return daVersao.sort((a, b) => (a.lote ?? '').localeCompare(b.lote ?? '') || a.numero - b.numero);
}

function periodoDoIndicador(referencia: string, meses: number): string {
  const m = /^(\d{4})-(\d{2})/.exec(referencia ?? '');
  if (!m) return `${meses} meses`;
  return `${meses} ${meses === 1 ? 'mês' : 'meses'} até ${m[2]}/${m[1]}`;
}

/**
 * Premissas de partida de uma revisão que ainda não tem versão. Despesa
 * administrativa do indicador adotado; o resto em branco e declarado como não
 * configurado — margem de 15% "padrão" é política de um cliente, não do
 * produto (CLAUDE.md, princípio 7).
 */
export function premissasIniciais(indicador: IndicadorAdotado | null): PremissasDaVersao {
  const temIndicador = indicador != null && indicador.pctDespesaAdministrativa != null;
  return {
    camadas: {
      pctImpostos: null as number,
      pctDespesasAdmin: (temIndicador ? indicador.pctDespesaAdministrativa : null) as number,
      pctDespesasOperacionais: null as number,
      pctMargem: null as number,
    },
    origem: {
      pctImpostos: { fonte: 'nao_configurado' },
      pctDespesasAdmin: temIndicador
        ? { fonte: 'indicadores_financeiro', referencia: indicador.id, periodo: indicador.periodo }
        : { fonte: 'nao_configurado' },
      pctDespesasOperacionais: { fonte: 'nao_configurado' },
      pctMargem: { fonte: 'nao_configurado' },
    },
    criterio: 'nao_informado',
  };
}

function linhasDosItens(
  calculada: VersaoCalculada,
  versaoId: string,
  empresaId: string,
): Record<string, unknown>[] {
  return calculada.itens.map(({ item, precoSugeridoCentavos, precoInicialCentavos, limiteCentavos, autorizado, memoria }) => ({
    versao_id: versaoId,
    empresa_id: empresaId,
    licitacao_item_id: item.licitacaoItemId,
    numero: item.numero,
    lote: item.lote,
    descricao: item.descricao,
    quantidade: item.quantidade,
    unidade: item.unidade || 'UN',
    fornecedor: item.fornecedor || null,
    cotacao_referencia: item.cotacaoReferencia || null,
    cotacao_data: item.cotacaoData || null,
    cotacao_validade: item.cotacaoValidade || null,
    marca: item.marca || null,
    fabricante: item.fabricante || null,
    modelo: item.modelo || null,
    custo_unitario: item.custoUnitario ?? null,
    frete_unitario: item.freteUnitario ?? null,
    seguro_unitario: item.seguroUnitario ?? null,
    outras_despesas_unitario: item.outrasDespesasUnitario ?? null,
    valor_estimado_orgao: item.valorEstimadoOrgao ?? null,
    preco_sugerido_centavos: precoSugeridoCentavos,
    preco_inicial_centavos: precoInicialCentavos,
    limite_centavos: limiteCentavos,
    autorizado,
    memoria,
  }));
}

// ── O hook ──────────────────────────────────────────────────────────────────

interface Opcoes {
  licitacaoId: string;
  empresaId: string | null;
  /**
   * Falso para quem não opera (viewer): o RLS nem deixaria ler custo, e a
   * tela usa `limites_operacionais_do_processo` no lugar. Padrão: verdadeiro.
   */
  habilitado?: boolean;
}

export function usePrecificacaoVersoes({ licitacaoId, empresaId, habilitado = true }: Opcoes) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [migracaoPendente, setMigracaoPendente] = useState(false);
  const [conflito, setConflito] = useState<string | null>(null);
  const [itensDoProcesso, setItensDoProcesso] = useState<ItemDoProcesso[]>([]);
  const [versoes, setVersoes] = useState<VersaoDePrecificacao[]>([]);
  const [indicador, setIndicador] = useState<IndicadorAdotado | null>(null);
  const [avisoDoIndicador, setAvisoDoIndicador] = useState<string | null>(null);
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState<null | 'salvando' | 'submetendo' | 'aprovando'>(null);

  // Descarta a resposta de uma carga que já foi superada (troca de processo
  // no meio da consulta), para uma lista não sobrescrever a outra.
  const cargaAtual = useRef(0);

  const carregar = useCallback(async () => {
    const carga = ++cargaAtual.current;
    if (!licitacaoId) {
      setCarregando(false);
      return;
    }
    // Desabilitado, `carregando` fica como está (verdadeiro na montagem). Se o
    // papel chegar depois e habilitar a carga, a tela não pisca "nenhum item"
    // no intervalo entre o render e o efeito.
    if (!habilitado) return;
    setCarregando(true);
    setErro(null);
    // Recarregar é a saída do conflito: o que vier do banco passa a ser a base.
    setConflito(null);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- `custo_unitario` e as tabelas de 14/09 não estão no types.ts (parado em 16/08)
      const sb = supabase as any;

      const colunasDoItem = 'id, numero, lote, descricao, quantidade, unidade, valor_unitario, marca, fabricante, modelo, origem';
      let respItens = await sb
        .from('licitacao_itens')
        .select(`${colunasDoItem}, custo_unitario`)
        .eq('licitacao_id', licitacaoId)
        .order('numero');
      // `custo_unitario` é da migration de 09/09; sem ela, carrega o resto em
      // vez de derrubar a tela inteira por uma coluna opcional.
      if (respItens.error?.code === '42703') {
        respItens = await sb.from('licitacao_itens').select(colunasDoItem).eq('licitacao_id', licitacaoId).order('numero');
      }

      const [respVersoes, respIndicador] = await Promise.all([
        sb
          .from('precificacao_versoes')
          .select('*, itens:precificacao_versao_itens(*)')
          .eq('licitacao_id', licitacaoId)
          .order('numero', { ascending: false }),
        empresaId
          ? sb
              .from('financeiro_indicadores_adotados')
              .select('id, referencia, meses, pct_despesa_administrativa, adotado_em')
              .eq('empresa_id', empresaId)
              .order('adotado_em', { ascending: false })
              .limit(1)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (carga !== cargaAtual.current) return;

      if (respItens.error) throw respItens.error;
      setItensDoProcesso(
        ((respItens.data ?? []) as Record<string, unknown>[]).map((r) => ({
          id: String(r.id),
          numero: Number(r.numero),
          lote: (r.lote as string) ?? null,
          descricao: String(r.descricao ?? ''),
          quantidade: Number(r.quantidade) || 0,
          unidade: String(r.unidade ?? 'UN'),
          marca: (r.marca as string) ?? null,
          fabricante: (r.fabricante as string) ?? null,
          modelo: (r.modelo as string) ?? null,
          // Zero em custo é "não sabido" nas gravações antigas (a Precificação
          // gravava `custo_unitario: 0`); nunca vira custo de verdade.
          custoUnitario: (numeroOuNulo(r.custo_unitario) ?? 0) > 0 ? Number(r.custo_unitario) : null,
          valorEstimadoOrgao: estimadoDoOrgao((r.origem as string) ?? null, r.valor_unitario),
          origem: (r.origem as string) ?? null,
        })),
      );

      if (respVersoes.error) {
        if (ehMigracaoPendente(respVersoes.error)) {
          setMigracaoPendente(true);
          setVersoes([]);
        } else {
          throw respVersoes.error;
        }
      } else {
        setMigracaoPendente(false);
        const lista = ((respVersoes.data ?? []) as Record<string, unknown>[]).map((r) => ({
          ...(r as unknown as VersaoDePrecificacao),
          numero: Number(r.numero),
          premissas: premissasDaLinha(r.premissas, r.criterio_disputa as string),
          itens: ((r.itens ?? []) as LinhaItemDaVersao[]),
        }));
        setVersoes(lista);

        // Quem aprovou e quem submeteu: sem nome, o selo de aprovação vira um UUID.
        const ids = [...new Set(lista.flatMap((v) => [v.aprovada_por, v.submetida_por]).filter(Boolean))] as string[];
        if (ids.length) {
          const { data: perfis } = await sb.from('profiles').select('user_id, nome_completo, username').in('user_id', ids);
          if (carga === cargaAtual.current) {
            setNomes(
              Object.fromEntries(
                ((perfis ?? []) as { user_id: string; nome_completo?: string | null; username?: string | null }[]).map((p) => [
                  p.user_id,
                  p.nome_completo?.trim() || p.username?.trim() || 'Colaborador',
                ]),
              ),
            );
          }
        }
      }

      if (respIndicador.error) {
        setIndicador(null);
        setAvisoDoIndicador(`Não foi possível ler os indicadores adotados do Financeiro: ${mensagemDe(respIndicador.error)}`);
      } else {
        setAvisoDoIndicador(null);
        const r = respIndicador.data as Record<string, unknown> | null;
        setIndicador(
          r
            ? {
                id: String(r.id),
                pctDespesaAdministrativa: numeroOuNulo(r.pct_despesa_administrativa),
                referencia: String(r.referencia ?? ''),
                meses: Number(r.meses) || 0,
                periodo: periodoDoIndicador(String(r.referencia ?? ''), Number(r.meses) || 0),
                adotadoEm: String(r.adotado_em ?? ''),
              }
            : null,
        );
      }
    } catch (e) {
      if (carga !== cargaAtual.current) return;
      setErro(mensagemDe(e));
    } finally {
      if (carga === cargaAtual.current) setCarregando(false);
    }
  }, [habilitado, licitacaoId, empresaId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const vigente = useMemo(() => versoes.find((v) => v.situacao === 'aprovada') ?? null, [versoes]);
  /** A revisão em curso: a mais recente ainda não decidida. */
  const rascunhoAtual = useMemo(() => {
    const maisRecente = versoes[0];
    return maisRecente && (maisRecente.situacao === 'rascunho' || maisRecente.situacao === 'submetida') ? maisRecente : null;
  }, [versoes]);
  const historico = versoes;

  const salvarRevisao = useCallback(
    async (premissas: PremissasDaVersao, itens: ItemDePrecificacao[]): Promise<ResultadoDaAcao> => {
      if (!empresaId) return { ok: false, erro: 'Selecione a empresa do processo antes de salvar.' };
      if (migracaoPendente) return { ok: false, erro: 'Migração pendente — a revisão não pode ser gravada.' };
      setOcupado('salvando');
      setConflito(null);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas de 14/09 fora do types.ts
      const sb = supabase as any;
      const calculada = calcularVersao(itens, premissas);
      const cabecalho = {
        criterio_disputa: premissas.criterio,
        premissas,
        // Os documentos em que a precificação se apoiou ainda não são
        // rastreados por versão. Lista vazia é "não registrado" — inventar
        // aqui o nome do edital seria afirmar o que ninguém conferiu.
        documentos_usados: [],
        total_inicial_centavos: calculada.totalInicialCentavos,
      };

      try {
        const editavel = rascunhoAtual?.situacao === 'rascunho' ? rascunhoAtual : null;

        if (editavel) {
          // Trava otimista: só atualiza se ninguém gravou (nem submeteu) desde
          // que esta tela carregou. Zero linhas de volta = outra pessoa passou.
          const { data: atualizada, error: erroCab } = await sb
            .from('precificacao_versoes')
            .update(cabecalho)
            .eq('id', editavel.id)
            .eq('situacao', 'rascunho')
            .eq('updated_at', editavel.updated_at)
            .select('id, updated_at');
          if (erroCab) throw erroCab;
          if (!atualizada || (Array.isArray(atualizada) && atualizada.length === 0)) {
            setConflito(MENSAGEM_DE_CONFLITO);
            return { ok: false, erro: MENSAGEM_DE_CONFLITO };
          }

          const { error: erroApagar } = await sb.from('precificacao_versao_itens').delete().eq('versao_id', editavel.id);
          if (erroApagar) throw erroApagar;
          const { error: erroInserir } = await sb
            .from('precificacao_versao_itens')
            .insert(linhasDosItens(calculada, editavel.id, empresaId));
          if (erroInserir) {
            // Sem transação no cliente: devolve os itens que estavam lá, para
            // o rascunho não ficar sem nenhum item por uma falha no meio.
            if (editavel.itens.length) {
              await sb.from('precificacao_versao_itens').insert(editavel.itens.map(({ id: _id, ...resto }) => resto));
            }
            throw erroInserir;
          }
          await carregar();
          return { ok: true, versaoId: editavel.id };
        }

        const numero = versoes.reduce((max, v) => Math.max(max, v.numero), 0) + 1;
        const { data: nova, error: erroNova } = await sb
          .from('precificacao_versoes')
          .insert({ ...cabecalho, empresa_id: empresaId, licitacao_id: licitacaoId, numero, situacao: 'rascunho' })
          .select('id')
          .single();
        if (erroNova) {
          if (erroNova.code === '23505') {
            setConflito(MENSAGEM_DE_CONFLITO);
            return { ok: false, erro: MENSAGEM_DE_CONFLITO };
          }
          throw erroNova;
        }
        const versaoId = String((nova as { id: string }).id);
        const { error: erroItens } = await sb
          .from('precificacao_versao_itens')
          .insert(linhasDosItens(calculada, versaoId, empresaId));
        if (erroItens) {
          // Rascunho recém-criado sem itens não serve a ninguém.
          await sb.from('precificacao_versoes').delete().eq('id', versaoId);
          throw erroItens;
        }
        await carregar();
        return { ok: true, versaoId };
      } catch (e) {
        if (ehMigracaoPendente(e as ErroDoBanco)) setMigracaoPendente(true);
        return { ok: false, erro: mensagemDe(e) };
      } finally {
        setOcupado(null);
      }
    },
    [empresaId, licitacaoId, migracaoPendente, rascunhoAtual, versoes, carregar],
  );

  const submeter = useCallback(
    async (versaoId: string): Promise<ResultadoDaAcao> => {
      setOcupado('submetendo');
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabela de 14/09 fora do types.ts
        const { data, error } = await (supabase as any)
          .from('precificacao_versoes')
          .update({ situacao: 'submetida', submetida_por: userId, submetida_em: new Date().toISOString() })
          .eq('id', versaoId)
          .eq('situacao', 'rascunho')
          .select('id');
        if (error) throw error;
        if (!data || (Array.isArray(data) && data.length === 0)) {
          setConflito(MENSAGEM_DE_CONFLITO);
          return { ok: false, erro: MENSAGEM_DE_CONFLITO };
        }
        await carregar();
        return { ok: true, versaoId };
      } catch (e) {
        return { ok: false, erro: mensagemDe(e) };
      } finally {
        setOcupado(null);
      }
    },
    [userId, carregar],
  );

  const aprovar = useCallback(
    async (versaoId: string): Promise<ResultadoDaAcao> => {
      setOcupado('aprovando');
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- função de 14/09 fora do types.ts
        const { error } = await (supabase as any).rpc('aprovar_precificacao_versao', { p_versao_id: versaoId });
        if (error) {
          if (ehMigracaoPendente(error)) setMigracaoPendente(true);
          // A mensagem do servidor é a explicação — ele confere papel e
          // pendências; reescrevê-la esconderia o motivo real.
          return { ok: false, erro: mensagemDe(error) };
        }
        await carregar();
        return { ok: true, versaoId };
      } catch (e) {
        return { ok: false, erro: mensagemDe(e) };
      } finally {
        setOcupado(null);
      }
    },
    [carregar],
  );

  return {
    carregando,
    erro,
    migracaoPendente,
    conflito,
    itensDoProcesso,
    versoes,
    vigente,
    rascunhoAtual,
    historico,
    indicador,
    avisoDoIndicador,
    nomes,
    ocupado,
    salvarRevisao,
    submeter,
    aprovar,
    recarregar: carregar,
  };
}
