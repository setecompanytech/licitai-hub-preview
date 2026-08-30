import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { FileArchive, FileText, Loader2, Package, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';
import {
  avaliarCertidoes, podeEnviar, type CertidaoAvaliada, type DocumentoEmpresa,
} from '@/lib/faturamento/certidoes';
import { baixarCertidoes, indiceDoKit, montarPdfUnico, montarZip, baixar } from '@/lib/faturamento/kit';
import { gerarReciboPdf, type DadosDoRecibo } from '@/lib/faturamento/recibo';

/**
 * Kit que acompanha a NF-e: recibo de quitação + certidões negativas.
 *
 * O alerta vem ANTES do download, não depois: certidão vencida enviada ao
 * órgão volta como pendência e trava o pagamento. Vencida não entra no pacote,
 * mas aparece nomeada na lista e no índice — a falta é informada, nunca
 * silenciosa.
 */

const CORES: Record<CertidaoAvaliada['situacao'], string> = {
  valida: 'bg-success/10 text-success border-success/30',
  vence_em_breve: 'bg-warning/10 text-warning border-warning/30',
  sem_validade: 'bg-muted text-muted-foreground border-border',
  vencida: 'bg-destructive/10 text-destructive border-destructive/30',
  ausente: 'bg-destructive/10 text-destructive border-destructive/30',
};

const ROTULOS: Record<CertidaoAvaliada['situacao'], string> = {
  valida: 'válida',
  vence_em_breve: 'vence em breve',
  sem_validade: 'sem validade cadastrada',
  vencida: 'vencida',
  ausente: 'não cadastrada',
};

type Props = {
  pedido: {
    id: string;
    numero_pedido: string;
    valor_total: number;
    nota_fiscal?: string | null;
    contrato_id: string;
    /** Opcionais: a aba do contrato não os tem em mãos, e o kit busca. */
    contrato_numero?: string | null;
    orgao?: string | null;
  };
};

export default function KitFaturamento({ pedido }: Props) {
  const { empresaAtiva } = useEmpresa();
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [gerando, setGerando] = useState<'zip' | 'pdf' | null>(null);
  const [certidoes, setCertidoes] = useState<CertidaoAvaliada[]>([]);
  const [remessa, setRemessa] = useState<number | null>(null);
  const [contrato, setContrato] = useState<{ numero: string | null; orgao: string | null }>({
    numero: pedido.contrato_numero ?? null,
    orgao: pedido.orgao ?? null,
  });

  useEffect(() => {
    if (!aberto || !empresaAtiva?.id) return;
    let vivo = true;
    (async () => {
      setCarregando(true);
      const [docsRes, pedidosRes, contratoRes] = await Promise.all([
        // `as any`: empresa_id foi criada na migration 20260818000007 e os tipos
        // gerados ainda não a conhecem — sem isso o TS estoura em recursão.
        (supabase.from('documentos') as any)
          .select('id, nome, validade, arquivo_path')
          .eq('empresa_id', empresaAtiva.id),
        // Qual remessa é esta dentro do contrato — "8ª remessa" no recibo.
        supabase.from('contrato_pedidos')
          .select('id, data_pedido')
          .eq('contrato_id', pedido.contrato_id)
          .neq('status', 'cancelado')
          .order('data_pedido', { ascending: true }),
        supabase.from('contratos')
          .select('numero_contrato, orgao_contratante')
          .eq('id', pedido.contrato_id)
          .maybeSingle(),
      ]);
      if (!vivo) return;
      setCertidoes(avaliarCertidoes((docsRes.data as DocumentoEmpresa[]) ?? []));
      const ordem = ((pedidosRes.data as { id: string }[]) ?? []).findIndex((p) => p.id === pedido.id);
      setRemessa(ordem >= 0 ? ordem + 1 : null);
      const c = contratoRes.data as { numero_contrato?: string; orgao_contratante?: string } | null;
      setContrato({
        numero: pedido.contrato_numero ?? c?.numero_contrato ?? null,
        orgao: pedido.orgao ?? c?.orgao_contratante ?? null,
      });
      setCarregando(false);
    })();
    return () => { vivo = false; };
  }, [aberto, empresaAtiva?.id, pedido.id, pedido.contrato_id]);

  const vencidas = certidoes.filter((c) => c.situacao === 'vencida');
  const ausentes = certidoes.filter((c) => c.situacao === 'ausente');
  const enviaveis = certidoes.filter(podeEnviar);

  const montar = async (formato: 'zip' | 'pdf') => {
    if (!empresaAtiva?.id) return;
    setGerando(formato);
    try {
      const { data: empresa } = await supabase
        .from('empresas').select('*').eq('id', empresaAtiva.id).maybeSingle();
      const { data: conta } = await supabase
        .from('fin_contas' as never)
        .select('banco_nome, agencia, numero_conta')
        .eq('empresa_id', empresaAtiva.id)
        .limit(1).maybeSingle();

      const dados: DadosDoRecibo = {
        orgao: contrato.orgao ?? '—',
        valor: Number(pedido.valor_total) || 0,
        notaFiscal: pedido.nota_fiscal ?? null,
        empenho: pedido.numero_pedido ?? null,
        remessa,
        numeroContrato: contrato.numero,
      };
      const recibo = gerarReciboPdf(empresa as never, (conta as never) ?? null, dados);

      const { pecas, falhas } = await baixarCertidoes(certidoes);
      const nomeBase = `kit-faturamento-${(pedido.nota_fiscal || pedido.numero_pedido || 'pedido')
        .replace(/[^\w.-]/g, '_')}`;
      const todas = [{ nome: '00-Recibo.pdf', blob: recibo }, ...pecas];

      if (formato === 'zip') {
        const indice = indiceDoKit(certidoes, falhas, [
          `KIT DE FATURAMENTO — ${empresa?.razao_social ?? ''}`,
          `Pedido ${pedido.numero_pedido}${pedido.nota_fiscal ? ` · NF ${pedido.nota_fiscal}` : ''}`,
          `Contrato ${contrato.numero ?? '—'} · ${contrato.orgao ?? '—'}`,
        ]);
        baixar(await montarZip(todas, indice), `${nomeBase}.zip`);
      } else {
        const { blob, ignorados } = await montarPdfUnico(todas);
        baixar(blob, `${nomeBase}.pdf`);
        if (ignorados.length) {
          toast.warning(`Fora do PDF (formato não suportado): ${ignorados.join(', ')}`);
        }
      }

      if (falhas.length) toast.warning(`Não foi possível baixar: ${falhas.join(', ')}`);
      else toast.success('Kit gerado.');
    } catch (e) {
      toast.error('Erro ao montar o kit: ' + (e as Error).message);
    } finally {
      setGerando(null);
    }
  };

  return (
    <>
      {/* Ícone, não rótulo: numa linha de tabela com cinco ações, os 120px
          do texto eram exatamente o que transbordava e cortava os botões
          seguintes. O título no hover mantém a descoberta. */}
      <Button size="icon" variant="outline" className="h-7 w-7"
        title="Kit de faturamento" onClick={() => setAberto(true)}>
        <Package className="w-4 h-4" />
      </Button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-4 h-4 text-muted-foreground" /> Kit de faturamento
            </DialogTitle>
            <DialogDescription>
              Recibo de quitação e certidões para acompanhar a NF-e do pedido{' '}
              {pedido.numero_pedido}
              {contrato.numero ? ` · contrato ${contrato.numero}` : ''}
            </DialogDescription>
          </DialogHeader>

          {carregando ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-3">
              {(vencidas.length > 0 || ausentes.length > 0) && (
                <div className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <p className="font-medium text-destructive">
                      {vencidas.length > 0 && `${vencidas.length} certidão(ões) vencida(s)`}
                      {vencidas.length > 0 && ausentes.length > 0 && ' · '}
                      {ausentes.length > 0 && `${ausentes.length} não cadastrada(s)`}
                    </p>
                    <p className="text-muted-foreground">
                      Não entram no pacote. Renove em Jurídico → Documentos antes de enviar ao
                      órgão — certidão vencida volta como pendência e trava o pagamento.
                    </p>
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-border divide-y divide-border">
                {certidoes.map((c) => (
                  <div key={c.nome} className="flex items-center gap-2 p-2.5 text-xs">
                    <span className="flex-1 min-w-0 truncate">{c.nome}</span>
                    {c.documento?.validade && (
                      <span className="text-muted-foreground tabular-nums whitespace-nowrap">
                        {new Date(c.documento.validade.slice(0, 10) + 'T12:00:00')
                          .toLocaleDateString('pt-BR')}
                      </span>
                    )}
                    <Badge variant="outline" className={`text-xs ${CORES[c.situacao]}`}>
                      {ROTULOS[c.situacao]}
                    </Badge>
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground">
                O pacote leva o recibo de quitação mais {enviaveis.length} certidão(ões).
              </p>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setAberto(false)}>Fechar</Button>
            <Button variant="outline" disabled={!!gerando || carregando} onClick={() => montar('zip')}>
              {gerando === 'zip' ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                 : <FileArchive className="w-3.5 h-3.5 mr-1.5" />}
              Baixar ZIP
            </Button>
            <Button disabled={!!gerando || carregando} onClick={() => montar('pdf')}>
              {gerando === 'pdf' ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                 : <FileText className="w-3.5 h-3.5 mr-1.5" />}
              Baixar PDF único
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
