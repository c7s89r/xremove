"use strict";

const STEMS = ["vocals", "drums", "bass", "other"];
const SWATCH = { vocals: "#ffffff", drums: "#c4c4ca", bass: "#9a9aa1", other: "#74747b" };

const $ = (id) => document.getElementById(id);

const appEl = $("app");
const sidebarEl = $("sidebar");
const collapseBtn = $("collapse");
const newBtn = $("new-project");
const searchEl = $("search");
const tabsEl = $("side-tabs");
const listEl = $("project-list");
const devDot = $("dev-dot");
const devLabel = $("dev-label");
const crumbEl = $("crumb");
const themeBtn = $("theme-btn");
const shortcutsBtn = $("shortcuts-btn");
const scrollEl = $("scroll");

const homeEl = $("home");
const dropEl = $("drop");
const fileEl = $("file");
const segEl = $("seg");

const statusEl = $("status");
const statusName = $("status-name");
const statusPct = $("status-pct");
const fillEl = $("fill");
const statusText = $("status-text");
const statusSteps = $("status-steps");

const playerEl = $("player");
const nowName = $("now-name");
const nowMeta = $("now-meta");
const starBtn = $("star-btn");
const exportBtn = $("export-btn");
const waveCanvas = $("wave");
const waveCursor = $("wave-cursor");
const waveWrap = waveCanvas.parentElement;
const backBtn = $("back");
const fwdBtn = $("fwd");
const loopBtn = $("loop");
const playBtn = $("play");
const seekEl = $("seek");
const curEl = $("cur");
const durEl = $("dur");
const rateEl = $("rate");
const stemsEl = $("stems");
const masterVal = $("master-val");
const masterVolEl = $("master-vol");
const masterMeterFill = $("master-meter-fill");
const resetBtn = $("reset");
const deleteBtn = $("delete-btn");

const modalEl = $("shortcuts-modal");
const modalClose = $("shortcuts-close");
const modalBody = $("shortcuts-body");
const toastsEl = $("toasts");

const playerTabs = $("player-tabs");
const studioView = $("studio-view");
const pianoView = $("piano-view");
const stageEl = $("stage");
const rollCanvas = $("roll");
const keysCanvas = $("keys");
const stageOverlay = $("stage-overlay");
const overlayTitle = $("stage-overlay-title");
const overlaySub = $("stage-overlay-sub");
const midiFill = $("midi-fill");
const midiBtn = $("midi-btn");
const sheetsView = $("sheets-view");
const sheetParts = $("sheet-parts");
const sheetHost = $("sheet-host");
const sheetScroll = $("sheet-scroll");
const sheetOverlay = $("sheet-overlay");
const sheetMsg = $("sheet-msg");
const sheetDl = $("sheet-dl");
const sheetMidiBtn = $("sheet-midi");

const NOTE_WHITE = "#ffffff";
const NOTE_COLOR = { vocals: NOTE_WHITE, drums: NOTE_WHITE, bass: NOTE_WHITE, other: NOTE_WHITE };
let activeTabPiano = false;

let quality = "clean";
let projects = [];
let activeTab = "recent";
let currentId = null;

let ctx = null;
let masterGain = null;
let masterAnalyser = null;
let masterMeterBuf = null;
let masterLevel = 0;
let masterVolume = 1;
let buffers = {};
let gains = {};
let pans = {};
let analysers = {};
let meters = {};
let controls = {};
let levels = {};
let peaks = {};
let meterBuf = null;
let sources = {};
let state = {};
let duration = 0;
let playing = false;
let startedAt = 0;
let offset = 0;
let rate = 1;
let looping = false;
let seeking = false;
let loopId = null;
let waveData = null;

let notesFlat = [];          
let notesReady = false;
let pianoPtr = 0;            
let schedCt = 0;
let pianoMode = false;
let pianoDry = null, pianoWet = null;   
let keyLayout = null;        
const LOW = 21, HIGH = 108;  
const LOOKAHEAD = 3.1;       
let keyState = {};           
let particles = [];          
let lastFlashAt = {};        
let songBpm = 0;             

let pianoRaw = null;         
let pianoBuf = null;         
let pianoLoading = null;     

const ICONS = {
  gh: '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.5 7.5 0 0 1 4 0c1.53-1.03 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>',
  dc: '<svg viewBox="0 0 16 12" xmlns="http://www.w3.org/2000/svg"><path d="M13.55 1.01A13.2 13.2 0 0 0 10.3 0c-.14.25-.3.59-.41.86a12.3 12.3 0 0 0-3.67 0C6.1.59 5.94.25 5.8 0a13.2 13.2 0 0 0-3.26 1.01C.47 4.08-.09 7.07.19 10.02a13.3 13.3 0 0 0 4.02 2.03c.32-.44.61-.91.86-1.4-.47-.18-.92-.4-1.34-.66.11-.08.22-.17.33-.26a9.5 9.5 0 0 0 8.08 0c.11.09.22.18.33.26-.43.26-.88.48-1.35.66.25.49.54.96.86 1.4a13.3 13.3 0 0 0 4.02-2.03c.33-3.42-.56-6.38-2.36-9.01zM5.34 8.2c-.79 0-1.43-.72-1.43-1.6 0-.89.63-1.61 1.43-1.61.8 0 1.45.72 1.43 1.6 0 .89-.64 1.61-1.43 1.61zm5.32 0c-.79 0-1.43-.72-1.43-1.6 0-.89.63-1.61 1.43-1.61.8 0 1.45.72 1.43 1.6 0 .89-.63 1.61-1.43 1.61z"/></svg>',
  drop: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6zM10 19a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/></svg>',
  note: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6zM10 19a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/></svg>',
  play: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M8 5v14l11-7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>',
  prev: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>',
  next: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M16 6h2v12h-2zM6 18l8.5-6L6 6z"/></svg>',
  loop: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M7 7h8v3l4-4-4-4v3H5v6h2V7zm10 10H9v-3l-4 4 4 4v-3h10v-6h-2v4z"/></svg>',
  vocals: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/></svg>',
  drums: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 3C7 3 3 4.79 3 7s4 4 9 4 9-1.79 9-4-4-4-9-4zM3 9.5V13c0 2.21 4 4 9 4s9-1.79 9-4V9.5c-1.7 1.5-5.1 2.5-9 2.5s-7.3-1-9-2.5zM3 15.5V18c0 2.21 4 4 9 4s9-1.79 9-4v-2.5c-1.7 1.5-5.1 2.5-9 2.5s-7.3-1-9-2.5z"/></svg>',
  bass: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M4 18a3 3 0 1 0 3-3 3 3 0 0 0-1 .18V7.41l11-2.2v7.97A3 3 0 1 0 20 15V3L6 5.8V15A3 3 0 0 0 4 18z"/></svg>',
  other: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9zm0 13a4 4 0 1 1 4-4 4 4 0 0 1-4 4zm0-5.5a1.5 1.5 0 1 0 1.5 1.5A1.5 1.5 0 0 0 12 10.5z"/></svg>',
  star: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.27 5.82 21 7 14.14l-5-4.87 6.91-1.01z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M6 7h12l-1 14H7L6 7zm3-3h6l1 2h4v2H4V6h4l1-2z"/></svg>',
  download: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M11 3h2v8h3l-4 5-4-5h3V3zM5 19h14v2H5z"/></svg>',
  search: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M10 2a8 8 0 1 0 4.9 14.32l5.39 5.39 1.42-1.42-5.39-5.39A8 8 0 0 0 10 2zm0 2a6 6 0 1 1 0 12 6 6 0 0 1 0-12z"/></svg>',
};
const STEM_ICON = { vocals: "vocals", drums: "drums", bass: "bass", other: "other" };

