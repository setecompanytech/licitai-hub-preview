import { ExternalLink, Package } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import EstadoVazio from '@/components/shared/EstadoVazio';
import TextoRecolhido from '@/components/shared/TextoRecolhido';
import FaixaIndicadores from '@/components/gestao/FaixaIndicadores';
import EtiquetaDoValor from './EtiquetaDoValor';
import type { EstadoDosItens } from '@/hooks/useItensDoAcervo';
import {
  anosDoFiltro, estatisticaUnitaria, filtrarItens, itemSigiloso, unidadeLegivel, type FiltroDeItens,
} from '@/lib/mercado/preco-observado';
import { nomeDeOrgaoLegivel } from '@/lib/texto/nome-de-orgao';

/**
 * O preço UNITÁRIO do item, dos mesmos editais que sustentam o valor global
 * (22/09): cada edital aberto item a item no PNCP; ficam os itens que falam
 * do objeto, com o estimado pelo órgão e o homologado ao vencedor.
 *
 * Por padrão só o HOMOLOGADO (tarde de 22/09): item "em andamento" e
 * orçamento sigiloso (estimativa zero) saem do rol — não são preço de
 * mercado, são expectativa. O ano recorta os três últimos. A descrição do
 * item vem recolhida em duas linhas, porque a especificação de vinte linhas
 * derrubava a tabela.
 */
const brl = (v: number | null | undefined) =>
  typeof v === 'number' ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';
const dataBr = (iso: string) => {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
};

