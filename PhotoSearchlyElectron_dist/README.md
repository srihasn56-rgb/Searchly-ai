# Searchly AI

**Find any photo by describing it — powered by OpenAI CLIP, running 100% on your device.**

[![Release](https://img.shields.io/github/v/release/srihasn56-rgb/Searchly-ai?style=flat-square&color=3b82f6)](https://github.com/srihasn56-rgb/Searchly-ai/releases)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](https://github.com/srihasn56-rgb/Searchly-ai/blob/main/LICENSE.txt)
[![Platform](https://img.shields.io/badge/platform-Windows-lightgrey?style=flat-square)](https://github.com/srihasn56-rgb/Searchly-ai/releases)
[![Built with Electron](https://img.shields.io/badge/built%20with-Electron-47848F?style=flat-square&logo=electron)](https://www.electronjs.org/)

[⬇️ Download for Windows](https://github.com/srihasn56-rgb/Searchly-ai/releases/latest) · [Report a Bug](https://github.com/srihasn56-rgb/Searchly-ai/issues)

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
- **Google Drive Integration** — Search photos directly from your Google Drive
- **Progressive Search** — Start searching after the first batch, even while indexing continues
- **Image Viewer** — Zoom, download, and share photos in-app
- **Bulk Delete** — Select and delete multiple photos at once
- **Privacy First** — Zero data sent to any server — 100% local AI inference
- **Desktop Native** — Built with Electron for a smooth native experience

---

## Download

### Windows

👉 [Searchly-AI-Setup-1.0.1.exe](https://github.com/srihasn56-rgb/Searchly-ai/releases/latest) — Full installer (recommended)

### macOS

👉 [Searchly AI-1.0.0-arm64.dmg](https://github.com/srihasn56-rgb/Searchly-ai/releases/latest) — Apple Silicon (M1/M2/M3)
👉 [Searchly AI-1.0.0.dmg](https://github.com/srihasn56-rgb/Searchly-ai/releases/latest) — Intel Mac

> **macOS note:** If you see _"app can't be opened because it's from an unidentified developer"_, right-click the app → Open → Open anyway.

> Linux: build from source (see instructions below)

---

## Build From Source

**Prerequisites:** Node.js v18+, Python 3.10+, Windows/macOS/Linux

```bash
git clone https://github.com/srihasn56-rgb/Searchly-ai.git
cd Searchly-ai
npm install
cp .env.example .env
# Edit .env with your Google CLIENT_ID and CLIENT_SECRET
npm run dev
```

### Build Installers

```bash
npm run build:win      # Windows .exe installer
npm run build:mac      # macOS .dmg (requires Mac)
npm run build:linux    # Linux .AppImage + .deb
```

---

## Google Drive Setup (Optional)

To enable Google Drive photo search:

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to **APIs & Services → Credentials**
3. Create an **OAuth 2.0 Client ID** → Desktop app
4. Add `http://localhost:5500/oauth2callback` to **Authorized Redirect URIs**
5. Copy `CLIENT_ID` and `CLIENT_SECRET` into your `.env` file

---

## How It Works

Searchly AI uses **OpenAI CLIP** (via ONNX Runtime) to generate semantic embeddings for your photos at indexing time. When you type a search query, the same model encodes your text and finds visually similar images using cosine similarity — all running locally with no internet required.

```
Your Photos → CLIP (ONNX) → Embeddings → Stored Locally
Your Query  → CLIP (ONNX) → Embedding  → Similarity Search → Results
```

---

## Privacy

- No image data is ever transmitted — CLIP runs entirely on-device
- No analytics or telemetry of any kind
- Google OAuth tokens stored in memory only — cleared on app close
- No account required — works fully offline for local folder search

Full [Privacy Policy](https://srihasn56-rgb.github.io/Searchly-ai/public/privacy.html).

---

## Tech Stack

| Layer         | Technology                     |
| ------------- | ------------------------------ |
| Desktop Shell | Electron                       |
| AI Model      | OpenAI CLIP via ONNX Runtime   |
| Backend       | Python (Flask)                 |
| Packaging     | PyInstaller + Electron Builder |
| Auth          | Google OAuth 2.0               |

---

## Contributing

Contributions are welcome! Fork the repo, create a feature branch, and open a Pull Request.

---

## License

MIT License — see [LICENSE.txt](LICENSE.txt)

---

_Made with ❤️ by [Proliant Data](https://www.proliantdatallc.com/)_
