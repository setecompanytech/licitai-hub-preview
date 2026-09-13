import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Megaphone, AtSign, X, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { tocarAlerta, vibrar } from '@/lib/alertas/som';

/**
 * A caixinha de CONVOCAÇÃO, no canto da tela, em qualquer página — o mesmo
 * desenho do lembrete de vencimento de documentos, porque o usuário já
 * aprendeu a olhar para aquele canto.
 *
 * Pregoeiro convocando não espera ninguém estar na tela certa: quando o robô
 * grava uma fala de portal que PEDE AÇÃO (convocação, diligência, prazo) ou
 * que MENCIONA a empresa, isto aqui toca o som, vibra (celular/tablet — a API
 * é ignorada em silêncio onde não há motor) e empilha a caixinha. Clicar nela
 * leva ao Mural & Chat com o processo aberto.
 *
 * Na própria página /monitoramento-chat o componente se cala: a tela já
 * mostra a lista e toca o próprio alerta — caixinha ali seria eco.
 */

type Chamado = {
  id: string;
  conteudo: string;
  created_at: string;
  licitacao_id: string;
  edital: string | null;
  tipo: 'convocacao' | 'mencao';
};

type MensagemRow = {
  id: string;
  conteudo: string;
  tipo: string;
  created_at: string;
  licitacao_id: string;
  metadata: { origem?: string; edital?: string; requer_acao?: boolean } | null;
};

const VISIVEIS = 3;
/** Só o recente importa como caixinha — o histórico mora no Mural & Chat. */
const JANELA_HORAS = 24;

const chaveVistos = (userId: string) => `praefectus:convocacoes-vistas:${userId}`;

function lerVistos(userId: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(chaveVistos(userId)) || '[]') as string[]);
  } catch {
    return new Set();
  }
}

function gravarVistos(userId: string, vistos: Set<string>) {
  try {
    localStorage.setItem(chaveVistos(userId), JSON.stringify([...vistos].slice(-200)));
  } catch {
    /* sem storage: a caixinha volta na próxima sessão, o que é tolerável */
  }
}

const dobrar = (s: string) =>
  String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const ESTILO = {
  convocacao: {
    caixa: 'border-l-destructive',
    texto: 'text-destructive-ink',
    rotulo: 'Convocação — pede ação',
    Icone: Megaphone,
  },
  mencao: {
    caixa: 'border-l-warning',
    texto: 'text-warning-ink',
    rotulo: 'A empresa foi mencionada',
    Icone: AtSign,
  },
} as const;

