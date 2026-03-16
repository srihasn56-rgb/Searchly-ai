
// Search history stack
let navigationStack = [];
let currentStackIndex = -1;

function saveToNavigationStack(type, data) {
    
    navigationStack = navigationStack.slice(0, currentStackIndex + 1);
    
    
    navigationStack.push({ type, data, timestamp: Date.now() });
    currentStackIndex = navigationStack.length - 1;
    
    updateBackButtonVisibility();
}


function navigateBack() {
    if (currentStackIndex <= 0) {
        console.log('No previous page');
        return;
    }
    
    
    currentStackIndex--;
    
    const previousPage = navigationStack[currentStackIndex];
    
    console.log('Navigating back to:', previousPage);
    
    if (previousPage.type === 'search') {
        // Restore search results
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = previousPage.data.query;
        }
        
        
        if (previousPage.data.results && previousPage.data.results.length > 0) {
            displayResults(previousPage.data.results);
            
            if (typeof showSuccess === 'function') {
                showSuccess(`Showing ${previousPage.data.results.length} results for "${previousPage.data.query}"`);
            }
        }
    } else if (previousPage.type === 'similar') {
        // Restore similar results
        if (previousPage.data.results && previousPage.data.results.length > 0) {
            displayResults(previousPage.data.results);
            
            if (typeof showSuccess === 'function') {
                showSuccess(`Showing ${previousPage.data.results.length} similar images`);
            }
        }
    }
    
    updateBackButtonVisibility();
}

// Update back button visibility
function updateBackButtonVisibility() {
    const backBtn = document.querySelector('.back-btn');
    if (backBtn) {
        if (currentStackIndex > 0) {
            backBtn.classList.add('active');
            backBtn.style.display = 'flex';
            backBtn.onclick = navigateBack;
        } else {
            backBtn.classList.remove('active');
            backBtn.style.display = 'none';
        }
    }
}

// Override performSearch to save to stack
(function() {
    const originalPerformSearch = window.performSearch;
    if (originalPerformSearch) {
        window.performSearch = async function() {
            const query = document.getElementById('searchInput')?.value?.trim();
            
            if (!query) return;
            
            // Perform the search
            const result = await originalPerformSearch.apply(this, arguments);
            
            // Wait a bit for results to be displayed
            setTimeout(() => {
                // Get the current results
                const results = [];
                const resultCards = document.querySelectorAll('.result-card');
                
                resultCards.forEach(card => {
                    const img = card.querySelector('img');
                    if (img && img.src) {
                        // Find this image in embeddings
                        const imagePath = Object.keys(models.embeddings || {}).find(path => {
                            return models.embeddings[path].url === img.src;
                        });
                        
                        if (imagePath && models.embeddings[imagePath]) {
                            results.push({
                                path: imagePath,
                                url: models.embeddings[imagePath].url,
                                filename: models.embeddings[imagePath].filename,
                                similarity: 1.0
                            });
                        }
                    }
                });
                
                // Save to navigation stack
                saveToNavigationStack('search', {
                    query: query,
                    results: results
                });
                
                console.log('Saved search to navigation:', query, results.length, 'results');
            }, 500);
            
            return result;
        };
    }
})();

// Override showSimilarImages to save to stack
(function() {
    const originalShowSimilar = window.showSimilarImages;
    if (originalShowSimilar) {
        window.showSimilarImages = function(imagePath) {
            const result = originalShowSimilar.apply(this, arguments);
            
            // Wait for results to be displayed
            setTimeout(() => {
                const results = [];
                const resultCards = document.querySelectorAll('.result-card');
                
                resultCards.forEach(card => {
                    const img = card.querySelector('img');
                    if (img && img.src) {
                        const imgPath = Object.keys(models.embeddings || {}).find(path => {
                            return models.embeddings[path].url === img.src;
                        });
                        
                        if (imgPath && models.embeddings[imgPath]) {
                            results.push({
                                path: imgPath,
                                url: models.embeddings[imgPath].url,
                                filename: models.embeddings[imgPath].filename,
                                similarity: 0.9
                            });
                        }
                    }
                });
                
                // Save to navigation stack
                saveToNavigationStack('similar', {
                    sourcePath: imagePath,
                    results: results
                });
                
                console.log('Saved similar search to navigation:', results.length, 'results');
            }, 500);
            
            return result;
        };
    }
})();

// Initialize on page load
function initBackNavigation() {
    console.log('Back navigation initialized');
    updateBackButtonVisibility();
    
    // Make sure back button exists
    const backBtn = document.querySelector('.back-btn');
    if (backBtn) {
        backBtn.onclick = navigateBack;
        console.log('Back button handler attached');
    } else {
        console.warn('Back button not found in DOM');
    }
}

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBackNavigation);
} else {
    initBackNavigation();
}

console.log('✅ Back navigation loaded (FIXED)');
