import { describe, it, expect, vi } from 'vitest';
import {
  FRASES_AO_CLIENTE,
  NOME_AGENTE_GERENCIADO,
  agentesParaUsuario,
  comAgenteGerenciado,
  agenteCompartilhado,
  rotearSessoes,
  reduzirSaudeParaCliente,
  idsDeSessaoNaSaude,
  certificadoParaCliente,
  freioParaCliente,
  estadoDoLigado,
  erroDeTabelaAusente,
  ehAdminDaPlataforma,
  ehContaDeEngenharia,
  motivoDeNegocio,
  corpoDeErro,
  ehEstouroDeTempo,
  tentativasParaCliente,
  motivoDoCertificadoParaCliente,
  contarSessoesVivasNaSaude,
  saudeParaGuardar,
  normalizarUrlBase,
  ehUuid,
} from '../../supabase/functions/_shared/robo-plataforma';
import { chaveEsperadaNoCallback, URL_AGENTE_GERENCIADO } from '../../supabase/functions/_shared/robo-acao';

/**
 * O que é da empresa e o que é da operação Praefectus, no servidor do robô.
 *
 * Os casos que obrigaram este arquivo: o cliente via host, versão e RAM do
 * agente na própria tela, só tinha robô quem cadastrasse uma linha de agente,
 * e o /health do agente compartilhado trazia os pedidos de código de TODAS as
 * empresas da VPS.
 */

const S1 = '11111111-1111-4111-8111-111111111111'; // da empresa do usuário
const S2 = '22222222-2222-4222-8222-222222222222'; // de outra empresa
const S3 = '33333333-3333-4333-8333-333333333333'; // do usuário, encerrada

describe('agentesParaUsuario — o próprio ou o da plataforma', () => {
  const linha = { id: 'a-1', nome: 'Agente Cloud — Enterprise', url_base: 'https://agente.praefectus.com.br', api_key_hash: 'x' };

  it('quem tem linha própria usa as próprias, como antes', () => {
    const r = agentesParaUsuario([linha], { AGENTE_URL_BASE: 'https://outro.exemplo.com' });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ id: 'a-1', gerenciado: false, api_key_hash: 'x' });
  });

  it('sem linha, o agente gerenciado do segredo — sem id e sem chave de linha', () => {
    const r = agentesParaUsuario([], { AGENTE_URL_BASE: 'https://agente.praefectus.com.br/' });
    expect(r).toEqual([
      { id: null, nome: NOME_AGENTE_GERENCIADO, url_base: 'https://agente.praefectus.com.br', api_key_hash: null, gerenciado: true },
    ]);
  });

  it('linhas nulas (erro de leitura) também caem no gerenciado', () => {
    expect(agentesParaUsuario(null, { AGENTE_URL_BASE: 'https://agente.praefectus.com.br' })[0].gerenciado).toBe(true);
  });

  it('sem linha e sem segredo válido: nenhum agente — a ação diz que o robô não está disponível', () => {
    expect(agentesParaUsuario([], {})).toEqual([]);
    expect(agentesParaUsuario([], { AGENTE_URL_BASE: '' })).toEqual([]);
    expect(agentesParaUsuario([], { AGENTE_URL_BASE: 'agente.praefectus.com.br' })).toEqual([]);
    expect(agentesParaUsuario([], { AGENTE_URL_BASE: 'ftp://agente.praefectus.com.br' })).toEqual([]);
  });

  it('normaliza o endereço sem aceitar lixo', () => {
    expect(normalizarUrlBase('  http://203.0.113.10:3500///  ')).toBe('http://203.0.113.10:3500');
    expect(normalizarUrlBase(undefined)).toBeNull();
  });
});

