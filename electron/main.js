"use strict";

const { app, BrowserWindow, shell, dialog } = require("electron");
const { spawn } = require("child_process");
const http = require("http");
const path = require("path");
const fs = require("fs");

const PORT = 8000;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const isPackaged = app.isPackaged;

const ROOT = isPackaged ? process.resourcesPath : path.join(__dirname, "..");

let backend = null;          
let splash = null;
let win = null;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });
}
app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");

if (process.platform === "win32") app.setAppUserModelId("com.c7s89r.xremove");

function backendCommand() {
  
  const exe = path.join(ROOT, "backend-dist", "xremove-backend", "xremove-backend.exe");
  if (fs.existsSync(exe)) return { cmd: exe, args: [], cwd: ROOT };

  
  const venvPy = path.join(ROOT, "venv", "Scripts", "python.exe");
  const uvicorn = ["-m", "uvicorn", "backend.app:app", "--host", "127.0.0.1", "--port", String(PORT)];
  if (fs.existsSync(venvPy)) return { cmd: venvPy, args: uvicorn, cwd: ROOT };

  
  return { cmd: process.platform === "win32" ? "python" : "python3", args: uvicorn, cwd: ROOT };
}

function ping() {
  return new Promise((resolve) => {
    const req = http.get(`${BASE_URL}/api/health`, (res) => {
      let body = "";
      res.on("data", (d) => (body += d));
      res.on("end", () => { try { resolve(JSON.parse(body)); } catch { resolve(null); } });
    });
    req.on("error", () => resolve(null));
    req.setTimeout(1500, () => { req.destroy(); resolve(null); });
  });
}

async function waitForBackend(onStatus, timeoutMs = 180000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const h = await ping();
    if (h) return h;
    onStatus && onStatus();
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

function startBackend() {
  const { cmd, args, cwd } = backendCommand();
  console.log("[xremove] backend:", cmd, args.join(" "));

  
  
  
  let dataHome = ROOT;
  if (isPackaged) {
    dataHome = app.getPath("userData");
    try { fs.cpSync(path.join(ROOT, "static"), path.join(dataHome, "static"), { recursive: true }); }
    catch (e) { console.log("[xremove] static copy failed", e); }
  }

  
  const binDir = path.join(ROOT, "bin");
  const env = Object.assign({}, process.env, {
    XREMOVE_HOME: dataHome,
    PATH: binDir + path.delimiter + (process.env.PATH || ""),
  });
  backend = spawn(cmd, args, { cwd, env, windowsHide: true });
  backend.stdout.on("data", (d) => process.stdout.write("[backend] " + d));
  backend.stderr.on("data", (d) => process.stderr.write("[backend] " + d));
  backend.on("exit", (code) => {
    console.log("[xremove] backend exited", code);
    backend = null;
  });
}

function stopBackend() {
  if (!backend) return;
  try {
    if (process.platform === "win32") spawn("taskkill", ["/pid", String(backend.pid), "/f", "/t"]);
    else backend.kill("SIGTERM");
  } catch (e) {}
  backend = null;
}

function createSplash() {
  splash = new BrowserWindow({
    width: 460, height: 300, frame: false, resizable: false,
    transparent: false, backgroundColor: "#0c0c13", show: true,
    center: true, alwaysOnTop: true,
    webPreferences: { contextIsolation: true },
  });
  splash.loadFile(path.join(__dirname, "splash.html"));
}

function createMain() {
  win = new BrowserWindow({
    width: 1320, height: 860, minWidth: 1040, minHeight: 680,
    backgroundColor: "#0c0c13", show: false, autoHideMenuBar: true,
    title: "xremove",
    icon: path.join(__dirname, "..", "build", "icon.png"),
    webPreferences: { contextIsolation: true, preload: path.join(__dirname, "preload.js") },
  });
  win.loadURL(BASE_URL);
  win.once("ready-to-show", () => {
    if (splash) { splash.destroy(); splash = null; }
    win.show();
  });
  
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) { shell.openExternal(url); return { action: "deny" }; }
    return { action: "allow" };
  });
}

function setSplash(stage, detail) {
  if (splash && !splash.isDestroyed()) {
    splash.webContents.executeJavaScript(
      `window.setStatus && window.setStatus(${JSON.stringify(stage)}, ${JSON.stringify(detail || "")})`
    ).catch(() => {});
  }
}

app.whenReady().then(async () => {
  createSplash();
  setSplash("Starting engine…", "");

  // attach to an already-running dev server if there is one, else spawn
  let health = await ping();
  if (!health) { startBackend(); health = await waitForBackend(() => setSplash("Starting engine…", "loading models")); }

  if (!health) {
    dialog.showErrorBox("xremove", "The audio engine failed to start.\nMake sure Python and the venv are installed (run.bat once).");
    app.quit();
    return;
  }

  
  if (health.cuda) setSplash("GPU ready", `CUDA ${health.cuda_version || ""} · ${health.gpu}`);
  else setSplash("CPU mode", "no CUDA GPU detected — separation will be slower");
  await new Promise((r) => setTimeout(r, health.cuda ? 700 : 1600));

  createMain();
});

app.on("window-all-closed", () => { stopBackend(); app.quit(); });
app.on("before-quit", stopBackend);
process.on("exit", stopBackend);
