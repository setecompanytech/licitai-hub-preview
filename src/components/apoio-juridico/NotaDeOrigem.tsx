import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { interpretarNota } from '@/lib/juridico/notas-de-origem';
import { cn } from '@/lib/utils';

/**
 * O chip de origem dentro da peça (27/09/2026). O preview passa este
 * componente ao ReactMarkdown como `a`: links `nota://` viram chips — norma
 * conferida em verde (com a síntese no title e o texto oficial no clique),
 * norma fora da lista em âmbar "a confirmar", dado do sistema em azul,
 * anexo e base em cinza. Link comum continua link.
 */
export default function NotaDeOrigem({ href, children, className, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { children?: ReactNode }) {
  if (!href?.startsWith('nota://')) {
    return <a href={href} className={className} target="_blank" rel="noreferrer" {...rest}>{children}</a>;
  }
  const [tipo, ...resto] = href.slice('nota://'.length).split('/');
  const nota = interpretarNota(tipo, decodeURIComponent(resto.join('/')));
  const base = 'mx-0.5 inline-flex max-w-full items-center gap-1 rounded-sm border px-1.5 py-0 align-baseline text-[11px] font-medium leading-4 no-underline';
  if (!nota) return null;
  if (nota.tipo === 'norma') {
    if (nota.conferida) {
      return (
        <a
          href={nota.conferida.url}
          target="_blank"
          rel="noreferrer"
          title={`${nota.conferida.literal ? 'Texto legal' : 'Síntese conferida'}: ${nota.conferida.texto}`}
          className={cn(base, 'border-success-line bg-success-tint text-success-ink hover:underline')}
          data-nota="norma-conferida"
        >
          {nota.conferida.diploma}{nota.conferida.dispositivo ? `, ${nota.conferida.dispositivo}` : ''}
        </a>
      );
    }
    return (
      <span
        title="Dispositivo fora da lista conferida contra o texto oficial — confira antes de protocolar."
        className={cn(base, 'border-warning-line bg-warning-tint text-warning-ink')}
        data-nota="norma-a-confirmar"
      >
        {nota.citacao} · a confirmar
      </span>
    );
  }
  if (nota.tipo === 'sistema') {
    return <span title="Dado lido do Praefectus (contrato, termos, itens, série oficial)" className={cn(base, 'border-info-line bg-info-tint text-info-ink')} data-nota="sistema">dado do sistema</span>;
  }
  if (nota.tipo === 'anexo') {
    return <span title="Extraído de documento anexado" className={cn(base, 'border-border bg-muted text-muted-foreground')} data-nota="anexo">anexo: {nota.referencia}</span>;
  }
  return <span title="Documento da Base Jurídica da empresa" className={cn(base, 'border-border bg-muted text-muted-foreground')} data-nota="base">base: {nota.titulo}</span>;
}
