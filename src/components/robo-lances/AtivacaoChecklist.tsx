import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle2, Circle, AlertTriangle, Server, Key, Shield,
  FileCheck, Rocket, Loader2, Award, RefreshCw, Send, Globe,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import SituacaoDoRoboEmLinha from './cliente/SituacaoDoRoboEmLinha';

/**
 * ─── OS TRÊS EIXOS, E POR QUE ELES NÃO PODEM VIR NA MESMA LISTA ────────────
 *
 * Até 13/09/2026 os sete itens desciam numa lista corrida, e a leitura
 * misturava perguntas que têm respostas INDEPENDENTES entre si:
 *
 *   "o portal responde?"  ≠  "minhas credenciais valem?"  ≠  "o robô está pronto?"
 *
 * Verde num eixo não implica verde no outro, e o caso concreto que obrigou a
 * separação é justamente o mais comum: portal no ar, agente de pé e certificado
 * ausente. Na lista corrida isso lia como "quase pronto, falta uma linha" —
 * quando na verdade a disputa não sai do lugar, porque sem certificado o robô
 * não passa da tela de login.
 *
 * A separação é só de apresentação: os mesmos sete itens, com os mesmos `id`,
 * o mesmo cálculo de status e o mesmo progresso geral.
 */
type EixoId = 'conexao' | 'autenticacao' | 'prontidao';

const EIXOS: Array<{ id: EixoId; titulo: string; pergunta: string; icone: typeof Server }> = [
  { id: 'conexao', titulo: 'Conexão', pergunta: 'O portal responde?', icone: Globe },
  { id: 'autenticacao', titulo: 'Autenticação', pergunta: 'Minhas credenciais valem?', icone: Key },
  { id: 'prontidao', titulo: 'Prontidão do robô', pergunta: 'O robô está pronto para operar?', icone: Server },
];

type CheckItem = {
  id: string;
  /** A qual pergunta este item responde. Ver `EIXOS`. */
  eixo: EixoId;
  label: string;
  descricao: string;
  status: 'pendente' | 'ok' | 'erro' | 'verificando';
  icon: typeof Server;
  acao?: () => void;
  acaoLabel?: string;
  /** Nota abaixo da descrição, para quando o rótulo do botão pode enganar. */
  rodape?: string;
};

/**
 * @param somenteLeitura Esconde os botões de ação do checklist (instalar
 *   certificado, gerar link, testar freio). O painel passou a aparecer também
 *   na coluna da direita da aba Disputar, que é visível a operador e
 *   visualizador — e essas ações são de administrador. Esconder o botão não é
 *   a trava (a trava é a RLS e a edge function); é não oferecer a quem não
 *   pode, que é o que a tela deve fazer.
 *
 * @param modo Para quem o checklist fala (14/09/2026).
 *   - `plataforma` (padrão): a versão completa, para a operação Praefectus —
 *     agente, healthcheck, freio, slots, RAM e portais respondendo.
 *   - `cliente`: só o que é da EMPRESA — acesso aos portais e certificado
 *     digital —, mais uma linha com a disponibilidade do robô vinda do
 *     servidor. Infraestrutura não é decisão do cliente, e mostrá-la a ele
 *     só produzia dúvida ("o que é slot?") e erro técnico cru na tela.
 */
