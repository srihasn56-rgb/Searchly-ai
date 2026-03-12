/**
 * download-models.js
 * Pre-downloads CLIP ONNX models so they get bundled into the installer.
 * Run: npm run download-models
 * electron-builder also runs this automatically before build via "beforeBuild" hook.
 */
const https  = require('https');
const http   = require('http');
const fs     = require('fs');
const path   = require('path');

const MODELS = [
  {
    url:  'https://huggingface.co/rocca/openai-clip-js/resolve/main/clip-image-vit-32-float32.onnx',
    file: 'clip-image-vit-32-float32.onnx',
    name: 'Image Model (~170 MB)'
  },
  {
    url:  'https://huggingface.co/rocca/openai-clip-js/resolve/main/clip-text-vit-32-float32-int32.onnx',
    file: 'clip-text-vit-32-float32-int32.onnx',
    name: 'Text Model (~250 MB)'
  }
];

const OUT_DIR = path.join(__dirname, '..', 'build', 'models');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function download(url, dest, name) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dest)) {
      const size = fs.statSync(dest).size;
      if (size > 1_000_000) {
        console.log(`  ✅ ${name} already present (${(size/1024/1024).toFixed(1)} MB) — skipping`);
        return resolve();
      }
      fs.unlinkSync(dest);
    }
    console.log(`  ⬇️  Downloading ${name}...`);
    const file = fs.createWriteStream(dest);
    let received = 0, total = 0;
    function get(u) {
      const mod = u.startsWith('https') ? https : http;
      mod.get(u, { headers: { 'User-Agent': 'SearchlyAI/1.0' } }, res => {
        if (res.statusCode === 301 || res.statusCode === 302) return get(res.headers.location);
        if (res.statusCode !== 200) { file.close(); try{fs.unlinkSync(dest);}catch(e){} return reject(new Error(`HTTP ${res.statusCode}`)); }
        total = parseInt(res.headers['content-length'] || '0');
        res.on('data', chunk => {
          received += chunk.length;
          if (total > 0) process.stdout.write(`\r  ⬇️  ${name}: ${Math.round(received/total*100)}% (${(received/1024/1024).toFixed(1)} MB)`);
        });
        res.pipe(file);
        file.on('finish', () => { file.close(); process.stdout.write(`\r  ✅ ${name} done — ${(received/1024/1024).toFixed(1)} MB\n`); resolve(); });
      }).on('error', err => { file.close(); try{fs.unlinkSync(dest);}catch(e){} reject(err); });
    }
    get(url);
  });
}

async function main() {
  console.log('\n📦 Searchly AI — Downloading AI models for bundling...\n');
  for (const m of MODELS) {
    try { await download(m.url, path.join(OUT_DIR, m.file), m.name); }
    catch(e) { console.error(`\n  ❌ ${m.name} failed: ${e.message}\n`); process.exit(1); }
  }
  console.log('\n✅ All models ready in build/models/ — run npm run build:win to package\n');
}
main();
