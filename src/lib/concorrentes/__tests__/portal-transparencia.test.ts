import { describe, it, expect, vi } from 'vitest';
import {
  avaliarIdoneidade, cnpjsDoRegistro, consultarCadastro, janelasMensais, mensagemDaApi, mesAnoDe, registrosDoCnpj,
  urlDoCadastro, verificarIdoneidade, type ResultadoCadastro,
} from '../../../../supabase/functions/_shared/portal-transparencia';

/**
 * O módulo compartilhado das funções de borda, testado aqui porque não usa
 * `Deno.*`: chave e `fetch` entram por parâmetro. O que se prende (22/09):
 * o nome do parâmetro de cada cadastro, a conferência do filtro por CNPJ,
 * o veredito da idoneidade e as janelas mensais das licitações.
 */
const SANTA_ROSA = '24687187000101';

const resposta = (corpo: unknown, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => corpo, text: async () => JSON.stringify(corpo) }) as unknown as Response;

const registroDe = (cnpjFormatado: string) => ({
  id: 1, dataInicioSancao: '01/01/2025', orgaoSancionador: { nome: 'MEC' },
  sancionado: { nome: 'X', codigoFormatado: cnpjFormatado }, pessoa: { cnpjFormatado },
});

describe('portal da transparência — a porta única', () => {
  it('CEIS e CNEP filtram por codigoSancionado; CEPIM e leniência por cnpjSancionado; o nome antigo vai junto', () => {
    expect(urlDoCadastro('ceis', '24.687.187/0001-01')).toContain('/ceis?codigoSancionado=24687187000101&cnpjSancionado=24687187000101&pagina=1');
    expect(urlDoCadastro('cnep', SANTA_ROSA)).toContain('/cnep?codigoSancionado=');
    expect(urlDoCadastro('cepim', SANTA_ROSA)).toBe('https://api.portaldatransparencia.gov.br/api-de-dados/cepim?cnpjSancionado=24687187000101&pagina=1');
    expect(urlDoCadastro('leniencia', SANTA_ROSA)).toContain('/acordos-leniencia?cnpjSancionado=');
  });

  it('lê os CNPJs que um registro cita, em qualquer campo de CNPJ ou código', () => {
    expect(cnpjsDoRegistro(registroDe('24.687.187/0001-01'))).toEqual([SANTA_ROSA]);
    expect(cnpjsDoRegistro({ sancoes: [{ cnpj: '11222333000181' }], numeroProcesso: '12345678901234567890' })).toEqual(['11222333000181']);
    expect(cnpjsDoRegistro({ orgaoSancionador: { codigo: '26403' } })).toEqual([]);
  });

  it('a conferência do filtro: só ficam registros deste CNPJ; sem CNPJ legível, fica', () => {
    const { proprios, alheios } = registrosDoCnpj([registroDe('24.687.187/0001-01'), registroDe('11.222.333/0001-81'), { id: 9 }], SANTA_ROSA);
    expect(proprios.map((r) => r.id)).toEqual([1, 9]);
    expect(alheios).toBe(1);
  });

  it('filtro ignorado pela API é ERRO, nunca "encontrado" — o risco de acusar toda empresa', async () => {
    const fetcher = vi.fn(async () => resposta([registroDe('11.222.333/0001-81'), registroDe('99.888.777/0001-00')]));
    const r = await consultarCadastro('ceis', SANTA_ROSA, 'chave', fetcher);
    expect(r.status).toBe('erro');
    expect(r.filtroIgnorado).toBe(true);
    expect(r.registros).toEqual([]);
  });

  it('limpo, encontrado e erro HTTP com a mensagem da API', async () => {
    expect((await consultarCadastro('cnep', SANTA_ROSA, 'k', vi.fn(async () => resposta([])))).status).toBe('limpo');
    const achado = await consultarCadastro('cnep', SANTA_ROSA, 'k', vi.fn(async () => resposta([registroDe('24.687.187/0001-01')])));
    expect(achado.status).toBe('encontrado');
    expect(achado.total).toBe(1);
    const erro = await consultarCadastro('cepim', SANTA_ROSA, 'k', vi.fn(async () => resposta({ mensagem: 'Informe um CNPJ válido' }, 400)));
    expect(erro.status).toBe('erro');
    expect(erro.erro).toBe('HTTP 400: Informe um CNPJ válido');
    expect(mensagemDaApi('texto cru')).toBe('texto cru');
  });

  it('o veredito: idônea só com os quatro limpos; erro em um deles é inconclusivo; a ficha divergente vira aviso', () => {
    const limpo = (nome: string): ResultadoCadastro => ({ nome, cadastro: 'ceis', status: 'limpo', registros: [], total: 0, url: '' });
    const base = { ceis: limpo('CEIS'), cnep: limpo('CNEP'), cepim: limpo('CEPIM'), leniencia: limpo('Leniência') };
    expect(avaliarIdoneidade({ ...base, ficha: null })).toEqual({ idonea: true, inconclusiva: false, divergencias: [] });
    const comErro = avaliarIdoneidade({ ...base, cnep: { ...limpo('CNEP'), status: 'erro', erro: 'HTTP 500' }, ficha: null });
    expect(comErro).toMatchObject({ idonea: false, inconclusiva: true });
    const divergente = avaliarIdoneidade({ ...base, ficha: { sancionadoCEIS: true } });
    expect(divergente.idonea).toBe(true);
    expect(divergente.divergencias[0]).toContain('marca sanção no CEIS');
  });

  it('verificarIdoneidade junta os quatro cadastros e a ficha numa resposta só', async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.includes('/pessoa-juridica')) return resposta({ cnpj: SANTA_ROSA, possuiContratacao: true, sancionadoCEIS: false });
      return resposta([]);
    });
    const r = await verificarIdoneidade(SANTA_ROSA, 'k', fetcher);
    expect(r.idonea).toBe(true);
    expect(r.leniencia.nome).toBe('Leniência');
    expect(r.ficha?.possuiContratacao).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(5);
  });

  it('as janelas mensais das licitações: seis meses viram seis consultas de até um mês', () => {
    const j = janelasMensais('22/03/2026', '22/09/2026');
    expect(j).toHaveLength(7);
    expect(j[0]).toEqual({ de: '22/03/2026', ate: '21/04/2026' });
    expect(j[j.length - 1]).toEqual({ de: '22/09/2026', ate: '22/09/2026' });
    expect(janelasMensais('01/09/2026', '20/09/2026')).toEqual([{ de: '01/09/2026', ate: '20/09/2026' }]);
    expect(janelasMensais('30/09/2026', '01/09/2026')).toEqual([{ de: '01/09/2026', ate: '01/09/2026' }]);
    expect(mesAnoDe('22/09/2026')).toBe('09/2026');
    expect(mesAnoDe('x')).toBeNull();
  });
});
