import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

/**
 * O carimbo anticópia estava indo para dentro da proposta do assinante.
 *
 * Quem selecionava a prévia e colava no campo do portal de compras entregava
 * "© PRAEFECTUS — Conteúdo protegido" dentro da peça licitatória: revela o
 * fornecedor de software e suja um documento que responde por regra de
 * habilitação. O comando de 13/09 é explícito — o documento gerado leva a
 * identidade da empresa PROPONENTE, não a nossa —, e isso vale para o que sai
 * da tela, não só para o PDF.
 *
 * Estes casos garantem as duas metades: a proteção continua onde o conteúdo é
 * nosso, e some onde é do cliente.
 */
describe('carimbo de cópia', () => {
  let handler: ((e: ClipboardEvent) => void) | null = null;

  beforeEach(async () => {
    vi.resetModules();
    const original = document.addEventListener.bind(document);
    vi.spyOn(document, 'addEventListener').mockImplementation((tipo, fn, opts) => {
      if (tipo === 'copy') handler = fn as (e: ClipboardEvent) => void;
      else original(tipo, fn as EventListener, opts);
    });
    // `initSecurityGuard` só arma o listener em produção; aqui se chama a
    // peça diretamente, que é o que se quer testar.
    const { copyWatermark } = await import('./security-guard');
    copyWatermark();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    handler = null;
    document.body.innerHTML = '';
  });

  const copiarDe = (html: string, seletor: string) => {
    document.body.innerHTML = html;
    const alvo = document.querySelector(seletor)!;
    const gravado: Record<string, string> = {};
    const evento = {
      clipboardData: { setData: (t: string, v: string) => { gravado[t] = v; } },
      preventDefault: vi.fn(),
    } as unknown as ClipboardEvent;

    vi.spyOn(window, 'getSelection').mockReturnValue({
      toString: () => alvo.textContent ?? '',
      anchorNode: alvo.firstChild,
    } as unknown as Selection);

    handler?.(evento);
    return { gravado, evento };
  };

  it('carimba o que é nosso', () => {
    const { gravado } = copiarDe('<article id="a">Análise da Aurélia</article>', '#a');
    expect(gravado['text/plain']).toContain('© PRAEFECTUS');
  });

  it('não carimba dentro da proposta do assinante', () => {
    const { gravado, evento } = copiarDe(
      '<div data-conteudo-do-cliente><p id="p">Proposta comercial da empresa</p></div>',
      '#p',
    );
    expect(gravado['text/plain']).toBeUndefined();
    expect(evento.preventDefault).not.toHaveBeenCalled();
  });
});
