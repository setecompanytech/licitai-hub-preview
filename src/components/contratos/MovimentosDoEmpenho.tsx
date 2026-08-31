import { useEffect, useState, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MoneyInput } from '@/components/ui/money-input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, TrendingUp, TrendingDown, FileText, Ban } from 'lucide-react';
import { empenhoCancelado } from '@/lib/contratos/empenho';

/**
 * A vida do empenho: original, reforços e anulações.
 *
 * O empenho estimativo não tem UM valor — nasce pequeno e é reforçado conforme
 * o consumo se materializa. O 149/2024 reserva R$ 22,55 num contrato de
 * R$ 81.180,00, e isso é prática regular.
 *
 * Antes disto, aumentar o empenho exigia sobrescrever o campo: o registro
 * passava a dizer que ele sempre teve aquele montante, e a diferença entre
 * "estimei R$ 40 mil" e "estimei R$ 40 mil e reforcei R$ 15 mil em outubro" é
 * justamente o que uma auditoria pergunta.
 *
 * Cada ato é documento próprio, com número e data. O valor vigente é derivado
 * deles — nunca gravado.
 */

export type EmpenhoParaMovimentar = {
  id: string;
  numero: string;
  tipo: string;
  contratoId: string;
};

type Movimento = {
  id: string; tipo: string; numero: string | null;
  valor: number; data_movimento: string; observacao: string | null;
  arquivo_id: string | null;
};

type Vigente = {
  valor_original: number; reforcos: number; anulacoes: number;
  valor_vigente: number; movimentos: number;
};

const brl = (n: number) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBr = (v: string) => new Date(`${v}T12:00:00`).toLocaleDateString('pt-BR');

const ROTULO: Record<string, string> = {
  original: 'Nota original',
  reforco: 'Reforço',
  anulacao: 'Anulação',
};

type Props = {
  empenho: EmpenhoParaMovimentar | null;
  onFechar: () => void;
  onMudou?: () => void;
};

