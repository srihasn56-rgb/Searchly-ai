// ==================== POWER FEATURES v2 ====================
// Search History · Context Menu · Keyboard Shortcuts · Drag Out
// Keyboard Shortcuts · Drag Out · Open File Location

// ─────────────────────────────────────────────────────────────
// TOAST FIX — auto-size, wraps text, never clips
// ─────────────────────────────────────────────────────────────
(function patchToasts() {
    // Wait for error-handling.js to define showToast, then patch it
    function tryPatch() {
        if (typeof window._searchlyToastPatched !== 'undefined') return;
        const styleEl = document.getElementById('searchlyToastStyle') || document.querySelector('style');
        // Inject corrected toast CSS
        const s = document.createElement('style');
        s.textContent = `
        .searchly-toast {
            position: fixed !important;
            top: 72px !important;
            left: 50% !important;
            transform: translateX(-50%) scale(0.9) !important;
            z-index: 99999 !important;
            max-width: min(420px, 90vw) !important;
            width: max-content !important;
            min-width: 160px !important;
            padding: 10px 18px 10px 14px !important;
            border-radius: 10px !important;
            font-size: 13px !important;
            font-weight: 500 !important;
            line-height: 1.45 !important;
            white-space: normal !important;
            word-break: break-word !important;
            box-shadow: 0 6px 28px rgba(0,0,0,0.4) !important;
            display: flex !important;
            align-items: flex-start !important;
            gap: 8px !important;
            pointer-events: auto !important;
            cursor: default !important;
            opacity: 0;
            transition: opacity 0.22s ease, transform 0.22s cubic-bezier(0.34,1.56,0.64,1) !important;
        }
        .searchly-toast.show {
            opacity: 1 !important;
            transform: translateX(-50%) scale(1) !important;
        }
        .searchly-toast.hide {
            opacity: 0 !important;
            transform: translateX(-50%) scale(0.92) !important;
        }
        .toast-progress {
            position: absolute !important;
            bottom: 0 !important; left: 0 !important;
            height: 3px !important;
            border-radius: 0 0 10px 10px !important;
            background: rgba(255,255,255,0.35) !important;
            animation: toastProgress var(--toast-dur, 3s) linear forwards !important;
        }
        @keyframes toastProgress { from { width: 100%; } to { width: 0%; } }
        `;
        document.head.appendChild(s);
        window._searchlyToastPatched = true;
    }
    document.addEventListener('DOMContentLoaded', tryPatch);
    setTimeout(tryPatch, 500);
})();

// ─────────────────────────────────────────────────────────────
// 1. SEARCH HISTORY
// ─────────────────────────────────────────────────────────────
const MAX_HISTORY = 20;

function getSearchHistory() {
    try { return JSON.parse(localStorage.getItem('searchly_history') || '[]'); }
    catch(e) { return []; }
}
function saveSearchToHistory(q) {
    if (!q || q.trim().length < 2) return;
    let h = getSearchHistory().filter(x => x !== q.trim());
    h.unshift(q.trim());
    localStorage.setItem('searchly_history', JSON.stringify(h.slice(0, MAX_HISTORY)));
}

function renderHistoryDropdown() {
    document.getElementById('searchHistoryDropdown')?.remove();
    const history = getSearchHistory();
    const input   = document.getElementById('searchInput');
    if (!input || history.length === 0) return;

    const dd = document.createElement('div');
    dd.id = 'searchHistoryDropdown';
    dd.style.cssText = `position:absolute;top:calc(100% + 6px);left:0;right:0;z-index:9999;
        background:#1e2030;border:1px solid #334155;border-radius:10px;overflow:hidden;
        box-shadow:0 8px 32px rgba(0,0,0,0.45);max-height:220px;overflow-y:auto;`;

    history.forEach(q => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:9px 14px;cursor:pointer;color:#cbd5e1;font-size:13px;';
        row.innerHTML = `<span style="color:#475569;font-size:11px">🕐</span>
            <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${q}</span>
            <span data-del style="color:#475569;font-size:17px;line-height:1;padding:0 4px">×</span>`;
        row.onmouseenter = () => row.style.background = '#2d3250';
        row.onmouseleave = () => row.style.background = '';

        // Click text → run search (mousedown to beat blur)
        row.querySelector('span:nth-child(2)').onmousedown = e => {
            e.preventDefault();
            document.getElementById('searchHistoryDropdown')?.remove();
            input.value = q;
            if (typeof performSearch === 'function') performSearch();
        };
        // Click × → delete
        row.querySelector('[data-del]').onmousedown = e => {
            e.preventDefault(); e.stopPropagation();
            const h = getSearchHistory().filter(x => x !== q);
            localStorage.setItem('searchly_history', JSON.stringify(h));
            row.remove();
            if (!dd.querySelector('div')) dd.remove();
        };
        dd.appendChild(row);
    });

    const wrapper = input.closest('.search-input-wrapper') || input.parentElement;
    wrapper.style.position = 'relative';
    wrapper.appendChild(dd);
}

