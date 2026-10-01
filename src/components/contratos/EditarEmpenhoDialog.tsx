import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Save, AlertTriangle } from 'lucide-react';
import { ROTULO_DO_EMPENHO } from '@/lib/contratos/empenho';
import {
  consequenciasDeApagar, formularioDoEmpenho, montarAtualizacaoDoEmpenho, problemaDoEmpenho, totaisDasLinhas,
  type EmpenhoOriginal, type FormularioDoEmpenho, type LinhaDoEmpenho,
} from '@/lib/contratos/editar-empenho';

/**
 * Editar / apagar um empenho na íntegra (28/09/2026): número, espécie,
 * data, valor, quantidade, observação e as linhas por cota. Trocar a espécie
 * à mão marca a origem como manual. Apagar mostra o que cai junto (pedidos
 * sem empenho, reforços/anulações, linhas) e deixa escolher se o PDF sai do
 * dossiê ou fica como documento avulso. Apagar é só de administrador (RLS).
 */
export type EmpenhoParaEditar = { id: string; numero: string };
type ItemDoContrato = { id: string; codigo_item?: string | null; descricao: string; unidade?: string | null; valor_unitario?: number | null };
type Props = {
  empenho: EmpenhoParaEditar | null;
  contratoId: string;
  empresaId: string | undefined;
  itensDoContrato: ItemDoContrato[];
  podeApagar: boolean;
  onFechar: () => void;
  onMudou?: () => void;
};
type Db = {
  from: (t: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
  storage: { from: (b: string) => { remove: (p: string[]) => PromiseLike<unknown> } };
};
const db = supabase as unknown as Db;
const brl = (n: number) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
// Os números chegam do banco com ponto ("5.0400"); na tela entram à brasileira ("5,04") — e a lib lê os dois.
const qtdBr = (v: unknown) => (v == null || v === '' ? '' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 4 }));
const moedaBr = (v: unknown) => (v == null || v === '' ? '' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }));

