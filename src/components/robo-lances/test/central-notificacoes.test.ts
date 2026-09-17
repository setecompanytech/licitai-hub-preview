import { describe, it, expect, beforeAll } from 'vitest';
import * as vm from 'node:vm';
import JSZip from 'jszip';
import { generateAgentTemplate } from '@/lib/agente-template-generator';

/**
 * A central de notificações do fornecedor no Compras.gov (17/09/2026): o robô
 * vai da área do fornecedor até a lista de NÃO LIDAS, sem marcar nada como
 * lido e sem deixar o token sair da leitura. O caminho foi mapeado do código
 * público do portal; a tela real é confirmada no reconhecimento acompanhado.
 */

type Resumida = {
  id: string | null; lida: boolean; texto: string; publicada_em: string | null; uasg: string | null;
  numero_compra: string | null; id_compra: string | null; item: number | null; categoria: string | null;
};
type Relatorio = {
  ok: boolean; etapa: string | null; motivo: string | null; link: string | null; endereco: string | null;
  links_vistos: string[]; chamadas: string[]; tipos: unknown; total_nao_lidas: number | null; notificacoes: Resumida[]; fotos: string[];
};
type Modulo = {
  lerCentral: (page: unknown, opcoes?: Record<string, unknown>) => Promise<Relatorio>;
  escolherLinkDaAreaNova: (links: Array<{ texto: string; href: string; onclick?: string }>) => { texto: string; href: string; motivo: string } | null;
  enderecoDoClique: (onclick: string) => string;
  tokenDaRequisicao: (url: string, cab: Record<string, string>) => string | null;
  notificacaoResumida: (bruta: Record<string, unknown>) => Resumida;
};

let central: Modulo;

beforeAll(async () => {
  const zip = await JSZip.loadAsync(await (await generateAgentTemplate()).arrayBuffer());
  const nome = Object.keys(zip.files).find((n) => n.endsWith('src/central-notificacoes.js'));
  if (!nome) throw new Error('src/central-notificacoes.js não está no ZIP');
  const codigo = await zip.files[nome].async('string');
  const mod = { exports: {} as Modulo };
  new vm.Script(codigo).runInNewContext({ module: mod, exports: mod.exports, require: () => ({}), setTimeout, console });
  central = mod.exports;
});

const AREA = 'https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/seguro/fornecedor/area-trabalho';
const LINKS = [
  { texto: 'Dados Cadastrais', href: 'https://www.comprasnet.gov.br/dados.asp' },
  { texto: 'Compras', href: 'javascript:void(0)' },
  { texto: 'Compras Eletrônicas', href: 'https://www.comprasnet.gov.br/intro/redireciona.asp?destino=compras' },
];
const BRUTA = {
  id: 987, lida: false, texto: '<p>Convocação para envio de <b>anexo</b> do item 1 até 18/09/2026 às 14:00</p>',
  dataHoraPublicacao: '2026-09-17T10:15:00', categoria: '100', tipoContexto: 'ITEM',
  numeroUasg: 925448, codigoModalidade: 5, numeroCompra: 90025, anoCompra: 2026,
  numeroCompraFormatado: '90025/2026', descricaoModalidade: 'Pregão', identificadorItem: 1,
};

