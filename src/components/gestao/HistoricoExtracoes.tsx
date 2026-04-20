import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Loader2, Search, FileText, AlertTriangle, Package, Sparkles } from 'lucide-react';
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
  const [data, setData] = useState<ProcessoComItens[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtro, setFiltro] = useState<'todos' | 'inconsistentes'>('todos');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: licitacoes } = await supabase
        .from('licitacoes')
        .select('id, numero, orgao, objeto, status')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!licitacoes || licitacoes.length === 0) {
        setData([]);
        return;
      }

      const ids = licitacoes.map((l) => l.id);

      const [itensRes, precRes, compRes] = await Promise.all([
        supabase
          .from('licitacao_itens')
          .select('licitacao_id, descricao')
          .in('licitacao_id', ids)
          .eq('user_id', user.id),
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

      const itensMap = new Map<string, { count: number; primeira?: string }>();
      (itensRes.data || []).forEach((r: any) => {
        const cur = itensMap.get(r.licitacao_id) || { count: 0 };
        cur.count++;
        if (!cur.primeira) cur.primeira = r.descricao;
        itensMap.set(r.licitacao_id, cur);
      });

      const precCount = new Map<string, number>();
      (precRes.data || []).forEach((r: any) => {
        precCount.set(r.licitacao_id, (precCount.get(r.licitacao_id) || 0) + 1);
      });

      const compCount = new Map<string, number>();
      (compRes.data || []).forEach((r: any) => {
        compCount.set(r.licitacao_id, (compCount.get(r.licitacao_id) || 0) + 1);
      });

      const result: ProcessoComItens[] = licitacoes
        .map((l: any) => {
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
  }, [user]);

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
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent" />
            Histórico de Extrações por Processo
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Auditoria centralizada de itens extraídos pelo Robô, Precificação e Proposta. Limpe processos com dados incorretos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por número, órgão ou objeto..."
              className="pl-8 h-8 text-xs w-64"
            />
          </div>
          <Button
            size="sm"
            variant={filtro === 'inconsistentes' ? 'destructive' : 'outline'}
            onClick={() => setFiltro((f) => (f === 'inconsistentes' ? 'todos' : 'inconsistentes'))}
            className="gap-1.5 h-8"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Inconsistentes ({totalInconsistentes})
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando histórico...
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <Package className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium">Nenhum histórico de extração encontrado</p>
          <p className="text-xs text-muted-foreground mt-1">
            Quando você extrair itens em qualquer módulo, o histórico aparecerá aqui.
          </p>
        </Card>
      ) : (
        <Accordion type="multiple" className="space-y-2">
          {filtered.map((p) => (
            <AccordionItem
              key={p.id}
              value={p.id}
              className={`border rounded-lg px-3 ${p.possivel_inconsistencia ? 'border-destructive/40 bg-destructive/5' : 'border-border/50'}`}
            >
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-start justify-between gap-3 w-full pr-2">
                  <div className="text-left flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-muted-foreground">{p.numero || '—'}</span>
                      {p.possivel_inconsistencia && (
                        <Badge variant="destructive" className="text-[9px] gap-1">
                          <AlertTriangle className="w-2.5 h-2.5" /> Possível incoerência
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[9px]">{p.status}</Badge>
                    </div>
                    <p className="text-xs font-medium mt-1 line-clamp-1">{p.objeto || '(sem objeto)'}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{p.orgao}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {p.total_itens > 0 && <Badge variant="outline" className="text-[9px]">Edital: {p.total_itens}</Badge>}
                    {p.total_precificados > 0 && <Badge variant="outline" className="text-[9px]">Precif.: {p.total_precificados}</Badge>}
                    {p.total_composicoes > 0 && <Badge variant="outline" className="text-[9px]">Prop.: {p.total_composicoes}</Badge>}
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-3 space-y-3">
                {p.possivel_inconsistencia && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs flex gap-2">
                    <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-destructive">Atenção: itens podem não pertencer a este processo.</p>
                      <p className="text-muted-foreground mt-0.5">
                        O <strong>objeto</strong> da licitação não compartilha palavras-chave com a primeira descrição extraída.
                        Considere limpar e reextrair.
                      </p>
                      <p className="mt-1.5 text-[10px]">
                        <strong>Objeto:</strong> {p.objeto?.slice(0, 160)}<br />
                        <strong>1º item:</strong> {p.primeira_descricao?.slice(0, 160)}
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
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
