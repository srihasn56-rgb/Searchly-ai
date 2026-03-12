// ==================== MEMORY MANAGEMENT SYSTEM ====================
// Prevents browser crashes from too many cached embeddings

const MEMORY_CONFIG = {
    MAX_EMBEDDINGS: 5000,           // Maximum number of images to keep in memory
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB per file
    WARNING_THRESHOLD: 4000,         // Warn when approaching limit
    CLEANUP_BATCH: 500              // How many to remove when cleaning
};

// check if we're approaching memory limits
function checkMemoryUsage() {
    const count = Object.keys(models.embeddings || {}).length;
    
    if (count >= MEMORY_CONFIG.MAX_EMBEDDINGS) {
        showError(`Memory limit reached! Maximum ${MEMORY_CONFIG.MAX_EMBEDDINGS} images. Please clear cache or use smaller folders.`);
        return false;
    }
    
    if (count >= MEMORY_CONFIG.WARNING_THRESHOLD) {
        showWarning(`Approaching memory limit: ${count}/${MEMORY_CONFIG.MAX_EMBEDDINGS} images cached. Consider clearing cache for better performance.`);
    }
    
    return true;
}

// check file size before processing
function checkFileSize(file) {
    if (file.size > MEMORY_CONFIG.MAX_FILE_SIZE) {
        console.warn(`File ${file.name} exceeds max size (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
        return false;
    }
    return true;
}

// get memory usage estimate
function getMemoryUsage() {
    const count = Object.keys(models.embeddings || {}).length;
    const embeddingSize = 512 * 4; // 512 floats × 4 bytes
    const totalBytes = count * embeddingSize;
    const totalMB = (totalBytes / 1024 / 1024).toFixed(2);
    
    return {
        count,
        bytes: totalBytes,
        mb: totalMB,
        percentage: Math.round((count / MEMORY_CONFIG.MAX_EMBEDDINGS) * 100)
    };
}

// show memory stats
function showMemoryStats() {
    const usage = getMemoryUsage();
    console.log(`
╔══════════════════════════════════════╗
║     Memory Usage Statistics          ║
╠══════════════════════════════════════╣
║ Cached Images: ${usage.count.toString().padStart(20)} ║
║ Memory Used:   ${usage.mb.toString().padStart(17)}MB ║
║ Capacity:      ${usage.percentage.toString().padStart(18)}% ║
╚══════════════════════════════════════╝
    `);
}

// clear old/least used embeddings (LRU)
function clearOldEmbeddings(keepCount = MEMORY_CONFIG.MAX_EMBEDDINGS - MEMORY_CONFIG.CLEANUP_BATCH) {
    if (!models.embeddings) return;
    
    const entries = Object.entries(models.embeddings);
    
    if (entries.length <= keepCount) {
        console.log('No cleanup needed');
        return;
    }
    
    // Sort by last access time (if we track it) or just keep first N
    const toKeep = entries.slice(0, keepCount);
    const removed = entries.length - keepCount;
    
    models.embeddings = Object.fromEntries(toKeep);
    
    // hint garbage collection
    if (window.gc) window.gc();
    
    showSuccess(`Cleared ${removed} old embeddings to free memory`);
    console.log(`Removed ${removed} embeddings, kept ${keepCount}`);
}

// auto-cleanup on threshold
function autoCleanup() {
    const count = Object.keys(models.embeddings || {}).length;
    
    if (count >= MEMORY_CONFIG.MAX_EMBEDDINGS) {
        console.log('Auto-cleanup triggered');
        clearOldEmbeddings();
    }
}

// monitor memory periodically
let memoryMonitor = null;

function startMemoryMonitoring(intervalMs = 30000) { // Check every 30 seconds
    if (memoryMonitor) {
        clearInterval(memoryMonitor);
    }
    
    memoryMonitor = setInterval(() => {
        const usage = getMemoryUsage();
        
        if (usage.percentage >= 90) {
            showWarning('Memory usage critical! Auto-cleanup recommended.');
            autoCleanup();
        } else if (usage.percentage >= 80) {
            console.warn(`Memory usage: ${usage.percentage}% - approaching limit`);
        }
    }, intervalMs);
}

function stopMemoryMonitoring() {
    if (memoryMonitor) {
        clearInterval(memoryMonitor);
        memoryMonitor = null;
    }
}

// add to UI - memory stats display
function createMemoryStatsUI() {
    const statsDiv = document.createElement('div');
    statsDiv.id = 'memoryStats';
    statsDiv.className = 'memory-stats';
    statsDiv.innerHTML = `
        <div class="memory-stats-header">
            <span>Memory</span>
            <button onclick="showMemoryStats()" class="stats-btn">📊</button>
            <button onclick="clearCache()" class="clear-btn">🗑️</button>
        </div>
        <div class="memory-stats-bar">
            <div id="memoryBar" class="memory-bar"></div>
        </div>
        <div id="memoryText" class="memory-text"></div>
    `;
    
    return statsDiv;
}

function updateMemoryStatsUI() {
    const usage = getMemoryUsage();
    const memoryBar = document.getElementById('memoryBar');
    const memoryText = document.getElementById('memoryText');
    
    if (memoryBar) {
        memoryBar.style.width = usage.percentage + '%';
        memoryBar.className = 'memory-bar ' + 
            (usage.percentage >= 90 ? 'critical' : 
             usage.percentage >= 80 ? 'warning' : 'normal');
    }
    
    if (memoryText) {
        memoryText.textContent = `${usage.count} images (${usage.mb}MB)`;
    }
}

// CSS for memory stats (add to your stylesheet)
/*
.memory-stats {
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #1f2937;
    border: 1px solid #374151;
    border-radius: 8px;
    padding: 12px;
    min-width: 200px;
    z-index: 1000;
}

.memory-stats-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
    color: #e5e7eb;
    font-size: 12px;
    font-weight: 600;
}

.stats-btn, .clear-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 16px;
    padding: 4px;
    opacity: 0.8;
    transition: opacity 0.2s;
}

.stats-btn:hover, .clear-btn:hover {
    opacity: 1;
}

.memory-stats-bar {
    width: 100%;
    height: 6px;
    background: #374151;
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 6px;
}

.memory-bar {
    height: 100%;
    border-radius: 3px;
    transition: width 0.3s ease, background 0.3s ease;
}

.memory-bar.normal {
    background: linear-gradient(90deg, #10b981, #059669);
}

.memory-bar.warning {
    background: linear-gradient(90deg, #f59e0b, #d97706);
}

.memory-bar.critical {
    background: linear-gradient(90deg, #ef4444, #dc2626);
}

.memory-text {
    font-size: 11px;
    color: #9ca3af;
    text-align: center;
}
*/

// Initialize memory management
function initMemoryManagement() {
    // Start monitoring
    startMemoryMonitoring();
    
    // Add UI
    const statsUI = createMemoryStatsUI();
    document.body.appendChild(statsUI);
    
    // Update UI every 5 seconds
    setInterval(updateMemoryStatsUI, 5000);
    updateMemoryStatsUI();
    
    console.log('Memory management initialized');
}

// Usage example in your indexing function:
/*
async function indexImages(files) {
    // Check if we can process this many files
    if (!checkMemoryUsage()) {
        return; // Memory limit reached
    }
    
    for (const file of files) {
        // Check individual file size
        if (!checkFileSize(file)) {
            console.warn(`Skipping ${file.name} - too large`);
            continue;
        }
        
        // Process file...
        await processImage(file);
        
        // Auto-cleanup if needed
        autoCleanup();
    }
}
*/
