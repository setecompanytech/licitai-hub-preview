import { describe, it, expect } from 'vitest';
import { isValidImageUrl } from '@/components/precificacao/ProdutoCardML';

/**
 * O defeito de 12/09: a Pesquisa de Preços inteira mostrava caixinha de
 * placeholder porque as miniaturas do Google Shopping (o que o Serper
 * devolve) não têm extensão de arquivo — e o validador só aceitava URL
 * terminada em .jpg/.png ou meia dúzia de CDNs conhecidos.
 */
describe('isValidImageUrl', () => {
  it('aceita as miniaturas do Google Shopping (sem extensão)', () => {
    expect(isValidImageUrl('https://encrypted-tbn0.gstatic.com/shopping?q=tbn:ANd9GcT123abc')).toBe(true);
    expect(isValidImageUrl('https://encrypted-tbn3.gstatic.com/images?q=tbn:ANd9GcQxyz')).toBe(true);
    expect(isValidImageUrl('https://lh3.googleusercontent.com/spp/AB12cd')).toBe(true);
  });

  it('mantém os CDNs de loja já aceitos', () => {
    expect(isValidImageUrl('https://http2.mlstatic.com/D_NQ_NP_2X_123-MLB456.webp')).toBe(true);
    expect(isValidImageUrl('https://m.media-amazon.com/images/I/71abc123.jpg')).toBe(true);
  });

  it('continua rejeitando lixo: tracking, logo, sem protocolo, vazio', () => {
    expect(isValidImageUrl('https://site.com/assets/logo.png')).toBe(false);
    expect(isValidImageUrl('https://adserver.com/pixel/1x1.gif')).toBe(false);
    expect(isValidImageUrl('data:image/png;base64,AAA')).toBe(false);
    expect(isValidImageUrl('')).toBe(false);
    expect(isValidImageUrl(undefined)).toBe(false);
  });

  it('URL comum de produto com extensão segue aceita', () => {
    expect(isValidImageUrl('https://loja.exemplo.com.br/produtos/notebook-dell.jpg?w=600')).toBe(true);
  });
});
