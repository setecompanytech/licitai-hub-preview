import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Activity, CheckCircle2, XCircle, Loader2, RefreshCw, Clock, AlertTriangle,
} from 'lucide-react';

/**
 * O que o robô fez — depois que a janela do VNC já fechou.
 *
 * Esta tela nasce de um episódio concreto. Em 08/09/2026 uma sessão disparada
 * pela interface entrou na conta do portal e ficou onze minutos com o navegador
 * aberto. Quem disparou não viu nada: tinha olhado o VNC durante uma tentativa
 * ANTERIOR, que falhara, e depois desistiu. A prova de que funcionou existia —
 * em `sessoes_lance_real`, no log do agente e em quinze fotos no servidor — e
 * nenhuma tela do Praefectus lia qualquer uma dessas fontes.
 *
 * O VNC mostra o presente e some. Isto mostra o que aconteceu.
 *
 * POR QUE AQUI, e não na aba "Operações": aquela lista é da SIMULAÇÃO, mora num
 * `useState` e se apaga ao recarregar a página. Esta lê o banco, e fica ao lado
 * do VNC porque é onde a pessoa vai quando quer saber se o robô funcionou.
 */

type Sessao = {
  id: string;
  edital: string;
  portal_nome: string;
  status: string;
  erro: string | null;
  rodada_atual: number | null;
  valor_atual: number | null;
  created_at: string;
  updated_at: string;
};

/**
 * A aparência de cada status, e o que ele significa em português.
 *
 * O texto explicativo não é enfeite: "erro" sozinho não distingue "o robô não
 * chegou ao portal" de "entrou e não achou o processo" — e essas duas têm
 * consertos diferentes. O motivo real vem em `erro`, e é sempre exibido.
 */
const APARENCIA: Record<string, { rotulo: string; classe: string; Icone: typeof Activity }> = {
  ativo: {
    rotulo: 'Em operação',
    classe: 'bg-success/10 text-success border-success/30',
    Icone: Activity,
  },
  enviando: {
    rotulo: 'Entrando no portal',
    classe: 'bg-info/10 text-info border-info/30',
    Icone: Loader2,
  },
  encerrado: {
    rotulo: 'Encerrada',
    classe: 'bg-muted text-muted-foreground border-border',
    Icone: CheckCircle2,
  },
  erro: {
    rotulo: 'Falhou',
    classe: 'bg-destructive/10 text-destructive border-destructive/30',
    Icone: XCircle,
  },
  pausado: {
    rotulo: 'Pausada',
    classe: 'bg-warning/10 text-warning border-warning/30',
    Icone: Clock,
  },
};

function quando(iso: string): string {
  const d = new Date(iso);
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  if (min < 60 * 24) return `há ${Math.floor(min / 60)} h`;
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function SessoesDoRobo() {
  const { user } = useAuth();
  const [expandida, setExpandida] = useState<string | null>(null);

  const { data: sessoes = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['sessoes-do-robo', user?.id],
    enabled: !!user,
    // Enquanto houver sessão viva, a lista se atualiza sozinha — é o que
    // permite acompanhar sem ficar apertando recarregar.
    refetchInterval: (query) => {
      const dados = query.state.data as Sessao[] | undefined;
      const viva = dados?.some((s) => s.status === 'ativo' || s.status === 'enviando');
      return viva ? 5000 : false;
    },
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sessoes_lance_real')
        .select('id, edital, portal_nome, status, erro, rodada_atual, valor_atual, created_at, updated_at')
        .order('created_at', { ascending: false })
        .limit(15);
      if (error) throw error;
      return (data || []) as Sessao[];
    },
  });

  return (
    <div className="border border-border rounded-xl bg-card">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-semibold">Sessões do Robô</h3>
          <span className="text-xs text-muted-foreground">
            o que aconteceu, mesmo depois de a tela remota fechar
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {isLoading ? (
        <div className="p-6 text-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mx-auto" />
        </div>
      ) : sessoes.length === 0 ? (
        <div className="p-6 text-center space-y-1">
          <Activity className="w-7 h-7 text-muted-foreground/30 mx-auto" />
          <p className="text-xs text-muted-foreground">Nenhuma sessão enviada ao robô ainda.</p>
          <p className="text-xs text-muted-foreground">
            Crie uma disputa e use <strong>Enviar ao robô</strong> — o resultado aparece aqui.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {sessoes.map((s) => {
            const ap = APARENCIA[s.status] || {
              rotulo: s.status,
              classe: 'bg-muted text-muted-foreground border-border',
              Icone: AlertTriangle,
            };
            const aberta = expandida === s.id;
            const viva = s.status === 'ativo' || s.status === 'enviando';

            return (
              <div key={s.id} className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => setExpandida(aberta ? null : s.id)}
                  className="w-full flex items-center gap-3 text-left"
                >
                  <ap.Icone
                    className={`w-4 h-4 shrink-0 ${
                      s.status === 'erro'
                        ? 'text-destructive'
                        : viva
                        ? 'text-success'
                        : 'text-muted-foreground'
                    } ${s.status === 'enviando' ? 'animate-spin' : ''}`}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">{s.edital}</span>
                      <span className="text-xs text-muted-foreground">{s.portal_nome}</span>
                    </div>
                    {/* A causa aparece na linha, sem precisar abrir: erro que
                        exige clique para ser lido é erro que ninguém lê. */}
                    {s.erro && (
                      <p className="text-xs text-destructive/90 truncate mt-0.5">{s.erro}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {s.rodada_atual ? (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        rodada {s.rodada_atual}
                      </span>
                    ) : null}
                    <Badge variant="outline" className={`text-xs ${ap.classe}`}>
                      {ap.rotulo}
                    </Badge>
                    <span className="text-xs text-muted-foreground w-16 text-right">
                      {quando(s.created_at)}
                    </span>
                  </div>
                </button>

                {aberta && (
                  <div className="mt-2 pl-7 text-xs text-muted-foreground space-y-1">
                    <p>
                      Início: {new Date(s.created_at).toLocaleString('pt-BR')}
                      {s.updated_at !== s.created_at && (
                        <> · Último sinal: {new Date(s.updated_at).toLocaleString('pt-BR')}</>
                      )}
                    </p>
                    {s.valor_atual != null && (
                      <p>
                        Último valor lido:{' '}
                        {s.valor_atual.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      </p>
                    )}
                    {s.erro && <p className="text-destructive/90">Motivo: {s.erro}</p>}
                    {!s.erro && s.status === 'encerrado' && (
                      <p>A sessão terminou sem erro registrado.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="px-4 py-2 text-xs text-muted-foreground border-t border-border">
        A tela remota (VNC) mostra o robô <strong>enquanto</strong> ele trabalha e some quando
        ele termina — às vezes em segundos. Esta lista guarda o que aconteceu.
      </p>
    </div>
  );
}
