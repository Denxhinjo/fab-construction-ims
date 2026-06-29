#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
#  Fab Construction IMS — VPS Setup Script
#  Run as root (or with sudo) on a fresh Ubuntu 22.04 / 24.04 server
#  Usage:  bash setup-vps.sh
# ═══════════════════════════════════════════════════════════════════════
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

echo ""
echo "╔═══════════════════════════════════════════════╗"
echo "║   Fab Construction IMS — VPS Setup Script     ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""

# ─── 1. System Update ──────────────────────────────────────────────────
log "Updating system packages..."
apt-get update -qq && apt-get upgrade -y -qq

# ─── 2. Install Docker ─────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
    log "Installing Docker..."
    apt-get install -y -qq ca-certificates curl gnupg lsb-release
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
        gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
        https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
        > /etc/apt/sources.list.d/docker.list
    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
    systemctl enable docker
    systemctl start docker
    log "Docker installed successfully"
else
    log "Docker already installed: $(docker --version)"
fi

# ─── 3. Install Docker Compose standalone ──────────────────────────────
if ! command -v docker-compose &>/dev/null; then
    log "Installing Docker Compose..."
    COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep '"tag_name"' | cut -d'"' -f4)
    curl -SL "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-x86_64" \
        -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    log "Docker Compose installed: $(docker-compose --version)"
else
    log "Docker Compose already installed: $(docker-compose --version)"
fi

# ─── 4. Configure firewall ─────────────────────────────────────────────
if command -v ufw &>/dev/null; then
    log "Configuring firewall..."
    ufw allow 22/tcp comment "SSH"    > /dev/null
    ufw allow 80/tcp comment "HTTP"   > /dev/null
    ufw allow 443/tcp comment "HTTPS" > /dev/null
    ufw --force enable > /dev/null
    log "Firewall configured (SSH + HTTP + HTTPS allowed)"
fi

# ─── 5. Clone or update repository ────────────────────────────────────
APP_DIR="/opt/fab-ims"

if [ -z "$GITHUB_REPO" ]; then
    warn "GITHUB_REPO not set."
    read -p "Enter your GitHub repo URL (e.g. https://github.com/youruser/IMS_Clean.git): " GITHUB_REPO
fi

if [ -d "$APP_DIR/.git" ]; then
    log "Repository already exists — pulling latest changes..."
    cd "$APP_DIR"
    git pull origin main
else
    log "Cloning repository to $APP_DIR ..."
    git clone "$GITHUB_REPO" "$APP_DIR"
    cd "$APP_DIR"
fi

# ─── 6. Generate .env if missing ───────────────────────────────────────
if [ ! -f "$APP_DIR/.env" ]; then
    log "Creating .env from template..."
    cp "$APP_DIR/.env.example" "$APP_DIR/.env"

    # Auto-generate a strong SECRET_KEY
    SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))")
    sed -i "s/CHANGE_THIS_TO_A_RANDOM_64_CHAR_HEX_STRING/$SECRET/" "$APP_DIR/.env"

    # Auto-generate a strong DB password
    DBPASS=$(python3 -c "import secrets, string; print(''.join(secrets.choice(string.ascii_letters+string.digits) for _ in range(24)))")
    sed -i "s/ChangeMe_StrongPassword_123!/$DBPASS/" "$APP_DIR/.env"

    # Set ALLOWED_ORIGINS to the server's public IP
    SERVER_IP=$(curl -s https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')
    sed -i "s|ALLOWED_ORIGINS=http://localhost:3000|ALLOWED_ORIGINS=http://$SERVER_IP|" "$APP_DIR/.env"

    warn ".env created with auto-generated secrets."
    warn "If you have a domain, edit /opt/fab-ims/.env and update ALLOWED_ORIGINS."
fi

# ─── 7. Build and start the application ───────────────────────────────
log "Building and starting all containers (this takes 3-5 minutes)..."
cd "$APP_DIR"
docker-compose --env-file .env up -d --build

# ─── 8. Wait for backend to be ready ──────────────────────────────────
log "Waiting for services to become ready..."
for i in $(seq 1 30); do
    if curl -sf http://localhost:8000/api/health > /dev/null 2>&1; then
        break
    fi
    sleep 3
done

# ─── 9. Done ──────────────────────────────────────────────────────────
SERVER_IP=$(curl -s https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                  🎉  Deployment Complete!                     ║"
echo "╠═══════════════════════════════════════════════════════════════╣"
echo "║                                                               ║"
echo "║  App URL:   http://$SERVER_IP                                 "
echo "║  API Docs:  http://$SERVER_IP:8000/api/docs                   "
echo "║                                                               ║"
echo "║  Admin:  admin@fabconstruction.com  /  Admin@123              ║"
echo "║  User:   john.smith@fabconstruction.com  /  User@123          ║"
echo "║                                                               ║"
echo "║  To view logs:   docker-compose logs -f                       ║"
echo "║  To stop:        docker-compose down                          ║"
echo "║  To update:      git pull && docker-compose up -d --build     ║"
echo "║                                                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
