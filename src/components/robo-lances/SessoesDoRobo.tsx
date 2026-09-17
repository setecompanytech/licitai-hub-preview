import { Skeleton } from '@/components/ui/skeleton';
import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { pararSessaoDoRobo, type MensagemDaParada } from './usePedidosDoRobo';
import { toast } from 'sonner';
import {
  Activity, CheckCircle2, XCircle, Loader2, RefreshCw, Clock, AlertTriangle, Square,
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

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'muted';

/**
 * A aparência de cada status, e o que ele significa em português.
 *
 * O texto explicativo não é enfeite: "erro" sozinho não distingue "o robô não
 * chegou ao portal" de "entrou e não achou o processo" — e essas duas têm
 * consertos diferentes. O motivo real vem em `erro`, e é sempre exibido.
 */
const APARENCIA: Record<string, { rotulo: string; variante: BadgeVariant; Icone: typeof Activity }> = {
  ativo: {
    rotulo: 'Em operação',
    variante: 'success',
    Icone: Activity,
  },
  enviando: {
    rotulo: 'Entrando no portal',
    variante: 'info',
    Icone: Loader2,
  },
  encerrado: {
    rotulo: 'Encerrada',
    variante: 'muted',
    Icone: CheckCircle2,
  },
  erro: {
    rotulo: 'Falhou',
    variante: 'danger',
    Icone: XCircle,
  },
  pausado: {
    rotulo: 'Pausada',
    variante: 'warning',
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

  const [parando, setParando] = useState<string | null>(null);
  // O desfecho do último pedido de parada, por sessão. Fica na linha — não só
  // num toast que some — porque "aguardando confirmação" é um estado que dura.
  const [paradas, setParadas] = useState<Record<string, MensagemDaParada>>({});

  const { data, isLoading, refetch, isFetching } = useQuery({
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

  const sessoes = data ?? [];

  /**
   * Por que o robô parou — dito na hora, não só guardado na lista.
   *
   * A sessão terminava e a única pista era uma linha vermelha aqui embaixo, que
   * só é lida por quem já desconfia. Quem estava olhando o VNC via a tela sumir
   * e ficava sem saber se acabou bem ou mal.
   *
   * Só transições contam: a primeira carga registra o estado de tudo sem
   * avisar, senão abrir a aba dispararia um toast para cada erro antigo dos
   * quinze registros.
   */
  const estados = useRef<Map<string, string> | null>(null);
  useEffect(() => {
    const lista = data ?? [];
    if (!lista.length) return;

    if (estados.current === null) {
      estados.current = new Map(lista.map((s) => [s.id, s.status]));
      return;
    }

    for (const s of lista) {
      const antes = estados.current.get(s.id);
      estados.current.set(s.id, s.status);
      if (!antes || antes === s.status) continue;
      if (s.status !== 'erro' && s.status !== 'encerrado') continue;

      const viva = antes === 'ativo' || antes === 'enviando';
      if (!viva) continue;

      if (s.status === 'erro') {
        toast.error(
          `O robô parou em ${s.edital}: ${s.erro || 'sem motivo registrado'}`,
          { duration: 20000 },
        );
      } else {
        toast.success(`Sessão de ${s.edital} encerrada.`, { duration: 8000 });
      }
    }
  }, [data]);

  /**
   * O freio de uma sessão só.
   *
   * Diferente do kill switch, que mata tudo. Em 09/09/2026 uma sessão travada
   * teve que ser encerrada por `curl` na VPS porque nenhuma tela oferecia isso.
   *
   * Até 14/09/2026 este botão mandava a ação no corpo, recebia 404 e mostrava
   * "já não estava mais rodando" — o pedido nunca chegava ao agente. Agora
   * passa por `solicitarParada` e diz exatamente um de três desfechos:
   * confirmada (com a hora), solicitada (aguardando o serviço) ou falhou
   * (com o motivo e o botão para tentar de novo). "Solicitada" nunca é
   * anunciada como parada.
   */
  const pararSessao = async (id: string, edital: string) => {
    setParando(id);
    try {
      const { resultado, mensagem } = await pararSessaoDoRobo(id);
      setParadas((antes) => ({ ...antes, [id]: mensagem }));
      if (resultado.estado === 'confirmada') {
        toast.success(`${edital}: ${mensagem.texto}.`, { duration: 8000 });
      } else if (resultado.estado === 'solicitada') {
        toast.warning(`${edital}: ${mensagem.texto}.`, { duration: 15000 });
      } else {
        toast.error(`${edital}: ${mensagem.texto}`, { duration: 15000 });
      }
      refetch();
    } catch (err) {
      const texto = `Não foi possível pedir a parada: ${(err as Error).message}`;
      setParadas((antes) => ({ ...antes, [id]: { estado: 'falhou', texto } }));
      toast.error(texto, { duration: 15000 });
    } finally {
      setParando(null);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-4 border-b border-border">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Activity className="w-5 h-5 text-primary" aria-hidden="true" />
          <h3 className="text-lg font-semibold">Sessões do Robô</h3>
          <span className="text-sm text-muted-foreground">
            o que aconteceu, mesmo depois de a tela remota fechar
          </span>
        </div>
        <Button
          variant="ghost"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} aria-hidden="true" />
          Atualizar
        </Button>
      </div>

      {isLoading ? (
        <div className="p-6 space-y-3" role="status" aria-busy="true">
          <span className="sr-only">Carregando sessões</span>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-4 w-4 rounded-full shrink-0" />
              <Skeleton className="h-4 flex-1 max-w-[240px]" />
              <Skeleton className="h-5 w-20 rounded-full ml-auto shrink-0" />
            </div>
          ))}
        </div>
      ) : sessoes.length === 0 ? (
        <EstadoVazio
          icone={<Activity />}
          titulo="Nenhuma sessão enviada ao robô ainda"
          descricao={<>Crie uma disputa com data e horário — o robô entra sozinho — ou use <strong>Ações › Entrar agora</strong>. O resultado aparece aqui.</>}
          tamanho="compacto"
        />
      ) : (
        <div className="divide-y divide-border">
          {sessoes.map((s) => {
            const ap = APARENCIA[s.status] || {
              rotulo: s.status,
              variante: 'muted' as BadgeVariant,
              Icone: AlertTriangle,
            };
            const aberta = expandida === s.id;
            const viva = s.status === 'ativo' || s.status === 'enviando';
            const parada = paradas[s.id];

            return (
              <div key={s.id} className="px-6 py-3">
                <button
                  type="button"
                  onClick={() => setExpandida(aberta ? null : s.id)}
                  aria-expanded={aberta}
                  className="w-full flex items-center gap-3 text-left rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <ap.Icone
                    aria-hidden="true"
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
                      <p className="text-xs text-destructive truncate mt-0.5">{s.erro}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {s.rodada_atual ? (
                      <span className="text-xs text-muted-foreground tabular-nums hidden sm:inline">
                        rodada {s.rodada_atual}
                      </span>
                    ) : null}
                    <Badge variant={ap.variante}>
                      {ap.rotulo}
                    </Badge>
                    <span className="text-xs text-muted-foreground w-16 text-right hidden sm:inline">
                      {quando(s.created_at)}
                    </span>
                  </div>
                </button>

                {/* O freio fica NA LINHA da sessão que ele para — e só existe
                    enquanto ela está viva. Botão de parar em sessão encerrada
                    seria ruído, e pior: sugeriria que ainda há o que parar.
                    O desfecho do pedido fica visível mesmo depois que a sessão
                    encerra — é a resposta a "parou mesmo?". */}
                {(viva || parada) && (
                  <div className="pl-7 pt-2 space-y-1">
                    {viva && (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={parando === s.id}
                          onClick={() => pararSessao(s.id, s.edital)}
                        >
                          {parando === s.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <Square className="w-4 h-4" aria-hidden="true" />
                          )}
                          {parada?.estado === 'falhou'
                            ? 'Tentar novamente'
                            : parada?.estado === 'solicitada'
                            ? 'Pedir a parada de novo'
                            : 'Parar robô nesta disputa'}
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          Parar não cancela lances já aceitos pelo portal.
                        </span>
                      </div>
                    )}
                    {parada && (
                      <p
                        role={parada.estado === 'falhou' ? 'alert' : 'status'}
                        className={`text-sm ${
                          parada.estado === 'confirmada'
                            ? 'text-success-ink'
                            : parada.estado === 'solicitada'
                            ? 'text-warning-ink'
                            : 'text-destructive'
                        }`}
                      >
                        {parada.texto}
                      </p>
                    )}
                  </div>
                )}

                {aberta && (
                  <div className="mt-2 pl-7 text-sm text-muted-foreground space-y-1">
                    <p>
                      Início: {new Date(s.created_at).toLocaleString('pt-BR')}
                      {s.updated_at !== s.created_at && (
                        <> · Último sinal: {new Date(s.updated_at).toLocaleString('pt-BR')}</>
                      )}
                    </p>
                    {s.valor_atual != null && (
                      <p className="tabular-nums">
                        Último valor lido:{' '}
                        {s.valor_atual.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      </p>
                    )}
                    {s.erro && <p className="text-destructive">Motivo: {s.erro}</p>}
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

      <p className="px-6 py-3 text-sm text-muted-foreground border-t border-border">
        A tela remota (VNC) mostra o robô <strong>enquanto</strong> ele trabalha e some quando
        ele termina — às vezes em segundos. Esta lista guarda o que aconteceu.
      </p>
    </div>
  );
}
