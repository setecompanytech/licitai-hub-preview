import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Paperclip, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useDocumentoFiscal } from '@/hooks/useDocumentoFiscal';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';

/**
 * O clipe que abre o documento original do lançamento.
 *
 * Guardar a nota não serve de nada se ninguém a encontra depois. O momento em
 * que ela é procurada é sempre o mesmo: alguém está olhando o lançamento e
 * quer ver o papel que o originou — para conferir um valor, para responder a
 * um questionamento do órgão, para checar o que a leitura automática entendeu.
 *
 * Por isso o acesso mora na linha do lançamento, e não numa tela separada de
 * "arquivos". Uma pasta de documentos que não aponta para os lançamentos é
 * arquivo morto: existe, e ninguém abre.
 *
 * Uma consulta por empresa, cacheada, em vez de uma por linha — a tabela tem
 * centenas de lançamentos e uma requisição por linha derrubaria a rolagem.
 */

type DocumentoLinha = { id: string; lancamento_id: string; storage_path: string; arquivo_nome: string };

function useDocumentosPorLancamento() {
  const { empresaAtiva } = useEmpresa();
  return useQuery({
    queryKey: ['fin-documentos-por-lancamento', empresaAtiva?.id],
    enabled: !!empresaAtiva?.id,
    staleTime: 60_000,
    queryFn: async (): Promise<Record<string, DocumentoLinha>> => {
      const { data, error } = await supabase
        .from('financeiro_documentos_fiscais' as never)
        .select('id, lancamento_id, storage_path, arquivo_nome')
        .eq('empresa_id', empresaAtiva!.id)
        .not('lancamento_id', 'is', null)
        .not('storage_path', 'is', null);
      if (error) throw error;
      const mapa: Record<string, DocumentoLinha> = {};
      for (const d of (data ?? []) as unknown as DocumentoLinha[]) mapa[d.lancamento_id] = d;
      return mapa;
    },
  });
}

export default function DocumentoDoLancamento({ lancamentoId }: { lancamentoId: string }) {
  const { data: mapa } = useDocumentosPorLancamento();
  const { abrirArquivo } = useDocumentoFiscal();
  const [abrindo, setAbrindo] = useState(false);

  const doc = mapa?.[lancamentoId];
  if (!doc) return null;

  const abrir = async () => {
    setAbrindo(true);
    const url = await abrirArquivo(doc.storage_path);
    setAbrindo(false);
    if (!url) {
      // Falha ao abrir não pode ser um clique que não faz nada: quem clicou
      // precisa saber que o documento existe e que o acesso é que falhou.
      toast.error('Não foi possível abrir o documento.', {
        description: 'O arquivo está guardado, mas o link de acesso falhou. Tente de novo.',
      });
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={abrir}
            disabled={abrindo}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label={`Abrir documento ${doc.arquivo_nome}`}
          >
            {abrindo
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Paperclip className="w-3.5 h-3.5" />}
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p className="text-xs">{doc.arquivo_nome}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
