import { ExternalLink, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  caixasDoEspelho, dataBr, htmlDoEspelho, rodapeDoEspelho, sociosDoEspelho, URL_COMPROVANTE_OFICIAL, VAZIO,
  type DadosDoEspelho,
} from '@/lib/concorrentes/espelho-do-comprovante';

/**
 * O espelho do comprovante da Receita, no formulário dela: as mesmas caixas,
 * na mesma ordem, com os mesmos rótulos — e todos os campos que a fonte
 * pública entrega, inclusive os que o cartão de resumo não mostra (matriz,
 * data e motivo da situação, situação especial, EFR, sócios).
 *
 * Sem brasão nem cabeçalho da República: é espelho, e o rodapé diz que não
 * substitui o comprovante oficial, com o link para emiti-lo. A impressão
 * abre o mesmo documento, desenhado das mesmas caixas, para o navegador
 * imprimir ou salvar em PDF.
 */
const LARGURA: Record<number, string> = {
  2: 'sm:col-span-2', 3: 'sm:col-span-3', 4: 'sm:col-span-4', 6: 'sm:col-span-6',
  8: 'sm:col-span-8', 10: 'sm:col-span-10', 12: 'sm:col-span-12',
};

export default function EspelhoDoComprovante({ dados }: { dados: DadosDoEspelho }) {
  const linhas = caixasDoEspelho(dados);
  const socios = sociosDoEspelho(dados);

  const imprimir = () => {
    const janela = window.open('', '_blank');
    if (!janela) {
      toast.error('O navegador bloqueou a janela de impressão. Libere pop-ups para este site e tente de novo.');
      return;
    }
    janela.document.write(htmlDoEspelho(dados));
    janela.document.close();
  };

  return (
    <section className="g-cartao p-5" aria-labelledby="espelho-titulo">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 grow basis-56">
          <h2 id="espelho-titulo" className="text-lg font-semibold leading-6 text-foreground">Espelho do comprovante</h2>
          <p className="text-sm text-muted-foreground">
            O formulário da Receita, com todos os campos que a base pública entrega. Não é o comprovante oficial.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={imprimir}>
            <Printer className="h-4 w-4" aria-hidden="true" /> Imprimir ou salvar em PDF
          </Button>
          <Button asChild variant="ghost" size="sm">
            <a href={URL_COMPROVANTE_OFICIAL} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" aria-hidden="true" /> Emitir o oficial na Receita
            </a>
          </Button>
        </div>
      </div>

      <div className="rounded-sm border border-foreground/60 p-1" data-testid="espelho-formulario">
        {linhas.map((linha, i) => (
          <div key={i} className="mb-1 grid grid-cols-1 gap-1 last:mb-0 sm:grid-cols-12">
            {linha.map((caixa, j) => (
              <div
                key={j}
                className={cn(
                  'flex min-h-[2.5rem] flex-col justify-start border border-foreground/50 px-2 py-1',
                  caixa.titulo && 'items-center justify-center text-center text-xs font-bold uppercase tracking-wide',
                  LARGURA[caixa.largura] ?? 'sm:col-span-12',
                )}
              >
                {caixa.rotulo && (
                  <span className="text-[0.625rem] uppercase leading-3 tracking-wide text-muted-foreground">{caixa.rotulo}</span>
                )}
                {caixa.lista ? (
                  <ul className="mt-0.5 space-y-0.5">
                    {caixa.lista.map((item) => (
                      <li key={item} className="text-xs font-semibold leading-4 text-foreground">{item}</li>
                    ))}
                  </ul>
                ) : (
                  <>
                    <span className={cn('text-foreground', caixa.titulo ? '' : 'text-xs font-semibold leading-4')}>{caixa.valor}</span>
                    {caixa.subvalor && <span className="text-xs font-semibold leading-4 text-foreground">{caixa.subvalor}</span>}
                  </>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {socios.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-foreground">Quadro de sócios e administradores</h3>
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Qualificação</TableHead>
                  <TableHead>Entrada</TableHead>
                  <TableHead>Faixa etária</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {socios.map((s) => (
                  <TableRow key={`${s.nome}-${s.dataEntrada ?? ''}`}>
                    <TableCell className="font-medium">{s.nome}</TableCell>
                    <TableCell>{s.qualificacao || VAZIO}</TableCell>
                    <TableCell>{s.dataEntrada ? dataBr(s.dataEntrada) : VAZIO}</TableCell>
                    <TableCell>{s.faixaEtaria || VAZIO}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <p className="mt-4 text-xs leading-4 text-muted-foreground">{rodapeDoEspelho(dados)}</p>
    </section>
  );
}
