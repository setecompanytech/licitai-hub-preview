/**
 * A lista de pastas da aba Compromissos.
 *
 * ── O DEFEITO QUE ESTE MÓDULO CORRIGE ────────────────────────────────────
 *
 * A aba lia só `processos_interesse`, que é tabela PESSOAL (RLS por
 * `auth.uid() = user_id`). O Kanban lê `licitacoes`, que é da EMPRESA
 * (princípio 2 do CLAUDE.md). Resultado medido em 17/09 na O S
 * DISTRIBUIDORA: 31 processos no quadro e 2 pastas na aba — as outras 26
 * pertenciam a um colega, e 5 processos não tinham compromisso nenhum.
 *
 * Como a pasta é onde o processo é montado (edital, documentos, anexos),
 * uma pasta que só existe para quem cadastrou deixa o colega sem acesso ao
 * trabalho da empresa. Aqui o universo passa a ser o do quadro, e o
 * compromisso pessoal vira CAMADA: alertas, score da IA e a decisão de
 * participação continuam sendo de cada um.
 *
 * Os dois eixos seguem separados, como `MeusCompromissos` já declarava:
 *   `licitacoes.status`          → andamento do processo na empresa
 *   `processos_interesse.status` → decisão pessoal de acompanhar
 *
 * O arquivamento vem da licitação, não da decisão pessoal: é ele que move o
 * cartão no Kanban, e as duas telas precisam concordar sobre o que saiu da
 * mesa de trabalho.
 */

/** Processo do quadro da empresa — as colunas que a aba precisa de `licitacoes`. */
export type ProcessoDaEmpresa = {
  id: string;
  numero: string | null;
  orgao: string | null;
  objeto: string | null;
  modalidade: string | null;
  ano_compra?: string | null;
  valor_estimado: number | null;
  uf: string | null;
  municipio: string | null;
  data_encerramento: string | null;
  status: string | null;
  arquivado_em: string | null;
  /** Colunas a mais que a página completa usa; a aba não precisa delas. */
  empresa_id?: string | null;
  data_abertura?: string | null;
  portal?: string | null;
  url_edital?: string | null;
};

/** Compromisso pessoal — a camada de acompanhamento de quem está olhando. */
export type CompromissoPessoal = {
  id: string;
  licitacao_id: string | null;
  numero: string | null;
  orgao: string | null;
  objeto: string | null;
  modalidade: string | null;
  valor_estimado: number | null;
  uf: string | null;
  municipio: string | null;
  data_encerramento: string | null;
  status: string;
  ia_score: number | null;
  alerta_sistema: boolean | null;
  alerta_email: boolean | null;
  alerta_whatsapp: boolean | null;
  created_at?: string | null;
  empresa_id?: string | null;
  data_abertura?: string | null;
  portal?: string | null;
  url?: string | null;
  auto_cadastro?: boolean | null;
  ia_recomendacao?: string | null;
};

export type Pasta = {
  /** Chave de lista: o compromisso quando existe, senão a licitação. */
  id: string;
  compromissoId: string | null;
  licitacaoId: string | null;
  numero: string | null;
  orgao: string | null;
  objeto: string | null;
  modalidade: string | null;
  ano_compra: string | null;
  valor_estimado: number | null;
  uf: string | null;
  municipio: string | null;
  data_encerramento: string | null;
  /** Decisão pessoal de acompanhamento, ou `interessado` para quem ainda não decidiu. */
  situacao: string;
  /** Saiu da mesa de trabalho — vem do arquivamento do processo. */
  arquivada: boolean;
  ia_score: number | null;
  alerta_sistema: boolean | null;
  alerta_email: boolean | null;
  alerta_whatsapp: boolean | null;
  /**
   * A pasta existe no quadro da empresa e esta pessoa ainda não tem
   * compromisso próprio nela — logo, não recebe os alertas de prazo.
   */
  semCompromissoProprio: boolean;
  empresa_id: string | null;
  data_abertura: string | null;
  portal: string | null;
  /** Link do edital no portal de origem. */
  url: string | null;
  /** Compromisso criado pelo monitoramento automático, não por decisão da pessoa. */
  auto_cadastro: boolean;
  ia_recomendacao: string | null;
  /** Desde quando esta pessoa acompanha — `null` para quem ainda não acompanha. */
  acompanhadaDesde: string | null;
};

/** Ordenação: prazo mais apertado primeiro; sem prazo, no fim. */
function chaveDePrazo(iso: string | null): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

