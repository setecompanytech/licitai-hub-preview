import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Wrench, Loader2, RefreshCw, Link2, AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('pt-BR') : '—');

type Props = {
  ataId: string;
  ataNumero?: string | null;
  onAtualizou?: () => void;
};

type ContratoOrfao = {
  id: string;
  numero_contrato: string | null;
  objeto: string | null;
  orgao: string | null;
  data_assinatura: string | null;
  valor_global: number | null;
  sugestao_ata: {
    ata_id: string;
    numero_ata: string | null;
    objeto: string | null;
    orgao: string | null;
    similaridade_objeto: number | null;
  } | null;
};

type ItemOrfao = {
  id: string;
  contrato_id: string;
  numero_contrato: string | null;
  ata_srp_id: string;
  descricao: string;
  unidade: string | null;
  codigo_item: string | null;
  quantidade: number | null;
  valor_unitario: number | null;
  valor_total: number | null;
  sugestao?: { ata_item_id: string; ata_descricao: string; similaridade: number; motivo: string } | null;
};

export default function ManutencaoAtaSrpDialog({ ataId, ataNumero, onAtualizou }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('recalculo');

  // Recálculo
  const [recalculando, setRecalculando] = useState(false);
  const [resultadoRecalc, setResultadoRecalc] = useState<any>(null);

  // Órfãos
  const [carregandoOrfaos, setCarregandoOrfaos] = useState(false);
  const [contratosOrfaos, setContratosOrfaos] = useState<ContratoOrfao[]>([]);
  const [itensOrfaos, setItensOrfaos] = useState<ItemOrfao[]>([]);
  const [aplicandoId, setAplicandoId] = useState<string | null>(null);

  async function carregarOrfaos() {
    setCarregandoOrfaos(true);
    try {
      const { data, error } = await supabase.rpc('relatorio_orfaos_ata_srp' as any, {
        p_ata_id: ataId,
        p_limite: 200,
      });
      if (error) throw error;
      const payload: any = data;
      const contratos: ContratoOrfao[] = payload?.contratos_orfaos || [];
      const itens: ItemOrfao[] = payload?.itens_orfaos || [];
      setContratosOrfaos(contratos);

      // Para cada item órfão, sugerir vínculo via match_itens_ata (1 chamada batch)
      if (itens.length > 0) {
        try {
          const payloadItens = itens.map((i) => ({
            codigo_item: i.codigo_item,
            descricao: i.descricao,
          }));
          const { data: matches, error: errM } = await supabase.rpc('match_itens_ata' as any, {
            p_ata_id: ataId,
            p_itens: payloadItens,
          });
          if (!errM && Array.isArray(matches)) {
            itens.forEach((it, idx) => {
              const m: any = matches[idx];
              if (m?.ata_item_id) {
                it.sugestao = {
                  ata_item_id: m.ata_item_id,
                  ata_descricao: m.ata_descricao,
                  similaridade: Number(m.similaridade || 0),
                  motivo: m.motivo,
                };
              }
            });
          }
        } catch {
          /* ignora; usuário pode escolher manualmente depois */
        }
      }
      setItensOrfaos(itens);
    } catch (e: any) {
      toast.error('Erro ao carregar órfãos: ' + (e.message || 'desconhecido'));
    } finally {
      setCarregandoOrfaos(false);
    }
  }

  useEffect(() => {
    if (open && tab === 'orfaos' && contratosOrfaos.length === 0 && itensOrfaos.length === 0) {
      carregarOrfaos();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab]);

  async function executarRecalculo(escopo: 'ata' | 'todas') {
    setRecalculando(true);
    setResultadoRecalc(null);
    try {
      const { data, error } = await supabase.rpc('recalcular_saldos_atas_srp' as any, {
        p_ata_id: escopo === 'ata' ? ataId : null,
      });
      if (error) throw error;
      setResultadoRecalc(data);
      toast.success('Recálculo concluído');
      onAtualizou?.();
    } catch (e: any) {
      toast.error('Erro no recálculo: ' + (e.message || 'desconhecido'));
    } finally {
      setRecalculando(false);
    }
  }

  async function aplicarVinculoContrato(contratoId: string, ataDestino: string) {
    setAplicandoId(contratoId);
    try {
      const { error } = await supabase.rpc('aplicar_vinculo_ata' as any, {
        p_contrato_id: contratoId,
        p_ata_id: ataDestino,
        p_contrato_item_id: null,
        p_ata_item_id: null,
      });
      if (error) throw error;
      setContratosOrfaos((prev) => prev.filter((c) => c.id !== contratoId));
      toast.success('Contrato vinculado à ATA');
      onAtualizou?.();
    } catch (e: any) {
      toast.error('Falha ao vincular: ' + (e.message || 'desconhecido'));
    } finally {
      setAplicandoId(null);
    }
  }

  async function aplicarVinculoItem(itemId: string, ataItemId: string) {
    setAplicandoId(itemId);
    try {
      const { error } = await supabase.rpc('aplicar_vinculo_ata' as any, {
        p_contrato_id: null,
        p_ata_id: null,
        p_contrato_item_id: itemId,
        p_ata_item_id: ataItemId,
      });
      if (error) throw error;
      setItensOrfaos((prev) => prev.filter((i) => i.id !== itemId));
      toast.success('Item vinculado ao item da ATA');
      onAtualizou?.();
    } catch (e: any) {
      toast.error('Falha ao vincular item: ' + (e.message || 'desconhecido'));
    } finally {
      setAplicandoId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Wrench className="w-4 h-4" />
          Manutenção da ATA
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="w-5 h-5" />
            Manutenção e revisão da ATA {ataNumero ? `nº ${ataNumero}` : ''}
          </DialogTitle>
          <DialogDescription>
            Recalcule saldos antigos e vincule contratos/itens órfãos com sugestão de IA.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="mt-2">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="recalculo" className="gap-2">
              <RefreshCw className="w-4 h-4" /> Recalcular saldos
            </TabsTrigger>
            <TabsTrigger value="orfaos" className="gap-2">
              <Link2 className="w-4 h-4" /> Órfãos & revisão IA
            </TabsTrigger>
          </TabsList>

          {/* RECÁLCULO */}
          <TabsContent value="recalculo" className="space-y-4 pt-4">
            <Card className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="text-sm space-y-1">
                  <p className="font-medium">Quando usar</p>
                  <p className="text-muted-foreground">
                    Reexecuta os cálculos de quantidade consumida, saldo financeiro e valor consumido total.
                    Útil quando você importou dados antigos ou suspeita de divergências de saldo.
                    <strong> Não altera valores informados</strong> — apenas reaplica fórmulas.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button onClick={() => executarRecalculo('ata')} disabled={recalculando} size="sm" className="gap-2">
                  {recalculando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Recalcular esta ATA
                </Button>
                <Button
                  onClick={() => executarRecalculo('todas')}
                  disabled={recalculando}
                  size="sm"
                  variant="outline"
                  className="gap-2"
                >
                  {recalculando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Recalcular todas as minhas ATAs
                </Button>
              </div>
            </Card>

            {resultadoRecalc && (
              <Card className="p-4 bg-success/5 border-success/30">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-success mt-0.5 shrink-0" />
                  <div className="text-sm space-y-1">
                    <p className="font-medium text-success">Recálculo concluído</p>
                    <ul className="text-muted-foreground space-y-0.5">
                      <li>ATAs processadas: <strong>{resultadoRecalc.atas_processadas}</strong></li>
                      <li>Itens recalculados: <strong>{resultadoRecalc.itens_recalculados}</strong></li>
                      <li>Contratos pais recalculados: <strong>{resultadoRecalc.contratos_pais_recalculados}</strong></li>
                    </ul>
                  </div>
                </div>
              </Card>
            )}
          </TabsContent>

          {/* ÓRFÃOS */}
          <TabsContent value="orfaos" className="space-y-5 pt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Contratos sem ATA de origem e itens de contratos derivados sem vínculo a um item da ATA.
              </p>
              <Button onClick={carregarOrfaos} disabled={carregandoOrfaos} size="sm" variant="outline" className="gap-2">
                {carregandoOrfaos ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Recarregar
              </Button>
            </div>

            {/* Contratos órfãos */}
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  Contratos sem ATA de origem
                  <Badge variant="secondary">{contratosOrfaos.length}</Badge>
                </h3>
              </div>
              {carregandoOrfaos ? (
                <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : contratosOrfaos.length === 0 ? (
                <p className="text-sm text-muted-foreground py-3 text-center">
                  Nenhum contrato órfão encontrado para esta ATA (mesmo órgão).
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contrato</TableHead>
                      <TableHead>Órgão</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Sugestão IA</TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contratosOrfaos.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.numero_contrato || '—'}</TableCell>
                        <TableCell className="text-xs">{c.orgao || '—'}</TableCell>
                        <TableCell className="text-xs">{fmtDate(c.data_assinatura)}</TableCell>
                        <TableCell className="text-right text-xs">{fmt(c.valor_global || 0)}</TableCell>
                        <TableCell className="text-xs">
                          {c.sugestao_ata?.ata_id === ataId ? (
                            <Badge variant="outline" className="gap-1">
                              <Sparkles className="w-3 h-3" />
                              Esta ATA ({Math.round((c.sugestao_ata.similaridade_objeto || 0) * 100)}%)
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="default"
                            disabled={aplicandoId === c.id}
                            onClick={() => aplicarVinculoContrato(c.id, ataId)}
                          >
                            {aplicandoId === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Vincular a esta ATA'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>

            {/* Itens órfãos */}
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  Itens sem vínculo ao item da ATA
                  <Badge variant="secondary">{itensOrfaos.length}</Badge>
                </h3>
              </div>
              {carregandoOrfaos ? (
                <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : itensOrfaos.length === 0 ? (
                <p className="text-sm text-muted-foreground py-3 text-center">
                  Todos os itens dos contratos derivados estão vinculados.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contrato</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead>Sugestão IA</TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itensOrfaos.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell className="text-xs">{i.numero_contrato || '—'}</TableCell>
                        <TableCell className="text-xs max-w-[280px] truncate" title={i.descricao}>{i.descricao}</TableCell>
                        <TableCell className="text-right text-xs">{i.quantidade ?? '—'} {i.unidade || ''}</TableCell>
                        <TableCell className="text-xs max-w-[260px]">
                          {i.sugestao ? (
                            <div className="flex items-center gap-1.5">
                              <Sparkles className="w-3 h-3 text-accent shrink-0" />
                              <span className="truncate" title={i.sugestao.ata_descricao}>
                                {i.sugestao.ata_descricao}
                              </span>
                              <Badge variant="outline" className="text-[10px]">
                                {Math.round(i.sugestao.similaridade * 100)}%
                              </Badge>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Sem correspondência</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant={i.sugestao ? 'default' : 'outline'}
                            disabled={!i.sugestao || aplicandoId === i.id}
                            onClick={() => i.sugestao && aplicarVinculoItem(i.id, i.sugestao.ata_item_id)}
                          >
                            {aplicandoId === i.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Aprovar vínculo'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