function svgEl(name) {
  const span = document.createElement("span");
  span.className = "ic";
  span.innerHTML = ICONS[name];
  return span;
}
function maskIcon(el, svg) {
  const url = 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
  el.style.webkitMaskImage = url; el.style.maskImage = url;
  el.style.webkitMaskRepeat = "no-repeat"; el.style.maskRepeat = "no-repeat";
  el.style.webkitMaskPosition = "center"; el.style.maskPosition = "center";
  el.style.webkitMaskSize = "contain"; el.style.maskSize = "contain";
  el.style.background = "currentColor";
}
maskIcon(document.querySelector(".drop-ico"), ICONS.drop);
maskIcon($("hero-glyph"), ICONS.note);

playBtn.innerHTML = ICONS.play;
backBtn.innerHTML = ICONS.prev;
fwdBtn.innerHTML = ICONS.next;
loopBtn.innerHTML = ICONS.loop;
maskIcon(document.querySelector(".search").insertBefore(Object.assign(document.createElement("span"), { className: "search-ic" }), searchEl), ICONS.search);

function shadeOf(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return 34 + (h % 30); 
}

function fmt(t) {
  if (!isFinite(t)) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return m + ":" + String(s).padStart(2, "0");
}
function fmtSize(b) {
  if (!b) return "0 MB";
  return (b / 1048576).toFixed(1) + " MB";
}
function fmtAgo(ts) {
  const d = Date.now() / 1000 - ts;
  if (d < 60) return "just now";
  if (d < 3600) return Math.floor(d / 60) + "m ago";
  if (d < 86400) return Math.floor(d / 3600) + "h ago";
  if (d < 604800) return Math.floor(d / 86400) + "d ago";
  return new Date(ts * 1000).toLocaleDateString();
}
function show(el) { el.classList.remove("hidden"); }
function hide(el) { el.classList.add("hidden"); }

function toast(msg, kind) {
  const t = document.createElement("div");
  t.className = "toast" + (kind ? " " + kind : "");
  t.textContent = msg;
  toastsEl.appendChild(t);
  setTimeout(() => {
    t.style.transition = "opacity .3s, transform .3s";
    t.style.opacity = "0";
    t.style.transform = "translateY(8px)";
    setTimeout(() => t.remove(), 320);
  }, 2600);
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function applyTheme(t) {
  document.documentElement.setAttribute("data-theme", t);
  localStorage.setItem("xr-theme", t);
}
applyTheme(localStorage.getItem("xr-theme") || "dark");
themeBtn.addEventListener("click", () => {
  const cur = document.documentElement.getAttribute("data-theme");
  applyTheme(cur === "light" ? "dark" : "light");
  if (waveData) drawWave();
});

if (localStorage.getItem("xr-collapsed") === "1") appEl.classList.add("collapsed");
collapseBtn.addEventListener("click", () => {
  appEl.classList.toggle("collapsed");
  localStorage.setItem("xr-collapsed", appEl.classList.contains("collapsed") ? "1" : "0");
});

fetch("/api/health").then((r) => r.json()).then((h) => {
  devDot.classList.add(h.device === "cuda" ? "cuda" : "cpu");
  devLabel.textContent = h.device === "cuda" ? "GPU ready" : "CPU mode";
}).catch(() => { devLabel.textContent = "offline"; });

async function loadProjects() {
  try {
    const r = await fetch("/api/projects");
    projects = await r.json();
  } catch (e) { projects = []; }
  renderProjects();
}

tabsEl.addEventListener("click", (e) => {
  const b = e.target.closest(".side-tab");
  if (!b) return;
  activeTab = b.dataset.tab;
  tabsEl.querySelectorAll(".side-tab").forEach((x) => x.classList.toggle("on", x === b));
  renderProjects();
});
searchEl.addEventListener("input", renderProjects);

function renderProjects() {
  const q = searchEl.value.trim().toLowerCase();
  let items = projects.slice();
  if (activeTab === "favorites") items = items.filter((p) => p.favorite);
  if (q) items = items.filter((p) => p.name.toLowerCase().includes(q));

  listEl.innerHTML = "";
  if (!items.length) {
    const e = document.createElement("div");
    e.className = "pl-empty";
    const g = document.createElement("span");
    g.className = "pl-empty-ico"; maskIcon(g, ICONS.note);
    const t = document.createElement("div");
    t.textContent = projects.length ? "No projects match." : "No projects yet.";
    const s = document.createElement("div");
    s.className = "pl-empty-sub";
    s.textContent = projects.length ? "Try another search." : "Drop a track to begin.";
    e.appendChild(g); e.appendChild(t); e.appendChild(s);
    listEl.appendChild(e);
    return;
  }
  items.forEach((p) => {
    const isCur = p.id === currentId;
    const row = document.createElement("div");
    row.className = "proj" + (isCur ? " active" : "") + (isCur && playing ? " playing" : "");
    row.dataset.id = p.id;

    const ico = document.createElement("div");
    ico.className = "proj-ico";
    const L = shadeOf(p.id);
    ico.style.background =
      "linear-gradient(140deg, hsl(0 0% " + (L + 14) + "%), hsl(0 0% " + (L - 10) + "%))";
    const note = document.createElement("span");
    note.className = "proj-note"; maskIcon(note, ICONS.note);
    const eq = document.createElement("span");
    eq.className = "eq"; eq.innerHTML = "<i></i><i></i><i></i><i></i>";
    ico.appendChild(note); ico.appendChild(eq);

    const main = document.createElement("div");
    main.className = "proj-main";
    const nm = document.createElement("div");
    nm.className = "proj-name";
    nm.textContent = p.name;
    const sub = document.createElement("div");
    sub.className = "proj-sub";
    const tag = p.quality === "clean" ? "studio" : "fast";
    sub.textContent = fmtAgo(p.created) + " · " + fmt(p.duration) + " · " + tag;
    main.appendChild(nm); main.appendChild(sub);

    const star = document.createElement("button");
    star.className = "proj-star" + (p.favorite ? " on" : "");
    star.title = "Star"; maskIcon(star, ICONS.star);
    star.addEventListener("click", (ev) => { ev.stopPropagation(); toggleFavorite(p); });

    row.appendChild(ico); row.appendChild(main); row.appendChild(star);
    row.addEventListener("click", () => openProject(p));
    listEl.appendChild(row);
  });
}

function markPlaying(on) {
  document.body.classList.toggle("playing", on);
  const row = listEl.querySelector('.proj[data-id="' + currentId + '"]');
  if (row) row.classList.toggle("playing", on);
}

async function toggleFavorite(p) {
  p.favorite = !p.favorite;
  renderProjects();
  if (currentId === p.id) syncStar();
  try {
    await fetch("/api/projects/" + p.id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorite: p.favorite }),
    });
  } catch (e) { toast("Could not save star", "bad"); }
}

segEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".seg-btn");
  if (!btn) return;
  quality = btn.dataset.q;
  segEl.querySelectorAll(".seg-btn").forEach((b) => b.classList.toggle("on", b === btn));
});

newBtn.addEventListener("click", goHome);
dropEl.addEventListener("click", () => fileEl.click());
fileEl.addEventListener("change", () => {
  if (fileEl.files.length) handleFile(fileEl.files[0]);
});
["dragenter", "dragover"].forEach((ev) =>
  dropEl.addEventListener(ev, (e) => { e.preventDefault(); dropEl.classList.add("over"); })
);
["dragleave", "drop"].forEach((ev) =>
  dropEl.addEventListener(ev, (e) => { e.preventDefault(); dropEl.classList.remove("over"); })
);
dropEl.addEventListener("drop", (e) => {
  if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});

