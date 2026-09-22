import { useEffect, useState } from 'react';
import { Loader2, Mail, XCircle } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ListaDeCampos, { BlocoDoPainel, type Campo } from '@/components/gestao/ListaDeCampos';
import SeloSituacao, { ValorIndisponivel, type TomSituacao } from '@/components/gestao/SeloSituacao';
import { diaDaValidade } from '@/lib/documentos/situacao';
import {
  ROTULO_DA_SITUACAO_DA_SOLICITACAO, fraseDaSolicitacao, situacaoDaSolicitacao,
  type SituacaoDaSolicitacao, type SolicitacaoDeDocumento,
} from '@/lib/documentos/solicitacoes';

const TOM: Record<SituacaoDaSolicitacao, TomSituacao> = {
  aguardando: 'info',
  prazo_hoje: 'atencao',
  prazo_vencido: 'critico',
  encerrada: 'neutro',
};

/**
 * O selo que a vaga carrega enquanto o pedido está aberto — "Solicitada em
 * 22/09, prazo 07/10". Em azul enquanto se espera, âmbar no dia, vermelho
 * depois do prazo. Texto primeiro: a cor só acelera a varredura.
 */
export function SeloDeSolicitacao({ solicitacao, hoje, className }: {
  solicitacao: SolicitacaoDeDocumento;
  hoje?: Date;
  className?: string;
}) {
  const situacao = situacaoDaSolicitacao(solicitacao, hoje);
  return (
    <SeloSituacao
      tom={TOM[situacao]}
      icone={Mail}
      explicacao={ROTULO_DA_SITUACAO_DA_SOLICITACAO[situacao]}
      className={className}
    >
      {fraseDaSolicitacao(solicitacao, hoje)}
    </SeloSituacao>
  );
}

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

interface PropsDoBloco {
  solicitacao: SolicitacaoDeDocumento;
  salvando: boolean;
  /** Grava o protocolo que o órgão devolveu. */
  aoSalvarProtocolo: (protocolo: string) => void;
  /** Encerra sem PDF — o pedido foi respondido por outro canal, ou abandonado. */
  aoEncerrar: () => void;
}

/**
 * O bloco "Solicitação ao órgão" do painel: o que se pediu, a quem, quando,
 * até quando, e o protocolo — digitado depois, quando o órgão responde.
 *
 * A solicitação encerra SOZINHA quando o PDF é anexado à vaga; o botão de
 * encerrar existe para o caso em que o documento chegou por outro caminho ou
 * o pedido foi abandonado, e pede confirmação porque não há reabrir.
 */
export function BlocoDaSolicitacao({ solicitacao, salvando, aoSalvarProtocolo, aoEncerrar }: PropsDoBloco) {
  const [protocolo, setProtocolo] = useState(solicitacao.protocolo ?? '');
  const [confirmandoEncerramento, setConfirmandoEncerramento] = useState(false);

  // Troca de vaga = outra solicitação: o campo acompanha.
  useEffect(() => {
    setProtocolo(solicitacao.protocolo ?? '');
  }, [solicitacao.id, solicitacao.protocolo]);

  const campos: Campo[] = [
    { rotulo: 'Órgão', largo: true, valor: solicitacao.orgao },
    {
      rotulo: 'E-mail',
      largo: true,
      valor: solicitacao.email_destino
        ? <span className="break-all">{solicitacao.email_destino}</span>
        : <ValorIndisponivel razao="Não informado" />,
    },
    { rotulo: 'Solicitada em', numerico: true, valor: dataHora(solicitacao.solicitada_em) },
    {
      rotulo: 'Prazo de resposta',
      numerico: true,
      valor: solicitacao.prazo_resposta
        ? diaDaValidade(solicitacao.prazo_resposta).toLocaleDateString('pt-BR')
        : <ValorIndisponivel razao="Não informado" />,
    },
    ...(solicitacao.observacao ? [{ rotulo: 'Observação', largo: true, valor: solicitacao.observacao } as Campo] : []),
  ];

  const protocoloMudou = protocolo.trim() !== (solicitacao.protocolo ?? '').trim();

  return (
    <BlocoDoPainel titulo="Solicitação ao órgão">
      <SeloDeSolicitacao solicitacao={solicitacao} className="w-fit" />
      <ListaDeCampos campos={campos} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="solicitacao-protocolo" className="text-xs font-normal leading-4 text-muted-foreground">
          Protocolo (quando o órgão responder)
        </Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id="solicitacao-protocolo"
            className="g-controle max-w-xs rounded-[var(--g-raio)]"
            value={protocolo}
            onChange={(e) => setProtocolo(e.target.value)}
            placeholder="Nº do protocolo"
          />
          <Button size="sm" variant="outline" onClick={() => aoSalvarProtocolo(protocolo)} disabled={salvando || !protocoloMudou}>
            {salvando ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Salvar protocolo
          </Button>
        </div>
      </div>

      <p className="g-meta text-muted-foreground">
        A solicitação encerra sozinha quando o PDF for anexado a esta vaga.
      </p>
      <div>
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive-ink hover:bg-destructive-tint hover:text-destructive-ink"
          onClick={() => setConfirmandoEncerramento(true)}
          disabled={salvando}
        >
          <XCircle aria-hidden="true" /> Encerrar sem PDF
        </Button>
      </div>

      <AlertDialog open={confirmandoEncerramento} onOpenChange={setConfirmandoEncerramento}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar a solicitação sem o PDF?</AlertDialogTitle>
            <AlertDialogDescription>
              A vaga deixa de mostrar &ldquo;solicitada em&rdquo;. Não há como reabrir — para pedir de novo,
              faça uma nova solicitação.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { setConfirmandoEncerramento(false); aoEncerrar(); }}
            >
              Encerrar solicitação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </BlocoDoPainel>
  );
}
