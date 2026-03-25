# Guia Completo: Migração DNS para Cloudflare

## Visão Geral

Migrar o gerenciamento DNS do `praefectus.com.br` da HostGator para o Cloudflare (plano gratuito).  
**O que muda:** apenas quem responde consultas DNS. O site, servidor, backend e código permanecem iguais.

**Ganhos:** E-mails transacionais funcionando + WAF + CDN + proteção DDoS.

---

## ETAPA 1 — Criar Conta no Cloudflare (5 min)

1. Acesse [cloudflare.com](https://www.cloudflare.com/) e crie uma conta gratuita
2. Clique em **"Add a Site"**
3. Digite: `praefectus.com.br`
4. Selecione o plano **Free** e clique em **Continue**

---

## ETAPA 2 — Configurar Registros DNS (10 min)

O Cloudflare fará um scan automático dos registros atuais. **Revise e garanta** que os seguintes registros existam:

### 2.1 — Registros obrigatórios

| # | Tipo | Nome | Valor | Proxy | Finalidade |
|---|------|------|-------|-------|------------|
| 1 | **A** | `@` | `69.6.213.71` | ☁️ **Proxied** | Frontend (HostGator) |
| 2 | **A** | `www` | `69.6.213.71` | ☁️ **Proxied** | Redirect www → raiz |
| 3 | **A** | `agente` | `129.121.48.145` | ☁️ **Proxied** | VPS do Robô de Lances |
| 4 | **NS** | `notify` | `ns5.lovable.cloud` | 🔘 **DNS Only** | E-mail transacional (1/2) |
| 5 | **NS** | `notify` | `ns6.lovable.cloud` | 🔘 **DNS Only** | E-mail transacional (2/2) |
| 6 | **TXT** | `_lovable` | *(valor fornecido no Lovable Cloud → Emails)* | 🔘 **DNS Only** | Verificação de domínio |

### 2.2 — Registros opcionais (manter se existirem)

| Tipo | Nome | Valor | Proxy | Finalidade |
|------|------|-------|-------|------------|
| MX | `@` | *(se usar e-mail corporativo)* | 🔘 DNS Only | E-mail corporativo |
| TXT | `@` | `v=spf1 ...` | 🔘 DNS Only | SPF (se existir) |
| TXT | `_dmarc` | `v=DMARC1 ...` | 🔘 DNS Only | DMARC (se existir) |

### ⚠️ Regras importantes

- **`notify` DEVE ser DNS Only** (nuvem cinza) — o Lovable Cloud gerencia esse subdomínio
- **`agente` pode ser Proxied** — ganha proteção DDoS no VPS
- **Remova registros A/CNAME duplicados** que apontem para IPs antigos
- Se o Cloudflare importar um registro `CNAME notify`, **delete-o** e crie os dois NS acima

---

## ETAPA 3 — Alterar Nameservers na HostGator (5 min)

O Cloudflare fornecerá dois nameservers (ex: `aria.ns.cloudflare.com` e `tom.ns.cloudflare.com`).

### No painel HostGator:

1. Acesse **Domínios** → clique em `praefectus.com.br`
2. Vá em **Alterar Nameservers** (ou "Nameservers" / "DNS")
3. Substitua os nameservers atuais:

| Campo | Valor anterior | Novo valor |
|-------|---------------|---------------------|
| NS 1 | `ns1.hostgator.com.br` | `lia.ns.cloudflare.com` |
| NS 2 | `ns2.hostgator.com.br` | `todd.ns.cloudflare.com` |

4. Salve e aguarde propagação (**1h a 24h**, normalmente ~2h)

> **Nota:** Os nameservers exatos serão exibidos no Cloudflare. Use exatamente os que aparecerem lá.

---

## ETAPA 4 — Configurar SSL (3 min)

Após o Cloudflare ativar o domínio:

1. Vá em **SSL/TLS** → **Overview**
2. Selecione modo: **Full** *(não Full Strict)*

   > Usamos **Full** (e não Full Strict) porque o certificado AutoSSL da HostGator é auto-assinado/Let's Encrypt e pode não ser reconhecido como "trusted" pelo Cloudflare no modo Strict.

3. Em **SSL/TLS** → **Edge Certificates**, ative:

| Configuração | Valor |
|-------------|-------|
| Always Use HTTPS | ✅ Ativado |
| Automatic HTTPS Rewrites | ✅ Ativado |
| Minimum TLS Version | TLS 1.2 |
| TLS 1.3 | ✅ Ativado |

---

## ETAPA 5 — Configurar Segurança (5 min)

### 5.1 — WAF (Web Application Firewall)
- **Security** → **WAF** → Ative **Managed Rules** (gratuitas)

### 5.2 — Proteção contra Bots
- **Security** → **Bots** → Ative **Bot Fight Mode**

### 5.3 — Configurações gerais
- **Security** → **Settings**:

| Configuração | Valor |
|-------------|-------|
| Security Level | Medium |
| Challenge Passage | 30 minutes |
| Browser Integrity Check | ✅ Ativado |

### 5.4 — DDoS
- Proteção L3/L4/L7 já está **ativa automaticamente** no plano gratuito

---

## ETAPA 6 — Performance e Cache (5 min)

### 6.1 — Cache
- **Caching** → **Configuration**:

| Configuração | Valor |
|-------------|-------|
| Caching Level | Standard |
| Browser Cache TTL | 4 hours |

### 6.2 — Otimização
- **Speed** → **Optimization**:

| Configuração | Valor |
|-------------|-------|
| Auto Minify JS/CSS/HTML | ✅ Ativado |
| Brotli | ✅ Ativado |
| Early Hints | ✅ Ativado |
| Rocket Loader | ❌ **Desativado** (conflita com React SPA) |

---

## ETAPA 7 — Page Rules (3 regras gratuitas)

| # | URL Pattern | Configuração |
|---|------------|-------------|
| 1 | `praefectus.com.br/assets/*` | Cache Level = **Cache Everything**, Edge Cache TTL = **1 month** |
| 2 | `praefectus.com.br/api/*` | Cache Level = **Bypass** |
| 3 | `http://praefectus.com.br/*` | **Always Use HTTPS** |

---

## ETAPA 8 — Verificação pós-migração (checklist)

Após o Cloudflare mostrar status **"Active"**:

- [ ] Acessar `https://praefectus.com.br` — site carrega normalmente
- [ ] Acessar `https://www.praefectus.com.br` — redireciona para raiz
- [ ] Acessar `https://agente.praefectus.com.br` — VPS responde
- [ ] No Lovable Cloud → Emails → verificar se `notify.praefectus.com.br` mudou para **Active**
- [ ] Testar login/cadastro — verificar se e-mails de autenticação chegam
- [ ] Verificar DNS em [dnschecker.org](https://dnschecker.org) para `praefectus.com.br`
- [ ] Verificar NS em [dnschecker.org](https://dnschecker.org) para `notify.praefectus.com.br`

---

## Resumo do impacto

| Métrica | Antes (HostGator DNS) | Depois (Cloudflare DNS) |
|---------|----------------------|------------------------|
| Proteção DDoS | ❌ Nenhuma | ✅ L3/L4/L7 |
| WAF | ❌ Nenhum | ✅ Managed Rules |
| CDN Global | ❌ Servidor BR | ✅ 300+ PoPs globais |
| SSL | AutoSSL HostGator | Cloudflare Universal |
| Bot Protection | ❌ | ✅ Bot Fight Mode |
| E-mails transacionais | ❌ DNS não suporta NS | ✅ Funcionando |
| Performance (TTFB) | ~2s | ~0.5s (cache hit) |
| Custo adicional | — | **R$ 0** (plano Free) |

---

## Observações finais

- O plano gratuito do Cloudflare é **ilimitado em tráfego**
- O domínio **continua registrado na HostGator** — você não perde nada
- Se quiser reverter, basta trocar os nameservers de volta para os da HostGator
- Após ativação, monitore ameaças em **Security** → **Events** no painel Cloudflare
- O certificado SSL do Cloudflare é renovado automaticamente
