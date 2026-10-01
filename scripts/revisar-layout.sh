#!/usr/bin/env bash
# Revisão de LAYOUT antes de qualquer carimbo/Publish (regra do dono, 30/09/2026).
#
# tsc e build não enxergam coluna cortada nem bloco caído na coluna errada.
# Este portão roda os testes de contrato de layout ("[layout]") e lista, nos
# arquivos alterados, as estruturas que mais quebram quando ganham conteúdo:
# grades de colunas fixas e tabelas com coluna fixa à direita. Cada arquivo
# listado exige a conferência manual descrita no CLAUDE.md (estrutura antes
# e depois: quantos filhos a grade espera; quanto texto cabe na célula).
set -euo pipefail
cd "$(dirname "$0")/.."

echo "▸ testes de contrato de layout"
set -o pipefail
npx vitest run -t '\[layout\]' 2>&1 | tail -4

echo
echo "▸ estruturas sensíveis nos arquivos alterados (conferir à mão):"
alterados=$(git diff --name-only HEAD -- 'src/**/*.tsx' ; git diff --name-only --cached -- 'src/**/*.tsx'; git ls-files --others --exclude-standard -- 'src/**/*.tsx')
alterados=$(printf '%s\n' "$alterados" | sort -u | sed '/^$/d')
if [ -z "$alterados" ]; then
  echo "  (nenhum .tsx alterado em relação ao HEAD)"
else
  achou=0
  for f in $alterados; do
    [ -f "$f" ] || continue
    grades=$(grep -c 'grid-cols-\[' "$f" || true)
    fixas=$(grep -c 'sticky right-0' "$f" || true)
    if [ "$grades" != "0" ] || [ "$fixas" != "0" ]; then
      achou=1
      echo "  $f — grades com colunas fixas: $grades · tabelas com coluna fixa à direita: $fixas"
    fi
  done
  [ "$achou" = "0" ] && echo "  nenhuma estrutura sensível nos arquivos alterados"
fi
echo
echo "Regra: grade de colunas fixas recebe bloco novo DENTRO da coluna (flex-col), nunca como filho solto;"
echo "       célula de tabela com coluna fixa à direita não ganha texto a mais sem encurtar outro — o teste [layout] cobra o orçamento."
