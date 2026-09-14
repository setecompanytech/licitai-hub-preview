import type { ElementType } from 'react';
import { navGroups, menuDaConta } from './menu';
import { paginasPadrao } from './paginas';

/**
 * O registro único de navegação — uma função, uma entrada.
 *
 * O sistema tinha QUATRO listas de navegação vivendo em paralelo, e as quatro
 * divergiam:
 *
 *   menu.ts (navGroups)        — a autoridade, que a barra lê
 *   paginas.ts (paginasPadrao) — título, descrição e trilha de cada tela
 *   QuickAccessGrid.groups     — os atalhos do painel, escritos à mão
 *   GlobalSearch.pages         — o índice da busca, escrito à mão
 *
 * A divergência não era teórica. `/monitoramento-editais` tinha TRÊS nomes
 * ("Editais & Licitações", "Editais e licitações", "Encontrar Editais"). O
 * atalho "Definir Metas" do painel levava a `/metas-comercial?tab=parametros`
 * enquanto o item de mesmo nome no menu levava a `/definir-metas`. A busca
 * indexava "Dashboard" apontando para `/`, que é a landing pública, e não
 * conhecia 18 rotas que o menu oferecia.
 *
 * Este módulo não substitui `menu.ts` nem `paginas.ts`: ele os COMPÕE. Quem
 * quiser acrescentar uma tela continua acrescentando nos dois lugares de
 * sempre — e o teste que já existe garante que eles não se separem. O que
 * muda é que menu global, busca, favoritos, recentes e atalhos do painel
 * passam a ler daqui, e não de cópias próprias.
 */

export interface FuncaoDoSistema {
  /** Identidade estável — usada em favoritos e recentes. É a rota. */
  id: string;
  /** Nome curto, o do menu. É como a pessoa chama a função. */
  nome: string;
  /** Nome pleno da tela, quando o registro tem um mais explícito. */
  nomeCompleto: string;
  /** Uma frase sobre o que a tela faz. Vazia quando não há registro. */
  descricao: string;
  categoria: string;
  rota: string;
  icone: ElementType;
  /** Só para quem administra a própria empresa. */
  adminOnly: boolean;
  /** Termos que a busca também aceita, sem acento e em minúsculas. */
  sinonimos: string[];
}

/** Tira acento e caixa — a busca não pode exigir que se digite "orçamento". */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Sinônimos que ninguém deduz do nome da tela.
 *
 * Só entram termos que alguém realmente digitaria procurando aquilo: o nome
 * antigo da função, o jargão do setor, a sigla. Encher isto de palavras
 * genéricas faria toda busca devolver tudo, que é o mesmo que não buscar.
 */
const SINONIMOS: Record<string, string[]> = {
  '/monitoramento-editais': ['encontrar editais', 'buscar licitacao', 'pncp', 'oportunidades', 'radar'],
  '/licitacoes-estrategicas': ['estrategicas', 'prioridade', 'capag', 'score'],
  '/meus-compromissos': ['compromissos', 'interesse', 'meus processos'],
  '/kanban': ['quadro', 'gestao de licitacoes', 'pipeline', 'funil'],
  '/gestao-contratos': ['contratos', 'ata', 'srp', 'aditivo', 'empenho'],
  '/gestao-compras': ['compras', 'estoque', 'pedidos', 'nfe', 'nota fiscal', 'fornecedor'],
  '/produtos': ['cadastro de produtos', 'ncm', 'cest', 'catalogo'],
  '/precificacao': ['preco', 'margem', 'custo', 'planilha'],
  '/proposta-tecnica': ['proposta', 'orcamento', 'comercial'],
  '/robo-lances': ['robo', 'lance', 'disputa', 'pregao'],
  '/workflow-ia': ['esteira', 'automacao', 'fluxo'],
  '/aurelia': ['assistente', 'ia', 'chat', 'consultora'],
  '/financeiro': ['caixa', 'banco', 'conciliacao', 'dre', 'lancamento', 'pagar', 'receber'],
  '/historico-licitacoes': ['historico', 'desempenho', 'resultado'],
  '/metas-comercial': ['metas', 'comercial', 'vendedor'],
  '/documentos': ['certidao', 'habilitacao', 'cofre', 'documento'],
  '/apoio-juridico': ['juridico', 'recurso', 'impugnacao', 'peticao'],
  '/apoio-contabil': ['contabil', 'balanco', 'imposto'],
  '/assessoria-cadastral': ['cadastro', 'sicaf', 'credenciamento'],
  '/indices-repactuacao': ['reajuste', 'indice', 'inpc', 'igpm', 'repactuacao'],
  '/analytics': ['relatorio', 'grafico', 'indicadores', 'analise'],
  '/analise-mercado': ['mercado', 'concorrencia'],
  '/concorrentes': ['concorrente', 'cnpj', 'adversario'],
  '/equipe': ['colaborador', 'usuario', 'permissao', 'time'],
  '/empresas': ['empresa', 'cnpj', 'filial'],
  '/configuracoes': ['ajustes', 'preferencias', 'conta'],
  '/api-integracao': ['api', 'webhook', 'integracao', 'token'],
  '/dashboard': ['painel', 'inicio', 'home'],
};

