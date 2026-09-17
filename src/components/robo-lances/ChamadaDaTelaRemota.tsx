import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, MonitorPlay, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useUserRole } from '@/hooks/useUserRole';
import {
  LINK_DA_TELA_REMOTA, SEGUNDOS_DA_CHAMADA, fecharChamadaDaTelaRemota, sessaoParou, useChamadaDaTelaRemota,
  type ChamadaDaTelaRemota as Chamada,
} from '@/lib/robo/chamada-da-tela-remota';

const PASSO_MS = 250;
const CONFERIR_SESSAO_MS = 5_000;

const ROTULO_DO_MOTIVO: Record<Chamada['motivo'], string> = {
  entrando: 'Robô de Lances · entrando agora',
  captcha: 'Robô de Lances · precisa de um clique',
  'ao-vivo': 'Robô de Lances · na sala',
};

/**
 * O toast grande da tela remota, embaixo e no centro (17/09/2026, pedido do
 * Ian): aparece no clique de "Entrar agora" e quando o robô pede o captcha ou
 * entra na sala; leva a Configurações do Robô de Lances › Sessões e tela
 * remota, já abrindo a tela. Some quando o robô para, depois de
 * `SEGUNDOS_DA_CHAMADA` (o mouse em cima e a aba escondida seguram a contagem)
 * ou no fechar. Regras em `lib/robo/chamada-da-tela-remota.ts`.
 *
 * Só a equipe Praefectus vê: a tela remota é compartilhada entre as empresas.
 * Cores da superfície navy do rebranding (a família `sidebar`, pensada para os
 * dois temas), com o verde da marca no botão.
 */
export default function ChamadaDaTelaRemota() {
  const chamada = useChamadaDaTelaRemota();
  const { isSystemAdmin } = useUserRole();
  if (!chamada || !isSystemAdmin || typeof document === 'undefined') return null;
  return createPortal(<CaixaDaChamada key={chamada.id} chamada={chamada} />, document.body);
}

function CaixaDaChamada({ chamada }: { chamada: Chamada }) {
  const navigate = useNavigate();
  const total = SEGUNDOS_DA_CHAMADA * 1000;
  const [restante, setRestante] = useState(total);
  const [comMouse, setComMouse] = useState(false);
  const [abaEscondida, setAbaEscondida] = useState(() => document.hidden);

  const fechar = useCallback(() => fecharChamadaDaTelaRemota(chamada.id), [chamada.id]);

  useEffect(() => {
    const aoMudar = () => setAbaEscondida(document.hidden);
    document.addEventListener('visibilitychange', aoMudar);
    return () => document.removeEventListener('visibilitychange', aoMudar);
  }, []);

  useEffect(() => {
    if (comMouse || abaEscondida) return;
    const id = window.setInterval(() => setRestante((r) => r - PASSO_MS), PASSO_MS);
    return () => window.clearInterval(id);
  }, [comMouse, abaEscondida]);

  useEffect(() => {
    if (restante <= 0) fechar();
  }, [restante, fechar]);

  // O robô parou? Some junto (só com a disputa conhecida, e só sessão nova).
  useEffect(() => {
    if (!chamada.disputaId) return;
    let vivo = true;
    const conferir = async () => {
      // `types.ts` não conhece `parada_confirmada_em` em sessoes_lance_real.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q = (supabase as any)
        .from('sessoes_lance_real')
        .select('status, parada_confirmada_em')
        .eq('lance_config_id', chamada.disputaId)
        .order('created_at', { ascending: false })
        .limit(1);
      if (chamada.sessaoDesde) q = q.gte('created_at', chamada.sessaoDesde);
      const { data } = await q;
      if (vivo && sessaoParou((data ?? [])[0])) fechar();
    };
    const id = window.setInterval(() => void conferir(), CONFERIR_SESSAO_MS);
    return () => {
      vivo = false;
      window.clearInterval(id);
    };
  }, [chamada.disputaId, chamada.sessaoDesde, fechar]);

  const abrir = () => {
    fechar();
    navigate(LINK_DA_TELA_REMOTA);
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
      <section
        aria-label="Tela remota do robô"
        aria-live="polite"
        onMouseEnter={() => setComMouse(true)}
        onMouseLeave={() => setComMouse(false)}
        onFocus={() => setComMouse(true)}
        onBlur={() => setComMouse(false)}
        className="pointer-events-auto relative w-full max-w-2xl overflow-hidden rounded-2xl border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-2xl animate-in fade-in-0 slide-in-from-bottom-4 duration-300"
      >
        <div className="flex items-start gap-4 p-5 sm:p-6">
          <span
            aria-hidden="true"
            className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-sidebar-accent text-gold-logo"
          >
            <MonitorPlay className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold uppercase tracking-wide text-gold-logo">{ROTULO_DO_MOTIVO[chamada.motivo]}</p>
            <h2 className="mt-1 text-xl font-semibold leading-tight text-sidebar-accent-foreground">{chamada.titulo}</h2>
            {chamada.mensagem && <p className="mt-2 text-base leading-relaxed">{chamada.mensagem}</p>}
            {/* Em tela estreita os dois botões ocupam a linha inteira: o
                "Agora não" quebrava com o recuo do próprio botão e saía
                desalinhado do principal (print de 17/09). */}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
              <Button
                onClick={abrir}
                className="h-12 w-full gap-2 bg-sidebar-primary px-5 text-base font-semibold text-sidebar-primary-foreground hover:bg-sidebar-primary/90 sm:w-auto"
              >
                Abrir a tela remota <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                onClick={fechar}
                className="h-12 w-full px-4 text-base text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground sm:w-auto"
              >
                Agora não
              </Button>
            </div>
            <p className="mt-3 text-sm opacity-80">
              Abre em Configurações do Robô de Lances › Sessões e tela remota. Só a equipe Praefectus vê a tela remota.
            </p>
          </div>
          <button
            type="button"
            onClick={fechar}
            aria-label="Fechar o aviso da tela remota"
            className="rounded-lg p-2 text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="h-1.5 bg-sidebar-accent" aria-hidden="true">
          <div
            className="h-full bg-sidebar-primary transition-[width] duration-200 ease-linear"
            style={{ width: `${Math.max(0, (restante / total) * 100)}%` }}
          />
        </div>
      </section>
    </div>
  );
}
