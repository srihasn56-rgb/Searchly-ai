// ── Styled confirm dialog (replaces native confirm() which can fail in Electron) ──
function showConfirmDialog(title, message, confirmText = 'OK', cancelText = 'Cancel') {
    return new Promise(resolve => {
        // Remove any existing confirm dialog
        const existing = document.getElementById('searchly-confirm-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'searchly-confirm-overlay';
        overlay.style.cssText = `
            position:fixed;inset:0;background:rgba(0,0,0,0.65);
            display:flex;align-items:center;justify-content:center;
            z-index:999999;backdrop-filter:blur(4px);
        `;
        overlay.innerHTML = `
            <div style="background:#1e293b;border:1px solid #334155;border-radius:16px;
                        padding:28px 32px;min-width:340px;max-width:480px;
                        box-shadow:0 24px 64px rgba(0,0,0,0.6);animation:fadeInScale 0.18s ease">
                <h3 style="margin:0 0 10px;color:#f1f5f9;font-size:18px;font-weight:700">${title}</h3>
                <p style="margin:0 0 24px;color:#94a3b8;font-size:14px;line-height:1.6">${message}</p>
                <div style="display:flex;gap:12px;justify-content:flex-end">
                    <button id="searchly-confirm-cancel"
                        style="padding:9px 20px;border-radius:8px;border:1px solid #475569;
                               background:#334155;color:#e2e8f0;font-size:14px;font-weight:600;
                               cursor:pointer;transition:background 0.2s">
                        ${cancelText}
                    </button>
                    <button id="searchly-confirm-ok"
                        style="padding:9px 20px;border-radius:8px;border:none;
                               background:linear-gradient(135deg,#ef4444,#dc2626);color:white;
                               font-size:14px;font-weight:600;cursor:pointer;transition:opacity 0.2s">
                        ${confirmText}
                    </button>
                </div>
            </div>
            <style>
                @keyframes fadeInScale { from{opacity:0;transform:scale(0.93)} to{opacity:1;transform:scale(1)} }
            </style>
        `;

        const close = (result) => { overlay.remove(); resolve(result); };
        overlay.querySelector('#searchly-confirm-ok').onclick     = () => close(true);
        overlay.querySelector('#searchly-confirm-cancel').onclick  = () => close(false);
        overlay.addEventListener('click', e => { if (e.target === overlay) close(false); });
        document.addEventListener('keydown', function esc(e) {
            if (e.key === 'Escape') { document.removeEventListener('keydown', esc); close(false); }
        }, { once: true });
        document.body.appendChild(overlay);
    });
}

// ==================== REAL FILE DELETION ====================

async function deleteFilesFromStorage(imageUrls, absolutePathsFallback = []) {
    // absolutePathsFallback: optional array of absolute paths (same order as imageUrls)
    // Used when Python backend indexes files and models.embeddings lookup by URL fails
    const deletedFiles = [];
    const failedFiles  = [];

    for (let urlIdx = 0; urlIdx < imageUrls.length; urlIdx++) {
        const imageUrl = imageUrls[urlIdx];
        const fallbackPath = absolutePathsFallback[urlIdx] || null;
        try {
            // Try URL-based lookup first, then absolute path key
            let pathKey = Object.keys(models.embeddings || {}).find(
                p => models.embeddings[p].url === imageUrl
            );
            if (!pathKey && fallbackPath) {
                // Python path: key IS the absolute path
                pathKey = fallbackPath;
            }
            if (!pathKey) {
                // Last resort: try to delete by absolute path directly via IPC
                if (fallbackPath && window.electronAPI?.deleteLocalFile) {
                    const r = await window.electronAPI.deleteLocalFile(fallbackPath);
                    if (r.success) { deletedFiles.push(fallbackPath.split(/[\/]/).pop()); continue; }
                }
                failedFiles.push({ url: imageUrl, reason: 'Not found in index' });
                continue;
            }

            const info = models.embeddings[pathKey] || { absolutePath: fallbackPath, localPath: fallbackPath, filename: (fallbackPath||'').split(/[\/]/).pop() };

            // ── Google Drive ────────────────────────────────────────────────
            if (imageUrl.includes('/api/drive/download/') || imageUrl.includes('/drive/file/')) {
                const m = imageUrl.match(/\/(?:api\/drive\/download|drive\/file)\/([^\/\?]+)/);
                if (!m) { failedFiles.push({ url: imageUrl, reason: 'Bad Drive URL' }); continue; }
                const ok = await deleteFromGoogleDrive(m[1], info.filename);
                if (ok) { deletedFiles.push(info.filename); delete models.embeddings[pathKey]; }
                else failedFiles.push({ url: imageUrl, reason: 'Drive API error' });
                continue;
            }

            // ── Local file ──────────────────────────────────────────────────
            const absPath = info.absolutePath || info.localPath || null;

            // Method 1 (Electron): absolute path → fs.unlink via IPC — ALWAYS WORKS
            if (absPath && window.electronAPI?.deleteLocalFile) {
                const r = await window.electronAPI.deleteLocalFile(absPath);
                if (r.success) {
                    console.log(`✅ Deleted: ${absPath}`);
                    deletedFiles.push(info.filename || info.entryFilename);
                    delete models.embeddings[pathKey];
                    continue;
                } else {
                    console.error('[Delete] IPC failed:', r.error);
                    failedFiles.push({ url: imageUrl, reason: r.error });
                    continue;
                }
            }

            // Method 2 (browser fallback): parentHandle.removeEntry()
            if (info.parentHandle && info.entryFilename) {
                try {
                    await info.parentHandle.removeEntry(info.entryFilename);
                    deletedFiles.push(info.entryFilename);
                    delete models.embeddings[pathKey];
                    continue;
                } catch(e) {
                    console.error('[Delete] removeEntry failed:', e.message);
                    failedFiles.push({ url: imageUrl, reason: e.message });
                    continue;
                }
            }

            failedFiles.push({ url: imageUrl, reason: 'No absolute path — please re-index your folder' });

        } catch(err) {
            console.error('[Delete]', err);
            failedFiles.push({ url: imageUrl, reason: err.message });
        }
    }

    return { deletedFiles, failedFiles };
}

async function deleteFromGoogleDrive(fileId, filename) {
    try {
        const base = typeof API_URL !== 'undefined' ? API_URL : '';
        const resp = await fetch(`${base}/drive/delete/${fileId}`, { method: 'DELETE' });
        if (resp.status === 404) return true;
        return resp.ok;
    } catch(e) { return false; }
}

async function deleteSelectedImagesReal() {
    if (!selectedImages || selectedImages.size === 0) { showWarning('No images selected'); return; }
    const count = selectedImages.size;
    const confirmed = await showConfirmDialog(
        `Delete ${count} image${count > 1 ? 's' : ''}?`,
        `This will permanently remove ${count} file${count > 1 ? 's' : ''} from your PC. This cannot be undone.`,
        'Delete', 'Cancel'
    );
    if (!confirmed) return;

    showInfo(`Deleting ${count} file(s)...`, 2000);
    const { deletedFiles, failedFiles } = await deleteFilesFromStorage(Array.from(selectedImages));

    document.querySelectorAll('.result-card').forEach(card => {
        const img = card.querySelector('img');
        if (img && selectedImages.has(img.src)) card.remove();
    });
    selectedImages.clear();
    if (typeof updateSelectionCount === 'function') updateSelectionCount();
    // Full teardown + re-setup so remaining cards get fresh click listeners
    // (addSelectionCheckboxes guards against duplicate checkboxes but skips re-attaching
    //  listeners — doing remove+add cleanly fixes the "can't select after delete" bug)
    if (typeof removeSelectionCheckboxes === 'function') removeSelectionCheckboxes();
    if (typeof addSelectionCheckboxes === 'function') addSelectionCheckboxes();
    if (typeof updateSelectionCount === 'function') updateSelectionCount();

    if (deletedFiles.length && !failedFiles.length)
        showSuccess(`✅ Deleted ${deletedFiles.length} file(s)`);
    else if (deletedFiles.length)
        showWarning(`Deleted ${deletedFiles.length} | Failed ${failedFiles.length}`);
    else
        showError(failedFiles[0]?.reason?.includes('re-index')
            ? '❌ Re-index your folder once, then delete will work'
            : `❌ Delete failed: ${failedFiles[0]?.reason || 'unknown'}`);

    if (typeof updateMemoryStatsUI === 'function') updateMemoryStatsUI();
}

async function deleteSelectedDuplicatesReal() {
    const selected = document.querySelectorAll('.duplicate-item.selected');
    if (!selected.length) { showWarning('No duplicates selected'); return; }
    const confirmedDup = await showConfirmDialog(`Delete ${selected.length} duplicate${selected.length > 1 ? 's' : ''}?`, `Permanently remove ${selected.length} duplicate file(s). This cannot be undone.`, 'Delete', 'Cancel');
    if (!confirmedDup) return;
    const urls = [];
    selected.forEach(item => {
        const g = parseInt(item.dataset.group), i = parseInt(item.dataset.index);
        if (typeof duplicateGroups !== 'undefined' && duplicateGroups[g]?.[i])
            urls.push(duplicateGroups[g][i].url);
    });
    const { deletedFiles, failedFiles } = await deleteFilesFromStorage(urls);
    selected.forEach(item => item.remove());
    if (deletedFiles.length) showSuccess(`✅ Deleted ${deletedFiles.length} duplicate(s)`);
    if (failedFiles.length) showError(`⚠️ ${failedFiles.length} failed`);
    if (typeof updateMemoryStatsUI === 'function') updateMemoryStatsUI();
}

window.deleteSelectedImages     = deleteSelectedImagesReal;
window.deleteSelectedDuplicates = deleteSelectedDuplicatesReal;
var deleteSelectedImages        = deleteSelectedImagesReal;
var deleteSelectedDuplicates    = deleteSelectedDuplicatesReal;

console.log('✅ Deletion ready — using Electron fs.unlink via IPC');
