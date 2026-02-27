// Infrastructure files: setup script, PM2, Nginx, docker-compose

export const INFRA_FILES: Record<string, string> = {
  'setup.sh': `#!/bin/bash
# ═══════════════════════════════════════════════════
# Script de instalação automática — Agente de Lances
# Testado em Ubuntu 22.04+ / Debian 12+
# ═══════════════════════════════════════════════════
set -e

echo "🚀 Instalando Agente de Lances..."
echo ""

# ─── 1. Atualizar sistema ───
echo "📦 Atualizando pacotes do sistema..."
sudo apt-get update -y && sudo apt-get upgrade -y

# ─── 2. Node.js 20 ───
echo "📦 Instalando Node.js 20..."
if ! command -v node &> /dev/null || [[ $(node -v | cut -d. -f1 | tr -d v) -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
echo "   Node.js $(node -v) instalado"

# ─── 3. Chromium ───
echo "📦 Instalando Chromium e dependências..."
sudo apt-get install -y \\
  chromium-browser \\
  libnss3 libatk-bridge2.0-0 libx11-xcb1 \\
  libxcomposite1 libxdamage1 libxrandr2 \\
  libgbm1 libasound2 libpangocairo-1.0-0 \\
  libgtk-3-0 fonts-liberation \\
  --no-install-recommends

# ─── 4. PM2 (gerenciador de processos) ───
echo "📦 Instalando PM2..."
sudo npm install -g pm2

# ─── 5. Dependências do projeto ───
echo "📦 Instalando dependências Node.js..."
npm install

# ─── 6. Configurar .env ───
if [ ! -f .env ]; then
  cp .env.example .env
  echo "⚠️  Arquivo .env criado — edite com suas configurações!"
fi

# ─── 7. Criar diretórios ───
mkdir -p certs logs/screenshots

# ─── 8. Configurar PM2 ───
echo "🔧 Configurando PM2..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup | tail -1 | bash 2>/dev/null || true

echo ""
echo "════════════════════════════════════════════════"
echo "✅ Instalação concluída!"
echo ""
echo "Próximos passos:"
echo "  1. Edite o arquivo .env com sua API key e callback URL"
echo "  2. Copie seu certificado .pfx para certs/"
echo "  3. Reinicie: pm2 restart agente-lances"
echo "  4. Verifique: curl http://localhost:3500/health"
echo "  5. Opcional: configure HTTPS com: sudo bash setup-nginx.sh"
echo "════════════════════════════════════════════════"
`,

  'ecosystem.config.js': `module.exports = {
  apps: [{
    name: 'agente-lances',
    script: 'src/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
    },
    error_file: './logs/error.log',
    out_file: './logs/output.log',
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }],
};
`,

  'setup-nginx.sh': `#!/bin/bash
# ═══════════════════════════════════════════════
# Configuração de HTTPS com Nginx + Let's Encrypt
# Uso: sudo bash setup-nginx.sh SEU_DOMINIO
# ═══════════════════════════════════════════════
set -e

DOMAIN=\${1:-"agente.seudominio.com.br"}

echo "🔒 Configurando HTTPS para \${DOMAIN}..."

# Instalar Nginx e Certbot
sudo apt-get install -y nginx certbot python3-certbot-nginx

# Criar configuração do Nginx
sudo tee /etc/nginx/sites-available/agente-lances > /dev/null <<NGINX
server {
    listen 80;
    server_name \${DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:3500;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \\$host;
        proxy_set_header X-Real-IP \\$remote_addr;
        proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\$scheme;
        proxy_cache_bypass \\$http_upgrade;
        proxy_read_timeout 300s;
    }
}
NGINX

# Ativar site
sudo ln -sf /etc/nginx/sites-available/agente-lances /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# Gerar certificado SSL
echo "📜 Gerando certificado SSL com Let's Encrypt..."
sudo certbot --nginx -d \${DOMAIN} --non-interactive --agree-tos --email admin@\${DOMAIN} || {
  echo "⚠️  Certbot falhou. Verifique se o DNS do domínio aponta para este servidor."
  echo "   Depois rode manualmente: sudo certbot --nginx -d \${DOMAIN}"
}

echo ""
echo "✅ HTTPS configurado!"
echo "   URL: https://\${DOMAIN}"
echo "   Use esta URL na configuração do agente externo no sistema."
`,

  'docker-compose.yml': `version: '3.8'

services:
  agente-lances:
    build: .
    container_name: agente-lances
    restart: unless-stopped
    ports:
      - "3500:3500"
    env_file:
      - .env
    volumes:
      - ./certs:/app/certs:ro
      - ./logs:/app/logs
    environment:
      - PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
      - NODE_ENV=production
    deploy:
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 512M
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3500/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
`,
};
