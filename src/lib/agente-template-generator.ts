// Generates a downloadable ZIP with the Node.js agent template
import JSZip from 'jszip';

const FILES: Record<string, string> = {
  'package.json': `{
  "name": "agente-lances-externo",
  "version": "1.0.0",
  "description": "Agente externo para automação de lances em portais de licitação",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev": "node --watch src/index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "puppeteer": "^22.0.0",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "node-fetch": "^3.3.2"
  }
}`,

  '.env.example': `# Configuração do Agente
PORT=3500
AGENT_API_KEY=sua-chave-secreta-aqui

# URL de callback do sistema (Lovable Cloud)
CALLBACK_URL=https://sbnlovigyifvrkgsoalj.supabase.co/functions/v1/robo-lances-webhook/callback

# Certificado Digital A1
CERT_PATH=./certs/certificado.pfx
CERT_PASSWORD=senha-do-certificado
`,

  'Dockerfile': `FROM node:20-slim

# Instalar dependências do Chromium
RUN apt-get update && apt-get install -y \\
    chromium \\
    libnss3 \\
    libatk-bridge2.0-0 \\
    libx11-xcb1 \\
    libxcomposite1 \\
    libxdamage1 \\
    libxrandr2 \\
    libgbm1 \\
    libasound2 \\
    libpangocairo-1.0-0 \\
    libgtk-3-0 \\
    fonts-liberation \\
    --no-install-recommends && \\
    rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .

EXPOSE 3500
CMD ["node", "src/index.js"]
`,

  'README.md': `# Agente Externo de Lances

Servidor dedicado que executa lances reais nos portais de licitação usando
Puppeteer e certificado digital A1.

## Requisitos

- Node.js 20+
- Google Chrome / Chromium
- Certificado digital A1 (.pfx)

## Instalação

\`\`\`bash
npm install
cp .env.example .env
# Edite o .env com suas configurações
mkdir -p certs
# Copie seu certificado .pfx para certs/certificado.pfx
\`\`\`

## Execução

\`\`\`bash
npm start        # produção
npm run dev      # desenvolvimento (hot-reload)
\`\`\`

## Docker

\`\`\`bash
docker build -t agente-lances .
docker run -d -p 3500:3500 \\
  -v ./certs:/app/certs \\
  --env-file .env \\
  agente-lances
\`\`\`

## Endpoints

| Método | Rota               | Descrição                  |
|--------|--------------------|-----------------------------|
| GET    | /health            | Status e versão do agente   |
| POST   | /sessao/iniciar    | Iniciar sessão de lance     |
| POST   | /sessao/pausar     | Pausar sessão ativa         |
| POST   | /sessao/encerrar   | Encerrar sessão             |

## Protocolo de Callback

O agente envia POST para o \`CALLBACK_URL\` com os seguintes tipos:

- \`lance-enviado\` — Lance enviado com sucesso
- \`lance-concorrente\` — Lance de concorrente detectado
- \`sessao-encerrada\` — Sessão finalizada
- \`erro\` — Erro durante execução
- \`heartbeat\` — Sinal de vida periódico

### Exemplo de callback:

\`\`\`json
{
  "sessao_id": "uuid-da-sessao",
  "tipo": "lance-enviado",
  "payload": {
    "rodada": 3,
    "valor": 45000.00,
    "tipo_lance": "meu"
  }
}
\`\`\`
`,

  'src/index.js': `require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { SessionManager } = require('./session-manager');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3500;
const AGENT_KEY = process.env.AGENT_API_KEY || '';
const sessionManager = new SessionManager();

// Middleware de autenticação
function authMiddleware(req, res, next) {
  const key = req.headers['x-agent-key'];
  if (AGENT_KEY && key !== AGENT_KEY) {
    return res.status(403).json({ error: 'Chave de API inválida' });
  }
  next();
}

// ─── GET /health ───
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    version: '1.0.0',
    uptime: process.uptime(),
    sessoes_ativas: sessionManager.getActiveSessions().length,
    capabilities: [
      'comprasgov',
      'bll',
      'licitacoes-e',
      'pncp',
      'portal-compras',
      'bnc',
      'licitanet',
      'bec-sp',
    ],
    certificado: {
      carregado: !!process.env.CERT_PATH,
      path: process.env.CERT_PATH || null,
    },
  });
});

// ─── POST /sessao/iniciar ───
app.post('/sessao/iniciar', authMiddleware, async (req, res) => {
  try {
    const {
      sessao_id,
      portal_id,
      portal_nome,
      edital,
      valor_referencia,
      valor_inicial,
      valor_minimo,
      decremento_min,
      decremento_percentual,
      intervalo_segundos,
      max_lances,
      credenciais_portal,
    } = req.body;

    const callbackUrl =
      req.headers['x-callback-url'] || process.env.CALLBACK_URL;

    if (!sessao_id || !portal_id) {
      return res
        .status(400)
        .json({ error: 'sessao_id e portal_id são obrigatórios' });
    }

    const session = await sessionManager.createSession({
      sessao_id,
      portal_id,
      portal_nome,
      edital,
      valor_referencia,
      valor_inicial,
      valor_minimo,
      decremento_min,
      decremento_percentual,
      intervalo_segundos: intervalo_segundos || 30,
      max_lances: max_lances || 20,
      credenciais_portal,
      callbackUrl,
      agentKey: AGENT_KEY,
    });

    res.json({ success: true, sessao_id: session.sessao_id, status: 'ativo' });
  } catch (err) {
    console.error('Erro ao iniciar sessão:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /sessao/pausar ───
app.post('/sessao/pausar', authMiddleware, (req, res) => {
  const { sessao_id } = req.body;
  const result = sessionManager.pauseSession(sessao_id);
  if (!result) {
    return res.status(404).json({ error: 'Sessão não encontrada' });
  }
  res.json({ success: true, status: 'pausado' });
});

// ─── POST /sessao/encerrar ───
app.post('/sessao/encerrar', authMiddleware, (req, res) => {
  const { sessao_id } = req.body;
  const result = sessionManager.endSession(sessao_id);
  if (!result) {
    return res.status(404).json({ error: 'Sessão não encontrada' });
  }
  res.json({ success: true, status: 'encerrado' });
});

app.listen(PORT, () => {
  console.log(\`🤖 Agente de Lances rodando na porta \${PORT}\`);
  console.log(\`   Callback URL: \${process.env.CALLBACK_URL || '(não configurada)'}\`);
  console.log(\`   Certificado: \${process.env.CERT_PATH || '(não configurado)'}\`);
});
`,

  'src/session-manager.js': `const { launchBrowser } = require('./browser');
const { sendCallback } = require('./callback');

class SessionManager {
  constructor() {
    /** @type {Map<string, object>} */
    this.sessions = new Map();
  }

  async createSession(config) {
    const session = {
      ...config,
      status: 'ativo',
      rodada: 0,
      valor_atual: config.valor_inicial,
      created_at: new Date(),
      interval: null,
      browser: null,
      page: null,
    };

    this.sessions.set(config.sessao_id, session);

    // Iniciar heartbeat
    session.heartbeatInterval = setInterval(() => {
      sendCallback(session, 'heartbeat', {});
    }, 30000);

    // Iniciar automação
    try {
      const { browser, page } = await launchBrowser();
      session.browser = browser;
      session.page = page;

      // Iniciar loop de lances
      this._startBiddingLoop(session);
    } catch (err) {
      console.error('Erro ao iniciar navegador:', err);
      sendCallback(session, 'erro', { mensagem: err.message });
      session.status = 'erro';
    }

    return session;
  }

  _startBiddingLoop(session) {
    const intervalMs = (session.intervalo_segundos || 30) * 1000;

    session.interval = setInterval(async () => {
      if (session.status !== 'ativo') return;
      if (session.rodada >= session.max_lances) {
        this.endSession(session.sessao_id);
        return;
      }

      try {
        session.rodada++;

        // ═══════════════════════════════════════════
        // AQUI: Implementar a lógica real de cada portal
        // Exemplo genérico:
        // 1. Navegar até a página de disputa
        // 2. Ler valor atual do melhor lance
        // 3. Calcular novo lance (decremento)
        // 4. Submeter lance
        // ═══════════════════════════════════════════

        const decremento = session.decremento_min ||
          session.valor_atual * (session.decremento_percentual / 100);
        const novoValor = Math.max(
          session.valor_atual - decremento,
          session.valor_minimo
        );

        if (novoValor < session.valor_minimo) {
          console.log(\`Sessão \${session.sessao_id}: valor mínimo atingido\`);
          this.endSession(session.sessao_id);
          return;
        }

        session.valor_atual = novoValor;

        // Simular envio real do lance no portal via Puppeteer
        // await this._submitBidOnPortal(session.page, novoValor);

        await sendCallback(session, 'lance-enviado', {
          rodada: session.rodada,
          valor: novoValor,
          tipo_lance: 'meu',
          metadata: { timestamp: new Date().toISOString() },
        });

        console.log(
          \`Sessão \${session.sessao_id} | Rodada \${session.rodada} | Lance: R$ \${novoValor.toFixed(2)}\`
        );
      } catch (err) {
        console.error(\`Erro na rodada \${session.rodada}:\`, err);
        await sendCallback(session, 'erro', { mensagem: err.message });
      }
    }, intervalMs);
  }

  pauseSession(sessaoId) {
    const session = this.sessions.get(sessaoId);
    if (!session) return null;
    session.status = 'pausado';
    if (session.interval) clearInterval(session.interval);
    return session;
  }

  endSession(sessaoId) {
    const session = this.sessions.get(sessaoId);
    if (!session) return null;
    session.status = 'encerrado';
    if (session.interval) clearInterval(session.interval);
    if (session.heartbeatInterval) clearInterval(session.heartbeatInterval);
    if (session.browser) session.browser.close().catch(() => {});

    sendCallback(session, 'sessao-encerrada', {
      resultado: 'finalizado',
      valor_final: session.valor_atual,
      total_rodadas: session.rodada,
    });

    return session;
  }

  getActiveSessions() {
    return [...this.sessions.values()].filter((s) => s.status === 'ativo');
  }
}

module.exports = { SessionManager };
`,

  'src/browser.js': `const puppeteer = require('puppeteer');
const fs = require('fs');
const https = require('https');

/**
 * Lança uma instância do Chromium com suporte a certificado A1.
 */
async function launchBrowser() {
  const certPath = process.env.CERT_PATH;
  const certPassword = process.env.CERT_PASSWORD;

  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
  ];

  // Se certificado A1 (.pfx) estiver configurado
  if (certPath && fs.existsSync(certPath)) {
    console.log(\`📜 Certificado A1 encontrado: \${certPath}\`);
    // Nota: Para mTLS real nos portais, o certificado precisa ser
    // configurado via --client-certificate flags do Chrome ou via
    // proxy HTTPS com o certificado. A implementação exata depende
    // do portal alvo.
    //
    // Exemplo com flags do Chrome (Chromium 120+):
    // args.push(\`--client-certificate=\${certPath}\`);
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  });

  const page = await browser.newPage();

  // Configurar user-agent realista
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  // Configurar viewport padrão
  await page.setViewport({ width: 1366, height: 768 });

  return { browser, page };
}

module.exports = { launchBrowser };
`,

  'src/callback.js': `/**
 * Envia callbacks para o sistema (Lovable Cloud).
 */
async function sendCallback(session, tipo, payload) {
  const url = session.callbackUrl;
  if (!url) {
    console.warn('Callback URL não configurada, pulando envio');
    return;
  }

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Agent-Key': session.agentKey || '',
      },
      body: JSON.stringify({
        sessao_id: session.sessao_id,
        tipo,
        payload,
      }),
    });

    if (!resp.ok) {
      console.error(\`Callback falhou (\${resp.status}):\`, await resp.text());
    }
  } catch (err) {
    console.error('Erro ao enviar callback:', err.message);
  }
}

module.exports = { sendCallback };
`,

  'src/portals/comprasgov.js': `/**
 * Módulo de automação para o portal Compras.gov.br
 *
 * IMPLEMENTAÇÃO NECESSÁRIA:
 * Este arquivo é um esqueleto. Você precisa implementar a lógica
 * específica de navegação do portal Compras.gov.br.
 *
 * Fluxo típico:
 * 1. Acessar https://www.gov.br/compras/pt-br
 * 2. Autenticar com certificado digital
 * 3. Navegar até a sessão de disputa pelo número do edital
 * 4. Ler o melhor lance atual
 * 5. Submeter o novo lance
 * 6. Confirmar envio
 */

class ComprasGovPortal {
  constructor(page) {
    this.page = page;
    this.baseUrl = 'https://www.gov.br/compras/pt-br';
  }

  async login(credenciais) {
    // TODO: Implementar login com certificado digital
    // await this.page.goto(this.baseUrl);
    // Selecionar opção de login com certificado
    // Aguardar autenticação mTLS
    throw new Error('Login com certificado não implementado para Compras.gov');
  }

  async navegarParaDisputa(edital) {
    // TODO: Navegar até a sessão de disputa
    throw new Error('Navegação para disputa não implementada');
  }

  async lerMelhorLance() {
    // TODO: Ler o valor do melhor lance atual na página
    // const valor = await this.page.$eval('.melhor-lance', el => parseFloat(el.textContent));
    throw new Error('Leitura de lance não implementada');
  }

  async enviarLance(valor) {
    // TODO: Preencher campo de lance e submeter
    // await this.page.type('#campo-lance', String(valor));
    // await this.page.click('#btn-enviar-lance');
    // await this.page.waitForSelector('.confirmacao-lance');
    throw new Error('Envio de lance não implementado');
  }
}

module.exports = { ComprasGovPortal };
`,
};

export async function generateAgentTemplate(): Promise<Blob> {
  const zip = new JSZip();
  const root = zip.folder('agente-lances-externo')!;

  for (const [path, content] of Object.entries(FILES)) {
    root.file(path, content);
  }

  // Pasta vazia para certificados
  root.folder('certs');

  return zip.generateAsync({ type: 'blob' });
}
