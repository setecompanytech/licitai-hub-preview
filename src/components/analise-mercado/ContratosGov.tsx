import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Search, Loader2, Building2, FileText, ExternalLink, Download, AlertTriangle,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { downloadCSV } from '@/lib/download-utils';
import { mascaraCNPJ, isValidCNPJ } from '@/lib/financeiro/formatters';

/**
 * Atas de Registro de Preços — o espelho OFICIAL do contratos.gov.br (08/09).
 *
 * A aba tinha um "Extrair via IA" que estimava números e, aposentado ele,
 * ficou oca — duplicando a Federal (API), como o dono apontou. Papel novo e
 * distinto: a Federal consulta CONTRATOS e LICITAÇÕES executados; esta
 * consulta as ATAS DE REGISTRO DE PREÇOS (módulo ARP da API de dados abertos
 * do Compras.gov.br), filtradas pelo CNPJ do FORNECEDOR — a empresa vendo as
 * próprias atas: item, quantidade homologada, quantidade JÁ EMPENHADA,
 * valores exatos e vigência, com link para a compra no PNCP.
 *
 * Componente interno (vive dentro de uma aba da Análise de mercado): começa
 * direto no conteúdo, sem cabeçalho de página.
 */

type ItemArp = {
  numeroAtaRegistroPreco: string;
  codigoUnidadeGerenciadora: string;
  nomeUnidadeGerenciadora: string | null;
  anoCompra: string;
  nomeModalidadeCompra: string | null;
  dataAssinatura: string | null;
  dataVigenciaInicial: string | null;
  dataVigenciaFinal: string | null;
  numeroItem: string;
  descricaoItem: string | null;
  quantidadeHomologadaVencedor: number | null;
  quantidadeEmpenhada: number | null;
  valorUnitario: number | null;
  valorTotal: number | null;
  numeroControlePncpCompra: string | null;
  itemExcluido: boolean;
};

const brlExato = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const dataBr = (iso: string | null | undefined) =>
  iso ? new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR') : '—';

/** "10763998000130-1-000134/2025" → https://pncp.gov.br/app/editais/{cnpj}/{ano}/{seq} */
const linkPncpDaCompra = (controle: string | null): string | null => {
  const m = controle?.match(/^(\d{14})-\d+-0*(\d+)\/(\d{4})$/);
  return m ? `https://pncp.gov.br/app/editais/${m[1]}/${m[3]}/${m[2]}` : null;
};

