# 🧪 Roteiro Completo — Testes do Agente de Lances no VPS

## Para quem é este guia?

Este roteiro é para **qualquer pessoa**, mesmo sem experiência técnica. Cada comando está explicado e você pode copiar e colar diretamente no terminal.

---

## 📋 Pré-requisitos (o que você precisa ter antes de começar)

| Item | Onde conseguir | Status |
|------|----------------|--------|
| Acesso SSH ao VPS | HostGator → Painel VPS → Dados de Acesso | ☐ |
| Certificado digital A1 (.pfx) | Sua certificadora (Certisign, Serasa, etc.) | ☐ |
| Senha do certificado digital | Fornecida pela certificadora | ☐ |
| CNPJ da empresa | Cartão CNPJ | ☐ |
| Número de uma licitação no Compras.gov.br | Portal Compras.gov.br | ☐ |
| Programa de SSH instalado | Windows: MobaXterm / Mac: Terminal nativo | ☐ |

---

## 🔧 ETAPA 1 — Conectar ao Servidor VPS

### 1.1 Abrir o programa de acesso remoto

**No Windows:**
1. Baixe o MobaXterm em: https://mobaxterm.mobatek.net/download.html
2. Instale normalmente (próximo, próximo, concluir)
3. Abra o MobaXterm
4. Clique em **"Session"** (canto superior esquerdo)
5. Clique em **"SSH"**
6. Preencha:
   - **Remote host**: `129.121.48.145`
   - **Port**: `22022`
   - **Username**: `root`
7. Clique **OK**
8. Digite a senha quando solicitado (a senha não aparece enquanto digita, isso é normal)

**No Mac/Linux:**
1. Abra o **Terminal** (Cmd + Espaço → digite "Terminal")
2. Cole este comando e pressione Enter:
```bash
ssh root@129.121.48.145 -p 22022
```
3. Digite **yes** se perguntar sobre fingerprint
4. Digite a senha (não aparece na tela, é normal)

### 1.2 Verificar que você está no servidor certo

Após conectar, cole este comando e pressione Enter:
```bash
hostname && echo "--- Memória ---" && free -h && echo "--- Node.js ---" && node -v
```

**O que você deve ver:**
```
(nome do servidor)
--- Memória ---
              total        used        free
Mem:          8.0G        2.1G        5.9G
--- Node.js ---
v20.x.x
```

✅ Se aparecer algo parecido, você está conectado corretamente!
❌ Se der erro, verifique IP, porta e senha.

---

## 📁 ETAPA 2 — Verificar o Agente Instalado

### 2.1 Ir até a pasta do agente

```bash
cd /opt/agente-lances-externo
```

> **O que isso faz?** Navega até a pasta onde o agente está instalado.

### 2.2 Ver os arquivos do projeto

```bash
ls -la
```

**Você deve ver arquivos como:**
```
.env
ecosystem.config.js
package.json
src/
certs/
logs/
```

### 2.3 Verificar se o agente está rodando

```bash
pm2 status
```

**Resultado esperado:**
```
┌─────────────────┬────┬─────────┬──────┬───────┐
│ App name        │ id │ mode    │ pid  │ status│
├─────────────────┼────┼─────────┼──────┼───────┤
│ agente-lances   │ 0  │ fork    │ 1234 │ online│
└─────────────────┴────┴─────────┴──────┴───────┘
```

✅ Status **online** = agente está funcionando
❌ Status **errored** ou **stopped** = precisa reiniciar (veja Etapa 7)

### 2.4 Testar se o agente responde

```bash
curl http://localhost:3500/health
```

**Resultado esperado (algo parecido com):**
```json
{
  "status": "ok",
  "version": "2.1.0",
  "uptime": "2h 15m",
  "sessions": { "active": 0, "max": 8 }
}
```

✅ Se retornou JSON com `"status": "ok"`, o agente está saudável!

---

## 🔐 ETAPA 3 — Instalar o Certificado Digital

### 3.1 Transferir o certificado para o servidor