describe('escolha do link e do token', () => {
  it('prefere o endereço de iniciar-sessao, depois o do Compras.gov novo, depois o texto do menu', () => {
    expect(central.escolherLinkDaAreaNova([...LINKS, { texto: 'X', href: 'https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/iniciar-sessao;comprasIdCnetId=1' }])?.motivo)
      .toBe('endereco de iniciar-sessao');
    expect(central.escolherLinkDaAreaNova([...LINKS, { texto: 'Y', href: AREA }])?.motivo).toBe('endereco do Compras.gov novo');
    const porTexto = central.escolherLinkDaAreaNova(LINKS);
    expect(porTexto?.motivo).toBe('texto do menu');
    expect(porTexto?.texto).toBe('Compras Eletrônicas');
    expect(central.escolherLinkDaAreaNova([{ texto: 'Sair', href: 'https://www.comprasnet.gov.br/sair.asp' }])).toBeNull();
  });

  it('menu feito por script: o endereço do onclick vale como link (Área de Trabalho do Fornecedor, 17/09)', () => {
    expect(central.enderecoDoClique("window.open('https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/iniciar-sessao;x=1','_blank')"))
      .toBe('https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/iniciar-sessao;x=1');
    expect(central.enderecoDoClique("location.href='/intro/compras_eletronicas.asp?t=2'")).toBe('/intro/compras_eletronicas.asp?t=2');
    expect(central.enderecoDoClique('mostraMenu(3)')).toBe('');
    const escolhido = central.escolherLinkDaAreaNova([
      { texto: 'Dados Cadastrais', href: '', onclick: 'mostraMenu(1)' },
      { texto: 'Compras Eletrônicas', href: '', onclick: "window.open('https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/iniciar-sessao;id=9')" },
    ]);
    expect(escolhido).toMatchObject({ motivo: 'endereco de iniciar-sessao', texto: 'Compras Eletrônicas' });
  });

  it('o endereço do menu "Dispensa/Licitação Eletrônica" da Área de Trabalho vale (reconhecimento de 17/09, 02:15)', () => {
    expect(central.escolherLinkDaAreaNova([
      { texto: '', href: '/ConsultaLicitacoes/AcessoRestrito.asp' },
      { texto: '', href: '/assinadas/dispensa_eletronica.asp' },
    ])).toMatchObject({ motivo: 'endereco do menu Dispensa/Licitacao Eletronica', href: '/assinadas/dispensa_eletronica.asp' });
  });

  it('token só de chamada da API do portal, e só Bearer', () => {
    expect(central.tokenDaRequisicao('https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-mensagem/v1/mensagens/quantidade-nao-lidas', { authorization: 'Bearer abc' }))
      .toBe('Bearer abc');
    expect(central.tokenDaRequisicao('https://www.google-analytics.com/collect', { authorization: 'Bearer abc' })).toBeNull();
    expect(central.tokenDaRequisicao('https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-usuario/v1/x', { authorization: 'Basic abc' })).toBeNull();
  });
});

describe('notificação resumida', () => {
  it('tira o HTML, monta o id da compra (UASG + modalidade + número + ano) e guarda o item', () => {
    const n = central.notificacaoResumida(BRUTA);
    expect(n).toMatchObject({
      id: '987', lida: false, uasg: '925448', numero_compra: '90025/2026', id_compra: '92544805900252026', item: 1,
      publicada_em: '2026-09-17T10:15:00', categoria: '100',
    });
    expect(n.texto).toBe('Convocação para envio de anexo do item 1 até 18/09/2026 às 14:00');
  });

  it('sem os dados da compra, não inventa id nem número', () => {
    const n = central.notificacaoResumida({ id: 5, texto: 'Aviso geral do sistema' });
    expect(n).toMatchObject({ id: '5', id_compra: null, numero_compra: null, uasg: null, item: null });
  });
});

