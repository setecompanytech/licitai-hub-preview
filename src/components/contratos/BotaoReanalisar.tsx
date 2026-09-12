import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ScanSearch } from 'lucide-react';

/**
 * "Reanalisar documentos anexados" — o atalho dos cards do Dashboard.
 *
 * Os PDFs do contrato JÁ estão no módulo (aba Arquivos) e a releitura já
 * existia lá, mas os cards vazios mandavam "reenviar o PDF" — retrabalho
 * apontado pelo dono em 12/09. Este botão deep-linka para a aba de arquivos
 * com o gatilho `reler=1`: o ContratoArquivos dispara a releitura do
 * documento principal sozinho, com a regra de sempre — a leitura só
 * preenche campo em branco, nunca sobrescreve correção manual.
 */
export default function BotaoReanalisar() {
  const [searchParams, setSearchParams] = useSearchParams();
  return (
    <Button
      size="sm"
      variant="outline"
      className="h-8 text-xs mt-1"
      onClick={() => {
        const next = new URLSearchParams(searchParams);
        next.set('aba', 'contratos-aditivos');
        next.set('reler', '1');
        setSearchParams(next);
      }}
    >
      <ScanSearch className="w-3.5 h-3.5 mr-1" />
      Reanalisar documentos anexados
    </Button>
  );
}
