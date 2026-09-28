import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SeloSituacao from '@/components/gestao/SeloSituacao';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Search, Loader2, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  DESCRICAO_DA_FONTE, FILTROS_INICIAIS, FONTES, NOME_DA_FONTE, POR_PAGINA, facetasPorNome, parametrosDaPesquisa, pesquisaValida, rotuloDoRegistro,
  type Faceta, type Filtros, type Fonte, type Registro,
} from '@/lib/juridico/pesquisa-normativa';

/**
 * Pesquisa normativa (27/09/2026): termo opcional, fonte, diploma ou
 * colegiado ou tipo de ato, período, ordem, total e páginas. Sem fonte
 * escolhida, o resultado sai SEPARADO por fonte, cada bloco com o seu total —
 * "Planalto misturado com TCU" foi a queixa do dono. Cada registro mostra o
 * que o identifica na fonte: artigo; relator, sessão e ata; órgão, edição e
 * página. As portas são `pesquisar_base_normativa` e `facetas_base_normativa`.
 */
type Rpc = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }> };
const db = supabase as unknown as Rpc;

const TIPO_DO_DOU: Record<string, string> = { portaria: 'Portaria', despacho: 'Despacho', 'instrução normativa': 'Instrução normativa', resolução: 'Resolução', decreto: 'Decreto', deliberação: 'Deliberação', ato: 'Ato', edital: 'Edital', extrato: 'Extrato' };