describe('comAgenteGerenciado — sessão já aberta pode viver em qualquer um', () => {
  const env = { AGENTE_URL_BASE: 'https://agente.praefectus.com.br' };
  const doDono = { id: 'a-1', nome: 'Próprio', url_base: 'http://203.0.113.10:3500' };

  it('soma o gerenciado depois das linhas do dono', () => {
    expect(comAgenteGerenciado([doDono], env).map((a) => a.id)).toEqual(['a-1', null]);
  });

  it('põe o gerenciado na frente quando a sessão não tem vínculo', () => {
    expect(comAgenteGerenciado([doDono], env, { primeiro: true }).map((a) => a.id)).toEqual([null, 'a-1']);
  });

  it('não repete o mesmo endereço, a menos que o freio peça', () => {
    const mesmoHost = { id: 'a-2', nome: 'Cloud', url_base: 'https://agente.praefectus.com.br/' };
    expect(comAgenteGerenciado([mesmoHost], env).map((a) => a.id)).toEqual(['a-2']);
    expect(comAgenteGerenciado([mesmoHost], env, { deduplicar: false }).map((a) => a.id)).toEqual(['a-2', null]);
  });

  it('sem segredo, só as linhas', () => {
    expect(comAgenteGerenciado([doDono], {}).map((a) => a.id)).toEqual(['a-1']);
  });
});

describe('agenteCompartilhado — onde /kill-switch derrubaria outras empresas', () => {
  it('o gerenciado e toda linha que aponta para o host da plataforma', () => {
    expect(agenteCompartilhado({ id: null, url_base: 'http://x', gerenciado: true })).toBe(true);
    expect(agenteCompartilhado({ id: 'a-1', url_base: URL_AGENTE_GERENCIADO })).toBe(true);
    expect(agenteCompartilhado({ id: 'a-1', url_base: 'http://203.0.113.10:3500/' }, 'http://203.0.113.10:3500')).toBe(true);
  });

  it('servidor próprio de uma empresa não é compartilhado', () => {
    expect(agenteCompartilhado({ id: 'a-1', url_base: 'http://198.51.100.7:3500' }, 'https://agente.praefectus.com.br')).toBe(false);
    expect(agenteCompartilhado(null)).toBe(false);
  });
});

describe('rotearSessoes — em qual agente vive cada sessão', () => {
  it('vínculo casa com a linha; sem vínculo vai ao gerenciado', () => {
    const agentes = [{ id: 'a-1' }, { id: null, gerenciado: true }];
    const { porAgente, semAgente } = rotearSessoes(
      [{ id: 's1', agente_id: 'a-1' }, { id: 's2', agente_id: null }, { id: 's3', agente_id: 'linha-apagada' }],
      agentes,
    );
    expect(porAgente.get(0)).toEqual(['s1']);
    expect(porAgente.get(1)).toEqual(['s2', 's3']);
    expect(semAgente).toEqual([]);
  });

  it('sem gerenciado, a sessão sem vínculo fica sem agente — e vale a regra antiga', () => {
    const { porAgente, semAgente } = rotearSessoes([{ id: 's2', agente_id: null }], [{ id: 'a-1' }]);
    expect(porAgente.size).toBe(0);
    expect(semAgente).toEqual(['s2']);
  });
});

