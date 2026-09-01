import { describe, it, expect } from 'vitest';
import {
  avisoDeVigenciaAta,
  calcularVigencia,
  situacaoDaVigencia,
  somarMeses,
  statusEfetivo, tetoDecenal,
} from '@/lib/contratos/vigencia';

const HOJE = new Date(2026, 7, 24); // 24/08/2026

describe('somarMeses', () => {
  it('soma sem passar por fuso', () => {
    expect(somarMeses('2024-08-14', 12)).toBe('2025-08-14');
    expect(somarMeses('2024-08-14', 24)).toBe('2026-08-14');
  });

  // setMonth faz 31/01 + 1 mês virar 03/03. Ninguém entende "um mês depois"
  // de 31 de janeiro como 3 de março.
  it('não transborda o mês', () => {
    expect(somarMeses('2024-01-31', 1)).toBe('2024-02-29');
    expect(somarMeses('2025-01-31', 1)).toBe('2025-02-28');
    expect(somarMeses('2024-05-31', 1)).toBe('2024-06-30');
  });

  it('devolve nulo para data que não é data', () => {
    expect(somarMeses('', 12)).toBeNull();
    expect(somarMeses('13/08/2024', 12)).toBeNull();
  });
});

describe('calcularVigencia', () => {
  // O caso que motivou: a extração do PDF trouxe assinatura e início, deixou o
  // prazo em branco, e "Data Fim" ficava vazia esperando conta de cabeça.
  it('a ATA sem prazo informado usa o 1 ano do art. 84', () => {
    const r = calcularVigencia({ tipoDocumento: 'ata_srp', dataInicio: '2024-08-14' });
    expect(r).toEqual({ dataFim: '2025-08-14', meses: 12, inferido: true });
  });

  it('o prazo informado manda sobre o padrão legal', () => {
    const r = calcularVigencia({
      tipoDocumento: 'ata_srp', dataInicio: '2024-08-14', validadeAtaMeses: '24',
    });
    expect(r).toEqual({ dataFim: '2026-08-14', meses: 24, inferido: false });
  });

  // Contrato não tem prazo único: o art. 105 e seguintes fazem depender da
  // espécie do objeto. Inventar 12 meses aqui seria adivinhar.
  it('contrato sem prazo informado não ganha fim inventado', () => {
    const r = calcularVigencia({ tipoDocumento: 'contrato', dataInicio: '2024-08-14' });
    expect(r).toEqual({ dataFim: null, meses: null, inferido: false });
  });

  it('contrato com prazo informado calcula normalmente', () => {
    const r = calcularVigencia({
      tipoDocumento: 'contrato', dataInicio: '2024-08-14', vigenciaMeses: '30',
    });
    expect(r.dataFim).toBe('2027-02-14');
    expect(r.inferido).toBe(false);
  });

  it('cai para a data de assinatura quando o início ainda não existe', () => {
    const r = calcularVigencia({ tipoDocumento: 'ata_srp', dataAssinatura: '2024-08-13' });
    expect(r.dataFim).toBe('2025-08-13');
  });

  it('sem data alguma, não há fim', () => {
    expect(calcularVigencia({ tipoDocumento: 'ata_srp' }).dataFim).toBeNull();
  });
});

describe('avisoDeVigenciaAta', () => {
  it('cala no prazo ordinário', () => {
    expect(avisoDeVigenciaAta(12)).toBeNull();
    expect(avisoDeVigenciaAta(null)).toBeNull();
  });

  it('lembra a prorrogação entre 12 e 24 meses', () => {
    expect(avisoDeVigenciaAta(18)).toContain('prorrogação formal');
  });

  it('acusa o que passa dos 24 meses', () => {
    expect(avisoDeVigenciaAta(30)).toContain('excede o limite');
  });
});

