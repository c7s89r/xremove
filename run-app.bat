@echo off
setlocal
cd /d "%~dp0"

if not exist venv (
    echo creating virtual environment
    python -m venv venv
)
call venv\Scripts\activate.bat

if not exist venv\.installed (
    echo first run, installing python dependencies
    pip install -r requirements.txt
    if errorlevel 1 goto fail
    pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121
    if errorlevel 1 goto fail
    echo done > venv\.installed
)

if not exist node_modules (
    echo installing desktop app dependencies
    call npm install
    if errorlevel 1 goto fail
)

echo launching xremove desktop app
call npm start
goto end

:fail
echo install failed
:end
endlocal