**Opção A — Via MobaXterm (Windows):**
1. No painel lateral esquerdo do MobaXterm, você verá os arquivos do servidor
2. Navegue até `/opt/agente-lances-externo/certs/`
3. Arraste o arquivo `.pfx` do seu computador para essa pasta

**Opção B — Via Terminal (Mac/Linux):**
Abra um **novo terminal** (não feche o que está conectado ao VPS) e execute:
```bash
scp -P 22022 /caminho/do/seu/certificado.pfx root@129.121.48.145:/opt/agente-lances-externo/certs/
```

> **Substitua** `/caminho/do/seu/certificado.pfx` pelo caminho real do arquivo no seu computador.
> Exemplo: `~/Downloads/meu-certificado.pfx`

### 3.2 Renomear o certificado com o CNPJ

O agente localiza o certificado pelo CNPJ. Renomeie o arquivo:

```bash
cd /opt/agente-lances-externo/certs/
mv certificado.pfx 12345678000199.pfx
```

> **IMPORTANTE:** Substitua `12345678000199` pelo CNPJ real da empresa (só números, sem pontos ou barras).
> Substitua `certificado.pfx` pelo nome real do arquivo que você copiou.

### 3.3 Verificar que o certificado está na pasta

```bash
ls -la /opt/agente-lances-externo/certs/
```

**Deve aparecer:**
```
12345678000199.pfx
```

### 3.4 Configurar a senha do certificado

```bash
cd /opt/agente-lances-externo
nano .env
```

> **O que é o nano?** É um editor de texto simples no terminal.

Localize a linha `CERT_PASSWORDS` e edite assim:
```
CERT_PASSWORDS={"12345678000199":"sua_senha_aqui"}
```

> **Substitua:**
> - `12345678000199` pelo CNPJ (só números)
> - `sua_senha_aqui` pela senha real do certificado

**Para salvar e sair do nano:**
1. Pressione `Ctrl + O` (letra O, não zero)
2. Pressione `Enter` para confirmar
3. Pressione `Ctrl + X` para sair

### 3.5 Reiniciar o agente para aplicar a configuração

```bash
pm2 restart agente-lances
```

Aguarde 5 segundos e verifique:
```bash
curl http://localhost:3500/health
```

---

## 🖥️ ETAPA 4 — Teste Visual (modo não-headless)

Este é o teste mais importante: você vai **ver o navegador abrindo** e navegando no portal.

### 4.1 Parar o agente temporariamente

```bash
pm2 stop agente-lances
```

### 4.2 Ativar modo visual (tela visível)

```bash
cd /opt/agente-lances-externo
nano src/portals/comprasgov.js
```

Procure a linha que contém `headless`:
```javascript
headless: 'new',
```

Altere para:
```javascript
headless: false,
```

Salve: `Ctrl + O` → `Enter` → `Ctrl + X`

### 4.3 Instalar suporte a tela virtual

Como o VPS não tem monitor, precisamos criar uma "tela virtual":

```bash
sudo apt-get install -y xvfb x11vnc
```

> **O que isso faz?**
> - `xvfb` = cria uma tela virtual (como se houvesse um monitor conectado)
> - `x11vnc` = permite que você veja essa tela do seu computador

### 4.4 Iniciar a tela virtual

```bash
export DISPLAY=:99
Xvfb :99 -screen 0 1920x1080x24 &
x11vnc -display :99 -forever -nopw -listen 0.0.0.0 -rfbport 5900 &
```

> **O que aconteceu?**
> - Criou uma tela virtual de 1920x1080
> - Iniciou o VNC na porta 5900 para você assistir remotamente

### 4.5 Conectar via VNC para assistir

**No Windows:**
1. Baixe o VNC Viewer: https://www.realvnc.com/pt/connect/download/viewer/
2. Abra o VNC Viewer
3. Digite: `129.121.48.145:5900`
4. Clique **Connect**

**No Mac:**
1. Abra o **Finder**
2. Menu **Ir → Conectar ao Servidor**
3. Digite: `vnc://129.121.48.145:5900`
4. Clique **Conectar**

