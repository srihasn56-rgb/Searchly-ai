"""
Searchly AI — Python Backend Server
────────────────────────────────────
Runs as a local HTTP server on port 5501.
Electron spawns this process at startup and kills it on quit.

Endpoints
─────────
GET  /health                      → { ok: true, model_loaded: bool }
POST /index      { folder }       → SSE stream of progress events, then done
GET  /index/cancel                → cancel ongoing indexing
POST /search     { query, folder, top_k, threshold } → { results: [{path,score,url}] }
POST /duplicates { folder, threshold } → { groups: [[{path,score}]] }
POST /delete     { paths: [...] } → { deleted, failed }
"""

import os
import sys
import json
import time
import signal
import threading
import hashlib
import pickle
import queue
from pathlib import Path
from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE_DIR  = os.path.dirname(os.path.abspath(__file__))
CACHE_DIR = os.path.join(os.path.expanduser("~"), ".searchly_ai", "cache")
os.makedirs(CACHE_DIR, exist_ok=True)

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tiff", ".tif", ".heic", ".avif"}

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB — allows large base64 batches
CORS(app)

# ── Global model state ─────────────────────────────────────────────────────────
_model       = None
_preprocess  = None
_tokenizer   = None
_device      = None
_model_lock  = threading.Lock()
_model_ready = False

# ── Active indexing state ──────────────────────────────────────────────────────
_index_cancel  = threading.Event()
_index_running = threading.Lock()   # non-blocking tryacquire

# ── Per-folder index cache in memory ──────────────────────────────────────────
_index_cache = {}   # folder_path → { embeddings, paths, saved_at }


# ═══════════════════════════════════════════════════════════════════════════════
#  Model helpers
# ═══════════════════════════════════════════════════════════════════════════════

def get_device():
    global _device
    if _device is None:
        import torch
        _device = "cuda" if torch.cuda.is_available() else "cpu"
    return _device


def ensure_model_loaded(progress_cb=None):
    global _model, _preprocess, _tokenizer, _model_ready
    with _model_lock:
        if _model_ready:
            return True
        try:
            import open_clip, torch
            if progress_cb: progress_cb("Loading AI model…")
            device = get_device()
            _model, _, _preprocess = open_clip.create_model_and_transforms(
                "ViT-B-32", pretrained="openai"
            )
            _tokenizer = open_clip.get_tokenizer("ViT-B-32")
            _model = _model.to(device)
            _model.eval()
            _model_ready = True
            if progress_cb: progress_cb("Model loaded ✓")
            return True
        except Exception as e:
            print(f"[Model] Load error: {e}", flush=True)
            return False


def get_optimal_batch_size():
    """Fixed batch size of 64 — good balance of speed and stability."""
    print(f"[Index] Using batch size: 64", flush=True)
    return 64


def encode_images_batch(image_paths, batch_size=None, progress_cb=None, cancel_event=None):
    if batch_size is None:
        batch_size = get_optimal_batch_size()
    print(f"[Index] Using batch size: {batch_size}", flush=True)
    """Encode images in batches — the fast PyTorch path."""
    import torch
    from PIL import Image

    device = get_device()
    all_features = []
    valid_paths  = []
    total        = len(image_paths)

    for i in range(0, total, batch_size):
        if cancel_event and cancel_event.is_set():
            return None, None

        batch_paths   = image_paths[i : i + batch_size]
        batch_tensors = []

        for path in batch_paths:
            try:
                img = _preprocess(Image.open(path).convert("RGB"))
                batch_tensors.append(img)
                valid_paths.append(path)
            except Exception as e:
                print(f"[Index] Skip {path}: {e}", flush=True)

        if not batch_tensors:
            continue

        batch = torch.stack(batch_tensors).to(device)
        with torch.no_grad():
            features = _model.encode_image(batch)
            features = features / features.norm(dim=-1, keepdim=True)
        all_features.append(features.cpu().numpy())

        processed = min(i + batch_size, total)
        if progress_cb:
            progress_cb(processed, total, batch_paths[-1])

    import numpy as np
    if all_features:
        return np.vstack(all_features).astype("float32"), valid_paths
    return np.array([]), []


