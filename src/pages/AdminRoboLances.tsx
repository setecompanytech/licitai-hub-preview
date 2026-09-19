import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Crosshair, Info } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PARAMETRO_DA_VOLTA, botaoDaVolta } from '@/lib/robo/volta-para-o-robo';
import { useContaDeEngenharia } from '@/hooks/useContaDeEngenharia';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import AbasGestao, { type AbaGestao } from '@/components/gestao/AbasGestao';
import { AvisoDeContexto } from '@/components/gestao/SeloSituacao';
import { useAbaNaUrl } from '@/lib/navegacao/aba-na-url';
import AgenteExternoConfig from '@/components/robo-lances/AgenteExternoConfig';
import PortalHealthcheck from '@/components/robo-lances/PortalHealthcheck';
import PedidoDoRobo from '@/components/robo-lances/PedidoDoRobo';
import VncWebViewer from '@/components/robo-lances/VncWebViewer';
import AcessoManualPortal from '@/components/robo-lances/AcessoManualPortal';
import SessoesDoRobo from '@/components/robo-lances/SessoesDoRobo';
import SkeletonPagina from '@/components/shared/SkeletonPagina';
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
 * ─── Operação × oficina técnica (19/09/2026) ────────────────────────────────
 *
 * O Rafael viu esta tela logado como GRUPO SANTA ROSA (CNPJ dele, e o login
 * com que ele opera o robô) e chamou de "poluição visual" os cartões técnicos:
 * agente, RAM, portais no ar, checklist. Ele não pediu para tirar a tela
 * remota nem o captcha — é a operação que ele faz toda manhã. Então a página
 * se divide por NATUREZA, e não por conta:
 *
 *   operação (todo admin da plataforma) — Sessões e tela remota, Avisos aos
 *     clientes, Histórico do robô. Sem segunda conta no dia a dia;
 *   oficina técnica (só a conta de engenharia, `engsoft@`: admin sem empresa,
 *     `lib/conta-de-engenharia.ts`) — Agente e infraestrutura, Diagnóstico.
 *
 * Quem barra a rota é o `AdminGuard` (App.tsx); o corte da oficina é aqui, por
 * aba, e no banco (`sou_conta_de_engenharia()` em `agente_externo_config` e
 * `webhook_log`, migrations 20260919000006/000007).
 *
 * Os painéis que liam a conta logada — o checklist de ativação (de uma
 * empresa), a trilha de auditoria e o tempo real — saíram. A trilha dos
 * clientes NÃO foi aberta à plataforma: guarda valores de lance e ações de
 * cada cliente.
 */

const ABAS: AbaGestao[] = [
  { valor: 'agente', rotulo: 'Agente e infraestrutura' },
  { valor: 'sessoes', rotulo: 'Sessões e tela remota' },
  { valor: 'diagnostico', rotulo: 'Diagnóstico' },
  { valor: 'avisos', rotulo: 'Avisos aos clientes' },
  // O valor continua `auditoria`: links antigos (?aba=auditoria) caem na aba certa.
  { valor: 'auditoria', rotulo: 'Histórico do robô' },
];

/** A oficina técnica: só a conta de engenharia vê estas abas (ver o cabeçalho). */
const ABAS_DA_ENGENHARIA = new Set(['agente', 'diagnostico']);

function NotaDaPlataforma({ children }: { children: ReactNode }) {
  return (
    <div className="g-cartao flex items-start gap-3 px-4 py-3">
      <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <p className="g-corpo min-w-0 text-muted-foreground">{children}</p>
    </div>
  );
}

export default function AdminRoboLances() {
  // A oficina técnica é da conta de engenharia; a operação, de todo admin.
  // A aba padrão é a primeira visível: Agente para a engenharia, Sessões para
  // quem opera — e `?aba=agente` na mão de quem não é da engenharia cai nela.
  const { ehContaDeEngenharia, carregando: carregandoConta } = useContaDeEngenharia();
  const abasVisiveis = ehContaDeEngenharia ? ABAS : ABAS.filter((a) => !ABAS_DA_ENGENHARIA.has(a.valor));
  const abaPadrao = abasVisiveis[0].valor;
  const [abaNaUrl, definirAba] = useAbaNaUrl(abaPadrao);
  // `?aba=` digitado à mão ou de um link velho não deixa a tela em branco.
  const aba = abasVisiveis.some((a) => a.valor === abaNaUrl) ? abaNaUrl : abaPadrao;

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

  // Sem o papel lido, a lista de abas ainda não é a certa: esqueleto, em vez
  // de mostrar Sessões e pular para Agente um instante depois. Depois de todos
  // os hooks — return antecipado antes deles é a tela branca de 02/09.
  if (carregandoConta) return <SkeletonPagina />;

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
        <AbasGestao abas={abasVisiveis} valor={aba} aoMudar={definirAba} />

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
            <NotaDaPlataforma>
              O checklist de ativação confere o robô de uma empresa (credencial, agente, robô ligado) e por
              isso não aparece na conta de engenharia, que não tem empresa. As sessões de todas as empresas
              estão em Diagnóstico.
            </NotaDaPlataforma>
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
              A trilha de auditoria e os eventos em tempo real de cada conta saíram desta tela: o que o robô fez
              em todas as empresas está no histórico acima.
            </NotaDaPlataforma>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