function showView(el) {
  [homeEl, statusEl, playerEl].forEach(hide);
  show(el);
  scrollEl.classList.toggle("stage-mode", el === playerEl);
}

function goHome() {
  teardownAudio();
  currentId = null;
  crumbEl.textContent = "Home";
  renderProjects();
  showView(homeEl);
}

async function handleFile(file) {
  showView(statusEl);
  crumbEl.textContent = "Separating";
  statusName.textContent = file.name;
  statusPct.textContent = "0%";
  fillEl.style.width = "0%";
  statusText.textContent = "uploading";
  buildSteps(0);

  const form = new FormData();
  form.append("file", file);
  form.append("quality", quality);

  let job;
  try {
    const res = await fetch("/api/separate", { method: "POST", body: form });
    job = await res.json();
  } catch (e) { return fail("upload failed"); }

  const label = quality === "clean" ? "studio" : "fast";
  statusText.textContent = "separating · " + label + " · " + job.device;
  poll(job.job_id, file.name);
}

function buildSteps(active) {
  statusSteps.innerHTML = "";
  const n = quality === "clean" ? 4 : 1;
  for (let i = 0; i < n; i++) {
    const s = document.createElement("div");
    s.className = "step" + (i < active ? " on" : "");
    statusSteps.appendChild(s);
  }
}

function poll(jobId, name) {
  const timer = setInterval(async () => {
    let p;
    try {
      const res = await fetch("/api/progress/" + jobId);
      p = await res.json();
    } catch (e) { return; }
    if (p.status === "error") { clearInterval(timer); return fail("separation failed"); }
    fillEl.style.width = p.progress + "%";
    statusPct.textContent = p.progress + "%";
    const n = quality === "clean" ? 4 : 1;
    buildSteps(Math.min(n, Math.floor((p.progress / 100) * n) + (p.progress >= 99 ? 0 : 1)));
    if (p.status === "done") {
      clearInterval(timer);
      statusText.textContent = "loading stems";
      fillEl.style.width = "100%";
      statusPct.textContent = "100%";
      await loadProjects();
      const proj = projects.find((x) => x.id === jobId);
      if (proj) { openProject(proj); toast("Separation complete", "good"); }
      else fail("could not load result");
    }
  }, 500);
}

function fail(msg) {
  statusText.textContent = msg;
  toast(msg, "bad");
  setTimeout(goHome, 1800);
}

function teardownAudio() {
  stop();
  if (loopId) cancelAnimationFrame(loopId);
  loopId = null;
  if (ctx) { try { ctx.close(); } catch (e) {} }
  ctx = null;
  buffers = {}; gains = {}; pans = {}; analysers = {}; meters = {}; controls = {};
  waveData = null;
  
  clearInterval(midiPollTimer);
  notesReady = false; notesFlat = [];
  keyState = {}; particles = []; lastFlashAt = {};
  pianoBuf = null; pianoDry = null; pianoWet = null;
}

async function openProject(p) {
  teardownAudio();
  currentId = p.id;
  crumbEl.textContent = p.name;
  renderProjects();
  showView(statusEl);
  statusName.textContent = p.name;
  statusText.textContent = "loading stems";
  statusPct.textContent = "";
  fillEl.style.width = "100%";
  statusSteps.innerHTML = "";

  ctx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = ctx.createGain();
  masterGain.gain.value = masterVolume;
  masterAnalyser = ctx.createAnalyser();
  masterAnalyser.fftSize = 1024; masterAnalyser.smoothingTimeConstant = 0;
  masterGain.connect(masterAnalyser);
  masterAnalyser.connect(ctx.destination);

  buffers = {}; gains = {}; pans = {}; analysers = {}; levels = {}; peaks = {}; state = {};

  try {
    await Promise.all(STEMS.map(async (stem) => {
      const res = await fetch("/api/audio/" + p.id + "/" + stem);
      if (!res.ok) throw new Error(stem);
      const data = await res.arrayBuffer();
      buffers[stem] = await ctx.decodeAudioData(data);
      const g = ctx.createGain();
      const pan = ctx.createStereoPanner();
      const a = ctx.createAnalyser();
      a.fftSize = 1024; a.smoothingTimeConstant = 0;
      g.connect(pan); pan.connect(masterGain); pan.connect(a);
      gains[stem] = g; pans[stem] = pan; analysers[stem] = a;
      levels[stem] = 0; peaks[stem] = 0;
      state[stem] = { vol: 1, mute: false, solo: false, pan: 0 };
    }));
  } catch (e) {
    return fail("stems unavailable — re-separate this track");
  }

  meterBuf = new Float32Array(analysers[STEMS[0]].fftSize);
  masterMeterBuf = new Float32Array(masterAnalyser.fftSize);
  duration = Math.max(...STEMS.map((s) => buffers[s].duration));
  offset = 0; playing = false;
  computeWave();

  buildStems();
  applyGains();
  durEl.textContent = fmt(duration);
  curEl.textContent = "0:00";
  seekEl.value = 0; fillSlider(seekEl);
  nowName.value = p.name;
  nowMeta.innerHTML = "";
  [
    (p.quality === "clean" ? "Studio engine" : "Fast engine"),
    fmt(duration),
    fmtSize(p.size),
    (p.device || "").toUpperCase() || "CPU",
  ].forEach((t) => { const s = document.createElement("span"); s.textContent = t; nowMeta.appendChild(s); });
  syncStar();
  playBtn.innerHTML = ICONS.play;
  loopBtn.classList.toggle("on", looping);

  showView(playerEl);
  setPlayerTab("studio");        
  drawWave();
  keyState = {}; particles = []; lastFlashAt = {};
  loadNotes(p.id);
  if (loopId) cancelAnimationFrame(loopId);
  lastStageTs = performance.now();
  frame();
}

function fillSlider(el) {
  const pct = ((el.value - el.min) / (el.max - el.min)) * 100;
  el.style.background =
    "linear-gradient(90deg, var(--fg) 0%, var(--fg) " + pct + "%, var(--line) " + pct + "%, var(--line) 100%)";
}

