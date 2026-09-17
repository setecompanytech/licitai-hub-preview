import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Crosshair, Info } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PARAMETRO_DA_VOLTA, botaoDaVolta } from '@/lib/robo/volta-para-o-robo';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import AbasGestao, { type AbaGestao } from '@/components/gestao/AbasGestao';
import { AvisoDeContexto } from '@/components/gestao/SeloSituacao';
import { useAbaNaUrl } from '@/lib/navegacao/aba-na-url';
import AgenteExternoConfig from '@/components/robo-lances/AgenteExternoConfig';
import PortalHealthcheck from '@/components/robo-lances/PortalHealthcheck';
import AtivacaoChecklist from '@/components/robo-lances/AtivacaoChecklist';
import PedidoDoRobo from '@/components/robo-lances/PedidoDoRobo';
import VncWebViewer from '@/components/robo-lances/VncWebViewer';
import AcessoManualPortal from '@/components/robo-lances/AcessoManualPortal';
import SessoesDoRobo from '@/components/robo-lances/SessoesDoRobo';
import AuditTrailViewer from '@/components/robo-lances/AuditTrailViewer';
import DisputaRealtimePanel from '@/components/robo-lances/DisputaRealtimePanel';
import DiagnosticoDeSessoes from '@/components/admin-robo/DiagnosticoDeSessoes';
import RegistroDeChamadas from '@/components/admin-robo/RegistroDeChamadas';
import GestorDeAvisos from '@/components/admin-robo/GestorDeAvisos';
import HistoricoDoRobo from '@/components/admin-robo/HistoricoDoRobo';

/**
 * Admin Praefectus › Robô de Lances — a operação do robô, fora da tela do cliente.
 *
 * Até 14/09/2026 a tela do cliente mostrava endereço e versão do agente, RAM,
 * slots, teste do freio, a tela remota e o erro técnico cru do portal. Nada
 * disso é decisão de quem assina: o cliente liga e desliga o robô da empresa,
 * informa o próprio acesso aos portais e lê avisos escritos por gente. O resto
 * é da Praefectus, e mora aqui.
 *
 * Os componentes técnicos são os MESMOS que estavam na tela do cliente,
 * reaproveitados sem cópia — uma segunda versão de cada um envelheceria
 * diferente da primeira. O que é novo nasce em `components/admin-robo/`:
 * diagnóstico entre empresas, registro de chamadas e avisos aos clientes.
 *
 * ─── O que ainda não é "entre empresas" ─────────────────────────────────────
 *
 * Vários reaproveitados foram escritos para a conta de quem está logado
 * (`eq('user_id', user.id)` na configuração do agente e na trilha de
 * auditoria; filtro por usuário no tempo real). Aqui eles mostram o que são:
 * a visão da conta do operador. A leitura de todas as empresas é a aba
 * Diagnóstico — e a tela diz isso onde a diferença importa.
 *
 * ─── A trava não mora aqui ──────────────────────────────────────────────────
 *
 * Quem barra é o `AdminGuard` da rota (App.tsx) e, de verdade, a RLS com
 * `has_role(auth.uid(), 'admin')`. Esta tela não repete a checagem.
 */

const ABAS: AbaGestao[] = [
  { valor: 'agente', rotulo: 'Agente e infraestrutura' },
  { valor: 'sessoes', rotulo: 'Sessões e tela remota' },
  { valor: 'diagnostico', rotulo: 'Diagnóstico' },
  { valor: 'avisos', rotulo: 'Avisos aos clientes' },
  // O valor continua `auditoria`: links antigos (?aba=auditoria) caem na aba certa.
  { valor: 'auditoria', rotulo: 'Histórico do robô' },
];

const ABA_PADRAO = 'agente';

function NotaDaPlataforma({ children }: { children: ReactNode }) {
  return (
    <div className="g-cartao flex items-start gap-3 px-4 py-3">
      <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <p className="g-corpo min-w-0 text-muted-foreground">{children}</p>
    </div>
  );
}

