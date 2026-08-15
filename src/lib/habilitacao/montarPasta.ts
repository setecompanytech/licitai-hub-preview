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
  documento_origem: string;
  documento_id: string;
  documento_nome: string | null;
};

/** Busca o blob do documento casado, conforme o cofre de origem. Lança com a causa real. */
async function blobDoDocumento(linha: LinhaCasada): Promise<{ blob: Blob; ext: string }> {
  if (linha.documento_origem === 'documentos') {
    const { data: doc, error: qErr } = await supabase
      .from('documentos')
      .select('arquivo_path')
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
    return { blob, ext };
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
      .select('referencia, exigencia, documento_origem, documento_id, documento_nome, status')
      .eq('licitacao_id', licitacaoId)
      .in('status', ['ok', 'vence_antes_sessao'])
      .not('documento_id', 'is', null);

    const casadas = ((linhas || []) as unknown as Array<LinhaCasada & { status: string }>)
      .filter((l) => l.documento_origem !== 'processo_anexos'); // já estão na pasta
    if (!casadas.length) {
      toast.info('Nenhum documento casado no checklist para copiar — gere o checklist primeiro.');
      return;
    }

    // Evita duplicar: anexos já existentes na pasta Habilitação, por nome
    const { data: existentes } = await supabase
      .from('processo_anexos')
      .select('nome_arquivo')
      .eq('licitacao_id', licitacaoId)
      .eq('categoria', 'habilitacao');
    const nomesExistentes = new Set((existentes || []).map((a) => a.nome_arquivo));

    let copiados = 0;
    let pulados = 0;
    let falhas = 0;
    let primeiroErro: string | null = null;
    for (let i = 0; i < casadas.length; i++) {
      const linha = casadas[i];
      const rotulo = linha.documento_nome || linha.exigencia;
      setEstado(licitacaoId, { fase: `Copiando ${i + 1}/${casadas.length}: ${rotulo.slice(0, 60)}…` });

      try {
        const fonte = await blobDoDocumento(linha);

        const nomeArquivo = sanitizar(
          `${linha.referencia ? `${linha.referencia} — ` : ''}${rotulo}`,
        ) + `.${fonte.ext}`;
        if (nomesExistentes.has(nomeArquivo)) { pulados++; continue; }

        // Chave do storage só aceita [\w.\-]: o nome bonito (com acentos e
        // travessões) vai para nome_arquivo; a chave é a versão ASCII segura.
        const chaveSegura = nomeArquivo
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .replace(/[^\w.\-]/g, '_');
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
          descricao: `Copiado do cofre pelo checklist de habilitação (${linha.exigencia.slice(0, 140)})`,
        });
        if (insErr) throw new Error(`registro do anexo: ${insErr.message}`);
        nomesExistentes.add(nomeArquivo);
        copiados++;
      } catch (e) {
        falhas++;
        if (!primeiroErro) {
          primeiroErro = `${rotulo.slice(0, 50)}: ${e instanceof Error ? e.message : 'erro inesperado'}`;
        }
      }
    }

    const partes = [`${copiados} copiado(s)`];
    if (pulados) partes.push(`${pulados} já na pasta`);
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
      metadata: { licitacao_id: licitacaoId, copiados, pulados, falhas },
    });
  } catch (e) {
    toast.error(`Montar pasta de habilitação: ${e instanceof Error ? e.message : 'erro inesperado.'}`);
  } finally {
    const c = getEstadoMontagem(licitacaoId).concluidas;
    setEstado(licitacaoId, { rodando: false, fase: '', concluidas: c + 1 });
  }
}
