#!/usr/bin/env sh
# Run on the Oracle A1 VM from a checked-out, reviewed commit.
set -eu

compose_file=compose.production.yaml
env_file=.env.production

fail() {
  echo "production_deploy_failed: $*" >&2
  exit 1
}

case "$(uname -m)" in
  aarch64|arm64) ;;
  *) fail "expected an ARM64 Oracle VM, got $(uname -m)" ;;
esac

[ -f "$env_file" ] || fail "missing $env_file; copy .env.production.example and set real secrets"
[ -f secrets/cloudflare-origin.pem ] || fail "missing secrets/cloudflare-origin.pem"
[ -f secrets/cloudflare-origin.key ] || fail "missing secrets/cloudflare-origin.key"

if grep -Eq '(^|=)replace-with-' "$env_file"; then
  fail "$env_file still contains a placeholder secret"
fi

PRODUCTION_ENV_FILE="$env_file" docker compose --env-file "$env_file" -f "$compose_file" config -q
PRODUCTION_ENV_FILE="$env_file" docker compose --env-file "$env_file" -f "$compose_file" up --build -d --remove-orphans

for service in api worker; do
  attempts=0
  until PRODUCTION_ENV_FILE="$env_file" docker compose --env-file "$env_file" -f "$compose_file" ps --status running --services | grep -qx "$service"; do
    attempts=$((attempts + 1))
    [ "$attempts" -lt 30 ] || {
      PRODUCTION_ENV_FILE="$env_file" docker compose --env-file "$env_file" -f "$compose_file" logs --no-color
      fail "$service did not reach running state"
    }
    sleep 2
  done
done

PRODUCTION_ENV_FILE="$env_file" docker compose --env-file "$env_file" -f "$compose_file" exec -T api \
  node -e "fetch('http://127.0.0.1:3000/api/v1/health/ready').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"
PRODUCTION_ENV_FILE="$env_file" docker compose --env-file "$env_file" -f "$compose_file" exec -T worker \
  node -e "fetch('http://127.0.0.1:3001/worker/health/ready').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"
PRODUCTION_ENV_FILE="$env_file" docker compose --env-file "$env_file" -f "$compose_file" exec -T web \
  wget -q -O /dev/null --no-check-certificate https://127.0.0.1/api/v1/health/live

# This proves the container restart policy and worker readiness on the real ARM64 VM.
PRODUCTION_ENV_FILE="$env_file" docker compose --env-file "$env_file" -f "$compose_file" restart worker
sleep 5
PRODUCTION_ENV_FILE="$env_file" docker compose --env-file "$env_file" -f "$compose_file" exec -T worker \
  node -e "fetch('http://127.0.0.1:3001/worker/health/ready').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

echo "production_deploy_ok: commit=$(git rev-parse --short HEAD) arch=$(uname -m)"