export default function PrecoUnitarioDoAcervo({
  termo, estado, filtro, aoMudarFiltro,
}: {
  termo: string;
  estado: EstadoDosItens;
  filtro: FiltroDeItens;
  aoMudarFiltro: (f: FiltroDeItens) => void;
}) {
  const itens = filtrarItens(estado.itens, filtro);
  const est = estatisticaUnitaria(itens);
  const unidadeUnica = est.unidades.length === 1 ? est.unidades[0] : '';
  const porUnidade = unidadeUnica ? ` / ${unidadeUnica}` : '';
  const soHomologados = filtro.situacao === 'homologados';

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 grow basis-56">
          <h2 className="flex items-center gap-2 text-lg font-semibold leading-6 text-foreground">
            <Package className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            Preço unitário do item — os itens desses editais no PNCP
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cada edital acima aberto item a item. Ficam os itens que falam de “{termo}”
            {soHomologados ? ', com o preço que o vencedor levou; o estimado pelo órgão aparece ao lado, como contexto.' : ', inclusive os ainda em andamento e os de orçamento sigiloso.'}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <EtiquetaDoValor natureza="unitario" estagio="homologado" />
          <EtiquetaDoValor natureza="unitario" estagio="estimado" />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="itens-situacao">Situação</Label>
          <Select value={filtro.situacao} onValueChange={(v) => aoMudarFiltro({ ...filtro, situacao: v === 'todos' ? 'todos' : 'homologados' })}>
            <SelectTrigger id="itens-situacao" className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="homologados">Só homologados (padrão)</SelectItem>
              <SelectItem value="todos">Todos, inclusive em andamento</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="itens-ano">Ano</Label>
          <Select value={filtro.ano} onValueChange={(v) => aoMudarFiltro({ ...filtro, ano: v })}>
            <SelectTrigger id="itens-ano" className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Últimos 3 anos</SelectItem>
              {anosDoFiltro().map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {estado.carregando ? (
        <p className="mt-3 text-sm text-muted-foreground" role="status" aria-busy="true">
          Lendo os itens no PNCP… A primeira leitura de cada edital leva alguns segundos; as próximas saem do cache.
        </p>
      ) : estado.erro ? (
        <p className="mt-3 text-sm text-warning-ink">Sem os itens do PNCP: {estado.erro}</p>
      ) : itens.length === 0 ? (
        <div className="mt-3">
          <EstadoVazio
            tamanho="compacto"
            icone={<Package />}
            titulo={estado.itens.length === 0
              ? 'Nenhum item desses editais fala do objeto pesquisado'
              : soHomologados ? 'Nenhum item homologado neste recorte' : 'Nenhum item neste ano'}
            descricao={estado.itens.length === 0
              ? `Foram lidos ${estado.totalItens} item(ns); nenhum traz as palavras de “${termo}”. O valor global acima segue valendo para o processo inteiro, não para o item.`
              : `${estado.itens.length} item(ns) falam do objeto, mas ${soHomologados ? 'ainda sem resultado publicado no PNCP' : 'fora do ano escolhido'}. Troque a situação ou o ano acima.`}
          />
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <FaixaIndicadores
            itens={[
              {
                rotulo: 'Mediana homologada',
                valor: est.medianaHomologada === null ? null : `${brl(est.medianaHomologada)}${porUnidade}`,
                razaoIndisponivel: 'nenhum item com resultado publicado no PNCP',
                detalhe: `${est.amostraHomologada} item(ns) com vencedor · a âncora`,
                tom: 'ok',
              },
              {
                rotulo: 'Mediana estimada',
                valor: est.medianaEstimada === null ? null : `${brl(est.medianaEstimada)}${porUnidade}`,
                razaoIndisponivel: 'nenhum item com estimativa do órgão',
                detalhe: `${est.amostraEstimada} item(ns) com estimativa do órgão`,
              },
              {
                rotulo: 'Faixa do estimado',
                valor: est.minimoEstimado === null ? null : `${brl(est.minimoEstimado)} a ${brl(est.maximoEstimado)}`,
                razaoIndisponivel: 'sem estimativas',
              },
              {
                rotulo: 'Amostra',
                valor: itens.length,
                detalhe: `item(ns) em ${est.editais} edital(is)${est.unidades.length > 0 ? ` · ${est.unidades.join(', ')}` : ''}`,
              },
            ]}
          />
          {est.unidades.length > 1 && (
            <p className="text-xs text-warning-ink">
              Os itens vêm em unidades diferentes ({est.unidades.join(', ')}); as medianas misturam unidades — compare item a item.
            </p>
          )}

          <div className="rounded-md border border-border">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[24%]">Edital</TableHead>
                  <TableHead className="w-[40%]">Item</TableHead>
                  <TableHead className="w-[12%] text-right">Quantidade</TableHead>
                  <TableHead className="w-[12%] text-right">Unitário estimado</TableHead>
                  <TableHead className="w-[12%] text-right">Unitário homologado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itens.map((i) => (
                  <TableRow key={`${i.pncpId}-${i.numeroItem}`} className="align-top">
                    <TableCell className="align-top">
                      <span className="block font-medium leading-5 text-foreground">{nomeDeOrgaoLegivel(i.orgao) || i.pncpId}</span>
                      <span className="block text-xs leading-5 text-muted-foreground">
                        {[i.numeroCompra && i.anoCompra ? `nº ${i.numeroCompra}/${i.anoCompra}` : i.numeroCompra, i.dataPublicacao ? dataBr(i.dataPublicacao) : '']
                          .filter(Boolean).join(' · ')}
                        {i.urlPncp && (
                          <a href={i.urlPncp} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-0.5 text-primary hover:underline">
                            PNCP <ExternalLink className="h-3 w-3" aria-hidden="true" />
                          </a>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="align-top">
                      <TextoRecolhido texto={`Item ${i.numeroItem} · ${i.descricao}`} />
                      {i.situacao && <span className="block text-xs leading-5 text-muted-foreground">{i.situacao}</span>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right align-top tabular-nums leading-5">
                      {i.quantidade === null ? '—' : i.quantidade.toLocaleString('pt-BR')} {unidadeLegivel(i.unidade) || i.unidade}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right align-top tabular-nums leading-5">
                      {itemSigiloso(i) && !(typeof i.estimado === 'number' && i.estimado > 0)
                        ? <span className="text-muted-foreground">sigiloso</span>
                        : brl(i.estimado)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right align-top tabular-nums leading-5">
                      {i.homologado === null || i.homologado <= 0 ? (
                        <span className="text-muted-foreground">{i.temResultado ? 'sem valor' : 'sem resultado'}</span>
                      ) : (
                        <>
                          <span className="block font-semibold text-success-ink">{brl(i.homologado)}</span>
                          <span className="block whitespace-normal text-xs leading-4 text-muted-foreground">
                            {[i.fornecedor, i.dataResultado ? dataBr(i.dataResultado) : ''].filter(Boolean).join(' · ')}
                          </span>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        Fonte: API pública do PNCP, itens e resultados por edital.
        {estado.cacheados + estado.buscados > 0
          ? ` ${estado.cacheados} edital(is) já em cache, ${estado.buscados} lido(s) agora.`
          : ''}
        {estado.itens.length > itens.length ? ` ${estado.itens.length - itens.length} item(ns) fora do recorte atual.` : ''}
      </p>
    </Card>
  );
}