> Você verá uma tela preta. Isso é normal — o navegador ainda não abriu.

### 4.6 Executar o teste manual

No terminal SSH (não no VNC), execute:

```bash
cd /opt/agente-lances-externo
DISPLAY=:99 node -e "
const ComprasGov = require('./src/portals/comprasgov.js');
const portal = new ComprasGov({
  cnpj: '12345678000199',
  certPath: './certs/12345678000199.pfx',
  certPassword: 'sua_senha_aqui'
});

(async () => {
  console.log('🚀 Iniciando teste...');
  
  // FASE 1: Login
  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('FASE 1: LOGIN COM CERTIFICADO DIGITAL');
  console.log('═══════════════════════════════════════');
  try {
    const loginOk = await portal.login();
    console.log(loginOk ? '✅ Login realizado com sucesso!' : '❌ Falha no login');
    if (!loginOk) process.exit(1);
  } catch (err) {
    console.log('❌ Erro no login:', err.message);
    console.log('');
    console.log('POSSÍVEIS CAUSAS:');
    console.log('  - Certificado expirado');
    console.log('  - Senha incorreta');
    console.log('  - Arquivo .pfx corrompido');
    console.log('  - Portal fora do ar');
    process.exit(1);
  }

  // FASE 2: Navegar para disputa
  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('FASE 2: ACESSAR SALA DE DISPUTA');
  console.log('═══════════════════════════════════════');
  const codigoLicitacao = 'COLOQUE_O_CODIGO_AQUI';
  try {
    const disputa = await portal.navegarParaDisputa(codigoLicitacao);
    console.log('✅ Disputa acessada!');
    console.log('   Melhor lance atual: R$', disputa.melhorLance);
    console.log('   Status:', disputa.status);
  } catch (err) {
    console.log('❌ Erro ao acessar disputa:', err.message);
    console.log('');
    console.log('POSSÍVEIS CAUSAS:');
    console.log('  - Código da licitação incorreto');
    console.log('  - Disputa ainda não iniciou');
    console.log('  - Sessão expirou');
  }

  // FASE 3: Ler melhor lance (NÃO envia lance, apenas lê)
  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('FASE 3: LEITURA DE DADOS (somente leitura)');
  console.log('═══════════════════════════════════════');
  try {
    const melhor = await portal.lerMelhorLance();
    console.log('✅ Melhor lance lido: R$', melhor);
  } catch (err) {
    console.log('⚠️  Não foi possível ler o melhor lance:', err.message);
  }

  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('🏁 TESTE CONCLUÍDO (modo somente leitura)');
  console.log('═══════════════════════════════════════');
  console.log('');
  console.log('⚠️  NENHUM LANCE FOI ENVIADO.');
  console.log('   Para testar envio de lance, use uma licitação');
  console.log('   de teste ou altere o script manualmente.');
  
  await portal.fechar();
  process.exit(0);
})();
"
```

> **IMPORTANTE — Substitua antes de executar:**
> - `12345678000199` → seu CNPJ real (2 lugares)
> - `sua_senha_aqui` → senha real do certificado
> - `COLOQUE_O_CODIGO_AQUI` → número real de uma licitação

### 4.7 O que observar no VNC

Enquanto o teste roda, **assista na tela do VNC**. Você deve ver:

| Momento | O que aparece na tela |
|---------|----------------------|
| Início | Chromium abre e vai para gov.br |
| Login | Popup de certificado aparece → seleciona automaticamente |
| Após login | Página do Compras.gov.br logado |
| Disputa | Navega para a sala de disputa |
| Leitura | Captura o valor do melhor lance |

**Anote tudo que parecer diferente do esperado!** Tire print da tela se possível.

---

## 🔍 ETAPA 5 — Mapear Seletores Reais

Esta é a etapa mais técnica. Você vai identificar os "endereços" dos botões e campos no site.

### 5.1 Abrir Chromium manualmente no VNC

```bash
DISPLAY=:99 chromium-browser --no-sandbox --disable-gpu https://www.gov.br/compras/pt-br &
```

### 5.2 No VNC, usar o DevTools

