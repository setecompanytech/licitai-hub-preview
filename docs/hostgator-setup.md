# Guia Completo — Deploy na HostGator

## Parte 1: Deploy Automático do Frontend (GitHub Actions)

### Pré-requisitos
- Conta HostGator com hospedagem ativa
- Projeto conectado ao GitHub

### Configuração dos Secrets no GitHub

Vá em **Settings → Secrets and variables → Actions** no repositório e adicione:

| Secret | Valor | Onde encontrar |
|--------|-------|----------------|
| `VITE_SUPABASE_URL` | `https://sbnlovigyifvrkgsoalj.supabase.co` | Já configurado no projeto |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Sua chave pública | Já configurado no projeto |
| `FTP_SERVER` | Ex: `ftp.seudominio.com.br` | cPanel → Contas FTP |
| `FTP_USERNAME` | Ex: `usuario@seudominio.com.br` | cPanel → Contas FTP |
| `FTP_PASSWORD` | Senha da conta FTP | Definida ao criar conta FTP |
| `FTP_SERVER_DIR` | `/public_html/` (padrão) | Diretório raiz do site |

### Como criar conta FTP na HostGator
1. Acesse **cPanel** da sua hospedagem
2. Vá em **Contas FTP**
3. Crie uma conta apontando para `/public_html/`
4. Use as credenciais nos Secrets do GitHub

Após configurar, cada push no `main` faz deploy automático!

---

## Parte 2: Agente Externo de Lances no VPS HostGator

### Requisitos do VPS
- **Plano**: VPS Linux (Ubuntu 22.04+)
- **RAM**: 2GB+ (Puppeteer/Chromium exige memória)
- **Localização**: Brasil (menor latência com portais)
- **Plano recomendado**: VPS 2 da HostGator (~R$69/mês)

### Instalação Passo a Passo

#### 1. Acesso SSH
```bash
ssh root@IP_DO_SEU_VPS
```

#### 2. Baixar o Template do Agente
No sistema, vá em **Robô de Lances → Download Template** e baixe o ZIP.
Ou transfira via SCP:
```bash
scp agente-lances-template.zip root@IP_DO_VPS:/opt/
```

#### 3. Instalar
```bash
cd /opt
unzip agente-lances-template.zip
cd agente-lances
chmod +x setup.sh
bash setup.sh
```

#### 4. Configurar o .env
```bash
nano .env
```
Preencha:
```
PORT=3500
API_KEY=sua_chave_secreta_aqui
CALLBACK_URL=https://sbnlovigyifvrkgsoalj.supabase.co/functions/v1/robo-lances-webhook/callback
LOG_LEVEL=info
```

#### 5. Instalar Certificado Digital
```bash
cp /caminho/do/certificado.pfx certs/
```

#### 6. Configurar HTTPS (recomendado)
```bash
sudo bash setup-nginx.sh agente.seudominio.com.br
```

**Pré-requisito**: Apontar DNS do subdomínio para o IP do VPS.

#### 7. Iniciar o Agente
```bash
pm2 restart agente-lances
```

#### 8. Verificar
```bash
curl http://localhost:3500/health
```

#### 9. Conectar ao Sistema
No sistema, vá em **Robô de Lances → Configurar Agente**:
- **URL Base**: `https://agente.seudominio.com.br`
- **Chave de API**: A mesma definida no `.env`

### Opção Docker (alternativa ao PM2)
```bash
docker compose up -d
```

### Monitoramento
```bash
pm2 status          # Status do processo
pm2 logs            # Logs em tempo real
pm2 monit           # Dashboard de monitoramento
```

### Troubleshooting

| Problema | Solução |
|----------|---------|
| Chromium não abre | `sudo apt install chromium-browser` |
| Porta 3500 bloqueada | Liberar no firewall: `sudo ufw allow 3500` |
| SSL não funciona | Verificar DNS e rodar `sudo certbot --nginx` novamente |
| Agente offline no sistema | Verificar `pm2 status` e logs de erro |
