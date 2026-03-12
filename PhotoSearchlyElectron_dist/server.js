// Load .env from app resources when running inside Electron
const path = require('path');
if (process.resourcesPath) {
  require('dotenv').config({ path: path.join(process.resourcesPath, '.env') });
} else {
  require('dotenv').config();
}

const express = require('express');
const { google } = require('googleapis');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const csrf = require('csurf');

const app = express();

// environment variables
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://localhost:5500/oauth2callback';
const PORT = process.env.PORT || 5500;
const NODE_ENV = process.env.NODE_ENV || 'development';

// security middleware
app.use(helmet({
    contentSecurityPolicy: false // Allow inline scripts for ONNX
}));

// rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});

const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // limit each IP to 5 auth requests per hour
    message: 'Too many authentication attempts, please try again later.'
});

// apply rate limiting
app.use('/auth/', authLimiter);
app.use('/drive/', limiter);

// middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(cookieParser());

// CSRF protection (disabled for API calls, enable for forms if needed)
// const csrfProtection = csrf({ cookie: true });

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

let tokens = null;

// ==================== ROUTES ====================

// privacy policy
app.get('/privacy', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'privacy.html'));
});

// main app
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// google oauth - get auth URL
app.get('/auth/google', (req, res) => {
    try {
        // Include drive scope for read AND delete
        const scopes = [
            'https://www.googleapis.com/auth/drive.file', // Access files created by app
            'https://www.googleapis.com/auth/drive' // Full drive access for deletion
        ];
        const authUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes
        });
        res.json({ authUrl });
    } catch (error) {
        console.error('Auth URL error:', error);
        res.status(500).json({ error: 'Failed to generate auth URL' });
    }
});

// oauth callback
app.get('/oauth2callback', async (req, res) => {
    const { code } = req.query;
    
    if (!code) {
        return res.status(400).send('No authorization code received');
    }
    
    try {
        const { tokens: newTokens } = await oauth2Client.getToken(code);
        tokens = newTokens;
        oauth2Client.setCredentials(tokens);
        
        res.send(`
            <html>
                <head>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
                               display: flex; align-items: center; justify-content: center; 
                               height: 100vh; margin: 0; background: #000; color: #fff; }
                        .message { text-align: center; }
                        h2 { color: #10b981; }
                    </style>
                </head>
                <body>
                    <div class="message">
                        <h2>✅ Authentication Successful!</h2>
                        <p>You can close this window and return to the app.</p>
                    </div>
                    <script>setTimeout(() => window.close(), 2000);</script>
                </body>
            </html>
        `);
    } catch (error) {
        console.error('OAuth error:', error);
        res.status(500).send(`
            <html>
                <head>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
                               display: flex; align-items: center; justify-content: center; 
                               height: 100vh; margin: 0; background: #000; color: #fff; }
                        .message { text-align: center; }
                        h2 { color: #ef4444; }
                    </style>
                </head>
                <body>
                    <div class="message">
                        <h2>❌ Authentication Failed</h2>
                        <p>Please try again or check your credentials.</p>
                    </div>
                </body>
            </html>
        `);
    }
});

// check auth status
app.get('/auth/check', (req, res) => {
    res.json({ authenticated: !!tokens });
});

// validate folder ID
function validateFolderId(folderId) {
    if (!folderId || typeof folderId !== 'string') {
        return false;
    }
    // Google Drive folder IDs are alphanumeric with hyphens and underscores
    return /^[a-zA-Z0-9\-_]+$/.test(folderId) && folderId.length <= 100;
}

// proxy drive api requests
app.post('/drive/files', async (req, res) => {
    if (!tokens) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const { folderId } = req.body;
        
        // validate folder ID
        if (!validateFolderId(folderId)) {
            return res.status(400).json({ error: 'Invalid folder ID format' });
        }
        
        oauth2Client.setCredentials(tokens);
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        
        const response = await drive.files.list({
            q: `'${folderId}' in parents and mimeType contains 'image/'`,
            fields: 'files(id, name, mimeType, thumbnailLink, webContentLink)',
            pageSize: 1000
        });
        
        res.json(response.data);
    } catch (error) {
        console.error('Drive API error:', error);
        
        if (error.code === 401) {
            tokens = null; // Clear invalid tokens
            return res.status(401).json({ error: 'Authentication expired. Please reconnect.' });
        }
        
        res.status(500).json({ error: 'Failed to list files. Please try again.' });
    }
});

// get file content
app.get('/drive/file/:fileId', async (req, res) => {
    if (!tokens) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const { fileId } = req.params;
        
        // validate file ID
        if (!validateFolderId(fileId)) {
            return res.status(400).json({ error: 'Invalid file ID format' });
        }
        
        oauth2Client.setCredentials(tokens);
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        
        const response = await drive.files.get({
            fileId: fileId,
            alt: 'media'
        }, { responseType: 'arraybuffer' });
        
        res.set('Content-Type', 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
        res.send(Buffer.from(response.data));
    } catch (error) {
        console.error('File fetch error:', error);
        
        if (error.code === 404) {
            return res.status(404).json({ error: 'File not found' });
        }
        
        res.status(500).json({ error: 'Failed to fetch file' });
    }
});

