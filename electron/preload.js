"use strict";

const { contextBridge } = require("electron");
contextBridge.exposeInMainWorld("xremove", { desktop: true, version: process.versions.electron });
