// Portal-specific automation modules for state/regional portals

export const PORTAL_ESTADUAIS_FILES: Record<string, string> = {
  'src/portals/banparanet.js': `const { BasePortal } = require('./base-portal');

/**
 * Módulo para Banparanet (PA)
 *
 * URL: https://www.banparanet.com.br
 * Autenticação: Login + senha + certificado digital
 * Estado: Pará
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

    await this.preencherCampo('input[name="usuario"], input[name="login"], #usuario', this.credenciais.login);
    await this.preencherCampo('input[name="senha"], #senha', this.credenciais.senha);

    await this.page.evaluate(() => {
      const btn = [...document.querySelectorAll('button, input[type="submit"]')]
        .find(b => (b.textContent || b.value || '').toLowerCase().includes('entrar'));
      if (btn) btn.click();
    });

    await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    this.loggedIn = true;
    console.log('✅ Login no Banparanet realizado');
  }

  async navegarParaDisputa(edital) {
    console.log(\`📋 Buscando edital \${edital} no Banparanet\`);
    await this.page.goto(\`\${this.baseUrl}/licitacao/pregao\`, { waitUntil: 'networkidle2' });
    await this.preencherCampo('input[name="busca"], input[name="numPregao"], #busca', edital);
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(5000);
    await this.screenshot('banparanet-disputa');
  }

  async lerMelhorLance() {
    return await this.page.evaluate(() => {
      const seletores = ['.menor-lance', '.melhor-lance', '.valor-lance', 'td.valor', '.lance-atual'];
      for (const sel of seletores) {
        const el = document.querySelector(sel);
        if (el) {
          const texto = el.textContent.replace(/[^\\d.,]/g, '').replace('.', '').replace(',', '.');
          const num = parseFloat(texto);
          if (!isNaN(num)) return num;
        }
      }
      return null;
    });
  }

  async enviarLance(valor) {
    console.log(\`📤 Enviando lance Banparanet: R$ \${this.formatarMoeda(valor)}\`);
    await this.preencherCampo('input[name="lance"], input[name="valor"], #lance', this.formatarMoeda(valor));
    await this.page.evaluate(() => {
      const btn = [...document.querySelectorAll('button, input[type="submit"]')]
        .find(b => (b.textContent || b.value || '').toLowerCase().includes('enviar'));
      if (btn) btn.click();
    });
    this.page.on('dialog', async d => await d.accept());
    await this.page.waitForTimeout(3000);
    await this.screenshot('lance-banparanet');
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

module.exports = { BanparanetPortal };
`,

  'src/portals/comprasbr.js': `const { BasePortal } = require('./base-portal');

/**
 * Módulo para ComprasBR
 *
 * URL: https://www.comprasbr.com.br
 * Autenticação: Login + senha
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
    await this.preencherCampo('input[name="email"], input[name="login"], #email', this.credenciais.login);
    await this.preencherCampo('input[name="senha"], input[name="password"], #senha', this.credenciais.senha);
    await this.page.evaluate(() => {
      const btn = [...document.querySelectorAll('button, input[type="submit"]')]
        .find(b => (b.textContent || b.value || '').toLowerCase().includes('entrar'));
      if (btn) btn.click();
    });
    await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    this.loggedIn = true;
    console.log('✅ Login no ComprasBR realizado');
  }

  async navegarParaDisputa(edital) {
    await this.page.goto(\`\${this.baseUrl}/pregao/busca?q=\${encodeURIComponent(edital)}\`, { waitUntil: 'networkidle2' });
    await this.page.waitForTimeout(3000);
  }

  async lerMelhorLance() {
    return await this.page.evaluate(() => {
      const el = document.querySelector('.menor-lance, .melhor-lance, .valor-lance, td.valor');
      if (!el) return null;
      return parseFloat(el.textContent.replace(/[^\\d.,]/g, '').replace('.', '').replace(',', '.'));
    });
  }

  async enviarLance(valor) {
    await this.preencherCampo('input[name="lance"], input[name="valor"]', this.formatarMoeda(valor));
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

module.exports = { ComprasBRPortal };
`,

  'src/portals/bbmnet.js': `const { BasePortal } = require('./base-portal');

/**
 * Módulo para BBMNet (Bolsa Brasileira de Mercadorias)
 *
 * URL: https://www.bbmnet.com.br
 * Autenticação: Login + senha + certificado digital
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
    await this.preencherCampo('input[name*="login"], input[name*="usuario"], #txtLogin', this.credenciais.login);
    await this.preencherCampo('input[name*="senha"], #txtSenha', this.credenciais.senha);
    await this.page.evaluate(() => {
      const btn = [...document.querySelectorAll('input[type="submit"], button, a.btn')]
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
    await this.preencherCampo('input[name*="busca"], input[name*="numero"], #txtBusca', edital);
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(5000);
    await this.screenshot('bbmnet-disputa');
  }

  async lerMelhorLance() {
    return await this.page.evaluate(() => {
      const el = document.querySelector('.valor-lance, .melhor-lance, span.valor, td.lance');
      if (!el) return null;
      return parseFloat(el.textContent.replace(/[^\\d.,]/g, '').replace('.', '').replace(',', '.'));
    });
  }

  async enviarLance(valor) {
    console.log(\`📤 Enviando lance BBMNet: R$ \${this.formatarMoeda(valor)}\`);
    await this.preencherCampo('input[name*="lance"], input[name*="valor"], #txtLance', this.formatarMoeda(valor));
    await this.page.evaluate(() => {
      const btn = [...document.querySelectorAll('input[type="submit"], button, a.btn')]
        .find(b => (b.value || b.textContent || '').toLowerCase().includes('enviar'));
      if (btn) btn.click();
    });
    this.page.on('dialog', async d => await d.accept());
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
 * Módulo para Licitar Digital
 *
 * URL: https://www.licitardigital.com.br
 * Autenticação: Login + senha
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
    await this.preencherCampo('input[name="email"], input[name="login"]', this.credenciais.login);
    await this.preencherCampo('input[name="senha"], input[name="password"]', this.credenciais.senha);
    await this.page.evaluate(() => {
      const btn = [...document.querySelectorAll('button, input[type="submit"]')]
        .find(b => (b.textContent || b.value || '').toLowerCase().includes('entrar'));
      if (btn) btn.click();
    });
    await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    this.loggedIn = true;
    console.log('✅ Login no Licitar Digital realizado');
  }

  async navegarParaDisputa(edital) {
    await this.page.goto(\`\${this.baseUrl}/pregao?busca=\${encodeURIComponent(edital)}\`, { waitUntil: 'networkidle2' });
    await this.page.waitForTimeout(3000);
  }

  async lerMelhorLance() {
    return await this.page.evaluate(() => {
      const el = document.querySelector('.menor-lance, .melhor-lance, .valor-lance');
      if (!el) return null;
      return parseFloat(el.textContent.replace(/[^\\d.,]/g, '').replace('.', '').replace(',', '.'));
    });
  }

  async enviarLance(valor) {
    await this.preencherCampo('input[name="lance"], input[name="valor"]', this.formatarMoeda(valor));
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

module.exports = { LicitarDigitalPortal };
`,

  'src/portals/comprasnet-estadual.js': `const { BasePortal } = require('./base-portal');

/**
 * Módulo genérico para portais ComprasNet estaduais
 * (ComprasNet BA, ComprasNet GO, Compras MG, PE Integrado, etc.)
 *
 * Portais estaduais tipicamente compartilham uma estrutura similar,
 * diferindo apenas na URL base e alguns seletores.
 *
 * IDs suportados: comprasnet-ba, comprasnet-go, compras-mg, compras-pe,
 *                 compras-rj, compras-pr, compras-rs, compras-sc,
 *                 compras-df, e-compras-am, portal-compras-ce
 */
const PORTAIS_ESTADUAIS = {
  'comprasnet-ba': { nome: 'ComprasNet BA', url: 'https://www.comprasnet.ba.gov.br' },
  'comprasnet-go': { nome: 'ComprasNet GO', url: 'https://www.comprasgovernamentais.go.gov.br' },
  'compras-mg':    { nome: 'Compras MG', url: 'https://www.compras.mg.gov.br' },
  'compras-pe':    { nome: 'PE Integrado', url: 'https://www.peintegrado.pe.gov.br' },
  'compras-rj':    { nome: 'Compras RJ', url: 'https://www.compras.rj.gov.br' },
  'compras-pr':    { nome: 'Compras PR', url: 'https://www.comprasparana.pr.gov.br' },
  'compras-rs':    { nome: 'Compras RS', url: 'https://www.compras.rs.gov.br' },
  'compras-sc':    { nome: 'Compras SC', url: 'https://www.portaldecompras.sc.gov.br' },
  'compras-df':    { nome: 'e-Compras DF', url: 'https://www.compras.df.gov.br' },
  'e-compras-am':  { nome: 'e-Compras AM', url: 'https://www.ecompras.am.gov.br' },
  'portal-compras-ce': { nome: 'Compras CE', url: 'https://s2gpr.sefaz.ce.gov.br' },
};

class ComprasNetEstadualPortal extends BasePortal {
  constructor(page, credenciais, portalId) {
    super(page, credenciais);
    const config = PORTAIS_ESTADUAIS[portalId] || { nome: portalId, url: '' };
    this.nome = portalId;
    this.nomeExibicao = config.nome;
    this.baseUrl = config.url;
  }

  async login() {
    console.log(\`🔐 Iniciando login no \${this.nomeExibicao}...\`);
    await this.page.goto(\`\${this.baseUrl}/login\`, { waitUntil: 'networkidle2' });

    // Seletores genéricos que cobrem a maioria dos portais estaduais
    const loginSelectors = [
      'input[name="usuario"]', 'input[name="login"]', 'input[name="cpf"]',
      'input[name="email"]', '#usuario', '#login', '#cpf',
    ];
    const senhaSelectors = [
      'input[name="senha"]', 'input[name="password"]', '#senha', '#password',
    ];

    for (const sel of loginSelectors) {
      const found = await this.aguardarElemento(sel, 3000);
      if (found) { await this.preencherCampo(sel, this.credenciais.login); break; }
    }
    for (const sel of senhaSelectors) {
      const found = await this.aguardarElemento(sel, 3000);
      if (found) { await this.preencherCampo(sel, this.credenciais.senha); break; }
    }

    await this.page.evaluate(() => {
      const btn = [...document.querySelectorAll('button, input[type="submit"], a.btn')]
        .find(b => {
          const text = (b.textContent || b.value || '').toLowerCase();
          return text.includes('entrar') || text.includes('login') || text.includes('acessar');
        });
      if (btn) btn.click();
    });

    await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 });
    this.loggedIn = true;
    console.log(\`✅ Login no \${this.nomeExibicao} realizado\`);
  }

  async navegarParaDisputa(edital) {
    console.log(\`📋 Buscando edital \${edital} no \${this.nomeExibicao}\`);
    
    // Tentar navegar para área de pregões
    const pregaoUrls = [
      \`\${this.baseUrl}/pregao\`,
      \`\${this.baseUrl}/fornecedor/pregao\`,
      \`\${this.baseUrl}/licitacao/pregao\`,
    ];

    for (const url of pregaoUrls) {
      try {
        await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 10000 });
        break;
      } catch { continue; }
    }

    // Buscar edital
    const buscaSelectors = [
      'input[name="busca"]', 'input[name="numPregao"]', 'input[name="numero"]',
      '#busca', '#numPregao', 'input[type="search"]',
    ];
    for (const sel of buscaSelectors) {
      const found = await this.aguardarElemento(sel, 3000);
      if (found) {
        await this.preencherCampo(sel, edital);
        await this.page.keyboard.press('Enter');
        break;
      }
    }

    await this.page.waitForTimeout(5000);
    await this.screenshot(\`\${this.nome}-disputa\`);
  }

  async lerMelhorLance() {
    return await this.page.evaluate(() => {
      const seletores = [
        '.menor-lance', '.melhor-lance', '.valor-lance', '.lance-atual',
        'td.valor', 'td.lance', 'span.valor', '#melhorLance',
      ];
      for (const sel of seletores) {
        const el = document.querySelector(sel);
        if (el) {
          const texto = el.textContent.replace(/[^\\d.,]/g, '').replace('.', '').replace(',', '.');
          const num = parseFloat(texto);
          if (!isNaN(num)) return num;
        }
      }
      return null;
    });
  }

  async enviarLance(valor) {
    console.log(\`📤 Enviando lance \${this.nomeExibicao}: R$ \${this.formatarMoeda(valor)}\`);
    
    const lanceSelectors = [
      'input[name="lance"]', 'input[name="valor"]', 'input[name="valorLance"]',
      '#lance', '#valorLance', '#valor',
    ];
    for (const sel of lanceSelectors) {
      const found = await this.aguardarElemento(sel, 3000);
      if (found) {
        await this.preencherCampo(sel, this.formatarMoeda(valor));
        break;
      }
    }

    await this.page.evaluate(() => {
      const btn = [...document.querySelectorAll('button, input[type="submit"]')]
        .find(b => {
          const text = (b.textContent || b.value || '').toLowerCase();
          return text.includes('enviar') || text.includes('confirmar') || text.includes('lance');
        });
      if (btn) btn.click();
    });

    this.page.on('dialog', async d => await d.accept());
    await this.page.waitForTimeout(3000);
    await this.screenshot(\`lance-\${this.nome}\`);
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

// Export both the class and the config map
module.exports = { ComprasNetEstadualPortal, PORTAIS_ESTADUAIS };
`,
};