/**
 * Junta o quadro da empresa com os compromissos pessoais.
 *
 * Regras:
 *  - todo processo da empresa vira pasta, tenha ou não compromisso pessoal;
 *  - compromisso pessoal ainda sem processo (pasta criada antes de o processo
 *    existir) continua na lista — é trabalho que alguém começou;
 *  - dois compromissos para a mesma licitação (existe 1 caso na base, sem
 *    índice único até agora) rendem UMA pasta: vence o mais antigo, que é o
 *    que carrega o histórico de alertas.
 */
export function montarPastas(
  processos: ProcessoDaEmpresa[],
  compromissos: CompromissoPessoal[],
): Pasta[] {
  const porLicitacao = new Map<string, CompromissoPessoal>();
  for (const c of compromissos) {
    if (!c.licitacao_id) continue;
    const atual = porLicitacao.get(c.licitacao_id);
    if (!atual) { porLicitacao.set(c.licitacao_id, c); continue; }
    const antigo = (c.created_at ?? '') < (atual.created_at ?? '') ? c : atual;
    porLicitacao.set(c.licitacao_id, antigo);
  }

  const pastas: Pasta[] = processos.map((p) => {
    const c = porLicitacao.get(p.id) ?? null;
    return {
      id: c?.id ?? `licitacao:${p.id}`,
      compromissoId: c?.id ?? null,
      licitacaoId: p.id,
      numero: p.numero,
      orgao: p.orgao,
      objeto: p.objeto,
      modalidade: p.modalidade,
      ano_compra: p.ano_compra ?? null,
      valor_estimado: p.valor_estimado,
      uf: p.uf,
      municipio: p.municipio,
      // O prazo do processo manda: é o que o Kanban e a agenda mostram.
      data_encerramento: p.data_encerramento ?? c?.data_encerramento ?? null,
      situacao: p.arquivado_em ? 'arquivado' : (c?.status ?? 'interessado'),
      arquivada: !!p.arquivado_em,
      ia_score: c?.ia_score ?? null,
      alerta_sistema: c?.alerta_sistema ?? null,
      alerta_email: c?.alerta_email ?? null,
      alerta_whatsapp: c?.alerta_whatsapp ?? null,
      semCompromissoProprio: !c,
      // O processo manda no que é do edital; o compromisso completa o que o
      // processo não tem (a pasta manual gravava só na tabela pessoal).
      empresa_id: p.empresa_id ?? c?.empresa_id ?? null,
      data_abertura: p.data_abertura ?? c?.data_abertura ?? null,
      portal: p.portal ?? c?.portal ?? null,
      url: p.url_edital ?? c?.url ?? null,
      auto_cadastro: !!c?.auto_cadastro,
      ia_recomendacao: c?.ia_recomendacao ?? null,
      acompanhadaDesde: c?.created_at ?? null,
    };
  });

  for (const c of compromissos) {
    if (c.licitacao_id) continue;
    pastas.push({
      id: c.id,
      compromissoId: c.id,
      licitacaoId: null,
      numero: c.numero,
      orgao: c.orgao,
      objeto: c.objeto,
      modalidade: c.modalidade,
      ano_compra: null,
      valor_estimado: c.valor_estimado,
      uf: c.uf,
      municipio: c.municipio,
      data_encerramento: c.data_encerramento,
      situacao: c.status,
      arquivada: c.status === 'arquivado',
      ia_score: c.ia_score,
      alerta_sistema: c.alerta_sistema,
      alerta_email: c.alerta_email,
      alerta_whatsapp: c.alerta_whatsapp,
      semCompromissoProprio: false,
      empresa_id: c.empresa_id ?? null,
      data_abertura: c.data_abertura ?? null,
      portal: c.portal ?? null,
      url: c.url ?? null,
      auto_cadastro: !!c.auto_cadastro,
      ia_recomendacao: c.ia_recomendacao ?? null,
      acompanhadaDesde: c.created_at ?? null,
    });
  }

  return pastas.sort((a, b) => {
    if (a.arquivada !== b.arquivada) return a.arquivada ? 1 : -1;
    const prazo = chaveDePrazo(a.data_encerramento) - chaveDePrazo(b.data_encerramento);
    if (prazo !== 0) return prazo;
    return (a.numero || '').localeCompare(b.numero || '', 'pt-BR', { numeric: true });
  });
}
