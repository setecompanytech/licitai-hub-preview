import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileSignature, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

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
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <FileSignature className="w-4 h-4 text-muted-foreground" />
        <span className="font-semibold text-sm">
          {contratos.length === 1 ? 'Contrato deste processo' : 'Contratos deste processo'}
        </span>
      </div>

      <div className="divide-y divide-border">
        {contratos.map((c) => {
          const ehAta = c.tipo_documento === 'ata_srp';
          return (
            <div key={c.id} className="flex items-center gap-3 py-2.5 flex-wrap">
              <span className="text-sm font-medium">
                {ehAta ? `ATA SRP n. ${c.numero_ata || c.numero_contrato}` : `Contrato n. ${c.numero_contrato}`}
              </span>
              <Badge variant="outline" className="text-xs">{c.status}</Badge>
              <span className="text-sm text-muted-foreground tabular-nums">{brl(c.valor_global)}</span>
              {c.data_assinatura && (
                <span className="text-xs text-muted-foreground">
                  assinado em {new Date(c.data_assinatura + 'T12:00:00').toLocaleDateString('pt-BR')}
                </span>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto h-7 text-xs"
                onClick={() => navigate('/gestao-contratos')}
              >
                Abrir <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
