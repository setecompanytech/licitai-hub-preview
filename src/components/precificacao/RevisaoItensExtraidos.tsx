import { useState, useCallback, useRef } from 'react';
// Extração traz o que o órgão escreveu: 'UNIDADE', 'UND', 'Unidade'. Sem
// normalizar na entrada, o mesmo conceito vira três no banco.
import { normalizarUnidade } from '@/lib/unidades';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import SeloPraefectusIA from '@/components/shared/SeloPraefectusIA';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { extractTextFromFile } from '@/lib/pdf-text-extractor';
import {
  Upload, Loader2, CheckCircle, AlertTriangle, XCircle,
  FileText, Sparkles, Trash2, RotateCcw,
} from 'lucide-react';

export interface ItemExtraido {
  id?: string;
  numero_item: number | null;
  numero_lote: number | null;
  codigo_catmat: string | null;
  descricao: string;
  unidade: string | null;
  quantidade: number | null;
  valor_unitario: number | null;
  valor_total: number | null;
  especificacoes: string | null;
  exclusivo_me_epp: boolean;
  confidence_score: number;
  erros: string[];
  warnings: string[];
  requer_revisao: boolean;
  status: string;
  marca: string | null;
  fabricante: string | null;
  modelo: string | null;
  lote: string | null;
  _editado?: boolean;
}

interface MetaExtracao {
  confianca_media: number;
  itens_com_erro: number;
  requer_revisao: boolean;
}

interface RevisaoItensExtraidosProps {
  licitacaoId?: string;
  empresaId?: string;
  onAprovado: (itens: ItemExtraido[]) => void;
  onClose?: () => void;
}

