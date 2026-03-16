// ==================== PROGRESS TRACKING SYSTEM ====================
// Enhanced progress display with ETA and current file

let progressState = {
    startTime: 0,
    current: 0,
    total: 0,
    currentFile: ''
};

// calculate ETA
function calculateETA(current, total, startTime) {
    if (current === 0) return 'Calculating...';
    
    const elapsed = Date.now() - startTime;
    const rate = current / (elapsed / 1000); // images per second
    const remaining = total - current;
    const eta = remaining / rate;
    
    if (eta < 60) {
        return `${Math.round(eta)}s`;
    } else if (eta < 3600) {
        return `${Math.round(eta / 60)}m`;
    } else {
        const hours = Math.floor(eta / 3600);
        const mins = Math.round((eta % 3600) / 60);
        return `${hours}h ${mins}m`;
    }
}

// update progress display
function updateProgress(current, total, currentFile = '') {
    progressState = { startTime: progressState.startTime || Date.now(), current, total, currentFile };
    
    const percent = Math.round((current / total) * 100);
    const eta = calculateETA(current, total, progressState.startTime);
    
    // update progress bar
    const progressBar = document.getElementById('progressBar');
    if (progressBar) {
        progressBar.style.width = percent + '%';
    }
    
    // update text
    const progressText = document.getElementById('progressText');
    if (progressText) {
        progressText.innerHTML = `
            <div class="progress-main">${current}/${total} images (${percent}%)</div>
            <div class="progress-sub">ETA: ${eta} ${currentFile ? `• ${currentFile}` : ''}</div>
        `;
    }
    
    // update document title (browser tab)
    if (current < total) {
        document.title = `(${percent}%) Indexing... - Photo Searchly AI`;
    } else {
        document.title = 'Photo Searchly AI';
    }
}

// reset progress
function resetProgress() {
    progressState = { startTime: 0, current: 0, total: 0, currentFile: '' };
    
    const progressBar = document.getElementById('progressBar');
    if (progressBar) progressBar.style.width = '0%';
    
    const progressText = document.getElementById('progressText');
    if (progressText) progressText.textContent = '';
    
    document.title = 'Photo Searchly AI';
}

// Add this HTML to your index.html (replace existing progress elements):
/*
<div id="progressContainer" class="progress-container" style="display: none;">
    <div class="progress-wrapper">
        <div id="progressText" class="progress-text"></div>
        <div class="progress-bar-bg">
            <div id="progressBar" class="progress-bar"></div>
        </div>
    </div>
</div>

<!-- Add CSS -->
<style>
.progress-container {
    max-width: 600px;
    margin: 2rem auto;
    padding: 1.5rem;
    background: #1f2937;
    border-radius: 12px;
    border: 1px solid #374151;
}

.progress-wrapper {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.progress-text {
    color: #e5e7eb;
    font-size: 14px;
}

.progress-main {
    font-size: 16px;
    font-weight: 600;
    color: #60a5fa;
    margin-bottom: 4px;
}

.progress-sub {
    font-size: 13px;
    color: #9ca3af;
}

.progress-bar-bg {
    width: 100%;
    height: 8px;
    background: #374151;
    border-radius: 4px;
    overflow: hidden;
}

.progress-bar {
    height: 100%;
    background: linear-gradient(90deg, #3b82f6, #60a5fa);
    border-radius: 4px;
    transition: width 0.3s ease;
    box-shadow: 0 0 10px rgba(96, 165, 250, 0.5);
}
</style>
*/

// Usage in your indexing function:
/*
async function indexImages(files) {
    const total = files.length;
    progressState.startTime = Date.now();
    document.getElementById('progressContainer').style.display = 'block';
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Update progress with current file name
        updateProgress(i + 1, total, file.name);
        
        // Process image...
        await processImage(file);
    }
    
    // Complete
    updateProgress(total, total);
    showSuccess(`Successfully indexed ${total} images!`);
    
    setTimeout(() => {
        document.getElementById('progressContainer').style.display = 'none';
        resetProgress();
    }, 2000);
}
*/