export default function LembreteDeConvocacao() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [chamados, setChamados] = useState<Chamado[]>([]);
  const nomesRef = useRef<string[]>([]);
  const vistosRef = useRef<Set<string>>(new Set());
  const naTelaDoChat = location.pathname === '/monitoramento-chat';
  const naTelaRef = useRef(naTelaDoChat);
  naTelaRef.current = naTelaDoChat;

  const classificar = useCallback((msg: MensagemRow): Chamado | null => {
    if (msg?.metadata?.origem !== 'portal') return null;
    if (msg.metadata?.requer_acao === true) {
      return {
        id: msg.id, conteudo: msg.conteudo, created_at: msg.created_at,
        licitacao_id: msg.licitacao_id, edital: msg.metadata?.edital ?? null,
        tipo: 'convocacao',
      };
    }
    const texto = dobrar(msg.conteudo);
    if (nomesRef.current.some((nome) => nome.length >= 6 && texto.includes(nome))) {
      return {
        id: msg.id, conteudo: msg.conteudo, created_at: msg.created_at,
        licitacao_id: msg.licitacao_id, edital: msg.metadata?.edital ?? null,
        tipo: 'mencao',
      };
    }
    return null;
  }, []);

  useEffect(() => {
    if (!user) { setChamados([]); return; }
    vistosRef.current = lerVistos(user.id);
    let vivo = true;

    (async () => {
      // Nomes da empresa: é com eles que "menção" é detectada no conteúdo.
      const { data: empresas } = await supabase
        .from('empresas')
        .select('razao_social, nome_fantasia');
      if (!vivo) return;
      const nomes = new Set<string>();
      for (const e of empresas ?? []) {
        if (e.razao_social) nomes.add(dobrar(e.razao_social));
        if (e.nome_fantasia) nomes.add(dobrar(e.nome_fantasia));
      }
      nomesRef.current = [...nomes];

      const desde = new Date(Date.now() - JANELA_HORAS * 3600_000).toISOString();
      const { data } = await supabase
        .from('licitacao_mensagens')
        .select('id, conteudo, tipo, created_at, licitacao_id, metadata')
        .eq('metadata->>origem', 'portal')
        .gte('created_at', desde)
        .order('created_at', { ascending: false })
        .limit(30);
      if (!vivo) return;
      const lista = ((data as unknown as MensagemRow[]) ?? [])
        .map(classificar)
        .filter((c): c is Chamado => c !== null && !vistosRef.current.has(c.id));
      setChamados(lista);
    })();

    const channel = supabase
      .channel('lembrete-convocacao-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'licitacao_mensagens' },
        (payload) => {
          const chamado = classificar(payload.new as MensagemRow);
          if (!chamado || vistosRef.current.has(chamado.id)) return;
          // Na tela do chat quem alarma é a própria tela — aqui seria eco.
          if (naTelaRef.current) return;
          setChamados((atual) => [chamado, ...atual.filter((c) => c.id !== chamado.id)]);
          tocarAlerta(chamado.tipo === 'convocacao' ? 'convocacao' : 'alerta');
          vibrar(chamado.tipo === 'convocacao' ? 'convocacao' : 'alerta');
        },
      )
      .subscribe();

    return () => {
      vivo = false;
      supabase.removeChannel(channel);
    };
  }, [user, classificar]);

  const marcarVisto = useCallback((id: string) => {
    if (!user) return;
    vistosRef.current.add(id);
    gravarVistos(user.id, vistosRef.current);
    setChamados((atual) => atual.filter((c) => c.id !== id));
  }, [user]);

  const abrir = useCallback((c: Chamado) => {
    marcarVisto(c.id);
    navigate(`/monitoramento-chat?lid=${c.licitacao_id}${c.edital ? `&num=${encodeURIComponent(c.edital)}` : ''}`);
  }, [marcarVisto, navigate]);

  if (!user || naTelaDoChat || chamados.length === 0) return null;

  const mostrados = chamados.slice(0, VISIVEIS);
  const ocultos = chamados.length - mostrados.length;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex flex-col gap-2.5"
    >
      {mostrados.map((c) => {
        const { caixa, texto, rotulo, Icone } = ESTILO[c.tipo];
        return (
          <div
            key={c.id}
            className={cn(
              'animate-fade-in rounded-xl border border-border border-l-[3px] bg-card px-3.5 py-3 shadow-md',
              caixa,
            )}
          >
            <div className="flex items-start gap-2.5">
              <Icone className={cn('mt-0.5 h-4 w-4 shrink-0', texto)} />
              <div className="min-w-0 flex-1">
                <p className={cn('text-xs font-semibold', texto)}>{rotulo}</p>
                {c.edital && (
                  <p className="truncate font-mono text-xs text-muted-foreground">{c.edital}</p>
                )}
                <p className="mt-0.5 line-clamp-2 text-sm text-foreground">{c.conteudo}</p>
                <button
                  onClick={() => abrir(c)}
                  className="mt-1.5 inline-flex items-center gap-1 rounded-sm text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Analisar no Mural &amp; Chat <ArrowRight className="h-3 w-3" />
                </button>
              </div>
              <button
                onClick={() => marcarVisto(c.id)}
                title="Dispensar este chamado"
                aria-label="Dispensar este chamado"
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        );
      })}

      {ocultos > 0 && (
        <button
          onClick={() => navigate('/monitoramento-chat')}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-md hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          e mais {ocultos} chamado{ocultos > 1 ? 's' : ''} no Mural &amp; Chat
        </button>
      )}
    </div>
  );
}
