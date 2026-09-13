import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  MessageSquare, Volume2, VolumeX, Megaphone, Info, AlertTriangle, Loader2,
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import LicitacaoChat from '@/components/licitacoes/LicitacaoChat';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
// O beep morava aqui dentro e só existia com a tela aberta. Agora a
// autoridade é a lib compartilhada com o lembrete global de convocação
// (AppLayout): mesmo som, mesmo volume, mesma vibração em qualquer página.
import { gravarConfigSom, lerConfigSom, tocarAlerta, vibrar, type ConfigSom } from '@/lib/alertas/som';

/**
 * Uma fala do pregoeiro, lida pelo robô na sala e gravada no processo.
 *
 * ─── POR QUE ESTE TIPO MUDOU ───────────────────────────────────────────────
 *
 * Esta tela dizia "Chat do Pregoeiro" e mostrava `chat_messages` — que tem
 * `role`/`content`, o formato de conversa com assistente de IA. Pior: nada no
 * repositório inteiro escrevia nessa tabela. Era uma aba prometendo mensagens
 * do pregão e lendo uma tabela vazia desde fevereiro de 2026.
 *
 * Agora lê `licitacao_mensagens`, que é onde o robô grava de verdade, filtrada
 * por `metadata->>origem = 'portal'`.
 */
type MensagemDoPortal = {
  id: string;
  conteudo: string;
  tipo: string;
  created_at: string;
  licitacao_id: string;
  metadata: { edital?: string; remetente?: string; requer_acao?: boolean } | null;
};

