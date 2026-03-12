// ==================== DUPLICATE IMAGE DETECTION ====================

const DUPLICATE_THRESHOLD = 0.95; // 95% similarity = duplicate
let duplicateGroups = [];

// find duplicate images
function findDuplicates(threshold = DUPLICATE_THRESHOLD) {
    if (!models.embeddings || Object.keys(models.embeddings).length === 0) {
        if (typeof showError === 'function') {
            showError('No images indexed. Please index images first.');
        }
        return [];
    }
    
    const images = Object.entries(models.embeddings);
    const duplicates = [];
    const processed = new Set();
    
    // show progress
    if (typeof showSuccess === 'function') {
        showSuccess('Scanning for duplicates... This may take a moment.');
    }
    
    console.log(`Scanning ${images.length} images for duplicates...`);
    
    // compare each image with every other image
    for (let i = 0; i < images.length; i++) {
        if (processed.has(images[i][0])) continue;
        
        const [path1, img1] = images[i];
        const group = [{
            path: path1,
            url: img1.url,
            filename: img1.filename,
            vector: img1.vector
        }];
        
        // compare with remaining images
        for (let j = i + 1; j < images.length; j++) {
            if (processed.has(images[j][0])) continue;
            
            const [path2, img2] = images[j];
            
            // calculate cosine similarity
            let similarity = 0;
            for (let k = 0; k < img1.vector.length; k++) {
                similarity += img1.vector[k] * img2.vector[k];
            }
            
            // if similarity above threshold, it's a duplicate
            if (similarity >= threshold) {
                group.push({
                    path: path2,
                    url: img2.url,
                    filename: img2.filename,
                    vector: img2.vector,
                    similarity: similarity
                });
                processed.add(path2);
            }
        }
        
        // if group has duplicates, add to results
        if (group.length > 1) {
            duplicates.push(group);
            processed.add(path1);
        }
    }
    
    duplicateGroups = duplicates;
    console.log(`Found ${duplicates.length} groups of duplicates`);
    
    return duplicates;
}

// show duplicates in UI
async function showDuplicates() {
    if (!models.embeddings || Object.keys(models.embeddings).length === 0) {
        if (typeof showWarning === 'function') showWarning('Please index a folder first.');
        return;
    }

    const grid = document.getElementById('resultsGrid');
    if (grid) grid.innerHTML = '';

    // ── Python fast path ──────────────────────────────────────────────────────
    if (typeof _pyAvailable !== 'undefined' && _pyAvailable && typeof _currentFolder !== 'undefined' && _currentFolder) {
        if (typeof showInfo === 'function') showInfo('Finding duplicates...', 2000);
        try {
            const r = await fetch(`http://127.0.0.1:${_pyPort}/duplicates`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folder: _currentFolder, threshold: 0.99 })
            });
            if (r.ok) {
                const data = await r.json();
                // Convert Python format → internal format with blob URLs
                const duplicates = data.groups.map(group =>
                    group.map(item => {
                        const emb = models.embeddings[item.path];
                        return { url: emb?.url || '', filename: item.filename, score: item.score, path: item.path };
                    }).filter(i => i.url)
                ).filter(g => g.length > 1);

                if (duplicates.length === 0) {
                    if (typeof showSuccess === 'function') showSuccess('No duplicates found! All images are unique.');
                    return;
                }
                duplicateGroups = duplicates;   // ← needed so delete can find items by index
                createDuplicatesModal(duplicates);
                if (typeof showWarning === 'function') {
                    const total = duplicates.reduce((s, g) => s + g.length, 0);
                    showWarning(`Found ${duplicates.length} groups with ${total} duplicate images`);
                }
                return;
            }
        } catch(e) {
            console.warn('[Duplicates] Python call failed, falling back to JS:', e.message);
        }
    }

    // ── JS fallback ───────────────────────────────────────────────────────────
    const duplicates = findDuplicates();
    if (duplicates.length === 0) {
        if (typeof showSuccess === 'function') showSuccess('No duplicates found! All images are unique.');
        return;
    }
    createDuplicatesModal(duplicates);
    if (typeof showWarning === 'function') {
        const totalDuplicates = duplicates.reduce((sum, group) => sum + group.length, 0);
        showWarning(`Found ${duplicates.length} groups with ${totalDuplicates} duplicate images`);
    }
}