/** Um Chrome de mentira: área do fornecedor com links e a aba nova que responde a API. */
function chrome(over: { links?: Array<{ texto: string; href: string }>; semToken?: boolean; lista?: { status: number; total?: string | null; corpo?: unknown } } = {}) {
  const registro = { fechadas: 0, pedidos: [] as unknown[], desligou: false };
  const ouvintes: Record<string, Array<(x: unknown) => void>> = {};
  let urlDaArea = 'about:blank';
  const area = {
    on: (ev: string, cb: (x: unknown) => void) => { (ouvintes[ev] ||= []).push(cb); },
    url: () => urlDaArea,
    goto: async () => {
      urlDaArea = AREA;
      if (!over.semToken) {
        for (const cb of ouvintes.request || []) {
          cb({ url: () => 'https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-mensagem/v1/mensagens/quantidade-nao-lidas', headers: () => ({ authorization: 'Bearer SEGREDO-DO-PORTAL' }) });
        }
      }
    },
    reload: async () => {},
    evaluate: async (_fn: unknown, auth: string, lista: string, tipos: string, comTipos: boolean) => {
      registro.pedidos.push({ auth, lista, tipos, comTipos });
      return {
        lista: over.lista ?? { status: 200, total: '2', corpo: [BRUTA, { ...BRUTA, id: 988, lida: true }] },
        tipos: comTipos ? { status: 200, corpo: [{ chave: 'CONVOCACAO_ANEXO', descricao: 'Convocação para anexo', habilitada: true }] } : undefined,
      };
    },
    close: async () => { registro.fechadas += 1; },
  };
  const intro = {
    on: () => {},
    url: () => 'https://www.comprasnet.gov.br/intro.htm',
    frames: () => [{
      evaluate: async () => ({ url: 'https://www.comprasnet.gov.br/intro.htm', ancoras: over.links ?? LINKS, cliques: [], enderecos: [], scripts: [], itensDeMenu: [] }),
    }],
    browser: () => navegador,
  };
  const navegador = {
    on: () => {},
    off: () => { registro.desligou = true; },
    newPage: async () => area,
    pages: async () => [intro, area],
  };
  return { intro, registro };
}

/** A Área de Trabalho real: o menu leva a /assinadas/dispensa_eletronica.asp e abre no quadro "main2". */
function areaDeTrabalho() {
  const registro = { navegouPara: '' as string, novasAbas: 0, pedidoDaLista: '', pelo: '' };
  const ouvintes: Array<(x: unknown) => void> = [];
  let enderecoDoQuadro = 'https://www.comprasnet.gov.br/main2.asp';
  const disparar = (endereco: string) => {
    registro.navegouPara = endereco;
    enderecoDoQuadro = AREA;
    for (const cb of ouvintes) cb({ url: () => 'https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-usuario/v1/usuario', headers: () => ({ authorization: 'Bearer SEGREDO' }) });
  };
  const menu = {
    url: () => 'https://www.comprasnet.gov.br/t_top.asp',
    name: () => 'nav',
    evaluate: async (_fn: unknown, arg?: string) => arg !== undefined ? (registro.pelo = 'menu', disparar(arg)) : ({
      url: 'https://www.comprasnet.gov.br/t_top.asp', ancoras: [], cliques: [], enderecos: [], scripts: [],
      itensDeMenu: [
        { texto: 'Pregão e Concorrência (legado)', href: '/assinadas/pregao.asp', menu: true },
        { texto: 'Licitação e Dispensa (novo)', href: '/assinadas/dispensa_eletronica.asp', menu: true },
      ],
    }),
  };
  const quadro = {
    url: () => enderecoDoQuadro,
    name: () => 'main2',
    evaluate: async (_fn: unknown, arg?: string) => {
      if (arg === undefined) return { url: enderecoDoQuadro, ancoras: [], cliques: [], enderecos: [], scripts: [], itensDeMenu: [] };
      if (String(arg).startsWith('https://www.comprasnet.gov.br/')) {
        registro.pelo = 'quadro';
        disparar(String(arg));
        return undefined;
      }
      registro.pedidoDaLista = String(arg);
      return { lista: { status: 404, corpo: null } };
    },
  };
  const pagina = {
    on: (ev: string, cb: (x: unknown) => void) => { if (ev === 'request') ouvintes.push(cb); },
    url: () => 'https://www.comprasnet.gov.br/intro.htm',
    frames: () => [menu, quadro],
    browser: () => navegador,
    screenshot: async () => {},
  };
  const navegador = {
    on: () => {}, off: () => {},
    newPage: async () => { registro.novasAbas += 1; return pagina; },
    pages: async () => [pagina],
  };
  return { pagina, registro };
}