function buildStems() {
  stemsEl.innerHTML = "";
  controls = {};
  STEMS.forEach((stem) => {
    const row = document.createElement("div");
    row.className = "stem s-" + stem;

    const head = document.createElement("div");
    head.className = "stem-head";
    const left = document.createElement("div");
    left.className = "stem-left";
    const sw = document.createElement("span");
    sw.className = "stem-icon";
    sw.style.color = SWATCH[stem];
    maskIcon(sw, ICONS[STEM_ICON[stem]]);
    const label = document.createElement("span");
    label.className = "stem-name";
    label.textContent = stem;
    left.appendChild(sw); left.appendChild(label);
    const val = document.createElement("span");
    val.className = "stem-val";
    val.textContent = "100";
    head.appendChild(left); head.appendChild(val);

    const row2 = document.createElement("div");
    row2.className = "stem-row2";
    const slider = document.createElement("input");
    slider.type = "range"; slider.min = "0"; slider.max = "100"; slider.value = "100";
    fillSlider(slider);

    const pan = document.createElement("div");
    pan.className = "pan";
    const panLabel = document.createElement("label");
    panLabel.textContent = "Pan";
    const panInput = document.createElement("input");
    panInput.type = "range"; panInput.min = "-100"; panInput.max = "100"; panInput.value = "0";
    pan.appendChild(panLabel); pan.appendChild(panInput);

    const toggles = document.createElement("div");
    toggles.className = "stem-toggles";
    const mute = document.createElement("button");
    mute.className = "toggle mute"; mute.textContent = "M"; mute.title = "Mute";
    const solo = document.createElement("button");
    solo.className = "toggle solo"; solo.textContent = "S"; solo.title = "Solo";
    const dl = document.createElement("a");
    dl.className = "toggle dl"; dl.textContent = "↓"; dl.title = "Download " + stem + ".wav";
    dl.href = "/api/audio/" + currentId + "/" + stem;
    dl.setAttribute("download", stem + ".wav");

    row2.appendChild(slider); row2.appendChild(pan); row2.appendChild(toggles);
    toggles.appendChild(mute); toggles.appendChild(solo); toggles.appendChild(dl);

    const meter = document.createElement("div");
    meter.className = "stem-meter";
    const meterFill = document.createElement("div");
    meterFill.className = "stem-meter-fill";
    meterFill.style.background = "linear-gradient(90deg," + SWATCH[stem] + ",var(--fg))";
    const meterPeak = document.createElement("div");
    meterPeak.className = "stem-meter-peak";
    meter.appendChild(meterFill); meter.appendChild(meterPeak);
    meters[stem] = { fill: meterFill, peak: meterPeak };

    function syncRow() {
      const off = state[stem].mute || state[stem].vol === 0;
      row.classList.toggle("muted", off);
      mute.classList.toggle("on", state[stem].mute);
      solo.classList.toggle("on", state[stem].solo);
      slider.value = Math.round(state[stem].vol * 100);
      val.textContent = slider.value;
      fillSlider(slider);
      panInput.value = Math.round(state[stem].pan * 100);
    }

    slider.addEventListener("input", () => {
      state[stem].vol = slider.value / 100;
      val.textContent = slider.value;
      fillSlider(slider); syncRow(); applyGains();
    });
    panInput.addEventListener("input", () => {
      state[stem].pan = panInput.value / 100;
      pans[stem].pan.setTargetAtTime(state[stem].pan, ctx.currentTime, 0.01);
    });
    mute.addEventListener("click", () => { state[stem].mute = !state[stem].mute; syncRow(); applyGains(); });
    solo.addEventListener("click", () => { state[stem].solo = !state[stem].solo; syncRow(); applyGains(); });

    row.appendChild(head); row.appendChild(row2); row.appendChild(meter);
    stemsEl.appendChild(row);
    controls[stem] = { syncRow };
  });
}

function applyGains() {
  const anySolo = STEMS.some((s) => state[s].solo);
  STEMS.forEach((s) => {
    const st = state[s];
    let v = st.vol;
    if (st.mute) v = 0;
    if (anySolo && !st.solo) v = 0;
    if (pianoMode) v = 0;        
    gains[s].gain.setTargetAtTime(v, ctx.currentTime, 0.015);
  });
}
function syncAll() { STEMS.forEach((s) => controls[s].syncRow()); applyGains(); }

function quickMix(muted) {
  STEMS.forEach((s) => { state[s].solo = false; state[s].mute = muted.includes(s); });
  syncAll();
}

masterVolEl.addEventListener("input", () => {
  masterVolume = masterVolEl.value / 100;
  masterVal.textContent = masterVolEl.value;
  if (masterGain) masterGain.gain.setTargetAtTime(masterVolume, ctx.currentTime, 0.015);
});

function position() {
  if (playing) return Math.min(duration, offset + (ctx.currentTime - startedAt) * rate);
  return offset;
}
function start(at) {
  ctx.resume();
  const t = ctx.currentTime + 0.03;
  sources = {};
  STEMS.forEach((s) => {
    const src = ctx.createBufferSource();
    src.buffer = buffers[s];
    src.playbackRate.value = rate;
    src.connect(gains[s]);
    src.start(t, at);
    sources[s] = src;
  });
  startedAt = t; offset = at; playing = true;
  playBtn.innerHTML = ICONS.pause;
  if (currentId) markPlaying(true);
  sources[STEMS[0]].onended = () => {
    if (!playing) return;
    if (position() >= duration - 0.05) {
      if (looping) { stop(); start(0); }
      else { stop(); offset = 0; curEl.textContent = "0:00"; seekEl.value = 0; fillSlider(seekEl); }
    }
  };
}
function stop() {
  if (playing) offset = position();
  Object.values(sources).forEach((src) => { try { src.onended = null; src.stop(); } catch (e) {} });
  sources = {}; playing = false;
  playBtn.innerHTML = ICONS.play;
  markPlaying(false);
}
function togglePlay() {
  if (!ctx) return;
  if (playing) stop();
  else start(offset >= duration ? 0 : offset);
}
function seekTo(pos) {
  if (!ctx) return;
  pos = Math.max(0, Math.min(duration, pos));
  const was = playing;
  stop(); offset = pos;
  curEl.textContent = fmt(pos);
  seekEl.value = duration ? (pos / duration) * 1000 : 0;
  fillSlider(seekEl);
  if (was) start(pos);
}
playBtn.addEventListener("click", togglePlay);
backBtn.addEventListener("click", () => seekTo(position() - 5));
fwdBtn.addEventListener("click", () => seekTo(position() + 5));
loopBtn.addEventListener("click", () => { looping = !looping; loopBtn.classList.toggle("on", looping); });
rateEl.addEventListener("change", () => {
  rate = parseFloat(rateEl.value);
  if (playing) { const p = position(); stop(); start(p); }
});

seekEl.addEventListener("input", () => {
  seeking = true;
  const pos = (seekEl.value / 1000) * duration;
  curEl.textContent = fmt(pos); fillSlider(seekEl);
});
seekEl.addEventListener("change", () => { seeking = false; seekTo((seekEl.value / 1000) * duration); });

waveWrap.addEventListener("click", (e) => {
  const r = waveWrap.getBoundingClientRect();
  seekTo(((e.clientX - r.left) / r.width) * duration);
});

function computeWave() {
  const bins = 720;
  const data = new Float32Array(bins);
  STEMS.forEach((s) => {
    const ch = buffers[s].getChannelData(0);
    const step = Math.max(1, Math.floor(ch.length / bins));
    for (let i = 0; i < bins; i++) {
      let peak = 0; const start = i * step;
      for (let j = 0; j < step; j++) { const v = Math.abs(ch[start + j] || 0); if (v > peak) peak = v; }
      if (peak > data[i]) data[i] = peak;
    }
  });
  waveData = data;
}
function drawWave() {
  if (!waveData) return;
  const dpr = window.devicePixelRatio || 1;
  const w = waveWrap.clientWidth, h = waveWrap.clientHeight;
  waveCanvas.width = w * dpr; waveCanvas.height = h * dpr;
  const g = waveCanvas.getContext("2d");
  g.scale(dpr, dpr);
  g.clearRect(0, 0, w, h);
  const n = waveData.length;
  const bw = w / n;
  const mid = h / 2;
  const css = getComputedStyle(document.documentElement);
  const accent = css.getPropertyValue("--accent").trim() || "#7b7bff";
  const accent2 = css.getPropertyValue("--accent2").trim() || "#b9b9ff";
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, accent2); grad.addColorStop(1, accent);
  g.fillStyle = grad;
  for (let i = 0; i < n; i++) {
    const v = Math.pow(waveData[i], 0.7);
    const bh = Math.max(1, v * (h - 6));
    g.fillRect(i * bw, mid - bh / 2, Math.max(1, bw - 0.6), bh);
  }
}
let waveResizeTO = null;
window.addEventListener("resize", () => {
  clearTimeout(waveResizeTO);
  waveResizeTO = setTimeout(() => { if (waveData) drawWave(); }, 150);
});