// create duplicates display modal
function createDuplicatesModal(duplicates) {
    // remove existing modal if any
    const existing = document.getElementById('duplicatesModal');
    if (existing) existing.remove();
    
    const totalDuplicates = duplicates.reduce((sum, group) => sum + group.length, 0);
    const potentialSavings = duplicates.reduce((sum, group) => sum + (group.length - 1), 0);
    
    const modal = document.createElement('div');
    modal.id = 'duplicatesModal';
    modal.className = 'duplicates-modal';
    modal.innerHTML = `
        <div class="duplicates-content">
            <div class="duplicates-header">
                <div>
                    <h2>🔍 Duplicate Images Found</h2>
                    <p class="duplicates-stats">
                        ${duplicates.length} groups • ${totalDuplicates} images • 
                        You can free up space by removing ${potentialSavings} duplicate(s)
                    </p>
                </div>
                <button onclick="closeDuplicatesModal()" class="close-modal-btn">×</button>
            </div>
            
            <div class="duplicates-toolbar">
                <button onclick="deleteAllDuplicates()" class="toolbar-btn delete-btn">
                    🗑️ Delete All Duplicates (Keep First)
                </button>
                <button id="dupSelectAllBtn" onclick="selectAllDuplicates()" class="toolbar-btn">
                    ☐ Select All
                </button>
                <button id="dupDeselectAllBtn" onclick="deselectAllDuplicates()" class="toolbar-btn">
                    ☐ Deselect All
                </button>
            </div>
            
            <div class="duplicates-groups">
                ${duplicates.map((group, groupIndex) => createDuplicateGroupHTML(group, groupIndex)).join('')}
            </div>
            
            <div class="duplicates-footer">
                <button onclick="deleteSelectedDuplicates()" class="footer-btn delete-btn">
                    Delete Selected
                </button>
                <button onclick="closeDuplicatesModal()" class="footer-btn">
                    Close
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// create HTML for one duplicate group
function createDuplicateGroupHTML(group, groupIndex) {
    return `
        <div class="duplicate-group">
            <div class="group-header">
                <span class="group-title">Group ${groupIndex + 1} - ${group.length} duplicates</span>
                <span class="group-similarity">${((group[1]?.similarity ?? group[1]?.score ?? 0) * 100).toFixed(1)}% similar</span>
            </div>
            <div class="group-images">
                ${group.map((img, imgIndex) => `
                    <div class="duplicate-item ${imgIndex === 0 ? 'is-original' : ''}" data-group="${groupIndex}" data-index="${imgIndex}">
                        ${imgIndex === 0 ? '<div class="original-badge">Original (Keep)</div>' : `
                            <div class="duplicate-checkbox" onclick="toggleDuplicateSelection(${groupIndex}, ${imgIndex})">
                                <span class="dup-checkbox-icon">☐</span>
                            </div>
                        `}
                        <img src="${img.url}" alt="${img.filename}" loading="lazy">
                        <div class="duplicate-info">
                            <div class="duplicate-filename">${img.filename}</div>
                            ${imgIndex > 0 ? `<div class="duplicate-similarity">${((img.similarity ?? img.score ?? 0) * 100).toFixed(1)}% match</div>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// toggle duplicate selection
function toggleDuplicateSelection(groupIndex, imgIndex) {
    const item = document.querySelector(`.duplicate-item[data-group="${groupIndex}"][data-index="${imgIndex}"]`);
    if (!item || imgIndex === 0) return; // can't select original
    
    const checkbox = item.querySelector('.dup-checkbox-icon');
    if (!checkbox) return;
    
    if (item.classList.contains('selected')) {
        item.classList.remove('selected');
        checkbox.textContent = '☐';
    } else {
        item.classList.add('selected');
        checkbox.textContent = '☑';
    }
}

// select all duplicates (except originals)
function selectAllDuplicates() {
    const items = document.querySelectorAll('.duplicate-item:not(.is-original)');
    items.forEach(item => {
        item.classList.add('selected');
        const checkbox = item.querySelector('.dup-checkbox-icon');
        if (checkbox) checkbox.textContent = '☑';
    });
    // Visual: mark Select All as active
    const sa = document.getElementById('dupSelectAllBtn');
    const da = document.getElementById('dupDeselectAllBtn');
    if (sa) { sa.textContent = '☑ Select All'; sa.style.cssText += ';border-color:#60a5fa;color:#60a5fa;'; }
    if (da) { da.textContent = '☐ Deselect All'; da.style.borderColor = ''; da.style.color = ''; }

    if (typeof showSuccess === 'function') {
        showSuccess(`Selected ${items.length} duplicates`);
    }
}

// deselect all duplicates
function deselectAllDuplicates() {
    const items = document.querySelectorAll('.duplicate-item.selected');
    items.forEach(item => {
        item.classList.remove('selected');
        const checkbox = item.querySelector('.dup-checkbox-icon');
        if (checkbox) checkbox.textContent = '☐';
    });
    // Visual: reset Select All, briefly highlight Deselect All
    const sa = document.getElementById('dupSelectAllBtn');
    const da = document.getElementById('dupDeselectAllBtn');
    if (sa) { sa.textContent = '☐ Select All'; sa.style.borderColor = ''; sa.style.color = ''; }
    if (da) { da.textContent = '☑ Deselect All'; da.style.cssText += ';border-color:#60a5fa;color:#60a5fa;'; }
    setTimeout(() => {
        if (da) { da.textContent = '☐ Deselect All'; da.style.borderColor = ''; da.style.color = ''; }
    }, 700);
}

// delete selected duplicates — permanently removes from disk
async function deleteSelectedDuplicates() {
    const selected = document.querySelectorAll('.duplicate-item.selected');

    if (selected.length === 0) {
        if (typeof showWarning === 'function') showWarning('No duplicates selected');
        return;
    }

    const confirmed = typeof showConfirmDialog === 'function'
        ? await showConfirmDialog(
            `Permanently delete ${selected.length} duplicate${selected.length > 1 ? 's' : ''} from disk?`,
            'This will delete the files from your PC. The originals in each group will be kept.',
            'Delete from Disk', 'Cancel')
        : confirm(`Delete ${selected.length} duplicate(s) from disk?`);
    if (!confirmed) return;

    // Collect items (url + absolutePath) for selected duplicates
    const urlsToDelete   = [];
    const pathsToDelete  = [];   // fallback for Python-path where lookup may differ
    selected.forEach(item => {
        const g = parseInt(item.dataset.group);
        const i = parseInt(item.dataset.index);
        if (typeof duplicateGroups !== 'undefined' && duplicateGroups[g]?.[i]) {
            const dup = duplicateGroups[g][i];
            if (dup.url)  urlsToDelete.push(dup.url);
            if (dup.path) pathsToDelete.push(dup.path);  // absolute path from Python
        }
    });

    if (typeof showInfo === 'function') showInfo(`Deleting ${urlsToDelete.length} file(s)...`, 2000);

    // Use real disk deletion — URL-based lookup first, then absolute-path fallback
    let deletedCount = 0, failedCount = 0;
    if (typeof deleteFilesFromStorage === 'function') {
        const { deletedFiles, failedFiles } = await deleteFilesFromStorage(urlsToDelete, pathsToDelete);
        deletedCount = deletedFiles.length;
        failedCount  = failedFiles.length;
    } else {
        // Fallback: index-only removal
        urlsToDelete.forEach(url => {
            const key = Object.keys(models.embeddings || {}).find(k => models.embeddings[k].url === url);
            if (key) { delete models.embeddings[key]; deletedCount++; }
        });
    }

    // Remove selected items from modal DOM
    selected.forEach(item => item.remove());

    if (deletedCount > 0 && typeof showSuccess === 'function')
        showSuccess(`✅ Deleted ${deletedCount} duplicate${deletedCount > 1 ? 's' : ''} from disk`);
    if (failedCount > 0 && typeof showError === 'function')
        showError(`⚠️ ${failedCount} file(s) could not be deleted`);

    if (typeof updateMemoryStatsUI === 'function') updateMemoryStatsUI();

    // Remove empty groups; close modal if fully cleared
    const remainingGroups = document.querySelectorAll('.duplicate-group');
    let hasRemaining = false;
    remainingGroups.forEach(group => {
        if (group.querySelectorAll('.duplicate-item:not(.is-original)').length === 0) {
            group.remove();
        } else {
            hasRemaining = true;
        }
    });
    if (!hasRemaining) {
        closeDuplicatesModal();
        if (typeof showSuccess === 'function') showSuccess('All duplicates cleared!');
    }
}

// delete all duplicates (keep first in each group) — permanently from disk
async function deleteAllDuplicates() {
    const allDuplicates = document.querySelectorAll('.duplicate-item:not(.is-original)');

    if (allDuplicates.length === 0) {
        if (typeof showWarning === 'function') showWarning('No duplicates to delete');
        return;
    }

    const confirmed = typeof showConfirmDialog === 'function'
        ? await showConfirmDialog(
            `Permanently delete all ${allDuplicates.length} duplicates from disk?`,
            'Keeps the first image in each group. All other duplicates will be permanently deleted from your PC.',
            'Delete All from Disk', 'Cancel')
        : confirm(`Delete ALL ${allDuplicates.length} duplicates from disk?`);
    if (!confirmed) return;

    // Select all then trigger disk deletion
    selectAllDuplicates();
    // Small delay to allow DOM selection to settle
    await new Promise(r => setTimeout(r, 80));
    await deleteSelectedDuplicates();
}

// close duplicates modal
function closeDuplicatesModal() {
    const modal = document.getElementById('duplicatesModal');
    if (modal) {
        modal.classList.add('closing');
        setTimeout(() => modal.remove(), 300);
    }
}

// add find duplicates button
function addFindDuplicatesButton() {
    const headerRight = document.querySelector('.header-content');
    if (headerRight && !document.getElementById('findDuplicatesBtn')) {
        const dupBtn = document.createElement('button');
        dupBtn.id = 'findDuplicatesBtn';
        dupBtn.className = 'find-duplicates-btn';
        dupBtn.innerHTML = '🔍 Find Duplicates';
        dupBtn.onclick = showDuplicates;
        
        headerRight.appendChild(dupBtn);
    }
}

// Add CSS
const styleDuplicates = document.createElement('style');
styleDuplicates.textContent = `
.find-duplicates-btn {
    background: linear-gradient(135deg, #8b5cf6, #7c3aed);
    border: 1px solid #7c3aed;
    border-radius: 8px;
    color: white;
    padding: 8px 16px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s;
}

.find-duplicates-btn:hover {
    background: linear-gradient(135deg, #7c3aed, #6d28d9);
    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
}

.duplicates-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    animation: fadeIn 0.3s ease;
    padding: 20px;
}

.duplicates-modal.closing {
    animation: fadeOut 0.3s ease;
}

.duplicates-content {
    background: #1f2937;
    border: 1px solid #374151;
    border-radius: 16px;
    width: 100%;
    max-width: 1200px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.duplicates-header {
    padding: 24px;
    border-bottom: 1px solid #374151;
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.duplicates-header h2 {
    color: #e5e7eb;
    margin: 0 0 8px 0;
    font-size: 24px;
}

.duplicates-stats {
    color: #9ca3af;
    font-size: 14px;
    margin: 0;
}

.close-modal-btn {
    background: none;
    border: none;
    color: #9ca3af;
    font-size: 36px;
    cursor: pointer;
    padding: 0;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    transition: all 0.2s;
}

.close-modal-btn:hover {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
}

.duplicates-toolbar {
    padding: 16px 24px;
    border-bottom: 1px solid #374151;
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
}

.toolbar-btn {
    background: #374151;
    border: 1px solid #4b5563;
    border-radius: 6px;
    color: #e5e7eb;
    padding: 8px 16px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
}

.toolbar-btn:hover {
    background: #4b5563;
}

.toolbar-btn.delete-btn {
    background: linear-gradient(135deg, #ef4444, #dc2626);
    border-color: #dc2626;
    color: white;
}

.toolbar-btn.delete-btn:hover {
    background: linear-gradient(135deg, #dc2626, #b91c1c);
}

.duplicates-groups {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
}

.duplicate-group {
    background: #111827;
    border: 1px solid #374151;
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 24px;
}

.group-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid #374151;
}

.group-title {
    color: #e5e7eb;
    font-weight: 600;
    font-size: 16px;
}

.group-similarity {
    color: #f59e0b;
    font-size: 14px;
    font-weight: 500;
}

.group-images {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 16px;
}

.duplicate-item {
    position: relative;
    background: #1f2937;
    border: 2px solid #374151;
    border-radius: 8px;
    overflow: hidden;
    cursor: pointer;
    transition: all 0.2s;
}

.duplicate-item:hover {
    border-color: #4b5563;
    transform: translateY(-2px);
}

.duplicate-item.selected {
    border-color: #3b82f6;
    background: rgba(59, 130, 246, 0.1);
}

.duplicate-item.is-original {
    border-color: #10b981;
    cursor: default;
}

.duplicate-item.is-original:hover {
    transform: none;
}

.duplicate-item img {
    width: 100%;
    height: 200px;
    object-fit: cover;
    display: block;
}

.original-badge {
    position: absolute;
    top: 8px;
    right: 8px;
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
    padding: 4px 12px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    z-index: 10;
}

.duplicate-checkbox {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 32px;
    height: 32px;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(10px);
    border: 2px solid #374151;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
    cursor: pointer;
    transition: all 0.2s;
}

.duplicate-checkbox:hover {
    background: rgba(59, 130, 246, 0.3);
    border-color: #3b82f6;
}

.duplicate-item.selected .duplicate-checkbox {
    background: #3b82f6;
    border-color: #3b82f6;
}

.dup-checkbox-icon {
    font-size: 20px;
    color: #e5e7eb;
}

.duplicate-info {
    padding: 12px;
}

.duplicate-filename {
    color: #e5e7eb;
    font-size: 13px;
    font-weight: 500;
    margin-bottom: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.duplicate-similarity {
    color: #f59e0b;
    font-size: 12px;
}

.duplicates-footer {
    padding: 16px 24px;
    border-top: 1px solid #374151;
    display: flex;
    gap: 12px;
    justify-content: flex-end;
}

.footer-btn {
    background: #374151;
    border: 1px solid #4b5563;
    border-radius: 8px;
    color: #e5e7eb;
    padding: 10px 24px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
}

.footer-btn:hover {
    background: #4b5563;
}

.footer-btn.delete-btn {
    background: linear-gradient(135deg, #ef4444, #dc2626);
    border-color: #dc2626;
    color: white;
}

.footer-btn.delete-btn:hover {
    background: linear-gradient(135deg, #dc2626, #b91c1c);
}

/* Scrollbar */
.duplicates-groups::-webkit-scrollbar {
    width: 12px;
}

.duplicates-groups::-webkit-scrollbar-track {
    background: #111827;
}

.duplicates-groups::-webkit-scrollbar-thumb {
    background: #4b5563;
    border-radius: 6px;
}

.duplicates-groups::-webkit-scrollbar-thumb:hover {
    background: #6b7280;
}

@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

@keyframes fadeOut {
    from { opacity: 1; }
    to { opacity: 0; }
}
`;
document.head.appendChild(styleDuplicates);

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addFindDuplicatesButton);
} else {
    addFindDuplicatesButton();
}

console.log('Duplicate detection initialized');