describe('reduzirSaudeParaCliente — a saúde que o cliente pode ver', () => {
  const completa = {
    configurado: true,
    online: true,
    agentes: [
      {
        id: 'a-1',
        nome: 'Agente Praefectus',
        url_base: 'https://agente.praefectus.com.br',
        gerenciado: true,
        online: true,
        erro: null,
        latencia_ms: 120,
        versao: '2.2.0',
        capacidade: { max_sessoes: 8, sessoes_ativas: 3, slots_disponiveis: 5, ram_total_mb: 16000 },
        sessoes_ativas: 3,
        sessoes: [
          { sessao_id: S1, status: 'ativo', portal_id: 'comprasgov', portal_nome: 'Compras.gov', edital: '90012/2026', rodada: 4,
            valor_atual: 10, valor_minimo: 8, gravador: { pasta: '/srv/agente/gravacoes/x', capturas: 3 },
            conferencia: { leu: true, ok: false, resumo: 'r', faltando: [3], sobrando_qtd: 1, divergencias: [], interno: 'x' } },
          { sessao_id: S2, status: 'ativo', portal_id: 'bll', edital: 'DE OUTRA EMPRESA' },
          { sessao_id: S3, status: 'encerrado', portal_id: 'bll', edital: 'antiga', conferencia: null },
        ],
        aguardando_humano: [
          { sessao_id: S1, tipo: 'codigo', mensagem: 'Cole o código', tela: 'gov.br', criado_em: 't', expira_em: null },
          { sessao_id: S2, tipo: 'codigo', mensagem: 'código da OUTRA empresa', tela: 'gov.br', criado_em: 't', expira_em: null },
        ],
        desfechos_humano: [{ sessao_id: S2, tipo: 'codigo', desfecho: 'atendido', em: 't' }],
        portais_suportados: ['comprasgov', 'bll'],
        certificado: {
          carregado: true,
          path: '/srv/agente/certs/certificado.pfx',
          titulares: ['MINHA EMPRESA LTDA:12345678000199', 'OUTRA EMPRESA SA:98765432000110'],
          policy_ativa: true,
          motivo: null,
        },
        kill_switch: { ok: false, http: 404, detalhe: 'o agente não implementa a rota POST /kill-switch', testado_em: '2026-09-14T10:00:00Z' },
      },
    ],
  };

  const reduzida = reduzirSaudeParaCliente(completa, [S1, S3], { cnpjsVisiveis: ['12.345.678/0001-99'] });
  const agente = reduzida.agentes[0];

  it('nenhum dado de infraestrutura atravessa', () => {
    const texto = JSON.stringify(reduzida);
    for (const proibido of ['agente.praefectus.com.br', '2.2.0', '16000', 'ram_total_mb', 'slots_disponiveis',
      'max_sessoes', 'latencia_ms', '/srv/agente', 'kill-switch', 'url_base', '"nome"', '"id"', 'gravador']) {
      expect(texto).not.toContain(proibido);
    }
    expect(Object.keys(agente).sort()).toEqual([
      'aguardando_humano', 'certificado', 'desfechos_humano', 'erro', 'kill_switch', 'online',
      'portais_suportados', 'sessoes', 'sessoes_ativas',
    ]);
  });

  it('só as sessões e os pedidos que o usuário pode ver', () => {
    expect(agente.sessoes.map((s) => s.sessao_id)).toEqual([S1, S3]);
    expect(agente.aguardando_humano).toEqual([
      { sessao_id: S1, tipo: 'codigo', mensagem: 'Cole o código', tela: 'gov.br', criado_em: 't', expira_em: null },
    ]);
    expect(agente.desfechos_humano).toEqual([]);
    expect(JSON.stringify(reduzida)).not.toContain('OUTRA empresa');
    expect(JSON.stringify(reduzida)).not.toContain('DE OUTRA EMPRESA');
  });

  it('a sessão sai com os campos que as telas leem, e a conferência sem sobra', () => {
    expect(agente.sessoes[0]).toEqual({
      sessao_id: S1, status: 'ativo', portal_id: 'comprasgov', portal_nome: 'Compras.gov', edital: '90012/2026',
      rodada: 4, valor_atual: 10,
      conferencia: { leu: true, ok: false, resumo: 'r', faltando: [3], sobrando_qtd: 1, divergencias: [] },
    });
    expect(agente.sessoes[1].conferencia).toBeNull();
  });

  it('sessoes_ativas conta só as vivas visíveis — não as da VPS inteira', () => {
    expect(agente.sessoes_ativas).toBe(1);
  });

  it('portais, freio e certificado em linguagem de negócio', () => {
    expect(agente.portais_suportados).toEqual(['comprasgov', 'bll']);
    expect(agente.kill_switch).toEqual({
      ok: false, detalhe: FRASES_AO_CLIENTE.freioNaoVerificado, testado_em: '2026-09-14T10:00:00Z',
    });
    expect(agente.certificado).toEqual({ carregado: true, motivo: null, titulares: ['MINHA EMPRESA LTDA:12345678000199'] });
  });

  it('offline: frase de negócio no lugar do erro cru, e contagem desconhecida', () => {
    const r = reduzirSaudeParaCliente(
      { configurado: true, online: false, agentes: [{ online: false, erro: 'error sending request for url (https://agente.praefectus.com.br/health)' }] },
      [],
    );
    expect(r.online).toBe(false);
    expect(r.agentes[0].erro).toBe(FRASES_AO_CLIENTE.roboForaDoAr);
    expect(r.agentes[0].sessoes_ativas).toBeNull();
    expect(JSON.stringify(r)).not.toContain('agente.praefectus');
  });

  it('sem robô continua dizendo que não há robô', () => {
    expect(reduzirSaudeParaCliente({ configurado: false, online: false, agentes: [] }, [])).toEqual({
      configurado: false, online: false, agentes: [],
    });
    expect(reduzirSaudeParaCliente(null, null)).toEqual({ configurado: false, online: false, agentes: [] });
  });

  it('ids de sessão da saúde: só os que têm forma de UUID', () => {
    const ids = idsDeSessaoNaSaude({
      agentes: [{ sessoes: [{ sessao_id: S1 }, { sessao_id: 'teste-local' }], aguardando_humano: [{ sessao_id: S2 }], desfechos_humano: [{ sessao_id: S2 }] }],
    });
    expect(ids.sort()).toEqual([S1, S2].sort());
    expect(ehUuid(S1)).toBe(true);
    expect(ehUuid('teste-local')).toBe(false);
  });

  /**
   * Quem OPERA o robô sem ser a conta de engenharia (19/09/2026) — o admin da
   * Santa Rosa: o webhook passa TODAS as sessões da saúde como visíveis. Ele
   * precisa do captcha e das sessões de qualquer empresa (a tela remota é
   * compartilhada), mas não da oficina técnica nem do certificado alheio.
   */
  it('quem opera: sessões e pedidos de todas as empresas, sem infraestrutura nem certificado alheio', () => {
    const operacao = reduzirSaudeParaCliente(completa, idsDeSessaoNaSaude(completa), { cnpjsVisiveis: ['12345678000199'] });
    const a = operacao.agentes[0];
    expect(a.sessoes.map((s) => s.sessao_id)).toEqual([S1, S2, S3]);
    expect(a.aguardando_humano.map((p) => p.sessao_id)).toEqual([S1, S2]);
    expect(a.sessoes_ativas).toBe(2);
    const texto = JSON.stringify(operacao);
    for (const proibido of ['agente.praefectus.com.br', '2.2.0', '16000', 'ram_total_mb', 'url_base', '/srv/agente', 'OUTRA EMPRESA SA']) {
      expect(texto).not.toContain(proibido);
    }
  });
});

