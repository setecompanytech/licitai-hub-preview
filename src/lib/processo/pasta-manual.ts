/**
 * Regras da pasta manual — processo que não nasce do Monitoramento.
 *
 * Dispensas eletrônicas regionais correm em sistemas próprios (no Pará, o
 * Paradigma do Banpará, em cotacao.banpara.b.br) e não passam pelo PNCP. Sem
 * PNCP não há de onde o sistema criar a pasta; quem cria é a pessoa, e o que
 * ela preenche precisa sair gravado no mesmo formato que o monitoramento grava,
 * para o resto do fluxo (extração, precificação, robô) não distinguir as duas.
 *
 * Fica fora do componente pela razão de sempre: regra testável sem montar tela.
 */
import { TODOS_PORTAIS } from '@/data/portais-compras';
import { MODALIDADES as MODALIDADES_DA_LEI } from '@/data/modalidades-licitacao';
import { MODALIDADES as MODALIDADES_DAS_METAS } from '@/lib/metas/modalidades';
import { acharPortal } from '@/lib/robo/portais';
import { interpretarValorColado } from '@/lib/financeiro/valor-colado';
import type { EditalData } from '@/hooks/useLicitacaoIntegration';
import type { CategoriaAnexo } from './anexos';

const achatar = (s: string) =>
  (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// ─── Modalidade ────────────────────────────────────────────────────────────

export const MODALIDADE_PADRAO = 'Dispensa Eletrônica';

/**
 * As modalidades dos dois vocabulários que o app já tem — o da Lei (páginas de
 * modalidade) e o das Metas (normalização) —, sem repetir grafia equivalente.
 */
export const OPCOES_MODALIDADE: string[] = (() => {
  const vistos = new Set<string>();
  const lista: string[] = [];
  const nomes = [
    MODALIDADE_PADRAO,
    ...MODALIDADES_DA_LEI.map((m) => m.nome),
    ...MODALIDADES_DAS_METAS.map((m) => m.label),
  ];
  for (const nome of nomes) {
    const chave = achatar(nome);
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    lista.push(nome);
  }
  return lista;
})();

// ─── Sistema de origem ─────────────────────────────────────────────────────

export const SISTEMA_OUTRO = 'outro';

/**
 * O catálogo chama o Banparanet pelo nome do portal; quem opera conhece o
 * sistema pelo nome do módulo de cotação, Paradigma. O rótulo junta os dois
 * sem editar o catálogo, que alimenta outras telas.
 */
const ROTULO_NA_PASTA: Record<string, { rotulo: string; busca?: string }> = {
  banparanet: { rotulo: 'Banparanet (Pará) — sistema Paradigma', busca: 'paradigma banpara' },
};

export type OpcaoSistema = { id: string; rotulo: string; uf?: string; busca: string };

export const OPCOES_SISTEMA: OpcaoSistema[] = TODOS_PORTAIS.filter((p) => p.ativo !== false).map((p) => {
  const especial = ROTULO_NA_PASTA[p.id];
  const rotulo = especial?.rotulo ?? p.nome;
  return {
    id: p.id,
    rotulo,
    uf: p.uf,
    busca: achatar([rotulo, p.nome, p.nomeAbreviado, p.uf ?? '', especial?.busca ?? ''].join(' ')),
  };
});

/** Busca por pedaços: "para banpara", "paradigma", "compras rj". */
export function filtrarSistemas(busca: string): OpcaoSistema[] {
  const partes = achatar(busca).split(' ').filter(Boolean);
  if (partes.length === 0) return OPCOES_SISTEMA;
  return OPCOES_SISTEMA.filter((o) => partes.every((p) => o.busca.includes(p)));
}

export function rotuloDoSistema(sistemaId: string): string | null {
  if (!sistemaId) return null;
  if (sistemaId === SISTEMA_OUTRO) return 'Outro';
  return OPCOES_SISTEMA.find((o) => o.id === sistemaId)?.rotulo ?? null;
}

/**
 * O que vai para `licitacoes.portal`.
 *
 * Quando o Robô de Lances conhece o portal, grava o NOME do robô
 * (`PORTAIS_ROBO[].nome`, ex.: "Banparanet (PA)"): é esse o texto que o
 * `ConfigurarLanceDialog` casa no seletor ao importar o processo
 * (`setPortal(lic.portal)` contra `SelectItem value={p.nome}`) e que
 * `idDoPortal`/`portalDoAgente` resolvem. Gravar o nome do catálogo
 * ("Banparanet (Pará)") passaria pela tela e chegaria ao robô como portal
 * desconhecido. Sem correspondência no robô, fica o nome do catálogo; "Outro"
 * grava o que a pessoa digitou.
 */
export function portalParaGravar(sistemaId: string, outroTexto: string): string | null {
  if (sistemaId === SISTEMA_OUTRO) return outroTexto.trim() || null;
  const p = TODOS_PORTAIS.find((x) => x.id === sistemaId);
  if (!p) return null;
  const doRobo = acharPortal(p.id) ?? acharPortal(p.nome) ?? acharPortal(p.nomeAbreviado);
  return doRobo?.nome ?? p.nome;
}

// ─── Anexos ────────────────────────────────────────────────────────────────

export type TipoAnexoPasta =
  | 'edital'
  | 'termo_referencia'
  | 'anexo_edital'
  | Exclude<CategoriaAnexo, 'edital'>;

export type DestinoDoAnexo = {
  valor: TipoAnexoPasta;
  rotulo: string;
  categoria: CategoriaAnexo;
  metadata?: Record<string, unknown>;
  descricao?: string;
};

/**
 * Edital, TR e anexos do edital vão todos para a categoria `edital` — é nela
 * que a extração por IA procura o PDF —, diferenciados por `metadata.tipo`.
 * As demais seguem as categorias da aba Anexos.
 */
export const TIPOS_ANEXO: DestinoDoAnexo[] = [
  { valor: 'edital', rotulo: 'Edital', categoria: 'edital', metadata: { tipo: 'edital' } },
  {
    valor: 'termo_referencia',
    rotulo: 'Termo de Referência',
    categoria: 'edital',
    metadata: { tipo: 'termo_referencia' },
    descricao: 'Termo de Referência',
  },
  { valor: 'anexo_edital', rotulo: 'Anexo do edital', categoria: 'edital', metadata: { tipo: 'anexo_edital' } },
  { valor: 'habilitacao', rotulo: 'Habilitação', categoria: 'habilitacao' },
  { valor: 'proposta', rotulo: 'Proposta', categoria: 'proposta' },
  { valor: 'declaracoes', rotulo: 'Declarações', categoria: 'declaracoes' },
  { valor: 'recursos', rotulo: 'Recursos', categoria: 'recursos' },
  { valor: 'contrato', rotulo: 'Contrato', categoria: 'contrato' },
  { valor: 'outros', rotulo: 'Outros', categoria: 'outros' },
];

export function destinoDoTipo(tipo: TipoAnexoPasta): DestinoDoAnexo {
  return TIPOS_ANEXO.find((t) => t.valor === tipo) ?? TIPOS_ANEXO[TIPOS_ANEXO.length - 1];
}

/** Os tipos que a extração por IA lê para montar os itens. */
export const tipoLeEdital = (tipo: TipoAnexoPasta) => tipo === 'edital' || tipo === 'termo_referencia';

/**
 * Sugestão pelo nome do arquivo. É só o valor inicial do seletor — a pessoa
 * confere e troca. Sem pista no nome, "Anexo do edital": é o caso mais comum
 * de documento que chega junto com o edital.
 */
export function sugerirTipoDoArquivo(nome: string): TipoAnexoPasta {
  const semExtensao = nome.replace(/\.[^.]+$/, '');
  const texto = achatar(semExtensao);
  const palavras = texto.split(' ');
  if (/\btermo (de )?referencia\b/.test(texto) || palavras.includes('tr')) return 'termo_referencia';
  if (palavras.includes('edital') && palavras[0] !== 'anexo') return 'edital';
  return 'anexo_edital';
}

export const ACCEPT_ARQUIVOS = '.pdf,.doc,.docx,.xls,.xlsx,.zip,image/*';
const EXTENSOES_ACEITAS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'zip', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'bmp', 'tif', 'tiff'];