1. Na tela do VNC, clique com **botão direito** em qualquer elemento do site
2. Clique em **"Inspecionar"** (ou pressione `F12`)
3. O DevTools abre ao lado

### 5.3 Identificar seletores de cada elemento

Para cada elemento abaixo, faça:
1. Clique no ícone de **seta** (canto superior esquerdo do DevTools) 🔍
2. Clique no elemento desejado na página
3. No DevTools, anote o **seletor CSS** do elemento

**Elementos que você precisa mapear:**

| # | Elemento | O que procurar | Onde anotar |
|---|----------|----------------|-------------|
| 1 | Botão "Entrar com certificado" | `<button>` ou `<a>` com texto sobre certificado | Seletor: _________________ |
| 2 | Campo de busca de licitação | `<input>` onde digita o número | Seletor: _________________ |
| 3 | Botão "Buscar" | `<button>` ao lado do campo de busca | Seletor: _________________ |
| 4 | Link "Sala de Disputa" | `<a>` ou `<button>` para entrar na disputa | Seletor: _________________ |
| 5 | Valor do melhor lance | `<span>` ou `<div>` que mostra "R$ XX,XX" | Seletor: _________________ |
| 6 | Campo de valor do lance | `<input>` onde digita o valor do lance | Seletor: _________________ |
| 7 | Botão "Enviar Lance" | `<button>` de envio | Seletor: _________________ |
| 8 | Modal de confirmação | `<div>` do popup "Confirmar lance?" | Seletor: _________________ |
| 9 | Botão "Confirmar" do modal | `<button>` dentro do modal | Seletor: _________________ |
| 10 | Mensagem de sucesso | `<div>` ou `<span>` "Lance enviado" | Seletor: _________________ |
| 11 | Timer / Cronômetro | Elemento que mostra tempo restante | Seletor: _________________ |

### 5.4 Como copiar o seletor CSS

1. No DevTools, com o elemento selecionado (destacado em azul)
2. Clique com **botão direito** no código HTML destacado
3. Vá em **Copy → Copy selector**
4. Cole em um arquivo de texto para guardar

### 5.5 Salvar os seletores em um arquivo

```bash
nano /opt/agente-lances-externo/seletores-comprasgov.txt
```

Cole todos os seletores mapeados. Exemplo:
```
# Seletores Compras.gov.br — Mapeados em DD/MM/AAAA

1. Botão Login Certificado: #btn-certificado-digital
2. Campo Busca: input[name="numero-licitacao"]
3. Botão Buscar: button.btn-pesquisar
4. Link Sala Disputa: a[href*="sala-disputa"]
5. Melhor Lance: .valor-melhor-lance span.valor
6. Campo Valor Lance: #input-meu-lance
7. Botão Enviar: button#btn-enviar-lance
8. Modal Confirmação: .modal-confirmacao
9. Botão Confirmar: .modal-confirmacao button.btn-confirmar
10. Mensagem Sucesso: .alert-success
11. Timer: .cronometro-disputa
```

Salve: `Ctrl + O` → `Enter` → `Ctrl + X`

---

## ✏️ ETAPA 6 — Atualizar o Script com Seletores Reais

### 6.1 Editar o arquivo do portal

```bash
nano /opt/agente-lances-externo/src/portals/comprasgov.js
```

### 6.2 Substituir os seletores genéricos

Procure cada `SELETOR_` ou seletor existente e substitua pelo real que você mapeou na Etapa 5.

**Dica para encontrar:** Pressione `Ctrl + W` no nano para buscar texto.

### 6.3 Salvar e reiniciar

```bash
pm2 restart agente-lances
```

---

## 🔄 ETAPA 7 — Restaurar Modo Produção

Após os testes, **volte o agente para modo automático (sem tela)**:

### 7.1 Voltar para headless

```bash
cd /opt/agente-lances-externo
nano src/portals/comprasgov.js
```

Altere de volta:
```javascript
headless: 'new',
```

Salve: `Ctrl + O` → `Enter` → `Ctrl + X`

### 7.2 Parar a tela virtual e VNC

