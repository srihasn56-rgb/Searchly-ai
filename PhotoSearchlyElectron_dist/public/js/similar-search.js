// ==================== SIMILAR IMAGE SEARCH - BOTTOM RIGHT POSITION ====================

function findSimilarImages(targetEmbedding, targetPath, maxResults = 10) {
    if (!models.embeddings || Object.keys(models.embeddings).length === 0) {
        if (typeof showError === 'function') {
            showError('No images indexed. Please index images first.');
        }
        return [];
    }
    
    const similarities = [];
    
    for (const [path, img] of Object.entries(models.embeddings)) {
        if (path === targetPath) continue;
        
        let similarity = 0;
        for (let i = 0; i < targetEmbedding.length; i++) {
            similarity += targetEmbedding[i] * img.vector[i];
        }
        
        similarities.push({
            path: path,
            url: img.url,
            filename: img.filename,
            similarity: similarity
        });
    }
    
    similarities.sort((a, b) => b.similarity - a.similarity);
    return similarities.slice(0, maxResults);
}

async function showSimilarImages(imagePath) {
    // Resolve to embedding entry — handle blob URL or absolute path key
    let emb = models.embeddings?.[imagePath];
    if (!emb) {
        const match = Object.entries(models.embeddings || {}).find(([k,v]) => v.url === imagePath);
        if (match) { imagePath = match[0]; emb = match[1]; }
    }
    if (!emb) {
        if (typeof showError === 'function') showError('Image not found in index');
        return;
    }

    const targetFilename = emb.filename || emb.entryFilename || imagePath.split(/[\/]/).pop();
    let similar = [];

    // ── Python fast path (no vector needed in JS) ─────────────────────────────
    if (typeof _pyAvailable !== 'undefined' && _pyAvailable &&
        typeof _currentFolder !== 'undefined' && _currentFolder &&
        (emb.absolutePath || emb.localPath)) {

        try {
            const absPath = emb.absolutePath || emb.localPath;
            const r = await fetch(`http://127.0.0.1:${_pyPort}/similar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: absPath, folder: _currentFolder, top_k: 20 })
            });
            if (r.ok) {
                const data = await r.json();
                similar = data.results.map(item => {
                    const e = models.embeddings[item.path];
                    return e?.url ? { url: e.url, filename: item.filename, similarity: item.score } : null;
                }).filter(Boolean);
            }
        } catch(e) {
            console.warn('[Similar] Python call failed, falling back to JS:', e.message);
        }
    }

    // ── JS fallback (uses stored vectors) ─────────────────────────────────────
    if (similar.length === 0) {
        if (!emb.vector) {
            if (typeof showWarning === 'function') showWarning('Vectors not available. Re-index the folder to enable similarity search.');
            return;
        }
        similar = findSimilarImages(emb.vector, imagePath, 20);
    }

    if (similar.length === 0) {
        if (typeof showWarning === 'function') showWarning('No similar images found');
        return;
    }

    window.lastSearchResults = similar;

    const debugPanel = document.getElementById('debugPanel');
    if (debugPanel) {
        debugPanel.classList.add('active');
        debugPanel.innerHTML = `
            <div style="color: #60a5fa; font-weight: bold; margin-bottom: 0.5rem;">
                🔍 Similar to: ${targetFilename}
            </div>
            <div class="debug-row">
                <span>Found:</span>
                <span>${similar.length} similar images</span>
            </div>
        `;
    }

    if (typeof displayResults === 'function') displayResults(similar);
    if (typeof showSuccess === 'function') showSuccess(`Found ${similar.length} similar images!`);
}

function addSimilarSearchButtons() {
    const resultCards = document.querySelectorAll('.result-card');
    
    resultCards.forEach((card) => {
        if (card.querySelector('.similar-btn')) return;
        
        const img = card.querySelector('img');
        if (!img || !img.src) return;
        
        const imagePath = Object.keys(models.embeddings).find(path => {
            return models.embeddings[path].url === img.src;
        });
        
        if (!imagePath) return;
        
        const similarBtn = document.createElement('button');
        similarBtn.className = 'similar-btn';
        similarBtn.innerHTML = '🔍 Similar';
        similarBtn.title = 'Find similar images';
        
        // FIXED: Prevent image viewer from opening
        similarBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            e.stopImmediatePropagation();
            showSimilarImages(imagePath);
            return false;
        }, true);
        
        // Prevent mousedown propagation
        similarBtn.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
        }, true);
        
        card.appendChild(similarBtn);
    });
}

// displayResults hook handled by power-features.js

// CSS - BOTTOM RIGHT POSITION
const styleSimilar = document.createElement('style');
styleSimilar.textContent = `
.similar-btn {
    position: absolute;
    bottom: 12px;
    right: 12px;
    background: linear-gradient(135deg, #10b981, #059669);
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    color: white;
    padding: 8px 14px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    opacity: 0;
    transform: translateY(10px);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
    z-index: 1000 !important;
    pointer-events: auto !important;
    backdrop-filter: blur(10px);
}

.result-card:hover .similar-btn {
    opacity: 1;
    transform: translateY(0);
}

.similar-btn:hover {
    background: linear-gradient(135deg, #059669, #047857);
    box-shadow: 0 6px 20px rgba(16, 185, 129, 0.6);
    transform: translateY(-2px);
}

.similar-btn:active {
    transform: translateY(0);
}
`;
document.head.appendChild(styleSimilar);

console.log('✅ Similar search initialized (bottom-right, fixed)');
