import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { History, ArrowRight } from 'lucide-react';

type Evento = {
  id: string;
  acao: string;
  modulo: string;
  descricao: string | null;
  created_at: string;
  user_id: string;
  metadata: Record<string, unknown> | null;
};

type TomRotulo = 'muted' | 'info' | 'warning' | 'danger';

/**
 * Linha do tempo de um processo, lida de `atividades_colaborador`.
 *
 * O filtro é por `metadata->>licitacao_id` e não por coluna própria: a trilha
 * não tem FK para `licitacoes` de propósito, para que o expurgo de 120 dias
 * apague o processo sem levar junto o registro de quem fez o quê com ele.
 */
const ROTULOS: Record<string, { texto: string; tom: TomRotulo }> = {
  processo_iniciado: { texto: 'Processo iniciado', tom: 'muted' },
  status_alterado: { texto: 'Status alterado', tom: 'info' },
  processo_arquivado: { texto: 'Arquivado', tom: 'muted' },
  processo_restaurado: { texto: 'Restaurado', tom: 'warning' },
  perda_registrada: { texto: 'Perda registrada', tom: 'danger' },
  processo_excluido: { texto: 'Excluído', tom: 'danger' },
};

export default function HistoricoProcesso({ licitacaoId }: { licitacaoId: string }) {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;

    const carregar = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('atividades_colaborador')
        .select('id, acao, modulo, descricao, created_at, user_id, metadata')
        .eq('metadata->>licitacao_id', licitacaoId)
        .order('created_at', { ascending: false })
        .limit(200);

      if (cancelado) return;
      const lista = (data as unknown as Evento[]) || [];
      setEventos(lista);

      // Nome de quem agiu — a trilha guarda o id, e "quem" é a primeira coisa
      // que se pergunta ao abrir um histórico.
      const ids = [...new Set(lista.map((e) => e.user_id))];
      if (ids.length) {
        // profiles chaveia por user_id (id é PK própria) — todo o app junta assim
        const { data: perfis } = await supabase
          .from('profiles')
          .select('user_id, nome_completo')
          .in('user_id', ids);
        if (!cancelado && perfis) {
          setNomes(Object.fromEntries(perfis.map((p) => [p.user_id, p.nome_completo || 'Colaborador'])));
        }
      }
      if (!cancelado) setLoading(false);
    };

    carregar();
    return () => { cancelado = true; };
  }, [licitacaoId]);

  if (loading) {
    return (
      <Card className="p-6" role="status" aria-busy="true">
        <span className="sr-only">Carregando histórico…</span>
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-48" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (!eventos.length) {
    return (
      <Card className="p-6">
        <EstadoVazio
          icone={<History />}
          titulo="Nenhuma movimentação registrada ainda"
          descricao="As próximas alterações deste processo aparecem aqui."
        />
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <ol className="relative ml-2 space-y-6 border-l border-border">
        {eventos.map((ev) => {
          const rotulo = ROTULOS[ev.acao] || { texto: ev.acao, tom: 'muted' as TomRotulo };
          const de = ev.metadata?.de as string | undefined;
          const para = ev.metadata?.para as string | undefined;
          return (
            <li key={ev.id} className="ml-5">
              <span className="absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full bg-border" aria-hidden="true" />
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={rotulo.tom}>{rotulo.texto}</Badge>
                {de && para && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    {de} <ArrowRight className="w-4 h-4" aria-hidden="true" /> <span className="font-medium text-foreground">{para}</span>
                  </span>
                )}
                {!de && para && (
                  <span className="text-xs text-muted-foreground">para <span className="font-medium text-foreground">{para}</span></span>
                )}
              </div>
              {ev.descricao && <p className="mt-1 text-sm">{ev.descricao}</p>}
              <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                {new Date(ev.created_at).toLocaleString('pt-BR')}
                {' · '}
                {nomes[ev.user_id] || 'Colaborador'}
              </p>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
