# Setup Vercel Environment Variables for all projects
# This script adds Resend email configuration to all Vercel projects

$ErrorActionPreference = "Continue"

function Add-VercelEnv {
    param(
        [string]$ProjectDir,
        [string]$Name,
        [string]$Value,
        [string[]]$Targets,
        [switch]$Sensitive
    )
    
    foreach ($target in $Targets) {
        $args = @("vercel", "env", "add", $Name, $target, "--force")
        if ($Sensitive -and $target -ne "development") {
            $args += "--sensitive"
        }
        
        Write-Host "  Setting $Name for $target..." -NoNewline
        $result = echo $Value | npx @args 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host " OK" -ForegroundColor Green
        } else {
            Write-Host " FAILED" -ForegroundColor Red
            Write-Host "    $result" -ForegroundColor Yellow
        }
    }
}

$targets = @("production", "preview", "development")

# ============================================================
# CRM Project (crmeco)
# ============================================================
Write-Host "`n=== CRM Project (crmeco) ===" -ForegroundColor Cyan
Push-Location "apps\crm"

# Link to project
Write-Host "Linking to Vercel project..."
npx vercel link --yes --project crmeco --scope oi-agent 2>&1 | Out-Null

Add-VercelEnv -Name "RESEND_API_KEY" -Value "re_fbKN4ukn_435LLFJybE46UskmDtrJ5C8b" -Targets $targets -Sensitive
Add-VercelEnv -Name "RESEND_FROM_EMAIL" -Value "noreply@mail.payitforwardhealth.com" -Targets $targets
Add-VercelEnv -Name "RESEND_FROM_NAME" -Value "Pay It Forward Health" -Targets $targets
Add-VercelEnv -Name "FROM_EMAIL" -Value "noreply@mail.payitforwardhealth.com" -Targets $targets

Pop-Location

# ============================================================
# Admin Project (crm-eco-admin)
# ============================================================
Write-Host "`n=== Admin Project (crm-eco-admin) ===" -ForegroundColor Cyan
Push-Location "apps\admin"

Write-Host "Linking to Vercel project..."
npx vercel link --yes --project crm-eco-admin --scope oi-agent 2>&1 | Out-Null

Add-VercelEnv -Name "RESEND_API_KEY" -Value "re_fbKN4ukn_435LLFJybE46UskmDtrJ5C8b" -Targets $targets -Sensitive
Add-VercelEnv -Name "RESEND_FROM_EMAIL" -Value "noreply@mail.payitforwardhealth.com" -Targets $targets
Add-VercelEnv -Name "RESEND_FROM_NAME" -Value "Pay It Forward Health" -Targets $targets

Pop-Location

# ============================================================
# Portal Project (crm-eco-portal)
# ============================================================
Write-Host "`n=== Portal Project (crm-eco-portal) ===" -ForegroundColor Cyan
Push-Location "apps\portal"

Write-Host "Linking to Vercel project..."
npx vercel link --yes --project crm-eco-portal --scope oi-agent 2>&1 | Out-Null

Add-VercelEnv -Name "RESEND_API_KEY" -Value "re_fbKN4ukn_435LLFJybE46UskmDtrJ5C8b" -Targets $targets -Sensitive
Add-VercelEnv -Name "RESEND_FROM_EMAIL" -Value "noreply@mail.payitforwardhealth.com" -Targets $targets
Add-VercelEnv -Name "RESEND_FROM_NAME" -Value "Pay It Forward Health" -Targets $targets

Pop-Location

Write-Host "`n=== All Vercel env vars configured! ===" -ForegroundColor Green
