#!/usr/bin/env bash
# Reconhecimento ACOMPANHADO da central de notificações do fornecedor no
# Compras.gov (17/09/2026).
#
# O robô abre o perfil guardado do Compras.gov na tela remota, confirma a sessão
# do gov.br, vai da área do fornecedor até o Compras.gov novo e lê a central:
# links vistos, endereço, chamadas da API (sem cabeçalhos), tipos de notificação,
# total de não lidas e fotos em logs/screenshots/central-*.png na VPS. NÃO clica
# em notificação nenhuma (abrir uma a marcaria como lida) e não abre compra.
#
# Acompanhe na tela remota: https://agente.praefectus.com.br/vnc/
#
# A chave do agente é lida do .env da VPS e não aparece na saída.
#
# Uso:  bash scripts/reconhecer-central-notificacoes.sh [perfil]
set -euo pipefail
DESTINO="${AGENTE_SSH:-root@129.121.48.145}"
PORTA="${AGENTE_SSH_PORTA:-22022}"
PERFIL="${1:-}"

echo "Tela remota para acompanhar: https://agente.praefectus.com.br/vnc/"
echo "Reconhecendo a central (até 4 minutos)..."
ssh -p "$PORTA" "$DESTINO" "PERFIL='$PERFIL' bash -s" <<'REMOTO'
set -euo pipefail
cd /opt/agente-lances
CHAVE=$(grep -E '^AGENT_API_KEY=' .env | cut -d= -f2-)
PORTA_AGENTE=$(grep -E '^PORT=' .env | cut -d= -f2- || echo 3500)
CORPO='{}'
[ -n "$PERFIL" ] && CORPO="{\"perfil\":\"$PERFIL\"}"
curl -s -m 240 -X POST "http://localhost:${PORTA_AGENTE:-3500}/reconhecer/central-notificacoes" \
  -H "X-Agent-Key: $CHAVE" -H "Content-Type: application/json" -d "$CORPO" \
  | python3 -m json.tool --no-ensure-ascii
REMOTO
