import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import SeloSituacao from '@/components/gestao/SeloSituacao';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';
import { BookOpenCheck, RefreshCw, Loader2 } from 'lucide-react';
import PesquisaNormativa from './PesquisaNormativa';

/**
 * Fontes oficiais — a base normativa que a IA pode citar (F3, 27/09/2026).
 *
 * Mostra, por fonte, quando a ingestão diária rodou pela última vez, quantos
 * documentos leu e o que falhou (falha silenciosa é proibida), quantos
 * registros a base tem, e uma busca no texto — a mesma porta
 * (`buscar_base_normativa`) que a redação usa. Admin da plataforma pode
 * disparar a ingestão pela tela.
 */
type Coleta = { fonte: string; iniciado_em: string; concluido_em: string | null; documentos: number; novos: number; alterados: number; erros: string[] };

const NOME_DA_FONTE: Record<string, string> = { planalto: 'Planalto — leis acompanhadas', tcu: 'TCU — acórdãos guardados', dou: 'DOU — seção 1', ioepa: 'IOEPA — Diário do Pará', manual: 'Enviados à mão' };
const dataBr = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');

type Leitor = {
  from: (t: string) => { select: (c: string) => { order: (c: string, o: { ascending: boolean }) => { limit: (n: number) => PromiseLike<{ data: unknown; error: { message: string } | null }> } } };
};
const db = supabase as unknown as Leitor;

export default function FontesOficiais() {
  const { isSystemAdmin } = useUserRole();
  const qc = useQueryClient();
  const [atualizando, setAtualizando] = useState(false);

  const { data: coletas } = useQuery<Coleta[]>({
    queryKey: ['base-normativa-coletas'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await db.from('base_normativa_coletas').select('fonte, iniciado_em, concluido_em, documentos, novos, alterados, erros').order('iniciado_em', { ascending: false }).limit(30);
      if (error) throw error;
      return data as Coleta[];
    },
  });
  const { data: totais } = useQuery<Record<string, number>>({
    queryKey: ['base-normativa-totais'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await db.from('base_normativa').select('fonte').order('fonte', { ascending: true }).limit(100000);
      if (error) throw error;
      const t: Record<string, number> = {};
      for (const r of (data as Array<{ fonte: string }>)) t[r.fonte] = (t[r.fonte] ?? 0) + 1;
      return t;
    },
  });
  // A última coleta de cada fonte.
  const ultimaPorFonte = new Map<string, Coleta>();
  for (const c of coletas ?? []) if (!ultimaPorFonte.has(c.fonte)) ultimaPorFonte.set(c.fonte, c);
  const fontes = ['planalto', 'tcu', 'dou'];

  const atualizar = async () => {
    setAtualizando(true);
    try {
      const { data, error } = await supabase.functions.invoke('ingestao-normativa', { body: {} });
      if (error) throw error;
      const r = data as { ok: boolean; planalto?: { novos: number; alterados: number; erros: string[] }; tcu?: { novos: number; erros: string[] }; dou?: { novos: number; erros: string[] }; error?: string };
      if (!r?.ok) throw new Error(r?.error ?? 'falha na ingestão');
      const erros = [...(r.planalto?.erros ?? []), ...(r.tcu?.erros ?? []), ...(r.dou?.erros ?? [])];
      toast.success(`Ingestão concluída: ${(r.planalto?.novos ?? 0) + (r.tcu?.novos ?? 0) + (r.dou?.novos ?? 0)} novo(s), ${r.planalto?.alterados ?? 0} redação(ões) alterada(s)`, { description: erros.length ? `${erros.length} erro(s) — veja abaixo.` : undefined });
      await qc.invalidateQueries({ queryKey: ['base-normativa-coletas'] });
      await qc.invalidateQueries({ queryKey: ['base-normativa-totais'] });
    } catch (e) {
      toast.error('Ingestão falhou', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setAtualizando(false);
    }
  };

  return (
    <section className="space-y-4" data-testid="fontes-oficiais">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold leading-6 text-foreground">
          <BookOpenCheck className="h-5 w-5 text-muted-foreground" aria-hidden="true" /> Fontes oficiais
        </h2>
        {isSystemAdmin && (
          <Button size="sm" variant="outline" onClick={atualizar} disabled={atualizando}>
            {atualizando ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
            Atualizar agora
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        A base que a redação pode citar: leis acompanhadas lidas do Planalto artigo por artigo, acórdãos do TCU (os recentes chegam todo dia; qualquer outro você pesquisa ao vivo no portal e guarda) e atos da seção 1 do DOU. Sem IA. O que não está aqui a peça marca como "a confirmar".
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        {fontes.map((f) => {
          const c = ultimaPorFonte.get(f);
          const comErro = (c?.erros?.length ?? 0) > 0;
          return (
            <Card key={f} className="space-y-1.5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{NOME_DA_FONTE[f]}</p>
                <SeloSituacao tom={!c ? 'neutro' : comErro ? 'atencao' : 'sucesso'}>{!c ? 'nunca rodou' : comErro ? 'com erro' : 'ok'}</SeloSituacao>
              </div>
              <p className="text-[1.5rem] font-semibold leading-8 tabular-nums text-foreground">{(totais?.[f] ?? 0).toLocaleString('pt-BR')}</p>
              <p className="g-meta text-muted-foreground">registro(s) na base</p>
              <p className="g-meta text-muted-foreground">Última leitura: {dataBr(c?.concluido_em ?? c?.iniciado_em)}{c ? ` · ${c.documentos} lido(s), ${c.novos} novo(s), ${c.alterados} alterado(s)` : ''}</p>
              {comErro && <ul className="space-y-0.5">{c!.erros.slice(0, 3).map((e) => <li key={e} className="g-meta text-warning-ink">{e}</li>)}</ul>}
            </Card>
          );
        })}
      </div>
      <PesquisaNormativa totais={totais} />
    </section>
  );
}
