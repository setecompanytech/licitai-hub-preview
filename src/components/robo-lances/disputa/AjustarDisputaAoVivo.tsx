import { useState } from 'react';
import { Pause, Play, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { atualizarSessaoDoRobo, pausarOuRetomarRobo, type MudancaNaSessao } from '@/lib/robo/comandos';

/**
 * Mudar a disputa COM ELA RODANDO.
 *
 * Vem da auditoria de 02/10/2026. Até aqui, nada decidido antes da sessão podia
 * ser revisto durante ela: se o preço de mercado desabasse no meio, baixar o
 * piso de UM item exigia **encerrar a sessão inteira e recomeçar**, levando
 * junto os outros 181. Quem disputa muda de ideia no meio — era um caso de "não
 * previmos porque nunca disputamos".
 *
 * Duas ações, e a segunda é tão importante quanto a primeira:
 *
 * - **baixar (ou subir) o piso** de um item, ou da disputa;
 * - **tirar um item do robô** sem derrubar o resto. O robô segue lendo o item,
 *   e a tela segue mostrando valores e posição; ele só para de dar lance. É o
 *   que permite assumir um item na mão sem perder os outros.
 */
export interface ItemAoVivo {
  numero: number;
  descricao?: string | null;
  valorMinimo: number | null;
  /** Está fora do robô agora (por pedido de alguém, não pelo portal). */
  parado?: boolean;
  /** O portal já encerrou este item: não há o que ajustar. */
  encerradoPeloPortal?: boolean;
}

const moeda = (v: number | null) =>
  v === null || v === undefined ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function AjustarDisputaAoVivo({
  sessaoId,
  itens,
  podeOperar,
  aoAtualizar,
  pausado,
}: {
  sessaoId: string;
  itens: ItemAoVivo[];
  podeOperar: boolean;
  /** O robô está pausado nesta disputa agora. */
  pausado?: boolean;
  /** Recarregar a tela depois que o robô confirma. */
  aoAtualizar: () => Promise<void> | void;
}) {
  const [aberto, setAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [pisos, setPisos] = useState<Record<number, string>>({});

  const editaveis = itens.filter((i) => !i.encerradoPeloPortal);

  const enviar = async (mudanca: MudancaNaSessao, oQue: string) => {
    setEnviando(true);
    const r = await atualizarSessaoDoRobo(sessaoId, mudanca);
    setEnviando(false);

    if (!r.ok) {
      // Falha aqui NÃO pode passar por sucesso: a pessoa seguiria achando que o
      // piso novo está valendo enquanto o robô continua no antigo.
      toast.error(r.motivo ?? `Não consegui ${oQue}.`);
      return;
    }
    toast.success(r.mudancas.length ? r.mudancas.join(' · ') : (r.motivo ?? 'Pronto.'));
    setPisos({});
    await aoAtualizar();
  };

  const salvarPisos = async () => {
    const mudados = Object.entries(pisos)
      .map(([numero, texto]) => {
        const limpo = texto.trim().replace(/\./g, '').replace(',', '.');
        const valor = limpo === '' ? null : Number(limpo);
        return { numero: Number(numero), valor };
      })
      .filter((m) => m.valor === null || Number.isFinite(m.valor));

    if (!mudados.length) {
      toast.info('Nenhum piso novo para enviar.');
      return;
    }
    await enviar(
      { itens: mudados.map((m) => ({ numero: m.numero, valor_minimo: m.valor })) },
      'alterar os pisos',
    );
  };

  /**
   * Pausar é diferente de parar: parar encerra a sessão e fecha o navegador;
   * pausar mantém tudo de pé e só suspende o laço. É o que serve quando o
   * pregoeiro suspende a sessão por alguns minutos.
   */
  const alternarPausa = async () => {
    setEnviando(true);
    const r = await pausarOuRetomarRobo(sessaoId, !!pausado);
    setEnviando(false);
    if (!r.ok) {
      toast.error(r.motivo ?? 'Não consegui falar com o robô.');
      return;
    }
    toast.success(pausado ? 'Robô retomado nesta disputa.' : 'Robô pausado — ele continua na sala, sem dar lance.');
    await aoAtualizar();
  };

  const alternarItem = async (item: ItemAoVivo) => {
    const parar = !item.parado;
    await enviar(
      { itens: [{ numero: item.numero, parado: parar }] },
      parar ? 'parar o item' : 'devolver o item ao robô',
    );
  };

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={!podeOperar}>
          <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
          Ajustar durante a disputa
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Ajustar a disputa em andamento</DialogTitle>
          <DialogDescription>
            O robô continua na sala. O que você mudar aqui passa a valer na próxima leitura — sem
            encerrar a sessão e sem perder os outros itens.
          </DialogDescription>
        </DialogHeader>

        {editaveis.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todos os itens desta disputa já foram encerrados pelo portal — não há o que ajustar.
          </p>
        ) : (
          <div className="max-h-[52vh] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center">Item</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Piso atual</TableHead>
                  <TableHead className="w-36 text-right">Piso novo</TableHead>
                  <TableHead className="w-44 text-center">No robô</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {editaveis.map((item) => (
                  <TableRow key={item.numero} className={item.parado ? 'opacity-70' : undefined}>
                    <TableCell className="text-center tabular-nums">{item.numero}</TableCell>
                    <TableCell className="text-sm">{item.descricao ?? '—'}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">{moeda(item.valorMinimo)}</TableCell>
                    <TableCell>
                      <Label htmlFor={`piso-${item.numero}`} className="sr-only">
                        Piso novo do item {item.numero}
                      </Label>
                      <Input
                        id={`piso-${item.numero}`}
                        inputMode="decimal"
                        value={pisos[item.numero] ?? ''}
                        onChange={(e) =>
                          setPisos((p) => ({ ...p, [item.numero]: e.target.value.replace(/[^\d.,]/g, '') }))
                        }
                        placeholder="manter"
                        className="text-right tabular-nums"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant={item.parado ? 'outline' : 'ghost'}
                        size="sm"
                        disabled={enviando}
                        onClick={() => void alternarItem(item)}
                      >
                        {item.parado ? (
                          <>
                            <Play className="w-4 h-4" aria-hidden="true" /> Devolver ao robô
                          </>
                        ) : (
                          <>
                            <Pause className="w-4 h-4" aria-hidden="true" /> Assumir na mão
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          <strong>Assumir na mão</strong> tira o item do robô sem derrubar a disputa: ele continua
          lendo e mostrando os valores, e deixa de dar lance naquele item. Campo de piso vazio
          mantém o que está valendo. <strong>Pausar o robô</strong> suspende a disputa inteira sem
          encerrá-la — ele fica na sala, pronto para voltar.
        </p>

        <DialogFooter className="sm:justify-between">
          <Button variant="outline" onClick={() => void alternarPausa()} disabled={enviando || !podeOperar}>
            {pausado ? (
              <><Play className="w-4 h-4" aria-hidden="true" /> Retomar o robô</>
            ) : (
              <><Pause className="w-4 h-4" aria-hidden="true" /> Pausar o robô</>
            )}
          </Button>
          <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setAberto(false)} disabled={enviando}>
            Fechar
          </Button>
          <Button onClick={() => void salvarPisos()} disabled={enviando || editaveis.length === 0}>
            {enviando ? 'Enviando ao robô…' : 'Aplicar pisos'}
          </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