export default function EditarEmpenhoDialog({ empenho, contratoId, empresaId, itensDoContrato, podeApagar, onFechar, onMudou }: Props) {
  const [original, setOriginal] = useState<EmpenhoOriginal | null>(null);
  const [form, setForm] = useState<FormularioDoEmpenho | null>(null);
  const [linhas, setLinhas] = useState<LinhaDoEmpenho[]>([]);
  const [vinculos, setVinculos] = useState<{ pedidos: number; movimentos: number; arquivoNome: string | null }>({ pedidos: 0, movimentos: 0, arquivoNome: null });
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [confirmandoApagar, setConfirmandoApagar] = useState(false);
  /** Os termos do contrato, para o carimbo de referência do empenho (30/09). */
  const [termos, setTermos] = useState<Array<{ id: string; numero_aditivo: string; data_efeitos: string | null; data_assinatura: string | null; data_aditivo: string | null; periodo_inicio: string | null }>>([]);
  const [apagarPdf, setApagarPdf] = useState(true);

  useEffect(() => {
    if (!empenho) { setOriginal(null); setForm(null); setLinhas([]); setConfirmandoApagar(false); return; }
    let vivo = true;
    (async () => {
      setCarregando(true);
      try {
        const [e, itens, pedidos, movs] = await Promise.all([
          db.from('contrato_empenhos').select('id, numero, tipo, tipo_origem, tipo_trecho, valor, quantidade, unidade, data_emissao, exercicio, observacao, arquivo_id, origem_aditivo_id').eq('id', empenho.id).single(),
          db.from('contrato_empenho_itens').select('id, contrato_item_id, cota, descricao, quantidade, unidade, valor_unitario').eq('empenho_id', empenho.id).order('created_at', { ascending: true }),
          db.from('contrato_pedidos').select('id', { count: 'exact', head: true }).eq('empenho_id', empenho.id),
          db.from('contrato_empenho_movimentos').select('id', { count: 'exact', head: true }).eq('empenho_id', empenho.id),
        ]);
        if (!vivo) return;
        if (e.error || !e.data) throw new Error(e.error?.message ?? 'empenho não encontrado');
        const o = e.data as EmpenhoOriginal;
        let arquivoNome: string | null = null;
        if (o.arquivo_id) {
          const a = await db.from('contrato_arquivos').select('nome_arquivo').eq('id', o.arquivo_id).maybeSingle();
          arquivoNome = a.data?.nome_arquivo ?? null;
        }
        setOriginal(o);
        setForm(formularioDoEmpenho(o));
        const t = await db.from('contrato_aditivos').select('id, numero_aditivo, data_efeitos, data_assinatura, data_aditivo, periodo_inicio').eq('contrato_id', contratoId).order('created_at', { ascending: true });
        if (vivo) setTermos((t.data ?? []) as typeof termos);
        setLinhas(((itens.data ?? []) as Array<Record<string, unknown>>).map((l) => ({
          key: String(l.id), id: String(l.id), contrato_item_id: (l.contrato_item_id as string | null) ?? '', descricao: String(l.descricao ?? ''),
          cota: ((l.cota as string | null) ?? '') as LinhaDoEmpenho['cota'], quantidade: qtdBr(l.quantidade), unidade: String(l.unidade ?? ''), valor_unitario: moedaBr(l.valor_unitario),
        })));
        setVinculos({ pedidos: pedidos.count ?? 0, movimentos: movs.count ?? 0, arquivoNome });
      } catch (err) {
        toast.error('Não foi possível abrir o empenho', { description: err instanceof Error ? err.message : String(err) });
        onFechar();
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empenho?.id]);

  const mudarLinha = (key: string, parte: Partial<LinhaDoEmpenho>) => setLinhas((ls) => ls.map((l) => (l.key === key ? { ...l, ...parte } : l)));
  const escolherItem = (key: string, itemId: string) => {
    const item = itensDoContrato.find((i) => i.id === itemId);
    mudarLinha(key, { contrato_item_id: itemId === '__nenhum__' ? '' : itemId, ...(item ? { descricao: item.descricao, unidade: item.unidade ?? '', valor_unitario: item.valor_unitario != null ? String(item.valor_unitario) : '' } : {}) });
  };
  const totais = totaisDasLinhas(linhas);

  // O termo em vigor na data de emissão: a renovação pelo início do período, os demais pela data de efeitos.
  const termoPelaData = (() => {
    const d = form?.data_emissao?.slice(0, 10);
    if (!d) return null;
    let achado: string | null = null;
    for (const t of [...termos].sort((a, b) => String(a.periodo_inicio ?? a.data_efeitos ?? a.data_assinatura ?? a.data_aditivo ?? '').localeCompare(String(b.periodo_inicio ?? b.data_efeitos ?? b.data_assinatura ?? b.data_aditivo ?? '')))) {
      const ini = (t.periodo_inicio ?? t.data_efeitos ?? t.data_assinatura ?? t.data_aditivo ?? '').slice(0, 10);
      if (ini && ini <= d) achado = t.numero_aditivo;
    }
    return achado;
  })();

  const salvar = async () => {
    if (!original || !form || !empresaId) return;
    const problema = problemaDoEmpenho(form, linhas);
    if (problema) { toast.error(problema); return; }
    setSalvando(true);
    try {
      const a = montarAtualizacaoDoEmpenho(original, form, linhas, empresaId);
      const up = await db.from('contrato_empenhos').update(a.empenho).eq('id', original.id);
      if (up.error) throw new Error(up.error.code === '23505' ? `Já existe o empenho ${form.numero.trim()} neste contrato.` : up.error.message);
      // As linhas são regravadas inteiras: o saldo por cota é derivado delas.
      const del = await db.from('contrato_empenho_itens').delete().eq('empenho_id', original.id);
      if (del.error) throw new Error(del.error.message);
      if (a.itens.length > 0) {
        const ins = await db.from('contrato_empenho_itens').insert(a.itens);
        if (ins.error) throw new Error(ins.error.message);
      }
      // O dossiê passa a dizer o que a nota é — antes, editar aqui não aparecia lá.
      if (original.arquivo_id) await db.from('contrato_arquivos').update({ descricao: a.descricaoDoArquivo }).eq('id', original.arquivo_id);
      toast.success(`Empenho ${form.numero.trim()} atualizado${a.mudouEspecie ? ` — espécie agora ${ROTULO_DO_EMPENHO[form.tipo as 'ordinario']?.toLowerCase() ?? form.tipo}, escolhida à mão` : ''}.`);
      onMudou?.();
      onFechar();
    } catch (err) {
      toast.error('Não foi possível salvar', { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setSalvando(false);
    }
  };

  const apagar = async () => {
    if (!original) return;
    setSalvando(true);
    try {
      let storagePath: string | null = null;
      if (original.arquivo_id && apagarPdf) {
        const a = await db.from('contrato_arquivos').select('storage_path').eq('id', original.arquivo_id).maybeSingle();
        storagePath = a.data?.storage_path ?? null;
      }
      // Itens e movimentos caem em cascata; os pedidos ficam (empenho_id vira nulo).
      const del = await db.from('contrato_empenhos').delete().eq('id', original.id);
      if (del.error) throw new Error(/policy|permission|row-level/i.test(del.error.message) ? 'Só o administrador da empresa pode apagar um empenho.' : del.error.message);
      if (original.arquivo_id && apagarPdf) {
        if (storagePath) await db.storage.from('contratos-docs').remove([storagePath]);
        await db.from('contrato_arquivos').delete().eq('id', original.arquivo_id);
      }
      toast.success(`Empenho ${original.numero} apagado${original.arquivo_id ? (apagarPdf ? ' com o PDF' : '; o PDF ficou no dossiê') : ''}.`);
      onMudou?.();
      onFechar();
    } catch (err) {
      toast.error('Não foi possível apagar', { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={!!empenho} onOpenChange={(v) => { if (!v) onFechar(); }}>
      <DialogContent className="max-w-[min(98vw,96rem)] max-h-[94vh] overflow-y-auto" data-testid="editar-empenho">
        <DialogHeader>
          <DialogTitle>Editar empenho {empenho?.numero}</DialogTitle>
          <DialogDescription>Número, espécie, data, valor, observação e as linhas por cota. O que você mudar aqui vale para o saldo e aparece no dossiê.</DialogDescription>
        </DialogHeader>

        {carregando || !form || !original ? (
          <p className="inline-flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Abrindo o empenho…</p>
        ) : confirmandoApagar ? (
          <div className="space-y-3" data-testid="confirmar-apagar">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>
                <p className="font-semibold">Apagar o empenho {original.numero}?</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">{consequenciasDeApagar({ pedidos: vinculos.pedidos, movimentos: vinculos.movimentos, temPdf: !!original.arquivo_id }).map((c) => <li key={c}>{c}</li>)}</ul>
              </AlertDescription>
            </Alert>
            {original.arquivo_id && (
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={apagarPdf} onChange={(e) => setApagarPdf(e.target.checked)} />
                Apagar também o PDF {vinculos.arquivoNome ? <span className="text-muted-foreground">({vinculos.arquivoNome})</span> : null} do dossiê
              </label>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmandoApagar(false)} disabled={salvando}>Voltar</Button>
              <Button variant="destructive" onClick={apagar} disabled={salvando}>{salvando ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />} Apagar de vez</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5"><Label htmlFor="ee-numero">Número</Label><Input id="ee-numero" value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} /></div>
              <div className="space-y-1.5">
                <Label htmlFor="ee-tipo">Espécie</Label>
                <Select value={form.tipo || '__'} onValueChange={(v) => setForm({ ...form, tipo: v as FormularioDoEmpenho['tipo'] })}>
                  <SelectTrigger id="ee-tipo"><SelectValue placeholder="Escolha" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ordinario">{ROTULO_DO_EMPENHO.ordinario}</SelectItem>
                    <SelectItem value="global">{ROTULO_DO_EMPENHO.global}</SelectItem>
                    <SelectItem value="estimativo">{ROTULO_DO_EMPENHO.estimativo}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="g-meta text-muted-foreground">
                  {form.tipo !== original.tipo ? 'Escolhida à mão: a leitura do documento deixa de valer.' : original.tipo_origem === 'documento' ? `Lida do documento${original.tipo_trecho ? `: "${original.tipo_trecho.slice(0, 60)}"` : ''}` : 'Escolhida à mão no registro.'}
                </p>
              </div>
              <div className="space-y-1.5"><Label htmlFor="ee-data">Data de emissão</Label><Input id="ee-data" type="date" value={form.data_emissao} onChange={(e) => setForm({ ...form, data_emissao: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="ee-unidade">Unidade</Label><Input id="ee-unidade" value={form.unidade} onChange={(e) => setForm({ ...form, unidade: e.target.value })} /></div>
              <div className="space-y-1.5">
                <Label htmlFor="ee-valor">Valor (R$)</Label>
                <Input id="ee-valor" inputMode="decimal" value={totais.linhasValidas.length ? moedaBr(totais.valor) : form.valor} disabled={totais.linhasValidas.length > 0} onChange={(e) => setForm({ ...form, valor: e.target.value })} className="text-right tabular-nums" />
                {totais.linhasValidas.length > 0 && <p className="g-meta text-muted-foreground">Soma das linhas: {brl(totais.valor)}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ee-qtd">Quantidade</Label>
                <Input id="ee-qtd" inputMode="decimal" value={totais.linhasValidas.length ? qtdBr(totais.quantidade) : form.quantidade} disabled={totais.linhasValidas.length > 0} onChange={(e) => setForm({ ...form, quantidade: e.target.value })} className="text-right tabular-nums" />
              </div>
              {/* O termo de referência (30/09): em qual janela do contrato o
                  empenho cai. Sem escolha, a janela é a da data de emissão —
                  o mesmo critério do pedido e da nota. Ocupa duas colunas
                  para fechar a fila com Valor e Quantidade. */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="ee-termo">Termo de referência</Label>
                <Select value={form.origem_aditivo_id || '__data__'} onValueChange={(v) => setForm({ ...form, origem_aditivo_id: v === '__data__' ? '' : v })}>
                  <SelectTrigger id="ee-termo"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__data__">Pela data de emissão{termoPelaData ? ` (${termoPelaData})` : ' (contrato original)'}</SelectItem>
                    {termos.map((t) => <SelectItem key={t.id} value={t.id}>{t.numero_aditivo}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="g-meta text-muted-foreground">O empenho reserva na janela desse termo; a nota consome nela.</p>
              </div>
              <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="ee-obs">Observação</Label><Textarea id="ee-obs" value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} className="min-h-10" /></div>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">Linhas do empenho ({linhas.length})</p>
                <Button size="sm" variant="outline" onClick={() => setLinhas((ls) => [...ls, { key: crypto.randomUUID(), contrato_item_id: '', descricao: '', cota: '', quantidade: '', unidade: form.unidade, valor_unitario: '' }])}><Plus aria-hidden="true" /> Linha</Button>
              </div>
              <p className="g-meta text-muted-foreground">Cota principal e reservada (LC 123/2006, art. 48, III) são linhas separadas: cada uma esgota por si.</p>
              {linhas.length > 0 && (
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary"><tr className="text-left text-xs text-muted-foreground"><th className="px-2 py-1.5 w-[24%]">Item do contrato</th><th className="px-2 py-1.5">Descrição</th><th className="px-2 py-1.5 w-32">Cota</th><th className="px-2 py-1.5 w-24 text-right">Qtd</th><th className="px-2 py-1.5 w-16">Unid.</th><th className="px-2 py-1.5 w-28 text-right">Unitário</th><th className="px-2 py-1.5 w-32 whitespace-nowrap text-right">Total</th><th className="px-2 py-1.5 w-10"></th></tr></thead>
                    <tbody className="divide-y divide-border">
                      {linhas.map((l) => {
                        const lerNum = (v: string) => (v.includes(',') ? parseFloat(v.replace(/\./g, '').replace(',', '.')) : parseFloat(v)) || 0;
                        const q = lerNum(String(l.quantidade)); const vu = lerNum(String(l.valor_unitario));
                        return (
                          <tr key={l.key}>
                            <td className="px-2 py-1 min-w-56 align-top">
                              {/* O nome do item cabe inteiro: o gatilho quebra linha em vez de cortar. */}
                              <Select value={l.contrato_item_id || '__nenhum__'} onValueChange={(v) => escolherItem(l.key, v)}>
                                <SelectTrigger className="h-auto min-h-8 whitespace-normal py-1 text-left [&>span]:line-clamp-2" aria-label="Item do contrato"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__nenhum__">— sem vínculo —</SelectItem>
                                  {itensDoContrato.map((i) => <SelectItem key={i.id} value={i.id}>{i.codigo_item ? `${i.codigo_item} · ` : ''}{i.descricao.slice(0, 60)}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="px-2 py-1 min-w-80 align-top"><Textarea className="min-h-8 resize-y py-1.5 text-sm leading-5" rows={1} value={l.descricao} onChange={(e) => mudarLinha(l.key, { descricao: e.target.value })} aria-label="Descrição" title={l.descricao} /></td>
                            <td className="px-2 py-1 align-top">
                              <Select value={l.cota || '__'} onValueChange={(v) => mudarLinha(l.key, { cota: (v === '__' ? '' : v) as LinhaDoEmpenho['cota'] })}>
                                <SelectTrigger className="h-8 w-32" aria-label="Cota"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="__">sem cota</SelectItem><SelectItem value="principal">principal</SelectItem><SelectItem value="reservada">reservada</SelectItem></SelectContent>
                              </Select>
                            </td>
                            <td className="px-2 py-1"><Input className="h-8 w-24 text-right tabular-nums" inputMode="decimal" value={l.quantidade} onChange={(e) => mudarLinha(l.key, { quantidade: e.target.value })} aria-label="Quantidade" /></td>
                            <td className="px-2 py-1"><Input className="h-8 w-16" value={l.unidade} onChange={(e) => mudarLinha(l.key, { unidade: e.target.value })} aria-label="Unidade" /></td>
                            <td className="px-2 py-1"><Input className="h-8 w-28 text-right tabular-nums" inputMode="decimal" value={l.valor_unitario} onChange={(e) => mudarLinha(l.key, { valor_unitario: e.target.value })} aria-label="Valor unitário" /></td>
                            <td className="px-2 py-1 whitespace-nowrap text-right tabular-nums text-muted-foreground">{brl(q * vu)}</td>
                            <td className="px-2 py-1"><Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive-ink" aria-label="Remover linha" onClick={() => setLinhas((ls) => ls.filter((x) => x.key !== l.key))}><Trash2 className="h-4 w-4" aria-hidden="true" /></Button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <p className="g-meta text-muted-foreground">
              {vinculos.pedidos} pedido(s) consomem este empenho · {vinculos.movimentos} reforço(s)/anulação(ões) · {original.arquivo_id ? `PDF: ${vinculos.arquivoNome ?? 'anexado'}` : 'sem PDF anexado'}
            </p>

            <DialogFooter className="flex-wrap gap-2 sm:justify-between">
              {podeApagar ? (
                <Button variant="ghost" className="text-destructive-ink" onClick={() => setConfirmandoApagar(true)} disabled={salvando}><Trash2 aria-hidden="true" /> Apagar empenho</Button>
              ) : (
                <span className="g-meta self-center text-muted-foreground">Apagar é ação do administrador da empresa.</span>
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={onFechar} disabled={salvando}>Cancelar</Button>
                <Button onClick={salvar} disabled={salvando}>{salvando ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />} Salvar</Button>
              </div>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
