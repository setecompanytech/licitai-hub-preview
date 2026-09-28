import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SeloSituacao from '@/components/gestao/SeloSituacao';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Search, Loader2, ExternalLink, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, BookmarkPlus, BookmarkCheck, HelpCircle, FileText, SlidersHorizontal, X, Copy, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import {
  COLEGIADOS, EXEMPLOS_TCU, FILTROS_TCU_INICIAIS, NOME_DA_ORDEM, OPERADORES_TCU, POR_PAGINA_TCU, citacaoDoAcordao, corpoDaPesquisa, fichasAtivas, identificadorDoResumo, pesquisaTcuValida, resumoDaPagina, segmentosDoFragmento,
  type AcordaoDaTela, type Faceta, type FiltrosTcuTela, type OrdemTcu, type RespostaDaTela,
} from '@/lib/juridico/pesquisa-tcu';

/**
 * Pesquisa ao vivo no TCU (27/09/2026) — a Pesquisa Integrada do portal,
 * dentro do sistema. Uma linha para pesquisar (termo, ordem, botão); os
 * filtros ficam numa gaveta e viram fichas removíveis; o refinamento
 * (tipo, colegiado, ano, relator ativo/aposentado) fica à esquerda dos
 * resultados, como no portal; cada acórdão pode ser lido ali mesmo, ter a
 * citação copiada ou ser guardado na base — a partir daí a redação o cita.
 */
type Invocador = { functions: { invoke: (fn: string, o: { body: unknown }) => PromiseLike<{ data: unknown; error: { message: string } | null }> } };
const fx = supabase as unknown as Invocador;

type Leitura = { titulo: string; assunto: string; sumario: string; acordao: string; voto: string; voto_cortado: boolean; tipo_processo: string };

