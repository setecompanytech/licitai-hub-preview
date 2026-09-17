import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, MonitorPlay, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useUserRole } from '@/hooks/useUserRole';
import {
  SEGUNDOS_DA_CHAMADA, fecharChamadaDaTelaRemota, sessaoParou, useChamadaDaTelaRemota,
  type ChamadaDaTelaRemota as Chamada,
} from '@/lib/robo/chamada-da-tela-remota';
import { linkDaTelaRemotaDe, origemDaChamada } from '@/lib/robo/volta-para-o-robo';

const PASSO_MS = 250;
const CONFERIR_SESSAO_MS = 5_000;

const ROTULO_DO_MOTIVO: Record<Chamada['motivo'], string> = {
  entrando: 'Robô de Lances · entrando agora',
  captcha: 'Robô de Lances · precisa de um clique',
  'ao-vivo': 'Robô de Lances · na sala',
};

/**
 * O toast da tela remota, embaixo e no centro (17/09/2026, pedido do Ian):
 * aparece no clique de "Entrar agora" e quando o robô pede o captcha ou
 * entra na sala; leva a Configurações do Robô de Lances › Sessões e tela
 * remota, já abrindo a tela. Some quando o robô para, depois de
 * `SEGUNDOS_DA_CHAMADA` (o mouse em cima e a aba escondida seguram a contagem)
 * ou no fechar. Regras em `lib/robo/chamada-da-tela-remota.ts`.
 *
 * Só a equipe Praefectus vê: a tela remota é compartilhada entre as empresas.
 *
 * Cores: branco com verde, as predominantes do sistema (Ian, 17/09/2026 — a
 * primeira versão saiu na superfície navy e ficou fora do tom das telas). Tudo
 * em token, então o tema escuro troca a superfície sozinho.
 *
 * O botão leva de onde a pessoa saiu (`linkDaTelaRemotaDe`): no admin ela
 * encontra "Voltar para o robô" apontando para esta mesma tela.
 */
export default function ChamadaDaTelaRemota() {
  const chamada = useChamadaDaTelaRemota();
  const { isSystemAdmin } = useUserRole();
  if (!chamada || !isSystemAdmin || typeof document === 'undefined') return null;
  return createPortal(<CaixaDaChamada key={chamada.id} chamada={chamada} />, document.body);
}

function CaixaDaChamada({ chamada }: { chamada: Chamada }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
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
    // A tela de onde a pessoa saiu viaja no link: é ela que o botão "Voltar
    // para o robô" do admin usa.
    navigate(linkDaTelaRemotaDe(origemDaChamada(chamada, pathname)));
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
        className="pointer-events-auto relative w-full max-w-xl overflow-hidden rounded-xl border border-primary/30 bg-card text-foreground shadow-xl animate-in fade-in-0 slide-in-from-bottom-4 duration-300"
      >
        {/* A faixa verde na lateral: o toast é branco, e o verde é o que o
            identifica de longe. */}
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-primary" />
        <div className="flex items-start gap-3 p-4 pl-5">
          <span
            aria-hidden="true"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary-tint text-primary"
          >
            <MonitorPlay className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">{ROTULO_DO_MOTIVO[chamada.motivo]}</p>
            <h2 className="mt-0.5 text-lg font-semibold leading-tight text-foreground">{chamada.titulo}</h2>
            {chamada.mensagem && <p className="mt-1.5 text-sm leading-relaxed">{chamada.mensagem}</p>}
            {/* Em tela estreita os dois botões ocupam a linha inteira: o
                "Agora não" quebrava com o recuo do próprio botão e saía
                desalinhado do principal (print de 17/09). */}
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <Button onClick={abrir} className="h-10 w-full gap-2 sm:w-auto">
                Abrir a tela remota <ArrowRight aria-hidden="true" />
              </Button>
              <Button variant="ghost" onClick={fechar} className="h-10 w-full text-muted-foreground sm:w-auto">
                Agora não
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Abre em Configurações do Robô de Lances, com atalho de volta para cá. Só a equipe Praefectus vê a tela
              remota.
            </p>
          </div>
          <button
            type="button"
            onClick={fechar}
            aria-label="Fechar o aviso da tela remota"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="h-1 bg-muted" aria-hidden="true">
          <div
            className="h-full bg-primary transition-[width] duration-200 ease-linear"
            style={{ width: `${Math.max(0, (restante / total) * 100)}%` }}
          />
        </div>
      </section>
    </div>
  );
}