describe('situacaoDaVigencia', () => {
  // A tela imprimia os dias crus: "Contrato vence em −375 dias". Número
  // negativo não é aviso, é defeito — e esconde o fato de estar vencido.
  it('não inverte o sinal', () => {
    const r = situacaoDaVigencia('2025-08-13', HOJE);
    expect(r.vencido).toBe(true);
    expect(r.dias).toBe(-376);
    expect(r.frase).toBe('Venceu há 376 dias');
  });

  it('diz o prazo em português nos extremos', () => {
    expect(situacaoDaVigencia('2026-08-24', HOJE).frase).toBe('Vence hoje');
    expect(situacaoDaVigencia('2026-08-25', HOJE).frase).toBe('Vence amanhã');
    expect(situacaoDaVigencia('2026-08-23', HOJE).frase).toBe('Venceu ontem');
    expect(situacaoDaVigencia('2026-10-01', HOJE).frase).toBe('Vence em 38 dias');
  });

  it('marca vencendo só dentro dos 60 dias', () => {
    expect(situacaoDaVigencia('2026-10-01', HOJE).vencendo).toBe(true);
    expect(situacaoDaVigencia('2027-01-01', HOJE).vencendo).toBe(false);
  });

  it('sem data de fim, não afirma nada', () => {
    expect(situacaoDaVigencia(null, HOJE)).toEqual({ dias: null, vencido: false, vencendo: false, frase: null });
  });
});

describe('statusEfetivo', () => {
  // O selo é coluna preenchida à mão e envelhece sozinha: ninguém volta ao
  // cadastro no dia em que o prazo acaba.
  it('a data vencida manda sobre o "Vigente" gravado', () => {
    expect(statusEfetivo('vigente', '2025-08-13', HOJE)).toBe('encerrado');
  });

  it('promove a vencendo dentro dos 60 dias', () => {
    expect(statusEfetivo('vigente', '2026-10-01', HOJE)).toBe('vencendo');
  });

  it('não mexe no que é decisão de alguém', () => {
    expect(statusEfetivo('suspenso', '2025-08-13', HOJE)).toBe('suspenso');
    expect(statusEfetivo('encerrado', '2027-01-01', HOJE)).toBe('encerrado');
  });

  it('sem data de fim, mantém o gravado', () => {
    expect(statusEfetivo('vigente', null, HOJE)).toBe('vigente');
  });
});

describe('tetoDecenal — art. 107', () => {
  it('o limite é dez anos do início', () => {
    const t = tetoDecenal('2024-10-22', '2026-10-22')!;
    expect(t.limite).toBe('2034-10-22');
    expect(t.ultrapassa).toBe(false);
  });

  it('dentro do teto com folga, a frase é tranquila', () => {
    // O 149/2024: segundo período, oito anos de margem.
    const t = tetoDecenal('2024-10-22', '2026-10-22')!;
    expect(t.ultimaProrrogacaoAnualCabe).toBe(true);
    expect(t.frase).toContain('Dentro do teto');
  });

  it('avisa quando a PRÓXIMA renovação anual já não cabe inteira', () => {
    // É agora que a decisão de relicitar precisa começar — não quando a
    // prorrogação for negada.
    const t = tetoDecenal('2024-10-22', '2034-01-15')!;
    expect(t.ultrapassa).toBe(false);
    expect(t.ultimaProrrogacaoAnualCabe).toBe(false);
    expect(t.frase).toContain('último período');
    expect(t.frase).toContain('relicitação');
  });

  it('a renovação que fecha exatamente nos dez anos ainda cabe', () => {
    const t = tetoDecenal('2024-10-22', '2032-10-22')!;
    expect(t.ultimaProrrogacaoAnualCabe).toBe(true);
  });

  it('vigência além do teto é dita como ultrapassagem', () => {
    const t = tetoDecenal('2024-10-22', '2035-01-01')!;
    expect(t.ultrapassa).toBe(true);
    expect(t.frase).toContain('passa do teto');
  });

  it('sem data de início não inventa limite', () => {
    expect(tetoDecenal(null, '2026-10-22')).toBeNull();
    expect(tetoDecenal('2024-10-22', null)).toBeNull();
  });
});
