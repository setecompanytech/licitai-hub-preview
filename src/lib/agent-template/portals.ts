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

  /**
   * Abre o processo no portal.
   *
   * @param {string} edital
   * @param {{tipo?: 'item'|'lote', itens?: Array<object>}} [alvo] O QUE disputar
   *        dentro do processo. Opcional, e opcional de propósito: JavaScript
   *        ignora argumento a mais, então os 22 outros módulos de portal
   *        continuam válidos sem nenhuma edição — e nenhum deles passa a
   *        receber um parâmetro que não sabe usar.
   *
   *        Quem implementar o uso do alvo deve tratar \`alvo\` ausente como o
   *        comportamento de sempre: abrir o processo e parar aí.
   */
  async navegarParaDisputa(edital, alvo) {
    throw new Error(\`navegarParaDisputa() não implementado para portal \${this.nome}\`);
  }

  async lerMelhorLance() {
    throw new Error(\`lerMelhorLance() não implementado para portal \${this.nome}\`);
  }

  /**
   * As mensagens do pregoeiro, quando o portal tiver uma sala com chat.
   *
   * ─── POR QUE ISTO DEVOLVE VAZIO EM VEZ DE LANÇAR ERRO ──────────────────────
   *
   * Diferente de \`lerMelhorLance()\`, ler o chat é OPCIONAL: um portal sem chat
   * não é um portal quebrado. Lançar erro aqui faria a rodada inteira falhar
   * por causa de algo que nem sempre existe.
   *
   * Cada portal declara \`this.seletoresChat\` quando souber onde fica a
   * conversa. Sem isso, devolve vazio — e vazio significa "não sei ler", que é
   * diferente de "não há mensagem". Quem chama não deve concluir nada de uma
   * lista vazia.
   *
   * ─── O QUE FOI VERIFICADO, PARA NINGUÉM REFAZER ────────────────────────────
   *
   * Portal de Compras Públicas, 10/09/2026: a página do processo NÃO tem chat.
   * Uma sonda listou o menu inteiro e o único item de mensagem é "Impugnações"
   * (peça formal, não conversa); os iframes da página são de suporte e
   * analytics. O chat do pregoeiro vive na SALA DE DISPUTA, que só existe com
   * pregão acontecendo — mesma dependência externa do \`souLider()\`.
   *
   * Por isso o transporte está pronto e os seletores deste portal, não.
   * Preenchê-los sem ver a tela seria inventar, e seletor inventado falha em
   * silêncio: devolve vazio e parece "nenhuma mensagem".
   *
   * @returns {Promise<Array<{id: string, autor: string, texto: string}>>}
   */
  async lerMensagensChat() {
    const S = this.seletoresChat;
    if (!S || !S.lista) return [];

    try {
      return await this.page.evaluate((sel) => {
        const container = document.querySelector(sel.lista);
        if (!container) return [];
        const itens = container.querySelectorAll(sel.item);
        // As últimas primeiro, e um teto: a sala acumula a sessão inteira, e
        // reenviar cem mensagens a cada rodada entupiria o callback.
        return Array.from(itens).slice(-10).map((el, i) => ({
          id: el.getAttribute('id') || el.getAttribute('data-id') || \`pos-\${i}\`,
          autor: (el.querySelector(sel.autor)?.textContent || '').replace(/\\s+/g, ' ').trim(),
          texto: (el.querySelector(sel.texto)?.textContent || '').replace(/\\s+/g, ' ').trim(),
        })).filter((m) => m.texto);
      }, S);
    } catch {
      // Ler chat nunca derruba a sessão: é informação adicional, não a tarefa.
      return [];
    }
  }

  async enviarLance(valor) {
    throw new Error(\`enviarLance() não implementado para portal \${this.nome}\`);
  }

  async verificarResultado() {
    throw new Error(\`verificarResultado() não implementado para portal \${this.nome}\`);
  }

  /**
   * Estamos liderando a disputa?
   *
   * O ciclo de lance depende disto: lerMelhorLance() devolve o melhor lance
   * DA SESSAO, que e o nosso quando lideramos. Sem distinguir, o robo cobria o
   * proprio lance a cada rodada e descia o preco ate o piso sem nenhum
   * concorrente ter aparecido — o defeito mais caro achado na auditoria de
   * 02/09/2026.
   *
   * Devolver null quando o portal nao permite saber. A estrategia trata
   * null como "nao da para decidir" e AGUARDA, em vez de arriscar.
   *
   * @returns {Promise<boolean|null>}
   */
  async souLider() {
    return null;
  }

  /**
   * enviarProposta(dados) — OPCIONAL, e por isso NÃO declarado aqui.
   *
   * A rota POST /api/proposta/enviar checa \`typeof portal.enviarProposta ===
   * 'function'\` para responder 501 nomeando o portal que ainda não automatiza
   * o envio. Um stub nesta classe faria todos os portais parecerem prontos e o
   * erro só apareceria como 500 no meio de um pregão.
   *
   * Contrato de quem implementar:
   *   dados = {
   *     numero_pregao: 'PE-044/2026',
   *     itens: [{ numero, descricao, quantidade, unidade, valor_unitario,
   *               marca, modelo, fabricante }],
   *     declaracoes: { me_epp, inexistencia_fato, menor_aprendiz,
   *                    elaboracao_independente },
   *     anexos_urls: ['https://...'],
   *     empresa_id, credencial_id,
   *   }
   * Retorno: { protocolo?, comprovante? } — ambos opcionais.
   * Erro: lance uma Error com mensagem legível; a rota devolve 500 com ela e
   * um screenshot do estado da página.
   *
   * O login já foi feito pela rota antes da chamada.
   */

  /**
   * Digita no campo que a tela esta pedindo, e confirma.
   *
   * Existe porque em 09/09/2026 um codigo de verificacao do gov.br levava ~50s
   * para ir do celular ate o campo — WhatsApp, leitura, troca de aba, teclado
   * remoto — e o codigo vale ~60s. Tres tentativas queimaram e a conta do
   * cliente foi bloqueada por excesso de erro. Digitado daqui, o mesmo numero
   * chega em ~2 segundos.
   *
   * Fica no BasePortal, e nao no modulo do gov.br, porque o problema nao e do
   * gov.br: qualquer portal com SMS ou token cai nele.
   *
   * @returns {Promise<string|null>} o que foi feito, ou null se nao achou campo
   */
  async responderNaTela(valor) {
    const ondeDigitou = await this.page.evaluate((v) => {
      const visivel = (el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
      };
      const campos = [...document.querySelectorAll('input')].filter(
        (el) => visivel(el) && !el.disabled && !el.readOnly
          && ['text', 'tel', 'number', 'password', ''].indexOf((el.type || '').toLowerCase()) !== -1
      );
      if (!campos.length) return null;

      // O campo certo primeiro; o primeiro visivel so como ultimo recurso.
      const pista = (el) => (el.name || '') + ' ' + (el.id || '') + ' '
        + (el.placeholder || '') + ' ' + (el.getAttribute('aria-label') || '');
      const alvo = campos.find((el) => /c[oó]digo|token|otp|mfa|verifica/i.test(pista(el))) || campos[0];

      alvo.focus();
      // Campo com resto da tentativa anterior faz o codigo virar 12 digitos.
      alvo.value = '';
      // Angular e React so enxergam valor que chega por evento; atribuir direto
      // preenche a tela e deixa o estado interno vazio.
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(alvo, v);
      alvo.dispatchEvent(new Event('input', { bubbles: true }));
      alvo.dispatchEvent(new Event('change', { bubbles: true }));
      return (alvo.id || alvo.name || alvo.placeholder || 'campo sem nome');
    }, String(valor));

    if (!ondeDigitou) return null;

    // Confirmar: botao com rotulo de confirmacao, e Enter como reserva.
    const clicou = await this.page.evaluate(() => {
      const botoes = [...document.querySelectorAll('button, input[type=submit]')];
      const b = botoes.find((el) => /continuar|confirmar|enviar|validar|entrar|avan[cç]ar/i
        .test((el.textContent || el.value || '')));
      if (b) { b.click(); return (b.textContent || b.value || '').trim().slice(0, 30); }
      return null;
    });

    if (!clicou) await this.page.keyboard.press('Enter');
    return 'campo "' + ondeDigitou + '"' + (clicou ? ' + botao "' + clicou + '"' : ' + Enter');
  }

  /** A aba ainda responde? Fechada, ou com o frame principal morto, nao. */
  abaMorta(p) {
    try {
      if (!p || p.isClosed()) return true;
      const f = p.mainFrame();
      return !f || f.detached === true;
    } catch (e) { return true; }
  }

  /**
   * Segunda versao (10/09/2026, 15:43). A primeira so olhava \`isClosed()\`, e
   * a sessao a0a42536 morreu com a aba ABERTA: o Chrome 153 trocou o processo
   * da aba na volta do gov.br para o comprasnet, o alvo do CDP fechou
   * ("Target closed") e o frame que o Puppeteer 22 segurava ficou morto
   * ("detached Frame") — e a guarda nem disparou. Agora:
   *   - aba morta = fechada OU frame principal descolado;
   *   - ao morrer, o log lista os alvos do navegador naquele instante (o
   *     diagnostico que faltou hoje);
   *   - candidata e a ultima aba viva que nao seja about:blank nem o aviso do
   *     Sicaf (/popup/), que o comprasnet abre depois do login;
   *   - sem candidata, abre uma aba NOVA: os cookies sao do navegador, nao da
   *     aba, entao a sessao do portal continua valida nela;
   *   - com \`urlDeRetorno\`, uma aba vazia ou de aviso e levada ate la.
   */
  async adotarAbaViva(motivo, opcoes) {
    const destino = opcoes && opcoes.urlDeRetorno;
    const rotulo = motivo ? ' (' + motivo + ')' : '';
    const ehAvisoOuVazia = (p) => {
      let u = ''; try { u = p.url() || ''; } catch (e) { u = ''; }
      return !u || u === 'about:blank' || /\\/popup\\//i.test(u);
    };
    const morta = this.abaMorta(this.page);

    if (!morta) {
      if (destino && ehAvisoOuVazia(this.page)) {
        console.log('🔀 Estou numa aba de aviso/vazia' + rotulo + ' (' + this.page.url() + ') — indo para ' + destino);
        await this.page.goto(destino, { waitUntil: 'networkidle2', timeout: 45000 })
          .catch((e) => console.warn('⚠️ Nao consegui abrir ' + destino + ': ' + e.message));
        return true;
      }
      return false;
    }

    const browser = this.page.browser();
    let alvos = [];
    try { alvos = browser.targets().map((t) => t.type() + ' ' + (t.url() || '-')); } catch (e) { /* diagnostico */ }
    console.log('🧯 A aba em uso morreu' + rotulo + ' — alvos no navegador agora: '
      + (alvos.length ? alvos.join(' | ') : 'nenhum'));

    const vivas = (await browser.pages()).filter((p) => p !== this.page && !this.abaMorta(p));
    let nova = vivas.filter((p) => !ehAvisoOuVazia(p)).pop() || vivas.pop() || null;
    let como;
    if (nova) {
      como = 'seguindo na aba viva: ' + nova.url();
    } else {
      nova = await browser.newPage();
      como = 'nenhuma aba viva servia; abri uma nova';
    }
    this.page = nova;
    if (destino && ehAvisoOuVazia(nova)) {
      console.log('🔀 ' + como + ' — indo para ' + destino);
      await nova.goto(destino, { waitUntil: 'networkidle2', timeout: 45000 })
        .catch((e) => console.warn('⚠️ Nao consegui abrir ' + destino + ': ' + e.message));
    } else {
      console.log('🔀 ' + como);
    }
    try { await nova.bringToFront(); } catch (e) { /* so conforto visual no VNC */ }
    return true;
  }

  /**
   * O texto visivel da tela, somando TODOS os frames. Paginas antigas em
   * frameset (o intro.htm do Comprasnet, 10/09/2026) tem o documento de cima
   * vazio — o conteudo mora nos frames filhos, e document.body.innerText do
   * topo nao ve nada. Frame que nao responde entra como vazio, nunca derruba.
   */
  async textoDaTela() {
    const partes = [];
    for (const f of this.page.frames()) {
      const t = await f
        .evaluate(() => (document.body && document.body.innerText) || '')
        .catch(() => '');
      if (t && t.trim()) partes.push(t);
    }
    return partes.join('\\n');
  }

  /**
   * Raio-X da tela, para virar seletor depois: URL, titulo e, para cada frame,
   * o texto visivel, os campos (input/select/textarea/button) com atributos,
   * cada valor em reais com o CAMINHO no DOM ate ele, e as tabelas com
   * cabecalho e primeiras linhas. A foto mostra a sala; isto diz como le-la.
   *
   * Existe porque a sala de disputa so aparece com pregao em sessao, num
   * horario que nao escolhemos — e quem mapeia precisa do DOM daquele
   * segundo, nao de uma imagem. O gravador da sessao chama isto a cada N
   * segundos; a rota /sessao/:id/inspecionar chama sob demanda.
   *
   * Nunca lanca: frame que nao responde entra vazio. So leitura.
   */
  async inspecionarTela(opcoes) {
    const maxTexto = (opcoes && opcoes.maxTexto) || 20000;
    const saida = { quando: new Date().toISOString(), url: '', titulo: '', frames: [] };
    try { saida.url = this.page.url(); } catch (e) { /* aba morta */ }
    try { saida.titulo = await this.page.title(); } catch (e) { /* idem */ }
    let frames = [];
    try { frames = this.page.frames(); } catch (e) { frames = []; }

    for (const f of frames) {
      const dados = await f.evaluate((maxTexto) => {
        const visivel = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
        const caminho = (el) => {
          const partes = [];
          let n = el;
          for (let i = 0; n && n !== document.body && n.tagName && i < 6; i++) {
            let s = n.tagName.toLowerCase();
            if (n.id) s += '#' + n.id;
            else if (typeof n.className === 'string' && n.className.trim()) s += '.' + n.className.trim().split(/\\s+/).slice(0, 2).join('.');
            partes.unshift(s);
            n = n.parentElement;
          }
          return partes.join(' > ');
        };
        const attrs = (el) => {
          const o = {};
          for (const a of el.attributes) {
            if (a.name.startsWith('_ng') || a.value.length > 200) continue;
            o[a.name] = a.value;
          }
          return o;
        };
        const campos = [...document.querySelectorAll('input, select, textarea, button, a[role="button"], [role="button"]')]
          .slice(0, 400)
          .map((el) => ({
            tag: el.tagName.toLowerCase(),
            tipo: el.type || null,
            visivel: visivel(el),
            texto: String(el.innerText || el.value || '').trim().slice(0, 80),
            caminho: caminho(el),
            attrs: attrs(el),
          }));

        // Cada "R$ 1.234,56" com o caminho ate ele: e por aqui que se descobre
        // qual celula e o melhor lance e qual e o nosso.
        const reais = [];
        const andarilho = document.createTreeWalker(document.body || document, NodeFilter.SHOW_TEXT);
        let no;
        while ((no = andarilho.nextNode()) && reais.length < 80) {
          const t = no.nodeValue || '';
          if (/R\\$\\s?[\\d.]+,\\d{2}/.test(t)) {
            const el = no.parentElement;
            reais.push({ texto: t.trim().slice(0, 80), caminho: el ? caminho(el) : '', visivel: el ? visivel(el) : false });
          }
        }

        const tabelas = [...document.querySelectorAll('table')].slice(0, 12).map((t) => ({
          caminho: caminho(t),
          cabecalho: [...t.querySelectorAll('th')].map((th) => th.innerText.trim().slice(0, 40)).slice(0, 20),
          linhas: [...t.querySelectorAll('tr')].slice(0, 5).map((tr) => [...tr.children].map((td) => td.innerText.trim().slice(0, 40))),
        }));

        const texto = (document.body && document.body.innerText) || '';
        return { url: location.href, texto: texto.slice(0, maxTexto), campos, reais, tabelas };
      }, maxTexto).catch(() => null);
      if (dados) saida.frames.push(dados);
    }
    return saida;
  }

  async screenshot(nome) {
    const path = \`./logs/screenshots/\${this.nome}-\${nome}-\${Date.now()}.png\`;
    // Screenshot e diagnostico, nunca causa de morte: se a aba trocou, tira
    // da viva; se nem isso der, registra e segue.
    try {
      await this.adotarAbaViva('antes do screenshot ' + nome);
      await this.page.screenshot({ path, fullPage: false });
    } catch (e) {
      console.warn('⚠️ Screenshot ' + nome + ' nao saiu: ' + e.message);
      return null;
    }
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
const interacao = require('../interacao-humana');

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
 * URL do fornecedor (pós-login): /comprasnet-web/seguro/fornecedor (a confirmar via VNC)
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
    // A porta de entrada NAO e o SSO direto. VERIFICADO em 09/09/2026: o botao
    // "Efetuar Login" do proprio portal leva para uma pagina ASP, e e ela que
    // monta a chamada ao SSO com os parametros certos.
    //
    // QUAL pagina importa, e foi o defeito de 10/09/2026: a tela "Acesse sua
    // Conta" tem tres perfis, e loginPortal.js manda cada um para uma ASP —
    // mudaPerfilBotao(1) -> loginPortalFornecedor.asp, (2) -> loginPortalUASG.asp
    // (Governo). O modulo apontava para a do GOVERNO. O gov.br autenticava o
    // certificado normalmente, mas na volta o Compras.gov procurava o CPF no
    // senha-rede (diretorio de SERVIDORES) e respondia 422 "Nao foi possivel
    // recuperar o usuario no senha-rede". A empresa e fornecedora.
    this.portaLogin = 'https://www.comprasnet.gov.br/seguro/loginPortalFornecedor.asp';
    // Endpoint /authorize (nao /login) e client_id "comprasnet.gov.br" (nao
    // "compras.gov.br"). Com a forma antiga o gov.br acusa "cookies
    // desabilitados" — sintoma de sessao invalida, nao de cookie — e o
    // formulario nunca submete.
    //
    // state=F, nao G. E o unico parametro que muda entre os perfis, e e por ele
    // que o landing_sso.asp decide em qual diretorio procurar quem voltou do
    // gov.br: F = Fornecedor (SICAF), G = Governo (senha-rede). Copiado do
    // onclick de "Entrar com Gov.br" da loginPortalFornecedor.asp em 10/09/2026.
    this.loginUrl = 'https://sso.acesso.gov.br/authorize'
      + '?response_type=code&client_id=comprasnet.gov.br'
      + '&scope=openid+profile+email+phone+govbr_confiabilidades&state=F'
      + '&redirect_uri=https://www.comprasnet.gov.br/seguro/landing_sso.asp';
    this.certLoginUrl = 'https://certificado.sso.acesso.gov.br';
    this.publicUrl = 'https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/public/compras';
    // Quantos segundos esperar por um clique humano no VNC quando o captcha
    // barrar o caminho. Zero desliga a espera e faz falhar na hora.
    this.segundosEsperaHumano = Number(process.env.SEGUNDOS_ESPERA_HUMANO || 180);
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
    await new Promise((r) => setTimeout(r, ms));
  }

  /**
   * O agente tem certificado apresentavel neste momento?
   *
   * Carregado sob demanda e com rede de protecao: instalacoes antigas do agente
   * nao tem o modulo de certificado, e a falta dele nao pode derrubar o login —
   * so torna a mensagem menos precisa.
   */
  temCertificadoInstalado() {
    try {
      return require('../certificado').estado().carregado === true;
    } catch (e) {
      return false;
    }
  }

  /**
   * O que aconteceu depois do clique em "Seu certificado digital".
   *
   * Tres desfechos sao possiveis e so um e sucesso:
   *
   *   autenticado     — saiu do dominio acesso.gov.br: o gov.br aceitou
   *   sem-certificado — parou em /info/x509, "Certificado digital nao encontrado"
   *   recusado        — voltou para a propria tela de login do SSO
   *
   * Ler o desfecho em vez de esperar "uma navegacao qualquer" e o que permite
   * dizer a causa. Verificado em 09/09/2026: com a base NSS vazia, o clique faz
   * sso.acesso.gov.br -> servicos.acesso.gov.br -> sso.acesso.gov.br/login.
   *
   * A carencia existe por causa desse vai-e-volta: concluir "recusado" na
   * primeira leitura pegaria o meio do caminho e chamaria de falha um login que
   * ainda estava acontecendo.
   */
  async esperarDesfechoDoCertificado(timeout = 30000) {
    const inicio = Date.now();
    const CARENCIA_MS = 8000;
    let leiturasNoLogin = 0;

    while (Date.now() - inicio < timeout) {
      // A volta do gov.br pode trocar de aba (ver adotarAbaViva). Sem isto o
      // laco leria para sempre a URL congelada de uma aba que nao existe mais.
      await this.adotarAbaViva('na volta do certificado');
      const url = this.page.url();

      if (url.indexOf('/info/x509') !== -1) return 'sem-certificado';

      const semCertificado = await this.page
        .evaluate(() =>
          /certificado digital n[ãa]o encontrado/i.test(
            document.body ? document.body.innerText : ''
          )
        )
        .catch(() => false);
      if (semCertificado) return 'sem-certificado';

      let host = '';
      try { host = new URL(url).hostname; } catch (e) { host = ''; }

      // Sair do dominio do login e o unico sinal positivo: o gov.br devolve o
      // navegador ao sistema que pediu a autenticacao.
      if (host && !/acesso\\.gov\\.br$/.test(host)) return 'autenticado';

      if (url.indexOf('/login') !== -1 && Date.now() - inicio > CARENCIA_MS) {
        // Duas leituras seguidas na tela de login: nao e mais o vai-e-volta.
        if (++leiturasNoLogin >= 2) return 'recusado';
      } else {
        leiturasNoLogin = 0;
      }

      await new Promise((r) => setTimeout(r, 1500));
    }

    return 'recusado';
  }

  /**
   * Retry wrapper para operações instáveis
   */
  async comRetry(fn, descricao, tentativas = this.maxRetries) {
    for (let i = 1; i <= tentativas; i++) {
      try {
        return await fn();
      } catch (err) {
        // Falha deterministica nao se resolve repetindo. Certificado ausente
        // continua ausente na terceira tentativa — e o unico efeito de insistir
        // e transformar 10 segundos de diagnostico em tres minutos de espera.
        if (err.semRetry) throw err;
        console.warn(\`⚠️ [\${descricao}] Tentativa \${i}/\${tentativas} falhou: \${err.message}\`);
        if (i === tentativas) throw err;
        await new Promise((r) => setTimeout(r, this.retryDelay * i));
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
      // 1. Ir direto ao SSO com os parametros que o proprio portal usa.
      //
      // A versao anterior abria a pagina publica e cacava um link "Acessar" que
      // nao existe — o portal e um SPA Angular cuja home publica so tem busca.
      // Depois caia num fallback para sso.acesso.gov.br sem parametro nenhum, e
      // ali o gov.br responde "cookies desabilitados" e nao submete nada.
      await this.page.goto(this.loginUrl, { waitUntil: 'networkidle2', timeout: 45000 });
      await this.delayHumano(600, 1400);

      if (!this.page.url().includes('acesso.gov.br')) {
        // Caminho longo, para o caso de o /authorize mudar: entrar pela pagina
        // do portal e deixar que ELA monte a chamada.
        console.log('↩️  SSO nao respondeu direto — entrando pela pagina do portal');
        await this.page.goto(this.portaLogin, { waitUntil: 'networkidle2', timeout: 45000 });
        await this.delayHumano(600, 1200);
        await this.page.evaluate(() => {
          const el = [...document.querySelectorAll('a, button, input')]
            .find((e) => /Entrar com Gov\\.br/i.test(e.textContent || e.value || ''));
          if (el) el.click();
        });
        await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
      }

      await this.delayHumano(500, 1200);
      await this.screenshot('sso-gov-br');

      // O aviso de cookie e o sinal de que a URL do SSO esta malformada. Dizer
      // isso aqui evita procurar defeito no navegador.
      const avisoCookie = await this.page.evaluate(() =>
        /cookies do seu browser/i.test(document.body.innerText || ''));
      if (avisoCookie) {
        const e = new Error(
          'O gov.br respondeu "cookies desabilitados", o que indica sessao SSO invalida — '
          + 'confira client_id e authorization_id da URL de login.'
        );
        e.semRetry = true;
        throw e;
      }

      // 2. CPF, quando houver. E um caminho alternativo ao certificado, nao um
      //    pre-requisito dele.
      const cpfField = await this.aguardarElemento('#accountId', 8000);
      if (cpfField && this.credenciais.cpf) {
        await this.preencherCampo('#accountId', this.credenciais.cpf);
        await this.delayHumano(300, 600);
        await this.verificarHCaptcha();
        await this.page.click('#enter-account-id');
        await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
        await this.delayHumano(500, 1000);
      }

      // 3. Selecionar certificado digital.
      // Seletor VERIFICADO: #login-certificate — e um <button name="operation"
      // value="login-certificate"> com formaction para certificado.sso.acesso.gov.br.
      const certButton = await this.aguardarElemento('#login-certificate', 8000);
      if (!certButton) {
        const e = new Error('Botao de certificado digital nao encontrado na tela do gov.br');
        e.semRetry = true;
        throw e;
      }

      // Antes de tentar, saber se ha o que apresentar. Sem isto, "nao entrou"
      // vira uma frase generica que manda conferir a validade de um
      // certificado que pode nem existir.
      if (!this.temCertificadoInstalado()) {
        const e = new Error(
          'Nao ha certificado digital instalado no navegador do agente. ' +
          'Envie o certificado A1 (.pfx) pela tela do Robo de Lances — o A3, de token ou cartao, nao serve.'
        );
        e.semRetry = true;
        throw e;
      }

      console.log('📜 Clicando em "Seu certificado digital"...');
      await this.page.evaluate(() =>
        document.querySelector('#login-certificate').scrollIntoView({ block: 'center' }));
      await this.delayHumano(400, 900);
      await this.page.click('#login-certificate').catch(() => {});

      let desfecho = await this.esperarDesfechoDoCertificado(20000);

      // ─── O clique humano, quando o captcha barra o automatico ───────────
      if (desfecho !== 'autenticado' && this.segundosEsperaHumano > 0) {
        await this.screenshot('aguardando-clique-humano');
        console.log('');
        console.log('🧑 ═══════════════════════════════════════════════════════════');
        console.log('🧑  PRECISO DE UM CLIQUE HUMANO');
        console.log('🧑');
        console.log('🧑  A pagina do gov.br roda hCaptcha, e o botao do certificado');
        console.log('🧑  so submete com um gesto de pessoa. O certificado JA esta');
        console.log('🧑  instalado e sera apresentado sozinho depois do clique.');
        console.log('🧑');
        console.log('🧑  Abra a aba Agente Cloud > tela remota (VNC) e clique em');
        console.log('🧑  "Seu certificado digital".');
        console.log('🧑');
        console.log('🧑  Esperando ate ' + this.segundosEsperaHumano + 's...');
        console.log('🧑 ═══════════════════════════════════════════════════════════');
        console.log('');

        // O pedido nasce da TELA, nao de configuracao. Se o cliente desligar a
        // verificacao em duas etapas, este ramo simplesmente nao acontece e
        // nenhuma interface mostra campo nenhum.
        interacao.pedir(this.sessaoId, {
          expira_em: new Date(Date.now() + this.segundosEsperaHumano * 1000).toISOString(),
          tipo: 'captcha',
          mensagem: 'Abra a tela remota (VNC) e clique em "Seu certificado digital". '
            + 'A pagina do gov.br exige esse gesto por causa do hCaptcha — o certificado ja esta '
            + 'instalado e sera apresentado sozinho depois do clique.',
          tela: 'gov.br — escolha de identificacao',
        });

        let limite = Date.now() + this.segundosEsperaHumano * 1000;
        let avisou = 0;
        let ultimaUrl = this.page.url();

        while (Date.now() < limite) {
          await new Promise((r) => setTimeout(r, 2000));
          // Mesma razao do laco automatico: a volta do gov.br pode trocar de aba.
          await this.adotarAbaViva('na volta do certificado (clique humano)');
          const agora = this.page.url();

          if (!agora.includes('acesso.gov.br')) {
            console.log('🧑 ✅ Autenticado — o login saiu do gov.br');
            desfecho = 'autenticado';
            interacao.resolver(this.sessaoId, 'atendido');
            break;
          }

          // AVANCO DENTRO DO PROPRIO GOV.BR.
          //
          // Medido em 09/09/2026: depois do clique humano o gov.br pede
          // confirmacao de identidade, e essa tela continua em acesso.gov.br. A
          // versao anterior so perguntava "ja saiu do dominio?", entao seguia
          // dizendo "esperando o clique" com a tela ja adiantada — e matava o
          // navegador no meio do fluxo quando o relogio acabava.
          if (agora !== ultimaUrl) {
            ultimaUrl = agora;
            await this.screenshot('govbr-avancou');
            const tela = await this.page
              .evaluate(() => (document.body.innerText || '').replace(/\\s+/g, ' ').slice(0, 220))
              .catch(() => '');
            console.log('🧑 ➡️  A tela avancou: ' + agora.slice(0, 130));
            if (tela) console.log('🧑     ' + tela);
            // Cada avanco renova o relogio: quem esta digitando um codigo de
            // verificacao precisa de mais tempo, nao de menos.
            // O que ESTA tela pede agora — pode ter mudado de captcha para codigo.
            const pedido = interacao.classificarTela(tela);
            if (pedido) {
              const atual = interacao.pendente(this.sessaoId);
              if (!atual || atual.tipo !== pedido.tipo) {
                interacao.pedir(this.sessaoId, {
                  ...pedido,
                  tela: String(tela).slice(0, 220),
                  expira_em: new Date(Date.now() + this.segundosEsperaHumano * 1000).toISOString(),
                });
                console.log('🧑 📋 Agora preciso de: ' + pedido.tipo);
              }
            }

            limite = Date.now() + this.segundosEsperaHumano * 1000;
            interacao.renovar(this.sessaoId, new Date(limite).toISOString());
            avisou = 0;
          }

          // A resposta de uma pessoa, quando chega pela rota /sessao/responder.
          // Digitada daqui, e nao pelo teclado remoto, ela chega ao campo antes
          // de o codigo expirar.
          const resposta = interacao.colher(this.sessaoId);
          if (resposta) {
            const onde = await this.responderNaTela(resposta).catch(() => null);
            console.log(onde
              ? '🧑 ⌨️  Resposta digitada e enviada — ' + onde
              : '🧑 ⚠️  Recebi a resposta mas nao achei onde digitar nesta tela');
            limite = Date.now() + this.segundosEsperaHumano * 1000;
            interacao.renovar(this.sessaoId, new Date(limite).toISOString());
          }

          const faltam = Math.round((limite - Date.now()) / 1000);
          if (faltam > 0 && faltam % 30 === 0 && faltam !== avisou) {
            avisou = faltam;
            console.log('🧑 ainda esperando no VNC — ' + faltam + 's restantes');
          }
        }
      }

      if (desfecho !== 'autenticado') {
        // A causa nao e o certificado, e dizer que e manda a pessoa procurar
        // defeito onde nao ha. Em 09/09/2026 ficou provado que o gov.br ACEITA
        // este certificado: o handshake mTLS fecha com "Verify return code: 0".
        const erro = new Error(
          'O login do gov.br nao foi concluido. O certificado esta instalado e valido — ' +
          'o que falta e o clique em "Seu certificado digital", que a pagina so aceita ' +
          'de uma pessoa por causa do hCaptcha. Abra a tela remota (VNC) na aba Agente ' +
          'Cloud ANTES de enviar ao robo e clique nesse botao quando ele aparecer.'
        );
        erro.semRetry = true;
        throw erro;
      }

      await this.delayHumano(1000, 2000);

      // A volta do gov.br e onde a aba morre (15:43 de 10/09/2026): reatar
      // AQUI, antes do primeiro evaluate pos-login. Se a aba viva for o aviso
      // do Sicaf, vai ate a porta do fornecedor — logado, ela leva a area.
      await this.adotarAbaViva('apos autenticar', { urlDeRetorno: this.portaLogin });

      // Verificar hCaptcha pós-certificado
      await this.verificarHCaptcha();

      await this.screenshot('pos-login-sso');
    }, 'login-sso');

    // Daqui em diante tudo e na aba em que o portal ficou — que pode nao ser
    // a que abriu o login.
    await this.adotarAbaViva('depois do login', { urlDeRetorno: this.portaLogin });

    // 4. Verificar se precisa autorizar acesso ao Compras.gov
    const textoPosLogin = (await this.textoDaTela()).toLowerCase();
    const needsAuth = textoPosLogin.includes('autorizar') || textoPosLogin.includes('permitir acesso');

    if (needsAuth) {
      console.log('📋 Autorizando acesso ao Compras.gov...');
      await this.page.evaluate(() => {
        const btn = [...document.querySelectorAll('button, input[type="submit"]')]
          .find(b => (b.textContent || b.value || '').toLowerCase().includes('autorizar'));
        if (btn) btn.click();
      });
      await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    }

    // 5. Ficar onde o SSO deixou.
    //
    // VERIFICADO em 10/09/2026, sessao 8c761be3 (disparada pela tela, com o
    // clique humano no VNC): depois do gov.br o landing_sso.asp entrega a
    // "Area de Trabalho do Fornecedor Brasileiro" em www.comprasnet.gov.br —
    // cabecalho Compras.gov.br / SICAF / Contratos.gov.br, CNPJ e nome da
    // empresa, usuario, menu Dados Cadastrais | Compras | SICAF | Contratos |
    // Sair, "Placar de Licitacoes". ESSA e a area logada.
    //
    // A versao anterior saia dela para testar quatro URLs chutadas no host do
    // SPA (/comprasnet-web/seguro/fornecedor e afins). Todas respondem 404
    // hoje, e o robo terminava parado numa "Pagina nao encontrada" com o
    // login ja feito. Nao ha para onde ir aqui: a navegacao ate a compra e
    // assunto de navegarParaDisputa.
    console.log('🏠 Area logada em: ' + this.page.url());

    // 6. Verificar login bem-sucedido.
    //
    // Primeiro o que e FALHA com cara de pagina normal. Em 10/09/2026 o
    // Compras.gov devolveu a tela "Acesse sua Conta" com um aviso vermelho
    // (422 do senha-rede) e a checagem antiga declarou sucesso, porque
    // procurava a palavra "Compras" — que esta no logo de toda pagina do
    // portal, inclusive a de login. Falso positivo custa mais que falha: o
    // robo seguiu para buscar edital numa tela onde nao estava logado.
    // Le TODOS os frames: a area logada (intro.htm) e um frameset, e a sessao
    // 8abf4f67 (10/09/2026, 16:26) foi recusada com a Area de Trabalho na tela
    // porque o documento de cima nao tem texto nenhum.
    const diagnostico = (() => {
      const body = textoPosLogin;
      const aviso = body.match(/n[aã]o foi poss[ií]vel recuperar o usu[aá]rio[^\\n]*/i);
      if (aviso) return { ok: false, motivo: aviso[0].trim() };
      if (/acesse sua conta/i.test(body) && /selecione o perfil/i.test(body)) {
        return { ok: false, motivo: 'o Compras.gov voltou para a escolha de perfil sem entrar' };
      }
      // Palavras que so existem DENTRO — "Compras" sozinha nao vale, esta no logo.
      // As tres primeiras sao da "Area de Trabalho do Fornecedor Brasileiro",
      // lidas da tela real em 10/09/2026.
      const dentro = /[aá]rea de trabalho do fornecedor|placar de licita[cç][oõ]es|dados cadastrais|bem-vindo|painel|meus preg[oõ]es|em disputa|abertas para participa[cç][aã]o|\\bsair\\b|minha conta/i.test(body);
      return dentro ? { ok: true } : { ok: false, motivo: 'a pagina nao tem nenhum sinal de area logada' };
    })();

    if (!diagnostico.ok) {
      await this.screenshot('login-falha');
      throw new Error('Login no Compras.gov falhou: ' + diagnostico.motivo
        + '. Se o aviso citar senha-rede, o portal tentou resolver o CPF como servidor publico — '
        + 'confira que o SSO esta sendo chamado com state=F (fornecedor).');
    }

    this.loggedIn = true;
    console.log('✅ Login no Compras.gov realizado com sucesso');
  }

  /**
   * O numero da compra no formato do formulario publico: numero e ano colados,
   * sem barra nem zeros a esquerda — o campo diz "Ex: 102021" e o title,
   * "Digite o numero e ano da compra". "90012/2024" vira "900122024". Um
   * edital sem numero/ano (o TESTE-COMPRASGOV de 10/09/2026) nao tem como
   * ser buscado, e o erro diz isso antes de abrir pagina nenhuma.
   */
  numeroDaCompra(edital) {
    const m = String(edital || '').match(/(\\d{1,6})\\s*\\/\\s*(\\d{4})/);
    if (m) return { campo: String(parseInt(m[1], 10)) + m[2], rotulo: parseInt(m[1], 10) + '/' + m[2] };
    return null;
  }

  /**
   * O que a pesquisa devolveu: 'resultados', 'nenhum', 'captcha' ou 'nada'
   * (ainda carregando). Lido do texto e do DOM — os cards nao tem classe
   * estavel, mas todo card comeca com a modalidade e "N° numero/ano".
   */
  async lerDesfechoDaBusca() {
    return this.page.evaluate(() => {
      const texto = document.body.innerText || '';
      // A resposta da pesquisa manda, antes de qualquer captcha: o iframe do
      // hCaptcha continua no DOM, com tamanho, depois de resolvido (so fica
      // invisivel), e olhar para ele primeiro deixava o robo "esperando o
      // captcha" com os resultados na tela (sessao dab1837b, 14/09/2026).
      if (/(PREG[AÃ]O|DISPENSA|CONCORR[EÊ]NCIA|LEIL[AÃ]O)[^\\n]*N[°º]\\s*\\d+\\/\\d{4}/i.test(texto)) return 'resultados';
      // "Nenhuma compra encontrada" e o texto real da pagina (14/09/2026,
      // sessao 903d686e); sem ele aqui o robo ficava "esperando o captcha"
      // com a resposta na tela.
      if (/nenhuma? (registro|resultado|compra)|n[aã]o (foram|foi) encontrad/i.test(texto)) return 'nenhum';
      const visivel = (el) => {
        for (let e = el; e && e !== document.body; e = e.parentElement) {
          const s = getComputedStyle(e);
          if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
        }
        return true;
      };
      const captcha = [...document.querySelectorAll('iframe[src*="hcaptcha"]')]
        .some((f) => { const r = f.getBoundingClientRect(); return r.width > 50 && r.height > 50 && visivel(f); });
      if (captcha) return 'captcha';
      return 'nada';
    }).catch(() => 'nada');
  }

  /**
   * Digita num campo PrimeNG (p-inputmask) e CONFERE o que ficou.
   *
   * O InputMask intercepta cada tecla e reposiciona o cursor pelo proprio
   * buffer; com as teclas sinteticas do Puppeteer ele embaralha — "72026"
   * virou "20267" na sessao 903d686e (14/09/2026), e a pesquisa voltou
   * "Nenhuma compra encontrada" sem ninguem saber por que. Aqui: digita como
   * pessoa, le o valor de volta e, se nao bater, entrega o texto inteiro de
   * uma vez (como um colar), que a mascara valida pelo evento input. Devolve
   * o que ficou no campo, para o log dizer a verdade.
   */
  async digitarConferindo(seletor, valor) {
    const alvo = String(valor);
    // Com o campo focado a mascara mostra as posicoes vazias como "_"
    // ("72026____"); so o que a pessoa digitou conta.
    const ler = () => this.page.$eval(seletor, (el) => (el.value || '').replace(/[_\\s]/g, '')).catch(() => '');
    await this.page.click(seletor, { clickCount: 3 });
    await this.page.keyboard.press('Backspace');
    await this.page.type(seletor, alvo, { delay: 70 });
    let lido = await ler();
    if (lido !== alvo) {
      await this.page.$eval(seletor, (el) => {
        el.focus();
        el.setSelectionRange(0, (el.value || '').length);
      }).catch(() => {});
      await this.page.keyboard.press('Backspace');
      // sendCharacter = Input.insertText do CDP: entra como um colar, sem
      // keydown/keypress para a mascara interceptar.
      await this.page.keyboard.sendCharacter(alvo);
      await this.delayHumano(200, 400);
      lido = await ler();
    }
    if (lido !== alvo) {
      await this.page.$eval(seletor, (el, v) => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
      }, alvo).catch(() => {});
      await this.delayHumano(200, 400);
      lido = await ler();
    }
    if (lido !== alvo) {
      console.warn('⚠️ O campo ' + seletor + ' ficou com "' + lido + '" em vez de "' + alvo + '"');
    }
    return lido;
  }

  /**
   * Segunda versao (10/09/2026, 16:40). A primeira tentava 12 seletores
   * chutados, nao achava nenhum, e terminava com "Na sala de disputa" sem
   * ter saido do formulario — um falso positivo que a sessao 6c118f0f
   * mostrou na tela. Os seletores abaixo foram lidos da pagina real
   * (PrimeNG) com um Chrome separado:
   *   #emAndamento / #finalizadas          — Situacao
   *   #abertasParticipacao / #emDisputa /
   *   #emSelecaoDeFornecedores             — Etapa
   *   #unidadeCompradora                   — codigo da UASG
   *   input[placeholder="Ex: 102021"]      — numero da compra (sem id)
   *   button.br-button.is-primary          — Pesquisar
   * A pesquisa pode cair num hCaptcha VISIVEL (aconteceu em headless no
   * mapeamento; na janela logada, nao) — nesse caso pede o clique humano,
   * como no login. O que este metodo NAO faz: entrar na sala de disputa.
   * Ninguem viu essa tela ainda; ela e o proximo muro, e o log diz isso em
   * vez de fingir.
   */
  async navegarParaDisputa(edital, alvo) {
    console.log('📋 Navegando para disputa: ' + edital);
    await this.aplicarAntiDeteccao();

    const numero = this.numeroDaCompra(edital);
    if (!numero) {
      const e = new Error('O edital "' + edital + '" nao tem numero e ano de compra (ex.: 90012/2024), '
        + 'e a busca do Compras.gov so aceita isso. Cadastre a disputa com o numero da compra que '
        + 'aparece no portal.');
      e.semRetry = true;
      throw e;
    }

    await this.comRetry(async () => {
      await this.page.goto(this.publicUrl, { waitUntil: 'networkidle2', timeout: 45000 });
      // O SPA mostra "Aguarde..." e so depois pinta o formulario.
      await this.page.waitForFunction(
        () => /N[uú]mero da compra/i.test(document.body.innerText || '')
          && !!document.querySelector('input[placeholder="Ex: 102021"]'),
        { timeout: 45000 });
      await this.delayHumano(400, 900);

      // Etapa: "Em disputa" E "Abertas para participacao" — antes da sessao
      // abrir a compra ainda esta na segunda.
      await this.page.evaluate(() => {
        for (const id of ['abertasParticipacao', 'emDisputa']) {
          const cb = document.getElementById(id);
          if (cb && !cb.checked) cb.click();
        }
      });
      let uasgNaTela = '';
      if (alvo && alvo.uasg) {
        uasgNaTela = await this.digitarConferindo('#unidadeCompradora', String(alvo.uasg).replace(/\\D/g, ''));
      }
      const numeroNaTela = await this.digitarConferindo('input[placeholder="Ex: 102021"]', numero.campo);
      await this.delayHumano(300, 700);
      console.log('🔎 Pesquisando a compra ' + numero.rotulo + ' (campo: ' + numero.campo
        + ', na tela: ' + numeroNaTela + (uasgNaTela ? ', UASG na tela: ' + uasgNaTela : ', sem UASG') + ')');
      await this.page.click('button.br-button.is-primary');

      // Espera o desfecho: resultados, "nenhum", ou captcha.
      let desfecho = 'nada';
      const fim = Date.now() + 30000;
      while (Date.now() < fim) {
        await new Promise((r) => setTimeout(r, 1500));
        desfecho = await this.lerDesfechoDaBusca();
        if (desfecho !== 'nada') break;
      }

      if (desfecho === 'captcha' && this.segundosEsperaHumano > 0) {
        await this.screenshot('busca-captcha');
        console.log('🧑 A pesquisa caiu num hCaptcha — preciso de um clique humano na tela remota.');
        interacao.pedir(this.sessaoId, {
          expira_em: new Date(Date.now() + this.segundosEsperaHumano * 1000).toISOString(),
          tipo: 'captcha',
          mensagem: 'A pesquisa de compras do Compras.gov mostrou um hCaptcha. Abra a tela remota (VNC), '
            + 'resolva o captcha e clique em "Pesquisar" de novo se precisar.',
          tela: 'Compras.gov — Compras eletronicas (pesquisa)',
        });
        const limite = Date.now() + this.segundosEsperaHumano * 1000;
        let avisou = 0;
        while (Date.now() < limite) {
          await new Promise((r) => setTimeout(r, 2000));
          desfecho = await this.lerDesfechoDaBusca();
          if (desfecho === 'resultados' || desfecho === 'nenhum') {
            interacao.resolver(this.sessaoId, 'atendido');
            console.log('🧑 ✅ Captcha resolvido — a pesquisa respondeu');
            break;
          }
          const faltam = Math.round((limite - Date.now()) / 1000);
          if (faltam > 0 && faltam % 30 === 0 && faltam !== avisou) {
            avisou = faltam;
            console.log('🧑 ainda esperando o captcha da pesquisa — ' + faltam + 's restantes');
          }
        }
      }

      await this.screenshot('busca-resultado');

      if (desfecho !== 'resultados') {
        const e = new Error(desfecho === 'nenhum'
          ? 'A compra ' + numero.rotulo + ' nao apareceu na pesquisa do Compras.gov (Em andamento, '
            + 'Abertas para participacao + Em disputa). Confira numero/ano e se a compra e do Compras.gov.'
          : desfecho === 'captcha'
            ? 'A pesquisa do Compras.gov ficou presa no hCaptcha e ninguem resolveu na tela remota.'
            : 'A pesquisa do Compras.gov nao respondeu em 30s.');
        e.semRetry = desfecho !== 'nada';
        throw e;
      }

      // O card da compra: o elemento mais interno cujo texto tem "N° numero/ano",
      // subindo ate o container que tambem tem os icones de acao. Com UASG,
      // so os cards que tambem trazem esse codigo contam — o numero se repete
      // entre orgaos (cinco "N° 1/2022" na tela de 10/09/2026).
      const uasg = alvo && alvo.uasg ? String(alvo.uasg).replace(/\\D/g, '') : '';
      const card = await this.page.evaluate((rotulo, uasg) => {
        const padrao = new RegExp('N[°º]\\\\s*' + rotulo.replace('/', '\\\\/') + '(?!\\\\d)');
        let todos = [...document.querySelectorAll('div, li, article, tr')]
          .filter((el) => padrao.test((el.innerText || '').replace(/\\s+/g, ' ')));
        if (uasg) {
          const comUasg = todos.filter((el) => (el.innerText || '').indexOf(uasg) !== -1);
          if (comUasg.length) todos = comUasg;
        }
        if (!todos.length) return null;
        // O menor que ainda contem um botao/icone de acao.
        let el = todos[todos.length - 1];
        while (el && el !== document.body && !el.querySelector('button, a, i, svg')) el = el.parentElement;
        if (!el || el === document.body) el = todos[todos.length - 1];
        el.setAttribute('data-robo-card', '1');
        return (el.innerText || '').replace(/\\s+/g, ' ').slice(0, 200);
      }, numero.rotulo, uasg);

      if (!card) {
        const e = new Error('A pesquisa respondeu, mas a compra ' + numero.rotulo + ' nao esta entre os resultados.');
        e.semRetry = true;
        throw e;
      }
      if (uasg && card.indexOf(uasg) === -1) {
        console.log('⚠️ A UASG ' + uasg + ' nao aparece no card escolhido — pode ser a compra de outro orgao');
      }
      console.log('🎯 Compra localizada: ' + card);

      // Abrir: o card tem icones de acao a direita (lista e seta). O que cada
      // um abre ainda NAO foi visto — clica no primeiro e registra onde caiu.
      const clicou = await this.page.evaluate(() => {
        const el = document.querySelector('[data-robo-card="1"]');
        const acao = el && el.querySelector('button, a, i[class*="list"], i[class*="fa-"]');
        if (acao) { acao.click(); return true; }
        return false;
      });
      await new Promise((r) => setTimeout(r, 4000));
      await this.adotarAbaViva('ao abrir a compra');
      await this.screenshot('compra-aberta');
      console.log((clicou ? '📂 Abri a compra; ' : '📂 Nao achei o icone de abrir; ')
        + 'a tela ficou em ' + this.page.url());
      console.log('📍 A sala de disputa ainda nao foi mapeada — a leitura de lances daqui em diante '
        + 'depende de ver essa tela com um pregao em sessao. Nao estou afirmando estar nela.');
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

      await new Promise((r) => setTimeout(r, 3000));
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

  'src/portals/teclado-embaralhado.js': `/**
 * Login das plataformas com teclado embaralhado — BLL e BNC.
 *
 * POR QUE UM ARQUIVO SO PARA AS DUAS: em 09/09/2026 descobriu-se, seguindo o
 * link "Inicio" do site institucional da BNC, que bllcompras.com e
 * bnccompras.com rodam o MESMO sistema. Mesmos campos (#Email, #Contador),
 * mesmo teclado, mesmo botao, mesma mensagem de erro. Duas copias divergiriam.
 *
 * COMO O TECLADO FUNCIONA (verificado ao vivo, nao deduzido):
 *
 * A senha nao e digitada. Ha cinco teclas, cada uma com um PAR de digitos, e o
 * par vai no atributo \`name\`:
 *
 *     name="0 ou 4"   name="6 ou 9"   name="2 ou 1"   name="3 ou 5"   name="8 ou 7"
 *
 * Cada digito aparece em exatamente um par, entao para cada digito da senha
 * clica-se na tecla que o contem. O servidor recebe a sequencia de pares e
 * confere que cada digito da senha pertence ao par clicado na posicao.
 *
 * OS PARES MUDAM A CADA CARREGAMENTO — por isso a leitura e em tempo de
 * execucao. Gravar o mapa funcionaria uma vez e falharia depois, em silencio.
 *
 * CONSEQUENCIA: a senha destes portais e obrigatoriamente NUMERICA. Nao existe
 * tecla para letra. Uma senha com letras nao e um caso a tratar, e um dado
 * errado — e dizer isso e melhor que clicar em nada e culpar o portal.
 */

function esperar(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Os pares oferecidos AGORA. Reler a cada login e o ponto. */
async function lerPares(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('input[type=button], button')]
      .map((b) => b.getAttribute('name') || '')
      .filter((n) => /^\\d\\s*ou\\s*\\d$/i.test(n))
  );
}

/**
 * Entra no portal e confirma que entrou.
 *
 * \`portal\` e a instancia de BasePortal (usa page, credenciais, preencherCampo e
 * screenshot). Lanca com a razao real em vez de marcar \`loggedIn\` no escuro —
 * era assim antes, e uma tela de erro passava por sucesso.
 */
async function loginComTecladoEmbaralhado(portal, loginUrl) {
  const page = portal.page;
  const login = String(portal.credenciais.login || '').trim();
  const senha = String(portal.credenciais.senha || '').trim();

  if (!login || !senha) {
    throw new Error('Login e senha do portal nao foram informados ao agente.');
  }
  if (!/^\\d+$/.test(senha)) {
    throw new Error(
      'A senha deste portal e digitada num teclado que so tem digitos, entao ela ' +
      'precisa ser somente numeros. A senha cadastrada tem outros caracteres.'
    );
  }

  await page.goto(loginUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  await esperar(1200);

  await portal.preencherCampo('#Email', login);
  await esperar(300);

  const pares = await lerPares(page);
  if (pares.length === 0) {
    await portal.screenshot('teclado-nao-encontrado');
    throw new Error(
      'O teclado virtual nao foi encontrado na tela de login — o portal mudou de layout.'
    );
  }

  for (const digito of senha) {
    const par = pares.find((p) => p.split(/\\s*ou\\s*/i).indexOf(digito) !== -1);
    if (!par) {
      throw new Error(
        'O digito ' + digito + ' nao aparece em nenhuma tecla (' + pares.join(', ') + ').'
      );
    }
    await page.click('input[name="' + par + '"], button[name="' + par + '"]');
    // Ritmo humano: cliques instantaneos e um sinal de automacao barato de ver.
    await esperar(120 + Math.floor(Math.random() * 200));
  }

  // O campo mostra um caractere por clique. Conferir aqui separa "o teclado nao
  // respondeu" de "a senha esta errada" — duas causas com consertos opostos.
  const digitados = await page
    .$eval('#Contador', (el) => (el.value || '').length)
    .catch(() => -1);
  if (digitados !== senha.length) {
    await portal.screenshot('teclado-nao-registrou');
    throw new Error(
      'O teclado registrou ' + digitados + ' digito(s) para uma senha de ' +
      senha.length + '. Os cliques nao chegaram ao portal.'
    );
  }

  // O botao nao tem id nem name; o rotulo exato e a identificacao estavel.
  const enviou = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button, input[type=submit], input[type=button]')]
      .find((e) => /^\\s*entrar\\s*$/i.test(e.value || e.textContent || ''));
    if (b) { b.click(); return true; }
    return false;
  });
  if (!enviou) throw new Error('Botao "Entrar" nao encontrado na tela de login.');

  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 25000 }).catch(() => {});
  await esperar(2500);
  await portal.screenshot('pos-login');

  const estado = await page.evaluate(() => ({
    url: location.href,
    texto: document.body ? document.body.innerText : '',
  }));

  // Verificado: com credencial invalida o portal FICA em /Home/Login e mostra
  // "Usuário ou senha incorretos." num aviso. Sem esta checagem, o modulo
  // seguiria para a disputa a partir da tela de login.
  if (/usu[áa]rio ou senha incorretos/i.test(estado.texto)) {
    throw new Error('O portal recusou o acesso: "Usuario ou senha incorretos."');
  }
  if (/\\/Home\\/Login/i.test(estado.url)) {
    throw new Error(
      'O portal manteve a tela de login apos o envio — acesso nao concluido.'
    );
  }

  portal.loggedIn = true;
}

