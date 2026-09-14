import { useState } from 'react';
import { Loader2, Power, PowerOff, RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { causaDoErro } from '@/lib/robo/comandos';
import { AVISO_MIGRACAO_PENDENTE, horaDeBrasilia, lerResultadoDaParada, tabelaAusente } from './robo-do-cliente';
import type { EstadoDoRoboDaEmpresa, LinhaDoRoboDaEmpresa } from './useRoboDaEmpresa';

/**
 * Ligar / desligar o robô de lances da empresa.
 *
 * ─── O QUE DESLIGAR FAZ, E O QUE NÃO FAZ ────────────────────────────────────
 *
 * Duas coisas, nesta ordem:
 *
 *  1. grava `ligado = false` em `robo_empresa_config` — o servidor passa a
 *     recusar sessão NOVA;
 *  2. pede ao freio (`robo-lances-webhook/kill-switch`) a parada das sessões
 *     que já estão de pé.
 *
 * A ordem importa: parar primeiro deixaria uma janela em que outra pessoa da
 * empresa inicia uma sessão entre a parada e a gravação.
 *
 * O passo 2 roda mesmo se o 1 falhar. Quem confirmou "desligar" quer, antes de
 * tudo, que o robô pare no portal — e a tela diz separadamente o que deu certo
 * e o que não deu.
 *
 * Lance já aceito pelo portal não é cancelado, e a parada é "confirmada" só
 * quando o agente confirma; sem confirmação ela é "solicitada", e a tela diz
 * isso com essas palavras. Freio que mente é pior que freio ausente.
 *
 * LIGAR só grava `ligado = true`. Nenhuma sessão começa sozinha por isso.
 */

type Props = {
  empresaId: string | null | undefined;
  estado: EstadoDoRoboDaEmpresa;
  podeOperar: boolean;
  /** Recebe o que o banco devolveu depois de gravar. */
  aoAlterar: (linha: LinhaDoRoboDaEmpresa) => void;
  /** Reler quando a leitura inicial falhou. */
  aoTentarLerDeNovo?: () => void;
};

const TEXTO_DESLIGAR =
  'Desligar impede iniciar novas sessões e pede a parada das sessões em andamento. ' +
  'Lances já aceitos pelo portal não são cancelados.';

/** Erro de gravação em linguagem de quem usa a tela. */
function motivoDaGravacao(erro: { code?: string; message?: string }): string {
  if (tabelaAusente(erro)) return AVISO_MIGRACAO_PENDENTE.toLowerCase();
  if (erro.code === '42501' || /row-level security|permission denied/i.test(erro.message ?? '')) {
    return 'seu papel nesta empresa não permite alterar o robô';
  }
  return erro.message || 'o banco não respondeu';
}

export default function LigarDesligarRobo({ empresaId, estado, podeOperar, aoAlterar, aoTentarLerDeNovo }: Props) {
  const [salvando, setSalvando] = useState(false);
  /** Última parada pedida nesta tela — fica visível até a pessoa sair. */
  const [ultimaParada, setUltimaParada] = useState<string | null>(null);

  // Interface simples e não união discriminada: com `strict: false` o TypeScript
  // não estreita pelo `ok`, e `motivo` ficava inacessível.
  const gravar = async (ligado: boolean): Promise<{ ok: boolean; motivo?: string }> => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabela de 14/09 fora do types.ts (parado em 16/08)
      const { data, error } = await (supabase as any)
        .from('robo_empresa_config')
        .upsert(
          { empresa_id: empresaId, ligado, motivo: ligado ? null : 'Desligado na tela do robô de lances' },
          { onConflict: 'empresa_id' },
        )
        .select('ligado, motivo, alterado_em');
      if (error) return { ok: false, motivo: motivoDaGravacao(error) };
      const linha = (Array.isArray(data) ? data[0] : data) as LinhaDoRoboDaEmpresa | undefined;
      // Sem linha de volta não há prova de gravação — a RLS pode ter filtrado
      // em silêncio. Dizer "desligado" aqui seria afirmar o que o banco não disse.
      if (!linha) return { ok: false, motivo: 'o banco não confirmou a gravação' };
      aoAlterar({ ligado: linha.ligado !== false, motivo: linha.motivo ?? null, alterado_em: linha.alterado_em ?? null });
      return { ok: true };
    } catch (e) {
      return { ok: false, motivo: (e as Error)?.message || 'sem resposta do banco' };
    }
  };

  const desligar = async () => {
    if (!empresaId || salvando) return;
    setSalvando(true);
    try {
      const gravacao = await gravar(false);
      if (gravacao.ok) {
        toast.success('Robô desligado. Nenhuma sessão nova será iniciada.', { duration: 8000 });
      } else {
        toast.error(
          `O robô não foi desligado: ${gravacao.motivo}. A parada das sessões em andamento será pedida mesmo assim.`,
          { duration: 15000 },
        );
      }

      try {
        const { data, error } = await supabase.functions.invoke('robo-lances-webhook/kill-switch', {
          body: { motivo: 'Robô da empresa desligado na tela do robô de lances' },
        });
        if (error) throw new Error(await causaDoErro(error as { message?: string; context?: unknown }));

        const { alvo, confirmadas, aguardando } = lerResultadoDaParada(data);
        const agora = horaDeBrasilia(new Date().toISOString());
        if (alvo === 0) {
          toast.info('Nenhuma sessão em andamento para parar.', { duration: 8000 });
          setUltimaParada(null);
        } else if (aguardando === 0) {
          toast.warning(
            `Parada confirmada — ${confirmadas} sessão(ões) encerrada(s). Lances já aceitos pelo portal não são cancelados.`,
            { duration: 12000 },
          );
          setUltimaParada(`Parada confirmada em ${agora} — ${confirmadas} sessão(ões) encerrada(s).`);
        } else {
          toast.error(
            `Parada SOLICITADA — ${aguardando} de ${alvo} sessão(ões) ainda sem confirmação. ` +
              'O robô pode continuar operando no portal até confirmar: acompanhe no painel ou intervenha no portal.',
            { duration: 30000 },
          );
          setUltimaParada(
            `Parada solicitada em ${agora} — ${aguardando} de ${alvo} sessão(ões) aguardando confirmação.`,
          );
        }
      } catch (e) {
        console.error('[robo-lances] kill-switch ao desligar', e);
        toast.error(
          `Não foi possível pedir a parada das sessões: ${(e as Error)?.message || 'sem resposta do serviço'}. ` +
            'Sessões em andamento podem continuar — tente de novo ou intervenha no portal.',
          { duration: 20000 },
        );
        setUltimaParada('A parada das sessões não foi pedida — tente desligar de novo.');
      }
    } finally {
      setSalvando(false);
    }
  };

  const ligar = async () => {
    if (!empresaId || salvando) return;
    setSalvando(true);
    try {
      const gravacao = await gravar(true);
      if (gravacao.ok) {
        setUltimaParada(null);
        toast.success('Robô ligado. Novas sessões podem ser iniciadas.', { duration: 8000 });
      } else {
        toast.error(`O robô não foi ligado: ${gravacao.motivo}.`, { duration: 12000 });
      }
    } finally {
      setSalvando(false);
    }
  };

  const bloqueado =
    !empresaId || !podeOperar || estado.migracaoPendente || estado.carregando || !estado.confirmado || salvando;

  // Toda indisponibilidade diz por quê — botão cinza sem razão é indistinguível
  // de defeito.
  const nota = !empresaId
    ? 'Selecione uma empresa para ligar ou desligar o robô.'
    : estado.migracaoPendente
      ? AVISO_MIGRACAO_PENDENTE
      : estado.erro
        ? 'Não foi possível confirmar se o robô está ligado.'
        : !podeOperar
          ? 'Ligar e desligar o robô exige o papel de operador.'
          : null;

  const icone = salvando
    ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
    : estado.ligado
      ? <PowerOff className="h-4 w-4" aria-hidden="true" />
      : <Power className="h-4 w-4" aria-hidden="true" />;

  return (
    <div className="flex min-w-0 flex-col items-start gap-1.5 sm:items-end">
      {estado.ligado ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" disabled={bloqueado} className="max-sm:w-full">
              {icone}
              {salvando ? 'Desligando…' : 'Desligar o robô'}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <PowerOff className="h-5 w-5 text-destructive" aria-hidden="true" />
                Desligar o robô de lances?
              </AlertDialogTitle>
              <AlertDialogDescription>{TEXTO_DESLIGAR}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={desligar}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Desligar o robô
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : (
        <Button variant="outline" disabled={bloqueado} onClick={ligar} className="max-sm:w-full">
          {icone}
          {salvando ? 'Ligando…' : 'Ligar o robô'}
        </Button>
      )}

      {nota && (
        <p className="g-meta inline-flex flex-wrap items-center gap-2 text-muted-foreground">
          {nota}
          {estado.erro && aoTentarLerDeNovo && (
            <button
              type="button"
              onClick={aoTentarLerDeNovo}
              className="inline-flex items-center gap-1 rounded-sm text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RotateCw className="h-3 w-3" aria-hidden="true" />
              Ler de novo
            </button>
          )}
        </p>
      )}
      {ultimaParada && (
        <p role="status" className="g-meta text-muted-foreground">
          {ultimaParada}
        </p>
      )}
    </div>
  );
}
