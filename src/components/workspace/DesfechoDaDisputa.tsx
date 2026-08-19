import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Trophy, XCircle, FileText, FolderCheck, Archive, CheckCircle2, Loader2, FileSignature,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useLicitacaoIntegration } from '@/hooks/useLicitacaoIntegration';
import RegistrarPerdaDialog from '@/components/metas/RegistrarPerdaDialog';
import { normalizarStatus } from '@/lib/licitacao/status';
import { toast } from 'sonner';

/**
 * O desfecho da disputa como ATO, não como aviso.
 *
 * Encerrado o pregão, o processo parava: o Mural anunciava o resultado e o
 * trabalho seguinte — proposta readequada, dossiê ao pregoeiro, mudança de
 * estado, motivo da perda — acontecia fora do sistema, de memória. Quem venceu
 * na sexta descobria na segunda o que faltava enviar.
 *
 * Aqui o resultado passa a oferecer o que ele exige, cada ação abrindo o lugar
 * certo do próprio processo. Nada de novo no banco: é costura sobre o que já
 * existe — a máquina de status, a pasta de habilitação e o fluxo de perda, que
 * já obriga motivo em três camadas.
 */

type Props = {
  licitacaoId: string;
  numero: string | null;
  orgao: string | null;
  modalidade: string | null;
  valorEstimado: number | null;
  status: string | null;
  /** Leva a pessoa a uma aba da própria pasta, sem sair dela. */
  irParaAba: (aba: string) => void;
  aoMudarStatus?: (novo: string) => void;
};

export default function DesfechoDaDisputa({
  licitacaoId, numero, orgao, modalidade, valorEstimado, status, irParaAba, aoMudarStatus,
}: Props) {
  const { empresaAtiva } = useEmpresa();
  const navigate = useNavigate();
  const { registrarPerda, arquivarProcesso } = useLicitacaoIntegration();
  const [perdaAberta, setPerdaAberta] = useState(false);
  const [salvando, setSalvando] = useState<string | null>(null);

  const atual = normalizarStatus(status);
  const venceu = atual === 'Vencida';
  const perdeu = atual === 'Perdida';
  const homologada = atual === 'Homologada';

  // Só aparece quando a disputa terminou. Antes disso não há desfecho a tratar,
  // e um cartão vazio no topo da Visão Geral seria ruído em todo processo.
  if (!venceu && !perdeu && !homologada) return null;

  const mudarStatus = async (novo: string) => {
    setSalvando(novo);
    const { error } = await supabase.from('licitacoes').update({ status: novo }).eq('id', licitacaoId);
    setSalvando(null);
    if (error) { toast.error(error.message || 'Erro ao atualizar status'); return; }
    toast.success(`Processo movido para ${novo}.`);
    aoMudarStatus?.(novo);
  };

  const confirmarPerda = async ({ motivoId, observacao }: { motivoId: string; observacao: string }) => {
    if (!empresaAtiva) return;
    setSalvando('perda');
    const ok = await registrarPerda({
      licitacaoId, empresaId: empresaAtiva.id, motivoId, observacao,
      modalidade, valorEstimado,
    });
    setSalvando(null);
    if (!ok) return;
    setPerdaAberta(false);
    aoMudarStatus?.('Perdida');
  };

  const arquivar = async () => {
    setSalvando('arquivar');
    const ok = await arquivarProcesso(licitacaoId, true);
    setSalvando(null);
    if (ok) aoMudarStatus?.('Arquivada');
  };

  const ocupado = (chave: string) => salvando === chave;

  return (
    <>
      <Card className={`p-4 border-l-4 ${perdeu ? 'border-l-destructive' : 'border-l-success'}`}>
        <div className="flex items-start gap-3 flex-wrap">
          {perdeu
            ? <XCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            : <Trophy className="w-5 h-5 text-success shrink-0 mt-0.5" />}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">
                {perdeu ? 'Disputa encerrada — não vencemos' : 'Disputa vencida'}
              </span>
              <Badge variant="outline" className="text-xs">{atual}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {perdeu
                ? 'Registre o motivo para o processo contar nas análises do comercial.'
                : homologada
                  ? 'Resultado homologado. O contrato assinado entra em Gestão de Contratos.'
                  : 'O que o portal exige do vencedor está a um clique daqui.'}
            </p>

            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {(venceu || homologada) && (
                <>
                  <Button size="sm" variant="outline" className="h-8 text-xs"
                    onClick={() => irParaAba('proposta')}>
                    <FileText className="w-3.5 h-3.5 mr-1.5" /> Proposta readequada
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs"
                    onClick={() => irParaAba('anexos')}>
                    <FolderCheck className="w-3.5 h-3.5 mr-1.5" /> Pasta de habilitação
                  </Button>
                </>
              )}

              {(venceu || homologada) && (
                <Button size="sm" variant="outline" className="h-8 text-xs"
                  onClick={() => navigate(`/gestao-contratos?novo_de=${licitacaoId}`)}>
                  <FileSignature className="w-3.5 h-3.5 mr-1.5" /> Cadastrar contrato
                </Button>
              )}

              {venceu && (
                <Button size="sm" className="h-8 text-xs"
                  disabled={!!salvando} onClick={() => mudarStatus('Homologada')}>
                  {ocupado('Homologada')
                    ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    : <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />}
                  Mover para Homologada
                </Button>
              )}

              {perdeu && (
                <Button size="sm" variant="outline" className="h-8 text-xs"
                  onClick={() => setPerdaAberta(true)}>
                  <XCircle className="w-3.5 h-3.5 mr-1.5" /> Registrar motivo da perda
                </Button>
              )}

              {(perdeu || homologada) && (
                <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground"
                  disabled={!!salvando} onClick={arquivar}>
                  {ocupado('arquivar')
                    ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    : <Archive className="w-3.5 h-3.5 mr-1.5" />}
                  Arquivar
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      <RegistrarPerdaDialog
        alvo={perdaAberta ? {
          licitacaoId, numero: numero ?? '', orgao: orgao ?? '',
          modalidade, valorEstimado,
        } : null}
        onCancelar={() => setPerdaAberta(false)}
        onConfirmar={confirmarPerda}
        salvando={salvando === 'perda'}
      />
    </>
  );
}
