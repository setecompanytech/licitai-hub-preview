import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Loader2, Search, Building2, Calendar, MapPin, ExternalLink, TrendingDown, BarChart3, FileCheck, Scale, AlertTriangle, Check, ChevronsUpDown } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import HistoricoDoOrgao from '@/components/precificacao/HistoricoDoOrgao';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { cn } from '@/lib/utils';
import { fetchMunicipiosUF, UFS_BRASIL, type IBGEMunicipio } from '@/lib/ibge-municipios';

type ResultadoGov = {
  descricao: string;
  orgao: string;
  preco_unitario: number;
  quantidade: number;
  unidade: string;
  data_compra: string;
  modalidade: string;
  uf: string;
  municipio?: string;
  fonte: string;
  url: string;
  numero_compra: string;
  tipo_registro?: string;
  situacao?: string;
  fornecedor?: string;
  marca?: string;
};

type ResumoGov = {
  menor_preco: number;
  maior_preco: number;
  preco_medio: number;
  mediana?: number;
  total_registros: number;
  periodo?: string;
  fontes: string[];
};

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const currentYear = new Date().getFullYear();

const TODOS = 'todos';

type Props = {
  /** UF pré-selecionada pelo filtro de localização da página. */
  ufInicial?: string;
  /** Cidade pré-selecionada pelo filtro de localização da página. */
  municipioInicial?: string;
};

