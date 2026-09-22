import { useState } from 'react';
import { FileText, Landmark, Loader2, Receipt, Search, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import EstadoVazio from '@/components/shared/EstadoVazio';
import FaixaIndicadores from '@/components/gestao/FaixaIndicadores';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { contratoFederal, type ContratoFederal } from '@/lib/concorrentes/portal-federal';
import {
  documentoDeDespesa, FASES, recursoRecebido, somaDosValores, totaisPorMes, type DocumentoDeDespesa, type Fase, type RecursoRecebido,
} from '@/lib/concorrentes/credora-da-uniao';

/**
 * A empresa como credora da União (Onda 3 do Portal da Transparência,
 * 22/09): os próprios empenhos, liquidações e pagamentos federais por ano,
 * o total recebido por mês e órgão, os contratos vigentes e as NF-e
 * emitidas a órgãos federais, com o último evento de cada. É o "Empenhos
 * por credor" da União, para casar com o Financeiro. Só faz sentido para
 * quem vende ao governo federal; ETHOS e Santa Rosa vendem ao Estado.
 * Cada bloco carrega sob demanda: quatro fontes, quatro chamadas.
 */
const brl = (v: number | null | undefined) =>
  typeof v === 'number' ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';
const s = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v) : '');
const anoAtual = new Date().getFullYear();

type Nota = {
  numero?: string; serie?: string; dataEmissao?: string; orgaoDestinatario?: string; orgaoSuperiorDestinatario?: string;
  valorNotaFiscal?: number | string; tipoEventoMaisRecente?: string; dataTipoEventoMaisRecente?: string; chaveNotaFiscal?: string;
};

async function chamar(body: Record<string, unknown>): Promise<Array<Record<string, unknown>>> {
  const { data, error } = await supabase.functions.invoke('consulta-transparencia', { body });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return (data?.dados ?? []) as Array<Record<string, unknown>>;
}

