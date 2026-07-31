import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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

interface PlanilhaCustosEditalProps {
  onAddToProposta?: (itens: PlanilhaItem[]) => void;
  licitacaoId?: string | null;
  licitacaoNumero?: string;
  licitacaoOrgao?: string;
}

export default function PlanilhaCustosEdital({
  onAddToProposta,
  licitacaoId,
  licitacaoNumero,
  licitacaoOrgao,
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

    await deleteAllItens(licitacaoId);
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
        const { data, error } = await supabase.functions.invoke('price-search', {
          body: {
            descricao: it.descricao.slice(0, 200),
            codigoCatmat: it.catmat || undefined,
            unidade: it.unidade,
            quantidade: it.quantidade,
            modo: 'auto',
          },
        });

        if (error || !data?.estatisticas) {
          setCotacaoMsgs(prev => [...prev, { text: `❌ Item ${it.item}: sem resultados` }]);
          setItens(prev => prev.map((item, i) => i === idx ? { ...item, cotacaoFalhou: true } : item));
          continue;
        }

        const stats = data.estatisticas;
        const bestPrice = stats.preco_sugerido > 0 ? stats.preco_sugerido : stats.mediana;

        if (bestPrice <= 0) {
          setCotacaoMsgs(prev => [...prev, { text: `❌ Item ${it.item}: preço não encontrado` }]);
          setItens(prev => prev.map((item, i) => i === idx ? { ...item, cotacaoFalhou: true } : item));
          continue;
        }

        // Filtra por faixa de preço aceitável: entre 20% e 100% do referencial
        const precoRef = it.valorUnitarioRef || 0;
        const allResults = (data.resultados || []).filter((r: any) => r.preco_unitario > 0);
        const results = precoRef > 0
          ? allResults.filter((r: any) => r.preco_unitario >= precoRef * 0.20 && r.preco_unitario <= precoRef)
          : allResults;

        if (results.length === 0) {
          const msg = precoRef > 0 && allResults.length > 0
            ? `❌ Item ${it.item}: menor preço encontrado (${formatCurrency(allResults[0]?.preco_unitario)}) acima do referencial — sem margem`
            : `❌ Item ${it.item}: preço não encontrado`;
          setCotacaoMsgs(prev => [...prev, { text: msg }]);
          setItens(prev => prev.map((item, i) => i === idx ? { ...item, cotacaoFalhou: true } : item));
          continue;
        }

        // Recalcula bestPrice usando apenas resultados dentro da faixa
        const precosValidos = results.map((r: any) => r.preco_unitario).sort((a: number, b: number) => a - b);
        const validBestPrice = precosValidos[Math.floor(precosValidos.length / 2)] ?? bestPrice;

        const closest = results
          .sort((a: any, b: any) => Math.abs(a.preco_unitario - validBestPrice) - Math.abs(b.preco_unitario - validBestPrice))[0];

        const marca = closest?.ean?.replace('Marca: ', '') || closest?.vendedor || '';
        const valorTotal = Math.round(validBestPrice * it.quantidade * 100) / 100;

        // Deduplica por vendedor/fonte e limita a 3
        const seenFonte = new Set<string>();
        const topFontes = results
          .filter((r: any) => {
            const key = r.vendedor || r.fonte;
            if (seenFonte.has(key)) return false;
            seenFonte.add(key);
            return true;
          })
          .slice(0, 3)
          .map((r: any) => ({
            fonte: r.fonte || 'marketplace',
            vendedor: r.vendedor || undefined,
            titulo: (r.titulo || '').slice(0, 120),
            url: r.url || '',
            preco: r.preco_unitario,
            nota: r.nota ?? undefined,
            total_avaliacoes: r.total_avaliacoes ?? undefined,
          }));

        setItens(prev => prev.map((item, i) => i === idx ? {
          ...item,
          valorUnitario: Math.round(validBestPrice * 100) / 100,
          valorTotal,
          marca: item.marca || marca,
          fontes: topFontes.length > 0 ? topFontes : undefined,
        } : item));

        // Calc diff vs reference
        let diffMsg = '';
        if (it.valorUnitarioRef && it.valorUnitarioRef > 0) {
          const diff = ((validBestPrice - it.valorUnitarioRef) / it.valorUnitarioRef) * 100;
          const sinal = diff > 0 ? '+' : '';
          diffMsg = ` | ${sinal}${diff.toFixed(1)}% vs referência`;
        }

        setCotacaoMsgs(prev => [...prev, {
          text: `✅ Item ${it.item}: ${formatCurrency(validBestPrice)} (${stats.total_registros} fontes)${diffMsg}`,
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
        <div className="space-y-3">
          {licitacaoId && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-accent/20 bg-accent/5 px-3 py-2">
              <div>
                <p className="text-xs font-medium text-foreground">Processo vinculado pronto para uso</p>
                <p className="text-[10px] text-muted-foreground">
                  Use o edital já associado ao processo para extrair itens sem novo upload.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
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
                    <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Carregando...</>
                  ) : (
                    <><Link2 className="w-3.5 h-3.5 mr-1" /> Usar processo vinculado</>
                  )}
                </Button>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center gap-2 hover:border-accent/50 hover:bg-muted/30 transition-colors"
          >
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
              <Upload className="w-6 h-6 text-accent" />
            </div>
            <span className="text-sm font-semibold text-foreground">
              Envie o Edital, Termo de Referência ou Anexo
            </span>
            <span className="text-xs text-muted-foreground">
              A IA extrairá itens com descrição, quantidade, unidade e valores de referência
            </span>
            <span className="text-[10px] text-muted-foreground/70">
              PDF, Word, Excel, Imagens (JPG/PNG), TXT — Máx. 20MB
            </span>
          </button>
        </div>
      ) : (
        <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-accent shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(0)} KB
                {itens.length > 0 && (
                  <span className="text-accent ml-2">✓ {itens.length} itens extraídos</span>
                )}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              {itens.length === 0 && (
                <Button onClick={handleExtract} disabled={isExtracting} size="sm">
                  {isExtracting ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Extraindo...</>
                  ) : (
                    <><Sparkles className="w-4 h-4 mr-1" /> Extrair Itens</>
                  )}
                </Button>
              )}
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleRemoveFile}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Planilha de Custos Table */}
      {itens.length > 0 && (
        <>
          {/* Actions bar */}
          <div className="flex items-center justify-between flex-wrap gap-2 bg-card border border-border/40 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-accent" />
              <span className="text-sm font-semibold">{itens.length} itens</span>
            {sourceLabel && (
              <Badge variant="outline" className="text-[10px]">
                {sourceLabel}
              </Badge>
            )}
              {totalRef > 0 && (
                <Badge variant="outline" className="text-[10px]">
                  Ref: {formatCurrency(totalRef)}
                </Badge>
              )}
              {totalGeral > 0 && (
                <Badge
                  className={`text-[10px] border-0 flex items-center gap-0.5 ${
                    totalRef > 0 && totalGeral > totalRef
                      ? 'bg-destructive/20 text-destructive'
                      : 'bg-success/20 text-success'
                  }`}
                >
                  {totalRef > 0 && totalGeral > totalRef && <AlertTriangle className="w-3 h-3" />}
                  Total: {formatCurrency(totalGeral)}
                  {totalRef > 0 && totalGeral > totalRef && <span>↑ acima do contrato</span>}
                </Badge>
              )}
            {lastSaved && (
              <span className="inline-flex items-center gap-1 text-[10px] text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                {saving ? 'Salvando...' : `Salvo ${lastSaved.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
              </span>
            )}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant="default"
                onClick={handleCotarTodos}
                disabled={isCotando}
                className="bg-primary hover:bg-primary/90"
              >
                {isCotando ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Cotando...</>
                ) : (
                  <><ShoppingCart className="w-3.5 h-3.5 mr-1" /> Cotar Todos</>
                )}
              </Button>
              <Button variant="outline" size="sm" onClick={addEmptyItem}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar Item
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportExcel}>
                <Download className="w-3.5 h-3.5 mr-1" /> Exportar Excel
              </Button>
              <Button
                size="sm"
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
                onClick={handleAddAllToProposta}
              >
                <Package className="w-3.5 h-3.5 mr-1" /> Enviar à Proposta
              </Button>
            </div>
          </div>

          {/* Cotação progress */}
          {isCotando && (
            <div className="space-y-2">
              <Progress value={cotacaoProgress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                Cotando itens... {cotacaoProgress}%
              </p>
            </div>
          )}

          {/* Cotação messages */}
          {cotacaoMsgs.length > 0 && (
            <div className="bg-muted/20 border border-border/30 rounded-lg p-3 max-h-40 overflow-y-auto space-y-0.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-foreground">Resultado da Cotação</span>
                <Button variant="ghost" size="sm" className="h-5 px-2 text-[10px]" onClick={() => setCotacaoMsgs([])}>
                  Limpar
                </Button>
              </div>
              {cotacaoMsgs.map((msg, i) => (
                <div key={i} className="space-y-0.5">
                  <p className="text-[11px] text-muted-foreground">{msg.text}</p>
                  {msg.fontes && msg.fontes.length > 0 && (
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 pl-3">
                      {msg.fontes.map((f, fi) => (
                        f.url ? (
                          <a
                            key={fi}
                            href={f.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-primary/70 hover:text-primary flex items-center gap-0.5 underline-offset-2 hover:underline"
                            title={f.titulo}
                          >
                            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                            {FONTE_LABELS[f.fonte] ?? f.fonte} — {formatCurrency(f.preco)}
                          </a>
                        ) : (
                          <span
                            key={fi}
                            className="text-[10px] text-muted-foreground flex items-center gap-0.5"
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

          {/* Table */}
          <div className="border border-border/40 rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border/40">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground w-12 whitespace-nowrap">Item</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground min-w-[200px]">Descrição</th>
                  <th className="text-center px-3 py-2 text-xs font-semibold text-muted-foreground w-16">Qtd</th>
                  <th className="text-center px-3 py-2 text-xs font-semibold text-muted-foreground w-20">Unidade</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground w-28">
                    <span className="text-accent">Vlr Unit Ref</span>
                  </th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground w-28">
                    <span className="text-accent">Vlr Total Ref</span>
                  </th>
                  <th className="text-center px-3 py-2 text-xs font-semibold text-muted-foreground w-28">Marca</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-primary w-28">Vlr Unitário</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-primary w-28">Vlr Total</th>
                  <th className="px-3 py-2 text-xs font-semibold text-muted-foreground min-w-[110px]">Fonte</th>
                  <th className="px-3 py-2 text-xs font-semibold text-muted-foreground min-w-[140px]">Avaliação</th>
                  <th className="text-center px-3 py-2 text-xs font-semibold text-muted-foreground w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {itens.map((it, idx) => (
                  <tr
                    key={idx}
                    className="hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-3 py-2 text-center font-medium text-muted-foreground">{it.item}</td>
                    <td className="px-3 py-2">
                      {editingIdx === idx ? (
                        <Input
                          value={it.descricao}
                          onChange={(e) => updateItem(idx, 'descricao', e.target.value)}
                          className="h-7 text-xs"
                        />
                      ) : (
                        <span
                          className="text-xs cursor-pointer hover:text-primary line-clamp-2"
                          onClick={() => setEditingIdx(idx)}
                          title={it.descricao}
                        >
                          {it.descricao}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Input
                        type="number"
                        value={it.quantidade}
                        onChange={(e) => updateItem(idx, 'quantidade', Number(e.target.value) || 1)}
                        className="h-7 text-xs text-center w-16 mx-auto"
                        min={1}
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Input
                        value={it.unidade}
                        onChange={(e) => updateItem(idx, 'unidade', e.target.value)}
                        className="h-7 text-xs text-center w-20 mx-auto"
                      />
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-accent">
                      {it.valorUnitarioRef != null ? formatCurrency(it.valorUnitarioRef) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-accent">
                      {it.valorTotalRef != null ? formatCurrency(it.valorTotalRef) : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col items-center gap-0.5">
                        <Input
                          value={it.marca}
                          onChange={(e) => updateItem(idx, 'marca', e.target.value)}
                          className="h-7 text-xs text-center w-24 mx-auto"
                          placeholder="Digitar..."
                        />
                        {!it.marca && (
                          <span className="text-[9px] text-amber-500/80 italic whitespace-nowrap">
                            Edital não informa
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <MoneyInput
                        value={it.valorUnitario ?? 0}
                        onValueChange={(v) => updateItem(idx, 'valorUnitario', v || null)}
                        className="h-7 text-xs w-28 ml-auto bg-primary/5 border-primary/20 font-medium"
                      />
                    </td>
                    <td className="px-3 py-2 text-right text-xs font-semibold">
                      {it.valorTotal != null && it.valorTotal > 0 ? (
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-primary">{formatCurrency(it.valorTotal)}</span>
                          {it.valorUnitarioRef != null && it.valorUnitarioRef > 0 && it.valorUnitario != null && it.valorUnitario > 0 && (() => {
                            const diff = ((it.valorUnitario - it.valorUnitarioRef) / it.valorUnitarioRef) * 100;
                            const isLower = diff < -1;
                            const isHigher = diff > 1;
                            return (
                              <span className={`text-[10px] flex items-center gap-0.5 ${isLower ? 'text-green-600' : isHigher ? 'text-red-500' : 'text-muted-foreground'}`}>
                                {isLower ? <TrendingDown className="w-3 h-3" /> : isHigher ? <TrendingUp className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                                {diff > 0 ? '+' : ''}{diff.toFixed(1)}%
                              </span>
                            );
                          })()}
                        </div>
                      ) : it.cotacaoFalhou ? (
                        <div
                          title="Não foi possível encontrar preço em fontes verificáveis. Para itens controlados, consulte CMED/ANVISA manualmente."
                          className="text-[10px] text-amber-500/80 flex items-center gap-0.5 justify-end cursor-help"
                        >
                          <AlertCircle className="w-3 h-3" />
                          Não encontrado
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2 min-w-[110px] text-center">
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
                                  className="block text-[11px] font-medium text-primary hover:text-primary/80 hover:underline"
                                >
                                  {f.vendedor || FONTE_LABELS[f.fonte] || f.fonte}
                                </a>
                              ) : (
                                <span className="block text-[11px] font-medium text-muted-foreground">
                                  {f.vendedor || FONTE_LABELS[f.fonte] || f.fonte}
                                </span>
                              )}
                              {f.nota != null && (
                                <div className="flex items-center justify-center gap-0.5">
                                  <span className="text-[10px] text-amber-400">{'★'.repeat(Math.round(f.nota))}{'☆'.repeat(5 - Math.round(f.nota))}</span>
                                  <span className="text-[9px] text-muted-foreground">{f.nota.toFixed(1)}{f.total_avaliacoes ? ` (${f.total_avaliacoes})` : ''}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 min-w-[160px] max-w-[220px]">
                      {it.avaliacao ? (() => {
                        const av = it.avaliacao!;
                        const scoreColorCls = av.score >= 80
                          ? 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950'
                          : av.score >= 60
                          ? 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950'
                          : av.score >= 40
                          ? 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950'
                          : 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950';
                        return (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Badge className={`text-xs cursor-pointer ${scoreColorCls}`}>
                                {av.score}% confiança
                              </Badge>
                            </PopoverTrigger>
                            <PopoverContent side="left" className="w-72 text-sm leading-relaxed">
                              {av.justificativa}
                            </PopoverContent>
                          </Popover>
                        );
                      })() : <span className="text-xs text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => removeItem(idx)}
                      >
                        <Trash2 className="w-3 h-3 text-destructive/60" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Footer totals */}
              <tfoot>
                <tr className="bg-muted/30 border-t-2 border-border/60 font-semibold">
                  <td colSpan={4} className="px-3 py-2 text-right text-xs text-muted-foreground">
                    TOTAL GERAL →
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-accent">
                    {/* empty */}
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-accent font-bold">
                    {totalRef > 0 ? formatCurrency(totalRef) : '—'}
                  </td>
                  <td className="px-3 py-2">{/* marca col */}</td>
                  <td className="px-3 py-2">{/* unit price col */}</td>
                  <td className={`px-3 py-2 text-right text-sm font-bold ${totalRef > 0 && totalGeral > totalRef ? 'text-destructive' : 'text-primary'}`}>
                    {totalGeral > 0 ? (
                      <div className="flex flex-col items-end leading-tight">
                        <span>{formatCurrency(totalGeral)}</span>
                        {totalRef > 0 && totalGeral > totalRef && (
                          <span className="text-[9px] font-normal text-destructive/80">acima do contrato</span>
                        )}
                      </div>
                    ) : '—'}
                  </td>
                  <td></td>{/* link col */}
                  <td></td>{/* avaliacao col */}
                  <td></td>
                </tr>
              </tfoot>
            </table>
           </div>

          {/* Sources / References Table */}
          {itens.some(it => it.fontes && it.fontes.length > 0) && (
            <div className="border border-border/40 rounded-lg overflow-hidden">
              <div className="bg-muted/40 px-3 py-2 border-b border-border/40 flex items-center gap-2">
                <Link2 className="w-4 h-4 text-accent" />
                <span className="text-xs font-semibold text-foreground">Fontes de Referência — Links das Cotações</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/20 border-b border-border/30">
                      <th className="text-left px-3 py-1.5 font-semibold text-muted-foreground w-12 whitespace-nowrap">Item</th>
                      <th className="text-left px-3 py-1.5 font-semibold text-muted-foreground">Fonte</th>
                      <th className="text-left px-3 py-1.5 font-semibold text-muted-foreground min-w-[200px]">Produto</th>
                      <th className="text-right px-3 py-1.5 font-semibold text-muted-foreground w-24">Preço</th>
                      <th className="text-center px-3 py-1.5 font-semibold text-muted-foreground w-24">Avaliação</th>
                      <th className="text-center px-3 py-1.5 font-semibold text-muted-foreground w-16">Link</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {itens.filter(it => it.fontes && it.fontes.length > 0).flatMap(it =>
                      (it.fontes || []).map((f, fi) => (
                        <tr key={`${it.item}-${fi}`} className="hover:bg-muted/10">
                          <td className="px-3 py-1.5 text-center font-medium text-muted-foreground">{fi === 0 ? it.item : ''}</td>
                          <td className="px-3 py-1.5">
                            <Badge variant="outline" className="text-[9px] py-0">
                              {f.vendedor || FONTE_LABELS[f.fonte] || f.fonte}
                            </Badge>
                          </td>
                          <td className="px-3 py-1.5 text-muted-foreground truncate max-w-[300px]" title={f.titulo}>
                            {f.titulo}
                          </td>
                          <td className="px-3 py-1.5 text-right font-medium">{formatCurrency(f.preco)}</td>
                          <td className="px-3 py-1.5 text-center">
                            {fi === 0 && it.avaliacao ? (() => {
                              const av = it.avaliacao!;
                              const scoreColorCls = av.score >= 80
                                ? 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950'
                                : av.score >= 60
                                ? 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950'
                                : av.score >= 40
                                ? 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950'
                                : 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950';
                              return (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Badge className={`text-[9px] py-0 cursor-pointer ${scoreColorCls}`}>
                                      {av.score}%
                                    </Badge>
                                  </PopoverTrigger>
                                  <PopoverContent side="left" className="w-72 text-sm leading-relaxed">
                                    {av.justificativa}
                                  </PopoverContent>
                                </Popover>
                              );
                            })() : <span className="text-muted-foreground/40">—</span>}
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            {f.url ? (
                              <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 inline-flex">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            ) : (
                              <span className="text-muted-foreground/40">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-muted/20 border border-border/30 rounded-lg p-3 text-[11px] text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground text-xs mb-1">📋 Instruções</p>
            <p>• Use <strong className="text-primary">"Cotar Todos"</strong> para o sistema buscar preços automaticamente no Google Shopping, Mercado Livre e demais plataformas.</p>
            <p>• A cotação preenche <strong>Marca</strong>, <strong>Valor Unitário</strong> e <strong>Valor Total</strong> automaticamente, exibindo a <strong>% de diferença</strong> vs referência.</p>
            <p>• Os valores de referência do edital (quando disponíveis) são exibidos em <strong className="text-accent">laranja</strong>.</p>
            <p>• A tabela <strong>"Fontes de Referência"</strong> exibe os links de onde cada preço e marca foram extraídos.</p>
            <p>• Use <strong>"Exportar Excel"</strong> para baixar a planilha e <strong>"Enviar à Proposta"</strong> para transferir os itens.</p>
          </div>
        </>
      )}

      {/* Empty state */}
      {!file && itens.length === 0 && (
        <div className="text-center py-6 text-muted-foreground">
          <FileSpreadsheet className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-xs">Envie um documento e a IA gerará automaticamente a planilha de custos com todos os itens estruturados</p>
        </div>
      )}
    </div>
  );
}
