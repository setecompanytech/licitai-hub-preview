import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Bold, Italic, Underline, List, ListOrdered, AlignLeft, AlignCenter, AlignRight, Undo, Redo } from 'lucide-react';

interface Props {
  value: string;
  onChange: (html: string) => void;
}

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
    <div className="border border-border rounded-md overflow-hidden bg-background">
      <div className="flex items-center gap-1 p-2 border-b border-border bg-muted/30 flex-wrap">
        <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => exec('bold')}><Bold className="w-3.5 h-3.5" /></Button>
        <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => exec('italic')}><Italic className="w-3.5 h-3.5" /></Button>
        <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => exec('underline')}><Underline className="w-3.5 h-3.5" /></Button>
        <div className="w-px h-5 bg-border mx-1" />
        <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => exec('insertUnorderedList')}><List className="w-3.5 h-3.5" /></Button>
        <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => exec('insertOrderedList')}><ListOrdered className="w-3.5 h-3.5" /></Button>
        <div className="w-px h-5 bg-border mx-1" />
        <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => exec('justifyLeft')}><AlignLeft className="w-3.5 h-3.5" /></Button>
        <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => exec('justifyCenter')}><AlignCenter className="w-3.5 h-3.5" /></Button>
        <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => exec('justifyRight')}><AlignRight className="w-3.5 h-3.5" /></Button>
        <div className="w-px h-5 bg-border mx-1" />
        <select onChange={(e) => exec('formatBlock', e.target.value)} className="h-7 text-xs bg-background border border-border rounded px-1">
          <option value="p">Parágrafo</option>
          <option value="h1">Título 1</option>
          <option value="h2">Título 2</option>
          <option value="h3">Título 3</option>
        </select>
        <div className="w-px h-5 bg-border mx-1" />
        <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => exec('undo')}><Undo className="w-3.5 h-3.5" /></Button>
        <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => exec('redo')}><Redo className="w-3.5 h-3.5" /></Button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
        className="min-h-[400px] p-4 outline-none prose prose-sm dark:prose-invert max-w-none text-sm"
        style={{ lineHeight: 1.6 }}
      />
    </div>
  );
}
