import re
import io
import sys
import json
import time
import uuid
import shutil
import zipfile
import subprocess
import threading
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import os

if os.environ.get("XREMOVE_HOME"):
    BASE = Path(os.environ["XREMOVE_HOME"]).resolve()
else:
    BASE = Path(__file__).resolve().parent.parent
UPLOADS = BASE / "uploads"
OUTPUT = BASE / "separated"
STATIC = BASE / "static"
PROJECTS_FILE = BASE / "projects.json"
STEMS = ["vocals", "drums", "bass", "other"]

QUALITY = {
    "clean": {"model": "htdemucs_ft", "shifts": 0, "overlap": 0.25},
    "fast": {"model": "htdemucs", "shifts": 0, "overlap": 0.25},
}

MODEL_BAGS = {"htdemucs": 1, "htdemucs_ft": 4}

UPLOADS.mkdir(exist_ok=True)
OUTPUT.mkdir(exist_ok=True)

jobs = {}
jobs_lock = threading.Lock()
projects = {}
projects_lock = threading.Lock()

def load_projects():
    global projects
    if PROJECTS_FILE.exists():
        try:
            projects = json.loads(PROJECTS_FILE.read_text("utf-8"))
        except Exception:
            projects = {}

def save_projects():
    tmp = PROJECTS_FILE.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(projects, indent=2), "utf-8")
    tmp.replace(PROJECTS_FILE)

def gpu_info():
    info = {
        "device": "cpu",
        "cuda": False,
        "name": "no CUDA device",
        "torch": None,
        "cuda_version": None,
        "vram_gb": None,
    }
    try:
        import torch
        info["torch"] = torch.__version__
        info["cuda_version"] = getattr(torch.version, "cuda", None)
        if torch.cuda.is_available():
            props = torch.cuda.get_device_properties(0)
            info.update(
                device="cuda",
                cuda=True,
                name=torch.cuda.get_device_name(0),
                vram_gb=round(props.total_memory / (1024 ** 3), 1),
            )
    except Exception as exc:
        info["name"] = "torch error: " + str(exc)
    return info

GPU = gpu_info()
DEVICE = GPU["device"]
GPU_NAME = GPU["name"]
print("xremove device:", DEVICE, "(" + GPU_NAME + ")", flush=True)
load_projects()
app = FastAPI()

def set_job(job_id, **fields):
    with jobs_lock:
        jobs.setdefault(job_id, {})
        jobs[job_id].update(fields)

def get_job(job_id):
    with jobs_lock:
        job = jobs.get(job_id)
        return dict(job) if job else None

def stem_stats(stem_dir):
    dur = 0.0
    size = 0
    try:
        import soundfile as sf
    except Exception:
        sf = None
    for s in STEMS:
        p = stem_dir / f"{s}.wav"
        if not p.exists():
            continue
        size += p.stat().st_size
        if sf is not None:
            try:
                info = sf.info(str(p))
                dur = max(dur, info.frames / info.samplerate)
            except Exception:
                pass
    return dur, size

def add_project(job_id, name, model, quality, stem_dir):
    stem_dir = Path(stem_dir)
    dur, size = stem_stats(stem_dir)
    entry = {
        "id": job_id,
        "name": name,
        "model": model,
        "quality": quality,
        "device": DEVICE,
        "created": time.time(),
        "duration": dur,
        "size": size,
        "stems": STEMS,
        "stem_dir": str(stem_dir),
        "favorite": False,
    }
    with projects_lock:
        projects[job_id] = entry
        save_projects()
    return entry

def migrate_existing():
    changed = False
    for job_dir in OUTPUT.iterdir():
        if not job_dir.is_dir() or job_dir.name in projects:
            continue
        found = None
        for model_dir in job_dir.iterdir():
            if not model_dir.is_dir():
                continue
            for sub in model_dir.iterdir():
                if sub.is_dir() and (sub / "vocals.wav").exists():
                    found = (model_dir.name, sub)
                    break
            if found:
                break
        if not found:
            continue
        model, sub = found
        name = sub.name
        if re.fullmatch(r"[0-9a-f]{32}", name):
            name = "Project " + name[:6]
        dur, size = stem_stats(sub)
        projects[job_dir.name] = {
            "id": job_dir.name,
            "name": name,
            "model": model,
            "quality": "clean" if model == "htdemucs_ft" else "fast",
            "device": DEVICE,
            "created": sub.stat().st_mtime,
            "duration": dur,
            "size": size,
            "stems": STEMS,
            "stem_dir": str(sub),
            "favorite": False,
        }
        changed = True
    if changed:
        save_projects()

migrate_existing()

import importlib.util

