import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  FileText, Clock, History, Trash2, ArrowRight, Eye, CheckCircle2,
  XCircle, AlertCircle, Loader2, Hash, FileEdit, Send, ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import {
  useJuridicoPedidos, listarVersoes, listarHistorico,
  STATUS_LABELS, STATUS_FLOW, TIPO_LABELS,
  type JuridicoPedido, type JuridicoPedidoStatus, type JuridicoPedidoVersao, type JuridicoPedidoEvento,
} from '@/hooks/useJuridicoPedidos';

// Status sempre com texto (STATUS_LABELS); a cor é reforço via família semântica.
const STATUS_VARIANTE: Record<JuridicoPedidoStatus, 'muted' | 'warning' | 'info' | 'success' | 'danger'> = {
  rascunho: 'muted',
  em_revisao: 'warning',
  gerado: 'info',
  assinado: 'info',
  protocolado: 'info',
  em_analise: 'warning',
  deferido: 'success',
  indeferido: 'danger',
  parcialmente_deferido: 'warning',
};

interface Props {
  onSelecionar?: (pedido: JuridicoPedido) => void;
}

export default function PedidosJuridicosList({ onSelecionar }: Props) {
  const { pedidos, loading, atualizarStatus, excluirPedido } = useJuridicoPedidos();
  const [detalhe, setDetalhe] = useState<JuridicoPedido | null>(null);
  const [versoes, setVersoes] = useState<JuridicoPedidoVersao[]>([]);
  const [historico, setHistorico] = useState<JuridicoPedidoEvento[]>([]);
  const [versaoSel, setVersaoSel] = useState<JuridicoPedidoVersao | null>(null);
  const [protocoloOpen, setProtocoloOpen] = useState(false);
  const [protocoloNum, setProtocoloNum] = useState('');
  const [protocoloData, setProtocoloData] = useState('');
  const [retornoOpen, setRetornoOpen] = useState(false);
  const [retornoTipo, setRetornoTipo] = useState<JuridicoPedidoStatus>('deferido');
  const [retornoTexto, setRetornoTexto] = useState('');
  const [loadingDetail, setLoadingDetail] = useState(false);
  // Pedido alvo das ações rápidas (cards). Quando preenchido, modais salvam neste.
  const [acaoAlvo, setAcaoAlvo] = useState<JuridicoPedido | null>(null);

  // ── Validações de transição de status ──
  const podeMarcarRascunho = (p: JuridicoPedido) =>
    p.status !== 'rascunho' && !['protocolado', 'em_analise', 'deferido', 'indeferido', 'parcialmente_deferido'].includes(p.status);
  const podeEnviar = (p: JuridicoPedido) =>
    (p.versoes_count ?? 0) > 0 && ['rascunho', 'em_revisao', 'gerado', 'assinado'].includes(p.status);
  const podeRegistrarResultado = (p: JuridicoPedido) =>
    ['protocolado', 'em_analise'].includes(p.status);

  const acaoRascunho = async (p: JuridicoPedido) => {
    if (!podeMarcarRascunho(p)) {
      toast.error('Pedido já protocolado/decidido — não pode voltar para Rascunho.');
      return;
    }
    await atualizarStatus(p, 'rascunho', 'Retornado a Rascunho via ação rápida');
  };

  const acaoEnviar = (p: JuridicoPedido) => {
    if ((p.versoes_count ?? 0) === 0) {
      toast.error('Gere ao menos uma versão do documento antes de protocolar.');
      return;
    }
    if (!podeEnviar(p)) {
      toast.error(`Status "${STATUS_LABELS[p.status]}" não permite envio/protocolo.`);
      return;
    }
    setAcaoAlvo(p); setProtocoloOpen(true);
  };

  const acaoResultado = (p: JuridicoPedido, tipo: JuridicoPedidoStatus) => {
    if (!podeRegistrarResultado(p)) {
      toast.error('Só é possível registrar resultado após o protocolo.');
      return;
    }
    setAcaoAlvo(p); setRetornoTipo(tipo); setRetornoOpen(true);
  };


  useEffect(() => {
    if (!detalhe) { setVersoes([]); setHistorico([]); setVersaoSel(null); return; }
    setLoadingDetail(true);
    (async () => {
      const [vs, hs] = await Promise.all([
        listarVersoes(detalhe.id),
        listarHistorico(detalhe.id),
      ]);
      setVersoes(vs);
      setHistorico(hs);
      setVersaoSel(vs[0] || null);
      setLoadingDetail(false);
    })();
  }, [detalhe?.id]);

  if (loading) {
    return (
      <div className="space-y-2" role="status" aria-label="Carregando pedidos">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-md" />)}
      </div>
    );
  }

  if (pedidos.length === 0) {
    return (
      <div className="flex flex-col items-center text-center py-10 gap-3 rounded-lg border border-dashed border-border">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-tint text-primary">
          <FileText className="w-6 h-6" aria-hidden="true" />
        </span>
        <p className="text-base font-semibold">Nenhum pedido jurídico criado ainda</p>
        <p className="text-sm text-muted-foreground max-w-md">Use o gerador acima para criar um pedido de Reajuste, Repactuação ou Revisão.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {pedidos.map(p => (
        <div
          key={p.id}
          className="rounded-md border border-border bg-card p-3 hover:border-primary/40 transition-colors"
        >
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="info" className="gap-1 whitespace-nowrap tabular-nums">
              <Hash className="w-3 h-3" aria-hidden="true" /> {p.numero_formatado || `${p.tipo}-${p.sequencial}`}
            </Badge>
            <Badge variant={STATUS_VARIANTE[p.status]} className="whitespace-nowrap">
              {STATUS_LABELS[p.status]}
            </Badge>
            <Badge variant="muted" className="whitespace-nowrap">
              {TIPO_LABELS[p.tipo]}
            </Badge>
            <span className="text-sm text-muted-foreground truncate flex-1 min-w-[120px]">
              {p.orgao_contratante || 'Órgão não informado'}
              {p.contrato_numero && ` · CT ${p.contrato_numero}`}
              {p.ata_numero && ` · ATA ${p.ata_numero}`}
            </span>
            <Badge variant="info" className="gap-1 whitespace-nowrap tabular-nums">
              <History className="w-3 h-3" aria-hidden="true" /> v{p.versoes_count || 0}
            </Badge>
            <div className="flex gap-1 flex-shrink-0 flex-wrap justify-end">
              <Button
                size="sm" variant="ghost"
                className="text-muted-foreground hover:text-foreground"
                disabled={!podeMarcarRascunho(p)}
                title={podeMarcarRascunho(p) ? 'Voltar para Rascunho' : 'Indisponível para este status'}
                onClick={() => acaoRascunho(p)}
              >
                <FileEdit aria-hidden="true" /> Rascunho
              </Button>
              <Button
                size="sm" variant="ghost"
                className="text-primary hover:text-primary hover:bg-primary-tint disabled:text-muted-foreground"
                disabled={!podeEnviar(p)}
                title={podeEnviar(p) ? 'Registrar protocolo / envio ao órgão' : 'Gere uma versão e avance o status para enviar'}
                onClick={() => acaoEnviar(p)}
              >
                <Send aria-hidden="true" /> Enviar
              </Button>
              <Button
                size="sm" variant="ghost"
                className="text-success hover:text-success hover:bg-success-tint disabled:text-muted-foreground"
                disabled={!podeRegistrarResultado(p)}
                title={podeRegistrarResultado(p) ? 'Registrar deferimento' : 'Disponível após protocolo'}
                onClick={() => acaoResultado(p, 'deferido')}
              >
                <CheckCircle2 aria-hidden="true" /> Deferido
              </Button>
              <Button
                size="sm" variant="ghost"
                className="text-destructive hover:text-destructive hover:bg-destructive-tint disabled:text-muted-foreground"
                disabled={!podeRegistrarResultado(p)}
                title={podeRegistrarResultado(p) ? 'Registrar indeferimento' : 'Disponível após protocolo'}
                onClick={() => acaoResultado(p, 'indeferido')}
              >
                <XCircle aria-hidden="true" /> Indeferido
              </Button>
              <Button
                size="sm" variant="ghost"
                className="text-warning hover:text-warning hover:bg-warning-tint disabled:text-muted-foreground"
                disabled={!podeRegistrarResultado(p)}
                title={podeRegistrarResultado(p) ? 'Deferimento parcial' : 'Disponível após protocolo'}
                onClick={() => acaoResultado(p, 'parcialmente_deferido')}
              >
                <ShieldAlert aria-hidden="true" /> Parcial
              </Button>

              <Button size="sm" variant="ghost" onClick={() => setDetalhe(p)}>
                <Eye aria-hidden="true" /> Abrir
              </Button>
              {onSelecionar && (
                <Button size="sm" variant="outline" onClick={() => onSelecionar(p)}>
                  Continuar <ArrowRight aria-hidden="true" />
                </Button>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Drawer de detalhes */}
      <Dialog open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          {detalhe && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 flex-wrap">
                  <Hash className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                  {detalhe.numero_formatado}
                  <Badge variant={STATUS_VARIANTE[detalhe.status]}>
                    {STATUS_LABELS[detalhe.status]}
                  </Badge>
                  <Badge variant="muted">{TIPO_LABELS[detalhe.tipo]}</Badge>
                </DialogTitle>
                <DialogDescription className="text-sm">
                  {detalhe.orgao_contratante || 'Sem órgão'} · Criado em {new Date(detalhe.created_at).toLocaleString('pt-BR')}
                </DialogDescription>
              </DialogHeader>

              {/* Ações rápidas de status */}
              <div className="flex flex-wrap gap-2 items-center rounded-md border border-border bg-muted/50 p-3">
                <Label htmlFor="pedido-status" className="text-sm text-muted-foreground">Avançar status:</Label>
                <Select
                  value={detalhe.status}
                  onValueChange={async (v) => {
                    if (v === 'protocolado') { setProtocoloOpen(true); return; }
                    if (['deferido', 'indeferido', 'parcialmente_deferido'].includes(v)) {
                      setRetornoTipo(v as JuridicoPedidoStatus); setRetornoOpen(true); return;
                    }
                    await atualizarStatus(detalhe, v as JuridicoPedidoStatus);
                    setDetalhe({ ...detalhe, status: v as JuridicoPedidoStatus });
                  }}
                >
                  <SelectTrigger id="pedido-status" className="w-full sm:w-[220px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_LABELS) as JuridicoPedidoStatus[]).map(s => (
                      <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {detalhe.numero_protocolo && (
                  <Badge variant="info" className="gap-1 whitespace-nowrap tabular-nums">
                    Protocolo: {detalhe.numero_protocolo}
                    {detalhe.data_protocolo && ` (${new Date(detalhe.data_protocolo).toLocaleDateString('pt-BR')})`}
                  </Badge>
                )}
                <div className="flex-1" />
                <Button
                  size="sm" variant="ghost"
                  className="text-destructive hover:text-destructive hover:bg-destructive-tint"
                  onClick={async () => {
                    if (!confirm(`Excluir o pedido ${detalhe.numero_formatado}? Esta ação não pode ser desfeita.`)) return;
                    const ok = await excluirPedido(detalhe.id);
                    if (ok) setDetalhe(null);
                  }}
                >
                  <Trash2 aria-hidden="true" /> Excluir
                </Button>
              </div>

              <Tabs defaultValue="documento" className="space-y-3">
                <TabsList className="flex-wrap h-auto gap-1">
                  <TabsTrigger value="documento" className="gap-1">
                    <FileText className="w-4 h-4" aria-hidden="true" /> Documento (v{versaoSel?.versao ?? 0})
                  </TabsTrigger>
                  <TabsTrigger value="versoes" className="gap-1">
                    <History className="w-4 h-4" aria-hidden="true" /> Versões ({versoes.length})
                  </TabsTrigger>
                  <TabsTrigger value="historico" className="gap-1">
                    <Clock className="w-4 h-4" aria-hidden="true" /> Histórico ({historico.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="documento">
                  {loadingDetail ? (
                    <div className="py-8 flex justify-center" role="status" aria-label="Carregando documento">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" aria-hidden="true" />
                    </div>
                  ) : versaoSel ? (
                    <div className="rounded-lg border border-border bg-card p-6">
                      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                        <Badge variant="info" className="tabular-nums">
                          v{versaoSel.versao} · {new Date(versaoSel.gerado_em).toLocaleString('pt-BR')}
                        </Badge>
                      </div>
                      <div className="prose prose-sm max-w-none dark:prose-invert text-sm">
                        <ReactMarkdown>{versaoSel.conteudo}</ReactMarkdown>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      Nenhuma versão gerada ainda. Volte ao gerador e clique em "Gerar Pedido".
                    </p>
                  )}
                </TabsContent>

                <TabsContent value="versoes" className="space-y-2">
                  {/* Linha selecionável de versão: Button outline "esticado"
                      (h-auto, texto à esquerda) — o foco visível vem da ui. */}
                  {versoes.map(v => (
                    <Button
                      type="button"
                      key={v.id}
                      variant="outline"
                      aria-pressed={versaoSel?.id === v.id}
                      className={`h-auto w-full flex-col items-start justify-start gap-1 whitespace-normal p-3 text-left font-normal ${
                        versaoSel?.id === v.id ? 'border-primary bg-primary-tint' : 'border-border bg-card'
                      }`}
                      onClick={() => setVersaoSel(v)}
                    >
                      <div className="flex w-full flex-wrap items-center gap-2">
                        <Badge variant="info" className="tabular-nums">v{v.versao}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(v.gerado_em).toLocaleString('pt-BR')}
                        </span>
                        {v.modelo_ia && <Badge variant="muted">{v.modelo_ia}</Badge>}
                      </div>
                      {v.resumo_alteracao && <p className="text-sm">{v.resumo_alteracao}</p>}
                    </Button>
                  ))}
                </TabsContent>

                <TabsContent value="historico" className="space-y-2">
                  {historico.map(h => (
                    <div key={h.id} className="p-3 border border-border rounded-md">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="info">{h.evento}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(h.criado_em).toLocaleString('pt-BR')}
                        </span>
                        {h.status_anterior && h.status_novo && (
                          <span className="text-xs text-muted-foreground">
                            {STATUS_LABELS[h.status_anterior]} → {STATUS_LABELS[h.status_novo]}
                          </span>
                        )}
                      </div>
                      {h.descricao && <p className="text-sm mt-1">{h.descricao}</p>}
                    </div>
                  ))}
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Protocolo */}
      <Dialog open={protocoloOpen} onOpenChange={(o) => { setProtocoloOpen(o); if (!o) setAcaoAlvo(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Protocolo</DialogTitle>
            <DialogDescription>
              {(acaoAlvo ?? detalhe)?.numero_formatado
                ? `Pedido ${(acaoAlvo ?? detalhe)?.numero_formatado} — informe os dados do protocolo no órgão.`
                : 'Informe os dados do protocolo no órgão.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="protocolo-num">Número do protocolo</Label>
              <Input id="protocolo-num" value={protocoloNum} onChange={e => setProtocoloNum(e.target.value)} placeholder="Ex.: 2026.04.00.123456-7" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="protocolo-data">Data do protocolo</Label>
              <Input id="protocolo-data" type="date" value={protocoloData} onChange={e => setProtocoloData(e.target.value)} />
            </div>
            <Button
              className="w-full"
              disabled={!protocoloNum.trim() || !protocoloData}
              onClick={async () => {
                const alvo = acaoAlvo ?? detalhe;
                if (!alvo) return;
                if (!protocoloNum.trim() || !protocoloData) {
                  toast.error('Preencha nº e data do protocolo para registrar.');
                  return;
                }
                const { supabase } = await import('@/integrations/supabase/client');
                await supabase.from('juridico_pedidos' as any)
                  .update({
                    numero_protocolo: protocoloNum,
                    data_protocolo: protocoloData,
                  })
                  .eq('id', alvo.id);
                await atualizarStatus(alvo, 'protocolado',
                  `Protocolado sob nº ${protocoloNum} em ${protocoloData}`);
                if (detalhe?.id === alvo.id) {
                  setDetalhe({ ...detalhe, status: 'protocolado', numero_protocolo: protocoloNum, data_protocolo: protocoloData });
                }
                setProtocoloOpen(false); setProtocoloNum(''); setProtocoloData(''); setAcaoAlvo(null);
              }}
            >
              <CheckCircle2 aria-hidden="true" /> Confirmar protocolo
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Retorno do Órgão */}
      <Dialog open={retornoOpen} onOpenChange={(o) => { setRetornoOpen(o); if (!o) setAcaoAlvo(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {retornoTipo === 'deferido' && <CheckCircle2 className="w-4 h-4 text-success" aria-hidden="true" />}
              {retornoTipo === 'indeferido' && <XCircle className="w-4 h-4 text-destructive" aria-hidden="true" />}
              {retornoTipo === 'parcialmente_deferido' && <AlertCircle className="w-4 h-4 text-warning" aria-hidden="true" />}
              Resultado do órgão
            </DialogTitle>
            <DialogDescription>
              {(acaoAlvo ?? detalhe)?.numero_formatado
                ? `Pedido ${(acaoAlvo ?? detalhe)?.numero_formatado} — ${STATUS_LABELS[retornoTipo]}. Descreva a decisão para histórico.`
                : `${STATUS_LABELS[retornoTipo]} — descreva a decisão para histórico.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="retorno-texto">Descrição da decisão</Label>
              <Textarea
                id="retorno-texto"
                value={retornoTexto} onChange={e => setRetornoTexto(e.target.value)}
                placeholder="Cole o resumo da decisão, número do despacho, percentual deferido, etc."
                className="min-h-[100px]"
              />
            </div>
            <Button
              className="w-full"
              disabled={retornoTexto.trim().length < 10}
              onClick={async () => {
                const alvo = acaoAlvo ?? detalhe;
                if (!alvo) return;
                if (retornoTexto.trim().length < 10) {
                  toast.error('Informe ao menos 10 caracteres descrevendo a decisão (auditoria).');
                  return;
                }
                const { supabase } = await import('@/integrations/supabase/client');
                await supabase.from('juridico_pedidos' as any)
                  .update({ retorno_orgao: retornoTexto })
                  .eq('id', alvo.id);
                await atualizarStatus(alvo, retornoTipo, retornoTexto);
                if (detalhe?.id === alvo.id) {
                  setDetalhe({ ...detalhe, status: retornoTipo, retorno_orgao: retornoTexto });
                }
                setRetornoOpen(false); setRetornoTexto(''); setAcaoAlvo(null);
              }}
            >
              Registrar resultado
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
