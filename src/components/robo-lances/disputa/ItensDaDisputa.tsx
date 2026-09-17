import { useMemo, useState } from 'react';
import { ListChecks, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import EstadoVazio from '@/components/shared/EstadoVazio';
import TabelaGestao, { type ColunaGestao } from '@/components/gestao/TabelaGestao';
import TextoExpansivel from '@/components/gestao/TextoExpansivel';
import SeloSituacao, { AvisoDeContexto, AvisoDeFalha } from '@/components/gestao/SeloSituacao';
import ConferenciaDosItens from '@/components/robo-lances/ConferenciaDosItens';
import type { LanceConfig } from '@/components/robo-lances/ConfigurarLanceDialog';
import type { SessaoViva } from '@/components/robo-lances/usePedidosDoRobo';
import type { DisputaCarregada, SessaoCarregada } from '@/hooks/useParticipacoesDoRobo';
import { useItensDaSessao } from '@/components/workspace/robo/consultas';
import { linhasDaDisputa, situacaoDoItem, type LinhaDoItem } from '@/components/workspace/robo/itens-da-disputa';
import { LimiteDoItem, NaoInformado } from '@/components/workspace/robo/ValoresDoItem';
import { formatarMoeda } from '@/components/workspace/robo/formatos';
import { nomesDasEstrategias } from '@/lib/robo/estrategia-do-item';

/** Título de coluna com mais de uma palavra, numa linha só. */
const semQuebra = (texto: string) => <span className="whitespace-nowrap">{texto}</span>;

/**
 * Aba "Itens e limites" — o que está sendo disputado e até quanto.
 *
 * ── A tabela que saía uma letra por linha ───────────────────────────────────
 *
 * Na tela de 1.710 px do dono do produto, a tabela de itens morava numa coluna
 * de ~300 px entre outras duas e o navegador espremia cada célula até "It / e /
 * m" e "R $ 1 0 0 , 0 0". Aqui ela tem a largura inteira, dinheiro e quantidade
 * não quebram (`whitespace-nowrap`), a descrição tem largura mínima e expande
 * por botão, e o que não couber rola DENTRO da caixa da tabela, com a sombra na
 * borda avisando (`TabelaGestao`). No celular cada item vira um cartão.
 *
 * ── De onde vem cada valor ──────────────────────────────────────────────────
 *
 * Item, descrição, quantidade, referência e limite: a configuração da disputa.
 * Seu último lance, melhor lance e situação: o que o AGENTE leu na sala
 * (`sessao_lance_itens`), casado por identificador ou lote + número — nunca por
 * descrição nem posição (`itens-da-disputa.ts`). Sem casamento inequívoco, a
 * célula diz "Não informado". A tabela antiga lia esses três do próprio cadastro,
 * que nada atualizava.
 */
export default function ItensDaDisputa({
  lance,
  linha,
  sessao,
  sessaoViva,
  gatilho,
}: {
  lance: LanceConfig;
  linha: DisputaCarregada;
  sessao: SessaoCarregada | null;
  /** Sessão que o agente diz estar de pé agora — é ela que confere os itens. */
  sessaoViva: SessaoViva | null;
  /** Instante da última leitura da situação: os lances por item envelhecem junto. */
  gatilho: number;
}) {
  const [busca, setBusca] = useState('');
  const itensDaSessao = useItensDaSessao(sessao?.id ?? null, gatilho);
  const dadosDaSessao = itensDaSessao.dados;
  const itens = lance.itens;

  // O filtro corre sobre o CADASTRO, antes do casamento com a sessão — e o
  // casamento não depende dos outros itens da lista, então filtrar não muda
  // qual lance cai em qual linha.
  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return itens;
    return itens.filter((i) =>
      [i.numero, i.lote, i.descricao, i.marca, i.modelo].some((v) => String(v ?? '').toLowerCase().includes(termo)),
    );
  }, [itens, busca]);
  const linhas = useMemo(() => linhasDaDisputa(filtrados, dadosDaSessao), [filtrados, dadosDaSessao]);

  const confirmado = !!linha.limites_confirmados_em;
  const temSessao = !!sessao;

  const colunas: ColunaGestao<LinhaDoItem>[] = [
    {
      chave: 'item',
      titulo: semQuebra('Item'),
      tituloCurto: 'Item',
      prioridade: 'sempre',
      largura: '4.5rem',
      render: (l) => (
        <span className="flex flex-col">
          <span className="whitespace-nowrap font-medium tabular-nums">{l.numero !== null ? l.numero : 'Sem número'}</span>
          {l.lote && (
            <span className="g-meta block max-w-[10rem] truncate text-muted-foreground" title={`Lote ${l.lote}`}>
              Lote {l.lote}
            </span>
          )}
        </span>
      ),
    },
    {
      chave: 'descricao',
      titulo: 'Descrição',
      prioridade: 'sempre',
      render: (l) =>
        l.descricao ? (
          <div className="min-w-0 md:min-w-[12rem] md:max-w-[28rem]">
            <TextoExpansivel texto={l.descricao} linhas={2} />
          </div>
        ) : (
          <NaoInformado texto="Sem descrição" />
        ),
    },
    {
      chave: 'quantidade',
      titulo: semQuebra('Qtd./Unid.'),
      tituloCurto: 'Qtd.',
      alinhamento: 'direita',
      prioridade: 'desktop',
      render: (l) =>
        l.quantidade !== null ? (
          <span className="whitespace-nowrap">
            {l.quantidade.toLocaleString('pt-BR')}
            {l.unidade ? ` ${l.unidade}` : ''}
          </span>
        ) : (
          <span className="whitespace-nowrap">
            <NaoInformado />
          </span>
        ),
    },
    {
      chave: 'referencia',
      titulo: semQuebra('Valor de referência'),
      tituloCurto: 'Referência',
      alinhamento: 'direita',
      prioridade: 'desktop',
      render: (l) => <span className="whitespace-nowrap">{formatarMoeda(l.valorReferencia) ?? <NaoInformado />}</span>,
    },
    {
      chave: 'limite',
      titulo: semQuebra('Limite (piso)'),
      tituloCurto: 'Limite',
      alinhamento: 'direita',
      prioridade: 'sempre',
      // A estratégia mora embaixo do piso, e não numa coluna própria: a tabela
      // foi medida para caber a 1.280 px, e piso e estratégia são lidos juntos
      // — até onde o robô desce, e como.
      render: (l) => (
        <span className="flex flex-col items-end">
          <span className="md:whitespace-nowrap">
            <LimiteDoItem valor={l.limite} confirmado={confirmado} />
          </span>
          <span className="g-meta whitespace-nowrap text-muted-foreground">
            {nomesDasEstrategias(l.estrategias)}
            {l.estrategias.includes('desempatar_1o') &&
              (l.margemDesempate !== null ? ` · margem ${formatarMoeda(l.margemDesempate)}` : ' · sem margem')}
            {l.lanceFinalFechado !== null && ` · final ${formatarMoeda(l.lanceFinalFechado)}`}
          </span>
        </span>
      ),
    },
    {
      chave: 'seu-ultimo',
      titulo: semQuebra('Seu último lance'),
      tituloCurto: 'Seu lance',
      alinhamento: 'direita',
      prioridade: 'sempre',
      render: (l) => (
        <span className="whitespace-nowrap">{formatarMoeda(l.daSessao?.seu_ultimo_lance) ?? <NaoInformado />}</span>
      ),
    },
    {
      chave: 'melhor',
      titulo: semQuebra('Melhor lance'),
      alinhamento: 'direita',
      prioridade: 'sempre',
      render: (l) => <span className="whitespace-nowrap">{formatarMoeda(l.daSessao?.melhor_lance) ?? <NaoInformado />}</span>,
    },
    {
      chave: 'situacao',
      titulo: 'Situação',
      prioridade: 'sempre',
      // "Disputando" era uma coluna própria de Sim/Não que empurrava a tabela
      // para fora da caixa a 1.280 px. Só o "não" acrescenta algo à situação —
      // por isso ele mora aqui, embaixo do selo.
      render: (l) => {
        const s = situacaoDoItem(l, temSessao);
        return (
          <span className="flex flex-col items-start gap-0.5">
            <span className="inline-flex whitespace-nowrap">
              <SeloSituacao tom={s.tom}>{s.rotulo}</SeloSituacao>
            </span>
            {l.disputando === false && (
              <span className="g-meta whitespace-nowrap text-muted-foreground">Fora da disputa no portal</span>
            )}
          </span>
        );
      },
    },
  ];

  return (
    <section aria-label="Itens e limites" className="flex min-w-0 flex-col gap-3">
      {/* A conferência dos itens contra o edital do portal fica IMEDIATAMENTE
          acima da tabela que ela julga. Só com sessão viva: é o robô quem
          confere, e um cartão permanente dizendo "aguardando" viraria paisagem. */}
      {sessaoViva && <ConferenciaDosItens conferencia={sessaoViva.conferencia} edital={lance.edital} />}

      {itensDaSessao.estado === 'migracao_pendente' && (
        <AvisoDeContexto titulo="Migração pendente">
          A tabela de itens da sessão ainda não existe no banco — os lances por item aparecem como “Não informado”.
        </AvisoDeContexto>
      )}
      {itensDaSessao.estado === 'erro' && (
        <AvisoDeFalha aoTentarNovamente={itensDaSessao.recarregar}>
          Não foi possível ler os lances por item: {itensDaSessao.erro}
        </AvisoDeFalha>
      )}

      {itens.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="g-meta text-muted-foreground">
            {itens.length} {itens.length === 1 ? 'item' : 'itens'} ·{' '}
            {lance.tipoDisputa === 'lote' ? 'disputa por lote' : 'disputa por item'}
            {busca.trim() && ` · ${linhas.length} na busca`}
          </p>
          <div className="relative w-full sm:w-72">
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              placeholder="Buscar item..."
              aria-label="Buscar item por número, lote, descrição, marca ou modelo"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="g-controle pl-9"
            />
          </div>
        </div>
      )}

      <TabelaGestao
        descricao="Itens da disputa, com valor de referência, limite e os lances lidos pelo robô"
        colunas={colunas}
        itens={linhas}
        chaveDoItem={(l) => l.chave}
        carregando={temSessao && itensDaSessao.estado === 'carregando'}
        vazio={
          itens.length === 0 ? (
            <EstadoVazio
              icone={<ListChecks />}
              titulo="Nenhum item cadastrado nesta disputa"
              descricao="Use “Editar parâmetros”, no topo, para adicionar itens e lotes."
              tamanho="compacto"
            />
          ) : (
            <EstadoVazio
              icone={<Search />}
              titulo="Nenhum item corresponde à busca"
              descricao={`Nada com "${busca.trim()}" no número, lote, descrição, marca ou modelo.`}
              tamanho="compacto"
            />
          )
        }
      />
    </section>
  );
}