document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('searchInput');
    if (!input) return;
    input.addEventListener('focus', renderHistoryDropdown);
    input.addEventListener('blur', () => setTimeout(() => document.getElementById('searchHistoryDropdown')?.remove(), 200));
    input.addEventListener('input', () => {
        if (!input.value) renderHistoryDropdown();
        else document.getElementById('searchHistoryDropdown')?.remove();
    });
    // Save on search
    document.getElementById('searchBtn')?.addEventListener('click', () => {
        const q = input.value?.trim();
        if (q) saveSearchToHistory(q);
    }, true);
});
document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && document.activeElement?.id === 'searchInput') {
        saveSearchToHistory(document.activeElement.value?.trim());
    }
}, true);


// ─────────────────────────────────────────────────────────────
// 4. OPEN FILE LOCATION
// ─────────────────────────────────────────────────────────────
async function openFileLocation(imageUrl) {
    const key  = Object.keys(models?.embeddings || {}).find(p => models.embeddings[p].url === imageUrl);
    const info = key ? models.embeddings[key] : null;
    const abs  = info?.absolutePath || info?.localPath || null;

    if (abs && window.electronAPI?.showItemInFolder) {
        await window.electronAPI.showItemInFolder(abs);
    } else if (abs && window.electronAPI?.openPath) {
        const parent = abs.replace(/[/\\][^/\\]+$/, '');
        await window.electronAPI.openPath(parent);
    } else if (info?.driveFileId) {
        if (typeof showWarning === 'function') showWarning('Cannot open file location for Drive files');
    } else {
        if (typeof showWarning === 'function') showWarning('File location unavailable — re-index folder to enable');
    }
}


// ─────────────────────────────────────────────────────────────
// 5. RIGHT-CLICK CONTEXT MENU
// ─────────────────────────────────────────────────────────────
function removeCtxMenu() { document.getElementById('_slyCtx')?.remove(); }

function showContextMenu(e, imageUrl, filename) {
    e.preventDefault();
    removeCtxMenu();

    const menu  = document.createElement('div');
    menu.id     = '_slyCtx';
    menu.style.cssText = `position:fixed;left:${e.clientX}px;top:${e.clientY}px;
        z-index:99998;background:#1a1d2e;border:1px solid #334155;border-radius:10px;
        padding:5px;min-width:210px;box-shadow:0 10px 40px rgba(0,0,0,0.55);user-select:none;`;

    const items = [
        { icon:'🖼️', label:'Open image',           fn: () => { if(typeof openViewer==='function') openViewer(imageUrl); } },
        { icon:'📂', label:'Open file location',    fn: () => openFileLocation(imageUrl) },
        { icon:'📋', label:'Copy filename',         fn: () => { navigator.clipboard?.writeText(filename); if(typeof showInfo==='function') showInfo('Copied!',1400); } },
        null,
        { icon:'🗑️', label:'Delete',               fn: deleteOne, danger: true },
    ];

    async function deleteOne() {
        if (!confirm(`Permanently delete "${filename}" from your PC?\n\nThis cannot be undone.`)) return;
        const { deletedFiles, failedFiles } = await deleteFilesFromStorage([imageUrl]);
        if (deletedFiles.length) {
            document.querySelectorAll('.result-card').forEach(c => {
                if (c.querySelector('img')?.src === imageUrl) c.remove();
            });
            if (typeof showSuccess === 'function') showSuccess('✅ Deleted');
        } else {
            if (typeof showError === 'function') showError('Delete failed: ' + (failedFiles[0]?.reason || ''));
        }
    }

    items.forEach(item => {
        if (!item) {
            const sep = document.createElement('div');
            sep.style.cssText = 'height:1px;background:#2d3250;margin:3px 0';
            menu.appendChild(sep); return;
        }
        const row = document.createElement('div');
        row.style.cssText = `display:flex;align-items:center;gap:10px;padding:8px 12px;
            border-radius:7px;cursor:pointer;font-size:13px;color:${item.danger?'#f87171':'#e2e8f0'}`;
        row.innerHTML = `<span style="width:18px;text-align:center">${item.icon}</span><span>${item.label}</span>`;
        row.onmouseenter = () => row.style.background = item.danger ? 'rgba(239,68,68,0.1)' : '#2d3250';
        row.onmouseleave = () => row.style.background = '';
        row.onclick = () => { removeCtxMenu(); item.fn(); };
        menu.appendChild(row);
    });

    document.body.appendChild(menu);
    requestAnimationFrame(() => {
        const r = menu.getBoundingClientRect();
        if (r.right  > window.innerWidth)  menu.style.left = `${e.clientX - r.width  - 4}px`;
        if (r.bottom > window.innerHeight) menu.style.top  = `${e.clientY - r.height - 4}px`;
    });
    setTimeout(() => document.addEventListener('click', removeCtxMenu, { once: true }), 10);
}


