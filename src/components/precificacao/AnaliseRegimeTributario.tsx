import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Search, Bot, Loader2, ShieldCheck, AlertTriangle, CheckCircle2, ExternalLink,
  FileText, Scale, Info, Globe, BookOpen, Gavel,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { streamAIChat } from '@/lib/ai-stream';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  getRegrasPorNCM, getRegrasPorUF, getTratamentoLabel, getCategoriaLabel,
  temDadosDetalhados, UF_TRIBUTARIA,
  type RegraTributariaUF, type TratamentoICMS,
} from '@/data/regimes-tributarios-uf';

interface ItemAnalise {
  descricao: string;
  ncm: string;
}

interface AnaliseResultadoItem {
  descricao: string;
  ncm: string;
  tratamento: TratamentoICMS;
  aliquota_efetiva: number;
  categoria: string;
  fundamentacao: string;
  observacoes?: string;
  st_mva?: number;
}

interface NcmAutoResult {
  ncm: string;
  descricao_ncm: string;
  analise_ia?: any;
  icms?: any;
  ipi?: any;
  pis_cofins?: any;
  st?: any;
  cest?: string;
  beneficios_fiscais?: string[];
  convenios_confaz?: string[];
  riscos_fiscais?: string;
  fontes?: { nome: string; url: string; tipo: string }[];
  fontes_referencia?: { nome: string; url: string }[];
  sugestoes_ncm?: { codigo: string; descricao: string }[];
}

interface Props {
  ufCalculo: string;
  ufNome: string;
  regime: string;
  regimeLabel: string;
  itens: { descricao: string; ncm?: string }[];
  onAliquotaUpdate?: (idx: number, aliquota: number, tratamento: TratamentoICMS) => void;
  onNcmUpdate?: (idx: number, ncm: string) => void;
}