export function arquivoAceito(arquivo: File): boolean {
  const extensao = arquivo.name.includes('.') ? arquivo.name.split('.').pop()!.toLowerCase() : '';
  return EXTENSOES_ACEITAS.includes(extensao) || (arquivo.type || '').startsWith('image/');
}

export function formatarTamanho(bytes: number): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace('.', ',')} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

// ─── Formulário ────────────────────────────────────────────────────────────

export type FormPastaManual = {
  numero: string;
  modalidade: string;
  orgao: string;
  cnpj: string;
  sistemaId: string;
  sistemaOutro: string;
  objeto: string;
  url: string;
  uf: string;
  municipio: string;
  /** `datetime-local`: AAAA-MM-DDTHH:mm, na hora de quem digitou. */
  dataAbertura: string;
  dataEncerramento: string;
  valor: string;
};

export type CampoPasta = keyof FormPastaManual;
export type ErrosPasta = Partial<Record<CampoPasta, string>>;

/** A ordem visual do formulário — é nela que o foco procura o primeiro erro. */
export const ORDEM_CAMPOS: CampoPasta[] = [
  'numero', 'modalidade', 'orgao', 'cnpj', 'sistemaId', 'sistemaOutro', 'objeto',
  'url', 'uf', 'municipio', 'dataAbertura', 'dataEncerramento', 'valor',
];

