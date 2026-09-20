import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import EstadoVazio from '@/components/shared/EstadoVazio';
import {
  Upload, FileText, Loader2, X, Sparkles, Download, Trash2,
  Plus, CheckCircle, Edit3, Save, Package, FileSpreadsheet,
  ShoppingCart, TrendingDown, TrendingUp, Minus, ExternalLink, Link2, AlertCircle, AlertTriangle, Bot,
} from 'lucide-react';
import { toast } from 'sonner';
import { extractTextFromFile } from '@/lib/pdf-text-extractor';
import { useEditalExtraction } from '@/hooks/useEditalExtraction';
import { useLinkedEditalSource } from '@/hooks/useLinkedEditalSource';
import { useSugestaoMarcas } from '@/hooks/useSugestaoMarcas';
import { useRascunho } from '@/hooks/useRascunho';
import { writeExcelFile } from '@/lib/excel-utils';
import { usePropostaCart } from '@/contexts/PropostaCartContext';
import { valorPorExtenso } from '@/lib/numero-extenso';
import { supabase } from '@/integrations/supabase/client';
import LimparItensExtraidosButton from '@/components/licitacoes/LimparItensExtraidosButton';

export interface PlanilhaItem {
  item: number;
  descricao: string;
  quantidade: number;
  unidade: string;
  catmat?: string;
  valorUnitarioRef?: number;
  valorTotalRef?: number;
  valorUnitario: number | null;
  valorTotal: number | null;
  marca: string;
  fontes?: { fonte: string; vendedor?: string; titulo: string; url: string; preco: number; nota?: number; total_avaliacoes?: number }[];
  avaliacao?: { score: number; nivel: 'alto' | 'medio' | 'baixo'; justificativa: string };
  cotacaoFalhou?: boolean;
}

const FONTE_LABELS: Record<string, string> = {
  mercadolivre: 'Mercado Livre',
  pncp_ata: 'PNCP (Ata)',
  pncp_contratacao: 'PNCP',
  kabum: 'KaBuM!',
  leroy_merlin: 'Leroy Merlin',
  marketplace: 'Pesquisa Web',
  ia_estimativa: 'Estimativa IA',
  agent_ia: 'Agente IA',
  historico_precos: 'Histórico',
};

const formatCurrency = (v: number | null) =>
  v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';

const parseCurrencyInput = (v: string): number | null => {
  const clean = v.replace(/[^\d,.-]/g, '').replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? null : Math.round(num * 100) / 100;
};

/** Números reais do trabalho de precificação — alimentam os cartões do topo. */
export interface EstatisticasPlanilha {
  totalItens: number;
  /** Itens que já têm cotação (fontes pesquisadas). */
  itensPesquisados: number;
  /** Lojas/órgãos distintos consultados nas cotações. */
  fontesConsultadas: number;
  /** Quanto o preço cotado fica abaixo da referência do edital (R$). */
  economia: number;
  atualizadoEm: Date | null;
  /** Economia item a item, para o gráfico do topo. Sai da MESMA varredura que
   *  apura os totais — nenhuma consulta a mais, nenhum dado novo: é o que já
   *  estava na planilha, agora visível. */
  economiaPorItem: { descricao: string; referencia: number; cotado: number; economia: number }[];
  /** Quantos itens têm 3+ fontes, 2, 1 e nenhuma. Confiança de uma cotação é
   *  quantas fontes independentes a sustentam — um preço só não é pesquisa. */
  confianca: { tresOuMais: number; duas: number; uma: number; semCotacao: number };
}

interface PlanilhaCustosEditalProps {
  onAddToProposta?: (itens: PlanilhaItem[]) => void;
  licitacaoId?: string | null;
  licitacaoNumero?: string;
  licitacaoOrgao?: string;
  /** Reporta os números da planilha para a página (cartões do topo e o
   *  recolhimento das entradas de extração quando já há itens). */
  onItensStatus?: (stats: EstatisticasPlanilha) => void;
}

