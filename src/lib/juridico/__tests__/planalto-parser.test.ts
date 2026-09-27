import { describe, it, expect } from 'vitest';
import { artigosDoPlanalto, textoLimpo } from '../../../../supabase/functions/_shared/planalto-parser';

/** Um pedaço com a cara das páginas do Planalto: âncoras, quebras dentro do "Art.", revogado em <strike>. */
const HTML = `<html><body>
<p><a name="art91"></a><span>Art. \r\n\t91. Os contratos ser&atilde;o assinados.</span></p>
<p><a name="art91§1"></a>§ 1º Par&aacute;grafo do 91.</p>
<p><a name="art92"></a><span>Art. \r\n\t92. S&atilde;o necess&aacute;rias em todo contrato cl&aacute;usulas que estabele&ccedil;am:</span></p>
<p><a name="art92i"></a>I - o objeto e seus elementos;</p>
<p><a name="art92§3"></a>§ 3º Independentemente do prazo de dura&ccedil;&atilde;o, o contrato dever&aacute; conter cl&aacute;usula.</p>
<p><strike>§ 5º Texto revogado que n&atilde;o pode entrar.</strike></p>
<p><a name="art44a"></a>Art. 44-A. Artigo inclu&iacute;do depois.</p>
<p><a name="art93"></a>Art. 93. &Uacute;ltimo.</p>
</body></html>`;

describe('leitor do Planalto', () => {
  it('reconhece artigos pela âncora e pelo conteúdo; inciso e parágrafo ficam dentro do artigo; revogado some', () => {
    const arts = artigosDoPlanalto(HTML);
    expect(arts.map((a) => a.numero)).toEqual(['91', '92', '44-A', '93']);
    const a92 = arts[1].texto;
    expect(a92.startsWith('Art. 92. São necessárias em todo contrato cláusulas que estabeleçam:')).toBe(true);
    expect(a92).toContain('\nI - o objeto e seus elementos;');
    expect(a92).toContain('§ 3º Independentemente do prazo de duração, o contrato deverá conter cláusula.');
    expect(a92).not.toContain('revogado');
    expect(arts[0].texto).toContain('§ 1º Parágrafo do 91.');
  });
  it('texto limpo: entidades, espaços e quebras', () => {
    expect(textoLimpo('<p>A&nbsp;&ordm;\r\n\tB</p><p>C</p>')).toBe('A º B\nC');
  });
});
