import { Fragment, useEffect, useState, useCallback, useSyncExternalStore } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { Loader2, Save, Calculator, ArrowRight, Search, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { cotarItens, getEstadoCotacao, subscribeCotacao } from '@/lib/precificacao/cotarItens';
import HistoricoDoOrgao from '@/components/precificacao/HistoricoDoOrgao';

/**
 * Fase 2 do prontuário integrado — precificação IN-CONTEXT.
 *
 * Os itens extraídos do edital (licitacao_itens, gravados pela preparação
 * automática ou pelo wizard) ganham uma coluna de preço editável AQUI, sem
 * expulsar o usuário para o módulo global. Salvar grava no catálogo
 * (catalogo_itens_precificados) — exatamente de onde a aba Proposta importa.
 */

type ItemEdital = {
  id: string;
  numero: number;
  descricao: string;
  quantidade: number;
  unidade: string;
  valor_unitario: number;
  marca: string | null;
  fabricante: string | null;
  modelo: string | null;
};

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const parsePreco = (s: string) =>
  parseFloat((s || '0').replace(/\./g, '').replace(',', '.')) || 0;

export default function ItensEditalPrecificacao({
  licitacaoId,
  onSaved,
  onIrParaProposta,
  pncpCoords,
  objetoProcesso,
}: {
  licitacaoId: string;
  onSaved?: () => void;
  onIrParaProposta?: () => void;
  /** Coordenadas PNCP do processo — excluídas da cotação (cotar a si mesmo é circular). */
  pncpCoords?: { cnpj: string; ano: string; seq: string } | null;
  /** Objeto do edital — âncora do Histórico do órgão (recorrência por descrição). */
  objetoProcesso?: string;
}) {
  const { user } = useAuth();
  const [itens, setItens] = useState<ItemEdital[]>([]);
  const [precos, setPrecos] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [fontesAbertas, setFontesAbertas] = useState<string | null>(null);
  const [editandoTermo, setEditandoTermo] = useState<string | null>(null);
  const [termoDraft, setTermoDraft] = useState('');
  const opcoesCotacao = { excluir: pncpCoords ?? undefined };
  // Cotação automática roda FORA do React (lib/precificacao/cotarItens):
  // trocar de aba não interrompe a série de pesquisas.
  const cotacao = useSyncExternalStore(
    useCallback((cb) => subscribeCotacao(licitacaoId, cb), [licitacaoId]),
    useCallback(() => getEstadoCotacao(licitacaoId), [licitacaoId]),
  );

  const carregar = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: lis }, { data: cat }] = await Promise.all([
      supabase
        .from('licitacao_itens')
        .select('id, numero, descricao, quantidade, unidade, valor_unitario, marca, fabricante, modelo')
        .eq('licitacao_id', licitacaoId)
        .order('numero'),
      supabase
        .from('catalogo_itens_precificados')
        .select('descricao, preco_unitario')
        .eq('licitacao_id', licitacaoId),
    ]);
    const lista = (lis || []) as ItemEdital[];
    setItens(lista);
    // Preço inicial: o já precificado no catálogo; senão, o estimado do edital
    const doCatalogo = new Map((cat || []).map((c) => [c.descricao, c.preco_unitario]));
    setPrecos(
      Object.fromEntries(
        lista.map((it) => {
          const p = doCatalogo.get(it.descricao) ?? (it.valor_unitario > 0 ? it.valor_unitario : null);
          return [it.id, p != null ? p.toFixed(2).replace('.', ',') : ''];
        }),
      ),
    );
    setLoading(false);
  }, [user, licitacaoId]);

  useEffect(() => { carregar(); }, [carregar]);

  const totalProposto = itens.reduce(
    (s, it) => s + parsePreco(precos[it.id] || '') * (it.quantidade || 0), 0,
  );

  const aplicarPreco = (itemId: string, valor: number) =>
    setPrecos((p) => ({ ...p, [itemId]: valor.toFixed(2).replace('.', ',') }));

  // Sugestão da cotação: marca mais frequente no mercado. Aplicar grava em
  // licitacao_itens — dali segue para o catálogo e para a Proposta.
  const aplicarMarca = async (itemId: string, marca: string) => {
    const { error } = await supabase
      .from('licitacao_itens')
      .update({ marca, fabricante: marca })
      .eq('id', itemId);
    if (error) { toast.error(`Não foi possível aplicar a marca: ${error.message}`); return; }
    setItens((prev) => prev.map((it) => (it.id === itemId ? { ...it, marca, fabricante: marca } : it)));
    toast.success(`Marca "${marca}" aplicada ao item.`);
  };

  const salvar = async () => {
    if (!user) return;
    const comPreco = itens.filter((it) => parsePreco(precos[it.id] || '') > 0);
    if (!comPreco.length) { toast.info('Informe ao menos um preço para salvar.'); return; }
    setSalvando(true);
    try {
      // Um registro por item do edital; recriar é mais simples e auditável do
      // que reconciliar por descrição (edital pode repetir descrições).
      await supabase
        .from('catalogo_itens_precificados')
        .delete()
        .eq('licitacao_id', licitacaoId)
        .eq('user_id', user.id)
        .eq('tipo_calculo', 'edital');

      const rows = comPreco.map((it) => {
        const unit = parsePreco(precos[it.id]);
        return {
          user_id: user.id,
          licitacao_id: licitacaoId,
          descricao: it.descricao,
          quantidade: it.quantidade || 1,
          unidade: it.unidade || 'UN',
          custo_unitario: 0,
          preco_unitario: unit,
          preco_total: unit * (it.quantidade || 1),
          // Sem custo informado não existe margem real — NULL explícito, senão
          // o DEFAULT 15 do banco inventa uma margem que ninguém calculou.
          margem_lucro: null,
          marca: it.marca,
          fabricante: it.fabricante,
          modelo: it.modelo,
          tipo_calculo: 'edital',
        };
      });
      const { error } = await supabase.from('catalogo_itens_precificados').insert(rows);
      if (error) throw error;
      toast.success(`${rows.length} item(ns) precificado(s) — prontos para importar na Proposta.`);
      onSaved?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar precificação.');
    } finally {
      setSalvando(false);
    }
  };

  if (loading) {
    return (
      <Card className="flex items-center gap-2 p-6 text-sm text-muted-foreground" role="status" aria-busy="true">
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Carregando itens do edital…
      </Card>
    );
  }

  if (!itens.length) {
    return (
      <Card className="p-6">
        <EstadoVazio
          tamanho="compacto"
          icone={<Calculator />}
          titulo="Nenhum item extraído do edital ainda"
          descricao="Use a Preparação automática na Visão Geral (ou o wizard da Proposta) para extrair o termo de referência."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
    <Card className="space-y-4 p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Calculator className="w-5 h-5 text-primary" aria-hidden="true" />
        <h2 className="text-lg font-semibold">Itens do edital — precificação rápida</h2>
        <span className="text-sm text-muted-foreground">
          {itens.length} item(ns) · edite o preço unitário e salve no catálogo
        </span>
        <Button
          size="sm"
          variant="outline"
          className="ml-auto"
          onClick={() => cotarItens(licitacaoId, itens, opcoesCotacao)}
          disabled={cotacao.rodando}
        >
          {cotacao.rodando
            ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            : <Search className="w-4 h-4" aria-hidden="true" />}
          Cotar todos na internet
        </Button>
      </div>

      {cotacao.rodando && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          Pesquisando preço {cotacao.feitos + 1}/{cotacao.total}: {cotacao.atual}… (continua mesmo se você trocar de aba)
        </p>
      )}

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted">
              <th className="w-10 px-3 py-2 text-left text-sm font-semibold">Nº</th>
              <th className="px-3 py-2 text-left text-sm font-semibold">Descrição</th>
              <th className="w-20 px-3 py-2 text-right text-sm font-semibold">Qtd.</th>
              <th className="w-28 px-3 py-2 text-right text-sm font-semibold">Ref. edital</th>
              <th className="w-40 px-3 py-2 text-right text-sm font-semibold">Cotação internet</th>
              <th className="w-32 px-3 py-2 text-right text-sm font-semibold">Preço unit. (R$)</th>
              <th className="w-32 px-3 py-2 text-right text-sm font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((it) => {
              const unit = parsePreco(precos[it.id] || '');
              const cot = cotacao.cotacoes[it.id];
              return (
                <Fragment key={it.id}>
                <tr className="border-b border-border hover:bg-muted/50">
                  <td className="px-3 py-2 text-muted-foreground tabular-nums">{it.numero}</td>
                  <td className="px-3 py-2">
                    {it.descricao}
                    <Badge variant="muted" className="ml-2">{it.unidade}</Badge>
                    {it.marca && (
                      <span className="ml-2 text-muted-foreground">
                        Marca: <span className="font-medium text-foreground">{it.marca}</span>
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{it.quantidade?.toLocaleString('pt-BR')}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">
                    {it.valor_unitario > 0 ? brl(it.valor_unitario) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {cot?.status === 'cotando' && <Loader2 className="inline w-4 h-4 animate-spin text-muted-foreground" aria-hidden="true" />}
                    {cot?.status === 'erro' && <span className="text-sm text-muted-foreground">sem resultado</span>}
                    {cot?.status === 'cotado' && (
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-sm tabular-nums"
                        title="Ver fontes e aplicar preço"
                        onClick={() => setFontesAbertas(fontesAbertas === it.id ? null : it.id)}
                      >
                        {cot.pncpMediana
                          ? <>PNCP {brl(cot.pncpMediana)} · {brl(cot.menorPreco)}–{brl(cot.precoMedio)}</>
                          : <>{brl(cot.menorPreco)} – {brl(cot.precoMedio)}</>}
                      </Button>
                    )}
                    {!cot && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => cotarItens(licitacaoId, [it], opcoesCotacao)}
                        disabled={cotacao.rodando}
                      >
                        <Search className="w-4 h-4" aria-hidden="true" /> cotar
                      </Button>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={precos[it.id] ?? ''}
                      onChange={(e) => setPrecos((p) => ({ ...p, [it.id]: e.target.value }))}
                      placeholder="0,00"
                      aria-label={`Preço unitário do item ${it.numero}`}
                      className="text-right tabular-nums"
                    />
                  </td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">
                    {unit > 0 ? brl(unit * (it.quantidade || 1)) : '—'}
                  </td>
                </tr>
                {cot?.status === 'cotado' && fontesAbertas === it.id && (
                  <tr className="border-b border-border bg-muted/50">
                    <td />
                    <td colSpan={6} className="px-3 py-3">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">Fontes da cotação</span>
                        {cot.marcaSugerida && (
                          <span className="text-sm text-muted-foreground">
                            Sugestão de marca: <span className="font-medium text-foreground">{cot.marcaSugerida}</span>
                            {it.marca !== cot.marcaSugerida && (
                              <Button
                                type="button"
                                variant="link"
                                size="sm"
                                className="ml-2 h-auto p-0 text-sm"
                                onClick={() => aplicarMarca(it.id, cot.marcaSugerida!)}
                              >
                                aplicar
                              </Button>
                            )}
                          </span>
                        )}
                        {cot.pncpMediana != null && (
                          <Button size="sm" variant="outline" onClick={() => aplicarPreco(it.id, cot.pncpMediana!)}>
                            Usar mediana PNCP ({brl(cot.pncpMediana)})
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => aplicarPreco(it.id, cot.menorPreco)}>
                          Usar menor ({brl(cot.menorPreco)})
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => aplicarPreco(it.id, cot.precoMedio)}>
                          Usar médio ({brl(cot.precoMedio)})
                        </Button>
                      </div>
                      {/* O que foi comparado tem de estar à vista: a busca usa
                          um recorte curto da descrição, não as especificações —
                          sem dizer isso, cotação de cadeira genérica parecia
                          prova de sobrepreço da especificada. */}
                      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <span>Termo pesquisado:</span>
                        {editandoTermo === it.id ? (
                          <>
                            <Input
                              value={termoDraft}
                              onChange={(e) => setTermoDraft(e.target.value)}
                              className="w-80"
                              maxLength={120}
                              aria-label="Termo pesquisado na cotação"
                            />
                            <Button size="sm" variant="outline"
                              onClick={() => {
                                setEditandoTermo(null);
                                cotarItens(licitacaoId, [it], { ...opcoesCotacao, termos: { [it.id]: termoDraft }, forcar: [it.id] });
                              }}>
                              Recotar
                            </Button>
                            <Button type="button" variant="ghost" size="sm"
                              onClick={() => setEditandoTermo(null)}>cancelar</Button>
                          </>
                        ) : (
                          <>
                            <span className="text-foreground">«{cot.termoUsado || '—'}»</span>
                            <Button type="button" variant="link" size="sm" className="h-auto p-0 text-sm"
                              onClick={() => { setEditandoTermo(it.id); setTermoDraft(cot.termoUsado || it.descricao.slice(0, 80)); }}>
                              editar e recotar
                            </Button>
                          </>
                        )}
                        <span className="text-xs">
                          As especificações completas não entram na busca — confira a equivalência técnica nos links antes de usar um preço.
                        </span>
                      </div>
                      {cot.pncpVazio && !cot.fornecedores.some((f) => f.origem === 'pncp') && (
                        <p className="mb-2 text-sm text-muted-foreground">
                          Painel Gov.br (PNCP): nenhuma ATA ou contrato encontrado para este termo nos últimos 3 anos.
                        </p>
                      )}
                      {cot.fornecedores.some((f) => f.origem === 'pncp') && (
                        <div className="mb-2">
                          <p className="mb-1 text-sm font-medium text-muted-foreground">
                            {cot.pncpApenasEstimados
                              ? 'Referências no PNCP — apenas ESTIMATIVAS de outros editais (nenhum preço homologado para este termo)'
                              : `Homologados no PNCP (ATAs/contratos${cot.pncpRegistros ? ` · ${cot.pncpRegistros} registros` : ''})`}
                          </p>
                          <div className="space-y-1">
                            {cot.fornecedores.filter((f) => f.origem === 'pncp').map((f, fi) => (
                              <div key={fi} className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span className="shrink-0 font-medium text-foreground tabular-nums">{brl(f.preco)}</span>
                                {f.situacao && <Badge variant="muted" className="shrink-0">{f.situacao}</Badge>}
                                <span className="truncate">{f.orgao || f.titulo}</span>
                                {f.fornecedor && <span className="truncate">· venceu: {f.fornecedor}</span>}
                                {f.situacao === 'Homologado' && (
                                  <span className="shrink-0">· marca: {f.marca || 'não informada pelo órgão'}</span>
                                )}
                                {f.data && <span className="shrink-0">{f.data.split('-').reverse().join('/')}</span>}
                                {f.url && (
                                  <a href={f.url} target="_blank" rel="noreferrer" aria-label="Abrir a fonte no PNCP" className="shrink-0 text-primary hover:underline">
                                    <ExternalLink className="inline w-4 h-4" aria-hidden="true" />
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {cot.fornecedores.some((f) => f.origem === 'internet') && (
                        <div>
                          <p className="mb-1 text-sm font-medium text-muted-foreground">Mercado (internet)</p>
                          <div className="space-y-1">
                            {cot.fornecedores.filter((f) => f.origem === 'internet').map((f, fi) => (
                              <div key={fi} className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span className="shrink-0 font-medium text-foreground tabular-nums">{brl(f.preco)}</span>
                                <span className="shrink-0">{f.loja}</span>
                                <span className="truncate">{f.titulo}</span>
                                {f.url && (
                                  <a href={f.url} target="_blank" rel="noreferrer" aria-label="Abrir a oferta na loja" className="shrink-0 text-primary hover:underline">
                                    <ExternalLink className="inline w-4 h-4" aria-hidden="true" />
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={salvar} disabled={salvando}>
          {salvando
            ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            : <Save className="w-4 h-4" aria-hidden="true" />}
          Salvar precificação
        </Button>
        {onIrParaProposta && (
          <Button variant="outline" onClick={onIrParaProposta}>
            Levar para a Proposta <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Button>
        )}
        <span className="ml-auto text-base">
          <span className="text-muted-foreground">Total proposto:</span>{' '}
          <span className="font-semibold tabular-nums">{brl(totalProposto)}</span>
        </span>
      </div>
    </Card>

    {objetoProcesso && objetoProcesso.trim().length >= 8 && (
      <HistoricoDoOrgao cnpjInicial={pncpCoords?.cnpj ?? null} objeto={objetoProcesso} />
    )}
    </div>
  );
}
