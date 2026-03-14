// ==================== MULTI-SELECT & DELETE IMAGES ====================

let selectionMode = false;
let selectedImages = new Set();
// Expose so index.html and other scripts can read it reliably
Object.defineProperty(window, "selectionMode", { get: () => selectionMode });

function toggleSelectionMode() {
    // Block if no images indexed
    if (!selectionMode) {
        const hasImages = typeof models !== 'undefined' &&
                          models.embeddings &&
                          Object.keys(models.embeddings).length > 0;
        if (!hasImages) {
            if (typeof showWarning === 'function') showWarning('Index a folder first to select images.');
            return;
        }
        // Also block if no results are currently displayed
        const cards = document.querySelectorAll('.result-card');
        if (cards.length === 0) {
            if (typeof showWarning === 'function') showWarning('Search for images first, then select them.');
            return;
        }
    }

    selectionMode = !selectionMode;
    selectedImages.clear();

    const selectionBtn   = document.getElementById('selectionModeBtn');
    const bulkActionsBar = document.getElementById('bulkActionsBar');

    if (selectionMode) {
        if (selectionBtn) { selectionBtn.textContent = '✅ Done Selecting'; selectionBtn.classList.add('active'); }
        if (bulkActionsBar) bulkActionsBar.classList.add('active');
        addSelectionCheckboxes();
        if (typeof showSuccess === 'function') showSuccess('Selection mode ON — click images to select');
    } else {
        if (selectionBtn) { selectionBtn.textContent = '☑️ Select Images'; selectionBtn.classList.remove('active'); }
        if (bulkActionsBar) bulkActionsBar.classList.remove('active');
        removeSelectionCheckboxes();
        updateSelectionCount();
    }
}

function addSelectionCheckboxes() {
    document.querySelectorAll('.result-card').forEach(card => {
        if (card.querySelector('.selection-checkbox')) return;
        const checkbox = document.createElement('div');
        checkbox.className = 'selection-checkbox';
        checkbox.innerHTML = '<span class="checkbox-icon">☐</span>';
        card.addEventListener('click', handleCardSelection);
        card.classList.add('selectable');
        card.appendChild(checkbox);
    });
}

function removeSelectionCheckboxes() {
    document.querySelectorAll('.selection-checkbox').forEach(cb => cb.remove());
    document.querySelectorAll('.result-card').forEach(card => {
        card.removeEventListener('click', handleCardSelection);
        card.classList.remove('selectable', 'selected');
    });
}

function handleCardSelection(e) {
    if (!selectionMode) return;
    e.stopPropagation();
    e.preventDefault();
    const card = e.currentTarget;
    const img  = card.querySelector('img');
    if (!img || !img.src) return;
    const url = img.src;
    if (selectedImages.has(url)) {
        selectedImages.delete(url);
        card.classList.remove('selected');
        const cb = card.querySelector('.checkbox-icon');
        if (cb) cb.textContent = '☐';
    } else {
        selectedImages.add(url);
        card.classList.add('selected');
        const cb = card.querySelector('.checkbox-icon');
        if (cb) cb.textContent = '☑';
    }
    updateSelectionCount();
}

function updateSelectionCount() {
    const countDisplay = document.getElementById('selectionCount');
    if (countDisplay) countDisplay.textContent = `${selectedImages.size} selected`;
    const deleteBtn = document.getElementById('bulkDeleteBtn');
    if (deleteBtn) deleteBtn.disabled = selectedImages.size === 0;
}

function selectAll() {
    document.querySelectorAll('.result-card').forEach(card => {
        const img = card.querySelector('img');
        if (img && img.src) {
            selectedImages.add(img.src);
            card.classList.add('selected');
            const cb = card.querySelector('.checkbox-icon');
            if (cb) cb.textContent = '☑';
        }
    });
    updateSelectionCount();
    if (typeof showSuccess === 'function') showSuccess(`Selected all ${selectedImages.size} images`);
}

function deselectAll() {
    selectedImages.clear();
    document.querySelectorAll('.result-card').forEach(card => {
        card.classList.remove('selected');
        const cb = card.querySelector('.checkbox-icon');
        if (cb) cb.textContent = '☐';
    });
    updateSelectionCount();
}

