import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Search, Loader2, Building2, FileText, ExternalLink, Download,
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
      <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-1">
          <FileText className="w-4 h-4 text-muted-foreground" />
          Atas de Registro de Preços — Compras.gov.br
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          As atas em que o CNPJ consultado é o FORNECEDOR: itens, quantidade homologada, quanto já
          foi empenhado, valores e vigência — direto da API oficial de dados abertos.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <Input placeholder="CNPJ do fornecedor" value={cnpj} inputMode="numeric"
            onChange={(e) => setCnpj(mascaraCNPJ(e.target.value))} className="w-56"
            onKeyDown={(e) => { if (e.key === 'Enter') buscar(); }} />
          <Select value={meses} onValueChange={setMeses}>
            <SelectTrigger className="w-64 h-10 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="12">Atas iniciadas nos últimos 12 meses</SelectItem>
              <SelectItem value="24">Atas iniciadas nos últimos 24 meses</SelectItem>
              <SelectItem value="36">Atas iniciadas nos últimos 36 meses</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={buscar} disabled={buscando}>
            {buscando ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Search className="w-4 h-4 mr-1" />}
            Buscar
          </Button>
          <a href="https://contratos.sistema.gov.br/transparencia" target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="sm">
              <ExternalLink className="w-4 h-4 mr-1" /> Abrir Portal
            </Button>
          </a>
          {itens.length > 0 && (
            <Button variant="outline" size="sm" onClick={exportar}>
              <Download className="w-4 h-4 mr-1" /> Exportar CSV
            </Button>
          )}
        </div>

        {erro && <p className="text-sm text-destructive mt-3">{erro}</p>}
      </div>

      {buscou && !buscando && !erro && itens.length === 0 && (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Nenhuma ata encontrada para este fornecedor na janela escolhida. A busca cobre atas
          INICIADAS no período — amplie a janela para alcançar atas mais antigas.
        </Card>
      )}

      {itens.length > 0 && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="stat-card">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Atas</span>
              </div>
              <p className="text-2xl font-bold tabular-nums">{atas.size}</p>
              <span className="text-xs text-muted-foreground">{atasVigentes} vigente(s) hoje</span>
            </div>
            <div className="stat-card">
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Itens registrados</span>
              </div>
              <p className="text-2xl font-bold tabular-nums">{itens.length}</p>
            </div>
            <div className="stat-card lg:col-span-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-muted-foreground">Valor total registrado</span>
              </div>
              <p className="text-2xl font-bold tabular-nums">{brlExato(totalRegistrado)}</p>
            </div>
          </div>

          <div className="space-y-3">
            {[...atas.entries()].map(([chave, grupo]) => {
              const a = grupo[0];
              const vigente = (a.dataVigenciaFinal ?? '') >= hoje;
              const link = linkPncpDaCompra(a.numeroControlePncpCompra);
              return (
                <Card key={chave} className="p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold flex items-center gap-2 flex-wrap">
                        Ata {a.numeroAtaRegistroPreco}
                        <Badge variant="outline" className={`text-xs ${vigente ? 'border-success/40 text-success' : 'border-muted-foreground/30 text-muted-foreground'}`}>
                          {vigente ? 'Vigente' : 'Encerrada'}
                        </Badge>
                        {a.nomeModalidadeCompra && <Badge variant="outline" className="text-xs">{a.nomeModalidadeCompra}</Badge>}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {a.nomeUnidadeGerenciadora ?? `UG ${a.codigoUnidadeGerenciadora}`} ·
                        vigência {dataBr(a.dataVigenciaInicial)} a {dataBr(a.dataVigenciaFinal)}
                      </p>
                    </div>
                    {link && (
                      <a href={link} target="_blank" rel="noreferrer"
                        className="text-xs text-primary inline-flex items-center gap-1 hover:underline shrink-0">
                        Ver no PNCP <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <div className="divide-y divide-border/40 rounded-md border border-border/40">
                    {grupo.map((i) => (
                      <div key={`${chave}-${i.numeroItem}`} className="flex items-start justify-between gap-3 p-2.5 text-xs">
                        <div className="min-w-0">
                          <p className="font-medium">Item {Number(i.numeroItem)} · {(i.descricaoItem ?? '—').substring(0, 140)}</p>
                          <p className="text-muted-foreground mt-0.5">
                            homologado: {i.quantidadeHomologadaVencedor?.toLocaleString('pt-BR') ?? '—'} ·
                            empenhado: {i.quantidadeEmpenhada?.toLocaleString('pt-BR') ?? '0'}
                          </p>
                        </div>
                        <div className="text-right shrink-0 tabular-nums">
                          <p className="font-semibold">{brlExato(i.valorTotal)}</p>
                          <p className="text-muted-foreground">unit.: {brlExato(i.valorUnitario)}</p>
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
