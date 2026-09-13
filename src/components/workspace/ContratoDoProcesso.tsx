import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileSignature, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { rotuloDaAta, rotuloDoContrato } from '@/lib/contratos/rotulos';

/**
 * O contrato que nasceu deste processo, visto de dentro da pasta.
 *
 * O elo existia no banco desde sempre (`contratos.licitacao_id`), mas nenhuma
 * tela o usava: o contrato não dizia de onde veio e o processo não sabia que
 * havia virado contrato. Diante de um impasse — o órgão cobra algo que o
 * contrato não prevê —, a resposta costuma estar no edital, e achá-lo era
 * busca manual.
 *
 * Só aparece quando há contrato vinculado. Contrato antigo, cadastrado antes
 * deste caminho existir, simplesmente não tem o elo — e continua funcionando
 * como sempre funcionou.
 */

type ContratoVinculado = {
  id: string;
  numero_contrato: string;
  numero_ata: string | null;
  tipo_documento: string;
  valor_global: number;
  status: string;
  data_assinatura: string | null;
};

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function ContratoDoProcesso({ licitacaoId }: { licitacaoId: string }) {
  const navigate = useNavigate();
  const [contratos, setContratos] = useState<ContratoVinculado[]>([]);

  useEffect(() => {
    let vivo = true;
    supabase
      .from('contratos')
      .select('id, numero_contrato, numero_ata, tipo_documento, valor_global, status, data_assinatura')
      .eq('licitacao_id', licitacaoId)
      .order('data_assinatura', { ascending: false })
      .then(({ data }) => { if (vivo) setContratos((data as ContratoVinculado[]) ?? []); });
    return () => { vivo = false; };
  }, [licitacaoId]);

  if (contratos.length === 0) return null;

  return (
    <Card className="p-6">
      <div className="mb-3 flex items-center gap-2">
        <FileSignature className="w-5 h-5 text-primary" aria-hidden="true" />
        <h2 className="text-lg font-semibold">
          {contratos.length === 1 ? 'Contrato deste processo' : 'Contratos deste processo'}
        </h2>
      </div>

      <div className="divide-y divide-border">
        {contratos.map((c) => {
          const ehAta = c.tipo_documento === 'ata_srp';
          return (
            <div key={c.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="text-sm font-medium">
                {ehAta ? rotuloDaAta(c.numero_ata || c.numero_contrato) : rotuloDoContrato(c.numero_contrato)}
              </span>
              <Badge variant="info">{c.status}</Badge>
              <span className="text-sm text-muted-foreground tabular-nums">{brl(c.valor_global)}</span>
              {c.data_assinatura && (
                <span className="text-xs text-muted-foreground">
                  assinado em {new Date(c.data_assinatura + 'T12:00:00').toLocaleDateString('pt-BR')}
                </span>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto"
                onClick={() => navigate('/gestao-contratos')}
              >
                Abrir <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
