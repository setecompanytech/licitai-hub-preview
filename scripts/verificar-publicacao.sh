#!/usr/bin/env bash
# Verifica o que já está NO AR em praefectus.com.br.
#
# Publicar é ação manual no Lovable e a tela não confirma o que entrou. Este
# script baixa o que o site serve e procura trechos de texto que só existem no
# código novo. Literais de string sobrevivem à minificação; comentários não —
# usar comentário como assinatura já deu falso negativo aqui.
#
# Dois cuidados que uma primeira versão errou:
#   1. o HTML aponta só o bundle de entrada; as telas ficam em pedaços
#      carregados sob demanda, cujos nomes aparecem DENTRO do JS de entrada.
#      Olhar só o HTML acusa "não publicado" para tudo, mesmo estando no ar;
#   2. são ~120 pedaços — baixar em série estoura qualquer paciência, então
#      aqui vão em paralelo.
#
# Uso:  bash scripts/verificar-publicacao.sh [url]

set -uo pipefail
SITE="${1:-https://praefectus.com.br}"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

echo "Lendo $SITE ..."
curl -fsSL "$SITE" -o "$TMP/index.html" || { echo "Falhou ao ler o site."; exit 1; }

grep -oE '/assets/[^"]+\.js' "$TMP/index.html" | sed 's|^/||' | sort -u >"$TMP/lista"
[ -s "$TMP/lista" ] || { echo "Nenhum bundle .js encontrado no HTML."; exit 1; }

baixar() { # baixa em paralelo a lista recebida por stdin
  xargs -P 10 -I{} sh -c 'curl -fsSL -o "'"$TMP"'/$(echo {} | tr / _)" "'"$SITE"'/{}" 2>/dev/null'
}

# Uma passada não basta: pedaço carrega pedaço. Vai até não aparecer nome novo —
# parar antes acusa "não publicado" para o que está no ar, só mais fundo.
cp "$TMP/lista" "$TMP/vistos"
for _ in 1 2 3 4 5; do
  [ -s "$TMP/lista" ] || break
  baixar <"$TMP/lista"
  cat "$TMP"/assets_*.js 2>/dev/null \
    | grep -oE '(\./)?assets/[A-Za-z0-9_.-]+\.js' | sed 's|^\./||' | sort -u >"$TMP/todos"
  comm -13 "$TMP/vistos" "$TMP/todos" >"$TMP/lista"
  sort -u "$TMP/vistos" "$TMP/lista" -o "$TMP/vistos"
done

cat "$TMP"/assets_*.js >"$TMP/tudo.js" 2>/dev/null
echo "$(ls "$TMP"/assets_*.js | wc -l | tr -d ' ') arquivo(s), $(wc -c <"$TMP/tudo.js" | tr -d ' ') bytes."
echo

# ── Carimbo de versão ────────────────────────────────────────────────────────
#
# Assinatura de texto só pega mudança que cria texto. O carimbo pega qualquer
# uma: se o que o domínio serve for igual ao que está no repo, o último commit
# chegou ao ar.
LOCAL=$(grep -oE "VERSAO_APP = '[^']+'" "$(dirname "$0")/../src/lib/versao.ts" | grep -oE "[0-9]{4}-[0-9]{2}-[0-9]{2}\.[0-9]+")
if grep -qF "$LOCAL" "$TMP/tudo.js"; then
  printf '  no ar     versão %s (a mesma do repositório)\n\n' "$LOCAL"
else
  NOAR=$(grep -oE "[0-9]{4}-[0-9]{2}-[0-9]{2}\.[0-9]+" "$TMP/tudo.js" | sort -u | tail -1)
  printf '  FALTA     versão: repositório em %s, domínio em %s\n\n' "$LOCAL" "${NOAR:-desconhecida}"
  echo "  → publique no Lovable; os itens abaixo podem estar desatualizados."
  echo
fi

falta=0
checar() { # checar "<rótulo>" "<literal que só existe no código novo>"
  if grep -qF "$2" "$TMP/tudo.js"; then
    printf '  no ar     %s\n' "$1"
  else
    printf '  FALTA     %s\n' "$1"
    falta=1
  fi
}

checar "carteira própria (Meus contratos)"   "Ver todos da equipe"
checar "meta sobre NF-e quitada"             "NF-e Quitada (valor recebido)"
checar "marco de pagamento configurável"     "Ao receber (NF-e quitada)"
checar "confirmação de exclusão"             "Excluir definitivamente"
checar "vendedor fora da equipe"             "Vendedor fora da equipe"
checar "criador da empresa entra com nome"   "nome_completo, username"
checar "kit de faturamento"                  "Kit de faturamento"
checar "kit em PDF único"                    "Baixar PDF único"
checar "subtela do financeiro no caminho"    "/financeiro/lancamentos"
checar "rótulos distintos de Voltar"         "Todos os contratos"

# Checagem invertida. Identificador que o código NÃO declara não pode ser
# renomeado pelo minificador — sobra literal no bundle. Foi assim que a aba
# Bonificações foi ao ar chamando podePagar() sem que a função existisse.
if grep -qE '\bpodePagar\b' "$TMP/tudo.js"; then
  printf '  QUEBRADO  aba Bonificações (podePagar solto no bundle)\n'
  falta=1
else
  printf '  no ar     aba Bonificações íntegra\n'
fi

# Mais checagens invertidas: aqui o que prova a correção é o SUMIÇO do texto
# antigo. Estes dois eram os botões que navegavam por conta própria e faziam o
# percurso girar.
ausente() { # ausente "<rótulo>" "<texto que só existe no código velho>"
  if grep -qF "$2" "$TMP/tudo.js"; then
    printf '  FALTA     %s\n' "$1"
    falta=1
  else
    printf '  no ar     %s\n' "$1"
  fi
}

ausente "pasta do processo usa o Voltar comum" "Voltar para de onde você veio"
ausente "financeiro sem botão duplicado"       "Voltar ao Hub"

echo
if [ "$falta" -eq 0 ]; then
  echo "Tudo publicado."
else
  echo "Há item FALTA acima: publique no Lovable e rode de novo."
  exit 2
fi
