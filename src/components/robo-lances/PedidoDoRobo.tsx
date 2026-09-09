import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { KeyRound, Monitor, Loader2, Send } from 'lucide-react';

/**
 * O que o robô está esperando de uma pessoa — e o campo para responder.
 *
 * ─── POR QUE ISTO EXISTE ────────────────────────────────────────────────────
 *
 * Em 09/09/2026 o gov.br pediu um código de verificação em duas etapas no meio
 * do login do Compras.gov. O caminho usado foi: o cliente gera o código no app,
 * digita no WhatsApp, alguém lê, troca para a aba do VNC e digita seis dígitos
 * por conexão remota. Medido: cerca de 50 segundos. O código vale cerca de 60.
 *
 * Três tentativas queimaram e a conta do cliente levou bloqueio temporário por
 * excesso de erro (ERL0018900). Os códigos não estavam errados — estavam
 * velhos.
 *
 * Aqui a pessoa só cola o número. Quem digita é o robô, que já está dentro da
 * página com o campo localizado: dois segundos no lugar de cinquenta.
 *
 * ─── POR QUE NÃO HÁ CONFIGURAÇÃO ────────────────────────────────────────────
 *
 * O que aparece nesta caixa vem da TELA em que o robô parou, lida por ele em
 * tempo real, e não de uma opção "este portal usa 2FA". Uma opção dessas
 * envelheceria em silêncio: o cliente desliga a verificação em duas etapas,
 * ninguém desmarca a opção, e o robô fica esperando um código que nunca vem.
 *
 * Consequência direta: se não há nada pendente, este componente **não desenha
 * nada**. Ele aparece sozinho quando é preciso, e some sozinho quando não é.
 */

type Pedido = {
  sessao_id: string;
  tipo: string;
  mensagem: string;
  tela: string | null;
  criado_em: string;
};

type Props = {
  /** Chamado quando o pedido é de captcha — leva a pessoa até a tela remota. */
  onAbrirTelaRemota?: () => void;
};

export default function PedidoDoRobo({ onAbrirTelaRemota }: Props) {
  const [valor, setValor] = useState('');
  const [enviando, setEnviando] = useState(false);

  const { data: pedidos = [], refetch } = useQuery({
    queryKey: ['pedidos-do-robo'],
    // Curto de propósito: um código de verificação tem validade de segundos, e
    // saber dele com 20s de atraso é o mesmo que não saber.
    refetchInterval: 3000,
    queryFn: async () => {
      const { data } = await supabase.functions.invoke('robo-lances-webhook/healthcheck', {
        body: {},
      });
      const agentes = (data as {
        agentes?: Array<{ aguardando_humano?: Pedido[] | null }>;
      } | null)?.agentes;
      return (agentes || []).flatMap((a) => a.aguardando_humano || []);
    },
  });

  const pedido = pedidos[0] || null;

  // Pedido novo começa com o campo limpo: o código da tentativa anterior não
  // serve para esta, e deixá-lo ali convida a reenviar um número morto.
  useEffect(() => {
    setValor('');
  }, [pedido?.sessao_id, pedido?.tipo]);

  if (!pedido) return null;

  const enviar = async () => {
    const limpo = valor.trim();
    if (!limpo) return;
    setEnviando(true);
    try {
      const { data, error } = await supabase.functions.invoke('robo-lances-webhook', {
        body: { action: 'responder-humano', sessao_id: pedido.sessao_id, valor: limpo },
      });
      if (error) {
        // O corpo do erro vem em `context`, não em `message` — sem isto a
        // pessoa recebe "non-2xx status code" no lugar da causa.
        let detalhe = error.message;
        try {
          const corpo = await (error as { context?: Response }).context?.json();
          if (corpo?.error) detalhe = corpo.error;
        } catch {
          /* fica a mensagem original */
        }
        toast.error(detalhe, { duration: 10000 });
        return;
      }
      if ((data as { aceito?: boolean })?.aceito) {
        toast.success('Entregue ao robô — ele está digitando agora.', { duration: 6000 });
        setValor('');
        refetch();
      } else {
        toast.error(
          (data as { error?: string })?.error || 'O robô não tinha mais nada pendente.',
          { duration: 10000 },
        );
      }
    } catch (err) {
      toast.error((err as Error).message, { duration: 10000 });
    } finally {
      setEnviando(false);
    }
  };

  const ehCodigo = pedido.tipo === 'codigo';

  return (
    <div className="border-2 border-accent/60 bg-accent/5 rounded-xl p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-accent/15 flex items-center justify-center shrink-0">
          {ehCodigo ? (
            <KeyRound className="w-5 h-5 text-accent" />
          ) : (
            <Monitor className="w-5 h-5 text-accent" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {ehCodigo ? 'O robô precisa de um código' : 'O robô precisa de um clique seu'}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{pedido.mensagem}</p>
          {pedido.tela && (
            <p className="text-xs text-muted-foreground/70 mt-1 truncate">
              Tela: {pedido.tela}
            </p>
          )}
        </div>
      </div>

      {ehCodigo ? (
        <div className="flex gap-2">
          <Input
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') enviar();
            }}
            placeholder="Cole o código aqui"
            // Sem autocorreção e sem autocapitalização: é um código, não texto.
            autoComplete="one-time-code"
            inputMode="numeric"
            autoFocus
            className="font-mono tracking-widest"
            disabled={enviando}
          />
          <Button onClick={enviar} disabled={enviando || !valor.trim()} className="gap-2 shrink-0">
            {enviando ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Enviar ao robô
          </Button>
        </div>
      ) : (
        <Button onClick={onAbrirTelaRemota} className="gap-2 w-full sm:w-auto">
          <Monitor className="w-4 h-4" />
          Abrir a tela remota
        </Button>
      )}
    </div>
  );
}
