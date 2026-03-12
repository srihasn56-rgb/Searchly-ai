<div align="center">

<img src="assets/icon.png" width="120" alt="Searchly AI Logo" />

# Searchly AI

**Find any photo by describing it — powered by OpenAI CLIP, running 100% on your device.**

[![Release](https://img.shields.io/github/v/release/your-github-username/searchly-ai?style=flat-square&color=3b82f6)](https://github.com/your-github-username/searchly-ai/releases)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE.txt)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey?style=flat-square)](https://github.com/your-github-username/searchly-ai/releases)
[![Electron](https://img.shields.io/badge/built%20with-Electron-47848F?style=flat-square&logo=electron)](https://www.electronjs.org/)

[⬇️ Download for Windows](https://github.com/your-github-username/searchly-ai/releases/latest) · [Microsoft Store](https://apps.microsoft.com) · [Report a Bug](https://github.com/your-github-username/searchly-ai/issues)

</div>

---

## What is Searchly AI?

Searchly AI lets you search through thousands of photos using plain English — no tags, no folders, no manual organization needed.

Type **"sunset at the beach"**, **"birthday cake with candles"**, or **"red car on a highway"** and it instantly finds matching photos from your local folders or Google Drive.

All AI processing happens **entirely on your device**. Your photos never leave your computer.

---

## Features

- **Natural Language Search** — Search with descriptions like "dog playing in snow"
- **On-Device AI** — OpenAI CLIP model runs locally via ONNX Runtime — no cloud, no subscriptions
- **Local Folder Search** — Pick any folder from your computer
- **Google Drive** — Search photos directly from your Drive
- **Progressive Search** — Start searching after the first batch, even while indexing
- **Image Viewer** — Zoom, download, and share photos in-app
- **Bulk Delete** — Select and delete multiple photos at once
- **Privacy First** — Zero data sent to any server — 100% local AI inference
- **Desktop Native** — Built with Electron — works on Windows, macOS, and Linux

---

## Download

**Windows**

- [Searchly-AI-Setup-1.0.0.exe](https://github.com/your-github-username/searchly-ai/releases/latest) — Full installer (recommended)
- [Searchly-AI-Portable-1.0.0.exe](https://github.com/your-github-username/searchly-ai/releases/latest) — No install needed
- [Microsoft Store](https://apps.microsoft.com) — Auto-updates, sandboxed

macOS and Linux: build from source (instructions below).

---

## Build From Source

**Prerequisites:** Node.js v18+, Windows/macOS/Linux

```bash
git clone https://github.com/your-github-username/searchly-ai.git
cd searchly-ai
npm install
cp .env.example .env
# Edit .env with your Google CLIENT_ID and CLIENT_SECRET
npm run dev
```

**Build installers:**

```bash
npm run build:win      # Windows .exe installer + portable
npm run build:store    # Windows MSIX for Microsoft Store
npm run build:mac      # macOS .dmg
npm run build:linux    # Linux .AppImage + .deb
```

---

## Google Drive Setup (Optional)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. APIs & Services → Credentials → Create OAuth 2.0 Client ID → Desktop app
3. Add `http://localhost:5500/oauth2callback` to Authorized Redirect URIs
4. Copy CLIENT_ID and CLIENT_SECRET to your .env file

---

## Privacy

- No image data is ever transmitted — CLIP runs entirely in-app
- No analytics or telemetry
- Google tokens stored in memory only — cleared on close
- No account required — works fully offline for local search

Full [Privacy Policy](https://your-github-username.github.io/searchly-ai/privacy).

---

## Contributing

Contributions welcome! Fork the repo, create a feature branch, and open a Pull Request.

---

## License

MIT License — see [LICENSE.txt](LICENSE.txt)

Made with love by [Proliant Data](https://proliantdata.com)