function frame() {
  if (playing && !seeking) {
    const pos = position();
    curEl.textContent = fmt(pos);
    seekEl.value = duration ? (pos / duration) * 1000 : 0;
    fillSlider(seekEl);
  }
  const pos = position();
  waveCursor.style.left = (duration ? (pos / duration) * 100 : 0) + "%";

  for (let i = 0; i < STEMS.length; i++) {
    const s = STEMS[i];
    const a = analysers[s];
    a.getFloatTimeDomainData(meterBuf);
    let peak = 0, sum = 0;
    for (let j = 0; j < meterBuf.length; j++) {
      const v = meterBuf[j]; const av = v < 0 ? -v : v;
      if (av > peak) peak = av; sum += v * v;
    }
    const rms = Math.sqrt(sum / meterBuf.length);
    let target = playing ? peak * 0.6 + rms * 1.9 : 0;
    if (target > 1) target = 1;
    const k = target > levels[s] ? 0.85 : 0.16;
    levels[s] += (target - levels[s]) * k;
    if (levels[s] > peaks[s]) peaks[s] = levels[s]; else peaks[s] -= 0.009;
    if (peaks[s] < 0) peaks[s] = 0;
    const m = meters[s];
    m.fill.style.transform = "scaleX(" + levels[s].toFixed(3) + ")";
    m.fill.style.opacity = (0.35 + levels[s] * 0.65).toFixed(3);
    m.peak.style.left = (peaks[s] * 100).toFixed(2) + "%";
    m.peak.style.opacity = peaks[s] > 0.03 ? "1" : "0";
  }
  
  masterAnalyser.getFloatTimeDomainData(masterMeterBuf);
  let mp = 0, ms = 0;
  for (let j = 0; j < masterMeterBuf.length; j++) {
    const v = masterMeterBuf[j]; const av = v < 0 ? -v : v;
    if (av > mp) mp = av; ms += v * v;
  }
  let mt = playing ? mp * 0.6 + Math.sqrt(ms / masterMeterBuf.length) * 1.9 : 0;
  if (mt > 1) mt = 1;
  masterLevel += (mt - masterLevel) * (mt > masterLevel ? 0.85 : 0.16);
  masterMeterFill.style.transform = "scaleX(" + masterLevel.toFixed(3) + ")";

  
  schedulePiano(pos);
  drawStage(pos);

  loopId = requestAnimationFrame(frame);
}

nowName.addEventListener("change", async () => {
  const name = nowName.value.trim();
  if (!name || !currentId) return;
  try {
    await fetch("/api/projects/" + currentId, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const p = projects.find((x) => x.id === currentId);
    if (p) p.name = name;
    crumbEl.textContent = name;
    renderProjects();
    toast("Renamed");
  } catch (e) { toast("Rename failed", "bad"); }
});

function syncStar() {
  const p = projects.find((x) => x.id === currentId);
  const on = p && p.favorite;
  starBtn.textContent = on ? "Starred" : "Star";
  starBtn.classList.toggle("on", !!on);
}
starBtn.addEventListener("click", () => {
  const p = projects.find((x) => x.id === currentId);
  if (p) toggleFavorite(p);
});

deleteBtn.addEventListener("click", async () => {
  if (!currentId) return;
  if (!confirm("Delete this project and its stems? This cannot be undone.")) return;
  const id = currentId;
  try {
    await fetch("/api/projects/" + id, { method: "DELETE" });
    projects = projects.filter((x) => x.id !== id);
    toast("Project deleted");
    goHome();
  } catch (e) { toast("Delete failed", "bad"); }
});

exportBtn.addEventListener("click", async () => {
  if (!ctx) return;
  exportBtn.textContent = "Rendering";
  exportBtn.disabled = true;
  try {
    const sr = ctx.sampleRate;
    const off = new OfflineAudioContext(2, Math.ceil(duration * sr), sr);
    const mg = off.createGain(); mg.gain.value = masterVolume; mg.connect(off.destination);
    const anySolo = STEMS.some((s) => state[s].solo);
    STEMS.forEach((s) => {
      const src = off.createBufferSource(); src.buffer = buffers[s];
      const g = off.createGain();
      let v = state[s].vol; if (state[s].mute) v = 0; if (anySolo && !state[s].solo) v = 0;
      g.gain.value = v;
      const pan = off.createStereoPanner(); pan.pan.value = state[s].pan;
      src.connect(g); g.connect(pan); pan.connect(mg); src.start(0);
    });
    const rendered = await off.startRendering();
    downloadBlob(audioBufferToWav(rendered), (nowName.value.trim() || "mix") + " (xremove mix).wav");
    toast("Mix exported", "good");
  } catch (e) { toast("Export failed", "bad"); }
  exportBtn.textContent = "Export mix";
  exportBtn.disabled = false;
});

function audioBufferToWav(buffer) {
  const numCh = buffer.numberOfChannels, len = buffer.length, sr = buffer.sampleRate;
  const blockAlign = numCh * 2, dataSize = len * blockAlign;
  const ab = new ArrayBuffer(44 + dataSize), view = new DataView(ab);
  let p = 0;
  const ws = (s) => { for (let i = 0; i < s.length; i++) view.setUint8(p++, s.charCodeAt(i)); };
  const u32 = (v) => { view.setUint32(p, v, true); p += 4; };
  const u16 = (v) => { view.setUint16(p, v, true); p += 2; };
  ws("RIFF"); u32(36 + dataSize); ws("WAVE"); ws("fmt "); u32(16); u16(1); u16(numCh);
  u32(sr); u32(sr * blockAlign); u16(blockAlign); u16(16); ws("data"); u32(dataSize);
  const chans = [];
  for (let c = 0; c < numCh; c++) chans.push(buffer.getChannelData(c));
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < numCh; c++) {
      let v = Math.max(-1, Math.min(1, chans[c][i]));
      view.setInt16(p, v < 0 ? v * 0x8000 : v * 0x7fff, true); p += 2;
    }
  }
  return new Blob([ab], { type: "audio/wav" });
}

const SHORTCUTS = [
  [["Space"], "Play / pause"],
  [["←", "→"], "Seek 5 seconds"],
  [["1", "2", "3", "4"], "Mute a stem"],
  [["L"], "Toggle loop"],
  [["M"], "Mute all"],
  [["F"], "Full mix"],
  [["P"], "Toggle Piano tab"],
  [["E"], "Export mix (WAV)"],
  [["D"], "Export MIDI"],
  [["Esc"], "Back to library"],
];
function renderShortcuts() {
  modalBody.innerHTML = "";
  SHORTCUTS.forEach(([keys, desc]) => {
    const row = document.createElement("div");
    row.className = "kb-row";
    const d = document.createElement("span"); d.className = "kb-desc"; d.textContent = desc;
    const k = document.createElement("span"); k.className = "kb-keys";
    keys.forEach((key) => { const s = document.createElement("span"); s.className = "kbd"; s.textContent = key; k.appendChild(s); });
    row.appendChild(d); row.appendChild(k); modalBody.appendChild(row);
  });
}
renderShortcuts();
shortcutsBtn.addEventListener("click", () => show(modalEl));
modalClose.addEventListener("click", () => hide(modalEl));
modalEl.addEventListener("click", (e) => { if (e.target === modalEl) hide(modalEl); });

