/**
 * Radar Jurídico — o que o sistema já sabe que precisa de peça (27/09/2026).
 *
 * "IA proativa" não é a IA acordar sozinha: é derivar, dos dados que o
 * Praefectus já tem, os eventos que pedem providência jurídica e entregá-los
 * com a peça certa e o caso montado. Cada evento aqui nasce de uma régua que
 * outra tela já usa (reajuste, vigência, saldo, publicações, desfecho do
 * processo) — este módulo só as reúne e aponta o modelo.
 *
 * Puro: recebe linhas já lidas e a data de hoje; nada de consulta aqui.
 */
import { situacaoDoReajuste } from '@/lib/contratos/reajuste';
import { situacaoDaVigencia } from '@/lib/contratos/vigencia';
import { extratosExigidos } from '@/lib/contratos/eficacia';
import { TIPOS_REAJUSTE } from '@/lib/contratos/instrumentos';

export type AditivoDoRadar = {
  tipo: string | null;
  data_assinatura: string | null;
  data_base_reajuste?: string | null;
};

export type ContratoDoRadar = {
  id: string;
  numero_contrato: string | null;
  orgao_contratante: string | null;
  tipo_documento: string | null;
  status: string | null;
  data_assinatura: string | null;
  data_fim: string | null;
  indice_reajuste: string | null;
  data_base_reajuste: string | null;
  saldo_remanescente: number | null;
  valor_global: number | null;
  fiscal_nome: string | null;
  /** 'servico_continuo' é o que a repactuação por CCT alcança. */
  especie_objeto?: string | null;
  aditivos: AditivoDoRadar[];
  publicacoes: Array<{ tipo: string | null }>;
};

export type DocumentoDoRadar = { id: string; nome: string; tipo: string | null; validade: string | null };

export type CctDoRadar = { id: string; categoria_profissional: string; vigencia_inicio: string | null; abrangencia_uf: string | null };

/** Aviso do robô "a licitação mudou" (robo_historico), nos últimos dias. */
export type AlteracaoDeEdital = { id: string; edital: string | null; link: string | null; ocorreu_em: string };

export type LicitacaoDoRadar = {
  id: string;
  numero: string | null;
  orgao: string | null;
  status: string | null;
  resultado: string | null;
  updated_at: string | null;
};

export type Gravidade = 'critico' | 'atencao' | 'info';

export type EventoDoRadar = {
  chave: string;
  gravidade: Gravidade;
  titulo: string;
  detalhe: string;
  fundamento: string;
  /** Rótulo do caso: "Contrato 772/2024 · SEMAS" */
  caso: string;
  contratoId?: string;
  licitacaoId?: string;
  /** Modelo do Apoio Jurídico a abrir com o caso montado; nulo = só a rota. */
  modeloId: string | null;
  rotuloDaAcao: string;
  /** Rota alternativa quando não há peça a redigir (ex.: registrar publicação). */
  rota?: string;
};

// Reequilíbrio e revisão (art. 124) NÃO reiniciam o interregno do reajuste:
// são institutos distintos. A lista é a mesma do cartão do contrato.
const TIPOS_DE_REAJUSTE = new Set(TIPOS_REAJUSTE);
const PESO: Record<Gravidade, number> = { critico: 0, atencao: 1, info: 2 };

const dataBr = (iso: string | null | undefined) =>
  iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—';

function rotuloDoContrato(c: ContratoDoRadar): string {
  const tipo = c.tipo_documento === 'ata_srp' ? 'Ata' : 'Contrato';
  return `${tipo} ${c.numero_contrato ?? 'sem número'}${c.orgao_contratante ? ` · ${c.orgao_contratante}` : ''}`;
}

