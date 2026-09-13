import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ListaDeCampos, { BlocoDoPainel } from '@/components/gestao/ListaDeCampos';
import SeloSituacao, { ValorIndisponivel } from '@/components/gestao/SeloSituacao';
import KillSwitchButton from './KillSwitchButton';
import AtivacaoChecklist from './AtivacaoChecklist';
import type { LanceConfig } from './ConfigurarLanceDialog';
import type { NivelAutomacao } from './NivelAutomacaoSelector';
import type { DesfechoDoRobo, SessaoViva } from './usePedidosDoRobo';
import {
  Activity, History, Monitor, RefreshCw, Send, ShieldCheck, Wallet, CheckCircle2,
} from 'lucide-react';

/**
 * PainelDeControle — a coluna da direita da aba Disputar.
 *
 * ─── POR QUE ESTA COLUNA EXISTE, E POR QUE EM BLOCOS SEPARADOS ─────────────
 *
 * A tela misturava seis coisas numa barra só, e elas respondem a perguntas
 * diferentes, com respostas independentes:
 *
 *   Conexão        — "o portal responde?"
 *   Autenticação   — "minhas credenciais valem?"
 *   Prontidão      — "o robô está pronto?"
 *   Limites        — "quanto posso gastar?"
 *   Estado         — "há robô de pé nesta disputa agora?"
 *   Eventos        — "o que já aconteceu?"
 *
 * Juntas, davam a impressão de um único semáforo: um verde qualquer lia como
 * "pode ir". Os três primeiros eixos vivem dentro do checklist, que os agrupa
 * com esses mesmos nomes; os três últimos são blocos daqui.
 *
 * A ORDEM É DE URGÊNCIA, não de configuração. O que pode precisar de ação
 * AGORA (parar o robô, enviar, assistir) fica no topo, onde não exige rolagem;
 * checklist e eventos são consulta.
 *
 * Esta coluna NÃO cria atalho novo de automação: todo botão aqui já existia na
 * barra da disputa, com o mesmo papel exigido e o mesmo diálogo de confirmação.
 */

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const ROTULO_NIVEL: Record<NivelAutomacao, string> = {
  1: 'Assistente',
  2: 'Semiautomático',
  3: 'Automação Controlada',
};

type Props = {
  lance: LanceConfig;
  nivel: NivelAutomacao;
  podeOperar: boolean;
  isAdmin: boolean;
  /** Limite vigente lido de `robo_aceite_termos`. 0 = nenhum aceite vigente. */
  limiteFinanceiro: number;
  /** `false` enquanto a leitura do aceite não terminou — evita afirmar "sem limite". */
  limiteCarregado: boolean;
  sessaoViva?: SessaoViva | null;
  desfechos: DesfechoDoRobo[];
  paradaEmergencial: boolean;
  enviandoAoRobo: boolean;
  destacarAssistir: boolean;
  estrategiaAutorizada: boolean;
  onEnviarAoRobo: () => void;
  onAssistir: () => void;
  onAutorizarEstrategia: () => void;
  onParadaEmergencial: () => void;
  onVerEventos: () => void;
  /** Menu "Ações" — montado na página, que é quem tem os handlers da disputa. */
  acoes: ReactNode;
};

