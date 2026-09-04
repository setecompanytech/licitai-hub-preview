import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const BUCKET = 'avatares';
/** Lado do quadrado gravado. O avatar maior do app tem 48px; 512 cobre tela
 *  retina e ainda serve se alguém abrir a foto em tamanho grande um dia. */
const LADO = 512;
const EVENTO = 'praefectus:avatar';

/**
 * Foto de perfil do usuário.
 *
 * Mora no bucket `avatares` (Storage), não no banco: imagem em coluna infla
 * cada SELECT de perfil, some do cache do navegador e torna a troca um UPDATE
 * de linha quente. A coluna `profiles.avatar_url` guarda só o endereço.
 *
 * A URL também é escrita no metadata da sessão. É de lá que o cabeçalho lê —
 * mesmo caminho que `nome_completo` já usava. Sem essa segunda escrita, a foto
 * trocaria no modal e o topo continuaria com a antiga até o próximo login.
 *
 * O evento `praefectus:avatar` avisa quem já está montado. O metadata da
 * sessão só se propaga no próximo `getSession`, e sem o aviso o cabeçalho
 * ficaria desatualizado enquanto a aba estivesse aberta.
 */
export function useAvatarPerfil() {
  const { user } = useAuth();
  const [url, setUrl] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!user) { setCarregando(false); return; }
    let vivo = true;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!vivo) return;
      setUrl((data as { avatar_url?: string | null } | null)?.avatar_url ?? null);
      setCarregando(false);
    })();
    return () => { vivo = false; };
  }, [user]);

  // Outra parte da tela trocou a foto: acompanha sem recarregar.
  useEffect(() => {
    const ouvir = (e: Event) => setUrl((e as CustomEvent<string | null>).detail);
    window.addEventListener(EVENTO, ouvir);
    return () => window.removeEventListener(EVENTO, ouvir);
  }, []);

  const propagar = useCallback((nova: string | null) => {
    setUrl(nova);
    window.dispatchEvent(new CustomEvent<string | null>(EVENTO, { detail: nova }));
  }, []);

  /** Caminho dentro do bucket a partir da URL pública — para apagar a anterior. */
  const caminhoDe = (publica: string | null) => {
    if (!publica) return null;
    const marca = `/object/public/${BUCKET}/`;
    const i = publica.indexOf(marca);
    return i === -1 ? null : publica.slice(i + marca.length).split('?')[0];
  };

  /**
   * Recorta no centro e reduz para um quadrado de 512px, em WebP.
   *
   * Foto de celular chega com 4 MB e 4000px de lado — estouraria o limite de
   * 2 MB do bucket, e o app mostraria a imagem num círculo de 48px depois de
   * baixar tudo isso. Reduzir antes de enviar resolve os dois: cabe no limite
   * e o enquadramento fica certo sem pedir recorte manual.
   *
   * O recorte é do CENTRO. Rosto costuma estar no meio; nas exceções a pessoa
   * reenquadra e reenvia, o que é mais barato que embarcar um editor.
   */
  const preparar = (arquivo: File) =>
    new Promise<Blob>((resolve, reject) => {
      const leitor = new FileReader();
      leitor.onerror = () => reject(new Error('Não consegui ler o arquivo.'));
      leitor.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('O arquivo não parece ser uma imagem válida.'));
        img.onload = () => {
          const lado = Math.min(img.width, img.height);
          const tela = document.createElement('canvas');
          tela.width = LADO;
          tela.height = LADO;
          const ctx = tela.getContext('2d');
          if (!ctx) { reject(new Error('Seu navegador não permitiu processar a imagem.')); return; }
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(
            img,
            (img.width - lado) / 2, (img.height - lado) / 2, lado, lado,
            0, 0, LADO, LADO,
          );
          tela.toBlob(
            (b) => (b ? resolve(b) : reject(new Error('Não consegui preparar a imagem.'))),
            'image/webp',
            0.9,
          );
        };
        img.src = leitor.result as string;
      };
      leitor.readAsDataURL(arquivo);
    });

  const enviar = useCallback(async (arquivo: File) => {
    if (!user) throw new Error('Sessão expirada. Entre de novo.');

    /* Validação aqui é conveniência: quem recusa de verdade é o bucket, que
       tem limite de tamanho e lista de tipos. Mas mensagem clara antes do
       envio poupa a espera do upload para levar um erro genérico depois. */
    if (!arquivo.type.startsWith('image/')) {
      throw new Error('Escolha uma imagem (JPG, PNG ou WebP).');
    }
    if (arquivo.size > 12 * 1024 * 1024) {
      throw new Error('Imagem muito grande. O limite é 12 MB antes do recorte.');
    }

    setEnviando(true);
    try {
      const anterior = caminhoDe(url);
      const blob = await preparar(arquivo);
      const caminho = `${user.id}/${crypto.randomUUID()}.webp`;

      const { error: erroUp } = await supabase.storage
        .from(BUCKET)
        .upload(caminho, blob, { contentType: 'image/webp', upsert: false });
      if (erroUp) throw new Error(erroUp.message);

      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(caminho);
      const nova = pub.publicUrl;

      const { error: erroPerfil } = await supabase
        .from('profiles')
        .update({ avatar_url: nova } as never)
        .eq('user_id', user.id);
      if (erroPerfil) throw new Error(erroPerfil.message);

      await supabase.auth.updateUser({ data: { avatar_url: nova } });

      /* A antiga sai só DEPOIS que a nova está gravada e apontada. Na ordem
         inversa, uma falha no meio deixaria o perfil apontando para um arquivo
         que não existe mais — e o avatar sumiria sem a pessoa ter pedido. */
      if (anterior) {
        await supabase.storage.from(BUCKET).remove([anterior]);
      }

      propagar(nova);
      return nova;
    } finally {
      setEnviando(false);
    }
  }, [user, url, propagar]);

  const remover = useCallback(async () => {
    if (!user) return;
    setEnviando(true);
    try {
      const caminho = caminhoDe(url);

      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: null } as never)
        .eq('user_id', user.id);
      if (error) throw new Error(error.message);

      await supabase.auth.updateUser({ data: { avatar_url: null } });
      if (caminho) await supabase.storage.from(BUCKET).remove([caminho]);

      propagar(null);
    } finally {
      setEnviando(false);
    }
  }, [user, url, propagar]);

  return { url, carregando, enviando, enviar, remover };
}

/**
 * Só a leitura, para quem apenas exibe a foto (cabeçalho, cabeçalho do modal).
 *
 * Começa pelo metadata da sessão, que já está em memória — assim o avatar
 * aparece no primeiro quadro, sem uma consulta antes. O evento mantém o valor
 * em dia quando a pessoa troca a foto com a tela aberta.
 */
export function useAvatarUrl() {
  const { user } = useAuth();
  const [url, setUrl] = useState<string | null>(
    (user?.user_metadata?.avatar_url as string | undefined) ?? null,
  );

  useEffect(() => {
    setUrl((user?.user_metadata?.avatar_url as string | undefined) ?? null);
  }, [user]);

  useEffect(() => {
    const ouvir = (e: Event) => setUrl((e as CustomEvent<string | null>).detail);
    window.addEventListener(EVENTO, ouvir);
    return () => window.removeEventListener(EVENTO, ouvir);
  }, []);

  return url;
}