def encode_text(query):
    import torch
    device = get_device()
    try:
        tokens   = _tokenizer([query]).to(device)
        with torch.no_grad():
            features = _model.encode_text(tokens)
            features = features / features.norm(dim=-1, keepdim=True)
        return features.cpu().numpy()
    except Exception as e:
        print(f"[Search] encode_text error: {e}", flush=True)
        return None


# ═══════════════════════════════════════════════════════════════════════════════
#  Cache helpers
# ═══════════════════════════════════════════════════════════════════════════════

def _cache_path(folder):
    key = hashlib.md5(folder.encode()).hexdigest()
    return os.path.join(CACHE_DIR, f"{key}.pkl")


def _folder_signature(folder):
    """Hash based on filenames + sizes (fast, no mtime jitter)."""
    parts = [folder]
    try:
        for root, dirs, files in os.walk(folder):
            dirs[:] = sorted(d for d in dirs if not d.startswith("."))
            for f in sorted(files):
                if os.path.splitext(f.lower())[1] in IMAGE_EXTS:
                    fp = os.path.join(root, f)
                    try:
                        parts.append(f"{fp}:{os.path.getsize(fp)}")
                    except:
                        pass
    except:
        pass
    return hashlib.md5("\n".join(parts).encode()).hexdigest()


def load_cache(folder):
    # Memory-first
    if folder in _index_cache:
        return _index_cache[folder]
    cp = _cache_path(folder)
    if not os.path.exists(cp):
        return None
    try:
        with open(cp, "rb") as f:
            data = pickle.load(f)
        sig = _folder_signature(folder)
        if data.get("signature") != sig:
            return None          # stale — needs re-index
        _index_cache[folder] = data
        return data
    except:
        return None


def save_cache(folder, embeddings, paths):
    import numpy as np
    sig  = _folder_signature(folder)
    data = {"signature": sig, "embeddings": embeddings, "paths": paths, "count": len(paths)}
    _index_cache[folder] = data
    try:
        with open(_cache_path(folder), "wb") as f:
            pickle.dump(data, f)
    except Exception as e:
        print(f"[Cache] Save error: {e}", flush=True)


def get_folder_images(folder):
    """Recursively collect image paths."""
    paths = []
    try:
        for root, dirs, files in os.walk(folder):
            dirs[:] = sorted(d for d in dirs if not d.startswith("."))
            for f in sorted(files):
                if os.path.splitext(f.lower())[1] in IMAGE_EXTS:
                    paths.append(os.path.join(root, f))
    except:
        pass
    return paths


# ═══════════════════════════════════════════════════════════════════════════════
#  Incremental index helper
# ═══════════════════════════════════════════════════════════════════════════════

def _incremental_index(folder, progress_cb, cancel_event):
    """Index folder, only processing files not already in cache."""
    import numpy as np

    all_paths = get_folder_images(folder)
    if not all_paths:
        return None, "No images found in folder."

    cached   = load_cache(folder)
    cached_map = {}   # abs_path → vector
    if cached:
        for i, p in enumerate(cached["paths"]):
            cached_map[p] = cached["embeddings"][i]

    new_paths = [p for p in all_paths if p not in cached_map]

    # Emit how many are cached vs new
    progress_cb(0, len(all_paths),
                f"cache:{len(cached_map)} new:{len(new_paths)}", event="init")

    if new_paths:
        new_embs, valid_new = encode_images_batch(
            new_paths, batch_size=None,
            progress_cb=lambda cur, tot, f: progress_cb(
                len(cached_map) + cur, len(all_paths), f),
            cancel_event=cancel_event
        )
        if cancel_event and cancel_event.is_set():
            return None, "cancelled"
        if valid_new:
            for i, p in enumerate(valid_new):
                cached_map[p] = new_embs[i]

    # Rebuild ordered arrays
    final_paths = [p for p in all_paths if p in cached_map]
    final_embs  = np.array([cached_map[p] for p in final_paths], dtype="float32")

    save_cache(folder, final_embs, final_paths)
    return {"embeddings": final_embs, "paths": final_paths}, None


# ═══════════════════════════════════════════════════════════════════════════════
#  Flask routes
# ═══════════════════════════════════════════════════════════════════════════════

@app.route("/health")
def health():
    return jsonify({"ok": True, "model_loaded": _model_ready})