export default function AtivacaoChecklist({
  somenteLeitura = false,
  modo = 'plataforma',
}: { somenteLeitura?: boolean; modo?: 'cliente' | 'plataforma' } = {}) {
  const cliente = modo === 'cliente';
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const [items, setItems] = useState<CheckItem[]>([]);
  const [checking, setChecking] = useState(false);
  const [showReenvio, setShowReenvio] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const [invalidando, setInvalidando] = useState(false);
  const [showInvalidar, setShowInvalidar] = useState(false);
  const [certTokenId, setCertTokenId] = useState<string | null>(null);
  const [testandoFreio, setTestandoFreio] = useState(false);

  /** Aciona a parada de emergência de propósito, com o robô parado, para
   *  provar que o freio responde. Recusado pelo servidor se houver disputa. */
  const testarFreio = async () => {
    if (testandoFreio) return;
    setTestandoFreio(true);
    try {
      const { data, error } = await supabase.functions.invoke('robo-lances-webhook/testar-kill-switch', { body: {} });
      const r = data as { verificado?: boolean; error?: string; resultados?: Array<{ detalhe?: string | null }> } | null;
      if (error || r?.error) {
        toast.error(r?.error || 'Não foi possível testar o freio de emergência.', { duration: 12000 });
      } else if (r?.verificado) {
        toast.success('Freio de emergência confirmado pelo agente. Níveis 2 e 3 liberados.');
      } else {
        toast.error(
          `O agente NÃO confirmou a parada${r?.resultados?.[0]?.detalhe ? ` (${r.resultados[0].detalhe})` : ''}. ` +
          'Envio automático permanece bloqueado — veja docs/agente-cloud-pendencias.md.',
          { duration: 20000 },
        );
      }
      await verificarStatus();
    } finally {
      setTestandoFreio(false);
    }
  };

  /**
   * Repete a entrega do certificado ao agente.
   *
   * O upload já tenta instalar sozinho. Este botão existe para o caso em que o
   * agente estava fora do ar naquele momento — sem ele, a única saída seria
   * gerar um novo link e pedir o arquivo de novo a quem já o mandou.
   */
  const [instalandoCert, setInstalandoCert] = useState(false);

  const instalarNoAgente = async () => {
    setInstalandoCert(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        'robo-lances-webhook/instalar-certificado',
        { body: {} },
      );

      // A causa real vem no corpo da resposta; `error.message` traz só
      // "non-2xx status code", que não diz à pessoa o que fazer a seguir.
      let motivo = (data as { motivo?: string } | null)?.motivo;
      if (!motivo && error) {
        const contexto = (error as { context?: Response }).context;
        if (contexto && typeof contexto.json === 'function') {
          const corpo = await contexto.json().catch(() => null);
          motivo = (corpo as { motivo?: string } | null)?.motivo;
        }
        motivo = motivo || error.message;
      }

      if ((data as { instalado?: boolean } | null)?.instalado) {
        toast.success('Certificado instalado no robô.');
      } else if (cliente) {
        // O motivo do agente é diagnóstico (caminho de arquivo, base NSS,
        // policy do Chrome). O cliente precisa saber o que fazer, não isso.
        if (motivo) console.error('[robo-lances] instalar certificado', motivo);
        toast.error(
          'Não foi possível instalar o certificado agora. Tente de novo em alguns minutos ou fale com o suporte.',
          { duration: 15000 },
        );
      } else {
        toast.error(motivo || 'Não foi possível instalar o certificado no robô.', {
          duration: 15000,
        });
      }
      await verificarStatus();
    } catch (err) {
      toast.error((err as Error).message || 'Erro ao instalar o certificado');
    } finally {
      setInstalandoCert(false);
    }
  };

  const gerarNovoLink = async () => {
    if (!user || !empresaAtiva) return;
    setReenviando(true);
    try {
      const { data, error } = await supabase.functions.invoke('gerar-link-certificado', {
        body: { empresa_id: empresaAtiva.id },
      });
      if (error) throw error;
      toast.success('Novo link de upload enviado para seu e-mail.');
      await verificarStatus();
    } catch (err) {
      toast.error((err as Error).message || 'Erro ao gerar link');
    } finally {
      setReenviando(false);
      setShowReenvio(false);
    }
  };

  const invalidarCertificado = async () => {
    if (!certTokenId) return;
    setInvalidando(true);
    try {
      // Mark the token's cert_file_path as null and used_at as null to allow re-upload
      const { error } = await supabase
        .from('cert_upload_tokens')
        .update({ cert_file_path: null, used_at: null } as never)
        .eq('id', certTokenId);

      if (error) throw error;
      toast.success('Certificado invalidado. Gere um novo link para enviar o arquivo correto.');
      setCertTokenId(null);
      setShowInvalidar(false);
      await verificarStatus();
    } catch (err) {
      toast.error((err as Error).message || 'Erro ao invalidar certificado');
    } finally {
      setInvalidando(false);
    }
  };

  const verificarStatus = async () => {
    if (!user) return;
    setChecking(true);

    const newItems: CheckItem[] = [];

    // 1. Verificar agente configurado
    // Colunas explícitas, sem `api_key_hash`: a chave do agente não tem o que
    // fazer no navegador, e a migration 20260914000003 tira dela o SELECT —
    // um `select('*')` aqui passaria a falhar com "permission denied".
    //
    // No modo cliente a consulta nem sai, e o item "Agente Externo Configurado"
    // não existe. Não é só questão de esconder infraestrutura: a empresa que
    // usa o agente gerenciado pela Praefectus NÃO TEM linha nessa tabela, e o
    // item leria "pendente" para um robô que funciona. No lugar dele entra a
    // linha de `situacao-do-robo` (ver `SituacaoDoRoboEmLinha`, mais abaixo).
    //
    // Sem agente, os itens de prontidão (sinal de vida, "Testar freio", slots)
    // também não são montados — o `if (agenteAtivo)` fica falso. Isso importa
    // desde que `testar-kill-switch` e `configurar-agente` passaram a responder
    // 403 a quem não é da plataforma: um botão desses na tela do cliente só
    // produziria erro.
    const { data: agentes } = cliente
      ? { data: null }
      : await supabase
          .from('agente_externo_config')
          .select('id, nome, url_base, status, versao_agente, max_sessoes_paralelas, sessoes_ativas, ram_mb')
          .eq('user_id', user.id);

    const agenteAtivo = agentes?.find(a => a.status === 'ativo');
    const agenteConfigurado = agentes && agentes.length > 0;

    if (!cliente) newItems.push({
      id: 'agente',
      eixo: 'prontidao',
      label: 'Agente Externo Configurado',
      descricao: agenteAtivo
        ? `Conectado: ${agenteAtivo.url_base} (v${agenteAtivo.versao_agente || '?'})`
        : agenteConfigurado
        ? `Configurado mas offline (${agentes[0].status})`
        : 'Configure o servidor VPS com o agente de automação',
      status: agenteAtivo ? 'ok' : agenteConfigurado ? 'erro' : 'pendente',
      icon: Server,
    });

    // Healthcheck AO VIVO — a tela lia colunas gravadas na configuração
    // (versão, RAM, heartbeat) e as exibia como se fossem de agora.
    let saudeAoVivo: {
      online?: boolean;
      agentes?: Array<{ online?: boolean; erro?: string | null; versao?: string | null;
        capacidade?: { ram_total_mb?: number; max_sessoes?: number; slots_disponiveis?: number };
        // `titulares` são os certificados que o Chrome do agente consegue de
        // fato apresentar — a única prova de que o .pfx saiu do Storage e virou
        // capacidade real. Sem esse campo a tela só sabia que um arquivo subiu.
        certificado?: {
          carregado?: boolean; path?: string; motivo?: string | null;
          titulares?: string[]; policy_ativa?: boolean; arquivo_no_disco?: boolean;
        } | null }>;
    } | null = null;
    try {
      const { data } = await supabase.functions.invoke('robo-lances-webhook/healthcheck', { body: {} });
      saudeAoVivo = data as typeof saudeAoVivo;
    } catch { /* sem resposta — os itens abaixo caem para o registro do banco */ }
    const agenteVivo = saudeAoVivo?.agentes?.[0];

    // 2. Verificar healthcheck do agente
    if (agenteAtivo) {
      // O agente nunca empurrou heartbeat; agora PUXAMOS o sinal de vida.
      newItems.push({
        id: 'heartbeat',
        eixo: 'prontidao',
        label: 'Sinal de vida (healthcheck)',
        descricao: agenteVivo?.online
          ? `Respondeu agora — ${new Date().toLocaleTimeString('pt-BR')}${agenteVivo.versao ? ` · v${agenteVivo.versao}` : ''}`
          : `O agente não respondeu ao healthcheck${agenteVivo?.erro ? ` (${agenteVivo.erro})` : ''}`,
        status: agenteVivo?.online ? 'ok' : 'erro',
        icon: Shield,
      });

      // Freio de emergência — etapa própria: o botão existir na tela não prova
      // que o agente para. Só o teste deliberado prova.
      //
      // ONDE ACIONAR, e por que não é aqui. Este painel é diagnóstico: diz se o
      // freio RESPONDE. Acioná-lo mata todas as sessões de uma vez, e um botão
      // desses no meio de uma lista de verificação é um estrago esperando
      // acontecer — a mão erra a linha e derruba uma disputa real.
      //
      // O acionamento mora onde há o que parar: o botão vermelho na barra da
      // disputa (aba Disputar) e o "Parar robô nesta disputa" em cada sessão
      // viva do painel de Sessões. A descrição abaixo diz isso, porque ter só
      // "Testar freio" sugeria que testar era tudo que dava para fazer.
      const ks = (agenteVivo as { kill_switch?: { ok?: boolean; detalhe?: string | null; testado_em?: string } | null } | undefined)?.kill_switch;
      newItems.push({
        id: 'kill_switch',
        eixo: 'prontidao',
        label: 'Freio de emergência verificado',
        descricao: ks?.ok
          ? `Parada de emergência confirmada pelo agente${ks.testado_em ? ` em ${new Date(ks.testado_em).toLocaleString('pt-BR')}` : ''}`
          : ks
          ? `O agente NÃO confirmou a parada${ks.detalhe ? ` (${ks.detalhe})` : ''} — níveis 2 e 3 permanecem bloqueados`
          : 'Nunca testado — obrigatório antes de ativar envio automático (níveis 2 e 3)',
        // Separar "testar" de "acionar" em palavras, já que o botão só testa.
        rodape: 'Este botão apenas TESTA se o agente responde ao freio. Para PARAR um robô em '
          + 'operação, use o botão vermelho na barra da disputa, ou "Parar robô nesta disputa" '
          + 'na lista de Sessões do Robô.',
        status: ks?.ok ? 'ok' : ks ? 'erro' : 'pendente',
        icon: Shield,
        acao: () => testarFreio(),
        acaoLabel: 'Testar freio',
      });

      // 3. Verificar capacidade
      const capacidadeViva = agenteVivo?.capacidade;
      const slotsLivres = capacidadeViva?.slots_disponiveis
        ?? ((agenteAtivo.max_sessoes_paralelas || 3) - (agenteAtivo.sessoes_ativas || 0));
      const slotsTotais = capacidadeViva?.max_sessoes ?? agenteAtivo.max_sessoes_paralelas;
      const ram = capacidadeViva?.ram_total_mb ?? agenteAtivo.ram_mb;
      newItems.push({
        id: 'capacidade',
        eixo: 'prontidao',
        label: 'Slots Disponíveis',
        descricao: `${slotsLivres} de ${slotsTotais} slots livres | ${ram || '?'}MB RAM`,
        status: slotsLivres > 0 ? 'ok' : 'erro',
        icon: Rocket,
      });
    }

    // 4. Certificado Digital
    if (empresaAtiva) {
      const { data: tokens } = await supabase
        .from('cert_upload_tokens')
        .select('id, cert_file_path, used_at, expires_at')
        .eq('empresa_id', empresaAtiva.id)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      const token = tokens?.[0];
      const certEnviado = token?.cert_file_path ? true : false;
      const tokenPendente = token && !token.used_at && new Date(token.expires_at) > new Date();

      if (certEnviado && token) {
        setCertTokenId(token.id);
      } else {
        setCertTokenId(null);
      }

      // ENVIAR O .PFX NÃO É INSTALAR O CERTIFICADO.
      //
      // Esta linha ficou verde por meses em cima de `certEnviado`, que só diz
      // que o arquivo chegou ao Storage do Supabase. Nada o levava dali até a
      // VPS, e o agente não tinha rota para recebê-lo: o certificado nunca era
      // apresentado a portal nenhum. Pior que um verde inútil — este consumia
      // uma ação cara da pessoa (pedir o certificado ao contador, pagar por
      // ele) para não entregar nada.
      //
      // Quem manda agora é o agente, que responde `carregado: true` apenas
      // quando as três condições valem: o arquivo, a chave na base NSS do
      // Chrome e a policy de auto-seleção. O upload vira etapa intermediária,
      // nunca conclusão.
      const certNoAgente = agenteVivo?.certificado?.carregado === true;
      const motivoCert = agenteVivo?.certificado?.motivo;
      const titulares: string[] = agenteVivo?.certificado?.titulares || [];

      newItems.push({
        id: 'certificado',
        eixo: 'autenticacao',
        label: 'Certificado Digital',
        descricao: certNoAgente
          ? `Instalado no robô e pronto para ser apresentado aos portais${titulares.length ? ` — ${titulares.join(', ')}` : ''}`
          : certEnviado
          ? cliente
            ? 'Arquivo recebido, mas a instalação no robô ainda não foi concluída. Use "Instalar no robô".'
            : `Arquivo recebido, mas o robô ainda não consegue apresentá-lo${motivoCert ? `: ${motivoCert}` : ''}. Use "Instalar no robô".`
          : tokenPendente
          ? 'Link de upload enviado — aguardando o envio do certificado'
          : 'Envie o certificado digital A1 (.pfx). O A3, de token ou cartão, não serve: a chave não sai do hardware.',
        // Só o agente decide o verde. `certEnviado` sozinho vira atenção, não
        // conclusão — é exatamente o estado "o arquivo subiu e não serve".
        status: certNoAgente ? 'ok' : certEnviado || tokenPendente ? 'erro' : 'pendente',
        icon: Award,
        acao: certEnviado && !certNoAgente
          ? () => instalarNoAgente()
          : certNoAgente
          ? () => setShowInvalidar(true)
          : () => setShowReenvio(true),
        acaoLabel: certEnviado && !certNoAgente
          ? 'Instalar no robô'
          : certNoAgente
          ? 'Substituir'
          : tokenPendente
          ? 'Reenviar link'
          : 'Enviar certificado',
      });
    }

    // 5. Verificar credenciais de portal
    // A tabela é `credenciais_portais` (plural) — o singular devolvia PGRST205 e
    // o erro descartado virava "pendente", idêntico a não ter credencial nenhuma.
    // A view `_safe` basta para contar e não traz o `senha_hash` para o navegador.
    const { data: credenciais, error: errCredenciais } = await supabase
      .from('credenciais_portais_safe')
      .select('id')
      .eq('user_id', user.id);

    const temCredencial = !errCredenciais && !!credenciais && credenciais.length > 0;
    newItems.push({
      id: 'credenciais',
      eixo: 'autenticacao',
      label: 'Credenciais de Portal',
      descricao: errCredenciais
        ? cliente
          ? 'Não foi possível consultar os acessos cadastrados agora. Use "Reverificar".'
          : `Não foi possível consultar as credenciais: ${errCredenciais.message}`
        : temCredencial
        ? `${credenciais.length} portal(is) configurado(s)`
        : 'Configure credenciais para pelo menos um portal de licitação',
      status: errCredenciais ? 'erro' : temCredencial ? 'ok' : 'pendente',
      icon: Key,
    });

    // 6. Verificar healthcheck dos portais — só na plataforma. Se o endereço
    // do portal responde é monitoramento da operação; quando ele cai, o
    // cliente fica sabendo por um aviso escrito por gente (`robo_avisos_portal`).
    if (!cliente) {
    const { data: healthchecks } = await supabase
      .from('portal_healthcheck')
      .select('id')
      .eq('status', 'ok');

    const portaisOk = healthchecks?.length || 0;
    newItems.push({
      id: 'portais',
      eixo: 'conexao',
      // "Operacionais" afirmava mais do que foi medido — a função só faz
      // HEAD/GET na URL e lê o status HTTP. É a mesma correção de rótulo que
      // `PortalHealthcheck` já carrega; aqui ela faltava, e as duas telas
      // passam a dizer a mesma coisa sobre a mesma medição.
      label: 'Portais respondendo',
      descricao: portaisOk > 0
        ? `${portaisOk} portal(is) responderam ao último healthcheck`
        : 'Execute o healthcheck para verificar se os endereços dos portais respondem',
      status: portaisOk > 0 ? 'ok' : 'pendente',
      icon: FileCheck,
    });
    }

    setItems(newItems);
    setChecking(false);
  };

  useEffect(() => {
    verificarStatus();
    // `verificarStatus` é recriada a cada render e faz seis consultas; incluí-la
    // aqui transformaria o checklist num laço de rede. A verificação depende de
    // quem está logado e de qual empresa está ativa — só disso.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, empresaAtiva]);

  const okCount = items.filter(i => i.status === 'ok').length;
  const total = items.length;
  const progress = total > 0 ? (okCount / total) * 100 : 0;
  const pronto = okCount === total && total > 0;

  const statusIcon = (status: string) => {
    switch (status) {
      case 'ok': return <CheckCircle2 className="w-5 h-5 text-success shrink-0" aria-hidden="true" />;
      case 'erro': return <AlertTriangle className="w-5 h-5 text-destructive shrink-0" aria-hidden="true" />;
      case 'verificando': return <Loader2 className="w-5 h-5 animate-spin text-warning shrink-0" aria-hidden="true" />;
      default: return <Circle className="w-5 h-5 text-muted-foreground shrink-0" aria-hidden="true" />;
    }
  };

  const statusTexto = (status: string) => {
    switch (status) {
      case 'ok': return 'Concluído';
      case 'erro': return 'Atenção';
      case 'verificando': return 'Verificando';
      default: return 'Pendente';
    }
  };

  return (
    <>
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            {cliente ? (
              <Key className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
            ) : (
              <Rocket className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
            )}
            {cliente ? 'Acesso da empresa aos portais' : 'Checklist de Ativação — Robô de Lances'}
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            {pronto ? (
              <Badge variant="success">
                {cliente ? 'Em dia' : 'Verificações concluídas'}
              </Badge>
            ) : (
              <Badge variant="muted">
                {okCount}/{total} etapas
              </Badge>
            )}
            <Button
              variant="outline"
              onClick={verificarStatus}
              disabled={checking}
            >
              {checking ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Shield className="w-4 h-4" aria-hidden="true" />}
              Reverificar
            </Button>
          </div>
        </div>

        {/* A disponibilidade do robô, em uma linha, perguntada ao servidor —
            no lugar dos itens de agente, sinal de vida, freio e slots. */}
        {cliente && <SituacaoDoRoboEmLinha empresaId={empresaAtiva?.id ?? null} />}

        <Progress value={progress} className="h-2" aria-label={`${okCount} de ${total} etapas concluídas`} />

        {/* Um bloco por eixo. Grupo sem item nenhum não desenha cabeçalho —
            os itens de prontidão só existem com agente configurado, e um
            título sozinho sugeriria que algo deveria estar ali e sumiu. */}
        <div className="space-y-5">
          {EIXOS.map((eixo) => {
            const doEixo = items.filter((i) => i.eixo === eixo.id);
            if (doEixo.length === 0) return null;
            const IconeEixo = eixo.icone;
            return (
              <section key={eixo.id} className="space-y-2" aria-label={eixo.titulo}>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-border pb-1.5">
                  <h4 className="g-titulo-secao flex items-center gap-2 text-foreground">
                    <IconeEixo className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
                    {eixo.titulo}
                  </h4>
                  <span className="g-meta text-muted-foreground">{eixo.pergunta}</span>
                </div>

                {/* O aviso mora no eixo de conexão porque é AQUI que a confusão
                    nasce: com prontidão e autenticação logo abaixo, um verde em
                    "portais respondendo" tende a ser lido como "a automação foi
                    validada". Ela não foi — e só uma sessão de verdade valida. */}
                {eixo.id === 'conexao' && (
                  <p className="g-meta text-muted-foreground">
                    <strong className="text-foreground">Portal respondendo não significa automação validada.</strong>{' '}
                    O healthcheck confere se o endereço responde. Se o robô consegue fazer login,
                    achar a sala da disputa e enviar lance só se sabe rodando uma sessão de verdade.
                  </p>
                )}

                {doEixo.map(item => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.id}
                      className={`flex flex-col sm:flex-row sm:items-start gap-3 rounded-lg border p-4 ${
                        item.status === 'ok'
                          ? 'border-success-line bg-success-tint'
                          : item.status === 'erro'
                          ? 'border-destructive-line bg-destructive-tint'
                          : 'border-border bg-card'
                      }`}
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <span title={statusTexto(item.status)}>{statusIcon(item.status)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
                            <p className="text-sm font-semibold">{item.label}</p>
                            <span className="sr-only">— {statusTexto(item.status)}</span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">{item.descricao}</p>
                          {item.rodape && (
                            <p className="text-xs text-muted-foreground mt-2 border-l-2 border-border pl-2">
                              {item.rodape}
                            </p>
                          )}
                        </div>
                      </div>
                      {item.acao && !somenteLeitura && (
                        <Button size="sm" variant="outline" className="shrink-0 self-start" onClick={item.acao}>
                          {item.acaoLabel || 'Configurar'}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>

        {/* ─── A FRASE QUE AFIRMAVA O QUE NINGUÉM LIBEROU (14/09/2026) ────────
            Aqui estava "Sistema pronto para disputas reais. O robô pode
            participar de licitações no Compras.gov e outros portais." —
            falso: nenhum portal tem o envio de lances liberado, e as
            verificações acima medem infraestrutura, acesso e certificado, não
            a capacidade de dar lance. Um verde com essa frase autorizava a
            empresa a confiar uma disputa real a um robô que só observa. */}
        {pronto && (
          cliente ? (
            <div className="bg-success-tint border border-success-line rounded-lg p-4 text-center">
              <p className="text-sm text-success-ink font-semibold">
                Acesso aos portais e certificado digital conferidos.
              </p>
            </div>
          ) : (
            <div className="bg-muted border border-border rounded-lg p-4 text-center">
              <p className="text-sm text-foreground font-semibold">
                Todas as verificações passaram — isso não libera o envio de lances.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                As verificações medem agente, acesso e certificado. O envio é liberado portal a
                portal, depois de validado em sessão real.
              </p>
            </div>
          )
        )}
      </div>

      {/* Dialog: Gerar/Reenviar link de upload */}
      <AlertDialog open={showReenvio} onOpenChange={setShowReenvio}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
              Enviar Certificado Digital
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left space-y-2">
              <p>
                Será gerado um link seguro e temporário (24h) para upload do arquivo
                <strong> .pfx</strong> ou <strong>.p12</strong> da empresa <strong>{empresaAtiva?.razao_social}</strong>.
              </p>
              <p>O link será enviado para seu e-mail cadastrado.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={gerarNovoLink} disabled={reenviando}>
              {reenviando ? <Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden="true" /> : <Send className="w-4 h-4 mr-2" aria-hidden="true" />}
              Gerar Link de Upload
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Invalidar e substituir certificado */}
      <AlertDialog open={showInvalidar} onOpenChange={setShowInvalidar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-destructive" aria-hidden="true" />
              Substituir Certificado Digital
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left space-y-2">
              <p>
                O certificado atual será invalidado e um <strong>novo link de upload</strong> será
                gerado para a empresa <strong>{empresaAtiva?.razao_social}</strong>.
              </p>
              <p className="text-destructive font-medium">
                Utilize esta opção caso tenha enviado o certificado errado (outra empresa ou pessoa física).
              </p>
              <p>O novo link será enviado para seu e-mail cadastrado.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await invalidarCertificado();
                await gerarNovoLink();
              }}
              disabled={invalidando || reenviando}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {(invalidando || reenviando) ? <Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden="true" /> : <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />}
              Invalidar e Gerar Novo Link
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