describe('lerCentral — Área de Trabalho do Fornecedor (reconhecimento de 17/09)', () => {
  it('dispara a navegação do quadro do menu para o main2, como o GoTo do menu, e acha o Compras.gov novo no quadro', async () => {
    const { pagina, registro } = areaDeTrabalho();
    const r = await central.lerCentral(pagina, { esperar: async () => {} });
    expect(registro.pelo).toBe('menu');
    expect(registro.navegouPara).toBe('/assinadas/dispensa_eletronica.asp');
    expect(registro.novasAbas).toBe(0); // em aba nova o portal responde accessdenied.htm
    expect(r.link).toBe('Licitação e Dispensa (novo) (endereco do menu Dispensa/Licitacao Eletronica)');
    expect(r).toMatchObject({ ok: true, total_nao_lidas: 0, endereco: AREA });
    expect(registro.pedidoDaLista).toBe('Bearer SEGREDO');
    expect(JSON.stringify(r)).not.toContain('SEGREDO');
  });
});

describe('lerCentral', () => {
  it('abre a área nova, lista só as não lidas e não deixa o token sair da leitura', async () => {
    const { intro, registro } = chrome();
    const r = await central.lerCentral(intro, { esperar: async () => {} });
    expect(r.ok).toBe(true);
    expect(r.total_nao_lidas).toBe(2);
    expect(r.notificacoes.map((n) => n.id)).toEqual(['987']);
    expect(r.endereco).toBe(AREA);
    expect(registro.pedidos).toEqual([{ auth: 'Bearer SEGREDO-DO-PORTAL', lista: '/comprasnet-mensagem/v1/mensagens?page=0&size=20&filtro=nao-lidas', tipos: '/comprasnet-mensagem/v1/destinatarios/notificacoes', comTipos: false }]);
    // Nunca a URL que marca como lida (/v1/mensagens/{id}).
    expect(JSON.stringify(registro.pedidos)).not.toMatch(/mensagens\/\d/);
    expect(JSON.stringify(r)).not.toContain('SEGREDO');
    expect(registro.fechadas).toBe(1);
    expect(registro.desligou).toBe(true);
  });

  it('reconhecer: junta links vistos e os tipos de notificação', async () => {
    const { intro } = chrome();
    const r = await central.lerCentral(intro, { reconhecer: true, esperar: async () => {} });
    expect(r.links_vistos).toContain('Compras Eletrônicas -> https://www.comprasnet.gov.br/intro/redireciona.asp');
    expect(r.tipos).toEqual([{ chave: 'CONVOCACAO_ANEXO', descricao: 'Convocação para anexo', habilitada: true }]);
  });

  it('404 da lista é "nenhuma notificação"', async () => {
    const { intro } = chrome({ lista: { status: 404, corpo: null } });
    const r = await central.lerCentral(intro, { esperar: async () => {} });
    expect(r).toMatchObject({ ok: true, total_nao_lidas: 0, notificacoes: [] });
  });

  it('sem link para a área nova, ou sem chamada autenticada: diz a etapa, sem inventar', async () => {
    const semLink = await central.lerCentral(chrome({ links: [{ texto: 'Sair', href: 'https://www.comprasnet.gov.br/sair.asp' }] }).intro, { esperar: async () => {} });
    expect(semLink).toMatchObject({ ok: false, etapa: 'link-da-area-nova' });
    expect(semLink.links_vistos).toEqual(['Sair']);

    const semToken = await central.lerCentral(chrome({ semToken: true }).intro, { esperar: async () => {} });
    expect(semToken).toMatchObject({ ok: false, etapa: 'token' });

    const erro = await central.lerCentral(chrome({ lista: { status: 401, corpo: null } }).intro, { esperar: async () => {} });
    expect(erro).toMatchObject({ ok: false, etapa: 'lista', motivo: 'A lista de notificacoes respondeu HTTP 401' });
  });
});
