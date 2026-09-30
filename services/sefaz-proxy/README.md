# Praefectus — proxy mTLS para a SEFAZ

As edge functions do Supabase não fazem mTLS com certificado A1. Este serviço
faz a chamada SOAP ao **NFeDistribuicaoDFe** (ambiente nacional) com o `.pfx`
da empresa e devolve os XMLs. Ele não guarda certificado nem senha: cada
pedido traz os dois, usa e esquece.

## Rotas

| Rota | Corpo | Devolve |
| --- | --- | --- |
| `POST /consulta-chave` | `{ cnpj, chave, ambiente?, uf_autor?, pfx_base64, senha }` | `{ ok, cStat, mensagem, documentos: [{ tipo: 'procNFe'\|'resNFe', chave, numero, serie, emitente_cnpj, valor_total, data_emissao, xml }] }` |
| `POST /distribuicao-dfe` | `{ cnpj, ultimo_nsu, ambiente?, uf_autor?, pfx_base64, senha }` | o mesmo, mais `ultimo_nsu` e `max_nsu` |
| `POST /certificado/testar` | `{ cnpj?, pfx_base64, senha }` | `{ ok, titular, cnpj, valido_ate, vencido, confere_cnpj }` ou `{ ok:false, motivo: 'senha_incorreta'\|'formato'\|'invalido', mensagem }` |
| `GET /saude` | — | `{ ok: true }` |

Cabeçalho obrigatório nas rotas POST: `x-proxy-token: <PROXY_TOKEN>`.

`cStat` 138 = achou; 137 = nada para este CNPJ (a SEFAZ só entrega notas em
que a empresa é destinatária, transportadora ou terceiro autorizado); 656 =
consumo indevido, esperar uma hora. Nota que ainda não teve "Ciência da
Operação" vem só como `resNFe` (resumo); a inteira (`procNFe`) vem depois da
manifestação.

## Subir (Fly.io, exemplo)

```sh
cd services/sefaz-proxy
npm test
fly launch --no-deploy            # aceita o fly.toml
fly secrets set PROXY_TOKEN="$(openssl rand -hex 32)"
fly deploy
curl https://praefectus-sefaz-proxy.fly.dev/saude
```

Qualquer host que rode Node 20 serve (Render, Railway, VPS com Docker):
`docker build -t sefaz-proxy . && docker run -e PROXY_TOKEN=... -p 8787:8787 sefaz-proxy`.

## Ligar ao Praefectus

No projeto Supabase `uwtyuwktxalnpgrcbbgk`:

```sh
npx supabase secrets set SEFAZ_PROXY_URL="https://praefectus-sefaz-proxy.fly.dev" SEFAZ_PROXY_TOKEN="<o mesmo PROXY_TOKEN>" --project-ref uwtyuwktxalnpgrcbbgk
npx supabase functions deploy nfe-xml-por-chave --project-ref uwtyuwktxalnpgrcbbgk
npx supabase functions deploy fin-sefaz-nsu-puxar --project-ref uwtyuwktxalnpgrcbbgk
```

O certificado A1 da empresa entra pelo Praefectus (Financeiro › Integrações ›
Certificado digital A1 › Gerar link de envio): o `.pfx` vai para o bucket
privado `certificados` e a senha fica cifrada no banco. A edge lê os dois com
a service role e os manda ao proxy a cada consulta.
