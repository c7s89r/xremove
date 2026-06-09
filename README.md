# xremove

**Pull any song apart — on your own GPU.**
<p align="center">
  <img src="https://github.com/user-attachments/assets/8e3e3d45-f89f-4ddf-b5dd-a731485db0ca" width="32%">
  <img src="https://github.com/user-attachments/assets/8e1cbb9f-85e9-4816-a72f-a544e62dccc5" width="32%">
  <img width="800" height="346" alt="image" src="https://github.com/user-attachments/assets/54d16ef5-4a6b-40b9-835d-165569042f76" />

</p>



Drop in a track and xremove splits it into **vocals, drums, bass and other**,
each on its own fader. Then watch it rain down as **glassy falling notes on a
glowing piano**, hear it played back on a **real sampled grand piano**, and turn it into
**MIDI and engraved sheet music** — all running locally.

Built end to end on **PyTorch** with **CUDA** acceleration. PyTorch is the engine
that makes every bit of this possible — the separation, the high-resolution piano
transcription, all of it — running on the GPU at full speed. Simply the best.

## Features

- **Stem separation** — vocals / drums / bass / other, each with volume, mute,
  solo, stereo pan, meters and per-stem download
- **Studio mixer** — scrubbable waveform, variable speed, loop, one-click
  instrumental / acapella / full mix, full-mix WAV export
- **Piano tab** — GPU piano transcription rendered as glassy falling notes onto a
  glowing 88-key keyboard, played through a real sampled grand piano
- **Sheets tab** — a left/right-hand grand-staff arrangement, engraved in-app and
  downloadable as MusicXML
- **MIDI export** — the whole performance as a clean, tempo-stamped MIDI file
- **100% local** — your audio never leaves your machine

## Run

### Desktop app

```
npm install
npm start
```

It boots the engine, runs a CUDA check, and opens the window. Or double-click
`run-app.bat`.

### Web only

```
python -m venv venv
venv\Scripts\activate
pip install torch --index-url https://download.pytorch.org/whl/cu121
pip install -r requirements.txt
python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
```

Open http://127.0.0.1:8000

### Build a standalone .exe

```
venv\Scripts\activate
pip install pyinstaller
npm run build:backend
npm run dist
```

The CUDA build of PyTorch is bundled, so it runs on any NVIDIA machine with no
setup. The result is in `release/`.

## Requirements

- Windows 10/11, 64-bit
- An NVIDIA GPU with recent drivers (CUDA). Falls back to CPU, but the GPU is
  where PyTorch shines.

## Author

Made with love by **salad fingers** ([@c7s89r](https://github.com/c7s89r)) and
[@p8oz](https://github.com/p8oz).