export default function MonitoramentoChat() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const licitacaoId = searchParams.get('lid');
  const licitacaoNumero = searchParams.get('num');
  const [configSom, setConfigSom] = useState<ConfigSom>(() => lerConfigSom());
  const [mainTab, setMainTab] = useState(licitacaoId ? 'processo' : 'chat');
  const somLigado = !configSom.mudo && configSom.volume > 0;

  // O que o pregoeiro falou, em todos os processos da empresa.
  const [mensagens, setMensagens] = useState<MensagemDoPortal[]>([]);
  const [loadingMensagens, setLoadingMensagens] = useState(false);

  useEffect(() => {
    if (!user) return;
    const loadMessages = async () => {
      setLoadingMensagens(true);
      // Sem `.eq('user_id')`: mensagem de pregão é do PROCESSO, e processo é da
      // empresa (princípio 2). Quem decide o alcance é a RLS — filtrar por
      // usuário aqui esconderia do colega o chamado do pregoeiro num processo
      // que os dois acompanham.
      const { data } = await supabase
        .from('licitacao_mensagens')
        .select('id, conteudo, tipo, created_at, licitacao_id, metadata')
        .eq('metadata->>origem', 'portal')
        .order('created_at', { ascending: false })
        .limit(50);
      setMensagens((data as unknown as MensagemDoPortal[]) || []);
      setLoadingMensagens(false);
    };
    loadMessages();

    const channel = supabase
      .channel('monitoramento-portal-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'licitacao_mensagens' },
        (payload) => {
          const nova = payload.new as MensagemDoPortal;
          // O realtime não filtra por conteúdo de jsonb, então a peneira é
          // aqui: sem ela, cada mensagem interna da equipe tocaria o alarme
          // de convocação.
          if (nova?.metadata?.requer_acao === undefined && nova?.tipo !== 'alerta') return;
          loadMessages();
          // Só para o que pede ação — alarme em toda fala vira ruído e para
          // de ser ouvido. Mudo e volume são resolvidos pela própria lib; a
          // vibração acompanha (celular/tablet — desktop ignora em silêncio).
          if (nova?.metadata?.requer_acao) {
            tocarAlerta('convocacao');
            vibrar('convocacao');
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const alternarMudo = () => {
    const novo = { ...configSom, mudo: !configSom.mudo };
    setConfigSom(novo);
    gravarConfigSom(novo);
    if (!novo.mudo) setTimeout(() => tocarAlerta('mensagem'), 100);
  };

  // O arraste atualiza a tela em tempo real; gravar + tocar o feedback só no
  // soltar, senão vira metralhadora de beep a cada pixel.
  const aoArrastarVolume = ([v]: number[]) => {
    setConfigSom((atual) => ({ ...atual, volume: v / 100 }));
  };
  const aoSoltarVolume = ([v]: number[]) => {
    const novo = { volume: v / 100, mudo: false };
    setConfigSom(novo);
    gravarConfigSom(novo);
    if (v > 0) tocarAlerta('mensagem', v / 100);
  };

  return (
    <AppLayout>
      {/* O <Tabs> embrulha o cabeçalho porque a TabsList mora nele: gatilho e
          conteúdo precisam do mesmo contexto. */}
      <Tabs value={mainTab} onValueChange={setMainTab} className="w-full">
        {/* Sem `titulo`/`descricao`/`icone`: a rota é item de menu, então o
            cabeçalho tira tudo do registro `lib/navegacao/paginas.ts`. */}
        <CabecalhoPagina
          acoes={
            /* Volume manual: o botão silencia/religa, o slider gradua. A
               preferência vale para o site inteiro — o lembrete global de
               convocação usa o mesmo ajuste. */
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-11 w-11 flex-shrink-0"
                onClick={alternarMudo}
                title={somLigado ? 'Silenciar alertas' : 'Reativar o som'}
                aria-label={somLigado ? 'Silenciar alertas' : 'Reativar o som'}
              >
                {somLigado
                  ? <Volume2 className="text-success" aria-hidden="true" />
                  : <VolumeX className="text-muted-foreground" aria-hidden="true" />}
              </Button>
              <Slider
                value={[configSom.mudo ? 0 : Math.round(configSom.volume * 100)]}
                onValueChange={aoArrastarVolume}
                onValueCommit={aoSoltarVolume}
                max={100}
                step={5}
                aria-label="Volume dos alertas"
                className="w-28"
              />
              <span className="w-14 text-sm text-muted-foreground tabular-nums">
                {somLigado ? `${Math.round(configSom.volume * 100)}%` : 'Mudo'}
              </span>
            </div>
          }
        >
          {/* O estado do som, dito com texto — a cor é reforço, não a pista. */}
          {somLigado ? (
            <Alert variant="success">
              <Volume2 className="h-4 w-4" aria-hidden="true" />
              <AlertTitle>Alertas ativados em {Math.round(configSom.volume * 100)}%</AlertTitle>
              <AlertDescription>
                Convocações e menções à empresa tocam som, vibram (celular/tablet) e aparecem
                como caixinhas em qualquer tela do sistema, levando de volta para cá.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert variant="info">
              <VolumeX className="h-4 w-4" aria-hidden="true" />
              <AlertTitle>Som silenciado</AlertTitle>
              <AlertDescription>
                As caixinhas de convocação continuam aparecendo, mas sem som nem vibração.
              </AlertDescription>
            </Alert>
          )}

          <TabsList>
            {licitacaoId && (
              <TabsTrigger value="processo">
                <MessageSquare className="w-4 h-4 mr-2" aria-hidden="true" /> Mural do Processo
              </TabsTrigger>
            )}
            <TabsTrigger value="chat">
              <MessageSquare className="w-4 h-4 mr-2" aria-hidden="true" /> Chat do Pregoeiro
            </TabsTrigger>
            <TabsTrigger value="mural">
              <Megaphone className="w-4 h-4 mr-2" aria-hidden="true" /> Publicações do Portal
            </TabsTrigger>
          </TabsList>
        </CabecalhoPagina>

        {licitacaoId && (
          <TabsContent value="processo">
            <div className="max-w-3xl mx-auto">
              <LicitacaoChat
                licitacaoId={licitacaoId}
                licitacaoNumero={licitacaoNumero || undefined}
              />
            </div>
          </TabsContent>
        )}

        <TabsContent value="chat">
          <div className="space-y-4">
            <Alert variant="info">
              <Info className="h-4 w-4" aria-hidden="true" />
              <AlertTitle>Chat do pregoeiro — em tempo real</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>
                  Quando o robô estiver numa <strong>sala de disputa ao vivo</strong>, as falas do
                  pregoeiro caem aqui e no próprio processo. As que pedem ação —{' '}
                  <em>convocação, diligência, prazo, documento</em> — vêm destacadas e tocam
                  alerta sonoro.
                </p>
                {/* O estado real, dito sem rodeio. A versão anterior prometia
                    "será ativado automaticamente" para uma tela que lia uma
                    tabela sem escritor — é o tipo de frase que faz procurar
                    defeito onde falta implementação. */}
                <p>
                  <strong>Onde estamos:</strong> os portais só expõem o chat durante a sessão
                  pública. O transporte está pronto; a leitura da sala depende de acompanhar um
                  pregão acontecendo.
                </p>
              </AlertDescription>
            </Alert>

            {/* O que o pregoeiro falou, do processo mais recente para o mais
                antigo. Quem pede ação vem destacado — é o caso que o cliente
                descreveu: "dispara um alerta toda vez que a empresa é
                convocada". */}
            {loadingMensagens && mensagens.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                Carregando as mensagens dos pregoeiros
              </div>
            ) : mensagens.length > 0 ? (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold text-foreground">
                  Últimas mensagens dos pregoeiros
                </h2>
                {mensagens.slice(0, 10).map((msg) => {
                  const pedeAcao = msg.metadata?.requer_acao === true;
                  return (
                    <Card
                      key={msg.id}
                      className={`p-4 ${pedeAcao ? 'border-warning-line bg-warning-tint' : ''}`}
                    >
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <Badge variant="muted" className="font-mono" truncate>
                            {msg.metadata?.edital || 'processo'}
                          </Badge>
                          {pedeAcao && (
                            <Badge variant="warning">
                              <AlertTriangle className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                              Pede ação
                            </Badge>
                          )}
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                          {new Date(msg.created_at).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <p className="text-sm text-foreground line-clamp-3">{msg.conteudo}</p>
                      <Link
                        to={`/processo/${msg.licitacao_id}`}
                        className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
                      >
                        Abrir o processo →
                      </Link>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <EstadoVazio
                icone={<MessageSquare aria-hidden="true" />}
                titulo="Nenhuma mensagem de pregoeiro registrada"
                /* A frase honesta: hoje a lista fica vazia porque nenhum portal
                   implementado sabe ler a sala. Prometer "aparecerão quando você
                   monitorar" seria repetir o defeito que esta tela tinha. */
                descricao="As falas do pregoeiro aparecem aqui quando o robô estiver numa sala de disputa ao vivo. Fora da sessão pública, os portais não expõem o chat."
              />
            )}
          </div>
        </TabsContent>

        <TabsContent value="mural">
          <div className="space-y-4">
            <Alert variant="info">
              <Info className="h-4 w-4" aria-hidden="true" />
              <AlertTitle>Publicações do Portal</AlertTitle>
              <AlertDescription>
                Avisos, esclarecimentos, impugnações e retificações publicados nos portais serão
                exibidos aqui automaticamente quando você estiver acompanhando processos
                licitatórios ativos.
              </AlertDescription>
            </Alert>

            <EstadoVazio
              icone={<Megaphone aria-hidden="true" />}
              titulo="Nenhuma publicação do portal"
              descricao="Avisos, esclarecimentos e retificações aparecerão aqui quando detectados nos portais dos processos que você acompanha."
            />
          </div>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
