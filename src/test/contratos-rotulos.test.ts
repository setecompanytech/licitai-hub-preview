import { describe, it, expect } from 'vitest';
import {
  nomeDoOrgao,
  rotuloDaAta,
  rotuloDoContrato,
  rotuloDoDocumento,
  rotuloDaAlteracao,
  especieDaAlteracao,
  objetoDaAlteracao,
  consomeLimiteDoArt125,
  ehProrrogacaoDeContinuo,
  efeitoNoLimite,
} from '@/lib/contratos/rotulos';

describe('nomeDoOrgao', () => {
  it('põe em caixa alta o que veio em caixa mista', () => {
    // Os dois casos reais da tela de Gestão de Contratos em 29/08/2026.
    expect(nomeDoOrgao('Estado do Pará | Polícia Militar do Pará'))
      .toBe('ESTADO DO PARÁ | POLÍCIA MILITAR DO PARÁ');
    expect(nomeDoOrgao('Instituto Federal de Educação, Ciência e Tecnologia do Pará Campus Belém'))
      .toBe('INSTITUTO FEDERAL DE EDUCAÇÃO, CIÊNCIA E TECNOLOGIA DO PARÁ CAMPUS BELÉM');
  });

  it('não estraga quem já estava em caixa alta', () => {
    expect(nomeDoOrgao('FUNDAÇÃO SANTA CASA DE MISERICÓRDIA DO PARÁ'))
      .toBe('FUNDAÇÃO SANTA CASA DE MISERICÓRDIA DO PARÁ');
  });

  it('colapsa espaço repetido de texto colado de PDF', () => {
    expect(nomeDoOrgao('  Corpo   de  Bombeiros \n Militar ')).toBe('CORPO DE BOMBEIROS MILITAR');
  });

  it('devolve vazio sem quebrar', () => {
    expect(nomeDoOrgao(null)).toBe('');
    expect(nomeDoOrgao(undefined)).toBe('');
  });
});

describe('rotuloDoContrato', () => {
  it('nomeia o instrumento por inteiro', () => {
    expect(rotuloDoContrato('166/2026/FSCMPA')).toBe('Contrato Administrativo n.º 166/2026/FSCMPA');
    expect(rotuloDoContrato('008/2026')).toBe('Contrato Administrativo n.º 008/2026');
  });

  it('não prefixa número que já se apresenta', () => {
    // Senão sai "Contrato Administrativo n.º Contrato 17/2025".
    expect(rotuloDoContrato('Contrato 17/2025')).toBe('Contrato 17/2025');
    expect(rotuloDoContrato('CONTRATO ADMINISTRATIVO Nº 5/2026')).toBe('CONTRATO ADMINISTRATIVO Nº 5/2026');
  });

  it('sem número, diz só o instrumento', () => {
    expect(rotuloDoContrato('')).toBe('Contrato Administrativo');
    expect(rotuloDoContrato(null)).toBe('Contrato Administrativo');
  });
});

describe('rotuloDaAta', () => {
  it('usa n.º, como o contrato', () => {
    expect(rotuloDaAta('022/2024')).toBe('ATA SRP n.º 022/2024');
  });

  it('não prefixa o que já se apresenta como ata', () => {
    expect(rotuloDaAta('ATA SRP Nº 022/2024')).toBe('ATA SRP Nº 022/2024');
    expect(rotuloDaAta('ARP 10/2025')).toBe('ARP 10/2025');
  });
});

describe('rotuloDoDocumento', () => {
  it('escolhe pelo tipo gravado', () => {
    expect(rotuloDoDocumento('ata_srp', '022/2024')).toBe('ATA SRP n.º 022/2024');
    expect(rotuloDoDocumento('contrato', '008/2026')).toBe('Contrato Administrativo n.º 008/2026');
  });

  it('tipo ausente é contrato — é o padrão da coluna', () => {
    expect(rotuloDoDocumento(null, '008/2026')).toBe('Contrato Administrativo n.º 008/2026');
  });
});

describe('especieDaAlteracao', () => {
  it('reajuste e repactuação são apostilamento, não aditivo', () => {
    // Lei 14.133/2021, art. 136, I: reajuste e repactuação de preços previstos
    // no próprio contrato são registrados por simples apostila.
    expect(especieDaAlteracao('reajuste')).toBe('apostilamento');
    expect(especieDaAlteracao('repactuacao')).toBe('apostilamento');
  });

  it('reequilíbrio é aditivo — depende de acordo das partes', () => {
    expect(especieDaAlteracao('reequilibrio')).toBe('aditivo');
  });

  it('adesão e remanejamento são instrumentos próprios da ata', () => {
    expect(especieDaAlteracao('adesao')).toBe('adesao');
    expect(especieDaAlteracao('remanejamento')).toBe('remanejamento');
  });

  it('tipo desconhecido erra para o lado exigente', () => {
    expect(especieDaAlteracao('coisa_nova')).toBe('aditivo');
    expect(especieDaAlteracao(null)).toBe('aditivo');
  });
});

