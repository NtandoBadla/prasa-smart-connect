# Test: send a Du Toit delay update and check auto-notify
$BASE = "http://localhost:3001"
$TOKEN = ""

# 1. Login
Write-Host "`n=== 1. Admin Login ===" -ForegroundColor Cyan
try {
    $loginRes = Invoke-RestMethod -Uri "$BASE/api/admin/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body '{"username":"admin","password":"prasa2025"}' `
        -TimeoutSec 15
    $TOKEN = $loginRes.token
    Write-Host "Login OK. Token: $($TOKEN.Substring(0,20))..." -ForegroundColor Green
} catch {
    Write-Host "Login FAILED: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 2. Health check
Write-Host "`n=== 2. Health Check ===" -ForegroundColor Cyan
try {
    $health = Invoke-RestMethod -Uri "$BASE/api/health" -TimeoutSec 10
    Write-Host ($health | ConvertTo-Json) -ForegroundColor Green
} catch {
    Write-Host "Health FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

# 3. Send Du Toit delay update
Write-Host "`n=== 3. Send Du Toit Delay Update ===" -ForegroundColor Cyan
$updateBody = @{
    trainNo  = "T4501"
    line     = "Northern Line"
    station  = "Du Toit"
    status   = "Delayed"
    delayMin = 15
    reason   = "Signal fault at Du Toit"
} | ConvertTo-Json

try {
    $update = Invoke-RestMethod -Uri "$BASE/api/admin/update" `
        -Method POST `
        -ContentType "application/json" `
        -Headers @{ "x-admin-token" = $TOKEN } `
        -Body $updateBody `
        -TimeoutSec 20
    Write-Host ($update | ConvertTo-Json) -ForegroundColor Green
} catch {
    Write-Host "Update FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

# 4. Verify update was saved
Write-Host "`n=== 4. Verify Saved Updates ===" -ForegroundColor Cyan
try {
    $saved = Invoke-RestMethod -Uri "$BASE/api/admin/update" `
        -Headers @{ "x-admin-token" = $TOKEN } `
        -TimeoutSec 10
    $latest = $saved | Select-Object -First 1
    Write-Host ($latest | ConvertTo-Json) -ForegroundColor Green
} catch {
    Write-Host "Fetch updates FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== Done ===" -ForegroundColor Cyan