document.addEventListener("keydown", (e) => {
  if (!modalEl.classList.contains("hidden") && e.key === "Escape") return hide(modalEl);
  if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
  if (playerEl.classList.contains("hidden")) return;
  switch (e.key) {
    case " ": e.preventDefault(); togglePlay(); break;
    case "ArrowLeft": e.preventDefault(); seekTo(position() - 5); break;
    case "ArrowRight": e.preventDefault(); seekTo(position() + 5); break;
    case "l": case "L": looping = !looping; loopBtn.classList.toggle("on", looping); break;
    case "m": case "M": quickMix(STEMS.slice()); break;
    case "f": case "F": quickMix([]); break;
    case "e": case "E": exportBtn.click(); break;
    case "p": case "P": setPlayerTab(activeTabPiano ? "studio" : "piano"); break;
    case "d": case "D": midiBtn.click(); break;
    case "Escape": goHome(); break;
    default:
      if (e.key >= "1" && e.key <= "4") {
        const s = STEMS[Number(e.key) - 1];
        state[s].mute = !state[s].mute;
        controls[s].syncRow(); applyGains();
      }
  }
});

const BLACK_PC = new Set([1, 3, 6, 8, 10]);

const SAMPLE_FILES = (() => {
  const PC = { C: 0, Ds: 3, Fs: 6, A: 9 };
  const list = [];
  const octs = { C: [1,2,3,4,5,6,7,8], Ds: [1,2,3,4,5,6,7], Fs: [1,2,3,4,5,6,7], A: [1,2,3,4,5,6,7] };
  for (const L in PC) for (const o of octs[L]) {
    list.push({ file: L + o + ".mp3", midi: 12 * (o + 1) + PC[L] });
  }
  return list.sort((a, b) => a.midi - b.midi);
})();
const SAMPLE_MIDIS = SAMPLE_FILES.map((s) => s.midi);

async function ensurePianoRaw() {
  if (pianoRaw) return pianoRaw;
  if (pianoLoading) return pianoLoading;
  pianoLoading = (async () => {
    const map = new Map();
    await Promise.all(SAMPLE_FILES.map(async (s) => {
      try {
        const r = await fetch("/piano/" + s.file);
        if (r.ok) map.set(s.midi, await r.arrayBuffer());
      } catch (e) {}
    }));
    pianoRaw = map;
    return map;
  })();
  return pianoLoading;
}