export default function PainelDeControle({
  lance,
  nivel,
  podeOperar,
  isAdmin,
  limiteFinanceiro,
  limiteCarregado,
  sessaoViva,
  desfechos,
  paradaEmergencial,
  enviandoAoRobo,
  destacarAssistir,
  estrategiaAutorizada,
  onEnviarAoRobo,
  onAssistir,
  onAutorizarEstrategia,
  onParadaEmergencial,
  onVerEventos,
  acoes,
}: Props) {
  return (
    <div className="flex flex-col gap-6">
      {/* ── EIXO 5 · ESTADO DA SESSÃO — "há robô de pé agora?" ──────────────
          Primeiro bloco de propósito: é a única pergunta cuja resposta pode
          exigir a mão da pessoa em segundos. O freio vem com ela, e só com
          ela — botão vermelho sem nada para parar treina a pessoa a ignorá-lo. */}
      <BlocoDoPainel titulo="Estado da sessão">
        {sessaoViva ? (
          <div className="flex flex-col gap-3">
            <SeloSituacao tom="ativo" icone={Activity} explicacao="O agente confirma uma sessão de pé para este edital.">
              Robô em operação neste edital
            </SeloSituacao>
            <ListaDeCampos
              campos={[
                { rotulo: 'Situação no agente', valor: sessaoViva.status },
                { rotulo: 'Portal', valor: sessaoViva.portal_id },
              ]}
            />
            <KillSwitchButton
              sessaoId={sessaoViva.sessao_id}
              licitacaoId={lance.licitacaoId}
              onParada={onParadaEmergencial}
              disabled={paradaEmergencial}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <SeloSituacao tom="neutro" explicacao="O agente não reporta sessão de pé para este edital.">
              Nenhum robô de pé neste edital
            </SeloSituacao>
            <p className="g-meta text-muted-foreground">
              A parada de emergência aparece aqui assim que houver uma sessão para parar.
            </p>
          </div>
        )}
      </BlocoDoPainel>

      {/* ── AÇÕES DA SESSÃO ──────────────────────────────────────────────────
          Saíram da barra do centro para cá porque a referência aprovada pede
          "checklist e ações à direita". Comportamento idêntico: mesmo papel
          exigido (`podeOperar`), mesmos diálogos, mesmos avisos. */}
      <BlocoDoPainel titulo="Ações">
        <div className="flex flex-col gap-2">
          {podeOperar ? (
            <>
              <Button
                onClick={onEnviarAoRobo}
                disabled={enviandoAoRobo}
                className="w-full justify-center"
                title="Abre a sessão no agente: entra no portal, navega até a disputa e lê a tela. Não envia lance — o envio segue travado até o portal ser liberado."
              >
                {enviandoAoRobo
                  ? <><RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" /> Enviando…</>
                  : <><Send className="w-4 h-4" aria-hidden="true" /> Enviar ao robô</>}
              </Button>

              {/* O ATALHO PRECISA ESTAR À MÃO ANTES DO ENVIO: uma sessão que
                  falha dura ~13 segundos, medidos. Quem clica em enviar e só
                  depois procura onde assistir chega quando já acabou. */}
              <Button
                variant={destacarAssistir ? 'default' : 'outline'}
                onClick={onAssistir}
                className={`w-full justify-center ${destacarAssistir ? 'animate-pulse-glow' : ''}`}
                title="Abre a tela remota já conectada. A sessão pode durar poucos segundos — deixá-la aberta antes de enviar é o jeito de acompanhar desde o início."
              >
                <Monitor className="w-4 h-4" aria-hidden="true" />
                {destacarAssistir ? 'Assista agora — o robô está entrando' : 'Assistir ao vivo'}
              </Button>

              {nivel === 2 && !estrategiaAutorizada && lance.status === 'aguardando' && (
                <Button variant="outline" onClick={onAutorizarEstrategia} className="w-full justify-center">
                  <ShieldCheck className="w-4 h-4" aria-hidden="true" /> Autorizar Estratégia
                </Button>
              )}
              {estrategiaAutorizada && (
                <Badge variant="success" className="gap-1 self-start">
                  <CheckCircle2 className="w-3 h-3" aria-hidden="true" /> Estratégia Autorizada
                </Badge>
              )}
            </>
          ) : (
            <div className="rounded-md border border-dashed border-border px-3 py-2 g-corpo text-muted-foreground">
              Você acompanha esta disputa em modo leitura. Enviar ao robô e assistir ao vivo
              exigem o papel de operador — peça em Equipe → Permissões.
            </div>
          )}
          {acoes}
        </div>
      </BlocoDoPainel>

      {/* ── EIXO 4 · LIMITES — "quanto posso gastar?" ───────────────────────
          Separado do estado da sessão de propósito: um robô saudável e de pé
          não diz nada sobre quanto dinheiro ele pode comprometer, e era
          exatamente essa confusão que deixava o limite invisível. */}
      <BlocoDoPainel titulo="Limites">
        <ListaDeCampos
          campos={[
            {
              rotulo: (
                <span className="inline-flex items-center gap-1.5">
                  <Wallet className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Limite financeiro autorizado
                </span>
              ),
              valor: !limiteCarregado ? (
                <ValorIndisponivel razao="Consultando o aceite vigente" />
              ) : limiteFinanceiro > 0 ? (
                formatCurrency(limiteFinanceiro)
              ) : (
                // Zero aqui NÃO é "limite de R$ 0,00": é ausência de aceite
                // vigente. Exibi-lo como número seria afirmar sobre a empresa
                // uma coisa que ninguém decidiu.
                <ValorIndisponivel razao="Nenhum aceite vigente — definido ao ativar o nível 2 ou 3" />
              ),
              numerico: limiteCarregado && limiteFinanceiro > 0,
            },
            {
              rotulo: 'Nível de automação',
              valor: `N${nivel} — ${ROTULO_NIVEL[nivel]}`,
            },
            {
              rotulo: 'Piso desta disputa',
              valor: lance.valorMinimo > 0
                ? formatCurrency(lance.valorMinimo)
                : <ValorIndisponivel razao="Piso não definido no cadastro da disputa" />,
              numerico: lance.valorMinimo > 0,
            },
            {
              rotulo: 'Primeiro lance',
              valor: lance.valorInicial > 0
                ? formatCurrency(lance.valorInicial)
                : <ValorIndisponivel razao="Valor inicial não definido" />,
              numerico: lance.valorInicial > 0,
            },
            { rotulo: 'Máx. lances por sessão', valor: String(lance.maxLances), numerico: true },
          ]}
        />
        <p className="g-meta text-muted-foreground">
          O limite vem do aceite de termos e não é editável aqui: alterá-lo exige passar
          de novo pelo aceite, com a política de uso e a declaração de responsabilidade.
        </p>
      </BlocoDoPainel>

      {/* ── EIXOS 1, 2 e 3 · CONEXÃO · AUTENTICAÇÃO · PRONTIDÃO ─────────────
          O checklist é a autoridade sobre os três, e ele mesmo os separa com
          esses nomes. Repetir aqui um resumo próprio criaria uma segunda
          fonte da mesma verdade — e duas fontes divergem. */}
      <AtivacaoChecklist somenteLeitura={!isAdmin} />

      {/* ── EIXO 6 · EVENTOS — "o que já aconteceu?" ────────────────────────
          Só os desfechos dos pedidos que o robô fez a uma pessoa (código de
          verificação, em geral): "atendido" ou "expirado". A trilha completa
          mora na subaba Auditoria, e o botão leva até ela. */}
      <BlocoDoPainel titulo="Eventos">
        {desfechos.length === 0 ? (
          <p className="g-corpo text-muted-foreground">
            Nenhum pedido do robô a uma pessoa foi registrado ainda.
          </p>
        ) : (
          <ListaDeCampos
            campos={desfechos.slice(0, 4).map((d) => ({
              rotulo: new Date(d.em).toLocaleString('pt-BR'),
              valor: (
                <SeloSituacao tom={d.desfecho === 'atendido' ? 'sucesso' : 'atencao'}>
                  {d.tipo} · {d.desfecho}
                </SeloSituacao>
              ),
            }))}
          />
        )}
        <Button variant="outline" onClick={onVerEventos} className="w-full justify-center">
          <History className="w-4 h-4" aria-hidden="true" /> Abrir trilha de auditoria
        </Button>
      </BlocoDoPainel>
    </div>
  );
}
