@echo off
REM Install a Windows scheduled task to run memory consolidation nightly at 3:00 AM.
REM Run this once from the repo root: scripts\memory\install-memory-task.bat

setlocal

REM Resolve the script path relative to this batch file
set "SCRIPT_DIR=%~dp0"
set "SCRIPT_PATH=%SCRIPT_DIR%consolidate-memory.mjs"

REM Verify the script exists
if not exist "%SCRIPT_PATH%" (
    echo ERROR: consolidate-memory.mjs not found at %SCRIPT_PATH%
    exit /b 1
)

echo Creating scheduled task "ClaudeCodeMemoryConsolidation"...
echo Script: %SCRIPT_PATH%

schtasks /create /tn "ClaudeCodeMemoryConsolidation" /tr "node \"%SCRIPT_PATH%\"" /sc daily /st 03:00 /f

if %errorlevel% equ 0 (
    echo.
    echo Scheduled task created successfully.
    echo Memory consolidation will run daily at 3:00 AM.
    echo.
    echo To run manually: node "%SCRIPT_PATH%"
    echo To remove task:  schtasks /delete /tn "ClaudeCodeMemoryConsolidation" /f
) else (
    echo.
    echo ERROR: Failed to create scheduled task.
    echo Try running this script as Administrator.
)

endlocal
