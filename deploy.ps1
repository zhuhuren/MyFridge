# MyFridge Deployment Script
# Run this script from the MyFridge project root directory

param(
    [string]$GitHubUsername = "",
    [string]$WorkerURL = ""
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  MyFridge Deployment Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check prerequisites
Write-Host "[1/7] Checking prerequisites..." -ForegroundColor Yellow

$nodeVersion = node --version 2>$null
if (-not $nodeVersion) {
    Write-Host "ERROR: Node.js is not installed. Please install it from https://nodejs.org/" -ForegroundColor Red
    exit 1
}
Write-Host "  Node.js: $nodeVersion" -ForegroundColor Green

$npmVersion = npm --version 2>$null
Write-Host "  npm: v$npmVersion" -ForegroundColor Green

# Install wrangler globally
Write-Host ""
Write-Host "[2/7] Installing Wrangler CLI..." -ForegroundColor Yellow
npm.cmd install -g wrangler
Write-Host "  Wrangler installed" -ForegroundColor Green

# Login to Cloudflare
Write-Host ""
Write-Host "[3/7] Logging in to Cloudflare..." -ForegroundColor Yellow
Write-Host "  A browser window will open. Please log in to your Cloudflare account." -ForegroundColor White
# npx.cmd wrangler login

# Create D1 database
Write-Host ""
Write-Host "[4/7] Creating D1 database..." -ForegroundColor Yellow
$dbOutput = npx.cmd wrangler d1 create myfridge-db 2>&1
Write-Host $dbOutput

# Extract database_id from output
$dbIdMatch = $dbOutput | Select-String -Pattern 'database_id\s*=\s*"([^"]+)"'
if ($dbIdMatch) {
    $dbId = $dbIdMatch.Matches[0].Groups[1].Value
    Write-Host "  Database ID: $dbId" -ForegroundColor Green

    # Update wrangler.toml with the actual database ID
    $wranglerPath = Join-Path $PSScriptRoot "worker\wrangler.toml"
    $content = Get-Content $wranglerPath -Raw
    $content = $content -replace 'placeholder-will-be-replaced', $dbId
    Set-Content $wranglerPath $content
    Write-Host "  Updated wrangler.toml with database ID" -ForegroundColor Green
} else {
    Write-Host "  WARNING: Could not extract database_id. You may need to update worker/wrangler.toml manually." -ForegroundColor Yellow
    Write-Host "  Run: wrangler d1 list" -ForegroundColor Yellow
}

# Initialize database schema
Write-Host ""
Write-Host "[5/7] Initializing database schema..." -ForegroundColor Yellow
npx.cmd wrangler d1 execute myfridge-db --remote --file=worker/src/schema.sql
Write-Host "  Database schema initialized" -ForegroundColor Green

# Deploy Worker
Write-Host ""
Write-Host "[6/7] Deploying Cloudflare Worker..." -ForegroundColor Yellow
Push-Location (Join-Path $PSScriptRoot "worker")
npm.cmd install
$deployOutput = npx.cmd wrangler deploy 2>&1
Write-Host $deployOutput
Pop-Location

# Extract worker URL
$urlMatch = $deployOutput | Select-String -Pattern '(https://[^\s]+\.workers\.dev)'
if ($urlMatch) {
    $workerUrl = $urlMatch.Matches[0].Groups[1].Value
    Write-Host "  Worker deployed at: $workerUrl" -ForegroundColor Green

    # Update API_BASE_URL in app.js
    $appJsPath = Join-Path $PSScriptRoot "app.js"
    $appContent = Get-Content $appJsPath -Raw
    $appContent = $appContent -replace "const API_BASE_URL = '';", "const API_BASE_URL = '$workerUrl';"
    Set-Content $appJsPath $appContent
    Write-Host "  Updated app.js with API URL" -ForegroundColor Green
} else {
    Write-Host "  WARNING: Could not extract Worker URL. Update API_BASE_URL in app.js manually." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[7/7] Backend deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Next Steps: Deploy Frontend" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Create a GitHub repository called 'MyFridge'" -ForegroundColor White
Write-Host "2. Run these commands:" -ForegroundColor White
Write-Host ""
Write-Host "   git init" -ForegroundColor Gray
Write-Host "   git add ." -ForegroundColor Gray
Write-Host "   git commit -m 'Initial commit'" -ForegroundColor Gray
Write-Host "   git branch -M main" -ForegroundColor Gray
Write-Host "   git remote add origin https://github.com/<your-username>/MyFridge.git" -ForegroundColor Gray
Write-Host "   git push -u origin main" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Go to Settings > Pages in your repo" -ForegroundColor White
Write-Host "4. Set Source: 'Deploy from a branch' (main, / root)" -ForegroundColor White
Write-Host "5. Open https://<your-username>.github.io/MyFridge/ on your iPhone" -ForegroundColor White
Write-Host "6. Tap Share > 'Add to Home Screen'" -ForegroundColor White
Write-Host ""
Write-Host "Done! Enjoy MyFridge! 🧊" -ForegroundColor Cyan