@app.route("/index", methods=["POST"])
def index_folder():
    """
    SSE stream — emits JSON lines:
      {"type":"init",  "cached":N, "new":N, "total":N}
      {"type":"progress", "done":N, "total":N, "file":"..."}
      {"type":"done",  "count":N, "time":s}
      {"type":"error", "message":"..."}
    """
    data   = request.get_json(force=True)
    folder = data.get("folder", "").strip()

    if not folder or not os.path.isdir(folder):
        return jsonify({"error": "Invalid folder path"}), 400

    def generate():
        _index_cancel.clear()

        def send(obj):
            yield f"data: {json.dumps(obj)}\n\n"

        # Load model
        if not _model_ready:
            yield f"data: {json.dumps({'type':'status','message':'Loading AI model…'})}\n\n"
            ok = ensure_model_loaded()
            if not ok:
                yield f"data: {json.dumps({'type':'error','message':'Failed to load AI model'})}\n\n"
                return

        t0 = time.time()

        def progress_cb(done, total, filename, event="progress"):
            if event == "init":
                # filename encodes "cache:N new:N"
                parts = dict(p.split(":") for p in filename.split())
                pass   # handled below
            pass

        # Custom event queue so we can yield from main thread
        q = queue.Queue()

        def run_index():
            def on_progress(done, total, filename, event="progress"):
                if event == "init":
                    try:
                        parts = dict(p.split(":") for p in filename.split())
                        q.put({"type": "init",
                               "cached": int(parts.get("cache", 0)),
                               "new":    int(parts.get("new", 0)),
                               "total":  total})
                    except:
                        pass
                else:
                    q.put({"type": "progress", "done": done,
                           "total": total, "file": os.path.basename(filename)})

            result, err = _incremental_index(folder, on_progress, _index_cancel)
            if err:
                q.put({"type": "error", "message": err})
            else:
                elapsed = round(time.time() - t0, 1)
                q.put({"type": "done",
                        "count": len(result["paths"]),
                        "time":  elapsed})
            q.put(None)   # sentinel

        t = threading.Thread(target=run_index, daemon=True)
        t.start()

        while True:
            item = q.get()
            if item is None:
                break
            yield f"data: {json.dumps(item)}\n\n"

        t.join()

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control":  "no-cache",
            "X-Accel-Buffering": "no",
        }
    )


@app.route("/index/cancel")
def cancel_index():
    _index_cancel.set()
    return jsonify({"ok": True})


@app.route("/search", methods=["POST"])
def search():
    import numpy as np

    data      = request.get_json(force=True)
    query     = data.get("query", "").strip()
    folder    = data.get("folder", "").strip()
    top_k     = int(data.get("top_k", 50))
    threshold = float(data.get("threshold", 0.20))

    if not query:
        return jsonify({"error": "Empty query"}), 400

    ensure_model_loaded()

    cached = load_cache(folder) if folder else None
    if not cached or len(cached["paths"]) == 0:
        return jsonify({"error": "Folder not indexed yet"}), 404

    text_feat = encode_text(query)
    if text_feat is None:
        return jsonify({"error": "Text encoding failed"}), 500

    embs  = cached["embeddings"]           # (N, 512) float32
    norms = np.linalg.norm(embs, axis=1, keepdims=True) + 1e-8
    normed = embs / norms

    sims = np.dot(normed, text_feat[0])    # (N,)
    order = np.argsort(sims)[::-1]

    results = []
    for idx in order[:top_k]:
        score = float(sims[idx])
        if score < threshold:
            break
        path = cached["paths"][idx]
        results.append({"path": path, "score": score,
                         "filename": os.path.basename(path)})

    return jsonify({"results": results})


@app.route("/duplicates", methods=["POST"])
def duplicates():
    import numpy as np

    data      = request.get_json(force=True)
    folder    = data.get("folder", "").strip()
    threshold = float(data.get("threshold", 0.97))

    cached = load_cache(folder) if folder else None
    if not cached or len(cached["paths"]) == 0:
        return jsonify({"error": "Folder not indexed yet"}), 404

    embs   = cached["embeddings"]
    paths  = cached["paths"]
    n      = len(paths)

    norms  = np.linalg.norm(embs, axis=1, keepdims=True) + 1e-8
    normed = (embs / norms).astype("float32")

    assigned = set()
    groups   = []

    for i in range(n):
        if i in assigned:
            continue
        sims = np.dot(normed, normed[i])
        dup_idxs = [j for j in range(n) if j != i and j not in assigned and sims[j] >= threshold]
        if dup_idxs:
            group_idxs = [i] + dup_idxs
            assigned.update(group_idxs)
            group = [{"path": paths[j], "score": float(sims[j]),
                       "filename": os.path.basename(paths[j])} for j in group_idxs]
            groups.append(group)

    return jsonify({"groups": groups})


