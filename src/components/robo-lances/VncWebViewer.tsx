import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePedidosDoRobo } from './usePedidosDoRobo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Monitor, ExternalLink, Maximize2, Minimize2, RefreshCw,
  ShieldCheck, AlertTriangle, X, Loader2,
} from 'lucide-react';

const NOVNC_BASE_URL = 'https://agente.praefectus.com.br/vnc';

/**
 * `abrirEm` é um contador: cada incremento é um pedido para abrir a tela.
 *
 * Contador e não booleano porque o pedido se repete — enviar duas sessões
 * seguidas precisa abrir duas vezes, e um booleano que já está `true` não
 * dispara efeito nenhum na segunda.
 */
type Props = { abrirEm?: number };

export default function VncWebViewer({ abrirEm = 0 }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [showViewer, setShowViewer] = useState(false);
  const [loading, setLoading] = useState(false);
  const caixaRef = useRef<HTMLDivElement>(null);

  /**
   * O caminho até aqui era longo demais para o tempo que existe.
   *
   * Quem enviava ao robô precisava: trocar de aba, rolar até quase o fim da
   * página, achar o painel e clicar em "Abrir VNC Integrado". Quatro passos —
   * e a sessão pode terminar em segundos. Na prática ninguém chegava a tempo, e
   * a conclusão era que a tela remota não funcionava.
   *
   * Um pedido de fora abre o visualizador E traz o painel para a vista. O
   * `requestAnimationFrame` espera a aba terminar de renderizar: rolar antes
   * disso mira um elemento que ainda não existe na tela.
   */
  useEffect(() => {
    if (!abrirEm) return;
    setLoading(true);
    setShowViewer(true);
    requestAnimationFrame(() => {
      caixaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [abrirEm]);

  const vncUrl = `${NOVNC_BASE_URL}/vnc.html?path=/vnc/&autoconnect=true&resize=scale&reconnect=true&reconnect_delay=3000`;

  /**
   * Há robô trabalhando neste momento?
   *
   * Sem esta pergunta, o painel abria uma tela PRETA quando não havia sessão —
   * a tela vazia do servidor — e isso é indistinguível de um VNC quebrado. Foi
   * exatamente a conclusão a que se chegou em 08/09/2026, enquanto o robô
   * funcionava.
   *
   * A resposta muda a mensagem, não o comportamento: o VNC continua conectando,
   * porque conectar ANTES de disparar é justamente o jeito certo de usar — a
   * sessão pode durar segundos, e não dá tempo de abrir depois.
   */
  const { data: sessoesAtivas } = useQuery({
    queryKey: ['vnc-sessoes-ativas'],
    refetchInterval: showViewer ? 4000 : 20000,
    queryFn: async () => {
      const { data } = await supabase.functions.invoke('robo-lances-webhook/healthcheck', {
        body: {},
      });
      const agentes = (data as { agentes?: Array<{ sessoes_ativas?: number | null }> } | null)?.agentes;
      // `null` = não deu para saber. Diferente de zero, e a tela não deve
      // afirmar "nenhuma sessão" quando na verdade não perguntou.
      if (!agentes?.length) return null;
      return agentes.reduce((t, a) => t + (a.sessoes_ativas ?? 0), 0);
    },
  });

  /**
   * O robô está parado esperando alguém CLICAR nesta tela?
   *
   * O salto conceitual que trava quem vê o VNC pela primeira vez é não saber
   * que aquilo é uma máquina real e que o clique dela vale. O painel explicava
   * QUANDO usar, nunca que era clicável.
   *
   * Compartilha a consulta com o cartão de pedidos — mesma chave no react-query,
   * uma requisição só.
   */
  const { data: pedidosData } = usePedidosDoRobo();
  const pedidoDeClique = (pedidosData?.pedidos || []).find((p) => p.tipo === 'captcha') || null;

  const handleOpenViewer = () => {
    setLoading(true);
    setShowViewer(true);
  };

  const handleOpenExternal = () => {
    window.open(vncUrl, '_blank', 'noopener,noreferrer');
  };

  const handleClose = () => {
    setShowViewer(false);
    setExpanded(false);
    setLoading(false);
  };

  const handleRefresh = () => {
    setLoading(true);
    setShowViewer(false);
    setTimeout(() => setShowViewer(true), 300);
  };

  return (
    <div ref={caixaRef} className="border border-border/50 rounded-lg overflow-hidden scroll-mt-4">
      {/* Header */}
      <div className="flex items-center justify-between bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <Monitor className="w-4 h-4 text-muted-foreground" />
          <h4 className="text-sm font-semibold">Acesso Remoto — VNC Web</h4>
          <Badge variant="outline" className="text-xs ml-1">noVNC</Badge>
        </div>
        <div className="flex items-center gap-1.5">
          {showViewer && (
            <>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={handleRefresh}
                title="Reconectar"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => setExpanded(!expanded)}
                title={expanded ? 'Reduzir' : 'Expandir'}
              >
                {expanded ? (
                  <Minimize2 className="w-3.5 h-3.5" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={handleOpenExternal}
                title="Abrir em nova aba"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={handleClose}
                title="Fechar"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      {!showViewer ? (
        <div className="p-5 space-y-4">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto">
              <Monitor className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Acesse a tela do servidor diretamente pelo navegador para resolver
                desafios de <strong>2FA</strong>, <strong>Captcha</strong> ou <strong>código de acesso gov.br</strong>,
                sem precisar instalar programas adicionais.
              </p>
            </div>
          </div>

          <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground space-y-1">
                {/* A ordem importa e não é óbvia: uma sessão que falha dura
                    ~13 segundos, medidos. Quem dispara primeiro e vai abrir a
                    tela depois chega sempre atrasado. */}
                <p className="font-medium text-foreground">
                  Abra esta tela ANTES de enviar ao robô
                </p>
                <p>
                  A sessão pode durar poucos segundos. Com o VNC já aberto, você acompanha
                  desde o primeiro instante; abrindo depois, costuma chegar quando já acabou.
                </p>
                <p className="font-medium text-foreground pt-1">Quando usar o VNC?</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>O robô solicitou código de verificação por SMS/e-mail</li>
                  <li>Apareceu um Captcha na tela de login do portal</li>
                  <li>É necessário autorizar acesso via gov.br (2 etapas)</li>
                  <li>Precisa gerar código de acesso no app gov.br</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={handleOpenViewer}
              className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground text-xs gap-2"
            >
              <Monitor className="w-4 h-4" />
              Abrir VNC Integrado
            </Button>
            <Button
              variant="outline"
              onClick={handleOpenExternal}
              className="flex-1 text-xs gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Abrir em Nova Aba
            </Button>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
            <ShieldCheck className="w-3.5 h-3.5 text-success" />
            <span>Conexão segura via HTTPS — sem necessidade de instalar software</span>
          </div>
        </div>
      ) : (
        <div className={`relative bg-black ${expanded ? 'h-[600px]' : 'h-[400px]'} transition-all duration-300`}>
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
              <div className="text-center space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-white/90 mx-auto" />
                <p className="text-xs text-white/70">Conectando ao servidor VPS...</p>
              </div>
            </div>
          )}
          {/* Só quando há pedido de clique. Fora disso o VNC não ganha faixa
              nenhuma — aviso permanente vira paisagem e ninguém lê. */}
          {pedidoDeClique && !loading && (
            <div className="absolute top-0 left-0 right-0 z-20 bg-accent text-accent-foreground px-4 py-3 shadow-lg animate-pulse-glow">
              <p className="text-sm font-semibold">
                👆 Esta é a tela do robô — e o seu clique aqui funciona
              </p>
              <p className="text-xs opacity-90 mt-0.5 leading-snug">{pedidoDeClique.mensagem}</p>
            </div>
          )}
          <iframe
            src={vncUrl}
            className="w-full h-full border-0"
            title="VNC Web Viewer — noVNC"
            allow="clipboard-read; clipboard-write; fullscreen"
            allowFullScreen
            onLoad={() => setLoading(false)}
          />

          {/* Tela preta sem explicação passa por defeito. Com sessão ativa este
              aviso some sozinho; `pointer-events-none` garante que ele nunca
              atrapalhe quem precisa clicar no VNC para resolver um captcha. */}
          {!loading && sessoesAtivas === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-black/75 rounded-xl px-6 py-5 max-w-md text-center space-y-2">
                <Monitor className="w-7 h-7 text-white/50 mx-auto" />
                <p className="text-sm font-medium text-white/90">Nenhuma sessão ativa</p>
                <p className="text-xs text-white/60">
                  A tela do servidor está vazia porque o robô não está operando agora.
                  Isso não é falha da conexão.
                </p>
                <p className="text-xs text-white/60">
                  Deixe esta tela aberta e clique em <strong>Enviar ao robô</strong> na aba
                  Disputar — a janela dele aparece aqui em poucos segundos.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
