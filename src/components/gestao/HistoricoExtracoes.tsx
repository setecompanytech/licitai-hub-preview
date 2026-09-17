import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import EstadoVazio from '@/components/shared/EstadoVazio';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { Search, FileText, AlertTriangle, Package, Sparkles } from 'lucide-react';
import LimparItensExtraidosButton from '@/components/licitacoes/LimparItensExtraidosButton';

type ProcessoComItens = {
  id: string;
  numero: string | null;
  orgao: string | null;
  objeto: string | null;
  status: string | null;
  total_itens: number;
  total_precificados: number;
  total_composicoes: number;
  total_geral: number;
  primeira_descricao: string | null;
  possivel_inconsistencia: boolean;
};

const STOPWORDS = new Set(['de','da','do','para','com','sem','e','ou','a','o','as','os','um','uma','em','no','na','nos','nas','por','tipo','referente','aquisicao','aquisição','contratacao','contratação','servico','serviços','servicos','servico','material','materiais','item','lote']);

function tokenize(s: string): Set<string> {
  return new Set(
    (s || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !STOPWORDS.has(w))
  );
}

/** Compara o objeto da licitação com a primeira descrição de item para detectar incoerência grave */
function detectMismatch(objeto: string | null, descricao: string | null): boolean {
  if (!objeto || !descricao) return false;
  const a = tokenize(objeto);
  const b = tokenize(descricao);
  if (a.size === 0 || b.size === 0) return false;
  let inter = 0;
  a.forEach((t) => { if (b.has(t)) inter++; });
  // Sem nenhuma palavra-chave em comum = provável incoerência
  return inter === 0;
}

