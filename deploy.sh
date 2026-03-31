#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy.sh  —  Build & deploy People Intelligence Platform to EC2
# Usage: ./deploy.sh [frontend|backend|all]   (default: all)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
PEM="C:/Users/marek/OneDrive/Desktop/HeadSoft/headsoft-aws.pem"
EC2_HOST="13.218.6.173"
EC2_USER="ec2-user"
REMOTE_FRONTEND="/opt/apps/pip/frontend/public"
REMOTE_BACKEND="/opt/apps/pip/backend"

TARGET="${1:-all}"   # frontend | backend | all

SSH="ssh -i \"$PEM\" -o StrictHostKeyChecking=no ${EC2_USER}@${EC2_HOST}"
SCP_OPTS="-i \"$PEM\" -o StrictHostKeyChecking=no"

# ── Helpers ───────────────────────────────────────────────────────────────────
step() { echo ""; echo "▶  $*"; }
ok()   { echo "   ✓ $*"; }

# ─────────────────────────────────────────────────────────────────────────────
# FRONTEND
# ─────────────────────────────────────────────────────────────────────────────
deploy_frontend() {
  step "Building frontend (production)…"
  (cd frontend && npx ng build --configuration production)
  ok "Build complete → frontend/dist/people-intelligence-frontend/browser"

  step "Uploading frontend to ${EC2_USER}@${EC2_HOST}:${REMOTE_FRONTEND}…"
  eval "scp $SCP_OPTS -r frontend/dist/people-intelligence-frontend/browser/. \"${EC2_USER}@${EC2_HOST}:${REMOTE_FRONTEND}/\""
  ok "Frontend uploaded"
}

# ─────────────────────────────────────────────────────────────────────────────
# BACKEND
# ─────────────────────────────────────────────────────────────────────────────
deploy_backend() {
  step "Building backend…"
  (cd backend && npm run build)
  ok "Backend compiled → backend/dist"

  step "Uploading backend dist to ${EC2_USER}@${EC2_HOST}:${REMOTE_BACKEND}/dist…"
  eval "ssh $SCP_OPTS ${EC2_USER}@${EC2_HOST} \"mkdir -p ${REMOTE_BACKEND}/dist\""
  eval "scp $SCP_OPTS -r backend/dist/. \"${EC2_USER}@${EC2_HOST}:${REMOTE_BACKEND}/dist/\""
  ok "dist/ uploaded"

  step "Uploading package.json & package-lock.json…"
  eval "scp $SCP_OPTS backend/package.json backend/package-lock.json \"${EC2_USER}@${EC2_HOST}:${REMOTE_BACKEND}/\""
  ok "package files uploaded"

  step "Installing production dependencies on server…"
  eval "ssh $SCP_OPTS ${EC2_USER}@${EC2_HOST} \"cd ${REMOTE_BACKEND} && npm install --omit=dev --prefer-offline 2>&1 | tail -5\""
  ok "npm install done"

  step "Restarting PM2 process…"
  eval "ssh $SCP_OPTS ${EC2_USER}@${EC2_HOST} \"pm2 restart pip-backend && pm2 save\""
  ok "PM2 restarted"
}

# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────
echo "═══════════════════════════════════════════════════════"
echo "  PIP Deploy  —  target: $TARGET"
echo "═══════════════════════════════════════════════════════"

case "$TARGET" in
  frontend) deploy_frontend ;;
  backend)  deploy_backend  ;;
  all)
    deploy_frontend
    deploy_backend
    ;;
  *)
    echo "Usage: ./deploy.sh [frontend|backend|all]"
    exit 1
    ;;
esac

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Deployment complete ✓"
echo "  https://pip.helenacoaching.com"
echo "═══════════════════════════════════════════════════════"
