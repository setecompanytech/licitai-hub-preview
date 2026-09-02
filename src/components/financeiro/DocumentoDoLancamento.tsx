import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Paperclip, Loader2, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useDocumentoFiscal } from '@/hooks/useDocumentoFiscal';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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

export function useDocumentosPorLancamento() {
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

type Props = {
  lancamentoId: string;
  /** Do lançamento, para enriquecer o registro do documento. Opcionais. */
  tipoDocumento?: string | null;
  numeroDocumento?: string | null;
  dataEmissao?: string | null;
  valorTotal?: number | null;
  /** A nota EXIGE documento? NF-e e NFS-e sim; tarifa bancária não. */
  exigeDocumento?: boolean;
};

export default function DocumentoDoLancamento({
  lancamentoId, tipoDocumento, numeroDocumento, dataEmissao, valorTotal, exigeDocumento,
}: Props) {
  const { data: mapa } = useDocumentosPorLancamento();
  const { abrirArquivo, guardarArquivo } = useDocumentoFiscal();
  const [abrindo, setAbrindo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const doc = mapa?.[lancamentoId];

  /**
   * Anexar a um lançamento que JÁ existe.
   *
   * Sem isto, a conferência apontaria "nota sem documento" para um lançamento
   * que ninguém consegue corrigir: o único caminho que guardava arquivo era o
   * de CRIAR lançamento, e reenviar o PDF por lá geraria um segundo lançamento
   * do mesmo valor — pior que o problema original.
   *
   * Aviso que aponta para porta fechada vira ruído em duas semanas: a pessoa
   * aprende que aquilo não tem saída e para de ler o painel inteiro.
   */
  const anexar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      toast.error('Arquivo acima de 15 MB.');
      return;
    }
    setEnviando(true);
    const ehXml = /\.xml$/i.test(file.name);
    const salvo = await guardarArquivo(file, {
      tipo: tipoDocumento ?? 'outro',
      numero: numeroDocumento ?? null,
      data_emissao: dataEmissao ?? null,
      valor_total: valorTotal ?? 0,
      lancamento_id: lancamentoId,
      arquivo_xml: ehXml ? await file.text().catch(() => null) : null,
    });
    setEnviando(false);
    if (!salvo) {
      toast.error('Não foi possível guardar o documento.', {
        description: 'O lançamento não foi alterado. Tente de novo.',
      });
      return;
    }
    toast.success('Documento guardado e vinculado ao lançamento.');
    void qc.invalidateQueries({ queryKey: ['fin-documentos-por-lancamento'] });
    void qc.invalidateQueries({ queryKey: ['fin-conferencia'] });
  };

  // Sem documento: oferece anexar — em destaque quando a nota exige.
  if (!doc) {
    return (
      <>
        <input ref={entrada} type="file" className="hidden" onChange={anexar}
          accept=".pdf,.xml,.jpg,.jpeg,.png" />
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => entrada.current?.click()}
                disabled={enviando}
                className={cn(
                  'transition-colors',
                  exigeDocumento
                    ? 'text-warning hover:text-warning/80'
                    : 'text-muted-foreground/40 hover:text-muted-foreground',
                )}
                aria-label="Anexar documento a este lançamento"
              >
                {enviando
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Upload className="w-3.5 h-3.5" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p className="text-xs">
                {exigeDocumento
                  ? 'Nota fiscal sem o documento guardado — anexar'
                  : 'Anexar documento'}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </>
    );
  }

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
