import { useState } from 'react';
import { FileText, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import EstadoVazio from '@/components/shared/EstadoVazio';
import FaixaIndicadores from '@/components/gestao/FaixaIndicadores';
import { supabase } from '@/integrations/supabase/client';
import { estatisticaDeItens, itemDeNota, type ItemDeNota } from '@/lib/concorrentes/portal-federal';
import EtiquetaDoValor from './EtiquetaDoValor';

/**
 * Preço por item nas notas fiscais eletrônicas emitidas ao governo federal
 * (Onda 2 do Portal da Transparência, 22/09). A aba Preços compara objetos
 * de editais e resume o TOTAL do edital; para um ITEM, o preço está aqui:
 * a nota fiscal traz descrição, NCM, quantidade e valor unitário do que o
 * fornecedor entregou a um órgão federal. Vale para o mercado federal.
 */
type Nota = {
  chaveNotaFiscal?: string;
  numero?: string;
  serie?: string;
  dataEmissao?: string;
  nomeFornecedor?: string;
  cnpjFornecedor?: string;
  municipioFornecedor?: string;
  orgaoDestinatario?: string;
  orgaoSuperiorDestinatario?: string;
  valorNotaFiscal?: number | string;
  tipoEventoMaisRecente?: string;
  itens?: Array<Record<string, unknown>>;
  erroItens?: string;
};

const brl = (v: number | null | undefined) =>
  typeof v === 'number' ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';

export default function NotasFiscaisFederais({ termo }: { termo: string }) {
  const [buscando, setBuscando] = useState(false);
  const [buscou, setBuscou] = useState(false);
  const [erro, setErro] = useState('');
  const [notas, setNotas] = useState<Nota[]>([]);
  const [termoBuscado, setTermoBuscado] = useState('');

  const buscar = async () => {
    const produto = termo.trim();
    if (produto.length < 3) {
      setErro('Descreva o produto com ao menos 3 letras.');
      setBuscou(true);
      return;
    }
    setBuscando(true);
    setErro('');
    try {
      const { data, error } = await supabase.functions.invoke('consulta-transparencia', {
        body: { tipo: 'notas-fiscais-itens', termo: produto, pagina: 1 },
      });
      if (error) throw error;
      if (data?.error) {
        setErro(String(data.error));
        setNotas([]);
      } else {
        setNotas((data?.notas ?? []) as Nota[]);
        setTermoBuscado(produto);
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro na consulta.');
      setNotas([]);
    } finally {
      setBuscando(false);
      setBuscou(true);
    }
  };

  const itens: Array<ItemDeNota & { nota: Nota }> = notas.flatMap((nota) =>
    (nota.itens ?? []).map((raw) => ({ ...itemDeNota(raw), nota })),
  );
  const estatistica = estatisticaDeItens(itens, termoBuscado);
  const itensDoProduto = estatistica.itens as Array<ItemDeNota & { nota: Nota }>;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 grow basis-56">
          <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold leading-6 text-foreground">
            <FileText className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            Preço por item em notas fiscais ao governo federal
            <EtiquetaDoValor natureza="unitario" estagio="faturado" className="font-normal" />
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            O que fornecedores entregaram a órgãos federais, nota a nota: descrição, NCM, quantidade e valor
            unitário. Fonte: API do Portal da Transparência. Só o mercado federal.
          </p>
        </div>
        <Button onClick={buscar} disabled={buscando || termo.trim().length < 3} variant="outline">
          {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {termo.trim() ? `Buscar notas de “${termo.trim().slice(0, 40)}”` : 'Digite o objeto acima'}
        </Button>
      </div>

      {erro && <p className="mt-3 text-sm text-destructive-ink">{erro}</p>}

      {buscou && !buscando && !erro && notas.length === 0 && (
        <div className="mt-4">
          <EstadoVazio
            tamanho="compacto"
            icone={<FileText />}
            titulo="Nenhuma nota fiscal com esse produto"
            descricao="A API procura o nome do produto nos itens das NF-e emitidas a órgãos federais. Tente um nome mais curto ou mais comum."
          />
        </div>
      )}

      {notas.length > 0 && (
        <div className="mt-4 space-y-4">
          {estatistica.amostra > 0 ? (
            <>
              <FaixaIndicadores
                itens={[
                  { rotulo: 'Mediana do valor unitário', valor: brl(estatistica.mediana), detalhe: 'o valor típico da amostra', tom: 'ok' },
                  { rotulo: 'Miolo (Q1–Q3)', valor: `${brl(estatistica.q1)} a ${brl(estatistica.q3)}` },
                  { rotulo: 'Faixa completa', valor: `${brl(estatistica.minimo)} a ${brl(estatistica.maximo)}` },
                  { rotulo: 'Amostra', valor: estatistica.amostra, detalhe: `itens com valor, em ${notas.length} nota(s)` },
                ]}
              />
              {!estatistica.casouTodas && (
                <p className="text-xs text-warning-ink">
                  Nenhum item traz todas as palavras de “{termoBuscado}”; a amostra usa itens com ao menos uma delas. Confira as descrições.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              As notas vieram, mas nenhum item com valor unitário fala de “{termoBuscado}”.
            </p>
          )}

          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>NCM</TableHead>
                  <TableHead className="text-right">Qtd.</TableHead>
                  <TableHead className="text-right">Valor unitário</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Órgão</TableHead>
                  <TableHead>Emissão</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itensDoProduto.slice(0, 60).map((item, i) => (
                  <TableRow key={`${item.nota.chaveNotaFiscal ?? i}-${i}`}>
                    <TableCell className="max-w-[320px] font-medium">{item.descricao || '—'}</TableCell>
                    <TableCell>{item.ncm || '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{item.quantidade ?? '—'} {item.unidade}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{brl(item.valorUnitario)}</TableCell>
                    <TableCell>{item.nota.nomeFornecedor || '—'}</TableCell>
                    <TableCell>{item.nota.orgaoDestinatario || item.nota.orgaoSuperiorDestinatario || '—'}</TableCell>
                    <TableCell>{item.nota.dataEmissao || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="muted">{notas.length} nota(s) na primeira página da API</Badge>
            {notas.some((nt) => nt.erroItens) && <span>Algumas notas não abriram os itens; a amostra usa as que abriram.</span>}
          </div>
        </div>
      )}
    </Card>
  );
}
