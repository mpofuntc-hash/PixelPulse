# PixelPulse - Deploy to Oracle Cloud
# Usage: powershell -ExecutionPolicy Bypass -File deploy.ps1

$ORACLE_KEY = "$env:USERPROFILE\.ssh\oracle_key"
$ORACLE_IP = "92.4.154.125"
$ORACLE_USER = "ubuntu"

Write-Host "Deploying PixelPulse to Oracle Cloud..." -ForegroundColor Green

# Push to GitHub first
Write-Host "Pushing to GitHub..." -ForegroundColor Yellow
git push origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "Git push failed. Make sure you committed your changes first." -ForegroundColor Red
    exit 1
}

# SSH to Oracle and update
Write-Host "Updating Oracle Cloud server..." -ForegroundColor Yellow
$sshCmd = "cd ~/PixelPulse && git pull origin main && npm install --production && source ~/.nvm/nvm.sh 2>/dev/null && pm2 restart pixelpulse && sleep 3 && pm2 logs pixelpulse --lines 5 --nostream"
ssh -i $ORACLE_KEY -o StrictHostKeyChecking=no -o ConnectTimeout=10 "${ORACLE_USER}@${ORACLE_IP}" $sshCmd

Write-Host "Deployment complete!" -ForegroundColor Green
Write-Host "Site: https://pixelpulse.zentriva-clubsync.online" -ForegroundColor Cyan