module.exports = { loginComTecladoEmbaralhado, lerPares };
`,

  'src/portals/bll.js': `const { BasePortal } = require('./base-portal');

const { loginComTecladoEmbaralhado } = require('./teclado-embaralhado');

/**
 * Módulo de automação para o portal BLL (Bolsa de Licitações e Leilões)
 *
 * URL operacional: https://bllcompras.com  — VERIFICADA em 09/09/2026
 * Autenticação: e-mail + senha NUMERICA em teclado embaralhado
 *
 * O DOMINIO ESTAVA ERRADO. Este modulo apontava para bll.org.br/wp-login.php —
 * o login do WordPress do site INSTITUCIONAL. Nunca houve chance de funcionar:
 * a plataforma de pregao e bllcompras.com, e o site institucional so publica
 * conteudo. \`bllcompras.com\` redireciona sozinho para /Home/Login.
 */
class BLLPortal extends BasePortal {
  constructor(page, credenciais) {
    super(page, credenciais);
    this.nome = 'bll';
    this.baseUrl = 'https://bllcompras.com';
    this.loginUrl = 'https://bllcompras.com/Home/Login';
  }

  async login() {
    console.log('🔐 Iniciando login no BLL (bllcompras.com)...');
    // O teclado embaralhado e identico ao da BNC — mesma plataforma. A logica
    // mora em teclado-embaralhado.js para as duas nao divergirem.
    await loginComTecladoEmbaralhado(this, this.loginUrl);
    console.log('✅ Login no BLL realizado');
  }

