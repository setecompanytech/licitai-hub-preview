// Generates a downloadable ZIP with the Node.js agent template
import JSZip from 'jszip';
import { PORTAL_FILES } from './agent-template/portals';
import { PORTAL_ESTADUAIS_FILES } from './agent-template/portals-estaduais';
import { INFRA_FILES } from './agent-template/infrastructure';
import { ESTRATEGIA_FILES } from './agent-template/estrategia';

const CORE_FILES: Record<string, string> = {
  'package.json': `{
  "name": "agente-lances-externo",
  "version": "2.2.0",
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

# URL de callback do sistema
CALLBACK_URL=https://uwtyuwktxalnpgrcbbgk.supabase.co/functions/v1/robo-lances-webhook/callback

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

# ═══ GRAVADOR DA SESSÃO ═══
# Foto + raio-X do DOM em logs/sessoes/<id>/ a cada N segundos, para mapear a
# sala de disputa DEPOIS, sem ninguém olhando na hora. 0 desliga.
# GRAVADOR_INTERVALO_S=10
`,

  'Dockerfile': `FROM node:20-slim

RUN apt-get update && apt-get install -y \\
    chromium \\
    libnss3 libnss3-tools libatk-bridge2.0-0 libx11-xcb1 \\
    libxcomposite1 libxdamage1 libxrandr2 \\
    libgbm1 libasound2 libpangocairo-1.0-0 \\
    libgtk-3-0 fonts-liberation curl \\
    --no-install-recommends && \\
    rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
# Dentro do container o loopback tornaria o agente inalcancavel de fora.
ENV BIND_HOST=0.0.0.0
# Aqui o navegador e o chromium do sistema, cuja pasta de policy nao e a mesma
# do "Chrome for Testing" que o Puppeteer baixa fora do container.
ENV CHROME_POLICY_DIR=/etc/chromium/policies/managed

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

### Federais
| Portal | ID | Autenticação |
|---|---|---|
| Compras.gov.br | comprasgov | Certificado A1 (gov.br) |
| PNCP | pncp | Certificado A1 (gov.br) |

### Privados (Bolsas Eletrônicas)
| Portal | ID | Autenticação |
|---|---|---|
| BLL | bll | Login + Senha |
| Licitações-e (BB) | licitacoes-e | Login + Senha |
| BNC | bnc | Login + Senha |
| Portal de Compras | portal-compras | Login + Senha |
| Licitanet | licitanet | Login + Senha |
| BBMNet | bbmnet | Login + Senha + Certificado |
| ComprasBR | comprasbr | Login + Senha |
| Licitar Digital | licitar-digital | Login + Senha |

### Estaduais
| Portal | ID | Autenticação |
|---|---|---|
| BEC-SP | bec-sp | Login + Senha + Certificado |
| Banparanet (PA) | banparanet | Login + Senha + Certificado |
| ComprasNet BA | comprasnet-ba | Login + Senha |
| ComprasNet GO | comprasnet-go | Login + Senha |
| Compras MG | compras-mg | Login + Senha |
| PE Integrado | compras-pe | Login + Senha |
| Compras RJ | compras-rj | Login + Senha |
| Compras PR | compras-pr | Login + Senha |
| Compras RS | compras-rs | Login + Senha |
| Compras SC | compras-sc | Login + Senha |
| e-Compras DF | compras-df | Login + Senha |
| e-Compras AM | e-compras-am | Login + Senha |
| Portal Compras CE | portal-compras-ce | Login + Senha |

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
- \\\`mensagem-pregoeiro\\\` — O pregoeiro escreveu na sala (só nos portais que sabem ler o chat)
- \\\`sessao-encerrada\\\` — Sessão finalizada
- \\\`erro\\\` — Erro durante execução
- \\\`heartbeat\\\` — Sinal de vida + capacidade (30s)
`,

  'src/index.js': `require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { SessionManager } = require('./session-manager');
const { PORTALS, getPortal } = require('./portals');
const { launchBrowser } = require('./browser');
const { PORTAIS_COM_LANCE_LIBERADO } = require('./estrategia');
const certificado = require('./certificado');
const interacaoHumana = require('./interacao-humana');
const fs = require('fs');
const path = require('path');
// Usado só pela rota /sessao/focar, para falar com o xdotool. Nada de entrada
// do usuário entra nesses comandos: o único valor interpolado é um PID que o
// próprio agente guardou ao abrir o navegador.
const { execSync } = require('child_process');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3500;
const AGENT_KEY = process.env.AGENT_API_KEY || '';
const sessionManager = new SessionManager();

// Rotas que ESTA versão do agente implementa, publicadas no /health.
// Sem essa lista o Praefectus não tem como saber o que existe aqui: HEAD devolve
// 404 tanto para rota ausente quanto para rota que só aceita POST, e OPTIONS
// devolve 204 para qualquer caminho por causa do CORS. Sondar o /kill-switch às
// cegas para descobrir abortaria uma disputa real.
const ROTAS = [
  'GET /health',
  'POST /sessao/iniciar',
  'POST /sessao/pausar',
  'POST /sessao/encerrar',
  'POST /sessao/retomar',
  'POST /kill-switch',
  'GET /sessoes',
  'GET /portais',
  'POST /api/proposta/enviar',
  'POST /certificado',
  'POST /sessao/responder',
  'POST /sessao/focar',
  'GET /sessao/:id/inspecionar',
  'GET /sessao/:id/gravacoes',
];

// A primeira versao conferia se a VARIAVEL CERT_PATH estava preenchida, nunca se
// o arquivo existia — a pasta certs/ da VPS estava vazia e o checklist ficava
// verde. A segunda passou a conferir o arquivo, e ainda ficava verde com o
// certificado que o Chrome nao tinha como apresentar.
//
// Agora quem responde e o modulo que faz a instalacao, olhando as tres coisas
// que precisam ser verdade: arquivo, chave na base NSS e policy de auto-selecao.
function certificadoInstalado() {
  try {
    return certificado.estado();
  } catch (e) {
    // Estado indisponivel nao pode virar "carregado: true" nem derrubar o
    // /health, que e o que o painel usa para saber se o agente esta vivo.
    return { carregado: false, path: process.env.CERT_PATH || null, motivo: 'nao foi possivel ler o estado do certificado: ' + e.message };
  }
}

function authMiddleware(req, res, next) {
  const key = req.headers['x-agent-key'];
  if (AGENT_KEY && key !== AGENT_KEY) {
    return res.status(403).json({ error: 'Chave de API inválida' });
  }
  next();
}


// ─── POST /sessao/responder ───
//
// A pessoa entrega o que a tela pediu; quem digita e o robo.
//
// Existe por uma medicao: em 09/09/2026 o codigo do gov.br levava ~50s para ir
// do celular ate o campo, passando por WhatsApp, leitura e teclado remoto. O
// codigo vale ~60s. Tres tentativas queimaram e a conta do cliente foi
// bloqueada por excesso de erro — os codigos nao estavam errados, estavam
// velhos. Por aqui o mesmo numero chega em ~2s.
app.post('/sessao/responder', authMiddleware, (req, res) => {
  const { sessao_id, valor } = req.body || {};
  if (!sessao_id || valor === undefined || valor === null || valor === '') {
    return res.status(400).json({ error: 'sessao_id e valor sao obrigatorios' });
  }

  const pedido = interacaoHumana.pendente(sessao_id);
  if (!pedido) {
    // Diferente de erro: pode ser resposta que chegou depois de a tela seguir
    // sozinha. Dizer isso evita que a interface acuse falha onde nao houve.
    return res.status(409).json({
      error: 'Nao ha nada pendente nesta sessao',
      sessao_id,
      aceito: false,
    });
  }

  interacaoHumana.responder(sessao_id, valor);
  // O valor NAO entra em log: e codigo de acesso de conta de terceiro.
  console.log('🧑 Resposta recebida para ' + sessao_id + ' (' + pedido.tipo + ')');
  res.json({ aceito: true, sessao_id, tipo: pedido.tipo });
});

// ─── GET /health ───
app.get('/health', (req, res) => {
  const capacity = sessionManager.getCapacity();
  res.json({
    status: 'online',
    version: '2.2.0',
    uptime: process.uptime(),
    capacidade: capacity,
    sessoes_ativas: capacity.sessoes_ativas,
    sessoes: sessionManager.getAllSessions(),
    portais_suportados: Object.keys(PORTALS),
    rotas: ROTAS,
    // O que esta parado esperando uma pessoa. A interface le daqui para decidir
    // se mostra campo de codigo, aviso de captcha, ou nada — em vez de ter isso
    // configurado por portal, que envelheceria no dia em que o cliente
    // desligasse a verificacao em duas etapas.
    aguardando_humano: interacaoHumana.todos(),
    // Como os pedidos recentes terminaram. A interface usa para dizer
    // "recebido, o robo seguiu" em vez de deixar o cartao sumir em silencio.
    desfechos_humano: interacaoHumana.desfechosRecentes(),
    // Quais portais podem ENVIAR lance. Lista vazia = o agente le e calcula,
    // mas nao submete nada. O painel precisa poder mostrar isso.
    portais_com_lance_liberado: PORTAIS_COM_LANCE_LIBERADO,
    certificado: certificadoInstalado(),
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
      // O ALVO dentro do processo.
      //
      // Esta rota desestrutura uma lista FIXA e repassa campo a campo — o que
      // nao estiver nomeado aqui e descartado silenciosamente, por mais que
      // quem chamou tenha enviado. Foi assim que os itens quase chegaram ao
      // agente sem chegar: a edge function mandava, o session-manager sabia
      // usar, e esta linha no meio jogava fora.
      //
      // E foi assim de novo com a UASG (14/09/2026, sessao 903d686e): o
      // front mandava 925315, a edge function repassava, o session-manager
      // guardava — e esta lista nao a nomeava. Chegou null; sem ela a busca
      // do Compras.gov achou dez "7/2026" de outros orgaos e nenhum da SEDUC.
      itens, tipo_disputa, uasg, cnpj_empresa,
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
      // Normalizado aqui, na entrada: o session-manager e o modulo do portal
      // tratam ausencia como "abrir o processo e parar", e nao como erro.
      itens: Array.isArray(itens) ? itens : [],
      tipo_disputa: tipo_disputa || null,
      uasg: uasg ? String(uasg) : null,
      // E assim que o robo se acha na classificacao publica do item. Nomeado
      // aqui de proposito: campo fora desta lista some em silencio (ja foi
      // assim com os itens e com a UASG).
      cnpj_empresa: cnpj_empresa ? String(cnpj_empresa) : null,
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
  const result = sessionManager.endSession(sessao_id, 'Encerrada a pedido, pelo painel');
  if (!result) return res.status(404).json({ error: 'Sessão não encontrada' });
  res.json({ success: true, status: 'encerrado' });
});

// ─── POST /sessao/focar ───
//
// Traz para a frente a janela do Chrome DAQUELA sessão.
//
// Por que isto existe: todas as sessões desenham na MESMA tela virtual (:99).
// O agente aguenta 8 simultâneas e o Rafael descreveu vários pregoes no mesmo
// horario como rotina — na pratica, oito janelas empilhadas e o VNC mostrando
// so a de cima. Sem isto, "assistir ao pregao X" nao e uma acao possivel.
//
// A alternativa era uma tela virtual por sessao (Xvfb :99, :100, :101…), com
// x11vnc e websockify proprios. Resolve mais (duas abas lado a lado), custa
// muito mais: portas, RAM e CPU por sessao. Escolhido alternar numa tela so.
app.post('/sessao/focar', authMiddleware, (req, res) => {
  const { sessao_id } = req.body;
  if (!sessao_id) return res.status(400).json({ error: 'sessao_id e obrigatorio' });

  const sessao = sessionManager.sessions.get(sessao_id);
  if (!sessao) return res.status(404).json({ error: 'Sessão não encontrada' });

  // O PID do Chrome daquela sessao, guardado quando o navegador abriu.
  //
  // Procurar a janela por TITULO seria o caminho obvio e o errado: dois pregoes
  // no mesmo portal tem titulo identico, e ativar "a primeira que casar" e
  // exatamente o defeito que esta rota existe para corrigir.
  if (!sessao.chromePid) {
    return res.status(409).json({
      error: 'A sessão não registrou o processo do navegador — não dá para saber qual janela é dela',
    });
  }

  try {
    // O search por --pid usa a propriedade _NET_WM_PID que o Chrome publica na
    // janela. Sem a opcao sync de proposito: se a janela ainda nao existe, e
    // melhor falhar rapido do que pendurar a requisicao esperando.
    const achadas = execSync(\`xdotool search --pid \${sessao.chromePid} --onlyvisible 2>/dev/null || true\`)
      .toString().trim().split('\\n').filter(Boolean);

    if (!achadas.length) {
      return res.status(404).json({
        error: 'Nenhuma janela visível encontrada para esta sessão (o navegador pode ter fechado)',
      });
    }

    // A ULTIMA e a janela principal: o Chrome cria janelas auxiliares antes.
    const janela = achadas[achadas.length - 1];
    const ambiente = { env: { ...process.env, DISPLAY: process.env.DISPLAY || ':99' } };

    // windowraise, e NAO windowactivate.
    //
    // Verificado em 10/09/2026 contra a VPS: activate falha com "Your
    // windowmanager claims not to support _NET_ACTIVE_WINDOW". E verdade — o
    // Xvfb roda pelado, sem gerenciador de janelas nenhum, entao nao ha quem
    // responda por esse protocolo. raise chama XRaiseWindow direto no servidor
    // X e nao depende de WM, que e exatamente o caso aqui.
    execSync(\`xdotool windowraise \${janela}\`, ambiente);

    // O foco de teclado e um extra: quem digita o codigo de verificacao e o
    // robo, e quem clica no captcha e a pessoa pelo VNC, que envia o evento
    // para onde o ponteiro esta. Se falhar, a janela ja esta na frente — que
    // era o pedido. Por isso o erro e engolido de proposito.
    try {
      execSync(\`xdotool windowfocus \${janela}\`, ambiente);
    } catch {
      /* sem WM o foco pode ser recusado; a janela subiu, que e o que importa */
    }

    console.log(\`🖥️  Janela da sessão \${sessao_id} trazida para frente (\${sessao.edital})\`);
    res.json({ success: true, sessao_id, edital: sessao.edital, janela });
  } catch (err) {
    // Falha aqui nao derruba nada — a sessao segue rodando, so nao foi para a
    // frente. Dizer o motivo evita que vire "o VNC esta quebrado".
    console.error(\`❌ Nao foi possivel focar a sessao \${sessao_id}:\`, err.message);
    res.status(500).json({ error: 'Nao foi possivel trazer a janela para frente: ' + err.message });
  }
});

// ─── GET /sessao/:id/inspecionar ───
//
// O raio-X da tela DAQUELA sessao, agora: URL, texto visivel de cada frame,
// campos com atributos, cada valor em reais com o caminho no DOM, tabelas.
// So leitura, nada e clicado. E o que permite escrever seletor olhando o DOM
// real da sala de disputa em vez de adivinhar por foto — o gravador guarda o
// mesmo raio-X a cada N segundos; esta rota e para quem esta olhando ao vivo.
app.get('/sessao/:id/inspecionar', authMiddleware, async (req, res) => {
  const sessao = sessionManager.sessions.get(req.params.id);
  if (!sessao) return res.status(404).json({ error: 'Sessão não encontrada' });
  if (!sessao.portal || typeof sessao.portal.inspecionarTela !== 'function') {
    return res.status(409).json({ error: 'A sessão ainda não tem navegador aberto' });
  }
  try {
    const raio = await sessao.portal.inspecionarTela();
    res.json({ sessao_id: req.params.id, edital: sessao.edital, status: sessao.status, ...raio });
  } catch (err) {
    res.status(500).json({ error: 'Nao consegui inspecionar a tela: ' + err.message });
  }
});

// ─── GET /sessao/:id/gravacoes ───
//
// O que o gravador ja guardou desta sessao: lista de arquivos com tamanho.
// Serve para saber, de fora, se ha material para mapear — antes de abrir SSH.
app.get('/sessao/:id/gravacoes', authMiddleware, (req, res) => {
  const sessao = sessionManager.sessions.get(req.params.id);
  const dir = (sessao && sessao.gravadorDir) || path.join('./logs/sessoes', String(req.params.id));
  let arquivos = [];
  try {
    arquivos = fs.readdirSync(dir).sort().map((nome) => {
      const st = fs.statSync(path.join(dir, nome));
      return { nome, bytes: st.size };
    });
  } catch (e) {
    return res.status(404).json({ error: 'Nenhuma gravação encontrada para esta sessão', pasta: dir });
  }
  res.json({
    sessao_id: req.params.id,
    pasta: dir,
    ligado: !!(sessao && sessao.gravadorInterval),
    capturas: arquivos.filter((a) => a.nome.endsWith('.json')).length,
    arquivos,
  });
});

// ─── POST /sessao/retomar ───
app.post('/sessao/retomar', authMiddleware, (req, res) => {
  const { sessao_id } = req.body;
  const result = sessionManager.resumeSession(sessao_id);
  if (!result) return res.status(404).json({ error: 'Sessão não encontrada ou não pausada' });
  res.json({ success: true, status: 'ativo' });
});

// ─── POST /kill-switch ───
// Encerra TODAS as sessões imediatamente
app.post('/kill-switch', authMiddleware, (req, res) => {
  const { motivo } = req.body;
  console.log(\`🛑 KILL SWITCH ACIONADO: \${motivo || 'Sem motivo'}\`);
  const encerradas = sessionManager.killAll(motivo);
  res.json({ success: true, sessoes_encerradas: encerradas, motivo });
});

// ─── POST /api/proposta/enviar ───
// Envio da proposta INICIAL, antes da disputa. Não é uma sessão de lance: abre
// o navegador, faz login, preenche o formulário de proposta, fecha. Quem chama
// é a edge function 'enviar-proposta-portal' (botão "Enviar Proposta").
//
// Cada resposta diz exatamente o que houve — 404 genérico foi o que deixou o
// Praefectus meses sem saber se a rota faltava ou se o envio tinha falhado.
app.post('/api/proposta/enviar', authMiddleware, async (req, res) => {
  const {
    portal, numero_pregao, itens, declaracoes, anexos_urls,
    credenciais_portal, credencial_id, empresa_id, user_id,
  } = req.body;

  if (!portal || !numero_pregao || !Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({
      error: 'portal, numero_pregao e itens[] (não vazio) são obrigatórios',
      recebido: { portal: portal || null, numero_pregao: numero_pregao || null, itens: Array.isArray(itens) ? itens.length : null },
    });
  }

  if (!PORTALS[portal]) {
    return res.status(400).json({
      error: \`Portal "\${portal}" não suportado\`,
      disponiveis: Object.keys(PORTALS),
    });
  }

  // Enviar proposta é opcional por portal: cada um tem um formulário próprio, e
  // implementar um não implementa os outros. Checado ANTES de abrir o navegador —
  // não se gasta 500MB e alguns segundos para descobrir que o portal não tem o
  // fluxo. O 501 nomeia o portal que falta, em vez de deixar o operador achando
  // que o agente está fora do ar.
  if (typeof PORTALS[portal].prototype.enviarProposta !== 'function') {
    return res.status(501).json({
      error: \`O portal "\${portal}" ainda não automatiza o envio de proposta neste agente\`,
      portal,
      implementado: false,
    });
  }

  // O envio abre um Chromium próprio (~500MB). Respeita o mesmo teto das
  // sessões de lance para não derrubar uma disputa em andamento por falta de RAM.
  const capacity = sessionManager.getCapacity();
  if (capacity.slots_disponiveis < 1) {
    return res.status(503).json({
      error: 'Sem slots livres para abrir o navegador — aguarde uma sessão encerrar',
      capacidade: capacity,
    });
  }

  const inicio = Date.now();
  let browser = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    const instancia = getPortal(portal, page, credenciais_portal || {});

    console.log(\`📄 Enviando proposta — portal=\${portal} pregão=\${numero_pregao} itens=\${itens.length}\`);
    await instancia.login();

    const resultado = await instancia.enviarProposta({
      numero_pregao,
      itens,
      declaracoes: declaracoes || {},
      anexos_urls: anexos_urls || [],
      empresa_id: empresa_id || null,
      credencial_id: credencial_id || null,
    });

    console.log(\`✅ Proposta enviada — portal=\${portal} pregão=\${numero_pregao}\`);
    res.json({
      success: true,
      portal,
      numero_pregao,
      itens_enviados: itens.length,
      protocolo: (resultado && resultado.protocolo) || null,
      comprovante: (resultado && resultado.comprovante) || null,
      duracao_ms: Date.now() - inicio,
      user_id: user_id || null,
    });
  } catch (err) {
    console.error(\`❌ Falha ao enviar proposta (\${portal}/\${numero_pregao}):\`, err);
    let screenshot = null;
    try {
      const pages = await browser.pages();
      if (pages.length) {
        screenshot = \`./logs/screenshots/proposta-\${portal}-\${Date.now()}.png\`;
        await pages[pages.length - 1].screenshot({ path: screenshot });
      }
    } catch { /* screenshot é melhor-esforço; nunca esconde o erro original */ }

    res.status(500).json({
      error: err.message,
      portal,
      numero_pregao,
      screenshot,
      duracao_ms: Date.now() - inicio,
    });
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
});

// ─── GET /sessoes ───
// Lista todas as sessões com status detalhado
app.get('/sessoes', authMiddleware, (req, res) => {
  res.json({
    sessoes: sessionManager.getAllSessions(),
    capacidade: sessionManager.getCapacity(),
  });
});

// ─── GET /portais ───
// Lista portais suportados com metadados
app.get('/portais', (req, res) => {
  res.json({
    portais: Object.entries(PORTALS).map(([id, info]) => ({
      id,
      nome: info.nome || id,
      tipo: info.tipo || 'desconhecido',
    })),
    total: Object.keys(PORTALS).length,
  });
});

// ─── POST /certificado ───
// Recebe o .pfx e o INSTALA de fato: arquivo, base NSS do Chrome e policy de
// auto-selecao. Antes desta rota o certificado subia para o Storage do Supabase
// e parava ali — nada o trazia para ca, e o agente nao tinha por onde receber.
//
// O corpo vem em base64 porque o restante do protocolo com o Praefectus e JSON;
// um multipart so para este caso exigiria outra dependencia no agente.
app.post('/certificado', authMiddleware, async (req, res) => {
  try {
    const { arquivo_base64, senha } = req.body || {};

    if (!arquivo_base64 || !senha) {
      return res.status(400).json({ error: 'arquivo_base64 e senha sao obrigatorios' });
    }

    const buffer = Buffer.from(arquivo_base64, 'base64');
    if (buffer.length === 0) {
      return res.status(400).json({ error: 'arquivo vazio ou base64 invalido' });
    }

    // A senha nao entra em log nenhum — nem aqui, nem no modulo de instalacao.
    console.log('📜 Recebido certificado A1 (' + buffer.length + ' bytes) — instalando');
    const estado = certificado.instalar(buffer, senha);

    console.log(estado.carregado
      ? '✅ Certificado instalado e apresentavel: ' + estado.titulares.join(', ')
      : '⚠️  Certificado gravado mas ainda nao apresentavel: ' + estado.motivo);

    res.json({ sucesso: estado.carregado, certificado: estado });
  } catch (e) {
    console.error('Falha ao instalar certificado:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Escuta so no loopback por padrao. Escutando em "*", a VPS respondia
// http://<ip>:3500/health direto da internet, contornando o nginx e entregando
// versao, RAM, sessoes e portais a quem perguntasse — foi corrigido na maquina
// em 02/09/2026, mas o template continuava gerando a versao aberta.
//
// Em container o loopback deixaria o agente inalcancavel de fora: por isso
// BIND_HOST existe, e o Dockerfile ja o define como 0.0.0.0.
const BIND_HOST = process.env.BIND_HOST || '127.0.0.1';

app.listen(PORT, BIND_HOST, () => {
  console.log(\`🤖 Agente de Lances v2.2.0 rodando em \${BIND_HOST}:\${PORT}\`);
  console.log(\`   Rotas: \${ROTAS.length} (\${ROTAS.join(' · ')})\`);
  console.log(\`   Portais: \${Object.keys(PORTALS).join(', ')}\`);
  console.log(\`   Max sessões: \${process.env.MAX_SESSOES_PARALELAS || 3}\`);
  console.log(\`   Callback: \${process.env.CALLBACK_URL || '(não configurada)'}\`);
  console.log(\`   Certificado: \${process.env.CERT_PATH || '(multi-CNPJ em certs/)'}\`);
});
`,

  'src/session-manager.js': `const { launchBrowser } = require('./browser');
const { sendCallback } = require('./callback');
const { getPortal } = require('./portals');
const { decidirLance, conferirItens, proximaLeituraMs } = require('./estrategia');
const interacao = require('./interacao-humana');
const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Gerenciador de sessões paralelas.
 * Cada sessão abre sua própria instância do Chromium (~500MB RAM).
 * O limite de sessões simultâneas é calculado com base na RAM disponível.
 */
class SessionManager {
  constructor() {
    this.sessions = new Map();
    this.maxParallel = parseInt(process.env.MAX_SESSOES_PARALELAS || '3', 10);

    // Pastas de perfil persistente abertas agora. O Chrome nao abre a mesma
    // pasta duas vezes: duas disputas simultaneas da mesma empresa no mesmo
    // portal fariam a segunda falhar. A segunda entra com perfil temporario.
    this.perfisEmUso = new Set();

    // O ROBO PAROU ESPERANDO UMA PESSOA — captcha, codigo de verificacao.
    // O pedido vira callback, e o webhook avisa os administradores da
    // plataforma com o caminho da tela remota (16/09/2026). Antes ele so
    // existia no /health, e em 14/09 as 20:07 expirou sem ninguem ver.
    interacao.aoPedir((sessaoId, pedido) => {
      const session = this.sessions.get(sessaoId);
      if (!session) return null;
      return sendCallback(session, 'pedido-humano', {
        tipo: pedido.tipo,
        mensagem: pedido.mensagem,
        tela: pedido.tela,
        expira_em: pedido.expira_em,
      });
    });
  }

  /**
   * A pasta do perfil persistente desta sessao, ou null para perfil temporario.
   *
   * Um perfil por PORTAL e por IDENTIDADE de login — no Compras.gov, quem entra
   * no gov.br e o titular do certificado, e e a sessao dele que o perfil
   * guarda. A identidade vira hash no nome da pasta: CPF nao fica escrito no
   * disco em texto.
   *
   * So nos portais da lista. O login dos outros foi escrito supondo navegador
   * limpo; chegar ja logado poderia confundi-los, e ninguem conferiu isso.
   * PERFIL_PERSISTENTE=false no .env desliga para todos.
   */
  perfilDaSessao(config) {
    const PORTAIS_COM_PERFIL_PERSISTENTE = ['comprasgov'];
    if (String(process.env.PERFIL_PERSISTENTE ?? 'true') === 'false') return null;
    if (!PORTAIS_COM_PERFIL_PERSISTENTE.includes(config.portal_id)) return null;
    const cred = config.credenciais_portal || {};
    const quem = String(cred.cpf || cred.login || cred.usuario || config.cnpj_empresa || 'padrao');
    const chave = crypto.createHash('sha256').update(config.portal_id + ':' + quem).digest('hex').slice(0, 16);
    const pasta = path.join(process.env.PERFIS_DIR || './perfis', config.portal_id + '-' + chave);
    if (this.perfisEmUso.has(pasta)) {
      console.log(\`🗂️  [\${config.sessao_id}] O perfil desta identidade esta em uso por outra sessao — esta entra com perfil temporario\`);
      return null;
    }
    return pasta;
  }

  /**
   * Calcula quantas sessões paralelas o servidor suporta com base na RAM.
   * Reserva 512MB para o SO e ~500MB por sessão Chromium.
   */
  getCapacity() {
    const totalMB = Math.floor(os.totalmem() / 1024 / 1024);
    const freeMB = Math.floor(os.freemem() / 1024 / 1024);
    // Sessao pausada mantem o Chromium aberto (~500MB). Contar so as 'ativo'
    // liberava o slot enquanto a memoria seguia ocupada: pausar tres e abrir
    // tres novas dava seis navegadores em tres slots, ate estourar a RAM.
    const activeSessions = this.getSessionsComBrowser().length;
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
      const { browser, page, perfil } = await launchBrowser(null, { perfil: this.perfilDaSessao(config) });
      session.browser = browser;
      session.page = page;
      session.perfil = perfil || null;
      if (perfil) {
        this.perfisEmUso.add(perfil);
        // Liberar quando o Chrome fechar, por qualquer caminho — fim, erro,
        // kill switch ou queda. Amarrar a cada um deles esqueceria algum.
        browser.on('disconnected', () => this.perfisEmUso.delete(perfil));
      }

      // Toda aba que nasce ou morre vai para o log, com URL. Foi a falta disto
      // que deixou "Session closed" sem explicacao em 10/09/2026: o Chrome
      // trocou de aba na volta do gov.br e ninguem viu.
      browser.on('targetcreated', (t) => {
        if (t.type() === 'page') console.log(\`🆕 [\${config.sessao_id}] aba aberta: \${t.url() || '(vazia)'}\`);
      });
      browser.on('targetdestroyed', (t) => {
        if (t.type() === 'page') console.log(\`🧯 [\${config.sessao_id}] aba fechada: \${t.url() || '(vazia)'}\`);
      });

      // O PID do Chrome DESTA sessão, guardado agora e não procurado depois.
      //
      // É o que permite trazer a janela certa para a frente (/sessao/focar).
      // Todas as sessões desenham na mesma tela virtual, e procurar a janela
      // por título casaria com a de qualquer pregão do mesmo portal — que é
      // justamente o erro que se quer evitar.
      //
      // O encadeamento opcional existe porque browser.process() devolve null
      // quando o Puppeteer se conecta a um Chrome que ele não abriu. Nesse caso
      // a rota responde que não sabe qual janela é, em vez de ativar uma ao acaso.
      session.chromePid = browser.process()?.pid || null;

      // Instanciar o módulo do portal correto
      session.portal = getPortal(config.portal_id, page, config.credenciais_portal || {});

      // O portal precisa saber QUAL sessao ele e para pedir algo a uma pessoa —
      // um codigo de verificacao, por exemplo — e para a resposta voltar ao
      // lugar certo quando ha varias sessoes abertas ao mesmo tempo.
      session.portal.sessaoId = config.sessao_id;
      // O login registra se entrou com perfil guardado — e o que a medicao
      // em logs/logins.jsonl precisa separar.
      session.portal.perfilPersistente = !!session.perfil;

      // Login no portal
      console.log(\`🔐 [\${config.sessao_id}] Login no portal: \${config.portal_id}\`);
      await session.portal.login();
      // O portal pode ter trocado de aba durante o login (adotarAbaViva). A
      // sessao segue a aba do portal, senao screenshot, chat e foco olhariam
      // para uma aba que ja nao existe.
      if (session.portal.page && session.portal.page !== session.page) {
        session.page = session.portal.page;
      }

      // O gravador liga DEPOIS do login, e nao antes. Ligado antes, a primeira
      // foto saia com a aba ainda em about:blank e travava ate o limite do
      // protocolo (180s); como o Puppeteer enfileira as fotos de uma mesma
      // aba, a foto que o login tira ao abrir o gov.br ficava presa atras
      // dela, o clique no certificado atrasava 3 minutos, e o hCaptcha
      // recusava tudo dali em diante (14/09, 02:18). O login ja tem as
      // proprias fotos; o que interessa gravar e a busca e a sala.
      this._startGravador(session);

      // Navegar para a disputa
      //
      // O alvo vai junto: o processo diz ONDE, os itens dizem O QUE. Antes so
      // o primeiro atravessava, e num pregao por itens o robo abria a pagina
      // certa sem saber o que acompanhar dentro dela.
      //
      // Guardado na sessao tambem, e nao so passado adiante, porque o
      // /health precisa poder afirmar quantos itens ESTA sessao recebeu —
      // "o robo recebeu os itens" sem numero visivel e afirmacao sem prova.
      session.itens = Array.isArray(config.itens) ? config.itens : [];
      session.tipo_disputa = config.tipo_disputa || null;
      // UASG (Compras.gov): o numero da compra se repete entre orgaos.
      session.uasg = config.uasg ? String(config.uasg) : null;
      session.cnpj_empresa = config.cnpj_empresa ? String(config.cnpj_empresa) : null;

      console.log(
        \`📋 [\${config.sessao_id}] Navegando para edital: \${config.edital}\` +
        \` (\${session.itens.length} item(ns), disputa por \${session.tipo_disputa || 'nao informado'})\`
      );
      await session.portal.navegarParaDisputa(config.edital, {
        tipo: session.tipo_disputa,
        itens: session.itens,
        uasg: session.uasg,
        cnpj_empresa: session.cnpj_empresa,
      });

      // ── O QUE MANDAMOS BATE COM O QUE O PORTAL PUBLICOU? ──────────────────
      //
      // A tela monta os itens do NOSSO lado — Precificacao, Proposta, extracao
      // do edital — e nada disso conversa com o portal. Um numero errado, um
      // lote que mudou, uma republicacao do edital, e o robo entra mirando um
      // item que nao existe, sem que nada acuse.
      //
      // Roda so quando o portal sabe ler a lista. O metodo e opcional, como
      // o do chat: portal que nao implementa segue funcionando igual.
      if (typeof session.portal.lerItensDoProcesso === 'function' && session.itens.length) {
        try {
          const doPortal = await session.portal.lerItensDoProcesso();
          const conf = conferirItens(session.itens, doPortal);
          session.conferencia = conf;

          // Quantos itens do portal trazem valor de referencia legivel.
          //
          // Existe porque sem este numero "nenhuma divergencia de valor" tem
          // DUAS leituras opostas e indistinguiveis: os valores batem, ou nao
          // ha valor nenhum para comparar. Muito edital nao publica o
          // estimado, e confundir isso com "conferido" seria dar por checado o
          // que nunca foi olhado.
          const comValor = doPortal.filter((i) => Number.isFinite(Number(i.valor_referencia)) && Number(i.valor_referencia) > 0).length;
          if (doPortal.length && comValor === 0) {
            console.log(
              \`ℹ️  [\${config.sessao_id}] O portal listou \${doPortal.length} item(ns) e NENHUM com valor de \` +
              'referencia — a conferencia de valores nao teve o que comparar'
            );
          }

          if (!conf.leu) {
            console.log(\`⚠️  [\${config.sessao_id}] \${conf.resumo}\`);
          } else if (conf.ok) {
            console.log(\`✅ [\${config.sessao_id}] \${conf.resumo}\`);
          } else {
            console.log(\`⚠️  [\${config.sessao_id}] CONFERENCIA: \${conf.resumo}\`);
          }

          await sendCallback(session, 'itens-conferidos', {
            leu: conf.leu,
            ok: conf.ok,
            resumo: conf.resumo,
            faltando: conf.faltando,
            sobrando: conf.sobrando,
            divergencias: conf.divergencias,
            total_no_portal: doPortal.length,
            com_valor_referencia: comValor,
          });
        } catch (e) {
          // Conferir e informacao adicional. Falhar aqui nao pode impedir a
          // sessao de acontecer — seria trocar um aviso por uma interrupcao.
          console.error(\`[\${config.sessao_id}] Falha ao conferir itens: \${e.message}\`);
        }
      }

      // ── A REGRA DO EDITAL PARA O ITEM ACOMPANHADO ─────────────────────────
      //
      // Modo de disputa e intervalo minimo entre lances: o portal publica os
      // dois, e a estrategia precisa deles (um lance com diferenca menor que o
      // intervalo e recusado). Lidos uma vez — nao mudam durante a sessao.
      // Portal que nao sabe ler segue como antes, com o decremento configurado.
      session.detalhesDoItem = null;
      if (typeof session.portal.lerDetalhesDoItem === 'function' && session.itens.length) {
        try {
          session.detalhesDoItem = await session.portal.lerDetalhesDoItem(session.itens[0].numero);
        } catch (e) {
          console.error(\`[\${config.sessao_id}] Falha ao ler modo e intervalo do item: \${e.message}\`);
        }
      }

      // ─── "CHEGUEI NA SALA" ────────────────────────────────────────────
      //
      // O robo passa a entrar sozinho no horario da sessao, e quem cadastrou
      // a disputa nao fica olhando tela remota nenhuma. Sem este aviso,
      // "entrou" e "nao entrou" tem a mesma cara do lado de ca — foi o que
      // aconteceu em 14/09 as 20:07, quando o login parou no captcha e
      // ninguem soube a tempo.
      //
      // Vai dentro do proprio try/catch: avisar e informacao adicional, e
      // falhar aqui nao pode derrubar uma sessao que ja esta de pe.
      try {
        await sendCallback(session, 'sessao-ativa', {
          itens: session.itens.length,
          tipo_disputa: session.tipo_disputa,
          modo_disputa: session.detalhesDoItem ? session.detalhesDoItem.modo_texto : null,
          intervalo_minimo: session.detalhesDoItem ? session.detalhesDoItem.intervalo_minimo : null,
          url: session.portal.page && typeof session.portal.page.url === 'function'
            ? session.portal.page.url()
            : null,
        });
      } catch (e) {
        console.error(\`[\${config.sessao_id}] Falha ao avisar que entrou na sala: \${e.message}\`);
      }

      // Iniciar loop de lances
      this._startBiddingLoop(session);

      console.log(\`✅ Sessão \${config.sessao_id} ativa. Total ativas: \${this.getActiveSessions().length}\`);
    } catch (err) {
      console.error(\`❌ Erro ao iniciar sessão \${config.sessao_id}:\`, err);
      sendCallback(session, 'erro', { mensagem: err.message });
      session.status = 'erro';
      // Sem isto, cada sessao que falha deixa um timer de 30s batendo no
      // callback para sempre — e hoje TODA sessao falha antes de comecar.
      if (session.heartbeatInterval) clearInterval(session.heartbeatInterval);
      // Pedido sem tela e pedido zumbi: some com ele junto da sessao.
      try { require('./interacao-humana').encerrar(config.sessao_id); } catch (e) {}

      // A JANELA FICA ABERTA UM POUCO DEPOIS DE FALHAR.
      //
      // Fechar na hora tornava o erro invisivel. Medido em 09/09/2026: com um
      // edital que nao existe, o navegador aparece no VNC em 3s e some em 13 —
      // quem clica para abrir a tela remota chega depois do fim e ve o servidor
      // vazio, sem nada que explique o que houve. A pessoa conclui que o VNC
      // esta quebrado, quando o robo apenas ja terminou.
      //
      // Manter a janela NAO esconde a falha: o status continua 'erro', o
      // callback ja saiu e o motivo esta no log. So a tela demora a sumir, e e
      // nela que esta a explicacao — a pagina onde o robo parou.
      //
      // O slot nao fica preso: getCapacity() so conta sessao 'ativo' ou
      // 'pausado', e esta e 'erro'.
      const segundos = Number(process.env.SEGUNDOS_JANELA_APOS_ERRO || 60);

      if (session.browser && segundos > 0) {
        console.log(\`🔎 Janela mantida aberta por \${segundos}s para observacao no VNC — sessao \${config.sessao_id}\`);
        setTimeout(() => {
          this._stopGravador(session);
          if (session.browser) session.browser.close().catch(() => {});
          console.log(\`🔒 Janela de observacao encerrada — sessao \${config.sessao_id}\`);
        }, segundos * 1000);
      } else {
        this._stopGravador(session);
        if (session.browser) session.browser.close().catch(() => {});
      }
    }

    return session;
  }

  /**
   * GRAVADOR DA SESSAO — foto + raio-X do DOM em logs/sessoes/<id>/, a cada
   * GRAVADOR_INTERVALO_S segundos (padrao 10; 0 desliga).
   *
   * Existe por uma razao concreta: a sala de disputa so aparece com pregao em
   * sessao, num horario que o orgao marca. Quem mapeia os seletores dela
   * (melhor lance, "voce esta em 1o", campo de lance) precisa do DOM daquele
   * segundo, e nao pode depender de estar olhando o VNC no exato momento. Com
   * isto, a operadora disputa de manha e o mapeamento acontece a tarde, com
   * prova: HHMMSS.png ao lado de HHMMSS.json.
   *
   * Um raio-X identico ao anterior nao vira arquivo novo — tela parada nao
   * gera 360 copias por hora. Cada captura e independente da anterior: se uma
   * falhar (aba trocando, frame morto), a proxima tenta de novo. Nunca derruba
   * a sessao — gravar e diagnostico, nao operacao.
   */
  _startGravador(session) {
    const segundos = Number(process.env.GRAVADOR_INTERVALO_S ?? 10);
    if (!Number.isFinite(segundos) || segundos <= 0) return;
    const dir = path.join('./logs/sessoes', String(session.sessao_id));
    try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { return; }
    session.gravadorDir = dir;
    session.gravadorCapturas = 0;
    let ocupado = false;
    let ultimoHash = null;

    const capturar = async () => {
      if (ocupado || !session.portal || !session.browser) return;
      // Aba sem pagina nenhuma nao tem o que gravar — e e exatamente a foto
      // que trava (about:blank recem-aberto, sem quadro pintado).
      const abaAgora = session.portal.page;
      if (!abaAgora || /^about:blank/.test(abaAgora.url())) return;
      ocupado = true;
      try {
        const raio = await session.portal.inspecionarTela();
        const json = JSON.stringify(raio);
        // O hash ignora o horario da captura — senao toda captura e "nova" e a
        // tela parada vira 360 arquivos por hora (aconteceu no primeiro teste).
        const hash = crypto.createHash('md5').update(JSON.stringify({ ...raio, quando: null })).digest('hex');
        if (hash !== ultimoHash) {
          ultimoHash = hash;
          // Carimbo em hora LOCAL, para casar com o log (que e local).
          const d = new Date();
          const carimbo = [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join('')
            + String(d.getMilliseconds()).padStart(3, '0');
          fs.writeFileSync(path.join(dir, carimbo + '.json'), json);
          const aba = session.portal.page;
          if (aba && !(typeof session.portal.abaMorta === 'function' && session.portal.abaMorta(aba))) {
            await aba.screenshot({ path: path.join(dir, carimbo + '.png') }).catch(() => {});
          }
          session.gravadorCapturas += 1;
        }
      } catch (e) {
        /* gravar e diagnostico; a sessao segue */
      } finally {
        ocupado = false;
      }
    };

    session.gravadorInterval = setInterval(capturar, segundos * 1000);
    capturar();
    console.log(\`🎞️  [\${session.sessao_id}] Gravador ligado: foto + DOM a cada \${segundos}s em \${dir}\`);
  }

  _stopGravador(session) {
    if (session.gravadorInterval) {
      clearInterval(session.gravadorInterval);
      session.gravadorInterval = null;
      if (session.gravadorDir) {
        console.log(\`🎞️  [\${session.sessao_id}] Gravador desligado: \${session.gravadorCapturas || 0} captura(s) em \${session.gravadorDir}\`);
      }
    }
  }

  /**
   * O LACO DE LANCES.
   *
   * Cada rodada: le o chat, le a sala, decide (decidirLance, funcao pura e
   * testada) e, se for o caso, envia e confere. A proxima rodada e agendada
   * so DEPOIS que esta termina, no ritmo que proximaLeituraMs escolhe — o
   * intervalo da disputa fora da iminencia, poucos segundos dentro dela. Com
   * setInterval fixo, uma leitura lenta (a pagina publica demora) encavalava
   * com a seguinte.
   *
   * O TETO NAO MORA MAIS AQUI. Ate 16/09/2026 o laco encerrava a sessao em
   * max_lances RODADAS, antes de qualquer decisao: o padrao de 20 rodadas a
   * 30 s tirava o robo da sala em 10 minutos, com ou sem lance. Agora o teto
   * conta lances enviados, e quem decide e decidirLance.
   *
   * O que encerra uma sessao que so observa (trava fechada, ou item sem
   * lance possivel) e o limite de seguranca HORAS_MAXIMAS_SESSAO (padrao 10),
   * alem do botao de parar: um Chrome esquecido ocupa uma das poucas vagas
   * do servidor.
   */
  _startBiddingLoop(session) {
    // Uma geracao por laco. Pausar e retomar depressa, com uma rodada ainda em
    // curso, deixaria dois lacos vivos decidindo pela mesma sessao; o que nao
    // e da geracao atual para sozinho.
    session.lacoGeracao = (session.lacoGeracao || 0) + 1;
    const geracao = session.lacoGeracao;
    if (!Number.isFinite(session.lances_enviados)) session.lances_enviados = 0;
    if (session.ultimo_lance_aceito === undefined) session.ultimo_lance_aceito = null;

    const horasMaximas = Number(process.env.HORAS_MAXIMAS_SESSAO ?? 10);
    const vivo = () => session.status === 'ativo' && session.lacoGeracao === geracao;

    const agendar = (ms) => {
      if (!vivo()) return;
      session.interval = setTimeout(rodada, ms);
    };

    const rodada = async () => {
      if (!vivo()) return;
      let proxima = proximaLeituraMs({ intervaloSegundos: session.intervalo_segundos });

      const aberta = Date.now() - new Date(session.created_at).getTime();
      if (Number.isFinite(horasMaximas) && horasMaximas > 0 && aberta > horasMaximas * 3600 * 1000) {
        this.endSession(
          session.sessao_id,
          \`Sessao aberta ha mais de \${horasMaximas} h — limite de seguranca (HORAS_MAXIMAS_SESSAO)\`
        );
        return;
      }

      try {
        session.rodada++;

        // 0. O pregoeiro falou?
        //
        // Vem ANTES da decisao de lance de proposito: uma convocacao ou um
        // pedido de documento e mais urgente do que a proxima rodada, e quem
        // opera precisa saber no momento em que acontece — nao depois que o
        // laco terminar.
        //
        // Nao derruba a rodada se falhar: ler chat e informacao adicional, e
        // o metodo ja devolve vazio quando o portal nao sabe ler.
        try {
          const mensagens = await session.portal.lerMensagensChat();
          // Deduplicar e obrigatorio: o laco rele a MESMA tela a cada rodada.
          // Sem isto, uma mensagem do pregoeiro viraria um alerta a cada 30
          // segundos ate a sessao acabar — e alerta repetido deixa de ser lido.
          session.chatVistas = session.chatVistas || new Set();
          const novas = mensagens.filter((m) => !session.chatVistas.has(m.id));
          for (const m of novas) session.chatVistas.add(m.id);

          if (novas.length) {
            console.log(\`💬 [\${session.sessao_id}] \${novas.length} mensagem(ns) do pregoeiro\`);
            await sendCallback(session, 'mensagem-pregoeiro', {
              rodada: session.rodada,
              mensagens: novas,
            });
          }
        } catch (e) {
          console.error(\`[\${session.sessao_id}] Falha ao ler o chat: \${e.message}\`);
        }

        // 1. Ler o estado da disputa no portal
        const melhorLance = await session.portal.lerMelhorLance();
        const souLider = await session.portal.souLider?.() ?? null;
        // Fase, tempo restante e elegibilidade saem da sala logada, que ainda
        // nao foi mapeada: nenhum portal implementa lerSala hoje, e o vazio
        // chega a decidirLance como "nao sei".
        const sala = (await session.portal.lerSala?.()) || {};
        const nossoNoPortal = await session.portal.nossoLance?.() ?? null;

        if (melhorLance !== null && melhorLance < session.valor_atual) {
          await sendCallback(session, 'lance-concorrente', {
            rodada: session.rodada,
            valor: melhorLance,
            metadata: { timestamp: new Date().toISOString() },
          });
        }

        // O item que o robo acompanha. A estrategia e o piso sao DELE; o piso
        // da disputa inteira so vale para item que nao tem o proprio.
        const item = session.itens[0] || {};
        const pisoDoItem = Number(item.valor_minimo);
        const piso = Number.isFinite(pisoDoItem) && pisoDoItem > 0 ? pisoDoItem : Number(session.valor_minimo);

        // Nosso ultimo valor: o que o portal publica para o nosso CNPJ, ou o
        // ultimo lance que o portal aceitou nesta sessao, se for menor (a
        // pagina publica pode estar atrasada). So sem nenhum dos dois cai no
        // valor inicial da disputa.
        const conhecidos = [nossoNoPortal, session.ultimo_lance_aceito].filter((v) => Number.isFinite(v));
        const valorAtual = conhecidos.length ? Math.min(...conhecidos) : session.valor_atual;

        const detalhes = session.detalhesDoItem || {};

        // 2. Decidir — função pura, testada em src/components/robo-lances/test/estrategia.test.ts.
        // A conta vivia aqui dentro e cobria o proprio lance quando liderava,
        // descendo o preco ate o piso sem concorrente nenhum.
        const decisao = decidirLance({
          portalId: session.portal_id,
          valorAtual,
          valorMinimo: piso,
          melhorLance,
          souLider,
          decrementoMin: session.decremento_min,
          decrementoPercentual: session.decremento_percentual,
          intervaloMinimo: detalhes.intervalo_minimo,
          intervaloMinimoPercentual: detalhes.intervalo_minimo_percentual,
          estrategia: item.estrategia,
          margemDesempate: Number(item.margem_desempate),
          fase: sala.fase,
          segundosRestantes: sala.segundosRestantes,
          elegivel: sala.elegivel,
          lanceFinalFechado: Number(item.lance_final_fechado),
          lanceFechadoEnviado: session.lance_fechado_enviado === true,
          lanceDesempateEnviado: session.lance_desempate_enviado === true,
          lancesEnviados: session.lances_enviados,
          maxLances: session.max_lances,
          rodada: session.rodada,
        });

        proxima = proximaLeituraMs({
          intervaloSegundos: session.intervalo_segundos,
          fase: sala.fase,
          segundosRestantes: sala.segundosRestantes,
        });

        if (decisao.acao === 'encerrar') {
          console.log(\`[\${session.sessao_id}] \${decisao.motivo}\`);
          this.endSession(session.sessao_id, decisao.motivo);
          return;
        }

        if (decisao.acao === 'aguardar') {
          console.log(\`[\${session.sessao_id}] Rodada \${session.rodada} sem lance: \${decisao.motivo}\`);
          // Na iminencia o laco roda a cada poucos segundos. O aviso de rodada
          // sem lance so sai quando o motivo muda, ou a cada 30 s — e isso que
          // diz "a sessao esta viva", e repetir o mesmo motivo nao diz mais.
          const agora = Date.now();
          if (decisao.motivo !== session.ultimoMotivoAvisado || agora - (session.ultimoAvisoEm || 0) >= 30000) {
            session.ultimoMotivoAvisado = decisao.motivo;
            session.ultimoAvisoEm = agora;
            await sendCallback(session, 'rodada-sem-lance', {
              rodada: session.rodada,
              motivo: decisao.motivo,
              melhor_lance: melhorLance,
              sou_lider: souLider,
              estrategia: item.estrategia || 'melhor_preco',
            });
          }
          return;
        }

        const novoValor = decisao.valor;

        // 3. Enviar lance real no portal
        await session.portal.enviarLance(novoValor);

        // 4. Conferir se o portal ACEITOU. Antes o resultado era lido e
        // descartado: lance recusado virava valor_atual e a rodada seguinte
        // partia de uma premissa falsa.
        const resultado = (await session.portal.verificarResultado?.()) || 'enviado';
        const recusado = typeof resultado === 'string' &&
          /recus|rejeit|inval|erro|negad/i.test(resultado);

        if (recusado) {
          console.warn(\`[\${session.sessao_id}] Lance RECUSADO pelo portal: \${resultado}\`);
          await sendCallback(session, 'lance-recusado', {
            rodada: session.rodada,
            valor: novoValor,
            resultado,
          });
          return; // valor_atual NAO avanca
        }

        session.valor_atual = novoValor;
        session.ultimo_lance_aceito = novoValor;
        session.lances_enviados += 1;
        if (sala.fase === 'fechada') session.lance_fechado_enviado = true;
        if (sala.fase === 'desempate_me_epp') session.lance_desempate_enviado = true;

        await sendCallback(session, 'lance-enviado', {
          rodada: session.rodada,
          valor: novoValor,
          tipo_lance: 'meu',
          resultado,
          motivo: decisao.motivo,
          lances_enviados: session.lances_enviados,
          metadata: { timestamp: new Date().toISOString(), estrategia: item.estrategia || 'melhor_preco' },
        });

        console.log(
          \`[\${session.sessao_id}] Rodada \${session.rodada} | lance \${session.lances_enviados} | R$ \${novoValor.toFixed(2)} | \${resultado}\`
        );
      } catch (err) {
        console.error(\`[\${session.sessao_id}] Erro rodada \${session.rodada}:\`, err);
        await session.portal.screenshot?.('erro-rodada-' + session.rodada).catch(() => {});
        await sendCallback(session, 'erro', { mensagem: err.message, rodada: session.rodada });
      } finally {
        agendar(proxima);
      }
    };

    agendar(proximaLeituraMs({ intervaloSegundos: session.intervalo_segundos }));
  }

  pauseSession(sessaoId) {
    const session = this.sessions.get(sessaoId);
    if (!session) return null;
    session.status = 'pausado';
    if (session.interval) clearTimeout(session.interval);
    // O heartbeat segue: sessao pausada continua existindo e o painel precisa
    // saber. O que NAO pode e o Chromium sumir da contabilidade — ver
    // getCapacity, que passou a contar pausadas.
    console.log(\`⏸️ Sessão \${sessaoId} pausada. Ativas: \${this.getActiveSessions().length}\`);
    return session;
  }

  resumeSession(sessaoId) {
    const session = this.sessions.get(sessaoId);
    if (!session || session.status !== 'pausado') return null;
    session.status = 'ativo';
    this._startBiddingLoop(session);
    console.log(\`▶️ Sessão \${sessaoId} retomada. Ativas: \${this.getActiveSessions().length}\`);
    return session;
  }

  /**
   * @param {string} sessaoId
   * @param {string} [motivo] por que acabou — vai no callback e no log, para
   *        que "o robo saiu da sala" venha sempre com a razao (piso, teto,
   *        item encerrado no portal, limite de horas, pedido de alguem).
   */
  endSession(sessaoId, motivo) {
    const session = this.sessions.get(sessaoId);
    if (!session) return null;
    session.status = 'encerrado';
    if (session.interval) clearTimeout(session.interval);
    if (session.heartbeatInterval) clearInterval(session.heartbeatInterval);
    this._stopGravador(session);
    if (session.browser) session.browser.close().catch(() => {});

    sendCallback(session, 'sessao-encerrada', {
      resultado: 'finalizado',
      valor_final: session.valor_atual,
      total_rodadas: session.rodada,
      lances_enviados: session.lances_enviados || 0,
      motivo: motivo || null,
    });

    console.log(\`🏁 Sessão \${sessaoId} encerrada\${motivo ? ' — ' + motivo : ''}. Ativas: \${this.getActiveSessions().length}\`);
    return session;
  }

  /**
   * KILL SWITCH — encerra TODAS as sessões ativas imediatamente.
   * Retorna o número de sessões encerradas.
   */
  killAll(motivo) {
    const ativas = this.getActiveSessions();
    console.log(\`🛑 KILL ALL: Encerrando \${ativas.length} sessão(ões) — Motivo: \${motivo || 'N/I'}\`);
    
    for (const session of ativas) {
      session.status = 'encerrado';
      if (session.interval) clearTimeout(session.interval);
      if (session.heartbeatInterval) clearInterval(session.heartbeatInterval);
      this._stopGravador(session);
      // Pedido sem tela e pedido zumbi: some com ele junto da sessao.
      // (Era \`config.sessao_id\` — variavel que nao existe neste escopo; o
      // try engolia o ReferenceError e o pedido humano sobrevivia ao kill.)
      try { require('./interacao-humana').encerrar(session.sessao_id); } catch (e) {}
      if (session.browser) session.browser.close().catch(() => {});

      sendCallback(session, 'sessao-encerrada', {
        resultado: 'parada_emergencial',
        valor_final: session.valor_atual,
        total_rodadas: session.rodada,
        motivo,
      });
    }
    
    return ativas.length;
  }

  /** Sessoes que ainda seguram um navegador aberto — e portanto RAM. */
  getSessionsComBrowser() {
    return [...this.sessions.values()].filter(
      (s) => (s.status === 'ativo' || s.status === 'pausado') && s.browser
    );
  }

  getActiveSessions() {
    return [...this.sessions.values()].filter((s) => s.status === 'ativo');
  }

  getAllSessions() {
    return [...this.sessions.entries()].map(([id, s]) => ({
      sessao_id: id,
      status: s.status,
      portal_id: s.portal_id,
      portal_nome: s.portal_nome,
      edital: s.edital,
      rodada: s.rodada,
      valor_atual: s.valor_atual,
      valor_minimo: s.valor_minimo,
      max_lances: s.max_lances,
      // A PROVA de que os itens atravessaram, visivel no /health.
      //
      // Sem numero exposto, "o robo recebeu os itens" so daria para conferir
      // abrindo log de VPS. O campo itens_sem_piso esta aqui pelo mesmo motivo:
      // piso ausente e o estado em que o robo nao deve dar lance, e isso tem
      // que ser legivel de fora antes do pregao, nao depois.
      itens_recebidos: Array.isArray(s.itens) ? s.itens.length : 0,
      itens_sem_piso: Array.isArray(s.itens)
        ? s.itens.filter((i) => i.valor_minimo === null || i.valor_minimo === undefined).length
        : 0,
      tipo_disputa: s.tipo_disputa || null,
      uasg: s.uasg || null,
      // O gravador, visivel de fora: quantas capturas e onde. Sem isto, "esta
      // gravando" e afirmacao sem prova ate alguem abrir a pasta na VPS.
      gravador: s.gravadorDir ? { pasta: s.gravadorDir, capturas: s.gravadorCapturas || 0, ligado: !!s.gravadorInterval } : null,
      // A conferencia dos itens contra o portal, para a TELA poder mostrar.
      //
      // Ela ja vira mensagem no processo e notificacao, mas as duas chegam
      // DEPOIS — e quem esta olhando o painel no momento do envio e justamente
      // quem ainda pode corrigir o cadastro. Aqui ela chega em segundos.
      conferencia: s.conferencia
        ? {
            leu: s.conferencia.leu,
            ok: s.conferencia.ok,
            resumo: s.conferencia.resumo,
            faltando: s.conferencia.faltando,
            sobrando_qtd: (s.conferencia.sobrando || []).length,
            divergencias: s.conferencia.divergencias,
          }
        : null,
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

/**
 * A tela virtual e a janela do Chrome precisam ter o MESMO tamanho.
 *
 * Estavam diferentes: o Xvfb em 1920x1080 e o Chrome em 1366x768. O navegador
 * ocupava 71% de cada lado — metade da area — e o resto ficava preto. Como o
 * noVNC encolhe o quadro INTEIRO para caber no painel, o que se via era uma
 * janelinha no meio de uma moldura preta, e a conclusao natural era que o VNC
 * estava com defeito.
 *
 * Uma variavel so define os dois, para nao voltarem a divergir. Quem mudar a
 * resolucao do Xvfb no start-vnc.sh precisa mudar TELA_AGENTE junto.
 */
function dimensoesDaTela() {
  const bruto = process.env.TELA_AGENTE || '1920x1080';
  const partes = String(bruto).toLowerCase().split('x');
  const largura = parseInt(partes[0], 10);
  const altura = parseInt(partes[1], 10);
  return {
    largura: largura > 0 ? largura : 1920,
    altura: altura > 0 ? altura : 1080,
  };
}

/**
 * @param {string} [cnpj]
 * @param {{perfil?: string|null}} [opcoes]
 *        perfil: pasta do perfil PERSISTENTE do Chrome (cookies, sessao do
 *        gov.br). Sem ela, o Chrome abre com perfil temporario, que some ao
 *        fechar — o comportamento de sempre.
 */
/**
 * Faz o Chrome deste perfil GUARDAR OS COOKIES DE SESSAO ao fechar.
 *
 * Medido em 16/09/2026, na segunda rodada do teste (13:23): o perfil
 * persistente abriu, mas o gov.br pediu o captcha de novo. O cookie do login,
 * Session_Gov_Br_Prod, e um cookie "de sessao" — sem validade —, e o Chrome
 * apaga esse tipo toda vez que fecha, a nao ser que o perfil esteja em
 * "continuar de onde parei" (session.restore_on_startup = 1). Os cookies da
 * protecao anti-robo do gov.br (TS..., TSPD_101_DID) sao do mesmo tipo.
 *
 * Tambem marca a ultima saida como normal: o Chrome morto pelo pm2 restart
 * deixaria o perfil como "fechou com erro", e a restauracao viria com aviso.
 *
 * Falhar aqui nao impede abrir: o perfil segue util para o que tem validade.
 */
function manterCookiesDeSessao(perfil) {
  const arquivo = path.join(perfil, 'Default', 'Preferences');
  let prefs = {};
  try {
    prefs = JSON.parse(fs.readFileSync(arquivo, 'utf8')) || {};
  } catch (e) {
    prefs = {};
  }
  try {
    prefs.session = { ...(prefs.session || {}), restore_on_startup: 1 };
    prefs.profile = { ...(prefs.profile || {}), exit_type: 'Normal', exited_cleanly: true };
    fs.writeFileSync(arquivo, JSON.stringify(prefs));
  } catch (e) {
    console.warn('⚠️ Nao consegui ajustar as preferencias do perfil (' + e.message + ')');
  }
}

async function launchBrowser(cnpj, opcoes = {}) {
  const cert = getCertConfig(cnpj);
  const { largura, altura } = dimensoesDaTela();

  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--window-size=' + largura + ',' + altura,
    // Sem posicao fixa a janela nasce deslocada e sobra faixa preta de um lado.
    '--window-position=0,0',
    // 10/09/2026: na volta do gov.br para o comprasnet o Chrome 153 trocava o
    // processo da aba (site isolation) e o Puppeteer 22 perdia o frame —
    // "Target closed" / "detached Frame" com o login ja feito. Sem isolamento
    // por origem a aba fica no mesmo processo e o frame sobrevive. Navegador
    // de automacao numa VPS dedicada: o custo de seguranca nao se aplica.
    '--disable-site-isolation-trials',
    '--disable-features=IsolateOrigins,site-per-process',
  ];

  // Para certificado A3 via PKCS#11
  if (cert.mode === 'a3' && cert.pkcs11Lib) {
    args.push(\`--load-extension=\${cert.pkcs11Lib}\`);
  }

  // Criar diretório de screenshots
  fs.mkdirSync('./logs/screenshots', { recursive: true });

  /**
   * MODO VISIVEL (HEADLESS=false): o navegador desenha na tela virtual :99, que
   * o x11vnc publica e o nginx serve em /vnc/. E o que permite ASSISTIR o robo
   * trabalhando pelo painel. Sem apontar o DISPLAY, um Chrome nao-headless nao
   * acha tela nenhuma e morre no start.
   *
   * O padrao continua sendo headless: quem nao configurar nada mantem o
   * comportamento antigo. Ligar a janela e um ato de configuracao.
   */
  const visivel = process.env.HEADLESS === 'false';
  const display = process.env.DISPLAY || ':99';

  const configuracao = {
    headless: visivel ? false : 'new',
    args,
    // Com janela de verdade, o viewport tem que SEGUIR a janela. Fixa-lo faria
    // a pagina renderizar num retangulo menor dentro dela — exatamente o
    // defeito que esta mudanca corrige.
    defaultViewport: visivel ? null : { width: largura, height: altura },
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    env: visivel ? { ...process.env, DISPLAY: display } : process.env,
  };

  // ── PERFIL PERSISTENTE (16/09/2026) ──────────────────────────────────────
  //
  // Todo envio era um login novo, e o gov.br pedia o clique do hCaptcha em 10
  // de 16 logins (10 a 14/09). Com o perfil guardado, o gov.br pode lembrar da
  // sessao e devolver o robo ja logado — sem certificado e sem captcha. Quanto
  // isso de fato evita esta sendo medido em logs/logins.jsonl.
  //
  // Se o Chrome nao abrir com o perfil (pasta travada por um Chrome que morreu
  // de mau jeito, disco cheio), a sessao NAO cai: abre com perfil temporario,
  // como sempre abriu, e o log diz por que.
  let perfil = opcoes && opcoes.perfil ? opcoes.perfil : null;
  let browser;
  if (perfil) {
    try {
      fs.mkdirSync(path.join(perfil, 'Default'), { recursive: true, mode: 0o700 });
      manterCookiesDeSessao(perfil);
      browser = await puppeteer.launch({
        ...configuracao,
        userDataDir: perfil,
        // O perfil guarda a sessao; cache de pagina nao precisa crescer sem
        // limite num disco de VPS. E sem o balao "restaurar paginas" depois de
        // um pm2 restart, que cobriria a tela remota. --restore-last-session
        // reforca a preferencia escrita por manterCookiesDeSessao.
        args: [...args, '--disk-cache-size=52428800', '--hide-crash-restore-bubble', '--restore-last-session'],
      });
      console.log('🗂️  Perfil persistente: ' + perfil);
    } catch (e) {
      console.warn('⚠️ Nao abri o Chrome com o perfil persistente (' + e.message.split('\\n')[0]
        + ') — seguindo com perfil temporario');
      perfil = null;
      browser = null;
    }
  }
  if (!browser) browser = await puppeteer.launch(configuracao);

  console.log(visivel
    ? '🖥️  Chrome VISIVEL em ' + display + ' a ' + largura + 'x' + altura + ' — acompanhe em /vnc/'
    : '🕶️  Chrome headless a ' + largura + 'x' + altura);

  // O certificado: dizer a verdade sobre ele, dos dois lados.
  //
  // Antes desta linha o log afirmava que o certificado NAO era apresentado —
  // verdade ate 09/09/2026, e mentira depois que a base NSS e a policy passaram
  // a existir. Mensagem fixa envelhece; perguntar ao modulo, nao.
  try {
    const estadoCert = require('./certificado').estado();
    if (estadoCert.carregado) {
      console.log('📜 Certificado pronto para ser apresentado: ' + estadoCert.titulares.join(', '));
    } else if (cert.mode === 'a1') {
      console.log('📜 Certificado no disco, mas ainda nao apresentavel: ' + estadoCert.motivo);
    }
  } catch (e) {
    // Instalacao antiga do agente, sem o modulo. Nao e motivo para nao subir.
  }

  const page = await browser.newPage();

  // Com a sessao restaurada, o Chrome reabre as abas da ultima vez (a pagina da
  // compra, o gov.br). O que se quer restaurar sao os cookies, nao as abas:
  // fecha-las evita que o robo, ao procurar a aba viva, adote uma aba velha.
  if (perfil) {
    for (const antiga of await browser.pages()) {
      if (antiga !== page) await antiga.close().catch(() => {});
    }
  }

  // O user-agent e o do proprio Chrome, so sem a marca "Headless". Era um
  // "Chrome/120" fixo, e em 10/09/2026 o Compras.gov abriu a pagina de
  // compras com o banner "Seu navegador (Chrome 120) esta desatualizado" —
  // um Chrome 153 fingindo ser tres anos mais velho. Mentira que envelhece
  // sozinha nao serve de disfarce.
  await page.setUserAgent((await browser.userAgent()).replace('HeadlessChrome', 'Chrome'));

  // No modo visivel o viewport ja segue a janela (defaultViewport: null).
  if (!visivel) {
    await page.setViewport({ width: largura, height: altura });
  }

  return { browser, page, cert, perfil };
}

module.exports = { launchBrowser, getCertConfig };
`,

  'src/interacao-humana.js': `/**
 * O que o robo precisa de uma pessoa, e a resposta dela.
 *
 * Vive em memoria de proposito: um pedido de codigo de verificacao so vale
 * enquanto a sessao esta de pe. Persistir isso criaria pedidos zumbis, que
 * pedem codigo para uma tela que ja fechou.
 *
 * O vocabulario e generico — 'codigo', 'captcha', 'confirmacao' — porque o
 * problema nao e do gov.br. BLL, BNC e qualquer portal com SMS caem no mesmo
 * padrao, e escrever um caso por portal e como as tres listas de portais que
 * ja divergiram aqui.
 */

const pendentes = new Map();
const respostas = new Map();

/**
 * Quem quer saber, na hora, que o robo parou esperando uma pessoa.
 *
 * Existe desde 16/09/2026: o pedido morava so na memoria e no /health, e so
 * era visto por quem estivesse com a tela certa aberta. Em 14/09 as 20:07 o
 * gov.br pediu o clique, ninguem estava olhando, e a espera expirou. O
 * session-manager escuta aqui e manda o pedido ao webhook, que avisa os
 * administradores da plataforma.
 *
 * Quem escuta nunca derruba quem pede: um aviso que falha nao pode impedir o
 * robo de esperar o clique.
 */
const ouvintes = [];
function aoPedir(fn) {
  if (typeof fn === 'function') ouvintes.push(fn);
}

/**
 * Registra o que falta para seguir.
 * @param {string} sessaoId
 * @param {{tipo: string, mensagem: string, tela?: string}} pedido
 */
function pedir(sessaoId, pedido) {
  if (!sessaoId) return null;
  const registro = {
    tipo: pedido.tipo,
    mensagem: pedido.mensagem,
    tela: pedido.tela || null,
    criado_em: new Date().toISOString(),
    // Ate quando o robo espera. A interface conta daqui para tras: sem isto a
    // pessoa nao sabe se tem cinco segundos ou cinco minutos, e age com pressa
    // desnecessaria — ou desiste achando que ja passou.
    expira_em: pedido.expira_em || null,
  };
  pendentes.set(sessaoId, registro);
  // Uma resposta antiga nao pode satisfazer um pedido novo: quem respondeu
  // "123456" ao pedido anterior nao respondeu a este.
  respostas.delete(sessaoId);
  for (const fn of ouvintes) {
    try {
      const r = fn(sessaoId, registro);
      if (r && typeof r.catch === 'function') r.catch(() => {});
    } catch (e) {
      /* avisar e informacao adicional; o pedido segue de pe */
    }
  }
  return registro;
}

/** Entrega a resposta. Devolve false quando nao havia pedido — o chamador
 *  precisa saber a diferenca entre "aceitei" e "nao ha o que responder". */
function responder(sessaoId, valor) {
  if (!pendentes.has(sessaoId)) return false;
  respostas.set(sessaoId, String(valor));
  return true;
}

/** Consome a resposta, se houver. Consumir e proposital: cada resposta serve
 *  uma vez, e um codigo reenviado por engano nao deve ser digitado duas vezes. */
function colher(sessaoId) {
  if (!respostas.has(sessaoId)) return null;
  const v = respostas.get(sessaoId);
  respostas.delete(sessaoId);
  return v;
}

/** O pedido em aberto desta sessao, ou null. */
function pendente(sessaoId) {
  return pendentes.get(sessaoId) || null;
}

/** Fecha o pedido — atendido, expirado ou sessao encerrada. */
function encerrar(sessaoId) {
  // Sessao morreu com pedido em aberto: ninguem respondeu a tempo. Dizer isso
  // e melhor que o cartao sumir sem explicacao.
  if (pendentes.has(sessaoId)) resolver(sessaoId, 'expirado');
  pendentes.delete(sessaoId);
  respostas.delete(sessaoId);
}

/** Tudo que esta esperando alguem, para o /health. */
function todos() {
  return [...pendentes.entries()].map(([sessao_id, p]) => ({ sessao_id, ...p }));
}

/**
 * O que ESTA tela esta pedindo — lido do texto, nunca de configuracao.
 *
 * Devolve null quando nao ha nada a pedir, e e esse null que faz o campo NAO
 * aparecer na interface quando o portal nao exige nada.
 */
function classificarTela(texto) {
  const t = String(texto || '');
  if (/Verifica[çc][ãa]o em duas etapas|c[óo]digo de acesso|c[óo]digo de verifica[çc][ãa]o|token/i.test(t)) {
    return {
      tipo: 'codigo',
      mensagem: 'O portal pediu um codigo de verificacao. Cole aqui o codigo assim que ele chegar — '
        + 'o robo digita e confirma na hora.',
    };
  }
  if (/captcha|nao sou um rob[oô]|hcaptcha|recaptcha/i.test(t)) {
    return {
      tipo: 'captcha',
      mensagem: 'A pagina exige um gesto humano (captcha). Abra a tela remota (VNC) e clique — '
        + 'o robo segue sozinho depois disso.',
    };
  }
  return null;
}

/** O relogio da espera foi renovado — a tela avancou, e ha mais tempo. */
function renovar(sessaoId, expiraEm) {
  const p = pendentes.get(sessaoId);
  if (p) p.expira_em = expiraEm;
}

/**
 * Como o pedido terminou.
 *
 * Existe porque sumir e ambiguo. Quando o cartao simplesmente desaparece da
 * tela, quem estava olhando nao sabe se funcionou ou se expirou — e a duvida
 * faz clicar de novo, que foi como tres codigos do gov.br queimaram em
 * 09/09/2026 ate a conta ser bloqueada.
 *
 * Guardado por pouco tempo de proposito: e um aviso, nao um historico. O que
 * merece historico esta em sessoes_lance_real.
 */
const resolvidos = new Map();
const JANELA_AVISO_MS = 120000;

function resolver(sessaoId, desfecho) {
  const p = pendentes.get(sessaoId);
  if (p) {
    resolvidos.set(sessaoId, {
      tipo: p.tipo,
      desfecho,
      em: Date.now(),
    });
  }
  pendentes.delete(sessaoId);
  respostas.delete(sessaoId);
}

/** Desfechos recentes, para a interface avisar e depois esquecer. */
function desfechosRecentes() {
  const agora = Date.now();
  const saida = [];
  for (const [sessao_id, r] of resolvidos.entries()) {
    if (agora - r.em > JANELA_AVISO_MS) {
      resolvidos.delete(sessao_id);
      continue;
    }
    saida.push({ sessao_id, tipo: r.tipo, desfecho: r.desfecho, em: new Date(r.em).toISOString() });
  }
  return saida;
}

module.exports = {
  pedir, responder, colher, pendente, encerrar, todos, classificarTela,
  renovar, resolver, desfechosRecentes, aoPedir,
};
`,

  'src/certificado.js': `const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Instalacao do certificado A1 (.pfx) para o Chrome APRESENTAR aos portais.
 *
 * Por que este arquivo existe: ate 09/09/2026 o agente sabia dizer se o arquivo
 * estava no disco e mais nada. O /health respondia "carregado: true", o
 * Checklist ficava verde, e o certificado nunca chegava a portal nenhum — nao
 * havia base NSS nem policy. A pessoa pedia um certificado ao contador, pagava
 * por ele, enviava pela tela, e o resultado era exatamente igual a nao ter
 * enviado.
 *
 * TRES COISAS PRECISAM SER VERDADE, e este modulo cuida das tres:
 *
 *   1. o .pfx no disco;
 *   2. o par certificado+chave dentro da base NSS que o Chrome le;
 *   3. uma policy de auto-selecao, senao o Chrome abre o dialogo "escolha um
 *      certificado" — que numa automacao e um travamento sem mensagem.
 *
 * DETALHES QUE CUSTARAM TEMPO:
 *
 * - O caminho da policy NAO e /etc/opt/chrome/. O binario do Puppeteer e o
 *   "Chrome for Testing" e le /etc/opt/chrome_for_testing/policies/managed.
 *   Descoberto com \`strings\` no executavel; chutar o caminho padrao teria
 *   deixado a policy num diretorio que este Chrome ignora.
 *
 * - Toda chamada a certutil/pk12util fecha o stdin. Sem isso eles pedem senha
 *   num terminal que nao existe e entram em laco infinito de "Invalid password.
 *   Try again." — o processo nunca retorna.
 *
 * - A base NSS e a que o proprio Chrome ja criou (~/.pki/nssdb). Criar outra e
 *   apontar por variavel nao funciona: o Chrome no Linux le esse caminho fixo.
 */

const HOME = process.env.HOME || '/root';
const NSSDB = 'sql:' + HOME + '/.pki/nssdb';
const ARQUIVO_SENHA_DB = path.join(HOME, '.pki', '.nssdb-pw');
const POLICY_DIR =
  process.env.CHROME_POLICY_DIR || '/etc/opt/chrome_for_testing/policies/managed';
const POLICY_FILE = path.join(POLICY_DIR, 'praefectus-mtls.json');

/**
 * Onde o certificado do cliente pode ser apresentado.
 *
 * Escopo estreito DE PROPOSITO. Com um padrao aberto ("*"), o Chrome ofereceria
 * o certificado da empresa a qualquer site que pedisse — inclusive um que
 * pedisse so para coletar. Cada dominio aqui e um portal que exige mTLS.
 */
const URLS_MTLS = [
  'https://[*.]gov.br',
  'https://[*.]banparanet.com.br',
  'https://[*.]bbmnetlicitacoes.com.br',
];

function caminhoDoPfx() {
  const configurado = process.env.CERT_PATH || './certs/certificado.pfx';
  return path.isAbsolute(configurado)
    ? configurado
    : path.resolve(__dirname, '..', configurado);
}

/** A base tem senha vazia (foi o Chrome que a criou). O arquivo vazio a informa. */
function arquivoDeSenhaDaBase() {
  fs.mkdirSync(path.dirname(ARQUIVO_SENHA_DB), { recursive: true });
  if (!fs.existsSync(ARQUIVO_SENHA_DB)) fs.writeFileSync(ARQUIVO_SENHA_DB, '', { mode: 0o600 });
  return ARQUIVO_SENHA_DB;
}

/** stdin fechado e timeout: ver a nota sobre o laco infinito no topo. */
function rodar(bin, args) {
  return execFileSync(bin, args, {
    encoding: 'utf8',
    timeout: 30000,
    input: '',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

/** Os apelidos que tem CHAVE PRIVADA na base. */
function apelidosComChave() {
  try {
    const saida = rodar('certutil', ['-K', '-d', NSSDB, '-f', arquivoDeSenhaDaBase()]);
    return saida
      .split('\\n')
      .map(function (l) { return l.match(/^<\\s*\\d+>\\s+\\S+\\s+\\S+\\s+(.+)$/); })
      .filter(Boolean)
      .map(function (m) { return m[1].trim(); });
  } catch (e) {
    return [];
  }
}

/** Os apelidos que tem CERTIFICADO na base. */
function apelidosComCertificado() {
  try {
    const saida = rodar('certutil', ['-L', '-d', NSSDB]);
    return saida
      .split('\\n')
      .map(function (l) { return l.match(/^(.*\\S)\\s{2,}\\S+\\s*$/); })
      .filter(Boolean)
      .map(function (m) { return m[1].trim(); })
      .filter(function (n) {
        // Descarta o cabecalho da tabela, que casa com o mesmo formato.
        return n !== 'Certificate Nickname' && n.indexOf('SSL,S/MIME') === -1;
      });
  } catch (e) {
    return [];
  }
}

/**
 * Os apresentaveis: precisam ter certificado E chave.
 *
 * A intersecao nao e preciosismo. \`certutil -D\` apaga o certificado e DEIXA a
 * chave privada orfa — descoberto ao remover o certificado de teste e ver o
 * estado continuar dizendo "instalado". Olhar so as chaves faz a base parecer
 * povoada quando o Chrome nao tem o que apresentar.
 */
function certificadosComChave() {
  const comCert = apelidosComCertificado();
  return apelidosComChave().filter(function (n) { return comCert.indexOf(n) !== -1; });
}

function policyValendo() {
  try {
    const bruto = JSON.parse(fs.readFileSync(POLICY_FILE, 'utf8'));
    const regras = bruto.AutoSelectCertificateForUrls || [];
    return regras.length > 0;
  } catch (e) {
    return false;
  }
}

/**
 * O estado REAL, para o /health. Cada campo e uma verificacao, nao uma suposicao.
 *
 * \`carregado\` so e true quando o Chrome conseguiria apresentar o certificado —
 * arquivo, chave na base E policy. Foi o contrario disso que manteve o Checklist
 * verde por meses.
 */
function estado() {
  const pfx = caminhoDoPfx();
  const arquivo = fs.existsSync(pfx);
  const nicks = certificadosComChave();
  const policy = policyValendo();
  // O que decide e a capacidade de APRESENTAR: certificado com chave na base do
  // Chrome, mais a policy. O .pfx no disco e apenas a origem — quem instalou o
  // certificado por outro caminho consegue usar, e exigir o arquivo diria que
  // nao da, o que seria falso na direcao oposta.
  const pronto = nicks.length > 0 && policy;

  const faltando = [];
  if (nicks.length === 0) faltando.push('nenhum certificado com chave privada na base NSS do Chrome');
  if (!policy) faltando.push('policy de auto-selecao ausente em ' + POLICY_FILE);

  return {
    carregado: pronto,
    path: process.env.CERT_PATH || './certs/certificado.pfx',
    arquivo_no_disco: arquivo,
    instalado_no_navegador: nicks.length > 0,
    titulares: nicks,
    policy_ativa: policy,
    urls_habilitadas: policy ? URLS_MTLS : [],
    motivo: pronto ? null : faltando.join('; '),
    observacao: pronto && !arquivo
      ? 'o .pfx nao esta em ' + pfx + ' — o certificado veio para o navegador por outro caminho'
      : null,
  };
}

function escreverPolicy() {
  fs.mkdirSync(POLICY_DIR, { recursive: true });
  const regras = URLS_MTLS.map(function (u) {
    return JSON.stringify({ pattern: u, filter: {} });
  });
  fs.writeFileSync(
    POLICY_FILE,
    JSON.stringify({ AutoSelectCertificateForUrls: regras }, null, 2),
  );
}

/**
 * Grava o .pfx, importa na base NSS e garante a policy.
 *
 * A senha NUNCA e registrada em log nem devolvida — ela entra pelo argumento do
 * pk12util e morre aqui. O retorno diz o que passou a ser verdade.
 */
function instalar(bufferPfx, senha) {
  const pfx = caminhoDoPfx();
  fs.mkdirSync(path.dirname(pfx), { recursive: true });
  fs.writeFileSync(pfx, bufferPfx, { mode: 0o600 });

  // Substituir e o caso comum (renovacao anual). Sem remover o anterior, a base
  // acumula certificados vencidos e o Chrome pode apresentar o errado.
  //
  // \`-F\` e nao \`-D\`: o -D apaga so o certificado e deixa a chave privada orfa
  // na base, acumulando material criptografico que ninguem mais usa.
  apelidosComChave().forEach(function (nick) {
    try {
      rodar('certutil', ['-F', '-d', NSSDB, '-n', nick, '-f', arquivoDeSenhaDaBase()]);
    } catch (e) {
      console.warn('nao removeu certificado anterior "' + nick + '": ' + e.message);
    }
  });

  try {
    rodar('pk12util', ['-d', NSSDB, '-i', pfx, '-W', senha, '-k', arquivoDeSenhaDaBase()]);
  } catch (e) {
    // A mensagem do pk12util distingue senha errada de arquivo corrompido, e
    // essa diferenca e o que a pessoa precisa para saber o que fazer.
    const detalhe = ((e.stderr || '') + (e.stdout || '')).trim() || e.message;
    throw new Error('Falha ao importar o certificado: ' + detalhe);
  }

  escreverPolicy();
  return estado();
}

module.exports = { instalar, estado, escreverPolicy, POLICY_FILE, URLS_MTLS };
`,

  'src/callback.js': `async function sendCallback(session, tipo, payload) {
  const url = session.callbackUrl;
  if (!url) {
    console.warn('Callback URL não configurada, pulando envio');
    return;
  }

  try {
    // Sem timeout, uma conexao pendurada trava o envio para sempre. E como o
    // callback e o unico canal de volta ao Praefectus, evento perdido em falha
    // transitoria nao volta nunca — dai as duas tentativas.
    const enviar = () => fetch(url, {
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
      signal: AbortSignal.timeout(10000),
    });

    let resp;
    try {
      resp = await enviar();
    } catch (primeira) {
      console.warn('Callback falhou, tentando de novo em 2s:', primeira.message);
      await new Promise((r) => setTimeout(r, 2000));
      resp = await enviar();
    }

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
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) ?? 'https://uwtyuwktxalnpgrcbbgk.supabase.co';
  const callbackUrl = `${supabaseUrl}/functions/v1/robo-lances-webhook/callback`;

  const zip = new JSZip();
  const root = zip.folder('agente-lances-externo')!;

  // Core files — injeta a URL do Supabase ativo no CALLBACK_URL do .env.example.
  // O literal em CORE_FILES é o projeto de produção, então o ZIP sai correto mesmo
  // se este replace não casar; a substituição existe para quem aponta o app para
  // outro projeto via VITE_SUPABASE_URL.
  const callbackPadrao = 'https://uwtyuwktxalnpgrcbbgk.supabase.co/functions/v1/robo-lances-webhook/callback';
  for (const [path, content] of Object.entries(CORE_FILES)) {
    root.file(path, content.replace(callbackPadrao, callbackUrl));
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

  // A decisão de preço — fonte única, testada em src/components/robo-lances/test/estrategia.test.ts
  for (const [path, content] of Object.entries(ESTRATEGIA_FILES)) {
    root.file(path, content);
  }

  // Empty directories
  root.folder('certs');
  root.folder('logs/screenshots');

  return zip.generateAsync({ type: 'blob' });
}
