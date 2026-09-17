import { useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, FilePlus2, Loader2, PauseCircle, RefreshCw, XCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import type { LanceConfig } from '@/components/robo-lances/ConfigurarLanceDialog';
import { agendamentoDaDisputa, sessaoJaPassou } from '@/lib/robo/agendamento';
import {
  alteracoesDaLicitacao, atualizarDisputaComALicitacao, linhasDasAlteracoes, type AlteracoesDaLicitacao,
} from '@/lib/robo/alteracoes-da-licitacao';
import { detalhesDaCompra, sessaoDaCompra, type CompraDoComprasGov } from '@/lib/robo/compra-comprasgov';
import { nomeDoPortal } from '@/lib/robo/portais';
import { gravarFase } from './disputa-do-robo';
import { useCompraDaDisputa } from './useCompraDaDisputa';

type Props = {
  lance: LanceConfig;
  aberto: boolean;
  aoMudarAberto: (aberto: boolean) => void;
  /** Grava a disputa atualizada (o mesmo caminho de "Editar parâmetros"). */
  aoSalvar: (lance: LanceConfig) => Promise<void>;
  /** A disputa mudou no banco por aqui (encerrada) — a página relê. */
  aoAlterar: () => void;
  /** Portal sem leitura da licitação: começar uma disputa nova. */
  aoCadastrarNova: () => void;
};

/**
 * "Conferir alterações da licitação" — o que substitui "Definir nova data" quando
 * a sessão já passou (Rafael, 17/09/2026).
 *
 * "Tem processos que podem ser cancelados, suspensos, etc pra mudar algo no
 * edital e no TR. Mas acaba sendo um risco pro usuário porque na maioria dos
 * casos, muda tudo, não só a data, mas a quantidade, unidade, descrição." Aqui a
 * pessoa vê o que mudou ANTES de atualizar, e o que mudou não herda o piso
 * decidido para o item antigo. A regra mora em `lib/robo/alteracoes-da-licitacao.ts`.
 *
 * O nome é do produto, não do portal: hoje só o Compras.gov tem a licitação
 * lida pelo sistema; portal que ganhar a leitura entra por `useCompraDaDisputa`
 * sem mudar esta tela. Portal sem leitura não troca a data — orienta a cadastrar
 * de novo.
 */
export default function ConferirAlteracoesDialog({ lance, aberto, aoMudarAberto, aoSalvar, aoAlterar, aoCadastrarNova }: Props) {
  const { ativa, consulta } = useCompraDaDisputa(lance, aberto);
  const queryClient = useQueryClient();
  const [gravando, setGravando] = useState(false);

  // Conferir é olhar AGORA: a leitura em cache da página pode ter minutos.
  useEffect(() => {
    if (!aberto || !ativa) return;
    void queryClient.invalidateQueries({ queryKey: ['compra-comprasgov', lance.uasg ?? '', lance.edital] });
  }, [aberto, ativa, queryClient, lance.uasg, lance.edital]);

  const portal = lance.portal ? nomeDoPortal(lance.portal) : 'o portal';
  const compras = consulta.data ?? [];
  const compra = compras.length === 1 ? compras[0] : null;

  const agenda = agendamentoDaDisputa({ dataSessao: lance.dataSessao, horario: lance.horario });
  const passou = sessaoJaPassou(agenda, new Date());
  const alteracoes = compra
    ? alteracoesDaLicitacao({
        itens: lance.itens,
        inicioSessaoMs: agenda.tipo === 'agendada' ? agenda.sessaoEm.getTime() : null,
        licitacao: compra,
        agora: new Date(),
      })
    : null;

  const fechar = () => aoMudarAberto(false);

  const atualizar = async (c: CompraDoComprasGov, a: AlteracoesDaLicitacao) => {
    setGravando(true);
    try {
      const sessao = sessaoDaCompra(c);
      await aoSalvar(atualizarDisputaComALicitacao(lance, c, a, sessao ? { dataSessao: sessao.dataSessao, horario: sessao.horario } : null));
      fechar();
    } finally {
      setGravando(false);
    }
  };

  const encerrar = async () => {
    setGravando(true);
    const r = await gravarFase(lance.id, 'encerrado');
    setGravando(false);
    if (!r.ok) {
      toast.error(`A disputa não foi encerrada: ${r.motivo}`, { duration: 12000 });
      return;
    }
    toast.info('Disputa encerrada.');
    aoAlterar();
    fechar();
  };

  let corpo: ReactNode;
  let acoes: ReactNode = null;

  if (!ativa) {
    corpo = (
      <Quadro tom="aviso" icone={<AlertTriangle className="h-4 w-4" />} titulo={`O sistema ainda não lê a licitação em ${portal}`}>
        Se o pregão foi remarcado, cadastre uma nova disputa com os itens, as quantidades e as unidades do edital novo. Trocar
        só a data manteria os itens e os pisos do edital antigo.
      </Quadro>
    );
    acoes = (
      <Button onClick={() => { fechar(); aoCadastrarNova(); }}>
        <FilePlus2 className="h-4 w-4" aria-hidden="true" /> Cadastrar nova disputa
      </Button>
    );
  } else if (consulta.isLoading || consulta.isFetching) {
    corpo = (
      <p className="g-corpo flex items-center gap-2 text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Lendo a licitação em {portal}…
      </p>
    );
  } else if (consulta.isError) {
    corpo = (
      <Quadro tom="aviso" icone={<AlertTriangle className="h-4 w-4" />} titulo="Não foi possível ler a licitação agora">
        {(consulta.error as Error).message}
      </Quadro>
    );
    acoes = (
      <Button variant="outline" onClick={() => void consulta.refetch()}>
        <RefreshCw className="h-4 w-4" aria-hidden="true" /> Tentar novamente
      </Button>
    );
  } else if (!compra || !alteracoes) {
    corpo = (
      <Quadro tom="aviso" icone={<AlertTriangle className="h-4 w-4" />} titulo="Licitação não identificada">
        {compras.length > 1
          ? `Há ${compras.length} licitações com este número nesta unidade compradora — confira a UASG e o número em Editar parâmetros.`
          : 'A licitação não foi encontrada com este número e esta unidade compradora. Se foi republicada com outro número, cadastre uma nova disputa.'}
      </Quadro>
    );
  } else {
    const publicada = detalhesDaCompra(compra).propostasAte;
    const linhas = linhasDasAlteracoes(alteracoes);
    if (alteracoes.resultado === 'revogada') {
      corpo = (
        <Quadro tom="perigo" icone={<XCircle className="h-4 w-4" />} titulo={`A licitação consta como "${alteracoes.situacaoDaLicitacao}"`}>
          Não há disputa a atualizar. Se o órgão publicar uma nova licitação, ela terá outro número: cadastre uma nova disputa.
        </Quadro>
      );
      acoes = (
        <Button variant="outline" disabled={gravando} onClick={() => void encerrar()}>
          Encerrar a disputa
        </Button>
      );
    } else if (alteracoes.resultado === 'suspensa') {
      corpo = (
        <Quadro tom="aviso" icone={<PauseCircle className="h-4 w-4" />} titulo={`A licitação consta como "${alteracoes.situacaoDaLicitacao}"`}>
          Quando for reaberta, confira de novo: costuma voltar com data, itens ou quantidades diferentes. Enquanto estiver
          suspensa, o robô não dá lance nesta disputa.
        </Quadro>
      );
    } else if (alteracoes.resultado === 'itens-mudaram') {
      corpo = (
        <div className="flex flex-col gap-3">
          <Quadro tom="aviso" icone={<AlertTriangle className="h-4 w-4" />} titulo="A licitação mudou">
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {linhas.map((l) => <li key={l}>{l}</li>)}
              {alteracoes.dataMudou && publicada && <li>Sessão: agora {publicada}</li>}
            </ul>
          </Quadro>
          <div className="g-corpo space-y-1 text-muted-foreground">
            <p className="font-medium text-foreground">Ao atualizar:</p>
            <ul className="list-disc space-y-0.5 pl-5">
              <li>os itens que não mudaram mantêm piso e estratégias;</li>
              <li>os itens alterados recebem a descrição, a quantidade e a unidade novas, e ficam <strong>sem piso</strong> — o robô não disputa neles até alguém definir;</li>
              <li>os itens que saíram da licitação saem da disputa;</li>
              <li>o <strong>Modo Automático desliga</strong> e o valor mínimo geral fica vazio: revise e ligue de novo.</li>
            </ul>
          </div>
        </div>
      );
      acoes = (
        <Button disabled={gravando} onClick={() => void atualizar(compra, alteracoes)}>
          {gravando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
          Atualizar a disputa com a licitação
        </Button>
      );
    } else if (alteracoes.resultado === 'so-data') {
      corpo = (
        <Quadro tom="ok" icone={<CheckCircle2 className="h-4 w-4" />} titulo={`Só a data mudou: sessão agora ${publicada}`}>
          Itens, quantidades e unidades conferem com a disputa. Atualizar mantém pisos, estratégias e o Modo Automático.
        </Quadro>
      );
      acoes = (
        <Button disabled={gravando} onClick={() => void atualizar(compra, alteracoes)}>
          {gravando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
          Atualizar a data
        </Button>
      );
    } else {
      corpo = alteracoes.sessaoPublicadaPassou ? (
        <Quadro tom="neutro" icone={<CheckCircle2 className="h-4 w-4" />} titulo="A licitação não foi remarcada">
          A sessão publicada continua {publicada ? `em ${publicada}` : 'a mesma'}, que já passou, e os itens não mudaram. Não
          há o que atualizar: encerre a disputa ou confira de novo mais tarde.
        </Quadro>
      ) : (
        <Quadro tom="ok" icone={<CheckCircle2 className="h-4 w-4" />} titulo="A disputa confere com a licitação">
          Data, itens, quantidades e unidades são os publicados.
        </Quadro>
      );
      if (alteracoes.sessaoPublicadaPassou) {
        acoes = (
          <Button variant="outline" disabled={gravando} onClick={() => void encerrar()}>
            Encerrar a disputa
          </Button>
        );
      }
    }
    if (alteracoes.foraDaDisputa > 0) {
      corpo = (
        <div className="flex flex-col gap-2">
          {corpo}
          <p className="g-meta text-muted-foreground">
            A licitação tem {alteracoes.foraDaDisputa} {alteracoes.foraDaDisputa === 1 ? 'item' : 'itens'} que esta disputa não
            inclui — escolha da empresa, não entra na conferência.
          </p>
        </div>
      );
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={aoMudarAberto}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Conferir alterações da licitação</DialogTitle>
          <DialogDescription>
            {lance.edital}
            {passou ? ' · a sessão cadastrada já passou.' : '.'} Pregão remarcado costuma mudar itens, quantidades e unidades,
            não só a data — confira antes de atualizar.
          </DialogDescription>
        </DialogHeader>
        {corpo}
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={fechar}>Fechar</Button>
          {acoes}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const TOM = {
  aviso: 'border-warning-line bg-warning-tint text-warning-ink',
  perigo: 'border-destructive-line bg-destructive-tint text-destructive-ink',
  ok: 'border-success-line bg-success-tint text-success-ink',
  neutro: 'border-border bg-muted text-foreground',
} as const;

function Quadro({ tom, icone, titulo, children }: { tom: keyof typeof TOM; icone: ReactNode; titulo: string; children: ReactNode }) {
  return (
    <div className={`rounded-lg border px-4 py-3 ${TOM[tom]}`} role="status">
      <p className="flex items-center gap-2 font-semibold">
        <span aria-hidden="true" className="shrink-0">{icone}</span>
        {titulo}
      </p>
      <div className="g-corpo mt-1">{children}</div>
    </div>
  );
}
