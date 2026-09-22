import { useState } from 'react';
import { AlertTriangle, ExternalLink, Loader2, Search } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import EstadoVazio from '@/components/shared/EstadoVazio';
import TextoRecolhido from '@/components/shared/TextoRecolhido';
import FaixaIndicadores from '@/components/gestao/FaixaIndicadores';
import EtiquetaDoValor from '@/components/analise-mercado/EtiquetaDoValor';
import NotasFiscaisFederais from '@/components/analise-mercado/NotasFiscaisFederais';
import PrecoUnitarioDoAcervo from '@/components/analise-mercado/PrecoUnitarioDoAcervo';
import { useItensDoAcervo } from '@/hooks/useItensDoAcervo';
import { supabase } from '@/integrations/supabase/client';
import {
  MODOS_DE_BUSCA, MODO_PADRAO, descricaoDaTentativa, ehModoDeBusca, proximosPassos, rotuloDoProvedor,
  type ModoDeBusca, type TentativaDeBusca,
} from '@/lib/mercado/busca-por-objeto';
import {
  FILTRO_PADRAO, filtrarItens, itensPorEdital, unidadeLegivel, type EditalDoAcervo, type FiltroDeItens,
} from '@/lib/mercado/preco-observado';
import { nomeDeOrgaoLegivel } from '@/lib/texto/nome-de-orgao';

/**
 * Preço de referência por objeto — a fonte única (22/09/2026, tarde).
 *
 * Vivia na aba Preços da Análise de mercado, enquanto a Precificação tinha a
 * aba "Preços gov" com a mesma pergunta ("quanto o governo paga por isto?")
 * respondida por outro caminho. O dono pediu uma função só. Ela mora aqui,
 * na Precificação, onde o preço de referência é insumo; a Análise de mercado
 * aponta para cá.
 *
 * Dois blocos que nunca se misturam: o valor GLOBAL do edital (o processo
 * inteiro) e o preço UNITÁRIO do item, lido nos itens do PNCP com cache —
 * por padrão só o homologado, dos três últimos anos. Embaixo, as NF-e ao
 * governo federal, item a item. Todo valor leva a etiqueta natureza · estágio.
 */
const UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'];

/** O edital como a busca por objeto devolve: o global do processo mais as coordenadas que os itens pedem. */
type EditalDaBusca = EditalDoAcervo & {
  id: string; objeto: string | null; uf: string | null; municipio: string | null;
  valor_total_estimado: number | null; similaridade?: number;
};