MIDI_OK = importlib.util.find_spec("basic_pitch") is not None
SHEET_OK = MIDI_OK and importlib.util.find_spec("music21") is not None

NOTES_VERSION = 3

STEM_MIDI = {
    "vocals": {"program": 52, "is_drum": False, "name": "Vocals"},
    "drums":  {"program": 0,  "is_drum": True,  "name": "Drums"},
    "bass":   {"program": 33, "is_drum": False, "name": "Bass"},
    "other":  {"program": 0,  "is_drum": False, "name": "Other"},
}

STEM_BP = {
    "vocals": dict(onset_threshold=0.5, frame_threshold=0.29, minimum_note_length=120,
                   minimum_frequency=70, maximum_frequency=1300, melodia_trick=True),
    "bass":   dict(onset_threshold=0.5, frame_threshold=0.30, minimum_note_length=120,
                   minimum_frequency=28, maximum_frequency=320, melodia_trick=True),
    "other":  dict(onset_threshold=0.5, frame_threshold=0.28, minimum_note_length=100,
                   minimum_frequency=48, maximum_frequency=2600, melodia_trick=True),
    "drums":  dict(onset_threshold=0.65, frame_threshold=0.45, minimum_note_length=60,
                   melodia_trick=False),
}

_bp_lock = threading.Lock()
_bp = {"predict": None, "model": None}

def _load_basic_pitch():
    with _bp_lock:
        if _bp["predict"] is None:
            from basic_pitch.inference import predict
            from basic_pitch import ICASSP_2022_MODEL_PATH
            _bp["predict"] = predict
            _bp["model"] = ICASSP_2022_MODEL_PATH
    return _bp["predict"], _bp["model"]

def notes_path(stem_dir, stem):
    return Path(stem_dir) / f"{stem}.notes.json"

def midi_path(stem_dir, stem):
    return Path(stem_dir) / f"{stem}.mid"

def cached_notes(stem_dir, stem):
    p = notes_path(stem_dir, stem)
    if not p.exists():
        return None
    try:
        d = json.loads(p.read_text("utf-8"))
        if d.get("v") == NOTES_VERSION:
            return d["notes"]
    except Exception:
        pass
    return None

def estimate_tempo(stem_dir):
    stem_dir = Path(stem_dir)
    tp = stem_dir / "tempo.json"
    if tp.exists():
        try:
            return float(json.loads(tp.read_text("utf-8"))["bpm"])
        except Exception:
            pass
    bpm = 120.0
    try:
        import librosa
        for cand in ("drums", "other", "bass", "vocals"):
            w = stem_dir / f"{cand}.wav"
            if not w.exists():
                continue
            y, sr = librosa.load(str(w), mono=True, sr=22050, duration=150)
            t = librosa.beat.beat_track(y=y, sr=sr)[0]
            import numpy as np
            bpm = float(np.atleast_1d(t)[0])
            break
    except Exception as exc:
        print("tempo estimate failed:", exc, flush=True)

    while bpm and bpm < 70:
        bpm *= 2
    while bpm > 180:
        bpm /= 2
    bpm = round(bpm, 2) if bpm else 120.0
    try:
        tp.write_text(json.dumps({"bpm": bpm}), "utf-8")
    except Exception:
        pass
    return bpm

def clean_notes(notes):
    out = []
    for n in sorted(notes, key=lambda n: n["s"]):
        if n["e"] - n["s"] < 0.045:
            continue
        ghost = False
        for m in out[-40:]:
            if m["e"] <= n["s"] + 0.01:
                continue
            d = n["p"] - m["p"]
            if d in (12, 19, 24) and n["v"] < 0.55 * m["v"]:
                ghost = True
                break
        if not ghost:
            out.append(n)
    return out

def quantize_notes(notes, bpm, grid=8):
    step = 60.0 / bpm / grid
    snapped = []
    for n in notes:
        s = round(n["s"] / step) * step
        e = round(n["e"] / step) * step
        if e <= s:
            e = s + step
        snapped.append({"s": round(s, 4), "e": round(e, 4), "p": n["p"],
                        "v": round(min(1.0, max(0.0, n["v"])), 3)})
    snapped.sort(key=lambda n: (n["p"], n["s"]))
    merged = []
    for n in snapped:
        if merged and merged[-1]["p"] == n["p"] and n["s"] - merged[-1]["e"] <= step * 1.5:
            merged[-1]["e"] = max(merged[-1]["e"], n["e"])
            merged[-1]["v"] = max(merged[-1]["v"], n["v"])
        else:
            merged.append(dict(n))
    cleaned = clean_notes(merged)
    cleaned.sort(key=lambda n: n["s"])
    return cleaned