export default function MovimentosDoEmpenho({ empenho, onFechar, onMudou }: Props) {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();

  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [vigente, setVigente] = useState<Vigente | null>(null);
  const [indisponivel, setIndisponivel] = useState(false);

  const [criando, setCriando] = useState(false);
  const [tipo, setTipo] = useState<'reforco' | 'anulacao'>('reforco');
  const [numero, setNumero] = useState('');
  const [valor, setValor] = useState(0);
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [observacao, setObservacao] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const entradaDoArquivo = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    if (!empenho) return;
    setCarregando(true);
    const [mov, vig] = await Promise.all([
      supabase.from('contrato_empenho_movimentos' as never)
        .select('id, tipo, numero, valor, data_movimento, observacao, arquivo_id')
        .eq('empenho_id', empenho.id)
        .order('data_movimento', { ascending: true }),
      supabase.rpc('contrato_empenho_valor_vigente' as never, { p_empenho_id: empenho.id } as never),
    ]);
    setCarregando(false);
    // Migration ainda não colada: a tela se recolhe em vez de barrar quem
    // precisa trabalhar.
    if (mov.error) { setIndisponivel(true); return; }
    setIndisponivel(false);
    setMovimentos((mov.data ?? []) as unknown as Movimento[]);
    setVigente(((vig.data ?? []) as unknown as Vigente[])[0] ?? null);
  }, [empenho]);

  useEffect(() => { void carregar(); }, [carregar]);

  const limpar = () => {
    setCriando(false); setNumero(''); setValor(0); setObservacao(''); setArquivo(null);
    setData(new Date().toISOString().slice(0, 10));
  };

  const salvar = async () => {
    if (!empenho || !empresaAtiva?.id) return;
    if (!(valor > 0)) { toast.error('Informe o valor do movimento.'); return; }
    setSalvando(true);

    // O documento vai para o dossiê do contrato antes, porque é dele que sai o
    // `arquivo_id`. Falhando, o movimento continua: o ato orçamentário
    // aconteceu, e perdê-lo por causa do anexo seria trocar o fato pela prova.
    let arquivoId: string | null = null;
    if (arquivo && user?.id) {
      const caminho = `${user.id}/${empenho.contratoId}/empenhos/${Date.now()}-${arquivo.name.replace(/[^\w.\-]+/g, '_')}`;
      const { error: upErr } = await supabase.storage
        .from('contratos-docs').upload(caminho, arquivo, { upsert: false, contentType: arquivo.type });
      if (upErr) {
        toast.warning('A nota não pôde ser guardada.', { description: upErr.message });
      } else {
        const { data: arq } = await supabase.from('contrato_arquivos').insert({
          contrato_id: empenho.contratoId,
          nome_arquivo: arquivo.name,
          storage_path: caminho,
          tamanho_bytes: arquivo.size,
          tipo: 'ordem_fornecimento',
          descricao: `${ROTULO[tipo]} do empenho ${empenho.numero}`,
          user_id: user.id,
        } as never).select('id').single();
        arquivoId = (arq as { id: string } | null)?.id ?? null;
      }
    }

    const { error } = await supabase.from('contrato_empenho_movimentos' as never).insert({
      empresa_id: empresaAtiva.id,
      empenho_id: empenho.id,
      tipo,
      numero: numero.trim() || null,
      // Sempre positivo: o sinal vem do tipo. Guardar negativo convidaria a
      // somar tudo direto e a errar quando um valor viesse com o sinal já
      // aplicado.
      valor,
      data_movimento: data,
      observacao: observacao.trim() || null,
      arquivo_id: arquivoId,
      created_by: user?.id ?? null,
    } as never);
    setSalvando(false);
    if (error) { toast.error('Não foi possível registrar', { description: error.message }); return; }
    limpar();
    toast.success(`${ROTULO[tipo]} registrado.`);
    void carregar();
    onMudou?.();
  };

  const excluir = async (id: string) => {
    if (!confirm('Excluir este movimento? O valor vigente do empenho volta ao que era.')) return;
    const { error } = await supabase.from('contrato_empenho_movimentos' as never).delete().eq('id', id);
    if (error) { toast.error('Não foi possível excluir', { description: error.message }); return; }
    void carregar();
    onMudou?.();
  };

  const abrirNota = async (arquivoId: string) => {
    const { data: arq } = await supabase
      .from('contrato_arquivos').select('storage_path, nome_arquivo').eq('id', arquivoId).single();
    if (!arq?.storage_path) { toast.error('A nota não foi encontrada no dossiê.'); return; }
    // Bucket dos CONTRATOS: a nota de empenho é documento do contrato.
    const { data: url, error } = await supabase.storage
      .from('contratos-docs').createSignedUrl(arq.storage_path, 600);
    if (error || !url?.signedUrl) { toast.error('Não foi possível abrir a nota.', { description: error?.message }); return; }
    window.open(url.signedUrl, '_blank', 'noopener,noreferrer');
  };

  if (!empenho) return null;

  return (
    <Dialog open onOpenChange={(v) => { if (!v) { limpar(); onFechar(); } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">
            Movimentos do empenho {empenho.numero}
          </DialogTitle>
        </DialogHeader>

        {indisponivel ? (
          <p className="text-sm text-muted-foreground">
            A migration <code className="text-xs">20260831000004</code> ainda não foi aplicada — sem ela
            não há onde registrar reforço e anulação.
          </p>
        ) : (
          <>
            {/* ── O que o empenho comporta hoje ───────────────────────────────
                O original permanece à vista ao lado do vigente: a diferença
                entre os dois É a história, e é ela que a auditoria pergunta. */}
            {/* ── Vigente zero significa duas coisas opostas ─────────────────
                Consumido por inteiro, o empenho cumpriu seu papel. Cancelado,
                ele foi desfeito e nada mais sai por ele. Os dois mostram
                "R$ 0,00", e um contrato executando sobre empenho cancelado é
                exatamente o que o art. 60 proíbe. */}
            {vigente && empenhoCancelado({
              valorOriginal: vigente.valor_original,
              reforcos: vigente.reforcos,
              anulacoes: vigente.anulacoes,
            }) && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2.5">
                <Ban className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-destructive">Empenho cancelado</p>
                  <p className="text-xs text-muted-foreground">
                    A anulação cobre todo o valor empenhado. Ele não autoriza mais nenhuma entrega —
                    e entregar sob empenho cancelado é despesa sem cobertura (Lei 4.320/64, art. 60).
                  </p>
                </div>
              </div>
            )}

            {vigente && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Nota original</p>
                  <p className="font-medium tabular-nums">{brl(vigente.valor_original)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Reforços</p>
                  <p className="font-medium tabular-nums text-success">
                    {vigente.reforcos > 0 ? `+ ${brl(vigente.reforcos)}` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Anulações</p>
                  <p className="font-medium tabular-nums text-warning">
                    {vigente.anulacoes > 0 ? `− ${brl(vigente.anulacoes)}` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Empenhado hoje</p>
                  <p className="font-semibold tabular-nums">{brl(vigente.valor_vigente)}</p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold">Movimentos ({movimentos.length})</h4>
              {!criando && (
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setCriando(true)}>
                  <Plus className="w-3 h-3 mr-1" /> Lançar reforço ou anulação
                </Button>
              )}
            </div>

            {carregando ? (
              <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
            ) : movimentos.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhum movimento registrado. O empenho vale o da nota original.
              </p>
            ) : (
              <div className="space-y-1.5">
                {movimentos.map(m => (
                  <div key={m.id} className="flex items-center gap-2 text-xs border rounded-md p-2">
                    {m.tipo === 'anulacao'
                      ? <TrendingDown className="w-3.5 h-3.5 text-warning shrink-0" />
                      : <TrendingUp className="w-3.5 h-3.5 text-success shrink-0" />}
                    <Badge variant="outline" className="text-[11px] shrink-0">{ROTULO[m.tipo] ?? m.tipo}</Badge>
                    {m.numero && <span className="tabular-nums shrink-0">{m.numero}</span>}
                    <span className="text-muted-foreground shrink-0">{dataBr(m.data_movimento)}</span>
                    {m.observacao && <span className="text-muted-foreground truncate">{m.observacao}</span>}
                    <span className={`ml-auto font-medium tabular-nums shrink-0 ${
                      m.tipo === 'anulacao' ? 'text-warning' : 'text-success'
                    }`}>
                      {m.tipo === 'anulacao' ? '−' : '+'} {brl(m.valor)}
                    </span>
                    {m.arquivo_id && (
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0"
                        title="Ver a nota" onClick={() => abrirNota(m.arquivo_id!)}>
                        <FileText className="w-3 h-3 text-primary" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0"
                      onClick={() => excluir(m.id)}>
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {criando && (
              <div className="border-t pt-3 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">O que houve</Label>
                    <Select value={tipo} onValueChange={v => setTipo(v as 'reforco' | 'anulacao')}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="reforco" className="text-xs">Reforço — acresce ao empenhado</SelectItem>
                        <SelectItem value="anulacao" className="text-xs">Anulação — devolve ao orçamento</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Nº da nota</Label>
                    <Input value={numero} onChange={e => setNumero(e.target.value)}
                      placeholder="2025NE000210" className="h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-xs">Data</Label>
                    <Input type="date" value={data} onChange={e => setData(e.target.value)} className="h-8 text-xs" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Valor</Label>
                    <MoneyInput value={valor} onValueChange={setValor} className="h-8 text-xs" />
                    {/* O sinal vem do TIPO, nunca do número digitado. */}
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Sempre positivo — {tipo === 'anulacao' ? 'a anulação subtrai' : 'o reforço soma'} pelo tipo.
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs">Observação</Label>
                    <Input value={observacao} onChange={e => setObservacao(e.target.value)}
                      placeholder={tipo === 'anulacao' ? 'Encerramento do exercício' : ''}
                      className="h-8 text-xs" />
                  </div>
                </div>

                <div>
                  <Label className="text-xs">A nota (recomendado)</Label>
                  <input ref={entradaDoArquivo} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png"
                    onChange={e => { setArquivo(e.target.files?.[0] ?? null); e.target.value = ''; }} />
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Button type="button" size="sm" variant="outline" className="h-7 text-xs"
                      onClick={() => entradaDoArquivo.current?.click()}>
                      {arquivo ? 'Trocar arquivo' : 'Escolher arquivo'}
                    </Button>
                    <span className="text-[11px] text-muted-foreground">
                      {arquivo
                        ? `${arquivo.name} · guardado ao registrar`
                        : 'Reforço e anulação são notas próprias — é ela que se apresenta.'}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" className="h-8 text-xs" onClick={salvar} disabled={salvando}>
                    {salvando && <Loader2 className="w-3 h-3 animate-spin mr-1" />} Registrar
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={limpar}>Cancelar</Button>
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
