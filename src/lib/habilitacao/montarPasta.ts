import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * "Montar pasta de habilitação" — materializa o checklist na pasta Habilitação
 * da aba Anexos. Processo da página, fora do React (padrão da casa): sobrevive
 * à troca de abas; os componentes observam.
 *
 * Dinâmica: cada linha do checklist casada com um documento do cofre
 * (Jurídico → Documentos ou agent_documentos) é COPIADA para os anexos do
 * processo, nomeada na ordem do edital ("5.4.1 — CNDT.pdf"). Cópia, não
 * referência: o cofre é vivo (certidões renovam), o dossiê do certame é
 * fotografia — o arquivo apresentado NESTE pregão fica congelado aqui.
 * Linhas já casadas com a própria pasta (origem processo_anexos) são puladas.
 */

export type EstadoMontagem = {
  rodando: boolean;
  fase: string;
  /** Incrementa a cada montagem concluída — dispara recarga na UI (Anexos). */
  concluidas: number;
};

const INICIAL: EstadoMontagem = { rodando: false, fase: '', concluidas: 0 };
const estados = new Map<string, EstadoMontagem>();
const listeners = new Map<string, Set<() => void>>();

function setEstado(licitacaoId: string, patch: Partial<EstadoMontagem>) {
  const atual = estados.get(licitacaoId) ?? { ...INICIAL };
  estados.set(licitacaoId, { ...atual, ...patch });
  listeners.get(licitacaoId)?.forEach((cb) => cb());
}

export function getEstadoMontagem(licitacaoId: string): EstadoMontagem {
  return estados.get(licitacaoId) ?? INICIAL;
}

export function subscribeMontagem(licitacaoId: string, cb: () => void): () => void {
  if (!listeners.has(licitacaoId)) listeners.set(licitacaoId, new Set());
  listeners.get(licitacaoId)!.add(cb);
  return () => listeners.get(licitacaoId)?.delete(cb);
}

