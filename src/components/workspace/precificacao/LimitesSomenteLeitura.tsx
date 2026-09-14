import { useCallback, useEffect, useRef, useState } from 'react';
import { Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import TabelaGestao, { type ColunaGestao } from '@/components/gestao/TabelaGestao';
import { AvisoDeContexto, AvisoDeFalha } from '@/components/gestao/SeloSituacao';
import { SecaoGestao } from '@/components/gestao/TelaGestao';
import { ehMigracaoPendente } from '@/hooks/usePrecificacaoVersoes';
import type { CriterioDeDisputa } from '@/lib/precificacao/versao';
import {
  dataHoraDeBrasilia,
  formatarCentavos,
  MENSAGEM_DE_MIGRACAO_PENDENTE,
  ROTULO_DO_CRITERIO,
} from './formato';

/**
 * Os limites aprovados, para quem acompanha sem operar.
 *
 * O RLS de `precificacao_versoes` só deixa ler quem opera (custo e premissa
 * são informação sensível). Quem só acompanha lê pela função
 * `limites_operacionais_do_processo`, que devolve número, preço inicial e
 * limite da versão aprovada — nenhum custo, nenhuma premissa. A tela diz isso
 * com todas as letras, para a ausência do custo não parecer defeito.
 */
interface LimiteOperacional {
  versao_id: string;
  versao_numero: number;
  aprovada_em: string | null;
  criterio_disputa: CriterioDeDisputa;
  licitacao_item_id: string | null;
  numero: number;
  lote: string | null;
  descricao: string;
  preco_inicial_centavos: number | null;
  limite_centavos: number | null;
}

export default function LimitesSomenteLeitura({ licitacaoId }: { licitacaoId: string }) {
  const [linhas, setLinhas] = useState<LimiteOperacional[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [migracaoPendente, setMigracaoPendente] = useState(false);
  const cargaAtual = useRef(0);

  const carregar = useCallback(async () => {
    const carga = ++cargaAtual.current;
    setCarregando(true);
    setErro(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- função de 14/09 fora do types.ts (parado em 16/08)
    const { data, error } = await (supabase as any).rpc('limites_operacionais_do_processo', {
      p_licitacao_id: licitacaoId,
    });
    if (carga !== cargaAtual.current) return;
    if (error) {
      if (ehMigracaoPendente(error)) setMigracaoPendente(true);
      else setErro(error.message ?? String(error));
      setLinhas([]);
    } else {
      setMigracaoPendente(false);
      setLinhas((data ?? []) as LimiteOperacional[]);
    }
    setCarregando(false);
  }, [licitacaoId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const colunas: ColunaGestao<LimiteOperacional>[] = [
    {
      chave: 'item',
      titulo: 'Item',
      prioridade: 'sempre',
      largura: '5rem',
      render: (l) => (
        <span className="tabular-nums">
          {l.numero}
          {l.lote && l.lote !== 'Único' && <span className="g-meta block text-muted-foreground">Lote {l.lote}</span>}
        </span>
      ),
    },
    { chave: 'produto', titulo: 'Produto', prioridade: 'sempre', render: (l) => <span className="line-clamp-2">{l.descricao}</span> },
    {
      chave: 'inicial',
      titulo: 'Preço de proposta',
      tituloCurto: 'Preço',
      alinhamento: 'direita',
      prioridade: 'sempre',
      render: (l) => formatarCentavos(l.preco_inicial_centavos),
    },
    {
      chave: 'limite',
      titulo: 'Limite',
      alinhamento: 'direita',
      prioridade: 'sempre',
      render: (l) => formatarCentavos(l.limite_centavos),
    },
  ];

  const primeira = linhas[0];

  return (
    <SecaoGestao titulo="Limites aprovados">
      <p className="g-corpo flex items-center gap-2 text-muted-foreground">
        <Lock aria-hidden="true" className="h-4 w-4 shrink-0" />
        Custos restritos ao seu papel. Aqui aparecem só o preço de proposta e o limite da versão aprovada.
      </p>
      {migracaoPendente ? (
        <AvisoDeContexto titulo={MENSAGEM_DE_MIGRACAO_PENDENTE}>
          As versões aprovadas da precificação dependem da atualização do banco de 14/09/2026.
        </AvisoDeContexto>
      ) : erro ? (
        <AvisoDeFalha aoTentarNovamente={() => void carregar()}>Não foi possível carregar os limites: {erro}</AvisoDeFalha>
      ) : (
        <>
          {primeira && (
            <p className="g-corpo text-foreground">
              Versão {primeira.versao_numero} aprovada em {dataHoraDeBrasilia(primeira.aprovada_em)} (horário de Brasília) ·{' '}
              {ROTULO_DO_CRITERIO[primeira.criterio_disputa] ?? primeira.criterio_disputa}
            </p>
          )}
          <TabelaGestao
            colunas={colunas}
            itens={linhas}
            chaveDoItem={(l) => l.licitacao_item_id ?? `${l.lote ?? '—'}#${l.numero}`}
            carregando={carregando}
            descricao="Limites aprovados por item"
            vazio={
              <p className="g-corpo p-6 text-muted-foreground">
                Nenhuma versão aprovada para este processo — o robô ainda não tem limites.
              </p>
            }
          />
        </>
      )}
    </SecaoGestao>
  );
}
