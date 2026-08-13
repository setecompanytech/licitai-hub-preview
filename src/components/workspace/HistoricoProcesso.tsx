import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { History, Loader2, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type Evento = {
  id: string;
  acao: string;
  modulo: string;
  descricao: string | null;
  created_at: string;
  user_id: string;
  metadata: Record<string, unknown> | null;
};

/**
 * Linha do tempo de um processo, lida de `atividades_colaborador`.
 *
 * O filtro é por `metadata->>licitacao_id` e não por coluna própria: a trilha
 * não tem FK para `licitacoes` de propósito, para que o expurgo de 120 dias
 * apague o processo sem levar junto o registro de quem fez o quê com ele.
 */
const ROTULOS: Record<string, { texto: string; tom: string }> = {
  processo_iniciado: { texto: 'Processo iniciado', tom: 'bg-muted text-muted-foreground border-border' },
  status_alterado: { texto: 'Status alterado', tom: 'bg-primary/10 text-primary border-primary/20' },
  processo_arquivado: { texto: 'Arquivado', tom: 'bg-muted text-muted-foreground border-border' },
  processo_restaurado: { texto: 'Restaurado', tom: 'bg-warning/10 text-warning border-warning/20' },
  perda_registrada: { texto: 'Perda registrada', tom: 'bg-destructive/10 text-destructive border-destructive/20' },
  processo_excluido: { texto: 'Excluído', tom: 'bg-destructive/10 text-destructive border-destructive/20' },
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
        const { data: perfis } = await supabase
          .from('profiles')
          .select('id, nome_completo')
          .in('id', ids);
        if (!cancelado && perfis) {
          setNomes(Object.fromEntries(perfis.map((p) => [p.id, p.nome_completo || 'Colaborador'])));
        }
      }
      if (!cancelado) setLoading(false);
    };

    carregar();
    return () => { cancelado = true; };
  }, [licitacaoId]);

  if (loading) {
    return (
      <Card className="p-8 flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-base">Carregando histórico…</span>
      </Card>
    );
  }

  if (!eventos.length) {
    return (
      <Card className="p-8 text-center">
        <History className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
        <p className="text-base text-muted-foreground">
          Nenhuma movimentação registrada ainda. As próximas alterações deste processo aparecem aqui.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <ol className="relative border-l border-border/60 ml-2 space-y-5">
        {eventos.map((ev) => {
          const rotulo = ROTULOS[ev.acao] || { texto: ev.acao, tom: 'bg-muted text-muted-foreground border-border' };
          const de = ev.metadata?.de as string | undefined;
          const para = ev.metadata?.para as string | undefined;
          return (
            <li key={ev.id} className="ml-5">
              <span className="absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full bg-border" aria-hidden="true" />
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={cn('text-xs', rotulo.tom)}>{rotulo.texto}</Badge>
                {de && para && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    {de} <ArrowRight className="w-3 h-3" /> <span className="font-medium text-foreground">{para}</span>
                  </span>
                )}
                {!de && para && (
                  <span className="text-xs text-muted-foreground">para <span className="font-medium text-foreground">{para}</span></span>
                )}
              </div>
              {ev.descricao && <p className="text-sm mt-1">{ev.descricao}</p>}
              <p className="text-xs text-muted-foreground mt-1 tabular-nums">
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