export default function AdminRoboLances() {
  const [abaNaUrl, definirAba] = useAbaNaUrl(ABA_PADRAO);
  // `?aba=` digitado à mão ou de um link velho não deixa a tela em branco.
  const aba = ABAS.some((a) => a.valor === abaNaUrl) ? abaNaUrl : ABA_PADRAO;

  // Contador, não booleano: é o contrato do `VncWebViewer` — cada incremento é
  // um pedido para abrir, e o segundo pedido seguido também precisa abrir.
  const [pedidoDeTelaRemota, setPedidoDeTelaRemota] = useState(0);
  const abrirTelaRemota = useCallback(() => setPedidoDeTelaRemota((n) => n + 1), []);

  // `?tela=abrir` (17/09/2026): o aviso "Assistir o robô ao vivo" chega aqui já
  // pedindo a tela remota. O parâmetro sai da URL depois de usado, para um F5
  // não reabrir a tela sem ninguém pedir.
  const [parametros, definirParametros] = useSearchParams();
  const pedeTela = parametros.get('tela') === 'abrir';

  // `?voltar=` fica na URL: é o que faz o botão do topo dizer "Voltar para o
  // robô" nesta visita e voltar ao "Ir para o Robô de Lances" na próxima, se a
  // pessoa chegar aqui pelo menu. Regra em `lib/robo/volta-para-o-robo.ts`.
  const volta = botaoDaVolta(parametros.get(PARAMETRO_DA_VOLTA));
  useEffect(() => {
    if (!pedeTela) return;
    abrirTelaRemota();
    const sem = new URLSearchParams(parametros);
    sem.delete('tela');
    definirParametros(sem, { replace: true });
  }, [pedeTela, parametros, definirParametros, abrirTelaRemota]);

  return (
    <AppLayout>
      <CabecalhoPagina
        rota="/admin/robo-lances"
        denso
        acoes={
          <Button
            asChild
            variant={volta.destacado ? 'default' : 'outline'}
            title={volta.descricao}
            className={cn('gap-2', volta.destacado && 'animate-piscar-verde')}
          >
            <Link to={volta.para}>
              {volta.destacado
                ? <ArrowLeft aria-hidden="true" />
                : <Crosshair aria-hidden="true" />}
              {volta.rotulo}
            </Link>
          </Button>
        }
      />

      <div className="flex min-w-0 flex-col gap-4">
        <AbasGestao abas={ABAS} valor={aba} aoMudar={definirAba} />

        {aba === 'agente' && (
          <div className="flex min-w-0 flex-col gap-4">
            <NotaDaPlataforma>
              A configuração desta aba é da plataforma: o agente, a saúde dos portais e a prontidão do
              robô. O cliente vê apenas se o robô está disponível para o portal dele.
            </NotaDaPlataforma>
            <div className="grid min-w-0 gap-4 xl:grid-cols-2">
              <div className="min-w-0">
                <AgenteExternoConfig />
              </div>
              <div className="min-w-0">
                <PortalHealthcheck />
              </div>
            </div>
            <AtivacaoChecklist modo="plataforma" />
          </div>
        )}

        {aba === 'sessoes' && (
          <div className="flex min-w-0 flex-col gap-4">
            <AvisoDeContexto titulo="A tela remota é compartilhada entre todas as empresas">
              O navegador remoto roda no mesmo servidor para todos os clientes: quem abre vê qualquer
              sessão em operação naquele momento. Nunca mostre esta tela, nem o endereço dela, a um
              cliente.
            </AvisoDeContexto>
            <PedidoDoRobo permitirTelaRemota onAbrirTelaRemota={abrirTelaRemota} />
            <VncWebViewer abrirEm={pedidoDeTelaRemota} />
            <AcessoManualPortal />
            <SessoesDoRobo />
          </div>
        )}

        {aba === 'diagnostico' && (
          <div className="flex min-w-0 flex-col gap-8">
            <DiagnosticoDeSessoes />
            <RegistroDeChamadas />
          </div>
        )}

        {aba === 'avisos' && <GestorDeAvisos />}

        {aba === 'auditoria' && (
          <div className="flex min-w-0 flex-col gap-4">
            {/* O que o robô fez e avisou, em todas as empresas, por 12 meses —
                o sininho guarda o aviso do robô só por 24 horas (17/09/2026). */}
            <HistoricoDoRobo />
            <NotaDaPlataforma>
              A trilha de auditoria e os eventos em tempo real ainda leem só os registros da sua própria
              conta. A leitura de todas as empresas está na aba Diagnóstico.
            </NotaDaPlataforma>
            <div className="grid min-w-0 gap-4 xl:grid-cols-2">
              <div className="min-w-0">
                <AuditTrailViewer />
              </div>
              <div className="min-w-0">
                <DisputaRealtimePanel />
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
