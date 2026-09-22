import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Search, AlertTriangle, Loader2, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import EspelhoDoComprovante from './EspelhoDoComprovante';
import PresencaFederal from './PresencaFederal';
import type { DadosDoEspelho } from '@/lib/concorrentes/espelho-do-comprovante';

/**
 * Consulta de CNPJ — componente interno da aba "Consulta CNPJ" da tela
 * Concorrentes: começa direto no conteúdo, sem cabeçalho de página.
 *
 * Um quadro só (22/09, tarde): o espelho do comprovante da Receita. O cartão
 * de resumo que vinha antes dele repetia os mesmos campos noutra ordem, e o
 * dono pediu fidelidade ao documento oficial, não duas leituras da mesma
 * consulta. A impressão e o PDF saem do próprio espelho. Abaixo, a ficha do
 * CNPJ no governo federal, que é outra fonte (Portal da Transparência).
 */
export default function ConsultaCNPJ() {
  const [cnpjInput, setCnpjInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<DadosDoEspelho | null>(null);
  const [erro, setErro] = useState('');

  const handleConsultar = async () => {
    const cnpjLimpo = cnpjInput.replace(/\D/g, '');
    if (cnpjLimpo.length !== 14) {
      setErro('CNPJ deve conter 14 dígitos');
      return;
    }
    setErro('');
    setLoading(true);
    setResultado(null);

    try {
      const { data, error } = await supabase.functions.invoke('consulta-cnpj', {
        body: { cnpj: cnpjLimpo },
      });

      if (error) throw error;
      if (data.error) {
        setErro(data.error);
      } else {
        // A hora da consulta vai para o rodapé do espelho; a edge nova já a
        // manda, a antiga não.
        setResultado({ ...data, consultadoEm: data.consultadoEm ?? new Date().toISOString() });
        toast.success('CNPJ consultado com sucesso!');
      }
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao consultar CNPJ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold leading-6 text-foreground">
          <Search className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          Consulta de CNPJ — Receita Federal (BrasilAPI)
        </h2>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-md">
            <Label htmlFor="cnpj-consulta">CNPJ</Label>
            <Input
              id="cnpj-consulta"
              placeholder="Ex.: 12.345.678/0001-01"
              value={cnpjInput}
              inputMode="numeric"
              aria-invalid={erro ? true : undefined}
              onChange={(e) => setCnpjInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleConsultar()}
            />
          </div>
          <Button onClick={handleConsultar} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {loading ? 'Consultando…' : 'Consultar'}
          </Button>
        </div>

        {erro && (
          <Alert variant="destructive" className="mt-4">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <AlertDescription>{erro}</AlertDescription>
          </Alert>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <a href="https://brasilapi.com.br" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
            <ExternalLink className="h-3 w-3" aria-hidden="true" /> BrasilAPI
          </a>
          <a href="https://servicos.receita.fazenda.gov.br/servicos/cnpjreva/cnpjreva_solicitacao.asp" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
            <ExternalLink className="h-3 w-3" aria-hidden="true" /> Receita Federal
          </a>
        </div>
      </Card>

      {/* O formulário da Receita, com tudo que a fonte entrega (22/09) — o único quadro da consulta. */}
      {resultado && <EspelhoDoComprovante dados={resultado} />}

      {/* A ficha do CNPJ no governo federal, pelo Portal da Transparência. */}
      {resultado && <PresencaFederal cnpj={resultado.cnpj} />}
    </div>
  );
}