function makeReverbIR(seconds, decay) {
  const rate = ctx.sampleRate, len = Math.floor(rate * seconds);
  const ir = ctx.createBuffer(2, len, rate);
  for (let c = 0; c < 2; c++) {
    const ch = ir.getChannelData(c);
    for (let i = 0; i < len; i++) {
      ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return ir;
}

async function buildPianoForCtx() {
  await ensurePianoRaw();
  pianoBuf = new Map();
  await Promise.all([...pianoRaw.entries()].map(async ([midi, ab]) => {
    try { pianoBuf.set(midi, await ctx.decodeAudioData(ab.slice(0))); } catch (e) {}
  }));
  
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -20; comp.knee.value = 26; comp.ratio.value = 2.6;
  comp.attack.value = 0.004; comp.release.value = 0.25;
  comp.connect(masterGain);
  pianoDry = ctx.createGain(); pianoDry.gain.value = 0;
  pianoWet = ctx.createGain(); pianoWet.gain.value = 0;
  const conv = ctx.createConvolver();
  conv.buffer = makeReverbIR(3.4, 2.2);
  pianoWet.connect(conv); conv.connect(comp);
  pianoDry.connect(comp);
}

function nearestSample(midi) {
  let best = SAMPLE_MIDIS[0], bd = 1e9;
  for (const m of SAMPLE_MIDIS) { const d = Math.abs(m - midi); if (d < bd) { bd = d; best = m; } }
  return best;
}

function playPiano(midi, when, dur, vel) {
  if (!pianoBuf) return;
  const sm = nearestSample(midi);
  const buf = pianoBuf.get(sm);
  if (!buf) return;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = Math.pow(2, (midi - sm) / 12);
  
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass"; lp.Q.value = 0.2;
  lp.frequency.value = 1500 + vel * vel * 9000;
  const env = ctx.createGain();
  const v = 0.12 + 0.88 * Math.min(1, vel);
  const peak = Math.max(0.02, v);
  env.gain.setValueAtTime(0.0001, when);
  env.gain.exponentialRampToValueAtTime(peak, when + 0.006);   
  const hold = Math.max(0.16, dur);
  env.gain.setValueAtTime(peak, when + hold);
  env.gain.exponentialRampToValueAtTime(0.0006, when + hold + 0.5);
  
  const pan = ctx.createStereoPanner();
  pan.pan.value = Math.max(-0.6, Math.min(0.6, (midi - 60) / 38));
  src.connect(lp); lp.connect(env); env.connect(pan);
  pan.connect(pianoDry); pan.connect(pianoWet);
  src.start(when);
  src.stop(when + hold + 0.7);
}

function buildKeyLayout() {
  const whites = [];
  for (let p = LOW; p <= HIGH; p++) if (!BLACK_PC.has(p % 12)) whites.push(p);
  const W = whites.length, ww = 1 / W;
  const wi = {}; whites.forEach((p, i) => (wi[p] = i));
  keyLayout = {};
  for (let p = LOW; p <= HIGH; p++) {
    if (!BLACK_PC.has(p % 12)) {
      const x = wi[p] * ww;
      keyLayout[p] = { x, w: ww, cx: x + ww / 2, black: false };
    } else {
      const cx = (wi[p - 1] + 1) * ww;          
      const w = ww * 0.62;
      keyLayout[p] = { x: cx - w / 2, w, cx, black: true };
    }
  }
}

let ST = null;
function resizeStage() {
  if (!stageEl.clientWidth) return;
  const dpr = window.devicePixelRatio || 1;
  const w = stageEl.clientWidth, h = stageEl.clientHeight;
  const kbH = Math.max(92, Math.min(210, h * 0.27));   
  rollCanvas.width = w * dpr; rollCanvas.height = h * dpr;
  keysCanvas.style.height = kbH + "px";
  keysCanvas.width = w * dpr; keysCanvas.height = kbH * dpr;
  ST = { w, h, kbH, hitY: h - kbH, dpr };
}

let midiPollTimer = null;
async function loadNotes(pid) {
  notesReady = false; notesFlat = [];
  clearInterval(midiPollTimer);
  show(stageOverlay);
  overlayTitle.textContent = "Transcribing piano…";
  overlaySub.textContent = "high-resolution model on your GPU — first time for this track";
  midiFill.style.width = "0%";

  const tick = async () => {
    let d;
    try { d = await (await fetch("/api/piano/" + pid)).json(); }
    catch (e) { return; }
    if (d.status === "done") {
      clearInterval(midiPollTimer);
      songBpm = d.bpm || 120;
      ingestPiano(d.notes);
      hide(stageOverlay);
    } else if (d.status === "error") {
      clearInterval(midiPollTimer);
      overlayTitle.textContent = "Transcription unavailable";
      overlaySub.textContent = "you can still mix and export audio";
    } else {
      midiFill.style.width = (d.progress || 0) + "%";
    }
  };
  await tick();
  if (!notesReady) midiPollTimer = setInterval(tick, 800);
}

function ingestPiano(notes) {
  notesFlat = (notes || [])
    .filter((n) => n.p >= LOW && n.p <= HIGH)
    .map((n, i) => ({ s: n.s, e: n.e, p: n.p, v: n.v, hand: n.hand, id: i }));
  notesFlat.sort((a, b) => a.s - b.s);
  notesReady = true;
  resetPiano(position());
}

function resetPiano(ct) {
  let i = 0; while (i < notesFlat.length && notesFlat[i].s < ct) i++;
  pianoPtr = i;
  schedCt = ct;
}
function schedulePiano(ct) {
  if (!pianoMode || !playing || !notesReady || !pianoBuf) { schedCt = ct; return; }
  if (ct < schedCt - 0.05 || ct > schedCt + 0.6) resetPiano(ct);   
  const ahead = ct + 0.12;
  let i = pianoPtr;
  while (i < notesFlat.length && notesFlat[i].s <= ahead) {
    const n = notesFlat[i];
    if (n.s >= schedCt - 0.02) {
      const when = startedAt + (n.s - offset) / rate;
      playPiano(n.p, Math.max(ctx.currentTime, when), (n.e - n.s) / rate, n.v);
    }
    i++;
  }
  pianoPtr = i;
  schedCt = ct;
}

let lastStageTs = 0;
function drawStage(ct) {
  if (!activeTabPiano) return;          
  if ((!ST || !ST.h) && stageEl.clientHeight) resizeStage();
  if (!ST || !keyLayout || !notesReady) return;
  const now = performance.now();
  let dt = (now - lastStageTs) / 1000; lastStageTs = now;
  if (!isFinite(dt) || dt > 0.1) dt = 0.016;

  const g = rollCanvas.getContext("2d");
  g.setTransform(ST.dpr, 0, 0, ST.dpr, 0, 0);
  g.clearRect(0, 0, ST.w, ST.h);
  const W = ST.w, hitY = ST.hitY;

  
  g.strokeStyle = "rgba(255,255,255,.035)"; g.lineWidth = 1;
  for (let p = LOW; p <= HIGH; p++) {
    if (p % 12 === 0) { const x = keyLayout[p].x * W + 0.5; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, hitY); g.stroke(); }
  }
  
  if (songBpm) {
    const beat = 60 / songBpm;
    for (let t = Math.ceil(ct / beat) * beat; t < ct + LOOKAHEAD; t += beat) {
      const y = hitY * (1 - (t - ct) / LOOKAHEAD);
      g.strokeStyle = Math.round(t / beat) % 4 === 0 ? "rgba(255,255,255,.07)" : "rgba(255,255,255,.028)";
      g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
    }
  }

  
  for (const p in keyState) { keyState[p].energy *= Math.pow(0.0022, dt); if (keyState[p].energy < 0.01) delete keyState[p]; }

  
  g.globalCompositeOperation = "lighter";
  for (const p in keyState) {
    const k = keyLayout[p], en = keyState[p].energy; if (!k) continue;
    const cx = k.cx * W, bw = k.w * W * 1.5;
    const grad = g.createLinearGradient(0, hitY * 0.25, 0, hitY);
    grad.addColorStop(0, "rgba(196,216,255,0)");
    grad.addColorStop(1, "rgba(202,224,255," + (0.26 * en).toFixed(3) + ")");
    g.fillStyle = grad; g.fillRect(cx - bw / 2, hitY * 0.25, bw, hitY * 0.75);
  }
  g.globalCompositeOperation = "source-over";

  
  const band = g.createLinearGradient(0, hitY - 46, 0, hitY);
  band.addColorStop(0, "rgba(184,208,255,0)"); band.addColorStop(1, "rgba(184,208,255,.10)");
  g.fillStyle = band; g.fillRect(0, hitY - 46, W, 46);
  g.save();
  g.shadowColor = "rgba(200,222,255,.9)"; g.shadowBlur = 14;
  g.fillStyle = "rgba(232,242,255,.85)"; g.fillRect(0, hitY - 1.5, W, 2.4);
  g.restore();

  
  for (let i = 0; i < notesFlat.length; i++) {
    const n = notesFlat[i];
    if (n.e < ct - 0.4) continue;
    if (n.s > ct + LOOKAHEAD) break;            
    const k = keyLayout[n.p]; if (!k) continue;
    let yB = hitY * (1 - (n.s - ct) / LOOKAHEAD);
    let yT = hitY * (1 - (n.e - ct) / LOOKAHEAD);
    if (yT > hitY || yB < 0) continue;
    if (yB > hitY) yB = hitY;                   
    const h = Math.max(3, yB - yT);
    const noteW = k.w * W * (k.black ? 0.78 : 0.9);
    const x = k.cx * W - noteW / 2;
    const r = Math.min(noteW * 0.34, 7);
    const active = ct >= n.s - 0.02 && ct <= n.e;

    if (ct >= n.s && lastFlashAt[n.id] === undefined && ct - n.s < 0.25) {
      lastFlashAt[n.id] = ct; spawnHit(k.cx * W, hitY, n.v);
    }

    
    if (active) {
      g.save();
      g.shadowColor = "rgba(206,226,255,.95)"; g.shadowBlur = 16 + n.v * 20;
      g.fillStyle = "rgba(255,255,255,.16)";
      roundRect(g, x, yT, noteW, h, r); g.fill();
      g.restore();
    }
    
    const grad = g.createLinearGradient(0, yT, 0, yB);
    grad.addColorStop(0, "rgba(255,255,255," + (active ? 0.97 : 0.74) + ")");
    grad.addColorStop(0.5, "rgba(216,226,247," + (active ? 0.6 : 0.32) + ")");
    grad.addColorStop(1, "rgba(255,255,255," + (active ? 0.5 : 0.13) + ")");
    g.fillStyle = grad; roundRect(g, x, yT, noteW, h, r); g.fill();
    
    g.lineWidth = 1; g.strokeStyle = "rgba(255,255,255," + (active ? 0.95 : 0.4) + ")";
    roundRect(g, x + 0.5, yT + 0.5, noteW - 1, h - 1, r); g.stroke();
    
    if (h > 6) {
      g.fillStyle = "rgba(255,255,255,.9)";
      roundRect(g, x + 1.6, yT + 1.6, noteW - 3.2, 2.2, 1.4); g.fill();
      g.fillStyle = "rgba(255,255,255,.22)";
      g.fillRect(x + 1.6, yT + 3, 1.4, Math.max(0, h - 5));
    }
  }

  
  g.globalCompositeOperation = "lighter";
  for (let i = particles.length - 1; i >= 0; i--) {
    const pt = particles[i];
    pt.life -= dt; if (pt.life <= 0) { particles.splice(i, 1); continue; }
    pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vy += 240 * dt;
    const a = Math.max(0, pt.life / pt.max);
    g.fillStyle = "rgba(225,238,255," + a.toFixed(3) + ")";
    g.beginPath(); g.arc(pt.x, pt.y, pt.size * a + 0.5, 0, 7); g.fill();
  }
  
  for (const p in keyState) {
    const k = keyLayout[p], en = keyState[p].energy; if (!k || en < 0.05) continue;
    const cx = k.cx * W, rad = (k.w * W) * (1.4 + en);
    const rg = g.createRadialGradient(cx, hitY, 0, cx, hitY, rad);
    rg.addColorStop(0, "rgba(220,235,255," + (0.5 * en).toFixed(3) + ")");
    rg.addColorStop(1, "rgba(220,235,255,0)");
    g.fillStyle = rg; g.beginPath(); g.arc(cx, hitY, rad, 0, 7); g.fill();
  }
  g.globalCompositeOperation = "source-over";

  drawKeys(ct);
}

function spawnHit(x, y, vel) {
  const n = 7 + Math.floor(vel * 10);
  for (let i = 0; i < n; i++) {
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.8;
    const sp = 70 + Math.random() * 200 * (0.5 + vel);
    const life = 0.35 + Math.random() * 0.55;
    particles.push({ x: x + (Math.random() - 0.5) * 6, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
      life, max: life, size: 1.2 + Math.random() * 2.6 });
  }
  if (particles.length > 700) particles.splice(0, particles.length - 700);
}

function drawKeys(ct) {
  const g = keysCanvas.getContext("2d");
  const W = ST.w, H = ST.kbH;
  g.setTransform(ST.dpr, 0, 0, ST.dpr, 0, 0);
  g.clearRect(0, 0, W, H);

  
  for (let i = 0; i < notesFlat.length; i++) {
    const n = notesFlat[i];
    if (n.s > ct) break;
    if (ct >= n.s - 0.02 && ct <= n.e) {
      const e = 0.6 + 0.4 * n.v;
      const cur = keyState[n.p];
      if (!cur || cur.energy < e) keyState[n.p] = { energy: 1, color: "#ffffff" };
    }
  }

  
  for (let p = LOW; p <= HIGH; p++) {
    const k = keyLayout[p]; if (k.black) continue;
    const x = k.x * W, w = k.w * W;
    const en = keyState[p] ? keyState[p].energy : 0;
    if (en > 0.02) { g.shadowColor = "rgba(200,222,255,.95)"; g.shadowBlur = 28 * en; } else g.shadowBlur = 0;
    const grad = g.createLinearGradient(0, 0, 0, H);
    if (en > 0.02) { grad.addColorStop(0, "#ffffff"); grad.addColorStop(1, mixBlueWhite(en)); }
    else { grad.addColorStop(0, "#eef1f6"); grad.addColorStop(0.5, "#dfe3ec"); grad.addColorStop(1, "#c7ccd7"); }
    g.fillStyle = grad;
    roundRectBottom(g, x + 0.5, 0, w - 1, H, 7); g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = "rgba(0,0,0,.30)"; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); g.stroke();
  }
  
  const sh = g.createLinearGradient(0, 0, 0, H);
  sh.addColorStop(0, "rgba(0,0,0,.25)"); sh.addColorStop(0.13, "rgba(0,0,0,0)");
  sh.addColorStop(0.9, "rgba(0,0,0,0)"); sh.addColorStop(1, "rgba(0,0,0,.18)");
  g.fillStyle = sh; g.fillRect(0, 0, W, H);

  
  for (let p = LOW; p <= HIGH; p++) {
    const k = keyLayout[p]; if (!k.black) continue;
    const x = k.x * W, w = k.w * W, h = H * 0.63;
    const en = keyState[p] ? keyState[p].energy : 0;
    if (en > 0.02) { g.shadowColor = "rgba(200,222,255,.95)"; g.shadowBlur = 24 * en; }
    const grad = g.createLinearGradient(0, 0, 0, h);
    if (en > 0.02) { grad.addColorStop(0, "#eef4ff"); grad.addColorStop(1, mixBlueWhite(en)); }
    else { grad.addColorStop(0, "#2c2c34"); grad.addColorStop(0.5, "#17171d"); grad.addColorStop(1, "#0a0a0e"); }
    g.fillStyle = grad;
    roundRectBottom(g, x, 0, w, h, 4); g.fill();
    g.shadowBlur = 0;
    if (en <= 0.02) { g.fillStyle = "rgba(255,255,255,.12)"; roundRectBottom(g, x + 1, 1, w - 2, h * 0.4, 3); g.fill(); }
  }
  
  const gl = g.createLinearGradient(0, -6, 0, 7);
  gl.addColorStop(0, "rgba(255,255,255,0)"); gl.addColorStop(1, "rgba(210,228,255,.22)");
  g.fillStyle = gl; g.fillRect(0, 0, W, 6);
}

