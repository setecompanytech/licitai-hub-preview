import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  Upload, Download, FileText, Trash2, Pencil, Loader2, File, DollarSign, Package, Calendar, Layers, FilePlus2, RefreshCw
} from 'lucide-react';
import DocumentDetectionDialog, { type DetectionResult } from './DocumentDetectionDialog';
import { extractContractDataFromFile } from './utils/extractContractData';
import { validateExtractedContract, buildParentUpdates } from './utils/validateExtractedContract';

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const fmtQty = (v: number) => new Intl.NumberFormat('pt-BR').format(v);

const TIPOS_ARQUIVO: Record<string, { label: string; color: string; isAditivo?: boolean; tipoAditivo?: string }> = {
  ata_srp: { label: 'ATA SRP', color: 'bg-amber-500/10 text-amber-600' },
  contrato_original: { label: 'Contrato Original', color: 'bg-primary/10 text-primary' },
  aditivo_valor: { label: 'Aditivo de Valor', color: 'bg-success/10 text-success', isAditivo: true, tipoAditivo: 'valor' },
  aditivo_quantidade: { label: 'Aditivo de Quantidade', color: 'bg-accent/10 text-accent', isAditivo: true, tipoAditivo: 'quantidade' },
  aditivo_valor_quantidade: { label: 'Aditivo de Valor e Qtde', color: 'bg-blue-500/10 text-blue-600', isAditivo: true, tipoAditivo: 'valor_quantidade' },
  aditivo_prazo: { label: 'Aditivo de Prazo', color: 'bg-warning/10 text-warning', isAditivo: true, tipoAditivo: 'prazo' },
  aditivo_escopo: { label: 'Aditivo de Escopo', color: 'bg-primary/10 text-primary', isAditivo: true, tipoAditivo: 'escopo' },
  outro: { label: 'Outro Documento', color: 'bg-muted text-muted-foreground' },
};

const showValueFields = (tipo: string) => ['aditivo_valor', 'aditivo_valor_quantidade', 'aditivo_escopo', 'aditivo_prazo'].includes(tipo);
const showQtyFields = (tipo: string) => ['aditivo_quantidade', 'aditivo_valor_quantidade', 'aditivo_prazo'].includes(tipo);
const showDateField = (tipo: string) => ['aditivo_prazo'].includes(tipo);
const isAditivoType = (tipo: string) => TIPOS_ARQUIVO[tipo]?.isAditivo === true;

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const emptyAditivoForm = {
  numero_aditivo: '',
  valor_acrescimo: '',
  valor_supressao: '',
  quantidade_acrescimo: '',
  quantidade_supressao: '',
  nova_data_fim: '',
  data_assinatura: '',
  justificativa: '',
  observacoes: '',
};

