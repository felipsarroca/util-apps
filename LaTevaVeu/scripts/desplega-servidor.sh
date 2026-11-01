#!/usr/bin/env bash
# Desplega el servidor (server/neon.ts) a Neon Functions, branca produccio, funció «latevaveu».
# Cal la clau d'API de Neon a la variable d'usuari NEON_API_KEY i executar-lo des d'una còpia
# amb node_modules (npm ci). La clau no es mostra ni es desa enlloc.
#
# Ús: bash scripts/desplega-servidor.sh             → nou codi; conserva les variables actuals
#     bash scripts/desplega-servidor.sh --clau-nova → també genera una DRAFT_KEY nova
#         (només el primer cop: amb una clau nova, els esborranys d'«Et veig» ja desats no es poden llegir)
# Si existeix el fitxer de clau del compte de servei de Gmail (variable d'usuari LATEVAVEU_GMAIL_SA_FILE,
# amb el camí del .json), també s'envia a la funció com a GMAIL_SERVICE_ACCOUNT (en base64, sense mostrar-la).
set -euo pipefail
if [ -z "${NEON_API_KEY:-}" ]; then
  NEON_API_KEY="$(powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('NEON_API_KEY','User')" | tr -d '\r\n')"
  export NEON_API_KEY
fi
cd "$(dirname "$0")/.."
# Connexió directa del propietari de la base de dades: es llegeix de Neon a cada desplegament i no es mostra.
DB_URL="$(neon connection-string produccio --project-id sparkling-field-60524633 --database-name latevaveu --role-name latevaveu_owner)"
ARGS=(
  --env APP_DATABASE_URL="$DB_URL"
  --env GOOGLE_CLIENT_ID=194568959977-76uptoa0untgofou0eiqlbbjivet8tmn.apps.googleusercontent.com
  --env ACADEMIC_YEAR=2026-2027 --env SCHOOL_DOMAIN=ramonpont.cat --env DB_NAME=
  --env ALLOWED_ORIGIN=https://felipsarroca.github.io
)
SA_FILE="${LATEVAVEU_GMAIL_SA_FILE:-$(powershell -NoProfile -Command "[Console]::OutputEncoding=[Text.Encoding]::UTF8; [Environment]::GetEnvironmentVariable('LATEVAVEU_GMAIL_SA_FILE','User')" | tr -d '\r\n')}"
if [ -n "$SA_FILE" ]; then
  command -v cygpath >/dev/null && SA_FILE="$(cygpath -u "$SA_FILE")"
  [ -f "$SA_FILE" ] || { echo "No es troba el fitxer de clau de Gmail: $SA_FILE" >&2; exit 1; }
  ARGS+=(--env GMAIL_SERVICE_ACCOUNT="$(base64 -w0 "$SA_FILE")")
fi
if [ "${1:-}" = "--clau-nova" ]; then
  ARGS+=(--env DRAFT_KEY="$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64'))")")
fi
neon functions deploy latevaveu --project-id sparkling-field-60524633 --branch produccio --src server/neon.ts "${ARGS[@]}"
