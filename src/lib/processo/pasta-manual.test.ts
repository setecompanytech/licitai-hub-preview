import { describe, it, expect } from 'vitest';
import { TODOS_PORTAIS } from '@/data/portais-compras';
import { idDoPortal, portalDoAgente } from '@/lib/robo/portais';
import {
  OPCOES_MODALIDADE,
  OPCOES_SISTEMA,
  SISTEMA_OUTRO,
  dataHoraLocalParaIso,
  filtrarSistemas,
  formularioVazio,
  montarEditalData,
  portalParaGravar,
  sugerirTipoDoArquivo,
  validarPastaManual,
} from './pasta-manual';

describe('portal gravado pela pasta manual', () => {
  it('Banparanet grava o nome que o Robô de Lances reconhece', () => {
    const portal = portalParaGravar('banparanet', '');
    expect(portal).toBe('Banparanet (PA)');
    expect(idDoPortal(portal)).toBe('banparanet');
    expect(portalDoAgente(portal)).toBe('banparanet');
  });

  it('Compras.gov.br grava o nome do robô, não o do catálogo', () => {
    const portal = portalParaGravar('compras-gov', '');
    expect(portal).toBe('Compras.gov.br');
    expect(idDoPortal(portal)).toBe('compras-gov');
  });

  it('portal que o robô não conhece fica com o nome do catálogo', () => {
    const catalogo = TODOS_PORTAIS.find((p) => p.id === 'compras-to')!;
    expect(portalParaGravar('compras-to', '')).toBe(catalogo.nome);
    expect(idDoPortal(catalogo.nome)).toBeNull();
  });

  it('"Outro" grava o texto digitado', () => {
    expect(portalParaGravar(SISTEMA_OUTRO, '  Licitações da Prefeitura X ')).toBe('Licitações da Prefeitura X');
    expect(portalParaGravar(SISTEMA_OUTRO, '   ')).toBeNull();
  });

  it('mostra o Banparanet como sistema Paradigma e acha pela palavra', () => {
    expect(OPCOES_SISTEMA.find((o) => o.id === 'banparanet')?.rotulo).toBe('Banparanet (Pará) — sistema Paradigma');
    expect(filtrarSistemas('paradigma').map((o) => o.id)).toContain('banparanet');
    expect(filtrarSistemas('Pará banparanet').map((o) => o.id)).toEqual(['banparanet']);
  });
});

describe('vocabulários', () => {
  it('Dispensa Eletrônica vem primeiro e nenhuma modalidade se repete', () => {
    expect(OPCOES_MODALIDADE[0]).toBe('Dispensa Eletrônica');
    expect(OPCOES_MODALIDADE).toContain('Pregão Eletrônico');
    expect(OPCOES_MODALIDADE).toContain('Inexigibilidade');
    expect(new Set(OPCOES_MODALIDADE).size).toBe(OPCOES_MODALIDADE.length);
  });
});

describe('sugestão do tipo pelo nome do arquivo', () => {
  it.each([
    ['EDITAL_DISPENSA_ELETRONICA_012-2026.pdf', 'edital'],
    ['Termo de Referência.pdf', 'termo_referencia'],
    ['termo_referencia_insumos.docx', 'termo_referencia'],
    ['TR - material.pdf', 'termo_referencia'],
    ['Anexo II - Edital.pdf', 'anexo_edital'],
    ['Planilha de itens.xlsx', 'anexo_edital'],
    ['tratamento.pdf', 'anexo_edital'],
  ])('%s → %s', (nome, tipo) => {
    expect(sugerirTipoDoArquivo(nome)).toBe(tipo);
  });
});

describe('formulário', () => {
  it('data e hora digitadas continuam sendo a mesma hora local depois de gravadas', () => {
    const iso = dataHoraLocalParaIso('2026-09-20T09:30')!;
    const d = new Date(iso);
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 9, 20, 9, 30]);
    expect(dataHoraLocalParaIso('20/09/2026')).toBeNull();
  });

  it('recusa CNPJ incompleto, link que não é web, valor ilegível e "Outro" sem nome', () => {
    const erros = validarPastaManual({
      ...formularioVazio(),
      numero: '12/2026',
      orgao: 'Secretaria',
      objeto: 'Insumos',
      cnpj: '12.345.678/0001',
      sistemaId: SISTEMA_OUTRO,
      url: 'javascript:alert(1)',
      valor: 'doze mil',
    });
    expect(Object.keys(erros).sort()).toEqual(['cnpj', 'sistemaOutro', 'url', 'valor']);
  });

  it('monta os dados do processo no formato do monitoramento', () => {
    const dados = montarEditalData({
      ...formularioVazio(),
      numero: ' DE 12/2026 ',
      orgao: 'Secretaria de Saúde',
      objeto: 'Insumos',
      cnpj: '12.345.678/0001-90',
      sistemaId: 'banparanet',
      url: 'cotacao.banpara.b.br/portal/Mural.aspx',
      uf: 'PA',
      valor: '12.500,00',
    });
    expect(dados).toMatchObject({
      numero: 'DE 12/2026',
      modalidade: 'Dispensa Eletrônica',
      portal: 'Banparanet (PA)',
      url: 'https://cotacao.banpara.b.br/portal/Mural.aspx',
      cnpjOrgao: '12345678000190',
      valor_estimado: 12500,
      data_abertura: null,
      data_encerramento: null,
    });
  });
});
