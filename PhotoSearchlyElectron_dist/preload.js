'use strict';

/**
 * preload.js — Runs in the renderer process before page content loads.
 * Exposes a safe, limited API to the web page via contextBridge.
 * Never expose full Node.js APIs here.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getVersion: () => ipcRenderer.invoke('app:version'),
  getPlatform: () => ipcRenderer.invoke('app:platform'),

  // Get bundled model file paths (returns { imageModel, textModel, modelsDir })
  getModelPaths: () => ipcRenderer.invoke('models:getPaths'),
  // Read a model file as base64 (for loading ONNX models from disk)
  readModelFile: (filePath) => ipcRenderer.invoke('models:readFile', filePath),

  // Select folder via native dialog, returns { folderPath, files: [{absolutePath, filename, size, lastModified}] }
  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),

  // Read a file as base64 for CLIP processing
  readFileAsBase64: (absolutePath) => ipcRenderer.invoke('file:readAsBase64', absolutePath),

  // Delete a local file from disk (returns { success, error })
  deleteLocalFile: (filePath) => ipcRenderer.invoke('file:delete', filePath),

  // Open file location in OS file explorer
  showItemInFolder: (filePath) => ipcRenderer.invoke('shell:showItemInFolder', filePath),
  openPath: (folderPath) => ipcRenderer.invoke('shell:openPath', folderPath),

  // Python fast-indexing backend
  pythonGetPort:   () => ipcRenderer.invoke('python:getPort'),
  pythonIsReady:   () => ipcRenderer.invoke('python:isReady'),

  // Let the renderer know it's running inside Electron
  isElectron: true,
});