// ─────────────────────────────────────────────────────────────
// 6. KEYBOARD SHORTCUTS
// ─────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        removeCtxMenu();
        document.getElementById('searchHistoryDropdown')?.remove();
        document.getElementById('_slyCtx')?.remove();
        if (document.getElementById('imageViewer')?.style.display !== 'none') { window.closeViewer?.(); return; }
        if (typeof selectionMode !== 'undefined' && selectionMode) { window.toggleSelectionMode?.(); return; }
    }
    if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        if (!selectionMode) window.toggleSelectionMode?.();
        setTimeout(() => window.selectAll?.(), 60);
    }
    if (e.key === 'Delete' && typeof selectedImages !== 'undefined' && selectedImages?.size > 0) {
        window.deleteSelectedImagesReal?.();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault(); document.getElementById('searchInput')?.focus();
    }
});


// ─────────────────────────────────────────────────────────────
// 7. DRAG OUT TO EXPLORER
// ─────────────────────────────────────────────────────────────
function enableDragOut(card, imageUrl, filename) {
    card.setAttribute('draggable', true);
    card.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/uri-list', imageUrl);
        e.dataTransfer.setData('text/plain', filename);
        e.dataTransfer.effectAllowed = 'copy';
        card.style.opacity = '0.55';
    });
    card.addEventListener('dragend', () => { card.style.opacity = ''; });
}


// ─────────────────────────────────────────────────────────────
// 8. ENHANCED displayResults  — wires ALL features into cards
//    Loads AFTER similar-search.js so it wraps that wrapper too
// ─────────────────────────────────────────────────────────────
function buildResultCards(results) {
    const grid = document.getElementById('resultsGrid');
    grid.innerHTML = '';

    if (!results.length) {
        grid.innerHTML = `<div class="empty-state">
            <div class="empty-icon"><svg width="40" height="40" fill="currentColor" viewBox="0 0 20 20" style="color:#60a5fa">
                <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/>
            </svg></div>
            <div class="empty-title">No Results Found</div>
            <div class="empty-desc">Try different search terms.</div>
        </div>`;
        return;
    }

    results.forEach(result => {
        const card = document.createElement('div');
        card.className = 'result-card';
        card.innerHTML = `
            <img src="${result.url}" class="result-img" draggable="false">
            <div class="result-overlay"><div class="result-name">${result.filename}</div></div>`;

        card.querySelector('img').onclick = () => { if (typeof openViewer === 'function') openViewer(result.url); };
        card.addEventListener('contextmenu', e => showContextMenu(e, result.url, result.filename));
        enableDragOut(card, result.url, result.filename);
        grid.appendChild(card);
    });

    // Let similar-search.js add its buttons
    if (typeof addSimilarSearchButtons === 'function') setTimeout(addSimilarSearchButtons, 80);
}

// Override window.displayResults — this is the single point all code calls
window.displayResults = buildResultCards;


// ─────────────────────────────────────────────────────────────
// 9. FAV BUTTON + MISC CSS
// ─────────────────────────────────────────────────────────────
const pfCSS = document.createElement('style');
pfCSS.textContent = `
`;
document.head.appendChild(pfCSS);

console.log('✅ Power features v2 loaded');