const sanitizar = (s: string) =>
  s.replace(/[/\\:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 120);

type LinhaCasada = {
  referencia: string | null;
  exigencia: string;
  tipo: string | null;
  grupo: string | null;
  documento_origem: string;
  documento_id: string;
  documento_nome: string | null;
};

/** Primeira referência da lista unida pela IA ("10.4.3.b; TR 9.6.4" → "10.4.3.b"). */
const primeiraRef = (ref: string | null) => (ref || '').split(';')[0].trim() || null;

/** Busca o blob do documento casado, conforme o cofre de origem. Lança com a causa real. */
async function blobDoDocumento(linha: LinhaCasada): Promise<{ blob: Blob; ext: string; segmento?: string | null }> {
  if (linha.documento_origem === 'documentos') {
    const { data: doc, error: qErr } = await supabase
      .from('documentos')
      .select('arquivo_path, segmento')
      .eq('id', linha.documento_id)
      .maybeSingle();
    if (qErr) throw new Error(`consulta ao cofre: ${qErr.message}`);
    if (!doc) throw new Error('documento não visível no cofre (permissão/RLS?)');
    if (!doc.arquivo_path) throw new Error('documento do cofre sem arquivo anexado');
    const { data: signed, error: sErr } = await supabase.storage
      .from('documentos-habilitacao')
      .createSignedUrl(doc.arquivo_path, 300);
    if (sErr || !signed?.signedUrl) throw new Error(`link do arquivo: ${sErr?.message || 'não gerado'}`);
    const resp = await fetch(signed.signedUrl);
    if (!resp.ok) throw new Error(`download do cofre: HTTP ${resp.status}`);
    const blob = await resp.blob();
    const ext = doc.arquivo_path.match(/\.(\w{2,5})$/)?.[1]?.toLowerCase() || 'pdf';
    return { blob, ext, segmento: doc.segmento ?? null };
  }
  if (linha.documento_origem === 'agent_documentos') {
    const { data: doc, error: qErr } = await supabase
      .from('agent_documentos')
      .select('arquivo_url')
      .eq('id', linha.documento_id)
      .maybeSingle();
    if (qErr) throw new Error(`consulta ao cofre automático: ${qErr.message}`);
    const url = doc?.arquivo_url;
    if (!url || !/^https?:\/\//.test(url)) throw new Error('cofre automático sem URL de arquivo');
    const resp = await fetch(url).catch(() => null);
    if (!resp?.ok) throw new Error(`download do cofre automático: HTTP ${resp?.status ?? 'falhou'}`);
    const blob = await resp.blob();
    const ext = url.match(/\.(\w{2,5})(?:\?|$)/)?.[1]?.toLowerCase() || 'pdf';
    return { blob, ext };
  }
  throw new Error(`origem desconhecida: ${linha.documento_origem}`);
}

export async function montarPastaHabilitacao(licitacaoId: string): Promise<void> {
  if (getEstadoMontagem(licitacaoId).rodando) return;
  setEstado(licitacaoId, { rodando: true, fase: 'Lendo o checklist…' });
  try {
    const { data: u } = await supabase.auth.getUser();
    if (!u?.user) throw new Error('Sessão expirada — entre novamente.');

    const { data: linhas } = await supabase
      .from('processo_habilitacao_checklist' as never)
      .select('referencia, exigencia, tipo, grupo, documento_origem, documento_id, documento_nome, status')
      .eq('licitacao_id', licitacaoId)
      .in('status', ['ok', 'vence_antes_sessao'])
      .not('documento_id', 'is', null);

    // UMA cópia por documento do cofre, não por exigência: várias linhas do
    // checklist podem casar com o mesmo arquivo (ex.: CNDT atende 10.4.3.b/c/e).
    const porDocumento = new Map<string, LinhaCasada & { exigencias: string[]; refs: string[] }>();
    for (const l of ((linhas || []) as unknown as Array<LinhaCasada & { status: string }>)) {
      if (l.documento_origem === 'processo_anexos') continue; // já estão na pasta
      const chave = `${l.documento_origem}:${l.documento_id}`;
      const atual = porDocumento.get(chave);
      if (atual) {
        atual.exigencias.push(l.exigencia);
        if (l.referencia) atual.refs.push(l.referencia);
      } else {
        porDocumento.set(chave, { ...l, exigencias: [l.exigencia], refs: l.referencia ? [l.referencia] : [] });
      }
    }
    const casadas = [...porDocumento.values()];
    if (!casadas.length) {
      toast.info('Nenhum documento casado no checklist para copiar — gere o checklist primeiro.');
      return;
    }

    // Remontar SUBSTITUI a montagem anterior: remove só as cópias de origem
    // "cofre" (fotografias desta rotina) — anexos enviados manualmente pelo
    // usuário na pasta jamais são tocados.
    const { data: antigos } = await supabase
      .from('processo_anexos')
      .select('id, storage_path')
      .eq('licitacao_id', licitacaoId)
      .eq('categoria', 'habilitacao')
      .eq('origem', 'cofre');
    if (antigos?.length) {
      await supabase.storage.from('processo-arquivos').remove(antigos.map((a) => a.storage_path));
      await supabase.from('processo_anexos').delete().in('id', antigos.map((a) => a.id));
    }

    let copiados = 0;
    let falhas = 0;
    let primeiroErro: string | null = null;
    for (let i = 0; i < casadas.length; i++) {
      const linha = casadas[i];
      const rotulo = linha.documento_nome || linha.exigencia;
      setEstado(licitacaoId, { fase: `Copiando ${i + 1}/${casadas.length}: ${rotulo.slice(0, 60)}…` });

      try {
        const fonte = await blobDoDocumento(linha);

        // Nome limpo: só a PRIMEIRA referência; a lista completa de exigências
        // atendidas vai para a descrição do anexo.
        const ref = primeiraRef(linha.refs[0] ?? linha.referencia);
        const nomeArquivo = sanitizar(`${ref ? `${ref} — ` : ''}${rotulo}`) + `.${fonte.ext}`;

        // Chave do storage só aceita [\w.\-]: o nome bonito (com acentos e
        // travessões) vai para nome_arquivo; a chave é a versão ASCII segura.
        const chaveSegura = nomeArquivo
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .replace(/[^\w.-]/g, '_');
        const path = `${u.user.id}/${licitacaoId}/habilitacao/${Date.now()}_${chaveSegura}`;
        const { error: upErr } = await supabase.storage
          .from('processo-arquivos')
          .upload(path, fonte.blob, { upsert: false });
        if (upErr) throw new Error(`upload para o processo: ${upErr.message}`);

        const { error: insErr } = await supabase.from('processo_anexos').insert({
          licitacao_id: licitacaoId,
          user_id: u.user.id,
          categoria: 'habilitacao',
          nome_arquivo: nomeArquivo,
          storage_path: path,
          mime_type: fonte.blob.type || 'application/pdf',
          tamanho_bytes: fonte.blob.size,
          origem: 'cofre',
          descricao: `Atende: ${[...new Set(linha.refs.map(primeiraRef).filter(Boolean))].join('; ') || 'exigência do edital'} — ${linha.exigencias[0].slice(0, 120)}`,
          // Estrutura da pasta: mesmo agrupamento do Jurídico (grupo da Lei,
          // tipo da taxonomia, referência p/ ordenação, segmento do atestado).
          metadata: {
            grupo: linha.grupo,
            tipo: linha.tipo,
            referencia: ref,
            documento_id: linha.documento_id,
            documento_origem: linha.documento_origem,
            segmento: fonte.segmento ?? null,
          },
        });
        if (insErr) throw new Error(`registro do anexo: ${insErr.message}`);
        copiados++;
      } catch (e) {
        falhas++;
        if (!primeiroErro) {
          primeiroErro = `${rotulo.slice(0, 50)}: ${e instanceof Error ? e.message : 'erro inesperado'}`;
        }
      }
    }

    const partes = [`${copiados} copiado(s)`];
    if (falhas) partes.push(`${falhas} com falha`);
    if (falhas && primeiroErro) {
      // Falha silenciosa é proibida: mostra a causa real da primeira falha
      toast.error(`Pasta de habilitação: ${partes.join(' · ')}. Primeira falha — ${primeiroErro}`, { duration: 12000 });
    } else {
      toast.success(`Pasta de habilitação montada: ${partes.join(' · ')}. Confira na aba Anexos.`);
    }

    // Trilha de auditoria — direto, sem hook (estamos fora do React)
    const { data: lic } = await supabase.from('licitacoes').select('empresa_id').eq('id', licitacaoId).maybeSingle();
    await supabase.from('atividades_colaborador').insert({
      user_id: u.user.id,
      empresa_id: lic?.empresa_id ?? null,
      acao: 'habilitacao_pasta_montada',
      modulo: 'licitacoes',
      descricao: `Pasta de habilitação montada a partir do checklist: ${copiados} documento(s) copiado(s) do cofre.`,
      metadata: { licitacao_id: licitacaoId, copiados, falhas },
    });
  } catch (e) {
    toast.error(`Montar pasta de habilitação: ${e instanceof Error ? e.message : 'erro inesperado.'}`);
  } finally {
    const c = getEstadoMontagem(licitacaoId).concluidas;
    setEstado(licitacaoId, { rodando: false, fase: '', concluidas: c + 1 });
  }
}
