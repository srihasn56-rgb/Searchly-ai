# Searchly AI — Microsoft Store Submission Guide

## Step 1 — Register as a Developer
1. Go to https://partner.microsoft.com/dashboard
2. Sign in with your Microsoft account
3. Click "Get started" under Windows & Xbox
4. Pay the one-time $19 registration fee
5. Your account will be verified within 1-2 business days

---

## Step 2 — Build the MSIX Package
In your project folder (as Administrator):
```
npm run build:store
```
This creates: `dist/Searchly-AI-1.0.0.msix`

---

## Step 3 — Create a New App Submission

In Partner Center:
1. Go to **Apps and Games → + New product → MSIX or PWA app**
2. Reserve your app name: **Searchly AI**
3. Click **Start submission**

---

## Step 4 — Fill In Each Section

### Pricing and availability
- Price: **Free**
- Markets: Select All (or choose specific markets)
- Visibility: **Public**

---

### Properties
| Field | Value |
|---|---|
| Category | **Photo & video** |
| Subcategory | Photo viewer & editor |
| Does it access user files? | Yes — local photos (with permission) |
| Hardware requirements | None |
| Privacy policy URL | `https://your-github-username.github.io/searchly-ai/privacy` |

---

### Age ratings
Complete the IARC questionnaire:
- No violence, no adult content, no in-app purchases → Rating: **Everyone**

---

### Store listing (English - United States)

**App name:**
```
Searchly AI — Natural Language Photo Search
```

**Short description (under 200 characters):**
```
Find any photo by describing it. AI-powered natural language search for your local photos and Google Drive — 100% private, runs on your device.
```

**Description (copy this in full):**
```
Searchly AI lets you search through thousands of photos using plain English — no more scrolling through folders or guessing filenames.

Just type what you're looking for: "sunset at the beach", "birthday party with balloons", or "my dog playing in snow" — and Searchly AI instantly finds your matching photos.

HOW IT WORKS
Searchly AI uses OpenAI's CLIP model, a state-of-the-art AI that understands both images and text. It processes your photos entirely on your device — no uploads, no subscriptions, no cloud processing.

FEATURES
• Natural Language Search — describe photos in plain English and find them instantly
• 100% On-Device AI — OpenAI CLIP runs locally using ONNX Runtime, your photos never leave your computer
• Local Folder Search — search any folder on your PC
• Google Drive Integration — connect your Drive and search cloud photos too
• Progressive Search — start searching after the first batch while the rest indexes in the background
• Bulk Select & Delete — manage your photo library directly from search results
• Full-Screen Viewer — zoom, download, and share photos without leaving the app
• Privacy First — no accounts required, no analytics, no data collection

PERFECT FOR
• Finding old memories without remembering when or where they were taken
• Searching large photo libraries that are too big to browse manually
• Photographers and creatives who need to find specific shots fast
• Anyone who's tired of scrolling through thousands of unsorted photos

PRIVACY
Searchly AI is built privacy-first. All AI processing happens on your device. Proliant Data never receives your photos, your search queries, or any personal data. Read our full privacy policy at: https://your-github-username.github.io/searchly-ai/privacy

OPEN SOURCE
Searchly AI is open source under the MIT license. View the code, report issues, or contribute at: https://github.com/your-github-username/searchly-ai
```

**What's new in this version:**
```
Initial release of Searchly AI for Windows.
```

**Keywords (for Store search — comma separated):**
```
photo search, image search, AI photo, natural language search, CLIP, photo organizer, Google Drive photos, find photos, picture search, local photos
```

**Support URL:**
```
https://github.com/your-github-username/searchly-ai/issues
```

**Privacy policy URL:**
```
https://your-github-username.github.io/searchly-ai/privacy
```

---

### Screenshots (required — minimum 4)

Take these screenshots at 1920x1080 or 1280x720:

| # | What to show | How to get it |
|---|---|---|
| 1 | **Home screen** — the main search interface before any photos are loaded | Launch app, take screenshot |
| 2 | **Indexing in progress** — status bar showing photos being processed | Load a folder with photos |
| 3 | **Search results** — grid of photos matching a search like "sunset" | Search after indexing |
| 4 | **Full-screen viewer** — a photo open in the image viewer | Click any search result |
| 5 | **Google Drive connected** — showing Drive photos being searched | Connect Drive and search |

**Screenshot tool in Windows:**
- Press `Win + Shift + S` to snip a region
- Or press `F12` in VS Code with the app open

**Upload specs:** PNG or JPEG, minimum 1366×768, maximum 3840×2160

---

### Packages

Upload your MSIX file:
- File: `dist/Searchly-AI-1.0.0.msix`
- Architecture: x64
- Min Windows version: Windows 10 version 1903 (18362.0)

---

## Step 5 — Submit for Review

Click **Submit to the Store**.

Microsoft will review your app. Typical timeline: **3–7 business days**.

They will check:
- App launches and works correctly ✅
- Privacy policy is accessible ✅
- Content is appropriate ✅
- No malware or suspicious behavior ✅
- Store listing is accurate ✅

---

## Step 6 — After Approval

Once approved:
- Your app appears in the Microsoft Store search
- Users can install with one click and get automatic updates
- You'll receive an email from Microsoft when it goes live

---

## Updating the App Later

When you release a new version:
1. Update version in `package.json` (e.g. `1.0.1`)
2. Run `npm run build:store`
3. In Partner Center → your app → **Update**
4. Upload new MSIX and submit

---

## GitHub Pages — Hosting Your Privacy Policy

The Store requires a live URL for your privacy policy. Use GitHub Pages (free):

1. In your GitHub repo → **Settings → Pages**
2. Source: **Deploy from branch** → branch: `main`, folder: `/docs`
3. Save — your privacy policy will be live at:
   `https://your-github-username.github.io/searchly-ai/privacy`

This is the URL to enter in the Store listing.
