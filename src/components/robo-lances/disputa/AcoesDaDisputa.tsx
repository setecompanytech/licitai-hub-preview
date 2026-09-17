import { useEffect, useState } from 'react';
import {
  AlertTriangle, ArrowDown, Bot, Building2, CalendarDays, ChevronDown, Clock, ExternalLink, FileSearch, FileText, Gavel, Globe, Hand,
  Hash, Info, ListChecks, Send, Settings, Shield, Target, Trash2, TrendingDown, Trophy, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ValorIndisponivel } from '@/components/gestao/SeloSituacao';
import RegistrarPerdaDialog, { type PerdaAlvo } from '@/components/metas/RegistrarPerdaDialog';
import type { LanceConfig } from '@/components/robo-lances/ConfigurarLanceDialog';
import type { NivelAutomacao } from '@/components/robo-lances/NivelAutomacaoSelector';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useLicitacaoIntegration } from '@/hooks/useLicitacaoIntegration';
import { supabase } from '@/integrations/supabase/client';
import { gravarFase, postarResultadoNoMural, proximoStatus, removerDisputa } from './disputa-do-robo';
import { textoDoLimiteDeLances } from '@/lib/robo/estrategia-do-item';
import { agendamentoDaDisputa } from '@/lib/robo/agendamento';
import { detalhesDaCompra } from '@/lib/robo/compra-comprasgov';
import { useCompraDaDisputa } from './useCompraDaDisputa';

const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const ROTULO_DO_NIVEL: Record<NivelAutomacao, string> = {
  1: 'Assistente',
  2: 'Semiautomático',
  3: 'Automação Controlada',
};

type Props = {
  lance: LanceConfig;
  nivel: NivelAutomacao;
  /** A disputa mudou no banco (fase marcada) — a tela relê. */
  aoAlterar: () => void;
  /** Encerrou como venceu/perdeu — a tela relê e mostra o mural com o resultado. */
  aoEncerrar: () => void;
  /** Removida — a tela sai da página de uma disputa que não existe mais. */
  aoRemover: () => void;
  /**
   * "Entrar agora" — o envio imediato ao robô, que até 17/09/2026 era o botão
   * principal da página. `null` com o robô já na sala ou sem papel de operador.
   */
  entrarAgora?: { enviando: boolean; aoEntrar: () => void } | null;
  /**
   * "Conferir alterações da licitação" (17/09/2026): pregão remarcado antes de a
   * data cadastrada passar também precisa ser conferido. `null` sem papel de operador.
   */
  conferirAlteracoes?: (() => void) | null;
};

/**
 * O menu "Ações" da disputa, com os diálogos que ele abre.
 *
 * Morava espalhado em `pages/RoboLances.tsx` (handlers na página, menu numa
 * variável, desenhado pela coluna da direita). Saiu em 14/09/2026 para o
 * cabeçalho da página da disputa, inteiro: menu, "Detalhes da licitação" e o
 * registro de perda andam juntos porque são as mesmas decisões sobre a mesma
 * disputa.
 *
 * Os rótulos são os honestos desta semana: "Marcar como … (manual)" só grava a
 * fase — não inicia nem para o robô —, e o aviso depois do clique repete isso.
 */
