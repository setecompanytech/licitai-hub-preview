/**
 * A relação ATA SRP → contratos derivados, traduzida em linhas de tabela.
 *
 * O modelo já guarda a relação: `contratos.tipo_documento` distingue a ata do
 * contrato, e `contratos.ata_srp_id` (auto-referencial) diz de qual ata o
 * contrato nasceu. A lista, porém, resolvia isso escondendo o derivado
 * (`if (derivado && !search) return false`) — a ata aparecia sozinha, os
 * derivados só existiam dentro da pasta dela, e a relação que a lei cria
 * (art. 84: a ata regista, o contrato executa) não estava em lugar nenhum da
 * primeira tela.
 *
 * Aqui a mesma relação vira hierarquia visível: a ata é linha-mãe, os
 * derivados são linhas indentadas sob ela. Nada de novo é consultado — só a
 * ordem e o nível de cada linha são calculados a partir do que já foi
 * carregado.
 *
 * Três decisões que não são óbvias:
 *
 *  1. **Derivado órfão sobe.** Se a ata de origem não está na lista (recorte
 *     por responsável, por exemplo), o derivado viraria filho de ninguém e
 *     sumiria. Ele volta ao primeiro nível, marcado como `orfao`, porque
 *     registro que existe nunca pode desaparecer por efeito de layout.
 *
 *  2. **A mãe aparece quando um filho é encontrado.** Buscar o número de um
 *     contrato derivado tem de mostrar o contrato — e mostrar de qual ata ele
 *     veio é justamente o que a tela quer dizer.
 *
 *  3. **Contagem total e contagem visível andam juntas.** O selo da ata conta
 *     TODOS os derivados dela (é um fato do instrumento); as linhas mostram só
 *     os que passam no filtro. Devolver os dois números deixa a tela dizer
 *     "2 de 5" em vez de mentir em qualquer das direções.
 */

export type RegistroDerivavel = {
  id: string;
  tipo_documento?: string | null;
  ata_srp_id?: string | null;
};

/** Derivado = contrato administrativo nascido de uma ata (o par do modelo). */
export function ehDerivado(registro: RegistroDerivavel): boolean {
  return registro.tipo_documento === 'contrato' && !!registro.ata_srp_id;
}

export interface LinhaHierarquica<T> {
  registro: T;
  /** 0 = ata ou contrato autônomo; 1 = contrato derivado, indentado. */
  nivel: 0 | 1;
  /** Quantos derivados a ata tem ao todo, neste recorte de responsável. */
  derivadosTotal: number;
  /** Quantos deles passam no filtro atual. */
  derivadosVisiveis: number;
  /** A linha-mãe está expandida? */
  aberta: boolean;
  /** Derivado cuja ata de origem não está na lista — subiu de nível. */
  orfao: boolean;
}

export function montarLinhas<T extends RegistroDerivavel>(
  registros: T[],
  opcoes: {
    /** O registro passa nos filtros de busca, tipo e situação? */
    atende: (registro: T) => boolean;
    /** A ata está expandida? */
    aberta: (ataId: string) => boolean;
  },
): LinhaHierarquica<T>[] {
  const presentes = new Set(registros.map((r) => r.id));
  const porAta = new Map<string, T[]>();

  for (const registro of registros) {
    if (!ehDerivado(registro)) continue;
    const mae = registro.ata_srp_id as string;
    if (!presentes.has(mae)) continue; // órfão: tratado no primeiro nível
    const lista = porAta.get(mae);
    if (lista) lista.push(registro);
    else porAta.set(mae, [registro]);
  }

  const linhas: LinhaHierarquica<T>[] = [];

  for (const registro of registros) {
    const derivado = ehDerivado(registro);
    // Derivado com mãe na lista sai como filho dela, não como irmão.
    if (derivado && presentes.has(registro.ata_srp_id as string)) continue;

    const filhos = porAta.get(registro.id) ?? [];
    const visiveis = filhos.filter(opcoes.atende);
    if (!opcoes.atende(registro) && visiveis.length === 0) continue;

    const aberta = visiveis.length > 0 && opcoes.aberta(registro.id);
    linhas.push({
      registro,
      nivel: 0,
      derivadosTotal: filhos.length,
      derivadosVisiveis: visiveis.length,
      aberta,
      orfao: derivado,
    });

    if (!aberta) continue;
    for (const filho of visiveis) {
      linhas.push({
        registro: filho,
        nivel: 1,
        derivadosTotal: 0,
        derivadosVisiveis: 0,
        aberta: false,
        orfao: false,
      });
    }
  }

  return linhas;
}
