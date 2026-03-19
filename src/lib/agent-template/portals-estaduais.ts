// Individual dedicated automation modules for each state/regional portal
// Each portal has specific URLs, selectors, and authentication flows

export const PORTAL_ESTADUAIS_FILES: Record<string, string> = {
  'src/portals/banparanet.js': `const { BasePortal } = require('./base-portal');

/**
 * Módulo dedicado para Banparanet (PA)
 *
 * URL: https://www.banparanet.com.br
 * Autenticação: Login + senha + certificado digital A1
 * Estado: Pará
 * Tecnologia: Java/JSF
 * Particularidades:
 *   - Portal usa Java Server Faces (JSF) com IDs dinâmicos
 *   - Formulários usam postback, não navegação convencional
 *   - Sessão expira após 15 minutos de inatividade
 *   - Certificado digital pode ser solicitado em operações críticas
 */
class BanparanetPortal extends BasePortal {
  constructor(page, credenciais) {
    super(page, credenciais);
    this.nome = 'banparanet';
    this.baseUrl = 'https://www.banparanet.com.br';
  }

  async login() {
    console.log('🔐 Iniciando login no Banparanet...');
    await this.page.goto(\`\${this.baseUrl}/licitacao/login\`, { waitUntil: 'networkidle2' });

    // Banparanet usa formulário JSF com IDs dinâmicos
    const loginSelectors = [
      'input[name="usuario"]', 'input[id$="usuario"]', 'input[id$="login"]',
      'input[name="j_username"]', '#loginForm\\\\:usuario',
    ];
    const senhaSelectors = [
      'input[name="senha"]', 'input[id$="senha"]', 'input[id$="password"]',
      'input[name="j_password"]', '#loginForm\\\\:senha',
    ];

    for (const sel of loginSelectors) {
      const found = await this.aguardarElemento(sel, 3000);
      if (found) { await this.preencherCampo(sel, this.credenciais.login); break; }
    }
    for (const sel of senhaSelectors) {
      const found = await this.aguardarElemento(sel, 3000);
      if (found) { await this.preencherCampo(sel, this.credenciais.senha); break; }
    }

    // JSF submit button
    await this.page.evaluate(() => {
      const btn = document.querySelector('input[type="submit"][value*="Entrar"], button[id$="btnLogin"], input[id$="btnEntrar"]')
        || [...document.querySelectorAll('button, input[type="submit"]')]
          .find(b => (b.textContent || b.value || '').toLowerCase().includes('entrar'));
      if (btn) btn.click();
    });

    await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 });
    this.loggedIn = true;
    console.log('✅ Login no Banparanet realizado');
  }

  async navegarParaDisputa(edital) {
    console.log(\`📋 Buscando edital \${edital} no Banparanet\`);
    // Banparanet: área de pregões eletrônicos
    const pregaoUrls = [
      \`\${this.baseUrl}/licitacao/pregao/eletronico\`,
      \`\${this.baseUrl}/licitacao/pregao\`,
      \`\${this.baseUrl}/pregaoeletronico\`,
    ];
    for (const url of pregaoUrls) {
      try {
        await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 10000 });
        break;
      } catch { continue; }
    }

    // Campo de busca específico do Banparanet
    const buscaSelectors = [
      'input[id$="numPregao"]', 'input[name="numPregao"]',
      'input[id$="busca"]', 'input[name="busca"]',
      'input[type="search"]', '#formBusca\\\\:numPregao',
    ];
    for (const sel of buscaSelectors) {
      const found = await this.aguardarElemento(sel, 3000);
      if (found) {
        await this.preencherCampo(sel, edital);
        break;
      }
    }

    // JSF command button para buscar
    await this.page.evaluate(() => {
      const btn = document.querySelector('input[id$="btnBuscar"], button[id$="btnBuscar"]')
        || [...document.querySelectorAll('button, input[type="submit"]')]
          .find(b => (b.textContent || b.value || '').toLowerCase().includes('buscar') ||
                     (b.textContent || b.value || '').toLowerCase().includes('pesquisar'));
      if (btn) btn.click();
    });

    await this.page.waitForTimeout(5000);
    await this.screenshot('banparanet-disputa');

    // Clicar no link da disputa encontrada
    await this.page.evaluate(() => {
      const link = document.querySelector('a[id$="lnkDisputa"], a[href*="disputa"], a[href*="sala"]')
        || [...document.querySelectorAll('a')]
          .find(a => a.textContent.toLowerCase().includes('sala') || a.textContent.toLowerCase().includes('disputa'));
      if (link) link.click();
    });
    await this.page.waitForTimeout(5000);
  }

  async lerMelhorLance() {
    return await this.page.evaluate(() => {
      // Seletores específicos do Banparanet
      const seletores = [
        'span[id$="melhorLance"]', 'span[id$="valorMenorLance"]',
        'td[id$="melhorLance"]', '.menor-lance', '.melhor-lance',
        'span.valor-lance', '#formDisputa\\\\:melhorLance',
      ];
      for (const sel of seletores) {
        const el = document.querySelector(sel);
        if (el) {
          const texto = el.textContent.replace(/[^\\d.,]/g, '');
          // Formato brasileiro: 1.234,56
          const parts = texto.split(',');
          if (parts.length === 2) {
            const inteiro = parts[0].replace(/\\./g, '');
            const num = parseFloat(inteiro + '.' + parts[1]);
            if (!isNaN(num)) return num;
          }
          const num = parseFloat(texto.replace('.', '').replace(',', '.'));
          if (!isNaN(num)) return num;
        }
      }
      return null;
    });
  }

  async enviarLance(valor) {
    console.log(\`📤 Enviando lance Banparanet: R$ \${this.formatarMoeda(valor)}\`);

    const lanceSelectors = [
      'input[id$="valorLance"]', 'input[name="valorLance"]',
      'input[id$="lance"]', '#formDisputa\\\\:valorLance',
    ];
    for (const sel of lanceSelectors) {
      const found = await this.aguardarElemento(sel, 3000);
      if (found) {
        await this.preencherCampo(sel, this.formatarMoeda(valor));
        break;
      }
    }

    // Botão de enviar lance (JSF)
    await this.page.evaluate(() => {
      const btn = document.querySelector('input[id$="btnEnviarLance"], button[id$="btnEnviar"]')
        || [...document.querySelectorAll('button, input[type="submit"]')]
          .find(b => (b.textContent || b.value || '').toLowerCase().includes('enviar lance'));
      if (btn) btn.click();
    });

    // Banparanet usa confirmação em 2 etapas
    this.page.on('dialog', async d => {
      console.log(\`📌 Confirmação Banparanet: \${d.message()}\`);
      await d.accept();
    });
    await this.page.waitForTimeout(3000);

    // Verificar se há botão de confirmação secundária
    await this.page.evaluate(() => {
      const confirmBtn = document.querySelector('input[id$="btnConfirmar"], button[id$="btnConfirmar"]')
        || [...document.querySelectorAll('button')]
          .find(b => b.textContent.toLowerCase().includes('confirmar'));
      if (confirmBtn) confirmBtn.click();
    });

    await this.page.waitForTimeout(2000);
    await this.screenshot('lance-banparanet');
    return true;
  }

  async verificarResultado() {
    return await this.page.evaluate(() => {
      const texto = document.body.innerText.toLowerCase();
      if (texto.includes('lance aceito') || texto.includes('lance registrado') || texto.includes('lance enviado')) return 'aceito';
      if (texto.includes('recusado') || texto.includes('erro') || texto.includes('inválido') || texto.includes('não aceito')) return 'recusado';
      return 'indefinido';
    });
  }
}

module.exports = { BanparanetPortal };
`,

  'src/portals/comprasbr.js': `const { BasePortal } = require('./base-portal');

/**
 * Módulo dedicado para ComprasBR
 *
 * URL: https://www.comprasbr.com.br
 * Autenticação: Login + senha
 * Tecnologia: React/SPA
 * Particularidades:
 *   - SPA com React, navegação interna via router
 *   - API REST para lances (pode interceptar XHR)
 *   - Sessão mantida via JWT no localStorage
 */
class ComprasBRPortal extends BasePortal {
  constructor(page, credenciais) {
    super(page, credenciais);
    this.nome = 'comprasbr';
    this.baseUrl = 'https://www.comprasbr.com.br';
  }

  async login() {
    console.log('🔐 Iniciando login no ComprasBR...');
    await this.page.goto(\`\${this.baseUrl}/login\`, { waitUntil: 'networkidle2' });

    // ComprasBR usa formulário React
    await this.preencherCampo('input[name="email"], input[name="login"], input[type="email"], #email', this.credenciais.login);
    await this.preencherCampo('input[name="senha"], input[name="password"], input[type="password"], #senha', this.credenciais.senha);

    await this.page.evaluate(() => {
      const btn = document.querySelector('button[type="submit"]')
        || [...document.querySelectorAll('button')]
          .find(b => b.textContent.toLowerCase().includes('entrar') || b.textContent.toLowerCase().includes('login'));
      if (btn) btn.click();
    });

    await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    this.loggedIn = true;
    console.log('✅ Login no ComprasBR realizado');
  }

  async navegarParaDisputa(edital) {
    console.log(\`📋 Buscando edital \${edital} no ComprasBR\`);
    await this.page.goto(\`\${this.baseUrl}/pregao/busca?q=\${encodeURIComponent(edital)}\`, { waitUntil: 'networkidle2' });
    await this.page.waitForTimeout(3000);

    // Clicar no resultado
    await this.page.evaluate(() => {
      const link = document.querySelector('a[href*="disputa"], a[href*="pregao/"]')
        || [...document.querySelectorAll('a, tr[role="row"]')]
          .find(el => el.textContent.includes('Sala') || el.textContent.includes('Disputar'));
      if (link) link.click();
    });
    await this.page.waitForTimeout(3000);
    await this.screenshot('comprasbr-disputa');
  }

  async lerMelhorLance() {
    return await this.page.evaluate(() => {
      const seletores = [
        '.menor-lance', '.melhor-lance', '.valor-lance',
        '[data-testid="melhor-lance"]', '.lance-vencedor',
        'td.valor', 'span.valor',
      ];
      for (const sel of seletores) {
        const el = document.querySelector(sel);
        if (el) {
          const texto = el.textContent.replace(/[^\\d.,]/g, '');
          const parts = texto.split(',');
          if (parts.length === 2) {
            const num = parseFloat(parts[0].replace(/\\./g, '') + '.' + parts[1]);
            if (!isNaN(num)) return num;
          }
        }
      }
      return null;
    });
  }

  async enviarLance(valor) {
    console.log(\`📤 Enviando lance ComprasBR: R$ \${this.formatarMoeda(valor)}\`);
    await this.preencherCampo('input[name="lance"], input[name="valor"], input[placeholder*="lance"]', this.formatarMoeda(valor));

    await this.page.evaluate(() => {
      const btn = document.querySelector('button[type="submit"]')
        || [...document.querySelectorAll('button')]
          .find(b => b.textContent.toLowerCase().includes('enviar'));
      if (btn) btn.click();
    });
    this.page.on('dialog', async d => await d.accept());
    await this.page.waitForTimeout(3000);
    await this.screenshot('lance-comprasbr');
    return true;
  }

  async verificarResultado() {
    return await this.page.evaluate(() => {
      const texto = document.body.innerText.toLowerCase();
      if (texto.includes('lance aceito') || texto.includes('registrado') || texto.includes('sucesso')) return 'aceito';
      if (texto.includes('recusado') || texto.includes('erro') || texto.includes('inválido')) return 'recusado';
      return 'indefinido';
    });
  }
}

module.exports = { ComprasBRPortal };
`,

  'src/portals/bbmnet.js': `const { BasePortal } = require('./base-portal');

/**
 * Módulo dedicado para BBMNet (Bolsa Brasileira de Mercadorias)
 *
 * URL: https://www.bbmnet.com.br
 * Autenticação: Login + senha + certificado digital A1/A3
 * Tecnologia: ASP.NET WebForms
 * Particularidades:
 *   - ASP.NET ViewState (postbacks pesados)
 *   - IDs com prefixo ctl00_ContentPlaceHolder
 *   - Certificado digital necessário para envio de lances
 *   - Timer de sessão curto (10 min)
 */
class BBMNetPortal extends BasePortal {
  constructor(page, credenciais) {
    super(page, credenciais);
    this.nome = 'bbmnet';
    this.baseUrl = 'https://www.bbmnet.com.br';
  }

  async login() {
    console.log('🔐 Iniciando login no BBMNet...');
    await this.page.goto(\`\${this.baseUrl}/Login.aspx\`, { waitUntil: 'networkidle2' });

    // ASP.NET WebForms com IDs específicos
    const loginSelectors = [
      '#txtLogin', 'input[name$="txtLogin"]', 'input[name*="ctl00"][name*="Login"]',
      'input[name="txtUsuario"]', '#ctl00_ContentPlaceHolder1_txtLogin',
    ];
    const senhaSelectors = [
      '#txtSenha', 'input[name$="txtSenha"]', 'input[name*="ctl00"][name*="Senha"]',
      'input[name="txtPassword"]', '#ctl00_ContentPlaceHolder1_txtSenha',
    ];

    for (const sel of loginSelectors) {
      const found = await this.aguardarElemento(sel, 3000);
      if (found) { await this.preencherCampo(sel, this.credenciais.login); break; }
    }
    for (const sel of senhaSelectors) {
      const found = await this.aguardarElemento(sel, 3000);
      if (found) { await this.preencherCampo(sel, this.credenciais.senha); break; }
    }

    // ASP.NET submit
    await this.page.evaluate(() => {
      const btn = document.querySelector('#btnEntrar, input[name$="btnEntrar"], input[value="Entrar"]')
        || [...document.querySelectorAll('input[type="submit"], button, a.btn')]
          .find(b => (b.value || b.textContent || '').toLowerCase().includes('entrar'));
      if (btn) btn.click();
    });

    await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    this.loggedIn = true;
    console.log('✅ Login no BBMNet realizado');
  }

  async navegarParaDisputa(edital) {
    console.log(\`📋 Buscando edital \${edital} no BBMNet\`);
    await this.page.goto(\`\${this.baseUrl}/Pregao/Busca.aspx\`, { waitUntil: 'networkidle2' });

    const buscaSelectors = [
      '#txtBusca', 'input[name$="txtBusca"]', 'input[name$="txtNumero"]',
      '#ctl00_ContentPlaceHolder1_txtBusca',
    ];
    for (const sel of buscaSelectors) {
      const found = await this.aguardarElemento(sel, 3000);
      if (found) {
        await this.preencherCampo(sel, edital);
        break;
      }
    }

    // ASP.NET postback para buscar
    await this.page.evaluate(() => {
      const btn = document.querySelector('#btnBuscar, input[name$="btnBuscar"]')
        || [...document.querySelectorAll('input[type="submit"]')]
          .find(b => (b.value || '').toLowerCase().includes('buscar'));
      if (btn) btn.click();
    });

    await this.page.waitForTimeout(5000);
    await this.screenshot('bbmnet-busca');

    // Entrar na sala de disputa
    await this.page.evaluate(() => {
      const link = document.querySelector('a[href*="SalaDisputa"], a[href*="Disputa.aspx"]')
        || [...document.querySelectorAll('a')]
          .find(a => a.textContent.includes('Sala') || a.textContent.includes('Disputar'));
      if (link) link.click();
    });
    await this.page.waitForTimeout(5000);
    await this.screenshot('bbmnet-disputa');
  }

  async lerMelhorLance() {
    return await this.page.evaluate(() => {
      const seletores = [
        '#lblMelhorLance', 'span[id$="lblMelhorLance"]', 'span[id$="lblValorMenor"]',
        '.valor-lance', '.melhor-lance', 'span.valor', 'td.lance',
      ];
      for (const sel of seletores) {
        const el = document.querySelector(sel);
        if (el) {
          const texto = el.textContent.replace(/[^\\d.,]/g, '');
          const parts = texto.split(',');
          if (parts.length === 2) {
            const num = parseFloat(parts[0].replace(/\\./g, '') + '.' + parts[1]);
            if (!isNaN(num)) return num;
          }
        }
      }
      return null;
    });
  }

  async enviarLance(valor) {
    console.log(\`📤 Enviando lance BBMNet: R$ \${this.formatarMoeda(valor)}\`);

    const lanceSelectors = [
      '#txtLance', 'input[name$="txtLance"]', 'input[name$="txtValor"]',
      '#ctl00_ContentPlaceHolder1_txtLance',
    ];
    for (const sel of lanceSelectors) {
      const found = await this.aguardarElemento(sel, 3000);
      if (found) {
        await this.preencherCampo(sel, this.formatarMoeda(valor));
        break;
      }
    }

    await this.page.evaluate(() => {
      const btn = document.querySelector('#btnEnviar, input[name$="btnEnviar"]')
        || [...document.querySelectorAll('input[type="submit"], button')]
          .find(b => (b.value || b.textContent || '').toLowerCase().includes('enviar'));
      if (btn) btn.click();
    });

    this.page.on('dialog', async d => {
      console.log(\`📌 Confirmação BBMNet: \${d.message()}\`);
      await d.accept();
    });
    await this.page.waitForTimeout(3000);
    await this.screenshot('lance-bbmnet');
    return true;
  }

  async verificarResultado() {
    return await this.page.evaluate(() => {
      const texto = document.body.innerText.toLowerCase();
      if (texto.includes('lance aceito') || texto.includes('registrado')) return 'aceito';
      if (texto.includes('recusado') || texto.includes('erro')) return 'recusado';
      return 'indefinido';
    });
  }
}

module.exports = { BBMNetPortal };
`,

  'src/portals/licitar-digital.js': `const { BasePortal } = require('./base-portal');

/**
 * Módulo dedicado para Licitar Digital
 *
 * URL: https://www.licitardigital.com.br
 * Autenticação: Login + senha
 * Tecnologia: Angular/SPA
 * Particularidades:
 *   - Angular SPA com routing client-side
 *   - WebSocket para atualizações em tempo real da sala de disputa
 *   - API REST para envio de lances
 */
class LicitarDigitalPortal extends BasePortal {
  constructor(page, credenciais) {
    super(page, credenciais);
    this.nome = 'licitar-digital';
    this.baseUrl = 'https://www.licitardigital.com.br';
  }

  async login() {
    console.log('🔐 Iniciando login no Licitar Digital...');
    await this.page.goto(\`\${this.baseUrl}/login\`, { waitUntil: 'networkidle2' });

    // Angular form
    await this.preencherCampo('input[formcontrolname="email"], input[name="email"], input[type="email"]', this.credenciais.login);
    await this.preencherCampo('input[formcontrolname="senha"], input[name="senha"], input[type="password"]', this.credenciais.senha);

    await this.page.evaluate(() => {
      const btn = document.querySelector('button[type="submit"]')
        || [...document.querySelectorAll('button')]
          .find(b => b.textContent.toLowerCase().includes('entrar'));
      if (btn) btn.click();
    });

    await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    this.loggedIn = true;
    console.log('✅ Login no Licitar Digital realizado');
  }

  async navegarParaDisputa(edital) {
    console.log(\`📋 Buscando edital \${edital} no Licitar Digital\`);
    await this.page.goto(\`\${this.baseUrl}/pregao?busca=\${encodeURIComponent(edital)}\`, { waitUntil: 'networkidle2' });
    await this.page.waitForTimeout(3000);

    // Angular: clicar na disputa
    await this.page.evaluate(() => {
      const link = document.querySelector('a[routerlink*="disputa"], a[href*="sala"]')
        || [...document.querySelectorAll('a, button')]
          .find(el => el.textContent.includes('Sala') || el.textContent.includes('Disputar'));
      if (link) link.click();
    });
    await this.page.waitForTimeout(3000);
    await this.screenshot('licitar-digital-disputa');
  }

  async lerMelhorLance() {
    return await this.page.evaluate(() => {
      const seletores = [
        '.menor-lance', '.melhor-lance', '.valor-lance',
        '[data-label="Melhor Lance"]', 'app-lance .valor',
      ];
      for (const sel of seletores) {
        const el = document.querySelector(sel);
        if (el) {
          const texto = el.textContent.replace(/[^\\d.,]/g, '');
          const parts = texto.split(',');
          if (parts.length === 2) {
            const num = parseFloat(parts[0].replace(/\\./g, '') + '.' + parts[1]);
            if (!isNaN(num)) return num;
          }
        }
      }
      return null;
    });
  }

  async enviarLance(valor) {
    console.log(\`📤 Enviando lance Licitar Digital: R$ \${this.formatarMoeda(valor)}\`);
    await this.preencherCampo('input[formcontrolname="lance"], input[name="lance"], input[name="valor"]', this.formatarMoeda(valor));

    await this.page.evaluate(() => {
      const btn = document.querySelector('button[type="submit"]')
        || [...document.querySelectorAll('button')]
          .find(b => b.textContent.toLowerCase().includes('enviar'));
      if (btn) btn.click();
    });
    this.page.on('dialog', async d => await d.accept());
    await this.page.waitForTimeout(3000);
    await this.screenshot('lance-licitar-digital');
    return true;
  }

  async verificarResultado() {
    return await this.page.evaluate(() => {
      const texto = document.body.innerText.toLowerCase();
      if (texto.includes('lance aceito') || texto.includes('registrado') || texto.includes('sucesso')) return 'aceito';
      if (texto.includes('recusado') || texto.includes('erro') || texto.includes('inválido')) return 'recusado';
      return 'indefinido';
    });
  }
}

module.exports = { LicitarDigitalPortal };
`,

  'src/portals/comprasnet-ba.js': `const { BasePortal } = require('./base-portal');

/**
 * Módulo dedicado para ComprasNet Bahia
 *
 * URL: https://www.comprasnet.ba.gov.br
 * Autenticação: CPF/CNPJ + senha
 * Estado: Bahia
 * Tecnologia: Java/Primefaces
 * Particularidades:
 *   - Primefaces com AJAX parcial (não faz reload completo)
 *   - Login por CPF do representante legal
 *   - IDs com prefixo formPregao:
 */
class ComprasNetBAPortal extends BasePortal {
  constructor(page, credenciais) {
    super(page, credenciais);
    this.nome = 'comprasnet-ba';
    this.nomeExibicao = 'ComprasNet BA';
    this.baseUrl = 'https://www.comprasnet.ba.gov.br';
  }

  async login() {
    console.log('🔐 Iniciando login no ComprasNet BA...');
    await this.page.goto(\`\${this.baseUrl}/fornecedor/login\`, { waitUntil: 'networkidle2' });
    
    await this.preencherCampo('input[name="cpf"], input[id$="cpf"], #cpfCnpj', this.credenciais.login);
    await this.preencherCampo('input[name="senha"], input[id$="senha"], #senha', this.credenciais.senha);

    await this.page.evaluate(() => {
      const btn = document.querySelector('button[id$="btnEntrar"], input[id$="btnLogin"]')
        || [...document.querySelectorAll('button, input[type="submit"]')]
          .find(b => (b.textContent || b.value || '').toLowerCase().includes('entrar'));
      if (btn) btn.click();
    });

    await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 });
    this.loggedIn = true;
    console.log('✅ Login no ComprasNet BA realizado');
  }

  async navegarParaDisputa(edital) {
    console.log(\`📋 Buscando edital \${edital} no ComprasNet BA\`);
    await this.page.goto(\`\${this.baseUrl}/fornecedor/pregao\`, { waitUntil: 'networkidle2' });
    
    await this.preencherCampo('input[id$="numPregao"], input[name="numPregao"], #formBusca\\\\:numPregao', edital);
    await this.page.evaluate(() => {
      const btn = document.querySelector('button[id$="btnBuscar"]')
        || [...document.querySelectorAll('button, input[type="submit"]')]
          .find(b => (b.textContent || b.value || '').toLowerCase().includes('buscar'));
      if (btn) btn.click();
    });
    await this.page.waitForTimeout(5000);
    await this.screenshot('comprasnet-ba-disputa');
  }

  async lerMelhorLance() {
    return await this.page.evaluate(() => {
      const seletores = [
        'span[id$="melhorLance"]', '.menor-lance', '#formDisputa\\\\:melhorLance',
        'td[id$="valorMenorLance"]', '.valor-lance',
      ];
      for (const sel of seletores) {
        const el = document.querySelector(sel);
        if (el) {
          const texto = el.textContent.replace(/[^\\d.,]/g, '');
          const parts = texto.split(',');
          if (parts.length === 2) {
            return parseFloat(parts[0].replace(/\\./g, '') + '.' + parts[1]);
          }
        }
      }
      return null;
    });
  }

  async enviarLance(valor) {
    console.log(\`📤 Enviando lance ComprasNet BA: R$ \${this.formatarMoeda(valor)}\`);
    await this.preencherCampo('input[id$="valorLance"], input[name="valorLance"]', this.formatarMoeda(valor));
    
    await this.page.evaluate(() => {
      const btn = document.querySelector('button[id$="btnEnviarLance"]')
        || [...document.querySelectorAll('button')]
          .find(b => b.textContent.toLowerCase().includes('enviar'));
      if (btn) btn.click();
    });
    this.page.on('dialog', async d => await d.accept());
    await this.page.waitForTimeout(3000);
    await this.screenshot('lance-comprasnet-ba');
    return true;
  }

  async verificarResultado() {
    return await this.page.evaluate(() => {
      const texto = document.body.innerText.toLowerCase();
      if (texto.includes('lance aceito') || texto.includes('registrado')) return 'aceito';
      if (texto.includes('recusado') || texto.includes('erro')) return 'recusado';
      return 'indefinido';
    });
  }
}

module.exports = { ComprasNetBAPortal };
`,

  'src/portals/comprasnet-go.js': `const { BasePortal } = require('./base-portal');

/**
 * Módulo dedicado para ComprasNet Goiás
 *
 * URL: https://www.comprasgovernamentais.go.gov.br
 * Autenticação: CPF + senha
 * Estado: Goiás
 * Tecnologia: PHP/Laravel
 */
class ComprasNetGOPortal extends BasePortal {
  constructor(page, credenciais) {
    super(page, credenciais);
    this.nome = 'comprasnet-go';
    this.nomeExibicao = 'ComprasNet GO';
    this.baseUrl = 'https://www.comprasgovernamentais.go.gov.br';
  }

  async login() {
    console.log('🔐 Iniciando login no ComprasNet GO...');
    await this.page.goto(\`\${this.baseUrl}/login\`, { waitUntil: 'networkidle2' });
    await this.preencherCampo('input[name="cpf"], input[name="login"], #cpf', this.credenciais.login);
    await this.preencherCampo('input[name="senha"], input[name="password"], #senha', this.credenciais.senha);
    await this.page.evaluate(() => {
      const btn = document.querySelector('button[type="submit"]')
        || [...document.querySelectorAll('button')]
          .find(b => b.textContent.toLowerCase().includes('entrar'));
      if (btn) btn.click();
    });
    await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    this.loggedIn = true;
    console.log('✅ Login no ComprasNet GO realizado');
  }

  async navegarParaDisputa(edital) {
    await this.page.goto(\`\${this.baseUrl}/pregao?numero=\${encodeURIComponent(edital)}\`, { waitUntil: 'networkidle2' });
    await this.page.waitForTimeout(5000);
    await this.screenshot('comprasnet-go-disputa');
  }

  async lerMelhorLance() {
    return await this.page.evaluate(() => {
      const seletores = ['.menor-lance', '.melhor-lance', '.valor-lance', 'td.valor', '#melhorLance'];
      for (const sel of seletores) {
        const el = document.querySelector(sel);
        if (el) {
          const texto = el.textContent.replace(/[^\\d.,]/g, '');
          const parts = texto.split(',');
          if (parts.length === 2) return parseFloat(parts[0].replace(/\\./g, '') + '.' + parts[1]);
        }
      }
      return null;
    });
  }

  async enviarLance(valor) {
    console.log(\`📤 Enviando lance ComprasNet GO: R$ \${this.formatarMoeda(valor)}\`);
    await this.preencherCampo('input[name="lance"], input[name="valor"]', this.formatarMoeda(valor));
    await this.page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find(b => b.textContent.toLowerCase().includes('enviar'));
      if (btn) btn.click();
    });
    this.page.on('dialog', async d => await d.accept());
    await this.page.waitForTimeout(3000);
    return true;
  }

  async verificarResultado() {
    return await this.page.evaluate(() => {
      const texto = document.body.innerText.toLowerCase();
      if (texto.includes('aceito') || texto.includes('registrado')) return 'aceito';
      if (texto.includes('recusado') || texto.includes('erro')) return 'recusado';
      return 'indefinido';
    });
  }
}

module.exports = { ComprasNetGOPortal };
`,

  'src/portals/compras-mg.js': `const { BasePortal } = require('./base-portal');

/**
 * Módulo dedicado para Compras MG
 *
 * URL: https://www.compras.mg.gov.br
 * Autenticação: Login + senha (SIARE)
 * Estado: Minas Gerais
 * Tecnologia: Java/.NET híbrido
 * Particularidades:
 *   - Integração com SIARE (Sistema Integrado de Administração da Receita Estadual)
 *   - Login unificado do estado
 */
class ComprasMGPortal extends BasePortal {
  constructor(page, credenciais) {
    super(page, credenciais);
    this.nome = 'compras-mg';
    this.nomeExibicao = 'Compras MG';
    this.baseUrl = 'https://www.compras.mg.gov.br';
  }

  async login() {
    console.log('🔐 Iniciando login no Compras MG...');
    await this.page.goto(\`\${this.baseUrl}/fornecedor/login\`, { waitUntil: 'networkidle2' });
    await this.preencherCampo('input[name="login"], input[name="cpfCnpj"], #cpfCnpj', this.credenciais.login);
    await this.preencherCampo('input[name="senha"], input[name="password"], #senha', this.credenciais.senha);
    await this.page.evaluate(() => {
      const btn = document.querySelector('button[type="submit"], input[type="submit"]')
        || [...document.querySelectorAll('button')].find(b => b.textContent.toLowerCase().includes('entrar'));
      if (btn) btn.click();
    });
    await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 });
    this.loggedIn = true;
    console.log('✅ Login no Compras MG realizado');
  }

  async navegarParaDisputa(edital) {
    await this.page.goto(\`\${this.baseUrl}/fornecedor/pregao?busca=\${encodeURIComponent(edital)}\`, { waitUntil: 'networkidle2' });
    await this.page.waitForTimeout(5000);
    await this.screenshot('compras-mg-disputa');
  }

  async lerMelhorLance() {
    return await this.page.evaluate(() => {
      for (const sel of ['.menor-lance', '.melhor-lance', 'td.valor', '#melhorLance']) {
        const el = document.querySelector(sel);
        if (el) {
          const t = el.textContent.replace(/[^\\d.,]/g, '').split(',');
          if (t.length === 2) return parseFloat(t[0].replace(/\\./g, '') + '.' + t[1]);
        }
      }
      return null;
    });
  }

  async enviarLance(valor) {
    console.log(\`📤 Enviando lance Compras MG: R$ \${this.formatarMoeda(valor)}\`);
    await this.preencherCampo('input[name="valorLance"], input[name="lance"]', this.formatarMoeda(valor));
    await this.page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find(b => b.textContent.toLowerCase().includes('enviar'));
      if (btn) btn.click();
    });
    this.page.on('dialog', async d => await d.accept());
    await this.page.waitForTimeout(3000);
    return true;
  }

  async verificarResultado() {
    return await this.page.evaluate(() => {
      const t = document.body.innerText.toLowerCase();
      if (t.includes('aceito') || t.includes('registrado')) return 'aceito';
      if (t.includes('recusado') || t.includes('erro')) return 'recusado';
      return 'indefinido';
    });
  }
}

module.exports = { ComprasMGPortal };
`,

  'src/portals/pe-integrado.js': `const { BasePortal } = require('./base-portal');

/**
 * Módulo dedicado para PE Integrado (Pernambuco)
 *
 * URL: https://www.peintegrado.pe.gov.br
 * Autenticação: CPF + senha
 * Estado: Pernambuco
 * Tecnologia: Angular
 * Particularidades:
 *   - SPA Angular com lazy loading
 *   - API REST com token JWT
 *   - WebSocket para sala de disputa em tempo real
 */
class PEIntegradoPortal extends BasePortal {
  constructor(page, credenciais) {
    super(page, credenciais);
    this.nome = 'compras-pe';
    this.nomeExibicao = 'PE Integrado';
    this.baseUrl = 'https://www.peintegrado.pe.gov.br';
  }

  async login() {
    console.log('🔐 Iniciando login no PE Integrado...');
    await this.page.goto(\`\${this.baseUrl}/login\`, { waitUntil: 'networkidle2' });
    await this.preencherCampo('input[formcontrolname="cpf"], input[name="cpf"]', this.credenciais.login);
    await this.preencherCampo('input[formcontrolname="senha"], input[name="senha"]', this.credenciais.senha);
    await this.page.evaluate(() => {
      const btn = document.querySelector('button[type="submit"]')
        || [...document.querySelectorAll('button')].find(b => b.textContent.toLowerCase().includes('entrar'));
      if (btn) btn.click();
    });
    await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    this.loggedIn = true;
    console.log('✅ Login no PE Integrado realizado');
  }

  async navegarParaDisputa(edital) {
    await this.page.goto(\`\${this.baseUrl}/fornecedor/pregao?busca=\${encodeURIComponent(edital)}\`, { waitUntil: 'networkidle2' });
    await this.page.waitForTimeout(5000);
    await this.screenshot('pe-integrado-disputa');
  }

  async lerMelhorLance() {
    return await this.page.evaluate(() => {
      for (const sel of ['.menor-lance', '.melhor-lance', '[data-label="Melhor Lance"]']) {
        const el = document.querySelector(sel);
        if (el) {
          const t = el.textContent.replace(/[^\\d.,]/g, '').split(',');
          if (t.length === 2) return parseFloat(t[0].replace(/\\./g, '') + '.' + t[1]);
        }
      }
      return null;
    });
  }

  async enviarLance(valor) {
    console.log(\`📤 Enviando lance PE Integrado: R$ \${this.formatarMoeda(valor)}\`);
    await this.preencherCampo('input[formcontrolname="lance"], input[name="valor"]', this.formatarMoeda(valor));
    await this.page.evaluate(() => {
      const btn = document.querySelector('button[type="submit"]')
        || [...document.querySelectorAll('button')].find(b => b.textContent.toLowerCase().includes('enviar'));
      if (btn) btn.click();
    });
    this.page.on('dialog', async d => await d.accept());
    await this.page.waitForTimeout(3000);
    return true;
  }

  async verificarResultado() {
    return await this.page.evaluate(() => {
      const t = document.body.innerText.toLowerCase();
      if (t.includes('aceito') || t.includes('registrado')) return 'aceito';
      if (t.includes('recusado') || t.includes('erro')) return 'recusado';
      return 'indefinido';
    });
  }
}

module.exports = { PEIntegradoPortal };
`,

  'src/portals/compras-rj.js': `const { BasePortal } = require('./base-portal');

/**
 * Módulo dedicado para Compras RJ
 *
 * URL: https://www.compras.rj.gov.br
 * Autenticação: CPF + senha (ID Digital RJ)
 * Estado: Rio de Janeiro
 */
class ComprasRJPortal extends BasePortal {
  constructor(page, credenciais) {
    super(page, credenciais);
    this.nome = 'compras-rj';
    this.nomeExibicao = 'Compras RJ';
    this.baseUrl = 'https://www.compras.rj.gov.br';
  }

  async login() {
    console.log('🔐 Iniciando login no Compras RJ...');
    await this.page.goto(\`\${this.baseUrl}/fornecedor/login\`, { waitUntil: 'networkidle2' });
    await this.preencherCampo('input[name="cpf"], input[name="login"]', this.credenciais.login);
    await this.preencherCampo('input[name="senha"], input[name="password"]', this.credenciais.senha);
    await this.page.evaluate(() => {
      const btn = document.querySelector('button[type="submit"]')
        || [...document.querySelectorAll('button')].find(b => b.textContent.toLowerCase().includes('entrar'));
      if (btn) btn.click();
    });
    await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    this.loggedIn = true;
    console.log('✅ Login no Compras RJ realizado');
  }

  async navegarParaDisputa(edital) {
    await this.page.goto(\`\${this.baseUrl}/pregao?numero=\${encodeURIComponent(edital)}\`, { waitUntil: 'networkidle2' });
    await this.page.waitForTimeout(5000);
    await this.screenshot('compras-rj-disputa');
  }

  async lerMelhorLance() {
    return await this.page.evaluate(() => {
      for (const sel of ['.menor-lance', '.melhor-lance', 'td.valor', '#melhorLance']) {
        const el = document.querySelector(sel);
        if (el) {
          const t = el.textContent.replace(/[^\\d.,]/g, '').split(',');
          if (t.length === 2) return parseFloat(t[0].replace(/\\./g, '') + '.' + t[1]);
        }
      }
      return null;
    });
  }

  async enviarLance(valor) {
    console.log(\`📤 Enviando lance Compras RJ: R$ \${this.formatarMoeda(valor)}\`);
    await this.preencherCampo('input[name="lance"], input[name="valor"]', this.formatarMoeda(valor));
    await this.page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find(b => b.textContent.toLowerCase().includes('enviar'));
      if (btn) btn.click();
    });
    this.page.on('dialog', async d => await d.accept());
    await this.page.waitForTimeout(3000);
    return true;
  }

  async verificarResultado() {
    return await this.page.evaluate(() => {
      const t = document.body.innerText.toLowerCase();
      if (t.includes('aceito') || t.includes('registrado')) return 'aceito';
      if (t.includes('recusado') || t.includes('erro')) return 'recusado';
      return 'indefinido';
    });
  }
}

module.exports = { ComprasRJPortal };
`,

  'src/portals/compras-pr.js': `const { BasePortal } = require('./base-portal');

/**
 * Módulo dedicado para Compras Paraná
 *
 * URL: https://www.comprasparana.pr.gov.br
 * Autenticação: CPF + senha
 * Estado: Paraná
 */
class ComprasPRPortal extends BasePortal {
  constructor(page, credenciais) {
    super(page, credenciais);
    this.nome = 'compras-pr';
    this.nomeExibicao = 'Compras PR';
    this.baseUrl = 'https://www.comprasparana.pr.gov.br';
  }

  async login() {
    console.log('🔐 Iniciando login no Compras PR...');
    await this.page.goto(\`\${this.baseUrl}/login\`, { waitUntil: 'networkidle2' });
    await this.preencherCampo('input[name="cpf"], input[name="login"]', this.credenciais.login);
    await this.preencherCampo('input[name="senha"], input[name="password"]', this.credenciais.senha);
    await this.page.evaluate(() => {
      const btn = document.querySelector('button[type="submit"]')
        || [...document.querySelectorAll('button')].find(b => b.textContent.toLowerCase().includes('entrar'));
      if (btn) btn.click();
    });
    await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    this.loggedIn = true;
    console.log('✅ Login no Compras PR realizado');
  }

  async navegarParaDisputa(edital) {
    await this.page.goto(\`\${this.baseUrl}/pregao?busca=\${encodeURIComponent(edital)}\`, { waitUntil: 'networkidle2' });
    await this.page.waitForTimeout(5000);
  }

  async lerMelhorLance() {
    return await this.page.evaluate(() => {
      for (const sel of ['.menor-lance', '.melhor-lance', 'td.valor']) {
        const el = document.querySelector(sel);
        if (el) {
          const t = el.textContent.replace(/[^\\d.,]/g, '').split(',');
          if (t.length === 2) return parseFloat(t[0].replace(/\\./g, '') + '.' + t[1]);
        }
      }
      return null;
    });
  }

  async enviarLance(valor) {
    await this.preencherCampo('input[name="lance"], input[name="valor"]', this.formatarMoeda(valor));
    await this.page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find(b => b.textContent.toLowerCase().includes('enviar'));
      if (btn) btn.click();
    });
    this.page.on('dialog', async d => await d.accept());
    await this.page.waitForTimeout(3000);
    return true;
  }

  async verificarResultado() {
    return await this.page.evaluate(() => {
      const t = document.body.innerText.toLowerCase();
      if (t.includes('aceito') || t.includes('registrado')) return 'aceito';
      if (t.includes('recusado') || t.includes('erro')) return 'recusado';
      return 'indefinido';
    });
  }
}

module.exports = { ComprasPRPortal };
`,

  'src/portals/compras-rs.js': `const { BasePortal } = require('./base-portal');

/**
 * Módulo dedicado para Compras RS
 *
 * URL: https://www.compras.rs.gov.br
 * Autenticação: CPF + senha
 * Estado: Rio Grande do Sul
 */
class ComprasRSPortal extends BasePortal {
  constructor(page, credenciais) {
    super(page, credenciais);
    this.nome = 'compras-rs';
    this.nomeExibicao = 'Compras RS';
    this.baseUrl = 'https://www.compras.rs.gov.br';
  }

  async login() {
    console.log('🔐 Iniciando login no Compras RS...');
    await this.page.goto(\`\${this.baseUrl}/login\`, { waitUntil: 'networkidle2' });
    await this.preencherCampo('input[name="cpf"], input[name="login"]', this.credenciais.login);
    await this.preencherCampo('input[name="senha"], input[name="password"]', this.credenciais.senha);
    await this.page.evaluate(() => {
      const btn = document.querySelector('button[type="submit"]')
        || [...document.querySelectorAll('button')].find(b => b.textContent.toLowerCase().includes('entrar'));
      if (btn) btn.click();
    });
    await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    this.loggedIn = true;
    console.log('✅ Login no Compras RS realizado');
  }

  async navegarParaDisputa(edital) {
    await this.page.goto(\`\${this.baseUrl}/pregao?busca=\${encodeURIComponent(edital)}\`, { waitUntil: 'networkidle2' });
    await this.page.waitForTimeout(5000);
  }

  async lerMelhorLance() {
    return await this.page.evaluate(() => {
      for (const sel of ['.menor-lance', '.melhor-lance', 'td.valor']) {
        const el = document.querySelector(sel);
        if (el) {
          const t = el.textContent.replace(/[^\\d.,]/g, '').split(',');
          if (t.length === 2) return parseFloat(t[0].replace(/\\./g, '') + '.' + t[1]);
        }
      }
      return null;
    });
  }

  async enviarLance(valor) {
    await this.preencherCampo('input[name="lance"], input[name="valor"]', this.formatarMoeda(valor));
    await this.page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find(b => b.textContent.toLowerCase().includes('enviar'));
      if (btn) btn.click();
    });
    this.page.on('dialog', async d => await d.accept());
    await this.page.waitForTimeout(3000);
    return true;
  }

  async verificarResultado() {
    return await this.page.evaluate(() => {
      const t = document.body.innerText.toLowerCase();
      if (t.includes('aceito') || t.includes('registrado')) return 'aceito';
      if (t.includes('recusado') || t.includes('erro')) return 'recusado';
      return 'indefinido';
    });
  }
}

module.exports = { ComprasRSPortal };
`,

  'src/portals/compras-sc.js': `const { BasePortal } = require('./base-portal');

/**
 * Módulo dedicado para Portal de Compras SC
 *
 * URL: https://www.portaldecompras.sc.gov.br
 * Autenticação: CPF + senha
 * Estado: Santa Catarina
 */
class ComprasSCPortal extends BasePortal {
  constructor(page, credenciais) {
    super(page, credenciais);
    this.nome = 'compras-sc';
    this.nomeExibicao = 'Compras SC';
    this.baseUrl = 'https://www.portaldecompras.sc.gov.br';
  }

  async login() {
    console.log('🔐 Iniciando login no Compras SC...');
    await this.page.goto(\`\${this.baseUrl}/login\`, { waitUntil: 'networkidle2' });
    await this.preencherCampo('input[name="cpf"], input[name="login"]', this.credenciais.login);
    await this.preencherCampo('input[name="senha"], input[name="password"]', this.credenciais.senha);
    await this.page.evaluate(() => {
      const btn = document.querySelector('button[type="submit"]')
        || [...document.querySelectorAll('button')].find(b => b.textContent.toLowerCase().includes('entrar'));
      if (btn) btn.click();
    });
    await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    this.loggedIn = true;
    console.log('✅ Login no Compras SC realizado');
  }

  async navegarParaDisputa(edital) {
    await this.page.goto(\`\${this.baseUrl}/pregao?busca=\${encodeURIComponent(edital)}\`, { waitUntil: 'networkidle2' });
    await this.page.waitForTimeout(5000);
  }

  async lerMelhorLance() {
    return await this.page.evaluate(() => {
      for (const sel of ['.menor-lance', '.melhor-lance', 'td.valor']) {
        const el = document.querySelector(sel);
        if (el) {
          const t = el.textContent.replace(/[^\\d.,]/g, '').split(',');
          if (t.length === 2) return parseFloat(t[0].replace(/\\./g, '') + '.' + t[1]);
        }
      }
      return null;
    });
  }

  async enviarLance(valor) {
    await this.preencherCampo('input[name="lance"], input[name="valor"]', this.formatarMoeda(valor));
    await this.page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find(b => b.textContent.toLowerCase().includes('enviar'));
      if (btn) btn.click();
    });
    this.page.on('dialog', async d => await d.accept());
    await this.page.waitForTimeout(3000);
    return true;
  }

  async verificarResultado() {
    return await this.page.evaluate(() => {
      const t = document.body.innerText.toLowerCase();
      if (t.includes('aceito') || t.includes('registrado')) return 'aceito';
      if (t.includes('recusado') || t.includes('erro')) return 'recusado';
      return 'indefinido';
    });
  }
}

module.exports = { ComprasSCPortal };
`,

  'src/portals/ecompras-df.js': `const { BasePortal } = require('./base-portal');

/**
 * Módulo dedicado para e-Compras DF
 *
 * URL: https://www.compras.df.gov.br
 * Autenticação: CPF + senha
 * Estado: Distrito Federal
 * Particularidades:
 *   - Portal próprio do GDF
 *   - Integração com SICONV/DF
 */
class EComprasDFPortal extends BasePortal {
  constructor(page, credenciais) {
    super(page, credenciais);
    this.nome = 'compras-df';
    this.nomeExibicao = 'e-Compras DF';
    this.baseUrl = 'https://www.compras.df.gov.br';
  }

  async login() {
    console.log('🔐 Iniciando login no e-Compras DF...');
    await this.page.goto(\`\${this.baseUrl}/login\`, { waitUntil: 'networkidle2' });
    await this.preencherCampo('input[name="cpf"], input[name="login"]', this.credenciais.login);
    await this.preencherCampo('input[name="senha"], input[name="password"]', this.credenciais.senha);
    await this.page.evaluate(() => {
      const btn = document.querySelector('button[type="submit"]')
        || [...document.querySelectorAll('button')].find(b => b.textContent.toLowerCase().includes('entrar'));
      if (btn) btn.click();
    });
    await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    this.loggedIn = true;
    console.log('✅ Login no e-Compras DF realizado');
  }

  async navegarParaDisputa(edital) {
    await this.page.goto(\`\${this.baseUrl}/pregao?busca=\${encodeURIComponent(edital)}\`, { waitUntil: 'networkidle2' });
    await this.page.waitForTimeout(5000);
  }

  async lerMelhorLance() {
    return await this.page.evaluate(() => {
      for (const sel of ['.menor-lance', '.melhor-lance', 'td.valor']) {
        const el = document.querySelector(sel);
        if (el) {
          const t = el.textContent.replace(/[^\\d.,]/g, '').split(',');
          if (t.length === 2) return parseFloat(t[0].replace(/\\./g, '') + '.' + t[1]);
        }
      }
      return null;
    });
  }

  async enviarLance(valor) {
    await this.preencherCampo('input[name="lance"], input[name="valor"]', this.formatarMoeda(valor));
    await this.page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find(b => b.textContent.toLowerCase().includes('enviar'));
      if (btn) btn.click();
    });
    this.page.on('dialog', async d => await d.accept());
    await this.page.waitForTimeout(3000);
    return true;
  }

  async verificarResultado() {
    return await this.page.evaluate(() => {
      const t = document.body.innerText.toLowerCase();
      if (t.includes('aceito') || t.includes('registrado')) return 'aceito';
      if (t.includes('recusado') || t.includes('erro')) return 'recusado';
      return 'indefinido';
    });
  }
}

module.exports = { EComprasDFPortal };
`,

  'src/portals/ecompras-am.js': `const { BasePortal } = require('./base-portal');

/**
 * Módulo dedicado para e-Compras AM
 *
 * URL: https://www.ecompras.am.gov.br
 * Autenticação: CPF + senha
 * Estado: Amazonas
 */
class EComprasAMPortal extends BasePortal {
  constructor(page, credenciais) {
    super(page, credenciais);
    this.nome = 'e-compras-am';
    this.nomeExibicao = 'e-Compras AM';
    this.baseUrl = 'https://www.ecompras.am.gov.br';
  }

  async login() {
    console.log('🔐 Iniciando login no e-Compras AM...');
    await this.page.goto(\`\${this.baseUrl}/login\`, { waitUntil: 'networkidle2' });
    await this.preencherCampo('input[name="cpf"], input[name="login"]', this.credenciais.login);
    await this.preencherCampo('input[name="senha"], input[name="password"]', this.credenciais.senha);
    await this.page.evaluate(() => {
      const btn = document.querySelector('button[type="submit"]')
        || [...document.querySelectorAll('button')].find(b => b.textContent.toLowerCase().includes('entrar'));
      if (btn) btn.click();
    });
    await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    this.loggedIn = true;
    console.log('✅ Login no e-Compras AM realizado');
  }

  async navegarParaDisputa(edital) {
    await this.page.goto(\`\${this.baseUrl}/pregao?busca=\${encodeURIComponent(edital)}\`, { waitUntil: 'networkidle2' });
    await this.page.waitForTimeout(5000);
  }

  async lerMelhorLance() {
    return await this.page.evaluate(() => {
      for (const sel of ['.menor-lance', '.melhor-lance', 'td.valor']) {
        const el = document.querySelector(sel);
        if (el) {
          const t = el.textContent.replace(/[^\\d.,]/g, '').split(',');
          if (t.length === 2) return parseFloat(t[0].replace(/\\./g, '') + '.' + t[1]);
        }
      }
      return null;
    });
  }

  async enviarLance(valor) {
    await this.preencherCampo('input[name="lance"], input[name="valor"]', this.formatarMoeda(valor));
    await this.page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find(b => b.textContent.toLowerCase().includes('enviar'));
      if (btn) btn.click();
    });
    this.page.on('dialog', async d => await d.accept());
    await this.page.waitForTimeout(3000);
    return true;
  }

  async verificarResultado() {
    return await this.page.evaluate(() => {
      const t = document.body.innerText.toLowerCase();
      if (t.includes('aceito') || t.includes('registrado')) return 'aceito';
      if (t.includes('recusado') || t.includes('erro')) return 'recusado';
      return 'indefinido';
    });
  }
}

module.exports = { EComprasAMPortal };
`,

  'src/portals/compras-ce.js': `const { BasePortal } = require('./base-portal');

/**
 * Módulo dedicado para Portal de Compras CE
 *
 * URL: https://s2gpr.sefaz.ce.gov.br
 * Autenticação: CPF + senha (SEFAZ-CE)
 * Estado: Ceará
 * Particularidades:
 *   - Integração com SEFAZ-CE (S2GPR)
 *   - Portal baseado em Java EE
 */
class ComprasCEPortal extends BasePortal {
  constructor(page, credenciais) {
    super(page, credenciais);
    this.nome = 'portal-compras-ce';
    this.nomeExibicao = 'Compras CE';
    this.baseUrl = 'https://s2gpr.sefaz.ce.gov.br';
  }

  async login() {
    console.log('🔐 Iniciando login no Portal de Compras CE...');
    await this.page.goto(\`\${this.baseUrl}/login\`, { waitUntil: 'networkidle2' });
    await this.preencherCampo('input[name="cpf"], input[name="login"], input[id$="cpf"]', this.credenciais.login);
    await this.preencherCampo('input[name="senha"], input[name="password"], input[id$="senha"]', this.credenciais.senha);
    await this.page.evaluate(() => {
      const btn = document.querySelector('button[type="submit"], input[type="submit"]')
        || [...document.querySelectorAll('button')].find(b => b.textContent.toLowerCase().includes('entrar'));
      if (btn) btn.click();
    });
    await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 });
    this.loggedIn = true;
    console.log('✅ Login no Portal de Compras CE realizado');
  }

  async navegarParaDisputa(edital) {
    await this.page.goto(\`\${this.baseUrl}/pregao?busca=\${encodeURIComponent(edital)}\`, { waitUntil: 'networkidle2' });
    await this.page.waitForTimeout(5000);
  }

  async lerMelhorLance() {
    return await this.page.evaluate(() => {
      for (const sel of ['.menor-lance', '.melhor-lance', 'td.valor', 'span[id$="melhorLance"]']) {
        const el = document.querySelector(sel);
        if (el) {
          const t = el.textContent.replace(/[^\\d.,]/g, '').split(',');
          if (t.length === 2) return parseFloat(t[0].replace(/\\./g, '') + '.' + t[1]);
        }
      }
      return null;
    });
  }

  async enviarLance(valor) {
    await this.preencherCampo('input[name="lance"], input[name="valorLance"], input[id$="valorLance"]', this.formatarMoeda(valor));
    await this.page.evaluate(() => {
      const btn = [...document.querySelectorAll('button, input[type="submit"]')]
        .find(b => (b.textContent || b.value || '').toLowerCase().includes('enviar'));
      if (btn) btn.click();
    });
    this.page.on('dialog', async d => await d.accept());
    await this.page.waitForTimeout(3000);
    return true;
  }

  async verificarResultado() {
    return await this.page.evaluate(() => {
      const t = document.body.innerText.toLowerCase();
      if (t.includes('aceito') || t.includes('registrado')) return 'aceito';
      if (t.includes('recusado') || t.includes('erro')) return 'recusado';
      return 'indefinido';
    });
  }
}

module.exports = { ComprasCEPortal };
`,
};
