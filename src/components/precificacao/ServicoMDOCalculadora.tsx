import { useState } from 'react';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Calculator, Loader2, FileText, Download, ExternalLink, ShieldCheck, Sparkles, Info, Save, Users, HardHat, Building2, Calendar, Clock, Briefcase
} from 'lucide-react';
import { streamAIChat } from '@/lib/ai-stream';
import { toast } from 'sonner';

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatCurrencyInput = (raw: string): string => {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  const num = parseInt(digits, 10) / 100;
  if (num <= 0) return '';
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const parseCurrencyInput = (formatted: string): number => {
  const digits = formatted.replace(/\D/g, '');
  if (!digits) return 0;
  return parseInt(digits, 10) / 100;
};

const UF_LIST = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
];

interface ServicoMDOProps {
  regimeLabel: string;
  regime: string;
  ufCalculo: string;
  ufNome: string;
  licitacaoNumero: string;
  licitacaoOrgao: string;
}

export default function ServicoMDOCalculadora({
  regimeLabel, regime, ufCalculo, ufNome, licitacaoNumero, licitacaoOrgao
}: ServicoMDOProps) {
  const { empresaAtiva } = useEmpresa();
  const { user } = useAuth();

  // ── Dados da Contratação ──
  const [nrProcesso, setNrProcesso] = useState('');
  const [nrContratacao, setNrContratacao] = useState('');
  const [descricaoServico, setDescricaoServico] = useState('');
  const [unidadeMedida, setUnidadeMedida] = useState('Posto de Trabalho');
  const [categoriaServico, setCategoriaServico] = useState('limpeza');
  const [dataProposta, setDataProposta] = useState(new Date().toISOString().split('T')[0]);
  const [municipioServico, setMunicipioServico] = useState('');
  const [ufServico, setUfServico] = useState(ufCalculo);
  const [convencaoColetiva, setConvencaoColetiva] = useState('');
  const [nrRegistroCCT, setNrRegistroCCT] = useState('');
  const [vigenciaCCT, setVigenciaCCT] = useState('');

  // ── Módulo 1 — Composição da Remuneração ──
  const [cargoFuncao, setCargoFuncao] = useState('');
  const [cboFuncao, setCboFuncao] = useState('');
  const [salarioBase, setSalarioBase] = useState('');
  const [adicPericulosidade, setAdicPericulosidade] = useState('0');
  const [adicInsalubridade, setAdicInsalubridade] = useState('0');
  const [grauInsalubridade, setGrauInsalubridade] = useState<'minimo' | 'medio' | 'maximo'>('minimo');
  const [adicNoturno, setAdicNoturno] = useState('0');
  const [horasNoturnas, setHorasNoturnas] = useState('0');
  const [adicHoraExtra, setAdicHoraExtra] = useState('0');
  const [intervaloIntrajornada, setIntervaloIntrajornada] = useState('0');
  const [dsr, setDsr] = useState(true);
  const [qtdProfissionais, setQtdProfissionais] = useState('1');
  const [cargaHoraria, setCargaHoraria] = useState('44');
  const [jornada, setJornada] = useState<'diurna' | 'noturna' | '12x36'>('diurna');

  // ── Módulo 2 — Benefícios ──
  const [valeTransporte, setValeTransporte] = useState('');
  const [descontoVT, setDescontoVT] = useState('6');
  const [valeAlimentacao, setValeAlimentacao] = useState('');
  const [descontoVA, setDescontoVA] = useState('0');
  const [assistenciaMedica, setAssistenciaMedica] = useState('');
  const [seguroVida, setSeguroVida] = useState('');
  const [auxilCreche, setAuxilCreche] = useState('');

  // ── Módulo 3 — Provisão para Rescisão (% calculados) ──
  const [multaFGTS, setMultaFGTS] = useState('40');
  const [avisoPrevioIndenizado, setAvisoPrevioIndenizado] = useState('0.42');
  const [avisoPrevioTrabalhado, setAvisoPrevioTrabalhado] = useState('1.94');

  // ── Módulo 4 — Custo de Reposição ──
  const [coberturaSuplente, setCoberturaSuplente] = useState(false);

  // ── Módulo 5 — Insumos Diversos ──
  const [uniformes, setUniformes] = useState('');
  const [qtdUniformes, setQtdUniformes] = useState('2');
  const [epiMateriais, setEpiMateriais] = useState('');
  const [equipamentos, setEquipamentos] = useState('');
  const [materiaisLimpeza, setMateriaisLimpeza] = useState('');

  // ── Módulo 6 — Custos Indiretos, Tributos e Lucro ──
  const [custoIndiretoPerc, setCustoIndiretoPerc] = useState('5');
  const [lucroPerc, setLucroPerc] = useState('10');
  const [issPerc, setIssPerc] = useState('5');
  const [pisPerc, setPisPerc] = useState(regime === 'lucro_real' ? '1.65' : '0.65');
  const [cofinsPerc, setCofinsPerc] = useState(regime === 'lucro_real' ? '7.60' : '3.00');

  // ── Resultados ──
  const [mdoIaResult, setMdoIaResult] = useState('');
  const [mdoLoading, setMdoLoading] = useState(false);
  const [savingCatalogo, setSavingCatalogo] = useState(false);

  const gerarPlanilhaMDO = async () => {
    const sal = parseCurrencyInput(salarioBase);
    if (!sal || sal <= 0) { toast.error('Informe o salário-base.'); return; }
    if (!cargoFuncao.trim()) { toast.error('Informe o cargo/função.'); return; }
    setMdoLoading(true);
    setMdoIaResult('');

    const vt = parseCurrencyInput(valeTransporte);
    const va = parseCurrencyInput(valeAlimentacao);
    const am = parseCurrencyInput(assistenciaMedica);
    const sv = parseCurrencyInput(seguroVida);
    const ac = parseCurrencyInput(auxilCreche);
    const uni = parseCurrencyInput(uniformes);
    const epi = parseCurrencyInput(epiMateriais);
    const equip = parseCurrencyInput(equipamentos);
    const matLimp = parseCurrencyInput(materiaisLimpeza);
    const qtd = parseInt(qtdProfissionais) || 1;
    const ch = parseInt(cargaHoraria) || 44;
    const adPerc = parseFloat(adicPericulosidade) || 0;
    const aiPerc = parseFloat(adicInsalubridade) || 0;
    const anPerc = parseFloat(adicNoturno) || 0;
    const hePerc = parseFloat(adicHoraExtra) || 0;
    const ciPerc = parseFloat(custoIndiretoPerc) || 5;
    const luPerc = parseFloat(lucroPerc) || 10;
    const iss = parseFloat(issPerc) || 5;
    const pis = parseFloat(pisPerc) || 0.65;
    const cofins = parseFloat(cofinsPerc) || 3;
    const descVT = parseFloat(descontoVT) || 6;
    const descVA = parseFloat(descontoVA) || 0;

    const prompt = `Gere a PLANILHA DE CUSTOS E FORMAÇÃO DE PREÇOS conforme modelo oficial do PORTAL DE COMPRAS DO GOVERNO FEDERAL, em conformidade com:
- Lei nº 14.133/2021 (Nova Lei de Licitações e Contratos)
- Instrução Normativa SEGES/ME nº 5/2017 (Anexo VII-D)
- Acórdãos TCU nº 1.753/2008 e 786/2006 (encargos sociais e trabalhistas)
- Súmula TST nº 331 (terceirização lícita)

═══════════════════════════════════════════════════
DADOS DA CONTRATAÇÃO
═══════════════════════════════════════════════════
- Nº do Processo: ${nrProcesso || 'N/A'}
- Nº da Contratação: ${nrContratacao || licitacaoNumero || 'N/A'}
- Órgão: ${licitacaoOrgao || 'N/A'}
- Descrição do Serviço: ${descricaoServico || categoriaServico}
- Categoria do Serviço: ${categoriaServico}
- Unidade de Medida: ${unidadeMedida}
- Data da Proposta: ${dataProposta}
- Município/UF: ${municipioServico || 'N/A'} / ${ufServico}

CONVENÇÃO COLETIVA DE TRABALHO (CCT):
- Sindicato/Convenção: ${convencaoColetiva || 'A definir'}
- Nº Registro no MTE: ${nrRegistroCCT || 'N/A'}
- Vigência: ${vigenciaCCT || 'N/A'}

═══════════════════════════════════════════════════
DADOS DO PROFISSIONAL
═══════════════════════════════════════════════════
- Cargo/Função: ${cargoFuncao}
- CBO: ${cboFuncao || 'N/A'}
- Quantidade de profissionais: ${qtd}
- Carga horária semanal: ${ch}h
- Jornada: ${jornada === '12x36' ? '12x36 horas' : jornada === 'noturna' ? 'Noturna' : 'Diurna'}
- Salário-base mensal (piso CCT): R$ ${sal.toFixed(2)}
- Adicional de periculosidade: ${adPerc}% ${adPerc > 0 ? '(Art. 193, CLT / NR-16)' : ''}
- Adicional de insalubridade: ${aiPerc}% (Grau: ${grauInsalubridade}) ${aiPerc > 0 ? '(Art. 192, CLT / NR-15)' : ''}
- Adicional noturno: ${anPerc}% sobre ${horasNoturnas}h ${anPerc > 0 ? '(Art. 73, CLT - mín. 20%)' : ''}
- Hora extra habitual: ${hePerc}% ${hePerc > 0 ? '(Art. 7º, XVI, CF - mín. 50%)' : ''}
- DSR (Descanso Semanal Remunerado): ${dsr ? 'Sim' : 'Não'}
- Intervalo intrajornada: ${intervaloIntrajornada}h

═══════════════════════════════════════════════════
BENEFÍCIOS (valores mensais)
═══════════════════════════════════════════════════
- Vale-Transporte: R$ ${vt.toFixed(2)} (desconto do empregado: ${descVT}% do salário - Lei 7.418/85)
- Vale-Alimentação/Refeição: R$ ${va.toFixed(2)} (desconto do empregado: ${descVA}%)
- Assistência Médica Suplementar: R$ ${am.toFixed(2)}
- Seguro de Vida, Invalidez e Funeral: R$ ${sv.toFixed(2)}
- Auxílio-Creche: R$ ${ac.toFixed(2)}

═══════════════════════════════════════════════════
INSUMOS
═══════════════════════════════════════════════════
- Uniformes: R$ ${uni.toFixed(2)} (${qtdUniformes} jogos/ano)
- EPIs e Materiais: R$ ${epi.toFixed(2)}
- Equipamentos: R$ ${equip.toFixed(2)}
- Materiais de Limpeza/Consumo: R$ ${matLimp.toFixed(2)}

═══════════════════════════════════════════════════
MÓDULO 6
═══════════════════════════════════════════════════
- Custos indiretos: ${ciPerc}%
- Lucro: ${luPerc}%
- REGIME TRIBUTÁRIO: ${regimeLabel}
- PIS: ${pis}%
- COFINS: ${cofins}%
- ISS: ${iss}%
${regime === 'simples_nacional' ? '- NOTA: Empresa optante pelo Simples Nacional — usar alíquota efetiva do DAS conforme RBT12.' : ''}

═══════════════════════════════════════════════════
PROVISÃO PARA RESCISÃO (Módulo 3)
═══════════════════════════════════════════════════
- Aviso Prévio Indenizado: ${avisoPrevioIndenizado}%
- Aviso Prévio Trabalhado: ${avisoPrevioTrabalhado}%
- Multa do FGTS (rescisão sem justa causa): ${multaFGTS}%
- Incluir cobertura de profissional suplente: ${coberturaSuplente ? 'Sim' : 'Não'}

INSTRUÇÕES — Gere em JSON seguindo RIGOROSAMENTE esta estrutura completa do Portal de Compras:
{
  "dados_contratacao": {
    "nr_processo": "",
    "nr_contratacao": "",
    "orgao": "",
    "descricao_servico": "",
    "unidade_medida": "",
    "data_proposta": "",
    "municipio_uf": "",
    "convencao_coletiva": "",
    "nr_registro_cct": "",
    "vigencia_cct": ""
  },
  "identificacao_profissional": {
    "cargo_funcao": "",
    "cbo": "",
    "salario_normativo_cct": 0.00,
    "carga_horaria_semanal": 0,
    "jornada": ""
  },
  "modulo1_remuneracao": {
    "titulo": "Módulo 1 – Composição da Remuneração",
    "itens": [
      {"id": "1A", "descricao": "Salário-base", "valor": 0.00, "referencia": "Piso CCT"},
      {"id": "1B", "descricao": "Adicional de Periculosidade", "percentual": 0, "valor": 0.00, "referencia": "Art. 193, CLT"},
      {"id": "1C", "descricao": "Adicional de Insalubridade", "percentual": 0, "valor": 0.00, "referencia": "Art. 192, CLT"},
      {"id": "1D", "descricao": "Adicional Noturno", "percentual": 0, "valor": 0.00, "referencia": "Art. 73, CLT"},
      {"id": "1E", "descricao": "Hora Extra", "percentual": 0, "valor": 0.00, "referencia": "Art. 7º, XVI, CF"},
      {"id": "1F", "descricao": "DSR sobre hora extra/adicional noturno", "percentual": 0, "valor": 0.00, "referencia": "Lei 605/49"},
      {"id": "1G", "descricao": "Intervalo Intrajornada", "valor": 0.00, "referencia": "Art. 71, CLT"},
      {"id": "1H", "descricao": "Outros (especificar)", "valor": 0.00}
    ],
    "subtotal": 0.00
  },
  "modulo2_encargos": {
    "titulo": "Módulo 2 – Encargos e Benefícios Anuais, Mensais e Diários",
    "submodulo2_1": {
      "titulo": "Submódulo 2.1 – 13º (Décimo Terceiro) Salário, Férias e Adicional de Férias",
      "itens": [
        {"id": "2.1A", "descricao": "13º Salário", "percentual": 8.33, "valor": 0.00, "referencia": "Art. 7º, VIII, CF"},
        {"id": "2.1B", "descricao": "Férias e Adicional de Férias", "percentual": 12.10, "valor": 0.00, "referencia": "Art. 7º, XVII, CF"}
      ],
      "subtotal": 0.00
    },
    "submodulo2_2": {
      "titulo": "Submódulo 2.2 – Encargos Previdenciários (GPS), FGTS e outras contribuições",
      "itens": [
        {"id": "2.2A", "descricao": "INSS Patronal", "percentual": 20.00, "valor": 0.00, "referencia": "Art. 22, Lei 8.212/91"},
        {"id": "2.2B", "descricao": "Salário Educação", "percentual": 2.50, "valor": 0.00, "referencia": "Art. 3º, Lei 9.424/96"},
        {"id": "2.2C", "descricao": "SAT/RAT × FAP", "percentual": 3.00, "valor": 0.00, "referencia": "Art. 22, Lei 8.212/91"},
        {"id": "2.2D", "descricao": "SESC ou SESI", "percentual": 1.50, "valor": 0.00, "referencia": "Art. 3º, DL 9.853/46"},
        {"id": "2.2E", "descricao": "SENAC ou SENAI", "percentual": 1.00, "valor": 0.00, "referencia": "Art. 4º, DL 8.621/46"},
        {"id": "2.2F", "descricao": "SEBRAE", "percentual": 0.60, "valor": 0.00, "referencia": "Art. 8º, Lei 8.029/90"},
        {"id": "2.2G", "descricao": "INCRA", "percentual": 0.20, "valor": 0.00, "referencia": "Art. 1º, DL 1.146/70"},
        {"id": "2.2H", "descricao": "FGTS", "percentual": 8.00, "valor": 0.00, "referencia": "Art. 15, Lei 8.036/90"}
      ],
      "subtotal": 0.00,
      "nota": "Incide sobre Módulo 1 + Submódulo 2.1 (Acórdão TCU 1.753/2008)"
    },
    "submodulo2_3": {
      "titulo": "Submódulo 2.3 – Benefícios Mensais e Diários",
      "itens": [
        {"id": "2.3A", "descricao": "Vale-Transporte", "valor_bruto": 0.00, "desconto_empregado": 0.00, "valor": 0.00, "referencia": "Lei 7.418/85"},
        {"id": "2.3B", "descricao": "Vale-Alimentação/Refeição", "valor_bruto": 0.00, "desconto_empregado": 0.00, "valor": 0.00, "referencia": "PAT - Lei 6.321/76"},
        {"id": "2.3C", "descricao": "Assistência Médica e Familiar", "valor": 0.00, "referencia": "CCT"},
        {"id": "2.3D", "descricao": "Seguro de Vida, Invalidez e Funeral", "valor": 0.00, "referencia": "CCT"},
        {"id": "2.3E", "descricao": "Auxílio-Creche", "valor": 0.00, "referencia": "Art. 389, CLT"}
      ],
      "subtotal": 0.00
    },
    "subtotal_modulo2": 0.00
  },
  "modulo3_provisao_rescisao": {
    "titulo": "Módulo 3 – Provisão para Rescisão",
    "itens": [
      {"id": "3A", "descricao": "Aviso Prévio Indenizado", "percentual": 0.42, "valor": 0.00, "referencia": "Art. 7º, XXI, CF"},
      {"id": "3B", "descricao": "Incidência do FGTS sobre Aviso Prévio Indenizado", "percentual": 0.00, "valor": 0.00},
      {"id": "3C", "descricao": "Multa do FGTS e contribuição social sobre Aviso Prévio Indenizado", "percentual": 0.00, "valor": 0.00, "referencia": "Art. 18, Lei 8.036/90"},
      {"id": "3D", "descricao": "Aviso Prévio Trabalhado", "percentual": 1.94, "valor": 0.00, "referencia": "Art. 487, CLT"},
      {"id": "3E", "descricao": "Incidência do Submódulo 2.2 sobre Aviso Prévio Trabalhado", "percentual": 0.00, "valor": 0.00},
      {"id": "3F", "descricao": "Multa do FGTS e contribuição social sobre Aviso Prévio Trabalhado", "percentual": 0.00, "valor": 0.00}
    ],
    "subtotal": 0.00
  },
  "modulo4_custo_reposicao": {
    "titulo": "Módulo 4 – Custo de Reposição do Profissional Ausente",
    "submodulo4_1": {
      "titulo": "Submódulo 4.1 – Ausências Legais",
      "itens": [
        {"id": "4.1A", "descricao": "Férias", "percentual": 8.33, "valor": 0.00},
        {"id": "4.1B", "descricao": "Ausências Legais (Art. 473, CLT)", "percentual": 2.96, "valor": 0.00},
        {"id": "4.1C", "descricao": "Licença-Paternidade", "percentual": 0.02, "valor": 0.00},
        {"id": "4.1D", "descricao": "Ausência por Acidente de Trabalho", "percentual": 0.03, "valor": 0.00},
        {"id": "4.1E", "descricao": "Afastamento Maternidade", "percentual": 0.00, "valor": 0.00},
        {"id": "4.1F", "descricao": "Outros (especificar)", "percentual": 0.00, "valor": 0.00}
      ],
      "subtotal": 0.00
    },
    "submodulo4_2": {
      "titulo": "Submódulo 4.2 – Intrajornada",
      "itens": [
        {"id": "4.2A", "descricao": "Substituto na cobertura de intervalo para repouso e alimentação", "valor": 0.00}
      ],
      "subtotal": 0.00
    },
    "subtotal_modulo4": 0.00,
    "nota": "Incidência do Submódulo 2.2 sobre o custo de reposição será calculada"
  },
  "modulo5_insumos": {
    "titulo": "Módulo 5 – Insumos Diversos",
    "itens": [
      {"id": "5A", "descricao": "Uniformes", "valor": 0.00, "detalhes": ""},
      {"id": "5B", "descricao": "Materiais e EPIs", "valor": 0.00},
      {"id": "5C", "descricao": "Equipamentos", "valor": 0.00},
      {"id": "5D", "descricao": "Materiais de Limpeza/Consumo", "valor": 0.00},
      {"id": "5E", "descricao": "Outros insumos (especificar)", "valor": 0.00}
    ],
    "subtotal": 0.00
  },
  "modulo6_custos_indiretos_tributos_lucro": {
    "titulo": "Módulo 6 – Custos Indiretos, Tributos e Lucro",
    "submodulo6_1": {
      "titulo": "Submódulo 6.1 – Custos Indiretos e Lucro",
      "itens": [
        {"id": "6.1A", "descricao": "Custos Indiretos", "percentual": ${ciPerc}, "valor": 0.00},
        {"id": "6.1B", "descricao": "Lucro", "percentual": ${luPerc}, "valor": 0.00}
      ],
      "subtotal": 0.00
    },
    "submodulo6_2": {
      "titulo": "Submódulo 6.2 – Tributos",
      "itens": [
        {"id": "6.2A", "descricao": "PIS", "percentual": ${pis}, "valor": 0.00},
        {"id": "6.2B", "descricao": "COFINS", "percentual": ${cofins}, "valor": 0.00},
        {"id": "6.2C", "descricao": "ISS", "percentual": ${iss}, "valor": 0.00}
      ],
      "subtotal": 0.00,
      "nota": "Regime tributário: ${regimeLabel}"
    },
    "subtotal_modulo6": 0.00
  },
  "quadro_resumo": {
    "titulo": "Quadro-Resumo do Custo por Empregado",
    "modulo1": 0.00,
    "modulo2": 0.00,
    "modulo3": 0.00,
    "modulo4": 0.00,
    "modulo5": 0.00,
    "subtotal_modulos_1a5": 0.00,
    "modulo6": 0.00,
    "valor_mensal_por_empregado": 0.00,
    "qtd_profissionais": ${qtd},
    "valor_mensal_total": 0.00,
    "valor_anual_total": 0.00,
    "valor_extenso": ""
  },
  "parecer": {
    "viabilidade": "VIÁVEL ou ATENÇÃO ou INVIÁVEL",
    "margemLiquida": 0.00,
    "alertaInexequibilidade": false,
    "observacoes": "",
    "fundamentacao_legal": ["Lei 14.133/21, Art. 59, §4º", "IN SEGES/ME nº 5/2017", "Acórdão TCU 1.753/2008"]
  }
}

REGRAS OBRIGATÓRIAS:
1. Calcule TODOS os valores com base no salário-base e percentuais reais informados.
2. Encargos previdenciários (Submódulo 2.2) INCIDEM sobre: Módulo 1 + Submódulo 2.1 (conforme Acórdão TCU 1.753/2008).
3. O custo de reposição (Módulo 4) deve considerar a incidência do Submódulo 2.2.
4. Módulo 6 incide sobre a soma dos módulos 1 a 5.
5. Vale-Transporte: calcule o desconto de ${descVT}% do salário e subtraia do valor bruto (Lei 7.418/85).
6. Se margem líquida < 5%, marque alertaInexequibilidade=true (Art. 59, §4º, Lei 14.133/21).
7. Todos os valores monetários com 2 casas decimais.
8. TRIBUTOS do Módulo 6 devem ser calculados "por dentro" (base 100 - soma das alíquotas tributos).
9. Responda APENAS o JSON sem markdown, sem blocos de código.`;

    try {
      await streamAIChat({
        messages: [{ role: 'user', content: prompt }],
        action: 'planilha_mdo_portal_compras',
        onDelta: (d) => setMdoIaResult(prev => prev + d),
        onDone: () => { setMdoLoading(false); toast.success('Planilha de custos gerada conforme Portal de Compras/TCU!'); },
        onError: (err) => { toast.error('Erro: ' + err); setMdoLoading(false); },
      });
    } catch { setMdoLoading(false); toast.error('Erro ao conectar com a IA.'); }
  };

  const salvarServicoNoCatalogo = async () => {
    if (!user) { toast.error('Faça login'); return; }
    const sal = parseCurrencyInput(salarioBase);
    if (!sal) { toast.error('Informe o salário-base'); return; }
    setSavingCatalogo(true);
    const qtd = parseInt(qtdProfissionais) || 1;
    const row = {
      user_id: user.id, tipo_calculo: 'servico_mdo',
      descricao: `${cargoFuncao || 'Serviço com mão de obra'} (${qtd} profissional(is))`,
      quantidade: qtd, unidade: 'MÊS', custo_unitario: sal,
      preco_unitario: sal, preco_total: sal * qtd,
      margem_lucro: parseFloat(lucroPerc) || 10,
      regime_tributario: regime,
      licitacao_numero: licitacaoNumero || nrContratacao || null,
      licitacao_orgao: licitacaoOrgao || null,
    };
    const { error } = await supabase.from('catalogo_itens_precificados').insert(row);
    if (error) { toast.error('Erro ao salvar'); } else { toast.success('Serviço salvo no catálogo!'); }
    setSavingCatalogo(false);
  };

  // ── Parse MDO result ──
  const parsedMDO = (() => {
    if (!mdoIaResult) return null;
    try {
      let clean = mdoIaResult.trim();
      if (clean.startsWith('```')) clean = clean.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      return JSON.parse(clean);
    } catch { return null; }
  })();

  const renderModuloItems = (items: any[], title: string, nota?: string) => {
    if (!items?.length) return null;
    return (
      <div className="bg-muted/20 rounded-lg p-3 space-y-1.5">
        <h5 className="text-xs font-semibold text-accent">{title}</h5>
        {items.map((item: any, i: number) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              {item.id && <Badge variant="outline" className="text-[8px] px-1 py-0 shrink-0">{item.id}</Badge>}
              <span className="text-muted-foreground truncate">
                {item.descricao}{item.percentual != null && item.percentual !== 0 ? ` (${item.percentual}%)` : ''}
              </span>
              {item.referencia && (
                <TooltipProvider><Tooltip><TooltipTrigger><Info className="w-2.5 h-2.5 text-muted-foreground shrink-0" /></TooltipTrigger><TooltipContent><p className="text-[10px]">{item.referencia}</p></TooltipContent></Tooltip></TooltipProvider>
              )}
            </div>
            <span className="font-medium ml-2 shrink-0">{formatCurrency(item.valor || 0)}</span>
          </div>
        ))}
        {nota && <p className="text-[9px] text-muted-foreground italic mt-1">{nota}</p>}
      </div>
    );
  };

  const renderSubmodulo = (sub: any) => {
    if (!sub?.itens) return null;
    return (
      <div className="bg-muted/10 rounded-lg p-2.5 space-y-1 ml-3">
        <h6 className="text-[11px] font-medium text-foreground">{sub.titulo}</h6>
        {sub.itens.map((item: any, i: number) => (
          <div key={i} className="flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-1 flex-1 min-w-0">
              {item.id && <Badge variant="outline" className="text-[7px] px-0.5 py-0 shrink-0">{item.id}</Badge>}
              <span className="text-muted-foreground truncate">
                {item.descricao}{item.percentual != null && item.percentual !== 0 ? ` (${item.percentual}%)` : ''}
              </span>
            </div>
            <span className="font-medium ml-2 shrink-0">{formatCurrency(item.valor || 0)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between text-[11px] font-semibold border-t border-border/20 pt-0.5">
          <span>Subtotal</span>
          <span>{formatCurrency(sub.subtotal || 0)}</span>
        </div>
        {sub.nota && <p className="text-[8px] text-muted-foreground italic">{sub.nota}</p>}
      </div>
    );
  };

  return (
    <>
      {/* Reference banner */}
      <div className="bg-accent/5 border border-accent/20 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-accent" />
            <span className="text-xs font-semibold">Referência Normativa — Portal de Compras do Governo Federal</span>
          </div>
          <a href="/templates/modelo-planilha-portal-compras.xlsx" download className="inline-flex items-center gap-1 text-[10px] text-accent hover:underline bg-accent/10 px-2 py-1 rounded">
            <Download className="w-3 h-3" /> Baixar Modelo XLSX
          </a>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Planilha de Custos e Formação de Preços conforme modelo oficial do <strong>Portal de Compras do Governo Federal</strong>, em conformidade com a <strong>Lei nº 14.133/2021</strong>, <strong>IN SEGES/ME nº 5/2017 (Anexo VII-D)</strong> e <strong>Acórdãos TCU nº 1.753/2008 e 786/2006</strong>.
        </p>
        <div className="flex gap-3 mt-2">
          <a href="https://www.gov.br/compras/pt-br" target="_blank" rel="noopener noreferrer" className="text-[10px] text-accent hover:underline flex items-center gap-1">
            Portal de Compras <ExternalLink className="w-2.5 h-2.5" />
          </a>
          <a href="https://www.gov.br/compras/pt-br/agente-publico/orientacoes-e-procedimentos/11-orientacoes-gerais-para-planilha-de-custos-e-formacao-de-precos" target="_blank" rel="noopener noreferrer" className="text-[10px] text-accent hover:underline flex items-center gap-1">
            Orientações Planilha <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
      </div>

      {/* Dados da Contratação */}
      <div className="bg-card rounded-xl border border-border/50 p-5 space-y-4">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-accent" />
          Dados da Contratação
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Nº do Processo</Label>
            <Input value={nrProcesso} onChange={e => setNrProcesso(e.target.value)} placeholder="Ex: 23069.000123/2026-01" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Nº da Contratação/Pregão</Label>
            <Input value={nrContratacao} onChange={e => setNrContratacao(e.target.value)} placeholder="Ex: PE 001/2026" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Data da Proposta</Label>
            <Input type="date" value={dataProposta} onChange={e => setDataProposta(e.target.value)} className="mt-1" />
          </div>
          <div className="col-span-2 md:col-span-3">
            <Label className="text-xs">Descrição do Serviço</Label>
            <Input value={descricaoServico} onChange={e => setDescricaoServico(e.target.value)} placeholder="Ex: Serviço de limpeza, conservação e higienização" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Categoria</Label>
            <Select value={categoriaServico} onValueChange={setCategoriaServico}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="limpeza">Limpeza e Conservação</SelectItem>
                <SelectItem value="vigilancia">Vigilância Patrimonial</SelectItem>
                <SelectItem value="portaria">Portaria e Recepção</SelectItem>
                <SelectItem value="manutencao">Manutenção Predial</SelectItem>
                <SelectItem value="jardinagem">Jardinagem e Paisagismo</SelectItem>
                <SelectItem value="copeiragem">Copeiragem</SelectItem>
                <SelectItem value="motorista">Transporte/Motorista</SelectItem>
                <SelectItem value="ti">Suporte de TI</SelectItem>
                <SelectItem value="outros">Outros</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Unidade de Medida</Label>
            <Select value={unidadeMedida} onValueChange={setUnidadeMedida}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Posto de Trabalho">Posto de Trabalho</SelectItem>
                <SelectItem value="Metro Quadrado">Metro Quadrado (m²)</SelectItem>
                <SelectItem value="Hora">Hora Trabalhada</SelectItem>
                <SelectItem value="Mensal">Mensal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Município do Serviço</Label>
            <Input value={municipioServico} onChange={e => setMunicipioServico(e.target.value)} placeholder="Ex: Belém" className="mt-1" />
          </div>
        </div>
      </div>

      {/* CCT */}
      <div className="bg-card rounded-xl border border-border/50 p-5 space-y-4">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <FileText className="w-4 h-4 text-accent" />
          Convenção Coletiva de Trabalho (CCT)
        </h4>
        <p className="text-[10px] text-muted-foreground">
          Conforme Art. 63, §1º da Lei 14.133/21, o salário-base e os benefícios devem respeitar o piso da CCT vigente.
        </p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Sindicato/Convenção</Label>
            <Input value={convencaoColetiva} onChange={e => setConvencaoColetiva(e.target.value)} placeholder="Ex: SIEMACO-PA" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Nº Registro MTE</Label>
            <Input value={nrRegistroCCT} onChange={e => setNrRegistroCCT(e.target.value)} placeholder="Ex: PA000123/2026" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Vigência</Label>
            <Input value={vigenciaCCT} onChange={e => setVigenciaCCT(e.target.value)} placeholder="Ex: 01/01/2026 a 31/12/2026" className="mt-1" />
          </div>
        </div>
      </div>

      {/* Módulo 1 – Remuneração */}
      <div className="bg-card rounded-xl border border-border/50 p-5 space-y-4">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <span className="bg-accent text-accent-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">1</span>
          Módulo 1 — Composição da Remuneração
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs">Cargo/Função *</Label>
            <Input value={cargoFuncao} onChange={e => setCargoFuncao(e.target.value)} placeholder="Ex: Servente de Limpeza" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">CBO</Label>
            <Input value={cboFuncao} onChange={e => setCboFuncao(e.target.value)} placeholder="Ex: 5143-20" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Salário-base Mensal (R$) *</Label>
            <Input value={salarioBase} onChange={e => setSalarioBase(formatCurrencyInput(e.target.value))} placeholder="R$ 0,00" className="mt-1" />
            <p className="text-[9px] text-muted-foreground mt-0.5">Piso da CCT vigente</p>
          </div>
          <div>
            <Label className="text-xs">Qtd de Profissionais</Label>
            <Input type="number" value={qtdProfissionais} onChange={e => setQtdProfissionais(e.target.value)} placeholder="1" className="mt-1" min={1} />
          </div>
          <div>
            <Label className="text-xs">Carga Horária Semanal (h)</Label>
            <Input type="number" value={cargaHoraria} onChange={e => setCargaHoraria(e.target.value)} placeholder="44" className="mt-1" min={1} max={44} />
          </div>
          <div>
            <Label className="text-xs">Tipo de Jornada</Label>
            <Select value={jornada} onValueChange={(v: any) => setJornada(v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="diurna">Diurna (06h-22h)</SelectItem>
                <SelectItem value="noturna">Noturna (22h-05h)</SelectItem>
                <SelectItem value="12x36">12x36 horas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="border-t border-border/30 pt-3">
          <p className="text-[10px] text-muted-foreground mb-2 font-medium">Adicionais (conforme CLT e NRs)</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Periculosidade (%)</Label>
              <Input type="number" value={adicPericulosidade} onChange={e => setAdicPericulosidade(e.target.value)} placeholder="0" className="mt-1" min={0} max={30} />
              <p className="text-[8px] text-muted-foreground mt-0.5">30% s/ salário (NR-16)</p>
            </div>
            <div>
              <Label className="text-xs">Insalubridade (%)</Label>
              <div className="flex gap-1 mt-1">
                <Input type="number" value={adicInsalubridade} onChange={e => setAdicInsalubridade(e.target.value)} placeholder="0" min={0} max={40} className="flex-1" />
                <Select value={grauInsalubridade} onValueChange={(v: any) => setGrauInsalubridade(v)}>
                  <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minimo">Mín 10%</SelectItem>
                    <SelectItem value="medio">Méd 20%</SelectItem>
                    <SelectItem value="maximo">Máx 40%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-[8px] text-muted-foreground mt-0.5">S/ salário mínimo (NR-15)</p>
            </div>
            <div>
              <Label className="text-xs">Ad. Noturno (%)</Label>
              <Input type="number" value={adicNoturno} onChange={e => setAdicNoturno(e.target.value)} placeholder="0" className="mt-1" min={0} max={50} />
              <p className="text-[8px] text-muted-foreground mt-0.5">Mín. 20% (Art. 73, CLT)</p>
            </div>
            <div>
              <Label className="text-xs">Hora Extra Hab. (%)</Label>
              <Input type="number" value={adicHoraExtra} onChange={e => setAdicHoraExtra(e.target.value)} placeholder="0" className="mt-1" min={0} max={100} />
              <p className="text-[8px] text-muted-foreground mt-0.5">Mín. 50% (Art. 7º, XVI, CF)</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-border/30 pt-3">
          <Switch checked={dsr} onCheckedChange={setDsr} />
          <div>
            <p className="text-xs font-medium">DSR sobre adicionais (Lei 605/49)</p>
            <p className="text-[9px] text-muted-foreground">Descanso semanal remunerado incide sobre horas extras e adicional noturno</p>
          </div>
        </div>
      </div>

      {/* Módulo 2 – Benefícios */}
      <div className="bg-card rounded-xl border border-border/50 p-5 space-y-4">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <span className="bg-accent text-accent-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">2</span>
          Módulo 2 — Encargos e Benefícios
        </h4>
        <p className="text-[10px] text-muted-foreground">
          Encargos sociais e previdenciários (Submódulos 2.1 e 2.2) serão calculados automaticamente pela IA conforme legislação vigente e Acórdão TCU 1.753/2008.
        </p>

        <div className="border-t border-border/30 pt-3">
          <p className="text-[10px] font-medium mb-2">Submódulo 2.3 — Benefícios Mensais e Diários</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Vale-Transporte (R$/mês)</Label>
              <Input value={valeTransporte} onChange={e => setValeTransporte(formatCurrencyInput(e.target.value))} placeholder="R$ 0,00" className="mt-1" />
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[8px] text-muted-foreground">Desc. empregado:</span>
                <Input type="number" value={descontoVT} onChange={e => setDescontoVT(e.target.value)} className="h-5 w-12 text-[9px] p-1" min={0} max={6} />
                <span className="text-[8px] text-muted-foreground">% (Lei 7.418/85)</span>
              </div>
            </div>
            <div>
              <Label className="text-xs">Vale-Alimentação/Refeição (R$/mês)</Label>
              <Input value={valeAlimentacao} onChange={e => setValeAlimentacao(formatCurrencyInput(e.target.value))} placeholder="R$ 0,00" className="mt-1" />
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[8px] text-muted-foreground">Desc. empregado:</span>
                <Input type="number" value={descontoVA} onChange={e => setDescontoVA(e.target.value)} className="h-5 w-12 text-[9px] p-1" min={0} max={20} />
                <span className="text-[8px] text-muted-foreground">%</span>
              </div>
            </div>
            <div>
              <Label className="text-xs">Assistência Médica (R$/mês)</Label>
              <Input value={assistenciaMedica} onChange={e => setAssistenciaMedica(formatCurrencyInput(e.target.value))} placeholder="R$ 0,00" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Seguro de Vida (R$/mês)</Label>
              <Input value={seguroVida} onChange={e => setSeguroVida(formatCurrencyInput(e.target.value))} placeholder="R$ 0,00" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Auxílio-Creche (R$/mês)</Label>
              <Input value={auxilCreche} onChange={e => setAuxilCreche(formatCurrencyInput(e.target.value))} placeholder="R$ 0,00" className="mt-1" />
              <p className="text-[8px] text-muted-foreground mt-0.5">Art. 389, CLT</p>
            </div>
          </div>
        </div>
      </div>

      {/* Módulo 3 – Provisão para Rescisão */}
      <div className="bg-card rounded-xl border border-border/50 p-5 space-y-4">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <span className="bg-accent text-accent-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">3</span>
          Módulo 3 — Provisão para Rescisão
        </h4>
        <p className="text-[10px] text-muted-foreground">
          Percentuais calculados conforme Acórdão TCU nº 1.753/2008 e legislação trabalhista vigente.
        </p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Aviso Prévio Indenz. (%)</Label>
            <Input type="number" value={avisoPrevioIndenizado} onChange={e => setAvisoPrevioIndenizado(e.target.value)} className="mt-1" step="0.01" />
          </div>
          <div>
            <Label className="text-xs">Aviso Prévio Trab. (%)</Label>
            <Input type="number" value={avisoPrevioTrabalhado} onChange={e => setAvisoPrevioTrabalhado(e.target.value)} className="mt-1" step="0.01" />
          </div>
          <div>
            <Label className="text-xs">Multa FGTS (%)</Label>
            <Input type="number" value={multaFGTS} onChange={e => setMultaFGTS(e.target.value)} className="mt-1" />
            <p className="text-[8px] text-muted-foreground mt-0.5">40% (Art. 18, Lei 8.036/90)</p>
          </div>
        </div>
      </div>

      {/* Módulo 4 – Custo de Reposição */}
      <div className="bg-card rounded-xl border border-border/50 p-5 space-y-3">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <span className="bg-accent text-accent-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">4</span>
          Módulo 4 — Custo de Reposição do Profissional Ausente
        </h4>
        <p className="text-[10px] text-muted-foreground">
          Calculado automaticamente: férias, ausências legais, licenças e incidência do Submódulo 2.2.
        </p>
        <div className="flex items-center gap-3">
          <Switch checked={coberturaSuplente} onCheckedChange={setCoberturaSuplente} />
          <div>
            <p className="text-xs font-medium">Incluir cobertura de profissional suplente</p>
            <p className="text-[9px] text-muted-foreground">Para postos que exigem cobertura ininterrupta (vigilância, portaria 24h)</p>
          </div>
        </div>
      </div>

      {/* Módulo 5 – Insumos */}
      <div className="bg-card rounded-xl border border-border/50 p-5 space-y-4">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <span className="bg-accent text-accent-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">5</span>
          Módulo 5 — Insumos Diversos
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Uniformes (R$/mês)</Label>
            <Input value={uniformes} onChange={e => setUniformes(formatCurrencyInput(e.target.value))} placeholder="R$ 0,00" className="mt-1" />
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[8px] text-muted-foreground">Jogos/ano:</span>
              <Input type="number" value={qtdUniformes} onChange={e => setQtdUniformes(e.target.value)} className="h-5 w-10 text-[9px] p-1" min={1} max={6} />
            </div>
          </div>
          <div>
            <Label className="text-xs">EPIs e Materiais (R$/mês)</Label>
            <Input value={epiMateriais} onChange={e => setEpiMateriais(formatCurrencyInput(e.target.value))} placeholder="R$ 0,00" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Equipamentos (R$/mês)</Label>
            <Input value={equipamentos} onChange={e => setEquipamentos(formatCurrencyInput(e.target.value))} placeholder="R$ 0,00" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Materiais de Limpeza/Consumo (R$/mês)</Label>
            <Input value={materiaisLimpeza} onChange={e => setMateriaisLimpeza(formatCurrencyInput(e.target.value))} placeholder="R$ 0,00" className="mt-1" />
          </div>
        </div>
      </div>

      {/* Módulo 6 – Custos Indiretos, Tributos e Lucro */}
      <div className="bg-card rounded-xl border border-border/50 p-5 space-y-4">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <span className="bg-accent text-accent-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">6</span>
          Módulo 6 — Custos Indiretos, Tributos e Lucro
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Custos Indiretos (%)</Label>
            <Input type="number" value={custoIndiretoPerc} onChange={e => setCustoIndiretoPerc(e.target.value)} placeholder="5" className="mt-1" min={0} max={30} />
          </div>
          <div>
            <Label className="text-xs">Lucro (%)</Label>
            <Input type="number" value={lucroPerc} onChange={e => setLucroPerc(e.target.value)} placeholder="10" className="mt-1" min={0} max={30} />
          </div>
        </div>
        <div className="border-t border-border/30 pt-3">
          <p className="text-[10px] font-medium mb-2">Tributos (conforme {regimeLabel})</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">PIS (%)</Label>
              <Input type="number" value={pisPerc} onChange={e => setPisPerc(e.target.value)} className="mt-1" step="0.01" />
            </div>
            <div>
              <Label className="text-xs">COFINS (%)</Label>
              <Input type="number" value={cofinsPerc} onChange={e => setCofinsPerc(e.target.value)} className="mt-1" step="0.01" />
            </div>
            <div>
              <Label className="text-xs">ISS (%)</Label>
              <Input type="number" value={issPerc} onChange={e => setIssPerc(e.target.value)} className="mt-1" step="0.01" />
              <p className="text-[8px] text-muted-foreground mt-0.5">2% a 5% (LC 116/2003)</p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="bg-card rounded-xl border border-border/50 p-5 space-y-3">
        <Button variant="outline" size="sm" onClick={salvarServicoNoCatalogo} disabled={savingCatalogo} className="w-full">
          {savingCatalogo ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
          Salvar no Catálogo
        </Button>
      </div>

      <Button onClick={gerarPlanilhaMDO} disabled={mdoLoading} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground h-12" size="lg">
        {mdoLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Sparkles className="w-5 h-5 mr-2" />}
        Gerar Planilha de Custos — Portal de Compras / TCU
      </Button>

      {/* Resultado MDO */}
      {parsedMDO && (
        <div className="bg-card rounded-xl border border-border/50 p-5 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-accent" />
              <h4 className="font-semibold text-sm">Planilha de Custos e Formação de Preços</h4>
            </div>
            <Badge variant="outline" className="text-[9px]">
              Lei 14.133/21 • IN 5/2017 • TCU
            </Badge>
          </div>

          {/* Dados da contratação */}
          {parsedMDO.dados_contratacao && (
            <div className="bg-muted/30 rounded-lg p-3 space-y-1">
              <h5 className="text-[10px] font-bold text-foreground mb-1">DADOS DA CONTRATAÇÃO</h5>
              {Object.entries(parsedMDO.dados_contratacao).filter(([_, v]) => v && v !== 'N/A').map(([k, v]) => (
                <div key={k} className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground capitalize">{k.replace(/_/g, ' ')}</span>
                  <span className="font-medium">{String(v)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Identificação */}
          {parsedMDO.identificacao_profissional && (
            <div className="bg-muted/30 rounded-lg p-3 space-y-1">
              <h5 className="text-[10px] font-bold text-foreground mb-1">IDENTIFICAÇÃO DO PROFISSIONAL</h5>
              <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Cargo/Função</span><span className="font-medium">{parsedMDO.identificacao_profissional.cargo_funcao}</span></div>
              <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Salário Normativo</span><span className="font-medium">{formatCurrency(parsedMDO.identificacao_profissional.salario_normativo_cct || 0)}</span></div>
            </div>
          )}

          {/* Módulo 1 */}
          {parsedMDO.modulo1_remuneracao && renderModuloItems(parsedMDO.modulo1_remuneracao.itens, parsedMDO.modulo1_remuneracao.titulo)}

          {/* Módulo 2 */}
          {parsedMDO.modulo2_encargos && (
            <div className="bg-muted/20 rounded-lg p-3 space-y-2">
              <h5 className="text-xs font-semibold text-accent">{parsedMDO.modulo2_encargos.titulo}</h5>
              {renderSubmodulo(parsedMDO.modulo2_encargos.submodulo2_1)}
              {renderSubmodulo(parsedMDO.modulo2_encargos.submodulo2_2)}
              {renderSubmodulo(parsedMDO.modulo2_encargos.submodulo2_3)}
              <div className="flex items-center justify-between text-xs font-bold border-t border-border/30 pt-1 px-1">
                <span>Total Módulo 2</span>
                <span className="text-accent">{formatCurrency(parsedMDO.modulo2_encargos.subtotal_modulo2 || 0)}</span>
              </div>
            </div>
          )}

          {/* Módulo 3 */}
          {parsedMDO.modulo3_provisao_rescisao && renderModuloItems(parsedMDO.modulo3_provisao_rescisao.itens, parsedMDO.modulo3_provisao_rescisao.titulo)}

          {/* Módulo 4 */}
          {parsedMDO.modulo4_custo_reposicao && (
            <div className="bg-muted/20 rounded-lg p-3 space-y-2">
              <h5 className="text-xs font-semibold text-accent">{parsedMDO.modulo4_custo_reposicao.titulo}</h5>
              {parsedMDO.modulo4_custo_reposicao.submodulo4_1 && renderSubmodulo(parsedMDO.modulo4_custo_reposicao.submodulo4_1)}
              {parsedMDO.modulo4_custo_reposicao.submodulo4_2 && renderSubmodulo(parsedMDO.modulo4_custo_reposicao.submodulo4_2)}
              <div className="flex items-center justify-between text-xs font-bold border-t border-border/30 pt-1 px-1">
                <span>Total Módulo 4</span>
                <span className="text-accent">{formatCurrency(parsedMDO.modulo4_custo_reposicao.subtotal_modulo4 || 0)}</span>
              </div>
            </div>
          )}

          {/* Módulo 5 */}
          {parsedMDO.modulo5_insumos && renderModuloItems(parsedMDO.modulo5_insumos.itens, parsedMDO.modulo5_insumos.titulo)}

          {/* Módulo 6 */}
          {parsedMDO.modulo6_custos_indiretos_tributos_lucro && (
            <div className="bg-muted/20 rounded-lg p-3 space-y-2">
              <h5 className="text-xs font-semibold text-accent">{parsedMDO.modulo6_custos_indiretos_tributos_lucro.titulo}</h5>
              {parsedMDO.modulo6_custos_indiretos_tributos_lucro.submodulo6_1 && renderSubmodulo(parsedMDO.modulo6_custos_indiretos_tributos_lucro.submodulo6_1)}
              {parsedMDO.modulo6_custos_indiretos_tributos_lucro.submodulo6_2 && renderSubmodulo(parsedMDO.modulo6_custos_indiretos_tributos_lucro.submodulo6_2)}
              <div className="flex items-center justify-between text-xs font-bold border-t border-border/30 pt-1 px-1">
                <span>Total Módulo 6</span>
                <span className="text-accent">{formatCurrency(parsedMDO.modulo6_custos_indiretos_tributos_lucro.subtotal_modulo6 || 0)}</span>
              </div>
            </div>
          )}

          {/* Quadro Resumo */}
          {parsedMDO.quadro_resumo && (
            <div className="bg-accent/10 rounded-lg p-4 space-y-2">
              <h5 className="text-xs font-bold text-accent">{parsedMDO.quadro_resumo.titulo || 'QUADRO-RESUMO'}</h5>
              <div className="grid grid-cols-3 gap-2">
                {['modulo1','modulo2','modulo3','modulo4','modulo5'].map((m, i) => (
                  <div key={m} className="text-center bg-background/50 rounded p-1.5">
                    <p className="text-[9px] text-muted-foreground">Módulo {i+1}</p>
                    <p className="text-xs font-bold">{formatCurrency(parsedMDO.quadro_resumo[m] || 0)}</p>
                  </div>
                ))}
                <div className="text-center bg-background/50 rounded p-1.5">
                  <p className="text-[9px] text-muted-foreground">Subtotal 1-5</p>
                  <p className="text-xs font-bold">{formatCurrency(parsedMDO.quadro_resumo.subtotal_modulos_1a5 || 0)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 border-t border-accent/20 pt-2">
                <div className="text-center">
                  <p className="text-[9px] text-muted-foreground">Módulo 6</p>
                  <p className="text-sm font-bold">{formatCurrency(parsedMDO.quadro_resumo.modulo6 || 0)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] text-muted-foreground">Valor Mensal/Empregado</p>
                  <p className="text-sm font-bold text-accent">{formatCurrency(parsedMDO.quadro_resumo.valor_mensal_por_empregado || 0)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] text-muted-foreground">Valor Mensal Total ({parsedMDO.quadro_resumo.qtd_profissionais} prof.)</p>
                  <p className="text-lg font-bold text-accent">{formatCurrency(parsedMDO.quadro_resumo.valor_mensal_total || 0)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] text-muted-foreground">Valor Anual Total</p>
                  <p className="text-sm font-bold">{formatCurrency(parsedMDO.quadro_resumo.valor_anual_total || 0)}</p>
                </div>
              </div>
              {parsedMDO.quadro_resumo.valor_extenso && (
                <p className="text-[11px] text-muted-foreground text-center italic mt-2">
                  {parsedMDO.quadro_resumo.valor_extenso}
                </p>
              )}
            </div>
          )}

          {/* Parecer */}
          {parsedMDO.parecer && (
            <div className={`rounded-lg p-3 text-xs space-y-1 ${parsedMDO.parecer.viabilidade === 'VIÁVEL' ? 'bg-green-500/10 border border-green-500/20' : parsedMDO.parecer.viabilidade === 'INVIÁVEL' ? 'bg-destructive/10 border border-destructive/20' : 'bg-yellow-500/10 border border-yellow-500/20'}`}>
              <div className="flex items-center gap-2">
                <span className="font-bold">{parsedMDO.parecer.viabilidade}</span>
                {parsedMDO.parecer.alertaInexequibilidade && (
                  <Badge variant="destructive" className="text-[8px]">⚠ Risco de Inexequibilidade</Badge>
                )}
              </div>
              <p>{parsedMDO.parecer.observacoes}</p>
              {parsedMDO.parecer.fundamentacao_legal && (
                <p className="text-[9px] text-muted-foreground mt-1">
                  Fundamento: {parsedMDO.parecer.fundamentacao_legal.join(' • ')}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {mdoIaResult && !parsedMDO && (
        <div className="bg-card rounded-xl border border-border/50 p-5">
          <p className="text-xs text-muted-foreground mb-2">Processando resultado...</p>
          <pre className="text-[10px] bg-muted/30 rounded-lg p-3 overflow-auto max-h-60 whitespace-pre-wrap">{mdoIaResult}</pre>
        </div>
      )}
    </>
  );
}
