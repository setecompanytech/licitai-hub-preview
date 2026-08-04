import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
        unidade: item.unidade || 'UN',
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
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-foreground font-semibold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-accent" />
              Extração de Itens do Edital/TR
            </h2>
            <p className="text-muted-foreground text-xs mt-0.5">
              PDF · DOCX · XLSX — extração via Vision AI com validação matemática
            </p>
          </div>
          <div className="flex gap-2">
            {itens.length > 0 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setItens([]); setMeta(null); }}
                >
                  <RotateCcw className="w-4 h-4 mr-1" /> Limpar
                </Button>
                <Button
                  size="sm"
                  onClick={aprovarTodos}
                  disabled={salvando}
                  className="bg-accent hover:bg-accent/90 text-accent-foreground"
                >
                  {salvando ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Salvando...</>
                  ) : (
                    <><CheckCircle className="w-4 h-4 mr-1" /> Aprovar {itens.length} itens</>
                  )}
                </Button>
              </>
            )}
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
            )}
          </div>
        </div>

        {/* Upload area */}
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
            className={`mt-4 w-full border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 transition-colors cursor-pointer ${
              isDragging
                ? 'border-accent bg-accent/10'
                : 'border-border hover:border-accent/50 hover:bg-muted/30'
            } ${fazendoUpload ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {fazendoUpload ? (
              <>
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
                <span className="text-muted-foreground text-sm">
                  Processando documento com IA...
                </span>
              </>
            ) : (
              <>
                <Upload className="w-8 h-8 text-muted-foreground" />
                <span className="text-foreground text-sm font-medium">
                  {isDragging ? 'Solte o arquivo aqui' : 'Clique ou arraste o Termo de Referência'}
                </span>
                <span className="text-muted-foreground text-xs">
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
        <div className="px-6 py-3 bg-muted/30 border-b border-border flex flex-wrap items-center gap-4 text-xs">
          <span className="text-muted-foreground">
            Fonte: <span className="text-foreground font-mono">{fonte}</span>
          </span>
          <span className="text-muted-foreground">
            Confiança:{' '}
            <span className={
              confiancaMedia >= 0.85 ? 'text-success' :
              confiancaMedia >= 0.65 ? 'text-warning' :
              'text-destructive'
            }>
              {(confiancaMedia * 100).toFixed(0)}%
            </span>
          </span>
          {itensPendentes > 0 && (
            <Badge variant="outline" className="text-warning border-warning/30">
              <AlertTriangle className="w-3 h-3 mr-1" />
              {itensPendentes} {itensPendentes === 1 ? 'item requer' : 'itens requerem'} revisão
            </Badge>
          )}
          <span className="ml-auto text-muted-foreground">
            Total: <span className="text-accent font-mono font-semibold">{formatCurrency(valorTotal)}</span>
          </span>
        </div>
      )}

      {/* Items table */}
      {itens.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground border-b border-border bg-muted/20">
                <th className="px-3 py-2 text-left w-10">Nº</th>
                <th className="px-3 py-2 text-left">Descrição</th>
                <th className="px-3 py-2 text-center w-14">Un</th>
                <th className="px-3 py-2 text-right w-16">Qtd</th>
                <th className="px-3 py-2 text-right w-24">Vlr Unit.</th>
                <th className="px-3 py-2 text-right w-24">Vlr Total</th>
                <th className="px-3 py-2 text-center w-14">Conf.</th>
                <th className="px-3 py-2 text-center w-16">Status</th>
                <th className="px-3 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {itens.map((item, idx) => (
                <tr
                  key={idx}
                  className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${
                    item.erros.length > 0 ? 'bg-destructive/5' :
                    item.warnings.length > 0 ? 'bg-warning/5' : ''
                  }`}
                >
                  <td className="px-3 py-2 text-muted-foreground font-mono">
                    {item.numero_lote ? `L${item.numero_lote}` : item.numero_item ?? '?'}
                  </td>

                  <td className="px-3 py-2">
                    <input
                      defaultValue={item.descricao}
                      onBlur={e => editarItem(idx, 'descricao', e.target.value)}
                      className="w-full bg-transparent text-foreground border-b border-transparent hover:border-border focus:border-accent outline-none px-0 py-0.5 text-xs"
                    />
                    {item.codigo_catmat && (
                      <span className="text-muted-foreground font-mono text-xs">
                        CATMAT: {item.codigo_catmat}
                      </span>
                    )}
                    {item.erros.map((e, i) => (
                      <div key={i} className="text-destructive mt-0.5 flex items-center gap-1">
                        <XCircle className="w-3 h-3 shrink-0" /> {e}
                      </div>
                    ))}
                    {item.warnings.map((w, i) => (
                      <div key={i} className="text-warning mt-0.5 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 shrink-0" /> {w}
                      </div>
                    ))}
                  </td>

                  <td className="px-3 py-2 text-center">
                    <input
                      defaultValue={item.unidade ?? ''}
                      onBlur={e => editarItem(idx, 'unidade', e.target.value)}
                      className="w-full text-center bg-transparent text-foreground border-b border-transparent hover:border-border focus:border-accent outline-none text-xs"
                    />
                  </td>

                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      defaultValue={item.quantidade ?? ''}
                      onBlur={e => editarItem(idx, 'quantidade', parseFloat(e.target.value))}
                      className="w-full text-right bg-transparent text-foreground font-mono border-b border-transparent hover:border-border focus:border-accent outline-none text-xs"
                    />
                  </td>

                  <td className="px-3 py-2 text-right">
                    <input
                      type="text"
                      inputMode="decimal"
                      defaultValue={item.valor_unitario != null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor_unitario) : ''}
                      onBlur={e => {
                        const digits = e.target.value.replace(/\D/g, '');
                        const v = digits ? parseInt(digits, 10) / 100 : 0;
                        editarItem(idx, 'valor_unitario', v);
                        e.target.value = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
                      }}
                      className="w-full text-right bg-transparent text-foreground font-mono border-b border-transparent hover:border-border focus:border-accent outline-none text-xs"
                    />
                  </td>

                  <td className="px-3 py-2 text-right font-mono text-accent font-semibold">
                    {item.valor_total ? formatCurrency(item.valor_total) : '—'}
                  </td>

                  <td className="px-3 py-2 text-center">
                    <span className={`font-mono text-xs font-semibold ${
                      item.confidence_score >= 0.85 ? 'text-success' :
                      item.confidence_score >= 0.65 ? 'text-warning' :
                      'text-destructive'
                    }`}>
                      {(item.confidence_score * 100).toFixed(0)}%
                    </span>
                  </td>

                  <td className="px-3 py-2 text-center">
                    {item._editado ? (
                      <Badge variant="outline" className="text-info text-xs">editado</Badge>
                    ) : item.erros.length > 0 ? (
                      <Badge variant="outline" className="text-destructive text-xs">erro</Badge>
                    ) : item.requer_revisao ? (
                      <Badge variant="outline" className="text-warning text-xs">revisar</Badge>
                    ) : (
                      <Badge variant="outline" className="text-success text-xs">ok</Badge>
                    )}
                  </td>

                  <td className="px-1 py-2">
                    <button
                      onClick={() => removerItem(idx)}
                      className="text-muted-foreground hover:text-destructive transition-colors p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
