import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, Edit2, RefreshCw, SearchX } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { useRegistrarTrilha } from '@/components/layout/contexto-trilha';
import AbasGestao from '@/components/gestao/AbasGestao';
import { AvisoDeFalha } from '@/components/gestao/SeloSituacao';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import ConfigurarLanceDialog, { type LanceConfig } from '@/components/robo-lances/ConfigurarLanceDialog';
import PedidoDoRobo from '@/components/robo-lances/PedidoDoRobo';
import { usePedidosDoRobo } from '@/components/robo-lances/usePedidosDoRobo';
import type { ResultadoDoFreio } from '@/components/robo-lances/KillSwitchButton';
import { useRoboDaEmpresa } from '@/components/robo-lances/cliente/useRoboDaEmpresa';
import { useSituacaoDoRobo } from '@/components/robo-lances/cliente/useSituacaoDoRobo';
import { useModoDeOperacao } from '@/components/robo-lances/cliente/useModoDeOperacao';
import AcoesDaDisputa from '@/components/robo-lances/disputa/AcoesDaDisputa';
import AcompanhamentoDaDisputa from '@/components/robo-lances/disputa/AcompanhamentoDaDisputa';
import CabecalhoDaDisputa from '@/components/robo-lances/disputa/CabecalhoDaDisputa';
import CompraDaDisputa from '@/components/robo-lances/disputa/CompraDaDisputa';
import ContextoDaDisputa from '@/components/robo-lances/disputa/ContextoDaDisputa';
import EstrategiaDaDisputa from '@/components/robo-lances/disputa/EstrategiaDaDisputa';
import ItensDaDisputa from '@/components/robo-lances/disputa/ItensDaDisputa';
import type { AbaDosEventos } from '@/components/robo-lances/disputa/EventosDaDisputa';
import { SituacaoDaParada } from '@/components/robo-lances/disputa/ParadaDaSessao';
import { enderecoDaLista } from '@/components/robo-lances/disputa/disputa-do-robo';
import { useDisputaDoRobo } from '@/components/robo-lances/disputa/useDisputaDoRobo';
import { useEnviarAoRobo } from '@/components/robo-lances/disputa/useEnviarAoRobo';
import { lerParada, sessaoEmAndamento, useParadaDaSessao } from '@/components/robo-lances/disputa/useParadaDaSessao';
import { useSalvarDisputa } from '@/components/robo-lances/disputa/useSalvarDisputa';
import { useVersaoVinculada } from '@/components/workspace/robo/consultas';
import { horaDeBrasilia } from '@/components/workspace/robo/formatos';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { usePapelEmpresa } from '@/hooks/usePapelEmpresa';
import { useProcessoAtivo } from '@/hooks/useProcessoAtivo';
import { useAbaNaUrl } from '@/lib/navegacao/aba-na-url';

/**
 * Uma disputa do robô, em página própria — `/robo-lances/disputa/:id`.
 *
 * ── Por que existe (14/09/2026) ─────────────────────────────────────────────
 *
 * A reclamação do dono do produto, sobre a produção a 1.710 px: "muitas
 * informações em uma página só", "as abas Configuradas e Em disputa repetem as
 * mesmas informações", "quebras de textos". A lista do robô desenhava, embaixo
 * de QUALQUER aba, o mesmo bloco "Ferramentas da disputa" em três colunas — a
 * lista de sessões repetindo a tabela, a disputa espremida numa coluna estreita
 * (a tabela de itens saía uma letra por linha) e uma coluna de controle. Trocar
 * de aba não mudava quase nada.
 *
 * Agora a lista é só lista, e cada disputa abre aqui, com a largura inteira e
 * três perguntas separadas por aba — o que se disputa e até quanto (Itens e
 * limites) · com que regra (Estratégia) · o que está acontecendo
 * (Acompanhamento). A aba mora na URL: o F5 e o link compartilhado caem nela.
 *
 * O "Painel de Risco" não veio junto: mostrava uma "faixa ideal" de 65/75/85% do
 * valor de referência e uma "Sugestão" — percentuais inventados. Limite, na
 * Praefectus, vem da precificação aprovada.
 *
 * ── Nada implícito ──────────────────────────────────────────────────────────
 *
 * Abrir, trocar de aba ou sair desta página não inicia nem para o robô. As
 * ordens ao serviço são "Enviar ao robô" e "Parar robô nesta disputa", por
 * clique — a segunda com confirmação.
 */

type AbaDaDisputa = 'itens' | 'estrategia' | 'acompanhamento';
const ABAS_DA_DISPUTA: AbaDaDisputa[] = ['itens', 'estrategia', 'acompanhamento'];
const abaValida = (valor: string): AbaDaDisputa =>
  (ABAS_DA_DISPUTA as string[]).includes(valor) ? (valor as AbaDaDisputa) : 'itens';

