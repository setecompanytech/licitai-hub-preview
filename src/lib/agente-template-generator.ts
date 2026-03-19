// Generates a downloadable ZIP with the Node.js agent template
import JSZip from 'jszip';
import { PORTAL_FILES } from './agent-template/portals';
import { PORTAL_ESTADUAIS_FILES } from './agent-template/portals-estaduais';
import { INFRA_FILES } from './agent-template/infrastructure';

const CORE_FILES: Record<string, string> = {
  'package.json': `{
  "name": "agente-lances-externo",
  "version": "2.1.0",
  "description": "Agente externo para automação de lances em portais de licitação",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev": "node --watch src/index.js",
    "setup": "bash setup.sh"
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

# Sessões paralelas (cada uma consome ~500MB RAM)
MAX_SESSOES_PARALELAS=3

# URL de callback do sistema (Lovable Cloud)
CALLBACK_URL=https://sbnlovigyifvrkgsoalj.supabase.co/functions/v1/robo-lances-webhook/callback

# ═══ CERTIFICADOS DIGITAIS (LOCAL) ═══
# Os certificados NUNCA são enviados para a nuvem.
# Eles permanecem exclusivamente neste servidor VPS.
#
# Modo 1: Certificado único
# CERT_PATH=./certs/certificado.pfx
# CERT_PASSWORD=senha-do-certificado
#
# Modo 2: Multi-CNPJ (um certificado por empresa)
# Coloque cada .pfx na pasta certs/ nomeado pelo CNPJ:
#   certs/12345678000100.pfx
#   certs/98765432000199.pfx
# E configure as senhas abaixo:
# CERT_PASSWORDS={"12345678000100":"senha1","98765432000199":"senha2"}
#
# Modo 3: Certificado A3 (token/smartcard)
# CERT_MODE=a3
# PKCS11_LIB=/usr/lib/libeTPkcs11.so

# Chrome/Chromium (auto-detectado se não definido)
# PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
`,

  'Dockerfile': `FROM node:20-slim

RUN apt-get update && apt-get install -y \\
    chromium \\
    libnss3 libatk-bridge2.0-0 libx11-xcb1 \\
    libxcomposite1 libxdamage1 libxrandr2 \\
    libgbm1 libasound2 libpangocairo-1.0-0 \\
    libgtk-3-0 fonts-liberation curl \\
    --no-install-recommends && \\
    rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN mkdir -p logs/screenshots

EXPOSE 3500
HEALTHCHECK --interval=30s --timeout=10s CMD curl -f http://localhost:3500/health || exit 1
CMD ["node", "src/index.js"]
`,

  'README.md': `# Agente Externo de Lances v2.1

Servidor dedicado para automação de lances reais em portais de licitação.
Usa Puppeteer + certificado digital A1 para autenticar e enviar lances.

## ⚡ Multi-Sessão Paralela

O agente v2.1 suporta **múltiplas disputas simultâneas**:
- Cada sessão abre seu próprio navegador Chromium (~500MB RAM)
- Configure \`MAX_SESSOES_PARALELAS\` no .env (padrão: 3)
- O /health reporta capacidade e slots disponíveis em tempo real
- Ideal para disputar com múltiplas empresas no mesmo horário

### RAM Recomendada

| Sessões | RAM mínima | VPS sugerido |
|---------|-----------|--------------|
| 1       | 2GB       | VPS básico   |
| 2-3     | 4GB       | VPS 2        |
| 4-6     | 8GB       | VPS 4        |

## Portais Suportados

| Portal | ID | Autenticação |
|---|---|---|
| Compras.gov.br | comprasgov | Certificado A1 (gov.br) |
| BLL | bll | Login + Senha |
| Licitações-e (BB) | licitacoes-e | Login + Senha |
| PNCP | pncp | Certificado A1 (gov.br) |
| BEC-SP | bec-sp | Login + Senha + Certificado |
| Licitanet | licitanet | Login + Senha |
| Portal de Compras | portal-compras | Login + Senha |
| BNC | bnc | Login + Senha |

## Instalação Rápida (Ubuntu/Debian)

\\\`\\\`\\\`bash
chmod +x setup.sh && bash setup.sh
\\\`\\\`\\\`

## Docker

\\\`\\\`\\\`bash
docker compose up -d
\\\`\\\`\\\`

## HTTPS (Produção)

\\\`\\\`\\\`bash
sudo bash setup-nginx.sh agente.seudominio.com.br
\\\`\\\`\\\`

## Endpoints

| Método | Rota | Descrição | Auth |
|---|---|---|---|
| GET | /health | Status, capacidade, sessões ativas | Não |
| POST | /sessao/iniciar | Iniciar sessão paralela | X-Agent-Key |
| POST | /sessao/pausar | Pausar sessão ativa | X-Agent-Key |
| POST | /sessao/encerrar | Encerrar sessão e liberar slot | X-Agent-Key |

## Protocolo de Callback

O agente envia POST para o \\\`CALLBACK_URL\\\` com:

- \\\`lance-enviado\\\` — Lance enviado com sucesso
- \\\`lance-concorrente\\\` — Lance de concorrente detectado
- \\\`sessao-encerrada\\\` — Sessão finalizada
- \\\`erro\\\` — Erro durante execução
- \\\`heartbeat\\\` — Sinal de vida + capacidade (30s)
`,

  'src/index.js': `require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { SessionManager } = require('./session-manager');
const { PORTALS } = require('./portals');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3500;
const AGENT_KEY = process.env.AGENT_API_KEY || '';
const sessionManager = new SessionManager();

function authMiddleware(req, res, next) {
  const key = req.headers['x-agent-key'];
  if (AGENT_KEY && key !== AGENT_KEY) {
    return res.status(403).json({ error: 'Chave de API inválida' });
  }
  next();
}

// ─── GET /health ───
app.get('/health', (req, res) => {
  const capacity = sessionManager.getCapacity();
  res.json({
    status: 'online',
    version: '2.1.0',
    uptime: process.uptime(),
    capacidade: capacity,
    sessoes_ativas: capacity.sessoes_ativas,
    sessoes: sessionManager.getAllSessions(),
    portais_suportados: Object.keys(PORTALS),
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
      sessao_id, portal_id, portal_nome, edital,
      valor_referencia, valor_inicial, valor_minimo,
      decremento_min, decremento_percentual,
      intervalo_segundos, max_lances, credenciais_portal,
    } = req.body;

    const callbackUrl = req.headers['x-callback-url'] || process.env.CALLBACK_URL;

    if (!sessao_id || !portal_id) {
      return res.status(400).json({ error: 'sessao_id e portal_id são obrigatórios' });
    }

    if (!PORTALS[portal_id]) {
      return res.status(400).json({
        error: \`Portal "\${portal_id}" não suportado\`,
        disponiveis: Object.keys(PORTALS),
      });
    }

    const session = await sessionManager.createSession({
      sessao_id, portal_id, portal_nome, edital,
      valor_referencia, valor_inicial, valor_minimo,
      decremento_min, decremento_percentual,
      intervalo_segundos: intervalo_segundos || 30,
      max_lances: max_lances || 20,
      credenciais_portal, callbackUrl, agentKey: AGENT_KEY,
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
  if (!result) return res.status(404).json({ error: 'Sessão não encontrada' });
  res.json({ success: true, status: 'pausado' });
});

// ─── POST /sessao/encerrar ───
app.post('/sessao/encerrar', authMiddleware, (req, res) => {
  const { sessao_id } = req.body;
  const result = sessionManager.endSession(sessao_id);
  if (!result) return res.status(404).json({ error: 'Sessão não encontrada' });
  res.json({ success: true, status: 'encerrado' });
});

app.listen(PORT, () => {
  console.log(\`🤖 Agente de Lances v2.0 rodando na porta \${PORT}\`);
  console.log(\`   Portais: \${Object.keys(PORTALS).join(', ')}\`);
  console.log(\`   Callback: \${process.env.CALLBACK_URL || '(não configurada)'}\`);
  console.log(\`   Certificado: \${process.env.CERT_PATH || '(não configurado)'}\`);
});
`,

  'src/session-manager.js': `const { launchBrowser } = require('./browser');
const { sendCallback } = require('./callback');
const { getPortal } = require('./portals');
const os = require('os');

/**
 * Gerenciador de sessões paralelas.
 * Cada sessão abre sua própria instância do Chromium (~500MB RAM).
 * O limite de sessões simultâneas é calculado com base na RAM disponível.
 */
class SessionManager {
  constructor() {
    this.sessions = new Map();
    this.maxParallel = parseInt(process.env.MAX_SESSOES_PARALELAS || '3', 10);
  }

  /**
   * Calcula quantas sessões paralelas o servidor suporta com base na RAM.
   * Reserva 512MB para o SO e ~500MB por sessão Chromium.
   */
  getCapacity() {
    const totalMB = Math.floor(os.totalmem() / 1024 / 1024);
    const freeMB = Math.floor(os.freemem() / 1024 / 1024);
    const activeSessions = this.getActiveSessions().length;
    const calculatedMax = Math.max(1, Math.floor((totalMB - 512) / 500));
    const effectiveMax = Math.min(this.maxParallel, calculatedMax);

    return {
      max_sessoes: effectiveMax,
      sessoes_ativas: activeSessions,
      slots_disponiveis: Math.max(0, effectiveMax - activeSessions),
      ram_total_mb: totalMB,
      ram_livre_mb: freeMB,
      ram_por_sessao_mb: 500,
    };
  }

  async createSession(config) {
    const capacity = this.getCapacity();
    if (capacity.slots_disponiveis <= 0) {
      throw new Error(
        \`Limite de sessões paralelas atingido (\${capacity.max_sessoes}). \` +
        \`RAM disponível: \${capacity.ram_livre_mb}MB. \` +
        \`Encerre uma sessão ativa ou aumente a RAM do servidor.\`
      );
    }

    const session = {
      ...config,
      status: 'ativo',
      rodada: 0,
      valor_atual: config.valor_inicial,
      created_at: new Date(),
      interval: null,
      browser: null,
      page: null,
      portal: null,
    };

    this.sessions.set(config.sessao_id, session);

    // Heartbeat — inclui info de capacidade
    session.heartbeatInterval = setInterval(() => {
      sendCallback(session, 'heartbeat', {
        rodada: session.rodada,
        valor_atual: session.valor_atual,
        capacidade: this.getCapacity(),
      });
    }, 30000);

    try {
      // Cada sessão recebe seu próprio browser (instância Chromium isolada)
      console.log(\`🚀 Abrindo sessão \${config.sessao_id} (browser #\${this.getActiveSessions().length})\`);
      const { browser, page } = await launchBrowser();
      session.browser = browser;
      session.page = page;

      // Instanciar o módulo do portal correto
      session.portal = getPortal(config.portal_id, page, config.credenciais_portal || {});

      // Login no portal
      console.log(\`🔐 [\${config.sessao_id}] Login no portal: \${config.portal_id}\`);
      await session.portal.login();

      // Navegar para a disputa
      console.log(\`📋 [\${config.sessao_id}] Navegando para edital: \${config.edital}\`);
      await session.portal.navegarParaDisputa(config.edital);

      // Iniciar loop de lances
      this._startBiddingLoop(session);

      console.log(\`✅ Sessão \${config.sessao_id} ativa. Total ativas: \${this.getActiveSessions().length}\`);
    } catch (err) {
      console.error(\`❌ Erro ao iniciar sessão \${config.sessao_id}:\`, err);
      sendCallback(session, 'erro', { mensagem: err.message });
      session.status = 'erro';
      // Liberar browser para não travar slots
      if (session.browser) session.browser.close().catch(() => {});
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

        // 1. Ler melhor lance atual no portal
        const melhorLance = await session.portal.lerMelhorLance();
        if (melhorLance !== null && melhorLance < session.valor_atual) {
          await sendCallback(session, 'lance-concorrente', {
            rodada: session.rodada,
            valor: melhorLance,
            metadata: { timestamp: new Date().toISOString() },
          });
        }

        // 2. Calcular novo lance
        const decremento = session.decremento_min ||
          session.valor_atual * ((session.decremento_percentual || 1) / 100);
        const novoValor = Math.max(
          (melhorLance || session.valor_atual) - decremento,
          session.valor_minimo
        );

        if (novoValor <= session.valor_minimo) {
          console.log(\`[\${session.sessao_id}] Valor mínimo atingido\`);
          this.endSession(session.sessao_id);
          return;
        }

        // 3. Enviar lance real no portal
        await session.portal.enviarLance(novoValor);
        session.valor_atual = novoValor;

        // 4. Verificar resultado
        const resultado = await session.portal.verificarResultado?.() || 'enviado';

        await sendCallback(session, 'lance-enviado', {
          rodada: session.rodada,
          valor: novoValor,
          tipo_lance: 'meu',
          resultado,
          metadata: { timestamp: new Date().toISOString() },
        });

        console.log(
          \`[\${session.sessao_id}] Rodada \${session.rodada} | R$ \${novoValor.toFixed(2)} | \${resultado}\`
        );
      } catch (err) {
        console.error(\`[\${session.sessao_id}] Erro rodada \${session.rodada}:\`, err);
        await session.portal.screenshot?.('erro-rodada-' + session.rodada).catch(() => {});
        await sendCallback(session, 'erro', { mensagem: err.message, rodada: session.rodada });
      }
    }, intervalMs);
  }

  pauseSession(sessaoId) {
    const session = this.sessions.get(sessaoId);
    if (!session) return null;
    session.status = 'pausado';
    if (session.interval) clearInterval(session.interval);
    console.log(\`⏸️ Sessão \${sessaoId} pausada. Ativas: \${this.getActiveSessions().length}\`);
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

    console.log(\`🏁 Sessão \${sessaoId} encerrada. Ativas: \${this.getActiveSessions().length}\`);
    return session;
  }

  getActiveSessions() {
    return [...this.sessions.values()].filter((s) => s.status === 'ativo');
  }

  getAllSessions() {
    return [...this.sessions.entries()].map(([id, s]) => ({
      sessao_id: id,
      status: s.status,
      portal_id: s.portal_id,
      edital: s.edital,
      rodada: s.rodada,
      valor_atual: s.valor_atual,
      created_at: s.created_at,
    }));
  }
}

module.exports = { SessionManager };
`,

  'src/browser.js': `const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

/**
 * Gerenciador de certificados locais.
 * Suporta: A1 (arquivo .pfx), Multi-CNPJ, A3 (token/smartcard via PKCS#11).
 * IMPORTANTE: Os certificados NUNCA saem deste servidor.
 */
function getCertConfig(cnpj) {
  const certMode = process.env.CERT_MODE || 'a1';

  if (certMode === 'a3') {
    console.log('🔐 Modo A3 (token/smartcard) — usando PKCS#11');
    return { mode: 'a3', pkcs11Lib: process.env.PKCS11_LIB || '/usr/lib/libeTPkcs11.so' };
  }

  // Multi-CNPJ: busca certs/<cnpj>.pfx
  if (cnpj) {
    const cnpjClean = cnpj.replace(/\\D/g, '');
    const multiPath = path.join('./certs', cnpjClean + '.pfx');
    if (fs.existsSync(multiPath)) {
      let passwords = {};
      try { passwords = JSON.parse(process.env.CERT_PASSWORDS || '{}'); } catch {}
      console.log(\`📜 Certificado multi-CNPJ encontrado: \${multiPath}\`);
      return { mode: 'a1', path: multiPath, password: passwords[cnpjClean] || '' };
    }
  }

  // Certificado único padrão
  const certPath = process.env.CERT_PATH || './certs/certificado.pfx';
  if (fs.existsSync(certPath)) {
    console.log(\`📜 Certificado A1 encontrado: \${certPath}\`);
    return { mode: 'a1', path: certPath, password: process.env.CERT_PASSWORD || '' };
  }

  console.warn('⚠️ Nenhum certificado encontrado em certs/');
  return { mode: 'none' };
}

async function launchBrowser(cnpj) {
  const cert = getCertConfig(cnpj);

  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--window-size=1366,768',
  ];

  // Para certificado A3 via PKCS#11
  if (cert.mode === 'a3' && cert.pkcs11Lib) {
    args.push(\`--load-extension=\${cert.pkcs11Lib}\`);
  }

  // Criar diretório de screenshots
  fs.mkdirSync('./logs/screenshots', { recursive: true });

  const browser = await puppeteer.launch({
    headless: 'new',
    args,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  });

  const page = await browser.newPage();

  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  await page.setViewport({ width: 1366, height: 768 });

  return { browser, page, cert };
}

module.exports = { launchBrowser, getCertConfig };
`,

  'src/callback.js': `async function sendCallback(session, tipo, payload) {
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
};

export async function generateAgentTemplate(): Promise<Blob> {
  const zip = new JSZip();
  const root = zip.folder('agente-lances-externo')!;

  // Core files
  for (const [path, content] of Object.entries(CORE_FILES)) {
    root.file(path, content);
  }

  // Portal modules
  for (const [path, content] of Object.entries(PORTAL_FILES)) {
    root.file(path, content);
  }

  // State/regional portal modules
  for (const [path, content] of Object.entries(PORTAL_ESTADUAIS_FILES)) {
    root.file(path, content);
  }

  // Infrastructure files
  for (const [path, content] of Object.entries(INFRA_FILES)) {
    root.file(path, content);
  }

  // Empty directories
  root.folder('certs');
  root.folder('logs/screenshots');

  return zip.generateAsync({ type: 'blob' });
}