export default function AnaliseRegimeTributario({ ufCalculo, ufNome, regime, regimeLabel, itens, onAliquotaUpdate, onNcmUpdate }: Props) {
  const [ncmInputs, setNcmInputs] = useState<string[]>(itens.map(i => i.ncm || ''));
  const [analiseIA, setAnaliseIA] = useState<AnaliseResultadoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [consultaManual, setConsultaManual] = useState('');
  const [resultadoManual, setResultadoManual] = useState('');
  const [loadingManual, setLoadingManual] = useState(false);
  
  // Auto-search state
  const [ncmAutoResults, setNcmAutoResults] = useState<Record<number, NcmAutoResult>>({});
  const [ncmAutoLoading, setNcmAutoLoading] = useState<Record<number, boolean>>({});
  const debounceTimers = useRef<Record<number, NodeJS.Timeout>>({});

  const ufData = UF_TRIBUTARIA[ufCalculo];
  const temDados = temDadosDetalhados(ufCalculo);
  const regrasUF = getRegrasPorUF(ufCalculo);

  // ── Auto-search NCM via edge function ──
  const buscarNCMAutomatico = useCallback(async (idx: number, ncm: string, descricao: string) => {
    const ncmClean = ncm.replace(/[^0-9.]/g, '');
    const ncmDigits = ncmClean.replace(/\D/g, '');
    
    // Only search if NCM has at least 4 digits
    if (ncmDigits.length < 4) return;

    setNcmAutoLoading(prev => ({ ...prev, [idx]: true }));

    try {
      const { data, error } = await supabase.functions.invoke('consulta-ncm', {
        body: { ncm: ncmClean, descricao, uf: ufCalculo, regime: regimeLabel },
      });

      if (error) {
        console.error('Erro consulta NCM:', error);
        toast.error('Erro ao consultar NCM');
        return;
      }

      setNcmAutoResults(prev => ({ ...prev, [idx]: data as NcmAutoResult }));

      // Auto-update aliquota if available
      if (data?.icms && onAliquotaUpdate) {
        const aliq = data.icms.isento ? 0 : (data.icms.aliquota_interna || 0);
        const trat: TratamentoICMS = data.icms.isento ? 'ISENTO'
          : data.st?.aplicavel ? 'ST'
          : data.icms.reducao_bc ? 'REDUCAO_BC'
          : data.icms.diferido ? 'DIFERIDO'
          : 'ALIQUOTA_CHEIA';
        onAliquotaUpdate(idx, aliq, trat);
      }

      toast.success(`NCM ${ncmClean} — classificação tributária concluída`);
    } catch (e) {
      console.error('Erro busca NCM:', e);
    } finally {
      setNcmAutoLoading(prev => ({ ...prev, [idx]: false }));
    }
  }, [ufCalculo, regimeLabel, onAliquotaUpdate]);

  const updateNcm = (idx: number, value: string) => {
    setNcmInputs(prev => prev.map((v, i) => i === idx ? value : v));
    
    // Debounce auto-search (800ms)
    if (debounceTimers.current[idx]) {
      clearTimeout(debounceTimers.current[idx]);
    }
    debounceTimers.current[idx] = setTimeout(() => {
      const descricao = itens[idx]?.descricao || '';
      buscarNCMAutomatico(idx, value, descricao);
    }, 800);
  };

  // Cleanup timers
  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach(clearTimeout);
    };
  }, []);

  // ── Análise rápida por NCM (local) ──
  const analisarLocal = (ncm: string, descricao: string): RegraTributariaUF | null => {
    if (!ncm.trim()) return null;
    const regras = getRegrasPorNCM(ufCalculo, ncm);
    if (regras.length > 0) return regras[0];
    return null;
  };

  // ── Análise completa via IA ──
  const analisarComIA = async () => {
    const itensValidos = itens.map((item, idx) => ({
      descricao: item.descricao,
      ncm: ncmInputs[idx] || '',
    })).filter(i => i.descricao.trim());

    if (itensValidos.length === 0) {
      toast.error('Informe ao menos um item com descrição.');
      return;
    }

    setLoading(true);
    setAnaliseIA([]);

    const itensTexto = itensValidos.map((item, idx) =>
      `${idx + 1}. ${item.descricao}${item.ncm ? ` (NCM: ${item.ncm})` : ''}`
    ).join('\n');

    const prompt = `Atue como analista tributário especialista em ICMS. Analise cada item abaixo e determine o TRATAMENTO TRIBUTÁRIO correto para o estado ${ufCalculo} (${ufNome}), considerando o regime ${regimeLabel}.

ITENS:
${itensTexto}

Para cada item, determine:
1. O NCM correto (se não informado, sugira o mais provável)
2. O tratamento ICMS: ISENTO, ST (Substituição Tributária), REDUCAO_BC (Redução de Base de Cálculo), DIFERIDO, ALIQUOTA_CHEIA ou ALIQUOTA_ESPECIAL
3. A alíquota efetiva real (%) considerando todos os benefícios fiscais do estado
4. A categoria fiscal do produto
5. A fundamentação legal (Decreto, Convênio CONFAZ, artigo do RICMS)
6. Se for ST, informe o MVA aplicável

REGRAS IMPORTANTES:
- Considere o RICMS do ${ufCalculo} atualizado
- Verifique Convênios CONFAZ vigentes (especialmente 142/18 para ST)
- Considere reduções de base de cálculo para cesta básica conforme legislação estadual
- Verifique isenções aplicáveis (hortifrutícolas, insumos agropecuários, etc.)
${ufCalculo === 'PA' ? '- PA: Decreto 2.931/2023 - 55 itens da cesta básica com carga tributária reduzida (3%, 1.8%, 1% ou isento)' : ''}
${ufCalculo === 'SP' ? '- SP: Decreto 68.492/2024 - diversos segmentos excluídos da ST' : ''}
${ufCalculo === 'SC' ? '- SC: Lei 18.673/2024 - ICMS zero para cesta básica' : ''}

Responda EXCLUSIVAMENTE em JSON:
[
  {
    "descricao": "Nome do item",
    "ncm": "0000.00.00",
    "tratamento": "ISENTO|ST|REDUCAO_BC|DIFERIDO|ALIQUOTA_CHEIA|ALIQUOTA_ESPECIAL",
    "aliquota_efetiva": 0.00,
    "categoria": "cesta_basica|medicamentos|informatica|etc",
    "fundamentacao": "Base legal exata",
    "observacoes": "Detalhes relevantes",
    "st_mva": null
  }
]`;

    let rawResult = '';

    try {
      await streamAIChat({
        messages: [{ role: 'user', content: prompt }],
        action: 'analise_tributaria',
        onDelta: (d) => { rawResult += d; },
        onDone: () => {
          try {
            // Extract JSON from response
            const jsonMatch = rawResult.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              const parsed: AnaliseResultadoItem[] = JSON.parse(jsonMatch[0]);
              setAnaliseIA(parsed);
              // Notify parent of aliquota updates
              parsed.forEach((item, idx) => {
                if (onAliquotaUpdate && idx < itens.length) {
                  onAliquotaUpdate(idx, item.aliquota_efetiva, item.tratamento);
                }
              });
              toast.success(`Análise tributária concluída para ${parsed.length} item(ns)!`);
            } else {
              toast.error('Não foi possível processar a resposta da IA.');
            }
          } catch (e) {
            console.error('Parse error:', e, rawResult);
            toast.error('Erro ao interpretar a análise tributária.');
          }
          setLoading(false);
        },
        onError: (err) => {
          toast.error('Erro: ' + err);
          setLoading(false);
        },
      });
    } catch {
      setLoading(false);
      toast.error('Erro ao conectar com a IA tributária.');
    }
  };

  // ── Consulta manual por NCM/produto ──
  const consultarManual = async () => {
    if (!consultaManual.trim()) {
      toast.error('Informe um NCM ou produto para consultar.');
      return;
    }

    setLoadingManual(true);
    setResultadoManual('');

    const prompt = `Atue como analista tributário e jurídico. Consulte o tratamento tributário do ICMS para o seguinte item no estado ${ufCalculo} (${ufNome}):

Item/NCM: ${consultaManual}
Regime tributário da empresa: ${regimeLabel}

Responda de forma técnica e objetiva:
1. **Classificação NCM** correta
2. **Tratamento ICMS** no ${ufCalculo}: Isento, ST, Redução de BC, Diferido ou Alíquota cheia
3. **Alíquota efetiva** (%)
4. **MVA** (se ST)
5. **CEST** (se aplicável)
6. **Fundamentação legal**: RICMS, Convênio CONFAZ, Decreto estadual
7. **Benefícios fiscais** aplicáveis
8. **Observações** sobre substituição tributária, antecipação ou diferimento

${ufCalculo === 'PA' ? 'Considere especialmente: Decreto 2.931/2023 (55 itens cesta básica PA), RICMS/PA (Decreto 4.676/2001), Convênios CONFAZ ratificados pela ALEPA.' : ''}

Formato: texto estruturado com tópicos numerados.`;

    let result = '';
    try {
      await streamAIChat({
        messages: [{ role: 'user', content: prompt }],
        action: 'consulta_tributaria',
        onDelta: (d) => { result += d; setResultadoManual(prev => prev + d); },
        onDone: () => { setLoadingManual(false); },
        onError: (err) => { toast.error('Erro: ' + err); setLoadingManual(false); },
      });
    } catch {
      setLoadingManual(false);
      toast.error('Erro na consulta tributária.');
    }
  };

  const TratamentoBadge = ({ tratamento, aliquota }: { tratamento: TratamentoICMS; aliquota: number }) => {
    const { label, cor } = getTratamentoLabel(tratamento);
    return (
      <Badge className={`text-[10px] font-medium border ${cor}`}>
        {tratamento === 'ISENTO' && <CheckCircle2 className="w-3 h-3 mr-1" />}
        {tratamento === 'ST' && <AlertTriangle className="w-3 h-3 mr-1" />}
        {label} {aliquota > 0 ? `(${aliquota}%)` : ''}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="bg-card rounded-xl border border-border/50 p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-accent" />
            <h3 className="font-semibold text-sm">
              Análise de Regime Tributário — {ufCalculo}
            </h3>
          </div>
          <Badge variant="outline" className="text-[10px]">
            <ShieldCheck className="w-3 h-3 mr-1" /> IA Tributária
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Identifica automaticamente o tratamento tributário (isenção, ST, redução de BC, diferimento) para cada item com base no NCM, UF e regime.
        </p>

        {/* Legislation info */}
        {temDados && ufData && (
          <div className="mt-3 bg-muted/30 rounded-lg p-3 space-y-1">
            <p className="text-[10px] text-muted-foreground">
              <strong className="text-foreground">Base legal:</strong> {ufData.legislacao_base}
            </p>
            <p className="text-[10px] text-muted-foreground">
              <strong className="text-foreground">Alíquota padrão:</strong> {ufData.aliquota_padrao}%
              {ufData.fundo_combate_pobreza > 0 && ` (+${ufData.fundo_combate_pobreza}% FCP)`}
            </p>
            <p className="text-[10px] text-muted-foreground">
              <strong className="text-foreground">Categorias mapeadas:</strong> {ufData.regras.length} regras tributárias
            </p>
            <p className="text-[10px] text-muted-foreground italic">
              Última atualização: {ufData.ultima_atualizacao}
            </p>
          </div>
        )}
      </div>

      {/* ── Panorama tributário do estado ── */}
      {temDados && (
        <div className="bg-card rounded-xl border border-border/50 p-5">
          <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-accent" />
            Panorama Tributário — {ufCalculo} ({ufNome})
          </h4>
          <div className="overflow-x-auto rounded-lg border border-border/50">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-[10px] font-semibold h-8">Categoria</TableHead>
                  <TableHead className="text-[10px] font-semibold h-8">Tratamento</TableHead>
                  <TableHead className="text-[10px] font-semibold h-8 text-right">Alíq. Efetiva</TableHead>
                  <TableHead className="text-[10px] font-semibold h-8">Fundamentação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {regrasUF.filter(r => !r.categoria.startsWith('servicos_')).map((regra, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="text-[10px] py-1.5 font-medium">
                      {getCategoriaLabel(regra.categoria)}
                    </TableCell>
                    <TableCell className="text-[10px] py-1.5">
                      <TratamentoBadge tratamento={regra.tratamento} aliquota={regra.aliquota_efetiva} />
                    </TableCell>
                    <TableCell className="text-[10px] py-1.5 text-right font-bold">
                      {regra.aliquota_efetiva === 0 ? 'Isento' : `${regra.aliquota_efetiva}%`}
                      {regra.aliquota_st_mva && (
                        <span className="text-muted-foreground ml-1">(MVA {regra.aliquota_st_mva}%)</span>
                      )}
                    </TableCell>
                    <TableCell className="text-[10px] py-1.5 text-muted-foreground max-w-[200px] truncate">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger className="text-left">
                            {regra.fundamentacao.length > 50
                              ? regra.fundamentacao.substring(0, 50) + '...'
                              : regra.fundamentacao}
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-xs">
                            <p className="text-xs">{regra.fundamentacao}</p>
                            {regra.observacoes && <p className="text-xs mt-1 text-muted-foreground">{regra.observacoes}</p>}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* ── NCM Input por Item ── */}
      {itens.some(i => i.descricao.trim()) && (
        <div className="bg-card rounded-xl border border-border/50 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Search className="w-4 h-4 text-accent" />
              Classificação NCM dos Itens
            </h4>
            <Button
              variant="outline"
              size="sm"
              onClick={analisarComIA}
              disabled={loading}
              className="gap-1.5 text-xs"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
              Analisar com IA
            </Button>
          </div>

          {itens.filter(i => i.descricao.trim()).map((item, idx) => {
            const regraLocal = analisarLocal(ncmInputs[idx] || '', item.descricao);
            const resultadoIA = analiseIA[idx];
            const autoResult = ncmAutoResults[idx];
            const autoLoading = ncmAutoLoading[idx];

            return (
              <div key={idx} className="bg-muted/20 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-foreground flex-1 truncate">
                    {item.descricao}
                  </span>
                  <div className="w-40 relative">
                    <Input
                      value={ncmInputs[idx] || ''}
                      onChange={e => updateNcm(idx, e.target.value)}
                      placeholder="NCM: 0000.00.00"
                      className="h-7 text-[10px] pr-7"
                    />
                    {autoLoading && (
                      <Loader2 className="w-3 h-3 animate-spin absolute right-2 top-2 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {/* Resultado auto-search NCM (portais oficiais + IA) */}
                {autoResult && !resultadoIA && (
                  <div className="bg-background/50 rounded-lg p-3 space-y-2 border border-border/30">
                    <div className="flex items-center gap-2 mb-1">
                      <Globe className="w-3.5 h-3.5 text-accent" />
                      <span className="text-[10px] font-semibold text-foreground">
                        Consulta Automática — Fontes Oficiais
                      </span>
                      {autoResult.fontes && (
                        <Badge variant="outline" className="text-[8px]">
                          {autoResult.fontes.length} fonte(s)
                        </Badge>
                      )}
                    </div>

                    {/* Descrição oficial NCM */}
                    {autoResult.descricao_ncm && (
                      <p className="text-[10px] text-muted-foreground">
                        <strong className="text-foreground">Descrição TIPI:</strong> {autoResult.descricao_ncm}
                      </p>
                    )}

                    {/* Sugestões de NCM */}
                    {autoResult.sugestoes_ncm && autoResult.sugestoes_ncm.length > 0 && !autoResult.descricao_ncm && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-medium text-foreground">Sugestões de NCM:</p>
                        {autoResult.sugestoes_ncm.map((sug, sIdx) => (
                          <button
                            key={sIdx}
                            onClick={() => updateNcm(idx, sug.codigo)}
                            className="block w-full text-left text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded px-2 py-1 transition-colors"
                          >
                            <strong>{sug.codigo}</strong> — {sug.descricao}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Tributos grid */}
                    {(autoResult.icms || autoResult.ipi || autoResult.pis_cofins) && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {autoResult.icms && (
                          <div className="bg-muted/30 rounded p-2">
                            <p className="text-[9px] font-semibold text-muted-foreground uppercase">ICMS</p>
                            <p className="text-xs font-bold text-foreground">
                              {autoResult.icms.isento ? 'Isento' : `${autoResult.icms.aliquota_interna || 0}%`}
                            </p>
                            {autoResult.icms.reducao_bc && (
                              <p className="text-[9px] text-accent">Red. BC: {autoResult.icms.reducao_bc}%</p>
                            )}
                          </div>
                        )}
                        {autoResult.ipi && (
                          <div className="bg-muted/30 rounded p-2">
                            <p className="text-[9px] font-semibold text-muted-foreground uppercase">IPI</p>
                            <p className="text-xs font-bold text-foreground">{autoResult.ipi.aliquota ?? 0}%</p>
                          </div>
                        )}
                        {autoResult.pis_cofins && (
                          <div className="bg-muted/30 rounded p-2">
                            <p className="text-[9px] font-semibold text-muted-foreground uppercase">PIS/COFINS</p>
                            <p className="text-xs font-bold text-foreground">
                              {(autoResult.pis_cofins.pis ?? 0)}% / {(autoResult.pis_cofins.cofins ?? 0)}%
                            </p>
                          </div>
                        )}
                        {autoResult.st?.aplicavel && (
                          <div className="bg-destructive/10 rounded p-2 border border-destructive/20">
                            <p className="text-[9px] font-semibold text-destructive uppercase">ST</p>
                            <p className="text-xs font-bold text-destructive">
                              MVA: {autoResult.st.mva ?? '—'}%
                            </p>
                            {autoResult.cest && (
                              <p className="text-[9px] text-muted-foreground">CEST: {autoResult.cest}</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Benefícios fiscais */}
                    {autoResult.beneficios_fiscais && autoResult.beneficios_fiscais.length > 0 && (
                      <div className="flex items-start gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-accent mt-0.5 shrink-0" />
                        <p className="text-[10px] text-muted-foreground">
                          <strong className="text-foreground">Benefícios:</strong>{' '}
                          {autoResult.beneficios_fiscais.join('; ')}
                        </p>
                      </div>
                    )}

                    {/* Riscos fiscais */}
                    {autoResult.riscos_fiscais && (
                      <div className="flex items-start gap-1.5">
                        <AlertTriangle className="w-3 h-3 text-yellow-500 mt-0.5 shrink-0" />
                        <p className="text-[10px] text-muted-foreground italic">
                          {autoResult.riscos_fiscais}
                        </p>
                      </div>
                    )}

                    {/* Fundamentação legal */}
                    {autoResult.analise_ia?.icms_fundamentacao && (
                      <div className="flex items-start gap-1.5">
                        <Gavel className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
                        <p className="text-[10px] text-muted-foreground">
                          <strong className="text-foreground">Base legal:</strong>{' '}
                          {autoResult.analise_ia.icms_fundamentacao}
                        </p>
                      </div>
                    )}

                    {/* Fontes consultadas */}
                    {autoResult.fontes && autoResult.fontes.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {autoResult.fontes.map((fonte, fIdx) => (
                          <Badge key={fIdx} variant="outline" className="text-[8px] gap-1">
                            {fonte.tipo === 'api_oficial' && <Globe className="w-2.5 h-2.5" />}
                            {fonte.tipo === 'legislacao_oficial' && <BookOpen className="w-2.5 h-2.5" />}
                            {fonte.tipo === 'ia_especializada' && <Bot className="w-2.5 h-2.5" />}
                            {fonte.nome}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Links de referência */}
                    {autoResult.fontes_referencia && (
                      <details className="text-[9px]">
                        <summary className="text-muted-foreground cursor-pointer hover:text-foreground">
                          Ver fontes de referência ({autoResult.fontes_referencia.length})
                        </summary>
                        <div className="mt-1 space-y-0.5 pl-3">
                          {autoResult.fontes_referencia.map((ref, rIdx) => (
                            <a
                              key={rIdx}
                              href={ref.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-accent hover:underline"
                            >
                              <ExternalLink className="w-2.5 h-2.5" />
                              {ref.nome}
                            </a>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                )}

                {/* Resultado local (base de dados) - fallback */}
                {regraLocal && !resultadoIA && !autoResult && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <TratamentoBadge tratamento={regraLocal.tratamento} aliquota={regraLocal.aliquota_efetiva} />
                    <Badge variant="outline" className="text-[9px]">{getCategoriaLabel(regraLocal.categoria)}</Badge>
                    <span className="text-[10px] text-muted-foreground">{regraLocal.fundamentacao}</span>
                  </div>
                )}

                {/* Resultado da IA batch */}
                {resultadoIA && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <TratamentoBadge tratamento={resultadoIA.tratamento} aliquota={resultadoIA.aliquota_efetiva} />
                      <Badge variant="outline" className="text-[9px]">NCM: {resultadoIA.ncm}</Badge>
                      <Badge variant="outline" className="text-[9px]">{resultadoIA.categoria}</Badge>
                      {resultadoIA.st_mva && (
                        <Badge variant="outline" className="text-[9px] text-destructive">MVA: {resultadoIA.st_mva}%</Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      <strong>Base legal:</strong> {resultadoIA.fundamentacao}
                    </p>
                    {resultadoIA.observacoes && (
                      <p className="text-[10px] text-muted-foreground italic">{resultadoIA.observacoes}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Consulta manual NCM/Produto ── */}
      <div className="bg-card rounded-xl border border-border/50 p-5 space-y-3">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Bot className="w-4 h-4 text-accent" />
          Consulta Tributária por NCM/Produto
        </h4>
        <p className="text-[10px] text-muted-foreground">
          Consulte o tratamento tributário específico de qualquer produto ou NCM no estado {ufCalculo}, incluindo ST, isenções, reduções de BC e fundamentação legal.
        </p>
        <div className="flex gap-2">
          <Input
            value={consultaManual}
            onChange={e => setConsultaManual(e.target.value)}
            placeholder="Ex: Notebook NCM 8471.30 ou 'cimento Portland'"
            className="flex-1"
            onKeyDown={e => e.key === 'Enter' && consultarManual()}
          />
          <Button
            onClick={consultarManual}
            disabled={loadingManual}
            size="sm"
            className="gap-1.5"
          >
            {loadingManual ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            Consultar
          </Button>
        </div>

        {resultadoManual && (
          <div className="bg-muted/30 rounded-lg p-4 space-y-2 max-h-80 overflow-y-auto">
            <div className="prose prose-sm max-w-none dark:prose-invert text-xs whitespace-pre-wrap">
              {resultadoManual}
            </div>
          </div>
        )}
      </div>

      {/* ── Notas legais ── */}
      <div className="bg-muted/20 rounded-lg p-3 flex items-start gap-2">
        <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
        <div className="text-[10px] text-muted-foreground space-y-1">
          <p>
            <strong>Aviso:</strong> Esta análise é baseada na legislação vigente e em dados públicos dos RICMS estaduais e Convênios CONFAZ. 
            Consulte um contador para validação formal antes de utilizar em processos licitatórios.
          </p>
          <p>
            Fontes: CONFAZ, SEFA estaduais, Legisweb, Diários Oficiais dos Estados.
          </p>
        </div>
      </div>
    </div>
  );
}
