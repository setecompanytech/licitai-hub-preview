import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Bot, Trash2, Package, Layers, FileSearch, Loader2, Search, CheckCircle2, Building2, ArrowRight, Pencil, Calculator, Upload, FileText, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useEditalExtraction, type LicitacaoItem } from '@/hooks/useEditalExtraction';
import { useLinkedEditalSource } from '@/hooks/useLinkedEditalSource';

const portaisDisponiveis = [
  { id: 'pncp', nome: 'PNCP' },
  { id: 'compras-gov', nome: 'Compras Governamentais' },
  { id: 'bll', nome: 'BLL Compras' },
  { id: 'licitanet', nome: 'Licitanet' },
  { id: 'licitacoes-e', nome: 'Licitações-e (BB)' },
  { id: 'portal-compras', nome: 'Portal de Compras Públicas' },
  { id: 'bnc', nome: 'Bolsa Nacional de Compras' },
  { id: 'banparanet', nome: 'Banparanet (PA)' },
  { id: 'bec-sp', nome: 'BEC/SP' },
  { id: 'compras-rj', nome: 'Compras Públicas RJ' },
];

export type DisputeItem = {
  id: string;
  numero: number;
  descricao: string;
  quantidade: number;
  unidade: string;
  valorReferencia: number;
  valorMinimo: number;
  lote: string;
  disputando: boolean;
  situacao: 'aguardando' | 'disputando' | 'encerrado';
  melhorLance: number | null;
  seuUltimoLance: number | null;
};

export type LanceConfig = {
  id: string;
  edital: string;
  portal: string;
  valorReferencia: number;
  valorInicial: number;
  valorMinimo: number;
  decrementoMin: number;
  decrementoPercentual: number;
  intervaloSegundos: number;
  maxLances: number;
  modoAutomatico: boolean;
  status: 'aguardando' | 'ativo' | 'vencendo' | 'perdendo' | 'encerrado';
  horario: string;
  meuLance: number;
  valorAtual: number;
  itens: DisputeItem[];
  tipoDisputa: 'item' | 'lote';
  licitacaoId?: string;
};

type LicitacaoRow = {
  id: string;
  numero: string;
  orgao: string;
  objeto: string;
  modalidade: string;
  status: string;
  valor_estimado: number | null;
  portal: string | null;
  data_encerramento: string | null;
};

// Helper: convert LicitacaoItem[] to DisputeItem[]
function licitacaoItensToDispute(items: LicitacaoItem[]): DisputeItem[] {
  return items.map((item, idx) => ({
    id: crypto.randomUUID(),
    numero: item.numero || idx + 1,
    descricao: item.descricao,
    quantidade: item.quantidade || 1,
    unidade: item.unidade || 'UN',
    valorReferencia: item.valor_unitario || 0,
    valorMinimo: 0,
    lote: item.lote || 'Único',
    disputando: true,
    situacao: 'aguardando' as const,
    melhorLance: null,
    seuUltimoLance: null,
  }));
}

type Props = {
  onSave: (lance: LanceConfig) => void;
  editingLance?: LanceConfig | null;
  trigger?: React.ReactNode;
};

