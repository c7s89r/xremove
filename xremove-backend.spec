from pathlib import Path
from PyInstaller.utils.hooks import collect_all, collect_submodules

datas, binaries, hiddenimports = [], [], []

for pkg in ("torch", "torchaudio", "demucs", "basic_pitch",
            "piano_transcription_inference", "librosa", "music21",
            "soundfile", "onnxruntime", "soxr", "pretty_midi"):
    try:
        d, b, h = collect_all(pkg)
        datas += d; binaries += b; hiddenimports += h
    except Exception as e:
        print(f"[spec] skip {pkg}: {e}")

hiddenimports += collect_submodules("uvicorn")
hiddenimports += [
    "backend.app",
    "uvicorn.lifespan.on",
    "uvicorn.loops.auto",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.websockets.auto",
    "anyio._backends._asyncio",
]

ckpt = Path.home() / "piano_transcription_inference_data" / "note_F1=0.9677_pedal_F1=0.9186.pth"
if ckpt.is_file():
    datas.append((str(ckpt), "piano_transcription_inference_data"))
else:
    print(f"[spec] WARNING: checkpoint not found at {ckpt}")

excludes = [
    "tensorflow", "tensorboard", "torchvision", "jax", "jaxlib",
    "transformers", "tokenizers", "safetensors", "huggingface_hub",
    "pytest", "IPython", "ipython", "notebook",
    "PyQt5", "PyQt6", "PySide2", "PySide6", "tkinter",
    "pandas", "pyarrow", "h5py", "openpyxl",
    "langchain", "langchain_core", "langchain_community", "langsmith",
    "yt_dlp", "playwright", "selenium", "nltk", "datasets", "bitsandbytes",
    "sentry_sdk", "googleapiclient", "skimage", "shapely", "av", "pydub",
    "moviepy", "imageio_ffmpeg",
]

a = Analysis(
    ["backend/run_server.py"],
    pathex=["."],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    runtime_hooks=[],
    excludes=excludes,
    noarchive=False,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz, a.scripts, [],
    exclude_binaries=True,
    name="xremove-backend",
    console=True,
    disable_windowed_traceback=False,
)
coll = COLLECT(
    exe, a.binaries, a.datas,
    strip=False, upx=False,
    name="xremove-backend",
)
