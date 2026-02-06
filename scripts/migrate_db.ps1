$ErrorActionPreference = "Stop"

# Database Migration Script (Neon -> Azure)

# Source (Neon)
$SourceHost = "ep-dry-forest-a14epyio-pooler.ap-southeast-1.aws.neon.tech"
$SourceUser = "neondb_owner"
$SourcePass = "npg_z8JNLGaE0pFr"
$SourceDB = "neondb"

# Destination (Azure)
$DestHost = "stride-posgre-prod-01.postgres.database.azure.com"
$DestUser = "Administrator1"
$DestPass = "pRZTbQ2T1JD7"
$DestDB = "insightEd"

# Tools
$PgDump = "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe"
$Psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"

# Files
$DumpFile = Join-Path $PWD "full_backup_neon.sql"

Write-Host "🚀 Starting Database Migration..." -ForegroundColor Cyan
Write-Host "📂 Backup File: $DumpFile"

# 1. Export from Neon
Write-Host "`n📦 Step 1: Exporting data from Neon ($SourceHost)..."
$env:PGPASSWORD = $SourcePass

# Using Invoke-Expression or & operator with redirection
$exportCmd = "& '$PgDump' -h '$SourceHost' -U '$SourceUser' -d '$SourceDB' -F p -f '$DumpFile' --clean --if-exists --no-owner --no-acl --verbose 2>&1"
Write-Host "Running: $exportCmd"

try {
    # Direct execution with error capture
    & "$PgDump" -h $SourceHost -U $SourceUser -d $SourceDB -F p -f "$DumpFile" --clean --if-exists --no-owner --no-acl --verbose 
    
    if ($LASTEXITCODE -ne 0) {
        throw "pg_dump failed with exit code $LASTEXITCODE"
    }

    if (-not (Test-Path $DumpFile)) {
        throw "Export file not found after running pg_dump!"
    }

    Write-Host "✅ Export Successful! Saved to $DumpFile" -ForegroundColor Green

} catch {
    Write-Host "❌ Export Failed: $_" -ForegroundColor Red
    exit 1
}

# 2. Import to Azure
Write-Host "`n📥 Step 2: Importing data to Azure ($DestHost)..."
$env:PGPASSWORD = $DestPass

try {
    # Using psql to import
    & "$Psql" -h $DestHost -U $DestUser -d $DestDB -f "$DumpFile" 

    if ($LASTEXITCODE -ne 0) {
        Write-Host "⚠️ psql finished with exit code $LASTEXITCODE. Check output for details." -ForegroundColor Yellow
    } else {
        Write-Host "✅ Import Successful! Data migrated to Azure." -ForegroundColor Green
    }

} catch {
    Write-Host "❌ Import Failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`n✨ Migration Complete!" -ForegroundColor Cyan