function mixBlueWhite(en) {
  const b = Math.round(225 + 30 * Math.min(1, en));
  return "rgb(" + Math.min(255, b - 8) + "," + Math.min(255, b - 2) + ",255)";
}

function roundRect(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r); g.closePath();
}
function roundRectBottom(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w, y + h - r);
  g.arcTo(x + w, y + h, x + w - r, y + h, r); g.lineTo(x + r, y + h);
  g.arcTo(x, y + h, x, y + h - r, r); g.closePath();
}
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a.toFixed(3) + ")";
}

async function setPianoMode(on) {
  pianoMode = on;
  if (on) {
    if (!ctx) return;
    overlaySub.textContent = "loading grand piano…";
    if (!pianoBuf) { try { await buildPianoForCtx(); } catch (e) { toast("Piano samples failed", "bad"); } }
    resetPiano(position());
  }
  applyGains();
  if (pianoDry) {
    const t = ctx.currentTime;
    pianoDry.gain.setTargetAtTime(on ? 0.9 : 0, t, 0.04);
    pianoWet.gain.setTargetAtTime(on ? 0.32 : 0, t, 0.04);
  }
}

let currentTab = "studio";
function setPlayerTab(tab) {
  currentTab = tab;
  activeTabPiano = tab === "piano";
  playerTabs.querySelectorAll(".ptab").forEach((b) =>
    b.classList.toggle("on", b.dataset.ptab === tab));
  studioView.classList.toggle("hidden", tab !== "studio");
  pianoView.classList.toggle("hidden", tab !== "piano");
  sheetsView.classList.toggle("hidden", tab !== "sheets");
  setPianoMode(tab === "piano");     
  if (tab === "piano") resizeStage();
  if (tab === "sheets") loadSheet(sheetPart);
}
playerTabs.addEventListener("click", (e) => {
  const b = e.target.closest(".ptab");
  if (b) setPlayerTab(b.dataset.ptab);
});

let osmd = null;
let sheetPart = "piano";
let sheetReq = 0;
async function loadSheet(part) {
  sheetPart = part;
  sheetParts.querySelectorAll(".spart").forEach((b) => b.classList.toggle("on", b.dataset.part === part));
  if (!currentId) return;
  const my = ++sheetReq;
  show(sheetOverlay); sheetMsg.textContent = "Engraving…";
  try {
    const res = await fetch("/api/sheet/" + currentId + "/" + part);
    if (my !== sheetReq || currentTab !== "sheets") return;
    if (res.status === 202) {
      sheetMsg.textContent = "Transcribing stems first…";
      setTimeout(() => { if (my === sheetReq && currentTab === "sheets") loadSheet(part); }, 1300);
      return;
    }
    if (!res.ok) { sheetMsg.textContent = "Sheet unavailable"; return; }
    const xml = await res.text();
    if (my !== sheetReq) return;
    if (!osmd) {
      osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay(sheetHost, {
        autoResize: true, backend: "svg", drawTitle: true, drawSubtitle: false,
        drawPartNames: false, drawingParameters: "default",
      });
    }
    await osmd.load(xml);
    if (my !== sheetReq || currentTab !== "sheets") return;
    osmd.render();
    hide(sheetOverlay);
  } catch (e) {
    if (my === sheetReq) sheetMsg.textContent = "Sheet failed to load";
  }
}
sheetParts.addEventListener("click", (e) => {
  const b = e.target.closest(".spart");
  if (b) loadSheet(b.dataset.part);
});
sheetDl.addEventListener("click", () => {
  if (!currentId) return;
  const a = document.createElement("a");
  a.href = "/api/sheet/" + currentId + "/" + sheetPart;
  a.download = (nowName.value.trim() || "sheet") + " - " + sheetPart + ".musicxml";
  document.body.appendChild(a); a.click(); a.remove();
});
sheetMidiBtn.addEventListener("click", () => midiBtn.click());

midiBtn.addEventListener("click", () => {
  if (!currentId) return;
  toast("Preparing MIDI…");
  const a = document.createElement("a");
  a.href = "/api/midi/" + currentId;
  a.download = (nowName.value.trim() || "mix") + ".mid";
  document.body.appendChild(a); a.click(); a.remove();
});

window.addEventListener("resize", () => { if (!playerEl.classList.contains("hidden")) resizeStage(); });

buildKeyLayout();
loadProjects();
showView(homeEl);