export default function PlanilhaCustosEdital({
  onAddToProposta,
  licitacaoId,
  licitacaoNumero,
  licitacaoOrgao,
  onItensStatus,
}: PlanilhaCustosEditalProps) {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [itens, setItens] = useState<PlanilhaItem[]>([]);
  const [sourceLabel, setSourceLabel] = useState('');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [isCotando, setIsCotando] = useState(false);
  const [cotacaoProgress, setCotacaoProgress] = useState(0);
  const [cotacaoMsgs, setCotacaoMsgs] = useState<{ text: string; fontes?: { fonte: string; titulo: string; url: string; preco: number }[] }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const sessionIdRef = useRef<string>(crypto.randomUUID());
  const { extrairItensDoTexto, fetchItens, saveItensManual, deleteAllItens } = useEditalExtraction();
  const { resolveLinkedEditalText } = useLinkedEditalSource();
  const { addItem, pendingItems } = usePropostaCart();
  const { sugestoesPorItem, fetchSugestoes, gerarSugestoes, isGenerating } = useSugestaoMarcas();
  const effectiveLicitacaoId = licitacaoId || sessionIdRef.current;
  const { loadRascunho, autoSave, flush, saving, lastSaved, markLoaded } = useRascunho<{ itens: PlanilhaItem[]; sourceLabel?: string | null }>({
    modulo: 'precificacao_planilha',
    licitacaoId: licitacaoId || null,
    debounceMs: 2500,
  });

  const mapParsedToPlanilha = useCallback((parsed: Array<any>): PlanilhaItem[] => {
    const allItems: PlanilhaItem[] = parsed.map((p, i) => {
      const qty = Number(p.quantidade ?? 1);
      const vlrUnit = p.valor_unitario ? Number(p.valor_unitario) : null;
      const vlrTotal = p.valor_total ? Number(p.valor_total) : null;
      return {
        item: Number(p.item ?? i + 1),
        descricao: (p.descricao || '').trim(),
        quantidade: Number.isFinite(qty) && qty > 0 ? qty : 1,
        unidade: (p.unidade || 'UN').trim(),
        catmat: p.catmat || p.codigo_catmat || '',
        valorUnitarioRef: vlrUnit ?? undefined,
        valorTotalRef: vlrTotal ?? undefined,
        valorUnitario: null,
        valorTotal: null,
        marca: (p.marca || '').trim(),
      };
    }).filter((item) => item.descricao.length > 0);

    const itemMap = new Map<number, PlanilhaItem>();
    for (const item of allItems) {
      const existing = itemMap.get(item.item);
      if (!existing) {
        itemMap.set(item.item, item);
        continue;
      }

      const scoreOf = (value: PlanilhaItem) => (
        (value.valorUnitarioRef != null ? 2 : 0)
        + (value.valorTotalRef != null ? 2 : 0)
        + (value.descricao.length > existing.descricao.length ? 1 : 0)
      );

      if (scoreOf(item) > scoreOf(existing)) {
        itemMap.set(item.item, item);
      }
    }

    return Array.from(itemMap.values()).sort((a, b) => a.item - b.item);
  }, []);

  const mapLinkedItensToPlanilha = useCallback((linkedItens: Array<any>): PlanilhaItem[] => {
    return linkedItens.map((item, index) => ({
      item: Number(item.numero ?? index + 1),
      descricao: item.descricao || '',
      quantidade: Number(item.quantidade || 1),
      unidade: item.unidade || 'UN',
      catmat: '',
      valorUnitarioRef: item.valor_unitario || undefined,
      valorTotalRef: item.valor_total || undefined,
      valorUnitario: null,
      valorTotal: null,
      marca: item.marca || '',
    }));
  }, []);

  const persistReferenceItems = useCallback(async (parsed: Array<any>) => {
    if (!licitacaoId || parsed.length === 0) return;

    // Itens de outra pessoa não puderam ser apagados: gravar por cima duplicaria.
    if (!(await deleteAllItens(licitacaoId))) return;
    await saveItensManual(licitacaoId, parsed.map((item, idx) => ({
      numero: parseInt(String(item.item ?? idx + 1), 10) || (idx + 1),
      descricao: item.descricao || '',
      quantidade: Number(item.quantidade || 1),
      unidade: item.unidade || 'UN',
      valor_unitario: Number(item.valor_unitario || 0),
      valor_total: Number(item.valor_total || (Number(item.valor_unitario || 0) * Number(item.quantidade || 1))),
      lote: item.lote || 'Único',
      marca: item.marca || null,
      fabricante: item.fabricante || null,
      modelo: item.modelo || null,
      origem: 'ia',
    })));
  }, [licitacaoId, deleteAllItens, saveItensManual]);

  useEffect(() => {
    let ativo = true;

    loadRascunho().then(async (data) => {
      if (!ativo) return;

      if (data?.itens?.length) {
        setItens(data.itens);
        setSourceLabel(data.sourceLabel || 'rascunho salvo');
        markLoaded();
        return;
      }

      if (licitacaoId) {
        const linkedItens = await fetchItens(licitacaoId);
        if (!ativo) return;

        if (linkedItens.length > 0) {
          setItens(mapLinkedItensToPlanilha(linkedItens));
          setSourceLabel('itens do processo vinculado');
        }
      }

      markLoaded();
    });

    return () => {
      ativo = false;
    };
  }, [loadRascunho, licitacaoId, fetchItens, mapLinkedItensToPlanilha, markLoaded]);

  // Auto-gera sugestões quando itens são carregados e ainda não existe avaliação para este processo
  const autoSuggestKey = useRef<string | null>(null);
  useEffect(() => {
    if (itens.length === 0) return;
    if (autoSuggestKey.current === effectiveLicitacaoId) return;
    autoSuggestKey.current = effectiveLicitacaoId;

    fetchSugestoes(effectiveLicitacaoId).then(existing => {
      const itemDescs = new Set(itens.map(it => it.descricao.toLowerCase().trim()));
      const hasMatch = existing.some(s => itemDescs.has(s.descricao_item.toLowerCase().trim()));
      if (existing.length === 0 || !hasMatch) {
        gerarSugestoes(effectiveLicitacaoId, itens.map(it => ({
          numero: it.item,
          descricao: it.descricao,
          quantidade: it.quantidade,
          unidade: it.unidade,
          valor_unitario: it.valorUnitarioRef ?? undefined,
        })));
      }
    });
  }, [effectiveLicitacaoId, itens, fetchSugestoes, gerarSugestoes]);

  // Lookup normalizado: case-insensitive + trim para casar descrições do PDF com as salvas no banco
  const sugestoesPorDescNorm = Object.fromEntries(
    Object.entries(sugestoesPorItem).map(([k, v]) => [k.toLowerCase().trim(), v])
  );
  const getSugestoes = (descricao: string) =>
    sugestoesPorDescNorm[descricao.toLowerCase().trim()];

  useEffect(() => {
    const titulo = licitacaoNumero ? `Planilha de custos — ${licitacaoNumero}` : 'Planilha de custos';
    autoSave({ itens, sourceLabel }, titulo);
  }, [itens, sourceLabel, licitacaoNumero, autoSave]);

  // Cartões do topo: números medidos, não literais. Antes eram "0/0/-/-"
  // fixos no código — placeholder decorativo que o usuário lia como medição.
  const stats = useMemo(() => {
    const fontes = new Set<string>();
    let itensPesquisados = 0;
    let economia = 0;
    const porItem: EstatisticasPlanilha['economiaPorItem'] = [];
    const confianca = { tresOuMais: 0, duas: 0, uma: 0, semCotacao: 0 };

    for (const it of itens) {
      const qtdFontes = it.fontes?.length ?? 0;
      if (qtdFontes) {
        itensPesquisados++;
        for (const f of it.fontes!) fontes.add(f.vendedor || FONTE_LABELS[f.fonte] || f.fonte);
      }
      if (qtdFontes >= 3) confianca.tresOuMais++;
      else if (qtdFontes === 2) confianca.duas++;
      else if (qtdFontes === 1) confianca.uma++;
      else confianca.semCotacao++;

      const ref = it.valorUnitarioRef ?? 0;
      const un = it.valorUnitario ?? 0;
      if (ref > 0 && un > 0 && ref > un) {
        const dif = (ref - un) * (it.quantidade || 0);
        economia += dif;
        porItem.push({
          descricao: it.descricao,
          referencia: ref * (it.quantidade || 0),
          cotado: un * (it.quantidade || 0),
          economia: dif,
        });
      }
    }

    // O gráfico mostra os dez maiores: com 200 itens de edital, uma barra por
    // item vira um borrão — e quem precisa decidir olha os que pesam.
    porItem.sort((a, b) => b.economia - a.economia);
    return {
      itensPesquisados,
      fontesConsultadas: fontes.size,
      economia,
      economiaPorItem: porItem.slice(0, 10),
      confianca,
    };
  }, [itens]);

  useEffect(() => {
    onItensStatus?.({
      totalItens: itens.length,
      itensPesquisados: stats.itensPesquisados,
      fontesConsultadas: stats.fontesConsultadas,
      economia: stats.economia,
      atualizadoEm: lastSaved ?? null,
      economiaPorItem: stats.economiaPorItem,
      confianca: stats.confianca,
    });
    // `stats` é memoizado em [itens]: só muda quando a planilha muda, então
    // depender do objeto inteiro não recria o laço que as deps primitivas
    // evitavam — e as duas listas novas não têm forma primitiva.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itens.length, stats, lastSaved]);

  const handleCotarTodos = async () => {
    if (isCotando) return;
    if (itens.length === 0) {
      toast.error('Nenhum item na planilha', {
        description: 'Adicione itens antes de cotar. Use "Usar processo vinculado", faça upload de um edital ou clique em "Adicionar Item" para inserir manualmente.',
        duration: 7000,
      });
      return;
    }
    setIsCotando(true);
    setCotacaoProgress(0);
    setCotacaoMsgs([]);
    let cotados = 0;

    for (let idx = 0; idx < itens.length; idx++) {
      const it = itens[idx];
      setCotacaoProgress(Math.round(((idx) / itens.length) * 100));

      try {
        // Busca direto no Google Shopping via pesquisa-preco-real (Serper)
        const { data, error } = await supabase.functions.invoke('pesquisa-preco-real', {
          body: { termo: it.descricao.slice(0, 200) },
        });

        if (error || !data?.success) {
          setCotacaoMsgs(prev => [...prev, { text: `❌ Item ${it.item}: sem resultados` }]);
          setItens(prev => prev.map((item, i) => i === idx ? { ...item, cotacaoFalhou: true } : item));
          continue;
        }

        const fornecedores: any[] = (data?.data?.fornecedores || []).filter((f: any) => f.preco > 0);

        if (fornecedores.length === 0) {
          setCotacaoMsgs(prev => [...prev, { text: `❌ Item ${it.item}: nenhum resultado no Google Shopping` }]);
          setItens(prev => prev.map((item, i) => i === idx ? { ...item, cotacaoFalhou: true } : item));
          continue;
        }

        // Filtra preços abaixo de 20% do referencial (confusão unidade vs caixa)
        const precoRef = it.valorUnitarioRef || 0;
        const pool = precoRef > 0
          ? fornecedores.filter((f: any) => f.preco >= precoRef * 0.20)
          : fornecedores;
        const poolFinal = pool.length > 0 ? pool : fornecedores;

        // Prefere preços abaixo do referencial; se não houver, usa a mediana do pool
        const abaixoRef = precoRef > 0 ? poolFinal.filter((f: any) => f.preco <= precoRef) : [];
        const poolValido = abaixoRef.length > 0 ? abaixoRef : poolFinal;
        const precosValidos = poolValido.map((f: any) => f.preco).sort((a: number, b: number) => a - b);
        const validBestPrice = precosValidos[Math.floor(precosValidos.length / 2)];

        const marca = poolFinal.find((f: any) => f.marca)?.marca || '';
        const valorTotal = Math.round(validBestPrice * it.quantidade * 100) / 100;

        // Top 3 lojas únicas do Google Shopping
        const seenLoja = new Set<string>();
        const topFontes = poolFinal
          .filter((f: any) => {
            if (seenLoja.has(f.loja)) return false;
            seenLoja.add(f.loja);
            return true;
          })
          .slice(0, 3)
          .map((f: any) => ({
            fonte: 'marketplace',
            vendedor: f.loja,
            titulo: (f.produto || '').slice(0, 120),
            url: f.url || '',
            preco: f.preco,
            nota: f.avaliacao ?? undefined,
          }));

        setItens(prev => prev.map((item, i) => i === idx ? {
          ...item,
          valorUnitario: Math.round(validBestPrice * 100) / 100,
          valorTotal,
          marca: item.marca || marca,
          fontes: topFontes.length > 0 ? topFontes : undefined,
        } : item));

        // Diff vs referência
        let diffMsg = '';
        if (it.valorUnitarioRef && it.valorUnitarioRef > 0) {
          const diff = ((validBestPrice - it.valorUnitarioRef) / it.valorUnitarioRef) * 100;
          diffMsg = ` | ${diff > 0 ? '+' : ''}${diff.toFixed(1)}% vs referência`;
        }

        setCotacaoMsgs(prev => [...prev, {
          text: `✅ Item ${it.item}: ${formatCurrency(validBestPrice)} (${fornecedores.length} lojas Google Shopping)${diffMsg}`,
          fontes: topFontes.length > 0 ? topFontes : undefined,
        }]);
        cotados++;
      } catch (e) {
        console.error(`Cotação item ${it.item}:`, e);
        setCotacaoMsgs(prev => [...prev, { text: `❌ Item ${it.item}: erro na busca` }]);
      }
    }

    setCotacaoProgress(100);
    setIsCotando(false);
    toast.success(`Cotação finalizada: ${cotados}/${itens.length} itens cotados.`);

    // Avaliação automática por IA após cotação
    setItens(currentItens => {
      const itensParaAvaliar = currentItens.filter(it => it.valorUnitario && it.fontes?.length);
      if (itensParaAvaliar.length === 0) return currentItens;

      supabase.functions.invoke('avaliar-cotacoes', {
        body: {
          itens: itensParaAvaliar.map(it => ({
            item_numero: it.item,
            descricao: it.descricao,
            quantidade: it.quantidade,
            unidade: it.unidade,
            preco_ref: it.valorUnitarioRef ?? null,
            produto: it.fontes?.[0] ? {
              titulo: it.fontes[0].titulo,
              preco: it.fontes[0].preco,
              fonte: it.fontes[0].vendedor || it.fontes[0].fonte,
              nota_loja: it.fontes[0].nota ?? null,
              total_avaliacoes: it.fontes[0].total_avaliacoes ?? null,
            } : null,
          })),
        },
      }).then(({ data, error }) => {
        if (error || !data?.avaliacoes) return;
        setItens(prev => prev.map(it => {
          const av = data.avaliacoes.find((a: any) => a.item_numero === it.item);
          return av ? { ...it, avaliacao: { score: av.score, nivel: av.nivel, justificativa: av.justificativa } } : it;
        }));
      });

      return currentItens;
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 20MB.');
      return;
    }
    setFile(f);
    setItens([]);
    setSourceLabel('upload manual');
  };

  const handleRemoveFile = () => {
    setFile(null);
    setItens([]);
    setSourceLabel('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleExtractFromLinkedProcess = useCallback(async () => {
    if (!licitacaoId || isExtracting) return;

    setIsExtracting(true);
    try {
      const resolved = await resolveLinkedEditalText(licitacaoId);
      const text = resolved.text.trim();

      if (text.length < 50) {
        toast.warning('Edital do processo sem texto legível', {
        description: 'Não foi possível extrair o texto do edital vinculado. Faça o upload manual do arquivo do edital usando o botão acima.',
        duration: 7000,
      });
        return;
      }

      const parsed = await extrairItensDoTexto(text, { skipValidation: text.length < 500 });
      if (parsed.length === 0) {
        toast.warning('Nenhum item identificado no edital vinculado', {
          description: 'O edital pode estar em formato de imagem (PDF escaneado) ou sem lista de itens estruturada. Tente fazer o upload manual do arquivo.',
          duration: 7000,
        });
        return;
      }

      const planilha = mapParsedToPlanilha(parsed);
      setItens(planilha);
      setSourceLabel(resolved.source || 'processo vinculado');
      await persistReferenceItems(parsed);
      toast.success(`${planilha.length} itens carregados do processo vinculado!`);
    } catch (error) {
      console.error('Erro ao usar edital do processo vinculado:', error);
      toast.error('Falha ao carregar edital do processo vinculado', {
        description: 'Verifique se o processo possui edital associado e tente novamente. Se o problema persistir, faça o upload manual do arquivo.',
        duration: 7000,
      });
    } finally {
      setIsExtracting(false);
    }
  }, [licitacaoId, isExtracting, resolveLinkedEditalText, extrairItensDoTexto, mapParsedToPlanilha, persistReferenceItems]);

  const handleExtract = async () => {
    if (!file || isExtracting) return;
    setIsExtracting(true);
    setItens([]);

    try {
      let text = await extractTextFromFile(file, 150, true);
      if ((!text || text.trim().length < 20) && (file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf')) {
        try {
          const pdfjsLib = await import('pdfjs-dist');
          const workerModule = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
          pdfjsLib.GlobalWorkerOptions.workerSrc = workerModule.default;
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          const canvas = document.createElement('canvas');
          const images: { name: string; dataUrl: string }[] = [];
          for (let i = 1; i <= Math.min(pdf.numPages, 5); i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 2 });
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d')!;
            await page.render({ canvasContext: ctx, viewport }).promise;
            images.push({ name: `page-${i}.jpg`, dataUrl: canvas.toDataURL('image/jpeg', 0.85) });
          }
          if (images.length > 0) {
            const { data: ocrData, error: ocrErr } = await supabase.functions.invoke('document-vision-extract', {
              body: { fileName: file.name, images },
            });
            if (!ocrErr && ocrData?.text) text = ocrData.text;
          }
        } catch (canvasErr) {
          console.warn('Canvas OCR fallback failed:', canvasErr);
        }
      }
      if (!text || text.trim().length < 20) {
        toast.error('Documento sem texto legível', {
          description: 'Não foi possível extrair texto suficiente do arquivo. Se for PDF escaneado, tente enviar como imagem (JPG/PNG).',
          duration: 8000,
        });
        return;
      }

      const parsed = await extrairItensDoTexto(text, { skipValidation: true });
      if (parsed.length === 0) {
        toast.warning('Nenhum item identificado no documento', {
          description: 'A IA não encontrou itens estruturados neste arquivo. Certifique-se de que o documento é um edital, termo de referência ou anexo de itens. Tente outro arquivo ou adicione os itens manualmente.',
          duration: 8000,
        });
        return;
      }

      const planilha = mapParsedToPlanilha(parsed);
      setItens(planilha);
      setSourceLabel(file.name);
      await persistReferenceItems(parsed);
      toast.success(`${planilha.length} itens extraídos com sucesso!`);
    } catch (e) {
      console.error('Erro extração planilha:', e);
      toast.error('Falha ao processar documento', {
        description: e instanceof Error ? e.message : 'Não foi possível extrair os itens. Tente um formato diferente (PDF, DOCX, TXT) ou verifique se o arquivo não está corrompido.',
        duration: 8000,
      });
    } finally {
      setIsExtracting(false);
    }
  };

  const updateItem = (idx: number, field: keyof PlanilhaItem, value: any) => {
    setItens(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      const updated = { ...it, [field]: value };
      // Auto-calc total when unit price changes
      if (field === 'valorUnitario' && value != null) {
        updated.valorTotal = Math.round((value as number) * updated.quantidade * 100) / 100;
      }
      if (field === 'quantidade' && updated.valorUnitario != null) {
        updated.valorTotal = Math.round(updated.valorUnitario * (value as number) * 100) / 100;
      }
      return updated;
    }));
  };

  const removeItem = (idx: number) => {
    setItens(prev => prev.filter((_, i) => i !== idx));
  };

  const addEmptyItem = () => {
    setItens(prev => [...prev, {
      item: prev.length + 1,
      descricao: '',
      quantidade: 1,
      unidade: 'UN',
      valorUnitario: null,
      valorTotal: null,
      marca: '',
    }]);
    setEditingIdx(itens.length);
  };

  const totalGeral = itens.reduce((sum, it) => sum + (it.valorTotal ?? 0), 0);
  const totalRef = itens.reduce((sum, it) => sum + (it.valorTotalRef ?? 0), 0);

  const handleExportExcel = async () => {
    if (itens.length === 0) {
      toast.error('Nenhum item para exportar', {
        description: 'Adicione itens à planilha antes de exportar para Excel.',
        duration: 5000,
      });
      return;
    }

    const header = [
      'Item', 'Descrição / Especificação Técnica', 'CATMAT',
      'Unidade', 'Qtd', 'Vlr Unit Referência', 'Vlr Total Referência',
      'Marca / Fabricante', 'Vlr Unit Ofertado', 'Vlr Total Ofertado',
    ];

    const rows = itens.map(it => [
      it.item,
      it.descricao,
      it.catmat || '',
      it.unidade,
      it.quantidade,
      it.valorUnitarioRef ?? '',
      it.valorTotalRef ?? '',
      it.marca || '',
      it.valorUnitario ?? '',
      it.valorTotal ?? '',
    ]);

    const totalRow = [
      '', 'VALOR TOTAL →', '', '', '', '',
      totalRef > 0 ? totalRef : '', '', '', totalGeral > 0 ? totalGeral : '',
    ];

    const data = [
      ['PLANILHA DE PREÇOS — EXTRAÇÃO POR IA'],
      [`Documento: ${file?.name || 'N/A'}`],
      [`Data: ${new Date().toLocaleDateString('pt-BR')}`],
      [],
      header,
      ...rows,
      [],
      totalRow,
    ];

    // Build sources sheet
    const fontesHeader = ['Item', 'Fonte', 'Produto', 'Preço', 'Link'];
    const fontesRows = itens
      .filter(it => it.fontes && it.fontes.length > 0)
      .flatMap(it => (it.fontes || []).map(f => [
        it.item,
        FONTE_LABELS[f.fonte] ?? f.fonte,
        f.titulo,
        f.preco,
        f.url || '',
      ]));

    const sheets: any[] = [
      { name: 'Planilha de Preços', data, colWidths: [8, 60, 12, 18, 8, 18, 18, 22, 18, 18] },
    ];

    if (fontesRows.length > 0) {
      sheets.push({
        name: 'Fontes de Referência',
        data: [
          ['FONTES DE REFERÊNCIA — LINKS DAS COTAÇÕES'],
          [`Data: ${new Date().toLocaleDateString('pt-BR')}`],
          [],
          fontesHeader,
          ...fontesRows,
        ],
        colWidths: [8, 20, 60, 18, 60],
      });
    }

    await writeExcelFile(
      `Planilha_Precos_${new Date().toISOString().slice(0, 10)}.xlsx`,
      sheets
    );
    toast.success('Planilha de preços exportada!');
  };

  const handleAddAllToProposta = async () => {
    const validItens = itens.filter(it => it.valorUnitario != null && it.valorUnitario > 0);
    if (validItens.length === 0) {
      toast.error('Preencha os valores unitários antes de adicionar à proposta.');
      return;
    }
    await flush();
    validItens.forEach(it => {
      addItem({
        item: String(pendingItems.length + 1),
        descricao: it.descricao,
        quantidade: String(it.quantidade),
        unidade: it.unidade,
        marca: it.marca || '',
        fabricante: '',
        modelo: '',
        valorUnitario: (it.valorUnitario ?? 0).toFixed(2).replace('.', ','),
        valorUnitarioExtenso: valorPorExtenso(it.valorUnitario ?? 0),
        valorTotal: (it.valorTotal ?? 0).toFixed(2).replace('.', ','),
        valorTotalExtenso: valorPorExtenso(it.valorTotal ?? 0),
      });
    });

    // Also persist to catalog linked to the process
    if (user) {
      const rows = validItens.map(it => ({
        user_id: user.id,
        descricao: it.descricao,
        quantidade: it.quantidade,
        unidade: it.unidade,
        marca: it.marca || null,
        custo_unitario: it.valorUnitario ?? 0,
        preco_unitario: it.valorUnitario ?? 0,
        preco_total: it.valorTotal ?? 0,
        tipo_calculo: 'marketplace',
        licitacao_id: licitacaoId || null,
        licitacao_numero: licitacaoNumero || null,
        licitacao_orgao: licitacaoOrgao || null,
      }));
      const { error } = await supabase.from('catalogo_itens_precificados').insert(rows);
      if (error) {
        console.error('Erro ao vincular itens ao catálogo/processo:', error);
        toast.error('Os itens foram enviados, mas falhou o vínculo com o processo licitatório.');
      }
    }

    toast.success(`${validItens.length} itens adicionados à Proposta Comercial!`);
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt,.xlsx,.xls,.jpg,.jpeg,.png,.webp,.odt"
        className="hidden"
        onChange={handleFileChange}
      />

      {!file ? (
        // Com itens já na planilha (chegam sozinhos do processo vinculado), as
        // entradas de extração saem do palco: viram "Opções avançadas". Limpar
        // esvazia a planilha e elas voltam ao lugar — porque voltam a ser úteis.
        licitacaoId && itens.length > 0 ? (
          <details className="rounded-lg border border-border bg-secondary">
            <summary className="cursor-pointer select-none rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="font-medium text-foreground">{itens.length} item(ns) na planilha</span>
              {sourceLabel ? ` — ${sourceLabel}` : ''} · Opções avançadas de extração (reextrair, upload manual, limpar)
            </summary>
            <div className="space-y-3 border-t border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Processo vinculado</p>
                  <p className="text-sm text-muted-foreground">
                    Recarregue os itens do processo ou limpe para começar do zero.
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <LimparItensExtraidosButton
                    licitacaoId={licitacaoId}
                    fontes={['licitacao_itens', 'catalogo_itens_precificados']}
                    onCleared={() => { setItens([]); setSourceLabel(''); }}
                    label="Limpar"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleExtractFromLinkedProcess}
                    disabled={isExtracting}
                  >
                    {isExtracting ? (
                      <><Loader2 className="animate-spin" aria-hidden="true" /> Carregando...</>
                    ) : (
                      <><Link2 aria-hidden="true" /> Recarregar do processo</>
                    )}
                  </Button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full flex-col items-center gap-1.5 rounded-lg border border-dashed border-input bg-card p-4 transition-colors duration-150 hover:border-primary/40 hover:bg-primary-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Upload className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                <span className="text-sm font-semibold text-foreground">Enviar Edital/TR/Anexo (substitui a extração)</span>
                <span className="text-xs text-muted-foreground">PDF, Word, Excel, Imagens (JPG/PNG), TXT — Máx. 20MB</span>
              </button>
            </div>
          </details>
        ) : (
        <div className="space-y-3">
          {licitacaoId && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-secondary px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Processo vinculado pronto para uso</p>
                <p className="text-sm text-muted-foreground">
                  Use o edital já associado ao processo para extrair itens sem novo upload.
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <LimparItensExtraidosButton
                  licitacaoId={licitacaoId}
                  fontes={['licitacao_itens', 'catalogo_itens_precificados']}
                  onCleared={() => { setItens([]); setSourceLabel(''); }}
                  label="Limpar"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExtractFromLinkedProcess}
                  disabled={isExtracting}
                >
                  {isExtracting ? (
                    <><Loader2 className="animate-spin" aria-hidden="true" /> Carregando...</>
                  ) : (
                    <><Link2 aria-hidden="true" /> Usar processo vinculado</>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Zona de upload: cartão tracejado; o hover usa a tinta da ação. */}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed border-input bg-card p-6 transition-colors duration-150 hover:border-primary/40 hover:bg-primary-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary-tint text-primary" aria-hidden="true">
              <Upload className="h-6 w-6" />
            </span>
            <span className="text-base font-semibold text-foreground">
              Envie o Edital, Termo de Referência ou Anexo
            </span>
            <span className="text-sm text-muted-foreground">
              A IA extrairá itens com descrição, quantidade, unidade e valores de referência
            </span>
            <span className="text-xs text-muted-foreground">
              PDF, Word, Excel, Imagens (JPG/PNG), TXT — Máx. 20MB
            </span>
          </button>
        </div>
        )
      ) : (
        <div className="rounded-lg border border-border bg-secondary p-4">
          <div className="flex flex-wrap items-center gap-3">
            <FileText className="h-8 w-8 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(0)} KB
                {itens.length > 0 && (
                  <span className="ml-2 text-success-ink">✓ {itens.length} itens extraídos</span>
                )}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              {itens.length === 0 && (
                <Button onClick={handleExtract} disabled={isExtracting} size="sm">
                  {isExtracting ? (
                    <><Loader2 className="animate-spin" aria-hidden="true" /> Extraindo...</>
                  ) : (
                    <><Sparkles aria-hidden="true" /> Extrair Itens</>
                  )}
                </Button>
              )}
              <Button variant="ghost" size="icon-sm" onClick={handleRemoveFile} aria-label="Remover arquivo">
                <X aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Planilha de Custos Table */}
      {itens.length > 0 && (
        <>
          {/* Actions bar — uma ação principal (Cotar Todos); o resto em contorno. */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm font-semibold text-foreground tabular-nums">{itens.length} itens</span>
            {sourceLabel && (
              <Badge variant="outline" truncate>
                {sourceLabel}
              </Badge>
            )}
              {totalRef > 0 && (
                <Badge variant="outline" className="tabular-nums">
                  Ref: {formatCurrency(totalRef)}
                </Badge>
              )}
              {totalGeral > 0 && (
                <Badge
                  variant={totalRef > 0 && totalGeral > totalRef ? 'danger' : 'success'}
                  className="tabular-nums"
                >
                  {totalRef > 0 && totalGeral > totalRef && <AlertTriangle className="h-3 w-3" aria-hidden="true" />}
                  Total: {formatCurrency(totalGeral)}
                  {totalRef > 0 && totalGeral > totalRef && <span>↑ acima do contrato</span>}
                </Badge>
              )}
            {lastSaved && (
              <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {saving ? 'Salvando...' : `Salvo ${lastSaved.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
              </span>
            )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="default"
                onClick={handleCotarTodos}
                disabled={isCotando}
              >
                {isCotando ? (
                  <><Loader2 className="animate-spin" aria-hidden="true" /> Cotando...</>
                ) : (
                  <><ShoppingCart aria-hidden="true" /> Cotar Todos</>
                )}
              </Button>
              <Button variant="outline" size="sm" onClick={addEmptyItem}>
                <Plus aria-hidden="true" /> Adicionar Item
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportExcel}>
                <Download aria-hidden="true" /> Exportar Excel
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleAddAllToProposta}
              >
                <Package aria-hidden="true" /> Enviar à Proposta
              </Button>
            </div>
          </div>

          {/* Cotação progress */}
          {isCotando && (
            <div className="space-y-2" role="status" aria-live="polite">
              <Progress value={cotacaoProgress} className="h-2" />
              <p className="text-xs text-muted-foreground tabular-nums">
                Cotando itens... {cotacaoProgress}%
              </p>
            </div>
          )}

          {/* Cotação messages */}
          {cotacaoMsgs.length > 0 && (
            <div className="max-h-40 space-y-0.5 overflow-y-auto rounded-md border border-border bg-secondary p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">Resultado da Cotação</span>
                <Button variant="ghost" size="sm" onClick={() => setCotacaoMsgs([])}>
                  Limpar
                </Button>
              </div>
              {cotacaoMsgs.map((msg, i) => (
                <div key={i} className="space-y-0.5">
                  <p className="text-sm text-muted-foreground">{msg.text}</p>
                  {msg.fontes && msg.fontes.length > 0 && (
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 pl-3">
                      {msg.fontes.map((f, fi) => (
                        f.url ? (
                          <a
                            key={fi}
                            href={f.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-0.5 rounded-sm text-xs text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            title={f.titulo}
                          >
                            <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                            {FONTE_LABELS[f.fonte] ?? f.fonte} — {formatCurrency(f.preco)}
                          </a>
                        ) : (
                          <span
                            key={fi}
                            className="flex items-center gap-0.5 text-xs text-muted-foreground"
                            title={f.titulo}
                          >
                            {FONTE_LABELS[f.fonte] ?? f.fonte} — {formatCurrency(f.preco)}
                          </span>
                        )
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Table — tabela editável na anatomia v3 (`ui/table`): cabeçalho
              rebaixado, rótulos 12/600, campos de 40px em célula `px-2 py-1.5`,
              números à direita, rolagem presa ao contêiner. */}
          <div className="overflow-hidden rounded-md border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Item</TableHead>
                  <TableHead className="min-w-[200px]">Descrição</TableHead>
                  <TableHead className="w-16 text-right">Qtd</TableHead>
                  <TableHead className="w-20">Unidade</TableHead>
                  <TableHead className="w-28 text-right">Vlr Unit Ref</TableHead>
                  <TableHead className="w-28 text-right">Vlr Total Ref</TableHead>
                  <TableHead className="w-28">Marca</TableHead>
                  <TableHead className="w-28 text-right text-foreground">Vlr Unitário</TableHead>
                  <TableHead className="w-28 text-right text-foreground">Vlr Total</TableHead>
                  <TableHead className="min-w-[110px]">Fonte</TableHead>
                  <TableHead className="min-w-[140px]">Avaliação</TableHead>
                  <TableHead className="w-10"><span className="sr-only">Ações</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itens.map((it, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="px-2 py-1.5 font-medium tabular-nums text-muted-foreground">{it.item}</TableCell>
                    <TableCell className="px-2 py-1.5">
                      {editingIdx === idx ? (
                        <Input
                          aria-label="Descrição do item"
                          value={it.descricao}
                          onChange={(e) => updateItem(idx, 'descricao', e.target.value)}
                          className="min-w-[200px]"
                        />
                      ) : (
                        <button
                          type="button"
                          className="line-clamp-2 rounded-sm text-left text-sm text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={() => setEditingIdx(idx)}
                          title={it.descricao}
                        >
                          {it.descricao}
                        </button>
                      )}
                    </TableCell>
                    <TableCell className="px-2 py-1.5">
                      <Input
                        aria-label="Quantidade"
                        type="number"
                        value={it.quantidade}
                        onChange={(e) => updateItem(idx, 'quantidade', Number(e.target.value) || 1)}
                        className="ml-auto w-16 text-right tabular-nums"
                        min={1}
                      />
                    </TableCell>
                    <TableCell className="px-2 py-1.5">
                      <Input
                        aria-label="Unidade"
                        value={it.unidade}
                        onChange={(e) => updateItem(idx, 'unidade', e.target.value)}
                        className="w-20"
                      />
                    </TableCell>
                    <TableCell className="px-2 py-1.5 text-right tabular-nums text-muted-foreground" nowrap>
                      {it.valorUnitarioRef != null ? formatCurrency(it.valorUnitarioRef) : '—'}
                    </TableCell>
                    <TableCell className="px-2 py-1.5 text-right tabular-nums text-muted-foreground" nowrap>
                      {it.valorTotalRef != null ? formatCurrency(it.valorTotalRef) : '—'}
                    </TableCell>
                    <TableCell className="px-2 py-1.5">
                      <div className="flex flex-col gap-0.5">
                        <Input
                          aria-label="Marca"
                          value={it.marca}
                          onChange={(e) => updateItem(idx, 'marca', e.target.value)}
                          className="w-24"
                          placeholder="Digitar..."
                        />
                        {!it.marca && (
                          <span className="whitespace-nowrap text-xs text-warning-ink">
                            Edital não informa
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-2 py-1.5">
                      <MoneyInput
                        aria-label="Valor unitário"
                        value={it.valorUnitario ?? 0}
                        onValueChange={(v) => updateItem(idx, 'valorUnitario', v || null)}
                        className="ml-auto w-28 text-right font-medium tabular-nums"
                      />
                    </TableCell>
                    <TableCell className="px-2 py-1.5 text-right font-semibold tabular-nums" nowrap>
                      {it.valorTotal != null && it.valorTotal > 0 ? (
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-foreground">{formatCurrency(it.valorTotal)}</span>
                          {it.valorUnitarioRef != null && it.valorUnitarioRef > 0 && it.valorUnitario != null && it.valorUnitario > 0 && (() => {
                            const diff = ((it.valorUnitario - it.valorUnitarioRef) / it.valorUnitarioRef) * 100;
                            const isLower = diff < -1;
                            const isHigher = diff > 1;
                            return (
                              <span className={`flex items-center gap-0.5 text-xs ${isLower ? 'text-success-ink' : isHigher ? 'text-destructive-ink' : 'text-muted-foreground'}`}>
                                {isLower ? <TrendingDown className="h-3 w-3" aria-hidden="true" /> : isHigher ? <TrendingUp className="h-3 w-3" aria-hidden="true" /> : <Minus className="h-3 w-3" aria-hidden="true" />}
                                {diff > 0 ? '+' : ''}{diff.toFixed(1)}%
                              </span>
                            );
                          })()}
                        </div>
                      ) : it.cotacaoFalhou ? (
                        <div
                          title="Não foi possível encontrar preço em fontes verificáveis. Para itens controlados, consulte CMED/ANVISA manualmente."
                          className="flex cursor-help items-center justify-end gap-0.5 text-xs font-normal text-warning-ink"
                        >
                          <AlertCircle className="h-3 w-3" aria-hidden="true" />
                          Não encontrado
                        </div>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="min-w-[110px] px-2 py-1.5">
                      {it.fontes && it.fontes.length > 0 ? (
                        <div className="space-y-1.5">
                          {it.fontes.slice(0, 1).map((f, fi) => (
                            <div key={fi} className="space-y-0.5">
                              {f.url ? (
                                <a
                                  href={f.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title={f.titulo}
                                  className="block rounded-sm text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                  {f.vendedor || FONTE_LABELS[f.fonte] || f.fonte}
                                </a>
                              ) : (
                                <span className="block text-xs font-medium text-muted-foreground">
                                  {f.vendedor || FONTE_LABELS[f.fonte] || f.fonte}
                                </span>
                              )}
                              {f.nota != null && (
                                <div className="flex items-center gap-0.5">
                                  <span className="text-xs text-warning-ink" aria-hidden="true">{'★'.repeat(Math.round(f.nota))}{'☆'.repeat(5 - Math.round(f.nota))}</span>
                                  <span className="text-xs text-muted-foreground tabular-nums">{f.nota.toFixed(1)}{f.total_avaliacoes ? ` (${f.total_avaliacoes})` : ''}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="min-w-[160px] max-w-[220px] px-2 py-1.5">
                      {it.avaliacao ? (() => {
                        const av = it.avaliacao!;
                        // Mesmos degraus de antes (80/60/40); só a cor virou
                        // variante semântica do Badge (tinta/linha do DS).
                        const variante = av.score >= 80
                          ? 'success'
                          : av.score >= 60
                          ? 'info'
                          : av.score >= 40
                          ? 'warning'
                          : 'danger';
                        return (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Badge variant={variante} className="cursor-pointer tabular-nums" role="button" tabIndex={0}>
                                {av.score}% confiança
                              </Badge>
                            </PopoverTrigger>
                            <PopoverContent side="left" className="w-72 text-sm leading-relaxed">
                              {av.justificativa}
                            </PopoverContent>
                          </Popover>
                        );
                      })() : <span className="text-xs text-foreground-tertiary">—</span>}
                    </TableCell>
                    <TableCell className="px-2 py-1.5 text-right">
                      <Button
                        variant="ghost-destructive"
                        size="icon-sm"
                        onClick={() => removeItem(idx)}
                        aria-label={`Remover item ${it.item}`}
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              {/* Footer totals */}
              <TableFooter>
                <TableRow className="hover:bg-secondary">
                  <TableCell colSpan={4} className="text-right text-xs text-muted-foreground">
                    TOTAL GERAL →
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {/* empty */}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground" nowrap>
                    {totalRef > 0 ? formatCurrency(totalRef) : '—'}
                  </TableCell>
                  <TableCell>{/* marca col */}</TableCell>
                  <TableCell>{/* unit price col */}</TableCell>
                  <TableCell className={`text-right tabular-nums ${totalRef > 0 && totalGeral > totalRef ? 'text-destructive-ink' : 'text-foreground'}`} nowrap>
                    {totalGeral > 0 ? (
                      <div className="flex flex-col items-end leading-tight">
                        <span>{formatCurrency(totalGeral)}</span>
                        {totalRef > 0 && totalGeral > totalRef && (
                          <span className="text-xs font-normal text-destructive-ink">acima do contrato</span>
                        )}
                      </div>
                    ) : '—'}
                  </TableCell>
                  <TableCell></TableCell>{/* link col */}
                  <TableCell></TableCell>{/* avaliacao col */}
                  <TableCell></TableCell>
                </TableRow>
              </TableFooter>
            </Table>
           </div>

          {/* Sources / References Table */}
          {itens.some(it => it.fontes && it.fontes.length > 0) && (
            <div className="overflow-hidden rounded-md border border-border bg-card">
              <div className="flex items-center gap-2 border-b border-border bg-secondary px-3 py-2">
                <Link2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <span className="text-sm font-semibold text-foreground">Fontes de Referência — Links das Cotações</span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Item</TableHead>
                    <TableHead>Fonte</TableHead>
                    <TableHead className="min-w-[200px]">Produto</TableHead>
                    <TableHead className="w-24 text-right">Preço</TableHead>
                    <TableHead className="w-24">Avaliação</TableHead>
                    <TableHead className="w-16 text-right">Link</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itens.filter(it => it.fontes && it.fontes.length > 0).flatMap(it =>
                    (it.fontes || []).map((f, fi) => (
                      <TableRow key={`${it.item}-${fi}`}>
                        <TableCell className="font-medium tabular-nums text-muted-foreground">{fi === 0 ? it.item : ''}</TableCell>
                        <TableCell>
                          <Badge variant="outline" truncate>
                            {f.vendedor || FONTE_LABELS[f.fonte] || f.fonte}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[300px] text-muted-foreground" truncate title={f.titulo}>
                          {f.titulo}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums" nowrap>{formatCurrency(f.preco)}</TableCell>
                        <TableCell>
                          {fi === 0 && it.avaliacao ? (() => {
                            const av = it.avaliacao!;
                            const variante = av.score >= 80
                              ? 'success'
                              : av.score >= 60
                              ? 'info'
                              : av.score >= 40
                              ? 'warning'
                              : 'danger';
                            return (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Badge variant={variante} className="cursor-pointer tabular-nums" role="button" tabIndex={0}>
                                    {av.score}%
                                  </Badge>
                                </PopoverTrigger>
                                <PopoverContent side="left" className="w-72 text-sm leading-relaxed">
                                  {av.justificativa}
                                </PopoverContent>
                              </Popover>
                            );
                          })() : <span className="text-foreground-tertiary">—</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          {f.url ? (
                            <a
                              href={f.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`Abrir cotação em ${f.vendedor || FONTE_LABELS[f.fonte] || f.fonte}`}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-primary transition-colors hover:bg-primary-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <ExternalLink className="h-4 w-4" aria-hidden="true" />
                            </a>
                          ) : (
                            <span className="text-foreground-tertiary">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Instructions */}
          <div className="space-y-1 rounded-md border border-border bg-secondary p-3 text-sm text-muted-foreground">
            <p className="mb-1 text-sm font-semibold text-foreground">📋 Instruções</p>
            <p>• Use <strong className="text-foreground">"Cotar Todos"</strong> para o sistema buscar preços automaticamente no Google Shopping, Mercado Livre e demais plataformas.</p>
            <p>• A cotação preenche <strong>Marca</strong>, <strong>Valor Unitário</strong> e <strong>Valor Total</strong> automaticamente, exibindo a <strong>% de diferença</strong> vs referência.</p>
            <p>• Os valores de referência do edital (quando disponíveis) são exibidos nas colunas <strong className="text-foreground">"Vlr Unit Ref"</strong> e <strong className="text-foreground">"Vlr Total Ref"</strong>.</p>
            <p>• A tabela <strong>"Fontes de Referência"</strong> exibe os links de onde cada preço e marca foram extraídos.</p>
            <p>• Use <strong>"Exportar Excel"</strong> para baixar a planilha e <strong>"Enviar à Proposta"</strong> para transferir os itens.</p>
          </div>
        </>
      )}

      {/* Empty state */}
      {!file && itens.length === 0 && (
        <EstadoVazio
          tamanho="compacto"
          icone={<FileSpreadsheet />}
          titulo="Envie um documento e a IA gerará automaticamente a planilha de custos com todos os itens estruturados"
        />
      )}
    </div>
  );
}
