import { useRef, useState } from 'react';
import { Camera, Loader2, Trash2, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useAvatarPerfil } from '@/hooks/useAvatarPerfil';

/**
 * Foto de perfil — o bloco de envio no topo de "Meu perfil".
 *
 * A própria foto é o botão. Um campo de arquivo cru ("Escolher arquivo /
 * Nenhum arquivo selecionado") não parece parte do produto e não mostra o que
 * está gravado hoje; aqui o alvo é o retrato, e o que ele exibe é exatamente o
 * que os colegas veem.
 *
 * Aceita arrastar e soltar. É o gesto natural de quem já tem a foto aberta
 * numa pasta, e não custa nada além do `onDrop`.
 */
export default function FotoPerfil({ nome, email }: { nome: string; email: string }) {
  const { url, carregando, enviando, enviar, remover } = useAvatarPerfil();
  const entrada = useRef<HTMLInputElement>(null);
  const [sobre, setSobre] = useState(false);

  const iniciais = (nome || email)
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  async function processar(arquivo?: File | null) {
    if (!arquivo) return;
    try {
      await enviar(arquivo);
      toast.success('Foto atualizada.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não consegui enviar a foto.');
    }
  }

  async function apagar() {
    try {
      await remover();
      toast.success('Foto removida.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não consegui remover a foto.');
    }
  }

  return (
    <div className="mb-6 flex flex-wrap items-center gap-6 border-b border-border pb-6">
      <button
        type="button"
        onClick={() => entrada.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setSobre(true); }}
        onDragLeave={() => setSobre(false)}
        onDrop={(e) => {
          e.preventDefault();
          setSobre(false);
          processar(e.dataTransfer.files?.[0]);
        }}
        disabled={enviando}
        aria-label={url ? 'Trocar foto de perfil' : 'Adicionar foto de perfil'}
        className={cn(
          'group relative h-24 w-24 shrink-0 overflow-hidden rounded-full',
          'border-2 border-dashed transition-colors',
          sobre ? 'border-primary bg-primary-tint' : 'border-border hover:border-muted-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-wait',
        )}
      >
        {carregando ? (
          <Skeleton className="absolute inset-0 rounded-full" />
        ) : url ? (
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center bg-muted text-xl font-bold text-muted-foreground">
            {iniciais || <UserRound className="h-6 w-6" aria-hidden="true" />}
          </span>
        )}

        {/* O véu com a câmera só aparece no hover — sobre a foto ele diz "dá
            para trocar", e fora dele a foto fica limpa. É um véu escuro sobre
            imagem, por isso o texto claro. */}
        <span
          className={cn(
            'absolute inset-0 flex items-center justify-center bg-navy/65 text-primary-foreground',
            'opacity-0 transition-opacity',
            enviando ? 'opacity-100' : 'group-hover:opacity-100 group-focus-visible:opacity-100',
          )}
        >
          {enviando
            ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            : <Camera className="h-5 w-5" aria-hidden="true" />}
        </span>
      </button>

      <div className="min-w-0">
        <p className="text-base font-semibold text-foreground">Foto de perfil</p>
        <p className="mt-1 max-w-sm text-sm leading-5 text-muted-foreground">
          Aparece no topo do sistema, na equipe e no mural. Clique no círculo ou
          arraste uma imagem — ela é recortada no centro e reduzida
          automaticamente.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => entrada.current?.click()}
            disabled={enviando}
          >
            <Camera aria-hidden="true" />
            {url ? 'Trocar foto' : 'Enviar foto'}
          </Button>

          {url && (
            <Button
              type="button"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              onClick={apagar}
              disabled={enviando}
            >
              <Trash2 aria-hidden="true" />
              Remover
            </Button>
          )}
        </div>
      </div>

      <input
        ref={entrada}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => {
          processar(e.target.files?.[0]);
          // Zera para que escolher O MESMO arquivo de novo dispare o onChange —
          // caso de quem corrigiu a imagem por fora e reenviou com o mesmo nome.
          e.target.value = '';
        }}
      />
    </div>
  );
}