export default function ContratosGov() {
  const [cnpj, setCnpj] = useState('');
  const [meses, setMeses] = useState('24');
  const [buscando, setBuscando] = useState(false);
  const [buscou, setBuscou] = useState(false);
  const [erro, setErro] = useState('');
  const [itens, setItens] = useState<ItemArp[]>([]);

  const buscar = async () => {
    const digitos = cnpj.replace(/\D/g, '');
    if (!isValidCNPJ(digitos)) {
      setErro('CNPJ inválido — confira os dígitos.');
      setItens([]);
      setBuscou(true);
      return;
    }
    setBuscando(true);
    setErro('');
    try {
      const { data, error } = await supabase.functions.invoke('consulta-arp-compras', {
        body: { cnpj: digitos, meses: Number(meses) },
      });
      if (error) throw error;
      if (data?.error) { setErro(String(data.error)); setItens([]); return; }
      setItens(((data?.itens ?? []) as ItemArp[]).filter((i) => !i.itemExcluido));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha na consulta.');
      setItens([]);
    } finally {
      setBuscando(false);
      setBuscou(true);
    }
  };

  // Agrupamento por ata: a unidade de leitura é a ATA; os itens são o recheio.
  const hoje = new Date().toISOString().slice(0, 10);
  const atas = new Map<string, ItemArp[]>();
  for (const i of itens) {
    const chave = `${i.numeroAtaRegistroPreco}·${i.codigoUnidadeGerenciadora}`;
    if (!atas.has(chave)) atas.set(chave, []);
    atas.get(chave)!.push(i);
  }
  const totalRegistrado = itens.reduce((s, i) => s + (i.valorTotal ?? 0), 0);
  const atasVigentes = [...atas.values()].filter(
    (grupo) => (grupo[0].dataVigenciaFinal ?? '') >= hoje,
  ).length;

  const exportar = () => {
    downloadCSV(
      'atas-registro-precos',
      ['Ata', 'UG', 'Unidade Gerenciadora', 'Vigência início', 'Vigência fim', 'Item', 'Descrição', 'Qtd homologada', 'Qtd empenhada', 'Valor unitário', 'Valor total'],
      itens.map((i) => [
        i.numeroAtaRegistroPreco, i.codigoUnidadeGerenciadora, i.nomeUnidadeGerenciadora ?? '',
        i.dataVigenciaInicial ?? '', i.dataVigenciaFinal ?? '', i.numeroItem,
        (i.descricaoItem ?? '').substring(0, 150),
        String(i.quantidadeHomologadaVencedor ?? ''), String(i.quantidadeEmpenhada ?? ''),
        String(i.valorUnitario ?? ''), String(i.valorTotal ?? ''),
      ]),
    );
    toast.success('CSV exportado.');
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <FileText className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          Atas de registro de preços — Compras.gov.br
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          As atas em que o CNPJ consultado é o FORNECEDOR: itens, quantidade homologada, quanto já
          foi empenhado, valores e vigência — direto da API oficial de dados abertos.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="arp-cnpj" className="text-sm font-medium text-foreground">CNPJ do fornecedor</label>
            <Input id="arp-cnpj" placeholder="00.000.000/0000-00" value={cnpj} inputMode="numeric"
              aria-invalid={erro ? true : undefined}
              onChange={(e) => setCnpj(mascaraCNPJ(e.target.value))} className="w-56"
              onKeyDown={(e) => { if (e.key === 'Enter') buscar(); }} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="arp-periodo" className="text-sm font-medium text-foreground">Início da ata</label>
            <Select value={meses} onValueChange={setMeses}>
              <SelectTrigger id="arp-periodo" className="w-72"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="12">Atas iniciadas nos últimos 12 meses</SelectItem>
                <SelectItem value="24">Atas iniciadas nos últimos 24 meses</SelectItem>
                <SelectItem value="36">Atas iniciadas nos últimos 36 meses</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={buscar} disabled={buscando}>
            {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Buscar
          </Button>
          <Button asChild variant="ghost">
            <a href="https://contratos.sistema.gov.br/transparencia" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" /> Abrir portal
            </a>
          </Button>
          {itens.length > 0 && (
            <Button variant="outline" onClick={exportar}>
              <Download className="h-4 w-4" /> Exportar CSV
            </Button>
          )}
        </div>

        {erro && (
          <Alert variant="destructive" className="mt-4">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <AlertDescription>{erro}</AlertDescription>
          </Alert>
        )}
      </div>

      {buscou && !buscando && !erro && itens.length === 0 && (
        <Card>
          <EstadoVazio
            icone={<FileText />}
            titulo="Nenhuma ata encontrada para este fornecedor"
            descricao="A busca cobre atas INICIADAS na janela escolhida — amplie a janela para alcançar atas mais antigas."
          />
        </Card>
      )}

      {itens.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" aria-hidden="true" />
                Atas
              </p>
              <p className="mt-2 text-[2rem] font-bold leading-10 tabular-nums text-foreground">{atas.size}</p>
              <p className="text-xs text-muted-foreground">{atasVigentes} vigente(s) hoje</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building2 className="h-4 w-4" aria-hidden="true" />
                Itens registrados
              </p>
              <p className="mt-2 text-[2rem] font-bold leading-10 tabular-nums text-foreground">{itens.length}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-6 shadow-sm lg:col-span-2">
              <p className="text-sm text-muted-foreground">Valor total registrado</p>
              <p className="mt-2 text-[2rem] font-bold leading-10 tabular-nums text-foreground">{brlExato(totalRegistrado)}</p>
            </div>
          </div>

          <div className="space-y-4">
            {[...atas.entries()].map(([chave, grupo]) => {
              const a = grupo[0];
              const vigente = (a.dataVigenciaFinal ?? '') >= hoje;
              const link = linkPncpDaCompra(a.numeroControlePncpCompra);
              return (
                <Card key={chave} className="p-6">
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="flex flex-wrap items-center gap-2 text-lg font-semibold text-foreground">
                        Ata {a.numeroAtaRegistroPreco}
                        <Badge variant={vigente ? 'success' : 'muted'}>{vigente ? 'Vigente' : 'Encerrada'}</Badge>
                        {a.nomeModalidadeCompra && <Badge variant="info">{a.nomeModalidadeCompra}</Badge>}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {a.nomeUnidadeGerenciadora ?? `UG ${a.codigoUnidadeGerenciadora}`} ·
                        vigência {dataBr(a.dataVigenciaInicial)} a {dataBr(a.dataVigenciaFinal)}
                      </p>
                    </div>
                    {link && (
                      <a href={link} target="_blank" rel="noreferrer"
                        className="inline-flex shrink-0 items-center gap-1 text-sm text-primary hover:underline">
                        Ver no PNCP <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </a>
                    )}
                  </div>
                  <div className="divide-y divide-border rounded-md border border-border">
                    {grupo.map((i) => (
                      <div key={`${chave}-${i.numeroItem}`} className="flex items-start justify-between gap-3 p-3 text-sm">
                        <div className="min-w-0">
                          <p className="font-medium text-foreground">Item {Number(i.numeroItem)} · {(i.descricaoItem ?? '—').substring(0, 140)}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            homologado: {i.quantidadeHomologadaVencedor?.toLocaleString('pt-BR') ?? '—'} ·
                            empenhado: {i.quantidadeEmpenhada?.toLocaleString('pt-BR') ?? '0'}
                          </p>
                        </div>
                        <div className="shrink-0 text-right tabular-nums">
                          <p className="font-semibold text-foreground">{brlExato(i.valorTotal)}</p>
                          <p className="text-xs text-muted-foreground">unit.: {brlExato(i.valorUnitario)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