export default function ConfigurarLanceDialog({ onSave, editingLance, trigger }: Props) {
  const { user } = useAuth();
  const { fetchItens, extrairItensDoTexto, extrairItensIA } = useEditalExtraction();
  const { resolveLinkedEditalText } = useLinkedEditalSource();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<0 | 1 | 2>(editingLance ? 1 : 0);

  // Step 0 – Import
  const [licitacoes, setLicitacoes] = useState<LicitacaoRow[]>([]);
  const [loadingLicitacoes, setLoadingLicitacoes] = useState(false);
  const [searchLic, setSearchLic] = useState('');
  const [selectedLicId, setSelectedLicId] = useState<string | null>(null);
  const [loadingItems, setLoadingItems] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('todos');

  // Step 0 – AI Extraction
  const [editalFile, setEditalFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [showEditalUpload, setShowEditalUpload] = useState(false);
  const [autoExtractTriggered, setAutoExtractTriggered] = useState(false);
  const editalFileRef = useRef<HTMLInputElement>(null);

  // Step 1 fields
  const [edital, setEdital] = useState(editingLance?.edital || '');
  const [portal, setPortal] = useState(editingLance?.portal || '');
  const [decrementoMin, setDecrementoMin] = useState(editingLance?.decrementoMin?.toString() || '');
  const [decrementoPercentual, setDecrementoPercentual] = useState(editingLance?.decrementoPercentual?.toString() || '1.5');
  const [intervaloSegundos, setIntervaloSegundos] = useState(editingLance?.intervaloSegundos?.toString() || '30');
  const [maxLances, setMaxLances] = useState(editingLance?.maxLances?.toString() || '20');
  const [modoAutomatico, setModoAutomatico] = useState(editingLance?.modoAutomatico ?? true);
  const [horario, setHorario] = useState(editingLance?.horario || '');

  // Step 2 fields
  const [tipoDisputa, setTipoDisputa] = useState<'item' | 'lote'>(editingLance?.tipoDisputa || 'item');
  const [itens, setItens] = useState<DisputeItem[]>(editingLance?.itens || []);
  const [licitacaoIdRef, setLicitacaoIdRef] = useState<string | undefined>(editingLance?.licitacaoId);

  // Step 2 – User edits R$ values directly; % is auto-calculated
  const [valorInicialInput, setValorInicialInput] = useState(editingLance ? String(editingLance.valorInicial) : '');
  const [valorMinimoInput, setValorMinimoInput] = useState(editingLance ? String(editingLance.valorMinimo) : '');

  // New item form
  const [novoDesc, setNovoDesc] = useState('');
  const [novoQtd, setNovoQtd] = useState('1');
  const [novoUnidade, setNovoUnidade] = useState('UN');
  const [novoValorRef, setNovoValorRef] = useState('');
  const [novoLote, setNovoLote] = useState('');

  // ── Auto-calculated values from items ──
  const somaReferencia = useMemo(() => {
    return itens.reduce((sum, item) => sum + (item.valorReferencia * item.quantidade), 0);
  }, [itens]);

  const valorInicial = parseFloat(valorInicialInput) || 0;
  const valorMinimo = parseFloat(valorMinimoInput) || 0;

  const pctDescontoInicial = useMemo(() => {
    if (somaReferencia <= 0) return 0;
    return Math.round(((somaReferencia - valorInicial) / somaReferencia) * 10000) / 100;
  }, [somaReferencia, valorInicial]);

  const pctDescontoMinimo = useMemo(() => {
    if (somaReferencia <= 0) return 0;
    return Math.round(((somaReferencia - valorMinimo) / somaReferencia) * 10000) / 100;
  }, [somaReferencia, valorMinimo]);

  const inexequibilidadeInicial = pctDescontoInicial > 50;
  const inexequibilidadeMinimo = pctDescontoMinimo > 50;

  const applyImportedItems = (importedItems: DisputeItem[]) => {
    setItens(importedItems);
    const uniqueLotes = [...new Set(importedItems.map(i => i.lote))].filter(l => l && l !== 'Único');
    if (uniqueLotes.length > 1 || (uniqueLotes.length === 1 && importedItems.filter(i => i.lote === uniqueLotes[0]).length > 1)) {
      setTipoDisputa('lote');
    } else {
      setTipoDisputa('item');
    }
    if (importedItems.length > 0) {
      const total = importedItems.reduce((s, i) => s + (i.valorReferencia * i.quantidade), 0);
      setValorInicialInput(String(Math.round(total * 0.95 * 100) / 100));
      setValorMinimoInput(String(Math.round(total * 0.80 * 100) / 100));
    }
  };

  const extractFromText = useCallback(async (text: string): Promise<DisputeItem[]> => {
    try {
      const parsed = await extrairItensDoTexto(text, { skipValidation: true });
      if (parsed.length === 0) return [];

      const extractedItems: DisputeItem[] = parsed.map((p, idx) => ({
        id: crypto.randomUUID(),
        numero: parseInt(String(p.item ?? idx + 1), 10) || (idx + 1),
        descricao: p.descricao || '',
        quantidade: p.quantidade || 1,
        unidade: p.unidade || 'UN',
        valorReferencia: p.valor_unitario || 0,
        valorMinimo: 0,
        lote: p.lote || 'Único',
        disputando: true,
        situacao: 'aguardando' as const,
        melhorLance: null,
        seuUltimoLance: null,
      }));

      applyImportedItems(extractedItems);
      toast.success(`${parsed.length} itens extraídos via IA!`);
      return extractedItems;
    } catch (error) {
      console.error('Erro ao processar itens do edital:', error);
      toast.error('Erro ao processar itens do edital.');
      return [];
    }
  }, [extrairItensDoTexto]);

  // Busca itens de fontes alternativas (Precificação e Proposta) quando
  // a tabela centralizada `licitacao_itens` está vazia. Os itens encontrados
  // são persistidos em `licitacao_itens` para reuso em todos os módulos.
  const fetchItensDeFontesAlternativas = useCallback(async (licId: string): Promise<DisputeItem[]> => {
    if (!user) return [];
    try {
      // 1) Catálogo de Precificação
      const { data: precificados } = await supabase
        .from('catalogo_itens_precificados')
        .select('descricao, quantidade, unidade, preco_unitario, marca, fabricante, modelo')
        .eq('licitacao_id', licId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      // 2) Composições de Custo da Proposta Comercial
      const { data: composicoes } = await supabase
        .from('composicoes_custo')
        .select('descricao_item, dados_json')
        .eq('licitacao_id', licId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      const fontes: Array<{ descricao: string; quantidade: number; unidade: string; valor: number; lote: string; origem: 'precificacao' | 'proposta' }> = [];

      (precificados || []).forEach((p: any) => {
        if (p.descricao) fontes.push({
          descricao: p.descricao,
          quantidade: Number(p.quantidade) || 1,
          unidade: p.unidade || 'UN',
          valor: Number(p.preco_unitario) || 0,
          lote: 'Único',
          origem: 'precificacao',
        });
      });

      (composicoes || []).forEach((c: any) => {
        const dados = c.dados_json || {};
        if (c.descricao_item) fontes.push({
          descricao: c.descricao_item,
          quantidade: Number(dados.quantidade) || 1,
          unidade: dados.unidade || 'UN',
          valor: Number(dados.preco_venda || dados.valor_unitario) || 0,
          lote: dados.lote || 'Único',
          origem: 'proposta',
        });
      });

      if (fontes.length === 0) return [];

      // Deduplica por descrição (case-insensitive)
      const seen = new Set<string>();
      const unique = fontes.filter(f => {
        const k = f.descricao.toLowerCase().trim();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });

      // Persiste na fonte central para reuso futuro
      try {
        await supabase.from('licitacao_itens').insert(
          unique.map((f, idx) => ({
            licitacao_id: licId,
            user_id: user.id,
            numero: idx + 1,
            descricao: f.descricao,
            quantidade: f.quantidade,
            unidade: f.unidade,
            valor_unitario: f.valor,
            valor_total: f.valor * f.quantidade,
            lote: f.lote,
            origem: 'importado',
          }))
        );
      } catch (e) {
        console.warn('Não foi possível persistir em licitacao_itens:', e);
      }

      return unique.map((f, idx) => ({
        id: crypto.randomUUID(),
        numero: idx + 1,
        descricao: f.descricao,
        quantidade: f.quantidade,
        unidade: f.unidade,
        valorReferencia: f.valor,
        valorMinimo: 0,
        lote: f.lote,
        disputando: true,
        situacao: 'aguardando' as const,
        melhorLance: null,
        seuUltimoLance: null,
      }));
    } catch (e) {
      console.error('Erro ao buscar itens de fontes alternativas:', e);
      return [];
    }
  }, [user]);

  const fetchLicitacoes = useCallback(async () => {
    if (!user) return;
    setLoadingLicitacoes(true);
    try {
      const { data, error } = await supabase
        .from('licitacoes')
        .select('id, numero, orgao, objeto, modalidade, status, valor_estimado, portal, data_encerramento')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setLicitacoes((data as LicitacaoRow[]) || []);
    } catch {
      toast.error('Erro ao carregar processos.');
    } finally {
      setLoadingLicitacoes(false);
    }
  }, [user]);

  useEffect(() => {
    if (open && step === 0) {
      fetchLicitacoes();
    }
  }, [open, step, fetchLicitacoes]);

  const handleAutoExtractItems = useCallback(async () => {
    if (isExtracting) return;
    setIsExtracting(true);

    try {
      if (licitacaoIdRef) {
        const centralItens = await fetchItens(licitacaoIdRef);
        if (centralItens.length > 0) {
          const importedItems = licitacaoItensToDispute(centralItens);
          applyImportedItems(importedItems);
          toast.success(`${importedItems.length} itens carregados da fonte central!`);
          setIsExtracting(false);
          return;
        }

        // 🔄 Fallback: buscar de Precificação e Proposta Comercial
        const alternativos = await fetchItensDeFontesAlternativas(licitacaoIdRef);
        if (alternativos.length > 0) {
          applyImportedItems(alternativos);
          toast.success(`✅ ${alternativos.length} itens importados da Precificação/Proposta!`);
          setIsExtracting(false);
          return;
        }
      }

      // 🔁 Camada autoritativa: edital vinculado pelo Monitoramento (PNCP cache + documentos + download direto)
      let textoParaAnalise = '';
      let fonteTexto = '';
      if (licitacaoIdRef) {
        try {
          const linked = await resolveLinkedEditalText(licitacaoIdRef);
          if (linked.text && linked.text.length >= 200) {
            textoParaAnalise = linked.text;
            fonteTexto = linked.source;
            toast.info(`📄 Edital localizado via ${linked.source.replace(/_/g, ' ')} (Monitoramento).`);
          }
        } catch (e) {
          console.warn('Falha ao resolver edital vinculado:', e);
        }
      }

      if (!textoParaAnalise && editalFile) {
        const { extractTextFromFile } = await import('@/lib/pdf-text-extractor');
        textoParaAnalise = await extractTextFromFile(editalFile, 150, true);
        fonteTexto = 'upload_manual';
      }

      // ⚠️ Anti-alucinação: NÃO usar objeto/observações curtos como base.
      // Texto curto (<500 chars) faz a IA inventar produtos que não existem no edital.
      if (!textoParaAnalise || textoParaAnalise.length < 500) {
        toast.warning('⚠️ Não há texto suficiente do edital para extração segura. Envie o PDF/DOC do edital ou Termo de Referência no Passo 3 — o objeto resumido não basta e gera itens inventados.');
        setIsExtracting(false);
        return;
      }

      if (licitacaoIdRef) {
        const saved = await extrairItensIA(licitacaoIdRef, textoParaAnalise, { forceReExtract: true, skipValidation: false });
        const disputeItems = licitacaoItensToDispute(saved);
        applyImportedItems(disputeItems);
        if (disputeItems.length > 0) {
          toast.success(`${disputeItems.length} itens extraídos automaticamente via IA!`);
        } else {
          toast.info('Nenhum item identificado com segurança. Cadastre manualmente ou envie o edital completo.');
        }
      } else {
        await extractFromText(textoParaAnalise);
      }
    } catch (err) {
      console.error('Auto-extract error:', err);
      toast.error('Erro na extração automática. Cadastre os itens manualmente.');
    } finally {
      setIsExtracting(false);
    }
  }, [isExtracting, licitacaoIdRef, fetchItens, fetchItensDeFontesAlternativas, editalFile, extrairItensIA, extractFromText, resolveLinkedEditalText]);

  useEffect(() => {
    if (step === 2 && itens.length === 0 && !autoExtractTriggered && (licitacaoIdRef || editalFile)) {
      setAutoExtractTriggered(true);
      handleAutoExtractItems();
    }
  }, [step, itens.length, autoExtractTriggered, licitacaoIdRef, editalFile, handleAutoExtractItems]);

  const handleImportLicitacao = async (lic: LicitacaoRow) => {
    setSelectedLicId(lic.id);
    setLoadingItems(true);

    setEdital(lic.numero);
    setPortal(lic.portal || '');
    setLicitacaoIdRef(lic.id);

    if (lic.data_encerramento) {
      try {
        const d = new Date(lic.data_encerramento);
        setHorario(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
      } catch {
      }
    }

    try {
      // 1) Tenta carregar itens já centralizados (compartilhados com Proposta/Precificação)
      const centralItens = await fetchItens(lic.id);
      let importedItems = licitacaoItensToDispute(centralItens);

      // 2) Fallback: importa de Precificação (catálogo) e Proposta Comercial (composições)
      if (importedItems.length === 0) {
        const alternativos = await fetchItensDeFontesAlternativas(lic.id);
        if (alternativos.length > 0) {
          importedItems = alternativos;
          toast.info(`📦 ${alternativos.length} itens importados da Precificação/Proposta Comercial.`);
        }
      }

      // 3) Penúltimo recurso: edital vinculado pelo Monitoramento (PNCP cache + documentos + download)
      if (importedItems.length === 0) {
        try {
          const linked = await resolveLinkedEditalText(lic.id);
          if (linked.text && linked.text.length >= 200) {
            toast.info(`📄 Edital localizado via ${linked.source.replace(/_/g, ' ')}. Extraindo itens via IA...`);
            const saved = await extrairItensIA(lic.id, linked.text, { skipValidation: true, forceReExtract: true });
            importedItems = licitacaoItensToDispute(saved);
          }
        } catch (e) {
          console.warn('Falha ao buscar edital vinculado:', e);
        }
      }

      // ⚠️ Removido: extração a partir de objeto/observações.
      // Texto curto provoca alucinação grave (ex: IA inventa "impressora" em edital de limpeza).
      // O usuário deve enviar o PDF do edital no Passo 3 quando não houver itens centralizados.
      if (importedItems.length === 0) {
        toast.warning('⚠️ Nenhum item localizado nas fontes confiáveis. Envie o PDF do edital no Passo 3 para extração segura.');
      }

      applyImportedItems(importedItems);

      const itemCount = importedItems.length;
      if (itemCount > 0) {
        toast.success(
          `✅ Processo importado com ${itemCount} ${itemCount === 1 ? 'item' : 'itens'}! Os mesmos itens estarão disponíveis na Proposta e na Precificação.`
        );
      } else {
        toast.info('✅ Dados do processo importados. Envie o edital (PDF/DOC) no Passo 3 para extrair os itens automaticamente via IA.');
      }
    } catch {
      toast.error('Erro ao importar itens do processo.');
    } finally {
      setLoadingItems(false);
      setStep(1);
    }
  };

  const handleEditalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 15 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 15MB.');
      return;
    }
    setEditalFile(f);
  };

  const handleExtractFromEdital = async () => {
    if (!editalFile) return;
    setIsExtracting(true);

    try {
      const { extractTextFromFile } = await import('@/lib/pdf-text-extractor');
      const text = await extractTextFromFile(editalFile, 150, true);

      if (licitacaoIdRef) {
        const saved = await extrairItensIA(licitacaoIdRef, text, { forceReExtract: true, skipValidation: true });
        const disputeItems = licitacaoItensToDispute(saved);
        applyImportedItems(disputeItems);
        if (disputeItems.length > 0) setStep(1);
      } else {
        const extractedItems = await extractFromText(text);
        if (extractedItems.length > 0) setStep(1);
      }
    } catch {
      toast.error('Erro ao ler o arquivo.');
    } finally {
      setIsExtracting(false);
    }
  };

  const resetForm = () => {
    setEdital(''); setPortal('');
    setDecrementoMin(''); setDecrementoPercentual('1.5');
    setIntervaloSegundos('30'); setMaxLances('20'); setModoAutomatico(true); setHorario('');
    setItens([]); setTipoDisputa('item'); setStep(editingLance ? 1 : 0);
    setSelectedLicId(null); setSearchLic(''); setStatusFilter('todos'); setLicitacaoIdRef(undefined);
    setValorInicialInput(''); setValorMinimoInput('');
    setEditalFile(null); setShowEditalUpload(false); setAutoExtractTriggered(false);
    resetItemForm();
  };

  const resetItemForm = () => {
    setNovoDesc(''); setNovoQtd('1'); setNovoUnidade('UN');
    setNovoValorRef(''); setNovoLote('');
  };

  const handleAddItem = () => {
    if (!novoDesc.trim()) return;
    const nextNum = itens.length > 0 ? Math.max(...itens.map(i => i.numero)) + 1 : 1;
    const newItem: DisputeItem = {
      id: crypto.randomUUID(),
      numero: nextNum,
      descricao: novoDesc.trim(),
      quantidade: parseInt(novoQtd) || 1,
      unidade: novoUnidade || 'UN',
      valorReferencia: parseFloat(novoValorRef) || 0,
      valorMinimo: 0,
      lote: novoLote.trim() || `Lote ${Math.ceil(nextNum / 5)}`,
      disputando: true,
      situacao: 'aguardando',
      melhorLance: null,
      seuUltimoLance: null,
    };
    setItens(prev => [...prev, newItem]);
    resetItemForm();
  };

  const handleRemoveItem = (id: string) => {
    setItens(prev => prev.filter(i => i.id !== id).map((item, idx) => ({ ...item, numero: idx + 1 })));
  };

  const handleSave = () => {
    const lance: LanceConfig = {
      id: editingLance?.id || crypto.randomUUID(),
      edital, portal,
      valorReferencia: somaReferencia,
      valorInicial,
      valorMinimo,
      decrementoMin: parseFloat(decrementoMin) || 0,
      decrementoPercentual: parseFloat(decrementoPercentual) || 1.5,
      intervaloSegundos: parseInt(intervaloSegundos) || 30,
      maxLances: parseInt(maxLances) || 20,
      modoAutomatico, status: 'aguardando', horario,
      meuLance: editingLance?.meuLance || 0,
      valorAtual: somaReferencia,
      itens, tipoDisputa,
      licitacaoId: licitacaoIdRef,
    };
    onSave(lance);
    resetForm();
    setOpen(false);
  };

  const step1Valid = edital && portal;

  const formatCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const lotes = [...new Set(itens.map(i => i.lote))].filter(Boolean);

  const handleRemoveLote = (lote: string) => {
    setItens(prev => prev.filter(i => i.lote !== lote).map((item, idx) => ({ ...item, numero: idx + 1 })));
    toast.info(`Lote "${lote}" removido com todos os seus itens.`);
  };

  // Filter licitações
  const statusOptions = ['todos', ...new Set(licitacoes.map(l => l.status))];
  const filteredLicitacoes = licitacoes.filter(l => {
    const matchSearch = !searchLic ||
      l.numero.toLowerCase().includes(searchLic.toLowerCase()) ||
      l.orgao.toLowerCase().includes(searchLic.toLowerCase()) ||
      l.objeto.toLowerCase().includes(searchLic.toLowerCase());
    const matchStatus = statusFilter === 'todos' || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      'Monitorando': 'bg-info/10 text-info border-info/30',
      'Analisando': 'bg-warning/10 text-warning border-warning/30',
      'Proposta': 'bg-accent/10 text-accent border-accent/30',
      'Em Disputa': 'bg-primary/10 text-primary border-primary/30',
      'Vencida': 'bg-success/10 text-success border-success/30',
      'Homologada': 'bg-success/10 text-success border-success/30',
    };
    return map[s] || 'bg-muted text-muted-foreground border-border';
  };

  const stepLabels = editingLance
    ? ['1. Dados da Disputa', '2. Itens / Lotes']
    : ['1. Origem', '2. Dados da Disputa', '3. Itens / Lotes'];

  const currentStepIndex = editingLance ? step - 1 : step;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">
            <Plus className="w-4 h-4 mr-1" /> Nova Sessão de Lance
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-accent" />
            {editingLance ? 'Editar Sessão de Lance' : 'Configurar Nova Sessão de Lance'}
          </DialogTitle>
          <DialogDescription>
            {step === 0 && 'Escolha como deseja cadastrar a disputa.'}
            {step === 1 && `Passo ${editingLance ? '1/2' : '2/3'} — Configure os parâmetros gerais da disputa.`}
            {step === 2 && `Passo ${editingLance ? '2/2' : '3/3'} — Cadastre os itens/lotes. Os valores da disputa são calculados automaticamente.`}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-2">
          {stepLabels.map((label, idx) => (
            <div key={label} className="flex items-center gap-2">
              {idx > 0 && <div className="w-5 h-px bg-border" />}
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                currentStepIndex === idx ? 'bg-accent text-accent-foreground' :
                currentStepIndex > idx ? 'bg-accent/20 text-accent' : 'bg-muted text-muted-foreground'
              }`}>
                {currentStepIndex > idx && <CheckCircle2 className="w-3 h-3" />}
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* ── STEP 0: Choose source ── */}
        {step === 0 && !editingLance && (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex flex-col items-center gap-3 p-4 rounded-xl border-2 border-dashed border-border hover:border-accent/50 hover:bg-muted/30 transition-all text-center group"
              >
                <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center group-hover:bg-accent/10 transition-colors">
                  <Pencil className="w-5 h-5 text-muted-foreground group-hover:text-accent" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">Cadastro Manual</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Preencha todos os dados manualmente.</p>
                </div>
              </button>
              <button
                onClick={() => { /* stay on step 0, show list below */ }}
                className="flex flex-col items-center gap-3 p-4 rounded-xl border-2 border-accent/40 bg-accent/5 hover:bg-accent/10 transition-all text-center group"
              >
                <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center">
                  <FileSearch className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">Importar do Kanban</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Importe dados + itens precificados.</p>
                </div>
              </button>
              <button
                onClick={() => setShowEditalUpload(true)}
                className="flex flex-col items-center gap-3 p-4 rounded-xl border-2 border-dashed border-primary/40 hover:border-primary/60 hover:bg-primary/5 transition-all text-center group"
              >
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">Extrair do Edital (IA)</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Envie o edital e a IA extrai itens e valores.</p>
                </div>
              </button>
            </div>

            {/* AI Edital Upload area */}
            {showEditalUpload && (
              <div className="space-y-3 border border-primary/30 rounded-xl bg-primary/5 p-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <h4 className="text-sm font-semibold text-foreground">Extração Inteligente do Edital</h4>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Envie o Edital ou Termo de Referência. A IA extrairá automaticamente: Nº do item, Descrição, Quantidade, Unidade, Valor Unitário e Valor Total de referência.
                </p>

                {!editalFile ? (
                  <button
                    type="button"
                    onClick={() => editalFileRef.current?.click()}
                    className="w-full border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center gap-2 hover:border-primary/50 hover:bg-muted/30 transition-colors"
                  >
                    <Upload className="w-6 h-6 text-primary/60" />
                    <span className="text-xs font-medium text-foreground">Clique para enviar o arquivo</span>
                    <span className="text-[10px] text-muted-foreground">PDF, DOC, DOCX, TXT — Máx. 15MB</span>
                  </button>
                ) : (
                  <div className="bg-card rounded-lg p-3 border border-border/50 flex items-center gap-3">
                    <FileText className="w-6 h-6 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{editalFile.name}</p>
                      <p className="text-[10px] text-muted-foreground">{(editalFile.size / 1024).toFixed(0)} KB</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleExtractFromEdital}
                        disabled={isExtracting}
                        size="sm"
                        className="text-xs"
                      >
                        {isExtracting ? (
                          <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> Extraindo...</>
                        ) : (
                          <><Sparkles className="w-3.5 h-3.5 mr-1" /> Extrair Itens e Valores</>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => { setEditalFile(null); if (editalFileRef.current) editalFileRef.current.value = ''; }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
                <input ref={editalFileRef} type="file" accept=".pdf,.doc,.docx,.txt" className="hidden" onChange={handleEditalFileChange} />

                {isExtracting && (
                  <div className="flex items-center gap-2 text-xs text-primary">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Analisando o documento e extraindo itens, quantidades e valores de referência...
                  </div>
                )}
              </div>
            )}

            {/* Licitações list */}
            {!showEditalUpload && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <FileSearch className="w-4 h-4 text-accent" />
                    Seus Processos Licitatórios
                  </h4>
                  <Badge variant="outline" className="text-[10px]">
                    {filteredLicitacoes.length} {filteredLicitacoes.length === 1 ? 'processo' : 'processos'}
                  </Badge>
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por número, órgão ou objeto..."
                      value={searchLic}
                      onChange={(e) => setSearchLic(e.target.value)}
                      className="h-8 pl-8 text-xs"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-8 w-40 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map(s => (
                        <SelectItem key={s} value={s} className="text-xs">
                          {s === 'todos' ? 'Todos os status' : s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {loadingLicitacoes ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-accent" />
                    <span className="text-xs text-muted-foreground ml-2">Carregando processos...</span>
                  </div>
                ) : filteredLicitacoes.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-border rounded-lg bg-muted/20">
                    <Building2 className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">
                      {licitacoes.length === 0
                        ? 'Nenhum processo na gestão. Inicie um processo pelo Monitoramento ou Kanban.'
                        : 'Nenhum processo encontrado com os filtros selecionados.'}
                    </p>
                  </div>
                ) : (
                  <div
                    className="h-72 w-full overflow-y-scroll rounded-md border border-border/40 bg-muted/10 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-muted/30"
                  >
                    <div className="space-y-1.5 p-2 pr-3">
                      {filteredLicitacoes.map((lic) => (
                        <button
                          key={lic.id}
                          onClick={() => handleImportLicitacao(lic)}
                          disabled={loadingItems && selectedLicId === lic.id}
                          className={`w-full text-left rounded-lg border p-3 transition-all hover:border-accent/50 hover:bg-accent/5 group ${
                            selectedLicId === lic.id && loadingItems
                              ? 'border-accent bg-accent/5'
                              : 'border-border'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-foreground">{lic.numero}</span>
                                <Badge variant="outline" className={`text-[9px] ${statusColor(lic.status)}`}>
                                  {lic.status}
                                </Badge>
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{lic.orgao}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{lic.objeto}</p>
                              <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                                {lic.portal && <span>{lic.portal}</span>}
                                {lic.valor_estimado && (
                                  <span className="font-mono font-medium text-foreground">
                                    {formatCurrency(lic.valor_estimado)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="shrink-0 ml-3 self-center">
                              {loadingItems && selectedLicId === lic.id ? (
                                <Loader2 className="w-4 h-4 animate-spin text-accent" />
                              ) : (
                                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-colors" />
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── STEP 1: Dispute data ── */}
        {step === 1 && (
          <div className="space-y-5 py-2">
            {(licitacaoIdRef || itens.length > 0) && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-success/10 border border-success/30 text-xs text-success">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold">
                    {licitacaoIdRef
                      ? <>Dados importados do processo <strong>{edital}</strong>{itens.length > 0 ? <> · <strong>{itens.length}</strong> {itens.length === 1 ? 'item carregado' : 'itens carregados'}</> : ''}</>
                      : <><strong>{itens.length} itens</strong> extraídos do edital por IA</>
                    }
                  </p>
                  {licitacaoIdRef && (
                    <p className="text-[10px] text-success/80 font-normal">
                      🔗 Fonte única: estes mesmos itens estão sincronizados com a <strong>Proposta Comercial</strong> e a <strong>Precificação</strong>.
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Identificação da Licitação</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Nº do Edital / Pregão *</label>
                  <Input value={edital} onChange={(e) => setEdital(e.target.value)} placeholder="PE-001/2026" className="mt-1" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Portal *</label>
                  <Select value={portal} onValueChange={setPortal}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione o portal" /></SelectTrigger>
                    <SelectContent>
                      {portaisDisponiveis.map((p) => (
                        <SelectItem key={p.id} value={p.nome}>{p.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Horário da Sessão</label>
                <Input type="time" value={horario} onChange={(e) => setHorario(e.target.value)} className="mt-1 w-40" />
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Regras de Decremento Automático</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Decremento Mínimo (R$)</label>
                  <Input type="number" step="0.01" value={decrementoMin} onChange={(e) => setDecrementoMin(e.target.value)} placeholder="Ex: 50000" className="mt-1" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Decremento Percentual (%)</label>
                  <Input type="number" step="0.1" value={decrementoPercentual} onChange={(e) => setDecrementoPercentual(e.target.value)} placeholder="1.5" className="mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Intervalo entre lances (seg)</label>
                  <Input type="number" value={intervaloSegundos} onChange={(e) => setIntervaloSegundos(e.target.value)} placeholder="30" className="mt-1" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Máx. lances por sessão</label>
                  <Input type="number" value={maxLances} onChange={(e) => setMaxLances(e.target.value)} placeholder="20" className="mt-1" />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3 border border-border/50">
              <div>
                <p className="text-sm font-medium">Modo Automático</p>
                <p className="text-xs text-muted-foreground">O robô enviará lances automaticamente respeitando os parâmetros configurados</p>
              </div>
              <Switch checked={modoAutomatico} onCheckedChange={setModoAutomatico} />
            </div>
          </div>
        )}

        {/* ── STEP 2: Items/Lots ── */}
        {step === 2 && (
          <div className="space-y-5 py-2">
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Layers className="w-4 h-4 text-accent" /> Tipo de Disputa
                {(licitacaoIdRef || editalFile) && (
                  <Badge variant="outline" className="text-[9px] bg-info/10 text-info border-info/30 ml-1">
                    Detectado automaticamente
                  </Badge>
                )}
              </h4>
              <div className="flex gap-3">
                <button
                  onClick={() => setTipoDisputa('item')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                    tipoDisputa === 'item' ? 'bg-accent text-accent-foreground border-accent' : 'bg-card text-muted-foreground border-border hover:border-accent/50'
                  }`}
                >
                  <Package className="w-4 h-4" /> Por Item
                </button>
                <button
                  onClick={() => setTipoDisputa('lote')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                    tipoDisputa === 'lote' ? 'bg-accent text-accent-foreground border-accent' : 'bg-card text-muted-foreground border-border hover:border-accent/50'
                  }`}
                >
                  <Layers className="w-4 h-4" /> Por Lote
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {tipoDisputa === 'item'
                  ? 'Cada item será disputado individualmente. Os lances são enviados item a item.'
                  : 'Os itens são agrupados em lotes. O lance é enviado para o lote como um todo. Remova lotes ou itens que não deseja disputar.'}
              </p>
            </div>

            {/* Add item form */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Plus className="w-4 h-4 text-accent" /> Adicionar {tipoDisputa === 'lote' ? 'Item ao Lote' : 'Item'}
              </h4>
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-5">
                  <label className="text-[10px] text-muted-foreground">Descrição *</label>
                  <Input value={novoDesc} onChange={(e) => setNovoDesc(e.target.value)} placeholder="Ex: Toner HP 26A" className="mt-0.5 h-8 text-xs" />
                </div>
                <div className="col-span-1">
                  <label className="text-[10px] text-muted-foreground">Qtd</label>
                  <Input type="number" min="1" value={novoQtd} onChange={(e) => setNovoQtd(e.target.value)} className="mt-0.5 h-8 text-xs" />
                </div>
                <div className="col-span-1">
                  <label className="text-[10px] text-muted-foreground">Unid.</label>
                  <Input value={novoUnidade} onChange={(e) => setNovoUnidade(e.target.value)} placeholder="UN" className="mt-0.5 h-8 text-xs" />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] text-muted-foreground">Valor Unit. (R$)</label>
                  <Input type="number" step="0.01" value={novoValorRef} onChange={(e) => setNovoValorRef(e.target.value)} placeholder="0,00" className="mt-0.5 h-8 text-xs" />
                </div>
                {tipoDisputa === 'lote' && (
                  <div className="col-span-2">
                    <label className="text-[10px] text-muted-foreground">Lote</label>
                    <Input value={novoLote} onChange={(e) => setNovoLote(e.target.value)} placeholder="Lote 1" className="mt-0.5 h-8 text-xs" />
                  </div>
                )}
                <div className={tipoDisputa === 'lote' ? 'col-span-1' : 'col-span-3'}>
                  <label className="text-[10px] text-muted-foreground invisible">+</label>
                  <Button onClick={handleAddItem} size="sm" disabled={!novoDesc.trim()} className="mt-0.5 h-8 w-full bg-accent hover:bg-accent/90 text-accent-foreground text-xs">
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Items list */}
            {itens.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-foreground">
                    {itens.length} {itens.length === 1 ? 'item cadastrado' : 'itens cadastrados'}
                    {tipoDisputa === 'lote' && lotes.length > 0 && (
                      <span className="font-normal text-muted-foreground ml-2">em {lotes.length} {lotes.length === 1 ? 'lote' : 'lotes'}</span>
                    )}
                  </h4>
                  {licitacaoIdRef && (
                    <Badge variant="outline" className="text-[9px] bg-success/10 text-success border-success/30">
                      Importados do Kanban
                    </Badge>
                  )}
                </div>

                {tipoDisputa === 'lote' && lotes.length > 0 ? (
                  /* Grouped by lote view */
                  <div className="space-y-3">
                    {lotes.map((lote) => {
                      const loteItens = itens.filter(i => i.lote === lote);
                      const loteTotal = loteItens.reduce((s, i) => s + (i.valorReferencia * i.quantidade), 0);
                      return (
                        <div key={lote} className="border border-border rounded-lg overflow-hidden">
                          <div className="flex items-center justify-between bg-muted/60 px-3 py-1.5 border-b border-border">
                            <div className="flex items-center gap-2">
                              <Layers className="w-3.5 h-3.5 text-accent" />
                              <span className="text-xs font-bold text-foreground">{lote}</span>
                              <Badge variant="outline" className="text-[9px]">{loteItens.length} {loteItens.length === 1 ? 'item' : 'itens'}</Badge>
                              <span className="text-[10px] font-mono text-muted-foreground">{formatCurrency(loteTotal)}</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleRemoveLote(lote)}
                            >
                              <Trash2 className="w-3 h-3 mr-1" /> Remover Lote
                            </Button>
                          </div>
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/30">
                                <TableHead className="text-[10px] w-10 text-center">Nº</TableHead>
                                <TableHead className="text-[10px]">Descrição</TableHead>
                                <TableHead className="text-[10px] text-center">Qtd</TableHead>
                                <TableHead className="text-[10px] text-center">Unid.</TableHead>
                                <TableHead className="text-[10px] text-right">Vlr Unit.</TableHead>
                                <TableHead className="text-[10px] text-right">Vlr Total</TableHead>
                                <TableHead className="text-[10px] w-10" />
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {loteItens.map((item) => (
                                <TableRow key={item.id}>
                                  <TableCell className="text-xs text-center font-medium">{item.numero}</TableCell>
                                  <TableCell className="text-xs max-w-[180px] truncate">{item.descricao}</TableCell>
                                  <TableCell className="text-xs text-center">{item.quantidade}</TableCell>
                                  <TableCell className="text-xs text-center">{item.unidade}</TableCell>
                                  <TableCell className="text-xs text-right font-mono">
                                    {item.valorReferencia > 0 ? formatCurrency(item.valorReferencia) : '—'}
                                  </TableCell>
                                  <TableCell className="text-xs text-right font-mono font-semibold">
                                    {item.valorReferencia > 0 ? formatCurrency(item.valorReferencia * item.quantidade) : '—'}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={() => handleRemoveItem(item.id)}>
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Flat item view */
                  <div className="border border-border rounded-lg overflow-hidden max-h-44 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="text-[10px] w-10 text-center">Nº</TableHead>
                          <TableHead className="text-[10px]">Descrição</TableHead>
                          <TableHead className="text-[10px] text-center">Qtd</TableHead>
                          <TableHead className="text-[10px] text-center">Unid.</TableHead>
                          <TableHead className="text-[10px] text-right">Vlr Unit.</TableHead>
                          <TableHead className="text-[10px] text-right">Vlr Total</TableHead>
                          <TableHead className="text-[10px] w-10" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {itens.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="text-xs text-center font-medium">{item.numero}</TableCell>
                            <TableCell className="text-xs max-w-[160px] truncate">{item.descricao}</TableCell>
                            <TableCell className="text-xs text-center">{item.quantidade}</TableCell>
                            <TableCell className="text-xs text-center">{item.unidade}</TableCell>
                            <TableCell className="text-xs text-right font-mono">
                              {item.valorReferencia > 0 ? formatCurrency(item.valorReferencia) : '—'}
                            </TableCell>
                            <TableCell className="text-xs text-right font-mono font-semibold">
                              {item.valorReferencia > 0 ? formatCurrency(item.valorReferencia * item.quantidade) : '—'}
                            </TableCell>
                            <TableCell className="text-center">
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={() => handleRemoveItem(item.id)}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}

            {itens.length === 0 && !isExtracting && (
              <div className="text-center py-6 border border-dashed border-border rounded-lg bg-muted/20 space-y-3">
                <Package className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                <p className="text-xs text-muted-foreground">Nenhum item cadastrado ainda.</p>
                <p className="text-[10px] text-muted-foreground">
                  Extraia automaticamente via IA ou preencha o formulário acima.
                </p>
                <div className="flex flex-col items-center gap-2">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs border-primary/40 text-primary hover:bg-primary/10"
                      onClick={() => editalFileRef.current?.click()}
                    >
                      <Upload className="w-3.5 h-3.5 mr-1" /> Enviar Edital (PDF/DOC)
                    </Button>
                    {editalFile && (
                      <Button
                        size="sm"
                        className="text-xs"
                        onClick={handleAutoExtractItems}
                      >
                        <Sparkles className="w-3.5 h-3.5 mr-1" /> Extrair Itens via IA
                      </Button>
                    )}
                  </div>
                  {editalFile && (
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <FileText className="w-3 h-3" />
                      <span className="truncate max-w-[200px]">{editalFile.name}</span>
                      <button onClick={() => { setEditalFile(null); if (editalFileRef.current) editalFileRef.current.value = ''; }} className="text-destructive hover:underline">remover</button>
                    </div>
                  )}
                </div>
                <input ref={editalFileRef} type="file" accept=".pdf,.doc,.docx,.txt,.xlsx,.xls" className="hidden" onChange={handleEditalFileChange} />
              </div>
            )}

            {itens.length === 0 && isExtracting && (
              <div className="text-center py-8 border border-primary/30 rounded-lg bg-primary/5 space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
                <p className="text-sm font-medium text-foreground">Extraindo itens automaticamente...</p>
                <p className="text-[11px] text-muted-foreground">
                  A IA está analisando o edital para identificar descrição, quantidade, unidade e valores de referência.
                </p>
              </div>
            )}

            {/* ── Values panel ── */}
            {itens.length > 0 && (
              <div className="space-y-3 border border-accent/30 rounded-xl bg-accent/5 p-4">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-accent" />
                  Valores da Disputa
                  <Badge variant="outline" className="text-[9px] bg-accent/10 text-accent border-accent/30 ml-auto">
                    Desconto calculado automaticamente
                  </Badge>
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Edite os valores em R$ abaixo. O percentual de desconto é calculado automaticamente com base no Valor de Referência.
                </p>

                <div className="grid grid-cols-3 gap-3">
                  {/* Valor de Referência – read-only sum */}
                  <div className="bg-card rounded-lg border border-border p-3 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Valor de Referência</p>
                    <p className="text-lg font-bold text-foreground mt-1 font-mono">{formatCurrency(somaReferencia)}</p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">Σ (Qtd × Vlr Unit.)</p>
                  </div>

                  {/* Valor Inicial – editable R$ */}
                  <div className={`bg-card rounded-lg border p-3 text-center ${inexequibilidadeInicial ? 'border-destructive' : 'border-border'}`}>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Valor Inicial (1º lance)</p>
                    <div className="flex items-center justify-center gap-1 mt-1.5">
                      <span className="text-xs text-muted-foreground font-medium">R$</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={valorInicialInput}
                        onChange={(e) => setValorInicialInput(e.target.value)}
                        placeholder="0,00"
                        className="h-8 w-32 text-sm text-center px-1 font-mono font-bold"
                      />
                    </div>
                    <p className={`text-[10px] font-semibold mt-1.5 ${inexequibilidadeInicial ? 'text-destructive' : 'text-accent'}`}>
                      {pctDescontoInicial >= 0 ? `↓ ${pctDescontoInicial.toFixed(2)}% de desconto` : `↑ ${Math.abs(pctDescontoInicial).toFixed(2)}% acima`}
                    </p>
                    {inexequibilidadeInicial && (
                      <p className="text-[9px] text-destructive font-bold mt-0.5 animate-pulse">⚠️ INEXEQUÍVEL</p>
                    )}
                  </div>

                  {/* Valor Mínimo – editable R$ */}
                  <div className={`bg-card rounded-lg border p-3 text-center ${inexequibilidadeMinimo ? 'border-destructive' : 'border-destructive/30'}`}>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Valor Mínimo (piso)</p>
                    <div className="flex items-center justify-center gap-1 mt-1.5">
                      <span className="text-xs text-muted-foreground font-medium">R$</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={valorMinimoInput}
                        onChange={(e) => setValorMinimoInput(e.target.value)}
                        placeholder="0,00"
                        className="h-8 w-32 text-sm text-center px-1 font-mono font-bold"
                      />
                    </div>
                    <p className={`text-[10px] font-semibold mt-1.5 ${inexequibilidadeMinimo ? 'text-destructive' : 'text-destructive/80'}`}>
                      {pctDescontoMinimo >= 0 ? `↓ ${pctDescontoMinimo.toFixed(2)}% de desconto` : `↑ ${Math.abs(pctDescontoMinimo).toFixed(2)}% acima`}
                    </p>
                    {inexequibilidadeMinimo && (
                      <p className="text-[9px] text-destructive font-bold mt-0.5 animate-pulse">⚠️ INEXEQUÍVEL</p>
                    )}
                  </div>
                </div>

                {/* Inexequibilidade alert banner */}
                {(inexequibilidadeInicial || inexequibilidadeMinimo) && (
                  <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-destructive/10 border border-destructive/40 text-xs text-destructive">
                    <span className="text-base leading-none mt-0.5">🚨</span>
                    <div>
                      <p className="font-bold">Risco de Inexequibilidade (Art. 59, §4º da Lei 14.133/2021)</p>
                      <p className="mt-0.5 text-destructive/80">
                        Propostas com desconto superior a 50% do valor de referência podem ser consideradas inexequíveis pelo pregoeiro, exigindo comprovação de viabilidade econômica.
                      </p>
                    </div>
                  </div>
                )}

                {valorMinimo > valorInicial && (
                  <p className="text-[10px] text-destructive flex items-center gap-1">
                    ⚠️ O valor mínimo (piso) está acima do valor inicial. Revise os valores.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex justify-between sm:justify-between">
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep((step - 1) as 0 | 1)}>
              Voltar
            </Button>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setOpen(false); resetForm(); }}>Cancelar</Button>
            {step === 0 && (
              <Button onClick={() => setStep(1)} variant="outline" className="text-xs">
                <Pencil className="w-3.5 h-3.5 mr-1" /> Pular para cadastro manual
              </Button>
            )}
            {step === 1 && (
              <Button
                onClick={() => setStep(2)}
                disabled={!step1Valid}
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                Próximo: Itens / Lotes
              </Button>
            )}
            {step === 2 && (
              <Button
                onClick={handleSave}
                disabled={itens.length === 0 || somaReferencia <= 0 || valorMinimo > valorInicial}
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                {editingLance ? 'Salvar Alterações' : 'Cadastrar Sessão'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
