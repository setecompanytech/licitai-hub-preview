import { ExternalLink, Package } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import EstadoVazio from '@/components/shared/EstadoVazio';
import FaixaIndicadores from '@/components/gestao/FaixaIndicadores';
import EtiquetaDoValor from './EtiquetaDoValor';
import type { EstadoDosItens } from '@/hooks/useItensDoAcervo';
import { estatisticaUnitaria, unidadeLegivel } from '@/lib/mercado/preco-observado';

/**
 * O preço UNITÁRIO do item, dos mesmos editais que sustentam o valor global
 * (22/09): cada edital aberto item a item no PNCP; ficam os itens que falam
 * do objeto, com o estimado pelo órgão e o homologado ao vencedor. Dois
 * números que nunca se misturam com o global — e nunca entre si.
 */
const brl = (v: number | null | undefined) =>
  typeof v === 'number' ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';
const dataBr = (iso: string) => {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
};

export default function PrecoUnitarioDoAcervo({ termo, estado }: { termo: string; estado: EstadoDosItens }) {
  const est = estatisticaUnitaria(estado.itens);
  const unidadeUnica = est.unidades.length === 1 ? est.unidades[0] : '';
  const porUnidade = unidadeUnica ? ` / ${unidadeUnica}` : '';

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 grow basis-56">
          <h2 className="flex items-center gap-2 text-lg font-semibold leading-6 text-foreground">
            <Package className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            Preço unitário do item — os itens desses editais no PNCP
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cada edital acima aberto item a item. Ficam os itens que falam de “{termo}”, com o unitário que o órgão
            estimou e o que o vencedor levou, quando o PNCP publica o resultado.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <EtiquetaDoValor natureza="unitario" estagio="homologado" />
          <EtiquetaDoValor natureza="unitario" estagio="estimado" />
        </div>
      </div>

      {estado.carregando ? (
        <p className="mt-3 text-sm text-muted-foreground" role="status" aria-busy="true">
          Lendo os itens no PNCP… A primeira leitura de cada edital leva alguns segundos; as próximas saem do cache.
        </p>
      ) : estado.erro ? (
        <p className="mt-3 text-sm text-warning-ink">Sem os itens do PNCP: {estado.erro}</p>
      ) : estado.itens.length === 0 ? (
        <div className="mt-3">
          <EstadoVazio
            tamanho="compacto"
            icone={<Package />}
            titulo="Nenhum item desses editais fala do objeto pesquisado"
            descricao={`Foram lidos ${estado.totalItens} item(ns); nenhum traz as palavras de “${termo}”. O valor global acima segue valendo para o processo inteiro, não para o item.`}
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
                valor: est.minimoEstimado === null ? null : (
                  <>
                    <span className="block">{brl(est.minimoEstimado)}</span>
                    <span className="block">a {brl(est.maximoEstimado)}</span>
                  </>
                ),
                razaoIndisponivel: 'sem estimativas',
              },
              {
                rotulo: 'Amostra',
                valor: estado.itens.length,
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Edital</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead className="text-right">Unitário estimado</TableHead>
                  <TableHead className="text-right">Unitário homologado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {estado.itens.map((i) => (
                  <TableRow key={`${i.pncpId}-${i.numeroItem}`}>
                    <TableCell className="max-w-[260px]">
                      <span className="block font-medium text-foreground">{i.orgao || i.pncpId}</span>
                      <span className="block text-xs text-muted-foreground">
                        {[i.numeroCompra && i.anoCompra ? `nº ${i.numeroCompra}/${i.anoCompra}` : i.numeroCompra, i.dataPublicacao ? dataBr(i.dataPublicacao) : '']
                          .filter(Boolean).join(' · ')}
                        {i.urlPncp && (
                          <a href={i.urlPncp} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-0.5 text-primary hover:underline">
                            PNCP <ExternalLink className="h-3 w-3" aria-hidden="true" />
                          </a>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[380px]">
                      <span className="block">Item {i.numeroItem} · {i.descricao}</span>
                      {i.situacao && <span className="block text-xs text-muted-foreground">{i.situacao}</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {i.quantidade === null ? '—' : i.quantidade.toLocaleString('pt-BR')} {unidadeLegivel(i.unidade) || i.unidade}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{brl(i.estimado)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {i.homologado === null ? (
                        <span className="text-muted-foreground">{i.temResultado ? 'resultado sem valor' : 'sem resultado'}</span>
                      ) : (
                        <>
                          <span className="block font-semibold text-success-ink">{brl(i.homologado)}</span>
                          <span className="block text-xs text-muted-foreground">
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
      </p>
    </Card>
  );
}