// logout
app.post('/auth/logout', (req, res) => {
    tokens = null;
    res.json({ success: true, message: 'Logged out successfully' });
});

// DELETE file from Google Drive
app.delete('/drive/delete/:fileId', async (req, res) => {
    if (!tokens) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const { fileId } = req.params;
        
        // validate file ID
        if (!validateFolderId(fileId)) {
            return res.status(400).json({ error: 'Invalid file ID format' });
        }
        
        oauth2Client.setCredentials(tokens);
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        
        // Delete the file
        await drive.files.delete({
            fileId: fileId
        });
        
        console.log(`✅ Deleted file from Google Drive: ${fileId}`);
        res.json({ success: true, message: 'File deleted successfully' });
    } catch (error) {
        console.error('File delete error:', error);
        
        if (error.code === 404) {
            return res.status(404).json({ error: 'File not found' });
        }
        
        if (error.code === 403) {
            return res.status(403).json({ error: 'Permission denied. File may be read-only.' });
        }
        
        res.status(500).json({ error: 'Failed to delete file' });
    }
});

// health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        environment: NODE_ENV 
    });
});


// ==================== /api/ ALIASES (called by frontend) ====================

// GET /api/drive/files — frontend polls this for paginated Drive file list
// GET /api/drive/folders — list folders for folder picker
app.get('/api/drive/folders', async (req, res) => {
    if (!tokens) return res.status(401).json({ error: 'Not authenticated' });
    try {
        const { parentId } = req.query;
        oauth2Client.setCredentials(tokens);
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        const q = parentId
            ? `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
            : `mimeType = 'application/vnd.google-apps.folder' and 'root' in parents and trashed = false`;
        const response = await drive.files.list({
            q, fields: 'files(id, name, parents)', pageSize: 100, spaces: 'drive'
        });
        res.json({ folders: response.data.files || [] });
    } catch (error) {
        console.error('Drive folders error:', error);
        res.status(500).json({ error: 'Failed to list folders' });
    }
});

app.get('/api/drive/files', async (req, res) => {
    if (!tokens) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
        const { pageToken, folderId } = req.query;
        oauth2Client.setCredentials(tokens);
        const drive = google.drive({ version: 'v3', auth: oauth2Client });

        const params = {
            q: folderId
                ? `'${folderId}' in parents and mimeType contains 'image/'`
                : "mimeType contains 'image/'",
            fields: 'nextPageToken, files(id, name, mimeType, thumbnailLink, webContentLink)',
            pageSize: 100,
            spaces: 'drive',
        };
        if (pageToken) params.pageToken = pageToken;

        const response = await drive.files.list(params);
        res.json(response.data);
    } catch (error) {
        console.error('Drive files error:', error);
        if (error.code === 401) {
            tokens = null;
            return res.status(401).json({ error: 'Authentication expired. Please reconnect.' });
        }
        res.status(500).json({ error: 'Failed to list Drive files.' });
    }
});

// GET /api/drive/download/:fileId — frontend downloads image bytes through this
app.get('/api/drive/download/:fileId', async (req, res) => {
    if (!tokens) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
        const { fileId } = req.params;
        if (!validateFolderId(fileId)) {
            return res.status(400).json({ error: 'Invalid file ID format' });
        }
        oauth2Client.setCredentials(tokens);
        const drive = google.drive({ version: 'v3', auth: oauth2Client });

        const response = await drive.files.get(
            { fileId, alt: 'media' },
            { responseType: 'arraybuffer' }
        );

        const contentType = response.headers['content-type'] || 'image/jpeg';
        res.set('Content-Type', contentType);
        res.set('Cache-Control', 'public, max-age=86400');
        res.send(Buffer.from(response.data));
    } catch (error) {
        console.error('Drive download error:', error);
        if (error.code === 404) return res.status(404).json({ error: 'File not found' });
        res.status(500).json({ error: 'Failed to download file' });
    }
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ 
        error: NODE_ENV === 'development' ? err.message : 'Internal server error' 
    });
});

// graceful shutdown handled by Electron in main.js
// process.on('SIGTERM'...) removed to avoid conflicts with Electron lifecycle

// start server
const server = app.listen(PORT, () => {
    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║                                                               ║');
    console.log('║   🚀 Photo Searchly AI Server - Production Ready             ║');
    console.log('║                                                               ║');
    console.log(`║   URL:     http://localhost:${PORT.toString().padEnd(38)}║`);
    console.log(`║   Privacy: http://localhost:${PORT}/privacy${' '.repeat(23)}║`);
    console.log(`║   Health:  http://localhost:${PORT}/health${' '.repeat(24)}║`);
    console.log('║                                                               ║');
    console.log('║   ✅ Server running                                          ║');
    console.log('║   ✅ Environment variables loaded                            ║');
    console.log('║   ✅ Security middleware active                              ║');
    console.log('║   ✅ Rate limiting enabled                                   ║');
    console.log('║                                                               ║');
    console.log(`║   Environment: ${NODE_ENV.toUpperCase().padEnd(44)}║`);
    console.log('║                                                               ║');
    console.log('║   Press Ctrl+C to stop                                        ║');
    console.log('║                                                               ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');
});

module.exports = server; // Export for testing