export default function HistoricoExtracoes() {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const [data, setData] = useState<ProcessoComItens[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtro, setFiltro] = useState<'todos' | 'inconsistentes'>('todos');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      let qLics = supabase
        .from('licitacoes')
        .select('id, numero, orgao, objeto, status');
      if (empresaAtiva) qLics = qLics.eq('empresa_id', empresaAtiva.id);
      const { data: licitacoes } = await qLics.order('created_at', { ascending: false });

      if (!licitacoes || licitacoes.length === 0) {
        setData([]);
        return;
      }

      const ids = licitacoes.map((l) => l.id);

      const [itensRes, precRes, compRes] = await Promise.all([
        supabase
          .from('licitacao_itens')
          .select('licitacao_id, descricao')
          // Itens são do processo (empresa); o RLS decide quem lê.
          .in('licitacao_id', ids),
        supabase
          .from('catalogo_itens_precificados')
          .select('licitacao_id')
          .in('licitacao_id', ids)
          .eq('user_id', user.id),
        supabase
          .from('composicoes_custo')
          .select('licitacao_id')
          .in('licitacao_id', ids)
          .eq('user_id', user.id),
      ]);

      // As três consultas vêm de tabelas diferentes e só interessa por qual
      // processo cada linha responde — daí o vínculo mínimo em vez de `any`.
      type LinhaVinculada = { licitacao_id: string | null; descricao?: string | null };
      const porProcesso = (linhas: LinhaVinculada[] | null) =>
        (linhas || []).filter((r): r is LinhaVinculada & { licitacao_id: string } => Boolean(r.licitacao_id));

      const itensMap = new Map<string, { count: number; primeira?: string }>();
      porProcesso(itensRes.data).forEach((r) => {
        const cur = itensMap.get(r.licitacao_id) || { count: 0 };
        cur.count++;
        if (!cur.primeira) cur.primeira = r.descricao ?? undefined;
        itensMap.set(r.licitacao_id, cur);
      });

      const precCount = new Map<string, number>();
      porProcesso(precRes.data).forEach((r) => {
        precCount.set(r.licitacao_id, (precCount.get(r.licitacao_id) || 0) + 1);
      });

      const compCount = new Map<string, number>();
      porProcesso(compRes.data).forEach((r) => {
        compCount.set(r.licitacao_id, (compCount.get(r.licitacao_id) || 0) + 1);
      });

      const result: ProcessoComItens[] = licitacoes
        .map((l) => {
          const itens = itensMap.get(l.id) || { count: 0 };
          const total_itens = itens.count;
          const total_precificados = precCount.get(l.id) || 0;
          const total_composicoes = compCount.get(l.id) || 0;
          const total_geral = total_itens + total_precificados + total_composicoes;
          return {
            id: l.id,
            numero: l.numero,
            orgao: l.orgao,
            objeto: l.objeto,
            status: l.status,
            total_itens,
            total_precificados,
            total_composicoes,
            total_geral,
            primeira_descricao: itens.primeira || null,
            possivel_inconsistencia: detectMismatch(l.objeto, itens.primeira || null),
          };
        })
        .filter((p) => p.total_geral > 0);

      setData(result);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user, empresaAtiva]);

  useEffect(() => { load(); }, [load]);

  const filtered = data.filter((p) => {
    if (filtro === 'inconsistentes' && !p.possivel_inconsistencia) return false;
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      (p.numero || '').toLowerCase().includes(s) ||
      (p.orgao || '').toLowerCase().includes(s) ||
      (p.objeto || '').toLowerCase().includes(s)
    );
  });

  const totalInconsistentes = data.filter((p) => p.possivel_inconsistencia).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="g-titulo-secao flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
            Histórico de extrações por processo
          </h2>
          <p className="mt-1 g-corpo text-muted-foreground">
            Auditoria centralizada de itens extraídos pelo Robô, Precificação e Proposta. Limpe processos com dados incorretos.
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por número, órgão ou objeto..."
              aria-label="Buscar por número, órgão ou objeto"
              className="g-controle pl-9"
            />
          </div>
          <Button
            type="button"
            variant={filtro === 'inconsistentes' ? 'destructive' : 'outline'}
            aria-pressed={filtro === 'inconsistentes'}
            onClick={() => setFiltro((f) => (f === 'inconsistentes' ? 'todos' : 'inconsistentes'))}
          >
            <AlertTriangle aria-hidden="true" />
            Inconsistentes ({totalInconsistentes})
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2" role="status" aria-live="polite">
          <span className="sr-only">Carregando histórico…</span>
          {[0, 1, 2].map((i) => (
            <Card key={i} className="space-y-2 p-4">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-20" />
              </div>
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <EstadoVazio
            icone={<Package />}
            titulo="Nenhum histórico de extração encontrado"
            descricao="Quando você extrair itens em qualquer módulo, o histórico aparecerá aqui."
          />
        </Card>
      ) : (
        <Accordion type="multiple" className="space-y-2">
          {filtered.map((p) => (
            <AccordionItem
              key={p.id}
              value={p.id}
              className={cn(
                'rounded-lg border px-4 shadow-sm',
                p.possivel_inconsistencia ? 'border-destructive-line bg-destructive-tint' : 'border-border bg-card',
              )}
            >
              <AccordionTrigger className="py-3 hover:no-underline">
                <div className="flex w-full flex-wrap items-start justify-between gap-3 pr-2">
                  <div className="min-w-0 flex-1 text-left">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="g-meta text-muted-foreground tabular-nums">{p.numero || '—'}</span>
                      {p.possivel_inconsistencia && (
                        <Badge variant="danger" className="gap-1">
                          <AlertTriangle className="h-3 w-3" aria-hidden="true" /> Possível incoerência
                        </Badge>
                      )}
                      <Badge variant="muted">{p.status}</Badge>
                    </div>
                    <p className="mt-1 g-corpo font-medium line-clamp-1">{p.objeto || '(sem objeto)'}</p>
                    <p className="mt-0.5 g-meta text-muted-foreground line-clamp-1">{p.orgao}</p>
                  </div>
                  <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                    {p.total_itens > 0 && <Badge variant="outline" className="tabular-nums">Edital: {p.total_itens}</Badge>}
                    {p.total_precificados > 0 && <Badge variant="outline" className="tabular-nums">Precif.: {p.total_precificados}</Badge>}
                    {p.total_composicoes > 0 && <Badge variant="outline" className="tabular-nums">Prop.: {p.total_composicoes}</Badge>}
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pb-4">
                {p.possivel_inconsistencia && (
                  /* Alert de ui em vez do bloco montado à mão. Fica na superfície
                     clara (variante padrão) porque a própria linha já está
                     tingida de destrutivo: tinta sobre tinta apagaria a
                     separação entre o aviso e o cartão que o contém. */
                  <Alert className="border-destructive-line">
                    <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                    <AlertTitle className="text-destructive-ink">
                      Atenção: itens podem não pertencer a este processo
                    </AlertTitle>
                    <AlertDescription>
                      <p className="text-muted-foreground">
                        O <strong>objeto</strong> da licitação não compartilha palavras-chave com a primeira descrição extraída.
                        Considere limpar e reextrair.
                      </p>
                      <p className="mt-2 g-meta">
                        <strong>Objeto:</strong> {p.objeto?.slice(0, 160)}<br />
                        <strong>1º item:</strong> {p.primeira_descricao?.slice(0, 160)}
                      </p>
                    </AlertDescription>
                  </Alert>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="g-meta flex items-center gap-2 text-muted-foreground">
                    <FileText className="h-4 w-4" aria-hidden="true" />
                    {p.total_geral} registro(s) somando todas as fontes deste processo.
                  </div>
                  <LimparItensExtraidosButton
                    licitacaoId={p.id}
                    onCleared={load}
                    label="Limpar tudo deste processo"
                    variant="destructive"
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
