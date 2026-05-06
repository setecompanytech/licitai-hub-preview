import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

const STATUS_CORES: Record<JuridicoPedidoStatus, string> = {
  rascunho: 'bg-muted text-muted-foreground border-border',
  em_revisao: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  gerado: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  assinado: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/30',
  protocolado: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
  em_analise: 'bg-orange-500/10 text-orange-600 border-orange-500/30',
  deferido: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  indeferido: 'bg-destructive/10 text-destructive border-destructive/30',
  parcialmente_deferido: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
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
      <div className="space-y-2">
        {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted/30 rounded-lg animate-pulse" />)}
      </div>
    );
  }

  if (pedidos.length === 0) {
    return (
      <div className="text-center py-10 border border-dashed border-border/50 rounded-xl">
        <FileText className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
        <p className="text-sm text-muted-foreground">Nenhum pedido jurídico criado ainda.</p>
        <p className="text-xs text-muted-foreground mt-1">Use o gerador acima para criar um pedido de Reajuste, Repactuação ou Revisão.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {pedidos.map(p => (
        <div
          key={p.id}
          className="bg-card border border-border/50 rounded-lg p-3 hover:border-accent/40 transition-colors"
        >
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="outline" className="text-[10px] gap-1 whitespace-nowrap">
              <Hash className="w-3 h-3" /> {p.numero_formatado || `${p.tipo}-${p.sequencial}`}
            </Badge>
            <Badge className={`text-[10px] border whitespace-nowrap ${STATUS_CORES[p.status]}`}>
              {STATUS_LABELS[p.status]}
            </Badge>
            <Badge variant="secondary" className="text-[10px] whitespace-nowrap">
              {TIPO_LABELS[p.tipo]}
            </Badge>
            <span className="text-xs text-muted-foreground truncate flex-1 min-w-[120px]">
              {p.orgao_contratante || 'Órgão não informado'}
              {p.contrato_numero && ` · CT ${p.contrato_numero}`}
              {p.ata_numero && ` · ATA ${p.ata_numero}`}
            </span>
            <Badge variant="outline" className="text-[10px] gap-1 whitespace-nowrap">
              <History className="w-3 h-3" /> v{p.versoes_count || 0}
            </Badge>
            <div className="flex gap-1 flex-shrink-0 flex-wrap justify-end">
              <Button
                size="sm" variant="ghost"
                className="h-7 px-2 text-muted-foreground hover:text-foreground"
                disabled={!podeMarcarRascunho(p)}
                title={podeMarcarRascunho(p) ? 'Voltar para Rascunho' : 'Indisponível para este status'}
                onClick={() => acaoRascunho(p)}
              >
                <FileEdit className="w-3 h-3 mr-1" /> Rascunho
              </Button>
              <Button
                size="sm" variant="ghost"
                className="h-7 px-2 text-purple-600 hover:bg-purple-500/10 disabled:text-muted-foreground"
                disabled={!podeEnviar(p)}
                title={podeEnviar(p) ? 'Registrar protocolo / envio ao órgão' : 'Gere uma versão e avance o status para enviar'}
                onClick={() => acaoEnviar(p)}
              >
                <Send className="w-3 h-3 mr-1" /> Enviar
              </Button>
              <Button
                size="sm" variant="ghost"
                className="h-7 px-2 text-emerald-600 hover:bg-emerald-500/10 disabled:text-muted-foreground"
                disabled={!podeRegistrarResultado(p)}
                title={podeRegistrarResultado(p) ? 'Registrar deferimento' : 'Disponível após protocolo'}
                onClick={() => acaoResultado(p, 'deferido')}
              >
                <CheckCircle2 className="w-3 h-3 mr-1" /> Deferido
              </Button>
              <Button
                size="sm" variant="ghost"
                className="h-7 px-2 text-destructive hover:bg-destructive/10 disabled:text-muted-foreground"
                disabled={!podeRegistrarResultado(p)}
                title={podeRegistrarResultado(p) ? 'Registrar indeferimento' : 'Disponível após protocolo'}
                onClick={() => acaoResultado(p, 'indeferido')}
              >
                <XCircle className="w-3 h-3 mr-1" /> Indeferido
              </Button>
              <Button
                size="sm" variant="ghost"
                className="h-7 px-2 text-yellow-600 hover:bg-yellow-500/10 disabled:text-muted-foreground"
                disabled={!podeRegistrarResultado(p)}
                title={podeRegistrarResultado(p) ? 'Deferimento parcial' : 'Disponível após protocolo'}
                onClick={() => acaoResultado(p, 'parcialmente_deferido')}
              >
                <ShieldAlert className="w-3 h-3 mr-1" /> Parcial
              </Button>

              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setDetalhe(p)}>
                <Eye className="w-3 h-3 mr-1" /> Abrir
              </Button>
              {onSelecionar && (
                <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => onSelecionar(p)}>
                  Continuar <ArrowRight className="w-3 h-3 ml-1" />
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
                  <Hash className="w-4 h-4 text-accent" />
                  {detalhe.numero_formatado}
                  <Badge className={`text-[10px] border ${STATUS_CORES[detalhe.status]}`}>
                    {STATUS_LABELS[detalhe.status]}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px]">{TIPO_LABELS[detalhe.tipo]}</Badge>
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {detalhe.orgao_contratante || 'Sem órgão'} · Criado em {new Date(detalhe.created_at).toLocaleString('pt-BR')}
                </DialogDescription>
              </DialogHeader>

              {/* Ações rápidas de status */}
              <div className="flex flex-wrap gap-2 items-center bg-muted/30 rounded-lg p-3">
                <span className="text-xs text-muted-foreground">Avançar status:</span>
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
                  <SelectTrigger className="h-8 w-[200px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_LABELS) as JuridicoPedidoStatus[]).map(s => (
                      <SelectItem key={s} value={s} className="text-xs">{STATUS_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {detalhe.numero_protocolo && (
                  <Badge variant="outline" className="text-[10px] gap-1 whitespace-nowrap">
                    Protocolo: {detalhe.numero_protocolo}
                    {detalhe.data_protocolo && ` (${new Date(detalhe.data_protocolo).toLocaleDateString('pt-BR')})`}
                  </Badge>
                )}
                <div className="flex-1" />
                <Button
                  size="sm" variant="ghost"
                  className="h-7 text-destructive hover:text-destructive"
                  onClick={async () => {
                    if (!confirm(`Excluir o pedido ${detalhe.numero_formatado}? Esta ação não pode ser desfeita.`)) return;
                    const ok = await excluirPedido(detalhe.id);
                    if (ok) setDetalhe(null);
                  }}
                >
                  <Trash2 className="w-3 h-3 mr-1" /> Excluir
                </Button>
              </div>

              <Tabs defaultValue="documento" className="space-y-3">
                <TabsList>
                  <TabsTrigger value="documento" className="text-xs gap-1">
                    <FileText className="w-3 h-3" /> Documento (v{versaoSel?.versao ?? 0})
                  </TabsTrigger>
                  <TabsTrigger value="versoes" className="text-xs gap-1">
                    <History className="w-3 h-3" /> Versões ({versoes.length})
                  </TabsTrigger>
                  <TabsTrigger value="historico" className="text-xs gap-1">
                    <Clock className="w-3 h-3" /> Histórico ({historico.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="documento">
                  {loadingDetail ? (
                    <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-accent" /></div>
                  ) : versaoSel ? (
                    <div className="bg-card border border-border/50 rounded-lg p-5">
                      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                        <Badge variant="outline" className="text-[10px]">
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
                  {versoes.map(v => (
                    <div
                      key={v.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        versaoSel?.id === v.id ? 'border-accent bg-accent/5' : 'border-border/50 hover:border-accent/30'
                      }`}
                      onClick={() => setVersaoSel(v)}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px]">v{v.versao}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(v.gerado_em).toLocaleString('pt-BR')}
                        </span>
                        {v.modelo_ia && <Badge variant="secondary" className="text-[10px]">{v.modelo_ia}</Badge>}
                      </div>
                      {v.resumo_alteracao && <p className="text-xs mt-1">{v.resumo_alteracao}</p>}
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="historico" className="space-y-2">
                  {historico.map(h => (
                    <div key={h.id} className="p-3 border border-border/50 rounded-lg">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px]">{h.evento}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(h.criado_em).toLocaleString('pt-BR')}
                        </span>
                        {h.status_anterior && h.status_novo && (
                          <span className="text-[10px] text-muted-foreground">
                            {STATUS_LABELS[h.status_anterior]} → {STATUS_LABELS[h.status_novo]}
                          </span>
                        )}
                      </div>
                      {h.descricao && <p className="text-xs mt-1">{h.descricao}</p>}
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
          <div className="space-y-3">
            <div>
              <label className="text-xs">Número do protocolo</label>
              <Input value={protocoloNum} onChange={e => setProtocoloNum(e.target.value)} placeholder="Ex.: 2026.04.00.123456-7" />
            </div>
            <div>
              <label className="text-xs">Data do protocolo</label>
              <Input type="date" value={protocoloData} onChange={e => setProtocoloData(e.target.value)} />
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
              <CheckCircle2 className="w-3 h-3 mr-1" /> Confirmar protocolo
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Retorno do Órgão */}
      <Dialog open={retornoOpen} onOpenChange={(o) => { setRetornoOpen(o); if (!o) setAcaoAlvo(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {retornoTipo === 'deferido' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
              {retornoTipo === 'indeferido' && <XCircle className="w-4 h-4 text-destructive" />}
              {retornoTipo === 'parcialmente_deferido' && <AlertCircle className="w-4 h-4 text-yellow-600" />}
              Resultado do órgão
            </DialogTitle>
            <DialogDescription>
              {(acaoAlvo ?? detalhe)?.numero_formatado
                ? `Pedido ${(acaoAlvo ?? detalhe)?.numero_formatado} — ${STATUS_LABELS[retornoTipo]}. Descreva a decisão para histórico.`
                : `${STATUS_LABELS[retornoTipo]} — descreva a decisão para histórico.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              value={retornoTexto} onChange={e => setRetornoTexto(e.target.value)}
              placeholder="Cole o resumo da decisão, número do despacho, percentual deferido, etc."
              className="min-h-[100px]"
            />
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