describe('rotuloDaAlteracao', () => {
  it('nomeia cada instrumento pelo que ele é', () => {
    expect(rotuloDaAlteracao('prazo', 2)).toBe('Termo Aditivo n.º 2');
    expect(rotuloDaAlteracao('reajuste', 1)).toBe('Termo de Apostilamento n.º 1');
    expect(rotuloDaAlteracao('adesao', 3)).toBe('Termo de Adesão n.º 3');
    expect(rotuloDaAlteracao('remanejamento', 1)).toBe('Termo de Remanejamento n.º 1');
  });

  it('não prefixa número que já se apresenta', () => {
    expect(rotuloDaAlteracao('valor', 'Termo Aditivo 4')).toBe('Termo Aditivo 4');
  });

  it('sem número, diz só o instrumento', () => {
    expect(rotuloDaAlteracao('reajuste', null)).toBe('Termo de Apostilamento');
  });
});

describe('objetoDaAlteracao', () => {
  it('descreve o que muda', () => {
    expect(objetoDaAlteracao('prazo')).toBe('prorrogação de prazo');
    expect(objetoDaAlteracao('reequilibrio')).toBe('reequilíbrio econômico-financeiro');
  });

  it('tipo desconhecido não inventa descrição', () => {
    expect(objetoDaAlteracao('coisa_nova')).toBe('');
  });
});

describe('consomeLimiteDoArt125', () => {
  it('só alteração quantitativa consome o limite', () => {
    expect(consomeLimiteDoArt125('valor')).toBe(true);
    expect(consomeLimiteDoArt125('quantidade')).toBe(true);
    expect(consomeLimiteDoArt125('valor_quantidade')).toBe(true);
  });

  it('prazo é art. 107, não art. 125', () => {
    expect(consomeLimiteDoArt125('prazo')).toBe(false);
  });

  it('apostilamento não consome — é o ponto da distinção', () => {
    expect(consomeLimiteDoArt125('reajuste')).toBe(false);
    expect(consomeLimiteDoArt125('repactuacao')).toBe(false);
  });

  it('adesão e remanejamento não tocam o valor original', () => {
    expect(consomeLimiteDoArt125('adesao')).toBe(false);
    expect(consomeLimiteDoArt125('remanejamento')).toBe(false);
  });
});

describe('consomeLimiteDoArt125 — lista por inclusão', () => {
  it('só o que ACRESCE dentro da mesma vigência consome', () => {
    for (const t of ['valor', 'quantidade', 'valor_quantidade', 'escopo']) {
      expect(consomeLimiteDoArt125(t)).toBe(true);
    }
  });

  it('prorrogação NÃO consome — é art. 107, novo período', () => {
    // Tratá-la como acréscimo faz todo contrato contínuo estourar o limite na
    // primeira renovação, e o 149/2024 acusou 100% por isso.
    expect(consomeLimiteDoArt125('prorrogacao')).toBe(false);
    expect(ehProrrogacaoDeContinuo('prorrogacao')).toBe(true);
  });

  it('prazo isolado não consome', () => {
    expect(consomeLimiteDoArt125('prazo')).toBe(false);
  });

  it('reequilíbrio, revisão, repactuação e reajuste ficam fora do limite', () => {
    for (const t of ['reequilibrio', 'revisao', 'repactuacao', 'reajuste']) {
      expect(consomeLimiteDoArt125(t)).toBe(false);
    }
  });

  it('tipo desconhecido NÃO entra na conta por omissão', () => {
    // É a diferença entre inclusão e exclusão: com exclusão, todo tipo novo
    // passava a consumir o limite sem ninguém ter decidido isso.
    expect(consomeLimiteDoArt125('tipo_que_ainda_nao_existe')).toBe(false);
    expect(consomeLimiteDoArt125(null)).toBe(false);
  });
});

describe('efeitoNoLimite', () => {
  it('quem acresce diz que consome, com os dois tetos', () => {
    const f = efeitoNoLimite('quantidade');
    expect(f).toContain('art. 125');
    expect(f).toContain('25%');
    expect(f).toContain('50%');
  });

  it('prorrogação diz que abre novo período e não consome', () => {
    expect(efeitoNoLimite('prorrogacao')).toContain('novo período');
    expect(efeitoNoLimite('prorrogacao')).toContain('não consome');
  });

  it('o misto separa o que consome do que não', () => {
    // Prazo e quantidade no mesmo termo: só a parte do acréscimo conta.
    expect(efeitoNoLimite('prazo_quantidade')).toContain('Só a parte do acréscimo');
  });

  it('reajuste é apostila, não alteração', () => {
    expect(efeitoNoLimite('reajuste')).toContain('apostila');
  });

  it('reequilíbrio fica fora do limite', () => {
    expect(efeitoNoLimite('reequilibrio')).toContain('fora do limite');
  });

  it('tipo desconhecido não inventa efeito', () => {
    expect(efeitoNoLimite('nao_existe')).toBe('');
    expect(efeitoNoLimite(null)).toBe('');
  });
});