describe('certificadoParaCliente — o verde não pode vir do certificado de outra empresa', () => {
  it('agente carregado só com o certificado alheio não é "carregado" para mim', () => {
    const r = certificadoParaCliente({ carregado: true, titulares: ['OUTRA EMPRESA SA:98765432000110'] }, ['12345678000199']);
    expect(r).toEqual({ carregado: false, motivo: FRASES_AO_CLIENTE.certificadoAusenteNoRobo, titulares: [] });
  });

  it('sem CNPJ conhecido, nenhum titular sai', () => {
    expect(certificadoParaCliente({ carregado: true, titulares: ['X:12345678000199'] }, undefined)?.titulares).toEqual([]);
  });

  it('sem certificado na saúde, null', () => {
    expect(certificadoParaCliente(null, ['12345678000199'])).toBeNull();
  });
});

describe('freioParaCliente', () => {
  it('confirmado não leva detalhe; ausente é null', () => {
    expect(freioParaCliente({ ok: true, http: 200, detalhe: null, testado_em: 't' })).toEqual({ ok: true, detalhe: null, testado_em: 't' });
    expect(freioParaCliente(null)).toBeNull();
  });
});

describe('estadoDoLigado — o robô da empresa', () => {
  it('sem linha ou sem tabela = ligado (ninguém escolheu desligar)', () => {
    expect(estadoDoLigado({ data: null, error: null }).estado).toBe('ligado');
    expect(estadoDoLigado({ data: null, error: { code: '42P01', message: 'relation "public.robo_empresa_config" does not exist' } }))
      .toMatchObject({ estado: 'ligado', origem: 'tabela-ausente' });
    expect(estadoDoLigado({ error: { code: 'PGRST205', message: "Could not find the table 'public.robo_empresa_config' in the schema cache" } }).estado)
      .toBe('ligado');
  });

  it('linha diz o que vale', () => {
    expect(estadoDoLigado({ data: { ligado: false } }).estado).toBe('desligado');
    expect(estadoDoLigado({ data: { ligado: true } }).estado).toBe('ligado');
  });

  it('outro erro é indeterminado — nunca atropela um "desligado"', () => {
    expect(estadoDoLigado({ error: { code: '57014', message: 'canceling statement due to statement timeout' } }))
      .toEqual({ estado: 'indeterminado', origem: 'erro', detalhe: 'canceling statement due to statement timeout' });
  });

  it('erroDeTabelaAusente não confunde permissão com ausência', () => {
    expect(erroDeTabelaAusente({ code: '42501', message: 'permission denied for table robo_empresa_config' })).toBe(false);
    expect(erroDeTabelaAusente(null)).toBe(false);
  });
});