export default function AcoesDaDisputa({ lance, nivel, aoAlterar, aoEncerrar, aoRemover, entrarAgora = null, conferirAlteracoes = null }: Props) {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const { registrarResultadoDisputa, registrarPerda } = useLicitacaoIntegration();
  const [detalhesAbertos, setDetalhesAbertos] = useState(false);
  const [perdaAlvo, setPerdaAlvo] = useState<PerdaAlvo | null>(null);
  const [salvandoPerda, setSalvandoPerda] = useState(false);
  const [confirmandoRemocao, setConfirmandoRemocao] = useState(false);
  const [removendo, setRemovendo] = useState(false);

  /**
   * O órgão do processo vinculado, para "Detalhes da licitação". Só é lido com
   * o diálogo aberto: é consulta eventual, e puxá-la sempre seria uma consulta
   * por abertura de página para um diálogo que quase nunca se abre.
   */
  const [orgaoDoProcesso, setOrgaoDoProcesso] = useState<string | null>(null);
  const [orgaoCarregando, setOrgaoCarregando] = useState(false);

  // A compra no Compras.gov completa o que o cadastro não tem (checklist do
  // grupo: "retornar dados da licitação"). Mesma consulta do cartão da página,
  // lida só com o diálogo aberto.
  const { ativa: temCompra, consulta: consultaDaCompra } = useCompraDaDisputa(lance, detalhesAbertos);
  const compras = consultaDaCompra.data ?? [];
  const compra = compras.length === 1 ? detalhesDaCompra(compras[0]) : null;
  const semCompra = (razao: string) => {
    if (!temCompra) return <ValorIndisponivel razao={razao} />;
    if (consultaDaCompra.isLoading) return <ValorIndisponivel razao="Consultando o Compras.gov" />;
    if (consultaDaCompra.isError) return <ValorIndisponivel razao={`Compras.gov não respondeu: ${(consultaDaCompra.error as Error).message}`} />;
    if (compras.length > 1) return <ValorIndisponivel razao={`${compras.length} compras com este número no Compras.gov — veja na página da disputa`} />;
    return <ValorIndisponivel razao={razao} />;
  };

  useEffect(() => {
    if (!detalhesAbertos || !lance.licitacaoId) {
      setOrgaoDoProcesso(null);
      return;
    }
    let cancelado = false;
    setOrgaoCarregando(true);
    supabase
      .from('licitacoes')
      .select('orgao')
      .eq('id', lance.licitacaoId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelado) return;
        if (error) console.error('[robo-lances] carregar órgão da licitação', error.message);
        setOrgaoDoProcesso((data as { orgao?: string | null } | null)?.orgao || null);
        setOrgaoCarregando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [detalhesAbertos, lance.licitacaoId]);

  const proxima = proximoStatus(lance.status);

  // ─── O RÓTULO PROMETIA O QUE O CLIQUE NÃO FAZ (14/09/2026) ────────────────
  // O menu dizia "Iniciar disputa" / "Pausar disputa", e o clique só grava a
  // coluna `status`: o robô não é iniciado nem parado (isso é "Enviar ao robô"
  // e a parada). Quem clicou esperando o robô precisa saber na hora.
  const alternarFase = async () => {
    if (!proxima) return;
    const r = await gravarFase(lance.id, proxima);
    if (!r.ok) {
      toast.error(`Status não foi salvo: ${r.motivo}`, { duration: 12000 });
      return;
    }
    aoAlterar();
    toast.info(
      proxima === 'ativo'
        ? 'Disputa marcada como em disputa (manual). O robô não foi iniciado.'
        : 'Disputa marcada como aguardando (manual). O robô não foi parado.',
      { duration: 8000 },
    );
  };

  // "Encerrar como Venceu/Perdeu" mudava só o estado local: ao recarregar, a
  // disputa voltava ao status anterior. O encerramento vai ao banco.
  const gravarEncerramento = async () => {
    const r = await gravarFase(lance.id, 'encerrado');
    if (!r.ok) toast.error(`O encerramento não foi gravado na disputa: ${r.motivo}`, { duration: 12000 });
  };

  const encerrar = async (resultado: 'venceu' | 'perdeu') => {
    // Derrota em processo vinculado passa pelo diálogo de motivo antes de
    // qualquer gravação — o encerramento continua em `confirmarPerda`.
    if (resultado === 'perdeu' && lance.licitacaoId) {
      setPerdaAlvo({
        licitacaoId: lance.licitacaoId,
        numero: lance.edital,
        orgao: lance.portal,
        valorEstimado: lance.valorMinimo ?? null,
      });
      return;
    }
    const valorFinal = resultado === 'venceu' ? lance.meuLance || lance.valorMinimo : undefined;
    await gravarEncerramento();
    if (user) await postarResultadoNoMural(lance, resultado, user.id, valorFinal);
    if (lance.licitacaoId) await registrarResultadoDisputa(lance.licitacaoId, resultado, valorFinal);
    aoEncerrar();
  };

  /** Registra o motivo e só então encerra a disputa como derrota. */
  const confirmarPerda = async ({ motivoId, observacao }: { motivoId: string; observacao: string }) => {
    if (!perdaAlvo || !empresaAtiva) return;
    setSalvandoPerda(true);
    const ok = await registrarPerda({
      licitacaoId: perdaAlvo.licitacaoId,
      empresaId: empresaAtiva.id,
      motivoId,
      observacao,
      valorEstimado: perdaAlvo.valorEstimado,
    });
    setSalvandoPerda(false);
    if (!ok) return;
    setPerdaAlvo(null);
    await gravarEncerramento();
    if (user) await postarResultadoNoMural(lance, 'perdeu', user.id);
    aoEncerrar();
  };

  const remover = async () => {
    setRemovendo(true);
    const r = await removerDisputa(lance.id);
    setRemovendo(false);
    if (!r.ok) {
      toast.error(r.motivo, { duration: 12000 });
      return;
    }
    setConfirmandoRemocao(false);
    toast.info('Disputa removida.');
    aoRemover();
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="g-controle">
            <Settings className="h-4 w-4" aria-hidden="true" /> Ações <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        {/* O realce do item é o verde cheio de `--accent` com texto branco. A
            descrição em `text-muted-foreground` e os itens em verde/vermelho
            sumiam sobre ele (Ian, 17/09/2026): a descrição acompanha o texto
            do realce, e os itens coloridos trocam o realce pelo fundo claro
            da própria cor. */}
        <DropdownMenuContent align="end">
          {entrarAgora && (
            <DropdownMenuItem
              disabled={entrarAgora.enviando}
              onClick={entrarAgora.aoEntrar}
              className="group flex-col items-start gap-0.5"
            >
              <span className="inline-flex items-center">
                <Send className="mr-2 h-4 w-4" aria-hidden="true" />
                {entrarAgora.enviando ? 'Enviando ao robô…' : 'Entrar agora'}
              </span>
              <span className="pl-6 text-xs text-muted-foreground group-focus:text-accent-foreground/85">
                O robô entra na disputa já, sem esperar o horário. Com o Modo Automático ligado, ele pode dar lance.
              </span>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => setDetalhesAbertos(true)}>
            <Info className="mr-2 h-4 w-4" aria-hidden="true" /> Detalhes da licitação
          </DropdownMenuItem>
          {conferirAlteracoes && (
            <DropdownMenuItem onClick={conferirAlteracoes} className="group flex-col items-start gap-0.5">
              <span className="inline-flex items-center">
                <FileSearch className="mr-2 h-4 w-4" aria-hidden="true" /> Conferir alterações da licitação
              </span>
              <span className="pl-6 text-xs text-muted-foreground group-focus:text-accent-foreground/85">
                Pregão remarcado? Compara data, itens, quantidades e unidades com o cadastro.
              </span>
            </DropdownMenuItem>
          )}
          {/* Ícone de mão, não de play/pause: play e pause prometiam ligar e
              desligar o robô. Some com a disputa encerrada — ali o clique não
              fazia nada. */}
          {proxima && (
            <DropdownMenuItem onClick={() => void alternarFase()} className="group flex-col items-start gap-0.5">
              <span className="inline-flex items-center">
                <Hand className="mr-2 h-4 w-4" aria-hidden="true" />
                {lance.status === 'aguardando' ? 'Marcar como em disputa (manual)' : 'Marcar como aguardando (manual)'}
              </span>
              <span className="pl-6 text-xs text-muted-foreground group-focus:text-accent-foreground/85">
                Só registra a fase. Não inicia nem para o robô.
              </span>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            className="text-success-ink focus:bg-success-tint focus:text-success-ink"
            onClick={() => void encerrar('venceu')}
          >
            <Trophy className="mr-2 h-4 w-4" aria-hidden="true" /> Encerrar como Venceu
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:bg-destructive-tint focus:text-destructive-ink"
            onClick={() => void encerrar('perdeu')}
          >
            <XCircle className="mr-2 h-4 w-4" aria-hidden="true" /> Encerrar como Perdeu
          </DropdownMenuItem>
          {/* Apagar a disputa é definitivo (a linha sai do banco, com itens e
              limites) e ficava a um clique: uma disputa foi apagada sem querer
              em 17/09/2026. Agora o clique só abre a confirmação. */}
          <DropdownMenuItem
            className="text-destructive focus:bg-destructive-tint focus:text-destructive-ink"
            onClick={() => setConfirmandoRemocao(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" /> Remover disputa
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={detalhesAbertos} onOpenChange={setDetalhesAbertos}>
        {/* Largo, em duas colunas (Ian, 17/09/2026): em 448 px o objeto da
            compra virava uma coluna de 15 linhas. Os campos curtos andam em
            pares; empresa, órgão, objeto e data ocupam a linha inteira. */}
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da licitação</DialogTitle>
          </DialogHeader>
          {/* Nenhum travessão mudo: ou o dado real, ou `ValorIndisponivel` com a
              razão de ele não estar aqui. */}
          <div className="grid gap-x-6 sm:grid-cols-2">
            {[
              {
                icon: Building2,
                label: 'Empresa',
                largo: true,
                value: empresaAtiva?.razao_social ?? <ValorIndisponivel razao="Nenhuma empresa ativa selecionada" />,
              },
              {
                icon: Hash,
                label: 'CNPJ',
                value: empresaAtiva?.cnpj ?? <ValorIndisponivel razao="Nenhuma empresa ativa selecionada" />,
              },
              { icon: Globe, label: 'Portal', value: lance.portal },
              { icon: Hash, label: 'Licitação', value: lance.edital },
              {
                icon: Hash,
                label: 'UASG',
                value: lance.uasg ?? <ValorIndisponivel razao="UASG não informada no cadastro da disputa" />,
              },
              {
                icon: Building2,
                label: 'Órgão',
                largo: true,
                value: orgaoCarregando ? (
                  <ValorIndisponivel razao="Consultando o processo vinculado" />
                ) : (
                  orgaoDoProcesso ??
                  (compra?.orgao ? `${compra.orgao} — Compras.gov` : null) ??
                  semCompra(lance.licitacaoId ? 'O processo vinculado não registra o órgão' : 'Disputa sem processo vinculado')
                ),
              },
              ...(temCompra
                ? [
                    {
                      icon: Gavel,
                      label: 'Modalidade',
                      value: compra?.modalidade ?? semCompra('O Compras.gov não informa a modalidade'),
                    },
                    {
                      icon: Clock,
                      label: 'Propostas até',
                      value: compra?.propostasAte ? `${compra.propostasAte} (Compras.gov)` : semCompra('O Compras.gov não informa o prazo'),
                    },
                    {
                      icon: FileText,
                      label: 'Objeto',
                      largo: true,
                      value: compra?.objeto ?? semCompra('O Compras.gov não informa o objeto'),
                    },
                  ]
                : []),
              {
                icon: CalendarDays,
                label: 'Data de abertura',
                largo: true,
                value: (() => {
                  const agenda = agendamentoDaDisputa({ dataSessao: lance.dataSessao, horario: lance.horario });
                  if (agenda.tipo === 'agendada') return `${agenda.texto} — o robô entra sozinho ${agenda.textoEntrada}`;
                  if (agenda.tipo === 'so-horario') return `${agenda.texto}, sem data — o robô só entra por Ações › Entrar agora`;
                  if (agenda.tipo === 'so-data') return `${agenda.texto}, sem horário — o robô só entra por Ações › Entrar agora`;
                  return <ValorIndisponivel razao="Data e horário da sessão não cadastrados" />;
                })(),
              },
              {
                icon: FileText,
                label: 'Sistema de Registro de Preços',
                // O cadastro não guarda SRP — afirmar "Não" seria inventar um dado
                // sobre o edital. Com a compra lida no Compras.gov, vale o que ela diz.
                value: compra?.srp
                  ? `${compra.srp} (Compras.gov)`
                  : semCompra('Não apurado — o cadastro não registra SRP'),
              },
              { icon: TrendingDown, label: 'Valor de Referência', value: moeda(lance.valorReferencia) },
              { icon: Target, label: 'Valor Inicial (1º Lance)', value: moeda(lance.valorInicial) },
              { icon: AlertTriangle, label: 'Valor Mínimo (Piso)', value: moeda(lance.valorMinimo) },
              { icon: ArrowDown, label: 'Decremento Mínimo', value: moeda(lance.decrementoMin) },
              { icon: ArrowDown, label: 'Decremento Percentual', value: `${lance.decrementoPercentual}%` },
              { icon: Clock, label: 'Intervalo entre lances', value: `${lance.intervaloSegundos}s` },
              { icon: ListChecks, label: 'Máx. Lances', value: textoDoLimiteDeLances(lance.maxLances) },
              { icon: Bot, label: 'Modo', value: lance.modoAutomatico ? 'Automático' : 'Manual' },
              { icon: Shield, label: 'Nível de Automação', value: `Nível ${nivel} — ${ROTULO_DO_NIVEL[nivel]}` },
            ].map((item) => (
              <div
                key={item.label}
                className={`flex items-start gap-3 border-b border-border px-1 py-3${item.largo ? ' sm:col-span-2' : ''}`}
              >
                <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{item.label}</p>
                  <p className="break-words text-sm text-muted-foreground">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
          {compra?.urlPncp && (
            <a
              href={compra.urlPncp}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-fit items-center gap-1 rounded px-1 text-sm font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Ver a compra no PNCP <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmandoRemocao} onOpenChange={(aberto) => !removendo && setConfirmandoRemocao(aberto)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover a disputa {lance.edital}?</AlertDialogTitle>
            <AlertDialogDescription>
              A disputa é apagada de vez, com os itens, os limites e a agenda do robô. Não dá para desfazer: para
              voltar, é preciso cadastrá-la de novo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removendo}>Cancelar</AlertDialogCancel>
            <Button variant="destructive" disabled={removendo} onClick={() => void remover()}>
              <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
              {removendo ? 'Removendo…' : 'Remover de vez'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RegistrarPerdaDialog
        alvo={perdaAlvo}
        salvando={salvandoPerda}
        onCancelar={() => setPerdaAlvo(null)}
        onConfirmar={confirmarPerda}
      />
    </>
  );
}
