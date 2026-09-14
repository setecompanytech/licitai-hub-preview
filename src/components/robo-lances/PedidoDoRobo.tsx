import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePedidosDoRobo } from './usePedidosDoRobo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

type Props = {
  /** Chamado quando o pedido é de captcha — leva a pessoa até a tela remota. */
  onAbrirTelaRemota?: () => void;
};

export default function PedidoDoRobo({ onAbrirTelaRemota }: Props) {
  const [valor, setValor] = useState('');
  const [enviando, setEnviando] = useState(false);

  const { data, refetch } = usePedidosDoRobo();
  const pedidos = data?.pedidos ?? [];

  const pedido = pedidos[0] || null;
  const chave = pedido ? `${pedido.sessao_id}:${pedido.tipo}` : null;

  // Pedido novo começa com o campo limpo: o código da tentativa anterior não
  // serve para esta, e deixá-lo ali convida a reenviar um número morto.
  useEffect(() => {
    setValor('');
  }, [chave]);

  /**
   * Quanto tempo o robô ainda espera.
   *
   * Sem isto a pessoa não sabe se tem cinco segundos ou cinco minutos. Quem não
   * sabe age com pressa desnecessária — ou desiste achando que já passou. O
   * relógio reinicia sozinho a cada tela nova, e o número aqui reflete isso.
   */
  const [restam, setRestam] = useState<number | null>(null);
  useEffect(() => {
    if (!pedido?.expira_em) {
      setRestam(null);
      return;
    }
    const calcular = () => {
      const s = Math.round((new Date(pedido.expira_em as string).getTime() - Date.now()) / 1000);
      setRestam(s > 0 ? s : 0);
    };
    calcular();
    const t = setInterval(calcular, 1000);
    return () => clearInterval(t);
  }, [pedido?.expira_em]);

  /**
   * "Deu certo?" — a pergunta que ficava sem resposta.
   *
   * O cartão simplesmente sumia quando o pedido era atendido. Sumir é ambíguo:
   * pode ter funcionado, pode ter expirado. E a dúvida faz clicar de novo —
   * que foi como três códigos do gov.br queimaram em 09/09/2026, até a conta do
   * cliente ser bloqueada por excesso de tentativa.
   *
   * Agora o agente registra COMO terminou, e isso vira aviso.
   */
  const desfechosVistos = useRef<Set<string>>(new Set());
  useEffect(() => {
    // A lista é lida DENTRO do efeito: `data?.desfechos ?? []` fora dele cria
    // um array novo a cada render enquanto a consulta não respondeu, e o efeito
    // passaria a rodar sempre.
    for (const d of data?.desfechos ?? []) {
      const id = `${d.sessao_id}:${d.em}`;
      if (desfechosVistos.current.has(id)) continue;
      desfechosVistos.current.add(id);
      if (d.desfecho === 'atendido') {
        toast.success('Recebido — o robô seguiu adiante.', { duration: 8000 });
      } else {
        toast.error(
          'O robô parou de esperar: ninguém respondeu a tempo. A sessão foi encerrada.',
          { duration: 12000 },
        );
      }
    }
  }, [data?.desfechos]);

  /**
   * O aviso que atravessa a aba.
   *
   * Esta caixa mora na aba Agente Cloud, e quem dispara uma sessão está na aba
   * Disputar. Sem isto, o robô pediria um código para uma tela que a pessoa não
   * está olhando — e um código de verificação vale segundos.
   *
   * É o mesmo cartão grande do convite para assistir, pelo mesmo motivo: em
   * 09/09/2026 a versão discreta desse aviso passou despercebida, e a correção
   * pedida foi "algo maior, mais chamativo".
   */
  const avisado = useRef<string | null>(null);
  useEffect(() => {
    if (!chave || !pedido) {
      avisado.current = null;
      return;
    }
    if (avisado.current === chave) return;
    avisado.current = chave;

    const ehCod = pedido.tipo === 'codigo';
    toast.custom(
      (id) => (
        <div className="w-full rounded-lg border-2 border-primary/60 bg-card shadow-md p-4 flex gap-4">
          <div className="w-12 h-12 rounded-md bg-primary-tint text-primary flex items-center justify-center shrink-0">
            {ehCod ? (
              <KeyRound className="w-6 h-6" aria-hidden="true" />
            ) : (
              <Monitor className="w-6 h-6" aria-hidden="true" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold leading-tight text-foreground">
              {ehCod ? 'O robô está pedindo um código' : 'O robô precisa de um clique seu'}
            </p>
            {/* No caso do captcha, a mensagem do AGENTE — ele sabe em que tela
                parou e nomeia o botão exato ("Seu certificado digital"), que é
                a única informação que resolve o problema de quem está olhando.
                Um texto fixo aqui diria "clique no botão que ele indicar", e
                jogaria fora justamente isso.

                No caso do código, não: a mensagem do agente diz "cole aqui", e
                aqui não há campo nenhum — este cartão flutua sobre qualquer
                aba. Então o texto aponta para onde o campo está. */}
            <p className="text-sm text-muted-foreground mt-1">
              {ehCod
                ? 'Ele parou numa verificação em duas etapas. O campo para colar o código está na aba Agente Cloud — o robô digita e confirma por você.'
                : pedido.mensagem}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <Button
                onClick={() => {
                  toast.dismiss(id);
                  onAbrirTelaRemota?.();
                }}
              >
                <Monitor className="w-4 h-4" aria-hidden="true" />
                {ehCod ? 'Ir para o campo' : 'Abrir a tela remota'}
              </Button>
              <Button
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => toast.dismiss(id)}
              >
                Já estou lá
              </Button>
            </div>
          </div>
        </div>
      ),
      {
        // Longo porque o pedido continua de pé: fechar sozinho em 5s deixaria a
        // pessoa sem saber que o robô está parado esperando.
        duration: 60000,
        unstyled: true,
        // Ancorado à direita: a lista do sonner é estreita e encosta na borda,
        // então largura extra sem esta âncora cresce para fora da tela.
        style: {
          width: 'min(460px, calc(100vw - 3rem))',
          right: 0,
          left: 'auto',
        },
      },
    );
  }, [chave, pedido, onAbrirTelaRemota]);

  if (!pedido) return null;

  const enviar = async () => {
    const limpo = valor.trim();
    if (!limpo) return;
    setEnviando(true);
    try {
      // A ação vai na URL, que é onde a função a lê. Mandada no corpo, como
      // estava, respondia 404 "Ação desconhecida" e o código nunca chegava ao
      // robô — enquanto o relógio do gov.br corria.
      const { data: resposta, error } = await supabase.functions.invoke('robo-lances-webhook/responder-humano', {
        body: { sessao_id: pedido.sessao_id, valor: limpo },
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
      if ((resposta as { aceito?: boolean })?.aceito) {
        toast.success('Entregue ao robô — ele está digitando agora.', { duration: 6000 });
        setValor('');
        refetch();
      } else {
        toast.error(
          (resposta as { error?: string })?.error || 'O robô não tinha mais nada pendente.',
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
    // Borda grossa e brilho pulsante: esta caixa só existe quando o robô está
    // PARADO esperando, e o custo de não vê-la é um código que expira.
    //
    // `pulse-glow` anima apenas o box-shadow — de propósito. Uma animação de
    // opacidade chamaria atenção piscando justamente o texto que precisa ser
    // lido, e o campo onde se digita. Por isso também não há `ring-*` aqui: ele
    // usa box-shadow e seria apagado pela animação.
    <div className="border-2 border-primary bg-primary-tint rounded-lg p-6 space-y-4 animate-pulse-glow" role="alert">
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-lg bg-card text-primary flex items-center justify-center shrink-0">
          {ehCodigo ? (
            <KeyRound className="w-7 h-7" aria-hidden="true" />
          ) : (
            <Monitor className="w-7 h-7" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <p className="text-lg font-semibold leading-tight">
              {ehCodigo ? 'O robô precisa de um código' : 'O robô precisa de um clique seu'}
            </p>
            {/* O relógio reinicia a cada tela nova, então o número sobe sozinho
                quando o robô avança. Abaixo de um minuto fica vermelho — é
                quando a pressa passa a ser real. */}
            {restam !== null && (
              <span
                className={`text-sm tabular-nums shrink-0 ${
                  restam <= 60 ? 'text-destructive font-semibold' : 'text-muted-foreground'
                }`}
              >
                {restam > 0
                  ? `ele espera por ${Math.floor(restam / 60)}min ${String(restam % 60).padStart(2, '0')}s`
                  : 'tempo esgotado'}
              </span>
            )}
          </div>
          <p className="text-base text-muted-foreground mt-1">{pedido.mensagem}</p>
          {pedido.tela && (
            <p className="text-xs text-muted-foreground mt-2 truncate">
              Tela: {pedido.tela}
            </p>
          )}
        </div>
      </div>

      {ehCodigo ? (
        <div>
          <Label htmlFor="pedido-robo-codigo" className="mb-1 block">Código de verificação</Label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              id="pedido-robo-codigo"
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
              // Grande e monoespaçado: são seis dígitos digitados sob pressão de
              // tempo, e ler errado custa uma tentativa na conta do cliente.
              className="font-mono text-lg tracking-widest h-12 bg-card"
              disabled={enviando}
            />
            <Button
              onClick={enviar}
              disabled={enviando || !valor.trim()}
              size="lg"
              className="shrink-0"
            >
              {enviando ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="w-4 h-4" aria-hidden="true" />
              )}
              Enviar ao robô
            </Button>
          </div>
        </div>
      ) : (
        <Button onClick={onAbrirTelaRemota} size="lg" className="w-full sm:w-auto">
          <Monitor className="w-5 h-5" aria-hidden="true" />
          Abrir a tela remota
        </Button>
      )}
    </div>
  );
}