  async navegarParaDisputa(edital) {
    console.log(\`📋 Navegando para disputa BLL: \${edital}\`);
    await this.page.goto(\`\${this.baseUrl}/pregao\`, { waitUntil: 'networkidle2' });
    await this.preencherCampo('input[name="busca"], #busca', edital);
    await this.page.keyboard.press('Enter');
    await new Promise((r) => setTimeout(r, 3000));
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

    this.page.once('dialog', async d => await d.accept());
    await new Promise((r) => setTimeout(r, 3000));
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
    await new Promise((r) => setTimeout(r, ms));
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
        await new Promise((r) => setTimeout(r, this.retryDelay * i));
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
      await new Promise((r) => setTimeout(r, 1000));
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

      await new Promise((r) => setTimeout(r, 1500));
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
    await new Promise((r) => setTimeout(r, 3000));
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
    this.page.once('dialog', async d => await d.accept());
    await new Promise((r) => setTimeout(r, 3000));
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
    await new Promise((r) => setTimeout(r, 5000));
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
    this.page.once('dialog', async d => await d.accept());
    await new Promise((r) => setTimeout(r, 3000));
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
    
    await new Promise((r) => setTimeout(r, 3000));
    
    // Preencher formulário de login (SPA renderiza campos dinamicamente)
    await this.preencherCampo('input[name="email"], input[name="login"], input[type="email"], #email', this.credenciais.login);
    await this.preencherCampo('input[name="password"], input[name="senha"], input[type="password"], #password', this.credenciais.senha);
    await this.page.evaluate(() => {
      const btn = [...document.querySelectorAll('button[type="submit"], button')]
        .find(b => (b.textContent || '').toLowerCase().includes('entrar') || 
                    (b.textContent || '').toLowerCase().includes('login'));
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 5000));
    this.loggedIn = true;
    console.log('✅ Login no Licitanet realizado');
  }

  async navegarParaDisputa(edital) {
    await this.page.goto(\`\${this.baseUrl}/pregao/busca?q=\${encodeURIComponent(edital)}\`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 3000));
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
    this.page.once('dialog', async d => await d.accept());
    await new Promise((r) => setTimeout(r, 3000));
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
    // O login NAO fica no dominio institucional. Ele mora no ambiente de
    // OPERACAO, que redireciona para um Keycloak. VERIFICADO em 2026-09-08
    // com login real: abriu o Painel de Operacoes e o cabecalho passou a
    // exibir "Voce esta logado como: <nome> - <CNPJ>".
    this.baseUrl = 'https://operacao.portaldecompraspublicas.com.br/4';
    this.loginUrl = 'https://operacao.portaldecompraspublicas.com.br/18/loginext/';
  }

  async login() {
    console.log('🔐 Iniciando login no Portal de Compras Públicas...');

    // A versao anterior deste metodo (31/03) tratava o portal como SPA Angular
    // e cacava o botao "Entrar" por texto. O portal trocou a autenticacao para
    // Keycloak desde entao, e o caminho antigo caia em 404. Os seletores abaixo
    // sao os REAIS, lidos do HTML da pagina de login em 08/09/2026.
    await this.page.goto(this.loginUrl, { waitUntil: 'networkidle2', timeout: 45000 });

    await this.preencherCampo('#username', this.credenciais.login);
    await this.preencherCampo('#password', this.credenciais.senha);

    await Promise.all([
      this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 45000 }).catch(() => null),
      this.page.click('#kc-login'),
    ]);

    await this.screenshot('pos-login');

    // Nunca cravar loggedIn sem conferir. O codigo antigo marcava sucesso logo
    // apos esperar 5 segundos, entao credencial errada virava "login realizado"
    // e o defeito so aparecia rodadas depois, longe da causa.
    const falhou = await this.page.evaluate(() => {
      const t = document.body.innerText;
      return /senha inv|usu[aá]rio inv|credenciais inv|invalid|n[aã]o autorizado/i.test(t)
          || !!document.querySelector('#username');
    });

    if (falhou) {
      this.loggedIn = false;
      throw new Error('Login recusado pelo Portal de Compras Públicas — confira usuário e senha');
    }

    this.loggedIn = true;
    console.log('✅ Login no Portal de Compras Públicas realizado');
  }

  async navegarParaDisputa(edital, alvo) {
    // O QUE disputar dentro do processo, quando a tela informou.
    //
    // Registrado ANTES de navegar: se a sessao morrer no meio, o log ja diz o
    // que ela deveria estar acompanhando. Ate 09/09/2026 nada disso
    // atravessava — o agente abria o processo e, num pregao com 40 itens, nao
    // sabia em qual estava, sem que nada denunciasse a cegueira.
    //
    // A SELECAO do item na sala de disputa ainda nao existe: depende de ler a
    // tela com pregao acontecendo, que e o proximo teste. Ate la isto e
    // registro honesto do que foi recebido, e nao acao.
    const itensAlvo = (alvo && Array.isArray(alvo.itens)) ? alvo.itens : [];
    if (itensAlvo.length) {
      const semPiso = itensAlvo.filter((i) => i.valor_minimo === null || i.valor_minimo === undefined);
      console.log(
        \`🎯 Disputa por \${alvo.tipo || 'item'} — \${itensAlvo.length} \` +
        \`item(ns) recebido(s): \${itensAlvo.slice(0, 8).map((i) => \`#\${i.numero}\${i.lote && i.lote !== 'Único' ? '/' + i.lote : ''}\`).join(', ')}\` +
        (itensAlvo.length > 8 ? ' …' : '')
      );
      // Piso ausente NAO e piso zero. Dizer isso no log evita a conclusao de
      // que o robo "aceitou" descer ate zero num item que ninguem avaliou.
      if (semPiso.length) {
        console.log(
          \`⚠️  \${semPiso.length} de \${itensAlvo.length} item(ns) vieram SEM piso definido — \` +
          'para esses o robo nao deve dar lance'
        );
      }
    } else {
      console.log('ℹ️  Nenhum item informado para esta sessao — o robo vai apenas abrir o processo');
    }

    // O portal NAO enderecа processo pelo numero do edital. Cada um tem uma
    // chave interna (\`ttCD_CHAVE\`), e a URL montada a mao —
    // \`/disputa?edital=X\` — devolvia 404 em qualquer caso. Verificado em
    // 08/09/2026 pelo VNC: o robo logava e ficava parado num 404.
    //
    // O caminho real: abrir "Seus Processos", achar a linha cujo NUMERO bate
    // com o edital e seguir o link dela.
    // O estado da conta so existe no DashBoard, e daqui a pouco saimos dele.
    // Lido agora, serve para explicar a falha la embaixo em vez de mandar o
    // operador conferir o numero do edital quando o problema e outro.
    const conta = await this.estadoDaConta().catch(() => null);
    if (conta && conta.impedida) {
      console.log(\`⚠️  CONTA INATIVA no portal: \${conta.resumo}\`);
    }

    // VERIFICADO em 09/09/2026: este e o destino do link "Seus Processos" no
    // menu real do portal. Nao deduzir de novo.
    const lista = \`\${this.baseUrl}/SeusPregoes/\`;
    console.log(\`📋 Procurando "\${edital}" em \${lista}\`);
    await this.page.goto(lista, { waitUntil: 'networkidle2', timeout: 45000 });
    await new Promise((r) => setTimeout(r, 3000));

    // A lista em si vale foto. Sem ela, "nao encontrado" e uma afirmacao sem
    // prova: nao da para saber se a pagina veio vazia, veio errada, ou veio
    // cheia e o numero e que estava errado.
    await this.screenshot('seus-processos');

    const href = await this.page.evaluate((alvo) => {
      const limpa = (t) => (t || '').replace(/\\s+/g, ' ').trim().toLowerCase();
      const buscado = limpa(alvo);
      for (const tr of document.querySelectorAll('table tr')) {
        const link = tr.querySelector('a[href*="DadosPregao"]');
        if (!link) continue;
        if (limpa(tr.innerText).includes(buscado)) return link.getAttribute('href');
      }
      return null;
    }, edital);

    if (!href) {
      // Erro explicito em vez de navegar para lugar nenhum: sem isto o robo
      // seguiria para o loop de lances olhando uma pagina que nao e a disputa.
      // DIZER O QUE EXISTE, e nao so o que falta.
      //
      // "Confira o numero do edital" manda a pessoa procurar num lugar que ela
      // ja nao sabe onde fica. A lista esta aberta na tela do robo neste exato
      // momento — entao a resposta vai junto da pergunta.
      const processosVisiveis = await this.page.evaluate(() => {
        const nums = [];
        for (const tr of document.querySelectorAll('table tr')) {
          if (!tr.querySelector('a[href*="DadosPregao"]')) continue;
          const cel = tr.querySelector('td');
          const t = (cel ? cel.innerText : '').replace(/\\s+/g, ' ').trim();
          if (t) nums.push(t.slice(0, 24));
        }
        return nums.slice(0, 12);
      }).catch(() => []);

      const lista = processosVisiveis.length
        ? \` Os processos que aparecem na conta agora sao: \${processosVisiveis.join(', ')}.\`
        : ' E a lista veio VAZIA — ou a conta nao tem processos inscritos, ou a pagina nao carregou.';

      // A situacao da conta vai junto como CONTEXTO, nunca como causa.
      //
      // A versao anterior afirmava que conta vencida impede a listagem, e
      // parava por ali. Isso e falso, e foi verificado: em 08/09/2026 o robo
      // achou e abriu o processo 002/2026 com a conta exatamente neste estado,
      // e em 09/09 a tela de Seus Processos apareceu cheia. O plano vencido
      // bloqueia DISPUTAR, nao LISTAR.
      //
      // Dizer o contrario mandaria renovar um plano para resolver um problema
      // que a renovacao nao resolve — e o numero do edital continuaria errado.
      // Duas causas diferentes, ditas separadamente, porque tem consertos
      // diferentes: o numero do edital e com quem cadastrou a disputa; a
      // assinatura e com quem paga a mensalidade do portal.
      // Uma mensagem so, com a causa na frente e o aviso como nota.
      //
      // Dois toasts para o mesmo evento competiriam entre si, e o da assinatura
      // apontaria uma causa que nao e a causa — mandaria pagar mensalidade para
      // resolver um numero de edital errado.
      const contexto = conta && conta.impedida && conta.resumo
        ? \` — Obs.: \${conta.resumo}. Isso e outro assunto: nao impede entrar nem \` +
          \`listar processos, mas vai impedir dar lance quando a disputa comecar.\`
        : '';

      const err = new Error(
        \`Processo "\${edital}" nao encontrado em Seus Processos do Portal de Compras Publicas.\` +
        lista + contexto
      );
      // Repetir nao faz o numero existir.
      err.semRetry = true;
      throw err;
    }

    const url = href.startsWith('http') ? href : \`https://operacao.portaldecompraspublicas.com.br\${href}\`;
    console.log(\`📋 Processo encontrado: \${url}\`);
    await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
    await new Promise((r) => setTimeout(r, 3000));
    await this.screenshot('processo');

    // O plano inativo bloqueia a disputa mesmo com o processo aberto. Dizer
    // isso aqui evita depurar seletor de lance quando o problema e comercial.
    const contaNoProcesso = await this.estadoDaConta().catch(() => null);
    if (contaNoProcesso && contaNoProcesso.impedida) {
      console.log(\`⚠️  Conta impedida no portal (\${contaNoProcesso.resumo}) — participacao em disputa bloqueada pelo proprio portal\`);
    }
  }

  /**
   * Os itens do edital, lidos da pagina do processo.
   *
   * ─── O QUE FOI MAPEADO NA TELA REAL, 10/09/2026 ────────────────────────────
   *
   * A pagina do processo traz uma tabela com estas colunas:
   *
   *     | (sel) | Item | Descricao | Valor Ref | Excl. | Quantidade | Julgamento |
   *
   * No 002/2026 sao 12 linhas por pagina e CINCO paginas, navegadas por
   * \`?...&ttPagina=N&slA=Edit&ttCD_CHAVE=...\`. Cada descricao tem id proprio
   * (\`#produtoTexto155\`, \`156\`…), que nao usamos: id de produto e do catalogo
   * do portal, nao do item do edital.
   *
   * ─── POR QUE MAPEAR PELO CABECALHO E NAO POR POSICAO ───────────────────────
   *
   * \`celulas[1]\` seria mais curto e quebraria calado no dia em que o portal
   * inserir uma coluna. Ler o cabecalho custa uma linha e transforma "valores
   * errados em silencio" em "nao achei a coluna".
   *
   * Vale sem pregao acontecendo — foi por isso que virou a primeira estrutura
   * de itens real que conseguimos ler deste portal.
   */
  async lerItensDoProcesso() {
    const paginas = [];
    // Teto de 20 paginas: edital grande existe, laco infinito por paginacao
    // quebrada tambem. O teto e a condicao de parada.
    for (let p = 1; p <= 20; p++) {
      const pagina = await this.page.evaluate(() => {
        // Defensivo de proposito: nem toda linha tem todas as celulas. Cabecalho,
        // linha de "nenhum resultado" e linhas com colspan chegam curtas, e
        // a celula no indice vira undefined. Custou uma sessao real descobrir — o teste de
        // 10/09/2026 morreu exatamente aqui, com "Cannot read properties of
        // undefined (reading 'innerText')".
        const limpa = (el) => ((el && el.innerText) || '').replace(/\\s+/g, ' ').trim();
        const numero = (t) => {
          // "R$ 1.234,56" -> 1234.56. Milhar com ponto, decimal com virgula.
          const m = String(t).replace(/[^\\d.,]/g, '').replace(/\\./g, '').replace(',', '.');
          const n = parseFloat(m);
          return Number.isFinite(n) ? n : null;
        };

        // A tabela dos itens e a que tem coluna "Item" E coluna "Quantidade".
        // Sem os dois, e outra tabela da pagina (datas, documentos).
        let alvo = null;
        let cabecalhos = [];
        for (const tb of document.querySelectorAll('table')) {
          const ths = [...tb.querySelectorAll('th')].map((th) => limpa(th).toLowerCase());
          if (ths.some((h) => /^item$/.test(h)) && ths.some((h) => /quantidade/.test(h))) {
            alvo = tb;
            cabecalhos = ths;
            break;
          }
        }
        if (!alvo) return { itens: [], achouTabela: false, temProxima: false };

        const col = (regex) => cabecalhos.findIndex((h) => regex.test(h));
        const iItem = col(/^item$/);
        const iDesc = col(/descri/);
        const iRef = col(/valor\\s*ref/);
        const iQtd = col(/quantidade/);

        const itens = [];
        for (const tr of alvo.querySelectorAll('tr')) {
          const tds = [...tr.querySelectorAll('td')];
          if (!tds.length) continue;
          const bruto = iItem >= 0 ? limpa(tds[iItem]) : '';
          const num = parseInt(bruto.replace(/\\D/g, ''), 10);
          if (!Number.isFinite(num)) continue;
          itens.push({
            numero: num,
            descricao: iDesc >= 0 && tds[iDesc] ? limpa(tds[iDesc]).slice(0, 180) : '',
            valor_referencia: iRef >= 0 && tds[iRef] ? numero(limpa(tds[iRef])) : null,
            quantidade: iQtd >= 0 && tds[iQtd] ? numero(limpa(tds[iQtd])) : null,
          });
        }

        // Existe pagina seguinte? A paginacao e por links com o numero.
        const paginaAtual = new URL(location.href).searchParams.get('ttPagina');
        const atual = parseInt(paginaAtual || '1', 10) || 1;
        const temProxima = [...document.querySelectorAll('a[href*="ttPagina="]')].some((a) => {
          const n = parseInt(new URL(a.href, location.origin).searchParams.get('ttPagina') || '0', 10);
          return n === atual + 1;
        });

        return { itens, achouTabela: true, temProxima };
      });

      if (!pagina.achouTabela) break;
      paginas.push(...pagina.itens);
      if (!pagina.temProxima) break;

      const proxima = new URL(this.page.url());
      proxima.searchParams.set('ttPagina', String(p + 1));
      await this.page.goto(proxima.toString(), { waitUntil: 'networkidle2', timeout: 45000 });
      await new Promise((r) => setTimeout(r, 1500));
    }

    // Deduplica por numero: paginacao quebrada pode repetir a mesma pagina, e
    // item repetido viraria "divergencia" inventada na conferencia.
    const vistos = new Set();
    return paginas.filter((i) => {
      if (vistos.has(i.numero)) return false;
      vistos.add(i.numero);
      return true;
    });
  }

  /**
   * O que o portal diz sobre a propria conta, lido no DashBoard.
   *
   * Havia uma verificacao parecida, mas ela rodava DEPOIS de abrir o processo,
   * e lia o banner amarelo do portal ("nao tem um plano ativo") — que existe
   * mesmo, fotografado em 08/09/2026 sobre os Dados do Processo 002/2026. O
   * buraco: quando o processo NAO e encontrado, ela nunca chega a rodar, e a
   * unica frase que sobra manda conferir o numero do edital.
   *
   * Esta le no DashBoard, antes de sair dele, e cobre as duas redacoes — a do
   * banner e a da tabela "Situacao Cadastral", que em 09/09/2026 mostrava
   * "Inativo", validade 17/04/2026, "Atencao: seu acesso esta vencido." e
   * "Creditos 0".
   */
  async estadoDaConta() {
    const bruto = await this.page.evaluate(() => {
      const t = (document.body.innerText || '').replace(/\\s+/g, ' ');
      // Os VALORES, nao o bloco inteiro. Despejar 240 caracteres da tabela
      // trazia junto os cabecalhos ("Situacao Validade Validade em Dias
      // Creditos Acao") e o resultado era ilegivel na tela de quem opera.
      // A data SO se estiver colada ao contexto de validade. A versao anterior
      // pegava a primeira data da pagina, que e facilmente o "Homologado em
      // 23/05/2024" da documentacao — e uma data errada dita com confianca e
      // pior que nenhuma data. Sem esse casamento, a frase sai generica.
      const dataM = t.match(/Situa[cç][aã]o Cadastral.{0,80}?\\bInativo\\b.{0,20}?(\\d{2}\\/\\d{2}\\/\\d{4})/i);
      // Idem para os creditos: so o numero que vem logo depois do aviso.
      const credM = t.match(/acesso est[aá] vencido\\.?\\s*(\\d+)\\b/i);
      return {
        inativo: /Situa[cç][aã]o Cadastral.{0,120}?\\bInativo\\b/i.test(t),
        vencido: /acesso est[aá] vencido/i.test(t),
        semPlano: /n[aã]o tem um plano ativo/i.test(t),
        validade: dataM ? dataM[1] : null,
        creditos: credM ? credM[1] : null,
      };
    });

    // A frase e montada aqui, e nao no chamador, para que todo lugar que
    // mostrar o estado da conta diga a MESMA coisa.
    // CADA FRASE E TRANSCRICAO, NUNCA INTERPRETACAO.
    //
    // A versao anterior tratava "Inativo" e "vencido" como a mesma coisa, e
    // dizia "assinatura vencida" quando a pagina so tinha dito "Inativo" —
    // que pode ser inativo por outro motivo. Afirmar causa que a tela nao
    // afirmou e inventar dado, ainda que soe plausivel.
    const partes = [];
    if (bruto.vencido) {
      // A pagina disse, com estas palavras, que o acesso esta vencido.
      partes.push(
        bruto.validade
          ? \`o portal informa que o acesso esta vencido desde \${bruto.validade}\`
          : 'o portal informa que o acesso esta vencido'
      );
    } else if (bruto.inativo) {
      // So sabemos o rotulo. Repetimos o rotulo, sem dizer por que.
      partes.push('a situacao cadastral da conta aparece como "Inativo"');
    } else if (bruto.semPlano) {
      partes.push('o portal informa que a conta nao tem plano ativo');
    }
    // Zero creditos so entra se o numero foi lido de fato — \`null\` e diferente
    // de zero, e um nao-lido nunca vira uma afirmacao.
    if (bruto.creditos === '0') partes.push('com 0 creditos');

    return {
      ...bruto,
      impedida: bruto.inativo || bruto.vencido || bruto.semPlano,
      // Sem nada lido, nao ha aviso. Preferir silencio a um resumo generico
      // que soa como diagnostico sem ser um.
      resumo: partes.length ? partes.join(', ') : null,
    };
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
    this.page.once('dialog', async d => await d.accept());
    await new Promise((r) => setTimeout(r, 3000));
    return true;
  }
}

module.exports = { PortalComprasPortal };
`,

  'src/portals/bnc.js': `const { BasePortal } = require('./base-portal');

const { loginComTecladoEmbaralhado } = require('./teclado-embaralhado');

/**
 * Módulo para BNC (Bolsa Nacional de Compras)
 *
 * URL operacional: https://bnccompras.com  — VERIFICADA em 09/09/2026
 * Autenticação: e-mail + senha NUMERICA em teclado embaralhado
 *
 * O DOMINIO ESTAVA ERRADO, pelo mesmo motivo do BLL: bnc.org.br e o site
 * institucional em WordPress, e os unicos campos de formulario que ele tem sao
 * de newsletter ("Nome", "Telefone", "Nome da instituicao"). Nao ha login ali.
 *
 * O endereco certo saiu do proprio site, seguindo o link "Inicio" — e foi assim
 * que se descobriu que BNC e BLL rodam a MESMA plataforma: mesmos #Email e
 * #Contador, mesmo teclado de pares, mesma mensagem de erro. Uma implementacao
 * atende as duas.
 */
class BNCPortal extends BasePortal {
  constructor(page, credenciais) {
    super(page, credenciais);
    this.nome = 'bnc';
    this.baseUrl = 'https://bnccompras.com';
    this.loginUrl = 'https://bnccompras.com/Home/Login';
  }

  async login() {
    console.log('🔐 Iniciando login no BNC (bnccompras.com)...');
    await loginComTecladoEmbaralhado(this, this.loginUrl);
    console.log('✅ Login no BNC realizado');
  }

  async navegarParaDisputa(edital) {
    await this.page.goto(\`\${this.baseUrl}/pregao/busca?q=\${encodeURIComponent(edital)}\`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 3000));
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
    this.page.once('dialog', async d => await d.accept());
    await new Promise((r) => setTimeout(r, 3000));
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
    throw new Error(\`Portal "\${portalId}" não suportado. Disponíveis: \${Object.keys(PORTALS).join(', ')}\`);
  }
  return new PortalClass(page, credenciais);
}

module.exports = { PORTALS, getPortal };
`,
};