export default function PainelPrecosGov({ ufInicial = TODOS, municipioInicial = TODOS }: Props) {
  const [termo, setTermo] = useState('');
  const [anoInicio, setAnoInicio] = useState(String(currentYear - 2));
  const [anoFim, setAnoFim] = useState(String(currentYear));
  const [uf, setUf] = useState(ufInicial || TODOS);
  const [municipio, setMunicipio] = useState(municipioInicial || TODOS);
  const [municipios, setMunicipios] = useState<IBGEMunicipio[]>([]);
  const [loadingMunicipios, setLoadingMunicipios] = useState(false);
  const [municipioOpen, setMunicipioOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resultados, setResultados] = useState<ResultadoGov[]>([]);
  const [resumo, setResumo] = useState<ResumoGov | null>(null);

  // Acompanha o filtro de localização da página (Localização: Região/Estado/Cidade)
  useEffect(() => {
    setUf(ufInicial || TODOS);
    setMunicipio(municipioInicial || TODOS);
  }, [ufInicial, municipioInicial]);

  // Carrega municípios do IBGE ao trocar de UF
  useEffect(() => {
    let cancelado = false;

    if (uf === TODOS) {
      setMunicipios([]);
      return;
    }

    setLoadingMunicipios(true);
    fetchMunicipiosUF(uf)
      .then((lista) => {
        if (!cancelado) setMunicipios(lista);
      })
      .catch(() => {
        if (!cancelado) {
          setMunicipios([]);
          toast.error(`Não foi possível carregar os municípios de ${uf}.`);
        }
      })
      .finally(() => {
        if (!cancelado) setLoadingMunicipios(false);
      });

    return () => {
      cancelado = true;
    };
  }, [uf]);

  const handleUfChange = (novaUf: string) => {
    setUf(novaUf);
    setMunicipio(TODOS);
  };

  const escopoLabel =
    municipio !== TODOS ? `${municipio}/${uf}` : uf !== TODOS ? uf : 'todo o Brasil';

  const handleSearch = async () => {
    if (!termo.trim()) {
      toast.error('Digite um produto ou serviço para buscar.');
      return;
    }
    setLoading(true);
    setResultados([]);
    setResumo(null);

    try {
      const { data, error } = await supabase.functions.invoke('consulta-painel-precos', {
        body: {
          termo,
          anoInicio: Number(anoInicio),
          anoFim: Number(anoFim),
          uf: uf !== TODOS ? uf : undefined,
          municipio: municipio !== TODOS ? municipio : undefined,
        },
      });

      if (error || !data?.success) {
        toast.error(error?.message || data?.error || 'Erro ao consultar PNCP.');
        setLoading(false);
        return;
      }

      setResultados(data.resultados || []);
      setResumo(data.resumo || null);

      if ((data.resultados || []).length === 0) {
        const descartados = Number(data.total_sem_filtro || 0);
        if (descartados > 0) {
          toast.warning(
            `Nenhum registro em ${escopoLabel}. ${descartados} registros foram encontrados em outras localidades — amplie o filtro para vê-los.`
          );
        } else {
          toast.warning('Nenhum registro encontrado no PNCP para esse termo e período.');
        }
      } else {
        toast.success(
          `${data.resultados.length} registros de preços reais encontrados no PNCP (${escopoLabel})!`
        );
      }
    } catch (e) {
      console.error(e);
      toast.error('Erro ao consultar o PNCP.');
    }

    setLoading(false);
  };

  const anos = Array.from({ length: 6 }, (_, i) => String(currentYear - i));

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="flex items-start gap-2 rounded-lg border border-border bg-secondary p-3 text-sm text-muted-foreground">
        <FileCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
        <p>
          Consulta direta à <strong>API oficial do PNCP</strong> (Portal Nacional de Contratações Públicas).
          Retorna <strong>preços unitários homologados</strong> de ATAs/SRP e contratos reais firmados por órgãos públicos.
        </p>
      </div>

      {/* Search bar */}
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            aria-label="Produto ou serviço a consultar"
            placeholder="Ex: Papel A4, Notebook, Monitor, Serviço de limpeza..."
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-9"
          />
        </div>
        <Select value={anoInicio} onValueChange={setAnoInicio}>
          <SelectTrigger aria-label="Ano inicial" className="w-[100px]">
            <SelectValue placeholder="De" />
          </SelectTrigger>
          <SelectContent>
            {anos.map((a) => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={anoFim} onValueChange={setAnoFim}>
          <SelectTrigger aria-label="Ano final" className="w-[100px]">
            <SelectValue placeholder="Até" />
          </SelectTrigger>
          <SelectContent>
            {anos.map((a) => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={handleSearch} disabled={loading}>
          {loading ? (
            <><Loader2 className="animate-spin" aria-hidden="true" /> Consultando PNCP...</>
          ) : (
            <><Building2 aria-hidden="true" /> Consultar PNCP</>
          )}
        </Button>
      </div>

      {/* Filtro geográfico da consulta PNCP */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" aria-hidden="true" /> Localidade da contratação:
        </span>

        <Select value={uf} onValueChange={handleUfChange}>
          <SelectTrigger aria-label="Estado" className="w-full sm:w-[190px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os estados</SelectItem>
            {UFS_BRASIL.map((e) => (
              <SelectItem key={e.uf} value={e.uf}>{e.nome} ({e.uf})</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover open={municipioOpen} onOpenChange={setMunicipioOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={municipioOpen}
              disabled={uf === TODOS || loadingMunicipios}
              className="w-full justify-between font-normal sm:w-[210px]"
            >
              <span className="truncate">
                {uf === TODOS
                  ? 'Selecione o estado'
                  : loadingMunicipios
                    ? 'Carregando cidades...'
                    : municipio === TODOS
                      ? 'Todas as cidades'
                      : municipio}
              </span>
              {loadingMunicipios ? (
                <Loader2 className="flex-shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />
              ) : (
                <ChevronsUpDown className="flex-shrink-0 text-muted-foreground" aria-hidden="true" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[260px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar cidade..." className="h-9" />
              <CommandList>
                <CommandEmpty>Nenhuma cidade encontrada.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="Todas as cidades"
                    onSelect={() => { setMunicipio(TODOS); setMunicipioOpen(false); }}
                  >
                    <Check className={cn('mr-2 w-3.5 h-3.5', municipio === TODOS ? 'opacity-100' : 'opacity-0')} />
                    Todas as cidades
                  </CommandItem>
                  {municipios.map((m) => (
                    <CommandItem
                      key={`${m.uf}-${m.id}`}
                      value={m.nome}
                      onSelect={() => { setMunicipio(m.nome); setMunicipioOpen(false); }}
                    >
                      <Check className={cn('mr-2 w-3.5 h-3.5', municipio === m.nome ? 'opacity-100' : 'opacity-0')} />
                      {m.nome}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {(uf !== TODOS || municipio !== TODOS) && (
          <>
            <Badge variant="outline" className="font-normal">
              Filtrando por {escopoLabel}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setUf(TODOS); setMunicipio(TODOS); }}
            >
              Limpar
            </Button>
          </>
        )}
      </div>

      {/* Resumo — cartão com KPIs (rótulo 13/500, valor 24/600 tabular, tinta ink). */}
      {resumo && (
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <h4 className="mb-3 flex items-center gap-2 text-base font-semibold leading-6 text-foreground">
            <BarChart3 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Resumo — Preços Homologados PNCP ({resumo.periodo || `${anoInicio}-${anoFim}`})
          </h4>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            <div className="rounded-md border border-border bg-secondary p-3">
              <p className="text-sm font-medium text-muted-foreground">Menor Preço</p>
              <p className="mt-1 text-2xl font-semibold leading-8 tabular-nums text-success-ink">{formatCurrency(resumo.menor_preco)}</p>
            </div>
            <div className="rounded-md border border-border bg-secondary p-3">
              <p className="text-sm font-medium text-muted-foreground">Maior Preço</p>
              <p className="mt-1 text-2xl font-semibold leading-8 tabular-nums text-destructive-ink">{formatCurrency(resumo.maior_preco)}</p>
            </div>
            <div className="rounded-md border border-border bg-secondary p-3">
              <p className="text-sm font-medium text-muted-foreground">Preço Médio</p>
              <p className="mt-1 text-2xl font-semibold leading-8 tabular-nums text-foreground">{formatCurrency(resumo.preco_medio)}</p>
            </div>
            {resumo.mediana != null && (
              <div className="rounded-md border border-border bg-secondary p-3">
                <p className="text-sm font-medium text-muted-foreground">Mediana</p>
                <p className="mt-1 text-2xl font-semibold leading-8 tabular-nums text-foreground">{formatCurrency(resumo.mediana)}</p>
              </div>
            )}
            <div className="rounded-md border border-border bg-secondary p-3">
              <p className="text-sm font-medium text-muted-foreground">Registros</p>
              <p className="mt-1 text-2xl font-semibold leading-8 tabular-nums text-foreground">{resumo.total_registros}</p>
              <p className="mt-1 text-xs text-muted-foreground">PNCP Oficial</p>
            </div>
          </div>
        </div>
      )}

      {/* Results list — cartões compactos; selos nas variantes semânticas. */}
      {resultados.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground tabular-nums">
            {resultados.length} itens com preço unitário encontrados no PNCP ({anoInicio}–{anoFim}) — {escopoLabel}
          </p>
          {resultados.map((r, i) => {
            const isCheapest = resumo ? r.preco_unitario === resumo.menor_preco : false;
            const isHomologado = r.situacao === 'Homologado';
            return (
              <div key={i} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-card p-3 shadow-sm transition-[border-color,box-shadow] duration-150 hover:border-primary/40 hover:shadow-md">
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium text-foreground">{r.descricao}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {r.tipo_registro && (
                      <Badge variant={r.tipo_registro === 'ATA/SRP' ? 'info' : 'muted'}>
                        {r.tipo_registro}
                      </Badge>
                    )}
                    <Badge variant={isHomologado ? 'success' : 'warning'}>
                      {isHomologado ? (
                        <><Scale className="h-3 w-3" aria-hidden="true" /> Homologado</>
                      ) : (
                        <><AlertTriangle className="h-3 w-3" aria-hidden="true" /> Estimado</>
                      )}
                    </Badge>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Building2 className="h-3 w-3" aria-hidden="true" /> {r.orgao}
                    </span>
                    {r.fornecedor && (
                      <span className="text-xs text-muted-foreground">venceu: {r.fornecedor}</span>
                    )}
                    {isHomologado && (
                      <span className="text-xs text-muted-foreground">
                        marca: {r.marca || 'não informada pelo órgão'}
                      </span>
                    )}
                    {(r.municipio || r.uf) && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" aria-hidden="true" />
                        {r.municipio && r.uf ? `${r.municipio}/${r.uf}` : r.municipio || r.uf}
                      </span>
                    )}
                    {r.data_compra && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                        <Calendar className="h-3 w-3" aria-hidden="true" /> {new Date(r.data_compra).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                    {r.modalidade && (
                      <span className="text-xs text-muted-foreground">{r.modalidade}</span>
                    )}
                    {r.quantidade > 1 && (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        Qtd: {r.quantidade.toLocaleString('pt-BR')} {r.unidade}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Preço unit.</p>
                    <p className="text-lg font-semibold tabular-nums text-foreground">{formatCurrency(r.preco_unitario)}</p>
                    {isCheapest && (
                      <Badge variant="success">
                        <TrendingDown className="h-3 w-3" aria-hidden="true" /> Menor
                      </Badge>
                    )}
                  </div>
                  {r.url && r.url !== '#' && (
                    <Button size="icon-sm" variant="ghost" onClick={() => window.open(r.url, '_blank')} title="Ver no PNCP" aria-label="Ver no PNCP">
                      <ExternalLink aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!loading && resultados.length === 0 && !resumo && (
        <div className="rounded-lg border border-dashed border-border">
          <EstadoVazio
            tamanho="compacto"
            icone={<Building2 />}
            titulo="Consulte preços unitários homologados em ATAs e contratos públicos"
            descricao={
              <>
                Dados oficiais do PNCP — últimos 3 anos
                {uf !== TODOS && ` • filtrando por ${escopoLabel}`}
              </>
            }
          />
        </div>
      )}

      {/* Fase 1 da recorrência: "este órgão já licitou objeto similar?" —
          mesma function do card do processo; aqui o CNPJ é digitável. */}
      <HistoricoDoOrgao permitirEditarCnpj objeto={termo} />
    </div>
  );
}