def notes_to_midi(notes, bpm, stem):
    import pretty_midi
    pm = pretty_midi.PrettyMIDI(initial_tempo=bpm)
    cfg = STEM_MIDI[stem]
    inst = pretty_midi.Instrument(program=cfg["program"], is_drum=cfg["is_drum"], name=cfg["name"])
    for n in notes:
        inst.notes.append(pretty_midi.Note(
            velocity=int(40 + 87 * n["v"]), pitch=int(n["p"]),
            start=float(n["s"]), end=float(max(n["e"], n["s"] + 0.03))))
    pm.instruments.append(inst)
    return pm

def transcribe_stem(stem_dir, stem, bpm=None):
    stem_dir = Path(stem_dir)
    cached = cached_notes(stem_dir, stem)
    if cached is not None:
        return cached
    wav = stem_dir / f"{stem}.wav"
    if not wav.exists():
        return []
    if bpm is None:
        bpm = estimate_tempo(stem_dir)
    predict, model = _load_basic_pitch()
    _out, _midi, events = predict(str(wav), model, **STEM_BP.get(stem, {}))
    raw = []
    for ev in events:
        amp = float(ev[3]) if len(ev) > 3 else 0.8
        raw.append({"s": float(ev[0]), "e": float(ev[1]), "p": int(ev[2]),
                    "v": min(1.0, max(0.0, amp))})
    notes = quantize_notes(raw, bpm)
    try:
        notes_to_midi(notes, bpm, stem).write(str(midi_path(stem_dir, stem)))
    except Exception as exc:
        print("midi write failed:", exc, flush=True)
    notes_path(stem_dir, stem).write_text(
        json.dumps({"v": NOTES_VERSION, "bpm": bpm, "notes": notes}), "utf-8")
    return notes

def transcribe_job(pid, stem_dir):
    set_job("midi:" + pid, status="processing", progress=0)
    try:
        bpm = estimate_tempo(stem_dir)
        set_job("midi:" + pid, progress=5)
        for i, stem in enumerate(STEMS):
            transcribe_stem(stem_dir, stem, bpm=bpm)
            set_job("midi:" + pid, progress=int(5 + (i + 1) / len(STEMS) * 95))
        set_job("midi:" + pid, status="done", progress=100)
    except Exception as exc:
        print("transcription failed:", exc, flush=True)
        set_job("midi:" + pid, status="error", progress=0)

def build_combined_midi(stem_dir):
    import pretty_midi
    bpm = estimate_tempo(stem_dir)
    combined = pretty_midi.PrettyMIDI(initial_tempo=bpm)
    for stem in STEMS:
        mp = midi_path(stem_dir, stem)
        if not mp.exists():
            continue
        try:
            pm = pretty_midi.PrettyMIDI(str(mp))
        except Exception:
            continue
        cfg = STEM_MIDI[stem]
        inst = pretty_midi.Instrument(
            program=cfg["program"], is_drum=cfg["is_drum"], name=cfg["name"]
        )
        for src in pm.instruments:
            inst.notes.extend(src.notes)
        if inst.notes:
            combined.instruments.append(inst)
    buf = io.BytesIO()
    combined.write(buf)
    return buf.getvalue()

PIANO_OK = importlib.util.find_spec("piano_transcription_inference") is not None
PIANO_VERSION = 1
_PT_CKPT_NAME = "note_F1=0.9677_pedal_F1=0.9186.pth"
_pt = {"model": None}
_pt_lock = threading.Lock()

def _resolve_piano_ckpt():
    cands = []
    mei = getattr(sys, "_MEIPASS", None)
    if mei:
        cands += [Path(mei) / "piano_transcription_inference_data" / _PT_CKPT_NAME,
                  Path(mei) / "model" / _PT_CKPT_NAME]
    if getattr(sys, "frozen", False):
        cands.append(Path(sys.executable).parent / "piano_transcription_inference_data" / _PT_CKPT_NAME)
    cands.append(Path.home() / "piano_transcription_inference_data" / _PT_CKPT_NAME)
    for c in cands:
        if c.is_file():
            return str(c)
    return None

def _load_piano_model():
    with _pt_lock:
        if _pt["model"] is None:
            from piano_transcription_inference import PianoTranscription
            dev = "cuda" if DEVICE == "cuda" else "cpu"
            m = PianoTranscription(device=dev, checkpoint_path=_resolve_piano_ckpt())
            m.onset_threshold = 0.40
            m.frame_threshold = 0.10
            _pt["model"] = m
    return _pt["model"]

def piano_midi_path(stem_dir):
    return Path(stem_dir) / "piano.mid"