@app.route("/similar", methods=["POST"])
def similar():
    import numpy as np

    data      = request.get_json(force=True)
    path      = data.get("path", "").strip()
    folder    = data.get("folder", "").strip()
    top_k     = int(data.get("top_k", 20))

    cached = load_cache(folder) if folder else None
    if not cached or len(cached["paths"]) == 0:
        return jsonify({"error": "Folder not indexed yet"}), 404

    embs  = cached["embeddings"]
    paths = cached["paths"]

    try:
        idx = paths.index(path)
    except ValueError:
        return jsonify({"error": f"Path not found in index: {path}"}), 404

    norms  = np.linalg.norm(embs, axis=1, keepdims=True) + 1e-8
    normed = embs / norms
    sims   = np.dot(normed, normed[idx])
    sims[idx] = -1   # exclude self

    top_idx = np.argsort(sims)[::-1][:top_k]
    results = [{"path": paths[i], "score": float(sims[i]),
                 "filename": os.path.basename(paths[i])} for i in top_idx if sims[i] > 0]

    return jsonify({"results": results})


@app.route("/delete", methods=["POST"])
def delete_files():
    data  = request.get_json(force=True)
    paths = data.get("paths", [])

    deleted = []
    failed  = []
    for p in paths:
        try:
            if os.path.exists(p):
                os.remove(p)
                deleted.append(p)
            else:
                failed.append({"path": p, "reason": "File not found"})
        except Exception as e:
            failed.append({"path": p, "reason": str(e)})

    # Invalidate any in-memory cache that contained these paths
    for folder in list(_index_cache.keys()):
        cache = _index_cache[folder]
        if any(p in cache.get("paths", []) for p in deleted):
            del _index_cache[folder]

    return jsonify({"deleted": deleted, "failed": failed})


@app.route("/index_blobs", methods=["POST"])
def index_blobs():
    """Index images sent as base64 blobs — used for Google Drive photos."""
    import base64, tempfile
    data = request.get_json(force=True)
    images = data.get("images", [])  # [{id, name, b64, mime}]

    ensure_model_loaded()

    results = {}
    tmp_files = []
    try:
        paths = []
        id_map = {}
        for img in images:
            try:
                raw = base64.b64decode(img["b64"])
                mime = img.get("mime", "image/jpeg")
                suffix = ".png" if "png" in mime else ".webp" if "webp" in mime else ".jpg"
                tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
                tmp.write(raw)
                tmp.close()
                tmp_files.append(tmp.name)
                paths.append(tmp.name)
                id_map[tmp.name] = img["id"]
            except Exception as e:
                print(f"[BlobIndex] Skip {img.get('name','?')}: {e}", flush=True)

        if paths:
            embeddings, valid_paths = encode_images_batch(paths, batch_size=get_optimal_batch_size())
            for path, emb in zip(valid_paths, embeddings):
                results[id_map[path]] = emb.tolist()

    finally:
        for f in tmp_files:
            try: os.unlink(f)
            except: pass

    return jsonify({"ok": True, "embeddings": results})


@app.route("/read_image", methods=["POST"])
def read_image():
    """Return image as base64 for display in the frontend."""
    import base64
    data = request.get_json(force=True)
    path = data.get("path", "")
    try:
        ext  = os.path.splitext(path)[1].lower().lstrip(".")
        mime = "image/jpeg" if ext in ("jpg", "jpeg") else f"image/{ext}"
        with open(path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode()
        return jsonify({"ok": True, "b64": b64, "mime": mime})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 404


if __name__ == "__main__":
    port = int(os.environ.get("SEARCHLY_PY_PORT", "5501"))
    # Pre-load model in background
    threading.Thread(target=ensure_model_loaded, daemon=True).start()
    # Graceful shutdown on SIGTERM from Electron
    signal.signal(signal.SIGTERM, lambda *_: os._exit(0))
    app.run(host="127.0.0.1", port=port, threaded=True, debug=False)