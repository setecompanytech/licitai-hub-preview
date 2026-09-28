import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SeloSituacao from '@/components/gestao/SeloSituacao';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Search, Loader2, ExternalLink, ChevronLeft, ChevronRight, BookmarkPlus, BookmarkCheck, HelpCircle, FileText } from 'lucide-react';
import {
  COLEGIADOS, FILTROS_TCU_INICIAIS, NOME_DA_ORDEM, OPERADORES_TCU, POR_PAGINA_TCU, corpoDaPesquisa, identificadorDoResumo, pesquisaTcuValida, resumoDaPagina, segmentosDoFragmento,
  type AcordaoDaTela, type FiltrosTcuTela, type OrdemTcu, type RespostaDaTela,
} from '@/lib/juridico/pesquisa-tcu';

/**
 * Pesquisa ao vivo no TCU (27/09/2026) — a Pesquisa Integrada do portal,
 * dentro do sistema: termo com operadores, número, ano, colegiado, relator,
 * processo, órgão, data da sessão; facetas por tipo, colegiado, relator e
 * ano; três ordens; 20 por página com o total; o trecho com a palavra
 * marcada; PDF e documento oficiais; e "Guardar na base", que traz o acórdão
 * inteiro para a base normativa — a partir daí a redação pode citá-lo.
 */
type Invocador = { functions: { invoke: (fn: string, o: { body: unknown }) => PromiseLike<{ data: unknown; error: { message: string } | null }> } };
const fx = supabase as unknown as Invocador;

