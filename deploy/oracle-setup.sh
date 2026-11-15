#!/usr/bin/env bash
# AstraSight: one-shot setup for any Ubuntu 22.04/24.04 server, x86 or ARM, with 12 GB+ RAM
# (Google Cloud Compute Engine, Azure, Oracle Always Free, ...).
# Installs Node, Ollama (Qwen 2.5 3B + MedGemma 1.5 4B), runs server.js as a service, pulls new
# commits from main every minute, and connects a Cloudflare Tunnel so no ports need opening.
# Safe to run again: each step skips what's already done.
#
#   TUNNEL_TOKEN=<token from Cloudflare> bash oracle-setup.sh
#
# Guide: docs/DEPLOY-ORACLE.md
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/DoctorBeryl/NasaSpaceApps26.git}"
APP_DIR="${APP_DIR:-/opt/astrasight}"
APP_USER="${APP_USER:-$(id -un)}"
MODELS="${MODELS:-qwen2.5:3b medgemma1.5:4b}"
TUNNEL_TOKEN="${TUNNEL_TOKEN:-${1:-}}"

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

say "System packages"
sudo apt-get update -y
sudo apt-get install -y git curl ca-certificates zstd

say "Swap file (4 GB safety margin for loading both models)"
if ! swapon --show | grep -q /swapfile; then
  sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile
  sudo mkswap /swapfile && sudo swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

say "Node.js 22"
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 18 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
node --version

say "Ollama"
# Reinstall if the binary or its systemd unit is missing (an install interrupted by a full disk
# leaves the binary but no ollama.service).
if ! command -v ollama >/dev/null || ! systemctl cat ollama.service >/dev/null 2>&1; then
  curl -fsSL https://ollama.com/install.sh | sh
fi
# Keep both models loaded: no cold start for judges, and steady memory use keeps
# Oracle's idle-instance reclaim from flagging the server.
sudo mkdir -p /etc/systemd/system/ollama.service.d
sudo tee /etc/systemd/system/ollama.service.d/astrasight.conf >/dev/null <<'EOF'
[Service]
Environment=OLLAMA_HOST=127.0.0.1:11434
Environment=OLLAMA_KEEP_ALIVE=-1
Environment=OLLAMA_MAX_LOADED_MODELS=3
Environment=OLLAMA_NUM_PARALLEL=1
# Same context size as server/ollama.js (OLLAMA_NUM_CTX, default 8192). If the warm-up loads a
# model with a different size, the first real request reloads it (about a minute on CPU).
Environment=OLLAMA_CONTEXT_LENGTH=8192
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now ollama
sudo systemctl restart ollama
for i in $(seq 1 30); do curl -fs http://127.0.0.1:11434/api/tags >/dev/null && break; sleep 1; done

say "App code in $APP_DIR"
if [ ! -d "$APP_DIR/.git" ]; then
  sudo mkdir -p "$APP_DIR" && sudo chown "$APP_USER:$APP_USER" "$APP_DIR"
  git clone "$REPO_URL" "$APP_DIR"
else
  git -C "$APP_DIR" pull --ff-only
fi
[ -f "$APP_DIR/.env" ] || cp "$APP_DIR/.env.example" "$APP_DIR/.env"
mkdir -p "$APP_DIR/server/data"

# Models: every OLLAMA_*MODEL=... in .env.example and .env (so a model the team adds to
# .env.example is pulled here and by the auto-update), plus $MODELS.
sudo tee /usr/local/bin/astrasight-models >/dev/null <<'EOF'
#!/usr/bin/env bash
# Prints the Ollama models AstraSight needs, one per line.
cd "${APP_DIR:-/opt/astrasight}"
{ grep -hE '^[[:space:]]*OLLAMA_[A-Z_]*MODEL[[:space:]]*=' .env.example .env 2>/dev/null \
    | sed -E 's/^[^=]*=[[:space:]]*//; s/[[:space:]]*(#.*)?$//; s/^["'"'"']//; s/["'"'"']$//'
  for m in ${MODELS:-}; do echo "$m"; done; } | grep -v '^$' | sort -u
EOF
sudo chmod +x /usr/local/bin/astrasight-models
for m in $(APP_DIR="$APP_DIR" MODELS="$MODELS" astrasight-models); do say "Pulling $m (a few minutes)"; ollama pull "$m"; done

