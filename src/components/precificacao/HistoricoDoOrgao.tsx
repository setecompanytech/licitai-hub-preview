import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { History, Loader2, ExternalLink, RefreshCw } from 'lucide-react';

/**
 * Histórico do órgão — Fase 1 do Reconhecimento de Recorrência (03/09/2026).
 *
 * "Este órgão já licitou objeto similar?" — contratações-irmãs dos últimos
 * 3 anos do acervo local, casadas pela DESCRIÇÃO do objeto (o campo fiel do
 * PNCP; marca nunca é critério — decisão do dono). Sob demanda por desenho:
 * o proativo é a Fase 3, depois de medir o uso.
 */

type Irmao = {
  id: string;
  orgao: string | null;
  objeto: string | null;
  modalidade_nome: string | null;
  uf: string | null;
  municipio: string | null;
  valor_total_estimado: number | null;
  data_publicacao_pncp: string | null;
  numero_compra: string | null;
  ano_compra: string | null;
  url_pncp: string | null;
  similaridade?: number;
};

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export default function HistoricoDoOrgao({
  cnpjInicial,
  objeto,
  permitirEditarCnpj = false,
}: {
  /** CNPJ do órgão do processo; ausente = acervo inteiro (qualquer órgão). */
  cnpjInicial?: string | null;
  /** A descrição que ancora a comparação — objeto do edital ou termo digitado. */
  objeto: string;
  /** No Painel Gov.br o CNPJ é digitável; no processo, vem das coordenadas. */
  permitirEditarCnpj?: boolean;
}) {
  const [cnpj, setCnpj] = useState(cnpjInicial ?? '');
  const [buscando, setBuscando] = useState(false);
  const [buscou, setBuscou] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [irmaos, setIrmaos] = useState<Irmao[]>([]);
  const [provedor, setProvedor] = useState<string>('');

  const buscar = async () => {
    if (objeto.trim().length < 8) {
      setErro('Descreva o objeto com pelo menos 8 caracteres para comparar.');
      setBuscou(true);
      return;
    }
    setBuscando(true);
    setErro(null);
    try {
      const { data, error } = await supabase.functions.invoke('historico-orgao-pncp', {
        body: { objeto: objeto.trim(), cnpj: cnpj.replace(/\D/g, '') || undefined, anos: 3 },
      });
      if (error || data?.error) {
        setErro(String(data?.error || 'Não foi possível consultar o acervo.'));
        setIrmaos([]);
      } else {
        setIrmaos((data?.resultados || []) as Irmao[]);
        setProvedor(String(data?.provedor || ''));
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro na consulta.');
      setIrmaos([]);
    } finally {
      setBuscando(false);
      setBuscou(true);
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
        <p className="text-sm font-semibold flex items-center gap-1.5">
          <History className="w-4 h-4 text-primary" /> Histórico do órgão
        </p>
        {buscou && !buscando && (
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={buscar}>
            <RefreshCw className="w-3 h-3 mr-1" /> Buscar de novo
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Contratações {cnpj ? 'deste órgão' : 'do acervo (qualquer órgão)'} com objeto similar,
        últimos 3 anos. A comparação usa a <span className="font-medium">descrição do objeto</span> —
        o campo fiel do PNCP; marca não é critério de busca.
      </p>

      {permitirEditarCnpj && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Input
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
            placeholder="CNPJ do órgão (opcional — vazio = todos)"
            className="h-8 text-xs w-72"
          />
        </div>
      )}

      {!buscou && !buscando && (
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={buscar}>
          <History className="w-3.5 h-3.5 mr-1.5" /> Buscar histórico
        </Button>
      )}

      {buscando && (
        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Comparando descrições no acervo…
        </p>
      )}

      {erro && !buscando && (
        <p className="text-xs text-destructive">
          {erro}{' '}
          <button type="button" className="underline underline-offset-2" onClick={buscar}>
            Tentar novamente
          </button>
        </p>
      )}

      {buscou && !buscando && !erro && irmaos.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Nenhuma contratação similar {cnpj ? 'deste órgão ' : ''}no acervo dos últimos 3 anos.
          O acervo cresce a cada pesquisa — processo que nunca passou por uma busca ainda não
          consta nele; ausência aqui não prova inexistência no PNCP.
        </p>
      )}

      {irmaos.length > 0 && (
        <div className="space-y-1.5">
          {provedor === 'textual' && (
            <p className="text-[11px] text-warning">
              Comparação semântica indisponível agora — resultados por palavras da descrição.
            </p>
          )}
          {irmaos.map((h) => (
            <div key={h.id} className="rounded border border-border/60 px-3 py-2 text-xs flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium line-clamp-2">{h.objeto || '—'}</p>
                <p className="text-muted-foreground mt-0.5">
                  {[h.orgao, h.municipio && h.uf ? `${h.municipio}/${h.uf}` : h.uf].filter(Boolean).join(' · ')}
                </p>
                <p className="text-muted-foreground">
                  {[
                    h.numero_compra ? `Nº ${h.numero_compra}${h.ano_compra ? `/${h.ano_compra}` : ''}` : null,
                    h.modalidade_nome,
                    h.data_publicacao_pncp ? h.data_publicacao_pncp.slice(0, 10).split('-').reverse().join('/') : null,
                  ].filter(Boolean).join(' · ')}
                </p>
              </div>
              <div className="shrink-0 text-right space-y-1">
                {h.valor_total_estimado != null && (
                  <p className="font-semibold tabular-nums">{brl(Number(h.valor_total_estimado))}</p>
                )}
                {typeof h.similaridade === 'number' && (
                  <Badge variant="outline" className="text-[10px]">
                    {Math.round(h.similaridade * 100)}% similar
                  </Badge>
                )}
                {h.url_pncp && (
                  <a href={h.url_pncp} target="_blank" rel="noreferrer"
                    className="text-accent hover:underline flex items-center gap-1 justify-end">
                    PNCP <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
