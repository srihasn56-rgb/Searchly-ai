// ==================== TOAST NOTIFICATION SYSTEM ====================

// Global errors are logged to console only — not shown as scary toasts
window.addEventListener('error', (e) => {
    console.error('[Searchly] Unhandled error:', e.message, e.filename, e.lineno);
});
window.addEventListener('unhandledrejection', (e) => {
    console.error('[Searchly] Unhandled promise rejection:', e.reason);
});

// ── Inject toast styles once ─────────────────────────────────────────────────
(function injectToastStyles() {
    if (document.getElementById('searchly-toast-styles')) return;
    const style = document.createElement('style');
    style.id = 'searchly-toast-styles';
    style.textContent = `
        #searchly-toast-container {
            position: fixed;
            top: 76px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 99999;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
            pointer-events: none;
            width: max-content;
            max-width: 90vw;
        }

        .searchly-toast {
            pointer-events: auto;
            position: relative;
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 18px;
            border-radius: 10px;
            min-width: 220px;
            max-width: 420px;
            width: max-content;
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            box-shadow:
                0 4px 24px rgba(0,0,0,0.45),
                0 1px 4px rgba(0,0,0,0.25),
                inset 0 1px 0 rgba(255,255,255,0.08);
            animation: searchlyToastIn 0.28s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        .searchly-toast.fade-out {
            animation: searchlyToastOut 0.3s ease forwards;
        }

        /* Success */
        .searchly-toast.success {
            background: rgba(16, 185, 129, 0.18);
            border: 1px solid rgba(16, 185, 129, 0.4);
        }

        /* Error */
        .searchly-toast.error {
            background: rgba(239, 68, 68, 0.18);
            border: 1px solid rgba(239, 68, 68, 0.4);
        }

        /* Warning */
        .searchly-toast.warning {
            background: rgba(245, 158, 11, 0.18);
            border: 1px solid rgba(245, 158, 11, 0.4);
        }

        /* Info */
        .searchly-toast.info {
            background: rgba(59, 130, 246, 0.18);
            border: 1px solid rgba(59, 130, 246, 0.4);
        }

        .searchly-toast-icon {
            font-size: 16px;
            flex-shrink: 0;
            line-height: 1;
        }

        .searchly-toast-message {
            flex: 1;
            font-size: 13px;
            font-weight: 500;
            line-height: 1.4;
            color: #f1f5f9;
            letter-spacing: 0.01em;
        }

        .searchly-toast-close {
            background: none;
            border: none;
            color: rgba(255,255,255,0.5);
            font-size: 18px;
            cursor: pointer;
            padding: 0;
            width: 22px;
            height: 22px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            transition: all 0.15s;
            flex-shrink: 0;
            line-height: 1;
        }

        .searchly-toast-close:hover {
            color: #fff;
            background: rgba(255,255,255,0.1);
        }

        /* Progress bar at bottom of toast */
        .searchly-toast-progress {
            position: absolute;
            bottom: 0;
            left: 0;
            height: 3px;
            border-radius: 0 0 16px 16px;
            animation: searchlyProgress linear forwards;
        }

        .success .searchly-toast-progress  { background: #10b981; }
        .error   .searchly-toast-progress  { background: #ef4444; }
        .warning .searchly-toast-progress  { background: #f59e0b; }
        .info    .searchly-toast-progress  { background: #3b82f6; }

        .searchly-toast { position: relative; overflow: hidden; }

        @keyframes searchlyToastIn {
            from {
                opacity: 0;
                transform: scale(0.85);
            }
            to {
                opacity: 1;
                transform: scale(1);
            }
        }

        @keyframes searchlyToastOut {
            from {
                opacity: 1;
                transform: scale(1);
            }
            to {
                opacity: 0;
                transform: scale(0.85);
            }
        }

        @keyframes searchlyProgress {
            from { width: 100%; }
            to   { width: 0%; }
        }
    `;
    document.head.appendChild(style);
})();

// ── Get or create container ──────────────────────────────────────────────────
function getToastContainer() {
    let container = document.getElementById('searchly-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'searchly-toast-container';
        document.body.appendChild(container);
    }
    return container;
}

// ── Core toast function ──────────────────────────────────────────────────────
function showToast(message, type = 'info', duration = 2500) {
    const container = getToastContainer();

    // Dismiss ALL existing toasts first — show one at a time, never stack
    container.querySelectorAll('.searchly-toast').forEach(t => dismissToast(t));

    const toast = document.createElement('div');
    toast.className = `searchly-toast ${type}`;

    const icons = { success: '✅', error: '⚠️', warning: '⚡', info: 'ℹ️' };

    toast.innerHTML = `
        <span class="searchly-toast-icon">${icons[type] || 'ℹ️'}</span>
        <span class="searchly-toast-message">${message}</span>
        <button class="searchly-toast-close" aria-label="Dismiss">×</button>
        <div class="searchly-toast-progress" style="animation-duration: ${duration}ms"></div>
    `;

    // Close button
    toast.querySelector('.searchly-toast-close').addEventListener('click', () => dismissToast(toast));

    container.appendChild(toast);

    // Auto-dismiss
    const timer = setTimeout(() => dismissToast(toast), duration);
    toast._timer = timer;

    return toast;
}

function dismissToast(toast) {
    if (toast._dismissed) return;
    toast._dismissed = true;
    clearTimeout(toast._timer);
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
}

// ── Public API ───────────────────────────────────────────────────────────────
function showSuccess(message, duration = 2500) { showToast(message, 'success', duration); }
function showError(message, duration = 5000)   { showToast(message, 'error',   duration); }
function showWarning(message, duration = 3500) { showToast(message, 'warning', duration); }
function showInfo(message, duration = 2500)    { showToast(message, 'info',    duration); }

// ── Utility functions ────────────────────────────────────────────────────────
async function safeFetch(url, options = {}) {
    try {
        const response = await fetch(url, options);
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        return response;
    } catch (error) {
        if (error.name === 'TypeError') throw new Error('Network error. Please check your connection.');
        throw error;
    }
}

function sanitizeInput(input, maxLength = 100) {
    if (!input || typeof input !== 'string') return '';
    return input.trim().replace(/[<>]/g, '').replace(/['"]/g, '').slice(0, maxLength);
}

function checkMemoryLimit() {
    const embeddingCount = Object.keys(models.embeddings || {}).length;
    if (embeddingCount > 5000) {
        showWarning(`${embeddingCount} images indexed — consider splitting into smaller folders`);
        return false;
    }
    return true;
}

function clearCache() {
    if (models.embeddings) {
        const count = Object.keys(models.embeddings).length;
        models.embeddings = {};
        if (window.gc) window.gc();
        showSuccess(`Cleared ${count} cached embeddings`);
    }
}