export default function PesquisaTcu({ termoInicial = '' }: { termoInicial?: string }) {
  const [f, setF] = useState<FiltrosTcuTela>({ ...FILTROS_TCU_INICIAIS, termo: termoInicial });
  const [buscando, setBuscando] = useState(false);
  const [resposta, setResposta] = useState<RespostaDaTela | null>(null);
  const [ultima, setUltima] = useState<FiltrosTcuTela | null>(null);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [guardados, setGuardados] = useState<Set<string>>(new Set());
  const [ajuda, setAjuda] = useState(false);

  const pesquisar = async (filtros: FiltrosTcuTela = f) => {
    const erro = pesquisaTcuValida(filtros);
    if (erro) { toast.error(erro); return; }
    setBuscando(true);
    try {
      const { data, error } = await fx.functions.invoke('tcu-pesquisa', { body: corpoDaPesquisa(filtros) });
      if (error) throw new Error(error.message);
      const r = data as RespostaDaTela & { error?: string };
      if (r?.error) throw new Error(r.error);
      setResposta(r);
      setUltima(filtros);
      setGuardados(new Set(r.na_base ?? []));
    } catch (e) {
      toast.error('Não foi possível pesquisar no TCU', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBuscando(false);
    }
  };
  const mudar = (parte: Partial<FiltrosTcuTela>) => setF((atual) => ({ ...atual, ...parte, pagina: 1 }));
  const aplicar = (parte: Partial<FiltrosTcuTela>) => { const n = { ...f, ...parte, pagina: 1 }; setF(n); void pesquisar(n); };
  const irPara = (pagina: number) => { const n = { ...f, pagina }; setF(n); void pesquisar(n); };
  const alternar = (lista: string[], valor: string) => (lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor]);

  const guardar = async (d: AcordaoDaTela) => {
    setGuardando(d.key);
    try {
      const { data, error } = await fx.functions.invoke('tcu-pesquisa', { body: { acao: 'guardar', key: d.key } });
      if (error) throw new Error(error.message);
      const r = data as { ok?: boolean; identificador?: string; situacao?: 'novo' | 'atualizado' | 'igual'; error?: string };
      if (!r?.ok) throw new Error(r?.error ?? 'falha ao guardar');
      setGuardados((s) => new Set([...s, r.identificador ?? identificadorDoResumo(d)]));
      toast.success(r.situacao === 'igual' ? `${r.identificador} já estava na base` : r.situacao === 'atualizado' ? `${r.identificador}: texto completo atualizado na base` : `${r.identificador} guardado na base`, { description: 'A redação já pode citá-lo pelo identificador.' });
    } catch (e) {
      toast.error('Não foi possível guardar', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setGuardando(null);
    }
  };

  const total = resposta?.total ?? 0;
  const facetaBotoes = (titulo: string, itens: Array<{ valor: string; quantidade: number }>, ativo: (v: string) => boolean, aoClicar: (v: string) => void, limite = 8) => (
    itens.length > 0 && (
      <div className="space-y-1">
        <p className="g-meta font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</p>
        <ul className="space-y-0.5">
          {itens.slice(0, limite).map((i) => (
            <li key={i.valor}>
              <button type="button" onClick={() => aoClicar(i.valor)} aria-pressed={ativo(i.valor)} className={`flex w-full items-center justify-between gap-2 rounded px-1.5 py-0.5 text-left text-sm hover:bg-muted ${ativo(i.valor) ? 'bg-muted font-semibold text-foreground' : 'text-foreground'}`}>
                <span className="truncate">{i.valor}</span>
                <span className="g-meta shrink-0 tabular-nums text-muted-foreground">{i.quantidade.toLocaleString('pt-BR')}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    )
  );

  return (
    <div className="space-y-4" data-testid="pesquisa-tcu">
      <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="tcu-termo">Termo</Label>
            <button type="button" className="g-meta inline-flex items-center gap-1 text-primary hover:underline" onClick={() => setAjuda((v) => !v)} aria-expanded={ajuda}><HelpCircle className="h-3 w-3" aria-hidden="true" /> operadores</button>
          </div>
          <Input id="tcu-termo" placeholder='ex.: "atestado de capacidade técnica" adj quantitativo' value={f.termo} onChange={(e) => mudar({ termo: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') void pesquisar(); }} />
          {ajuda && (
            <ul className="grid gap-x-4 gap-y-0.5 rounded-md border border-border bg-muted/40 p-2 sm:grid-cols-2" data-testid="ajuda-operadores">
              {OPERADORES_TCU.map((o) => <li key={o.operador} className="g-meta text-muted-foreground"><code className="text-foreground">{o.exemplo}</code> — {o.significado}</li>)}
            </ul>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tcu-ordem">Ordenar por</Label>
          <Select value={f.ordem} onValueChange={(v) => mudar({ ordem: v as OrdemTcu })}>
            <SelectTrigger id="tcu-ordem"><SelectValue /></SelectTrigger>
            <SelectContent>{(Object.keys(NOME_DA_ORDEM) as OrdemTcu[]).map((o) => <SelectItem key={o} value={o}>{NOME_DA_ORDEM[o]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5"><Label htmlFor="tcu-numero">Número</Label><Input id="tcu-numero" inputMode="numeric" placeholder="ex.: 2991" value={f.numero} onChange={(e) => mudar({ numero: e.target.value })} /></div>
        <div className="space-y-1.5"><Label htmlFor="tcu-ano">Ano</Label><Input id="tcu-ano" inputMode="numeric" placeholder="ex.: 2025" value={f.ano} onChange={(e) => mudar({ ano: e.target.value })} /></div>
        <div className="space-y-1.5"><Label htmlFor="tcu-relator">Relator</Label><Input id="tcu-relator" placeholder="ex.: Benjamin Zymler" value={f.relator} onChange={(e) => mudar({ relator: e.target.value })} /></div>
        <div className="space-y-1.5"><Label htmlFor="tcu-processo">Processo (TC)</Label><Input id="tcu-processo" placeholder="ex.: 021.706/2025-5" value={f.processo} onChange={(e) => mudar({ processo: e.target.value })} /></div>
        <div className="space-y-1.5"><Label htmlFor="tcu-entidade">Órgão / entidade</Label><Input id="tcu-entidade" placeholder="ex.: Prefeitura Municipal de Barcarena" value={f.entidade} onChange={(e) => mudar({ entidade: e.target.value })} /></div>
        <div className="space-y-1.5"><Label htmlFor="tcu-de">Sessão de</Label><Input id="tcu-de" type="date" value={f.dataDe} onChange={(e) => mudar({ dataDe: e.target.value })} /></div>
        <div className="space-y-1.5"><Label htmlFor="tcu-ate">até</Label><Input id="tcu-ate" type="date" value={f.dataAte} onChange={(e) => mudar({ dataAte: e.target.value })} /></div>
        <div className="space-y-1.5">
          <Label>Colegiado</Label>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Colegiado">
            {COLEGIADOS.map((c) => <Button key={c} type="button" size="sm" variant={f.colegiado.includes(c) ? 'default' : 'outline'} aria-pressed={f.colegiado.includes(c)} onClick={() => mudar({ colegiado: alternar(f.colegiado, c) })}>{c.replace('Primeira', '1ª').replace('Segunda', '2ª')}</Button>)}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => pesquisar()} disabled={buscando}>{buscando ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Search aria-hidden="true" />} Pesquisar no TCU</Button>
        <Button variant="ghost" size="sm" onClick={() => { setF({ ...FILTROS_TCU_INICIAIS }); setResposta(null); setUltima(null); }}>Limpar</Button>
        <p className="g-meta text-muted-foreground">Consulta ao vivo à Pesquisa Integrada do TCU, sem IA. O que você guardar passa a valer como fonte para a redação.</p>
      </div>

      {resposta && ultima && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_14rem]">
          <div className="space-y-2" data-testid="resultado-tcu">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-foreground"><b>{resumoDaPagina(total, ultima.pagina)}</b>{ultima.termo.trim() ? ` para "${ultima.termo.trim()}"` : ''}</p>
              {resposta.alerta && <SeloSituacao tom="atencao">{resposta.alerta}</SeloSituacao>}
            </div>
            {resposta.sugestao && total === 0 && (
              <p className="text-sm text-muted-foreground">Você quis dizer <button type="button" className="text-primary hover:underline" onClick={() => aplicar({ termo: resposta.sugestao ?? '' })}>{resposta.sugestao}</button>?</p>
            )}
            {total === 0 ? (
              <p className="text-sm text-muted-foreground">O TCU não devolveu acórdão com estes critérios. Tente menos filtros, o radical com $ (ex.: reajust$) ou sinônimos com "ou".</p>
            ) : (
              <ul className="divide-y divide-border">
                {resposta.documentos.map((d) => {
                  const ident = identificadorDoResumo(d);
                  const naBase = guardados.has(ident);
                  const soSumario = !naBase && resposta.so_sumario.includes(ident);
                  return (
                    <li key={d.key} className="space-y-1 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{ident}</p>
                        {d.tipo !== 'ACÓRDÃO' && <SeloSituacao tom="neutro">{d.tipo.toLowerCase()}</SeloSituacao>}
                        {naBase && <SeloSituacao tom="sucesso">na base</SeloSituacao>}
                        {soSumario && <SeloSituacao tom="neutro">só o sumário na base</SeloSituacao>}
                      </div>
                      <p className="g-meta text-muted-foreground">
                        {[d.relator ? `Relator: ${d.relator}` : null, d.data_sessao_br ? `Sessão de ${d.data_sessao_br}` : null, d.numero_ata ? `Ata ${d.numero_ata}` : null, d.processo ? `TC ${d.processo}` : null, d.situacao?.toLowerCase() ?? null].filter(Boolean).join(' · ')}
                      </p>
                      {d.fragmentos.map((fr, i) => (
                        <p key={i} className="text-sm text-muted-foreground">
                          {segmentosDoFragmento(fr).map((s, j) => (s.destaque ? <mark key={j} className="rounded bg-warning-soft px-0.5 text-foreground">{s.texto}</mark> : <span key={j}>{s.texto}</span>))}
                        </p>
                      ))}
                      <div className="flex flex-wrap items-center gap-3">
                        <a href={d.url_portal} target="_blank" rel="noreferrer" className="g-meta inline-flex items-center gap-1 text-primary hover:underline">no portal do TCU <ExternalLink className="h-3 w-3" aria-hidden="true" /></a>
                        {d.url_pdf && <a href={d.url_pdf} target="_blank" rel="noreferrer" className="g-meta inline-flex items-center gap-1 text-primary hover:underline"><FileText className="h-3 w-3" aria-hidden="true" /> PDF</a>}
                        {d.url_doc && <a href={d.url_doc} target="_blank" rel="noreferrer" className="g-meta inline-flex items-center gap-1 text-primary hover:underline">documento editável</a>}
                        <Button size="sm" variant={naBase ? 'ghost' : 'outline'} className="h-7" disabled={guardando === d.key || naBase} onClick={() => guardar(d)} title={naBase ? 'Já está na base normativa' : 'Traz o acórdão inteiro para a base normativa; a redação passa a poder citá-lo'}>
                          {guardando === d.key ? <Loader2 className="animate-spin" aria-hidden="true" /> : naBase ? <BookmarkCheck aria-hidden="true" /> : <BookmarkPlus aria-hidden="true" />}
                          {naBase ? 'Na base' : soSumario ? 'Guardar o texto completo' : 'Guardar na base'}
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {total > POR_PAGINA_TCU && (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" disabled={ultima.pagina <= 1 || buscando} onClick={() => irPara(ultima.pagina - 1)}><ChevronLeft aria-hidden="true" /> Anterior</Button>
                <Button size="sm" variant="outline" disabled={ultima.pagina * POR_PAGINA_TCU >= total || buscando} onClick={() => irPara(ultima.pagina + 1)}>Próxima <ChevronRight aria-hidden="true" /></Button>
              </div>
            )}
          </div>
          <aside className="space-y-3 lg:border-l lg:border-border lg:pl-4" data-testid="facetas-tcu" aria-label="Refinar">
            {facetaBotoes('Tipo', resposta.facetas.tipo, (v) => f.tipo.includes(v), (v) => aplicar({ tipo: alternar(f.tipo, v) }))}
            {facetaBotoes('Colegiado', resposta.facetas.colegiado, (v) => f.colegiado.includes(v), (v) => aplicar({ colegiado: alternar(f.colegiado, v) }))}
            {facetaBotoes('Relator', resposta.facetas.relator, (v) => f.relator.toUpperCase() === v.toUpperCase(), (v) => aplicar({ relator: f.relator.toUpperCase() === v.toUpperCase() ? '' : v }), 10)}
            {facetaBotoes('Ano', resposta.facetas.ano, (v) => f.ano === v, (v) => aplicar({ ano: f.ano === v ? '' : v }), 10)}
          </aside>
        </div>
      )}
    </div>
  );
}
