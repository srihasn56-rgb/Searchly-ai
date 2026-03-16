// ==================== INPUT VALIDATION & SANITIZATION ====================
// Protects against XSS, injection attacks, and malformed input

const VALIDATION_RULES = {
    SEARCH_QUERY: {
        minLength: 1,
        maxLength: 200,
        pattern: /^[a-zA-Z0-9\s\-\_\.,'!?]+$/,
        stripHTML: true
    },
    FILE_NAME: {
        maxLength: 255,
        allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
        pattern: /^[a-zA-Z0-9\s\-\_\.]+$/
    },
    FOLDER_ID: {
        maxLength: 100,
        pattern: /^[a-zA-Z0-9\-\_]+$/
    }
};

// sanitize HTML to prevent XSS
function sanitizeHTML(input) {
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
}

// remove dangerous characters
function stripDangerousChars(input) {
    return input
        .replace(/[<>]/g, '')        // Remove HTML tags
        .replace(/['"]/g, '')         // Remove quotes
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+=/gi, '')      // Remove event handlers
        .trim();
}

// validate search query
function validateSearchQuery(query) {
    if (!query || typeof query !== 'string') {
        return { valid: false, error: 'Query must be a non-empty string' };
    }
    
    const trimmed = query.trim();
    
    if (trimmed.length < VALIDATION_RULES.SEARCH_QUERY.minLength) {
        return { valid: false, error: 'Query too short' };
    }
    
    if (trimmed.length > VALIDATION_RULES.SEARCH_QUERY.maxLength) {
        return { valid: false, error: `Query too long (max ${VALIDATION_RULES.SEARCH_QUERY.maxLength} characters)` };
    }
    
    // Sanitize
    const sanitized = VALIDATION_RULES.SEARCH_QUERY.stripHTML 
        ? stripDangerousChars(trimmed)
        : trimmed;
    
    return { valid: true, value: sanitized };
}

// validate file
function validateFile(file) {
    if (!file || !file.name) {
        return { valid: false, error: 'Invalid file' };
    }
    
    // Check file name length
    if (file.name.length > VALIDATION_RULES.FILE_NAME.maxLength) {
        return { valid: false, error: 'File name too long' };
    }
    
    // Check extension
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!VALIDATION_RULES.FILE_NAME.allowedExtensions.includes(ext)) {
        return { valid: false, error: `File type not allowed. Allowed: ${VALIDATION_RULES.FILE_NAME.allowedExtensions.join(', ')}` };
    }
    
    // Check file size (from memory-management)
    if (typeof MEMORY_CONFIG !== 'undefined' && file.size > MEMORY_CONFIG.MAX_FILE_SIZE) {
        return { valid: false, error: `File too large (max ${MEMORY_CONFIG.MAX_FILE_SIZE / 1024 / 1024}MB)` };
    }
    
    // Check MIME type
    if (file.type && !file.type.startsWith('image/')) {
        return { valid: false, error: 'File must be an image' };
    }
    
    return { valid: true, file };
}

// validate folder ID (Google Drive)
function validateFolderId(folderId) {
    if (!folderId || typeof folderId !== 'string') {
        return { valid: false, error: 'Folder ID required' };
    }
    
    const trimmed = folderId.trim();
    
    if (trimmed.length > VALIDATION_RULES.FOLDER_ID.maxLength) {
        return { valid: false, error: 'Folder ID too long' };
    }
    
    if (!VALIDATION_RULES.FOLDER_ID.pattern.test(trimmed)) {
        return { valid: false, error: 'Invalid folder ID format' };
    }
    
    return { valid: true, value: trimmed };
}

// validate URL
function validateURL(url) {
    try {
        const parsed = new URL(url);
        
        // Only allow http and https
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            return { valid: false, error: 'Invalid URL protocol' };
        }
        
        return { valid: true, value: url };
    } catch (e) {
        return { valid: false, error: 'Invalid URL format' };
    }
}

// sanitize for display (prevent XSS)
function sanitizeForDisplay(text) {
    if (typeof text !== 'string') return '';
    
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}

// validate and sanitize form data
function validateForm(formData) {
    const errors = [];
    const sanitized = {};
    
    for (const [key, value] of Object.entries(formData)) {
        if (key === 'searchQuery') {
            const result = validateSearchQuery(value);
            if (!result.valid) {
                errors.push(`Search query: ${result.error}`);
            } else {
                sanitized[key] = result.value;
            }
        }
        else if (key === 'folderId') {
            const result = validateFolderId(value);
            if (!result.valid) {
                errors.push(`Folder ID: ${result.error}`);
            } else {
                sanitized[key] = result.value;
            }
        }
        else {
            // Default: strip dangerous characters
            sanitized[key] = stripDangerousChars(String(value));
        }
    }
    
    return {
        valid: errors.length === 0,
        errors,
        data: sanitized
    };
}

// enhanced search input with validation
function setupSearchValidation() {
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    
    if (!searchInput || !searchBtn) return;
    
    // Real-time validation
    searchInput.addEventListener('input', (e) => {
        const result = validateSearchQuery(e.target.value);
        
        if (!result.valid && e.target.value.length > 0) {
            searchInput.classList.add('invalid');
            searchBtn.disabled = true;
        } else {
            searchInput.classList.remove('invalid');
            searchBtn.disabled = false;
        }
    });
    
    // Sanitize on submit
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const result = validateSearchQuery(searchInput.value);
            if (result.valid) {
                searchInput.value = result.value;
            } else {
                showError(result.error);
                e.preventDefault();
            }
        }
    });
}

// validate file drop/upload
function setupFileValidation() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    
    const validateFiles = (files) => {
        const valid = [];
        const invalid = [];
        
        for (const file of files) {
            const result = validateFile(file);
            if (result.valid) {
                valid.push(file);
            } else {
                invalid.push({ file: file.name, error: result.error });
            }
        }
        
        if (invalid.length > 0) {
            const errorMsg = invalid.map(i => `${i.file}: ${i.error}`).join('\n');
            showWarning(`Some files were skipped:\n${errorMsg}`);
        }
        
        return valid;
    };
    
    if (dropZone) {
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            const files = Array.from(e.dataTransfer.files);
            const validFiles = validateFiles(files);
            
            if (validFiles.length > 0) {
                // Process valid files
                handleFiles(validFiles);
            }
        });
    }
    
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            const validFiles = validateFiles(files);
            
            if (validFiles.length > 0) {
                handleFiles(validFiles);
            }
        });
    }
}

// setup all validation
function initValidation() {
    setupSearchValidation();
    setupFileValidation();
    console.log('Input validation initialized');
}

// CSS for validation states
/*
.invalid {
    border-color: #ef4444 !important;
    box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.2) !important;
}

.valid {
    border-color: #10b981 !important;
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2) !important;
}

.validation-error {
    color: #ef4444;
    font-size: 12px;
    margin-top: 4px;
}
*/

// Usage example:
/*
// In your search function:
async function performSearch() {
    const rawQuery = document.getElementById("searchInput").value;
    
    // Validate input
    const validation = validateSearchQuery(rawQuery);
    if (!validation.valid) {
        showError(validation.error);
        return;
    }
    
    // Use sanitized query
    const query = validation.value;
    
    // Continue with search...
}

// In your Google Drive function:
async function loadGoogleDriveFolder(folderId) {
    // Validate folder ID
    const validation = validateFolderId(folderId);
    if (!validation.valid) {
        showError(validation.error);
        return;
    }
    
    // Use sanitized folder ID
    const safeFolderId = validation.value;
    
    // Continue...
}
*/