export default function RevisaoItensExtraidos({
  licitacaoId,
  empresaId,
  onAprovado,
  onClose,
}: RevisaoItensExtraidosProps) {
  const { user } = useAuth();
  const [itens, setItens] = useState<ItemExtraido[]>([]);
  const [fazendoUpload, setFazendoUpload] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [meta, setMeta] = useState<MetaExtracao | null>(null);
  const [fonte, setFonte] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const processarArquivo = useCallback(async (arquivo: File) => {
    setFazendoUpload(true);
    try {
      const ext = arquivo.name.substring(arquivo.name.lastIndexOf('.')).toLowerCase();
      const allowedExts = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.odt'];
      if (!allowedExts.includes(ext)) {
        toast.error('Formato não suportado. Use PDF, Word, Excel ou TXT.');
        return;
      }
      if (arquivo.size > 50 * 1024 * 1024) {
        toast.error('Arquivo muito grande. Máximo 50MB.');
        return;
      }

      // Extract text for the edge function
      let textoEdital = '';
      let pdfBase64: string | undefined;

      if (ext === '.pdf') {
        // Send PDF as base64 for Claude native processing
        const arrayBuffer = await arquivo.arrayBuffer();
        pdfBase64 = btoa(
          new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
      }

      // Also extract text as fallback
      try {
        textoEdital = await extractTextFromFile(arquivo);
      } catch {
        if (!pdfBase64) {
          toast.error('Não foi possível ler o documento.');
          return;
        }
      }

      const { data, error } = await supabase.functions.invoke('extrair-itens-edital', {
        body: {
          texto_edital: textoEdital,
          skip_min_length: !!pdfBase64,
          pdf_base64: pdfBase64,
        },
      });

      if (error || !data?.success) {
        toast.error(data?.error || error?.message || 'Erro ao extrair itens.');
        return;
      }

      const itensExtraidos: ItemExtraido[] = (data.data || []).map((item: any) => ({
        numero_item: item.item ? parseInt(String(item.item)) : null,
        numero_lote: item.numero_lote ?? null,
        codigo_catmat: item.codigo_catmat ?? item.catmat ?? null,
        descricao: item.descricao || '',
        unidade: normalizarUnidade(item.unidade) || 'UN',
        quantidade: item.quantidade ?? 1,
        valor_unitario: item.valor_unitario ?? 0,
        valor_total: item.valor_total ?? 0,
        especificacoes: item.especificacoes ?? null,
        exclusivo_me_epp: item.exclusivo_me_epp ?? false,
        confidence_score: item.confidence_score ?? 1,
        erros: item.erros || [],
        warnings: item.warnings || [],
        requer_revisao: item.requer_revisao ?? false,
        status: item.requer_revisao ? 'pendente_revisao' : 'aprovado',
        marca: item.marca ?? null,
        fabricante: item.fabricante ?? null,
        modelo: item.modelo ?? null,
        lote: item.lote ?? 'Único',
      }));

      setItens(itensExtraidos);
      setMeta(data.meta || null);
      setFonte(data.fonte || 'IA');
      toast.success(`${itensExtraidos.length} itens extraídos!`);
    } catch (err) {
      console.error('Erro na extração:', err);
      toast.error('Erro ao processar documento.');
    } finally {
      setFazendoUpload(false);
    }
  }, []);

  const editarItem = useCallback((idx: number, campo: string, valor: any) => {
    setItens(prev => prev.map((item, i) =>
      i === idx
        ? { ...item, [campo]: valor, _editado: true, status: 'editado_manualmente' }
        : item
    ));
  }, []);

  const removerItem = useCallback((idx: number) => {
    setItens(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const aprovarTodos = useCallback(async () => {
    if (!user) return;
    setSalvando(true);
    try {
      // Save to edital_itens_extraidos if licitacaoId provided
      if (licitacaoId) {
        // Clear previous extraction
        await supabase
          .from('edital_itens_extraidos' as any)
          .delete()
          .eq('licitacao_id', licitacaoId)
          .eq('user_id', user.id);

        const rows = itens.map(item => ({
          licitacao_id: licitacaoId,
          empresa_id: empresaId || null,
          user_id: user.id,
          numero_item: item.numero_item,
          numero_lote: item.numero_lote,
          codigo_catmat: item.codigo_catmat,
          descricao: item.descricao,
          unidade: item.unidade,
          quantidade: item.quantidade,
          valor_unitario: item.valor_unitario,
          valor_total: item.valor_total,
          especificacoes: item.especificacoes,
          exclusivo_me_epp: item.exclusivo_me_epp,
          confidence_score: item.confidence_score,
          erros: item.erros,
          warnings: item.warnings,
          requer_revisao: false,
          status: 'aprovado',
          estrategia_extracao: fonte,
          fonte_extracao: fonte,
          marca: item.marca,
          fabricante: item.fabricante,
          modelo: item.modelo,
          aprovado_por: user.id,
          aprovado_em: new Date().toISOString(),
        }));

        await supabase.from('edital_itens_extraidos' as any).insert(rows);
      }

      onAprovado(itens);
      toast.success(`${itens.length} itens aprovados!`);
    } catch (err) {
      toast.error('Erro ao salvar itens.');
    } finally {
      setSalvando(false);
    }
  }, [itens, user, licitacaoId, empresaId, fonte, onAprovado]);

  // Stats
  const valorTotal = itens.reduce((acc, i) => acc + (i.valor_total ?? 0), 0);
  const itensPendentes = itens.filter(i => i.requer_revisao).length;
  const confiancaMedia = itens.length > 0
    ? itens.reduce((acc, i) => acc + i.confidence_score, 0) / itens.length
    : 0;

  const formatCurrency = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      {/* Header — recurso de IA: o selo "Praefectus IA" identifica a extração. */}
      <div className="border-b border-border px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="flex flex-wrap items-center gap-2 text-base font-semibold leading-6 text-foreground">
              <Sparkles className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              Extração de Itens do Edital/TR
              <SeloPraefectusIA />
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              PDF · DOCX · XLSX — extração via Vision AI com validação matemática
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {itens.length > 0 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setItens([]); setMeta(null); }}
                >
                  <RotateCcw aria-hidden="true" /> Limpar
                </Button>
                <Button
                  size="sm"
                  onClick={aprovarTodos}
                  disabled={salvando}
                >
                  {salvando ? (
                    <><Loader2 className="animate-spin" aria-hidden="true" /> Salvando...</>
                  ) : (
                    <><CheckCircle aria-hidden="true" /> Aprovar {itens.length} itens</>
                  )}
                </Button>
              </>
            )}
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose} aria-label="Fechar">✕</Button>
            )}
          </div>
        </div>

        {/* Upload area — zona tracejada; arrastar acende a tinta da ação. */}
        {itens.length === 0 && (
          <div
            role="button"
            tabIndex={0}
            onClick={() => !fazendoUpload && fileRef.current?.click()}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && !fazendoUpload) {
                e.preventDefault();
                fileRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!fazendoUpload) setIsDragging(true);
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!fazendoUpload) setIsDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragging(false);
              if (fazendoUpload) return;
              const f = e.dataTransfer.files?.[0];
              if (f) processarArquivo(f);
            }}
            aria-disabled={fazendoUpload}
            className={`mt-4 flex w-full cursor-pointer flex-col items-center gap-3 rounded-lg border border-dashed p-8 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              isDragging
                ? 'border-primary bg-primary-tint'
                : 'border-input bg-card hover:border-primary/40 hover:bg-primary-tint'
            } ${fazendoUpload ? 'cursor-not-allowed opacity-50' : ''}`}
          >
            {fazendoUpload ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
                <span className="text-sm text-muted-foreground">
                  Processando documento com IA...
                </span>
              </>
            ) : (
              <>
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary-tint text-primary" aria-hidden="true">
                  <Upload className="h-6 w-6" />
                </span>
                <span className="text-base font-semibold text-foreground">
                  {isDragging ? 'Solte o arquivo aqui' : 'Clique ou arraste o Termo de Referência'}
                </span>
                <span className="text-xs text-muted-foreground">
                  PDF, DOCX ou XLSX — máx. 50MB
                </span>
              </>
            )}
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.odt,.txt"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) processarArquivo(f);
          }}
        />
      </div>

      {/* Meta stats */}
      {meta && itens.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 border-b border-border bg-secondary px-5 py-3 text-sm">
          <span className="text-muted-foreground">
            Fonte: <span className="font-medium text-foreground">{fonte}</span>
          </span>
          <span className="text-muted-foreground">
            Confiança:{' '}
            <span className={`font-semibold tabular-nums ${
              confiancaMedia >= 0.85 ? 'text-success-ink' :
              confiancaMedia >= 0.65 ? 'text-warning-ink' :
              'text-destructive-ink'
            }`}>
              {(confiancaMedia * 100).toFixed(0)}%
            </span>
          </span>
          {itensPendentes > 0 && (
            <Badge variant="warning">
              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
              {itensPendentes} {itensPendentes === 1 ? 'item requer' : 'itens requerem'} revisão
            </Badge>
          )}
          <span className="ml-auto text-muted-foreground">
            Total: <span className="font-semibold tabular-nums text-foreground">{formatCurrency(valorTotal)}</span>
          </span>
        </div>
      )}

      {/* Items table — tabela editável na anatomia v3: cabeçalho rebaixado,
          campos de 40px em célula `px-2 py-1.5`, números à direita. */}
      {itens.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">Nº</TableHead>
              <TableHead className="min-w-[220px]">Descrição</TableHead>
              <TableHead className="w-20">Un</TableHead>
              <TableHead className="w-24 text-right">Qtd</TableHead>
              <TableHead className="w-32 text-right">Vlr Unit.</TableHead>
              <TableHead className="w-28 text-right">Vlr Total</TableHead>
              <TableHead className="w-16 text-right">Conf.</TableHead>
              <TableHead className="w-20">Status</TableHead>
              <TableHead className="w-10"><span className="sr-only">Ações</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {itens.map((item, idx) => (
              <TableRow
                key={idx}
                className={
                  item.erros.length > 0 ? 'bg-destructive-tint/60' :
                  item.warnings.length > 0 ? 'bg-warning-tint/60' : ''
                }
              >
                <TableCell className="px-2 py-1.5 tabular-nums text-muted-foreground">
                  {item.numero_lote ? `L${item.numero_lote}` : item.numero_item ?? '?'}
                </TableCell>

                <TableCell className="px-2 py-1.5">
                  <Input
                    aria-label="Descrição do item"
                    defaultValue={item.descricao}
                    onBlur={e => editarItem(idx, 'descricao', e.target.value)}
                    className="min-w-[220px]"
                  />
                  {item.codigo_catmat && (
                    <span className="mt-1 block text-xs text-muted-foreground tabular-nums">
                      CATMAT: {item.codigo_catmat}
                    </span>
                  )}
                  {item.erros.map((e, i) => (
                    <div key={i} className="mt-0.5 flex items-center gap-1 text-xs text-destructive-ink">
                      <XCircle className="h-3 w-3 shrink-0" aria-hidden="true" /> {e}
                    </div>
                  ))}
                  {item.warnings.map((w, i) => (
                    <div key={i} className="mt-0.5 flex items-center gap-1 text-xs text-warning-ink">
                      <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" /> {w}
                    </div>
                  ))}
                </TableCell>

                <TableCell className="px-2 py-1.5">
                  <Input
                    aria-label="Unidade"
                    defaultValue={item.unidade ?? ''}
                    onBlur={e => editarItem(idx, 'unidade', e.target.value)}
                    className="w-20"
                  />
                </TableCell>

                <TableCell className="px-2 py-1.5">
                  <Input
                    aria-label="Quantidade"
                    type="number"
                    defaultValue={item.quantidade ?? ''}
                    onBlur={e => editarItem(idx, 'quantidade', parseFloat(e.target.value))}
                    className="ml-auto w-24 text-right tabular-nums"
                  />
                </TableCell>

                <TableCell className="px-2 py-1.5">
                  <Input
                    aria-label="Valor unitário"
                    type="text"
                    inputMode="decimal"
                    defaultValue={item.valor_unitario != null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor_unitario) : ''}
                    onBlur={e => {
                      const digits = e.target.value.replace(/\D/g, '');
                      const v = digits ? parseInt(digits, 10) / 100 : 0;
                      editarItem(idx, 'valor_unitario', v);
                      e.target.value = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
                    }}
                    className="ml-auto w-32 text-right tabular-nums"
                  />
                </TableCell>

                <TableCell className="px-2 py-1.5 text-right font-semibold tabular-nums text-foreground" nowrap>
                  {item.valor_total ? formatCurrency(item.valor_total) : '—'}
                </TableCell>

                <TableCell className="px-2 py-1.5 text-right">
                  <span className={`text-sm font-semibold tabular-nums ${
                    item.confidence_score >= 0.85 ? 'text-success-ink' :
                    item.confidence_score >= 0.65 ? 'text-warning-ink' :
                    'text-destructive-ink'
                  }`}>
                    {(item.confidence_score * 100).toFixed(0)}%
                  </span>
                </TableCell>

                <TableCell className="px-2 py-1.5">
                  {item._editado ? (
                    <Badge variant="info">editado</Badge>
                  ) : item.erros.length > 0 ? (
                    <Badge variant="danger">erro</Badge>
                  ) : item.requer_revisao ? (
                    <Badge variant="warning">revisar</Badge>
                  ) : (
                    <Badge variant="success">ok</Badge>
                  )}
                </TableCell>

                <TableCell className="px-2 py-1.5 text-right">
                  <Button
                    variant="ghost-destructive"
                    size="icon-sm"
                    onClick={() => removerItem(idx)}
                    aria-label={`Remover item ${item.numero_item ?? idx + 1}`}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
