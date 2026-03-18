# Guia de Implementação do Cloudflare (Camada Gratuita)

## Objetivo
Adicionar proteção WAF, DDoS e CDN ao frontend hospedado na HostGator (`praefectus.com.br`).

---

## Passo a Passo

### 1. Criar Conta no Cloudflare
1. Acesse [cloudflare.com](https://www.cloudflare.com/) e crie uma conta gratuita.
2. Clique em **"Add a Site"** e insira `praefectus.com.br`.
3. Selecione o plano **Free**.

### 2. Configurar DNS
O Cloudflare irá escanear os registros DNS atuais. Verifique que os seguintes registros estão presentes:

| Tipo | Nome | Valor | Proxy |
|------|------|-------|-------|
| A | `praefectus.com.br` | `69.6.213.71` | ☁️ Proxied |
| A | `www` | `69.6.213.71` | ☁️ Proxied |
| NS | `notify` | `ns5.lovable.cloud` | DNS Only |
| NS | `notify` | `ns6.lovable.cloud` | DNS Only |
| A | `agente` | `129.121.48.145` | ☁️ Proxied |

> **IMPORTANTE:** O subdomínio `notify.praefectus.com.br` deve permanecer com **DNS Only** (sem proxy) pois é gerenciado pelo Lovable Cloud para e-mails transacionais.

### 3. Atualizar Nameservers na HostGator
1. Acesse o painel de controle da HostGator.
2. Vá em **Domínios** → **praefectus.com.br** → **Nameservers**.
3. Substitua os nameservers atuais pelos fornecidos pelo Cloudflare (ex: `aria.ns.cloudflare.com` e `tom.ns.cloudflare.com`).
4. Aguarde propagação DNS (até 24h).

### 4. Configurar SSL no Cloudflare
1. Em **SSL/TLS** → **Overview**, selecione modo **Full (strict)**.
2. Em **Edge Certificates**, ative:
   - **Always Use HTTPS**: ✅
   - **Automatic HTTPS Rewrites**: ✅
   - **Minimum TLS Version**: TLS 1.2

### 5. Ativar Proteções de Segurança (Gratuitas)
1. **Security** → **WAF**: Ative as regras gerenciadas (Managed Rules).
2. **Security** → **Bots**: Ative **Bot Fight Mode**.
3. **Security** → **DDoS**: A proteção DDoS Layer 3/4 já está ativa automaticamente.
4. **Security** → **Settings**:
   - Security Level: **Medium**
   - Challenge Passage: **30 minutes**
   - Browser Integrity Check: ✅

### 6. Configurar Cache e Performance
1. **Caching** → **Configuration**:
   - Caching Level: **Standard**
   - Browser Cache TTL: **4 hours**
2. **Speed** → **Optimization**:
   - Auto Minify: JS ✅, CSS ✅, HTML ✅
   - Brotli: ✅
   - Early Hints: ✅
   - Rocket Loader: ❌ (pode conflitar com React SPA)

### 7. Page Rules (Gratuitas - 3 disponíveis)
Crie as seguintes regras:

1. **Cache estático agressivo:**
   - URL: `praefectus.com.br/assets/*`
   - Settings: Cache Level = Cache Everything, Edge Cache TTL = 1 month

2. **Bypass cache para API:**
   - URL: `praefectus.com.br/api/*`
   - Settings: Cache Level = Bypass

3. **Forçar HTTPS:**
   - URL: `http://praefectus.com.br/*`
   - Settings: Always Use HTTPS

---

## Impacto Esperado

| Métrica | Antes | Depois |
|---------|-------|--------|
| Proteção DDoS | ❌ Nenhuma | ✅ L3/L4/L7 |
| WAF | ❌ Nenhum | ✅ Regras gerenciadas |
| CDN Global | ❌ HostGator BR | ✅ 300+ PoPs |
| SSL | HostGator AutoSSL | Cloudflare Universal |
| Bot Protection | ❌ | ✅ Bot Fight Mode |
| Performance | ~2s TTFB | ~0.5s TTFB (cache hit) |

## Observações
- O plano gratuito do Cloudflare é **ilimitado em tráfego**.
- Não afeta o funcionamento do Lovable Cloud (backend).
- O subdomínio `agente.praefectus.com.br` (VPS) também será protegido pelo proxy.
- Após ativação, monitore logs no **Security** → **Events** do Cloudflare.
