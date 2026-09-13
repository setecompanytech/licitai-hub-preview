import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Bold, Italic, Underline, List, ListOrdered, AlignLeft, AlignCenter, AlignRight, Undo, Redo } from 'lucide-react';

interface Props {
  value: string;
  onChange: (html: string) => void;
}

const FERRAMENTAS: { cmd: string; rotulo: string; Icone: typeof Bold }[][] = [
  [
    { cmd: 'bold', rotulo: 'Negrito', Icone: Bold },
    { cmd: 'italic', rotulo: 'Itálico', Icone: Italic },
    { cmd: 'underline', rotulo: 'Sublinhado', Icone: Underline },
  ],
  [
    { cmd: 'insertUnorderedList', rotulo: 'Lista com marcadores', Icone: List },
    { cmd: 'insertOrderedList', rotulo: 'Lista numerada', Icone: ListOrdered },
  ],
  [
    { cmd: 'justifyLeft', rotulo: 'Alinhar à esquerda', Icone: AlignLeft },
    { cmd: 'justifyCenter', rotulo: 'Centralizar', Icone: AlignCenter },
    { cmd: 'justifyRight', rotulo: 'Alinhar à direita', Icone: AlignRight },
  ],
];

export default function RichEditor({ value, onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || '';
    }
  }, [value]);

  const exec = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    if (ref.current) onChange(ref.current.innerHTML);
  };

  return (
    <div className="overflow-hidden rounded-md border border-border bg-background">
      <div role="toolbar" aria-label="Formatação do texto" className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/50 p-2">
        {FERRAMENTAS.map((grupo, gi) => (
          <div key={gi} className="flex items-center gap-1">
            {gi > 0 && <div className="mx-1 h-5 w-px bg-border" aria-hidden="true" />}
            {grupo.map(({ cmd, rotulo, Icone }) => (
              <Button
                key={cmd}
                type="button"
                variant="ghost"
                size="sm"
                className="w-9 px-0"
                aria-label={rotulo}
                title={rotulo}
                onClick={() => exec(cmd)}
              >
                <Icone className="w-4 h-4" aria-hidden="true" />
              </Button>
            ))}
          </div>
        ))}
        <div className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        {/* Select nativo de propósito: um menu Radix roubaria o foco do
            contentEditable e o formatBlock perderia a seleção. */}
        <select
          aria-label="Formato do bloco"
          onChange={(e) => exec('formatBlock', e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <option value="p">Parágrafo</option>
          <option value="h1">Título 1</option>
          <option value="h2">Título 2</option>
          <option value="h3">Título 3</option>
        </select>
        <div className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        <Button type="button" variant="ghost" size="sm" className="w-9 px-0" aria-label="Desfazer" title="Desfazer" onClick={() => exec('undo')}>
          <Undo className="w-4 h-4" aria-hidden="true" />
        </Button>
        <Button type="button" variant="ghost" size="sm" className="w-9 px-0" aria-label="Refazer" title="Refazer" onClick={() => exec('redo')}>
          <Redo className="w-4 h-4" aria-hidden="true" />
        </Button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        aria-label="Conteúdo do documento"
        onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
        className="prose prose-sm dark:prose-invert min-h-[400px] max-w-none p-4 text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      />
    </div>
  );
}