export default function RoboLancesDisputa() {
  // A trilha é registrada DENTRO do `AppLayout`: é ele quem provê o contexto dela.
  return (
    <AppLayout>
      <TelaDaDisputa />
    </AppLayout>
  );
}

function TelaDaDisputa() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const voltarPara = enderecoDaLista(location.state);
  const { empresaAtiva } = useEmpresa();
  const { podeOperar } = usePapelEmpresa();
  const { processoId } = useProcessoAtivo();
  const [abaNaUrl, definirAba] = useAbaNaUrl('itens');
  const aba = abaValida(abaNaUrl);

  const disputa = useDisputaDoRobo(id);
  const { linha, lance, participacao, recarregar } = disputa;
  // O robô, a situação e o envio são da empresa DONA da disputa.
  const empresaId = linha?.empresa_id ?? empresaAtiva?.id ?? null;

  const [abaDosEventos, setAbaDosEventos] = useState<AbaDosEventos>('mural');
  const [gatilhoDosEventos, setGatilhoDosEventos] = useState(0);
  const [paradaEmergencial, setParadaEmergencial] = useState(false);
  const [versaoDoFormulario, setVersaoDoFormulario] = useState(0);

  const modo = useModoDeOperacao();
  const roboDaEmpresa = useRoboDaEmpresa(empresaId);
  const { situacao: situacaoDoRobo } = useSituacaoDoRobo(empresaId);
  const envio = useEnviarAoRobo({
    empresaId,
    estadoDoRobo: roboDaEmpresa.estado,
    relerLigado: roboDaEmpresa.recarregar,
    portaisSuportados: situacaoDoRobo?.portais_suportados,
    nivel: modo.nivel,
    aoAceitar: () => {
      setGatilhoDosEventos((n) => n + 1);
      void recarregar();
    },
  });
  const salvarDisputa = useSalvarDisputa();
  const { data: estadoDoAgente } = usePedidosDoRobo();
  const sessao = participacao?.sessao ?? null;
  const parada = useParadaDaSessao(sessao?.id ?? null, recarregar);
  const versao = useVersaoVinculada(linha?.precificacao_versao_id ?? null);

  // A sessão que o agente diz estar de pé para este edital — é ela que confere
  // os itens e que o freio de emergência alcança.
  const sessaoViva = lance ? (estadoDoAgente?.sessoesVivas || []).find((sv) => sv.edital === lance.edital) ?? null : null;
  const idSessao = sessao?.id ?? null;
  const idSessaoViva = sessaoViva?.sessao_id ?? null;
  const sessoesDestaDisputa = useMemo(
    () => [idSessao, idSessaoViva].filter((v): v is string => !!v),
    [idSessao, idSessaoViva],
  );

  const titulo = participacao?.processo?.numero || lance?.edital || 'Disputa';
  useRegistrarTrilha([
    { rotulo: 'Gestão de Processos' },
    { rotulo: 'Robô de lances', para: voltarPara },
    {
      rotulo:
        disputa.estado === 'pronta' ? titulo : disputa.estado === 'nao_encontrada' ? 'Disputa não encontrada' : 'Disputa',
    },
  ]);

  if (disputa.estado === 'carregando') {
    return (
      <div role="status" aria-busy="true" className="flex min-w-0 flex-col gap-4">
        <span className="sr-only">Carregando a disputa…</span>
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-64 max-w-full" />
        <Skeleton className="h-6 w-80 max-w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (disputa.estado === 'erro') {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        <h1 className="g-titulo-pagina text-foreground">Não conseguimos carregar esta disputa</h1>
        <div className="g-cartao">
          <EstadoVazio
            icone={<AlertTriangle />}
            titulo="Falha ao carregar a disputa"
            descricao={`A disputa pode existir — foi a consulta que não voltou. ${disputa.erro ?? ''}`}
            acao={
              <>
                <Button onClick={() => void recarregar()}>
                  <RefreshCw className="h-4 w-4" aria-hidden="true" /> Tentar novamente
                </Button>
                <Button asChild variant="outline">
                  <Link to={voltarPara}>Voltar ao robô de lances</Link>
                </Button>
              </>
            }
          />
        </div>
      </div>
    );
  }

  if (disputa.estado === 'nao_encontrada' || !lance || !linha) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        <h1 className="g-titulo-pagina text-foreground">Disputa não encontrada</h1>
        <div className="g-cartao">
          <EstadoVazio
            icone={<SearchX />}
            titulo="Este endereço não leva a uma disputa desta conta"
            descricao="Ela pode ter sido removida, ou pertencer a uma empresa a que você não tem acesso."
            acao={
              <Button asChild variant="outline">
                <Link to={voltarPara}>Voltar ao robô de lances</Link>
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  const leituraDaParada = lerParada(sessao, participacao?.projecao.estadoDoRobo ?? 'sem_sessao', parada.pedido);

  const aoSalvar = async (editada: LanceConfig) => {
    const ok = await salvarDisputa(editada, { nova: false, empresaId: linha.empresa_id });
    if (!ok) return;
    await recarregar();
    // O diálogo guarda o formulário desde a montagem; remontá-lo depois da
    // releitura faz a próxima edição partir do que está gravado agora.
    setVersaoDoFormulario((v) => v + 1);
  };

  const aoParadaEmergencial = (resultado?: ResultadoDoFreio) => {
    // O freio já pediu a parada de TODAS as sessões e já disse, sessão por
    // sessão, o que o agente confirmou. Aqui só se relê.
    setParadaEmergencial(resultado?.confirmada === true);
    void recarregar();
  };

  const horaDaLeitura = horaDeBrasilia(disputa.lidoEm);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <CabecalhoDaDisputa
        lance={lance}
        participacao={participacao}
        situacaoPendente={disputa.situacaoPendente}
        leituraDaParada={leituraDaParada}
        parada={parada}
        emAndamento={sessaoEmAndamento(leituraDaParada)}
        podeOperar={podeOperar}
        nivel={modo.nivel}
        enviando={envio.enviando}
        aoEnviar={() => void envio.enviar(lance)}
        voltarPara={voltarPara}
        editar={
          podeOperar ? (
            <ConfigurarLanceDialog
              key={`${lance.id}:${versaoDoFormulario}`}
              processoAtivoId={processoId}
              editingLance={lance}
              onSave={aoSalvar}
              trigger={
                <Button variant="outline" className="g-controle">
                  <Edit2 className="h-4 w-4" aria-hidden="true" /> Editar parâmetros
                </Button>
              }
            />
          ) : null
        }
        acoes={
          <AcoesDaDisputa
            lance={lance}
            nivel={modo.nivel}
            aoAlterar={() => void recarregar()}
            aoEncerrar={() => {
              setAbaDosEventos('mural');
              definirAba('acompanhamento');
              void recarregar();
            }}
            aoRemover={() => navigate(voltarPara)}
          />
        }
      />

      <ContextoDaDisputa
        linha={linha}
        lance={lance}
        versao={versao}
        capacidade={disputa.capacidade}
        participacao={participacao}
      />

      <CompraDaDisputa lance={lance} />

      <SituacaoDaParada leitura={leituraDaParada} parada={parada} />

      {disputa.erroDaSituacao && participacao && (
        <AvisoDeFalha aoTentarNovamente={() => void recarregar()}>
          A última atualização da situação falhou: {disputa.erroDaSituacao}.
          {horaDaLeitura ? ` Os dados são da leitura das ${horaDaLeitura} • horário de Brasília.` : ''}
        </AvisoDeFalha>
      )}

      {/* O robô parado esperando um código que o portal mandou à empresa. O
          código vale segundos, então o pedido fica acima das abas — visível de
          qualquer uma. Só os pedidos das sessões DESTA disputa; sem pedido, não
          desenha nada. */}
      <PedidoDoRobo sessaoIds={sessoesDestaDisputa} />

      <AbasGestao
        abas={[
          { valor: 'itens', rotulo: 'Itens e limites', contagem: lance.itens.length },
          { valor: 'estrategia', rotulo: 'Estratégia' },
          { valor: 'acompanhamento', rotulo: 'Acompanhamento' },
        ]}
        valor={aba}
        aoMudar={definirAba}
      />

      {aba === 'itens' && (
        <ItensDaDisputa
          lance={lance}
          linha={linha}
          sessao={sessao}
          sessaoViva={sessaoViva}
          gatilho={disputa.lidoEm ? disputa.lidoEm.getTime() : 0}
        />
      )}

      {aba === 'estrategia' && <EstrategiaDaDisputa lance={lance} modo={modo} podeOperar={podeOperar} />}

      {aba === 'acompanhamento' && (
        <AcompanhamentoDaDisputa
          lance={lance}
          participacao={participacao}
          situacaoPendente={disputa.situacaoPendente}
          erroDaSituacao={disputa.erroDaSituacao}
          recarregar={recarregar}
          parada={parada}
          sessaoViva={sessaoViva}
          desfechos={estadoDoAgente?.desfechos || []}
          paradaEmergencial={paradaEmergencial}
          aoParadaEmergencial={aoParadaEmergencial}
          abaDosEventos={abaDosEventos}
          aoMudarAbaDosEventos={setAbaDosEventos}
          gatilhoDosEventos={gatilhoDosEventos}
        />
      )}
    </div>
  );
}
