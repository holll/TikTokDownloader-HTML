@echo off
setlocal enabledelayedexpansion

REM ======================================================
REM         Multi-Platform Build Script
REM   Versioning (Git Tag + Commit + Build Time)
REM ======================================================

echo ----------------------------------------------------
echo Building multi-platform binaries...
echo ----------------------------------------------------

REM Get version from git tag
for /f "delims=" %%a in ('git describe --tags --abbrev^=0 2^>nul') do set VERSION=%%a
if "%VERSION%"=="" set VERSION=0.0.0

REM Get short commit hash
for /f "delims=" %%a in ('git rev-parse --short HEAD') do set COMMIT=%%a

REM Get build timestamp
for /f "delims=" %%a in ('powershell -command "Get-Date -Format yyyy-MM-dd_HH-mm-ss"') do set BUILDTIME=%%a

echo Version: %VERSION%
echo Commit:  %COMMIT%
echo Time:    %BUILDTIME%
echo.

REM Output directory
set OUTDIR=dist
if not exist %OUTDIR% mkdir %OUTDIR%

REM Extract project name from go.mod (last segment of module path)
for /f "tokens=2" %%i in ('findstr /r "^module" go.mod') do set APPNAME=%%~nxi
if "%APPNAME%"=="" set APPNAME=m3u8-downloader
echo Project: %APPNAME%

REM Write version info
echo Version=%VERSION%> %OUTDIR%\version.txt
echo Commit=%COMMIT%>> %OUTDIR%\version.txt
echo BuildTime=%BUILDTIME%>> %OUTDIR%\version.txt

REM =======================
REM   Target platforms
REM =======================
set TARGETS=^
windows/amd64 ^
linux/amd64

REM ==========================
REM   Build loop
REM ==========================
for %%T in (%TARGETS%) do (
    for /f "tokens=1,2 delims=/" %%a in ("%%T") do (
        set GOOS=%%a
        set GOARCH=%%b
        set GOARM=
        set CGO_ENABLED=0

        REM ARM variant
        if "!GOARCH!"=="armv7" (
            set GOARCH=arm
            set GOARM=7
        )

        set EXT=
        if "!GOOS!"=="windows" set EXT=.exe

        set OUTFILE=%OUTDIR%\%APPNAME%_!GOOS!_!GOARCH!!EXT!

        echo ---------------------------------------------------
        echo Building !OUTFILE!
        echo ---------------------------------------------------

        go build ^
            -o "!OUTFILE!" ^
            -ldflags "-s -w -X main.Version=%VERSION% -X main.Commit=%COMMIT% -X main.BuildTime=%BUILDTIME%" ^
            .

        if errorlevel 1 (
            echo.
            echo Build failed: !GOOS!/!GOARCH!
            pause
            exit /b 1
        )

        REM UPX compression (if available)
        where upx >nul 2>nul
        if !errorlevel!==0 (
            echo Compressing with UPX...
            upx --best --lzma "!OUTFILE!"
        ) else (
            echo UPX not found, skipping compression
        )
    )
)

echo.
echo ===========================================
echo All builds completed successfully!
echo Binaries in: %OUTDIR%
echo ===========================================
echo.

pause
