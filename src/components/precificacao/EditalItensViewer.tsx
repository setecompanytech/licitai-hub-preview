import { useState, useEffect, useCallback } from 'react';
import { FileSearch, RefreshCw, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import EditalItensTable from '@/components/shared/EditalItensTable';
import ReextrairEditalButton from '@/components/shared/ReextrairEditalButton';
import RevisaoItensExtraidos from '@/components/precificacao/RevisaoItensExtraidos';
import { useEditalExtraction, type LicitacaoItem } from '@/hooks/useEditalExtraction';
import { useSugestaoMarcas } from '@/hooks/useSugestaoMarcas';
import { toast } from 'sonner';

interface Props {
  licitacaoId: string | null;
}

export default function EditalItensViewer({ licitacaoId }: Props) {
  const { fetchItens, updateItem, deleteItem } = useEditalExtraction();
  const { sugestoesPorItem, fetchSugestoes } = useSugestaoMarcas();
  const [itens, setItens] = useState<LicitacaoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [carregou, setCarregou] = useState(false);

  const carregar = useCallback(async () => {
    if (!licitacaoId) return;
    setLoading(true);
    try {
      const dados = await fetchItens(licitacaoId);
      setItens(dados);
      fetchSugestoes(licitacaoId);
    } finally {
      setLoading(false);
      setCarregou(true);
    }
  }, [licitacaoId, fetchItens, fetchSugestoes]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (!licitacaoId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-tint text-primary">
          <Package className="w-6 h-6" aria-hidden="true" />
        </span>
        <p className="mt-4 text-lg font-semibold">Nenhum processo selecionado</p>
        <p className="mt-1 text-sm text-muted-foreground">Abra esta página a partir de um processo ativo.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-2 py-4" role="status" aria-label="Carregando itens do edital">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (carregou && itens.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-tint text-primary">
            <FileSearch className="w-6 h-6" aria-hidden="true" />
          </span>
          <h3 className="mt-4 text-lg font-semibold text-foreground">Nenhum item extraído ainda</h3>
          <p className="mt-1 mb-4 max-w-sm text-sm text-muted-foreground">
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

        <div className="border-t border-border pt-6">
          <p className="mb-3 text-sm font-medium text-muted-foreground">Ou faça upload manual do edital:</p>
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Itens do Edital</h3>
          <Badge variant="info">{itens.length} {itens.length === 1 ? 'item' : 'itens'}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="ghost" onClick={carregar} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
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
        sugestoesPorItem={sugestoesPorItem}
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
