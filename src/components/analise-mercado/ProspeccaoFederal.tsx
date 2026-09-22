import { useState } from 'react';
import { HandCoins, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { supabase } from '@/integrations/supabase/client';
import {
  convenioFederal, emendaEhDaUf, emendaFederal, FUNCOES_DE_GOVERNO, NOMES_DAS_UFS, type ConvenioFederal, type EmendaFederal,
} from '@/lib/concorrentes/credora-da-uniao';

/**
 * Prospecção federal (Onda 3 do Portal da Transparência, 22/09): recurso
 * liberado a município ou entidade vira compra em semanas. Dois sinais, sob
 * demanda: convênios com liberação de recurso nos últimos dias na UF, e
 * emendas parlamentares pagas no ano, por função, com gasto na UF.
 *
 * Sob demanda de propósito: a API aceita um dia por consulta de convênios,
 * e um monitor diário pede tabela e rotina — decisão do dono.
 */
const brl = (v: number | null) => (typeof v === 'number' ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—');
const UFS = Object.keys(NOMES_DAS_UFS);
const anoAtual = new Date().getFullYear();

export default function ProspeccaoFederal({ ufInicial = 'PA' }: { ufInicial?: string }) {
  const [uf, setUf] = useState(UFS.includes(ufInicial) ? ufInicial : 'PA');
  const [funcao, setFuncao] = useState('12');
  const [dias, setDias] = useState('7');
  const [ano, setAno] = useState(String(anoAtual));
  const [buscando, setBuscando] = useState<'convenios' | 'emendas' | null>(null);
  const [convenios, setConvenios] = useState<ConvenioFederal[] | null>(null);
  const [emendas, setEmendas] = useState<EmendaFederal[] | null>(null);
  const [erro, setErro] = useState('');

  const chamar = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('consulta-transparencia', { body });
    if (error) throw error;
    if (data?.error) throw new Error(String(data.error));
    return (data?.dados ?? []) as Array<Record<string, unknown>>;
  };

  const buscarConvenios = async () => {
    setBuscando('convenios');
    setErro('');
    try {
      const dados = await chamar({ tipo: 'convenios-liberados', uf, dias: Number(dias), funcao: funcao || undefined });
      const lista = dados.map(convenioFederal);
      setConvenios(lista);
      if (lista.length === 0) toast.info(`Nenhuma liberação de convênio em ${NOMES_DAS_UFS[uf]} nos últimos ${dias} dias para essa função.`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro na consulta.');
      setConvenios(null);
    } finally {
      setBuscando(null);
    }
  };

  const buscarEmendas = async () => {
    setBuscando('emendas');
    setErro('');
    try {
      const dados = await chamar({ tipo: 'emendas', ano: Number(ano), funcao: funcao || undefined, pagina: 1 });
      const lista = dados.map(emendaFederal).filter((e) => emendaEhDaUf(e, uf, NOMES_DAS_UFS[uf] ?? ''));
      setEmendas(lista);
      if (lista.length === 0) toast.info(`A primeira página da API não trouxe emendas de ${ano} com gasto em ${NOMES_DAS_UFS[uf]} nessa função.`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro na consulta.');
      setEmendas(null);
    } finally {
      setBuscando(null);
    }
  };

  return (
    <Card className="p-5">
      <h2 className="flex items-center gap-2 text-lg font-semibold leading-6 text-foreground">
        <HandCoins className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        Prospecção federal — dinheiro liberado vira compra
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Convênios com recurso liberado nos últimos dias e emendas parlamentares pagas na UF, por função de governo.
        Fonte: API do Portal da Transparência.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="prosp-uf">UF</Label>
          <Select value={uf} onValueChange={setUf}>
            <SelectTrigger id="prosp-uf"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-80">
              {UFS.map((u) => <SelectItem key={u} value={u}>{u} · {NOMES_DAS_UFS[u]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="prosp-funcao">Função</Label>
          <Select value={funcao} onValueChange={setFuncao}>
            <SelectTrigger id="prosp-funcao"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FUNCOES_DE_GOVERNO.map((f) => <SelectItem key={f.codigo} value={f.codigo}>{f.rotulo}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="prosp-dias">Liberações nos últimos</Label>
          <Select value={dias} onValueChange={setDias}>
            <SelectTrigger id="prosp-dias"><SelectValue /></SelectTrigger>
            <SelectContent>
              {['1', '3', '7', '10'].map((d) => <SelectItem key={d} value={d}>{d} dia(s)</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="prosp-ano">Ano das emendas</Label>
          <Select value={ano} onValueChange={setAno}>
            <SelectTrigger id="prosp-ano"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[0, 1, 2].map((i) => <SelectItem key={i} value={String(anoAtual - i)}>{anoAtual - i}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={buscarConvenios} disabled={buscando !== null}>
          {buscando === 'convenios' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Convênios liberados
        </Button>
        <Button onClick={buscarEmendas} disabled={buscando !== null} variant="outline">
          {buscando === 'emendas' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Emendas pagas
        </Button>
      </div>

      {erro && <p className="mt-3 text-sm text-destructive-ink">{erro}</p>}

      {convenios && (
        <div className="mt-5">
          <h3 className="mb-2 text-base font-semibold text-foreground">
            Convênios com liberação nos últimos {dias} dia(s) em {NOMES_DAS_UFS[uf]} <Badge variant="muted">{convenios.length}</Badge>
          </h3>
          {convenios.length === 0 ? (
            <EstadoVazio tamanho="compacto" icone={<HandCoins />} titulo="Nenhuma liberação no período" descricao="Amplie os dias ou troque a função." />
          ) : (
            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Convenente</TableHead>
                    <TableHead>Objeto</TableHead>
                    <TableHead>Órgão</TableHead>
                    <TableHead className="text-right">Última liberação</TableHead>
                    <TableHead className="text-right">Liberado / total</TableHead>
                    <TableHead>Vigência até</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {convenios.slice(0, 60).map((c) => (
                    <TableRow key={c.id || c.numero}>
                      <TableCell className="font-medium">{c.convenente || '—'}<span className="block text-xs text-muted-foreground">{[c.municipio, c.uf].filter(Boolean).join('/')}{c.numero ? ` · ${c.numero}` : ''}</span></TableCell>
                      <TableCell className="max-w-[360px]">{c.objeto || '—'}</TableCell>
                      <TableCell>{c.orgao || '—'}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{brl(c.valorUltimaLiberacao)}<span className="block text-xs font-normal text-muted-foreground">{c.dataUltimaLiberacao}</span></TableCell>
                      <TableCell className="text-right tabular-nums">{brl(c.valorLiberado)}<span className="block text-xs text-muted-foreground">de {brl(c.valor)}</span></TableCell>
                      <TableCell>{c.fimVigencia || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {emendas && (
        <div className="mt-5">
          <h3 className="mb-2 text-base font-semibold text-foreground">
            Emendas de {ano} com gasto em {NOMES_DAS_UFS[uf]} <Badge variant="muted">{emendas.length}</Badge>
          </h3>
          {emendas.length === 0 ? (
            <EstadoVazio tamanho="compacto" icone={<HandCoins />} titulo="Nenhuma emenda nesta página" descricao="A API devolve por página; troque a função ou o ano." />
          ) : (
            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Autor</TableHead>
                    <TableHead>Localidade</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead className="text-right">Empenhado</TableHead>
                    <TableHead className="text-right">Pago</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emendas.slice(0, 60).map((e) => (
                    <TableRow key={e.codigo || `${e.autor}-${e.numero}`}>
                      <TableCell className="font-medium">{e.autor || '—'}<span className="block text-xs text-muted-foreground">{e.tipo}{e.numero ? ` · ${e.numero}` : ''}</span></TableCell>
                      <TableCell>{e.localidade || '—'}</TableCell>
                      <TableCell>{e.funcao || '—'}{e.subfuncao ? <span className="block text-xs text-muted-foreground">{e.subfuncao}</span> : null}</TableCell>
                      <TableCell className="text-right tabular-nums">{brl(e.empenhado)}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{brl(e.pago)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        A API aceita um dia por consulta de convênios; a tela faz uma chamada por dia. Um monitor diário com aviso
        exige rotina e tabela, e fica para decisão do dono do produto.
      </p>
    </Card>
  );
}
