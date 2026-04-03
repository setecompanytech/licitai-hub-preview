// Portal-specific automation modules for the agent template

export const PORTAL_FILES: Record<string, string> = {
  'src/portals/base-portal.js': `/**
 * Classe base para todos os portais de licitação.
 * Cada portal deve estender esta classe e implementar os métodos abstratos.
 */
class BasePortal {
  constructor(page, credenciais) {
    this.page = page;
    this.credenciais = credenciais;
    this.nome = 'base';
    this.loggedIn = false;
  }

  async login() {
    throw new Error(\`login() não implementado para portal \${this.nome}\`);
  }

  async navegarParaDisputa(edital) {
    throw new Error(\`navegarParaDisputa() não implementado para portal \${this.nome}\`);
  }

  async lerMelhorLance() {
    throw new Error(\`lerMelhorLance() não implementado para portal \${this.nome}\`);
  }

  async enviarLance(valor) {
    throw new Error(\`enviarLance() não implementado para portal \${this.nome}\`);
  }

  async verificarResultado() {
    throw new Error(\`verificarResultado() não implementado para portal \${this.nome}\`);
  }

  async screenshot(nome) {
    const path = \`./logs/screenshots/\${this.nome}-\${nome}-\${Date.now()}.png\`;
    await this.page.screenshot({ path, fullPage: false });
    console.log(\`📸 Screenshot salvo: \${path}\`);
    return path;
  }

  async aguardarElemento(selector, timeout = 15000) {
    try {
      await this.page.waitForSelector(selector, { timeout });
      return true;
    } catch {
      console.warn(\`⚠️ Elemento não encontrado: \${selector} (timeout: \${timeout}ms)\`);
      return false;
    }
  }

  async preencherCampo(selector, valor) {
    await this.page.waitForSelector(selector, { timeout: 10000 });
    await this.page.click(selector, { clickCount: 3 });
    await this.page.type(selector, String(valor), { delay: 50 });
  }

  formatarMoeda(valor) {
    return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}

module.exports = { BasePortal };
`,

  'src/portals/comprasgov.js': `const { BasePortal } = require('./base-portal');

/**
 * Módulo de automação para o portal Compras.gov.br (CNET Mobile / ComprasNet-Web)
 *
 * URL base: https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web
 * Autenticação: SSO gov.br com certificado digital A1/A3
 *
 * Seletores SSO gov.br VERIFICADOS contra HTML real em 2026-03-31:
 *   - Form:            #loginData (form[id="loginData"])
 *   - CPF Input:        #accountId (input[name="accountId"] type="tel")
 *   - Botão Continuar:  #enter-account-id (button type="submit" value="enter-account-id" class="button-continuar")
 *   - Cert. Digital:    #login-certificate (button type="submit" value="login-certificate" formaction="https://certificado.sso.acesso.gov.br/...")
 *   - Cert. Nuvem:      div#cert-digital-cloud > button.button-href-mimic2
 *   - Provedores cloud: #login-external-authentication-neoid, #login-external-authentication-safeid, etc.
 *   - hCaptcha:         div#hcaptcha (pode aparecer após múltiplas tentativas)
 *   - QR Code:          .modal-qrcode (login sem senha)
 *
 * URL real da área pública: /comprasnet-web/public/compras
 * URL do fornecedor (pós-login): /comprasnet-web/private/fornecedor (a confirmar via VNC)
 *
 * ATENÇÃO: A sala de disputa pós-login usa Angular e os seletores internos
 * só podem ser verificados com credenciais reais via VNC no VPS.
 * Use docs/roteiro-testes-vps-comprasgov.md para re-mapear quando necessário.
 */
class ComprasGovPortal extends BasePortal {
  constructor(page, credenciais) {
    super(page, credenciais);
    this.nome = 'comprasgov';
    this.baseUrl = 'https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web';
    this.loginUrl = 'https://sso.acesso.gov.br';
    this.certLoginUrl = 'https://certificado.sso.acesso.gov.br';
    this.publicUrl = 'https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/public/compras';
    this.maxRetries = 3;
    this.retryDelay = 2000;
  }

  /**
   * Anti-detecção: remove marcadores de automação do navegador
   */
  async aplicarAntiDeteccao() {
    await this.page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      delete navigator.__proto__.webdriver;
      window.chrome = { runtime: {} };
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
      Object.defineProperty(navigator, 'languages', {
        get: () => ['pt-BR', 'pt', 'en-US', 'en'],
      });
    });
  }

  /**
   * Delay humanizado entre ações (300-800ms)
   */
  async delayHumano(min = 300, max = 800) {
    const ms = Math.floor(Math.random() * (max - min)) + min;
    await this.page.waitForTimeout(ms);
  }

  /**
   * Retry wrapper para operações instáveis
   */
  async comRetry(fn, descricao, tentativas = this.maxRetries) {
    for (let i = 1; i <= tentativas; i++) {
      try {
        return await fn();
      } catch (err) {
        console.warn(\`⚠️ [\${descricao}] Tentativa \${i}/\${tentativas} falhou: \${err.message}\`);
        if (i === tentativas) throw err;
        await this.page.waitForTimeout(this.retryDelay * i);
      }
    }
  }

  /**
   * Detecta e sinaliza hCaptcha para intervenção manual via VNC
   */
  async verificarHCaptcha() {
    const temCaptcha = await this.page.evaluate(() => {
      const el = document.querySelector('#hcaptcha, .h-captcha, iframe[src*="hcaptcha"]');
      return el && el.offsetParent !== null;
    });
    if (temCaptcha) {
      console.warn('🔒 hCaptcha detectado! Aguardando resolução manual via VNC...');
      console.warn('   → Acesse a aba "Agente Cloud" na plataforma para resolver o captcha.');
      await this.screenshot('hcaptcha-detectado');
      // Aguarda até 120s para resolução manual
      await this.page.waitForFunction(
        () => {
          const el = document.querySelector('#hcaptcha, .h-captcha, iframe[src*="hcaptcha"]');
          return !el || el.offsetParent === null;
        },
        { timeout: 120000 }
      );
      console.log('✅ hCaptcha resolvido!');
    }
  }

  async login() {
    console.log('🔐 Iniciando login no Compras.gov via SSO gov.br...');
    await this.aplicarAntiDeteccao();

    await this.comRetry(async () => {
      // 1. Acessar SSO gov.br (a URL exata depende do redirect do portal)
      //    O portal Compras.gov redireciona para sso.acesso.gov.br com client_id
      await this.page.goto(this.publicUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await this.delayHumano(500, 1200);

      // Clicar em "Acessar" ou "Login" se existir na página pública
      const loginClicked = await this.page.evaluate(() => {
        const links = [...document.querySelectorAll('a, button')];
        const loginLink = links.find(el => {
          const text = (el.textContent || '').toLowerCase();
          return text.includes('acessar') || text.includes('login') ||
                 text.includes('entrar') || text.includes('área do fornecedor');
        });
        if (loginLink) { loginLink.click(); return true; }
        return false;
      });

      if (loginClicked) {
        await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
      }

      // Se não redirecionou para SSO, ir diretamente
      const currentUrl = this.page.url();
      if (!currentUrl.includes('sso.acesso.gov.br') && !currentUrl.includes('acesso.gov.br')) {
        await this.page.goto(this.loginUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      }

      await this.delayHumano(500, 1200);
      await this.screenshot('sso-gov-br');

      // 2. Preencher CPF — Seletor VERIFICADO: #accountId (input[name="accountId"])
      const cpfField = await this.aguardarElemento('#accountId', 8000);
      if (cpfField && this.credenciais.cpf) {
        await this.preencherCampo('#accountId', this.credenciais.cpf);
        await this.delayHumano(300, 600);

        // Verificar hCaptcha antes de submeter
        await this.verificarHCaptcha();

        // Botão Continuar — Seletor VERIFICADO: #enter-account-id (button.button-continuar)
        await this.page.click('#enter-account-id');
        await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {
          // Pode não navegar se for AJAX
        });
        await this.delayHumano(500, 1000);
      }

      // 3. Selecionar certificado digital
      // Seletor VERIFICADO: #login-certificate (button[value="login-certificate"])
      // Está dentro de div#cert-digital .item-login-signup-ways
      // formaction aponta para https://certificado.sso.acesso.gov.br/login?...
      const certButton = await this.aguardarElemento('#login-certificate', 5000);
      if (certButton) {
        console.log('📜 Clicando em "Seu certificado digital"...');
        await this.page.click('#login-certificate');
      } else {
        // Fallback: buscar por texto nos botões
        const clicked = await this.page.evaluate(() => {
          const items = [...document.querySelectorAll('.item-login-signup-ways button, .item-login-signup-ways a, button, a')];
          const certLink = items.find(el => {
            const text = (el.textContent || '').toLowerCase();
            return (text.includes('certificado digital') || text.includes('seu certificado')) &&
                   !text.includes('nuvem');
          });
          if (certLink) { certLink.click(); return true; }
          return false;
        });
        if (!clicked) throw new Error('Botão de certificado digital não encontrado no SSO gov.br');
      }

      console.log('📜 Aguardando autenticação mTLS com certificado...');
      // O navegador vai redirecionar para certificado.sso.acesso.gov.br
      // que inicia o handshake TLS client-certificate
      await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 });
      await this.delayHumano(1000, 2000);

      // Verificar hCaptcha pós-certificado
      await this.verificarHCaptcha();

      await this.screenshot('pos-login-sso');
    }, 'login-sso');

    // 4. Verificar se precisa autorizar acesso ao Compras.gov
    const needsAuth = await this.page.evaluate(() => {
      const body = document.body.innerText.toLowerCase();
      return body.includes('autorizar') || body.includes('permitir acesso');
    });

    if (needsAuth) {
      console.log('📋 Autorizando acesso ao Compras.gov...');
      await this.page.evaluate(() => {
        const btn = [...document.querySelectorAll('button, input[type="submit"]')]
          .find(b => (b.textContent || b.value || '').toLowerCase().includes('autorizar'));
        if (btn) btn.click();
      });
      await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    }

    // 5. Navegar para área do fornecedor (ComprasNet-Web)
    await this.comRetry(async () => {
      // Tentar URLs conhecidas da área do fornecedor
      const possibleUrls = [
        \`\${this.baseUrl}/private/fornecedor\`,
        \`\${this.baseUrl}/pregao/fornecedor\`,
        \`\${this.baseUrl}/private/home\`,
        this.baseUrl,
      ];

      let found = false;
      for (const url of possibleUrls) {
        await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
        const isLogged = await this.page.evaluate(() => {
          const body = document.body.innerText;
          return body.includes('Fornecedor') || body.includes('Bem-vindo') ||
                 body.includes('Painel') || body.includes('UASG') ||
                 body.includes('Pregão') || body.includes('Meus Pregões') ||
                 body.includes('Em disputa') || body.includes('Abertas');
        });
        if (isLogged) { found = true; break; }
      }

      if (!found) {
        // Se nenhuma URL funcionou, verificar a página atual
        const pageText = await this.page.evaluate(() => document.body.innerText.substring(0, 500));
        console.log('📄 Conteúdo atual da página:', pageText);
      }
    }, 'navegar-area-fornecedor');

    // 6. Verificar login bem-sucedido
    const loggedIn = await this.page.evaluate(() => {
      const body = document.body.innerText;
      return body.includes('Fornecedor') || body.includes('Bem-vindo') ||
             body.includes('Painel') || body.includes('UASG') ||
             body.includes('Pregão') || body.includes('Meus Pregões') ||
             body.includes('Em disputa') || body.includes('Compras') ||
             body.includes('Abertas para participação');
    });

    if (!loggedIn) {
      await this.screenshot('login-falha');
      throw new Error('Login no Compras.gov falhou — verifique o certificado digital e credenciais SSO');
    }

    this.loggedIn = true;
    console.log('✅ Login no Compras.gov realizado com sucesso');
  }

  async navegarParaDisputa(edital) {
    console.log(\`📋 Navegando para disputa: \${edital}\`);
    await this.aplicarAntiDeteccao();

    await this.comRetry(async () => {
      // Ir para a lista de compras públicas com filtro "Em disputa"
      await this.page.goto(\`\${this.publicUrl}\`, {
        waitUntil: 'networkidle2', timeout: 25000,
      });
      await this.delayHumano(1000, 2000);

      // A página pública tem filtros: Situação, Etapa, Modalidade, etc.
      // Seletores observados do HTML real:
      //   - Filtro "Em disputa": provavelmente um select ou checkbox
      //   - Campo "Número da compra": input
      //   - Botão "Pesquisar"

      // Tentar preencher "Número da compra"
      const buscaSelectors = [
        'input[name="numCompra"]', 'input[name="numeroCompra"]',
        'input[placeholder*="compra"]', 'input[placeholder*="Número"]',
        'input[formcontrolname="numCompra"]',
        'input[type="search"]', '#numCompra',
        // Fallback genéricos
        'input[name="uasg"]', 'input[name="numPregao"]',
        'input[placeholder*="UASG"]', 'input[placeholder*="pregão"]',
        '#busca-pregao',
      ];

      let buscaFound = false;
      for (const sel of buscaSelectors) {
        const found = await this.aguardarElemento(sel, 2000);
        if (found) {
          await this.preencherCampo(sel, edital);
          buscaFound = true;
          break;
        }
      }

      if (!buscaFound) {
        // Fallback: procurar qualquer input de texto visível que pareça busca
        await this.page.evaluate((editalNum) => {
          const inputs = [...document.querySelectorAll('input[type="text"], input:not([type])')];
          const input = inputs.find(i => {
            if (i.offsetParent === null) return false;
            const ph = (i.placeholder || '').toLowerCase();
            const nm = (i.name || '').toLowerCase();
            return ph.includes('compra') || ph.includes('número') || ph.includes('busca') ||
                   nm.includes('compra') || nm.includes('num') || nm.includes('busca');
          });
          if (input) {
            input.value = editalNum;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }, edital);
      }

      await this.delayHumano(500, 1000);

      // Clicar em "Pesquisar"
      const pesquisarClicked = await this.page.evaluate(() => {
        const btns = [...document.querySelectorAll('button, input[type="submit"], a.btn')];
        const btn = btns.find(b => {
          const text = (b.textContent || b.value || '').toLowerCase();
          return text.includes('pesquisar') || text.includes('buscar') || text.includes('filtrar');
        });
        if (btn) { btn.click(); return true; }
        return false;
      });

      if (!pesquisarClicked) {
        await this.page.keyboard.press('Enter');
      }

      await this.page.waitForTimeout(5000);
      await this.screenshot('busca-resultado');

      // Clicar na sala de disputa / resultado
      const disputaClicked = await this.page.evaluate(() => {
        const links = [...document.querySelectorAll('a, button, tr, td, .card, .item')];
        const disputaLink = links.find(el => {
          const text = (el.textContent || '').toLowerCase();
          return text.includes('sala') || text.includes('disputa') ||
                 text.includes('participar') || text.includes('acessar') ||
                 text.includes('em andamento');
        });
        if (disputaLink) { disputaLink.click(); return true; }
        return false;
      });

      if (disputaClicked) {
        await this.page.waitForTimeout(5000);
      }

      await this.screenshot('sala-disputa');
      console.log('✅ Na sala de disputa');
    }, 'navegar-disputa');
  }

  async lerMelhorLance() {
    const valor = await this.page.evaluate(() => {
      const seletores = [
        '.melhor-lance', '.menor-lance', '.valor-lance',
        '#melhorLance', '#menorLance', '#valorAtual',
        'td.valor', '.lance-atual', '.proposta-valor',
        '[data-field="melhorLance"]', '[data-field="valor"]',
        'span.ng-star-inserted',
        '.mat-cell',
        'table tbody tr:first-child td:nth-child(3)',
        'table tbody tr:first-child td:nth-child(4)',
        '.classificacao-item:first-child .valor',
      ];
      for (const sel of seletores) {
        const el = document.querySelector(sel);
        if (el) {
          const texto = el.textContent.replace(/[^\\d.,]/g, '');
          if (!texto) continue;
          const parts = texto.split(',');
          if (parts.length === 2) {
            const inteiro = parts[0].replace(/\\./g, '');
            const num = parseFloat(inteiro + '.' + parts[1]);
            if (!isNaN(num) && num > 0) return num;
          }
          const num = parseFloat(texto.replace('.', '').replace(',', '.'));
          if (!isNaN(num) && num > 0) return num;
        }
      }
      return null;
    });

    if (valor === null) {
      console.warn('⚠️ Não foi possível ler o melhor lance atual');
      await this.screenshot('lance-leitura-falha');
    } else {
      console.log(\`💰 Melhor lance atual: R$ \${this.formatarMoeda(valor)}\`);
    }
    return valor;
  }

  async enviarLance(valor) {
    console.log(\`📤 Enviando lance: R$ \${this.formatarMoeda(valor)}\`);
    const valorStr = this.formatarMoeda(valor);

    await this.comRetry(async () => {
      const campoSelectors = [
        'input[name="valorLance"]', 'input[name="lance"]',
        '#campoLance', '#valorLance', '#inputLance',
        'input[type="text"][name*="lance"]',
        'input[formcontrolname="valorLance"]',
        'input[formcontrolname="lance"]',
        'input[placeholder*="lance"]', 'input[placeholder*="valor"]',
      ];

      let campoFound = false;
      for (const sel of campoSelectors) {
        const found = await this.aguardarElemento(sel, 2000);
        if (found) {
          await this.preencherCampo(sel, valorStr);
          campoFound = true;
          break;
        }
      }

      if (!campoFound) {
        await this.page.evaluate((val) => {
          const inputs = [...document.querySelectorAll('input[type="text"], input[type="number"], input:not([type])')];
          const campo = inputs.find(i =>
            i.offsetParent !== null &&
            (i.placeholder || '').toLowerCase().match(/lance|valor|proposta/)
          );
          if (campo) {
            campo.value = '';
            campo.focus();
            campo.value = val;
            campo.dispatchEvent(new Event('input', { bubbles: true }));
            campo.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }, valorStr);
      }

      await this.delayHumano(300, 600);

      const enviado = await this.page.evaluate(() => {
        const btns = [...document.querySelectorAll('button, input[type="submit"], a.btn')];
        const btn = btns.find(b => {
          const text = (b.textContent || b.value || '').toLowerCase();
          return text.includes('enviar') || text.includes('confirmar lance') ||
                 text.includes('registrar') || text.includes('submeter');
        });
        if (btn) { btn.click(); return true; }
        return false;
      });

      if (!enviado) throw new Error('Botão de enviar lance não encontrado');

      await this.delayHumano(500, 1000);

      // Confirmação em 2 etapas (modal)
      const modalConfirm = await this.page.evaluate(() => {
        const modals = document.querySelectorAll('.modal, .mat-dialog-container, .cdk-overlay-pane, [role="dialog"]');
        for (const modal of modals) {
          const btns = [...modal.querySelectorAll('button')];
          const ok = btns.find(b => {
            const text = (b.textContent || '').toLowerCase();
            return text.includes('confirmar') || text.includes('sim') || text.includes('ok');
          });
          if (ok) { ok.click(); return true; }
        }
        return false;
      });

      // Dialog nativo do browser
      this.page.once('dialog', async dialog => {
        console.log(\`📌 Confirmação: \${dialog.message()}\`);
        await dialog.accept();
      });

      await this.page.waitForTimeout(3000);
      await this.screenshot('lance-enviado');

      if (modalConfirm) {
        console.log('✅ Confirmação em 2 etapas aceita');
      }
    }, 'enviar-lance');

    console.log(\`✅ Lance de R$ \${valorStr} enviado\`);
    return true;
  }

  async verificarResultado() {
    return await this.page.evaluate(() => {
      const texto = document.body.innerText.toLowerCase();
      if (texto.includes('lance aceito') || texto.includes('lance registrado') ||
          texto.includes('sucesso') || texto.includes('lance enviado com sucesso')) {
        return 'aceito';
      }
      if (texto.includes('lance recusado') || texto.includes('valor inválido') ||
          texto.includes('erro ao enviar') || texto.includes('não aceito')) {
        return 'recusado';
      }
      if (texto.includes('sessão encerrada') || texto.includes('disputa encerrada') ||
          texto.includes('fase encerrada')) {
        return 'encerrado';
      }
      return 'indefinido';
    });
  }

  /**
   * Monitora a sala de disputa em tempo real.
   */
  async lerClassificacao() {
    return await this.page.evaluate(() => {
      const rows = document.querySelectorAll('table tbody tr, .classificacao-item');
      const classificacao = [];
      rows.forEach((row, i) => {
        const cells = row.querySelectorAll('td, span, .campo');
        if (cells.length >= 2) {
          classificacao.push({
            posicao: i + 1,
            fornecedor: (cells[0]?.textContent || '').trim(),
            valor: (cells[1]?.textContent || cells[2]?.textContent || '').trim(),
          });
        }
      });
      return classificacao;
    });
  }

  /**
   * Verifica se a fase de lances ainda está aberta
   */
  async faseAberta() {
    return await this.page.evaluate(() => {
      const texto = document.body.innerText.toLowerCase();
      return !texto.includes('encerrad') && !texto.includes('finalizad') &&
             (texto.includes('aberta') || texto.includes('em andamento') ||
              texto.includes('fase de lance') || texto.includes('disputa'));
    });
  }
}

module.exports = { ComprasGovPortal };
`,

  'src/portals/bll.js': `const { BasePortal } = require('./base-portal');

/**
 * Módulo de automação para o portal BLL (Bolsa de Licitações e Leilões)
 *
 * URL: https://bll.org.br
 * Autenticação: Login + senha (opcionalmente certificado)
 */
class BLLPortal extends BasePortal {
  constructor(page, credenciais) {
    super(page, credenciais);
    this.nome = 'bll';
    this.baseUrl = 'https://bll.org.br';
  }

  async login() {
    console.log('🔐 Iniciando login no BLL...');
    // BLL usa WordPress wp-login.php
    // Seletores VERIFICADOS em 2026-03-31:
    //   - Login: #user_login (input[name="log"])
    //   - Senha: #user_pass (input[name="pwd"])
    //   - Submit: #wp-submit (input[type="submit"][value="Acessar"])
    //   - Form: #loginform
    await this.page.goto(\`\${this.baseUrl}/wp-login.php\`, { waitUntil: 'networkidle2' });

    await this.preencherCampo('#user_login', this.credenciais.login);
    await this.preencherCampo('#user_pass', this.credenciais.senha);
    await this.page.click('#wp-submit');

    await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    await this.screenshot('pos-login');
    this.loggedIn = true;
    console.log('✅ Login no BLL realizado');
  }

  async navegarParaDisputa(edital) {
    console.log(\`📋 Navegando para disputa BLL: \${edital}\`);
    await this.page.goto(\`\${this.baseUrl}/pregao\`, { waitUntil: 'networkidle2' });
    await this.preencherCampo('input[name="busca"], #busca', edital);
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(3000);
    await this.screenshot('busca-edital');
  }

  async lerMelhorLance() {
    return await this.page.evaluate(() => {
      const el = document.querySelector('.menor-lance, .melhor-valor, td.valor');
      if (!el) return null;
      return parseFloat(el.textContent.replace(/[^\\d.,]/g, '').replace('.', '').replace(',', '.'));
    });
  }

  async enviarLance(valor) {
    console.log(\`📤 Enviando lance BLL: R$ \${this.formatarMoeda(valor)}\`);
    await this.preencherCampo('input[name="lance"], #valorLance', this.formatarMoeda(valor));

    await this.page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')]
        .find(b => b.textContent.toLowerCase().includes('enviar'));
      if (btn) btn.click();
    });

    this.page.on('dialog', async d => await d.accept());
    await this.page.waitForTimeout(3000);
    await this.screenshot('lance-bll');
    return true;
  }
}

module.exports = { BLLPortal };
`,

  'src/portals/licitacoes-e.js': `const { BasePortal } = require('./base-portal');

/**
 * Módulo de automação para o portal Licitações-e (Banco do Brasil)
 *
 * DUAS VERSÕES:
 *   - Legada: https://www.licitacoes-e.com.br/aop/
 *     Backend Java EE (JSP + Servlets), JSESSIONID, ~20min timeout
 *   - Nova (Lei 14.133): https://licitacoes-e2.bb.com.br
 *     Disputa abre automaticamente, dispensa 6-10h, modos Aberto/Fechado
 *
 * AUTENTICAÇÃO: Chave BB + Senha pessoal (conta bancária ou credenciamento)
 *
 * ARMADILHAS:
 *   - ⚠ JSESSIONID expira ~20min inativo → renovar a cada 15min
 *   - ⚠ Fase randômica encerra entre 1s e 30min → verificar a cada 1.5s
 *   - ⚠ Portal detecta automação → usar stealth + anti-detecção
 *   - ⚠ Taxa cobrada por participação
 *   - ⚠ Possível CAPTCHA → fallback VNC
 *
 * SELETORES MAPEADOS para ambas versões (v1 legado + v2 novo portal)
 */
class LicitacoesEPortal extends BasePortal {
  constructor(page, credenciais) {
    super(page, credenciais);
    this.nome = 'licitacoes-e';
    this.baseUrlV1 = 'https://www.licitacoes-e.com.br';
    this.baseUrlV2 = 'https://licitacoes-e2.bb.com.br';
    this.versao = credenciais.versao_portal || 'v2';
    this.baseUrl = this.versao === 'v1' ? this.baseUrlV1 : this.baseUrlV2;
    this.jsessionid = '';
    this.loginTimestamp = 0;
    this.maxRetries = 3;
    this.retryDelay = 2000;

    // ─── SELETORES v1 (legado) ─────────────────────────────
    this.seletoresV1 = {
      login: {
        campoCodigo: 'input[name="inCodigo"], input[id="codigo"], #txtChave',
        campoSenha: 'input[type="password"][name="inSenha"], #txtSenha',
        botaoEntrar: 'input[type="submit"][value*="Entrar"], #btnEntrar, .btn-login',
        erroLogin: '.mensagem-erro, #msgErro, .alert-danger',
        indicadorLogado: '#nomeUsuario, .usuario-logado, a[href*="sair"], a[href*="logout"]',
      },
      sala: {
        tituloLicitacao: '#tituloLicitacao, .titulo-pregao, h2.licitacao-titulo',
        menorLanceAtual: '#menorLance, .menor-lance, td.preco-melhor, .preco-atual',
        nossoUltimoLance: '#seuLance, .seu-lance, .lance-proprio',
        campoLance: 'input[name="vlLance"], input[id="vlLance"], #inputLance, input.valor-lance',
        botaoOferecer: 'button[onclick*="oferecer"], input[value*="Oferecer"], #btnLance, .btn-lance',
        botaoConfirmar: '#btnConfirmar, button[id*="confirmar"], .btn-confirmar-lance',
        botaoCancelar: '#btnCancelar, .btn-cancelar',
        modalConfirmacao: '#modalConfirmacao, .modal-lance, .dialog-confirmacao',
        cronometro: '#cronometro, .timer-disputa, #temporizador, .countdown',
        faseAtual: '#faseDisputa, .fase-atual, .status-pregao',
        indicadorRandom: '.fase-aleatoria, #faseRandomica, .tempo-aleatorio',
        tabelaLances: '#tabelaLances, table.historico-lances, .lances-realizados',
        containerChat: '#chat, #mensagensPregoeiro, .chat-pregao, iframe[id*="chat"]',
        listaMensagens: '#listaMensagens, .mensagens-chat, .historico-mensagens',
        itemMensagem: '.mensagem-chat, tr.mensagem, .msg-item',
        autorMensagem: '.autor-mensagem, .remetente, td.autor',
        textoMensagem: '.texto-mensagem, .conteudo-msg, td.conteudo',
        vencedorAnunciado: '.vencedor-disputa, #resultadoFinal, .licitante-vencedor',
        mensagemEncerramento: '.disputa-encerrada, #msgEncerramento',
        situacaoDisputa: '#situacaoDisputa, .status-disputa, .fase-disputa',
      },
      proposta: {
        listaItens: '#itensLicitacao, table.itens-proposta, .grid-itens',
        linhaItem: 'tr.item, .row-item, .item-licitacao',
        campoPrecoUnitario: 'input[name*="preco"], input[name*="vlUnitario"], .input-preco',
        campoMarca: 'input[name*="marca"], .input-marca',
        campoModelo: 'input[name*="modelo"], .input-modelo',
      },
    };

    // ─── SELETORES v2 (novo portal) ────────────────────────
    this.seletoresV2 = {
      login: {
        campoCodigo: '#codigoAcesso, input[name="codigoAcesso"]',
        campoSenha: '#senha, input[name="senha"]',
        botaoEntrar: 'button[type="submit"], .btn-acessar',
        captcha: '.g-recaptcha, #captcha',
        indicadorLogado: '.painel-fornecedor, #painelFornecedor',
      },
      sala: {
        menorLanceAtual: '[data-testid="menor-lance"], .melhor-proposta, .valor-destaque',
        campoLance: '[data-testid="input-lance"], input[placeholder*="lance"], input.lance-valor',
        botaoOferecer: '[data-testid="btn-lance"], button:has-text("Oferecer Lance")',
        botaoConfirmar: '#btnConfirmar, button[id*="confirmar"], .btn-confirmar-lance',
        cronometro: '[data-testid="cronometro"], .timer, .contador-regressivo',
        situacao: '[data-testid="situacao-disputa"], .chip-situacao',
        chatMensagens: '[data-testid="chat-mensagens"], .mensagens-disputa',
        tabelaLances: '[data-testid="historico-lances"], .tabela-lances',
        mensagemEncerramento: '.disputa-encerrada, [data-testid="encerrado"]',
        vencedorAnunciado: '[data-testid="vencedor"], .vencedor-disputa',
        faseAtual: '[data-testid="fase"], .fase-disputa',
        indicadorRandom: '[data-testid="fase-aleatoria"], .aleatoria',
        nossoUltimoLance: '[data-testid="meu-lance"], .meu-lance',
        situacaoDisputa: '[data-testid="situacao-disputa"], .situacao',
      },
    };
  }

  get S() {
    return this.versao === 'v1' ? this.seletoresV1 : this.seletoresV2;
  }

  get salaS() {
    return this.S.sala || this.S;
  }

  /**
   * Anti-detecção (Puppeteer stealth)
   */
  async aplicarAntiDeteccao() {
    await this.page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['pt-BR', 'pt', 'en-US', 'en'] });
      delete navigator.__proto__.webdriver;
      window.chrome = { runtime: {} };
    });
    await this.page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    );
  }

  async delayHumano(min = 300, max = 800) {
    const ms = Math.floor(Math.random() * (max - min)) + min;
    await this.page.waitForTimeout(ms);
  }

  async digitarHumano(selector, texto) {
    await this.page.click(selector);
    for (const char of texto) {
      await this.page.keyboard.type(char, { delay: Math.random() * 80 + 40 });
    }
  }

  async comRetry(fn, descricao, tentativas = this.maxRetries) {
    for (let i = 1; i <= tentativas; i++) {
      try {
        return await fn();
      } catch (err) {
        console.warn(\`⚠️ [\${descricao}] Tentativa \${i}/\${tentativas} falhou: \${err.message}\`);
        if (i === tentativas) throw err;
        await this.page.waitForTimeout(this.retryDelay * i);
      }
    }
  }

  // ─── LOGIN ───────────────────────────────────────────────────
  async login() {
    console.log(\`🔐 Iniciando login no Licitações-e (\${this.versao})...\`);
    await this.aplicarAntiDeteccao();

    if (this.versao === 'v1') {
      await this.loginV1();
    } else {
      await this.loginV2();
    }

    // Capturar JSESSIONID
    const cookies = await this.page.cookies();
    const sessionCookie = cookies.find(c =>
      c.name === 'JSESSIONID' || c.name.toLowerCase().includes('session')
    );
    this.jsessionid = sessionCookie?.value || '';
    this.loginTimestamp = Date.now();

    // Verificar login
    const logado = await this.verificarLogin();
    if (!logado) {
      await this.screenshot('login-falha');
      throw new Error('Falha na autenticação do Licitações-e. Verificar credenciais.');
    }

    this.loggedIn = true;
    console.log(\`✅ Login no Licitações-e (\${this.versao}) realizado — JSESSIONID: \${this.jsessionid.substring(0, 8)}...\`);
  }

  async loginV1() {
    const S = this.seletoresV1.login;
    await this.page.goto(\`\${this.baseUrlV1}/aop/index.jsp\`, {
      waitUntil: 'networkidle2', timeout: 30000,
    });

    // Clicar em "Acesso Identificado"
    await this.page.evaluate(() => {
      const link = [...document.querySelectorAll('a')].find(a =>
        (a.textContent || '').includes('Acesso Identificado') ||
        (a.textContent || '').includes('Fornecedor') ||
        (a.textContent || '').includes('Login')
      );
      if (link) link.click();
    });
    await this.page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {});
    await this.delayHumano(500, 1200);

    await this.aguardarElemento(S.campoCodigo, 15000);
    await this.digitarHumano(S.campoCodigo, this.credenciais.codigo_bb || this.credenciais.login);
    await this.delayHumano(500, 1200);
    await this.digitarHumano(S.campoSenha, this.credenciais.senha);
    await this.delayHumano(300, 800);

    await this.page.click(S.botaoEntrar);
    await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 });
  }

  async loginV2() {
    const S = this.seletoresV2.login;
    await this.page.goto(\`\${this.baseUrlV2}/aop/login\`, {
      waitUntil: 'networkidle2', timeout: 30000,
    });

    await this.aguardarElemento(S.campoCodigo, 15000);
    await this.digitarHumano(S.campoCodigo, this.credenciais.codigo_bb || this.credenciais.login);
    await this.delayHumano(400, 900);
    await this.digitarHumano(S.campoSenha, this.credenciais.senha);
    await this.delayHumano(300, 700);

    // Verificar CAPTCHA
    const temCaptcha = await this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el && el.offsetParent !== null;
    }, S.captcha || '.g-recaptcha');
    if (temCaptcha) {
      console.warn('🔒 CAPTCHA detectado! Aguardando resolução manual via VNC (120s)...');
      await this.screenshot('captcha-detectado');
      await this.page.waitForFunction(() => {
        const el = document.querySelector('.g-recaptcha, #captcha');
        return !el || el.offsetParent === null;
      }, { timeout: 120000 });
      console.log('✅ CAPTCHA resolvido!');
    }

    await this.page.click(S.botaoEntrar);
    await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 25000 });
  }

  async verificarLogin() {
    const S = this.S.login;
    try {
      await this.page.waitForSelector(S.indicadorLogado, { timeout: 8000 });
      return true;
    } catch {
      const erroSel = S.erroLogin || '.erro, .alert-danger';
      const erro = await this.page.$(erroSel);
      if (erro) {
        const textoErro = await erro.evaluate(el => el.textContent);
        throw new Error(\`Erro de login Licitações-e: \${textoErro}\`);
      }
      return false;
    }
  }

  // ─── RENOVAÇÃO DE SESSÃO (a cada 15min) ────────────────────
  async renovarSessao() {
    const quinzeMin = 15 * 60 * 1000;
    const agora = Date.now();
    if (agora - this.loginTimestamp >= quinzeMin) {
      console.log('🔄 Renovando sessão JSESSIONID...');
      await this.page.goto(
        this.versao === 'v1'
          ? \`\${this.baseUrlV1}/aop/suas-propostas.do\`
          : \`\${this.baseUrlV2}/aop/painel\`,
        { waitUntil: 'domcontentloaded', timeout: 10000 }
      );
      this.loginTimestamp = Date.now();
    }
  }

  // ─── NAVEGAÇÃO PARA SALA ───────────────────────────────────
  async navegarParaDisputa(edital) {
    console.log(\`📋 Navegando para disputa Licitações-e: \${edital}\`);

    await this.comRetry(async () => {
      const url = this.versao === 'v1'
        ? \`\${this.baseUrlV1}/aop/entrar-sala-disputa.do?nrLicitacao=\${edital}\`
        : \`\${this.baseUrlV2}/aop/pregao/\${edital}/sala\`;

      await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      const S = this.salaS;
      await this.page.waitForSelector(S.menorLanceAtual, { timeout: 20000 });
      await this.screenshot('sala-disputa-licitacoes-e');
      console.log('✅ Na sala de disputa do Licitações-e');
    }, 'navegar-sala');
  }

  // ─── LER MELHOR LANCE ──────────────────────────────────────
  async lerMelhorLance() {
    const S = this.salaS;
    const valor = await this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const texto = (el.textContent || '')
        .replace(/[R$\\s]/g, '')
        .replace(/\\./g, '')
        .replace(',', '.')
        .trim();
      return parseFloat(texto) || null;
    }, S.menorLanceAtual);

    if (valor !== null) {
      console.log(\`💰 Menor lance atual Licitações-e: R$ \${this.formatarMoeda(valor)}\`);
    }
    return valor;
  }

  // ─── ENVIAR LANCE ──────────────────────────────────────────
  async enviarLance(valor) {
    console.log(\`📤 Enviando lance Licitações-e: R$ \${this.formatarMoeda(valor)}\`);
    const S = this.salaS;
    const valorFormatado = valor.toFixed(2).replace('.', ',');

    await this.comRetry(async () => {
      // 1. Limpar e preencher campo
      const campoLance = await this.page.waitForSelector(S.campoLance, { timeout: 3000, visible: true });
      if (!campoLance) throw new Error('Campo de lance não encontrado');
      await this.page.click(S.campoLance, { clickCount: 3 });
      await this.page.keyboard.press('Backspace');
      await this.page.type(S.campoLance, valorFormatado, { delay: 50 });

      // 2. Clicar em "Oferecer Lance"
      const oferecerClicked = await this.page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (el) { el.click(); return true; }
        // Fallback por texto
        const btns = [...document.querySelectorAll('button, input[type="submit"]')];
        const btn = btns.find(b => (b.textContent || b.value || '').toLowerCase().includes('oferecer'));
        if (btn) { btn.click(); return true; }
        return false;
      }, S.botaoOferecer);
      if (!oferecerClicked) throw new Error('Botão "Oferecer Lance" não encontrado');

      // 3. Aguardar modal de confirmação
      await this.page.waitForTimeout(1000);
      const confirmSel = S.modalConfirmacao || S.botaoConfirmar;
      await this.aguardarElemento(confirmSel, 5000);

      // 4. Confirmar
      await this.page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (el) { el.click(); return; }
        const btns = [...document.querySelectorAll('button')];
        const btn = btns.find(b => (b.textContent || '').toLowerCase().includes('confirmar'));
        if (btn) btn.click();
      }, S.botaoConfirmar);

      // 5. Dialog nativo
      this.page.once('dialog', async dialog => {
        console.log(\`📌 Confirmação: \${dialog.message()}\`);
        await dialog.accept();
      });

      await this.page.waitForTimeout(1500);
      await this.screenshot('lance-enviado-licitacoes-e');
    }, 'enviar-lance');

    console.log(\`✅ Lance de R$ \${valorFormatado} enviado no Licitações-e\`);
    return true;
  }

  // ─── VERIFICAR RESULTADO ───────────────────────────────────
  async verificarResultado() {
    const S = this.salaS;
    return await this.page.evaluate((seletores) => {
      const texto = document.body.innerText.toLowerCase();
      if (texto.includes('lance aceito') || texto.includes('lance registrado')) return 'aceito';
      if (texto.includes('lance recusado') || texto.includes('valor inválido')) return 'recusado';
      if (texto.includes('disputa encerrada') || texto.includes('sessão encerrada')) return 'encerrado';
      // Verificar via seletores
      const encerrado = document.querySelector(seletores.mensagemEncerramento);
      if (encerrado) return 'encerrado';
      return 'indefinido';
    }, S);
  }

  // ─── DETECÇÃO DE FASE ──────────────────────────────────────
  async lerFaseAtual() {
    const S = this.salaS;
    return await this.page.evaluate((seletores) => {
      const faseEl = document.querySelector(seletores.faseAtual || seletores.situacao);
      const fase = (faseEl?.textContent || '').toLowerCase();
      if (fase.includes('aleat') || fase.includes('random')) return 'aleatorio';
      if (fase.includes('fechad')) return 'fechado';
      if (fase.includes('encerrad')) return 'encerrado';
      return 'aberto';
    }, S);
  }

  // ─── CLASSIFICAÇÃO ─────────────────────────────────────────
  async lerClassificacao() {
    const S = this.salaS;
    return await this.page.evaluate((seletores) => {
      const rows = document.querySelectorAll(\`\${seletores.tabelaLances} tr:not(:first-child)\`);
      return Array.from(rows).slice(0, 15).map((tr, i) => {
        const tds = tr.querySelectorAll('td');
        return {
          posicao: i + 1,
          fornecedor: (tds[0]?.textContent || '').trim(),
          valor: (tds[1]?.textContent || '').trim(),
        };
      });
    }, S);
  }

  // ─── FASE ABERTA ───────────────────────────────────────────
  async faseAberta() {
    const fase = await this.lerFaseAtual();
    return fase !== 'encerrado';
  }

  /**
   * ⚡ Intervalo de verificação específico do Licitações-e:
   * - Fase randômica: 1.5s (pode encerrar em 1 SEGUNDO!)
   * - Outras fases: 3s
   */
  async getIntervaloVerificacao() {
    const fase = await this.lerFaseAtual();
    return fase === 'aleatorio' ? 1500 : 3000;
  }

  // ─── MONITORAMENTO DO CHAT DO PREGOEIRO ────────────────────
  async lerMensagensChat() {
    const S = this.salaS;
    try {
      return await this.page.evaluate((seletores) => {
        const container = document.querySelector(seletores.listaMensagens || seletores.chatMensagens);
        if (!container) return [];
        const items = container.querySelectorAll(seletores.itemMensagem || '.mensagem-chat, .msg-item');
        return Array.from(items).slice(-5).map(el => ({
          autor: (el.querySelector(seletores.autorMensagem || '.autor')?.textContent || '').trim(),
          texto: (el.querySelector(seletores.textoMensagem || '.texto')?.textContent || '').trim(),
          id: el.getAttribute('id') || el.getAttribute('data-id') || '',
        }));
      }, S);
    } catch {
      return [];
    }
  }
}

module.exports = { LicitacoesEPortal };
`,

  'src/portals/pncp.js': `const { BasePortal } = require('./base-portal');

/**
 * Módulo para PNCP (Portal Nacional de Contratações Públicas)
 *
 * URL: https://www.pncp.gov.br
 * Autenticação: gov.br com certificado digital
 */
class PNCPPortal extends BasePortal {
  constructor(page, credenciais) {
    super(page, credenciais);
    this.nome = 'pncp';
    this.baseUrl = 'https://www.pncp.gov.br';
  }

  async login() {
    console.log('🔐 Iniciando login no PNCP via gov.br...');
    await this.page.goto(\`\${this.baseUrl}/app/fornecedor\`, { waitUntil: 'networkidle2' });

    // PNCP usa autenticação gov.br — mesmo fluxo do ComprasGov
    await this.page.evaluate(() => {
      const btn = [...document.querySelectorAll('a, button')]
        .find(b => b.textContent.toLowerCase().includes('gov.br') || b.textContent.toLowerCase().includes('entrar'));
      if (btn) btn.click();
    });

    await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });

    // Selecionar certificado digital
    await this.page.evaluate(() => {
      const link = [...document.querySelectorAll('a, button')]
        .find(el => el.textContent.toLowerCase().includes('certificado'));
      if (link) link.click();
    });

    await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
    this.loggedIn = true;
    console.log('✅ Login no PNCP realizado');
  }

  async navegarParaDisputa(edital) {
    console.log(\`📋 Buscando edital \${edital} no PNCP\`);
    await this.page.goto(\`\${this.baseUrl}/app/editais?q=\${encodeURIComponent(edital)}\`, { waitUntil: 'networkidle2' });
    await this.page.waitForTimeout(3000);
    await this.screenshot('pncp-busca');
  }

  async lerMelhorLance() {
    return await this.page.evaluate(() => {
      const el = document.querySelector('[data-lance], .valor-proposta, .melhor-lance');
      if (!el) return null;
      return parseFloat(el.textContent.replace(/[^\\d.,]/g, '').replace('.', '').replace(',', '.'));
    });
  }

  async enviarLance(valor) {
    console.log(\`📤 Enviando lance PNCP: R$ \${this.formatarMoeda(valor)}\`);
    await this.preencherCampo('input[name="valor"], input[name="lance"]', this.formatarMoeda(valor));
    await this.page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')]
        .find(b => b.textContent.toLowerCase().includes('enviar') || b.textContent.toLowerCase().includes('confirmar'));
      if (btn) btn.click();
    });
    this.page.on('dialog', async d => await d.accept());
    await this.page.waitForTimeout(3000);
    return true;
  }
}

module.exports = { PNCPPortal };
`,

  'src/portals/bec-sp.js': `const { BasePortal } = require('./base-portal');

/**
 * Módulo para BEC-SP (Bolsa Eletrônica de Compras de São Paulo)
 *
 * URL: https://www.bec.sp.gov.br
 * Autenticação: Login + senha + certificado digital
 */
class BECSPPortal extends BasePortal {
  constructor(page, credenciais) {
    super(page, credenciais);
    this.nome = 'bec-sp';
    this.baseUrl = 'https://www.bec.sp.gov.br';
  }

  async login() {
    console.log('🔐 Iniciando login no BEC-SP...');
    await this.page.goto(\`\${this.baseUrl}/BECSP/Login\`, { waitUntil: 'networkidle2' });

    await this.preencherCampo('#usuario, input[name="usuario"]', this.credenciais.login);
    await this.preencherCampo('#senha, input[name="senha"]', this.credenciais.senha);

    await this.page.evaluate(() => {
      const btn = [...document.querySelectorAll('input[type="submit"], button')]
        .find(b => (b.value || b.textContent).toLowerCase().includes('entrar'));
      if (btn) btn.click();
    });

    await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    this.loggedIn = true;
    console.log('✅ Login no BEC-SP realizado');
  }

  async navegarParaDisputa(edital) {
    console.log(\`📋 Buscando oferta \${edital} no BEC-SP\`);
    await this.page.goto(\`\${this.baseUrl}/BECSP/OfertaEletronicaFornecedor\`, { waitUntil: 'networkidle2' });
    await this.preencherCampo('input[name="numOC"], #numOC', edital);
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(5000);
  }

  async lerMelhorLance() {
    return await this.page.evaluate(() => {
      const el = document.querySelector('.valorMenor, td.lance, .melhorOferta');
      if (!el) return null;
      return parseFloat(el.textContent.replace(/[^\\d.,]/g, '').replace('.', '').replace(',', '.'));
    });
  }

  async enviarLance(valor) {
    console.log(\`📤 Enviando lance BEC-SP: R$ \${this.formatarMoeda(valor)}\`);
    await this.preencherCampo('input[name="valorOferta"], #valorOferta', this.formatarMoeda(valor));
    await this.page.evaluate(() => {
      const btn = [...document.querySelectorAll('input[type="submit"], button')]
        .find(b => (b.value || b.textContent).toLowerCase().includes('enviar'));
      if (btn) btn.click();
    });
    this.page.on('dialog', async d => await d.accept());
    await this.page.waitForTimeout(3000);
    return true;
  }
}

module.exports = { BECSPPortal };
`,

  'src/portals/licitanet.js': `const { BasePortal } = require('./base-portal');

/**
 * Módulo para Licitanet
 *
 * URL: https://www.licitanet.com.br
 * Autenticação: Login + senha
 */
class LicitanetPortal extends BasePortal {
  constructor(page, credenciais) {
    super(page, credenciais);
    this.nome = 'licitanet';
    this.baseUrl = 'https://www.licitanet.com.br';
  }

  async login() {
    console.log('🔐 Iniciando login no Licitanet...');
    // Licitanet é um SPA (Inertia.js/Laravel) — VERIFICADO em 2026-03-31
    // A rota /login retorna 404, o login real é via /sessao-publica ou modal
    // URL base verificada: https://licitanet.com.br
    // Abordagem: navegar para a home e clicar no link de login
    await this.page.goto(this.baseUrl, { waitUntil: 'networkidle2' });
    
    // Procurar link/botão de login na navbar
    const loginClicked = await this.page.evaluate(() => {
      const links = [...document.querySelectorAll('a, button')];
      const loginLink = links.find(el => {
        const text = (el.textContent || '').toLowerCase().trim();
        return text === 'entrar' || text === 'login' || text === 'acessar' || 
               text.includes('área do fornecedor');
      });
      if (loginLink) { loginLink.click(); return true; }
      return false;
    });
    
    if (!loginClicked) {
      // Fallback: tentar navegação direta para rotas comuns
      await this.page.goto(\`\${this.baseUrl}/auth/login\`, { waitUntil: 'networkidle2' });
    }
    
    await this.page.waitForTimeout(3000);
    
    // Preencher formulário de login (SPA renderiza campos dinamicamente)
    await this.preencherCampo('input[name="email"], input[name="login"], input[type="email"], #email', this.credenciais.login);
    await this.preencherCampo('input[name="password"], input[name="senha"], input[type="password"], #password', this.credenciais.senha);
    await this.page.evaluate(() => {
      const btn = [...document.querySelectorAll('button[type="submit"], button')]
        .find(b => (b.textContent || '').toLowerCase().includes('entrar') || 
                    (b.textContent || '').toLowerCase().includes('login'));
      if (btn) btn.click();
    });
    await this.page.waitForTimeout(5000);
    this.loggedIn = true;
    console.log('✅ Login no Licitanet realizado');
  }

  async navegarParaDisputa(edital) {
    await this.page.goto(\`\${this.baseUrl}/pregao/busca?q=\${encodeURIComponent(edital)}\`, { waitUntil: 'networkidle2' });
    await this.page.waitForTimeout(3000);
  }

  async lerMelhorLance() {
    return await this.page.evaluate(() => {
      const el = document.querySelector('.valor-lance, .melhor-lance, td.lance');
      if (!el) return null;
      return parseFloat(el.textContent.replace(/[^\\d.,]/g, '').replace('.', '').replace(',', '.'));
    });
  }

  async enviarLance(valor) {
    await this.preencherCampo('input[name="lance"]', this.formatarMoeda(valor));
    await this.page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')]
        .find(b => b.textContent.toLowerCase().includes('enviar'));
      if (btn) btn.click();
    });
    this.page.on('dialog', async d => await d.accept());
    await this.page.waitForTimeout(3000);
    return true;
  }
}

module.exports = { LicitanetPortal };
`,

  'src/portals/portal-compras.js': `const { BasePortal } = require('./base-portal');

/**
 * Módulo para Portal de Compras Públicas
 *
 * URL: https://www.portaldecompraspublicas.com.br
 * Autenticação: Login + senha
 */
class PortalComprasPortal extends BasePortal {
  constructor(page, credenciais) {
    super(page, credenciais);
    this.nome = 'portal-compras';
    this.baseUrl = 'https://www.portaldecompraspublicas.com.br';
  }

  async login() {
    console.log('🔐 Iniciando login no Portal de Compras Públicas...');
    // Portal de Compras Públicas é um SPA Angular — VERIFICADO em 2026-03-31
    // A rota /18/Login retorna 404 (SPA route), precisa navegar via JS
    // URL: https://www.portaldecompraspublicas.com.br
    await this.page.goto(this.baseUrl, { waitUntil: 'networkidle2' });
    
    // Clicar no botão de login (Angular renderiza dinamicamente)
    const loginClicked = await this.page.evaluate(() => {
      const links = [...document.querySelectorAll('a, button, span[role="button"]')];
      const loginLink = links.find(el => {
        const text = (el.textContent || '').toLowerCase().trim();
        return text === 'entrar' || text === 'login' || text.includes('acessar') ||
               text.includes('fornecedor');
      });
      if (loginLink) { loginLink.click(); return true; }
      return false;
    });
    
    await this.page.waitForTimeout(3000);
    
    // Preencher formulário Angular
    await this.preencherCampo('input[name="login"], input[formcontrolname="login"], input[type="text"]:not([readonly]), #login', this.credenciais.login);
    await this.preencherCampo('input[name="senha"], input[formcontrolname="senha"], input[type="password"], #senha', this.credenciais.senha);
    await this.page.evaluate(() => {
      const btn = [...document.querySelectorAll('button[type="submit"], button')]
        .find(b => (b.textContent || '').toLowerCase().includes('entrar') ||
                    (b.textContent || '').toLowerCase().includes('login'));
      if (btn) btn.click();
    });
    await this.page.waitForTimeout(5000);
    this.loggedIn = true;
    console.log('✅ Login no Portal de Compras Públicas realizado');
  }

  async navegarParaDisputa(edital) {
    await this.page.goto(\`\${this.baseUrl}/disputa?edital=\${encodeURIComponent(edital)}\`, { waitUntil: 'networkidle2' });
    await this.page.waitForTimeout(3000);
  }

  async lerMelhorLance() {
    return await this.page.evaluate(() => {
      const el = document.querySelector('.valor-lance, .melhor, td.valor');
      if (!el) return null;
      return parseFloat(el.textContent.replace(/[^\\d.,]/g, '').replace('.', '').replace(',', '.'));
    });
  }

  async enviarLance(valor) {
    await this.preencherCampo('input[name="lance"]', this.formatarMoeda(valor));
    await this.page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')]
        .find(b => b.textContent.toLowerCase().includes('enviar'));
      if (btn) btn.click();
    });
    this.page.on('dialog', async d => await d.accept());
    await this.page.waitForTimeout(3000);
    return true;
  }
}

module.exports = { PortalComprasPortal };
`,

  'src/portals/bnc.js': `const { BasePortal } = require('./base-portal');

/**
 * Módulo para BNC (Brasil Negócios Compras)
 *
 * URL: https://bnc.org.br
 * Autenticação: Login + senha
 */
class BNCPortal extends BasePortal {
  constructor(page, credenciais) {
    super(page, credenciais);
    this.nome = 'bnc';
    this.baseUrl = 'https://bnc.org.br';
  }

  async login() {
    console.log('🔐 Iniciando login no BNC...');
    // BNC usa WordPress wp-login.php (idêntico ao BLL)
    // Seletores VERIFICADOS em 2026-03-31:
    //   - Login: #user_login (input[name="log"])
    //   - Senha: #user_pass (input[name="pwd"])
    //   - Submit: #wp-submit (input[type="submit"][value="Acessar"])
    await this.page.goto(\`\${this.baseUrl}/wp-login.php\`, { waitUntil: 'networkidle2' });
    await this.preencherCampo('#user_login', this.credenciais.login);
    await this.preencherCampo('#user_pass', this.credenciais.senha);
    await this.page.click('#wp-submit');
    await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    this.loggedIn = true;
    console.log('✅ Login no BNC realizado');
  }

  async navegarParaDisputa(edital) {
    await this.page.goto(\`\${this.baseUrl}/pregao/busca?q=\${encodeURIComponent(edital)}\`, { waitUntil: 'networkidle2' });
    await this.page.waitForTimeout(3000);
  }

  async lerMelhorLance() {
    return await this.page.evaluate(() => {
      const el = document.querySelector('.valor-lance, .melhor-lance');
      if (!el) return null;
      return parseFloat(el.textContent.replace(/[^\\d.,]/g, '').replace('.', '').replace(',', '.'));
    });
  }

  async enviarLance(valor) {
    await this.preencherCampo('input[name="lance"]', this.formatarMoeda(valor));
    await this.page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')]
        .find(b => b.textContent.toLowerCase().includes('enviar'));
      if (btn) btn.click();
    });
    this.page.on('dialog', async d => await d.accept());
    await this.page.waitForTimeout(3000);
    return true;
  }
}

module.exports = { BNCPortal };
`,

  'src/portals/index.js': `/**
 * Registry de portais suportados.
 * O session-manager usa este mapa para instanciar o portal correto.
 * Cada portal tem seu módulo dedicado com seletores e fluxos específicos.
 */
const { ComprasGovPortal } = require('./comprasgov');
const { BLLPortal } = require('./bll');
const { LicitacoesEPortal } = require('./licitacoes-e');
const { PNCPPortal } = require('./pncp');
const { BECSPPortal } = require('./bec-sp');
const { LicitanetPortal } = require('./licitanet');
const { PortalComprasPortal } = require('./portal-compras');
const { BNCPortal } = require('./bnc');
// Portais individuais dedicados (sem módulo genérico)
const { BanparanetPortal } = require('./banparanet');
const { ComprasBRPortal } = require('./comprasbr');
const { BBMNetPortal } = require('./bbmnet');
const { LicitarDigitalPortal } = require('./licitar-digital');
const { ComprasNetBAPortal } = require('./comprasnet-ba');
const { ComprasNetGOPortal } = require('./comprasnet-go');
const { ComprasMGPortal } = require('./compras-mg');
const { PEIntegradoPortal } = require('./pe-integrado');
const { ComprasRJPortal } = require('./compras-rj');
const { ComprasPRPortal } = require('./compras-pr');
const { ComprasRSPortal } = require('./compras-rs');
const { ComprasSCPortal } = require('./compras-sc');
const { EComprasDFPortal } = require('./ecompras-df');
const { EComprasAMPortal } = require('./ecompras-am');
const { ComprasCEPortal } = require('./compras-ce');

const PORTALS = {
  // Federais
  'comprasgov': ComprasGovPortal,
  'pncp': PNCPPortal,

  // Bolsas Eletrônicas
  'bll': BLLPortal,
  'licitacoes-e': LicitacoesEPortal,
  'bec-sp': BECSPPortal,
  'licitanet': LicitanetPortal,
  'portal-compras': PortalComprasPortal,
  'bnc': BNCPortal,
  'comprasbr': ComprasBRPortal,
  'bbmnet': BBMNetPortal,
  'licitar-digital': LicitarDigitalPortal,

  // Portais estaduais dedicados
  'banparanet': BanparanetPortal,
  'comprasnet-ba': ComprasNetBAPortal,
  'comprasnet-go': ComprasNetGOPortal,
  'compras-mg': ComprasMGPortal,
  'compras-pe': PEIntegradoPortal,
  'compras-rj': ComprasRJPortal,
  'compras-pr': ComprasPRPortal,
  'compras-rs': ComprasRSPortal,
  'compras-sc': ComprasSCPortal,
  'compras-df': EComprasDFPortal,
  'e-compras-am': EComprasAMPortal,
  'portal-compras-ce': ComprasCEPortal,
};

function getPortal(portalId, page, credenciais) {
  const PortalClass = PORTALS[portalId];
  if (!PortalClass) {
    throw new Error(\\\`Portal "\\\${portalId}" não suportado. Disponíveis: \\\${Object.keys(PORTALS).join(', ')}\\\`);
  }
  return new PortalClass(page, credenciais);
}

module.exports = { PORTALS, getPortal };
`,
};
