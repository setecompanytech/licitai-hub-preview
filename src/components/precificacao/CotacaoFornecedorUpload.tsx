import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, Loader2, X, CheckCircle, Trash2, Eye, Calendar, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { streamAIChat } from '@/lib/ai-stream';

type CotacaoItem = {
  descricao: string;
  quantidade: number;
  unidade: string;
  preco_unitario: number;
  preco_total: number;
  marca?: string;
  modelo?: string;
};

type CotacaoExtraida = {
  id?: string;
  nome_fornecedor: string;
  cnpj_fornecedor?: string;
  data_cotacao?: string;
  validade_dias?: number;
  itens: CotacaoItem[];
  arquivo_nome: string;
};

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function CotacaoFornecedorUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [cotacoes, setCotacoes] = useState<CotacaoExtraida[]>([]);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  const loadSavedCotacoes = async () => {
    if (!user) return;
    setLoadingSaved(true);
    const { data, error } = await supabase
      .from('cotacoes_fornecedor')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (!error && data) {
      setCotacoes(data.map((d: any) => ({
        id: d.id,
        nome_fornecedor: d.nome_fornecedor,
        cnpj_fornecedor: d.cnpj_fornecedor,
        data_cotacao: d.data_cotacao,
        validade_dias: d.validade_dias,
        itens: (d.itens as CotacaoItem[]) || [],
        arquivo_nome: d.arquivo_nome,
      })));
    }
    setLoadingSaved(false);
  };

  // Load on first render
  useState(() => { loadSavedCotacoes(); });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 10MB.');
      return;
    }
    setFile(f);
  };

  const handleExtract = async () => {
    if (!file || !user) return;
    setIsExtracting(true);

    const text = await file.text();
    const truncated = text.slice(0, 15000);
    let content = '';

    await streamAIChat({
      messages: [{
        role: 'user',
        content: `Analise esta cotação/proposta de fornecedor e extraia os dados em JSON:
{
  "nome_fornecedor": "razão social",
  "cnpj_fornecedor": "CNPJ se encontrado",
  "data_cotacao": "YYYY-MM-DD se encontrado",
  "validade_dias": 30,
  "itens": [
    {
      "descricao": "descrição do produto/serviço",
      "quantidade": 1,
      "unidade": "UN",
      "preco_unitario": 0.00,
      "preco_total": 0.00,
      "marca": "marca se encontrado",
      "modelo": "modelo se encontrado"
    }
  ]
}

Retorne APENAS o JSON. Para campos não encontrados, use valores padrão razoáveis.

DOCUMENTO:
${truncated}`
      }],
      action: 'analise_edital',
      onDelta: (chunk) => { content += chunk; },
      onDone: async () => {
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            toast.error('Não foi possível extrair dados da cotação.');
            setIsExtracting(false);
            return;
          }

          const parsed = JSON.parse(jsonMatch[0]);
          const cotacao: CotacaoExtraida = {
            nome_fornecedor: parsed.nome_fornecedor || file.name,
            cnpj_fornecedor: parsed.cnpj_fornecedor || '',
            data_cotacao: parsed.data_cotacao || new Date().toISOString().slice(0, 10),
            validade_dias: parsed.validade_dias || 30,
            itens: (parsed.itens || []).map((item: any) => ({
              descricao: item.descricao || '',
              quantidade: Number(item.quantidade) || 1,
              unidade: item.unidade || 'UN',
              preco_unitario: Number(item.preco_unitario) || 0,
              preco_total: Number(item.preco_total) || 0,
              marca: item.marca || '',
              modelo: item.modelo || '',
            })),
            arquivo_nome: file.name,
          };

          // Save to DB
          const { data: saved, error } = await supabase.from('cotacoes_fornecedor').insert({
            user_id: user.id,
            nome_fornecedor: cotacao.nome_fornecedor,
            cnpj_fornecedor: cotacao.cnpj_fornecedor,
            arquivo_nome: cotacao.arquivo_nome,
            data_cotacao: cotacao.data_cotacao,
            validade_dias: cotacao.validade_dias,
            itens: cotacao.itens as any,
          }).select().single();

          if (error) {
            console.error('Erro ao salvar:', error);
            toast.error('Cotação extraída mas não foi possível salvar.');
          } else {
            cotacao.id = saved.id;
            toast.success(`Cotação de "${cotacao.nome_fornecedor}" extraída com ${cotacao.itens.length} itens!`);
          }

          setCotacoes(prev => [cotacao, ...prev]);
          setFile(null);
          if (fileRef.current) fileRef.current.value = '';
        } catch (e) {
          console.error(e);
          toast.error('Erro ao processar dados da cotação.');
        }
        setIsExtracting(false);
      },
      onError: (err) => {
        toast.error(err);
        setIsExtracting(false);
      },
    });
  };

  const handleDelete = async (idx: number) => {
    const cotacao = cotacoes[idx];
    if (cotacao.id) {
      await supabase.from('cotacoes_fornecedor').delete().eq('id', cotacao.id);
    }
    setCotacoes(prev => prev.filter((_, i) => i !== idx));
    toast.success('Cotação removida.');
  };

  const totalItens = cotacoes.reduce((sum, c) => sum + c.itens.length, 0);

  return (
    <div className="space-y-4">
      {/* Upload area */}
      <div className="flex gap-2 items-end">
        {file ? (
          <div className="flex items-center gap-3 flex-1 bg-muted/30 rounded-lg p-3 border border-border/50">
            <FileText className="w-6 h-6 text-accent flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
            </div>
            <Button size="sm" onClick={handleExtract} disabled={isExtracting}>
              {isExtracting ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Extraindo...</>
              ) : (
                <><CheckCircle className="w-4 h-4 mr-1" /> Extrair Preços</>
              )}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex-1 border-2 border-dashed border-border rounded-lg p-4 flex items-center gap-3 hover:border-accent/50 hover:bg-muted/30 transition-colors"
          >
            <Upload className="w-6 h-6 text-muted-foreground" />
            <div>
              <span className="text-sm font-medium text-foreground">Enviar cotação de fornecedor (PDF)</span>
              <span className="text-xs text-muted-foreground block">A IA extrairá produtos, preços e dados do fornecedor automaticamente</span>
            </div>
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Stats */}
      {cotacoes.length > 0 && (
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>{cotacoes.length} cotações carregadas</span>
          <span>·</span>
          <span>{totalItens} itens no total</span>
        </div>
      )}

      {/* Cotações list */}
      {cotacoes.map((cotacao, idx) => (
        <div key={cotacao.id || idx} className="bg-card border border-border/40 rounded-lg overflow-hidden">
          <div
            className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30 transition-colors"
            onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <FileText className="w-5 h-5 text-accent flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{cotacao.nome_fornecedor}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {cotacao.cnpj_fornecedor && <span>{cotacao.cnpj_fornecedor}</span>}
                  {cotacao.data_cotacao && (
                    <span className="flex items-center gap-0.5">
                      <Calendar className="w-3 h-3" />
                      {new Date(cotacao.data_cotacao + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </span>
                  )}
                  <Badge variant="outline" className="text-[10px]">{cotacao.itens.length} itens</Badge>
                </div>
              </div>
            </div>
            <div className="flex gap-1 ml-2">
              <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setExpandedIdx(expandedIdx === idx ? null : idx); }}>
                <Eye className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={(e) => { e.stopPropagation(); handleDelete(idx); }}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {expandedIdx === idx && cotacao.itens.length > 0 && (
            <div className="border-t border-border/30 divide-y divide-border/20">
              {cotacao.itens.map((item, j) => (
                <div key={j} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{item.descricao}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.quantidade} {item.unidade}
                      {item.marca && ` · ${item.marca}`}
                      {item.modelo && ` · ${item.modelo}`}
                    </p>
                  </div>
                  <div className="text-right ml-3 flex-shrink-0">
                    <p className="font-semibold">{formatCurrency(item.preco_unitario)}</p>
                    {item.preco_total > 0 && (
                      <p className="text-xs text-muted-foreground">Total: {formatCurrency(item.preco_total)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Empty state */}
      {cotacoes.length === 0 && !file && !loadingSaved && (
        <div className="text-center py-6 text-muted-foreground">
          <Building2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhuma cotação de fornecedor carregada</p>
          <p className="text-xs mt-1">Envie PDFs de cotações para extrair preços automaticamente</p>
        </div>
      )}
    </div>
  );
}