export default function ContratoArquivos({ contratoId }: { contratoId: string }) {
  const { user } = useAuth();
  const [arquivos, setArquivos] = useState<any[]>([]);
  const [aditivos, setAditivos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editDialog, setEditDialog] = useState<{ open: boolean; arquivo: any | null }>({ open: false, arquivo: null });
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editTipo, setEditTipo] = useState('contrato_original');
  const [editDescricao, setEditDescricao] = useState('');
  const [editAditivoForm, setEditAditivoForm] = useState(emptyAditivoForm);
  const [editLinkedAditivoId, setEditLinkedAditivoId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const editFileRef = useRef<HTMLInputElement>(null);
  const [uploadTipo, setUploadTipo] = useState('contrato_original');
  const [aditivoForm, setAditivoForm] = useState(emptyAditivoForm);
  const [showAditivoFields, setShowAditivoFields] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const replaceFileRef = useRef<HTMLInputElement>(null);
  const replaceTargetRef = useRef<any>(null);
  const [parentContrato, setParentContrato] = useState<any>(null);
  const [detectionOpen, setDetectionOpen] = useState(false);
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [detectionFileName, setDetectionFileName] = useState('');

  const loadData = async () => {
    setLoading(true);
    const [arqRes, adtRes, contratoRes] = await Promise.all([
      supabase.from('contrato_arquivos').select('*').eq('contrato_id', contratoId).order('created_at', { ascending: false }),
      supabase.from('contrato_aditivos').select('*').eq('contrato_id', contratoId).order('created_at', { ascending: true }),
      supabase.from('contratos').select('id, tipo_documento, ata_srp_id, numero_contrato, numero_ata, objeto, orgao_contratante, modalidade, valor_global, valor_global_original, data_assinatura, data_inicio, data_fim, vigencia_meses, validade_ata_meses, empresa_id').eq('id', contratoId).maybeSingle(),
    ]);
    setArquivos((arqRes.data as any[]) || []);
    setAditivos((adtRes.data as any[]) || []);
    setParentContrato(contratoRes.data || null);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [contratoId]);

  const parentTipoDocumento: 'ata_srp' | 'contrato' | null =
    parentContrato?.tipo_documento === 'ata_srp' ? 'ata_srp'
    : parentContrato?.tipo_documento === 'contrato' ? 'contrato'
    : null;

  // When upload type changes, show/hide aditivo fields
  useEffect(() => {
    const isAdt = isAditivoType(uploadTipo);
    setShowAditivoFields(isAdt);
    if (isAdt) {
      const count = aditivos.length + 1;
      setAditivoForm(f => ({ ...f, numero_aditivo: f.numero_aditivo || `${count}º Aditivo` }));
    }
  }, [uploadTipo, aditivos.length]);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error('Arquivo muito grande (máx. 20MB)');
      if (fileRef.current) fileRef.current.value = '';
      return;
    }

    if (isAditivoType(uploadTipo)) {
      // Manual aditivo path: keep existing behaviour, but also try IA pre-fill
      setPendingFile(file);
      if (fileRef.current) fileRef.current.value = '';
      // best-effort IA pre-fill of aditivo fields
      runIaPreFillForAditivo(file).catch(() => {/* noop */});
      return;
    }

    // Non-aditivo upload: run IA detection BEFORE persisting to suggest correct registry
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      setPendingFile(file);
      if (fileRef.current) fileRef.current.value = '';
      toast.info('Analisando documento via IA…');
      try {
        const detected = await extractContractDataFromFile(file, uploadTipo);
        if (detected && detected.tipo_documento_detectado) {
          const detectedType = detected.tipo_documento_detectado;
          const isAditivoDetected = detectedType === 'aditivo';
          const mismatch = !isAditivoDetected && parentTipoDocumento &&
            ((parentTipoDocumento === 'contrato' && detectedType === 'ata_srp') ||
             (parentTipoDocumento === 'ata_srp' && detectedType === 'contrato'));
          if (mismatch || isAditivoDetected) {
            setDetection(detected as DetectionResult);
            setDetectionFileName(file.name);
            setDetectionOpen(true);
            return; // wait for user decision
          }
          // Matches expected type → upload AND auto-populate parent record fields
          const created = await doUpload(file, uploadTipo);
          await applyExtractedToParent(detected, created);
          setPendingFile(null);
          return;
        }
      } catch (err) {
        console.warn('IA detection skipped:', err);
      }
      // No detection → upload as chosen
      await doUpload(file, uploadTipo);
      setPendingFile(null);
    } else {
      doUpload(file, uploadTipo);
    }
  };

  /**
   * Updates the parent `contratos` row with structured data extracted from the
   * uploaded ATA SRP / Contract PDF. Only fills empty/zero fields so it never
   * overwrites manual edits done by the user. Records every field filled into
   * the audit log table `contrato_ia_auditoria`, linking it to the source file.
   */
  const applyExtractedToParent = async (d: any, sourceFile?: { id: string; nome: string } | null) => {
    if (!d || !parentContrato || !parentTipoDocumento || !user) return;

    // 1) Validar e normalizar payload da IA (datas ISO, números finitos, strings limpas, coerência).
    const { normalized, rejected } = validateExtractedContract(d);
    if (rejected.length > 0) {
      console.warn('[applyExtractedToParent] campos rejeitados pela validação:', rejected);
    }

    // 2) Construir UPDATE respeitando edições manuais e mapeando para colunas reais.
    const updates = buildParentUpdates(normalized, parentContrato, parentTipoDocumento);

    if (Object.keys(updates).length === 0) {
      const motivo = rejected.length > 0
        ? `IA retornou dados inválidos (${rejected.join(', ')}).`
        : 'IA não encontrou novos campos para preencher (registro já preenchido).';
      toast.info(motivo);
      return;
    }

    const { error } = await supabase.from('contratos').update(updates).eq('id', contratoId);
    if (error) {
      console.warn('applyExtractedToParent failed:', error);
      toast.warning('Arquivo registrado, mas falha ao atualizar o Dashboard.', { description: error.message });
      return;
    }

    // 3) Auditoria: 1 linha por campo preenchido pela IA.
    const auditRows = Object.entries(updates).map(([campo, novo]) => ({
      contrato_id: contratoId,
      arquivo_id: sourceFile?.id || null,
      arquivo_nome: sourceFile?.nome || null,
      campo,
      valor_anterior: parentContrato?.[campo] != null ? String(parentContrato[campo]) : null,
      valor_novo: novo != null ? String(novo) : null,
      origem: 'ia_extracao',
      user_id: user.id,
    }));
    if (auditRows.length > 0) {
      const { error: auditErr } = await supabase.from('contrato_ia_auditoria').insert(auditRows as any);
      if (auditErr) console.warn('[audit] insert failed:', auditErr);
    }

    const aviso = rejected.length > 0 ? ` (${rejected.length} campo(s) rejeitado(s) pela validação)` : '';
    toast.success(`Dashboard atualizado pela IA: ${Object.keys(updates).length} campo(s) preenchido(s)${aviso}.`);
    loadData();
  };

  const runIaPreFillForAditivo = async (file: File) => {
    try {
      const detected = await extractContractDataFromFile(file, uploadTipo);
      if (detected?.aditivo) {
        const a = detected.aditivo;
        setAditivoForm(f => ({
          ...f,
          numero_aditivo: a.numero_aditivo || f.numero_aditivo,
          valor_acrescimo: a.valor_acrescimo ? String(a.valor_acrescimo) : f.valor_acrescimo,
          valor_supressao: a.valor_supressao ? String(a.valor_supressao) : f.valor_supressao,
          quantidade_acrescimo: a.quantidade_acrescimo ? String(a.quantidade_acrescimo) : f.quantidade_acrescimo,
          quantidade_supressao: a.quantidade_supressao ? String(a.quantidade_supressao) : f.quantidade_supressao,
          nova_data_fim: a.nova_data_fim || f.nova_data_fim,
          justificativa: a.justificativa || f.justificativa,
        }));
        toast.success('IA pré-preencheu os campos do aditivo. Revise antes de confirmar.');
      }
    } catch (e) { /* silent */ }
  };

  const doUpload = async (file: File, tipo: string, aditivoData?: typeof emptyAditivoForm): Promise<{ id: string; nome: string } | null> => {
    if (!user) return null;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'pdf';
      const path = `${user.id}/${contratoId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage.from('contratos-docs').upload(path, file);
      if (uploadError) throw uploadError;

      const { data: inserted, error: dbError } = await supabase.from('contrato_arquivos').insert({
        contrato_id: contratoId,
        user_id: user.id,
        nome_arquivo: file.name,
        storage_path: path,
        tipo,
        tamanho_bytes: file.size,
      } as any).select('id, nome_arquivo').single();
      if (dbError) throw dbError;

      // If aditivo type, also create the aditivo record
      if (aditivoData && isAditivoType(tipo)) {
        const tipoAditivo = TIPOS_ARQUIVO[tipo]?.tipoAditivo || 'valor';
        const payload: any = {
          contrato_id: contratoId,
          user_id: user.id,
          numero_aditivo: aditivoData.numero_aditivo || `${aditivos.length + 1}º Aditivo`,
          tipo: tipoAditivo,
          valor_acrescimo: showValueFields(tipo) ? (parseFloat(aditivoData.valor_acrescimo) || 0) : 0,
          valor_supressao: showValueFields(tipo) ? (parseFloat(aditivoData.valor_supressao) || 0) : 0,
          quantidade_acrescimo: showQtyFields(tipo) ? (parseFloat(aditivoData.quantidade_acrescimo) || 0) : 0,
          quantidade_supressao: showQtyFields(tipo) ? (parseFloat(aditivoData.quantidade_supressao) || 0) : 0,
          nova_data_fim: aditivoData.nova_data_fim || null,
          data_assinatura: aditivoData.data_assinatura || null,
          data_aditivo: aditivoData.data_assinatura || null,
          justificativa: aditivoData.justificativa || null,
          observacoes: aditivoData.observacoes || null,
        };
        payload.valor_aditivo = payload.valor_acrescimo - payload.valor_supressao;

        const { error: adtError } = await supabase.from('contrato_aditivos').insert(payload);
        if (adtError) throw adtError;
      }

      toast.success('Documento registrado com sucesso!');
      setPendingFile(null);
      setAditivoForm(emptyAditivoForm);
      loadData();
      return inserted ? { id: (inserted as any).id, nome: (inserted as any).nome_arquivo } : null;
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao registrar documento', { description: err.message });
      return null;
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleConfirmAditivo = () => {
    if (pendingFile) {
      doUpload(pendingFile, uploadTipo, aditivoForm);
    } else {
      // Manual registration without file
      if (!user) return;
      doManualAditivo();
    }
  };

  const doManualAditivo = async () => {
    if (!user) return;
    setUploading(true);
    try {
      const tipoAditivo = TIPOS_ARQUIVO[uploadTipo]?.tipoAditivo || 'valor';
      const payload: any = {
        contrato_id: contratoId,
        user_id: user.id,
        numero_aditivo: aditivoForm.numero_aditivo || `${aditivos.length + 1}º Aditivo`,
        tipo: tipoAditivo,
        valor_acrescimo: showValueFields(uploadTipo) ? (parseFloat(aditivoForm.valor_acrescimo) || 0) : 0,
        valor_supressao: showValueFields(uploadTipo) ? (parseFloat(aditivoForm.valor_supressao) || 0) : 0,
        quantidade_acrescimo: showQtyFields(uploadTipo) ? (parseFloat(aditivoForm.quantidade_acrescimo) || 0) : 0,
        quantidade_supressao: showQtyFields(uploadTipo) ? (parseFloat(aditivoForm.quantidade_supressao) || 0) : 0,
        nova_data_fim: aditivoForm.nova_data_fim || null,
        data_assinatura: aditivoForm.data_assinatura || null,
        data_aditivo: aditivoForm.data_assinatura || null,
        justificativa: aditivoForm.justificativa || null,
        observacoes: aditivoForm.observacoes || null,
      };
      payload.valor_aditivo = payload.valor_acrescimo - payload.valor_supressao;

      const { error } = await supabase.from('contrato_aditivos').insert(payload);
      if (error) throw error;

      toast.success('Aditivo registrado com sucesso!');
      setAditivoForm(emptyAditivoForm);
      setPendingFile(null);
      loadData();
    } catch (err: any) {
      toast.error('Erro ao registrar aditivo', { description: err.message });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (arquivo: any) => {
    try {
      const { data, error } = await supabase.storage.from('contratos-docs').download(arquivo.storage_path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = arquivo.nome_arquivo;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error('Erro ao baixar arquivo', { description: err.message });
    }
  };

  const handleReplaceFile = (arquivo: any) => {
    replaceTargetRef.current = arquivo;
    replaceFileRef.current?.click();
  };

  const onReplaceFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const arquivo = replaceTargetRef.current;
    if (e.target) e.target.value = '';
    if (!file || !arquivo || !user) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error('Arquivo muito grande (máx. 20MB)');
      return;
    }

    setReplacingId(arquivo.id);
    try {
      // 1) Save current version into history
      await supabase.from('contrato_arquivos_versoes').insert({
        arquivo_id: arquivo.id,
        contrato_id: contratoId,
        user_id: user.id,
        nome_arquivo: arquivo.nome_arquivo,
        storage_path: arquivo.storage_path,
        tamanho_bytes: arquivo.tamanho_bytes,
        tipo: arquivo.tipo,
        descricao: arquivo.descricao || null,
      } as any);

      // 2) Upload new file to storage
      const ext = file.name.split('.').pop() || 'pdf';
      const newPath = `${user.id}/${contratoId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('contratos-docs').upload(newPath, file);
      if (upErr) throw upErr;

      // 3) Update arquivo row to point to new file
      const { error: updErr } = await supabase.from('contrato_arquivos').update({
        storage_path: newPath,
        nome_arquivo: file.name,
        tamanho_bytes: file.size,
      } as any).eq('id', arquivo.id);
      if (updErr) throw updErr;

      toast.success('Arquivo substituído. Reextraindo dados via IA…');

      // 4) Trigger IA re-extraction (best-effort, async)
      try {
        const fileBuffer = await file.arrayBuffer();
        const pdfjsLib: any = await import('pdfjs-dist');
        // Use worker from public if available, fallback to inline
        try {
          pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
        } catch {}
        const pdf = await pdfjsLib.getDocument({ data: fileBuffer }).promise;
        let texto = '';
        for (let i = 1; i <= Math.min(pdf.numPages, 50); i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          texto += content.items.map((it: any) => it.str).join(' ') + '\n';
        }

        if (texto.trim().length < 80) {
          toast.warning('Não foi possível extrair texto do PDF. Edite valores manualmente.');
          return;
        }

        const { data: extracted, error: extErr } = await supabase.functions.invoke('extrair-contrato-pdf', {
          body: { texto_pdf: texto, nome_arquivo: file.name, tipo_arquivo: arquivo.tipo },
        });
        if (extErr) throw extErr;
        if (!extracted?.success || !extracted?.data) {
          toast.warning('IA não conseguiu extrair dados estruturados.');
          return;
        }

        const d = extracted.data;
        const updates: any = {};
        if (d.numero_contrato) updates.numero_contrato = d.numero_contrato;
        if (d.objeto) updates.objeto = d.objeto;
        if (d.orgao_contratante) updates.orgao = d.orgao_contratante;
        if (typeof d.valor_global === 'number') updates.valor_global_original = d.valor_global;
        if (d.data_assinatura) updates.data_assinatura = d.data_assinatura;
        if (d.data_inicio) updates.data_inicio = d.data_inicio;
        if (d.data_fim) updates.data_fim = d.data_fim;
        if (d.modalidade) updates.modalidade = d.modalidade;

        if (Object.keys(updates).length > 0) {
          const { error: cErr } = await supabase.from('contratos').update(updates).eq('id', contratoId);
          if (cErr) console.warn('Falha ao atualizar contrato:', cErr);
        }

        toast.success(`Reextração concluída. ${Object.keys(updates).length} campos atualizados.`);
      } catch (extErr: any) {
        console.warn('Reextração falhou:', extErr);
        toast.warning('Arquivo substituído, mas reextração IA falhou.', { description: extErr?.message });
      }

      loadData();
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao substituir arquivo', { description: err.message });
    } finally {
      setReplacingId(null);
      replaceTargetRef.current = null;
    }
  };

  const handleDelete = async (arquivo: any) => {
    if (!confirm('Excluir este arquivo permanentemente?')) return;
    try {
      await supabase.storage.from('contratos-docs').remove([arquivo.storage_path]);
      await supabase.from('contrato_arquivos').delete().eq('id', arquivo.id);
      toast.success('Arquivo excluído');
      loadData();
    } catch (err: any) {
      toast.error('Erro ao excluir', { description: err.message });
    }
  };

  const handleDeleteAditivo = async (id: string) => {
    if (!confirm('Excluir este aditivo?')) return;
    await supabase.from('contrato_aditivos').delete().eq('id', id);
    toast.success('Aditivo excluído');
    loadData();
  };

  const openEdit = (arquivo: any) => {
    setEditDialog({ open: true, arquivo });
    setEditTipo(arquivo.tipo);
    setEditDescricao(arquivo.descricao || '');
    setEditFile(null);

    // If file is aditivo type, find linked aditivo and populate fields
    if (isAditivoType(arquivo.tipo)) {
      // Try to find aditivo linked by matching tipo and creation time proximity
      const tipoAditivo = TIPOS_ARQUIVO[arquivo.tipo]?.tipoAditivo || 'valor';
      const linked = aditivos.find((a: any) => a.tipo === tipoAditivo);
      if (linked) {
        setEditLinkedAditivoId(linked.id);
        setEditAditivoForm({
          numero_aditivo: linked.numero_aditivo || '',
          valor_acrescimo: linked.valor_acrescimo?.toString() || '',
          valor_supressao: linked.valor_supressao?.toString() || '',
          quantidade_acrescimo: linked.quantidade_acrescimo?.toString() || '',
          quantidade_supressao: linked.quantidade_supressao?.toString() || '',
          nova_data_fim: linked.nova_data_fim || '',
          data_assinatura: linked.data_assinatura || linked.data_aditivo || '',
          justificativa: linked.justificativa || '',
          observacoes: linked.observacoes || '',
        });
      } else {
        setEditLinkedAditivoId(null);
        setEditAditivoForm({ ...emptyAditivoForm, numero_aditivo: `${aditivos.length + 1}º Aditivo` });
      }
    } else {
      setEditLinkedAditivoId(null);
      setEditAditivoForm(emptyAditivoForm);
    }
  };

  const handleSaveEdit = async () => {
    if (!editDialog.arquivo || !user) return;
    setSaving(true);
    try {
      let newPath = editDialog.arquivo.storage_path;
      let newName = editDialog.arquivo.nome_arquivo;
      let newSize = editDialog.arquivo.tamanho_bytes;

      if (editFile) {
        await supabase.storage.from('contratos-docs').remove([editDialog.arquivo.storage_path]);
        const ext = editFile.name.split('.').pop() || 'pdf';
        newPath = `${user.id}/${contratoId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('contratos-docs').upload(newPath, editFile);
        if (upErr) throw upErr;
        newName = editFile.name;
        newSize = editFile.size;
      }

      const { error } = await supabase.from('contrato_arquivos').update({
        tipo: editTipo,
        descricao: editDescricao || null,
        storage_path: newPath,
        nome_arquivo: newName,
        tamanho_bytes: newSize,
      } as any).eq('id', editDialog.arquivo.id);

      if (error) throw error;

      // Sync aditivo record if type is aditivo
      if (isAditivoType(editTipo)) {
        const tipoAditivo = TIPOS_ARQUIVO[editTipo]?.tipoAditivo || 'valor';
        const payload: any = {
          contrato_id: contratoId,
          user_id: user.id,
          numero_aditivo: editAditivoForm.numero_aditivo || `${aditivos.length + 1}º Aditivo`,
          tipo: tipoAditivo,
          valor_acrescimo: showValueFields(editTipo) ? (parseFloat(editAditivoForm.valor_acrescimo) || 0) : 0,
          valor_supressao: showValueFields(editTipo) ? (parseFloat(editAditivoForm.valor_supressao) || 0) : 0,
          quantidade_acrescimo: showQtyFields(editTipo) ? (parseFloat(editAditivoForm.quantidade_acrescimo) || 0) : 0,
          quantidade_supressao: showQtyFields(editTipo) ? (parseFloat(editAditivoForm.quantidade_supressao) || 0) : 0,
          nova_data_fim: editAditivoForm.nova_data_fim || null,
          data_assinatura: editAditivoForm.data_assinatura || null,
          data_aditivo: editAditivoForm.data_assinatura || null,
          justificativa: editAditivoForm.justificativa || null,
          observacoes: editAditivoForm.observacoes || null,
        };
        payload.valor_aditivo = payload.valor_acrescimo - payload.valor_supressao;

        if (editLinkedAditivoId) {
          await supabase.from('contrato_aditivos').update(payload).eq('id', editLinkedAditivoId);
        } else {
          await supabase.from('contrato_aditivos').insert(payload);
        }
      }

      toast.success('Documento atualizado!');
      setEditDialog({ open: false, arquivo: null });
      loadData();
    } catch (err: any) {
      toast.error('Erro ao atualizar', { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  // Aditivos summaries
  const totalAcrescimo = aditivos.reduce((s: number, a: any) => s + (a.valor_acrescimo || 0), 0);
  const totalSupressao = aditivos.reduce((s: number, a: any) => s + (a.valor_supressao || 0), 0);
  const saldoAditivos = totalAcrescimo - totalSupressao;
  const totalQtyAcrescimo = aditivos.reduce((s: number, a: any) => s + (a.quantidade_acrescimo || 0), 0);
  const totalQtySupressao = aditivos.reduce((s: number, a: any) => s + (a.quantidade_supressao || 0), 0);
  const saldoQty = totalQtyAcrescimo - totalQtySupressao;

  const ADITIVO_ICON: Record<string, typeof DollarSign> = {
    valor: DollarSign,
    quantidade: Package,
    valor_quantidade: Layers,
    prazo: Calendar,
    escopo: FilePlus2,
  };

  // ── Detection Dialog handlers ──────────────────────────────────────────
  const handleDetectionIgnore = () => {
    setDetectionOpen(false);
    if (pendingFile) {
      doUpload(pendingFile, uploadTipo);
      setPendingFile(null);
    }
    setDetection(null);
  };

  const handleCreateLinkedRegistry = async (data: DetectionResult) => {
    if (!user || !pendingFile || !parentContrato) return;
    try {
      const detectedType = data.tipo_documento_detectado;
      const newTipoDoc: 'ata_srp' | 'contrato' = detectedType === 'ata_srp' ? 'ata_srp' : 'contrato';
      const newRow: any = {
        user_id: user.id,
        empresa_id: parentContrato.empresa_id,
        tipo_documento: newTipoDoc,
        numero_contrato: data.numero_contrato || data.numero_ata || pendingFile.name,
        objeto: data.objeto || null,
        orgao: parentContrato.orgao || null,
        valor_global_original: data.valor_global || 0,
        valor_global: data.valor_global || 0,
        data_inicio: data.data_inicio || null,
        data_fim: data.data_fim || null,
        status: 'ativo',
      };
      if (newTipoDoc === 'contrato' && parentTipoDocumento === 'ata_srp') {
        newRow.ata_srp_id = parentContrato.id;
      }
      const { data: created, error: insErr } = await supabase
        .from('contratos').insert(newRow).select('id').single();
      if (insErr) throw insErr;

      const ext = pendingFile.name.split('.').pop() || 'pdf';
      const path = `${user.id}/${created.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('contratos-docs').upload(path, pendingFile);
      if (upErr) throw upErr;
      await supabase.from('contrato_arquivos').insert({
        contrato_id: created.id,
        user_id: user.id,
        nome_arquivo: pendingFile.name,
        storage_path: path,
        tipo: newTipoDoc === 'ata_srp' ? 'ata_srp' : 'contrato_original',
        tamanho_bytes: pendingFile.size,
      } as any);

      toast.success(`${newTipoDoc === 'ata_srp' ? 'ATA SRP' : 'Contrato derivado'} criado e vinculado.`);
      setDetectionOpen(false);
      setPendingFile(null);
      setDetection(null);
      loadData();
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao criar registro vinculado', { description: err.message });
    }
  };

  const handleConfirmAditivoFromDetection = async (form: {
    numero_aditivo: string;
    valor_acrescimo: number;
    valor_supressao: number;
    quantidade_acrescimo: number;
    quantidade_supressao: number;
    nova_data_fim: string | null;
    justificativa: string | null;
    target: 'contrato' | 'ata_srp';
  }) => {
    if (!user || !pendingFile) return;
    try {
      const ext = pendingFile.name.split('.').pop() || 'pdf';
      const path = `${user.id}/${contratoId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('contratos-docs').upload(path, pendingFile);
      if (upErr) throw upErr;

      let tipoArq = 'aditivo_valor';
      if ((form.valor_acrescimo + form.valor_supressao) > 0 && (form.quantidade_acrescimo + form.quantidade_supressao) > 0) tipoArq = 'aditivo_valor_quantidade';
      else if ((form.quantidade_acrescimo + form.quantidade_supressao) > 0) tipoArq = 'aditivo_quantidade';
      else if (form.nova_data_fim) tipoArq = 'aditivo_prazo';

      await supabase.from('contrato_arquivos').insert({
        contrato_id: contratoId,
        user_id: user.id,
        nome_arquivo: pendingFile.name,
        storage_path: path,
        tipo: tipoArq,
        tamanho_bytes: pendingFile.size,
      } as any);

      const tipoAditivo = TIPOS_ARQUIVO[tipoArq]?.tipoAditivo || 'valor';
      const payload: any = {
        contrato_id: contratoId,
        user_id: user.id,
        numero_aditivo: form.numero_aditivo || `${aditivos.length + 1}º Aditivo`,
        tipo: tipoAditivo,
        valor_acrescimo: form.valor_acrescimo,
        valor_supressao: form.valor_supressao,
        quantidade_acrescimo: form.quantidade_acrescimo,
        quantidade_supressao: form.quantidade_supressao,
        nova_data_fim: form.nova_data_fim,
        justificativa: form.justificativa,
        referencia_tipo: form.target,
      };
      payload.valor_aditivo = payload.valor_acrescimo - payload.valor_supressao;
      const { error: adtErr } = await supabase.from('contrato_aditivos').insert(payload);
      if (adtErr) throw adtErr;

      toast.success('Aditivo registrado e saldos atualizados!');
      setDetectionOpen(false);
      setPendingFile(null);
      setDetection(null);
      loadData();
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao registrar aditivo', { description: err.message });
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <ContratoIaAuditoriaPanel contratoId={contratoId} />
      <Card className="p-4 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
          <div className="flex-1">
            <Label className="text-xs font-semibold mb-1 block">Registro de Documento / Aditivo</Label>
            <Select value={uploadTipo} onValueChange={(v) => { setUploadTipo(v); setPendingFile(null); setAditivoForm(emptyAditivoForm); }}>
              <SelectTrigger className="w-full sm:w-[260px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TIPOS_ARQUIVO).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
              className="hidden"
              onChange={handleFileSelected}
            />
            <Button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              size="sm"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
              Enviar Arquivo
            </Button>
          </div>
        </div>

        {/* Aditivo detail fields - shown when aditivo type selected */}
        {showAditivoFields && (
          <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
            <p className="text-xs font-semibold text-muted-foreground">Dados do Aditivo {pendingFile && <Badge variant="outline" className="ml-2 text-[9px]">Arquivo: {pendingFile.name}</Badge>}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Nº/Identificação</Label>
                <Input value={aditivoForm.numero_aditivo} onChange={(e) => setAditivoForm(f => ({ ...f, numero_aditivo: e.target.value }))} placeholder="1º Aditivo" />
              </div>
              <div>
                <Label className="text-xs">Data Assinatura</Label>
                <Input type="date" value={aditivoForm.data_assinatura} onChange={(e) => setAditivoForm(f => ({ ...f, data_assinatura: e.target.value }))} />
              </div>

              {showValueFields(uploadTipo) && (
                <>
                  <div>
                    <Label className="text-xs">Valor Acréscimo (R$)</Label>
                    <Input type="number" step="0.01" value={aditivoForm.valor_acrescimo} onChange={(e) => setAditivoForm(f => ({ ...f, valor_acrescimo: e.target.value }))} placeholder="0,00" />
                  </div>
                  <div>
                    <Label className="text-xs">Valor Supressão (R$)</Label>
                    <Input type="number" step="0.01" value={aditivoForm.valor_supressao} onChange={(e) => setAditivoForm(f => ({ ...f, valor_supressao: e.target.value }))} placeholder="0,00" />
                  </div>
                </>
              )}

              {showQtyFields(uploadTipo) && (
                <>
                  <div>
                    <Label className="text-xs">Qtde Acréscimo</Label>
                    <Input type="number" step="1" value={aditivoForm.quantidade_acrescimo} onChange={(e) => setAditivoForm(f => ({ ...f, quantidade_acrescimo: e.target.value }))} placeholder="0" />
                  </div>
                  <div>
                    <Label className="text-xs">Qtde Supressão</Label>
                    <Input type="number" step="1" value={aditivoForm.quantidade_supressao} onChange={(e) => setAditivoForm(f => ({ ...f, quantidade_supressao: e.target.value }))} placeholder="0" />
                  </div>
                </>
              )}

              {(showDateField(uploadTipo) || isAditivoType(uploadTipo)) && (
                <div>
                  <Label className="text-xs">Nova Data Fim (se prorrogação)</Label>
                  <Input type="date" value={aditivoForm.nova_data_fim} onChange={(e) => setAditivoForm(f => ({ ...f, nova_data_fim: e.target.value }))} />
                </div>
              )}

              <div className="sm:col-span-2">
                <Label className="text-xs">Justificativa / Fundamentação</Label>
                <Textarea value={aditivoForm.justificativa} onChange={(e) => setAditivoForm(f => ({ ...f, justificativa: e.target.value }))} rows={2} placeholder="Fundamentação legal do aditivo" />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Observações</Label>
                <Textarea value={aditivoForm.observacoes} onChange={(e) => setAditivoForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} />
              </div>
            </div>

            {/* Live preview */}
            {(showValueFields(uploadTipo) || showQtyFields(uploadTipo)) && (
              <Card className="p-3 bg-muted/50">
                <p className="text-[10px] text-muted-foreground mb-1 font-medium">Resumo do Aditivo</p>
                <div className="flex flex-wrap gap-4 text-xs">
                  {showValueFields(uploadTipo) && (
                    <span className={`font-semibold ${(parseFloat(aditivoForm.valor_acrescimo) || 0) - (parseFloat(aditivoForm.valor_supressao) || 0) >= 0 ? 'text-success' : 'text-destructive'}`}>
                      Saldo Valor: {fmt((parseFloat(aditivoForm.valor_acrescimo) || 0) - (parseFloat(aditivoForm.valor_supressao) || 0))}
                    </span>
                  )}
                  {showQtyFields(uploadTipo) && (
                    <span className={`font-semibold ${(parseFloat(aditivoForm.quantidade_acrescimo) || 0) - (parseFloat(aditivoForm.quantidade_supressao) || 0) >= 0 ? 'text-success' : 'text-destructive'}`}>
                      Saldo Qtde: {fmtQty((parseFloat(aditivoForm.quantidade_acrescimo) || 0) - (parseFloat(aditivoForm.quantidade_supressao) || 0))}
                    </span>
                  )}
                </div>
              </Card>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => { setShowAditivoFields(false); setPendingFile(null); setAditivoForm(emptyAditivoForm); setUploadTipo('contrato_original'); }}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleConfirmAditivo} disabled={uploading}>
                {uploading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {pendingFile ? 'Enviar e Registrar Aditivo' : 'Registrar Aditivo (sem arquivo)'}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Hidden input for file replacement */}
      <input
        ref={replaceFileRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
        className="hidden"
        onChange={onReplaceFileSelected}
      />

      {/* File list */}
      {arquivos.length === 0 ? (
        <Card className="p-8 text-center">
          <File className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum documento anexado a este contrato</p>
          <p className="text-xs text-muted-foreground mt-1">Envie o contrato original, aditivos e outros documentos.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {arquivos.map((arq) => {
            const tipoConfig = TIPOS_ARQUIVO[arq.tipo] || TIPOS_ARQUIVO.outro;
            return (
              <Card key={arq.id} className="p-3 flex items-center gap-3">
                <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium truncate">{arq.nome_arquivo}</span>
                    <Badge className={`text-[9px] ${tipoConfig.color}`}>{tipoConfig.label}</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span>{formatBytes(arq.tamanho_bytes)}</span>
                    <span>{new Date(arq.created_at).toLocaleDateString('pt-BR')}</span>
                    {arq.descricao && <span className="truncate">{arq.descricao}</span>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDownload(arq)} title="Baixar">
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleReplaceFile(arq)} disabled={replacingId === arq.id} title="Substituir arquivo + reextrair valores">
                    {replacingId === arq.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4 text-accent" />}
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(arq)} title="Editar">
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDelete(arq)} title="Excluir">
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Aditivos summary + list */}
      {aditivos.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground">Aditivos Registrados</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card className="p-3">
              <div className="text-[10px] text-muted-foreground mb-1">Acréscimos (R$)</div>
              <p className="text-sm font-bold text-success">{fmt(totalAcrescimo)}</p>
            </Card>
            <Card className="p-3">
              <div className="text-[10px] text-muted-foreground mb-1">Supressões (R$)</div>
              <p className="text-sm font-bold text-destructive">{fmt(totalSupressao)}</p>
            </Card>
            <Card className="p-3">
              <div className="text-[10px] text-muted-foreground mb-1">Saldo Valor</div>
              <p className={`text-sm font-bold ${saldoAditivos >= 0 ? 'text-success' : 'text-destructive'}`}>{fmt(saldoAditivos)}</p>
            </Card>
            <Card className="p-3">
              <div className="text-[10px] text-muted-foreground mb-1">Acrésc. Qtde</div>
              <p className="text-sm font-bold text-success">+{fmtQty(totalQtyAcrescimo)}</p>
            </Card>
            <Card className="p-3">
              <div className="text-[10px] text-muted-foreground mb-1">Supr. Qtde</div>
              <p className="text-sm font-bold text-destructive">-{fmtQty(totalQtySupressao)}</p>
            </Card>
            <Card className="p-3">
              <div className="text-[10px] text-muted-foreground mb-1">Saldo Qtde</div>
              <p className={`text-sm font-bold ${saldoQty >= 0 ? 'text-success' : 'text-destructive'}`}>{fmtQty(saldoQty)}</p>
            </Card>
          </div>

          {aditivos.map((a: any) => {
            const Icon = ADITIVO_ICON[a.tipo] || FilePlus2;
            const tipoLabel = { valor: 'Valor', quantidade: 'Quantidade', valor_quantidade: 'Valor e Qtde', prazo: 'Prazo', escopo: 'Escopo' }[a.tipo as string] || a.tipo;
            const saldoValor = (a.valor_acrescimo || 0) - (a.valor_supressao || 0);
            const saldoQtyItem = (a.quantidade_acrescimo || 0) - (a.quantidade_supressao || 0);
            return (
              <Card key={a.id} className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold">{a.numero_aditivo}</span>
                      <Badge variant="outline" className="text-[9px]">{tipoLabel}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {(a.valor_acrescimo || 0) > 0 && <span className="text-success">+{fmt(a.valor_acrescimo)}</span>}
                      {(a.valor_supressao || 0) > 0 && <span className="text-destructive">-{fmt(a.valor_supressao)}</span>}
                      {(a.quantidade_acrescimo || 0) > 0 && <span className="text-success">+{fmtQty(a.quantidade_acrescimo)} un</span>}
                      {(a.quantidade_supressao || 0) > 0 && <span className="text-destructive">-{fmtQty(a.quantidade_supressao)} un</span>}
                      {a.nova_data_fim && <span>Nova vigência: {new Date(a.nova_data_fim + 'T00:00:00').toLocaleDateString('pt-BR')}</span>}
                      {(a.data_assinatura || a.data_aditivo) && <span>Assinatura: {new Date((a.data_assinatura || a.data_aditivo) + 'T00:00:00').toLocaleDateString('pt-BR')}</span>}
                    </div>
                    {a.justificativa && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.justificativa}</p>}
                  </div>
                  <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => handleDeleteAditivo(a.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  <div className="rounded-lg border p-2">
                    <div className="text-[10px] text-muted-foreground mb-0.5">Acréscimos (R$)</div>
                    <p className="text-xs font-bold text-success">{fmt(a.valor_acrescimo || 0)}</p>
                  </div>
                  <div className="rounded-lg border p-2">
                    <div className="text-[10px] text-muted-foreground mb-0.5">Supressões (R$)</div>
                    <p className="text-xs font-bold text-destructive">{fmt(a.valor_supressao || 0)}</p>
                  </div>
                  <div className="rounded-lg border p-2">
                    <div className="text-[10px] text-muted-foreground mb-0.5">Saldo Valor</div>
                    <p className={`text-xs font-bold ${saldoValor >= 0 ? 'text-success' : 'text-destructive'}`}>{fmt(saldoValor)}</p>
                  </div>
                  <div className="rounded-lg border p-2">
                    <div className="text-[10px] text-muted-foreground mb-0.5">Acrésc. Qtde</div>
                    <p className="text-xs font-bold text-success">+{fmtQty(a.quantidade_acrescimo || 0)}</p>
                  </div>
                  <div className="rounded-lg border p-2">
                    <div className="text-[10px] text-muted-foreground mb-0.5">Supr. Qtde</div>
                    <p className="text-xs font-bold text-destructive">-{fmtQty(a.quantidade_supressao || 0)}</p>
                  </div>
                  <div className="rounded-lg border p-2">
                    <div className="text-[10px] text-muted-foreground mb-0.5">Saldo Qtde</div>
                    <p className={`text-xs font-bold ${saldoQtyItem >= 0 ? 'text-success' : 'text-destructive'}`}>{fmtQty(saldoQtyItem)}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={editDialog.open} onOpenChange={(v) => setEditDialog({ open: v, arquivo: v ? editDialog.arquivo : null })}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar Documento</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-xs">Tipo do Documento</Label>
              <Select value={editTipo} onValueChange={(v) => {
                setEditTipo(v);
                if (isAditivoType(v) && !editLinkedAditivoId) {
                  setEditAditivoForm(f => ({ ...f, numero_aditivo: f.numero_aditivo || `${aditivos.length + 1}º Aditivo` }));
                }
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPOS_ARQUIVO).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Descrição (opcional)</Label>
              <Input value={editDescricao} onChange={(e) => setEditDescricao(e.target.value)} placeholder="Ex: 1º Aditivo de Prazo" />
            </div>

            {/* Aditivo fields in edit */}
            {isAditivoType(editTipo) && (
              <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                <p className="text-xs font-semibold text-muted-foreground">Dados do Aditivo</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Nº/Identificação</Label>
                    <Input value={editAditivoForm.numero_aditivo} onChange={(e) => setEditAditivoForm(f => ({ ...f, numero_aditivo: e.target.value }))} placeholder="1º Aditivo" />
                  </div>
                  <div>
                    <Label className="text-xs">Data Assinatura</Label>
                    <Input type="date" value={editAditivoForm.data_assinatura} onChange={(e) => setEditAditivoForm(f => ({ ...f, data_assinatura: e.target.value }))} />
                  </div>

                  {showValueFields(editTipo) && (
                    <>
                      <div>
                        <Label className="text-xs">Valor Acréscimo (R$)</Label>
                        <Input type="number" step="0.01" value={editAditivoForm.valor_acrescimo} onChange={(e) => setEditAditivoForm(f => ({ ...f, valor_acrescimo: e.target.value }))} placeholder="0,00" />
                      </div>
                      <div>
                        <Label className="text-xs">Valor Supressão (R$)</Label>
                        <Input type="number" step="0.01" value={editAditivoForm.valor_supressao} onChange={(e) => setEditAditivoForm(f => ({ ...f, valor_supressao: e.target.value }))} placeholder="0,00" />
                      </div>
                    </>
                  )}

                  {showQtyFields(editTipo) && (
                    <>
                      <div>
                        <Label className="text-xs">Qtde Acréscimo</Label>
                        <Input type="number" step="1" value={editAditivoForm.quantidade_acrescimo} onChange={(e) => setEditAditivoForm(f => ({ ...f, quantidade_acrescimo: e.target.value }))} placeholder="0" />
                      </div>
                      <div>
                        <Label className="text-xs">Qtde Supressão</Label>
                        <Input type="number" step="1" value={editAditivoForm.quantidade_supressao} onChange={(e) => setEditAditivoForm(f => ({ ...f, quantidade_supressao: e.target.value }))} placeholder="0" />
                      </div>
                    </>
                  )}

                  {(showDateField(editTipo) || isAditivoType(editTipo)) && (
                    <div>
                      <Label className="text-xs">Nova Data Fim (se prorrogação)</Label>
                      <Input type="date" value={editAditivoForm.nova_data_fim} onChange={(e) => setEditAditivoForm(f => ({ ...f, nova_data_fim: e.target.value }))} />
                    </div>
                  )}

                  <div className="sm:col-span-2">
                    <Label className="text-xs">Justificativa / Fundamentação</Label>
                    <Textarea value={editAditivoForm.justificativa} onChange={(e) => setEditAditivoForm(f => ({ ...f, justificativa: e.target.value }))} rows={2} placeholder="Fundamentação legal do aditivo" />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs">Observações</Label>
                    <Textarea value={editAditivoForm.observacoes} onChange={(e) => setEditAditivoForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} />
                  </div>
                </div>

                {/* Preview */}
                {(showValueFields(editTipo) || showQtyFields(editTipo)) && (
                  <Card className="p-3 bg-muted/50">
                    <p className="text-[10px] text-muted-foreground mb-1 font-medium">Resumo do Aditivo</p>
                    <div className="flex flex-wrap gap-4 text-xs">
                      {showValueFields(editTipo) && (
                        <span className={`font-semibold ${(parseFloat(editAditivoForm.valor_acrescimo) || 0) - (parseFloat(editAditivoForm.valor_supressao) || 0) >= 0 ? 'text-success' : 'text-destructive'}`}>
                          Saldo Valor: {fmt((parseFloat(editAditivoForm.valor_acrescimo) || 0) - (parseFloat(editAditivoForm.valor_supressao) || 0))}
                        </span>
                      )}
                      {showQtyFields(editTipo) && (
                        <span className={`font-semibold ${(parseFloat(editAditivoForm.quantidade_acrescimo) || 0) - (parseFloat(editAditivoForm.quantidade_supressao) || 0) >= 0 ? 'text-success' : 'text-destructive'}`}>
                          Saldo Qtde: {fmtQty((parseFloat(editAditivoForm.quantidade_acrescimo) || 0) - (parseFloat(editAditivoForm.quantidade_supressao) || 0))}
                        </span>
                      )}
                    </div>
                  </Card>
                )}
              </div>
            )}

            <div>
              <Label className="text-xs">Substituir arquivo</Label>
              <div className="mt-1">
                <input ref={editFileRef} type="file" accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png" className="hidden" onChange={(e) => setEditFile(e.target.files?.[0] || null)} />
                <Button variant="outline" size="sm" onClick={() => editFileRef.current?.click()}>
                  <Upload className="w-4 h-4 mr-2" />
                  {editFile ? editFile.name : 'Selecionar novo arquivo'}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Deixe em branco para manter o arquivo atual.</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditDialog({ open: false, arquivo: null })}>Cancelar</Button>
              <Button onClick={handleSaveEdit} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* IA document detection dialog */}
      <DocumentDetectionDialog
        open={detectionOpen}
        onOpenChange={(o) => { setDetectionOpen(o); if (!o) { setDetection(null); setPendingFile(null); } }}
        detection={detection}
        parentTipoDocumento={parentTipoDocumento}
        fileName={detectionFileName}
        onCreateLinkedRegistry={handleCreateLinkedRegistry}
        onConfirmAditivo={handleConfirmAditivoFromDetection}
        onIgnore={handleDetectionIgnore}
      />
    </div>
  );
}
