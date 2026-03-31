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
 * Módulo de automação para o portal Compras.gov.br (CNET Mobile)
 *
 * URL base: https://cnetmobile.estaleiro.serpro.gov.br
 * Autenticação: SSO gov.br com certificado digital A1/A3
 *
 * Fluxo completo de disputa:
 * 1. Acessar SSO gov.br e autenticar com certificado digital
 * 2. Navegar para CNET Mobile > Área do Fornecedor
 * 3. Localizar a sessão de disputa pelo número UASG/Pregão
 * 4. Monitorar sala de disputa em tempo real
 * 5. Ler melhor lance e classificação
 * 6. Enviar lance com confirmação em 2 etapas
 *
 * IMPORTANTE: Os seletores CSS são baseados no portal Angular e mudam
 * periodicamente. Use o roteiro em docs/roteiro-testes-vps-comprasgov.md
 * para re-mapear seletores via VNC quando necessário.
 */
class ComprasGovPortal extends BasePortal {
  constructor(page, credenciais) {
    super(page, credenciais);
    this.nome = 'comprasgov';
    this.baseUrl = 'https://cnetmobile.estaleiro.serpro.gov.br';
    this.loginUrl = 'https://sso.acesso.gov.br';
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

  async login() {
    console.log('🔐 Iniciando login no Compras.gov via SSO gov.br...');
    await this.aplicarAntiDeteccao();

    await this.comRetry(async () => {
      // 1. Acessar SSO gov.br
      await this.page.goto(this.loginUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await this.delayHumano(500, 1200);
      await this.screenshot('sso-gov-br');

      // 2. Preencher CPF na tela inicial do gov.br
      // Seletores VERIFICADOS em 2026-03-31:
      //   - Campo CPF: #accountId (input[name="accountId"])
      //   - Botão Continuar: #enter-account-id (button[value="enter-account-id"])
      const cpfField = await this.aguardarElemento('#accountId', 5000);
      if (cpfField && this.credenciais.cpf) {
        await this.preencherCampo('#accountId', this.credenciais.cpf);
        await this.delayHumano(300, 600);
        await this.page.click('#enter-account-id');
        await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
        await this.delayHumano(500, 1000);
      }

      // 3. Na tela de senha, selecionar certificado digital
      // Seletores VERIFICADOS: botões com classe .button-href-mimic2 e img com texto "Certificado"
      // Ou item-login-signup-ways contendo texto "certificado"
      const certSelectors = [
        '#login-certificate-digital',
        'button[value="login-certificate"]',
        '.item-login-signup-ways button[class*="button-href"]',
      ];

      let certFound = false;
      for (const sel of certSelectors) {
        const found = await this.aguardarElemento(sel, 3000);
        if (found) {
          await this.page.click(sel);
          certFound = true;
          break;
        }
      }

      if (!certFound) {
        // Fallback VERIFICADO: buscar por texto nos botões/links da página gov.br
        const clicked = await this.page.evaluate(() => {
          const items = [...document.querySelectorAll('.item-login-signup-ways a, .item-login-signup-ways button, a, button, span[role="button"]')];
          const certLink = items.find(el => {
            const text = (el.textContent || '').toLowerCase();
            return text.includes('certificado digital') || text.includes('certificado') ||
                   text.includes('cert digital') || text.includes('e-cpf') || text.includes('e-cnpj');
          });
          if (certLink) { certLink.click(); return true; }
          return false;
        });
        if (!clicked) throw new Error('Botão de certificado digital não encontrado no SSO gov.br');
      }

      console.log('📜 Aguardando autenticação mTLS com certificado...');
      await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 45000 });
      await this.delayHumano(1000, 2000);
      await this.screenshot('pos-login-sso');
    }, 'login-sso');

    // 3. Verificar se precisa autorizar acesso ao Compras.gov
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

    // 4. Navegar para CNET Mobile (área do fornecedor)
    await this.comRetry(async () => {
      await this.page.goto(\`\${this.baseUrl}/pregao/fornecedor\`, {
        waitUntil: 'networkidle2', timeout: 30000,
      });
      await this.delayHumano();
    }, 'navegar-cnet');

    // 5. Verificar login bem-sucedido
    const loggedIn = await this.page.evaluate(() => {
      const body = document.body.innerText;
      return body.includes('Fornecedor') || body.includes('Bem-vindo') ||
             body.includes('Painel') || body.includes('UASG') ||
             body.includes('Pregão') || body.includes('Meus Pregões');
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
      // CNET Mobile usa Angular — aguardar carregamento do framework
      await this.page.goto(\`\${this.baseUrl}/pregao/fornecedor\`, {
        waitUntil: 'networkidle2', timeout: 25000,
      });
      await this.delayHumano(1000, 2000);

      // Tentar buscar pelo número do pregão/UASG
      const buscaSelectors = [
        'input[name="uasg"]', 'input[name="numPregao"]',
        'input[placeholder*="UASG"]', 'input[placeholder*="pregão"]',
        'input[placeholder*="Pregão"]', '#busca-pregao',
        'input[type="search"]', 'input[formcontrolname="busca"]',
        'input[formcontrolname="numPregao"]',
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
        // Fallback: procurar qualquer input de texto visível
        await this.page.evaluate((editalNum) => {
          const inputs = [...document.querySelectorAll('input[type="text"], input:not([type])')];
          const input = inputs.find(i => i.offsetParent !== null);
          if (input) {
            input.value = editalNum;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }, edital);
      }

      await this.delayHumano(500, 1000);
      await this.page.keyboard.press('Enter');
      await this.page.waitForTimeout(5000);
      await this.screenshot('busca-resultado');

      // Clicar na sala de disputa
      const disputaClicked = await this.page.evaluate(() => {
        const links = [...document.querySelectorAll('a, button, tr, td')];
        const disputaLink = links.find(el => {
          const text = (el.textContent || '').toLowerCase();
          return text.includes('sala') || text.includes('disputa') ||
                 text.includes('participar') || text.includes('acessar');
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
      // Seletores ampliados para CNET Mobile Angular
      const seletores = [
        '.melhor-lance', '.menor-lance', '.valor-lance',
        '#melhorLance', '#menorLance', '#valorAtual',
        'td.valor', '.lance-atual', '.proposta-valor',
        '[data-field="melhorLance"]', '[data-field="valor"]',
        'span.ng-star-inserted', // Angular dynamic elements
        '.mat-cell', // Angular Material
        // Tabela de classificação — primeira linha, coluna de valor
        'table tbody tr:first-child td:nth-child(3)',
        'table tbody tr:first-child td:nth-child(4)',
        '.classificacao-item:first-child .valor',
      ];
      for (const sel of seletores) {
        const el = document.querySelector(sel);
        if (el) {
          const texto = el.textContent.replace(/[^\\d.,]/g, '');
          if (!texto) continue;
          // Formato brasileiro: 1.234,56
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
      // Preencher campo de lance
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
        // Fallback: buscar campo numérico visível
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

      // Clicar no botão de enviar
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

      // Confirmação em 2 etapas (modal do CNET)
      const modalConfirm = await this.page.evaluate(() => {
        // Modal de confirmação do Angular Material ou custom
        const modals = document.querySelectorAll('.modal, .mat-dialog-container, .cdk-overlay-pane, [role="dialog"]');
        for (const modal of modals) {
          const confirmBtn = modal.querySelector('button');
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
   * Retorna dados da classificação atual.
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
    await this.page.goto(\`\${this.baseUrl}/login\`, { waitUntil: 'networkidle2' });

    await this.preencherCampo('#login, input[name="login"], input[name="email"]', this.credenciais.login);
    await this.preencherCampo('#senha, input[name="senha"], input[name="password"]', this.credenciais.senha);

    await this.page.evaluate(() => {
      const btn = [...document.querySelectorAll('button, input[type="submit"]')]
        .find(b => b.textContent?.toLowerCase().includes('entrar') || b.value?.toLowerCase().includes('entrar'));
      if (btn) btn.click();
    });

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
 * Módulo para Licitações-e (Banco do Brasil)
 *
 * URL: https://www.licitacoes-e.com.br
 * Autenticação: Login + senha ou certificado digital
 */
class LicitacoesEPortal extends BasePortal {
  constructor(page, credenciais) {
    super(page, credenciais);
    this.nome = 'licitacoes-e';
    this.baseUrl = 'https://www.licitacoes-e.com.br';
  }

  async login() {
    console.log('🔐 Iniciando login no Licitações-e...');
    await this.page.goto(\`\${this.baseUrl}/aop/lct/licitacaoConsultaPublica.faces\`, { waitUntil: 'networkidle2' });

    // Clicar em "Área do Fornecedor"
    await this.page.evaluate(() => {
      const link = [...document.querySelectorAll('a')].find(a =>
        a.textContent.includes('Fornecedor') || a.textContent.includes('Login')
      );
      if (link) link.click();
    });

    await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    await this.preencherCampo('#login, input[name="login"]', this.credenciais.login);
    await this.preencherCampo('#senha, input[name="senha"]', this.credenciais.senha);

    await this.page.evaluate(() => {
      const btn = [...document.querySelectorAll('input[type="submit"], button')]
        .find(b => (b.value || b.textContent).toLowerCase().includes('ok') || (b.value || b.textContent).toLowerCase().includes('entrar'));
      if (btn) btn.click();
    });

    await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    this.loggedIn = true;
    console.log('✅ Login no Licitações-e realizado');
  }

  async navegarParaDisputa(edital) {
    console.log(\`📋 Buscando edital \${edital} no Licitações-e\`);
    await this.preencherCampo('input[name="numLicitacao"], #numLicitacao', edital);
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(5000);
    await this.screenshot('disputa-licitacoes-e');
  }

  async lerMelhorLance() {
    return await this.page.evaluate(() => {
      const el = document.querySelector('.valorLance, td.lance, .melhorLance');
      if (!el) return null;
      return parseFloat(el.textContent.replace(/[^\\d.,]/g, '').replace('.', '').replace(',', '.'));
    });
  }

  async enviarLance(valor) {
    console.log(\`📤 Enviando lance Licitações-e: R$ \${this.formatarMoeda(valor)}\`);
    await this.preencherCampo('input[name="valorLance"]', this.formatarMoeda(valor));
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
    await this.page.goto(\`\${this.baseUrl}/login\`, { waitUntil: 'networkidle2' });
    await this.preencherCampo('input[name="email"], #email', this.credenciais.login);
    await this.preencherCampo('input[name="senha"], #senha', this.credenciais.senha);
    await this.page.evaluate(() => {
      const btn = [...document.querySelectorAll('button, input[type="submit"]')]
        .find(b => (b.textContent || b.value).toLowerCase().includes('entrar'));
      if (btn) btn.click();
    });
    await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
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
    await this.page.goto(\`\${this.baseUrl}/login\`, { waitUntil: 'networkidle2' });
    await this.preencherCampo('input[name="login"], #login', this.credenciais.login);
    await this.preencherCampo('input[name="senha"], #senha', this.credenciais.senha);
    await this.page.evaluate(() => {
      const btn = [...document.querySelectorAll('button, input[type="submit"]')]
        .find(b => (b.textContent || b.value).toLowerCase().includes('entrar'));
      if (btn) btn.click();
    });
    await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
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
    await this.page.goto(\`\${this.baseUrl}/login\`, { waitUntil: 'networkidle2' });
    await this.preencherCampo('input[name="email"], #email', this.credenciais.login);
    await this.preencherCampo('input[name="senha"], #senha', this.credenciais.senha);
    await this.page.evaluate(() => {
      const btn = [...document.querySelectorAll('button, input[type="submit"]')]
        .find(b => (b.textContent || b.value).toLowerCase().includes('entrar'));
      if (btn) btn.click();
    });
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
