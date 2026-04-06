/**
 * PRAEFECTUS Security Guard
 * Proteções anti-cópia e anti-engenharia reversa para o frontend.
 * Não interfere em funcionalidades normais do sistema.
 */

const IS_PRODUCTION = import.meta.env.PROD;

/** Bloqueia atalhos de DevTools e cópia de código */
function blockDevToolsShortcuts() {
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    // F12
    if (e.key === 'F12') {
      e.preventDefault();
      return false;
    }
    // Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+Shift+C (DevTools)
    if (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key.toUpperCase())) {
      e.preventDefault();
      return false;
    }
    // Ctrl+U (View Source)
    if (e.ctrlKey && e.key.toUpperCase() === 'U') {
      e.preventDefault();
      return false;
    }
    // Ctrl+S (Save Page)
    if (e.ctrlKey && !e.shiftKey && e.key.toUpperCase() === 'S') {
      e.preventDefault();
      return false;
    }
  });
}

/** Bloqueia clique direito em todo o documento */
function blockContextMenu() {
  document.addEventListener('contextmenu', (e: MouseEvent) => {
    e.preventDefault();
    return false;
  });
}

/** Desabilita arrastar imagens e elementos */
function blockDragDrop() {
  document.addEventListener('dragstart', (e: DragEvent) => {
    e.preventDefault();
    return false;
  });
}

/** Detecta DevTools aberto via threshold de tempo (debugger) */
function devToolsDetector() {
  const threshold = 160;
  
  const check = () => {
    const widthThreshold = window.outerWidth - window.innerWidth > threshold;
    const heightThreshold = window.outerHeight - window.innerHeight > threshold;
    
    if (widthThreshold || heightThreshold) {
      // Log silencioso — não quebra nada
      console.clear();
      console.log(
        '%c⚠️ PRAEFECTUS — Ambiente Protegido',
        'color: #ff4444; font-size: 20px; font-weight: bold;'
      );
      console.log(
        '%cEste sistema é propriedade da PRAEFECTUS DADOS E CORPORATIVO LTDA.\nToda tentativa de engenharia reversa, cópia ou acesso não autorizado\nserá registrada e poderá resultar em ações legais conforme\na Lei 9.609/98 (Software) e Lei 9.610/98 (Direitos Autorais).',
        'color: #ff8800; font-size: 13px;'
      );
    }
  };

  setInterval(check, 2000);
}

/** Exibe aviso legal no console */
function consoleWarning() {
  console.log(
    '%c🛡️ PRAEFECTUS — Sistema Protegido',
    'color: #0066cc; font-size: 22px; font-weight: bold; text-shadow: 1px 1px 2px rgba(0,0,0,.3);'
  );
  console.log(
    '%cEste é um ambiente corporativo protegido por direitos autorais.\nAcesso não autorizado ao código-fonte é proibido.\n\n© PRAEFECTUS DADOS E CORPORATIVO LTDA — Todos os direitos reservados.',
    'color: #666; font-size: 12px;'
  );
  console.log(
    '%cSe você é um pesquisador de segurança, entre em contato:\nseguranca@praefectus.com.br',
    'color: #0066cc; font-size: 11px;'
  );
}

/** Desabilita seleção de texto em elementos sensíveis (não afeta inputs/textarea) */
function protectTextSelection() {
  const style = document.createElement('style');
  style.textContent = `
    body:not(input):not(textarea):not([contenteditable="true"]) {
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
      user-select: none;
    }
    input, textarea, [contenteditable="true"], pre, code,
    [data-selectable], .selectable {
      -webkit-user-select: text !important;
      -moz-user-select: text !important;
      -ms-user-select: text !important;
      user-select: text !important;
    }
  `;
  document.head.appendChild(style);
}

/** Sobrescreve copy para adicionar watermark */
function copyWatermark() {
  document.addEventListener('copy', (e: ClipboardEvent) => {
    const selection = window.getSelection()?.toString() || '';
    if (selection && e.clipboardData) {
      const watermarked = `${selection}\n\n© PRAEFECTUS — Conteúdo protegido. Reprodução não autorizada proibida.\nhttps://praefectus.com.br`;
      e.clipboardData.setData('text/plain', watermarked);
      e.preventDefault();
    }
  });
}

/** Detecta e bloqueia iframes não autorizados */
function antiFraming() {
  if (window.self !== window.top) {
    try {
      const allowedHosts = ['praefectus.com.br', 'app.praefectus.com.br', 'lovable.app', 'lovable.dev'];
      const parentHost = new URL(document.referrer).hostname;
      const isAllowed = allowedHosts.some(h => parentHost.endsWith(h));
      if (!isAllowed) {
        document.body.innerHTML = '<h1 style="text-align:center;margin-top:20vh;color:#ff4444;">⚠️ Acesso não autorizado</h1>';
      }
    } catch {
      // cross-origin — headers already block this
    }
  }
}

/** Inicializa todas as proteções (apenas em produção) */
export function initSecurityGuard() {
  // Aviso no console sempre
  consoleWarning();
  
  if (!IS_PRODUCTION) return;
  
  blockDevToolsShortcuts();
  blockContextMenu();
  blockDragDrop();
  devToolsDetector();
  protectTextSelection();
  copyWatermark();
  antiFraming();
}
