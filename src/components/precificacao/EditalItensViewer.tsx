import { useState, useEffect, useCallback } from 'react';
import { FileSearch, RefreshCw, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import EstadoVazio from '@/components/shared/EstadoVazio';
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
      <EstadoVazio
        icone={<Package />}
        titulo="Nenhum processo selecionado"
        descricao="Abra esta página a partir de um processo ativo."
      />
    );
  }

  if (loading) {
    return (
      /* Esqueleto na forma da tabela: cabeçalho de 44px e linhas de 48px. */
      <div className="space-y-2 py-4" role="status" aria-label="Carregando itens do edital">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (carregou && itens.length === 0) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-dashed border-border bg-secondary">
          <EstadoVazio
            icone={<FileSearch />}
            titulo="Nenhum item extraído ainda"
            descricao="Use a leitura automática para extrair os itens diretamente do edital, ou faça upload manual do arquivo."
            acao={
              <ReextrairEditalButton
                licitacaoId={licitacaoId}
                label="Extrair itens automaticamente"
                size="default"
                variant="default"
                onCompleted={carregar}
              />
            }
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
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold leading-6 text-foreground">Itens do Edital</h3>
          <Badge variant="info" className="tabular-nums">{itens.length} {itens.length === 1 ? 'item' : 'itens'}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="ghost" onClick={carregar} disabled={loading}>
            <RefreshCw className={loading ? 'animate-spin' : ''} aria-hidden="true" />
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