export default function MinhaEmpresaFederal() {
  const { empresaAtiva } = useEmpresa();
  const cnpj = (empresaAtiva?.cnpj ?? '').replace(/\D/g, '');
  const [fase, setFase] = useState<Fase>(3);
  const [ano, setAno] = useState(String(anoAtual));
  const [carregando, setCarregando] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const [docs, setDocs] = useState<DocumentoDeDespesa[] | null>(null);
  const [recursos, setRecursos] = useState<RecursoRecebido[] | null>(null);
  const [contratos, setContratos] = useState<ContratoFederal[] | null>(null);
  const [notas, setNotas] = useState<Nota[] | null>(null);

  const carregar = async (bloco: string, corpo: Record<string, unknown>, guardar: (dados: Array<Record<string, unknown>>) => void) => {
    setCarregando(bloco);
    setErro('');
    try {
      guardar(await chamar(corpo));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro na consulta.');
    } finally {
      setCarregando(null);
    }
  };

  if (!cnpj) {
    return (
      <Card>
        <EstadoVazio icone={<Landmark />} titulo="Sem empresa ativa" descricao="Escolha a empresa no topo para consultar o que a União empenhou, liquidou e pagou a ela." />
      </Card>
    );
  }

  const nomeDaFase = FASES.find((f) => f.valor === fase)?.rotulo ?? 'Pagamentos';
  const porMes = recursos ? totaisPorMes(recursos) : [];

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold leading-6 text-foreground">
          <Wallet className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          Minha empresa na União — {empresaAtiva?.razao_social ?? cnpj}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          O que o governo federal empenhou, liquidou e pagou a este CNPJ, os contratos federais e as NF-e emitidas a
          órgãos federais. Fonte: API do Portal da Transparência. Só o Poder Executivo Federal.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="credora-fase">Fase da despesa</Label>
            <Select value={String(fase)} onValueChange={(v) => setFase(Number(v) as Fase)}>
              <SelectTrigger id="credora-fase" className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FASES.map((f) => <SelectItem key={f.valor} value={String(f.valor)}>{f.rotulo}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="credora-ano">Ano</Label>
            <Select value={ano} onValueChange={setAno}>
              <SelectTrigger id="credora-ano" className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[0, 1, 2, 3, 4].map((i) => <SelectItem key={i} value={String(anoAtual - i)}>{anoAtual - i}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button disabled={carregando !== null} onClick={() => carregar('docs', { tipo: 'despesas-favorecido', cnpj, fase, ano: Number(ano), pagina: 1 }, (d) => setDocs(d.map(documentoDeDespesa)))}>
            {carregando === 'docs' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {nomeDaFase} de {ano}
          </Button>
          <Button variant="outline" disabled={carregando !== null} onClick={() => carregar('recursos', { tipo: 'despesas', cnpj, pagina: 1 }, (d) => setRecursos(d.map(recursoRecebido)))}>
            {carregando === 'recursos' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
            Recebido por mês (12 meses)
          </Button>
          <Button variant="outline" disabled={carregando !== null} onClick={() => carregar('contratos', { tipo: 'contratos-cnpj', cnpj, pagina: 1 }, (d) => setContratos(d.map(contratoFederal)))}>
            {carregando === 'contratos' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Contratos federais
          </Button>
          <Button variant="outline" disabled={carregando !== null} onClick={() => carregar('notas', { tipo: 'notas-fiscais', cnpj, pagina: 1 }, (d) => setNotas(d as Nota[]))}>
            {carregando === 'notas' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            NF-e a órgãos federais
          </Button>
        </div>
        {erro && <p className="mt-3 text-sm text-destructive-ink">{erro}</p>}
      </Card>

      {docs && (
        <Card className="p-5">
          <h3 className="mb-3 text-base font-semibold text-foreground">{nomeDaFase} de {ano} <Badge variant="muted">{docs.length}</Badge></h3>
          {docs.length === 0 ? (
            <EstadoVazio tamanho="compacto" icone={<Receipt />} titulo={`Nenhum documento de ${nomeDaFase.toLowerCase()} em ${ano}`} descricao="A API só lista o Poder Executivo Federal; compras estaduais e municipais não aparecem aqui." />
          ) : (
            <>
              <FaixaIndicadores
                itens={[
                  { rotulo: `Total ${nomeDaFase.toLowerCase()}`, valor: brl(somaDosValores(docs)), tom: 'ok' },
                  { rotulo: 'Documentos', valor: docs.length, detalhe: 'primeira página da API' },
                  { rotulo: 'Órgãos', valor: new Set(docs.map((d) => d.orgao).filter(Boolean)).size },
                  { rotulo: 'Via intermediário', valor: docs.filter((d) => d.intermediario).length, detalhe: 'repassados por terceiro' },
                ]}
              />
              <div className="mt-3 rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Documento</TableHead>
                      <TableHead>Órgão</TableHead>
                      <TableHead>Espécie</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {docs.slice(0, 60).map((d) => (
                      <TableRow key={d.documento}>
                        <TableCell>{d.data || '—'}</TableCell>
                        <TableCell className="tabular-nums">{d.documentoResumido}{d.processo ? <span className="block text-xs text-muted-foreground">proc. {d.processo}</span> : null}</TableCell>
                        <TableCell>{d.orgao || d.unidadeGestora || '—'}{d.orgaoSuperior ? <span className="block text-xs text-muted-foreground">{d.orgaoSuperior}</span> : null}</TableCell>
                        <TableCell>{d.especie || d.fase || '—'}{d.elemento ? <span className="block text-xs text-muted-foreground">{d.elemento}</span> : null}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">{brl(d.valor)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </Card>
      )}

      {recursos && (
        <Card className="p-5">
          <h3 className="mb-3 text-base font-semibold text-foreground">Recebido da União por mês <Badge variant="muted">{porMes.length} mês(es)</Badge></h3>
          {porMes.length === 0 ? (
            <EstadoVazio tamanho="compacto" icone={<Receipt />} titulo="Nenhum recebimento federal nos últimos 12 meses" />
          ) : (
            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Mês</TableHead><TableHead className="text-right">Recebido</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {porMes.map((m) => (
                    <TableRow key={m.mes}>
                      <TableCell className="font-medium tabular-nums">{m.mes}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{brl(m.valor)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell className="font-semibold">Total</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{brl(porMes.reduce((a, m) => a + m.valor, 0))}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      )}

      {contratos && (
        <Card className="p-5">
          <h3 className="mb-3 text-base font-semibold text-foreground">Contratos federais <Badge variant="muted">{contratos.length}</Badge></h3>
          {contratos.length === 0 ? (
            <EstadoVazio tamanho="compacto" icone={<FileText />} titulo="Nenhum contrato federal para este CNPJ" />
          ) : (
            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Contrato</TableHead><TableHead>Órgão</TableHead><TableHead>Objeto</TableHead><TableHead>Vigência</TableHead><TableHead className="text-right">Valor</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {contratos.map((c, i) => (
                    <TableRow key={c.id || i}>
                      <TableCell className="font-medium">{c.numero || '—'}{c.situacao ? <span className="block text-xs text-muted-foreground">{c.situacao}</span> : null}</TableCell>
                      <TableCell>{c.orgao || '—'}</TableCell>
                      <TableCell className="max-w-[360px]">{c.objeto || '—'}</TableCell>
                      <TableCell>{c.vigenciaDe}{c.vigenciaAte ? ` a ${c.vigenciaAte}` : ''}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{brl(c.valorFinal ?? c.valorInicial)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      )}

      {notas && (
        <Card className="p-5">
          <h3 className="mb-3 text-base font-semibold text-foreground">NF-e emitidas a órgãos federais <Badge variant="muted">{notas.length}</Badge></h3>
          {notas.length === 0 ? (
            <EstadoVazio tamanho="compacto" icone={<FileText />} titulo="Nenhuma NF-e deste CNPJ a órgão federal" />
          ) : (
            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Nota</TableHead><TableHead>Emissão</TableHead><TableHead>Órgão destinatário</TableHead><TableHead>Último evento</TableHead><TableHead className="text-right">Valor</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {notas.map((nt, i) => (
                    <TableRow key={nt.chaveNotaFiscal || i}>
                      <TableCell className="font-medium tabular-nums">{s(nt.numero) || '—'}{s(nt.serie) ? ` · série ${s(nt.serie)}` : ''}</TableCell>
                      <TableCell>{s(nt.dataEmissao) || '—'}</TableCell>
                      <TableCell>{s(nt.orgaoDestinatario) || s(nt.orgaoSuperiorDestinatario) || '—'}</TableCell>
                      <TableCell>{s(nt.tipoEventoMaisRecente) || '—'}{s(nt.dataTipoEventoMaisRecente) ? <span className="block text-xs text-muted-foreground">{s(nt.dataTipoEventoMaisRecente)}</span> : null}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{brl(typeof nt.valorNotaFiscal === 'number' ? nt.valorNotaFiscal : Number(String(nt.valorNotaFiscal ?? '').replace(/\./g, '').replace(',', '.')) || null)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
