#!/usr/bin/env bash
# ==============================================================================
# AIIA Sovereign MediKiosk & Hospital OS - Automated GitHub Push & Deploy Script
# Repository: sih-doctor (or sih-doctor-doctor)
# Triggers Coolify / Vercel / GitHub Actions Auto-Deploy Pipeline on Push
# ==============================================================================

set -e

REPO_NAME="${1:-sih-doctor}"
COMMIT_MSG="${2:-feat: sovereign hospital os production release with live 22-battery validation}"

echo "================================================================================"
echo "AIIA SOVEREIGN MEDIKIOSK - GITHUB PUSH & DEPLOYMENT"
echo "================================================================================"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# 1. Initialize Git Repository if not initialized
if [ ! -d ".git" ]; then
  echo "[INFO] Initializing local Git repository..."
  git init
  git branch -M main
fi

# 2. Check Git User Configuration
if [ -z "$(git config user.name)" ]; then
  git config user.name "AIIA Hospital OS Deployer"
  git config user.email "admin@hospital.gov.in"
  echo "[INFO] Configured Git user: $(git config user.name) <$(git config user.email)>"
fi

# 3. Stage All Production Source Files (.gitignore protects >100MB CAD models & binaries)
echo "[INFO] Staging production code, models, and test suites..."
git add .

# 4. Check if there are changes to commit
if git diff --cached --quiet; then
  echo "[INFO] Working tree is already clean. Nothing new to commit."
else
  echo "[INFO] Committing changes with message: '$COMMIT_MSG'"
  git commit -m "$COMMIT_MSG"
fi

# 5. Check / Create Remote Repository on GitHub using 'gh' CLI
echo "[INFO] Checking GitHub remote configuration..."
if ! git remote get-url origin >/dev/null 2>&1; then
  echo "[INFO] Checking if repository 'piyso/$REPO_NAME' exists on GitHub..."
  if gh repo view "piyso/$REPO_NAME" >/dev/null 2>&1; then
    echo "[INFO] Linking existing repository: git@github.com:piyso/$REPO_NAME.git"
    git remote add origin "https://github.com/piyso/$REPO_NAME.git"
  else
    echo "[INFO] Creating new public repository 'piyso/$REPO_NAME' on GitHub..."
    gh repo create "$REPO_NAME" --public --source=. --remote=origin --description "Sovereign Hospital OS: Air-gapped clinical triage, pre-consultation intake, and dual-pharmacology safety engine for public health institutions."
  fi
fi

# 6. Push to Main Branch
echo "[INFO] Pushing latest code to GitHub (origin/main)..."
git push -u origin main

echo ""
echo "================================================================================"
echo "[SUCCESS] GITHUB PUSH COMPLETE"
echo "Repository: https://github.com/piyso/$REPO_NAME"
echo "CI/CD Status: https://github.com/piyso/$REPO_NAME/actions"
echo "Coolify Webhook: If configured, Coolify will now automatically pull and deploy."
echo "================================================================================"
