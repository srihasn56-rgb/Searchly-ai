/**
 * indexer-worker.js — Parallel CLIP image encoder
 *
 * Each worker owns its own ONNX InferenceSession so encoding runs truly
 * in parallel across all available CPU cores, just like the Python app's
 * encode_images_batch() with batch_size=32 spread over multiple processes.
 *
 * Message protocol
 * ────────────────
 * Main → Worker:
 *   { type: 'init',   modelBuffer: ArrayBuffer }   load ONNX model
 *   { type: 'encode', id: string, imageBuffer: ArrayBuffer, filename: string }
 *
 * Worker → Main:
 *   { type: 'ready' }                       model loaded OK
 *   { type: 'error', error: string }        model load failed
 *   { type: 'result',  id, vector: Float32Array }
 *   { type: 'encodeError', id, error: string }
 */

'use strict';

importScripts('https://cdn.jsdelivr.net/npm/onnxruntime-web@1.12.0/dist/ort.js');

let session = null;

const MEAN = [0.48145466, 0.4578275,  0.40821073];
const STD  = [0.26862954, 0.26130258, 0.27577711];
const SIZE = 224;

// ── CLIP normalise ────────────────────────────────────────────────────────────
function normalize(vec) {
    let norm = 0;
    for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
    norm = Math.sqrt(norm) || 1;
    const out = new Float32Array(vec.length);
    for (let i = 0; i < vec.length; i++) out[i] = vec[i] / norm;
    return out;
}

// ── Preprocess image bytes → CLIP Float32Array (CHW, normalised) ─────────────
async function preprocessImage(imageBuffer) {
    // Decode image using ImageDecoder (Chromium 94+) or OffscreenCanvas + fetch trick
    let bitmap;
    try {
        const blob = new Blob([imageBuffer]);
        bitmap = await createImageBitmap(blob, {
            resizeWidth:  SIZE,
            resizeHeight: SIZE,
            resizeQuality: 'pixelated'   // fastest resize in workers
        });
    } catch(e) {
        throw new Error('createImageBitmap failed: ' + e.message);
    }

    // Draw to OffscreenCanvas with centre-crop (same as Python's CLIP preprocess)
    const src_w = bitmap.width;
    const src_h = bitmap.height;

    // First resize so shorter side = 224
    const scale  = SIZE / Math.min(src_w, src_h);
    const draw_w = Math.round(src_w * scale);
    const draw_h = Math.round(src_h * scale);
    const off_x  = Math.round((draw_w - SIZE) / 2);
    const off_y  = Math.round((draw_h - SIZE) / 2);

    // Re-get bitmap at correctly scaled size
    const blob2 = new Blob([imageBuffer]);
    const bmp2  = await createImageBitmap(blob2, {
        resizeWidth:  draw_w,
        resizeHeight: draw_h,
        resizeQuality: 'medium'
    });

    const canvas = new OffscreenCanvas(SIZE, SIZE);
    const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: false });
    ctx.drawImage(bmp2, -off_x, -off_y);
    bmp2.close();
    bitmap.close();

    const { data } = ctx.getImageData(0, 0, SIZE, SIZE);
    const pixels   = data;                    // Uint8ClampedArray RGBA
    const npix     = SIZE * SIZE;             // 50176
    const tensor   = new Float32Array(npix * 3);

    // Channel-first layout: R plane | G plane | B plane
    for (let i = 0; i < npix; i++) {
        const base = i * 4;
        tensor[i]              = (pixels[base]     / 255 - MEAN[0]) / STD[0];
        tensor[i + npix]       = (pixels[base + 1] / 255 - MEAN[1]) / STD[1];
        tensor[i + npix * 2]   = (pixels[base + 2] / 255 - MEAN[2]) / STD[2];
    }
    return tensor;
}

// ── Message handler ────────────────────────────────────────────────────────────
self.onmessage = async ({ data }) => {
    if (data.type === 'init') {
        try {
            ort.env.wasm.numThreads = 1;   // each worker = 1 ONNX thread (pool handles parallelism)
            ort.env.wasm.simd       = true;
            session = await ort.InferenceSession.create(data.modelBuffer, {
                executionProviders: ['wasm'],
                graphOptimizationLevel: 'all',
                enableCpuMemArena: true,
            });
            self.postMessage({ type: 'ready' });
        } catch(e) {
            self.postMessage({ type: 'error', error: e.message });
        }
        return;
    }

    if (data.type === 'encode') {
        const { id, imageBuffer, filename } = data;
        try {
            const tensor = await preprocessImage(imageBuffer);

            const input  = new ort.Tensor('float32', tensor, [1, 3, SIZE, SIZE]);
            const output = await session.run({ input });
            const raw    = Array.from(output.output.data);
            const vector = normalize(new Float32Array(raw));

            self.postMessage({ type: 'result', id, vector }, [vector.buffer]);
        } catch(e) {
            self.postMessage({ type: 'encodeError', id, error: e.message });
        }
        return;
    }
};