describe('ehAdminDaPlataforma — user_roles, uma consulta por requisição', () => {
  function clienteFalso(resposta: { data?: unknown; error?: unknown }) {
    const limit = vi.fn().mockResolvedValue(resposta);
    const eqRole = vi.fn(() => ({ limit }));
    const eqUser = vi.fn(() => ({ eq: eqRole }));
    const select = vi.fn(() => ({ eq: eqUser }));
    const from = vi.fn(() => ({ select }));
    return { cliente: { from }, from, eqUser, eqRole };
  }

  it('reconhece o admin da plataforma', async () => {
    const { cliente, from, eqUser, eqRole } = clienteFalso({ data: [{ role: 'admin' }], error: null });
    expect(await ehAdminDaPlataforma(cliente, 'u-1')).toBe(true);
    expect(from).toHaveBeenCalledWith('user_roles');
    expect(eqUser).toHaveBeenCalledWith('user_id', 'u-1');
    expect(eqRole).toHaveBeenCalledWith('role', 'admin');
  });

  it('pergunta uma vez só por cliente e usuário', async () => {
    const { cliente, from } = clienteFalso({ data: [], error: null });
    expect(await ehAdminDaPlataforma(cliente, 'u-2')).toBe(false);
    expect(await ehAdminDaPlataforma(cliente, 'u-2')).toBe(false);
    expect(from).toHaveBeenCalledTimes(1);
  });

  it('erro de leitura e usuário ausente respondem false — a visão que não expõe nada', async () => {
    const silenciar = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { cliente } = clienteFalso({ data: null, error: { message: 'boom' } });
    expect(await ehAdminDaPlataforma(cliente, 'u-3')).toBe(false);
    expect(await ehAdminDaPlataforma(cliente, null)).toBe(false);
    silenciar.mockRestore();
  });
});