```bash
killall Xvfb x11vnc 2>/dev/null
```

### 7.3 Reiniciar o agente em modo produção

```bash
pm2 restart agente-lances
```

### 7.4 Verificação final

```bash
curl http://localhost:3500/health
```

Deve retornar `"status": "ok"`.

---

## 🚨 ETAPA 8 — Solução de Problemas Comuns

### Problema: "Chromium não abre"
```bash
# Instalar dependências do Chromium
sudo apt-get install -y chromium-browser libnss3 libatk-bridge2.0-0 libgbm1
# Verificar instalação
which chromium-browser
```

### Problema: "Certificado não reconhecido"
```bash
# Verificar se o arquivo existe
ls -la /opt/agente-lances-externo/certs/
# Verificar se o CNPJ no nome bate com o .env
cat /opt/agente-lances-externo/.env | grep CERT
```

### Problema: "Agente não inicia"
```bash
# Ver logs de erro detalhados
pm2 logs agente-lances --lines 50
# Se necessário, reinstalar dependências
cd /opt/agente-lances-externo && npm install
```

### Problema: "VNC não conecta"
```bash
# Verificar se a porta 5900 está aberta
sudo ufw allow 5900
# Verificar se o x11vnc está rodando
ps aux | grep x11vnc
```

### Problema: "Porta 3500 não responde externamente"
```bash
# Liberar no firewall
sudo ufw allow 3500
# Verificar Nginx
sudo nginx -t && sudo systemctl restart nginx
```

### Problema: "Login falha no portal"
- Verifique se o certificado não está **expirado**: geralmente vale 1-3 anos
- Verifique se a **senha** está correta no `.env`
- Tente acessar o portal **manualmente** pelo navegador do seu computador com o mesmo certificado

### Problema: "Seletores não funcionam"
- Os portais **atualizam a interface** periodicamente
- Refaça a Etapa 5 para mapear novos seletores
- Seletores com IDs dinâmicos (ex: `ng-c123456`) mudam a cada deploy do portal

---

## 📊 ETAPA 9 — Checklist de Validação Final

Marque cada item conforme for validando:

```
CONEXÃO
  ☐ SSH conecta no VPS
  ☐ Agente responde em /health
  ☐ PM2 mostra status "online"

CERTIFICADO
  ☐ Arquivo .pfx está em certs/
  ☐ Nome do arquivo = CNPJ + .pfx
  ☐ Senha configurada no .env
  ☐ Certificado dentro da validade

COMPRAS.GOV.BR — LOGIN
  ☐ Chromium abre o portal
  ☐ Certificado é reconhecido
  ☐ Login é concluído com sucesso
  ☐ Página logada é exibida

COMPRAS.GOV.BR — NAVEGAÇÃO
  ☐ Busca de licitação funciona
  ☐ Sala de disputa é acessada
  ☐ Melhor lance é lido corretamente
  ☐ Timer/cronômetro é capturado

COMPRAS.GOV.BR — LANCE (⚠️ usar licitação de teste!)
  ☐ Campo de valor recebe o valor
  ☐ Botão enviar é clicado
  ☐ Modal de confirmação aparece
  ☐ Confirmação é clicada
  ☐ Mensagem de sucesso aparece

PRODUÇÃO
  ☐ headless voltou para 'new'
  ☐ VNC e Xvfb desligados
  ☐ PM2 reiniciado em modo produção
  ☐ /health retorna "ok"
```

---

## 📞 Suporte

Se encontrar algum problema que não está listado aqui:
1. Copie a mensagem de erro completa
2. Tire screenshot da tela do VNC (se aplicável)
3. Salve os logs: `pm2 logs agente-lances --lines 100 > /tmp/logs-erro.txt`
4. Envie tudo para a equipe de suporte técnico

---

> **⏱ Tempo estimado total:** 2-4 horas (primeira vez) | 30 minutos (revisões futuras)
>
> **⚠️ ATENÇÃO:** Nunca teste envio de lances em licitações reais! Use apenas licitações de teste ou o modo somente leitura.