/**
 * Todas as funções que o sistema oferece, compostas das duas autoridades.
 *
 * A ordem segue a dos grupos em `menu.ts`, porque é a ordem que a barra e o
 * diretório mostram — e ordem que muda de lugar para lugar faz a pessoa
 * reaprender o mapa a cada tela.
 */
export const funcoesDoSistema: FuncaoDoSistema[] = [
  ...navGroups.flatMap((grupo) =>
    grupo.items.map((item) => {
      const rotaBase = item.path.split('?')[0];
      const registro = paginasPadrao.find((p) => p.rota === rotaBase);
      return {
        id: item.path,
        nome: item.label,
        nomeCompleto: registro?.titulo ?? item.label,
        descricao: registro?.descricao ?? '',
        categoria: grupo.title,
        rota: item.path,
        icone: item.icon,
        adminOnly: item.adminOnly ?? false,
        sinonimos: SINONIMOS[rotaBase] ?? [],
      };
    }),
  ),
  // O que vive atrás do avatar também é função do sistema: quem procura
  // "equipe" na busca não sabe (nem precisa saber) que aquilo mora no menu da
  // conta e não na barra. Itens com `hash` ficam de fora — são seções de uma
  // tela que já está listada, e listá-las de novo encheria o diretório de
  // cinco entradas chamadas "Configurações".
  ...menuDaConta
    .filter((item) => !item.hash)
    .map((item) => {
      const registro = paginasPadrao.find((p) => p.rota === item.path);
      return {
        id: item.path,
        nome: item.label,
        nomeCompleto: registro?.titulo ?? item.label,
        descricao: registro?.descricao ?? '',
        categoria: 'Configuração',
        rota: item.path,
        icone: item.icon,
        adminOnly: item.adminOnly ?? false,
        sinonimos: SINONIMOS[item.path] ?? [],
      };
    }),
];

/** As categorias na ordem em que aparecem, sem repetir. */
export const categoriasDoSistema: string[] = [
  ...new Set(funcoesDoSistema.map((f) => f.categoria)),
];

/**
 * Filtra por texto, ignorando acento e caixa.
 *
 * Casa contra nome, nome pleno, categoria e sinônimos — mas NÃO contra a
 * descrição: ela tem frases inteiras, e buscar "processo" devolveria metade
 * do sistema porque a palavra aparece em nove descrições.
 */
export function buscarFuncoes(funcoes: FuncaoDoSistema[], termo: string): FuncaoDoSistema[] {
  const alvo = normalizar(termo);
  if (!alvo) return funcoes;
  return funcoes.filter((f) =>
    [f.nome, f.nomeCompleto, f.categoria, ...f.sinonimos].some((campo) =>
      normalizar(campo).includes(alvo),
    ),
  );
}

/** A função correspondente a uma rota, para marcar onde a pessoa está. */
export function funcaoDaRota(pathname: string): FuncaoDoSistema | undefined {
  return funcoesDoSistema.find((f) => {
    const base = f.rota.split('?')[0];
    return pathname === base || pathname.startsWith(base + '/');
  });
}