export function eventosDoRadar(e: {
  contratos: ContratoDoRadar[];
  licitacoes: LicitacaoDoRadar[];
  documentos?: DocumentoDoRadar[];
  ccts?: CctDoRadar[];
  alteracoesDeEdital?: AlteracaoDeEdital[];
  hoje: string;
}): EventoDoRadar[] {
  const eventos: EventoDoRadar[] = [];
  const hojeDate = new Date(`${e.hoje}T12:00:00`);

  for (const c of e.contratos) {
    if (c.status === 'encerrado') continue;
    const caso = rotuloDoContrato(c);
    const ehAta = c.tipo_documento === 'ata_srp';
    const vig = situacaoDaVigencia(c.data_fim, hojeDate);

    // ── Reajuste devido (art. 92, § 3º; art. 136, I; Lei 10.192/2001) ──────
    if (!ehAta && c.data_base_reajuste) {
      const reajustes = c.aditivos
        .filter((a) => a.tipo && TIPOS_DE_REAJUSTE.has(a.tipo))
        .map((a) => a.data_base_reajuste ?? a.data_assinatura);
      const s = situacaoDoReajuste({ dataBase: c.data_base_reajuste, reajustesRegistrados: reajustes, hoje: e.hoje });
      if (s?.devido) {
        // Aditivo assinado DEPOIS do aniversário sem ser de reajuste: a
        // prorrogação aceita sem ressalva pode ser lida como renúncia.
        const aditivoPosterior = c.aditivos.some(
          (a) => a.data_assinatura && a.data_assinatura >= s.aniversario && !(a.tipo && TIPOS_DE_REAJUSTE.has(a.tipo)),
        );
        eventos.push({
          chave: `reajuste:${c.id}`,
          gravidade: aditivoPosterior ? 'critico' : 'atencao',
          titulo: `Reajuste devido desde ${dataBr(s.aniversario)} — há ${s.mesesDesdeAniversario} mês(es)`,
          detalhe: aditivoPosterior
            ? `Índice ${c.indice_reajuste ?? 'da cláusula'}, data-base ${dataBr(c.data_base_reajuste)}. Há termo aditivo assinado depois do aniversário sem o reajuste: requerer já, com ressalva expressa, antes que a preclusão lógica se consolide.`
            : `Índice ${c.indice_reajuste ?? 'da cláusula'}, data-base ${dataBr(c.data_base_reajuste)}. Nenhum reajuste registrado desde então; requerer por apostila antes de assinar qualquer prorrogação.`,
          fundamento: 'Lei 14.133/2021, art. 92, § 3º, e art. 136, I; Lei 10.192/2001, art. 3º, § 1º',
          caso,
          contratoId: c.id,
          modeloId: '7',
          rotuloDaAcao: 'Redigir o requerimento de reajuste',
        });
      }
    }

    // ── Vigência (art. 107 contínuo / art. 111 escopo) ──────────────────────
    if (vig.vencido) {
      eventos.push({
        chave: `vigencia:${c.id}`,
        gravidade: 'critico',
        titulo: `Vigência vencida — ${vig.frase}`,
        detalhe: `Fim em ${dataBr(c.data_fim)} sem termo de prorrogação registrado. Fornecer com o prazo vencido é executar sem contrato; ou se prorroga (se ainda cabível), ou se encerra formalmente.`,
        fundamento: ehAta ? 'Lei 14.133/2021, art. 84' : 'Lei 14.133/2021, arts. 105, 107 e 111',
        caso,
        contratoId: c.id,
        modeloId: ehAta ? null : '21',
        rotuloDaAcao: ehAta ? 'Abrir a ata' : 'Redigir o pedido de prorrogação',
        rota: `/gestao-contratos?contrato=${c.id}`,
      });
    } else if (vig.vencendo && !ehAta) {
      eventos.push({
        chave: `vencendo:${c.id}`,
        gravidade: 'atencao',
        titulo: `Vigência termina em ${vig.dias} dia(s) — ${dataBr(c.data_fim)}`,
        detalhe: 'Prorrogação exige termo aditivo assinado ANTES do fim da vigência: contrato vencido não se prorroga, só se recontrata. Instruir o pedido com a vantajosidade.',
        fundamento: 'Lei 14.133/2021, art. 107 (contínuo) ou art. 111 (por escopo)',
        caso,
        contratoId: c.id,
        modeloId: '21',
        rotuloDaAcao: 'Redigir o pedido de prorrogação',
      });
    }

    // ── Saldo esgotado ou negativo com vigência em curso (art. 124/125) ─────
    if (!vig.vencido && c.saldo_remanescente !== null && c.saldo_remanescente <= 0 && (c.valor_global ?? 0) > 0) {
      const negativo = c.saldo_remanescente < 0;
      eventos.push({
        chave: `saldo:${c.id}`,
        gravidade: negativo ? 'critico' : 'atencao',
        titulo: negativo ? 'Executado acima do valor contratado' : 'Saldo esgotado com vigência em curso',
        detalhe: negativo
          ? 'Há pedidos além do valor global sem aditivo que os ampare: fornecimento sem cobertura contratual. Regularizar por termo aditivo quantitativo (até 25%) ou declarar o encerramento.'
          : 'O quantitativo acabou antes do prazo. Para seguir fornecendo, aditivo quantitativo (limite de 25%); sem interesse, encerrar formalmente.',
        fundamento: 'Lei 14.133/2021, art. 124, I, "b", e art. 125',
        caso,
        contratoId: c.id,
        modeloId: '21',
        rotuloDaAcao: 'Redigir o pedido de aditivo',
      });
    }

    // ── Publicações que faltam (art. 94) ────────────────────────────────────
    const exigidos = extratosExigidos({
      tipoDocumento: c.tipo_documento,
      quantidadeDeAditivos: c.aditivos.length,
      temFiscalDesignado: !!c.fiscal_nome,
    });
    const registrados = new Map<string, number>();
    for (const p of c.publicacoes) registrados.set(p.tipo ?? '', (registrados.get(p.tipo ?? '') ?? 0) + 1);
    const faltam = exigidos
      .map((x) => ({ ...x, faltam: Math.max(0, x.quantos - (registrados.get(x.tipo) ?? 0)) }))
      .filter((x) => x.faltam > 0 && (x.tipo === 'extrato_contrato' || x.tipo === 'extrato_ata' || x.tipo === 'extrato_aditivo'));
    if (faltam.length > 0 && c.data_assinatura) {
      eventos.push({
        chave: `publicacao:${c.id}`,
        gravidade: 'atencao',
        titulo: `Extrato não registrado: ${faltam.map((f) => `${f.rotulo}${f.faltam > 1 ? ` (${f.faltam})` : ''}`).join(', ')}`,
        detalhe: 'A divulgação é condição de eficácia do contrato e dos seus aditamentos. Se o órgão publicou, registre o extrato; se não, cobre a publicação por escrito e guarde o protocolo.',
        fundamento: 'Lei 14.133/2021, art. 94',
        caso,
        contratoId: c.id,
        modeloId: null,
        rotuloDaAcao: 'Registrar ou cobrar a publicação',
        rota: `/gestao-contratos?contrato=${c.id}`,
      });
    }
  }

  // ── Processos: desclassificação ou inabilitação pedem recurso em 3 dias úteis ──
  for (const l of e.licitacoes) {
    const resultado = (l.resultado ?? '').toLowerCase();
    if (resultado === 'desclassificada' || resultado === 'inabilitada') {
      eventos.push({
        chave: `recurso:${l.id}`,
        gravidade: 'critico',
        titulo: `${l.resultado} — prazo de recurso de 3 dias úteis`,
        detalhe: `O prazo conta da intimação ou da lavratura da ata. Registrado em ${dataBr(l.updated_at)}. Confira a data da decisão no portal antes de redigir.`,
        fundamento: 'Lei 14.133/2021, art. 165, I, e § 1º',
        caso: `Processo ${l.numero ?? 'sem número'}${l.orgao ? ` · ${l.orgao}` : ''}`,
        licitacaoId: l.id,
        modeloId: '3',
        rotuloDaAcao: 'Redigir o recurso',
      });
    }
  }

  // ── CCT nova: repactuação dos contratos contínuos com mão de obra (art. 135, II) ──
  const cctsRecentes = (e.ccts ?? []).filter((c) => c.vigencia_inicio && diasEntre(c.vigencia_inicio, e.hoje) <= 90 && diasEntre(c.vigencia_inicio, e.hoje) >= -30);
  if (cctsRecentes.length > 0) {
    for (const c of e.contratos) {
      if (c.status === 'encerrado' || c.especie_objeto !== 'servico_continuo') continue;
      if (situacaoDaVigencia(c.data_fim, hojeDate).vencido) continue;
      for (const cct of cctsRecentes) {
        eventos.push({
          chave: `cct:${c.id}:${cct.id}`,
          gravidade: 'atencao',
          titulo: `Convenção coletiva nova — ${cct.categoria_profissional}${cct.abrangencia_uf ? ` (${cct.abrangencia_uf})` : ''}, vigente desde ${dataBr(cct.vigencia_inicio)}`,
          detalhe: 'Serviço contínuo com mão de obra: a parcela de pessoal repactua-se pela nova convenção, com demonstração analítica da variação dos custos. Pedir na vigência; a repactuação não pedida preclui com a prorrogação.',
          fundamento: 'Lei 14.133/2021, art. 92, § 4º, II, e art. 135, II; IN SEGES/MP 5/2017, art. 57',
          caso: rotuloDoContrato(c),
          contratoId: c.id,
          modeloId: '8',
          rotuloDaAcao: 'Redigir o pedido de repactuação',
        });
      }
    }
  }

  // ── Certidões e documentos de habilitação vencendo (arts. 66 a 69) ─────
  for (const d of e.documentos ?? []) {
    if (!d.validade) continue;
    const dias = -diasEntre(d.validade, e.hoje);
    if (dias > 30) continue;
    eventos.push({
      chave: `documento:${d.id}`,
      gravidade: dias < 0 ? 'critico' : dias <= 7 ? 'critico' : 'atencao',
      titulo: dias < 0 ? `${d.nome} — vencido há ${-dias} dia(s)` : dias === 0 ? `${d.nome} — vence hoje` : `${d.nome} — vence em ${dias} dia(s)`,
      detalhe: `${d.tipo ?? 'Documento de habilitação'}. Sem o documento válido a empresa não habilita nem recebe: renovar no órgão emissor e subir o PDF em Documentos — o sistema lê a validade nova.`,
      fundamento: 'Lei 14.133/2021, arts. 66 a 69 (habilitação) e art. 92, XVI (manutenção das condições)',
      caso: 'Habilitação da empresa',
      modeloId: null,
      rotuloDaAcao: 'Abrir Documentos',
      rota: '/documentos',
    });
  }

  // ── Edital alterado (aviso do robô): impugnar ou reprecificar em prazo ─
  for (const a of e.alteracoesDeEdital ?? []) {
    if (diasEntre(a.ocorreu_em.slice(0, 10), e.hoje) > 15) continue;
    eventos.push({
      chave: `edital:${a.id}`,
      gravidade: 'atencao',
      titulo: `Edital alterado — ${a.edital ?? 'processo'} (aviso do robô em ${dataBr(a.ocorreu_em.slice(0, 10))})`,
      detalhe: 'Edital alterado muda itens, quantidades e prazos; a impugnação corre até 3 dias úteis antes da nova abertura, e a proposta pode precisar de nova precificação. Confira as alterações antes de decidir.',
      fundamento: 'Lei 14.133/2021, art. 55, § 1º, e art. 164',
      caso: `Processo ${a.edital ?? ''}`.trim(),
      modeloId: '2',
      rotuloDaAcao: 'Redigir a impugnação',
      rota: a.link ?? undefined,
    });
  }

  return eventos.sort((a, b) => PESO[a.gravidade] - PESO[b.gravidade] || a.caso.localeCompare(b.caso, 'pt-BR'));
}

/** Dias de `de` até `ate` (positivo quando `ate` é depois). Datas ISO. */
function diasEntre(deIso: string, ateIso: string): number {
  const [a1, m1, d1] = deIso.slice(0, 10).split('-').map(Number);
  const [a2, m2, d2] = ateIso.slice(0, 10).split('-').map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400000);
}

/** Para onde o evento leva: a peça com o caso montado, ou a rota do caso. */
export function rotaDoEvento(e: EventoDoRadar): string | null {
  if (e.modeloId) {
    const q = e.contratoId ? `?contrato=${e.contratoId}` : e.licitacaoId ? `?licitacao=${e.licitacaoId}` : '';
    return `/apoio-juridico/redigir/${e.modeloId}${q}`;
  }
  return e.rota ?? null;
}