def piano_notes_path(stem_dir):
    return Path(stem_dir) / "piano.notes.json"

def cached_piano(stem_dir):
    p = piano_notes_path(stem_dir)
    if not p.exists():
        return None
    try:
        d = json.loads(p.read_text("utf-8"))
        if d.get("v") == PIANO_VERSION:
            return d
    except Exception:
        pass
    return None

def _nodrums_mix(stem_dir, sr):
    import librosa
    import numpy as np
    mix = None
    for s in ("vocals", "bass", "other"):
        w = Path(stem_dir) / f"{s}.wav"
        if not w.exists():
            continue
        y, _ = librosa.load(str(w), sr=sr, mono=True)
        if mix is None:
            mix = y
        else:
            n = min(len(mix), len(y))
            mix = mix[:n] + y[:n]
    if mix is None:
        return None
    peak = float(np.max(np.abs(mix))) if len(mix) else 0.0
    if peak > 0:
        mix = (mix / peak) * 0.9
    return mix.astype("float32")

def _split_point(notes):
    from collections import Counter
    c = Counter(n["note"] for n in notes)
    if not c:
        return 60
    best, best_w = 60, 1e9
    for cand in range(55, 68):
        w = sum(c.get(p, 0) for p in range(cand - 3, cand + 4))
        if w < best_w or (w == best_w and abs(cand - 60) < abs(best - 60)):
            best_w, best = w, cand
    return best

