@echo off
setlocal

if not exist venv (
    echo creating virtual environment
    python -m venv venv
)

call venv\Scripts\activate.bat

if not exist venv\.installed (
    echo first run, installing dependencies

    pip install -r requirements.txt
    if errorlevel 1 goto fail

    pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121
    if errorlevel 1 goto fail

    echo done > venv\.installed
)

echo starting xremove on http://127.0.0.1:8000
python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
goto end

:fail
echo install failed, not creating marker, will retry next run

:end
endlocal
