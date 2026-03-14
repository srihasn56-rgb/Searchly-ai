// ==================== PROFESSIONAL HEADER - SIMPLE TOOLTIPS & REPOSITIONED PROGRESS ====================

const headerStyles = document.createElement('style');
headerStyles.textContent = `
/* Professional Header */
.header {
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    border-bottom: 1px solid rgba(59, 130, 246, 0.2);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.header-content {
    max-width: 1400px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 2rem;
}

/* Action Buttons Container */
.header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
}

/* Select Images Button - NO ACTIVE HOVER TOOLTIP */
.selection-mode-btn, #selectionModeBtn {
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    border: 2px solid rgba(96, 165, 250, 0.3);
    border-radius: 10px;
    color: white;
    padding: 10px 20px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
    display: flex;
    align-items: center;
    gap: 8px;
    letter-spacing: 0.3px;
    position: relative;
}

.selection-mode-btn:hover, #selectionModeBtn:hover {
    background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
    box-shadow: 0 6px 20px rgba(59, 130, 246, 0.5);
    transform: translateY(-2px);
}

.selection-mode-btn.active, #selectionModeBtn.active {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    border-color: rgba(16, 185, 129, 0.4);
}

/* Find Duplicates Button */
.find-duplicates-btn, #findDuplicatesBtn {
    background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
    border: 2px solid rgba(139, 92, 246, 0.3);
    border-radius: 10px;
    color: white;
    padding: 10px 20px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
    display: flex;
    align-items: center;
    gap: 8px;
    letter-spacing: 0.3px;
    position: relative;
}

.find-duplicates-btn:hover, #findDuplicatesBtn:hover {
    background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
    box-shadow: 0 6px 20px rgba(139, 92, 246, 0.5);
    transform: translateY(-2px);
}

/* SIMPLE TOOLTIPS - ONLY ON INITIAL HOVER */
.selection-mode-btn:not(.active):hover::after, 
#selectionModeBtn:not(.active):hover::after {
    content: 'Select multiple images';
    position: absolute;
    bottom: -35px;
    left: 50%;
    transform: translateX(-50%);
    background: #1f2937;
    color: #e5e7eb;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 11px;
    white-space: nowrap;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 1000;
    pointer-events: none;
}

.find-duplicates-btn:hover::after, 
#findDuplicatesBtn:hover::after {
    content: 'Find duplicate images';
    position: absolute;
    bottom: -35px;
    left: 50%;
    transform: translateX(-50%);
    background: #1f2937;
    color: #e5e7eb;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 11px;
    white-space: nowrap;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 1000;
    pointer-events: none;
}

/* Progress Container - REPOSITIONED */
#progressContainer {
    position: fixed !important;
    bottom: 80px !important;
    right: 20px !important;
    top: auto !important;
    left: auto !important;
    max-width: 350px !important;
    z-index: 999 !important;
    margin: 0 !important;
}

/* Progress auto-hide after completion */
.progress-container.completed {
    animation: fadeOut 0.5s ease 7s forwards;
}

@keyframes fadeOut {
    to {
        opacity: 0;
        pointer-events: none;
    }
}

/* Responsive */
@media (max-width: 768px) {
    .header-actions {
        flex-direction: column;
        width: 100%;
    }
    
    .selection-mode-btn, #selectionModeBtn,
    .find-duplicates-btn, #findDuplicatesBtn {
        width: 100%;
        justify-content: center;
    }
    
    #progressContainer {
        right: 10px !important;
        bottom: 100px !important;
        max-width: calc(100% - 20px) !important;
    }
}
`;
document.head.appendChild(headerStyles);

// Move buttons to header
function reorganizeHeader() {
    const header = document.querySelector('.header-content');
    if (!header) return;
    
    let actionsContainer = header.querySelector('.header-actions');
    if (!actionsContainer) {
        actionsContainer = document.createElement('div');
        actionsContainer.className = 'header-actions';
        header.appendChild(actionsContainer);
    }
    
    const selectBtn = document.getElementById('selectionModeBtn');
    if (selectBtn && !actionsContainer.contains(selectBtn)) {
        actionsContainer.appendChild(selectBtn);
    }
    
    const duplicatesBtn = document.getElementById('findDuplicatesBtn');
    if (duplicatesBtn && !actionsContainer.contains(duplicatesBtn)) {
        actionsContainer.appendChild(duplicatesBtn);
    }
}

// ── Enable/disable header action buttons based on whether images are indexed ──
function updateHeaderButtonState() {
    const hasImages = typeof models !== 'undefined' &&
                      models.embeddings &&
                      Object.keys(models.embeddings).length > 0;

    const selectBtn = document.getElementById('selectionModeBtn');
    const dupBtn    = document.getElementById('findDuplicatesBtn');

    if (selectBtn) {
        selectBtn.disabled = !hasImages;
        selectBtn.style.opacity = hasImages ? '' : '0.45';
        selectBtn.style.cursor  = hasImages ? '' : 'not-allowed';
        selectBtn.title = hasImages ? '' : 'Index a folder first';
    }
    if (dupBtn) {
        dupBtn.disabled = !hasImages;
        dupBtn.style.opacity = hasImages ? '' : '0.45';
        dupBtn.style.cursor  = hasImages ? '' : 'not-allowed';
        dupBtn.title = hasImages ? '' : 'Index a folder first';
    }
}
window.updateHeaderButtonState = updateHeaderButtonState;

// Poll every 500ms to keep button state in sync with indexing
setInterval(updateHeaderButtonState, 500);

// Also run on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateHeaderButtonState);
} else {
    updateHeaderButtonState();
}

// Auto-hide progress after 7 seconds
function setupProgressAutoHide() {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            const progressContainer = document.getElementById('progressContainer');
            if (progressContainer && progressContainer.style.display !== 'none') {
                const progressText = progressContainer.textContent;
                if (progressText.includes('Completed') || progressText.includes('ready')) {
                    progressContainer.classList.add('completed');
                    setTimeout(() => {
                        progressContainer.style.display = 'none';
                        progressContainer.classList.remove('completed');
                    }, 7000);
                }
            }
        });
    });
    
    const progressContainer = document.getElementById('progressContainer');
    if (progressContainer) {
        observer.observe(progressContainer, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }
}

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            reorganizeHeader();
            setupProgressAutoHide();
        }, 500);
    });
} else {
    setTimeout(() => {
        reorganizeHeader();
        setupProgressAutoHide();
    }, 500);
}

console.log('✅ Professional header loaded (simple tooltips, repositioned progress)');
