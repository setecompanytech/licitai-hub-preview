import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import EstadoVazio from '@/components/shared/EstadoVazio';
import TextoRecolhido from '@/components/shared/TextoRecolhido';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Search, Loader2, Building2, ExternalLink, Download, Calendar, AlertTriangle, Inbox, ChevronDown, ChevronUp,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { downloadCSV } from '@/lib/download-utils';
import { mascaraCNPJ, isValidCNPJ } from '@/lib/financeiro/formatters';
import { contratoFederal, licitacaoFederal, type ContratoFederal, type LicitacaoFederal } from '@/lib/concorrentes/portal-federal';

/**
 * Consulta federal (Portal da Transparência) — componente interno da aba
 * Consultas da Análise de mercado: começa direto no conteúdo.
 *
 * Onda 2 (22/09): o órgão se busca pelo nome (a API exige o código SIAFI e
 * ninguém sabe que o IFPA é 26403); cada licitação abre itens com vencedor
 * e preço, e participantes; cada contrato abre itens, aditivos,
 * apostilamentos e empenhos. Os campos são lidos pelos nomes da
 * especificação (`valorInicialCompra`, `licitacao.objeto`, `valor`): antes
 * a tela mostrava "Sem descrição" e valor nenhum nas licitações.
 */

const brl = (v: number | null) =>
  typeof v === 'number' ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';

type Orgao = { codigo: string; descricao: string };
type Linha = Record<string, unknown>;
type Consulta = (body: Record<string, unknown>) => Promise<Linha[]>;

const s = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v) : '');
const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v.replace(/\./g, '').replace(',', '.')) : null);

async function consultar(body: Record<string, unknown>): Promise<Linha[]> {
  const { data, error } = await supabase.functions.invoke('consulta-transparencia', { body });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return (data?.dados ?? []) as Linha[];
}

