import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Bot, Clock, X, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  JANELA_DOS_AVISOS_HORAS,
  acaoDoAviso,
  avisosDaAbertura,
  ehAvisoDoRobo,
  gravidadeDoAviso,
  quandoDoAviso,
  segundosNaTela,
  type NotificacaoDoRobo,
} from '@/lib/robo/avisos-do-robo';

/**
 * Os avisos do robô no canto da tela, em qualquer página — o mesmo desenho dos
 * lembretes de certidão e de convocação (Fase 8, 16/09/2026).
 *
 * É um ACRÉSCIMO ao sininho, não um substituto: a caixinha aparece, fica alguns
 * segundos e some sozinha (17/09, pedido do Ian — "aparece e depois
 * desaparece", para não empilhar com os lembretes de certidão). O mouse em cima
 * ou o foco do teclado seguram a caixinha enquanto a pessoa lê. Sumir ou
 * dispensar não marca a notificação como lida. A regra do que aparece e por
 * quanto tempo está em `lib/robo/avisos-do-robo`, com teste. O som continua
 * sendo o do `AppLayout`, que já toca para toda notificação nova — tocar aqui
 * também seria eco.
 */

const VISIVEIS = 3;

const ESTILO = {
  urgente: { caixa: 'border-l-destructive', texto: 'text-destructive-ink', Icone: AlertTriangle },
  atencao: { caixa: 'border-l-warning', texto: 'text-warning-ink', Icone: Clock },
  informativo: { caixa: 'border-l-primary', texto: 'text-primary', Icone: Bot },
} as const;

const chaveDispensados = (userId: string) => `praefectus:avisos-do-robo-dispensados:${userId}`;

function lerDispensados(userId: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(chaveDispensados(userId)) || '[]') as string[]);
  } catch {
    return new Set();
  }
}

function gravarDispensados(userId: string, ids: Set<string>) {
  try {
    localStorage.setItem(chaveDispensados(userId), JSON.stringify([...ids].slice(-300)));
  } catch {
    /* sem storage: a caixinha volta na próxima sessão, o que é tolerável */
  }
}

/**
 * Some sozinho depois de `ms`, com pausa: `pausar` guarda o que falta e
 * `retomar` conta só o restante — quem parou para ler não perde a caixinha
 * no meio da frase.
 *
 * Aba escondida também pausa (17/09/2026): o Ian estava na tela remota, em
 * outra aba, quando o robô entrou no Portal de Compras Públicas, e o aviso
 * "Robô na sala" sumiu antes de ele voltar. Só conta o tempo em que a pessoa
 * pode ver a caixinha.
 */
function useSomeSozinho(ms: number, aoSumir: () => void) {
  const restante = useRef(ms);
  const inicio = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aoSumirRef = useRef(aoSumir);
  // Por que está parado: o mouse em cima, a aba escondida. Só conta sem nenhum.
  const motivos = useRef(new Set<'mouse' | 'aba'>());

  useEffect(() => {
    aoSumirRef.current = aoSumir;
  }, [aoSumir]);

  const contar = useCallback(() => {
    if (timer.current !== null || motivos.current.size > 0) return;
    inicio.current = Date.now();
    timer.current = setTimeout(() => {
      timer.current = null;
      aoSumirRef.current();
    }, restante.current);
  }, []);

  const parar = useCallback(() => {
    if (timer.current === null) return;
    clearTimeout(timer.current);
    timer.current = null;
    restante.current = Math.max(0, restante.current - (Date.now() - inicio.current));
  }, []);

  const pausarPor = useCallback((motivo: 'mouse' | 'aba') => {
    motivos.current.add(motivo);
    parar();
  }, [parar]);

  const retomarPor = useCallback((motivo: 'mouse' | 'aba') => {
    motivos.current.delete(motivo);
    contar();
  }, [contar]);

  useEffect(() => {
    const aoMudarVisibilidade = () => {
      if (document.hidden) pausarPor('aba');
      else retomarPor('aba');
    };
    if (document.hidden) motivos.current.add('aba');
    contar();
    document.addEventListener('visibilitychange', aoMudarVisibilidade);
    return () => {
      document.removeEventListener('visibilitychange', aoMudarVisibilidade);
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = null;
    };
  }, [contar, pausarPor, retomarPor]);

  const pausar = useCallback(() => pausarPor('mouse'), [pausarPor]);
  const retomar = useCallback(() => retomarPor('mouse'), [retomarPor]);
  return { pausar, retomar };
}

