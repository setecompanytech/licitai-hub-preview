import { describe, expect, it } from 'vitest';
import {
  resumoDosSlots,
  situacaoDoCertificado,
  slotsDeCertificado,
  type CertificadoDaEmpresa,
} from '@/lib/robo/certificados-da-conta';

/**
 * O que estes testes guardam: a diferença entre "enviado" e "no robô".
 *
 * É a confusão cara — quem acha que o certificado está registrado não envia o
 * arquivo, e descobre na manhã do pregão. O arquivo no cofre não faz o robô
 * entrar: o agente tem de ter instalado, e a senha tem de estar guardada.
 */
const empresa = (over: Partial<CertificadoDaEmpresa> = {}): CertificadoDaEmpresa => ({
  empresa_id: 'e1',
  razao_social: 'Grupo Santa Rosa',
  cnpj: '24687187000101',
  enviado_em: '2026-10-01T11:56:00.000Z',
  instalado_em: '2026-10-01T11:57:00.000Z',
  tem_senha: true,
  link_aberto: false,
  ...over,
});

describe('situacaoDoCertificado', () => {
  it('instalado pelo agente é "em-uso"', () => {
    expect(situacaoDoCertificado(empresa())).toBe('em-uso');
  });

  it('arquivo no cofre SEM instalação não é "em-uso"', () => {
    expect(situacaoDoCertificado(empresa({ instalado_em: null }))).toBe('enviado-nao-instalado');
  });

  it('sem senha guardada, não há como instalar — e isso é dito à parte', () => {
    // Os certificados enviados antes de 09/09/2026: o arquivo existe, a senha
    // foi descartada no upload. Não há como recuperá-la, só reenviar.
    expect(situacaoDoCertificado(empresa({ tem_senha: false, instalado_em: null }))).toBe('enviado-sem-senha');
  });

  it('sem senha VENCE a instalação antiga — o arquivo não serve mais', () => {
    expect(situacaoDoCertificado(empresa({ tem_senha: false }))).toBe('enviado-sem-senha');
  });

  it('nada enviado é "sem-certificado"', () => {
    expect(situacaoDoCertificado(empresa({ enviado_em: null, instalado_em: null }))).toBe('sem-certificado');
  });
});

describe('a frase de cada situação', () => {
  it('em uso diz desde quando — e nunca "válido"', () => {
    // A validade não está no cofre, só dentro do arquivo, que o sistema não
    // abre. Dizer "válido" seria afirmar o que não se leu.
    const [s] = slotsDeCertificado([empresa()]);
    expect(s.frase).toBe('No robô desde 01/10/2026');
    expect(s.frase).not.toMatch(/válido|valido/i);
  });

  it('enviado e não instalado diz as duas coisas', () => {
    const [s] = slotsDeCertificado([empresa({ instalado_em: null })]);
    expect(s.frase).toBe('Enviado em 01/10/2026, ainda não instalado no robô');
  });

  it('data inválida não vira "Invalid Date" na tela', () => {
    const [s] = slotsDeCertificado([empresa({ instalado_em: 'nao-e-data' })]);
    expect(s.frase).toBe('No robô');
  });

  it('sem certificado, o link aberto é mencionado', () => {
    const [s] = slotsDeCertificado([empresa({ enviado_em: null, instalado_em: null, link_aberto: true })]);
    expect(s.frase).toContain('link de envio aberto');
  });

  it('sem certificado e sem link, a frase não promete nada', () => {
    const [s] = slotsDeCertificado([empresa({ enviado_em: null, instalado_em: null })]);
    expect(s.frase).toBe('Nenhum certificado enviado por esta empresa');
  });
});

describe('slotsDeCertificado — a ordem', () => {
  it('quem impede o robô de entrar vem primeiro', () => {
    const r = slotsDeCertificado([
      empresa({ empresa_id: 'pronta', razao_social: 'A' }),
      empresa({ empresa_id: 'sem', razao_social: 'B', enviado_em: null, instalado_em: null }),
      empresa({ empresa_id: 'nao-instalado', razao_social: 'C', instalado_em: null }),
      empresa({ empresa_id: 'sem-senha', razao_social: 'D', tem_senha: false }),
    ]);
    expect(r.map((s) => s.empresa_id)).toEqual(['sem', 'sem-senha', 'nao-instalado', 'pronta']);
  });

  it('empate é desfeito pelo nome, para a lista não dançar entre carregamentos', () => {
    const r = slotsDeCertificado([
      empresa({ empresa_id: '1', razao_social: 'Zeta' }),
      empresa({ empresa_id: '2', razao_social: 'Alfa' }),
    ]);
    expect(r.map((s) => s.razao_social)).toEqual(['Alfa', 'Zeta']);
  });

  it('empresa sem razão social não quebra a ordenação', () => {
    const r = slotsDeCertificado([
      empresa({ empresa_id: '1', razao_social: null }),
      empresa({ empresa_id: '2', razao_social: 'Alfa' }),
    ]);
    expect(r).toHaveLength(2);
  });

  it('pedeAcao marca tudo que não está no robô', () => {
    const r = slotsDeCertificado([
      empresa({ empresa_id: 'a' }),
      empresa({ empresa_id: 'b', instalado_em: null }),
    ]);
    expect(r.find((s) => s.empresa_id === 'a')!.pedeAcao).toBe(false);
    expect(r.find((s) => s.empresa_id === 'b')!.pedeAcao).toBe(true);
  });

  it('lista vazia não quebra', () => {
    expect(slotsDeCertificado([])).toEqual([]);
  });
});

describe('resumoDosSlots', () => {
  it('diz quantas estão prontas, não "tudo certo"', () => {
    const r = resumoDosSlots(slotsDeCertificado([
      empresa({ empresa_id: 'a' }),
      empresa({ empresa_id: 'b', instalado_em: null }),
      empresa({ empresa_id: 'c', enviado_em: null, instalado_em: null }),
    ]));
    expect(r).toMatchObject({ prontas: 1, total: 3, pendentes: 2 });
    expect(r.frase).toBe('1 de 3 empresas prontas para disputar');
  });

  it('todas prontas é dito no plural certo', () => {
    expect(resumoDosSlots(slotsDeCertificado([empresa({ empresa_id: 'a' }), empresa({ empresa_id: 'b' })])).frase)
      .toBe('As 2 empresas estão prontas para disputar');
  });

  it('uma empresa só fala no singular', () => {
    expect(resumoDosSlots(slotsDeCertificado([empresa()])).frase).toBe('A empresa está pronta para disputar');
    expect(resumoDosSlots(slotsDeCertificado([empresa({ instalado_em: null })])).frase)
      .toBe('A empresa ainda não pode disputar');
  });

  it('nenhuma pronta não é escondido atrás de um número', () => {
    const r = resumoDosSlots(slotsDeCertificado([
      empresa({ empresa_id: 'a', instalado_em: null }),
      empresa({ empresa_id: 'b', enviado_em: null, instalado_em: null }),
    ]));
    expect(r.prontas).toBe(0);
    expect(r.frase).toBe('Nenhuma das 2 empresas pode disputar ainda');
  });

  it('conta sem empresa não vira "tudo certo"', () => {
    // A conta de engenharia não tem empresa nenhuma (decisão de 19/09).
    expect(resumoDosSlots([]).frase).toBe('Nenhuma empresa nesta conta');
  });
});
