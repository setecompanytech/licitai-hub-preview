import { useEffect, useState } from 'react';
import { Landmark } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { presencasDaFicha, type FichaFederal } from '@/lib/concorrentes/portal-federal';

/**
 * A presença do CNPJ no governo federal, pela ficha da pessoa jurídica do
 * Portal da Transparência (Onda 2, 22/09): contrato, licitação, pagamento,
 * NF-e, convênio, transferência — e as sanções, se houver. Uma chamada.
 */
export default function PresencaFederal({ cnpj }: { cnpj: string }) {
  const [estado, setEstado] = useState<{ carregando: boolean; ficha: FichaFederal | null; erro?: string }>({ carregando: true, ficha: null });

  useEffect(() => {
    let vivo = true;
    setEstado({ carregando: true, ficha: null });
    supabase.functions.invoke('consulta-transparencia', { body: { tipo: 'pessoa-juridica', cnpj: cnpj.replace(/\D/g, '') } })
      .then(({ data, error }) => {
        if (!vivo) return;
        if (error || data?.error) setEstado({ carregando: false, ficha: null, erro: String(data?.error ?? error?.message ?? 'Sem resposta') });
        else setEstado({ carregando: false, ficha: (data?.ficha ?? null) as FichaFederal | null, erro: data?.erro ? String(data.erro) : undefined });
      })
      .catch((e: unknown) => { if (vivo) setEstado({ carregando: false, ficha: null, erro: e instanceof Error ? e.message : 'Sem resposta' }); });
    return () => { vivo = false; };
  }, [cnpj]);

  const { presencas, sancoes } = presencasDaFicha(estado.ficha);

  return (
    <section className="g-cartao p-5" aria-labelledby="presenca-federal-titulo">
      <h2 id="presenca-federal-titulo" className="flex items-center gap-2 text-base font-semibold leading-6 text-foreground">
        <Landmark className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        Presença no governo federal
      </h2>
      {estado.carregando ? (
        <p className="mt-1 text-sm text-muted-foreground" aria-busy="true">Consultando o Portal da Transparência…</p>
      ) : estado.erro ? (
        <p className="mt-1 text-sm text-warning-ink">Sem resposta do Portal da Transparência: {estado.erro}</p>
      ) : estado.ficha === null ? (
        <p className="mt-1 text-sm text-muted-foreground">
          O Portal da Transparência não tem ficha para este CNPJ: sem contrato, pagamento, licitação ou sanção federal registrados.
        </p>
      ) : presencas.length === 0 && sancoes.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">Ficha sem contrato, pagamento, licitação, NF-e, convênio ou sanção federal.</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          {presencas.map((p) => <Badge key={p} variant="info">{p}</Badge>)}
          {sancoes.map((p) => <Badge key={p} variant="danger">{p}</Badge>)}
        </div>
      )}
      <p className="mt-2 text-xs text-muted-foreground">Fonte: ficha da pessoa jurídica na API do Portal da Transparência. Só o Poder Executivo Federal.</p>
    </section>
  );
}