function CaixaDoAviso({
  aviso,
  agora,
  aoDispensar,
  aoAbrir,
}: {
  aviso: NotificacaoDoRobo;
  agora: Date;
  aoDispensar: (id: string) => void;
  aoAbrir: (aviso: NotificacaoDoRobo) => void;
}) {
  const { caixa, texto, Icone } = ESTILO[gravidadeDoAviso(aviso.tipo)];
  const sumir = useCallback(() => aoDispensar(aviso.id), [aoDispensar, aviso.id]);
  const { pausar, retomar } = useSomeSozinho(segundosNaTela(aviso.tipo) * 1000, sumir);

  return (
    <div
      onMouseEnter={pausar}
      onMouseLeave={retomar}
      onFocus={pausar}
      onBlur={retomar}
      className={cn('animate-fade-in rounded-lg border border-border border-l-[3px] bg-card px-4 py-3 shadow-md', caixa)}
    >
      <div className="flex items-start gap-3">
        <Icone className={cn('mt-0.5 h-4 w-4 shrink-0', texto)} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-semibold text-foreground">{aviso.titulo || 'Aviso do robô'}</p>
          <p className={cn('text-xs font-medium', texto)}>Robô de Lances · {quandoDoAviso(aviso.created_at, agora)}</p>
          {aviso.mensagem && <p className="mt-1 line-clamp-4 text-xs text-muted-foreground">{aviso.mensagem}</p>}
          {aviso.link && (
            <button
              onClick={() => aoAbrir(aviso)}
              className="mt-2 inline-flex items-center gap-1 rounded text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {acaoDoAviso(aviso.link)} <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </button>
          )}
        </div>
        <button
          onClick={() => aoDispensar(aviso.id)}
          // O sininho continua com a notificação: o × só tira a caixinha da tela.
          title="Dispensar (continua no sininho)"
          aria-label={`Dispensar o aviso: ${aviso.titulo || 'aviso do robô'}`}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export default function LembreteDoRobo() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [avisos, setAvisos] = useState<NotificacaoDoRobo[]>([]);
  const [tudo, setTudo] = useState(false);
  const [agora, setAgora] = useState(() => new Date());
  const dispensadosRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) { setAvisos([]); return; }
    dispensadosRef.current = lerDispensados(user.id);
    let vivo = true;

    (async () => {
      const desde = new Date(Date.now() - JANELA_DOS_AVISOS_HORAS * 3600_000).toISOString();
      const { data } = await supabase
        .from('notificacoes')
        .select('id, titulo, mensagem, tipo, link, lida, created_at')
        .eq('user_id', user.id)
        .eq('lida', false)
        .gte('created_at', desde)
        .order('created_at', { ascending: false })
        .limit(50);
      if (!vivo) return;
      const { mostrar, jaVistos } = avisosDaAbertura((data as NotificacaoDoRobo[]) ?? [], dispensadosRef.current, new Date(), VISIVEIS);
      if (jaVistos.length) {
        jaVistos.forEach((id) => dispensadosRef.current.add(id));
        gravarDispensados(user.id, dispensadosRef.current);
      }
      setAvisos(mostrar);
    })();

    const channel = supabase
      .channel('lembrete-do-robo-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notificacoes', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const nova = payload.new as NotificacaoDoRobo;
          if (!ehAvisoDoRobo(nova) || dispensadosRef.current.has(nova.id)) return;
          setAvisos((atual) => [nova, ...atual.filter((a) => a.id !== nova.id)]);
        },
      )
      .subscribe();

    // "há 5 min" envelhece: relê o relógio a cada minuto.
    const relogio = window.setInterval(() => setAgora(new Date()), 60_000);

    return () => {
      vivo = false;
      window.clearInterval(relogio);
      supabase.removeChannel(channel);
    };
  }, [user]);

  const dispensar = useCallback((id: string) => {
    if (!user) return;
    dispensadosRef.current.add(id);
    gravarDispensados(user.id, dispensadosRef.current);
    setAvisos((atual) => atual.filter((a) => a.id !== id));
  }, [user]);

  const abrir = useCallback((aviso: NotificacaoDoRobo) => {
    dispensar(aviso.id);
    if (aviso.link) navigate(aviso.link);
  }, [dispensar, navigate]);

  if (!user || avisos.length === 0) return null;

  const mostrados = tudo ? avisos : avisos.slice(0, VISIVEIS);
  const ocultos = avisos.length - mostrados.length;

  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-2.5">
      {mostrados.map((a) => (
        <CaixaDoAviso key={a.id} aviso={a} agora={agora} aoDispensar={dispensar} aoAbrir={abrir} />
      ))}

      {ocultos > 0 && (
        <button
          onClick={() => setTudo(true)}
          className="rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground shadow-md transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          e mais {ocultos} aviso{ocultos > 1 ? 's' : ''} do robô
        </button>
      )}
    </div>
  );
}