/**
 * A conta de engenharia (19/09/2026): admin da plataforma SEM empresa. É ela, e
 * não todo admin, quem recebe o cru técnico do webhook (`verDetalhe`); a
 * operação — tela remota, captcha, avisos — segue com todo admin, inclusive o
 * da Santa Rosa (operação × oficina técnica).
 */
describe('conta de engenharia — o cru técnico do webhook', () => {
  /** Cliente falso que responde por tabela: user_roles e empresa_membros. */
  function clientePorTabela(respostas: Record<string, { data?: unknown; error?: unknown }>) {
    const from = vi.fn((tabela: string) => {
      const resposta = respostas[tabela] ?? { data: [], error: null };
      const encadeado: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'in']) encadeado[m] = vi.fn(() => encadeado);
      encadeado.limit = vi.fn().mockResolvedValue(resposta);
      encadeado.then = (ok: (v: unknown) => unknown, falha?: (e: unknown) => unknown) =>
        Promise.resolve(resposta).then(ok, falha);
      return encadeado;
    });
    return { cliente: { from }, from };
  }

  it('admin sem empresa é a conta de engenharia; admin com empresa, não', async () => {
    const engsoft = clientePorTabela({ user_roles: { data: [{ role: 'admin' }] }, empresa_membros: { data: [] } });
    expect(await ehContaDeEngenharia(engsoft.cliente, 'u-engsoft')).toBe(true);

    const santaRosa = clientePorTabela({ user_roles: { data: [{ role: 'admin' }] }, empresa_membros: { data: [{ user_id: 'u-sr' }] } });
    expect(await ehContaDeEngenharia(santaRosa.cliente, 'u-sr')).toBe(false);
  });

  it('quem não é admin nem chega a consultar as empresas', async () => {
    const { cliente, from } = clientePorTabela({ user_roles: { data: [] } });
    expect(await ehContaDeEngenharia(cliente, 'u-cliente')).toBe(false);
    expect(from).not.toHaveBeenCalledWith('empresa_membros');
  });

  it('falha ao ler as empresas responde false — a visão do cliente', async () => {
    const silenciar = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { cliente } = clientePorTabela({ user_roles: { data: [{ role: 'admin' }] }, empresa_membros: { data: null, error: { message: 'boom' } } });
    expect(await ehContaDeEngenharia(cliente, 'u-x')).toBe(false);
    silenciar.mockRestore();
  });
});

