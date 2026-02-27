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
 * Módulo de automação para o portal Compras.gov.br
 *
 * URL: https://www.gov.br/compras/pt-br
 * Autenticação: Certificado digital A1 (e-CPF/e-CNPJ) via gov.br
 *
 * Fluxo de disputa:
 * 1. Acessar gov.br e autenticar com certificado
 * 2. Navegar para Compras.gov > Área do Fornecedor
 * 3. Localizar a sessão de disputa pelo número do edital
 * 4. Ler valor do melhor lance na tabela de propostas
 * 5. Inserir novo lance no campo de valor
 * 6. Confirmar envio
 */
class ComprasGovPortal extends BasePortal {
  constructor(page, credenciais) {
    super(page, credenciais);
    this.nome = 'comprasgov';
    this.baseUrl = 'https://cnetmobile.estaleiro.serpro.gov.br';
    this.loginUrl = 'https://sso.acesso.gov.br';
  }

  async login() {
    console.log('🔐 Iniciando login no Compras.gov via gov.br...');
    await this.page.goto(this.loginUrl, { waitUntil: 'networkidle2' });

    // Selecionar login com certificado digital
    const certBtn = await this.aguardarElemento('[data-cert-login], .certificate-login, a[href*="certificado"]');
    if (!certBtn) {
      // Tentar via botão genérico de certificado
      await this.page.evaluate(() => {
        const links = [...document.querySelectorAll('a, button')];
        const certLink = links.find(el =>
          el.textContent.toLowerCase().includes('certificado') ||
          el.textContent.toLowerCase().includes('certificate')
        );
        if (certLink) certLink.click();
      });
    } else {
      await this.page.click('[data-cert-login], .certificate-login, a[href*="certificado"]');
    }

    // Aguardar autenticação mTLS (o navegador apresenta o certificado automaticamente)
    await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
    await this.screenshot('pos-login');

    // Verificar se login foi bem-sucedido
    const loggedIn = await this.page.evaluate(() => {
      return document.body.innerText.includes('Fornecedor') ||
             document.body.innerText.includes('Bem-vindo') ||
             document.body.innerText.includes('Painel');
    });

    if (!loggedIn) {
      throw new Error('Login no Compras.gov falhou — verifique o certificado digital');
    }

    this.loggedIn = true;
    console.log('✅ Login no Compras.gov realizado com sucesso');
  }

  async navegarParaDisputa(edital) {
    console.log(\`📋 Navegando para disputa do edital: \${edital}\`);
    await this.page.goto(\`\${this.baseUrl}/pregao/fornecedor\`, { waitUntil: 'networkidle2' });

    // Buscar pelo número do edital
    await this.preencherCampo('input[name="uasg"], input[name="numPregao"], #busca-pregao', edital);
    await this.page.keyboard.press('Enter');
    await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 });

    // Clicar na sessão de disputa
    const disputaLink = await this.aguardarElemento('a[href*="disputa"], .btn-disputa, td a');
    if (disputaLink) {
      await this.page.click('a[href*="disputa"], .btn-disputa, td a');
      await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    }

    await this.screenshot('disputa');
    console.log('✅ Na página de disputa');
  }

  async lerMelhorLance() {
    const valor = await this.page.evaluate(() => {
      // Tentar diferentes seletores usados pelo Compras.gov
      const seletores = [
        '.melhor-lance', '.menor-lance', '.valor-lance',
        'td.valor', '.lance-atual', '#melhorLance',
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

    if (valor === null) {
      console.warn('⚠️ Não foi possível ler o melhor lance atual');
    } else {
      console.log(\`💰 Melhor lance atual: R$ \${this.formatarMoeda(valor)}\`);
    }
    return valor;
  }

  async enviarLance(valor) {
    console.log(\`📤 Enviando lance: R$ \${this.formatarMoeda(valor)}\`);
    const valorStr = this.formatarMoeda(valor);

    // Preencher campo de lance
    const campoLance = 'input[name="valorLance"], input[name="lance"], #campoLance, input[type="text"][name*="lance"]';
    await this.preencherCampo(campoLance, valorStr);

    // Clicar no botão de enviar
    await this.page.evaluate(() => {
      const btns = [...document.querySelectorAll('button, input[type="submit"]')];
      const btn = btns.find(b =>
        b.textContent.toLowerCase().includes('enviar') ||
        b.value?.toLowerCase().includes('enviar') ||
        b.textContent.toLowerCase().includes('confirmar lance')
      );
      if (btn) btn.click();
    });

    // Aguardar diálogo de confirmação
    this.page.on('dialog', async dialog => {
      console.log(\`📌 Diálogo: \${dialog.message()}\`);
      await dialog.accept();
    });

    await this.page.waitForTimeout(3000);
    await this.screenshot('lance-enviado');
    console.log(\`✅ Lance de R$ \${valorStr} enviado\`);
    return true;
  }

  async verificarResultado() {
    return await this.page.evaluate(() => {
      const texto = document.body.innerText.toLowerCase();
      if (texto.includes('lance aceito') || texto.includes('lance registrado')) return 'aceito';
      if (texto.includes('lance recusado') || texto.includes('erro')) return 'recusado';
      return 'indefinido';
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
 */
const { ComprasGovPortal } = require('./comprasgov');
const { BLLPortal } = require('./bll');
const { LicitacoesEPortal } = require('./licitacoes-e');
const { PNCPPortal } = require('./pncp');
const { BECSPPortal } = require('./bec-sp');
const { LicitanetPortal } = require('./licitanet');
const { PortalComprasPortal } = require('./portal-compras');
const { BNCPortal } = require('./bnc');

const PORTALS = {
  'comprasgov': ComprasGovPortal,
  'bll': BLLPortal,
  'licitacoes-e': LicitacoesEPortal,
  'pncp': PNCPPortal,
  'bec-sp': BECSPPortal,
  'licitanet': LicitanetPortal,
  'portal-compras': PortalComprasPortal,
  'bnc': BNCPortal,
};

function getPortal(portalId, page, credenciais) {
  const PortalClass = PORTALS[portalId];
  if (!PortalClass) {
    throw new Error(\`Portal "\${portalId}" não suportado. Disponíveis: \${Object.keys(PORTALS).join(', ')}\`);
  }
  return new PortalClass(page, credenciais);
}

module.exports = { PORTALS, getPortal };
`,
};
