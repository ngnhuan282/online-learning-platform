# Run from any directory after the four business services have migrated their schemas.
# Uses the container's existing root password without printing it or passing it in argv.
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
Push-Location $projectRoot
try {
    Write-Host '[1/3] Checking MySQL schemas (18 business tables + 4 Flyway history tables).'
    Write-Host 'Waiting up to 120 seconds for Auth, Course, Learning and Payment migrations...'
    # Compose starts containers before their migrations finish. Wait for the full schema.
    $readinessSql = @'
SELECT COUNT(*) FROM information_schema.tables WHERE
 (table_schema = 'auth_db' AND table_name IN ('roles','users','user_roles','refresh_tokens','flyway_schema_history')) OR
 (table_schema = 'course_db' AND table_name IN ('categories','courses','flyway_schema_history')) OR
 (table_schema = 'learning_db' AND table_name IN ('enrollments','lesson_progress','quizzes','quiz_questions','quiz_options','quiz_attempts','quiz_answers','notifications','flyway_schema_history')) OR
 (table_schema = 'payment_db' AND table_name IN ('orders','order_items','payments','payment_transactions','flyway_schema_history'));
'@
    $ready = $false
    $deadline = (Get-Date).AddSeconds(120)
    $lastCount = $null
    $lastNotice = (Get-Date).AddSeconds(-10)
    do {
        $tableCount = $readinessSql | docker compose exec -T mysql sh -c 'export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"; exec mysql -uroot --batch --skip-column-names'
        if ($LASTEXITCODE -ne 0) { throw 'Cannot query MySQL. Start it with docker compose up -d mysql.' }
        $count = "$tableCount".Trim()
        if ($count -ne $lastCount -or ((Get-Date) - $lastNotice).TotalSeconds -ge 10) {
            $remaining = [Math]::Max(0, [Math]::Ceiling(($deadline - (Get-Date)).TotalSeconds))
            Write-Host "Schema readiness: $count/22 tables; remaining wait: $remaining seconds."
            $lastCount = $count
            $lastNotice = Get-Date
        }
        if ($count -eq '22') { $ready = $true; break }
        Start-Sleep -Seconds 2
    } while ((Get-Date) -lt $deadline)
    if (-not $ready) {
        Write-Host 'Inspect stopped services: docker compose --profile backend ps --all'
        Write-Host 'Inspect migration errors: docker compose logs --tail=60 course-service learning-service payment-service auth-service'
        throw 'Service migrations are not ready. Check Auth/Course/Learning/Payment logs and infra/mysql/README.md.'
    }

    # Copy explicitly so existing containers also receive the current file, without recreation.
    Write-Host '[2/3] Copying the seed SQL into MySQL...'
    docker compose cp infra/mysql/05-seed-data.sql mysql:/tmp/sgsphere-demo-seed.sql
    if ($LASTEXITCODE -ne 0) { throw 'Cannot copy seed: start the MySQL container first.' }

    Write-Host '[3/3] Importing demo data. The result below lists sample rows per table.'
    docker compose exec -T mysql sh -c 'export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"; exec mysql --default-character-set=utf8mb4 --batch -uroot < /tmp/sgsphere-demo-seed.sql'
    if ($LASTEXITCODE -ne 0) {
        throw 'Seed failed. Sample inserts were rolled back; inspect the SQL error above. See infra/mysql/README.md.'
    }
    Write-Host 'Seed completed successfully.'
} finally {
    Pop-Location
}