describe('frases ao cliente', () => {
  it('motivoDeNegocio traduz a recusa crua do agente', () => {
    expect(motivoDeNegocio('Login falhou: usuário ou senha incorretos')).toBe(FRASES_AO_CLIENTE.acessoRecusado);
    expect(motivoDeNegocio('Login com certificado digital falhou')).toBe(FRASES_AO_CLIENTE.certificadoRecusado);
    expect(motivoDeNegocio('Sem slots livres para abrir o navegador')).toBe(FRASES_AO_CLIENTE.capacidadeOcupada);
    expect(motivoDeNegocio('Portal "compras-gov" não suportado')).toBe(FRASES_AO_CLIENTE.portalNaoOperado);
    expect(motivoDeNegocio('error sending request for url (https://agente.praefectus.com.br/sessao/iniciar)'))
      .toBe(FRASES_AO_CLIENTE.roboForaDoAr);
    expect(motivoDeNegocio('Signal timed out.')).toBe(FRASES_AO_CLIENTE.semRespostaATempo);
    expect(motivoDeNegocio('TypeError: cannot read properties of undefined')).toBe(FRASES_AO_CLIENTE.sessaoNaoIniciada);
    expect(motivoDeNegocio(undefined, 'padrão')).toBe('padrão');
  });

  it('corpoDeErro só entrega o detalhe técnico com verDetalhe (a conta de engenharia)', () => {
    expect(corpoDeErro('Frase.', { verDetalhe: false, detalhe: 'HTTP 502 em http://203.0.113.10' })).toEqual({ error: 'Frase.' });
    expect(corpoDeErro('Frase.', { verDetalhe: true, detalhe: 'HTTP 502', extra: { success: false } }))
      .toEqual({ success: false, error: 'Frase.', detalhe_tecnico: 'HTTP 502' });
  });

  it('extra não sobrescreve a frase', () => {
    expect(corpoDeErro('Frase.', { extra: { error: 'cru' } }).error).toBe('Frase.');
  });

  it('estouro de tempo se distingue de recusa', () => {
    expect(ehEstouroDeTempo(Object.assign(new Error('x'), { name: 'TimeoutError' }))).toBe(true);
    expect(ehEstouroDeTempo(new Error('connection refused'))).toBe(false);
  });

  it('tentativas de parada sem nome de agente nem erro cru', () => {
    expect(tentativasParaCliente([{ agente: 'Agente Cloud', status: 502, motivo: 'fetch failed' }]))
      .toEqual([{ motivo: FRASES_AO_CLIENTE.paradaSemConfirmacao }]);
    expect(tentativasParaCliente([{ agente: null, motivo: 'Nenhum agente configurado' }]))
      .toEqual([{ motivo: FRASES_AO_CLIENTE.semRobo }]);
    expect(tentativasParaCliente([{ agente: 'A', confirmou: true }])).toEqual([]);
  });

  it('motivo do certificado: passa o que orienta, esconde o técnico', () => {
    expect(motivoDoCertificadoParaCliente('Nenhum certificado enviado ainda.')).toBe('Nenhum certificado enviado ainda.');
    expect(motivoDoCertificadoParaCliente('Falha ao importar o certificado: pk12util: PKCS12 decode failed, bad password'))
      .toBe(FRASES_AO_CLIENTE.certificadoSenha);
    expect(motivoDoCertificadoParaCliente('Não foi possível falar com o agente: fetch failed'))
      .toBe(FRASES_AO_CLIENTE.certificadoNaoInstalado);
    expect(motivoDoCertificadoParaCliente(null)).toBeNull();
  });
});

describe('guardar e contar a saúde do agente', () => {
  it('a linha não guarda sessões, pedidos nem titulares de outras empresas', () => {
    expect(saudeParaGuardar({ version: '2.2.0', capacidade: { max_sessoes: 8 }, sessoes: [1], aguardando_humano: [1], desfechos_humano: [1], certificado: {} }))
      .toEqual({ version: '2.2.0', capacidade: { max_sessoes: 8 } });
    expect(saudeParaGuardar(null)).toBeNull();
  });

  it('sessões vivas no agente: o maior entre capacidade e lista', () => {
    expect(contarSessoesVivasNaSaude({ capacidade: { sessoes_ativas: 2 }, sessoes: [{ status: 'ativo' }] })).toBe(2);
    expect(contarSessoesVivasNaSaude({ capacidade: { sessoes_ativas: 0 }, sessoes: [{ status: 'pausado' }, { status: 'encerrado' }] })).toBe(1);
    expect(contarSessoesVivasNaSaude(null)).toBe(0);
  });
});

describe('chaveEsperadaNoCallback — a sessão do agente gerenciado não tem linha', () => {
  it('sem linha de agente, vale o segredo', () => {
    expect(chaveEsperadaNoCallback(null, 'segredo')).toBe('segredo');
  });

  it('sem linha e sem segredo, vazio — e o callback recusa', () => {
    expect(chaveEsperadaNoCallback(null, null)).toBe('');
  });

  it('com linha, a regra de sempre', () => {
    expect(chaveEsperadaNoCallback({ url_base: URL_AGENTE_GERENCIADO, api_key_hash: 'velha' }, 'segredo')).toBe('segredo');
    expect(chaveEsperadaNoCallback({ url_base: 'http://203.0.113.10:3001', api_key_hash: 'do-dono' }, 'segredo')).toBe('do-dono');
  });
});
