#!/bin/zsh
set -euo pipefail

project_dir="${0:A:h:h}"
cd "$project_dir"

print "Secure Binance Web3 credential setup"
print "Inputs are hidden and are written only to the Git-ignored .env file."
print ""

read -rs "binance_api_key?Paste the NEW Binance Web3 API Key, then press Enter: "
print ""
read -rs "binance_secret_key?Paste the matching NEW Secret Key, then press Enter: "
print ""

if [[ -z "$binance_api_key" || -z "$binance_secret_key" ]]; then
  unset binance_api_key binance_secret_key
  print -u2 "Nothing saved: both values are required."
  exit 2
fi

if [[ "$binance_api_key" == *$'\n'* || "$binance_secret_key" == *$'\n'* ]]; then
  unset binance_api_key binance_secret_key
  print -u2 "Nothing saved: credentials must each be a single line."
  exit 2
fi

tmp_env="$(mktemp .env.secure.XXXXXX)"
trap 'unset binance_api_key binance_secret_key; [[ -n "${tmp_env:-}" && -f "$tmp_env" ]] && rm -f -- "$tmp_env"' EXIT
chmod 600 "$tmp_env"

if [[ -f .env ]]; then
  grep -vE '^(BINANCE_WEB3_API_KEY|BINANCE_WEB3_SECRET_KEY|BINANCE_WEB3_BASE_URL)=' .env > "$tmp_env" || true
fi

{
  print -r -- "BINANCE_WEB3_API_KEY=$binance_api_key"
  print -r -- "BINANCE_WEB3_SECRET_KEY=$binance_secret_key"
  print -r -- "BINANCE_WEB3_BASE_URL=https://web3.binance.com/build"
} >> "$tmp_env"

mv -f -- "$tmp_env" .env
tmp_env=""
chmod 600 .env
unset binance_api_key binance_secret_key

if ! git check-ignore -q .env; then
  print -u2 "Saved, but safety check failed: .env is not ignored by Git."
  exit 3
fi

configured_count="$(awk -F= '/^(BINANCE_WEB3_API_KEY|BINANCE_WEB3_SECRET_KEY)=/ && length($2)>0 {count++} END {print count+0}' .env)"
if [[ "$configured_count" != "2" ]]; then
  print -u2 "Save validation failed. No credential values were printed."
  exit 4
fi

print "Saved successfully:"
print "  BINANCE_WEB3_API_KEY=configured"
print "  BINANCE_WEB3_SECRET_KEY=configured"
print "  Permissions=$(stat -f '%Lp' .env)"
print "  Git ignored=yes"
print ""
print "Next command: npm run data:gate"