def piano_transcribe(stem_dir, set_pct=None):
    stem_dir = Path(stem_dir)
    hit = cached_piano(stem_dir)
    if hit is not None:
        return hit
    import mido
    from piano_transcription_inference import sample_rate

    if set_pct:
        set_pct(8)
    mix = _nodrums_mix(stem_dir, sample_rate)
    if mix is None:
        raise RuntimeError("no stems to transcribe")
    model = _load_piano_model()
    if set_pct:
        set_pct(15)
    raw_mid = str(stem_dir / "piano.raw.mid")
    model.transcribe(mix, raw_mid)
    if set_pct:
        set_pct(80)

    mid = mido.MidiFile(raw_mid)
    tpb = mid.ticks_per_beat
    events = []
    for tr in mid.tracks:
        t = 0
        for msg in tr:
            t += msg.time
            events.append((t, msg))
    events.sort(key=lambda e: e[0])

    tempos = [(0, 500000)] + [(t, m.tempo) for t, m in events if m.type == "set_tempo"]
    tempos.sort()

    def t2s(tick):
        s, pt, pte = 0.0, 0, 500000
        for tc, te in tempos:
            if tc >= tick:
                break
            s += mido.tick2second(tc - pt, tpb, pte)
            pt, pte = tc, te
        return s + mido.tick2second(tick - pt, tpb, pte)

    MIN_VEL = 10
    pending, notes = {}, []
    for tick, msg in events:
        if msg.type == "note_on" and msg.velocity >= MIN_VEL:
            if msg.note in pending:
                o = pending[msg.note]
                notes.append({"note": msg.note, "start": o["t"], "end": tick, "vel": o["v"]})
            pending[msg.note] = {"t": tick, "v": msg.velocity}
        elif msg.type in ("note_off", "note_on") and msg.note in pending:
            o = pending.pop(msg.note)
            notes.append({"note": msg.note, "start": o["t"], "end": tick, "vel": o["v"]})
    max_tick = max((t for t, _ in events), default=0)
    for note, o in pending.items():
        notes.append({"note": note, "start": o["t"], "end": max_tick, "vel": o["v"]})

    notes = [n for n in notes if t2s(n["end"]) - t2s(n["start"]) >= 0.030]

    import bisect
    gap_tol, min_ticks, max_ticks = max(1, tpb // 32), max(1, tpb // 16), tpb * 4
    onsets = sorted({n["start"] for n in notes})
    for n in notes:
        i = bisect.bisect_right(onsets, n["start"] + gap_tol)
        if i < len(onsets) and n["end"] > onsets[i]:
            n["end"] = onsets[i]
        if n["end"] - n["start"] > max_ticks:
            n["end"] = n["start"] + max_ticks
        if n["end"] - n["start"] < min_ticks:
            n["end"] = n["start"] + min_ticks

    split = _split_point(notes)
    cc = [(t, m) for t, m in events if m.type == "control_change"]

    out = mido.MidiFile(ticks_per_beat=tpb)
    meta = mido.MidiTrack(); out.tracks.append(meta)
    mp = [(t, m.copy(time=0)) for t, m in events if m.is_meta and m.type != "end_of_track"]

    def emit(track, pairs):
        def key(p):
            t, m = p
            order = 0 if m.type == "note_off" else (1 if (m.is_meta or m.type == "control_change") else 2)
            return (t, order)
        pairs.sort(key=key)
        prev = 0
        for at, m in pairs:
            m.time = at - prev; track.append(m); prev = at

    emit(meta, mp)

    def hand_track(name, hn, ch):
        tr = mido.MidiTrack(); tr.name = name
        pr = [(0, mido.Message("program_change", program=0, channel=ch, time=0))]
        for t, m in cc:
            pr.append((t, m.copy(channel=ch, time=0)))
        for n in hn:
            pr.append((n["start"], mido.Message("note_on", note=n["note"], velocity=n["vel"], channel=ch, time=0)))
            pr.append((n["end"], mido.Message("note_off", note=n["note"], velocity=0, channel=ch, time=0)))
        emit(tr, pr)
        return tr

    right = [n for n in notes if n["note"] >= split]
    left = [n for n in notes if n["note"] < split]
    out.tracks.append(hand_track("Right Hand", right, 0))
    out.tracks.append(hand_track("Left Hand", left, 1))
    out.save(str(piano_midi_path(stem_dir)))
    try:
        os.remove(raw_mid)
    except Exception:
        pass

    bpm = estimate_tempo(stem_dir)
    seconds = []
    for n in sorted(notes, key=lambda n: n["start"]):
        seconds.append({
            "s": round(t2s(n["start"]), 3),
            "e": round(t2s(n["end"]), 3),
            "p": int(n["note"]),
            "v": round(min(1.0, n["vel"] / 127.0), 3),
            "hand": "R" if n["note"] >= split else "L",
        })
    data = {"v": PIANO_VERSION, "bpm": bpm, "notes": seconds}
    piano_notes_path(stem_dir).write_text(json.dumps(data), "utf-8")
    if set_pct:
        set_pct(100)
    return data

def piano_job(pid, stem_dir):
    set_job("piano:" + pid, status="processing", progress=0)
    try:
        piano_transcribe(stem_dir, set_pct=lambda p: set_job("piano:" + pid, progress=int(p)))
        set_job("piano:" + pid, status="done", progress=100)
    except Exception as exc:
        print("piano transcription failed:", exc, flush=True)
        set_job("piano:" + pid, status="error", progress=0)

_MUSESCORE = [
    r"C:\Program Files\MuseScore 4\bin\MuseScore4.exe",
    r"C:\Program Files\MuseScore 3\bin\MuseScore3.exe",
    r"C:\Program Files (x86)\MuseScore 4\bin\MuseScore4.exe",
]

def find_musescore():
    for c in _MUSESCORE:
        if os.path.isfile(c):
            return c
    for name in ("MuseScore4.exe", "MuseScore3.exe", "mscore"):
        f = shutil.which(name)
        if f:
            return f
    return None

def make_piano_sheet(stem_dir, title="xremove"):
    stem_dir = Path(stem_dir)
    out = stem_dir / f"sheet-piano-hr-v{PIANO_VERSION}.musicxml"
    if out.exists():
        return out
    mid = piano_midi_path(stem_dir)
    if not mid.exists():
        piano_transcribe(stem_dir)
    ms = find_musescore()
    if ms:
        try:
            r = subprocess.run([ms, "-o", str(out), str(mid)], capture_output=True, text=True)
            if r.returncode == 0 and out.exists():
                _inject_xml_meta(out, title, "transcribed by salad fingers · @c7s89r")
                return out
        except Exception:
            pass

    import music21 as m21
    score = m21.converter.parse(str(mid))
    score.insert(0, m21.metadata.Metadata())
    score.metadata.title = title
    score.metadata.composer = "transcribed by salad fingers · @c7s89r"
    score.write("musicxml", fp=str(out))
    return out

def _inject_xml_meta(xml_path, title, composer):
    try:
        txt = Path(xml_path).read_text("utf-8")
        if "<work-title>" in txt or "<work>" in txt:
            return
        import html
        block = ("<work><work-title>" + html.escape(title) + "</work-title></work>"
                 "<identification><creator type=\"composer\">" + html.escape(composer)
                 + "</creator></identification>")
        i = txt.find("<part-list")
        if i != -1:
            txt = txt[:i] + block + txt[i:]
            Path(xml_path).write_text(txt, "utf-8")
    except Exception:
        pass

SHEET_PARTS = ["piano"] + STEMS

def sheet_path(stem_dir, which):
    return Path(stem_dir) / f"sheet-{which}-v{NOTES_VERSION}.musicxml"

def _collect_for_sheet(stem_dir, which):
    stem_dir = Path(stem_dir)
    if which == "piano":
        notes = []
        for s in ("bass", "other", "vocals"):
            for n in (cached_notes(stem_dir, s) or []):
                notes.append(n)
        return notes
    return cached_notes(stem_dir, which) or []

def make_sheet(stem_dir, which, title="xremove"):
    stem_dir = Path(stem_dir)
    out = sheet_path(stem_dir, which)
    if out.exists():
        return out
    import music21 as m21
    bpm = estimate_tempo(stem_dir)
    spb = 60.0 / bpm
    GRID = 0.25

    def ql(sec):
        return max(GRID, round((sec / spb) / GRID) * GRID)

    def off(sec):
        return max(0.0, round((sec / spb) / GRID) * GRID)

    def fill_part(part, notes):
        for n in notes:
            try:
                nt = m21.note.Note(int(n["p"]))
                nt.quarterLength = ql(n["e"] - n["s"])
                nt.volume.velocity = int(40 + 87 * n.get("v", 0.7))
                part.insert(off(n["s"]), nt)
            except Exception:
                pass

    notes = _collect_for_sheet(stem_dir, which)
    score = m21.stream.Score()
    score.insert(0, m21.metadata.Metadata())
    score.metadata.title = title
    score.metadata.composer = "transcribed by salad fingers · @c7s89r"

    if which == "piano":
        treble = m21.stream.PartStaff(); bass = m21.stream.PartStaff()
        fill_part(treble, [n for n in notes if n["p"] >= 60])
        fill_part(bass, [n for n in notes if n["p"] < 60])
        treble.insert(0, m21.clef.TrebleClef())
        bass.insert(0, m21.clef.BassClef())
        for pt in (treble, bass):
            pt.insert(0, m21.tempo.MetronomeMark(number=round(bpm)))
            pt.insert(0, m21.meter.TimeSignature("4/4"))
        score.insert(0, treble); score.insert(0, bass)
        score.insert(0, m21.layout.StaffGroup([treble, bass], symbol="brace"))
    else:
        part = m21.stream.Part()
        fill_part(part, notes)
        med = sorted(n["p"] for n in notes)
        low = med[len(med) // 2] < 56 if med else False
        part.insert(0, m21.clef.BassClef() if low else m21.clef.TrebleClef())
        part.insert(0, m21.tempo.MetronomeMark(number=round(bpm)))
        part.insert(0, m21.meter.TimeSignature("4/4"))
        part.partName = STEM_MIDI.get(which, {}).get("name", which)
        score.insert(0, part)

    try:
        k = score.analyze("key")
        for pt in score.parts:
            pt.insert(0, m21.key.KeySignature(k.sharps))
    except Exception:
        pass
    score.makeNotation(inPlace=True)
    score.write("musicxml", fp=str(out))
    return out

class _ProgressStderr:
    _pat = re.compile(r"(\d+)%")

    def __init__(self, job_id, total_models):
        self.job_id = job_id
        self.total = total_models
        self.completed = 0
        self.last = -1
        self.buf = ""

    def write(self, s):
        for ch in s:
            if ch in "\r\n":
                m = self._pat.search(self.buf)
                if m:
                    pct = int(m.group(1))
                    if pct < self.last:
                        self.completed += 1
                    self.last = pct
                    overall = (self.completed * 100 + pct) / self.total
                    set_job(self.job_id, progress=min(99, int(overall)))
                self.buf = ""
            else:
                self.buf += ch
        return len(s)

    def flush(self):
        pass

def run_separation(job_id, input_path, name, model, shifts, overlap, quality):

    import contextlib
    import demucs.separate
    out_dir = OUTPUT / job_id
    args = [
        "-n", model,
        "--shifts", str(shifts),
        "--overlap", str(overlap),
        "--device", DEVICE,
        "-o", str(out_dir),
        str(input_path),
    ]
    try:
        with contextlib.redirect_stderr(_ProgressStderr(job_id, MODEL_BAGS.get(model, 1))):
            demucs.separate.main(args)
    except Exception as exc:
        print("separation failed:", exc, flush=True)
        set_job(job_id, status="error", progress=0)
        return
    stem_dir = out_dir / model / input_path.stem
    if not stem_dir.exists():
        candidates = list((out_dir / model).glob("*"))
        if not candidates:
            set_job(job_id, status="error", progress=0)
            return
        stem_dir = candidates[0]
    add_project(job_id, name, model, quality, stem_dir)
    set_job(job_id, status="done", progress=100, stem_dir=str(stem_dir))

@app.post("/api/separate")
async def separate(file: UploadFile = File(...), quality: str = Form("clean")):
    job_id = uuid.uuid4().hex
    ext = Path(file.filename).suffix.lower() or ".mp3"
    name = Path(file.filename).stem or "untitled"
    input_path = UPLOADS / f"{job_id}{ext}"
    with open(input_path, "wb") as out:
        shutil.copyfileobj(file.file, out)
    cfg = QUALITY.get(quality, QUALITY["clean"])
    set_job(job_id, status="processing", progress=0, name=name)
    thread = threading.Thread(
        target=run_separation,
        args=(job_id, input_path, name, cfg["model"], cfg["shifts"],
              cfg["overlap"], quality),
        daemon=True,
    )
    thread.start()
    return {
        "job_id": job_id,
        "name": name,
        "stems": STEMS,
        "device": DEVICE,
        "quality": quality,
        "model": cfg["model"],
    }

@app.get("/api/health")
def health():
    return {
        "device": DEVICE,
        "gpu": GPU_NAME,
        "stems": STEMS,
        "cuda": GPU["cuda"],
        "cuda_version": GPU["cuda_version"],
        "torch": GPU["torch"],
        "vram_gb": GPU["vram_gb"],
        "midi": MIDI_OK,
        "sheets": SHEET_OK,
        "piano": PIANO_OK,
    }

@app.get("/api/progress/{job_id}")
def progress(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="unknown job")
    return {
        "status": job.get("status"),
        "progress": job.get("progress", 0),
        "name": job.get("name"),
    }

@app.get("/api/projects")
def list_projects():
    with projects_lock:
        items = sorted(
            projects.values(), key=lambda p: p["created"], reverse=True
        )
    return items

@app.get("/api/projects/{pid}")
def get_project(pid: str):
    with projects_lock:
        proj = projects.get(pid)
    if not proj:
        raise HTTPException(status_code=404, detail="unknown project")
    return proj

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    favorite: Optional[bool] = None

@app.patch("/api/projects/{pid}")
def update_project(pid: str, upd: ProjectUpdate):
    with projects_lock:
        proj = projects.get(pid)
        if not proj:
            raise HTTPException(status_code=404, detail="unknown project")
        if upd.name is not None:
            proj["name"] = upd.name.strip() or proj["name"]
        if upd.favorite is not None:
            proj["favorite"] = upd.favorite
        save_projects()
        return proj

@app.delete("/api/projects/{pid}")
def delete_project(pid: str):
    with projects_lock:
        proj = projects.pop(pid, None)
        if proj:
            save_projects()
    if not proj:
        raise HTTPException(status_code=404, detail="unknown project")
    shutil.rmtree(OUTPUT / pid, ignore_errors=True)
    for f in UPLOADS.glob(pid + ".*"):
        try:
            f.unlink()
        except OSError:
            pass
    return {"ok": True}

def resolve_stem_dir(pid):
    with projects_lock:
        proj = projects.get(pid)
    if proj:
        return proj["stem_dir"]
    job = get_job(pid)
    if job and job.get("status") == "done":
        return job.get("stem_dir")
    return None

@app.get("/api/audio/{pid}/{stem}")
def audio(pid: str, stem: str):
    if stem not in STEMS:
        raise HTTPException(status_code=404, detail="unknown stem")
    stem_dir = resolve_stem_dir(pid)
    if not stem_dir:
        raise HTTPException(status_code=404, detail="not ready")
    path = Path(stem_dir) / f"{stem}.wav"
    if not path.exists():
        raise HTTPException(status_code=404, detail="missing stem")
    return FileResponse(path, media_type="audio/wav", filename=f"{stem}.wav")

@app.get("/api/notes/{pid}")
def notes(pid: str):
    if not MIDI_OK:
        raise HTTPException(status_code=501, detail="basic-pitch not installed")
    stem_dir = resolve_stem_dir(pid)
    if not stem_dir:
        raise HTTPException(status_code=404, detail="not ready")
    stem_dir = Path(stem_dir)
    cached = {s: cached_notes(stem_dir, s) for s in STEMS}
    if all(cached[s] is not None for s in STEMS):
        bpm = estimate_tempo(stem_dir)
        return {"status": "done", "progress": 100, "bpm": bpm, "stems": cached}
    job = get_job("midi:" + pid)
    if not job or job.get("status") == "error":
        threading.Thread(
            target=transcribe_job, args=(pid, str(stem_dir)), daemon=True
        ).start()
        return {"status": "processing", "progress": 0}
    return {"status": job.get("status"), "progress": job.get("progress", 0)}

@app.get("/api/piano/{pid}")
def piano(pid: str):
    if not PIANO_OK:
        raise HTTPException(status_code=501, detail="piano model not installed")
    stem_dir = resolve_stem_dir(pid)
    if not stem_dir:
        raise HTTPException(status_code=404, detail="not ready")
    stem_dir = Path(stem_dir)
    hit = cached_piano(stem_dir)
    if hit is not None:
        return {"status": "done", "progress": 100, "bpm": hit["bpm"], "notes": hit["notes"]}
    job = get_job("piano:" + pid)
    if not job or job.get("status") == "error":
        threading.Thread(target=piano_job, args=(pid, str(stem_dir)), daemon=True).start()
        return {"status": "processing", "progress": 0}
    return {"status": job.get("status"), "progress": job.get("progress", 0)}

@app.get("/api/midi/{pid}/{stem}")
def midi_stem(pid: str, stem: str):
    if not MIDI_OK:
        raise HTTPException(status_code=501, detail="basic-pitch not installed")
    if stem not in STEMS:
        raise HTTPException(status_code=404, detail="unknown stem")
    stem_dir = resolve_stem_dir(pid)
    if not stem_dir:
        raise HTTPException(status_code=404, detail="not ready")
    mp = midi_path(stem_dir, stem)
    if not mp.exists():
        transcribe_stem(stem_dir, stem)
    if not mp.exists():
        raise HTTPException(status_code=500, detail="transcription failed")
    return FileResponse(mp, media_type="audio/midi", filename=f"{stem}.mid")

@app.get("/api/midi/{pid}")
def midi_all(pid: str):
    stem_dir = resolve_stem_dir(pid)
    if not stem_dir:
        raise HTTPException(status_code=404, detail="not ready")
    stem_dir = Path(stem_dir)
    name = "mix"
    with projects_lock:
        proj = projects.get(pid)
        if proj:
            name = proj["name"]
    if PIANO_OK:
        mp = piano_midi_path(stem_dir)
        if not mp.exists():
            piano_transcribe(stem_dir)
        if mp.exists():
            return FileResponse(mp, media_type="audio/midi", filename=f"{name}.mid")
    if not MIDI_OK:
        raise HTTPException(status_code=501, detail="no transcription engine")
    for s in STEMS:
        if not midi_path(stem_dir, s).exists():
            transcribe_stem(stem_dir, s)
    data = build_combined_midi(stem_dir)
    return Response(content=data, media_type="audio/midi",
                    headers={"Content-Disposition": f'attachment; filename="{name}.mid"'})

@app.get("/api/sheet/{pid}/{which}")
def sheet(pid: str, which: str):
    if not SHEET_OK:
        raise HTTPException(status_code=501, detail="music21 not installed")
    if which not in SHEET_PARTS:
        raise HTTPException(status_code=404, detail="unknown sheet")
    stem_dir = resolve_stem_dir(pid)
    if not stem_dir:
        raise HTTPException(status_code=404, detail="not ready")
    stem_dir = Path(stem_dir)
    name = "xremove"
    with projects_lock:
        proj = projects.get(pid)
        if proj:
            name = proj["name"]

    if which == "piano":

        if not PIANO_OK:
            raise HTTPException(status_code=501, detail="piano model not installed")
        if cached_piano(stem_dir) is None:
            job = get_job("piano:" + pid)
            if not job or job.get("status") == "error":
                threading.Thread(target=piano_job, args=(pid, str(stem_dir)), daemon=True).start()
                return Response(status_code=202, content="transcribing")
            if job.get("status") != "done":
                return Response(status_code=202, content="transcribing")
        try:
            path = make_piano_sheet(stem_dir, title=name)
        except Exception as exc:
            print("piano sheet build failed:", exc, flush=True)
            raise HTTPException(status_code=500, detail="sheet build failed")
        return FileResponse(path, media_type="application/vnd.recordare.musicxml+xml",
                            filename=f"{name} - piano.musicxml")

    if cached_notes(stem_dir, which) is None:
        job = get_job("midi:" + pid)
        if not job or job.get("status") == "error":
            threading.Thread(target=transcribe_job, args=(pid, str(stem_dir)), daemon=True).start()
            return Response(status_code=202, content="transcribing")
        if job.get("status") != "done":
            return Response(status_code=202, content="transcribing")
    try:
        path = make_sheet(stem_dir, which, title=name)
    except Exception as exc:
        print("sheet build failed:", exc, flush=True)
        raise HTTPException(status_code=500, detail="sheet build failed")
    return FileResponse(path, media_type="application/vnd.recordare.musicxml+xml",
                        filename=f"{name} - {which}.musicxml")

@app.get("/favicon.ico")
def favicon():
    return FileResponse(STATIC / "favicon.svg", media_type="image/svg+xml")

app.mount("/", StaticFiles(directory=str(STATIC), html=True), name="static")
