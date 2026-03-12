# How to Build Searchly AI

## Quick Start (Windows)

```powershell
# 1. Install dependencies
npm install

# 2. Download AI models (170 MB + 250 MB — only needed once)
npm run download-models

# 3. Build the Windows installer
npm run build:win
```

That's it! Step 2 runs automatically when you run `build:win`, but you can also run it manually.

## What `download-models` does
Downloads the two CLIP ONNX model files into `build/models/`:
- `clip-image-vit-32-float32.onnx` (~170 MB)
- `clip-text-vit-32-float32-int32.onnx` (~250 MB)

These get **bundled inside the installer** as `resources/models/`. When users install the app, the models are already on their PC — no waiting on first launch.

## Dev mode (without building)
```powershell
npm run download-models   # one time
npm start                 # models load from build/models/
```

## Outputs
After `npm run build:win`:
- `dist/Searchly-AI-Setup-1.1.0.exe` — NSIS installer (~450 MB with models)
- `dist/Searchly-AI-Portable-1.1.0.exe` — portable version

## Microsoft Store
```powershell
npm run build:store       # produces MSIX
```
