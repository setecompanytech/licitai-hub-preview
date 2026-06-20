import { useState, useEffect, useCallback } from 'react';
import { Loader2, FileSearch, RefreshCw, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import EditalItensTable from '@/components/shared/EditalItensTable';
import ReextrairEditalButton from '@/components/shared/ReextrairEditalButton';
import RevisaoItensExtraidos from '@/components/precificacao/RevisaoItensExtraidos';
import { useEditalExtraction, type LicitacaoItem } from '@/hooks/useEditalExtraction';
import { toast } from 'sonner';

interface Props {
  licitacaoId: string | null;
}

export default function EditalItensViewer({ licitacaoId }: Props) {
  const { fetchItens, updateItem, deleteItem } = useEditalExtraction();
  const [itens, setItens] = useState<LicitacaoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [carregou, setCarregou] = useState(false);

  const carregar = useCallback(async () => {
    if (!licitacaoId) return;
    setLoading(true);
    try {
      const dados = await fetchItens(licitacaoId);
      setItens(dados);
    } finally {
      setLoading(false);
      setCarregou(true);
    }
  }, [licitacaoId, fetchItens]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (!licitacaoId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Package className="w-10 h-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">Nenhum processo selecionado.</p>
        <p className="text-xs text-muted-foreground/70 mt-1">Abra esta página a partir de um processo ativo.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (carregou && itens.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center py-10 text-center border-2 border-dashed border-border rounded-xl bg-muted/20">
          <FileSearch className="w-10 h-10 text-muted-foreground/40 mb-3" />
          <h3 className="text-sm font-semibold text-foreground mb-1">Nenhum item extraído ainda</h3>
          <p className="text-xs text-muted-foreground max-w-sm mb-4">
            Use a leitura automática para extrair os itens diretamente do edital, ou faça upload manual do arquivo.
          </p>
          <ReextrairEditalButton
            licitacaoId={licitacaoId}
            label="Extrair itens automaticamente"
            size="default"
            variant="default"
            onCompleted={carregar}
          />
        </div>

        <div className="border-t pt-5">
          <p className="text-xs text-muted-foreground mb-3 font-medium">Ou faça upload manual do edital:</p>
          <RevisaoItensExtraidos
            licitacaoId={licitacaoId}
            onAprovado={() => {
              toast.success('Itens salvos com sucesso!');
              carregar();
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">Itens do Edital</h3>
          <Badge variant="secondary">{itens.length} {itens.length === 1 ? 'item' : 'itens'}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={carregar} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <ReextrairEditalButton
            licitacaoId={licitacaoId}
            label="Reextrair"
            size="sm"
            variant="outline"
            onCompleted={carregar}
          />
        </div>
      </div>

      <EditalItensTable
        itens={itens}
        onUpdate={async (itemId, updates) => {
          await updateItem(itemId, updates);
          setItens(prev => prev.map(i => i.id === itemId ? { ...i, ...updates } : i));
        }}
        onDelete={async (itemId) => {
          await deleteItem(itemId);
          setItens(prev => prev.filter(i => i.id !== itemId));
        }}
        showOrigin
      />
    </div>
  );
}