export default function PesquisaNormativa({ totais }: { totais?: Record<string, number> }) {
  const [f, setF] = useState<Filtros>(FILTROS_INICIAIS);
  const [buscando, setBuscando] = useState(false);
  const [porFonte, setPorFonte] = useState<Record<string, Registro[]> | null>(null);
  const [facetas, setFacetas] = useState<Record<string, Array<{ valor: string; quantidade: number }>>>({});
  const [ultima, setUltima] = useState<Filtros | null>(null);

  const pesquisar = async (filtros: Filtros = f) => {
    const erro = pesquisaValida(filtros);
    if (erro) { toast.error(erro); return; }
    setBuscando(true);
    try {
      const fontesAConsultar: Array<Fonte | null> = filtros.fonte ? [filtros.fonte] : FONTES;
      const [facet, ...resultados] = await Promise.all([
        db.rpc('facetas_base_normativa', { p_termo: filtros.termo.trim() || null, p_fonte: filtros.fonte }),
        ...fontesAConsultar.map((fonte) => db.rpc('pesquisar_base_normativa', { ...parametrosDaPesquisa({ ...filtros, fonte }), p_limite: filtros.fonte ? POR_PAGINA : 5 })),
      ]);
      const falha = resultados.find((r) => r.error);
      if (falha?.error) throw new Error(falha.error.message);
      const agrupado: Record<string, Registro[]> = {};
      fontesAConsultar.forEach((fonte, i) => { agrupado[fonte ?? 'todas'] = (resultados[i].data ?? []) as Registro[]; });
      setPorFonte(agrupado);
      setFacetas(facet.error ? {} : facetasPorNome((facet.data ?? []) as Faceta[]));
      setUltima(filtros);
    } catch (e) {
      toast.error('Não foi possível pesquisar', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBuscando(false);
    }
  };
  const mudar = (parte: Partial<Filtros>) => setF((atual) => ({ ...atual, ...parte, pagina: 1 }));
  const irPara = (pagina: number) => { const n = { ...f, pagina }; setF(n); void pesquisar(n); };
  const escolherFonte = (fonte: Fonte | null) => { const n = { ...f, fonte, identificador: null, tipo: null, pagina: 1 }; setF(n); if (ultima) void pesquisar(n); };

  const totalDe = (fonte: string) => porFonte?.[fonte]?.[0]?.total ?? 0;
  const opcoesDeTipo = f.fonte === 'planalto' ? (facetas.diploma ?? []) : f.fonte === 'tcu' ? (facetas.colegiado ?? []) : f.fonte === 'dou' ? (facetas.tipo ?? []) : [];
  const rotuloDoTipo = f.fonte === 'planalto' ? 'Diploma' : f.fonte === 'tcu' ? 'Colegiado' : 'Tipo de ato';

  const registro = (r: Registro) => {
    const { titulo, meta } = rotuloDoRegistro(r);
    return (
      <li key={r.id} className="space-y-1 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-foreground">{titulo}</p>
          {r.correspondencia === 'parcial' && ultima?.termo.trim() && <SeloSituacao tom="neutro">parcial</SeloSituacao>}
          {r.url && <a href={r.url} target="_blank" rel="noreferrer" className="g-meta inline-flex items-center gap-1 text-primary hover:underline">texto oficial <ExternalLink className="h-3 w-3" aria-hidden="true" /></a>}
        </div>
        {meta.length > 0 && <p className="g-meta text-muted-foreground">{meta.join(' · ')}</p>}
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">{(r.trecho || r.ementa || '').slice(0, 700)}</p>
      </li>
    );
  };

  return (
    <Card className="space-y-4 p-4" data-testid="pesquisa-normativa">
      <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
        <div className="space-y-1.5">
          <Label htmlFor="pn-termo">Termo (opcional com fonte e período)</Label>
          <Input id="pn-termo" placeholder="ex.: atestado de capacidade técnica" value={f.termo} onChange={(e) => mudar({ termo: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') void pesquisar(); }} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pn-de">Período de</Label>
          <Input id="pn-de" type="date" value={f.dataDe ?? ''} onChange={(e) => mudar({ dataDe: e.target.value || null })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pn-ate">até</Label>
          <Input id="pn-ate" type="date" value={f.dataAte ?? ''} onChange={(e) => mudar({ dataAte: e.target.value || null })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pn-ordem">Ordenar por</Label>
          <Select value={f.ordem} onValueChange={(v) => mudar({ ordem: v as Filtros['ordem'] })}>
            <SelectTrigger id="pn-ordem"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="relevancia">Relevância</SelectItem>
              <SelectItem value="data">Data (mais recente)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label>Fonte</Label>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Fonte">
            <Button size="sm" variant={f.fonte === null ? 'default' : 'outline'} aria-pressed={f.fonte === null} onClick={() => escolherFonte(null)}>Todas</Button>
            {FONTES.map((fonte) => (
              <Button key={fonte} size="sm" variant={f.fonte === fonte ? 'default' : 'outline'} aria-pressed={f.fonte === fonte} onClick={() => escolherFonte(fonte)} title={DESCRICAO_DA_FONTE[fonte]}>
                {NOME_DA_FONTE[fonte]}{totais ? ` · ${(totais[fonte] ?? 0).toLocaleString('pt-BR')}` : ''}
              </Button>
            ))}
          </div>
        </div>
        {f.fonte && (
          <div className="min-w-56 space-y-1.5">
            <Label htmlFor="pn-tipo">{rotuloDoTipo}</Label>
            <Select value={(f.fonte === 'planalto' ? f.identificador : f.tipo) ?? '__todos__'} onValueChange={(v) => mudar(f.fonte === 'planalto' ? { identificador: v === '__todos__' ? null : v } : { tipo: v === '__todos__' ? null : v })}>
              <SelectTrigger id="pn-tipo"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__todos__">Todos</SelectItem>
                {opcoesDeTipo.map((o) => <SelectItem key={o.valor} value={o.valor}>{TIPO_DO_DOU[o.valor] ?? o.valor} · {o.quantidade}</SelectItem>)}
              </SelectContent>
            </Select>
            {opcoesDeTipo.length === 0 && <p className="g-meta text-muted-foreground">As opções aparecem depois da primeira pesquisa nesta fonte.</p>}
          </div>
        )}
        <Button onClick={() => pesquisar()} disabled={buscando}>{buscando ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Search aria-hidden="true" />} Pesquisar</Button>
      </div>

      {porFonte && ultima && (
        ultima.fonte ? (
          <div className="space-y-2" data-testid="resultado-por-fonte">
            <p className="text-sm text-foreground">
              <b>{totalDe(ultima.fonte).toLocaleString('pt-BR')}</b> registro(s) em {NOME_DA_FONTE[ultima.fonte]}{ultima.termo.trim() ? ` para "${ultima.termo.trim()}"` : ''}{ultima.dataDe || ultima.dataAte ? ` no período ${ultima.dataDe ? ultima.dataDe.split('-').reverse().join('/') : '…'} a ${ultima.dataAte ? ultima.dataAte.split('-').reverse().join('/') : 'hoje'}` : ''}. Página {ultima.pagina} de {Math.max(1, Math.ceil(totalDe(ultima.fonte) / POR_PAGINA))}.
            </p>
            {totalDe(ultima.fonte) === 0 ? (
              <p className="text-sm text-muted-foreground">Nada nesta fonte com estes filtros. {ultima.fonte === 'dou' ? 'O DOU cobre só a última semana e só atos que citem contratação pública.' : ultima.fonte === 'tcu' ? 'A base do TCU cresce um pouco por dia, do mais recente para trás.' : ''}</p>
            ) : (
              <ul className="divide-y divide-border">{porFonte[ultima.fonte].map(registro)}</ul>
            )}
            {totalDe(ultima.fonte) > POR_PAGINA && (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" disabled={ultima.pagina <= 1 || buscando} onClick={() => irPara(ultima.pagina - 1)}><ChevronLeft aria-hidden="true" /> Anterior</Button>
                <Button size="sm" variant="outline" disabled={ultima.pagina * POR_PAGINA >= totalDe(ultima.fonte) || buscando} onClick={() => irPara(ultima.pagina + 1)}>Próxima <ChevronRight aria-hidden="true" /></Button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-5" data-testid="resultado-agrupado">
            {FONTES.map((fonte) => (
              <section key={fonte} className="space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-1">
                  <p className="text-sm font-semibold text-foreground">{NOME_DA_FONTE[fonte]} <span className="font-normal text-muted-foreground">· {DESCRICAO_DA_FONTE[fonte]}</span></p>
                  <div className="flex items-center gap-2">
                    <span className="g-meta tabular-nums text-muted-foreground">{totalDe(fonte).toLocaleString('pt-BR')} registro(s)</span>
                    {totalDe(fonte) > (porFonte[fonte]?.length ?? 0) && <Button size="sm" variant="ghost" onClick={() => escolherFonte(fonte)}>Ver todos</Button>}
                  </div>
                </div>
                {totalDe(fonte) === 0
                  ? <p className="py-2 text-sm text-muted-foreground">Nada nesta fonte{ultima.termo.trim() ? ' com estas palavras' : ' neste período'}.</p>
                  : <ul className="divide-y divide-border">{porFonte[fonte].map(registro)}</ul>}
              </section>
            ))}
          </div>
        )
      )}
    </Card>
  );
}