const brlExato = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function PrecoDeReferencia({
  termoInicial = '',
  ufInicial,
  municipioInicial = '',
}: {
  termoInicial?: string;
  /** UF de partida; sem ela, o acervo completo (PA desde 2023). */
  ufInicial?: string;
  municipioInicial?: string;
}) {
  const [termo, setTermo] = useState(termoInicial);
  const [uf, setUf] = useState(ufInicial && UFS.includes(ufInicial) ? ufInicial : 'PA');
  const [municipio, setMunicipio] = useState(municipioInicial);
  const [periodo, setPeriodo] = useState('36m');
  const [modo, setModo] = useState<ModoDeBusca>(MODO_PADRAO);
  const [tentativa, setTentativa] = useState<(TentativaDeBusca & { provedor: string }) | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [buscou, setBuscou] = useState(false);
  const [erro, setErro] = useState('');
  const [editais, setEditais] = useState<EditalDaBusca[]>([]);
  // O objeto da ÚLTIMA busca feita, não o do campo: os itens do PNCP se casam
  // com o que foi pesquisado, e o campo muda enquanto se digita.
  const [termoBuscado, setTermoBuscado] = useState('');
  const [filtro, setFiltro] = useState<FiltroDeItens>(FILTRO_PADRAO);

  const itensDoAcervo = useItensDoAcervo(termoBuscado, editais);
  const itensDoEdital = itensPorEdital(filtrarItens(itensDoAcervo.itens, filtro));

  const buscar = async (opcoes?: { modo?: ModoDeBusca; uf?: string }) => {
    if (termo.trim().length < 8) {
      setErro('Descreva o objeto com pelo menos 8 caracteres (ex.: "carne bovina congelada").');
      setBuscou(true);
      return;
    }
    const modoEscolhido = opcoes?.modo ?? modo;
    const ufEscolhida = opcoes?.uf ?? uf;
    if (opcoes?.modo) setModo(opcoes.modo);
    if (opcoes?.uf) setUf(opcoes.uf);
    setBuscando(true);
    setErro('');
    try {
      const ufEfetiva = ufEscolhida === 'todas' ? null : ufEscolhida;
      const anoExato = /^\d{4}$/.test(periodo) ? Number(periodo) : null;
      const anos = Math.max(anoExato ? 3 : Number(periodo.replace('m', '')) / 12, 1);
      const { data, error } = await supabase.functions.invoke('historico-orgao-pncp', {
        body: {
          objeto: termo.trim(),
          anos,
          limite: 30,
          uf: ufEfetiva ?? undefined,
          municipio: municipio.trim() || undefined,
          anoExato: anoExato ?? undefined,
          modo: modoEscolhido,
        },
      });
      if (error || data?.error) {
        setErro(String(data?.error || 'Não foi possível consultar o acervo.'));
        setEditais([]);
      } else {
        setEditais(data?.resultados ?? []);
        setTermoBuscado(termo.trim());
        setTentativa({
          modo: modoEscolhido, provedor: String(data?.provedor ?? ''), uf: ufEfetiva,
          municipio: municipio.trim() || null, anos, anoExato,
        });
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro na consulta.');
      setEditais([]);
    } finally {
      setBuscando(false);
      setBuscou(true);
    }
  };

  // Estatística honesta da amostra: mediana e quartis resistem ao megaedital
  // que arrasta a média; a faixa mostra a dispersão real.
  const valores = editais
    .map((e) => Number(e.valor_total_estimado))
    .filter((v) => Number.isFinite(v) && v > 0 && v < 1e10)
    .sort((a, b) => a - b);
  const quantil = (p: number) => {
    if (valores.length === 0) return null;
    const i = (valores.length - 1) * p;
    const lo = Math.floor(i);
    const hi = Math.ceil(i);
    return valores[lo] + (valores[hi] - valores[lo]) * (i - lo);
  };

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h2 className="text-lg font-semibold leading-6 text-foreground">Preço de referência por objeto</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Digite o objeto que você fornece. A busca cruza as palavras com a descrição dos editais do acervo PNCP e
          ordena os mais parecidos primeiro (até 30 editais); cada edital é aberto item a item para o preço unitário.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-md">
            <Label htmlFor="referencia-objeto">Objeto</Label>
            <Input id="referencia-objeto" placeholder="Ex.: carne bovina congelada, notebook, material de expediente"
              value={termo} onChange={(e) => setTermo(e.target.value)}
              aria-invalid={erro ? true : undefined}
              onKeyDown={(e) => { if (e.key === 'Enter') buscar(); }} />
          </div>
          <Button onClick={() => buscar()} disabled={buscando}>
            {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Buscar
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="referencia-uf">UF</Label>
            <Select value={uf} onValueChange={setUf}>
              <SelectTrigger id="referencia-uf" className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-80">
                <SelectItem value="todas">Todas as UFs</SelectItem>
                {UFS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="referencia-municipio">Município</Label>
            <Input id="referencia-municipio" placeholder="Opcional" value={municipio}
              onChange={(e) => setMunicipio(e.target.value)} className="w-48" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="referencia-periodo">Período</Label>
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger id="referencia-periodo" className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="36m">Últimos 3 anos (padrão)</SelectItem>
                {[0, 1, 2].map((i) => {
                  const a = new Date().getFullYear() - i;
                  return <SelectItem key={a} value={String(a)}>Ano de {a}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="referencia-modo">Como comparar</Label>
            <Select value={modo} onValueChange={(v) => { if (ehModoDeBusca(v)) setModo(v); }}>
              <SelectTrigger id="referencia-modo" className="w-80 max-w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MODOS_DE_BUSCA.map((m) => (
                  <SelectItem key={m.valor} value={m.valor} title={m.explicacao}>{m.rotulo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {erro && (
          <Alert variant="destructive" className="mt-4">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <AlertDescription>{erro}</AlertDescription>
          </Alert>
        )}
      </Card>

      {buscou && !buscando && !erro && editais.length === 0 && (
        <Card>
          <EstadoVazio
            icone={<Search />}
            titulo="Nenhum edital com esse objeto no acervo"
            descricao={tentativa
              ? `Tentei ${descricaoDaTentativa(tentativa)}. O acervo cresce a cada busca e pela semeadura; ausência aqui não prova inexistência no PNCP.`
              : 'O acervo cresce a cada busca e pela semeadura; ausência aqui não prova inexistência no PNCP.'}
            acao={tentativa && (
              <div className="flex flex-wrap justify-center gap-2">
                {proximosPassos(tentativa.modo, tentativa.uf).map((p) => (
                  <Button key={p.rotulo} variant="outline" size="sm" onClick={() => buscar({ modo: p.modo, uf: p.uf })}>
                    {p.rotulo}
                  </Button>
                ))}
              </div>
            )}
          />
        </Card>
      )}

      {editais.length > 0 && (
        <>
          {valores.length > 0 && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold leading-6 text-foreground">Valor global do processo — o edital inteiro (PNCP)</h2>
                <EtiquetaDoValor natureza="global" estagio="estimado" />
              </div>
              {/* Faixas numa linha só, como texto: o cartão KPI encolhe a fonte
                  para caber (`--chars`) em vez de partir o valor em duas. */}
              <FaixaIndicadores
                itens={[
                  { rotulo: 'Mediana do valor global', valor: brlExato(quantil(0.5)), detalhe: 'total estimado do edital, todos os itens juntos' },
                  { rotulo: 'Miolo (Q1–Q3)', valor: `${brlExato(quantil(0.25))} a ${brlExato(quantil(0.75))}`, detalhe: 'metade central da amostra' },
                  { rotulo: 'Faixa completa', valor: `${brlExato(valores[0])} a ${brlExato(valores[valores.length - 1])}`, detalhe: 'do menor ao maior edital' },
                  { rotulo: 'Amostra', valor: valores.length, detalhe: `editais com valor global, de ${editais.length} encontrados` },
                ]}
              />
            </>
          )}

          <PrecoUnitarioDoAcervo termo={termoBuscado} estado={itensDoAcervo} filtro={filtro} aoMudarFiltro={setFiltro} />

          <Card className="p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold leading-6 text-foreground">Editais que sustentam o número</h2>
              <EtiquetaDoValor natureza="global" estagio="estimado" />
            </div>
            <ul className="max-h-[480px] divide-y divide-border overflow-y-auto rounded-md border border-border">
              {editais.map((e) => {
                const itens = itensDoEdital.get(e.pncp_id) ?? [];
                return (
                  <li key={e.id} className="px-4 py-3 text-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 grow">
                        <TextoRecolhido texto={e.objeto} className="font-medium text-foreground" />
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {[nomeDeOrgaoLegivel(e.orgao), e.municipio && e.uf ? `${e.municipio}/${e.uf}` : e.uf,
                            e.data_publicacao_pncp ? new Date(e.data_publicacao_pncp.slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR') : null,
                          ].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <div className="w-40 shrink-0 space-y-1 text-right">
                        <p className="whitespace-nowrap font-semibold tabular-nums text-foreground">{brlExato(e.valor_total_estimado)}</p>
                        <p className="text-[0.6875rem] leading-4 text-muted-foreground">global · estimado</p>
                        {typeof e.similaridade === 'number' && (
                          <Badge variant="muted">{Math.round(e.similaridade * 100)}% similar</Badge>
                        )}
                        {e.url_pncp && (
                          <a href={e.url_pncp} target="_blank" rel="noreferrer"
                            className="flex items-center justify-end gap-1 text-xs text-primary hover:underline">
                            PNCP <ExternalLink className="h-3 w-3" aria-hidden="true" />
                          </a>
                        )}
                      </div>
                    </div>
                    {/* Os itens deste edital que ficaram no recorte: o unitário, embaixo do global. */}
                    {itens.length > 0 && (
                      <ul className="mt-2 space-y-1.5 border-l-2 border-primary-line pl-3 text-xs">
                        {itens.slice(0, 4).map((i) => (
                          <li key={i.numeroItem} className="grid grid-cols-1 gap-x-3 gap-y-0.5 sm:grid-cols-[minmax(0,1fr)_auto]">
                            <span className="min-w-0 leading-5">
                              <span className="text-muted-foreground">Item {i.numeroItem} · </span>
                              <TextoRecolhido texto={i.descricao} linhas={1} limiar={90} className="inline" />
                            </span>
                            <span className="whitespace-nowrap text-right tabular-nums leading-5">
                              <span className="text-muted-foreground">{i.quantidade === null ? '—' : i.quantidade.toLocaleString('pt-BR')} {unidadeLegivel(i.unidade) || i.unidade} · </span>
                              est. {brlExato(i.estimado)}
                              {i.homologado !== null && i.homologado > 0 && (
                                <span className="font-semibold text-success-ink"> · homologado {brlExato(i.homologado)}</span>
                              )}
                            </span>
                          </li>
                        ))}
                        {itens.length > 4 && <li className="text-muted-foreground">+ {itens.length - 4} item(ns) na tabela acima</li>}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
            {tentativa && (
              <p className="mt-3 text-xs text-muted-foreground">
                Busca por {descricaoDaTentativa(tentativa)}; ordem: {rotuloDoProvedor(tentativa.provedor)}.
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              O valor de cada edital é o GLOBAL estimado pelo órgão (todos os itens juntos). Embaixo dele, os itens do
              recorte, com o unitário estimado e o homologado; o bloco "Preço unitário do item" resume esses.
            </p>
          </Card>
        </>
      )}

      {/* Preço por ITEM nas notas fiscais ao governo federal: outra fonte, a mesma pergunta. */}
      <NotasFiscaisFederais termo={termo} />
    </div>
  );
}