/** Itens com vencedor e preço, e participantes, de uma licitação. */
function DetalheDaLicitacao({ lic, consulta }: { lic: LicitacaoFederal; consulta: Consulta }) {
  const [estado, setEstado] = useState<{ carregando: boolean; itens: Linha[]; participantes: Linha[]; erro?: string } | null>(null);

  const carregar = async () => {
    setEstado({ carregando: true, itens: [], participantes: [] });
    try {
      const [itens, participantes] = await Promise.all([
        consulta({ tipo: 'licitacao-itens', id: lic.id, pagina: 1 }),
        lic.codigoUG && lic.numeroParaApi && lic.codigoModalidade
          ? consulta({ tipo: 'licitacao-participantes', codigoUG: lic.codigoUG, numero: lic.numeroParaApi, codigoModalidade: lic.codigoModalidade, pagina: 1 })
          : Promise.resolve([] as Linha[]),
      ]);
      setEstado({ carregando: false, itens, participantes });
    } catch (e) {
      setEstado({ carregando: false, itens: [], participantes: [], erro: e instanceof Error ? e.message : 'Erro' });
    }
  };

  if (!estado) {
    return (
      <Button type="button" size="sm" variant="ghost" className="mt-2" onClick={carregar}>
        <ChevronDown className="h-4 w-4" aria-hidden="true" /> Itens e participantes
      </Button>
    );
  }
  return (
    <div className="mt-3 space-y-3">
      {estado.carregando && <p className="text-sm text-muted-foreground" aria-busy="true">Buscando itens e participantes…</p>}
      {estado.erro && <p className="text-sm text-destructive-ink">{estado.erro}</p>}
      {!estado.carregando && !estado.erro && (
        <>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Itens licitados ({estado.itens.length})</p>
            {estado.itens.length === 0 ? (
              <p className="text-sm text-muted-foreground">A API não trouxe itens para esta licitação.</p>
            ) : (
              <div className="rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Qtd.</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Vencedor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {estado.itens.slice(0, 40).map((it, i) => (
                      <TableRow key={`${s(it.codigoItemCompra)}-${i}`}>
                        <TableCell className="max-w-[360px] align-top"><TextoRecolhido texto={`${s(it.numero) ? `${s(it.numero)} · ` : ''}${s(it.descricao)}`} /></TableCell>
                        <TableCell className="text-right tabular-nums">{s(it.quantidade) || '—'}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">{brl(num(it.valor))}</TableCell>
                        <TableCell>{s(it.nome) || '—'}{s(it.cpfCnpjVencedor) ? <span className="block text-xs text-muted-foreground">{s(it.cpfCnpjVencedor)}</span> : null}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Participantes ({estado.participantes.length})</p>
            {estado.participantes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {lic.codigoUG && lic.codigoModalidade ? 'A API não trouxe participantes.' : 'A API não informou unidade gestora ou modalidade; sem eles não há como pedir os participantes.'}
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {estado.participantes.slice(0, 60).map((p, i) => (
                  <Badge key={`${s(p.cpfCnpj)}-${i}`} variant="muted" title={s(p.cpfCnpj)}>{s(p.nome) || s(p.cpfCnpj)}</Badge>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** Itens, aditivos, apostilamentos e empenhos de um contrato. */
function DetalheDoContrato({ contrato, consulta }: { contrato: ContratoFederal; consulta: Consulta }) {
  const [estado, setEstado] = useState<{ carregando: boolean; itens: Linha[]; aditivos: Linha[]; apostilamentos: Linha[]; empenhos: Linha[]; erro?: string } | null>(null);

  const carregar = async () => {
    setEstado({ carregando: true, itens: [], aditivos: [], apostilamentos: [], empenhos: [] });
    try {
      const [itens, aditivos, apostilamentos, empenhos] = await Promise.all([
        consulta({ tipo: 'contrato-itens', id: contrato.id, pagina: 1 }),
        consulta({ tipo: 'contrato-aditivos', id: contrato.id }),
        consulta({ tipo: 'contrato-apostilamentos', id: contrato.id }),
        consulta({ tipo: 'contrato-empenhos', id: contrato.id }),
      ]);
      setEstado({ carregando: false, itens, aditivos, apostilamentos, empenhos });
    } catch (e) {
      setEstado({ carregando: false, itens: [], aditivos: [], apostilamentos: [], empenhos: [], erro: e instanceof Error ? e.message : 'Erro' });
    }
  };

  if (!estado) {
    return (
      <Button type="button" size="sm" variant="ghost" className="mt-2" onClick={carregar}>
        <ChevronDown className="h-4 w-4" aria-hidden="true" /> Itens, aditivos e empenhos
      </Button>
    );
  }
  return (
    <div className="mt-3 space-y-3">
      {estado.carregando && <p className="text-sm text-muted-foreground" aria-busy="true">Buscando itens, aditivos e empenhos…</p>}
      {estado.erro && <p className="text-sm text-destructive-ink">{estado.erro}</p>}
      {!estado.carregando && !estado.erro && (
        <>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Itens contratados ({estado.itens.length})</p>
            {estado.itens.length === 0 ? <p className="text-sm text-muted-foreground">A API não trouxe itens.</p> : (
              <div className="rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Item</TableHead><TableHead className="text-right">Qtd.</TableHead><TableHead className="text-right">Valor</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {estado.itens.slice(0, 40).map((it, i) => (
                      <TableRow key={i}>
                        <TableCell className="max-w-[420px] align-top"><TextoRecolhido texto={`${s(it.numero) ? `${s(it.numero)} · ` : ''}${s(it.descricao)}`} />{s(it.descComplementarItemCompra) ? <TextoRecolhido texto={s(it.descComplementarItemCompra)} className="text-xs text-muted-foreground" /> : null}</TableCell>
                        <TableCell className="text-right tabular-nums">{s(it.quantidade) || '—'}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">{brl(num(it.valor))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Termos aditivos ({estado.aditivos.length})</p>
              {estado.aditivos.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum.</p> : (
                <ul className="space-y-1 text-sm">
                  {estado.aditivos.map((a, i) => <li key={i}><span className="font-medium">{s(a.numero)}</span> {s(a.dataPublicacao) ? `· ${s(a.dataPublicacao)}` : ''}<span className="block text-xs text-muted-foreground">{s(a.objetoAditivo)}</span></li>)}
                </ul>
              )}
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Apostilamentos ({estado.apostilamentos.length})</p>
              {estado.apostilamentos.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum.</p> : (
                <ul className="space-y-1 text-sm">
                  {estado.apostilamentos.map((a, i) => <li key={i}><span className="font-medium">{s(a.numero)}</span> · {brl(num(a.valor))}<span className="block text-xs text-muted-foreground">{s(a.descricao)} {s(a.situacao) ? `· ${s(a.situacao)}` : ''}</span></li>)}
                </ul>
              )}
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Empenhos ({estado.empenhos.length})</p>
              {estado.empenhos.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum.</p> : (
                <ul className="space-y-1 text-sm">
                  {estado.empenhos.slice(0, 20).map((e, i) => <li key={i}><span className="font-medium tabular-nums">{s(e.empenhoResumido) || s(e.empenho)}</span> · {brl(num(e.valor))}<span className="block text-xs text-muted-foreground">{s(e.dataEmissao)}</span></li>)}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function ContratosTransparencia() {
  const [tipo, setTipo] = useState<'contratos' | 'licitacoes'>('contratos');
  const [cnpjBusca, setCnpjBusca] = useState('');
  // A API federal filtra por CNPJ do contratado ou por código SIAFI do órgão;
  // o código vem da busca por nome (`/orgaos-siafi`).
  const [orgaoBusca, setOrgaoBusca] = useState('');
  const [orgaoNome, setOrgaoNome] = useState('');
  const [orgaoTermo, setOrgaoTermo] = useState('');
  const [orgaosSugeridos, setOrgaosSugeridos] = useState<Orgao[]>([]);
  const [buscandoOrgao, setBuscandoOrgao] = useState(false);
  const [loading, setLoading] = useState(false);
  const [buscou, setBuscou] = useState(false);
  const [dados, setDados] = useState<Linha[]>([]);
  const [janelas, setJanelas] = useState(0);
  const [erro, setErro] = useState('');
  const [aberto, setAberto] = useState<string | null>(null);

  const buscarOrgao = async () => {
    const termo = orgaoTermo.trim();
    if (termo.length < 3 && !/^\d{4,6}$/.test(termo)) {
      toast.info('Digite ao menos 3 letras do nome do órgão, ou o código SIAFI.');
      return;
    }
    setBuscandoOrgao(true);
    try {
      const lista = await consultar(/^\d{4,6}$/.test(termo) ? { tipo: 'orgaos', orgao: termo, pagina: 1 } : { tipo: 'orgaos', termo, pagina: 1 });
      const orgaos = lista.map((o) => ({ codigo: s(o.codigo), descricao: s(o.descricao) })).filter((o) => o.codigo);
      setOrgaosSugeridos(orgaos);
      if (orgaos.length === 0) toast.info('Nenhum órgão com esse nome no SIAFI.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível buscar o órgão.');
    } finally {
      setBuscandoOrgao(false);
    }
  };

  const escolherOrgao = (o: Orgao) => {
    setOrgaoBusca(o.codigo);
    setOrgaoNome(o.descricao);
    setOrgaosSugeridos([]);
  };

  const handleBuscar = async () => {
    // Dígito verificador ANTES da viagem: um CNPJ com algarismos trocados
    // (33.743… em vez de 33.734…, o caso de 08/09) voltava da API federal
    // como erro genérico. Conferir aqui dá resposta imediata e clara.
    const digitos = cnpjBusca.replace(/\D/g, '');
    if (digitos.length > 0 && !isValidCNPJ(digitos)) {
      setErro('CNPJ inválido — confira os dígitos (é comum inverter dois algarismos).');
      setDados([]);
      return;
    }
    setLoading(true);
    setErro('');
    setDados([]);
    setAberto(null);

    try {
      const now = new Date();
      const dataFim = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const inicio = new Date(now);
      inicio.setMonth(inicio.getMonth() - 6);
      const dataInicio = inicio.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

      const { data, error } = await supabase.functions.invoke('consulta-transparencia', {
        body: {
          tipo,
          cnpj: cnpjBusca || undefined,
          orgao: orgaoBusca.trim() || undefined,
          dataInicio,
          dataFim,
        },
      });

      if (error) throw error;
      if (data.error) {
        setErro(data.error);
      } else {
        const lista = (data.dados || []) as Linha[];
        setDados(lista);
        setJanelas(Number(data.janelas ?? 0));
        if (lista.length === 0) toast.info('Nenhum resultado encontrado para os filtros informados.');
        else toast.success(`${lista.length} resultado(s) encontrado(s)!`);
      }
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao consultar');
    } finally {
      setLoading(false);
      setBuscou(true);
    }
  };

  const contratos = tipo === 'contratos' ? dados.map(contratoFederal) : [];
  const licitacoes = tipo === 'licitacoes' ? dados.map(licitacaoFederal) : [];

  const exportar = () => {
    downloadCSV(
      `transparencia-${tipo}`,
      tipo === 'contratos'
        ? ['Órgão', 'Fornecedor', 'CNPJ', 'Objeto', 'Valor inicial', 'Vigência', 'Situação']
        : ['Órgão', 'Modalidade', 'Número', 'Objeto', 'Valor', 'Abertura', 'Situação'],
      tipo === 'contratos'
        ? contratos.map((c) => [c.orgao, c.fornecedor, c.cnpjFornecedor, c.objeto.substring(0, 100), String(c.valorInicial ?? ''), `${c.vigenciaDe} a ${c.vigenciaAte}`, c.situacao])
        : licitacoes.map((l) => [l.orgao, l.modalidade, l.numero, l.objeto.substring(0, 100), String(l.valor ?? ''), l.dataAbertura, l.situacao]),
    );
    toast.success('CSV exportado!');
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card className="p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold leading-6 text-foreground">
          <Building2 className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          Consulta federal — Portal da Transparência
        </h2>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="federal-tipo">O que consultar</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as 'contratos' | 'licitacoes')}>
              <SelectTrigger id="federal-tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contratos">Contratos federais</SelectItem>
                <SelectItem value="licitacoes">Licitações federais</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="federal-cnpj">CNPJ do contratado</Label>
            <Input
              id="federal-cnpj"
              placeholder={tipo === 'licitacoes' ? 'Não se aplica a licitações' : 'Opcional'}
              value={cnpjBusca}
              inputMode="numeric"
              disabled={tipo === 'licitacoes'}
              aria-invalid={erro ? true : undefined}
              onChange={(e) => setCnpjBusca(mascaraCNPJ(e.target.value))}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="federal-orgao">Órgão (nome ou código SIAFI)</Label>
            <div className="flex gap-2">
              <Input
                id="federal-orgao"
                placeholder="Ex.: Instituto Federal do Pará"
                value={orgaoTermo}
                onChange={(e) => setOrgaoTermo(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void buscarOrgao(); } }}
              />
              <Button type="button" variant="outline" onClick={buscarOrgao} disabled={buscandoOrgao} aria-label="Buscar órgão">
                {buscandoOrgao ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            {orgaoBusca && (
              <p className="text-xs text-muted-foreground">
                Órgão escolhido: <span className="font-medium text-foreground">{orgaoNome || orgaoBusca}</span> · SIAFI {orgaoBusca}
                {' '}<button type="button" className="text-primary hover:underline" onClick={() => { setOrgaoBusca(''); setOrgaoNome(''); }}>limpar</button>
              </p>
            )}
            {orgaosSugeridos.length > 0 && (
              <ul className="max-h-48 divide-y divide-border overflow-y-auto rounded-md border border-border bg-card" aria-label="Órgãos encontrados">
                {orgaosSugeridos.slice(0, 30).map((o) => (
                  <li key={o.codigo}>
                    <button type="button" className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60" onClick={() => escolherOrgao(o)}>
                      <span className="min-w-0 truncate">{o.descricao}</span>
                      <span className="shrink-0 tabular-nums text-xs text-muted-foreground">{o.codigo}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={handleBuscar} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {loading ? 'Buscando…' : 'Buscar'}
          </Button>
        </div>

        {erro && (
          <Alert variant="destructive" className="mt-4">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <AlertDescription>{erro}</AlertDescription>
          </Alert>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <Badge variant="success">API pública</Badge>
          <span>Contratos: por CNPJ ou órgão · Licitações: exigem o órgão · últimos 6 meses, varridos mês a mês</span>
          <a href="https://portaldatransparencia.gov.br" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-primary hover:underline">
            <ExternalLink className="h-3 w-3" aria-hidden="true" /> Portal da Transparência
          </a>
        </div>
      </Card>

      {buscou && !loading && !erro && dados.length === 0 && (
        <Card>
          <EstadoVazio
            icone={<Inbox />}
            titulo="Nenhum resultado para estes filtros"
            descricao="A janela consultada é de 6 meses. Licitações exigem o órgão; contratos aceitam CNPJ ou órgão."
          />
        </Card>
      )}

      {/* Resultados */}
      {dados.length > 0 && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
            <h3 className="text-lg font-semibold leading-6 text-foreground">
              {dados.length} resultado(s) — {tipo === 'contratos' ? 'contratos' : 'licitações'} federais
              {janelas > 1 && <span className="ml-2 text-sm font-normal text-muted-foreground">({janelas} meses varridos)</span>}
            </h3>
            <Button size="sm" variant="outline" onClick={exportar}>
              <Download className="h-4 w-4" /> Exportar CSV
            </Button>
          </div>

          <ul className="divide-y divide-border">
            {tipo === 'contratos'
              ? contratos.slice(0, 50).map((c, i) => {
                const chave = c.id || String(i);
                return (
                  <li key={chave} className="px-5 py-3 transition-colors hover:bg-muted/40">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 grow basis-56">
                        <p className="line-clamp-2 text-base font-medium text-foreground">{c.objeto || 'Sem descrição'}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1"><Building2 className="h-3 w-3" aria-hidden="true" /> {c.orgao || 'Não informado'}</span>
                          {c.fornecedor && <span>→ {c.fornecedor}{c.cnpjFornecedor ? ` (${c.cnpjFornecedor})` : ''}</span>}
                          {c.numero && <Badge variant="muted">Contrato {c.numero}</Badge>}
                          {c.situacao && <Badge variant="info">{c.situacao}</Badge>}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-base font-semibold tabular-nums text-foreground">{brl(c.valorInicial)}</p>
                        {c.valorFinal !== null && c.valorFinal !== c.valorInicial && (
                          <p className="text-xs tabular-nums text-muted-foreground">final {brl(c.valorFinal)}</p>
                        )}
                        {(c.vigenciaDe || c.vigenciaAte) && (
                          <p className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" aria-hidden="true" /> {c.vigenciaDe}{c.vigenciaAte ? ` a ${c.vigenciaAte}` : ''}
                          </p>
                        )}
                      </div>
                    </div>
                    {c.id && (aberto === chave
                      ? <DetalheDoContrato contrato={c} consulta={consultar} />
                      : (
                        <Button type="button" size="sm" variant="ghost" className="mt-2" onClick={() => setAberto(chave)}>
                          <ChevronDown className="h-4 w-4" aria-hidden="true" /> Itens, aditivos e empenhos
                        </Button>
                      ))}
                    {aberto === chave && (
                      <Button type="button" size="sm" variant="ghost" className="mt-1" onClick={() => setAberto(null)}>
                        <ChevronUp className="h-4 w-4" aria-hidden="true" /> Fechar
                      </Button>
                    )}
                  </li>
                );
              })
              : licitacoes.slice(0, 50).map((l, i) => {
                const chave = l.id || String(i);
                return (
                  <li key={chave} className="px-5 py-3 transition-colors hover:bg-muted/40">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 grow basis-56">
                        <p className="line-clamp-2 text-base font-medium text-foreground">{l.objeto || 'Sem descrição'}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1"><Building2 className="h-3 w-3" aria-hidden="true" /> {l.orgao || 'Não informado'}</span>
                          {l.modalidade && <Badge variant="info">{l.modalidade}{l.numero ? ` ${l.numero}` : ''}</Badge>}
                          {l.situacao && <Badge variant="muted">{l.situacao}</Badge>}
                          {l.municipio && <span>{l.municipio}</span>}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-base font-semibold tabular-nums text-foreground">{brl(l.valor)}</p>
                        {l.dataAbertura && <p className="text-xs text-muted-foreground">abertura {l.dataAbertura}</p>}
                        {l.dataResultado && <p className="text-xs text-muted-foreground">resultado {l.dataResultado}</p>}
                      </div>
                    </div>
                    {l.id && (aberto === chave
                      ? <DetalheDaLicitacao lic={l} consulta={consultar} />
                      : (
                        <Button type="button" size="sm" variant="ghost" className="mt-2" onClick={() => setAberto(chave)}>
                          <ChevronDown className="h-4 w-4" aria-hidden="true" /> Itens e participantes
                        </Button>
                      ))}
                    {aberto === chave && (
                      <Button type="button" size="sm" variant="ghost" className="mt-1" onClick={() => setAberto(null)}>
                        <ChevronUp className="h-4 w-4" aria-hidden="true" /> Fechar
                      </Button>
                    )}
                  </li>
                );
              })}
          </ul>
        </Card>
      )}
    </div>
  );
}