export const formularioVazio = (): FormPastaManual => ({
  numero: '',
  modalidade: MODALIDADE_PADRAO,
  orgao: '',
  cnpj: '',
  sistemaId: '',
  sistemaOutro: '',
  objeto: '',
  url: '',
  uf: '',
  municipio: '',
  dataAbertura: '',
  dataEncerramento: '',
  valor: '',
});

/** Aceita o endereço sem `https://` (como se copia da barra); recusa o que não é web. */
export function normalizarUrl(valor: string): string | null {
  const texto = valor.trim();
  if (!texto) return null;
  const comEsquema = /^[a-z][a-z0-9+.-]*:\/\//i.test(texto) ? texto : `https://${texto}`;
  try {
    const url = new URL(comEsquema);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname.includes('.')) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Data e hora do `<input type="datetime-local">` para o `timestamptz` do banco.
 *
 * O valor chega sem fuso ("2026-09-20T09:00") e significa a hora de quem
 * digitou. `new Date()` lê esse formato como hora LOCAL (é a regra do
 * ECMAScript para data COM hora e sem deslocamento), e `toISOString()` devolve
 * o mesmo instante em UTC — correto para uma coluna com fuso. O que
 * `lib/financeiro/data-local.ts` proíbe é outra coisa: `toISOString()` sobre
 * DATA sem hora, que cai no dia vizinho.
 */
export function dataHoraLocalParaIso(valor: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(valor)) return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function validarPastaManual(form: FormPastaManual): ErrosPasta {
  const erros: ErrosPasta = {};
  if (!form.numero.trim()) erros.numero = 'Informe o número do processo.';
  if (!form.modalidade.trim()) erros.modalidade = 'Escolha a modalidade.';
  if (!form.orgao.trim()) erros.orgao = 'Informe o órgão ou a entidade.';
  const digitosCnpj = form.cnpj.replace(/\D/g, '');
  if (digitosCnpj && digitosCnpj.length !== 14) erros.cnpj = 'O CNPJ precisa ter 14 dígitos.';
  if (!form.sistemaId) erros.sistemaId = 'Escolha o sistema de origem.';
  if (form.sistemaId === SISTEMA_OUTRO && !form.sistemaOutro.trim()) {
    erros.sistemaOutro = 'Diga o nome do sistema de origem.';
  }
  if (!form.objeto.trim()) erros.objeto = 'Descreva o objeto.';
  if (form.url.trim() && !normalizarUrl(form.url)) {
    erros.url = 'Link inválido. Cole o endereço completo, como https://cotacao.banpara.b.br/…';
  }
  if (form.dataAbertura && !dataHoraLocalParaIso(form.dataAbertura)) erros.dataAbertura = 'Data e hora inválidas.';
  if (form.dataEncerramento && !dataHoraLocalParaIso(form.dataEncerramento)) {
    erros.dataEncerramento = 'Data e hora inválidas.';
  }
  if (form.valor.trim()) {
    const valor = interpretarValorColado(form.valor);
    if (valor === null || valor < 0) erros.valor = 'Valor inválido. Use, por exemplo, 12.500,00.';
  }
  return erros;
}

/** O formulário no formato que `iniciarProcesso` e `criarCompromisso` recebem. */
export function montarEditalData(form: FormPastaManual): EditalData {
  const valor = form.valor.trim() ? interpretarValorColado(form.valor) : null;
  const cnpj = form.cnpj.replace(/\D/g, '');
  return {
    numero: form.numero.trim(),
    orgao: form.orgao.trim(),
    objeto: form.objeto.trim(),
    modalidade: form.modalidade,
    valor_estimado: valor,
    uf: form.uf || null,
    municipio: form.municipio.trim() || null,
    data_abertura: form.dataAbertura ? dataHoraLocalParaIso(form.dataAbertura) : null,
    data_encerramento: form.dataEncerramento ? dataHoraLocalParaIso(form.dataEncerramento) : null,
    portal: portalParaGravar(form.sistemaId, form.sistemaOutro),
    url: normalizarUrl(form.url),
    cnpjOrgao: cnpj || null,
  };
}