say "astrasight service (node server.js on port 8000; only the tunnel reaches it)"
sudo tee /etc/systemd/system/astrasight.service >/dev/null <<EOF
[Unit]
Description=AstraSight (node server.js)
After=network-online.target ollama.service
Wants=network-online.target ollama.service

[Service]
User=$APP_USER
WorkingDirectory=$APP_DIR
ExecStart=$(command -v node) server.js
Restart=always
RestartSec=3
Environment=NODE_ENV=production
# server/ollama.js sends keep_alive with every request; -1 keeps both models loaded for good.
Environment=OLLAMA_KEEP_ALIVE=-1
Environment=OLLAMA_TIMEOUT_MS=300000

[Install]
WantedBy=multi-user.target
EOF

say "Auto-update from GitHub every minute"
sudo tee /usr/local/bin/astrasight-update >/dev/null <<EOF
#!/usr/bin/env bash
set -e
# Run as the app user even when started with sudo, so .git never ends up owned by root.
[ "$(id -u)" = 0 ] && exec sudo -u "$APP_USER" "$0"
cd "$APP_DIR"
git fetch -q origin main
if [ "\$(git rev-parse HEAD)" != "\$(git rev-parse origin/main)" ]; then
  git pull -q --ff-only origin main
  # Pull any model the team added to .env.example (already-present models return quickly).
  for m in \$(APP_DIR="$APP_DIR" MODELS="$MODELS" /usr/local/bin/astrasight-models); do ollama pull "\$m" >/dev/null && echo "model \$m ok"; done
  sudo systemctl restart astrasight
  echo "updated to \$(git rev-parse --short HEAD)"
fi
EOF
sudo chmod +x /usr/local/bin/astrasight-update
echo "$APP_USER ALL=(root) NOPASSWD: /usr/bin/systemctl restart astrasight" | sudo tee /etc/sudoers.d/astrasight >/dev/null
sudo chmod 440 /etc/sudoers.d/astrasight
sudo tee /etc/systemd/system/astrasight-update.service >/dev/null <<EOF
[Unit]
Description=Pull AstraSight from GitHub and restart if it changed
[Service]
Type=oneshot
User=$APP_USER
ExecStart=/usr/local/bin/astrasight-update
EOF
sudo tee /etc/systemd/system/astrasight-update.timer >/dev/null <<'EOF'
[Unit]
Description=Check GitHub for AstraSight updates every minute
[Timer]
OnBootSec=2min
OnUnitActiveSec=1min
[Install]
WantedBy=timers.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now astrasight astrasight-update.timer
sudo systemctl restart astrasight

say "Warming up the models (each can take a minute or two on CPU: let it finish)"
for m in $(APP_DIR="$APP_DIR" MODELS="$MODELS" astrasight-models); do
  curl -fs http://127.0.0.1:11434/api/generate -d "{\"model\":\"$m\",\"prompt\":\"hi\",\"stream\":false,\"keep_alive\":-1,\"options\":{\"num_ctx\":8192}}" >/dev/null \
    && echo "$m ready" || echo "$m warm-up failed (check: ollama list)"
done

say "Cloudflare Tunnel"
if [ -n "$TUNNEL_TOKEN" ]; then
  if ! command -v cloudflared >/dev/null; then
    curl -fsSL -o /tmp/cloudflared.deb "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-$(dpkg --print-architecture).deb"
    sudo dpkg -i /tmp/cloudflared.deb
  fi
  sudo cloudflared service uninstall >/dev/null 2>&1 || true
  sudo cloudflared service install "$TUNNEL_TOKEN"
else
  echo "No TUNNEL_TOKEN given: skipped. Rerun with TUNNEL_TOKEN=<token> bash oracle-setup.sh"
fi

say "Status"
sleep 2
curl -fs http://127.0.0.1:8000/api/ai/status && echo || echo "server not answering yet: journalctl -u astrasight -n 50"
echo
echo "Logs:     journalctl -u astrasight -f      (ollama: journalctl -u ollama -f)"
echo "Restart:  sudo systemctl restart astrasight"
echo "Settings: nano $APP_DIR/.env   then restart"