// ── FIX: after delete/any operation, stay in selection mode & re-add checkboxes ──
function refreshSelectionState() {
    if (!selectionMode) return;
    // Remove stale references from selectedImages (cards that no longer exist)
    const existingUrls = new Set();
    document.querySelectorAll('.result-card img').forEach(img => existingUrls.add(img.src));
    for (const url of [...selectedImages]) {
        if (!existingUrls.has(url)) selectedImages.delete(url);
    }
    // Re-add checkboxes to any new cards that don't have them
    addSelectionCheckboxes();
    // Re-apply selected state to still-selected cards
    document.querySelectorAll('.result-card').forEach(card => {
        const img = card.querySelector('img');
        if (!img) return;
        const cb = card.querySelector('.checkbox-icon');
        if (selectedImages.has(img.src)) {
            card.classList.add('selected');
            if (cb) cb.textContent = '☑';
        } else {
            card.classList.remove('selected');
            if (cb) cb.textContent = '☐';
        }
    });
    updateSelectionCount();
}
window.refreshSelectionState = refreshSelectionState;

function createSelectionUI() {
    // Add "Select Images" button to header
    const headerContent = document.querySelector('.header-content');
    if (headerContent && !document.getElementById('selectionModeBtn')) {
        const btn = document.createElement('button');
        btn.id        = 'selectionModeBtn';
        btn.className = 'selection-mode-btn';
        btn.textContent = '☑️ Select Images';
        btn.onclick   = toggleSelectionMode;
        headerContent.appendChild(btn);
    }

    // Add bulk actions bar (NO Rename button)
    if (!document.getElementById('bulkActionsBar')) {
        const bar = document.createElement('div');
        bar.id        = 'bulkActionsBar';
        bar.className = 'bulk-actions-bar';
        bar.innerHTML = `
            <div class="bulk-actions-left">
                <span id="selectionCount">0 selected</span>
                <button onclick="selectAll()" class="bulk-action-btn">Select All</button>
                <button onclick="deselectAll()" class="bulk-action-btn">Deselect All</button>
            </div>
            <div class="bulk-actions-right">
                <button id="bulkDeleteBtn"
                    onclick="typeof deleteSelectedImagesReal==='function' ? deleteSelectedImagesReal() : deleteSelectedImages()"
                    class="bulk-action-btn delete-btn" disabled>
                    🗑️ Delete Selected
                </button>
            </div>`;
        const main = document.querySelector('main');
        if (main) main.insertBefore(bar, main.firstChild);
    }
}

// CSS
const styleSelection = document.createElement('style');
styleSelection.textContent = `
.selection-mode-btn {
    background: linear-gradient(135deg, #3b82f6, #2563eb);
    border: 1px solid #2563eb; border-radius: 8px;
    color: white; padding: 8px 16px; font-size: 14px;
    font-weight: 600; cursor: pointer; transition: all 0.3s;
}
.selection-mode-btn:hover { background: linear-gradient(135deg, #2563eb, #1d4ed8); box-shadow: 0 4px 12px rgba(59,130,246,0.4); }
.selection-mode-btn.active { background: linear-gradient(135deg, #10b981, #059669); border-color: #059669; }
.bulk-actions-bar { display:none; align-items:center; justify-content:space-between; background:#1f2937; border:1px solid #374151; border-radius:12px; padding:16px; margin-bottom:24px; animation:slideDown 0.3s ease; }
.bulk-actions-bar.active { display:flex; }
.bulk-actions-left, .bulk-actions-right { display:flex; align-items:center; gap:12px; }
#selectionCount { color:#60a5fa; font-weight:600; font-size:14px; }
.bulk-action-btn { background:#374151; border:1px solid #4b5563; border-radius:6px; color:#e5e7eb; padding:8px 16px; font-size:13px; font-weight:500; cursor:pointer; transition:all 0.2s; }
.bulk-action-btn:hover { background:#4b5563; border-color:#6b7280; }
.bulk-action-btn:disabled { opacity:0.5; cursor:not-allowed; }
.bulk-action-btn.delete-btn { background:linear-gradient(135deg,#ef4444,#dc2626); border-color:#dc2626; color:white; }
.bulk-action-btn.delete-btn:hover:not(:disabled) { background:linear-gradient(135deg,#dc2626,#b91c1c); box-shadow:0 4px 12px rgba(239,68,68,0.4); }
.selection-checkbox { position:absolute; top:10px; right:10px; width:30px; height:30px; background:rgba(0,0,0,0.65); backdrop-filter:blur(8px); border:2px solid #374151; border-radius:6px; display:flex; align-items:center; justify-content:center; z-index:10; cursor:pointer; transition:all 0.2s; }
.checkbox-icon { font-size:18px; color:#e5e7eb; }
.result-card.selectable { cursor:pointer; }
.result-card.selected { outline:3px solid #3b82f6; outline-offset:-3px; transform:scale(0.98); }
.result-card.selected .selection-checkbox { background:#3b82f6; border-color:#3b82f6; }
.selection-checkbox:hover { background:rgba(59,130,246,0.3); border-color:#3b82f6; }
`;
document.head.appendChild(styleSelection);

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createSelectionUI);
} else {
    createSelectionUI();
}

console.log('✅ Multi-select initialized');