export default function PesquisaTcu({ termoInicial = '' }: { termoInicial?: string }) {
  const [f, setF] = useState<FiltrosTcuTela>({ ...FILTROS_TCU_INICIAIS, termo: termoInicial });
  const [buscando, setBuscando] = useState(false);
  const [resposta, setResposta] = useState<RespostaDaTela | null>(null);
  const [ultima, setUltima] = useState<FiltrosTcuTela | null>(null);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [guardados, setGuardados] = useState<Set<string>>(new Set());
  const [ajuda, setAjuda] = useState(false);
  const [gaveta, setGaveta] = useState(false);
  const [leituras, setLeituras] = useState<Record<string, Leitura | 'carregando' | undefined>>({});
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());
  const [paginaDigitada, setPaginaDigitada] = useState('');

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
      setAbertos(new Set());
      setPaginaDigitada('');
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
  const enviar = (e: FormEvent) => { e.preventDefault(); void pesquisar(); };
  const limparTudo = () => { setF({ ...FILTROS_TCU_INICIAIS }); setResposta(null); setUltima(null); setGaveta(false); };

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

  const ler = async (d: AcordaoDaTela) => {
    if (abertos.has(d.key)) { setAbertos((s) => { const n = new Set(s); n.delete(d.key); return n; }); return; }
    setAbertos((s) => new Set([...s, d.key]));
    if (leituras[d.key]) return;
    setLeituras((l) => ({ ...l, [d.key]: 'carregando' }));
    try {
      const { data, error } = await fx.functions.invoke('tcu-pesquisa', { body: { acao: 'ler', key: d.key } });
      if (error) throw new Error(error.message);
      const r = data as Leitura & { ok?: boolean; error?: string };
      if (!r?.ok) throw new Error(r?.error ?? 'falha ao ler');
      setLeituras((l) => ({ ...l, [d.key]: r }));
    } catch (e) {
      setLeituras((l) => ({ ...l, [d.key]: undefined }));
      setAbertos((s) => { const n = new Set(s); n.delete(d.key); return n; });
      toast.error('Não foi possível ler o acórdão', { description: e instanceof Error ? e.message : String(e) });
    }
  };

  const copiarCitacao = async (d: AcordaoDaTela) => {
    const texto = citacaoDoAcordao(d);
    try {
      await navigator.clipboard.writeText(texto);
      toast.success('Citação copiada', { description: texto });
    } catch {
      toast.info('Copie a citação', { description: texto });
    }
  };

  const fichas = fichasAtivas(f);
  const total = resposta?.total ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA_TCU));
  const paginaAtual = ultima?.pagina ?? 1;

  const grupoDeFacetas = (chave: string, titulo: string, itens: Faceta[], ativo: (v: string) => boolean, aoClicar: (v: string) => void, limite = 6) => {
    if (itens.length === 0) return null;
    const expandida = expandidas.has(chave);
    const mostrados = expandida ? itens : itens.slice(0, limite);
    let grupoAnterior: string | undefined;
    return (
      <div className="border-b border-border px-3 py-3 last:border-b-0" data-testid={`faceta-${chave}`}>
        <p className="g-meta mb-1 font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</p>
        <ul className="space-y-px">
          {mostrados.map((i) => {
            const cabecalho = i.grupo && i.grupo !== grupoAnterior ? i.grupo : null;
            grupoAnterior = i.grupo;
            return (
              <li key={`${i.grupo ?? ''}${i.valor}`}>
                {cabecalho && <p className="g-meta px-2 pb-0.5 pt-1.5 text-muted-foreground">{cabecalho}</p>}
                <button type="button" onClick={() => aoClicar(i.valor)} aria-pressed={ativo(i.valor)} className={`flex w-full items-center justify-between gap-2 rounded-md border-l-2 px-2 py-1 text-left text-sm hover:bg-muted ${ativo(i.valor) ? 'border-primary bg-primary-tint font-semibold text-foreground' : 'border-transparent text-foreground'}`}>
                  <span className="truncate">{i.valor}</span>
                  <span className="g-meta shrink-0 tabular-nums text-muted-foreground">{i.quantidade.toLocaleString('pt-BR')}</span>
                </button>
              </li>
            );
          })}
        </ul>
        {itens.length > limite && (
          <button type="button" className="g-meta mt-1 inline-flex items-center gap-1 px-2 text-primary hover:underline" onClick={() => setExpandidas((s) => { const n = new Set(s); if (expandida) n.delete(chave); else n.add(chave); return n; })}>
            {expandida ? <><ChevronUp className="h-3 w-3" aria-hidden="true" /> menos</> : <><ChevronDown className="h-3 w-3" aria-hidden="true" /> mais {itens.length - limite}</>}
          </button>
        )}
      </div>
    );
  };

  const campo = (id: string, rotulo: string, valor: string, parte: (v: string) => Partial<FiltrosTcuTela>, extra: Record<string, unknown> = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{rotulo}</Label>
      <Input id={id} value={valor} onChange={(e) => mudar(parte(e.target.value))} {...extra} />
    </div>
  );

  return (
    <div className="space-y-3" data-testid="pesquisa-tcu">
      <form onSubmit={enviar} className="space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-64 flex-1 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="tcu-termo">Termo</Label>
              <button type="button" className="g-meta inline-flex items-center gap-1 text-primary hover:underline" onClick={() => setAjuda((v) => !v)} aria-expanded={ajuda}><HelpCircle className="h-3 w-3" aria-hidden="true" /> operadores</button>
            </div>
            <Input id="tcu-termo" placeholder='ex.: "atestado de capacidade técnica" adj quantitativo' value={f.termo} onChange={(e) => mudar({ termo: e.target.value })} autoComplete="off" />
          </div>
          <div className="w-44 space-y-1.5">
            <Label htmlFor="tcu-ordem">Ordenar por</Label>
            <Select value={f.ordem} onValueChange={(v) => mudar({ ordem: v as OrdemTcu })}>
              <SelectTrigger id="tcu-ordem"><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.keys(NOME_DA_ORDEM) as OrdemTcu[]).map((o) => <SelectItem key={o} value={o}>{NOME_DA_ORDEM[o]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={buscando}>{buscando ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Search aria-hidden="true" />} Pesquisar no TCU</Button>
          <Button type="button" variant={gaveta || fichas.length ? 'secondary' : 'outline'} onClick={() => setGaveta((v) => !v)} aria-expanded={gaveta} aria-controls="tcu-filtros">
            <SlidersHorizontal aria-hidden="true" /> Filtros{fichas.length ? ` · ${fichas.length}` : ''}
          </Button>
        </div>
        {ajuda && (
          <ul className="grid gap-x-4 gap-y-0.5 rounded-md border border-border bg-muted/40 p-2 sm:grid-cols-2" data-testid="ajuda-operadores">
            {OPERADORES_TCU.map((o) => <li key={o.operador} className="g-meta text-muted-foreground"><code className="text-foreground">{o.exemplo}</code> — {o.significado}</li>)}
          </ul>
        )}
        {gaveta && (
          <div id="tcu-filtros" className="grid gap-3 rounded-md border border-border bg-muted/30 p-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="gaveta-filtros">
            {campo('tcu-numero', 'Número', f.numero, (numero) => ({ numero }), { inputMode: 'numeric', placeholder: 'ex.: 2991' })}
            {campo('tcu-ano', 'Ano', f.ano, (ano) => ({ ano }), { inputMode: 'numeric', placeholder: 'ex.: 2025' })}
            {campo('tcu-relator', 'Relator', f.relator, (relator) => ({ relator }), { placeholder: 'ex.: Benjamin Zymler' })}
            {campo('tcu-processo', 'Processo (TC)', f.processo, (processo) => ({ processo }), { placeholder: 'ex.: 021.706/2025-5' })}
            {campo('tcu-entidade', 'Órgão / entidade', f.entidade, (entidade) => ({ entidade }), { placeholder: 'ex.: Prefeitura Municipal de Barcarena' })}
            {campo('tcu-de', 'Sessão de', f.dataDe, (dataDe) => ({ dataDe }), { type: 'date' })}
            {campo('tcu-ate', 'até', f.dataAte, (dataAte) => ({ dataAte }), { type: 'date' })}
            <div className="space-y-1.5">
              <Label>Colegiado</Label>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Colegiado">
                {COLEGIADOS.map((c) => <Button key={c} type="button" size="sm" variant={f.colegiado.includes(c) ? 'default' : 'outline'} aria-pressed={f.colegiado.includes(c)} onClick={() => mudar({ colegiado: alternar(f.colegiado, c) })}>{c.replace('Primeira', '1ª').replace('Segunda', '2ª')}</Button>)}
              </div>
            </div>
          </div>
        )}
      </form>

      {fichas.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" data-testid="fichas-ativas" aria-label="Filtros em uso">
          {fichas.map((c) => (
            <button key={c.chave} type="button" onClick={() => aplicar(c.limpar)} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-foreground hover:bg-muted/70" title="Remover este filtro">
              {c.rotulo} <X className="h-3 w-3" aria-hidden="true" />
            </button>
          ))}
          <Button type="button" variant="ghost" size="sm" className="h-7" onClick={limparTudo}>Limpar tudo</Button>
        </div>
      )}

      {!resposta && !buscando && (
        <div className="rounded-md border border-dashed border-border p-4" data-testid="tcu-vazio">
          <p className="text-sm text-foreground">Pesquisa ao vivo na Pesquisa Integrada do TCU: todos os acórdãos, sem IA. Exemplos que mostram os operadores:</p>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {EXEMPLOS_TCU.map((e) => (
              <li key={e.termo}>
                <button type="button" className="text-left text-sm text-primary hover:underline" onClick={() => aplicar({ termo: e.termo })}>{e.termo}</button>
                <span className="g-meta block text-muted-foreground">{e.porque}</span>
              </li>
            ))}
          </ul>
          <p className="g-meta mt-2 text-muted-foreground">O que você guardar passa a valer como fonte para a redação, com número, ano, colegiado e texto integral.</p>
        </div>
      )}

      {resposta && ultima && (
        <div className={`grid overflow-hidden rounded-lg border border-border bg-card shadow-sm lg:grid-cols-[14rem_minmax(0,1fr)] ${buscando ? 'opacity-60' : ''}`} aria-busy={buscando}>
          <aside className="border-b border-border bg-secondary lg:border-b-0 lg:border-r" data-testid="facetas-tcu" aria-label="Refinar">
            <div className="lg:sticky lg:top-0">
              <p className="border-b border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Refinar</p>
            {grupoDeFacetas('tipo', 'Tipo', resposta.facetas.tipo, (v) => f.tipo.includes(v), (v) => aplicar({ tipo: alternar(f.tipo, v) }))}
            {grupoDeFacetas('colegiado', 'Colegiado', resposta.facetas.colegiado, (v) => f.colegiado.includes(v), (v) => aplicar({ colegiado: alternar(f.colegiado, v) }))}
            {grupoDeFacetas('ano', 'Ano', resposta.facetas.ano, (v) => f.ano === v, (v) => aplicar({ ano: f.ano === v ? '' : v }), 8)}
            {grupoDeFacetas('relator', 'Relator', resposta.facetas.relator, (v) => f.relator.toUpperCase() === v.toUpperCase(), (v) => aplicar({ relator: f.relator.toUpperCase() === v.toUpperCase() ? '' : v }), 8)}
              {resposta.facetas.tipo.length + resposta.facetas.colegiado.length + resposta.facetas.ano.length + resposta.facetas.relator.length === 0 && <p className="g-meta px-4 py-3 text-muted-foreground">Sem refinamentos para esta pesquisa.</p>}
            </div>
          </aside>

          <div className="min-w-0" data-testid="resultado-tcu">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-secondary px-4 py-2.5">
              <p className="text-sm text-foreground"><b>{resumoDaPagina(total, paginaAtual)}</b>{ultima.termo.trim() ? <> para <i>"{ultima.termo.trim()}"</i></> : ''}</p>
              {resposta.alerta && <SeloSituacao tom="atencao">{resposta.alerta}</SeloSituacao>}
            </div>
            {resposta.sugestao && total === 0 && (
              <p className="px-4 pt-3 text-sm text-muted-foreground">Você quis dizer <button type="button" className="text-primary hover:underline" onClick={() => aplicar({ termo: resposta.sugestao ?? '' })}>{resposta.sugestao}</button>?</p>
            )}
            {total === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">O TCU não devolveu acórdão com estes critérios. Tente menos filtros, o radical com $ (ex.: reajust$) ou sinônimos com "ou".</p>
            ) : (
              <ol className="divide-y divide-border" start={(paginaAtual - 1) * POR_PAGINA_TCU + 1}>
                {resposta.documentos.map((d) => {
                  const ident = identificadorDoResumo(d);
                  const naBase = guardados.has(ident);
                  const soSumario = !naBase && resposta.so_sumario.includes(ident);
                  const aberto = abertos.has(d.key);
                  const leitura = leituras[d.key];
                  return (
                    <li key={d.key} className="space-y-1.5 px-4 py-3 hover:bg-muted/40">
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
                      {aberto && (
                        <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3 text-sm" data-testid={`leitura-${d.key}`}>
                          {leitura === 'carregando' || !leitura ? (
                            <p className="inline-flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Lendo no portal…</p>
                          ) : (
                            <>
                              {leitura.assunto && <p className="text-muted-foreground"><b className="text-foreground">Assunto.</b> {leitura.assunto}</p>}
                              {leitura.sumario && <p className="whitespace-pre-wrap"><b>Sumário.</b> {leitura.sumario}</p>}
                              {leitura.acordao && <details open><summary className="cursor-pointer font-semibold">Acórdão (dispositivo)</summary><p className="mt-1 whitespace-pre-wrap text-muted-foreground">{leitura.acordao}</p></details>}
                              {leitura.voto && <details><summary className="cursor-pointer font-semibold">Voto{leitura.voto_cortado ? ' (início)' : ''}</summary><p className="mt-1 whitespace-pre-wrap text-muted-foreground">{leitura.voto}</p>{leitura.voto_cortado && <a href={d.url_portal} target="_blank" rel="noreferrer" className="g-meta text-primary hover:underline">voto inteiro no portal</a>}</details>}
                            </>
                          )}
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={() => ler(d)} aria-expanded={aberto}><BookOpen aria-hidden="true" /> {aberto ? 'Fechar' : 'Ler aqui'}</Button>
                        <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={() => copiarCitacao(d)} title={citacaoDoAcordao(d)}><Copy aria-hidden="true" /> Copiar citação</Button>
                        <a href={d.url_portal} target="_blank" rel="noreferrer" className="g-meta inline-flex items-center gap-1 text-primary hover:underline">no portal do TCU <ExternalLink className="h-3 w-3" aria-hidden="true" /></a>
                        {d.url_pdf && <a href={d.url_pdf} target="_blank" rel="noreferrer" className="g-meta inline-flex items-center gap-1 text-primary hover:underline"><FileText className="h-3 w-3" aria-hidden="true" /> PDF</a>}
                        {d.url_doc && <a href={d.url_doc} target="_blank" rel="noreferrer" className="g-meta inline-flex items-center gap-1 text-primary hover:underline">documento editável</a>}
                        <Button type="button" size="sm" variant={naBase ? 'ghost' : 'outline'} className="h-7" disabled={guardando === d.key || naBase} onClick={() => guardar(d)} title={naBase ? 'Já está na base normativa' : 'Traz o acórdão inteiro para a base normativa; a redação passa a poder citá-lo'}>
                          {guardando === d.key ? <Loader2 className="animate-spin" aria-hidden="true" /> : naBase ? <BookmarkCheck aria-hidden="true" /> : <BookmarkPlus aria-hidden="true" />}
                          {naBase ? 'Na base' : soSumario ? 'Guardar o texto completo' : 'Guardar na base'}
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
            {total > POR_PAGINA_TCU && (
              <nav className="flex flex-wrap items-center gap-2 border-t border-border bg-secondary px-4 py-2.5" aria-label="Páginas">
                <Button type="button" size="sm" variant="outline" disabled={paginaAtual <= 1 || buscando} onClick={() => irPara(1)} title="Primeira página"><ChevronsLeft aria-hidden="true" /></Button>
                <Button type="button" size="sm" variant="outline" disabled={paginaAtual <= 1 || buscando} onClick={() => irPara(paginaAtual - 1)}><ChevronLeft aria-hidden="true" /> Anterior</Button>
                <form className="inline-flex items-center gap-1 text-sm text-muted-foreground" onSubmit={(e) => { e.preventDefault(); const n = parseInt(paginaDigitada, 10); if (n >= 1 && n <= paginas) irPara(n); else toast.error(`Página entre 1 e ${paginas.toLocaleString('pt-BR')}`); }}>
                  página <Input aria-label="Ir para a página" inputMode="numeric" className="h-8 w-16 text-center tabular-nums" value={paginaDigitada} placeholder={String(paginaAtual)} onChange={(e) => setPaginaDigitada(e.target.value)} /> de {paginas.toLocaleString('pt-BR')}
                </form>
                <Button type="button" size="sm" variant="outline" disabled={paginaAtual >= paginas || buscando} onClick={() => irPara(paginaAtual + 1)}>Próxima <ChevronRight aria-hidden="true" /></Button>
                <Button type="button" size="sm" variant="outline" disabled={paginaAtual >= paginas || buscando} onClick={() => irPara(paginas)} title="Última página"><ChevronsRight aria-hidden="true" /></Button>
              </nav>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
